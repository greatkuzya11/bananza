(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};
  const compositionRoot = bootRoot.composition = bootRoot.composition || {};

  compositionRoot.composeDomShell = function composeDomShell(scope = {}) {
    with (scope) {
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // DOM
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      const appDomApi = window.BananzaApp?.dom || {};
      const $ = typeof appDomApi.$ === 'function'
        ? (selector, root = document) => appDomApi.$(selector, root)
        : (selector, root = document) => root?.querySelector?.(selector) || null;
      const $$ = typeof appDomApi.$$ === 'function'
        ? (selector, root = document) => appDomApi.$$(selector, root)
        : (selector, root = document) => Array.from(root?.querySelectorAll?.(selector) || []);
    
      function createFallbackDomRefs() {
        const aliases = {
          composerAiOverrideDocumentFormatEl: 'composerAiOverrideDocumentFormat',
          composerAiOverrideDocumentWrap: 'composerAiOverrideDocumentWrap',
          composerAiOverrideEl: 'composerAiOverride',
          composerAiOverrideHint: 'composerAiOverrideHint',
          composerAiOverrideLabel: 'composerAiOverrideLabel',
          composerAiOverrideModeEl: 'composerAiOverrideMode',
          messagesEl: 'messages',
          pendingFileEl: 'pendingFile',
        };
        return new Proxy({ $, $$ }, {
          get(target, key) {
            if (Object.prototype.hasOwnProperty.call(target, key)) return target[key];
            if (key === 'chatHeader') return $('#chatView')?.querySelector('.chat-header') || null;
            if (key === 'inputArea') return $('#chatView')?.querySelector('.input-area') || null;
            if (key === 'inputRow') return $('#chatView')?.querySelector('.input-row') || null;
            if (typeof key !== 'string') return null;
            return document.getElementById(aliases[key] || key) || null;
          },
        });
      }
    
      const appDom = window.BananzaApp?.dom?.createDomRefs?.() || createFallbackDomRefs();
      appDom.$ = $;
      appDom.$$ = $$;
    
      const {
        sidebar,
        chatList,
        chatListStatus,
        chatListPullIndicator,
        chatListPullIcon,
        chatListPullLabel,
        sidebarSearch,
        chatSearch,
        chatSearchToggle,
        chatSearchClear,
        chatFoldersBtn,
        chatFolderContent,
        chatFolderListSurface,
        activeChatFolderBar,
        activeChatFolderStrip,
        activeChatFolderName,
        chatArea,
        emptyState,
        chatView,
        chatHeader,
        backBtn,
        chatTitle,
        chatHeaderAvatar,
        chatStatus,
        chatHeaderActions,
        searchBtn,
        chatShotBtn,
        chatSettingsActionBtn,
        chatInfoBtn,
        pinnedBar,
        messagesEl,
        loadMoreWrap,
        loadMoreBtn,
        loadMoreAfterWrap,
        typingBar,
        msgInput,
        composerRichPreview,
        inputArea,
        inputRow,
        mentionOpenBtn,
        sendBtn,
        scrollBottomBtn,
        composerContextConvertBtn,
        attachBtn,
        pollBtn,
        emojiBtn,
        fileInput,
        pendingFileEl,
        composerAiOverrideEl,
        composerAiOverrideLabel,
        composerAiOverrideHint,
        composerAiOverrideModeEl,
        composerAiOverrideDocumentWrap,
        composerAiOverrideDocumentFormatEl,
        emojiPicker,
        imageViewer,
        ivStrip,
        reactionPicker,
        reactionEmojiPopover,
        chatContextMenuBackdrop,
        chatContextMenu,
        chatFolderPickerBackdrop,
        chatFolderPicker,
        chatFolderContextMenuBackdrop,
        chatFolderContextMenu,
        mediaContextMenuBackdrop,
        mediaContextMenu,
        replyBar,
        replyBarName,
        replyBarText,
        searchPanel,
        searchPanelSheet,
        searchInput,
        searchResults,
        searchAllChatsToggle,
        dragOverlay,
        newChatModal,
        newFolderNameInput,
        newFolderChatSearchInput,
        newFolderChatList,
        createFolderBtn,
        adminModal,
        chatInfoModal,
        menuDrawer,
        currentUserInfo,
        weatherWidget,
        settingsModal,
        languageSettingsModal,
        themeSettingsModal,
        visualModeSettingsModal,
        pollStyleSettingsModal,
        animationSettingsModal,
        mobileFontSettingsModal,
        weatherSettingsModal,
        notificationSettingsModal,
        soundSettingsModal,
        aiBotSettingsModal,
        openAiTextBotsModal,
        openAiUniversalBotsModal,
        openAiImageBotsModal,
        contextConvertBotsModal,
        chatShotBotsModal,
        yandexAiSettingsModal,
        deepseekAiSettingsModal,
        deepseekAiTextBotsModal,
        qwenAiSettingsModal,
        qwenAiTextBotsModal,
        grokAiSettingsModal,
        grokAiTextBotsModal,
        grokAiImageBotsModal,
        grokAiUniversalBotsModal,
        changePasswordModal,
        forwardMessageModal,
        forwardChatSearch,
        forwardChatList,
        forwardMessageStatus,
        grokImageRiskConfirmModal,
        grokImageRiskTerms,
        grokImageRiskCancel,
        grokImageRiskConfirm,
        pollComposerModal,
        pollQuestionInput,
        pollOptionsList,
        pollComposerPreview,
        pollComposerStatus,
        pollVotersModal,
        pollVotersMeta,
        pollVotersTitle,
        pollVotersStatus,
        pollVotersList,
        chatFolderManageModal,
        chatFolderManageSaveBtn,
      } = appDom;
      const OPENAI_IMAGE_SIZE_OPTIONS = ['auto', '1024x1024', '1024x1536', '1536x1024'];
      const OPENAI_IMAGE_QUALITY_OPTIONS = ['auto', 'low', 'medium', 'high'];
      const OPENAI_IMAGE_BACKGROUND_OPTIONS = ['auto', 'transparent', 'opaque'];
      const OPENAI_IMAGE_OUTPUT_OPTIONS = ['png', 'webp', 'jpeg'];
      const DOCUMENT_FORMAT_OPTIONS = ['md', 'txt'];
      let mobileComposerGuard = null;
    
      const mobileViewportShell = window.BananzaApp?.mobileViewport?.createMobileViewportShell?.({
        document,
        window,
        dom: appDom,
        state: {
          getCurrentModalAnimation: () => currentModalAnimation,
          getIosComposerFocused: () => mobileComposerGuard?.getIosComposerFocused?.() || false,
          getMobileViewportPrevHeight: () => mobileViewportPrevHeight,
          getMobileVisualViewportBaselineHeight: () => mobileVisualViewportBaselineHeight,
          getMobileVisualViewportBaselineWidth: () => mobileVisualViewportBaselineWidth,
          setMobileVisualViewportBaselineHeight: (value) => {
            mobileVisualViewportBaselineHeight = Math.max(0, Number(value) || 0);
          },
          setMobileVisualViewportBaselineWidth: (value) => {
            mobileVisualViewportBaselineWidth = Math.max(0, Number(value) || 0);
          },
        },
        actions: {
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          isMobileViewportLayoutLocked: () => isMobileViewportLayoutLocked(),
          prefersReducedMotion: () => prefersReducedMotion(),
        },
      }) || {};
      const androidBridge = window.BananzaApp?.androidBridge || {
        hasAndroidNativeBridge: () => false,
        notifyAndroidScreenRotationPreference: () => false,
        notifyAndroidMobileFontSize: () => false,
      };
      const chatHeaderActionsShell = window.BananzaApp?.chatHeaderActions?.createChatHeaderActions?.({
        document,
        dom: appDom,
        state: {
          getChatHeaderActionsOpen: () => chatHeaderActionsOpen,
          setChatHeaderActionsOpen: (open) => {
            chatHeaderActionsOpen = Boolean(open);
            return chatHeaderActionsOpen;
          },
        },
      }) || null;
      mobileComposerGuard = window.BananzaApp?.shell?.createMobileComposerGuard?.({
        window,
        document,
        dom: appDom,
        mobileViewport: mobileViewportShell,
        controllers: {
          composerState: () => composerStateController,
          mentions: () => composerMentionsController,
          search: () => searchController,
          floatingActions: () => floatingMessageActionsController,
        },
        actions: {
          $,
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          isMobileViewportLayoutLocked: () => isMobileViewportLayoutLocked(),
          scheduleMobileViewportRecovery: (retryDelayMs) => scheduleMobileViewportRecovery(retryDelayMs),
          isFloatingSurfaceVisible: (el) => isFloatingSurfaceVisible(el),
          isContextConvertPickerActive: () => Boolean(contextConvertPickerState.active),
          hideMentionPicker: (...args) => hideMentionPicker(...args),
          hideContextConvertPicker: (...args) => hideContextConvertPicker(...args),
          hideFloatingMessageActions: (...args) => hideFloatingMessageActions(...args),
          hideAvatarUserMenu: (...args) => hideAvatarUserMenu(...args),
          clearActivePulseVoterPopover: (...args) => clearActivePulseVoterPopover(...args),
          closeEmojiPicker: (...args) => closeEmojiPicker(...args),
          closeFloatingSurface: (...args) => closeFloatingSurface(...args),
          rememberActiveElement: () => rememberActiveElement(),
          showMessageActions: (...args) => showMessageActions(...args),
        },
      }) || {};
    
      const appContext = appRuntime?.createContext ? appRuntime.createContext({
        config: {
          PAGE_SIZE,
          MESSAGE_CACHE_LIMIT,
          MAX_MSG,
          MAX_ATTACHMENTS,
        },
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          getChats: () => chats,
          runtimeState,
        },
        dom: appDom,
        services: {
          api: (url, opts) => api(url, opts),
          auth: authService,
          websocket: websocketService,
          androidBridge,
          chatHeaderActions: chatHeaderActionsShell,
          mobileViewport: mobileViewportShell,
          mobileComposerGuard,
          t,
          tx,
        },
        t,
        tx,
      }) : null;
      if (appContext) {
        appContext.dom = appDom;
        appContext.services = appContext.services || {};
        appContext.services.mobileViewport = mobileViewportShell;
        appContext.services.mobileComposerGuard = mobileComposerGuard;
        appContext.services.androidBridge = androidBridge;
        appContext.services.chatHeaderActions = chatHeaderActionsShell;
        appContext.services.auth = authService;
        appContext.services.websocket = websocketService;
        appContext.state.runtimeState = runtimeState;
      }
    
      const modalManagerFactory = window.BananzaApp?.modalManager?.createModalManager;
      if (typeof modalManagerFactory !== 'function') {
        throw new Error('BananzaApp modal manager module is required before app.js');
      }
      const modalManager = modalManagerFactory({
        document,
        window,
        dom: appDom,
        config: { MODAL_TRANSITION_BUFFER_MS },
        state: {
          getCurrentModalAnimation: () => currentModalAnimation,
          getCurrentModalAnimationSpeed: () => currentModalAnimationSpeed,
        },
        actions: {
          closeMediaViewer: () => closeMediaViewer(),
          closeMobileComposerTransientUi: (options) => closeMobileComposerTransientUi(options),
          dismissMobileComposer: (options) => dismissMobileComposer(options),
          forceIosAnimationMount: (...elements) => forceIosAnimationMount(...elements),
          getMobileComposerSafeReturnFocusEl: () => getMobileComposerSafeReturnFocusEl(),
          prefersReducedMotion: () => prefersReducedMotion(),
          scheduleMobileViewportRecovery: (retryDelayMs) => scheduleMobileViewportRecovery(retryDelayMs),
        },
        getCurrentModalAnimation: () => currentModalAnimation,
        getCurrentModalAnimationSpeed: () => currentModalAnimationSpeed,
        getModalAnimationSpeedFactor: (speed) => getModalAnimationSpeedFactor(speed),
      });
      if (appContext) appContext.services.modals = modalManager;
      const domShellExports = window.BananzaApp.boot.composition.createEvalExports(["appDomApi","createFallbackDomRefs","appDom","sidebar","chatList","chatListStatus","chatListPullIndicator","chatListPullIcon","chatListPullLabel","sidebarSearch","chatSearch","chatSearchToggle","chatSearchClear","chatFoldersBtn","chatFolderContent","chatFolderListSurface","activeChatFolderBar","activeChatFolderStrip","activeChatFolderName","chatArea","emptyState","chatView","chatHeader","backBtn","chatTitle","chatHeaderAvatar","chatStatus","chatHeaderActions","searchBtn","chatShotBtn","chatSettingsActionBtn","chatInfoBtn","pinnedBar","messagesEl","loadMoreWrap","loadMoreBtn","loadMoreAfterWrap","typingBar","msgInput","composerRichPreview","inputArea","inputRow","mentionOpenBtn","sendBtn","scrollBottomBtn","composerContextConvertBtn","attachBtn","pollBtn","emojiBtn","fileInput","pendingFileEl","composerAiOverrideEl","composerAiOverrideLabel","composerAiOverrideHint","composerAiOverrideModeEl","composerAiOverrideDocumentWrap","composerAiOverrideDocumentFormatEl","emojiPicker","imageViewer","ivStrip","reactionPicker","reactionEmojiPopover","chatContextMenuBackdrop","chatContextMenu","chatFolderPickerBackdrop","chatFolderPicker","chatFolderContextMenuBackdrop","chatFolderContextMenu","mediaContextMenuBackdrop","mediaContextMenu","replyBar","replyBarName","replyBarText","searchPanel","searchPanelSheet","searchInput","searchResults","searchAllChatsToggle","dragOverlay","newChatModal","newFolderNameInput","newFolderChatSearchInput","newFolderChatList","createFolderBtn","adminModal","chatInfoModal","menuDrawer","currentUserInfo","weatherWidget","settingsModal","languageSettingsModal","themeSettingsModal","visualModeSettingsModal","pollStyleSettingsModal","animationSettingsModal","mobileFontSettingsModal","weatherSettingsModal","notificationSettingsModal","soundSettingsModal","aiBotSettingsModal","openAiTextBotsModal","openAiUniversalBotsModal","openAiImageBotsModal","contextConvertBotsModal","chatShotBotsModal","yandexAiSettingsModal","deepseekAiSettingsModal","deepseekAiTextBotsModal","qwenAiSettingsModal","qwenAiTextBotsModal","grokAiSettingsModal","grokAiTextBotsModal","grokAiImageBotsModal","grokAiUniversalBotsModal","changePasswordModal","forwardMessageModal","forwardChatSearch","forwardChatList","forwardMessageStatus","grokImageRiskConfirmModal","grokImageRiskTerms","grokImageRiskCancel","grokImageRiskConfirm","pollComposerModal","pollQuestionInput","pollOptionsList","pollComposerPreview","pollComposerStatus","pollVotersModal","pollVotersMeta","pollVotersTitle","pollVotersStatus","pollVotersList","chatFolderManageModal","chatFolderManageSaveBtn","OPENAI_IMAGE_SIZE_OPTIONS","OPENAI_IMAGE_QUALITY_OPTIONS","OPENAI_IMAGE_BACKGROUND_OPTIONS","OPENAI_IMAGE_OUTPUT_OPTIONS","DOCUMENT_FORMAT_OPTIONS","mobileComposerGuard","mobileViewportShell","androidBridge","chatHeaderActionsShell","appContext","modalManagerFactory","modalManager"], {
        get: (name) => eval(name),
        set: (name, value) => {
          const __bananzaRuntimeExportValue = value;
          eval(name + ' = __bananzaRuntimeExportValue');
        },
      });
      Object.defineProperty(domShellExports, '$', { configurable: true, enumerable: true, writable: true, value: $ });
      Object.defineProperty(domShellExports, '$$', { configurable: true, enumerable: true, writable: true, value: $$ });
      return domShellExports;
    }
  };
})();
