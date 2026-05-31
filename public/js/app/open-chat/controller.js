(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const openChatRoot = root.openChat = root.openChat || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createOpenChatController(options = {}) {
    const opts = objectOrDefault(options);
    const win = opts.window || window;
    const doc = opts.document || document;
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const services = objectOrDefault(opts.services);
    const config = objectOrDefault(opts.config);
    const pages = opts.pages;
    const readReceipts = opts.readReceipts;
    const scroll = opts.scroll;
    const mediaPlayback = opts.mediaPlayback;

    const PAGE_SIZE = Number(config.PAGE_SIZE || 50);
    const MESSAGE_BACKGROUND_SYNC_CONCURRENCY = Number(config.MESSAGE_BACKGROUND_SYNC_CONCURRENCY || 2);
    const MESSAGE_BACKGROUND_SYNC_MAX_CHATS = Number(config.MESSAGE_BACKGROUND_SYNC_MAX_CHATS || 6);
    const MESSAGE_BACKGROUND_SYNC_MAX_PAGES = Number(config.MESSAGE_BACKGROUND_SYNC_MAX_PAGES || 3);
    const RECOVERY_CATCHUP_MAX_PAGES = Number(config.RECOVERY_CATCHUP_MAX_PAGES || 5);
    const PAGINATION_FETCH_MAX_PAGES = Number(config.PAGINATION_FETCH_MAX_PAGES || 6);
    const PAGINATION_TOP_THRESHOLD = Number(config.PAGINATION_TOP_THRESHOLD || 120);
    const PAGINATION_BOTTOM_THRESHOLD = Number(config.PAGINATION_BOTTOM_THRESHOLD || 120);

    let loadingMore = false;
    let loadingMoreAfter = false;
    let hasMore = true;
    let hasMoreAfter = false;
    let chatOpenSeq = 0;
    let chatMessageAbortController = null;
    let chatOpenInProgress = false;
    let messageBackgroundSyncTimer = null;
    let messageBackgroundSyncRunning = false;
    let messageBackgroundSyncRequested = false;
    const messageBackgroundSyncInFlight = new Set();

    function getMessagesEl() {
      return dom.messagesEl || doc.getElementById('messages');
    }

    function getCurrentChatId() {
      return Number(state.getCurrentChatId?.() || 0) || null;
    }

    function setCurrentChatId(chatId) {
      const id = Number(chatId || 0);
      if (typeof state.setCurrentChatId === 'function') return state.setCurrentChatId(id > 0 ? id : null);
      return null;
    }

    function getCurrentUser() {
      return state.getCurrentUser?.() || null;
    }

    function getChats() {
      return state.getChats?.() || [];
    }

    function getChatById(chatId) {
      if (typeof state.getChatById === 'function') return state.getChatById(chatId);
      const id = Number(chatId || 0);
      return getChats().find((chat) => Number(chat.id) === id) || null;
    }

    function getCache() {
      return opts.cache || window.messageCache || null;
    }

    function renderChatList() {
      actions.renderChatList?.(state.getChatSearchValue?.() || '');
    }

    function setHasMoreBefore(value) {
      hasMore = Boolean(value);
      dom.loadMoreWrap?.classList?.toggle('hidden', !hasMore);
    }

    function setLoadMoreAfterLoading(value) {
      if (!dom.loadMoreAfterWrap) return;
      const loading = Boolean(value);
      dom.loadMoreAfterWrap.classList.toggle('hidden', !loading);
      dom.loadMoreAfterWrap.setAttribute('aria-hidden', loading ? 'false' : 'true');
    }

    function setHasMoreAfter(value) {
      hasMoreAfter = Boolean(value);
      if (!hasMoreAfter) setLoadMoreAfterLoading(false);
      scroll.updateScrollBottomButton();
    }

    function getMessagesAfterLoader() {
      const messagesEl = getMessagesEl();
      return dom.loadMoreAfterWrap && dom.loadMoreAfterWrap.parentElement === messagesEl ? dom.loadMoreAfterWrap : null;
    }

    function getMessagesLastContentChild() {
      const messagesEl = getMessagesEl();
      const afterLoader = getMessagesAfterLoader();
      return afterLoader ? afterLoader.previousElementSibling : messagesEl?.lastElementChild || null;
    }

    function insertAtMessagesEnd(node) {
      const messagesEl = getMessagesEl();
      if (!messagesEl || !node) return;
      messagesEl.insertBefore(node, getMessagesAfterLoader());
    }

    function buildMessagesRootChildren(fragment = null) {
      const children = [];
      if (dom.loadMoreWrap) children.push(dom.loadMoreWrap);
      if (fragment) children.push(fragment);
      if (dom.loadMoreAfterWrap) children.push(dom.loadMoreAfterWrap);
      return children;
    }

    function updateHasMoreAfterFromChat(chatId = getCurrentChatId()) {
      const chat = getChatById(chatId);
      const lastMessageId = Number(chat?.last_message_id || 0);
      const maxRenderedId = scroll.getMaxRenderedMessageId();
      setHasMoreAfter(Boolean(lastMessageId && maxRenderedId && maxRenderedId < lastMessageId));
    }

    function maybeLoadMoreAtTop() {
      const messagesEl = getMessagesEl();
      if (
        !scroll.isScrollAnchorSaveSuppressed()
        && messagesEl
        && messagesEl.scrollTop < PAGINATION_TOP_THRESHOLD
        && hasMore
        && !loadingMore
        && !loadingMoreAfter
      ) {
        loadMore();
        return true;
      }
      return false;
    }

    function maybeLoadMoreAtBottom() {
      if (
        !scroll.isScrollAnchorSaveSuppressed()
        && hasMoreAfter
        && !loadingMoreAfter
        && !loadingMore
        && scroll.isNearBottom(PAGINATION_BOTTOM_THRESHOLD)
      ) {
        loadMoreAfter();
        return true;
      }
      return false;
    }

    function isCurrentChatOpenTransition(seq, chatId = getCurrentChatId()) {
      return Number(seq || 0) === Number(chatOpenSeq || 0)
        && Number(chatId || 0) === Number(getCurrentChatId() || 0);
    }

    function isChatOpenInProgress() {
      return Boolean(chatOpenInProgress);
    }

    function beginChatOpenTransition(chatId) {
      chatOpenSeq += 1;
      const seq = chatOpenSeq;
      if (chatMessageAbortController) {
        try { chatMessageAbortController.abort(); } catch (e) {}
      }
      scroll.cancelPendingScrollRestores();
      chatMessageAbortController = new AbortController();
      chatOpenInProgress = true;
      actions.setChatHydrating?.(true);
      return { seq, controller: chatMessageAbortController, chatId: Number(chatId || 0) };
    }

    function endChatOpenTransition(seq, chatId = getCurrentChatId()) {
      if (!isCurrentChatOpenTransition(seq, chatId)) return false;
      chatOpenInProgress = false;
      chatMessageAbortController = null;
      actions.setChatHydrating?.(false);
      actions.flushDeferredRecoverySync?.();
      return true;
    }

    async function openChat(chatId, options = {}) {
      const targetChatId = Number(chatId);
      const chat = getChatById(targetChatId);
      if (!chat) {
        throw new Error('Chat not found in local list');
      }
      const previousChatId = Number(getCurrentChatId() || 0);
      const sameChat = previousChatId === targetChatId;
      if (!sameChat) actions.closeChatHeaderActions?.();
      const explicitAnchorId = Number(options?.anchorMessageId || 0);
      const suppressHistoryPush = Boolean(options?.suppressHistoryPush);
      const { seq, controller } = beginChatOpenTransition(targetChatId);
      let restoreAnchor = null;
      let cachedMsgs = [];
      let cachedRange = null;
      let committedWindow = false;
      let postOpenScheduled = false;
      const openStartedAt = win.performance?.now?.() || Date.now();
      const isCurrentOpen = () => isCurrentChatOpenTransition(seq, targetChatId);

      const applyOpenScroll = () => {
        const messagesEl = getMessagesEl();
        if (!messagesEl || !isCurrentOpen()) return;
        if (restoreAnchor?.atBottom) {
          messagesEl.scrollTop = messagesEl.scrollHeight;
          scroll.updateScrollBottomButton();
        } else if (restoreAnchor?.messageId) {
          if (!scroll.restoreScrollAnchor(restoreAnchor, 1, { openSeq: seq, chatId: targetChatId })) {
            messagesEl.scrollTop = 0;
            scroll.updateScrollBottomButton();
          }
        } else {
          messagesEl.scrollTop = messagesEl.scrollHeight;
          scroll.updateScrollBottomButton();
        }
      };

      const commitMessageWindow = async (msgs = [], page = null, { source = 'network', pinEvents = [] } = {}) => {
        if (!isCurrentOpen()) return false;
        const list = Array.isArray(msgs) ? msgs : [];
        const shouldAutoScrollRenderedMedia = Boolean(restoreAnchor?.atBottom || !restoreAnchor?.messageId);
        const firstId = pages.minMessageId(list);
        const lastId = pages.maxMessageId(list);
        const cacheHasMoreBefore = firstId !== Number.MAX_SAFE_INTEGER
          && firstId > 1
          && (restoreAnchor?.messageId ? true : list.length >= PAGE_SIZE);
        const networkHasMoreBefore = restoreAnchor?.messageId ? list.length > 0 : list.length >= PAGE_SIZE;
        const fallbackHasMoreAfter = Boolean(
          restoreAnchor?.messageId
          && chat?.last_message_id
          && lastId
          && lastId < Number(chat.last_message_id || 0)
        );

        setHasMoreBefore(page?.hasMoreBefore ?? (source === 'cache' ? cacheHasMoreBefore : networkHasMoreBefore));
        setHasMoreAfter(page?.hasMoreAfter ?? fallbackHasMoreAfter);
        actions.replaceRenderedMessages?.(list, {
          pinEvents,
          mediaAutoScrollToBottom: shouldAutoScrollRenderedMedia,
        });
        if (!isCurrentOpen()) return false;
        committedWindow = true;
        actions.renderOutboxForChat?.(targetChatId)?.catch?.(() => {});
        return true;
      };

      const revealCommittedWindow = () => {
        if (!isCurrentOpen()) return;
        actions.revealActiveMobileChatRoute?.({ suppressHistoryPush, chatId: targetChatId });
        applyOpenScroll();
        actions.revealChatHydration?.(seq, targetChatId);
        finishVisibleOpen();
        schedulePostOpenWork();
      };

      const finishVisibleOpen = () => {
        if (!isCurrentOpen()) return;
        actions.clearReply?.();
        if (state.hasEdit?.()) actions.clearEdit?.({ clearInput: true, draftChatId: previousChatId || targetChatId });
        actions.restoreComposerDraft?.(targetChatId);
        actions.syncMentionOpenButton?.();
        actions.loadContextConvertAvailability?.(targetChatId)?.catch?.(() => {});
        actions.loadChatShotState?.(targetChatId)?.catch?.(() => {});
        actions.syncChatShotButton?.();
        if (!actions.isMobileLayoutViewport?.()) dom.msgInput?.focus?.();
        actions.refreshPollComposerActionState?.();
        actions.refreshVoiceComposerState?.();
        scroll.updateScrollBottomButton();
        try { win.localStorage?.setItem?.('lastChat', targetChatId); } catch (e) {}
      };

      const schedulePostOpenWork = () => {
        if (postOpenScheduled) return;
        postOpenScheduled = true;
        win.requestAnimationFrame(() => {
          if (!isCurrentOpen()) return;
          scroll.updateScrollBottomButton();
          setTimeout(() => {
            if (!isCurrentOpen()) return;
            scroll.setScrollAnchorSaveSuppressed(false);
            scroll.saveCurrentScrollAnchor(targetChatId, { force: true });
            maybeLoadMoreAtTop();
            maybeLoadMoreAtBottom();
            readReceipts.markCurrentChatReadIfAtBottom(false);
            endChatOpenTransition(seq, targetChatId);
          }, 260);
        });
      };

      const reconcileFetchedPage = async ({ raw, page, messages: msgs, memberLastReads }) => {
        const readState = await readReceipts.reconcileChatReadState(targetChatId, memberLastReads, {
          replace: true,
          updateVisible: getCurrentChatId() === targetChatId,
        });
        if (!isCurrentOpen()) return false;
        if (readState.chatReadChanged) renderChatList();
        readReceipts.applyOwnReadStateToMessages(targetChatId, msgs);
        await pages.cacheMessages(targetChatId, msgs || [], page, {
          writeEmptyMeta: true,
          lastKnownServerId: pages.getChatLastMessageId(targetChatId, pages.maxMessageId(msgs)),
        });
        if (raw && !Array.isArray(raw) && (!msgs || !msgs.length)) {
          await pages.writeCachedChatMeta(targetChatId, {
            maxId: cachedRange?.maxId || pages.maxMessageId(cachedMsgs),
            hasMoreAfter: page.hasMoreAfter,
            lastKnownServerId: pages.getChatLastMessageId(targetChatId, cachedRange?.maxId || pages.maxMessageId(cachedMsgs)),
          });
        }
        return true;
      };

      const fetchFullWindow = async () => {
        const networkStartedAt = win.performance?.now?.() || Date.now();
        pages.debugMessageCache('network-window-start', {
          chatId: targetChatId,
          elapsedMs: Math.round(networkStartedAt - openStartedAt),
          anchor: restoreAnchor?.messageId || null,
        });
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        params.set('meta', '1');
        if (restoreAnchor?.messageId && !restoreAnchor?.atBottom) params.set('anchor', String(restoreAnchor.messageId));
        const result = await pages.fetchMessagesPage(targetChatId, params, { signal: controller.signal });
        pages.debugMessageCache('network-window-done', {
          chatId: targetChatId,
          fetchMs: Math.round((win.performance?.now?.() || Date.now()) - networkStartedAt),
          count: result.messages?.length || 0,
        });
        const { page, messages: msgs, pinEvents } = result;
        if (!isCurrentOpen()) return false;
        if (!await reconcileFetchedPage(result)) return false;
        if (!isCurrentOpen()) return false;
        if (committedWindow && actions.renderedMessageIdsMatch?.(msgs) && !pinEvents.length) {
          setHasMoreBefore(page.hasMoreBefore ?? (restoreAnchor?.messageId ? msgs.length > 0 : msgs.length >= PAGE_SIZE));
          setHasMoreAfter(page.hasMoreAfter ?? Boolean(restoreAnchor?.messageId && chat?.last_message_id && pages.maxMessageId(msgs) < Number(chat.last_message_id || 0)));
          actions.renderOutboxForChat?.(targetChatId)?.catch?.(() => {});
          if (!isCurrentOpen()) return false;
        } else {
          if (!await commitMessageWindow(msgs, page, { source: 'network', pinEvents })) return false;
        }
        pages.warmMessageWindowAssets(chat, msgs);
        revealCommittedWindow();
        return true;
      };

      const syncNewMessagesAfter = async (initialCursor, { maxPages = RECOVERY_CATCHUP_MAX_PAGES, lightOnly = false } = {}) => {
        let cursor = Number(initialCursor || 0);
        if (!cursor) return false;
        let appendedAny = false;
        for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
          if (!isCurrentOpen()) return appendedAny;
          const params = new URLSearchParams({
            limit: String(lightOnly ? 1 : PAGE_SIZE),
            meta: '1',
            after: String(cursor),
          });
          const result = await pages.fetchMessagesPage(targetChatId, params, { signal: controller.signal });
          const { page, messages: msgs, pinEvents } = result;
          if (!await reconcileFetchedPage(result)) return appendedAny;
          if (!isCurrentOpen()) return appendedAny;

          if (!msgs.length) {
            await pages.writeCachedChatMeta(targetChatId, {
              maxId: cursor,
              hasMoreAfter: page.hasMoreAfter ?? false,
              lastKnownServerId: pages.getChatLastMessageId(targetChatId, cursor),
            });
            setHasMoreAfter(page.hasMoreAfter ?? false);
            return appendedAny;
          }

          const newMessages = pages.filterNewMessages(msgs);
          const newPinEvents = actions.filterNewPinEvents?.(pinEvents) || [];
          if (newMessages.length || newPinEvents.length) {
            const wasNearBottom = scroll.isNearBottom(120);
            const anchor = wasNearBottom ? null : scroll.captureScrollAnchor();
            actions.appendTimelineItems?.(newMessages, newPinEvents, {
              mediaAutoScrollToBottom: Boolean(wasNearBottom),
            });
            if (newMessages.length) actions.updateChatListLastMessage?.(newMessages[newMessages.length - 1]);
            if (wasNearBottom) {
              scroll.scrollToBottom(false, true);
            } else if (anchor?.messageId) {
              win.requestAnimationFrame(() => scroll.restoreScrollAnchor(anchor, 1, { openSeq: seq, chatId: targetChatId }));
            }
            appendedAny = true;
          }

          const fetchedLastId = pages.maxMessageId(msgs);
          setHasMoreAfter(page.hasMoreAfter ?? Boolean(fetchedLastId && pages.getChatLastMessageId(targetChatId, fetchedLastId) > fetchedLastId));
          if (!fetchedLastId || fetchedLastId <= cursor || !(page.hasMoreAfter ?? (msgs.length >= PAGE_SIZE))) break;
          cursor = fetchedLastId;
          if (lightOnly) break;
        }
        if (appendedAny && isCurrentOpen()) scroll.saveCurrentScrollAnchor(targetChatId, { force: true });
        return appendedAny;
      };

      const syncCachedOpenInBackground = async () => {
        try {
          const refreshed = await fetchFullWindow();
          if (!refreshed || !isCurrentOpen()) return;
          const renderedMax = scroll.getMaxRenderedMessageId();
          const serverLastId = pages.getChatLastMessageId(targetChatId, renderedMax);
          if (serverLastId > renderedMax) {
            await syncNewMessagesAfter(renderedMax, { maxPages: RECOVERY_CATCHUP_MAX_PAGES });
          }
        } catch (error) {
          if (!actions.isAbortError?.(error)) updateHasMoreAfterFromChat(targetChatId);
        }
      };

      if (previousChatId) {
        scroll.flushCurrentChatScrollAnchor(previousChatId, { force: true, allowPendingMedia: true });
      }
      if (previousChatId && !sameChat) {
        actions.saveComposerDraft?.(previousChatId);
        actions.clearPendingFile?.();
        mediaPlayback.pauseCurrentChatMediaPlayback();
      }
      actions.closeTransientUi?.();

      setCurrentChatId(targetChatId);
      if (state.hasEdit?.()) actions.clearEdit?.({ clearInput: true, draftChatId: previousChatId || targetChatId });
      actions.restoreComposerDraft?.(targetChatId);
      actions.clearDisplayedTimelineState?.();
      hasMore = false;
      setHasMoreAfter(false);
      scroll.setScrollAnchorSaveSuppressed(true);
      actions.setChatHydrating?.(true);

      dom.emptyState?.classList?.add('hidden');
      dom.chatView?.classList?.remove('hidden');
      win.requestAnimationFrame(() => actions.syncChatAreaMetrics?.());

      dom.chatList?.querySelectorAll?.('.chat-item[data-chat-id]').forEach((el) => {
        el.classList.toggle('active', Number(el.dataset.chatId) === targetChatId);
      });

      restoreAnchor = explicitAnchorId
        ? { messageId: explicitAnchorId, offsetTop: 72, atBottom: false, mode: sameChat ? 'search_same_chat' : 'search' }
        : scroll.anchorForChatOpen(chat, state.getScrollRestoreMode?.());
      actions.renderCurrentChatHeader?.(chat);
      actions.renderPinnedBar?.(targetChatId);
      actions.loadChatPins?.(targetChatId)?.catch?.(() => {});
      actions.updateChatStatus?.();
      actions.applyChatBackground?.(chat);

      const compactView = Boolean(state.getCompactViewMap?.()?.[targetChatId]);
      state.setCompactView?.(compactView);
      getMessagesEl()?.classList?.toggle('compact-view', compactView);
      dom.loadMoreWrap?.classList?.add('hidden');
      setLoadMoreAfterLoading(false);

      try {
        const cache = getCache();
        if (cache) {
          const cacheStartedAt = win.performance?.now?.() || Date.now();
          cachedRange = await pages.readCachedChatRange(targetChatId);
          mediaPlayback.primeMediaPlaybackCompletedCache(targetChatId, cachedRange).catch(() => {});
          const preferLatestCachedWindow = !restoreAnchor?.messageId || restoreAnchor?.atBottom;
          cachedMsgs = preferLatestCachedWindow
            ? await cache.readLatest(targetChatId, { limit: PAGE_SIZE })
            : await cache.readAround(targetChatId, restoreAnchor.messageId, { limit: PAGE_SIZE });
          const cacheReadMs = Math.round((win.performance?.now?.() || Date.now()) - cacheStartedAt);
          const hasAnchorInCache = !restoreAnchor?.messageId || restoreAnchor?.atBottom
            || cachedMsgs.some((msg) => Number(msg?.id || 0) === Number(restoreAnchor.messageId));
          const hasCachedWindowMeta = cachedRange?.windowCached === true
            || typeof cachedRange?.hasMoreBefore === 'boolean'
            || typeof cachedRange?.hasMoreAfter === 'boolean';
          const cachedMinId = Number(cachedRange?.minId || pages.minMessageId(cachedMsgs) || 0);
          const cacheLooksLikeWindow = hasCachedWindowMeta
            || cachedMsgs.length >= PAGE_SIZE
            || (cachedMinId > 0 && cachedMinId <= 1);
          pages.debugMessageCache(cacheLooksLikeWindow && cachedMsgs.length && hasAnchorInCache ? 'hit' : 'miss', {
            chatId: targetChatId,
            cacheReadMs,
            count: cachedMsgs.length,
            windowCached: cachedRange?.windowCached === true,
            hasCachedWindowMeta,
            hasAnchorInCache,
            anchor: restoreAnchor?.messageId || null,
          });
          if (isCurrentOpen() && Array.isArray(cachedMsgs) && cachedMsgs.length && hasAnchorInCache && cacheLooksLikeWindow) {
            readReceipts.applyOwnReadStateToMessages(targetChatId, cachedMsgs);
            await commitMessageWindow(cachedMsgs, {
              hasMoreBefore: typeof cachedRange?.hasMoreBefore === 'boolean' ? cachedRange.hasMoreBefore : null,
              hasMoreAfter: typeof cachedRange?.hasMoreAfter === 'boolean'
                ? cachedRange.hasMoreAfter
                : Boolean(pages.getChatLastMessageId(targetChatId, pages.maxMessageId(cachedMsgs)) > pages.maxMessageId(cachedMsgs)),
            }, { source: 'cache' });
            pages.warmMessageWindowAssets(chat, cachedMsgs);
            revealCommittedWindow();
            syncCachedOpenInBackground();
            return;
          }
        }
      } catch (e) {}

      try {
        await fetchFullWindow();
      } catch (error) {
        if (actions.isAbortError?.(error) || !isCurrentOpen()) return;
        if (!committedWindow) {
          if (Array.isArray(cachedMsgs) && cachedMsgs.length) {
            readReceipts.applyOwnReadStateToMessages(targetChatId, cachedMsgs);
            if (!await commitMessageWindow(cachedMsgs, null, { source: 'cache' })) return;
          } else {
            actions.renderOutboxForChat?.(targetChatId)?.catch?.(() => {});
            if (!isCurrentOpen()) return;
          }
        }
        revealCommittedWindow();
      }
    }

    async function loadMore() {
      const messagesEl = getMessagesEl();
      const currentChatId = getCurrentChatId();
      if (loadingMore || loadingMoreAfter || !hasMore || !currentChatId || !messagesEl) return;
      const chatId = currentChatId;
      const firstMsg = messagesEl.querySelector('.msg-row[data-msg-id]');
      const firstId = firstMsg ? Number(firstMsg.dataset.msgId || 0) : 0;
      if (!firstId) {
        setHasMoreBefore(false);
        return;
      }

      loadingMore = true;
      if (dom.loadMoreBtn) dom.loadMoreBtn.textContent = 'Loading...';

      try {
        let cursor = firstId;
        let prependedAny = false;
        let scrollTopBefore = 0;
        let scrollHeightBefore = 0;

        for (let pageIndex = 0; pageIndex < PAGINATION_FETCH_MAX_PAGES; pageIndex += 1) {
          let page = await pages.readCachedCursorPage(chatId, 'before', cursor);
          let msgs = page?.messages || [];
          if (!page) {
            const params = new URLSearchParams({ limit: String(PAGE_SIZE), meta: '1', before: String(cursor) });
            const result = await pages.fetchMessagesPage(chatId, params);
            page = result.page;
            msgs = page.messages;
            const readState = await readReceipts.reconcileChatReadState(chatId, result.memberLastReads, {
              replace: true,
              updateVisible: getCurrentChatId() === chatId,
            });
            if (readState.chatReadChanged) renderChatList();
            pages.cacheCursorPage(chatId, 'before', cursor, msgs, page);
          }
          readReceipts.applyOwnReadStateToMessages(chatId, msgs);
          if (getCurrentChatId() !== chatId) return;

          const hasMoreBeforeValue = page.hasMoreBefore ?? msgs.length >= PAGE_SIZE;
          setHasMoreBefore(hasMoreBeforeValue);

          const newMessages = pages.filterNewMessages(msgs);
          const newPinEvents = actions.filterNewPinEvents?.(page.pinEvents || []) || [];
          if (newMessages.length || newPinEvents.length) {
            scrollTopBefore = messagesEl.scrollTop;
            scrollHeightBefore = messagesEl.scrollHeight;
            actions.renderMessages?.(newMessages, { pinEvents: newPinEvents });
            actions.cleanupDuplicateDateSeparators?.();
            if (newMessages.length) await pages.cacheMessages(chatId, msgs, page);
            prependedAny = true;
            break;
          }

          const fetchedFirstId = pages.minMessageId(msgs);
          if (!fetchedFirstId || fetchedFirstId >= cursor || !hasMoreBeforeValue) break;
          cursor = fetchedFirstId;
        }

        if (prependedAny) {
          messagesEl.scrollTop = scrollTopBefore + (messagesEl.scrollHeight - scrollHeightBefore);
          scroll.saveCurrentScrollAnchor(getCurrentChatId(), { force: true });
          if (hasMore && messagesEl.scrollTop < PAGINATION_TOP_THRESHOLD) {
            win.requestAnimationFrame(() => maybeLoadMoreAtTop());
          }
        } else {
          scroll.updateScrollBottomButton();
        }
      } catch (e) {
        console.warn('[pagination] loadMore failed:', e?.message || e);
      } finally {
        loadingMore = false;
        if (dom.loadMoreBtn) dom.loadMoreBtn.textContent = 'Load earlier messages';
      }
    }

    async function loadMoreAfter() {
      const messagesEl = getMessagesEl();
      const currentChatId = getCurrentChatId();
      if (loadingMoreAfter || loadingMore || !hasMoreAfter || !currentChatId || !messagesEl) return;
      const chatId = currentChatId;
      const lastId = scroll.getMaxRenderedMessageId();
      if (!lastId) {
        setHasMoreAfter(false);
        return;
      }

      loadingMoreAfter = true;
      setLoadMoreAfterLoading(true);
      try {
        let cursor = lastId;
        let appendedAny = false;
        let bottomOffsetBefore = 0;

        for (let pageIndex = 0; pageIndex < PAGINATION_FETCH_MAX_PAGES; pageIndex += 1) {
          let page = await pages.readCachedCursorPage(chatId, 'after', cursor);
          let msgs = page?.messages || [];
          if (!page) {
            const params = new URLSearchParams({ limit: String(PAGE_SIZE), meta: '1', after: String(cursor) });
            const result = await pages.fetchMessagesPage(chatId, params);
            page = result.page;
            msgs = page.messages;
            const readState = await readReceipts.reconcileChatReadState(chatId, result.memberLastReads, {
              replace: true,
              updateVisible: getCurrentChatId() === chatId,
            });
            if (readState.chatReadChanged) renderChatList();
            pages.cacheCursorPage(chatId, 'after', cursor, msgs, page);
          }

          readReceipts.applyOwnReadStateToMessages(chatId, msgs);
          if (getCurrentChatId() !== chatId) return;

          const hasMoreAfterValue = page.hasMoreAfter ?? msgs.length >= PAGE_SIZE;
          setHasMoreAfter(hasMoreAfterValue);

          const newMessages = pages.filterNewMessages(msgs);
          const newPinEvents = actions.filterNewPinEvents?.(page.pinEvents || []) || [];
          if (newMessages.length || newPinEvents.length) {
            bottomOffsetBefore = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
            actions.appendTimelineItems?.(newMessages, newPinEvents, {
              mediaAutoScrollToBottom: bottomOffsetBefore <= 8,
            });
            if (newMessages.length) await pages.cacheMessages(chatId, msgs, page);
            appendedAny = true;
            break;
          }

          const fetchedLastId = pages.maxMessageId(msgs);
          if (!fetchedLastId || fetchedLastId <= cursor || !hasMoreAfterValue) break;
          cursor = fetchedLastId;
        }

        if (appendedAny) {
          messagesEl.scrollTop = Math.max(0, messagesEl.scrollHeight - messagesEl.clientHeight - bottomOffsetBefore);
          scroll.saveCurrentScrollAnchor(getCurrentChatId(), { force: true });
          if (hasMoreAfter && scroll.isNearBottom(PAGINATION_BOTTOM_THRESHOLD)) {
            win.requestAnimationFrame(() => maybeLoadMoreAtBottom());
          }
        }
      } catch (e) {
        console.warn('[pagination] loadMoreAfter failed:', e?.message || e);
      } finally {
        loadingMoreAfter = false;
        setLoadMoreAfterLoading(false);
        scroll.updateScrollBottomButton();
      }
    }

    async function catchUpCurrentChat(chatId, { fromPush = false } = {}) {
      const id = Number(chatId || 0);
      if (!id || Number(getCurrentChatId() || 0) !== id) return false;
      if (actions.isUiTransitionBusy?.()) {
        actions.markRecoveryRequested?.(fromPush ? 'push' : 'catch-up');
        return false;
      }

      if (loadingMore || loadingMoreAfter) {
        actions.markRecoveryRequested?.(fromPush ? 'push' : 'catch-up');
        return false;
      }

      const initialLastId = scroll.getMaxRenderedMessageId();
      if (!initialLastId) {
        await openChat(id, { suppressHistoryPush: true });
        return true;
      }

      const wasNearBottom = scroll.isNearBottom(120);
      const anchor = wasNearBottom ? null : scroll.captureScrollAnchor();
      let cursor = initialLastId;
      let appendedAny = false;
      let hasMoreAfterValue = false;

      loadingMoreAfter = true;
      try {
        for (let pageIndex = 0; pageIndex < RECOVERY_CATCHUP_MAX_PAGES; pageIndex += 1) {
          if (Number(getCurrentChatId() || 0) !== id) return appendedAny;

          const params = new URLSearchParams({ limit: String(PAGE_SIZE), meta: '1', after: String(cursor) });
          const result = await pages.fetchMessagesPage(id, params);
          const page = result.page;
          const msgs = page.messages || [];
          const pinEvents = page.pinEvents || [];

          const readState = await readReceipts.reconcileChatReadState(id, result.memberLastReads, {
            replace: true,
            updateVisible: Number(getCurrentChatId() || 0) === id,
          });
          if (readState.chatReadChanged) renderChatList();

          readReceipts.applyOwnReadStateToMessages(id, msgs);
          if (Number(getCurrentChatId() || 0) !== id) return appendedAny;

          const newMessages = pages.filterNewMessages(msgs);
          const newPinEvents = actions.filterNewPinEvents?.(pinEvents) || [];
          if (newMessages.length || newPinEvents.length) {
            actions.appendTimelineItems?.(newMessages, newPinEvents, {
              mediaAutoScrollToBottom: Boolean(wasNearBottom && !doc.hidden),
            });
            if (newMessages.length) actions.updateChatListLastMessage?.(newMessages[newMessages.length - 1]);
            appendedAny = true;
          } else if (fromPush && msgs.length) {
            actions.updateChatListLastMessage?.(msgs[msgs.length - 1]);
          }

          if (msgs.length) await pages.cacheMessages(id, msgs, page);

          const fetchedLastId = pages.maxMessageId(msgs);
          hasMoreAfterValue = page.hasMoreAfter ?? (msgs.length >= PAGE_SIZE);
          if (!fetchedLastId || fetchedLastId <= cursor || !hasMoreAfterValue) break;
          cursor = fetchedLastId;
        }
      } catch (e) {
        if (Number(getCurrentChatId() || 0) === id) updateHasMoreAfterFromChat(id);
        return appendedAny;
      } finally {
        loadingMoreAfter = false;
      }

      if (Number(getCurrentChatId() || 0) !== id) return appendedAny;

      const chat = getChatById(id);
      const renderedLastId = scroll.getMaxRenderedMessageId();
      const hasMoreFromChat = Boolean(
        chat?.last_message_id && renderedLastId && renderedLastId < Number(chat.last_message_id || 0)
      );
      setHasMoreAfter(Boolean(hasMoreAfterValue || hasMoreFromChat));

      if (appendedAny) {
        actions.cleanupDuplicateDateSeparators?.();
        if (wasNearBottom && !doc.hidden) {
          scroll.scrollToBottom(true, true);
        } else {
          if (anchor) win.requestAnimationFrame(() => scroll.restoreScrollAnchor(anchor, 2));
          scroll.saveCurrentScrollAnchor(id, { force: true });
          scroll.updateScrollBottomButton();
        }
      } else {
        scroll.updateScrollBottomButton();
      }

      return appendedAny;
    }

    function shouldBackgroundSyncMessages() {
      return Boolean(
        state.getToken?.()
        && getCurrentUser()
        && services.chatList?.store?.isInitialChatLoadFinished?.()
        && !doc.hidden
        && !actions.isUiTransitionBusy?.()
      );
    }

    function selectBackgroundMessageSyncChats() {
      const indexed = (Array.isArray(getChats()) ? getChats() : [])
        .map((chat, index) => ({ chat, index }))
        .filter(({ chat }) => Number(chat?.id || 0) > 0 && Number(chat?.last_message_id || 0) > 0)
        .filter(({ chat }) => Number(chat.id) !== Number(getCurrentChatId() || 0));
      indexed.sort((a, b) => {
        const score = (item) => {
          const chat = item.chat;
          let value = 0;
          if (Number(chat.unread_count || 0) > 0) value += 1000;
          if (actions.isChatPinned?.(chat)) value += 500;
          value += Math.max(0, 100 - item.index);
          return value;
        };
        return score(b) - score(a);
      });
      return indexed.slice(0, MESSAGE_BACKGROUND_SYNC_MAX_CHATS).map((item) => item.chat);
    }

    async function syncChatMessagesInBackground(chat, { allowColdPrewarm = false } = {}) {
      const chatId = Number(chat?.id || 0);
      const serverLastId = Number(chat?.last_message_id || 0);
      if (!chatId || !serverLastId || Number(getCurrentChatId() || 0) === chatId) return false;
      if (messageBackgroundSyncInFlight.has(chatId)) return false;
      messageBackgroundSyncInFlight.add(chatId);
      try {
        const range = await pages.readCachedChatRange(chatId);
        const cachedMax = Number(range?.maxId || 0);
        if (cachedMax && serverLastId <= cachedMax) {
          await pages.writeCachedChatMeta(chatId, {
            maxId: cachedMax,
            lastKnownServerId: serverLastId,
            hasMoreAfter: false,
          });
          return false;
        }

        if (!cachedMax) {
          const shouldPrewarm = Boolean(allowColdPrewarm);
          if (!shouldPrewarm) return false;
          const params = new URLSearchParams({ limit: String(PAGE_SIZE), meta: '1' });
          const result = await pages.fetchMessagesPage(chatId, params);
          const msgs = result.messages || [];
          const readState = await readReceipts.reconcileChatReadState(chatId, result.memberLastReads, { replace: true, updateVisible: false });
          if (readState.chatReadChanged) renderChatList();
          readReceipts.applyOwnReadStateToMessages(chatId, msgs);
          await pages.cacheMessages(chatId, msgs, result.page, {
            writeEmptyMeta: true,
            lastKnownServerId: serverLastId,
          });
          pages.warmMessageWindowAssets(chat, msgs);
          return msgs.length > 0;
        }

        let cursor = cachedMax;
        let wroteAny = false;
        for (let pageIndex = 0; pageIndex < MESSAGE_BACKGROUND_SYNC_MAX_PAGES; pageIndex += 1) {
          if (!shouldBackgroundSyncMessages()) break;
          const params = new URLSearchParams({ limit: String(PAGE_SIZE), meta: '1', after: String(cursor) });
          const result = await pages.fetchMessagesPage(chatId, params);
          const msgs = result.messages || [];
          const readState = await readReceipts.reconcileChatReadState(chatId, result.memberLastReads, { replace: true, updateVisible: false });
          if (readState.chatReadChanged) renderChatList();
          readReceipts.applyOwnReadStateToMessages(chatId, msgs);
          await pages.cacheMessages(chatId, msgs, result.page, {
            writeEmptyMeta: true,
            lastKnownServerId: serverLastId,
          });
          if (!msgs.length) {
            await pages.writeCachedChatMeta(chatId, {
              maxId: cursor,
              lastKnownServerId: serverLastId,
              hasMoreAfter: result.page.hasMoreAfter ?? false,
            });
            break;
          }
          pages.warmMessageWindowAssets(chat, msgs);
          wroteAny = true;
          const fetchedLastId = pages.maxMessageId(msgs);
          if (!fetchedLastId || fetchedLastId <= cursor || !(result.page.hasMoreAfter ?? (msgs.length >= PAGE_SIZE))) break;
          cursor = fetchedLastId;
        }
        return wroteAny;
      } catch (e) {
        return false;
      } finally {
        messageBackgroundSyncInFlight.delete(chatId);
      }
    }

    function scheduleMessageBackgroundSync(delayMs = 450) {
      clearTimeout(messageBackgroundSyncTimer);
      messageBackgroundSyncTimer = setTimeout(() => {
        messageBackgroundSyncTimer = null;
        runMessageBackgroundSync().catch(() => {});
      }, Math.max(0, Number(delayMs) || 0));
    }

    async function runMessageBackgroundSync() {
      if (messageBackgroundSyncRunning) {
        messageBackgroundSyncRequested = true;
        return;
      }
      if (!shouldBackgroundSyncMessages()) {
        scheduleMessageBackgroundSync(1200);
        return;
      }
      messageBackgroundSyncRunning = true;
      messageBackgroundSyncRequested = false;
      try {
        const queue = selectBackgroundMessageSyncChats();
        let cursor = 0;
        const workers = Array.from({ length: Math.min(MESSAGE_BACKGROUND_SYNC_CONCURRENCY, queue.length) }, async () => {
          while (cursor < queue.length && shouldBackgroundSyncMessages()) {
            const queueIndex = cursor++;
            const chat = queue[queueIndex];
            const allowColdPrewarm = queueIndex < 2 || Number(chat?.unread_count || 0) > 0 || actions.isChatPinned?.(chat);
            await syncChatMessagesInBackground(chat, { allowColdPrewarm });
          }
        });
        await Promise.all(workers);
      } finally {
        messageBackgroundSyncRunning = false;
        if (messageBackgroundSyncRequested) scheduleMessageBackgroundSync(900);
      }
    }

    function clearMessageBackgroundSyncTimer() {
      clearTimeout(messageBackgroundSyncTimer);
      messageBackgroundSyncTimer = null;
    }

    async function openChatFromPush(chatId) {
      const id = Number(chatId);
      if (!Number.isInteger(id) || id <= 0) return;
      if (!getChatById(id)) await actions.loadChats?.();
      if (getChatById(id)) await openChat(id);
    }

    function getState() {
      return {
        chatOpenInProgress,
        chatOpenSeq,
        hasMore,
        hasMoreAfter,
        loadingMore,
        loadingMoreAfter,
        messageBackgroundSyncRequested,
        messageBackgroundSyncRunning,
      };
    }

    return {
      buildMessagesRootChildren,
      catchUpCurrentChat,
      clearMessageBackgroundSyncTimer,
      getMessagesAfterLoader,
      getMessagesLastContentChild,
      getOpenSeq: () => chatOpenSeq,
      getState,
      hasMoreAfter: () => hasMoreAfter,
      insertAtMessagesEnd,
      isChatOpenInProgress,
      isCurrentChatOpenTransition,
      isLoadingMore: () => loadingMore,
      isLoadingMoreAfter: () => loadingMoreAfter,
      loadMore,
      loadMoreAfter,
      maybeLoadMoreAtBottom,
      maybeLoadMoreAtTop,
      openChat,
      openChatFromPush,
      runMessageBackgroundSync,
      scheduleMessageBackgroundSync,
      setHasMoreAfter,
      setHasMoreBefore,
      setLoadMoreAfterLoading,
      shouldBackgroundSyncMessages,
      syncChatMessagesInBackground,
      updateHasMoreAfterFromChat,
    };
  }

  openChatRoot.controller = {
    createOpenChatController,
  };
})();
