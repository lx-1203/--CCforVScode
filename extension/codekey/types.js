// ═══ CodeKey Types & Constants ═══
// Shared type definitions, message types, defaults

var CK = {};

// ── Message Types ──
CK.MSG = {
    EVENT_PUSH: 'event_push',
    RESPONSE: 'response',
    COMMAND: 'command',
    APPROVAL_FORWARD: 'approval_forward',
    EVENT_ACK: 'event_ack',
    SESSION_REGISTERED: 'session_registered',
    SESSION_DEACTIVATED: 'session_deactivated',
    ATTACHED_SESSIONS: 'attached_sessions',
    PAIRING_READY: 'pairing_ready',
    DEVICE_TOKEN: 'device_token',
    MP_ONLINE: 'mp_online',
    MP_OFFLINE: 'mp_offline',
    AUTH_FAILED: 'auth_failed',
    QUOTA_EXCEEDED: 'quota_exceeded',
    SYNC_HISTORY_POLICY: 'sync_history_policy',
    PONG: 'pong',
    PING: 'ping',
    CANCEL_REQUEST: 'cancel_request'
};

// ── Approval Decision ──
CK.DECISION = {
    APPROVE: 'approve',
    DENY: 'deny',
    REPLY: 'reply',
    TIMEOUT: 'timeout'
};

// ── Agent Types ──
CK.AGENT = {
    CLAUDE_CODE: 'claude_code',
    CODEX: 'codex',
    OPENCODE: 'opencode'
};

// ── Privacy Level ──
CK.PRIVACY = {
    OFF: 'off',
    SUMMARY: 'summary',
    FULL: 'full'
};

// ── Default Configuration ──
CK.DEFAULTS = {
    BRIDGE_PORT: 3001,
    RELAY_URL: 'ws://146.56.247.15/ws',
    HEARTBEAT_INTERVAL: 15000,
    HEARTBEAT_TIMEOUT: 45000,
    PAIRING_CODE_TTL: 120000,       // 120 seconds
    PAIRING_CODE_LENGTH: 6,
    APPROVAL_TIMEOUT: 120000,       // 120 seconds default
    APPROVAL_TIMEOUT_BEHAVIOR: 'deny',
    MAX_DEVICES: 5,
    MAX_RECONNECT_ATTEMPTS: 10,
    RECONNECT_BACKOFF_BASE: 5000,   // 5s base
    RECONNECT_BACKOFF_MAX: 60000,   // 60s max
    MAX_PENDING_APPROVALS: 10,
    RECONCILIATION_INTERVAL: 60000, // 60s
    PRUNE_INTERVAL: 300000,         // 5min
    NEVER_PUSH_TOOLS: ['Read'],
    HISTORY_RING_SIZE: 50,
    BRIDGE_MAX_RESTARTS: 5,
    BRIDGE_RESTART_WINDOW: 600000   // 10min
};

// ── Error Codes ──
CK.ERROR = {
    NO_CREDENTIALS: 'NO_CREDENTIALS',
    BRIDGE_START_FAILED: 'BRIDGE_START_FAILED',
    PORT_IN_USE: 'PORT_IN_USE',
    RELAY_DISCONNECTED: 'RELAY_DISCONNECTED',
    PAIRING_EXPIRED: 'PAIRING_EXPIRED',
    DEVICE_OFFLINE: 'DEVICE_OFFLINE',
    APPROVAL_TIMEOUT: 'APPROVAL_TIMEOUT',
    ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
    MAX_DEVICES_REACHED: 'MAX_DEVICES_REACHED',
    TOO_MANY_RESTARTS: 'TOO_MANY_RESTARTS',
    HOOK_CONFLICT: 'HOOK_CONFLICT'
};

// ── Hook Event Types ──
CK.HOOK_EVENT = {
    POST_TOOL_USE: 'PostToolUse',
    PRE_TOOL_USE: 'PreToolUse',
    NOTIFICATION: 'Notification',
    STOP: 'Stop'
};

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CK;
} else if (typeof globalThis !== 'undefined') {
    globalThis.CK = CK;
}
