const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const BEHIND_PROXY = process.env.BEHIND_PROXY;

const app = express();
if (BEHIND_PROXY) {
  app.set('trust proxy', 1);
}
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(cookieParser());

// session tracking
app.use((req, res, next) => {
  let sid = req.cookies.session_id;
  if (!sid) {
    sid = uuidv4();
    res.cookie('session_id', sid, { httpOnly: false });
  }
  req.session_id = sid;
  next();
});

// sqlite setup
const db = new sqlite3.Database('events.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS events (
    ts INTEGER,
    ip TEXT,
    ua TEXT,
    kind TEXT,
    session_id TEXT
  )`);
});

function logEvent(kind, req) {
  const evt = {
    ts: Date.now(),
    ip: req.ip,
    ua: req.get('user-agent') || '',
    kind,
    session_id: req.session_id
  };
  db.run(
    'INSERT INTO events (ts, ip, ua, kind, session_id) VALUES (?, ?, ?, ?, ?)',
    [evt.ts, evt.ip, evt.ua, evt.kind, evt.session_id]
  );
  io.emit('event', evt);
}

function requireAuth(req, res, next) {
  if (!ADMIN_USER || !ADMIN_PASS) return next();
  const header = req.headers['authorization'] || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic') {
    const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
    if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="admin"');
  res.status(401).send('Authentication required');
}

app.get('/', (req, res) => {
  logEvent('scan', req);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/log', (req, res) => {
  const { kind } = req.body || {};
  if (!kind) return res.status(400).json({ error: 'kind required' });
  logEvent(kind, req);
  res.json({ status: 'ok' });
});

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/stats', requireAuth, (req, res) => {
  const out = {};
  db.get('SELECT COUNT(*) AS c FROM events WHERE kind = "scan"', (e1, r1) => {
    out.total_scans = r1 ? r1.c : 0;
    db.get('SELECT COUNT(DISTINCT session_id) AS c FROM events WHERE kind = "scan"', (e2, r2) => {
      out.unique_devices = r2 ? r2.c : 0;
      db.all('SELECT ts, ip, ua, kind, session_id FROM events ORDER BY ts DESC LIMIT 50', (e3, rows) => {
        out.last_events = rows || [];
        res.json(out);
      });
    });
  });
});

app.get('/api/export.csv', requireAuth, (req, res) => {
  db.all('SELECT ts, ip, ua, kind, session_id FROM events ORDER BY ts ASC', (err, rows) => {
    const header = 'ts,ip,ua,kind,session_id\n';
    const csv = (rows || []).map(r => `${r.ts},${r.ip},"${r.ua.replace(/"/g, '""')}",${r.kind},${r.session_id}`).join('\n');
    res.set('Content-Type', 'text/csv');
    res.send(header + csv);
  });
});

app.get('/qr', (req, res) => {
  const text = req.query.text || PUBLIC_URL;
  const size = parseInt(req.query.size, 10) || 200;
  QRCode.toBuffer(text, { type: 'png', width: size }, (err, buf) => {
    if (err) return res.status(500).send('QR generation failed');
    res.set('Content-Type', 'image/png');
    res.send(buf);
  });
});

io.on('connection', () => {});

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
