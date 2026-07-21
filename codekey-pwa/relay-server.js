// ═══ CodeKey Relay Server — 极简云中继 (v2: auto-register WS devices) ═══
// 部署: node /root/codekey/relay-server.js &
// 端口: 3000

// ── HTTP + WebSocket relay with PostgreSQL persistence ──
// 新增功能: WebSocket 自动注册设备（PC Bridge 无需预注册即可连接）

const http = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://codekey:ck_relay_2026@127.0.0.1:5432/codekey',
  max: 10
});

// Ensure tables
pool.query(`
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    device_token TEXT NOT NULL UNIQUE,
    client_token TEXT NOT NULL UNIQUE,
    device_name TEXT DEFAULT '',
    platform TEXT DEFAULT 'pwa',
    bound_at TIMESTAMPTZ DEFAULT NOW(),
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    online BOOLEAN DEFAULT FALSE
  );
  CREATE TABLE IF NOT EXISTS pairing_codes (
    code TEXT PRIMARY KEY,
    device_token TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    device_id TEXT REFERENCES devices(id),
    agent_type TEXT DEFAULT 'claude_code',
    status TEXT DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id),
    type TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    risk_level TEXT DEFAULT 'low',
    pending BOOLEAN DEFAULT FALSE,
    decision TEXT,
    sealed_payload TEXT,
    key_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS user_tokens (
    token TEXT PRIMARY KEY,
    device_id TEXT REFERENCES devices(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`).then(() => console.log('[Relay] DB tables ready')).catch(e => console.error('[Relay] DB init error:', e.message));

// WebSocket clients
const wsClients = new Map();

// WebSocket frame utils
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function wsAcceptKey(key) {
  return crypto.createHash('sha1').update(key + WS_MAGIC).digest('base64');
}

function wsSend(ws, text) {
  const data = Buffer.from(text);
  const len = data.length;
  if (len < 126) {
    ws.write(Buffer.concat([Buffer.from([0x81, len]), data]));
  } else {
    const h = Buffer.from([0x81, 126]);
    const ext = Buffer.alloc(2);
    ext.writeUInt16BE(len, 0);
    ws.write(Buffer.concat([h, ext, data]));
  }
}

function wsParse(buf) {
  if (buf.length < 2) return null;
  const masked = (buf[1] & 0x80) !== 0;
  if (!masked) return null;
  let len = buf[1] & 0x7F;
  let off = 2;
  if (len === 126) { len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) { len = Number(buf.readBigUInt64BE(2)); off = 10; }
  if (buf.length < off + 4 + len) return null;
  const mask = buf.slice(off, off + 4);
  const data = Buffer.alloc(len);
  for (let i = 0; i < len; i++) data[i] = buf[off + 4 + i] ^ mask[i % 4];
  return { opcode: buf[0] & 0x0F, payload: data.toString(), consumed: off + 4 + len };
}

function sendJSON(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-codekey-client-token'
  });
  res.end(JSON.stringify(data));
}

function genId(len) {
  return crypto.randomBytes(len || 8).toString('hex');
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function parseBody(req, cb) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    try { cb(JSON.parse(body || '{}')); }
    catch(e) { cb({}); }
  });
}

