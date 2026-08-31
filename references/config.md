# Config

DSH 插件配置分为 Host 端注册和 Client 端使用两部分. 配置项应使用 `dsh-cmd-send` 采用的 settings namespace 模式, 不要在 Client 中维护独立的全局配置状态.

## 1. 定义共享配置契约

在 `src/shared.ts` 中定义命名空间, 字段名, 默认值和 TypeScript 类型:

```ts
export const SETTINGS_NAMESPACE = 'dsh-example'
export const MESSAGE_FIELD = 'message'
export const DEFAULT_MESSAGE = '默认消息'

export interface ExampleSettings {
  message: string
}
```

Host 和 Client 都从该文件导入配置标识, 避免重复编写字符串.

## 2. Host 端注册 schema

在 Host 入口中使用 `@deepseek-ai/dsh-settings` 和 `@deepseek-ai/schemastery` 注册命名空间. 命名空间是小写字母开头的 kebab-case 字符串, 应与插件名一致, 直接传给 `register`:

```ts
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-settings'

export const ExampleSettingsSchema: z<ExampleSettings> = z.object({
  [MESSAGE_FIELD]: z.string().default(DEFAULT_MESSAGE),
})

export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(SETTINGS_NAMESPACE, ExampleSettingsSchema)
  })
}
```

Host 入口用 `import type {} from '@deepseek-ai/dsh-settings'` 引入 `Context.settings`. Host 端负责配置 schema, 默认值和持久化.

## 3. Client 端绑定 settings scope

Client 入口声明 `settingsScope` 依赖, 并绑定共享命名空间:

```ts
export const inject = ['slots', 'locale', 'settingsScope']

const scope = ctx.settingsScope.bind({
  namespace: SETTINGS_NAMESPACE,
  decode: decodeExampleSettings,
})
```

组件通过 scope 访问配置, 不直接访问 Host settings 服务.

## 4. 解码配置数据

在 Client 端提供解码函数, 将 Host 返回的未知结构转换为类型化配置:

```ts
export function decodeExampleSettings(
  section: unknown,
): ExampleSettings | undefined {
  if (typeof section !== 'object' || section === null) return undefined

  const value = (section as Record<string, unknown>)[MESSAGE_FIELD]
  return typeof value === 'string'
    ? { message: value }
    : { message: DEFAULT_MESSAGE }
}
```

解码函数应检查对象和字段类型, 异常结构应回退到默认值或返回 `undefined`.

## 5. 注册设置项 slot

配置 UI 应注册到通用的 `settings.general.item` slot:

```ts
ctx.slots.inject('settings.general.item', () => ctx.slots.register(
  {
    name: 'settings.general.item',
    id: 'dsh-example',
    order: 100,
    inject: () => ({ scope }),
    locale: NS,
  },
  (props: SettingProps) => createElement(ExampleSetting, props),
))
```

只依赖 `@deepseek-ai/dsh-client-ui-settings` 提供的通用 settings slot. 不额外注入 `@deepseek-ai/dsh-client-ui-settings-general`.

`inject` 只用于把已经绑定的 scope 传给设置组件. 设置组件不应自行创建配置状态.

## 6. 组件读写配置

设置组件应订阅 scope, 让外部配置变化可以触发重新渲染:

```tsx
const value = useSyncExternalStore(
  (onChange) => scope.subscribe(onChange),
  () => scope.getSnapshot().value?.message ?? DEFAULT_MESSAGE,
)
```

用户修改配置时使用 scope 写回 Host:

```tsx
onChange={(event) => {
  void scope.set(MESSAGE_FIELD, event.currentTarget.value)
}}
```

其他业务组件使用同一个 scope 读取最新配置:

```ts
const message = scope.getSnapshot().value?.message ?? DEFAULT_MESSAGE
```

配置数据流如下:

```text
设置组件 -> scope.set -> Host settings -> 持久化
设置组件或业务组件 <- scope.subscribe <- settingsScope
```

## 7. 依赖声明

`package.json` 的 Client bundle 注入列表只保留实际使用的模块, 通常包括 locale, slots 和 settings. 移除不再使用的 settings UI 子模块, 并同步更新 `pnpm-lock.yaml`.

## 8. General 设置项的完整接入

如果用户要求在 `settings > general` 中编辑配置, 仅注册 Host schema 不够. 必须同时完成以下三层:

1. Host 入口注册 namespace schema.
2. Client 入口绑定同一 namespace 的 `settingsScope`.
3. Client 入口通过 `ctx.slots.inject('settings.general.item', ...)` 注册可见设置行.

`settings.general.item` 的 owner props 为空, 不会自动传入 label, value 或 scope. 绑定好的 scope 可以通过闭包传给组件, 组件不要自行创建另一份配置状态.

文本配置项至少应包含:

- 由 `scope.getSnapshot()` 提供的当前值.
- 由 `scope.subscribe()` 驱动的外部变化更新.
- 由 `scope.set(MESSAGE_FIELD, value)` 执行的写回.
- 对未知数据结构的默认值回退.

如果设置项使用 React, Client bundle 应通过 module loader factory 的 `require('react')` 获取 React runtime, 并将 React 声明为 peer dependency. 不要将 React 复制进插件 bundle.
