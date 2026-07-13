"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NON_REALTIME_MODELS = exports.QWEN_CATALOG = exports.VOICES = exports.MODEL_DESCRIPTIONS = exports.MODEL_LABELS = exports.LANGUAGE_TYPES = exports.REALTIME_WS_URLS = exports.ENDPOINT_URLS = exports.DEFAULT_LANGUAGE_TYPE = exports.DEFAULT_ENDPOINT = exports.DEFAULT_VOICE = exports.DEFAULT_MODEL = void 0;
exports.isQwenModel = isQwenModel;
exports.isRealtimeModel = isRealtimeModel;
exports.isQwenEndpoint = isQwenEndpoint;
exports.isQwenLanguageType = isQwenLanguageType;
exports.supportsInstructions = supportsInstructions;
exports.DEFAULT_MODEL = "qwen3-tts-flash";
exports.DEFAULT_VOICE = "Cherry";
exports.DEFAULT_ENDPOINT = "china";
exports.DEFAULT_LANGUAGE_TYPE = "Auto";
exports.ENDPOINT_URLS = {
    china: "https://dashscope.aliyuncs.com/api/v1",
    international: "https://dashscope-intl.aliyuncs.com/api/v1",
};
exports.REALTIME_WS_URLS = {
    china: "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
    international: "wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime",
};
exports.LANGUAGE_TYPES = [
    { id: "Auto", label: "Auto" },
    { id: "Chinese", label: "Chinese" },
    { id: "English", label: "English" },
    { id: "German", label: "German" },
];
exports.MODEL_LABELS = {
    "qwen3-tts-flash": "Qwen3 TTS Flash (HTTP SSE)",
    "qwen3-tts-instruct-flash": "Qwen3 TTS Instruct Flash (HTTP SSE)",
    "qwen3-tts-flash-realtime": "Qwen3 TTS Flash Realtime (WebSocket)",
    "qwen3-tts-instruct-flash-realtime": "Qwen3 TTS Instruct Flash Realtime (WebSocket)",
};
exports.MODEL_DESCRIPTIONS = {
    "qwen3-tts-flash": "Default HTTP SSE streaming model. Sub-second first audio.",
    "qwen3-tts-instruct-flash": "HTTP SSE model that accepts style instructions.",
    "qwen3-tts-flash-realtime": "WebSocket realtime model. ~100 ms first audio.",
    "qwen3-tts-instruct-flash-realtime": "WebSocket realtime model with style instructions.",
};
const ALL_MODELS = [
    "qwen3-tts-flash",
    "qwen3-tts-instruct-flash",
    "qwen3-tts-flash-realtime",
    "qwen3-tts-instruct-flash-realtime",
];
const NON_REALTIME_FLASH_ONLY = ["qwen3-tts-flash"];
const NON_REALTIME_BOTH = ["qwen3-tts-flash", "qwen3-tts-instruct-flash"];
const ALL = ALL_MODELS;
exports.VOICES = [
    {
        id: "Cherry",
        name: "Cherry / 芊悦",
        category: "General",
        description: "Sunny, friendly female voice. Supports Chinese, English, German, and other listed languages.",
        models: ALL,
        recommended: true,
    },
    {
        id: "Serena",
        name: "Serena / 苏瑶",
        category: "General",
        description: "Natural female voice for narration and conversation.",
        models: ALL,
    },
    {
        id: "Ethan",
        name: "Ethan / 晨煦",
        category: "General",
        description: "Warm male voice for long-form reading.",
        models: ALL,
    },
    {
        id: "Chelsie",
        name: "Chelsie / 千雪",
        category: "General",
        description: "Clear female voice with a composed tone.",
        models: ALL,
    },
    {
        id: "Kai",
        name: "Kai / 凯",
        category: "General",
        description: "Natural male voice for multilingual reading.",
        models: ALL,
    },
    {
        id: "Dylan",
        name: "Dylan / 北京-晓东",
        category: "Chinese Dialect",
        description: "Beijing dialect voice; also supports English, German, and other listed languages.",
        models: NON_REALTIME_FLASH_ONLY,
    },
    {
        id: "Jada",
        name: "Jada / 上海-阿珍",
        category: "Chinese Dialect",
        description: "Shanghainese voice; also supports English, German, and other listed languages.",
        models: NON_REALTIME_FLASH_ONLY,
    },
    {
        id: "Sunny",
        name: "Sunny / 四川-晴儿",
        category: "Chinese Dialect",
        description: "Sichuan dialect voice; also supports English, German, and other listed languages.",
        models: NON_REALTIME_FLASH_ONLY,
    },
];
exports.QWEN_CATALOG = {
    id: "qwen",
    label: "Qwen",
    models: ALL_MODELS.map((id) => ({ id, label: exports.MODEL_LABELS[id], description: exports.MODEL_DESCRIPTIONS[id] })),
    voices: exports.VOICES,
    defaults: {
        model: exports.DEFAULT_MODEL,
        voice: exports.DEFAULT_VOICE,
        format: "wav",
    },
};
function isQwenModel(value) {
    if (!value)
        return false;
    return ALL_MODELS.includes(value);
}
function isRealtimeModel(model) {
    return model === "qwen3-tts-flash-realtime" || model === "qwen3-tts-instruct-flash-realtime";
}
function isQwenEndpoint(value) {
    return value === "china" || value === "international";
}
function isQwenLanguageType(value) {
    return value === "Auto" || value === "Chinese" || value === "English" || value === "German";
}
function supportsInstructions(model) {
    return model === "qwen3-tts-instruct-flash" || model === "qwen3-tts-instruct-flash-realtime";
}
// `NON_REALTIME_BOTH` is exported to make the relationship explicit at compile
// time (some dialect-only voices intentionally exclude realtime); the symbol
// is not currently consumed externally.
exports.NON_REALTIME_MODELS = NON_REALTIME_BOTH;
//# sourceMappingURL=qwen-voices.js.map