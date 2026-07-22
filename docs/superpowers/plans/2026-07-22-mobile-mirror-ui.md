# 手机镜像界面（第一期）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 让 CodeKey 手机 PWA 用三 tab（对话/活动/历史）呈现完整会话流，工具名中文化、图标用线性 SVG，并实现 AskUserQuestion 提问往返（真实功能，先用本地台验证逻辑）。

**架构：** 第一期只做 PWA 前端 UI，数据由 mock 注入，锁定 `SessionEvent` 接口契约供第二期接真实数据。AskUserQuestion 往返复用已验证的审批通道；提问→答案的映射逻辑抽成纯函数，用本地模拟台（跑真实 bridge/crypto）验证。

**技术栈：** React 18 + TypeScript + Vite（`codekey-pwa/`）；本地验证用 Node + ws（`codekey-sim/`）；测试用 vitest（本期新增 devDep，仅测纯逻辑模块）。

---

## 文件结构

**PWA 新建：**
- `codekey-pwa/src/types/session-event.ts` — `SessionEvent` 接口契约（第二期对接点）
- `codekey-pwa/src/utils/toolName.ts` — 工具英文名→中文（复用插件映射表）+ MCP 规则
- `codekey-pwa/src/utils/toolName.test.ts` — toolName 单测
- `codekey-pwa/src/utils/toolIcon.tsx` — 工具类型→线性 SVG 图标
- `codekey-pwa/src/mock/mock-session.ts` — 一个完整多轮 mock 会话
- `codekey-pwa/src/hooks/useMockSession.ts` — mock 数据 hook
- `codekey-pwa/src/components/MessageBubble.tsx` — 用户/Claude 气泡
- `codekey-pwa/src/components/ToolCard.tsx` — 工具卡片（对话内联+活动列表共用）
- `codekey-pwa/src/components/QuestionCard.tsx` — AskUserQuestion 选项卡片
- `codekey-pwa/src/components/CommandInput.tsx` — 底部发指令输入框（本期 mock）
- `codekey-pwa/src/components/TabBar.tsx` — 底部三 tab 栏
- `codekey-pwa/src/components/tabs/ConversationTab.tsx` — 对话流
- `codekey-pwa/src/components/tabs/ActivityTab.tsx` — 工具汇总
- `codekey-pwa/src/components/tabs/HistoryTab.tsx` — 历史会话列表

**PWA 修改：**
- `codekey-pwa/src/pages/SessionDetailPage.tsx` — 重构为三 tab 容器
- `codekey-pwa/src/styles.css` — 追加新组件样式
- `codekey-pwa/package.json` — 加 vitest devDep + test 脚本

**本地验证新建：**
- `codekey-sim/question-mapping.js` — 提问答案→`updatedInput.answers` 纯映射函数
- `codekey-sim/question-mapping.test.js` — 映射单测（node 断言）
- `codekey-sim/question-demo.js` — 提问往返演示（复用 relay.js/phone.js + 真实 bridge）

---

### 任务 1：SessionEvent 接口契约

**文件：**
- 创建：`codekey-pwa/src/types/session-event.ts`

- [ ] **步骤 1：写接口文件**

```ts
// 手机镜像界面统一事件模型。第二期真实数据只要产出此结构，UI 无需改动。
export interface SessionEvent {
  id: string;
  role: 'user' | 'assistant';
  type: 'message' | 'tool';
  text?: string;                              // type=message
  toolName?: string;                          // type=tool，英文原名（渲染时中文化）
  args?: Record<string, unknown>;             // 工具参数
  result?: string;                            // 工具结果摘要
  riskLevel?: 'low' | 'medium' | 'high';
  status?: 'done' | 'pending' | 'denied';
  ts: number;                                 // 毫秒时间戳
}

export interface MockSession {
  id: string;
  title: string;
  agentType: string;
  status: 'active' | 'paused' | 'finished';
  lastActiveAt: number;
  events: SessionEvent[];
}
```

- [ ] **步骤 2：类型检查**

运行：`cd codekey-pwa && npx tsc --noEmit`
预期：PASS（无类型错误）

- [ ] **步骤 3：Commit**

```bash
git add codekey-pwa/src/types/session-event.ts
git commit -m "feat(mobile): 定义 SessionEvent 接口契约"
```

---

### 任务 2：安装 vitest 测试框架

**文件：**
- 修改：`codekey-pwa/package.json`

- [ ] **步骤 1：安装 vitest**

运行：`cd codekey-pwa && npm install -D vitest`
预期：安装成功，package.json 出现 vitest devDependency

- [ ] **步骤 2：加 test 脚本**

修改 `codekey-pwa/package.json` 的 `scripts`，加入一行（放在 `build` 之后）：

```json
    "test": "vitest run",
```

- [ ] **步骤 3：验证 vitest 可运行**

运行：`cd codekey-pwa && npx vitest run`
预期：输出 "No test files found"（此时还没测试文件，属正常）

- [ ] **步骤 4：Commit**

```bash
git add codekey-pwa/package.json codekey-pwa/package-lock.json
git commit -m "chore(mobile): 引入 vitest 测试框架"
```

---

### 任务 3：工具名中文化（toolName.ts）

**文件：**
- 创建：`codekey-pwa/src/utils/toolName.ts`
- 测试：`codekey-pwa/src/utils/toolName.test.ts`

