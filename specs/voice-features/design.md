# 语音功能移植 - 技术设计文档

## 1. 架构概述

### 注入策略：Route C（extension.js 末尾追加）

extension.js 是 76K 行的单作用域压缩文件（无 IIFE 包裹）。末尾追加的代码可以直接访问所有内部变量（`N5`, `JE`, `hQ`, `M6`, `_16` 等）。

```
extension.js 结构:
├── L1-21192: 打包的 Claude Code 核心代码
├── L21191-21192: module.exports 定义
├── L21193+: 变量定义、类定义、激活函数
├── L76174-76193: 我们已注入的 TTS 命令
└── [追加更多注入代码]
```

### 双层架构

```
┌─────────────────────────────────────────────────────────┐
│  Extension Host (Node.js)                                │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 已有：N5 (通讯类), JE (基类), hQ (面板管理)          ││
│  │ 注入：VoiceBridgeServer, VoiceService,              ││
│  │       StreamingTTSManager, EdgeTTS                  ││
│  └───────────────────────┬─────────────────────────────┘│
│                          │ postMessage / monkey-patch    │
├──────────────────────────┼──────────────────────────────┤
│  Webview (Chromium)      │                               │
│  ┌───────────────────────┴─────────────────────────────┐│
│  │ 已有：React UI, 消息协议, play_audio 处理            ││
│  │ 注入：TTS 模块, UI 按钮, 录音 bridge                ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

## 2. 模块设计

### Module A: Edge TTS 引擎（新文件）

**文件**: `extension/edge-tts.js`（~200 行）

```
EdgeTTS {
  +synthesize(text, voice?) → Promise<Buffer>     // 文字 → MP3
  +synthesizeStream(text, voice?) → AsyncIterator  // 流式生成
  +getVoices() → Promise<Voice[]>                  // 可用语音列表
  -_connect() → Promise<WebSocket>                 // 建立连接
  -_sendSSML(text, voice)                          // 发送 SSML 请求
  -_parseAudioResponse(ws) → Buffer               // 解析音频响应
}
```

**协议**: WebSocket → `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`
**Token**: `6A5AA1D4EAFF4E9FB37E23D68491D6F4`（公开 TrustedClientToken）
**输出格式**: `audio-24khz-48kbitrate-mono-mp3`

### Module B: Streaming TTS Manager（追加到 extension.js）

**注入方式**: 追加到 extension.js 末尾

```
StreamingTTSManager {
  constructor(edgeTTS, options)
  +streamText(text) → void        // 启动流式 TTS
  +pause() / resume() / stop()
  +interrupt()                     // 用户打断
  +getState() → 'idle'|'generating'|'playing'|'paused'
  -splitIntoSentences(text) → string[]
  -playbackLoop() → void          // 主播放循环
  -startGenerating(index) → void  // 预生成 TTS
}

MessageQueue {
  constructor(processCallback)
  +addMessage(text) → Message
  +clearQueue()
  +getQueueLength() → number
}
```

**分句策略**: 按 `.!?。！？` 分句，短句合并（最小 100 字符），最大 200 字符/chunk。
**并行策略**: 同时生成第 N、N+1、N+2 句的 TTS。

### Module C: Voice Bridge Server（追加到 extension.js 或独立文件）

**文件**: `extension/voice-bridge.js`（~500 行精简版）

```
VoiceBridgeServer {
  constructor(context, onTranscript)
  +start()                         // 启动 HTTP 服务器 (端口 9877)
  +stop()
  +createSession() → string        // 返回 6 位配对码
  +hasActiveSession() → boolean
  +sendTTSResponse(text)
  +sendStreamingAudio(base64, text, isLast)
  +sendPermissionRequest(request)
  -handleConnect(req, res)
  -handleSSE(req, res)
  -handleAudio(req, res)
  -handlePermission(req, res)
  -serveVoiceBridgePage(res)       // 浏览器 UI HTML
}
```

**API 端点**:
| Method | Path | 功能 |
|--------|------|------|
| GET | `/` | 浏览器语音 UI 页面 |
| POST | `/connect` | 配对码验证 |
| GET | `/events` | SSE 实时推送 |
| POST | `/audio` | 音频转写 |
| POST | `/permission` | 权限确认 |
| GET | `/status` | 服务器状态 |

### Module D: Voice Service（追加到 extension.js）

```
VoiceService {
  +transcribe(audioBuffer, mimeType) → string  // STT
  +synthesize(text) → Buffer                    // TTS
  +checkWhisperAvailable() → boolean
  +checkKokoroAvailable() → boolean
}
```

**STT**: OpenAI Whisper API 或本地 Whisper (`http://127.0.0.1:2022/v1`)
**TTS**: Edge TTS（优先）或 OpenAI TTS 或本地 Kokoro

