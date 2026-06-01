(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function createOpenChatService(ctx) {
    const state = ctx?.state || {};
    const refs = {
      pages: null,
      readReceipts: null,
      scroll: null,
      mediaPlayback: null,
      controller: null,
    };

    function configure(nextRefs = {}) {
      Object.keys(refs).forEach((key) => {
        if (nextRefs[key]) refs[key] = nextRefs[key];
      });
      syncRuntimeState();
      return service;
    }

    function syncRuntimeState() {
      if (typeof state.getCurrentChat === 'function') state.currentChat = state.getCurrentChat();
      if (!Array.isArray(state.messages)) state.messages = [];
      return state;
    }

    function getController() { return refs.controller; }
    function getPages() { return refs.pages; }
    function getReadReceipts() { return refs.readReceipts; }
    function getScroll() { return refs.scroll; }
    function getMediaPlayback() { return refs.mediaPlayback; }
    function getCurrentChatId() { return state.getCurrentChatId?.() || state.currentChatId || null; }
    function getCurrentChat() { return state.getCurrentChat?.() || state.currentChat || null; }
    function getMessages() { return state.getMessages?.() || state.messages || []; }
    function setMessages(messages) {
      return state.setMessages?.(messages) || (state.messages = Array.isArray(messages) ? messages : []);
    }
    function mergeMessages(messages, options = {}) {
      return state.mergeMessages?.(messages, options) || getMessages();
    }

    function openChat(chatId, options = {}) { return refs.controller?.openChat?.(chatId, options); }
    function openChatFromPush(chatId) { return refs.controller?.openChatFromPush?.(chatId); }
    function catchUpCurrentChat(chatId, options = {}) { return refs.controller?.catchUpCurrentChat?.(chatId, options); }
    function loadMore() { return refs.controller?.loadMore?.(); }
    function loadMoreAfter() { return refs.controller?.loadMoreAfter?.(); }
    function maybeLoadMoreAtTop() { return refs.controller?.maybeLoadMoreAtTop?.(); }
    function maybeLoadMoreAtBottom() { return refs.controller?.maybeLoadMoreAtBottom?.(); }
    function updateHasMoreAfterFromChat(chatId) { return refs.controller?.updateHasMoreAfterFromChat?.(chatId); }
    function isChatOpenInProgress() { return Boolean(refs.controller?.isChatOpenInProgress?.()); }
    function isCurrentChatOpenTransition(seq, chatId) { return refs.controller?.isCurrentChatOpenTransition?.(seq, chatId); }
    function getOpenSeq() { return refs.controller?.getOpenSeq?.() || 0; }
    function getState() { return refs.controller?.getState?.() || {}; }
    function callPages(method, ...args) { return refs.pages?.[method]?.(...args); }
    function callScroll(method, ...args) { return refs.scroll?.[method]?.(...args); }
    function scrollToBottom(instant = false, markRead = false, options = {}) {
      return refs.scroll?.scrollToBottom?.(instant, markRead, options);
    }
    function isNearBottom(threshold = 150) { return refs.scroll?.isNearBottom?.(threshold); }
    function saveCurrentScrollAnchor(chatId, options = {}) { return refs.scroll?.saveCurrentScrollAnchor?.(chatId, options); }
    function flushCurrentChatScrollAnchor(chatId, options = {}) { return refs.scroll?.flushCurrentChatScrollAnchor?.(chatId, options); }
    function scheduleScrollAnchorSave() { return refs.scroll?.scheduleScrollAnchorSave?.(); }
    function restoreScrollAnchor(anchor, attempts = 3, options = {}) {
      return refs.scroll?.restoreScrollAnchor?.(anchor, attempts, options);
    }
    function markCurrentChatReadIfAtBottom(force = false) {
      return refs.readReceipts?.markCurrentChatReadIfAtBottom?.(force);
    }
    function markChatReadThrough(chatId, lastReadId) {
      return refs.readReceipts?.markChatReadThrough?.(chatId, lastReadId);
    }

    const service = {
      configure,
      syncRuntimeState,
      getController,
      getPages,
      getReadReceipts,
      getScroll,
      getMediaPlayback,
      getCurrentChatId,
      getCurrentChat,
      getMessages,
      setMessages,
      mergeMessages,
      openChat,
      openChatFromPush,
      catchUpCurrentChat,
      loadMore,
      loadMoreAfter,
      maybeLoadMoreAtTop,
      maybeLoadMoreAtBottom,
      updateHasMoreAfterFromChat,
      isChatOpenInProgress,
      isCurrentChatOpenTransition,
      getOpenSeq,
      getState,
      scrollToBottom,
      isNearBottom,
      saveCurrentScrollAnchor,
      flushCurrentChatScrollAnchor,
      scheduleScrollAnchorSave,
      restoreScrollAnchor,
      setHasMoreBefore: (value) => refs.controller?.setHasMoreBefore?.(value),
      setLoadMoreAfterLoading: (value) => refs.controller?.setLoadMoreAfterLoading?.(value),
      setHasMoreAfter: (value) => refs.controller?.setHasMoreAfter?.(value),
      getMessagesAfterLoader: () => refs.controller?.getMessagesAfterLoader?.(),
      getMessagesLastContentChild: () => refs.controller?.getMessagesLastContentChild?.(),
      insertAtMessagesEnd: (node) => refs.controller?.insertAtMessagesEnd?.(node),
      buildMessagesRootChildren: (fragment = null) => refs.controller?.buildMessagesRootChildren?.(fragment),
      messageIdKey: (id) => callPages('messageIdKey', id),
      getMessageIdNumber: (msg) => callPages('getMessageIdNumber', msg),
      minMessageId: (messages = []) => callPages('minMessageId', messages),
      maxMessageId: (messages = []) => callPages('maxMessageId', messages),
      filterNewMessages: (messages = []) => callPages('filterNewMessages', messages) || [],
      getChatLastMessageId: (chatId, fallback = 0) => callPages('getChatLastMessageId', chatId, fallback),
      cacheMessages: (chatId, messages = [], page = null, options = {}) => callPages('cacheMessages', chatId, messages, page, options),
      writeCachedChatMeta: (chatId, patch = {}) => callPages('writeCachedChatMeta', chatId, patch),
      readCachedChatRange: (chatId) => callPages('readCachedChatRange', chatId),
      debugMessageCache: (event, detail = {}) => callPages('debugMessageCache', event, detail),
      warmMessageWindowAssets: (chat, messages = []) => callPages('warmMessageWindowAssets', chat, messages),
      cacheCursorPage: (chatId, direction, cursor, messages = [], page = {}) => callPages('cacheCursorPage', chatId, direction, cursor, messages, page),
      readCachedCursorPage: (chatId, direction, cursor) => callPages('readCachedCursorPage', chatId, direction, cursor),
      scrollAnchorStorageKey: () => callScroll('scrollAnchorStorageKey'),
      ensureScrollAnchorsLoaded: () => callScroll('ensureScrollAnchorsLoaded'),
      persistScrollAnchors: () => callScroll('persistScrollAnchors'),
      getRenderedMessageRows: () => callScroll('getRenderedMessageRows') || [],
      ensureScrollDateIndicator: () => callScroll('ensureScrollDateIndicator'),
      hideScrollDateIndicator: (options = {}) => callScroll('hideScrollDateIndicator', options),
      pickScrollDateMessageRow: () => callScroll('pickScrollDateMessageRow'),
      getScrollDateTextForRow: (row) => callScroll('getScrollDateTextForRow', row),
      positionScrollDateIndicator: (el) => callScroll('positionScrollDateIndicator', el),
      updateScrollDateIndicator: (options = {}) => callScroll('updateScrollDateIndicator', options),
      scheduleScrollDateIndicatorUpdate: (options = {}) => callScroll('scheduleScrollDateIndicatorUpdate', options),
      refreshScrollDateIndicator: () => callScroll('refreshScrollDateIndicator'),
      pickScrollAnchorRow: (rows, atBottom, containerRect) => callScroll('pickScrollAnchorRow', rows, atBottom, containerRect),
      findRestorableAnchorRow: (anchor) => callScroll('findRestorableAnchorRow', anchor),
      getMaxRenderedMessageId: () => callScroll('getMaxRenderedMessageId') || 0,
      captureScrollAnchor: () => callScroll('captureScrollAnchor'),
      canCaptureCurrentChatScrollAnchor: (chatId) => callScroll('canCaptureCurrentChatScrollAnchor', chatId),
      clearScheduledScrollAnchorSave: () => callScroll('clearScheduledScrollAnchorSave'),
      anchorForChatOpen: (chat, scrollRestoreMode) => callScroll('anchorForChatOpen', chat, scrollRestoreMode),
      markCurrentChatReadIfAtBottom,
      markChatReadThrough,
    };

    return service;
  }

  bootRoot.createOpenChatService = createOpenChatService;
})();
