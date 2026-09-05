# Plugin Forms

DSH 插件是注册到 Cordis Context 上的能力包. 创建插件前先确定插件形式, 再按对应规范编写. 一个插件可以自由组合多种形式, 例如一个可配置的 tool 插件, 或者一个同时注册 tools 的 service 插件; 每种包含的形式都要满足它自己的契约.

本参考以 dsh 0.1.2-rc.1 为准. 如果某个需求不属于下面五种形式, 把它映射到现有的扩展点并编写注册在那里的插件, 不要修改 Agent 循环本身.

## 1. 插件形式

| 需要的能力 | 形式 | 特征 |
|---|---|---|
| 模型可调用的工具 (读写文件, 运行命令, 搜索网络等) | Tool plugin | 注册到 `ctx.tools` |
| 新的模型提供商 | LLM adapter plugin | 注册到 `ctx.llm` |
| 请求, 工具或 turn 拦截 (权限, 策略, 指标, 遥测) | Hook plugin | 监听 `tools/*` 或 `agent/*` 事件 |
| 其他插件通过 `ctx` 消费的能力 | Service plugin | 继承 `Service` 类注册服务 |
| 通过 `cordis.yml` 提供的用户可配置行为 | Config plugin | 导出 `Config` 类型和同名 Schema |

## 2. 目标与机制

| 目标 | 机制 |
|---|---|
| 添加模型可调用能力 | 在 `ctx.tools` 注册 |
| 添加模型提供商 | 在 `ctx.llm` 注册 adapter |
| 为单个会话提供不同的能力集 | 在 Agent preset 中组装 |
| 添加 Shell 执行 | 实现并注册 `ctx.bash` backend |
| 添加持久化终端执行 | 注册 `ctx.pty` backend 并加载 `dsh-tool-pty` |
| 添加人工命令 | 注册到 `ctx.commands` |
| 添加后台任务 | 注册到 `ctx.tasks` |
| 添加文件系统访问或策略 | 实现 `ctx.fs` provider 或监听 `fs/*` 策略事件 |
| 约束启动的进程 | 使用 `ctx.sandbox` backend |
| 拦截请求, 工具或 turn | 使用 `agent/*` 或 `tools/*` 事件; turn 结束事件是 `agent/turn-stopping` |
| 添加模型可见上下文 | 调用 `agent.inject()` |
| 添加 UI 或编辑器集成 | 驱动 `ctx.agents` 并从 `session/event` 渲染 |
| 添加 Web 客户端对话节点 | 注册 `ConversationNodeDefinition` 和 keyed renderers |
| 添加持久化会话状态 | 扩展 `SessionEventMap`, 然后从日志渲染和回放 |
| Fork 一个活动会话 | 调用 `ctx.sessions.fork(source, boundary?, childSessionId?)` |
| 将注册限定到单个 Agent | 使用该 Agent 的 `agent.ctx` |

## 3. Tool Plugin

工具是注册在 `ctx.tools` 上的模型可调用能力. 使用 `defineTool` 类型化助手:

```ts
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'my-tool'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'read_file',
    description: 'Read a file from disk.',
    parameters: {
      path: { type: 'string', required: true, description: 'Absolute path' },
      limit: { type: 'number' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      return readFile(args.path, { encoding: 'utf8', signal: exec.signal })
    },
  }))
}
```

`execute()` 契约:

- 参数在 `execute` 运行前由 `defineTool` 按统一参数 Schema 校验, 包括类型, 必填 key, 字面量约束和嵌套值. 仍要自己检查 DSL 无法表达的约束, 如非空字符串, 正数.
- 注册借用只读定义. 不要修改 Schema 或替换回调; 热替换工具时 dispose 所属 effect 再注册新的.
- 执行身份受保护. `callId`, `name`, `arguments`, `agent`, `token` 和 caller 的 `signal` 在整个分发期间不可变, 把 `args` 当作只读输入.
- 声明并返回一个规范的 JSON 值. `output.schema` 的根可以是对象, 数组, 标量或 null. `execute` 只返回推断出的值, 不要从 body 返回 content blocks.
- 抛异常和返回无效值都会产生 `isError`. 基础设施故障用 throw; 成功的业务结果用规范值表达, 即使 renderer 需要解释非零退出码这类不理想状态.
- 遵守 `exec.signal`, signal abort 时取消进行中的工作.
- 通过 `output.presentationMeta` 投射可回放的持久化卡片数据, 不要持久化规范值本身.
- 用 `exec.agent` 做异步通知: `agent.inject({ content, source: { kind: 'plugin', plugin: '<name>' } })` 追加对下一个模型请求可见的持久化上下文. 它不会唤醒空闲的 Agent; 用 try/catch 保护已 dispose 的 Agent.

