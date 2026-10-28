(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const composerRoot = root.composer = root.composer || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function noop() {}

  function createComposerSendController(options = {}) {
    const opts = objectOrDefault(options);
    const win = opts.window || window;
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const text = objectOrDefault(opts.text);
    const replyEdit = objectOrDefault(opts.replyEdit);
    const files = objectOrDefault(opts.files);
    const actions = objectOrDefault(opts.actions);
    const services = objectOrDefault(opts.services);
    const messages = objectOrDefault(services.messages || opts.messages);
    const outbox = objectOrDefault(messages.outbox || opts.outbox);
    const api = typeof opts.api === 'function' ? opts.api : (() => Promise.resolve({}));
    const config = objectOrDefault(opts.config);
    const MAX_MSG = Number(config.MAX_MSG || opts.MAX_MSG || 4096) || 4096;
    const getCurrentChatId = typeof opts.getCurrentChatId === 'function'
      ? opts.getCurrentChatId
      : (typeof actions.getCurrentChatId === 'function' ? actions.getCurrentChatId : () => null);

    async function saveEditedMessage() {
      const editTo = state.editTo;
      if (!editTo || editTo.saving || files.isPreparingFiles?.()) return;
      const pending = state.getPendingFiles ? state.getPendingFiles() : [...(state.pendingFiles || [])];
      const allowEmpty = editTo.attachmentsEditable ? pending.length > 0 : editTo.allowEmpty;
      const nextText = text.getComposerTextValue?.({ trim: true }) || '';
      if (nextText.length > MAX_MSG) {
        (actions.alert || alert)('Message too long');
        return;
      }
      if (!nextText && !allowEmpty) {
        (actions.alert || alert)('Text cannot be empty');
        return;
      }

      const unchangedFiles = !editTo.attachmentsEditable || (pending.length === editTo.originalFileIds.length
        && pending.every((file, index) => file.serverFileId === editTo.originalFileIds[index]));
      if (nextText === String(editTo.text || '').trim() && unchangedFiles) {
        replyEdit.clearEdit?.({ clearInput: true });
        return;
      }

      try {
        editTo.saving = true;
        dom.sendBtn?.classList.add('is-saving-edit');
        dom.sendBtn?.setAttribute('aria-busy', 'true');
        if (dom.sendBtn) dom.sendBtn.disabled = true;
        if (dom.attachBtn) dom.attachBtn.disabled = true;
        if (dom.msgInput) dom.msgInput.readOnly = true;
        if (dom.pendingFileEl) dom.pendingFileEl.inert = true;
        dom.replyBar?.setAttribute('aria-busy', 'true');
        const previousStatus = dom.replyBarText?.textContent;
        editTo.previousStatus = previousStatus;
        if (dom.replyBarText) dom.replyBarText.textContent = win.BananzaI18n?.t('Saving changes...') || 'Saving changes...';
        const fileIds = [];
        if (editTo.attachmentsEditable) {
          for (const attachment of pending) {
            if (!attachment.serverFileId) {
              const form = new win.FormData();
              form.append('file', attachment.file, attachment.name);
              if (attachment.posterBlob) form.append('poster', attachment.posterBlob, 'video-poster.jpg');
              const uploaded = await api('/api/upload', { method: 'POST', body: form });
              attachment.serverFileId = uploaded.id;
              attachment.serverFileMeta = uploaded;
            }
            if (state.editTo !== editTo) return;
            fileIds.push(attachment.serverFileId);
          }
        }
        const updated = await api(`/api/messages/${editTo.id}`, {
          method: 'PATCH',
          body: { text: nextText, ...(editTo.attachmentsEditable ? { fileIds } : {}) },
        });
        const preserveAnchor = (actions.captureScrollAnchor || (() => null))();
        (actions.applyMessageUpdate || noop)(updated, { preserveAnchor });
        if (state.editTo === editTo) replyEdit.clearEdit?.({ clearInput: true });
        if (preserveAnchor?.messageId) {
          win.requestAnimationFrame(() => {
            (actions.restoreScrollAnchor || noop)(preserveAnchor, 2);
            (actions.saveCurrentScrollAnchor || noop)(getCurrentChatId(), { force: true });
          });
        } else {
          (actions.saveCurrentScrollAnchor || noop)(getCurrentChatId(), { force: true });
        }
        (actions.loadChats || (() => Promise.resolve()))().catch(() => {});
      } catch (error) {
        (actions.alert || alert)(error.message);
      } finally {
        if (state.editTo === editTo) {
          editTo.saving = false;
          dom.sendBtn?.classList.remove('is-saving-edit');
          dom.sendBtn?.removeAttribute('aria-busy');
          if (dom.sendBtn) dom.sendBtn.disabled = false;
          if (dom.attachBtn) dom.attachBtn.disabled = !editTo.attachmentsEditable;
          if (dom.msgInput) dom.msgInput.readOnly = false;
          if (dom.pendingFileEl) dom.pendingFileEl.inert = false;
          dom.replyBar?.removeAttribute('aria-busy');
          if (dom.replyBarText) dom.replyBarText.textContent = editTo.previousStatus || '';
        }
      }
    }

    function createMessageOutboxItem(payload) {
      if (typeof outbox.createMessageOutboxItem === 'function') return outbox.createMessageOutboxItem(payload);
      if (typeof actions.createMessageOutboxItem === 'function') return actions.createMessageOutboxItem(payload);
      return null;
    }

    async function sendMessage() {
      const currentChatId = getCurrentChatId();
      if (!currentChatId) return;
      if (files.isPreparingFiles?.()) return;
      if (state.editTo) {
        await saveEditedMessage();
        return;
      }
      const messageText = text.getComposerTextValue?.({ trim: true }) || '';
      const filesToSend = state.getPendingFiles ? state.getPendingFiles() : [...(state.pendingFiles || [])];

      if (!messageText && filesToSend.length === 0) return;
      if (messageText.length > MAX_MSG) {
        (actions.alert || alert)('Message too long');
        return;
      }
      const replySnapshot = replyEdit.getReplySnapshot?.() || null;
      const composerAiOverride = (actions.resolveComposerAiOverridePayload || actions.getComposerAiOverridePayload || (() => ({})))() || {};
      let aiImageRiskAccepted = false;
      if (messageText) {
        try {
          const risk = await (actions.analyzeOutgoingGrokImageRisk || (() => Promise.resolve({ risky: false })))(
            messageText,
            replySnapshot,
            composerAiOverride
          );
          if (risk.risky) {
            const confirmed = await (actions.openGrokImageRiskConfirm || (() => Promise.resolve(true)))(risk.matches);
            if (!confirmed) return;
            aiImageRiskAccepted = true;
          }
        } catch (error) {
          console.warn('[grok-image-risk] precheck failed:', error?.message || error);
        }
      }
      if (getCurrentChatId() !== currentChatId || files.isPreparingFiles?.()) return;
      if (messageText) state.addComposerHistoryEntry?.(currentChatId, messageText);
      text.animateSendButton?.();
      if (dom.msgInput) dom.msgInput.value = '';
      (actions.clearComposerDraft || noop)(currentChatId);
      text.autoResize?.();
      (actions.syncMentionOpenButton || noop)();
      files.clearPendingFile?.();
      replyEdit.clearReply?.();
      (actions.refreshVoiceComposerState || noop)();
      (actions.scheduleMobileViewportRecovery || noop)();

      const items = [];
      items.push(createMessageOutboxItem({
        text: messageText || null,
        attachments: filesToSend,
        reply: replySnapshot,
        createdAt: new Date().toISOString(),
        aiImageRiskAccepted,
        aiResponseModeHint: composerAiOverride.ai_response_mode_hint || null,
        aiDocumentFormatHint: composerAiOverride.ai_document_format_hint || null,
      }));
      const queueOutboxItem = outbox.queueOutboxItem || actions.queueOutboxItem;
      const trySendOutboxItem = outbox.trySendOutboxItem || actions.trySendOutboxItem;
      for (const item of items.filter(Boolean)) await queueOutboxItem?.(item, { attempt: false });
      (actions.playAppSound || noop)('send');
      (actions.scrollToBottom || noop)();
      for (const item of items.filter(Boolean)) await trySendOutboxItem?.(item);
    }

    return {
      sendMessage,
      saveEditedMessage,
      createMessageOutboxItem,
    };
  }

  composerRoot.send = {
    createComposerSendController,
  };
})();
