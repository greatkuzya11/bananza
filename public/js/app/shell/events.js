(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const shellRoot = root.shell = root.shell || {};

  const PROFILE_STATUS_OPTIONS = [
    { key: '', label: 'No status' },
    { key: 'available', label: 'Available' },
    { key: 'busy', label: 'Busy' },
    { key: 'dnd', label: 'Do not disturb' },
    { key: 'away', label: 'Away' },
    { key: 'working', label: 'Working' },
    { key: 'resting', label: 'Resting' },
    { key: 'custom', label: 'Custom status' },
  ];

  function createProfileStatusEditor(options = {}) {
    const $ = typeof options.$ === 'function' ? options.$ : (selector) => document.querySelector(selector);
    const esc = typeof options.esc === 'function' ? options.esc : (value) => String(value ?? '');
    const t = typeof options.t === 'function' ? options.t : (value) => value;
    const getCurrentUser = typeof options.getCurrentUser === 'function' ? options.getCurrentUser : () => null;
    const setProfileStatus = typeof options.setProfileStatus === 'function' ? options.setProfileStatus : () => {};
    let bound = false;

    function normalizeText(value) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 48); }
    function normalizeKey(value) {
      const key = String(value || '').trim().toLowerCase();
      return PROFILE_STATUS_OPTIONS.some((option) => option.key === key) ? key : '';
    }
    function label(user) {
      if (!user || Number(user.is_ai_bot || 0) !== 0) return '';
      const key = normalizeKey(user.profile_status_key);
      if (key === 'custom') return normalizeText(user.profile_status_text);
      const option = PROFILE_STATUS_OPTIONS.find((item) => item.key === key);
      return option?.key ? t(option.label) : '';
    }
    function previewLine(user) {
      const handle = user?.username ? `@${user.username}` : '';
      return [handle, label(user)].filter(Boolean).join(' \u2022 ');
    }
    function getSelection() {
      const currentUser = getCurrentUser();
      const selectEl = $('#profileUserStatusSelect');
      const inputEl = $('#profileCustomStatus');
      const key = normalizeKey(selectEl ? selectEl.value : (currentUser?.profile_status_key || ''));
      const text = normalizeText(inputEl ? inputEl.value : (currentUser?.profile_status_text || ''));
      return { key, text: key === 'custom' ? text : '' };
    }
    function renderOptions() {
      const selectEl = $('#profileUserStatusSelect');
      if (!selectEl) return;
      const selectedKey = normalizeKey(getCurrentUser()?.profile_status_key || '');
      selectEl.innerHTML = PROFILE_STATUS_OPTIONS.map((option) => `<option value="${esc(option.key)}">${esc(t(option.label))}</option>`).join('');
      selectEl.value = selectedKey;
    }
    function syncSelection() {
      const { key, text } = getSelection();
      const selectEl = $('#profileUserStatusSelect');
      if (selectEl) selectEl.value = key;
      $('#profileCustomStatusWrap')?.classList.toggle('hidden', key !== 'custom');
      const preview = $('#profileUserStatusPreview');
      if (preview) preview.textContent = previewLine({ ...getCurrentUser(), profile_status_key: key, profile_status_text: text }) || t('No status');
    }
    function hydrate() {
      const currentUser = getCurrentUser();
      const customInput = $('#profileCustomStatus');
      if (customInput) customInput.value = normalizeKey(currentUser?.profile_status_key) === 'custom' ? normalizeText(currentUser?.profile_status_text) : '';
      renderOptions();
      syncSelection();
    }
    function bindEvents() {
      if (bound) return;
      bound = true;
      $('#profileUserStatusSelect')?.addEventListener('change', (event) => {
        syncSelection();
        if (event.target.value === 'custom') $('#profileCustomStatus')?.focus();
        setProfileStatus('');
      });
      $('#profileCustomStatus')?.addEventListener('input', () => {
        syncSelection();
        setProfileStatus('');
      });
    }

    return { bindEvents, getSelection, hydrate, label, normalizeKey, normalizeText, syncSelection };
  }

  function createInviteRuntimeAdapter(scope = {}) {
    with (scope) {
      const chatInviteTokenPattern = /^[A-Za-z0-9_-]{32,128}$/;
      let chatInviteLinkLoadSeq = 0;

      function normalizeChatInviteToken(value) {
        const tokenValue = String(value || '').trim();
        return chatInviteTokenPattern.test(tokenValue) ? tokenValue : '';
      }

      function chatInviteTokenFromPath(pathname = '') {
        const match = String(pathname || '').match(/^\/join\/([A-Za-z0-9_-]{32,128})\/?$/);
        return normalizeChatInviteToken(match?.[1]);
      }

      function chatInviteTokenFromUrl(value = '') {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
          const parsed = new URL(raw, location.origin);
          if (parsed.origin !== location.origin) return '';
          return chatInviteTokenFromPath(parsed.pathname);
        } catch (e) {
          return '';
        }
      }

      function renderLinkAnchor(url) {
        const href = esc(url);
        const label = esc(url);
        const inviteToken = chatInviteTokenFromUrl(url);
        if (inviteToken) {
          return `<a href="${href}" rel="noopener noreferrer" data-chat-invite-token="${esc(inviteToken)}">${label}</a>`;
        }
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      }

      function isInviteCapableGroupChat(chat) {
        return Boolean(chat && chat.type === 'group' && !isNotesChat(chat) && Number(chat.is_document || 0) !== 1 && !isGeneralChat(chat));
      }

      function canManageInviteLink(chat = getChatById(currentChatId)) {
        return Boolean(
          currentUser
          && isInviteCapableGroupChat(chat)
          && (currentUser.is_admin || Number(chat.created_by || 0) === Number(currentUser.id))
        );
      }

      function setChatInviteLinkStatus(message, type = '') {
        const el = $('#chatInviteLinkStatus');
        if (!el) return;
        el.textContent = message ? tx(message) : '';
        el.classList.toggle('is-error', type === 'error');
        el.classList.toggle('is-success', type === 'success');
        el.classList.toggle('is-pending', type === 'pending');
      }

      function setChatInviteLinkInputValue(value = '', chatId = currentChatId) {
        const input = $('#chatInviteLinkInput');
        if (!input) return;
        const url = String(value || '');
        input.value = url;
        input.title = url;
        input.dataset.chatId = chatId ? String(chatId) : '';
      }

      function renderChatInviteLinkForm(chat = getChatById(currentChatId)) {
        const section = $('#chatInviteLinkSection');
        if (!section) return;
        const visible = canManageInviteLink(chat);
        section.classList.toggle('hidden', !visible);
        setChatInviteLinkStatus('');
        if (!visible) {
          setChatInviteLinkInputValue('');
          return;
        }
        const input = $('#chatInviteLinkInput');
        if (input && (input.dataset.chatId !== String(chat?.id || '') || !input.value)) {
          setChatInviteLinkInputValue('', chat?.id || currentChatId);
          loadCurrentChatInviteLink();
        }
      }

      function inviteLinkUrlFromPayload(payload = {}) {
        payload = payload || {};
        if (payload.url) return String(payload.url);
        if (payload.path) return new URL(String(payload.path), location.origin).href;
        if (payload.token) return new URL(`/join/${encodeURIComponent(String(payload.token))}`, location.origin).href;
        return '';
      }

      async function loadCurrentChatInviteLink(options = {}) {
        const chat = getChatById(currentChatId);
        if (!canManageInviteLink(chat)) return null;
        const seq = ++chatInviteLinkLoadSeq;
        if (!options.silent) setChatInviteLinkStatus('Loading...', 'pending');
        try {
          const payload = await api(`/api/chats/${currentChatId}/invite-link`);
          if (seq !== chatInviteLinkLoadSeq) return payload;
          const url = inviteLinkUrlFromPayload(payload);
          setChatInviteLinkInputValue(url, currentChatId);
          if (!options.silent) setChatInviteLinkStatus('');
          return payload;
        } catch (error) {
          if (seq !== chatInviteLinkLoadSeq) return null;
          if (!options.silent) {
            const message = error.message || 'Could not copy invite link';
            setChatInviteLinkStatus(message, 'error');
            showCenterToast(message);
          }
          return null;
        }
      }

      async function copyCurrentChatInviteLink() {
        const chat = getChatById(currentChatId);
        if (!canManageInviteLink(chat)) return null;
        setChatInviteLinkStatus('Loading...', 'pending');
        try {
          const input = $('#chatInviteLinkInput');
          let payload = null;
          let url = input && input.dataset.chatId === String(currentChatId) ? input.value : '';
          if (!url) {
            payload = await loadCurrentChatInviteLink({ silent: true });
            url = inviteLinkUrlFromPayload(payload);
          }
          if (!url) throw new Error('Could not copy invite link');
          const copied = await copyTextToClipboard(url);
          if (!copied) throw new Error('Could not copy invite link');
          setChatInviteLinkStatus('Invite link copied', 'success');
          showCenterToast('Invite link copied');
          return payload || { url };
        } catch (error) {
          const message = error.message || 'Could not copy invite link';
          setChatInviteLinkStatus(message, 'error');
          showCenterToast(message);
          return null;
        }
      }

      async function refreshCurrentChatInviteLink() {
        const chat = getChatById(currentChatId);
        if (!canManageInviteLink(chat)) return null;
        if (!confirm('Refresh invite link? Old link will stop working.')) return null;
        setChatInviteLinkStatus('Refreshing...', 'pending');
        try {
          const payload = await api(`/api/chats/${currentChatId}/invite-link/rotate`, { method: 'POST' });
          const url = inviteLinkUrlFromPayload(payload);
          setChatInviteLinkInputValue(url, currentChatId);
          const copied = await copyTextToClipboard(url);
          if (!copied) throw new Error('Could not copy invite link');
          setChatInviteLinkStatus('New invite link copied', 'success');
          showCenterToast('New invite link copied');
          return payload;
        } catch (error) {
          const message = error.message || 'Could not refresh invite link';
          setChatInviteLinkStatus(message, 'error');
          showCenterToast(message);
          return null;
        }
      }

      async function joinChatInviteToken(tokenValue, options = {}) {
        const inviteToken = normalizeChatInviteToken(tokenValue);
        if (!inviteToken) {
          showCenterToast('Invite link is invalid');
          return null;
        }
        showCenterToast('Joining chat...');
        try {
          const result = await api(`/api/chat-invites/${encodeURIComponent(inviteToken)}/join`, { method: 'POST' });
          const targetChatId = Number(result?.chatId || result?.chat?.id || 0);
          if (result?.chat && !getChatById(targetChatId)) applyChatUpdate(result.chat);
          await loadChats({ silent: true });
          if (targetChatId) await openChat(targetChatId);
          closeChatHeaderActions?.();
          if (options.replaceHistory && history?.replaceState) history.replaceState(history.state || {}, '', '/');
          showCenterToast(result?.joined === false ? 'Chat opened' : 'Joined chat');
          return result || null;
        } catch (error) {
          if (options.replaceHistory && history?.replaceState) history.replaceState(history.state || {}, '', '/');
          const message = error.message || 'Could not join chat by link';
          showCenterToast(message);
          return null;
        }
      }

      return {
        normalizeChatInviteToken, chatInviteTokenFromPath, chatInviteTokenFromUrl, renderLinkAnchor,
        isInviteCapableGroupChat, canManageInviteLink, setChatInviteLinkStatus, renderChatInviteLinkForm,
        copyCurrentChatInviteLink, refreshCurrentChatInviteLink, joinChatInviteToken,
      };
    }
  }

  shellRoot.inviteRuntimeAdapter = { createInviteRuntimeAdapter };

  function createEventController(options = {}) {
    const scope = options.scope || {};
    let bound = false;

    function bindAll() {
      if (bound) return false;
      bound = true;
      scope.__bananzaShellEventScope = scope;
      with (scope) {
        setupPasswordPreviewToggles();
        setupMessageSwipeGestures();
        setupMobileComposerGestureGuard();
        setupMobileMessageInteractionGuard();
        wireAiBotToggleLabels();
        ensureSearchPanelReady();
        document.addEventListener('click', (e) => {
          if (isFollowupClickSuppressPassThroughTarget(e.target)) return;
          if (
            Date.now() >= composerStateController.mentionPickerClickSuppressUntil
            && Date.now() >= contextConvertPickerClickSuppressUntil
            && !mobileComposerGuard?.isAvatarUserMenuClickSuppressed?.()
            && !searchController?.isFollowupClickSuppressed?.()
            && !mobileComposerGuard?.isMobileComposerDismissClickSuppressed?.()
            && !mediaViewerController?.isFollowupClickSuppressed?.()
          ) return;
          e.preventDefault();
          e.stopImmediatePropagation();
        }, true);
        document.addEventListener('click', (e) => {
          const link = e.target?.closest?.('a[data-chat-invite-token]');
          if (!link) return;
          const inviteToken = chatInviteTokenFromUrl(link.getAttribute('href') || '') || normalizeChatInviteToken(link.dataset.chatInviteToken);
          if (!inviteToken) return;
          e.preventDefault();
          e.stopPropagation();
          joinChatInviteToken(inviteToken).catch((error) => {
            console.warn('[chat-invite] join failed:', error.message);
          });
        });
        const dismissMentionPickerOutsideGesture = (e) => composerMentionsController?.dismissMentionPickerOutsideGesture?.(e);
        const dismissContextConvertPickerOutsideGesture = (e) => {
          const picker = $('#contextConvertPicker');
          if (!picker || picker.classList.contains('hidden')) return;
          const target = e.target;
          if (picker.contains(target) || target?.closest?.('#composerContextConvertBtn')) return;
          hideContextConvertPicker({ immediate: true });
          if (isPickerDismissPassThroughTarget(target)) return;
          consumeOutsidePickerDismissGesture(e, suppressContextConvertPickerFollowupClick);
        };
        document.addEventListener('pointerdown', dismissMentionPickerOutsideGesture, { passive: false, capture: true });
        document.addEventListener('touchstart', dismissMentionPickerOutsideGesture, { passive: false, capture: true });
        document.addEventListener('pointerdown', dismissContextConvertPickerOutsideGesture, { passive: false, capture: true });
        document.addEventListener('touchstart', dismissContextConvertPickerOutsideGesture, { passive: false, capture: true });
    
        // Send message
        sendBtn.addEventListener('click', (e) => {
          e.preventDefault();
          sendBtn.blur();
          sendMessage();
          // Keep keyboard open on mobile
          if (isMobileLayoutViewport()) msgInput.focus();
        });
        bindTouchSafeButtonActivation(mentionOpenBtn, ({ startKeyboardOpen }) => {
          openMentionPickerFromButton({ keyboardAttached: startKeyboardOpen }).catch((error) => {
            console.warn('[mentions] composer picker open failed:', error.message);
          });
        });
        bindTouchSafeButtonActivation(composerContextConvertBtn, ({ startKeyboardOpen }) => {
          openComposerContextConvertPicker({ keyboardAttached: startKeyboardOpen }).catch((error) => {
            console.warn('[context-convert] composer picker open failed:', error.message);
          });
        });
        msgInput.addEventListener('beforeinput', (e) => {
          handleComposerCustomEmojiBeforeInput(e);
        });
        msgInput.addEventListener('keydown', (e) => {
          if (handleMentionPickerKeydown(e)) return;
          if (handleComposerCustomEmojiKeydown(e)) return;
          if (e.key === 'Enter') {
            if (sendByEnter && !e.shiftKey && !e.ctrlKey) { e.preventDefault(); sendMessage(); }
            else if (!sendByEnter && e.ctrlKey) { e.preventDefault(); sendMessage(); }
          }
        });
        msgInput.addEventListener('input', () => {
          normalizeComposerInputValue();
          saveComposerDraft(currentChatId);
          autoResize();
          syncMentionOpenButton();
          window.BananzaVoiceHooks?.refreshComposerState?.();
          updateComposerAiOverrideState().catch(() => {});
          updateMentionPicker();
          // Typing indicator
          if (!composerStateController.typingSendTimeout) {
            sendTyping();
            composerStateController.typingSendTimeout = setTimeout(() => { composerStateController.typingSendTimeout = null; }, 2000);
          }
        });
        msgInput.addEventListener('focus', () => {
          mobileComposerGuard?.clearIosComposerBlurTimer?.();
          mobileComposerGuard?.setIosComposerFocused?.(true);
          getIosViewportBaselineHeight();
          queueIosViewportLayoutSync();
        });
        msgInput.addEventListener('blur', () => {
          mobileComposerGuard?.scheduleIosComposerBlur?.();
        });
        composerAiOverrideModeEl?.addEventListener('change', () => {
          composerAiOverrideState.mode = composerAiOverrideModeEl.value || 'auto';
          renderComposerAiOverride();
        });
        composerAiOverrideDocumentFormatEl?.addEventListener('change', () => {
          composerAiOverrideState.documentFormat = composerAiOverrideDocumentFormatEl.value || 'md';
          renderComposerAiOverride();
        });
        msgInput.addEventListener('click', () => {
          snapComposerSelectionToCustomEmojiBoundary();
          updateMentionPicker();
        });
        msgInput.addEventListener('keyup', (e) => {
          snapComposerSelectionToCustomEmojiBoundary();
          if (!['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) updateMentionPicker();
        });
        window.visualViewport?.addEventListener('resize', () => {
          const mentionPickerDismissed = dismissMentionPickerAfterKeyboardClose();
          if (mentionPickerDismissed) forceMobileViewportLayoutSync();
          positionEmojiPicker();
          positionMentionPicker();
          positionContextConvertPicker();
          positionAvatarUserMenu(avatarUserMenuState?.anchor);
          positionMessageActionSurfaces();
          scheduleRetryLayout();
          queueIosViewportLayoutSync();
        });
        window.visualViewport?.addEventListener('scroll', () => {
          const mentionPickerDismissed = dismissMentionPickerAfterKeyboardClose();
          if (mentionPickerDismissed) forceMobileViewportLayoutSync();
          positionEmojiPicker();
          positionMentionPicker();
          positionContextConvertPicker();
          positionAvatarUserMenu(avatarUserMenuState?.anchor);
          positionMessageActionSurfaces();
          queueIosViewportLayoutSync();
        });
        window.addEventListener('resize', () => {
          positionEmojiPicker();
          positionContextConvertPicker();
          positionMessageActionSurfaces();
          scheduleRetryLayout();
          queueIosViewportLayoutSync();
        });
        document.addEventListener('pointerdown', (e) => {
          const menu = $('#avatarUserMenu');
          if (!menu || menu.classList.contains('hidden')) return;
          if (menu.contains(e.target) || e.target.closest('.msg-group-avatar')) return;
          hideAvatarUserMenu();
        });
        document.addEventListener('pointerdown', (e) => {
          if (!messagePollRenderer?.getState?.().activePulseVoterPopover) return;
          if (e.target.closest('[data-poll-voter-avatar], [data-poll-voter-more], [data-poll-voter-popover]')) return;
          clearActivePulseVoterPopover();
        });
    
        // File attach and poll composer
        syncMentionOpenButton();
        renderComposerAiOverride();
        composerFilesController?.bindAttachMenuEvents?.({ openPollComposer: () => openPollComposer() });
        pollComposerController?.bindPollComposerEvents?.();
    
        // Emoji
        bindTouchSafeButtonActivation(emojiBtn, ({ keepKeyboardOpen }) => {
          toggleEmojiPicker(emojiBtn, { keepKeyboardOpen });
        });
    
        mediaViewerController?.bindEvents?.();
    
        reactionController?.bindEvents?.();
    
        contextMenusController?.bindEvents?.();
    
        folderUiController.bindEvents({ bindTouchSafeButtonActivation });

        window.BananzaApp?.folders?.createMobileGesturesController?.({
          window,
          dom: {
            chatFolderListSurface,
            chatList,
            sidebar,
            chatSearch,
            chatListPullIndicator,
            chatListPullLabel,
          },
          constants: {
            CHAT_FOLDER_SWIPE_START_PX,
            CHAT_FOLDER_SWIPE_EDGE_DAMPING,
            CHAT_FOLDER_SWIPE_EDGE_MAX_PX,
            CHAT_LIST_PULL_TRIGGER_PX,
            CHAT_LIST_PULL_THRESHOLD,
            CHAT_LIST_PULL_MAX_OFFSET,
            CHAT_LIST_PULL_REFRESH_OFFSET,
          },
          actions: {
            isMobileLayoutViewport,
            isMobileViewportLayoutLocked,
            getFolders: () => chatFolderStore.getFolders(),
            getChatFolderPageRows,
            clamp,
            clearChatContextLongPress,
            resetChatFolderSwipeSurface,
            getAdjacentChatFolderPage,
            canAnimateChatFolderSwipe,
            prepareChatFolderSwipePager,
            setChatFolderSwipeOffset,
            destroyChatFolderSwipePager,
            suppressNextChatItemTap,
            getChatFolderSwipeCommitDistance,
            transitionToChatFolder,
            snapChatFolderSwipeBack,
            showCenterToast,
            tx,
            hasActiveChatListRequest: () => chatListService.hasActiveChatListRequest(),
          },
        })?.bindEvents?.();

        const preloadFeaturePack = (featureNames) => {
          const loader = window.BananzaApp?.featureLoader;
          if (!loader?.preloadFeature) return;
          const names = Array.isArray(featureNames) ? featureNames : [featureNames];
          names.filter(Boolean).forEach((featureName) => {
            loader.preloadFeature(featureName).catch((error) => {
              console.warn(`[feature-loader] ${featureName} preload failed:`, error?.message || error);
            });
          });
        };

        const bindFeaturePreload = (target, featureNames) => {
          if (!target) return;
          const names = (Array.isArray(featureNames) ? featureNames : [featureNames]).filter(Boolean);
          if (!names.length) return;
          target.__bananzaFeaturePreloadBound = target.__bananzaFeaturePreloadBound || new Set();
          const pendingNames = names.filter((name) => !target.__bananzaFeaturePreloadBound.has(name));
          if (!pendingNames.length) return;
          pendingNames.forEach((name) => target.__bananzaFeaturePreloadBound.add(name));
          let started = false;
          const start = () => {
            if (started) return;
            started = true;
            preloadFeaturePack(pendingNames);
          };
          target.addEventListener('pointerenter', start, { passive: true });
          target.addEventListener('pointerdown', start, { passive: true });
          target.addEventListener('touchstart', start, { passive: true });
          target.addEventListener('focus', start);
        };

        bindFeaturePreload($('#settingsBtn'), 'settings');
        bindFeaturePreload(searchBtn, 'search');
        bindFeaturePreload(chatSearchToggle, 'search');
        bindFeaturePreload(chatShotBtn, 'context-chatshot-runtime');
        bindFeaturePreload(composerContextConvertBtn, 'context-chatshot-runtime');

        // Sidebar search
        setChatSearchOpen(false, { clear: true, focus: false, render: false });
        chatSearchToggle?.addEventListener('click', () => {
          if (isChatSearchOpen()) {
            setChatSearchOpen(false, { clear: true, focus: true });
            return;
          }
          setChatSearchOpen(true, { focus: true });
        });
        chatSearch.addEventListener('input', () => {
          if (!isChatSearchOpen()) setChatSearchOpen(true);
          renderChatList(chatSearch.value);
        });
        chatSearchClear?.addEventListener('click', () => {
          setChatSearchOpen(false, { clear: true, focus: true });
        });
    
        // Back button (mobile)
        bindTouchSafeButtonActivation(backBtn, () => {
          if (hasOpenModal()) {
            closeTopModal();
            return;
          }
          if (isSearchPanelOpen()) {
            closeSearchPanel();
            return;
          }
          if (searchController?.hasPopStateSkipPending?.()) {
            queueSearchPanelPendingAction(() => {
              navigateBackToChatList({ fromInAppButton: true });
            });
            return;
          }
          if (backBtn.__isNavigating) return;
          const expectsHistoryPopstate = Boolean(history.state && history.state.chat);
          const finishBackNavigation = () => {
            navigateBackToChatList({ fromInAppButton: true });
            clearTimeout(backBtn.__spinTimer);
            backBtn.classList.remove('is-spinning');
            if (expectsHistoryPopstate) {
              deferBackButtonNavigationRelease();
              return;
            }
            backBtn.__isNavigating = false;
          };
          backBtn.__isNavigating = true;
          clearTimeout(backBtn.__navTimer);
          if (prefersReducedMotion()) {
            finishBackNavigation();
            return;
          }
          animateBackButton();
          backBtn.__navTimer = setTimeout(finishBackNavigation, 120);
        });
    
        // Android back gesture / button
        window.addEventListener('popstate', () => {
          if (inAppChatBackSkipNextPopstate) {
            inAppChatBackSkipNextPopstate = false;
            searchController?.resetPopStateSkip?.();
            mediaViewerController?.resetPopStateSkip?.();
            iosBackNavigationToken = 0;
            if (pendingMobileChatListHistoryNormalization) {
              normalizeMobileChatListHistoryState();
            }
            resetBackButtonNavigationState();
            return;
          }
          if (modalManager.handlePopState(null, { skipOnly: true })) return;
          if (searchController?.handlePopStateSkip?.()) return;
          if (mediaViewerController?.handlePopStateSkip?.()) return;
          if (iosBackNavigationToken > 0) {
            iosBackNavigationToken -= 1;
            resetBackButtonNavigationState();
            return;
          }
          resetBackButtonNavigationState();
          if (isFloatingSurfaceVisible(chatFolderContextMenu)) {
            hideChatFolderContextMenu();
            return;
          }
          if (isFloatingSurfaceVisible(chatFolderPicker)) {
            hideChatFolderPicker();
            return;
          }
          if (isFloatingSurfaceVisible(chatContextMenu)) {
            hideChatContextMenu();
            return;
          }
          if (isFloatingSurfaceVisible(mediaContextMenu)) {
            hideMediaContextMenu();
            return;
          }
          if (!imageViewer.classList.contains('hidden')) {
            mediaViewerController?.closeMediaViewerFromHistory?.();
            return;
          }
          if (modalManager.handlePopState()) return;
          if (isSearchPanelOpen()) {
            closeSearchPanel({ fromHistory: true });
            return;
          }
          if (isMobileLayoutViewport()) {
            const resolvedScene = getResolvedMobileBaseScene();
            if (resolvedScene === 'chat') {
              revealSidebarFromChat({ forceAnimation: true });
              normalizeMobileChatListHistoryState();
              return;
            }
            if (pendingMobileChatListHistoryNormalization || isMobileChatHistoryState(history.state)) {
              normalizeMobileChatListHistoryState();
              return;
            }
            // Already on chat list \u2014 push state back to prevent exit
            history.pushState({ view: 'chatlist' }, '');
          }
        });
    
        // New chat / folders
        $('#newChatBtn').addEventListener('click', openNewChatModal);
        // Create group
        $('#createGroupBtn').addEventListener('click', async () => {
          const name = $('#groupName').value.trim();
          if (!name) { alert('Enter group name'); return; }
          const selected = [...$$('#userListGroup .user-list-item.selected')].map(el => +el.dataset.uid);
          try {
            const chat = await api('/api/chats', { method: 'POST', body: { name, type: 'group', memberIds: selected } });
            closeAllModals();
            await loadChats();
            openChat(chat.id);
          } catch (e) { alert(e.message); }
        });
        $('#createDocumentBtn')?.addEventListener('click', async () => {
          const name = ($('#documentName')?.value || '').trim();
          if (!name) { alert(t('Enter document title')); return; }
          const selected = [...$$('#userListDocument .user-list-item.selected')].map(el => +el.dataset.uid);
          try {
            const chat = await api('/api/documents', { method: 'POST', body: { title: name, memberIds: selected } });
            closeAllModals();
            await loadChats();
            openChat(chat.id);
          } catch (e) { alert(e.message); }
        });
        newFolderTabController.bindEvents();
        folderManageModalController.bindEvents();
    
        // Modal tabs
        initNewChatTabSwipePager();
        newChatModal.querySelectorAll('.modal-tab').forEach(tab => {
          tab.addEventListener('click', () => {
            const nextTab = normalizeNewChatModalTab(tab.dataset.tab);
            const tabs = NEW_CHAT_MODAL_TABS;
            const currentIndex = tabs.indexOf(getNewChatModalActiveTab());
            const nextIndex = tabs.indexOf(nextTab);
            setNewChatModalTab(nextTab, {
              animate: true,
              direction: nextIndex >= currentIndex ? 1 : -1,
              source: 'tab',
            });
          });
        });
        const adminBotAuditCloseBtn = document.querySelector('#adminBotAuditModal .modal-close');
        if (adminBotAuditCloseBtn) {
          adminBotAuditCloseBtn.textContent = '\u2715';
          adminBotAuditCloseBtn.setAttribute('aria-label', 'Close');
          adminBotAuditCloseBtn.setAttribute('title', 'Close');
        }
    
        // Modal close buttons
        $$('.modal-close').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const modal = e.currentTarget.closest('.modal');
            if (!modal) return;
            closeModal(modal.id);
          });
        });
        $$('.modal').forEach(modal => {
          modal.addEventListener('click', (e) => {
            const entry = modalEntryOf(modal.id);
            if (!entry?.closeOnBackdrop) return;
            if (e.target === modal && getTopModal()?.id === modal.id) closeModal(modal.id);
          });
        });
    
        forwardingController?.bindEvents?.();
    
        // Settings controllers
        settingsModalController.bindEvents({ bindTouchSafeButtonActivation });
        weatherSettingsController.bindEvents({ bindAsyncActionButtons, withActionButtons });
        notificationSettingsController.bindEvents({ bindAsyncActionButtons });
        soundSettingsController.bindEvents();
    
        // Settings feature/admin buttons
        const bindLazyAiAdminPanel = (id, handler, runtimePacks = []) => {
          const button = document.getElementById(id);
          if (!button || button.dataset.bananzaAiAdminPanelBound === '1') return;
          button.dataset.bananzaAiAdminPanelBound = '1';
          bindFeaturePreload(button, ['ai-admin-ui', 'ai-admin-events', ...runtimePacks]);
          button.addEventListener('click', () => {
            const result = handler?.();
            if (result && typeof result.catch === 'function') {
              result.catch((error) => console.error('AI admin action failed', error));
            }
          });
        };
        const bindAiAdminAvailabilityToggle = (enabledId, availabilityId) => {
          const enabledToggle = document.getElementById(enabledId);
          const availabilityToggle = document.getElementById(availabilityId);
          if (!enabledToggle || !availabilityToggle) return;
          enabledToggle.addEventListener('change', () => {
            availabilityToggle.disabled = !enabledToggle.checked;
          });
        };
        $('#settingsChangePassword').addEventListener('click', openChangePasswordModal);
        bindFeaturePreload($('#settingsAdminPanel'), 'admin');
        bindFeaturePreload($('#settingsBackupPanel'), 'admin');
        $('#settingsAdminPanel').addEventListener('click', openAdminModal);
        $('#settingsBackupPanel')?.addEventListener('click', openBackupExportModal);
        bindLazyAiAdminPanel('settingsAiBotsPanel', openAiBotSettingsModal, ['openai-runtime']);
        bindLazyAiAdminPanel('settingsYandexAiPanel', openYandexAiSettingsModal, ['local-providers-runtime']);
        bindLazyAiAdminPanel('settingsDeepSeekAiPanel', openDeepseekAiSettingsModal, ['local-providers-runtime']);
        bindLazyAiAdminPanel('settingsQwenAiPanel', openQwenAiSettingsModal, ['local-providers-runtime']);
        bindLazyAiAdminPanel('settingsGrokAiPanel', openGrokAiSettingsModal, ['grok-runtime']);
        bindAiAdminAvailabilityToggle('contextConvertBotEnabled', 'contextConvertBotAvailableAllChats');
        bindAiAdminAvailabilityToggle('chatShotBotEnabled', 'chatShotBotAvailableAllChats');
        bindAsyncActionButtons('backupExportDownloadBtn', null, 'Preparing backup...', downloadBackupExport);
        bindAsyncActionButtons('backupRestorePreviewBtn', null, 'Validating backup...', previewBackupRestore);
        bindAsyncActionButtons('backupRestoreApplyBtn', null, 'Applying restore...', applyBackupRestore);
        $('#backupRestoreFilePickBtn')?.addEventListener('click', () => $('#backupRestoreFile')?.click());
        $('#backupRestoreFile')?.addEventListener('change', () => resetBackupRestoreState({ clearFile: false }));
        syncBackupRestoreFileName();
    
        // Change password save
        $('#cpSaveBtn').addEventListener('click', async () => {
          await withActionButtons('cpSaveBtn', 'Saving...', async () => {
            const cpErr = $('#cpError');
            const cpOk = $('#cpSuccess');
            cpErr.textContent = '';
            cpOk.textContent = '';
            const oldPass = $('#cpOldPass').value;
            const newPass = $('#cpNewPass').value;
            const confirmPass = $('#cpNewPassConfirm').value;
            if (!oldPass || !newPass) { cpErr.textContent = 'Fill in all fields'; return; }
            if (newPass !== confirmPass) { cpErr.textContent = 'New passwords do not match'; return; }
            if (newPass.length < 6) { cpErr.textContent = 'Password must be at least 6 characters'; return; }
            try {
              await api('/api/profile/change-password', { method: 'POST', body: { oldPassword: oldPass, newPassword: newPass } });
              cpOk.textContent = 'Password changed successfully!';
              resetChangePasswordFields();
            } catch (e) { cpErr.textContent = e.message; }
          });
        });
    
        // Menu button
        bindTouchSafeButtonActivation($('#menuBtn'), () => openMenuDrawer($('#menuBtn')));
    
        // Chat header actions
        bindTouchSafeButtonActivation(chatInfoBtn, () => {
          animateChatHeaderActionButton(chatInfoBtn);
          toggleChatHeaderActions();
        });
        bindTouchSafeButtonActivation(chatSettingsActionBtn, () => {
          closeChatHeaderActions();
          animateChatHeaderActionButton(chatSettingsActionBtn);
          openChatInfoModal(chatSettingsActionBtn);
        });
        bindTouchSafeButtonActivation(chatShotBtn, () => {
          closeChatHeaderActions();
          animateChatHeaderActionButton(chatShotBtn);
          runChatShotGeneration();
        });
    
        // Compact view toggle (per-chat)
        $('#compactViewToggle').addEventListener('change', (e) => {
          compactView = e.target.checked;
          if (currentChatId) {
            if (compactView) compactViewMap[currentChatId] = true;
            else delete compactViewMap[currentChatId];
            localStorage.setItem('compactViewMap', JSON.stringify(compactViewMap));
          }
          messagesEl.classList.toggle('compact-view', compactView);
          // Re-render
          if (currentChatId) openChat(currentChatId);
        });
        $('#chatNotifyToggle')?.addEventListener('change', () => saveChatPreferences());
        $('#chatSoundToggle')?.addEventListener('change', () => saveChatPreferences());
        $('#chatAllowUnpinAnyPinToggle')?.addEventListener('change', () => saveChatPinSettings());
        $('#copyChatInviteLinkBtn')?.addEventListener('click', () => copyCurrentChatInviteLink());
        $('#refreshChatInviteLinkBtn')?.addEventListener('click', () => refreshCurrentChatInviteLink());
    
        // Logout
        $('#profileLogoutBtn')?.addEventListener('click', () => { if (confirm('Logout?')) logout(); });
    
        // Load more
        loadMoreBtn.addEventListener('click', loadMore);
        const keepScrollBottomButtonKeyboardState = (e) => {
          if (!shouldPreserveKeyboardForScrollBottomGesture(e)) return;
          e.preventDefault();
        };
        const activateScrollBottomFromGesture = (e) => {
          if (Date.now() < scrollBottomFollowupClickSuppressUntil) {
            e.preventDefault?.();
            return;
          }
          if (!shouldPreserveKeyboardForScrollBottomGesture(e)) return;
          suppressScrollBottomFollowupClick();
          activateScrollBottomButton();
          e.preventDefault();
          e.stopPropagation();
        };
        scrollBottomBtn?.addEventListener('pointerdown', keepScrollBottomButtonKeyboardState, { passive: false });
        scrollBottomBtn?.addEventListener('pointerup', activateScrollBottomFromGesture, { passive: false });
        scrollBottomBtn?.addEventListener('touchstart', keepScrollBottomButtonKeyboardState, { passive: false });
        scrollBottomBtn?.addEventListener('touchend', activateScrollBottomFromGesture, { passive: false });
        scrollBottomBtn?.addEventListener('click', (e) => {
          if (Date.now() < scrollBottomFollowupClickSuppressUntil) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          activateScrollBottomButton();
        });
        messagesEl.addEventListener('wheel', noteMessageScrollUserIntent, { passive: true });
        messagesEl.addEventListener('touchmove', noteMessageScrollUserIntent, { passive: true });
    
        // Scroll to load more
        messagesEl.addEventListener('scroll', () => {
          hideAvatarUserMenu();
          hideFloatingMessageActions({ immediate: true });
          if (contextConvertPickerState.active && contextConvertPickerState.mode === 'message') hideContextConvertPicker();
          else positionContextConvertPicker();
          cancelPendingMediaBottomScrollIfNeeded();
          if (!scrollController.isScrollAnchorSaveSuppressed() && !openChatController.isLoadingMore() && !openChatController.isLoadingMoreAfter()) scheduleScrollAnchorSave();
          scheduleScrollDateIndicatorUpdate({ show: true });
          maybeLoadMoreAtTop();
          maybeLoadMoreAtBottom();
          if (!scrollController.isScrollAnchorSaveSuppressed() && isNearBottom(8)) markCurrentChatReadIfAtBottom();
          updateScrollBottomButton();
        });
    
        document.addEventListener('pointerdown', dismissEmojiPickerOutsideGesture, { passive: true, capture: true });
    
        // Reply bar close
        bindTouchSafeButtonActivation($('#replyBarClose'), ({ event, startKeyboardOpen }) => {
          event?.stopPropagation?.();
          const keepComposerFocus = Boolean(startKeyboardOpen || isMobileComposerKeyboardOpen());
          if (composerStateController.editTo) clearEdit({ clearInput: true });
          else clearReply();
          if (keepComposerFocus) focusComposerKeepKeyboard(true);
        });
    
        searchController?.bindEvents?.({ bindTouchSafeButtonActivation, closeChatHeaderActions, animateChatHeaderActionButton });
    
        // Drag & drop
        composerTypingDragDropController?.bindDragDropEvents?.(chatView);
    
        // Escape key
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            if (contextConvertPickerState.active) {
              e.preventDefault();
              hideContextConvertPicker();
              return;
            }
            if (isFloatingSurfaceVisible(chatFolderContextMenu)) {
              e.preventDefault();
              hideChatFolderContextMenu();
              return;
            }
            if (isFloatingSurfaceVisible(chatFolderPicker)) {
              e.preventDefault();
              hideChatFolderPicker();
              return;
            }
            if (isFloatingSurfaceVisible(chatContextMenu)) {
              e.preventDefault();
              hideChatContextMenu();
              return;
            }
            if (isFloatingSurfaceVisible(mediaContextMenu)) {
              e.preventDefault();
              hideMediaContextMenu();
              return;
            }
            if (hasOpenModal()) {
              e.preventDefault();
              closeTopModal();
              return;
            }
            if (isSearchPanelOpen()) {
              e.preventDefault();
              closeSearchPanel();
              return;
            }
            if (chatHeaderActionsOpen) {
              e.preventDefault();
              closeChatHeaderActions();
              focusElementIfPossible(chatInfoBtn);
              return;
            }
            if (isChatSearchOpen()) {
              e.preventDefault();
              setChatSearchOpen(false, { clear: true, focus: true });
              return;
            }
            hideAvatarUserMenu();
            clearReply();
          }
        });
      }
      return true;
    }

    return { bindAll };
  }

  shellRoot.profileStatusEditor = { createProfileStatusEditor, PROFILE_STATUS_OPTIONS };
  shellRoot.createEventController = createEventController;
})();
