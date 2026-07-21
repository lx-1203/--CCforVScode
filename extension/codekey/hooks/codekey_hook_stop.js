// ═══ CodeKey Hook: Stop ═══
// Notifies mobile when Claude agent finishes or is stopped

var http = require('http');

var BRIDGE_PORT = process.env.CODEKEY_BRIDGE_PORT || 3001;
var TIMEOUT = 5000;

var chunks = [];
process.stdin.on('data', function(c) { chunks.push(c); });
process.stdin.on('end', function() {
    try {
        var raw = Buffer.concat(chunks).toString('utf8');
        var data = JSON.parse(raw);

        var reason = data.reason || data.stop_reason || 'completed';
        var summary = data.summary || data.message || '';

        var payload = JSON.stringify({
            type: 'Stop',
            title: 'Claude 任务完成',
            command: reason,
            description: summary.substring(0, 200),
            sessionId: data.session_id || '',
            blocking: false,
            riskLevel: 'low'
        });

        var postData = Buffer.from(payload);
        var req = http.request({
            hostname: '127.0.0.1',
            port: BRIDGE_PORT,
            path: '/v1/hook',
            method: 'POST',
            timeout: TIMEOUT,
            headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length }
        }, function() {});
        req.on('error', function() {});
        req.on('timeout', function() { req.destroy(); });
        req.write(postData);
        req.end();

    } catch(e) { /* silent */ }
    process.exit(0);
});
