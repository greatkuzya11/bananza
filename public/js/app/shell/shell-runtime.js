(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const shellRoot = root.shell = root.shell || {};

  function createShellRuntimeAdapter(scope = {}) {
    with (scope) {
      // SIDEBAR RESIZE
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      (() => {
        const handle = $('#resizeHandle');
        if (!handle) return;
        let dragging = false;
        let startX, startW;
        const SIDEBAR_WIDTH_KEY = 'sidebarWidth';
        const MIN_SIDEBAR_WIDTH = 200;
        const MAX_SIDEBAR_WIDTH = 600;
    
        function clampSidebarWidth(value) {
          const width = Number(value || 0);
          const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0, MIN_SIDEBAR_WIDTH);
          const maxAllowed = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, viewportWidth - 80));
          if (!Number.isFinite(width) || width <= 0) return maxAllowed;
          return Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxAllowed, Math.round(width)));
        }
    
        function applySidebarWidth() {
          if (isMobileLayoutViewport()) {
            sidebar.style.width = '';
            return;
          }
          const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY) || 0);
          if (saved > 0) sidebar.style.width = `${clampSidebarWidth(saved)}px`;
          else sidebar.style.width = `${clampSidebarWidth(sidebar.offsetWidth || 320)}px`;
        }
    
        function persistSidebarWidth(width = sidebar.offsetWidth) {
          if (isMobileLayoutViewport()) return;
          localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clampSidebarWidth(width)));
        }
    
        applySidebarWidth();
        window.addEventListener('resize', applySidebarWidth);
    
        handle.addEventListener('mousedown', (e) => {
          e.preventDefault();
          dragging = true;
          startX = e.clientX;
          startW = sidebar.offsetWidth;
          handle.classList.add('active');
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        });
    
        document.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          const newW = clampSidebarWidth(startW + e.clientX - startX);
          sidebar.style.width = newW + 'px';
        });
    
        document.addEventListener('mouseup', () => {
          if (!dragging) return;
          dragging = false;
          handle.classList.remove('active');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          persistSidebarWidth(sidebar.offsetWidth);
        });
    
        // Touch support
        handle.addEventListener('touchstart', (e) => {
          dragging = true;
          startX = e.touches[0].clientX;
          startW = sidebar.offsetWidth;
          handle.classList.add('active');
        }, { passive: true });
    
        document.addEventListener('touchmove', (e) => {
          if (!dragging) return;
          const newW = clampSidebarWidth(startW + e.touches[0].clientX - startX);
          sidebar.style.width = newW + 'px';
        }, { passive: true });
    
        document.addEventListener('touchend', () => {
          if (!dragging) return;
          dragging = false;
          handle.classList.remove('active');
          persistSidebarWidth(sidebar.offsetWidth);
        });
      })();
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // DRAG & DROP
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function handleDragEnter(...args) { return composerTypingDragDropController?.handleDragEnter?.(...args); }
    
      function handleDragOver(...args) { return composerTypingDragDropController?.handleDragOver?.(...args); }
    
      function handleDragLeave(...args) { return composerTypingDragDropController?.handleDragLeave?.(...args); }
    
      function handleDrop(...args) { return composerTypingDragDropController?.handleDrop?.(...args); }
    
      function renderTypingBar(...args) { return composerTypingDragDropController?.renderTypingBar?.(...args); }
    
      function showTyping(...args) { return composerTypingDragDropController?.showTyping?.(...args); }
    
      function hideTyping(...args) { return composerTypingDragDropController?.hideTyping?.(...args); }
    
      // EMOJI PICKER
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function normalizeRecentEmojiValue(...args) { return composerEmojiPickerController?.normalizeRecentEmojiValue?.(...args) || ''; }
    
      function isValidRecentEmojiValue(...args) { return Boolean(composerEmojiPickerController?.isValidRecentEmojiValue?.(...args)); }
    
      function normalizeRecentEmojiList(...args) { return composerEmojiPickerController?.normalizeRecentEmojiList?.(...args) || []; }
    
      function mergeRecentEmojiLists(...args) { return composerEmojiPickerController?.mergeRecentEmojiLists?.(...args) || []; }
    
      function getRecentEmojiStorageKey(...args) { return composerEmojiPickerController?.getRecentEmojiStorageKey?.(...args) || ''; }
    
      function getRecentEmojiCategory(...args) { return composerEmojiPickerController?.getRecentEmojiCategory?.(...args) || ''; }
    
      function loadLocalRecentEmojis(...args) { return composerEmojiPickerController?.loadLocalRecentEmojis?.(...args) || []; }
    
      function persistLocalRecentEmojis(...args) { return composerEmojiPickerController?.persistLocalRecentEmojis?.(...args); }
    
      async function loadRecentEmojis(...args) { return composerEmojiPickerController?.loadRecentEmojis?.(...args); }
    
      function rememberRecentEmoji(...args) { return composerEmojiPickerController?.rememberRecentEmoji?.(...args); }
    
      function syncRecentEmojiToServer(...args) { return composerEmojiPickerController?.syncRecentEmojiToServer?.(...args) || Promise.resolve(null); }
    
      function getEmojiPickerCategories(...args) { return composerEmojiPickerController?.getEmojiPickerCategories?.(...args) || []; }
    
      function isCustomEmojiCategory(...args) { return Boolean(composerEmojiPickerController?.isCustomEmojiCategory?.(...args)); }
    
      function getEmojiCategoryItems(...args) { return composerEmojiPickerController?.getEmojiCategoryItems?.(...args) || []; }
    
      function getEmojiCategoryLabel(...args) { return composerEmojiPickerController?.getEmojiCategoryLabel?.(...args) || ''; }
    
      function renderEmojiGridItemHtml(...args) { return composerEmojiPickerController?.renderEmojiGridItemHtml?.(...args) || ''; }
    
      function renderEmojiGridItemsHtml(...args) { return composerEmojiPickerController?.renderEmojiGridItemsHtml?.(...args) || ''; }
    
      function renderEmojiPickerGrid(...args) { return composerEmojiPickerController?.renderEmojiPickerGrid?.(...args); }
    
      function setEmojiPickerCategory(...args) { return composerEmojiPickerController?.setEmojiPickerCategory?.(...args); }
    
      function initEmojiPicker(...args) { return composerEmojiPickerController?.initEmojiPicker?.(...args); }
    
      function syncEmojiPickerButton(...args) { return composerEmojiPickerController?.syncEmojiPickerButton?.(...args); }
    
      function positionEmojiPicker(...args) { return composerEmojiPickerController?.positionEmojiPicker?.(...args); }
    
      function openEmojiPicker(...args) { return composerEmojiPickerController?.openEmojiPicker?.(...args) || false; }
    
      function closeEmojiPicker(...args) { return composerEmojiPickerController?.closeEmojiPicker?.(...args); }
    
      function dismissEmojiPickerOutsideGesture(...args) { return composerEmojiPickerController?.dismissEmojiPickerOutsideGesture?.(...args); }
    
      function toggleEmojiPicker(...args) { return composerEmojiPickerController?.toggleEmojiPicker?.(...args) || false; }
    
      // MODALS
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // New chat modal
      function getSelectableFolderChats() { return newFolderTabController.getSelectableFolderChats(); }
      function getSelectedNewFolderChatIds() { return newFolderTabController.getSelectedNewFolderChatIds(); }
      function renderNewFolderChatList(filter = '') { return newFolderTabController.renderNewFolderChatList(filter); }
      function resetNewFolderForm() { return newFolderTabController.resetNewFolderForm(); }
    
      const NEW_CHAT_MODAL_TABS = Object.freeze(['private', 'group', 'document', 'folder']);
    
      function normalizeNewChatModalTab(tabName = 'private') {
        const nextTab = String(tabName || 'private');
        return NEW_CHAT_MODAL_TABS.includes(nextTab) ? nextTab : 'private';
      }
    
      function getNewChatModalActiveTab() {
        const activeTab = newChatModal?.querySelector?.('.modal-tab.active')?.dataset?.tab;
        return normalizeNewChatModalTab(activeTab);
      }
    
      function getNewChatTabPane(tabName = 'private') {
        const nextTab = normalizeNewChatModalTab(tabName);
        return newChatModal?.querySelector?.(`#${nextTab}Tab`) || null;
      }
    
      function prepareNewChatTabContent(tabName = 'private') {
        const nextTab = normalizeNewChatModalTab(tabName);
        if (nextTab === 'folder') {
          renderNewFolderChatList(newFolderChatSearchInput?.value || '');
        }
        return nextTab;
      }
    
      function createNewChatTabPreview(tabName = 'private') {
        const nextTab = prepareNewChatTabContent(tabName);
        const pane = getNewChatTabPane(nextTab);
        if (!(pane instanceof HTMLElement)) return document.createElement('div');
        const clone = pane.cloneNode(true);
        syncClonedFormControls(pane, clone);
        stripCloneIds(clone);
        clone.classList.add('active');
        clone.classList.remove('horizontal-swipe-live');
        clone.setAttribute('aria-hidden', 'true');
        return clone;
      }
    
      function applyNewChatModalTab(tabName = 'private') {
        if (!newChatModal) return;
        const nextTab = prepareNewChatTabContent(tabName);
        newChatModal.querySelectorAll('.modal-tab').forEach((tab) => {
          tab.classList.toggle('active', tab.dataset.tab === nextTab);
        });
        newChatModal.querySelectorAll('.tab-pane').forEach((pane) => {
          const isActive = pane.id === `${nextTab}Tab`;
          pane.classList.toggle('active', isActive);
          pane.classList.toggle('horizontal-swipe-live', isActive);
        });
        return nextTab;
      }
    
      function setNewChatModalTab(tabName = 'private', { animate = false, direction = 0, source = 'tab' } = {}) {
        const nextTab = normalizeNewChatModalTab(tabName);
        if (animate && newChatTabSwipePager && getNewChatModalActiveTab() !== nextTab) {
          return newChatTabSwipePager.goToKey(nextTab, { direction, source });
        }
        return applyNewChatModalTab(nextTab);
      }
    
      function initNewChatTabSwipePager() {
        const body = newChatModal?.querySelector?.('.modal-body');
        const tabs = newChatModal?.querySelector?.('.modal-tabs');
        if (!(body instanceof HTMLElement)) return null;
        newChatTabSwipePager?.destroy();
        newChatTabSwipePager = createHorizontalSwipePager({
          root: body,
          listenTargets: [tabs],
          getKeys: () => NEW_CHAT_MODAL_TABS,
          getActiveKey: () => getNewChatModalActiveTab(),
          setActiveKey: (tabName) => {
            applyNewChatModalTab(tabName);
          },
          renderPage: (tabName) => createNewChatTabPreview(tabName),
          pageGap: 16,
          isAvailable: () => isFloatingSurfaceVisible(newChatModal),
          getCommitDistance: (width) => Math.max(32, Math.min(
            48,
            Math.round(Math.max(1, Number(width || 0)) * 0.12)
          )),
          isAllowedStartTarget: (target) => {
            if (!(target instanceof Element)) return false;
            if (target.closest('.modal-tabs .modal-tab')) return true;
            return !target.closest('button, a, input, textarea, select, label, [contenteditable="true"]');
          },
        });
        applyNewChatModalTab(getNewChatModalActiveTab());
        return newChatTabSwipePager;
      }
    
      async function openNewChatModal() {
        openModal('newChatModal', { replaceStack: true });
        newChatTabSwipePager?.reset();
        setNewChatModalTab('private');
        $('#groupName').value = '';
        const documentNameEl = $('#documentName');
        if (documentNameEl) documentNameEl.value = '';
        resetNewFolderForm();
        try {
          const users = await api('/api/users');
          const privateList = $('#userListPrivate');
          const groupList = $('#userListGroup');
          const documentList = $('#userListDocument');
    
          privateList.innerHTML = users.map((user) => renderSelectableUserItem(user, { showPresence: true })).join('')
            || '<div style="color:var(--text-secondary);padding:12px">No other users yet</div>';
    
          groupList.innerHTML = users.map((user) => renderSelectableUserItem(user)).join('');
          if (documentList) documentList.innerHTML = users.map((user) => renderSelectableUserItem(user)).join('');
    
          // Private: click to start chat
          privateList.querySelectorAll('.user-list-item').forEach(el => {
            el.addEventListener('click', async () => {
              try {
                const chat = await api('/api/chats/private', { method: 'POST', body: { targetUserId: +el.dataset.uid } });
                closeAllModals();
                await loadChats();
                openChat(chat.id);
              } catch {}
            });
          });
    
          // Group: toggle selection
          groupList.querySelectorAll('.user-list-item').forEach(el => {
            el.addEventListener('click', () => el.classList.toggle('selected'));
          });
          documentList?.querySelectorAll('.user-list-item')?.forEach(el => {
            el.addEventListener('click', () => el.classList.toggle('selected'));
          });
          renderNewFolderChatList();
        } catch {}
      }
    
      // Admin modal
      async function openAdminModal() {
        return adminUsersController.openAdminModal();
      }
    
      async function openAdminBotAuditModal(userId, displayName = 'User') {
        return adminBotAuditController.openAdminBotAuditModal(userId, displayName);
      }
    
      function setBackupExportStatus(message, type = '') {
        return adminBackupController.setBackupExportStatus(message, type);
      }
    
      function setBackupRestoreStatus(message, type = '') {
        return adminBackupController.setBackupRestoreStatus(message, type);
      }
    
      function syncBackupRestoreFileName() {
        return adminBackupController.syncBackupRestoreFileName();
      }
    
      function resetBackupRestoreState({ clearFile = false } = {}) {
        return adminBackupController.resetBackupRestoreState({ clearFile });
      }
    
      function renderBackupRestorePreview(data = {}) {
        return adminBackupController.renderBackupRestorePreview(data);
      }
    
      function openBackupExportModal() {
        return adminBackupController.openBackupExportModal();
      }
    
      async function downloadBackupExport() {
        return adminBackupController.downloadBackupExport();
      }
    
      async function previewBackupRestore() {
        return adminBackupController.previewBackupRestore();
      }
    
      async function applyBackupRestore() {
        return adminBackupController.applyBackupRestore();
      }
    
      // Settings modal
      function openSettingsModal(opener = $('#settingsBtn')) { return settingsModalController.openSettingsModal(opener); }
      function openLanguageSettingsModal() { return settingsModalController.openLanguageSettingsModal(); }
      function openThemeSettingsModal() { return settingsModalController.openThemeSettingsModal(); }
      function openVisualModeSettingsModal() { return settingsModalController.openVisualModeSettingsModal(); }
      function openPollStyleSettingsModal() { return settingsModalController.openPollStyleSettingsModal(); }
      function openAnimationSettingsModal() { return settingsModalController.openAnimationSettingsModal(); }
      function openMobileFontSettingsModal() { return settingsModalController.openMobileFontSettingsModal(); }
      function openWeatherSettingsModal() { return settingsModalController.openWeatherSettingsModal(); }
      function openNotificationSettingsModal() { return settingsModalController.openNotificationSettingsModal(); }
      function openSoundSettingsModal() { return settingsModalController.openSoundSettingsModal(); }
      let aiAdminEventsLoadPromise = null;
      function ensureAiAdminEventsBound() {
        if (aiAdminEventController?.bindEvents?.()) return Promise.resolve(true);
        const hasEventController = typeof window.BananzaApp?.aiAdmin?.createEventController === 'function';
        if (!hasEventController && window.BananzaApp?.featureLoader?.loadFeature) {
          aiAdminEventsLoadPromise = aiAdminEventsLoadPromise || window.BananzaApp.featureLoader.loadFeature('ai-admin-events')
            .finally(() => {
              aiAdminEventsLoadPromise = null;
            });
          return aiAdminEventsLoadPromise.then(() => ensureAiAdminEventsBound());
        }
        if (!aiAdminEventController && hasEventController) {
          aiAdminEventController = window.BananzaApp.aiAdmin.createEventController({
            scope: createRuntimeProxyScope(),
          });
        }
        aiAdminEventController?.bindEvents?.();
        return Promise.resolve(Boolean(aiAdminEventController));
      }
      function primeAiAdminEvents() {
        ensureAiAdminEventsBound().catch((error) => {
          console.error('Failed to bind AI admin events', error);
        });
      }
      function openAiBotSettingsModal() {
        if (!currentUser?.is_admin) return;
        primeAiAdminEvents();
        openModal('aiBotSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
        resetManagedModalScroll('aiBotSettingsModal');
        setAiBotModalStatus('\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e...', 'pending');
        Promise.all([loadAiBotState(), loadOpenAiUniversalState(), loadOpenAiImageState()]).then(() => {
          resetManagedModalScroll('aiBotSettingsModal');
          setAiBotModalStatus('');
        }).catch((e) => {
          const message = e.message || 'Could not load OpenAI AI bots';
          setAiBotModalStatus(message, 'error');
        });
      }
    
      function openOpenAiTextBotsModal() {
        if (!currentUser?.is_admin) return;
        primeAiAdminEvents();
        openModal('openAiTextBotsModal', { replaceStack: false, opener: $('#openAiOpenTextBots') });
        resetManagedModalScroll('openAiTextBotsModal');
        setAiBotTextModalStatus('\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e...', 'pending');
        loadAiBotState().then(() => {
          renderOpenAiTextBotsSettings();
          resetManagedModalScroll('openAiTextBotsModal');
          setAiBotTextModalStatus('');
        }).catch((e) => {
          setAiBotTextModalStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c OpenAI text bots', 'error');
        });
      }
    
      function openOpenAiUniversalBotsModal() {
        if (!currentUser?.is_admin) return;
        primeAiAdminEvents();
        openModal('openAiUniversalBotsModal', { replaceStack: false, opener: $('#openAiOpenUniversalBots') });
        resetManagedModalScroll('openAiUniversalBotsModal');
        setOpenAiUniversalModalStatus('Loading...', 'pending');
        loadOpenAiUniversalState().then(() => {
          renderOpenAiUniversalSettings();
          resetManagedModalScroll('openAiUniversalBotsModal');
          setOpenAiUniversalModalStatus('');
        }).catch((e) => {
          setOpenAiUniversalModalStatus(e.message || 'Could not load OpenAI universal bots', 'error');
        });
      }
    
      function openOpenAiImageBotsModal() {
        if (!currentUser?.is_admin) return;
        primeAiAdminEvents();
        openModal('openAiImageBotsModal', { replaceStack: false, opener: $('#openAiOpenImageBots') });
        resetManagedModalScroll('openAiImageBotsModal');
        setOpenAiImageModalStatus('Loading...', 'pending');
        const hasState = openAiImageState.chats.length || openAiImageState.bots.length;
        if (hasState) {
          renderOpenAiImageSettings();
          resetManagedModalScroll('openAiImageBotsModal');
          setOpenAiImageModalStatus('Refreshing...', 'pending');
        }
        loadOpenAiImageState().then(() => {
          renderOpenAiImageSettings();
          resetManagedModalScroll('openAiImageBotsModal');
          setOpenAiImageModalStatus('');
        }).catch((e) => {
          setOpenAiImageModalStatus(e.message || 'Could not load OpenAI image bots', 'error');
        });
      }
    
      function openYandexAiSettingsModal() {
        if (!currentUser?.is_admin) return;
        primeAiAdminEvents();
        openModal('yandexAiSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
        setYandexAiStatus('Loading...');
        loadYandexAiState().then(() => setYandexAiStatus('')).catch((e) => {
          setYandexAiStatus(e.message || 'Could not load Yandex AI bots', 'error');
        });
      }
    
      function openDeepseekAiSettingsModal() {
        if (!currentUser?.is_admin) return;
        primeAiAdminEvents();
        openModal('deepseekAiSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
        setDeepseekAiStatus('Loading...');
        loadDeepseekAiState().then(() => setDeepseekAiStatus('')).catch((e) => {
          setDeepseekAiStatus(e.message || 'Could not load DeepSeek AI bots', 'error');
        });
      }
    
      function openDeepseekTextBotsModal() {
        if (!currentUser?.is_admin) return;
        primeAiAdminEvents();
        ensureDeepseekTextBotsModalContent();
        openModal('deepseekAiTextBotsModal', { replaceStack: false, opener: $('#deepseekAiOpenTextBots') });
        resetManagedModalScroll('deepseekAiTextBotsModal');
        setDeepseekBotStatus('Loading...', 'pending');
        setDeepseekChatStatus('');
        loadDeepseekAiState().then(() => {
          resetManagedModalScroll('deepseekAiTextBotsModal');
          setDeepseekBotStatus('');
        }).catch((e) => {
          setDeepseekBotStatus(e.message || 'Could not load DeepSeek text bots', 'error');
        });
      }
    
      function openQwenAiSettingsModal() {
        if (!currentUser?.is_admin) return;
        primeAiAdminEvents();
        openModal('qwenAiSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
        setQwenAiStatus('Loading...');
        loadQwenAiState().then(() => setQwenAiStatus('')).catch((e) => {
          setQwenAiStatus(e.message || 'Could not load Qwen AI bots', 'error');
        });
      }
    
      function openQwenTextBotsModal() {
        if (!currentUser?.is_admin) return;
        primeAiAdminEvents();
        ensureQwenTextBotsModalContent();
        openModal('qwenAiTextBotsModal', { replaceStack: false, opener: $('#qwenAiOpenTextBots') });
        resetManagedModalScroll('qwenAiTextBotsModal');
        setQwenBotStatus('Loading...', 'pending');
        setQwenChatStatus('');
        loadQwenAiState().then(() => {
          resetManagedModalScroll('qwenAiTextBotsModal');
          setQwenBotStatus('');
        }).catch((e) => {
          setQwenBotStatus(e.message || 'Could not load Qwen text bots', 'error');
        });
      }
    
      function resetManagedModalScroll(modalId) {
        return settingsModalController.resetManagedModalScroll(modalId);
      }
    
      function openGrokAiSettingsModal() {
        if (!currentUser?.is_admin) return;
        primeAiAdminEvents();
        openModal('grokAiSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
        resetManagedModalScroll('grokAiSettingsModal');
        setGrokAiStatus('Loading...');
        loadGrokAiState().then(() => {
          renderGrokAiSettings();
          resetManagedModalScroll('grokAiSettingsModal');
          setGrokAiStatus('');
        }).catch((e) => {
          setGrokAiStatus(e.message || 'Could not load Grok AI bots', 'error');
        });
      }
    
      function openGrokTextBotsModal() {
        if (!currentUser?.is_admin) return;
        primeAiAdminEvents();
        mountGrokBotPanels();
        openModal('grokAiTextBotsModal', { replaceStack: false, opener: $('#grokAiOpenTextBots') });
        resetManagedModalScroll('grokAiTextBotsModal');
        setGrokTextStatus('Loading...');
        const hasState = grokBotState.chats.length || grokBotState.bots.length || grokBotState.imageBots.length;
        if (hasState) {
          renderGrokTextBotsSettings();
          resetManagedModalScroll('grokAiTextBotsModal');
          setGrokTextStatus('Refreshing...');
        }
        loadGrokAiState().then(() => {
          renderGrokTextBotsSettings();
          resetManagedModalScroll('grokAiTextBotsModal');
          setGrokTextStatus('');
        }).catch((e) => {
          setGrokTextStatus(e.message || 'Could not load Grok text bots', 'error');
        });
      }
    
      function openGrokImageBotsModal() {
        if (!currentUser?.is_admin) return;
        primeAiAdminEvents();
        mountGrokBotPanels();
        openModal('grokAiImageBotsModal', { replaceStack: false, opener: $('#grokAiOpenImageBots') });
        resetManagedModalScroll('grokAiImageBotsModal');
        setGrokImageStatus('Loading...');
        const hasState = grokBotState.chats.length || grokBotState.bots.length || grokBotState.imageBots.length;
        if (hasState) {
          renderGrokImageBotsSettings();
          resetManagedModalScroll('grokAiImageBotsModal');
          setGrokImageStatus('Refreshing...');
        }
        loadGrokAiState().then(() => {
          renderGrokImageBotsSettings();
          resetManagedModalScroll('grokAiImageBotsModal');
          setGrokImageStatus('');
        }).catch((e) => {
          setGrokImageStatus(e.message || 'Could not load Grok image bots', 'error');
        });
      }
    
      function openGrokUniversalBotsModal() {
        if (!currentUser?.is_admin) return;
        primeAiAdminEvents();
        mountGrokBotPanels();
        openModal('grokAiUniversalBotsModal', { replaceStack: false, opener: $('#grokAiOpenUniversalBots') });
        resetManagedModalScroll('grokAiUniversalBotsModal');
        setGrokUniversalStatus('Loading...');
        loadGrokUniversalState().then(() => {
          renderGrokUniversalBotsSettings();
          resetManagedModalScroll('grokAiUniversalBotsModal');
          setGrokUniversalStatus('');
        }).catch((e) => {
          setGrokUniversalStatus(e.message || 'Could not load Grok universal bots', 'error');
        });
      }
    
      function resetChangePasswordFields() {
        ['cpOldPass', 'cpNewPass', 'cpNewPassConfirm'].forEach(id => {
          const input = document.getElementById(id);
          if (!input) return;
          input.value = '';
          input.type = 'password';
        });
      }
    
      function openChangePasswordModal() {
        openModal('changePasswordModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
        resetChangePasswordFields();
        $('#cpError').textContent = '';
        $('#cpSuccess').textContent = '';
      }
    
      // Chat info modal
      async function openChatInfoModal(opener = getChatSettingsActionOpener()) {
        if (!currentChatId) return;
        openModal('chatInfoModal', { replaceStack: true, opener });
        const chat = chats.find(c => c.id === currentChatId), isDocument = isDocumentChat(chat), chatInfoTitle = $('#chatInfoTitle');
        if (chatInfoTitle) chatInfoTitle.textContent = chat ? (chat.document_title || chat.name) : t('Chat Info');
        chatInfoModal?.classList.toggle('is-document-settings', isDocument);
        syncChatInfoStatusVisibility(chat);
        // Sync compact view toggle
        $('#chatCompactViewSection')?.classList.toggle('hidden', isDocument);
        if ($('#compactViewToggle')) $('#compactViewToggle').checked = compactView;
        ['#chatPreferencesSection', '#chatRemindersSection', '#chatBackgroundSection'].forEach((selector) => $(selector)?.classList.toggle('hidden', isDocument));
        if (isDocument) setChatPreferencesStatus('');
        else await loadChatPreferences(currentChatId);
        renderChatPinSettingsForm(chat);
        renderChatInviteLinkForm(chat);
        renderChatContextTransformForm(chat);
        renderChatShotForm(getCurrentChatShotState());
        loadChatShotState(currentChatId, { force: true }).catch((error) => {
          renderChatShotForm(null);
          setChatShotChatStatus(error.message || 'Could not load ChatShot', 'error');
        });
        renderChatDangerControls(chat);
        window.dispatchEvent(new CustomEvent('bananza:chatinfoopen', { detail: { chatId: currentChatId } }));
        const contextTransformToggle = $('#chatContextTransformToggle');
        if (contextTransformToggle) {
          contextTransformToggle.onchange = () => {
            saveChatContextTransformSetting().catch((error) => {
              setChatContextTransformStatus(error.message || 'Could not save context transform setting', 'error');
            });
          };
        }
        ['chatShotToggle', 'chatShotBotSelect', 'chatShotStyleSelect', 'chatShotBananaFilterToggle'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            el.onchange = () => {
              saveChatShotChatSetting().catch((error) => {
                setChatShotChatStatus(error.message || 'Could not save ChatShot setting', 'error');
              });
            };
          }
        });
        // Group/document edit section
        const editSection = $('#chatEditSection');
        if (chat && !isNotesChat(chat) && (isDocument || chat.type === 'group' || chat.type === 'general')) {
          editSection.classList.remove('hidden');
          const chatAvatarEl = $('#chatAvatar');
          const removeChatAvatarBtn = $('#removeChatAvatar');
          const chatNameInput = $('#chatNameInput');
          const chatNameLabel = $('#chatNameFieldLabel');
          if (chatNameLabel) chatNameLabel.textContent = t(isDocument ? 'Document name' : 'Group name');
          if (chat.avatar_url) {
            chatAvatarEl.style.background = '#5eb5f7';
            chatAvatarEl.innerHTML = `<img class="avatar-img" src="${esc(chat.avatar_url)}" alt="">`;
            removeChatAvatarBtn.classList.remove('hidden');
          } else {
            chatAvatarEl.style.background = '#5eb5f7';
            chatAvatarEl.innerHTML = isDocument ? '\ud83d\udcc4' : (chat.type === 'general' ? '\ud83c\udf10' : '\ud83d\udc65');
            removeChatAvatarBtn.classList.add('hidden');
          }
          if (chatNameInput) { chatNameInput.maxLength = isDocument ? 80 : 50; chatNameInput.value = isDocument ? (chat.document_title || chat.name || '') : chat.name; }
          // Save name
          $('#saveChatNameBtn').onclick = async () => {
            const name = $('#chatNameInput').value.trim();
            if (!name) return;
            try {
              const result = isDocument
                ? await api(`/api/documents/${currentChatId}/title`, { method: 'PUT', body: { title: name } })
                : await api(`/api/chats/${currentChatId}`, { method: 'PUT', body: { name } });
              applyChatUpdate(isDocument ? (result.chat || {}) : (result || {}));
              closeAllModals();
            } catch (e) { alert(e.message); }
          };
          // Upload chat avatar
          $('#chatAvatarInput').onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const fd = new FormData();
            fd.append('avatar', file);
            try {
              const updated = await api(`/api/chats/${currentChatId}/avatar`, { method: 'POST', body: fd });
              applyChatUpdate(updated || {});
              refreshChatInfoPresentation(updated || {});
            } catch (e) { alert(e.message); }
          };
          // Remove chat avatar
          removeChatAvatarBtn.onclick = async () => {
            try {
              const updated = await api(`/api/chats/${currentChatId}/avatar`, { method: 'DELETE' });
              applyChatUpdate(updated || {});
              refreshChatInfoPresentation(updated || {});
            } catch (e) { alert(e.message); }
          };
        } else {
          editSection.classList.add('hidden');
        }
        // Background controls (available for message chats)
        try {
          const bgPreviewEl = $('#chatBackgroundPreview');
          const bgInput = $('#chatBackgroundInput');
          const removeBgBtn = $('#removeChatBackground');
          const bgStyleSelect = $('#chatBackgroundStyle');
          if (!isDocument && bgPreviewEl) {
            if (chat && chat.background_url) {
              bgPreviewEl.style.backgroundImage = `url(${esc(chat.background_url)})`;
              applyBackgroundStyleToElement(bgPreviewEl, chat.background_style || 'cover');
              removeBgBtn.classList.remove('hidden');
            } else {
              bgPreviewEl.style.backgroundImage = '';
              applyBackgroundStyleToElement(bgPreviewEl, 'cover');
              removeBgBtn.classList.add('hidden');
            }
            bgStyleSelect.value = chat && chat.background_style ? chat.background_style : 'cover';
    
            bgInput.onchange = async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              const fd = new FormData();
              fd.append('background', file);
              fd.append('style', bgStyleSelect.value || 'cover');
              try {
                const updated = await api(`/api/chats/${currentChatId}/background`, { method: 'POST', body: fd });
                applyChatUpdate(updated || {});
                refreshChatInfoPresentation(updated || {});
              } catch (err) { alert(err.message); }
            };
    
            removeBgBtn.onclick = async () => {
              if (!confirm('Remove background?')) return;
              try {
                const updated = await api(`/api/chats/${currentChatId}/background`, { method: 'DELETE' });
                applyChatUpdate(updated || {});
                refreshChatInfoPresentation(updated || {});
              } catch (err) { alert(err.message); }
            };
    
            bgStyleSelect.onchange = async () => {
              try {
                const style = bgStyleSelect.value;
                const updated = await api(`/api/chats/${currentChatId}/background-style`, { method: 'PUT', body: { style } });
                applyChatUpdate(updated || {});
                refreshChatInfoPresentation(updated || {});
              } catch (err) { alert(err.message); }
            };
          }
        } catch (e) {}
    
        try {
          const targetChatId = currentChatId;
          const clearBtn = $('#clearChatHistoryBtn');
          const leaveBtn = $('#leaveChatBtn');
          const deleteBtn = $('#deleteChatBtn');
          if (clearBtn) clearBtn.onclick = async () => {
            await clearChatHistoryForEveryone(targetChatId);
            renderChatDangerControls(getChatById(targetChatId));
          };
          if (leaveBtn) leaveBtn.onclick = async () => {
            await leaveChat(targetChatId);
          };
          if (deleteBtn) deleteBtn.onclick = async () => {
            await deleteChatCompletely(targetChatId);
          };
        } catch (e) {}
    
        try {
          const members = await api(`/api/chats/${currentChatId}/members`);
          // Cache members for this chat so header can count per-chat online users
          try { chatMembersCache.set(currentChatId, members); } catch (e) {}
          const memberList = $('#chatMemberList');
          const ownerId = Number(chat?.created_by || 0);
          const canRemove = chat && chat.type === 'group' && (ownerId === Number(currentUser.id) || currentUser.is_admin);
    
          memberList.innerHTML = members.map(u => {
            const isOwner = ownerId && Number(u.id) === ownerId;
            return `
            <div class="user-list-item${isOwner ? ' chat-owner' : ''}" data-uid="${u.id}" data-bot="${u.is_ai_bot ? 1 : 0}">
              <div class="member-avatar-wrap${isOwner ? ' is-owner' : ''}" title="${isOwner ? 'Chat creator' : ''}">
                ${avatarHtml(u.display_name, u.avatar_color, u.avatar_url)}
                ${isOwner ? '<span class="member-owner-crown" aria-label="Chat creator" title="Chat creator">&#128081;</span>' : ''}
              </div>
              <div>
                <div class="name">${esc(u.display_name)}</div>
                <div class="admin-user-status ${u.is_ai_bot ? 'bot' : (onlineUsers.has(u.id) ? 'online' : 'offline')}">
                  <span class="status-dot"></span>${u.is_ai_bot ? 'AI bot' : (onlineUsers.has(u.id) ? 'online' : 'offline')}
                </div>
              </div>
              ${canRemove && u.id !== currentUser.id ? `<button class="member-remove" data-uid="${u.id}" title="Remove">\u2715</button>` : ''}
            </div>
          `;
          }).join('');
          memberList.innerHTML = members.map((user) => renderChatMemberItem(user, { ownerId, canRemove })).join('');
    
          // Update status indicators in modal
          try { refreshChatMemberStatuses(); } catch (e) {}
          try { refreshChatInfoStatus(); } catch (e) {}
          try {
            const botData = { bots: [] };
            const botSection = $('#chatBotInfoSection');
            const botList = $('#chatBotList');
            const bots = Array.isArray(botData?.bots) ? botData.bots : [];
            if (botSection && botList) {
              if (!bots.length) {
                botSection.classList.add('hidden');
                botList.innerHTML = '';
              } else {
                botSection.classList.remove('hidden');
                botList.innerHTML = bots.map((bot) => `
                  <div class="user-list-item is-ai-bot" data-uid="${bot.user_id}">
                    ${avatarHtml(bot.name, bot.avatar_color, bot.avatar_url)}
                    <div class="user-list-copy">
                      <div class="name">${esc(bot.name)}</div>
                      <div class="user-list-meta">${esc(['@' + (bot.mention || ''), bot.model || ''].filter(Boolean).join(' \u2022 '))}</div>
                    </div>
                  </div>
                `).join('');
              }
            }
          } catch (e) {}
    
          // Remove member handlers
          memberList.querySelectorAll('.member-remove').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              if (!confirm('Remove this member?')) return;
              try {
                await api(`/api/chats/${currentChatId}/members/${btn.dataset.uid}`, { method: 'DELETE' });
                // Invalidate cached members for this chat and refresh modal
                try { chatMembersCache.delete(currentChatId); } catch (e) {}
                openChatInfoModal();
              } catch (e) { alert(e.message); }
            });
          });
    
          // Add member section for groups
          const addWrap = $('#addMemberWrap');
          if (chat && chat.type === 'group') {
            addWrap.classList.remove('hidden');
            const allUsers = await api('/api/users');
            const memberIds = new Set(members.map(m => m.id));
            const nonMembers = allUsers.filter(u => !memberIds.has(u.id));
    
            const addList = $('#addMemberList');
            addList.innerHTML = nonMembers.map((user) => renderSelectableUserItem(user)).join('')
              || '<div style="color:var(--text-secondary)">All users are already members</div>';
    
            addList.querySelectorAll('.user-list-item').forEach(el => {
              el.addEventListener('click', async () => {
                try {
                  await api(`/api/chats/${currentChatId}/members`, { method: 'POST', body: { userId: +el.dataset.uid } });
                  // Invalidate cached members for this chat and refresh modal
                  try { chatMembersCache.delete(currentChatId); } catch (e) {}
                  openChatInfoModal();
                } catch {}
              });
            });
          } else {
            addWrap.classList.add('hidden');
          }
        } catch {}
      }
    
      // Profile editor (menu drawer)
      const AVATAR_COLORS = ['#e17076','#7bc862','#e5ca77','#65aadd','#a695e7','#ee7aae','#6ec9cb','#faa774','#9b2f4a','#7f8f2f','#2f5d9b','#5f3f8f','#9a5a2f','#6f7b8a','#2fae8f','#4b5563'];

      function setProfileStatus(message, type = '') {
        setInlineStatus('profileStatus', message, type);
      }

      const profileStatusEditor = window.BananzaApp?.shell?.profileStatusEditor?.createProfileStatusEditor?.({
        $, esc, t, getCurrentUser: () => currentUser, setProfileStatus,
      }) || null;

      function getProfileStatusSelection() {
        return profileStatusEditor?.getSelection?.() || { key: '', text: '' };
      }
    
      function getProfileSelectedColor() {
        const checked = $('#colorPicker input[name="profileAvatarColor"]:checked');
        return checked?.value || currentUser?.avatar_color || AVATAR_COLORS[3];
      }
    
      function setProfileAvatarUploadPending(pending) {
        ['#profileAvatarInput', '#profileAvatarCameraInput'].forEach((selector) => {
          const input = $(selector);
          if (input) input.disabled = !!pending;
        });
        document.querySelectorAll('.profile-avatar-picker, .profile-avatar-camera, #profileCameraCaptureBtn').forEach((button) => {
          button.classList.toggle('is-pending', !!pending);
          if (pending) button.setAttribute('aria-busy', 'true');
          else button.removeAttribute('aria-busy');
          if ('disabled' in button) button.disabled = !!pending;
        });
      }
    
      function renderProfileAvatarPreview(color = currentUser?.avatar_color) {
        const avatarEl = $('#profileAvatar');
        setAvatarElementVisual(avatarEl, {
          name: currentUser?.display_name || currentUser?.username || '',
          color: color || currentUser?.avatar_color || AVATAR_COLORS[3],
          avatarUrl: currentUser?.avatar_url || '',
        });
        $('#removeProfileAvatar')?.classList.toggle('hidden', !currentUser?.avatar_url);
      }
    
      function syncProfileColorSelection(color) {
        const selected = color || getProfileSelectedColor();
        $('#colorPicker')?.querySelectorAll('.color-swatch').forEach((swatch) => {
          const input = swatch.querySelector('input[name="profileAvatarColor"]');
          const isActive = input?.value === selected;
          swatch.classList.toggle('active', isActive);
          if (input) input.checked = isActive;
        });
        if (!currentUser?.avatar_url) renderProfileAvatarPreview(selected);
      }

      function renderProfileColorPicker() {
        const picker = $('#colorPicker');
        if (!picker) return;
        const selectedColor = currentUser?.avatar_color || AVATAR_COLORS[3];
        picker.innerHTML = AVATAR_COLORS.map((color, index) =>
          `<label class="color-swatch${color === selectedColor ? ' active' : ''}" style="--profile-color:${esc(color)}">
            <input type="radio" name="profileAvatarColor" value="${esc(color)}" ${color === selectedColor ? 'checked' : ''} aria-label="${esc(`${t('Avatar Color')} ${index + 1}`)}">
            <span class="color-swatch-dot" aria-hidden="true"></span>
          </label>`
        ).join('');
      }
    
      function renderProfileEditor({ preserveStatus = false } = {}) {
        if (!currentUser) return;
        renderProfileAvatarPreview();
        $('#profileDisplayPreview').textContent = currentUser.display_name || currentUser.username || '';
        $('#profileUsername').textContent = '@' + currentUser.username;
        $('#profileName').value = currentUser.display_name || '';
        profileStatusEditor?.hydrate?.();
        renderProfileColorPicker();
        if (!preserveStatus) setProfileStatus('');
      }
    
      function openMenuDrawer(opener = $('#menuBtn')) {
        hideFloatingMessageActions({ immediate: true });
        renderProfileEditor();
        openModal('menuDrawer', { replaceStack: true, opener });
      }

      async function uploadProfileAvatar(file) {
        if (!file) return false;
        const fd = new FormData();
        const BlobCtor = typeof window.Blob === 'function' ? window.Blob : null;
        const isBlob = Boolean(BlobCtor && file instanceof BlobCtor);
        const isBlobLike = isBlob || Boolean(
          file
          && typeof file === 'object'
          && (typeof file.arrayBuffer === 'function' || typeof file.size === 'number')
          && typeof file.type === 'string'
        );
        if (isBlobLike) {
          try {
            fd.append('avatar', file, file.name || 'avatar-camera.jpg');
          } catch {
            fd.append('avatar', file);
          }
        } else {
          fd.append('avatar', file);
        }
        setProfileStatus('Uploading...', 'pending');
        setProfileAvatarUploadPending(true);
        try {
          const res = await api('/api/profile/avatar', { method: 'POST', body: fd });
          applyUserUpdate(res.user || {});
          setProfileStatus('Profile saved', 'success');
          return true;
        } catch (e) {
          setProfileStatus(e.message || 'Upload failed', 'error');
          return false;
        } finally {
          setProfileAvatarUploadPending(false);
        }
      }

      async function removeProfileAvatar() {
        setProfileStatus('Removing...', 'pending');
        try {
          const res = await api('/api/profile/avatar', { method: 'DELETE' });
          applyUserUpdate(res.user || { id: currentUser.id, avatar_url: null });
          setProfileStatus('Profile saved', 'success');
        } catch (e) {
          setProfileStatus(e.message || 'Remove avatar failed', 'error');
        }
      }
    
      async function saveProfileChanges() {
        const name = $('#profileName')?.value.trim() || '';
        if (!name) {
          setProfileStatus('Name is required', 'error');
          $('#profileName')?.focus();
          return;
        }
        const color = getProfileSelectedColor();
        const profileStatus = getProfileStatusSelection();
        if (profileStatus.key === 'custom' && !profileStatus.text) {
          setProfileStatus('Custom status is required', 'error');
          $('#profileCustomStatus')?.focus();
          return;
        }
        setProfileStatus('Saving...', 'pending');
        try {
          const res = await api('/api/profile', {
            method: 'PUT',
            body: {
              displayName: name,
              avatarColor: color,
              profileStatusKey: profileStatus.key,
              profileStatusText: profileStatus.text,
            },
          });
          applyUserUpdate(res.user || {});
          setProfileStatus('Profile saved', 'success');
        } catch (e) {
          setProfileStatus(e.message || 'Profile save failed', 'error');
        }
      }

      function bindProfileAvatarCameraEvents() {
        const factory = window.BananzaApp?.shell?.profileAvatarCamera?.createProfileAvatarCameraController;
        if (typeof factory !== 'function') return false;
        factory({
          window, document, navigator, $, openModal, closeModal, registerModal, setInlineStatus, setProfileStatus, uploadProfileAvatar,
        }).bindEvents();
        return true;
      }
    
      function setupProfileEvents() {
        if (!bindProfileAvatarCameraEvents()) {
          window.BananzaApp?.featureLoader?.loadFeature?.('profile-avatar-camera')
            ?.then(bindProfileAvatarCameraEvents)
            .catch((error) => setProfileStatus(error.message || 'Camera unavailable', 'error'));
        }
    
        $('#removeProfileAvatar')?.addEventListener('click', () => {
          withActionButtons('removeProfileAvatar', 'Removing...', removeProfileAvatar).catch((e) => {
            setProfileStatus(e.message || 'Remove avatar failed', 'error');
          });
        });
    
        $('#colorPicker')?.addEventListener('change', (e) => {
          const input = e.target.closest('input[name="profileAvatarColor"]');
          if (!input) return;
          syncProfileColorSelection(input.value);
          setProfileStatus('');
        });

        profileStatusEditor?.bindEvents?.();
     
        $('#profileName')?.addEventListener('input', (e) => {
          const value = e.target.value.trim();
          if (value) $('#profileDisplayPreview').textContent = value;
          setProfileStatus('');
        });
    
        $('#profileForm')?.addEventListener('submit', (e) => {
          e.preventDefault();
          withActionButtons('saveProfileBtn', 'Saving...', saveProfileChanges).catch((error) => {
            setProfileStatus(error.message || 'Profile save failed', 'error');
          });
        });
      }
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // AUTO RESIZE TEXTAREA
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function getVisibleComposerToolCount(...args) { return composerTextController?.getVisibleComposerToolCount?.(...args) || 0; }
    
      function getComposerInputWidthForMode(...args) { return composerTextController?.getComposerInputWidthForMode?.(...args) || 1; }
    
      function getNormalComposerInputWidth(...args) { return composerTextController?.getNormalComposerInputWidth?.(...args) || 1; }
    
      function measureMsgInputScrollHeight(...args) { return composerTextController?.measureMsgInputScrollHeight?.(...args) || 0; }
    
      function getComposerInputTextMetrics(...args) { return composerTextController?.getComposerInputTextMetrics?.(...args) || { lineHeight: 20, paddingY: 0, borderY: 0, singleLineHeight: 20, twoLineHeight: 40 }; }
    
      function renderComposerRichPreviewContent(...args) { return composerTextController?.renderComposerRichPreviewContent?.(...args) || { html: '', hasEmoji: false, maxEmojiHeight: 0 }; }
    
      function syncComposerRichPreview(...args) { return composerTextController?.syncComposerRichPreview?.(...args) || 0; }
    
      function autoResize(...args) { return composerTextController?.autoResize?.(...args); }
    
      function animateSendButton(...args) { return composerTextController?.animateSendButton?.(...args); }
    
      function animateBackButton() {
        if (!backBtn) return;
        backBtn.classList.remove('is-spinning');
        void backBtn.offsetWidth;
        backBtn.classList.add('is-spinning');
        clearTimeout(backBtn.__spinTimer);
        backBtn.__spinTimer = setTimeout(() => {
          backBtn.classList.remove('is-spinning');
        }, 230);
      }
    
      function resetBackButtonNavigationState() {
        if (!backBtn) return;
        clearTimeout(backBtn.__navTimer);
        clearTimeout(backBtn.__unlockTimer);
        clearTimeout(backBtn.__spinTimer);
        inAppChatBackSkipNextPopstate = false;
        backBtn.classList.remove('is-spinning');
        backBtn.__isNavigating = false;
      }
    
      function deferBackButtonNavigationRelease() {
        if (!backBtn) return;
        clearTimeout(backBtn.__unlockTimer);
        // iOS Safari can deliver the history transition slightly later than the tap handler.
        backBtn.__unlockTimer = setTimeout(() => {
          if (!backBtn) return;
          if (isIosViewportFixTarget) iosBackNavigationToken = 0;
          inAppChatBackSkipNextPopstate = false;
          backBtn.__isNavigating = false;
          backBtn.classList.remove('is-spinning');
        }, isIosViewportFixTarget ? 420 : 260);
      }
    
      function animateChatHeaderActionButton(buttonOrSelector) {
        const button = typeof buttonOrSelector === 'string' ? $(buttonOrSelector) : buttonOrSelector;
        if (!button) return;
        button.classList.remove('is-spinning');
        void button.offsetWidth;
        button.classList.add('is-spinning');
        clearTimeout(button.__spinTimer);
        button.__spinTimer = setTimeout(() => {
          button.classList.remove('is-spinning');
        }, 380);
      }
    
      function prefersReducedMotion() {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      }
    
      function cancelPendingSidebarReveal() {
        if (!sidebar) return;
        if (sidebar.__revealFrame) {
          cancelAnimationFrame(sidebar.__revealFrame);
          sidebar.__revealFrame = 0;
        }
        if (sidebar.__revealFallbackTimer) {
          clearTimeout(sidebar.__revealFallbackTimer);
          sidebar.__revealFallbackTimer = null;
        }
        if (sidebar.__revealAnimation) {
          const animation = sidebar.__revealAnimation;
          sidebar.__revealAnimation = null;
          animation.onfinish = null;
          animation.oncancel = null;
          try { animation.cancel(); } catch {}
        }
        try {
          sidebar.getAnimations?.().forEach((animation) => {
            if (animation?.id === 'sidebarRevealAnimation') animation.cancel();
          });
        } catch {}
        sidebar.style.transform = '';
        sidebar.style.willChange = '';
        clearTimeout(mobileRouteTransitionTimer);
        mobileRouteTransitionTimer = null;
        mobileRouteTransitionActive = false;
        document.documentElement.classList.remove('is-mobile-route-transitioning');
      }
    
      function isMobileChatHistoryState(state = history.state) {
        return Boolean(state && typeof state === 'object' && Number(state.chat || 0) > 0);
      }
    
      function isResolvedMobileChatScene() {
        return Boolean(isMobileLayoutViewport() && getResolvedMobileBaseScene() === 'chat');
      }
    
      function normalizeMobileChatListHistoryState() {
        if (!isMobileLayoutViewport()) return;
        pendingMobileChatListHistoryNormalization = false;
        const currentState = history.state;
        const alreadyNormalized = Boolean(
          currentState
          && typeof currentState === 'object'
          && currentState.view === 'chatlist'
          && !Object.prototype.hasOwnProperty.call(currentState, 'chat')
        );
        if (alreadyNormalized) return;
        history.replaceState({ view: 'chatlist' }, '');
      }
    
      function revealSidebarFromChat({ forceAnimation = false } = {}) {
        if (!sidebar) return;
        const shouldAnimateReveal = Boolean(
          forceAnimation
          || (isMobileLayoutViewport() && getResolvedMobileBaseScene() === 'chat')
          || sidebar.classList.contains('sidebar-hidden')
        );
        markCurrentChatReadIfAtBottom(false);
        flushCurrentChatScrollAnchor(currentChatId, { force: true, allowPendingMedia: true });
        pauseCurrentChatMediaPlayback();
        dismissMobileComposer({ forceRecovery: true, reason: 'reveal-sidebar', recoveryDelayMs: 280 });
        hideFloatingMessageActions({ immediate: true });
        hideMentionPicker();
        closeEmojiPicker({ immediate: true });
        hideAttachMenu({ immediate: true });
        cancelPendingSidebarReveal();
        syncMobileBaseSceneState({
          scene: 'sidebar',
          hideInactive: true,
        });
    
        if (!shouldAnimateReveal) {
          syncMobileBaseSceneState({ scene: 'sidebar', hideInactive: true, repaint: true });
          flushDeferredRecoverySync();
          return;
        }
    
        sidebar.classList.add('sidebar-no-transition');
        sidebar.classList.add('sidebar-hidden');
        void sidebar.offsetWidth;
    
        beginMobileRouteTransition(Math.max(260, Math.ceil(getElementTransitionTotalMs(sidebar) || 250)) + 90);
    
        const finishReveal = () => {
          if (!sidebar) return;
          const animation = sidebar.__revealAnimation;
          if (sidebar.__revealAnimation) {
            sidebar.__revealAnimation.onfinish = null;
            sidebar.__revealAnimation.oncancel = null;
            sidebar.__revealAnimation = null;
          }
          if (sidebar.__revealFallbackTimer) {
            clearTimeout(sidebar.__revealFallbackTimer);
            sidebar.__revealFallbackTimer = null;
          }
          sidebar.__revealFrame = 0;
          sidebar.classList.remove('sidebar-hidden');
          sidebar.classList.remove('sidebar-no-transition');
          sidebar.style.transform = '';
          sidebar.style.willChange = '';
          try { animation?.cancel?.(); } catch {}
          endMobileRouteTransition();
        };
    
        // Mobile browsers can lose the previous transform frame after background resume.
        // Start every reveal from an explicit offscreen transform so the slide always runs.
        sidebar.classList.add('sidebar-no-transition');
        sidebar.style.willChange = 'transform';
        sidebar.style.transform = 'translate3d(-100%,0,0)';
        sidebar.classList.remove('sidebar-hidden');
        void sidebar.offsetWidth;
        sidebar.classList.remove('sidebar-no-transition');
        void animateChatFolderContentEntry({ allowDuringMobileRoute: true });
    
        if (!isIosViewportFixTarget && typeof sidebar.animate === 'function') {
          const animation = sidebar.animate(
            [
              { transform: 'translate3d(-100%,0,0)' },
              { transform: 'translate3d(0,0,0)' },
            ],
            {
              duration: 260,
              easing: 'cubic-bezier(.2,.85,.2,1)',
              fill: 'forwards',
            }
          );
          animation.id = 'sidebarRevealAnimation';
          sidebar.__revealAnimation = animation;
          sidebar.__revealFallbackTimer = setTimeout(finishReveal, 240);
          animation.onfinish = finishReveal;
          animation.oncancel = () => {
            if (sidebar.__revealAnimation === animation) sidebar.__revealAnimation = null;
          };
          return;
        }
    
        sidebar.__revealFrame = requestAnimationFrame(() => {
          sidebar.style.transform = 'translate3d(0,0,0)';
          sidebar.__revealFrame = 0;
          sidebar.__revealFallbackTimer = setTimeout(finishReveal, 240);
        });
      }
    
      function navigateBackToChatList({ fromInAppButton = false } = {}) {
        hideFloatingMessageActions({ immediate: true });
        if (fromInAppButton && isResolvedMobileChatScene()) {
          if (isMobileChatHistoryState(history.state)) {
            pendingMobileChatListHistoryNormalization = true;
            inAppChatBackSkipNextPopstate = true;
            revealSidebarFromChat({ forceAnimation: true });
            history.back();
            return;
          }
          revealSidebarFromChat({ forceAnimation: true });
          normalizeMobileChatListHistoryState();
          return;
        }
        if (fromInAppButton && isMobileLayoutViewport()) {
          normalizeMobileChatListHistoryState();
          return;
        }
        if (isMobileChatHistoryState(history.state)) {
          history.back();
          return;
        }
        if (isResolvedMobileChatScene()) {
          revealSidebarFromChat({ forceAnimation: true });
          normalizeMobileChatListHistoryState();
          return;
        }
        revealSidebarFromChat({ forceAnimation: true });
      }
    
      function setupPasswordPreviewToggles() {
        $$('.pw-toggle').forEach(btn => {
          if (btn.dataset.bound === '1') return;
          const targetId = btn.dataset.target;
          const getInput = () => targetId ? document.getElementById(targetId) : null;
          const setVisible = (visible) => {
            const input = getInput();
            if (!input) return;
            input.type = visible ? 'text' : 'password';
            btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
          };
          let pressPreviewed = false;
          const show = (e) => {
            e.preventDefault();
            pressPreviewed = true;
            setVisible(true);
          };
          const hide = (e) => {
            e?.preventDefault?.();
            setVisible(false);
          };
    
          btn.dataset.bound = '1';
          btn.addEventListener('pointerdown', show);
          btn.addEventListener('pointerup', hide);
          btn.addEventListener('pointercancel', hide);
          btn.addEventListener('pointerleave', hide);
          btn.addEventListener('touchstart', show, { passive: false });
          btn.addEventListener('touchend', hide, { passive: false });
          btn.addEventListener('touchcancel', hide, { passive: false });
          btn.addEventListener('blur', hide);
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (pressPreviewed) {
              pressPreviewed = false;
              return;
            }
            setVisible(true);
            setTimeout(() => setVisible(false), 500);
          });
          btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') show(e);
          });
          btn.addEventListener('keyup', (e) => {
            if (e.key === 'Enter' || e.key === ' ') hide(e);
          });
        });
      }
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // EVENT LISTENERS
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function createRuntimeEventScope() {
        const scope = Object.create(null);
        const bindGlobal = (name, value) => {
          if (typeof value !== 'undefined') scope[name] = value;
        };
        bindGlobal('window', window);
        bindGlobal('document', document);
        bindGlobal('$', $);
        bindGlobal('$$', $$);
        bindGlobal('console', window.console || console);
        bindGlobal('Math', window.Math || Math);
        bindGlobal('Date', window.Date || Date);
        bindGlobal('Number', window.Number || Number);
        bindGlobal('String', window.String || String);
        bindGlobal('Boolean', window.Boolean || Boolean);
        bindGlobal('Array', window.Array || Array);
        bindGlobal('Object', window.Object || Object);
        bindGlobal('Promise', window.Promise || Promise);
        bindGlobal('Set', window.Set || Set);
        bindGlobal('Map', window.Map || Map);
        bindGlobal('WeakMap', window.WeakMap || WeakMap);
        bindGlobal('RegExp', window.RegExp || RegExp);
        bindGlobal('JSON', window.JSON || JSON);
        bindGlobal('parseInt', window.parseInt || parseInt);
        bindGlobal('parseFloat', window.parseFloat || parseFloat);
        bindGlobal('encodeURIComponent', window.encodeURIComponent || encodeURIComponent);
        bindGlobal('decodeURIComponent', window.decodeURIComponent || decodeURIComponent);
        bindGlobal('URL', window.URL);
        bindGlobal('URLSearchParams', window.URLSearchParams);
        bindGlobal('FormData', window.FormData);
        bindGlobal('Blob', window.Blob);
        bindGlobal('File', window.File);
        bindGlobal('FileReader', window.FileReader);
        bindGlobal('Image', window.Image);
        bindGlobal('MutationObserver', window.MutationObserver);
        bindGlobal('IntersectionObserver', window.IntersectionObserver);
        bindGlobal('ResizeObserver', window.ResizeObserver);
        bindGlobal('localStorage', window.localStorage);
        bindGlobal('sessionStorage', window.sessionStorage);
        bindGlobal('history', window.history);
        bindGlobal('navigator', window.navigator);
        bindGlobal('location', window.location);
        bindGlobal('confirm', window.confirm?.bind?.(window));
        bindGlobal('alert', window.alert?.bind?.(window));
        bindGlobal('setTimeout', window.setTimeout?.bind?.(window) || setTimeout);
        bindGlobal('clearTimeout', window.clearTimeout?.bind?.(window) || clearTimeout);
        bindGlobal('setInterval', window.setInterval?.bind?.(window) || setInterval);
        bindGlobal('clearInterval', window.clearInterval?.bind?.(window) || clearInterval);
        bindGlobal('requestAnimationFrame', window.requestAnimationFrame?.bind?.(window) || ((callback) => window.setTimeout(callback, 16)));
        bindGlobal('cancelAnimationFrame', window.cancelAnimationFrame?.bind?.(window) || ((id) => window.clearTimeout(id)));

        const names = "          activateScrollBottomButton activeChatFolderBar activeChatFolderName activeChatFolderStrip activeChatFolderStripRows activeChatShotProvider activeContextConvertProvider activePinIndexByChat\n          addChatsToFolder adminBackupController adminBackupFactory adminBotAuditController adminBotAuditFactory adminModal adminUsersController adminUsersFactory\n          aiBotFormPayload aiBotSettingsModal aiBotSettingsPayload aiBotState aiImageRiskApi aiModelCatalog aiModelRefreshTriggeredByButton ALL_CHATS_FOLDER_ID\n          allUsers analyzeOutgoingGrokImageRisk anchorForChatOpen androidBridge animateBackButton animateChatFolderContentEntry animateChatHeaderActionButton animateSearchResultChatSwitch\n          animateSendButton animationSettingsModal api appBridge appConfig appContext appDom appDomApi\n          appendMessage appendPinEventIfVisible appendSystemEventIfVisible appendTimelineItems applyBackgroundStyleToElement applyBackupRestore applyChatBackground applyChatFolderStripVisibilityInAllChats applyChatUpdate\n          applyCurrentUserUpdateFromPresence applyMediaPlaybackCompletedMeta applyMessageActionsLayout applyMessageUpdate applyMobileFontSize applyModalAnimation applyModalAnimationSpeed applyNewChatModalTab\n          applyOwnReadStateToMessage applyOwnReadStateToMessages applyPinsUpdate applyPollUpdate applyPosterToVideoElement applyScreenRotationPreference applySoundSettings applyUiLanguage\n          applyUiTheme applyUserUpdate applyVisualMode appRuntime attachBtn attachmentHelpers AUDIO_EXTENSIONS AUDIO_MIME_TYPES\n          authService autoResize AVATAR_COLORS avatarHtml avatarMenuTargetFromEl avatarUserMenuState backBtn beginChatFolderStripPreview\n          beginMobileRouteTransition bindAsyncActionButtons bindCallArtifactMessageControls bindCallMessageControls bindCallTranscriptMessageControls bindContextConvertMessageButton bindContextOriginalRestoreButton bindMediaPlaybackState\n          bindPollControls bindPulseInlineVoterControls bindTouchSafeButtonActivation blurFocusedElementWithin BOT_SAVE_BOOLEAN_FIELDS BOT_SAVE_NUMERIC_FIELDS botChatMemberMetaText botMentionText\n          botModelText buildLocalMessageFromOutbox buildMessagesFragment buildMessagesRootChildren buildOptimisticPollState buildPinBrowserNotification buildPollComposerPreviewMessage buildPollOrbitGradient\n          buildPollRenderState buildPulsePreviewVoters buildReplyBotTarget buildTimelineItems buildVerifiedBotSaveStatus cacheCursorPage cacheMessages callArtifactImageContext\n          callArtifactImageFilename callArtifactImageMime callArtifactImageUrl callArtifactKey callArtifactLabel callArtifactProgress callArtifactStatusKind callArtifactStatusLabel\n          callArtifactTextShouldCollapse callRecordingDurationSeconds callRecordingPlaybackUrl callRecordingRoundedRectPath canAnimateChatFolderContent canAnimateChatFolderSwipe canAnimateHorizontalPager canCaptureCurrentChatScrollAnchor\n          cancelPendingMediaBottomScrollIfNeeded cancelPendingSidebarReveal cancelScheduledActiveChatFolderChipCenter cancelScheduledScrollableItemCenter canClosePollMessage canContextConvertMessage canEditMessage canForwardMessage\n          canHideChat canLeaveChat canManageContextTransformSettings canManageDestructiveChat canManageInviteLink canManagePinSettings canRestoreContextOriginalMessage canSaveMessageToNotes canShareMediaFileContext\n          canUnpinPin captureBoundMediaPlaybackState captureScrollAnchor catchUpCurrentChat centerActiveChatFolderChip centerScrollableItem centerToastTimer changePasswordModal\n          CHAT_CONTEXT_LONG_PRESS_MS CHAT_FOLDER_ICON_EMOJI CHAT_FOLDER_SWIPE_COMMIT_MIN_PX CHAT_FOLDER_SWIPE_COMMIT_RATIO CHAT_FOLDER_SWIPE_EDGE_DAMPING CHAT_FOLDER_SWIPE_EDGE_MAX_PX CHAT_FOLDER_SWIPE_START_PX CHAT_LIST_CACHE_SYNC_DEBOUNCE_MS\n          CHAT_LIST_CACHE_VERSION CHAT_LIST_PULL_MAX_OFFSET CHAT_LIST_PULL_REFRESH_OFFSET CHAT_LIST_PULL_THRESHOLD CHAT_LIST_PULL_TRIGGER_PX CHAT_LIST_REQUEST_TIMEOUT_MS chatAllowsUnpinAnyPin chatArea\n          chatAreaResizeObserver chatContextMenu chatContextMenuBackdrop chatFolderContent chatFolderContextMenu chatFolderContextMenuBackdrop chatFolderEmojiMarkup chatFolderIconEmoji\n          chatFolderIconMarkup chatFolderListSurface chatFolderManageModal chatFolderManageSaveBtn chatFolderPicker chatFolderPickerBackdrop chatFoldersBtn chatFolderStore\n          chatFolderStripLabelForSelection chatFolderStripStructureSignature chatFolderSwipePagerState chatFolderSwitchSeq chatHeader chatHeaderActions chatHeaderActionsOpen chatHeaderActionsShell\n          chatHeaderAvatar chatInfoBtn chatInfoModal chatInviteTokenFromPath chatInviteTokenFromUrl chatItemAvatarHtml chatList chatListCacheKey chatListControllers chatListDataController\n          chatListDataFactory chatListPullIcon chatListPullIndicator chatListPullLabel chatListRecoveryController chatListRecoveryFactory chatListRenderer chatListRendererFactory\n          chatListService chatListStatus chatListStore chatListStoreApi chatListStoreFactory chatMembersCache chatPinsByChat chats\n          chatSearch chatSearchClear chatSearchToggle chatSettingsActionBtn chatShotAdminFormPayload chatShotAdminStates chatShotBotsModal chatShotBtn\n          chatShotGeneratingByChat chatShotRouteBase chatShotStateByChat chatShotStateFailuresByChat chatShotStateRequests chatStatus chatTitle chatView\n          checkAuth checkDeepseekAiBalance clamp cleanupDuplicateDateSeparators cleanupEmptyMessageGroups clearActivePulseVoterPopover clearActivePulseVoterPopoverForMessage clearCachedChat\n          clearChatContextLongPress clearChatHistoryForEveryone clearComposerDraft clearContextConvertPickerFollowupClickSuppress clearEdit clearEmojiPickerKeyboardOpenStabilizer clearFloatingMessageActionsStateIfClosed clearLocalChatHistory\n          clearMediaContextLongPress clearMediaPlaybackState clearMessageActionsPlacement clearMobileFontSizeStatusTimer clearMobileSceneElementState clearMobileSceneRepaint clearModalAnimationStatusTimer clearPendingFile\n          clearPendingMediaBottomScroll clearRenderedMessages clearReply clearScheduledScrollAnchorSave clearScreenRotationStatusSoon clearSearchPanelTransitionState clearSearchResults closeAllModals\n          closeChatHeaderActions closeChatViewForChat closeEmojiPicker closeFloatingSurface closeForwardMessageModal closeMediaViewer closeMobileComposerTransientUi closeModal\n          closePollMessage closeSearchPanel closeTopModal collectChatAvatarUrls compactView compactViewMap compareChatActivity compareChatsForFolder\n          compareChatsForList completeOutboxSend composerAiOverrideDocumentFormatEl composerAiOverrideDocumentWrap composerAiOverrideEl composerAiOverrideHint composerAiOverrideLabel composerAiOverrideModeEl\n          composerAiOverrideSeq composerAiOverrideState composerContextConvertBtn composerCustomEmojiClusterBoundary composerEmojiPickerController composerEmojiPickerFactory composerFactories composerFilesController\n          composerFilesFactory composerMentionsController composerMentionsFactory composerReplyEditController composerReplyEditFactory composerRichPreview composerSendController composerSendFactory\n          composerServices composerStateController composerStateFactory composerTextController composerTextFactory composerTypingDragDropController composerTypingDragDropFactory connectWS\n          consumeOutsidePickerDismissGesture contextConvertAdminFormPayload contextConvertAdminStates contextConvertAvailabilityByChat contextConvertAvailabilityRequests contextConvertBotsModal contextConvertComposerPending contextConvertPendingMessageIds\n          contextConvertPickerClickSuppressUntil contextConvertPickerPointerState contextConvertPickerState contextConvertProviderLabel contextConvertRouteBase contextMenusController contextMenusFactory contextOriginalRestorePendingMessageIds\n          copyCurrentChatInviteLink copyImageFromMediaContext copyMessageFromRow copyTextToClipboard coreApiService createAttachmentPosterBlob createChatFolder createChatFolderSwipePage createContextConvertMessageButton\n          createFallbackDomRefs createFolderBtn createHorizontalSwipePager createMessageEl createMessageGroup createMessageOutboxItem createNewChatTabPreview createTimeoutError\n          currentAiBot currentChatId currentChatShotAdminBot currentChatShotAdminState currentContextConvertAdminBot currentContextConvertAdminState currentDeepseekBot currentGrokBot\n          currentGrokImageBot currentGrokTextBotFormFingerprint currentGrokUniversalBot currentMobileFontSize currentModalAnimation currentModalAnimationSpeed currentOpenAiImageBot currentOpenAiUniversalBot\n          currentQwenBot currentUiLanguage currentUiTheme currentUser currentUserInfo currentVisualMode currentYandexBot CUSTOM_EMOJI_BY_CATEGORY\n          CUSTOM_EMOJI_CATALOGS customEmoji debugMessageCache deepseekAiSettingsModal deepseekAiSettingsPayload deepseekAiTextBotsModal deepseekBotFormPayload deepseekBotState\n          deferBackButtonNavigationRelease deleteAiBotKey deleteChatCompletely deleteChatFolder deleteComposerCustomEmojiCluster deleteDeepseekAiKey deleteGrokAiKey deleteMessage\n          deleteQwenAiKey deleteYandexAiKey destroyChatFolderSwipePager disableAiBot disableChatShotAdminBot disableContextConvertAdminBot disableDeepseekBot disableGrokBot\n          disableGrokUniversalBot disableOpenAiImageBot disableOpenAiUniversalBot disablePushOnThisDevice disableQwenBot disableYandexBot dismissEmojiPickerOutsideGesture dismissMentionPickerAfterKeyboardClose\n          dismissMobileComposer DOCUMENT_FORMAT_OPTIONS downloadBackupExport dragOverlay drawVideoPosterBlob emojiBtn emojiPicker emptyState\n          enablePushNotifications endMobileRouteTransition ensureAttachmentPoster ensureAvatarUserMenu ensureBotVisibilityToggles ensureCallRecordingFooterButton ensureCallRecordingProgress ensureContextConvertPicker\n          ensureContextConvertPickerBackdrop ensureDeepseekTextBotsModalContent ensureMentionPicker ensureMentionPickerBackdrop ensurePulseInlineVoters ensureQwenTextBotsModalContent ensureScrollAnchorsLoaded ensureScrollDateIndicator\n          ensureSearchPanelReady esc escapeRegExpText exportAiBotJson exportChatShotAdminBot exportContextConvertAdminBot exportDeepseekBotJson exportGrokBotJson\n          exportGrokUniversalBotJson exportMediaPlaybackCompletedMeta exportOpenAiImageBotJson exportOpenAiUniversalBotJson exportQwenBotJson exportYandexBotJson extractMentionTokensFromText fetchMessageMediaBlob\n          fileExtension fileInput filenameFromContentDisposition fillAiBotForm fillDeepseekBotForm fillGrokBotForm fillGrokImageBotForm fillGrokUniversalBotForm\n          fillOpenAiImageBotForm fillOpenAiUniversalBotForm fillQwenBotForm fillYandexBotForm filterNewMessages filterNewPinEvents filterNewSystemEvents finalizeChatFolderStripPreview findComposerCustomEmojiClusterAfter\n          findComposerCustomEmojiClusterAt findComposerCustomEmojiClusterBefore findMentionTrigger findMessageRowById findOutboxRow findRestorableAnchorRow floatingMessageActionsController floatingMessageActionsFactory\n          flushCurrentChatScrollAnchor flushDeferredRecoverySync flushMobileFontSizeSave flushModalAnimationSave flushSearchPanelPendingAction focusChatSearchInput focusComposerKeepKeyboard focusElementIfPossible\n          focusSearchInput folderActionsController folderActionsFactory folderControllers folderManageModalController folderManageModalFactory folderStoreFactory folderSummaryText\n          folderUiController folderUiFactory forceIosAnimationMount forceMobileViewportLayoutSync forgetDisplayedMessage formatBotAuditSource formatCapabilityState formatChatListTimestamp\n          formatDate formatDeepseekBalanceResult formatDeepseekBalanceValue formatDuration formatPollDeadline formatRelativeDuration formatSearchResultTimestamp formatSize\n          formatters formatTime formatUiErrorMessage formatWeatherValue forwardChatList forwardChatSearch forwardingController forwardingControllerFactory\n          forwardMessageModal forwardMessageStatus forwardMessageToChat galleryNav getAbsoluteMessageMediaUrl getActiveChatFolder getActiveMessageActionsEl getActiveMessageActionsRow\n          getAdjacentChatFolderPage getAiChatSetting getAttachmentDownloadUrl getAttachmentPosterUrl getAttachmentPreviewUrl getBotVisibilityToggle getCallRecordingSeekRows getChatById\n          getChatFolderPageIndex getChatFolderPageRows getChatFolderSwipeCommitDistance getChatFolderSwipeSurfaceWidth getChatFolderSwipeTransformTarget getChatFolderSwitchTargets getChatLastMessageId getChatLastPreviewText\n          getChatMemberLastReads getChatPinOrder getChatPins getChatReadReceiptThreshold getChatSearchHaystack getChatSettingsActionOpener getChatShotAdminChatSetting getComposerAiOverridePayload\n          getComposerCustomEmojiCluster getComposerCustomEmojiClusterEnd getComposerCustomEmojiItemFromMarker getComposerDraftStorageKey getComposerInputTextMetrics getComposerInputWidthForMode getComposerTextValue getContextConvertChatSetting\n          getCurrentChatContextConvertState getCurrentChatShotState getCurrentModalAnimationPreferences getCustomEmoji getCustomEmojiCatalog getCustomEmojiRenderedSize getDeepseekChatSetting getDefaultMessageMediaMime\n          getDirectPrivateAiBotTarget getEditableText getElementTransitionTotalMs getEmojiCategoryItems getEmojiCategoryLabel getEmojiPickerCategories getEmojiPickerInsertionValue getFloatingMessageActionRow\n          getFloatingMessageActionsState getFloatingViewportRect getFolderPinnedChatMoveState getFolderPinnedChatOrder getGrokChatSetting getGrokImageChatSetting getGrokUniversalChatSetting getIosViewportBaselineHeight\n          getIosVisualViewportMetrics getLockedMobileKeyboardViewportMetrics getManualMentionRange getMaxRenderedMessageId getMediaNoteFallbackLabel getMediaPlaybackBucket getMediaPlaybackCompletedBucket getMessageActionsElement\n          getMessageCopyText getMessageCopyTextData getMessageIdNumber getMessageMediaContext getMessageMediaContextTarget getMessageMediaKindLabel getMessagesAfterLoader getMessagesLastContentChild\n          getMicrophoneMode getMobileAppViewportHeight getMobileAppViewportTopInset getMobileComposerSafeReturnFocusEl getMobileFontAdjustPercent getMobileViewportBaselineHeight getMobileVisualViewportMetrics getModalAnimationSpeedFactor\n          getNewChatModalActiveTab getNewChatTabPane getNormalComposerInputWidth getOpenAiImageChatSetting getOpenAiUniversalChatSetting getOutboxObjectUrl getPayloadChatId getPersistedMobileFontSize\n          getPersistedModalAnimationPreferences getPinActionState getPinActorName getPinForMessage getPinnedChatMoveState getPinnedChats getPinPreviewText getPinToastText\n          getPollCompactFooterMeta getProfileSelectedColor getPulseInlineVotersRevision getPulseVoterDisplayName getPulseVoterPopoverElement getQwenChatSetting getReactionPickerKeepKeyboard getReactionPickerMsgId\n          getRecentEmojiCategory getRecentEmojiStorageKey getRenderedChatFolderSelectionId getRenderedMessageIdList getRenderedMessageRows getReplyPreviewText getReplyQuoteText getReplySnapshot\n          getResolvedMobileBaseScene getScreenRotationAllowed getScrollDateTextForRow getSearchPanelTransitionFallbackMs getSelectableFolderChats getSelectedMessageFragment getSelectedNewFolderChatIds getSingleEmojiPattern\n          getSoundSettingsFromForm getStoredAttachmentPosterUrl getStoredAttachmentUrl getTopModal getUniversalBotModes getVisibleComposerToolCount getVisibleMessageAreaRect getYandexChatSetting\n          GROK_TEXT_BOT_DIRTY_STATUS grokAiImageBotsModal grokAiSettingsModal grokAiSettingsPayload grokAiTextBotsModal grokAiUniversalBotsModal grokBotFormPayload grokBotState\n          grokImageBotFormPayload grokImageRiskCancel grokImageRiskConfirm grokImageRiskConfirmModal grokImageRiskConfirmResolver grokImageRiskRetryPending grokImageRiskTerms grokTextBotFormFingerprint\n          grokTextBotFormHydrating grokUniversalBotFormPayload grokUniversalState grokUniversalTargetAllowsImage handleAppResume handleChatContextMenuAction handleChatFolderContextMenuAction handleComposerCustomEmojiBeforeInput\n          handleComposerCustomEmojiKeydown handleDragEnter handleDragLeave handleDragOver handleDrop handleGrokImageRiskModalClosed handleMediaContextMenuAction handleMediaViewerControlActivation\n          handleMentionClick handleMentionPickerKeydown handlePinnedMessageUpdate handleServiceWorkerMessage handleWSMessage hasAndroidNativeBridge hasOpenModal hideActiveMessageActions\n          hideAttachMenu hideAvatarUserMenu hideChatContextMenu hideChatFolderContextMenu hideChatFolderPicker hideChatFromList hideContextConvertPicker hideFloatingMessageActions\n          hideMediaContextMenu hideMentionPicker hideReactionPicker hideReactionUi hideScrollDateIndicator hideTyping HORIZONTAL_PAGER_SWIPE_COMMIT_MIN_PX HORIZONTAL_PAGER_SWIPE_COMMIT_RATIO\n          HORIZONTAL_PAGER_SWIPE_EDGE_DAMPING HORIZONTAL_PAGER_SWIPE_EDGE_MAX_PX HORIZONTAL_PAGER_SWIPE_START_PX horizontalPagerCommitDistance hydrateChatListCache hydrateComposerDraftsForCurrentUser hydratePulseInlineVoters i18n\n          i18nHelpers IMAGE_EXTENSIONS IMAGE_MIME_TYPES imageViewer importAiBotJsonFile importChatShotAdminBot importContextConvertAdminBot importDeepseekBotJsonFile\n          importGrokBotJsonFile importGrokUniversalBotJsonFile importOpenAiImageBotJsonFile importOpenAiUniversalBotJsonFile importQwenBotJsonFile importYandexBotJsonFile inAppChatBackSkipNextPopstate initEmojiPicker\n          initials initNewChatTabSwipePager inputArea inputRow insertAtMessagesEnd insertComposerTextAtSelection insertDictatedText insertMentionTarget\n          insertMentionTokenIntoComposer insertRawMentionTriggerAtCursor installCallRecordingProgressCapture interactionFactories interactionServices interactionState invalidateChatShotState invalidateContextConvertAvailability\n          invalidatePulseInlineVotersForMessage iosBackNavigationToken isAbortError isAiBotDirectoryUser isAllChatsFolderActive isChatFolderStripVisibleInAllChatsEnabled isChatIncomingSoundEnabled isChatListWaitingForActiveFolder\n          isChatNotificationEnabled isChatPinned isChatPinnedInFolder isChatSearchOpen isClientSideMessage isComposerMeaningfullyEmpty isContextTransformAvailableForChat isCurrentChatActivelyVisible\n          isCurrentChatOpenTransition isCurrentMessageRow isCurrentNotesChat isCustomEmojiCategory isCustomEmojiToken isDeletedMessageRow isFloatingSurfaceVisible isFollowupClickSuppressPassThroughTarget\n          isGeneralChat isGrokImageBotTarget isGrokUniversalBotTarget isGroupLikeCurrentChat isGroupOrPrivateChat isInviteCapableGroupChat isIosChatKeyboardLayoutActive isIosKeyboardOpen isIosMobileViewportTarget\n          isIosViewportFixTarget isIosWebkitMotionAllowed isLocalhost isMediaPlaybackCompleted isMediaPlaybackNearEnd isMentionSoundEnabled isMessageDisplayed isMessageMentioningCurrentUser\n          isMobileBaseSceneHardHidden isMobileChatHistoryState isMobileChatKeyboardLayoutActive isMobileComposerKeyboardOpen isMobileComposerSessionActive isMobileKeyboardOpen isMobileLayoutViewport isMobileViewportLayoutLocked\n          isMobileViewportTarget isNearBottom isNotesChat isPickerDismissPassThroughTarget isPinEventDisplayed isSystemEventDisplayed isPinNotificationEnabled isPinSoundEnabled isPointerNearCallRecordingProgressRect\n          isPollMessage isPulsePoll isPulseVoterOptionExpanded isPushSupported isResolvedMobileChatScene isSearchPanelOpen isSelectableMessageTextTarget isSingleCustomEmojiMessage\n          isSingleEmojiMessage isTouchLikePointerEvent isUiTransitionBusy isUniversalBotTarget isValidRecentEmojiValue isVideoAttachmentMessage ivStrip joinChatInviteToken jumpToPinnedMessage\n          jumpToSavedOriginal jumpToSearchResult languageDisplayName languageSettingsModal latestCallArtifactBatch latestCallTranscriptRun layoutRetryButtons leaveChat\n          linkify loadAiBotState loadAiModelOptions loadAllUsers loadChatFolders loadChatPins loadChatPreferences loadChats\n          loadChatShotAdminState loadChatShotState loadContextConvertAdminState loadContextConvertAvailability loadCurrentWeather loadDeepseekAiState loadGrokAiState loadGrokUniversalState\n          loadHiddenChatSearch loadLocalRecentEmojis loadMentionTargets loadMore loadMoreAfter loadMoreAfterWrap loadMoreBtn loadMoreWrap\n          loadNotificationSettings loadOpenAiImageState loadOpenAiUniversalState loadQwenAiState loadRecentEmojis loadSoundSettings loadWeatherSettings loadYandexAiState\n          localAttachmentFromFile localChatPreferenceEnabled logout makeClientId markAttachmentPosterAvailable markChatReadThrough markCurrentChatReadIfAtBottom markMessageDeleted\n          markPendingMediaBottomScroll markPendingMediaBottomScrollForMessages MAX_ATTACHMENTS MAX_FILE_SIZE MAX_FILE_SIZE_LABEL MAX_MSG maxMessageId maybeLoadMoreAtBottom\n          maybeLoadMoreAtTop measureFloatingSurface measureMessageActions measureMsgInputScrollHeight MEDIA_CONTEXT_LONG_PRESS_MS MEDIA_CONTEXT_TARGET_SELECTOR mediaContextMenu mediaContextMenuBackdrop\n          mediaPlaybackController mediaPlaybackFactory mediaViewerController mediaViewerFactory MENTION_PICKER_TAP_DEAD_ZONE mentionKey mentionOpenBtn menuDrawer\n          mergeAiBotState mergeChatShotAdminState mergeContextConvertAdminState mergeDeepseekAiState mergeGrokAiState mergeGrokUniversalState mergeOpenAiImageState mergeOpenAiUniversalState\n          mergeQwenAiState mergeRecentEmojiLists mergeYandexAiState MESSAGE_BACKGROUND_SYNC_CONCURRENCY MESSAGE_BACKGROUND_SYNC_MAX_CHATS MESSAGE_BACKGROUND_SYNC_MAX_PAGES MESSAGE_CACHE_LIMIT messageAttachmentFactory\n          messageAttachmentRenderer messageCallCardFactory messageCallCardRenderer messageHasDeferredMediaLayout messageIdKey messageOutbox messageOutboxFactory messagePollFactory\n          messagePollRenderer messageRenderer messageRendererFactory messagesEl messageServiceCall messageServiceDelegates messageServices messagesService\n          messageStateController messageStateFactory messageUpdates messageUpdatesFactory MICROPHONE_MODE_STORAGE_KEY MICROPHONE_MODE_VALUES microphoneMode minMessageId\n          MOBILE_FONT_SIZE_DEFAULT MOBILE_FONT_SIZE_MAX MOBILE_FONT_SIZE_MIN MOBILE_FONT_SIZE_PERCENTS mobileBaseScene mobileComposerGuard mobileFontSettingsModal mobileRouteTransitionActive\n          mobileRouteTransitionTimer mobileSceneRepaintCleanupFrame mobileSceneRepaintFrame mobileSceneRepaintTarget mobileViewportElementResizeObserver mobileViewportHeightSyncBound mobileViewportPrevHeight mobileViewportRecoveryFrame\n          mobileViewportRecoveryTimer mobileViewportShell mobileVisualViewportBaselineHeight mobileVisualViewportBaselineWidth MODAL_ANIMATION_SPEED_DEFAULT MODAL_ANIMATION_SPEED_FACTORS MODAL_ANIMATION_STYLE_IDS MODAL_ANIMATION_STYLES\n          MODAL_TRANSITION_BUFFER_MS modalAnimationMeta modalAnimationPreferencesEqual modalEntryOf modalManager modalManagerFactory mountGrokBotPanels mountPulseVoterPopover\n          moveChatFolder moveChatSidebarPin moveFocusOutOfChatHeaderActions moveFolderChatPin msgInput navigateBackToChatList NEW_CHAT_MODAL_TABS newChatModal\n          newChatTabSwipePager newFolderChatList newFolderChatSearchInput newFolderNameInput newFolderTabController newFolderTabFactory nextPollVoteSelection normalizeBotSaveComparisonValue\n          normalizeCachedChats normalizeCallMessageData normalizeCallMixedRecording normalizeChatFolderId normalizeChatListEntry normalizeChatShotState normalizeComposerDraftChatId normalizeComposerInputValue\n          normalizeComposerTextToInternal normalizeContextConvertAvailability normalizeMediaPlaybackCompletedEntries normalizeMemberLastReads normalizeMentionTarget normalizeMicrophoneMode normalizeMimeType normalizeMobileBaseScene\n          normalizeMobileChatListHistoryState normalizeMobileFontSize normalizeModalAnimationSpeed normalizeModalAnimationStyle normalizeNewChatModalTab normalizePin normalizePinEvent normalizePinEvents\n          normalizePins normalizePoll normalizePollStyle normalizeRecentEmojiList normalizeChatInviteToken normalizeRecentEmojiValue normalizeUiLanguage normalizeUiTheme normalizeVisualMode\n          noteMessageScrollUserIntent NOTES_CHAT_EMOJI notificationPermissionLabel notificationSettingsController notificationSettingsFactory notificationSettingsModal notifyAndroidMobileFontSize notifyAndroidScreenRotationPreference\n          onlineUsers openAdminBotAuditModal openAdminModal OPENAI_IMAGE_BACKGROUND_OPTIONS OPENAI_IMAGE_OUTPUT_OPTIONS OPENAI_IMAGE_QUALITY_OPTIONS OPENAI_IMAGE_SIZE_OPTIONS openAiBotSettingsModal\n          openAiImageBotFormPayload openAiImageBotsModal openAiImageState openAiTextBotsModal openAiUniversalBotFormPayload openAiUniversalBotsModal openAiUniversalState openAnimationSettingsModal\n          openAvatarUserMenu openBackupExportModal openCallArtifactsModal openChangePasswordModal openChat openChatController openChatControllerFactory openChatControllers\n          openChatFolderManageModal openChatFromPush openChatInfoModal openChatPagesController openChatPagesFactory openChatService openChatShotBotsModal openComposerContextConvertPicker\n          openContextConvertBotsModal openDeepseekAiSettingsModal openDeepseekTextBotsModal openEmojiPicker openFloatingSurface openForwardMessageModal openGrokAiSettingsModal openGrokImageBotsModal\n          openGrokImageRiskConfirm openGrokTextBotsModal openGrokUniversalBotsModal openHiddenChatFromSearch openImageViewer openLanguageSettingsModal openLastChatOnReload openMediaViewer\n          openMentionPickerFromButton openMenuDrawer openMessageContextConvertPicker openMobileFontSettingsModal openModal openNewChatModal openNotificationSettingsModal openOpenAiImageBotsModal\n          openOpenAiTextBotsModal openOpenAiUniversalBotsModal openPollComposer openPollStyleSettingsModal openPollVotersModal openPrivateChatFromDirectory openPrivateChatWithUser openQwenAiSettingsModal\n          openQwenTextBotsModal openSearchPanel openSettingsModal openSoundSettingsModal openThemeSettingsModal openVisualModeSettingsModal openWeatherSettingsModal openYandexAiSettingsModal\n          outboxUrlKey PAGE_SIZE PAGINATION_BOTTOM_THRESHOLD PAGINATION_FETCH_MAX_PAGES PAGINATION_TOP_THRESHOLD parseCallRecordingRadiusValue parseTransitionTimeMs patchAiBotUserForPresence\n          patchChatMembersCacheForPresence patchMentionTargetsForPresence pauseCurrentChatMediaPlayback pendingFileEl pendingMobileChatListHistoryNormalization performSearch persistAiBotSettings persistChatListCache\n          persistComposerDrafts persistCurrentUser persistDeepseekAiSettings persistGrokAiSettings persistLocalRecentEmojis persistOutboxItem persistQwenAiSettings persistScrollAnchors\n          persistYandexAiSettings pickScrollAnchorRow pickScrollDateMessageRow pinEventIdKey systemEventIdKey pinMessage pinnedBar playAppSound playChatFolderSwitchPhase\n          pointToCallRecordingHit POLL_CLOSE_PRESET_MS POLL_MAX_OPTIONS POLL_MIN_OPTIONS POLL_STYLE_IDS POLL_STYLES pollAccentVar pollBtn\n          pollComposerController pollComposerFactory pollComposerModal pollComposerPreview pollComposerStatus pollComposerStyle pollOptionsList pollQuestionInput\n          pollStyleMeta pollStyleSettingsModal pollVotersList pollVotersMeta pollVotersModal pollVotersStatus pollVotersTitle portalMessageActions\n          positionAvatarUserMenu positionChatContextMenu positionChatFolderContextMenu positionChatFolderPicker positionContextConvertPicker positionEmojiPicker positionFloatingElement positionMediaContextMenu\n          positionMentionPicker positionMessageActionSurfaces positionReactionEmojiPopover positionScrollDateIndicator prefersReducedMotion prepareChatFolderSwipePager prepareNewChatTabContent presenceController\n          presenceControllerFactory preserveMobileComposerOnPointerDown preventMobileComposerBlur previewAllSounds previewBackupRestore previewSound primeAppendedMessageSideEffects primeMediaPlaybackCompletedCache\n          promoteOutboxRow providerAccent providerInteractiveEnabled providerInteractiveSummary pulseInlineVotersCacheKey pushCallMessageMeta queueIosViewportLayoutSync queueMobileViewportLayoutSync\n          queueOutboxItem queueSearchPanelPendingAction queueVideoNoteOutbox queueVoiceOutbox qwenAiSettingsModal qwenAiSettingsPayload qwenAiTextBotsModal qwenBotFormPayload\n          qwenBotState reactionController reactionControllerFactory reactionEmojiPopover reactionEmojiSwipePager reactionPicker readCachedChatRange readCachedCursorPage\n          readChatListCache readMediaPlaybackState readPollComposerForm readReceiptController readReceiptFactory reconcileChatReadState RECOVERY_CATCHUP_MAX_PAGES RECOVERY_SYNC_MIN_INTERVAL_MS\n          refreshAdminUserStatuses refreshCallRecordingProgressShape refreshChatFolderContextMenu refreshChatInfoPresentation refreshChatInfoStatus refreshChatListReferences refreshChatMemberStatuses refreshDateSeparators\n          refreshDeepseekAiModels refreshGrokAiModels refreshGrokTextBotDirtyState refreshLocalizedUi refreshMentionPickerForUserUpdate refreshPollComposerActionState refreshPollComposerPreview refreshPulseInlineVoterSlots\n          refreshPushDeviceState refreshQwenAiModels refreshRenderedAiBotAvatar refreshRenderedUserMessages refreshScrollDateIndicator refreshVisiblePinButtons refreshVoiceComposerState refreshWebSocketAfterResume\n          refreshYandexAiModels registerBuiltinModals registerModal rememberActiveElement rememberDisplayedMessage rememberPinEvent rememberSystemEvent rememberRecentEmoji removeAiBotAvatar\n          removeChatFromFolder removeChatLocally removeDeepseekBotAvatar removeDuplicatePromotedRows removeGrokBotAvatar removeGrokUniversalBotAvatar removeOpenAiImageBotAvatar removeOpenAiUniversalBotAvatar\n          removeOutboxRows removeProfileAvatar removeQwenBotAvatar removeYandexBotAvatar renameChatFolder renderActiveChatFolderBar renderAdminUserRow renderAiBotAvatar\n          renderAiBotList renderAiBotSettings renderAiChatBotSettings renderAiModelOptions renderBackupRestorePreview renderCallArtifactBatchCard renderCallArtifactImage renderCallArtifactRun\n          renderCallArtifactStatus renderCallArtifactText renderCallArtifactTextLine renderCallMessageCard renderCallMessageMeta renderCallTranscriptRunCard renderChatContextMenu renderChatContextTransformForm\n          renderChatDangerControls renderChatFolderContextMenu renderChatFolderManageModal renderChatFolderPicker renderChatFolderStripStructure renderChatLastPreviewHtml renderChatList renderChatListInto\n          renderChatInviteLinkForm renderChatMemberItem renderChatPinSettingsForm renderChatPreferencesForm renderChatShotAdminChatSettings renderChatShotAdminForm renderChatShotAdminSettings renderChatShotBotList renderChatShotForm\n          renderComposerAiOverride renderComposerRichPreviewContent renderContextConvertAdminSettings renderContextConvertBotList renderContextConvertChatSettings renderContextConvertForm renderContextConvertPicker renderCurrentChatHeader\n          renderCustomEmojiHtml renderCustomEmojiPreviewHtml renderDeepseekAiSettings renderDeepseekBotAvatar renderDeepseekBotList renderDeepseekChatBotSettings renderDeepseekModelOptions renderedMessageIdsMatch\n          renderEmojiGridItemHtml renderEmojiGridItemsHtml renderEmojiPickerGrid renderFileAttachment renderFolderSelectableChatItem renderForwardChatList renderGrokAiSettings renderGrokBotAvatar\n          renderGrokBotList renderGrokBotModelOptions renderGrokChatBotSettings renderGrokGlobalImageModelOptions renderGrokGlobalTextModelOptions renderGrokImageBotAvatar renderGrokImageBotList renderGrokImageBotModelOptions\n          renderGrokImageBotsSettings renderGrokImageChatBotSettings renderGrokImageRiskTerms renderGrokTextBotsSettings renderGrokUniversalBotAvatar renderGrokUniversalBotList renderGrokUniversalBotModelOptions renderGrokUniversalBotsSettings\n          renderGrokUniversalChatBotSettings renderLanguagePicker renderLinkPreview renderMediaContextMenu renderMentionPicker renderMessages renderMessageText renderMobileFontSizeControl\n          renderModalAnimationOptions renderModalAnimationSpeedControl renderNamedGrokAvatar renderNewFolderChatList renderNotificationSettingsForm renderOpenAiImageBotAvatar renderOpenAiImageBotList renderOpenAiImageChatBotSettings\n          renderOpenAiImageModelOptions renderOpenAiImageSettings renderOpenAiProviderSettings renderOpenAiTextBotsSettings renderOpenAiUniversalBotAvatar renderOpenAiUniversalBotList renderOpenAiUniversalChatBotSettings renderOpenAiUniversalModelOptions\n          renderOpenAiUniversalSettings renderOrbitPollCard renderOutboxForChat renderOutboxItem renderPendingFiles renderPinActionButton renderPinnedBar renderPinSystemEvent renderChatSystemEvent\n          renderPollCard renderPollCloseButton renderPollCompactFooter renderPollComposerOptionInputs renderPollStyleCardPreview renderPollStylePicker renderPollVotersButton renderProfileAvatarPreview\n          renderProfileColorPicker renderProfileEditor renderPulseInlineVoterAvatar renderPulseInlineVoterStack renderPulseInlineVoterSummary renderPulseInlineVoterSummaryContent renderPulsePollCard renderQuickReactionButtonsHtml\n          renderQwenAiSettings renderQwenBotAvatar renderQwenBotList renderQwenChatBotSettings renderQwenModelOptions renderReactionPickerContent renderReactions renderResolvedFileAttachment\n          renderSearchResultsEmpty renderSearchScopeToggle renderSelectableUserItem renderSoundSettingsForm renderStackPollCard renderThemePicker renderTypingBar renderVisualModePicker\n          renderWeatherSearchResults renderWeatherSettingsForm renderWeatherWidget renderYandexAiSettings renderYandexBotAvatar renderYandexBotList renderYandexChatBotSettings renderYandexModelOptions\n          replaceRenderedMessage replaceRenderedMessages replaceRenderedPollCard replyBar replyBarName replyBarText requireCoreExport requireCoreFunction\n          resetBackButtonNavigationState resetBackupRestoreState resetChangePasswordFields resetChatFolderManageModal resetChatFolderSwipeSurface resetChatFolderSwitchAnimations resetChatPreviewAfterHistoryClear resetForwardMessageModal\n          resetManagedModalScroll resetMobileKeyboardDock resetNewFolderForm resetPollComposer resetPollVotersModal resetReusableMessageRow resolveActionButtons resolveAttachmentUrl\n          resolveCallMessageMediaKind resolveCallMessageRoomMode resolveComposerUniversalBotTarget resolveMediaPlaybackChatId resolveMediaPlaybackKey resolveMessageActionLayout resolveNearestCallRecordingHit resolveTriggeredGrokImageBot\n          resolveUiTarget restoreComposerDraft restoreComposerFocusAfterMentionPicker restoreContextOriginalMessage restoreMessageActions restoreMobileKeyboardDocumentScroll restoreScrollAnchor RESUME_WS_REFRESH_AFTER_MS\n          retryGrokImageRiskPrompt retrySend revealActiveMobileChatRoute revealChatHydration revealChatListAfterActiveChatClose revealSidebarFromChat revokeOutboxObjectUrls runChatShotGeneration\n          runMessageBackgroundSync runRecoverySync runtimeState refreshCurrentChatInviteLink safeVibrate saveAiBot saveAiBotSettings saveAiChatBotSettings saveChatContextTransformSetting\n          saveChatFolderManageChanges saveChatFolderStripVisibilityInAllChats saveChatPinSettings saveChatPreferences saveChatShotAdminBot saveChatShotAdminChatSetting saveChatShotChatSetting saveComposerDraft\n          saveContextConvertAdminBot saveContextConvertAdminChatSetting saveCurrentScrollAnchor saveDeepseekAiSettings saveDeepseekBot saveDeepseekChatBotSettings saveEditedMessage saveGrokAiSettings\n          saveGrokBot saveGrokChatBotSettings saveGrokImageBot saveGrokImageChatBotSettings saveGrokUniversalBot saveGrokUniversalChatBotSettings saveMessageToNotes saveNotificationSettings\n          saveOpenAiImageBot saveOpenAiImageChatBotSettings saveOpenAiUniversalBot saveOpenAiUniversalChatBotSettings saveProfileChanges saveQwenAiSettings saveQwenBot saveQwenChatBotSettings\n          saveSoundSettings saveWeatherSettings saveYandexAiSettings saveYandexBot saveYandexChatBotSettings scheduleActiveChatFolderChipCenter scheduleActiveMobileSceneRepaint scheduleChatListCacheSync\n          scheduleHiddenChatSearch scheduleMediaBottomScrollAnchorSave scheduleMessageBackgroundSync scheduleMobileFontSizeSave scheduleMobileFontSizeStatusClear scheduleMobileViewportRecovery scheduleModalAnimationSave scheduleModalAnimationStatusClear\n          schedulePulseVoterPopoverAutoHide scheduleRecoverySync scheduleRetryLayout scheduleScrollableItemCenter scheduleScrollAnchorSave scheduleScrollDateIndicatorUpdate scheduleSoundSettingsSave scheduleWeatherRefresh\n          SCREEN_ROTATION_ALLOWED_STORAGE_KEY screenRotationAllowed SCROLL_DATE_HIDE_DELAY_MS scrollAnchorStorageKey scrollBottomBtn scrollBottomFollowupClickSuppressUntil scrollController scrollControllerFactory\n          scrollRestoreMode scrollToBottom scrollToMessage searchAllChatsToggle searchBtn searchController searchControllerFactory searchInput\n          searchPanel searchPanelSheet searchResults searchWeatherLocations seekCallRecordingProgress seekVideoFrame selectedAiBotId selectedChatShotBotIds\n          selectedContextConvertBotIds selectedDeepseekBotId selectedGrokBotId selectedGrokImageBotId selectedGrokUniversalBotId selectedOpenAiImageBotId selectedOpenAiUniversalBotId selectedQwenBotId\n          selectedYandexBotId selectModalAnimation selectPollStyle selectUiLanguage selectUiTheme selectVisualMode sendBtn sendByEnter\n          sendComposerWsPayload sendMessage sendOutboxMessageItem sendOutboxVideoNoteItem sendOutboxVoiceItem sendTyping serializeComposerTextValue setActionButtonsPending\n          setActiveChatFolder setAiBotChatStatus setAiBotModalStatus setAiBotSettingsStatus setAiBotStatus setAiBotTextModalStatus setAiModelSelectOptions setAiModelStatus\n          setAvatarElementVisual setBackupExportStatus setBackupRestoreStatus setBotVisibilityToggle setChatContextTransformStatus setChatDangerStatus setChatFolderManageStatus setChatInviteLinkStatus setChatFolderOrder\n          setChatFolderSwipeOffset setChatHeaderActionsOpen setChatHydrating setChatListStatus setChatPinSettingsStatus setChatPreferencesStatus setChatSearchOpen setChatShotAdminChatStatus\n          setChatShotBotStatus setChatShotChatStatus setChatShotModalStatus setChatSidebarPin setComposerContextConvertButtonVisible setComposerTextValue setContextConvertBotStatus setContextConvertChatStatus\n          setContextConvertInlineStatus setContextConvertModalStatus setCurrentUserFromSettings setDeepseekAiBalanceStatus setDeepseekAiModelStatus setDeepseekAiProviderStatus setDeepseekAiStatus setDeepseekBotStatus\n          setDeepseekChatStatus setEditFromRow setEmojiPickerCategory setFolderChatPin setForwardMessageStatus setGrokAiModelStatus setGrokAiProviderStatus setGrokAiStatus\n          setGrokBotStatus setGrokImageChatStatus setGrokImageEditorStatus setGrokImageStatus setGrokStatus setGrokTextChatStatus setGrokTextEditorStatus setGrokTextStatus\n          setGrokUniversalChatStatus setGrokUniversalEditorStatus setGrokUniversalStatus setHasMoreAfter setHasMoreBefore setInlineStatus setLanguageStatus setLoadMoreAfterLoading\n          setMediaPlaybackCompleted setMicrophoneMode setMobileFontAdjustPercent setMobileFontSizeStatus setMobileSceneElementState setModalAnimationStatus setNewChatModalTab setNotificationStatus\n          setOpenAiImageChatStatus setOpenAiImageModalStatus setOpenAiImageStatus setOpenAiStatus setOpenAiUniversalChatStatus setOpenAiUniversalModalStatus setOpenAiUniversalStatus setOutboxSending\n          setPendingChatFolderChipCenterBehavior setPollComposerStatus setPollStyleStatus setPollStyleSurface setProfileAvatarUploadPending setProfileStatus setQwenAiModelStatus setQwenAiProviderStatus\n          setQwenAiStatus setQwenBotStatus setQwenChatStatus setReply setReplyFromRow setScreenRotationAllowed setScreenRotationStatus setSoundStatus\n          setStaticSelectOptions setThemeStatus settingsControllers settingsModal settingsModalController settingsModalFactory settleChatFolderSwipeOffset settleDeferredMediaBottomScroll\n          setupChatAreaMetricsSync setupLifecycleRecovery setupMessageSwipeGestures setupMobileComposerGestureGuard setupMobileMessageInteractionGuard setupMobileViewportHeightSync setupPasswordPreviewToggles setupProfileEvents\n          setVisualModeStatus setWeatherStatus setYandexAiModelStatus setYandexAiProviderStatus setYandexAiStatus setYandexBotStatus setYandexChatStatus shareMediaFromContext\n          shouldAutoFocusSearchInput shouldBackgroundSyncMessages shouldBypassLockedMobileViewportSync shouldIgnoreCallRecordingPointer shouldKeepComposerForMobileMessageInteraction shouldKeepEmojiPickerKeyboard shouldPreserveKeyboardForScrollBottomGesture shouldShowActiveChatFolderBar\n          shouldShowChatFolderBarForSelection showCenterToast showChatContextMenuForRow showChatFolderContextMenu showChatFolderPicker showMediaContextMenuForContext showMediaContextMenuForRow showMessageActions\n          showReactionPicker showTyping sidebar sidebarSearch singleEmojiPattern snapChatFolderSwipeBack snapComposerSelectionToCustomEmojiBoundary sortChatsInPlace\n          soundSettingsController soundSettingsFactory soundSettingsModal splitGraphemes stabilizeEmojiPickerKeyboardOnOpen storeChatMemberLastReads stripCloneIds stripTriggeredBotMention\n          suppressAvatarUserMenuFollowupClick suppressContextConvertPickerFollowupClick suppressMediaViewerFollowupClick suppressMentionPickerFollowupClick suppressNextChatItemTap suppressNextChatItemTapUntil suppressNextMessageActionTap suppressScrollBottomFollowupClick\n          suppressSearchPanelFollowupClick syncActiveChatFolderStripState syncBackupRestoreFileName syncCallRecordingPlayButton syncChatAreaMetrics syncChatAreaMetricsFromViewport syncChatFolderPickerAllChatsToggleState syncChatHeaderActionsAccessibility\n          syncChatInfoStatusVisibility syncChatMessagesInBackground syncChatShotButton syncClonedFormControls syncComposerRichPreview syncContextConvertComposerButton syncContextConvertPendingMessageState syncContextOriginalRestorePendingMessageState\n          syncCoreStateFromRuntime syncCoreStateToRuntime syncCurrentChatContextConvertUi syncEmojiPickerButton syncGrokBotUser syncGrokTextBotFormFingerprint syncIosViewportLayoutState syncLanguageSettingsButton\n          syncMentionOpenButton syncMobileAppHeightToViewport syncMobileBaseSceneState syncMobileFontSettingsButton syncMobileFontSizeViewportState syncMobileViewportLayoutState syncModalAnimationSettingsButton syncOpenAiImageBotUser\n          syncOpenAiUniversalBotUser syncPollComposerStyleUi syncProfileColorSelection syncRecentEmojiToServer syncScreenRotationToggle syncSharedGrokSettings syncSharedOpenAiSettings syncVisibleContextConvertMessageButtons\n          t testAiBot testChatShotAdminBot testContextConvertAdminBot testDeepseekAiConnection testDeepseekBot testGrokAiConnection testGrokBot\n          testGrokUniversalBot testOpenAiImageBot testOpenAiUniversalBot testPushNotification testQwenAiConnection testQwenBot testYandexAiConnection testYandexBot\n          themeSettingsModal timelineTimestamp toggleChatHeaderActions toggleEmojiPicker togglePinFromRow togglePollVote togglePulseVoterOptionExpanded togglePulseVoterPopover\n          toggleReaction token totalUnreadForFolder transformComposerTextWithContextConvertBot transformMessageWithContextConvertBot transitionToChatFolder transitionToChatFolderBySwipe trySendOutboxItem\n          tx typingBar UI_THEME_IDS UI_THEMES UI_VISUAL_MODE_IDS UI_VISUAL_MODES uiSettings uiSettingsFactory\n          uniqueAiModelValues unpinPin updateCallRecordingProgress updateChatContextPreference updateChatListLastMessage updateChatStatus updateComposerAiOverrideState updateCurrentUserFooter\n          updateFloatingMessageActionsState updateGalleryArrows updateHasMoreAfterFromChat updateLocalChatReadProgress updateMentionPicker updateMobileFontSize updateModalAnimationSpeed updateOnlineDisplay\n          updateReactionBar updateRowStatus updateScrollBottomButton updateScrollDateIndicator updateSearchTriggerState updateVisibleOwnReadStateRows updateVisibleReplyQuotesFromMessage uploadAiBotAvatar\n          uploadDeepseekBotAvatar uploadFiles uploadGrokBotAvatar uploadGrokUniversalBotAvatar uploadOpenAiImageBotAvatar uploadOpenAiUniversalBotAvatar uploadOutboxAttachment uploadProfileAvatar\n          uploadQwenBotAvatar uploadYandexBotAvatar userSecondaryLineText verifyBotSaveResponse VIDEO_EXTENSIONS VIDEO_MIME_TYPES VIDEO_POSTER_CAPTURE_SEEKS VIDEO_POSTER_CAPTURE_TIMEOUT_MS\n          VIDEO_POSTER_MAX_DIMENSION VIDEO_POSTER_MIME VIDEO_POSTER_QUALITY visibleChatCountForFolder visualModeMeta visualModeSettingsModal visualModeStateLabel waitForAnimationFrames\n          waitForMediaEvent waitForMs waitForVideoFrame warmChatListAvatarAssets warmMessageWindowAssets weatherIcon weatherLocationLabel weatherSettingsController\n          weatherSettingsFactory weatherSettingsModal weatherWidget websocketService wireAiBotToggleLabels withActionButtons withStableOutboxMedia writeCachedChatMeta\n          writeMediaPlaybackState ws WS_URL wsReconnectTimer wsRetry yandexAiSettingsModal yandexAiSettingsPayload yandexBotFormPayload\n          yandexBotState".trim().split(/\s+/).filter(Boolean);
        names.forEach((__bananzaScopeName) => {
          if (Object.prototype.hasOwnProperty.call(scope, __bananzaScopeName)) return;
          Object.defineProperty(scope, __bananzaScopeName, {
            configurable: true,
            enumerable: false,
            get() { return eval(__bananzaScopeName); },
            set(__bananzaScopeValue) { eval(__bananzaScopeName + ' = __bananzaScopeValue'); },
          });
        });

        return new Proxy(scope, {
          has() { return true; },
          get(target, key) {
            if (key === Symbol.unscopables) return undefined;
            if (Object.prototype.hasOwnProperty.call(target, key)) return target[key];
            if (typeof key === 'string' && key in window) return window[key];
            return undefined;
          },
          set(target, key, value) {
            target[key] = value;
            return true;
          },
        });
      }

      let shellEventController = null;
      let aiAdminEventController = null;
      const setupEvents = () => {
        if (!shellEventController) {
          shellEventController = window.BananzaApp?.shell?.createEventController?.({
            scope: createRuntimeEventScope(),
          }) || null;
        }
        if (!aiAdminEventController) {
          aiAdminEventController = window.BananzaApp?.aiAdmin?.createEventController?.({
            scope: createRuntimeProxyScope(),
          }) || null;
        }
        const shellBound = shellEventController?.bindAll?.();
        aiAdminEventController?.bindEvents?.();
        return shellBound;
      };

    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550


      return {
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
      };
    }
  }

  shellRoot.shellRuntimeAdapter = { createShellRuntimeAdapter };
})();
