---
name: dsh-plugin-create
description: 创建和维护 DeepSeek Harness 插件, 覆盖插件 Config 与 volatile 配置字段, General 设置项, 独立配置页, 插件配置面, Client module loader 和构建验证.
---

# DSH Plugin Create

本技能内容以 dsh 0.1.7-rc.2 为基准编写.

## 章节索引

- [Plugin Forms](references/plugin-forms.md): 五种插件形式, 扩展点选择和编写规则.
- [Naming](references/naming.md): 外部插件命名规约, `dsh-plugin.naming.json` 清单与离线校验.
- [Config](references/config.md): 插件 Config schema, volatile 字段, profile 条目表单与读写.
- [Plugin Structure](references/plugin-structure.md): 插件目录, package manifest, bundle patch, 引擎版本线兼容性 preflight 和安装来源.
- [Dual Host](references/dual-host.md): web 与 desktop 两个宿主的关系, 安装路径差异和双宿主插件的写法.
- [Client UI](references/client-ui.md): 设置界面落点, `ctx.configForms` 数据面, 原生风格控件和 Client module loader.
- [Build And Test](references/build-and-test.md): TypeScript 构建, Host/Client 双入口, loader registration 和真实组合验证.
- [Release](references/release.md): 参考 `create-github-release-flow` 完成发布.