### Module E: Audio Player（追加到 extension.js）

由于 webview 已有 `play_audio` 处理器，优先使用 webview 播放。
原生 AudioPlayer（Audify + mpg123-decoder）作为 Phase 3 可选增强。

### Module F: Voice Recorder

**方案 A（推荐）**: 保持现有 Anthropic STT 管道（已内置），只需解决 `xc()` 音频采集。
**方案 B**: webview MediaRecorder → extension → WebSocket（复杂但无依赖）。

## 3. 注入点详细设计

### 注入点 1: N5.prototype.send（拦截出站消息）

```js
// 追加到 extension.js 末尾
var _origN5Send = N5.prototype.send;
N5.prototype.send = function(msg) {
    _origN5Send.call(this, msg);
    // 检查是否为 assistant 文本消息 → 触发 TTS
    if (this._ttsEnabled && msg.type === 'io_message' && msg.message?.type === 'assistant') {
        var text = extractText(msg.message.message?.content);
        if (text) streamingTTS.streamText(text);
    }
};
```

### 注入点 2: N5.prototype.processRequest（处理自定义请求）

```js
var _origProcessReq = N5.prototype.processRequest;
N5.prototype.processRequest = async function(req, res) {
    if (req.request.type === 'tts_toggle') {
        this._ttsEnabled = req.request.enabled;
        return { type: 'tts_toggle_response', enabled: this._ttsEnabled };
    }
    if (req.request.type === 'tts_stop') {
        streamingTTS.stop();
        return { type: 'tts_stop_response' };
    }
    return _origProcessReq.call(this, req, res);
};
```

### 注入点 3: hQ.prototype.setupPanel（拦截 N5 创建）

```js
var _origSetupPanel = hQ.prototype.setupPanel;
hQ.prototype.setupPanel = function(panel, ...) {
    _origSetupPanel.call(this, panel, ...);
    // N5 实例已创建并添加到 this.allComms
    // 可在此注入自定义初始化逻辑
};
```

### 注入点 4: 音频播放（使用已有 play_audio 机制）

```js
// 发送音频到 webview 播放（复用已有机制）
n5Instance.send({
    type: "request",
    channelId: "",
    requestId: "",
    request: { type: "play_audio", audioUri: "data:audio/mpeg;base64," + base64 }
});
```

## 4. 配置项设计

```json
{
  "claudeCode.voice.ttsEnabled": { "type": "boolean", "default": false },
  "claudeCode.voice.ttsRate": { "type": "number", "default": 1.0, "minimum": 0.5, "maximum": 3.0 },
  "claudeCode.voice.ttsVolume": { "type": "number", "default": 1.0, "minimum": 0.0, "maximum": 1.0 },
  "claudeCode.voice.ttsVoice": { "type": "string", "default": "zh-CN-XiaoxiaoNeural" },
  "claudeCode.voice.ttsEngine": { "type": "string", "enum": ["webspeech", "edge-tts", "openai"], "default": "edge-tts" },
  "claudeCode.voice.sttProvider": { "type": "string", "enum": ["anthropic", "openai", "local-whisper"], "default": "anthropic" },
  "claudeCode.voice.openaiApiKey": { "type": "string", "default": "" },
  "claudeCode.voice.bridgePort": { "type": "number", "default": 9877 },
  "claudeCode.voice.autoPlayResponses": { "type": "boolean", "default": true }
}
```

