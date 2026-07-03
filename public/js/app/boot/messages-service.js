(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function createMessagesService(ctx) {
    const appState = ctx?.state || {};
    const refs = {
      state: null,
      attachments: null,
      locations: null,
      polls: null,
      callCards: null,
      renderer: null,
      outbox: null,
      updates: null,
    };

    function configure(nextRefs = {}) {
      Object.keys(refs).forEach((key) => {
        if (nextRefs[key]) refs[key] = nextRefs[key];
      });
      return service;
    }

    function getMessages() {
      return appState.getMessages?.() || appState.messages || [];
    }

    function setMessages(messages) {
      return appState.setMessages?.(messages) || (appState.messages = Array.isArray(messages) ? messages : []);
    }

    function mergeMessages(messages, options = {}) {
      return appState.mergeMessages?.(messages, options) || getMessages();
    }

    function updateMessageInState(message) {
      if (!message?.id) return getMessages();
      const id = String(message.id);
      const list = getMessages();
      let found = false;
      const next = list.map((item) => {
        if (String(item?.id ?? '') !== id) return item;
        found = true;
        return { ...item, ...message };
      });
      if (!found) next.push(message);
      return setMessages(next);
    }

    function markMessageDeletedInState(messageId, chatId) {
      const id = String(messageId ?? '');
      if (!id) return getMessages();
      const targetChatId = Number(chatId || appState.getCurrentChatId?.() || appState.currentChatId || 0);
      return setMessages(getMessages().map((item) => {
        if (String(item?.id ?? '') !== id) return item;
        return {
          ...item,
          chat_id: Number(item.chat_id || item.chatId || targetChatId || 0),
          is_deleted: true,
          text: 'Message deleted',
          file_id: null,
          file_name: null,
          file_stored: null,
          file_type: null,
          location: null,
          is_location: false,
          reactions: [],
          poll: null,
        };
      }));
    }

    function call(refName, method, ...args) {
      return refs[refName]?.[method]?.(...args);
    }

    function replaceRenderedMessages(messages = [], pinEvents = [], systemEvents = [], options = {}) {
      const result = call('renderer', 'replaceRenderedMessages', messages, pinEvents, systemEvents, options);
      setMessages(Array.isArray(messages) ? messages : []);
      return result;
    }

    function renderMessages(messages = [], pinEvents = [], systemEvents = []) {
      const result = call('renderer', 'renderMessages', messages, pinEvents, systemEvents);
      mergeMessages(messages, { prepend: true });
      return result;
    }

    function appendTimelineItems(messages = [], pinEvents = [], systemEvents = [], options = {}) {
      const result = call('renderer', 'appendTimelineItems', messages, pinEvents, systemEvents, options);
      mergeMessages(messages);
      return result;
    }

    function appendMessage(message, options = {}) {
      const result = call('renderer', 'appendMessage', message, options);
      if (message) mergeMessages([message]);
      return result;
    }

    function applyMessageUpdate(message, options = {}) {
      const result = call('updates', 'applyMessageUpdate', message, options);
      if (message?.id) updateMessageInState(message);
      return result;
    }

    function markMessageDeleted(messageId, chatId) {
      const result = call('updates', 'markMessageDeleted', messageId, chatId);
      markMessageDeletedInState(messageId, chatId);
      return result;
    }

    function deleteMessage(messageId) {
      return Promise.resolve(call('updates', 'deleteMessage', messageId)).then((result) => {
        const row = document.querySelector(`.msg-row[data-msg-id="${messageId}"]`);
        if (row?.__messageData?.is_deleted) markMessageDeletedInState(messageId, row.__messageData.chat_id || row.__messageData.chatId);
        return result;
      });
    }

    function completeOutboxSend(item, serverMessage) {
      return Promise.resolve(call('outbox', 'completeOutboxSend', item, serverMessage)).then((result) => {
        if (serverMessage?.id) updateMessageInState(serverMessage);
        return result;
      });
    }

    function updateVisibleOwnReadStateRows(chatId, threshold) {
      const id = Number(chatId || 0);
      if (!id || id !== Number(appState.getCurrentChatId?.() || appState.currentChatId || 0) || threshold == null) return;
      document.querySelectorAll('#messages .msg-row.own').forEach((row) => {
        const msgId = Number(row.dataset.msgId || 0);
        const statusEl = row.querySelector('.msg-status');
        if (!msgId || !statusEl) return;
        const isRead = msgId <= threshold;
        statusEl.classList.toggle('read', isRead);
        statusEl.textContent = isRead ? '\u2713\u2713' : '\u2713';
        if (row.__messageData) row.__messageData.is_read = isRead ? 1 : 0;
        if (row.__messageData?.id) updateMessageInState(row.__messageData);
      });
    }

    const service = {
      configure,
      get state() { return refs.state; },
      get attachments() { return refs.attachments; },
      get locations() { return refs.locations; },
      get polls() { return refs.polls; },
      get callCards() { return refs.callCards; },
      get render() { return refs.renderer; },
      get renderer() { return refs.renderer; },
      get outbox() { return refs.outbox; },
      get updates() { return refs.updates; },
      getMessages,
      setMessages,
      mergeMessages,
      updateMessageInState,
      markMessageDeletedInState,
      replaceRenderedMessages,
      renderMessages,
      appendTimelineItems,
      appendMessage,
      applyMessageUpdate,
      markMessageDeleted,
      deleteMessage,
      completeOutboxSend,
      updateVisibleOwnReadStateRows,
    };

    [
      ['renderer', ['clearRenderedMessages', 'getRenderedMessageIdList', 'renderedMessageIdsMatch', 'resetReusableMessageRow', 'pinEventIdKey', 'rememberPinEvent', 'isPinEventDisplayed', 'systemEventIdKey', 'rememberSystemEvent', 'isSystemEventDisplayed', 'filterNewPinEvents', 'filterNewSystemEvents', 'timelineTimestamp', 'buildTimelineItems', 'renderPinSystemEvent', 'renderChatSystemEvent', 'buildMessagesFragment', 'primeAppendedMessageSideEffects', 'appendPinEventIfVisible', 'appendSystemEventIfVisible', 'isCurrentMessageRow', 'messageHasDeferredMediaLayout', 'clearPendingMediaBottomScroll', 'noteMessageScrollUserIntent', 'scheduleMediaBottomScrollAnchorSave', 'settleDeferredMediaBottomScroll', 'markPendingMediaBottomScroll', 'markPendingMediaBottomScrollForMessages', 'cancelPendingMediaBottomScrollIfNeeded', 'createMessageGroup', 'createMessageEl', 'replaceRenderedMessage', 'withStableOutboxMedia', 'updateRowStatus', 'cleanupDuplicateDateSeparators', 'refreshDateSeparators']],
      ['attachments', ['renderResolvedFileAttachment', 'renderFileAttachment', 'renderLinkPreview', 'formatDuration', 'ensureAttachmentPoster', 'applyPosterToVideoElement', 'markAttachmentPosterAvailable']],
      ['polls', ['normalizePoll', 'isPollMessage', 'isPulsePoll', 'pulseInlineVotersCacheKey', 'getPulseInlineVotersRevision', 'invalidatePulseInlineVotersForMessage', 'getPulseVoterDisplayName', 'isPulseVoterOptionExpanded', 'getPulseVoterPopoverElement', 'schedulePulseVoterPopoverAutoHide', 'mountPulseVoterPopover', 'bindPollControls', 'bindPulseInlineVoterControls', 'togglePulseVoterOptionExpanded', 'togglePulseVoterPopover', 'getPollCompactFooterMeta', 'canClosePollMessage', 'buildOptimisticPollState', 'nextPollVoteSelection', 'hydratePulseInlineVoters', 'clearActivePulseVoterPopover', 'clearActivePulseVoterPopoverForMessage', 'resetPollVotersModal', 'openPollVotersModal', 'renderPollCard', 'pollAccentVar', 'buildPollRenderState', 'buildPollOrbitGradient', 'renderPollCloseButton', 'renderPollCompactFooter', 'renderPollVotersButton', 'renderPulseInlineVoterAvatar', 'renderPulseInlineVoterStack', 'buildPulsePreviewVoters', 'renderPulseInlineVoterSummaryContent', 'renderPulseInlineVoterSummary', 'refreshPulseInlineVoterSlots', 'ensurePulseInlineVoters', 'renderPulsePollCard', 'renderStackPollCard', 'renderOrbitPollCard', 'applyPollUpdate', 'replaceRenderedPollCard', 'togglePollVote', 'closePollMessage']],
      ['callCards', ['resolveCallMessageMediaKind', 'resolveCallMessageRoomMode', 'normalizeCallMessageData', 'latestCallTranscriptRun', 'latestCallArtifactBatch', 'callArtifactProgress', 'pushCallMessageMeta', 'renderCallMessageMeta', 'normalizeCallMixedRecording', 'callRecordingPlaybackUrl', 'callRecordingDurationSeconds', 'parseCallRecordingRadiusValue', 'callRecordingRoundedRectPath', 'ensureCallRecordingFooterButton', 'ensureCallRecordingProgress', 'refreshCallRecordingProgressShape', 'updateCallRecordingProgress', 'syncCallRecordingPlayButton', 'pointToCallRecordingHit', 'shouldIgnoreCallRecordingPointer', 'isPointerNearCallRecordingProgressRect', 'getCallRecordingSeekRows', 'seekCallRecordingProgress', 'resolveNearestCallRecordingHit', 'installCallRecordingProgressCapture', 'renderCallMessageCard', 'renderCallTranscriptRunCard', 'callArtifactStatusLabel', 'callArtifactStatusKind', 'callArtifactKey', 'callArtifactLabel', 'renderCallArtifactStatus', 'callArtifactTextShouldCollapse', 'renderCallArtifactTextLine', 'renderCallArtifactText', 'callArtifactImageUrl', 'callArtifactImageMime', 'callArtifactImageFilename', 'callArtifactImageContext', 'renderCallArtifactImage', 'renderCallArtifactRun', 'renderCallArtifactBatchCard', 'bindCallMessageControls', 'openCallArtifactsModal', 'bindCallArtifactMessageControls', 'bindCallTranscriptMessageControls']],
      ['outbox', ['outboxUrlKey', 'getOutboxObjectUrl', 'revokeOutboxObjectUrls', 'findOutboxRow', 'removeDuplicatePromotedRows', 'promoteOutboxRow', 'cleanupEmptyMessageGroups', 'removeOutboxRows', 'buildLocalMessageFromOutbox', 'renderOutboxItem', 'renderOutboxForChat', 'scheduleRetryLayout', 'layoutRetryButtons', 'persistOutboxItem', 'setOutboxSending', 'uploadOutboxAttachment', 'sendOutboxMessageItem', 'sendOutboxVoiceItem', 'sendOutboxVideoNoteItem', 'trySendOutboxItem', 'retrySend', 'queueOutboxItem', 'createMessageOutboxItem', 'queueLocationOutbox', 'queueVoiceOutbox', 'queueVideoNoteOutbox']],
      ['updates', ['updateVisibleReplyQuotesFromMessage']],
    ].forEach(([refName, methods]) => {
      methods.forEach((method) => {
        if (service[method]) return;
        service[method] = (...args) => call(refName, method, ...args);
      });
    });

    return service;
  }

  bootRoot.createMessagesService = createMessagesService;
})();
