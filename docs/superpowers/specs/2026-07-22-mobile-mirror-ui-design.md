# 手机镜像界面（第一期）设计方案

日期：2026-07-22
状态：已确认，待编写实现计划

## 1. 背景与目标

让 CodeKey 手机 PWA 呈现桌面 Claude Code 的**完整对话流**（用户提问 / Claude 文字回复 / 工具调用+结果），采用三 tab 结构，工具名中文化、图标用 SVG，风格贴合桌面插件。

**本期（第一期）只做手机端 UI 层**，数据来自本地模拟台注入的假的完整会话数据。真实数据通道（桌面抓 `io_message` 消息流 → relay 落库 → 手机拉取/订阅）留第二期。

### 现状约束（调研结论）

- 桌面扩展目前只通过 Claude Code 的 hook（PreToolUse/PostToolUse/Notification/Stop）推送**工具调用摘要**，不推送 Claude 的文字回复和流式输出。
- 仓库内 `codekey-pwa/relay-server.js` 是过时/精简版：WS 只转发不落库，`sessions`/`events` 表无写入逻辑，`/events/:id/respond` 接口缺失，`pending_count` 列不存在。线上部署版为另一份正确实现，仓库不可见。
- PWA 现有 `SessionDetailPage` 只渲染 `event.data.summary` 单字段，5 秒 HTTP 轮询，无实时、无历史回放、无角色区分。
- 因此"完整对话流"需要第二期新增桌面抓流通道；本期先用 mock 数据把 UI 做到位。

### 范围

**做**：三 tab 界面、对话流渲染（气泡+内联工具卡片）、活动汇总视图、历史会话列表、审批交互 UI、发指令输入框（UI）、AskUserQuestion 提问往返（真实功能）、本地 mock 数据驱动。

**不做**：桌面端抓 `io_message` 流、relay 落库、真实反向指令注入（均为第二期）。

> **为何 AskUserQuestion 是真实功能、发指令却是 mock？**
> 二者用的是不同通道。AskUserQuestion 复用的是**已存在且本地已验证的审批通道**（PC→手机 event_push、手机→PC approval_forward，方向天然契合"推问题、收答案"），所以本期就能做成真实往返。而"自由发指令给 Claude"需要向 CC 进程注入 stdin（handler 里 `write_stdin` 尚是孤立雏形），属于新反向链路，风险大，归第二期；本期该输入框只走 mock。

## 2. 三 Tab 结构与组件

会话详情页 `SessionDetailPage` 重构为三 tab（底部标签栏）：

| Tab | 组件 | 内容 |
|-----|------|------|
| 对话 | `ConversationTab` | 用户气泡 / Claude 气泡 / 内联工具卡片，按时间顺序混排 |
| 活动 | `ActivityTab` | 全部工具调用纯列表 + 状态（完成/待审批/已拒绝）+ 类型筛选 |
| 历史 | `HistoryTab` | 该设备所有会话列表，可进入任一历史会话看对话流 |

「活动」tab 定位 = **工具汇总视图**（用户已选）：对话 tab 内联工具卡片，活动 tab 是同一批工具的纯列表+状态，方便快速扫「都执行了啥/哪个待审批」。工具信息两处并存，用途不同。

### 新增可复用组件

- `MessageBubble` —— 用户/Claude 两种气泡样式
- `ToolCard` —— 中文工具名 + SVG 图标 + 风险色标（低=青 #4ec9b0 / 中=橙 #e8a040 / 高=红 #f14c4c）+ 状态；对话内联与活动列表共用
- `QuestionCard` —— AskUserQuestion 选项卡片（见 §4）
- `ApprovalDock` —— 底部审批浮层（批准/拒绝/回复）
- `CommandInput` —— 底部发指令输入框（本期只发到 mock）
- `toolName.ts` —— 复用插件的中文映射表 + MCP 规则引擎（见 §附录）
- `toolIcon.tsx` —— 工具类型→线性 SVG 图标（currentColor，不用 emoji）

组件边界：`ToolCard` 只渲染单个工具事件，不关心来源；各 Tab 只负责按各自规则排布事件流。

