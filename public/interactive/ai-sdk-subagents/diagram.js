const ID = document.body.dataset.diagram;
const $ = (id) => document.getElementById(id);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const app = $("app");
const buttons = (items, action, active = 0) =>
  '<div class="controls">' +
  items
    .map(
      (t, i) =>
        `<button data-action="${action}" data-value="${i}" aria-pressed="${i === active}">${escape(t)}</button>`,
    )
    .join("") +
  "</div>";
const node = (title, sub, i, action, active) =>
  `<button class="node" data-action="${action}" data-value="${i}" aria-pressed="${i === active}"><strong>${escape(title)}</strong><small>${escape(sub)}</small></button>`;
const flow = (items, action, active) =>
  '<div class="nodes">' +
  items
    .map(
      (x, i) =>
        (i ? '<span class="arrow" aria-hidden="true">→</span>' : "") +
        node(x[0], x[1], i, action, active),
    )
    .join("") +
  "</div>";
const panel = (title, text, cls = "") =>
  `<div class="panel ${cls}" aria-live="polite"><strong>${escape(title)}</strong>${escape(text)}</div>`;
let selected = 0,
  step = 0,
  running = false,
  cancelled = false,
  project = 0,
  withPath = true,
  cooperate = true,
  mode = 0,
  extractCase = 0;
