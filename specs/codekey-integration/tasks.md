# CodeKey 集成 - 实现任务清单

> 基于 requirements.md v1.0 + design.md v1.0 + design-tokens.md
> 创建日期: 2026-07-21
> 总预估: ~87h (P0: 36h / P1: 24h / P2: 27h)

---

## 并行策略

```
Phase 1 (Foundation)          ← 必须先完成，所有后续 Phase 的依赖
    │
    ├── Phase 2 (Extension 注入)  ← 依赖 Phase 1，可与 Phase 3 并行
    ├── Phase 3 (Webview UI)      ← 依赖 Phase 1，可与 Phase 2 并行
    ├── Phase 5 (Hook 脚本)       ← 依赖 Phase 1，可与 Phase 2/3 并行
    │
    ├── Phase 4 (Package.json)    ← 依赖 Phase 2 确定注入标识符后
    │
    └── Phase 6 (集成与验证)       ← 所有 Phase 完成后

Phase 7 (P1 体验完善)            ← 依赖 P0 全部完成
Phase 8 (P2 锦上添花)            ← 依赖 P1 全部完成
```

**并行建议**: Phase 2、Phase 3、Phase 5 可由不同开发者同时进行（共享 Phase 1 产出的模块接口）。

**关键约束**: 所有注入代码追加到文件末尾，不修改混淆代码内部逻辑。extension.js 末尾注入 (L76883+)，webview/index.js 尾部注入 (L213882+)，index.css 末尾追加 (L376+)。

---

### Phase 1: 基础设施 — CodeKey 核心模块 (必须先完成)

> 创建 `extension/codekey/` 目录及所有独立模块文件。本 Phase 不涉及注入，仅创建可被 require/globalThis 加载的模块。
> 预估合计: ~6h

- [ ] 1.1 创建 `extension/codekey/` 目录结构 — 文件: `extension/codekey/` (新建目录) (预估: 5 min)
- [ ] 1.2 创建 `types.js` — 共享常量定义 (消息类型、事件名、默认配置值、错误码枚举) — 文件: `extension/codekey/types.js` (新建, ~80行) (预估: 20 min)
- [ ] 1.3 创建 `crypto.js` — ECDH P-256 密钥对生成 (`crypto.generateKeyPairSync`) — 文件: `extension/codekey/crypto.js` (新建, ~60行) (预估: 25 min)
- [ ] 1.4 创建 `crypto.js` — ECDH shared secret 派生 + AES-256-GCM encrypt/decrypt — 文件: `extension/codekey/crypto.js` (追加, ~80行) (预估: 25 min)
- [ ] 1.5 创建 `crypto.js` — 消息序列化: base64(iv[12] + ciphertext + tag[16]) 格式 — 文件: `extension/codekey/crypto.js` (追加, ~40行) (预估: 20 min)
- [ ] 1.6 创建 `crypto.js` — PBKDF2 密钥派生 (deviceToken -> AES key, salt='codekey-v2', 100000 iterations) — 文件: `extension/codekey/crypto.js` (追加, ~30行) (预估: 20 min)
- [ ] 1.7 创建 `pairing.js` — 6 位配对码生成 (字母数字, 120 秒 TTL, 含过期检查) — 文件: `extension/codekey/pairing.js` (新建, ~50行) (预估: 25 min)
- [ ] 1.8 创建 `pairing.js` — 设备信息存储 CRUD (添加/查询/删除/列表, 上限 maxDevices) — 文件: `extension/codekey/pairing.js` (追加, ~60行) (预估: 25 min)
- [ ] 1.9 创建 `pairing.js` — 在线状态检测 (基于 relay 最近心跳时间) — 文件: `extension/codekey/pairing.js` (追加, ~30行) (预估: 20 min)
- [ ] 1.10 创建 `privacy-pipeline.js` — 敏感规则定义 (API key 格式、token 格式、私钥块、密码赋值) — 文件: `extension/codekey/privacy-pipeline.js` (新建, ~50行) (预估: 20 min)
- [ ] 1.11 创建 `privacy-pipeline.js` — 扫描引擎 (正则匹配 + 占位符替换, 支持自定义规则) — 文件: `extension/codekey/privacy-pipeline.js` (追加, ~60行) (预估: 25 min)
- [ ] 1.12 创建 `privacy-pipeline.js` — 过滤日志记录 (仅本地 OutputChannel, 不发送到手机) — 文件: `extension/codekey/privacy-pipeline.js` (追加, ~30行) (预估: 15 min)
- [ ] 1.13 创建 `relay-client.js` — WebSocket 连接管理 (连接/断开/心跳 15s ping / 45s timeout) — 文件: `extension/codekey/relay-client.js` (新建, ~80行) (预估: 25 min)
- [ ] 1.14 创建 `relay-client.js` — 消息收发 (JSON 序列化, type 路由分发, 回调注册) — 文件: `extension/codekey/relay-client.js` (追加, ~50行) (预估: 20 min)
- [ ] 1.15 创建 `relay-client.js` — 指数退避重连 (5s/10s/30s/60s, 最多 10 次, 超 5min 降级) — 文件: `extension/codekey/relay-client.js` (追加, ~60行) (预估: 25 min)
- [ ] 1.16 创建 `handler.js` — ApprovalBridge 核心类: 会话管理 + 请求队列 — 文件: `extension/codekey/handler.js` (新建, ~80行) (预估: 30 min)
- [ ] 1.17 创建 `handler.js` — 审批请求处理: 创建请求 -> 加密 -> relay 发送 -> 等待响应 — 文件: `extension/codekey/handler.js` (追加, ~90行) (预估: 30 min)
- [ ] 1.18 创建 `handler.js` — 超时管理 (可配置 timeout + timeoutBehavior deny/allow, 30s 前提醒) — 文件: `extension/codekey/handler.js` (追加, ~60行) (预估: 25 min)
- [ ] 1.19 创建 `handler.js` — 多设备广播 + 竞态处理 (首个响应采纳, 其余取消) — 文件: `extension/codekey/handler.js` (追加, ~50行) (预估: 25 min)
- [ ] 1.20 创建 `bridge-entry.js` — HTTP 服务器 (127.0.0.1:${port}, REST API 路由) — 文件: `extension/codekey/bridge-entry.js` (新建, ~80行) (预估: 30 min)
- [ ] 1.21 创建 `bridge-entry.js` — API 端点: GET /v1/health, GET /v1/sessions — 文件: `extension/codekey/bridge-entry.js` (追加, ~40行) (预估: 20 min)
- [ ] 1.22 创建 `bridge-entry.js` — API 端点: POST /v1/hook, GET /v1/attached-sessions, POST /v1/message, POST /v1/pair — 文件: `extension/codekey/bridge-entry.js` (追加, ~60行) (预估: 25 min)
- [ ] 1.23 创建 `bridge-entry.js` — 子进程生命周期: process.send('ready'), SIGTERM 优雅关闭, 崩溃信号 — 文件: `extension/codekey/bridge-entry.js` (追加, ~50行) (预估: 25 min)
- [ ] 1.24 创建 `bridge-entry.js` — 定时任务: 每 60s 协调同步, 每 5min 清理过期会话/密钥 — 文件: `extension/codekey/bridge-entry.js` (追加, ~30行) (预估: 20 min)
- [ ] 1.25 创建 `index.js` — 模块统一入口, 导出所有公共 API — 文件: `extension/codekey/index.js` (新建, ~50行) (预估: 15 min)
- [ ] 1.26 检查 `crypto` 模块 — 验证仅使用 Node.js 内建 `crypto` 模块, 零外部依赖 — 文件: `extension/codekey/crypto.js` (预估: 10 min)

