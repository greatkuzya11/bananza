(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const messagesRoot = root.messages = root.messages || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createMessageUpdates(options = {}) {
    const opts = objectOrDefault(options);
    const win = opts.window || window;
    const doc = opts.document || document;
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const renderer = objectOrDefault(opts.renderer);
    const api = typeof opts.api === 'function' ? opts.api : (() => Promise.resolve({}));
    const esc = typeof opts.esc === 'function' ? opts.esc : (value) => String(value ?? '');
    const messagesEl = dom.messagesEl || doc.getElementById('messages');
    const messageCache = opts.messageCache || window.messageCache || null;

    function getCurrentChatId() {
      return Number(state.getCurrentChatId?.() || 0) || null;
    }

    async function deleteMessage(id) {
      if (!win.confirm('Delete this message?')) return;
      try {
        await api(`/api/messages/${id}`, { method: 'DELETE' });
        markMessageDeleted(id);
        actions.loadChats?.();
      } catch (err) {
        console.error('[delete] failed:', err);
      }
    }

    function markMessageDeleted(msgId, chatId = getCurrentChatId()) {
      try { messageCache?.deleteMessage?.(chatId, msgId).catch(() => {}); } catch (e) {}
      actions.ensureScrollAnchorsLoaded?.();
      const activeChatId = Number(getCurrentChatId() || 0);
      const targetChatId = Number(chatId || activeChatId || 0);
      const savedAnchor = targetChatId ? actions.getScrollAnchor?.(targetChatId) : null;
      const deletedAnchorWasSaved = Boolean(savedAnchor?.messageId && Number(savedAnchor.messageId) === Number(msgId));
      const isActiveChat = targetChatId > 0 && targetChatId === activeChatId;
      const preserveAnchor = isActiveChat ? actions.captureScrollAnchor?.() : null;
      const el = messagesEl?.querySelector?.(`[data-msg-id="${msgId}"]`);
      if (!el) {
        if (deletedAnchorWasSaved && targetChatId) actions.deleteScrollAnchor?.(targetChatId);
        console.warn('[markDeleted] element not found for', msgId);
        return;
      }
      actions.hideDeletedMessageSurfaces?.(msgId);
      if (Number(state.getEditMessageId?.() || 0) === Number(msgId)) actions.clearEdit?.({ clearInput: true });
      el.querySelectorAll('audio, video').forEach((media) => {
        try {
          media.pause?.();
          media.currentTime = 0;
        } catch (e) {}
      });

      const previousMessage = el.__messageData ? { ...el.__messageData } : null;
      const deletedPreviewText = 'Message deleted';
      const deletedMessage = {
        ...(previousMessage || {}),
        id: Number(previousMessage?.id || msgId || 0),
        chat_id: Number(previousMessage?.chat_id || previousMessage?.chatId || targetChatId || activeChatId || 0),
        user_id: Number(previousMessage?.user_id || el.dataset.userId || 0),
        is_deleted: true,
        text: deletedPreviewText,
        file_id: null,
        file_name: null,
        file_stored: null,
        file_type: null,
        file_mime: null,
        file_size: null,
        client_file_url: '',
        client_poster_url: '',
        file_poster_available: false,
        previews: [],
        reactions: [],
        edited_at: null,
        poll: null,
        is_voice_note: false,
        is_video_note: false,
        voice_duration_ms: null,
        media_note_duration_ms: null,
        transcription_status: 'idle',
        transcription_text: '',
        transcription_provider: '',
        transcription_model: '',
        transcription_error: '',
        client_status: null,
      };

      let replaced = false;
      try {
        replaced = renderer.replaceRenderedMessage?.(deletedMessage);
      } catch (e) {
        console.warn('[markDeleted] rerender failed for', msgId, e);
      }

      if (!replaced) {
        const bubble = el.querySelector('.msg-bubble');
        if (!bubble) {
          console.warn('[markDeleted] bubble not found');
          return;
        }
        const timeEl = bubble.querySelector('.msg-time');
        const timeText = timeEl ? timeEl.textContent : '';
        bubble.innerHTML = `<span class="msg-deleted">Message deleted</span><span class="msg-time">${esc(timeText)}</span>`;
        el.classList.remove('video-note-row', 'video-note-playing', 'media-message', 'poll-message', 'emoji-only-message', 'client-failed', 'client-sending');
        delete el.dataset.clientStatus;
        el.__messageData = deletedMessage;
        el.__voiceMessage = null;
        if (el.__replyPayload) {
          el.__replyPayload = {
            ...el.__replyPayload,
            text: deletedPreviewText,
            is_voice_note: false,
            is_video_note: false,
          };
        }
        el.querySelector('.msg-reply-btn')?.remove();
        el.querySelector('.msg-react-btn')?.remove();
        el.querySelector('.msg-edit-btn')?.remove();
        el.querySelector('.msg-context-convert-btn')?.remove();
        el.querySelector('.msg-restore-original-btn')?.remove();
        el.querySelector('.msg-save-note-btn')?.remove();
        el.querySelector('.msg-forward-btn')?.remove();
        el.querySelector('.msg-actions')?.remove();
      } else {
        const replacement = messagesEl.querySelector(`[data-msg-id="${msgId}"]`);
        if (replacement?.__replyPayload) {
          replacement.__replyPayload = {
            ...replacement.__replyPayload,
            text: deletedPreviewText,
            is_voice_note: false,
            is_video_note: false,
          };
        }
      }

      updateVisibleReplyQuotesFromMessage(deletedMessage);
      win.requestAnimationFrame(() => {
        if (isActiveChat && preserveAnchor?.messageId) actions.restoreScrollAnchor?.(preserveAnchor, 1);
        if (targetChatId) actions.saveCurrentScrollAnchor?.(targetChatId, { force: true });
      });
    }

    function updateVisibleReplyQuotesFromMessage(msg) {
      if (!msg?.id) return;
      const text = actions.getReplyPreviewText?.(msg) || '';
      actions.updateReplyBarFromMessage?.(msg, text);
      messagesEl?.querySelectorAll?.(`.msg-reply[data-reply-id="${msg.id}"] .msg-reply-text`).forEach((el) => {
        el.textContent = text;
      });
    }

    function applyMessageUpdate(msg, options = {}) {
      if (!msg?.id) return;
      updateVisibleReplyQuotesFromMessage(msg);
      actions.applyOwnReadStateToMessage?.(msg, msg.chat_id || getCurrentChatId());
      try { messageCache?.upsertMessage?.(msg).catch(() => {}); } catch (e) {}
      if (Number(msg.chat_id || 0) !== Number(getCurrentChatId() || 0)) return;
      renderer.replaceRenderedMessage?.(msg, options);
      actions.refreshReactionPickerForMessage?.(msg);
    }

    return {
      deleteMessage,
      markMessageDeleted,
      updateVisibleReplyQuotesFromMessage,
      applyMessageUpdate,
    };
  }

  messagesRoot.updates = {
    createMessageUpdates,
  };
})();
