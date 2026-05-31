(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const chatListRoot = root.chatList = root.chatList || {};
  const storeApi = chatListRoot.store || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createChatListDataController(options = {}) {
    const opts = objectOrDefault(options);
    const api = typeof opts.api === 'function' ? opts.api : async () => [];
    const store = opts.store;
    const renderer = opts.renderer;
    const folders = objectOrDefault(opts.folders);
    const folderStore = folders.store || folders;
    const cache = objectOrDefault(opts.cache);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const config = objectOrDefault(opts.config);
    const dom = objectOrDefault(opts.dom);
    const tx = typeof opts.tx === 'function' ? opts.tx : (text) => String(text == null ? '' : text);
    const storage = cache.storage || window.localStorage;
    const cacheAssets = typeof cache.cacheAssets === 'function' ? cache.cacheAssets : window.cacheAssets;
    const CHAT_LIST_CACHE_VERSION = Number(config.CHAT_LIST_CACHE_VERSION || 1);
    const CHAT_LIST_CACHE_SYNC_DEBOUNCE_MS = Number(config.CHAT_LIST_CACHE_SYNC_DEBOUNCE_MS || 500);
    const CHAT_LIST_REQUEST_TIMEOUT_MS = Number(config.CHAT_LIST_REQUEST_TIMEOUT_MS || 12000);
    const ALL_CHATS_FOLDER_ID = Number(config.ALL_CHATS_FOLDER_ID || 0);

    let chatListCacheSyncTimer = null;

    function getChats() {
      return store?.getChats?.() || [];
    }

    function getCurrentUser() {
      return typeof state.getCurrentUser === 'function' ? state.getCurrentUser() : null;
    }

    function getCurrentChatId() {
      return typeof state.getCurrentChatId === 'function' ? state.getCurrentChatId() : null;
    }

    function getChatSearchValue() {
      return typeof state.getChatSearchValue === 'function' ? state.getChatSearchValue() : '';
    }

    function normalizeChatFolderId(folderId) {
      if (typeof actions.normalizeChatFolderId === 'function') return actions.normalizeChatFolderId(folderId);
      const id = Number(folderId || 0);
      return Number.isInteger(id) && id > 0 ? id : ALL_CHATS_FOLDER_ID;
    }

    function normalizeCachedChats(rawChats) {
      return typeof storeApi.normalizeCachedChats === 'function'
        ? storeApi.normalizeCachedChats(rawChats, {
          compareChatsForList: typeof actions.compareChatsForList === 'function' ? actions.compareChatsForList : undefined,
        })
        : (Array.isArray(rawChats) ? rawChats : []);
    }

    function chatListCacheKey() {
      const userId = Number(getCurrentUser() && getCurrentUser().id || 0);
      return userId > 0 ? `bananza:chat-list:${userId}` : '';
    }

    function readChatListCache() {
      const key = chatListCacheKey();
      if (!key) return [];
      try {
        const raw = JSON.parse(storage.getItem(key) || 'null');
        if (Array.isArray(raw)) return normalizeCachedChats(raw);
        if (!raw || Number(raw.version) !== CHAT_LIST_CACHE_VERSION) return [];
        return normalizeCachedChats(raw.chats);
      } catch {
        return [];
      }
    }

    function collectChatAvatarUrls(sourceChats = getChats()) {
      const urls = new Set();
      for (const chat of Array.isArray(sourceChats) ? sourceChats : []) {
        const chatAvatar = String(chat && chat.avatar_url || '').trim();
        const privateAvatar = String(chat && chat.private_user && chat.private_user.avatar_url || '').trim();
        if (chatAvatar) urls.add(chatAvatar);
        if (privateAvatar) urls.add(privateAvatar);
      }
      return Array.from(urls);
    }

    function warmChatListAvatarAssets(sourceChats = getChats()) {
      const avatarUrls = collectChatAvatarUrls(sourceChats).slice(0, 32);
      if (!avatarUrls.length || typeof cacheAssets !== 'function') return;
      Promise.resolve(cacheAssets(avatarUrls)).catch(() => {});
    }

    function persistChatListCache() {
      const key = chatListCacheKey();
      if (!key) return;
      try {
        storage.setItem(key, JSON.stringify({
          version: CHAT_LIST_CACHE_VERSION,
          savedAt: Date.now(),
          chats: normalizeCachedChats(getChats()),
        }));
      } catch {}
      warmChatListAvatarAssets();
    }

    function clearCacheSyncTimer() {
      clearTimeout(chatListCacheSyncTimer);
      chatListCacheSyncTimer = null;
    }

    function scheduleChatListCacheSync() {
      clearCacheSyncTimer();
      chatListCacheSyncTimer = setTimeout(() => {
        chatListCacheSyncTimer = null;
        persistChatListCache();
      }, CHAT_LIST_CACHE_SYNC_DEBOUNCE_MS);
    }

    function setChatListStatus(message = '', type = '') {
      const chatListStatus = dom.chatListStatus || document.getElementById('chatListStatus');
      if (!chatListStatus) return;
      chatListStatus.textContent = tx(message);
      chatListStatus.classList.toggle('hidden', !message);
      chatListStatus.classList.toggle('is-loading', type === 'loading');
      chatListStatus.classList.toggle('is-info', type === 'info');
      chatListStatus.classList.toggle('is-error', type === 'error');
    }

    function isChatListWaitingForActiveFolder(folderId = folderStore.activeFolderId) {
      return normalizeChatFolderId(folderId) !== ALL_CHATS_FOLDER_ID
        && !folderStore.loadedOnce
        && !folderStore.loadFailed;
    }

    function hydrateChatListCache() {
      const cachedChats = readChatListCache();
      if (!cachedChats.length) return false;
      store.setChats(cachedChats);
      if (isChatListWaitingForActiveFolder()) {
        setChatListStatus('Loading chats...', 'loading');
      } else {
        store.setLoadedOnce(true);
        renderer?.renderChatList?.(getChatSearchValue());
        setChatListStatus('Showing saved chats while refreshing...', 'info');
      }
      warmChatListAvatarAssets(cachedChats);
      return true;
    }

    function hasActiveChatListRequest() {
      return Boolean(store?.getChatListAbortController?.());
    }

    function abortChatListRequest() {
      return store?.abortChatListRequest?.();
    }

    function isAbortError(error) {
      return Boolean(
        error && error.name === 'AbortError'
        || (typeof actions.isAbortError === 'function' && actions.isAbortError(error))
      );
    }

    async function loadChats({ silent = false } = {}) {
      const requestId = store.nextChatListRequestSeq();
      store.abortChatListRequest();
      const controller = new AbortController();
      store.setChatListAbortController(controller);
      const timeoutId = setTimeout(() => {
        try { controller.abort(); } catch {}
      }, CHAT_LIST_REQUEST_TIMEOUT_MS);
      if (!silent) {
        const chatList = dom.chatList || document.getElementById('chatList');
        const hasSidebarContent = getChats().length > 0 || Number(chatList && chatList.childElementCount || 0) > 0;
        if (!store.isLoadedOnce() && !hasSidebarContent) setChatListStatus('Loading chats...', 'loading');
        else setChatListStatus('Refreshing chats...', 'loading');
      }
      try {
        const nextChats = await api('/api/chats', { signal: controller.signal });
        if (!store.isCurrentChatListRequest(requestId)) return getChats();
        store.setChats(nextChats);
        store.setLoadedOnce(true);
        await Promise.resolve(actions.loadChatFolders?.({ silent: true, renderAfterLoad: false })).catch(() => {});
        renderer?.renderChatList?.(getChatSearchValue());
        const currentChat = store.getChatById(getCurrentChatId());
        if (currentChat) {
          actions.renderCurrentChatHeader?.(currentChat);
          actions.applyChatBackground?.(currentChat);
          actions.updateChatStatus?.();
          actions.refreshChatInfoPresentation?.(currentChat);
          actions.renderChatPreferencesForm?.(currentChat);
          actions.renderChatPinSettingsForm?.(currentChat);
          actions.renderChatDangerControls?.(currentChat);
        }
        setChatListStatus('', '');
        actions.scheduleMessageBackgroundSync?.();
        return getChats();
      } catch (error) {
        if (!store.isCurrentChatListRequest(requestId)) return getChats();
        const abort = isAbortError(error);
        if (getChats().length > 0) {
          setChatListStatus(
            abort
              ? 'Chat refresh took too long. Showing saved chats.'
              : 'Could not refresh chats. Showing saved chats.',
            'info'
          );
        } else {
          setChatListStatus(
            abort
              ? 'Chat list took too long to load. Tap refresh to try again.'
              : 'Could not load chats. Tap refresh to try again.',
            'error'
          );
        }
        console.warn('Failed to load chats', error);
        return getChats();
      } finally {
        clearTimeout(timeoutId);
        store.clearChatListAbortController(controller);
      }
    }

    async function loadAllUsers() {
      try {
        const users = await api('/api/users');
        store.setAllUsers(users);
        if (getChatSearchValue()) renderer?.renderChatList?.(getChatSearchValue());
        return store.getAllUsers();
      } catch {
        return store.getAllUsers();
      }
    }

    async function searchHiddenChats(query) {
      const normalized = String(query || '').trim().toLowerCase();
      const requestId = store.nextHiddenChatSearchSeq();
      if (normalized.length < 2) {
        store.resetHiddenChatSearch({ incrementSeq: false, clearTimer: false });
        renderer?.renderChatList?.(getChatSearchValue());
        return [];
      }
      try {
        const data = await api(`/api/chats/hidden?q=${encodeURIComponent(normalized)}`);
        if (!store.isCurrentHiddenChatSearch(requestId)) return store.getHiddenChatSearchResults();
        const results = data && data.chats || data || [];
        store.setHiddenChatSearch(normalized, results);
        renderer?.renderChatList?.(getChatSearchValue());
        return store.getHiddenChatSearchResults();
      } catch {
        if (!store.isCurrentHiddenChatSearch(requestId)) return store.getHiddenChatSearchResults();
        store.setHiddenChatSearch(normalized, []);
        return [];
      }
    }

    function scheduleHiddenChatSearch(query) {
      const normalized = String(query || '').trim().toLowerCase();
      store.clearHiddenChatSearchTimer();
      if (normalized.length < 2) {
        store.resetHiddenChatSearch();
        return;
      }
      if (store.getHiddenChatSearchQuery() === normalized) return;
      store.setHiddenChatSearchTimer(setTimeout(() => {
        store.setHiddenChatSearchTimer(null);
        searchHiddenChats(normalized);
      }, 180));
    }

    async function openHiddenChatFromSearch(chatId) {
      const id = Number(chatId || 0);
      if (!id) return;
      try {
        await api(`/api/chats/${id}/unhide`, { method: 'POST' });
        await loadChats({ silent: true });
        await actions.openChat?.(id);
        actions.setChatSearchOpen?.(false, { clear: true, focus: false });
      } catch (error) {
        actions.showToast?.(error && error.message || '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u043A\u0440\u044B\u0442\u044B\u0439 \u0447\u0430\u0442');
      }
    }

    function updateChatListLastMessage(msg) {
      const chatId = Number(msg && msg.chat_id || 0);
      const chat = store.getChatById(chatId);
      if (!chat) return null;
      const lastText = msg.text || (msg.is_voice_note ? msg.transcription_text || actions.getMediaNoteFallbackLabel?.(msg) || null : null);
      const updated = store.patchChat(chatId, {
        last_text: lastText,
        last_time: msg.created_at,
        last_user: msg.display_name,
        last_file_id: msg.file_id,
        last_message_id: Math.max(Number(chat.last_message_id || 0), Number(msg.id || 0)),
      });
      renderer?.renderChatList?.(getChatSearchValue());
      return updated;
    }

    function incrementUnread(chatId, messageId = null) {
      const id = Number(chatId || 0);
      const chat = store.getChatById(id);
      if (!chat) return null;
      const patch = {
        unread_count: Number(chat.unread_count || 0) + 1,
      };
      if (!chat.first_unread_id && messageId) patch.first_unread_id = messageId;
      const updated = store.patchChat(id, patch);
      renderer?.renderChatList?.(getChatSearchValue());
      return updated;
    }

    function applyLocalRead(chatId, lastReadId) {
      const id = Number(chatId || 0);
      const readId = Number(lastReadId || 0);
      const chat = store.getChatById(id);
      if (!chat || !readId) return null;
      const patch = {
        last_read_id: Math.max(Number(chat.last_read_id || 0), readId),
      };
      if (!chat.last_message_id || readId >= Number(chat.last_message_id || 0)) {
        patch.unread_count = 0;
        patch.first_unread_id = null;
      }
      const updated = store.patchChat(id, patch);
      renderer?.renderChatList?.(getChatSearchValue());
      return updated;
    }

    function applyChatUpdate(nextChat = {}) {
      const chatId = Number(nextChat && nextChat.id || 0);
      if (!chatId) return null;
      const current = store.getChatById(chatId);
      if (!current) return null;
      const previousContextTransform = Boolean(current.context_transform_enabled);
      const previousChatShotEnabled = Boolean(current.chatshot_enabled);
      const previousChatShotBotId = Number(current.chatshot_bot_id || 0);
      const previousChatShotStyle = String(current.chatshot_style || '');
      const previousChatShotBananaFilterEnabled = current.chatshot_banana_filter_enabled !== 0;
      const merged = {
        ...current,
        ...nextChat,
        background_url: Object.prototype.hasOwnProperty.call(nextChat, 'background_url')
          ? (nextChat.background_url || null)
          : (current.background_url || null),
        background_style: nextChat.background_style || current.background_style || 'cover',
      };
      if ((current.type === 'private' || nextChat.type === 'private') && current.private_user && !nextChat.private_user) {
        merged.private_user = { ...current.private_user };
        if (Number(current.private_user.is_ai_bot) === 0) merged.name = current.name;
      }
      const updated = store.patchChat(chatId, merged);
      if (!updated) return null;
      if (previousContextTransform !== Boolean(updated.context_transform_enabled)) {
        actions.invalidateContextConvertAvailability?.(chatId);
      }
      if (
        previousChatShotEnabled !== Boolean(updated.chatshot_enabled)
        || previousChatShotBotId !== Number(updated.chatshot_bot_id || 0)
        || previousChatShotStyle !== String(updated.chatshot_style || '')
        || previousChatShotBananaFilterEnabled !== (updated.chatshot_banana_filter_enabled !== 0)
      ) {
        actions.invalidateChatShotState?.(chatId);
      }
      renderer?.renderChatList?.(getChatSearchValue());
      if (Number(getCurrentChatId()) === chatId) {
        actions.renderCurrentChatHeader?.(updated);
        actions.applyChatBackground?.(updated);
        actions.updateChatStatus?.();
        actions.renderPinnedBar?.(chatId);
        actions.refreshVisiblePinButtons?.(chatId);
        actions.renderChatDangerControls?.(updated);
      }
      actions.refreshChatInfoPresentation?.(updated);
      actions.renderChatPinSettingsForm?.(updated);
      actions.renderChatContextTransformForm?.(updated);
      actions.renderChatShotForm?.(actions.getCurrentChatShotState?.());
      return updated;
    }

    async function removeChatLocally(chatId, { clearCache = false } = {}) {
      const id = Number(chatId || 0);
      if (!id) return;
      store.removeChat(id);
      actions.clearChatLocalState?.(id);
      actions.closeChatViewForChat?.(id);
      renderer?.renderChatList?.(getChatSearchValue());
      if (clearCache) await actions.clearCachedChat?.(id, { includeOutbox: true });
    }

    return {
      abortChatListRequest,
      applyChatUpdate,
      applyLocalRead,
      chatListCacheKey,
      clearCacheSyncTimer,
      collectChatAvatarUrls,
      hasActiveChatListRequest,
      hydrateChatListCache,
      incrementUnread,
      isChatListWaitingForActiveFolder,
      loadAllUsers,
      loadChats,
      normalizeCachedChats,
      openHiddenChatFromSearch,
      persistChatListCache,
      readChatListCache,
      removeChatLocally,
      scheduleChatListCacheSync,
      scheduleHiddenChatSearch,
      searchHiddenChats,
      setChatListStatus,
      updateChatListLastMessage,
      warmChatListAvatarAssets,
    };
  }

  chatListRoot.data = {
    createChatListDataController,
  };
})();

