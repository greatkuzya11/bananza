(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIG
  // ═══════════════════════════════════════════════════════════════════════════
  const WS_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
  const PAGE_SIZE = 50;
  const MAX_MSG = 5000;

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  let currentUser = null;
  let token = null;
  let chats = [];
  let currentChatId = null;
  let ws = null;
  let wsRetry = 1000;
  let onlineUsers = new Set();
  let loadingMore = false;
  let hasMore = true;
  let pendingFile = null;
  let typingSendTimeout = null;
  let typingDisplayTimeouts = {};
  let displayedMsgIds = new Set();

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM
  // ═══════════════════════════════════════════════════════════════════════════
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const sidebar = $('#sidebar');
  const chatList = $('#chatList');
  const chatSearch = $('#chatSearch');
  const chatArea = $('#chatArea');
  const emptyState = $('#emptyState');
  const chatView = $('#chatView');
  const chatTitle = $('#chatTitle');
  const chatStatus = $('#chatStatus');
  const messagesEl = $('#messages');
  const loadMoreWrap = $('#loadMoreWrap');
  const loadMoreBtn = $('#loadMoreBtn');
  const typingBar = $('#typingBar');
  const msgInput = $('#msgInput');
  const sendBtn = $('#sendBtn');
  const attachBtn = $('#attachBtn');
  const emojiBtn = $('#emojiBtn');
  const fileInput = $('#fileInput');
  const pendingFileEl = $('#pendingFile');
  const emojiPicker = $('#emojiPicker');
  const imageViewer = $('#imageViewer');
  const ivImage = $('#ivImage');
  const newChatModal = $('#newChatModal');
  const adminModal = $('#adminModal');
  const chatInfoModal = $('#chatInfoModal');
  const menuDrawer = $('#menuDrawer');
  const currentUserInfo = $('#currentUserInfo');
  const adminBtn = $('#adminBtn');

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════════════════════════════════════════
  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function linkify(text) {
    return esc(text).replace(
      /https?:\/\/[^\s<>"')\]]+/gi,
      (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
  }

  function formatTime(iso) {
    const d = new Date(iso + 'Z');
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(iso) {
    const d = new Date(iso + 'Z');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function initials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2) || '?';
  }

  async function api(url, opts = {}) {
    const headers = { ...opts.headers };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (opts.body && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(url, { ...opts, headers });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) { logout(); return; }
      throw new Error(data.error || 'Error');
    }
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════════════════
  function checkAuth() {
    token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) { location.href = '/login.html'; return false; }
    try { currentUser = JSON.parse(userStr); } catch { logout(); return false; }
    return true;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (ws) ws.close();
    location.href = '/login.html';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBSOCKET
  // ═══════════════════════════════════════════════════════════════════════════
  function connectWS() {
    ws = new WebSocket(WS_URL + '?token=' + encodeURIComponent(token));

    ws.onopen = () => { wsRetry = 1000; };

    ws.onclose = () => {
      setTimeout(() => { wsRetry = Math.min(wsRetry * 2, 30000); connectWS(); }, wsRetry);
    };

    ws.onmessage = (e) => {
      try { handleWSMessage(JSON.parse(e.data)); } catch {}
    };
  }

  function handleWSMessage(msg) {
    switch (msg.type) {
      case 'message': {
        // Update chat list regardless
        updateChatListLastMessage(msg.message);
        // Only render if we're in the relevant chat
        if (msg.message.chat_id === currentChatId && !displayedMsgIds.has(msg.message.id)) {
          appendMessage(msg.message);
          scrollToBottom();
        }
        break;
      }
      case 'link_preview': {
        if (msg.messageId) {
          const el = messagesEl.querySelector(`[data-msg-id="${msg.messageId}"]`);
          if (el) {
            const bubble = el.querySelector('.msg-bubble');
            const existing = bubble.querySelector('.link-preview');
            if (!existing) bubble.insertAdjacentHTML('beforeend', renderLinkPreview(msg.preview));
          }
        }
        break;
      }
      case 'message_deleted': {
        const el = messagesEl.querySelector(`[data-msg-id="${msg.messageId}"]`);
        if (el) {
          const bubble = el.querySelector('.msg-bubble');
          bubble.innerHTML = '<span class="msg-deleted">Message deleted</span><span class="msg-time">' + bubble.querySelector('.msg-time')?.outerHTML.match(/>([^<]+)</)?.[1] + '</span>';
        }
        break;
      }
      case 'online': {
        onlineUsers = new Set(msg.userIds);
        updateOnlineDisplay();
        break;
      }
      case 'typing': {
        if (msg.chatId === currentChatId && msg.userId !== currentUser.id) {
          showTyping(msg.username);
        }
        break;
      }
      case 'chat_created': {
        loadChats();
        break;
      }
    }
  }

  function sendTyping() {
    if (!ws || ws.readyState !== 1 || !currentChatId) return;
    ws.send(JSON.stringify({ type: 'typing', chatId: currentChatId }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT LIST
  // ═══════════════════════════════════════════════════════════════════════════
  async function loadChats() {
    try {
      chats = await api('/api/chats');
      renderChatList();
    } catch {}
  }

  function renderChatList(filter = '') {
    chatList.innerHTML = '';
    const filtered = filter
      ? chats.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()))
      : chats;

    for (const chat of filtered) {
      const el = document.createElement('div');
      el.className = 'chat-item' + (chat.id === currentChatId ? ' active' : '');
      el.dataset.chatId = chat.id;

      const avatarColor = chat.type === 'private' && chat.private_user
        ? chat.private_user.avatar_color : '#5eb5f7';
      const displayName = chat.name;
      const isOnline = chat.type === 'private' && chat.private_user && onlineUsers.has(chat.private_user.id);
      const icon = chat.type === 'general' ? '🌐' : (chat.type === 'private' ? '' : '👥');

      let lastMsg = '';
      if (chat.last_text) {
        lastMsg = (chat.last_user ? chat.last_user + ': ' : '') + chat.last_text;
      } else if (chat.last_file_id) {
        lastMsg = (chat.last_user ? chat.last_user + ': ' : '') + '📎 File';
      }

      const lastTime = chat.last_time ? formatTime(chat.last_time) : '';

      el.innerHTML = `
        <div class="chat-item-avatar" style="background:${avatarColor}">
          ${icon || initials(displayName)}
          ${isOnline ? '<div class="online-dot"></div>' : ''}
        </div>
        <div class="chat-item-body">
          <div class="chat-item-top">
            <span class="chat-item-name">${esc(displayName)}</span>
            <span class="chat-item-time">${lastTime}</span>
          </div>
          <div class="chat-item-last">${esc(lastMsg).substring(0, 60)}</div>
        </div>
      `;
      el.addEventListener('click', () => openChat(chat.id));
      chatList.appendChild(el);
    }
  }

  function updateChatListLastMessage(msg) {
    const chat = chats.find(c => c.id === msg.chat_id);
    if (chat) {
      chat.last_text = msg.text || null;
      chat.last_time = msg.created_at;
      chat.last_user = msg.display_name;
      chat.last_file_id = msg.file_id;
      // Re-sort
      chats.sort((a, b) => {
        if (!a.last_time && !b.last_time) return 0;
        if (!a.last_time) return 1;
        if (!b.last_time) return -1;
        return b.last_time.localeCompare(a.last_time);
      });
      renderChatList(chatSearch.value);
    }
  }

  function updateOnlineDisplay() {
    renderChatList(chatSearch.value);
    if (currentChatId) updateChatStatus();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPEN CHAT
  // ═══════════════════════════════════════════════════════════════════════════
  async function openChat(chatId) {
    currentChatId = chatId;
    displayedMsgIds.clear();
    hasMore = true;

    emptyState.classList.add('hidden');
    chatView.classList.remove('hidden');

    // Update sidebar active state
    chatList.querySelectorAll('.chat-item').forEach(el => {
      el.classList.toggle('active', +el.dataset.chatId === chatId);
    });

    // Mobile: hide sidebar
    if (window.innerWidth <= 768) sidebar.classList.add('sidebar-hidden');

    const chat = chats.find(c => c.id === chatId);
    chatTitle.textContent = chat ? chat.name : 'Chat';
    updateChatStatus();

    // Clear and load messages
    messagesEl.querySelectorAll('.msg-row, .date-separator').forEach(el => el.remove());
    loadMoreWrap.classList.add('hidden');

    try {
      const msgs = await api(`/api/chats/${chatId}/messages?limit=${PAGE_SIZE}`);
      hasMore = msgs.length >= PAGE_SIZE;
      if (hasMore) loadMoreWrap.classList.remove('hidden');
      renderMessages(msgs);
      scrollToBottom(true);
    } catch {}

    msgInput.focus();
    localStorage.setItem('lastChat', chatId);
  }

  function updateChatStatus() {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    if (chat.type === 'private' && chat.private_user) {
      chatStatus.textContent = onlineUsers.has(chat.private_user.id) ? 'online' : 'offline';
      chatStatus.style.color = onlineUsers.has(chat.private_user.id) ? 'var(--success)' : '';
    } else {
      const onlineCount = [...onlineUsers].length;
      chatStatus.textContent = `${onlineCount} online`;
      chatStatus.style.color = '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════
  function renderMessages(msgs) {
    let lastDate = null;
    const existingFirst = messagesEl.querySelector('.msg-row');

    for (const msg of msgs) {
      const msgDate = formatDate(msg.created_at);
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        const sep = document.createElement('div');
        sep.className = 'date-separator';
        sep.innerHTML = `<span>${msgDate}</span>`;
        if (existingFirst) messagesEl.insertBefore(sep, existingFirst);
        else messagesEl.appendChild(sep);
      }
      const el = createMessageEl(msg);
      if (existingFirst) messagesEl.insertBefore(el, existingFirst);
      else messagesEl.appendChild(el);
      displayedMsgIds.add(msg.id);
    }
  }

  function appendMessage(msg) {
    // Check if we need a date separator
    const lastMsgEl = messagesEl.querySelector('.msg-row:last-child');
    const msgDate = formatDate(msg.created_at);
    if (lastMsgEl) {
      const lastMsg = lastMsgEl.dataset.date;
      if (lastMsg !== msgDate) {
        const sep = document.createElement('div');
        sep.className = 'date-separator';
        sep.innerHTML = `<span>${msgDate}</span>`;
        messagesEl.appendChild(sep);
      }
    }

    const el = createMessageEl(msg);
    messagesEl.appendChild(el);
    displayedMsgIds.add(msg.id);
  }

  function createMessageEl(msg) {
    const isOwn = msg.user_id === currentUser.id;
    const row = document.createElement('div');
    row.className = `msg-row ${isOwn ? 'own' : 'other'}`;
    row.dataset.msgId = msg.id;
    row.dataset.date = formatDate(msg.created_at);

    let html = '';

    // Sender name (for other users)
    if (!isOwn) {
      html += `<div class="msg-sender" style="color:${msg.avatar_color || '#65aadd'}">${esc(msg.display_name)}</div>`;
    }

    html += '<div class="msg-bubble">';

    if (msg.is_deleted) {
      html += `<span class="msg-deleted">Message deleted</span>`;
    } else {
      // File attachment
      if (msg.file_id && msg.file_stored) {
        html += renderFileAttachment(msg);
      }

      // Text
      if (msg.text) {
        html += `<div class="msg-text">${linkify(msg.text)}</div>`;
      }

      // Link previews
      if (msg.previews && msg.previews.length > 0) {
        for (const p of msg.previews) {
          html += renderLinkPreview(p);
        }
      }

      // Delete button
      if (isOwn || currentUser.is_admin) {
        html += `<button class="msg-delete-btn" data-id="${msg.id}" title="Delete">🗑</button>`;
      }
    }

    html += `<span class="msg-time">${formatTime(msg.created_at)}</span>`;
    html += '</div>';

    row.innerHTML = html;

    // Event listeners
    const deleteBtn = row.querySelector('.msg-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteMessage(msg.id); });
    }

    const img = row.querySelector('.msg-image');
    if (img) {
      img.addEventListener('click', () => openImageViewer(img.src));
    }

    return row;
  }

  function renderFileAttachment(msg) {
    const url = `/uploads/${msg.file_stored}`;
    switch (msg.file_type) {
      case 'image':
        return `<img class="msg-image" src="${url}" alt="${esc(msg.file_name)}" loading="lazy">`;
      case 'audio':
        return `<div class="msg-audio">
          <div style="font-size:13px;margin-bottom:4px">🎵 ${esc(msg.file_name)}</div>
          <audio controls preload="none"><source src="${url}" type="${msg.file_mime}"></audio>
          <div style="font-size:11px;color:var(--text-secondary)">${formatSize(msg.file_size)} · <a href="${url}" download="${esc(msg.file_name)}">Download</a></div>
        </div>`;
      case 'video':
        return `<div class="msg-video">
          <video controls preload="metadata" playsinline><source src="${url}" type="${msg.file_mime}"></video>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${esc(msg.file_name)} · ${formatSize(msg.file_size)} · <a href="${url}" download="${esc(msg.file_name)}">Download</a></div>
        </div>`;
      default:
        return `<a class="msg-file" href="${url}" download="${esc(msg.file_name)}">
          <div class="msg-file-icon">📄</div>
          <div class="msg-file-info">
            <div class="msg-file-name">${esc(msg.file_name)}</div>
            <div class="msg-file-size">${formatSize(msg.file_size)}</div>
          </div>
        </a>`;
    }
  }

  function renderLinkPreview(p) {
    if (!p || (!p.title && !p.description && !p.image)) return '';
    let html = `<a class="link-preview" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">`;
    if (p.hostname) html += `<div class="lp-host">${esc(p.hostname)}</div>`;
    if (p.title) html += `<div class="lp-title">${esc(p.title)}</div>`;
    if (p.description) html += `<div class="lp-desc">${esc(p.description)}</div>`;
    if (p.image) html += `<img class="lp-image" src="${esc(p.image)}" alt="" loading="lazy" onerror="this.remove()">`;
    html += '</a>';
    return html;
  }

  // Load more messages
  async function loadMore() {
    if (loadingMore || !hasMore || !currentChatId) return;
    loadingMore = true;
    loadMoreBtn.textContent = 'Loading...';

    const firstMsg = messagesEl.querySelector('.msg-row');
    const firstId = firstMsg ? firstMsg.dataset.msgId : null;
    const scrollH = messagesEl.scrollHeight;

    try {
      const url = `/api/chats/${currentChatId}/messages?limit=${PAGE_SIZE}${firstId ? '&before=' + firstId : ''}`;
      const msgs = await api(url);
      hasMore = msgs.length >= PAGE_SIZE;
      if (!hasMore) loadMoreWrap.classList.add('hidden');

      // Insert at top
      let lastDate = null;
      const insertBefore = messagesEl.querySelector('.date-separator, .msg-row');
      for (const msg of msgs) {
        const msgDate = formatDate(msg.created_at);
        if (msgDate !== lastDate) {
          lastDate = msgDate;
          const sep = document.createElement('div');
          sep.className = 'date-separator';
          sep.innerHTML = `<span>${msgDate}</span>`;
          messagesEl.insertBefore(sep, insertBefore);
        }
        const el = createMessageEl(msg);
        messagesEl.insertBefore(el, insertBefore);
        displayedMsgIds.add(msg.id);
      }

      // Maintain scroll position
      messagesEl.scrollTop = messagesEl.scrollHeight - scrollH;
    } catch {}

    loadingMore = false;
    loadMoreBtn.textContent = 'Load earlier messages';
  }

  function scrollToBottom(instant = false) {
    requestAnimationFrame(() => {
      messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: instant ? 'instant' : 'smooth' });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEND MESSAGE
  // ═══════════════════════════════════════════════════════════════════════════
  async function sendMessage() {
    if (!currentChatId) return;
    const text = msgInput.value.trim();
    const fileId = pendingFile ? pendingFile.id : null;

    if (!text && !fileId) return;
    if (text.length > MAX_MSG) { alert('Message too long'); return; }

    msgInput.value = '';
    autoResize();
    clearPendingFile();

    try {
      await api(`/api/chats/${currentChatId}/messages`, {
        method: 'POST',
        body: { text: text || null, fileId }
      });
      scrollToBottom();
    } catch (e) {
      alert(e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE MESSAGE
  // ═══════════════════════════════════════════════════════════════════════════
  async function deleteMessage(id) {
    if (!confirm('Delete this message?')) return;
    try { await api(`/api/messages/${id}`, { method: 'DELETE' }); } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════
  async function uploadFile(file) {
    if (file.size > 25 * 1024 * 1024) { alert('File too large (max 25 MB)'); return; }

    pendingFileEl.classList.remove('hidden');
    pendingFileEl.innerHTML = `
      <span>📎</span>
      <span class="pending-file-name">Uploading ${esc(file.name)}...</span>
    `;

    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await api('/api/upload', { method: 'POST', body: fd });
      pendingFile = data;
      pendingFileEl.innerHTML = `
        <span>${data.type === 'image' ? '🖼' : data.type === 'audio' ? '🎵' : data.type === 'video' ? '🎬' : '📄'}</span>
        <span class="pending-file-name">${esc(data.original_name)} (${formatSize(data.size)})</span>
        <button class="pending-file-remove" title="Remove">✕</button>
      `;
      pendingFileEl.querySelector('.pending-file-remove').addEventListener('click', clearPendingFile);
      msgInput.focus();
    } catch (e) {
      alert(e.message);
      clearPendingFile();
    }
  }

  function clearPendingFile() {
    pendingFile = null;
    pendingFileEl.classList.add('hidden');
    pendingFileEl.innerHTML = '';
    fileInput.value = '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPING INDICATOR
  // ═══════════════════════════════════════════════════════════════════════════
  function showTyping(username) {
    typingBar.classList.remove('hidden');
    typingBar.textContent = `${username} is typing...`;
    clearTimeout(typingDisplayTimeouts[username]);
    typingDisplayTimeouts[username] = setTimeout(() => {
      delete typingDisplayTimeouts[username];
      if (Object.keys(typingDisplayTimeouts).length === 0) {
        typingBar.classList.add('hidden');
      }
    }, 3000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EMOJI PICKER
  // ═══════════════════════════════════════════════════════════════════════════
  const EMOJIS = {
    '😀': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😘','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
    '👋': ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','💪','🦾','🖤'],
    '❤️': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','❤️‍🔥','❤️‍🩹','♥️'],
    '🎉': ['🎉','🎊','🎈','🎁','🏆','🥇','🥈','🥉','⚽','🏀','🎾','🎮','🎯','🎲','🔔','🎵','🎶','🎤','🎧','📱','💻','💡','📷','🎬','📚','✏️','📝','🔑','🔒','⭐','🌟','💫','✨','⚡','🔥','💯','🚀','🛸'],
    '🍕': ['🍕','🍔','🍟','🌭','🍿','🧀','🥚','🍳','🥞','🧇','🥓','🍗','🍖','🌮','🌯','🍝','🍜','🍣','🍱','🥟','🍦','🍩','🍪','🎂','🍰','🧁','🍫','🍬','🍭','☕','🍵','🧃','🧋','🍺','🍻','🥂','🍷','🍸','🍹','🥤','🍌'],
    '🌿': ['🌸','🌺','🌻','🌹','🌷','🌼','🌿','☘️','🍀','🍁','🍂','🌲','🌳','🌴','🌵','🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦄','🐝','🐛','🦋','🐌','🐞','🌍','🌙','☀️','⛅','🌈','💧','❄️'],
  };

  function initEmojiPicker() {
    const cats = Object.keys(EMOJIS);
    let html = '<div class="emoji-tabs">';
    cats.forEach((cat, i) => {
      html += `<div class="emoji-tab ${i === 0 ? 'active' : ''}" data-cat="${i}">${cat}</div>`;
    });
    html += '</div><div class="emoji-grid">';
    EMOJIS[cats[0]].forEach(e => { html += `<div class="emoji-item">${e}</div>`; });
    html += '</div>';
    emojiPicker.innerHTML = html;

    emojiPicker.addEventListener('click', (e) => {
      const tab = e.target.closest('.emoji-tab');
      if (tab) {
        emojiPicker.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const grid = emojiPicker.querySelector('.emoji-grid');
        const emojis = EMOJIS[cats[+tab.dataset.cat]];
        grid.innerHTML = emojis.map(em => `<div class="emoji-item">${em}</div>`).join('');
        return;
      }
      const item = e.target.closest('.emoji-item');
      if (item) {
        const pos = msgInput.selectionStart;
        const before = msgInput.value.substring(0, pos);
        const after = msgInput.value.substring(pos);
        msgInput.value = before + item.textContent + after;
        msgInput.selectionStart = msgInput.selectionEnd = pos + item.textContent.length;
        msgInput.focus();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE VIEWER
  // ═══════════════════════════════════════════════════════════════════════════
  function openImageViewer(src) {
    ivImage.src = src;
    imageViewer.classList.remove('hidden');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════════════════════
  function closeAllModals() {
    [newChatModal, adminModal, chatInfoModal, menuDrawer, emojiPicker].forEach(m => m.classList.add('hidden'));
    imageViewer.classList.add('hidden');
  }

  // New chat modal
  async function openNewChatModal() {
    closeAllModals();
    newChatModal.classList.remove('hidden');
    try {
      const users = await api('/api/users');
      const privateList = $('#userListPrivate');
      const groupList = $('#userListGroup');

      privateList.innerHTML = users.map(u => `
        <div class="user-list-item" data-uid="${u.id}">
          <div class="avatar" style="background:${u.avatar_color}">${initials(u.display_name)}</div>
          <div>
            <div class="name">${esc(u.display_name)}</div>
            <div class="status-text">${u.online ? 'online' : 'offline'}</div>
          </div>
        </div>
      `).join('') || '<div style="color:var(--text-secondary);padding:12px">No other users yet</div>';

      groupList.innerHTML = users.map(u => `
        <div class="user-list-item" data-uid="${u.id}">
          <div class="avatar" style="background:${u.avatar_color}">${initials(u.display_name)}</div>
          <div>
            <div class="name">${esc(u.display_name)}</div>
          </div>
        </div>
      `).join('');

      // Private: click to start chat
      privateList.querySelectorAll('.user-list-item').forEach(el => {
        el.addEventListener('click', async () => {
          try {
            const chat = await api('/api/chats/private', { method: 'POST', body: { targetUserId: +el.dataset.uid } });
            closeAllModals();
            await loadChats();
            openChat(chat.id);
          } catch {}
        });
      });

      // Group: toggle selection
      groupList.querySelectorAll('.user-list-item').forEach(el => {
        el.addEventListener('click', () => el.classList.toggle('selected'));
      });
    } catch {}
  }

  // Admin modal
  async function openAdminModal() {
    closeAllModals();
    adminModal.classList.remove('hidden');
    try {
      const users = await api('/api/admin/users');
      const list = $('#adminUserList');
      list.innerHTML = users.map(u => `
        <div class="admin-user-row" data-uid="${u.id}">
          <div class="avatar" style="background:${u.avatar_color}">${initials(u.display_name)}</div>
          <div class="info">
            <div class="name">${esc(u.display_name)} <span style="color:var(--text-secondary)">@${esc(u.username)}</span></div>
            <div class="meta">Joined: ${new Date(u.created_at + 'Z').toLocaleDateString()}</div>
          </div>
          ${u.is_admin ? '<span class="badge badge-admin">Admin</span>' : ''}
          ${u.is_blocked ? '<span class="badge badge-blocked">Blocked</span>' : ''}
          ${!u.is_admin ? `<button class="block-btn ${u.is_blocked ? 'is-blocked' : ''}" data-uid="${u.id}">${u.is_blocked ? 'Unblock' : 'Block'}</button>` : ''}
        </div>
      `).join('');

      list.querySelectorAll('.block-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const res = await api(`/api/admin/users/${btn.dataset.uid}/block`, { method: 'POST' });
            openAdminModal(); // Refresh
          } catch {}
        });
      });
    } catch {}
  }

  // Chat info modal
  async function openChatInfoModal() {
    if (!currentChatId) return;
    closeAllModals();
    chatInfoModal.classList.remove('hidden');

    const chat = chats.find(c => c.id === currentChatId);
    $('#chatInfoTitle').textContent = chat ? chat.name : 'Chat Info';

    try {
      const members = await api(`/api/chats/${currentChatId}/members`);
      const memberList = $('#chatMemberList');
      memberList.innerHTML = members.map(u => `
        <div class="user-list-item">
          <div class="avatar" style="background:${u.avatar_color}">${initials(u.display_name)}</div>
          <div>
            <div class="name">${esc(u.display_name)}</div>
            <div class="status-text">${onlineUsers.has(u.id) ? 'online' : 'offline'}</div>
          </div>
        </div>
      `).join('');

      // Add member section for groups
      const addWrap = $('#addMemberWrap');
      if (chat && chat.type === 'group') {
        addWrap.classList.remove('hidden');
        const allUsers = await api('/api/users');
        const memberIds = new Set(members.map(m => m.id));
        const nonMembers = allUsers.filter(u => !memberIds.has(u.id));

        const addList = $('#addMemberList');
        addList.innerHTML = nonMembers.map(u => `
          <div class="user-list-item" data-uid="${u.id}">
            <div class="avatar" style="background:${u.avatar_color}">${initials(u.display_name)}</div>
            <div><div class="name">${esc(u.display_name)}</div></div>
          </div>
        `).join('') || '<div style="color:var(--text-secondary)">All users are already members</div>';

        addList.querySelectorAll('.user-list-item').forEach(el => {
          el.addEventListener('click', async () => {
            try {
              await api(`/api/chats/${currentChatId}/members`, { method: 'POST', body: { userId: +el.dataset.uid } });
              openChatInfoModal();
            } catch {}
          });
        });
      } else {
        addWrap.classList.add('hidden');
      }
    } catch {}
  }

  // Menu drawer
  function openMenuDrawer() {
    closeAllModals();
    menuDrawer.classList.remove('hidden');
    const info = $('#menuUserInfo');
    info.innerHTML = `
      <div class="avatar" style="background:${currentUser.avatar_color}">${initials(currentUser.display_name)}</div>
      <div class="name">${esc(currentUser.display_name)}</div>
      <div class="username">@${esc(currentUser.username)}</div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO RESIZE TEXTAREA
  // ═══════════════════════════════════════════════════════════════════════════
  function autoResize() {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 150) + 'px';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════
  function setupEvents() {
    // Send message
    sendBtn.addEventListener('click', sendMessage);
    msgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    msgInput.addEventListener('input', () => {
      autoResize();
      // Typing indicator
      if (!typingSendTimeout) {
        sendTyping();
        typingSendTimeout = setTimeout(() => { typingSendTimeout = null; }, 2000);
      }
    });

    // File
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) uploadFile(fileInput.files[0]);
    });

    // Emoji
    emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      emojiPicker.classList.toggle('hidden');
    });

    // Image viewer close
    imageViewer.addEventListener('click', (e) => {
      if (e.target === imageViewer || e.target.closest('.iv-close')) imageViewer.classList.add('hidden');
    });

    // Sidebar search
    chatSearch.addEventListener('input', () => renderChatList(chatSearch.value));

    // Back button (mobile)
    $('#backBtn').addEventListener('click', () => sidebar.classList.remove('sidebar-hidden'));

    // New chat
    $('#newChatBtn').addEventListener('click', openNewChatModal);

    // Create group
    $('#createGroupBtn').addEventListener('click', async () => {
      const name = $('#groupName').value.trim();
      if (!name) { alert('Enter group name'); return; }
      const selected = [...$$('#userListGroup .user-list-item.selected')].map(el => +el.dataset.uid);
      try {
        const chat = await api('/api/chats', { method: 'POST', body: { name, type: 'group', memberIds: selected } });
        closeAllModals();
        await loadChats();
        openChat(chat.id);
      } catch (e) { alert(e.message); }
    });

    // Modal tabs
    newChatModal.querySelectorAll('.modal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        newChatModal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        newChatModal.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
      });
    });

    // Modal close buttons
    $$('.modal-close').forEach(btn => {
      btn.addEventListener('click', closeAllModals);
    });
    $$('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => { if (e.target === modal) closeAllModals(); });
    });

    // Admin button
    adminBtn.addEventListener('click', openAdminModal);

    // Menu button
    $('#menuBtn').addEventListener('click', openMenuDrawer);

    // Chat info button
    $('#chatInfoBtn').addEventListener('click', openChatInfoModal);

    // Logout
    $('#logoutBtn').addEventListener('click', () => { if (confirm('Logout?')) logout(); });

    // Load more
    loadMoreBtn.addEventListener('click', loadMore);

    // Scroll to load more
    messagesEl.addEventListener('scroll', () => {
      if (messagesEl.scrollTop < 60 && hasMore && !loadingMore) loadMore();
    });

    // Close emoji picker on outside click
    document.addEventListener('click', (e) => {
      if (!emojiPicker.classList.contains('hidden') && !emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.classList.add('hidden');
      }
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllModals();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════
  async function init() {
    if (!checkAuth()) return;

    // Verify token
    try {
      const data = await api('/api/auth/me');
      currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(currentUser));
    } catch { return; }

    // Update UI
    currentUserInfo.textContent = currentUser.display_name;
    if (currentUser.is_admin) adminBtn.classList.remove('hidden');

    setupEvents();
    initEmojiPicker();
    connectWS();
    await loadChats();

    // Open last chat or general
    const lastChat = +localStorage.getItem('lastChat');
    if (lastChat && chats.find(c => c.id === lastChat)) {
      openChat(lastChat);
    } else if (chats.length > 0) {
      openChat(chats[0].id);
    }
  }

  init();
})();
