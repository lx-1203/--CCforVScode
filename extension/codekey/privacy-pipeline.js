// ═══ CodeKey Privacy Pipeline ═══
// Local sensitive data scanning and redaction before events leave the device

var CK = require('./types.js');

// ── Built-in Sensitive Patterns ──

var SENSITIVE_PATTERNS = [
    // OpenAI API keys
    { name: 'OpenAI API Key', pattern: /sk-[A-Za-z0-9-_]{20,60}/g, replacement: '[已过滤-OpenAI Key]' },
    // Anthropic API keys
    { name: 'Anthropic API Key', pattern: /sk-ant-[A-Za-z0-9-_]{20,80}/g, replacement: '[已过滤-Anthropic Key]' },
    // AWS Access Key
    { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[已过滤-AWS Key]' },
    // AWS Secret Key
    { name: 'AWS Secret Key', pattern: /[A-Za-z0-9/+=]{40}/g, replacement: '[已过滤-AWS Secret]' },
    // GitHub Token
    { name: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9_]{20,60}/g, replacement: '[已过滤-GitHub Token]' },
    // Generic JWT
    { name: 'JWT', pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, replacement: '[已过滤-JWT]' },
    // Private key PEM header
    { name: 'Private Key PEM', pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[^]*?-----END (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, replacement: '[已过滤-私钥]' },
    // Generic password assignments (bash style)
    { name: 'Password Assignment', pattern: /(PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|AUTH_TOKEN)\s*=\s*['"][^'"]+['"]/gi, replacement: '$1=[已过滤]' },
    // Connection strings
    { name: 'Connection String', pattern: /(mongodb|postgres|mysql|redis):\/\/[^@]+@[^\s]+/gi, replacement: '$1://[已过滤]@[host]' },
    // Cloud platform tokens
    { name: 'Bearer Token', pattern: /Bearer\s+[A-Za-z0-9\-_.!~*'()]+/g, replacement: 'Bearer [已过滤]' }
];

// ── Custom Patterns ──
var customPatterns = [];

/**
 * Set custom filter patterns
 * @param {Array<{pattern: string, replacement: string}>} rules
 */
function setCustomRules(rules) {
    if (!Array.isArray(rules)) return;
    customPatterns = rules.map(function(r) {
        try {
            return { name: 'Custom Rule', pattern: new RegExp(r.pattern, 'g'), replacement: r.replacement || '[已过滤]' };
        } catch(e) {
            console.error('[CodeKey Privacy] Invalid custom pattern:', r.pattern, e.message);
            return null;
        }
    }).filter(Boolean);
}

/**
 * Scan text content and redact sensitive data
 * @param {string} text - Raw text to scan
 * @param {boolean} logOnly - If true, only log findings without replacing
 * @returns {{ filtered: string, findings: Array<{name: string, count: number}> }}
 */
function scanAndFilter(text, logOnly) {
    if (!text || typeof text !== 'string') return { filtered: text || '', findings: [] };
    var result = text;
    var findings = [];
    var allPatterns = SENSITIVE_PATTERNS.concat(customPatterns);

    allPatterns.forEach(function(rule) {
        var matches = result.match(rule.pattern);
        if (matches && matches.length > 0) {
            findings.push({ name: rule.name, count: matches.length });
            if (!logOnly) {
                result = result.replace(rule.pattern, rule.replacement);
            }
        }
    });

    return { filtered: result, findings: findings };
}

/**
 * Filter an event payload before sending to relay
 * @param {{ type: string, data: object }} event
 * @returns {object} Filtered event
 */
function filterEvent(event) {
    if (!event || !event.data) return event;

    var data = JSON.parse(JSON.stringify(event.data)); // Deep copy
    var allFindings = [];

    // Scan string fields recursively
    function scan(obj) {
        if (!obj || typeof obj !== 'object') return;
        Object.keys(obj).forEach(function(key) {
            if (typeof obj[key] === 'string') {
                var result = scanAndFilter(obj[key], false);
                obj[key] = result.filtered;
                allFindings = allFindings.concat(result.findings);
            } else if (typeof obj[key] === 'object') {
                scan(obj[key]);
            }
        });
    }
    scan(data);

    return {
        data: data,
        findings: allFindings,
        filteredCount: allFindings.reduce(function(s, f) { return s + f.count; }, 0)
    };
}

// ── Utility ──

/**
 * Get list of all active filter rule names
 */
function getActiveRules() {
    var builtin = SENSITIVE_PATTERNS.map(function(r) { return r.name; });
    var custom = customPatterns.map(function(r) { return r.name; });
    return { builtin: builtin, custom: custom, total: builtin.length + custom.length };
}

// ── Exports ──
module.exports = {
    scanAndFilter: scanAndFilter,
    filterEvent: filterEvent,
    setCustomRules: setCustomRules,
    getActiveRules: getActiveRules,
    SENSITIVE_PATTERNS: SENSITIVE_PATTERNS
};
