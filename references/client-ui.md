# Client UI

Client 半区负责展示与编辑 Host 的配置. 值来自 profile 条目表单, 界面用共享控件拼装, 与原生设置页保持一致.

## 1. 数据面: `ctx.configForms`

声明 `configForms` 依赖, 用条目 id 拿共享表单:

```ts
export const inject = ['slots', 'locale', 'configForms']

const form = ctx.configForms.get<ExampleSettings>(ENTRY_ID)
```

`ConfigForm<T>` 的契约:

- `getSnapshot()` 返回 `{ status, value, base, user, revision, writable, mode }`. `status` 在首个可接受 section 到达前是 `loading`; `base` 是清除某字段后回落到组合层; `user` 里字段的**存在性**(不是值相等)才表示被覆盖; `writable` 决定是否可写.
- `set(field, value)` / `unset(field)` 排队单字段写入, `mutate(ops, expectedRevision?)` 一次原子写入多个路径操作; 带修订号可以拒绝并发覆盖, 被 Host 拒绝时会回读最新值.
- 同一浏览器里同一条目 id 只有一份表单实例, 多个页面共享它.

页面只在 Host 真的组合了该条目时才出现, 用 `whileServed` 包注册:

```ts
ctx.effect(() => ctx.configForms.whileServed([ENTRY_ID], () => ctx.slots.inject(/* ... */)))
```

其他跨命名空间面: `ctx.configForms.describe()` 读共享镜像(被服务的命名空间目录), `ctx.settingsSchema` 重建 schema 用于校验草稿.

组件永远不自己订阅外部数据, 也不自己管配置状态: 数据通过 slot 注册的 store 或 inject 的 `hooks` 隔间到达组件, 写操作通过注入的 actions 调用. 详见第 3 节.

## 2. 注册位置

| slot | 用途 | 备注 |
|---|---|---|
| `settings.general.item` | General 里的一行 | owner props 为空, 行自己画标题, 描述与控件 |
| `settings.section` | 设置面板里的独立页 | 注册选项带 `id`, `order`, `label`; 页面收到 `close` |
| `settings.plugins.tab` | 内置插件分区里的一个 tab | 只在需要 tab 入口时使用 |
| `plugins.item` | 官方插件列表里的卡片与其配置页 | 由官方配置页占用, 外部插件不要注册 |
| `plugins.bundle.config` | 某个 bundle 自己的配置页 | keyed slot, 键等于包名 |
| `plugins.row.config` | 某个 row 的配置页 | keyed slot, 键为 `<包名>#<row id>` |

Plugins 页面的配置 entry 会收到 `view` owner prop: `summary` 渲染一行简介, `page` 渲染完整表单; 离开页面会丢弃未保存的编辑, 只有保存才写入.

外部插件自己的配置只放 `plugins.bundle.config` 或 `plugins.row.config`: 前者渲染在插件卡片页上 (描述与"包含的组件"之间), 后者渲染在该行详情页 (卡片页上多一个配置入口, 多一层点击). 一个包只有一份配置时用前者; 只有当这个包声明了多行, 且各行需要各自一份配置时才用后者. 注意 keyed slot 的键是**包名**(或 `<包名>#<行 id>`), 而表单寻址用的条目 id 可能不同, 见 [config.md](config.md).

注册进 list 槽时 `id` 在同一个槽里必须唯一: 与官方已占用的 id 撞名会直接抛错, 整个 client bundle 加载失败 (不是只有那一行不显示). 0.1.7-rc.2 起官方占用的新增 id 有 `chat.quota-notice`, `schedule.delete-toast`, `account.platform-page`, `desktop-onboarding`, 以及同时占用 `settings.general.item` 与 `shell.overlay` 的 `shortcuts`; 自己的行 id 带插件前缀最省事.

同期新增的插槽有三个: `shell.quota-notice`, `sidebar.session.row.leading`, `sidebar.session.row.hover`, 都是追加注册, 不替换既有落点.

## 3. 与原生风格一致

先查 ui-primitives 的组件目录(`packages/client/ui-primitives/README.zh.md`): 它是跨包复用控件的唯一通道, 合适的控件直接复用, 有意的视觉差异提升成 prop, 不要另写一份. 设置表单专用的组件:

- `SettingsForm`: 整页表单框架, 接收 `labels`, `state`, `onSave`, `onDiscard` 与控件子节点; 不可写时显示只读提示, 卸载即丢弃草稿.
- `SettingsValueField` / `SettingsSecretField`: 单字段控件, 显示暂存文本, 已覆盖标记与重置; 密文字段每次为空, 只报告是否已配置.
- `SettingsFormModel` + `settingsTextField` / `settingsNumberField`: 暂存编辑模型, 保存时才把草稿写成一个带修订号的写入.

