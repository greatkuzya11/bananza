(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const messagesRoot = root.messages = root.messages || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createMessageRenderer(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const formatters = objectOrDefault(opts.formatters || root.formatters);
    const attachmentHelpers = objectOrDefault(opts.attachmentHelpers || root.attachments);
    const attachmentRenderer = objectOrDefault(opts.attachmentRenderer);
    const pollRenderer = objectOrDefault(opts.pollRenderer);
    const callCardRenderer = objectOrDefault(opts.callCardRenderer);
    const messageState = objectOrDefault(opts.messageState);
    const t = typeof opts.t === 'function' ? opts.t : (key) => String(key || '');
    const esc = typeof opts.esc === 'function' ? opts.esc : (typeof formatters.esc === 'function' ? formatters.esc : (value) => String(value ?? ''));
    const formatDate = typeof opts.formatDate === 'function' ? opts.formatDate : (typeof formatters.formatDate === 'function' ? formatters.formatDate : (value) => String(value || ''));
    const formatTime = typeof opts.formatTime === 'function' ? opts.formatTime : (typeof formatters.formatTime === 'function' ? formatters.formatTime : (value) => String(value || ''));
    const messagesEl = dom.messagesEl || doc.getElementById('messages');
    const getCurrentUser = typeof state.getCurrentUser === 'function' ? state.getCurrentUser : () => null;
    const getCurrentChatId = typeof state.getCurrentChatId === 'function' ? state.getCurrentChatId : () => null;
    const isCompactView = typeof state.isCompactView === 'function' ? state.isCompactView : () => false;
    const contextConvertPendingMessageIds = state.contextConvertPendingMessageIds || new Set();
    const contextOriginalRestorePendingMessageIds = state.contextOriginalRestorePendingMessageIds || new Set();
    const grokImageRiskRetryPending = state.grokImageRiskRetryPending || new Set();
    const rememberDisplayedMessage = (...args) => messageState.rememberDisplayedMessage?.(...args);
    const forgetDisplayedMessage = (...args) => messageState.forgetDisplayedMessage?.(...args);
    const isMessageDisplayed = (...args) => Boolean(messageState.isMessageDisplayed?.(...args));
    const setLoadMoreAfterLoading = (...args) => actions.setLoadMoreAfterLoading?.(...args);
    const hideScrollDateIndicator = (...args) => actions.hideScrollDateIndicator?.(...args);
    const buildMessagesRootChildren = (...args) => actions.buildMessagesRootChildren?.(...args) || [];
    const normalizePinEvents = (...args) => actions.normalizePinEvents?.(...args) || [];
    const normalizePinEvent = (...args) => actions.normalizePinEvent?.(...args);
    const jumpToPinnedMessage = (...args) => actions.jumpToPinnedMessage?.(...args);
    const filterNewMessages = (...args) => actions.filterNewMessages?.(...args) || [];
    const insertAtMessagesEnd = (...args) => actions.insertAtMessagesEnd?.(...args);
    const getMessagesLastContentChild = (...args) => actions.getMessagesLastContentChild?.(...args);
    const updateScrollBottomButton = (...args) => actions.updateScrollBottomButton?.(...args);
    const refreshScrollDateIndicator = (...args) => actions.refreshScrollDateIndicator?.(...args);
    const getRenderedMessageRows = (...args) => actions.getRenderedMessageRows?.(...args) || [];
    const updateHasMoreAfterFromChat = (...args) => actions.updateHasMoreAfterFromChat?.(...args);
    const setAvatarElementVisual = (...args) => actions.setAvatarElementVisual?.(...args);
    const applyOwnReadStateToMessage = (...args) => actions.applyOwnReadStateToMessage?.(...args);
    const isClientSideMessage = (...args) => Boolean(actions.isClientSideMessage?.(...args));
    const isSingleEmojiMessage = (...args) => Boolean(actions.isSingleEmojiMessage?.(...args));
    const isSingleCustomEmojiMessage = (...args) => Boolean(actions.isSingleCustomEmojiMessage?.(...args));
    const renderCustomEmojiHtml = (...args) => actions.renderCustomEmojiHtml?.(...args) || '';
    const canContextConvertMessage = (...args) => Boolean(actions.canContextConvertMessage?.(...args));
    const canRestoreContextOriginalMessage = (...args) => Boolean(actions.canRestoreContextOriginalMessage?.(...args));
    const canSaveMessageToNotes = (...args) => Boolean(actions.canSaveMessageToNotes?.(...args));
    const canForwardMessage = (...args) => Boolean(actions.canForwardMessage?.(...args));
    const canEditMessage = (...args) => Boolean(actions.canEditMessage?.(...args));
    const getReplyPreviewText = (...args) => actions.getReplyPreviewText?.(...args) || '';
    const getReplyQuoteText = (...args) => actions.getReplyQuoteText?.(...args) || '';
    const renderMessageText = (...args) => actions.renderMessageText?.(...args) || '';
    const renderReactions = (...args) => actions.renderReactions?.(...args) || '';
    const renderPinActionButton = (...args) => actions.renderPinActionButton?.(...args) || '';
    const deleteMessage = (...args) => actions.deleteMessage?.(...args);
    const bindTouchSafeButtonActivation = (...args) => actions.bindTouchSafeButtonActivation?.(...args);
    const setReplyFromRow = (...args) => actions.setReplyFromRow?.(...args);
    const copyMessageFromRow = (...args) => actions.copyMessageFromRow?.(...args);
    const setEditFromRow = (...args) => actions.setEditFromRow?.(...args);
    const bindContextConvertMessageButton = (...args) => actions.bindContextConvertMessageButton?.(...args);
    const bindContextOriginalRestoreButton = (...args) => actions.bindContextOriginalRestoreButton?.(...args);
    const showReactionPicker = (...args) => actions.showReactionPicker?.(...args);
    const openForwardMessageModal = (...args) => actions.openForwardMessageModal?.(...args);
    const saveMessageToNotes = (...args) => actions.saveMessageToNotes?.(...args);
    const togglePinFromRow = (...args) => actions.togglePinFromRow?.(...args);
    const retryGrokImageRiskPrompt = (...args) => actions.retryGrokImageRiskPrompt?.(...args);
    const handleMentionClick = (...args) => actions.handleMentionClick?.(...args);
    const scrollToMessage = (...args) => actions.scrollToMessage?.(...args);
    const jumpToSavedOriginal = (...args) => actions.jumpToSavedOriginal?.(...args);
    const isMobileComposerKeyboardOpen = (...args) => Boolean(actions.isMobileComposerKeyboardOpen?.(...args));
    const openImageViewer = (...args) => actions.openImageViewer?.(...args);
    const openMediaViewer = (...args) => actions.openMediaViewer?.(...args);
    const bindMediaPlaybackState = (...args) => actions.bindMediaPlaybackState?.(...args);
    const isNearBottom = (...args) => Boolean(actions.isNearBottom?.(...args));
    const captureScrollAnchor = (...args) => actions.captureScrollAnchor?.(...args);
    const restoreScrollAnchor = (...args) => actions.restoreScrollAnchor?.(...args);
    const saveCurrentScrollAnchor = (...args) => actions.saveCurrentScrollAnchor?.(...args);
    const scrollToBottom = (...args) => actions.scrollToBottom?.(...args);

    function resetReusableMessageRow(row) {
      if (!row) return;
      row.querySelectorAll('audio, video').forEach((media) => {
        try { media.pause?.(); } catch (e) {}
      });
      Array.from(row.attributes).forEach((attr) => {
        if (attr.name === 'class') return;
        row.removeAttribute(attr.name);
      });
      row.className = '';
      delete row.__messageData;
      delete row.__replyPayload;
      delete row.__voiceBootstrap;
      delete row.__voiceMessage;
      delete row.__outboxItem;
      delete row.__callRecordingProgress;
      delete row.__callRecordingCall;
      delete row.__autoScrollMediaToBottomOnLoad;
    }
    
    
    
    function withStableOutboxMedia(row, nextMsg) {
      const previous = row?.__messageData || {};
      const prepared = { ...(nextMsg || {}) };
      if (previous.client_file_url && !prepared.client_file_url && !prepared.file_stored) {
        prepared.client_file_url = previous.client_file_url;
      }
      if (previous.client_poster_url && !prepared.client_poster_url && !prepared.file_poster_available) {
        prepared.client_poster_url = previous.client_poster_url;
      }
      return prepared;
    }
    
    
    
    function replaceRenderedMessage(nextMsg, options = {}) {
      if (!nextMsg?.id) return false;
      const row = messagesEl.querySelector(`[data-msg-id="${nextMsg.id}"]`);
      if (!row) return false;
      const preserveAnchor = options.preserveAnchor?.messageId ? { ...options.preserveAnchor } : null;
      const restoreAttempts = Number(options.restoreAttempts || 2);
      const prepared = withStableOutboxMedia(row, nextMsg);
      if (row.querySelector('.msg-status.read')) prepared.is_read = true;
      const showName = Boolean(row.querySelector('.msg-sender'));
      createMessageEl(prepared, showName, { ...options, reuseRow: row, entering: false });
      rememberDisplayedMessage(prepared.id);
      if (preserveAnchor) {
        requestAnimationFrame(() => restoreScrollAnchor(preserveAnchor, restoreAttempts));
      }
      updateScrollBottomButton();
      return true;
    }
    
    
    
    function clearRenderedMessages({ resetDisplayed = true } = {}) {
      setLoadMoreAfterLoading(false);
      hideScrollDateIndicator({ immediate: true });
      messagesEl.replaceChildren(...buildMessagesRootChildren());
      if (resetDisplayed) {
        messageState.clearDisplayedMessages();
        messageState.clearDisplayedPinEvents();
      }
    }
    
    
    
    function getRenderedMessageIdList() {
      return Array.from(messagesEl.querySelectorAll('.msg-row[data-msg-id]'))
        .filter((row) => row.dataset.outbox !== '1')
        .map((row) => Number(row.dataset.msgId || 0));
    }
    
    
    
    function renderedMessageIdsMatch(msgs = []) {
      const domIds = getRenderedMessageIdList();
      const nextIds = (Array.isArray(msgs) ? msgs : []).map((msg) => Number(msg?.id || 0));
      return domIds.length > 0
        && domIds.length === nextIds.length
        && domIds.every((id, index) => id === nextIds[index]);
    }
    
    
    
    function pinEventIdKey(id) {
      const key = String(id ?? '').trim();
      return key || '';
    }
    
    
    
    function rememberPinEvent(id) {
      const key = pinEventIdKey(id);
      if (key) messageState.rememberDisplayedPinEvent(key);
    }
    
    
    
    function isPinEventDisplayed(id) {
      const key = pinEventIdKey(id);
      return key ? messageState.isPinEventDisplayed(key) : false;
    }
    
    
    
    function filterNewPinEvents(events = []) {
      const seen = new Set();
      return normalizePinEvents(events).filter((event) => {
        const key = pinEventIdKey(event.id);
        if (!key || seen.has(key) || isPinEventDisplayed(key)) return false;
        seen.add(key);
        return true;
      });
    }
    
    
    
    function timelineTimestamp(item) {
      const value = item?.created_at || item?.createdAt || '';
      const time = value ? Date.parse(/[zZ]$|[+\-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`) : NaN;
      return Number.isFinite(time) ? time : 0;
    }
    
    
    
    function buildTimelineItems(msgs = [], pinEvents = []) {
      return [
        ...(Array.isArray(msgs) ? msgs : []).map((message) => ({ kind: 'message', message, created_at: message?.created_at })),
        ...normalizePinEvents(pinEvents).map((event) => ({ kind: 'pin-event', event, created_at: event.created_at })),
      ].sort((a, b) => {
        const byTime = timelineTimestamp(a) - timelineTimestamp(b);
        if (byTime) return byTime;
        if (a.kind !== b.kind) return a.kind === 'message' ? -1 : 1;
        const aId = Number(a.message?.id || a.event?.id || 0);
        const bId = Number(b.message?.id || b.event?.id || 0);
        return aId - bId;
      });
    }
    
    
    
    function renderPinSystemEvent(event) {
      const item = normalizePinEvent(event);
      if (!item || item.action !== 'pinned') return null;
      const row = document.createElement('div');
      row.className = 'pin-system-row';
      row.dataset.pinEventId = String(item.id);
      row.dataset.pinMessageId = String(item.message_id);
      row.dataset.chatId = String(item.chat_id);
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.title = t('Jump to pinned message');
      const actor = String(item.actor_name || t('Someone')).trim() || t('Someone');
      const preview = String(item.message_preview || t('Pinned message')).trim() || t('Pinned message');
      row.innerHTML = `
        <span class="pin-system-icon" aria-hidden="true">&#128204;</span>
        <span class="pin-system-copy">${esc(t('{name} pinned: {preview}', { name: actor, preview }))}</span>
      `;
      const jump = () => jumpToPinnedMessage({ chat_id: item.chat_id, message_id: item.message_id });
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        jump();
      });
      row.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        jump();
      });
      return row;
    }
    
    
    
    function buildMessagesFragment(msgs = [], pinEvents = [], options = {}) {
      const fragment = document.createDocumentFragment();
      let lastDate = null;
      let currentGroupBody = null;
      const items = buildTimelineItems(msgs, pinEvents);
    
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const createdAt = item.created_at;
        const msgDate = formatDate(createdAt);
        if (msgDate !== lastDate) {
          lastDate = msgDate;
          currentGroupBody = null;
          const sep = document.createElement('div');
          sep.className = 'date-separator';
          sep.dataset.dateIso = createdAt || '';
          sep.innerHTML = `<span>${msgDate}</span>`;
          fragment.appendChild(sep);
        }
    
        if (item.kind === 'pin-event') {
          if (isPinEventDisplayed(item.event?.id)) continue;
          const systemRow = renderPinSystemEvent(item.event);
          if (!systemRow) continue;
          currentGroupBody = null;
          fragment.appendChild(systemRow);
          rememberPinEvent(item.event.id);
          continue;
        }
    
        const msg = item.message;
        if (isMessageDisplayed(msg?.id)) continue;
        const prevMessageItem = [...items.slice(0, i)].reverse().find((entry) => entry.kind === 'message');
        const prevMsg = prevMessageItem?.message || null;
        const sameUser = prevMsg && prevMsg.user_id === msg.user_id && formatDate(prevMsg.created_at) === msgDate;
        const isOwn = msg.user_id === getCurrentUser().id;
        const useGroup = !isOwn || isCompactView();
        const startsGroup = useGroup && (!sameUser || !currentGroupBody);
    
        if (startsGroup) {
          const { group, body } = createMessageGroup(msg, isOwn);
          currentGroupBody = body;
          fragment.appendChild(group);
        }
    
        const showName = useGroup && startsGroup;
        const el = createMessageEl(msg, showName, options);
        if (useGroup) {
          currentGroupBody.appendChild(el);
        } else {
          currentGroupBody = null;
          fragment.appendChild(el);
        }
        rememberDisplayedMessage(msg.id);
      }
    
      return fragment;
    }
    
    
    
    function replaceRenderedMessages(msgs = [], pinEvents = [], options = {}) {
      messageState.clearDisplayedMessages();
      messageState.clearDisplayedPinEvents();
      messageState.clearPendingMediaBottomScrollRows();
      const fragment = buildMessagesFragment(Array.isArray(msgs) ? msgs : [], pinEvents, options);
      messagesEl.replaceChildren(...buildMessagesRootChildren(fragment));
      updateScrollBottomButton();
      refreshScrollDateIndicator();
    }
    
    
    
    function primeAppendedMessageSideEffects(messages = []) {
      const list = Array.isArray(messages) ? messages : [];
      list.forEach((msg) => {
        try {
          if (window.messageCache) window.messageCache.upsertMessage(msg).catch(()=>{});
        } catch (e) {}
        try {
          if (msg?.file_type === 'image' && msg.file_stored && window.cacheAssets) {
            window.cacheAssets([attachmentHelpers.getAttachmentPreviewUrl(msg)]).catch(()=>{});
          }
        } catch (e) {}
      });
      if (!actions.isLoadingMoreAfter() && list.length) updateHasMoreAfterFromChat(getCurrentChatId());
    }
    
    
    
    function appendTimelineItems(msgs = [], pinEvents = [], options = {}) {
      const messages = filterNewMessages(msgs);
      const events = filterNewPinEvents(pinEvents);
      if (!events.length) {
        messages.forEach((message) => appendMessage(message, options));
        return;
      }
      const fragment = buildMessagesFragment(messages, events, { ...options, entering: options.entering !== false });
      if (fragment.childNodes.length) {
        insertAtMessagesEnd(fragment);
        markPendingMediaBottomScrollForMessages(messages, Boolean(options.mediaAutoScrollToBottom));
        primeAppendedMessageSideEffects(messages);
        cleanupDuplicateDateSeparators();
        updateScrollBottomButton();
        refreshScrollDateIndicator();
      }
    }
    
    
    
    function appendPinEventIfVisible(event) {
      const item = normalizePinEvent(event);
      if (!item || item.action !== 'pinned' || Number(item.chat_id || 0) !== Number(getCurrentChatId() || 0)) return false;
      const wasNearBottom = isNearBottom(120);
      const anchor = wasNearBottom ? null : captureScrollAnchor();
      appendTimelineItems([], [item]);
      if (wasNearBottom) {
        scrollToBottom(false, true);
      } else if (anchor?.messageId) {
        requestAnimationFrame(() => restoreScrollAnchor(anchor, 1));
        saveCurrentScrollAnchor(getCurrentChatId(), { force: true });
      }
      return true;
    }
    
    
    
    function isCurrentMessageRow(row) {
      if (!row?.isConnected) return false;
      const rowChatId = Number(row.__messageData?.chat_id || row.__messageData?.chatId || getCurrentChatId() || 0);
      return !rowChatId || rowChatId === Number(getCurrentChatId() || 0);
    }
    
    
    
    function messageHasDeferredMediaLayout(msg) {
      if (!msg || Boolean(msg.is_video_note)) return false;
      return msg.file_type === 'image' || msg.file_type === 'video';
    }
    
    
    
    function clearPendingMediaBottomScroll(row) {
      if (!row) return;
      row.__autoScrollMediaToBottomOnLoad = false;
      messageState.clearPendingMediaBottomScroll(row);
    }
    
    
    
    function noteMessageScrollUserIntent() {
      messageState.noteMediaBottomAutoScrollUserIntent();
    }
    
    
    
    function scheduleMediaBottomScrollAnchorSave(chatId = getCurrentChatId()) {
      const targetChatId = Number(chatId || getCurrentChatId() || 0);
      if (!targetChatId) return;
      requestAnimationFrame(() => {
        if (messageState.pendingMediaBottomScrollRows.size) return;
        saveCurrentScrollAnchor(targetChatId, { force: true, allowPendingMedia: true });
      });
    }
    
    
    
    function settleDeferredMediaBottomScroll(chatId = getCurrentChatId()) {
      const targetChatId = Number(chatId || getCurrentChatId() || 0);
      if (!targetChatId) return;
      const guardOptions = { chatId: targetChatId };
      scrollToBottom(true, true, guardOptions);
      requestAnimationFrame(() => {
        scrollToBottom(true, true, guardOptions);
        setTimeout(() => {
          if (Number(getCurrentChatId() || 0) !== targetChatId) return;
          scrollToBottom(true, true, guardOptions);
          if (!messageState.pendingMediaBottomScrollRows.size) {
            saveCurrentScrollAnchor(targetChatId, { force: true, allowPendingMedia: true });
          }
        }, 80);
      });
    }
    
    
    
    function markPendingMediaBottomScroll(row, msg, enabled = false) {
      clearPendingMediaBottomScroll(row);
      if (!enabled || !messageHasDeferredMediaLayout(msg)) return;
      row.__autoScrollMediaToBottomOnLoad = true;
      messageState.markPendingMediaBottomScroll(row);
    }
    
    
    
    function markPendingMediaBottomScrollForMessages(messages = [], enabled = false) {
      if (!enabled) return;
      const list = Array.isArray(messages) ? messages : [];
      list.forEach((msg) => {
        if (!messageHasDeferredMediaLayout(msg)) return;
        const row = messagesEl.querySelector(`.msg-row[data-msg-id="${Number(msg.id || 0)}"]`);
        if (row) markPendingMediaBottomScroll(row, msg, true);
      });
    }
    
    
    
    function cancelPendingMediaBottomScrollIfNeeded() {
      if (!messageState.pendingMediaBottomScrollRows.size || isNearBottom(8)) return;
      if (Date.now() - messageState.getMediaBottomAutoScrollUserIntentAt() > 450) return;
      for (const row of messageState.getPendingMediaBottomScrollRows()) {
        clearPendingMediaBottomScroll(row);
      }
      scheduleMediaBottomScrollAnchorSave();
    }
    
    
    
    function createMessageGroup(msg, isOwn) {
      const group = document.createElement('div');
      group.className = 'msg-group';
      group.dataset.userId = msg.user_id;
      const isChatShotMessage = String(msg.ai_bot_kind || '').toLowerCase() === 'chatshot';
      const avatarColor = isOwn ? (getCurrentUser().avatar_color || '#65aadd') : (msg.avatar_color || '#65aadd');
      const avatarUrl = isChatShotMessage ? '' : (isOwn ? getCurrentUser().avatar_url : msg.avatar_url);
      const name = isChatShotMessage ? 'chatShot' : (isOwn ? getCurrentUser().display_name : msg.display_name);
      const isAiBot = !isOwn && (Number(msg.is_ai_bot) !== 0 || Number(msg.ai_bot_id) > 0 || Number(msg.ai_generated) > 0);
      const mentionToken = isAiBot ? (msg.ai_bot_mention || msg.username) : (isOwn ? getCurrentUser().username : msg.username);
      const avatar = document.createElement('div');
      avatar.className = 'msg-group-avatar';
      avatar.setAttribute('role', 'button');
      avatar.tabIndex = 0;
      avatar.title = name || '';
      avatar.dataset.userId = String(Number(msg.user_id) || 0);
      avatar.dataset.displayName = name || '';
      avatar.dataset.mentionToken = mentionToken || '';
      avatar.dataset.isAiBot = isAiBot ? '1' : '0';
      setAvatarElementVisual(avatar, {
        name: name || '',
        color: avatarColor,
        avatarUrl: avatarUrl || '',
        fallbackText: isChatShotMessage ? '\ud83c\udf4c' : '',
      });
      group.appendChild(avatar);
      const body = document.createElement('div');
      body.className = 'msg-group-body';
      group.appendChild(body);
      return { group, body };
    }
    
    
    
    function renderMessages(msgs, pinEvents = []) {
      const existingFirst = messagesEl.querySelector('.date-separator, .pin-system-row, .msg-row, .msg-group');
      const fragment = buildMessagesFragment(msgs, pinEvents);
      if (existingFirst) messagesEl.insertBefore(fragment, existingFirst);
      else insertAtMessagesEnd(fragment);
      updateScrollBottomButton();
      refreshScrollDateIndicator();
    }
    
    
    
    function appendMessage(msg, options = {}) {
      if (isMessageDisplayed(msg?.id)) {
        return messagesEl.querySelector(`.msg-row[data-msg-id="${msg.id}"]`);
      }
      const msgDate = formatDate(msg.created_at);
      const isOwn = msg.user_id === getCurrentUser().id;
      const useGroup = !isOwn || isCompactView();
      let lastChild = getMessagesLastContentChild();
    
      // Date separator: compare against last separator in DOM
      const seps = messagesEl.querySelectorAll('.date-separator');
      const lastSepDate = seps.length ? seps[seps.length - 1].textContent.trim() : null;
      if (lastSepDate !== msgDate) {
        const sep = document.createElement('div');
        sep.className = 'date-separator';
        sep.dataset.dateIso = msg.created_at || '';
        sep.innerHTML = `<span>${msgDate}</span>`;
        insertAtMessagesEnd(sep);
        lastChild = null;
      }
    
      // Check if we can append to existing group
      let sameGroup = false;
      let groupBody = null;
      if (useGroup && lastChild && lastChild.classList.contains('msg-group') && +lastChild.dataset.userId === msg.user_id) {
        sameGroup = true;
        groupBody = lastChild.querySelector('.msg-group-body');
      }
    
      if (useGroup && (!sameGroup || !groupBody)) {
        const { group, body } = createMessageGroup(msg, isOwn);
        groupBody = body;
        sameGroup = false;
        insertAtMessagesEnd(group);
      }
    
      const showName = useGroup && !sameGroup;
      const renderOptions = { ...options, entering: options.entering !== false };
      const el = createMessageEl(msg, showName, renderOptions);
    
      if (useGroup) {
        groupBody.appendChild(el);
      } else {
        insertAtMessagesEnd(el);
      }
      rememberDisplayedMessage(msg.id);
      try {
        if (window.messageCache) window.messageCache.upsertMessage(msg).catch(()=>{});
      } catch (e) {}
      try {
        if (msg.file_type === 'image' && msg.file_stored && window.cacheAssets) {
          window.cacheAssets([attachmentHelpers.getAttachmentPreviewUrl(msg)]).catch(()=>{});
        }
      } catch (e) {}
      if (!actions.isLoadingMoreAfter()) updateHasMoreAfterFromChat(getCurrentChatId());
      updateScrollBottomButton();
      refreshScrollDateIndicator();
    }
    
    
    
    function createMessageEl(msg, showName = true, options = {}) {
      if (String(msg?.ai_bot_kind || '').toLowerCase() === 'chatshot') {
        msg = { ...msg, display_name: 'chatShot', avatar_url: '', avatar_color: msg.avatar_color || '#f4c542' };
      }
      applyOwnReadStateToMessage(msg, msg?.chat_id || msg?.chatId || getCurrentChatId());
      const isOwn = msg.user_id === getCurrentUser().id;
      const isClientMessage = isClientSideMessage(msg);
      const normalizedPoll = pollRenderer.normalizePoll(msg?.poll);
      const isPulsePollMessage = Boolean(!msg.is_deleted && normalizedPoll && pollRenderer.isPulsePoll(normalizedPoll));
      const isMediaMessage = Boolean(
        !msg.is_deleted &&
        msg.file_id &&
        ['image', 'audio', 'video', 'document'].includes(msg.file_type)
      );
      const isEmojiOnly = Boolean(
        !msg.is_deleted &&
        !msg.poll &&
        !msg.is_voice_note &&
        !msg.file_id &&
        !msg.forwarded_from_display_name &&
        !msg.reply_to_id &&
        msg.text &&
        !(msg.previews && msg.previews.length) &&
        isSingleEmojiMessage(msg.text)
      );
      const isPollMessage = Boolean(!msg.is_deleted && msg.poll);
      const isCallMessage = Boolean(!msg.is_deleted && (msg.call || msg.call_message || msg.is_call_message));
      const isCallTranscriptMessage = Boolean(!msg.is_deleted && (msg.call_transcript_run || msg.is_call_transcript_message));
      const isCallArtifactMessage = Boolean(!msg.is_deleted && (msg.call_artifact_batch || msg.is_call_artifact_message));
      const row = options.reuseRow && options.reuseRow.nodeType === 1
        ? options.reuseRow
        : document.createElement('div');
      if (options.reuseRow === row) resetReusableMessageRow(row);
      row.className = `msg-row ${isOwn ? 'own' : 'other'}${isEmojiOnly ? ' emoji-only-message' : ''}${isMediaMessage ? ' media-message' : ''}${isPollMessage ? ' poll-message' : ''}${isCallMessage ? ' call-message' : ''}${isCallTranscriptMessage ? ' call-transcript-message' : ''}${isCallArtifactMessage ? ' call-artifact-message' : ''}`;
      if (options.entering) {
        row.classList.add('entering');
        row.addEventListener('animationend', () => row.classList.remove('entering'), { once: true });
      }
      if (contextConvertPendingMessageIds.has(Number(msg.id || 0))) row.classList.add('context-convert-pending');
      row.dataset.msgId = msg.id;
      if (msg.client_id) row.dataset.clientId = msg.client_id;
      if (isClientMessage) row.dataset.outbox = '1';
      row.dataset.date = formatDate(msg.created_at);
      row.dataset.userId = msg.user_id;
      row.__messageData = { ...msg };
      markPendingMediaBottomScroll(row, msg, Boolean(options.mediaAutoScrollToBottom));
      row.__replyPayload = {
        id: msg.id,
        display_name: isOwn ? getCurrentUser().display_name : msg.display_name,
        text: getReplyPreviewText(msg),
        is_voice_note: Boolean(msg.is_voice_note),
        is_video_note: Boolean(msg.is_video_note),
        ai_bot_id: Number(msg.ai_bot_id) || 0,
        ai_bot_mention: msg.ai_bot_mention || '',
        ai_bot_provider: msg.ai_bot_provider || '',
        ai_bot_kind: msg.ai_bot_kind || '',
        ai_bot_image_risk_filter_enabled: msg.ai_bot_image_risk_filter_enabled ?? true,
      };
      row.__voiceBootstrap = {
        id: msg.id,
        is_voice_note: !!msg.is_voice_note,
        voice_duration_ms: msg.voice_duration_ms || null,
        transcription_status: msg.transcription_status || 'idle',
        transcription_text: msg.transcription_text || '',
        transcription_provider: msg.transcription_provider || '',
        transcription_model: msg.transcription_model || '',
        transcription_error: msg.transcription_error || '',
      };
    
      let html = '';
    
      html += '<div class="msg-content">';
    
      // Sender name (first in group)
      if (showName && (!isOwn || isCompactView())) {
        const nameColor = isOwn ? (getCurrentUser().avatar_color || '#65aadd') : (msg.avatar_color || '#65aadd');
        const nameText = isOwn ? getCurrentUser().display_name : msg.display_name;
        html += `<div class="msg-sender" style="color:${nameColor}">${esc(nameText)}</div>`;
      }
    
      html += '<div class="msg-bubble">';
    
      if (msg.is_deleted) {
        html += `<span class="msg-deleted">Message deleted</span>`;
      } else {
        if (msg.saved_from_message_id) {
          const savedName = (msg.saved_from_display_name || '').trim() || 'Unknown';
          html += `<button type="button" class="msg-saved-origin" data-origin-id="${Number(msg.saved_from_message_id) || 0}">
            <span>\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e \u043e\u0442 ${esc(savedName)}</span>
            <strong>\u041a \u043e\u0440\u0438\u0433\u0438\u043d\u0430\u043b\u0443</strong>
          </button>`;
        }
    
        if (msg.forwarded_from_display_name) {
          html += `<div class="msg-forwarded">\u041f\u0435\u0440\u0435\u0441\u043b\u0430\u043d\u043e \u043e\u0442 ${esc(msg.forwarded_from_display_name)}</div>`;
        }
    
        // Reply reference
        if (msg.reply_to_id && msg.reply_display_name) {
          const replyText = getReplyQuoteText(msg);
          html += `<div class="msg-reply" data-reply-id="${msg.reply_to_id}">
            <div class="msg-reply-name">${esc(msg.reply_display_name)}</div>
            <div class="msg-reply-text">${esc(replyText)}</div>
          </div>`;
        }
    
        // File attachment
        if (msg.file_id && (msg.file_stored || msg.client_file_url)) {
          html += attachmentRenderer.renderFileAttachment(msg);
        }
    
        if (isCallMessage) {
          html += callCardRenderer.renderCallMessageCard(msg);
        }
    
        if (isCallTranscriptMessage) {
          html += callCardRenderer.renderCallTranscriptRunCard(msg);
        }
    
        if (isCallArtifactMessage) {
          html += callCardRenderer.renderCallArtifactBatchCard(msg);
        }
    
        // Text
        if (msg.text && !isCallMessage && !isCallTranscriptMessage && !isCallArtifactMessage) {
          const textClasses = isPulsePollMessage ? 'msg-text poll-question-block' : 'msg-text';
          const textHtml = isEmojiOnly && isSingleCustomEmojiMessage(msg.text)
            ? renderCustomEmojiHtml(msg.text.trim(), { large: true })
            : (isEmojiOnly ? esc(msg.text.trim()) : renderMessageText(msg.text, msg.mentions));
          html += `<div class="${textClasses}">${textHtml}</div>`;
        }
    
        if (msg.ai_notice_type === 'grok_image_risk' && msg.reply_to_id) {
          const pending = grokImageRiskRetryPending.has(Number(msg.id || 0));
          html += `<div class="grok-risk-notice-actions">
            <button type="button" class="grok-risk-retry-btn weather-action-btn${pending ? ' is-pending' : ''}" data-grok-risk-retry="${Number(msg.id) || 0}"${pending ? ' disabled' : ''}>${esc(t('Send again'))}</button>
          </div>`;
        }
    
        if (msg.poll) {
          html += pollRenderer.renderPollCard(msg);
        }
    
        // Link previews
        if (msg.previews && msg.previews.length > 0) {
          for (const p of msg.previews) {
            html += attachmentRenderer.renderLinkPreview(p);
          }
        }
    
        // Delete button (inside bubble)
          if (!isClientMessage && !isCallMessage && !isCallTranscriptMessage && !isCallArtifactMessage && (isOwn || getCurrentUser().is_admin)) {
            html += `<button class="msg-delete-btn" data-id="${msg.id}" title="Delete">\ud83d\uddd1</button>`;
          }
      }
    
      // Client-side status overrides server read icons when present
      let statusIcon = '';
      if (isOwn && !msg.is_deleted) {
        if (msg.client_status) {
          const isFailedStatus = String(msg.client_status || '').toLowerCase() === 'failed';
          statusIcon = `<span class="msg-status ${isFailedStatus ? 'failed' : 'sending'}">${isFailedStatus ? '!' : '\u23f3'}</span>`;
        }
        else statusIcon = `<span class="msg-status${msg.is_read ? ' read' : ''}">${msg.is_read ? '\u2713\u2713' : '\u2713'}</span>`;
      }
      const editedIcon = !msg.is_deleted && msg.edited_at ? '<span class="msg-edited" title="Edited">\u270e</span>' : '';
      const reactionsHtml = (!msg.is_deleted && msg.reactions && msg.reactions.length > 0)
        ? `<div class="msg-reactions">${renderReactions(msg.reactions)}</div>` : '<div></div>';
      html += `<div class="msg-footer">${reactionsHtml}<span class="msg-time">${statusIcon}${editedIcon}${formatTime(msg.created_at)}</span></div>`;
    
      // Message action icons are shown on hover/focus and can be pinned by tapping the message.
      if (!msg.is_deleted && !isClientMessage) {
        html += '<div class="msg-actions">';
        html += '<button class="msg-copy-btn" title="\u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c">\u29c9</button>';
        html += '<button class="msg-reply-btn" title="Reply">\u21a9</button>';
        if (canEditMessage(msg)) html += '<button class="msg-edit-btn" title="Edit">\u270f\ufe0f</button>';
        if (canContextConvertMessage(msg)) html += `<button class="msg-context-convert-btn${contextConvertPendingMessageIds.has(Number(msg.id || 0)) ? ' is-pending' : ''}" title="Transform with AI">\ud83c\udf4c</button>`;
        if (canRestoreContextOriginalMessage(msg)) html += `<button class="msg-restore-original-btn${contextOriginalRestorePendingMessageIds.has(Number(msg.id || 0)) ? ' is-pending' : ''}" title="${esc(t('Restore original'))}" aria-label="${esc(t('Restore original'))}">&#8634;</button>`;
        if (canSaveMessageToNotes(msg)) html += '<button class="msg-save-note-btn" title="\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0432 \u0437\u0430\u043c\u0435\u0442\u043a\u0438">\ud83d\udcdd</button>';
        if (canForwardMessage(msg)) html += '<button class="msg-forward-btn" title="Forward">\ud83d\udce4</button>';
        html += '<button class="msg-react-btn" title="React">\ud83d\ude42</button>';
        html += '</div>';
      }
      html += '</div>'; // msg-bubble
      html += '</div>'; // msg-content
    
      row.innerHTML = html;
      // Persist client_status on row for CSS/logic; apply class for failed state so retry button can be overlayed
      if (msg.client_status) row.dataset.clientStatus = msg.client_status;
      if (msg.client_status && String(msg.client_status || '').toLowerCase() === 'failed') row.classList.add('client-failed');
      if (msg.client_status && String(msg.client_status || '').toLowerCase() !== 'failed') row.classList.add('client-sending');
      const actionsEl = row.querySelector('.msg-actions');
      if (actionsEl && !row.querySelector('.msg-pin-btn')) {
        const pinWrap = document.createElement('span');
        pinWrap.innerHTML = renderPinActionButton(msg);
        const pinButton = pinWrap.firstElementChild;
        if (pinButton) actionsEl.insertBefore(pinButton, actionsEl.querySelector('.msg-react-btn'));
      }
    
      // Event listeners
      const deleteBtn = row.querySelector('.msg-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteMessage(msg.id); });
      }
    
      const replyBtn = row.querySelector('.msg-reply-btn');
      if (replyBtn) {
        bindTouchSafeButtonActivation(replyBtn, ({ event }) => {
          event?.stopPropagation?.();
          setReplyFromRow(row);
        });
      }
    
      const copyBtn = row.querySelector('.msg-copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('mousedown', (e) => e.preventDefault());
        copyBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await copyMessageFromRow(row);
        });
      }
    
      const editBtn = row.querySelector('.msg-edit-btn');
      if (editBtn) {
        bindTouchSafeButtonActivation(editBtn, ({ event }) => {
          event?.stopPropagation?.();
          setEditFromRow(row);
        });
      }
    
      const contextConvertBtn = row.querySelector('.msg-context-convert-btn');
      if (contextConvertBtn) bindContextConvertMessageButton(contextConvertBtn, row);
    
      const restoreOriginalBtn = row.querySelector('.msg-restore-original-btn');
      if (restoreOriginalBtn) bindContextOriginalRestoreButton(restoreOriginalBtn, row);
    
      const reactBtn = row.querySelector('.msg-react-btn');
      if (reactBtn) {
        bindTouchSafeButtonActivation(reactBtn, ({ event, startKeyboardOpen }) => {
          event?.stopPropagation?.();
          const keepComposerFocus = Boolean(state.getReactionPickerKeepKeyboard?.() || startKeyboardOpen || isMobileComposerKeyboardOpen());
          showReactionPicker(row, reactBtn, { source: 'actions', keepComposerFocus });
        });
      }
    
      const forwardBtn = row.querySelector('.msg-forward-btn');
      if (forwardBtn) {
        forwardBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openForwardMessageModal(row.__messageData);
        });
      }
    
      const saveNoteBtn = row.querySelector('.msg-save-note-btn');
      if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          saveMessageToNotes(row.__messageData, saveNoteBtn);
        });
      }
    
      pollRenderer.bindPollControls(row);
      callCardRenderer.bindCallMessageControls(row);
      callCardRenderer.bindCallTranscriptMessageControls(row);
      callCardRenderer.bindCallArtifactMessageControls(row);
      pollRenderer.hydratePulseInlineVoters(row);
    
      const pinBtn = row.querySelector('.msg-pin-btn');
      if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          togglePinFromRow(row);
        });
      }
    
      const retryBtn = row.querySelector('.msg-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', (e) => { e.stopPropagation(); actions.retrySend(row); });
      }
    
      const grokRiskRetryBtn = row.querySelector('.grok-risk-retry-btn');
      if (grokRiskRetryBtn) {
        grokRiskRetryBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          retryGrokImageRiskPrompt(row, grokRiskRetryBtn);
        });
      }
    
      row.querySelectorAll('.mention-link').forEach((btn) => {
        btn.addEventListener('click', (e) => handleMentionClick(e, btn));
      });
    
      // (react button handled via delegation on messagesEl)
    
      // Click reply quote to scroll to original message
      const replyQuote = row.querySelector('.msg-reply');
      if (replyQuote) {
        replyQuote.style.cursor = 'pointer';
        replyQuote.addEventListener('click', () => scrollToMessage(+replyQuote.dataset.replyId));
      }
    
      const savedOrigin = row.querySelector('.msg-saved-origin');
      if (savedOrigin) {
        savedOrigin.addEventListener('click', (e) => {
          e.stopPropagation();
          jumpToSavedOriginal(row.__messageData);
        });
      }
    
      const img = row.querySelector('.msg-image');
      if (img) {
        img.draggable = false;
        let imageLayoutHandled = false;
        let imageLayoutRetryFrame = 0;
        const markWideImage = () => {
          if (!img.naturalWidth || !img.naturalHeight) return;
          row.classList.toggle('wide-media-message', img.naturalWidth >= img.naturalHeight);
        };
        const finalizeImageLayout = () => {
          if (!row.isConnected) {
            if (imageLayoutRetryFrame) return;
            imageLayoutRetryFrame = requestAnimationFrame(() => {
              imageLayoutRetryFrame = 0;
              finalizeImageLayout();
            });
            return;
          }
          if (imageLayoutHandled) return;
          imageLayoutHandled = true;
          if (!isCurrentMessageRow(row)) {
            clearPendingMediaBottomScroll(row);
            return;
          }
          const rowChatId = Number(row.__messageData?.chat_id || row.__messageData?.chatId || getCurrentChatId() || 0);
          const shouldAutoScroll = Boolean(row.__autoScrollMediaToBottomOnLoad);
          const anchor = !shouldAutoScroll && !isNearBottom(8) ? captureScrollAnchor() : null;
          markWideImage();
          if (anchor) requestAnimationFrame(() => restoreScrollAnchor(anchor, 1));
          clearPendingMediaBottomScroll(row);
          if (shouldAutoScroll) settleDeferredMediaBottomScroll(rowChatId);
          else scheduleMediaBottomScrollAnchorSave(rowChatId);
        };
        img.addEventListener('dragstart', (e) => e.preventDefault());
        img.addEventListener('click', (e) => {
          if (Date.now() < (row.__suppressMediaClickUntil || 0)) {
            e.preventDefault();
            e.stopPropagation();
            row.__suppressMediaClickUntil = 0;
            return;
          }
          openImageViewer(img.src);
        });
        img.addEventListener('load', finalizeImageLayout);
        if (img.complete) finalizeImageLayout();
      }
    
      const expandBtn = row.querySelector('.msg-expand-btn');
      if (expandBtn && !msg.is_video_note) {
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const video = row.querySelector('.msg-video video');
          const src = video?.querySelector('source')?.getAttribute('src') || '';
          if (src) openMediaViewer(src, 'video');
        });
      }
    
      // Audio/video duration
      const audio = row.querySelector('audio');
      if (audio) {
        if (!msg.is_voice_note) {
          bindMediaPlaybackState(audio, msg, 'attachment-audio');
        }
        audio.addEventListener('loadedmetadata', () => {
          const audioWrap = audio.parentElement;
          if (!audioWrap) return;
          const dur = attachmentRenderer.formatDuration(audio.duration);
          const durEl = document.createElement('span');
          durEl.className = 'media-duration';
          durEl.textContent = dur;
          audioWrap.querySelector('div:last-child')?.prepend(durEl);
        });
      }
      const video = row.querySelector('video');
      if (video && !msg.is_video_note) {
        bindMediaPlaybackState(video, msg, 'attachment-video');
        const initialPosterUrl = attachmentHelpers.getAttachmentPosterUrl(msg);
        if (initialPosterUrl) {
          attachmentRenderer.applyPosterToVideoElement(video, initialPosterUrl);
        } else {
          attachmentRenderer.ensureAttachmentPoster(msg, { videoEl: video }).catch(() => {});
        }
        let videoLayoutHandled = false;
        let videoLayoutRetryFrame = 0;
        const markWideVideo = () => {
          if (!video.videoWidth || !video.videoHeight) return;
          row.classList.toggle('wide-media-message', video.videoWidth >= video.videoHeight);
        };
        const finalizeVideoLayout = () => {
          if (!row.isConnected) {
            if (videoLayoutRetryFrame) return;
            videoLayoutRetryFrame = requestAnimationFrame(() => {
              videoLayoutRetryFrame = 0;
              finalizeVideoLayout();
            });
            return;
          }
          if (videoLayoutHandled) return;
          videoLayoutHandled = true;
          if (!isCurrentMessageRow(row)) {
            clearPendingMediaBottomScroll(row);
            return;
          }
          const rowChatId = Number(row.__messageData?.chat_id || row.__messageData?.chatId || getCurrentChatId() || 0);
          const shouldAutoScroll = Boolean(row.__autoScrollMediaToBottomOnLoad);
          const anchor = !shouldAutoScroll && !isNearBottom(8) ? captureScrollAnchor() : null;
          markWideVideo();
          if (anchor) requestAnimationFrame(() => restoreScrollAnchor(anchor, 1));
          const videoWrap = video.parentElement;
          if (!videoWrap) {
            clearPendingMediaBottomScroll(row);
            return;
          }
          const dur = attachmentRenderer.formatDuration(video.duration);
          const durEl = document.createElement('span');
          durEl.className = 'media-duration';
          durEl.textContent = dur;
          videoWrap.querySelector('div:last-child')?.prepend(durEl);
          clearPendingMediaBottomScroll(row);
          if (shouldAutoScroll) settleDeferredMediaBottomScroll(rowChatId);
          else scheduleMediaBottomScrollAnchorSave(rowChatId);
        };
        video.addEventListener('loadedmetadata', finalizeVideoLayout);
        if (video.readyState >= 1) finalizeVideoLayout();
      }
    
      window.BananzaVideoNoteHooks?.decorateMessageRow?.(row, msg);
      window.BananzaVoiceHooks?.decorateMessageRow?.(row, msg);
      // Ensure status UI is in sync (adds retry button when failed)
      updateRowStatus(row);
    
      return row;
    }
    
    
    
    function updateRowStatus(row) {
      try {
        const d = row.__messageData || {};
        const statusEl = row.querySelector('.msg-status');
        if (!statusEl) return;
        if (d.client_status) {
          row.dataset.clientStatus = d.client_status;
          let retryBtn = row.querySelector('.msg-retry-btn');
          if (!retryBtn) {
            retryBtn = document.createElement('button');
            retryBtn.type = 'button';
            retryBtn.className = 'msg-retry-btn';
            retryBtn.title = 'Retry';
            retryBtn.setAttribute('aria-label', 'Retry sending message');
            retryBtn.textContent = '\u21bb';
            const bubble = row.querySelector('.msg-bubble');
            if (bubble) bubble.appendChild(retryBtn);
            else row.appendChild(retryBtn);
            retryBtn.addEventListener('mousedown', (e) => e.preventDefault());
            retryBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              e.currentTarget.blur();
              actions.retrySend(row);
            });
          }
          const statusValue = String(d.client_status || '').toLowerCase();
          const isSending = statusValue !== 'failed' || messageState.isOutboxSending(d.client_id || row.dataset.clientId || row.dataset.msgId);
          statusEl.className = `msg-status ${isSending ? 'sending' : 'failed'}`;
          statusEl.textContent = isSending ? '\u23f3' : '!';
          retryBtn.disabled = isSending;
          row.classList.toggle('client-failed', !isSending);
          row.classList.toggle('client-sending', isSending);
          actions.scheduleRetryLayout();
          return;
        }
        statusEl.className = `msg-status${d.is_read ? ' read' : ''}`;
        statusEl.textContent = d.is_read ? '\u2713\u2713' : '\u2713';
        row.classList.remove('client-failed', 'client-sending');
        delete row.dataset.clientStatus;
        const retryBtn = row.querySelector('.msg-retry-btn');
        const retrySlot = retryBtn?.closest('.msg-retry-slot');
        if (retryBtn) retryBtn.remove();
        if (retrySlot && retrySlot.childElementCount === 0) retrySlot.remove();
      } catch (e) {}
    }
    
    
    
    function cleanupDuplicateDateSeparators() {
      const seenDates = new Set();
      messagesEl.querySelectorAll('.date-separator').forEach(sep => {
        const text = sep.textContent.trim();
        if (seenDates.has(text)) sep.remove();
        else seenDates.add(text);
      });
    }
    
    
    
    function refreshDateSeparators() {
      if (!messagesEl) return;
      messagesEl.querySelectorAll('.date-separator').forEach((sep) => {
        const createdAt = sep.dataset.dateIso || '';
        const target = sep.querySelector('span') || sep;
        if (createdAt) target.textContent = formatDate(createdAt);
        else target.textContent = tx(target.textContent);
      });
      getRenderedMessageRows().forEach((row) => {
        const createdAt = row.__messageData?.created_at || '';
        if (createdAt) row.dataset.date = formatDate(createdAt);
      });
      cleanupDuplicateDateSeparators();
      refreshScrollDateIndicator();
    }
    
    

    return {
      clearRenderedMessages,
      getRenderedMessageIdList,
      renderedMessageIdsMatch,
      resetReusableMessageRow,
      pinEventIdKey,
      rememberPinEvent,
      isPinEventDisplayed,
      timelineTimestamp,
      buildTimelineItems,
      buildMessagesFragment,
      replaceRenderedMessages,
      primeAppendedMessageSideEffects,
      appendTimelineItems,
      appendPinEventIfVisible,
      isCurrentMessageRow,
      messageHasDeferredMediaLayout,
      clearPendingMediaBottomScroll,
      noteMessageScrollUserIntent,
      scheduleMediaBottomScrollAnchorSave,
      settleDeferredMediaBottomScroll,
      markPendingMediaBottomScroll,
      markPendingMediaBottomScrollForMessages,
      cancelPendingMediaBottomScrollIfNeeded,
      createMessageGroup,
      renderMessages,
      appendMessage,
      createMessageEl,
      replaceRenderedMessage,
      withStableOutboxMedia,
      updateRowStatus,
      cleanupDuplicateDateSeparators,
      refreshDateSeparators,
      filterNewPinEvents,
      renderPinSystemEvent,
    };
  }

  messagesRoot.render = {
    createMessageRenderer,
  };
})();