长时运行工具用 `ctx.tasks.start({ kind, label, owner: exec.agent, run })` 注册后台工作, 用 task 持有的取消信号替代 `exec.signal`.

## 4. Hook Plugin

Hook 插件在文档化的扩展点拦截行为, 不修改 Agent 循环. "native hook" 是注册在拦截点的普通 Cordis 插件.

`ctx.waterfall` 是 around 中间件: listener 接收 `(...args, next)`, 调用 `next()` 委托给下游, 不调用即短路整个链. `tools/pre-execute` 是重排序的策略层, 用于权限, 沙箱和规划插件.

| 目标 | 扩展点 |
|---|---|
| 对工具调用应用 allow, deny 或 ask 策略 | `tools/pre-execute`, 返回类型化 `PreToolDecision` |
| 应用后续 listener 无法撤销的最终单调 deny | `ctx.tools.guard()` |
| 为超时, 重试或指标包装分发生命周期 | `tools/execute`, 只允许替换 `exec.signal` |
| 转换结果, 替换呈现, 阻止结果或追加模型可见上下文 | `tools/post-execute` |
| 观察不可变的规范化结果用于审计或采集 | `tools/result` |
| 拦截请求, step 或 turn | `agent/*` 事件; `agent/turn-stopping` 是 turn 结束事件 |
| 短路或路由模型调用 | `llm/stream` waterfall |
| 实施单调的 conclude-turn 策略 | 从终端工具调用 `ToolExecution.concludeTurn()` |

权限门模板:

```ts
import type { Context } from '@deepseek-ai/cordis'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'

declare function isAllowed(exec: ToolExecution): Promise<boolean>

export const name = 'permission-gate'

export function apply(ctx: Context) {
  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    if (!(await isAllowed(exec))) {
      return { kind: 'deny', reason: 'Denied by policy.' }
    }
    return next()
  })
}
```

## 5. Service Plugin

Service 是一个插件通过 `ctx` 暴露给其他插件的能力. `tools`, `llm`, `agents` 都是常见例子.

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    metrics: MetricsService
  }
}

export default class MetricsService extends Service {
  static inject = ['llm']  // service 可以依赖其他 service.

  constructor(ctx: Context) {
    super(ctx, 'metrics')  // 'metrics' 是 service name.
  }

  record(event: string, value: number) { /* ... */ }
}
```

- 加载后消费者通过 `ctx.metrics` 访问服务, 并声明 `inject: ['metrics']`.
- 提供服务给其他插件时用 class 形式; 只消费服务的插件可以用 function 形式.
- `inject` 列出必需服务; 不要把可选依赖放进 `inject`, 在调用处用 `ctx.get('name')` 查询并守卫缺失结果.
- 用 TypeScript declaration merging 在目标 Cordis `Events` 接口上定义类型化事件, 事件名使用 `namespace/action`, 用 `@mode` 文档化分发模式 (`emit`, `bail`, `serial`, `waterfall`).
- `turn/*`, `step/*`, `tool/call`, `tool/result`, `compact/*` 是持久化 session event 类型, 不是同名 Cordis 事件. 观察它们要监听 `session/event` 并检查 `event.type`.

## 6. Config Plugin

接受用户通过 `cordis.yml` 提供的配置:

```ts
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  greeting: string
  maxRetries: number
  verbose?: boolean
}

export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
  maxRetries: Schema.number().default(3),
  verbose: Schema.boolean().default(false),
})

export function apply(ctx: Context, config: Config) {
  // 使用校验过的类型安全用户值或 Schema 默认值.
}
```

- 不要硬编码可调值. 两个部署可能设置不同值的字段必须是配置字段.
- 无效配置必须显式失败, 在插件加载时报出可操作的错误, 不要静默跳过.
- 凭据不能成为配置值. 使用目标 Schemastery 包的环境变量回退, 通过 `!!js process.env.MY_KEY` 传入 `cordis.yml`, 或使用按操作解析的命名凭据引用.
- 配置变更自动触发 HMR: 框架卸载旧实例并加载新实例, 旧实例的注册作为 effect 自动清理.

## 编写规则

- 把每次注册当作 effect. 通过 `ctx` helper 或 `ctx.effect()` 注册并提供 disposer, 插件卸载时清理所有事件监听器, 工具, 定时器和其他资源.
- 在文档化的扩展点添加新行为, 不要修改 `agent-loop`.
- 公开 service 方法和类型化事件用 JSDoc 编写 `@param` 和 `@returns`.
- 模型看到的一切都必须能从会话日志重建.
- 配置错误显式失败. 不要静默跳过缺失的引用对象; 在解析, 配置, 接线和进程边界做校验.