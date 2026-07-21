// ═══ CodeKey Bridge Entry ═══
// Independent Node.js child process — the CodeKey Bridge
// Communicates with extension.js via HTTP (127.0.0.1)
// Connects to relay via WebSocket

var http = require('http');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var CK = require('./types.js');
var cryptoLib = require('./crypto.js');
var pairingManager = require('./pairing.js');
var RelayClient = require('./relay-client.js');
var ApprovalBridge = require('./handler.js');

// ── Configuration (from env or defaults) ──

var BRIDGE_PORT = parseInt(process.env.CODEKEY_BRIDGE_PORT || CK.DEFAULTS.BRIDGE_PORT, 10);
var DEVICE_TOKEN = process.env.CODEKEY_DEVICE_TOKEN || '';
var RELAY_URL = process.env.CODEKEY_RELAY_URL || 'ws://146.56.247.15/ws';
var CREDENTIALS_DIR = process.env.CODEKEY_CREDENTIALS_DIR || '';
var E2E_ENABLED = process.env.CODEKEY_E2E_ENABLED !== 'false';

var startTime = Date.now();

// ── Load Credentials ──

function loadCredentials() {
    if (CREDENTIALS_DIR) {
        var credPath = path.join(CREDENTIALS_DIR, 'credentials.json');
        try {
            if (fs.existsSync(credPath)) {
                var data = JSON.parse(fs.readFileSync(credPath, 'utf8'));
                DEVICE_TOKEN = data.deviceToken || DEVICE_TOKEN;
                if (data.contentKey) {
                    pairingManager.setContentKey(Buffer.from(data.contentKey, 'base64'));
                }
                // Restore devices
                if (data.devices) {
                    data.devices.forEach(function(d) { pairingManager.addDevice(d); });
                }
                console.log('[Bridge] Credentials loaded:', credPath);
            }
        } catch(e) {
            console.error('[Bridge] Credential load error:', e.message);
        }
    }
    if (!DEVICE_TOKEN) {
        DEVICE_TOKEN = cryptoLib.generateDeviceToken();
        console.log('[Bridge] Generated new device token');
    }
}

// ── Save Credentials ──

function saveCredentials() {
    if (!CREDENTIALS_DIR) return;
    try {
        if (!fs.existsSync(CREDENTIALS_DIR)) {
            fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
        }
        var credPath = path.join(CREDENTIALS_DIR, 'credentials.json');
        var key = pairingManager.getContentKey();
        fs.writeFileSync(credPath, JSON.stringify({
            deviceToken: DEVICE_TOKEN,
            contentKey: key ? key.toString('base64') : null,
            devices: pairingManager.getDevices(),
            updatedAt: new Date().toISOString()
        }, null, 2));
    } catch(e) {
        console.error('[Bridge] Credential save error:', e.message);
    }
}

// ── Initialize Components ──

loadCredentials();

var relayClient = new RelayClient({
    deviceToken: DEVICE_TOKEN,
    relayUrl: RELAY_URL,
    pairingManager: pairingManager
});

var bridge = new ApprovalBridge({
    relayClient: relayClient,
    pairingManager: pairingManager,
    contentKey: pairingManager.getContentKey(),
    encryptionEnabled: E2E_ENABLED
});

// ── HTTP Server ──

function parseBody(req, callback) {
    var chunks = [];
    req.on('data', function(c) { chunks.push(c); });
    req.on('end', function() {
        var raw = Buffer.concat(chunks).toString('utf8');
        try { callback(null, JSON.parse(raw)); }
        catch(e) { callback(null, { _raw: raw }); }
    });
}

