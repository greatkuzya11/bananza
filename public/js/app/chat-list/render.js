(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const chatListRoot = root.chatList = root.chatList || {};
  const storeApi = chatListRoot.store || {};
  const markdown = root.markdown || {};

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

  function createChatListRenderer(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const win = opts.window || window;
    const dom = objectOrDefault(opts.dom);
    const store = opts.store;
    const folders = objectOrDefault(opts.folders);
    const folderStore = folders.store || folders;
    const formatters = objectOrDefault(opts.formatters);
    const customEmoji = objectOrDefault(opts.customEmoji);
    const config = objectOrDefault(opts.config);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const t = typeof opts.t === 'function' ? opts.t : (key) => String(key || '');
    const tx = typeof opts.tx === 'function' ? opts.tx : (text) => String(text == null ? '' : text);
    const esc = typeof formatters.esc === 'function' ? formatters.esc : defaultEsc;
    const initials = typeof formatters.initials === 'function' ? formatters.initials : (value) => String(value || '?').trim().slice(0, 2).toUpperCase();
    const formatChatListTimestamp = typeof formatters.formatChatListTimestamp === 'function'
      ? formatters.formatChatListTimestamp
      : (value) => String(value || '');
    const NOTES_CHAT_EMOJI = config.NOTES_CHAT_EMOJI || '\uD83D\uDCDD';
    const ALL_CHATS_FOLDER_ID = Number(config.ALL_CHATS_FOLDER_ID || 0);

    function getEl(name, fallbackId) {
      return dom[name] || doc.getElementById(fallbackId || name) || null;
    }

    function getChatListEl() {
      return getEl('chatList', 'chatList');
    }

    function getChatSearchValue() {
      if (typeof state.getChatSearchValue === 'function') return state.getChatSearchValue();
      return getEl('chatSearch', 'chatSearch')?.value || '';
    }

    function getChats() {
      const chats = store && typeof store.getChats === 'function' ? store.getChats() : [];
      return Array.isArray(chats) ? chats : [];
    }

    function getAllUsers() {
      const users = store && typeof store.getAllUsers === 'function' ? store.getAllUsers() : [];
      return Array.isArray(users) ? users : [];
    }

    function getOnlineUsers() {
      return store && typeof store.getOnlineUsers === 'function' ? store.getOnlineUsers() : new Set();
    }

    function getCurrentChatId() {
      return typeof actions.getCurrentChatId === 'function'
        ? actions.getCurrentChatId()
        : (typeof state.getCurrentChatId === 'function' ? state.getCurrentChatId() : null);
    }

    function isNotesChat(chat) {
      return typeof actions.isNotesChat === 'function'
        ? actions.isNotesChat(chat)
        : Boolean(chat && (chat.type === 'notes' || Number(chat.is_notes) === 1));
    }

    function isDocumentChat(chat) {
      return Boolean(chat && Number(chat.is_document || 0) === 1);
    }

    function isAiBotDirectoryUser(user) {
      return typeof actions.isAiBotDirectoryUser === 'function'
        ? actions.isAiBotDirectoryUser(user)
        : Number(user && user.is_ai_bot) !== 0;
    }

    function userSecondaryLineText(user) {
      return typeof actions.userSecondaryLineText === 'function'
        ? actions.userSecondaryLineText(user)
        : (user && user.username ? `@${user.username}` : '');
    }

    function localChatPreferenceEnabled(value) {
      return typeof storeApi.localChatPreferenceEnabled === 'function'
        ? storeApi.localChatPreferenceEnabled(value)
        : value !== false && value !== 0;
    }

    function getChatSearchHaystack(chat) {
      return typeof storeApi.getChatSearchHaystack === 'function'
        ? storeApi.getChatSearchHaystack(chat)
        : String(chat && chat.name || '').toLowerCase();
    }

    function getChatLastPreviewText(chat) {
      return typeof storeApi.getChatLastPreviewText === 'function'
        ? storeApi.getChatLastPreviewText(chat)
        : String(chat && chat.last_text || '');
    }

    function renderCustomEmojiPreviewHtml(text, { className = 'chat-preview-emoji' } = {}) {
      const source = String(text || '');
      const tokenRe = /:qip-infium-\d{3}:|:qip-hd-[a-z0-9][a-z0-9-]{0,63}:/gi;
      const isCustomEmojiToken = typeof customEmoji.isCustomEmojiToken === 'function' ? customEmoji.isCustomEmojiToken : () => false;
      const renderCustomEmojiHtml = typeof customEmoji.renderCustomEmojiHtml === 'function'
        ? customEmoji.renderCustomEmojiHtml
        : (token) => esc(token);
      let html = '';
      let lastIndex = 0;
      let match;
      while ((match = tokenRe.exec(source))) {
        html += esc(source.slice(lastIndex, match.index));
        const token = match[0];
        html += isCustomEmojiToken(token)
          ? renderCustomEmojiHtml(token, { className })
          : esc(token);
        lastIndex = match.index + token.length;
      }
      html += esc(source.slice(lastIndex));
      return html;
    }

    function renderChatLastPreviewHtml(chat, { emptyText = '' } = {}) {
      const rawPreview = getChatLastPreviewText(chat);
      const preview = chat && chat.last_text && typeof markdown.toPlainText === 'function'
        ? `${chat.last_user ? `${chat.last_user}: ` : ''}${markdown.toPlainText(chat.last_text)}`
        : (typeof markdown.toPlainText === 'function' ? markdown.toPlainText(rawPreview) : rawPreview);
      return preview ? renderCustomEmojiPreviewHtml(preview) : esc(emptyText);
    }

    function renderDocumentPreviewHtml(chat) {
      const title = String(chat && (chat.document_title || chat.name) || '').trim();
      return `<span class="chat-item-document-preview">${esc(t('Document'))}${title ? ` &middot; ${esc(title)}` : ''}</span>`;
    }

    function chatItemAvatarHtml(chat) {
      if (typeof actions.chatItemAvatarHtml === 'function') return actions.chatItemAvatarHtml(chat);
      if (isDocumentChat(chat)) {
        return '<div class="chat-item-avatar document-chat-avatar" style="background:#7c8cf8">&#128196;';
      }
      if (isNotesChat(chat)) {
        return `<div class="chat-item-avatar notes-chat-avatar" style="background:#5eb5f7">${esc(chat.avatar_emoji || NOTES_CHAT_EMOJI)}`;
      }
      if (chat && chat.type === 'private' && chat.private_user) {
        const user = chat.private_user;
        if (user.avatar_url) {
          return `<div class="chat-item-avatar" style="background:${esc(user.avatar_color || '#65aadd')}"><img class="avatar-img" src="${esc(user.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">`;
        }
        return `<div class="chat-item-avatar" style="background:${esc(user.avatar_color || '#65aadd')}">${esc(initials(user.display_name || chat.name))}`;
      }
      if (chat && chat.avatar_url) {
        return `<div class="chat-item-avatar" style="background:#5eb5f7"><img class="avatar-img" src="${esc(chat.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">`;
      }
      const icon = chat && chat.type === 'general' ? '\uD83C\uDF10' : '\uD83D\uDC65';
      return `<div class="chat-item-avatar" style="background:#5eb5f7">${icon}`;
    }

    function appendChatListSeparator(label, parent = getChatListEl()) {
      const sep = doc.createElement('div');
      sep.className = 'chat-list-separator';
      sep.textContent = label;
      parent?.appendChild(sep);
      return sep;
    }

    function appendChatListEmptyState(message, parent = getChatListEl()) {
      const empty = doc.createElement('div');
      empty.className = 'chat-folder-picker-empty';
      empty.textContent = message;
      parent?.appendChild(empty);
      return empty;
    }

    function getActiveCallForChatListItem(chatId) {
      if (typeof actions.getActiveCallForChatListItem === 'function') {
        return actions.getActiveCallForChatListItem(chatId);
      }
      try {
        return win.BananzaCallHooks?.getActiveCallForChat?.(chatId) || null;
      } catch {
        return null;
      }
    }

    function createChatListItem(chat, { hiddenSearchResult = false, pinnedOverride = null, reusableItems = null } = {}) {
      const listKey = `${hiddenSearchResult ? 'hidden' : 'chat'}:${Number(chat && chat.id || 0)}`;
      const el = reusableItems?.get(listKey) || doc.createElement('div');
      const isActive = Number(chat && chat.id) === Number(getCurrentChatId());
      const pinned = typeof pinnedOverride === 'boolean'
        ? pinnedOverride
        : Boolean(typeof actions.isChatPinned === 'function' ? actions.isChatPinned(chat) : chat && chat.is_pinned);
      const activeCall = getActiveCallForChatListItem(chat && chat.id);
      const hasActiveCall = Boolean(activeCall);
      el.className = 'chat-item'
        + (isActive ? ' active' : '')
        + (pinned ? ' is-pinned' : '')
        + (isDocumentChat(chat) ? ' is-document' : '')
        + (hiddenSearchResult ? ' is-hidden-search-result' : '')
        + (hasActiveCall ? ' has-active-call' : '');
      el.dataset.chatId = chat && chat.id;
      el.dataset.pinned = pinned ? '1' : '0';
      el.dataset.listKey = listKey;

      const displayName = chat && chat.name || '';
      const onlineUsers = getOnlineUsers();
      const privateUserId = Number(chat && chat.private_user && chat.private_user.id || 0);
      const isOnline = Boolean(chat && chat.type === 'private' && privateUserId && onlineUsers.has(privateUserId));
      const lastTime = chat && chat.last_time ? formatChatListTimestamp(chat.last_time) : '';
      const unreadCount = Number(chat && chat.unread_count || 0);
      const unread = unreadCount > 0
        ? `<span class="unread-badge${isActive ? ' unread-badge--active-chat' : ''}" data-unread-count="${unreadCount}">${unreadCount > 99 ? '99+' : unreadCount}</span>`
        : '';
      const pinIndicator = pinned ? `<span class="chat-item-state-indicator chat-item-pin-indicator" aria-hidden="true" title="${esc(t('Pinned'))}">&#128204;</span>` : '';
      const notifyDisabledIndicator = pinned && !localChatPreferenceEnabled(chat && chat.notify_enabled)
        ? '<span class="chat-item-state-indicator chat-item-muted-indicator" aria-hidden="true" title="Notifications off">&#128277;</span>'
        : '';
      const soundDisabledIndicator = pinned && !localChatPreferenceEnabled(chat && chat.sounds_enabled)
        ? '<span class="chat-item-state-indicator chat-item-muted-indicator" aria-hidden="true" title="Sound off">&#128263;</span>'
        : '';
      const contextConvertIndicator = Number(chat && chat.context_transform_enabled || 0) !== 0
        ? `<span class="chat-item-state-indicator chat-item-tool-indicator chat-item-context-convert-indicator" role="img" aria-label="${esc(t('Context convert enabled'))}" title="${esc(t('Context convert enabled'))}">&#127820;</span>`
        : '';
      const chatShotIndicator = Number(chat && chat.chatshot_enabled || 0) !== 0
        ? `<span class="chat-item-state-indicator chat-item-tool-indicator chat-item-chatshot-indicator" role="img" aria-label="${esc(t('ChatShot enabled'))}" title="${esc(t('ChatShot enabled'))}">&#128248;</span>`
        : '';
      const documentIndicator = isDocumentChat(chat)
        ? `<span class="chat-item-state-indicator chat-item-document-indicator" role="img" aria-label="${esc(t('Document'))}" title="${esc(t('Document'))}">&#128196;</span>`
        : '';
      const activeCallMediaKind = String(activeCall && (activeCall.media_kind || activeCall.mediaKind) || '').toLowerCase();
      const activeCallRoomMode = String(activeCall && (activeCall.room_mode || activeCall.roomMode) || '').toLowerCase();
      const callIndicatorLabel = activeCallMediaKind === 'voice'
        ? (activeCallRoomMode === 'room' ? t('Voice room active') : t('Voice call active'))
        : t('Call in progress');
      const callIndicatorIcon = activeCallMediaKind === 'voice' ? '&#9742;&#65039;' : '';
      const callIndicator = hasActiveCall
        ? `<span class="chat-item-call-chip" aria-label="${esc(callIndicatorLabel)}" title="${esc(callIndicatorLabel)}"><span class="chat-item-call-dot" aria-hidden="true"></span>${callIndicatorIcon ? `<span class="chat-item-call-icon" aria-hidden="true">${callIndicatorIcon}</span>` : ''}<span class="chat-item-call-label">${esc(callIndicatorLabel)}</span></span>`
        : '';

      const nextHtml = `
      ${chatItemAvatarHtml(chat)}
        ${isOnline ? '<div class="online-dot"></div>' : ''}
      </div>
      <div class="chat-item-body">
        <div class="chat-item-top">
          <span class="chat-item-name">${esc(displayName)}</span>
          <span class="chat-item-meta">
            ${pinIndicator}
            ${notifyDisabledIndicator}
            ${soundDisabledIndicator}
            ${documentIndicator}
            ${contextConvertIndicator}
            ${chatShotIndicator}
            <span class="chat-item-time">${lastTime}</span>
          </span>
        </div>
        <div class="chat-item-last">
          ${callIndicator}
          <span>${isDocumentChat(chat) ? renderDocumentPreviewHtml(chat) : renderChatLastPreviewHtml(chat)}</span>
          ${unread}
        </div>
      </div>
    `;
      if (el.__chatListHtml !== nextHtml) {
        el.innerHTML = nextHtml;
        el.__chatListHtml = nextHtml;
      }
      el.onclick = (event) => {
        if (typeof state.shouldSuppressChatItemTap === 'function' && state.shouldSuppressChatItemTap(event)) return;
        const openAction = hiddenSearchResult
          ? actions.openHiddenChatFromSearch?.(chat.id)
          : actions.openChat?.(chat.id);
        Promise.resolve(openAction).catch((error) => {
          console.warn('Failed to open chat', error);
          actions.showToast?.(error && error.message || 'Could not open chat');
        });
      };
      return el;
    }

    function collectReusableChatListItems(parent) {
      const reusable = new Map();
      parent?.querySelectorAll?.('.chat-item[data-list-key]').forEach((item) => {
        const key = item.dataset.listKey || '';
        if (key && !reusable.has(key)) reusable.set(key, item);
      });
      return reusable;
    }

    function normalizeChatFolderId(folderId) {
      if (typeof actions.normalizeChatFolderId === 'function') return actions.normalizeChatFolderId(folderId);
      const normalized = Number(folderId || 0);
      return Number.isInteger(normalized) && normalized > 0 ? normalized : ALL_CHATS_FOLDER_ID;
    }

    function getChatFolderForListRender(folderId = folderStore.activeFolderId) {
      const normalizedFolderId = normalizeChatFolderId(folderId);
      if (normalizedFolderId === ALL_CHATS_FOLDER_ID) return null;
      return typeof folderStore.getFolderById === 'function' ? folderStore.getFolderById(normalizedFolderId) : null;
    }

    function compareChatsForFolder(folderId, a, b) {
      if (typeof actions.compareChatsForFolder === 'function') return actions.compareChatsForFolder(folderId, a, b);
      return typeof folderStore.compareChatsForFolder === 'function'
        ? folderStore.compareChatsForFolder(folderId, a, b)
        : 0;
    }

    function isChatPinnedInFolder(folderId, chat) {
      if (typeof actions.isChatPinnedInFolder === 'function') return actions.isChatPinnedInFolder(folderId, chat);
      return typeof folderStore.isChatPinnedInFolder === 'function' ? folderStore.isChatPinnedInFolder(folderId, chat) : false;
    }

    function isChatPinned(chat) {
      if (typeof actions.isChatPinned === 'function') return actions.isChatPinned(chat);
      return Boolean(chat && chat.is_pinned);
    }

    function renderDirectoryUserItem(user) {
      const el = doc.createElement('div');
      el.className = 'chat-item';
      const onlineUsers = getOnlineUsers();
      const userId = Number(user && user.id || 0);
      const isOnline = !isAiBotDirectoryUser(user) && onlineUsers.has(userId);
      el.innerHTML = `
          <div class="chat-item-avatar" style="background:${esc(user && user.avatar_color || '#5eb5f7')}">
            ${user && user.avatar_url ? `<img class="avatar-img" src="${esc(user.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">` : esc(initials(user && user.display_name))}
            ${isOnline ? '<div class="online-dot"></div>' : ''}
          </div>
          <div class="chat-item-body">
            <div class="chat-item-top">
              <span class="chat-item-name">${esc(user && user.display_name || '')}</span>
            </div>
            <div class="chat-item-last"><span>${esc(userSecondaryLineText(user))}</span></div>
          </div>
        `;
      el.addEventListener('click', async () => {
        try {
          await actions.openPrivateChatFromDirectory?.(userId);
        } catch (error) {
          if (typeof actions.alert === 'function') actions.alert(error && error.message || String(error || ''));
          else actions.showToast?.(error && error.message || 'Could not open chat');
        }
      });
      return el;
    }

    function renderChatListInto(parent = getChatListEl(), {
      filter = '',
      folderId = folderStore.activeFolderId,
      includeSearchExtras = parent === getChatListEl(),
    } = {}) {
      if (!(parent instanceof win.HTMLElement)) return null;
      const reusableItems = collectReusableChatListItems(parent);
      const fragment = doc.createDocumentFragment();
      const normalizedFilter = String(filter || '').trim().toLowerCase();
      const activeFolder = getChatFolderForListRender(folderId);
      const renderFolderId = Number(activeFolder && activeFolder.id || 0);
      const chats = getChats();
      const sourceChats = activeFolder
        ? chats.filter((chat) => (activeFolder.chat_ids || []).includes(Number(chat && chat.id || 0)))
        : chats;
      const filteredChats = normalizedFilter
        ? sourceChats.filter((chat) => getChatSearchHaystack(chat).includes(normalizedFilter))
        : sourceChats;
      const pinnedChats = activeFolder
        ? filteredChats.filter((chat) => isChatPinnedInFolder(renderFolderId, chat))
        : filteredChats.filter((chat) => isChatPinned(chat));
      const regularChats = activeFolder
        ? filteredChats.filter((chat) => !isChatPinnedInFolder(renderFolderId, chat))
        : filteredChats.filter((chat) => !isChatPinned(chat));
      if (activeFolder) {
        pinnedChats.sort((a, b) => compareChatsForFolder(renderFolderId, a, b));
        regularChats.sort((a, b) => compareChatsForFolder(renderFolderId, a, b));
      }

      if (pinnedChats.length) {
        const pinnedGroup = doc.createElement('div');
        pinnedGroup.className = 'chat-list-group chat-list-group--pinned';
        pinnedChats.forEach((chat) => {
          pinnedGroup.appendChild(createChatListItem(chat, { pinnedOverride: true, reusableItems }));
        });
        fragment.appendChild(pinnedGroup);
      }

      regularChats.forEach((chat) => {
        fragment.appendChild(createChatListItem(chat, {
          pinnedOverride: activeFolder ? false : null,
          reusableItems,
        }));
      });

      if (!pinnedChats.length && !regularChats.length) {
        appendChatListEmptyState(
          activeFolder ? tx('\u0412 \u044D\u0442\u043E\u0439 \u043F\u0430\u043F\u043A\u0435 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0447\u0430\u0442\u043E\u0432') : tx('\u0427\u0430\u0442\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B'),
          fragment
        );
      }

      if (includeSearchExtras && normalizedFilter && !activeFolder) {
        actions.scheduleHiddenChatSearch?.(normalizedFilter);
        const hiddenQuery = store?.getHiddenChatSearchQuery?.() || '';
        const hiddenResults = store?.getHiddenChatSearchResults?.() || [];
        const hiddenMatches = hiddenQuery === normalizedFilter
          ? hiddenResults.filter((chat) => !chats.some((visible) => Number(visible && visible.id) === Number(chat && chat.id)))
          : [];
        if (hiddenMatches.length > 0) {
          appendChatListSeparator(tx('\u0421\u043A\u0440\u044B\u0442\u044B\u0435 \u0447\u0430\u0442\u044B'), fragment);
          hiddenMatches.forEach((chat) => {
            fragment.appendChild(createChatListItem(chat, { hiddenSearchResult: true, reusableItems }));
          });
        }
        const privateHumanPeerIds = new Set(
          [...chats, ...hiddenMatches]
            .filter((chat) => chat && chat.type === 'private' && chat.private_user && Number(chat.private_user.is_ai_bot) === 0)
            .map((chat) => Number(chat.private_user.id || 0))
        );
        const matchingUsers = getAllUsers().filter((user) => (
          (Number(user && user.is_ai_bot) !== 0 || !privateHumanPeerIds.has(Number(user && user.id || 0)))
          && (
            String(user && user.display_name || '').toLowerCase().includes(normalizedFilter)
            || String(user && user.username || '').toLowerCase().includes(normalizedFilter)
            || String(user && user.ai_bot_mention || '').toLowerCase().includes(normalizedFilter)
            || String(user && user.ai_bot_model || '').toLowerCase().includes(normalizedFilter)
          )
        ));
        if (matchingUsers.length > 0) {
          appendChatListSeparator('People & bots', fragment);
        }
        matchingUsers.forEach((user) => {
          fragment.appendChild(renderDirectoryUserItem(user));
        });
      }

      parent.replaceChildren(fragment);
      return {
        activeFolder,
        folderId: renderFolderId,
        pinnedChats,
        regularChats,
      };
    }

    function renderChatList(filter = '') {
      if (typeof actions.isChatListWaitingForActiveFolder === 'function' && actions.isChatListWaitingForActiveFolder()) {
        actions.renderChatFolderPicker?.();
        return null;
      }
      actions.hideChatContextMenu?.({ immediate: true });
      const result = renderChatListInto(getChatListEl(), {
        filter,
        folderId: folderStore.activeFolderId,
        includeSearchExtras: true,
      });
      root.performance?.markOnce?.('bananza:chats-first-render');
      root.performance?.measure?.('bananza:first-chat-list', 'bananza:script-start', 'bananza:chats-first-render');
      actions.renderChatFolderPicker?.();
      actions.scheduleChatListCacheSync?.();
      return result;
    }

    return {
      appendChatListSeparator,
      appendChatListEmptyState,
      getActiveCallForChatListItem,
      chatItemAvatarHtml,
      createChatListItem,
      collectReusableChatListItems,
      getChatFolderForListRender,
      renderChatListInto,
      renderChatList,
      renderCustomEmojiPreviewHtml,
      renderChatLastPreviewHtml,
    };
  }

  chatListRoot.render = {
    createChatListRenderer,
  };
})();
