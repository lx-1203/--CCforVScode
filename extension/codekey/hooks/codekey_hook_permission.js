// ═══ CodeKey Hook: PreToolUse (Permission) ═══
// BLOCKING — waits for mobile approval before allowing tool execution
//
// Reads Claude's permission request from stdin
// Sends it to Bridge for mobile approval
// Writes "yes" or "no" to stdout based on response
//
// Bridge will wait for mobile response (blocking mode) then return decision

var http = require('http');

var BRIDGE_PORT = process.env.CODEKEY_BRIDGE_PORT || 3001;
var TIMEOUT = parseInt(process.env.CODEKEY_APPROVAL_TIMEOUT || '120000', 10) + 10000; // Bridge timeout + 10s buffer

var chunks = [];
process.stdin.on('data', function(c) { chunks.push(c); });
process.stdin.on('end', function() {
    try {
        var raw = Buffer.concat(chunks).toString('utf8');
        var data = JSON.parse(raw);

        var toolName = data.tool_name || '';
        var toolInput = data.tool_input || {};
        var command = toolInput.command || toolInput.file_path || '';
        var title = 'Claude 请求执行: ' + toolName;

        var payload = JSON.stringify({
            type: 'PreToolUse',
            title: title,
            toolName: toolName,
            command: command.substring(0, 500),
            args: toolInput,
            sessionId: data.session_id || '',
            blocking: true,
            riskLevel: 'medium'
        });

        var postData = Buffer.from(payload);

        var req = http.request({
            hostname: '127.0.0.1',
            port: BRIDGE_PORT,
            path: '/v1/hook',
            method: 'POST',
            timeout: TIMEOUT,
            headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length }
        }, function(res) {
            var respChunks = [];
            res.on('data', function(c) { respChunks.push(c); });
            res.on('end', function() {
                try {
                    var resp = JSON.parse(Buffer.concat(respChunks).toString('utf8'));
                    if (resp.decision === 'approve') {
                        process.stdout.write('yes');
                    } else {
                        process.stdout.write('no');
                        // If reply message, write it to stderr for logging
                        if (resp.message) {
                            process.stderr.write('[CodeKey] Denied: ' + resp.message + '\n');
                        }
                    }
                } catch(e) {
                    // On parse error, deny
                    process.stdout.write('no');
                    process.stderr.write('[CodeKey] Response parse error\n');
                }
                process.exit(0);
            });
        });

        req.on('error', function(e) {
            // Bridge not available — deny
            process.stderr.write('[CodeKey] Bridge unavailable, denying: ' + e.message + '\n');
            process.stdout.write('no');
            process.exit(0);
        });

        req.on('timeout', function() {
            req.destroy();
            process.stderr.write('[CodeKey] Approval timeout\n');
            process.stdout.write('no');
            process.exit(0);
        });

        req.write(postData);
        req.end();

    } catch(e) {
        process.stderr.write('[CodeKey] Hook error: ' + e.message + '\n');
        process.stdout.write('no');
        process.exit(0);
    }
});
