# 循环模式 + 预发送集成 - 实现任务清单

## 并行策略

所有任务都在 `extension/webview/index.js` 中，但涉及不同代码区域，可以按 Phase 顺序执行。

- **Phase 1**（数据层）：必须先完成，定义常量和辅助函数
- **Phase 2**（核心逻辑）：依赖 Phase 1，修改 `_doPoll` 和入队逻辑
- **Phase 3**（UI 层）：可与 Phase 2 并行，但为了减少冲突，建议串行
- **Phase 4**（集成）：依赖 Phase 2 和 Phase 3

---

### Phase 1: 数据层 — 常量与辅助函数

- [x] 1.1 添加 `LOOP_MARK` 常量及辅助函数（`_isLoopMark`, `_loopOrig`, `_stripLoopMarks`）
  - 文件: `extension/webview/index.js`
  - 位置: 紧跟 `OPT_MARK` 定义（行 207245 之后）
  - 参考现有 `OPT_MARK` 模式

- [x] 1.2 扩展 `_clearPS()` 函数，增加循环状态清理
  - 文件: `extension/webview/index.js`
  - 位置: 行 207300-207306
  - 增加: 清理 `__preSendState` 中的 `loop` 字段

### Phase 2: 核心逻辑 — 发送与轮询

- [x] 2.1 修改 `send()` 方法，移除 `/loop` 前缀拼接
  - 文件: `extension/webview/index.js`
  - 位置: 行 143057-143062
  - 删除: `loopPrefix` 相关的 3 行代码

- [x] 2.2 修改普通入队逻辑（Enter/Tab 快捷键），支持循环消息标记入队
  - 文件: `extension/webview/index.js`
  - 位置: 约行 207514-207680（W4 函数中的多处入队逻辑）
  - 增加: 当 `loopModeEnabled` 时，设置 `LOOP_MARK` 前缀和 `loop` 元数据

- [x] 2.3 修改 `_doPoll()` 函数，增加循环自增逻辑
  - 文件: `extension/webview/index.js`
  - 位置: 行 207464-207503
  - 增加:
    - 检查 `loop.nextLoopAt` 时间戳
    - 区分循环项和普通消息的发送逻辑
    - 循环项发送后重新入队（push 到 texts 末尾）
    - 循环完成时清理 loop 状态

- [x] 2.4 修改 localStorage 读写逻辑，支持 loop 字段
  - 文件: `extension/webview/index.js`
  - 位置: 行 207186-207220（sessionId 变化时的队列恢复逻辑）
  - 增加: 读取时解析 loop 字段，写入时包含 loop 字段

- [x] 2.5 修改 Escape 处理逻辑，支持选择性取消循环
  - 文件: `extension/webview/index.js`
  - 位置: 约行 207547-207558
  - 增加: 如果循环运行中，按 Esc 取消循环但保留普通队列消息

- [x] 2.6 修改发送按钮中断逻辑，增加循环状态清理
  - 文件: `extension/webview/index.js`
  - 位置: 行 206229-206241
  - 增加: 清理 loop 字段和 localStorage 中的 loop 数据

### Phase 3: UI 层 — 循环控制界面

- [x] 3.1 修改 `_createPreview()`，在 header 区域增加循环控制输入框
  - 文件: `extension/webview/index.js`
  - 位置: 行 207308-207462
  - 增加:
    - 循环模式下显示次数输入框（placeholder "∞"，默认空）
    - 循环模式下显示间隔输入框（默认 10，单位"分钟"）
    - 输入框值变化时更新 `__preSendState.loop` 和 localStorage
    - 输入框焦点时阻止 Esc 冒泡

- [x] 3.2 修改 `_createPreview()`，循环项显示特殊标识
  - 文件: `extension/webview/index.js`
  - 位置: 行 207308-207462 的 items 渲染逻辑
  - 增加: 循环标记项显示 ♻ 图标 + 轮次信息

- [x] 3.3 修改 `_createPreview()`，header 显示循环进度
  - 文件: `extension/webview/index.js`
  - 位置: 行 207337-207348
  - 增加: 显示"循环中 X/N 次"（无限时显示"循环中 X 次"）

### Phase 4: 集成与验证

- [x] 4.1 处理 `_stripLoopMarks` 在重载时的调用
  - 文件: `extension/webview/index.js`
  - 位置: 行 207209（`_stripOptMarks` 调用处）
  - 增加: 同时调用 `_stripLoopMarks`

- [x] 4.2 端到端逻辑验证
  - 验证: 循环模式开启 → 输入内容 → Enter → 队列标记 → 轮询发送 → 间隔等待 → 重新入队 → 次数耗尽 → 停止
  - 验证: 混合排队 → 普通消息插队 → 不等待间隔
  - 验证: 中断/取消 → 状态清理
  - 验证: localStorage 持久化和恢复
