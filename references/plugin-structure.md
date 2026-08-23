# Plugin Structure

推荐使用 TypeScript 编写插件源码, 并将构建产物与源码分离:

```text
plugin/
├── src/                 # TypeScript 源码
│   ├── index.ts         # Host 入口
│   ├── shared.ts        # Host 和 Client 共享类型与常量
│   └── client/          # Client 源码
├── lib/                 # 构建生成的 JavaScript 和类型声明
├── package.json
├── tsconfig.json
└── cordis.patch.yml
```

- `src/` 只保存手写的 TypeScript 源码.
- `lib/` 只保存构建生成的 JavaScript, source map 和 TypeScript 声明文件.
- `package.json` 的 `main` 和 `exports` 应指向 `lib/` 中的产物.
- 不要在 `src/` 中直接维护发布用的 JavaScript 文件.
- `lib/` 属于发布内容时, 应在构建后检查并纳入 npm package files.
- 不要将 `lib/` 添加到 `.gitignore`, 以便构建产物可以被检查和发布.

## Bundle 与 Profile 激活

可安装的依赖不会自动成为 DSH 运行插件. 插件 package 必须声明 bundle patch, 让 `dsh plugin --profile web add` 能将它纳入 profile 的 bundles 列表:

```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    },
    "client": {
      "platform": "web"
    }
  }
}
```

`cordis.patch.yml` 至少插入插件自身的 Host entry:

```yml
- insert:
    - id: dsh-example
      name: dsh-example
```

同时必须公开 package metadata. `dsh-client-modules` 通过 `require.resolve('<package>/package.json')` 扫描 `dsh.client`, 所以有 `exports` 字段的插件必须包含:

```json
{
  "exports": {
    "./package.json": "./package.json"
  }
}
```

缺少该 export 时, Client 扫描器会将插件静默视为非 Client 插件, `/plugins/<package>/client.js` 不会发布. 安装后检查 profile 的 `dsh.profile.bundles` 包含插件名. 修改 bundle metadata, Client export 或 Client bundle 后, 重启 `dsh web`, 因为 Client metadata 的扫描结果会在进程内缓存.

## 轻量化原则

插件应优先使用 DSH 已提供的服务, UI primitives 和运行时能力. 能用标准 API 或少量本地代码解决的问题, 不引入大型框架或重复实现的基础设施.

引入大型依赖前, 需要说明:

- 为什么现有 DSH API 或小型依赖无法满足需求.
- 依赖的实际使用范围和运行时体积影响.
- 是否可以改为按需引入, peer dependency 或构建期依赖.
- 依赖的维护状态, 许可证和与 DSH 运行环境的兼容性.

插件保持单一职责. 不要因为一个小功能引入完整状态管理, 路由, UI 框架或服务端框架. 只有当依赖显著降低复杂度并且收益明确时才使用.

## Repository Description

创建插件仓库时, 必须先准备 repo description, 并在 `gh repo create` 中通过 `--description` 传入:

```shell
gh repo create OWNER/REPOSITORY --public \
  --description "简短说明插件解决的问题和主要使用场景"
```

description 应简短说明插件解决的问题和主要使用场景, 不要只写技术实现或空泛的项目名称. 包名, `--description`, `package.json` 的 `description` 和 README 开头的定位说明应保持一致.

## Plugin Installation Source

使用 DSH 添加插件时, GitHub 仓库优先使用 `OWNER/REPOSITORY` 或 `OWNER/REPOSITORY#REF` 形式:

```shell
dsh plugin --profile web add OWNER/REPOSITORY
dsh plugin --profile web add OWNER/REPOSITORY#v0.1.0
```

省略 `#REF` 时使用仓库默认分支的最新内容, 通常是 `main`. 指定 `REF` 时优先使用发布 tag, 也可以使用明确的 commit. 发布文档和需要复现的环境应显式固定 tag 或 commit, 日常试用可以省略 `#REF` 获取最新版本.