---

### Phase 2: extension.js 注入 (依赖 Phase 1)

> 在 extension.js 末尾注入 CodeKey Bridge Manager、权限拦截器、命令注册、postMessage 桥接。
> 注入位置: L76883 之后 (VoiceBridge 命令注册 IIFE 的 `})();` 之后)
> 预估合计: ~5.5h

- [ ] 2.1 注入 Bridge Manager: 依赖引入 (child_process, path, fs) + 常量定义 (BRIDGE_PORT=3001) — 文件: `extension/extension.js` (末尾追加, ~30行) (预估: 15 min)
- [ ] 2.2 注入 Bridge Manager: `loadCredentials()` — 从 `~/.codekey/credentials.json` 加载, fallback 到 VS Code SecretStorage — 文件: `extension/extension.js` (末尾追加, ~40行) (预估: 25 min)
- [ ] 2.3 注入 Bridge Manager: `startBridge()` — `child_process.fork(bridge-entry.js)`, 环境变量注入 deviceToken + port — 文件: `extension/extension.js` (末尾追加, ~50行) (预估: 25 min)
- [ ] 2.4 注入 Bridge Manager: `stopBridge()` — SIGTERM -> 5s 超时 -> SIGKILL, 清理 healthCheck interval — 文件: `extension/extension.js` (末尾追加, ~30行) (预估: 20 min)
- [ ] 2.5 注入 Bridge Manager: 崩溃重启逻辑 (指数退避 1s/2s/4s/8s, 最多 5 次, 超限后降级) — 文件: `extension/extension.js` (末尾追加, ~40行) (预估: 25 min)
- [ ] 2.6 注入 Bridge Manager: 暴露 `globalThis._codekeyBridge` 对象 — 文件: `extension/extension.js` (末尾追加, ~15行) (预估: 15 min)
- [ ] 2.7 注入 canUseTool 拦截器: 包装原函数, 检查 codekey.enabled 开关 — 文件: `extension/extension.js` (末尾追加, ~30行) (预估: 25 min)
- [ ] 2.8 注入 canUseTool 拦截器: YOLO 模式检测 (bypassPermissions 时不拦截) — 文件: `extension/extension.js` (末尾追加, ~25行) (预估: 20 min)
- [ ] 2.9 注入 canUseTool 拦截器: neverPushTools 过滤 (默认不推送 Read 操作) — 文件: `extension/extension.js` (末尾追加, ~20行) (预估: 15 min)
- [ ] 2.10 注入 canUseTool 拦截器: 请求序列化 -> 隐私过滤 -> 加密 -> POST /v1/hook -> 等待响应 — 文件: `extension/extension.js` (末尾追加, ~50行) (预估: 30 min)
- [ ] 2.11 注入 AskUserQuestion 拦截器: 包装原 handler, 仅在 YOLO + askUserQuestion=true 时触发 — 文件: `extension/extension.js` (末尾追加, ~40行) (预估: 25 min)
- [ ] 2.12 注入 AskUserQuestion 拦截器: 问题 + 选项序列化 push 到手机, 等待回答 — 文件: `extension/extension.js` (末尾追加, ~30行) (预估: 20 min)
- [ ] 2.13 注入 processRequest 路由扩展: 在现有 N5.prototype.processRequest 拦截中追加 `codekey_pair`/`codekey_status`/`codekey_approve` 分支 — 文件: `extension/extension.js` (行内编辑, L76719 附近, ~30行) (预估: 25 min)
- [ ] 2.14 注入 VS Code 命令注册: `xingji.codekey.showPairing`, `xingji.codekey.showDevices` — 文件: `extension/extension.js` (末尾追加, ~25行) (预估: 20 min)
- [ ] 2.15 注入 VS Code 命令注册: `xingji.codekey.showHistory`, `xingji.codekey.toggle` — 文件: `extension/extension.js` (末尾追加, ~25行) (预估: 20 min)
- [ ] 2.16 注入 postMessage 状态同步: 将 codekey 状态 (连接/设备/审批) 通过 webview postMessage 发送 — 文件: `extension/extension.js` (末尾追加, ~30行) (预估: 20 min)
- [ ] 2.17 注入 deactivate 钩子: 扩展停用时关闭 Bridge, 清理定时器 — 文件: `extension/extension.js` (末尾追加, ~20行) (预估: 15 min)
- [ ] 2.18 验证注入位置正确: 所有代码在 `})();` 之后追加, 不修改原有闭包 — 文件: `extension/extension.js` (预估: 15 min)

