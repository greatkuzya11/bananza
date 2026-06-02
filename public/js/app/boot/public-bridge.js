(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function createPublicBridge(ctx) {
    const coreApi = {
      api: (url, options) => ctx?.services?.api?.request?.(url, options),
      getToken: () => ctx?.services?.auth?.getToken?.() || '',
      getCurrentUser: () => ctx?.services?.auth?.getCurrentUser?.() || null,
      getCurrentChatId: () => ctx?.state?.getCurrentChatId?.() || ctx?.state?.currentChatId || null,
    };
    return root.createBridge
      ? root.createBridge(ctx, coreApi)
      : Object.assign((window.BananzaAppBridge = window.BananzaAppBridge || {}), coreApi);
  }

  bootRoot.createPublicBridge = createPublicBridge;
})();



(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};


  function createRuntimePublicBridge(scope = {}) {
    with (scope) {
      const appBridge = appRuntime?.createBridge
        ? appRuntime.createBridge(appContext)
        : (window.BananzaAppBridge = window.BananzaAppBridge || {});
      if (appContext) appContext.bridge = appBridge;
      Object.assign(appBridge, {
        api: (url, opts) => api(url, opts),
        animateSendButton: () => animateSendButton(),
        autoResize: () => autoResize(),
        clearReply: () => clearReply(),
        closeAllModals: (options) => closeAllModals(options),
        registerManagedModal: (id, options) => registerModal(id, options),
        openManagedModal: (id, options) => openModal(id, options),
        openModal: (id, options) => openModal(id, options),
        closeManagedModal: (id, options) => closeModal(id, options),
        closeTopManagedModal: (options) => closeTopModal(options),
        showToast: (message) => showCenterToast(message),
        closeChatHeaderActions: () => closeChatHeaderActions(),
        syncChatHeaderActions: () => syncChatHeaderActionsAccessibility(),
        getToken: () => token || localStorage.getItem('token'),
        getCurrentUser: () => currentUser,
        getCurrentChatId: () => currentChatId,
        getCurrentChat: () => getChatById(currentChatId) ? { ...getChatById(currentChatId) } : null,
        isIosWebkit: () => isIosViewportFixTarget,
        getCurrentModalAnimation: () => currentModalAnimation,
        getCurrentModalAnimationSpeed: () => currentModalAnimationSpeed,
        getCurrentLanguage: () => currentUiLanguage,
        t: (key, params) => t(key, params),
        tx: (text, params) => tx(text, params),
        onLanguageChange: (listener) => i18n?.onChange?.(listener) || (() => {}),
        applyLocalizedDom: (root) => i18n?.applyStaticDom?.(root || document),
        refreshCallIndicators: () => {
          if (chatList) renderChatList(chatSearch?.value || '');
        },
        getPendingFiles: () => composerStateController.getPendingFiles(),
        getReplyTo: () => composerStateController.getReplyTo(),
        getEditTo: () => composerStateController.getEditTo(),
        getMicrophoneMode: () => getMicrophoneMode(),
        getScreenRotationAllowed: () => getScreenRotationAllowed(),
        openSettingsModal: (opener = $('#settingsBtn')) => openSettingsModal(opener),
        openLanguageSettingsModal: () => openLanguageSettingsModal(),
        openThemeSettingsModal: () => openThemeSettingsModal(),
        openVisualModeSettingsModal: () => openVisualModeSettingsModal(),
        openPollStyleSettingsModal: () => openPollStyleSettingsModal(),
        openAnimationSettingsModal: () => openAnimationSettingsModal(),
        openMobileFontSettingsModal: () => openMobileFontSettingsModal(),
        openWeatherSettingsModal: () => openWeatherSettingsModal(),
        openNotificationSettingsModal: () => openNotificationSettingsModal(),
        openSoundSettingsModal: () => openSoundSettingsModal(),
        openAiBotSettingsModal: () => openAiBotSettingsModal(),
        openOpenAiTextBotsModal: () => openOpenAiTextBotsModal(),
        openOpenAiUniversalBotsModal: () => openOpenAiUniversalBotsModal(),
        openOpenAiImageBotsModal: () => openOpenAiImageBotsModal(),
        openYandexAiSettingsModal: () => openYandexAiSettingsModal(),
        openDeepseekAiSettingsModal: () => openDeepseekAiSettingsModal(),
        openDeepseekTextBotsModal: () => openDeepseekTextBotsModal(),
        openQwenAiSettingsModal: () => openQwenAiSettingsModal(),
        openQwenTextBotsModal: () => openQwenTextBotsModal(),
        openGrokAiSettingsModal: () => openGrokAiSettingsModal(),
        openGrokTextBotsModal: () => openGrokTextBotsModal(),
        openGrokImageBotsModal: () => openGrokImageBotsModal(),
        openGrokUniversalBotsModal: () => openGrokUniversalBotsModal(),
        openContextConvertBotsModal: (provider) => openContextConvertBotsModal(provider),
        openChatShotBotsModal: (provider) => openChatShotBotsModal(provider),
        insertDictatedText: (text) => insertDictatedText(text),
        queueVoiceMessage: (payload) => queueVoiceOutbox(payload),
        queueVideoNote: (payload) => queueVideoNoteOutbox(payload),
        updateReplyPreview: (messageId, text) => composerReplyEditController?.updateReplyPreview?.(messageId, text),
        scrollToBottom: (instant = false) => scrollToBottom(instant),
        playSound: (type, options) => playAppSound(type, options),
        bindMediaPlayback: (mediaEl, message, role) => bindMediaPlaybackState(mediaEl, message, role),
        isMediaPlaybackCompleted: (message, role) => isMediaPlaybackCompleted(message, role),
        setMediaPlaybackCompleted: (message, role, completed) => setMediaPlaybackCompleted(message, role, completed),
        getAttachmentPreviewUrl: (source) => getAttachmentPreviewUrl(source),
        getAttachmentDownloadUrl: (source) => getAttachmentDownloadUrl(source),
        getAttachmentPosterUrl: (source) => getAttachmentPosterUrl(source),
        ensureAttachmentPoster: (source, options = {}) => ensureAttachmentPoster(source, options),
        createAttachmentPosterBlob: (source) => createAttachmentPosterBlob(source),
        getDom: () => ({
          sendBtn,
          msgInput,
          messagesEl,
          pendingFileEl,
          settingsModal,
          chatView,
        }),
        isMobileLayout: () => isMobileLayoutViewport(),
      });
      Object.assign(appBridge.__testing = appBridge.__testing || {}, {
        getChats: () => chatListService.getChats().map((chat) => normalizeChatListEntry(chat)),
        getOnlineUsers: () => Array.from(chatListService.getOnlineUsers()),
        getChatFolders: () => chatFolderStore.getFolders(),
        setChats: (nextChats = [], options = {}) => {
          chatListService.setChats(nextChats);
          refreshChatListReferences();
          if (Object.prototype.hasOwnProperty.call(options, 'currentChatId')) {
            const nextCurrentChatId = Number(options.currentChatId || 0);
            currentChatId = nextCurrentChatId > 0 ? nextCurrentChatId : null;
            syncCoreStateToRuntime();
          }
          renderChatList(chatSearch.value);
          renderCurrentChatHeader(getChatById(currentChatId));
          refreshChatInfoPresentation(getChatById(currentChatId));
          return chatListService.getChats().map((chat) => normalizeChatListEntry(chat));
        },
        setOnlineUsers: (userIds = []) => Array.from(chatListService.setOnlineUsers(userIds)),
        setCurrentChatId: (chatId) => {
          const nextCurrentChatId = Number(chatId || 0);
          currentChatId = nextCurrentChatId > 0 ? nextCurrentChatId : null;
          syncCoreStateToRuntime();
          const currentChat = getChatById(currentChatId);
          renderCurrentChatHeader(currentChat);
          refreshChatInfoPresentation(currentChat);
          return currentChat ? normalizeChatListEntry(currentChat) : null;
        },
        setChatFolders: (nextFolders = [], options = {}) => {
          chatFolderStore.setFolders(nextFolders, { persist: false });
          if (Object.prototype.hasOwnProperty.call(options, 'activeFolderId')) {
            chatFolderStore.setActiveFolderId(options.activeFolderId, { persist: false });
          }
          renderActiveChatFolderBar();
          renderChatList(chatSearch?.value || '');
          return chatFolderStore.getFolders();
        },
        getCurrentUser: () => (currentUser ? { ...currentUser } : null),
        setCurrentUser: (nextUser = {}) => {
          const nextId = Number(nextUser.id || currentUser?.id || 0);
          if (!nextId) return null;
          applyUserUpdate({
            ...(currentUser || {}),
            ...nextUser,
            id: nextId,
          });
          return currentUser ? { ...currentUser } : null;
        },
        normalizeContextConvertAvailability: (data = {}) => normalizeContextConvertAvailability(data),
        loadContextConvertAvailability: (chatId, options = {}) => loadContextConvertAvailability(chatId, options),
        invalidateContextConvertAvailability: (chatId) => invalidateContextConvertAvailability(chatId),
        isContextTransformAvailableForChat: (chatId) => isContextTransformAvailableForChat(chatId),
        normalizeChatShotState: (data = {}) => normalizeChatShotState(data),
        loadChatShotState: (chatId, options = {}) => loadChatShotState(chatId, options),
        invalidateChatShotState: (chatId) => invalidateChatShotState(chatId),
        syncChatShotButton: () => syncChatShotButton(),
        runChatShotGeneration: () => runChatShotGeneration(),
        analyzeOutgoingGrokImageRisk: (text, replySnapshot = null, composerAiOverride = {}) => analyzeOutgoingGrokImageRisk(text, replySnapshot, composerAiOverride),
        openGrokImageRiskConfirm: (matches = []) => openGrokImageRiskConfirm(matches),
        retryGrokImageRiskPrompt: (row, button = null) => retryGrokImageRiskPrompt(row, button),
        setContextConvertAdminState: (provider = 'openai', state = {}, selectedBotId = null) => {
          const nextProvider = contextConvertAdminStates[provider] ? provider : 'openai';
          activeContextConvertProvider = nextProvider;
          mergeContextConvertAdminState(nextProvider, state);
          if (selectedBotId != null) {
            selectedContextConvertBotIds[nextProvider] = Number(selectedBotId || 0) || null;
          }
          renderContextConvertAdminSettings();
          return currentContextConvertAdminState();
        },
        setActiveChatFolder: (folderId, options = {}) => {
          setActiveChatFolder(folderId, {
            persist: Boolean(options.persist),
            render: !Object.prototype.hasOwnProperty.call(options, 'render') || Boolean(options.render),
            closePicker: Boolean(options.closePicker),
          });
          return getActiveChatFolder();
        },
        transitionToChatFolder: (folderId, options = {}) => transitionToChatFolder(folderId, options),
        centerActiveChatFolderChip: (options = {}) => centerActiveChatFolderChip(options),
        getActiveChatFolder: () => getActiveChatFolder(),
        applyChatUpdate: (nextChat = {}) => applyChatUpdate(nextChat),
        dismissMobileComposer: (options = {}) => dismissMobileComposer(options),
        openMediaViewer: (src, type = 'image') => openMediaViewer(src, type),
        closeMediaViewer: () => closeMediaViewer(),
        getMediaViewerState: () => mediaViewerController?.getMediaViewerState?.() || {
          scale: 1,
          panX: 0,
          panY: 0,
          transform: '',
        },
        openSettingsModal: (opener = $('#settingsBtn')) => openSettingsModal(opener),
        openChatInfoModal: (opener = getChatSettingsActionOpener()) => openChatInfoModal(opener),
        closeChatHeaderActions: () => closeChatHeaderActions(),
        getChatHeaderActionsOpen: () => chatHeaderActionsOpen,
        openChat: (chatId, options = {}) => openChat(chatId, options),
        openChatControllers: () => openChatControllers,
        openChatState: () => openChatController.getState(),
        scrollToBottom: (instant = false, markRead = false, options = {}) => scrollToBottom(instant, markRead, options),
        bindMediaPlayback: (mediaEl, message, role) => bindMediaPlaybackState(mediaEl, message, role),
        isMediaPlaybackCompleted: (message, role) => isMediaPlaybackCompleted(message, role),
        setMediaPlaybackCompleted: (message, role, completed) => setMediaPlaybackCompleted(message, role, completed),
        renderOutboxItem: (item) => renderOutboxItem(item),
        completeOutboxSend: (item, serverMsg) => completeOutboxSend(item, serverMsg),
        appendMessage: (msg, options = {}) => appendMessage(msg, options),
        applyMessageUpdate: (msg, options = {}) => applyMessageUpdate(msg, options),
        handleWSMessage: (msg) => handleWSMessage(msg),
        revealSidebarFromChat: (options = {}) => revealSidebarFromChat(options),
        flushCurrentChatScrollAnchor: (chatId, options = {}) => flushCurrentChatScrollAnchor(chatId, options),
        readScrollAnchors: () => scrollController.readScrollAnchors(),
        setScrollRestoreMode: (mode = 'bottom') => {
          return uiSettings.setScrollRestoreMode(mode);
        },
        setMicrophoneMode: (mode = 'voice_message') => setMicrophoneMode(mode),
        getScreenRotationAllowed: () => getScreenRotationAllowed(),
        setScreenRotationAllowed: (allowed, options = {}) => setScreenRotationAllowed(allowed, options),
        applyScreenRotationPreference: (options = {}) => applyScreenRotationPreference(options),
        setReply: (...args) => setReply(...args),
        setEditFromRow: (row) => setEditFromRow(row),
        setMobileBaseScene: (scene, options = {}) => syncMobileBaseSceneState({
          scene,
          hideInactive: Object.prototype.hasOwnProperty.call(options, 'hideInactive') ? !!options.hideInactive : true,
          syncChatMetrics: Boolean(options.syncChatMetrics),
          repaint: Boolean(options.repaint),
        }),
        getMobileBaseSceneSnapshot: () => ({
          scene: getResolvedMobileBaseScene(),
          routeTransitionActive: mobileRouteTransitionActive,
          sidebar: {
            sidebarHidden: sidebar?.classList?.contains('sidebar-hidden') || false,
            mobileSceneHidden: sidebar?.classList?.contains('mobile-scene-hidden') || false,
            inert: sidebar?.hasAttribute?.('inert') || false,
            ariaHidden: sidebar?.getAttribute?.('aria-hidden') || null,
          },
          chatArea: {
            mobileSceneHidden: chatArea?.classList?.contains('mobile-scene-hidden') || false,
            inert: chatArea?.hasAttribute?.('inert') || false,
            ariaHidden: chatArea?.getAttribute?.('aria-hidden') || null,
          },
        }),
        getMobileKeyboardDockSnapshot: () => mobileComposerGuard?.getMobileKeyboardDockSnapshot?.() || {},
        getPerformanceSummary: () => window.BananzaApp?.performance?.getSummary?.() || { marks: {}, measures: {}, entries: [] },
        resetPerformanceMarks: () => window.BananzaApp?.performance?.resetForTests?.(),
        getFeatureLoaderState: () => window.BananzaApp?.featureLoader?.getRegisteredFeatures?.() || [],
        loadFeatureForTest: (name) => window.BananzaApp?.featureLoader?.loadFeature?.(name),
        preloadFeatureForTest: (name) => window.BananzaApp?.featureLoader?.preloadFeature?.(name),
        preloadByStrategyForTest: (strategy) => window.BananzaApp?.featureLoader?.preloadByStrategy?.(strategy),
        installAiAdminRuntimeModulesForTest: () => installAiAdminRuntimeModules(),
      });
    
      weatherSettingsController.bindWidget();
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

      const __bananzaRuntimeExportNames = ["appBridge"];
      const __bananzaRuntimeExports = {};
      __bananzaRuntimeExportNames.forEach((name) => {
        Object.defineProperty(__bananzaRuntimeExports, name, {
          configurable: true,
          enumerable: true,
          get() { return eval(name); },
          set(__bananzaRuntimeExportValue) { eval(name + ' = __bananzaRuntimeExportValue'); },
        });
      });
      return __bananzaRuntimeExports;
    }
  }

  bootRoot.createRuntimePublicBridge = createRuntimePublicBridge;
})();
