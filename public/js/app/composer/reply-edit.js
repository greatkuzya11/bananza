(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const composerRoot = root.composer = root.composer || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function noop() {}

  function createReplyEditController(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const win = opts.window || window;
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const text = objectOrDefault(opts.text);
    const actions = objectOrDefault(opts.actions);
    const getCurrentUser = typeof opts.getCurrentUser === 'function' ? opts.getCurrentUser : () => null;
    const getCurrentChatId = typeof opts.getCurrentChatId === 'function' ? opts.getCurrentChatId : () => null;

    function getReplyPreviewText(msg) {
      if (msg?.text) return msg.text.substring(0, 100);
      if (msg?.location || msg?.is_location) return 'Location';
      if (msg?.is_voice_note) {
        const transcript = (msg.transcription_text || '').trim();
        return transcript ? transcript.substring(0, 100) : (actions.getMediaNoteFallbackLabel || (() => 'Attachment'))(msg);
      }
      if (msg?.file_name) return msg.file_name.substring(0, 100);
      return 'Attachment';
    }

    function getReplyQuoteText(msg) {
      const serverText = (msg?.reply_text || '').trim();
      if (serverText) return serverText.substring(0, 100);

      const sourceRow = msg?.reply_to_id && dom.messagesEl
        ? dom.messagesEl.querySelector(`[data-msg-id="${msg.reply_to_id}"]`)
        : null;
      const sourceText = (sourceRow?.__replyPayload?.text || '').trim();
      if (sourceText && sourceText !== 'Attachment') return sourceText.substring(0, 100);
      if (msg?.reply_is_location || sourceRow?.__replyPayload?.is_location || sourceRow?.__messageData?.location) {
        return 'Location';
      }

      const isVoiceReply = Boolean(
        msg?.reply_is_voice_note ||
        sourceRow?.__voiceMessage?.is_voice_note ||
        sourceRow?.__voiceBootstrap?.is_voice_note
      );
      if (!isVoiceReply) return 'Attachment';
      return (actions.getMediaNoteFallbackLabel || (() => 'Attachment'))({
        is_voice_note: true,
        is_video_note: Boolean(sourceRow?.__messageData?.is_video_note || msg?.reply_note_kind === 'video_note'),
      });
    }

    function canEditMessage(msg) {
      const currentUser = getCurrentUser();
      if (!currentUser || !msg || msg.is_deleted) return false;
      if ((actions.isClientSideMessage || (() => false))(msg)) return false;
      if ((actions.isPollMessage || (() => false))(msg)) return false;
      if (msg.call || msg.call_message || msg.is_call_message) return false;
      if (msg.call_transcript_run || msg.is_call_transcript_message) return false;
      if (msg.call_artifact_batch || msg.is_call_artifact_message) return false;
      if (!currentUser.is_admin && msg.user_id !== currentUser.id) return false;
      return Boolean(msg.is_voice_note || msg.file_id || msg.text);
    }

    function canForwardMessage(msg) {
      const currentUser = getCurrentUser();
      if (!currentUser || !msg || msg.is_deleted) return false;
      if ((actions.isClientSideMessage || (() => false))(msg)) return false;
      if ((actions.isPollMessage || (() => false))(msg)) return false;
      if (msg.call || msg.call_message || msg.is_call_message) return false;
      if (msg.call_transcript_run || msg.is_call_transcript_message) return false;
      if (msg.call_artifact_batch || msg.is_call_artifact_message) return false;
      return Boolean(msg.is_voice_note || msg.file_id || msg.location || msg.is_location || msg.text);
    }

    function canSaveMessageToNotes(msg) {
      if (!canForwardMessage(msg)) return false;
      if ((actions.isCurrentNotesChat || (() => false))()) return false;
      return true;
    }

    function getEditableText(row) {
      const msg = row?.__messageData || {};
      if (msg.is_voice_note || row?.__voiceMessage?.is_voice_note) {
        return (row?.__voiceMessage?.transcription_text || msg.transcription_text || '').trim();
      }
      return msg.text || '';
    }

    function getSelectedMessageFragment(row) {
      const selection = win.getSelection?.();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return '';
      const selectedText = selection.toString();
      const bubble = row?.querySelector('.msg-bubble');
      if (!bubble || !selectedText.trim()) return '';
      const anchorNode = selection.anchorNode;
      const focusNode = selection.focusNode;
      if (!anchorNode || !focusNode) return '';
      return bubble.contains(anchorNode) && bubble.contains(focusNode) ? selectedText.trim() : '';
    }

    function isSelectableMessageTextTarget(target) {
      return Boolean(target?.closest?.(
        '.msg-text, .msg-forwarded, .msg-reply-text, .msg-file-name, .msg-file-size, .link-preview'
      ));
    }

    function getMessageCopyTextData(row) {
      const selectedText = getSelectedMessageFragment(row);
      if (selectedText) {
        return { text: selectedText, hasMeaningfulContent: true };
      }
      const msg = row?.__messageData || {};
      const parts = [];
      let hasMeaningfulContent = false;
      if (msg.forwarded_from_display_name) {
        parts.push(`Forwarded from ${msg.forwarded_from_display_name}`);
        hasMeaningfulContent = true;
      }
      if (msg.reply_to_id && msg.reply_display_name) {
        const replyText = getReplyQuoteText(msg).trim();
        const replyName = String(msg.reply_display_name || '').trim();
        if (replyName || replyText) {
          parts.push([replyName, replyText].filter(Boolean).join(': '));
          hasMeaningfulContent = true;
        }
      }
      if (msg.file_id && msg.file_name) {
        parts.push(msg.file_name);
        hasMeaningfulContent = true;
      }
      if (msg.location) {
        const location = msg.location || {};
        const latitude = Number(location.latitude ?? location.lat);
        const longitude = Number(location.longitude ?? location.lon ?? location.lng);
        const zoom = Math.min(19, Math.max(1, Number(location.zoom) || 16));
        const label = String(location.title || location.address || 'Location').trim();
        const coords = Number.isFinite(latitude) && Number.isFinite(longitude)
          ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          : '';
        const link = Number.isFinite(latitude) && Number.isFinite(longitude)
          ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}&mlon=${encodeURIComponent(longitude)}#map=${zoom}/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`
          : '';
        parts.push([label, coords, link].filter(Boolean).join('\n'));
        hasMeaningfulContent = true;
      }
      const mainText = getEditableText(row).trim();
      if (mainText) {
        parts.push(mainText);
        hasMeaningfulContent = true;
      }
      return {
        text: parts.filter(Boolean).join('\n').trim(),
        hasMeaningfulContent,
      };
    }

    function getMessageCopyText(row) {
      const copyData = getMessageCopyTextData(row);
      if (copyData.text) return copyData.text;
      const copyMsg = row?.__messageData || {};
      if (copyMsg.location) return 'Location';
      if (copyMsg.file_id) return 'Attachment';
      return '';
    }

    async function copyMessageFromRow(row) {
      if (!row) return;
      const selectedText = getSelectedMessageFragment(row);
      const copyText = selectedText || getMessageCopyText(row);
      if (!copyText) return;
      (actions.hideFloatingMessageActions || noop)();
      const copied = await (actions.copyTextToClipboard || (() => false))(copyText);
      (actions.showCenterToast || noop)(copied
        ? (selectedText ? '\u0424\u0440\u0430\u0433\u043c\u0435\u043d\u0442 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d' : '\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e')
        : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c');
    }

    function getReplySnapshot(source = state.replyTo) {
      if (!source?.id) return null;
      return {
        id: source.id,
        display_name: source.display_name || source.displayName || '',
        text: source.text || '',
        is_voice_note: Boolean(source.is_voice_note),
        is_video_note: Boolean(source.is_video_note),
        is_location: Boolean(source.is_location || source.location),
        location: source.location || null,
        ai_bot_id: Number(source.ai_bot_id) || 0,
        ai_bot_mention: source.ai_bot_mention || '',
        ai_bot_provider: source.ai_bot_provider || '',
        ai_bot_kind: source.ai_bot_kind || '',
      };
    }

    function setReplyFromRow(row) {
      if (row?.dataset.outbox === '1') return;
      const payload = row?.__replyPayload;
      if (!payload || row.querySelector('.msg-deleted')) return;
      (actions.hideFloatingMessageActions || noop)();
      setReply(payload.id, payload.display_name, payload.text, payload);
    }

    function setReply(id, name, replyText, meta = null) {
      if (state.editTo) clearEdit({ clearInput: true });
      state.setReplyTo({
        id,
        display_name: name,
        text: replyText,
        is_voice_note: Boolean(meta?.is_voice_note),
        is_video_note: Boolean(meta?.is_video_note),
        is_location: Boolean(meta?.is_location || meta?.location),
        location: meta?.location || null,
        ai_bot_id: Number(meta?.ai_bot_id) || 0,
        ai_bot_mention: meta?.ai_bot_mention || '',
        ai_bot_provider: meta?.ai_bot_provider || '',
        ai_bot_kind: meta?.ai_bot_kind || '',
      });
      if (dom.replyBarName) dom.replyBarName.textContent = name;
      if (dom.replyBarText) dom.replyBarText.textContent = replyText || 'Attachment';
      dom.replyBar?.classList.remove('edit-bar');
      dom.replyBar?.classList.remove('hidden');
      dom.msgInput?.focus();
    }

    function clearReply() {
      state.clearReplyTo();
      if (!state.editTo) dom.replyBar?.classList.add('hidden');
      (actions.queueIosViewportLayoutSync || noop)();
      (actions.updateComposerAiOverrideState || noop)();
    }

    function setEditFromRow(row) {
      const msg = row?.__messageData;
      if (!canEditMessage(msg)) return;
      if (state.pendingFiles.length > 0) {
        (actions.alert || alert)('Finish or remove pending attachments before editing a message.');
        return;
      }

      const editableText = getEditableText(row);
      (actions.hideFloatingMessageActions || noop)();
      state.clearReplyTo();
      state.setEditTo({
        id: msg.id,
        text: editableText,
        is_voice_note: Boolean(msg.is_voice_note || row.__voiceMessage?.is_voice_note),
        allowEmpty: Boolean(msg.file_id && !(msg.is_voice_note || row.__voiceMessage?.is_voice_note)),
      });
      if (dom.replyBarName) dom.replyBarName.textContent = '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435';
      if (dom.replyBarText) {
        dom.replyBarText.textContent = state.editTo.is_voice_note
          ? '\u0422\u0435\u043a\u0441\u0442 \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0433\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f'
          : '\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435';
      }
      dom.replyBar?.classList.add('edit-bar');
      dom.replyBar?.classList.remove('hidden');
      text.setComposerTextValue?.(editableText);
      text.autoResize?.();
      (actions.syncMentionOpenButton || noop)();
      if (dom.attachBtn) {
        dom.attachBtn.disabled = true;
        dom.attachBtn.classList.add('disabled');
      }
      (actions.refreshPollComposerActionState || noop)();
      (actions.refreshVoiceComposerState || noop)();
      dom.msgInput?.focus();
    }

    function clearEdit({ clearInput = true, draftChatId = getCurrentChatId() } = {}) {
      state.clearEditTo();
      dom.replyBar?.classList.remove('edit-bar');
      dom.replyBar?.classList.add('hidden');
      if (dom.attachBtn) {
        dom.attachBtn.disabled = false;
        dom.attachBtn.classList.remove('disabled');
      }
      if (clearInput) {
        if (dom.msgInput) dom.msgInput.value = '';
        (actions.clearComposerDraft || noop)(draftChatId);
        text.autoResize?.();
      }
      (actions.syncMentionOpenButton || noop)();
      (actions.refreshPollComposerActionState || noop)();
      (actions.refreshVoiceComposerState || noop)();
    }

    function updateReplyPreview(messageId, nextText) {
      if (state.replyTo?.id === messageId && !state.editTo) {
        state.replyTo.text = nextText || 'Attachment';
        if (dom.replyBarText) dom.replyBarText.textContent = state.replyTo.text;
      }
    }

    function setupMessageSwipeGestures() {
      const messagesEl = dom.messagesEl;
      if (!messagesEl || messagesEl.__composerSwipeGesturesBound) return;
      messagesEl.__composerSwipeGesturesBound = true;
      const threshold = 42;
      const maxOffset = 68;
      const lockStartPx = 8;
      const verticalCancelPx = 22;
      const mediaClickSuppressMs = 700;
      let swipe = null;

      const isInteractiveTarget = (target) => Boolean(target.closest(
        'button, a, input, textarea, select, label, audio, video, .msg-reply, .reaction-badge, .msg-file, .link-preview, .msg-group-avatar, .markdown-table-wrap'
      ));
      const suppressMediaClickAfterSwipe = (row) => {
        if (!row?.querySelector?.('.msg-image')) return;
        row.__suppressMediaClickUntil = Date.now() + mediaClickSuppressMs;
      };
      const isSwipeGestureActive = (inputType) => Boolean(swipe && swipe.inputType === inputType);
      const canReplyFromRow = (row) => Boolean(
        row?.__replyPayload && row.dataset.outbox !== '1' && !row.querySelector('.msg-deleted')
      );
      const ensureIndicator = (row, kind) => {
        let indicator = row.querySelector('.swipe-message-indicator');
        if (!indicator) {
          indicator = doc.createElement('div');
          row.appendChild(indicator);
        }
        indicator.className = `swipe-message-indicator swipe-${kind}-indicator`;
        indicator.textContent = kind === 'reply' ? '\u21A9' : '\u270E';
        return indicator;
      };
      const beginSwipe = ({ row, startX, startY, startedOnMedia = false, inputType = 'touch', pointerId = null }) => {
        swipe = {
          row,
          content: row.querySelector('.msg-content'),
          startX,
          startY,
          dx: 0,
          kind: null,
          locked: false,
          startedOnMedia,
          inputType,
          pointerId,
          keyboardOpenAtStart: (actions.shouldKeepComposerForMobileMessageInteraction || (() => false))(),
        };
      };
      const updateSwipe = ({ clientX, clientY, event = null }) => {
        if (!swipe) return;
        const rawDx = clientX - swipe.startX;
        const dy = clientY - swipe.startY;
        const absX = Math.abs(rawDx);
        const absY = Math.abs(dy);

        if (!swipe.locked) {
          if (absY > verticalCancelPx && absY > absX * 1.35) {
            finishSwipe(false);
            return;
          }
          if (absX < lockStartPx || absX < absY * 0.75) return;
          const kind = rawDx < 0 ? 'reply' : 'edit';
          if ((kind === 'reply' && !canReplyFromRow(swipe.row)) || (kind === 'edit' && !canEditMessage(swipe.row.__messageData))) {
            finishSwipe(false);
            return;
          }
          swipe.kind = kind;
          swipe.locked = true;
          (actions.suppressNextMessageActionTap || noop)();
          (actions.hideFloatingMessageActions || noop)({ immediate: true });
          ensureIndicator(swipe.row, kind);
          swipe.row.classList.add(`swipe-${kind}-active`);
          if (swipe.keyboardOpenAtStart) (actions.focusComposerKeepKeyboard || noop)(true);
        }

        if (event?.cancelable) event.preventDefault();
        swipe.dx = Math.min(absX, maxOffset);
        const offset = swipe.kind === 'reply' ? -swipe.dx : swipe.dx;
        if (swipe.content) swipe.content.style.transform = `translateX(${offset}px)`;
        swipe.row.classList.toggle(`swipe-${swipe.kind}-ready`, absX >= threshold);
      };
      const finishSwipe = (shouldApply) => {
        if (!swipe) return;
        const { row, content, kind, locked, startedOnMedia, keyboardOpenAtStart } = swipe;
        row.classList.remove('swipe-reply-active', 'swipe-reply-ready', 'swipe-edit-active', 'swipe-edit-ready');
        if (content) content.style.transform = '';
        const indicator = row.querySelector('.swipe-message-indicator');
        setTimeout(() => indicator?.remove(), 180);
        if (locked && startedOnMedia) suppressMediaClickAfterSwipe(row);
        if (shouldApply && kind) {
          (actions.safeVibrate || noop)(18);
          if (kind === 'reply') setReplyFromRow(row);
          else if (kind === 'edit') setEditFromRow(row);
        }
        if (keyboardOpenAtStart && locked) (actions.focusComposerKeepKeyboard || noop)(true);
        swipe = null;
      };

      messagesEl.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1 || isInteractiveTarget(e.target)) return;
        const row = e.target.closest('.msg-row');
        if (!row || row.dataset.outbox === '1' || row.querySelector('.msg-deleted')) return;
        const touch = e.touches[0];
        beginSwipe({
          row,
          startX: touch.clientX,
          startY: touch.clientY,
          startedOnMedia: Boolean(e.target.closest('.msg-image')),
          inputType: 'touch',
        });
      }, { passive: true });

      messagesEl.addEventListener('touchmove', (e) => {
        if (!isSwipeGestureActive('touch') || e.touches.length !== 1) return;
        const touch = e.touches[0];
        updateSwipe({ clientX: touch.clientX, clientY: touch.clientY, event: e });
      }, { passive: false });

      messagesEl.addEventListener('touchend', () => {
        if (!isSwipeGestureActive('touch')) return;
        finishSwipe(Boolean(swipe?.locked && swipe.dx >= threshold));
      }, { passive: true });
      messagesEl.addEventListener('touchcancel', () => {
        if (!isSwipeGestureActive('touch')) return;
        finishSwipe(false);
      }, { passive: true });

      messagesEl.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch' || !e.isPrimary || e.button !== 0 || isInteractiveTarget(e.target)) return;
        const row = e.target.closest('.msg-row');
        if (!row || row.dataset.outbox === '1' || row.querySelector('.msg-deleted')) return;
        beginSwipe({
          row,
          startX: e.clientX,
          startY: e.clientY,
          startedOnMedia: Boolean(e.target.closest('.msg-image')),
          inputType: 'pointer',
          pointerId: e.pointerId,
        });
      }, { passive: true });

      doc.addEventListener('pointermove', (e) => {
        if (!isSwipeGestureActive('pointer') || e.pointerId !== swipe.pointerId) return;
        updateSwipe({ clientX: e.clientX, clientY: e.clientY, event: e });
      }, { passive: false });

      doc.addEventListener('pointerup', (e) => {
        if (!isSwipeGestureActive('pointer') || e.pointerId !== swipe.pointerId) return;
        finishSwipe(Boolean(swipe?.locked && swipe.dx >= threshold));
      }, { passive: true });
      doc.addEventListener('pointercancel', (e) => {
        if (!isSwipeGestureActive('pointer') || e.pointerId !== swipe.pointerId) return;
        finishSwipe(false);
      }, { passive: true });
    }

    return {
      getReplyPreviewText,
      getReplyQuoteText,
      canEditMessage,
      canForwardMessage,
      canSaveMessageToNotes,
      getEditableText,
      getSelectedMessageFragment,
      isSelectableMessageTextTarget,
      getMessageCopyTextData,
      getMessageCopyText,
      copyMessageFromRow,
      getReplySnapshot,
      setReplyFromRow,
      setReply,
      clearReply,
      setEditFromRow,
      clearEdit,
      updateReplyPreview,
      setupMessageSwipeGestures,
    };
  }

  composerRoot.replyEdit = {
    createReplyEditController,
  };
})();
