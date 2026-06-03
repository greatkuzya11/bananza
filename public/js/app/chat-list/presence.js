(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const chatListRoot = root.chatList = root.chatList || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function defaultEsc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function createPresenceController(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const store = opts.store;
    const renderer = opts.renderer;
    const formatters = objectOrDefault(opts.formatters);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const esc = typeof formatters.esc === 'function' ? formatters.esc : defaultEsc;
    const initials = typeof formatters.initials === 'function' ? formatters.initials : (value) => String(value || '?').trim().slice(0, 2).toUpperCase();

    function getChatSearchValue() {
      return typeof state.getChatSearchValue === 'function' ? state.getChatSearchValue() : '';
    }

    function getCurrentChatId() {
      return typeof state.getCurrentChatId === 'function' ? state.getCurrentChatId() : null;
    }

    function getCurrentUser() {
      return typeof state.getCurrentUser === 'function' ? state.getCurrentUser() : null;
    }

    function getChatById(chatId) {
      return store?.getChatById?.(chatId) || null;
    }

    function setAvatarElementVisual(el, { name = '', color = '#65aadd', avatarUrl = '', fallbackText = '' } = {}) {
      if (typeof actions.setAvatarElementVisual === 'function') {
        actions.setAvatarElementVisual(el, { name, color, avatarUrl, fallbackText });
        return;
      }
      if (!el) return;
      el.style.background = color || '#65aadd';
      if (avatarUrl) {
        el.innerHTML = `<img class="avatar-img" src="${esc(avatarUrl)}" alt="" loading="lazy" onerror="this.remove()">`;
        return;
      }
      el.textContent = fallbackText || initials(name || '?');
    }

    function updateUserListItemElement(item, user) {
      if (!item || !user) return;
      const avatarEl = item.querySelector('.avatar, .chat-item-avatar');
      if (avatarEl) {
        setAvatarElementVisual(avatarEl, {
          name: user.display_name || '',
          color: user.avatar_color || '#65aadd',
          avatarUrl: user.avatar_url || '',
        });
        avatarEl.dataset.username = user.username || avatarEl.dataset.username || '';
        avatarEl.dataset.avatarColor = user.avatar_color || avatarEl.dataset.avatarColor || '';
        avatarEl.dataset.avatarUrl = user.avatar_url || '';
        avatarEl.dataset.profileStatusKey = user.profile_status_key || '';
        avatarEl.dataset.profileStatusText = user.profile_status_text || '';
      }
      const nameEl = item.querySelector('.name');
      if (nameEl && user.display_name) nameEl.textContent = user.display_name;
      const metaEl = item.querySelector('.user-list-meta');
      if (metaEl && typeof actions.userSecondaryLineText === 'function') {
        metaEl.textContent = actions.userSecondaryLineText(user);
      }
      const memberOnlineEl = item.querySelector('.admin-user-status');
      if (memberOnlineEl && item.dataset.bot !== '1') {
        const status = typeof actions.profileStatusLabel === 'function' ? actions.profileStatusLabel(user) : '';
        const isOnline = memberOnlineEl.classList.contains('online');
        memberOnlineEl.innerHTML = `<span class="status-dot"></span><span class="admin-user-status-label">${isOnline ? 'online' : 'offline'}${status ? ` <span class="user-profile-status-inline">\u2022 ${esc(status)}</span>` : ''}</span>`;
        item.querySelector('.user-profile-status-line')?.remove();
      }
    }

    function updateAdminUserRowElement(row, user) {
      if (!row || !user) return;
      const avatarEl = row.querySelector('.avatar');
      if (avatarEl) {
        setAvatarElementVisual(avatarEl, {
          name: user.display_name || '',
          color: user.avatar_color || '#65aadd',
          avatarUrl: user.avatar_url || '',
        });
      }
      const nameEl = row.querySelector('.name');
      if (nameEl) {
        const username = user.username || nameEl.querySelector('span')?.textContent?.replace(/^@/, '') || '';
        nameEl.innerHTML = `${esc(user.display_name || '')}${username ? ` <span style="color:var(--text-secondary)">@${esc(username)}</span>` : ''}`;
      }
    }

    function refreshUserRows(user) {
      const userId = Number(user && (user.id || user.user_id) || 0);
      if (!userId) return;
      doc.querySelectorAll(`.user-list-item[data-uid="${userId}"]`).forEach((item) => updateUserListItemElement(item, user));
      doc.querySelectorAll(`.admin-user-row[data-uid="${userId}"]`).forEach((row) => updateAdminUserRowElement(row, user));
    }

    function updateOnlineDisplay() {
      renderer?.renderChatList?.(getChatSearchValue());
      if (getCurrentChatId()) actions.updateChatStatus?.();
      actions.refreshAdminUserStatuses?.();
      try { actions.refreshChatMemberStatuses?.(); } catch {}
      try { actions.refreshChatInfoStatus?.(); } catch {}
    }

    function setOnlineUsers(userIds) {
      store?.setOnlineUsers?.(userIds);
      updateOnlineDisplay();
      return store?.getOnlineUsers?.() || new Set();
    }

    function patchAllUsers(user) {
      const users = store?.getAllUsers?.() || [];
      let changed = false;
      const nextUsers = users.map((entry) => {
        if (Number(entry && entry.id || 0) !== Number(user.id || 0)) return entry;
        changed = true;
        return { ...entry, ...user, avatar_url: user.avatar_url };
      });
      if (changed) store?.setAllUsers?.(nextUsers);
      return changed;
    }

    function patchPrivateChats(user) {
      const userId = Number(user && user.id || 0);
      const chats = store?.getChats?.() || [];
      let changed = false;
      const nextChats = chats.map((chat) => {
        if (chat && chat.type === 'private' && chat.private_user && Number(chat.private_user.id || 0) === userId) {
          changed = true;
          return {
            ...chat,
            name: user.display_name || chat.name,
            private_user: {
              ...chat.private_user,
              ...user,
              avatar_url: user.avatar_url,
            },
          };
        }
        return chat;
      });
      if (changed) store?.setChats?.(nextChats);
      return changed;
    }

    function applyUserUpdate(nextUser = {}) {
      const userId = Number(nextUser.id || nextUser.user_id || 0);
      if (!userId) return null;
      const user = {
        ...nextUser,
        id: userId,
        user_id: userId,
        avatar_url: nextUser.avatar_url || null,
      };

      if (getCurrentUser() && Number(getCurrentUser().id) === userId) {
        actions.applyCurrentUserUpdate?.(user);
      }

      let shouldRenderChats = false;
      shouldRenderChats = patchAllUsers(user) || shouldRenderChats;
      shouldRenderChats = patchPrivateChats(user) || shouldRenderChats;

      actions.patchChatMembersCache?.(user);
      actions.patchMentionTargets?.(user);
      actions.patchAiBotUser?.(user);
      actions.refreshRenderedUserMessages?.(user);
      refreshUserRows(user);

      if (actions.isChatInfoVisible?.()) {
        actions.refreshChatMemberStatuses?.();
        actions.refreshChatInfoStatus?.();
      }

      if (shouldRenderChats) renderer?.renderChatList?.(getChatSearchValue());
      if (getCurrentChatId()) {
        const currentChat = getChatById(getCurrentChatId());
        if (currentChat) {
          actions.renderCurrentChatHeader?.(currentChat);
          actions.refreshChatInfoPresentation?.(currentChat);
          actions.updateChatStatus?.();
        }
      }

      actions.refreshMentionPickerForUserUpdate?.(user);
      try { actions.updateCachedMessagesByUser?.(user); } catch {}
      return user;
    }

    return {
      applyUserUpdate,
      setOnlineUsers,
      updateAdminUserRowElement,
      updateOnlineDisplay,
      updateUserListItemElement,
    };
  }

  chatListRoot.presence = {
    createPresenceController,
  };
})();
