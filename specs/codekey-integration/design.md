# CodeKey 集成 - 技术设计文档

**状态**: 草案
**版本**: 1.0
**日期**: 2026-07-21

---

## 1. 架构概述

### 1.1 集成架构全景图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  手机端 (CodeKey 小程序)                                                       │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐                │
│  │ 微信小程序      │  │ 飞书小程序         │  │ Telegram Mini App│                │
│  │ .ts/.wxml/wxss│  │                  │  │ React+Vite+TS   │                │
│  └──────┬───────┘  └────────┬─────────┘  └────────┬─────────┘                │
│         │                   │                      │                          │
│         └───────────────────┼──────────────────────┘                          │
│                             │ WebSocket (E2E AES-256-GCM)                     │
└─────────────────────────────┼────────────────────────────────────────────────┘
                              │
                   ┌──────────▼──────────┐
                   │  CodeKey Relay      │  ← 复用官方 wss://codekey.tinymoney.cn/ws
                   │  + PostgreSQL 17    │     (可配置自建)
                   └──────────┬──────────┘
                              │ WebSocket (E2E AES-256-GCM)
                              │
┌─────────────────────────────┼────────────────────────────────────────────────┐
│  VS Code 扩展 (星迹的CC✨)                                                      │
│                             │                                                 │
│  ┌──────────────────────────▼───────────────────────────────────────────┐    │
│  │  Bridge 子进程 (fork/worker)                                           │    │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │    │
│  │  │ RelayClient      │  │ ApprovalBridge   │  │ E2E Encryption       │ │    │
│  │  │ (WebSocket→Relay)│  │ (核心路由/逻辑)    │  │ (AES-256-GCM)        │ │    │
│  │  └─────────────────┘  └──────────────────┘  └──────────────────────┘ │    │
│  │  HTTP Server :3001 (REST API)                                          │    │
│  │  /v1/hook, /v1/sessions, /v1/health, /v1/attached-sessions            │    │
│  └───────────────────────────────────────────────────────────────────────┘    │
│                              │ HTTP (127.0.0.1:3001)                           │
│  ┌──────────────────────────▼───────────────────────────────────────────┐    │
│  │  extension.js (Node.js Extension Host)                                 │    │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │    │
│  │  │ [混淆核心 76K行] + [自定义注入 ~400行末尾]                         │ │    │
│  │  │  ├── TTS 引擎 (Edge/Qwen/MiMo/Gemini)                             │ │    │
│  │  │  ├── VoiceBridge HTTP Server (:9877)                              │ │    │
│  │  │  ├── N5.prototype.send 拦截                                      │ │    │
│  │  │  ├── N5.prototype.processRequest 拦截                             │ │    │
│  │  │  ├── hQ.prototype.setupPanel 拦截                                │ │    │
│  │  │  ├── CodeKey Bridge 启动器 (新增)                                 │ │    │
│  │  │  └── CodeKey Hook Loader (新增)                                   │ │    │
│  │  └──────────────────────────────────────────────────────────────────┘ │    │
│  │                              │ postMessage                              │    │
│  └──────────────────────────────┼──────────────────────────────────────────┘    │
│                                 │                                               │
│  ┌──────────────────────────────▼──────────────────────────────────────────┐    │
│  │  webview/index.js (Chromium Webview)                                     │    │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │    │
│  │  │ [混淆 React SPA 213K行]                                            │ │    │
│  │  │  ├── L1-6: acquireVsCodeApi shim (顶部注入)                       │ │    │
│  │  │  ├── L213349-213757: TTS 模块 (尾部注入)                           │ │    │
│  │  │  ├── L213759-213798: 设置按钮注入                                  │ │    │
│  │  │  ├── L213800+: 语音设置面板                                         │ │    │
│  │  │  └── CodeKey 手机绑定 UI (新增)                                    │ │    │
│  │  └────────────────────────────────────────────────────────────────────┘ │    │
│  └──────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心设计原则

1. **不修改混淆代码** -- 所有功能通过注入实现，不触及原有的 webpack/rollup 打包产物
2. **单插件交付** -- 用户只需安装星迹的CC，无需额外安装 CodeKey 扩展
3. **Bridge 独立进程** -- CodeKey Bridge 以子进程方式运行，崩溃不影响主扩展
4. **UI 风格统一** -- 手机端 UI 使用与 webview 一致的设计令牌
5. **保留现有功能** -- TTS、循环、预发送、语音桥接全部保持不变

---

## 2. 集成方式 (关键: 如何处理混淆代码)

### 2.1 现有注入架构

星迹的CC 基于 Claude Code 官方的 webpack 混淆产物，**没有源码**。所有自定义功能通过注入实现。

**extension.js 结构** (76,883 行):
```
L1-76700:   webpack 打包的 Claude Code 核心 (完全混淆，不可修改)
L76700+:    所有自定义注入代码

注入入口:
  L76453:   // ═══ 星迹的CC 多引擎语音合成 (移植自 AI Voice Studio) ═══
  L76701:   N5.prototype.send 拦截 (TTS 触发)
  L76719:   N5.prototype.processRequest 拦截 (自定义命令路由)
  L76750:   VS Code 命令注册 (xingji.*)
  L76814:   // ═══ 星迹的CC 浏览器语音桥接 (VoiceBridge) ═══
  L76838:   VoiceBridge 启动逻辑 + 命令注册
```

**webview/index.js 结构** (213,882 行):
```
L1-6:      acquireVsCodeApi 缓存 shim (顶部注入)
L7-213348: webpack 打包的 React SPA
L213349+:  所有自定义注入代码

注入入口:
  L213349:  /* ===== VOICE TTS MODULE (星迹的CC 语音朗读) ===== */
  L213759:  /* ===== 星迹的CC 设置按钮注入 ===== */
  L213800:  /* ===== 星迹的CC 语音设置面板 ===== */
```