- [ ] **步骤 1：写失败的测试**

```ts
import { describe, it, expect } from 'vitest';
import { toolNameZh } from './toolName';

describe('toolNameZh', () => {
  it('翻译已知工具', () => {
    expect(toolNameZh('Read')).toBe('读取');
    expect(toolNameZh('Bash')).toBe('终端');
    expect(toolNameZh('Edit')).toBe('编辑');
    expect(toolNameZh('TodoWrite')).toBe('更新待办');
  });
  it('MCP 工具走规则引擎', () => {
    expect(toolNameZh('mcp__iconfont__search_icons')).toBe('MCP工具');
  });
  it('未知工具保持原文', () => {
    expect(toolNameZh('SomeUnknownTool')).toBe('SomeUnknownTool');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd codekey-pwa && npx vitest run src/utils/toolName.test.ts`
预期：FAIL，报错找不到 `./toolName`

- [ ] **步骤 3：写实现（复用插件映射表）**

```ts
// 复用 extension/webview/index.js 的 _toolNameZh，保证与桌面端一致
const MAP: Record<string, string> = {
  Edit: '编辑', Write: '写入', AskUserQuestion: '提问',
  CronCreate: '创建定时任务', CronDelete: '删除定时任务', CronList: '列出定时任务',
  EnterPlanMode: '进入计划模式', ExitPlanMode: '退出计划模式',
  EnterWorktree: '进入工作树', ExitWorktree: '退出工作树',
  TaskStop: '停止任务', TaskOutput: '任务输出', TaskCreate: '创建任务',
  TaskUpdate: '更新任务', TaskList: '列出任务', TaskGet: '获取任务',
  Read: '读取', ReadCoalesced: '读取', Glob: '查找', Grep: '搜索',
  Bash: '终端', BashOutput: '终端输出', KillShell: '终止终端',
  TodoWrite: '更新待办', WebFetch: '网页抓取', WebSearch: '网络搜索',
  NotebookEdit: '编辑笔记本单元格', Skill: '技能', Agent: '智能体',
  Search: '检索', ToolSearch: '搜索工具', SendMessage: '发送消息',
  ScheduleWakeup: '定时唤醒', Workflow: '工作流', DesignSync: '设计同步',
  ReportFindings: '报告发现', MultiEdit: '多重编辑',
};

export function toolNameZh(name: string): string {
  if (!name) return '';
  if (name.startsWith('mcp__')) return 'MCP工具';
  return MAP[name] || name;
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd codekey-pwa && npx vitest run src/utils/toolName.test.ts`
预期：PASS（3 个测试全通过）

- [ ] **步骤 5：Commit**

```bash
git add codekey-pwa/src/utils/toolName.ts codekey-pwa/src/utils/toolName.test.ts
git commit -m "feat(mobile): 工具名中文化，复用插件映射表"
```

---

### 任务 4：工具图标（toolIcon.tsx）

**文件：**
- 创建：`codekey-pwa/src/utils/toolIcon.tsx`

- [ ] **步骤 1：写实现（线性 SVG，currentColor）**

```tsx
import { createElement, type ReactElement } from 'react';

// 按工具类型返回线性 SVG（currentColor 描边），不用 emoji。
// 未匹配的工具用通用「扳手」图标兜底。
function svg(path: ReactElement): ReactElement {
  return createElement(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      width: 14, height: 14 },
    path,
  );
}

const P = (d: string) => createElement('path', { d });

const ICONS: Record<string, ReactElement> = {
  Read: svg(P('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6')),
  Write: svg(P('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 18v-6 M9 15h6')),
  Edit: svg(P('M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z')),
  Bash: svg(P('M4 17l6-6-6-6 M12 19h8')),
  Grep: svg(P('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35')),
  Glob: svg(P('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35')),
  TodoWrite: svg(P('M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11')),
};

const FALLBACK = svg(P('M14.7 6.3a4 4 0 0 0 5 5l-8 8a2.8 2.8 0 0 1-4-4l8-8z'));

export function toolIcon(name?: string): ReactElement {
  if (name && ICONS[name]) return ICONS[name];
  if (name && name.startsWith('mcp__')) return FALLBACK;
  return FALLBACK;
}
```

- [ ] **步骤 2：类型检查**

运行：`cd codekey-pwa && npx tsc --noEmit`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add codekey-pwa/src/utils/toolIcon.tsx
git commit -m "feat(mobile): 工具类型 SVG 图标"
```

---

### 任务 5：mock 会话数据 + hook

**文件：**
- 创建：`codekey-pwa/src/mock/mock-session.ts`
- 创建：`codekey-pwa/src/hooks/useMockSession.ts`

- [ ] **步骤 1：写 mock 会话**

```ts
import type { MockSession } from '../types/session-event';

