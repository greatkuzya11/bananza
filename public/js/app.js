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
  let pendingFiles = []; // queue for multi-file upload
  let typingSendTimeout = null;
  let typingDisplayTimeouts = {};
  let displayedMsgIds = new Set();
  let replyTo = null; // { id, display_name, text }
  let allUsers = [];
  let compactViewMap = JSON.parse(localStorage.getItem('compactViewMap') || '{}');
  let compactView = false;
  let sendByEnter = localStorage.getItem('sendByEnter') !== '0';

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
  const chatHeaderAvatar = $('#chatHeaderAvatar');
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
  const replyBar = $('#replyBar');
  const replyBarName = $('#replyBarName');
  const replyBarText = $('#replyBarText');
  const searchPanel = $('#searchPanel');
  const searchInput = $('#searchInput');
  const searchResults = $('#searchResults');
  const dragOverlay = $('#dragOverlay');
  const newChatModal = $('#newChatModal');
  const adminModal = $('#adminModal');
  const chatInfoModal = $('#chatInfoModal');
  const menuDrawer = $('#menuDrawer');
  const currentUserInfo = $('#currentUserInfo');
  const settingsModal = $('#settingsModal');
  const changePasswordModal = $('#changePasswordModal');

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

  function avatarHtml(name, color, avatarUrl, size) {
    const cls = size === 'large' ? 'avatar-large' : 'avatar';
    if (avatarUrl) {
      return `<div class="${cls}" style="background:${color}"><img class="avatar-img" src="${esc(avatarUrl)}" alt="" loading="lazy" onerror="this.remove()"></div>`;
    }
    return `<div class="${cls}" style="background:${color}">${initials(name)}</div>`;
  }

  function updateCurrentUserFooter() {
    currentUserInfo.innerHTML = avatarHtml(currentUser.display_name, currentUser.avatar_color, currentUser.avatar_url, 28) +
      `<span class="current-user-name">${esc(currentUser.display_name)}</span>`;
  }

  function chatItemAvatarHtml(chat) {
    if (chat.type === 'private' && chat.private_user) {
      const u = chat.private_user;
      if (u.avatar_url) {
        return `<div class="chat-item-avatar" style="background:${u.avatar_color}"><img class="avatar-img" src="${esc(u.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">`;
      }
      return `<div class="chat-item-avatar" style="background:${u.avatar_color}">${initials(chat.name)}`;
    }
    if (chat.avatar_url) {
      return `<div class="chat-item-avatar" style="background:#5eb5f7"><img class="avatar-img" src="${esc(chat.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">`;
    }
    const icon = chat.type === 'general' ? '🌐' : '👥';
    return `<div class="chat-item-avatar" style="background:#5eb5f7">${icon}`;
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

    ws.onclose = (e) => {
      if (e.code === 4003) {
        alert('Your account has been blocked by an administrator.');
        logout();
        return;
      }
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
        // Track unread for non-current chats
        if (msg.message.chat_id !== currentChatId && msg.message.user_id !== currentUser.id) {
          const chat = chats.find(c => c.id === msg.message.chat_id);
          if (chat) { chat.unread_count = (chat.unread_count || 0) + 1; renderChatList(chatSearch.value); }
        }
        // Only render if we're in the relevant chat
        if (msg.message.chat_id === currentChatId && !displayedMsgIds.has(msg.message.id)) {
          appendMessage(msg.message);
          scrollToBottom();
          // Mark as read
          api(`/api/chats/${currentChatId}/read`, { method: 'POST' }).catch(() => {});
        }
        // Browser notification
        if (document.hidden && msg.message.user_id !== currentUser.id && Notification.permission === 'granted') {
          const title = msg.message.display_name;
          const body = msg.message.text || '📎 File';
          new Notification(title, { body: body.substring(0, 100), icon: '/favicon.ico' });
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
        markMessageDeleted(msg.messageId);
        loadChats();
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
      case 'messages_read': {
        if (msg.chatId === currentChatId && msg.userId !== currentUser.id) {
          // Update all own messages up to lastReadId to show double checkmark
          messagesEl.querySelectorAll('.msg-row.own').forEach(row => {
            const msgId = +row.dataset.msgId;
            if (msgId <= msg.lastReadId) {
              const statusEl = row.querySelector('.msg-status');
              if (statusEl && !statusEl.classList.contains('read')) {
                statusEl.classList.add('read');
                statusEl.textContent = '✓✓';
              }
            }
          });
        }
        break;
      }
      case 'chat_updated': {
        const idx = chats.findIndex(c => c.id === msg.chat.id);
        if (idx >= 0) {
          chats[idx] = { ...chats[idx], name: msg.chat.name, avatar_url: msg.chat.avatar_url };
          renderChatList(chatSearch.value);
          if (currentChatId === msg.chat.id) {
            chatTitle.textContent = msg.chat.name;
          }
        }
        break;
      }
      case 'chat_removed': {
        chats = chats.filter(c => c.id !== msg.chatId);
        renderChatList(chatSearch.value);
        if (currentChatId === msg.chatId) {
          currentChatId = null;
          chatView.classList.add('hidden');
          emptyState.classList.remove('hidden');
        }
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

  async function loadAllUsers() {
    try { allUsers = await api('/api/users'); } catch {}
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

      let lastMsg = '';
      if (chat.last_text) {
        lastMsg = (chat.last_user ? chat.last_user + ': ' : '') + chat.last_text;
      } else if (chat.last_file_id) {
        lastMsg = (chat.last_user ? chat.last_user + ': ' : '') + '📎 File';
      }

      const lastTime = chat.last_time ? formatTime(chat.last_time) : '';

      const unread = chat.unread_count > 0 ? `<span class="unread-badge">${chat.unread_count > 99 ? '99+' : chat.unread_count}</span>` : '';

      el.innerHTML = `
        ${chatItemAvatarHtml(chat)}
          ${isOnline ? '<div class="online-dot"></div>' : ''}
        </div>
        <div class="chat-item-body">
          <div class="chat-item-top">
            <span class="chat-item-name">${esc(displayName)}</span>
            <span class="chat-item-time">${lastTime}</span>
          </div>
          <div class="chat-item-last">
            <span>${esc(lastMsg).substring(0, 60)}</span>
            ${unread}
          </div>
        </div>
      `;
      el.addEventListener('click', () => openChat(chat.id));
      chatList.appendChild(el);
    }

    // When searching, also show users without existing private chats
    if (filter) {
      const privatePeerIds = new Set(
        chats.filter(c => c.type === 'private' && c.private_user).map(c => c.private_user.id)
      );
      const matchingUsers = allUsers.filter(u =>
        !privatePeerIds.has(u.id) &&
        (u.display_name.toLowerCase().includes(filter.toLowerCase()) ||
         u.username.toLowerCase().includes(filter.toLowerCase()))
      );
      if (matchingUsers.length > 0) {
        const sep = document.createElement('div');
        sep.className = 'chat-list-separator';
        sep.textContent = 'Users';
        chatList.appendChild(sep);
      }
      for (const u of matchingUsers) {
        const el = document.createElement('div');
        el.className = 'chat-item';
        const isOnline = onlineUsers.has(u.id);
        el.innerHTML = `
          <div class="chat-item-avatar" style="background:${u.avatar_color || '#5eb5f7'}">
            ${u.avatar_url ? `<img class="avatar-img" src="${esc(u.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">` : initials(u.display_name)}
            ${isOnline ? '<div class="online-dot"></div>' : ''}
          </div>
          <div class="chat-item-body">
            <div class="chat-item-top">
              <span class="chat-item-name">${esc(u.display_name)}</span>
            </div>
            <div class="chat-item-last"><span>@${esc(u.username)}</span></div>
          </div>
        `;
        el.addEventListener('click', async () => {
          try {
            const chat = await api('/api/chats/private', { method: 'POST', body: { targetUserId: u.id } });
            await loadChats();
            openChat(chat.id);
            chatSearch.value = '';
          } catch (e) { alert(e.message); }
        });
        chatList.appendChild(el);
      }
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
    if (window.innerWidth <= 768) {
      sidebar.classList.add('sidebar-hidden');
      history.pushState({ chat: chatId }, '');
    }

    const chat = chats.find(c => c.id === chatId);
    chatTitle.textContent = chat ? chat.name : 'Chat';

    // Header avatar
    if (chat) {
      chatHeaderAvatar.style.display = '';
      if (chat.type === 'private' && chat.private_user) {
        const u = chat.private_user;
        if (u.avatar_url) {
          chatHeaderAvatar.style.background = u.avatar_color;
          chatHeaderAvatar.innerHTML = `<img class="avatar-img" src="${esc(u.avatar_url)}" alt="">`;
        } else {
          chatHeaderAvatar.style.background = u.avatar_color;
          chatHeaderAvatar.innerHTML = initials(chat.name);
        }
      } else {
        const bg = chat.avatar_url ? '#5eb5f7' : '#5eb5f7';
        chatHeaderAvatar.style.background = bg;
        if (chat.avatar_url) {
          chatHeaderAvatar.innerHTML = `<img class="avatar-img" src="${esc(chat.avatar_url)}" alt="">`;
        } else {
          chatHeaderAvatar.innerHTML = chat.type === 'general' ? '🌐' : '👥';
        }
      }
    } else {
      chatHeaderAvatar.style.display = 'none';
    }

    updateChatStatus();

    // Clear and load messages
    messagesEl.querySelectorAll('.msg-row, .msg-group, .date-separator').forEach(el => el.remove());
    compactView = !!compactViewMap[chatId];
    messagesEl.classList.toggle('compact-view', compactView);
    loadMoreWrap.classList.add('hidden');

    try {
      const msgs = await api(`/api/chats/${chatId}/messages?limit=${PAGE_SIZE}`);
      hasMore = msgs.length >= PAGE_SIZE;
      if (hasMore) loadMoreWrap.classList.remove('hidden');
      renderMessages(msgs);
      scrollToBottom(true);
    } catch {}

    // Mark chat as read
    try {
      await api(`/api/chats/${chatId}/read`, { method: 'POST' });
      const chat = chats.find(c => c.id === chatId);
      if (chat) { chat.unread_count = 0; renderChatList(chatSearch.value); }
    } catch {}

    clearReply();
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
    const existingFirst = messagesEl.querySelector('.msg-row, .msg-group');

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const msgDate = formatDate(msg.created_at);
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        const sep = document.createElement('div');
        sep.className = 'date-separator';
        sep.innerHTML = `<span>${msgDate}</span>`;
        if (existingFirst) messagesEl.insertBefore(sep, existingFirst);
        else messagesEl.appendChild(sep);
      }

      const prevMsg = i > 0 ? msgs[i - 1] : null;
      const sameUser = prevMsg && prevMsg.user_id === msg.user_id && formatDate(prevMsg.created_at) === msgDate;
      const isOwn = msg.user_id === currentUser.id;
      const useGroup = !isOwn || compactView;

      if (useGroup && !sameUser) {
        const group = document.createElement('div');
        group.className = 'msg-group';
        group.dataset.userId = msg.user_id;
        const avatarColor = isOwn ? (currentUser.avatar_color || '#65aadd') : (msg.avatar_color || '#65aadd');
        const avatarUrl = isOwn ? currentUser.avatar_url : msg.avatar_url;
        const name = isOwn ? currentUser.display_name : msg.display_name;
        group.innerHTML = `<div class="msg-group-avatar">${avatarHtml(name, avatarColor, avatarUrl, 32)}</div>`;
        const body = document.createElement('div');
        body.className = 'msg-group-body';
        group.appendChild(body);
        if (existingFirst) messagesEl.insertBefore(group, existingFirst);
        else messagesEl.appendChild(group);
      }

      const showName = useGroup && !sameUser;
      const el = createMessageEl(msg, showName);

      if (useGroup) {
        const groups = messagesEl.querySelectorAll('.msg-group');
        const lastGroup = groups[groups.length - 1];
        if (lastGroup) lastGroup.querySelector('.msg-group-body').appendChild(el);
      } else {
        if (existingFirst) messagesEl.insertBefore(el, existingFirst);
        else messagesEl.appendChild(el);
      }
      displayedMsgIds.add(msg.id);
    }
  }

  function appendMessage(msg) {
    const lastChild = messagesEl.lastElementChild;
    const msgDate = formatDate(msg.created_at);
    const isOwn = msg.user_id === currentUser.id;
    const useGroup = !isOwn || compactView;

    // Date separator check
    const lastRow = messagesEl.querySelector('.msg-row:last-child, .msg-group:last-child');
    const lastDateStr = lastRow?.dataset?.date || lastRow?.querySelector('.msg-row:last-child')?.dataset?.date;
    if (lastRow && lastDateStr && lastDateStr !== msgDate) {
      const sep = document.createElement('div');
      sep.className = 'date-separator';
      sep.innerHTML = `<span>${msgDate}</span>`;
      messagesEl.appendChild(sep);
    }

    // Check if we can append to existing group
    let sameGroup = false;
    if (useGroup && lastChild && lastChild.classList.contains('msg-group') && +lastChild.dataset.userId === msg.user_id) {
      sameGroup = true;
    }

    if (useGroup && !sameGroup) {
      const group = document.createElement('div');
      group.className = 'msg-group';
      group.dataset.userId = msg.user_id;
      const avatarColor = isOwn ? (currentUser.avatar_color || '#65aadd') : (msg.avatar_color || '#65aadd');
      const avatarUrl = isOwn ? currentUser.avatar_url : msg.avatar_url;
      const name = isOwn ? currentUser.display_name : msg.display_name;
      group.innerHTML = `<div class="msg-group-avatar">${avatarHtml(name, avatarColor, avatarUrl, 32)}</div>`;
      const body = document.createElement('div');
      body.className = 'msg-group-body';
      group.appendChild(body);
      messagesEl.appendChild(group);
    }

    const showName = useGroup && !sameGroup;
    const el = createMessageEl(msg, showName);

    if (useGroup) {
      const groups = messagesEl.querySelectorAll('.msg-group');
      groups[groups.length - 1].querySelector('.msg-group-body').appendChild(el);
    } else {
      messagesEl.appendChild(el);
    }
    displayedMsgIds.add(msg.id);
  }

  function createMessageEl(msg, showName = true) {
    const isOwn = msg.user_id === currentUser.id;
    const row = document.createElement('div');
    row.className = `msg-row ${isOwn ? 'own' : 'other'}`;
    row.dataset.msgId = msg.id;
    row.dataset.date = formatDate(msg.created_at);
    row.dataset.userId = msg.user_id;

    let html = '';

    html += '<div class="msg-content">';

    // Sender name (first in group)
    if (showName && (!isOwn || compactView)) {
      const nameColor = isOwn ? (currentUser.avatar_color || '#65aadd') : (msg.avatar_color || '#65aadd');
      const nameText = isOwn ? currentUser.display_name : msg.display_name;
      html += `<div class="msg-sender" style="color:${nameColor}">${esc(nameText)}</div>`;
    }

    html += '<div class="msg-bubble">';

    if (msg.is_deleted) {
      html += `<span class="msg-deleted">Message deleted</span>`;
    } else {
      // Reply reference
      if (msg.reply_to_id && msg.reply_display_name) {
        const replyText = msg.reply_text ? msg.reply_text.substring(0, 100) : '📎 Attachment';
        html += `<div class="msg-reply" data-reply-id="${msg.reply_to_id}">
          <div class="msg-reply-name">${esc(msg.reply_display_name)}</div>
          <div class="msg-reply-text">${esc(replyText)}</div>
        </div>`;
      }

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

      // Delete button (inside bubble)
      if (isOwn || currentUser.is_admin) {
        html += `<button class="msg-delete-btn" data-id="${msg.id}" title="Delete">🗑</button>`;
      }
    }

    const statusIcon = isOwn && !msg.is_deleted ? `<span class="msg-status${msg.is_read ? ' read' : ''}">${msg.is_read ? '✓✓' : '✓'}</span>` : '';
    html += `<span class="msg-time">${statusIcon}${formatTime(msg.created_at)}</span>`;
    html += '</div>'; // msg-bubble
    html += '</div>'; // msg-content

    // Reply button outside bubble
    if (!msg.is_deleted) {
      html += '<button class="msg-reply-btn" title="Reply">↩</button>';
    }

    row.innerHTML = html;

    // Event listeners
    const deleteBtn = row.querySelector('.msg-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteMessage(msg.id); });
    }

    const replyBtn = row.querySelector('.msg-reply-btn');
    if (replyBtn) {
      replyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setReply(msg.id, msg.display_name, (msg.text || '📎').substring(0, 100));
      });
    }

    // Click reply quote to scroll to original message
    const replyQuote = row.querySelector('.msg-reply');
    if (replyQuote) {
      replyQuote.style.cursor = 'pointer';
      replyQuote.addEventListener('click', () => scrollToMessage(+replyQuote.dataset.replyId));
    }

    const img = row.querySelector('.msg-image');
    if (img) {
      img.addEventListener('click', () => openImageViewer(img.src));
    }

    // Audio/video duration
    const audio = row.querySelector('audio');
    if (audio) {
      audio.addEventListener('loadedmetadata', () => {
        const dur = formatDuration(audio.duration);
        const durEl = document.createElement('span');
        durEl.className = 'media-duration';
        durEl.textContent = dur;
        audio.parentElement.querySelector('div:last-child')?.prepend(durEl);
      });
    }
    const video = row.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => {
        const dur = formatDuration(video.duration);
        const durEl = document.createElement('span');
        durEl.className = 'media-duration';
        durEl.textContent = dur;
        video.parentElement.querySelector('div:last-child')?.prepend(durEl);
      });
    }

    return row;
  }

  function formatDuration(seconds) {
    if (!seconds || !isFinite(seconds)) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + String(s).padStart(2, '0');
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
    const filesToSend = [...pendingFiles];
    const firstFileId = filesToSend.length > 0 ? filesToSend[0].id : null;

    if (!text && !firstFileId) return;
    if (text.length > MAX_MSG) { alert('Message too long'); return; }

    msgInput.value = '';
    autoResize();
    clearPendingFile();
    const replyToId = replyTo ? replyTo.id : null;
    clearReply();

    try {
      // First message: text + first file (or just text)
      await api(`/api/chats/${currentChatId}/messages`, {
        method: 'POST',
        body: { text: text || null, fileId: firstFileId, replyToId }
      });
      // Remaining files: one message per file
      for (let i = 1; i < filesToSend.length; i++) {
        await api(`/api/chats/${currentChatId}/messages`, {
          method: 'POST',
          body: { text: null, fileId: filesToSend[i].id, replyToId: null }
        });
      }
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
    try {
      await api(`/api/messages/${id}`, { method: 'DELETE' });
      // Immediately update UI in case WS is slow
      markMessageDeleted(id);
      loadChats();
    } catch {}
  }

  function markMessageDeleted(msgId) {
    const el = messagesEl.querySelector(`[data-msg-id="${msgId}"]`);
    if (!el) return;
    const bubble = el.querySelector('.msg-bubble');
    if (!bubble) return;
    const timeText = bubble.querySelector('.msg-time')?.textContent || '';
    bubble.innerHTML = `<span class="msg-deleted">Message deleted</span><span class="msg-time">${esc(timeText)}</span>`;
    const replyBtn = el.querySelector('.msg-reply-btn');
    if (replyBtn) replyBtn.remove();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════
  async function uploadFiles(fileList) {
    const files = Array.from(fileList).slice(0, 10);
    if (files.length === 0) return;
    for (const f of files) {
      if (f.size > 25 * 1024 * 1024) { alert(`File too large: ${f.name} (max 25 MB)`); return; }
    }

    pendingFileEl.classList.remove('hidden');
    pendingFileEl.innerHTML = `<span>📎</span><span class="pending-file-name">Uploading 0/${files.length}...</span>`;

    const uploaded = [];
    try {
      for (let i = 0; i < files.length; i++) {
        pendingFileEl.querySelector('.pending-file-name').textContent = `Uploading ${i + 1}/${files.length}...`;
        const fd = new FormData();
        fd.append('file', files[i]);
        const data = await api('/api/upload', { method: 'POST', body: fd });
        uploaded.push(data);
      }
      pendingFiles = uploaded;
      pendingFile = uploaded[0];
      renderPendingFiles();
      msgInput.focus();
    } catch (e) {
      alert(e.message);
      clearPendingFile();
    }
  }

  function renderPendingFiles() {
    if (pendingFiles.length === 0) { clearPendingFile(); return; }
    pendingFileEl.classList.remove('hidden');
    const icon = (t) => t === 'image' ? '🖼' : t === 'audio' ? '🎵' : t === 'video' ? '🎬' : '📄';
    if (pendingFiles.length === 1) {
      const d = pendingFiles[0];
      pendingFileEl.innerHTML = `
        <span>${icon(d.type)}</span>
        <span class="pending-file-name">${esc(d.original_name)} (${formatSize(d.size)})</span>
        <button class="pending-file-remove" title="Remove">✕</button>
      `;
    } else {
      pendingFileEl.innerHTML = `
        <span>📎</span>
        <span class="pending-file-name">${pendingFiles.length} files (${formatSize(pendingFiles.reduce((s, f) => s + f.size, 0))})</span>
        <button class="pending-file-remove" title="Remove all">✕</button>
      `;
    }
    pendingFileEl.querySelector('.pending-file-remove').addEventListener('click', clearPendingFile);
  }

  function clearPendingFile() {
    pendingFile = null;
    pendingFiles = [];
    pendingFileEl.classList.add('hidden');
    pendingFileEl.innerHTML = '';
    fileInput.value = '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPLY
  // ═══════════════════════════════════════════════════════════════════════════
  function setReply(id, name, text) {
    replyTo = { id, display_name: name, text };
    replyBarName.textContent = name;
    replyBarText.textContent = text || '📎 Attachment';
    replyBar.classList.remove('hidden');
    msgInput.focus();
  }

  function clearReply() {
    replyTo = null;
    replyBar.classList.add('hidden');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════════════════
  let searchDebounce = null;

  function openSearchPanel() {
    searchPanel.classList.remove('hidden');
    searchInput.value = '';
    searchResults.innerHTML = '';
    searchInput.focus();
  }

  function closeSearchPanel() {
    searchPanel.classList.add('hidden');
    searchInput.value = '';
    searchResults.innerHTML = '';
  }

  function performSearch() {
    const q = searchInput.value.trim();
    if (q.length < 2) { searchResults.innerHTML = ''; return; }
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q });
        if (currentChatId) params.set('chatId', currentChatId);
        const results = await api(`/api/messages/search?${params}`);
        searchResults.innerHTML = '';
        if (results.length === 0) {
          searchResults.innerHTML = '<div style="padding:12px;color:var(--text-secondary)">No results</div>';
          return;
        }
        for (const r of results) {
          const el = document.createElement('div');
          el.className = 'search-result-item';
          const highlighted = esc(r.text || '').replace(
            new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
            '<mark>$1</mark>'
          );
          el.innerHTML = `
            <div style="font-weight:600;font-size:13px;color:var(--accent)">${esc(r.display_name)}</div>
            <div class="search-result-text">${highlighted}</div>
            <div style="font-size:11px;color:var(--text-secondary)">${formatTime(r.created_at)}</div>
          `;
          el.addEventListener('click', () => {
            closeSearchPanel();
            if (r.chat_id !== currentChatId) {
              openChat(r.chat_id).then(() => scrollToMessage(r.id));
            } else {
              scrollToMessage(r.id);
            }
          });
          searchResults.appendChild(el);
        }
      } catch {}
    }, 300);
  }

  function scrollToMessage(msgId) {
    const el = messagesEl.querySelector(`[data-msg-id="${msgId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'background 0.3s';
      el.style.background = 'rgba(94,181,247,0.15)';
      setTimeout(() => { el.style.background = ''; }, 1500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SIDEBAR RESIZE
  // ═══════════════════════════════════════════════════════════════════════════
  (() => {
    const handle = $('#resizeHandle');
    if (!handle) return;
    let dragging = false;
    let startX, startW;

    const saved = localStorage.getItem('sidebarWidth');
    if (saved) sidebar.style.width = saved + 'px';

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startW = sidebar.offsetWidth;
      handle.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const newW = Math.max(200, Math.min(600, startW + e.clientX - startX));
      sidebar.style.width = newW + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('sidebarWidth', sidebar.offsetWidth);
    });

    // Touch support
    handle.addEventListener('touchstart', (e) => {
      dragging = true;
      startX = e.touches[0].clientX;
      startW = sidebar.offsetWidth;
      handle.classList.add('active');
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const newW = Math.max(200, Math.min(600, startW + e.touches[0].clientX - startX));
      sidebar.style.width = newW + 'px';
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('active');
      localStorage.setItem('sidebarWidth', sidebar.offsetWidth);
    });
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAG & DROP
  // ═══════════════════════════════════════════════════════════════════════════
  let dragCounter = 0;

  function handleDragEnter(e) {
    e.preventDefault();
    dragCounter++;
    if (currentChatId) dragOverlay.classList.remove('hidden');
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) { dragOverlay.classList.add('hidden'); dragCounter = 0; }
  }

  function handleDrop(e) {
    e.preventDefault();
    dragCounter = 0;
    dragOverlay.classList.add('hidden');
    if (!currentChatId) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) uploadFiles(files);
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
  let galleryImages = [];
  let galleryIndex = 0;

  function collectGalleryImages() {
    galleryImages = Array.from(messagesEl.querySelectorAll('.msg-image')).map(img => img.src);
  }

  function openImageViewer(src) {
    collectGalleryImages();
    galleryIndex = galleryImages.indexOf(src);
    if (galleryIndex < 0) galleryIndex = 0;
    ivImage.src = src;
    updateGalleryArrows();
    imageViewer.classList.remove('hidden');
  }

  function updateGalleryArrows() {
    const prev = imageViewer.querySelector('.iv-prev');
    const next = imageViewer.querySelector('.iv-next');
    prev.style.display = galleryImages.length > 1 && galleryIndex > 0 ? '' : 'none';
    next.style.display = galleryImages.length > 1 && galleryIndex < galleryImages.length - 1 ? '' : 'none';
  }

  function galleryNav(dir) {
    const newIdx = galleryIndex + dir;
    if (newIdx < 0 || newIdx >= galleryImages.length) return;
    galleryIndex = newIdx;
    ivImage.src = galleryImages[galleryIndex];
    updateGalleryArrows();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════════════════════
  function closeAllModals() {
    [newChatModal, adminModal, chatInfoModal, menuDrawer, emojiPicker, settingsModal, changePasswordModal].forEach(m => m.classList.add('hidden'));
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
          ${avatarHtml(u.display_name, u.avatar_color, u.avatar_url)}
          <div>
            <div class="name">${esc(u.display_name)}</div>
            <div class="status-text">${u.online ? 'online' : 'offline'}</div>
          </div>
        </div>
      `).join('') || '<div style="color:var(--text-secondary);padding:12px">No other users yet</div>';

      groupList.innerHTML = users.map(u => `
        <div class="user-list-item" data-uid="${u.id}">
          ${avatarHtml(u.display_name, u.avatar_color, u.avatar_url)}
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
          ${avatarHtml(u.display_name, u.avatar_color, u.avatar_url)}
          <div class="info">
            <div class="name">${esc(u.display_name)} <span style="color:var(--text-secondary)">@${esc(u.username)}</span></div>
            <div class="meta">Joined: ${new Date(u.created_at + 'Z').toLocaleDateString()}</div>
          </div>
          ${u.is_admin ? '<span class="badge badge-admin">Admin</span>' : ''}
          ${u.is_blocked ? '<span class="badge badge-blocked">Blocked</span>' : ''}
          ${!u.is_admin ? `<div class="admin-user-actions">
            <button class="reset-btn" data-uid="${u.id}" title="Reset password to 123456">🔑 Reset</button>
            <button class="block-btn ${u.is_blocked ? 'is-blocked' : ''}" data-uid="${u.id}">${u.is_blocked ? 'Unblock' : 'Block'}</button>
          </div>` : ''}
        </div>
      `).join('');

      list.querySelectorAll('.block-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await api(`/api/admin/users/${btn.dataset.uid}/block`, { method: 'POST' });
            openAdminModal();
          } catch {}
        });
      });
      list.querySelectorAll('.reset-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Reset password to 123456?')) return;
          try {
            await api(`/api/admin/users/${btn.dataset.uid}/reset-password`, { method: 'POST' });
            alert('Password has been reset to 123456');
          } catch (e) { alert(e.message); }
        });
      });
    } catch {}
  }

  // Settings modal
  function openSettingsModal() {
    closeAllModals();
    settingsModal.classList.remove('hidden');
    const adminItem = $('#settingsAdminPanel');
    if (currentUser.is_admin) adminItem.classList.remove('hidden');
    else adminItem.classList.add('hidden');
    $('#settingsSendEnter').checked = sendByEnter;
  }

  function openChangePasswordModal() {
    closeAllModals();
    changePasswordModal.classList.remove('hidden');
    $('#cpOldPass').value = '';
    $('#cpNewPass').value = '';
    $('#cpNewPassConfirm').value = '';
    $('#cpError').textContent = '';
    $('#cpSuccess').textContent = '';
  }

  // Chat info modal
  async function openChatInfoModal() {
    if (!currentChatId) return;
    closeAllModals();
    chatInfoModal.classList.remove('hidden');

    const chat = chats.find(c => c.id === currentChatId);
    $('#chatInfoTitle').textContent = chat ? chat.name : 'Chat Info';

    // Sync compact view toggle
    $('#compactViewToggle').checked = compactView;

    // Group edit section
    const editSection = $('#chatEditSection');
    if (chat && (chat.type === 'group' || chat.type === 'general')) {
      editSection.classList.remove('hidden');
      const chatAvatarEl = $('#chatAvatar');
      const removeChatAvatarBtn = $('#removeChatAvatar');

      if (chat.avatar_url) {
        chatAvatarEl.style.background = '#5eb5f7';
        chatAvatarEl.innerHTML = `<img class="avatar-img" src="${esc(chat.avatar_url)}" alt="">`;
        removeChatAvatarBtn.classList.remove('hidden');
      } else {
        chatAvatarEl.style.background = '#5eb5f7';
        chatAvatarEl.innerHTML = chat.type === 'general' ? '🌐' : '👥';
        removeChatAvatarBtn.classList.add('hidden');
      }

      $('#chatNameInput').value = chat.name;

      // Save name
      $('#saveChatNameBtn').onclick = async () => {
        const name = $('#chatNameInput').value.trim();
        if (!name) return;
        try {
          await api(`/api/chats/${currentChatId}`, { method: 'PUT', body: { name } });
          await loadChats();
          closeAllModals();
          chatTitle.textContent = name;
        } catch (e) { alert(e.message); }
      };

      // Upload chat avatar
      $('#chatAvatarInput').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('avatar', file);
        try {
          await api(`/api/chats/${currentChatId}/avatar`, { method: 'POST', body: fd });
          await loadChats();
          openChatInfoModal();
        } catch (e) { alert(e.message); }
      };

      // Remove chat avatar
      removeChatAvatarBtn.onclick = async () => {
        try {
          await api(`/api/chats/${currentChatId}/avatar`, { method: 'DELETE' });
          await loadChats();
          openChatInfoModal();
        } catch (e) { alert(e.message); }
      };
    } else {
      editSection.classList.add('hidden');
    }

    try {
      const members = await api(`/api/chats/${currentChatId}/members`);
      const memberList = $('#chatMemberList');
      const canRemove = chat && chat.type === 'group' && (chat.created_by === currentUser.id || currentUser.is_admin);

      memberList.innerHTML = members.map(u => `
        <div class="user-list-item" data-uid="${u.id}">
          ${avatarHtml(u.display_name, u.avatar_color, u.avatar_url)}
          <div>
            <div class="name">${esc(u.display_name)}</div>
            <div class="status-text">${onlineUsers.has(u.id) ? 'online' : 'offline'}</div>
          </div>
          ${canRemove && u.id !== currentUser.id ? `<button class="member-remove" data-uid="${u.id}" title="Remove">✕</button>` : ''}
        </div>
      `).join('');

      // Remove member handlers
      memberList.querySelectorAll('.member-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Remove this member?')) return;
          try {
            await api(`/api/chats/${currentChatId}/members/${btn.dataset.uid}`, { method: 'DELETE' });
            openChatInfoModal();
          } catch (e) { alert(e.message); }
        });
      });

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
            ${avatarHtml(u.display_name, u.avatar_color, u.avatar_url)}
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

  // Profile editor (menu drawer)
  const AVATAR_COLORS = ['#e17076','#7bc862','#e5ca77','#65aadd','#a695e7','#ee7aae','#6ec9cb','#faa774'];

  function openMenuDrawer() {
    closeAllModals();
    menuDrawer.classList.remove('hidden');

    // Avatar
    const avatarEl = $('#profileAvatar');
    avatarEl.style.background = currentUser.avatar_color;
    if (currentUser.avatar_url) {
      avatarEl.innerHTML = `<img class="avatar-img" src="${esc(currentUser.avatar_url)}" alt="">`;
      $('#removeProfileAvatar').classList.remove('hidden');
    } else {
      avatarEl.innerHTML = initials(currentUser.display_name);
      $('#removeProfileAvatar').classList.add('hidden');
    }

    // Fields
    $('#profileUsername').textContent = '@' + currentUser.username;
    $('#profileName').value = currentUser.display_name;

    // Color picker
    const picker = $('#colorPicker');
    picker.innerHTML = AVATAR_COLORS.map(c =>
      `<div class="color-swatch${c === currentUser.avatar_color ? ' active' : ''}" data-color="${c}" style="background:${c}"></div>`
    ).join('');
  }

  function setupProfileEvents() {
    // Upload avatar
    $('#profileAvatarInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('avatar', file);
      try {
        const res = await api('/api/profile/avatar', { method: 'POST', body: fd });
        currentUser.avatar_url = res.user.avatar_url;
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateCurrentUserFooter();
        openMenuDrawer();
      } catch (e) { alert(e.message); }
    });

    // Remove avatar
    $('#removeProfileAvatar').addEventListener('click', async () => {
      try {
        await api('/api/profile/avatar', { method: 'DELETE' });
        currentUser.avatar_url = null;
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateCurrentUserFooter();
        openMenuDrawer();
      } catch (e) { alert(e.message); }
    });

    // Color picker
    $('#colorPicker').addEventListener('click', (e) => {
      const swatch = e.target.closest('.color-swatch');
      if (!swatch) return;
      $('#colorPicker').querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
    });

    // Save
    $('#saveProfileBtn').addEventListener('click', async () => {
      const name = $('#profileName').value.trim();
      if (!name) return;
      const activeSwatch = $('#colorPicker .color-swatch.active');
      const color = activeSwatch ? activeSwatch.dataset.color : currentUser.avatar_color;
      try {
        const res = await api('/api/profile', { method: 'PUT', body: { displayName: name, avatarColor: color } });
        currentUser.display_name = res.user.display_name;
        currentUser.avatar_color = res.user.avatar_color;
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateCurrentUserFooter();
        await loadChats();
        closeAllModals();
      } catch (e) { alert(e.message); }
    });
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
      if (e.key === 'Enter') {
        if (sendByEnter && !e.shiftKey && !e.ctrlKey) { e.preventDefault(); sendMessage(); }
        else if (!sendByEnter && e.ctrlKey) { e.preventDefault(); sendMessage(); }
      }
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
      if (fileInput.files.length > 0) uploadFiles(fileInput.files);
    });

    // Emoji
    emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      emojiPicker.classList.toggle('hidden');
    });

    // Image viewer close
    imageViewer.addEventListener('click', (e) => {
      if (e.target.closest('.iv-prev')) { galleryNav(-1); return; }
      if (e.target.closest('.iv-next')) { galleryNav(1); return; }
      if (e.target === imageViewer || e.target.closest('.iv-close')) imageViewer.classList.add('hidden');
    });
    document.addEventListener('keydown', (e) => {
      if (imageViewer.classList.contains('hidden')) return;
      if (e.key === 'ArrowLeft') galleryNav(-1);
      else if (e.key === 'ArrowRight') galleryNav(1);
      else if (e.key === 'Escape') imageViewer.classList.add('hidden');
    });

    // Sidebar search
    chatSearch.addEventListener('input', () => {
      renderChatList(chatSearch.value);
      $('#chatSearchClear').classList.toggle('hidden', !chatSearch.value);
    });
    $('#chatSearchClear').addEventListener('click', () => {
      chatSearch.value = '';
      renderChatList();
      $('#chatSearchClear').classList.add('hidden');
      chatSearch.focus();
    });

    // Back button (mobile)
    $('#backBtn').addEventListener('click', () => {
      sidebar.classList.remove('sidebar-hidden');
      if (history.state && history.state.chat) history.back();
    });

    // Android back gesture / button
    window.addEventListener('popstate', (e) => {
      if (window.innerWidth <= 768) {
        if (sidebar.classList.contains('sidebar-hidden')) {
          // Going back from chat to chat list
          sidebar.classList.remove('sidebar-hidden');
        } else {
          // Already on chat list — push state back to prevent exit
          history.pushState({ view: 'chatlist' }, '');
        }
      }
    });

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

    // Settings button
    $('#settingsBtn').addEventListener('click', openSettingsModal);

    // Settings sub-buttons
    $('#settingsChangePassword').addEventListener('click', openChangePasswordModal);
    $('#settingsAdminPanel').addEventListener('click', openAdminModal);

    // Send by Enter toggle
    $('#settingsSendEnter').addEventListener('change', (e) => {
      sendByEnter = e.target.checked;
      localStorage.setItem('sendByEnter', sendByEnter ? '1' : '0');
    });

    // Change password save
    $('#cpSaveBtn').addEventListener('click', async () => {
      const cpErr = $('#cpError');
      const cpOk = $('#cpSuccess');
      cpErr.textContent = '';
      cpOk.textContent = '';
      const oldPass = $('#cpOldPass').value;
      const newPass = $('#cpNewPass').value;
      const confirmPass = $('#cpNewPassConfirm').value;
      if (!oldPass || !newPass) { cpErr.textContent = 'Fill in all fields'; return; }
      if (newPass !== confirmPass) { cpErr.textContent = 'New passwords do not match'; return; }
      if (newPass.length < 6) { cpErr.textContent = 'Password must be at least 6 characters'; return; }
      try {
        await api('/api/profile/change-password', { method: 'POST', body: { oldPassword: oldPass, newPassword: newPass } });
        cpOk.textContent = 'Password changed successfully!';
        $('#cpOldPass').value = '';
        $('#cpNewPass').value = '';
        $('#cpNewPassConfirm').value = '';
      } catch (e) { cpErr.textContent = e.message; }
    });

    // Menu button
    $('#menuBtn').addEventListener('click', openMenuDrawer);

    // Chat info button
    $('#chatInfoBtn').addEventListener('click', openChatInfoModal);

    // Compact view toggle (per-chat)
    $('#compactViewToggle').addEventListener('change', (e) => {
      compactView = e.target.checked;
      if (currentChatId) {
        if (compactView) compactViewMap[currentChatId] = true;
        else delete compactViewMap[currentChatId];
        localStorage.setItem('compactViewMap', JSON.stringify(compactViewMap));
      }
      messagesEl.classList.toggle('compact-view', compactView);
      // Re-render
      if (currentChatId) openChat(currentChatId);
    });

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

    // Reply bar close
    $('#replyBarClose').addEventListener('click', clearReply);

    // Search
    $('#searchBtn').addEventListener('click', openSearchPanel);
    $('#searchClose').addEventListener('click', closeSearchPanel);
    searchInput.addEventListener('input', performSearch);

    // Drag & drop
    chatView.addEventListener('dragenter', handleDragEnter);
    chatView.addEventListener('dragover', handleDragOver);
    chatView.addEventListener('dragleave', handleDragLeave);
    chatView.addEventListener('drop', handleDrop);

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSearchPanel();
        clearReply();
        closeAllModals();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════
  async function init() {
    if (!checkAuth()) return;

    // Mobile keyboard resize fix
    if (window.visualViewport) {
      const app = document.getElementById('app');
      const onVVResize = () => {
        app.style.height = window.visualViewport.height + 'px';
        window.scrollTo(0, 0);
      };
      window.visualViewport.addEventListener('resize', onVVResize);
      window.visualViewport.addEventListener('scroll', () => window.scrollTo(0, 0));
    }

    // Mobile navigation: set initial history state for chat list
    if (window.innerWidth <= 768) {
      history.replaceState({ view: 'chatlist' }, '');
    }

    // Verify token
    try {
      const data = await api('/api/auth/me');
      currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(currentUser));
    } catch { return; }

    // Update UI
    updateCurrentUserFooter();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    setupEvents();
    setupProfileEvents();
    initEmojiPicker();
    connectWS();
    await loadAllUsers();
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