---

### Phase 3: Webview UI 注入 (依赖 Phase 1, 可与 Phase 2 并行)

> 在 webview/index.js 尾部注入 CodeKey UI 组件, 在 index.css 尾部追加样式。
> 注入位置: webview/index.js L213882 之后, index.css L376 之后
> 预估合计: ~4.5h

- [ ] 3.1 注入 index.css: `.xj-codekey-card` 基础卡片样式 (背景 `rgba(255,255,255,0.05)`, 边框, 圆角 8px, 内边距 12px) — 文件: `extension/webview/index.css` (末尾追加, ~20行) (预估: 15 min)
- [ ] 3.2 注入 index.css: `.xj-codekey-pair` 配对码卡片样式 (大号配对码文字、倒计时、刷新按钮) — 文件: `extension/webview/index.css` (末尾追加, ~25行) (预估: 20 min)
- [ ] 3.3 注入 index.css: `.xj-codekey-connected` 已连接设备状态卡片样式 (在线指示器绿色点、设备名称) — 文件: `extension/webview/index.css` (末尾追加, ~20行) (预估: 15 min)
- [ ] 3.4 注入 index.css: `.xj-codekey-approval` 审批通知卡片样式 (等待动画、倒计时、命令显示区域) — 文件: `extension/webview/index.css` (末尾追加, ~30行) (预估: 20 min)
- [ ] 3.5 注入 index.css: 设备管理面板样式 (列表项、解绑按钮、在线/离线状态色) — 文件: `extension/webview/index.css` (末尾追加, ~25行) (预估: 20 min)
- [ ] 3.6 注入 index.css: 审批历史面板样式 (时间轴、决策标签 approve/deny/timeout 颜色) — 文件: `extension/webview/index.css` (末尾追加, ~20行) (预估: 15 min)
- [ ] 3.7 注入 index.css: 动画定义 + 响应式断点 + `.vscode-light` 亮色主题适配 — 文件: `extension/webview/index.css` (末尾追加, ~15行) (预估: 15 min)
- [ ] 3.8 注入 index.js: CodeKey 状态管理对象 `codeKeyState` (connected, deviceName, pairingCode, pendingApprovals[]) — 文件: `extension/webview/index.js` (尾部追加, ~30行) (预估: 20 min)
- [ ] 3.9 注入 index.js: `createPairingCard()` — Canvas 二维码渲染 (不含外部图片依赖) + 6 位配对码显示 + 倒计时 — 文件: `extension/webview/index.js` (尾部追加, ~60行) (预估: 30 min)
- [ ] 3.10 注入 index.js: `createConnectedCard()` — 已连接设备状态 + 最后同步时间 + 断开按钮 — 文件: `extension/webview/index.js` (尾部追加, ~30行) (预估: 20 min)
- [ ] 3.11 注入 index.js: `createApprovalCard()` — 审批请求卡片 (工具名称/参数/命令、等待动画、已等待秒数) — 文件: `extension/webview/index.js` (尾部追加, ~40行) (预估: 25 min)
- [ ] 3.12 注入 index.js: `createDevicePanel()` — 设备管理面板 (设备列表、在线状态指示、解绑按钮、手动刷新) — 文件: `extension/webview/index.js` (尾部追加, ~50行) (预估: 25 min)
- [ ] 3.13 注入 index.js: `createHistoryPanel()` — 审批历史面板 (最近 50 条, 时间/工具/决策/回复内容) — 文件: `extension/webview/index.js` (尾部追加, ~40行) (预估: 25 min)
- [ ] 3.14 注入 index.js: `window.addEventListener('message')` 统一消息监听 (codekey_state, codekey_approval, codekey_pairing_code) — 文件: `extension/webview/index.js` (尾部追加, ~30行) (预估: 20 min)
- [ ] 3.15 注入 index.js: MutationObserver DOM 注入器 (等待 webview DOM ready 后插入 UI 卡片) — 文件: `extension/webview/index.js` (尾部追加, ~30行) (预估: 20 min)
- [ ] 3.16 注入 index.js: 所有 UI 注入代码用 IIFE 包裹 (避免变量污染混淆代码作用域) — 文件: `extension/webview/index.js` (尾部追加, ~5行) (预估: 10 min)

