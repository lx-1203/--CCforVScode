"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TTSApiError = exports.PROVIDER_LABELS = exports.PROVIDER_IDS = void 0;
exports.isProviderId = isProviderId;
exports.getVoiceById = getVoiceById;
exports.isVoiceAvailableForModel = isVoiceAvailableForModel;
exports.getVoicesForModel = getVoicesForModel;
exports.PROVIDER_IDS = ["qwen", "mimo", "gemini"];
exports.PROVIDER_LABELS = {
    qwen: "Qwen",
    mimo: "MiMo",
    gemini: "Gemini",
};
class TTSApiError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "TTSApiError";
    }
}
exports.TTSApiError = TTSApiError;
function isProviderId(value) {
    return value === "qwen" || value === "mimo" || value === "gemini";
}
function getVoiceById(catalog, id) {
    return catalog.voices.find((v) => v.id === id);
}
function isVoiceAvailableForModel(voice, model) {
    return voice.models.length === 0 || voice.models.includes(model);
}
function getVoicesForModel(catalog, model) {
    return catalog.voices.filter((v) => isVoiceAvailableForModel(v, model));
}
//# sourceMappingURL=providers.js.map