### 2.2 CodeKey 集成策略: 注入 + 独立文件

```
策略分级:
┌─────────────────────────────────────────────────────────────────────────┐
│ Tier 1: 注入到 extension.js 末尾 (约200行)                                │
│   - Bridge 子进程启动/管理 (spawn)                                        │
│   - Hook 脚本安装器                                                       │
│   - CodeKey 配置项注册                                                    │
│   - N5.prototype.processRequest 增加 codekey_* 路由                       │
│   - VS Code 命令注册 (pairDevice, showCodeKeyDashboard)                    │
├─────────────────────────────────────────────────────────────────────────┤
│ Tier 2: 注入到 webview/index.js 末尾 (约150行)                             │
│   - 手机绑定 QR/配对码 UI 组件                                             │
│   - 权限审批通知卡片                                                       │
│   - CodeKey 状态指示器                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ Tier 3: 独立新文件 (约800行)                                               │
│   - extension/codekey/bridge-entry.js   (Bridge 入口脚本)                  │
│   - extension/codekey/relay-client.js   (WebSocket 中继客户端)             │
│   - extension/codekey/e2e.js            (AES-256-GCM 加密)                │
│   - extension/codekey/handler.js        (ApprovalBridge 核心逻辑)         │
│   - extension/codekey/hooks/            (Claude Code Hook 脚本)            │
│   - extension/codekey/privacy-pipeline.js (隐私管线)                      │
│   - extension/webview/index.css          (追加 CodeKey 样式,约50行)        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 关键约束

| 约束 | 说明 | 影响 |
|------|------|------|
| 混淆代码不可修改 | webpack 产物，变量名如 `N5`/`hQ`/`M6` 可能在更新后变化 | 注入代码必须防御性访问，使用 `typeof` 检查 |
| 注入顺序依赖 | 注入代码在文件末尾，依赖前面的变量定义 | 所有注入用 `setTimeout` 延迟执行，确保初始化完成 |
| 单文件无 IIFE | extension.js 是单作用域压缩，注入代码可直接访问所有变量 | 变量作用域冲突风险 -- 注入代码需用 IIFE 包裹 |
| VS Code 版本绑定 | 依赖性 `M6` (=vscode module) | 不需要改变，CodeKey 不依赖特定 VS Code API |
| 7 种注入模式验证 | build.bat L47-54 验证所有注入模式存在 | 新增注入后必须更新验证列表 |

---

## 3. Bridge 进程集成

### 3.1 Bridge 子进程架构

CodeKey Bridge 以独立 Node.js 子进程运行，通过 HTTP (127.0.0.1:3001) 与 extension.js 通信。

```
extension.js 中的 CodeKeyBridgeManager:
┌──────────────────────────────────────────────────────┐
│  startBridge():                                       │
│    1. 检查 ~/.codekey/credentials.json                │
│    2. child_process.fork('codekey/bridge-entry.js')   │
│    3. 等待子进程 ready 信号                            │
│    4. 启动定时健康检查 (30s)                            │
│                                                       │
│  stopBridge():                                        │
│    1. GET /v1/health → 确认存活                        │
│    2. child.kill('SIGTERM')                           │
│    3. 5 秒后 kill('SIGKILL')                          │
│                                                       │
│  getBridgeUrl() → 'http://127.0.0.1:3001'             │
└──────────────────────────────────────────────────────┘
```

### 3.2 Bridge 入口脚本: `extension/codekey/bridge-entry.js`

**移植自**: `codekey/packages/vscode/src/bridge-entry.ts`

```
功能:
  1. 创建 RelayClient (WebSocket → wss://codekey.tinymoney.cn/ws)
  2. 创建 ApprovalBridge 实例
  3. 设置 E2E 加密密钥 (基于 deviceToken 派生)
  4. 启动 HTTP Server (127.0.0.1:3001)
  5. 暴露 REST API:
     GET  /v1/health              → { status, uptime, sessions }
     GET  /v1/sessions            → [{ id, name, attached, lastActivity }]
     POST /v1/hook                → 接收 Claude Code Hook 回调
     GET  /v1/attached-sessions   → [{ sessionId, processPid, terminalId }]
  
  定时任务:
    - 每 60s: 协调与会话同步
    - 每 5min: 清理过期会话/密钥
```

**关键实现细节**:
- 读取凭证: 从 `~/.codekey/credentials.json` 加载 `deviceToken`，fallback 到 VS Code SecretStorage
- E2E 密钥派生: `PBKDF2(deviceToken, salt='codekey-v2', iterations=100000, keylen=32)`
- 进程间通信: `process.send({ type:'ready' })` + `process.on('message', ...)`

### 3.3 注入到 extension.js 的 Bridge 管理器

**注入位置**: extension.js 末尾，L76883 之后（VoiceBridge 命令注册之后）

**注入内容** (约120行):

```javascript
// ═══ CodeKey Bridge Manager ═══
(function(){
  'use strict';
  var child_process = require('child_process');
  var path = require('path');
  var fs = require('fs');
  
  var BRIDGE_PORT = 3001;
  var bridgeProcess = null;
  var healthCheckInterval = null;
  
  // 凭证管理
  function loadCredentials(callback) {
    var credPath = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.codekey', 'credentials.json'
    );
    fs.readFile(credPath, 'utf8', function(err, data) {
      if (err) {
        // fallback: VS Code SecretStorage (通过 N5 comm 获取)
        callback(null); return;
      }
      try { callback(JSON.parse(data)); }
      catch(e) { callback(null); }
    });
  }
  
  // 启动 Bridge
  function startBridge(callback) {
    if (bridgeProcess) { callback(null, bridgeProcess); return; }
    
    loadCredentials(function(cred) {
      if (!cred || !cred.deviceToken) {
        console.log('[CodeKey] No credentials, bridge not started');
        callback(new Error('No credentials')); return;
      }
      
      var extPath = globalThis._xingjiExtContext 
        ? globalThis._xingjiExtContext.extensionPath 
        : path.join(__dirname, '..');
      var entryPath = path.join(extPath, 'codekey', 'bridge-entry.js');
      
      bridgeProcess = child_process.fork(entryPath, [], {
        env: Object.assign({}, process.env, {
          CODEKEY_DEVICE_TOKEN: cred.deviceToken,
          CODEKEY_BRIDGE_PORT: String(BRIDGE_PORT),
          CODEKEY_CREDENTIALS_DIR: path.dirname(
            path.join(process.env.HOME||process.env.USERPROFILE,'.codekey','credentials.json')
          )
        }),
        silent: true
      });
      
      bridgeProcess.on('message', function(msg) {
        if (msg && msg.type === 'ready') callback(null, bridgeProcess);
      });
      bridgeProcess.on('exit', function(code) {
        console.log('[CodeKey] Bridge exited:', code);
        bridgeProcess = null;
        clearInterval(healthCheckInterval);
      });
      
      // 超时处理
      setTimeout(function() {
        if (bridgeProcess && !bridgeProcess.connected) {
          callback(new Error('Bridge startup timeout'));
        }
      }, 10000);
    });
  }
  
  // 暴露到全局
  globalThis._codekeyBridge = {
    start: startBridge,
    get port() { return BRIDGE_PORT; },
    get running() { return bridgeProcess !== null; }
  };
  
  console.log('[CodeKey] Bridge manager loaded');
})();
```

### 3.4 依赖清单

Bridge 子进程需要的 npm 依赖:

| 依赖 | 用途 | 是否可内联 |
|------|------|-----------|
| `ws` | WebSocket 客户端 | 必须打包 (VS Code 无此内建模块) |
| `uuid` | 消息 ID 生成 | 可用 `crypto.randomUUID()` 替代 |
| `crypto` | AES-256-GCM 加密 | Node.js 内建，无需额外依赖 |

**策略**: 将 `ws` 库打包进 `codekey/` 目录，或使用 esbuild 将 bridge-entry.js 及其依赖打包为单文件。

---

## 4. Webview 侧边栏集成

### 4.1 集成目标

在现有的 Claude Code webview 侧边栏中增加 CodeKey 手机绑定界面和权限审批卡片。

### 4.2 UI 组件设计

#### 4.2.1 手机绑定状态指示器

**位置**: 会话列表区域顶部或右上角，设置按钮旁边

**注入方式**: MutationObserver 监听 DOM 变化，在标题栏区域插入

```
┌─────────────────────────────────────────┐
│  [≡] 星迹的CC✨          [⚙] [📱] [历史] │  ← 标题栏
│                                         │
│  ┌─ 手机连接状态 ────────────────────┐  │
│  │  📱 已连接: iPhone 15 Pro         │  │  ← 状态卡片
│  │  上次同步: 2 分钟前                │  │
│  │  [断开连接]                        │  │
│  └────────────────────────────────────┘  │
│                                         │
│  或:                                    │
│  ┌─ 绑定手机 ────────────────────────┐  │
│  │  🔑 配对码: A1B2C3               │  │  ← 配对码卡片
│  │  在 CodeKey 小程序中输入此码       │  │
│  │  [刷新配对码]                      │  │
│  └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

