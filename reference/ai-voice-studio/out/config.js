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
exports.getConfig = getConfig;
exports.setMiMoOpeningStyleTags = setMiMoOpeningStyleTags;
exports.setGeminiStylePreamble = setGeminiStylePreamble;
exports.setMiMoAudioEventTags = setMiMoAudioEventTags;
exports.setMiMoStylePrompt = setMiMoStylePrompt;
exports.setMiMoStylePresets = setMiMoStylePresets;
exports.setQwenEndpoint = setQwenEndpoint;
exports.setQwenLanguageType = setQwenLanguageType;
exports.setQwenInstructions = setQwenInstructions;
exports.getMiMoVoiceCloneSample = getMiMoVoiceCloneSample;
exports.setMiMoVoiceCloneSample = setMiMoVoiceCloneSample;
exports.setPlaybackRate = setPlaybackRate;
exports.setProvider = setProvider;
exports.setProviderVoice = setProviderVoice;
exports.setProviderModel = setProviderModel;
const vscode = __importStar(require("vscode"));
const providers_1 = require("./core/providers");
const mimo_voices_1 = require("./core/mimo-voices");
const gemini_voices_1 = require("./core/gemini-voices");
const qwen_voices_1 = require("./core/qwen-voices");
const SECTION = "aiVoiceStudio";
function getConfig() {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    const mimoModel = normalizeMiMoModel(cfg.get("mimo.model"));
    return {
        provider: normalizeProvider(cfg.get("provider")),
        playbackRate: clampRate(cfg.get("playbackRate") ?? 1),
        chunkSize: clampChunkSize(cfg.get("chunkSize") ?? 250),
        mimo: {
            model: mimoModel,
            voice: (0, mimo_voices_1.normalizeMiMoVoice)(cfg.get("mimo.voice"), mimoModel),
            format: normalizeMiMoFormat(cfg.get("mimo.format")),
            baseUrl: getTrimmedString(cfg, "mimo.baseUrl") || mimo_voices_1.DEFAULT_BASE_URL,
            stylePrompt: getString(cfg, "mimo.stylePrompt"),
            openingStyleTags: normalizeTagList(cfg.get("mimo.openingStyleTags")),
            audioEventTags: normalizeTagList(cfg.get("mimo.audioEventTags")),
            stylePresets: normalizePresetList(cfg.get("mimo.stylePresets")),
        },
        gemini: {
            model: normalizeGeminiModel(cfg.get("gemini.model")),
            voice: getTrimmedString(cfg, "gemini.voice") || gemini_voices_1.DEFAULT_VOICE,
            baseUrl: getTrimmedString(cfg, "gemini.baseUrl") || gemini_voices_1.DEFAULT_BASE_URL,
            stylePreamble: getString(cfg, "gemini.stylePreamble"),
        },
        qwen: {
            model: normalizeQwenModel(cfg.get("qwen.model")),
            voice: getTrimmedString(cfg, "qwen.voice") || qwen_voices_1.DEFAULT_VOICE,
            endpoint: normalizeQwenEndpoint(cfg.get("qwen.endpoint")),
            languageType: normalizeQwenLanguageType(cfg.get("qwen.languageType")),
            instructions: getString(cfg, "qwen.instructions"),
        },
    };
}
async function setMiMoOpeningStyleTags(tags) {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update("mimo.openingStyleTags", tags, vscode.ConfigurationTarget.Global);
}
async function setGeminiStylePreamble(text) {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update("gemini.stylePreamble", text, vscode.ConfigurationTarget.Global);
}
async function setMiMoAudioEventTags(tags) {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update("mimo.audioEventTags", tags, vscode.ConfigurationTarget.Global);
}
async function setMiMoStylePrompt(text) {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update("mimo.stylePrompt", text, vscode.ConfigurationTarget.Global);
}
async function setMiMoStylePresets(presets) {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update("mimo.stylePresets", presets, vscode.ConfigurationTarget.Global);
}
async function setQwenEndpoint(endpoint) {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update("qwen.endpoint", normalizeQwenEndpoint(endpoint), vscode.ConfigurationTarget.Global);
}
async function setQwenLanguageType(languageType) {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update("qwen.languageType", normalizeQwenLanguageType(languageType), vscode.ConfigurationTarget.Global);
}
async function setQwenInstructions(text) {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update("qwen.instructions", text, vscode.ConfigurationTarget.Global);
}
const MIMO_VOICE_CLONE_KEY = "mimo.voiceCloneSample";
function getMiMoVoiceCloneSample(state) {
    const raw = state.get(MIMO_VOICE_CLONE_KEY);
    if (!raw || typeof raw !== "object")
        return undefined;
    const record = raw;
    if (typeof record.dataUrl !== "string" ||
        typeof record.mime !== "string" ||
        typeof record.fileName !== "string" ||
        typeof record.sizeBytes !== "number" ||
        typeof record.storedAt !== "number") {
        return undefined;
    }
    return record;
}
async function setMiMoVoiceCloneSample(state, record) {
    await state.update(MIMO_VOICE_CLONE_KEY, record);
}
async function setPlaybackRate(rate) {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update("playbackRate", clampRate(rate), vscode.ConfigurationTarget.Global);
}
async function setProvider(provider) {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update("provider", provider, vscode.ConfigurationTarget.Global);
}
async function setProviderVoice(provider, voice) {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update(`${provider}.voice`, voice, vscode.ConfigurationTarget.Global);
}
async function setProviderModel(provider, model) {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update(`${provider}.model`, model, vscode.ConfigurationTarget.Global);
}
function normalizeProvider(value) {
    return (0, providers_1.isProviderId)(value) ? value : "qwen";
}
function getString(cfg, key) {
    const value = cfg.get(key);
    return typeof value === "string" ? value : "";
}
function getTrimmedString(cfg, key) {
    return getString(cfg, key).trim();
}
function normalizeMiMoModel(value) {
    if (value === "mimo-v2.5-tts" ||
        value === "mimo-v2.5-tts-voicedesign" ||
        value === "mimo-v2.5-tts-voiceclone" ||
        value === "mimo-v2-tts") {
        return value;
    }
    return mimo_voices_1.DEFAULT_MODEL;
}
function normalizeGeminiModel(value) {
    if (value === "gemini-3.1-flash-tts-preview" ||
        value === "gemini-2.5-flash-preview-tts" ||
        value === "gemini-2.5-pro-preview-tts") {
        return value;
    }
    return gemini_voices_1.DEFAULT_MODEL;
}
function normalizeMiMoFormat(value) {
    return value === "mp3" || value === "wav" ? value : mimo_voices_1.DEFAULT_FORMAT;
}
function normalizeQwenModel(value) {
    return (0, qwen_voices_1.isQwenModel)(value) ? value : qwen_voices_1.DEFAULT_MODEL;
}
function normalizeQwenEndpoint(value) {
    return (0, qwen_voices_1.isQwenEndpoint)(value) ? value : qwen_voices_1.DEFAULT_ENDPOINT;
}
function normalizeQwenLanguageType(value) {
    return (0, qwen_voices_1.isQwenLanguageType)(value) ? value : qwen_voices_1.DEFAULT_LANGUAGE_TYPE;
}
function clampRate(rate) {
    if (!Number.isFinite(rate))
        return 1;
    return Math.max(0.5, Math.min(4, rate));
}
function clampChunkSize(size) {
    if (!Number.isFinite(size))
        return 250;
    return Math.max(80, Math.min(2000, Math.round(size)));
}
function normalizeTagList(tags) {
    if (!Array.isArray(tags))
        return [];
    return Array.from(new Set(tags
        .filter((t) => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean)));
}
function normalizePresetList(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    const seen = new Set();
    for (const item of raw) {
        if (!item || typeof item !== "object")
            continue;
        const obj = item;
        const name = typeof obj.name === "string" ? obj.name.trim() : "";
        if (!name || seen.has(name))
            continue;
        seen.add(name);
        out.push({
            name,
            stylePrompt: typeof obj.stylePrompt === "string" ? obj.stylePrompt : "",
            openingStyleTags: normalizeTagList(Array.isArray(obj.openingStyleTags) ? obj.openingStyleTags : []),
            audioEventTags: normalizeTagList(Array.isArray(obj.audioEventTags) ? obj.audioEventTags : []),
        });
    }
    return out;
}
//# sourceMappingURL=config.js.map