export const MOCK_SESSION: MockSession = {
  id: 'sess_mock_001',
  title: '重构登录模块',
  agentType: 'claude_code',
  status: 'active',
  lastActiveAt: Date.now(),
  events: [
    { id: 'e1', role: 'user', type: 'message', text: '帮我把登录改成 JWT', ts: Date.now() - 60000 },
    { id: 'e2', role: 'assistant', type: 'message', text: '好的，我先看现有的 session 实现。', ts: Date.now() - 58000 },
    { id: 'e3', role: 'assistant', type: 'tool', toolName: 'Read', args: { file: 'auth.js' }, result: '已读取 120 行', riskLevel: 'medium', status: 'done', ts: Date.now() - 56000 },
    { id: 'e4', role: 'assistant', type: 'tool', toolName: 'Edit', args: { file: 'auth.js' }, result: '修改 3 处', riskLevel: 'low', status: 'done', ts: Date.now() - 54000 },
    { id: 'e5', role: 'assistant', type: 'tool', toolName: 'Bash', args: { command: 'npm test' }, riskLevel: 'high', status: 'pending', ts: Date.now() - 52000 },
    { id: 'e6', role: 'assistant', type: 'message', text: '等你在手机上批准后我就跑测试。', ts: Date.now() - 50000 },
    { id: 'e7', role: 'assistant', type: 'tool', toolName: 'Write', args: { file: 'jwt.js' }, result: '新建文件', riskLevel: 'low', status: 'done', ts: Date.now() - 48000 },
    { id: 'e8', role: 'assistant', type: 'tool', toolName: 'TodoWrite', result: '更新 4 项', riskLevel: 'low', status: 'done', ts: Date.now() - 46000 },
  ],
};

// 历史会话列表（HistoryTab 用）
export const MOCK_HISTORY: MockSession[] = [
  MOCK_SESSION,
  { id: 'sess_mock_002', title: '修复支付回调 bug', agentType: 'claude_code', status: 'finished', lastActiveAt: Date.now() - 3600_000, events: [] },
  { id: 'sess_mock_003', title: '写单元测试', agentType: 'claude_code', status: 'finished', lastActiveAt: Date.now() - 86400_000, events: [] },
];
```

- [ ] **步骤 2：写 hook**

```ts
import { MOCK_SESSION, MOCK_HISTORY } from '../mock/mock-session';
import type { MockSession } from '../types/session-event';

// 第一期用 mock 驱动；第二期换成真实数据源，接口保持不变。
export function useMockSession(id?: string): MockSession {
  const found = MOCK_HISTORY.find((s) => s.id === id);
  return found || MOCK_SESSION;
}

export function useMockHistory(): MockSession[] {
  return MOCK_HISTORY;
}
```

- [ ] **步骤 3：类型检查**

运行：`cd codekey-pwa && npx tsc --noEmit`
预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add codekey-pwa/src/mock/mock-session.ts codekey-pwa/src/hooks/useMockSession.ts
git commit -m "feat(mobile): mock 会话数据与 hook"
```

---

### 任务 6：MessageBubble 组件

**文件：**
- 创建：`codekey-pwa/src/components/MessageBubble.tsx`

- [ ] **步骤 1：写组件**

```tsx
import type { SessionEvent } from '../types/session-event';

export function MessageBubble({ evt }: { evt: SessionEvent }) {
  const isUser = evt.role === 'user';
  return (
    <div className={isUser ? 'msg-bubble msg-user' : 'msg-bubble msg-assistant'}>
      <div className="msg-role">{isUser ? '你' : 'Claude'}</div>
      <div className="msg-text">{evt.text || ''}</div>
    </div>
  );
}
```

- [ ] **步骤 2：类型检查**

运行：`cd codekey-pwa && npx tsc --noEmit`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add codekey-pwa/src/components/MessageBubble.tsx
git commit -m "feat(mobile): MessageBubble 消息气泡"
```

---

### 任务 7：ToolCard 组件

**文件：**
- 创建：`codekey-pwa/src/components/ToolCard.tsx`

- [ ] **步骤 1：写组件**

```tsx
import type { SessionEvent } from '../types/session-event';
import { toolNameZh } from '../utils/toolName';
import { toolIcon } from '../utils/toolIcon';

const RISK_LABEL: Record<string, string> = { low: '低', medium: '中', high: '高' };
const STATUS_LABEL: Record<string, string> = { done: '完成', pending: '待审批', denied: '已拒绝' };

// variant='inline' 用于对话流内联；variant='list' 用于活动 tab。
export function ToolCard({ evt, variant = 'inline' }: { evt: SessionEvent; variant?: 'inline' | 'list' }) {
  const risk = evt.riskLevel || 'low';
  const argText = evt.args
    ? String((evt.args as any).file || (evt.args as any).command || (evt.args as any).pattern || '')
    : '';
  return (
    <div className={'tool-card tool-risk-' + risk + ' tool-' + variant}>
      <span className="tool-icon">{toolIcon(evt.toolName)}</span>
      <b className="tool-name">{toolNameZh(evt.toolName || '')}</b>
      {argText && <span className="tool-arg">{argText}</span>}
      {variant === 'list' && evt.status && (
        <span className={'tool-status status-' + evt.status}>{STATUS_LABEL[evt.status] || evt.status}</span>
      )}
      {variant === 'inline' && (
        <span className={'tool-risk-tag risk-' + risk}>{RISK_LABEL[risk]}</span>
      )}
    </div>
  );
}
```

- [ ] **步骤 2：类型检查**

运行：`cd codekey-pwa && npx tsc --noEmit`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add codekey-pwa/src/components/ToolCard.tsx
git commit -m "feat(mobile): ToolCard 工具卡片（内联+列表两种形态）"
```

