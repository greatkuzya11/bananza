(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};
  const compositionRoot = bootRoot.composition = bootRoot.composition || {};

  compositionRoot.composeMessages = function composeMessages(scope = {}) {
    with (scope) {
      const messageStateFactory = window.BananzaApp?.messages?.state?.createMessageState;
      const messageAttachmentFactory = window.BananzaApp?.messages?.attachments?.createMessageAttachmentRenderer;
      const messageLocationFactory = window.BananzaApp?.messages?.locations?.createLocationMessageRenderer;
      const messagePollFactory = window.BananzaApp?.messages?.polls?.createPollMessageRenderer;
      const messageCallCardFactory = window.BananzaApp?.messages?.callCards?.createCallCardRenderer;
      const messageOutboxFactory = window.BananzaApp?.messages?.outbox?.createMessageOutbox;
      const messageUpdatesFactory = window.BananzaApp?.messages?.updates?.createMessageUpdates;
      const messageRendererFactory = window.BananzaApp?.messages?.render?.createMessageRenderer;
      if (typeof messageStateFactory !== 'function'
        || typeof messageAttachmentFactory !== 'function'
        || typeof messageLocationFactory !== 'function'
        || typeof messagePollFactory !== 'function'
        || typeof messageCallCardFactory !== 'function'
        || typeof messageOutboxFactory !== 'function'
        || typeof messageUpdatesFactory !== 'function'
        || typeof messageRendererFactory !== 'function') {
        throw new Error('BananzaApp message modules are required before app.js');
      }
    
      messageStateController = messageStateFactory({
        messageIdKey: (id) => messageIdKey(id),
      });
      messageAttachmentRenderer = messageAttachmentFactory({
        window,
        document,
        api: (url, opts) => api(url, opts),
        attachments: attachmentHelpers,
        formatters,
        esc,
        formatSize,
        state: messageStateController,
        actions: {
          isClientSideMessage: (msg) => isClientSideMessage(msg),
          applyMessageUpdate: (msg, options = {}) => applyMessageUpdate(msg, options),
        },
      });
      messageLocationRenderer = messageLocationFactory({
        window,
        document,
        formatters,
        esc,
        actions: {
          getMapConfig: () => composerLocationController?.getMapConfig?.() || window.BananzaApp?.maps?.getConfig?.() || {},
          openModal: (id, options = {}) => openModal(id, options),
          copyTextToClipboard: (text) => copyTextToClipboard(text),
        },
      });
      messageCallCardRenderer = messageCallCardFactory({
        window,
        document,
        dom: { messagesEl },
        api: (url, opts) => api(url, opts),
        formatters,
        t,
        esc,
        formatDuration: (seconds) => messageAttachmentRenderer.formatDuration(seconds),
        normalizeMimeType,
        fileExtension,
        clamp,
        getToken: () => token,
        getCurrentUser: () => currentUser,
        $,
        actions: {
          showCenterToast: (message) => showCenterToast(message),
          copyTextToClipboard: (text) => copyTextToClipboard(text),
          openModal: (id, options = {}) => openModal(id, options),
          closeModal: (id, options = {}) => closeModal(id, options),
          openMediaViewer: (src, type = 'image') => openMediaViewer(src, type),
          showMediaContextMenuForContext: (context, options = {}) => showMediaContextMenuForContext(context, options),
          getAbsoluteMessageMediaUrl: (url) => getAbsoluteMessageMediaUrl(url),
          bindMediaPlaybackState: (mediaEl, message, role) => bindMediaPlaybackState(mediaEl, message, role),
          isMediaPlaybackCompleted: (message, role) => isMediaPlaybackCompleted(message, role),
          setMediaPlaybackCompleted: (message, role, completed) => setMediaPlaybackCompleted(message, role, completed),
        },
      });
      messagePollRenderer = messagePollFactory({
        window,
        document,
        dom: {
          messagesEl,
          pollVotersModal,
          pollVotersMeta,
          pollVotersTitle,
          pollVotersStatus,
          pollVotersList,
        },
        api: (url, opts) => api(url, opts),
        formatters,
        ui: uiSettings,
        t,
        esc,
        initials,
        formatTime,
        formatDate,
        formatRelativeDuration,
        formatPollDeadline,
        normalizePollStyle: (style) => normalizePollStyle(style),
        setPollStyleSurface: (modalEl, style) => setPollStyleSurface(modalEl, style),
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          getChatById: (chatId) => getChatById(chatId),
        },
        actions: {
          replaceRenderedMessage: (msg, options = {}) => messageRenderer?.replaceRenderedMessage?.(msg, options),
          syncChatAreaMetrics: () => syncChatAreaMetrics(),
          showCenterToast: (message) => showCenterToast(message),
          openModal: (id, options = {}) => openModal(id, options),
          openFloatingSurface: (el) => openFloatingSurface(el),
          closeFloatingSurface: (el, options = {}) => closeFloatingSurface(el, options),
          avatarHtml: (name, color, avatarUrl, size) => avatarHtml(name, color, avatarUrl, size),
        },
      });
      messageRenderer = messageRendererFactory({
        window,
        document,
        dom: { messagesEl },
        formatters,
        attachmentHelpers,
        attachmentRenderer: messageAttachmentRenderer,
        locationRenderer: messageLocationRenderer,
        pollRenderer: messagePollRenderer,
        callCardRenderer: messageCallCardRenderer,
        messageState: messageStateController,
        t,
        esc,
        formatDate,
        formatTime,
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          isCompactView: () => compactView,
          contextConvertPendingMessageIds,
          contextOriginalRestorePendingMessageIds,
          grokImageRiskRetryPending,
          getReactionPickerKeepKeyboard: () => getReactionPickerKeepKeyboard(),
        },
        actions: {
          setLoadMoreAfterLoading: (value) => setLoadMoreAfterLoading(value),
          hideScrollDateIndicator: (options = {}) => hideScrollDateIndicator(options),
          buildMessagesRootChildren: (fragment = null) => buildMessagesRootChildren(fragment),
          normalizePinEvents: (events = []) => normalizePinEvents(events),
          normalizePinEvent: (event) => normalizePinEvent(event),
          normalizeSystemEvents: (events = []) => normalizeSystemEvents(events),
          normalizeSystemEvent: (event) => normalizeSystemEvent(event),
          jumpToPinnedMessage: (pin) => jumpToPinnedMessage(pin),
          filterNewMessages: (messages = []) => filterNewMessages(messages),
          insertAtMessagesEnd: (node) => insertAtMessagesEnd(node),
          getMessagesLastContentChild: () => getMessagesLastContentChild(),
          updateScrollBottomButton: () => updateScrollBottomButton(),
          refreshScrollDateIndicator: () => refreshScrollDateIndicator(),
          getRenderedMessageRows: () => getRenderedMessageRows(),
          updateHasMoreAfterFromChat: (chatId) => updateHasMoreAfterFromChat(chatId),
          isLoadingMoreAfter: () => openChatController?.isLoadingMoreAfter?.(),
          setAvatarElementVisual: (el, options = {}) => setAvatarElementVisual(el, options),
          applyOwnReadStateToMessage: (msg, chatId) => applyOwnReadStateToMessage(msg, chatId),
          isClientSideMessage: (msg) => isClientSideMessage(msg),
          isSingleEmojiMessage: (text) => isSingleEmojiMessage(text),
          isSingleCustomEmojiMessage: (text) => isSingleCustomEmojiMessage(text),
          renderCustomEmojiHtml: (text, options = {}) => renderCustomEmojiHtml(text, options),
          canContextConvertMessage: (msg) => canContextConvertMessage(msg),
          canRestoreContextOriginalMessage: (msg) => canRestoreContextOriginalMessage(msg),
          canSaveMessageToNotes: (msg) => canSaveMessageToNotes(msg),
          canForwardMessage: (msg) => canForwardMessage(msg),
          canEditMessage: (msg) => canEditMessage(msg),
          getReplyPreviewText: (msg) => getReplyPreviewText(msg),
          getReplyQuoteText: (msg) => getReplyQuoteText(msg),
          renderMessageText: (text, mentions) => renderMessageText(text, mentions),
          renderReactions: (reactions) => renderReactions(reactions),
          renderPinActionButton: (msg) => renderPinActionButton(msg),
          deleteMessage: (id) => deleteMessage(id),
          bindTouchSafeButtonActivation: (button, handler) => bindTouchSafeButtonActivation(button, handler),
          setReplyFromRow: (row) => setReplyFromRow(row),
          copyMessageFromRow: (row) => copyMessageFromRow(row),
          setEditFromRow: (row) => setEditFromRow(row),
          bindContextConvertMessageButton: (button, row) => bindContextConvertMessageButton(button, row),
          bindContextOriginalRestoreButton: (button, row) => bindContextOriginalRestoreButton(button, row),
          showReactionPicker: (row, anchor, options = {}) => showReactionPicker(row, anchor, options),
          openForwardMessageModal: (msg) => openForwardMessageModal(msg),
          saveMessageToNotes: (msg, button) => saveMessageToNotes(msg, button),
          togglePinFromRow: (row) => togglePinFromRow(row),
          retrySend: (row) => messageOutbox?.retrySend?.(row),
          scheduleRetryLayout: () => messageOutbox?.scheduleRetryLayout?.(),
          retryGrokImageRiskPrompt: (row, button) => retryGrokImageRiskPrompt(row, button),
          handleMentionClick: (event, button) => handleMentionClick(event, button),
          scrollToMessage: (id) => scrollToMessage(id),
          jumpToSavedOriginal: (msg) => jumpToSavedOriginal(msg),
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          openImageViewer: (src) => openImageViewer(src),
          openMediaViewer: (src, type = 'image') => openMediaViewer(src, type),
          bindMediaPlaybackState: (mediaEl, message, role) => bindMediaPlaybackState(mediaEl, message, role),
          isNearBottom: (threshold) => isNearBottom(threshold),
          captureScrollAnchor: () => captureScrollAnchor(),
          restoreScrollAnchor: (anchor, attempts) => restoreScrollAnchor(anchor, attempts),
          saveCurrentScrollAnchor: (chatId, options = {}) => saveCurrentScrollAnchor(chatId, options),
          scrollToBottom: (instant = false, markRead = false, options = {}) => scrollToBottom(instant, markRead, options),
        },
      });
      messageOutbox = messageOutboxFactory({
        window,
        document,
        dom: { messagesEl },
        api: (url, opts) => api(url, opts),
        renderer: messageRenderer,
        messageState: messageStateController,
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
        },
        actions: {
          updateScrollBottomButton: () => updateScrollBottomButton(),
          isNearBottom: (threshold) => isNearBottom(threshold),
          captureScrollAnchor: () => captureScrollAnchor(),
          restoreScrollAnchor: (anchor, attempts) => restoreScrollAnchor(anchor, attempts),
          applyOwnReadStateToMessage: (msg, chatId) => applyOwnReadStateToMessage(msg, chatId),
          updateChatListLastMessage: (msg) => updateChatListLastMessage(msg),
          scrollToBottom: (instant = false, markRead = false, options = {}) => scrollToBottom(instant, markRead, options),
          getReplySnapshot: (source) => getReplySnapshot(source),
          clearReply: () => clearReply(),
          playAppSound: (type, options = {}) => playAppSound(type, options),
          makeClientId: (prefix) => makeClientId(prefix),
        },
      });
      messageUpdates = messageUpdatesFactory({
        window,
        document,
        dom: { messagesEl },
        api: (url, opts) => api(url, opts),
        renderer: messageRenderer,
        messageCache: window.messageCache,
        esc,
        state: {
          getCurrentChatId: () => currentChatId,
          getEditMessageId: () => composerStateController.editTo?.id || 0,
        },
        actions: {
          loadChats: () => loadChats(),
          ensureScrollAnchorsLoaded: () => ensureScrollAnchorsLoaded(),
          getScrollAnchor: (chatId) => scrollController.getScrollAnchor(chatId),
          deleteScrollAnchor: (chatId) => scrollController.deleteScrollAnchor(chatId),
          captureScrollAnchor: () => captureScrollAnchor(),
          restoreScrollAnchor: (anchor, attempts) => restoreScrollAnchor(anchor, attempts),
          saveCurrentScrollAnchor: (chatId, options = {}) => saveCurrentScrollAnchor(chatId, options),
          hideDeletedMessageSurfaces: (msgId) => {
            if (
              String(getActiveMessageActionsRow()?.dataset?.msgId || '') === String(msgId)
              || String(getReactionPickerMsgId() || '') === String(msgId)
            ) {
              hideFloatingMessageActions({ immediate: true });
            }
          },
          clearEdit: (options = {}) => clearEdit(options),
          getReplyPreviewText: (msg) => getReplyPreviewText(msg),
          updateReplyBarFromMessage: (msg, text) => composerReplyEditController?.updateReplyPreview?.(msg.id, text),
          applyOwnReadStateToMessage: (msg, chatId) => applyOwnReadStateToMessage(msg, chatId),
          refreshReactionPickerForMessage: (msg) => {
            if (Number(getReactionPickerMsgId() || 0) === Number(msg.id || 0) && isFloatingSurfaceVisible(reactionPicker)) {
              renderReactionPickerContent();
              positionMessageActionSurfaces({
                includeActions: Boolean(getActiveMessageActionsRow()),
                includePicker: true,
              });
            }
          },
        },
      });
      messagesService.configure?.({
        state: messageStateController,
        attachments: messageAttachmentRenderer,
        locations: messageLocationRenderer,
        polls: messagePollRenderer,
        callCards: messageCallCardRenderer,
        renderer: messageRenderer,
        outbox: messageOutbox,
        updates: messageUpdates,
      });
      const messageServices = messagesService;
      if (appContext) appContext.services.messages = messageServices;
      return window.BananzaApp.boot.composition.createEvalExports(["messageStateFactory","messageAttachmentFactory","messageLocationFactory","messagePollFactory","messageCallCardFactory","messageOutboxFactory","messageUpdatesFactory","messageRendererFactory","messageLocationRenderer","messageServices"], {
        get: (name) => eval(name),
        set: (name, value) => {
          const __bananzaRuntimeExportValue = value;
          eval(name + ' = __bananzaRuntimeExportValue');
        },
      });
    }
  };
})();
