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
exports.SecretsStore = void 0;
const vscode = __importStar(require("vscode"));
const SECRET_KEYS = {
    mimo: "aiVoiceStudio.mimo.apiKey",
    gemini: "aiVoiceStudio.gemini.apiKey",
    qwen: "aiVoiceStudio.qwen.dashscopeApiKey",
};
const ENV_FALLBACKS = {
    qwen: ["DASHSCOPE_API_KEY"],
    gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
};
const PROMPT_TITLES = {
    mimo: "MiMo Token Plan API key (tp-…)",
    gemini: "Google AI Studio API key",
    qwen: "Qwen DashScope API key",
};
const PLACEHOLDERS = {
    mimo: "tp-...",
    gemini: "AIzaSy...",
    qwen: "DASHSCOPE_API_KEY / sk-...",
};
class SecretsStore {
    secrets;
    constructor(secrets) {
        this.secrets = secrets;
    }
    async get(provider) {
        const stored = (await this.secrets.get(SECRET_KEYS[provider]))?.trim();
        if (stored)
            return stored;
        const envNames = ENV_FALLBACKS[provider] ?? [];
        for (const name of envNames) {
            const value = process.env[name]?.trim();
            if (value)
                return value;
        }
        return undefined;
    }
    async set(provider, key) {
        await this.secrets.store(SECRET_KEYS[provider], key);
    }
    async clear(provider) {
        await this.secrets.delete(SECRET_KEYS[provider]);
    }
    async ensure(provider) {
        const existing = await this.get(provider);
        if (existing)
            return existing;
        const value = await vscode.window.showInputBox({
            title: PROMPT_TITLES[provider],
            prompt: "Stored in VS Code SecretStorage. Leave empty to cancel.",
            password: true,
            ignoreFocusOut: true,
            placeHolder: PLACEHOLDERS[provider],
            validateInput: (input) => (input.trim().length === 0 ? "API key cannot be empty." : null),
        });
        if (!value)
            return undefined;
        const trimmed = value.trim();
        if (!trimmed)
            return undefined;
        await this.set(provider, trimmed);
        return trimmed;
    }
}
exports.SecretsStore = SecretsStore;
//# sourceMappingURL=secrets.js.map