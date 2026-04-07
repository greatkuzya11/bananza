const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const db = require('./db');

const clients = new Map(); // userId -> Set<ws>

function setupWebSocket(server, jwtSecret) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) { ws.close(4001, 'No token'); return; }

    let user;
    try {
      user = jwt.verify(token, jwtSecret);
    } catch { ws.close(4001, 'Invalid token'); return; }

    const dbUser = db.prepare('SELECT id, is_blocked FROM users WHERE id = ?').get(user.id);
    if (!dbUser || dbUser.is_blocked) { ws.close(4003, 'Blocked'); return; }

    ws.userId = user.id;
    ws.username = user.username;
    ws.isAlive = true;

    if (!clients.has(user.id)) clients.set(user.id, new Set());
    clients.get(user.id).add(ws);

    broadcastOnlineUsers();

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'typing' && msg.chatId) {
          broadcastToChat(msg.chatId, {
            type: 'typing', chatId: msg.chatId,
            userId: ws.userId, username: ws.username,
          }, ws.userId);
        }
      } catch {}
    });

    ws.on('close', () => {
      const s = clients.get(user.id);
      if (s) { s.delete(ws); if (s.size === 0) clients.delete(user.id); }
      broadcastOnlineUsers();
    });
  });

  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  return wss;
}

function broadcastToChat(chatId, data, excludeUserId) {
  const members = db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ?').all(chatId);
  const json = JSON.stringify(data);
  for (const { user_id } of members) {
    if (user_id === excludeUserId) continue;
    const conns = clients.get(user_id);
    if (conns) conns.forEach(ws => { if (ws.readyState === 1) ws.send(json); });
  }
}

function broadcastToChatAll(chatId, data) {
  const members = db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ?').all(chatId);
  const json = JSON.stringify(data);
  for (const { user_id } of members) {
    const conns = clients.get(user_id);
    if (conns) conns.forEach(ws => { if (ws.readyState === 1) ws.send(json); });
  }
}

function broadcastOnlineUsers() {
  const ids = [...clients.keys()];
  const json = JSON.stringify({ type: 'online', userIds: ids });
  clients.forEach(conns => {
    conns.forEach(ws => { if (ws.readyState === 1) ws.send(json); });
  });
}

function sendToUser(userId, data) {
  const conns = clients.get(userId);
  if (conns) {
    const json = JSON.stringify(data);
    conns.forEach(ws => { if (ws.readyState === 1) ws.send(json); });
  }
}

module.exports = { setupWebSocket, broadcastToChat, broadcastToChatAll, broadcastOnlineUsers, sendToUser, clients };
