---
name: dsh-plugin-create
description: 创建和维护 DeepSeek Harness 插件, 覆盖 settings 配置, General 设置项, 独立配置页, Client module loader 和构建验证.
---

# DSH Plugin Create

> 如果你要创建或者维护插件, 并且你处于 dsh 当中, 并且不是在创造模式下开始执行任务, 请先使用 ask 类工具告知用户当前不属于创造模式, 询问用户是否继续, 因为非创造模式可能对插件开发有不便, 无法立刻看到结果.
> 创造模式是指: 即有 `cordis_*` 相关的工具可以使用, 而不是用户是否要求你创建插件.
> 不要在可能为创造模式的情况下进行提问.

本技能内容以 dsh 0.1.2-rc.1 为基准编写.

## 章节索引

- [Plugin Forms](references/plugin-forms.md): 五种插件形式, 扩展点选择和编写规则.
- [Naming](references/naming.md): 外部插件命名规约, `dsh-plugin.naming.json` 清单与离线校验.
- [Config](references/config.md): settings 配置项设计, Host 端注册和 Client 端接入.
- [Plugin Structure](references/plugin-structure.md): 插件目录, package manifest, bundle patch 和安装来源.
- [Client UI](references/client-ui.md): General 设置项, 独立配置页, 插件设置卡, scope 订阅, DSH theme styles 和 Client module loader.
- [Build And Test](references/build-and-test.md): TypeScript 构建, Host/Client 双入口, loader registration 和真实组合验证.
- [Release](references/release.md): 参考 `create-github-release-flow` 完成发布.