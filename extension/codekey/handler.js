// ═══ CodeKey ApprovalBridge ═══
// Core routing hub: relay ↔ hook scripts ↔ agent sessions

var CK = require('./types.js');
var cryptoLib = require('./crypto.js');
var privacyPipeline = require('./privacy-pipeline.js');

/**
 * ApprovalBridge — manages approval requests, session tracking, and the
 * approval lifecycle (create → send → wait → resolve → cleanup).
 */
function ApprovalBridge(opts) {
    var self = this;
    opts = opts || {};

    self.relayClient = opts.relayClient || null;
    self.pairingManager = opts.pairingManager || null;
    self.contentKey = opts.contentKey || null;
    self.encryptionEnabled = opts.encryptionEnabled !== false;

    // Pending approvals: { approvalId → { resolve, reject, timeout, request, createdAt } }
    self.pendingApprovals = {};

    // Active sessions: { sessionId → { attached, terminalId, lastActivity, processPid } }
    self.sessions = {};

    // Approval history ring buffer
    self.history = [];
    self.historyMaxSize = CK.DEFAULTS.HISTORY_RING_SIZE;

    // Approval stats counters
    self.stats = { total: 0, approved: 0, denied: 0, timeout: 0, totalResponseTime: 0 };

    // Wire relay events
    if (self.relayClient) {
        self.relayClient.on('approval_forward', function(payload) {
            self._handleApprovalResponse(payload);
        });
        self.relayClient.on('command', function(payload) {
            self._handleCommand(payload);
        });
    }
}

// ── Session Management ──

ApprovalBridge.prototype.registerSession = function(sessionId, info) {
    info = info || {};
    this.sessions[sessionId] = {
        sessionId: sessionId,
        attached: true,
        terminalId: info.terminalId || null,
        processPid: info.processPid || null,
        lastActivity: Date.now(),
        agentType: info.agentType || CK.AGENT.CLAUDE_CODE
    };
    if (this.relayClient) {
        this.relayClient.send(CK.MSG.ATTACHED_SESSIONS, {
            action: 'register',
            sessionId: sessionId,
            agentType: this.sessions[sessionId].agentType
        });
    }
};

ApprovalBridge.prototype.deactivateSession = function(sessionId) {
    if (this.sessions[sessionId]) {
        this.sessions[sessionId].attached = false;
        this.sessions[sessionId].lastActivity = Date.now();
    }
    if (this.relayClient) {
        this.relayClient.send(CK.MSG.SESSION_DEACTIVATED, { sessionId: sessionId });
    }
};

ApprovalBridge.prototype.getSessions = function() {
    return Object.keys(this.sessions).map(function(k) {
        var s = this.sessions[k];
        return {
            sessionId: s.sessionId,
            attached: s.attached,
            terminalId: s.terminalId,
            agentType: s.agentType,
            lastActivity: s.lastActivity
        };
    }, this);
};

// ── Approval Request Lifecycle ──

/**
 * Create a new approval request and push to mobile
 * @param {{ type: string, title: string, command?: string, toolName?: string, args?: object, sessionId?: string, riskLevel?: string }} requestData
 * @param {function} callback - function(err, decision) where decision is { decision: 'approve'|'deny', message?: string }
 * @param {number} timeout - timeout in ms (default 120000)
 */
