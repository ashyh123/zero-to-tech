---
slug: ai-sdk-subagents
title: "从一次工具调用理解子 Agent：AI SDK 的任务派发、上下文与流式进度"
summary: "用十张交互图拆解子 Agent 的任务派发、项目上下文、取消信号、流式进度，以及用户界面与主模型各自接收的结果。"
date: "2026-10-25"
tags: [Note, Agent, AI SDK, 工程实践]
draft: false
---

阅读子 Agent 的示例代码时，最容易看懂的是角色：一个主 Agent 负责协调，一个研究 Agent 负责查资料。真正影响系统能否可靠工作的，是角色之间传递了什么：子任务拿到了哪些背景？执行过程中怎样取消？用户看到的进度和主模型接收的结果是不是同一份内容？

本文沿着一个“研究项目启动流程”的例子，把这些问题串起来。目标是读完后能解释一次完整委派，并知道把它接进自己的项目时应该检查什么。

**阅读范围**：基于 [AI SDK Subagents 文档](https://ai-sdk.dev/docs/agents/subagents)及相关 API 参考。核对日期为 2026-10-25，页面显示 v7。文中的交互图展示核心连接方式。所有图表均为教学模拟，不会实际调用模型、读取文件或发送网络请求；接入真实应用时，仍需配置模型、文件读取及搜索工具，并完成文末的验证。

## 一、子 Agent 是怎样被主 Agent 调用的

在本文讨论的模式中，主 Agent 和子 Agent 都可以通过 `ToolLoopAgent` 定义，各自配置模型、行为指令和可用工具。“主”和“子”描述的是调用关系。`ToolLoopAgent` 本身提供多步生成与工具执行的循环能力。[参考：ToolLoopAgent](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent)

| 组成部分           | 在例子里的职责                                     |
| ------------------ | -------------------------------------------------- |
| `mainAgent`        | 理解用户目标，决定是否委派，并使用研究结果继续工作 |
| `researchTool`     | 接收任务参数，在程序里调用子 Agent，再交回结果     |
| `researchSubagent` | 在给定任务和工具范围内开展研究                     |

下面把核心结构改为可点选的角色图。点击各节点，查看它的职责、配置与交接边界。`mainModel`、`researchModel`、`readFileTool`、`searchTool` 仍代表应用需要配置的依赖：

[谁提出调用，谁执行调用](/interactive/ai-sdk-subagents/00-roles.html)

主模型生成“调用 `research`，参数是某个 `task`”的请求，SDK 随后执行 `execute`。真正启动子 Agent 的，是程序中的 `researchSubagent.generate(...)`。模型负责提出调用，程序负责执行调用；这两层分开后，很多看起来像“Agent 自主沟通”的动作就变得具体了。[参考：Agent 的工具循环](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent)

[一次研究委派，逐步发生了什么](/interactive/ai-sdk-subagents/01-sequence.html)

`return run.text` 只取出已有文字。它没有自动润色、检查事实，也没有重新总结。这里的工具封装解决的是调用接口问题；研究质量仍取决于输入、工具、模型输出及后续验收。

## 二、派发任务时，必须把“这个项目”说清楚

如果 `task` 只有“研究一下这个项目”，而其他输入和工具配置也没有说明项目位置，子 Agent 就缺少定位目标的依据。主 Agent 在自己的对话里知道路径，并不会让子 Agent 自动知道。当前示例默认使用独立的调用上下文；需要哪些相关背景，就要显式提供。[参考：子 Agent 上下文隔离](https://ai-sdk.dev/docs/agents/subagents#subagent-context-is-isolated)

一种做法是让主模型把路径写进任务。另一种做法是定义独立的 `projectPath` 参数。对于界面已经选定项目的应用，我更倾向于让程序从当前会话取得路径，再在工具中注入，减少模型转述路径的环节。

下面用上下文拼装图演示这种绑定：切换项目，或取消勾选路径注入，观察子 Agent 实际收到的信息。程序为当前请求绑定已确认的路径；主模型只填写研究目标：

[把项目背景装进子任务](/interactive/ai-sdk-subagents/02-context.html)

图中的项目绑定对应普通 JavaScript 作用域：内部的 `execute` 能读取外层传入的 `projectPath`。在多用户应用中，应绑定当前请求所属的项目，避免用一个共享可变变量存放所有人的“当前项目”。

我会把一次委派所需的信息分成四项，作为自己的任务设计约定：

| 信息     | 示例                             |
| -------- | -------------------------------- |
| 研究目标 | 找出项目启动命令及入口文件       |
| 必要背景 | 项目路径、相关需求、已确认的事实 |
| 工作范围 | 只读取代码；本次无需修改配置     |
| 交付要求 | 结论、对应文件、证据和未验证事项 |

路径字符串只告诉工具去哪里找，文件访问仍由工具实现决定。子 Agent 的上下文独立，也不自动意味着独立容器或独立权限；执行环境和访问范围需要另外配置。

如果信息缺失，可以让子 Agent 返回缺少什么，主流程补齐后重新调用。也可以额外实现请求信息的工具，但双向追问不是这个基础示例自动提供的能力。第一次接入时，清楚的输入和明确的缺失信息反馈，通常比相互递归调用更容易检查。

## 三、取消信号负责通知，执行代码负责停止

`AbortSignal` 可以沿主 Agent、研究工具和子 Agent 的调用关系传下去。`AbortController` 发出取消通知，接收信号的操作决定如何停止；这是一种需要参与者配合的取消机制。[参考：DOM 取消机制](https://dom.spec.whatwg.org/#aborting-ongoing-activities)

[取消信号沿调用链传播](/interactive/ai-sdk-subagents/03-cancel.html)

前面的工具调用链把收到的 `abortSignal` 继续交给子 Agent。如果工具内部还发起 `fetch`，也应该将信号继续传给该请求。取消后，支持取消的操作结束，被取消的异步调用可以通过异常通知等待它的代码。[参考：工具执行参数](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool)

这里结束的是本轮任务。信号本身不会强制终止任意 JavaScript、关闭整个 Node.js 服务，也不会撤销此前已经完成的文件修改。应用需要知道哪些工作已完成、哪些停止了、哪些仍可能在后台继续。

普通工具报错也要单独理解：SDK 可以将执行错误记录为 `tool-error`，供后续模型步骤处理。因此，不应把取消案例概括成“任何子 Agent 出错都会停止主 Agent”。[参考：Handling Errors](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#handling-errors)

## 四、流式进度：在任务完成之前交出当前状态

前面的工具等待 `generate()` 完成，再一次性交回文本。为了让用户看到执行过程，可以改用子 Agent 的 `stream()`，并把工具的 `execute` 写成异步生成器。异步生成器能够在执行期间多次 `yield`，交出一个值之后仍可继续工作。[参考：async function\*](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*)

下面将流式执行改为可推进的快照图：点击“下一步”，观察文字片段怎样累积成当前状态，再对比替换与追加的区别。对应实现仍从外层函数取得 `projectPath`，让流式版本保留同一份项目背景：

[碎片怎样变成同一条消息](/interactive/ai-sdk-subagents/04-stream.html)

实现图中的流式链路时，需要从 `ai` 导入 `toUIMessageStream` 和 `readUIMessageStream`。`terminateOnError: true` 让消息流处理遇到错误时终止；外层仍需要分别处理正常结束、错误和取消。该选项默认是 `false`，因此示例中显式开启。[参考：流读取参数](https://ai-sdk.dev/docs/reference/ai-sdk-ui/read-ui-message-stream)

`stream()` 提供可逐步读取的输出。`toUIMessageStream` 将运行事件转换为 UI 消息流；`readUIMessageStream` 将这些零散更新整理为同一条消息持续变化的状态。每次迭代得到的是截至当前的消息版本，其中可以包含文字、工具调用及结果。[参考：readUIMessageStream](https://ai-sdk.dev/docs/reference/ai-sdk-ui/read-ui-message-stream)

可以用一个仅包含文字的简化例子理解：

| 新到达的内容    | 此刻交出的文字状态                |
| --------------- | --------------------------------- |
| 项目            | 项目                              |
| 使用 TypeScript | 项目使用 TypeScript               |
| ，入口已找到。  | 项目使用 TypeScript，入口已找到。 |

这里前端应更新同一次工具调用的输出。如果把每份完整状态再追加一遍，旧文字就会重复出现。替换语义来自 SDK 对工具输出更新的处理，`yield` 本身只是交出一个值；`readUIMessageStream` 负责累积和更新消息。

工具使用这种迭代输出方式时，最后一次产出的值成为最终工具结果。中间结果可用于实时展示，不会要求主模型每收到一个文字片段就重新生成一轮回答。[参考：工具的迭代输出](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool)

## 五、消息数据怎样变成用户看到的界面

`UIMessage` 是供界面使用的数据结构。要让用户真正看到进度，还需要外层服务发送流式响应，以及前端组件接收并渲染。

服务端可以使用 `createAgentUIStreamResponse` 执行主 Agent，并将它的 UI 消息流作为 HTTP 响应发送给浏览器。下面按请求入口、服务端响应、客户端接收和页面渲染四个节点查看这条链路：

[从服务端到用户界面](/interactive/ai-sdk-subagents/05-transport.html)

这解决的是服务端到浏览器的传输。前端的 `useChat` 接收消息更新，页面组件再读取 `tool-research` 的输出。文档里的子消息渲染示例主要展示文本；工具调用卡片、加载动画和执行记录，需要按对应的数据部分编写组件。[参考：流式响应](https://ai-sdk.dev/docs/reference/ai-sdk-core/create-agent-ui-stream-response)；[参考：前后端流协议](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)

还要区分“有输出”和“执行完成”。同一次工具调用在运行中就可以有 `output-available` 状态，因此需要结合临时输出标记：

[有输出，不一定已完成](/interactive/ai-sdk-subagents/06-state.html)

图中的 `hasOutput`、`isStreaming` 和 `isComplete` 服务于界面显示。`isComplete` 表示这一次工具调用已有最终输出；是否达成研究目标，还需要检查结束原因和业务验收结果。例如，因步数上限停止也可能留下最终输出，却没有研究完整。界面应把错误和取消分别呈现，不能仅凭这个变量报告研究成功。这些条件不负责控制 Agent 的执行循环；子任务结束之后，主 Agent 仍可能继续综合结果或处理其他任务。[参考：停止条件](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent)

## 六、用户看到的过程，与主模型接收的上下文

前端希望展示“发生了什么”，主模型下一步往往只需要“研究得到了什么”。如果把完整探索记录全部塞回主上下文，就削弱了委派任务的意义。

`toModelOutput` 提供了一个转换入口：接收工具输出，选择交给模型的内容。它可以与丰富的 UI 输出同时存在。图中的转换入口与前面的 `execute` 同处于 `tool({ ... })` 配置对象中。[参考：tool 转换接口](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool)

[从完整消息中选出最后一段文字](/interactive/ai-sdk-subagents/07-extract.html)

这里的 `output: message` 是解构重命名，相当于读取参数对象的 `output`，在函数里把它叫作 `message`。`findLast` 从后往前选择最后一个文本部分；它不会阅读全部工具记录后重新概括。`message?.` 和 `finalText?.` 分别处理消息不存在、没有找到文本部分的情况，让相应访问结果变成 `undefined`。`??` 只在前面的值为 `null` 或 `undefined` 时使用兜底文字，空字符串不会触发它。

假设 `message.parts` 依次包含三部分：文本“准备检查启动配置”、读取 `package.json` 的工具记录、文本“启动命令是 npm run dev。”。转换后的结果可以按字段展开查看：

[交给主模型的工具结果](/interactive/ai-sdk-subagents/08-result.html)

前面的说明和工具记录仍可供界面展示；在这个转换策略下，主模型接收的是选出来的最后一段文字。

返回的 `type` 和 `value` 属于模型侧工具结果格式。SDK 把这份结果关联到对应的工具调用，再组织进模型消息。它仍然是 `research` 的工具结果，不是凭空新增的一条用户指令。[参考：ToolResultOutput](https://ai-sdk.dev/docs/reference/ai-sdk-core/model-message#toolresultoutput)

[同一份输出，两条去向](/interactive/ai-sdk-subagents/09-branches.html)

这张图表达的是两个用途。界面可以保留过程信息；主模型可以只收到选择后的文字。具体是否保留、如何保存历史，仍由应用的数据设计决定。

最后一段文字能否成为有用总结，取决于子 Agent 的实际输出。指令应该说明交付对象和必要内容，例如：完成研究后给出结论、证据位置和未确认事项，以便主 Agent 使用。若最后只写“完成了”，提取函数也只会交回这三个字。

## 七、提示词、类型结构与业务验收各管什么

写出“请包含所有相关信息”，是在表达期望。定义 `inputSchema`，是在说明输入字段和类型。这两者都不能独自证明研究结论正确。

如果后续程序需要稳定读取字段，可以使用结构化输出，并实际执行 schema 解析或校验。AI SDK 的 `Output.object({ schema })` 支持按 schema 生成并校验最终对象，但“对象符合结构”仍不同于“证据真实支持结论”。[参考：生成结构化数据](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data#outputobject)

以“研究启动方式”为例，我会分别检查三件事：输入是否指向正确项目；交付是否包含所需字段；声称的命令是否确实能在项目配置中找到。前两项可以较直接地用程序检查，第三项需要把结论与证据对照。

原文示例的兜底字符串 `Task completed.` 也只是默认文案。找不到文字时返回这句话，不能证明任务成功。上面的结果筛选使用“没有可用的研究总结”，是为了让缺失信息继续可见；正式系统还可以使用明确的失败或待补充状态。

## 八、什么时候值得引入子 Agent

我会从任务本身判断，而不是先决定要有多少角色。一个需要大量阅读、能独立完成、最后能够交付清晰结果的研究任务，适合尝试委派。只有几步就能完成的问题，可以先保留在主 Agent 中。

判断是否值得拆分时，我会比较四个方面：主上下文是否变得更集中；交接是否丢失关键事实；额外模型调用增加了多少时间和成本；最终任务是否更容易验证。减少主上下文占用，并不保证系统的总 token 消耗降低。

对于常驻型 Agent，还要另行设计用户身份、任务状态、持久记录及恢复流程。本文这套工具调用结构只提供委派和结果交付的基本方式。上下文隔离本身不等于跨进程恢复，也不等于长期记忆。

当前所读的 Subagents 文档还对该模式的子工具审批给出了限制：不能直接使用 `toolApproval` 等审批流程。若任务包含需要确认的动作，应在设计时安排外层确认与明确授权，再委派对应工作；不要假设主子 Agent 的所有能力都会自动贯通。[参考：当前模式的限制](https://ai-sdk.dev/docs/agents/subagents#caveats)

## 九、接入自己的项目时，怎样知道它真的按预期工作

以下是针对这套设计的验证建议，不是已经执行的测试结果。先选择一个规模很小、答案可核对的项目，再逐项观察，比一开始就同时增加多个子 Agent 更容易定位问题。

| 要验证的问题           | 可以观察的现象                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------- |
| 子任务是否拿到正确背景 | 记录实际传入子 Agent 的任务输入，确认项目路径和目标都存在                          |
| 主模型是否拿到有用结果 | 查看最终工具结果，确认包含结论、证据位置和未确认事项                               |
| 流式界面是否正确更新   | 中途有临时输出；相同内容没有因整份快照追加而重复                                   |
| 完成状态是否准确       | 临时输出期间仍显示进行中；最终输出到达后结束加载；错误、取消和未达成目标单独标记   |
| 取消是否真正生效       | 使用一个支持取消的慢操作，检查任务结束、相关操作停止，并确认应用还能接收下一次请求 |
| 缺失信息是否会被掩盖   | 刻意不给项目路径或不给最终总结，检查系统能否暴露缺失，而不是报告成功               |

这些观察点分别对应输入、执行和交付。把它们记录下来后，再尝试并行研究、更多工具或持久化恢复，才能看清新增机制究竟改善了什么，以及它带来了哪些新的失败方式。

## 参考资料

- [AI SDK：Subagents](https://ai-sdk.dev/docs/agents/subagents)——本文讨论的委派模式与页面示例。
- [AI SDK：ToolLoopAgent](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent)——Agent 定义与运行接口。
- [AI SDK：Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)——输入、执行、临时结果、取消和错误处理。
- [AI SDK：tool](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool)——工具定义与 `toModelOutput` 接口。
- [AI SDK：readUIMessageStream](https://ai-sdk.dev/docs/reference/ai-sdk-ui/read-ui-message-stream)——持续更新的消息状态。
- [AI SDK：createAgentUIStreamResponse](https://ai-sdk.dev/docs/reference/ai-sdk-core/create-agent-ui-stream-response)——将 Agent 输出送到客户端。
- [AI SDK：Stream Protocols](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)——前后端消息流。
- [AI SDK：ModelMessage](https://ai-sdk.dev/docs/reference/ai-sdk-core/model-message)——工具消息及结果结构。
- [AI SDK：Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)——结构化输出与校验。
- [WHATWG DOM：Aborting ongoing activities](https://dom.spec.whatwg.org/#aborting-ongoing-activities)——取消机制的基础。
- [MDN：async function\*](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*)——异步生成器与多次产出。
