"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeMiMo = synthesizeMiMo;
const providers_1 = require("./providers");
const mimo_voices_1 = require("./mimo-voices");
const REQUEST_TIMEOUT_MS = 90_000;
/** MiMo doc limit: base64-encoded audio sample ≤ 10 MB. */
const MAX_CLONE_BASE64_BYTES = 10 * 1024 * 1024;
async function synthesizeMiMo(args) {
    const text = args.text.trim();
    if (!text) {
        throw new providers_1.TTSApiError("Text cannot be empty.", -1);
    }
    if (!args.apiKey) {
        throw new providers_1.TTSApiError("MiMo API key is missing.", -1);
    }
    if (args.apiKey.startsWith("sk-")) {
        throw new providers_1.TTSApiError("Use a MiMo Token Plan key (tp-…), not a pay-as-you-go sk- key.", -1);
    }
    if (args.signal?.aborted) {
        throw new providers_1.TTSApiError("TTS synthesis cancelled.", -7);
    }
    const decoratedText = applyStyleTags(text, args.openingStyleTags, args.audioEventTags);
    const { messages, audio } = buildRequestPayload(args, decoratedText);
    const url = `${normalizeBaseUrl(args.baseUrl)}/chat/completions`;
    const body = {
        model: args.model,
        messages,
        audio,
        stream: false,
    };
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
    const onAbort = () => timeoutController.abort();
    args.signal?.addEventListener("abort", onAbort, { once: true });
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": args.apiKey,
            },
            body: JSON.stringify(body),
            signal: timeoutController.signal,
        });
        const raw = await response.text();
        const data = parseJson(raw);
        if (!response.ok) {
            throw new providers_1.TTSApiError(data.error?.message || `HTTP ${response.status} ${response.statusText}`, response.status);
        }
        if (data.error) {
            throw new providers_1.TTSApiError(data.error.message || "MiMo TTS request failed.", normalizeErrorCode(data.error.code));
        }
        const audioData = data.choices?.[0]?.message?.audio?.data;
        if (!audioData) {
            throw new providers_1.TTSApiError(`No audio data returned from MiMo (${describeVoice(args)}).`, -4);
        }
        return { audioBase64: normalizeBase64Audio(audioData, "MiMo"), format: args.format };
    }
    catch (error) {
        if (error instanceof providers_1.TTSApiError)
            throw error;
        if (args.signal?.aborted) {
            throw new providers_1.TTSApiError("TTS synthesis cancelled.", -7);
        }
        if (error instanceof Error && error.name === "AbortError") {
            throw new providers_1.TTSApiError(`Request timeout after ${REQUEST_TIMEOUT_MS / 1000}s`, -2);
        }
        throw new providers_1.TTSApiError(error instanceof Error ? error.message : String(error), -6);
    }
    finally {
        clearTimeout(timeoutId);
        args.signal?.removeEventListener("abort", onAbort);
    }
}
function buildRequestPayload(args, decoratedText) {
    const style = args.stylePrompt?.trim() ?? "";
    if ((0, mimo_voices_1.isVoiceDesignModel)(args.model)) {
        if (!style) {
            throw new providers_1.TTSApiError("Voice Design requires a description in the Style / Voice description field.", -1);
        }
        return {
            messages: [
                { role: "user", content: style },
                { role: "assistant", content: decoratedText },
            ],
            // Doc explicitly omits the voice field for voicedesign requests.
            audio: { format: args.format },
        };
    }
    if ((0, mimo_voices_1.isVoiceCloneModel)(args.model)) {
        const sample = args.voiceCloneSample;
        if (!sample) {
            throw new providers_1.TTSApiError("Voice Clone requires an uploaded audio sample (mp3 or wav).", -1);
        }
        validateCloneSample(sample);
        const messages = [];
        // user content can be empty per the doc, but if a style prompt is set we forward it.
        messages.push({ role: "user", content: style });
        messages.push({ role: "assistant", content: decoratedText });
        return {
            messages,
            audio: { format: args.format, voice: sample.dataUrl },
        };
    }
    // Preset models (mimo-v2.5-tts / mimo-v2-tts).
    if (!(0, mimo_voices_1.isPresetModel)(args.model)) {
        throw new providers_1.TTSApiError(`Unsupported MiMo model: ${args.model}`, -1);
    }
    const messages = [];
    if (style) {
        messages.push({ role: "user", content: style });
    }
    messages.push({ role: "assistant", content: decoratedText });
    return {
        messages,
        audio: { format: args.format, voice: args.voice },
    };
}
function validateCloneSample(sample) {
    const match = sample.dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
    if (!match) {
        throw new providers_1.TTSApiError("Voice clone sample must be a base64 data URL.", -1);
    }
    const mime = match[1].toLowerCase();
    const allowedMime = mime === "audio/mpeg" || mime === "audio/mp3" || mime === "audio/wav" || mime === "audio/x-wav";
    if (!allowedMime) {
        throw new providers_1.TTSApiError(`Voice clone sample MIME ${mime} is not supported. Use audio/mpeg or audio/wav.`, -1);
    }
    // Doc constraint: base64 string itself ≤ 10 MB.
    if (match[2].length > MAX_CLONE_BASE64_BYTES) {
        throw new providers_1.TTSApiError(`Voice clone sample exceeds 10 MB (base64). Provide a shorter clip.`, -1);
    }
}
function applyStyleTags(text, openingStyleTags, audioEventTags) {
    const opening = normalizeTags(openingStyleTags);
    const events = normalizeTags(audioEventTags);
    if (opening.some(isSingingTag)) {
        return `(唱歌)${text}`;
    }
    const stylePrefix = opening.length > 0 ? `(${opening.join(" ")})` : "";
    const eventPrefix = events.length > 0 ? `（${events.join("，")}）` : "";
    return `${stylePrefix}${eventPrefix}${text}`;
}
function normalizeTags(tags) {
    return Array.from(new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean)));
}
function isSingingTag(tag) {
    return ["唱歌", "sing", "singing"].includes(tag.toLowerCase());
}
function describeVoice(args) {
    if ((0, mimo_voices_1.isVoiceDesignModel)(args.model))
        return "voice-design";
    if ((0, mimo_voices_1.isVoiceCloneModel)(args.model))
        return "voice-clone";
    return args.voice;
}
function parseJson(raw) {
    try {
        return JSON.parse(raw);
    }
    catch {
        return { error: { message: raw || "MiMo TTS returned a non-JSON response." } };
    }
}
function normalizeErrorCode(code) {
    if (typeof code === "number")
        return code;
    const parsed = Number(code);
    return Number.isFinite(parsed) ? parsed : -6;
}
function normalizeBaseUrl(baseUrl) {
    return baseUrl.replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
}
function normalizeBase64Audio(value, provider) {
    const clean = value.replace(/\s+/g, "");
    const padded = clean.padEnd(Math.ceil(clean.length / 4) * 4, "=");
    if (!isBase64(padded) || Buffer.from(padded, "base64").length === 0) {
        throw new providers_1.TTSApiError(`${provider} returned malformed base64 audio data.`, -4);
    }
    return padded;
}
function isBase64(value) {
    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}
//# sourceMappingURL=mimo-tts.js.map