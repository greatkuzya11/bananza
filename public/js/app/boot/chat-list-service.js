(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function createChatListService(ctx) {
    const state = ctx?.state || {};
    const refs = {
      store: null,
      renderer: null,
      data: null,
      presence: null,
      recovery: null,
    };

    function configure(nextRefs = {}) {
      Object.keys(refs).forEach((key) => {
        if (nextRefs[key]) refs[key] = nextRefs[key];
      });
      if (refs.store) syncRuntimeState();
      return service;
    }

    function syncRuntimeState() {
      if (typeof state.syncChatListStore === 'function') state.syncChatListStore(refs.store);
      else if (refs.store) {
        state.chats = refs.store.getMutableChats?.() || refs.store.getChats?.() || state.chats || [];
        state.allUsers = refs.store.getMutableAllUsers?.() || refs.store.getAllUsers?.() || state.allUsers || [];
        state.onlineUsers = refs.store.getMutableOnlineUsers?.() || refs.store.getOnlineUsers?.() || state.onlineUsers || new Set();
      }
      return state;
    }

    function getChats() { return refs.store?.getChats?.() || state.chats || []; }
    function getAllUsers() { return refs.store?.getAllUsers?.() || state.allUsers || []; }
    function getOnlineUsers() { return refs.store?.getOnlineUsers?.() || state.onlineUsers || new Set(); }
    function getChatById(chatId) { return refs.store?.getChatById?.(chatId) || null; }
    function setChats(chats) {
      const result = refs.store?.setChats?.(chats) || state.setChats?.(chats) || [];
      syncRuntimeState();
      return result;
    }
    function setAllUsers(users) {
      const result = refs.store?.setAllUsers?.(users) || state.setAllUsers?.(users) || [];
      syncRuntimeState();
      return result;
    }
    function setOnlineUsers(userIds) {
      const result = refs.presence?.setOnlineUsers?.(userIds) || refs.store?.setOnlineUsers?.(userIds) || state.setOnlineUsers?.(userIds) || new Set();
      syncRuntimeState();
      return result;
    }
    function renderChatList(filter = '') { return refs.renderer?.renderChatList?.(filter) || null; }
    function renderChatListInto(parent, options = {}) { return refs.renderer?.renderChatListInto?.(parent, options) || null; }
    function loadChats(options = {}) { return refs.data?.loadChats?.(options) || Promise.resolve(getChats()); }
    function loadAllUsers() { return refs.data?.loadAllUsers?.() || Promise.resolve(getAllUsers()); }
    function hydrateChatListCache() { return refs.data?.hydrateChatListCache?.() || false; }
    function scheduleChatListCacheSync() { return refs.data?.scheduleChatListCacheSync?.(); }
    function updateChatListLastMessage(message) { return refs.data?.updateChatListLastMessage?.(message); }
    function applyChatUpdate(chat) { return refs.data?.applyChatUpdate?.(chat) || null; }
    function incrementUnread(chatId, messageId) { return refs.data?.incrementUnread?.(chatId, messageId); }
    function removeChatLocally(chatId, options = {}) { return refs.data?.removeChatLocally?.(chatId, options); }
    function updateOnlineDisplay() { return refs.presence?.updateOnlineDisplay?.(); }
    function applyUserUpdate(user) { return refs.presence?.applyUserUpdate?.(user) || null; }
    function scheduleRecoverySync(reason = 'event', options = {}) { return refs.recovery?.scheduleRecoverySync?.(reason, options); }
    function runRecoverySync(reason = 'event') { return refs.recovery?.runRecoverySync?.(reason); }
    function refreshWebSocketAfterResume() { return refs.recovery?.refreshWebSocketAfterResume?.(); }
    function handleAppResume(reason) { return refs.recovery?.handleAppResume?.(reason); }
    function setupLifecycleRecovery() { return refs.recovery?.setupLifecycleRecovery?.(); }

    const service = {
      configure,
      syncRuntimeState,
      getStore: () => refs.store,
      getRenderer: () => refs.renderer,
      getDataController: () => refs.data,
      getPresenceController: () => refs.presence,
      getRecoveryController: () => refs.recovery,
      getChats,
      getAllUsers,
      getOnlineUsers,
      getChatById,
      setChats,
      setAllUsers,
      setOnlineUsers,
      renderChatList,
      renderChatListInto,
      renderCustomEmojiPreviewHtml: (text, options = {}) => refs.renderer?.renderCustomEmojiPreviewHtml?.(text, options) || '',
      renderChatLastPreviewHtml: (chat, options = {}) => refs.renderer?.renderChatLastPreviewHtml?.(chat, options) || '',
      loadChats,
      loadAllUsers,
      hydrateChatListCache,
      scheduleChatListCacheSync,
      chatListCacheKey: () => refs.data?.chatListCacheKey?.() || '',
      normalizeCachedChats: (rawChats) => refs.data?.normalizeCachedChats?.(rawChats) || [],
      readChatListCache: () => refs.data?.readChatListCache?.() || [],
      collectChatAvatarUrls: (chats) => refs.data?.collectChatAvatarUrls?.(chats) || [],
      warmChatListAvatarAssets: (chats) => refs.data?.warmChatListAvatarAssets?.(chats),
      persistChatListCache: () => refs.data?.persistChatListCache?.(),
      setChatListStatus: (message = '', type = '') => refs.data?.setChatListStatus?.(message, type),
      isChatListWaitingForActiveFolder: (folderId) => Boolean(refs.data?.isChatListWaitingForActiveFolder?.(folderId)),
      hasActiveChatListRequest: () => Boolean(refs.data?.hasActiveChatListRequest?.()),
      clearCacheSyncTimer: () => refs.data?.clearCacheSyncTimer?.(),
      abortChatListRequest: () => refs.data?.abortChatListRequest?.(),
      updateChatListLastMessage,
      applyChatUpdate,
      incrementUnread,
      removeChatLocally,
      searchHiddenChats: (query) => refs.data?.searchHiddenChats?.(query) || Promise.resolve([]),
      scheduleHiddenChatSearch: (query) => refs.data?.scheduleHiddenChatSearch?.(query),
      openHiddenChatFromSearch: (chatId) => refs.data?.openHiddenChatFromSearch?.(chatId),
      updateOnlineDisplay,
      applyUserUpdate,
      updateUserListItemElement: (item, user) => refs.presence?.updateUserListItemElement?.(item, user),
      updateAdminUserRowElement: (row, user) => refs.presence?.updateAdminUserRowElement?.(row, user),
      scheduleRecoverySync,
      runRecoverySync,
      refreshWebSocketAfterResume,
      handleAppResume,
      setupLifecycleRecovery,
      flushDeferredRecoverySync: (reason) => refs.recovery?.flushDeferredRecoverySync?.(reason),
      markRecoveryRequested: (reason) => refs.recovery?.markRequested?.(reason),
    };

    return service;
  }

  bootRoot.createChatListService = createChatListService;
})();