const parts = [
  ["准备检查启动配置", "text"],
  ["读取 package.json", "tool-read"],
  ["启动命令是 npm run dev。", "text"],
];
const sequence = [
  [
    "主 Agent → researchTool",
    "模型提出工具调用",
    "参数 task：找出项目启动命令及入口文件。模型只提出调用请求。",
  ],
  [
    "researchTool → 研究子 Agent",
    "SDK 执行工具函数",
    "execute 把任务交给 researchSubagent.generate，并继续传递 abortSignal。",
  ],
  [
    "研究子 Agent → 读取与搜索工具",
    "按需要发起研究",
    "研究 Agent 可调用已配置的 read 与 search；调用次数取决于具体研究过程。",
  ],
  [
    "读取与搜索工具 → 研究子 Agent",
    "工具返回数据",
    "文件内容、搜索结果回到研究子 Agent 的独立上下文中。",
  ],
  [
    "研究子 Agent → researchTool",
    "子任务交付文字",
    "generate 完成后，run.text 保存最终研究文字。",
  ],
  [
    "researchTool → 主 Agent",
    "返回工具结果",
    "直接返回 run.text；这里没有自动润色、事实检查或重新总结。主 Agent 可继续综合结果。",
  ],
];
function render() {
  if (ID === "roles") {
    const defs = [
      [
        "主 Agent",
        "mainAgent：理解用户目标",
        "配置 mainModel、行为指令，以及 research 工具；决定是否委派，并结合工具结果继续工作。",
      ],
      [
        "研究工具",
        "researchTool：程序调用边界",
        "输入 schema 要求 task 为字符串；SDK 执行 execute，程序调用子 Agent，并把 abortSignal 传下去。",
      ],
      [
        "研究子 Agent",
        "researchSubagent：独立研究",
        "配置 researchModel、研究指令，以及 read / search 工具。要求交付结论、依据、未确认事项；缺信息时明确指出。",
      ],
    ];
    app.innerHTML =
      flow(
        defs.map((d) => [d[0], d[1]]),
        "select",
        selected,
      ) +
      panel(defs[selected][0], defs[selected][2]) +
      '<p class="note">ToolLoopAgent 提供多步生成与工具循环。主模型和研究模型、文件读取与搜索工具均需由应用配置。</p>';
  }
  if (ID === "sequence") {
    const s = sequence[step];
    app.innerHTML =
      '<div class="row"><span class="status">步骤 ' +
      (step + 1) +
      ' / 6</span><span class="badge">主 Agent · 研究工具 · 研究子 Agent · 读取与搜索工具</span></div><div class="meter"><span style="width:' +
      ((step + 1) / 6) * 100 +
      '%"></span></div>' +
      panel(s[0], s[2]) +
      buttons(["上一步", "下一步", "重置"], "advance", -1) +
      '<p class="note">当前动作：' +
      s[1] +
      "。这是示意流程；真实研究可能包含多轮工具调用。</p>";
    app.querySelector('[data-value="0"]').disabled = step === 0;
    app.querySelector('[data-value="1"]').disabled = step === 5;
  }
  if (ID === "context") {
    const path = project === 0 ? "/demo/alpha" : "/demo/beta";
    app.innerHTML =
      buttons(["项目 Alpha", "项目 Beta"], "project", project) +
      '<label><input id="with-path" type="checkbox" ' +
      (withPath ? "checked" : "") +
      '>由当前请求注入项目路径</label><div class="split"><div class="stack"><div class="box"><span class="tag">模型提供</span><strong>研究任务</strong>找出启动命令及入口文件</div><div class="box"><span class="tag">程序绑定</span><strong>projectPath</strong>' +
      escape(path) +
      '</div></div><div class="arrow" aria-hidden="true">→</div><div class="box"><span class="tag">子 Agent 收到的 prompt</span><p>' +
      (withPath
        ? "项目路径：" + escape(path)
        : '<span class="danger">缺少项目位置</span>') +
      "<br>研究任务：找出启动命令及入口文件<br>交付：结论、文件依据、未确认事项</p></div></div>" +
      panel(
        withPath ? "请求范围内绑定" : "需要补充背景",
        withPath
          ? "工具闭包读取本次请求的 projectPath。项目路径只提供位置，不会自动授予访问权限。"
          : "单说“当前项目”不能定位目标。子 Agent 应返回缺失信息，主流程补齐后再调用。",
      ) +
      '<p class="note">示例路径不指向真实项目。多用户应用应按当前请求创建工具，避免共享可变的“当前项目”。</p>';
  }
  if (ID === "cancel") {
    let status = !running
      ? "尚未开始"
      : cancelled
        ? "取消通知已发出"
        : "研究中";
    const values = !running
      ? ["等待任务", "等待调用", "等待研究", "等待请求"]
      : !cancelled
        ? ["等待结果", "执行中", "读取中", "请求中"]
        : [
            "本轮收到取消通知",
            "向子任务传递信号",
            "支持取消的调用结束",
            cooperate ? "请求响应信号并停止" : "忽略信号，可能仍在后台运行",
          ];
    app.innerHTML =
      '<div class="row"><span class="status">' +
      status +
      '</span></div><label><input id="cooperate" type="checkbox" ' +
      (cooperate ? "checked" : "") +
      ">底层请求配合处理 AbortSignal</label>" +
      flow(
        ["主 Agent", "研究工具", "研究子 Agent", "底层请求"].map((n, i) => [
          n,
          values[i],
        ]),
        "cancel-node",
        -1,
      ) +
      buttons(["开始模拟", "停止任务", "重置"], "cancel-action", -1) +
      panel(
        cancelled ? "通知不等于强制终止" : "信号传递关系",
        cancelled
          ? "AbortController 发出通知。支持取消的操作停止；忽略信号的工作可能继续。服务仍可处理下一次请求，已完成的修改不会被撤销。"
          : "界面停止按钮 → controller.abort() → 主 Agent → execute → 子 Agent → 支持取消的 fetch 等操作。",
      ) +
      "<details><summary>异常怎样处理</summary><p>本轮调用因取消而以 AbortError 结束时，界面显示已取消；其他异常继续按错误路径处理。普通工具错误可被 SDK 记录为 tool-error，供后续模型步骤处理。</p></details>";
    const controls = app.querySelectorAll('[data-action="cancel-action"]');
    controls[1].disabled = !running || cancelled;
  }
  if (ID === "stream") {
    const snapshots = [
      "项目",
      "项目使用 TypeScript",
      "项目使用 TypeScript，入口已找到。",
    ];
    const deltas = ["项目", "使用 TypeScript", "，入口已找到。"];
    app.innerHTML =
      '<div class="row"><span class="status">' +
      (step === 3 ? "最终工具结果" : "临时输出 " + (step + 1) + " / 3") +
      '</span></div><div class="grid"><div class="box"><span class="tag">新到达的文字片段</span><strong>' +
      deltas[Math.min(step, 2)] +
      '</strong></div><div class="box"><span class="tag">截至当前的完整快照</span><strong>' +
      snapshots[Math.min(step, 2)] +
      "</strong></div></div>" +
      buttons(["替换当前状态", "追加整份快照（错误）"], "stream-mode", mode) +
      '<div class="box ui"><span class="tag">同一次工具调用的 UI</span><p aria-live="polite">' +
      (mode === 0
        ? snapshots[Math.min(step, 2)]
        : snapshots.slice(0, Math.min(step, 2) + 1).join("<br>")) +
      "</p></div>" +
      buttons(["上一步", "下一步", "重置"], "stream-advance", -1) +
      panel(
        "运行事件 → UI 消息流 → 累积消息快照 → yield",
        "stream 提供事件；toUIMessageStream 转换事件；readUIMessageStream 累积为消息状态；execute 逐次产出。最后一次产出的值成为最终工具结果。",
      ) +
      '<p class="note">第 4 步只把同一份最后快照标为最终结果。中间输出用于界面展示，不会让主模型每收到一个片段就重新回答。</p>';
    const b = app.querySelectorAll('[data-action="stream-advance"]');
    b[0].disabled = step === 0;
    b[1].disabled = step === 3;
  }
  if (ID === "transport") {
    const d = [
      [
        "请求入口",
        "POST / messages",
        "服务端读取请求中的 messages，并把它们作为 uiMessages 传给 createAgentUIStreamResponse。",
      ],
      [
        "Agent 响应",
        "createAgentUIStreamResponse",
        "执行 projectMainAgent，将 UI 消息流作为 HTTP 响应发送给浏览器。",
      ],
      [
        "客户端接收",
        "useChat",
        "接收消息更新。收到消息数据之后，仍需要页面组件读取并渲染。",
      ],
      [
        "界面渲染",
        "tool-research 输出",
        "组件按消息部分展示文本、工具调用卡片和执行记录；加载与结束状态由组件根据数据决定。",
      ],
    ];
    app.innerHTML =
      flow(
        d.map((x) => [x[0], x[1]]),
        "select",
        selected,
      ) +
      panel(d[selected][1], d[selected][2]) +
      '<p class="note">UIMessage 是供界面使用的数据。HTTP 流负责传输，前端组件负责呈现；数据到达不会自动生成所有界面组件。</p>';
  }
  if (ID === "state") {
    const states = [
      [
        "等待输入",
        "input-available",
        "无输出",
        "尚无最终结果",
        "hasOutput = false；isStreaming = false；isComplete = false",
      ],
      [
        "临时输出",
        "output-available",
        "preliminary = true",
        "进行中，已有阶段性内容",
        "hasOutput = true；isStreaming = true；isComplete = false",
      ],
      [
        "最终输出",
        "output-available",
        "preliminary = false / 未设置",
        "本次工具调用已有最终输出",
        "hasOutput = true；isStreaming = false；isComplete = true",
      ],
      [
        "工具错误",
        "output-error",
        "错误信息",
        "显示错误，不能报告成功",
        "hasOutput = false；isStreaming = false；isComplete = false",
      ],
      [
        "用户取消",
        "取消事件（应用单独处理）",
        "取消通知 / 异常",
        "显示已取消，并核对底层操作是否停止",
        "取消不能仅从这三个布尔量判断",
      ],
    ];
    const s = states[selected];
    app.innerHTML =
      buttons(
        states.map((x) => x[0]),
        "select",
        selected,
      ) +
      '<div class="grid"><div class="box"><span class="tag">接收到的事件</span><strong>' +
      s[1] +
      "</strong>" +
      s[2] +
      '</div><div class="box ui"><span class="tag">界面呈现</span><strong>' +
      s[3] +
      "</strong></div></div>" +
      panel("显示条件", s[4]) +
      '<p class="note">isComplete 只表示本次工具有最终输出。步数上限也可能留下最终输出；研究是否完整、证据是否成立，以及主 Agent 是否继续工作，需要另行判断。</p>';
  }
  if (ID === "extract") {
    const cases = [
      parts,
      [
        ["准备检查启动配置", "text"],
        ["读取 package.json", "tool-read"],
      ],
      [["读取 package.json", "tool-read"]],
      [],
      [
        ["准备检查启动配置", "text"],
        ["", "text"],
      ],
    ];
    const list = cases[extractCase];
    const last = list.findLastIndex((p) => p[1] === "text");
    const result = last >= 0 ? list[last][0] : "没有可用的研究总结。";
    app.innerHTML =
      buttons(
        [
          "正常消息",
          "最后只有过程文字",
          "没有文本部分",
          "消息不存在",
          "最后文本为空",
        ],
        "extract-case",
        extractCase,
      ) +
      '<div class="split"><div class="stack">' +
      (list.length
        ? list
            .map(
              (p, i) =>
                '<div class="box ' +
                (i === last ? "selected" : "") +
                '"><span class="tag">' +
                p[1] +
                "</span><strong>" +
                (p[0] ? escape(p[0]) : "（空字符串）") +
                "</strong>" +
                (i === last ? "<small>从后往前找到的第一个 text</small>" : "") +
                "</div>",
            )
            .join("")
        : '<div class="box empty">没有可读取的消息或 parts</div>') +
      '</div><div class="arrow" aria-hidden="true">→</div><div class="box model"><span class="tag">交给主模型的文字</span><strong>' +
      (result ? escape(result) : "（空字符串，未触发兜底）") +
      "</strong></div></div>" +
      panel(
        "选择现成文本，不做重新总结",
        "toModelOutput 读取 output，并在函数中命名为 message。findLast 选最后一个 text；可选链处理缺失；?? 只对 null / undefined 兜底，空字符串不触发。",
      ) +
      '<p class="note">若最后一段只是“准备检查启动配置”，提取器仍会返回它。输出是否足够有用，需要交付要求与验收来保证。</p>';
  }
  if (ID === "result") {
    app.innerHTML =
      '<div class="box model"><span class="tag">research 的模型侧工具结果</span><strong>启动命令是 npm run dev。</strong><p class="hint">示意结果；不代表已验证任何真实项目。</p></div><details><summary>type：text</summary><p>告诉 SDK 这是文本类型的模型侧工具结果。</p></details><details><summary>value：启动命令是 npm run dev。</summary><p>来自消息中最后一个 text 部分，不是提取器重新生成的总结。</p></details><details><summary>它关联到哪条消息</summary><p>SDK 把结果关联到对应的 research 工具调用，并组织进模型消息。它仍然是工具结果，不是一条新增的用户指令。</p></details>';
  }
  if (ID === "branches") {
    app.innerHTML =
      buttons(["用户视角", "主模型视角"], "select", selected) +
      '<div class="box center"><strong>子 Agent 的消息与工具活动</strong><span class="hint">研究工具输出是共同来源</span></div><div class="grid" style="margin-top:14px"><div class="box ui ' +
      (selected === 0 ? "selected" : "") +
      '"><span class="tag">UI 消息流</span><strong>用户查看过程</strong><p>阶段性文本<br>读取与搜索记录<br>逐步更新的消息状态</p></div><div class="box model ' +
      (selected === 1 ? "selected" : "") +
      '"><span class="tag">最终结果经 toModelOutput</span><strong>主模型继续工作</strong><p>选出的最后一段文字<br>作为 research 工具结果<br>用于后续综合与决策</p></div></div>' +
      panel(
        selected === 0 ? "过程如何展示" : "上下文如何交付",
        selected === 0
          ? "界面可以展示过程信息。是否保留和怎样保存历史，由应用的数据设计决定。"
          : "最终工具结果经转换后送回主模型。当前策略只筛选已有文字；不会自动阅读全部记录再生成总结。",
      );
  }
}
app.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-action]");
  if (!b || b.disabled) return;
  const n = Number(b.dataset.value);
  switch (b.dataset.action) {
    case "select":
      selected = n;
      break;
    case "advance":
      step = n === 2 ? 0 : Math.max(0, Math.min(5, step + (n === 1 ? 1 : -1)));
      break;
    case "project":
      project = n;
      break;
    case "cancel-action":
      if (n === 0) {
        running = true;
        cancelled = false;
      } else if (n === 1) {
        cancelled = true;
      } else {
        running = false;
        cancelled = false;
      }
      break;
    case "cancel-node":
      return;
    case "stream-mode":
      mode = n;
      break;
    case "stream-advance":
      step = n === 2 ? 0 : Math.max(0, Math.min(3, step + (n === 1 ? 1 : -1)));
      break;
    case "extract-case":
      extractCase = n;
      break;
  }
  render();
  const next = app.querySelector(
    `[data-action="${b.dataset.action}"][data-value="${n}"]`,
  );
  if (next && !next.disabled) next.focus();
});
app.addEventListener("change", (e) => {
  if (e.target.id === "with-path") {
    withPath = e.target.checked;
    render();
    $("with-path").focus();
  }
  if (e.target.id === "cooperate") {
    cooperate = e.target.checked;
    render();
    $("cooperate").focus();
  }
});
render();

function reportSize() {
  window.parent.postMessage(
    {
      type: "note-diagram-size",
      height: Math.ceil(
        document.querySelector("main").getBoundingClientRect().height,
      ),
    },
    "*",
  );
}
document.documentElement.dataset.theme = matchMedia(
  "(prefers-color-scheme: dark)",
).matches
  ? "dark"
  : "light";
window.addEventListener("message", (event) => {
  if (
    event.source !== window.parent ||
    !event.data ||
    event.data.type !== "note-diagram-theme"
  )
    return;
  if (event.data.theme === "light" || event.data.theme === "dark")
    document.documentElement.dataset.theme = event.data.theme;
});
new ResizeObserver(reportSize).observe(document.querySelector("main"));
window.parent.postMessage({ type: "note-diagram-ready" }, "*");
reportSize();
