(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const messagesRoot = root.messages = root.messages || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createMessageOutbox(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const renderer = objectOrDefault(opts.renderer);
    const messageState = objectOrDefault(opts.messageState);
    const api = typeof opts.api === 'function' ? opts.api : (() => Promise.resolve({}));
    const messagesEl = dom.messagesEl || doc.getElementById('messages');
    const getCurrentUser = typeof state.getCurrentUser === 'function' ? state.getCurrentUser : () => null;
    const getCurrentChatId = typeof state.getCurrentChatId === 'function' ? state.getCurrentChatId : () => null;

    function outboxUrlKey(clientId, part = 'file') {
      return `${clientId}:${part}`;
    }
    
    
    
    function getOutboxObjectUrl(clientId, blob, part = 'file') {
      if (!blob) return '';
      const key = outboxUrlKey(clientId, part);
      if (messageState.outboxObjectUrls.has(key)) return messageState.outboxObjectUrls.get(key);
      const url = URL.createObjectURL(blob);
      messageState.outboxObjectUrls.set(key, url);
      return url;
    }
    
    
    
    function revokeOutboxObjectUrls(clientId) {
      const prefix = `${clientId}:`;
      for (const [key, url] of messageState.outboxObjectUrls.entries()) {
        if (!key.startsWith(prefix)) continue;
        try { URL.revokeObjectURL(url); } catch (e) {}
        messageState.outboxObjectUrls.delete(key);
      }
    }
    
    
    
    function findOutboxRow(clientId) {
      if (!clientId) return null;
      return messagesEl.querySelector(`.msg-row[data-outbox="1"][data-client-id="${clientId}"], .msg-row[data-outbox="1"][data-msg-id="${clientId}"]`);
    }
    
    
    
    function removeDuplicatePromotedRows(row, messageId) {
      const key = String(messageId || '').trim();
      if (!key) return;
      messagesEl.querySelectorAll('.msg-row[data-msg-id]').forEach((candidate) => {
        if (String(candidate.dataset.msgId || '') !== key) return;
        if (candidate === row) return;
        messageState.forgetDisplayedMessage(candidate.dataset.msgId);
        candidate.remove();
      });
      cleanupEmptyMessageGroups();
    }
    
    
    
    function promoteOutboxRow(clientId, serverMsg, options = {}) {
      if (!clientId || !serverMsg?.id) return null;
      const row = findOutboxRow(clientId);
      if (!row) return null;
      const wasNearBottom = actions.isNearBottom();
      const anchor = !wasNearBottom && !actions.isNearBottom(8) ? actions.captureScrollAnchor() : null;
      const previousId = row.dataset.msgId || row.dataset.clientId || clientId;
      const showName = Boolean(row.querySelector('.msg-sender'));
      const prepared = renderer.withStableOutboxMedia(row, {
        ...serverMsg,
        client_id: serverMsg.client_id || clientId,
        client_status: null,
        is_outbox: false,
      });
    
      messageState.forgetDisplayedMessage(previousId);
      renderer.createMessageEl(prepared, showName, {
        ...options,
        reuseRow: row,
        entering: false,
      });
      delete row.__outboxItem;
      row.classList.remove('client-failed', 'client-sending');
      delete row.dataset.clientStatus;
      removeDuplicatePromotedRows(row, prepared.id);
      messageState.rememberDisplayedMessage(prepared.id);
      revokeOutboxObjectUrls(clientId);
      scheduleRetryLayout();
      actions.updateScrollBottomButton();
      if (anchor) requestAnimationFrame(() => actions.restoreScrollAnchor(anchor, 1));
      return row;
    }
    
    
    
    function cleanupEmptyMessageGroups() {
      messagesEl.querySelectorAll('.msg-group').forEach((group) => {
        if (!group.querySelector('.msg-row')) group.remove();
      });
    }
    
    
    
    function removeOutboxRows() {
      messagesEl.querySelectorAll('.msg-row[data-outbox="1"]').forEach((row) => {
        messageState.forgetDisplayedMessage(row.dataset.msgId);
        revokeOutboxObjectUrls(row.dataset.clientId || row.dataset.msgId);
        row.remove();
      });
      cleanupEmptyMessageGroups();
    }
    
    
    
    function buildLocalMessageFromOutbox(item) {
      const attachment = (item.attachments && item.attachments[0]) || null;
      const serverMeta = item.serverFileMeta || null;
      const isVoice = item.kind === 'voice';
      const isVideoNote = item.kind === 'video_note';
      const mediaNote = isVideoNote ? (item.videoNote || {}) : (item.voice || {});
      const fileBlob = (isVoice || isVideoNote) ? mediaNote.blob : attachment?.file;
      const posterBlob = isVideoNote ? (mediaNote.posterBlob || attachment?.posterBlob || null) : (attachment?.posterBlob || null);
      const localUrl = serverMeta?.stored_name ? '' : getOutboxObjectUrl(item.clientId, fileBlob, attachment?.localId || (isVideoNote ? 'video-note' : 'file'));
      const localPosterUrl = posterBlob ? getOutboxObjectUrl(item.clientId, posterBlob, `${attachment?.localId || (isVideoNote ? 'video-note' : 'file')}-poster`) : '';
      const fileName = serverMeta?.original_name || attachment?.name || mediaNote.name || (isVideoNote ? 'video-note.webm' : 'voice-note.wav');
      const fileSize = serverMeta?.size || attachment?.size || fileBlob?.size || 0;
      const fileMime = serverMeta?.mime_type || attachment?.mime || mediaNote.mime || (isVideoNote ? 'video/webm' : 'audio/wav');
      const fileType = serverMeta?.type || attachment?.type || (isVideoNote ? 'video' : (isVoice ? 'audio' : null));
      const hasPoster = Boolean(
        localPosterUrl
        || serverMeta?.poster_available
        || serverMeta?.posterAvailable
        || (fileType === 'video' && posterBlob)
      );
      const reply = item.reply || null;
    
      return {
        id: item.clientId,
        client_id: item.clientId,
        client_status: item.status || 'queued',
        is_outbox: true,
        chat_id: item.chatId,
        user_id: getCurrentUser().id,
        username: getCurrentUser().username,
        display_name: getCurrentUser().display_name,
        avatar_color: getCurrentUser().avatar_color,
        avatar_url: getCurrentUser().avatar_url,
        text: item.text || null,
        file_id: (attachment || isVoice || isVideoNote || serverMeta) ? (item.serverFileId || item.clientId) : null,
        file_name: fileName,
        file_stored: serverMeta?.stored_name || null,
        client_file_url: localUrl,
        client_poster_url: localPosterUrl,
        file_mime: fileMime,
        file_size: fileSize,
        file_type: fileType,
        file_poster_available: hasPoster,
        reply_to_id: item.replyToId || null,
        reply_display_name: reply?.display_name || null,
        reply_text: reply?.text || null,
        reply_is_voice_note: reply?.is_voice_note ? 1 : 0,
        reply_note_kind: reply?.is_video_note ? 'video_note' : (reply?.is_voice_note ? 'voice' : null),
        created_at: item.createdAt,
        is_read: false,
        reactions: [],
        previews: [],
        is_deleted: false,
        is_voice_note: isVoice || isVideoNote,
        is_video_note: isVideoNote,
        media_note_kind: isVideoNote ? 'video_note' : (isVoice ? 'voice' : null),
        voice_duration_ms: (isVoice || isVideoNote) ? mediaNote.durationMs : null,
        video_note_shape_id: isVideoNote ? mediaNote.shapeId || 'banana-fat' : null,
        video_note_shape_snapshot: isVideoNote ? mediaNote.shapeSnapshot || null : null,
        transcription_status: isVoice && item.autoTranscribe ? 'pending' : 'idle',
        transcription_text: '',
        transcription_provider: '',
        transcription_model: '',
        transcription_error: '',
        ai_response_mode_hint: item.aiResponseModeHint || null,
        ai_document_format_hint: item.aiDocumentFormatHint || null,
      };
    }
    
    
    
    function renderOutboxItem(item) {
      if (!item || Number(item.chatId) !== Number(getCurrentChatId())) return null;
      if (messageState.isMessageDisplayed(item.clientId)) return findOutboxRow(item.clientId);
      const localMsg = buildLocalMessageFromOutbox(item);
      renderer.appendMessage(localMsg);
      const row = findOutboxRow(item.clientId);
      if (row) {
        row.__outboxItem = item;
        row.__messageData = { ...(row.__messageData || {}), ...localMsg };
        renderer.updateRowStatus(row);
      }
      scheduleRetryLayout();
      return row;
    }
    
    
    
    async function renderOutboxForChat(chatId) {
      const id = Number(chatId || 0);
      if (!id || id !== Number(getCurrentChatId() || 0)) return;
      removeOutboxRows();
      const items = await window.messageCache?.readOutbox?.(id) || [];
      if (id !== Number(getCurrentChatId() || 0)) return;
      items
        .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
        .forEach((item) => renderOutboxItem(item));
      actions.updateScrollBottomButton();
    }
    
    
    
    function scheduleRetryLayout() {
      messageState.clearRetryLayoutTimer();
      messageState.setRetryLayoutTimer(setTimeout(() => requestAnimationFrame(layoutRetryButtons), 0));
    }
    
    
    
    function layoutRetryButtons() {
      if (!messagesEl) return;
      const containerRect = messagesEl.getBoundingClientRect();
      messagesEl.querySelectorAll('.msg-row[data-outbox="1"] .msg-retry-btn').forEach((btn) => {
        const row = btn.closest('.msg-row');
        const bubble = row?.querySelector('.msg-bubble') || btn.closest('.msg-bubble');
        if (!bubble) return;
        const bubbleRect = bubble.getBoundingClientRect();
        const retryWidth = btn.offsetWidth || 22;
        const useRightSide = Boolean(row?.classList.contains('own') && messagesEl.classList.contains('compact-view'));
        const shouldInline = useRightSide
          ? bubbleRect.right + retryWidth + 2 > containerRect.right - 2
          : bubbleRect.left - retryWidth - 2 < containerRect.left + 2;
        btn.classList.toggle('retry-side-right', useRightSide);
        btn.classList.toggle('retry-side-left', !useRightSide);
        bubble.classList.toggle('retry-inline', shouldInline);
        if (shouldInline) {
          const footer = bubble.querySelector('.msg-footer');
          let slot = footer?.querySelector('.msg-retry-slot');
          if (footer && !slot) {
            slot = document.createElement('span');
            slot.className = 'msg-retry-slot';
            const time = footer.querySelector('.msg-time');
            footer.insertBefore(slot, time || null);
          }
          if (slot) {
            if (btn.parentElement !== slot) slot.appendChild(btn);
          }
          btn.classList.add('inline');
        } else {
          const slot = bubble.querySelector('.msg-retry-slot');
          if (btn.parentElement !== bubble) bubble.appendChild(btn);
          if (slot && slot.childElementCount === 0) slot.remove();
          btn.classList.remove('inline');
        }
      });
    }
    
    
    
    async function persistOutboxItem(item) {
      item.status = item.status || 'queued';
      await window.messageCache?.upsertOutboxItem?.(item);
      const row = findOutboxRow(item.clientId);
      if (row) row.__outboxItem = item;
      return item;
    }
    
    
    
    function setOutboxSending(clientId, sending) {
      if (!clientId) return;
      if (sending) messageState.setOutboxSending(clientId, true);
      else messageState.setOutboxSending(clientId, false);
      const row = findOutboxRow(clientId);
      if (row) renderer.updateRowStatus(row);
    }
    
    
    
    async function uploadOutboxAttachment(item) {
      if (item.serverFileId) return item.serverFileId;
      const attachment = item.attachments && item.attachments[0];
      if (!attachment?.file) throw new Error('Attachment is not available locally');
      const fd = new FormData();
      fd.append('file', attachment.file, attachment.name || 'attachment');
      if (attachment.posterBlob) {
        fd.append('poster', attachment.posterBlob, 'video-poster.jpg');
      }
      const data = await api('/api/upload', { method: 'POST', body: fd });
      item.serverFileId = data.id;
      item.serverFileMeta = data;
      await persistOutboxItem(item);
      return data.id;
    }
    
    
    
    async function sendOutboxMessageItem(item) {
      const attachment = item.attachments && item.attachments[0];
      let fileId = item.serverFileId || null;
      if (attachment && !fileId) fileId = await uploadOutboxAttachment(item);
      return api(`/api/chats/${item.chatId}/messages`, {
        method: 'POST',
        body: {
          text: item.text || null,
          fileId: fileId || null,
          replyToId: item.replyToId || null,
          client_id: item.clientId,
          aiImageRiskAccepted: Boolean(item.aiImageRiskAccepted),
          ai_response_mode_hint: item.aiResponseModeHint || null,
          ai_document_format_hint: item.aiDocumentFormatHint || null,
        },
      });
    }
    
    
    
    async function sendOutboxVoiceItem(item) {
      const voice = item.voice || {};
      if (!voice.blob) throw new Error('Voice note is not available locally');
      const formData = new FormData();
      formData.append('file', voice.blob, voice.name || `voice-note-${Date.now()}.wav`);
      formData.append('durationMs', String(voice.durationMs || 0));
      formData.append('sampleRate', String(voice.sampleRate || 16000));
      formData.append('client_id', item.clientId);
      if (item.replyToId) formData.append('replyToId', String(item.replyToId));
      return api(`/api/chats/${item.chatId}/voice-message`, {
        method: 'POST',
        body: formData,
      });
    }
    
    
    
    async function sendOutboxVideoNoteItem(item) {
      const videoNote = item.videoNote || {};
      if (!videoNote.blob || !videoNote.audioBlob) throw new Error('Video note is not available locally');
      const normalizedVideoMime = String(videoNote.mime || 'video/webm').split(';')[0].trim().toLowerCase() || 'video/webm';
      const formData = new FormData();
      formData.append('video', videoNote.blob, videoNote.name || `video-note-${Date.now()}.webm`);
      formData.append('audio', videoNote.audioBlob, videoNote.audioName || `video-note-${Date.now()}.wav`);
      if (videoNote.posterBlob) {
        formData.append('poster', videoNote.posterBlob, 'video-note-poster.jpg');
      }
      formData.append('durationMs', String(videoNote.durationMs || 0));
      formData.append('sampleRate', String(videoNote.sampleRate || 16000));
      formData.append('videoMime', normalizedVideoMime);
      formData.append('client_id', item.clientId);
      formData.append('shapeId', String(videoNote.shapeId || 'banana-fat'));
      formData.append('shapeSnapshot', JSON.stringify(videoNote.shapeSnapshot || null));
      if (item.replyToId) formData.append('replyToId', String(item.replyToId));
      return api(`/api/chats/${item.chatId}/video-note`, {
        method: 'POST',
        body: formData,
      });
    }
    
    
    
    async function completeOutboxSend(item, serverMsg) {
      if (!serverMsg) return;
      await window.messageCache?.deleteOutboxItem?.(item.chatId, item.clientId);
      messageState.setOutboxSending(item.clientId, false);
      actions.applyOwnReadStateToMessage(serverMsg, item.chatId);
      try { window.messageCache?.upsertMessage?.(serverMsg).catch(()=>{}); } catch (e) {}
      actions.updateChatListLastMessage(serverMsg);
    
      const row = promoteOutboxRow(item.clientId, serverMsg, { mediaAutoScrollToBottom: true });
      const alreadyDisplayed = messageState.isMessageDisplayed(serverMsg.id);
      if (!row && Number(serverMsg.chat_id) === Number(getCurrentChatId()) && !alreadyDisplayed) {
        renderer.appendMessage(serverMsg, { mediaAutoScrollToBottom: true });
      }
      revokeOutboxObjectUrls(item.clientId);
      actions.updateScrollBottomButton();
      if (Number(serverMsg.chat_id) === Number(getCurrentChatId())) {
        requestAnimationFrame(() => {
          actions.scrollToBottom();
          requestAnimationFrame(() => actions.scrollToBottom());
        });
      }
    }
    
    
    
    async function trySendOutboxItem(rawItem) {
      const latest = await window.messageCache?.getOutboxItem?.(rawItem.chatId, rawItem.clientId);
      const item = latest || rawItem;
      if (!item?.clientId || messageState.isOutboxSending(item.clientId)) return;
      item.status = 'sending';
      await persistOutboxItem(item);
      setOutboxSending(item.clientId, true);
      try {
        const serverMsg = item.kind === 'voice'
          ? await sendOutboxVoiceItem(item)
          : item.kind === 'video_note'
            ? await sendOutboxVideoNoteItem(item)
            : await sendOutboxMessageItem(item);
        await completeOutboxSend(item, serverMsg);
      } catch (e) {
        item.status = 'failed';
        await persistOutboxItem(item);
      } finally {
        setOutboxSending(item.clientId, false);
      }
    }
    
    
    
    async function queueOutboxItem(item, { attempt = true } = {}) {
      await persistOutboxItem(item);
      renderOutboxItem(item);
      if (attempt) await trySendOutboxItem(item);
      return item;
    }
    
    
    
    function createMessageOutboxItem({
      text = null,
      attachment = null,
      reply = null,
      createdAt = null,
      aiImageRiskAccepted = false,
      aiResponseModeHint = null,
      aiDocumentFormatHint = null,
    } = {}) {
      const clientId = actions.makeClientId('c');
      return {
        clientId,
        chatId: getCurrentChatId(),
        userId: getCurrentUser().id,
        status: 'queued',
        kind: 'message',
        createdAt: createdAt || new Date().toISOString(),
        text: text || null,
        aiImageRiskAccepted: Boolean(aiImageRiskAccepted),
        aiResponseModeHint: aiResponseModeHint || null,
        aiDocumentFormatHint: aiDocumentFormatHint || null,
        replyToId: reply?.id || null,
        reply,
        attachments: attachment ? [attachment] : [],
        serverFileId: null,
        serverFileMeta: null,
      };
    }
    
    
    
    async function queueVoiceOutbox({ blob, durationMs, sampleRate, replyTo: suppliedReply, autoTranscribe = false } = {}) {
      if (!getCurrentChatId() || !blob) return null;
      const reply = suppliedReply ? actions.getReplySnapshot(suppliedReply) : actions.getReplySnapshot();
      const clientId = actions.makeClientId('c');
      const voiceName = `voice-note-${Date.now()}.wav`;
      const item = {
        clientId,
        chatId: getCurrentChatId(),
        userId: getCurrentUser().id,
        status: 'queued',
        kind: 'voice',
        autoTranscribe: Boolean(autoTranscribe),
        createdAt: new Date().toISOString(),
        text: null,
        replyToId: reply?.id || null,
        reply,
        attachments: [{
          localId: 'voice',
          file: blob,
          name: voiceName,
          size: blob.size || 0,
          mime: 'audio/wav',
          type: 'audio',
        }],
        voice: {
          blob,
          name: voiceName,
          durationMs,
          sampleRate,
          mime: 'audio/wav',
        },
      };
      actions.clearReply();
      await queueOutboxItem(item, { attempt: false });
      actions.playAppSound('send');
      actions.scrollToBottom();
      trySendOutboxItem(item);
      return item;
    }
    
    
    
    async function queueVideoNoteOutbox({
      videoBlob,
      audioBlob,
      posterBlob,
      durationMs,
      sampleRate,
      videoMime,
      shapeId,
      shapeSnapshot,
      replyTo: suppliedReply,
    } = {}) {
      if (!getCurrentChatId() || !videoBlob || !audioBlob) return null;
      const reply = suppliedReply ? actions.getReplySnapshot(suppliedReply) : actions.getReplySnapshot();
      const clientId = actions.makeClientId('c');
      const videoName = `video-note-${Date.now()}.webm`;
      const audioName = `video-note-${Date.now()}.wav`;
      const item = {
        clientId,
        chatId: getCurrentChatId(),
        userId: getCurrentUser().id,
        status: 'queued',
        kind: 'video_note',
        createdAt: new Date().toISOString(),
        text: null,
        replyToId: reply?.id || null,
        reply,
        attachments: [{
          localId: 'video-note',
          file: videoBlob,
          name: videoName,
          size: videoBlob.size || 0,
          mime: videoMime || 'video/webm',
          type: 'video',
          posterBlob: posterBlob || null,
        }],
        videoNote: {
          blob: videoBlob,
          audioBlob,
          posterBlob: posterBlob || null,
          name: videoName,
          audioName,
          durationMs,
          sampleRate,
          mime: videoMime || 'video/webm',
          shapeId: shapeId || 'banana-fat',
          shapeSnapshot: shapeSnapshot || null,
        },
      };
      actions.clearReply();
      await queueOutboxItem(item, { attempt: false });
      actions.playAppSound('send');
      actions.scrollToBottom();
      trySendOutboxItem(item);
      return item;
    }
    
    

    async function retrySend(row) {
      const clientId = row?.dataset.clientId || row?.dataset.msgId;
      const chatId = Number(row?.__messageData?.chat_id || row?.__messageData?.chatId || getCurrentChatId() || 0);
      if (!clientId || !chatId) return;
      const item = row.__outboxItem || await window.messageCache?.getOutboxItem?.(chatId, clientId);
      if (!item) return;
      await trySendOutboxItem(item);
    }

    return {
      outboxUrlKey,
      getOutboxObjectUrl,
      revokeOutboxObjectUrls,
      findOutboxRow,
      removeDuplicatePromotedRows,
      promoteOutboxRow,
      cleanupEmptyMessageGroups,
      removeOutboxRows,
      buildLocalMessageFromOutbox,
      renderOutboxItem,
      renderOutboxForChat,
      scheduleRetryLayout,
      layoutRetryButtons,
      persistOutboxItem,
      setOutboxSending,
      uploadOutboxAttachment,
      sendOutboxMessageItem,
      sendOutboxVoiceItem,
      sendOutboxVideoNoteItem,
      completeOutboxSend,
      trySendOutboxItem,
      retrySend,
      queueOutboxItem,
      createMessageOutboxItem,
      queueVoiceOutbox,
      queueVideoNoteOutbox,
    };
  }

  messagesRoot.outbox = {
    createMessageOutbox,
  };
})();