---

### Phase 4: package.json 配置与构建脚本 (依赖 Phase 2/3 确定注入标识符)

> 注册 VS Code 配置项、命令, 更新 build.bat 验证逻辑。
> 预估合计: ~2h

- [ ] 4.1 注册配置项: `claudeCode.codekey.enabled` (boolean, default false), `claudeCode.codekey.relayServer` (string) — 文件: `extension/package.json` (contributes.configuration.properties 追加) (预估: 15 min)
- [ ] 4.2 注册配置项: `claudeCode.codekey.bridgePort` (number, default 3001), `claudeCode.codekey.timeout` (number, 30-600, default 120) — 文件: `extension/package.json` (追加) (预估: 15 min)
- [ ] 4.3 注册配置项: `claudeCode.codekey.timeoutBehavior` (enum deny/allow, default deny), `claudeCode.codekey.privacyFilterEnabled` (boolean, default true) — 文件: `extension/package.json` (追加) (预估: 15 min)
- [ ] 4.4 注册配置项: `claudeCode.codekey.maxDevices` (number, 1-10, default 5), `claudeCode.codekey.neverPushTools` (array, default ["Read"]) — 文件: `extension/package.json` (追加) (预估: 15 min)
- [ ] 4.5 注册命令: `xingji.codekey.showPairing`, `xingji.codekey.showDevices`, `xingji.codekey.showHistory`, `xingji.codekey.toggle` — 文件: `extension/package.json` (contributes.commands 追加) (预估: 15 min)
- [ ] 4.6 注册 activationEvents: `onCommand:xingji.codekey.*` — 文件: `extension/package.json` (activationEvents 追加) (预估: 10 min)
- [ ] 4.7 更新 build.bat [1/4] 语法检查: 增加 `extension/codekey/*.js` 文件的 `node -c` 检查 — 文件: `build.bat` (L13 之后追加) (预估: 20 min)
- [ ] 4.8 更新 build.bat [4/4] 验证: 增加 CodeKey Bridge Manager 注入检测 (`findstr "CodeKey Bridge Manager"`) — 文件: `build.bat` (L54 之后追加) (预估: 15 min)
- [ ] 4.9 更新 build.bat [4/4] 验证: 增加 CodeKey webview UI 注入检测 (`findstr "xj-codekey-card"`) — 文件: `build.bat` (追加) (预估: 10 min)
- [ ] 4.10 更新 build.bat [4/4] 验证: 增加 CodeKey CSS 注入检测 (`findstr "xj-codekey"`) + codekey N5 route 检测 (`findstr "codekey_pair"`) + codekey 目录存在检测 — 文件: `build.bat` (追加) (预估: 15 min)

---

### Phase 5: Hook 脚本系统 (依赖 Phase 1, 可与 Phase 2/3 并行)

> 创建 Claude Code Hook 脚本 + 自动安装器, 将 Agent 事件推送到手机。
> 预估合计: ~3h

