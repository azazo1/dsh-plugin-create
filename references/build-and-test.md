# Build And Test

推荐使用 TypeScript 编写源码, 先进行类型检查, 再将源码编译为 JavaScript 并输出到 `lib/`.

```text
src/  -- TypeScript build -->  lib/
```

基本流程:

1. 使用项目统一的包管理器安装依赖.
2. 执行 TypeScript 类型检查, 确认源码和声明没有类型错误.
3. 执行构建脚本, 生成 `lib/` 下的 JavaScript, source map 和类型声明.
4. 按项目需要运行针对 Host, Client 或配置逻辑的测试.
5. 检查 `package.json` 的入口和 `files` 配置是否指向 `lib/`.

构建产物不应手工修改. 发布前应在干净环境重新生成 `lib/`, 并确认包内不包含未构建的临时文件.

## 依赖审查

构建前检查新增依赖是否真的必要. 优先复用 DSH 和平台已有能力, 避免为了少量逻辑引入大型运行时依赖.

新增大型依赖时, 应在变更说明中记录替代方案, 体积和启动影响, 许可证, 维护状态以及为什么不能使用更轻量的实现. 测试依赖和运行时依赖分开声明, 能放入 `devDependencies` 的不放入运行时依赖.

## 最小验证

至少验证以下内容:

- 类型检查通过.
- 构建可以从 `src/` 生成 `lib/`.
- `package.json` 的入口可以加载生成产物.
- 包内容不包含源码外的临时文件.
- 新增依赖没有改变不相关的插件行为.

## Web Client 特殊构建

DSH Web Client bundle 使用 `window.__ModuleLoader__` 的懒加载模块表, 不是普通浏览器 ESM. Client 入口需要在顶层执行:

```ts
window.__ModuleLoader__.load({
  id: 'dsh-example',
  factory: (require) => ({
    inject: ['settingsScope', 'slots'],
    apply(ctx) {
      // plugin body
    },
  }),
})
```

Client 文件必须注册和 package name 完全一致的 `id`. 如果只输出普通 ESM, 会出现 `bundle loaded without registering ... via __ModuleLoader__.load`.

建议将 Host 和 Client 分开构建:

- Host: ESM, 例如 `lib/index.js`.
- Client: IIFE, 例如 `lib/index.iife.js`.
- `package.json` 的 `./client` export 指向实际的 IIFE 文件.

Client factory 中使用 React 时, 通过 factory 的 `require('react')` 获取运行时, React 放在 peerDependencies 中. 构建后检查 Client 文件没有顶层 `import` 或 ESM `export`, 并包含正确的 loader registration.

最小的入口验证可以在 Node VM 中执行 Client IIFE, 提供一个假 `window.__ModuleLoader__.load` 收集 registration, 然后检查:

- registration id 等于插件 package name.
- factory 返回的 `inject` 包含实际依赖.
- package tarball 包含 Client bundle, Host bundle, 声明文件和 patch 文件.
