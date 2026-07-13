# 循环模式 + 预发送集成 - 技术设计文档

## 1. 架构概述

本功能完全在 WebView 前端层实现，不涉及后端（extension.js）修改。

核心改动集中在 `extension/webview/index.js` 的预发送系统：
- 扩展 `__preSendState` 数据结构，增加 `loop` 字段
- 修改 `_doPoll` 轮询函数，支持循环自增
- 修改 `_createPreview` UI 函数，增加循环控制输入框
- 修改 `send()` 方法，移除 `/loop` 前缀拼接
- 修改入队逻辑，支持循环消息标记

## 2. 数据模型变更

### `__preSendState` 扩展

```javascript
// 原有结构
{
  texts: string[],
  interval: number  // setInterval ID
}

// 新结构
{
  texts: string[],
  interval: number,  // setInterval ID
  loop: null | {
    enabled: boolean,        // 是否循环模式
    sourceText: string,      // 循环源内容（用于重新入队）
    totalCount: number|null, // 总次数，null 表示无限
    completed: number,       // 已完成次数
    intervalMinutes: number, // 循环间隔（分钟）
    nextLoopAt: number|null, // 下一次循环的时间戳（Date.now() + interval*60000）
    isLoopItem: boolean      // 标记当前 texts[0] 是否是循环项（用于区分普通消息）
  }
}
```

### localStorage 格式

```javascript
// key: "ps_q_<sessionId>"
// value: JSON string of the full state including loop
{
  texts: ["你好"],
  loop: {
    enabled: true,
    sourceText: "你好",
    totalCount: 5,
    completed: 2,
    intervalMinutes: 10,
    nextLoopAt: null,
    isLoopItem: false
  }
}
```

向后兼容：如果 localStorage 中的数据不含 `loop` 字段，按普通预发送队列处理。

## 3. 核心逻辑设计

### 3.1 循环消息入队

当 `loopModeEnabled = true` 且 `preSend = true` 且 `busy = true` 时：
1. 用户输入文本进入预发送队列
2. 设置 `loop = { enabled: true, sourceText: text, totalCount: N, completed: 0, intervalMinutes: M, nextLoopAt: null, isLoopItem: false }`
3. 启动 `_doPoll` 轮询

当 `loopModeEnabled = true` 但 `preSend = false` 或 `busy = false` 时：
- 直接发送消息（不进队列），不拼接 `/loop` 前缀

### 3.2 `_doPoll` 修改

```
function _doPoll():
  // 原有逻辑：检查 preSend 开关、队列空、预览 DOM 等

  if (AI 空闲):
    // 检查循环间隔
    if (loop?.enabled && loop.nextLoopAt):
      if (Date.now() < loop.nextLoopAt):
        return  // 还在等待间隔，不发送
      else:
        loop.nextLoopAt = null  // 间隔结束，可以发送

    if (texts[0] 是优化中标记):
      return

    next = texts.shift()

    // 发送后处理
    if (loop?.enabled):
      loop.completed++

      // 检查是否还有普通消息排在前面（用户插入的）
      if (texts 还有非循环项):
        // 先发送普通消息，不设 nextLoopAt
        // 普通消息发送完后再触发循环
      else if (loop.totalCount === null || loop.completed < loop.totalCount):
        // 等待间隔后再入队下一次
        loop.nextLoopAt = Date.now() + loop.intervalMinutes * 60000
        texts.push(loop.sourceText)  // 重新加入队尾
      else:
        // 循环完成，清理 loop 状态
        loop = null

    // 如果队列空了，清理
    if (texts.length === 0):
      clearInterval
      _clearPS()
      delete __preSendState
      remove localStorage
    else:
      _createPreview(texts)
      save localStorage

    // 发送消息
    setInput(next)
    submit()
```

### 3.3 混合排队的关键逻辑

循环间隔等待期间，普通消息可以插入：

```
// 用户在循环间隔期间追加消息
if (loop?.enabled && loop.nextLoopAt):
  // 不需要特殊处理，新消息正常 push 到 texts 尾部
  // _doPoll 中检测到 texts[0] 不是循环项时，会立即发送
  // 发送完后，如果 texts 里还有循环项，继续循环
```

关键点：`nextLoopAt` 只控制"循环项"的发送时机。队列中的普通消息不受 `nextLoopAt` 约束。

为了区分循环项和普通消息，在 texts 数组中使用特殊标记：

```javascript
var LOOP_MARK = "LOOP";
// 循环项: LOOP_MARK + "你好"
// 普通项: "早上好"

function _isLoopMark(t) { return typeof t === "string" && t.indexOf(LOOP_MARK) === 0; }
function _loopOrig(t) { return _isLoopMark(t) ? t.slice(LOOP_MARK.length) : t; }
```

`_doPoll` 中：
- 如果 `texts[0]` 是循环标记且 `nextLoopAt` 还没到 → 跳过，检查下一个
- 如果 `texts[0]` 是普通消息 → 立即发送
- 如果 `texts[0]` 是循环标记且 `nextLoopAt` 已到或为 null → 发送

