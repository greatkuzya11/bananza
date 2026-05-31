(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const openChatRoot = root.openChat = root.openChat || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function toPositiveNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function createMessagePagesController(options = {}) {
    const opts = objectOrDefault(options);
    const config = objectOrDefault(opts.config);
    const attachments = objectOrDefault(opts.attachments || root.attachments);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const storage = opts.storage || window.localStorage;
    const api = typeof opts.api === 'function' ? opts.api : async () => ({});
    const cacheAssets = typeof opts.cacheAssets === 'function'
      ? opts.cacheAssets
      : (urls) => window.cacheAssets?.(urls);
    const MESSAGE_CACHE_LIMIT = Number(config.MESSAGE_CACHE_LIMIT || 800);

    function getCache() {
      return opts.cache || window.messageCache || null;
    }

    function getAttachmentPreviewUrl(source) {
      if (typeof attachments.getAttachmentPreviewUrl === 'function') {
        return attachments.getAttachmentPreviewUrl(source);
      }
      if (!source) return '';
      if (typeof source === 'string') return `/uploads/${encodeURIComponent(source)}/preview`;
      return source.client_file_url || (source.file_stored ? `/uploads/${encodeURIComponent(source.file_stored)}/preview` : '');
    }

    function normalizePinEvent(raw = {}) {
      if (typeof actions.normalizePinEvent === 'function') return actions.normalizePinEvent(raw);
      const id = toPositiveNumber(raw.id || raw.event_id);
      const chatId = toPositiveNumber(raw.chat_id || raw.chatId || state.getCurrentChatId?.());
      const messageId = toPositiveNumber(raw.message_id || raw.messageId);
      if (!id || !chatId || !messageId) return null;
      return {
        id,
        chat_id: chatId,
        message_id: messageId,
        action: raw.action === 'unpinned' ? 'unpinned' : 'pinned',
        actor_id: raw.actor_id == null && raw.actorId == null ? null : Number(raw.actor_id || raw.actorId || 0),
        actor_name: raw.actor_name || raw.actorName || '',
        message_author_id: raw.message_author_id == null && raw.messageAuthorId == null ? null : Number(raw.message_author_id || raw.messageAuthorId || 0),
        message_author_name: raw.message_author_name || raw.messageAuthorName || '',
        message_preview: raw.message_preview || raw.messagePreview || raw.preview_text || '',
        created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
      };
    }

    function normalizePinEvents(events = []) {
      if (typeof actions.normalizePinEvents === 'function') return actions.normalizePinEvents(events);
      const seen = new Set();
      return (Array.isArray(events) ? events : [])
        .map(normalizePinEvent)
        .filter((event) => {
          if (!event || event.action !== 'pinned' || seen.has(event.id)) return false;
          seen.add(event.id);
          return true;
        });
    }

    function normalizeMessagesPage(data) {
      if (Array.isArray(data)) return { messages: data, pinEvents: [], hasMoreBefore: null, hasMoreAfter: null };
      if (data && Array.isArray(data.messages)) {
        return {
          messages: data.messages,
          pinEvents: normalizePinEvents(data.pin_events || data.pinEvents || []),
          hasMoreBefore: typeof data.has_more_before === 'boolean' ? data.has_more_before : null,
          hasMoreAfter: typeof data.has_more_after === 'boolean' ? data.has_more_after : null,
        };
      }
      return { messages: [], pinEvents: [], hasMoreBefore: false, hasMoreAfter: false };
    }

    async function fetchMessagesPage(chatId, params, { signal = null } = {}) {
      const query = params instanceof URLSearchParams ? params : new URLSearchParams(params || {});
      const queryText = query.toString();
      const raw = await api(`/api/chats/${chatId}/messages${queryText ? `?${queryText}` : ''}`, signal ? { signal } : {});
      const page = normalizeMessagesPage(raw);
      return {
        raw,
        page,
        messages: page.messages || [],
        pinEvents: page.pinEvents || [],
        memberLastReads: raw && (raw.member_last_reads || raw.memberLastReads) ? (raw.member_last_reads || raw.memberLastReads) : null,
      };
    }

    function messageIdKey(id) {
      const key = String(id ?? '').trim();
      return key || '';
    }

    function getMessageIdNumber(msg) {
      const id = Number(msg?.id || 0);
      return Number.isFinite(id) && id > 0 ? id : 0;
    }

    function minMessageId(messages = []) {
      return (Array.isArray(messages) ? messages : []).reduce((min, msg) => {
        const id = getMessageIdNumber(msg);
        return id ? Math.min(min, id) : min;
      }, Number.MAX_SAFE_INTEGER);
    }

    function maxMessageId(messages = []) {
      return (Array.isArray(messages) ? messages : []).reduce((max, msg) => Math.max(max, getMessageIdNumber(msg)), 0);
    }

    function filterNewMessages(messages = []) {
      const seen = new Set();
      const isMessageDisplayed = typeof actions.isMessageDisplayed === 'function'
        ? actions.isMessageDisplayed
        : () => false;
      return (Array.isArray(messages) ? messages : []).filter((msg) => {
        const key = messageIdKey(msg?.id);
        if (!key || seen.has(key) || isMessageDisplayed(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function getChatLastMessageId(chatId, fallback = 0) {
      const chat = state.getChatById?.(chatId) || actions.getChatById?.(chatId) || null;
      const value = Number(chat?.last_message_id || 0);
      return Number.isFinite(value) && value > 0 ? value : Number(fallback || 0);
    }

    function cacheMessages(chatId, messages = [], page = null, options = {}) {
      if (!Array.isArray(messages)) return Promise.resolve(false);
      const list = messages.filter(Boolean);
      if (!list.length && !options.writeEmptyMeta) return Promise.resolve(false);
      const lastKnownServerId = Number(options.lastKnownServerId || 0)
        || getChatLastMessageId(chatId, maxMessageId(list));
      try {
        const cache = getCache();
        const write = cache?.writeWindow?.(chatId, list, {
          limit: MESSAGE_CACHE_LIMIT,
          hasMoreBefore: page?.hasMoreBefore,
          hasMoreAfter: page?.hasMoreAfter,
          lastKnownServerId,
          replaceRange: Boolean(options.replaceRange),
        });
        return Promise.resolve(write).catch(() => false);
      } catch (e) {
        return Promise.resolve(false);
      }
    }

    function writeCachedChatMeta(chatId, patch = {}) {
      try {
        const cache = getCache();
        const write = cache?.writeChatMeta?.(chatId, {
          ...patch,
          lastKnownServerId: patch.lastKnownServerId || getChatLastMessageId(chatId, patch.maxId),
        });
        return Promise.resolve(write).catch(() => null);
      } catch (e) {
        return Promise.resolve(null);
      }
    }

    async function readCachedChatRange(chatId) {
      try {
        const cache = getCache();
        const range = await cache?.getCachedRange?.(chatId);
        if (range) return range;
        return await cache?.readChatMeta?.(chatId);
      } catch (e) {
        return null;
      }
    }

    function cacheCursorPage(chatId, direction, cursor, messages = [], page = {}) {
      if (!Array.isArray(messages) || !messages.length || !cursor) return;
      try {
        getCache()?.writePage?.(chatId, {
          direction,
          cursor,
          messages,
          hasMoreBefore: page.hasMoreBefore,
          hasMoreAfter: page.hasMoreAfter,
          limit: MESSAGE_CACHE_LIMIT,
        })?.catch?.(() => {});
      } catch (e) {}
    }

    async function readCachedCursorPage(chatId, direction, cursor) {
      try {
        const page = await getCache()?.readPage?.(chatId, direction, cursor);
        if (page?.complete && Array.isArray(page.messages) && page.messages.length) return page;
      } catch (e) {}
      return null;
    }

    function debugMessageCache(event, detail = {}) {
      try {
        if (storage?.getItem?.('bananza:debugMessageCache') !== '1') return;
        console.info('[message-cache]', event, detail);
      } catch (e) {}
    }

    function warmMessageWindowAssets(chat, messages = []) {
      if (typeof cacheAssets !== 'function') return;
      (async () => {
        try {
          const assetUrls = new Set();
          if (chat?.background_url) assetUrls.add(chat.background_url);
          for (const message of messages || []) {
            if (message.avatar_url) assetUrls.add(message.avatar_url);
            if (message.file_type === 'image' && message.file_stored) assetUrls.add(getAttachmentPreviewUrl(message));
          }
          await cacheAssets(Array.from(assetUrls).slice(0, 24));
        } catch (e) {}
      })();
    }

    return {
      cacheCursorPage,
      cacheMessages,
      debugMessageCache,
      fetchMessagesPage,
      filterNewMessages,
      getChatLastMessageId,
      getMessageIdNumber,
      maxMessageId,
      messageIdKey,
      minMessageId,
      normalizeMessagesPage,
      readCachedChatRange,
      readCachedCursorPage,
      warmMessageWindowAssets,
      writeCachedChatMeta,
    };
  }

  openChatRoot.pages = {
    createMessagePagesController,
  };
})();
