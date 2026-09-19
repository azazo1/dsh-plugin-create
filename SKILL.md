---
name: dsh-plugin-create
description: 创建和维护 DeepSeek Harness 插件, 覆盖 settings 配置, General 设置项, 独立配置页, 插件配置面, Client module loader 和构建验证.
---

# DSH Plugin Create

本技能内容以 dsh 0.1.6-alpha.2 为基准编写.

## 章节索引

- [Plugin Forms](references/plugin-forms.md): 五种插件形式, 扩展点选择和编写规则.
- [Naming](references/naming.md): 外部插件命名规约, `dsh-plugin.naming.json` 清单与离线校验.
- [Config](references/config.md): settings 配置项设计, Host 端注册和 Client 端接入.
- [Plugin Structure](references/plugin-structure.md): 插件目录, package manifest, bundle patch 和安装来源.
- [Client UI](references/client-ui.md): General 设置项, 独立配置页, 插件配置面, 插件设置 tab, scope 订阅, DSH theme styles 和 Client module loader.
- [Build And Test](references/build-and-test.md): TypeScript 构建, Host/Client 双入口, loader registration 和真实组合验证.
- [Release](references/release.md): 参考 `create-github-release-flow` 完成发布.
