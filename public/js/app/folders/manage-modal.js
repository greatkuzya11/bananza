(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const foldersRoot = root.folders = root.folders || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function defaultEsc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function createChatFolderManageModal(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const dom = objectOrDefault(opts.dom);
    const store = opts.store;
    const ui = objectOrDefault(opts.ui);
    const modals = objectOrDefault(opts.modals);
    const actions = objectOrDefault(opts.actions);
    const formatters = objectOrDefault(opts.formatters);
    const esc = typeof formatters.esc === 'function' ? formatters.esc : defaultEsc;

    let chatFolderManageState = null;

    function $(selector, rootEl = doc) {
      if (typeof dom.$ === 'function') return dom.$(selector, rootEl);
      return rootEl?.querySelector?.(selector) || null;
    }

    function byId(id) {
      return doc.getElementById(id);
    }

    function getChats() {
      const chats = typeof opts.getChats === 'function' ? opts.getChats() : [];
      return Array.isArray(chats) ? chats : [];
    }

    function getChatById(chatId) {
      if (typeof opts.getChatById === 'function') return opts.getChatById(chatId);
      const id = Number(chatId || 0);
      return getChats().find((chat) => Number(chat.id || 0) === id) || null;
    }

    function openModal(id, optionsForOpen = {}) {
      if (typeof modals.open === 'function') return modals.open(id, optionsForOpen);
      return actions.openModal?.(id, optionsForOpen);
    }

    function setChatFolderManageStatus(message, type = '') {
      const el = byId('chatFolderManageStatus');
      if (!el) return;
      el.textContent = message || '';
      el.classList.toggle('is-success', type === 'success');
      el.classList.toggle('is-error', type === 'error');
    }

    function resetChatFolderManageModal() {
      chatFolderManageState = null;
      setChatFolderManageStatus('');
      const title = byId('chatFolderManageTitle');
      if (title) title.textContent = 'Manage folders';
      const systemList = byId('chatFolderManageSystemList');
      if (systemList) systemList.innerHTML = '';
      const customList = byId('chatFolderManageCustomList');
      if (customList) customList.innerHTML = '';
      byId('chatFolderManageSystemWrap')?.classList.add('hidden');
    }

    function renderChatFolderManageModal(chatId = chatFolderManageState?.chatId) {
      const chat = getChatById(chatId);
      if (!chat) return;
      chatFolderManageState = {
        chatId: Number(chatId || 0),
      };
      const title = byId('chatFolderManageTitle');
      if (title) title.textContent = `\u041F\u0430\u043F\u043A\u0438: ${chat.name || 'Chat'}`;

      const foldersForChat = store?.getFoldersForChat?.(chatId) || [];
      const systemFolders = foldersForChat.filter((folder) => folder.system);
      const customFolders = (store?.getFolders?.() || []).filter((folder) => folder.kind === 'custom');
      const selectedCustomIds = new Set(
        foldersForChat.filter((folder) => folder.kind === 'custom').map((folder) => Number(folder.id || 0))
      );
      const systemWrap = byId('chatFolderManageSystemWrap');
      const systemList = byId('chatFolderManageSystemList');
      const customList = byId('chatFolderManageCustomList');
      if (systemWrap && systemList) {
        systemWrap.classList.toggle('hidden', systemFolders.length === 0);
        systemList.innerHTML = systemFolders.map((folder) => `
        <span class="chat-folder-chip is-system">${ui.chatFolderIconMarkup?.('bot_auto') || ''} ${esc(folder.name || '\u041F\u0430\u043F\u043A\u0430')}</span>
      `).join('');
      }
      if (customList) {
        if (!customFolders.length) {
          customList.innerHTML = '<div class="chat-folder-picker-empty">\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0440\u0443\u0447\u043D\u044B\u0445 \u043F\u0430\u043F\u043E\u043A</div>';
        } else {
          customList.innerHTML = customFolders.map((folder) => `
          <div class="user-list-item${selectedCustomIds.has(Number(folder.id || 0)) ? ' selected' : ''}" data-folder-id="${Number(folder.id || 0)}">
            ${ui.chatFolderEmojiMarkup?.('custom') || ''}
            <div class="user-list-copy">
              <div class="name">${esc(folder.name || 'Folder')}</div>
              <div class="user-list-meta">${esc(store?.folderSummaryText?.(folder, getChats()) || '')}</div>
            </div>
          </div>
        `).join('');
        }
      }
      setChatFolderManageStatus('');
    }

    async function openChatFolderManageModal(chatId, opener = null) {
      if (!chatId) return;
      if (!store?.loadedOnce) {
        await actions.loadChatFolders?.({ silent: true, renderAfterLoad: false }).catch(() => {});
      }
      openModal('chatFolderManageModal', { replaceStack: false, opener });
      renderChatFolderManageModal(chatId);
    }

    function getSelectedCustomFolderIds() {
      return new Set(
        Array.from($('#chatFolderManageCustomList')?.querySelectorAll?.('.user-list-item.selected') || [])
          .map((el) => Number(el.dataset.folderId || 0))
          .filter(Boolean)
      );
    }

    function getCurrentCustomFolderIds(chatId) {
      return new Set(
        (store?.getFoldersForChat?.(chatId) || [])
          .filter((folder) => folder.kind === 'custom')
          .map((folder) => Number(folder.id || 0))
      );
    }

    async function saveChatFolderManageChanges() {
      const chatId = Number(chatFolderManageState?.chatId || 0);
      if (!chatId) return;
      const selectedIds = getSelectedCustomFolderIds();
      const currentIds = getCurrentCustomFolderIds(chatId);
      const toAdd = [...selectedIds].filter((folderId) => !currentIds.has(folderId));
      const toRemove = [...currentIds].filter((folderId) => !selectedIds.has(folderId));
      setChatFolderManageStatus('\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u044E...');
      try {
        await Promise.all(toAdd.map((folderId) => actions.addChatsToFolder?.(folderId, [chatId])));
        for (const folderId of toRemove) {
          await actions.removeChatFromFolder?.(folderId, chatId);
        }
        renderChatFolderManageModal(chatId);
        setChatFolderManageStatus('\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E', 'success');
      } catch (error) {
        setChatFolderManageStatus(error?.message || '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043F\u0430\u043F\u043A\u0438', 'error');
      }
    }

    function bindEvents() {
      byId('chatFolderManageCustomList')?.addEventListener('click', (e) => {
        const item = e.target.closest('.user-list-item[data-folder-id]');
        if (!item) return;
        item.classList.toggle('selected');
        setChatFolderManageStatus('');
      });
      (dom.chatFolderManageSaveBtn || byId('chatFolderManageSaveBtn'))?.addEventListener('click', () => {
        saveChatFolderManageChanges().catch((error) => {
          setChatFolderManageStatus(error?.message || 'Could not save folders', 'error');
        });
      });
    }

    return {
      setChatFolderManageStatus,
      resetChatFolderManageModal,
      renderChatFolderManageModal,
      openChatFolderManageModal,
      saveChatFolderManageChanges,
      getSelectedCustomFolderIds,
      getCurrentCustomFolderIds,
      getState: () => (chatFolderManageState ? { ...chatFolderManageState } : null),
      bindEvents,
    };
  }

  foldersRoot.manageModal = {
    createChatFolderManageModal,
  };
})();
