(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const openChatRoot = root.openChat = root.openChat || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createScrollController(options = {}) {
    const opts = objectOrDefault(options);
    const win = opts.window || window;
    const doc = opts.document || document;
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const config = objectOrDefault(opts.config);
    const storage = opts.storage || win.localStorage;
    const formatDate = typeof opts.formatDate === 'function'
      ? opts.formatDate
      : (value) => String(value || '');
    const SCROLL_DATE_HIDE_DELAY_MS = Number(config.SCROLL_DATE_HIDE_DELAY_MS || 900);

    let scrollPositions = {};
    let scrollPositionsUserKey = '';
    let suppressScrollAnchorSave = false;
    let scrollAnchorSaveTimer = null;
    let scheduledScrollAnchorSaveChatId = 0;
    let scrollDateIndicatorEl = null;
    let scrollDateUpdateFrame = 0;
    let scrollDateHideTimer = null;
    let scrollDatePendingOptions = null;
    let scrollDateLastText = '';
    const scrollRestoreTimers = new Set();

    function getMessagesEl() {
      return dom.messagesEl || doc.getElementById('messages');
    }

    function getChatView() {
      return dom.chatView || doc.getElementById('chatView');
    }

    function getScrollBottomBtn() {
      return dom.scrollBottomBtn || doc.getElementById('scrollBottomBtn');
    }

    function getCurrentChatId() {
      return Number(state.getCurrentChatId?.() || 0) || null;
    }

    function getCurrentUser() {
      return state.getCurrentUser?.() || null;
    }

    function getOpenSeq() {
      return Number(state.getOpenSeq?.() || 0);
    }

    function scrollAnchorStorageKey() {
      return getCurrentUser()?.id ? `bananza:scrollAnchors:${getCurrentUser().id}` : '';
    }

    function ensureScrollAnchorsLoaded() {
      const key = scrollAnchorStorageKey();
      if (!key || key === scrollPositionsUserKey) return;
      scrollPositionsUserKey = key;
      try {
        scrollPositions = JSON.parse(storage.getItem(key) || '{}') || {};
      } catch {
        scrollPositions = {};
      }
    }

    function persistScrollAnchors() {
      const key = scrollAnchorStorageKey();
      if (!key) return;
      scrollPositionsUserKey = key;
      storage.setItem(key, JSON.stringify(scrollPositions));
    }

    function readScrollAnchors() {
      ensureScrollAnchorsLoaded();
      return JSON.parse(JSON.stringify(scrollPositions || {}));
    }

    function getScrollAnchor(chatId) {
      ensureScrollAnchorsLoaded();
      const id = Number(chatId || 0);
      return id ? scrollPositions[id] || null : null;
    }

    function deleteScrollAnchor(chatId) {
      ensureScrollAnchorsLoaded();
      const id = Number(chatId || 0);
      if (!id || !scrollPositions[id]) return false;
      delete scrollPositions[id];
      persistScrollAnchors();
      return true;
    }

    function getRenderedMessageRows() {
      const messagesEl = getMessagesEl();
      return Array.from(messagesEl?.querySelectorAll?.('.msg-row[data-msg-id]') || []);
    }

    function ensureScrollDateIndicator() {
      const chatView = getChatView();
      if (!chatView) return null;
      if (scrollDateIndicatorEl && scrollDateIndicatorEl.isConnected) return scrollDateIndicatorEl;
      scrollDateIndicatorEl = doc.getElementById('scrollDateIndicator') || doc.createElement('div');
      scrollDateIndicatorEl.id = 'scrollDateIndicator';
      scrollDateIndicatorEl.className = 'scroll-date-indicator';
      scrollDateIndicatorEl.setAttribute('aria-hidden', 'true');
      if (!scrollDateIndicatorEl.parentElement) chatView.appendChild(scrollDateIndicatorEl);
      return scrollDateIndicatorEl;
    }

    function hideScrollDateIndicator({ immediate = false } = {}) {
      clearTimeout(scrollDateHideTimer);
      scrollDateHideTimer = null;
      if (scrollDateUpdateFrame) {
        win.cancelAnimationFrame(scrollDateUpdateFrame);
        scrollDateUpdateFrame = 0;
      }
      scrollDatePendingOptions = null;
      if (!scrollDateIndicatorEl) return;
      scrollDateIndicatorEl.classList.remove('is-visible');
      scrollDateIndicatorEl.setAttribute('aria-hidden', 'true');
      if (immediate) {
        scrollDateLastText = '';
        scrollDateIndicatorEl.textContent = '';
        scrollDateIndicatorEl.style.top = '';
        scrollDateIndicatorEl.style.maxWidth = '';
      }
    }

    function pickScrollDateMessageRow() {
      const messagesEl = getMessagesEl();
      if (!messagesEl) return null;
      const rows = getRenderedMessageRows();
      if (!rows.length) return null;
      const containerRect = messagesEl.getBoundingClientRect();
      if (!containerRect.height || containerRect.bottom <= containerRect.top) return null;
      const topProbe = containerRect.top + 8;
      const visibleBottom = containerRect.bottom - 6;
      return rows.find((row) => {
        const rect = row.getBoundingClientRect();
        return rect.bottom >= topProbe && rect.top <= visibleBottom;
      }) || null;
    }

    function getScrollDateTextForRow(row) {
      if (!row) return '';
      const createdAt = row.__messageData?.created_at || row.__messageData?.createdAt || '';
      if (createdAt) return formatDate(createdAt);
      return String(row.dataset.date || '').trim();
    }

    function positionScrollDateIndicator(el) {
      const chatView = getChatView();
      const messagesEl = getMessagesEl();
      if (!el || !chatView || !messagesEl) return;
      const chatRect = chatView.getBoundingClientRect();
      const messagesRect = messagesEl.getBoundingClientRect();
      const top = Math.max(8, Math.round((messagesRect.top || 0) - (chatRect.top || 0) + 8));
      const maxWidth = Math.max(120, Math.min(360, Math.round((messagesRect.width || chatRect.width || 0) - 24)));
      el.style.top = `${top}px`;
      el.style.maxWidth = `${maxWidth}px`;
    }

    function updateScrollDateIndicator(options = {}) {
      const show = Boolean(options.show);
      if (!getCurrentChatId()) {
        hideScrollDateIndicator({ immediate: true });
        return;
      }
      const row = pickScrollDateMessageRow();
      const text = getScrollDateTextForRow(row);
      if (!row || !text) {
        hideScrollDateIndicator({ immediate: true });
        return;
      }
      const el = ensureScrollDateIndicator();
      if (!el) return;
      positionScrollDateIndicator(el);
      if (text !== scrollDateLastText) {
        scrollDateLastText = text;
        el.textContent = text;
      }
      if (show || el.classList.contains('is-visible')) {
        el.classList.add('is-visible');
        el.setAttribute('aria-hidden', 'false');
        clearTimeout(scrollDateHideTimer);
        scrollDateHideTimer = setTimeout(() => {
          scrollDateHideTimer = null;
          hideScrollDateIndicator();
        }, SCROLL_DATE_HIDE_DELAY_MS);
      }
    }

    function scheduleScrollDateIndicatorUpdate(options = {}) {
      if (options.show) {
        clearTimeout(scrollDateHideTimer);
        scrollDateHideTimer = null;
      }
      scrollDatePendingOptions = { ...(scrollDatePendingOptions || {}), ...options };
      if (scrollDateUpdateFrame) return;
      scrollDateUpdateFrame = win.requestAnimationFrame(() => {
        const pendingOptions = scrollDatePendingOptions || {};
        scrollDatePendingOptions = null;
        scrollDateUpdateFrame = 0;
        updateScrollDateIndicator(pendingOptions);
      });
    }

    function refreshScrollDateIndicator() {
      if (!scrollDateIndicatorEl?.classList.contains('is-visible')) return;
      scheduleScrollDateIndicatorUpdate({ show: true });
    }

    function isDeletedMessageRow(row) {
      return Boolean(row?.__messageData?.is_deleted);
    }

    function pickScrollAnchorRow(rows, atBottom, containerRect) {
      const isVisible = (row) => {
        const rect = row.getBoundingClientRect();
        return rect.bottom >= containerRect.top + 6 && rect.top <= containerRect.bottom - 6;
      };
      const visibleRows = rows.filter(isVisible);
      const liveRows = rows.filter((row) => !isDeletedMessageRow(row));
      const visibleLiveRows = visibleRows.filter((row) => !isDeletedMessageRow(row));

      if (visibleLiveRows.length) {
        return atBottom ? visibleLiveRows[visibleLiveRows.length - 1] : visibleLiveRows[0];
      }
      if (liveRows.length) {
        if (atBottom) {
          return [...liveRows].reverse().find((row) => {
            const rect = row.getBoundingClientRect();
            return rect.top <= containerRect.bottom - 6;
          }) || liveRows[liveRows.length - 1];
        }
        return liveRows.find((row) => {
          const rect = row.getBoundingClientRect();
          return rect.bottom >= containerRect.top + 6;
        }) || liveRows[0];
      }
      if (visibleRows.length) {
        return atBottom ? visibleRows[visibleRows.length - 1] : visibleRows[0];
      }
      return atBottom ? rows[rows.length - 1] : rows[0];
    }

    function findRestorableAnchorRow(anchor) {
      const messagesEl = getMessagesEl();
      const messageId = Number(anchor?.messageId || 0);
      if (!messagesEl || !messageId) return null;
      const exact = messagesEl.querySelector(`[data-msg-id="${messageId}"]`);
      if (exact) return exact;

      const liveRows = getRenderedMessageRows().filter((row) => !isDeletedMessageRow(row));
      if (!liveRows.length) return null;

      let before = null;
      let after = null;
      for (const row of liveRows) {
        const rowId = Number(row.dataset.msgId) || 0;
        if (!rowId) continue;
        if (rowId < messageId) before = row;
        else if (rowId > messageId) {
          after = row;
          break;
        }
      }

      return anchor?.atBottom
        ? before || after || liveRows[liveRows.length - 1]
        : after || before || liveRows[0];
    }

    function getMaxRenderedMessageId() {
      return getRenderedMessageRows().reduce((max, row) => Math.max(max, Number(row.dataset.msgId) || 0), 0);
    }

    function isNearBottom(threshold = 150) {
      const messagesEl = getMessagesEl();
      if (!messagesEl) return true;
      return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < threshold;
    }

    function captureScrollAnchor() {
      const messagesEl = getMessagesEl();
      const rows = getRenderedMessageRows();
      if (!messagesEl || !rows.length) return null;
      const containerRect = messagesEl.getBoundingClientRect();
      const atBottom = isNearBottom(8);
      const row = pickScrollAnchorRow(rows, atBottom, containerRect);
      if (!row) return null;
      const rect = row.getBoundingClientRect();
      return {
        messageId: Number(row.dataset.msgId) || 0,
        offsetTop: Math.round(rect.top - containerRect.top),
        atBottom,
        savedAt: Date.now(),
      };
    }

    function saveCurrentScrollAnchor(chatId = getCurrentChatId(), { force = false, allowPendingMedia = false } = {}) {
      const targetChatId = Number(chatId || getCurrentChatId() || 0);
      if (!targetChatId || (!force && suppressScrollAnchorSave)) return false;
      if (
        !allowPendingMedia
        && targetChatId === Number(getCurrentChatId() || 0)
        && actions.hasPendingMediaBottomScroll?.()
      ) {
        return false;
      }
      ensureScrollAnchorsLoaded();
      const anchor = captureScrollAnchor();
      if (!anchor?.messageId) return false;
      scrollPositions[targetChatId] = anchor;
      persistScrollAnchors();
      return true;
    }

    function canCaptureCurrentChatScrollAnchor(chatId = getCurrentChatId()) {
      const targetChatId = Number(chatId || getCurrentChatId() || 0);
      const messagesEl = getMessagesEl();
      const HTMLElementCtor = win.HTMLElement || HTMLElement;
      if (!targetChatId || Number(getCurrentChatId() || 0) !== targetChatId) return false;
      if (!(messagesEl instanceof HTMLElementCtor) || !messagesEl.isConnected) return false;
      return actions.isCurrentChatActivelyVisible?.(targetChatId) !== false;
    }

    function clearScheduledScrollAnchorSave() {
      clearTimeout(scrollAnchorSaveTimer);
      scrollAnchorSaveTimer = null;
      scheduledScrollAnchorSaveChatId = 0;
    }

    function flushCurrentChatScrollAnchor(chatId = getCurrentChatId(), { force = true, allowPendingMedia = true } = {}) {
      const targetChatId = Number(chatId || getCurrentChatId() || 0);
      clearScheduledScrollAnchorSave();
      if (!targetChatId) return false;
      if (!canCaptureCurrentChatScrollAnchor(targetChatId)) return false;
      return saveCurrentScrollAnchor(targetChatId, {
        force,
        allowPendingMedia,
      });
    }

    function scheduleScrollAnchorSave() {
      const currentChatId = getCurrentChatId();
      if (suppressScrollAnchorSave || !currentChatId) return;
      const targetChatId = Number(currentChatId || 0);
      if (!targetChatId) return;
      clearScheduledScrollAnchorSave();
      scheduledScrollAnchorSaveChatId = targetChatId;
      scrollAnchorSaveTimer = setTimeout(() => {
        scrollAnchorSaveTimer = null;
        const scheduledChatId = Number(scheduledScrollAnchorSaveChatId || 0);
        scheduledScrollAnchorSaveChatId = 0;
        if (!scheduledChatId || Number(getCurrentChatId() || 0) !== scheduledChatId) return;
        saveCurrentScrollAnchor(scheduledChatId);
      }, 140);
    }

    function restoreScrollAnchor(anchor, attempts = 3, options = {}) {
      const messagesEl = getMessagesEl();
      if (!messagesEl || !anchor?.messageId) return false;
      const guardSeq = Number(options.openSeq || 0);
      const guardChatId = Number(options.chatId || getCurrentChatId() || 0);
      const isGuardCurrent = () => (
        (!guardSeq || Number(getOpenSeq() || 0) === guardSeq)
        && (!guardChatId || Number(getCurrentChatId() || 0) === guardChatId)
      );
      if (!isGuardCurrent()) return false;
      const row = findRestorableAnchorRow(anchor);
      if (!row) return false;
      const apply = () => {
        if (!isGuardCurrent()) return;
        const containerRect = messagesEl.getBoundingClientRect();
        const rect = row.getBoundingClientRect();
        messagesEl.scrollTop += (rect.top - containerRect.top) - (Number(anchor.offsetTop) || 0);
        updateScrollBottomButton();
      };
      apply();
      if (attempts > 1) {
        const timer = setTimeout(() => {
          scrollRestoreTimers.delete(timer);
          restoreScrollAnchor(anchor, attempts - 1, options);
        }, 120);
        scrollRestoreTimers.add(timer);
      }
      return true;
    }

    function cancelPendingScrollRestores() {
      scrollRestoreTimers.forEach((timer) => clearTimeout(timer));
      scrollRestoreTimers.clear();
    }

    function anchorForChatOpen(chat, scrollRestoreMode = state.getScrollRestoreMode?.()) {
      if (!chat) return null;
      ensureScrollAnchorsLoaded();
      const saved = scrollRestoreMode === 'restore' ? scrollPositions[chat.id] : null;
      if (saved?.messageId) return { ...saved, mode: 'restore' };

      const lastReadId = Number(chat.last_read_id || 0);
      const lastMessageId = Number(chat.last_message_id || 0);
      const hasUnread = Number(chat.unread_count || 0) > 0 && lastReadId < lastMessageId;
      if (hasUnread) {
        const anchorId = lastReadId || Number(chat.first_unread_id || 0);
        if (anchorId) return { messageId: anchorId, offsetTop: 72, atBottom: false, mode: 'last_read' };
      }
      return null;
    }

    function updateScrollBottomButton() {
      const scrollBottomBtn = getScrollBottomBtn();
      const messagesEl = getMessagesEl();
      if (!scrollBottomBtn || !messagesEl) return;
      const hasMessages = Boolean(messagesEl.querySelector('.msg-row'));
      const shouldShow = Boolean(getCurrentChatId() && hasMessages && (!isNearBottom(8) || actions.getHasMoreAfter?.()));
      scrollBottomBtn.classList.toggle('visible', shouldShow);
      actions.syncComposerButton?.();
    }

    function scrollToBottom(instant = false, markRead = false, options = {}) {
      const messagesEl = getMessagesEl();
      if (!messagesEl) return;
      const guardChatId = Number(options.chatId || getCurrentChatId() || 0);
      const guardSeq = Number(options.openSeq || 0);
      const isGuardCurrent = () => (
        (!guardChatId || Number(getCurrentChatId() || 0) === guardChatId)
        && (!guardSeq || Number(getOpenSeq() || 0) === guardSeq)
      );
      win.requestAnimationFrame(() => {
        if (!isGuardCurrent()) return;
        if (typeof messagesEl.scrollTo === 'function') {
          messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: instant ? 'instant' : 'smooth' });
        } else {
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
        const scrollBottomBtn = getScrollBottomBtn();
        if (scrollBottomBtn) scrollBottomBtn.classList.remove('visible');
        win.requestAnimationFrame(() => {
          if (isGuardCurrent()) updateScrollBottomButton();
        });
        if (!instant) setTimeout(() => {
          if (isGuardCurrent()) updateScrollBottomButton();
        }, 260);
        if (actions.getHasMoreAfter?.()) setTimeout(() => {
          if (isGuardCurrent()) actions.maybeLoadMoreAtBottom?.();
        }, instant ? 0 : 320);
        if (markRead) setTimeout(() => {
          if (isGuardCurrent()) actions.markCurrentChatReadIfAtBottom?.(true);
        }, instant ? 0 : 320);
      });
    }

    function setScrollAnchorSaveSuppressed(value) {
      suppressScrollAnchorSave = Boolean(value);
      return suppressScrollAnchorSave;
    }

    function isScrollAnchorSaveSuppressed() {
      return suppressScrollAnchorSave;
    }

    return {
      anchorForChatOpen,
      canCaptureCurrentChatScrollAnchor,
      cancelPendingScrollRestores,
      captureScrollAnchor,
      clearScheduledScrollAnchorSave,
      deleteScrollAnchor,
      ensureScrollAnchorsLoaded,
      ensureScrollDateIndicator,
      findRestorableAnchorRow,
      flushCurrentChatScrollAnchor,
      getMaxRenderedMessageId,
      getRenderedMessageRows,
      getScrollAnchor,
      getScrollDateTextForRow,
      hideScrollDateIndicator,
      isNearBottom,
      isScrollAnchorSaveSuppressed,
      persistScrollAnchors,
      pickScrollAnchorRow,
      pickScrollDateMessageRow,
      positionScrollDateIndicator,
      readScrollAnchors,
      refreshScrollDateIndicator,
      restoreScrollAnchor,
      saveCurrentScrollAnchor,
      scheduleScrollAnchorSave,
      scheduleScrollDateIndicatorUpdate,
      scrollAnchorStorageKey,
      scrollToBottom,
      setScrollAnchorSaveSuppressed,
      updateScrollBottomButton,
      updateScrollDateIndicator,
    };
  }

  openChatRoot.scroll = {
    createScrollController,
  };
})();
