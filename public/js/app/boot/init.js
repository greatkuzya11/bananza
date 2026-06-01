(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function registerCoreServices(ctx) {
    if (!ctx || typeof ctx !== 'object') return ctx;
    ctx.services.api = bootRoot.createApiService?.(ctx) || {};
    ctx.services.auth = bootRoot.createAuthService?.(ctx) || {};
    ctx.services.websocket = bootRoot.createWebSocketService?.(ctx) || {};
    ctx.services.chatList = bootRoot.createChatListService?.(ctx) || {};
    ctx.services.openChat = bootRoot.createOpenChatService?.(ctx) || {};
    ctx.services.messages = bootRoot.createMessagesService?.(ctx) || {};
    return ctx;
  }

  function init() {
    if (window.__bananzaAppRuntimeStarted) return window.BananzaAppBridge || null;
    window.__bananzaAppRuntimeStarted = true;

    const ctx = bootRoot.createRuntimeContext?.() || null;
    registerCoreServices(ctx);
    bootRoot.createPublicBridge?.(ctx);
    bootRoot.bindGlobalEvents?.(ctx);

    if (typeof bootRoot.runRuntimeAssembly !== 'function') {
      throw new Error('BananzaApp runtime assembly module is required before runtime.js');
    }

    return bootRoot.runRuntimeAssembly(ctx);
  }

  bootRoot.registerCoreServices = registerCoreServices;
  bootRoot.init = init;
})();



(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function runRuntimeStartup(scope = {}) {
    with (scope) {
      // INIT
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      async function init() {
        if (!checkAuth()) return;
        chatFolderStore.hydrateActiveFolderId();
        setChatSearchOpen(false, { clear: true, focus: false, render: false });
        syncChatHeaderActionsAccessibility();
        hydrateChatListCache();
    
        setupMobileViewportHeightSync();
        applyScreenRotationPreference({ showStatus: false, reason: 'init' }).catch(() => {});
        window.addEventListener('resize', syncMobileFontSizeViewportState, { passive: true });
        window.addEventListener('resize', () => {
          applyScreenRotationPreference({ showStatus: false, reason: 'resize' }).catch(() => {});
        }, { passive: true });
        window.addEventListener('orientationchange', syncMobileFontSizeViewportState);
        window.addEventListener('orientationchange', () => {
          applyScreenRotationPreference({ showStatus: false, reason: 'orientationchange' }).catch(() => {});
        });
        window.visualViewport?.addEventListener('resize', syncMobileFontSizeViewportState);
    
        // Mobile navigation: set initial history state for chat list
        if (isMobileLayoutViewport()) {
          history.replaceState({ view: 'chatlist' }, '');
        }
    
        // Verify token
        try {
          const data = await api('/api/auth/me');
          currentUser = {
            ...data.user,
            ui_show_chat_folder_strip_in_all_chats: Boolean(data.user?.ui_show_chat_folder_strip_in_all_chats),
          };
          syncCoreStateToRuntime();
          chatFolderStore.hydrateActiveFolderId();
          applyUiTheme(currentUser.ui_theme);
          applyVisualMode(currentUser.ui_visual_mode);
          applyModalAnimation(currentUser.ui_modal_animation);
          applyModalAnimationSpeed(currentUser.ui_modal_animation_speed);
          applyMobileFontSize(currentUser.ui_mobile_font_size);
          applyUiLanguage(currentUser.ui_language || 'ru');
          localStorage.setItem('user', JSON.stringify(currentUser));
          await window.messageCache?.init?.(currentUser.id);
          hydrateComposerDraftsForCurrentUser({ force: true });
        } catch { return; }
    
        // Update UI
        updateCurrentUserFooter();
        renderActiveChatFolderBar();
        loadWeatherSettings().then(() => loadCurrentWeather(false)).catch(() => {});
        await loadSoundSettings().catch(() => {});
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
          navigator.serviceWorker.register('/sw.js').catch(() => {});
        }
        loadNotificationSettings().catch(() => {});
    
        ensureBotVisibilityToggles();
        registerBuiltinModals();
        setupEvents();
        setupChatAreaMetricsSync();
        resetPollComposer();
        resetPollVotersModal();
        refreshPollComposerActionState();
        setupProfileEvents();
        await loadRecentEmojis();
        initEmojiPicker();
        connectWS();
        await loadChats();
        chatListStore.setInitialChatLoadFinished(true);
        setupLifecycleRecovery();
        loadAllUsers().catch(() => {});
    
        // Optional startup behavior: push deep-link, restore the last opened chat, or stay on the chat list.
        const startupChatId = Number(new URLSearchParams(location.search).get('chatId'));
        if (startupChatId && chats.find(c => c.id === startupChatId)) {
          await openChat(startupChatId);
          history.replaceState(history.state || {}, '', location.pathname);
        } else if (openLastChatOnReload) {
          const lastChat = +localStorage.getItem('lastChat');
          if (lastChat && chats.find(c => c.id === lastChat)) {
            await openChat(lastChat);
          }
        }
    
        window.dispatchEvent(new Event('bananza:ready'));
      }
    
      init();

      return window.BananzaAppBridge || null;
    }
  }

  bootRoot.runRuntimeStartup = runRuntimeStartup;
})();
