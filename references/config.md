# Config

自 dsh 0.1.7 起, 插件配置就是插件自己的 Cordis Config: 没有独立的 settings namespace 注册, 也没有第二份存储. Settings 服务只把活动 profile 条目里标记为 volatile 的字段投影成表单, 部署方与用户在 profile 的 patch 层里覆盖值.

## 1. 定义 Config schema

导出 `Config` 接口与同名 Schemastery Schema, Host 与 Client 都从这一份声明出发:

```ts
import type { Context, Volatile } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  message: Volatile<string>
  apiKey: Volatile<string | undefined>
}

export const Config: Schema<Config> = Schema.object({
  message: Schema.string().default('hello').volatile(),
  apiKey: Schema.string().role('secret').volatile(),
})

export function apply(ctx: Context, config: Config) {
  // 每次操作读取最新值; 引用对象本身稳定, 不需要重新挂载.
  const read = () => config.message.get()
  ctx.on('loader/volatile-update', () => { /* 需要时通知自己的消费者 */ })
}
```

Service 插件把 Schema 放在类上, 构造器接收解析后的配置:

```ts
import { Service, type Context, type Volatile } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

interface Config {
  sampleRate: Volatile<number>
}

export default class MetricsService extends Service {
  static Config: Schema<Config> = Schema.object({ sampleRate: Schema.number().default(1).volatile() })

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'metrics')
  }
}
```

字段规则:

- `.volatile()` 表示该字段变化时不重挂载插件. 运行时它是稳定引用, 用 `.get()` 读; 变化以 `loader/volatile-update` 事件到达所属实例, 参数是变化的键路径. 只有普通字段(非 volatile)变化才走卸载重挂的更新流程.
- volatile 只能声明在固定对象路径上, 或把整个对象, 数组标为 volatile. 数组元素, 字典, union 或 intersect 分支, lazy, transform 或另一个 volatile 值内部的独立引用会被拒绝.
- `.role('secret')` 让字段值不进入 describe 响应, 表单只显示是否已配置; 引用外部凭据用 `.role('credential-ref')`, 按操作通过 `ctx.credentials` 解析.
- 字段的默认值与约束写在 Schema 上, 不要在代码里维护另一份默认值.
- 配置不合法必须在加载时以可操作的错误失败, 不要静默回退.

字段放置与更新语义的完整说明见 `docs/cordis-tutorial/05-config.zh.md#volatile-fields`.

## 2. 表单命名空间是 profile 条目 id

Settings 表单按 **profile 条目 id** 定位一个插件的配置, 也就是该插件在组合里那行的 `id`(插件内可读作 `ctx.fiber.entry?.options.id`). 插件不再自己声明 namespace, 字符串也不再需要与包名一致.

组合里的那行由 bundle patch 声明, 用户和部署方在更靠后的 patch 层覆盖它:

```yaml
- insert:
    - id: example-plugin
      name: '@alice/dsh-example'

# 另一层按 id 覆盖整个 config:
- id: example-plugin
  config:
    message: 来自 profile 的值
```

层级顺序是 bundle 自带 patch, profile 的 `cordis.patch.yml`, home 级 `cordis.patch.yml`, 最后是 `--patch` overlay; 一条 patch 按 id 替换该条目的整个 config.

## 3. 读写自己的配置

业务代码读自己的 config 引用, 不要向 settings 服务要值:

```ts
const message = config.message.get()          // 每次操作读最新值
const entryId = ctx.fiber.entry?.options.id   // settings 表单寻址用的条目 id
```

需要程序化写回时(例如某个命令改变了选择), 用 Host 的 settings 服务:

```ts
async configure(patch: { message?: string }): Promise<void> {
  const settings = this.ctx.get('settings')
  const entryId = this.ctx.fiber.entry?.options.id
  if (settings === undefined || entryId === undefined) throw new Error('needs the settings service and a profile entry')
  await settings.update(entryId, patch)
}
```

`settings` 服务对外只有描述与写入: `describe()`, `update(entryId, patch, expectedRevision?)`, `replace(...)`, `mutate(entryId, ops, expectedRevision?)`, `configure({ auto }, fiber)`. 写入会先按完整 Config 校验, 并拒绝过期修订号.

## 4. 已废弃的 surface

- `settings.yaml` 不再被当作配置来源读取. 启动后 Settings 会在 Loader 稳定时把它一次性导入当前 profile(每个 section 当作条目 id), 并在第一次写入前改名为 `settings.yaml.imported`; 被当前组合拒绝的 section 只记日志并留在改名后的文件里.
- Host 侧的 `settings.register` / `installSection` / `get` 与 Client 侧的 `settingsScope` 都不存在了. 构建产物 `lib/types/*.d.ts` 里若还能看到它们, 那是被 gitignore 的陈旧声明, 不是当前 API.
- 设置表单不再维护自己的配置存储, 值只落在 profile 的 patch 层.

## 5. Client 侧接入

Client 用 `ctx.configForms` 读写同一份 profile 条目表单, 界面落点与样式规范见 [client-ui.md](client-ui.md).

## 6. 依赖声明

- Client bundle 的 `dsh.client.inject` 只列实际使用的包, 它记录包名边, 不是 Cordis 服务注入.
- 显式使用的服务要在插件 `inject` 里声明; 可选依赖放调用处用 `ctx.get('name')` 查询并守卫缺失结果.
