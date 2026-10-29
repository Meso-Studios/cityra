#!/usr/bin/env node
'use strict';
/* =====================================================================
   CITY.RA — multiplayer relay and static server (no dependencies).

     node server.js            → http://localhost:8080/play.html
     PORT=9000 node server.js  → another port

   Serves the game folder and relays WebSocket traffic between players
   in the same room (ws://host:port/ws?room=CODE). The relay never runs
   the game: the hosting player's browser does. Each message is tagged
   with the sender id; "@id|payload" sends to one peer only.
   ===================================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const ROOT = __dirname;
const PORT = +process.env.PORT || 8080;
const MAX_MSG = 64 * 1024 * 1024;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/play.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || path.basename(file).startsWith('.')) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

/* ---------------- minimal RFC 6455 WebSocket ---------------- */
const rooms = new Map();
let nextId = 1;

function frame(text) {
  const body = Buffer.from(text, 'utf8'), n = body.length;
  let head;
  if (n < 126) { head = Buffer.alloc(2); head[1] = n; }
  else if (n < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(n, 2); }
  else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
  head[0] = 0x81;
  return Buffer.concat([head, body]);
}
function control(op, payload = Buffer.alloc(0)) { const h = Buffer.from([0x80 | op, payload.length]); return Buffer.concat([h, payload]); }

server.on('upgrade', (req, sock) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/ws' || !req.headers['sec-websocket-key']) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const room = (url.searchParams.get('room') || 'LOBBY').slice(0, 32), id = String(nextId++);
  const peer = { id, sock, room, buf: Buffer.alloc(0), parts: [] };
  if (!rooms.has(room)) rooms.set(room, new Map());
  rooms.get(room).set(id, peer);
  sock.write(frame('0|' + JSON.stringify({ t: 'welcome', id })));
  log(`peer ${id} joined room ${room} (${rooms.get(room).size} connected)`);

  sock.on('data', (chunk) => {
    peer.buf = Buffer.concat([peer.buf, chunk]);
    for (;;) {
      const b = peer.buf; if (b.length < 2) return;
      const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80; let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_MSG) { sock.destroy(); return; }
      const need = off + (masked ? 4 : 0) + len; if (b.length < need) return;
      let data = b.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const m = b.subarray(off, off + 4), out = Buffer.alloc(len); for (let i = 0; i < len; i++) out[i] = data[i] ^ m[i & 3]; data = out; }
      peer.buf = b.subarray(need);
      if (op === 0x8) { sock.end(control(0x8)); return; }
      if (op === 0x9) { sock.write(control(0xA, data)); continue; }
      if (op === 0x1 || op === 0x0) { peer.parts.push(data); if (fin) { relay(peer, Buffer.concat(peer.parts).toString('utf8')); peer.parts = []; } }
    }
  });
  const gone = () => {
    const r = rooms.get(room); if (!r || !r.has(id)) return;
    r.delete(id); log(`peer ${id} left room ${room}`);
    for (const o of r.values()) o.sock.write(frame(id + '|' + JSON.stringify({ t: 'bye' })));
    if (!r.size) rooms.delete(room);
  };
  sock.on('close', gone); sock.on('error', gone);
});

function relay(peer, text) {
  const r = rooms.get(peer.room); if (!r) return;
  if (text[0] === '@') { const i = text.indexOf('|'), to = r.get(text.slice(1, i)); if (to) to.sock.write(frame(peer.id + '|' + text.slice(i + 1))); return; }
  const out = frame(peer.id + '|' + text);
  for (const o of r.values()) if (o !== peer) o.sock.write(out);
}
function log(s) { console.log(new Date().toTimeString().slice(0, 8) + '  ' + s); }

server.listen(PORT, () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address);
  console.log('City.RA server running.');
  console.log('  On this computer:   http://localhost:' + PORT + '/play.html');
  for (const ip of ips) console.log('  On your network:    http://' + ip + ':' + PORT + '/play.html');
  console.log('Open Multiplayer → Network in the game; the relay address fills in automatically.');
});
