(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const shellRoot = root.shell = root.shell || {};

  function createUiRuntimeAdapter(scope = {}) {
    with (scope) {
      // UTILS
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function isMobileLayoutViewport() {
        return window.innerWidth <= 768;
      }
    
      function normalizeMobileBaseScene(scene) {
        return scene === 'chat' ? 'chat' : 'sidebar';
      }
    
      function clearMobileSceneRepaint() {
        if (mobileSceneRepaintFrame) {
          cancelAnimationFrame(mobileSceneRepaintFrame);
          mobileSceneRepaintFrame = 0;
        }
        if (mobileSceneRepaintCleanupFrame) {
          cancelAnimationFrame(mobileSceneRepaintCleanupFrame);
          mobileSceneRepaintCleanupFrame = 0;
        }
        sidebar?.classList?.remove('mobile-scene-repaint');
        chatArea?.classList?.remove('mobile-scene-repaint');
        mobileSceneRepaintTarget = null;
      }
    
      function getResolvedMobileBaseScene(scene = mobileBaseScene) {
        const declaredScene = normalizeMobileBaseScene(document.documentElement?.dataset?.mobileScene || scene);
        if (!sidebar || !chatArea) return declaredScene;
        if (!isMobileLayoutViewport()) return declaredScene;
        if (mobileRouteTransitionActive) return declaredScene;
        if (chatArea.classList.contains('mobile-scene-hidden')) return 'sidebar';
        if (sidebar.classList.contains('mobile-scene-hidden')) return 'chat';
        if (sidebar.classList.contains('sidebar-hidden')) return 'chat';
        return declaredScene;
      }
    
      function isMobileBaseSceneHardHidden(el) {
        return Boolean(isMobileLayoutViewport() && el instanceof HTMLElement && el.classList.contains('mobile-scene-hidden'));
      }
    
      function setMobileSceneElementState(el, { active = false, hardHide = false } = {}) {
        if (!(el instanceof HTMLElement)) return;
        el.classList.toggle('mobile-scene-hidden', Boolean(hardHide));
        el.dataset.mobileSceneState = hardHide ? 'hidden' : (active ? 'active' : 'mounted');
        if (active) {
          el.removeAttribute('inert');
          el.setAttribute('aria-hidden', 'false');
        } else {
          blurFocusedElementWithin(el);
          el.setAttribute('inert', '');
          el.setAttribute('aria-hidden', 'true');
        }
      }
    
      function clearMobileSceneElementState(el) {
        if (!(el instanceof HTMLElement)) return;
        el.classList.remove('mobile-scene-hidden', 'mobile-scene-repaint');
        delete el.dataset.mobileSceneState;
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      }
    
      function scheduleActiveMobileSceneRepaint(scene = mobileBaseScene) {
        if (!isMobileLayoutViewport()) {
          clearMobileSceneRepaint();
          return false;
        }
        const target = normalizeMobileBaseScene(scene) === 'chat' ? chatArea : sidebar;
        if (!(target instanceof HTMLElement)) return false;
        clearMobileSceneRepaint();
        mobileSceneRepaintTarget = target;
        target.classList.add('mobile-scene-repaint');
        mobileSceneRepaintFrame = requestAnimationFrame(() => {
          mobileSceneRepaintFrame = 0;
          mobileSceneRepaintCleanupFrame = requestAnimationFrame(() => {
            mobileSceneRepaintCleanupFrame = 0;
            mobileSceneRepaintTarget?.classList?.remove('mobile-scene-repaint');
            mobileSceneRepaintTarget = null;
          });
        });
        return true;
      }
    
      function syncMobileBaseSceneState(options = {}) {
        if (!sidebar || !chatArea) return normalizeMobileBaseScene(options.scene || mobileBaseScene);
        const scene = normalizeMobileBaseScene(options.scene || getResolvedMobileBaseScene());
        mobileBaseScene = scene;
    
        if (!isMobileLayoutViewport()) {
          clearMobileSceneRepaint();
          clearMobileSceneElementState(sidebar);
          clearMobileSceneElementState(chatArea);
          sidebar.classList.remove('sidebar-hidden', 'sidebar-no-transition');
          sidebar.style.transform = '';
          sidebar.style.willChange = '';
          delete document.documentElement.dataset.mobileScene;
          return scene;
        }
    
        const hideInactive = Object.prototype.hasOwnProperty.call(options, 'hideInactive')
          ? !!options.hideInactive
          : !mobileRouteTransitionActive;
        const syncChatMetrics = Boolean(options.syncChatMetrics && scene === 'chat');
        const root = document.documentElement;
    
        if (scene === 'sidebar') {
          sidebar.classList.remove('sidebar-hidden');
          sidebar.classList.remove('mobile-scene-hidden');
        } else {
          chatArea.classList.remove('mobile-scene-hidden');
          sidebar.classList.add('sidebar-hidden');
        }
    
        if (syncChatMetrics) {
          syncMobileAppHeightToViewport({ force: true });
          syncChatAreaMetrics({ force: true });
          queueIosViewportLayoutSync();
        }
    
        setMobileSceneElementState(sidebar, {
          active: scene === 'sidebar',
          hardHide: hideInactive && scene !== 'sidebar',
        });
        setMobileSceneElementState(chatArea, {
          active: scene === 'chat',
          hardHide: hideInactive && scene !== 'chat',
        });
    
        root.dataset.mobileScene = scene;
        if (options.repaint) scheduleActiveMobileSceneRepaint(scene);
        return scene;
      }
    
      function getComposerTextValue(...args) { return composerTextController?.getComposerTextValue?.(...args) || ''; }
      function setComposerTextValue(...args) { return composerTextController?.setComposerTextValue?.(...args); }
      function normalizeComposerInputValue(...args) { return composerTextController?.normalizeComposerInputValue?.(...args) || false; }
      function snapComposerSelectionToCustomEmojiBoundary(...args) { return composerTextController?.snapComposerSelectionToCustomEmojiBoundary?.(...args) || false; }
      function insertComposerTextAtSelection(...args) { return composerTextController?.insertComposerTextAtSelection?.(...args); }
      function normalizeMicrophoneMode(value) { return uiSettings.normalizeMicrophoneMode(value); }
      function getMicrophoneMode() { return uiSettings.getMicrophoneMode(); }
      function setMicrophoneMode(value, options = {}) { return uiSettings.setMicrophoneMode(value, options); }
      function getScreenRotationAllowed() { return uiSettings.getScreenRotationAllowed(); }
      function syncScreenRotationToggle() { return uiSettings.syncScreenRotationToggle(); }
      function setScreenRotationStatus(message = '', type = '') { return uiSettings.setScreenRotationStatus(message, type); }
      function clearScreenRotationStatusSoon(delayMs = 2200) { return uiSettings.clearScreenRotationStatusSoon(delayMs); }
      function applyScreenRotationPreference(options = {}) { return uiSettings.applyScreenRotationPreference(options); }
      function setScreenRotationAllowed(value, options = {}) { return uiSettings.setScreenRotationAllowed(value, options); }
      function insertDictatedText(...args) { return composerTextController?.insertDictatedText?.(...args) || getComposerTextValue(); }
      function getEmojiPickerInsertionValue(...args) { return composerTextController?.getEmojiPickerInsertionValue?.(...args) || ''; }
      function deleteComposerCustomEmojiCluster(...args) { return composerTextController?.deleteComposerCustomEmojiCluster?.(...args) || false; }
      function handleComposerCustomEmojiKeydown(...args) { return composerTextController?.handleComposerCustomEmojiKeydown?.(...args) || false; }
      function handleComposerCustomEmojiBeforeInput(...args) { return composerTextController?.handleComposerCustomEmojiBeforeInput?.(...args) || false; }
    
      function safeVibrate(pattern) {
        if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
        const activation = navigator.userActivation;
        if (activation && !activation.hasBeenActive) return false;
        try {
          return navigator.vibrate(pattern);
        } catch (e) {
          return false;
        }
      }

      function linkify(text) {
        return esc(text).replace(
          /https?:\/\/[^\s<>"')\]]+|\/join\/[A-Za-z0-9_-]{32,128}/gi,
          (url) => renderLinkAnchor(url)
        );
      }
    
      function mentionKey(...args) { return composerMentionsController?.mentionKey?.(...args) || ''; }
    
      function renderMessageText(text, mentions = []) {
        const source = String(text || '');
        if (!source) return '';
        const mentionMap = new Map();
        (Array.isArray(mentions) ? mentions : []).forEach((mention) => {
          const token = mentionKey(mention.token || mention.mention || mention.username);
          if (token && !mentionMap.has(token)) mentionMap.set(token, mention);
        });
        const re = /(:qip-infium-\d{3}:|:qip-hd-[a-z0-9][a-z0-9-]{0,63}:)|(https?:\/\/[^\s<>"')\]]+|\/join\/[A-Za-z0-9_-]{32,128})|@([a-zA-Z0-9_][a-zA-Z0-9_-]{0,31})/gi;
        let html = '';
        let lastIndex = 0;
        let match;
        while ((match = re.exec(source))) {
          html += esc(source.slice(lastIndex, match.index));
          if (match[1]) {
            html += isCustomEmojiToken(match[1])
              ? renderCustomEmojiHtml(match[1])
              : esc(match[1]);
          } else if (match[2]) {
            const url = match[2];
            html += renderLinkAnchor(url);
          } else {
            const prev = match.index > 0 ? source[match.index - 1] : '';
            const token = mentionKey(match[3]);
            const mention = !prev || !/[A-Za-z0-9_.-]/.test(prev) ? mentionMap.get(token) : null;
            if (mention) {
              html += `<button type="button" class="mention-link${mention.is_ai_bot ? ' is-bot' : ''}" data-mention-user-id="${Number(mention.user_id) || 0}" data-mention-token="${esc(mention.token || mention.mention || mention.username || token)}" data-mention-bot="${mention.is_ai_bot ? '1' : '0'}">@${esc(match[3])}</button>`;
            } else {
              html += esc(match[0]);
            }
          }
          lastIndex = re.lastIndex;
        }
        html += esc(source.slice(lastIndex));
        return html;
      }
    
      function normalizeUiTheme(theme) { return uiSettings.normalizeUiTheme(theme); }
      function renderThemePicker() { return uiSettings.renderThemePicker(); }
      function applyUiTheme(theme, persist = true) { return uiSettings.applyUiTheme(theme, persist); }
      function selectUiTheme(theme) { return uiSettings.selectUiTheme(theme); }
      function setThemeStatus(message, type = '') { return uiSettings.setThemeStatus(message, type); }
      function normalizeUiLanguage(language) { return uiSettings.normalizeUiLanguage(language); }
      function languageDisplayName(language = currentUiLanguage) { return uiSettings.languageDisplayName(language); }
      function renderLanguagePicker() { return uiSettings.renderLanguagePicker(); }
      function applyUiLanguage(language, persist = true) { return uiSettings.applyUiLanguage(language, persist); }
      function selectUiLanguage(language) { return uiSettings.selectUiLanguage(language); }
      function refreshLocalizedUi() { return uiSettings.refreshLocalizedUi(); }
      function syncLanguageSettingsButton() { return uiSettings.syncLanguageSettingsButton(); }
      function setLanguageStatus(message, type = '') { return uiSettings.setLanguageStatus(message, type); }
      function normalizeVisualMode(mode) { return uiSettings.normalizeVisualMode(mode); }
      function visualModeMeta(mode) { return uiSettings.visualModeMeta(mode); }
      function visualModeStateLabel(mode) { return uiSettings.visualModeStateLabel(mode); }
      function renderVisualModePicker() { return uiSettings.renderVisualModePicker(); }
      function applyVisualMode(mode, persist = true) { return uiSettings.applyVisualMode(mode, persist); }
      function selectVisualMode(mode) { return uiSettings.selectVisualMode(mode); }
      function setVisualModeStatus(message, type = '') { return uiSettings.setVisualModeStatus(message, type); }
      function normalizePollStyle(style) { return uiSettings.normalizePollStyle(style); }
      function pollStyleMeta(style) { return uiSettings.pollStyleMeta(style); }
      function renderPollStyleCardPreview(styleId) { return uiSettings.renderPollStyleCardPreview(styleId); }
      function renderPollStylePicker() { return uiSettings.renderPollStylePicker(); }
      function setPollStyleSurface(modalEl, style) { return uiSettings.setPollStyleSurface(modalEl, style); }
      function syncPollComposerStyleUi() { return uiSettings.syncPollComposerStyleUi(); }
      function selectPollStyle(style) { return uiSettings.selectPollStyle(style); }
      function setPollStyleStatus(message, type = '') { return uiSettings.setPollStyleStatus(message, type); }
      function normalizeModalAnimationStyle(style) { return uiSettings.normalizeModalAnimationStyle(style); }
      function modalAnimationMeta(style = currentModalAnimation) { return uiSettings.modalAnimationMeta(style); }
      function syncModalAnimationSettingsButton() { return uiSettings.syncModalAnimationSettingsButton(); }
      function normalizeModalAnimationSpeed(speed) { return uiSettings.normalizeModalAnimationSpeed(speed); }
      function getModalAnimationSpeedFactor(speed = currentModalAnimationSpeed) { return uiSettings.getModalAnimationSpeedFactor(speed); }
      function setModalAnimationStatus(message, type = '') { return uiSettings.setModalAnimationStatus(message, type); }
      function clearModalAnimationStatusTimer() { return uiSettings.clearModalAnimationStatusTimer(); }
      function scheduleModalAnimationStatusClear() { return uiSettings.scheduleModalAnimationStatusClear(); }
      function getPersistedModalAnimationPreferences() { return uiSettings.getPersistedModalAnimationPreferences(); }
      function getCurrentModalAnimationPreferences() { return uiSettings.getCurrentModalAnimationPreferences(); }
      function modalAnimationPreferencesEqual(a = {}, b = {}) { return uiSettings.modalAnimationPreferencesEqual(a, b); }
      function renderModalAnimationOptions() { return uiSettings.renderModalAnimationOptions(); }
      function renderModalAnimationSpeedControl() { return uiSettings.renderModalAnimationSpeedControl(); }
      function applyModalAnimation(style, persist = true) { return uiSettings.applyModalAnimation(style, persist); }
      function applyModalAnimationSpeed(speed, persist = true) { return uiSettings.applyModalAnimationSpeed(speed, persist); }
      function flushModalAnimationSave() { return uiSettings.flushModalAnimationSave(); }
      function scheduleModalAnimationSave(options = {}) { return uiSettings.scheduleModalAnimationSave(options); }
      function selectModalAnimation(style) { return uiSettings.selectModalAnimation(style); }
      function updateModalAnimationSpeed(speed, options = {}) { return uiSettings.updateModalAnimationSpeed(speed, options); }
      function normalizeMobileFontSize(size) { return uiSettings.normalizeMobileFontSize(size); }
      function getMobileFontAdjustPercent(size = currentMobileFontSize) { return uiSettings.getMobileFontAdjustPercent(size); }
      function hasAndroidNativeBridge() { return uiSettings.hasAndroidNativeBridge(); }
      function notifyAndroidScreenRotationPreference(reason = 'sync') { return uiSettings.notifyAndroidScreenRotationPreference(reason); }
      function setMobileFontAdjustPercent(percent = 100) { return uiSettings.setMobileFontAdjustPercent(percent); }
      function notifyAndroidMobileFontSize(size = currentMobileFontSize) { return uiSettings.notifyAndroidMobileFontSize(size); }
      function syncMobileFontSettingsButton() { return uiSettings.syncMobileFontSettingsButton(); }
      function setMobileFontSizeStatus(message, type = '') { return uiSettings.setMobileFontSizeStatus(message, type); }
      function clearMobileFontSizeStatusTimer() { return uiSettings.clearMobileFontSizeStatusTimer(); }
      function scheduleMobileFontSizeStatusClear() { return uiSettings.scheduleMobileFontSizeStatusClear(); }
      function getPersistedMobileFontSize() { return uiSettings.getPersistedMobileFontSize(); }
      function renderMobileFontSizeControl() { return uiSettings.renderMobileFontSizeControl(); }
      function applyMobileFontSize(size, persist = true) { return uiSettings.applyMobileFontSize(size, persist); }
      function syncMobileFontSizeViewportState() { return uiSettings.syncMobileFontSizeViewportState(); }
      function flushMobileFontSizeSave() { return uiSettings.flushMobileFontSizeSave(); }
      function scheduleMobileFontSizeSave(options = {}) { return uiSettings.scheduleMobileFontSizeSave(options); }
      function updateMobileFontSize(size, options = {}) { return uiSettings.updateMobileFontSize(size, options); }
      let singleEmojiPattern = null;
      function getSingleEmojiPattern() {
        if (singleEmojiPattern !== null) return singleEmojiPattern;
        try {
          singleEmojiPattern = new RegExp(
            '^(?:' +
              '(?:\\p{Regional_Indicator}{2})|' +
              '(?:[0-9#*]\\uFE0F?\\u20E3)|' +
              '(?:\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:\\p{Emoji_Modifier})?(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:\\p{Emoji_Modifier})?)*)' +
            ')$',
            'u'
          );
        } catch {
          singleEmojiPattern = false;
        }
        return singleEmojiPattern;
      }
    
      function splitGraphemes(value) {
        if (window.Intl?.Segmenter) {
          return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), part => part.segment);
        }
        return Array.from(value);
      }
    
      function isSingleEmojiMessage(text) {
        const value = String(text || '').trim();
        if (!value) return false;
        if (isSingleCustomEmojiMessage(value)) return true;
        const graphemes = splitGraphemes(value);
        if (graphemes.length !== 1) return false;
        const pattern = getSingleEmojiPattern();
        if (pattern) return pattern.test(graphemes[0]);
        return /^(?:[\u00A9\u00AE]|[\u203C-\u3299]\uFE0F?|[\uD800-\uDBFF][\uDC00-\uDFFF])$/.test(graphemes[0]);
      }
    
      function applyPosterToVideoElement(...args) {
        return messageAttachmentRenderer?.applyPosterToVideoElement?.(...args);
      }
    
      function markAttachmentPosterAvailable(...args) {
        return messageAttachmentRenderer?.markAttachmentPosterAvailable?.(...args);
      }
    
      function ensureAttachmentPoster(...args) {
        return messageAttachmentRenderer?.ensureAttachmentPoster?.(...args);
      }
    
      async function localAttachmentFromFile(file) {
        if (!file) return null;
        const mime = normalizeMimeType(file.type);
        const ext = fileExtension(file.name);
        const type = IMAGE_MIME_TYPES.has(mime) || IMAGE_EXTENSIONS.has(ext)
          ? 'image'
          : (AUDIO_MIME_TYPES.has(mime) || AUDIO_EXTENSIONS.has(ext)
              ? 'audio'
              : (VIDEO_MIME_TYPES.has(mime) || VIDEO_EXTENSIONS.has(ext) ? 'video' : 'document'));
        if (!type) return null;
    
        const attachment = {
          localId: makeClientId('f'),
          file,
          name: file.name,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          type,
        };
        if (type === 'video') {
          try {
            const posterBlob = await createAttachmentPosterBlob(file);
            if (posterBlob) attachment.posterBlob = posterBlob;
          } catch (error) {}
        }
        return attachment;
      }
    
      function makeClientId(prefix = 'c') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      }
    
      function isClientSideMessage(msg) {
        return Boolean(msg?.is_outbox || msg?.client_status || (typeof msg?.id === 'string' && msg.id.startsWith('c-')));
      }
    
      function setPollComposerStatus(...args) { return pollComposerController?.setPollComposerStatus?.(...args); }
    
      function readPollComposerForm(...args) { return pollComposerController?.readPollComposerForm?.(...args) || { question: '', options: [] }; }
    
      function renderPollComposerOptionInputs(...args) { return pollComposerController?.renderPollComposerOptionInputs?.(...args); }
    
      function refreshPollComposerActionState(...args) { return pollComposerController?.refreshPollComposerActionState?.(...args); }
    
      function buildPollComposerPreviewMessage(...args) { return pollComposerController?.buildPollComposerPreviewMessage?.(...args) || null; }
    
      function refreshPollComposerPreview(...args) { return pollComposerController?.refreshPollComposerPreview?.(...args); }
    
      function resetPollComposer(...args) { return pollComposerController?.resetPollComposer?.(...args); }
    
      function openPollComposer(...args) { return pollComposerController?.openPollComposer?.(...args); }
    
async function submitPollComposer(...args) { return pollComposerController?.submitPollComposer?.(...args); }
    
      function avatarHtml(name, color, avatarUrl, size) {
        const cls = size === 'large' ? 'avatar-large' : 'avatar';
        if (avatarUrl) {
          return `<div class="${cls}" style="background:${color}"><img class="avatar-img" src="${esc(avatarUrl)}" alt="" loading="lazy" onerror="this.remove()"></div>`;
        }
        return `<div class="${cls}" style="background:${color}">${initials(name)}</div>`;
      }
    
      function isAiBotDirectoryUser(user) {
        return Number(user?.is_ai_bot || 0) !== 0;
      }
    
      function botMentionText(user) {
        const mention = String(user?.ai_bot_mention || '').trim();
        if (mention) return `@${mention}`;
        const username = String(user?.username || '').trim();
        return username ? `@${username}` : '';
      }
    
      function botModelText(user) {
        return String(user?.ai_bot_model || '').trim();
      }
    
      function botChatMemberMetaText(user) {
        return [botMentionText(user), botModelText(user)].filter(Boolean).join(' \u2022 ') || 'AI bot';
      }

      function normalizeProfileStatusText(value) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 48); }

      function profileStatusLabel(user) {
        if (!user || isAiBotDirectoryUser(user)) return '';
        const key = String(user.profile_status_key || '').trim().toLowerCase();
        if (key === 'custom') return normalizeProfileStatusText(user.profile_status_text);
        const labels = { available: 'Available', busy: 'Busy', dnd: 'Do not disturb', away: 'Away', working: 'Working', resting: 'Resting' };
        return labels[key] ? t(labels[key]) : '';
      }

      function userHandleText(user) { return user?.username ? `@${user.username}` : ''; }

      function userProfileLineText(user) { return [profileStatusLabel(user), userHandleText(user)].filter(Boolean).join(' \u2022 '); }

      function userSecondaryLineText(user, { showPresence = false } = {}) {
        if (isAiBotDirectoryUser(user)) {
          return ['AI bot', botMentionText(user), botModelText(user)].filter(Boolean).join(' \u2022 ');
        }
        return userProfileLineText(user) || (showPresence ? (user?.online ? 'online' : 'offline') : '');
      }
    
      function renderSelectableUserItem(user, { showPresence = false } = {}) {
        return `
          <div class="user-list-item${isAiBotDirectoryUser(user) ? ' is-ai-bot' : ''}" data-uid="${user.id}">
            ${avatarHtml(user.display_name, user.avatar_color, user.avatar_url)}
            <div class="user-list-copy">
              <div class="name">${esc(user.display_name)}</div>
              <div class="user-list-meta">${esc(userSecondaryLineText(user, { showPresence }))}</div>
            </div>
          </div>
        `;
      }
    
      function renderChatMemberItem(user, { ownerId = 0, canRemove = false } = {}) {
        const isOwner = ownerId && Number(user?.id) === Number(ownerId);
        const isBot = isAiBotDirectoryUser(user);
        const isOnline = onlineUsers.has(user?.id);
        const status = profileStatusLabel(user);
        const presenceText = isOnline ? 'online' : 'offline';
        return `
          <div class="user-list-item${isOwner ? ' chat-owner' : ''}${isBot ? ' is-ai-bot' : ''}" data-uid="${user.id}" data-bot="${isBot ? 1 : 0}">
            <div class="member-avatar-wrap${isOwner ? ' is-owner' : ''}" title="${isOwner ? 'Chat creator' : ''}">
              ${avatarHtml(user.display_name, user.avatar_color, user.avatar_url)}
              ${isOwner ? '<span class="member-owner-crown" aria-label="Chat creator" title="Chat creator">&#128081;</span>' : ''}
            </div>
            <div class="user-list-copy">
              <div class="name">${esc(user.display_name)}</div>
              ${isBot
                ? `<div class="user-list-meta">${esc(botChatMemberMetaText(user))}</div>`
                : `<div class="admin-user-status ${isOnline ? 'online' : 'offline'}"><span class="status-dot"></span><span class="admin-user-status-label">${presenceText}${status ? ` <span class="user-profile-status-inline">\u2022 ${esc(status)}</span>` : ''}</span></div>`}
            </div>
            ${canRemove && Number(user.id) !== Number(currentUser?.id || 0) ? `<button class="member-remove" data-uid="${user.id}" title="Remove">\u2715</button>` : ''}
          </div>
        `;
      }
    
      function formatBotAuditSource(source) {
        return adminBotAuditController.formatBotAuditSource(source);
      }
    
      function ensureBotVisibilityToggles() {
        const configs = [
          ['aiBotEnabled', 'aiBotVisibleToUsers'],
          ['openAiUniversalBotEnabled', 'openAiUniversalBotVisibleToUsers'],
          ['openAiImageBotEnabled', 'openAiImageBotVisibleToUsers'],
          ['deepseekAiBotEnabled', 'deepseekAiBotVisibleToUsers'],
          ['qwenAiBotEnabled', 'qwenAiBotVisibleToUsers'],
          ['yandexAiBotEnabled', 'yandexAiBotVisibleToUsers'],
          ['grokAiBotEnabled', 'grokAiBotVisibleToUsers'],
          ['grokAiImageBotEnabled', 'grokAiImageBotVisibleToUsers'],
          ['grokAiUniversalBotEnabled', 'grokAiUniversalBotVisibleToUsers'],
        ];
        configs.forEach(([enabledId, visibleId]) => {
          if (document.getElementById(visibleId)) return;
          const enabledInput = document.getElementById(enabledId);
          const grid = enabledInput?.closest('.ai-bot-grid');
          if (!grid) return;
          const wrap = document.createElement('div');
          wrap.className = 'ai-bot-toggle-label';
          wrap.innerHTML = `
            <span>Display to users</span>
            <label class="toggle-switch">
              <input type="checkbox" id="${visibleId}">
              <span class="toggle-slider"></span>
            </label>
          `;
          grid.appendChild(wrap);
        });
      }
    
      function setBotVisibilityToggle(inputId, value = false) {
        const input = document.getElementById(inputId);
        if (input) input.checked = !!value;
      }
    
      function getBotVisibilityToggle(inputId) {
        return !!document.getElementById(inputId)?.checked;
      }
    
      function updateCurrentUserFooter() {
        currentUserInfo.innerHTML = avatarHtml(currentUser.display_name, currentUser.avatar_color, currentUser.avatar_url, 28) +
          `<span class="current-user-name">${esc(currentUser.display_name)}</span>`;
      }
    
      function persistCurrentUser() {
        if (!currentUser) return;
        localStorage.setItem('user', JSON.stringify(currentUser));
      }
    
      function syncChatAreaMetrics(options = {}) {
        if (!chatArea) return;
        const force = Boolean(options && typeof options === 'object' && options.force);
        if (!force && isMobileBaseSceneHardHidden(chatArea)) return;
        const rect = chatArea.getBoundingClientRect();
        const root = document.documentElement;
        const width = Math.max(0, rect.width || 0);
        const height = Math.max(0, rect.height || 0);
        const bgHeight = Math.max(height || window.innerHeight || 0, isMobileLayoutViewport() && typeof getMobileViewportBaselineHeight === 'function' ? Number(getMobileViewportBaselineHeight() || 0) || 0 : 0);
        if (!force && isMobileLayoutViewport() && (!width || !height)) return;
        root.style.setProperty('--chat-area-left', `${Math.max(0, rect.left || 0)}px`);
        root.style.setProperty('--chat-area-top', `${Math.max(0, rect.top || 0)}px`);
        root.style.setProperty('--chat-area-width', `${Math.max(0, width || window.innerWidth || 0)}px`);
        root.style.setProperty('--chat-area-height', `${Math.max(0, height || window.innerHeight || 0)}px`);
        root.style.setProperty('--chat-bg-stable-height', `${Math.round(bgHeight)}px`);
        queueIosViewportLayoutSync();
      }
    
      function syncMobileAppHeightToViewport(options = {}) {
        const force = Boolean(options && typeof options === 'object' && options.force);
        const app = document.getElementById('app');
        if (!app || !window.visualViewport || !isMobileLayoutViewport()) return;
        const newViewportHeight = Math.max(0, window.visualViewport?.height || 0);
        const mentionPickerDismissed = dismissMentionPickerAfterKeyboardClose();
        getMobileViewportBaselineHeight();
        const rawViewport = getMobileVisualViewportMetrics();
        const inputHeight = Math.max(0, Math.round(inputArea?.getBoundingClientRect?.().height || 0));
        const keyboardLayoutActive = isMobileChatKeyboardLayoutActive();
        const viewport = getLockedMobileKeyboardViewportMetrics(rawViewport, keyboardLayoutActive, inputHeight);
        const newAppHeight = getMobileAppViewportHeight(keyboardLayoutActive ? viewport : rawViewport);
        if (!shouldBypassLockedMobileViewportSync(newViewportHeight, { force, mentionPickerDismissed })) {
          mobileViewportPrevHeight = newViewportHeight;
          queueMobileViewportLayoutSync();
          return;
        }
        app.style.height = `${Math.round(newAppHeight)}px`;
        app.style.paddingTop = '0px';
        syncChatAreaMetrics();
        queueMobileViewportLayoutSync();
        if (newViewportHeight < mobileViewportPrevHeight && messagesEl) {
          requestAnimationFrame(() => {
            if (!shouldBypassLockedMobileViewportSync(newViewportHeight, { force, mentionPickerDismissed })) return;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          });
        }
        mobileViewportPrevHeight = newViewportHeight;
      }
    
      function forceMobileViewportLayoutSync() {
        syncMobileAppHeightToViewport({ force: true });
        syncChatAreaMetrics();
      }
    
      function scheduleMobileViewportRecovery(retryDelayMs = 140) {
        if (!window.visualViewport || !isMobileLayoutViewport()) return false;
        if (mobileViewportRecoveryFrame) cancelAnimationFrame(mobileViewportRecoveryFrame);
        clearTimeout(mobileViewportRecoveryTimer);
    
        const runRecovery = () => {
          forceMobileViewportLayoutSync();
          syncChatAreaMetrics();
          queueMobileViewportLayoutSync();
        };
    
        mobileViewportRecoveryFrame = requestAnimationFrame(() => {
          mobileViewportRecoveryFrame = 0;
          runRecovery();
        });
    
        mobileViewportRecoveryTimer = setTimeout(() => {
          mobileViewportRecoveryTimer = null;
          requestAnimationFrame(runRecovery);
        }, Math.max(60, Number(retryDelayMs) || 140));
        return true;
      }
    
      function setupMobileViewportHeightSync() {
        if (!window.visualViewport || !isMobileLayoutViewport() || mobileViewportHeightSyncBound) return;
        mobileViewportHeightSyncBound = true;
        mobileViewportPrevHeight = Math.max(0, window.visualViewport.height || 0);
        syncMobileAppHeightToViewport({ force: true });
        window.visualViewport.addEventListener('resize', syncMobileAppHeightToViewport);
        window.visualViewport.addEventListener('scroll', syncMobileAppHeightToViewport);
        window.addEventListener('scroll', () => {
          if (!restoreMobileKeyboardDocumentScroll()) return;
          queueMobileViewportLayoutSync();
        }, { passive: true });
        window.addEventListener('orientationchange', () => {
          mobileVisualViewportBaselineHeight = 0;
          mobileVisualViewportBaselineWidth = 0;
          resetMobileKeyboardDock();
          syncMobileAppHeightToViewport({ force: true });
        });
        if ('ResizeObserver' in window && !mobileViewportElementResizeObserver) {
          mobileViewportElementResizeObserver = new ResizeObserver(() => {
            queueMobileViewportLayoutSync();
          });
          if (chatHeader) mobileViewportElementResizeObserver.observe(chatHeader);
          if (inputArea) mobileViewportElementResizeObserver.observe(inputArea);
        }
      }
    
      function setupChatAreaMetricsSync() {
        syncMobileBaseSceneState({ hideInactive: true, syncChatMetrics: getResolvedMobileBaseScene() === 'chat' });
        syncChatAreaMetrics();
        window.addEventListener('resize', syncMobileBaseSceneState);
        window.addEventListener('resize', syncChatAreaMetrics);
        window.visualViewport?.addEventListener('resize', syncChatAreaMetricsFromViewport);
        window.visualViewport?.addEventListener('scroll', syncChatAreaMetricsFromViewport);
        if ('ResizeObserver' in window && chatArea && !chatAreaResizeObserver) {
          chatAreaResizeObserver = new ResizeObserver(syncChatAreaMetrics);
          chatAreaResizeObserver.observe(chatArea);
        }
      }
    
      function isAbortError(error) {
        return error?.name === 'AbortError';
      }
    
      function isCurrentChatOpenTransition(seq, chatId = currentChatId) {
        return openChatController.isCurrentChatOpenTransition(seq, chatId);
      }
    
      function isUiTransitionBusy() {
        return Boolean(openChatController.isChatOpenInProgress() || mobileRouteTransitionActive);
      }
    
      function isMobileViewportLayoutLocked() {
        if (!isMobileLayoutViewport()) return false;
        if (mobileRouteTransitionActive) return true;
        if (hasOpenModal()) return true;
        if (searchPanel && searchPanel.getAttribute('aria-hidden') === 'false') return true;
        if (isFloatingSurfaceVisible(chatContextMenuBackdrop)
          || isFloatingSurfaceVisible(chatContextMenu)
          || isFloatingSurfaceVisible(chatFolderPickerBackdrop)
          || isFloatingSurfaceVisible(chatFolderPicker)
          || isFloatingSurfaceVisible(chatFolderContextMenuBackdrop)
          || isFloatingSurfaceVisible(chatFolderContextMenu)
          || isFloatingSurfaceVisible(mediaContextMenuBackdrop)
          || isFloatingSurfaceVisible(mediaContextMenu)
          || isFloatingSurfaceVisible(reactionPicker)
          || isFloatingSurfaceVisible(reactionEmojiPopover)
          || isFloatingSurfaceVisible($('#mentionPicker'))
          || isFloatingSurfaceVisible(emojiPicker)
          || isFloatingSurfaceVisible(imageViewer)) {
          return true;
        }
        const attachMenu = $('#attachMenu');
        return Boolean(attachMenu && !attachMenu.classList.contains('hidden'));
      }
    
      function syncChatAreaMetricsFromViewport() {
        if (isMobileViewportLayoutLocked() && !isIosViewportFixTarget) return;
        syncChatAreaMetrics();
      }
    
      function flushDeferredRecoverySync(reason = 'transition-complete') {
        return chatListService.flushDeferredRecoverySync(reason);
      }
    
      function setChatHydrating(active) {
        if (active) document.documentElement.dataset.viewTransition = 'chat-open';
        else if (document.documentElement.dataset.viewTransition === 'chat-open') delete document.documentElement.dataset.viewTransition;
      }
    
      function revealChatHydration(seq, chatId = currentChatId) {
        if (seq && !isCurrentChatOpenTransition(seq, chatId)) return false;
        setChatHydrating(false);
        return true;
      }
    
      function beginMobileRouteTransition(durationMs = 340) {
        if (!isMobileLayoutViewport()) return false;
        mobileRouteTransitionActive = true;
        clearTimeout(mobileRouteTransitionTimer);
        document.documentElement.classList.add('is-mobile-route-transitioning');
        mobileRouteTransitionTimer = setTimeout(() => {
          endMobileRouteTransition();
        }, Math.max(120, Number(durationMs) || 340));
        return true;
      }
    
      function endMobileRouteTransition() {
        const finalScene = normalizeMobileBaseScene(mobileBaseScene);
        clearTimeout(mobileRouteTransitionTimer);
        mobileRouteTransitionTimer = null;
        mobileRouteTransitionActive = false;
        document.documentElement.classList.remove('is-mobile-route-transitioning');
        syncMobileBaseSceneState({
          scene: finalScene,
          hideInactive: true,
          syncChatMetrics: finalScene === 'chat',
          repaint: true,
        });
        flushDeferredRecoverySync();
      }
    
      function isChatSearchOpen() {
        return Boolean(sidebarSearch && sidebarSearch.getAttribute('aria-hidden') === 'false');
      }
    
      function focusChatSearchInput() {
        requestAnimationFrame(() => {
          if (isChatSearchOpen()) focusElementIfPossible(chatSearch);
        });
      }
    
      function setChatSearchOpen(open, { clear = false, focus = false, render = true } = {}) {
        if (!sidebarSearch || !chatSearch) return false;
        const shouldOpen = !!open;
    
        if (clear) {
          chatSearch.value = '';
          chatListStore.resetHiddenChatSearch();
        }
    
        sidebarSearch.classList.toggle('is-collapsed', !shouldOpen);
        sidebarSearch.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
        sidebar?.classList.toggle('sidebar-search-open', shouldOpen);
        chatSearchToggle?.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        chatSearchToggle?.classList.toggle('is-active', shouldOpen);
        chatSearch.tabIndex = shouldOpen ? 0 : -1;
        if (chatSearchClear) chatSearchClear.tabIndex = shouldOpen ? 0 : -1;
    
        if (clear && render) {
          renderChatList();
        }
    
        if (shouldOpen && focus) {
          focusChatSearchInput();
        } else if (!shouldOpen) {
          if (document.activeElement === chatSearch) chatSearch.blur();
          if (focus) focusElementIfPossible(chatSearchToggle);
        }
    
        return true;
      }
    
      function setChatFolderManageStatus(message, type = '') { return folderManageModalController.setChatFolderManageStatus(message, type); }
      function chatFolderIconEmoji(kind = 'custom') { return folderUiController.chatFolderIconEmoji(kind); }
      function chatFolderEmojiMarkup(kind = 'custom', className = 'chat-folder-picker-emoji') { return folderUiController.chatFolderEmojiMarkup(kind, className); }
      function chatFolderIconMarkup(kind = 'custom') { return folderUiController.chatFolderIconMarkup(kind); }
      function normalizeChatFolderId(folderId) { return window.BananzaApp.folders.store.normalizeChatFolderId(folderId, appConfig); }
      function shouldShowActiveChatFolderBar() { return folderUiController.shouldShowActiveChatFolderBar(); }
      function activeChatFolderStripRows() { return folderUiController.activeChatFolderStripRows(); }
      function getRenderedChatFolderSelectionId() { return folderUiController.getRenderedChatFolderSelectionId(); }
      function isChatFolderStripVisibleInAllChatsEnabled() { return folderUiController.isChatFolderStripVisibleInAllChatsEnabled(); }
      function syncChatFolderPickerAllChatsToggleState() { return folderUiController.syncChatFolderPickerAllChatsToggleState(); }
      function applyChatFolderStripVisibilityInAllChats(enabled, options = {}) { return folderUiController.applyChatFolderStripVisibilityInAllChats(enabled, options); }
      function saveChatFolderStripVisibilityInAllChats(nextValue) { return folderUiController.saveChatFolderStripVisibilityInAllChats(nextValue); }
      function shouldShowChatFolderBarForSelection(folderId, options = {}) { return folderUiController.shouldShowChatFolderBarForSelection(folderId, options); }
      function chatFolderStripStructureSignature(rows = []) { return folderUiController.chatFolderStripStructureSignature(rows); }
      function chatFolderStripLabelForSelection(folderId, rows) { return folderUiController.chatFolderStripLabelForSelection(folderId, rows); }
      function setPendingChatFolderChipCenterBehavior(behavior = 'auto') { return folderUiController.setPendingChatFolderChipCenterBehavior(behavior); }
      function cancelScheduledActiveChatFolderChipCenter() { return folderUiController.cancelScheduledActiveChatFolderChipCenter(); }
      function centerActiveChatFolderChip(options = {}) { return folderUiController.centerActiveChatFolderChip(options); }
      function scheduleActiveChatFolderChipCenter(options = {}) { return folderUiController.scheduleActiveChatFolderChipCenter(options); }
      function renderChatFolderStripStructure(options = {}) { return folderUiController.renderChatFolderStripStructure(options); }
      function syncActiveChatFolderStripState(selectedFolderId, options = {}) { return folderUiController.syncActiveChatFolderStripState(selectedFolderId, options); }
      function renderActiveChatFolderBar(options = {}) { return folderUiController.renderActiveChatFolderBar(options); }
      function beginChatFolderStripPreview(folderId, options = {}) { return folderUiController.beginChatFolderStripPreview(folderId, options); }
      function finalizeChatFolderStripPreview(options = {}) { return folderUiController.finalizeChatFolderStripPreview(options); }
    
      function getChatFolderSwitchTargets() {
        return [chatFolderListSurface].filter((el) => (
          el instanceof HTMLElement && !el.classList.contains('hidden')
        ));
      }
    
      function resetChatFolderSwitchAnimations(targets = []) {
        targets.forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          el.classList.remove(
            'is-folder-switching',
            'is-folder-switching-in',
            'is-folder-switching-out',
            'is-folder-switching-active'
          );
        });
      }
    
      function destroyChatFolderSwipePager() {
        const state = chatFolderSwipePagerState;
        chatFolderSwipePagerState = null;
        if (state?.stage instanceof HTMLElement) state.stage.remove();
        if (chatFolderListSurface instanceof HTMLElement) {
          chatFolderListSurface.classList.remove('is-folder-swipe-paging');
        }
        if (chatList instanceof HTMLElement) chatList.classList.remove('is-folder-swipe-source');
      }
    
      function resetChatFolderSwipeSurface() {
        if (!(chatFolderListSurface instanceof HTMLElement)) return;
        destroyChatFolderSwipePager();
        chatFolderListSurface.classList.remove(
          'is-folder-swipe-dragging',
          'is-folder-swipe-settling',
          'is-folder-swipe-preparing',
          'is-folder-swipe-paging'
        );
        chatFolderListSurface.style.transform = '';
      }
    
      function waitForAnimationFrames(count = 1) {
        return new Promise((resolve) => {
          const step = (remaining) => {
            if (remaining <= 0) {
              resolve();
              return;
            }
            requestAnimationFrame(() => step(remaining - 1));
          };
          step(Math.max(1, Number(count || 1)));
        });
      }
    
      function waitForMs(ms = 0) {
        return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms || 0))));
      }
    
      async function playChatFolderSwitchPhase(targets, phase) {
        if (!targets.length) return;
        const phaseClass = phase === 'in' ? 'is-folder-switching-in' : 'is-folder-switching-out';
        resetChatFolderSwitchAnimations(targets);
        targets.forEach((el) => {
          el.classList.add('is-folder-switching', phaseClass);
          void el.offsetWidth;
        });
        await waitForAnimationFrames(1);
        targets.forEach((el) => el.classList.add('is-folder-switching-active'));
        const transitionMs = Math.max(...targets.map((el) => Math.ceil(getElementTransitionTotalMs(el))), 0);
        await waitForMs(Math.max(transitionMs, 180) + 24);
      }
    
      function canAnimateChatFolderContent({ allowDuringMobileRoute = false } = {}) {
        return !prefersReducedMotion()
          && currentModalAnimation !== 'none'
          && getChatFolderSwitchTargets().length > 0
          && (allowDuringMobileRoute || !mobileRouteTransitionActive);
      }
    
      async function animateChatFolderContentEntry({ allowDuringMobileRoute = false } = {}) {
        if (!canAnimateChatFolderContent({ allowDuringMobileRoute })) return false;
        const targets = getChatFolderSwitchTargets();
        const seq = ++chatFolderSwitchSeq;
        try {
          await playChatFolderSwitchPhase(targets, 'in');
          return seq === chatFolderSwitchSeq;
        } finally {
          if (seq === chatFolderSwitchSeq) resetChatFolderSwitchAnimations(targets);
        }
      }
    
      function getChatFolderPageRows() {
        return activeChatFolderStripRows()
          .map((row) => ({
            ...row,
            id: normalizeChatFolderId(row?.id),
          }))
          .filter((row, index, rows) => rows.findIndex((entry) => entry.id === row.id) === index);
      }
    
      function getChatFolderPageIndex(folderId = chatFolderStore.activeFolderId, rows = getChatFolderPageRows()) {
        const normalizedFolderId = normalizeChatFolderId(folderId);
        const index = rows.findIndex((row) => Number(row.id || 0) === normalizedFolderId);
        return index >= 0 ? index : 0;
      }
    
      function getAdjacentChatFolderPage(direction, folderId = chatFolderStore.activeFolderId) {
        const rows = getChatFolderPageRows();
        if (rows.length <= 1) return null;
        const dir = direction < 0 ? -1 : 1;
        const currentIndex = getChatFolderPageIndex(folderId, rows);
        const nextIndex = currentIndex + dir;
        return nextIndex >= 0 && nextIndex < rows.length ? rows[nextIndex] : null;
      }
    
      function getChatFolderSwipeSurfaceWidth() {
        return Math.max(
          1,
          Math.round(
            Number(chatFolderListSurface?.clientWidth || 0)
            || Number(sidebar?.clientWidth || 0)
            || Number(window.innerWidth || 0)
            || 1
          )
        );
      }
    
      function getChatFolderSwipeCommitDistance() {
        const width = getChatFolderSwipeSurfaceWidth();
        return Math.min(128, Math.max(CHAT_FOLDER_SWIPE_COMMIT_MIN_PX, Math.round(width * CHAT_FOLDER_SWIPE_COMMIT_RATIO)));
      }
    
      function canAnimateChatFolderSwipe() {
        return !prefersReducedMotion()
          && currentModalAnimation !== 'none'
          && chatFolderListSurface instanceof HTMLElement
          && !mobileRouteTransitionActive;
      }
    
      function getChatFolderSwipeTransformTarget() {
        return chatFolderSwipePagerState?.track instanceof HTMLElement
          ? chatFolderSwipePagerState.track
          : chatFolderListSurface;
      }
    
      function createChatFolderSwipePage(folderId, role = '') {
        const page = document.createElement('div');
        page.className = 'chat-list chat-folder-swipe-page';
        page.dataset.folderSwipePage = String(normalizeChatFolderId(folderId));
        if (role) page.dataset.folderSwipeRole = role;
        renderChatListInto(page, {
          filter: chatSearch?.value || '',
          folderId,
          includeSearchExtras: false,
        });
        return page;
      }
    
      function prepareChatFolderSwipePager(direction, adjacentFolderId) {
        if (!canAnimateChatFolderSwipe() || !(chatFolderListSurface instanceof HTMLElement) || !(chatList instanceof HTMLElement)) {
          destroyChatFolderSwipePager();
          return null;
        }
        const swipeDirection = direction < 0 ? -1 : 1;
        const width = getChatFolderSwipeSurfaceWidth();
        const currentFolderId = normalizeChatFolderId(chatFolderStore.activeFolderId);
        const nextFolderId = normalizeChatFolderId(adjacentFolderId);
        const currentState = chatFolderSwipePagerState;
        if (
          currentState
          && currentState.direction === swipeDirection
          && currentState.currentFolderId === currentFolderId
          && currentState.nextFolderId === nextFolderId
          && currentState.width === width
          && currentState.track instanceof HTMLElement
          && currentState.stage instanceof HTMLElement
        ) {
          return currentState;
        }
    
        destroyChatFolderSwipePager();
    
        const stage = document.createElement('div');
        stage.className = 'chat-folder-swipe-stage';
        stage.setAttribute('aria-hidden', 'true');
    
        const track = document.createElement('div');
        track.className = 'chat-folder-swipe-track';
    
        const currentPage = createChatFolderSwipePage(currentFolderId, 'current');
        const adjacentPage = createChatFolderSwipePage(nextFolderId, 'adjacent');
        currentPage.scrollTop = chatList.scrollTop;
    
        if (swipeDirection > 0) {
          track.append(currentPage, adjacentPage);
        } else {
          track.append(adjacentPage, currentPage);
        }
        stage.appendChild(track);
        chatFolderListSurface.appendChild(stage);
    
        chatFolderSwipePagerState = {
          stage,
          track,
          direction: swipeDirection,
          currentFolderId,
          nextFolderId,
          width,
          baseOffset: swipeDirection > 0 ? 0 : -width,
        };
        chatFolderListSurface.classList.add('is-folder-swipe-paging');
        chatList.classList.add('is-folder-swipe-source');
        setChatFolderSwipeOffset(chatFolderSwipePagerState.baseOffset, 'preparing');
        return chatFolderSwipePagerState;
      }
    
      function setChatFolderSwipeOffset(offset, mode = 'dragging') {
        if (!(chatFolderListSurface instanceof HTMLElement)) return false;
        chatFolderListSurface.classList.toggle('is-folder-swipe-dragging', mode === 'dragging');
        chatFolderListSurface.classList.toggle('is-folder-swipe-settling', mode === 'settling');
        chatFolderListSurface.classList.toggle('is-folder-swipe-preparing', mode === 'preparing');
        chatFolderListSurface.classList.toggle('is-folder-swipe-paging', Boolean(chatFolderSwipePagerState));
        const target = getChatFolderSwipeTransformTarget();
        if (!(target instanceof HTMLElement)) return false;
        if (target !== chatFolderListSurface) chatFolderListSurface.style.transform = '';
        target.style.transform = `translate3d(${Math.round(Number(offset || 0))}px, 0, 0)`;
        return true;
      }
    
      async function settleChatFolderSwipeOffset(offset) {
        if (!(chatFolderListSurface instanceof HTMLElement)) return false;
        setChatFolderSwipeOffset(offset, 'settling');
        const target = getChatFolderSwipeTransformTarget();
        const transitionMs = Math.ceil(getElementTransitionTotalMs(target));
        await waitForMs(Math.max(transitionMs, 180) + 24);
        return true;
      }
    
      async function snapChatFolderSwipeBack() {
        if (!canAnimateChatFolderSwipe()) {
          resetChatFolderSwipeSurface();
          return false;
        }
        try {
          await settleChatFolderSwipeOffset(0);
          return true;
        } finally {
          resetChatFolderSwipeSurface();
        }
      }
    
      async function transitionToChatFolderBySwipe(folderId, { persist = true, closePicker = false, direction = 1 } = {}) {
        const nextFolderId = normalizeChatFolderId(folderId);
        const currentFolderId = normalizeChatFolderId(chatFolderStore.activeFolderId);
        if (currentFolderId === nextFolderId) {
          if (closePicker) await hideChatFolderPicker();
          await snapChatFolderSwipeBack();
          return getActiveChatFolder();
        }
    
        if (closePicker) await hideChatFolderPicker();
    
        const swipeDirection = direction < 0 ? -1 : 1;
        const canAnimate = canAnimateChatFolderSwipe();
        const centerBehavior = canAnimate ? 'smooth' : 'auto';
        const currentShowsBar = shouldShowChatFolderBarForSelection(currentFolderId, { forceVisible: false });
        const nextShowsBar = shouldShowChatFolderBarForSelection(nextFolderId, { forceVisible: false });
        const seq = ++chatFolderSwitchSeq;
        const previewPrepared = currentShowsBar || nextShowsBar;
    
        try {
          if (previewPrepared) {
            beginChatFolderStripPreview(nextFolderId, { forceVisible: true, centerBehavior });
          }
    
          if (!canAnimate) {
            resetChatFolderSwipeSurface();
            setActiveChatFolder(nextFolderId, { persist, render: false });
            renderChatList(chatSearch?.value || '');
            return getActiveChatFolder();
          }
    
          let pager = chatFolderSwipePagerState;
          if (
            !pager
            || pager.direction !== swipeDirection
            || pager.currentFolderId !== currentFolderId
            || pager.nextFolderId !== nextFolderId
          ) {
            pager = prepareChatFolderSwipePager(swipeDirection, nextFolderId);
          }
          if (!pager) {
            setActiveChatFolder(nextFolderId, { persist, render: false });
            renderChatList(chatSearch?.value || '');
            return getActiveChatFolder();
          }
    
          const finalOffset = swipeDirection > 0 ? -pager.width : 0;
          await settleChatFolderSwipeOffset(finalOffset);
          if (seq !== chatFolderSwitchSeq) return getActiveChatFolder();
    
          setActiveChatFolder(nextFolderId, { persist, render: false });
          renderChatList(chatSearch?.value || '');
          return getActiveChatFolder();
        } finally {
          if (seq === chatFolderSwitchSeq) {
            resetChatFolderSwipeSurface();
            if (previewPrepared) finalizeChatFolderStripPreview({ centerBehavior: 'auto' });
          } else {
            resetChatFolderSwipeSurface();
          }
        }
      }
    
      async function transitionToChatFolder(folderId, { persist = true, closePicker = false, swipeDirection = 0 } = {}) {
        const nextFolderId = normalizeChatFolderId(folderId);
        if (swipeDirection) {
          return transitionToChatFolderBySwipe(nextFolderId, { persist, closePicker, direction: swipeDirection });
        }
        const currentFolderId = normalizeChatFolderId(chatFolderStore.activeFolderId);
        if (currentFolderId === nextFolderId) {
          if (closePicker) await hideChatFolderPicker();
          return getActiveChatFolder();
        }
    
        if (closePicker) await hideChatFolderPicker();
    
        const canAnimate = canAnimateChatFolderContent();
        const centerBehavior = canAnimate ? 'smooth' : 'auto';
        const currentShowsBar = shouldShowChatFolderBarForSelection(currentFolderId, { forceVisible: false });
        const nextShowsBar = shouldShowChatFolderBarForSelection(nextFolderId, { forceVisible: false });
        const touchedTargets = new Set();
        const seq = ++chatFolderSwitchSeq;
        let previewPrepared = false;
    
        try {
          if (currentShowsBar) {
            beginChatFolderStripPreview(nextFolderId, { forceVisible: true, centerBehavior });
            previewPrepared = true;
          }
    
          if (canAnimate) {
            const exitTargets = getChatFolderSwitchTargets();
            exitTargets.forEach((el) => touchedTargets.add(el));
            await playChatFolderSwitchPhase(exitTargets, 'out');
            if (seq !== chatFolderSwitchSeq) return getActiveChatFolder();
          }
    
          if (!previewPrepared && nextShowsBar) {
            beginChatFolderStripPreview(nextFolderId, { forceVisible: true, centerBehavior });
            previewPrepared = true;
          }
    
          setActiveChatFolder(nextFolderId, { persist, render: false });
          renderChatList(chatSearch?.value || '');
    
          if (!canAnimate) return getActiveChatFolder();
    
          const enterTargets = getChatFolderSwitchTargets();
          enterTargets.forEach((el) => touchedTargets.add(el));
          await playChatFolderSwitchPhase(enterTargets, 'in');
          return getActiveChatFolder();
        } finally {
          if (seq === chatFolderSwitchSeq) {
            resetChatFolderSwitchAnimations([...touchedTargets]);
            finalizeChatFolderStripPreview({ centerBehavior: 'auto' });
          }
        }
      }
    
      function setActiveChatFolder(folderId, { persist = true, render = true } = {}) {
        return folderActionsController.setActiveChatFolder(folderId, { persist, render });
      }
    
      async function loadChatFolders({ silent = false, renderAfterLoad = true } = {}) {
        return folderActionsController.loadChatFolders({ silent, renderAfterLoad });
      }
      function setAvatarElementVisual(el, { name = '', color = '#65aadd', avatarUrl = '', fallbackText = '' } = {}) {
        if (!el) return;
        const resolvedColor = color || '#65aadd', resolvedAvatarUrl = avatarUrl || '', resolvedText = fallbackText || initials(name || '?');
        const signature = JSON.stringify([name || '', resolvedColor, resolvedAvatarUrl, resolvedText]);
        const currentImg = el.querySelector('img.avatar-img'), currentMatches = resolvedAvatarUrl ? currentImg?.getAttribute('src') === resolvedAvatarUrl : (!currentImg && el.textContent === resolvedText);
        if (el.dataset.avatarVisualSignature === signature && currentMatches) return;
        el.dataset.avatarVisualSignature = signature; el.style.background = resolvedColor;
        if (resolvedAvatarUrl) { if (!currentMatches) el.innerHTML = `<img class="avatar-img" src="${esc(resolvedAvatarUrl)}" alt="" loading="lazy" onerror="this.remove()">`; return; }
        el.textContent = resolvedText;
      }
    
      function renderCurrentChatHeader(chat = chats.find(c => c.id === currentChatId)) {
        if (!chat) {
          closeChatHeaderActions();
          chatTitle.textContent = 'Chat';
          chatHeaderAvatar.style.display = 'none';
          syncChatShotButton();
          window.BananzaCallHooks?.onChatChanged?.(null, null);
          return;
        }
        chatTitle.textContent = chat.name || 'Chat';
        chatHeaderAvatar.style.display = '';
        if (isNotesChat(chat)) {
          setAvatarElementVisual(chatHeaderAvatar, {
            name: chat.name,
            color: '#5eb5f7',
            avatarUrl: '',
            fallbackText: chat.avatar_emoji || NOTES_CHAT_EMOJI,
          });
          syncChatShotButton();
          window.BananzaCallHooks?.onChatChanged?.(chat.id, chat);
          return;
        }
        if (chat.type === 'private' && chat.private_user) {
          setAvatarElementVisual(chatHeaderAvatar, {
            name: chat.private_user.display_name || chat.name,
            color: chat.private_user.avatar_color || '#65aadd',
            avatarUrl: chat.private_user.avatar_url || '',
            fallbackText: initials(chat.private_user.display_name || chat.name || '?'),
          });
          syncChatShotButton();
          window.BananzaCallHooks?.onChatChanged?.(chat.id, chat);
          return;
        }
        setAvatarElementVisual(chatHeaderAvatar, {
          name: chat.name,
          color: '#5eb5f7',
          avatarUrl: chat.avatar_url || '',
          fallbackText: chat.type === 'general' ? '\ud83c\udf10' : '\ud83d\udc65',
        });
        syncChatShotButton();
        window.BananzaCallHooks?.onChatChanged?.(chat.id, chat);
      }
      function refreshChatInfoPresentation(chat = chats.find(c => c.id === currentChatId)) {
        if (!chat || chatInfoModal?.classList.contains('hidden') || Number(chat.id) !== Number(currentChatId)) return;
        const isDocument = isDocumentChat(chat), documentTitle = chat.document_title || chat.name || t('Document');
        $('#chatInfoTitle').textContent = isDocument ? documentTitle : (chat.name || 'Chat Info');
        chatInfoModal?.classList.toggle('is-document-settings', isDocument);
        syncChatInfoStatusVisibility(chat);
        ['#chatCompactViewSection', '#chatPreferencesSection', '#chatRemindersSection', '#chatBackgroundSection']
          .forEach((selector) => $(selector)?.classList.toggle('hidden', isDocument));
        const editSection = $('#chatEditSection');
        if (editSection) {
          if (!isNotesChat(chat) && (isDocument || chat.type === 'group' || chat.type === 'general')) {
            editSection.classList.remove('hidden');
            const chatNameLabel = $('#chatNameFieldLabel'), nameInput = $('#chatNameInput');
            if (chatNameLabel) chatNameLabel.textContent = t(isDocument ? 'Document name' : 'Group name');
            setAvatarElementVisual($('#chatAvatar'), {
              name: isDocument ? (chat.document_title || chat.name) : chat.name,
              color: '#5eb5f7',
              avatarUrl: chat.avatar_url || '',
              fallbackText: isDocument ? '\ud83d\udcc4' : (chat.type === 'general' ? '\ud83c\udf10' : '\ud83d\udc65'),
            });
            $('#removeChatAvatar')?.classList.toggle('hidden', !chat.avatar_url);
            if (nameInput) { nameInput.maxLength = isDocument ? 80 : 50; nameInput.value = isDocument ? (chat.document_title || chat.name || '') : (chat.name || ''); }
          } else {
            editSection.classList.add('hidden');
          }
        }
        const bgPreviewEl = $('#chatBackgroundPreview');
        const removeBgBtn = $('#removeChatBackground');
        const bgStyleSelect = $('#chatBackgroundStyle');
        if (!isDocument && bgPreviewEl) {
          if (chat.background_url) {
            bgPreviewEl.style.backgroundImage = `url(${esc(chat.background_url)})`;
            applyBackgroundStyleToElement(bgPreviewEl, chat.background_style || 'cover');
            removeBgBtn?.classList.remove('hidden');
          } else {
            bgPreviewEl.style.backgroundImage = '';
            applyBackgroundStyleToElement(bgPreviewEl, 'cover');
            removeBgBtn?.classList.add('hidden');
          }
        }
        if (!isDocument && bgStyleSelect) bgStyleSelect.value = chat.background_style || 'cover';
        renderChatInviteLinkForm(chat);
        renderChatShotForm(getCurrentChatShotState());
        renderChatDangerControls(chat);
      }
      function syncChatInfoStatusVisibility(chat = getChatById(currentChatId)) {
        const statusEl = $('#chatInfoStatus');
        if (!statusEl) return;
        const shouldHide = isNotesChat(chat);
        statusEl.classList.toggle('hidden', shouldHide);
        if (shouldHide) {
          statusEl.classList.remove('online', 'offline', 'bot');
          statusEl.style.color = '';
          statusEl.innerHTML = '';
        }
      }
    
      function refreshRenderedUserMessages(user) {
        const userId = Number(user?.id || user?.user_id || 0);
        if (!userId || !messagesEl) return;
        const bot = aiBotState?.bots?.find?.((item) => Number(item.user_id) === userId) || null;
        const mentionToken = bot?.mention || user.username || '';
    
        messagesEl.querySelectorAll(`.msg-group[data-user-id="${userId}"]`).forEach((group) => {
          const avatarEl = group.querySelector('.msg-group-avatar');
          if (avatarEl) {
            avatarEl.title = user.display_name || avatarEl.title || '';
            avatarEl.dataset.displayName = user.display_name || avatarEl.dataset.displayName || '';
            avatarEl.dataset.username = user.username || avatarEl.dataset.username || '';
            if (mentionToken) avatarEl.dataset.mentionToken = mentionToken;
            avatarEl.dataset.avatarColor = user.avatar_color || avatarEl.dataset.avatarColor || '';
            avatarEl.dataset.avatarUrl = user.avatar_url || '';
            avatarEl.dataset.profileStatusKey = user.profile_status_key || '';
            avatarEl.dataset.profileStatusText = user.profile_status_text || '';
            setAvatarElementVisual(avatarEl, {
              name: user.display_name || '',
              color: user.avatar_color || '#65aadd',
              avatarUrl: user.avatar_url || '',
            });
          }
          const senderEl = group.querySelector('.msg-sender');
          if (senderEl) {
            senderEl.textContent = user.display_name || senderEl.textContent;
            senderEl.style.color = user.avatar_color || senderEl.style.color;
          }
        });
    
        messagesEl.querySelectorAll(`.msg-row[data-user-id="${userId}"]`).forEach((row) => {
          if (row.__messageData) {
            row.__messageData.display_name = user.display_name || row.__messageData.display_name;
            row.__messageData.avatar_color = user.avatar_color || row.__messageData.avatar_color;
            row.__messageData.avatar_url = user.avatar_url || null;
            row.__messageData.profile_status_key = user.profile_status_key || '';
            row.__messageData.profile_status_text = user.profile_status_text || '';
            if (user.username) row.__messageData.username = user.username;
          }
          if (row.__replyPayload && user.display_name) {
            row.__replyPayload.display_name = user.display_name;
          }
          const senderEl = row.querySelector('.msg-sender');
          if (senderEl) {
            senderEl.textContent = user.display_name || senderEl.textContent;
            senderEl.style.color = user.avatar_color || senderEl.style.color;
          }
        });
      }
    
      function applyChatUpdate(nextChat = {}) {
        const result = chatListService.applyChatUpdate(nextChat);
        refreshChatListReferences();
        syncCoreStateToRuntime();
        return result;
      }
    
      function applyCurrentUserUpdateFromPresence(user = {}) {
        const userId = Number(user.id || user.user_id || 0);
        if (!userId || !currentUser || Number(currentUser.id) !== userId) return null;
        currentUser = {
          ...currentUser,
          ...user,
          avatar_url: user.avatar_url,
        };
        currentUser.ui_show_chat_folder_strip_in_all_chats = Boolean(currentUser.ui_show_chat_folder_strip_in_all_chats);
        if (user.ui_theme) applyUiTheme(user.ui_theme, false);
        if (Object.prototype.hasOwnProperty.call(user, 'ui_visual_mode')) {
          applyVisualMode(user.ui_visual_mode, false);
        }
        if (Object.prototype.hasOwnProperty.call(user, 'ui_modal_animation')) {
          applyModalAnimation(user.ui_modal_animation, false);
        }
        if (Object.prototype.hasOwnProperty.call(user, 'ui_modal_animation_speed')) {
          applyModalAnimationSpeed(user.ui_modal_animation_speed, false);
        }
        if (Object.prototype.hasOwnProperty.call(user, 'ui_mobile_font_size')) {
          applyMobileFontSize(user.ui_mobile_font_size, false);
        }
        if (Object.prototype.hasOwnProperty.call(user, 'ui_language')) {
          applyUiLanguage(user.ui_language, false);
        }
        if (Object.prototype.hasOwnProperty.call(user, 'ui_show_chat_folder_strip_in_all_chats')) {
          renderActiveChatFolderBar({ centerBehavior: 'auto' });
          if (isFloatingSurfaceVisible(chatFolderPicker)) syncChatFolderPickerAllChatsToggleState();
        }
        syncCoreStateToRuntime();
        persistCurrentUser();
        updateCurrentUserFooter();
        if (!menuDrawer.classList.contains('hidden')) renderProfileEditor({ preserveStatus: true });
        return currentUser;
      }
    
      function patchChatMembersCacheForPresence(user = {}) {
        const userId = Number(user.id || user.user_id || 0);
        if (!userId) return false;
        let patched = false;
        chatMembersCache.forEach((members, chatId) => {
          let changed = false;
          const nextMembers = members.map((member) => {
            if (Number(member.id) !== userId) return member;
            changed = true;
            return {
              ...member,
              ...user,
              avatar_url: user.avatar_url,
            };
          });
          if (changed) {
            patched = true;
            chatMembersCache.set(chatId, nextMembers);
          }
        });
        return patched;
      }
    
      function patchMentionTargetsForPresence(user = {}) {
        const userId = Number(user.id || user.user_id || 0);
        if (!userId) return false;
        let patched = false;
        composerStateController.mentionTargetsByChat.forEach((targets, chatId) => {
          let changed = false;
          const nextTargets = targets.map((target) => {
            if (Number(target.user_id) !== userId) return target;
            changed = true;
            return {
              ...target,
              display_name: user.display_name || target.display_name,
              avatar_color: user.avatar_color || target.avatar_color,
              avatar_url: user.avatar_url,
              username: user.username || target.username,
              profile_status_key: user.profile_status_key || '',
              profile_status_text: user.profile_status_text || '',
            };
          });
          if (changed) {
            patched = true;
            composerStateController.mentionTargetsByChat.set(chatId, nextTargets);
          }
        });
        return patched;
      }
    
      function patchAiBotUserForPresence(user = {}) {
        const userId = Number(user.id || user.user_id || 0);
        if (!userId) return false;
        let aiBotChanged = false;
        aiBotState.bots = aiBotState.bots.map((bot) => {
          if (Number(bot.user_id) !== userId) return bot;
          aiBotChanged = true;
          return {
            ...bot,
            name: user.display_name || bot.name,
            avatar_color: user.avatar_color || bot.avatar_color,
            avatar_url: user.avatar_url,
          };
        });
    
        if (aiBotChanged) {
          renderAiBotList();
          renderAiBotAvatar(currentAiBot());
        }
        return aiBotChanged;
      }
    
      function refreshMentionPickerForUserUpdate() {
        return composerMentionsController?.refreshMentionPickerForUserUpdate?.();
      }
    
      function applyUserUpdate(nextUser = {}) {
        const result = chatListService.applyUserUpdate(nextUser);
        refreshChatListReferences();
        syncCoreStateToRuntime();
        return result;
      }
    
      function weatherLocationLabel(location) { return weatherSettingsController.weatherLocationLabel(location); }
      function weatherIcon(code, isDay) { return weatherSettingsController.weatherIcon(code, isDay); }
      function formatWeatherValue(value, fallback, precision = 0) { return weatherSettingsController.formatWeatherValue(value, fallback, precision); }
      function renderWeatherWidget(data) { return weatherSettingsController.renderWeatherWidget(data); }
      function setWeatherStatus(message, type = '') { return weatherSettingsController.setWeatherStatus(message, type); }
      function renderWeatherSettingsForm(draft = {}) { return weatherSettingsController.renderWeatherSettingsForm(draft); }
      function renderWeatherSearchResults(results) { return weatherSettingsController.renderWeatherSearchResults(results); }
      function scheduleWeatherRefresh() { return weatherSettingsController.scheduleWeatherRefresh(); }
      function loadWeatherSettings() { return weatherSettingsController.loadWeatherSettings(); }
      function loadCurrentWeather(force = false) { return weatherSettingsController.loadCurrentWeather(force); }
      function searchWeatherLocations() { return weatherSettingsController.searchWeatherLocations(); }
      function saveWeatherSettings() { return weatherSettingsController.saveWeatherSettings(); }
      function isLocalhost() { return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname); }
      function isPushSupported() { return notificationSettingsController.isPushSupported(); }
      function setNotificationStatus(message, type = '') { return notificationSettingsController.setNotificationStatus(message, type); }
      function notificationPermissionLabel() { return notificationSettingsController.notificationPermissionLabel(); }
      function renderNotificationSettingsForm() { return notificationSettingsController.renderNotificationSettingsForm(); }
      function loadNotificationSettings() { return notificationSettingsController.loadNotificationSettings(); }
      function saveNotificationSettings(patch = {}) { return notificationSettingsController.saveNotificationSettings(patch); }
      function enablePushNotifications() { return notificationSettingsController.enablePushNotifications(); }
      function disablePushOnThisDevice() { return notificationSettingsController.disablePushOnThisDevice(); }
      function testPushNotification() { return notificationSettingsController.testPushNotification(); }
      function refreshPushDeviceState() { return notificationSettingsController.refreshPushDeviceState(); }
      function applySoundSettings(next = {}) { return soundSettingsController.applySoundSettings(next); }
      function setSoundStatus(message, type = '') { return soundSettingsController.setSoundStatus(message, type); }
      function renderSoundSettingsForm() { return soundSettingsController.renderSoundSettingsForm(); }
      function getSoundSettingsFromForm() { return soundSettingsController.getSoundSettingsFromForm(); }
      function loadSoundSettings() { return soundSettingsController.loadSoundSettings(); }
      function saveSoundSettings(patch = {}, options = {}) { return soundSettingsController.saveSoundSettings(patch, options); }
      function scheduleSoundSettingsSave(patch = {}) { return soundSettingsController.scheduleSoundSettingsSave(patch); }
      function playAppSound(type, options = {}) { return soundSettingsController.playAppSound(type, options); }
      function previewSound(type) { return soundSettingsController.previewSound(type); }
      function previewAllSounds() { return soundSettingsController.previewAllSounds(); }
      function getChatById(chatId) {
        return chatListService.getChatById(chatId);
      }
    
      function isChatPinned(chatOrId) {
        const chat = typeof chatOrId === 'object' && chatOrId !== null ? chatOrId : getChatById(chatOrId);
        return getChatPinOrder(chat) != null || Boolean(chat && (chat.is_pinned === true || chat.is_pinned === 1 || chat.is_pinned === '1'));
      }
    
      function getActiveChatFolder() {
        return chatFolderStore.getActiveChatFolder();
      }
    
      function isAllChatsFolderActive() {
        return chatFolderStore.isAllChatsFolderActive();
      }
    
      function getFolderPinnedChatOrder(folderId, chatOrId) {
        return chatFolderStore.getFolderPinnedChatOrder(folderId, chatOrId);
      }
    
      function isChatPinnedInFolder(folderId, chatOrId) {
        return chatFolderStore.isChatPinnedInFolder(folderId, chatOrId);
      }
    
      function compareChatsForFolder(folderId, a, b) {
        return chatFolderStore.compareChatsForFolder(folderId, a, b, compareChatActivity);
      }
    
      function folderSummaryText(folder) {
        return chatFolderStore.folderSummaryText(folder, chats);
      }
    
      function sortChatsInPlace(list = chats) {
        if (!Array.isArray(list)) return list;
        list.sort(compareChatsForList);
        return list;
      }
    
      function getPinnedChats(list = chats) {
        return (Array.isArray(list) ? list : []).filter((chat) => isChatPinned(chat)).sort(compareChatsForList);
      }
    
      function getPinnedChatMoveState(chatId, list = chats) {
        const pinned = getPinnedChats(list);
        const index = pinned.findIndex((chat) => Number(chat.id || 0) === Number(chatId || 0));
        return {
          index,
          total: pinned.length,
          canMoveUp: index > 0,
          canMoveDown: index >= 0 && index < pinned.length - 1,
        };
      }
      function isNotesChat(chatOrId) {
        const chat = typeof chatOrId === 'object' && chatOrId !== null ? chatOrId : getChatById(chatOrId);
        return Boolean(chat && (chat.type === 'notes' || Number(chat.is_notes) === 1));
      }
      function isDocumentChat(chatOrId) {
        const chat = typeof chatOrId === 'object' && chatOrId !== null ? chatOrId : getChatById(chatOrId);
        return Number(chat?.is_document || 0) === 1;
      }
      function isCurrentNotesChat() {
        return isNotesChat(currentChatId);
      }
    
      function isChatNotificationEnabled(chatId) {
        const chat = getChatById(chatId);
        return chat ? localChatPreferenceEnabled(chat.notify_enabled) : true;
      }
    
      function isChatIncomingSoundEnabled(chatId) {
        return soundSettingsController.isChatIncomingSoundEnabled(chatId);
      }
    
      function isPinNotificationEnabled(chatId) {
        const settings = notificationSettingsController.getSettings();
        return Boolean(settings.notify_pins !== false && isChatNotificationEnabled(chatId));
      }
    
      function isPinSoundEnabled(chatId) {
        return soundSettingsController.isPinSoundEnabled(chatId);
      }
    
      function isMentionSoundEnabled() {
        return soundSettingsController.isMentionSoundEnabled();
      }
    
      function isMessageMentioningCurrentUser(message) {
        if (message?.forwarded_from_message_id) return false;
        const userId = Number(currentUser?.id);
        return Boolean(userId && Array.isArray(message?.mentions) && message.mentions.some(mention => Number(mention.user_id) === userId));
      }
    
      function setChatPreferencesStatus(message, type = '') {
        const el = $('#chatPreferencesStatus');
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('is-error', type === 'error');
        el.classList.toggle('is-success', type === 'success');
      }
    
      function renderChatPreferencesForm(chat) {
        const notifyToggle = $('#chatNotifyToggle');
        const soundToggle = $('#chatSoundToggle');
        if (!notifyToggle || !soundToggle) return;
        notifyToggle.checked = localChatPreferenceEnabled(chat?.notify_enabled);
        soundToggle.checked = localChatPreferenceEnabled(chat?.sounds_enabled);
        $('#chatNotifyHint')?.classList.toggle('hidden', !!notificationSettingsController.getSettings().push_enabled);
        $('#chatSoundHint')?.classList.toggle('hidden', !!soundSettingsController.getSettings().sounds_enabled);
      }
    
      async function loadChatPreferences(chatId) {
        const chat = getChatById(chatId);
        renderChatPreferencesForm(chat);
        setChatPreferencesStatus('');
        try {
          const data = await api(`/api/chats/${chatId}/preferences`);
          const preferences = data.preferences || data;
          if (chat) Object.assign(chat, preferences);
          renderChatPreferencesForm(chat || preferences);
        } catch (e) {
          setChatPreferencesStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0447\u0430\u0442\u0430', 'error');
        }
      }
    
      async function saveChatPreferences() {
        if (!currentChatId) return;
        const chat = getChatById(currentChatId);
        const next = {
          notify_enabled: $('#chatNotifyToggle')?.checked ?? true,
          sounds_enabled: $('#chatSoundToggle')?.checked ?? true,
        };
        if (chat) Object.assign(chat, next);
        renderChatPreferencesForm(chat || next);
        setChatPreferencesStatus('\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e...');
        try {
          const data = await api(`/api/chats/${currentChatId}/preferences`, { method: 'PUT', body: next });
          const preferences = data.preferences || next;
          if (chat) Object.assign(chat, preferences);
          renderChatPreferencesForm(chat || preferences);
          setChatPreferencesStatus('\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e', 'success');
        } catch (e) {
          setChatPreferencesStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0447\u0430\u0442\u0430', 'error');
          if (chat) await loadChatPreferences(currentChatId);
        }
      }
    
      function chatAllowsUnpinAnyPin(chat) {
        return chat && (chat.allow_unpin_any_pin === true || chat.allow_unpin_any_pin === 1 || chat.allow_unpin_any_pin === '1');
      }
      function canManagePinSettings(chat = getChatById(currentChatId)) {
        if (!currentUser || !chat || isDocumentChat(chat)) return false;
        return Boolean(currentUser.is_admin || Number(chat.created_by || 0) === Number(currentUser.id));
      }
      function isGeneralChat(chat) {
        return String(chat?.type || '') === 'general';
      }
    
      function isGroupOrPrivateChat(chat) {
        const type = String(chat?.type || '');
        return type === 'group' || type === 'private';
      }
      function canHideChat(chat) {
        return Boolean(chat && isGroupOrPrivateChat(chat) && !isNotesChat(chat) && !isDocumentChat(chat) && !isGeneralChat(chat));
      }
      function canLeaveChat(chat) {
        return Boolean(
          chat
          && chat.type === 'group'
          && !isNotesChat(chat)
          && !isGeneralChat(chat)
          && Number(chat.created_by || 0) !== Number(currentUser?.id || 0)
        );
      }
    
      function canManageDestructiveChat(chat) {
        return Boolean(
          currentUser
          && chat
          && isGroupOrPrivateChat(chat)
          && !isNotesChat(chat)
          && !isGeneralChat(chat)
          && (currentUser.is_admin || Number(chat.created_by || 0) === Number(currentUser.id))
        );
      }

      function setChatPinSettingsStatus(message, type = '') {
        const el = $('#chatPinSettingsStatus');
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('is-error', type === 'error');
        el.classList.toggle('is-success', type === 'success');
      }
      function renderChatPinSettingsForm(chat = getChatById(currentChatId)) {
        const section = $('#chatPinSettingsSection');
        const toggle = $('#chatAllowUnpinAnyPinToggle');
        if (!section || !toggle) return;
        const canManage = canManagePinSettings(chat);
        section.classList.toggle('hidden', isNotesChat(chat) || isDocumentChat(chat) || !canManage);
        toggle.checked = chatAllowsUnpinAnyPin(chat);
        setChatPinSettingsStatus('');
      }
    
      function canManageContextTransformSettings(chat = getChatById(currentChatId)) {
        if (!currentUser || !chat) return false;
        return Boolean(currentUser.is_admin || Number(chat.created_by || 0) === Number(currentUser.id));
      }
    
      function setChatContextTransformStatus(message, type = '') {
        const el = $('#chatContextTransformStatus');
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('is-error', type === 'error');
        el.classList.toggle('is-success', type === 'success');
      }
    
      function renderChatContextTransformForm(chat = getChatById(currentChatId)) {
        const section = $('#chatContextTransformSection');
        const toggle = $('#chatContextTransformToggle');
        if (!section || !toggle) return;
        const canManage = canManageContextTransformSettings(chat);
        section.classList.toggle('hidden', !canManage);
        toggle.checked = !!chat?.context_transform_enabled;
        setChatContextTransformStatus('');
      }
    
      async function saveChatContextTransformSetting() {
        if (!currentChatId) return;
        const chat = getChatById(currentChatId);
        const enabled = !!$('#chatContextTransformToggle')?.checked;
        const previousEnabled = !!chat?.context_transform_enabled;
        if (chat) chat.context_transform_enabled = enabled ? 1 : 0;
        renderChatContextTransformForm(chat);
        syncCurrentChatContextConvertUi();
        setChatContextTransformStatus('Saving...');
        try {
          const updated = await api(`/api/chats/${currentChatId}/context-transform-settings`, {
            method: 'PUT',
            body: { context_transform_enabled: enabled },
          });
          applyChatUpdate(updated || {});
          setChatContextTransformStatus('Saved', 'success');
          invalidateContextConvertAvailability(currentChatId);
          if (enabled) loadContextConvertAvailability(currentChatId, { force: true }).catch(() => {});
        } catch (error) {
          if (chat) chat.context_transform_enabled = previousEnabled ? 1 : 0;
          renderChatContextTransformForm(chat);
          syncCurrentChatContextConvertUi();
          setChatContextTransformStatus(error.message || 'Could not save context transform setting', 'error');
        }
      }
      function setChatDangerStatus(message, type = '') {
        const el = $('#chatDangerStatus');
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('is-error', type === 'error');
        el.classList.toggle('is-success', type === 'success');
      }
      function renderChatDangerControls(chat = getChatById(currentChatId)) {
        const section = $('#chatDangerSection');
        if (!section) return;
        const clearBtn = $('#clearChatHistoryBtn');
        const leaveBtn = $('#leaveChatBtn');
        const deleteBtn = $('#deleteChatBtn');
        const isDocument = isDocumentChat(chat);
        const showClear = canManageDestructiveChat(chat);
        const showLeave = canLeaveChat(chat);
        const showDelete = showClear;
        const labels = isDocument
          ? ['Document management', 'Clear document', 'Leave document', 'Delete document']
          : ['Chat management', 'Clear history', 'Leave chat', 'Delete chat'];
        section.classList.toggle('hidden', !(showClear || showLeave || showDelete));
        [section.querySelector('h4'), clearBtn, leaveBtn, deleteBtn].forEach((el, index) => { if (el) el.textContent = t(labels[index]); });
        clearBtn?.classList.toggle('hidden', !showClear);
        leaveBtn?.classList.toggle('hidden', !showLeave);
        deleteBtn?.classList.toggle('hidden', !showDelete);
        setChatDangerStatus('');
      }
    
      async function saveChatPinSettings() {
        if (!currentChatId) return;
        const chat = getChatById(currentChatId);
        if (!canManagePinSettings(chat)) return;
        const next = { allow_unpin_any_pin: $('#chatAllowUnpinAnyPinToggle')?.checked ?? false };
        if (chat) chat.allow_unpin_any_pin = next.allow_unpin_any_pin;
        renderChatPinSettingsForm(chat);
        renderPinnedBar(currentChatId);
        refreshVisiblePinButtons(currentChatId);
        setChatPinSettingsStatus('Saving...');
        try {
          const updated = await api(`/api/chats/${currentChatId}/pin-settings`, { method: 'PUT', body: next });
          applyChatUpdate(updated || {});
          setChatPinSettingsStatus('Saved', 'success');
        } catch (e) {
          setChatPinSettingsStatus(e.message || 'Could not save pin settings', 'error');
          await loadChats({ silent: true });
          renderChatPinSettingsForm(getChatById(currentChatId));
        }
      }
    
      function normalizePin(raw) {
        if (!raw) return null;
        const messageId = Number(raw.message_id || raw.messageId || 0);
        const chatId = Number(raw.chat_id || raw.chatId || currentChatId || 0);
        if (!messageId || !chatId) return null;
        return {
          id: Number(raw.id || 0),
          chat_id: chatId,
          message_id: messageId,
          pinned_by: Number(raw.pinned_by || raw.pinnedBy || 0),
          pinned_by_name: raw.pinned_by_name || raw.pinnedByName || '',
          created_at: raw.created_at || raw.createdAt || '',
          message_user_id: Number(raw.message_user_id || raw.messageUserId || 0),
          message_author_name: raw.message_author_name || raw.messageAuthorName || '',
          preview_text: raw.preview_text || raw.previewText || '',
          file_name: raw.file_name || raw.fileName || null,
          file_type: raw.file_type || raw.fileType || null,
          is_voice_note: Boolean(raw.is_voice_note || raw.isVoiceNote),
          is_video_note: Boolean(raw.is_video_note || raw.isVideoNote),
        };
      }
    
      function normalizePins(pins = []) {
        const seen = new Set();
        return (Array.isArray(pins) ? pins : [])
          .map(normalizePin)
          .filter((pin) => {
            if (!pin || seen.has(pin.message_id)) return false;
            seen.add(pin.message_id);
            return true;
          });
      }
    
      function getPinPreviewText(pin) {
        const fallback = pin?.is_voice_note ? t(pin?.is_video_note ? 'Video note' : 'Voice message') : t('Pinned message');
        return String(
          pin?.preview_text
          || pin?.file_name
          || fallback
        ).trim() || fallback;
      }
    
      function getPinActorName(pin) {
        return String(pin?.pinned_by_name || t('Someone')).trim() || t('Someone');
      }
    
      function getPinToastText(pin) {
        return t('{name} pinned: {preview}', {
          name: getPinActorName(pin),
          preview: getPinPreviewText(pin),
        });
      }
    
      function buildPinBrowserNotification(pin, chatId) {
        const chat = getChatById(chatId);
        const actorName = getPinActorName(pin);
        const preview = getPinPreviewText(pin);
        return {
          title: chat?.type === 'private' ? actorName : (chat?.name || 'BananZa'),
          body: chat?.type === 'private'
            ? t('Pinned message: {preview}', { preview })
            : t('{name} pinned: {preview}', { name: actorName, preview }),
        };
      }
    
      function getChatPins(chatId = currentChatId) {
        return chatPinsByChat.get(Number(chatId || 0)) || [];
      }
    
      function getPinForMessage(messageId, chatId = currentChatId) {
        const mid = Number(messageId || 0);
        if (!mid) return null;
        return getChatPins(chatId).find(pin => Number(pin.message_id) === mid) || null;
      }
    
      function canUnpinPin(pin) {
        if (!pin || !currentUser) return false;
        if (currentUser.is_admin) return true;
        if (Number(pin.pinned_by) === Number(currentUser.id)) return true;
        return chatAllowsUnpinAnyPin(getChatById(pin.chat_id));
      }
    
      function getPinActionState(msg) {
        if (!msg || msg.is_deleted || isClientSideMessage(msg)) return { show: false };
        const chatId = Number(msg.chat_id || msg.chatId || currentChatId || 0);
        const pin = getPinForMessage(msg.id, chatId);
        if (!pin) {
          return {
            show: true,
            isPinned: false,
            disabled: false,
            title: t('Pin message'),
            label: t('Pin'),
            iconHtml: '&#128204;',
          };
        }
        const canUnpin = canUnpinPin(pin);
        return {
          show: true,
          isPinned: true,
          disabled: !canUnpin,
          pin,
          title: canUnpin ? t('Unpin message') : t('Pinned by {name}', { name: pin.pinned_by_name || t('another user') }),
          label: canUnpin ? t('Unpin') : t('Pinned'),
          iconHtml: '&#128204;',
        };
      }
    
      function renderPinActionButton(msg) {
        const state = getPinActionState(msg);
        if (!state.show) return '';
        const classes = ['msg-pin-btn'];
        if (state.isPinned) classes.push('active');
        if (state.disabled) classes.push('disabled');
        return `<button class="${classes.join(' ')}" title="${esc(state.title)}" ${state.disabled ? 'disabled' : ''}>${state.iconHtml}</button>`;
      }
    
      function applyPinsUpdate(data = {}) {
        const chatId = Number(data.chatId || data.chat_id || currentChatId || 0);
        if (!chatId) return;
        const previousPins = getChatPins(chatId);
        const hadActiveSelection = activePinIndexByChat.has(chatId);
        const previousIndex = Math.max(0, Number(activePinIndexByChat.get(chatId) || 0));
        const previousPin = previousPins[previousIndex] || previousPins[0] || null;
        const nextPins = normalizePins(data.pins);
        const action = String(data.action || '').toLowerCase();
        const pinnedMessageId = Number(data.messageId || data.message_id || 0);
        chatPinsByChat.set(chatId, nextPins);
    
        let nextIndex = nextPins.length
          ? (hadActiveSelection ? Math.min(previousIndex, nextPins.length - 1) : nextPins.length - 1)
          : 0;
        if (action === 'pinned' && pinnedMessageId) {
          const pinnedIndex = nextPins.findIndex(pin => Number(pin.message_id) === pinnedMessageId);
          if (pinnedIndex >= 0) nextIndex = pinnedIndex;
        } else if (action && previousPin) {
          const found = nextPins.findIndex(pin => Number(pin.message_id) === Number(previousPin.message_id));
          if (found >= 0) nextIndex = found;
        }
        if (nextPins.length) activePinIndexByChat.set(chatId, Math.min(nextIndex, nextPins.length - 1));
        else activePinIndexByChat.set(chatId, 0);
    
        if (Object.prototype.hasOwnProperty.call(data, 'allow_unpin_any_pin')) {
          const chat = getChatById(chatId);
          if (chat) chat.allow_unpin_any_pin = !!data.allow_unpin_any_pin;
        }
    
        if (Number(currentChatId || 0) === chatId) {
          renderPinnedBar(chatId);
          refreshVisiblePinButtons(chatId);
          renderChatPinSettingsForm(getChatById(chatId));
        }
      }
    
      function handlePinnedMessageUpdate(data = {}) {
        const chatId = Number(data.chatId || data.chat_id || 0);
        if (!chatId) return;
        if (Number(data.actorId || 0) === Number(currentUser?.id || 0)) return;
        const messageId = Number(data.messageId || data.message_id || 0);
        if (!messageId) return;
        const pin = getPinForMessage(messageId, chatId);
        if (!pin) return;
    
        if (!document.hidden) {
          if (isPinNotificationEnabled(chatId)) {
            showCenterToast(getPinToastText(pin));
          }
          if (isPinSoundEnabled(chatId)) {
            playAppSound('pin');
          }
          return;
        }
    
        if (
          'Notification' in window &&
          Notification.permission === 'granted' &&
          notificationSettingsController.getSettings().push_enabled &&
          isPinNotificationEnabled(chatId) &&
          !notificationSettingsController.isPushDeviceSubscribed()
        ) {
          const content = buildPinBrowserNotification(pin, chatId);
          new Notification(content.title, {
            body: content.body.substring(0, 100),
            icon: '/favicon.ico',
          });
        }
      }
    
      async function loadChatPins(chatId = currentChatId) {
        const id = Number(chatId || 0);
        if (!id) return [];
        try {
          const data = await api(`/api/chats/${id}/pins`);
          applyPinsUpdate({ ...data, chatId: id });
          return getChatPins(id);
        } catch (e) {
          if (Number(currentChatId || 0) === id) renderPinnedBar(id);
          return [];
        }
      }
    
      function renderPinnedBar(chatId = currentChatId) {
        if (!pinnedBar) return;
        const id = Number(chatId || 0);
        if (!id || Number(currentChatId || 0) !== id) {
          pinnedBar.classList.add('hidden');
          pinnedBar.innerHTML = '';
          queueIosViewportLayoutSync();
          return;
        }
        const pins = getChatPins(id);
        if (!pins.length) {
          pinnedBar.classList.add('hidden');
          pinnedBar.innerHTML = '';
          queueIosViewportLayoutSync();
          return;
        }
    
        const index = Math.min(Math.max(0, Number(activePinIndexByChat.get(id) || 0)), pins.length - 1);
        activePinIndexByChat.set(id, index);
        const activePin = pins[index];
        const canUnpinActive = canUnpinPin(activePin);
        const isMultiple = pins.length > 1;
    
        pinnedBar.innerHTML = `
          <div class="pinned-bar-viewport" role="list" aria-label="${esc(t('Pinned messages'))}">
            ${pins.map((pin, pinIndex) => {
              const preview = getPinPreviewText(pin);
              const author = pin.message_author_name ? `${pin.message_author_name}` : t('Message');
              const pinnedBy = pin.pinned_by_name ? t('Pinned by {name}', { name: pin.pinned_by_name }) : t('Pinned message');
              return `
                <button type="button" class="pinned-bar-item${pinIndex === index ? ' active' : ''}" data-pin-index="${pinIndex}" title="${esc(t('Jump to pinned message'))}">
                  <span class="pinned-bar-icon" aria-hidden="true">&#128204;</span>
                  <span class="pinned-bar-copy">
                    <strong>${esc(preview)}</strong>
                    <small>${esc(author)} &middot; ${esc(pinnedBy)}</small>
                  </span>
                </button>
              `;
            }).join('')}
          </div>
          <div class="pinned-bar-side">
            <button type="button" class="pinned-bar-close${canUnpinActive ? '' : ' hidden'}" title="${esc(t('Unpin message'))}" aria-label="${esc(t('Unpin pinned message'))}">&times;</button>
            ${isMultiple ? `<span class="pinned-bar-count">${index + 1}/${pins.length}</span>` : ''}
          </div>
          ${isMultiple ? '<div class="pinned-bar-scrollbar" aria-hidden="true"><span class="pinned-bar-scrollbar-thumb"></span></div>' : ''}
        `;
        pinnedBar.classList.toggle('has-multiple', isMultiple);
        pinnedBar.classList.remove('hidden');
        queueIosViewportLayoutSync();
    
        const viewport = pinnedBar.querySelector('.pinned-bar-viewport');
        const updateScrollbar = () => {
          const track = pinnedBar.querySelector('.pinned-bar-scrollbar');
          const thumb = pinnedBar.querySelector('.pinned-bar-scrollbar-thumb');
          if (!viewport || !track || !thumb) return;
          const scrollHeight = Math.max(viewport.scrollHeight, viewport.clientHeight);
          const scrollRange = Math.max(1, scrollHeight - viewport.clientHeight);
          const trackHeight = track.clientHeight || viewport.clientHeight || 1;
          const thumbHeight = Math.max(14, Math.round((viewport.clientHeight / scrollHeight) * trackHeight));
          const maxTop = Math.max(0, trackHeight - thumbHeight);
          const top = Math.round(maxTop * ((viewport.scrollTop || 0) / scrollRange));
          thumb.style.height = `${thumbHeight}px`;
          thumb.style.transform = `translateY(${top}px)`;
        };
        const syncActivePinFromScroll = () => {
          if (!viewport) return;
          const firstItem = viewport.querySelector('.pinned-bar-item');
          const itemHeight = firstItem ? firstItem.getBoundingClientRect().height : viewport.clientHeight;
          const nextIndex = Math.min(pins.length - 1, Math.max(0, Math.round((viewport.scrollTop || 0) / Math.max(1, itemHeight || 1))));
          activePinIndexByChat.set(id, nextIndex);
          const countEl = pinnedBar.querySelector('.pinned-bar-count');
          if (countEl) countEl.textContent = `${nextIndex + 1}/${pins.length}`;
          pinnedBar.querySelectorAll('.pinned-bar-item').forEach((item) => {
            item.classList.toggle('active', Number(item.dataset.pinIndex || 0) === nextIndex);
          });
          const closeBtn = pinnedBar.querySelector('.pinned-bar-close');
          if (closeBtn) closeBtn.classList.toggle('hidden', !canUnpinPin(pins[nextIndex]));
          updateScrollbar();
        };
    
        viewport?.addEventListener('scroll', () => {
          if (pins.length <= 1) return;
          window.requestAnimationFrame(syncActivePinFromScroll);
        });
        requestAnimationFrame(() => {
          const targetItem = viewport?.querySelector(`.pinned-bar-item[data-pin-index="${index}"]`);
          if (viewport && targetItem) viewport.scrollTop = targetItem.offsetTop;
          if (isMultiple) syncActivePinFromScroll();
          else updateScrollbar();
        });
    
        pinnedBar.querySelectorAll('.pinned-bar-item').forEach((item) => {
          item.addEventListener('click', () => {
            const pinIndex = Number(item.dataset.pinIndex || 0);
            activePinIndexByChat.set(id, pinIndex);
            jumpToPinnedMessage(pins[pinIndex]);
          });
        });
        pinnedBar.querySelector('.pinned-bar-close')?.addEventListener('click', (e) => {
          e.stopPropagation();
          const pinIndex = Math.min(pins.length - 1, Math.max(0, Number(activePinIndexByChat.get(id) || 0)));
          unpinPin(pins[pinIndex]);
        });
      }
    
      async function jumpToPinnedMessage(pin) {
        if (!pin?.message_id || !pin?.chat_id) return false;
        const sameChat = Number(pin.chat_id) === Number(currentChatId || 0);
        if (sameChat && scrollToMessage(pin.message_id, { highlightClass: 'is-pin-hit' })) return true;
        await openChat(pin.chat_id, {
          anchorMessageId: pin.message_id,
          suppressHistoryPush: sameChat,
          source: 'pin',
        });
        if (scrollToMessage(pin.message_id, { highlightClass: 'is-pin-hit' })) return true;
        showCenterToast('Pinned message not found');
        return false;
      }
    
      async function pinMessage(msg) {
        if (!msg?.id) return;
        try {
          const chatId = Number(msg.chat_id || msg.chatId || currentChatId || 0);
          const data = await api(`/api/messages/${msg.id}/pin`, { method: 'POST' });
          applyPinsUpdate({ ...data, chatId });
          appendPinEventIfVisible(data.pin_event || data.pinEvent);
          showCenterToast('Message pinned');
        } catch (e) {
          showCenterToast(e.message || 'Could not pin message');
        }
      }
    
      async function unpinPin(pin) {
        if (!pin?.message_id) return;
        if (!canUnpinPin(pin)) {
          showCenterToast('Only the pin owner or admin can unpin this');
          return;
        }
        try {
          const data = await api(`/api/messages/${pin.message_id}/pin`, { method: 'DELETE' });
          applyPinsUpdate({ ...data, chatId: pin.chat_id });
          showCenterToast('Message unpinned');
        } catch (e) {
          showCenterToast(e.message || 'Could not unpin message');
        }
      }
    
      async function togglePinFromRow(row) {
        const msg = row?.__messageData;
        const state = getPinActionState(msg);
        if (!state.show) return;
        hideFloatingMessageActions();
        if (state.isPinned) {
          if (state.disabled) {
            showCenterToast('Only the pin owner or admin can unpin this');
            return;
          }
          await unpinPin(state.pin);
          return;
        }
        await pinMessage(msg);
      }
    
      function refreshVisiblePinButtons(chatId = currentChatId) {
        const id = Number(chatId || 0);
        if (!id || Number(currentChatId || 0) !== id) return;
        messagesEl.querySelectorAll('.msg-row[data-msg-id]').forEach((row) => {
          const btn = row.querySelector('.msg-pin-btn');
          if (!btn) return;
          const state = getPinActionState(row.__messageData);
          if (!state.show) {
            btn.remove();
            return;
          }
          btn.classList.toggle('active', !!state.isPinned);
          btn.classList.toggle('disabled', !!state.disabled);
          btn.disabled = !!state.disabled;
          btn.title = state.title;
          btn.innerHTML = state.iconHtml;
        });
      }
    
      function resolveUiTarget(target) {
        if (!target) return null;
        if (typeof target !== 'string') return target;
        if (target.startsWith('#')) return document.querySelector(target);
        return document.getElementById(target) || document.querySelector(target);
      }
    
      function getPayloadChatId(payload = {}) {
        const id = Number(payload.chatId || payload.chat_id || 0);
        return Number.isInteger(id) && id > 0 ? id : 0;
      }
    
      function handleServiceWorkerMessage(event) {
        const data = event.data || {};
        if (data.type === 'open_chat') {
          openChatFromPush(data.chatId).catch(() => {});
        } else if (data.type === 'push_received') {
          const chatId = getPayloadChatId(data.payload || {});
          scheduleRecoverySync('push', {
            chatId,
            immediate: Boolean(chatId && Number(chatId) === Number(currentChatId || 0)),
          });
        }
      }
    
      function chatItemAvatarHtml(chat) {
        return chatListRenderer.chatItemAvatarHtml(chat);
      }
    
      async function loadHiddenChatSearch(query) {
        return chatListService.searchHiddenChats(query);
      }
    
      function scheduleHiddenChatSearch(query) {
        return chatListService.scheduleHiddenChatSearch(query);
      }
    
      async function openHiddenChatFromSearch(chatId) {
        return chatListService.openHiddenChatFromSearch(chatId);
      }
    
      async function openPrivateChatFromDirectory(userId) {
        const id = Number(userId || 0);
        if (!id) return;
        const chat = await api('/api/chats/private', { method: 'POST', body: { targetUserId: id } });
        await loadChats();
        await openChat(chat.id);
        setChatSearchOpen(false, { clear: true, focus: false });
        return chat;
      }
    
      function showCenterToast(message) {
        let toast = document.getElementById('centerToast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'centerToast';
          toast.className = 'center-toast';
          document.body.appendChild(toast);
        }
        clearTimeout(centerToastTimer);
        toast.textContent = tx(message);
        toast.classList.remove('is-visible');
        void toast.offsetWidth;
        toast.classList.add('is-visible');
        centerToastTimer = setTimeout(() => {
          toast.classList.remove('is-visible');
        }, 2000);
      }
    
      function suppressNextChatItemTap(options = 650) { const config = options && typeof options === 'object' ? options : { ms: options }; const current = suppressNextChatItemTapUntil; suppressNextChatItemTapUntil = { until: Math.max(current && typeof current === 'object' ? Number(current.until || 0) : Number(current || 0), Date.now() + Math.max(0, Number(config.ms ?? 650) || 0)), pointerType: config.pointerType === 'mouse' || config.pointerType === 'any' ? config.pointerType : 'touch' }; }
    
      function getFolderPinnedChatMoveState(folderId, chatId) {
        const folder = chatFolderStore.getFolderById(folderId);
        const pinned = Array.isArray(folder?.pins) ? folder.pins : [];
        const index = pinned.findIndex((entry) => Number(entry.chat_id || 0) === Number(chatId || 0));
        return {
          index,
          total: pinned.length,
          canMoveUp: index > 0,
          canMoveDown: index >= 0 && index < pinned.length - 1,
        };
      }
    
      function renderFolderSelectableChatItem(chat, options = {}) { return folderUiController.renderFolderSelectableChatItem(chat, options); }
      function totalUnreadForFolder(folder) { return chatFolderStore.totalUnreadForFolder(folder, chats); }
      function visibleChatCountForFolder(folder) { return chatFolderStore.visibleChatCountForFolder(folder, chats); }
      function renderChatFolderPicker() { return folderUiController.renderChatFolderPicker(); }
      function positionChatFolderPicker() { return folderUiController.positionChatFolderPicker(); }
      function hideChatFolderContextMenu(options = {}) { return folderUiController.hideChatFolderContextMenu(options); }
      function renderChatFolderContextMenu(folder) { return folderUiController.renderChatFolderContextMenu(folder); }
      function positionChatFolderContextMenu() { return folderUiController.positionChatFolderContextMenu(); }
      function refreshChatFolderContextMenu(folderId) { return folderUiController.refreshChatFolderContextMenu(folderId); }
      function showChatFolderContextMenu(folderId, anchor) { return folderUiController.showChatFolderContextMenu(folderId, anchor); }
      function hideChatFolderPicker(options = {}) { return folderUiController.hideChatFolderPicker(options); }
      function showChatFolderPicker(opener = chatFoldersBtn) { return folderUiController.showChatFolderPicker(opener); }
      async function createChatFolder(name, chatIds = []) { return folderActionsController.createChatFolder(name, chatIds); }
      async function renameChatFolder(folderId, nextName = '') { return folderActionsController.renameChatFolder(folderId, nextName); }
      async function deleteChatFolder(folderId) { return folderActionsController.deleteChatFolder(folderId); }
      async function setChatFolderOrder(folderIds = []) { return folderActionsController.setChatFolderOrder(folderIds); }
      async function moveChatFolder(folderId, direction) { return folderActionsController.moveChatFolder(folderId, direction); }
      async function addChatsToFolder(folderId, chatIds = []) { return folderActionsController.addChatsToFolder(folderId, chatIds); }
      async function removeChatFromFolder(folderId, chatId) { return folderActionsController.removeChatFromFolder(folderId, chatId); }
      async function setFolderChatPin(folderId, chatId, pinned) { return folderActionsController.setFolderChatPin(folderId, chatId, pinned); }
      async function moveFolderChatPin(folderId, chatId, direction) { return folderActionsController.moveFolderChatPin(folderId, chatId, direction); }
      async function handleChatFolderContextMenuAction(action, folderId) { return folderActionsController.handleChatFolderContextMenuAction(action, folderId); }
      function resetChatFolderManageModal() { return folderManageModalController.resetChatFolderManageModal(); }
      function renderChatFolderManageModal(chatId) { return folderManageModalController.renderChatFolderManageModal(chatId); }
      async function openChatFolderManageModal(chatId, opener = null) { return folderManageModalController.openChatFolderManageModal(chatId, opener); }
      async function saveChatFolderManageChanges() { return folderManageModalController.saveChatFolderManageChanges(); }
    
      async function setChatSidebarPin(chatId, pinned) {
        try {
          await api(`/api/chats/${chatId}/sidebar-pin`, { method: 'PUT', body: { pinned } });
          await loadChats({ silent: true });
          showCenterToast(pinned ? 'Chat pinned' : 'Chat unpinned');
        } catch (e) {
          showCenterToast(e.message || (pinned ? 'Could not pin chat' : 'Could not unpin chat'));
        }
      }
    
      async function moveChatSidebarPin(chatId, direction) {
        try {
          await api(`/api/chats/${chatId}/sidebar-pin/move`, { method: 'POST', body: { direction } });
          await loadChats({ silent: true });
          showCenterToast(direction === 'up' ? 'Moved up' : 'Moved down');
        } catch (e) {
          showCenterToast(e.message || 'Could not move pinned chat');
        }
      }
    
      async function clearCachedChat(chatId, { includeOutbox = true } = {}) {
        try {
          await window.messageCache?.clearChat?.(chatId, { includeOutbox });
        } catch (e) {}
      }
    
      function resetChatPreviewAfterHistoryClear(chatId) {
        const chat = getChatById(chatId);
        if (!chat) return;
        chat.last_text = null;
        chat.last_time = null;
        chat.last_user = null;
        chat.last_file_id = null;
        chat.last_message_id = 0;
        chat.first_unread_id = null;
        chat.unread_count = 0;
      }
    
      function revealChatListAfterActiveChatClose() {
        if (!isMobileLayoutViewport() || !sidebar) return;
        resetBackButtonNavigationState();
        revealSidebarFromChat();
      }
    
      function closeChatViewForChat(chatId) {
        const id = Number(chatId || 0);
        if (!id || Number(currentChatId || 0) !== id) return;
        markCurrentChatReadIfAtBottom(false);
        flushCurrentChatScrollAnchor(id, { force: true, allowPendingMedia: true });
        pauseCurrentChatMediaPlayback();
        dismissMobileComposer({ forceRecovery: true, reason: 'close-chat-view', recoveryDelayMs: 280 });
        hideFloatingMessageActions({ immediate: true });
        hideMentionPicker();
        closeEmojiPicker({ immediate: true });
        hideAttachMenu({ immediate: true });
        clearActivePulseVoterPopover({ skipRefresh: true });
        hideAvatarUserMenu();
        clearReply();
        if (composerStateController.editTo) clearEdit({ clearInput: true });
        currentChatId = null;
        updateComposerAiOverrideState().catch(() => {});
        messageStateController?.clearDisplayedMessages?.();
        messageStateController?.clearDisplayedPinEvents?.();
        chatPinsByChat.delete(id);
        readReceiptController.clearChatMemberLastReads(id);
        replaceRenderedMessages([]);
        setHasMoreBefore(false);
        setHasMoreAfter(false);
        chatView.classList.add('hidden');
        emptyState.classList.remove('hidden');
        renderCurrentChatHeader(null);
        applyChatBackground(null);
        if (String(localStorage.getItem('lastChat') || '') === String(id)) {
          localStorage.removeItem('lastChat');
        }
        revealChatListAfterActiveChatClose();
      }
    
      async function removeChatLocally(chatId, { clearCache = false } = {}) {
        const result = await chatListService.removeChatLocally(chatId, { clearCache });
        refreshChatListReferences();
        syncCoreStateToRuntime();
        return result;
      }
    
      async function clearLocalChatHistory(chatId, { clearCache = true } = {}) {
        const id = Number(chatId || 0);
        if (!id) return;
        resetChatPreviewAfterHistoryClear(id);
        chatPinsByChat.set(id, []);
        readReceiptController.clearChatMemberLastReads(id);
        if (Number(currentChatId || 0) === id) {
          hideFloatingMessageActions({ immediate: true });
          clearReply();
          if (composerStateController.editTo) clearEdit({ clearInput: true });
          replaceRenderedMessages([]);
          setHasMoreBefore(false);
          setHasMoreAfter(false);
          renderPinnedBar(id);
          updateScrollBottomButton();
        }
        renderChatList(chatSearch.value);
        if (clearCache) await clearCachedChat(id, { includeOutbox: true });
      }
      async function hideChatFromList(chatId) {
        const chat = getChatById(chatId);
        if (!canHideChat(chat)) return;
        try {
          await api(`/api/chats/${chatId}/hide`, { method: 'POST' });
          await removeChatLocally(chatId, { clearCache: false });
          showCenterToast('\u0427\u0430\u0442 \u0441\u043a\u0440\u044b\u0442');
        } catch (e) {
          showCenterToast(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u0440\u044b\u0442\u044c \u0447\u0430\u0442');
        }
      }
      async function leaveChat(chatId) {
        const chat = getChatById(chatId);
        if (!canLeaveChat(chat)) return;
        const isDocument = isDocumentChat(chat);
        if (!confirm(t(isDocument ? 'Leave this document?' : 'Leave this chat?'))) return;
        try {
          await api(`/api/chats/${chatId}/members/me`, { method: 'DELETE' });
          await removeChatLocally(chatId, { clearCache: true }); closeAllModals({ immediate: true });
          showCenterToast(t(isDocument ? 'You left the document' : 'You left the chat'));
        } catch (e) {
          showCenterToast(e.message || t(isDocument ? 'Could not leave document' : 'Could not leave chat'));
        }
      }
      async function deleteChatCompletely(chatId) {
        const chat = getChatById(chatId);
        if (!canManageDestructiveChat(chat)) return;
        const isDocument = isDocumentChat(chat);
        if (!confirm(t(isDocument ? 'Delete document permanently?' : 'Delete chat permanently?'))) return;
        try {
          await api(`/api/chats/${chatId}`, { method: 'DELETE' });
          await removeChatLocally(chatId, { clearCache: true }); closeAllModals({ immediate: true });
          showCenterToast(t(isDocument ? 'Document deleted' : 'Chat deleted'));
        } catch (e) {
          showCenterToast(e.message || t(isDocument ? 'Could not delete document' : 'Could not delete chat'));
        }
      }
      async function clearChatHistoryForEveryone(chatId) {
        const chat = getChatById(chatId);
        if (!canManageDestructiveChat(chat)) return;
        const isDocument = isDocumentChat(chat);
        if (!confirm(t(isDocument ? 'Clear document content for everyone?' : 'Clear chat history for everyone?'))) return;
        try {
          if (isDocument) {
            const data = await api(`/api/documents/${chatId}/content`, { method: 'DELETE' }); if (data?.chat) applyChatUpdate(data.chat);
          } else {
            await api(`/api/chats/${chatId}/history`, { method: 'DELETE' }); await clearLocalChatHistory(chatId, { clearCache: true });
            await loadChats({ silent: true });
          }
          showCenterToast(t(isDocument ? 'Document cleared' : 'History cleared'));
        } catch (e) {
          showCenterToast(e.message || t(isDocument ? 'Could not clear document' : 'Could not clear history'));
        }
      }
      async function copyTextToClipboard(text) {
        const value = String(text || '');
        if (!value) return false;
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return true;
          }
        } catch (e) {}
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', 'readonly');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        area.style.pointerEvents = 'none';
        document.body.appendChild(area);
        area.focus();
        area.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        area.remove();
        return ok;
      }
    
      function modalEntryOf(modalOrId) {
        return modalManager.getEntry(modalOrId);
      }
    
      function rememberActiveElement() {
        return document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
    
      function focusElementIfPossible(el) {
        if (!(el instanceof HTMLElement) || !el.isConnected) return false;
        if (el.matches('[disabled], [aria-hidden="true"]')) return false;
        if (el.closest('[inert]')) return false;
        try {
          el.focus({ preventScroll: true });
          return true;
        } catch {
          try {
            el.focus();
            return true;
          } catch {
            return false;
          }
        }
      }
    
      function blurFocusedElementWithin(root) {
        if (!(root instanceof HTMLElement)) return false;
        const active = document.activeElement;
        if (!(active instanceof HTMLElement) || !root.contains(active)) return false;
        try {
          active.blur();
          return true;
        } catch {
          return false;
        }
      }
    
      function parseTransitionTimeMs(value) {
        const text = String(value || '').trim();
        if (!text) return 0;
        if (text.endsWith('ms')) return Math.max(0, Number.parseFloat(text) || 0);
        if (text.endsWith('s')) return Math.max(0, (Number.parseFloat(text) || 0) * 1000);
        return Math.max(0, Number.parseFloat(text) || 0);
      }
    
      function getElementTransitionTotalMs(el) {
        if (!(el instanceof Element)) return 0;
        const styles = window.getComputedStyle(el);
        const durations = String(styles.transitionDuration || '').split(',').map(parseTransitionTimeMs);
        const delays = String(styles.transitionDelay || '').split(',').map(parseTransitionTimeMs);
        const count = Math.max(durations.length, delays.length);
        let max = 0;
        for (let index = 0; index < count; index += 1) {
          const duration = durations[durations.length ? index % durations.length : 0] || 0;
          const delay = delays[delays.length ? index % delays.length : 0] || 0;
          max = Math.max(max, duration + delay);
        }
        return max;
      }
    
      function registerModal(modalOrId, options = {}) {
        return modalManager.register(modalOrId, options);
      }
    
      function handleGrokImageRiskModalClosed() {
        if (grokImageRiskTerms) {
          grokImageRiskTerms.innerHTML = '';
          grokImageRiskTerms.classList.add('hidden');
        }
        if (!grokImageRiskConfirmResolver) return;
        const resolve = grokImageRiskConfirmResolver;
        grokImageRiskConfirmResolver = null;
        resolve(false);
      }
    
      function ensureDeepseekTextBotsModalContent() {
        const modalBlock = $('#deepseekAiTextBotsBlock');
        if (!modalBlock) return;
        const botPanel = $('#deepseekAiBotList')?.closest('.ai-bot-panel');
        const chatPanel = $('#deepseekAiBotChatSelect')?.closest('.ai-bot-panel');
        [botPanel, chatPanel].forEach((panel) => {
          if (panel && panel.parentElement !== modalBlock) {
            modalBlock.appendChild(panel);
          }
        });
      }
    
      function ensureQwenTextBotsModalContent() {
        const modalBlock = $('#qwenAiTextBotsBlock');
        if (!modalBlock) return;
        const botPanel = $('#qwenAiBotList')?.closest('.ai-bot-panel');
        const chatPanel = $('#qwenAiBotChatSelect')?.closest('.ai-bot-panel');
        [botPanel, chatPanel].forEach((panel) => {
          if (panel && panel.parentElement !== modalBlock) {
            modalBlock.appendChild(panel);
          }
        });
      }
    
      function registerBuiltinModals() {
        ensureDeepseekTextBotsModalContent();
        ensureQwenTextBotsModalContent();
        modalManager.registerBuiltins([
          newChatModal,
          adminModal,
          chatInfoModal,
          menuDrawer,
          settingsModal,
          languageSettingsModal,
          themeSettingsModal,
          visualModeSettingsModal,
          pollStyleSettingsModal,
          animationSettingsModal,
          mobileFontSettingsModal,
          weatherSettingsModal,
          notificationSettingsModal,
          soundSettingsModal,
          aiBotSettingsModal,
          openAiTextBotsModal,
          openAiUniversalBotsModal,
          openAiImageBotsModal,
          contextConvertBotsModal,
          chatShotBotsModal,
          yandexAiSettingsModal,
          deepseekAiSettingsModal,
          deepseekAiTextBotsModal,
          qwenAiSettingsModal,
          qwenAiTextBotsModal,
          grokAiSettingsModal,
          grokAiTextBotsModal,
          grokAiImageBotsModal,
          grokAiUniversalBotsModal,
          changePasswordModal,
          { modal: grokImageRiskConfirmModal, onAfterClose: handleGrokImageRiskModalClosed },
          { modal: chatFolderManageModal, onAfterClose: resetChatFolderManageModal },
          { modal: forwardMessageModal, onAfterClose: resetForwardMessageModal },
          { modal: pollComposerModal, onAfterClose: resetPollComposer },
          { modal: pollVotersModal, onAfterClose: resetPollVotersModal },
        ]);
      }
    
      function getTopModal() {
        return modalManager.getTop();
      }
    
      function hasOpenModal() {
        return modalManager.hasOpen();
      }
    
      function openModal(modalOrId, options = {}) {
        return modalManager.open(modalOrId, options);
      }
    
      function closeModal(modalOrId, options = {}) {
        return modalManager.close(modalOrId, options);
      }
    
      function closeTopModal(options = {}) {
        return modalManager.closeTop(options);
      }
    
      function closeAllModals(options = {}) {
        return modalManager.closeAll(options);
      }
    
      async function loadMentionTargets(...args) { return composerMentionsController?.loadMentionTargets?.(...args) || []; }
    
      function suppressMentionPickerFollowupClick(...args) { return composerMentionsController?.suppressMentionPickerFollowupClick?.(...args); }
    
      function suppressContextConvertPickerFollowupClick(ms = 550) {
        contextConvertPickerClickSuppressUntil = Math.max(contextConvertPickerClickSuppressUntil, Date.now() + ms);
      }
    
      function clearContextConvertPickerFollowupClickSuppress() {
        contextConvertPickerClickSuppressUntil = 0;
      }
    
      function ensureMentionPickerBackdrop(...args) { return composerMentionsController?.ensureMentionPickerBackdrop?.(...args); }
    
      function ensureMentionPicker(...args) { return composerMentionsController?.ensureMentionPicker?.(...args); }
    
      function isComposerMeaningfullyEmpty(...args) { return composerMentionsController?.isComposerMeaningfullyEmpty?.(...args) || false; }
    
      function getManualMentionRange(...args) { return composerMentionsController?.getManualMentionRange?.(...args) || { start: 0, end: 0 }; }
    
      function syncMentionOpenButton(...args) { return composerMentionsController?.syncMentionOpenButton?.(...args); }
    
      function hideMentionPicker(...args) { return composerMentionsController?.hideMentionPicker?.(...args); }
    
      function findMentionTrigger(...args) { return composerMentionsController?.findMentionTrigger?.(...args) || null; }
    
      function positionMentionPicker(...args) { return composerMentionsController?.positionMentionPicker?.(...args); }
    
      function renderMentionPicker(...args) { return composerMentionsController?.renderMentionPicker?.(...args); }
    
      async function openMentionPickerFromButton(...args) { return composerMentionsController?.openMentionPickerFromButton?.(...args); }
    
      async function updateMentionPicker(...args) { return composerMentionsController?.updateMentionPicker?.(...args); }
    
      function insertMentionTarget(...args) { return composerMentionsController?.insertMentionTarget?.(...args); }
    
      function insertMentionTokenIntoComposer(...args) { return composerMentionsController?.insertMentionTokenIntoComposer?.(...args); }
    
      function insertRawMentionTriggerAtCursor(...args) { return composerMentionsController?.insertRawMentionTriggerAtCursor?.(...args); }
    
      async function openPrivateChatWithUser(userId) {
        const id = Number(userId);
        if (!id || id === currentUser?.id) return;
        const chat = await api('/api/chats/private', { method: 'POST', body: { targetUserId: id } });
        await loadChats();
        if (chat?.id) openChat(chat.id);
      }
    
      function handleMentionPickerKeydown(...args) { return composerMentionsController?.handleMentionPickerKeydown?.(...args) || false; }
    
      async function handleMentionClick(...args) { return composerMentionsController?.handleMentionClick?.(...args); }
    
      function isGroupLikeCurrentChat() {
        const chat = getChatById(currentChatId);
        return Boolean(chat && (chat.type === 'group' || chat.type === 'general'));
      }
    
      function ensureAvatarUserMenu() {
        let menu = $('#avatarUserMenu');
        if (menu) return menu;
        menu = document.createElement('div');
        menu.id = 'avatarUserMenu';
        menu.className = 'avatar-user-menu hidden';
        menu.addEventListener('pointerdown', (e) => {
          const action = e.target.closest('[data-avatar-action]')?.dataset.avatarAction;
          if (!action || !avatarUserMenuState) return;
          e.preventDefault();
          e.stopPropagation();
          const target = avatarUserMenuState.target;
          suppressAvatarUserMenuFollowupClick();
          hideAvatarUserMenu();
          if (action === 'mention') {
            insertMentionTokenIntoComposer(target.token);
          } else if (action === 'private') {
            openPrivateChatWithUser(target.userId).catch((error) => {
              console.warn('[avatar-menu] private chat failed:', error.message);
            });
          }
        }, { passive: false });
        menu.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        document.body.appendChild(menu);
        return menu;
      }
    
      function hideAvatarUserMenu() {
        avatarUserMenuState = null;
        $('#avatarUserMenu')?.classList.add('hidden');
      }
    
      function positionAvatarUserMenu(anchor) {
        const menu = $('#avatarUserMenu');
        if (!menu || menu.classList.contains('hidden') || !anchor) return;
        const rect = anchor.getBoundingClientRect();
        const vv = window.visualViewport;
        const viewportLeft = vv ? vv.offsetLeft : 0;
        const viewportTop = vv ? vv.offsetTop : 0;
        const viewportWidth = vv ? vv.width : window.innerWidth;
        const viewportHeight = vv ? vv.height : window.innerHeight;
        const width = menu.offsetWidth || 190;
        const height = menu.offsetHeight || 92;
        let left = rect.left + viewportLeft + rect.width + 8;
        if (left + width > viewportLeft + viewportWidth - 8) left = rect.left + viewportLeft - width - 8;
        left = Math.max(viewportLeft + 8, Math.min(left, viewportLeft + viewportWidth - width - 8));
        let top = rect.top + viewportTop - Math.max(0, (height - rect.height) / 2);
        top = Math.max(viewportTop + 8, Math.min(top, viewportTop + viewportHeight - height - 8));
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
      }
    
      function avatarMenuTargetFromEl(avatarEl) {
        if (!avatarEl) return null;
        const userId = Number(avatarEl.dataset.userId || 0);
        const token = String(avatarEl.dataset.mentionToken || '').replace(/^@+/, '').trim();
        if (!userId || !token) return null;
        return {
          userId,
          token,
          displayName: avatarEl.dataset.displayName || '',
          username: avatarEl.dataset.username || token,
          avatarColor: avatarEl.dataset.avatarColor || '#65aadd',
          avatarUrl: avatarEl.dataset.avatarUrl || '',
          profile_status_key: avatarEl.dataset.profileStatusKey || '',
          profile_status_text: avatarEl.dataset.profileStatusText || '',
          isAiBot: avatarEl.dataset.isAiBot === '1',
          isSelf: userId === currentUser?.id,
        };
      }

      function findAvatarMenuUser(target) {
        const userId = Number(target?.userId || 0);
        if (!userId) return null;
        const matches = (user) => Number(user?.id || user?.user_id || 0) === userId;
        if (matches(currentUser)) return currentUser;
        for (const members of [allUsers, [getChatById(currentChatId)?.private_user], chatMembersCache?.get?.(currentChatId)]) {
          const found = (members || []).filter(Boolean).find(matches);
          if (found) return found;
        }
        let found = null;
        chatMembersCache?.forEach?.((members) => { if (!found) found = members.find?.(matches) || null; });
        if (found) return found;
        composerStateController?.mentionTargetsByChat?.forEach?.((targets) => { if (!found) found = targets.find?.(matches) || null; });
        return found;
      }

      function openAvatarUserMenu(avatarEl) {
        if (!isGroupLikeCurrentChat()) return;
        const target = avatarMenuTargetFromEl(avatarEl);
        if (!target) return;
        hideMentionPicker();
        const menu = ensureAvatarUserMenu();
        const canOpenPrivate = !target.isSelf && !target.isAiBot;
        const sourceUser = findAvatarMenuUser(target) || {};
        const user = { id: target.userId, username: sourceUser.username || target.username || target.token, display_name: sourceUser.display_name || target.displayName || target.token, avatar_color: sourceUser.avatar_color || target.avatarColor || '#65aadd', avatar_url: sourceUser.avatar_url || target.avatarUrl || '', profile_status_key: sourceUser.profile_status_key || target.profile_status_key || '', profile_status_text: sourceUser.profile_status_text || target.profile_status_text || '', is_ai_bot: target.isAiBot ? 1 : 0 };
        const status = profileStatusLabel(user);
        const handle = user.username ? `@${user.username}` : '';
        const avatarVisual = user.avatar_url ? `<img class="avatar-img" src="${esc(user.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">` : esc(initials(user.display_name || user.username || '?'));
        menu.innerHTML = `
          <div class="avatar-user-card">
            <div class="avatar-user-card-avatar" style="background:${esc(user.avatar_color || '#65aadd')}">${avatarVisual}</div>
            <div class="avatar-user-card-copy">
              <div class="avatar-user-card-name">${esc(user.display_name || target.displayName || target.token)}</div>
              ${handle ? `<div class="avatar-user-card-handle">${esc(handle)}</div>` : ''}
              ${status ? `<div class="avatar-user-card-status">${esc(status)}</div>` : ''}
            </div>
          </div>
          <button type="button" data-avatar-action="mention">&#1059;&#1087;&#1086;&#1084;&#1103;&#1085;&#1091;&#1090;&#1100;</button>
          ${canOpenPrivate ? '<button type="button" data-avatar-action="private">&#1055;&#1077;&#1088;&#1077;&#1081;&#1090;&#1080; &#1074; &#1083;&#1080;&#1095;&#1085;&#1099;&#1081; &#1095;&#1072;&#1090;</button>' : ''}
        `;
        avatarUserMenuState = { target, anchor: avatarEl };
        menu.classList.remove('hidden');
        positionAvatarUserMenu(avatarEl);
      }
    
      authService.configure?.({
        onApplyStoredUser: (user) => {
          currentUser = user;
          token = authService.getToken?.() || localStorage.getItem('token');
          applyUiTheme(currentUser.ui_theme, false);
          applyVisualMode(currentUser.ui_visual_mode, false);
          applyModalAnimation(currentUser.ui_modal_animation, false);
          applyModalAnimationSpeed(currentUser.ui_modal_animation_speed, false);
          applyMobileFontSize(currentUser.ui_mobile_font_size, false);
          syncCoreStateToRuntime();
        },
        cleanup: () => {
          chatListService.clearCacheSyncTimer();
          openChatController.clearMessageBackgroundSyncTimer();
          websocketService.clearReconnectTimer?.();
          uiSettings.clearMobileFontSizeSaveTimer();
          clearMobileFontSizeStatusTimer();
          chatListService.abortChatListRequest();
          try { if (window.clearAssetCache) window.clearAssetCache().catch(()=>{}); } catch (e) {}
          try { if (window.messageCache && window.messageCache.clearUserCache) window.messageCache.clearUserCache().catch(()=>{}); } catch (e) {}
          composerStateController.resetComposerDraftsForCurrentUser({ removeStorage: true });
        },
        onResetUi: () => {
          currentMobileFontSize = MOBILE_FONT_SIZE_DEFAULT;
          setMobileFontAdjustPercent(100);
        },
        redirectToLogin: () => {
          const inviteToken = chatInviteTokenFromPath(location.pathname);
          location.href = inviteToken
            ? `/login.html?next=${encodeURIComponent(`/join/${inviteToken}`)}`
            : '/login.html';
        },
      });
      checkAuth = () => {
        const ok = authService.checkAuth?.() || false;
        syncCoreStateFromRuntime();
        return ok;
      };
      logout = () => {
        syncCoreStateToRuntime();
        const result = authService.logout?.();
        syncCoreStateFromRuntime();
        return result;
      };
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

      return {
        isMobileLayoutViewport, normalizeMobileBaseScene, clearMobileSceneRepaint, getResolvedMobileBaseScene, isMobileBaseSceneHardHidden, setMobileSceneElementState, clearMobileSceneElementState, scheduleActiveMobileSceneRepaint,
        syncMobileBaseSceneState, getComposerTextValue, setComposerTextValue, normalizeComposerInputValue, snapComposerSelectionToCustomEmojiBoundary, insertComposerTextAtSelection, normalizeMicrophoneMode, getMicrophoneMode,
        setMicrophoneMode, getScreenRotationAllowed, syncScreenRotationToggle, setScreenRotationStatus, clearScreenRotationStatusSoon, applyScreenRotationPreference, setScreenRotationAllowed, insertDictatedText,
        getEmojiPickerInsertionValue, deleteComposerCustomEmojiCluster, handleComposerCustomEmojiKeydown, handleComposerCustomEmojiBeforeInput, safeVibrate,
        normalizeChatInviteToken, chatInviteTokenFromPath, chatInviteTokenFromUrl, linkify, mentionKey, renderMessageText,
        normalizeUiTheme, renderThemePicker, applyUiTheme, selectUiTheme, setThemeStatus, normalizeUiLanguage, languageDisplayName, renderLanguagePicker,
        applyUiLanguage, selectUiLanguage, refreshLocalizedUi, syncLanguageSettingsButton, setLanguageStatus, normalizeVisualMode, visualModeMeta, visualModeStateLabel,
        renderVisualModePicker, applyVisualMode, selectVisualMode, setVisualModeStatus, normalizePollStyle, pollStyleMeta, renderPollStyleCardPreview, renderPollStylePicker,
        setPollStyleSurface, syncPollComposerStyleUi, selectPollStyle, setPollStyleStatus, normalizeModalAnimationStyle, modalAnimationMeta, syncModalAnimationSettingsButton, normalizeModalAnimationSpeed,
        getModalAnimationSpeedFactor, setModalAnimationStatus, clearModalAnimationStatusTimer, scheduleModalAnimationStatusClear, getPersistedModalAnimationPreferences, getCurrentModalAnimationPreferences, modalAnimationPreferencesEqual, renderModalAnimationOptions,
        renderModalAnimationSpeedControl, applyModalAnimation, applyModalAnimationSpeed, flushModalAnimationSave, scheduleModalAnimationSave, selectModalAnimation, updateModalAnimationSpeed, normalizeMobileFontSize,
        getMobileFontAdjustPercent, hasAndroidNativeBridge, notifyAndroidScreenRotationPreference, setMobileFontAdjustPercent, notifyAndroidMobileFontSize, syncMobileFontSettingsButton, setMobileFontSizeStatus, clearMobileFontSizeStatusTimer,
        scheduleMobileFontSizeStatusClear, getPersistedMobileFontSize, renderMobileFontSizeControl, applyMobileFontSize, syncMobileFontSizeViewportState, flushMobileFontSizeSave, scheduleMobileFontSizeSave, updateMobileFontSize,
        getSingleEmojiPattern, splitGraphemes, isSingleEmojiMessage, applyPosterToVideoElement, markAttachmentPosterAvailable, ensureAttachmentPoster, localAttachmentFromFile, makeClientId,
        isClientSideMessage, setPollComposerStatus, readPollComposerForm, renderPollComposerOptionInputs, refreshPollComposerActionState, buildPollComposerPreviewMessage, refreshPollComposerPreview, resetPollComposer,
        openPollComposer, avatarHtml, isAiBotDirectoryUser, botMentionText, botModelText, botChatMemberMetaText, profileStatusLabel, userSecondaryLineText, renderSelectableUserItem,
        renderChatMemberItem, formatBotAuditSource, ensureBotVisibilityToggles, setBotVisibilityToggle, getBotVisibilityToggle, updateCurrentUserFooter, persistCurrentUser, syncChatAreaMetrics,
        syncMobileAppHeightToViewport, forceMobileViewportLayoutSync, scheduleMobileViewportRecovery, setupMobileViewportHeightSync, setupChatAreaMetricsSync, isAbortError, isCurrentChatOpenTransition, isUiTransitionBusy,
        isMobileViewportLayoutLocked, syncChatAreaMetricsFromViewport, flushDeferredRecoverySync, setChatHydrating, revealChatHydration, beginMobileRouteTransition, endMobileRouteTransition, isChatSearchOpen,
        focusChatSearchInput, setChatSearchOpen, setChatFolderManageStatus, chatFolderIconEmoji, chatFolderEmojiMarkup, chatFolderIconMarkup, normalizeChatFolderId, shouldShowActiveChatFolderBar,
        activeChatFolderStripRows, getRenderedChatFolderSelectionId, isChatFolderStripVisibleInAllChatsEnabled, syncChatFolderPickerAllChatsToggleState, applyChatFolderStripVisibilityInAllChats, saveChatFolderStripVisibilityInAllChats, shouldShowChatFolderBarForSelection, chatFolderStripStructureSignature,
        chatFolderStripLabelForSelection, setPendingChatFolderChipCenterBehavior, cancelScheduledActiveChatFolderChipCenter, centerActiveChatFolderChip, scheduleActiveChatFolderChipCenter, renderChatFolderStripStructure, syncActiveChatFolderStripState, renderActiveChatFolderBar,
        beginChatFolderStripPreview, finalizeChatFolderStripPreview, getChatFolderSwitchTargets, resetChatFolderSwitchAnimations, destroyChatFolderSwipePager, resetChatFolderSwipeSurface, waitForAnimationFrames, waitForMs,
        playChatFolderSwitchPhase, canAnimateChatFolderContent, animateChatFolderContentEntry, getChatFolderPageRows, getChatFolderPageIndex, getAdjacentChatFolderPage, getChatFolderSwipeSurfaceWidth, getChatFolderSwipeCommitDistance,
        canAnimateChatFolderSwipe, getChatFolderSwipeTransformTarget, createChatFolderSwipePage, prepareChatFolderSwipePager, setChatFolderSwipeOffset, settleChatFolderSwipeOffset, snapChatFolderSwipeBack, transitionToChatFolderBySwipe,
        transitionToChatFolder, setActiveChatFolder, loadChatFolders, setAvatarElementVisual, renderCurrentChatHeader, refreshChatInfoPresentation, syncChatInfoStatusVisibility, refreshRenderedUserMessages,
        applyChatUpdate, applyCurrentUserUpdateFromPresence, patchChatMembersCacheForPresence, patchMentionTargetsForPresence, patchAiBotUserForPresence, refreshMentionPickerForUserUpdate, applyUserUpdate, weatherLocationLabel,
        weatherIcon, formatWeatherValue, renderWeatherWidget, setWeatherStatus, renderWeatherSettingsForm, renderWeatherSearchResults, scheduleWeatherRefresh, loadWeatherSettings,
        loadCurrentWeather, searchWeatherLocations, saveWeatherSettings, isLocalhost, isPushSupported, setNotificationStatus, notificationPermissionLabel, renderNotificationSettingsForm,
        loadNotificationSettings, saveNotificationSettings, enablePushNotifications, disablePushOnThisDevice, testPushNotification, refreshPushDeviceState, applySoundSettings, setSoundStatus,
        renderSoundSettingsForm, getSoundSettingsFromForm, loadSoundSettings, saveSoundSettings, scheduleSoundSettingsSave, playAppSound, previewSound, previewAllSounds,
        getChatById, isChatPinned, getActiveChatFolder, isAllChatsFolderActive, getFolderPinnedChatOrder, isChatPinnedInFolder, compareChatsForFolder, folderSummaryText,
        sortChatsInPlace, getPinnedChats, getPinnedChatMoveState, isNotesChat, isDocumentChat, isCurrentNotesChat, isChatNotificationEnabled, isChatIncomingSoundEnabled, isPinNotificationEnabled,
        isPinSoundEnabled, isMentionSoundEnabled, isMessageMentioningCurrentUser, setChatPreferencesStatus, renderChatPreferencesForm, loadChatPreferences, saveChatPreferences, chatAllowsUnpinAnyPin,
        canManagePinSettings, isGeneralChat, isGroupOrPrivateChat, canHideChat, canLeaveChat, canManageDestructiveChat, isInviteCapableGroupChat, canManageInviteLink,
        setChatInviteLinkStatus, renderChatInviteLinkForm, copyCurrentChatInviteLink, refreshCurrentChatInviteLink, joinChatInviteToken, setChatPinSettingsStatus, renderChatPinSettingsForm,
        canManageContextTransformSettings, setChatContextTransformStatus, renderChatContextTransformForm, saveChatContextTransformSetting, setChatDangerStatus, renderChatDangerControls, saveChatPinSettings, normalizePin,
        normalizePins, getPinPreviewText, getPinActorName, getPinToastText, buildPinBrowserNotification, getChatPins, getPinForMessage, canUnpinPin,
        getPinActionState, renderPinActionButton, applyPinsUpdate, handlePinnedMessageUpdate, loadChatPins, renderPinnedBar, jumpToPinnedMessage, pinMessage,
        unpinPin, togglePinFromRow, refreshVisiblePinButtons, resolveUiTarget, getPayloadChatId, handleServiceWorkerMessage, chatItemAvatarHtml, loadHiddenChatSearch,
        scheduleHiddenChatSearch, openHiddenChatFromSearch, openPrivateChatFromDirectory, showCenterToast, suppressNextChatItemTap, getFolderPinnedChatMoveState, renderFolderSelectableChatItem, totalUnreadForFolder,
        visibleChatCountForFolder, renderChatFolderPicker, positionChatFolderPicker, hideChatFolderContextMenu, renderChatFolderContextMenu, positionChatFolderContextMenu, refreshChatFolderContextMenu, showChatFolderContextMenu,
        hideChatFolderPicker, showChatFolderPicker, createChatFolder, renameChatFolder, deleteChatFolder, setChatFolderOrder, moveChatFolder, addChatsToFolder,
        removeChatFromFolder, setFolderChatPin, moveFolderChatPin, handleChatFolderContextMenuAction, resetChatFolderManageModal, renderChatFolderManageModal, openChatFolderManageModal, saveChatFolderManageChanges,
        setChatSidebarPin, moveChatSidebarPin, clearCachedChat, resetChatPreviewAfterHistoryClear, revealChatListAfterActiveChatClose, closeChatViewForChat, removeChatLocally, clearLocalChatHistory,
        hideChatFromList, leaveChat, deleteChatCompletely, clearChatHistoryForEveryone, copyTextToClipboard, modalEntryOf, rememberActiveElement, focusElementIfPossible,
        blurFocusedElementWithin, parseTransitionTimeMs, getElementTransitionTotalMs, registerModal, handleGrokImageRiskModalClosed, ensureDeepseekTextBotsModalContent, ensureQwenTextBotsModalContent, registerBuiltinModals,
        getTopModal, hasOpenModal, openModal, closeModal, closeTopModal, closeAllModals, loadMentionTargets, suppressMentionPickerFollowupClick,
        suppressContextConvertPickerFollowupClick, clearContextConvertPickerFollowupClickSuppress, ensureMentionPickerBackdrop, ensureMentionPicker, isComposerMeaningfullyEmpty, getManualMentionRange, syncMentionOpenButton, hideMentionPicker,
        findMentionTrigger, positionMentionPicker, renderMentionPicker, openMentionPickerFromButton, updateMentionPicker, insertMentionTarget, insertMentionTokenIntoComposer, insertRawMentionTriggerAtCursor,
        openPrivateChatWithUser, handleMentionPickerKeydown, handleMentionClick, isGroupLikeCurrentChat, ensureAvatarUserMenu, hideAvatarUserMenu, positionAvatarUserMenu, avatarMenuTargetFromEl,
        openAvatarUserMenu, singleEmojiPattern,
      };
    }
  }

  shellRoot.uiRuntimeAdapter = { createUiRuntimeAdapter };
})();
