// use global fetch available in Node 18+
const fetch = globalThis.fetch;
const WebSocket = require('ws');
const base = 'http://localhost:3000';

async function api(path, token, opts = {}){
  const headers = opts.headers || {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { ...opts, headers });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

function waitFor(ws, type, timeout=5000){
  return new Promise((resolve, reject)=>{
    const t = setTimeout(()=>{ ws.removeAllListeners('message'); reject(new Error('timeout')); }, timeout);
    ws.on('message', (data)=>{
      try{ const msg = JSON.parse(data); if(msg.type === type){ clearTimeout(t); resolve(msg); } }catch(e){}
    });
  });
}

(async ()=>{
  try{
    const u1 = { username: 'testA_' + Date.now()%10000, password: 'password', displayName: 'Test A' };
    const u2 = { username: 'testB_' + Date.now()%10000, password: 'password', displayName: 'Test B' };
    console.log('registering users...');
    const r1 = await api('/api/auth/register', null, { method: 'POST', body: JSON.stringify(u1) });
    const r2 = await api('/api/auth/register', null, { method: 'POST', body: JSON.stringify(u2) });
    console.log('r1', r1.user.id, 'r2', r2.user.id);
    const login1 = await api('/api/auth/login', null, { method: 'POST', body: JSON.stringify({ username: u1.username, password: u1.password }) });
    const login2 = await api('/api/auth/login', null, { method: 'POST', body: JSON.stringify({ username: u2.username, password: u2.password }) });
    const t1 = login1.token; const t2 = login2.token;
    console.log('logged in tokens acquired');

    console.log('creating private chat from A to B');
    const chat = await api('/api/chats/private', t1, { method: 'POST', body: JSON.stringify({ targetUserId: r2.user.id }) });
    console.log('chat created', chat.id);

    // open ws connections for A device1 and A device2, and B
    function connectWS(token){
      const ws = new WebSocket('ws://localhost:3000?token=' + encodeURIComponent(token));
      ws.on('open', ()=>{});
      ws.on('error', (e)=>{ console.error('WS error', e); });
      return ws;
    }

    console.log('opening WS sockets...');
    const wsA1 = connectWS(t1);
    const wsA2 = connectWS(t1);
    const wsB = connectWS(t2);

    await new Promise(r=>setTimeout(r,500));

    console.log('sending message as B');
    const msg = await api(`/api/chats/${chat.id}/messages`, t2, { method: 'POST', body: JSON.stringify({ text: 'Hello from B' }) });
    console.log('message posted id=', msg.id);

    console.log('waiting for message to arrive to A1');
    const incoming = await waitFor(wsA1, 'message', 3000).catch(()=>null);
    console.log('A1 incoming raw', incoming ? incoming.type : 'none');

    // mark as read from A (simulate device A marking read)
    console.log('A posting read');
    const readResp = await api(`/api/chats/${chat.id}/read`, t1, { method: 'POST', body: JSON.stringify({ lastReadId: msg.id }) });
    console.log('readResp', readResp);

    console.log('waiting for messages_read on A2');
    const readEvent = await waitFor(wsA2, 'messages_read', 3000).catch(()=>null);
    console.log('A2 got messages_read:', readEvent ? JSON.stringify(readEvent) : 'none');

    console.log('waiting for messages_read on B');
    const readEventB = await waitFor(wsB, 'messages_read', 3000).catch(()=>null);
    console.log('B got messages_read:', readEventB ? JSON.stringify(readEventB) : 'none');

    wsA1.close(); wsA2.close(); wsB.close();
    console.log('test done');
  }catch(e){ console.error(e); process.exit(1); }
})();
