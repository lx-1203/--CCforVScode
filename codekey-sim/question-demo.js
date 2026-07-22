// 提问往返演示：Claude 提问 → 手机选项 → 答案回传 → 映射成 updatedInput.answers
var path = require('path');
var os = require('os');
var fs = require('fs');
var http = require('http');
var child_process = require('child_process');

var cryptoLib = require('../extension/codekey/crypto.js');
var startRelay = require('./relay.js').startRelay;
var startPhone = require('./phone.js').startPhone;
var mapAnswersToInput = require('./question-mapping.js').mapAnswersToInput;

var RELAY_PORT = 39011, BRIDGE_PORT = 39110;
var RELAY_URL = 'ws://127.0.0.1:' + RELAY_PORT + '/ws';
var DEVICE_TOKEN = cryptoLib.generateDeviceToken();
var DEVICE_ID = 'dev_sim_q';
var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'codekey-q-'));

function log(m) { console.log('\x1b[36m[Q-Demo]\x1b[0m ' + m); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function bridgeHTTP(method, p, body, cb) {
  var data = body ? JSON.stringify(body) : '';
  var req = http.request({ hostname: '127.0.0.1', port: BRIDGE_PORT, path: p, method: method,
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
    function (res) { var c = []; res.on('data', function (x) { c.push(x); });
      res.on('end', function () { try { cb(null, JSON.parse(Buffer.concat(c).toString())); } catch (e) { cb(e); } }); });
  req.on('error', cb); if (data) req.write(data); req.end();
}

var relay = null, bridgeProc = null, phone = null;

function startBridge() {
  return new Promise(function (resolve) {
    var entry = path.join(__dirname, '..', 'extension', 'codekey', 'bridge-entry.js');
    bridgeProc = child_process.fork(entry, [], { env: Object.assign({}, process.env, {
      CODEKEY_RELAY_URL: RELAY_URL, CODEKEY_DEVICE_TOKEN: DEVICE_TOKEN,
      CODEKEY_CREDENTIALS_DIR: TMP, CODEKEY_BRIDGE_PORT: String(BRIDGE_PORT), CODEKEY_E2E_ENABLED: 'true' }),
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    var done = false;
    bridgeProc.on('message', function (m) { if (m && m.type === 'ready' && !done) { done = true; BRIDGE_PORT = m.port || BRIDGE_PORT; resolve(); } });
    setTimeout(function () { if (!done) { done = true; resolve(); } }, 4000);
  });
}

function cleanup() {
  if (phone) phone.disconnect();
  if (bridgeProc) try { bridgeProc.kill('SIGTERM'); } catch (e) {}
  if (relay) relay.close();
  setTimeout(function () { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 500);
}
async function main() {
  var QUESTION = '用哪个数据库?';
  var OPTIONS = [{ label: 'Postgres' }, { label: 'MySQL' }];
  var PHONE_PICK = 'Postgres';

  relay = startRelay({ port: RELAY_PORT, deviceToken: DEVICE_TOKEN });
  await sleep(300);
  log('启动真实 Bridge…'); await startBridge(); await sleep(800);

  await new Promise(function (resolve) {
    bridgeHTTP('POST', '/v1/pair', {}, function (_e, r) {
      bridgeHTTP('POST', '/v1/devices/confirm', { code: r.code, deviceId: DEVICE_ID, deviceName: '本地模拟手机' },
        function () { resolve(); });
    });
  });

  // 手机端：收到提问，选中 PHONE_PICK 作为 decision 回传
  phone = startPhone({ relayUrl: RELAY_URL, clientToken: DEVICE_ID, deviceToken: DEVICE_TOKEN, deviceId: DEVICE_ID,
    decide: function (approval) {
      log('📩 手机收到提问: ' + approval.title + ' 选项=' + JSON.stringify((approval.args || {}).options || OPTIONS));
      return { decision: PHONE_PICK, message: '' };
    } });
  await sleep(1500);

  // PC：以 AskUserQuestion 形式推问题（复用审批通道），阻塞等手机选择
  log('Claude 发起提问: ' + QUESTION);
  await new Promise(function (resolve) {
    bridgeHTTP('POST', '/v1/hook', { blocking: true, type: 'AskUserQuestion', toolName: 'AskUserQuestion',
      title: QUESTION, command: QUESTION, args: { options: OPTIONS }, riskLevel: 'low' },
      function (_e, result) {
        var phoneReplies = {}; phoneReplies[QUESTION] = result.decision;   // decision = 手机选中的 label
        var input = { questions: [{ question: QUESTION, header: 'DB', options: OPTIONS }] };
        var mapped = mapAnswersToInput(input, phoneReplies);
        console.log('\x1b[33m[CC 收到的 updatedInput]\x1b[0m ' + JSON.stringify(mapped.updatedInput.answers));
        if (mapped.updatedInput.answers[QUESTION] === PHONE_PICK) log('✅ 往返成功：答案正确映射');
        else log('❌ 映射不符: ' + JSON.stringify(mapped.updatedInput.answers));
        resolve();
      });
  });
  await sleep(400);
  cleanup();
}

process.on('SIGINT', cleanup);
main().catch(function (e) { console.error(e); cleanup(); });
