(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const foldersRoot = root.folders = root.folders || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createNewFolderTab(options = {}) {
    const opts = objectOrDefault(options);
    const win = opts.window || window;
    const dom = objectOrDefault(opts.dom);
    const ui = objectOrDefault(opts.ui);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);

    let newFolderSelectedChatIds = new Set();

    function byId(id) {
      return (opts.document || document).getElementById(id);
    }

    function getEl(name, fallbackId) {
      return dom[name] || byId(fallbackId || name) || null;
    }

    function getChats() {
      const chats = typeof state.getChats === 'function' ? state.getChats() : [];
      return Array.isArray(chats) ? chats : [];
    }

    function getSelectableFolderChats() {
      const chats = [...getChats()];
      return typeof actions.compareChatsForList === 'function'
        ? chats.sort(actions.compareChatsForList)
        : chats;
    }

    function getSelectedNewFolderChatIds() {
      const availableChatIds = new Set(getChats().map((chat) => Number(chat.id || 0)));
      return [...newFolderSelectedChatIds].filter((chatId) => availableChatIds.has(Number(chatId || 0)));
    }

    function renderNewFolderChatList(filter = '') {
      const newFolderChatList = getEl('newFolderChatList', 'newFolderChatList');
      if (!newFolderChatList) return;
      const normalizedFilter = String(filter || '').trim().toLowerCase();
      const selectableChats = getSelectableFolderChats().filter((chat) => (
        !normalizedFilter
        || (typeof actions.getChatSearchHaystack === 'function'
          ? actions.getChatSearchHaystack(chat).includes(normalizedFilter)
          : String(chat?.name || '').toLowerCase().includes(normalizedFilter))
      ));
      if (!selectableChats.length) {
        newFolderChatList.innerHTML = '<div class="chat-folder-picker-empty">No chats found</div>';
        return;
      }
      newFolderChatList.innerHTML = selectableChats.map((chat) => ui.renderFolderSelectableChatItem?.(chat, {
        selected: newFolderSelectedChatIds.has(Number(chat.id || 0)),
      }) || '').join('');
    }

    function resetNewFolderForm() {
      const newFolderNameInput = getEl('newFolderNameInput', 'newFolderNameInput');
      const newFolderChatSearchInput = getEl('newFolderChatSearchInput', 'newFolderChatSearchInput');
      newFolderSelectedChatIds = new Set();
      if (newFolderNameInput) newFolderNameInput.value = '';
      if (newFolderChatSearchInput) newFolderChatSearchInput.value = '';
      renderNewFolderChatList();
    }

    function toggleChatSelection(chatId, item = null) {
      const id = Number(chatId || 0);
      if (!id) return false;
      if (newFolderSelectedChatIds.has(id)) newFolderSelectedChatIds.delete(id);
      else newFolderSelectedChatIds.add(id);
      item?.classList.toggle('selected', newFolderSelectedChatIds.has(id));
      return newFolderSelectedChatIds.has(id);
    }

    function bindEvents() {
      const createFolderBtn = getEl('createFolderBtn', 'createFolderBtn');
      const newFolderNameInput = getEl('newFolderNameInput', 'newFolderNameInput');
      const newFolderChatSearchInput = getEl('newFolderChatSearchInput', 'newFolderChatSearchInput');
      const newFolderChatList = getEl('newFolderChatList', 'newFolderChatList');

      createFolderBtn?.addEventListener('click', async () => {
        const name = String(newFolderNameInput?.value || '').trim();
        if (!name) {
          (actions.alert || win.alert)?.('Enter folder name');
          newFolderNameInput?.focus();
          return;
        }
        try {
          await actions.createChatFolder?.(name, getSelectedNewFolderChatIds());
          actions.closeAllModals?.();
          resetNewFolderForm();
        } catch (e) {
          (actions.alert || win.alert)?.(e.message || 'Could not create folder');
        }
      });

      newFolderChatSearchInput?.addEventListener('input', () => {
        renderNewFolderChatList(newFolderChatSearchInput.value);
      });

      newFolderChatList?.addEventListener('click', (e) => {
        const item = e.target.closest('.user-list-item[data-chat-id]');
        if (!item) return;
        toggleChatSelection(Number(item.dataset.chatId || 0), item);
      });
    }

    return {
      getSelectableFolderChats,
      getSelectedNewFolderChatIds,
      renderNewFolderChatList,
      resetNewFolderForm,
      toggleChatSelection,
      bindEvents,
    };
  }

  foldersRoot.newFolderTab = {
    createNewFolderTab,
  };
})();