function sendJSON(res, code, data) {
    res.writeHead(code, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'vscode-webview://*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
}

var server = http.createServer(function(req, res) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();
        return;
    }

    var url = req.url.split('?')[0];

    // ── GET /v1/health ──
    if (req.method === 'GET' && url === '/v1/health') {
        sendJSON(res, 200, {
            status: 'ok',
            uptime: Math.floor((Date.now() - startTime) / 1000),
            relayConnected: relayClient.isConnected(),
            deviceToken: DEVICE_TOKEN ? 'set' : 'not set',
            sessions: Object.keys(bridge.sessions).length,
            pendingApprovals: Object.keys(bridge.pendingApprovals).length,
            devices: pairingManager.getDevices().length,
            e2eEnabled: E2E_ENABLED
        });
        return;
    }

    // ── GET /v1/sessions ──
    if (req.method === 'GET' && url === '/v1/sessions') {
        sendJSON(res, 200, { sessions: bridge.getSessions() });
        return;
    }

    // ── GET /v1/attached-sessions ──
    if (req.method === 'GET' && url === '/v1/attached-sessions') {
        sendJSON(res, 200, { sessions: bridge.getSessions().filter(function(s) { return s.attached; }) });
        return;
    }

    // ── GET /v1/devices ──
    if (req.method === 'GET' && url === '/v1/devices') {
        sendJSON(res, 200, { devices: pairingManager.getDevices() });
        return;
    }

    // ── GET /v1/stats ──
    if (req.method === 'GET' && url === '/v1/stats') {
        sendJSON(res, 200, { stats: bridge.getStats() });
        return;
    }

    // ── GET /v1/history ──
    if (req.method === 'GET' && url === '/v1/history') {
        sendJSON(res, 200, { history: bridge.getHistory() });
        return;
    }

    // ── POST /v1/hook ──
    if (req.method === 'POST' && url === '/v1/hook') {
        parseBody(req, function(err, body) {
            if (err) { sendJSON(res, 400, { error: 'Invalid JSON' }); return; }

            var eventType = body.type || body.eventType || 'unknown';
            var blocking = body.blocking === true;

            if (blocking) {
                // Blocking approval: wait for mobile response
                bridge.createApproval({
                    type: eventType,
                    title: body.title || '权限请求',
                    command: body.command || body.text || '',
                    toolName: body.toolName || '',
                    args: body.args || {},
                    sessionId: body.sessionId || '',
                    riskLevel: body.riskLevel || 'medium'
                }, function(err2, result) {
                    sendJSON(res, 200, {
                        decision: result.decision,
                        message: result.message || '',
                        timeout: result.timeout || false,
                        offline: result.offline || false
                    });
                });
            } else {
                // Non-blocking notification: acknowledge immediately
                if (body.sessionId) {
                    bridge.registerSession(body.sessionId, { terminalId: body.terminalId, processPid: body.processPid });
                }
                // Push notification to mobile
                bridge.createApproval({
                    type: eventType,
                    title: body.title || '通知',
                    command: body.command || body.text || '',
                    toolName: body.toolName || '',
                    sessionId: body.sessionId || ''
                }, function() {
                    // Fire-and-forget
                });
                sendJSON(res, 200, { ack: true });
            }
        });
        return;
    }

    // ── POST /v1/message ──
    if (req.method === 'POST' && url === '/v1/message') {
        parseBody(req, function(err, body) {
            if (err) { sendJSON(res, 400, { error: 'Invalid JSON' }); return; }
            // Forward from mobile to agent (will be picked up by extension polling)
            sendJSON(res, 200, { ack: true, messageId: cryptoLib.generateMessageId() });
        });
        return;
    }

    // ── POST /v1/pair ──
    if (req.method === 'POST' && url === '/v1/pair') {
        var session = pairingManager.createPairingSession();
        // Derive content key from device token
        var contentKey = cryptoLib.deriveContentKey(DEVICE_TOKEN);
        pairingManager.setContentKey(contentKey);
        saveCredentials();
        sendJSON(res, 200, { success: true, code: session.code, expiresAt: session.expiresAt });
        return;
    }

    // ── POST /v1/devices/confirm ──
    if (req.method === 'POST' && url === '/v1/devices/confirm') {
        parseBody(req, function(err, body) {
            var code = body.code || '';
            var result = pairingManager.confirmPairingCode(code);
            if (!result.valid) {
                sendJSON(res, 400, { success: false, reason: result.reason });
                return;
            }
            var deviceId = body.deviceId || cryptoLib.generateMessageId();
            var addResult = pairingManager.addDevice({
                deviceId: deviceId,
                name: body.deviceName || '手机设备',
                publicKey: body.publicKey || null
            });
            if (!addResult.success) {
                sendJSON(res, 400, { success: false, reason: addResult.reason });
                return;
            }
            saveCredentials();
            sendJSON(res, 200, { success: true, deviceId: deviceId, deviceToken: DEVICE_TOKEN });
        });
        return;
    }

    // ── POST /v1/devices/remove ──
    if (req.method === 'POST' && url === '/v1/devices/remove') {
        parseBody(req, function(err, body) {
            var result = pairingManager.removeDevice(body.deviceId);
            saveCredentials();
            sendJSON(res, 200, { success: result.removed });
        });
        return;
    }

    // ── 404 ──
    sendJSON(res, 404, { error: 'Not found', path: url });
});

// ── Start Server ──

function tryListen(port) {
    return new Promise(function(resolve, reject) {
        var srv = http.createServer(function(req, res) {
            server.emit('request', req, res);
        });
        srv.on('error', function(e) {
            if (e.code === 'EADDRINUSE') reject(e);
            else console.error('[Bridge] Server error:', e);
        });
        srv.listen(port, '127.0.0.1', function() {
            resolve(srv);
        });
    });
}

function startServer() {
    // Attach request handler
    // (We use a single server instance created above — simple approach)

    server.listen(BRIDGE_PORT, '127.0.0.1', function() {
        console.log('[Bridge] HTTP server listening on 127.0.0.1:' + BRIDGE_PORT);
    });

    server.on('error', function(e) {
        if (e.code === 'EADDRINUSE') {
            // Try next port
            BRIDGE_PORT++;
            console.log('[Bridge] Port in use — trying', BRIDGE_PORT);
            server.listen(BRIDGE_PORT, '127.0.0.1');
        } else {
            console.error('[Bridge] Server error:', e);
            process.send({ type: 'error', error: e.message });
        }
    });
}

// ── Timers ──

var reconcileInterval = setInterval(function() {
    bridge.reconcile();
    saveCredentials();
}, CK.DEFAULTS.RECONCILIATION_INTERVAL);

var pruneInterval = setInterval(function() {
    bridge.prune();
    pairingManager.pruneExpired();
}, CK.DEFAULTS.PRUNE_INTERVAL);

// ── Lifecycle ──

// Notify parent that we're ready
if (process.send) {
    process.send({ type: 'ready', port: BRIDGE_PORT });
}

process.on('message', function(msg) {
    if (msg && msg.type === 'shutdown') {
        shutdown();
    }
});

process.on('SIGTERM', function() { shutdown(); });
process.on('SIGINT', function() { shutdown(); });

function shutdown() {
    console.log('[Bridge] Shutting down...');
    clearInterval(reconcileInterval);
    clearInterval(pruneInterval);
    relayClient.disconnect();
    saveCredentials();
    server.close(function() {
        process.exit(0);
    });
    // Force exit after 5s
    setTimeout(function() { process.exit(1); }, 5000);
}

// ── Start ──

startServer();
relayClient.connect();

console.log('[Bridge] CodeKey Bridge started — port', BRIDGE_PORT);
