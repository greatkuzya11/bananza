(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const openChatRoot = root.openChat = root.openChat || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createReadReceiptController(options = {}) {
    const opts = objectOrDefault(options);
    const api = typeof opts.api === 'function' ? opts.api : async () => ({});
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const services = objectOrDefault(opts.services);
    const cache = opts.cache || window.messageCache || null;
    const chatMemberLastReads = new Map();

    function getCurrentUser() {
      return state.getCurrentUser?.() || null;
    }

    function getCurrentChatId() {
      return Number(state.getCurrentChatId?.() || 0) || null;
    }

    function getChatById(chatId) {
      if (typeof state.getChatById === 'function') return state.getChatById(chatId);
      const id = Number(chatId || 0);
      return (state.getChats?.() || []).find((chat) => Number(chat.id) === id) || null;
    }

    function normalizeMemberLastReads(value) {
      const normalized = {};
      if (!value || typeof value !== 'object') return normalized;
      for (const [rawUserId, rawLastReadId] of Object.entries(value)) {
        const userId = Number(rawUserId);
        const lastReadId = Number(rawLastReadId);
        if (!Number.isFinite(userId) || userId <= 0) continue;
        normalized[userId] = Number.isFinite(lastReadId) && lastReadId > 0 ? Math.floor(lastReadId) : 0;
      }
      return normalized;
    }

    function getChatMemberLastReads(chatId) {
      const id = Number(chatId || 0);
      if (!Number.isFinite(id) || id <= 0) return null;
      return chatMemberLastReads.get(id) || null;
    }

    function storeChatMemberLastReads(chatId, incomingReads, { replace = false } = {}) {
      const id = Number(chatId || 0);
      if (!Number.isFinite(id) || id <= 0) return null;
      const nextReads = normalizeMemberLastReads(incomingReads);
      const merged = replace
        ? nextReads
        : { ...(chatMemberLastReads.get(id) || {}), ...nextReads };
      chatMemberLastReads.set(id, merged);
      return merged;
    }

    function clearChatMemberLastReads(chatId) {
      const id = Number(chatId || 0);
      if (!id) return false;
      return chatMemberLastReads.delete(id);
    }

    function getChatReadReceiptThreshold(chatId) {
      const reads = getChatMemberLastReads(chatId);
      const currentUserId = Number(getCurrentUser()?.id || 0);
      if (!reads || !currentUserId) return null;
      const otherReads = Object.entries(reads)
        .filter(([userId]) => Number(userId) !== currentUserId)
        .map(([, lastReadId]) => Math.max(0, Number(lastReadId) || 0));
      if (!otherReads.length) return Number.MAX_SAFE_INTEGER;
      return otherReads.reduce((min, lastReadId) => Math.min(min, lastReadId), Number.MAX_SAFE_INTEGER);
    }

    function applyOwnReadStateToMessage(msg, chatId = msg?.chat_id || msg?.chatId || getCurrentChatId()) {
      if (!msg || Number(msg.user_id || 0) !== Number(getCurrentUser()?.id || 0)) return msg;
      const threshold = getChatReadReceiptThreshold(chatId);
      if (threshold == null) return msg;
      msg.is_read = Number(msg.id || 0) <= threshold ? 1 : 0;
      return msg;
    }

    function applyOwnReadStateToMessages(chatId, messages = []) {
      if (!Array.isArray(messages)) return messages;
      messages.forEach((msg) => applyOwnReadStateToMessage(msg, chatId));
      return messages;
    }

    function updateVisibleOwnReadState(chatId = getCurrentChatId()) {
      const id = Number(chatId || 0);
      if (!id || id !== Number(getCurrentChatId() || 0)) return;
      const threshold = getChatReadReceiptThreshold(id);
      if (threshold == null) return;
      actions.updateVisibleOwnReadState?.(id, threshold);
    }

    function fallbackApplyLocalRead(chatId, lastReadId) {
      const id = Number(chatId || 0);
      const readId = Number(lastReadId || 0);
      if (!id || !readId) return false;
      const chat = getChatById(id);
      if (!chat) return false;
      const prevLastReadId = Number(chat.last_read_id || 0);
      const nextLastReadId = Math.max(prevLastReadId, readId);
      const prevUnreadCount = Number(chat.unread_count || 0);
      const prevFirstUnreadId = chat.first_unread_id ?? null;
      chat.last_read_id = nextLastReadId;
      if (!chat.last_message_id || nextLastReadId >= Number(chat.last_message_id || 0)) {
        chat.unread_count = 0;
        chat.first_unread_id = null;
      }
      return prevLastReadId !== chat.last_read_id
        || prevUnreadCount !== Number(chat.unread_count || 0)
        || prevFirstUnreadId !== (chat.first_unread_id ?? null);
    }

    function updateLocalChatReadProgress(chatId, lastReadId) {
      const chatListData = services.chatList?.data || services.chatList || null;
      if (typeof chatListData?.applyLocalRead === 'function') {
        const before = getChatById(chatId);
        const prevLastReadId = Number(before?.last_read_id || 0);
        const prevUnreadCount = Number(before?.unread_count || 0);
        const prevFirstUnreadId = before?.first_unread_id ?? null;
        chatListData.applyLocalRead(chatId, lastReadId);
        const after = getChatById(chatId);
        return Boolean(after && (
          prevLastReadId !== Number(after.last_read_id || 0)
          || prevUnreadCount !== Number(after.unread_count || 0)
          || prevFirstUnreadId !== (after.first_unread_id ?? null)
        ));
      }
      return fallbackApplyLocalRead(chatId, lastReadId);
    }

    async function reconcileChatReadState(chatId, incomingReads, { replace = false, updateVisible = false } = {}) {
      const id = Number(chatId || 0);
      if (!id) return { reads: null, chatReadChanged: false, threshold: null, applied: false };
      const hadBaseline = chatMemberLastReads.has(id);
      const reads = storeChatMemberLastReads(id, incomingReads, { replace });
      if (!reads) return { reads: null, chatReadChanged: false, threshold: null, applied: false };

      const currentUserLastRead = Number(reads[getCurrentUser()?.id] || 0);
      const chatReadChanged = currentUserLastRead > 0 ? updateLocalChatReadProgress(id, currentUserLastRead) : false;
      const threshold = getChatReadReceiptThreshold(id);
      const chat = getChatById(id);
      const safeToApply = threshold != null && (replace || hadBaseline || chat?.type === 'private');

      if (safeToApply) {
        try {
          const activeCache = opts.cache || window.messageCache || cache;
          if (activeCache && typeof activeCache.syncOwnMessageReadState === 'function') {
            await activeCache.syncOwnMessageReadState(id, threshold);
          }
        } catch (e) {}
        if (updateVisible) updateVisibleOwnReadState(id);
      }

      return { reads, chatReadChanged, threshold, applied: safeToApply };
    }

    async function markChatReadThrough(chatId, lastReadId) {
      const id = Number(chatId);
      const readId = Number(lastReadId || 0);
      if (!id || !readId) return;
      await api(`/api/chats/${id}/read`, { method: 'POST', body: { lastReadId: readId } });
      const changed = updateLocalChatReadProgress(id, readId);
      const chat = getChatById(id);
      if (chat && chat.last_message_id && readId < Number(chat.last_message_id || 0)) {
        await actions.loadChats?.().catch?.(() => {});
        return;
      }
      if (changed) actions.renderChatList?.();
    }

    function markCurrentChatReadIfAtBottom(force = false) {
      const currentChatId = getCurrentChatId();
      if (!actions.isCurrentChatActivelyVisible?.(currentChatId)) return;
      if (!force && !actions.isNearBottom?.(8)) return;
      const chat = getChatById(currentChatId);
      const readId = Number(actions.getMaxRenderedMessageId?.() || 0);
      if (!readId || (chat && Number(chat.last_read_id || 0) >= readId)) return;
      markChatReadThrough(currentChatId, readId).catch(() => {});
    }

    function getState() {
      return {
        chatMemberLastReads,
      };
    }

    return {
      applyOwnReadStateToMessage,
      applyOwnReadStateToMessages,
      clearChatMemberLastReads,
      getChatMemberLastReads,
      getChatReadReceiptThreshold,
      getState,
      markChatReadThrough,
      markCurrentChatReadIfAtBottom,
      normalizeMemberLastReads,
      reconcileChatReadState,
      storeChatMemberLastReads,
      updateLocalChatReadProgress,
      updateVisibleOwnReadState,
    };
  }

  openChatRoot.readReceipts = {
    createReadReceiptController,
  };
})();
