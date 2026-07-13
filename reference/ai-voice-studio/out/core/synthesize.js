"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATALOGS = void 0;
exports.synthesize = synthesize;
const mimo_voices_1 = require("./mimo-voices");
const mimo_tts_1 = require("./mimo-tts");
const gemini_voices_1 = require("./gemini-voices");
const gemini_tts_1 = require("./gemini-tts");
const qwen_voices_1 = require("./qwen-voices");
const qwen_tts_1 = require("./qwen-tts");
exports.CATALOGS = {
    mimo: mimo_voices_1.MIMO_CATALOG,
    gemini: gemini_voices_1.GEMINI_CATALOG,
    qwen: qwen_voices_1.QWEN_CATALOG,
};
async function synthesize(ctx, args) {
    switch (args.provider) {
        case "mimo":
            return (0, mimo_tts_1.synthesizeMiMo)({ ...ctx, ...args });
        case "gemini":
            return (0, gemini_tts_1.synthesizeGemini)({ ...ctx, ...args });
        case "qwen":
            return (0, qwen_tts_1.synthesizeQwen)({ ...ctx, ...args });
    }
}
//# sourceMappingURL=synthesize.js.map