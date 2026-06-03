(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const messagesRoot = root.messages = root.messages || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function defaultMessageIdKey(id) {
    const key = String(id ?? '').trim();
    return key || '';
  }

  function createMessageState(options = {}) {
    const opts = objectOrDefault(options);
    const messageIdKey = typeof opts.messageIdKey === 'function' ? opts.messageIdKey : defaultMessageIdKey;

    const displayedMsgIds = new Set();
    const displayedPinEventIds = new Set();
    const displayedSystemEventIds = new Set();
    const pendingVideoPosterBackfills = new Map();
    const failedVideoPosterBackfills = new Set();
    const outboxObjectUrls = new Map();
    const outboxSending = new Set();
    const pendingMediaBottomScrollRows = new Set();
    let retryLayoutTimer = null;
    let mediaBottomAutoScrollUserIntentAt = 0;

    function pinEventIdKey(id) {
      const key = String(id ?? '').trim();
      return key || '';
    }

    function systemEventIdKey(id) {
      const key = String(id ?? '').trim();
      return key || '';
    }

    function normalizeSystemEvent(raw = {}) {
      const id = Number(raw.id || raw.event_id || 0);
      const chatId = Number(raw.chat_id || raw.chatId || opts.currentChatId || 0);
      const eventType = String(raw.event_type || raw.eventType || '').trim();
      if (!id || !chatId || !eventType) return null;
      return {
        id,
        chat_id: chatId,
        event_type: eventType,
        actor_id: raw.actor_id == null && raw.actorId == null ? null : Number(raw.actor_id || raw.actorId || 0),
        actor_name: raw.actor_name || raw.actorName || '',
        target_user_id: raw.target_user_id == null && raw.targetUserId == null ? null : Number(raw.target_user_id || raw.targetUserId || 0),
        target_user_name: raw.target_user_name || raw.targetUserName || '',
        target_is_ai_bot: Number(raw.target_is_ai_bot || raw.targetIsAiBot || 0) ? 1 : 0,
        metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
        created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
      };
    }

    function normalizeSystemEvents(events = []) {
      const seen = new Set();
      return (Array.isArray(events) ? events : []).map(normalizeSystemEvent).filter((event) => {
        if (!event || seen.has(event.id)) return false;
        seen.add(event.id);
        return true;
      });
    }

    function rememberDisplayedMessage(id) {
      const key = messageIdKey(id);
      if (key) displayedMsgIds.add(key);
    }

    function forgetDisplayedMessage(id) {
      const key = messageIdKey(id);
      if (key) displayedMsgIds.delete(key);
    }

    function isMessageDisplayed(id) {
      const key = messageIdKey(id);
      return key ? displayedMsgIds.has(key) : false;
    }

    function rememberDisplayedPinEvent(id) {
      const key = pinEventIdKey(id);
      if (key) displayedPinEventIds.add(key);
    }

    function isPinEventDisplayed(id) {
      const key = pinEventIdKey(id);
      return key ? displayedPinEventIds.has(key) : false;
    }

    function rememberDisplayedSystemEvent(id) {
      const key = systemEventIdKey(id);
      if (key) displayedSystemEventIds.add(key);
    }

    function isSystemEventDisplayed(id) {
      const key = systemEventIdKey(id);
      return key ? displayedSystemEventIds.has(key) : false;
    }

    function outboxUrlKey(clientId, part = 'file') {
      return `${clientId}:${part}`;
    }

    function getOutboxObjectUrl(clientId, blob, part = 'file') {
      if (!blob) return '';
      const key = outboxUrlKey(clientId, part);
      if (outboxObjectUrls.has(key)) return outboxObjectUrls.get(key);
      const url = URL.createObjectURL(blob);
      outboxObjectUrls.set(key, url);
      return url;
    }

    function revokeOutboxObjectUrls(clientId) {
      const prefix = `${clientId}:`;
      for (const [key, url] of outboxObjectUrls.entries()) {
        if (!key.startsWith(prefix)) continue;
        try { URL.revokeObjectURL(url); } catch (e) {}
        outboxObjectUrls.delete(key);
      }
    }

    function setOutboxSending(clientId, sending) {
      if (!clientId) return;
      if (sending) outboxSending.add(clientId);
      else outboxSending.delete(clientId);
    }

    function isOutboxSending(clientId) {
      return outboxSending.has(clientId);
    }

    function setRetryLayoutTimer(timerId) {
      retryLayoutTimer = timerId || null;
      return retryLayoutTimer;
    }

    function clearRetryLayoutTimer() {
      clearTimeout(retryLayoutTimer);
      retryLayoutTimer = null;
    }

    function markPendingMediaBottomScroll(row) {
      if (row) pendingMediaBottomScrollRows.add(row);
    }

    function clearPendingMediaBottomScroll(row) {
      if (row) pendingMediaBottomScrollRows.delete(row);
    }

    function clearPendingMediaBottomScrollRows() {
      pendingMediaBottomScrollRows.clear();
    }

    function getPendingMediaBottomScrollRows() {
      return Array.from(pendingMediaBottomScrollRows);
    }

    return {
      displayedMsgIds,
      displayedPinEventIds,
      displayedSystemEventIds,
      pendingVideoPosterBackfills,
      failedVideoPosterBackfills,
      outboxObjectUrls,
      outboxSending,
      pendingMediaBottomScrollRows,
      rememberDisplayedMessage,
      forgetDisplayedMessage,
      isMessageDisplayed,
      getDisplayedMessageIds: () => Array.from(displayedMsgIds),
      clearDisplayedMessages: () => displayedMsgIds.clear(),
      rememberDisplayedPinEvent,
      isPinEventDisplayed,
      clearDisplayedPinEvents: () => displayedPinEventIds.clear(),
      rememberDisplayedSystemEvent,
      isSystemEventDisplayed,
      clearDisplayedSystemEvents: () => displayedSystemEventIds.clear(),
      normalizeSystemEvent,
      normalizeSystemEvents,
      outboxUrlKey,
      getOutboxObjectUrl,
      revokeOutboxObjectUrls,
      setOutboxSending,
      isOutboxSending,
      getOutboxSendingIds: () => Array.from(outboxSending),
      setRetryLayoutTimer,
      clearRetryLayoutTimer,
      getRetryLayoutTimer: () => retryLayoutTimer,
      markPendingMediaBottomScroll,
      clearPendingMediaBottomScroll,
      clearPendingMediaBottomScrollRows,
      hasPendingMediaBottomScroll: () => pendingMediaBottomScrollRows.size > 0,
      getPendingMediaBottomScrollRows,
      noteMediaBottomAutoScrollUserIntent: () => {
        mediaBottomAutoScrollUserIntentAt = Date.now();
      },
      getMediaBottomAutoScrollUserIntentAt: () => mediaBottomAutoScrollUserIntentAt,
    };
  }

  messagesRoot.state = {
    createMessageState,
  };
})();