## 3. 数据流（本期 mock）

```
mock 会话数据 (JSON) ──► useMockSession() ──► SessionDetailPage
                                              ├─ ConversationTab (消息+工具按序混排)
                                              ├─ ActivityTab (仅工具，筛选/状态)
                                              └─ HistoryTab (会话列表)
```

### 统一事件类型（面向第二期的接口契约）

```ts
interface SessionEvent {
  id: string;
  role: 'user' | 'assistant';
  type: 'message' | 'tool';
  text?: string;              // type=message 时
  toolName?: string;          // type=tool 时（英文原名，渲染时中文化）
  args?: Record<string, unknown>;
  result?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  status?: 'done' | 'pending' | 'denied';
  ts: number;
}
```

第二期真实数据只要产出此结构，UI 无需改动。mock 数据放 `codekey-pwa/src/mock/`，含一个多轮、覆盖各类工具、含待审批项的完整会话。

## 4. AskUserQuestion 提问往返（真实功能，非 mock）

Claude 触发 AskUserQuestion 时，把问题+选项推到手机，手机选择后答案回传，Claude 继续。复用已证实可用的审批通道（本地台已跑通批准/拒绝/离线降级）。

### 契约（已从代码确认）

- 输入：`{ questions: [{ question, header, options, multiSelect }] }`
- CC 期望返回：`{ behavior:'allow', updatedInput:{ ...input, answers: { [question]: 选中label } } }`
- 拦截点：`requestToolPermission` 中 `V === 'AskUserQuestion'`（extension.js:55137）

### 流程

```
Claude 触发 AskUserQuestion
  → requestToolPermission 拦截
  → Bridge createApproval 推问题+选项到手机（event_push, type=question_request, AES 加密）
  → 手机 QuestionCard 渲染选项，用户点选（multiSelect 可多选）
  → 手机回 approval_forward { approvalId, decision: 选中label }
  → Bridge resolve → 映射成 { behavior:'allow', updatedInput:{...input, answers:{[question]:label} } }
  → Claude 拿到答案继续
```

- 降级：手机离线 → 回落桌面 `showQuickPick`（现有逻辑），不阻塞
- 超时：沿用审批超时策略（默认拒绝/取消提问）
- 可行性验证：用本地模拟台（跑真实 handler/crypto）先加"提问→选项→答案回传"场景，确认 answers 结构正确映射。此为实现第一步，先证实逻辑再做 UI。

## 5. 错误处理

- 手机离线 → 提问/审批回落桌面原生（`showQuickPick`），不阻塞 CC
- 解密失败 → 手机显示"内容损坏"占位，不崩溃
- WS 断连 → 沿用现有重连；UI 显示离线态
- mock 数据缺字段 → `ToolCard`/`MessageBubble` 用兜底值，不白屏

## 6. 测试策略

- 提问往返：本地模拟台加"提问→选项→答案回传"场景，验证 `answers` 结构正确映射回 CC
- UI 组件：mock 数据驱动渲染，肉眼核对三 tab + 工具中文名 + 风险色标
- 构建验证：`npm run build`（PWA）通过 + 三个 sim 脚本 `node -c` 通过

## 附录：工具名中文映射（复用插件）

复用 `extension/webview/index.js` 内 `_toolNameZh` 映射表，保证与桌面端一致：
`Read→读取`、`Write→写入`、`Edit→编辑`、`Bash→终端`、`Grep→搜索`、`Glob→查找`、`TodoWrite→更新待办`、`Task→任务`、`WebFetch→网页抓取`、`WebSearch→网络搜索` 等；MCP 工具（`mcp__` 前缀）走规则引擎译为"MCP工具"。图标一律线性 SVG（currentColor 描边），不用 emoji。

## 分期说明

- **第一期（本设计）**：手机镜像 UI 层 + AskUserQuestion 真实往返，mock 数据驱动。
- **第二期（后续）**：桌面抓 `io_message` 完整对话流 → relay 落库 → 手机拉取/订阅；真实反向发指令（stdin 注入）。接口契约 `SessionEvent` 已在本期锁定，第二期只需产出该结构。
