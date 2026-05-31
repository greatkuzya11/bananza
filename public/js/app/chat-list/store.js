(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const chatListRoot = root.chatList = root.chatList || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function localChatPreferenceEnabled(value) {
    return value !== false && value !== 0;
  }

  function getChatPinOrder(chat) {
    const order = Number(chat && chat.chat_list_pin_order);
    return Number.isFinite(order) && order > 0 ? Math.floor(order) : null;
  }

  function normalizeChatListEntry(chat = {}) {
    const source = objectOrDefault(chat);
    const next = {
      ...source,
      id: Number(source.id || 0),
      private_user: source.private_user ? { ...source.private_user } : null,
    };
    const pinOrder = getChatPinOrder(next);
    next.chat_list_pin_order = pinOrder;
    next.is_pinned = pinOrder != null;
    if (Object.prototype.hasOwnProperty.call(next, 'notify_enabled')) {
      next.notify_enabled = localChatPreferenceEnabled(next.notify_enabled);
    }
    if (Object.prototype.hasOwnProperty.call(next, 'sounds_enabled')) {
      next.sounds_enabled = localChatPreferenceEnabled(next.sounds_enabled);
    }
    return next;
  }

  function compareChatActivity(a, b) {
    if (a && a.last_time && b && b.last_time) {
      const byLastTime = String(b.last_time).localeCompare(String(a.last_time));
      if (byLastTime) return byLastTime;
    } else if (a && a.last_time) {
      return -1;
    } else if (b && b.last_time) {
      return 1;
    }
    const byCreatedAt = String(b && b.created_at || '').localeCompare(String(a && a.created_at || ''));
    if (byCreatedAt) return byCreatedAt;
    return Number(b && b.id || 0) - Number(a && a.id || 0);
  }

  function compareChatsForList(a, b) {
    const pinA = getChatPinOrder(a);
    const pinB = getChatPinOrder(b);
    const aPinned = pinA != null;
    const bPinned = pinB != null;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned && pinA !== pinB) return pinA - pinB;
    return compareChatActivity(a, b);
  }

  function normalizeCachedChats(rawChats, options = {}) {
    const opts = objectOrDefault(options);
    const compare = typeof opts.compareChatsForList === 'function' ? opts.compareChatsForList : compareChatsForList;
    return (Array.isArray(rawChats) ? rawChats : [])
      .filter((chat) => Number(chat && chat.id || 0) > 0)
      .map((chat) => normalizeChatListEntry(chat))
      .sort(compare);
  }

  function getChatSearchHaystack(chat) {
    return [
      chat && chat.name || '',
      chat && chat.private_user && chat.private_user.display_name || '',
      chat && chat.private_user && chat.private_user.username || '',
      chat && chat.private_user && chat.private_user.ai_bot_mention || '',
      chat && chat.private_user && chat.private_user.ai_bot_model || '',
    ].join(' ').toLowerCase();
  }

  function getChatLastPreviewText(chat) {
    if (chat && chat.last_text) {
      return (chat.last_user ? `${chat.last_user}: ` : '') + chat.last_text;
    }
    if (chat && chat.last_file_id) {
      return (chat.last_user ? `${chat.last_user}: ` : '') + '\uD83D\uDCCE File';
    }
    return '';
  }

  function createChatListStore(options = {}) {
    const opts = objectOrDefault(options);
    const compare = typeof opts.compareChatsForList === 'function' ? opts.compareChatsForList : compareChatsForList;
    const chats = Array.isArray(opts.chats) ? opts.chats : [];
    const allUsers = Array.isArray(opts.allUsers) ? opts.allUsers : [];
    const onlineUsers = opts.onlineUsers instanceof Set ? opts.onlineUsers : new Set();

    let chatListLoadedOnce = false;
    let initialChatLoadFinished = false;
    let chatListRequestSeq = 0;
    let chatListAbortController = null;
    let hiddenChatSearchTimer = null;
    let hiddenChatSearchSeq = 0;
    let hiddenChatSearchQuery = '';
    let hiddenChatSearchResults = [];

    function normalizeList(nextChats) {
      return normalizeCachedChats(nextChats, { compareChatsForList: compare });
    }

    function setArrayContents(target, source) {
      target.splice(0, target.length, ...(Array.isArray(source) ? source : []));
      return target;
    }

    function setSetContents(target, values) {
      target.clear();
      (Array.isArray(values) ? values : Array.from(values || [])).forEach((value) => {
        const id = Number(value || 0);
        if (Number.isFinite(id) && id > 0) target.add(id);
      });
      return target;
    }

    function clearHiddenChatSearchTimer() {
      if (hiddenChatSearchTimer) clearTimeout(hiddenChatSearchTimer);
      hiddenChatSearchTimer = null;
      return hiddenChatSearchTimer;
    }

    return {
      getChats: () => chats,
      getMutableChats: () => chats,
      setChats(nextChats) {
        return setArrayContents(chats, normalizeList(nextChats));
      },
      getChatById(chatId) {
        const id = Number(chatId || 0);
        return chats.find((chat) => Number(chat && chat.id || 0) === id) || null;
      },
      patchChat(chatId, patch = {}) {
        const id = Number(chatId || patch.id || 0);
        if (!id) return null;
        const index = chats.findIndex((chat) => Number(chat && chat.id || 0) === id);
        if (index < 0) return null;
        chats[index] = normalizeChatListEntry({
          ...chats[index],
          ...objectOrDefault(patch),
          id,
        });
        chats.sort(compare);
        return chats.find((chat) => Number(chat && chat.id || 0) === id) || null;
      },
      removeChat(chatId) {
        const id = Number(chatId || 0);
        if (!id) return false;
        const before = chats.length;
        for (let index = chats.length - 1; index >= 0; index -= 1) {
          if (Number(chats[index] && chats[index].id || 0) === id) chats.splice(index, 1);
        }
        return chats.length !== before;
      },
      getAllUsers: () => allUsers,
      getMutableAllUsers: () => allUsers,
      setAllUsers(users) {
        return setArrayContents(allUsers, Array.isArray(users) ? users : []);
      },
      getOnlineUsers: () => onlineUsers,
      getMutableOnlineUsers: () => onlineUsers,
      setOnlineUsers(userIds) {
        return setSetContents(onlineUsers, userIds);
      },
      isLoadedOnce: () => chatListLoadedOnce,
      setLoadedOnce(value) {
        chatListLoadedOnce = Boolean(value);
        return chatListLoadedOnce;
      },
      isInitialChatLoadFinished: () => initialChatLoadFinished,
      setInitialChatLoadFinished(value) {
        initialChatLoadFinished = Boolean(value);
        return initialChatLoadFinished;
      },
      nextChatListRequestSeq() {
        chatListRequestSeq += 1;
        return chatListRequestSeq;
      },
      getChatListRequestSeq: () => chatListRequestSeq,
      isCurrentChatListRequest(requestId) {
        return Number(requestId || 0) === chatListRequestSeq;
      },
      getChatListAbortController: () => chatListAbortController,
      setChatListAbortController(controller) {
        chatListAbortController = controller || null;
        return chatListAbortController;
      },
      abortChatListRequest() {
        const controller = chatListAbortController;
        if (controller && typeof controller.abort === 'function') {
          try { controller.abort(); } catch {}
        }
        chatListAbortController = null;
        return controller;
      },
      clearChatListAbortController(controller = chatListAbortController) {
        if (!controller || chatListAbortController === controller) chatListAbortController = null;
        return chatListAbortController;
      },
      getHiddenChatSearchTimer: () => hiddenChatSearchTimer,
      setHiddenChatSearchTimer(timer) {
        hiddenChatSearchTimer = timer || null;
        return hiddenChatSearchTimer;
      },
      clearHiddenChatSearchTimer,
      nextHiddenChatSearchSeq() {
        hiddenChatSearchSeq += 1;
        return hiddenChatSearchSeq;
      },
      getHiddenChatSearchSeq: () => hiddenChatSearchSeq,
      isCurrentHiddenChatSearch(requestId) {
        return Number(requestId || 0) === hiddenChatSearchSeq;
      },
      getHiddenChatSearchQuery: () => hiddenChatSearchQuery,
      setHiddenChatSearchQuery(query) {
        hiddenChatSearchQuery = String(query || '').trim().toLowerCase();
        return hiddenChatSearchQuery;
      },
      getHiddenChatSearchResults: () => hiddenChatSearchResults,
      setHiddenChatSearchResults(results) {
        return setArrayContents(hiddenChatSearchResults, normalizeList(results));
      },
      setHiddenChatSearch(query, results) {
        hiddenChatSearchQuery = String(query || '').trim().toLowerCase();
        setArrayContents(hiddenChatSearchResults, normalizeList(results));
        return {
          query: hiddenChatSearchQuery,
          results: hiddenChatSearchResults,
        };
      },
      resetHiddenChatSearch({ incrementSeq = true, clearTimer = true } = {}) {
        if (clearTimer) clearHiddenChatSearchTimer();
        if (incrementSeq) hiddenChatSearchSeq += 1;
        hiddenChatSearchQuery = '';
        hiddenChatSearchResults.splice(0, hiddenChatSearchResults.length);
        return {
          query: hiddenChatSearchQuery,
          results: hiddenChatSearchResults,
        };
      },
    };
  }

  chatListRoot.store = {
    createChatListStore,
    compareChatActivity,
    compareChatsForList,
    getChatLastPreviewText,
    getChatPinOrder,
    getChatSearchHaystack,
    localChatPreferenceEnabled,
    normalizeCachedChats,
    normalizeChatListEntry,
  };
})();

