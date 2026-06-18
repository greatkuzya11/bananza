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
      function scheduleIdleTask(callback, delayMs = 0) {
        const scheduleIdle = window.requestIdleCallback || ((idleCallback) => window.setTimeout(idleCallback, 0));
        window.setTimeout(() => {
          scheduleIdle(() => callback());
        }, Math.max(0, Number(delayMs || 0)));
      }

      function runMeasuredTask(name, task) {
        const perf = window.BananzaApp?.performance;
        const measureName = `bananza:${name}`;
        const startMark = `${measureName}-start`;
        const endMark = `${measureName}-end`;
        perf?.mark?.(startMark);
        return Promise.resolve()
          .then(() => task?.())
          .catch(() => {})
          .finally(() => {
            perf?.mark?.(endMark);
            perf?.measure?.(measureName, startMark, endMark);
          });
      }

      function scheduleMeasuredIdleTask(name, task, delayMs = 0) {
        scheduleIdleTask(() => runMeasuredTask(name, task), delayMs);
      }

      function scheduleFeaturePreloadStrategy(strategy, delayMs = 0) {
        const loader = window.BananzaApp?.featureLoader;
        if (!loader?.preloadByStrategy) return;
        scheduleIdleTask(() => {
          loader.preloadByStrategy(strategy).catch((error) => {
            console.warn(`[feature-loader] ${strategy} preload failed:`, error?.message || error);
          });
        }, delayMs);
      }

      function schedulePostReadyFeaturePreloads() {
        scheduleFeaturePreloadStrategy('idle', 250);
        if (currentUser?.is_admin) scheduleFeaturePreloadStrategy('admin-idle', 3000);
      }

      async function init() {
        const perf = window.BananzaApp?.performance;
        perf?.mark?.('bananza:init-start');
        if (!checkAuth()) return;
        perf?.mark?.('bananza:shell-setup-start');
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
        perf?.mark?.('bananza:shell-setup-end');
        perf?.measure?.('bananza:shell-setup', 'bananza:shell-setup-start', 'bananza:shell-setup-end');
    
        // Verify token
        try {
          perf?.mark?.('bananza:auth-restore-start');
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
          perf?.mark?.('bananza:auth-restore-end');
          perf?.measure?.('bananza:auth-restore', 'bananza:auth-restore-start', 'bananza:auth-restore-end');
        } catch {
          perf?.mark?.('bananza:auth-restore-end');
          perf?.measure?.('bananza:auth-restore', 'bananza:auth-restore-start', 'bananza:auth-restore-end');
          return;
        }
    
        // Update UI
        perf?.mark?.('bananza:post-auth-ui-start');
        updateCurrentUserFooter();
        renderActiveChatFolderBar();
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
        }
    
        ensureBotVisibilityToggles();
        registerBuiltinModals();
        setupEvents();
        setupChatAreaMetricsSync();
        resetPollComposer();
        resetPollVotersModal();
        refreshPollComposerActionState();
        setupProfileEvents();
        syncEmojiPickerButton();
        perf?.mark?.('bananza:post-auth-ui-end');
        perf?.measure?.('bananza:post-auth-ui', 'bananza:post-auth-ui-start', 'bananza:post-auth-ui-end');
        perf?.mark?.('bananza:ws-connect-kickoff-start');
        connectWS();
        perf?.mark?.('bananza:ws-connect-kickoff-end');
        perf?.measure?.('bananza:ws-connect-kickoff', 'bananza:ws-connect-kickoff-start', 'bananza:ws-connect-kickoff-end');
        perf?.mark?.('bananza:chats-load-start');
        await loadChats();
        perf?.mark?.('bananza:chats-load-end');
        perf?.measure?.('bananza:chats-load', 'bananza:chats-load-start', 'bananza:chats-load-end');
        chatListStore.setInitialChatLoadFinished(true);
        setupLifecycleRecovery();
    
        // Optional startup behavior: push deep-link, restore the last opened chat, or stay on the chat list.
        const startupChatId = Number(new URLSearchParams(location.search).get('chatId'));
        const startupInviteToken = chatInviteTokenFromPath(location.pathname);
        if (startupInviteToken) {
          await joinChatInviteToken(startupInviteToken, { replaceHistory: true });
        } else if (startupChatId && chats.find(c => c.id === startupChatId)) {
          await openChat(startupChatId);
          history.replaceState(history.state || {}, '', location.pathname);
        } else if (openLastChatOnReload) {
          const lastChat = +localStorage.getItem('lastChat');
          const lastChatEntry = lastChat ? chats.find(c => Number(c.id) === lastChat) : null;
          if (lastChatEntry) {
            if (Number(lastChatEntry.is_document || 0) === 1) {
              localStorage.removeItem('lastChat');
            } else {
              await openChat(lastChat);
            }
          }
        }
    
        perf?.mark?.('bananza:app-interactive');
        perf?.measure?.('bananza:startup-total', 'bananza:script-start', 'bananza:app-interactive');
        perf?.measure?.('bananza:init-total', 'bananza:init-start', 'bananza:app-interactive');
        perf?.measure?.('bananza:time-to-interactive', 'bananza:script-start', 'bananza:app-interactive');
        window.dispatchEvent(new Event('bananza:ready'));
        scheduleMeasuredIdleTask('sound-settings-load', () => loadSoundSettings(), 0);
        scheduleMeasuredIdleTask('notification-settings-load', () => loadNotificationSettings(), 50);
        scheduleMeasuredIdleTask('weather-settings-load', () => loadWeatherSettings().then(() => loadCurrentWeather(false)), 100);
        scheduleMeasuredIdleTask('emoji-recent-load', () => loadRecentEmojis(), 0);
        scheduleMeasuredIdleTask('users-background-load', () => loadAllUsers(), 200);
        if ('serviceWorker' in navigator) {
          scheduleMeasuredIdleTask('service-worker-boot', () => navigator.serviceWorker.register('/sw.js'), 250);
        }
        schedulePostReadyFeaturePreloads();
      }
    
      init();

      return window.BananzaAppBridge || null;
    }
  }

  bootRoot.runRuntimeStartup = runRuntimeStartup;
})();
