# Naming

外部插件的公开标识符 (包名, 插件模块名, service, tool, command, skill, settings namespace, 事件, 路由) 是社区兼容性面. 本参考是社区兼容性 profile, 不是官方标准; 选择公开标识符前先读本文, 为每个新的外部插件创建 `dsh-plugin.naming.json` 并运行离线校验.

不要仅仅为了通过推荐项就重命名已发布的公开名称. 工具, 命令, service, skill, settings namespace, 事件或路由的重命名都是兼容性变更.

## 1. 官方基线与社区建议

DSH 使用多个相互独立的身份, 而不是一个通用插件 ID:

| 表面 | 官方行为 | 社区 profile 建议 |
|---|---|---|
| Package | bundle 由 `package.json#dsh.bundle` 声明, 官方教程使用 `dsh-hello-plugin` | 接受无 scope 的 `dsh-*` 和带 scope 的 `@scope/dsh-*` 包 |
| Plugin module name | 插件导出 `name`, 例如 `hello-plugin` | 在 `pluginNames` 中声明每个导出的插件名 |
| Loader row ID | row `id` 是稳定的组合键, 后续 patch 层可以有意覆盖它 | 声明 ID, 但不要把每个重复都当作全局冲突 |
| Service key | service 是 `ctx` key; Cordis 隔离可以在独立 realm 中承载多个实例 | 建议带发布者的 lower-camel 前缀 |
| Tool name | 同 scope 内重复会失败; Agent scope 可以提供更近的定义 | 建议带发布者的 snake-case 前缀 |
| Command name | 官方语法是 `^[a-z][a-z0-9_-]*$`; 同 scope 内重复会失败, Agent scope 可以遮蔽全局 | 建议带发布者的小写前缀 |
| Skill name | 官方语法是 kebab-case; scope, rank, provider 顺序和本地顺序决定胜者 | 建议带发布者的 kebab 前缀 |
| Skill provider | 同 scope 的 provider 名必须唯一; `runtime` 是官方保留名 | 单独声明 provider, 不要与 Skill 名混在一起 |
| Event | 官方自定义事件遵循 `namespace/action`; 事件是共享通道, 不是独占注册 | 建议带发布者的 namespace, 不声称拥有该通道 |
| Settings namespace | 官方语法是 `^[a-z][a-z0-9-]*$`; 重复注册失败 | 建议带发布者的 kebab 前缀 |
| Web route | HTTP 路由只对相同 `kind` 和 `path` 冲突; exact, prefix 和 upgrade 注册各不相同 | 记录 `{ kind, path }`, 不要丢失路由 kind |

社区坐标是 `<namespace>/<plugin>`, 例如 `alice/web-search`. 它是可选社区注册表的查找键, 不替代任何官方 DSH 字段.

## 2. 本地声明

在外部插件仓库根目录创建 `dsh-plugin.naming.json`:

```json
{
  "schemaVersion": 1,
  "policy": "dsh-plugin-naming/v1",
  "plugin": {
    "namespace": "alice",
    "name": "web-search",
    "coordinate": "alice/web-search",
    "packageName": "@alice/dsh-web-search"
  },
  "names": {
    "pluginNames": ["web-search"],
    "loaderIds": ["alice-web-search"],
    "services": ["aliceWebSearchIndex"],
    "tools": ["alice_web_search_query"],
    "commands": ["alice-web-search-refresh"],
    "skills": ["alice-web-search"],
    "skillProviders": ["alice-web-search-filesystem"],
    "events": ["alice-web-search/ready"],
    "settingsNamespaces": ["alice-web-search"],
    "routes": [
      { "kind": "exact", "path": "/api/plugins/alice-web-search/query" }
    ]
  }
}
```

保留每个数组, 包括空数组, 并至少声明一个插件模块名和一个 Loader row ID. 可选的 `$schema` 字段可以指向 `plugin-naming.schema.json` 的可解析本地副本. 该声明补充 `package.json`, bundle patch 和 Profile composition; 它既不证明源码使用, 也不保留名称.

## 3. 离线校验

用 Node 20 或更新版本运行只读校验器:

```sh
node <plugin-write-skill>/scripts/validate-names.mjs \
  --manifest ./dsh-plugin.naming.json
```

对新插件如果采纳所有社区建议, 加 `--strict`. CI 中使用 `--format json`. 退出码 `0` 表示兼容, `1` 表示错误或 strict 模式警告, `2` 表示无效参数, 不可读输入或损坏的 JSON. 校验器不发起网络请求, 不写文件.

校验通过后, 如果公共网络可用, 可再查询中心注册表 (可选, 只读):

```sh
node <plugin-write-skill>/scripts/query-registry.mjs \
  --manifest ./dsh-plugin.naming.json \
  --harness-version 0.1.2-rc.1
```

默认索引是 `https://raw.githubusercontent.com/oh-my-dsh/dsh-plugin-registry/main/registry/index.json`. 把无匹配结果只当作 "没有已审阅的匹配", 把超时, 数据损坏或网络失败当作 "未知/未检查". 在线查询永不修改本地清单, 不自动重命名已发布表面, 也不把自动发现的候选变成保留. 正式保留只存在于来源支撑的条目被审阅并合并进中心注册表之后.

## 4. 边界

- 命名 profile 不是官方 Harness 清单, 也不是全局保留.
- 对已存在的外部插件报告命名偏差, 但保留已发布名称, 除非用户明确授权兼容性破坏的重命名.
- 事件保持共享通道; 检查不兼容的发布者 schema, 而不是仅因同名拒绝.
- 端口是部署配置, 需要组合时检查而不是命名保留.