// ── HTTP Server ──
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { sendJSON(res, 204, {}); return; }

  const u = new URL(req.url, 'http://0.0.0.0');
  const p = u.pathname;

  // POST /api/v1/devices/confirm — pairing code confirm
  if (req.method === 'POST' && p === '/api/v1/devices/confirm') {
    parseBody(req, async (json) => {
      const code = (json.code || '').toUpperCase();
      const pc = await pool.query("SELECT * FROM pairing_codes WHERE code = $1 AND expires_at > NOW()", [code]);
      if (pc.rows.length === 0) { sendJSON(res, 400, { error: 'invalid_code' }); return; }

      const deviceToken = pc.rows[0].device_token || 'dt_' + genId(16);
      const deviceId = 'dev_' + genId(8);
      const clientToken = 'ct_' + genId(16);

      await pool.query(
        "INSERT INTO devices (id, device_token, client_token, device_name, platform) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET client_token = $3, device_name = $4",
        [deviceId, deviceToken, clientToken, json.device_name || 'PWA Device', json.platform || 'pwa']
      );
      await pool.query("DELETE FROM pairing_codes WHERE code = $1", [code]);

      sendJSON(res, 200, { clientToken, deviceId, success: true });
    });
    return;
  }

  // POST /api/v1/auth/claim-device
  if (req.method === 'POST' && p === '/api/v1/auth/claim-device') {
    parseBody(req, async (json) => {
      const result = await pool.query("SELECT * FROM devices WHERE client_token = $1", [json.clientToken]);
      if (result.rows.length === 0) { sendJSON(res, 400, { error: 'invalid_token' }); return; }

      const userToken = 'ut_' + genId(16);
      await pool.query("INSERT INTO user_tokens (token, device_id) VALUES ($1,$2)", [userToken, result.rows[0].id]);

      sendJSON(res, 200, { success: true, deviceId: result.rows[0].id });
    });
    return;
  }

  // POST /api/v1/devices/pair — generate pairing code
  if (req.method === 'POST' && p === '/api/v1/devices/pair') {
    parseBody(req, async (json) => {
      const auth = (req.headers['authorization'] || '').replace('Bearer ', '');
      let deviceToken = '';
      if (auth) {
        const user = await pool.query("SELECT * FROM user_tokens WHERE token = $1", [auth]);
        if (user.rows.length > 0) {
          const dev = await pool.query("SELECT * FROM devices WHERE id = $1", [user.rows[0].device_id]);
          if (dev.rows.length > 0) deviceToken = dev.rows[0].device_token;
        }
      }

      const code = genCode();
      await pool.query("INSERT INTO pairing_codes (code, device_token, expires_at) VALUES ($1,$2, NOW() + interval '120 seconds')",
        [code, deviceToken]);

      sendJSON(res, 200, { code, success: true });
    });
    return;
  }

  // GET /api/v1/user/devices (supports x-codekey-client-token header)
  if (req.method === 'GET' && p === '/api/v1/user/devices') {
    const clientToken = req.headers['x-codekey-client-token'] || (req.headers['authorization'] || '').replace('Bearer ', '');
    pool.query("SELECT * FROM devices WHERE client_token = $1", [clientToken]).then(async r => {
      if (r.rows.length === 0) { sendJSON(res, 200, []); return; }
      sendJSON(res, 200, [{ id: r.rows[0].id, device_name: r.rows[0].device_name, bound_at: r.rows[0].bound_at }]);
    });
    return;
  }

  // GET /api/v1/user/sessions
  if (req.method === 'GET' && p === '/api/v1/user/sessions') {
    const clientToken = req.headers['x-codekey-client-token'] || '';
    pool.query("SELECT * FROM devices WHERE client_token = $1", [clientToken]).then(async r => {
      if (r.rows.length === 0) { sendJSON(res, 401, { error: 'client_token_required' }); return; }
      const sessions = await pool.query("SELECT * FROM sessions WHERE device_id = $1 ORDER BY last_active_at DESC LIMIT 50", [r.rows[0].id]);
      sendJSON(res, 200, sessions.rows);
    });
    return;
  }

  // GET /api/v1/user/sessions/:id/events
  const eventsMatch = p.match(/^\/api\/v1\/user\/sessions\/([^/]+)\/events$/);
  if (req.method === 'GET' && eventsMatch) {
    pool.query("SELECT * FROM events WHERE session_id = $1 ORDER BY created_at DESC LIMIT 100", [eventsMatch[1]]).then(r => {
      sendJSON(res, 200, r.rows);
    });
    return;
  }

  // Health
  if (p === '/health') {
    sendJSON(res, 200, { status: 'ok', time: new Date().toISOString(), clients: wsClients.size });
    return;
  }

  sendJSON(res, 404, { error: 'not_found' });
});

// ── WebSocket Upgrade Handler (with auto-register) ──
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }

  const u = new URL(req.url, 'http://0.0.0.0');
  const token = u.searchParams.get('token') || u.searchParams.get('device_id') || '';

  pool.query("SELECT * FROM devices WHERE client_token = $1 OR device_token = $1", [token]).then(async (result) => {
    // ═══ AUTO-REGISTER: create device for unknown tokens (PC Bridge self-reg) ═══
    let rows = result.rows;
    if (rows.length === 0) {
      try {
        const newId = 'dev_' + crypto.randomBytes(8).toString('hex');
        await pool.query(
          "INSERT INTO devices (id, device_token, client_token, device_name, platform) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
          [newId, token, token, 'Auto-device', 'bridge']
        );
        const r2 = await pool.query("SELECT * FROM devices WHERE device_token = $1", [token]);
        if (r2.rows.length > 0) {
          rows = r2.rows;
          console.log('[Relay] Auto-registered WS device:', token.substring(0, 10));
        } else {
          socket.end();
          return;
        }
      } catch (e) {
        console.error('[Relay] Auto-register error:', e.message);
        socket.end();
        return;
      }
    }

    const device = rows[0];
    const clientType = (token === device.client_token) ? 'phone' : 'pc';

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + wsAcceptKey(key) + '\r\n\r\n'
    );

    const wsKey = device.device_token;
    wsClients.set(wsKey, { ws: socket, type: clientType, deviceId: device.id });

    await pool.query("UPDATE devices SET online = true, last_heartbeat = NOW() WHERE id = $1", [device.id]);
    console.log('[Relay] WS connect: ' + clientType + ' (' + (device.device_name || device.id) + ')');

    let buf = Buffer.alloc(0);
    socket.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      while (true) {
        const frame = wsParse(buf);
        if (!frame) break;
        buf = buf.slice(frame.consumed);

        if (frame.opcode === 0x09) { socket.write(Buffer.from([0x8A, 0x00])); continue; }
        if (frame.opcode !== 0x01) continue;

        try {
          const msg = JSON.parse(frame.payload);
          if (msg.type === 'ping') return;
          // Forward to paired device (same device_token)
          const other = wsClients.get(wsKey);
          if (other) {
            wsSend(other.ws, frame.payload);
          }
        } catch(e) {}
      }
    });

    socket.on('close', () => {
      wsClients.delete(wsKey);
      pool.query("UPDATE devices SET online = false WHERE id = $1", [device.id]);
    });
    socket.on('error', () => {});
  }).catch(e => {
    console.error('[Relay] WS auth err:', e.message);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.end();
  });
});

// Clean expired pairing codes
setInterval(() => {
  pool.query("DELETE FROM pairing_codes WHERE expires_at < NOW()").catch(() => {});
}, 120000);

server.listen(3000, '0.0.0.0', () => {
  console.log('[Relay] Running on 0.0.0.0:3000 (v2: auto-register WS)');
  console.log('[Relay] WebSocket: ws://146.56.247.15:3000/ws');
});
