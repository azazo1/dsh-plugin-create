# Build And Test

推荐使用 TypeScript 编写源码, 先进行类型检查, 再将源码编译为 JavaScript 并输出到 `lib/`.

```text
src/  -- TypeScript build -->  lib/
```

## Justfile

插件仓库应在根目录提供 `justfile`, 将依赖安装, 类型检查, Host 构建, Client 构建, 测试和打包预览固定为可复现的 recipe. 可复制 skill 中的 [`templates/justfile`](../templates/justfile), 再根据项目实际脚本和配置文件调整.

```shell
just install
just typecheck
just build
just test
just verify
```

`build-host` 和 `build-client` 应分别调用 Host ESM 和 Client IIFE 的构建配置. `verify` 应串联类型检查, 完整构建, 测试和 `pnpm pack --dry-run`, 并补充项目所需的 Client loader registration 检查. 不要在 justfile 中写入仅适用于沙箱的环境变量或临时缓存参数.

## Lockfile 与 CI

插件使用 pnpm. 提交 `pnpm-lock.yaml`, 并在 `package.json` 声明 `packageManager`. CI 用 `pnpm install --frozen-lockfile` 安装依赖, 再用 `pnpm run check` 做类型检查, 测试和构建. 跟踪 DSH alpha 包时, 在 `pnpm-workspace.yaml` 把 `@deepseek-ai/*` 加入 `minimumReleaseAgeExclude`, 否则 frozen lockfile 会因 24 小时发布窗口拒绝安装.

## 基本流程

1. 使用 pnpm 安装依赖.
2. 执行 TypeScript 类型检查, 确认源码和声明没有类型错误.
3. 执行构建脚本, 生成 `lib/` 下的 JavaScript, source map 和类型声明.
4. 按项目需要运行针对 Host, Client 或配置逻辑的测试.
5. 检查 `package.json` 的入口和 `files` 配置是否指向 `lib/`.

构建产物不应手工修改. 发布前应在干净环境重新生成 `lib/`, 并确认包内不包含未构建的临时文件.

## Git Hosted Package Installation

错误示例: 仓库已提交 `lib/`, 但仍在 `package.json` 中配置:

```json
{"scripts":{"prepare":"pnpm run build"}}
```

使用 github 方式安装 dsh 插件时 pnpm 会执行 `prepare`, 触发 `allowBuilds` 错误, 用户需要在 profile 的 `pnpm-workspace.yaml` 中允许该包后重试安装. 已提交 `lib/` 时应删除 `prepare`, 让安装直接使用构建产物.
除非插件真的有需要在安装的时候进行构建的操作.

## 依赖审查

构建前检查新增依赖是否真的必要. 优先复用 DSH 和平台已有能力, 避免为了少量逻辑引入大型运行时依赖.

新增大型依赖时, 应在变更说明中记录替代方案, 体积和启动影响, 许可证, 维护状态以及为什么不能使用更轻量的实现. 测试依赖和运行时依赖分开声明, 能放入 `devDependencies` 的不放入运行时依赖.

## Web Client 特殊构建

DSH Web Client bundle 使用 `window.__ModuleLoader__` 的懒加载模块表, 不是普通浏览器 ESM. Client 入口需要在顶层执行:

```ts
window.__ModuleLoader__.load({
  id: 'dsh-example',
  factory: (require) => ({
    inject: ['slots', 'locale', 'configForms'],
    apply(ctx) {
      // plugin body
    },
  }),
})
```

Client 文件必须注册和 package name 完全一致的 `id`. 如果只输出普通 ESM, 会出现 `client-modules: bundle <url> loaded without registering "<id>" via __ModuleLoader__.load`.

