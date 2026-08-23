---
name: dsh-plugin-create
description: 创建和维护 DeepSeek Harness 插件, 覆盖 settings 配置, General 设置项, Client module loader 和构建验证.
---

# DSH Plugin Create

> 如果 agent 处于 dsh 当中, 并且不是在创造模式下开始执行任务, 请先使用 ask 类工具询问用户是否继续, 因为非创造模式可能对插件开发有不便, 无法立刻看到结果.
> 创造模式是指: 能够在当前 DSH 进程中临时创建和运行 Cordis 动态插件, 用来扩展 Host 能力或当前浏览器页面的交互界面. 而不是仅仅根据模式名字匹配.

## 章节索引

- [Config](references/config.md): 配置项的设计, Host 注册和 Client 接入.
- [Plugin Structure](references/plugin-structure.md): 插件目录, 轻量化原则, 仓库元信息和安装来源.
- [Client UI](references/client-ui.md): General settings slot, scope 订阅, DSH theme styles 和 Client module loader.
- [Build And Test](references/build-and-test.md): TypeScript 构建, Host/Client 双入口, loader registration 和最小验证.
- [Release](references/release.md): 参考 `create-github-release-flow` 完成发布.
