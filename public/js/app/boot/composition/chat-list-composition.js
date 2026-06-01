(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};
  const compositionRoot = bootRoot.composition = bootRoot.composition || {};

  compositionRoot.composeChatList = function composeChatList(scope = {}) {
    with (scope) {
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
      return window.BananzaApp.boot.composition.createEvalExports(["chatListStoreFactory","chatListRendererFactory","chatListDataFactory","presenceControllerFactory","chatListRecoveryFactory","chatListStore","chatListRenderer","chatListDataController","presenceController","chatListRecoveryController","chatListControllers"], {
        get: (name) => eval(name),
        set: (name, value) => {
          const __bananzaRuntimeExportValue = value;
          eval(name + ' = __bananzaRuntimeExportValue');
        },
      });
    }
  };
})();
