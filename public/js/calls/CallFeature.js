(function () {
  'use strict';

  const hooks = window.BananzaCallHooks = window.BananzaCallHooks || {};
  const VIDEO_ICON = String.fromCodePoint(0x1F4F9);
  const PHONE_ICON = String.fromCodePoint(0x260E);
  const STORE = window.BananzaCallStore || {};
  const MEDIA = window.BananzaCallMedia || {};
  const NOTIFICATIONS = window.BananzaCallNotifications || {};

  const state = {
    ready: false,
    uiReady: false,
    settings: STORE.defaultSettings?.() || {
      calls_enabled: false,
      livekit_ready: false,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
      screen_share_enabled: true,
      ringtone_enabled: true,
      call_messages_enabled: true,
      max_call_participants: 20,
    },
    activeCalls: new Map(),
    incomingCall: null,
    pendingJoinCall: null,
    currentCall: null,
    room: null,
    livekitLoadPromise: null,
    joining: false,
    micEnabled: true,
    cameraEnabled: true,
    screenShareEnabled: false,
    minimized: false,
    participantsOpen: false,
    selectedDevices: STORE.loadDevicePrefs?.() || { audioinput: '', videoinput: '', audiooutput: '' },
    devices: [],
    previewStream: null,
    prejoinMicEnabled: true,
    prejoinCameraEnabled: true,
    prejoinMode: 'join',
    adminLoaded: false,
    adminSettings: null,
    disconnectingIntentionally: false,
    leaveSentForCallId: 0,
    debugLines: [],
    publishingLocalTracks: false,
    publishRetryTimer: 0,
    publishRetryCount: 0,
    localMediaOptions: null,
  };

  function bridge() {
    return window.BananzaAppBridge || null;
  }

  function t(key, params = {}) {
    return bridge()?.t?.(key, params) || window.BananzaI18n?.t?.(key, params) || String(key || '');
  }

  function applyLocalized(root) {
    bridge()?.applyLocalizedDom?.(root);
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  function addCallDebug(message, detail = '') {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const line = detail ? `${time} ${message}: ${detail}` : `${time} ${message}`;
    state.debugLines = [...state.debugLines.slice(-10), line];
    renderCallDebug();
  }

  function api(url, opts) {
    const call = bridge()?.api;
    if (!call) return Promise.reject(new Error(t('App is not ready')));
    return call(url, opts);
  }

  function authHeaders() {
    const token = bridge()?.getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function currentChat() {
    return bridge()?.getCurrentChat?.() || null;
  }

  function currentChatId() {
    return Number(bridge()?.getCurrentChatId?.() || 0);
  }

  function currentUser() {
    return bridge()?.getCurrentUser?.() || null;
  }

  function initials(name) {
    const clean = String(name || '?').trim();
    return clean.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '?';
  }

  function safeAvatarColor(value) {
    const color = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#65aadd';
  }

  function avatarMarkup(user, className) {
    const name = user?.display_name || user?.name || user?.username || t('Participant');
    const color = safeAvatarColor(user?.avatar_color);
    const url = String(user?.avatar_url || '').trim();
    const title = escapeHtml(name);
    if (url) {
      return `<span class="${className}" style="background:${escapeHtml(color)}" title="${title}"><img class="avatar-img" src="${escapeHtml(url)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
    }
    return `<span class="${className}" style="background:${escapeHtml(color)}" title="${title}">${escapeHtml(initials(name))}</span>`;
  }

  function userIdFromIdentity(identity) {
    const text = String(identity || '').trim();
    const match = text.match(/(?:^|:)user:(\d+)$/i) || text.match(/^(\d+)$/);
    return match ? Number(match[1]) : 0;
  }

  function callParticipantForRoomParticipant(participant, local = false) {
    if (local) return { ...(currentUser() || {}), ...(state.currentCall?.participants || []).find((item) => Number(item.user_id) === Number(currentUser()?.id || 0)) };
    const userId = userIdFromIdentity(participant?.identity);
    if (userId) {
      const byId = (state.currentCall?.participants || []).find((item) => Number(item.user_id) === userId);
      if (byId) return byId;
    }
    const name = String(participant?.name || participant?.identity || '').trim();
    return (state.currentCall?.participants || []).find((item) => [item.display_name, item.username].some((value) => String(value || '').trim() === name)) || null;
  }

  function formatDuration(ms) {
    return STORE.formatDuration?.(ms) || '0:00';
  }

  function mergePublicSettings(settings = {}) {
    state.settings = {
      ...state.settings,
      ...settings,
      calls_enabled: Boolean(settings.calls_enabled),
      livekit_ready: Boolean(settings.livekit_ready),
      screen_share_enabled: settings.screen_share_enabled !== false,
      ringtone_enabled: settings.ringtone_enabled !== false,
      call_messages_enabled: settings.call_messages_enabled !== false,
      max_call_participants: Number(settings.max_call_participants || state.settings.max_call_participants || 20),
    };
  }

  function isCallableChat(chat = currentChat()) {
    if (!chat || !state.settings.calls_enabled || !state.settings.livekit_ready) return false;
    if (chat.is_notes || Number(chat.is_notes || 0) !== 0) return false;
    if (chat.type === 'private') {
      if (!state.settings.allow_private_calls) return false;
      if (Number(chat.private_user?.is_ai_bot || 0) !== 0) return false;
      return true;
    }
    if (chat.type === 'group') return Boolean(state.settings.allow_group_calls);
    return false;
  }

  function upsertCall(call) {
    if (!call?.id || !call.chat_id) return;
    if (call.status === 'active') state.activeCalls.set(Number(call.chat_id), call);
    else state.activeCalls.delete(Number(call.chat_id));
  }

  function removeCall(call) {
    if (call?.chat_id) state.activeCalls.delete(Number(call.chat_id));
    if (state.incomingCall?.id === call?.id) {
      state.incomingCall = null;
      NOTIFICATIONS.stopRingtone?.();
    }
    if (state.currentCall?.id === call?.id) state.currentCall = { ...state.currentCall, ...call, status: 'ended' };
  }

  async function closeEndedCall(call) {
    const isCurrentCall = Boolean(call?.id && state.currentCall?.id === call.id);
    const isPendingJoinCall = Boolean(call?.id && state.pendingJoinCall?.id === call.id);
    removeCall(call);
    if (isPendingJoinCall) {
      state.pendingJoinCall = null;
      state.prejoinMode = 'join';
      document.getElementById('callPrejoin')?.classList.add('hidden');
      document.getElementById('callSurface')?.classList.remove('is-behind-prejoin');
    }
    if (isCurrentCall) {
      await disconnectRoom({ intentional: true });
      state.currentCall = null;
      state.minimized = false;
      state.participantsOpen = false;
      document.getElementById('callSurface')?.classList.add('hidden');
    }
    renderAll();
  }

  function notifyChatCallIndicatorsChanged() {
    bridge()?.refreshCallIndicators?.();
  }

  function ensureUi() {
    if (state.uiReady) return;

    const chatInfoBtn = document.getElementById('chatInfoBtn');
    if (chatInfoBtn && !document.getElementById('callStartBtn')) {
      const btn = document.createElement('button');
      btn.id = 'callStartBtn';
      btn.className = 'icon-btn chat-header-action-btn call-header-btn hidden';
      btn.type = 'button';
      btn.title = t('Start video call');
      btn.setAttribute('aria-label', t('Start video call'));
      btn.textContent = VIDEO_ICON;
      chatInfoBtn.insertAdjacentElement('beforebegin', btn);
      btn.addEventListener('click', () => startCall().catch((error) => setPrejoinStatus(error.message || t('Could not start call'), 'error')));
      applyLocalized(btn);
    }

    const pinnedBar = document.getElementById('pinnedBar');
    if (pinnedBar && !document.getElementById('callBanner')) {
      const banner = document.createElement('div');
      banner.id = 'callBanner';
      banner.className = 'call-banner hidden';
      banner.innerHTML = `
        <div class="call-banner-main">
          <span aria-hidden="true">${PHONE_ICON}</span>
          <span id="callBannerTitle">${escapeHtml(t('Call in progress'))}</span>
          <span id="callBannerMeta" class="call-banner-meta"></span>
        </div>
        <div class="call-banner-actions">
          <button type="button" id="callBannerJoin" class="call-action-btn primary">${escapeHtml(t('Join call'))}</button>
        </div>
      `;
      pinnedBar.insertAdjacentElement('beforebegin', banner);
      document.getElementById('callBannerJoin')?.addEventListener('click', () => {
        const call = state.activeCalls.get(currentChatId());
        if (call) openPrejoin(call).catch((error) => setPrejoinStatus(error.message || t('Could not join call'), 'error'));
      });
      applyLocalized(banner);
    }

    if (!document.getElementById('callIncoming')) {
      const incoming = document.createElement('div');
      incoming.id = 'callIncoming';
      incoming.className = 'call-incoming hidden';
      incoming.innerHTML = `
        <div class="call-incoming-card">
          <div class="call-incoming-title" id="callIncomingTitle">${escapeHtml(t('Incoming call'))}</div>
          <div class="call-incoming-meta" id="callIncomingMeta"></div>
          <div class="call-inline-actions">
            <button type="button" id="callAcceptBtn" class="call-action-btn primary">${escapeHtml(t('Accept'))}</button>
            <button type="button" id="callDeclineBtn" class="call-action-btn danger">${escapeHtml(t('Decline'))}</button>
          </div>
        </div>
      `;
      document.body.appendChild(incoming);
      document.getElementById('callAcceptBtn')?.addEventListener('click', () => {
        if (state.incomingCall) openPrejoin(state.incomingCall).catch((error) => setPrejoinStatus(error.message || t('Could not join call'), 'error'));
      });
      document.getElementById('callDeclineBtn')?.addEventListener('click', () => {
        if (state.incomingCall) declineCall(state.incomingCall).catch(() => {});
      });
      applyLocalized(incoming);
    }

    if (!document.getElementById('callPrejoin')) {
      const prejoin = document.createElement('div');
      prejoin.id = 'callPrejoin';
      prejoin.className = 'call-prejoin hidden';
      prejoin.innerHTML = `
        <div class="call-prejoin-card">
          <div class="call-prejoin-preview">
            <video id="callPrejoinVideo" autoplay muted playsinline></video>
            <div id="callPrejoinAvatar" class="call-prejoin-avatar hidden"></div>
          </div>
          <div class="call-prejoin-panel">
            <div class="call-prejoin-title" id="callPrejoinTitle">${escapeHtml(t('Ready to join?'))}</div>
            <div class="call-prejoin-meta" id="callPrejoinMeta"></div>
            <div class="call-prejoin-toggles">
              <button type="button" id="callPrejoinMicBtn" class="call-control-btn call-icon-toggle call-icon-mic" aria-label="${escapeHtml(t('Mic'))}" title="${escapeHtml(t('Mic'))}" aria-pressed="true">
                <span class="call-icon" aria-hidden="true"></span>
              </button>
              <button type="button" id="callPrejoinCameraBtn" class="call-control-btn call-icon-toggle call-icon-camera" aria-label="${escapeHtml(t('Camera'))}" title="${escapeHtml(t('Camera'))}" aria-pressed="true">
                <span class="call-icon" aria-hidden="true"></span>
              </button>
            </div>
            <div class="call-device-list">
              <label>${escapeHtml(t('Microphone'))}<select id="callMicSelect" class="call-device-select"></select></label>
              <label>${escapeHtml(t('Camera'))}<select id="callCameraSelect" class="call-device-select"></select></label>
              <label>${escapeHtml(t('Speaker'))}<select id="callSpeakerSelect" class="call-device-select"></select></label>
            </div>
            <div id="callPrejoinStatus" class="call-prejoin-status"></div>
            <div class="call-inline-actions">
              <button type="button" id="callPrejoinJoinBtn" class="call-action-btn primary">${escapeHtml(t('Join'))}</button>
              <button type="button" id="callPrejoinCancelBtn" class="call-action-btn">${escapeHtml(t('Cancel'))}</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(prejoin);
      document.getElementById('callPrejoinJoinBtn')?.addEventListener('click', () => {
        if (!state.pendingJoinCall) return;
        if (state.prejoinMode === 'devices') {
          applyPrejoinDevicesToRoom().catch((error) => setPrejoinStatus(error.message || t('Could not apply devices'), 'error'));
          return;
        }
        joinCall(state.pendingJoinCall).catch((error) => setPrejoinStatus(error.message || t('Could not join call'), 'error'));
      });
      document.getElementById('callPrejoinCancelBtn')?.addEventListener('click', closePrejoin);
      document.getElementById('callPrejoinMicBtn')?.addEventListener('click', () => togglePrejoinMic().catch(() => {}));
      document.getElementById('callPrejoinCameraBtn')?.addEventListener('click', () => togglePrejoinCamera().catch(() => {}));
      ['callMicSelect', 'callCameraSelect', 'callSpeakerSelect'].forEach((id) => {
        document.getElementById(id)?.addEventListener('change', () => handleDeviceSelection(id).catch(() => {}));
      });
      applyLocalized(prejoin);
    }

    if (!document.getElementById('callSurface')) {
      const surface = document.createElement('div');
      surface.id = 'callSurface';
      surface.className = 'call-surface hidden';
      surface.innerHTML = `
        <div class="call-surface-card">
          <div class="call-surface-head">
            <div>
              <div class="call-surface-title" id="callSurfaceTitle">${escapeHtml(t('Video call'))}</div>
              <div class="call-surface-status" id="callSurfaceStatus"></div>
              <div class="call-debug-log" id="callDebugLog"></div>
            </div>
            <div class="call-inline-actions">
              <button type="button" id="callParticipantsBtn" class="call-control-btn call-tool-btn call-icon-users" title="${escapeHtml(t('Participants'))}" aria-label="${escapeHtml(t('Participants'))}" aria-pressed="false">
                <span class="call-icon" aria-hidden="true"></span>
                <span class="call-control-label">${escapeHtml(t('Participants'))}</span>
              </button>
              <button type="button" id="callMinimizeBtn" class="call-control-btn call-window-btn call-icon-pip" title="${escapeHtml(t('Minimize'))}" aria-label="${escapeHtml(t('Minimize'))}" aria-pressed="false">
                <span class="call-icon" aria-hidden="true"></span>
              </button>
            </div>
          </div>
          <div class="call-room-layout">
            <div id="callGrid" class="call-grid"></div>
            <aside id="callParticipantsPanel" class="call-participants-panel hidden"></aside>
          </div>
          <div class="call-controls">
            <button type="button" id="callMicBtn" class="call-control-btn call-icon-toggle call-icon-mic" aria-label="${escapeHtml(t('Mic'))}" title="${escapeHtml(t('Mic'))}" aria-pressed="true">
              <span class="call-icon" aria-hidden="true"></span>
            </button>
            <button type="button" id="callCameraBtn" class="call-control-btn call-icon-toggle call-icon-camera" aria-label="${escapeHtml(t('Camera'))}" title="${escapeHtml(t('Camera'))}" aria-pressed="true">
              <span class="call-icon" aria-hidden="true"></span>
            </button>
            <button type="button" id="callDeviceBtn" class="call-control-btn call-tool-btn call-icon-devices" title="${escapeHtml(t('Devices'))}" aria-label="${escapeHtml(t('Devices'))}">
              <span class="call-icon" aria-hidden="true"></span>
              <span class="call-control-label">${escapeHtml(t('Devices'))}</span>
            </button>
            <button type="button" id="callScreenBtn" class="call-control-btn call-tool-btn call-icon-screen" title="${escapeHtml(t('Share screen'))}" aria-label="${escapeHtml(t('Share screen'))}" aria-pressed="false">
              <span class="call-icon" aria-hidden="true"></span>
              <span class="call-control-label">${escapeHtml(t('Share screen'))}</span>
            </button>
            <button type="button" id="callLeaveBtn" class="call-control-btn call-tool-btn call-icon-phone-off danger" title="${escapeHtml(t('Leave'))}" aria-label="${escapeHtml(t('Leave'))}">
              <span class="call-icon" aria-hidden="true"></span>
              <span class="call-control-label">${escapeHtml(t('Leave'))}</span>
            </button>
            <button type="button" id="callEndBtn" class="call-control-btn call-tool-btn call-icon-end danger" title="${escapeHtml(t('End for everyone'))}" aria-label="${escapeHtml(t('End for everyone'))}">
              <span class="call-icon" aria-hidden="true"></span>
              <span class="call-control-label">${escapeHtml(t('End for everyone'))}</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(surface);
      document.getElementById('callMinimizeBtn')?.addEventListener('click', toggleMinimized);
      document.getElementById('callParticipantsBtn')?.addEventListener('click', toggleParticipantsPanel);
      document.getElementById('callMicBtn')?.addEventListener('click', toggleMic);
      document.getElementById('callCameraBtn')?.addEventListener('click', toggleCamera);
      document.getElementById('callDeviceBtn')?.addEventListener('click', () => openPrejoin(state.currentCall, { keepIncoming: true, mode: 'devices' }).catch(() => {}));
      document.getElementById('callScreenBtn')?.addEventListener('click', toggleScreenShare);
      document.getElementById('callLeaveBtn')?.addEventListener('click', () => leaveCall(false).catch(() => {}));
      document.getElementById('callEndBtn')?.addEventListener('click', () => leaveCall(true).catch(() => {}));
      applyLocalized(surface);
    }

    ensureAdminUi();
    state.uiReady = true;
  }

  function ensureAdminUi() {
    const settingsAdminPanel = document.getElementById('settingsAdminPanel');
    if (settingsAdminPanel && !document.getElementById('settingsCallPanel')) {
      const btn = document.createElement('button');
      btn.id = 'settingsCallPanel';
      btn.className = 'settings-item hidden';
      btn.textContent = `${VIDEO_ICON} ${t('Calls')}`;
      settingsAdminPanel.insertAdjacentElement('afterend', btn);
      btn.addEventListener('click', openCallAdminModal);
      applyLocalized(btn);
    }

    if (!document.getElementById('callAdminModal')) {
      const modal = document.createElement('div');
      modal.id = 'callAdminModal';
      modal.className = 'modal hidden';
      modal.innerHTML = `
        <div class="modal-content call-admin-modal">
          <div class="modal-header">
            <h3>${escapeHtml(t('Calls'))}</h3>
            <button type="button" class="modal-close" id="callAdminClose" aria-label="${escapeHtml(t('Close'))}">x</button>
          </div>
          <div class="modal-body">
            <div id="callLiveKitState" class="call-admin-status"></div>
            <div class="call-admin-section">
              <div class="call-admin-subtitle">${escapeHtml(t('LiveKit settings'))}</div>
              <div class="field-group">
                <label>${escapeHtml(t('LiveKit WebSocket URL'))}</label>
                <input type="url" id="callLiveKitWsUrl" class="modal-input" placeholder="wss://project.livekit.cloud" autocomplete="off">
              </div>
              <div class="field-group">
                <label>${escapeHtml(t('LiveKit API key'))}</label>
                <input type="password" id="callLiveKitApiKey" class="modal-input" placeholder="${escapeHtml(t('Paste LiveKit API key'))}" autocomplete="new-password">
              </div>
              <div class="field-group">
                <label>${escapeHtml(t('LiveKit API secret'))}</label>
                <input type="password" id="callLiveKitApiSecret" class="modal-input" placeholder="${escapeHtml(t('Paste LiveKit API secret'))}" autocomplete="new-password">
              </div>
              <div id="callLiveKitHint" class="call-admin-hint"></div>
            </div>
            <div class="settings-item settings-toggle-item">
              <span>${escapeHtml(t('Enable calls'))}</span>
              <label class="toggle-switch">
                <input type="checkbox" id="callEnabledToggle">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="settings-item settings-toggle-item">
              <span>${escapeHtml(t('Allow private calls'))}</span>
              <label class="toggle-switch">
                <input type="checkbox" id="callPrivateToggle">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="settings-item settings-toggle-item">
              <span>${escapeHtml(t('Allow group calls'))}</span>
              <label class="toggle-switch">
                <input type="checkbox" id="callGroupToggle">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="settings-item settings-toggle-item">
              <span>${escapeHtml(t('Screen sharing'))}</span>
              <label class="toggle-switch">
                <input type="checkbox" id="callScreenShareToggle">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="settings-item settings-toggle-item">
              <span>${escapeHtml(t('Ringtone'))}</span>
              <label class="toggle-switch">
                <input type="checkbox" id="callRingtoneToggle">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="settings-item settings-toggle-item">
              <span>${escapeHtml(t('Call messages in chat'))}</span>
              <label class="toggle-switch">
                <input type="checkbox" id="callMessagesToggle">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="field-group">
              <label>${escapeHtml(t('Ring timeout, ms'))}</label>
              <input type="number" id="callRingTimeoutMs" class="modal-input" min="10000" max="300000" step="1000">
            </div>
            <div class="field-group">
              <label>${escapeHtml(t('Max call participants'))}</label>
              <input type="number" id="callMaxParticipants" class="modal-input" min="2" max="100" step="1">
            </div>
            <div class="call-admin-actions">
              <button type="button" id="callTestBtn" class="call-admin-btn">${escapeHtml(t('Test LiveKit'))}</button>
              <button type="button" id="callSaveBtn" class="call-admin-btn primary">${escapeHtml(t('Save'))}</button>
            </div>
            <div id="callAdminStatus" class="call-admin-status hidden"></div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('callAdminClose')?.addEventListener('click', () => bridge()?.closeManagedModal?.('callAdminModal'));
      document.getElementById('callSaveBtn')?.addEventListener('click', saveAdminSettings);
      document.getElementById('callTestBtn')?.addEventListener('click', testLiveKit);
      applyLocalized(modal);
    }
    bridge()?.registerManagedModal?.('callAdminModal');
  }

  function renderHeaderButton() {
    const btn = document.getElementById('callStartBtn');
    if (!btn) return;
    const call = state.activeCalls.get(currentChatId());
    btn.classList.toggle('hidden', !isCallableChat() || Boolean(call));
  }

  function renderBanner() {
    const banner = document.getElementById('callBanner');
    const title = document.getElementById('callBannerTitle');
    const meta = document.getElementById('callBannerMeta');
    if (!banner || !title || !meta) return;
    const call = state.activeCalls.get(currentChatId());
    banner.classList.toggle('hidden', !call || !state.settings.calls_enabled);
    if (!call) return;
    title.textContent = t('Call in progress');
    const count = Number(call.participant_count || 0);
    meta.textContent = count > 0 ? t('{count} in call', { count }) : t('Waiting');
  }

  function renderIncoming() {
    const wrap = document.getElementById('callIncoming');
    if (!wrap) return;
    const call = state.incomingCall;
    wrap.classList.toggle('hidden', !call || !state.settings.calls_enabled);
    if (!call) return;
    document.getElementById('callIncomingTitle').textContent = t('Incoming call');
    document.getElementById('callIncomingMeta').textContent = call.chat_name
      ? t('{name} is calling in {chat}', { name: call.started_by_name || t('Someone'), chat: call.chat_name })
      : t('{name} is calling', { name: call.started_by_name || t('Someone') });
  }

  function renderAll() {
    ensureUi();
    renderHeaderButton();
    renderBanner();
    renderIncoming();
    renderSurface();
    renderAdminEntry();
    notifyChatCallIndicatorsChanged();
  }

  function renderAdminEntry() {
    const btn = document.getElementById('settingsCallPanel');
    if (!btn) return;
    btn.classList.toggle('hidden', !currentUser()?.is_admin);
  }

  async function refreshPublicFeatures() {
    const data = await api('/api/features');
    mergePublicSettings(data);
    if (!state.settings.calls_enabled) {
      state.activeCalls.clear();
      state.incomingCall = null;
      NOTIFICATIONS.stopRingtone?.();
      if (state.room) await disconnectRoom({ intentional: true });
    }
    renderAll();
    return state.settings;
  }

  async function loadActiveCalls() {
    const data = await api('/api/calls/active');
    if (data.settings) {
      mergePublicSettings(data.settings);
    }
    state.activeCalls.clear();
    (data.calls || []).forEach(upsertCall);
    renderAll();
  }

  async function syncCurrentChatCall() {
    const chatId = currentChatId();
    if (!chatId || !state.settings.calls_enabled) {
      renderAll();
      return;
    }
    try {
      const data = await api(`/api/chats/${chatId}/calls/active`);
      if (data.call) upsertCall(data.call);
      else state.activeCalls.delete(chatId);
    } catch {}
    renderAll();
  }

  async function startCall() {
    const chatId = currentChatId();
    if (!chatId || !isCallableChat()) return;
    setSurfaceStatus(t('Starting call...'));
    const data = await api(`/api/chats/${chatId}/calls`, { method: 'POST', body: {} });
    if (data.call) {
      upsertCall(data.call);
      renderAll();
      await openPrejoin(data.call);
    }
  }

  function setPrejoinStatus(message, type = '') {
    const el = document.getElementById('callPrejoinStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('error', type === 'error');
    el.classList.toggle('success', type === 'success');
  }

  function setPrejoinBusy(busy) {
    const joinBtn = document.getElementById('callPrejoinJoinBtn');
    const cancelBtn = document.getElementById('callPrejoinCancelBtn');
    if (joinBtn) {
      joinBtn.disabled = Boolean(busy);
      joinBtn.classList.toggle('is-busy', Boolean(busy));
    }
    if (cancelBtn) cancelBtn.disabled = Boolean(busy);
  }

  function selectedDevice(kind) {
    return String(state.selectedDevices?.[kind] || '');
  }

  function fillDeviceSelect(id, kind, label) {
    const select = document.getElementById(id);
    if (!select) return;
    const devices = state.devices.filter((device) => device.kind === kind);
    const current = selectedDevice(kind);
    select.replaceChildren();
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = t('Default {device}', { device: label });
    select.appendChild(defaultOption);
    devices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId || '';
      option.textContent = device.label || `${label} ${index + 1}`;
      select.appendChild(option);
    });
    select.value = devices.some((device) => device.deviceId === current) ? current : '';
  }

  async function populateDeviceSelects() {
    state.devices = await (MEDIA.enumerateDevices?.() || Promise.resolve([]));
    fillDeviceSelect('callMicSelect', 'audioinput', t('Microphone'));
    fillDeviceSelect('callCameraSelect', 'videoinput', t('Camera'));
    fillDeviceSelect('callSpeakerSelect', 'audiooutput', t('Speaker'));
  }

  function setIconToggleState(button, enabled, onLabel, offLabel) {
    if (!button) return;
    const label = enabled ? onLabel : offLabel;
    if (!button.querySelector('.call-icon')) {
      button.textContent = '';
      const icon = document.createElement('span');
      icon.className = 'call-icon';
      icon.setAttribute('aria-hidden', 'true');
      button.appendChild(icon);
    }
    button.classList.toggle('is-off', !enabled);
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }

  function renderMinimizeButton() {
    const button = document.getElementById('callMinimizeBtn');
    if (!button) return;
    const minimized = Boolean(state.minimized);
    const label = minimized ? t('Restore call') : t('Minimize');
    if (!button.querySelector('.call-icon')) {
      button.textContent = '';
      const icon = document.createElement('span');
      icon.className = 'call-icon';
      icon.setAttribute('aria-hidden', 'true');
      button.appendChild(icon);
    }
    button.classList.toggle('call-icon-pip', !minimized);
    button.classList.toggle('call-icon-expand', minimized);
    button.setAttribute('title', label);
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', minimized ? 'true' : 'false');
  }

  function setToolButtonLabel(button, label) {
    if (!button) return;
    let icon = button.querySelector('.call-icon');
    let text = button.querySelector('.call-control-label');
    if (!icon) {
      icon = document.createElement('span');
      icon.className = 'call-icon';
      icon.setAttribute('aria-hidden', 'true');
      button.prepend(icon);
    }
    if (!text) {
      text = document.createElement('span');
      text.className = 'call-control-label';
      button.appendChild(text);
    }
    text.textContent = label;
    button.setAttribute('title', label);
    button.setAttribute('aria-label', label);
  }

  function renderPrejoinControls() {
    const mic = document.getElementById('callPrejoinMicBtn');
    const camera = document.getElementById('callPrejoinCameraBtn');
    const avatar = document.getElementById('callPrejoinAvatar');
    const video = document.getElementById('callPrejoinVideo');
    setIconToggleState(mic, state.prejoinMicEnabled, t('Mic'), t('Mic off'));
    setIconToggleState(camera, state.prejoinCameraEnabled, t('Camera'), t('Camera off'));
    if (avatar) {
      const name = currentUser()?.display_name || t('You');
      avatar.textContent = initials(name);
      avatar.classList.toggle('hidden', state.prejoinCameraEnabled && Boolean(state.previewStream));
    }
    if (video) video.classList.toggle('hidden', !state.prejoinCameraEnabled || !state.previewStream);
  }

  async function refreshPreview() {
    MEDIA.stopStream?.(state.previewStream);
    state.previewStream = null;
    MEDIA.attachPreview?.(document.getElementById('callPrejoinVideo'), null);
    renderPrejoinControls();
    if (!state.prejoinMicEnabled && !state.prejoinCameraEnabled) {
      setPrejoinStatus(t('Mic and camera are off'));
      return;
    }
    try {
      setPrejoinStatus(t('Checking devices...'));
      state.previewStream = await MEDIA.getPreviewStream?.({
        audioEnabled: state.prejoinMicEnabled,
        videoEnabled: state.prejoinCameraEnabled,
        audioDeviceId: selectedDevice('audioinput'),
        videoDeviceId: selectedDevice('videoinput'),
      });
      MEDIA.attachPreview?.(document.getElementById('callPrejoinVideo'), state.previewStream);
      await populateDeviceSelects();
      setPrejoinStatus(t('Devices ready'), 'success');
    } catch (error) {
      const message = error?.code === 'media_unsupported'
        ? t('Media devices are not supported')
        : (error?.message || t('Camera or microphone unavailable'));
      setPrejoinStatus(message, 'error');
    } finally {
      renderPrejoinControls();
    }
  }

  async function openPrejoin(call, options = {}) {
    if (!call?.id) return;
    ensureUi();
    state.pendingJoinCall = call;
    state.prejoinMode = options.mode || 'join';
    if (!options.keepIncoming) {
      state.incomingCall = null;
      NOTIFICATIONS.stopRingtone?.();
    }
    const wrap = document.getElementById('callPrejoin');
    document.getElementById('callSurface')?.classList.add('is-behind-prejoin');
    const title = document.getElementById('callPrejoinTitle');
    const meta = document.getElementById('callPrejoinMeta');
    if (title) title.textContent = call.chat_name || t('Video call');
    if (meta) meta.textContent = state.prejoinMode === 'devices'
      ? t('Change devices for this call')
      : t('Choose devices before joining');
    const joinBtn = document.getElementById('callPrejoinJoinBtn');
    if (joinBtn) joinBtn.textContent = state.prejoinMode === 'devices' ? t('Apply') : t('Join');
    setPrejoinBusy(false);
    wrap?.classList.remove('hidden');
    await populateDeviceSelects();
    await refreshPreview();
    renderAll();
  }

  function closePrejoin() {
    MEDIA.stopStream?.(state.previewStream);
    state.previewStream = null;
    state.pendingJoinCall = null;
    state.prejoinMode = 'join';
    setPrejoinBusy(false);
    document.getElementById('callPrejoin')?.classList.add('hidden');
    document.getElementById('callSurface')?.classList.remove('is-behind-prejoin');
    renderPrejoinControls();
  }

  async function applyPrejoinDevicesToRoom() {
    if (!state.room?.localParticipant) {
      closePrejoin();
      return;
    }
    state.micEnabled = state.prejoinMicEnabled;
    state.cameraEnabled = state.prejoinCameraEnabled;
    await state.room.localParticipant.setMicrophoneEnabled?.(
      state.micEnabled,
      selectedDevice('audioinput') ? { deviceId: selectedDevice('audioinput') } : undefined
    ).catch(() => {
      state.micEnabled = false;
    });
    await state.room.localParticipant.setCameraEnabled?.(
      state.cameraEnabled,
      selectedDevice('videoinput') ? { deviceId: selectedDevice('videoinput') } : undefined
    ).catch(() => {
      state.cameraEnabled = false;
    });
    applySpeakerDevice();
    closePrejoin();
    renderSurfaceControls();
    renderRoomTiles();
  }

  async function togglePrejoinMic() {
    state.prejoinMicEnabled = !state.prejoinMicEnabled;
    renderPrejoinControls();
    await refreshPreview();
  }

  async function togglePrejoinCamera() {
    state.prejoinCameraEnabled = !state.prejoinCameraEnabled;
    renderPrejoinControls();
    await refreshPreview();
  }

  async function handleDeviceSelection(id) {
    const patch = {};
    if (id === 'callMicSelect') patch.audioinput = document.getElementById(id)?.value || '';
    if (id === 'callCameraSelect') patch.videoinput = document.getElementById(id)?.value || '';
    if (id === 'callSpeakerSelect') patch.audiooutput = document.getElementById(id)?.value || '';
    state.selectedDevices = STORE.saveDevicePrefs?.(patch) || { ...state.selectedDevices, ...patch };
    if (id !== 'callSpeakerSelect') await refreshPreview();
    applySpeakerDevice();
  }

  async function declineCall(call) {
    if (!call?.id) return;
    await api(`/api/calls/${call.id}/decline`, { method: 'POST', body: {} }).catch(() => {});
    if (state.incomingCall?.id === call.id) state.incomingCall = null;
    NOTIFICATIONS.stopRingtone?.();
    renderAll();
  }

  async function joinCall(call) {
    if (!call?.id || state.joining) return;
    state.joining = true;
    let handoffPreviewStream = null;
    state.incomingCall = null;
    NOTIFICATIONS.stopRingtone?.();
    setPrejoinBusy(true);
    setPrejoinStatus(t('Joining call...'));
    showSurface(call);
    setSurfaceStatus(t('Joining call...'));
    try {
      const data = await api(`/api/calls/${call.id}/token`, { method: 'POST', body: {} });
      const nextCall = data.call || call;
      upsertCall(nextCall);
      state.currentCall = nextCall;
      const publishStream = state.previewStream;
      handoffPreviewStream = publishStream;
      state.previewStream = null;
      MEDIA.attachPreview?.(document.getElementById('callPrejoinVideo'), null);
      closePrejoin();
      showSurface(nextCall);
      setSurfaceStatus(t('Connecting...'));
      await connectRoom(data.livekit?.url, data.livekit?.token, {
        micEnabled: state.prejoinMicEnabled,
        cameraEnabled: state.prejoinCameraEnabled,
        audioDeviceId: selectedDevice('audioinput'),
        videoDeviceId: selectedDevice('videoinput'),
        previewStream: publishStream,
      });
      const joined = await api(`/api/calls/${call.id}/joined`, { method: 'POST', body: {} }).catch(() => null);
      if (joined?.call) {
        upsertCall(joined.call);
        state.currentCall = joined.call;
      }
      setSurfaceStatus(t('Connected'));
    } catch (error) {
      MEDIA.stopStream?.(handoffPreviewStream);
      await notifyLeaveCurrentCall({ fireAndForget: false }).catch(() => {});
      await disconnectRoom({ intentional: true });
      state.currentCall = null;
      document.getElementById('callSurface')?.classList.add('hidden');
      state.pendingJoinCall = call;
      state.prejoinMode = 'join';
      document.getElementById('callPrejoin')?.classList.remove('hidden');
      document.getElementById('callSurface')?.classList.add('is-behind-prejoin');
      throw error;
    } finally {
      setPrejoinBusy(false);
      state.joining = false;
      renderAll();
    }
  }

  function showSurface(call) {
    state.currentCall = call || state.currentCall;
    state.minimized = false;
    const surface = document.getElementById('callSurface');
    if (surface) {
      surface.classList.remove('hidden', 'is-minimized');
    }
    renderSurface();
  }

  function setSurfaceStatus(message) {
    const el = document.getElementById('callSurfaceStatus');
    if (el) el.textContent = message || '';
  }

  async function connectRoom(url, token, options = {}) {
    if (!url || !token) throw new Error(t('LiveKit token is missing'));
    const LK = await ensureLiveKitClient();
    await disconnectRoom({ intentional: true });
    const room = new LK.Room({ adaptiveStream: true, dynacast: true });
    state.room = room;
    addCallDebug('connectRoom', url);
    const events = LK.RoomEvent || {};
    room.on?.(events.TrackSubscribed || 'trackSubscribed', (track) => {
      addCallDebug('remote track subscribed', `${track?.kind || track?.mediaStreamTrack?.kind || 'unknown'} ${track?.source || ''}`.trim());
      attachSubscribedTrack(track);
      renderRoomTiles();
    });
    room.on?.(events.TrackUnsubscribed || 'trackUnsubscribed', (track) => {
      addCallDebug('remote track unsubscribed', `${track?.kind || track?.mediaStreamTrack?.kind || 'unknown'} ${track?.source || ''}`.trim());
      detachTrack(track);
      renderRoomTiles();
    });
    room.on?.(events.ParticipantConnected || 'participantConnected', (participant) => {
      addCallDebug('participant connected', participant?.identity || '');
      renderRoomTiles();
    });
    room.on?.(events.ParticipantDisconnected || 'participantDisconnected', (participant) => {
      addCallDebug('participant disconnected', participant?.identity || '');
      renderRoomTiles();
    });
    room.on?.(events.LocalTrackPublished || 'localTrackPublished', (publication) => {
      addCallDebug('local track published', `${publication?.kind || publication?.track?.kind || 'unknown'} ${publication?.source || publication?.track?.source || ''}`.trim());
      renderRoomTiles();
    });
    room.on?.(events.LocalTrackUnpublished || 'localTrackUnpublished', (publication) => {
      addCallDebug('local track unpublished', `${publication?.kind || publication?.track?.kind || 'unknown'} ${publication?.source || publication?.track?.source || ''}`.trim());
      renderRoomTiles();
    });
    room.on?.(events.Reconnecting || 'reconnecting', () => {
      addCallDebug('room reconnecting');
      setSurfaceStatus(t('Reconnecting...'));
    });
    room.on?.(events.Reconnected || 'reconnected', () => {
      addCallDebug('room reconnected');
      setSurfaceStatus(t('Connected'));
      scheduleLocalMediaRetry(250);
    });
    room.on?.(events.Disconnected || 'disconnected', () => {
      state.room = null;
      addCallDebug('room disconnected');
      if (!state.disconnectingIntentionally && state.currentCall?.id) {
        notifyLeaveCurrentCall({ fireAndForget: true }).catch(() => {});
      }
      setSurfaceStatus(t('Disconnected'));
      renderRoomTiles();
    });
    await room.connect(url, token);
    addCallDebug('room connected');
    state.leaveSentForCallId = 0;
    state.micEnabled = options.micEnabled !== false;
    state.cameraEnabled = options.cameraEnabled !== false;
    state.localMediaOptions = {
      audioDeviceId: options.audioDeviceId || '',
      videoDeviceId: options.videoDeviceId || '',
    };
    state.publishRetryCount = 0;
    MEDIA.stopStream?.(options.previewStream);
    const enabled = await enableLocalMedia('initial');
    addCallDebug('local media result', `audio=${enabled.audio} video=${enabled.video}`);
    applySpeakerDevice();
    renderSurfaceControls();
    renderRoomTiles();
    renderCallDebug();
    if ((state.micEnabled && !hasLocalAudioPublication(room)) || (state.cameraEnabled && !hasLocalVideoPublication(room))) {
      scheduleLocalMediaRetry(1500);
    }
  }

  async function enableLocalMedia(reason = 'retry') {
    const result = { audio: false, video: false };
    const room = state.room;
    const options = state.localMediaOptions || {};
    if (state.publishingLocalTracks || !room?.localParticipant) return result;
    state.publishingLocalTracks = true;
    addCallDebug('enable local media', reason);
    try {
      if (state.micEnabled) {
        if (hasLocalAudioPublication(room)) {
          result.audio = true;
        } else {
          await room.localParticipant.setMicrophoneEnabled?.(
            true,
            options.audioDeviceId ? { deviceId: options.audioDeviceId } : undefined
          ).then(() => {
            result.audio = true;
            addCallDebug('microphone enabled');
          }).catch((error) => {
            const message = error?.message || String(error || '');
            addCallDebug('microphone enable failed', message);
            setSurfaceStatus(`${t('Microphone unavailable')}: ${message}`.trim());
          });
        }
      } else {
        await room.localParticipant.setMicrophoneEnabled?.(false).catch(() => {});
      }
      if (state.cameraEnabled) {
        if (hasLocalVideoPublication(room)) {
          result.video = true;
        } else {
          await room.localParticipant.setCameraEnabled?.(
            true,
            options.videoDeviceId ? { deviceId: options.videoDeviceId } : undefined
          ).then(() => {
            result.video = true;
            addCallDebug('camera enabled');
          }).catch((error) => {
            const message = error?.message || String(error || '');
            addCallDebug('camera enable failed', message);
            setSurfaceStatus(`${t('Camera unavailable')}: ${message}`.trim());
          });
        }
      } else {
        await room.localParticipant.setCameraEnabled?.(false).catch(() => {});
      }
    } finally {
      state.publishingLocalTracks = false;
    }
    return {
      audio: result.audio || hasLocalAudioPublication(room),
      video: result.video || hasLocalVideoPublication(room),
    };
  }

  function hasLocalAudioPublication(room = state.room) {
    return Number(room?.localParticipant?.audioTrackPublications?.size || 0) > 0;
  }

  function hasLocalVideoPublication(room = state.room) {
    return Number(room?.localParticipant?.videoTrackPublications?.size || 0) > 0;
  }

  function scheduleLocalMediaRetry(delay = 1500) {
    if (!state.room?.localParticipant || state.publishRetryTimer) return;
    if (state.publishRetryCount >= 8) {
      addCallDebug('media retry stopped', 'too many attempts');
      return;
    }
    state.publishRetryTimer = window.setTimeout(async () => {
      state.publishRetryTimer = 0;
      if (!state.room) return;
      state.publishRetryCount += 1;
      addCallDebug('media retry', String(state.publishRetryCount));
      const enabled = await enableLocalMedia(`retry ${state.publishRetryCount}`);
      addCallDebug('retry result', `audio=${enabled.audio} video=${enabled.video}`);
      renderSurfaceControls();
      renderRoomTiles();
      renderCallDebug();
      if ((state.micEnabled && !hasLocalAudioPublication()) || (state.cameraEnabled && !hasLocalVideoPublication())) {
        scheduleLocalMediaRetry(2000);
      }
    }, delay);
  }

  function ensureLiveKitClient() {
    if (window.LivekitClient?.Room) return Promise.resolve(window.LivekitClient);
    if (state.livekitLoadPromise) return state.livekitLoadPromise;
    state.livekitLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/livekit-client.umd.js';
      script.async = true;
      script.onload = () => {
        if (window.LivekitClient?.Room) {
          resolve(window.LivekitClient);
        } else {
          reject(new Error(t('LiveKit client is not loaded')));
        }
      };
      script.onerror = () => reject(new Error(t('LiveKit client is not loaded')));
      document.head.appendChild(script);
    });
    return state.livekitLoadPromise;
  }

  function attachSubscribedTrack(track) {
    const LK = window.LivekitClient || {};
    const kind = track?.kind || track?.mediaStreamTrack?.kind;
    if (kind === 'audio' || track?.source === LK.Track?.Source?.Microphone) {
      const audio = track.attach?.();
      if (audio) {
        audio.autoplay = true;
        audio.dataset.callRemoteAudio = '1';
        audio.style.display = 'none';
        document.body.appendChild(audio);
        applySpeakerDevice(audio);
      }
    }
  }

  function detachTrack(track) {
    try {
      track?.detach?.().forEach((el) => el.remove());
    } catch {}
    document.querySelectorAll('[data-call-remote-audio="1"]').forEach((el) => el.remove());
  }

  async function disconnectRoom(options = {}) {
    const room = state.room;
    state.room = null;
    state.screenShareEnabled = false;
    if (state.publishRetryTimer) window.clearTimeout(state.publishRetryTimer);
    state.publishRetryTimer = 0;
    state.publishingLocalTracks = false;
    state.localMediaOptions = null;
    const previousIntent = state.disconnectingIntentionally;
    state.disconnectingIntentionally = Boolean(options.intentional);
    try {
      room?.disconnect?.();
    } catch {}
    window.setTimeout(() => {
      state.disconnectingIntentionally = previousIntent;
    }, 0);
    document.querySelectorAll('[data-call-remote-audio="1"]').forEach((el) => el.remove());
  }

  async function notifyLeaveCurrentCall(options = {}) {
    const callId = Number(state.currentCall?.id || 0);
    if (!callId || state.leaveSentForCallId === callId) return;
    state.leaveSentForCallId = callId;
    const url = `/api/calls/${callId}/leave`;
    if (options.fireAndForget) {
      try {
        window.fetch?.(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: '{}',
          keepalive: true,
        }).catch(() => {});
      } catch {}
      return;
    }
    await api(url, { method: 'POST', body: {} }).catch(() => {});
  }

  function applySpeakerDevice(targetAudio = null) {
    const sinkId = selectedDevice('audiooutput');
    const audios = targetAudio ? [targetAudio] : Array.from(document.querySelectorAll('[data-call-remote-audio="1"]'));
    audios.forEach((audio) => {
      if (!audio?.setSinkId || !sinkId) return;
      audio.setSinkId(sinkId).catch(() => {});
    });
  }

  async function toggleMic() {
    state.micEnabled = !state.micEnabled;
    await state.room?.localParticipant?.setMicrophoneEnabled?.(
      state.micEnabled,
      selectedDevice('audioinput') ? { deviceId: selectedDevice('audioinput') } : undefined
    ).catch(() => {
      state.micEnabled = !state.micEnabled;
    });
    renderSurfaceControls();
  }

  async function toggleCamera() {
    state.cameraEnabled = !state.cameraEnabled;
    await state.room?.localParticipant?.setCameraEnabled?.(
      state.cameraEnabled,
      selectedDevice('videoinput') ? { deviceId: selectedDevice('videoinput') } : undefined
    ).catch(() => {
      state.cameraEnabled = !state.cameraEnabled;
    });
    renderSurfaceControls();
    renderRoomTiles();
  }

  async function toggleScreenShare() {
    if (!state.settings.screen_share_enabled || !MEDIA.isScreenShareSupported?.()) return;
    state.screenShareEnabled = !state.screenShareEnabled;
    await state.room?.localParticipant?.setScreenShareEnabled?.(state.screenShareEnabled).catch(() => {
      state.screenShareEnabled = !state.screenShareEnabled;
    });
    renderSurfaceControls();
    renderRoomTiles();
  }

  function toggleMinimized() {
    state.minimized = !state.minimized;
    const surface = document.getElementById('callSurface');
    surface?.classList.toggle('is-minimized', state.minimized);
    renderMinimizeButton();
  }

  function toggleParticipantsPanel() {
    state.participantsOpen = !state.participantsOpen;
    renderParticipantsPanel();
    renderSurfaceControls();
  }

  async function leaveCall(endForEveryone) {
    const call = state.currentCall;
    state.leaveSentForCallId = 0;
    await disconnectRoom({ intentional: true });
    if (call?.id) {
      await api(`/api/calls/${call.id}/${endForEveryone ? 'end' : 'leave'}`, { method: 'POST', body: {} }).catch(() => {});
      state.leaveSentForCallId = call.id;
    }
    state.currentCall = null;
    document.getElementById('callSurface')?.classList.add('hidden');
    await loadActiveCalls().catch(() => {});
  }

  function getParticipantName(participant, fallback) {
    return participant?.name || participant?.identity || fallback || t('Participant');
  }

  function firstVideoTrack(participant) {
    const publications = participant?.videoTrackPublications || participant?.trackPublications;
    if (!publications?.values) return null;
    for (const publication of publications.values()) {
      const track = publication?.track;
      const kind = track?.kind || track?.mediaStreamTrack?.kind;
      if (track && kind !== 'audio') return track;
    }
    return null;
  }

  function renderRoomTiles() {
    const grid = document.getElementById('callGrid');
    if (!grid) return;
    grid.replaceChildren();
    const room = state.room;
    const participants = [];
    if (room?.localParticipant) participants.push({ participant: room.localParticipant, local: true });
    if (room?.remoteParticipants?.values) {
      for (const participant of room.remoteParticipants.values()) participants.push({ participant, local: false });
    }
    if (!participants.length) {
      const empty = document.createElement('div');
      empty.className = 'call-tile';
      empty.innerHTML = `${avatarMarkup(currentUser(), 'call-tile-placeholder')}<div class="call-tile-name">${escapeHtml(t('Waiting'))}</div>`;
      grid.appendChild(empty);
      renderParticipantsPanel();
      return;
    }
    participants.forEach(({ participant, local }) => {
      const tile = document.createElement('div');
      tile.className = 'call-tile';
      const meta = callParticipantForRoomParticipant(participant, local);
      const name = meta?.display_name || meta?.username || getParticipantName(participant, local ? t('You') : t('Participant'));
      const track = firstVideoTrack(participant);
      if (track?.attach) {
        try {
          const video = track.attach();
          video.autoplay = true;
          video.playsInline = true;
          video.muted = Boolean(local);
          tile.appendChild(video);
        } catch {
          tile.innerHTML = avatarMarkup({ ...meta, display_name: name }, 'call-tile-placeholder');
        }
      } else {
        tile.innerHTML = avatarMarkup({ ...meta, display_name: name }, 'call-tile-placeholder');
      }
      const label = document.createElement('div');
      label.className = 'call-tile-name';
      label.textContent = local ? `${name} (${t('you')})` : name;
      tile.appendChild(label);
      grid.appendChild(tile);
    });
    renderParticipantsPanel();
  }

  function participantStateText(stateName) {
    const map = {
      invited: t('Invited'),
      joined: t('Joined'),
      declined: t('Declined'),
      left: t('Left'),
      missed: t('Missed'),
    };
    return map[stateName] || stateName || '';
  }

  function renderParticipantsPanel() {
    const panel = document.getElementById('callParticipantsPanel');
    if (!panel) return;
    panel.classList.toggle('hidden', !state.participantsOpen);
    if (!state.participantsOpen) return;
    const participants = state.currentCall?.participants || [];
    panel.innerHTML = `
      <div class="call-participants-title">${escapeHtml(t('Participants'))}</div>
      <div class="call-participants-list">
        ${participants.map((participant) => `
          <div class="call-participant-row">
            ${avatarMarkup(participant, 'call-participant-avatar')}
            <span class="call-participant-main">
              <strong>${escapeHtml(participant.display_name || participant.username || t('Participant'))}</strong>
              <small>${escapeHtml(participantStateText(participant.state))}</small>
            </span>
          </div>
        `).join('') || `<div class="call-participants-empty">${escapeHtml(t('Waiting'))}</div>`}
      </div>
    `;
  }

  function renderSurface() {
    const surface = document.getElementById('callSurface');
    if (!surface || !state.currentCall) return;
    surface.classList.toggle('is-minimized', state.minimized);
    document.getElementById('callSurfaceTitle').textContent = state.currentCall.chat_name || t('Video call');
    renderMinimizeButton();
    renderSurfaceControls();
    renderRoomTiles();
    renderParticipantsPanel();
    renderCallDebug();
  }

  function renderCallDebug() {
    const el = document.getElementById('callDebugLog');
    if (!el) return;
    const room = state.room;
    const local = room?.localParticipant;
    const audioCount = local?.audioTrackPublications?.size ?? 0;
    const videoCount = local?.videoTrackPublications?.size ?? 0;
    const summary = room
      ? `local audio=${audioCount} video=${videoCount}`
      : 'room=null';
    el.textContent = [summary, ...state.debugLines].join('\n');
  }

  function renderSurfaceControls() {
    const mic = document.getElementById('callMicBtn');
    const camera = document.getElementById('callCameraBtn');
    const participants = document.getElementById('callParticipantsBtn');
    const devices = document.getElementById('callDeviceBtn');
    const screen = document.getElementById('callScreenBtn');
    const leave = document.getElementById('callLeaveBtn');
    const end = document.getElementById('callEndBtn');
    setIconToggleState(mic, state.micEnabled, t('Mic'), t('Mic off'));
    setIconToggleState(camera, state.cameraEnabled, t('Camera'), t('Camera off'));
    setToolButtonLabel(participants, t('Participants'));
    participants?.classList.toggle('is-active', state.participantsOpen);
    participants?.setAttribute('aria-pressed', state.participantsOpen ? 'true' : 'false');
    setToolButtonLabel(devices, t('Devices'));
    setToolButtonLabel(leave, t('Leave'));
    setToolButtonLabel(end, t('End for everyone'));
    if (screen) {
      const supported = Boolean(state.settings.screen_share_enabled && MEDIA.isScreenShareSupported?.());
      screen.classList.toggle('hidden', !supported);
      setToolButtonLabel(screen, state.screenShareEnabled ? t('Stop sharing') : t('Share screen'));
      screen.classList.remove('is-off');
      screen.classList.toggle('is-active', state.screenShareEnabled);
      screen.setAttribute('aria-pressed', state.screenShareEnabled ? 'true' : 'false');
    }
  }

  async function openCallAdminModal() {
    bridge()?.openManagedModal?.('callAdminModal', { replaceStack: true });
    await loadAdminSettings().catch((error) => setAdminStatus(error.message || t('Could not load call settings'), 'error'));
  }

  async function loadAdminSettings() {
    const data = await api('/api/admin/call-settings');
    state.adminSettings = data.settings || {};
    state.adminLoaded = true;
    renderAdminSettings(data);
    return data;
  }

  function renderAdminSettings(data = {}) {
    const settings = state.adminSettings || {};
    const livekit = data.livekit_config || {};
    const livekitState = document.getElementById('callLiveKitState');
    if (livekitState) {
      livekitState.classList.toggle('success', Boolean(data.livekit_ready));
      livekitState.classList.toggle('error', !data.livekit_ready);
      livekitState.textContent = data.livekit_ready
        ? t('LiveKit is configured')
        : t('LiveKit is not configured');
    }
    const wsUrl = document.getElementById('callLiveKitWsUrl');
    if (wsUrl) wsUrl.value = livekit.ws_url || livekit.effective_ws_url || data.livekit_ws_url || '';
    const apiKey = document.getElementById('callLiveKitApiKey');
    if (apiKey) {
      apiKey.value = '';
      apiKey.placeholder = livekit.masked_api_key
        ? t('Saved: {value}', { value: livekit.masked_api_key })
        : t('Paste LiveKit API key');
    }
    const apiSecret = document.getElementById('callLiveKitApiSecret');
    if (apiSecret) {
      apiSecret.value = '';
      apiSecret.placeholder = livekit.masked_api_secret
        ? t('Saved: {value}', { value: livekit.masked_api_secret })
        : t('Paste LiveKit API secret');
    }
    const hint = document.getElementById('callLiveKitHint');
    if (hint) {
      const source = livekit.source || '';
      let sourceText = t('No LiveKit credentials saved');
      if (source === 'admin') sourceText = t('Saved in admin settings');
      else if (source === 'env') sourceText = t('Loaded from server env');
      else if (source === 'mixed') sourceText = t('Using admin settings and server env');
      hint.textContent = `${sourceText}. ${t('Leave key fields blank to keep current values')}`;
    }
    const fields = {
      callEnabledToggle: settings.calls_enabled,
      callPrivateToggle: settings.allow_private_calls,
      callGroupToggle: settings.allow_group_calls,
      callScreenShareToggle: settings.screen_share_enabled,
      callRingtoneToggle: settings.ringtone_enabled,
      callMessagesToggle: settings.call_messages_enabled,
    };
    Object.entries(fields).forEach(([id, checked]) => {
      const input = document.getElementById(id);
      if (input) input.checked = !!checked;
    });
    const ring = document.getElementById('callRingTimeoutMs');
    if (ring) ring.value = Number(settings.ring_timeout_ms || 60000);
    const max = document.getElementById('callMaxParticipants');
    if (max) max.value = Number(settings.max_call_participants || 20);
  }

  function adminPayload() {
    const payload = {
      calls_enabled: document.getElementById('callEnabledToggle')?.checked || false,
      allow_private_calls: document.getElementById('callPrivateToggle')?.checked !== false,
      allow_group_calls: document.getElementById('callGroupToggle')?.checked !== false,
      screen_share_enabled: document.getElementById('callScreenShareToggle')?.checked !== false,
      ringtone_enabled: document.getElementById('callRingtoneToggle')?.checked !== false,
      call_messages_enabled: document.getElementById('callMessagesToggle')?.checked !== false,
      ring_timeout_ms: Number(document.getElementById('callRingTimeoutMs')?.value || 60000),
      max_call_participants: Number(document.getElementById('callMaxParticipants')?.value || 20),
      livekit_ws_url: document.getElementById('callLiveKitWsUrl')?.value || '',
    };
    const apiKey = document.getElementById('callLiveKitApiKey')?.value?.trim();
    const apiSecret = document.getElementById('callLiveKitApiSecret')?.value?.trim();
    if (apiKey) payload.livekit_api_key = apiKey;
    if (apiSecret) payload.livekit_api_secret = apiSecret;
    return payload;
  }

  async function saveAdminSettings() {
    setAdminStatus(t('Saving...'));
    try {
      const data = await api('/api/admin/call-settings', { method: 'PUT', body: adminPayload() });
      state.adminSettings = data.settings || state.adminSettings;
      if (data.publicSettings) {
        mergePublicSettings(data.publicSettings);
      }
      renderAdminSettings(data);
      renderAll();
      setAdminStatus(t('Saved'), 'success');
    } catch (error) {
      setAdminStatus(error.message || t('Could not save call settings'), 'error');
    }
  }

  async function testLiveKit() {
    setAdminStatus(t('Testing...'));
    try {
      const data = await api('/api/admin/call-settings/test', { method: 'POST', body: {} });
      setAdminStatus(data.ok ? t('LiveKit test passed') : t('LiveKit test failed'), data.ok ? 'success' : 'error');
    } catch (error) {
      setAdminStatus(error.message || t('LiveKit test failed'), 'error');
    }
  }

  function setAdminStatus(message, type = '') {
    const el = document.getElementById('callAdminStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
    el.classList.toggle('success', type === 'success');
    el.classList.toggle('error', type === 'error');
  }

  hooks.handleWSMessage = (msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'call_settings_updated') {
      mergePublicSettings(msg.settings || {});
      if (!state.settings.calls_enabled) {
        state.incomingCall = null;
        state.activeCalls.clear();
        NOTIFICATIONS.stopRingtone?.();
        if (state.currentCall) leaveCall(false).catch(() => {});
      }
      renderAll();
      return;
    }
    if (msg.call) {
      if (msg.type === 'call_ended') {
        closeEndedCall(msg.call).catch(() => {
          removeCall(msg.call);
          renderAll();
        });
        return;
      }
      else upsertCall(msg.call);
    }
    if (msg.type === 'call_invite' && msg.call && Number(msg.call.started_by) !== Number(currentUser()?.id || 0)) {
      state.incomingCall = msg.call;
      NOTIFICATIONS.startRingtone?.(state.settings.ringtone_enabled);
      NOTIFICATIONS.notifyIncoming?.(
        t('Incoming call'),
        msg.call.chat_name
          ? t('{name} is calling in {chat}', { name: msg.call.started_by_name || t('Someone'), chat: msg.call.chat_name })
          : t('{name} is calling', { name: msg.call.started_by_name || t('Someone') })
      );
    }
    renderAll();
  };

  hooks.onSettingsOpened = ({ currentUser: user } = {}) => {
    ensureUi();
    document.getElementById('settingsCallPanel')?.classList.toggle('hidden', !user?.is_admin);
  };

  hooks.onChatChanged = () => {
    ensureUi();
    syncCurrentChatCall().catch(() => renderAll());
  };

  hooks.openPrejoin = (call) => openPrejoin(call);
  hooks.joinCallFromMessage = (call) => openPrejoin(call);
  hooks.getActiveCallForChat = (chatId) => state.activeCalls.get(Number(chatId || 0)) || null;
  hooks.getActiveCalls = () => Array.from(state.activeCalls.values()).map((call) => ({ ...call }));

  async function bootstrap() {
    ensureUi();
    await refreshPublicFeatures().catch(() => {});
    await loadActiveCalls().catch(() => {});
    state.ready = true;
    renderAll();
  }

  function handlePageLeaving() {
    if (!state.currentCall?.id) return;
    notifyLeaveCurrentCall({ fireAndForget: true }).catch(() => {});
  }

  window.addEventListener('pagehide', handlePageLeaving);
  window.addEventListener('beforeunload', handlePageLeaving);
  window.addEventListener('bananza:ready', bootstrap);
})();