- [ ] 5.1 创建 `codekey_hook_bash.js` — PostToolUse(Bash) 钩子: 读取 stdin JSON -> 提取命令和执行结果 -> POST /v1/hook — 文件: `extension/codekey/hooks/codekey_hook_bash.js` (新建, ~30行) (预估: 20 min)
- [ ] 5.2 创建 `codekey_hook_permission.js` — PreToolUse 阻塞式权限钩子: 读取 stdin -> POST /v1/hook (blocking模式) -> 等待 HTTP 响应 -> stdout 输出 yes/no — 文件: `extension/codekey/hooks/codekey_hook_permission.js` (新建, ~45行) (预估: 25 min)
- [ ] 5.3 创建 `codekey_hook_file.js` — PostToolUse(Write/Edit) 钩子: 文件修改后通知手机 (文件路径 + 修改摘要) -> POST /v1/hook — 文件: `extension/codekey/hooks/codekey_hook_file.js` (新建, ~30行) (预估: 20 min)
- [ ] 5.4 创建 `codekey_hook_notification.js` — Notification 钩子: Claude 状态变更通知 (idle/working/error) -> POST /v1/hook — 文件: `extension/codekey/hooks/codekey_hook_notification.js` (新建, ~25行) (预估: 15 min)
- [ ] 5.5 创建 `codekey_hook_stop.js` — Stop 钩子: Agent 完成/停止通知 -> POST /v1/hook — 文件: `extension/codekey/hooks/codekey_hook_stop.js` (新建, ~20行) (预估: 15 min)
- [ ] 5.6 语法检查所有 hook 脚本 (`node -c`) — 文件: `extension/codekey/hooks/*.js` (预估: 10 min)
- [ ] 5.7 创建 `hook-installer.js` — 读取工作区 `.claude/settings.local.json`, 合并而非覆盖现有 hooks — 文件: `extension/codekey/hook-installer.js` (新建, ~60行) (预估: 30 min)
- [ ] 5.8 创建 `hook-installer.js` — 检测 hook 冲突 (用户已有同名 hook 时提示) — 文件: `extension/codekey/hook-installer.js` (追加, ~30行) (预估: 20 min)
- [ ] 5.9 注入 hook-installer 到 extension.js: 在扩展激活时根据 `autoInstallHooks` 配置决定是否安装 — 文件: `extension/extension.js` (末尾追加, ~25行) (预估: 20 min)
- [ ] 5.10 注入 hook-installer 到 extension.js: 监听工作区切换事件, 自动为新工作区安装 hooks — 文件: `extension/extension.js` (末尾追加, ~20行) (预估: 15 min)
- [ ] 5.11 注册配置项: `claudeCode.codekey.autoInstallHooks` (boolean, default true) + `claudeCode.codekey.requireApproval` (boolean, default true) — 文件: `extension/package.json` (追加) (预估: 15 min)

---

### Phase 6: 集成与验证 (所有 Phase 完成后)

> 构建、安装、功能验证、向后兼容测试。本 Phase 全部完成后 P0 核心闭环即验收通过。
> 预估合计: ~4h

**构建验证**:

- [ ] 6.1 语法检查: 所有新建 `extension/codekey/*.js` 文件 (node -c 无错误) — 文件: `extension/codekey/**/*.js` (预估: 15 min)
- [ ] 6.2 语法检查: `extension/extension.js` 注入后 (node -c 无错误) — 文件: `extension/extension.js` (预估: 10 min)
- [ ] 6.3 语法检查: `extension/webview/index.js` 注入后 (node -c 无错误) — 文件: `extension/webview/index.js` (预估: 10 min)
- [ ] 6.4 运行 `build.bat` 全流程: 确认 [1/4] 语法检查 [2/4] 打包 [3/4] 安装 [4/4] 验证全部通过 — 文件: `build.bat` (预估: 15 min)
- [ ] 6.5 确认 build.bat 输出中包含 11 项 `[OK]` 验证 (原有 7 项 + 新增 4 项 CodeKey) — 文件: `build.bat` (预估: 10 min)

**安装与激活验证**:

- [ ] 6.6 安装 VSIX 后重启 VS Code, 确认扩展激活无报错 (检查 OutputChannel "星迹的CC") — (预估: 15 min)
- [ ] 6.7 验证 CodeKey 功能默认关闭: `claudeCode.codekey.enabled` = false, Bridge 不启动, 无网络请求 — (预估: 10 min)
- [ ] 6.8 开启 CodeKey 开关 (`claudeCode.codekey.enabled` = true), 确认 Bridge Manager 日志输出 `[CodeKey] Bridge manager loaded` — (预估: 10 min)
- [ ] 6.9 首次启动: 无 `~/.codekey/credentials.json` 时, Bridge 不启动, 无报错, 提示需要配对 — (预估: 10 min)
- [ ] 6.10 关闭 CodeKey 开关后, 确认 Bridge 进程退出, relay 连接断开, 无残留进程 — (预估: 10 min)

**核心功能验证**:

- [ ] 6.11 手动测试: 配对流程 — 执行 `xingji.codekey.showPairing` 命令 -> webview 显示配对码 -> 手机扫码完成配对 — (预估: 25 min)
- [ ] 6.12 手动测试: 配对码过期 — 等待 120 秒 -> 验证二维码消失 -> "重新生成"按钮可用 -> 生成新配对码 — (预估: 15 min)
- [ ] 6.13 手动测试: 工具权限审批 — default 模式 -> AI 执行 Write -> canUseTool 拦截 -> 手机收到通知 -> 批准 -> AI 继续 — (预估: 20 min)
- [ ] 6.14 手动测试: 工具权限拒绝 + 回复 — 手机点击拒绝 -> 输入回复消息 -> AI 收到拒绝原因 -> webview 显示附言 — (预估: 20 min)
- [ ] 6.15 手动测试: AskUserQuestion 远程回答 — YOLO + askUserQuestion=true -> AI 提问 -> 手机看到问题 -> 选择选项 -> AI 收到答案 — (预估: 20 min)
- [ ] 6.16 手动测试: YOLO 模式不推送 — bypassPermissions 模式 -> AI 自动执行工具 -> 手机不收到任何通知 (除 AskUserQuestion) — (预估: 15 min)
- [ ] 6.17 手动测试: 设备离线降级 — 断网或关闭手机 -> AI 执行需要审批的操作 -> webview 显示 "手机不在线" -> 回退到 VS Code 内置 UI — (预估: 15 min)
- [ ] 6.18 手动测试: 隐私过滤 — AI 编辑含 `API_KEY=sk-abc123` 的文件 -> 手机端看到 `API_KEY=[已过滤-API密钥]` -> 本地日志记录完整过滤信息 — (预估: 20 min)
- [ ] 6.19 手动测试: 审批超时 — 设置 timeout=60s, timeoutBehavior=deny -> 手机不响应 -> 60 秒后自动拒绝 -> webview 显示 "审批超时, 自动拒绝" — (预估: 15 min)