一个最小整页实现见官方 shell 配置页 `packages/client/ui-settings-shell/`(整个包只有三个文件):

```ts
export const inject = ['slots', 'locale', 'configForms']

export function apply(ctx: Context): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'example: dictionaries')
  const form = new SettingsFormModel(ctx.configForms.get<ExampleSettings>(ENTRY_ID), [settingsTextField('message')])
  const store = form.bind(() => ({ ...form.shell(), message: form.field('message') }))
  ctx.effect(() => () => { form.dispose() }, 'example: form subscription')
  ctx.effect(() => ctx.configForms.whileServed([ENTRY_ID], () => ctx.slots.inject('plugins.item', () => ctx.slots.register({
    name: 'plugins.item',
    id: 'example',
    order: 100,
    label: () => t('title'),
    locale: NS,
    inject: () => ({ hooks: { exampleCard: store }, ...form.actions() }),
  }, ExampleCard))), 'example: settings page')
}
```

组件从 props 读取:

```tsx
export function ExampleCard(props: ExampleCardProps) {
  const state = props.useExampleCard(snapshot => snapshot)
  if (props.view === 'summary') return props.t('description')
  return (
    <SettingsForm labels={formLabels(props.t)} state={state} onSave={props.save} onDiscard={props.discard}>
      <SettingsValueField
        id="plugin-config-example-message"
        label={props.t('message')}
        hint={props.t('messageHint')}
        overriddenLabel={props.t('overridden')}
        resetLabel={props.t('reset')}
        invalidLabel={props.t('invalid')}
        disabled={!state.writable}
        {...state.message}
        onEdit={text => { props.edit('message', text) }}
        onReset={() => { props.resetField('message') }}
      />
    </SettingsForm>
  )
}
```

只注册一行偏好时用 `settings.general.item`, 注册选项用 `{ name, id, order, store, locale, inject }`, 行自己画标题与控件. 现成样例: `packages/client/ui-theme/src/client/FontSizeRow.tsx`(store 形式)与 `packages/client/locale/src/client/LanguageRow.tsx`.

硬性约束:

- 数据通道只有三种: 父级在 renderSlot 处传的 owner props, 组件本地状态, 以及注册时声明的 store / inject `hooks`. 组件里不写 `useSyncExternalStore`, 不手动订阅, 不把外部快照镜像进本地状态.
- store 用导出的 `createXXXStore()` 工厂创建, 组件读 `props.useStore`, 写 `props.actions.*`; 模块级句柄是隐式单例, 禁止.
- 所有用户可见字符串走 typed locale 字典: `ctx.locale.register(NS, { zh, en })`, 注册时带 `locale: NS`, 组件用 `t` seat. 不要把文案硬编码在组件里.
- 样式用 CSS Modules 与 `--dsw-alias-*` 语义 token(`ui-theme` 拥有 token 与全局样式表): 不写字面颜色, 不引入组件库或 Tailwind, 不覆盖主题选择器. 中性分隔线用 0.5px hairline, 行内节奏通常是 `padding: 16px 0`, `gap: 8px`, 行底部 `0.5px solid var(--dsw-alias-border-l2)`(General 分区会去掉最后一条).
- 设置面板的宽度与内边距由 shell 拥有(当前 800px), 页面不要自己设 `max-width`.
- `.module.css` 与 `.css` 的注入由 Client 构建预设完成(`data-plugin-css` 标记), 不要手写 `<style>` 注入.
- 官方字段控件只覆盖单行文本, 数字与密文三类. 布尔, 选择, 多行文本, 颜色这类字段需要自绘控件, 但仍然放进 `SettingsForm` 里, 并复刻官方字段行的节奏: 标签 13px/500, 说明 12px tertiary, `已覆盖` 标记与 `恢复默认` 靠右, 每行 `padding: 12px 0`, 行间 `0.5px solid var(--dsw-alias-border-l2)`. 官方 primitives 里可直接复用的控件有 `Switch`, `Menu`, `Tag`, `Button`, `Input`, `SegmentedControl`.
- 自绘控件的样式作用域要跟着落点走. 从旧设置页搬过来的 CSS 常带 `[data-my-plugin]` 一类的作用域选择器, 落点换成插件卡片后那个根元素并不存在, 规则会全部失配: 界面看起来是裸文本 (标签没有字号, 输入框是浏览器默认样式), 而不是 "样式有点不同". 搬迁时要么去掉作用域, 要么把根元素一起搬.
- `SettingsFormModel` 的字段名只映射到顶层一段路径, 嵌套对象 (`colors.<类别>`) 与字典 (`toolColors.<工具名>`) 用它寻址不到. 这类配置要么把 schema 拍平成顶层字段, 要么自写暂存层, 保存时用 `mutate([{ op: 'set', path: ['colors', 'search'], value }])` 按路径批量写 (Host 侧 `isVolatilePath` 允许 volatile 子树下的任意路径).

