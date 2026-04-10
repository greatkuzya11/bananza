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
  let scrollRestoreMode = localStorage.getItem('scrollRestoreMode') || 'bottom'; // 'bottom' | 'restore'
  let scrollPositions = {}; // chatId -> scrollTop

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
  const scrollBottomBtn = $('#scrollBottomBtn');
  const attachBtn = $('#attachBtn');
  const emojiBtn = $('#emojiBtn');
  const fileInput = $('#fileInput');
  const pendingFileEl = $('#pendingFile');
  const emojiPicker = $('#emojiPicker');
  const imageViewer = $('#imageViewer');
  const ivStrip = $('#ivStrip');
  const reactionPicker = $('#reactionPicker');
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

  const appBridge = window.BananzaAppBridge = window.BananzaAppBridge || {};
  Object.assign(appBridge, {
    api: (url, opts) => api(url, opts),
    animateSendButton: () => animateSendButton(),
    autoResize: () => autoResize(),
    clearReply: () => clearReply(),
    closeAllModals: () => closeAllModals(),
    getToken: () => token || localStorage.getItem('token'),
    getCurrentUser: () => currentUser,
    getCurrentChatId: () => currentChatId,
    getPendingFiles: () => [...pendingFiles],
    getReplyTo: () => replyTo ? { ...replyTo } : null,
    scrollToBottom: (instant = false) => scrollToBottom(instant),
    getDom: () => ({
      sendBtn,
      msgInput,
      messagesEl,
      pendingFileEl,
      settingsModal,
      chatView,
    }),
    isMobileLayout: () => window.innerWidth <= 768,
  });

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
          const wasNearBottom = isNearBottom();
          const isOwnMessage = msg.message.user_id === currentUser.id;
          appendMessage(msg.message);
          if (wasNearBottom || isOwnMessage) scrollToBottom();
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
      case 'reaction': {
        updateReactionBar(msg.messageId, msg.reactions);
        break;
      }
      case 'message_transcription':
      case 'voice_settings_updated': {
        window.BananzaVoiceHooks?.handleWSMessage?.(msg);
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
    refreshAdminUserStatuses();
  }

  function updateScrollBottomButton() {
    if (!scrollBottomBtn) return;
    const hasMessages = Boolean(messagesEl.querySelector('.msg-row'));
    const shouldShow = Boolean(currentChatId && hasMessages && !isNearBottom(120));
    scrollBottomBtn.classList.toggle('visible', shouldShow);
  }

  function renderAdminUserRow(u) {
    const isOnline = onlineUsers.has(u.id);
    return `
      <div class="admin-user-row" data-uid="${u.id}">
        ${avatarHtml(u.display_name, u.avatar_color, u.avatar_url)}
        <div class="info">
          <div class="name">${esc(u.display_name)} <span style="color:var(--text-secondary)">@${esc(u.username)}</span></div>
          <div class="meta">
            <div class="admin-user-status ${isOnline ? 'online' : 'offline'}">
              <span class="status-dot"></span>${isOnline ? 'online' : 'offline'}
            </div>
            <div class="admin-user-joined">Joined: ${new Date(u.created_at + 'Z').toLocaleDateString()}</div>
          </div>
        </div>
        ${u.is_admin ? '<span class="badge badge-admin">Admin</span>' : ''}
        ${u.is_blocked ? '<span class="badge badge-blocked">Blocked</span>' : ''}
        ${!u.is_admin ? `<div class="admin-user-actions">
          <button class="reset-btn" data-uid="${u.id}" title="Reset password to 123456">🔑 Reset</button>
          <button class="block-btn ${u.is_blocked ? 'is-blocked' : ''}" data-uid="${u.id}">${u.is_blocked ? 'Unblock' : 'Block'}</button>
        </div>` : ''}
      </div>
    `;
  }

  function refreshAdminUserStatuses() {
    if (adminModal.classList.contains('hidden')) return;
    const list = $('#adminUserList');
    if (!list) return;
    list.querySelectorAll('.admin-user-row').forEach(row => {
      const uid = +row.dataset.uid;
      const statusEl = row.querySelector('.admin-user-status');
      if (!statusEl) return;
      const isOnline = onlineUsers.has(uid);
      statusEl.classList.toggle('online', isOnline);
      statusEl.classList.toggle('offline', !isOnline);
      statusEl.innerHTML = `<span class="status-dot"></span>${isOnline ? 'online' : 'offline'}`;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPEN CHAT
  // ═══════════════════════════════════════════════════════════════════════════
  async function openChat(chatId) {
    // Save scroll position of previous chat
    if (currentChatId && currentChatId !== chatId) {
      scrollPositions[currentChatId] = messagesEl.scrollTop;
    }

    currentChatId = chatId;
    displayedMsgIds.clear();
    hasMore = false; // prevent scroll handler triggering loadMore during DOM clear

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
      // Re-clear after async gap: WS may have appended messages while we waited
      if (currentChatId !== chatId) return; // user switched chats
      messagesEl.querySelectorAll('.msg-row, .msg-group, .date-separator').forEach(el => el.remove());
      displayedMsgIds.clear();
      hasMore = msgs.length >= PAGE_SIZE;
      if (hasMore) loadMoreWrap.classList.remove('hidden');
      renderMessages(msgs);
      if (scrollRestoreMode === 'restore' && scrollPositions[chatId] != null) {
        requestAnimationFrame(() => { messagesEl.scrollTop = scrollPositions[chatId]; });
      } else {
        scrollToBottom(true);
      }
      requestAnimationFrame(updateScrollBottomButton);
    } catch {}

    // Mark chat as read
    try {
      await api(`/api/chats/${chatId}/read`, { method: 'POST' });
      const chat = chats.find(c => c.id === chatId);
      if (chat) { chat.unread_count = 0; renderChatList(chatSearch.value); }
    } catch {}

    clearReply();
    if (window.innerWidth > 768) msgInput.focus();
    window.BananzaVoiceHooks?.refreshComposerState?.();
    updateScrollBottomButton();
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
    updateScrollBottomButton();
  }

  function appendMessage(msg) {
    const lastChild = messagesEl.lastElementChild;
    const msgDate = formatDate(msg.created_at);
    const isOwn = msg.user_id === currentUser.id;
    const useGroup = !isOwn || compactView;

    // Date separator: compare against last separator in DOM
    const seps = messagesEl.querySelectorAll('.date-separator');
    const lastSepDate = seps.length ? seps[seps.length - 1].textContent.trim() : null;
    if (lastSepDate !== msgDate) {
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
    updateScrollBottomButton();
  }

  function createMessageEl(msg, showName = true) {
    const isOwn = msg.user_id === currentUser.id;
    const row = document.createElement('div');
    row.className = `msg-row ${isOwn ? 'own' : 'other'}`;
    row.dataset.msgId = msg.id;
    row.dataset.date = formatDate(msg.created_at);
    row.dataset.userId = msg.user_id;
    row.__replyPayload = {
      id: msg.id,
      display_name: isOwn ? currentUser.display_name : msg.display_name,
      text: getReplyPreviewText(msg),
    };
    row.__voiceBootstrap = {
      id: msg.id,
      is_voice_note: !!msg.is_voice_note,
      voice_duration_ms: msg.voice_duration_ms || null,
      transcription_status: msg.transcription_status || 'idle',
      transcription_text: msg.transcription_text || '',
      transcription_provider: msg.transcription_provider || '',
      transcription_model: msg.transcription_model || '',
      transcription_error: msg.transcription_error || '',
    };

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
        const replyText = getReplyQuoteText(msg);
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
    const reactionsHtml = (!msg.is_deleted && msg.reactions && msg.reactions.length > 0)
      ? `<div class="msg-reactions">${renderReactions(msg.reactions)}</div>` : '<div></div>';
    html += `<div class="msg-footer">${reactionsHtml}<span class="msg-time">${statusIcon}${formatTime(msg.created_at)}</span></div>`;
    html += '</div>'; // msg-bubble
    html += '</div>'; // msg-content

    // Reply + react buttons outside bubble
    if (!msg.is_deleted) {
      html += '<button class="msg-reply-btn" title="Reply">↩</button>';
      html += '<button class="msg-react-btn" title="React">🙂</button>';
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
        setReplyFromRow(row);
      });
    }

    // (react button handled via delegation on messagesEl)

    // Click reply quote to scroll to original message
    const replyQuote = row.querySelector('.msg-reply');
    if (replyQuote) {
      replyQuote.style.cursor = 'pointer';
      replyQuote.addEventListener('click', () => scrollToMessage(+replyQuote.dataset.replyId));
    }

    const img = row.querySelector('.msg-image');
    if (img) {
      img.addEventListener('click', () => openImageViewer(img.src));
      const wasNearBottom = isNearBottom();
      img.addEventListener('load', () => { if (wasNearBottom) scrollToBottom(); });
    }

    const expandBtn = row.querySelector('.msg-expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const video = row.querySelector('.msg-video video');
        const src = video?.querySelector('source')?.getAttribute('src') || '';
        if (src) openMediaViewer(src, 'video');
      });
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

    window.BananzaVoiceHooks?.decorateMessageRow?.(row, msg);

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
        return `<img class="msg-image" src="${url}" alt="${esc(msg.file_name)}">`;
      case 'audio':
        return `<div class="msg-audio">
          <div style="font-size:13px;margin-bottom:4px">🎵 ${esc(msg.file_name)}</div>
          <audio controls preload="none"><source src="${url}" type="${msg.file_mime}"></audio>
          <div style="font-size:11px;color:var(--text-secondary)">${formatSize(msg.file_size)} · <a href="${url}" download="${esc(msg.file_name)}">Download</a></div>
        </div>`;
      case 'video':
        return `<div class="msg-video">
          <div class="msg-video-wrap">
            <video controls preload="metadata" playsinline><source src="${url}" type="${msg.file_mime}"></video>
            <button class="msg-expand-btn" type="button" title="Fullscreen">&#x26F6;</button>
          </div>
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

    try {
      const url = `/api/chats/${currentChatId}/messages?limit=${PAGE_SIZE}${firstId ? '&before=' + firstId : ''}`;
      const msgs = await api(url);
      hasMore = msgs.length >= PAGE_SIZE;
      if (!hasMore) loadMoreWrap.classList.add('hidden');

      // Capture scroll state RIGHT before DOM mutation (not before async fetch)
      const scrollTopBefore = messagesEl.scrollTop;
      const scrollHeightBefore = messagesEl.scrollHeight;

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

      // Remove duplicate date separators (keep first occurrence of each date)
      const seenDates = new Set();
      messagesEl.querySelectorAll('.date-separator').forEach(sep => {
        const text = sep.textContent.trim();
        if (seenDates.has(text)) sep.remove();
        else seenDates.add(text);
      });

      // Restore scroll position: keep user at the same visual spot
      messagesEl.scrollTop = scrollTopBefore + (messagesEl.scrollHeight - scrollHeightBefore);
    } catch {}

    loadingMore = false;
    loadMoreBtn.textContent = 'Load earlier messages';
  }

  function isNearBottom(threshold = 150) {
    return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < threshold;
  }

  function scrollToBottom(instant = false) {
    requestAnimationFrame(() => {
      messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: instant ? 'instant' : 'smooth' });
      if (scrollBottomBtn) scrollBottomBtn.classList.remove('visible');
      requestAnimationFrame(updateScrollBottomButton);
      if (!instant) setTimeout(updateScrollBottomButton, 260);
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
    animateSendButton();

    msgInput.value = '';
    autoResize();
    clearPendingFile();
    const replyToId = replyTo ? replyTo.id : null;
    clearReply();
    window.BananzaVoiceHooks?.refreshComposerState?.();

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
    } catch (err) { console.error('[delete] failed:', err); }
  }

  function markMessageDeleted(msgId) {
    const el = messagesEl.querySelector(`[data-msg-id="${msgId}"]`);
    if (!el) { console.warn('[markDeleted] element not found for', msgId); return; }
    const bubble = el.querySelector('.msg-bubble');
    if (!bubble) { console.warn('[markDeleted] bubble not found'); return; }
    const timeEl = bubble.querySelector('.msg-time');
    const timeText = timeEl ? timeEl.textContent : '';
    bubble.innerHTML = `<span class="msg-deleted">Message deleted</span><span class="msg-time">${esc(timeText)}</span>`;
    el.querySelector('.msg-reply-btn')?.remove();
    el.querySelector('.msg-react-btn')?.remove();
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
      window.BananzaVoiceHooks?.refreshComposerState?.();
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
    window.BananzaVoiceHooks?.refreshComposerState?.();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPLY
  // ═══════════════════════════════════════════════════════════════════════════
  function getReplyPreviewText(msg) {
    if (msg?.text) return msg.text.substring(0, 100);
    if (msg?.is_voice_note) {
      const transcript = (msg.transcription_text || '').trim();
      return transcript ? transcript.substring(0, 100) : 'Голосовое сообщение';
    }
    if (msg?.file_name) return msg.file_name.substring(0, 100);
    return 'Attachment';
  }

  function getReplyQuoteText(msg) {
    const serverText = (msg?.reply_text || '').trim();
    if (serverText) return serverText.substring(0, 100);

    const sourceRow = msg?.reply_to_id
      ? messagesEl.querySelector(`[data-msg-id="${msg.reply_to_id}"]`)
      : null;
    const sourceText = (sourceRow?.__replyPayload?.text || '').trim();
    if (sourceText && sourceText !== 'Attachment') return sourceText.substring(0, 100);

    const isVoiceReply = Boolean(
      msg?.reply_is_voice_note ||
      sourceRow?.__voiceMessage?.is_voice_note ||
      sourceRow?.__voiceBootstrap?.is_voice_note
    );
    return isVoiceReply ? 'Голосовое сообщение' : 'Attachment';
  }

  function setReplyFromRow(row) {
    const payload = row?.__replyPayload;
    if (!payload || row.querySelector('.msg-deleted')) return;
    setReply(payload.id, payload.display_name, payload.text);
  }

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

  function setupSwipeReplyGesture() {
    const threshold = 42;
    const maxOffset = 68;
    const lockStartPx = 8;
    const verticalCancelPx = 22;
    let swipe = null;

    const isMobile = () => window.innerWidth <= 768;
    const isInteractiveTarget = (target) => Boolean(target.closest(
      'button, a, input, textarea, select, label, audio, video, .msg-reply, .reaction-badge, .msg-image, .msg-video'
    ));
    const ensureIndicator = (row) => {
      let indicator = row.querySelector('.swipe-reply-indicator');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'swipe-reply-indicator';
        indicator.textContent = '\u21A9';
        row.appendChild(indicator);
      }
      return indicator;
    };
    const finishSwipe = (shouldReply) => {
      if (!swipe) return;
      const { row, content } = swipe;
      row.classList.remove('swipe-reply-active', 'swipe-reply-ready');
      if (content) content.style.transform = '';
      const indicator = row.querySelector('.swipe-reply-indicator');
      setTimeout(() => indicator?.remove(), 180);
      if (shouldReply) {
        navigator.vibrate?.(18);
        setReplyFromRow(row);
      }
      swipe = null;
    };

    messagesEl.addEventListener('touchstart', (e) => {
      if (!isMobile() || e.touches.length !== 1 || isInteractiveTarget(e.target)) return;
      const row = e.target.closest('.msg-row');
      if (!row || row.querySelector('.msg-deleted') || !row.__replyPayload) return;
      const touch = e.touches[0];
      swipe = {
        row,
        content: row.querySelector('.msg-content'),
        startX: touch.clientX,
        startY: touch.clientY,
        dx: 0,
        locked: false,
      };
    }, { passive: true });

    messagesEl.addEventListener('touchmove', (e) => {
      if (!swipe || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = swipe.startX - touch.clientX;
      const dy = touch.clientY - swipe.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (!swipe.locked) {
        if ((absY > verticalCancelPx && absY > absX * 1.35) || dx < -10) {
          finishSwipe(false);
          return;
        }
        if (dx < lockStartPx || absX < absY * 0.75) return;
        if (!e.cancelable) {
          finishSwipe(false);
          return;
        }
        swipe.locked = true;
        hideReactionPicker();
        ensureIndicator(swipe.row);
        swipe.row.classList.add('swipe-reply-active');
      }

      if (!e.cancelable) {
        finishSwipe(false);
        return;
      }
      e.preventDefault();
      swipe.dx = Math.max(0, Math.min(dx, maxOffset));
      if (swipe.content) swipe.content.style.transform = `translateX(${-swipe.dx}px)`;
      swipe.row.classList.toggle('swipe-reply-ready', dx >= threshold);
    }, { passive: false });

    messagesEl.addEventListener('touchend', () => {
      finishSwipe(Boolean(swipe?.locked && swipe.dx >= threshold));
    }, { passive: true });
    messagesEl.addEventListener('touchcancel', () => finishSwipe(false), { passive: true });
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
  // MEDIA VIEWER
  // ═══════════════════════════════════════════════════════════════════════════
  let galleryItems = []; // { src, type: 'image'|'video' }
  let galleryIndex = 0;
  let ivScale = 1, ivPanX = 0, ivPanY = 0;
  let ivHistoryPushed = false;    // true when we pushed { view: 'mediaviewer' } to history
  let ivSkipNextPopstate = false; // skip chat-nav after closeMediaViewer calls history.back()

  // ═══════════════════════════════════════════════════════════════════════════
  // REACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  let reactionPickerMsgId = null;

  function renderReactions(reactions) {
    if (!reactions || reactions.length === 0) return '';
    const grouped = {};
    for (const r of reactions) {
      if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
      grouped[r.emoji].count++;
      if (+r.user_id === currentUser.id) grouped[r.emoji].mine = true;
    }
    return Object.entries(grouped).map(([emoji, { count, mine }]) =>
      `<button class="reaction-badge${mine ? ' mine' : ''}" data-emoji="${emoji}">${emoji}<span>${count}</span></button>`
    ).join('');
  }

  function updateReactionBar(msgId, reactions) {
    const row = messagesEl.querySelector(`[data-msg-id="${msgId}"]`);
    if (!row) return;
    const footer = row.querySelector('.msg-footer');
    if (!footer) return;
    let bar = footer.querySelector('.msg-reactions');
    if (reactions.length === 0) {
      if (bar) { bar.outerHTML = '<div></div>'; }
    } else {
      if (!bar) {
        const placeholder = footer.querySelector('div');
        if (placeholder) placeholder.outerHTML = `<div class="msg-reactions">${renderReactions(reactions)}</div>`;
      } else {
        bar.innerHTML = renderReactions(reactions);
      }
    }
  }

  function showReactionPicker(row, trigger) {
    reactionPickerMsgId = +row.dataset.msgId;
    reactionPicker.classList.remove('hidden');
    // Position near the trigger
    const triggerEl = (trigger instanceof Element ? trigger : row);
    const rect = triggerEl.getBoundingClientRect();
    const pw = reactionPicker.offsetWidth || 370;
    const ph = reactionPicker.offsetHeight || 52;
    let left = rect.left;
    let top = rect.top - ph - 8;
    if (top < 8) top = rect.bottom + 8;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    reactionPicker.style.left = left + 'px';
    reactionPicker.style.top = top + 'px';
  }

  function hideReactionPicker() {
    reactionPicker.classList.add('hidden');
    reactionPickerMsgId = null;
  }

  async function toggleReaction(msgId, emoji) {
    hideReactionPicker();
    console.log('[reaction] sending', msgId, emoji);
    try {
      const data = await api(`/api/messages/${msgId}/reactions`, { method: 'POST', body: { emoji } });
      console.log('[reaction] response', data);
      if (data && data.reactions) updateReactionBar(msgId, data.reactions);
    } catch (err) {
      console.warn('[reaction] failed:', err);
    }
  }

  function collectGalleryItems() {
    galleryItems = [];
    messagesEl.querySelectorAll('.msg-image, .msg-video video').forEach(el => {
      if (el.tagName === 'IMG') {
        galleryItems.push({ src: el.src, type: 'image' });
      } else if (el.tagName === 'VIDEO') {
        const src = el.querySelector('source')?.getAttribute('src') || '';
        if (src) galleryItems.push({ src, type: 'video' });
      }
    });
  }

  function ivCurrentImg() {
    if (galleryItems[galleryIndex]?.type === 'video') return null;
    return ivStrip.querySelectorAll('.iv-slide')[galleryIndex]?.querySelector('img') || null;
  }
  function ivApplyTransform() {
    const img = ivCurrentImg();
    if (img) img.style.transform = `scale(${ivScale}) translate(${ivPanX}px, ${ivPanY}px)`;
  }
  function ivResetZoom() {
    ivScale = 1; ivPanX = 0; ivPanY = 0;
    const img = ivCurrentImg();
    if (img) img.style.transform = '';
  }

  function openMediaViewer(src, type = 'image') {
    collectGalleryItems();
    galleryIndex = galleryItems.findIndex(item => item.src === src && item.type === type);
    if (galleryIndex < 0) galleryIndex = 0;
    ivStrip.innerHTML = galleryItems.map(item => {
      if (item.type === 'video') {
        return `<div class="iv-slide iv-slide-video"><video controls playsinline><source src="${esc(item.src)}"></video></div>`;
      }
      return `<div class="iv-slide"><img src="${esc(item.src)}" alt=""></div>`;
    }).join('');
    ivScale = 1; ivPanX = 0; ivPanY = 0;
    ivStrip.style.transition = 'none';
    ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;
    updateGalleryArrows();
    if (window.innerWidth <= 768) {
      history.pushState({ view: 'mediaviewer' }, '');
      ivHistoryPushed = true;
    }
    // Pause any playing videos in the chat view (user opened fullscreen viewer)
    try {
      messagesEl.querySelectorAll('.msg-video video').forEach(v => {
        try { if (!v.paused) v.pause(); } catch (e) {}
      });
    } catch (e) {}

    imageViewer.classList.remove('hidden');
    if (galleryItems[galleryIndex]?.type === 'video') {
      ivStrip.querySelectorAll('.iv-slide')[galleryIndex]?.querySelector('video')?.play().catch(() => {});
    }
  }
  // Backward-compat alias used by existing image click handlers
  function openImageViewer(src) { openMediaViewer(src, 'image'); }

  function closeMediaViewer() {
    if (imageViewer.classList.contains('hidden')) return;
    ivStrip.querySelectorAll('video').forEach(v => v.pause());
    imageViewer.classList.add('hidden');
    if (ivHistoryPushed) {
      ivHistoryPushed = false;
      ivSkipNextPopstate = true;
      history.back();
    }
  }

  function updateGalleryArrows() {
    const prev = imageViewer.querySelector('.iv-prev');
    const next = imageViewer.querySelector('.iv-next');
    prev.style.display = galleryItems.length > 1 && galleryIndex > 0 ? '' : 'none';
    next.style.display = galleryItems.length > 1 && galleryIndex < galleryItems.length - 1 ? '' : 'none';
  }

  function galleryNav(dir) {
    const newIdx = galleryIndex + dir;
    if (newIdx < 0 || newIdx >= galleryItems.length) return;
    ivStrip.querySelectorAll('.iv-slide')[galleryIndex]?.querySelector('video')?.pause();
    ivResetZoom();
    galleryIndex = newIdx;
    ivStrip.style.transition = 'transform 0.3s ease';
    ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;
    updateGalleryArrows();
    if (galleryItems[galleryIndex]?.type === 'video') {
      setTimeout(() => {
        ivStrip.querySelectorAll('.iv-slide')[galleryIndex]?.querySelector('video')?.play().catch(() => {});
      }, 350);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════════════════════
  function closeAllModals() {
    [newChatModal, adminModal, chatInfoModal, menuDrawer, emojiPicker, settingsModal, changePasswordModal].forEach(m => m.classList.add('hidden'));
    closeMediaViewer();
    window.BananzaVoiceHooks?.closeAll?.();
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
      list.innerHTML = users.map(renderAdminUserRow).join('');

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
    $('#settingsScrollRestore').checked = scrollRestoreMode === 'restore';
    window.BananzaVoiceHooks?.onSettingsOpened?.({ currentUser });
  }

  function resetChangePasswordFields() {
    ['cpOldPass', 'cpNewPass', 'cpNewPassConfirm'].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      input.value = '';
      input.type = 'password';
    });
  }

  function openChangePasswordModal() {
    closeAllModals();
    changePasswordModal.classList.remove('hidden');
    resetChangePasswordFields();
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

  function animateSendButton() {
    if (!sendBtn) return;
    sendBtn.classList.remove('send-fly');
    void sendBtn.offsetWidth;
    sendBtn.classList.add('send-fly');
    clearTimeout(sendBtn.__sendFlyTimer);
    sendBtn.__sendFlyTimer = setTimeout(() => {
      sendBtn.classList.remove('send-fly');
      window.BananzaVoiceHooks?.refreshComposerState?.();
    }, 320);
  }

  function setupPasswordPreviewToggles() {
    $$('.pw-toggle').forEach(btn => {
      if (btn.dataset.bound === '1') return;
      const targetId = btn.dataset.target;
      const getInput = () => targetId ? document.getElementById(targetId) : null;
      const setVisible = (visible) => {
        const input = getInput();
        if (!input) return;
        input.type = visible ? 'text' : 'password';
        btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
      };
      let pressPreviewed = false;
      const show = (e) => {
        e.preventDefault();
        pressPreviewed = true;
        setVisible(true);
      };
      const hide = (e) => {
        e?.preventDefault?.();
        setVisible(false);
      };

      btn.dataset.bound = '1';
      btn.addEventListener('pointerdown', show);
      btn.addEventListener('pointerup', hide);
      btn.addEventListener('pointercancel', hide);
      btn.addEventListener('pointerleave', hide);
      btn.addEventListener('touchstart', show, { passive: false });
      btn.addEventListener('touchend', hide, { passive: false });
      btn.addEventListener('touchcancel', hide, { passive: false });
      btn.addEventListener('blur', hide);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (pressPreviewed) {
          pressPreviewed = false;
          return;
        }
        setVisible(true);
        setTimeout(() => setVisible(false), 500);
      });
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') show(e);
      });
      btn.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' || e.key === ' ') hide(e);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════
  function setupEvents() {
    setupPasswordPreviewToggles();
    setupSwipeReplyGesture();

    // Send message
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sendBtn.blur();
      sendMessage();
      // Keep keyboard open on mobile
      if (window.innerWidth <= 768) msgInput.focus();
    });
    msgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (sendByEnter && !e.shiftKey && !e.ctrlKey) { e.preventDefault(); sendMessage(); }
        else if (!sendByEnter && e.ctrlKey) { e.preventDefault(); sendMessage(); }
      }
    });
    msgInput.addEventListener('input', () => {
      autoResize();
      window.BananzaVoiceHooks?.refreshComposerState?.();
      // Typing indicator
      if (!typingSendTimeout) {
        sendTyping();
        typingSendTimeout = setTimeout(() => { typingSendTimeout = null; }, 2000);
      }
    });

    // File attach
    const fileInputGallery = $('#fileInputGallery');
    const fileInputCamera = $('#fileInputCamera');
    const fileInputDocs = $('#fileInputDocs');
    const attachMenu = $('#attachMenu');
    const attachMenuOverlay = $('#attachMenuOverlay');
    const isMobileAttachMenu = () => window.innerWidth <= 768;
    const focusComposerKeepKeyboard = () => {
      if (!isMobileAttachMenu()) return;
      requestAnimationFrame(() => {
        try {
          msgInput.focus({ preventScroll: true });
        } catch {
          msgInput.focus();
        }
      });
    };
    const positionAttachMenu = () => {
      if (!attachMenu || attachMenu.classList.contains('hidden')) return;
      const rect = attachBtn.getBoundingClientRect();
      const vv = window.visualViewport;
      const viewportLeft = vv ? vv.offsetLeft : 0;
      const viewportTop = vv ? vv.offsetTop : 0;
      const viewportWidth = vv ? vv.width : window.innerWidth;
      const viewportHeight = vv ? vv.height : window.innerHeight;
      const mw = attachMenu.offsetWidth || 160;
      const mh = attachMenu.offsetHeight || 145;
      let left = rect.left + viewportLeft;
      left = Math.max(viewportLeft + 8, Math.min(left, viewportLeft + viewportWidth - mw - 8));
      const preferredTop = rect.top + viewportTop - mh - 8;
      const fallbackTop = rect.bottom + viewportTop + 8;
      const maxTop = Math.max(viewportTop + 8, viewportTop + viewportHeight - mh - 8);
      let top = preferredTop;
      if (top < viewportTop + 8) top = Math.min(fallbackTop, maxTop);
      top = Math.max(viewportTop + 8, Math.min(top, maxTop));
      attachMenu.style.left = left + 'px';
      attachMenu.style.top = top + 'px';
    };
    const closeAttachMenu = () => { attachMenu.classList.add('hidden'); };
    const keepAttachButtonFromBlurringInput = (e) => {
      if (!isMobileAttachMenu()) return;
      e.preventDefault();
    };

    attachBtn.addEventListener('pointerdown', keepAttachButtonFromBlurringInput, { passive: false });
    attachBtn.addEventListener('mousedown', keepAttachButtonFromBlurringInput);

    attachBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isMobileAttachMenu()) {
        if (!attachMenu.classList.contains('hidden')) {
          attachMenu.classList.add('hidden');
          return;
        }
        attachMenu.classList.remove('hidden');
        positionAttachMenu();
        focusComposerKeepKeyboard();
      } else {
        fileInput.click();
      }
    });
    window.visualViewport?.addEventListener('resize', () => {
      if (isMobileAttachMenu() && !attachMenu.classList.contains('hidden')) {
        positionAttachMenu();
      }
    });
    // Close on outside click (no overlay needed)
    document.addEventListener('click', (e) => {
      if (!attachMenu.classList.contains('hidden') && !attachMenu.contains(e.target) && e.target !== attachBtn) {
        attachMenu.classList.add('hidden');
      }
    });
    attachMenuOverlay.addEventListener('click', closeAttachMenu);
    $('#attachMenuCancel') && $('#attachMenuCancel').addEventListener('click', closeAttachMenu);
    $('#attachMenuGallery').addEventListener('click', () => { closeAttachMenu(); fileInputGallery.click(); });
    $('#attachMenuCamera').addEventListener('click', () => { closeAttachMenu(); fileInputCamera.click(); });
    $('#attachMenuFile').addEventListener('click', () => { closeAttachMenu(); fileInputDocs.click(); });

    fileInput.addEventListener('change', () => { if (fileInput.files.length > 0) uploadFiles(fileInput.files); });
    fileInputGallery.addEventListener('change', () => { if (fileInputGallery.files.length > 0) { uploadFiles(fileInputGallery.files); fileInputGallery.value = ''; } });
    fileInputCamera.addEventListener('change', () => { if (fileInputCamera.files.length > 0) { uploadFiles(fileInputCamera.files); fileInputCamera.value = ''; } });
    fileInputDocs.addEventListener('change', () => { if (fileInputDocs.files.length > 0) { uploadFiles(fileInputDocs.files); fileInputDocs.value = ''; } });

    // Emoji
    emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      emojiPicker.classList.toggle('hidden');
    });

    // Media viewer close
    imageViewer.addEventListener('click', (e) => {
      if (e.target.closest('.iv-prev')) { galleryNav(-1); return; }
      if (e.target.closest('.iv-next')) { galleryNav(1); return; }
      if (e.target.closest('.iv-close') || e.target.classList.contains('iv-slide')) closeMediaViewer();
    });
    document.addEventListener('keydown', (e) => {
      if (imageViewer.classList.contains('hidden')) return;
      if (e.key === 'ArrowLeft') galleryNav(-1);
      else if (e.key === 'ArrowRight') galleryNav(1);
      else if (e.key === 'Escape') closeMediaViewer();
    });

    // Strip swipe + pinch-zoom + double-tap for media viewer
    (() => {
      let startX = 0, startY = 0, dragging = false, dx = 0;
      let panBaseX = 0, panBaseY = 0;
      let pinching = false, pinchDist0 = 0, scaleBase = 1;
      const MAX_SCALE = 5;
      let lastTapTime = 0, lastTapX = 0, lastTapY = 0;

      imageViewer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          // Pinch zoom for images only
          if (galleryItems[galleryIndex]?.type !== 'video') {
            pinching = true; dragging = false;
            const t = e.touches;
            pinchDist0 = Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
            scaleBase = ivScale;
          }
          return;
        }
        if (e.touches.length === 1) {
          const now = Date.now();
          const tx = e.touches[0].clientX;
          const ty = e.touches[0].clientY;
          // Double-tap to zoom (images only)
          if (
            galleryItems[galleryIndex]?.type !== 'video' &&
            now - lastTapTime < 300 &&
            Math.abs(tx - lastTapX) < 40 &&
            Math.abs(ty - lastTapY) < 40
          ) {
            lastTapTime = 0;
            if (ivScale > 1) {
              ivResetZoom();
            } else {
              const ZOOM = 2.5;
              ivScale = ZOOM;
              ivPanX = (tx - window.innerWidth / 2) * (1 / ZOOM - 1);
              ivPanY = (ty - window.innerHeight / 2) * (1 / ZOOM - 1);
              ivApplyTransform();
            }
            return;
          }
          lastTapTime = now;
          lastTapX = tx;
          lastTapY = ty;
          startX = tx;
          startY = ty;
          panBaseX = ivPanX; panBaseY = ivPanY;
          dragging = false; dx = 0;
          if (ivScale === 1) ivStrip.style.transition = 'none';
        }
      }, { passive: true });

      imageViewer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
          if (galleryItems[galleryIndex]?.type === 'video') return;
          const t = e.touches;
          const dist = Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
          ivScale = Math.min(MAX_SCALE, Math.max(1, scaleBase * dist / pinchDist0));
          ivApplyTransform();
          return;
        }
        if (pinching || e.touches.length !== 1) return;
        const cx = e.touches[0].clientX;
        const cy = e.touches[0].clientY;
        if (ivScale > 1) {
          ivPanX = panBaseX + (cx - startX) / ivScale;
          ivPanY = panBaseY + (cy - startY) / ivScale;
          ivApplyTransform();
          return;
        }
        dx = cx - startX;
        const dy = cy - startY;
        if (!dragging && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) dragging = true;
        if (!dragging) return;
        ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth + dx}px)`;
      }, { passive: true });

      imageViewer.addEventListener('touchend', (e) => {
        if (pinching) {
          if (e.touches.length < 2) pinching = false;
          return;
        }
        if (ivScale > 1) return;
        if (dragging && Math.abs(dx) > 50) {
          galleryNav(dx < 0 ? 1 : -1);
        } else {
          ivStrip.style.transition = 'transform 0.3s ease';
          ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;
          updateGalleryArrows();
        }
        dragging = false;
      }, { passive: true });

      window.addEventListener('resize', () => {
        if (!imageViewer.classList.contains('hidden')) {
          ivStrip.style.transition = 'none';
          ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;
        }
      });
    })();

    // Reaction picker: emoji click
    reactionPicker.addEventListener('mousedown', (e) => {
      e.preventDefault(); // prevent blur/focus changes
      e.stopPropagation();
    });
    reactionPicker.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.target.closest('button[data-emoji]');
      if (btn && reactionPickerMsgId) toggleReaction(reactionPickerMsgId, btn.dataset.emoji);
    });

    // Reaction picker: close on outside click
    document.addEventListener('click', (e) => {
      if (!reactionPicker.classList.contains('hidden') && !reactionPicker.contains(e.target) && !e.target.closest('.msg-react-btn')) {
        hideReactionPicker();
      }
    });

    // Reaction badge click + react button (delegation)
    messagesEl.addEventListener('click', (e) => {
      const reactBtn = e.target.closest('.msg-react-btn');
      if (reactBtn) {
        e.stopPropagation();
        const row = reactBtn.closest('.msg-row');
        if (row) showReactionPicker(row, reactBtn);
        return;
      }
      const badge = e.target.closest('.reaction-badge');
      if (badge) {
        const row = badge.closest('.msg-row');
        if (row) toggleReaction(+row.dataset.msgId, badge.dataset.emoji);
      }
    });

    // Long press on message for reaction picker (mobile)
    (() => {
      let lpTimer = null;
      messagesEl.addEventListener('touchstart', (e) => {
        const row = e.target.closest('.msg-row');
        if (!row || e.target.closest('.msg-react-btn') || e.target.closest('.reaction-badge')) return;
        lpTimer = setTimeout(() => {
          lpTimer = null;
          navigator.vibrate && navigator.vibrate(30);
          showReactionPicker(row, null);
        }, 500);
      }, { passive: true });
      messagesEl.addEventListener('touchend', () => { clearTimeout(lpTimer); lpTimer = null; }, { passive: true });
      messagesEl.addEventListener('touchmove', () => { clearTimeout(lpTimer); lpTimer = null; }, { passive: true });
      // Desktop right-click
      messagesEl.addEventListener('contextmenu', (e) => {
        const row = e.target.closest('.msg-row');
        if (!row) return;
        e.preventDefault();
        showReactionPicker(row, null);
      });
    })();

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
        // Skip: popstate was triggered by closeMediaViewer's history.back()
        if (ivSkipNextPopstate) {
          ivSkipNextPopstate = false;
          return;
        }
        // Close media viewer if open (back pressed while viewing media)
        if (!imageViewer.classList.contains('hidden')) {
          ivStrip.querySelectorAll('video').forEach(v => v.pause());
          imageViewer.classList.add('hidden');
          ivHistoryPushed = false;
          return;
        }
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
    $('#refreshChatsBtn')?.addEventListener('click', async () => {
      await loadChats();
      if (currentChatId) updateChatStatus();
    });

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

    // Scroll restore toggle
    $('#settingsScrollRestore').addEventListener('change', (e) => {
      scrollRestoreMode = e.target.checked ? 'restore' : 'bottom';
      localStorage.setItem('scrollRestoreMode', scrollRestoreMode);
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
        resetChangePasswordFields();
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
    scrollBottomBtn?.addEventListener('mousedown', (e) => e.preventDefault());
    scrollBottomBtn?.addEventListener('click', () => {
      scrollBottomBtn.blur();
      scrollToBottom();
    });

    // Scroll to load more
    messagesEl.addEventListener('scroll', () => {
      if (messagesEl.scrollTop < 60 && hasMore && !loadingMore) loadMore();
      updateScrollBottomButton();
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
    if (window.visualViewport && window.innerWidth <= 768) {
      const app = document.getElementById('app');
      let prevVVHeight = window.visualViewport.height;
      const onVVResize = () => {
        const newHeight = window.visualViewport.height;
        app.style.height = newHeight + 'px';
        // If keyboard appeared (viewport shrunk) — scroll messages to bottom
        if (newHeight < prevVVHeight) {
          requestAnimationFrame(() => {
            messagesEl.scrollTop = messagesEl.scrollHeight;
          });
        }
        prevVVHeight = newHeight;
      };
      window.visualViewport.addEventListener('resize', onVVResize);
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

    // Restore last opened chat on both desktop and mobile so the composer is ready immediately.
    const lastChat = +localStorage.getItem('lastChat');
    if (lastChat && chats.find(c => c.id === lastChat)) {
      await openChat(lastChat);
    }

    window.dispatchEvent(new Event('bananza:ready'));
  }

  init();
})();
