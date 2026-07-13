# 语音功能 - 任务清单（更新于多引擎集成后）

## 当前状态
已集成 AI Voice Studio 的多引擎 TTS 架构。Edge TTS 为免费默认引擎，Qwen/MiMo/Gemini 为可选高质量引擎。

---

### Phase 1: 核心 TTS 引擎 ✅ 已完成
- [x] Edge TTS WebSocket 客户端（免费，默认引擎）
- [x] Gemini TTS（Google AI Studio，PCM→WAV）
- [x] Qwen TTS（通义千问 DashScope）
- [x] MiMo TTS（小米，情感标签/音色克隆）
- [x] 统一 provider 分发（xjSynthesize）
- [x] 智能分句（三级：段落→句子→软断点）
- [x] lookahead 流式预取（可配置窗口大小）
- [x] AbortController 精确取消
- [x] 语速配置（config rate → Edge SSML prosody）

### Phase 2: VS Code 集成 ✅ 已完成
- [x] N5.send monkey-patch 拦截 Claude 回复
- [x] N5.processRequest 拦截 stop_tts / open_voice_settings
- [x] hQ.setupPanel 拦截追踪 N5 实例
- [x] globalThis 共享状态（_xingjiTTSState / _xingjiActiveComms）
- [x] 命令注册（toggleTTS / stopTTS / setVoiceApiKey）
- [x] toggleTTS 广播状态到 webview 按钮
- [x] package.json 配置项（provider/voice/model/chunkSize/rate）

### Phase 3: Webview UI ✅ 已完成
- [x] vscode API 缓存 shim（acquireVsCodeApi 重赋值）
- [x] TTS 按钮（SVG speaker 图标，MutationObserver 防丢失）
- [x] 播放状态指示（idle/playing/generating）
- [x] 停止按钮（SVG stop 图标）
- [x] 进度显示（第 N/M 句）
- [x] 设置按钮（SVG 齿轮，注入历史按钮左侧）

### Phase 4: 浏览器语音桥接 ✅ 已完成
- [x] HTTP 服务器（端口 9877）
- [x] 6 位配对码 + 安全 token 认证
- [x] SSE 实时推送（TTS 音频/转写/状态）
- [x] 浏览器 Web Speech API 语音识别
- [x] 浏览器 TTS 音频播放（Blob→Audio）
- [x] transcript 路由到 Claude（transportMessage）
- [x] 命令注册（openVoiceBridge / stopVoiceBridge）
- [x] 端口冲突优雅降级

### Phase 5: 权限语音确认 🔲 未开始
- [ ] 权限队列管理（一次显示一个）
- [ ] TTS 播报权限提示
- [ ] 语音识别 yes/no 确认

### Phase 6: 原生音频 🔲 低优先级
- [ ] Audify 可用性评估
- [ ] 原生 AudioPlayer（RtAudio 输出）
- [ ] 原生 VoiceRecorder（RtAudio 录音）

### Phase 7: 集成验证 🔲 待测试
- [ ] Edge TTS 端到端（开关→发消息→朗读→停止）
- [ ] 浏览器语音对话端到端（配对码→录音→转写→Claude→TTS→播放）
- [ ] Qwen/MiMo/Gemini 引擎验证（需 API key）
- [ ] 设置按钮打开语音设置
- [ ] 回归测试（Pre-Send / 音频通知 / 普通聊天）
- [ ] 性能测试（TTS 首句延迟 < 2 秒）
- [ ] build.bat 构建脚本验证

---

## 进度统计

| Phase | 总任务 | 已完成 | 进度 |
|-------|:---:|:---:|:---:|
| Phase 1: TTS 引擎 | 9 | 9 | **100%** |
| Phase 2: VS Code 集成 | 9 | 9 | **100%** |
| Phase 3: Webview UI | 6 | 6 | **100%** |
| Phase 4: VoiceBridge | 8 | 8 | **100%** |
| Phase 5: 权限语音 | 3 | 0 | 0% |
| Phase 6: 原生音频 | 3 | 0 | 0% |
| Phase 7: 集成验证 | 7 | 0 | 0% |
| **总计** | **45** | **32** | **71%** |

## 关键文件

| 文件 | 作用 | 大小 |
|------|------|------|
| `extension/extension.js` L76349-76750 | 语音注入模块（TTS + VoiceBridge） | ~400 行 |
| `extension/webview/index.js` 顶部+末尾 | shim + TTS 按钮 + 设置按钮 | ~150 行 |
| `extension/package.json` | 配置项 + 命令注册 | 语音相关 ~80 行 |
| `reference/ai-voice-studio/` | AI Voice Studio 参考代码 | 完整副本 |
| `build.bat` | 构建+安装脚本 | 30 行 |
