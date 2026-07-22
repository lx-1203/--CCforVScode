// ═══ CodeKey 本地测试中继 ═══
// 仅用于本地模拟：正确区分 PC / phone 两端并互相转发。
// 修掉了仓库 relay-server.js 的"自我回声"bug（它用同一个 device_token 当 key，
// 两个 socket 互相覆盖，消息发回自己）。
// 这里按连接身份分别存 PC 和 phone，转发到对端。

var WebSocketServer = require('../extension/codekey/node_modules/ws').Server;
var url = require('url');

/**
 * 启动本地中继
 * @param {{ port:number, deviceToken:string, onLog?:function }} opts
 * @returns {{ wss, close:function }}
 */
function startRelay(opts) {
    var port = opts.port;
    var deviceToken = opts.deviceToken;
    var log = opts.onLog || function(m) { console.log('[Relay] ' + m); };

    // 每个 deviceToken 一组连接：{ pc: ws|null, phone: ws|null, deviceId }
    var pairs = {};

    var wss = new WebSocketServer({ port: port, path: '/ws' });

    wss.on('connection', function(ws, req) {
        var q = url.parse(req.url, true).query;
        var token = q.device_id || q.token || '';
        var role = (token === deviceToken) ? 'pc' : 'phone';

        if (!pairs[deviceToken]) pairs[deviceToken] = { pc: null, phone: null, deviceId: null };
        var group = pairs[deviceToken];
        group[role] = ws;
        log('WS connect: ' + role + ' (token ' + token.substring(0, 8) + '…)');

        // phone 上线 → 通知 PC 端把设备标记为在线
        if (role === 'phone') {
            group.deviceId = q.device_id_label || group.deviceId || ('dev_sim');
            if (group.pc && group.pc.readyState === 1) {
                group.pc.send(JSON.stringify({ type: 'mp_online', deviceId: group.deviceId, ts: Date.now() }));
                log('→ PC: mp_online ' + group.deviceId);
            }
        }

        ws.on('message', function(raw) {
            var msg;
            try { msg = JSON.parse(raw.toString()); } catch (e) { return; }

            // 心跳：回 pong；phone 的 ping 顺便给 PC 补发 mp_online 保活
            // （真机在连接期间应持续在线；仅靠一次 mp_online 会在 45s 后被误判离线）
            if (msg.type === 'ping') {
                if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
                if (role === 'phone' && group.pc && group.pc.readyState === 1) {
                    group.pc.send(JSON.stringify({ type: 'mp_online', deviceId: group.deviceId, ts: Date.now() }));
                }
                return;
            }

            // 转发到对端
            var target = (role === 'pc') ? group.phone : group.pc;
            var targetRole = (role === 'pc') ? 'phone' : 'pc';
            if (target && target.readyState === 1) {
                target.send(raw.toString());
                log(role + ' → ' + targetRole + ': ' + msg.type);
            } else {
                log(role + ' → ' + targetRole + ': ' + msg.type + ' (对端离线，丢弃)');
            }
        });

        ws.on('close', function() {
            log('WS close: ' + role);
            if (group[role] === ws) group[role] = null;
            // phone 掉线 → 通知 PC 端设备离线
            if (role === 'phone' && group.pc && group.pc.readyState === 1) {
                group.pc.send(JSON.stringify({ type: 'mp_offline', deviceId: group.deviceId, ts: Date.now() }));
                log('→ PC: mp_offline ' + group.deviceId);
            }
        });

        ws.on('error', function() {});
    });

    wss.on('listening', function() {
        log('本地中继已启动 ws://127.0.0.1:' + port + '/ws');
    });

    return {
        wss: wss,
        close: function(cb) { try { wss.close(cb); } catch (e) { if (cb) cb(); } }
    };
}

module.exports = { startRelay: startRelay };
