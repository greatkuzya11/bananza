(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};
  const compositionRoot = bootRoot.composition = bootRoot.composition || {};

  compositionRoot.composeOpenChat = function composeOpenChat(scope = {}) {
    with (scope) {
      const openChatPagesFactory = window.BananzaApp?.openChat?.pages?.createMessagePagesController;
      const readReceiptFactory = window.BananzaApp?.openChat?.readReceipts?.createReadReceiptController;
      const scrollControllerFactory = window.BananzaApp?.openChat?.scroll?.createScrollController;
      const mediaPlaybackFactory = window.BananzaApp?.openChat?.mediaPlayback?.createMediaPlaybackController;
      const openChatControllerFactory = window.BananzaApp?.openChat?.controller?.createOpenChatController;
      const documentRuntimeFactory = window.BananzaApp?.documents?.createDocumentRuntime;
      if (typeof openChatPagesFactory !== 'function'
        || typeof readReceiptFactory !== 'function'
        || typeof scrollControllerFactory !== 'function'
        || typeof mediaPlaybackFactory !== 'function'
        || typeof openChatControllerFactory !== 'function'
        || typeof documentRuntimeFactory !== 'function') {
        throw new Error('BananzaApp open-chat modules are required before app.js');
      }
    
      let openChatController = null;
      const openChatPagesController = openChatPagesFactory({
        window,
        document,
        api: (url, opts) => api(url, opts),
        attachments: attachmentHelpers,
        config: appConfig,
        storage: localStorage,
        cacheAssets: (urls) => window.cacheAssets?.(urls),
        state: {
          getCurrentChatId: () => currentChatId,
          getChatById: (chatId) => getChatById(chatId),
        },
        actions: {
          isMessageDisplayed: (id) => isMessageDisplayed(id),
          normalizePinEvent: (raw) => normalizePinEvent(raw),
          normalizePinEvents: (events) => normalizePinEvents(events),
          normalizeSystemEvent: (raw) => normalizeSystemEvent(raw),
          normalizeSystemEvents: (events) => normalizeSystemEvents(events),
        },
      });
      const readReceiptController = readReceiptFactory({
        window,
        document,
        api: (url, opts) => api(url, opts),
        services: {
          chatList: chatListControllers,
        },
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          getChats: () => chats,
          getChatById: (chatId) => getChatById(chatId),
        },
        actions: {
          getMaxRenderedMessageId: () => getMaxRenderedMessageId(),
          isCurrentChatActivelyVisible: (chatId) => isCurrentChatActivelyVisible(chatId),
          isNearBottom: (threshold) => isNearBottom(threshold),
          loadChats: (options = {}) => loadChats(options),
          renderChatList: () => renderChatList(chatSearch?.value || ''),
          updateVisibleOwnReadState: (chatId, threshold) => updateVisibleOwnReadStateRows(chatId, threshold),
        },
      });
      const scrollController = scrollControllerFactory({
        window,
        document,
        dom: appDom,
        config: appConfig,
        storage: localStorage,
        formatDate,
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          getOpenSeq: () => openChatController?.getOpenSeq?.() || 0,
          getScrollRestoreMode: () => scrollRestoreMode,
        },
        actions: {
          getHasMoreAfter: () => Boolean(openChatController?.hasMoreAfter?.()),
          hasPendingMediaBottomScroll: () => Boolean(messageStateController?.hasPendingMediaBottomScroll?.()),
          isCurrentChatActivelyVisible: (chatId) => isCurrentChatActivelyVisible(chatId),
          markCurrentChatReadIfAtBottom: (force) => markCurrentChatReadIfAtBottom(force),
          maybeLoadMoreAtBottom: () => maybeLoadMoreAtBottom(),
          syncComposerButton: () => syncContextConvertComposerButton(),
        },
      });
      const mediaPlaybackController = mediaPlaybackFactory({
        window,
        document,
        dom: appDom,
        pages: openChatPagesController,
        state: {
          getCurrentChatId: () => currentChatId,
        },
      });
      const documentRuntime = documentRuntimeFactory({
        window,
        document,
        dom: appDom,
        api: (url, opts) => api(url, opts),
        t,
        state: {
          getToken: () => token,
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          getCurrentChat: () => getChatById(currentChatId),
        },
        actions: {
          applyChatBackground: (chat) => applyChatBackground(chat),
          clearDisplayedTimelineState: () => {
            messageStateController?.clearDisplayedMessages?.();
            messageStateController?.clearDisplayedPinEvents?.();
            messageStateController?.clearDisplayedSystemEvents?.();
            clearRenderedMessages?.();
          },
          clearPendingFile: () => clearPendingFile(),
          clearReply: () => clearReply(),
          closeTransientUi: () => {
            hideMentionPicker();
            closeEmojiPicker({ immediate: true });
            hideAttachMenu({ immediate: true });
            hideContextConvertPicker();
            hideAvatarUserMenu();
            hideChatContextMenu({ immediate: true });
            hideFloatingMessageActions({ immediate: true });
          },
          renderCurrentChatHeader: (chat) => renderCurrentChatHeader(chat),
          revealActiveMobileChatRoute: (options = {}) => revealActiveMobileChatRoute(options),
          getContextConvertAvailability: (chatId) => contextConvertAvailabilityByChat?.get?.(Number(chatId || 0)) || null,
          loadChatShotState: (chatId, options = {}) => loadChatShotState(chatId, options),
          loadContextConvertAvailability: (chatId, options = {}) => loadContextConvertAvailability(chatId, options),
          openDocumentContextConvertPicker: (options = {}) => openDocumentContextConvertPicker(options),
          showToast: (message) => showCenterToast(message),
          syncChatAreaMetrics: () => syncChatAreaMetrics(),
          syncChatShotButton: () => syncChatShotButton(),
          updateChatStatus: () => updateChatStatus(),
        },
      });
      openChatController = openChatControllerFactory({
        window,
        document,
        dom: appDom,
        config: appConfig,
        pages: openChatPagesController,
        readReceipts: readReceiptController,
        scroll: scrollController,
        mediaPlayback: mediaPlaybackController,
        services: {
          chatList: chatListControllers,
          folders: folderControllers,
        },
        state: {
          getToken: () => token,
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          setCurrentChatId: (chatId) => {
            const nextId = Number(chatId || 0);
            currentChatId = nextId > 0 ? nextId : null;
            runtimeState.setCurrentChatId?.(currentChatId);
            runtimeState.setCurrentChat?.(getChatById(currentChatId));
            openChatService.syncRuntimeState?.();
            return currentChatId;
          },
          setCurrentChat: (chat) => {
            runtimeState.setCurrentChat?.(chat);
            return chat || null;
          },
          setMessages: (messages) => openChatService.setMessages?.(messages),
          mergeMessages: (messages, options = {}) => openChatService.mergeMessages?.(messages, options),
          getChats: () => chats,
          getChatById: (chatId) => getChatById(chatId),
          getChatSearchValue: () => chatSearch?.value || '',
          getCompactViewMap: () => compactViewMap,
          setCompactView: (value) => { compactView = Boolean(value); },
          getScrollRestoreMode: () => scrollRestoreMode,
          hasEdit: () => Boolean(composerStateController.editTo),
        },
        actions: {
          appendTimelineItems: (messages, pinEvents, systemEvents = [], options = {}) => appendTimelineItems(messages, pinEvents, systemEvents, options),
          applyChatBackground: (chat) => applyChatBackground(chat),
          cleanupDuplicateDateSeparators: () => cleanupDuplicateDateSeparators(),
          clearDisplayedTimelineState: () => {
            messageStateController?.clearDisplayedMessages?.();
            messageStateController?.clearDisplayedPinEvents?.();
            messageStateController?.clearDisplayedSystemEvents?.();
          },
          clearEdit: (options = {}) => clearEdit(options),
          clearPendingFile: () => clearPendingFile(),
          clearReply: () => clearReply(),
          closeDocumentMode: () => documentRuntime?.closeDocumentMode?.(),
          closeChatHeaderActions: () => closeChatHeaderActions(),
          closeTransientUi: () => {
            hideMentionPicker();
            closeEmojiPicker({ immediate: true });
            hideAttachMenu({ immediate: true });
            hideContextConvertPicker();
            clearActivePulseVoterPopover({ skipRefresh: true });
            hideAvatarUserMenu();
            hideChatContextMenu({ immediate: true });
            hideFloatingMessageActions({ immediate: true });
          },
          filterNewPinEvents: (events) => filterNewPinEvents(events),
          filterNewSystemEvents: (events) => filterNewSystemEvents(events),
          flushDeferredRecoverySync: () => flushDeferredRecoverySync(),
          isAbortError: (error) => isAbortError(error),
          isChatPinned: (chat) => isChatPinned(chat),
          isDocumentChat: (chat) => documentRuntime?.isDocumentChat?.(chat),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          isUiTransitionBusy: () => isUiTransitionBusy(),
          loadChatPins: (chatId) => loadChatPins(chatId),
          loadChatShotState: (chatId, options = {}) => loadChatShotState(chatId, options),
          loadChats: (options = {}) => loadChats(options),
          loadContextConvertAvailability: (chatId, options = {}) => loadContextConvertAvailability(chatId, options),
          markRecoveryRequested: (reason) => chatListService.markRecoveryRequested(reason),
          openDocument: (chatId, options = {}) => documentRuntime?.openDocument?.(chatId, options),
          refreshPollComposerActionState: () => refreshPollComposerActionState(),
          refreshVoiceComposerState: () => window.BananzaVoiceHooks?.refreshComposerState?.(),
          renderChatList: (filter = chatSearch?.value || '') => renderChatList(filter),
          renderCurrentChatHeader: (chat) => renderCurrentChatHeader(chat),
          renderedMessageIdsMatch: (messages) => renderedMessageIdsMatch(messages),
          renderMessages: (messages, options = {}) => renderMessages(messages, options.pinEvents || [], options.systemEvents || []),
          renderOutboxForChat: (chatId) => renderOutboxForChat(chatId),
          renderPinnedBar: (chatId) => renderPinnedBar(chatId),
          replaceRenderedMessages: (messages, options = {}) => replaceRenderedMessages(messages, options.pinEvents || [], options.systemEvents || [], options),
          restoreComposerDraft: (chatId) => restoreComposerDraft(chatId),
          revealActiveMobileChatRoute: (options = {}) => revealActiveMobileChatRoute(options),
          revealChatHydration: (seq, chatId) => revealChatHydration(seq, chatId),
          saveComposerDraft: (chatId) => saveComposerDraft(chatId),
          setChatHydrating: (active) => setChatHydrating(active),
          syncChatAreaMetrics: () => syncChatAreaMetrics(),
          syncChatShotButton: () => syncChatShotButton(),
          syncMentionOpenButton: () => syncMentionOpenButton(),
          updateChatListLastMessage: (message) => updateChatListLastMessage(message),
          updateChatStatus: () => updateChatStatus(),
        },
      });
      const openChatControllers = {
        pages: openChatPagesController,
        readReceipts: readReceiptController,
        scroll: scrollController,
        mediaPlayback: mediaPlaybackController,
        documents: documentRuntime,
        controller: openChatController,
        service: openChatService,
      };
      openChatService.configure?.(openChatControllers);
      openChatService.syncRuntimeState?.();
      if (appContext) appContext.services.openChat = openChatControllers;
      return window.BananzaApp.boot.composition.createEvalExports(["openChatPagesFactory","readReceiptFactory","scrollControllerFactory","mediaPlaybackFactory","openChatControllerFactory","documentRuntimeFactory","openChatController","openChatPagesController","readReceiptController","scrollController","mediaPlaybackController","documentRuntime","openChatControllers"], {
        get: (name) => eval(name),
        set: (name, value) => {
          const __bananzaRuntimeExportValue = value;
          eval(name + ' = __bananzaRuntimeExportValue');
        },
      });
    }
  };
})();
