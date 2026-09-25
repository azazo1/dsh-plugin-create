# Dual Host

DSH 有两个宿主形态, 外部插件对两者应当同样可用:

- `dsh web`: 由 CLI 起的 Web 服务, profile 默认是 `web`.
- Desktop: Electron 外壳加载同一套 Web 应用, profile 是 `desktop`.

## 1. 两个宿主的关系

Desktop 不是第二套前端: 主进程用 Electron 的 Node 模式起一个 Host 子进程, 再加载打包好的 Web 产物, 页面与 API 仍走这一套 Web 应用. 初始化 Desktop profile 时它直接复用 Web 的 bundle 列表 (`@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`), 所以组合内容同源, 插件在两个宿主里的挂载与激活方式一致, 不需要为 Desktop 单独构建或维护第二份产物.

差异只在 profile 归属, 端口与平台标记:

| 项 | web | desktop |
|---|---|---|
| profile 目录 | `$DSH_HOME/profiles/web` | `$DSH_HOME/profiles/desktop` |
| profile 的归属 | `dsh plugin` 命令管理 | Electron 应用独占, CLI 会拒绝 `--profile desktop` |
| 默认端口 | 3080 | 19387 |
| 前端产物来源 | Host 提供 | 打包在应用内, 由 Electron 转发给已认证的 Host |
| 插件安装入口 | `dsh plugin --profile web add` 或应用内插件管理器 | 只能用应用内插件管理器 (自带 pnpm) |
| 平台标记 | 无 | `<html>` 上带平台标记, Client 侧可读 `document.documentElement.dataset.platform` |

两个 profile 的包依赖互不相通: Desktop 与 CLI 共享 `$DSH_HOME` 下的产品数据, 但不共享可执行包, 插件激活与 lockfile. 所以在 web 里装过不等于 desktop 里装过.

## 2. 安装

web:

```shell
dsh plugin --profile web add OWNER/REPOSITORY
dsh plugin --profile web add ./local-plugin
```

desktop 没有命令行入口, 在应用的插件页填同一个包名, GitHub 仓库标识或本地目录, 装完重启应用.

装完都要重启宿主一次: Client metadata 的扫描结果在进程内缓存, 只刷新页面不足以重新扫描.

## 3. 双宿主插件的写法

对绝大多数插件, 同时适配两个宿主不需要写任何分支, 只要守住下面几条:

- 不要硬编码 profile 名或 profile 目录 (`~/.dsh/profiles/web` 这类路径在 desktop 宿主里是错的). 需要落盘时用 DSH 提供的 home 解析与 storage 服务, 不要自己拼 `.dsh`.
- 不要硬编码端口. 需要回调地址时从宿主提供的配置或 boot 信息里取.
- 不要把 `dsh` 命令或 CLI 专有的环境变量当成运行时前提: 在 Desktop 里, Host 与插件跑在 Electron 的 Node 模式进程里, 没有 CLI.
- 需要区分宿主时读 `document.documentElement.dataset.platform` (Client 侧), 不要用浏览器 UA 或端口猜测.
- 要用外部命令时, 优先调用 DSH 已提供的运行时与子进程服务, 不要假设用户 shell 的 PATH.
- Host 侧的插件不要假设某个可选 bundle 一定在组合里; 组合是两个宿主各自的 profile 决定的.

Client bundle 的供应与缓存语义两边一致, 不需要为 Desktop 做特殊处理 (Desktop 会把插件 bundle 响应标成 `no-store`, 因为每次启动的 revision 都不同).

## 4. 验证

web 侧按 [build-and-test.md](build-and-test.md) 的挂载验证做: 重启 `dsh web`, 看 boot manifest 与 `/plugins/<package>/client.js`.

desktop 侧没有等价的自动化入口, 至少人工确认: 应用内插件页能看到插件卡片, 装完重启后界面出现插件的落点, 应用日志里没有该插件的加载报错.
