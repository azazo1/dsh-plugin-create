# Client UI

## 1. General 设置项

单个偏好项应注册到 `settings.general.item`, 不要修改 `ui-settings-general` 插件本身:

```ts
ctx.slots.inject('settings.general.item', () => ctx.slots.register(
  {
    name: 'settings.general.item',
    id: 'dsh-example-message',
    order: 100,
  },
  ExampleSettingRow,
))
```

`settings.general.item` 的 owner 不会自动提供 label, value 或写入逻辑. 配置插件必须自己渲染这些内容并使用已经绑定的 scope.

只注入实际使用的服务, 通常包括:

```ts
inject: ['settingsScope', 'slots']
```

不要额外依赖 `@deepseek-ai/dsh-client-ui-settings-general`. General shell 会提供 slot 的渲染位置.

## 2. 独立配置页

当插件拥有多个相关配置项, 需要独立标题, 描述, 分组或保存操作时, 使用 `settings.section`. 不要把完整页面压缩成 `settings.general.item`, 后者只适合 General 中的一行偏好项.

独立页面注册为 `settings.section` 的 list entry. `id` 必须使用插件自己的唯一值, `order` 控制设置导航位置, `label` 是导航显示文本:

```ts
ctx.slots.inject('settings.section', () => ctx.slots.register(
  {
    name: 'settings.section',
    id: 'dsh-example',
    order: 100,
    label: 'Example Plugin',
  },
  (props) => createElement(ExampleSettingsPage, props),
))
```

页面组件会收到设置 shell 提供的 `close` 回调. 页面只负责自己的内容, 不要替换 `settings` shell, 导航栏或关闭按钮:

```tsx
function ExampleSettingsPage(props: { close: () => void }) {
  return createElement(
    'section',
    { className: styles.section },
    createElement('h2', null, 'Example Plugin'),
    createElement('p', { className: styles.intro }, 'Configure the plugin.'),
    createElement(ExamplePluginCard),
  )
}
```

独立页面的推荐内容结构与 DSH Plugins 设置页保持一致:

- 页面容器使用 `max-width: 760px`, `display: flex`, `flex-direction: column` 和 `gap: 12px`.
- 页面标题使用 `18px`, `font-weight: 600`, 描述使用 `13px` 和 `var(--dsw-alias-label-tertiary)`.
- 多个相关设置放入插件卡片, 卡片使用 `var(--dsw-alias-bg-layer-3)`, `var(--dsw-alias-border-l2)` 和 `border-radius: 12px`.
- 卡片字段使用上下 `12px` 内边距, 字段之间使用顶部 `1px solid var(--dsw-alias-border-l2)` 分隔.
- 文本输入框使用 `height: 34px`, `padding: 0 12px`, `border-radius: 8px`, `background: var(--dsw-alias-bg-layer-3)` 和 `font-size: 13px`.
- 输入框的 `:focus-visible` 使用 `var(--dsw-alias-brand-primary)` 边框, 不使用无主题的固定颜色.
- 保存和重置操作放在卡片底部, 使用 `border-top`, `padding: 12px 0 4px` 和 `gap: 8px`.
- 页面需要兼容窄屏, 操作区允许换行, 状态文本不能挤压按钮.

正式插件的配置页面应绑定 `settingsScope`, 由 Host settings namespace 提供默认值, 读取和持久化. 不要在组件内部创建会绕过 Host 的全局配置状态:

```ts
const scope = ctx.settingsScope.bind({
  namespace: SETTINGS_NAMESPACE,
  decode: decodeExampleSettings,
})
```

## 3. 插件设置卡 (keyed slot)

从 0.1.2-alpha.3 起, web client 的 Settings > Plugins 面板提供 `settings.plugin.item` keyed slot seam, 插件可以在设置面板内渲染页面内设置卡. 键等于插件的 settings namespace:

```ts
ctx.slots.inject(
  `settings.plugin.item[${SETTINGS_NAMESPACE}]`,
  () => ctx.slots.register(
    {
      name: `settings.plugin.item[${SETTINGS_NAMESPACE}]`,
      id: `${SETTINGS_NAMESPACE}-card`,
      order: 100,
      inject: () => ({ scope }),
    },
    (props) => createElement(ExamplePluginCard, props),
  ),
)
```

接入步骤:

- Host 半区通过 `settings` service 注册同名 namespace schema (见 [config.md](config.md) 第 9 节).
- 卡片通过声明的 schema 读取 / 更新, 而不是 ad-hoc 文件; 设置变更实时生效, 无需重启.
- 完整选项列表仍保留在 `settings.yaml` 中供高级旋钮使用, 文档化卡片覆盖的子集.
- 只注册实际需要的服务, 保持 client bundle 轻量.

## 4. React 组件和 scope

设置组件必须订阅 scope, 这样 Host 或其他设置面板写入后输入框仍然会更新:

```ts
const value = React.useSyncExternalStore(
  (onChange) => scope.subscribe(onChange),
  () => scope.getSnapshot().value?.message ?? DEFAULT_MESSAGE,
)
```

