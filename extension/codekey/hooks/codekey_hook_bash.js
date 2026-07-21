// ═══ CodeKey Hook: PostToolUse (Bash) ═══
// Pushes terminal command execution results to mobile via Bridge
//
// Claude Code sends JSON to stdin: { session_id, transcript_path, tool_name, tool_input, tool_result, ... }
// We extract the command + summarized output and POST to bridge

var http = require('http');

var BRIDGE_PORT = process.env.CODEKEY_BRIDGE_PORT || 3001;
var TIMEOUT = 5000;

// Read stdin
var chunks = [];
process.stdin.on('data', function(c) { chunks.push(c); });
process.stdin.on('end', function() {
    try {
        var raw = Buffer.concat(chunks).toString('utf8');
        var data = JSON.parse(raw);

        // Build notification
        var toolInput = data.tool_input || {};
        var command = toolInput.command || '';
        var description = toolInput.description || command;

        // Skip if empty
        if (!command && !description) {
            process.exit(0);
            return;
        }

        var payload = JSON.stringify({
            type: 'PostToolUse',
            title: '命令执行通知',
            toolName: 'Bash',
            command: command.substring(0, 500),
            description: description.substring(0, 200),
            sessionId: data.session_id || '',
            blocking: false,
            riskLevel: command.length > 200 ? 'medium' : 'low'
        });

        var req = http.request({
            hostname: '127.0.0.1',
            port: BRIDGE_PORT,
            path: '/v1/hook',
            method: 'POST',
            timeout: TIMEOUT,
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        }, function(res) {
            // Fire-and-forget — don't block the tool
        });

        req.on('error', function() { /* Bridge may not be running */ });
        req.on('timeout', function() { req.destroy(); });
        req.write(payload);
        req.end();

    } catch(e) {
        // Silent fail — hooks should never crash
    }
    process.exit(0);
});
