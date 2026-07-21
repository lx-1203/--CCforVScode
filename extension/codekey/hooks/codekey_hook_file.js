// ═══ CodeKey Hook: PostToolUse (Write/Edit) ═══
// Notifies mobile when files are modified by AI

var http = require('http');

var BRIDGE_PORT = process.env.CODEKEY_BRIDGE_PORT || 3001;
var TIMEOUT = 5000;

var chunks = [];
process.stdin.on('data', function(c) { chunks.push(c); });
process.stdin.on('end', function() {
    try {
        var raw = Buffer.concat(chunks).toString('utf8');
        var data = JSON.parse(raw);

        var toolName = data.tool_name || '';
        var toolInput = data.tool_input || {};
        var filePath = toolInput.file_path || toolInput.path || '';

        // Build description
        var parts = [filePath];
        if (toolInput.old_string && toolInput.new_string) {
            parts.push('(编辑)');
        } else if (toolInput.content) {
            parts.push('(' + toolInput.content.length + ' 字符)');
        }

        var payload = JSON.stringify({
            type: 'PostToolUse',
            title: '文件修改: ' + toolName,
            toolName: toolName,
            command: filePath,
            description: parts.join(' '),
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