#### 4.2.2 权限审批通知卡片

**位置**: 聊天流中插入，类似 Diff 审批卡片

**注入方式**: 拦截 `io_message` 类型的 `permission_request` 消息，动态创建 DOM 元素

```
┌─────────────────────────────────────────┐
│  Claude 请求: 执行终端命令               │
│  ═══════════════════════════════════════ │
│  $ git push origin main                  │
│  ─────────────────────────────────────── │
│  ⏳ 等待手机端审批... (已发送 3s)         │  ← 审批状态
│  ─────────────────────────────────────── │
│  [强制超时执行]                           │
└─────────────────────────────────────────┘
```

### 4.3 注入实现

**文件**: `extension/webview/index.js` 末尾 (L213826 之后)

**注入内容** (约150行):

```javascript
/* ===== CodeKey 手机绑定模块 ===== */
(function(){
  'use strict';
  
  // 状态管理
  var codeKeyState = {
    connected: false,
    deviceName: null,
    pairingCode: null,
    lastSync: null,
    pendingApprovals: []
  };
  
  // ===== 配对码卡片 =====
  function createPairingCard() {
    var card = document.createElement('div');
    card.className = 'xj-codekey-card xj-codekey-pair';
    card.innerHTML = [
      '<div class="xj-ck-title">绑定手机</div>',
      '<div class="xj-ck-code" id="xj-ck-code">----</div>',
      '<div class="xj-ck-hint">在 CodeKey 小程序中输入此配对码</div>',
      '<button class="xj-ck-btn" id="xj-ck-refresh">刷新配对码</button>'
    ].join('');
    return card;
  }
  
  // ===== 已连接状态卡片 =====
  function createConnectedCard(deviceName, lastSync) {
    var card = document.createElement('div');
    card.className = 'xj-codekey-card xj-codekey-connected';
    card.innerHTML = [
      '<div class="xj-ck-title">手机连接状态</div>',
      '<div class="xj-ck-device">已连接: ' + (deviceName || '未知设备') + '</div>',
      '<div class="xj-ck-sync">上次同步: ' + (lastSync || '刚刚') + '</div>',
      '<button class="xj-ck-btn xj-ck-disconnect">断开连接</button>'
    ].join('');
    return card;
  }
  
  // ===== 权限审批卡片 =====
  function createApprovalCard(requestData) {
    var card = document.createElement('div');
    card.className = 'xj-codekey-card xj-codekey-approval';
    card.setAttribute('data-approval-id', requestData.id);
    
    var command = requestData.command || requestData.description || '';
    var elapsed = Math.floor((Date.now() - requestData.sentAt) / 1000);
    
    card.innerHTML = [
      '<div class="xj-ck-title">Claude 请求: ' + (requestData.title || '执行操作') + '</div>',
      '<div class="xj-ck-cmd">' + escapeHtml(command) + '</div>',
      '<div class="xj-ck-wait">等待手机端审批... (已发送 ' + elapsed + 's)</div>',
      '<button class="xj-ck-btn xj-ck-force">强制超时执行</button>'
    ].join('');
    return card;
  }
  
  function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  
  // ===== 观察 DOM 注入时机 =====
  function injectCodeKeyUI() {
    // 插入状态卡片 (尝试多个可能的位置)
    var sessionsList = document.querySelector('[class*="sessions"]') 
      || document.querySelector('[class*="history"]')
      || document.querySelector('#root > div:first-child');
    
    if (sessionsList && !document.querySelector('.xj-codekey-card')) {
      var container = sessionsList.parentElement || sessionsList;
      container.insertBefore(
        codeKeyState.connected 
          ? createConnectedCard(codeKeyState.deviceName, codeKeyState.lastSync)
          : createPairingCard(),
        sessionsList
      );
    }
  }
  
  // ===== 消息监听 =====
  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (!msg) return;
    
    // 处理来自 extension 的 CodeKey 消息
    if (msg.type === 'codekey_state') {
      codeKeyState = Object.assign(codeKeyState, msg.state);
      // 重新渲染状态卡片
      var oldCard = document.querySelector('.xj-codekey-card');
      if (oldCard) oldCard.remove();
      injectCodeKeyUI();
    }
    
    if (msg.type === 'codekey_approval') {
      // 在聊天区插入审批卡片
      var chatArea = document.querySelector('[class*="messages"]') 
        || document.querySelector('[class*="chat"]')
        || document.querySelector('#root');
      if (chatArea) {
        chatArea.appendChild(createApprovalCard(msg.request));
      }
    }
  });
  
  // ===== 初始化 =====
  setTimeout(injectCodeKeyUI, 500);
  setTimeout(injectCodeKeyUI, 2000);
  
  var mo = new MutationObserver(function() {
    if (!document.querySelector('.xj-codekey-card')) injectCodeKeyUI();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  
  console.log('[CodeKey] Webview module loaded');
})();
```

