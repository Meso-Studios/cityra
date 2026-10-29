#!/usr/bin/env python3
"""City.RA multiplayer relay and static server (standard library only).

    python3 server.py              -> http://localhost:8080/play.html
    python3 server.py 9000         -> another port

Same protocol as server.js: serves the game folder and relays WebSocket
traffic between players in a room (ws://host:port/ws?room=CODE). Each
relayed message is prefixed with the sender id; "@id|payload" goes to
one peer only. The hosting player's browser runs the game.
"""
import asyncio, base64, hashlib, json, mimetypes, os, socket, struct, sys, time
from urllib.parse import urlsplit, parse_qs, unquote

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT', 8080))
MAX_MSG = 64 * 1024 * 1024
rooms = {}
next_id = [1]


def log(s):
    print(time.strftime('%H:%M:%S') + '  ' + s, flush=True)


def frame(text):
    body = text.encode('utf-8'); n = len(body)
    if n < 126: head = struct.pack('!BB', 0x81, n)
    elif n < 65536: head = struct.pack('!BBH', 0x81, 126, n)
    else: head = struct.pack('!BBQ', 0x81, 127, n)
    return head + body


class Peer:
    def __init__(self, pid, room, writer):
        self.id, self.room, self.w = pid, room, writer

    def send(self, data):
        try: self.w.write(data)
        except Exception: pass


async def relay(peer, text):
    r = rooms.get(peer.room)
    if not r: return
    if text.startswith('@'):
        i = text.index('|'); to = r.get(text[1:i])
        if to: to.send(frame(peer.id + '|' + text[i + 1:]))
        return
    out = frame(peer.id + '|' + text)
    for o in list(r.values()):
        if o is not peer: o.send(out)


async def websocket(reader, writer, headers, query):
    key = headers.get('sec-websocket-key', '')
    accept = base64.b64encode(hashlib.sha1((key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
    writer.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n').encode())
    room = (query.get('room', ['LOBBY'])[0] or 'LOBBY')[:32]
    pid = str(next_id[0]); next_id[0] += 1
    peer = Peer(pid, room, writer)
    rooms.setdefault(room, {})[pid] = peer
    peer.send(frame('0|' + json.dumps({'t': 'welcome', 'id': pid})))
    log('peer %s joined room %s (%d connected)' % (pid, room, len(rooms[room])))
    parts = []
    try:
        while True:
            h = await reader.readexactly(2)
            fin, op, masked, n = h[0] & 0x80, h[0] & 0x0f, h[1] & 0x80, h[1] & 0x7f
            if n == 126: n = struct.unpack('!H', await reader.readexactly(2))[0]
            elif n == 127: n = struct.unpack('!Q', await reader.readexactly(8))[0]
            if n > MAX_MSG: break
            mask = await reader.readexactly(4) if masked else None
            data = await reader.readexactly(n)
            if mask: data = bytes(b ^ mask[i & 3] for i, b in enumerate(data)) if n < 4096 else _unmask(data, mask)
            if op == 0x8: break
            if op == 0x9: writer.write(struct.pack('!BB', 0x8A, len(data)) + data); continue
            if op in (0x0, 0x1):
                parts.append(data)
                if fin:
                    await relay(peer, b''.join(parts).decode('utf-8', 'replace')); parts = []
            await writer.drain()
    except (asyncio.IncompleteReadError, ConnectionError):
        pass
    finally:
        r = rooms.get(room, {})
        r.pop(pid, None)
        log('peer %s left room %s' % (pid, room))
        for o in list(r.values()): o.send(frame(pid + '|' + json.dumps({'t': 'bye'})))
        if not r: rooms.pop(room, None)
        try: writer.close()
        except Exception: pass


def _unmask(data, mask):
    # fast XOR for large frames: repeat the 4-byte mask and xor as big integers
    m = (mask * (len(data) // 4 + 1))[:len(data)]
    return (int.from_bytes(data, 'big') ^ int.from_bytes(m, 'big')).to_bytes(len(data), 'big')


async def handle(reader, writer):
    try:
        line = (await reader.readline()).decode('latin-1')
        if not line: return writer.close()
        method, target, _ = (line.split(' ') + ['', '', ''])[:3]
        headers = {}
        while True:
            h = (await reader.readline()).decode('latin-1')
            if h in ('\r\n', '\n', ''): break
            k, _, v = h.partition(':'); headers[k.strip().lower()] = v.strip()
        url = urlsplit(target)
        if url.path == '/ws' and headers.get('upgrade', '').lower() == 'websocket':
            return await websocket(reader, writer, headers, parse_qs(url.query))
        path = unquote(url.path)
        if path == '/': path = '/play.html'
        file = os.path.normpath(os.path.join(ROOT, path.lstrip('/')))
        if not file.startswith(ROOT) or os.path.basename(file).startswith('.') or not os.path.isfile(file):
            writer.write(b'HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\nConnection: close\r\n\r\nNot found')
        else:
            with open(file, 'rb') as fh: body = fh.read()
            ctype = mimetypes.guess_type(file)[0] or 'application/octet-stream'
            if ctype.startswith('text/') or ctype.endswith('javascript'): ctype += '; charset=utf-8'
            writer.write(('HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %d\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n' % (ctype, len(body))).encode() + body)
        await writer.drain(); writer.close()
    except Exception:
        try: writer.close()
        except Exception: pass


async def main():
    server = await asyncio.start_server(handle, '0.0.0.0', PORT)
    ips = set()
    try: ips.add(socket.gethostbyname(socket.gethostname()))
    except Exception: pass
    print('City.RA server running.')
    print('  On this computer:   http://localhost:%d/play.html' % PORT)
    for ip in ips:
        if not ip.startswith('127.'): print('  On your network:    http://%s:%d/play.html' % (ip, PORT))
    print('Open Multiplayer -> Network in the game; the relay address fills in automatically.', flush=True)
    async with server: await server.serve_forever()

if __name__ == '__main__':
    try: asyncio.run(main())
    except KeyboardInterrupt: pass
