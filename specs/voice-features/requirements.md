# 语音功能移植 - 需求文档

## 1. 功能概述

将 Claude Code Voice 插件（fultonmarketaistudio.claude-code-voice-1.6.0）的完整双向语音对话功能移植到星迹的CC 扩展中。

**参考插件**：94 个功能点，分布在 7 个模块中。
**当前进度**：MVP 已完成（6 个功能点），剩余 88 个待实现。

## 2. 用户故事

### US1: 语音输入
作为开发者，我希望对编辑器说话就能输入文字到 Claude，以便双手不离开键盘也能与 AI 对话。
- 已有 STT 基础（Anthropic Deepgram Nova-3 WebSocket）
- 需要解决音频采集依赖（SoX/native binary 不可用时的 fallback）

### US2: 语音回复
作为开发者，我希望 Claude 的回复被自动朗读，以便不用看屏幕就能获得反馈。
- MVP 已实现 Web Speech API 基础版
- 需要升级为 Edge TTS（更高质量、更多语音选择）

### US3: 流式分句 TTS
作为开发者，我希望 Claude 的回复边生成边朗读（按句子），以便不用等全部回复完成就能开始听。
- 需要实现 StreamingTTSManager（分句 + 并行生成 + 预取）

### US4: 语音打断
作为开发者，我希望在 AI 朗读时可以随时说话打断，以便追加上下文或纠正。
- 需要 TTS interrupt 机制 + 录音自动恢复

### US5: 浏览器语音模式
作为开发者，我希望在 Codespaces/远程环境中也能用语音，以便在任何地方都能语音操作。
- 需要 VoiceBridgeServer（HTTP + SSE + 浏览器 UI）

### US6: 语音确认权限
作为开发者，我希望通过语音说 "yes/no" 来确认工具权限，以便纯语音操作闭环。
- 需要权限队列 + 语音识别 + TTS 播报

### US7: 原生音频播放
作为开发者，我希望 TTS 音频有完整的播放控制（暂停/恢复/音量/静音），以便灵活控制语音输出。
- 需要 AudioPlayer（MP3 解码 + RtAudio 播放）

### US8: 原生录音
作为开发者，我希望不依赖外部工具（SoX）就能录音，以便开箱即用。
- 需要 VoiceRecorder（Audify/RtAudio 原生录音）

## 3. 验收标准

### AC1: STT 音频采集
- GIVEN 用户点击麦克风按钮
- WHEN 说话并停止
- THEN 文字出现在输入框中（使用 Anthropic STT 或 OpenAI Whisper）

### AC2: TTS 语音回复
- GIVEN 用户开启语音朗读
- WHEN Claude 回复文字消息
- THEN 逐句朗读回复内容（使用 Edge TTS 或 Web Speech API）

### AC3: 流式 TTS
- GIVEN Claude 回复较长内容（>200 字符）
- WHEN 回复正在生成
- THEN 前 2 句并行生成 TTS，播放第 N 句时预生成第 N+1、N+2 句

### AC4: 语音打断
- GIVEN AI 正在朗读
- WHEN 用户点击麦克风或按快捷键
- THEN 立即停止朗读，开始录音

### AC5: 浏览器语音模式
- GIVEN 用户在 Codespaces 环境
- WHEN 启动浏览器语音模式
- THEN 打开浏览器页面，显示配对码，录音→转写→Claude→TTS 播放

### AC6: 权限语音确认
- GIVEN Claude 请求工具权限
- WHEN TTS 播报 "Claude wants to run X. Say yes or no."
- THEN 用户说 "yes" 或 "no" 即可确认/拒绝

### AC7: 播放控制
- GIVEN TTS 正在播放
- WHEN 用户点击暂停/调节音量/静音
- THEN 音频响应操作

### AC8: 无依赖录音
- GIVEN 用户未安装 SoX
- WHEN 点击麦克风按钮
- THEN 使用原生录音（Audify）正常工作

## 4. 非功能性需求

- **延迟**：TTS 首句延迟 < 2 秒
- **兼容性**：Windows 11 + VS Code 桌面版优先，Codespaces 次之
- **可维护性**：通过追加代码注入，不修改压缩的原始代码
- **可配置性**：所有语音功能可通过 VS Code 设置开关
- **降级**：高级功能失败时优雅降级到基础功能

## 5. 影响范围

### 直接修改文件
| 文件 | 改动类型 | 风险 |
|------|---------|------|
| `extension/extension.js` 末尾 | 追加注入代码 | 低（不修改已有代码） |
| `extension/webview/index.js` 末尾 | 追加注入代码 | 低 |
| `extension/package.json` | 添加配置项 | 极低 |
| `extension/edge-tts.js` | 新文件 | 无风险 |

### 注入目标类/函数
| 目标 | 行号 | 注入方式 |
|------|------|---------|
| `N5.prototype.send` | 72228 | monkey-patch 拦截出站消息 |
| `N5.prototype.processRequest` | 72234 | monkey-patch 处理自定义请求 |
| `JE.prototype.readFromClient` | 54967 | monkey-patch 添加新消息类型 |
| `_16` (WebSocket STT) | 71863 | 可选替换 STT 后端 |
| `hQ.prototype.setupPanel` | 73527 | 拦截 N5 实例创建 |
