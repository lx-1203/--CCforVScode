"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkText = chunkText;
const DEFAULT_OPTIONS = { maxChars: 250, minChars: 40 };
const SENTENCE_END = /[。！？；…\.!?;]/;
const SOFT_BREAK = /[，、,;；:：\s]/;
function chunkText(text, opts = {}) {
    const options = { ...DEFAULT_OPTIONS, ...opts };
    const trimmed = text.trim();
    if (!trimmed)
        return [];
    if (trimmed.length <= options.maxChars)
        return [trimmed];
    const paragraphs = splitParagraphs(trimmed);
    const chunks = [];
    for (const paragraph of paragraphs) {
        if (paragraph.length <= options.maxChars) {
            pushOrMerge(chunks, paragraph, options);
            continue;
        }
        const sentences = splitSentences(paragraph);
        let buffer = "";
        for (const sentence of sentences) {
            if (sentence.length > options.maxChars) {
                if (buffer) {
                    pushOrMerge(chunks, buffer, options);
                    buffer = "";
                }
                for (const piece of splitOversized(sentence, options.maxChars)) {
                    pushOrMerge(chunks, piece, options);
                }
                continue;
            }
            if (!buffer) {
                buffer = sentence;
            }
            else if (buffer.length + sentence.length <= options.maxChars) {
                buffer += sentence;
            }
            else {
                pushOrMerge(chunks, buffer, options);
                buffer = sentence;
            }
        }
        if (buffer)
            pushOrMerge(chunks, buffer, options);
    }
    return chunks;
}
function splitParagraphs(text) {
    return text
        .split(/\n{2,}/)
        .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
        .filter(Boolean);
}
function splitSentences(text) {
    const out = [];
    let current = "";
    for (const ch of text) {
        current += ch;
        if (SENTENCE_END.test(ch)) {
            out.push(current);
            current = "";
        }
    }
    if (current.trim())
        out.push(current);
    return out;
}
function splitOversized(sentence, maxChars) {
    const out = [];
    let buffer = "";
    let lastSoftBreak = -1;
    for (const ch of sentence) {
        buffer += ch;
        if (SOFT_BREAK.test(ch))
            lastSoftBreak = buffer.length;
        if (buffer.length >= maxChars) {
            if (lastSoftBreak > 0 && lastSoftBreak < buffer.length) {
                out.push(buffer.slice(0, lastSoftBreak));
                buffer = buffer.slice(lastSoftBreak);
                lastSoftBreak = -1;
            }
            else {
                out.push(buffer);
                buffer = "";
                lastSoftBreak = -1;
            }
        }
    }
    if (buffer)
        out.push(buffer);
    return out;
}
function pushOrMerge(chunks, piece, options) {
    const normalized = piece.replace(/\s+/g, " ").trim();
    if (!normalized)
        return;
    const last = chunks[chunks.length - 1];
    if (last !== undefined &&
        normalized.length < options.minChars &&
        last.length + separatorBetween(last, normalized).length + normalized.length <= options.maxChars) {
        chunks[chunks.length - 1] = last + separatorBetween(last, normalized) + normalized;
        return;
    }
    chunks.push(normalized);
}
function separatorBetween(left, right) {
    if (!left || !right || /\s$/.test(left) || /^\s/.test(right))
        return "";
    if (/[A-Za-z0-9.!?;:)"'\]]$/.test(left) && /^[A-Za-z0-9("'[]/.test(right)) {
        return " ";
    }
    return "";
}
//# sourceMappingURL=text-chunker.js.map