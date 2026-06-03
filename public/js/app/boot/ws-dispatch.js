(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function createRuntimeWsDispatch(scope = {}) {
    with (scope) {
      // WEBSOCKET
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      websocketService.configure?.({
        getToken: () => token || authService.getToken?.() || localStorage.getItem('token'),
        handleMessage: (payload) => handleWSMessage(payload),
        onOpen: () => {
          if (chatListStore.isInitialChatLoadFinished()) scheduleRecoverySync('ws-open');
        },
        onBlocked: () => {
          alert('Your account has been blocked by an administrator.');
          logout();
        },
        onStateChange: () => syncCoreStateFromRuntime(),
      });
      connectWS = (options = {}) => {
        syncCoreStateToRuntime();
        const socket = websocketService.connect?.(options) || null;
        syncCoreStateFromRuntime();
        return socket;
      };
    
      async function handleWSMessage(msg) {
        switch (msg.type) {
          case 'message': {
            const isOwnIncomingMessage = msg.message.user_id === currentUser.id;
            const isMentionForMe = isMessageMentioningCurrentUser(msg.message);
            const isVisibleCurrentChat = isCurrentChatActivelyVisible(msg.message.chat_id);
            applyOwnReadStateToMessage(msg.message, msg.message.chat_id);
            if (!isOwnIncomingMessage && !document.hidden) {
              if (isMentionForMe && isMentionSoundEnabled()) {
                playAppSound('mention');
              } else if (isChatIncomingSoundEnabled(msg.message.chat_id)) {
                playAppSound(isVisibleCurrentChat ? 'incoming' : 'notification');
              }
            }
            // If this message echoes a client_id, promote the optimistic row in place.
            try {
              if (msg.message && msg.message.client_id) {
                await window.messageCache?.deleteOutboxItem?.(msg.message.chat_id, msg.message.client_id);
                messageStateController?.setOutboxSending?.(msg.message.client_id, false);
                if (isVisibleCurrentChat) promoteOutboxRow(msg.message.client_id, msg.message, { mediaAutoScrollToBottom: true });
              }
            } catch (e) {}
            // Update chat list regardless
            updateChatListLastMessage(msg.message);
            try { if (window.messageCache) window.messageCache.upsertMessage(msg.message).catch(()=>{}); } catch (e) {}
            try {
              if (msg.message.file_type === 'image' && msg.message.file_stored && window.cacheAssets) {
                window.cacheAssets([getAttachmentPreviewUrl(msg.message)]).catch(()=>{});
              }
            } catch (e) {}
            // Track unread for non-current chats
            if (!isVisibleCurrentChat && msg.message.user_id !== currentUser.id) {
              chatListService.incrementUnread(msg.message.chat_id, msg.message.id);
            }
            // Only render if we're in the relevant chat
            if (isVisibleCurrentChat && !isMessageDisplayed(msg.message.id)) {
              const wasNearBottom = isNearBottom();
              const isAiBotResponse = msg.message.ai_generated || msg.message.ai_bot_id;
              const shouldPreserveIncomingScroll = scrollRestoreMode === 'restore'
                && !isOwnIncomingMessage
                && !isAiBotResponse
                && (!wasNearBottom || document.hidden);
              const shouldAutoScrollIncomingMedia = isOwnIncomingMessage
                || (!document.hidden && wasNearBottom && !shouldPreserveIncomingScroll);
              const scrollTopBefore = messagesEl.scrollTop;
              appendMessage(msg.message, { mediaAutoScrollToBottom: shouldAutoScrollIncomingMedia });
              if (isOwnIncomingMessage || (!document.hidden && wasNearBottom && !shouldPreserveIncomingScroll)) {
                scrollToBottom(false, !isOwnIncomingMessage);
              } else if (shouldPreserveIncomingScroll) {
                messagesEl.scrollTop = scrollTopBefore;
                if (!isOwnIncomingMessage) {
                  chatListService.incrementUnread(currentChatId, msg.message.id);
                }
                saveCurrentScrollAnchor(currentChatId, { force: true });
                updateScrollBottomButton();
              } else if (!isOwnIncomingMessage && (!wasNearBottom || document.hidden)) {
                chatListService.incrementUnread(currentChatId, msg.message.id);
              }
            }
            if (
              Number(msg.message.chat_id || 0) === Number(currentChatId || 0)
              && String(msg.message.ai_bot_kind || '').toLowerCase() !== 'chatshot'
            ) {
              const state = getCurrentChatShotState();
              if (state) {
                state.message_count = Number(state.message_count || 0) + 1;
                state.ready = Boolean(state.enabled && state.botId && state.message_count >= 2);
                chatShotStateByChat.set(Number(currentChatId), state);
                syncChatShotButton();
                if (!chatInfoModal?.classList.contains('hidden')) renderChatShotForm(state);
              }
            }
            // Fallback notification for old/no-push browsers while this page is still running.
            if (
              document.hidden &&
              msg.message.user_id !== currentUser.id &&
              'Notification' in window &&
              Notification.permission === 'granted' &&
              notificationSettingsController.getSettings().push_enabled &&
              ((isMentionForMe && notificationSettingsController.getSettings().notify_mentions !== false) ||
                (notificationSettingsController.getSettings().notify_messages && isChatNotificationEnabled(msg.message.chat_id))) &&
              !notificationSettingsController.isPushDeviceSubscribed()
            ) {
              const title = isMentionForMe ? `${msg.message.display_name} \u0443\u043f\u043e\u043c\u044f\u043d\u0443\u043b(\u0430) \u0432\u0430\u0441` : msg.message.display_name;
              const body = msg.message.text || (msg.message.is_voice_note ? msg.message.transcription_text : '') || '\ud83d\udcce File';
              new Notification(title, { body: body.substring(0, 100), icon: '/favicon.ico' });
            }
            break;
          }
          case 'link_preview': {
            if (msg.messageId) {
              const el = messagesEl.querySelector(`[data-msg-id="${msg.messageId}"]`);
              const previewChatId = Number(msg.chatId || msg.chat_id || el?.__messageData?.chat_id || el?.__messageData?.chatId || currentChatId || 0);
              if (previewChatId && window.messageCache?.patchMessage) {
                const previousPreviews = Array.isArray(el?.__messageData?.previews) ? el.__messageData.previews : [];
                const nextPreviews = msg.preview
                  ? [...previousPreviews.filter((item) => item?.url !== msg.preview.url), msg.preview]
                  : previousPreviews;
                window.messageCache.patchMessage(previewChatId, msg.messageId, { previews: nextPreviews }).catch(() => {});
                if (el?.__messageData) el.__messageData = { ...el.__messageData, previews: nextPreviews };
              }
              if (el) {
                const bubble = el.querySelector('.msg-bubble');
                const existing = bubble.querySelector('.link-preview');
                if (!existing) {
                  const footer = bubble.querySelector('.msg-footer');
                  if (footer) footer.insertAdjacentHTML('beforebegin', renderLinkPreview(msg.preview));
                  else bubble.insertAdjacentHTML('beforeend', renderLinkPreview(msg.preview));
                }
              }
            }
            break;
          }
          case 'message_deleted': {
            markMessageDeleted(msg.messageId, msg.chatId);
            loadChats();
            break;
          }
          case 'message_updated': {
            applyMessageUpdate(msg.message);
            loadChats();
            break;
          }
          case 'poll_updated': {
            applyPollUpdate(msg.chatId || msg.chat_id, msg.messageId || msg.message_id, msg.poll);
            break;
          }
          case 'online': {
            chatListService.setOnlineUsers(msg.userIds);
            refreshChatListReferences();
            break;
          }
          case 'typing': {
            if (msg.chatId === currentChatId && msg.userId !== currentUser.id) {
              if (msg.isTyping === false) hideTyping(msg.username);
              else showTyping(msg.username, msg);
            }
            break;
          }
          case 'chat_created': {
            if (msg.is_invite && msg.actorId !== currentUser.id && !document.hidden) {
              playAppSound('invite');
            }
            loadChats();
            break;
          }
          case 'chat_list_updated': {
            if (chatListService.hasActiveChatListRequest()) break;
            loadChats({ silent: true }).catch(() => {});
            break;
          }
          case 'chat_folders_updated': {
            loadChatFolders({ silent: true }).catch(() => {});
            break;
          }
          case 'messages_read': {
            const readState = await reconcileChatReadState(
              msg.chatId,
              { [msg.userId]: msg.lastReadId },
              { updateVisible: isCurrentChatActivelyVisible(msg.chatId) }
            );
            if (false && msg.chatId === currentChatId) {
              // Update own messages UI (double-check) if applicable.
              messagesEl.querySelectorAll('.msg-row.own').forEach(row => {
                const msgId = +row.dataset.msgId;
                if (msgId <= msg.lastReadId) {
                  const statusEl = row.querySelector('.msg-status');
                  if (statusEl && !statusEl.classList.contains('read')) {
                    statusEl.classList.add('read');
                    statusEl.textContent = '\u2713\u2713';
                  }
                }
              });
            }
            // Update cached chat object unread info if the event is about the current user
            if (false && msg.userId === currentUser.id) {
              const c = chats.find(c => c.id === msg.chatId);
              if (c) {
                c.last_read_id = Math.max(Number(c.last_read_id || 0), Number(msg.lastReadId || 0));
                if (!c.last_message_id || Number(msg.lastReadId || 0) >= Number(c.last_message_id || 0)) {
                  c.unread_count = 0;
                  c.first_unread_id = null;
                }
                renderChatList(chatSearch.value);
              }
            }
            if (readState.chatReadChanged) renderChatList(chatSearch.value);
            break;
          }
          case 'reaction': {
            updateReactionBar(msg.messageId, msg.reactions);
            if (
              msg.action === 'added' &&
              msg.targetUserId === currentUser.id &&
              msg.actorId !== currentUser.id &&
              !document.hidden &&
              isChatIncomingSoundEnabled(msg.chatId)
            ) {
              playAppSound('reaction');
            }
            break;
          }
          case 'message_transcription':
          case 'voice_settings_updated':
          case 'video_note_settings_updated': {
            window.BananzaVoiceHooks?.handleWSMessage?.(msg);
            window.BananzaVideoNoteHooks?.handleWSMessage?.(msg);
            window.BananzaVideoNoteAdminHooks?.handleWSMessage?.(msg);
            break;
          }
          case 'call_invite':
          case 'call_updated':
          case 'call_participant_updated':
          case 'call_ended':
          case 'call_ai_notes_updated':
          case 'call_settings_updated': {
            window.BananzaCallHooks?.handleWSMessage?.(msg);
            break;
          }
          case 'user_updated': {
            applyUserUpdate(msg.user || {});
            break;
          }
          case 'user_directory_changed': {
            loadAllUsers().catch(() => {});
            break;
          }
          case 'pins_updated': {
            applyPinsUpdate(msg);
            if (msg.action === 'pinned') {
              appendPinEventIfVisible(msg.pin_event || msg.pinEvent);
              handlePinnedMessageUpdate(msg);
            }
            break;
          }
          case 'chat_system_event': {
            const event = normalizeSystemEvent(msg.event || msg.system_event || msg.systemEvent || {});
            if (!event) break;
            const chatId = Number(msg.chatId || msg.chat_id || event.chat_id || 0);
            const memberEventTypes = new Set(['member_added', 'member_left', 'member_removed']);
            if (memberEventTypes.has(event.event_type)) {
              try { chatMembersCache.delete(chatId); } catch (e) {}
              if (Number(chatId || 0) === Number(currentChatId || 0)) {
                refreshChatMemberStatuses();
                refreshChatInfoStatus();
              }
            }
            if (Number(chatId || 0) === Number(currentChatId || 0)) {
              appendSystemEventIfVisible(event);
            }
            loadChats({ silent: true }).catch(() => {});
            break;
          }
          case 'chat_updated': {
            applyChatUpdate(msg.chat || {});
            break;
          }
          case 'context_convert_bots_updated': {
            invalidateContextConvertAvailability(msg.chatId || msg.chat_id);
            if (Number(msg.chatId || msg.chat_id || 0) === Number(currentChatId || 0)) {
              loadContextConvertAvailability(currentChatId, { force: true }).catch(() => {});
            }
            break;
          }
          case 'chatshot_bots_updated': {
            invalidateChatShotState(msg.chatId || msg.chat_id);
            if (Number(msg.chatId || msg.chat_id || 0) === Number(currentChatId || 0)) {
              loadChatShotState(currentChatId, { force: true }).catch(() => {});
            }
            break;
          }
          case 'chat_history_cleared': {
            const chatId = Number(msg.chatId || msg.chat_id || 0);
            await clearLocalChatHistory(chatId, { clearCache: true });
            loadChats({ silent: true }).catch(() => {});
            break;
          }
          case 'chat_removed': {
            await removeChatLocally(msg.chatId, { clearCache: true });
            break;
          }
        }
      }
    
      function sendTyping(...args) { return composerTypingDragDropController?.sendTyping?.(...args); }
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // CHAT LIST
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function scheduleMessageBackgroundSync(delayMs = 450) {
        return openChatController.scheduleMessageBackgroundSync(delayMs);
      }
    
      function shouldBackgroundSyncMessages() {
        return openChatController.shouldBackgroundSyncMessages();
      }
    
      async function syncChatMessagesInBackground(chat, { allowColdPrewarm = false } = {}) {
        return openChatController.syncChatMessagesInBackground(chat, { allowColdPrewarm });
      }
    
      async function runMessageBackgroundSync() {
        return openChatController.runMessageBackgroundSync();
      }
    
      function updateScrollBottomButton() {
        return scrollController.updateScrollBottomButton();
      }
    
      function normalizeMemberLastReads(value) {
        return readReceiptController.normalizeMemberLastReads(value);
      }
    
      function getChatMemberLastReads(chatId) {
        return readReceiptController.getChatMemberLastReads(chatId);
      }
    
      function storeChatMemberLastReads(chatId, incomingReads, { replace = false } = {}) {
        return readReceiptController.storeChatMemberLastReads(chatId, incomingReads, { replace });
      }
    
      function getChatReadReceiptThreshold(chatId) {
        return readReceiptController.getChatReadReceiptThreshold(chatId);
      }
    
      function applyOwnReadStateToMessage(msg, chatId = msg?.chat_id || msg?.chatId || currentChatId) {
        return readReceiptController.applyOwnReadStateToMessage(msg, chatId);
      }
    
      function applyOwnReadStateToMessages(chatId, messages = []) {
        return readReceiptController.applyOwnReadStateToMessages(chatId, messages);
      }
    
function updateVisibleOwnReadState(chatId = currentChatId) {
        return readReceiptController.updateVisibleOwnReadState(chatId);
      }
    
      function updateLocalChatReadProgress(chatId, lastReadId) {
        return readReceiptController.updateLocalChatReadProgress(chatId, lastReadId);
      }
    
      async function reconcileChatReadState(chatId, incomingReads, { replace = false, updateVisible = false } = {}) {
        return readReceiptController.reconcileChatReadState(chatId, incomingReads, { replace, updateVisible });
      }
    
      function normalizePinEvent(raw = {}) {
        const id = Number(raw.id || raw.event_id || 0);
        const chatId = Number(raw.chat_id || raw.chatId || currentChatId || 0);
        const messageId = Number(raw.message_id || raw.messageId || 0);
        if (!id || !chatId || !messageId) return null;
        return {
          id,
          chat_id: chatId,
          message_id: messageId,
          action: raw.action === 'unpinned' ? 'unpinned' : 'pinned',
          actor_id: raw.actor_id == null && raw.actorId == null ? null : Number(raw.actor_id || raw.actorId || 0),
          actor_name: raw.actor_name || raw.actorName || '',
          message_author_id: raw.message_author_id == null && raw.messageAuthorId == null ? null : Number(raw.message_author_id || raw.messageAuthorId || 0),
          message_author_name: raw.message_author_name || raw.messageAuthorName || '',
          message_preview: raw.message_preview || raw.messagePreview || raw.preview_text || '',
          created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
        };
      }
    
      function normalizePinEvents(events = []) {
        const seen = new Set();
        return (Array.isArray(events) ? events : [])
          .map(normalizePinEvent)
          .filter((event) => {
            if (!event || event.action !== 'pinned' || seen.has(event.id)) return false;
            seen.add(event.id);
            return true;
          });
      }

      function normalizeSystemEvent(raw = {}) {
        const event = raw && typeof raw === 'object' ? raw : {};
        return messageStateController?.normalizeSystemEvent?.({ ...event, chatId: event.chat_id || event.chatId || currentChatId });
      }

      function normalizeSystemEvents(events = []) { return messageStateController?.normalizeSystemEvents?.(events) || []; }
    
      function rememberDisplayedMessage(id) {
        return messageStateController?.rememberDisplayedMessage?.(id);
      }
    
      function forgetDisplayedMessage(id) {
        return messageStateController?.forgetDisplayedMessage?.(id);
      }
    
      function isMessageDisplayed(id) {
        return Boolean(messageStateController?.isMessageDisplayed?.(id));
      }
    
      function revealActiveMobileChatRoute({ suppressHistoryPush = false, chatId = currentChatId } = {}) {
        if (!isMobileLayoutViewport() || !sidebar) return;
        cancelPendingSidebarReveal();
        syncMobileBaseSceneState({
          scene: 'chat',
          hideInactive: false,
          syncChatMetrics: true,
        });
        sidebar.classList.remove('sidebar-no-transition');
        sidebar.classList.add('sidebar-hidden');
        if (!suppressHistoryPush) {
          history.pushState({ chat: Number(chatId || currentChatId || 0) }, '');
        }
        const transitionMs = prefersReducedMotion()
          ? 0
          : Math.max(180, Math.ceil(getElementTransitionTotalMs(sidebar) || 250));
        if (transitionMs <= 0) {
          endMobileRouteTransition();
          return;
        }
        beginMobileRouteTransition(transitionMs + 90);
      }
    
      function isDeletedMessageRow(row) {
        return Boolean(row?.__messageData?.is_deleted);
      }
    
      function isCurrentChatActivelyVisible(chatId = currentChatId) {
        const targetChatId = Number(chatId || currentChatId || 0);
        if (!targetChatId || Number(currentChatId || 0) !== targetChatId) return false;
        if (!(chatView instanceof HTMLElement) || chatView.classList.contains('hidden')) return false;
        if (!isMobileLayoutViewport()) return true;
        if (!(chatArea instanceof HTMLElement)) return true;
        if (chatArea.hasAttribute('inert') || chatArea.classList.contains('mobile-scene-hidden')) return false;
        return getResolvedMobileBaseScene() === 'chat';
      }
    

      function renderAdminUserRow(u) {
        return adminUsersController.renderAdminUserRow(u);
      }
    
      function refreshAdminUserStatuses() {
        return adminUsersController.refreshAdminUserStatuses();
      }
    
      function refreshChatMemberStatuses() {
        if (chatInfoModal.classList.contains('hidden')) return;
        const list = $('#chatMemberList');
        if (!list) return;
        const membersById = new Map((chatMembersCache.get(currentChatId) || []).map((member) => [Number(member.id || member.user_id || 0), member]));
        list.querySelectorAll('.user-list-item').forEach(item => {
          if (item.dataset.bot === '1') return;
          const uid = +item.dataset.uid;
          const statusEl = item.querySelector('.admin-user-status');
          if (!statusEl) return;
          const isOnline = onlineUsers.has(uid);
          const status = profileStatusLabel(membersById.get(uid));
          statusEl.classList.toggle('online', isOnline);
          statusEl.classList.toggle('offline', !isOnline);
          statusEl.innerHTML = `<span class="status-dot"></span><span class="admin-user-status-label">${isOnline ? 'online' : 'offline'}${status ? ` <span class="user-profile-status-inline">\u2022 ${esc(status)}</span>` : ''}</span>`;
          item.querySelector('.user-profile-status-line')?.remove();
        });
      }
    
      function refreshChatInfoStatus() {
        const el = $('#chatInfoStatus');
        if (!el) return;
        const chat = getChatById(currentChatId);
        syncChatInfoStatusVisibility(chat);
        if (isNotesChat(chat)) return;
        if (chat?.type === 'private' && Number(chat?.private_user?.is_ai_bot) !== 0) {
          el.classList.remove('online', 'offline');
          el.innerHTML = `<span class="status-dot"></span>AI bot`;
          return;
        }
        const memberList = $('#chatMemberList');
        if (!memberList) {
          el.classList.remove('online'); el.classList.add('offline');
          el.innerHTML = `<span class="status-dot"></span>offline`;
          return;
        }
        const items = memberList.querySelectorAll('.user-list-item');
        const humanItems = Array.from(items).filter(it => it.dataset.bot !== '1');
        const botItems = Array.from(items).filter(it => it.dataset.bot === '1');
        const total = humanItems.length;
        let onlineCount = 0;
        humanItems.forEach(it => { if (onlineUsers.has(+it.dataset.uid)) onlineCount++; });
        if (total <= 1) {
          if (total === 1) {
            const isOnline = onlineUsers.has(+humanItems[0].dataset.uid);
            el.classList.toggle('online', isOnline);
            el.classList.toggle('offline', !isOnline);
            el.innerHTML = `<span class="status-dot"></span>${isOnline ? 'online' : 'offline'}`;
          } else if (botItems.length === 1 && items.length === 1) {
            // single bot participant
            el.classList.remove('online','offline');
            el.innerHTML = `<span class="status-dot"></span>AI bot`;
          } else {
            el.classList.remove('online','offline');
            el.innerHTML = `0/${total} online`;
          }
        } else {
          el.classList.remove('online','offline');
          el.innerHTML = `${onlineCount}/${total} online`;
        }
      }
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // CHAT SHELL AND COMPOSER DRAFTS
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function normalizeComposerDraftChatId(...args) { return composerStateController.normalizeComposerDraftChatId(...args); }
    
      function getComposerDraftStorageKey(...args) { return composerStateController.getComposerDraftStorageKey(...args); }
    
      function persistComposerDrafts(...args) { return composerStateController.persistComposerDrafts(...args); }
    
      function hydrateComposerDraftsForCurrentUser(...args) { return composerStateController.hydrateComposerDraftsForCurrentUser(...args); }
    
      function saveComposerDraft(chatId = currentChatId) {
        if (!normalizeComposerDraftChatId(chatId) || composerStateController.editTo || !msgInput) return;
        composerStateController.saveComposerDraftValue(chatId, getComposerTextValue());
      }
    
      function clearComposerDraft(chatId = currentChatId) { return composerStateController.clearComposerDraft(chatId); }
    
      function restoreComposerDraft(chatId = currentChatId) {
        if (!normalizeComposerDraftChatId(chatId) || !msgInput) return;
        setComposerTextValue(composerStateController.getComposerDraft(chatId) || '');
        autoResize();
        syncMentionOpenButton();
        window.BananzaVoiceHooks?.refreshComposerState?.();
        updateComposerAiOverrideState().catch(() => {});
      }
    
      function updateChatStatus() {
        const chat = chats.find(c => c.id === currentChatId);
        if (!chat) return;
        if (isNotesChat(chat)) {
          chatStatus.classList.remove('online', 'offline');
          chatStatus.textContent = '\u041b\u0438\u0447\u043d\u044b\u0439 \u0447\u0430\u0442';
          chatStatus.style.color = '';
          return;
        }
        if (chat.type === 'private' && chat.private_user) {
          if (Number(chat.private_user.is_ai_bot) !== 0) {
            chatStatus.classList.remove('online', 'offline');
            chatStatus.textContent = 'AI bot';
            chatStatus.style.color = '';
            return;
          }
          const isOnline = onlineUsers.has(chat.private_user.id);
          const status = profileStatusLabel(chat.private_user);
          chatStatus.classList.toggle('online', isOnline);
          chatStatus.classList.toggle('offline', !isOnline);
          chatStatus.innerHTML = `<span class="chat-status-presence ${isOnline ? 'online' : 'offline'}">${isOnline ? 'online' : 'offline'}</span>${status ? ` <span class="user-profile-status-inline">\u2022 ${esc(status)}</span>` : ''}`;
          chatStatus.style.color = '';
        } else {
          // Prefer counting only members of this chat if we have them cached
          const members = chatMembersCache.get(chat.id);
          if (Array.isArray(members)) {
              const humanMembers = members.filter(m => !m.is_ai_bot);
              const total = humanMembers.length;
              let onlineCount = 0;
              for (const m of humanMembers) if (onlineUsers.has(m.id)) onlineCount++;
            if (total <= 1) {
              const isOnline = total === 1 && onlineUsers.has(humanMembers[0].id);
              chatStatus.classList.toggle('online', isOnline);
              chatStatus.classList.toggle('offline', !isOnline);
              chatStatus.textContent = isOnline ? 'online' : 'offline';
              chatStatus.style.color = isOnline ? 'var(--success)' : '';
            } else {
              chatStatus.classList.remove('online','offline');
              if (onlineCount === total && total > 0) {
                chatStatus.innerHTML = `<span class="admin-user-status online"><span class="status-dot"></span><span class="admin-user-status-label">\u0412\u0441\u0435 \u0432 \u0441\u0431\u043e\u0440\u0435</span></span>`;
                chatStatus.style.color = '';
              } else {
                chatStatus.textContent = `${onlineCount}/${total} online`;
                chatStatus.style.color = '';
              }
            }
          } else {
            // Fallback: show global online count, then asynchronously prime the cache
            const onlineCount = [...onlineUsers].length;
            chatStatus.textContent = `${onlineCount} online`;
            chatStatus.style.color = '';
            (async () => {
              try {
                const fetched = await api(`/api/chats/${chat.id}/members`);
                if (fetched && currentChatId === chat.id) {
                  chatMembersCache.set(chat.id, fetched);
                  updateChatStatus();
                }
              } catch (e) {}
            })();
          }
        }
      }
    
      function applyBackgroundStyleToElement(el, style) {
        switch (style) {
          case 'cover':
            el.style.backgroundSize = 'cover'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center center'; break;
          case 'contain':
            el.style.backgroundSize = 'contain'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center center'; break;
          case '100%':
            el.style.backgroundSize = '100%'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center center'; break;
          case 'tile':
            el.style.backgroundSize = 'auto'; el.style.backgroundRepeat = 'repeat'; el.style.backgroundPosition = 'left top'; break;
          case 'center':
            el.style.backgroundSize = 'contain'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center center'; break;
          default:
            el.style.backgroundSize = 'cover'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center center';
        }
      }
    
      function applyChatBackground(chat) {
        const layer = document.getElementById('chatBackgroundLayer');
        const targetChatView = chatView || document.getElementById('chatView');
        const clearBg = (el) => { if (el) el.style.backgroundImage = el.style.backgroundSize = el.style.backgroundRepeat = el.style.backgroundPosition = ''; };
        messagesEl?.classList?.remove('has-bg');
        clearBg(messagesEl);
        if (!chat || !chat.background_url) {
          targetChatView?.classList?.remove('has-chat-background');
          clearBg(layer);
          return;
        }
        targetChatView?.classList?.add('has-chat-background');
        if (!layer) return;
        layer.style.backgroundImage = `url(${chat.background_url})`;
        applyBackgroundStyleToElement(layer, chat.background_style || 'cover');
      }
    
      function resolveMediaPlaybackChatId(message = {}) {
        return mediaPlaybackController.resolveMediaPlaybackChatId(message);
      }
    
      function resolveMediaPlaybackKey(message = {}, role = '') {
        return mediaPlaybackController.resolveMediaPlaybackKey(message, role);
      }
    
      function normalizeMediaPlaybackCompletedEntries(source = null) {
        return mediaPlaybackController.normalizeMediaPlaybackCompletedEntries(source);
      }
    
      function getMediaPlaybackCompletedBucket(chatId, { create = false } = {}) {
        return mediaPlaybackController.getMediaPlaybackCompletedBucket(chatId, { create });
      }
    
      function applyMediaPlaybackCompletedMeta(chatId, source = null) {
        return mediaPlaybackController.applyMediaPlaybackCompletedMeta(chatId, source);
      }
    
      function exportMediaPlaybackCompletedMeta(chatId) {
        return mediaPlaybackController.exportMediaPlaybackCompletedMeta(chatId);
      }
    
      function primeMediaPlaybackCompletedCache(chatId, meta = null) {
        return mediaPlaybackController.primeMediaPlaybackCompletedCache(chatId, meta);
      }
    
      function isMediaPlaybackCompleted(message = {}, role = '') {
        return mediaPlaybackController.isMediaPlaybackCompleted(message, role);
      }
    
      function setMediaPlaybackCompleted(message = {}, role = '', completed) {
        return mediaPlaybackController.setMediaPlaybackCompleted(message, role, completed);
      }
    
      function isMediaPlaybackNearEnd(mediaEl, epsilon = 0.08) {
        return mediaPlaybackController.isMediaPlaybackNearEnd(mediaEl, epsilon);
      }
    
      function getMediaPlaybackBucket(chatId, { create = false } = {}) {
        return mediaPlaybackController.getMediaPlaybackBucket(chatId, { create });
      }
    
      function readMediaPlaybackState(message = {}, role = '') {
        return mediaPlaybackController.readMediaPlaybackState(message, role);
      }
    
      function writeMediaPlaybackState(message = {}, role = '', snapshot = null) {
        return mediaPlaybackController.writeMediaPlaybackState(message, role, snapshot);
      }
    
      function clearMediaPlaybackState(message = {}, role = '') {
        return mediaPlaybackController.clearMediaPlaybackState(message, role);
      }
    
      function captureBoundMediaPlaybackState(mediaEl) {
        return mediaPlaybackController.captureBoundMediaPlaybackState(mediaEl);
      }
    
      function bindMediaPlaybackState(mediaEl, message = {}, role = '') {
        return mediaPlaybackController.bindMediaPlaybackState(mediaEl, message, role);
      }
    
      function pauseCurrentChatMediaPlayback() {
        return mediaPlaybackController.pauseCurrentChatMediaPlayback();
      }
    
      function getMediaNoteFallbackLabel(msg, { voiceLabel = '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435', videoLabel = '\u0412\u0438\u0434\u0435\u043e-\u0437\u0430\u043c\u0435\u0442\u043a\u0430' } = {}) {
        if (!msg?.is_voice_note) return '';
        return msg?.is_video_note ? videoLabel : voiceLabel;
      }
    
      function suppressScrollBottomFollowupClick(ms = 520) {
        scrollBottomFollowupClickSuppressUntil = Math.max(scrollBottomFollowupClickSuppressUntil, Date.now() + ms);
      }
    
      function activateScrollBottomButton() {
        if (!scrollBottomBtn) return false;
        scrollBottomBtn.blur();
        scrollToBottom(false, true);
        return true;
      }
    
      function shouldPreserveKeyboardForScrollBottomGesture(e) {
        if (!scrollBottomBtn || !isMobileLayoutViewport()) return false;
        if (!isMobileComposerKeyboardOpen()) return false;
        if (e?.type === 'pointerdown' || e?.type === 'pointerup') {
          if (typeof e.button === 'number' && e.button !== 0) return false;
          if (e.pointerType === 'mouse') return false;
        }
        return true;
      }
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function getReplySnapshot(...args) { return composerReplyEditController?.getReplySnapshot?.(...args) || null; }
    
      // COMPOSER SEND
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      async function saveEditedMessage(...args) { return composerSendController?.saveEditedMessage?.(...args); }
    
      async function sendMessage(...args) { return composerSendController?.sendMessage?.(...args); }
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // FILE UPLOAD
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      async function uploadFiles(...args) { return composerFilesController?.uploadFiles?.(...args); }
    
      function renderPendingFiles(...args) { return composerFilesController?.renderPendingFiles?.(...args); }
    
      function clearPendingFile(...args) { return composerFilesController?.clearPendingFile?.(...args); }
    
      function hideAttachMenu(...args) { return composerFilesController?.hideAttachMenu?.(...args); }
    
      // REPLY
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function getReplyPreviewText(...args) { return composerReplyEditController?.getReplyPreviewText?.(...args) || 'Attachment'; }
    
      function getReplyQuoteText(...args) { return composerReplyEditController?.getReplyQuoteText?.(...args) || 'Attachment'; }
    
      function canEditMessage(...args) { return Boolean(composerReplyEditController?.canEditMessage?.(...args)); }
    
      function canForwardMessage(...args) { return Boolean(composerReplyEditController?.canForwardMessage?.(...args)); }
    
      function canSaveMessageToNotes(...args) { return Boolean(composerReplyEditController?.canSaveMessageToNotes?.(...args)); }
    
      function getEditableText(...args) { return composerReplyEditController?.getEditableText?.(...args) || ''; }
    
      function getSelectedMessageFragment(...args) { return composerReplyEditController?.getSelectedMessageFragment?.(...args) || ''; }
    
      function isSelectableMessageTextTarget(...args) { return Boolean(composerReplyEditController?.isSelectableMessageTextTarget?.(...args)); }
    
      function getMessageCopyTextData(...args) { return composerReplyEditController?.getMessageCopyTextData?.(...args) || { text: '', hasMeaningfulContent: false }; }
    
      function getMessageCopyText(...args) { return composerReplyEditController?.getMessageCopyText?.(...args) || ''; }
    
      async function copyMessageFromRow(...args) { return composerReplyEditController?.copyMessageFromRow?.(...args); }
    
      function setReplyFromRow(...args) { return composerReplyEditController?.setReplyFromRow?.(...args); }
    
      function setReply(...args) { return composerReplyEditController?.setReply?.(...args); }
    
      function clearReply(...args) { return composerReplyEditController?.clearReply?.(...args); }
    
      function setEditFromRow(...args) { return composerReplyEditController?.setEditFromRow?.(...args); }
    
      function clearEdit(...args) { return composerReplyEditController?.clearEdit?.(...args); }
    
      function setupMessageSwipeGestures(...args) { return composerReplyEditController?.setupMessageSwipeGestures?.(...args); }
    
      // INTERACTIONS
      function getReactionPickerMsgId() { return reactionController?.getReactionPickerMsgId?.() || null; }
      function getReactionPickerKeepKeyboard() { return Boolean(reactionController?.getReactionPickerKeepKeyboard?.()); }
      function getActiveMessageActionsRow() { return floatingMessageActionsController?.getActiveMessageActionsRow?.() || null; }
      function getActiveMessageActionsEl() { return floatingMessageActionsController?.getActiveMessageActionsEl?.() || null; }
      function getFloatingMessageActionsState() { return floatingMessageActionsController?.getFloatingMessageActionsState?.() || null; }
    
      function isSearchPanelOpen() { return Boolean(searchController?.isSearchPanelOpen?.()); }
      function clearSearchResults() { return searchController?.clearSearchResults?.(); }
      function updateSearchTriggerState(active) { return searchController?.updateSearchTriggerState?.(active); }
      function renderSearchResultsEmpty(message) { return searchController?.renderSearchResultsEmpty?.(message); }
      function renderSearchScopeToggle() { return searchController?.renderSearchScopeToggle?.(); }
      function clearSearchPanelTransitionState() { return searchController?.clearSearchPanelTransitionState?.(); }
      function ensureSearchPanelReady() { return searchController?.ensureSearchPanelReady?.(); }
      function getSearchPanelTransitionFallbackMs() { return searchController?.getSearchPanelTransitionFallbackMs?.() || MODAL_TRANSITION_BUFFER_MS; }
      function focusSearchInput() { return searchController?.focusSearchInput?.(); }
      function flushSearchPanelPendingAction() { return searchController?.flushSearchPanelPendingAction?.(); }
      function queueSearchPanelPendingAction(action) { return Boolean(searchController?.queueSearchPanelPendingAction?.(action)); }
      function shouldAutoFocusSearchInput() { return searchController?.shouldAutoFocusSearchInput?.() ?? true; }
      function horizontalPagerCommitDistance(width) { return searchController?.horizontalPagerCommitDistance?.(width) || Math.max(1, Math.round(Number(width || 0) * 0.22)); }
      function canAnimateHorizontalPager() { return Boolean(searchController?.canAnimateHorizontalPager?.()); }
      function stripCloneIds(rootEl) { return searchController?.stripCloneIds?.(rootEl) || rootEl; }
      function syncClonedFormControls(sourceRoot, cloneRoot) { return searchController?.syncClonedFormControls?.(sourceRoot, cloneRoot) || cloneRoot; }
      function createHorizontalSwipePager(options = {}) { return searchController?.createHorizontalSwipePager?.(options) || null; }
      function cancelScheduledScrollableItemCenter(strip) { return searchController?.cancelScheduledScrollableItemCenter?.(strip); }
      function centerScrollableItem(strip, item, options = {}) { return Boolean(searchController?.centerScrollableItem?.(strip, item, options)); }
      function scheduleScrollableItemCenter(strip, activeSelector, options = {}) { return Boolean(searchController?.scheduleScrollableItemCenter?.(strip, activeSelector, options)); }
      function openSearchPanel(options = {}) { return searchController?.openSearchPanel?.(options); }
      function closeSearchPanel(options = {}) { return Boolean(searchController?.closeSearchPanel?.(options)); }
      function performSearch(options = {}) { return searchController?.performSearch?.(options); }
      function scrollToMessage(msgId, options = {}) { return Boolean(searchController?.scrollToMessage?.(msgId, options)); }
      async function jumpToSearchResult(result) { return searchController?.jumpToSearchResult?.(result) || false; }
      async function animateSearchResultChatSwitch(targetChatId) { return searchController?.animateSearchResultChatSwitch?.(targetChatId); }
      function formatSearchResultTimestamp(value) { return searchController?.formatSearchResultTimestamp?.(value) || ''; }
      function suppressSearchPanelFollowupClick(ms) { return searchController?.suppressSearchPanelFollowupClick?.(ms); }
    
      function isFloatingSurfaceVisible(el) { return floatingMessageActionsController?.isFloatingSurfaceVisible?.(el) ?? Boolean(el && !el.classList.contains('hidden')); }
      function getFloatingViewportRect() { return floatingMessageActionsController?.getFloatingViewportRect?.() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, right: window.innerWidth, bottom: window.innerHeight }; }
      function clamp(value, min, max) { return floatingMessageActionsController?.clamp?.(value, min, max) ?? Math.max(min, Math.min(value, max)); }
      function findMessageRowById(msgId) { return floatingMessageActionsController?.findMessageRowById?.(msgId) || null; }
      function getFloatingMessageActionRow() { return floatingMessageActionsController?.getFloatingMessageActionRow?.() || null; }
      function updateFloatingMessageActionsState(row, options = {}) { return floatingMessageActionsController?.updateFloatingMessageActionsState?.(row, options) || null; }
      function clearFloatingMessageActionsStateIfClosed() { return floatingMessageActionsController?.clearFloatingMessageActionsStateIfClosed?.(); }
      function suppressNextMessageActionTap(ms) { return floatingMessageActionsController?.suppressNextMessageActionTap?.(ms); }
      function measureFloatingSurface(el, fallbackWidth, fallbackHeight) { return floatingMessageActionsController?.measureFloatingSurface?.(el, fallbackWidth, fallbackHeight) || { width: fallbackWidth, height: fallbackHeight }; }
      function openFloatingSurface(el) { return floatingMessageActionsController?.openFloatingSurface?.(el); }
      function closeFloatingSurface(el, options = {}) { return floatingMessageActionsController?.closeFloatingSurface?.(el, options); }
      function getVisibleMessageAreaRect() { return floatingMessageActionsController?.getVisibleMessageAreaRect?.() || getFloatingViewportRect(); }
      function measureMessageActions(row) { return floatingMessageActionsController?.measureMessageActions?.(row) || { width: 178, height: 36 }; }
      function getMessageActionsElement(row) { return floatingMessageActionsController?.getMessageActionsElement?.(row) || row?.querySelector?.('.msg-actions') || null; }
      function portalMessageActions(row) { return floatingMessageActionsController?.portalMessageActions?.(row) || null; }
      function restoreMessageActions(actions) { return floatingMessageActionsController?.restoreMessageActions?.(actions); }
      function clearMessageActionsPlacement(row) { return floatingMessageActionsController?.clearMessageActionsPlacement?.(row); }
      function resolveMessageActionLayout(row, options = {}) { return floatingMessageActionsController?.resolveMessageActionLayout?.(row, options) || null; }
      function positionFloatingElement(el, left, top) { return floatingMessageActionsController?.positionFloatingElement?.(el, left, top); }
      function applyMessageActionsLayout(row, layout) { return Boolean(floatingMessageActionsController?.applyMessageActionsLayout?.(row, layout)); }
      function positionReactionEmojiPopover() { return floatingMessageActionsController?.positionReactionEmojiPopover?.(); }
      function positionMessageActionSurfaces(options = {}) { return floatingMessageActionsController?.positionMessageActionSurfaces?.(options) || null; }
      function hideActiveMessageActions() { return floatingMessageActionsController?.hideActiveMessageActions?.(); }
      function hideFloatingMessageActions(options = {}) { return floatingMessageActionsController?.hideFloatingMessageActions?.(options); }
      function showMessageActions(row, options = {}) { return Boolean(floatingMessageActionsController?.showMessageActions?.(row, options)); }
    
      function renderReactions(reactions) { return reactionController?.renderReactions?.(reactions) || ''; }
      function updateReactionBar(msgId, reactions) { return reactionController?.updateReactionBar?.(msgId, reactions); }
      function renderQuickReactionButtonsHtml(options = {}) { return reactionController?.renderQuickReactionButtonsHtml?.(options) || ''; }
      function renderReactionPickerContent() { return reactionController?.renderReactionPickerContent?.(); }
      function showReactionPicker(row, trigger, options = {}) { return reactionController?.showReactionPicker?.(row, trigger, options); }
      function hideReactionPicker(options = {}) { return reactionController?.hideReactionPicker?.(options); }
      function hideReactionUi(options = {}) { return reactionController?.hideReactionUi?.(options); }
      async function toggleReaction(msgId, emoji, options = {}) { return reactionController?.toggleReaction?.(msgId, emoji, options); }
    
      function openMediaViewer(src, type = 'image') { return mediaViewerController?.openMediaViewer?.(src, type); }
      function openImageViewer(src) { return mediaViewerController?.openImageViewer?.(src); }
      function closeMediaViewer() { return mediaViewerController?.closeMediaViewer?.(); }
      function handleMediaViewerControlActivation(event) { return Boolean(mediaViewerController?.handleMediaViewerControlActivation?.(event)); }
      function updateGalleryArrows() { return mediaViewerController?.updateGalleryArrows?.(); }
      async function galleryNav(dir) { return mediaViewerController?.galleryNav?.(dir); }
      function suppressMediaViewerFollowupClick(ms) { return mediaViewerController?.suppressMediaViewerFollowupClick?.(ms); }
    
      function clearChatContextLongPress() { return contextMenusController?.clearChatContextLongPress?.(); }
      function clearMediaContextLongPress() { return contextMenusController?.clearMediaContextLongPress?.(); }
      function getMessageMediaContextTarget(target) { return contextMenusController?.getMessageMediaContextTarget?.(target) || null; }
      function getMessageMediaKindLabel(kind) { return contextMenusController?.getMessageMediaKindLabel?.(kind) || 'File'; }
      function getDefaultMessageMediaMime(kind) { return contextMenusController?.getDefaultMessageMediaMime?.(kind) || 'application/octet-stream'; }
      function getAbsoluteMessageMediaUrl(url) { return contextMenusController?.getAbsoluteMessageMediaUrl?.(url) || ''; }
      function getMessageMediaContext(row, target) { return contextMenusController?.getMessageMediaContext?.(row, target) || null; }
      function canShareMediaFileContext(context) { return Boolean(contextMenusController?.canShareMediaFileContext?.(context)); }
      async function fetchMessageMediaBlob(context) { return contextMenusController?.fetchMessageMediaBlob?.(context); }
      async function copyImageFromMediaContext(context) { return contextMenusController?.copyImageFromMediaContext?.(context); }
      async function shareMediaFromContext(context) { return contextMenusController?.shareMediaFromContext?.(context); }
      function renderMediaContextMenu(context) { return contextMenusController?.renderMediaContextMenu?.(context); }
      function positionMediaContextMenu() { return contextMenusController?.positionMediaContextMenu?.(); }
      function hideMediaContextMenu(options = {}) { return contextMenusController?.hideMediaContextMenu?.(options); }
      function showMediaContextMenuForRow(row, target, options = {}) { return contextMenusController?.showMediaContextMenuForRow?.(row, target, options); }
      function showMediaContextMenuForContext(context, options = {}) { return contextMenusController?.showMediaContextMenuForContext?.(context, options); }
      async function handleMediaContextMenuAction(action, context) { return contextMenusController?.handleMediaContextMenuAction?.(action, context); }
      function renderChatContextMenu(chat) { return contextMenusController?.renderChatContextMenu?.(chat); }
      function positionChatContextMenu() { return contextMenusController?.positionChatContextMenu?.(); }
      function hideChatContextMenu(options = {}) { return contextMenusController?.hideChatContextMenu?.(options); }
      function showChatContextMenuForRow(row, options = {}) { return contextMenusController?.showChatContextMenuForRow?.(row, options); }
      async function updateChatContextPreference(chatId, changes) { return contextMenusController?.updateChatContextPreference?.(chatId, changes); }
      async function handleChatContextMenuAction(action, chatId) { return contextMenusController?.handleChatContextMenuAction?.(action, chatId); }
    
      function setForwardMessageStatus(message = '', type = '') { return forwardingController?.setForwardMessageStatus?.(message, type); }
      function resetForwardMessageModal() { return forwardingController?.resetForwardMessageModal?.(); }
      function closeForwardMessageModal(options = {}) { return forwardingController?.closeForwardMessageModal?.(options); }
      function renderForwardChatList(filter = '') { return forwardingController?.renderForwardChatList?.(filter); }
      function openForwardMessageModal(message) { return forwardingController?.openForwardMessageModal?.(message); }
      async function forwardMessageToChat(targetChatId) { return forwardingController?.forwardMessageToChat?.(targetChatId); }
      async function saveMessageToNotes(message, button = null) { return forwardingController?.saveMessageToNotes?.(message, button); }
    

      return {
        handleWSMessage, sendTyping, scheduleMessageBackgroundSync, shouldBackgroundSyncMessages, syncChatMessagesInBackground, runMessageBackgroundSync, updateScrollBottomButton, normalizeMemberLastReads,
        getChatMemberLastReads, storeChatMemberLastReads, getChatReadReceiptThreshold, applyOwnReadStateToMessage, applyOwnReadStateToMessages, updateLocalChatReadProgress, reconcileChatReadState, normalizePinEvent,
        normalizePinEvents, normalizeSystemEvent, normalizeSystemEvents, rememberDisplayedMessage, forgetDisplayedMessage, isMessageDisplayed, revealActiveMobileChatRoute, isDeletedMessageRow, isCurrentChatActivelyVisible, renderAdminUserRow,
        refreshAdminUserStatuses, refreshChatMemberStatuses, refreshChatInfoStatus, normalizeComposerDraftChatId, getComposerDraftStorageKey, persistComposerDrafts, hydrateComposerDraftsForCurrentUser, saveComposerDraft,
        clearComposerDraft, restoreComposerDraft, updateChatStatus, applyBackgroundStyleToElement, applyChatBackground, resolveMediaPlaybackChatId, resolveMediaPlaybackKey, normalizeMediaPlaybackCompletedEntries,
        getMediaPlaybackCompletedBucket, applyMediaPlaybackCompletedMeta, exportMediaPlaybackCompletedMeta, primeMediaPlaybackCompletedCache, isMediaPlaybackCompleted, setMediaPlaybackCompleted, isMediaPlaybackNearEnd, getMediaPlaybackBucket,
        readMediaPlaybackState, writeMediaPlaybackState, clearMediaPlaybackState, captureBoundMediaPlaybackState, bindMediaPlaybackState, pauseCurrentChatMediaPlayback, getMediaNoteFallbackLabel, suppressScrollBottomFollowupClick,
        activateScrollBottomButton, shouldPreserveKeyboardForScrollBottomGesture, getReplySnapshot, saveEditedMessage, sendMessage, uploadFiles, renderPendingFiles, clearPendingFile,
        hideAttachMenu, getReplyPreviewText, getReplyQuoteText, canEditMessage, canForwardMessage, canSaveMessageToNotes, getEditableText, getSelectedMessageFragment,
        isSelectableMessageTextTarget, getMessageCopyTextData, getMessageCopyText, copyMessageFromRow, setReplyFromRow, setReply, clearReply, setEditFromRow,
        clearEdit, setupMessageSwipeGestures, getReactionPickerMsgId, getReactionPickerKeepKeyboard, getActiveMessageActionsRow, getActiveMessageActionsEl, getFloatingMessageActionsState, isSearchPanelOpen,
        clearSearchResults, updateSearchTriggerState, renderSearchResultsEmpty, renderSearchScopeToggle, clearSearchPanelTransitionState, ensureSearchPanelReady, getSearchPanelTransitionFallbackMs, focusSearchInput,
        flushSearchPanelPendingAction, queueSearchPanelPendingAction, shouldAutoFocusSearchInput, horizontalPagerCommitDistance, canAnimateHorizontalPager, stripCloneIds, syncClonedFormControls, createHorizontalSwipePager,
        cancelScheduledScrollableItemCenter, centerScrollableItem, scheduleScrollableItemCenter, openSearchPanel, closeSearchPanel, performSearch, scrollToMessage, jumpToSearchResult,
        animateSearchResultChatSwitch, formatSearchResultTimestamp, suppressSearchPanelFollowupClick, isFloatingSurfaceVisible, getFloatingViewportRect, clamp, findMessageRowById, getFloatingMessageActionRow,
        updateFloatingMessageActionsState, clearFloatingMessageActionsStateIfClosed, suppressNextMessageActionTap, measureFloatingSurface, openFloatingSurface, closeFloatingSurface, getVisibleMessageAreaRect, measureMessageActions,
        getMessageActionsElement, portalMessageActions, restoreMessageActions, clearMessageActionsPlacement, resolveMessageActionLayout, positionFloatingElement, applyMessageActionsLayout, positionReactionEmojiPopover,
        positionMessageActionSurfaces, hideActiveMessageActions, hideFloatingMessageActions, showMessageActions, renderReactions, updateReactionBar, renderQuickReactionButtonsHtml, renderReactionPickerContent,
        showReactionPicker, hideReactionPicker, hideReactionUi, toggleReaction, openMediaViewer, openImageViewer, closeMediaViewer, handleMediaViewerControlActivation,
        updateGalleryArrows, galleryNav, suppressMediaViewerFollowupClick, clearChatContextLongPress, clearMediaContextLongPress, getMessageMediaContextTarget, getMessageMediaKindLabel, getDefaultMessageMediaMime,
        getAbsoluteMessageMediaUrl, getMessageMediaContext, canShareMediaFileContext, fetchMessageMediaBlob, copyImageFromMediaContext, shareMediaFromContext, renderMediaContextMenu, positionMediaContextMenu,
        hideMediaContextMenu, showMediaContextMenuForRow, showMediaContextMenuForContext, handleMediaContextMenuAction, renderChatContextMenu, positionChatContextMenu, hideChatContextMenu, showChatContextMenuForRow,
        updateChatContextPreference, handleChatContextMenuAction, setForwardMessageStatus, resetForwardMessageModal, closeForwardMessageModal, renderForwardChatList, openForwardMessageModal, forwardMessageToChat,
        saveMessageToNotes,
      };
    }
  }

  bootRoot.wsDispatch = { createRuntimeWsDispatch };
})();