0.1.7-rc.2 起有几处控件契约变了, 复用时按新行为写:

- `Menu` 与 `TabMenu` 的 DOM 变成两层 (外层 `data-menu-material`, 内层 material 节点), macOS 上还会往 `document.body` 追加门户节点. 选择器用 `[role=menuitem]`, 不要假设菜单的第一个子节点是条目.
- `Modal` 的 Escape 与焦点管理改由 `useModalLayer` 栈式管理 (关闭时归还焦点), 新增 `backdropBlur` 与 `shortcutModal` 两个 prop. 仍靠 React `autoFocus` 的模态关闭后回不到触发控件, 初始焦点要标在 `data-modal-autofocus` 上.
- `Tooltip` 新增 `shortcutKeys`, 传入后文案包进内层 `span`, 依赖 `:first-child` 的样式会失配.
- `Button` 变成 `forwardRef`, `typeof Button` 现在是 `ForwardRefExoticComponent`.
- `ui-primitives` 不再导出 `OnboardingSurface`; 需要引导浮层时自己组 `Modal`, 或照包里的实现自写一份.
- 主题 token: 菜单材质填充改用 `--dsw-menu-surface-fill` (只覆盖 `--dsw-specific-menu` 这类别名层会留下半透明底); `--dsw-mask-blur` 现在是 `none`; 焦点环基准由 `--dsw-alias-brand-primary` 迁到 `--dsw-alias-state-business-primary`; `--dsw-alias-bg-document-preview` 与 `--dsw-alias-label-document-preview` 的浅色取值语义互换.

## 4. Client module loader

DSH Web Client 不加载普通 ESM 作为插件 Client entry. Client bundle 必须在顶层注册插件 ID:

```ts
window.__ModuleLoader__.load({
  id: 'dsh-example',
  factory: (require) => ({
    inject: ['slots', 'locale', 'configForms'],
    apply(ctx) {
      // 绑定表单, 注册 slot
    },
  }),
})
```

`id` 必须和 `package.json` 的插件名完全一致, 否则加载会报错:

```text
client-modules: bundle <url> loaded without registering "<id>" via __ModuleLoader__.load
```

三个标识必须一致, 以 `package.json` 的 `name` 为基准:

1. Client bundle 顶层注册的 id(通常由构建 banner 注入) == `package.json` 的 `name`.
2. assembly row 的 `name` 使用包名(带 scope, 例如 `'@alice/dsh-example'`).
3. `dsh --profile <name> --dump-config` 检查 row 名且无 pending.

任何一处不一致都会让 client 半区静默缺席 boot graph. 浏览器半区的注册失败会进入 load report, 在 Settings -> Plugins 的插件列表里可以看到, 也可以用 `cordis_inspect_list` / `cordis_inspect_query`(需要 provider 与 method)诊断.

Client entry 必须是浏览器脚本, 不能保留顶层 ESM `import` 或 `export`. 官方形态是把 Client 输出成 `lib/client.js`: CJS 包装加 banner/footer 注入 `__ModuleLoader__.load({ id, factory })`, 并由 `dsh.client` 声明送出; 自建构建时用 IIFE 达到同样效果也可以, 只要顶层完成注册. 构建配置见 [build-and-test.md](build-and-test.md).

## 5. 验证

- 索引页的 `window.__DSH_BOOT__.entries` 包含 `"id":"<package name>"`.
- `/plugins/<package>/client.js` 返回 Client bundle, 且内容含 `__ModuleLoader__.load({ id: "<package name>"`; 404 表示 Host entry 未激活, package 未在 profile bundles 中, 或 Client metadata 未被扫描.
- 启动日志没有 `loaded without registering` 或 boot activation audit 报错.
- 改过 bundle metadata, Client export 或 Client bundle 后重启 `dsh web`, 因为 Client metadata 的扫描结果会在进程内缓存.