### 3.4 循环项重新入队的时机

不是在发送后立即入队，而是在发送时检查：

1. 取出队首
2. 如果是循环项：
   - completed++
   - 如果还有次数：设置 nextLoopAt = now + interval*60000，将新的循环标记项 push 到 texts 末尾
   - 如果没有次数了：不 push，循环结束
3. 如果是普通消息：正常发送，不修改循环状态

这样，普通消息自然地排在"当前轮次"和"下一次循环"之间。

## 4. 前端设计

### 4.1 循环控制输入框

在 `_createPreview` 的 header 区域，当循环模式开启时，增加两个输入框：

```
┌──────────────────────────────────────────────────────────┐
│ ♻ 循环中 2/5 次   [次数: ∞] [间隔: 10分]    Esc 取消 │
├──────────────────────────────────────────────────────────┤
│ 📌 你好 (第3次)                      [提前] [删除]     │
│ 📌 早上好 (普通)                     [提前] [删除]     │
└──────────────────────────────────────────────────────────┘
```

输入框样式：
- 与现有 VSCode 主题变量一致（`--vscode-input-background` 等）
- 宽度约 55px，紧凑排列
- 次数：`type="number"`, `min="0"`, `placeholder="∞"`
- 间隔：`type="number"`, `min="1"`, `placeholder="10"`

输入框值变化时：
- 更新 `__preSendState.loop.totalCount` 或 `intervalMinutes`
- 同步更新 localStorage
- 输入框获得焦点时阻止 Esc 键冒泡（避免误关队列）

### 4.2 循环标识

预发送队列中的循环项显示特殊标识（♻ 图标 + 轮次信息），与普通消息区分。

### 4.3 预发送预览样式增强

当循环模式运行中时，`preSendPreview` 添加 `data-loop-active` 属性，可配合 CSS 做高亮。

## 5. 可复用资产

| 资产 | 位置 | 复用方式 |
|------|------|---------|
| `OPT_MARK` 标记系统 | 行 207242-207245 | 参考其模式设计 `LOOP_MARK` |
| `_isOptMark` / `_optOrig` | 行 207243-207244 | 参考设计 `_isLoopMark` / `_loopOrig` |
| `_clearPS()` | 行 207300-207306 | 扩展其清理逻辑 |
| `_createPreview()` | 行 207308-207462 | 在 header 区域扩展输入框 |
| `_doPoll()` | 行 207464-207503 | 增加循环逻辑分支 |
| localStorage 读写 | 行 207186-207210 | 扩展存储格式 |
| `__preSendState` Map | 行 207180 | 扩展 value 结构 |

## 6. 文件变更清单

### 修改文件
- `extension/webview/index.js`：
  - `send()` 方法（行 143053-143062）：移除 `/loop` 前缀拼接
  - `_doPoll()` 函数（行 207464-207503）：增加循环自增逻辑
  - `_createPreview()` 函数（行 207308-207462）：增加循环控制 UI
  - `_clearPS()` 函数（行 207300-207306）：增加循环状态清理
  - 普通入队逻辑（约行 207514-207680）：支持循环消息标记入队
  - 发送按钮中断逻辑（行 206229-206241）：增加循环状态清理
  - Escape 处理逻辑（约行 207547-207558）：支持选择性取消循环
  - 新增 `LOOP_MARK` 标记常量和辅助函数

### 不修改
- `extension/extension.js`：不需要修改
- `extension/package.json`：不需要新增配置项

## 7. 技术决策与权衡

### D1：循环标记放在 texts 数组中 vs 独立队列
**决策**：放在 texts 数组中，使用 `LOOP_MARK` 前缀。
**理由**：与现有 `OPT_MARK` 模式一致，混合排队更自然，不需要维护两个队列的合并逻辑。

### D2：循环项重新入队的时机
**决策**：在 `_doPoll` 中发送循环项时，将下一次循环项 push 到 texts 末尾。
**理由**：这样用户插入的普通消息自然排在当前轮次和下一次之间，不需要额外的排序逻辑。

### D3：循环间隔的计时方式
**决策**：使用 `nextLoopAt` 时间戳，而不是 setTimeout。
**理由**：`_doPoll` 已有 300ms 轮询，用时间戳检查更简单可靠，不会因为页面不可见（setTimeout 被节流）而丢失定时。

### D4：预发送关闭时循环模式的行为
**决策**：预发送关闭时，循环模式下按 Enter 直接发送消息，不进队列，不拼 `/loop`。
**理由**：保持与用户预期一致——循环模式只在预发送模式下才发挥循环队列优势。

### D5：localStorage 向后兼容
**决策**：读取 localStorage 时检查是否有 `loop` 字段，没有则按普通队列处理。
**理由**：旧版本保存的队列数据不含循环信息，需要优雅降级。
