"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeGemini = synthesizeGemini;
const providers_1 = require("./providers");
const REQUEST_TIMEOUT_MS = 120_000;
/**
 * Gemini speech-generation returns headerless 16-bit signed little-endian
 * mono PCM at 24 kHz. We always wrap into WAV before handing the bytes to
 * the webview audio element.
 */
const PCM_SAMPLE_RATE = 24_000;
const PCM_CHANNELS = 1;
const PCM_BITS_PER_SAMPLE = 16;
async function synthesizeGemini(args) {
    const text = args.text.trim();
    if (!text) {
        throw new providers_1.TTSApiError("Text cannot be empty.", -1);
    }
    if (!args.apiKey) {
        throw new providers_1.TTSApiError("Gemini API key is missing.", -1);
    }
    if (args.signal?.aborted) {
        throw new providers_1.TTSApiError("TTS synthesis cancelled.", -7);
    }
    const transcript = composeTranscript(text, args.stylePreamble);
    const url = `${normalizeBaseUrl(args.baseUrl)}/models/${encodeURIComponent(args.model)}:generateContent`;
    const body = {
        contents: [{ parts: [{ text: transcript }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: args.voice },
                },
            },
        },
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
                "x-goog-api-key": args.apiKey,
            },
            body: JSON.stringify(body),
            signal: timeoutController.signal,
        });
        const raw = await response.text();
        const data = parseJson(raw);
        if (!response.ok) {
            const detail = data.error?.message || raw || `HTTP ${response.status} ${response.statusText}`;
            throw new providers_1.TTSApiError(detail, response.status);
        }
        if (data.error) {
            throw new providers_1.TTSApiError(data.error.message || "Gemini TTS request failed.", data.error.code ?? -6);
        }
        if (data.promptFeedback?.blockReason) {
            throw new providers_1.TTSApiError(`Gemini blocked the request: ${data.promptFeedback.blockReason}. Try rephrasing or shortening the text.`, -1);
        }
        const part = data.candidates?.[0]?.content?.parts?.[0];
        const inline = part?.inlineData ?? part?.inline_data;
        const audioBase64 = inline?.data;
        if (!audioBase64) {
            const finish = data.candidates?.[0]?.finishReason;
            throw new providers_1.TTSApiError(finish && finish !== "STOP"
                ? `No audio data returned (finishReason=${finish}).`
                : "No audio data returned from Gemini.", -4);
        }
        const mimeType = inline?.mimeType ?? "audio/L16;codec=pcm;rate=24000";
        const sampleRate = parseSampleRate(mimeType) ?? PCM_SAMPLE_RATE;
        const wavBase64 = wrapPcmAsWav(audioBase64, sampleRate, PCM_CHANNELS, PCM_BITS_PER_SAMPLE);
        return { audioBase64: wavBase64, format: "wav" };
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
function composeTranscript(text, stylePreamble) {
    const preamble = stylePreamble?.trim();
    if (!preamble)
        return text;
    return preamble.endsWith(":") ? `${preamble} ${text}` : `${preamble}: ${text}`;
}
function parseJson(raw) {
    try {
        return JSON.parse(raw);
    }
    catch {
        return { error: { message: raw || "Gemini TTS returned a non-JSON response." } };
    }
}
function normalizeBaseUrl(baseUrl) {
    return baseUrl.replace(/\/+$/, "");
}
function parseSampleRate(mimeType) {
    const match = mimeType.match(/rate=(\d+)/i);
    if (!match)
        return null;
    const rate = Number(match[1]);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
}
/**
 * Wrap raw PCM bytes in a 44-byte RIFF/WAV header so the webview <audio>
 * element can play it without any extra decoding on the JS side.
 */
function wrapPcmAsWav(pcmBase64, sampleRate, channels, bitsPerSample) {
    const pcm = decodeBase64Pcm(pcmBase64);
    const byteRate = (sampleRate * channels * bitsPerSample) / 8;
    const blockAlign = (channels * bitsPerSample) / 8;
    const dataSize = pcm.length;
    const chunkSize = 36 + dataSize;
    const header = Buffer.alloc(44);
    header.write("RIFF", 0, 4, "ascii");
    header.writeUInt32LE(chunkSize, 4);
    header.write("WAVE", 8, 4, "ascii");
    header.write("fmt ", 12, 4, "ascii");
    header.writeUInt32LE(16, 16); // Subchunk1Size for PCM
    header.writeUInt16LE(1, 20); // AudioFormat = PCM
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write("data", 36, 4, "ascii");
    header.writeUInt32LE(dataSize, 40);
    return Buffer.concat([header, pcm]).toString("base64");
}
function decodeBase64Pcm(value) {
    const clean = value.replace(/\s+/g, "");
    const padded = clean.padEnd(Math.ceil(clean.length / 4) * 4, "=");
    if (!isBase64(padded)) {
        throw new providers_1.TTSApiError("Gemini returned malformed base64 audio data.", -4);
    }
    const pcm = Buffer.from(padded, "base64");
    if (pcm.length === 0) {
        throw new providers_1.TTSApiError("Gemini returned empty PCM audio data.", -4);
    }
    return pcm;
}
function isBase64(value) {
    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}
//# sourceMappingURL=gemini-tts.js.map