**向后兼容验证**:

- [ ] 6.20 清空 localStorage CodeKey 数据 -> 重启扩展 -> 确认无报错, 所有原有功能正常 — (预估: 15 min)
- [ ] 6.21 验证原有功能: TTS 语音朗读 (Edge/Gemini/Qwen/MiMo) — (预估: 10 min)
- [ ] 6.22 验证原有功能: VoiceBridge 浏览器语音输入 — (预估: 10 min)
- [ ] 6.23 验证原有功能: Pre-Send 预发送 + Loop 循环模式 — (预估: 15 min)
- [ ] 6.24 验证原有功能: 设置面板 (语音引擎选择、API Key 配置) — (预估: 10 min)
- [ ] 6.25 E2E 加密验证: 手机与 PC 完成 ECDH 密钥交换 -> 发送测试消息 -> relay 端抓包确认 payload 为 base64 密文 -> 手机解密成功 — (预估: 20 min)
- [ ] 6.26 构建产物检查: 确认 VSIX 包大小增量 < 100KB, extension.js 增量 < 30KB, webview/index.js 增量 < 15KB — (预估: 10 min)

---

### Phase 7: P1 体验完善 (依赖 P0 全部完成)

> 隐私管线完整实现、审批超时优化、网络恢复、设备管理 UI、错误恢复、向后兼容加固。
> 可与 Phase 8 部分任务并行 (P2 的审批历史 UI 和设备管理 UI 有重叠)
> 预估合计: ~7h

**隐私管线完整实现** (US-6, AC-9):

- [ ] 7.1 增强 `privacy-pipeline.js`: 支持更多敏感模式 (AWS key, GitHub token, JWT, connection string, private key PEM) — 文件: `extension/codekey/privacy-pipeline.js` (追加, ~40行) (预估: 25 min)
- [ ] 7.2 增强 `privacy-pipeline.js`: 用户自定义过滤规则 (通过 `claudeCode.codekey.customFilterRules` 配置项, JSON 数组) — 文件: `extension/codekey/privacy-pipeline.js` (追加, ~30行) (预估: 20 min)
- [ ] 7.3 注册配置项: `claudeCode.codekey.customFilterRules` (array of {pattern, replacement}) — 文件: `extension/package.json` (追加) (预估: 10 min)
- [ ] 7.4 注入 extension.js: 隐私过滤日志输出到 OutputChannel "星迹的CC - CodeKey" (仅本地, 不上传) — 文件: `extension/extension.js` (末尾追加, ~25行) (预估: 20 min)

**审批超时优化** (US-7, AC-11):

- [ ] 7.5 增强审批超时: 超时前 30 秒 webview 显示红色倒计时警告 (区别于正常等待态) — 文件: `extension/webview/index.js` (尾部追加, ~20行) (预估: 20 min)
- [ ] 7.6 增强审批超时: 超时后审批历史记录标记 "超时" 状态 (区分于主动拒绝) — 文件: `extension/codekey/handler.js` (追加, ~15行) (预估: 15 min)
- [ ] 7.7 增强审批超时: 超时响应中 `interrupt: false` (不中断 Agent, 让其继续) — 文件: `extension/extension.js` (编辑注入代码, ~10行) (预估: 10 min)

**网络恢复** (US-8, AC-13):

- [ ] 7.8 增强 WebSocket 重连: 断开时 webview postMessage 通知显示 "手机连接已断开" — 文件: `extension/codekey/relay-client.js` (追加, ~15行) + `extension/extension.js` (追加, ~15行) (预估: 20 min)
- [ ] 7.9 增强 WebSocket 重连: 本地请求队列 (最多 5 个), 重连成功后重新推送 — 文件: `extension/codekey/handler.js` (追加, ~40行) (预估: 25 min)
- [ ] 7.10 增强 WebSocket 重连: 累计断开超 5 分钟自动降级为本地审批, webview 显示提示 — 文件: `extension/codekey/relay-client.js` (追加, ~20行) + `extension/webview/index.js` (追加, ~15行) (预估: 20 min)

**设备管理 UI 完整化** (US-4):

- [ ] 7.11 增强设备管理面板: 显示设备在线/离线状态 (基于 relay 心跳), 最后活跃时间 — 文件: `extension/webview/index.js` (追加, ~30行) (预估: 20 min)
- [ ] 7.12 增强设备管理面板: 解绑确认对话框 + 解绑后清除 localStorage 对应设备数据 — 文件: `extension/webview/index.js` (追加, ~25行) (预估: 20 min)
- [ ] 7.13 增强设备管理面板: 手动刷新按钮 (主动查询 relay 设备状态) — 文件: `extension/webview/index.js` (追加, ~15行) (预估: 15 min)

