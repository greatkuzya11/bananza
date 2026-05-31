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
      if (!editTo) return;
      const nextText = text.getComposerTextValue?.({ trim: true }) || '';
      if (nextText.length > MAX_MSG) {
        (actions.alert || alert)('Message too long');
        return;
      }
      if (!nextText && !editTo.allowEmpty) {
        (actions.alert || alert)('Text cannot be empty');
        return;
      }

      if (nextText === String(editTo.text || '').trim()) {
        replyEdit.clearEdit?.({ clearInput: true });
        return;
      }

      try {
        const updated = await api(`/api/messages/${editTo.id}`, {
          method: 'PATCH',
          body: { text: nextText },
        });
        const preserveAnchor = (actions.captureScrollAnchor || (() => null))();
        (actions.applyMessageUpdate || noop)(updated, { preserveAnchor });
        replyEdit.clearEdit?.({ clearInput: true });
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
      const firstAttachment = filesToSend[0] || null;
      items.push(createMessageOutboxItem({
        text: messageText || null,
        attachment: firstAttachment,
        reply: replySnapshot,
        createdAt: new Date().toISOString(),
        aiImageRiskAccepted,
        aiResponseModeHint: composerAiOverride.ai_response_mode_hint || null,
        aiDocumentFormatHint: composerAiOverride.ai_document_format_hint || null,
      }));
      for (let index = 1; index < filesToSend.length; index += 1) {
        items.push(createMessageOutboxItem({
          text: null,
          attachment: filesToSend[index],
          reply: null,
          createdAt: new Date(Date.now() + index).toISOString(),
        }));
      }

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