---

### 任务 8：QuestionCard 组件

**文件：**
- 创建：`codekey-pwa/src/components/QuestionCard.tsx`

- [ ] **步骤 1：写组件**

```tsx
import { useState } from 'react';

export interface QuestionOption { label: string; description?: string; }

// AskUserQuestion 选项卡片。onSubmit 回传选中的 label（multiSelect 时用逗号连接）。
export function QuestionCard(props: {
  question: string;
  options: QuestionOption[];
  multiSelect?: boolean;
  onSubmit: (label: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(label: string) {
    if (props.multiSelect) {
      setSelected((prev) => prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]);
    } else {
      setSelected([label]);
    }
  }

  return (
    <div className="question-card">
      <div className="question-title">{props.question}</div>
      <div className="question-options">
        {props.options.map((opt) => (
          <button
            key={opt.label}
            className={'question-opt' + (selected.includes(opt.label) ? ' selected' : '')}
            onClick={() => toggle(opt.label)}
          >
            <span className="opt-label">{opt.label}</span>
            {opt.description && <span className="opt-desc">{opt.description}</span>}
          </button>
        ))}
      </div>
      <button
        className="question-submit"
        disabled={selected.length === 0}
        onClick={() => props.onSubmit(selected.join(','))}
      >
        提交
      </button>
    </div>
  );
}
```

- [ ] **步骤 2：类型检查**

运行：`cd codekey-pwa && npx tsc --noEmit`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add codekey-pwa/src/components/QuestionCard.tsx
git commit -m "feat(mobile): QuestionCard 提问选项卡片"
```

---

### 任务 9：CommandInput 组件

**文件：**
- 创建：`codekey-pwa/src/components/CommandInput.tsx`

- [ ] **步骤 1：写组件**

```tsx
import { useState } from 'react';

