// ═══ CodeKey Relay Client ═══
// WebSocket connection to relay server with reconnection and heartbeat

var CK = require('./types.js');
var cryptoLib = require('./crypto.js');
var privacyPipeline = require('./privacy-pipeline.js');

/**
 * RelayClient — manages the WebSocket connection to the relay server
 *
 * Events emitted:
 *   'connected'       — ws connection established
 *   'disconnected'    — ws connection lost
 *   'approval_forward' — approval response from mobile
 *   'command'          — command from mobile to agent
 *   'event_ack'        — relay acknowledged our event
 *   'session_registered'
 *   'session_deactivated'
 *   'mp_online' / 'mp_offline'
 *   'auth_failed'
 *   'error'
 */
function RelayClient(opts) {
    var self = this;
    opts = opts || {};

    self.deviceToken = opts.deviceToken || '';
    self.relayUrl = opts.relayUrl || CK.DEFAULTS.RELAY_URL;
    self.pairingManager = opts.pairingManager || null;

    self.ws = null;
    self.connected = false;
    self.reconnectAttempts = 0;
    self.reconnectTimer = null;
    self.heartbeatInterval = null;
    self.heartbeatTimeout = null;
    self.pendingQueue = [];       // Events queued during disconnect
    self.maxQueueSize = 20;

    self._listeners = {};
}

RelayClient.prototype.on = function(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
};

RelayClient.prototype._emit = function(event, data) {
    var listeners = this._listeners[event];
    if (listeners) {
        listeners.forEach(function(cb) { try { cb(data); } catch(e) { console.error('[RelayClient] emit error', e); } });
    }
};

// ── Connection Management ──

RelayClient.prototype.connect = function() {
    var self = this;
    if (!self.deviceToken) {
        console.log('[RelayClient] No device token — skipping connect');
        return;
    }

    var wsUrl = self.relayUrl + '?device_id=' + encodeURIComponent(self.deviceToken);
    console.log('[RelayClient] Connecting to', self.relayUrl);

    try {
        self.ws = new (require('ws'))(wsUrl, {
            headers: {
                'Authorization': 'Bearer ' + self.deviceToken
            },
            handshakeTimeout: 10000
        });
    } catch(e) {
        console.error('[RelayClient] WebSocket creation failed:', e.message);
        self._scheduleReconnect();
        return;
    }

    self.ws.on('open', function() {
        console.log('[RelayClient] Connected to relay');
        self.connected = true;
        self.reconnectAttempts = 0;
        self._startHeartbeat();
        self._flushQueue();
        self._emit('connected');
    });

    self.ws.on('message', function(raw) {
        try {
            var msg = JSON.parse(raw.toString());
            self._handleMessage(msg);
        } catch(e) {
            console.error('[RelayClient] Failed to parse message:', e.message);
        }
    });

    self.ws.on('close', function(code, reason) {
        console.log('[RelayClient] Disconnected:', code, reason ? reason.toString() : '');
        self.connected = false;
        self._stopHeartbeat();
        self.ws = null;
        self._emit('disconnected', { code: code, reason: reason ? reason.toString() : '' });
        self._scheduleReconnect();
    });

    self.ws.on('error', function(err) {
        console.error('[RelayClient] WebSocket error:', err.message);
        self._emit('error', err);
    });
};

RelayClient.prototype.disconnect = function() {
    this._stopReconnect();
    this._stopHeartbeat();
    if (this.ws) {
        this.ws.close(1000, 'Client disconnect');
        this.ws = null;
    }
    this.connected = false;
};

// ── Heartbeat ──

RelayClient.prototype._startHeartbeat = function() {
    var self = this;
    self._stopHeartbeat();

    self.heartbeatInterval = setInterval(function() {
        if (self.connected && self.ws && self.ws.readyState === 1) {
            self.ws.send(JSON.stringify({ type: CK.MSG.PING, ts: Date.now() }));
        }
        // Set timeout for pong response
        self.heartbeatTimeout = setTimeout(function() {
            console.log('[RelayClient] Heartbeat timeout — reconnecting');
            if (self.ws) { self.ws.close(4001, 'Heartbeat timeout'); self.ws = null; }
            self.connected = false;
            self._emit('disconnected', { code: 4001, reason: 'Heartbeat timeout' });
            self._scheduleReconnect();
        }, CK.DEFAULTS.HEARTBEAT_TIMEOUT);
    }, CK.DEFAULTS.HEARTBEAT_INTERVAL);
};

