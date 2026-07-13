"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GEMINI_CATALOG = exports.AUDIO_TAG_PRESETS = exports.VOICES = exports.MODEL_DESCRIPTIONS = exports.MODEL_LABELS = exports.DEFAULT_BASE_URL = exports.DEFAULT_FORMAT = exports.DEFAULT_VOICE = exports.DEFAULT_MODEL = void 0;
exports.isGeminiModel = isGeminiModel;
exports.DEFAULT_MODEL = "gemini-3.1-flash-tts-preview";
exports.DEFAULT_VOICE = "Kore";
exports.DEFAULT_FORMAT = "wav";
exports.DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
exports.MODEL_LABELS = {
    "gemini-3.1-flash-tts-preview": "Gemini 3.1 Flash TTS · Preview",
    "gemini-2.5-flash-preview-tts": "Gemini 2.5 Flash · Preview TTS",
    "gemini-2.5-pro-preview-tts": "Gemini 2.5 Pro · Preview TTS",
};
exports.MODEL_DESCRIPTIONS = {
    "gemini-3.1-flash-tts-preview": "Latest Gemini speech preview. 30 prebuilt voices, 60+ languages, inline style preambles + [audio tags]. Free on the AI Studio free tier.",
    "gemini-2.5-flash-preview-tts": "Earlier Flash TTS preview. Same 30-voice roster, slightly different rate limits.",
    "gemini-2.5-pro-preview-tts": "Pro variant of the Gemini 2.5 TTS preview. Higher quality, smaller free tier.",
};
const ALL_MODELS = [
    "gemini-3.1-flash-tts-preview",
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts",
];
const SEEDS = [
    { id: "Zephyr", hint: "Bright", category: "Bright", recommended: true },
    { id: "Puck", hint: "Upbeat", category: "Bright", recommended: true },
    { id: "Charon", hint: "Informative", category: "Calm", recommended: true },
    { id: "Kore", hint: "Firm", category: "Calm", recommended: true },
    { id: "Fenrir", hint: "Excitable", category: "Expressive" },
    { id: "Leda", hint: "Youthful", category: "Bright" },
    { id: "Orus", hint: "Firm", category: "Calm" },
    { id: "Aoede", hint: "Breezy", category: "Warm" },
    { id: "Callirrhoe", hint: "Easy-going", category: "Warm" },
    { id: "Autonoe", hint: "Bright", category: "Bright" },
    { id: "Enceladus", hint: "Breathy", category: "Distinctive" },
    { id: "Iapetus", hint: "Clear", category: "Clear" },
    { id: "Umbriel", hint: "Easy-going", category: "Warm" },
    { id: "Algieba", hint: "Smooth", category: "Warm" },
    { id: "Despina", hint: "Smooth", category: "Warm" },
    { id: "Erinome", hint: "Clear", category: "Clear" },
    { id: "Algenib", hint: "Gravelly", category: "Distinctive" },
    { id: "Rasalgethi", hint: "Informative", category: "Calm" },
    { id: "Laomedeia", hint: "Upbeat", category: "Bright" },
    { id: "Achernar", hint: "Soft", category: "Warm" },
    { id: "Alnilam", hint: "Firm", category: "Calm" },
    { id: "Schedar", hint: "Even", category: "Calm" },
    { id: "Gacrux", hint: "Mature", category: "Distinctive" },
    { id: "Pulcherrima", hint: "Forward", category: "Expressive" },
    { id: "Achird", hint: "Friendly", category: "Warm" },
    { id: "Zubenelgenubi", hint: "Casual", category: "Warm" },
    { id: "Vindemiatrix", hint: "Gentle", category: "Warm" },
    { id: "Sadachbia", hint: "Lively", category: "Bright" },
    { id: "Sadaltager", hint: "Knowledgeable", category: "Calm" },
    { id: "Sulafat", hint: "Warm", category: "Warm" },
];
exports.VOICES = SEEDS.map((seed) => ({
    id: seed.id,
    name: `${seed.id}`,
    category: seed.category,
    description: `${seed.hint}. Voices are language-agnostic; the model auto-detects the input language.`,
    models: ALL_MODELS,
    recommended: seed.recommended,
}));
/**
 * Inline audio tags. Documented as English-only even when the transcript is in
 * another language. They render as `[laughs]`, `[whispers]`, etc., inside the
 * transcript rather than as a separate field.
 */
exports.AUDIO_TAG_PRESETS = [
    "[whispers]",
    "[shouting]",
    "[excitedly]",
    "[bored]",
    "[sighs]",
    "[gasp]",
    "[laughs]",
    "[very fast]",
    "[very slow]",
    "[sarcastic]",
    "[cough]",
    "[crying]",
    "[curious]",
    "[mischievously]",
    "[panicked]",
    "[serious]",
    "[tired]",
    "[trembling]",
    "[giggles]",
    "[amazed]",
];
function isGeminiModel(value) {
    return (value === "gemini-3.1-flash-tts-preview" ||
        value === "gemini-2.5-flash-preview-tts" ||
        value === "gemini-2.5-pro-preview-tts");
}
exports.GEMINI_CATALOG = {
    id: "gemini",
    label: "Gemini",
    models: Object.keys(exports.MODEL_LABELS).map((id) => ({
        id,
        label: exports.MODEL_LABELS[id],
        description: exports.MODEL_DESCRIPTIONS[id],
    })),
    voices: exports.VOICES,
    defaults: {
        model: exports.DEFAULT_MODEL,
        voice: exports.DEFAULT_VOICE,
        format: exports.DEFAULT_FORMAT,
    },
};
//# sourceMappingURL=gemini-voices.js.map