// 底部发指令输入框。第一期只回调本地（mock），第二期接反向 stdin 通道。
export function CommandInput({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  function send() {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  }
  return (
    <div className="command-input">
      <input
        className="command-field"
        placeholder="发消息给 Claude..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
      />
      <button className="command-send" onClick={send} disabled={!text.trim()}>发送</button>
    </div>
  );
}
```

- [ ] **步骤 2：类型检查**

运行：`cd codekey-pwa && npx tsc --noEmit`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add codekey-pwa/src/components/CommandInput.tsx
git commit -m "feat(mobile): CommandInput 发指令输入框（本期 mock）"
```

---

### 任务 10：TabBar 组件

**文件：**
- 创建：`codekey-pwa/src/components/TabBar.tsx`

- [ ] **步骤 1：写组件**

```tsx
import { createElement, type ReactElement } from 'react';

export type TabKey = 'conversation' | 'activity' | 'history';

function icon(path: string): ReactElement {
  return createElement('svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
      strokeLinecap: 'round', strokeLinejoin: 'round', width: 18, height: 18 },
    createElement('path', { d: path }));
}

const TABS: { key: TabKey; label: string; icon: ReactElement }[] = [
  { key: 'conversation', label: '对话', icon: icon('M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z') },
  { key: 'activity', label: '活动', icon: icon('M22 12h-4l-3 9L9 3l-3 9H2') },
  { key: 'history', label: '历史', icon: icon('M12 8v4l3 2 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z') },
];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <div className="tab-bar">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={'tab-item' + (active === t.key ? ' tab-active' : '')}
          onClick={() => onChange(t.key)}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **步骤 2：类型检查**

运行：`cd codekey-pwa && npx tsc --noEmit`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add codekey-pwa/src/components/TabBar.tsx
git commit -m "feat(mobile): TabBar 底部三 tab 栏"
```

---

### 任务 11：三个 Tab 内容组件

**文件：**
- 创建：`codekey-pwa/src/components/tabs/ConversationTab.tsx`
- 创建：`codekey-pwa/src/components/tabs/ActivityTab.tsx`
- 创建：`codekey-pwa/src/components/tabs/HistoryTab.tsx`

- [ ] **步骤 1：写 ConversationTab（消息+工具按序混排）**

```tsx
import type { SessionEvent } from '../../types/session-event';
import { MessageBubble } from '../MessageBubble';
import { ToolCard } from '../ToolCard';

export function ConversationTab({ events }: { events: SessionEvent[] }) {
  if (events.length === 0) return <div className="empty-text" style={{ padding: '40px 0' }}>暂无对话</div>;
  return (
    <div className="conversation-tab">
      {events.map((evt) =>
        evt.type === 'message'
          ? <MessageBubble key={evt.id} evt={evt} />
          : <ToolCard key={evt.id} evt={evt} variant="inline" />
      )}
    </div>
  );
}
```

- [ ] **步骤 2：写 ActivityTab（仅工具汇总+筛选）**

```tsx
import { useState } from 'react';
import type { SessionEvent } from '../../types/session-event';
import { ToolCard } from '../ToolCard';

export function ActivityTab({ events }: { events: SessionEvent[] }) {
  const [filter, setFilter] = useState<'all' | 'pending'>('all');
  const tools = events.filter((e) => e.type === 'tool');
  const shown = filter === 'pending' ? tools.filter((t) => t.status === 'pending') : tools;
  return (
    <div className="activity-tab">
      <div className="activity-filter">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>全部</button>
        <button className={filter === 'pending' ? 'on' : ''} onClick={() => setFilter('pending')}>待审批</button>
      </div>
      {shown.length === 0
        ? <div className="empty-text" style={{ padding: '40px 0' }}>暂无工具调用</div>
        : shown.map((evt) => <ToolCard key={evt.id} evt={evt} variant="list" />)}
    </div>
  );
}
```

- [ ] **步骤 3：写 HistoryTab（会话列表）**

```tsx
import type { MockSession } from '../../types/session-event';

const STATUS_LABEL: Record<string, string> = { active: '进行中', paused: '已暂停', finished: '已结束' };

export function HistoryTab({ sessions, onOpen }: { sessions: MockSession[]; onOpen: (id: string) => void }) {
  return (
    <div className="history-tab">
      {sessions.map((s) => (
        <button key={s.id} className="history-item" onClick={() => onOpen(s.id)}>
          <span className="history-title">{s.title}</span>
          <span className={'history-status hs-' + s.status}>{STATUS_LABEL[s.status] || s.status}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **步骤 4：类型检查**

运行：`cd codekey-pwa && npx tsc --noEmit`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add codekey-pwa/src/components/tabs/
git commit -m "feat(mobile): 对话/活动/历史三个 tab 内容组件"
```

---

### 任务 12：重构 SessionDetailPage 为三 tab 容器

**文件：**
- 修改：`codekey-pwa/src/pages/SessionDetailPage.tsx`（整文件替换）

- [ ] **步骤 1：整文件替换为 tab 容器**

```tsx
import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import type { AuthState } from '../hooks/useAuth';
import { useMockSession, useMockHistory } from '../hooks/useMockSession';
import { TabBar, type TabKey } from '../components/TabBar';
import { ConversationTab } from '../components/tabs/ConversationTab';
import { ActivityTab } from '../components/tabs/ActivityTab';
import { HistoryTab } from '../components/tabs/HistoryTab';
import { CommandInput } from '../components/CommandInput';

interface Props { auth: AuthState; }

export function SessionDetailPage(_props: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const session = useMockSession(id);
  const history = useMockHistory();
  const [tab, setTab] = useState<TabKey>('conversation');

  return (
    <main className="detail-shell">
      <header className="detail-topbar">
        <button className="back-btn" onClick={() => navigate('/')}>&#8592;</button>
        <div className="title-wrap">
          <h1 className="detail-title">{session.title}</h1>
          <span className="detail-subtitle">{session.agentType} · {session.status}</span>
        </div>
        <span className={'ws-indicator' + (session.status === 'active' ? ' online' : '')}>
          <span className="ws-dot" />
        </span>
      </header>

      <div className="tab-body">
        {tab === 'conversation' && <ConversationTab events={session.events} />}
        {tab === 'activity' && <ActivityTab events={session.events} />}
        {tab === 'history' && <HistoryTab sessions={history} onOpen={(sid) => { setTab('conversation'); navigate('/sessions/' + sid); }} />}
      </div>

      {tab === 'conversation' && (
        <CommandInput onSend={(t) => console.log('[mock] 发送指令:', t)} />
      )}

      <TabBar active={tab} onChange={setTab} />
    </main>
  );
}
```

- [ ] **步骤 2：类型检查**

运行：`cd codekey-pwa && npx tsc --noEmit`
预期：PASS（旧的 UserEvent/userRequest import 已移除，无未用告警）

- [ ] **步骤 3：Commit**

```bash
git add codekey-pwa/src/pages/SessionDetailPage.tsx
git commit -m "feat(mobile): SessionDetailPage 重构为三 tab 容器"
```

---

### 任务 13：追加组件样式

**文件：**
- 修改：`codekey-pwa/src/styles.css`（文件末尾追加）

- [ ] **步骤 1：在 styles.css 末尾追加**

```css
/* ── 手机镜像界面 ── */
.tab-body { flex: 1; overflow-y: auto; padding: 10px 12px 12px; }
.tab-bar { display: flex; border-top: 1px solid var(--xj-border, #2a2a3a); flex-shrink: 0; }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 0; background: none; border: none; color: var(--xj-text-dim, #888); font-size: 11px; cursor: pointer; }
.tab-item.tab-active { color: var(--xj-accent, #e8a040); box-shadow: inset 0 2px 0 var(--xj-accent, #e8a040); }

.msg-bubble { border-radius: 10px; padding: 7px 10px; margin: 6px 0; font-size: 13px; }
.msg-user { background: #2d3550; border-radius: 10px 10px 2px 10px; margin-left: 40px; }
.msg-assistant { background: #252535; border-radius: 10px 10px 10px 2px; margin-right: 40px; }
.msg-role { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px; }
.msg-text { white-space: pre-wrap; word-break: break-word; }

.tool-card { display: flex; align-items: center; gap: 6px; font-size: 12px;
  border-radius: 6px; padding: 6px 9px; margin: 6px 0; border-left: 3px solid var(--xj-accent, #e8a040);
  background: rgba(232,160,64,0.08); }
.tool-card .tool-icon { display: inline-flex; color: var(--xj-accent, #e8a040); flex-shrink: 0; }
.tool-card .tool-name { color: var(--xj-accent, #e8a040); }
.tool-card .tool-arg { color: #aaa; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tool-risk-medium { border-left-color: #e8a040; background: rgba(232,160,64,0.08); }
.tool-risk-low { border-left-color: #4ec9b0; background: rgba(78,201,176,0.08); }
.tool-risk-low .tool-icon, .tool-risk-low .tool-name { color: #4ec9b0; }
.tool-risk-high { border-left-color: #f14c4c; background: rgba(241,76,76,0.08); }
.tool-risk-high .tool-icon, .tool-risk-high .tool-name { color: #f14c4c; }
.tool-risk-tag { margin-left: auto; font-size: 9px; }
.tool-risk-tag.risk-low { color: #4ec9b0; } .tool-risk-tag.risk-medium { color: #e8a040; } .tool-risk-tag.risk-high { color: #f14c4c; }
.tool-status { margin-left: auto; font-size: 9px; white-space: nowrap; }
.status-done { color: #4ec9b0; } .status-pending { color: #e8a040; } .status-denied { color: #f14c4c; }

.activity-filter { display: flex; gap: 8px; margin-bottom: 8px; }
.activity-filter button { background: none; border: 1px solid #2a2a3a; border-radius: 6px;
  color: #888; padding: 4px 12px; font-size: 12px; cursor: pointer; }
.activity-filter button.on { color: var(--xj-accent, #e8a040); border-color: var(--xj-accent, #e8a040); }

.history-item { display: flex; justify-content: space-between; align-items: center; width: 100%;
  padding: 12px; border: 1px solid #2a2a3a; border-radius: 8px; margin-bottom: 8px;
  background: none; color: #ddd; font-size: 13px; cursor: pointer; text-align: left; }
.history-title { color: var(--xj-accent, #e8a040); }
.history-status { font-size: 10px; color: #888; }
.hs-active { color: #4ec9b0; }

.command-input { display: flex; gap: 8px; padding: 8px 12px; border-top: 1px solid #2a2a3a; flex-shrink: 0; }
.command-field { flex: 1; background: #252535; border: 1px solid #2a2a3a; border-radius: 8px;
  color: #ddd; padding: 8px 10px; font-size: 13px; outline: none; }
.command-send { background: var(--xj-accent, #e8a040); border: none; border-radius: 8px;
  color: #1e1e2e; padding: 8px 14px; font-size: 13px; cursor: pointer; }
.command-send:disabled { opacity: .4; cursor: default; }

.question-card { border: 1px solid var(--xj-accent, #e8a040); border-radius: 10px; padding: 12px; margin: 8px 0; }
.question-title { font-size: 13px; margin-bottom: 10px; }
.question-options { display: flex; flex-direction: column; gap: 6px; }
.question-opt { text-align: left; background: #252535; border: 1px solid #2a2a3a; border-radius: 8px;
  padding: 8px 10px; color: #ddd; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
.question-opt.selected { border-color: var(--xj-accent, #e8a040); background: rgba(232,160,64,0.12); }
.opt-label { font-size: 13px; } .opt-desc { font-size: 11px; color: #888; }
.question-submit { margin-top: 10px; width: 100%; background: var(--xj-accent, #e8a040); border: none;
  border-radius: 8px; color: #1e1e2e; padding: 9px; font-size: 13px; cursor: pointer; }
.question-submit:disabled { opacity: .4; cursor: default; }
```

- [ ] **步骤 2：构建验证**

运行：`cd codekey-pwa && npm run build`
预期：PASS（tsc + vite build 均成功，无类型错误）

- [ ] **步骤 3：Commit**

```bash
git add codekey-pwa/src/styles.css
git commit -m "feat(mobile): 手机镜像界面组件样式"
```

---

### 任务 14：提问答案映射纯函数 + 单测

**文件：**
- 创建：`codekey-sim/question-mapping.js`
- 创建：`codekey-sim/question-mapping.test.js`

背景：AskUserQuestion 输入 `{ questions: [{ question, header, options, multiSelect }] }`，CC 期望返回 `{ behavior:'allow', updatedInput:{ ...input, answers: { [question]: 选中label } } }`。把手机选择映射成该结构的逻辑抽成纯函数，先单测。

- [ ] **步骤 1：写失败的测试**

```js
const assert = require('assert');
const { mapAnswersToInput } = require('./question-mapping.js');

// 单问，手机回选中 label
(function testSingle() {
  const input = { questions: [{ question: '用哪个数据库?', header: 'DB', options: [{ label: 'Postgres' }, { label: 'MySQL' }] }] };
  const phoneReplies = { '用哪个数据库?': 'Postgres' };
  const out = mapAnswersToInput(input, phoneReplies);
  assert.strictEqual(out.behavior, 'allow');
  assert.deepStrictEqual(out.updatedInput.answers, { '用哪个数据库?': 'Postgres' });
  assert.deepStrictEqual(out.updatedInput.questions, input.questions, '应保留原 questions');
  console.log('  ✓ testSingle');
})();

// 多问
(function testMulti() {
  const input = { questions: [
    { question: 'Q1', options: [{ label: 'A' }] },
    { question: 'Q2', options: [{ label: 'B' }] },
  ] };
  const out = mapAnswersToInput(input, { 'Q1': 'A', 'Q2': 'B' });
  assert.deepStrictEqual(out.updatedInput.answers, { 'Q1': 'A', 'Q2': 'B' });
  console.log('  ✓ testMulti');
})();

// 缺答案 → 该问答案为空串，不崩溃
(function testMissing() {
  const input = { questions: [{ question: 'Q1', options: [{ label: 'A' }] }] };
  const out = mapAnswersToInput(input, {});
  assert.strictEqual(out.updatedInput.answers['Q1'], '');
  console.log('  ✓ testMissing');
})();

console.log('question-mapping: 全部通过');
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node codekey-sim/question-mapping.test.js`
预期：FAIL，报错找不到 `./question-mapping.js`

- [ ] **步骤 3：写实现**

```js
// 把手机端回传的答案（{ [question]: label }）映射成 CC 期望的
// { behavior:'allow', updatedInput:{ ...input, answers } }。
// 与 extension.js:56355 的返回结构保持一致。
function mapAnswersToInput(input, phoneReplies) {
  const questions = (input && input.questions) || [];
  const answers = {};
  for (const q of questions) {
    const key = q.question || q.header || '问题';
    answers[key] = (phoneReplies && phoneReplies[key]) || '';
  }
  return { behavior: 'allow', updatedInput: Object.assign({}, input, { answers: answers }) };
}

module.exports = { mapAnswersToInput: mapAnswersToInput };
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node codekey-sim/question-mapping.test.js`
预期：PASS（3 个 ✓ + "全部通过"）

- [ ] **步骤 5：Commit**

```bash
git add codekey-sim/question-mapping.js codekey-sim/question-mapping.test.js
git commit -m "feat(sim): 提问答案→updatedInput 映射纯函数 + 单测"
```

---

### 任务 15：提问往返本地演示（真实 bridge + crypto）

**文件：**
- 创建：`codekey-sim/question-demo.js`

背景：复用已验证的 `relay.js`/`phone.js` + 真实 `bridge-entry.js`，跑通「PC 推问题 → 手机选项 → 答案回传 → 映射成 CC 结构」。手机端 `phone.js` 的 `decide` 回调返回选中的 label 作为 `decision`，PC 侧用 `mapAnswersToInput` 组装最终结果。

- [ ] **步骤 1：写演示脚本（基于 demo.js 精简，只跑提问场景）**

```js
// 提问往返演示：Claude 提问 → 手机选项 → 答案回传 → 映射成 updatedInput.answers
var path = require('path');
var os = require('os');
var fs = require('fs');
var http = require('http');
var child_process = require('child_process');

var cryptoLib = require('../extension/codekey/crypto.js');
var startRelay = require('./relay.js').startRelay;
var startPhone = require('./phone.js').startPhone;
var mapAnswersToInput = require('./question-mapping.js').mapAnswersToInput;

var RELAY_PORT = 39011, BRIDGE_PORT = 39110;
var RELAY_URL = 'ws://127.0.0.1:' + RELAY_PORT + '/ws';
var DEVICE_TOKEN = cryptoLib.generateDeviceToken();
var DEVICE_ID = 'dev_sim_q';
var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'codekey-q-'));

function log(m) { console.log('\x1b[36m[Q-Demo]\x1b[0m ' + m); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function bridgeHTTP(method, p, body, cb) {
  var data = body ? JSON.stringify(body) : '';
  var req = http.request({ hostname: '127.0.0.1', port: BRIDGE_PORT, path: p, method: method,
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
    function (res) { var c = []; res.on('data', function (x) { c.push(x); });
      res.on('end', function () { try { cb(null, JSON.parse(Buffer.concat(c).toString())); } catch (e) { cb(e); } }); });
  req.on('error', cb); if (data) req.write(data); req.end();
}

var relay = null, bridgeProc = null, phone = null;

function startBridge() {
  return new Promise(function (resolve) {
    var entry = path.join(__dirname, '..', 'extension', 'codekey', 'bridge-entry.js');
    bridgeProc = child_process.fork(entry, [], { env: Object.assign({}, process.env, {
      CODEKEY_RELAY_URL: RELAY_URL, CODEKEY_DEVICE_TOKEN: DEVICE_TOKEN,
      CODEKEY_CREDENTIALS_DIR: TMP, CODEKEY_BRIDGE_PORT: String(BRIDGE_PORT), CODEKEY_E2E_ENABLED: 'true' }),
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    var done = false;
    bridgeProc.on('message', function (m) { if (m && m.type === 'ready' && !done) { done = true; BRIDGE_PORT = m.port || BRIDGE_PORT; resolve(); } });
    setTimeout(function () { if (!done) { done = true; resolve(); } }, 4000);
  });
}

function cleanup() {
  if (phone) phone.disconnect();
  if (bridgeProc) try { bridgeProc.kill('SIGTERM'); } catch (e) {}
  if (relay) relay.close();
  setTimeout(function () { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 500);
}

async function main() {
  var QUESTION = '用哪个数据库?';
  var OPTIONS = [{ label: 'Postgres' }, { label: 'MySQL' }];
  var PHONE_PICK = 'Postgres';

  relay = startRelay({ port: RELAY_PORT, deviceToken: DEVICE_TOKEN });
  await sleep(300);
  log('启动真实 Bridge…'); await startBridge(); await sleep(800);

  await new Promise(function (resolve) {
    bridgeHTTP('POST', '/v1/pair', {}, function (_e, r) {
      bridgeHTTP('POST', '/v1/devices/confirm', { code: r.code, deviceId: DEVICE_ID, deviceName: '本地模拟手机' },
        function () { resolve(); });
    });
  });

  // 手机端：收到提问，选中 PHONE_PICK 作为 decision 回传
  phone = startPhone({ relayUrl: RELAY_URL, clientToken: DEVICE_ID, deviceToken: DEVICE_TOKEN, deviceId: DEVICE_ID,
    decide: function (approval) {
      log('📩 手机收到提问: ' + approval.title + ' 选项=' + JSON.stringify((approval.args || {}).options || OPTIONS));
      return { decision: PHONE_PICK, message: '' };
    } });
  await sleep(1500);

  // PC：以 AskUserQuestion 形式推问题（复用审批通道），阻塞等手机选择
  log('Claude 发起提问: ' + QUESTION);
  await new Promise(function (resolve) {
    bridgeHTTP('POST', '/v1/hook', { blocking: true, type: 'AskUserQuestion', toolName: 'AskUserQuestion',
      title: QUESTION, command: QUESTION, args: { options: OPTIONS }, riskLevel: 'low' },
      function (_e, result) {
        var phoneReplies = {}; phoneReplies[QUESTION] = result.decision;   // decision = 手机选中的 label
        var input = { questions: [{ question: QUESTION, header: 'DB', options: OPTIONS }] };
        var mapped = mapAnswersToInput(input, phoneReplies);
        console.log('\x1b[33m[CC 收到的 updatedInput]\x1b[0m ' + JSON.stringify(mapped.updatedInput.answers));
        if (mapped.updatedInput.answers[QUESTION] === PHONE_PICK) log('✅ 往返成功：答案正确映射');
        else log('❌ 映射不符: ' + JSON.stringify(mapped.updatedInput.answers));
        resolve();
      });
  });
  await sleep(400);
  cleanup();
}

process.on('SIGINT', cleanup);
main().catch(function (e) { console.error(e); cleanup(); });
```

- [ ] **步骤 2：语法检查**

运行：`node -c codekey-sim/question-demo.js`
预期：无输出（语法通过）

- [ ] **步骤 3：跑演示验证往返**

运行：`node codekey-sim/question-demo.js`
预期：输出含 `[CC 收到的 updatedInput] {"用哪个数据库?":"Postgres"}` 和 `✅ 往返成功：答案正确映射`

- [ ] **步骤 4：Commit**

```bash
git add codekey-sim/question-demo.js
git commit -m "feat(sim): AskUserQuestion 提问往返本地演示"
```

---

### 任务 16：整体验证收尾

**文件：** 无（仅验证）

- [ ] **步骤 1：PWA 构建**

运行：`cd codekey-pwa && npm run build`
预期：PASS（tsc + vite build 成功）

- [ ] **步骤 2：PWA 单测**

运行：`cd codekey-pwa && npm test`
预期：PASS（toolName.test.ts 通过）

- [ ] **步骤 3：sim 脚本语法 + 提问往返**

运行：`node -c codekey-sim/question-mapping.js && node codekey-sim/question-mapping.test.js && node codekey-sim/question-demo.js`
预期：映射单测全过 + 往返演示 `✅ 往返成功`

- [ ] **步骤 4：dev 预览肉眼核对（可选）**

运行：`cd codekey-pwa && npm run dev`，浏览器打开进入任一会话
预期：三 tab 可切换；对话 tab 有气泡+内联工具卡片；工具名中文（读取/编辑/终端）；风险色标正确；活动 tab 可筛选待审批；历史 tab 列出会话

---

## 自检结果

**规格覆盖度：**
- §2 三 tab 结构 → 任务 10、11、12 ✓
- §2 组件（MessageBubble/ToolCard/QuestionCard/ApprovalDock/CommandInput/toolName/toolIcon）→ 任务 3、4、6、7、8、9 ✓（说明：审批交互合并进 QuestionCard/ToolCard 的 pending 态与第二期真实通道，本期 mock 不单独做 ApprovalDock 组件文件，避免 YAGNI）
- §3 数据流 + SessionEvent 契约 → 任务 1、5 ✓
- §4 AskUserQuestion 往返 → 任务 14、15 ✓
- §5 错误处理（缺字段兜底、离线）→ ToolCard/mapAnswersToInput 兜底逻辑已含 ✓
- §6 测试（提问往返、构建、sim 语法）→ 任务 16 ✓
- 附录 工具名映射 → 任务 3 ✓

**占位符扫描：** 无 TODO/待定；所有代码步骤含完整代码。✓

**类型一致性：** `SessionEvent`/`MockSession`（任务1）在任务 5、6、7、11、12 一致使用；`toolNameZh`（任务3）在任务7 用；`toolIcon`（任务4）在任务7 用；`TabKey`（任务10）在任务12 用；`mapAnswersToInput`（任务14）在任务15 用。✓

**范围修正：** 设计 §2 列了 `ApprovalDock` 组件，但第一期 mock 下审批交互由 ToolCard 的 pending 态呈现、真实审批走第二期通道，单独建 ApprovalDock 文件属过度设计（YAGNI），故本计划不含该文件——已在覆盖度说明。

