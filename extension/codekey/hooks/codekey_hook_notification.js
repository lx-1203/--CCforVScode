// ═══ CodeKey Hook: Notification ═══
// Pushes Claude agent status changes to mobile (idle/working/error)

var http = require('http');

var BRIDGE_PORT = process.env.CODEKEY_BRIDGE_PORT || 3001;
var TIMEOUT = 5000;

var chunks = [];
process.stdin.on('data', function(c) { chunks.push(c); });
process.stdin.on('end', function() {
    try {
        var raw = Buffer.concat(chunks).toString('utf8');
        var data = JSON.parse(raw);

        var notificationType = data.notification_type || data.type || '';
        var notificationText = data.text || data.message || '';

        // Skip status notifications that aren't meaningful
        var meaningfulTypes = ['agent_started', 'agent_stopped', 'session_started', 'session_ended', 'error'];
        var isMeaningful = meaningfulTypes.some(function(t) {
            return (notificationType || '').toLowerCase().indexOf(t) >= 0;
        });

        if (!isMeaningful) {
            process.exit(0);
            return;
        }

        var payload = JSON.stringify({
            type: 'Notification',
            title: 'Claude 状态: ' + notificationType,
            command: notificationText.substring(0, 500),
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