输入事件使用 `scope.set` 写回 Host:

```ts
onChange: (event) => {
  void scope.set(MESSAGE_FIELD, event.currentTarget.value)
}
```

Client factory 需要从 module loader 的 `require` 获取 React. React 应作为 peer dependency, 不要复制或打包一份新的 React runtime:

```ts
factory: (require) => {
  const React = require('react')
  // createElement and useSyncExternalStore are used by the row.
}
```

## 5. 样式

General 设置行默认必须使用 DSH 原生配置样式, 不得使用无主题 token 的最简 inline 布局代替. 即使设置项只有一个字段, 也必须提供与 General Settings 一致的分隔, 标签, 输入, hover, focus 和窄屏状态.

- 使用 `display: flex`, `gap: 8px` 和 `padding: 16px 0`.
- 使用 `var(--dsw-alias-label-primary)`, `var(--dsw-alias-label-tertiary)` 和现有 border token.
- 输入框可以使用 `var(--dsw-alias-bg-module-platform)`, 圆角 `18px`, 高度 `36px`.
- 使用 `:hover` 和 `:focus` 状态, focus 边框应使用业务主色 token.
- 自定义设置行的分割线放在行底部. 对位于现有项目之后的自定义行, 使用 `border-bottom: 1px solid var(--dsw-alias-border-l2)`. 不要改为顶部分割线.
- 不要使用随意的纯色, 大块卡片或与 DSH 主题无关的视觉样式.
- 窄屏时应切换为上下布局, 输入框宽度使用 `100%`.

CSS 可以在 Client bundle 初始化时注入一次, 并通过 `data-plugin-css` 标记避免重复插入:

```ts
const styleId = 'dsh-example-settings-row'
if (typeof document !== 'undefined' && !document.querySelector(`style[data-plugin-css="${styleId}"]`)) {
  const style = document.createElement('style')
  style.dataset.pluginCss = styleId
  style.textContent = CSS_TEXT
  document.head.appendChild(style)
}
```

## 6. Client module loader

DSH Web Client 不加载普通 ESM 作为插件 Client entry. Client bundle 必须在顶层注册插件 ID:

```ts
window.__ModuleLoader__.load({
  id: 'dsh-example',
  factory: (require) => ({
    inject: ['settingsScope', 'slots'],
    apply(ctx) {
      // bind scope, log or register slots
    },
  }),
})
```

`id` 必须和 `package.json` 的插件名完全一致. 否则会出现类似下面的错误:

```text
bundle loaded without registering "dsh-example" via __ModuleLoader__.load
```

三个标识必须一致, 以 `package.json` 的 `name` 为基准:

1. Client bundle 的 registration id (`__ModuleLoader__.load` 的 id, 通常由 tsdown banner `PLUGIN_ID` 注入) == `package.json` 的 `name`.
2. assembly row (插件自己的 `cordis.patch.yml` 或 home patch 里的 insert row) 的 `name` 使用裸包名 (带 scope, 例如 `'@dsh-external/dsh-input-history'`).
3. `dsh --profile <name> --dump-config` 检查 row 名且无 pending.

任何一处不一致都会导致 client 半区静默缺席 boot graph: 要么启动断言报 `loaded without registering`, 要么面板静默消失而日志无插件相关错误. 安装后验证 profile 的 `dsh.profile.bundles` 包含插件名.

Client entry 还必须是浏览器脚本, 不能保留顶层 ESM `import` 或 `export`. 最简单的构建方式是将 Client 单独输出为 IIFE, Host 入口单独输出为 ESM:

```ts
// tsdown.host.config.ts
export default defineConfig({
  entry: 'src/index.ts',
  format: ['esm'],
  outDir: 'lib',
  dts: true,
  clean: true,
})

// tsdown.client.config.ts
export default defineConfig({
  entry: 'src/client/index.ts',
  format: ['iife'],
  outDir: 'lib',
  clean: false,
})
```

对应的 `package.json` Client export 应指向 IIFE 文件:

```json
{
  "exports": {
    "./client": {
      "types": "./lib/index.d.ts",
      "default": "./lib/index.iife.js"
    }
  }
}
```

构建后应检查 Client 文件开头没有 `import`, 末尾没有 ESM `export`, 并且包含正确的 `__ModuleLoader__.load({ id: ... })` 注册.

## 7. 验证

- 索引页 HTML 的 `window.__DSH_BOOT__.entries` 包含 `"id":"<package name>"`.
- 从组合路由 `/plugins/??<package name>/client.js&rev=...` 拉取的脚本 (URL 含 `??`; curl 需加 `-g`) 包含 `__ModuleLoader__.load({ id: "<package name>"`.
- 启动日志没有 `loaded without registering` / `entries did not activate`.
- `/plugins/<package>/client.js` 返回 Client bundle; 404 表示 Host entry 未激活, package 未在 profile bundles 中, 或 Client metadata 未被扫描.

修改 bundle metadata, Client export 或 Client bundle 后, 重启 `dsh web`, 因为 Client metadata 的扫描结果会在进程内缓存.