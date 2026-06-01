(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function composeFeatureRuntime(scope = {}) {
    scope.__bananzaRuntimeScope = scope;
    with (scope) {
      const publishRuntimeApi = (api) => {
        const targetScope = __bananzaRuntimeScope;
        Object.keys(api || {}).forEach((name) => {
          if (!Object.prototype.hasOwnProperty.call(targetScope, name)) {
            targetScope[name] = api[name];
          }
        });
        return api;
      };

      const composerFactories = window.BananzaApp?.composer || {};
      const composerStateFactory = composerFactories.state?.createComposerState;
      const composerTextFactory = composerFactories.text?.createComposerTextController;
      const composerReplyEditFactory = composerFactories.replyEdit?.createReplyEditController;
      const composerFilesFactory = composerFactories.files?.createComposerFilesController;
      const composerSendFactory = composerFactories.send?.createComposerSendController;
      const composerEmojiPickerFactory = composerFactories.emojiPicker?.createEmojiPickerController;
      const composerMentionsFactory = composerFactories.mentions?.createMentionPickerController;
      const composerTypingDragDropFactory = composerFactories.typingDragDrop?.createTypingDragDropController;
      const pollComposerFactory = composerFactories.pollComposer?.createPollComposerController;
      const interactionFactories = window.BananzaApp?.interactions || {};
      const searchControllerFactory = interactionFactories.search?.createSearchController;
      const reactionControllerFactory = interactionFactories.reactions?.createReactionController;
      const floatingMessageActionsFactory = interactionFactories.floatingActions?.createFloatingMessageActions;
      const mediaViewerFactory = interactionFactories.mediaViewer?.createMediaViewer;
      const contextMenusFactory = interactionFactories.contextMenus?.createContextMenus;
      const forwardingControllerFactory = interactionFactories.forwarding?.createForwardingController;
      if (typeof composerStateFactory !== 'function'
        || typeof composerTextFactory !== 'function'
        || typeof composerReplyEditFactory !== 'function'
        || typeof composerFilesFactory !== 'function'
        || typeof composerSendFactory !== 'function'
        || typeof composerEmojiPickerFactory !== 'function'
        || typeof composerMentionsFactory !== 'function'
        || typeof composerTypingDragDropFactory !== 'function'
        || typeof pollComposerFactory !== 'function') {
        throw new Error('BananzaApp composer modules are required before app.js');
      }
      if (typeof searchControllerFactory !== 'function'
        || typeof reactionControllerFactory !== 'function'
        || typeof floatingMessageActionsFactory !== 'function'
        || typeof mediaViewerFactory !== 'function'
        || typeof contextMenusFactory !== 'function'
        || typeof forwardingControllerFactory !== 'function') {
        throw new Error('BananzaApp interaction modules are required before app.js');
      }
      const composerStateController = composerStateFactory({
        storage: localStorage,
        maxDraftLength: MAX_MSG,
        getCurrentUser: () => currentUser,
      });
      let composerTextController = null;
      let composerReplyEditController = null;
      let composerFilesController = null;
      let composerSendController = null;
      let composerEmojiPickerController = null;
      let composerMentionsController = null;
      let composerTypingDragDropController = null;
      let pollComposerController = null;
      let searchController = null;
      let reactionController = null;
      let floatingMessageActionsController = null;
      let mediaViewerController = null;
      let contextMenusController = null;
      let forwardingController = null;

      function clamp(value, min, max) {
        return floatingMessageActionsController?.clamp?.(value, min, max) ?? Math.max(min, Math.min(value, max));
      }
    
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

      function createRuntimeProxyScope() {
        const scope = Object.create(null);
        Object.assign(scope, {
          window, document, console: window.console || console, $, $$,
          Math: window.Math || Math, Date: window.Date || Date, Number: window.Number || Number,
          String: window.String || String, Boolean: window.Boolean || Boolean, Array: window.Array || Array,
          Object: window.Object || Object, Promise: window.Promise || Promise, Set: window.Set || Set,
          Map: window.Map || Map, JSON: window.JSON || JSON, URL: window.URL,
          FormData: window.FormData, Blob: window.Blob, File: window.File, FileReader: window.FileReader,
          localStorage: window.localStorage, sessionStorage: window.sessionStorage, navigator: window.navigator,
          location: window.location, history: window.history,
          alert: window.alert?.bind?.(window), confirm: window.confirm?.bind?.(window),
          fetch: window.fetch?.bind?.(window),
          setTimeout: window.setTimeout?.bind?.(window), clearTimeout: window.clearTimeout?.bind?.(window),
          requestAnimationFrame: window.requestAnimationFrame?.bind?.(window) || ((callback) => window.setTimeout(callback, 16)),
          cancelAnimationFrame: window.cancelAnimationFrame?.bind?.(window) || ((id) => window.clearTimeout(id)),
        });
        return new Proxy(scope, {
          has() { return true; },
          get(target, key) {
            if (key === Symbol.unscopables) return undefined;
            if (Object.prototype.hasOwnProperty.call(target, key)) return target[key];
            if (typeof key === 'string' && key in window) return window[key];
            if (typeof key === 'string' && /^[A-Za-z_$][\w$]*$/.test(key)) {
              try { return eval(key); } catch (error) { return undefined; }
            }
            return undefined;
          },
          set(target, key, value) {
            if (typeof key === 'string' && /^[A-Za-z_$][\w$]*$/.test(key)) {
              const __bananzaAiAdminScopeValue = value;
              try { eval(key + ' = __bananzaAiAdminScopeValue'); return true; } catch (error) {}
            }
            target[key] = value;
            return true;
          },
        });
      }

      const aiAdminController = window.BananzaApp?.aiAdmin?.createController?.({
        window,
        document,
        ctx,
        dom: appDom,
      }) || null;
      const aiAdminRuntimeApi = aiAdminController?.installRuntimeModules?.(createRuntimeProxyScope()) || {};
      const {
        setInlineStatus, resolveActionButtons, setActionButtonsPending, withActionButtons, bindAsyncActionButtons, setOpenAiStatus,
        setAiBotModalStatus, setAiBotSettingsStatus, setAiBotStatus, setAiBotTextModalStatus, setAiBotChatStatus, setAiModelStatus,
        uniqueAiModelValues, setAiModelSelectOptions, setStaticSelectOptions, syncSharedOpenAiSettings, syncSharedGrokSettings, renderAiModelOptions,
        loadAiModelOptions, mergeAiBotState, currentAiBot, setOpenAiUniversalModalStatus, setOpenAiUniversalStatus, setOpenAiUniversalChatStatus,
        mergeOpenAiUniversalState, currentOpenAiUniversalBot, getOpenAiUniversalChatSetting, renderOpenAiUniversalModelOptions, renderOpenAiUniversalBotAvatar, renderOpenAiUniversalBotList,
        fillOpenAiUniversalBotForm, openAiUniversalBotFormPayload, renderOpenAiUniversalChatBotSettings, renderOpenAiUniversalSettings, getAiChatSetting, renderAiBotAvatar,
        refreshRenderedAiBotAvatar, providerInteractiveEnabled, providerInteractiveSummary, normalizeBotSaveComparisonValue, verifyBotSaveResponse, buildVerifiedBotSaveStatus,
        fillAiBotForm, aiBotFormPayload, renderAiBotList, renderAiChatBotSettings, renderOpenAiProviderSettings, renderOpenAiTextBotsSettings,
        renderAiBotSettings, aiBotSettingsPayload, persistAiBotSettings, loadAiBotState, saveAiBotSettings, deleteAiBotKey,
        saveAiBot, uploadAiBotAvatar, removeAiBotAvatar, disableAiBot, testAiBot, filenameFromContentDisposition,
        exportAiBotJson, importAiBotJsonFile, saveAiChatBotSettings, loadOpenAiUniversalState, syncOpenAiUniversalBotUser, saveOpenAiUniversalBot,
        uploadOpenAiUniversalBotAvatar, removeOpenAiUniversalBotAvatar, disableOpenAiUniversalBot, testOpenAiUniversalBot, exportOpenAiUniversalBotJson, importOpenAiUniversalBotJsonFile,
        saveOpenAiUniversalChatBotSettings, setOpenAiImageModalStatus, setOpenAiImageStatus, setOpenAiImageChatStatus, mergeOpenAiImageState, currentOpenAiImageBot,
        getOpenAiImageChatSetting, renderOpenAiImageModelOptions, renderOpenAiImageBotAvatar, renderOpenAiImageBotList, fillOpenAiImageBotForm, openAiImageBotFormPayload,
        renderOpenAiImageChatBotSettings, renderOpenAiImageSettings, loadOpenAiImageState, syncOpenAiImageBotUser, saveOpenAiImageBot, uploadOpenAiImageBotAvatar,
        removeOpenAiImageBotAvatar, disableOpenAiImageBot, testOpenAiImageBot, exportOpenAiImageBotJson, importOpenAiImageBotJsonFile, saveOpenAiImageChatBotSettings,
        setDeepseekAiStatus, setDeepseekAiProviderStatus, setDeepseekAiBalanceStatus, setDeepseekBotStatus, setDeepseekChatStatus, setDeepseekAiModelStatus,
        currentDeepseekBot, getDeepseekChatSetting, mergeDeepseekAiState, renderDeepseekModelOptions, renderDeepseekBotAvatar, fillDeepseekBotForm,
        deepseekBotFormPayload, renderDeepseekBotList, renderDeepseekChatBotSettings, renderDeepseekAiSettings, deepseekAiSettingsPayload, persistDeepseekAiSettings,
        loadDeepseekAiState, saveDeepseekAiSettings, testDeepseekAiConnection, formatDeepseekBalanceValue, formatDeepseekBalanceResult, checkDeepseekAiBalance,
        refreshDeepseekAiModels, deleteDeepseekAiKey, saveDeepseekBot, uploadDeepseekBotAvatar, removeDeepseekBotAvatar, disableDeepseekBot,
        testDeepseekBot, exportDeepseekBotJson, importDeepseekBotJsonFile, saveDeepseekChatBotSettings, setQwenAiStatus, setQwenAiProviderStatus,
        setQwenBotStatus, setQwenChatStatus, setQwenAiModelStatus, currentQwenBot, getQwenChatSetting, mergeQwenAiState,
        renderQwenModelOptions, renderQwenBotAvatar, fillQwenBotForm, qwenBotFormPayload, renderQwenBotList, renderQwenChatBotSettings,
        renderQwenAiSettings, qwenAiSettingsPayload, persistQwenAiSettings, loadQwenAiState, saveQwenAiSettings, testQwenAiConnection,
        refreshQwenAiModels, deleteQwenAiKey, saveQwenBot, uploadQwenBotAvatar, removeQwenBotAvatar, disableQwenBot,
        testQwenBot, exportQwenBotJson, importQwenBotJsonFile, saveQwenChatBotSettings, setYandexAiStatus, setYandexAiProviderStatus,
        setYandexBotStatus, setYandexChatStatus, setYandexAiModelStatus, formatUiErrorMessage, currentYandexBot, getYandexChatSetting,
        mergeYandexAiState, renderYandexModelOptions, renderYandexBotAvatar, fillYandexBotForm, yandexBotFormPayload, renderYandexBotList,
        renderYandexChatBotSettings, renderYandexAiSettings, yandexAiSettingsPayload, persistYandexAiSettings, loadYandexAiState, saveYandexAiSettings,
        testYandexAiConnection, refreshYandexAiModels, deleteYandexAiKey, saveYandexBot, uploadYandexBotAvatar, removeYandexBotAvatar,
        disableYandexBot, testYandexBot, exportYandexBotJson, importYandexBotJsonFile, saveYandexChatBotSettings,
        GROK_TEXT_BOT_DIRTY_STATUS, setGrokStatus, setGrokAiStatus, setGrokTextStatus, setGrokImageStatus, setGrokUniversalStatus,
        setGrokAiProviderStatus, setGrokTextEditorStatus, setGrokImageEditorStatus, setGrokUniversalEditorStatus, setGrokTextChatStatus, setGrokImageChatStatus,
        setGrokUniversalChatStatus, setGrokBotStatus, setGrokAiModelStatus, wireAiBotToggleLabels, currentGrokBot, currentGrokImageBot,
        currentGrokUniversalBot, getGrokChatSetting, getGrokImageChatSetting, getGrokUniversalChatSetting, mergeGrokAiState, mergeGrokUniversalState,
        renderNamedGrokAvatar, renderGrokBotAvatar, renderGrokImageBotAvatar, renderGrokUniversalBotAvatar, mountGrokBotPanels, renderGrokGlobalTextModelOptions,
        renderGrokBotModelOptions, renderGrokUniversalBotModelOptions, renderGrokGlobalImageModelOptions, renderGrokImageBotModelOptions, renderGrokBotList, renderGrokImageBotList,
        renderGrokUniversalBotList, fillGrokBotForm, fillGrokImageBotForm, fillGrokUniversalBotForm, grokBotFormPayload, formatCapabilityState,
        currentGrokTextBotFormFingerprint, refreshGrokTextBotDirtyState, syncGrokTextBotFormFingerprint, grokImageBotFormPayload, grokUniversalBotFormPayload, renderGrokChatBotSettings,
        renderGrokImageChatBotSettings, renderGrokUniversalChatBotSettings, renderGrokAiSettings, renderGrokTextBotsSettings, renderGrokImageBotsSettings, renderGrokUniversalBotsSettings,
        grokAiSettingsPayload, persistGrokAiSettings, loadGrokAiState, syncGrokBotUser, saveGrokAiSettings, testGrokAiConnection,
        refreshGrokAiModels, deleteGrokAiKey, saveGrokBot, saveGrokImageBot, uploadGrokBotAvatar, removeGrokBotAvatar,
        disableGrokBot, testGrokBot, exportGrokBotJson, importGrokBotJsonFile, saveGrokChatBotSettings, saveGrokImageChatBotSettings,
        loadGrokUniversalState, saveGrokUniversalBot, uploadGrokUniversalBotAvatar, removeGrokUniversalBotAvatar, disableGrokUniversalBot, testGrokUniversalBot,
        exportGrokUniversalBotJson, importGrokUniversalBotJsonFile, saveGrokUniversalChatBotSettings, retryGrokImageRiskPrompt, jumpToSavedOriginal, normalizeMentionTarget,
        escapeRegExpText, extractMentionTokensFromText, isGrokImageBotTarget, isUniversalBotTarget, isGrokUniversalBotTarget, grokUniversalTargetAllowsImage,
        buildReplyBotTarget, getDirectPrivateAiBotTarget, getUniversalBotModes, resolveComposerUniversalBotTarget, renderComposerAiOverride, updateComposerAiOverrideState,
        getComposerAiOverridePayload, stripTriggeredBotMention, resolveTriggeredGrokImageBot, analyzeOutgoingGrokImageRisk, renderGrokImageRiskTerms, openGrokImageRiskConfirm,
        contextConvertProviderLabel, providerAccent, contextConvertRouteBase, currentContextConvertAdminState, currentContextConvertAdminBot, getContextConvertChatSetting,
        setContextConvertInlineStatus, setContextConvertModalStatus, setContextConvertBotStatus, setContextConvertChatStatus, mergeContextConvertAdminState, renderContextConvertBotList,
        renderContextConvertForm, renderContextConvertChatSettings, renderContextConvertAdminSettings, contextConvertAdminFormPayload, loadContextConvertAdminState, openContextConvertBotsModal,
        saveContextConvertAdminBot, disableContextConvertAdminBot, testContextConvertAdminBot, exportContextConvertAdminBot, importContextConvertAdminBot, saveContextConvertAdminChatSetting,
        chatShotRouteBase, currentChatShotAdminState, currentChatShotAdminBot, getChatShotAdminChatSetting, setChatShotModalStatus, setChatShotBotStatus,
        setChatShotAdminChatStatus, mergeChatShotAdminState, renderChatShotBotList, renderChatShotAdminForm, renderChatShotAdminChatSettings, renderChatShotAdminSettings,
        chatShotAdminFormPayload, loadChatShotAdminState, openChatShotBotsModal, saveChatShotAdminBot, disableChatShotAdminBot, testChatShotAdminBot,
        exportChatShotAdminBot, importChatShotAdminBot, saveChatShotAdminChatSetting, normalizeContextConvertAvailability, loadContextConvertAvailability, invalidateContextConvertAvailability,
        normalizeChatShotState, getCurrentChatShotState, setChatShotChatStatus, loadChatShotState, invalidateChatShotState, renderChatShotForm,
        saveChatShotChatSetting, syncChatShotButton, runChatShotGeneration, ensureContextConvertPickerBackdrop, ensureContextConvertPicker, positionContextConvertPicker,
        renderContextConvertPicker, hideContextConvertPicker, getCurrentChatContextConvertState, isContextTransformAvailableForChat, setComposerContextConvertButtonVisible, canContextConvertMessage,
        canRestoreContextOriginalMessage, bindContextConvertMessageButton, createContextConvertMessageButton, bindContextOriginalRestoreButton, syncVisibleContextConvertMessageButtons, syncCurrentChatContextConvertUi,
        syncContextConvertComposerButton, openComposerContextConvertPicker, transformComposerTextWithContextConvertBot, syncContextConvertPendingMessageState, syncContextOriginalRestorePendingMessageState, transformMessageWithContextConvertBot,
        restoreContextOriginalMessage, openMessageContextConvertPicker,
      } = aiAdminRuntimeApi;

      const uiRuntimeApi = window.BananzaApp?.shell?.uiRuntimeAdapter?.createUiRuntimeAdapter?.(createRuntimeProxyScope()) || {};
      const {
        isMobileLayoutViewport, normalizeMobileBaseScene, clearMobileSceneRepaint, getResolvedMobileBaseScene, isMobileBaseSceneHardHidden, setMobileSceneElementState,
        clearMobileSceneElementState, scheduleActiveMobileSceneRepaint, syncMobileBaseSceneState, getComposerTextValue, setComposerTextValue, normalizeComposerInputValue,
        snapComposerSelectionToCustomEmojiBoundary, insertComposerTextAtSelection, normalizeMicrophoneMode, getMicrophoneMode, setMicrophoneMode, getScreenRotationAllowed,
        syncScreenRotationToggle, setScreenRotationStatus, clearScreenRotationStatusSoon, applyScreenRotationPreference, setScreenRotationAllowed, insertDictatedText,
        getEmojiPickerInsertionValue, deleteComposerCustomEmojiCluster, handleComposerCustomEmojiKeydown, handleComposerCustomEmojiBeforeInput, safeVibrate, linkify,
        mentionKey, renderMessageText, normalizeUiTheme, renderThemePicker, applyUiTheme, selectUiTheme,
        setThemeStatus, normalizeUiLanguage, languageDisplayName, renderLanguagePicker, applyUiLanguage, selectUiLanguage,
        refreshLocalizedUi, syncLanguageSettingsButton, setLanguageStatus, normalizeVisualMode, visualModeMeta, visualModeStateLabel,
        renderVisualModePicker, applyVisualMode, selectVisualMode, setVisualModeStatus, normalizePollStyle, pollStyleMeta,
        renderPollStyleCardPreview, renderPollStylePicker, setPollStyleSurface, syncPollComposerStyleUi, selectPollStyle, setPollStyleStatus,
        normalizeModalAnimationStyle, modalAnimationMeta, syncModalAnimationSettingsButton, normalizeModalAnimationSpeed, getModalAnimationSpeedFactor, setModalAnimationStatus,
        clearModalAnimationStatusTimer, scheduleModalAnimationStatusClear, getPersistedModalAnimationPreferences, getCurrentModalAnimationPreferences, modalAnimationPreferencesEqual, renderModalAnimationOptions,
        renderModalAnimationSpeedControl, applyModalAnimation, applyModalAnimationSpeed, flushModalAnimationSave, scheduleModalAnimationSave, selectModalAnimation,
        updateModalAnimationSpeed, normalizeMobileFontSize, getMobileFontAdjustPercent, hasAndroidNativeBridge, notifyAndroidScreenRotationPreference, setMobileFontAdjustPercent,
        notifyAndroidMobileFontSize, syncMobileFontSettingsButton, setMobileFontSizeStatus, clearMobileFontSizeStatusTimer, scheduleMobileFontSizeStatusClear, getPersistedMobileFontSize,
        renderMobileFontSizeControl, applyMobileFontSize, syncMobileFontSizeViewportState, flushMobileFontSizeSave, scheduleMobileFontSizeSave, updateMobileFontSize,
        getSingleEmojiPattern, splitGraphemes, isSingleEmojiMessage, applyPosterToVideoElement, markAttachmentPosterAvailable, ensureAttachmentPoster,
        localAttachmentFromFile, makeClientId, isClientSideMessage, setPollComposerStatus, readPollComposerForm, renderPollComposerOptionInputs,
        refreshPollComposerActionState, buildPollComposerPreviewMessage, refreshPollComposerPreview, resetPollComposer, openPollComposer, avatarHtml,
        isAiBotDirectoryUser, botMentionText, botModelText, botChatMemberMetaText, userSecondaryLineText, renderSelectableUserItem,
        renderChatMemberItem, formatBotAuditSource, ensureBotVisibilityToggles, setBotVisibilityToggle, getBotVisibilityToggle, updateCurrentUserFooter,
        persistCurrentUser, syncChatAreaMetrics, syncMobileAppHeightToViewport, forceMobileViewportLayoutSync, scheduleMobileViewportRecovery, setupMobileViewportHeightSync,
        setupChatAreaMetricsSync, isAbortError, isCurrentChatOpenTransition, isUiTransitionBusy, isMobileViewportLayoutLocked, syncChatAreaMetricsFromViewport,
        flushDeferredRecoverySync, setChatHydrating, revealChatHydration, beginMobileRouteTransition, endMobileRouteTransition, isChatSearchOpen,
        focusChatSearchInput, setChatSearchOpen, setChatFolderManageStatus, chatFolderIconEmoji, chatFolderEmojiMarkup, chatFolderIconMarkup,
        normalizeChatFolderId, shouldShowActiveChatFolderBar, activeChatFolderStripRows, getRenderedChatFolderSelectionId, isChatFolderStripVisibleInAllChatsEnabled, syncChatFolderPickerAllChatsToggleState,
        applyChatFolderStripVisibilityInAllChats, saveChatFolderStripVisibilityInAllChats, shouldShowChatFolderBarForSelection, chatFolderStripStructureSignature, chatFolderStripLabelForSelection, setPendingChatFolderChipCenterBehavior,
        cancelScheduledActiveChatFolderChipCenter, centerActiveChatFolderChip, scheduleActiveChatFolderChipCenter, renderChatFolderStripStructure, syncActiveChatFolderStripState, renderActiveChatFolderBar,
        beginChatFolderStripPreview, finalizeChatFolderStripPreview, getChatFolderSwitchTargets, resetChatFolderSwitchAnimations, destroyChatFolderSwipePager, resetChatFolderSwipeSurface,
        waitForAnimationFrames, waitForMs, playChatFolderSwitchPhase, canAnimateChatFolderContent, animateChatFolderContentEntry, getChatFolderPageRows,
        getChatFolderPageIndex, getAdjacentChatFolderPage, getChatFolderSwipeSurfaceWidth, getChatFolderSwipeCommitDistance, canAnimateChatFolderSwipe, getChatFolderSwipeTransformTarget,
        createChatFolderSwipePage, prepareChatFolderSwipePager, setChatFolderSwipeOffset, settleChatFolderSwipeOffset, snapChatFolderSwipeBack, transitionToChatFolderBySwipe,
        transitionToChatFolder, setActiveChatFolder, loadChatFolders, setAvatarElementVisual, renderCurrentChatHeader, refreshChatInfoPresentation,
        syncChatInfoStatusVisibility, refreshRenderedUserMessages, applyChatUpdate, applyCurrentUserUpdateFromPresence, patchChatMembersCacheForPresence, patchMentionTargetsForPresence,
        patchAiBotUserForPresence, refreshMentionPickerForUserUpdate, applyUserUpdate, weatherLocationLabel, weatherIcon, formatWeatherValue,
        renderWeatherWidget, setWeatherStatus, renderWeatherSettingsForm, renderWeatherSearchResults, scheduleWeatherRefresh, loadWeatherSettings,
        loadCurrentWeather, searchWeatherLocations, saveWeatherSettings, isLocalhost, isPushSupported, setNotificationStatus,
        notificationPermissionLabel, renderNotificationSettingsForm, loadNotificationSettings, saveNotificationSettings, enablePushNotifications, disablePushOnThisDevice,
        testPushNotification, refreshPushDeviceState, applySoundSettings, setSoundStatus, renderSoundSettingsForm, getSoundSettingsFromForm,
        loadSoundSettings, saveSoundSettings, scheduleSoundSettingsSave, playAppSound, previewSound, previewAllSounds,
        getChatById, isChatPinned, getActiveChatFolder, isAllChatsFolderActive, getFolderPinnedChatOrder, isChatPinnedInFolder,
        compareChatsForFolder, folderSummaryText, sortChatsInPlace, getPinnedChats, getPinnedChatMoveState, isNotesChat,
        isCurrentNotesChat, isChatNotificationEnabled, isChatIncomingSoundEnabled, isPinNotificationEnabled, isPinSoundEnabled, isMentionSoundEnabled,
        isMessageMentioningCurrentUser, setChatPreferencesStatus, renderChatPreferencesForm, loadChatPreferences, saveChatPreferences, chatAllowsUnpinAnyPin,
        canManagePinSettings, isGeneralChat, isGroupOrPrivateChat, canHideChat, canLeaveChat, canManageDestructiveChat,
        setChatPinSettingsStatus, renderChatPinSettingsForm, canManageContextTransformSettings, setChatContextTransformStatus, renderChatContextTransformForm, saveChatContextTransformSetting,
        setChatDangerStatus, renderChatDangerControls, saveChatPinSettings, normalizePin, normalizePins, getPinPreviewText,
        getPinActorName, getPinToastText, buildPinBrowserNotification, getChatPins, getPinForMessage, canUnpinPin,
        getPinActionState, renderPinActionButton, applyPinsUpdate, handlePinnedMessageUpdate, loadChatPins, renderPinnedBar,
        jumpToPinnedMessage, pinMessage, unpinPin, togglePinFromRow, refreshVisiblePinButtons, resolveUiTarget,
        getPayloadChatId, handleServiceWorkerMessage, chatItemAvatarHtml, loadHiddenChatSearch, scheduleHiddenChatSearch, openHiddenChatFromSearch,
        openPrivateChatFromDirectory, showCenterToast, suppressNextChatItemTap, getFolderPinnedChatMoveState, renderFolderSelectableChatItem, totalUnreadForFolder,
        visibleChatCountForFolder, renderChatFolderPicker, positionChatFolderPicker, hideChatFolderContextMenu, renderChatFolderContextMenu, positionChatFolderContextMenu,
        refreshChatFolderContextMenu, showChatFolderContextMenu, hideChatFolderPicker, showChatFolderPicker, createChatFolder, renameChatFolder,
        deleteChatFolder, setChatFolderOrder, moveChatFolder, addChatsToFolder, removeChatFromFolder, setFolderChatPin,
        moveFolderChatPin, handleChatFolderContextMenuAction, resetChatFolderManageModal, renderChatFolderManageModal, openChatFolderManageModal, saveChatFolderManageChanges,
        setChatSidebarPin, moveChatSidebarPin, clearCachedChat, resetChatPreviewAfterHistoryClear, revealChatListAfterActiveChatClose, closeChatViewForChat,
        removeChatLocally, clearLocalChatHistory, hideChatFromList, leaveChat, deleteChatCompletely, clearChatHistoryForEveryone,
        copyTextToClipboard, modalEntryOf, rememberActiveElement, focusElementIfPossible, blurFocusedElementWithin, parseTransitionTimeMs,
        getElementTransitionTotalMs, registerModal, handleGrokImageRiskModalClosed, ensureDeepseekTextBotsModalContent, ensureQwenTextBotsModalContent, registerBuiltinModals,
        getTopModal, hasOpenModal, openModal, closeModal, closeTopModal, closeAllModals,
        loadMentionTargets, suppressMentionPickerFollowupClick, suppressContextConvertPickerFollowupClick, clearContextConvertPickerFollowupClickSuppress, ensureMentionPickerBackdrop, ensureMentionPicker,
        isComposerMeaningfullyEmpty, getManualMentionRange, syncMentionOpenButton, hideMentionPicker, findMentionTrigger, positionMentionPicker,
        renderMentionPicker, openMentionPickerFromButton, updateMentionPicker, insertMentionTarget, insertMentionTokenIntoComposer, insertRawMentionTriggerAtCursor,
        openPrivateChatWithUser, handleMentionPickerKeydown, handleMentionClick, isGroupLikeCurrentChat, ensureAvatarUserMenu, hideAvatarUserMenu,
        positionAvatarUserMenu, avatarMenuTargetFromEl, openAvatarUserMenu, singleEmojiPattern,
      } = uiRuntimeApi;
      publishRuntimeApi(uiRuntimeApi);

      const adminBotAuditFactory = window.BananzaApp?.admin?.botAudit?.createBotAuditController;
      const adminBackupFactory = window.BananzaApp?.admin?.backup?.createBackupController;
      const adminUsersFactory = window.BananzaApp?.admin?.users?.createAdminUsersController;
      if (typeof adminBotAuditFactory !== 'function'
        || typeof adminBackupFactory !== 'function'
        || typeof adminUsersFactory !== 'function') {
        throw new Error('BananzaApp admin modules are required before app.js');
      }
      const adminBotAuditController = adminBotAuditFactory({
        document,
        $,
        api: (url, opts) => api(url, opts),
        esc,
        avatarHtml,
        formatDate,
        formatTime,
        openModal: (id, options = {}) => openModal(id, options),
      });
      const adminBackupController = adminBackupFactory({
        document,
        window,
        $,
        api: (url, opts) => api(url, opts),
        fetch: (url, opts) => window.fetch(url, opts),
        openModal: (id, options = {}) => openModal(id, options),
        getTopModal: () => getTopModal(),
        setInlineStatus: (id, message, type = '') => setInlineStatus(id, message, type),
        tx,
        esc,
        formatSize,
        filenameFromContentDisposition,
        getCurrentUser: () => currentUser,
        getToken: () => token,
        onRestoreApplied: () => {
          websocketService.clearReconnectTimer?.();
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          token = null;
          currentUser = null;
          if (ws) {
            try { ws.onclose = null; ws.close(1012, 'Backup restore'); } catch (e) {}
            ws = null;
          }
          syncCoreStateToRuntime();
          setTimeout(() => {
            location.href = '/login.html';
          }, 900);
        },
      });
      const adminUsersController = adminUsersFactory({
        document,
        $,
        api: (url, opts) => api(url, opts),
        openModal: (id, options = {}) => openModal(id, options),
        getTopModal: () => getTopModal(),
        getOnlineUsers: () => onlineUsers,
        avatarHtml,
        esc,
        formatDate,
        formatTime,
        alert: (message) => alert(message),
        confirm: (message) => confirm(message),
        openAdminBotAuditModal: (userId, displayName) => openAdminBotAuditModal(userId, displayName),
      });
      if (appContext) {
        appContext.services.admin = {
          users: adminUsersController,
          botAudit: adminBotAuditController,
          backup: adminBackupController,
        };
      }
    
      const uiSettingsFactory = window.BananzaApp?.settings?.ui?.createUiSettings;
      const weatherSettingsFactory = window.BananzaApp?.settings?.weather?.createWeatherSettings;
      const notificationSettingsFactory = window.BananzaApp?.settings?.notifications?.createNotificationSettings;
      const soundSettingsFactory = window.BananzaApp?.settings?.sound?.createSoundSettings;
      const settingsModalFactory = window.BananzaApp?.settings?.modal?.createSettingsModal;
      if (typeof uiSettingsFactory !== 'function'
        || typeof weatherSettingsFactory !== 'function'
        || typeof notificationSettingsFactory !== 'function'
        || typeof soundSettingsFactory !== 'function'
        || typeof settingsModalFactory !== 'function') {
        throw new Error('BananzaApp settings modules are required before app.js');
      }
    
      function setCurrentUserFromSettings(nextUser = null, { persist = true } = {}) {
        currentUser = nextUser;
        syncCoreStateToRuntime();
        if (currentUser && persist) persistCurrentUser();
        return currentUser;
      }
    
      const uiSettings = uiSettingsFactory({
        document,
        window,
        dom: appDom,
        config: appConfig,
        api: (url, opts) => api(url, opts),
        modals: modalManager,
        androidBridge,
        mobileViewport: mobileViewportShell,
        i18nHelpers,
        esc,
        getCurrentUser: () => currentUser,
        setCurrentUser: setCurrentUserFromSettings,
        state: {
          getCurrentUiTheme: () => currentUiTheme,
          setCurrentUiTheme: (value) => { currentUiTheme = value; },
          getCurrentVisualMode: () => currentVisualMode,
          setCurrentVisualMode: (value) => { currentVisualMode = value; },
          getPollComposerStyle: () => pollComposerStyle,
          setPollComposerStyle: (value) => { pollComposerStyle = value; },
          getCurrentModalAnimation: () => currentModalAnimation,
          setCurrentModalAnimation: (value) => { currentModalAnimation = value; },
          getCurrentModalAnimationSpeed: () => currentModalAnimationSpeed,
          setCurrentModalAnimationSpeed: (value) => { currentModalAnimationSpeed = value; },
          getCurrentMobileFontSize: () => currentMobileFontSize,
          setCurrentMobileFontSize: (value) => { currentMobileFontSize = value; },
          getCurrentUiLanguage: () => currentUiLanguage,
          setCurrentUiLanguage: (value) => { currentUiLanguage = value; },
          getMicrophoneMode: () => microphoneMode,
          setMicrophoneMode: (value) => { microphoneMode = value; },
          getScreenRotationAllowed: () => screenRotationAllowed,
          setScreenRotationAllowed: (value) => { screenRotationAllowed = Boolean(value); },
          getSendByEnter: () => sendByEnter,
          setSendByEnter: (value) => { sendByEnter = Boolean(value); },
          getScrollRestoreMode: () => scrollRestoreMode,
          setScrollRestoreMode: (value) => { scrollRestoreMode = value === 'restore' ? 'restore' : 'bottom'; },
          getOpenLastChatOnReload: () => openLastChatOnReload,
          setOpenLastChatOnReload: (value) => { openLastChatOnReload = Boolean(value); },
        },
        actions: {
          setInlineStatus: (...args) => setInlineStatus(...args),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          refreshPollComposerPreview: () => refreshPollComposerPreview(),
          refreshVoiceComposerState: () => window.BananzaVoiceHooks?.refreshComposerState?.(),
          refreshLocalizedUiRuntime: () => {
            if (chatList) renderChatList(chatSearch?.value || '');
            if (currentChatId) {
              renderCurrentChatHeader(getChatById(currentChatId));
              updateChatStatus();
              renderPinnedBar(currentChatId);
              refreshDateSeparators();
            }
            const chatMenuState = contextMenusController?.getChatContextMenuState?.();
            if (isFloatingSurfaceVisible(chatContextMenu) && chatMenuState?.chatId) renderChatContextMenu(getChatById(chatMenuState.chatId));
            if (isFloatingSurfaceVisible(chatFolderPicker)) renderChatFolderPicker();
            folderUiController.refreshVisibleContextMenu();
            const mediaMenuState = contextMenusController?.getMediaContextMenuState?.();
            if (isFloatingSurfaceVisible(mediaContextMenu) && mediaMenuState?.context) {
              renderMediaContextMenu(mediaMenuState.context);
              positionMediaContextMenu();
            }
          },
        },
      });
      const weatherSettingsController = weatherSettingsFactory({
        document,
        window,
        dom: appDom,
        api: (url, opts) => api(url, opts),
        esc,
        actions: {
          setInlineStatus: (...args) => setInlineStatus(...args),
        },
      });
      const notificationSettingsController = notificationSettingsFactory({
        document,
        window,
        api: (url, opts) => api(url, opts),
        state: {
          getCurrentChatId: () => currentChatId,
        },
        actions: {
          setInlineStatus: (...args) => setInlineStatus(...args),
        },
      });
      const soundSettingsController = soundSettingsFactory({
        document,
        window,
        api: (url, opts) => api(url, opts),
        actions: {
          setInlineStatus: (...args) => setInlineStatus(...args),
          getChatById: (chatId) => getChatById(chatId),
        },
      });
      const settingsModalController = settingsModalFactory({
        document,
        window,
        dom: appDom,
        modals: modalManager,
        ui: uiSettings,
        weather: weatherSettingsController,
        notifications: notificationSettingsController,
        sound: soundSettingsController,
        getCurrentUser: () => currentUser,
      });
      const settingsControllers = {
        ui: uiSettings,
        weather: weatherSettingsController,
        notifications: notificationSettingsController,
        sound: soundSettingsController,
        modal: settingsModalController,
      };
      if (appContext) appContext.services.settings = settingsControllers;
    
      const folderStoreFactory = window.BananzaApp?.folders?.store?.createChatFolderStore;
      const folderUiFactory = window.BananzaApp?.folders?.ui?.createChatFolderUi;
      const folderActionsFactory = window.BananzaApp?.folders?.actions?.createChatFolderActions;
      const folderManageModalFactory = window.BananzaApp?.folders?.manageModal?.createChatFolderManageModal;
      const newFolderTabFactory = window.BananzaApp?.folders?.newFolderTab?.createNewFolderTab;
      if (typeof folderStoreFactory !== 'function'
        || typeof folderUiFactory !== 'function'
        || typeof folderActionsFactory !== 'function'
        || typeof folderManageModalFactory !== 'function'
        || typeof newFolderTabFactory !== 'function') {
        throw new Error('BananzaApp folder modules are required before app.js');
      }
    
      const chatFolderStore = folderStoreFactory({
        getCurrentUser: () => currentUser,
        storage: localStorage,
        config: appConfig,
        compareChatActivity: (a, b) => compareChatActivity(a, b),
      });
      let folderActionsController = null;
      let folderManageModalController = null;
      const folderUiController = folderUiFactory({
        document,
        window,
        dom: appDom,
        store: chatFolderStore,
        config: appConfig,
        formatters,
        t,
        tx,
        state: {
          getCurrentUser: () => currentUser,
          setCurrentUser: (nextUser, { persist = true } = {}) => setCurrentUserFromSettings(nextUser, { persist }),
          getChats: () => chats,
          getOnlineUsers: () => onlineUsers,
          getCurrentModalAnimation: () => currentModalAnimation,
        },
        actions: {
          renderChatList: (filter) => renderChatList(filter),
          transitionToChatFolder: (folderId, options = {}) => transitionToChatFolder(folderId, options),
          loadChatFolders: (options = {}) => folderActionsController?.loadChatFolders(options) || Promise.resolve([]),
          handleFolderContextAction: (action, folderId) => folderActionsController?.handleChatFolderContextMenuAction(action, folderId),
          saveStripVisibility: (nextValue) => folderActionsController?.saveStripVisibility(nextValue),
          hideChatContextMenu: (options = {}) => hideChatContextMenu(options),
          hideMediaContextMenu: (options = {}) => hideMediaContextMenu(options),
          showCenterToast: (message) => showCenterToast(message),
          isFloatingSurfaceVisible: (el) => isFloatingSurfaceVisible(el),
          openFloatingSurface: (el) => openFloatingSurface(el),
          closeFloatingSurface: (el, options = {}) => closeFloatingSurface(el, options),
          getFloatingViewportRect: () => getFloatingViewportRect(),
          measureFloatingSurface: (el, fallbackWidth, fallbackHeight) => measureFloatingSurface(el, fallbackWidth, fallbackHeight),
          positionFloatingElement: (el, left, top) => positionFloatingElement(el, left, top),
          clamp: (value, min, max) => clamp(value, min, max),
          prefersReducedMotion: () => prefersReducedMotion(),
          chatItemAvatarHtml: (chat) => chatItemAvatarHtml(chat),
          renderChatLastPreviewHtml: (chat) => renderChatLastPreviewHtml(chat),
          animateChatHeaderActionButton: (buttonOrSelector) => animateChatHeaderActionButton(buttonOrSelector),
        },
      });
      folderActionsController = folderActionsFactory({
        document,
        window,
        api: (url, opts) => api(url, opts),
        store: chatFolderStore,
        ui: folderUiController,
        t,
        tx,
        state: {
          getChatSearchValue: () => chatSearch?.value || '',
        },
        actions: {
          renderChatList: (filter) => renderChatList(filter),
          showCenterToast: (message) => showCenterToast(message),
          isAbortError: (error) => isAbortError(error),
          transitionToChatFolder: (folderId, options = {}) => transitionToChatFolder(folderId, options),
          refreshManageModal: () => {
            const state = folderManageModalController?.getState?.();
            if (state?.chatId) folderManageModalController.renderChatFolderManageModal(state.chatId);
          },
        },
      });
      folderManageModalController = folderManageModalFactory({
        document,
        dom: appDom,
        store: chatFolderStore,
        ui: folderUiController,
        modals: modalManager,
        formatters,
        getChats: () => chats,
        getChatById: (chatId) => getChatById(chatId),
        actions: {
          loadChatFolders: (options = {}) => folderActionsController.loadChatFolders(options),
          addChatsToFolder: (folderId, chatIds) => folderActionsController.addChatsToFolder(folderId, chatIds),
          removeChatFromFolder: (folderId, chatId) => folderActionsController.removeChatFromFolder(folderId, chatId),
          openModal: (id, options = {}) => openModal(id, options),
        },
      });
      const newFolderTabController = newFolderTabFactory({
        document,
        window,
        dom: appDom,
        ui: folderUiController,
        state: {
          getChats: () => chats,
        },
        actions: {
          compareChatsForList: (a, b) => compareChatsForList(a, b),
          getChatSearchHaystack: (chat) => getChatSearchHaystack(chat),
          createChatFolder: (name, chatIds) => folderActionsController.createChatFolder(name, chatIds),
          closeAllModals: () => closeAllModals(),
          alert: (message) => alert(message),
        },
      });
      const folderControllers = {
        store: chatFolderStore,
        ui: folderUiController,
        actions: folderActionsController,
        manageModal: folderManageModalController,
        newFolderTab: newFolderTabController,
      };
      if (appContext) appContext.services.folders = folderControllers;
    
      const chatListStoreFactory = window.BananzaApp?.chatList?.store?.createChatListStore;
      const chatListRendererFactory = window.BananzaApp?.chatList?.render?.createChatListRenderer;
      const chatListDataFactory = window.BananzaApp?.chatList?.data?.createChatListDataController;
      const presenceControllerFactory = window.BananzaApp?.chatList?.presence?.createPresenceController;
      const chatListRecoveryFactory = window.BananzaApp?.chatList?.recovery?.createChatListRecovery;
      if (typeof chatListStoreFactory !== 'function'
        || typeof chatListRendererFactory !== 'function'
        || typeof chatListDataFactory !== 'function'
        || typeof presenceControllerFactory !== 'function'
        || typeof chatListRecoveryFactory !== 'function') {
        throw new Error('BananzaApp chat list modules are required before app.js');
      }
    
      const chatListStore = chatListStoreFactory({
        chats,
        allUsers,
        onlineUsers,
        compareChatsForList: (a, b) => compareChatsForList(a, b),
      });
      chatListService.configure?.({ store: chatListStore });
      refreshChatListReferences();
      syncCoreStateToRuntime();
    
      const chatListRenderer = chatListRendererFactory({
        document,
        window,
        dom: appDom,
        store: chatListStore,
        folders: folderControllers,
        formatters,
        customEmoji,
        config: appConfig,
        t,
        tx,
        state: {
          getChatSearchValue: () => chatSearch?.value || '',
          getCurrentChatId: () => currentChatId,
          shouldSuppressChatItemTap: () => Date.now() < suppressNextChatItemTapUntil,
        },
        actions: {
          alert: (message) => alert(message),
          compareChatsForFolder: (folderId, a, b) => compareChatsForFolder(folderId, a, b),
          getCurrentChatId: () => currentChatId,
          hideChatContextMenu: (options = {}) => hideChatContextMenu(options),
          isAiBotDirectoryUser: (user) => isAiBotDirectoryUser(user),
          isChatListWaitingForActiveFolder: (folderId) => isChatListWaitingForActiveFolder(folderId),
          isChatPinned: (chat) => isChatPinned(chat),
          isChatPinnedInFolder: (folderId, chat) => isChatPinnedInFolder(folderId, chat),
          isNotesChat: (chat) => isNotesChat(chat),
          normalizeChatFolderId: (folderId) => normalizeChatFolderId(folderId),
          openChat: (chatId) => openChat(chatId),
          openHiddenChatFromSearch: (chatId) => openHiddenChatFromSearch(chatId),
          openPrivateChatFromDirectory: (userId) => openPrivateChatFromDirectory(userId),
          renderChatFolderPicker: () => renderChatFolderPicker(),
          scheduleChatListCacheSync: () => scheduleChatListCacheSync(),
          scheduleHiddenChatSearch: (query) => scheduleHiddenChatSearch(query),
          showToast: (message) => showCenterToast(message),
          userSecondaryLineText: (user) => userSecondaryLineText(user),
        },
      });
    
      const chatListDataController = chatListDataFactory({
        document,
        window,
        dom: appDom,
        api: (url, opts) => api(url, opts),
        store: chatListStore,
        renderer: chatListRenderer,
        folders: folderControllers,
        cache: {
          storage: localStorage,
          cacheAssets: (urls) => window.cacheAssets?.(urls),
        },
        config: appConfig,
        tx,
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          getChatSearchValue: () => chatSearch?.value || '',
        },
        actions: {
          applyChatBackground: (chat) => applyChatBackground(chat),
          clearCachedChat: (chatId, options = {}) => clearCachedChat(chatId, options),
          clearChatLocalState: (chatId) => {
            chatPinsByChat.delete(Number(chatId || 0));
            readReceiptController.clearChatMemberLastReads(Number(chatId || 0));
          },
          closeChatViewForChat: (chatId) => closeChatViewForChat(chatId),
          compareChatsForList: (a, b) => compareChatsForList(a, b),
          getCurrentChatShotState: () => getCurrentChatShotState(),
          getMediaNoteFallbackLabel: (msg) => getMediaNoteFallbackLabel(msg),
          invalidateChatShotState: (chatId) => invalidateChatShotState(chatId),
          invalidateContextConvertAvailability: (chatId) => invalidateContextConvertAvailability(chatId),
          isAbortError: (error) => isAbortError(error),
          loadChatFolders: (options = {}) => loadChatFolders(options),
          normalizeChatFolderId: (folderId) => normalizeChatFolderId(folderId),
          openChat: (chatId) => openChat(chatId),
          refreshChatInfoPresentation: (chat) => refreshChatInfoPresentation(chat),
          refreshVisiblePinButtons: (chatId) => refreshVisiblePinButtons(chatId),
          renderChatContextTransformForm: (chat) => renderChatContextTransformForm(chat),
          renderChatDangerControls: (chat) => renderChatDangerControls(chat),
          renderChatPinSettingsForm: (chat) => renderChatPinSettingsForm(chat),
          renderChatPreferencesForm: (chat) => renderChatPreferencesForm(chat),
          renderChatShotForm: (state) => renderChatShotForm(state),
          renderCurrentChatHeader: (chat) => renderCurrentChatHeader(chat),
          renderPinnedBar: (chatId) => renderPinnedBar(chatId),
          scheduleMessageBackgroundSync: () => scheduleMessageBackgroundSync(),
          setChatSearchOpen: (open, options = {}) => setChatSearchOpen(open, options),
          showToast: (message) => showCenterToast(message),
          updateChatStatus: () => updateChatStatus(),
        },
      });
    
      const presenceController = presenceControllerFactory({
        document,
        window,
        store: chatListStore,
        renderer: chatListRenderer,
        formatters,
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          getChatSearchValue: () => chatSearch?.value || '',
        },
        actions: {
          applyCurrentUserUpdate: (user) => applyCurrentUserUpdateFromPresence(user),
          isChatInfoVisible: () => !chatInfoModal?.classList.contains('hidden'),
          patchAiBotUser: (user) => patchAiBotUserForPresence(user),
          patchChatMembersCache: (user) => patchChatMembersCacheForPresence(user),
          patchMentionTargets: (user) => patchMentionTargetsForPresence(user),
          refreshAdminUserStatuses: () => refreshAdminUserStatuses(),
          refreshChatInfoPresentation: (chat) => refreshChatInfoPresentation(chat),
          refreshChatInfoStatus: () => refreshChatInfoStatus(),
          refreshChatMemberStatuses: () => refreshChatMemberStatuses(),
          refreshMentionPickerForUserUpdate: () => refreshMentionPickerForUserUpdate(),
          refreshRenderedUserMessages: (user) => refreshRenderedUserMessages(user),
          renderCurrentChatHeader: (chat) => renderCurrentChatHeader(chat),
          setAvatarElementVisual: (el, options = {}) => setAvatarElementVisual(el, options),
          updateCachedMessagesByUser: (user) => window.messageCache?.updateMessagesByUser?.(user).catch(() => {}),
          updateChatStatus: () => updateChatStatus(),
        },
      });
    
      const chatListRecoveryController = chatListRecoveryFactory({
        document,
        window,
        store: chatListStore,
        config: appConfig,
        state: {
          getCurrentChatId: () => currentChatId,
          getCurrentUser: () => currentUser,
          getToken: () => token,
          hasAuth: () => Boolean(token && currentUser),
        },
        actions: {
          applyScreenRotationPreference: (options = {}) => applyScreenRotationPreference(options).catch(() => {}),
          connectWS: (options = {}) => connectWS(options),
          flushCurrentChatScrollAnchor: (chatId, options = {}) => flushCurrentChatScrollAnchor(chatId, options),
          getResolvedMobileBaseScene: () => getResolvedMobileBaseScene(),
          isMobileRouteTransitionActive: () => mobileRouteTransitionActive,
          isUiTransitionBusy: () => isUiTransitionBusy(),
          isWebSocketOpenOrConnecting: () => Boolean(ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)),
          loadChats: (options = {}) => loadChats(options),
          openChat: (chatId, options = {}) => openChat(chatId, options),
          scheduleMobileViewportRecovery: () => scheduleMobileViewportRecovery(),
          syncCurrentChatMessages: (chatId, options = {}) => (
            appContext?.services?.openChat?.controller?.catchUpCurrentChat?.(chatId, options)
            || catchUpCurrentChat(chatId, options)
          ),
          syncMobileBaseSceneState: (options = {}) => syncMobileBaseSceneState(options),
        },
      });
    
      const chatListControllers = {
        store: chatListStore,
        renderer: chatListRenderer,
        data: chatListDataController,
        presence: presenceController,
        recovery: chatListRecoveryController,
        service: chatListService,
      };
      chatListService.configure?.({
        store: chatListStore,
        renderer: chatListRenderer,
        data: chatListDataController,
        presence: presenceController,
        recovery: chatListRecoveryController,
      });
      refreshChatListReferences();
      syncCoreStateToRuntime();
      if (appContext) appContext.services.chatList = chatListControllers;
    
      const openChatPagesFactory = window.BananzaApp?.openChat?.pages?.createMessagePagesController;
      const readReceiptFactory = window.BananzaApp?.openChat?.readReceipts?.createReadReceiptController;
      const scrollControllerFactory = window.BananzaApp?.openChat?.scroll?.createScrollController;
      const mediaPlaybackFactory = window.BananzaApp?.openChat?.mediaPlayback?.createMediaPlaybackController;
      const openChatControllerFactory = window.BananzaApp?.openChat?.controller?.createOpenChatController;
      if (typeof openChatPagesFactory !== 'function'
        || typeof readReceiptFactory !== 'function'
        || typeof scrollControllerFactory !== 'function'
        || typeof mediaPlaybackFactory !== 'function'
        || typeof openChatControllerFactory !== 'function') {
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
          appendTimelineItems: (messages, pinEvents, options = {}) => appendTimelineItems(messages, pinEvents, options),
          applyChatBackground: (chat) => applyChatBackground(chat),
          cleanupDuplicateDateSeparators: () => cleanupDuplicateDateSeparators(),
          clearDisplayedTimelineState: () => {
            messageStateController?.clearDisplayedMessages?.();
            messageStateController?.clearDisplayedPinEvents?.();
          },
          clearEdit: (options = {}) => clearEdit(options),
          clearPendingFile: () => clearPendingFile(),
          clearReply: () => clearReply(),
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
          flushDeferredRecoverySync: () => flushDeferredRecoverySync(),
          isAbortError: (error) => isAbortError(error),
          isChatPinned: (chat) => isChatPinned(chat),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          isUiTransitionBusy: () => isUiTransitionBusy(),
          loadChatPins: (chatId) => loadChatPins(chatId),
          loadChatShotState: (chatId, options = {}) => loadChatShotState(chatId, options),
          loadChats: (options = {}) => loadChats(options),
          loadContextConvertAvailability: (chatId, options = {}) => loadContextConvertAvailability(chatId, options),
          markRecoveryRequested: (reason) => chatListService.markRecoveryRequested(reason),
          refreshPollComposerActionState: () => refreshPollComposerActionState(),
          refreshVoiceComposerState: () => window.BananzaVoiceHooks?.refreshComposerState?.(),
          renderChatList: (filter = chatSearch?.value || '') => renderChatList(filter),
          renderCurrentChatHeader: (chat) => renderCurrentChatHeader(chat),
          renderedMessageIdsMatch: (messages) => renderedMessageIdsMatch(messages),
          renderMessages: (messages, options = {}) => renderMessages(messages, options.pinEvents || []),
          renderOutboxForChat: (chatId) => renderOutboxForChat(chatId),
          renderPinnedBar: (chatId) => renderPinnedBar(chatId),
          replaceRenderedMessages: (messages, options = {}) => replaceRenderedMessages(messages, options.pinEvents || [], options),
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
        controller: openChatController,
        service: openChatService,
      };
      openChatService.configure?.(openChatControllers);
      openChatService.syncRuntimeState?.();
      if (appContext) appContext.services.openChat = openChatControllers;
    
      const messageStateFactory = window.BananzaApp?.messages?.state?.createMessageState;
      const messageAttachmentFactory = window.BananzaApp?.messages?.attachments?.createMessageAttachmentRenderer;
      const messagePollFactory = window.BananzaApp?.messages?.polls?.createPollMessageRenderer;
      const messageCallCardFactory = window.BananzaApp?.messages?.callCards?.createCallCardRenderer;
      const messageOutboxFactory = window.BananzaApp?.messages?.outbox?.createMessageOutbox;
      const messageUpdatesFactory = window.BananzaApp?.messages?.updates?.createMessageUpdates;
      const messageRendererFactory = window.BananzaApp?.messages?.render?.createMessageRenderer;
      if (typeof messageStateFactory !== 'function'
        || typeof messageAttachmentFactory !== 'function'
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
        $,
        actions: {
          showCenterToast: (message) => showCenterToast(message),
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
          jumpToPinnedMessage: (pin) => jumpToPinnedMessage(pin),
          filterNewMessages: (messages = []) => filterNewMessages(messages),
          insertAtMessagesEnd: (node) => insertAtMessagesEnd(node),
          getMessagesLastContentChild: () => getMessagesLastContentChild(),
          updateScrollBottomButton: () => updateScrollBottomButton(),
          refreshScrollDateIndicator: () => refreshScrollDateIndicator(),
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
        polls: messagePollRenderer,
        callCards: messageCallCardRenderer,
        renderer: messageRenderer,
        outbox: messageOutbox,
        updates: messageUpdates,
      });
      const messageServices = messagesService;
      if (appContext) appContext.services.messages = messageServices;
    
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
    
      const shellRuntimeApi = window.BananzaApp?.shell?.shellRuntimeAdapter?.createShellRuntimeAdapter?.(createRuntimeProxyScope()) || {};
      const {
        handleDragEnter, handleDragOver, handleDragLeave, handleDrop, renderTypingBar, showTyping, hideTyping, normalizeRecentEmojiValue,
        isValidRecentEmojiValue, normalizeRecentEmojiList, mergeRecentEmojiLists, getRecentEmojiStorageKey, getRecentEmojiCategory, loadLocalRecentEmojis, persistLocalRecentEmojis, loadRecentEmojis,
        rememberRecentEmoji, syncRecentEmojiToServer, getEmojiPickerCategories, isCustomEmojiCategory, getEmojiCategoryItems, getEmojiCategoryLabel, renderEmojiGridItemHtml, renderEmojiGridItemsHtml,
        renderEmojiPickerGrid, setEmojiPickerCategory, initEmojiPicker, syncEmojiPickerButton, positionEmojiPicker, openEmojiPicker, closeEmojiPicker, dismissEmojiPickerOutsideGesture,
        toggleEmojiPicker, getSelectableFolderChats, getSelectedNewFolderChatIds, renderNewFolderChatList, resetNewFolderForm, normalizeNewChatModalTab, getNewChatModalActiveTab, getNewChatTabPane,
        prepareNewChatTabContent, createNewChatTabPreview, applyNewChatModalTab, setNewChatModalTab, initNewChatTabSwipePager, openNewChatModal, openAdminModal, openAdminBotAuditModal,
        setBackupExportStatus, setBackupRestoreStatus, syncBackupRestoreFileName, resetBackupRestoreState, renderBackupRestorePreview, openBackupExportModal, downloadBackupExport, previewBackupRestore,
        applyBackupRestore, openSettingsModal, openLanguageSettingsModal, openThemeSettingsModal, openVisualModeSettingsModal, openPollStyleSettingsModal, openAnimationSettingsModal, openMobileFontSettingsModal,
        openWeatherSettingsModal, openNotificationSettingsModal, openSoundSettingsModal, openAiBotSettingsModal, openOpenAiTextBotsModal, openOpenAiUniversalBotsModal, openOpenAiImageBotsModal, openYandexAiSettingsModal,
        openDeepseekAiSettingsModal, openDeepseekTextBotsModal, openQwenAiSettingsModal, openQwenTextBotsModal, resetManagedModalScroll, openGrokAiSettingsModal, openGrokTextBotsModal, openGrokImageBotsModal,
        openGrokUniversalBotsModal, resetChangePasswordFields, openChangePasswordModal, openChatInfoModal, setProfileStatus, getProfileSelectedColor, setProfileAvatarUploadPending, renderProfileAvatarPreview,
        syncProfileColorSelection, renderProfileColorPicker, renderProfileEditor, openMenuDrawer, uploadProfileAvatar, removeProfileAvatar, saveProfileChanges, setupProfileEvents,
        getVisibleComposerToolCount, getComposerInputWidthForMode, getNormalComposerInputWidth, measureMsgInputScrollHeight, getComposerInputTextMetrics, renderComposerRichPreviewContent, syncComposerRichPreview, autoResize,
        animateSendButton, animateBackButton, resetBackButtonNavigationState, deferBackButtonNavigationRelease, animateChatHeaderActionButton, prefersReducedMotion, cancelPendingSidebarReveal, isMobileChatHistoryState,
        isResolvedMobileChatScene, normalizeMobileChatListHistoryState, revealSidebarFromChat, navigateBackToChatList, setupPasswordPreviewToggles, createRuntimeEventScope, NEW_CHAT_MODAL_TABS, AVATAR_COLORS,
        setupEvents,
      } = shellRuntimeApi;
      publishRuntimeApi(shellRuntimeApi);

      const composerServices = {
        state: composerStateController,
        text: composerTextController,
        replyEdit: composerReplyEditController,
        files: composerFilesController,
        send: composerSendController,
        emojiPicker: composerEmojiPickerController,
        mentions: composerMentionsController,
        typingDragDrop: composerTypingDragDropController,
        pollComposer: pollComposerController,
      };
      if (appContext) appContext.services.composer = composerServices;
    
      const interactionState = {
        getCurrentUser: () => currentUser,
        getCurrentChatId: () => currentChatId,
        getCurrentModalAnimation: () => currentModalAnimation,
        getChats: () => chats,
        getOnlineUsers: () => onlineUsers,
        contextConvertPendingMessageIds,
        contextOriginalRestorePendingMessageIds,
      };
      searchController = searchControllerFactory({
        window,
        document,
        dom: appDom,
        state: interactionState,
        config: appConfig,
        api: (url, opts) => api(url, opts),
        esc,
        t,
        tx,
        $,
        services: {
          openChat: { openChat, scroll: scrollController },
          messages: messageServices,
        },
        actions: {
          clamp: (value, min, max) => clamp(value, min, max),
          showCenterToast: (message) => showCenterToast(message),
          openChat: (chatId, options = {}) => openChat(chatId, options),
          closeMobileComposerTransientUi: (options = {}) => closeMobileComposerTransientUi(options),
          dismissMobileComposer: (options = {}) => dismissMobileComposer(options),
          getMobileComposerSafeReturnFocusEl: (fallback) => getMobileComposerSafeReturnFocusEl(fallback),
          forceIosAnimationMount: (el) => forceIosAnimationMount(el),
          getElementTransitionTotalMs: (el) => getElementTransitionTotalMs(el),
          focusElementIfPossible: (el) => focusElementIfPossible(el),
          blurFocusedElementWithin: (root) => blurFocusedElementWithin(root),
          prefersReducedMotion: () => prefersReducedMotion(),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          revealSidebarFromChat: (options = {}) => revealSidebarFromChat(options),
          normalizeMobileChatListHistoryState: (...args) => normalizeMobileChatListHistoryState(...args),
          isResolvedMobileChatScene: (scene) => isResolvedMobileChatScene(scene),
          waitForAnimationFrames: (count) => waitForAnimationFrames(count),
        },
      });
      floatingMessageActionsController = floatingMessageActionsFactory({
        window,
        document,
        dom: appDom,
        state: interactionState,
        config: appConfig,
        getReactions: () => reactionController,
        actions: {
          forceIosAnimationMount: (el) => forceIosAnimationMount(el),
          getElementTransitionTotalMs: (el) => getElementTransitionTotalMs(el),
          prefersReducedMotion: () => prefersReducedMotion(),
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          focusComposerKeepKeyboard: (force) => focusComposerKeepKeyboard(force),
        },
      });
      forwardingController = forwardingControllerFactory({
        window,
        document,
        dom: appDom,
        state: interactionState,
        config: appConfig,
        api: (url, opts) => api(url, opts),
        esc,
        actions: {
          isNotesChat: (chat) => isNotesChat(chat),
          getChatSearchHaystack: (chat) => getChatSearchHaystack(chat),
          formatChatListTimestamp: (value) => formatChatListTimestamp(value),
          chatItemAvatarHtml: (chat) => chatItemAvatarHtml(chat),
          renderChatLastPreviewHtml: (chat, options = {}) => renderChatLastPreviewHtml(chat, options),
          closeModal: (modalOrId, options = {}) => closeModal(modalOrId, options),
          openModal: (modalOrId, options = {}) => openModal(modalOrId, options),
          closeAllModals: (options = {}) => closeAllModals(options),
          showCenterToast: (message) => showCenterToast(message),
          playAppSound: (type, options = {}) => playAppSound(type, options),
          scrollToBottom: (instant, markRead, options = {}) => scrollToBottom(instant, markRead, options),
          updateChatListLastMessage: (message) => updateChatListLastMessage(message),
          hideFloatingMessageActions: (options = {}) => hideFloatingMessageActions(options),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          prefersReducedMotion: () => prefersReducedMotion(),
          getElementTransitionTotalMs: (el) => getElementTransitionTotalMs(el),
        },
      });
      reactionController = reactionControllerFactory({
        window,
        document,
        dom: appDom,
        state: interactionState,
        api: (url, opts) => api(url, opts),
        esc,
        t,
        getFloatingActions: () => floatingMessageActionsController,
        actions: {
          getEmojiPickerCategories: () => getEmojiPickerCategories(),
          isCustomEmojiCategory: (category) => isCustomEmojiCategory(category),
          getEmojiCategoryItems: (category) => getEmojiCategoryItems(category),
          getRecentEmojiCategory: () => getRecentEmojiCategory(),
          isCustomEmojiToken: (value) => isCustomEmojiToken(value),
          createHorizontalSwipePager: (options = {}) => createHorizontalSwipePager(options),
          scheduleScrollableItemCenter: (...args) => scheduleScrollableItemCenter(...args),
          rememberRecentEmoji: (emoji) => rememberRecentEmoji(emoji),
          canContextConvertMessage: (msg, row, options = {}) => canContextConvertMessage(msg, row, options),
          canRestoreContextOriginalMessage: (msg) => canRestoreContextOriginalMessage(msg),
          openMessageContextConvertPicker: (row, anchor, options = {}) => openMessageContextConvertPicker(row, anchor, options),
          restoreContextOriginalMessage: (messageId, options = {}) => restoreContextOriginalMessage(messageId, options),
          bindTouchSafeButtonActivation: (button, handler, options = {}) => bindTouchSafeButtonActivation(button, handler, options),
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          preventMobileComposerBlur: (event) => preventMobileComposerBlur(event),
          focusComposerKeepKeyboard: (force) => focusComposerKeepKeyboard(force),
          safeVibrate: (pattern) => safeVibrate(pattern),
          getSelectedMessageFragment: (row) => getSelectedMessageFragment(row),
          isSelectableMessageTextTarget: (target) => isSelectableMessageTextTarget(target),
          getMessageMediaContextTarget: (target) => getMessageMediaContextTarget(target),
        },
      });
      mediaViewerController = mediaViewerFactory({
        window,
        document,
        dom: appDom,
        state: interactionState,
        config: appConfig,
        api: (url, opts) => api(url, opts),
        esc,
        services: {
          openChat: { mediaPlayback: mediaPlaybackController },
        },
        actions: {
          getAttachmentPreviewUrl: (source) => getAttachmentPreviewUrl(source),
          getAttachmentPosterUrl: (source) => getAttachmentPosterUrl(source),
          ensureAttachmentPoster: (source, options = {}) => ensureAttachmentPoster(source, options),
          markAttachmentPosterAvailable: (message) => markAttachmentPosterAvailable(message),
          applyPosterToVideoElement: (videoEl, posterUrl) => applyPosterToVideoElement(videoEl, posterUrl),
          closeMobileComposerTransientUi: (options = {}) => closeMobileComposerTransientUi(options),
          dismissMobileComposer: (options = {}) => dismissMobileComposer(options),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          scheduleMobileViewportRecovery: (delay) => scheduleMobileViewportRecovery(delay),
          isGroupLikeCurrentChat: () => isGroupLikeCurrentChat(),
          openAvatarUserMenu: (avatarEl) => openAvatarUserMenu(avatarEl),
        },
      });
      contextMenusController = contextMenusFactory({
        window,
        document,
        dom: appDom,
        state: interactionState,
        config: appConfig,
        api: (url, opts) => api(url, opts),
        esc,
        t,
        tx,
        confirm: (message) => confirm(message),
        getFloatingActions: () => floatingMessageActionsController,
        getReactions: () => reactionController,
        getForwarding: () => forwardingController,
        services: {
          chatList: chatListControllers,
          folders: folderControllers,
          openChat: openChatControllers,
          messages: messageServices,
          composer: composerServices,
        },
        actions: {
          getChatById: (chatId) => getChatById(chatId),
          getActiveChatFolder: () => getActiveChatFolder(),
          getPinnedChatMoveState: (chatId, list = chats) => getPinnedChatMoveState(chatId, list),
          getFolderPinnedChatMoveState: (folderId, chatId) => getFolderPinnedChatMoveState(folderId, chatId),
          isChatPinned: (chat) => isChatPinned(chat),
          isChatPinnedInFolder: (folderId, chat) => isChatPinnedInFolder(folderId, chat),
          localChatPreferenceEnabled: (value) => localChatPreferenceEnabled(value),
          canHideChat: (chat) => canHideChat(chat),
          canLeaveChat: (chat) => canLeaveChat(chat),
          canManageDestructiveChat: (chat) => canManageDestructiveChat(chat),
          setChatSidebarPin: (chatId, pinned) => setChatSidebarPin(chatId, pinned),
          moveChatSidebarPin: (chatId, direction) => moveChatSidebarPin(chatId, direction),
          setFolderChatPin: (folderId, chatId, pinned) => setFolderChatPin(folderId, chatId, pinned),
          moveFolderChatPin: (folderId, chatId, direction) => moveFolderChatPin(folderId, chatId, direction),
          removeChatFromFolder: (folderId, chatId) => removeChatFromFolder(folderId, chatId),
          openChatFolderManageModal: (chatId, opener) => openChatFolderManageModal(chatId, opener),
          hideChatFromList: (chatId) => hideChatFromList(chatId),
          leaveChat: (chatId) => leaveChat(chatId),
          deleteChatCompletely: (chatId) => deleteChatCompletely(chatId),
          loadChats: () => loadChats(),
          renderChatList: (filter) => renderChatList(filter),
          renderChatPreferencesForm: (chat) => renderChatPreferencesForm(chat),
          getAttachmentPreviewUrl: (source) => getAttachmentPreviewUrl(source),
          getAttachmentDownloadUrl: (source) => getAttachmentDownloadUrl(source),
          getMediaNoteFallbackLabel: (msg) => getMediaNoteFallbackLabel(msg),
          normalizeMimeType: (value) => normalizeMimeType(value),
          filenameFromContentDisposition: (header, fallback) => filenameFromContentDisposition(header, fallback),
          getMessageCopyTextData: (row) => getMessageCopyTextData(row),
          canForwardMessage: (msg) => canForwardMessage(msg),
          canSaveMessageToNotes: (msg) => canSaveMessageToNotes(msg),
          canEditMessage: (msg) => canEditMessage(msg),
          getPinActionState: (msg) => getPinActionState(msg),
          copyTextToClipboard: (text) => copyTextToClipboard(text),
          showCenterToast: (message) => showCenterToast(message),
          setReplyFromRow: (row) => setReplyFromRow(row),
          setEditFromRow: (row) => setEditFromRow(row),
          togglePinFromRow: (row) => togglePinFromRow(row),
          hasAndroidNativeBridge: () => hasAndroidNativeBridge(),
          safeVibrate: (pattern) => safeVibrate(pattern),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          focusComposerKeepKeyboard: (force) => focusComposerKeepKeyboard(force),
        },
      });
      const interactionServices = {
        search: searchController,
        reactions: reactionController,
        floatingActions: floatingMessageActionsController,
        mediaViewer: mediaViewerController,
        contextMenus: contextMenusController,
        forwarding: forwardingController,
      };
      if (appContext) appContext.services.interactions = interactionServices;
      const isIosViewportFixTarget = Boolean(mobileViewportShell.isIosViewportFixTarget?.());
      if (isIosViewportFixTarget) {
        document.documentElement.classList.add('is-ios-webkit');
      }

      const __bananzaRuntimeExportNames = ["$$","$","AVATAR_COLORS","DOCUMENT_FORMAT_OPTIONS","GROK_TEXT_BOT_DIRTY_STATUS","NEW_CHAT_MODAL_TABS","OPENAI_IMAGE_BACKGROUND_OPTIONS","OPENAI_IMAGE_OUTPUT_OPTIONS","OPENAI_IMAGE_QUALITY_OPTIONS","OPENAI_IMAGE_SIZE_OPTIONS","activeChatFolderBar","activeChatFolderName","activeChatFolderStrip","activeChatFolderStripRows","addChatsToFolder","adminBackupController","adminBackupFactory","adminBotAuditController","adminBotAuditFactory","adminModal","adminUsersController","adminUsersFactory","aiAdminController","aiAdminRuntimeApi","aiBotFormPayload","aiBotSettingsModal","aiBotSettingsPayload","analyzeOutgoingGrokImageRisk","androidBridge","animateBackButton","animateChatFolderContentEntry","animateChatHeaderActionButton","animateSendButton","animationSettingsModal","appContext","appDom","appDomApi","applyBackupRestore","applyChatFolderStripVisibilityInAllChats","applyChatUpdate","applyCurrentUserUpdateFromPresence","applyMobileFontSize","applyModalAnimation","applyModalAnimationSpeed","applyNewChatModalTab","applyPinsUpdate","applyPosterToVideoElement","applyScreenRotationPreference","applySoundSettings","applyUiLanguage","applyUiTheme","applyUserUpdate","applyVisualMode","attachBtn","autoResize","avatarHtml","avatarMenuTargetFromEl","backBtn","beginChatFolderStripPreview","beginMobileRouteTransition","bindAsyncActionButtons","bindContextConvertMessageButton","bindContextOriginalRestoreButton","blurFocusedElementWithin","botChatMemberMetaText","botMentionText","botModelText","buildPinBrowserNotification","buildPollComposerPreviewMessage","buildReplyBotTarget","buildVerifiedBotSaveStatus","canAnimateChatFolderContent","canAnimateChatFolderSwipe","canContextConvertMessage","canHideChat","canLeaveChat","canManageContextTransformSettings","canManageDestructiveChat","canManagePinSettings","canRestoreContextOriginalMessage","canUnpinPin","cancelPendingSidebarReveal","cancelScheduledActiveChatFolderChipCenter","centerActiveChatFolderChip","changePasswordModal","chatAllowsUnpinAnyPin","chatArea","chatContextMenu","chatContextMenuBackdrop","chatFolderContent","chatFolderContextMenu","chatFolderContextMenuBackdrop","chatFolderEmojiMarkup","chatFolderIconEmoji","chatFolderIconMarkup","chatFolderListSurface","chatFolderManageModal","chatFolderManageSaveBtn","chatFolderPicker","chatFolderPickerBackdrop","chatFolderStore","chatFolderStripLabelForSelection","chatFolderStripStructureSignature","chatFoldersBtn","chatHeader","chatHeaderActions","chatHeaderActionsShell","chatHeaderAvatar","chatInfoBtn","chatInfoModal","chatItemAvatarHtml","chatList","chatListControllers","chatListDataController","chatListDataFactory","chatListPullIcon","chatListPullIndicator","chatListPullLabel","chatListRecoveryController","chatListRecoveryFactory","chatListRenderer","chatListRendererFactory","chatListStatus","chatListStore","chatListStoreFactory","chatSearch","chatSearchClear","chatSearchToggle","chatSettingsActionBtn","chatShotAdminFormPayload","chatShotBotsModal","chatShotBtn","chatShotRouteBase","chatStatus","chatTitle","chatView","checkDeepseekAiBalance","clamp","clearCachedChat","clearChatHistoryForEveryone","clearContextConvertPickerFollowupClickSuppress","clearLocalChatHistory","clearMobileFontSizeStatusTimer","clearMobileSceneElementState","clearMobileSceneRepaint","clearModalAnimationStatusTimer","clearScreenRotationStatusSoon","closeAllModals","closeChatViewForChat","closeEmojiPicker","closeModal","closeTopModal","compareChatsForFolder","composerAiOverrideDocumentFormatEl","composerAiOverrideDocumentWrap","composerAiOverrideEl","composerAiOverrideHint","composerAiOverrideLabel","composerAiOverrideModeEl","composerContextConvertBtn","composerEmojiPickerController","composerEmojiPickerFactory","composerFactories","composerFilesController","composerFilesFactory","composerMentionsController","composerMentionsFactory","composerReplyEditController","composerReplyEditFactory","composerRichPreview","composerSendController","composerSendFactory","composerServices","composerStateController","composerStateFactory","composerTextController","composerTextFactory","composerTypingDragDropController","composerTypingDragDropFactory","contextConvertAdminFormPayload","contextConvertBotsModal","contextConvertProviderLabel","contextConvertRouteBase","contextMenusController","contextMenusFactory","copyTextToClipboard","createChatFolder","createChatFolderSwipePage","createContextConvertMessageButton","createFallbackDomRefs","createFolderBtn","createRuntimeProxyScope","createRuntimeEventScope","createNewChatTabPreview","currentAiBot","currentChatShotAdminBot","currentChatShotAdminState","currentContextConvertAdminBot","currentContextConvertAdminState","currentDeepseekBot","currentGrokBot","currentGrokImageBot","currentGrokTextBotFormFingerprint","currentGrokUniversalBot","currentOpenAiImageBot","currentOpenAiUniversalBot","currentQwenBot","currentUserInfo","currentYandexBot","deepseekAiSettingsModal","deepseekAiSettingsPayload","deepseekAiTextBotsModal","deepseekBotFormPayload","deferBackButtonNavigationRelease","deleteAiBotKey","deleteChatCompletely","deleteChatFolder","deleteComposerCustomEmojiCluster","deleteDeepseekAiKey","deleteGrokAiKey","deleteQwenAiKey","deleteYandexAiKey","destroyChatFolderSwipePager","disableAiBot","disableChatShotAdminBot","disableContextConvertAdminBot","disableDeepseekBot","disableGrokBot","disableGrokUniversalBot","disableOpenAiImageBot","disableOpenAiUniversalBot","disablePushOnThisDevice","disableQwenBot","disableYandexBot","dismissEmojiPickerOutsideGesture","downloadBackupExport","dragOverlay","emojiBtn","emojiPicker","emptyState","enablePushNotifications","endMobileRouteTransition","ensureAttachmentPoster","ensureAvatarUserMenu","ensureBotVisibilityToggles","ensureContextConvertPicker","ensureContextConvertPickerBackdrop","ensureDeepseekTextBotsModalContent","ensureMentionPicker","ensureMentionPickerBackdrop","ensureQwenTextBotsModalContent","escapeRegExpText","exportAiBotJson","exportChatShotAdminBot","exportContextConvertAdminBot","exportDeepseekBotJson","exportGrokBotJson","exportGrokUniversalBotJson","exportOpenAiImageBotJson","exportOpenAiUniversalBotJson","exportQwenBotJson","exportYandexBotJson","extractMentionTokensFromText","fileInput","filenameFromContentDisposition","fillAiBotForm","fillDeepseekBotForm","fillGrokBotForm","fillGrokImageBotForm","fillGrokUniversalBotForm","fillOpenAiImageBotForm","fillOpenAiUniversalBotForm","fillQwenBotForm","fillYandexBotForm","finalizeChatFolderStripPreview","findMentionTrigger","floatingMessageActionsController","floatingMessageActionsFactory","flushDeferredRecoverySync","flushMobileFontSizeSave","flushModalAnimationSave","focusChatSearchInput","focusElementIfPossible","folderActionsController","folderActionsFactory","folderControllers","folderManageModalController","folderManageModalFactory","folderStoreFactory","folderSummaryText","folderUiController","folderUiFactory","forceMobileViewportLayoutSync","formatBotAuditSource","formatCapabilityState","formatDeepseekBalanceResult","formatDeepseekBalanceValue","formatUiErrorMessage","formatWeatherValue","forwardChatList","forwardChatSearch","forwardMessageModal","forwardMessageStatus","forwardingController","forwardingControllerFactory","getActiveChatFolder","getAdjacentChatFolderPage","getAiChatSetting","getBotVisibilityToggle","getChatById","getChatFolderPageIndex","getChatFolderPageRows","getChatFolderSwipeCommitDistance","getChatFolderSwipeSurfaceWidth","getChatFolderSwipeTransformTarget","getChatFolderSwitchTargets","getChatPins","getChatShotAdminChatSetting","getComposerAiOverridePayload","getComposerInputTextMetrics","getComposerInputWidthForMode","getComposerTextValue","getContextConvertChatSetting","getCurrentChatContextConvertState","getCurrentChatShotState","getCurrentModalAnimationPreferences","getDeepseekChatSetting","getDirectPrivateAiBotTarget","getElementTransitionTotalMs","getEmojiCategoryItems","getEmojiCategoryLabel","getEmojiPickerCategories","getEmojiPickerInsertionValue","getFolderPinnedChatMoveState","getFolderPinnedChatOrder","getGrokChatSetting","getGrokImageChatSetting","getGrokUniversalChatSetting","getManualMentionRange","getMicrophoneMode","getMobileFontAdjustPercent","getModalAnimationSpeedFactor","getNewChatModalActiveTab","getNewChatTabPane","getNormalComposerInputWidth","getOpenAiImageChatSetting","getOpenAiUniversalChatSetting","getPayloadChatId","getPersistedMobileFontSize","getPersistedModalAnimationPreferences","getPinActionState","getPinActorName","getPinForMessage","getPinPreviewText","getPinToastText","getPinnedChatMoveState","getPinnedChats","getProfileSelectedColor","getQwenChatSetting","getRecentEmojiCategory","getRecentEmojiStorageKey","getRenderedChatFolderSelectionId","getResolvedMobileBaseScene","getScreenRotationAllowed","getSelectableFolderChats","getSelectedNewFolderChatIds","getSingleEmojiPattern","getSoundSettingsFromForm","getTopModal","getUniversalBotModes","getVisibleComposerToolCount","getYandexChatSetting","grokAiImageBotsModal","grokAiSettingsModal","grokAiSettingsPayload","grokAiTextBotsModal","grokAiUniversalBotsModal","grokBotFormPayload","grokImageBotFormPayload","grokImageRiskCancel","grokImageRiskConfirm","grokImageRiskConfirmModal","grokImageRiskTerms","grokUniversalBotFormPayload","grokUniversalTargetAllowsImage","handleChatFolderContextMenuAction","handleComposerCustomEmojiBeforeInput","handleComposerCustomEmojiKeydown","handleDragEnter","handleDragLeave","handleDragOver","handleDrop","handleGrokImageRiskModalClosed","handleMentionClick","handleMentionPickerKeydown","handlePinnedMessageUpdate","handleServiceWorkerMessage","hasAndroidNativeBridge","hasOpenModal","hideAvatarUserMenu","hideChatFolderContextMenu","hideChatFolderPicker","hideChatFromList","hideContextConvertPicker","hideMentionPicker","hideTyping","imageViewer","importAiBotJsonFile","importChatShotAdminBot","importContextConvertAdminBot","importDeepseekBotJsonFile","importGrokBotJsonFile","importGrokUniversalBotJsonFile","importOpenAiImageBotJsonFile","importOpenAiUniversalBotJsonFile","importQwenBotJsonFile","importYandexBotJsonFile","initEmojiPicker","initNewChatTabSwipePager","inputArea","inputRow","insertComposerTextAtSelection","insertDictatedText","insertMentionTarget","insertMentionTokenIntoComposer","insertRawMentionTriggerAtCursor","interactionFactories","interactionServices","interactionState","invalidateChatShotState","invalidateContextConvertAvailability","isAbortError","isAiBotDirectoryUser","isAllChatsFolderActive","isChatFolderStripVisibleInAllChatsEnabled","isChatIncomingSoundEnabled","isChatNotificationEnabled","isChatPinned","isChatPinnedInFolder","isChatSearchOpen","isClientSideMessage","isComposerMeaningfullyEmpty","isContextTransformAvailableForChat","isCurrentChatOpenTransition","isCurrentNotesChat","isCustomEmojiCategory","isGeneralChat","isGrokImageBotTarget","isGrokUniversalBotTarget","isGroupLikeCurrentChat","isGroupOrPrivateChat","isIosViewportFixTarget","isLocalhost","isMentionSoundEnabled","isMessageMentioningCurrentUser","isMobileBaseSceneHardHidden","isMobileChatHistoryState","isMobileLayoutViewport","isMobileViewportLayoutLocked","isNotesChat","isPinNotificationEnabled","isPinSoundEnabled","isPushSupported","isResolvedMobileChatScene","isSingleEmojiMessage","isUiTransitionBusy","isUniversalBotTarget","isValidRecentEmojiValue","ivStrip","jumpToPinnedMessage","jumpToSavedOriginal","languageDisplayName","languageSettingsModal","leaveChat","shellRuntimeApi","uiRuntimeApi","linkify","loadAiBotState","loadAiModelOptions","loadChatFolders","loadChatPins","loadChatPreferences","loadChatShotAdminState","loadChatShotState","loadContextConvertAdminState","loadContextConvertAvailability","loadCurrentWeather","loadDeepseekAiState","loadGrokAiState","loadGrokUniversalState","loadHiddenChatSearch","loadLocalRecentEmojis","loadMentionTargets","loadMoreAfterWrap","loadMoreBtn","loadMoreWrap","loadNotificationSettings","loadOpenAiImageState","loadOpenAiUniversalState","loadQwenAiState","loadRecentEmojis","loadSoundSettings","loadWeatherSettings","loadYandexAiState","localAttachmentFromFile","makeClientId","markAttachmentPosterAvailable","measureMsgInputScrollHeight","mediaContextMenu","mediaContextMenuBackdrop","mediaPlaybackController","mediaPlaybackFactory","mediaViewerController","mediaViewerFactory","mentionKey","mentionOpenBtn","menuDrawer","mergeAiBotState","mergeChatShotAdminState","mergeContextConvertAdminState","mergeDeepseekAiState","mergeGrokAiState","mergeGrokUniversalState","mergeOpenAiImageState","mergeOpenAiUniversalState","mergeQwenAiState","mergeRecentEmojiLists","mergeYandexAiState","messageAttachmentFactory","messageCallCardFactory","messageOutboxFactory","messagePollFactory","messageRendererFactory","messageServices","messageStateFactory","messageUpdatesFactory","messagesEl","mobileComposerGuard","mobileFontSettingsModal","mobileViewportShell","modalAnimationMeta","modalAnimationPreferencesEqual","modalEntryOf","modalManager","modalManagerFactory","mountGrokBotPanels","moveChatFolder","moveChatSidebarPin","moveFolderChatPin","msgInput","navigateBackToChatList","newChatModal","newFolderChatList","newFolderChatSearchInput","newFolderNameInput","newFolderTabController","newFolderTabFactory","normalizeBotSaveComparisonValue","normalizeChatFolderId","normalizeChatShotState","normalizeComposerInputValue","normalizeContextConvertAvailability","normalizeMentionTarget","normalizeMicrophoneMode","normalizeMobileBaseScene","normalizeMobileChatListHistoryState","normalizeMobileFontSize","normalizeModalAnimationSpeed","normalizeModalAnimationStyle","normalizeNewChatModalTab","normalizePin","normalizePins","normalizePollStyle","normalizeRecentEmojiList","normalizeRecentEmojiValue","normalizeUiLanguage","normalizeUiTheme","normalizeVisualMode","notificationPermissionLabel","notificationSettingsController","notificationSettingsFactory","notificationSettingsModal","notifyAndroidMobileFontSize","notifyAndroidScreenRotationPreference","openAdminBotAuditModal","openAdminModal","openAiBotSettingsModal","openAiImageBotFormPayload","openAiImageBotsModal","openAiTextBotsModal","openAiUniversalBotFormPayload","openAiUniversalBotsModal","openAnimationSettingsModal","openAvatarUserMenu","openBackupExportModal","openChangePasswordModal","openChatController","openChatControllerFactory","openChatControllers","openChatFolderManageModal","openChatInfoModal","openChatPagesController","openChatPagesFactory","openChatShotBotsModal","openComposerContextConvertPicker","openContextConvertBotsModal","openDeepseekAiSettingsModal","openDeepseekTextBotsModal","openEmojiPicker","openGrokAiSettingsModal","openGrokImageBotsModal","openGrokImageRiskConfirm","openGrokTextBotsModal","openGrokUniversalBotsModal","openHiddenChatFromSearch","openLanguageSettingsModal","openMentionPickerFromButton","openMenuDrawer","openMessageContextConvertPicker","openMobileFontSettingsModal","openModal","openNewChatModal","openNotificationSettingsModal","openOpenAiImageBotsModal","openOpenAiTextBotsModal","openOpenAiUniversalBotsModal","openPollComposer","openPollStyleSettingsModal","openPrivateChatFromDirectory","openPrivateChatWithUser","openQwenAiSettingsModal","openQwenTextBotsModal","openSettingsModal","openSoundSettingsModal","openThemeSettingsModal","openVisualModeSettingsModal","openWeatherSettingsModal","openYandexAiSettingsModal","parseTransitionTimeMs","patchAiBotUserForPresence","patchChatMembersCacheForPresence","patchMentionTargetsForPresence","pendingFileEl","persistAiBotSettings","persistCurrentUser","persistDeepseekAiSettings","persistGrokAiSettings","persistLocalRecentEmojis","persistQwenAiSettings","persistYandexAiSettings","pinMessage","pinnedBar","playAppSound","playChatFolderSwitchPhase","pollBtn","pollComposerController","pollComposerFactory","pollComposerModal","pollComposerPreview","pollComposerStatus","pollOptionsList","pollQuestionInput","pollStyleMeta","pollStyleSettingsModal","pollVotersList","pollVotersMeta","pollVotersModal","pollVotersStatus","pollVotersTitle","positionAvatarUserMenu","positionChatFolderContextMenu","positionChatFolderPicker","positionContextConvertPicker","positionEmojiPicker","positionMentionPicker","prefersReducedMotion","prepareChatFolderSwipePager","prepareNewChatTabContent","presenceController","presenceControllerFactory","previewAllSounds","previewBackupRestore","previewSound","providerAccent","providerInteractiveEnabled","providerInteractiveSummary","qwenAiSettingsModal","qwenAiSettingsPayload","qwenAiTextBotsModal","qwenBotFormPayload","reactionController","reactionControllerFactory","reactionEmojiPopover","reactionPicker","readPollComposerForm","readReceiptController","readReceiptFactory","refreshChatFolderContextMenu","refreshChatInfoPresentation","refreshDeepseekAiModels","refreshGrokAiModels","refreshGrokTextBotDirtyState","refreshLocalizedUi","refreshMentionPickerForUserUpdate","refreshPollComposerActionState","refreshPollComposerPreview","refreshPushDeviceState","refreshQwenAiModels","refreshRenderedAiBotAvatar","refreshRenderedUserMessages","refreshVisiblePinButtons","refreshVoiceComposerState","refreshYandexAiModels","registerBuiltinModals","registerModal","rememberActiveElement","rememberRecentEmoji","removeAiBotAvatar","removeChatFromFolder","removeChatLocally","removeDeepseekBotAvatar","removeGrokBotAvatar","removeGrokUniversalBotAvatar","removeOpenAiImageBotAvatar","removeOpenAiUniversalBotAvatar","removeProfileAvatar","removeQwenBotAvatar","removeYandexBotAvatar","renameChatFolder","renderActiveChatFolderBar","renderAiBotAvatar","renderAiBotList","renderAiBotSettings","renderAiChatBotSettings","renderAiModelOptions","renderBackupRestorePreview","renderChatContextTransformForm","renderChatDangerControls","renderChatFolderContextMenu","renderChatFolderManageModal","renderChatFolderPicker","renderChatFolderStripStructure","renderChatMemberItem","renderChatPinSettingsForm","renderChatPreferencesForm","renderChatShotAdminChatSettings","renderChatShotAdminForm","renderChatShotAdminSettings","renderChatShotBotList","renderChatShotForm","renderComposerAiOverride","renderComposerRichPreviewContent","renderContextConvertAdminSettings","renderContextConvertBotList","renderContextConvertChatSettings","renderContextConvertForm","renderContextConvertPicker","renderCurrentChatHeader","renderDeepseekAiSettings","renderDeepseekBotAvatar","renderDeepseekBotList","renderDeepseekChatBotSettings","renderDeepseekModelOptions","renderEmojiGridItemHtml","renderEmojiGridItemsHtml","renderEmojiPickerGrid","renderFolderSelectableChatItem","renderGrokAiSettings","renderGrokBotAvatar","renderGrokBotList","renderGrokBotModelOptions","renderGrokChatBotSettings","renderGrokGlobalImageModelOptions","renderGrokGlobalTextModelOptions","renderGrokImageBotAvatar","renderGrokImageBotList","renderGrokImageBotModelOptions","renderGrokImageBotsSettings","renderGrokImageChatBotSettings","renderGrokImageRiskTerms","renderGrokTextBotsSettings","renderGrokUniversalBotAvatar","renderGrokUniversalBotList","renderGrokUniversalBotModelOptions","renderGrokUniversalBotsSettings","renderGrokUniversalChatBotSettings","renderLanguagePicker","renderMentionPicker","renderMessageText","renderMobileFontSizeControl","renderModalAnimationOptions","renderModalAnimationSpeedControl","renderNamedGrokAvatar","renderNewFolderChatList","renderNotificationSettingsForm","renderOpenAiImageBotAvatar","renderOpenAiImageBotList","renderOpenAiImageChatBotSettings","renderOpenAiImageModelOptions","renderOpenAiImageSettings","renderOpenAiProviderSettings","renderOpenAiTextBotsSettings","renderOpenAiUniversalBotAvatar","renderOpenAiUniversalBotList","renderOpenAiUniversalChatBotSettings","renderOpenAiUniversalModelOptions","renderOpenAiUniversalSettings","renderPinActionButton","renderPinnedBar","renderPollComposerOptionInputs","renderPollStyleCardPreview","renderPollStylePicker","renderProfileAvatarPreview","renderProfileColorPicker","renderProfileEditor","renderQwenAiSettings","renderQwenBotAvatar","renderQwenBotList","renderQwenChatBotSettings","renderQwenModelOptions","renderSelectableUserItem","renderSoundSettingsForm","renderThemePicker","renderTypingBar","renderVisualModePicker","renderWeatherSearchResults","renderWeatherSettingsForm","renderWeatherWidget","renderYandexAiSettings","renderYandexBotAvatar","renderYandexBotList","renderYandexChatBotSettings","renderYandexModelOptions","replyBar","replyBarName","replyBarText","resetBackButtonNavigationState","resetBackupRestoreState","resetChangePasswordFields","resetChatFolderManageModal","resetChatFolderSwipeSurface","resetChatFolderSwitchAnimations","resetChatPreviewAfterHistoryClear","resetManagedModalScroll","resetNewFolderForm","resetPollComposer","resolveActionButtons","resolveComposerUniversalBotTarget","resolveTriggeredGrokImageBot","resolveUiTarget","restoreContextOriginalMessage","retryGrokImageRiskPrompt","revealChatHydration","revealChatListAfterActiveChatClose","revealSidebarFromChat","runChatShotGeneration","safeVibrate","saveAiBot","saveAiBotSettings","saveAiChatBotSettings","saveChatContextTransformSetting","saveChatFolderManageChanges","saveChatFolderStripVisibilityInAllChats","saveChatPinSettings","saveChatPreferences","saveChatShotAdminBot","saveChatShotAdminChatSetting","saveChatShotChatSetting","saveContextConvertAdminBot","saveContextConvertAdminChatSetting","saveDeepseekAiSettings","saveDeepseekBot","saveDeepseekChatBotSettings","saveGrokAiSettings","saveGrokBot","saveGrokChatBotSettings","saveGrokImageBot","saveGrokImageChatBotSettings","saveGrokUniversalBot","saveGrokUniversalChatBotSettings","saveNotificationSettings","saveOpenAiImageBot","saveOpenAiImageChatBotSettings","saveOpenAiUniversalBot","saveOpenAiUniversalChatBotSettings","saveProfileChanges","saveQwenAiSettings","saveQwenBot","saveQwenChatBotSettings","saveSoundSettings","saveWeatherSettings","saveYandexAiSettings","saveYandexBot","saveYandexChatBotSettings","scheduleActiveChatFolderChipCenter","scheduleActiveMobileSceneRepaint","scheduleHiddenChatSearch","scheduleMobileFontSizeSave","scheduleMobileFontSizeStatusClear","scheduleMobileViewportRecovery","scheduleModalAnimationSave","scheduleModalAnimationStatusClear","scheduleSoundSettingsSave","scheduleWeatherRefresh","scrollBottomBtn","scrollController","scrollControllerFactory","searchAllChatsToggle","searchBtn","searchController","searchControllerFactory","searchInput","searchPanel","searchPanelSheet","searchResults","searchWeatherLocations","selectModalAnimation","selectPollStyle","selectUiLanguage","selectUiTheme","selectVisualMode","sendBtn","sendComposerWsPayload","setActionButtonsPending","setActiveChatFolder","setAiBotChatStatus","setAiBotModalStatus","setAiBotSettingsStatus","setAiBotStatus","setAiBotTextModalStatus","setAiModelSelectOptions","setAiModelStatus","setAvatarElementVisual","setBackupExportStatus","setBackupRestoreStatus","setBotVisibilityToggle","setChatContextTransformStatus","setChatDangerStatus","setChatFolderManageStatus","setChatFolderOrder","setChatFolderSwipeOffset","setChatHydrating","setChatPinSettingsStatus","setChatPreferencesStatus","setChatSearchOpen","setChatShotAdminChatStatus","setChatShotBotStatus","setChatShotChatStatus","setChatShotModalStatus","setChatSidebarPin","setComposerContextConvertButtonVisible","setComposerTextValue","setContextConvertBotStatus","setContextConvertChatStatus","setContextConvertInlineStatus","setContextConvertModalStatus","setCurrentUserFromSettings","setDeepseekAiBalanceStatus","setDeepseekAiModelStatus","setDeepseekAiProviderStatus","setDeepseekAiStatus","setDeepseekBotStatus","setDeepseekChatStatus","setEmojiPickerCategory","setFolderChatPin","setGrokAiModelStatus","setGrokAiProviderStatus","setGrokAiStatus","setGrokBotStatus","setGrokImageChatStatus","setGrokImageEditorStatus","setGrokImageStatus","setGrokStatus","setGrokTextChatStatus","setGrokTextEditorStatus","setGrokTextStatus","setGrokUniversalChatStatus","setGrokUniversalEditorStatus","setGrokUniversalStatus","setInlineStatus","setLanguageStatus","setMicrophoneMode","setMobileFontAdjustPercent","setMobileFontSizeStatus","setMobileSceneElementState","setModalAnimationStatus","setNewChatModalTab","setNotificationStatus","setOpenAiImageChatStatus","setOpenAiImageModalStatus","setOpenAiImageStatus","setOpenAiStatus","setOpenAiUniversalChatStatus","setOpenAiUniversalModalStatus","setOpenAiUniversalStatus","setPendingChatFolderChipCenterBehavior","setPollComposerStatus","setPollStyleStatus","setPollStyleSurface","setProfileAvatarUploadPending","setProfileStatus","setQwenAiModelStatus","setQwenAiProviderStatus","setQwenAiStatus","setQwenBotStatus","setQwenChatStatus","setScreenRotationAllowed","setScreenRotationStatus","setSoundStatus","setStaticSelectOptions","setThemeStatus","setVisualModeStatus","setWeatherStatus","setYandexAiModelStatus","setYandexAiProviderStatus","setYandexAiStatus","setYandexBotStatus","setYandexChatStatus","settingsControllers","settingsModal","settingsModalController","settingsModalFactory","settleChatFolderSwipeOffset","setupChatAreaMetricsSync","setupEvents","setupMobileViewportHeightSync","setupPasswordPreviewToggles","setupProfileEvents","shouldShowActiveChatFolderBar","shouldShowChatFolderBarForSelection","showCenterToast","showChatFolderContextMenu","showChatFolderPicker","showTyping","sidebar","sidebarSearch","singleEmojiPattern","snapChatFolderSwipeBack","snapComposerSelectionToCustomEmojiBoundary","sortChatsInPlace","soundSettingsController","soundSettingsFactory","soundSettingsModal","splitGraphemes","stripTriggeredBotMention","suppressContextConvertPickerFollowupClick","suppressMentionPickerFollowupClick","suppressNextChatItemTap","syncActiveChatFolderStripState","syncBackupRestoreFileName","syncChatAreaMetrics","syncChatAreaMetricsFromViewport","syncChatFolderPickerAllChatsToggleState","syncChatInfoStatusVisibility","syncChatShotButton","syncComposerRichPreview","syncContextConvertComposerButton","syncContextConvertPendingMessageState","syncContextOriginalRestorePendingMessageState","syncCurrentChatContextConvertUi","syncEmojiPickerButton","syncGrokBotUser","syncGrokTextBotFormFingerprint","syncLanguageSettingsButton","syncMentionOpenButton","syncMobileAppHeightToViewport","syncMobileBaseSceneState","syncMobileFontSettingsButton","syncMobileFontSizeViewportState","syncModalAnimationSettingsButton","syncOpenAiImageBotUser","syncOpenAiUniversalBotUser","syncPollComposerStyleUi","syncProfileColorSelection","syncRecentEmojiToServer","syncScreenRotationToggle","syncSharedGrokSettings","syncSharedOpenAiSettings","syncVisibleContextConvertMessageButtons","testAiBot","testChatShotAdminBot","testContextConvertAdminBot","testDeepseekAiConnection","testDeepseekBot","testGrokAiConnection","testGrokBot","testGrokUniversalBot","testOpenAiImageBot","testOpenAiUniversalBot","testPushNotification","testQwenAiConnection","testQwenBot","testYandexAiConnection","testYandexBot","themeSettingsModal","toggleEmojiPicker","togglePinFromRow","totalUnreadForFolder","transformComposerTextWithContextConvertBot","transformMessageWithContextConvertBot","transitionToChatFolder","transitionToChatFolderBySwipe","typingBar","uiSettings","uiSettingsFactory","uniqueAiModelValues","unpinPin","updateComposerAiOverrideState","updateCurrentUserFooter","updateMentionPicker","updateMobileFontSize","updateModalAnimationSpeed","uploadAiBotAvatar","uploadDeepseekBotAvatar","uploadGrokBotAvatar","uploadGrokUniversalBotAvatar","uploadOpenAiImageBotAvatar","uploadOpenAiUniversalBotAvatar","uploadProfileAvatar","uploadQwenBotAvatar","uploadYandexBotAvatar","userSecondaryLineText","verifyBotSaveResponse","visibleChatCountForFolder","visualModeMeta","visualModeSettingsModal","visualModeStateLabel","waitForAnimationFrames","waitForMs","weatherIcon","weatherLocationLabel","weatherSettingsController","weatherSettingsFactory","weatherSettingsModal","weatherWidget","wireAiBotToggleLabels","withActionButtons","yandexAiSettingsModal","yandexAiSettingsPayload","yandexBotFormPayload"];
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

  bootRoot.composeFeatureRuntime = composeFeatureRuntime;
})();
