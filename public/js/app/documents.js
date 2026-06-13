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

    function syncConnectionStatus(status = lastStatus, count = lastAwarenessCount) {
      lastStatus = status === 'online' ? 'online' : 'offline';
      lastAwarenessCount = Number(count || 0);
      const label = lastStatus === 'online' ? t('Online') : t('Offline');
      const people = lastAwarenessCount > 1 ? ` (${lastAwarenessCount})` : '';
      setStatus(`${label}${people}`, lastStatus);
    }

    function destroyEditor() {
      if (editor) {
        try { editor.destroy(); } catch (e) {}
      }
      editor = null;
      const editorEl = getEl('documentEditor', 'documentEditor');
      editorEl?.replaceChildren?.();
    }

    function showDocumentWorkspace(chat) {
      setHidden(dom.emptyState, true);
      setHidden(dom.chatView, false);
      setHidden(dom.pinnedBar, true);
      setHidden(dom.messagesEl, true);
      setHidden(dom.inputArea, true);
      setHidden(dom.scrollBottomBtn, true);
      setHidden(dom.searchBtn, true);
      setHidden(dom.chatShotBtn, true);
      setHidden(dom.composerContextConvertBtn, true);
      setHidden(getEl('documentWorkspace', 'documentWorkspace'), false);
      dom.chatList?.querySelectorAll?.('.chat-item[data-chat-id]').forEach((el) => {
        el.classList.toggle('active', Number(el.dataset.chatId) === Number(chat && chat.id || activeChatId));
      });
      actions.renderCurrentChatHeader?.(chat || getCurrentChat());
      actions.updateChatStatus?.();
      actions.applyChatBackground?.(chat || getCurrentChat());
      actions.syncChatAreaMetrics?.();
    }

    function hideDocumentWorkspace() {
      setHidden(getEl('documentWorkspace', 'documentWorkspace'), true);
      setHidden(dom.messagesEl, false);
      setHidden(dom.inputArea, false);
      setHidden(dom.searchBtn, false);
      setHidden(dom.chatShotBtn, false);
      setHidden(dom.scrollBottomBtn, false);
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

    async function fetchInviteLink({ rotate = false } = {}) {
      const chatId = Number(activeChatId || state.getCurrentChatId?.() || 0);
      if (!chatId) return null;
      const route = rotate
        ? `/api/documents/${chatId}/invite-link/rotate`
        : `/api/documents/${chatId}/invite-link`;
      const link = await api(route, rotate ? { method: 'POST' } : undefined);
      return link;
    }

    async function copyCurrentInviteLink({ rotate = false } = {}) {
      try {
        setInviteStatus(t('Preparing link...'));
        const link = await fetchInviteLink({ rotate });
        await copyText(link?.url || link?.path || '');
        setInviteStatus(t('Invite link copied'));
      } catch (error) {
        setInviteStatus(error?.message || t('Could not copy invite link'));
      }
    }

    function bindInviteButtons() {
      const copyBtn = getEl('copyDocumentInviteLinkBtn', 'copyDocumentInviteLinkBtn');
      const refreshBtn = getEl('refreshDocumentInviteLinkBtn', 'refreshDocumentInviteLinkBtn');
      if (copyBtn && !copyBtn.__documentInviteBound) {
        copyBtn.__documentInviteBound = true;
        copyBtn.addEventListener('click', () => copyCurrentInviteLink({ rotate: false }));
      }
      if (refreshBtn && !refreshBtn.__documentInviteBound) {
        refreshBtn.__documentInviteBound = true;
        refreshBtn.addEventListener('click', () => copyCurrentInviteLink({ rotate: true }));
      }
    }

    async function openDocument(chatId, options = {}) {
      const id = Number(chatId || 0);
      if (!id) return false;
      const chat = options.chat || getCurrentChat();
      const seq = ++openSeq;
      activeChatId = id;
      actions.closeTransientUi?.();
      actions.clearReply?.();
      actions.clearPendingFile?.();
      actions.clearDisplayedTimelineState?.();
      showDocumentWorkspace(chat);
      setInviteStatus('');
      syncConnectionStatus('offline', 0);
      const titleInput = getEl('documentTitleInput', 'documentTitleInput');
      if (titleInput) titleInput.value = chat?.document_title || chat?.name || '';
      destroyEditor();
      actions.revealActiveMobileChatRoute?.({
        suppressHistoryPush: Boolean(options.suppressHistoryPush),
        chatId: id,
      });
      try { win.localStorage?.setItem?.('lastChat', id); } catch (e) {}

      const session = await api(`/api/documents/${id}/session`);
      if (seq !== openSeq || Number(activeChatId) !== id) return false;
      const editorEl = getEl('documentEditor', 'documentEditor');
      const toolbarEl = getEl('documentToolbar', 'documentToolbar');
      if (!editorEl || !win.BananzaDocumentEditor?.createEditor) {
        setStatus(t('Editor unavailable'), 'offline');
        return false;
      }
      editor = win.BananzaDocumentEditor.createEditor({
        editorEl,
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
        onStatusChange: syncConnectionStatus,
      });
      bindInviteButtons();
      editor.focus?.();
      return true;
    }

    function closeDocumentMode() {
      openSeq += 1;
      activeChatId = null;
      destroyEditor();
      hideDocumentWorkspace();
      setInviteStatus('');
      syncConnectionStatus('offline', 0);
    }

    function handleRealtimeMessage(message) {
      if (!message || typeof message !== 'object') return false;
      if (message.type !== 'document_saved') return false;
      const chatId = Number(message.chatId || message.chat_id || 0);
      if (!chatId || chatId !== Number(activeChatId || 0)) return true;
      if (message.title && getEl('documentTitleInput', 'documentTitleInput') && doc.activeElement !== getEl('documentTitleInput', 'documentTitleInput')) {
        getEl('documentTitleInput', 'documentTitleInput').value = message.title;
      }
      return true;
    }

    bindInviteButtons();

    return {
      closeDocumentMode,
      handleRealtimeMessage,
      isDocumentChat,
      openDocument,
    };
  }

  documentsRoot.createDocumentRuntime = createDocumentRuntime;
})();
