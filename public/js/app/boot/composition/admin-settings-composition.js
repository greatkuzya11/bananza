(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};
  const compositionRoot = bootRoot.composition = bootRoot.composition || {};

  compositionRoot.composeAdminSettings = function composeAdminSettings(scope = {}) {
    with (scope) {
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
      return window.BananzaApp.boot.composition.createEvalExports(["adminBotAuditFactory","adminBackupFactory","adminUsersFactory","adminBotAuditController","adminBackupController","adminUsersController","uiSettingsFactory","weatherSettingsFactory","notificationSettingsFactory","soundSettingsFactory","settingsModalFactory","setCurrentUserFromSettings","uiSettings","weatherSettingsController","notificationSettingsController","soundSettingsController","settingsModalController","settingsControllers"], {
        get: (name) => eval(name),
        set: (name, value) => {
          const __bananzaRuntimeExportValue = value;
          eval(name + ' = __bananzaRuntimeExportValue');
        },
      });
    }
  };
})();