---

## 5. Hook 脚本安装

### 5.1 Claude Code Hook 机制

Claude Code 支持通过 `.claude/settings.json` 配置 hooks，在特定事件触发时执行外部脚本:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node /path/to/hook.js" }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "node /path/to/notification.js" }
        ]
      }
    ]
  }
}
```

### 5.2 CodeKey 需要拦截的 Hook 事件

| Hook 事件 | 用意 | 对应脚本 |
|-----------|------|---------|
| `PostToolUse` (Bash) | 终端命令执行后通知手机 | `codekey_hook_bash.js` |
| `PostToolUse` (Write/Edit) | 文件修改后通知手机 | `codekey_hook_file.js` |
| `PreToolUse` (Bash) | 高权限命令执行前请求审批 | `codekey_hook_permission.js` |
| `Notification` | Claude 状态变更通知手机 | `codekey_hook_notification.js` |
| `Stop` | Agent 完成/停止通知手机 | `codekey_hook_stop.js` |

### 5.3 Hook 脚本安装器

**注入位置**: extension.js 末尾，Bridge 管理器之前

**实现方式**: 在扩展激活时，自动将 hook 配置写入当前工作区的 `.claude/settings.local.json`

```javascript
// codekey/hook-installer.js (注入到 extension.js)
var CODEKEY_HOOKS = {
  "PostToolUse": [
    {
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "node \"${EXT_PATH}/codekey/hooks/codekey_hook_bash.js\""
      }]
    },
    {
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node \"${EXT_PATH}/codekey/hooks/codekey_hook_file.js\""
      }]
    }
  ],
  "Notification": [
    {
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node \"${EXT_PATH}/codekey/hooks/codekey_hook_notification.js\""
      }]
    }
  ],
  "Stop": [
    {
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node \"${EXT_PATH}/codekey/hooks/codekey_hook_stop.js\""
      }]
    }
  ]
};
```

### 5.4 Hook 脚本清单

```
extension/codekey/hooks/
  codekey_hook_bash.js          # 终端命令执行后 → POST /v1/hook
  codekey_hook_permission.js    # 高权限命令 → POST /v1/hook (blocking)
  codekey_hook_file.js          # 文件修改 → POST /v1/hook
  codekey_hook_notification.js  # 状态通知 → POST /v1/hook
  codekey_hook_stop.js          # Agent 停止 → POST /v1/hook
```

每个 hook 脚本都是轻量的 (~30行)，通过 HTTP 调用 Bridge 的 `/v1/hook` 端点。

---

## 6. 手机端风格同步

### 6.1 设计目标

CodeKey 的三个手机端 (微信小程序、飞书小程序、Telegram Mini App) 的 UI 风格需与星迹的CC webview 保持一致。

### 6.2 风格映射

从星迹的CC 的 CSS 和 HTML 中提取的设计元素:

| 元素 | 星迹的CC 中 | CodeKey 手机端中 |
|------|-----------|------------------|
| 主色调 | `#e8a040` (琥珀金) | 主按钮、高亮文字、焦点边框 |
| 辅助色 | `#4ec9b0` (青绿) | 成功状态、确认按钮、链接 |
| 错误色 | `#f14c4c` / `#f48771` (珊瑚) | 危险操作、拒绝按钮、错误提示 |
| 背景色 | `#1e1e1e` (深灰) | 主背景 |
| 文字色 | `#cccccc` (浅灰) | 正文 |
| 暗文字 | `#888` | 辅助说明文字 |
| 金色文字 | `#FFD700` | 强调/奖品文字 |
| 渐变 | `#e0a860` | 次要高亮 |
| 圆角 | `4px / 6px / 8px` | 卡片、按钮、输入框 |
| 字体 | system-ui | 系统默认字体 |
| 间距 | `--app-spacing-*` | 使用 rem 比例 |

