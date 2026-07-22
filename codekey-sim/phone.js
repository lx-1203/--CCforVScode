// ═══ CodeKey 假手机客户端 ═══
// 本地模拟真机：连中继(phone 身份)、解密 event_push、按策略回 approval_forward。
// 用真实的 crypto.js，加解密与真机完全一致。

var WebSocket = require('../extension/codekey/node_modules/ws');
var cryptoLib = require('../extension/codekey/crypto.js');

/**
 * 启动假手机
 * @param {{
 *   relayUrl:string, clientToken:string, deviceToken:string, deviceId:string,
 *   decide?: function(approval):{decision,message},   // 决策回调
 *   onLog?:function, onApproval?:function
 * }} opts
 * @returns {{ ws, disconnect:function }}
 */
function startPhone(opts) {
    var log = opts.onLog || function(m) { console.log('[Phone] ' + m); };
    var contentKey = cryptoLib.deriveContentKey(opts.deviceToken);

    // phone 用 clientToken 连接（≠ deviceToken，中继据此判定为 phone 端）
    var wsUrl = opts.relayUrl + '?device_id=' + encodeURIComponent(opts.clientToken) +
                '&device_id_label=' + encodeURIComponent(opts.deviceId);
    var ws = new WebSocket(wsUrl);
    var hbTimer = null;

    ws.on('open', function() {
        log('已连接中继（手机端上线）');
        hbTimer = setInterval(function() {
            if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
        }, 10000);
    });

    ws.on('message', function(raw) {
        var msg;
        try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
        if (msg.type === 'pong') return;

        if (msg.type === 'event_push') {
            var payload = msg.payload || {};
            var event = payload.event || {};
            var approval;

            // 解密（真机同款：AES-256-GCM）
            if (payload.encrypted && event.sealed_payload) {
                try {
                    approval = JSON.parse(cryptoLib.decrypt(event.sealed_payload, contentKey));
                } catch (e) {
                    log('❌ 解密失败: ' + e.message);
                    return;
                }
            } else {
                approval = event;
            }

            log('📩 收到审批请求（手机端视角）:');
            log('   标题: ' + (approval.title || '-'));
            log('   工具: ' + (approval.toolName || '-'));
            log('   命令: ' + (approval.command || '-'));
            log('   风险: ' + (approval.riskLevel || '-'));
            if (opts.onApproval) opts.onApproval(approval);

            // 决策
            var d = opts.decide ? opts.decide(approval) : { decision: 'approve', message: '' };
            setTimeout(function() {
                var reply = {
                    type: 'approval_forward',
                    payload: { approvalId: payload.approvalId, decision: d.decision, message: d.message || '' },
                    ts: Date.now()
                };
                if (ws.readyState === 1) ws.send(JSON.stringify(reply));
                log('📤 手机回复决策: ' + d.decision + (d.message ? ' (' + d.message + ')' : ''));
            }, d.delayMs || 500);
        }
    });

    ws.on('close', function() { log('已断开中继（手机端离线）'); if (hbTimer) clearInterval(hbTimer); });
    ws.on('error', function(e) { log('WS error: ' + e.message); });

    return {
        ws: ws,
        disconnect: function() { if (hbTimer) clearInterval(hbTimer); try { ws.close(); } catch (e) {} }
    };
}

module.exports = { startPhone: startPhone };
