(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};
  const compositionRoot = bootRoot.composition = bootRoot.composition || {};

  compositionRoot.composeFolders = function composeFolders(scope = {}) {
    with (scope) {
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
      return window.BananzaApp.boot.composition.createEvalExports(["folderStoreFactory","folderUiFactory","folderActionsFactory","folderManageModalFactory","newFolderTabFactory","chatFolderStore","folderActionsController","folderManageModalController","folderUiController","newFolderTabController","folderControllers"], {
        get: (name) => eval(name),
        set: (name, value) => {
          const __bananzaRuntimeExportValue = value;
          eval(name + ' = __bananzaRuntimeExportValue');
        },
      });
    }
  };
})();