### 6.3 具体同步方案

#### 微信小程序样式覆盖

在 `apps/miniprogram/app.wxss` 中定义全局 CSS 变量:

```css
page {
  /* 主色调 - 与星迹的CC 保持一致 */
  --ck-primary: #e8a040;
  --ck-primary-light: rgba(232, 160, 64, 0.2);
  --ck-primary-border: rgba(232, 160, 64, 0.35);
  
  /* 辅助色 */
  --ck-success: #4ec9b0;
  --ck-success-light: rgba(78, 201, 176, 0.2);
  --ck-success-border: rgba(78, 201, 176, 0.35);
  
  /* 危险色 */
  --ck-danger: #f14c4c;
  --ck-danger-light: rgba(241, 76, 76, 0.2);
  --ck-danger-border: rgba(241, 76, 76, 0.35);
  
  /* 中性色 */
  --ck-bg-primary: #1e1e1e;
  --ck-bg-secondary: rgba(255, 255, 255, 0.05);
  --ck-bg-input: #333;
  
  --ck-text-primary: #cccccc;
  --ck-text-secondary: #888;
  --ck-text-highlight: #FFD700;
  
  /* 圆角 */
  --ck-radius-sm: 4px;
  --ck-radius-md: 6px;
  --ck-radius-lg: 8px;
  
  /* 间距 (基于 8pt 网格) */
  --ck-space-xs: 4px;
  --ck-space-sm: 8px;
  --ck-space-md: 12px;
  --ck-space-lg: 16px;
  --ck-space-xl: 24px;
}
```

#### Telegram Mini App 样式映射

Telegram Mini App 使用 React + CSS 变量，直接在 `:root` 中定义相同的令牌系统。

### 6.4 组件风格对齐检查清单

| 组件 | 星迹的CC webview | CodeKey mobile | 对齐方式 |
|------|-----------------|---------------|---------|
| 按钮 (primary) | `background: #e8a040` | 直接复用色值 | CSS 变量映射 |
| 按钮 (danger) | `color: #f14c4c; border-color: #f48771` | 直接复用色值 | CSS 变量映射 |
| 卡片 | `background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px` | 直接复用 | 相同 CSS |
| 输入框 | `background: #333; color: #ccc; border-color: rgba(255,255,255,0.25)` | 直接复用色值 | CSS 变量映射 |
| 模态框 | `background: #1e1e2e; border: 1px solid #333; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.3)` | 直接复用 | 相同 CSS |
| loading | `@keyframes spin` 旋转动画 | 统一 spin 动画 | 相同 keyframes |

---

## 7. 设计令牌提取 (从星迹的CC CSS 到 CodeKey 手机端)

### 7.1 完整设计令牌表

从 `extension/webview/index.css` (375行 / 382KB, minified) 中提取:

#### 7.1.1 品牌色系

```
#e8a040    — 主色 (琥珀金): 按钮、高亮、焦点、loading 外圈
#4ec9b0    — 成功色 (青绿): 确认按钮、完成状态、进度条
#f14c4c    — 拒绝色 (珊瑚红): 拒绝按钮、错误、删除
#f48771    — 警告色 (浅珊瑚): 危险边框、警告图标
#FFD700    — 强调色 (金色): 特殊高亮、状态强调
#e0a860    — 渐变尾色 (浅金色): hover 态渐变
#cccccc    — 正文色 (浅灰): 主文字
#888       — 辅助色 (中灰): 次要文字、占位符
#1e1e1e    — 背景色 (深灰): 主背景
#333       — 输入背景色: 输入框、卡片内层
```

#### 7.1.2 CSS 设计令牌 (暗色主题默认值)

```css
:root {
  /* 品牌色 */
  --ck-orange: #d97757;
  --ck-clay-orange: #c6613f;
  --ck-ivory: #faf9f5;
  --ck-slate: #141413;
  
  /* 自定义注入色 */
  --ck-primary: #e8a040;
  --ck-success: #4ec9b0;
  --ck-danger: #f14c4c;
  --ck-warning: #f48771;
  --ck-highlight: #FFD700;
  
  /* 间距 */
  --ck-space-xs: 4px;
  --ck-space-sm: 8px;
  --ck-space-md: 12px;
  --ck-space-lg: 16px;
  
  /* 圆角 */
  --ck-radius-sm: 4px;
  --ck-radius-md: 6px;
  --ck-radius-lg: 8px;
  
  /* 字体 */
  --ck-font-mono: var(--vscode-editor-font-family, monospace);
  --ck-font-size: var(--vscode-editor-font-size, 12px);
  
  /* 前景色 */
  --ck-fg-primary: #cccccc;
  --ck-fg-secondary: #888;
  --ck-fg-highlight: #FFD700;
  
  /* 背景色 */
  --ck-bg-primary: #1e1e2e;
  --ck-bg-secondary: rgba(255, 255, 255, 0.05);
  --ck-bg-input: #333;
  --ck-bg-overlay: rgba(0, 0, 0, 0.5);
  
  /* 边框色 */
  --ck-border-default: rgba(255, 255, 255, 0.25);
  --ck-border-primary: rgba(232, 160, 64, 0.35);
  --ck-border-success: rgba(78, 201, 176, 0.35);
  --ck-border-danger: rgba(241, 76, 76, 0.35);
  
  /* 阴影 */
  --ck-shadow-modal: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

### 7.2 各平台实现方式

| 平台 | 实现方式 | 文件位置 |
|------|---------|---------|
| 微信小程序 | `page { }` 中的自定义属性 | `apps/miniprogram/app.wxss` |
| 飞书小程序 | 飞书 CSS 变量语法 | `apps/feishu-miniprogram/app.css` |
| Telegram Mini App | CSS 自定义属性 `:root { }` | `apps/telegram-miniapp/src/index.css` |
| Bridge 管理页面 | 内联 `<style>` (与 VoiceBridge 同模式) | 注入到 extension.js 的 HTML 模板 |

---

## 8. 数据流

### 8.1 核心通信路径

```
路径 A: 终端命令通知 (异步)
┌─────────┐   Hook     ┌──────────────┐  HTTP POST  ┌──────────┐  WebSocket  ┌────────┐
│ Claude   │ ────────→ │ hook_bash.js  │ ─────────→ │ Bridge    │ ─────────→ │ Relay  │
│ (执行Bash)│  PostTool  │ (进程退出)     │ /v1/hook   │ :3001     │   E2E     │ Server │
└─────────┘            └──────────────┘             └──────────┘            └────┬───┘
                                                                                 │
                                                                     ┌───────────▼───┐
                                                                     │ 手机小程序       │
                                                                     │ 显示: 命令执行   │
                                                                     └───────────────┘

