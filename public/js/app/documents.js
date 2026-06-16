(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const documentsRoot = root.documents = root.documents || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createDocumentRuntime(options = {}) {
    const opts = objectOrDefault(options);
    const win = opts.window || window;
    const doc = opts.document || document;
    const dom = objectOrDefault(opts.dom);
    const api = typeof opts.api === 'function' ? opts.api : async () => ({});
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const t = typeof opts.t === 'function' ? opts.t : (key) => String(key || '');

    let activeChatId = null;
    let editor = null;
    let openSeq = 0;
    let lastStatus = 'offline';
    let lastAwarenessCount = 0;
    let selectionSnapshot = null;
    let contextConvertPending = false;
    let contextConvertButton = null;

    function isDocumentChat(chat) {
      return Number(chat && chat.is_document || 0) === 1;
    }

    function getToken() {
      return state.getToken?.() || '';
    }

    function getCurrentUser() {
      return state.getCurrentUser?.() || null;
    }

    function getCurrentChat() {
      return state.getCurrentChat?.() || null;
    }

    function getEl(name, fallbackId) {
      return dom[name] || doc.getElementById(fallbackId || name) || null;
    }

    function setHidden(el, hidden) {
      el?.classList?.toggle('hidden', Boolean(hidden));
      if (el && typeof el.setAttribute === 'function') {
        el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
      }
    }

    function setStatus(text, kind = '') {
      const statusEl = getEl('documentConnectionStatus', 'documentConnectionStatus');
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.dataset.status = kind;
    }

    function setInviteStatus(text = '') {
      const statusEl = getEl('documentInviteStatus', 'documentInviteStatus');
      if (statusEl) statusEl.textContent = text;
    }

    function ensureDocumentContextConvertButton() {
      if (contextConvertButton && doc.body.contains(contextConvertButton)) return contextConvertButton;
      const workspace = getEl('documentWorkspace', 'documentWorkspace');
      if (!workspace) return null;
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'document-context-convert-btn hidden';
      button.title = t('Transform selected text');
      button.setAttribute('aria-label', t('Transform selected text'));
      button.textContent = '🍌';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openDocumentContextPicker().catch((error) => {
          actions.showToast?.(error?.message || t('Could not transform selected text'));
        });
      });
      workspace.appendChild(button);
      contextConvertButton = button;
      return button;
    }

    function getContextAvailability(chatId = activeChatId) {
      return actions.getContextConvertAvailability?.(chatId) || null;
    }

    function canShowDocumentContextConvert() {
      const chat = getCurrentChat();
      const currentUser = getCurrentUser();
      const chatId = Number(activeChatId || state.getCurrentChatId?.() || 0);
      const availability = getContextAvailability(chatId);
      return Boolean(
        chatId
        && currentUser?.id
        && isDocumentChat(chat)
        && chat?.context_transform_enabled
        && selectionSnapshot?.text?.trim()
        && (contextConvertPending || (availability?.enabled && Array.isArray(availability?.bots) && availability.bots.length))
      );
    }

    function syncDocumentContextConvertUi() {
      const button = ensureDocumentContextConvertButton();
      if (!button) return;
      const shouldShow = canShowDocumentContextConvert();
      setHidden(button, !shouldShow);
      button.classList.toggle('is-pending', contextConvertPending);
      button.disabled = contextConvertPending || !shouldShow;
      if (shouldShow && !contextConvertPending && !getContextAvailability(activeChatId)) {
        actions.loadContextConvertAvailability?.(activeChatId)
          .then(() => syncDocumentContextConvertUi())
          .catch(() => {});
      }
    }

    function setDocumentSelectionSnapshot(snapshot) {
      selectionSnapshot = snapshot && snapshot.text?.trim() ? { ...snapshot } : null;
      syncDocumentContextConvertUi();
    }

    function setContextConvertPending(pending) {
      contextConvertPending = Boolean(pending);
      syncDocumentContextConvertUi();
    }

    async function openDocumentContextPicker() {
      if (contextConvertPending) return;
      const chatId = Number(activeChatId || state.getCurrentChatId?.() || 0);
      const snapshot = editor?.getSelectionSnapshot?.() || selectionSnapshot;
      if (!chatId || !snapshot?.text?.trim()) {
        syncDocumentContextConvertUi();
        return;
      }
      selectionSnapshot = { ...snapshot };
      const availability = await actions.loadContextConvertAvailability?.(chatId).catch(() => null);
      if (!availability?.enabled || !Array.isArray(availability.bots) || !availability.bots.length) {
        syncDocumentContextConvertUi();
        return;
      }
      actions.openDocumentContextConvertPicker?.({
        chatId,
        anchorEl: ensureDocumentContextConvertButton(),
        selectionSnapshot: { ...selectionSnapshot },
      });
    }

    function syncConnectionStatus(status = lastStatus, count = lastAwarenessCount) {
      lastStatus = status === 'online' ? 'online' : 'offline';
      lastAwarenessCount = Number(count || 0);
      const label = lastStatus === 'online' ? t('Online') : t('Offline');
      const people = lastAwarenessCount > 1 ? ` (${lastAwarenessCount})` : '';
      setStatus(`${label}${people}`, lastStatus);
    }

    function setEditorLoading(loading) {
      getEl('documentWorkspace', 'documentWorkspace')?.classList?.toggle('is-loading', Boolean(loading));
    }

    function destroyEditor() {
      if (editor) {
        try { editor.destroy(); } catch (e) {}
      }
      editor = null;
      const editorEl = getEl('documentEditor', 'documentEditor');
      editorEl?.replaceChildren?.();
      setEditorLoading(false);
    }

    function showDocumentWorkspace(chat) {
      setHidden(dom.emptyState, true);
      setHidden(dom.chatView, false);
      setHidden(dom.pinnedBar, true);
      setHidden(dom.messagesEl, true);
      setHidden(dom.inputArea, true);
      setHidden(dom.scrollBottomBtn, true);
      setHidden(dom.searchBtn, true);
      setHidden(dom.composerContextConvertBtn, true);
      setHidden(getEl('documentWorkspace', 'documentWorkspace'), false);
      dom.chatList?.querySelectorAll?.('.chat-item[data-chat-id]').forEach((el) => {
        el.classList.toggle('active', Number(el.dataset.chatId) === Number(chat && chat.id || activeChatId));
      });
      actions.renderCurrentChatHeader?.(chat || getCurrentChat());
      actions.updateChatStatus?.();
      actions.applyChatBackground?.(chat || getCurrentChat());
      actions.syncChatAreaMetrics?.();
      if (isDocumentChat(chat || getCurrentChat())) {
        actions.loadContextConvertAvailability?.(Number(chat?.id || activeChatId || 0))
          .then(() => syncDocumentContextConvertUi())
          .catch(() => {});
        actions.loadChatShotState?.(Number(chat?.id || activeChatId || 0), { force: true }).catch(() => {});
        actions.syncChatShotButton?.();
      }
      syncDocumentContextConvertUi();
    }

    function hideDocumentWorkspace() {
      setHidden(getEl('documentWorkspace', 'documentWorkspace'), true);
      setHidden(dom.messagesEl, false);
      setHidden(dom.inputArea, false);
      setHidden(dom.searchBtn, false);
      setHidden(dom.chatShotBtn, false);
      setHidden(dom.scrollBottomBtn, false);
      setDocumentSelectionSnapshot(null);
      actions.syncChatAreaMetrics?.();
    }

    async function copyText(text) {
      const value = String(text || '');
      if (!value) return false;
      if (win.navigator?.clipboard?.writeText) {
        await win.navigator.clipboard.writeText(value);
        return true;
      }
      const textarea = doc.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', 'readonly');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      doc.body.appendChild(textarea);
      textarea.select();
      const ok = doc.execCommand?.('copy');
      textarea.remove();
      return Boolean(ok);
    }

    async function fetchInviteLink() {
      const chatId = Number(activeChatId || state.getCurrentChatId?.() || 0);
      if (!chatId) return null;
      const link = await api(`/api/documents/${chatId}/invite-link`);
      return link;
    }

    async function uploadDocumentImage(file) {
      const chatId = Number(activeChatId || state.getCurrentChatId?.() || 0);
      if (!chatId) throw new Error(t('Could not insert image'));
      if (!file || !String(file.type || '').toLowerCase().startsWith('image/')) {
        throw new Error(t('Only images can be inserted'));
      }
      const formData = new win.FormData();
      formData.append('file', file, file.name || 'document-image.png');
      const data = await api(`/api/documents/${chatId}/images`, {
        method: 'POST',
        body: formData,
      });
      return data?.asset || data;
    }

    async function copyCurrentInviteLink() {
      try {
        setInviteStatus(t('Preparing link...'));
        const link = await fetchInviteLink();
        await copyText(link?.url || link?.path || '');
        setInviteStatus(t('Invite link copied'));
      } catch (error) {
        setInviteStatus(error?.message || t('Could not copy invite link'));
      }
    }

    function bindInviteButtons() {
      const copyBtn = getEl('copyDocumentInviteLinkBtn', 'copyDocumentInviteLinkBtn');
      if (copyBtn && !copyBtn.__documentInviteBound) {
        copyBtn.__documentInviteBound = true;
        copyBtn.addEventListener('click', () => copyCurrentInviteLink());
      }
    }

    async function openDocument(chatId, options = {}) {
      const id = Number(chatId || 0);
      if (!id) return false;
      const chat = options.chat || getCurrentChat();
      const sameActiveDocument = Number(activeChatId || 0) === id && editor;
      const seq = ++openSeq;
      activeChatId = id;
      actions.closeTransientUi?.();
      actions.clearReply?.();
      actions.clearPendingFile?.();
      actions.clearDisplayedTimelineState?.();
      showDocumentWorkspace(chat);
      setInviteStatus('');
      const titleInput = getEl('documentTitleInput', 'documentTitleInput');
      if (titleInput) titleInput.value = chat?.document_title || chat?.name || '';
      actions.revealActiveMobileChatRoute?.({
        suppressHistoryPush: Boolean(options.suppressHistoryPush),
        chatId: id,
      });
      try { win.localStorage?.setItem?.('lastChat', id); } catch (e) {}
      if (sameActiveDocument) {
        bindInviteButtons();
        editor.focus?.();
        return true;
      }
      syncConnectionStatus('offline', 0);
      setEditorLoading(true);

      let session = null;
      try {
        session = await api(`/api/documents/${id}/session`);
      } catch (error) {
        if (seq === openSeq && Number(activeChatId) === id) {
          setEditorLoading(false);
          setStatus(error?.message || t('Editor unavailable'), 'offline');
        }
        throw error;
      }
      if (seq !== openSeq || Number(activeChatId) !== id) {
        setEditorLoading(false);
        return false;
      }
      const editorEl = getEl('documentEditor', 'documentEditor');
      const toolbarEl = getEl('documentToolbar', 'documentToolbar');
      if (!editorEl || !win.BananzaDocumentEditor?.createEditor) {
        setEditorLoading(false);
        setStatus(t('Editor unavailable'), 'offline');
        return false;
      }
      const previousEditor = editor;
      const stagingEl = doc.createElement('div');
      stagingEl.className = 'document-editor';
      let nextEditor = null;
      let committed = false;
      const commitEditor = () => {
        if (committed) return;
        if (!nextEditor) return;
        committed = true;
        if (seq !== openSeq || Number(activeChatId) !== id) {
          try { nextEditor?.destroy?.(); } catch (e) {}
          setEditorLoading(false);
          return;
        }
        try { if (previousEditor && previousEditor !== nextEditor) previousEditor.destroy(); } catch (e) {}
        editorEl.replaceChildren(...Array.from(stagingEl.childNodes));
        editor = nextEditor;
        bindInviteButtons();
        setEditorLoading(false);
        editor.focus?.();
      };
      try {
        nextEditor = win.BananzaDocumentEditor.createEditor({
          editorEl: stagingEl,
          toolbarEl,
          titleInput,
          room: session.room,
          wsBase: session.wsBase || '/doc-ws',
          token: getToken(),
          user: session.user || {
            id: getCurrentUser()?.id,
            name: getCurrentUser()?.display_name || getCurrentUser()?.username || 'User',
            color: getCurrentUser()?.avatar_color || '#65aadd',
          },
          initialTitle: session.document?.title || chat?.name || '',
          t,
          uploadImage: uploadDocumentImage,
          onError: (message) => actions.showToast?.(message || t('Could not insert image')),
          onStatusChange: syncConnectionStatus,
          onSelectionChange: setDocumentSelectionSnapshot,
          onReady: commitEditor,
        });
        nextEditor.ready?.then?.(commitEditor);
      } catch (error) {
        setEditorLoading(false);
        setStatus(error?.message || t('Editor unavailable'), 'offline');
        throw error;
      }
      return true;
    }

    function closeDocumentMode() {
      openSeq += 1;
      activeChatId = null;
      destroyEditor();
      hideDocumentWorkspace();
      setInviteStatus('');
      syncConnectionStatus('offline', 0);
      setDocumentSelectionSnapshot(null);
      setContextConvertPending(false);
    }

    function handleRealtimeMessage(message) {
      if (!message || typeof message !== 'object') return false;
      if (message.type === 'document_system_notice') {
        const chatId = Number(message.chatId || message.chat_id || 0);
        if (!chatId || chatId !== Number(activeChatId || 0)) return true;
        actions.showToast?.(t(message.messageKey || message.message || 'ChatShot saved to notes'));
        return true;
      }
      if (message.type !== 'document_saved') return false;
      const chatId = Number(message.chatId || message.chat_id || 0);
      if (!chatId || chatId !== Number(activeChatId || 0)) return true;
      if (message.title && getEl('documentTitleInput', 'documentTitleInput') && doc.activeElement !== getEl('documentTitleInput', 'documentTitleInput')) {
        getEl('documentTitleInput', 'documentTitleInput').value = message.title;
      }
      actions.loadChatShotState?.(chatId, { force: true }).catch(() => {});
      return true;
    }

    bindInviteButtons();

    return {
      closeDocumentMode,
      getContextConvertSelectionSnapshot: () => editor?.getSelectionSnapshot?.() || selectionSnapshot,
      handleRealtimeMessage,
      isDocumentChat,
      openDocument,
      replaceContextConvertSelectionText: (snapshot, text) => editor?.replaceSelectionText?.(snapshot, text) || false,
      setContextConvertPending,
      syncDocumentContextConvertUi,
    };
  }

  documentsRoot.createDocumentRuntime = createDocumentRuntime;
})();
