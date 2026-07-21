// ═══ CodeKey Pairing & Device Management ═══
// Device pairing code generation, device storage CRUD, online detection

var cryptoLib = require('./crypto.js');
var CK = require('./types.js');

// ── In-memory store ──
var pairingCodes = {};     // { code: { deviceId, expiresAt, createdAt } }
var devices = [];          // [{ deviceId, name, publicKey, pairedAt, lastHeartbeat, lastSeen }]
var contentKey = null;     // E2E content key (Buffer)

// ── Pairing Code ──

/** Character set for pairing codes (avoid confusing characters) */
var CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generate a random 6-character pairing code
 * @returns {string} e.g. "A1B2C3"
 */
function generatePairingCode() {
    var code = '';
    var len = CK.DEFAULTS.PAIRING_CODE_LENGTH;
    for (var i = 0; i < len; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
}

/**
 * Create a new pairing code session
 * @returns {{ code: string, expiresAt: number }}
 */
function createPairingSession() {
    var code = generatePairingCode();
    // Ensure uniqueness
    while (pairingCodes[code]) { code = generatePairingCode(); }
    pairingCodes[code] = {
        code: code,
        expiresAt: Date.now() + CK.DEFAULTS.PAIRING_CODE_TTL,
        createdAt: Date.now()
    };
    return { code: code, expiresAt: pairingCodes[code].expiresAt };
}

/**
 * Validate and consume a pairing code
 * @param {string} code
 * @returns {{ valid: boolean, reason?: string }}
 */
function confirmPairingCode(code) {
    var entry = pairingCodes[code];
    if (!entry) return { valid: false, reason: '无效的配对码' };
    if (Date.now() > entry.expiresAt) {
        delete pairingCodes[code];
        return { valid: false, reason: '配对码已过期' };
    }
    // Code is valid — consume it (one-time use)
    var createdAt = entry.createdAt;
    delete pairingCodes[code];
    return { valid: true, createdAt: createdAt };
}

/**
 * Check if a pairing code is expired
 * @param {string} code
 */
function isCodeExpired(code) {
    var entry = pairingCodes[code];
    return !entry || Date.now() > entry.expiresAt;
}

/**
 * Get remaining TTL for a pairing code in seconds
 * @param {string} code
 */
function getCodeTTL(code) {
    var entry = pairingCodes[code];
    if (!entry) return 0;
    return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
}

// ── Device Storage ──

/**
 * Add a device after successful pairing
 * @param {{ deviceId: string, name: string, publicKey?: string }} deviceInfo
 * @returns {{ success: boolean, reason?: string }}
 */
function addDevice(deviceInfo) {
    // Check max devices
    if (devices.length >= CK.DEFAULTS.MAX_DEVICES) {
        return { success: false, reason: '已达到最大设备数量 (' + CK.DEFAULTS.MAX_DEVICES + ')' };
    }
    // Check for duplicates
    var existing = devices.find(function(d) { return d.deviceId === deviceInfo.deviceId; });
    if (existing) {
        existing.name = deviceInfo.name || existing.name;
        existing.lastSeen = Date.now();
        return { success: true, updated: true };
    }
    devices.push({
        deviceId: deviceInfo.deviceId,
        name: deviceInfo.name || '未命名设备',
        publicKey: deviceInfo.publicKey || null,
        pairedAt: Date.now(),
        lastHeartbeat: Date.now(),
        lastSeen: Date.now()
    });
    return { success: true };
}

/**
 * Remove a paired device
 * @param {string} deviceId
 */
function removeDevice(deviceId) {
    var before = devices.length;
    devices = devices.filter(function(d) { return d.deviceId !== deviceId; });
    return { removed: before !== devices.length };
}

/**
 * Get all paired devices
 * @returns {Array}
 */
function getDevices() {
    // Prune expired codes
    var now = Date.now();
    Object.keys(pairingCodes).forEach(function(code) {
        if (pairingCodes[code].expiresAt < now) {
            delete pairingCodes[code];
        }
    });
    return devices.map(function(d) {
        return {
            deviceId: d.deviceId,
            name: d.name,
            online: isDeviceOnline(d),
            pairedAt: d.pairedAt,
            lastSeen: d.lastSeen
        };
    });
}

/**
 * Get a specific device
 * @param {string} deviceId
 */
function getDevice(deviceId) {
    return devices.find(function(d) { return d.deviceId === deviceId; }) || null;
}

/**
 * Update device heartbeat timestamp
 * @param {string} deviceId
 */
function updateHeartbeat(deviceId) {
    var device = devices.find(function(d) { return d.deviceId === deviceId; });
    if (device) {
        device.lastHeartbeat = Date.now();
        device.lastSeen = Date.now();
    }
}

// ── Online Status ──

/**
 * Check if a device is online (heartbeat within 45s)
 * @param {{ lastHeartbeat: number }} device
 */
function isDeviceOnline(device) {
    return (Date.now() - device.lastHeartbeat) < CK.DEFAULTS.HEARTBEAT_TIMEOUT;
}

/**
 * Get count of online devices
 */
function getOnlineDeviceCount() {
    return devices.filter(isDeviceOnline).length;
}

// ── E2E Content Key ──

function setContentKey(key) {
    contentKey = key;
}

function getContentKey() {
    return contentKey;
}

// ── Persistence ──

/**
 * Serialize device store to localStorage-compatible format
 */
function serializeStore() {
    return JSON.stringify({
        devices: devices,
        contentKeyId: contentKey ? 'ck-' + Date.now() : null
    });
}

/**
 * Restore device store from serialized data
 * @param {string} json
 */
function restoreStore(json) {
    try {
        var data = JSON.parse(json);
        if (Array.isArray(data.devices)) devices = data.devices;
    } catch(e) {
        // Ignore — start fresh
    }
}

// ── Cleanup ──

/** Remove expired pairing codes */
function pruneExpired() {
    var now = Date.now();
    var cleaned = 0;
    Object.keys(pairingCodes).forEach(function(code) {
        if (pairingCodes[code].expiresAt < now) {
            delete pairingCodes[code];
            cleaned++;
        }
    });
    return cleaned;
}

// ── Exports ──
module.exports = {
    createPairingSession: createPairingSession,
    confirmPairingCode: confirmPairingCode,
    isCodeExpired: isCodeExpired,
    getCodeTTL: getCodeTTL,
    addDevice: addDevice,
    removeDevice: removeDevice,
    getDevices: getDevices,
    getDevice: getDevice,
    updateHeartbeat: updateHeartbeat,
    isDeviceOnline: isDeviceOnline,
    getOnlineDeviceCount: getOnlineDeviceCount,
    setContentKey: setContentKey,
    getContentKey: getContentKey,
    serializeStore: serializeStore,
    restoreStore: restoreStore,
    pruneExpired: pruneExpired,
    generatePairingCode: generatePairingCode
};