路径 B: 权限审批 (同步阻塞)
┌─────────┐   Hook     ┌───────────────────┐  HTTP POST  ┌──────────┐
│ Claude   │ ────────→ │ hook_permission.js │ ─────────→ │ Bridge    │
│ (请求权限)│  PreTool   │ (阻塞stdin,等待)   │ /v1/hook   │ :3001     │
└─────────┘            └───────────────────┘             └─────┬────┘
                                                               │ WebSocket (E2E)
                                                    ┌──────────▼────┐
                                                    │ 手机小程序       │
                                                    │ 弹出审批按钮     │
                                                    │ [通过] [拒绝]    │
                                                    └──────┬────────┘
                                                           │ WebSocket (E2E)
                                              ┌────────────▼────────┐
                                              │ Bridge → approval   │
                                              │ hook 返回 yes/no    │
                                              │ → Claude 继续/拒绝  │
                                              └─────────────────────┘

路径 C: 手机发送消息到 Agent
┌─────────┐  WebSocket  ┌──────────┐  polling    ┌──────────┐  注入 N5.send  ┌────────┐
│ 手机小程序│ ─────────→ │ Relay    │ ─────────→ │ Bridge    │ ───────────→ │ Claude  │
│ (用户输入)│   E2E      │ Server   │            │ :3001     │ transportMsg │ (Agent) │
└─────────┘             └──────────┘            └──────────┘              └────────┘
```

### 8.2 Bridge API 端点

| Method | Path | 功能 | 调用方 |
|--------|------|------|--------|
| GET | `/v1/health` | 健康检查 + 状态 | extension.js (定时) |
| GET | `/v1/sessions` | 活跃会话列表 | extension.js (查询) |
| POST | `/v1/hook` | Hook 事件回调 | Hook 脚本 |
| GET | `/v1/attached-sessions` | 已绑定的 Claude Code 会话 | extension.js |
| POST | `/v1/message` | 向 Agent 发送消息 | extension.js (来自手机的转发) |
| POST | `/v1/pair` | 生成/刷新配对码 | extension.js → Bridge |

### 8.3 N5.prototype.processRequest 新增路由

在现有的注入点 (extension.js L76719) 中增加 CodeKey 路由:

```javascript
// 在 N5.prototype.processRequest 的 if/else 链中增加:
if (req && req.request && req.request.type === 'codekey_pair') {
  var code = globalThis._codekeyBridge.generatePairingCode();
  return { type: 'codekey_pair_response', success: true, code: code };
}
if (req && req.request && req.request.type === 'codekey_status') {
  var status = {
    connected: globalThis._codekeyBridge.isConnected(),
    deviceName: globalThis._codekeyBridge.getDeviceName()
  };
  return { type: 'codekey_status_response', success: true, status: status };
}
if (req && req.request && req.request.type === 'codekey_approve') {
  var result = globalThis._codekeyBridge.approveRequest(req.request.approvalId, req.request.decision);
  return { type: 'codekey_approve_response', success: true, result: result };
}
```

---

## 9. 安全考量

### 9.1 现有安全机制 (复用)

| 机制 | CodeKey 实现 | 集成后 |
|------|-------------|--------|
| E2E 加密 | AES-256-GCM, IV+ciphertext+tag | 完全复用, 不修改 |
| 设备令牌 | deviceToken 认证 | 复用, 存储在 `~/.codekey/credentials.json` |
| WebSocket 心跳 | 15s ping, 45s timeout | 完全复用 |
| 消息格式 | `base64(iv[12] + ciphertext + tag[16])` | 完全复用 |
| 隐私管线 | 敏感数据过滤 (API key, token 等) | 完全复用, `codekey/privacy-pipeline.js` |
| 风险引擎 | 命令风险等级评估 | 完全复用, `codekey/risk.js` |

### 9.2 新增安全考量

| 威胁 | 风险等级 | 缓解措施 |
|------|---------|---------|
| Bridge HTTP 端口暴露 | 中 | 绑定 127.0.0.1, 仅本地可访问 |
| Hook 脚本注入 | 高 | 脚本路径固定, 不接收外部输入, Hook 内容限制为转发 |
| 配对码暴力破解 | 低 | 6 位字母数字 (32 个字符集) = 10 亿可能性, 5 分钟过期 |
| credentials.json 泄露 | 中 | 文件权限 600, 内容仅含 deviceToken (非 API key) |
| Bridge 中间人攻击 | 低 | E2E 加密保护消息内容, 即使 Relay 被攻破也无法解密 |
| 内存中 token 泄漏 | 低 | Bridge 子进程隔离, 主进程不持有敏感 key |

### 9.3 权限审批安全规则

```javascript
// 高权限命令黑白名单
var HIGH_RISK_COMMANDS = [
  'rm -rf', 'git push --force', 'DROP TABLE', 'DELETE FROM',
  'chmod 777', 'sudo', 'eval', 'exec('
];