**错误恢复与可靠性**:

- [ ] 7.14 Bridge 崩溃自动重启: 崩溃计数 + 5 次/10min 限流, 超限后停止重启并通知用户 — 文件: `extension/extension.js` (编辑注入代码, ~30行) (预估: 25 min)
- [ ] 7.15 Bridge 崩溃日志: 记录到 OutputChannel "星迹的CC - CodeKey" + stderr 输出捕获 — 文件: `extension/extension.js` (追加, ~20行) (预估: 20 min)
- [ ] 7.16 端口冲突检测: 启动时检测端口占用, 自动递增 (3001->3002->3003) — 文件: `extension/extension.js` (编辑 Bridge Manager, ~25行) (预估: 20 min)
- [ ] 7.17 localStorage 持久化: 配对信息、设备列表、审批历史写入 localStorage, webview reload 后恢复 — 文件: `extension/codekey/pairing.js` (追加, ~30行) + `extension/webview/index.js` (追加, ~20行) (预估: 25 min)

**配置项完整性**:

- [ ] 7.18 验证所有 8+2 个配置项读写正常: 通过 VS Code Settings UI 修改 -> 运行时立即生效 (无需重启) — (预估: 20 min)
- [ ] 7.19 `neverPushTools` 配置项支持动态更新: 运行时修改后立即生效, 无需重启 Bridge — 文件: `extension/extension.js` (编辑注入代码, ~15行) (预估: 15 min)

---

### Phase 8: P2 锦上添花 (依赖 P1 全部完成)

> 审批历史 UI、多设备竞态、手机端品牌化、审批统计、macOS/Linux 兼容、CI 验证。
> 预估合计: ~7h

**审批历史 UI** (US-12):

- [ ] 8.1 审批历史数据存储: handler.js 中维护最近 50 条记录的环形缓冲区 — 文件: `extension/codekey/handler.js` (追加, ~30行) (预估: 20 min)
- [ ] 8.2 审批历史 UI 完整实现: 时间轴列表 (时间、工具名、决策标签、回复预览) — 文件: `extension/webview/index.js` (追加/完善, ~40行) (预估: 25 min)
- [ ] 8.3 审批历史筛选: 按时间范围 (今天/本周/本月) 筛选 — 文件: `extension/webview/index.js` (追加, ~30行) (预估: 25 min)
- [ ] 8.4 审批历史详情: 点击记录展开完整 payload (审批请求原文 + 响应内容) — 文件: `extension/webview/index.js` (追加, ~25行) (预估: 20 min)

**多设备同时审批** (AC-12):

- [ ] 8.5 多设备广播: handler.js 中遍历所有在线设备发送审批请求 — 文件: `extension/codekey/handler.js` (追加, ~25行) (预估: 20 min)
- [ ] 8.6 竞态处理: 首个设备响应被采纳 -> 向其余设备发送 cancel 通知 -> 其余设备卡片消失 — 文件: `extension/codekey/handler.js` (追加, ~35行) (预估: 25 min)
- [ ] 8.7 竞态 UI: webview 显示 "等待审批 (2 台设备在线)" -> 响应后显示 "由 iPhone 15 Pro 批准" — 文件: `extension/webview/index.js` (追加, ~20行) (预估: 20 min)

**手机端品牌化** (US-11):

- [ ] 8.8 手机端卡片样式更新: 使用 `design-tokens.md` 中的品牌色 (`#e8a040` 主色, `#4ec9b0` 成功色, `#f14c4c` 拒绝色) — 文件: `extension/codekey/handler.js` (修改消息模板, ~30行) (预估: 25 min)
- [ ] 8.9 手机端卡片标题: 显示 "星迹的CC" 品牌名 + Chat 上下文摘要 (用户最后一条消息截断, 最多 50 字) — 文件: `extension/codekey/handler.js` (追加, ~25行) (预估: 20 min)

**审批统计**:

- [ ] 8.10 统计数据收集: handler.js 中维护 counters (total/approved/denied/timeout, 平均响应时间) — 文件: `extension/codekey/handler.js` (追加, ~30行) (预估: 20 min)
- [ ] 8.11 统计 API: GET /v1/stats 端点返回统计数据 — 文件: `extension/codekey/bridge-entry.js` (追加, ~20行) (预估: 15 min)
- [ ] 8.12 统计 UI: webview 设置面板中显示批准率/拒绝率/平均响应时间 (简单文本展示) — 文件: `extension/webview/index.js` (追加, ~25行) (预估: 20 min)

**免打扰模式**:

- [ ] 8.13 免打扰模式: 配置项 `claudeCode.codekey.dnd.enabled` + `dnd.schedule` (时间段定义) — 文件: `extension/package.json` (追加) + `extension/extension.js` (追加, ~25行) (预估: 25 min)
- [ ] 8.14 免打扰模式: 时间段内自动降级为本地审批, webview 显示 "免打扰模式" 标识 — 文件: `extension/webview/index.js` (追加, ~15行) (预估: 20 min)

**跨平台兼容**:

