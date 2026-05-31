(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const foldersRoot = root.folders = root.folders || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function allChatsFolderId(config = {}) {
    const id = Number(objectOrDefault(config).ALL_CHATS_FOLDER_ID);
    return Number.isInteger(id) && id >= 0 ? id : 0;
  }

  function normalizeChatFolderId(folderId, config = {}) {
    const nextId = Number(folderId || 0);
    return Number.isInteger(nextId) && nextId > 0 ? nextId : allChatsFolderId(config);
  }

  function normalizeChatFolderEntry(folder = {}) {
    const source = objectOrDefault(folder);
    const next = {
      id: Number(source.id || 0),
      name: String(source.name || '').trim(),
      kind: String(source.kind || 'custom'),
      system: Boolean(source.system || source.kind === 'bot_auto'),
      bot_id: Number(source.bot_id || 0) || null,
      sort_order: Number(source.sort_order || 0) || 0,
      chat_ids: [...new Set((Array.isArray(source.chat_ids) ? source.chat_ids : [])
        .map((value) => Number(value || 0))
        .filter((value) => Number.isInteger(value) && value > 0))],
      pins: [],
    };

    next.pins = [...new Map((Array.isArray(source.pins) ? source.pins : [])
      .map((pin) => {
        const chatId = Number(pin && pin.chat_id || 0);
        const pinOrder = Number(pin && pin.pin_order || 0);
        if (!Number.isInteger(chatId) || chatId <= 0 || !Number.isInteger(pinOrder) || pinOrder <= 0) return null;
        return [chatId, { chat_id: chatId, pin_order: pinOrder }];
      })
      .filter(Boolean)).values()].sort((a, b) => a.pin_order - b.pin_order);

    return next;
  }

  function cloneFolder(folder) {
    return folder ? {
      ...folder,
      chat_ids: [...(Array.isArray(folder.chat_ids) ? folder.chat_ids : [])],
      pins: (Array.isArray(folder.pins) ? folder.pins : []).map((pin) => ({ ...pin })),
    } : null;
  }

  function chatIdFrom(chatOrId) {
    return typeof chatOrId === 'object' && chatOrId !== null
      ? Number(chatOrId.id || 0)
      : Number(chatOrId || 0);
  }

  function defaultCompareChatActivity(a, b) {
    const byLastTime = String(b && b.last_time || '').localeCompare(String(a && a.last_time || ''));
    if (byLastTime) return byLastTime;
    const byCreatedAt = String(b && b.created_at || '').localeCompare(String(a && a.created_at || ''));
    if (byCreatedAt) return byCreatedAt;
    return Number(b && b.id || 0) - Number(a && a.id || 0);
  }

  function createChatFolderStore(options = {}) {
    const opts = objectOrDefault(options);
    const config = objectOrDefault(opts.config);
    const ALL_CHATS_FOLDER_ID = allChatsFolderId(config);
    const storage = opts.storage || window.localStorage;
    const getCurrentUser = typeof opts.getCurrentUser === 'function' ? opts.getCurrentUser : () => null;
    const compareChatActivity = typeof opts.compareChatActivity === 'function'
      ? opts.compareChatActivity
      : defaultCompareChatActivity;

    let chatFolders = [];
    let loadedOnce = false;
    let loadFailed = false;
    let activeFolderId = ALL_CHATS_FOLDER_ID;

    function findInternalFolder(folderId) {
      const id = Number(folderId || 0);
      return chatFolders.find((folder) => Number(folder.id || 0) === id) || null;
    }

    class ChatFolderStore {
      get activeFolderId() {
        return activeFolderId;
      }

      set activeFolderId(value) {
        activeFolderId = normalizeChatFolderId(value, config);
      }

      get loadedOnce() {
        return loadedOnce;
      }

      get loadFailed() {
        return loadFailed;
      }

      setLoadedOnce(value) {
        loadedOnce = Boolean(value);
        return loadedOnce;
      }

      setLoadFailed(value) {
        loadFailed = Boolean(value);
        return loadFailed;
      }

      storageKey() {
        const userId = Number(getCurrentUser() && getCurrentUser().id || 0);
        return userId > 0 ? `bananza:active-chat-folder:${userId}` : '';
      }

      hydrateActiveFolderId() {
        const key = this.storageKey();
        if (!key) {
          activeFolderId = ALL_CHATS_FOLDER_ID;
          return activeFolderId;
        }
        const stored = Number(storage && typeof storage.getItem === 'function'
          ? storage.getItem(key) || ALL_CHATS_FOLDER_ID
          : ALL_CHATS_FOLDER_ID);
        activeFolderId = Number.isInteger(stored) && stored >= 0 ? stored : ALL_CHATS_FOLDER_ID;
        return activeFolderId;
      }

      persistActiveFolderId() {
        const key = this.storageKey();
        if (!key || !storage || typeof storage.setItem !== 'function') return;
        storage.setItem(key, String(activeFolderId || ALL_CHATS_FOLDER_ID));
      }

      setFolders(nextFolders = [], { persist = true } = {}) {
        chatFolders = (Array.isArray(nextFolders) ? nextFolders : [])
          .map((folder) => normalizeChatFolderEntry(folder))
          .filter((folder) => folder.id > 0)
          .sort((a, b) => {
            const byOrder = Number(a.sort_order || 0) - Number(b.sort_order || 0);
            if (byOrder) return byOrder;
            return Number(a.id || 0) - Number(b.id || 0);
          });
        loadedOnce = true;
        loadFailed = false;
        this.ensureActiveFolder();
        if (persist) this.persistActiveFolderId();
        return this.getFolders();
      }

      getFolders() {
        return chatFolders.map((folder) => cloneFolder(folder));
      }

      getFolderById(folderId) {
        return cloneFolder(findInternalFolder(folderId));
      }

      getActiveFolder() {
        return activeFolderId === ALL_CHATS_FOLDER_ID ? null : this.getFolderById(activeFolderId);
      }

      getResolvedActiveFolder() {
        return this.getActiveFolder() || null;
      }

      isAllChatsActive() {
        return Number(activeFolderId || 0) === ALL_CHATS_FOLDER_ID;
      }

      ensureActiveFolder() {
        if (this.isAllChatsActive()) {
          activeFolderId = ALL_CHATS_FOLDER_ID;
          return activeFolderId;
        }
        if (!findInternalFolder(activeFolderId)) {
          activeFolderId = ALL_CHATS_FOLDER_ID;
        }
        return activeFolderId;
      }

      setActiveFolderId(folderId, { persist = true } = {}) {
        activeFolderId = normalizeChatFolderId(folderId, config);
        this.ensureActiveFolder();
        if (persist) this.persistActiveFolderId();
        return activeFolderId;
      }

      getFolderPinOrder(folderId, chatOrId) {
        const folder = findInternalFolder(folderId);
        if (!folder) return null;
        const chatId = chatIdFrom(chatOrId);
        const pin = folder.pins.find((entry) => Number(entry.chat_id || 0) === chatId);
        const order = Number(pin && pin.pin_order || 0);
        return Number.isInteger(order) && order > 0 ? order : null;
      }

      getFolderPinnedChatOrder(folderId, chatOrId) {
        return this.getFolderPinOrder(folderId, chatOrId);
      }

      isChatInFolder(folderId, chatOrId) {
        const folder = findInternalFolder(folderId);
        if (!folder) return false;
        return folder.chat_ids.includes(chatIdFrom(chatOrId));
      }

      isChatPinnedInFolder(folderId, chatOrId) {
        return this.getFolderPinOrder(folderId, chatOrId) != null;
      }

      getFoldersForChat(chatOrId) {
        const id = chatIdFrom(chatOrId);
        if (!id) return [];
        return chatFolders
          .filter((folder) => folder.chat_ids.includes(id))
          .map((folder) => cloneFolder(folder));
      }

      getActiveChatFolder() {
        return this.getResolvedActiveFolder();
      }

      isAllChatsFolderActive() {
        return this.isAllChatsActive();
      }

      compareChatsForFolder(folderId, a, b, comparator = compareChatActivity) {
        const pinA = this.getFolderPinOrder(folderId, a);
        const pinB = this.getFolderPinOrder(folderId, b);
        const aPinned = pinA != null;
        const bPinned = pinB != null;
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        if (aPinned && bPinned && pinA !== pinB) return pinA - pinB;
        return (typeof comparator === 'function' ? comparator : defaultCompareChatActivity)(a, b);
      }

      totalUnreadForFolder(folder, chats = []) {
        const list = Array.isArray(chats) ? chats : [];
        if (!folder) {
          return list.reduce((sum, chat) => sum + Number(chat && chat.unread_count || 0), 0);
        }
        const ids = new Set(Array.isArray(folder.chat_ids) ? folder.chat_ids : []);
        return list.reduce((sum, chat) => (
          ids.has(Number(chat && chat.id || 0)) ? sum + Number(chat && chat.unread_count || 0) : sum
        ), 0);
      }

      visibleChatCountForFolder(folder, chats = []) {
        const list = Array.isArray(chats) ? chats : [];
        if (!folder) return list.length;
        const ids = new Set(Array.isArray(folder.chat_ids) ? folder.chat_ids : []);
        return list.filter((chat) => ids.has(Number(chat && chat.id || 0))).length;
      }

      folderSummaryText(folder, chats = []) {
        if (!folder) return '\u0412\u0441\u0435 \u0447\u0430\u0442\u044b';
        const count = this.visibleChatCountForFolder(folder, chats);
        const unread = this.totalUnreadForFolder(folder, chats);
        const unreadText = unread > 0 ? ` \u2022 ${unread} \u043d\u0435\u043f\u0440\u043e\u0447\u0438\u0442.` : '';
        return `${count} \u0447\u0430\u0442\u043e\u0432${unreadText}`;
      }
    }

    return new ChatFolderStore();
  }

  foldersRoot.store = {
    createChatFolderStore,
    normalizeChatFolderEntry,
    normalizeChatFolderId,
  };
})();
