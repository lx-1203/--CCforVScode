"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeQwen = synthesizeQwen;
const providers_1 = require("./providers");
const qwen_voices_1 = require("./qwen-voices");
const qwen_tts_realtime_1 = require("./qwen-tts-realtime");
const REQUEST_TIMEOUT_MS = 90_000;
const TTFB_TIMEOUT_MS = 15_000;
const GENERATION_PATH = "/services/aigc/multimodal-generation/generation";
async function synthesizeQwen(args) {
    const text = args.text.trim();
    if (!text) {
        throw new providers_1.TTSApiError("Text cannot be empty.", -1);
    }
    if (!args.apiKey) {
        throw new providers_1.TTSApiError("Qwen DashScope API key is missing. Set DASHSCOPE_API_KEY or save a Qwen DashScope key.", -1);
    }
    if (args.signal?.aborted) {
        throw new providers_1.TTSApiError("TTS synthesis cancelled.", -7);
    }
    // Realtime models go over WebSocket. They require streaming sub-chunks.
    if ((0, qwen_voices_1.isRealtimeModel)(args.model)) {
        if (!args.onSubChunk) {
            throw new providers_1.TTSApiError(`${args.model} requires streaming playback (onSubChunk). Pick a non-realtime model for buffered playback.`, -1);
        }
        return (0, qwen_tts_realtime_1.synthesizeQwenRealtime)({
            text,
            signal: args.signal,
            apiKey: args.apiKey,
            endpoint: args.endpoint,
            model: args.model,
            voice: args.voice,
            languageType: args.languageType,
            instructions: args.instructions,
            onSubChunk: args.onSubChunk,
        });
    }
    const input = {
        text,
        voice: args.voice,
        language_type: args.languageType,
    };
    const instructions = args.instructions?.trim();
    if (instructions && (0, qwen_voices_1.supportsInstructions)(args.model)) {
        input.instructions = instructions;
    }
    const body = {
        model: args.model,
        input,
    };
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
    let ttfbTimeoutId = setTimeout(() => timeoutController.abort(), TTFB_TIMEOUT_MS);
    const clearTtfbTimer = () => {
        if (ttfbTimeoutId !== undefined) {
            clearTimeout(ttfbTimeoutId);
            ttfbTimeoutId = undefined;
        }
    };
    const onAbort = () => timeoutController.abort();
    args.signal?.addEventListener("abort", onAbort, { once: true });
    const headers = {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
    };
    if (args.onSubChunk)
        headers["X-DashScope-SSE"] = "enable";
    try {
        const response = await fetch(qwenGenerationUrl(qwen_voices_1.ENDPOINT_URLS[args.endpoint]), {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: timeoutController.signal,
        });
        // Response headers received — we're past TTFB. The remaining wall-clock
        // budget is governed by REQUEST_TIMEOUT_MS only.
        clearTtfbTimer();
        if (args.onSubChunk) {
            return await readStreamingResponse(response, args.onSubChunk, args.signal);
        }
        const raw = await response.text();
        const payload = parseJson(raw);
        if (!response.ok) {
            throw new providers_1.TTSApiError(readErrorDetail(payload, raw, response), response.status);
        }
        if (payload.error || payload.code) {
            const code = payload.error?.code ?? payload.code;
            throw new providers_1.TTSApiError(payload.error?.message ?? payload.message ?? "Qwen-TTS request failed.", normalizeErrorCode(code));
        }
        const audio = payload.output?.audio;
        if (audio?.data) {
            const audioBase64 = normalizeBase64Audio(audio.data, "Qwen-TTS");
            const declaredFormat = inferAudioFormat(audio.mime_type ?? audio.mimeType, audio.format, undefined, "pcm");
            return {
                audioBase64,
                format: hasAudioFormatHint(audio) ? declaredFormat : inferAudioFormatFromBase64(audioBase64, declaredFormat),
            };
        }
        if (audio?.url) {
            return downloadAudio(audio.url, timeoutController.signal);
        }
        const requestId = payload.request_id ? ` (request_id: ${payload.request_id})` : "";
        const finish = payload.output?.finish_reason ? ` finish_reason=${payload.output.finish_reason}` : "";
        throw new providers_1.TTSApiError(`No audio data returned from Qwen-TTS${finish}${requestId}.`, -4);
    }
    catch (error) {
        if (error instanceof providers_1.TTSApiError)
            throw error;
        if (args.signal?.aborted) {
            throw new providers_1.TTSApiError("TTS synthesis cancelled.", -7);
        }
        if (error instanceof Error && error.name === "AbortError") {
            const ttfbStillPending = ttfbTimeoutId !== undefined;
            const message = ttfbStillPending
                ? `No response from Qwen-TTS within ${TTFB_TIMEOUT_MS / 1000}s — check network or DashScope status.`
                : `Request timeout after ${REQUEST_TIMEOUT_MS / 1000}s`;
            throw new providers_1.TTSApiError(message, -2);
        }
        throw new providers_1.TTSApiError(error instanceof Error ? error.message : String(error), -6);
    }
    finally {
        clearTimeout(timeoutId);
        clearTtfbTimer();
        args.signal?.removeEventListener("abort", onAbort);
    }
}
function qwenGenerationUrl(baseHttpApiUrl) {
    const trimmed = baseHttpApiUrl.replace(/\/+$/, "");
    if (trimmed.endsWith(GENERATION_PATH))
        return trimmed;
    return `${trimmed}${GENERATION_PATH}`;
}
async function readStreamingResponse(response, onSubChunk, externalSignal) {
    if (!response.ok) {
        const raw = await response.text().catch(() => "");
        const payload = parseJson(raw);
        throw new providers_1.TTSApiError(readErrorDetail(payload, raw, response), response.status);
    }
    if (!response.body) {
        throw new providers_1.TTSApiError("Qwen-TTS streaming response has no body.", -4);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // One-ahead buffer: we keep the most recent segment so we can correctly tag
    // it as `isLast=true` once the stream ends. Earlier segments are emitted as
    // soon as the next segment arrives — that's what makes this true streaming.
    let pendingSegment = null;
    let emittedAny = false;
    let sawFinish = false;
    let firstErrorCode;
    let firstErrorMessage;
    try {
        while (true) {
            if (externalSignal?.aborted) {
                throw new providers_1.TTSApiError("TTS synthesis cancelled.", -7);
            }
            const { value, done } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            let separator = buffer.indexOf("\n\n");
            while (separator !== -1) {
                const rawEvent = buffer.slice(0, separator);
                buffer = buffer.slice(separator + 2);
                separator = buffer.indexOf("\n\n");
                const dataLines = [];
                for (const line of rawEvent.split("\n")) {
                    if (line.startsWith("data:"))
                        dataLines.push(line.slice(5).trimStart());
                }
                if (dataLines.length === 0)
                    continue;
                const payloadText = dataLines.join("");
                if (!payloadText || payloadText === "[DONE]")
                    continue;
                let payload;
                try {
                    payload = JSON.parse(payloadText);
                }
                catch {
                    continue;
                }
                if (payload.error || payload.code !== undefined) {
                    const code = payload.error?.code ?? payload.code;
                    firstErrorCode = normalizeErrorCode(code);
                    firstErrorMessage = payload.error?.message ?? payload.message ?? "Qwen-TTS streaming error.";
                    continue;
                }
                const audio = payload.output?.audio;
                if (audio?.data) {
                    const seg = normalizeBase64Audio(audio.data, "Qwen-TTS");
                    if (pendingSegment !== null) {
                        onSubChunk(pendingSegment, false);
                        emittedAny = true;
                    }
                    pendingSegment = seg;
                }
                if (payload.output?.finish_reason === "stop") {
                    sawFinish = true;
                }
            }
        }
    }
    finally {
        try {
            reader.releaseLock();
        }
        catch {
            // releaseLock can throw if the reader was already cancelled; ignore.
        }
    }
    if (firstErrorMessage) {
        throw new providers_1.TTSApiError(firstErrorMessage, firstErrorCode ?? -6);
    }
    if (pendingSegment === null && !emittedAny) {
        throw new providers_1.TTSApiError(`No audio data returned from Qwen-TTS${sawFinish ? " (empty stream)" : ""}.`, -4);
    }
    if (pendingSegment !== null) {
        onSubChunk(pendingSegment, true);
    }
    return { audioBase64: "", format: "wav" };
}
async function downloadAudio(url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) {
        throw new providers_1.TTSApiError(`Failed to download Qwen-TTS audio: HTTP ${response.status} ${response.statusText}`, response.status);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
        throw new providers_1.TTSApiError("Qwen-TTS returned an empty audio file.", -4);
    }
    return {
        audioBase64: buffer.toString("base64"),
        format: inferAudioFormat(response.headers.get("content-type"), undefined, url, "wav"),
    };
}
function parseJson(raw) {
    try {
        return JSON.parse(raw);
    }
    catch {
        return { error: { message: raw || "Qwen-TTS returned a non-JSON response." } };
    }
}
function readErrorDetail(payload, raw, response) {
    return (payload.error?.message ??
        payload.message ??
        (raw || `Qwen-TTS request failed: HTTP ${response.status} ${response.statusText}`));
}
function normalizeErrorCode(code) {
    if (typeof code === "number")
        return code;
    const parsed = Number(code);
    return Number.isFinite(parsed) ? parsed : -6;
}
function hasAudioFormatHint(audio) {
    return Boolean(audio.mime_type || audio.mimeType || audio.format);
}
function normalizeBase64Audio(value, serviceName) {
    const clean = value.replace(/\s+/g, "");
    const padded = clean.padEnd(Math.ceil(clean.length / 4) * 4, "=");
    if (!isBase64(padded) || Buffer.from(padded, "base64").length === 0) {
        throw new providers_1.TTSApiError(`${serviceName} returned malformed base64 audio data.`, -4);
    }
    return padded;
}
function isBase64(value) {
    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}