- [ ] 8.15 macOS 兼容: 验证 `~/.codekey/credentials.json` 路径解析正确 (HOME vs USERPROFILE) — 文件: `extension/codekey/bridge-entry.js` (修改, ~5行) (预估: 15 min)
- [ ] 8.16 Linux 兼容: 验证 child_process.fork 路径 + SIGTERM 信号处理 — 文件: `extension/extension.js` (编辑, ~10行) (预估: 15 min)
- [ ] 8.17 在 macOS 上运行 build.bat 等价脚本 (或手动步骤) 验证语法检查通过 — (预估: 20 min)

**CI 与文档**:

- [ ] 8.18 CI 自动语法检查: 在 GitHub Actions 中增加 `node -c` 验证所有 codekey 文件 (仅语法, 不运行) — (预估: 20 min)
- [ ] 8.19 自定义过滤规则 UI: webview 设置面板中可编辑正则列表 (输入框 + 添加/删除按钮) — 文件: `extension/webview/index.js` (追加, ~35行) (预估: 25 min)
- [ ] 8.20 relay 自建指南: 在手机端小程序中支持配置自定义 relay 地址 (复用 CodeKey 已有功能, 仅验证可用) — (预估: 20 min)

---

## 验收检查清单 (跨越所有 Phase)

完成所有 Phase 后, 确认以下验收标准全部通过:

| 编号 | 验收标准 | 对应任务 | 状态 |
|------|---------|---------|------|
| AC-1 | 设备配对成功流程 (QR + 配对码 -> 密钥交换 -> 设备列表) | 6.11, 6.12 | [ ] |
| AC-2 | 配对码超时 + 重新生成 | 6.12 | [ ] |
| AC-3 | 工具权限远程审批 - 批准 | 6.13 | [ ] |
| AC-4 | 工具权限远程审批 - 拒绝带回复 | 6.14 | [ ] |
| AC-5 | AskUserQuestion 远程审批 | 6.15 | [ ] |
| AC-6 | YOLO 模式不推送普通工具调用 | 6.16 | [ ] |
| AC-7 | 设备离线降级 | 6.17 | [ ] |
| AC-8 | CodeKey 功能关闭完全不加载 | 6.7, 6.10 | [ ] |
| AC-9 | 隐私内容过滤 | 6.18 | [ ] |
| AC-10 | E2E 加密验证 | 6.25 | [ ] |
| AC-11 | 审批超时自动处理 | 6.19 | [ ] |
| AC-12 | 多设备同时审批竞态 | 8.5, 8.6 | [ ] |
| AC-13 | WebSocket 重连恢复 | 7.8, 7.9, 7.10 | [ ] |
| AC-14 | 构建验证 (build.bat 全部通过) | 6.4, 6.5 | [ ] |
| AC-15 | 向后兼容 (无 CodeKey 数据的用户升级) | 6.20, 6.21, 6.22, 6.23, 6.24 | [ ] |

---

## 附录: 文件变更汇总

### 新建文件 (13 个)

| 文件 | 预估行数 | Phase |
|------|---------|-------|
| `extension/codekey/types.js` | ~80 | Phase 1 |
| `extension/codekey/crypto.js` | ~200 | Phase 1 |
| `extension/codekey/pairing.js` | ~150 | Phase 1 |
| `extension/codekey/privacy-pipeline.js` | ~150 | Phase 1 |
| `extension/codekey/relay-client.js` | ~200 | Phase 1 |
| `extension/codekey/handler.js` | ~280 | Phase 1 |
| `extension/codekey/bridge-entry.js` | ~260 | Phase 1 |
| `extension/codekey/index.js` | ~50 | Phase 1 |
| `extension/codekey/hook-installer.js` | ~90 | Phase 5 |
| `extension/codekey/hooks/codekey_hook_bash.js` | ~30 | Phase 5 |
| `extension/codekey/hooks/codekey_hook_permission.js` | ~45 | Phase 5 |
| `extension/codekey/hooks/codekey_hook_file.js` | ~30 | Phase 5 |
| `extension/codekey/hooks/codekey_hook_notification.js` | ~25 | Phase 5 |
| `extension/codekey/hooks/codekey_hook_stop.js` | ~20 | Phase 5 |

### 修改文件 (4 个)

| 文件 | 注入位置 | 新增代码量 | Phase |
|------|---------|-----------|-------|
| `extension/extension.js` | L76883 之后 (末尾) | ~500 行 | Phase 2, 5 |
| `extension/webview/index.js` | L213882 之后 (末尾) | ~500 行 | Phase 3, 7, 8 |
| `extension/webview/index.css` | L376 之后 (末尾) | ~150 行 | Phase 3 |
| `extension/package.json` | contributes.configuration + commands | ~60 行 | Phase 4 |
| `build.bat` | 语法检查 + 验证步骤 | ~20 行 | Phase 4 |

### 不受影响的文件

- `extension/extension.js` L1-76882: Claude Code 核心 + 星迹已有注入 (TTS, VoiceBridge, PreSend, Loop)
- `extension/webview/index.js` L1-213881: Claude Code UI + 星迹已有注入 (TTS UI, Settings Panel)
- `extension/resources/`: 音频/图标资源
- `extension/claude-code-settings.schema.json`
- `extension/voice/`: 语音引擎模块