`factory` 的 `require` 从平台模块表解析依赖, 表中可用的模块有: `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `@deepseek-ai/cordis`, `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-client-ui-primitives`, `@deepseek-ai/dsh-client-ui-dockkit`. 表外模块在构建时必须打进 bundle, 运行时请求表外模块会直接抛错. React 放在 peerDependencies 中.

表内的包要在构建里标成 external (`deps.neverBundle`), 否则打包器会顺着 import 把宿主包打进来, 或者直接报错: `@deepseek-ai/dsh-client-ui-primitives` 会带进它的 `.module.css`, 报 `CSS file ... was encountered but @tsdown/css is not installed`; `@deepseek-ai/dsh-client-store` 同理. 只用于类型的包 (`-ui-settings`, `-ui-plugin-manager`, `-ui-slots`, `-ui-renderer`, `-ui-locale`) 用 `import type` 引入, 不占模块表.

建议将 Host 和 Client 分开构建:

- Host: ESM, 例如 `lib/index.js`.
- Client: 浏览器目标, 输出到 `lib/client.js`. 官方 client bundle 使用 CJS 包装 + banner/footer 注入 `__ModuleLoader__.load({ id, factory })`, 外部插件用 IIFE 达到同样效果即可; 无论哪种形态, 顶层都必须完成注册, 并在 `dsh.client` 声明 `platform: 'web'` 与 Client 入口.
- `package.json` 的 `./client` export 指向实际的 Client 产物文件.

构建后检查 Client 文件没有顶层 `import` 或 ESM `export`, 并包含正确的 loader registration.

三种产物形态与各自的约束 (写 TSX 时 `tsconfig` 要开 `jsx: react-jsx`):

| 形态 | 顶层注册 | 平台模块怎么拿 |
|---|---|---|
| tsdown banner/footer 包成 CJS (官方形态) | banner 注入 | 顶层 `import` 平台模块, 产物里变成 `require` |
| entry 自己调 `__ModuleLoader__.load` 的 IIFE | entry 里写 | 只能经 factory 的 `require`, 组件写成工厂 + `createElement` |
| `tsc` 直出的单文件脚本 (无打包器) | entry 里写 | 同上; 文件里不能出现任何 `import` / `export` |

Client 半区常见的 devDependencies: `-ui-settings` (`ConfigForm` 类型), `-ui-primitives` (表单与控件), `-ui-plugin-manager` (SlotMap 合并, 让 `plugins.bundle.config` 这类 key 有类型), `-ui-slots` (`PropsRuntime` / `PropsLocale` / `InjectFace`), `-ui-renderer` (Context 上的 `slots` 合并), `-dsh-client-store` (`SnapshotStore`), `-dsh-client-locale` (`ctx.locale`).

当 pack 包的 `devDependencies` 不被传给消费者, 而 `.d.ts` 引用了某些声明时, 关闭 `skipLibCheck` 做一次诊断类型检查, 把实际消费的声明归属包声明为直接 dev/peer 依赖, 避免 `skipLibCheck: true` 把缺失包悄悄变成 `any`.

## 验证

在干净环境重新生成构建产物, 并做最小入口验证:

- 类型检查通过.
- 构建可以从 `src/` 生成 `lib/`.
- `package.json` 的入口可以加载生成产物.
- 包内容不包含源码外的临时文件.
- 新增依赖没有改变不相关的插件行为.

最小的入口验证可以在 Node VM 中执行 Client bundle, 提供一个假 `window.__ModuleLoader__.load` 收集 registration, 然后检查:

- registration id 等于插件 package name.
- factory 返回的 `inject` 包含实际依赖.
- package tarball 包含 Client bundle, Host bundle, 声明文件和 patch 文件.
- 当 package 使用 `exports` 时, `require.resolve('<package>/package.json')` 可解析 (需要 `exports` 中包含 `"./package.json"`), 以便 DSH 扫描 `dsh.client` metadata.
- 在运行中的 Web profile 中, `/plugins/<package>/client.js` 返回 Client bundle. 404 表示 Host entry 未激活, package 未在 profile bundles 中, 或 Client metadata 未被扫描.

Client bundle 的验证脚本要 **stub 平台模块**, 不要真的 `require` 宿主包: 它们的传递依赖 (例如 `clsx`, `zustand`) 在本仓的 `node_modules` 里不一定可解析, 会把检查变成环境问题. 断言 registration id, `inject` 列表, 以及"只请求模块表里的模块"就够了.

产物内容的断言用稳定标识 (条目 id, 槽位名, 路由常量), 不要断言界面文案: 文案一改断言就挂, 而它并不能说明产物坏了.

本地验证按 CI 的顺序做 (先 build 再 test). 反过来会拿上一次的产物测试, 把只有 CI 才暴露的问题留到推送之后.

## 真实组合验证

对用户实际会运行的插件, 单元测试或 mock Context 不能替代真实组合测试. 从变更面选择最小的充分测试集:

- 纯逻辑或内部 helper: 只运行单元测试.
- 模型可见行为 (prompt, tool Schema, tool 输出, Skill 目录): 在所属 example suite 中添加无凭据 snapshot, 然后添加真实组合测试.
- 协议可见行为 (ACP, JSON-RPC, wire transport): 添加无凭据 snapshot.
- 用户可见行为 (CLI transcript, 交互式终端, GUI 流程): 使用所属仓库的产品入口测试套件.
- Provider 行为 (新 adapter 或真实 provider 特性): 凭据可用且执行被授权时运行真实 API e2e 测试.

真实组合测试通过 Loader 和应用 / 进程入口启动测试用 `cordis.yml`, 只 mock 外部服务或非确定性输入, 断言模型可见请求或日志, 持久化状态或用户可见输出. 不要给已发布默认值添加测试选项.

对于带 `bin` 的包, 构建产物必须在本机 Node 下运行 (不用 tsx), 暴露 tsx 可能隐藏的关闭竞态, 模块解析和被吞掉的加载失败; 缺少必需配置时进程必须非零退出.

Web Client 插件还必须真实挂载验证, 而不是只接受一个 HTTP 200: 读取 host boot manifest, 请求宣告的 client artifact, 证明注册和挂载完成.