(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};
  const compositionRoot = bootRoot.composition = bootRoot.composition || {};

  compositionRoot.composeComposer = function composeComposer(scope = {}) {
    with (scope) {
      const refreshVoiceComposerState = () => window.BananzaVoiceHooks?.refreshComposerState?.();
      const sendComposerWsPayload = (payload) => {
        const openState = window.WebSocket?.OPEN ?? 1;
        if (!ws || ws.readyState !== openState) return false;
        ws.send(JSON.stringify(payload));
        return true;
      };
    
      composerTextController = composerTextFactory({
        window,
        document,
        dom: appDom,
        state: composerStateController,
        customEmoji: window.BananzaApp?.customEmoji,
        formatters: window.BananzaApp?.formatters,
        esc,
        actions: {
          noteMobileKeyboardInputDelta: (delta) => {
            mobileComposerGuard?.noteMobileKeyboardInputDelta?.(delta);
          },
          isFloatingSurfaceVisible: (el) => isFloatingSurfaceVisible(el),
          positionEmojiPicker: (anchor) => positionEmojiPicker(anchor),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          scheduleMobileViewportRecovery: (delay) => scheduleMobileViewportRecovery(delay),
          queueIosViewportLayoutSync: () => queueIosViewportLayoutSync(),
          refreshVoiceComposerState,
        },
      });
    
      composerReplyEditController = composerReplyEditFactory({
        window,
        document,
        dom: appDom,
        state: composerStateController,
        text: composerTextController,
        getCurrentUser: () => currentUser,
        getCurrentChatId: () => currentChatId,
        actions: {
          alert: (message) => alert(message),
          isClientSideMessage: (msg) => isClientSideMessage(msg),
          isPollMessage: (msg) => isPollMessage(msg),
          isCurrentNotesChat: () => isCurrentNotesChat(),
          getMediaNoteFallbackLabel: (msg) => getMediaNoteFallbackLabel(msg),
          hideFloatingMessageActions: (options = {}) => hideFloatingMessageActions(options),
          copyTextToClipboard: (textValue) => copyTextToClipboard(textValue),
          showCenterToast: (message) => showCenterToast(message),
          syncMentionOpenButton: () => syncMentionOpenButton(),
          refreshPollComposerActionState: () => refreshPollComposerActionState(),
          refreshVoiceComposerState,
          queueIosViewportLayoutSync: () => queueIosViewportLayoutSync(),
          updateComposerAiOverrideState: () => updateComposerAiOverrideState().catch(() => {}),
          clearComposerDraft: (chatId) => clearComposerDraft(chatId),
          shouldKeepComposerForMobileMessageInteraction: () => shouldKeepComposerForMobileMessageInteraction(),
          suppressNextMessageActionTap: () => suppressNextMessageActionTap(),
          focusComposerKeepKeyboard: (force) => focusComposerKeepKeyboard(force),
          safeVibrate: (pattern) => safeVibrate(pattern),
        },
      });
    
      composerFilesController = composerFilesFactory({
        window,
        document,
        dom: appDom,
        state: composerStateController,
        config: { MAX_ATTACHMENTS, MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL },
        formatters: window.BananzaApp?.formatters,
        esc,
        formatSize,
        actions: {
          alert: (message) => alert(message),
          localAttachmentFromFile: (file) => localAttachmentFromFile(file),
          updateComposerAiOverrideState: () => updateComposerAiOverrideState().catch(() => {}),
          refreshPollComposerActionState: () => refreshPollComposerActionState(),
          refreshVoiceComposerState,
          scheduleMobileViewportRecovery: () => scheduleMobileViewportRecovery(),
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          focusComposerKeepKeyboard: (force) => focusComposerKeepKeyboard(force),
          bindTouchSafeButtonActivation: (button, handler) => bindTouchSafeButtonActivation(button, handler),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          isFloatingSurfaceVisible: (el) => isFloatingSurfaceVisible(el),
          openFloatingSurface: (el) => openFloatingSurface(el),
          closeFloatingSurface: (el, options = {}) => closeFloatingSurface(el, options),
        },
      });
    
      composerSendController = composerSendFactory({
        window,
        dom: appDom,
        state: composerStateController,
        text: composerTextController,
        replyEdit: composerReplyEditController,
        files: composerFilesController,
        services: { messages: messageServices },
        api: (url, opts) => api(url, opts),
        config: { MAX_MSG },
        getCurrentChatId: () => currentChatId,
        actions: {
          alert: (message) => alert(message),
          captureScrollAnchor: () => captureScrollAnchor(),
          applyMessageUpdate: (message, options = {}) => applyMessageUpdate(message, options),
          restoreScrollAnchor: (anchor, attempts) => restoreScrollAnchor(anchor, attempts),
          saveCurrentScrollAnchor: (chatId, options = {}) => saveCurrentScrollAnchor(chatId, options),
          loadChats: () => loadChats(),
          clearComposerDraft: (chatId) => clearComposerDraft(chatId),
          syncMentionOpenButton: () => syncMentionOpenButton(),
          refreshVoiceComposerState,
          scheduleMobileViewportRecovery: () => scheduleMobileViewportRecovery(),
          resolveComposerAiOverridePayload: () => getComposerAiOverridePayload(),
          analyzeOutgoingGrokImageRisk: (messageText, replySnapshot, composerAiOverride) =>
            analyzeOutgoingGrokImageRisk(messageText, replySnapshot, composerAiOverride),
          openGrokImageRiskConfirm: (matches) => openGrokImageRiskConfirm(matches),
          playAppSound: (type, options = {}) => playAppSound(type, options),
          scrollToBottom: (...args) => scrollToBottom(...args),
        },
      });
    
      composerEmojiPickerController = composerEmojiPickerFactory({
        window,
        document,
        dom: appDom,
        state: composerStateController,
        text: composerTextController,
        storage: localStorage,
        customEmoji: window.BananzaApp?.customEmoji,
        formatters: window.BananzaApp?.formatters,
        esc,
        t: (key, params) => t(key, params),
        api: (url, opts) => api(url, opts),
        getCurrentUser: () => currentUser,
        actions: {
          isSingleEmojiMessage: (value) => isSingleEmojiMessage(value),
          scheduleScrollableItemCenter: (...args) => scheduleScrollableItemCenter(...args),
          createHorizontalSwipePager: (options) => createHorizontalSwipePager(options),
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          focusComposerKeepKeyboard: (force) => focusComposerKeepKeyboard(force),
          forceMobileViewportLayoutSync: () => forceMobileViewportLayoutSync(),
          syncChatAreaMetrics: () => syncChatAreaMetrics(),
          queueIosViewportLayoutSync: () => queueIosViewportLayoutSync(),
          isFloatingSurfaceVisible: (el) => isFloatingSurfaceVisible(el),
          preventMobileComposerBlur: (event) => preventMobileComposerBlur(event),
          getFloatingViewportRect: () => getFloatingViewportRect(),
          measureFloatingSurface: (el, fallbackWidth, fallbackHeight) => measureFloatingSurface(el, fallbackWidth, fallbackHeight),
          clamp: (value, min, max) => clamp(value, min, max),
          positionFloatingElement: (el, left, top) => positionFloatingElement(el, left, top),
          openFloatingSurface: (el) => openFloatingSurface(el),
          closeFloatingSurface: (el, options = {}) => closeFloatingSurface(el, options),
        },
      });
    
      composerMentionsController = composerMentionsFactory({
        window,
        document,
        dom: appDom,
        state: composerStateController,
        text: composerTextController,
        api: (url, opts) => api(url, opts),
        esc,
        getCurrentChatId: () => currentChatId,
        getCurrentUser: () => currentUser,
        config: { MENTION_PICKER_TAP_DEAD_ZONE },
        actions: {
          updateComposerAiOverrideState: () => updateComposerAiOverrideState().catch(() => {}),
          syncContextConvertComposerButton: () => syncContextConvertComposerButton(),
          closeFloatingSurface: (el, options = {}) => closeFloatingSurface(el, options),
          openFloatingSurface: (el) => openFloatingSurface(el),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          restoreComposerFocusAfterMentionPicker: (keyboardAttached) => restoreComposerFocusAfterMentionPicker(keyboardAttached),
          refreshVoiceComposerState,
          focusComposerKeepKeyboard: (force) => focusComposerKeepKeyboard(force),
          openPrivateChatWithUser: (userId) => openPrivateChatWithUser(userId),
          consumeOutsidePickerDismissGesture: (event, suppressFollowupClick) =>
            consumeOutsidePickerDismissGesture(event, suppressFollowupClick),
          isPickerDismissPassThroughTarget: (target) => isPickerDismissPassThroughTarget(target),
        },
      });
    
      composerTypingDragDropController = composerTypingDragDropFactory({
        dom: appDom,
        state: composerStateController,
        files: composerFilesController,
        getCurrentChatId: () => currentChatId,
        actions: {
          sendWs: (payload) => sendComposerWsPayload(payload),
        },
      });
    
      pollComposerController = pollComposerFactory({
        window,
        document,
        dom: appDom,
        state: composerStateController,
        text: composerTextController,
        replyEdit: composerReplyEditController,
        api: (url, opts) => api(url, opts),
        config: { POLL_MIN_OPTIONS, POLL_MAX_OPTIONS, POLL_CLOSE_PRESET_MS },
        esc,
        getCurrentChatId: () => currentChatId,
        getCurrentUser: () => currentUser,
        actions: {
          alert: (message) => alert(message),
          normalizePollStyle: (style) => normalizePollStyle(style),
          getPollComposerStyle: () => pollComposerStyle,
          setPollComposerStyle: (value) => { pollComposerStyle = value; },
          pollStyleMeta: (style) => pollStyleMeta(style),
          isPulsePoll: (...args) => isPulsePoll(...args),
          renderPollCard: (...args) => renderPollCard(...args),
          syncPollComposerStyleUi: () => syncPollComposerStyleUi(),
          isCurrentNotesChat: () => isCurrentNotesChat(),
          syncChatAreaMetrics: () => syncChatAreaMetrics(),
          openModal: (id, options = {}) => openModal(id, options),
          closeModal: (id, options = {}) => closeModal(id, options),
          clearComposerDraft: (chatId) => clearComposerDraft(chatId),
          syncMentionOpenButton: () => syncMentionOpenButton(),
          refreshVoiceComposerState,
          updateChatListLastMessage: (message) => updateChatListLastMessage(message),
          cacheMessage: (message) => window.messageCache?.upsertMessage?.(message).catch(() => {}),
          isMessageDisplayed: (id) => isMessageDisplayed(id),
          appendMessage: (...args) => appendMessage(...args),
          scrollToBottom: (...args) => scrollToBottom(...args),
          playAppSound: (type, options = {}) => playAppSound(type, options),
          openPollStyleSettingsModal: () => openPollStyleSettingsModal(),
        },
      });
      return window.BananzaApp.boot.composition.createEvalExports(["refreshVoiceComposerState","sendComposerWsPayload"], {
        get: (name) => eval(name),
        set: (name, value) => {
          const __bananzaRuntimeExportValue = value;
          eval(name + ' = __bananzaRuntimeExportValue');
        },
      });
    }
  };
})();