var LOW_RISK_COMMANDS = [
  'ls ', 'echo ', 'cat ', 'git status', 'git diff', 'npm test'
];
```

---

## 10. 文件变更清单

### 10.1 新增文件

```
extension/codekey/                           # CodeKey 核心 (约800行)
  bridge-entry.js                            # Bridge 子进程入口 (~200行)
  relay-client.js                            # WebSocket 中继客户端 (~80行)
  handler.js                                 # ApprovalBridge 核心逻辑 (~250行)
  e2e.js                                     # AES-256-GCM 加密 (~60行)
  privacy-pipeline.js                        # 隐私管线 (~100行)
  risk.js                                    # 风险等级引擎 (~60行)
  hooks/                                     # Claude Code Hook 脚本
    codekey_hook_bash.js                     # 终端命令通知 (~30行)
    codekey_hook_permission.js               # 权限审批阻塞 (~40行)
    codekey_hook_file.js                     # 文件修改通知 (~25行)
    codekey_hook_notification.js             # 状态变更通知 (~20行)
    codekey_hook_stop.js                     # Agent 停止通知 (~20行)

specs/codekey-integration/
  design.md                                  # 本文档
```

### 10.2 修改文件

| 文件 | 注入位置 | 新增代码量 | 变更类型 |
|------|---------|-----------|---------|
| `extension/extension.js` | L76883 之后 (文件末尾) | ~250行 | 注入 CodeKey Bridge Manager + 命令注册 + processRequest 路由扩展 |
| `extension/webview/index.js` | L213826 之后 (文件末尾) | ~200行 | 注入 CodeKey UI 模块 (绑定卡片 + 审批卡片 + 消息监听) |
| `extension/webview/index.css` | L376 之后 (文件末尾) | ~50行 | CodeKey UI 样式 (.xj-codekey-*) |
| `extension/package.json` | `contributes.configuration.properties` | ~20行 | 新增 CodeKey 配置项 |
| `extension/package.json` | `contributes.commands` | ~10行 | 新增 codekey 命令 |
| `build.bat` | L47-54 (验证列表) | ~5行 | 新增 CodeKey 注入模式验证 |

### 10.3 更新 build.bat 验证列表

在 `build.bat` L47-54 的验证列表后追加:

```batch
findstr /c:"CodeKey Bridge Manager" "%INSTALL_DIR%\extension.js" >nul && echo   [OK] CodeKey Bridge Manager
findstr /c:"codekey-card" "%INSTALL_DIR%\webview\index.js" >nul && echo   [OK] CodeKey webview UI
findstr /c:"xj-codekey" "%INSTALL_DIR%\webview\index.css" >nul && echo   [OK] CodeKey CSS
findstr /c:"codekey_pair" "%INSTALL_DIR%\extension.js" >nul && echo   [OK] CodeKey N5 route
```

---

## 11. 技术决策与权衡

| # | 决策 | 选项 | 选择 | 理由 |
|---|------|------|------|------|
| 1 | Bridge 进程模型 | A) 注入 extension.js 内联 | B) 独立子进程 | **B)** 隔离崩溃、独立内存、可单独重启 |
| 2 | npm 依赖处理 | A) 发布时 bundle | B) 运行时 npm install | **A)** 用户无需配置, 避免 npm 失败 |
| 3 | Hook 安装时机 | A) 扩展激活时自动安装 | B) 用户手动安装 | **A)** 零配置体验, 但需要用户确认覆盖 |
| 4 | 混淆对象访问 | A) 直接引用 N5/hQ | B) 反射/字符串查找 | **A)** 当前版本确定可用, 升级时增加 version guard |
| 5 | CSS 注入方式 | A) 追加到 index.css | B) webview 内联 <style> | **A)** 统一管理, build.bat 可验证 |
| 6 | 手机端主题 | A) 跟随 VS Code 主题动态切换 | B) 固定暗色主题 | **B)** 初期固定暗色, Phase 2 考虑主题同步 |
| 7 | Relay 服务器 | A) 使用官方 codekey.tinymoney.cn | B) 可配置自建 | **A)** 默认官方, 配置项可覆盖 |
| 8 | 隐私管线 | A) 完整移植 CodeKey 的 privacy-pipeline | B) 简化版只过滤 API key | **A)** 成熟代码, 安全第一 |
| 9 | 审批超时 | A) 30s 自动通过 | B) 永不超时 | **A)** 避免 Claude 永久卡住, 可配置 |
| 10 | 多设备支持 | A) 单手机 | B) 多手机同时 | **A)** 先单设备, 多设备为 Phase 3 |

### 11.1 为什么选择独立子进程而非内联

| 维度 | 内联注入 | 独立子进程 (选择) |
|------|---------|-----------------|
| 崩溃隔离 | 无 -- 主进程崩溃 | 有 -- 子进程独立 |
| 内存隔离 | 共享 Node.js 堆 | 独立内存空间 |
| 重启能力 | 需要重载扩展 | 单独 SIGTERM + fork |
| 调试 | 混在主进程日志中 | 独立 stdout/stderr |
| ws 依赖 | 必须打包进主 bundle | 独立依赖树 |
| 代码量 | 混入 76K 行文件 | 独立文件清晰 |

---

## 12. 风险与缓解

### 12.1 高风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| **官方 Claude Code 更新导致混淆变量名变化** | 中 | 高: N5/hQ/M6 全部失效 | 1) 加 version guard 检查 `package.json` 版本 2) 定期用测试套件验证注入点 3) 变量名通过特征匹配自动发现 |
| **WebSocket ws 库打包进 VS Code 扩展** | 中 | 中: 包体积增大 | 1) 使用 esbuild tree-shaking 2) 最小化 ws 库使用 3) 最终包体积增量 <100KB |
| **Bridge 子进程持续崩溃** | 低 | 中: 手机通知中断 | 1) 指数退避重试 (1s, 2s, 4s, 8s, 最多 5 次) 2) 崩溃限流 (5 次/10min → 停止自动重启) 3) 向用户显示错误提示 |

### 12.2 中风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| **Hook 安装冲突** | 中 | 中: 用户已有自定义 hook | 1) 合并而非覆盖现有 hooks 2) 提供 `claudeCode.codekey.autoInstallHooks` 开关关闭自动安装 3) 检测冲突并提示 |
| **端口 3001 占用** | 低 | 中: Bridge 无法启动 | 1) 检测端口占用, 自动递增 (3001→3002→3003) 2) 配置项 `claudeCode.codekey.bridgePort` 手动指定 |
| **E2E 密钥同步失败** | 低 | 中: 消息无法加解密 | 1) 密钥派生参数固定 (salt/iterations) 2) 测试覆盖密钥派生一致性 |
| **凭证文件丢失** | 低 | 低: 需要重新配对 | 1) 每次启动检查文件 2) 缺失时自动引导绑定流程 |

### 12.3 低风险

| 风险 | 概率 | 缓解措施 |
|------|------|---------|
| CSS 变量在手机端不支持 | 极低 | 微信/飞书/Telegram 均支持 CSS 变量 |
| 小程序审核拒绝 | 低 | 功能独立, 不是核心, 可条件编译移除 |
| Relay 服务器宕机 | 低 | 可配置自建 Relay 服务器 |
| 性能影响 (每 60s 协调) | 极低 | 纯本地 HTTP 调用, <5ms |

---

## 附录 A: 注入点完整映射表

| # | 文件 | 行号 | 注入方式 | 功能 | 标识符 |
|---|------|------|---------|------|--------|
| 1 | extension.js | L76453 | 末尾追加 (IIFE) | TTS 引擎 | `═══ 星迹的CC 多引擎语音合成 ═══` |
| 2 | extension.js | L76701 | 末尾追加 (IIFE) | N5.prototype.send 拦截 | N5/hQ intercept |
| 3 | extension.js | L76750 | 末尾追加 (setTimeout) | TTS/Voice 命令注册 | `xingji.toggleTTS` 等 |
| 4 | extension.js | L76814 | 末尾追加 (IIFE) | VoiceBridge 服务器 | `═══ 星迹的CC 浏览器语音桥接 ═══` |
| 5 | extension.js | L76838 | 末尾追加 (setTimeout) | VoiceBridge 命令注册 | `xingji.openVoiceBridge` |
| 6 | **extension.js** | **L76884+** | **末尾追加 (新)** | **CodeKey Bridge Manager** | **CodeKey integration** |
| 7 | webview/index.js | L1 | 顶部替换 | acquireVsCodeApi shim | `xingji vscode api shim` |
| 8 | webview/index.js | L213349 | 尾部追加 (IIFE) | TTS webview 模块 | `VOICE TTS MODULE` |
| 9 | webview/index.js | L213759 | 尾部追加 (IIFE) | 设置按钮注入 | `设置按钮注入` |
| 10 | webview/index.js | L213800 | 尾部追加 (IIFE) | 语音设置面板 | `语音设置面板` |
| 11 | **webview/index.js** | **L213826+** | **尾部追加 (新)** | **CodeKey UI 模块** | **CodeKey 手机绑定** |
| 12 | **index.css** | **L376+** | **尾部追加 (新)** | **CodeKey UI 样式** | **.xj-codekey-*** |
| 13 | **package.json** | **properties** | **新增配置项** | **CodeKey 配置** | **claudeCode.codekey.*** |
| 14 | **package.json** | **commands** | **新增命令** | **CodeKey 命令** | **codekey.*** |
| 15 | **build.bat** | **L54+** | **新增验证** | **CodeKey 注入验证** | **findstr codekey** |

## 附录 B: 构建流程变更

现有 `build.bat` 流程 (4 步):
```
[1/4] 语法检查 (node -c extension.js, webview/index.js)
[2/4] 打包 VSIX (vsce package)
[3/4] 安装到 VS Code (code --install-extension 或手动)
[4/4] 验证注入 (findstr × 7 种模式)
```

变更后增加第 [5/5] 步:
```
[5/5] CodeKey 组件验证
  - 确认 codekey/ 目录存在于已安装扩展中
  - 确认 bridge-entry.js 语法正确 (node -c)
  - 确认 hook 脚本语法正确 (node -c *.js)
  - 确认 14 种注入模式全部存在 (新增 4 种)