function inferAudioFormat(contentType, explicit, url, fallback = "wav") {
    const value = `${explicit ?? ""} ${contentType ?? ""} ${url ?? ""}`.toLowerCase();
    if (value.includes("mpeg") || value.includes(".mp3"))
        return "mp3";
    if (value.includes("wav") || value.includes("x-wav") || value.includes(".wav"))
        return "wav";
    if (value.includes("aac") || value.includes(".aac"))
        return "aac";
    if (value.includes("ogg") || value.includes("opus") || value.includes(".opus"))
        return "opus";
    if (value.includes("flac") || value.includes(".flac"))
        return "flac";
    return fallback;
}
function inferAudioFormatFromBase64(base64, fallback) {
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WAVE") {
        return "wav";
    }
    if (buffer.length >= 3 && buffer.subarray(0, 3).toString("ascii") === "ID3") {
        return "mp3";
    }
    if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "OggS") {
        return "opus";
    }
    if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "fLaC") {
        return "flac";
    }
    if (buffer.length >= 2 && buffer[0] === 0xff) {
        // AAC ADTS sync is 12 bits (0xFFF) with layer bits zero in byte 1.
        if ((buffer[1] & 0xf6) === 0xf0)
            return "aac";
        // MP3 sync is 11 bits (0xFFE) with layer bits non-zero.
        if ((buffer[1] & 0xe0) === 0xe0 && (buffer[1] & 0x06) !== 0)
            return "mp3";
    }
    return fallback;
}
//# sourceMappingURL=qwen-tts.js.map