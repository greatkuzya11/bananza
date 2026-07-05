(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};
  const compositionRoot = bootRoot.composition = bootRoot.composition || {};

  compositionRoot.composeAdminSettings = function composeAdminSettings(scope = {}) {
    with (scope) {
      let resolvedAdminControllers = null;
      let adminControllerLoadPromise = null;

      function readAdminFactories() {
        const adminRoot = window.BananzaApp?.admin || {};
        const factories = {
          botAudit: adminRoot.botAudit?.createBotAuditController,
          backup: adminRoot.backup?.createBackupController,
          users: adminRoot.users?.createAdminUsersController,
        };
        if (typeof factories.botAudit !== 'function'
          || typeof factories.backup !== 'function'
          || typeof factories.users !== 'function') {
          throw new Error('BananzaApp admin modules are not loaded');
        }
        return factories;
      }

      async function ensureAdminControllers() {
        if (resolvedAdminControllers) return resolvedAdminControllers;
        if (adminControllerLoadPromise) return adminControllerLoadPromise;
        adminControllerLoadPromise = (async () => {
          if (!window.BananzaApp?.admin?.users && window.BananzaApp?.featureLoader?.loadFeature) {
            await window.BananzaApp.featureLoader.loadFeature('admin');
          }
          const factories = readAdminFactories();
          const adminBotAuditController = factories.botAudit({
            document,
            $,
            api: (url, opts) => api(url, opts),
            esc,
            avatarHtml,
            formatDate,
            formatTime,
            openModal: (id, options = {}) => openModal(id, options),
          });
          const adminBackupController = factories.backup({
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
          const adminUsersController = factories.users({
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
          tx: (textValue, params = {}) => tx(textValue, params),
          copyTextToClipboard: (textValue) => copyTextToClipboard(textValue),
          alert: (message) => alert(message),
          confirm: (message) => confirm(message),
          openAdminBotAuditModal: (userId, displayName) => openAdminBotAuditModal(userId, displayName),
          });
          resolvedAdminControllers = {
            users: adminUsersController,
            botAudit: adminBotAuditController,
            backup: adminBackupController,
          };
          if (appContext) appContext.services.admin = resolvedAdminControllers;
          return resolvedAdminControllers;
        })().finally(() => {
          adminControllerLoadPromise = null;
        });
        return adminControllerLoadPromise;
      }

      const adminBotAuditFactory = () => readAdminFactories().botAudit;
      const adminBackupFactory = () => readAdminFactories().backup;
      const adminUsersFactory = () => readAdminFactories().users;
      const adminBotAuditController = {
        formatBotAuditSource: (source) => window.BananzaApp?.admin?.botAudit?.formatBotAuditSource?.(source) || String(source || 'Unknown'),
        openAdminBotAuditModal: async (userId, displayName = 'User') => (await ensureAdminControllers()).botAudit.openAdminBotAuditModal(userId, displayName),
      };
      const adminBackupController = {
        setBackupExportStatus: (message, type = '') => setInlineStatus('backupExportStatus', message, type),
        setBackupRestoreStatus: (message, type = '') => setInlineStatus('backupRestoreStatus', message, type),
        syncBackupRestoreFileName: () => resolvedAdminControllers?.backup?.syncBackupRestoreFileName?.(),
        resetBackupRestoreState: (options = {}) => resolvedAdminControllers?.backup?.resetBackupRestoreState?.(options),
        renderBackupRestorePreview: (data = {}) => resolvedAdminControllers?.backup?.renderBackupRestorePreview?.(data),
        openBackupExportModal: async () => (await ensureAdminControllers()).backup.openBackupExportModal(),
        downloadBackupExport: async () => (await ensureAdminControllers()).backup.downloadBackupExport(),
        previewBackupRestore: async () => (await ensureAdminControllers()).backup.previewBackupRestore(),
        applyBackupRestore: async () => (await ensureAdminControllers()).backup.applyBackupRestore(),
      };
      const adminUsersController = {
        renderAdminUserRow: (user) => resolvedAdminControllers?.users?.renderAdminUserRow?.(user) || '',
        refreshAdminUserStatuses: () => resolvedAdminControllers?.users?.refreshAdminUserStatuses?.(),
        openAdminModal: async () => (await ensureAdminControllers()).users.openAdminModal(),
      };
    
      const uiSettingsFactory = window.BananzaApp?.settings?.ui?.createUiSettings;
      const weatherSettingsFactory = window.BananzaApp?.settings?.weather?.createWeatherSettings;
      const mapSettingsFactory = window.BananzaApp?.settings?.maps?.createMapSettings;
      const notificationSettingsFactory = window.BananzaApp?.settings?.notifications?.createNotificationSettings;
      const soundSettingsFactory = window.BananzaApp?.settings?.sound?.createSoundSettings;
      const settingsModalFactory = window.BananzaApp?.settings?.modal?.createSettingsModal;
      if (typeof uiSettingsFactory !== 'function'
        || typeof weatherSettingsFactory !== 'function'
        || typeof mapSettingsFactory !== 'function'
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
      const mapSettingsController = mapSettingsFactory({
        document,
        window,
        api: (url, opts) => api(url, opts),
        actions: {
          setInlineStatus: (...args) => setInlineStatus(...args),
          onSettingsSaved: () => composerLocationController?.loadMapConfig?.({ force: true }),
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
        api: (url, opts) => api(url, opts),
        i18nHelpers,
        ui: uiSettings,
        weather: weatherSettingsController,
        maps: mapSettingsController,
        notifications: notificationSettingsController,
        sound: soundSettingsController,
        getCurrentUser: () => currentUser,
        actions: {
          copyTextToClipboard: (textValue) => copyTextToClipboard(textValue),
        },
      });
      const settingsControllers = {
        ui: uiSettings,
        weather: weatherSettingsController,
        maps: mapSettingsController,
        notifications: notificationSettingsController,
        sound: soundSettingsController,
        modal: settingsModalController,
      };
      if (appContext) appContext.services.settings = settingsControllers;
      return window.BananzaApp.boot.composition.createEvalExports(["adminBotAuditFactory","adminBackupFactory","adminUsersFactory","adminBotAuditController","adminBackupController","adminUsersController","uiSettingsFactory","weatherSettingsFactory","mapSettingsFactory","notificationSettingsFactory","soundSettingsFactory","settingsModalFactory","setCurrentUserFromSettings","uiSettings","weatherSettingsController","mapSettingsController","notificationSettingsController","soundSettingsController","settingsModalController","settingsControllers"], {
        get: (name) => eval(name),
        set: (name, value) => {
          const __bananzaRuntimeExportValue = value;
          eval(name + ' = __bananzaRuntimeExportValue');
        },
      });
    }
  };
})();