```

## 附录 C: CodeKey 配置项

```json
{
  "claudeCode.codekey.enabled": {
    "type": "boolean",
    "default": true,
    "description": "启用 CodeKey 手机远程控制功能。关闭后不会启动 Bridge 子进程。"
  },
  "claudeCode.codekey.relayServer": {
    "type": "string",
    "default": "wss://codekey.tinymoney.cn/ws",
    "description": "CodeKey 中继服务器 WebSocket 地址。可配置为自建服务器。"
  },
  "claudeCode.codekey.bridgePort": {
    "type": "number",
    "default": 3001,
    "description": "Bridge HTTP 服务器端口 (仅本地 127.0.0.1)。修改后需重启扩展。"
  },
  "claudeCode.codekey.autoInstallHooks": {
    "type": "boolean",
    "default": true,
    "description": "自动在工作区安装 CodeKey Hook 脚本。关闭后需手动配置 hooks。"
  },
  "claudeCode.codekey.requireApproval": {
    "type": "boolean",
    "default": true,
    "description": "高权限命令执行前需手机端审批。关闭后所有命令自动执行。"
  },
  "claudeCode.codekey.approvalTimeout": {
    "type": "number",
    "default": 30,
    "description": "权限审批超时时间 (秒)。超时后自动通过。"
  }
}
```