## 5. 可复用资产

| 资产 | 来源 | 复用方式 |
|------|------|---------|
| `play_audio` 播放机制 | webview 已有 | 直接使用 |
| `preload_audio` 预加载 | webview 已有 | 直接使用 |
| Anthropic STT WebSocket | extension 已有 | 已启用（`return !0`） |
| Mic 按钮 UI | webview 已有 | 已启用 |
| `Ctrl+D` 快捷键 | webview 已有 | 已启用 |
| `voice-service.js` | Claude Code Voice | 搬运 HTTP 调用 |
| `streaming-tts-manager.js` | Claude Code Voice | 搬运逻辑代码 |
| `voice-bridge-server.js` | Claude Code Voice | 搬运 HTTP+SSE 服务器 |

## 6. 文件变更清单

### 新增文件
| 文件 | 行数 | 功能 |
|------|------|------|
| `extension/edge-tts.js` | ~200 | Edge TTS WebSocket 客户端 |
| `extension/voice-bridge.js` | ~500 | 浏览器语音桥接服务器（Phase 3） |

### 修改文件（追加注入）
| 文件 | 追加行数 | 功能 |
|------|---------|------|
| `extension/extension.js` 末尾 | ~300 | TTS 管理器、Voice Service、monkey-patches |
| `extension/webview/index.js` 末尾 | ~250 | TTS 增强、播放控制 UI、录音 bridge |
| `extension/package.json` | ~30 | 新配置项 |

## 7. 技术决策与权衡

| 决策 | 选择 | 理由 |
|------|------|------|
| TTS 引擎 | Edge TTS > Web Speech API | 免费、300+ 语音、中文质量高 |
| STT 方案 | 保持 Anthropic 内置 | 已集成、无需额外 key、Deepgram Nova-3 质量好 |
| 音频播放 | webview play_audio > 原生 AudioPlayer | 零依赖、已实现、够用 |
| 音频采集 | 保持原生 xc() + SoX fallback 提示 | Audify 需要原生模块编译，复杂度高 |
| 语音桥接 | Phase 3 实现 | 非核心功能，复杂度高 |
| 多 Agent | Phase 3 实现 | 当前单 Agent 足够 |

---

## 附录：AI Voice Studio 集成（2026-07-07 决策）

用户已安装 `xianwei-zhang.ai-voice-studio-0.12.7`，决定**替换我们的 TTS 引擎**为其架构。

### 复用模块（已复制到 reference/ai-voice-studio/）

| 模块 | 移植方式 |
|------|---------|
| `text-chunker.js` | 直接移植 — 三级智能分句（段落→句子→软断点） |
| `playback-session.js` | 直接移植 — lookahead 滑动窗口流式预取 |
| `synthesize.js` | 移植 provider 分发逻辑，增加 edge provider |
| `providers.js` | 移植 TTSApiError + provider 抽象 |
| `qwen-tts.js` | 移植 — 通义千问（含 WebSocket 实时流式） |
| `mimo-tts.js` | 移植 — 小米 MiMo（情感标签/音色克隆） |
| `gemini-tts.js` | 移植 — Google Gemini |
| `secrets.js` | 移植 — API key 加密存储 |

### 新增 provider: edge（免费默认）

在 synthesize 分发中增加 `edge` 分支，复用现有 XingjiEdgeTTS。这样：
- 零配置用户 → Edge TTS（免费）
- 高质量需求 → Qwen/MiMo/Gemini（需 API key）

### Provider 配置

`claudeCode.voice.provider`: enum [edge, qwen, mimo, gemini]，默认 edge
API key 通过 VS Code SecretStorage 存储，或环境变量 fallback