ApprovalBridge.prototype.createApproval = function(requestData, callback, timeout) {
    var self = this;
    var approvalId = cryptoLib.generateMessageId();
    timeout = timeout || CK.DEFAULTS.APPROVAL_TIMEOUT;

    // Check if any device is online
    var onlineDevices = self.pairingManager ? self.pairingManager.getDevices().filter(function(d) { return d.online; }) : [];
    if (onlineDevices.length === 0) {
        // No device online — reject immediately with offline reason
        var offlineResult = { decision: CK.DECISION.DENY, message: '手机不在线，自动降级为本地审批', offline: true };
        self._recordHistory(approvalId, requestData, offlineResult);
        callback(null, offlineResult);
        return approvalId;
    }

    // Apply privacy filter
    var filterResult = privacyPipeline.filterEvent({ type: 'approval', data: requestData });

    // Build event payload
    var eventPayload = {
        approvalId: approvalId,
        type: 'permission_request',
        title: requestData.title || 'Claude 请求执行操作',
        toolName: requestData.toolName || '',
        command: requestData.command || '',
        args: filterResult.data.args || {},
        riskLevel: requestData.riskLevel || 'medium',
        sessionId: requestData.sessionId || '',
        createdAt: Date.now(),
        timeoutMs: timeout,
        filteredCount: filterResult.filteredCount
    };

    // Encrypt if enabled
    var sealedPayload = null;
    if (self.encryptionEnabled && self.contentKey) {
        try {
            sealedPayload = cryptoLib.encrypt(JSON.stringify(eventPayload), self.contentKey);
        } catch(e) {
            console.error('[ApprovalBridge] Encryption failed:', e.message);
            sealedPayload = null;
        }
    }

    // Track pending
    var timeoutHandle = setTimeout(function() {
        self._resolveApproval(approvalId, {
            decision: CK.DEFAULTS.APPROVAL_TIMEOUT_BEHAVIOR,
            message: '审批超时，自动' + (CK.DEFAULTS.APPROVAL_TIMEOUT_BEHAVIOR === 'deny' ? '拒绝' : '通过'),
            timeout: true
        });
    }, timeout);

    self.pendingApprovals[approvalId] = {
        callback: callback,
        timeoutHandle: timeoutHandle,
        request: requestData,
        createdAt: Date.now(),
        deviceCount: onlineDevices.length
    };

    // Send to relay
    if (self.relayClient) {
        self.relayClient.send(CK.MSG.EVENT_PUSH, {
            approvalId: approvalId,
            event: sealedPayload ? { sealed_payload: sealedPayload } : eventPayload,
            encrypted: !!sealedPayload,
            deviceCount: onlineDevices.length
        });
    }

    // Start warning timer (30s before timeout)
    var self2 = self;
    setTimeout(function() {
        if (self2.pendingApprovals[approvalId]) {
            var elapsed = Math.floor((Date.now() - self2.pendingApprovals[approvalId].createdAt) / 1000);
            // Emit warning for UI
            if (self2._onWarning) {
                self2._onWarning(approvalId, elapsed, timeout / 1000);
            }
        }
    }, Math.max(timeout - 30000, 5000));

    return approvalId;
};

/**
 * Handle approval response from mobile
 */
ApprovalBridge.prototype._handleApprovalResponse = function(payload) {
    var self = this;
    var approvalId = payload.approvalId;
    var decision = payload.decision;  // 'approve' | 'deny' | 'reply'
    var message = payload.message || '';

    if (!approvalId || !self.pendingApprovals[approvalId]) {
        // Cancel notification to other devices
        if (self.relayClient) {
            self.relayClient.send(CK.MSG.CANCEL_REQUEST, { approvalId: approvalId });
        }
        return;
    }

    // Decrypt if sealed
    if (payload.sealed_payload && self.contentKey) {
        try {
            var decrypted = cryptoLib.decrypt(payload.sealed_payload, self.contentKey);
            var parsed = JSON.parse(decrypted);
            decision = parsed.decision || decision;
            message = parsed.message || message;
        } catch(e) {
            console.error('[ApprovalBridge] Decrypt failed:', e.message);
        }
    }

    self._resolveApproval(approvalId, { decision: decision, message: message });

    // Cancel on other devices
    if (self.relayClient) {
        self.relayClient.send(CK.MSG.CANCEL_REQUEST, { approvalId: approvalId });
    }
};

/**
 * Resolve a pending approval
 */
