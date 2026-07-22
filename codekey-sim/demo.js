// ═══ CodeKey 本地模拟演示 ═══
// 全本地跑通"手机审批控制"，不碰生产中继、不动 ~/.codekey。
// 用法: node codekey-sim/demo.js

var path = require('path');
var os = require('os');
var fs = require('fs');
var http = require('http');
var child_process = require('child_process');

var cryptoLib = require('../extension/codekey/crypto.js');
var startRelay = require('./relay.js').startRelay;
var startPhone = require('./phone.js').startPhone;

// ── 配置（全部临时/本地）──
var RELAY_PORT = 39001;
var BRIDGE_PORT = 39100;
var RELAY_URL = 'ws://127.0.0.1:' + RELAY_PORT + '/ws';
var DEVICE_TOKEN = cryptoLib.generateDeviceToken();
var DEVICE_ID = 'dev_sim_phone';
var TMP_CRED_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'codekey-sim-'));

function log(m) { console.log('\x1b[36m[Demo]\x1b[0m ' + m); }
function hr() { console.log('\x1b[90m' + '─'.repeat(60) + '\x1b[0m'); }

// ── 小工具：调用 Bridge 的本地 HTTP API ──
function bridgeHTTP(method, urlPath, body, cb) {
    var data = body ? JSON.stringify(body) : '';
    var req = http.request({
        hostname: '127.0.0.1', port: BRIDGE_PORT, path: urlPath, method: method,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, function(res) {
        var chunks = [];
        res.on('data', function(c) { chunks.push(c); });
        res.on('end', function() {
            try { cb(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
            catch (e) { cb(e); }
        });
    });
    req.on('error', cb);
    if (data) req.write(data);
    req.end();
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

// __STATE__
var relay = null;
var bridgeProc = null;
var phone = null;

// ── 启动真实 Bridge 子进程 ──
function startBridge() {
    return new Promise(function(resolve, reject) {
        var entry = path.join(__dirname, '..', 'extension', 'codekey', 'bridge-entry.js');
        bridgeProc = child_process.fork(entry, [], {
            env: Object.assign({}, process.env, {
                CODEKEY_RELAY_URL: RELAY_URL,
                CODEKEY_DEVICE_TOKEN: DEVICE_TOKEN,
                CODEKEY_CREDENTIALS_DIR: TMP_CRED_DIR,
                CODEKEY_BRIDGE_PORT: String(BRIDGE_PORT),
                CODEKEY_E2E_ENABLED: 'true'
            }),
            stdio: ['ignore', 'inherit', 'inherit', 'ipc']
        });
        var done = false;
        bridgeProc.on('message', function(msg) {
            if (msg && msg.type === 'ready' && !done) {
                done = true;
                BRIDGE_PORT = msg.port || BRIDGE_PORT;  // Bridge 可能因占用换端口
                resolve();
            }
        });
        bridgeProc.on('error', reject);
        setTimeout(function() { if (!done) { done = true; resolve(); } }, 4000);
    });
}

// ── 一个审批场景 ──
function runApproval(label, hookBody) {
    return new Promise(function(resolve) {
        hr();
        log('场景【' + label + '】发起审批: ' + hookBody.toolName + ' → ' + hookBody.command);
        bridgeHTTP('POST', '/v1/hook', hookBody, function(err, result) {
            if (err) { log('❌ 请求失败: ' + err.message); resolve(); return; }
            var tag = result.offline ? '（离线降级）' : '';
            console.log('\x1b[33m[插件端最终结果]\x1b[0m decision=' + result.decision +
                        (result.message ? ' | ' + result.message : '') + ' ' + tag);
            resolve();
        });
    });
}

function cleanup() {
    log('清理…');
    if (phone) phone.disconnect();
    if (bridgeProc) try { bridgeProc.kill('SIGTERM'); } catch (e) {}
    if (relay) relay.close();
    setTimeout(function() {
        try { fs.rmSync(TMP_CRED_DIR, { recursive: true, force: true }); } catch (e) {}
        process.exit(0);
    }, 500);
}

async function main() {
    hr();
    log('设备令牌(临时): ' + DEVICE_TOKEN.substring(0, 12) + '…');
    log('凭据目录(临时): ' + TMP_CRED_DIR);
    hr();

    // 1) 本地中继
    relay = startRelay({ port: RELAY_PORT, deviceToken: DEVICE_TOKEN });
    await sleep(300);

    // 2) 真实 Bridge 子进程
    log('启动真实 Bridge 子进程…');
    await startBridge();
    await sleep(800);

    // 3) 配对 + 确认设备（走真实 Bridge API）
    await new Promise(function(resolve) {
        bridgeHTTP('POST', '/v1/pair', {}, function(err, r) {
            if (err || !r) { log('❌ 配对失败: ' + (err && err.message)); resolve(); return; }
            log('生成配对码: ' + r.code + '（手机端将用它绑定）');
            bridgeHTTP('POST', '/v1/devices/confirm', { code: r.code, deviceId: DEVICE_ID, deviceName: '本地模拟手机' }, function(e2, r2) {
                if (e2 || !r2 || !r2.success) log('❌ 确认失败');
                else log('设备已绑定: ' + DEVICE_ID);
                resolve();
            });
        });
    });

    // 4) 假手机上线（clientToken 用 DEVICE_ID，中继据此判为 phone 端）
    log('假手机连接中继…');
    var pendingDecision = { decision: 'approve', message: '' };
    phone = startPhone({
        relayUrl: RELAY_URL,
        clientToken: DEVICE_ID,      // ≠ deviceToken → phone 身份
        deviceToken: DEVICE_TOKEN,
        deviceId: DEVICE_ID,
        decide: function() { return pendingDecision; }
    });
    await sleep(1500);  // 等 mp_online 生效

    // 5) 场景一：批准
    pendingDecision = { decision: 'approve', message: '同意执行' };
    await runApproval('批准', { blocking: true, type: 'PreToolUse', toolName: 'Bash', command: 'npm test', riskLevel: 'medium', title: 'Claude 想运行测试' });
    await sleep(600);

    // 6) 场景二：拒绝
    pendingDecision = { decision: 'deny', message: '危险操作，拒绝' };
    await runApproval('拒绝', { blocking: true, type: 'PreToolUse', toolName: 'Bash', command: 'rm -rf /', riskLevel: 'high', title: 'Claude 想删除文件' });
    await sleep(600);

    // 7) 场景三：手机离线 → 自动降级
    //    Bridge 靠心跳窗口(45s)判在线，需等窗口过期后才会降级。真实等待。
    hr();
    log('手机断开连接…（模拟关机）');
    phone.disconnect();
    var waitSec = 47;
    log('等待 Bridge 心跳窗口过期（约 ' + waitSec + 's）以触发离线判定…');
    for (var t = waitSec; t > 0; t -= 5) {
        process.stdout.write('\x1b[90m  剩余 ' + t + 's…\x1b[0m\n');
        await sleep(5000);
    }
    await runApproval('离线降级', { blocking: true, type: 'PreToolUse', toolName: 'Bash', command: 'git push', riskLevel: 'medium', title: 'Claude 想推送代码' });
    await sleep(500);

    hr();
    log('演示完成 ✅');
    cleanup();
}

process.on('SIGINT', cleanup);
main().catch(function(e) { console.error(e); cleanup(); });

