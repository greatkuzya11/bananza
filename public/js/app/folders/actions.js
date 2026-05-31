(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const foldersRoot = root.folders = root.folders || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createChatFolderActions(options = {}) {
    const opts = objectOrDefault(options);
    const win = opts.window || window;
    const api = typeof opts.api === 'function' ? opts.api : async () => ({});
    const store = opts.store;
    const ui = objectOrDefault(opts.ui);
    const state = objectOrDefault(opts.state);
    const callbacks = objectOrDefault(opts.actions);
    const tx = typeof opts.tx === 'function' ? opts.tx : (text) => String(text == null ? '' : text);

    let chatFolderRequestSeq = 0;
    let chatFolderAbortController = null;

    function getSearchFilter() {
      return typeof state.getChatSearchValue === 'function' ? state.getChatSearchValue() : '';
    }

    function renderChatList() {
      callbacks.renderChatList?.(getSearchFilter());
    }

    function showCenterToast(message) {
      callbacks.showCenterToast?.(message);
    }

    function isAbortError(error) {
      if (typeof callbacks.isAbortError === 'function') return callbacks.isAbortError(error);
      return error?.name === 'AbortError';
    }

    function activeFolder() {
      return store?.getResolvedActiveFolder?.() || null;
    }

    function setActiveChatFolder(folderId, { persist = true, render = true } = {}) {
      store?.setActiveFolderId?.(folderId, { persist });
      ui.renderActiveChatFolderBar?.();
      if (render) renderChatList();
      return activeFolder();
    }

    async function loadChatFolders({ silent = false, renderAfterLoad = true } = {}) {
      const requestId = ++chatFolderRequestSeq;
      if (chatFolderAbortController) chatFolderAbortController.abort();
      const controller = typeof win.AbortController === 'function' ? new win.AbortController() : null;
      chatFolderAbortController = controller;
      store?.setLoadFailed?.(false);

      try {
        const data = await api('/api/chat-folders', controller ? { signal: controller.signal } : {});
        if (requestId !== chatFolderRequestSeq) return store?.getFolders?.() || [];
        store?.setFolders?.(data?.folders || data || [], { persist: true });
        ui.renderActiveChatFolderBar?.();
        if (renderAfterLoad) renderChatList();
        ui.renderChatFolderPicker?.();
        callbacks.refreshManageModal?.();
        return store?.getFolders?.() || [];
      } catch (error) {
        if (!isAbortError(error) && !silent) {
          console.warn('Failed to load chat folders', error);
        }
        if (requestId !== chatFolderRequestSeq) return store?.getFolders?.() || [];
        if (!isAbortError(error)) store?.setLoadFailed?.(true);
        ui.renderActiveChatFolderBar?.();
        if (renderAfterLoad) renderChatList();
        return store?.getFolders?.() || [];
      } finally {
        if (chatFolderAbortController === controller) chatFolderAbortController = null;
      }
    }

    async function createChatFolder(name, chatIds = []) {
      const data = await api('/api/chat-folders', {
        method: 'POST',
        body: { name, chatIds },
      });
      await loadChatFolders({ silent: true });
      const nextFolderId = Number(data?.folder?.id || 0);
      if (nextFolderId && typeof callbacks.transitionToChatFolder === 'function') {
        await callbacks.transitionToChatFolder(nextFolderId, { persist: true });
      }
      showCenterToast('\u041F\u0430\u043F\u043A\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0430');
      return data?.folder || store?.getFolderById?.(nextFolderId) || null;
    }

    async function renameChatFolder(folderId, nextName = '') {
      const folder = store?.getFolderById?.(folderId);
      if (!folder || folder.kind !== 'custom') return null;
      const promptText = '\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u0430\u043F\u043A\u0438';
      const targetName = String(nextName || win.prompt?.(tx(promptText), folder.name || '') || '').trim();
      if (!targetName || targetName === folder.name) return folder;
      const data = await api(`/api/chat-folders/${folderId}`, {
        method: 'PUT',
        body: { name: targetName },
      });
      await loadChatFolders({ silent: true });
      showCenterToast('\u041F\u0430\u043F\u043A\u0430 \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0430');
      return data?.folder || store?.getFolderById?.(folderId) || null;
    }

    async function deleteChatFolder(folderId) {
      const folder = store?.getFolderById?.(folderId);
      if (!folder || folder.kind !== 'custom') return false;
      const confirmed = win.confirm?.(`${tx('\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0430\u043F\u043A\u0443')} \u00AB${folder.name}\u00BB?`);
      if (!confirmed) return false;
      await api(`/api/chat-folders/${folderId}`, { method: 'DELETE' });
      await loadChatFolders({ silent: true });
      showCenterToast('\u041F\u0430\u043F\u043A\u0430 \u0443\u0434\u0430\u043B\u0435\u043D\u0430');
      return true;
    }

    async function setChatFolderOrder(folderIds = []) {
      await api('/api/chat-folders/order', {
        method: 'PUT',
        body: { folderIds },
      });
      await loadChatFolders({ silent: true });
    }

    async function moveChatFolder(folderId, direction) {
      const folders = store?.getFolders?.() || [];
      const index = folders.findIndex((folder) => Number(folder.id || 0) === Number(folderId || 0));
      if (index < 0) return;
      const delta = direction === 'up' ? -1 : 1;
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= folders.length) return;
      const reordered = folders.map((folder) => Number(folder.id || 0));
      const moved = reordered.splice(index, 1)[0];
      reordered.splice(nextIndex, 0, moved);
      await setChatFolderOrder(reordered);
      showCenterToast(direction === 'up'
        ? '\u041F\u0430\u043F\u043A\u0430 \u0432\u044B\u0448\u0435'
        : '\u041F\u0430\u043F\u043A\u0430 \u043D\u0438\u0436\u0435');
    }

    async function addChatsToFolder(folderId, chatIds = []) {
      await api(`/api/chat-folders/${folderId}/chats`, {
        method: 'POST',
        body: { chatIds },
      });
      await loadChatFolders({ silent: true });
    }

    async function removeChatFromFolder(folderId, chatId) {
      await api(`/api/chat-folders/${folderId}/chats/${chatId}`, {
        method: 'DELETE',
      });
      await loadChatFolders({ silent: true });
    }

    async function setFolderChatPin(folderId, chatId, pinned) {
      await api(`/api/chat-folders/${folderId}/chats/${chatId}/pin`, {
        method: 'PUT',
        body: { pinned },
      });
      await loadChatFolders({ silent: true });
      showCenterToast(pinned
        ? '\u0427\u0430\u0442 \u0437\u0430\u043A\u0440\u0435\u043F\u043B\u0451\u043D \u0432 \u043F\u0430\u043F\u043A\u0435'
        : '\u0427\u0430\u0442 \u043E\u0442\u043A\u0440\u0435\u043F\u043B\u0451\u043D \u043E\u0442 \u043F\u0430\u043F\u043A\u0438');
    }

    async function moveFolderChatPin(folderId, chatId, direction) {
      await api(`/api/chat-folders/${folderId}/chats/${chatId}/pin/move`, {
        method: 'POST',
        body: { direction },
      });
      await loadChatFolders({ silent: true });
      showCenterToast(direction === 'up'
        ? '\u0427\u0430\u0442 \u0432\u044B\u0448\u0435 \u0432 \u043F\u0430\u043F\u043A\u0435'
        : '\u0427\u0430\u0442 \u043D\u0438\u0436\u0435 \u0432 \u043F\u0430\u043F\u043A\u0435');
    }

    async function handleChatFolderContextMenuAction(action, folderId) {
      if (!action || !folderId) return false;
      if (action === 'move-up-folder') {
        await moveChatFolder(folderId, 'up');
        ui.refreshChatFolderContextMenu?.(folderId);
        return true;
      }
      if (action === 'move-down-folder') {
        await moveChatFolder(folderId, 'down');
        ui.refreshChatFolderContextMenu?.(folderId);
        return true;
      }
      if (action === 'rename-folder') {
        await renameChatFolder(folderId);
        return false;
      }
      if (action === 'delete-folder') {
        await deleteChatFolder(folderId);
      }
      return false;
    }

    async function saveStripVisibility(nextValue) {
      return api('/api/user/chat-folder-strip-visibility', {
        method: 'PATCH',
        body: { show_in_all_chats: Boolean(nextValue) },
      });
    }

    function abortLoad() {
      if (chatFolderAbortController) chatFolderAbortController.abort();
      chatFolderAbortController = null;
    }

    return {
      setActiveChatFolder,
      loadChatFolders,
      createChatFolder,
      renameChatFolder,
      deleteChatFolder,
      setChatFolderOrder,
      moveChatFolder,
      addChatsToFolder,
      removeChatFromFolder,
      setFolderChatPin,
      moveFolderChatPin,
      handleChatFolderContextMenuAction,
      saveStripVisibility,
      abortLoad,
    };
  }

  foldersRoot.actions = {
    createChatFolderActions,
  };
})();
