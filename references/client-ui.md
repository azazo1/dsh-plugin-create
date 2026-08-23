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

## 2. React 组件和 scope

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

## 3. 样式

General 设置行应保持和现有设置项一致的布局:

- 使用 `display: flex`, `gap: 8px` 和 `padding: 16px 0`.
- 使用 `var(--dsw-alias-label-primary)`, `var(--dsw-alias-label-tertiary)` 和现有 border token.
- 输入框可以使用 `var(--dsw-alias-bg-module-platform)`, 圆角 `18px`, 高度 `36px`.
- 使用 `:hover` 和 `:focus` 状态, focus 边框应使用业务主色 token.
- 自定义设置行的分割线放在行顶部. 对位于现有项目之后的自定义行, 使用 `margin-top: 16px` 和 `border-top: 1px solid var(--dsw-alias-border-l2)`. 不要改为底部分割线.
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

## 4. Client module loader

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

`id` 必须和 `package.json` 的插件名一致. 否则会出现类似下面的错误:

```text
bundle loaded without registering "dsh-example" via __ModuleLoader__.load
```

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

构建后应检查 Client 文件开头没有 `import`, 末尾没有 ESM `export`, 并且包含 `__ModuleLoader__.load({ id: ... })`.
