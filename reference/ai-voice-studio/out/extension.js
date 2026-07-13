"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const config_1 = require("./config");
const providers_1 = require("./core/providers");
const synthesize_1 = require("./core/synthesize");
const text_chunker_1 = require("./core/text-chunker");
const playback_session_1 = require("./core/playback-session");
const secrets_1 = require("./secrets");
const webview_view_provider_1 = require("./webview-view-provider");
class PlaybackController {
    current = null;
    sessionCounter = 0;
    begin() {
        this.current?.abort();
        this.current = new AbortController();
        this.sessionCounter += 1;
        return { signal: this.current.signal, sessionId: this.sessionCounter };
    }
    abort() {
        this.current?.abort();
        this.current = null;
    }
    isCurrent(sessionId) {
        return this.current !== null && this.sessionCounter === sessionId;
    }
    complete(sessionId) {
        if (this.isCurrent(sessionId)) {
            this.current = null;
        }
    }
}
class StatusBar {
    item;
    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.item.command = "aiVoiceStudio.focusView";
        this.set({ kind: "idle" });
        this.item.show();
    }
    set(mode) {
        switch (mode.kind) {
            case "idle":
                this.item.text = "$(unmute) Voice Studio";
                this.item.tooltip = "AI Voice Studio — click to open the sidebar.";
                break;
            case "synth":
                this.item.text = "$(loading~spin) Synthesizing…";
                this.item.tooltip = "AI Voice Studio — synthesizing audio.";
                break;
            case "playing":
                this.item.text =
                    mode.total > 1
                        ? `$(record) Voice ${mode.index}/${mode.total}`
                        : "$(record) Voice";
                this.item.tooltip = "AI Voice Studio — playing.";
                break;
            case "error":
                this.item.text = "$(error) Voice Studio";
                this.item.tooltip = "AI Voice Studio — last action failed.";
                break;
        }
    }
    dispose() {
        this.item.dispose();
    }
}
function activate(context) {
    const provider = new webview_view_provider_1.VoiceStudioViewProvider(context.extensionUri);
    const secrets = new secrets_1.SecretsStore(context.secrets);
    const playback = new PlaybackController();
    const statusBar = new StatusBar();
    context.subscriptions.push(statusBar, vscode.window.registerWebviewViewProvider(webview_view_provider_1.VoiceStudioViewProvider.viewType, provider, {
        webviewOptions: { retainContextWhenHidden: true },
    }));
    const refreshConfig = () => {
        if (!provider.isReady())
            return;
        provider.postConfig((0, config_1.getConfig)(), (0, config_1.getMiMoVoiceCloneSample)(context.globalState));
        void postActiveKeyStatus();
    };
    let configUpdateChain = Promise.resolve();
    const queueConfigUpdate = (update, shouldRefresh = false) => {
        configUpdateChain = configUpdateChain
            .then(update)
            .then(() => {
            if (shouldRefresh)
                refreshConfig();
        })
            .catch((err) => {
            statusBar.set({ kind: "error" });
            handleError(err, provider);
        });
    };
    async function promptAndStoreKey(target) {
        const choice = target ?? (await pickProvider("Set API key for…"));
        if (!choice)
            return;
        const value = await vscode.window.showInputBox({
            title: `${providers_1.PROVIDER_LABELS[choice]} API key`,
            prompt: "Stored in VS Code SecretStorage. Leave empty to cancel.",
            password: true,
            ignoreFocusOut: true,
            validateInput: (input) => (input.trim().length === 0 ? "API key cannot be empty." : null),
        });
        const trimmed = value?.trim();
        if (!trimmed)
            return;
        await secrets.set(choice, trimmed);
        vscode.window.showInformationMessage(`AI Voice Studio: ${providers_1.PROVIDER_LABELS[choice]} API key saved.`);
        provider.postStatus(`✓ ${providers_1.PROVIDER_LABELS[choice]} API key saved.`, "success");
        void postActiveKeyStatus();
    }
    async function postActiveKeyStatus() {
        if (!provider.isReady())
            return;
        const active = (0, config_1.getConfig)().provider;
        const hasKey = !!(await secrets.get(active));
        provider.postKeyStatus(active, hasKey);
    }
    provider.setMessageHandler((msg) => {
        switch (msg.type) {
            case "ready":
                refreshConfig();
                return;
            case "requestRead":
                void readText(msg.text, "Webview");
                return;
            case "requestStop":
                playback.abort();
                statusBar.set({ kind: "idle" });
                return;
            case "requestSetKey":
                void promptAndStoreKey(msg.provider);
                return;
            case "providerChanged":
                queueConfigUpdate(() => (0, config_1.setProvider)(msg.provider), true);
                return;
            case "voiceChanged":
                queueConfigUpdate(() => (0, config_1.setProviderVoice)(msg.provider, msg.voice));
                return;
            case "modelChanged":
                queueConfigUpdate(() => applyModelChange(msg.provider, msg.model, msg.voice), true);
                return;
            case "mimoStyleTagsChanged":
                queueConfigUpdate(() => (0, config_1.setMiMoOpeningStyleTags)(msg.tags));
                return;
            case "mimoAudioEventTagsChanged":
                queueConfigUpdate(() => (0, config_1.setMiMoAudioEventTags)(msg.tags));
                return;
            case "mimoStylePromptChanged":
                queueConfigUpdate(() => (0, config_1.setMiMoStylePrompt)(msg.text));
                return;
            case "mimoVoiceCloneSampleSet":
                queueConfigUpdate(() => (0, config_1.setMiMoVoiceCloneSample)(context.globalState, {
                    dataUrl: msg.dataUrl,
                    mime: msg.mime,
                    fileName: msg.fileName,
                    sizeBytes: msg.sizeBytes,
                    storedAt: Date.now(),
                }), true);
                return;
            case "mimoVoiceCloneSampleClear":
                queueConfigUpdate(() => (0, config_1.setMiMoVoiceCloneSample)(context.globalState, undefined), true);
                return;
            case "mimoPresetSave":
                queueConfigUpdate(() => applyPresetSave(msg.preset), true);
                return;
            case "mimoPresetApply":
                queueConfigUpdate(() => applyPresetByName(msg.name), true);
                return;
            case "mimoPresetDelete":
                queueConfigUpdate(() => applyPresetDelete(msg.name), true);
                return;
            case "geminiStylePreambleChanged":
                queueConfigUpdate(() => (0, config_1.setGeminiStylePreamble)(msg.text));
                return;
            case "geminiInsertAudioTag":
                // Pure UI signal — handled inside the webview, no extension state change.
                return;
            case "qwenEndpointChanged":
                queueConfigUpdate(() => (0, config_1.setQwenEndpoint)(msg.endpoint));
                return;
            case "qwenLanguageTypeChanged":
                queueConfigUpdate(() => (0, config_1.setQwenLanguageType)(msg.languageType));
                return;
            case "qwenInstructionsChanged":
                queueConfigUpdate(() => (0, config_1.setQwenInstructions)(msg.text));
                return;
        }
    });
    async function readText(text, source) {
        let sessionId;
        try {
            const trimmed = text.trim();
            if (!trimmed) {
                vscode.window.showWarningMessage("AI Voice Studio: nothing to read.");
                return;
            }
            await configUpdateChain;
            const cfg = (0, config_1.getConfig)();
            const apiKey = await secrets.ensure(cfg.provider);
            if (!apiKey) {
                provider.postStatus(`${providers_1.PROVIDER_LABELS[cfg.provider]} API key not set.`, "error", { id: "requestSetKey", label: "Set API Key" });
                statusBar.set({ kind: "error" });
                return;
            }
            const args = buildProviderArgs(cfg, apiKey, context);
            if (!args) {
                provider.postStatus(`Invalid voice/model for ${providers_1.PROVIDER_LABELS[cfg.provider]}.`, "error");
                statusBar.set({ kind: "error" });
                return;
            }
            const voiceLabel = describeVoice(cfg);
            await provider.reveal();
            if (!(await provider.waitUntilReady())) {
                const message = "AI Voice Studio: sidebar is still loading. Try again in a moment.";
                provider.postStatus(message, "warn");
                void vscode.window.showWarningMessage(message);
                statusBar.set({ kind: "idle" });
                return;
            }
            const chunks = (0, text_chunker_1.chunkText)(trimmed, { maxChars: cfg.chunkSize });
            if (chunks.length === 0)
                return;
            const session = playback.begin();
            const signal = session.signal;
            const currentSessionId = session.sessionId;
            sessionId = currentSessionId;
            provider.postSessionStart(currentSessionId, chunks.length);
            statusBar.set({ kind: "synth" });
            provider.postStatus(chunks.length === 1
                ? `Synthesizing with ${providers_1.PROVIDER_LABELS[cfg.provider]} · ${voiceLabel}…`
                : `Synthesizing ${chunks.length} chunks with ${providers_1.PROVIDER_LABELS[cfg.provider]} · ${voiceLabel}…`);
            const isQwenStreaming = args.provider === "qwen";
            let streamingChunkIndex = 0;
            const result = await (0, playback_session_1.runPlaybackSession)(chunks, (chunkText, chunkSignal) => {
                if (isQwenStreaming && args.provider === "qwen") {
                    // Stream sub-chunks straight to the webview as PCM segments arrive.
                    const total = chunks.length;
                    const myIndex = streamingChunkIndex++;
                    const label = total > 1
                        ? `${source} · ${voiceLabel} · ${myIndex + 1}/${total}`
                        : `${source} · ${voiceLabel}`;
                    return (0, synthesize_1.synthesize)({ text: chunkText, signal: chunkSignal }, {
                        ...args,
                        onSubChunk: (audioBase64, isLast) => {
                            if (!playback.isCurrent(currentSessionId))
                                return;
                            provider.postSubChunk(currentSessionId, audioBase64, "pcm", cfg.playbackRate, isLast, label);
                        },
                    });
                }
                return (0, synthesize_1.synthesize)({ text: chunkText, signal: chunkSignal }, args);
            }, ({ index, total, result: out }) => {
                if (!playback.isCurrent(currentSessionId))
                    return;
                const label = total > 1
                    ? `${source} · ${voiceLabel} · ${index + 1}/${total}`
                    : `${source} · ${voiceLabel}`;
                if (isQwenStreaming) {
                    // Streaming already pushed audio to the webview via postSubChunk;
                    // here we only mark the chunk boundary so the progress bar advances
                    // when the trailing sub-chunk has been queued.
                    provider.postChunkBoundary(currentSessionId, index, total, label);
                }
                else {
                    provider.postPlay(currentSessionId, index, total, out.audioBase64, out.format, cfg.playbackRate, label);
                }
                statusBar.set({ kind: "playing", index: index + 1, total });
            }, signal);
            if (!playback.isCurrent(currentSessionId))
                return;
            provider.postSessionEnd(currentSessionId, result.cancelled);
            playback.complete(currentSessionId);
            statusBar.set({ kind: "idle" });
        }
        catch (err) {
            if (sessionId !== undefined) {
                if (!playback.isCurrent(sessionId))
                    return;
                playback.abort();
                provider.postSessionEnd(sessionId, true);
            }
            statusBar.set({ kind: "error" });
            handleError(err, provider);
        }
    }
    context.subscriptions.push(vscode.commands.registerCommand("aiVoiceStudio.quickRead", async () => {
        const text = await resolveTextToRead();
        if (!text) {
            vscode.window.showInformationMessage("AI Voice Studio: select text in the editor or copy text to the clipboard first.");
            return;
        }
        await readText(text, "Quick Read");
    }), vscode.commands.registerCommand("aiVoiceStudio.stop", () => {
        playback.abort();
        provider.postStop();
        statusBar.set({ kind: "idle" });
    }), vscode.commands.registerCommand("aiVoiceStudio.setApiKey", () => promptAndStoreKey()), vscode.commands.registerCommand("aiVoiceStudio.clearApiKey", async () => {
        const choice = await pickProvider("Clear API key for…");
        if (!choice)
            return;
        await secrets.clear(choice);
        vscode.window.showInformationMessage(`AI Voice Studio: ${providers_1.PROVIDER_LABELS[choice]} API key cleared.`);
        void postActiveKeyStatus();
    }), vscode.commands.registerCommand("aiVoiceStudio.focusView", () => {
        vscode.commands.executeCommand("aiVoiceStudio.studio.focus");
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("aiVoiceStudio")) {
            refreshConfig();
        }
    }));
}
function deactivate() {
    // no-op
}
async function pickProvider(title) {
    const items = providers_1.PROVIDER_IDS.map((id) => ({ label: providers_1.PROVIDER_LABELS[id], id }));
    const picked = await vscode.window.showQuickPick(items, { title, ignoreFocusOut: true });
    return picked && (0, providers_1.isProviderId)(picked.id) ? picked.id : undefined;
}
async function applyModelChange(provider, model, voice) {
    await (0, config_1.setProviderModel)(provider, model);
    if (voice?.trim()) {
        await (0, config_1.setProviderVoice)(provider, voice.trim());
    }
}
async function resolveTextToRead() {
    const editor = vscode.window.activeTextEditor;
    if (editor && !editor.selection.isEmpty) {
        return editor.document.getText(editor.selection);
    }
    try {
        const clip = await vscode.env.clipboard.readText();
        if (clip.trim())
            return clip;
    }
    catch {
        // ignore clipboard errors
    }
    return undefined;
}
function buildProviderArgs(cfg, apiKey, context) {
    const catalog = synthesize_1.CATALOGS[cfg.provider];
    switch (cfg.provider) {
        case "mimo": {
            const voice = resolveVoiceId(catalog, cfg.mimo.voice, cfg.mimo.model);
            if (!voice)
                return undefined;
            const cloneRecord = (0, config_1.getMiMoVoiceCloneSample)(context.globalState);
            const voiceCloneSample = cloneRecord
                ? { dataUrl: cloneRecord.dataUrl, sizeBytes: cloneRecord.sizeBytes }
                : undefined;
            return {
                provider: "mimo",
                apiKey,
                baseUrl: cfg.mimo.baseUrl,
                model: cfg.mimo.model,
                voice,
                format: cfg.mimo.format,
                stylePrompt: cfg.mimo.stylePrompt || undefined,
                openingStyleTags: cfg.mimo.openingStyleTags.length ? cfg.mimo.openingStyleTags : undefined,
                audioEventTags: cfg.mimo.audioEventTags.length ? cfg.mimo.audioEventTags : undefined,
                voiceCloneSample,
            };
        }
        case "gemini": {
            const voice = resolveVoiceId(catalog, cfg.gemini.voice, cfg.gemini.model);
            if (!voice)
                return undefined;
            return {
                provider: "gemini",
                apiKey,
                baseUrl: cfg.gemini.baseUrl,
                model: cfg.gemini.model,
                voice,
                format: "wav",
                stylePreamble: cfg.gemini.stylePreamble || undefined,
            };
        }
        case "qwen": {
            const voice = resolveVoiceId(catalog, cfg.qwen.voice, cfg.qwen.model);
            if (!voice)
                return undefined;
            return {
                provider: "qwen",
                apiKey,
                endpoint: cfg.qwen.endpoint,
                model: cfg.qwen.model,
                voice,
                languageType: cfg.qwen.languageType,
                instructions: cfg.qwen.instructions || undefined,
            };
        }
    }
}
function resolveVoiceId(catalog, voiceId, model) {
    const voice = (0, providers_1.getVoiceById)(catalog, voiceId);
    if (voice && (0, providers_1.isVoiceAvailableForModel)(voice, model))
        return voice.id;
    return (0, providers_1.getVoicesForModel)(catalog, model)[0]?.id;
}
function describeVoice(cfg) {
    const catalog = synthesize_1.CATALOGS[cfg.provider];
    const { voiceId, model } = pickVoiceAndModel(cfg);
    const resolved = resolveVoiceId(catalog, voiceId, model);
    const voice = resolved ? (0, providers_1.getVoiceById)(catalog, resolved) : undefined;
    return voice?.name ?? resolved ?? voiceId;
}
function pickVoiceAndModel(cfg) {
    switch (cfg.provider) {
        case "mimo":
            return { voiceId: cfg.mimo.voice, model: cfg.mimo.model };
        case "gemini":
            return { voiceId: cfg.gemini.voice, model: cfg.gemini.model };
        case "qwen":
            return { voiceId: cfg.qwen.voice, model: cfg.qwen.model };
    }
}
async function applyPresetSave(preset) {
    const cfg = (0, config_1.getConfig)();
    const filtered = cfg.mimo.stylePresets.filter((p) => p.name !== preset.name);
    filtered.push({
        name: preset.name,
        stylePrompt: preset.stylePrompt ?? "",
        openingStyleTags: Array.isArray(preset.openingStyleTags) ? preset.openingStyleTags : [],
        audioEventTags: Array.isArray(preset.audioEventTags) ? preset.audioEventTags : [],
    });
    await (0, config_1.setMiMoStylePresets)(filtered);
}
async function applyPresetApply(preset) {
    await Promise.all([
        (0, config_1.setMiMoStylePrompt)(preset.stylePrompt ?? ""),
        (0, config_1.setMiMoOpeningStyleTags)(preset.openingStyleTags ?? []),
        (0, config_1.setMiMoAudioEventTags)(preset.audioEventTags ?? []),
    ]);
}
async function applyPresetByName(name) {
    const cfg = (0, config_1.getConfig)();
    const found = cfg.mimo.stylePresets.find((p) => p.name === name);
    if (!found)
        return;
    await applyPresetApply(found);
}
async function applyPresetDelete(name) {
    const cfg = (0, config_1.getConfig)();
    const filtered = cfg.mimo.stylePresets.filter((p) => p.name !== name);
    if (filtered.length === cfg.mimo.stylePresets.length)
        return;
    await (0, config_1.setMiMoStylePresets)(filtered);
}
function handleError(err, provider) {
    if (err instanceof providers_1.TTSApiError) {
        if (err.code === -7) {
            provider.postStatus("Cancelled.", "muted");
            return;
        }
        provider.postStatus(err.message, "error");
        vscode.window.showErrorMessage(`AI Voice Studio: ${err.message}`);
        return;
    }
    const message = err instanceof Error ? err.message : String(err);
    provider.postStatus(message, "error");
    vscode.window.showErrorMessage(`AI Voice Studio: ${message}`);
}
//# sourceMappingURL=extension.js.map