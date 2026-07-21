# CodeKey 集成 - 需求文档

> 版本: 1.0 | 创建日期: 2026-07-21 | 状态: 草稿

---

## 1. 功能概述

将开源项目 [CodeKey](https://github.com/rockcen72/codekey)（Apache 2.0）的远程审批能力完整集成到星迹的CC 插件（publisher: `xingji`, ID: `xingji.xingjiclaudecode`）中，使用户无需安装两个独立插件即可通过手机远程审批 AI 代码代理的操作请求。

### 1.1 集成后目标架构

```
┌─────────────────────────────────────────────────────────────┐
│  VS Code Extension Host (Node.js)                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ extension.js (76,883 行)                                  ││
│  │   ├── L1-76150: Claude Code 核心代码 (混淆压缩)           ││
│  │   ├── L76151-76883: 星迹注入代码 (TTS/VoiceBridge)       ││
│  │   └── [L76883+]: CodeKey Bridge 注入 (NEW)               ││
│  ├── codekey/ (NEW)                                          ││
│  │   ├── bridge-server.js    # PC Bridge HTTP 服务           ││
│  │   ├── crypto.js           # E2E 加密 (AES-256-GCM+ECDH)  ││
│  │   ├── privacy-pipeline.js # 隐私扫描+内容过滤             ││
│  │   ├── permission-proxy.js # 权限请求拦截与转发            ││
│  │   └── pairing.js          # 设备配对管理                  ││
│  └── package.json                                            ││
├──────────────────────────────────────────────────────────────┤│
│  Webview (Chromium)                                          ││
│  ┌─────────────────────────────────────────────────────────┐││
│  │ webview/index.js (213,882 行)                             ││
│  │   ├── L1-213800: Claude Code UI (混淆压缩)                ││
│  │   ├── L213800-213882: 星迹 TTS UI/VSCode Shim (已有)     ││
│  │   └── [L213882+]: CodeKey UI 注入 (NEW)                  ││
│  │ webview/index.css                                         ││
│  │   └── [追加]: CodeKey 配对/审批 UI 样式 (NEW)            ││
│  └─────────────────────────────────────────────────────────┘││
├──────────────────────────────────────────────────────────────┤│
│  外部组件 (CodeKey 原项目复用)                                ││
│  ┌───────────────────┐  ┌────────────────────┐               ││
│  │ PC Bridge 进程     │  │ WebSocket Relay    │               ││
│  │ localhost:3001     │──│ codekey.tinymoney  │               ││
│  │ (HTTP+WebSocket)   │  │ .cn               │               ││
│  └───────────────────┘  └────────┬───────────┘               ││
│                                  │ WebSocket                 ││
│                          ┌───────┴──────────┐               ││
│                          │ 手机小程序         │               ││
│                          │ 微信/飞书/Telegram │               ││
│                          └──────────────────┘               ││
└──────────────────────────────────────────────────────────────┘
```

### 1.2 核心能力清单

| 编号 | 能力 | 来源 | 集成方式 |
|------|------|------|----------|
| C01 | PC Bridge 本地 HTTP 服务 (localhost:3001) | CodeKey | 独立模块注入 extension/ |
| C02 | WebSocket 中继连接 (codekey.tinymoney.cn) | CodeKey | 复用，配置化 relay 地址 |
| C03 | 设备配对 (二维码/配对码) | CodeKey | 复用协议，重写 UI |
| C04 | 手机端审批推送 (approve/deny/reply) | CodeKey | 复用 relay 协议 |
| C05 | E2E 加密 (AES-256-GCM + ECDH p256) | CodeKey | 独立模块，不修改 |
| C06 | 隐私管线 (本地密钥扫描 + 内容过滤) | CodeKey | 独立模块，不修改 |
| C07 | 权限请求拦截 (intercept canUseTool / AskUserQuestion) | 星迹 | 新增 monkey-patch |
| C08 | 审批 UI (webview 内嵌面板) | 新开发 | 符合星迹视觉风格 |
| C09 | 配对管理 UI (设备列表/解绑) | 新开发 | 符合星迹视觉风格 |
| C10 | 审批超时 + 自动降级 | 新开发 | 超时后 fallback 到本地审批 |

### 1.3 与现有功能的关系

- **YOLO 模式**: 当权限模式为 `bypassPermissions` 时，大多数操作不需要审批，CodeKey 仅在 AskUserQuestion 触发时进入远程审批流程
- **预发送 (Pre-Send)**: 无冲突 — 预发送管理消息发送时机，CodeKey 管理权限审批时机，两者在不同层面工作
- **循环模式**: 无冲突 — 循环模式复用预发送队列，与 CodeKey 无交互
- **TTS 语音**: 互补 — TTS 在本地朗读回复，CodeKey 在手机上审批，可共存
- **语音桥接**: 无冲突 — 浏览器语音与手机审批独立运行

---

## 2. 用户故事

### US-1: 首次配对新设备 (P0)

作为星迹的CC 用户，我希望在插件设置面板中点击"配对新设备"后，看到二维码和配对码，用手机扫码或输入配对码后即可完成绑定。

- 配对入口: VS Code 设置面板中的 CodeKey 配置区域，或底部状态栏图标
- 配对码: 6 位数字，有效期 120 秒
- 二维码: 以 Canvas 渲染在 webview 内，不依赖外部图片服务
- 配对成功后显示设备名称和绑定时间
- 支持绑定多个设备 (上限 5 个)
- 设备列表显示在线/离线状态

### US-2: 手机远程审批工具权限 (P0)

作为星迹的CC 用户，当 AI 需要执行文件写入/命令执行等操作且当前不在 YOLO 模式时，我希望手机收到通知卡片，我可以:
- 查看请求详情 (工具名称、参数、路径)
- 选择 **批准** (Approve) 或 **拒绝** (Deny)
- 输入 **回复消息** (Reply)，让 AI 根据我的反馈调整操作

同时，webview 界面显示"等待手机审批中..."状态，并有倒计时提示。

### US-3: 手机远程回复 AskUserQuestion (P0)

作为星迹的CC 用户，当 YOLO 模式下 AI 主动提问 (AskUserQuestion) 时，我希望手机收到问题卡片，我可以:
- 查看完整的提问内容
- 选择一个预设选项 (如果有)
- 输入自由文本回复
- 选择**跳过** (skip/allow without input)

### US-4: 管理已配对的设备 (P1)

作为星迹的CC 用户，我希望在设置面板中:
- 查看所有已配对设备的列表 (名称、平台、绑定时间、在线状态)
- 解绑某个设备
- 查看设备最后活跃时间
- 手动刷新设备在线状态

### US-5: E2E 加密保障 (P1 - 透明)

作为星迹的CC 用户，我不需要理解加密细节，但我希望知道:
- 所有传输到手机的数据都是端到端加密的
- 中继服务器无法解密我的代码或对话内容
- 每当成功配对时，视觉上应有"已加密"标识

### US-6: 隐私内容过滤 (P1 - 透明)

作为星迹的CC 用户，我不希望 .env、私钥文件、API token 等敏感内容被发送到手机上。系统应自动扫描并屏蔽:
- 环境变量值 (匹配 `KEY=value` 模式)
- API 密钥/Token (匹配常见格式如 `sk-*`, `AIzaSy*`, `ghp_*`)
- 私钥内容 (匹配 `-----BEGIN.*PRIVATE KEY-----` 块)
- 密码赋值 (匹配 `password=*`, `passwd=*`, `secret=*`)

### US-7: 超时自动处理 (P1)

作为星迹的CC 用户，当手机端长时间未响应时，我不希望 AI 永远卡住:
- 默认超时: 120 秒 (可配置 30-600 秒)
- 超时后行为: 可配置为 **自动拒绝** (安全优先) 或 **自动批准** (效率优先)
- 超时前 30 秒在手机和 webview 同时显示倒计时提醒
- 超时后 AI 继续执行，不再等待

### US-8: 网络断开恢复 (P1)

作为星迹的CC 用户，当网络连接不稳定时:
- WebSocket 断开时，webview 显示"手机连接已断开"提示
- 自动重连 (间隔 5s/10s/30s 退避策略，最多重试 10 次)
- 重连成功后，未处理的审批请求重新推送到手机
- 重连期间如果有新的权限请求，在本地排队 (最多 5 个)
- 如果重连失败超过 5 分钟，自动降级为本地审批

### US-9: 开关控制与即时回退 (P1)

作为星迹的CC 用户，我希望:
- 通过一个总开关控制 CodeKey 功能的启用/停用
- 关闭开关后，所有权限请求恢复为原有本地处理流程
- 不需要重启 VS Code 即可生效
- 开关状态持久化到 VS Code 设置

### US-10: 与 YOLO 模式的协同 (P0)

作为星迹的CC 用户，当我在 YOLO 模式 (bypassPermissions) 下运行时:
- 大部分工具调用不需要审批，也不会推送到手机
- 仅 AskUserQuestion 需要手机审批 (如果 `askUserQuestion` 设置为 true)
- 如果 `askUserQuestion` 关闭，YOLO 模式完全不需要手机参与

### US-11: 手机端视觉风格一致 (P2)

作为星迹的CC 用户，我希望手机小程序上的界面风格和 VS Code 中的星迹的CC 保持一致:
- 审批卡片使用星迹的CC 主题色 (深色背景 + 亮色强调)
- 卡片标题显示"星迹的CC"品牌名
- 卡片中显示 Chat 上下文摘要 (用户最后一条消息的截断)

### US-12: 审批历史查看 (P2)

作为星迹的CC 用户，我希望在 webview 中查看最近的审批历史:
- 最近 50 条审批记录
- 每条记录显示: 时间、工具名称、决策 (批准/拒绝/超时)、是否有回复
- 支持按时间筛选

---

## 3. 验收标准 (Given/When/Then)

### AC-1: 设备配对 - 成功流程

```
Given  用户已安装星迹的CC 2.1.95+CodeKey 集成版
  And  CodeKey 功能已开启
  And  未绑定任何设备
When   用户在设置面板点击"配对新设备"
Then   系统生成 6 位配对码并显示二维码
  And  二维码包含 relay 地址和配对码信息
  And  配对码有效期 120 秒，显示倒计时
When   用户在手机小程序中输入配对码
Then   手机与 PC Bridge 完成 ECDH 密钥交换
  And  设备列表中显示新设备 (名称、平台、在线状态)
  And  webview 显示配对成功提示
  And  localStorage 存储配对信息 (加密后的密钥)
```

### AC-2: 设备配对 - 超时与重试

```
Given  用户打开配对界面超过 120 秒
When   配对码过期
Then   二维码消失，显示"配对码已过期"
  And   显示"重新生成"按钮
When   用户点击"重新生成"
Then   生成新的 6 位配对码和二维码
  And  新的 120 秒倒计时开始
```

### AC-3: 工具权限远程审批 - 批准

```
Given  用户已绑定至少一台在线设备
  And  当前权限模式为 default (非 YOLO)
When   AI Agent 尝试执行 Write 操作
Then   extension.js 的 canUseTool 拦截该请求
  And   请求通过 PC Bridge → relay → 手机
  And   webview 显示"等待手机审批..."状态 + 倒计时
  And   手机收到通知卡片，显示工具名称和参数
When   用户在手机上点击"批准"
Then   手机发送批准响应 (通过 relay → PC Bridge)
  And   PC Bridge 将结果返回给 canUseTool
  And   AI Agent 继续执行操作
  And   webview 恢复为正常对话状态
```

### AC-4: 工具权限远程审批 - 拒绝带回复

```
Given  条件同 AC-3
When   用户在手机上点击"拒绝"
  And  用户输入回复消息 "不要修改这个文件，改成往 src/utils.ts 追加"
Then   响应中的 behavior 为 deny，message 包含用户回复
  And   AI Agent 收到拒绝 + 消息，可以据此调整行为
  And   webview 显示"手机已拒绝，附言: ..."
```

### AC-5: AskUserQuestion 远程审批

```
Given  权限模式为 bypassPermissions (YOLO)
  And  askUserQuestion 设置为 true
When   AI Agent 调用 AskUserQuestion 工具
Then   extension.js 的 AskUserQuestion handler 拦截该请求
  And   问题通过 relay 推送到手机
  And   手机显示问题卡片，包含完整问题文本和多选项 (如有)
When   用户在手机上选择一个选项并提交
Then   响应返回给 AI Agent 作为 answer
  And   AI 根据回答继续执行
```

### AC-6: YOLO 模式 - 不推送普通工具调用

```
Given  权限模式为 bypassPermissions (YOLO)
  And  CodeKey 功能已开启
When   AI Agent 尝试执行任何工具操作 (Write/Bash/Edit)
Then   请求不在 canUseTool 层面触发远程审批
  And   手机不收到任何通知
  And   AI 正常自动执行
```

### AC-7: 设备离线时的降级

```
Given  用户已绑定设备但所有设备均离线
  And  当前权限模式为 default
When   AI Agent 尝试执行工具操作
Then   webview 显示"手机不在线，使用本地审批"
  And   权限请求回退到 VS Code 内置 UI (原 permissionRequestContainer)
  And   不阻塞 AI 执行流程
  And   设备重新上线后的请求恢复为远程推送
```

### AC-8: CodeKey 功能关闭

```
Given  CodeKey 功能开关处于关闭状态
When   AI Agent 产生任何权限请求
Then   所有请求走原有本地审批流程
  And   PC Bridge 不启动
  And   relay 不连接
  And   没有任何网络请求发往外部
```

### AC-9: 隐私内容过滤

```
Given  隐私管线已启用
  And  AI Agent 请求编辑一个包含 API Key 的文件
When   请求内容中包含 "API_KEY=sk-abc123xyz"
Then   隐私管线将 sk-abc123xyz 替换为 "API_KEY=[已过滤-API密钥]"
  And   手机端看到的参数中不包含原始密钥值
  And   过滤日志记录到 VS Code OutputChannel (仅本地)
```

### AC-10: E2E 加密验证

```
Given  用户完成设备配对 (ECDH 密钥交换成功)
When   PC Bridge 向手机发送一条权限请求
Then   消息体使用 AES-256-GCM 加密，密钥为 ECDH 协商的 shared secret
  And   relay 服务器看到的 payload 为 base64 密文
  And   relay 服务器无法解密
  And   手机端用相同的 shared secret 解密成功
```

### AC-11: 审批超时自动处理

```
Given  超时时间设置为 120 秒
  And  超时行为设置为"自动拒绝"
When   AI Agent 发起权限请求并推送到手机
  And   手机端在 120 秒内未响应
Then   webview 显示"审批超时，自动拒绝"
  And   响应 behavior 为 deny, interrupt 为 false (不中断)
  And   AI Agent 继续执行 (或被拒绝后自行调整)
  And   审批历史记录中标记为"超时"
```

### AC-12: 多设备同时审批

```
Given  用户绑定了 2 台手机设备 (A 和 B)，均在线
When   AI Agent 发起权限请求
Then   两台手机同时收到通知卡片
When   设备 A 先点击"批准"
Then   设备 A 的响应被采纳
  And   设备 B 的通知卡片自动消失 (显示"已由其他设备处理")
  And   同一个权限请求不会产生重复响应
```

### AC-13: WebSocket 重连恢复

```
Given  PC Bridge 与 relay 的 WebSocket 连接断开
When   断开后 5 秒内自动重连
Then   如果重连成功，未处理的请求重新推送
  And   webview 的"连接断开"提示消失
When   重连失败，进入退避周期 (10s → 30s → 60s)
  And   累计断开超过 5 分钟
Then   自动降级为本地审批模式
  And   webview 显示"手机连接不可用，已切换到本地审批"
```

### AC-14: 构建验证

```
Given  所有代码已注入到 extension.js 和 webview/index.js
When   运行 build.bat
Then   [1/4] 语法检查通过 (node -c 无错误)
  And   [2/4] vsce 打包成功
  And   [3/4] 安装到 VS Code 扩展目录成功
  And   [4/4] 验证组件: CodeKey Bridge 模块可被检测到
```

### AC-15: 向后兼容

```
Given  已有用户的 localStorage 不含任何 CodeKey 数据
And    用户从未使用过 CodeKey
When   用户升级到集成版后打开星迹的CC
Then   插件正常加载，不报错
  And   所有原有功能正常运行 (YOLO/PreSend/Loop/TTS)
  And   CodeKey 功能默认关闭，不影响任何行为
```

---

## 4. 非功能性需求

### 4.1 性能

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| PC Bridge 启动时间 | < 500ms | 从 activate() 到 HTTP 服务 ready |
| 权限请求推送延迟 | < 1s (p95) | 从拦截请求到手机收到通知 |
| WebSocket 心跳间隔 | 30s | 正常运行时 |
| 加密/解密延迟 | < 50ms per message | 中等大小的权限请求 payload |
| 隐私扫描延迟 | < 10ms per message | 对 4KB 以内的请求内容 |
| 内存占用增量 | < 50MB | PC Bridge 进程运行时 |
| 扩展激活时间增量 | < 200ms | 首次 activate 时加载 CodeKey 模块 |
| webview index.js 体积增量 | < 15KB (注入代码) | 压缩前 |
| extension.js 体积增量 | < 30KB (注入代码) | 压缩前 |

### 4.2 安全

| 要求 | 说明 |
|------|------|
| E2E 加密算法 | AES-256-GCM, 密钥通过 ECDH p256 协商 |
| 密钥存储 | 私钥存储在 VS Code SecretStorage；localStorage 仅存公钥和设备 ID |
| 中继安全 | relay 仅转发加密消息，不参与密钥交换 |
| Pairing 验证 | 初始配对使用 PAKE (Password Authenticated Key Exchange) |
| 隐私管线默认开启 | 扫描以下模式并替换: API keys, tokens, private keys, passwords, secrets |
| 隐私管线可配置 | 用户可关闭或自定义过滤规则 (正则表达式) |
| 本地端口绑定 | PC Bridge 仅监听 127.0.0.1:3001，不接受外部连接 |
| 敏感操作不推送 | 配置中包含"永不推送"的操作列表 (如读密码文件) |

### 4.3 兼容性

| 维度 | 要求 |
|------|------|
| VS Code 版本 | >= 1.94.0 (与 base 扩展一致) |
| 操作系统 | Windows 10/11 优先; macOS/Linux 可用但不优先适配 |
| Node.js | 无需用户安装额外 Node.js |
| 手机端 | 微信小程序 / 飞书小程序 / Telegram Bot (复用 CodeKey relay 已有通道) |
| 与官方 Claude Code 扩展共存 | 可以，本扩展 ID 独立 (`xingji.xingjiclaudecode`) |
| 降级兼容 | 手机不可用时不阻塞本地操作 |
| 网络环境 | 支持 HTTP 代理 (通过 VS Code 代理设置); 防火墙需放行 relay WebSocket 端口 |
| 离线环境 | 无网络时自动降级为本地审批，不报错 |

### 4.4 可维护性

| 要求 | 说明 |
|------|------|
| 代码注入模式 | 追加到 extension.js/webview/index.js 末尾，不修改混淆代码的内部逻辑 |
| 模块化 | CodeKey 功能拆分为独立文件 (`codekey/*.js`)，通过 `require` 或 `globalThis` 加载 |
| 配置集中 | 所有配置项注册到 package.json 的 `contributes.configuration` 中 |
| 日志 | 通过 VS Code OutputChannel "星迹的CC - CodeKey" 输出调试日志 |
| 功能开关 | 通过 `claudeCode.codekey.enabled` 设置全局启用/停用，关闭后完全不加载 |
| 构建流程不变 | build.bat 步骤不变，仅验证项增加 CodeKey 模块检测 |
| 版本同步 | CodeKey relay 协议版本号写入配置，可独立升级 Bridge 模块 |

### 4.5 可靠性

| 要求 | 说明 |
|------|------|
| Graceful Degradation | 任何 CodeKey 模块异常不影响 AI Agent 核心功能 |
| 请求幂等 | 同一权限请求不会重复推送到手机 |
| 超时保护 | 所有网络请求 (relay connect, HTTP, WebSocket) 有超时限制 |
| 状态持久化 | 配对信息持久化到 localStorage，重载 webview 后恢复 |
| 错误恢复 | bridge 进程崩溃后自动重启 (最多 3 次)，3 次后降级为本地模式 |
| 异常上报 | bridge crash、relay 连接失败等异常记录到 OutputChannel |

---

## 5. 影响范围

### 5.1 文件变更

#### 新增文件

| 文件 | 预计行数 | 说明 |
|------|----------|------|
| `extension/codekey/bridge-server.js` | ~300 | PC Bridge HTTP 服务, WebSocket relay 客户端 |
| `extension/codekey/crypto.js` | ~200 | E2E 加密: ECDH 密钥协商 + AES-256-GCM |
| `extension/codekey/privacy-pipeline.js` | ~150 | 本地密钥扫描 + 敏感内容替换 |
| `extension/codekey/permission-proxy.js` | ~200 | 权限请求拦截、转发、超时处理 |
| `extension/codekey/pairing.js` | ~150 | 配对码生成、设备管理、localStorage 持久化 |
| `extension/codekey/types.js` | ~80 | 内部类型定义和常量 |
| `extension/codekey/index.js` | ~50 | 模块入口，统一导出 |

#### 修改文件

| 文件 | 改动位置 | 改动量 | 风险等级 | 说明 |
|------|----------|--------|----------|------|
| `extension/extension.js` | 末尾追加 | ~200 行 | 低 | 加载 codekey 模块, monkey-patch `canUseTool` 和 `AskUserQuestion` handler, 启动 PC Bridge, 注册新配置项读取逻辑 |
| `extension/extension.js` | L55137-55148 | 行内拦截 | 中 | 在 AskUserQuestion 分支中插入 CodeKey 转发逻辑 |
| `extension/extension.js` | L35560-35575 | 行内拦截 | 中 | 在 canUseTool handler 中插入 CodeKey 转发逻辑 |
| `extension/webview/index.js` | 末尾追加 | ~300 行 | 低 | 配对 UI (二维码渲染 + 配对码显示), 审批状态 UI, 设备管理面板, 审批历史面板 |
| `extension/webview/index.css` | 末尾追加 | ~80 行 | 极低 | CodeKey UI 样式, 使用 `--vscode-*` CSS 变量 |
| `extension/package.json` | `contributes.configuration` 和 `contributes.commands` | ~50 行 | 极低 | 新增配置项和命令 |
| `build.bat` | 验证步骤 [4/4] | ~5 行 | 极低 | 增加 codekey 模块检测 |

#### 不受影响

- `extension/extension.js` L1-76193: Claude Code 核心代码和已有星迹注入代码完整保留
- `extension/webview/index.js` L1-213882: Claude Code UI 和已有 TTS UI 完整保留
- `extension/resources/`: 音频/图标资源不变
- `extension/claude-code-settings.schema.json`: 非必须变更

### 5.2 配置项新增 (package.json)

```jsonc
// contributes.configuration.properties 中新增:
{
  "claudeCode.codekey.enabled": {
    "type": "boolean",
    "default": false,
    "description": "启用 CodeKey 手机远程审批。开启后可通过手机 approve/deny AI 的操作请求。"
  },
  "claudeCode.codekey.relayServer": {
    "type": "string",
    "default": "wss://codekey.tinymoney.cn/ws",
    "description": "CodeKey WebSocket 中继服务器地址。默认使用公共 relay。"
  },
  "claudeCode.codekey.bridgePort": {
    "type": "number",
    "default": 3001,
    "description": "PC Bridge HTTP 服务端口号。修改后需重启 VS Code。"
  },
  "claudeCode.codekey.timeout": {
    "type": "number",
    "minimum": 30,
    "maximum": 600,
    "default": 120,
    "description": "手机审批超时时间 (秒)。超时后按 timeoutBehavior 处理。"
  },
  "claudeCode.codekey.timeoutBehavior": {
    "type": "string",
    "enum": ["deny", "allow"],
    "enumDescriptions": ["自动拒绝 (安全)", "自动批准 (效率)"],
    "default": "deny",
    "description": "审批超时后的默认行为。"
  },
  "claudeCode.codekey.privacyFilterEnabled": {
    "type": "boolean",
    "default": true,
    "description": "启用隐私过滤，自动屏蔽推送到手机的内容中的 API Key、Token、密码等敏感信息。"
  },
  "claudeCode.codekey.maxDevices": {
    "type": "number",
    "minimum": 1,
    "maximum": 10,
    "default": 5,
    "description": "最大可绑定设备数量。"
  },
  "claudeCode.codekey.neverPushTools": {
    "type": "array",
    "items": { "type": "string" },
    "default": ["Read"],
    "description": "永不推送到手机的 AI 工具列表 (工具名称)。默认为 Read 只读操作不推送。"
  }
}
```

### 5.3 命令新增 (package.json)

```jsonc
// contributes.commands 中新增:
[
  {
    "command": "xingji.codekey.showPairing",
    "title": "星迹的CC✨: 配对新设备 (CodeKey)"
  },
  {
    "command": "xingji.codekey.showDevices",
    "title": "星迹的CC✨: 管理已配对设备 (CodeKey)"
  },
  {
    "command": "xingji.codekey.showHistory",
    "title": "星迹的CC✨: 查看审批历史 (CodeKey)"
  },
  {
    "command": "xingji.codekey.toggle",
    "title": "星迹的CC✨: 开关 CodeKey 远程审批"
  }
]
```

### 5.4 已知风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| canUseTool monkey-patch 冲突 | 审批流程可能被跳过或重复触发 | 使用 wrapper 模式而非完全替换；在 YOLO 模式下不拦截 |
| relay 服务器不可用 | 无法推送审批 | 自动降级到本地审批；可选自建 relay |
| 混淆代码反向工程不稳定 | 升级后注入点偏移 | 使用函数签名搜索而非硬编码行号定位注入点 |
| E2E 加密库依赖 | Node.js crypto 模块 API 兼容性 | 仅使用 Node.js 内置 `crypto` 模块，无外部依赖 |
| VS Code 多窗口 | 多个窗口可能冲突使用端口 3001 | 端口冲突检测 + 自动递增端口号 |
| webview 安全策略 | Content Security Policy 可能阻止 WebSocket | 在 extension.js 侧处理 WebSocket，webview 通过 postMessage 通信 |

---

## 6. 优先级划分

### P0: 核心闭环 (必须完成，否则不可用)

| 编号 | 任务 | 对应 US/AC | 预估工时 |
|------|------|-----------|----------|
| P0-01 | PC Bridge 模块: HTTP 服务 + WebSocket relay 客户端 | US-1/AC-1 | 4h |
| P0-02 | E2E 加密模块: ECDH + AES-256-GCM | US-5/AC-10 | 3h |
| P0-03 | 设备配对: 配对码生成 + 二维码渲染 + 密钥交换 | US-1/AC-1,AC-2 | 4h |
| P0-04 | 权限拦截: monkey-patch canUseTool + AskUserQuestion handler | US-2,US-3/AC-3,AC-4,AC-5 | 6h |
| P0-05 | 审批推送: 请求序列化 → 加密 → relay → 手机 | US-2/AC-3 | 3h |
| P0-06 | 审批响应: 手机响应 → relay → 解密 → 返回给 Agent | US-2/AC-3,AC-4 | 3h |
| P0-07 | webview 审批状态 UI: "等待审批" + 倒计时 + 响应结果 | US-2/AC-3,AC-4 | 3h |
| P0-08 | webview 配对 UI: 二维码 + 配对码 + 配对成功 | US-1/AC-1,AC-2 | 3h |
| P0-09 | YOLO 模式协同: bypassPermissions 时不推送普通工具调用 | US-10/AC-6 | 2h |
| P0-10 | 总开关: 配置读取 + 关闭时完全不加载 | US-9/AC-8 | 2h |
| P0-11 | package.json: 配置项 + 命令注册 | -- | 2h |
| P0-12 | build.bat: 验证步骤更新 | AC-14 | 1h |

**P0 合计**: ~36h

### P1: 完善体验 (稳健版本必须)

| 编号 | 任务 | 对应 US/AC | 预估工时 |
|------|------|-----------|----------|
| P1-01 | 隐私管线: 敏感信息扫描 + 内容过滤 | US-6/AC-9 | 3h |
| P1-02 | 审批超时: 倒计时提醒 + 自动处理 | US-7/AC-11 | 3h |
| P1-03 | 网络恢复: WebSocket 重连退避 + 降级 | US-8/AC-13 | 4h |
| P1-04 | 设备管理 UI: 列表/在线状态/解绑 | US-4/-- | 3h |
| P1-05 | 设备离线降级: 检查在线状态 + fallback 到本地 | AC-7 | 2h |
| P1-06 | localStorage 持久化: 配对信息 + 审批历史 | AC-15 | 2h |
| P1-07 | 错误恢复: bridge 崩溃重启 + 异常记录 | -- | 3h |
| P1-08 | 向后兼容验证: 无 CodeKey 数据的用户升级 | AC-15 | 2h |
| P1-09 | 配置项完整实现 (8 个配置项读写) | -- | 2h |

**P1 合计**: ~24h

### P2: 锦上添花 (后续迭代)

| 编号 | 任务 | 对应 US/AC | 预估工时 |
|------|------|-----------|----------|
| P2-01 | 手机端 UI 品牌化 (修改 relay 下发的卡片模板) | US-11 | 5h |
| P2-02 | 审批历史 UI: 列表 + 筛选 + 详情 | US-12 | 4h |
| P2-03 | 多设备同时审批 + 竞态处理 | AC-12 | 3h |
| P2-04 | 自定义过滤规则: 用户可编辑正则 | -- | 3h |
| P2-05 | 审批统计: 批准率/拒绝率/平均响应时间 | -- | 3h |
| P2-06 | 免打扰模式: 指定时间段不推送 | -- | 2h |
| P2-07 | relay 自建指南文档 | -- | 2h |
| P2-08 | macOS/Linux 兼容性测试与修复 | -- | 3h |
| P2-09 | CI 自动构建验证 (仅语法检查) | -- | 2h |

**P2 合计**: ~27h

### 总预估

| 优先级 | 工时 | 说明 |
|--------|------|------|
| P0 | 36h | 核心闭环, 可从手机完成一次审批 |
| P1 | 24h | 体验完善, 稳健可用 |
| P2 | 27h | 锦上添花, 产品级品质 |
| **合计** | **87h** | |

---

## 附录 A: 术语表

| 术语 | 说明 |
|------|------|
| PC Bridge | CodeKey 在 PC 端运行的本地 HTTP 服务 (localhost:3001)，负责连接 relay 和处理加密 |
| Relay Server | CodeKey 的 WebSocket 中继服务器 (codekey.tinymoney.cn)，负责在 PC 和手机之间转发加密消息 |
| ECDH | Elliptic Curve Diffie-Hellman，椭圆曲线密钥交换协议，p256 曲线 |
| AES-256-GCM | Advanced Encryption Standard, 256-bit key, Galois/Counter Mode (带认证的加密模式) |
| canUseTool | Claude Code Agent SDK 中的回调函数，用于审批工具调用。本插件在 extension.js 中注入 |
| AskUserQuestion | Claude Code Agent SDK 中的工具，AI 主动向用户提问。YOLO 模式下的唯一审批触发点 |
| monkey-patch | 在运行时替换/包装已有函数，不修改原始代码。本项目的核心注入技术 |
| YOLO 模式 | bypassPermissions 权限模式，AI 自动执行所有操作无需确认 |
| Pre-Send | 预发送功能，AI 运行时排队发送消息，不打断当前生成 |

## 附录 B: 参考资源

- CodeKey 项目: https://github.com/rockcen72/codekey (Apache 2.0)
- CodeKey VS Code 插件: `codekey.codekey-vscode` v1.2.9
- Claude Code Agent SDK: 参考 `extension/extension.js` L35392-35639 (`mh` class)
- 星迹注入模式: 参考语音功能移植设计文档 `specs/voice-features/design.md`
- 构建流程: 参考 `build.bat`