RelayClient.prototype._stopHeartbeat = function() {
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
    if (this.heartbeatTimeout) { clearTimeout(this.heartbeatTimeout); this.heartbeatTimeout = null; }
};

// ── Message Handling ──

RelayClient.prototype._handleMessage = function(msg) {
    var self = this;
    switch (msg.type) {
        case CK.MSG.PONG:
            if (self.heartbeatTimeout) { clearTimeout(self.heartbeatTimeout); self.heartbeatTimeout = null; }
            break;
        case CK.MSG.APPROVAL_FORWARD:
            self._emit('approval_forward', msg.payload || msg);
            break;
        case CK.MSG.COMMAND:
            self._emit('command', msg.payload || msg);
            break;
        case CK.MSG.EVENT_ACK:
            self._emit('event_ack', msg);
            break;
        case CK.MSG.SESSION_REGISTERED:
            self._emit('session_registered', msg);
            break;
        case CK.MSG.SESSION_DEACTIVATED:
            self._emit('session_deactivated', msg);
            break;
        case CK.MSG.MP_ONLINE:
            if (self.pairingManager && msg.deviceId) {
                self.pairingManager.updateHeartbeat(msg.deviceId);
            }
            self._emit('mp_online', msg);
            break;
        case CK.MSG.MP_OFFLINE:
            self._emit('mp_offline', msg);
            break;
        case CK.MSG.AUTH_FAILED:
            console.error('[RelayClient] Auth failed:', msg.reason || 'unknown');
            self._emit('auth_failed', msg);
            self.disconnect();
            break;
        case CK.MSG.QUOTA_EXCEEDED:
            console.warn('[RelayClient] Quota exceeded');
            self._emit('quota_exceeded', msg);
            break;
        case CK.MSG.PAIRING_READY:
            self._emit('pairing_ready', msg);
            break;
        default:
            // Forward unknown messages to handler
            self._emit('message', msg);
    }
};

// ── Send ──

RelayClient.prototype.send = function(type, payload) {
    var msg = { type: type, payload: payload, ts: Date.now() };
    if (this.connected && this.ws && this.ws.readyState === 1) {
        this.ws.send(JSON.stringify(msg));
        return true;
    }
    // Queue for reconnect
    if (this.pendingQueue.length < this.maxQueueSize) {
        this.pendingQueue.push(msg);
    }
    return false;
};

RelayClient.prototype._flushQueue = function() {
    var self = this;
    var toSend = self.pendingQueue.splice(0, self.maxQueueSize);
    toSend.forEach(function(msg) {
        self.send(msg.type, msg.payload);
    });
};

// ── Reconnection ──

RelayClient.prototype._scheduleReconnect = function() {
    var self = this;
    self._stopReconnect();

    if (self.reconnectAttempts >= CK.DEFAULTS.MAX_RECONNECT_ATTEMPTS) {
        console.error('[RelayClient] Max reconnect attempts reached — giving up');
        self._emit('error', { code: CK.ERROR.RELAY_DISCONNECTED, message: '无法连接到中继服务器' });
        return;
    }

    var delay = Math.min(
        CK.DEFAULTS.RECONNECT_BACKOFF_BASE * Math.pow(2, self.reconnectAttempts),
        CK.DEFAULTS.RECONNECT_BACKOFF_MAX
    );
    // Add jitter ±20%
    delay = delay * (0.8 + Math.random() * 0.4);

    console.log('[RelayClient] Reconnecting in', Math.round(delay/1000), 's (attempt', self.reconnectAttempts + 1, ')');
    self.reconnectTimer = setTimeout(function() {
        self.reconnectAttempts++;
        self.connect();
    }, delay);
};

RelayClient.prototype._stopReconnect = function() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
};

// ── Status ──

RelayClient.prototype.isConnected = function() {
    return this.connected;
};

RelayClient.prototype.getState = function() {
    return {
        connected: this.connected,
        reconnectAttempts: this.reconnectAttempts,
        pendingQueueSize: this.pendingQueue.length
    };
};

module.exports = RelayClient;