ApprovalBridge.prototype._resolveApproval = function(approvalId, result) {
    var self = this;
    var pending = self.pendingApprovals[approvalId];
    if (!pending) return;

    if (pending.timeoutHandle) clearTimeout(pending.timeoutHandle);

    var decision = result.decision || CK.DECISION.DENY;
    var responseTime = Date.now() - pending.createdAt;

    // Update stats
    self.stats.total++;
    self.stats.totalResponseTime += responseTime;
    if (decision === CK.DECISION.APPROVE) self.stats.approved++;
    else if (decision === CK.DECISION.DENY) self.stats.denied++;
    else if (decision === CK.DECISION.TIMEOUT || result.timeout) self.stats.timeout++;
    else self.stats.denied++;

    // Record history
    self._recordHistory(approvalId, pending.request, result);

    // Callback
    if (typeof pending.callback === 'function') {
        try {
            pending.callback(null, result);
        } catch(e) {
            console.error('[ApprovalBridge] Callback error:', e);
        }
    }

    delete self.pendingApprovals[approvalId];
};

// ── Commands from Mobile ──

ApprovalBridge.prototype._handleCommand = function(payload) {
    var self = this;
    switch (payload.command) {
        case 'write_stdin':
            if (self._onStdinCommand) {
                self._onStdinCommand(payload.sessionId, payload.text);
            }
            break;
        case 'pause_session':
            // Notify extension to pause
            if (self._onPauseSession) self._onPauseSession(payload.sessionId);
            break;
        case 'resume_session':
            if (self._onResumeSession) self._onResumeSession(payload.sessionId);
            break;
        case 'cancel_all_approvals':
            Object.keys(self.pendingApprovals).forEach(function(id) {
                self._resolveApproval(id, { decision: CK.DECISION.DENY, message: payload.reason || '用户取消', timeout: true });
            });
            break;
        default:
            console.log('[ApprovalBridge] Unknown command:', payload.command);
    }
};

// ── History ──

ApprovalBridge.prototype._recordHistory = function(approvalId, request, result) {
    this.history.push({
        approvalId: approvalId,
        request: { title: request.title, toolName: request.toolName, command: request.command },
        decision: result.decision,
        message: result.message || '',
        offline: result.offline || false,
        timeout: result.timeout || false,
        createdAt: Date.now()
    });
    // Trim ring buffer
    while (this.history.length > this.historyMaxSize) this.history.shift();
};

ApprovalBridge.prototype.getHistory = function(limit) {
    limit = limit || 50;
    return this.history.slice(-limit).reverse();
};

// ── Stats ──

ApprovalBridge.prototype.getStats = function() {
    return {
        total: this.stats.total,
        approved: this.stats.approved,
        denied: this.stats.denied,
        timeout: this.stats.timeout,
        avgResponseTime: this.stats.total > 0 ? Math.round(this.stats.totalResponseTime / this.stats.total / 1000) : 0,
        pending: Object.keys(this.pendingApprovals).length,
        deviceOnline: this.pairingManager ? this.pairingManager.getOnlineDeviceCount() : 0
    };
};

// ── Event Hooks for Extension Integration ──

ApprovalBridge.prototype.onWarning = function(fn) { this._onWarning = fn; };
ApprovalBridge.prototype.onStdinCommand = function(fn) { this._onStdinCommand = fn; };
ApprovalBridge.prototype.onPauseSession = function(fn) { this._onPauseSession = fn; };
ApprovalBridge.prototype.onResumeSession = function(fn) { this._onResumeSession = fn; };

// ── Reconciliation ──

ApprovalBridge.prototype.reconcile = function() {
    var self = this;
    var now = Date.now();
    // Timeout stale approvals (past threshold)
    Object.keys(self.pendingApprovals).forEach(function(id) {
        var p = self.pendingApprovals[id];
        if (now - p.createdAt > CK.DEFAULTS.APPROVAL_TIMEOUT) {
            self._resolveApproval(id, { decision: CK.DEFAULTS.APPROVAL_TIMEOUT_BEHAVIOR, timeout: true });
        }
    });
    return { staleResolved: 0, pending: Object.keys(self.pendingApprovals).length };
};

ApprovalBridge.prototype.prune = function() {
    // Cleanup old history (keep last 50)
    this.history = this.history.slice(-this.historyMaxSize);
    return { historySize: this.history.length };
};

// ── Exports ──
module.exports = ApprovalBridge;
