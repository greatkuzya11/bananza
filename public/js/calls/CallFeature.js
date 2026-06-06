(function () {
  'use strict';

  const hooks = window.BananzaCallHooks = window.BananzaCallHooks || {};
  const BANANA_ICON = String.fromCodePoint(0x1F34C);
  const VIDEO_ICON = String.fromCodePoint(0x1F4F9);
  const VOICE_CALL_ICON = String.fromCodePoint(0x260E, 0xFE0F);
  const PHONE_ICON = String.fromCodePoint(0x1F4DE);
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
      call_debug_enabled: false,
      call_ai_notes_enabled: false,
      max_call_participants: 20,
    },
    activeCalls: new Map(),
    voiceCallIds: new Set(),
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
    prejoinEnding: false,
    prejoinMicEnabled: true,
    prejoinCameraEnabled: true,
    prejoinMode: 'join',
    adminLoaded: false,
    adminSettings: null,
    adminArtifacts: [],
    adminArtifactBots: [],
    disconnectingIntentionally: false,
    leaveSentForCallId: 0,
    debugLines: [],
    publishingLocalTracks: false,
    publishRetryTimer: 0,
    publishRetryCount: 0,
    surfaceDurationTimer: 0,
    localMediaOptions: null,
    roomConnectionState: '',
    roomConnectedAt: 0,
    videoFillTiles: new Set(),
    videoCollapsedTiles: new Set(),
    subscriptionChangingTiles: new Set(),
    focusedVideoTileKey: '',
    speakingTileKeys: new Set(),
    lastTileTap: { key: '', at: 0 },
    aiNotesTrackNotified: new Set(),
    transcriptModal: { callId: 0, text: '', segments: [] },
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
    if (!state.settings.call_debug_enabled) return;
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

  function bananaTilePlaceholder(title = '') {
    return `<div class="call-tile-placeholder" aria-hidden="true" title="${escapeHtml(title)}">${BANANA_ICON}</div>`;
  }

  function userIdFromIdentity(identity) {
    const text = String(identity || '').trim();
    const match = text.match(/^user:(\d+)(?::|$)/i) || text.match(/^(\d+)$/);
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

  function parseCallTimeMs(value) {
    const text = String(value || '').trim();
    if (!text) return 0;
    const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text);
    const normalized = hasTimezone ? text : `${text.replace(' ', 'T')}Z`;
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function callStartedAtMs(call = state.currentCall) {
    const started = parseCallTimeMs(call?.started_at || call?.startedAt || '');
    return Number.isFinite(started) && started > 0 ? started : 0;
  }

  function clearSurfaceDuration() {
    if (state.surfaceDurationTimer) {
      window.clearInterval(state.surfaceDurationTimer);
      state.surfaceDurationTimer = 0;
    }
    const duration = document.getElementById('callSurfaceDuration');
    if (duration) {
      duration.textContent = '';
      duration.hidden = true;
    }
  }

  function updateSurfaceDuration() {
    const duration = document.getElementById('callSurfaceDuration');
    const surface = document.getElementById('callSurface');
    const started = callStartedAtMs();
    const visible = Boolean(surface && !surface.classList.contains('hidden'));
    const active = Boolean(state.currentCall?.id && state.currentCall?.status === 'active' && visible && started);
    if (!duration || !active) {
      if (duration) {
        duration.textContent = '';
        duration.hidden = true;
      }
      return false;
    }
    duration.textContent = formatDuration(Math.max(0, Date.now() - started));
    duration.hidden = false;
    return true;
  }

  function syncSurfaceDurationTimer() {
    const shouldRun = updateSurfaceDuration();
    if (shouldRun && !state.surfaceDurationTimer) {
      state.surfaceDurationTimer = window.setInterval(() => {
        if (!updateSurfaceDuration()) clearSurfaceDuration();
      }, 1000);
    } else if (!shouldRun && state.surfaceDurationTimer) {
      clearSurfaceDuration();
    }
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
      call_debug_enabled: settings.call_debug_enabled === true,
      call_ai_notes_enabled: settings.call_ai_notes_enabled === true,
      max_call_participants: Number(settings.max_call_participants || state.settings.max_call_participants || 20),
    };
    if (!state.settings.call_debug_enabled) state.debugLines = [];
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

  function callMediaKind(call = {}) {
    return String(call?.media_kind || call?.mediaKind || '').toLowerCase() === 'voice' ? 'voice' : 'video';
  }

  function callRoomMode(call = {}) {
    return String(call?.room_mode || call?.roomMode || '').toLowerCase() === 'room' ? 'room' : 'ringing';
  }

  function isVoiceCall(call = state.currentCall) {
    return callMediaKind(call) === 'voice';
  }

  function isVoiceRoom(call = state.currentCall) {
    return isVoiceCall(call) && callRoomMode(call) === 'room';
  }

  function isCurrentCall(call = {}) {
    return Boolean(call?.id && state.currentCall?.id && Number(call.id) === Number(state.currentCall.id));
  }

  function revealCurrentCallSurface() {
    if (!state.currentCall?.id) return null;
    state.minimized = false;
    document.getElementById('callPrejoin')?.classList.add('hidden');
    document.getElementById('callSurface')?.classList.remove('is-behind-prejoin');
    showSurface(state.currentCall);
    renderAll();
    if (state.room && state.roomConnectionState === 'connected') setSurfaceStatus(t('Connected'));
    return state.currentCall;
  }

  function callDisplayTitle(call = state.currentCall) {
    if (isVoiceRoom(call)) return t('Voice room');
    if (isVoiceCall(call)) return t('Voice call');
    return t('Video call');
  }

  function voiceStartLabel(chat = currentChat()) {
    return chat?.type === 'group' ? t('Start voice room') : t('Start voice call');
  }

  function normalizeClientCall(call = {}, options = {}) {
    if (!call?.id) return call;
    const id = Number(call.id || 0);
    const forceVoice = Boolean(options.forceVoice || state.voiceCallIds.has(id) || callMediaKind(call) === 'voice');
    const chat = currentChat();
    const mediaKind = forceVoice ? 'voice' : callMediaKind(call);
    const fallbackRoomMode = mediaKind === 'voice' && (chat?.type === 'group' || call.chat_type === 'group') ? 'room' : 'ringing';
    const roomMode = callRoomMode({ room_mode: call.room_mode || call.roomMode || options.roomMode || fallbackRoomMode });
    if (mediaKind === 'voice') state.voiceCallIds.add(id);
    return {
      ...call,
      media_kind: mediaKind,
      mediaKind,
      room_mode: roomMode,
      roomMode: roomMode,
    };
  }

  function upsertCall(call) {
    if (!call?.id || !call.chat_id) return;
    const normalized = normalizeClientCall(call);
    if (normalized.status === 'active') state.activeCalls.set(Number(normalized.chat_id), normalized);
    else {
      state.activeCalls.delete(Number(normalized.chat_id));
      state.voiceCallIds.delete(Number(normalized.id || 0));
    }
  }

  function removeCall(call) {
    if (call?.chat_id) state.activeCalls.delete(Number(call.chat_id));
    if (call?.id) state.voiceCallIds.delete(Number(call.id || 0));
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
      clearSurfaceDuration();
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

    const chatHeaderActions = document.getElementById('chatHeaderActions');
    const chatSettingsActionBtn = document.getElementById('chatSettingsActionBtn');
    const chatInfoBtn = document.getElementById('chatInfoBtn');
    const callButtonAnchor = chatSettingsActionBtn || chatInfoBtn;
    const insertHeaderButton = (btn) => {
      if (chatHeaderActions && chatSettingsActionBtn) chatSettingsActionBtn.insertAdjacentElement('beforebegin', btn);
      else callButtonAnchor.insertAdjacentElement('beforebegin', btn);
    };
    if (callButtonAnchor && !document.getElementById('callStartBtn')) {
      const btn = document.createElement('button');
      btn.id = 'callStartBtn';
      btn.className = 'icon-btn chat-header-action-btn call-header-btn hidden';
      btn.type = 'button';
      btn.title = t('Start video call');
      btn.setAttribute('aria-label', t('Start video call'));
      btn.textContent = VIDEO_ICON;
      insertHeaderButton(btn);
      btn.addEventListener('click', () => {
        bridge()?.closeChatHeaderActions?.();
        startCall('video').catch((error) => setPrejoinStatus(error.message || t('Could not start call'), 'error'));
      });
      applyLocalized(btn);
      bridge()?.syncChatHeaderActions?.();
    }
    if (callButtonAnchor && !document.getElementById('callVoiceStartBtn')) {
      const btn = document.createElement('button');
      btn.id = 'callVoiceStartBtn';
      btn.className = 'icon-btn chat-header-action-btn call-header-btn call-voice-header-btn hidden';
      btn.type = 'button';
      btn.title = voiceStartLabel();
      btn.setAttribute('aria-label', voiceStartLabel());
      btn.textContent = VOICE_CALL_ICON;
      insertHeaderButton(btn);
      btn.addEventListener('click', () => {
        bridge()?.closeChatHeaderActions?.();
        startCall('voice').catch((error) => setPrejoinStatus(error.message || t('Could not start call'), 'error'));
      });
      applyLocalized(btn);
      bridge()?.syncChatHeaderActions?.();
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
        if (!call) return;
        const action = isVoiceCall(call) ? joinVoiceCallDirectly(call) : openPrejoin(call);
        action.catch((error) => {
          setSurfaceStatus(error.message || t('Could not join call'));
          setPrejoinStatus(error.message || t('Could not join call'), 'error');
        });
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
        if (!state.incomingCall) return;
        const call = state.incomingCall;
        const action = isVoiceCall(call) ? joinVoiceCallDirectly(call) : openPrejoin(call);
        action.catch((error) => {
          setSurfaceStatus(error.message || t('Could not join call'));
          setPrejoinStatus(error.message || t('Could not join call'), 'error');
        });
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
              <label id="callMicSelectWrap">${escapeHtml(t('Microphone'))}<select id="callMicSelect" class="call-device-select"></select></label>
              <label id="callCameraSelectWrap">${escapeHtml(t('Camera'))}<select id="callCameraSelect" class="call-device-select"></select></label>
              <label id="callSpeakerSelectWrap">${escapeHtml(t('Speaker'))}<select id="callSpeakerSelect" class="call-device-select"></select></label>
            </div>
            <div id="callPrejoinStatus" class="call-prejoin-status"></div>
            <div class="call-inline-actions call-prejoin-actions">
              <button type="button" id="callPrejoinJoinBtn" class="call-action-btn primary">${escapeHtml(t('Join'))}</button>
              <button type="button" id="callPrejoinEndBtn" class="call-action-btn danger hidden">${escapeHtml(t('End'))}</button>
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
      document.getElementById('callPrejoinEndBtn')?.addEventListener('click', () => {
        endPendingPrejoinCall().catch((error) => setPrejoinStatus(error.message || t('Could not end call'), 'error'));
      });
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
              <div class="call-surface-title-row">
                <div class="call-surface-title" id="callSurfaceTitle">${escapeHtml(t('Video call'))}</div>
                <span class="call-surface-duration" id="callSurfaceDuration" hidden></span>
              </div>
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
            <button type="button" id="callAiNotesBtn" class="call-control-btn call-tool-btn call-icon-ai-badge" title="${escapeHtml(t('AI notes'))}" aria-label="${escapeHtml(t('AI notes'))}" aria-pressed="false">
              <span class="call-icon" aria-hidden="true"></span>
              <span class="call-control-label">${escapeHtml(t('AI notes'))}</span>
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
      document.getElementById('callAiNotesBtn')?.addEventListener('click', toggleAiNotes);
      document.getElementById('callLeaveBtn')?.addEventListener('click', () => leaveCall(false).catch(() => {}));
      document.getElementById('callEndBtn')?.addEventListener('click', () => leaveCall(true).catch(() => {}));
      applyLocalized(surface);
    }

    ensureAdminUi();
    ensureTranscriptUi();
    state.uiReady = true;
  }

  function ensureTranscriptUi() {
    if (document.getElementById('callTranscriptModal')) return;
    const modal = document.createElement('div');
    modal.id = 'callTranscriptModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content call-transcript-modal">
        <div class="modal-header">
          <h3>${escapeHtml(t('Call transcript'))}</h3>
          <button type="button" class="modal-close" id="callTranscriptClose" aria-label="${escapeHtml(t('Close'))}">x</button>
        </div>
        <div class="modal-body call-transcript-body">
          <div class="call-transcript-toolbar">
            <button type="button" id="callTranscriptCopy" class="call-admin-btn call-transcript-action">${escapeHtml(t('Copy'))}</button>
            <button type="button" id="callTranscriptRetranscribe" class="call-admin-btn call-transcript-action hidden">${escapeHtml(t('Re-transcribe'))}</button>
          </div>
          <div id="callTranscriptStatus" class="call-admin-status hidden"></div>
          <pre id="callTranscriptText" class="call-transcript-text"></pre>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('callTranscriptClose')?.addEventListener('click', () => bridge()?.closeManagedModal?.('callTranscriptModal'));
    document.getElementById('callTranscriptCopy')?.addEventListener('click', copyTranscriptText);
    document.getElementById('callTranscriptRetranscribe')?.addEventListener('click', retranscribeCurrentTranscript);
    bridge()?.registerManagedModal?.('callTranscriptModal');
    applyLocalized(modal);
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
            <div class="settings-item settings-toggle-item">
              <span>${escapeHtml(t('Call debug log'))}</span>
              <label class="toggle-switch">
                <input type="checkbox" id="callDebugToggle">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="settings-item settings-toggle-item">
              <span>${escapeHtml(t('AI notes'))}</span>
              <label class="toggle-switch">
                <input type="checkbox" id="callAiNotesToggle">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="field-group">
              <label>${escapeHtml(t('Recording path'))}</label>
              <input type="text" id="callRecordingPath" class="modal-input" placeholder="/opt/livekit-egress/recordings">
            </div>
            <div class="field-group">
              <label>${escapeHtml(t('Recording mode'))}</label>
              <select id="callRecordingMode" class="modal-input">
                <option value="mixed_participant">${escapeHtml(t('Mixed + per-user'))}</option>
                <option value="participant">${escapeHtml(t('Per-user tracks'))}</option>
                <option value="mixed">${escapeHtml(t('Mixed recording'))}</option>
              </select>
            </div>
            <div class="field-group">
              <label>${escapeHtml(t('Call transcription mode'))}</label>
              <select id="callTranscriptionMode" class="modal-input">
                <option value="manual">${escapeHtml(t('Manual transcription'))}</option>
                <option value="auto">${escapeHtml(t('Automatic transcription'))}</option>
              </select>
            </div>
            <div class="field-group">
              <label>${escapeHtml(t('Call transcription option'))}</label>
              <select id="callTranscriptionPreset" class="modal-input">
                <option value="voice:hybrid">${escapeHtml(t('Same as voice messages'))} / hybrid</option>
                <option value="vosk:hybrid">Vosk / hybrid</option>
                <option value="grok:hybrid">Grok / hybrid</option>
                <option value="openai:hybrid">OpenAI / hybrid</option>
                <option value="openai:openai_diarization">OpenAI diarization</option>
                <option value="voice:per_user">${escapeHtml(t('Same as voice messages'))} / ${escapeHtml(t('Per-user tracks'))}</option>
                <option value="voice:mixed">${escapeHtml(t('Same as voice messages'))} / ${escapeHtml(t('Mixed recording'))}</option>
              </select>
            </div>
            <div class="field-group">
              <label>${escapeHtml(t('Transcription max chunk, MB'))}</label>
              <input type="number" id="callTranscriptionMaxChunkMb" class="modal-input" min="1" max="100" step="1">
            </div>
            <div class="field-group">
              <label>${escapeHtml(t('Transcription chunk, minutes'))}</label>
              <input type="number" id="callTranscriptionChunkMinutes" class="modal-input" min="1" max="60" step="1">
            </div>
            <div class="field-group">
              <label>${escapeHtml(t('Ring timeout, ms'))}</label>
              <input type="number" id="callRingTimeoutMs" class="modal-input" min="10000" max="300000" step="1000">
            </div>
            <div class="field-group">
              <label>${escapeHtml(t('Max call participants'))}</label>
              <input type="number" id="callMaxParticipants" class="modal-input" min="2" max="100" step="1">
            </div>
            <div class="call-admin-section">
              <div class="call-admin-subtitle">${escapeHtml(t('Call AI Artifacts'))}</div>
              <div id="callArtifactSettings" class="call-artifact-settings"></div>
              <div class="call-admin-hint">${escapeHtml(t('Choose an existing AI bot for each call artifact. Convert bots are recommended for text artifacts.'))}</div>
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
    const voiceBtn = document.getElementById('callVoiceStartBtn');
    const call = state.activeCalls.get(currentChatId());
    const hidden = !isCallableChat() || Boolean(call);
    if (btn) {
      btn.classList.toggle('hidden', hidden);
      btn.title = t('Start video call');
      btn.setAttribute('aria-label', t('Start video call'));
    }
    if (voiceBtn) {
      voiceBtn.classList.toggle('hidden', hidden);
      const label = voiceStartLabel();
      voiceBtn.title = label;
      voiceBtn.setAttribute('aria-label', label);
    }
    bridge()?.syncChatHeaderActions?.();
  }

  function renderBanner() {
    const banner = document.getElementById('callBanner');
    const title = document.getElementById('callBannerTitle');
    const meta = document.getElementById('callBannerMeta');
    if (!banner || !title || !meta) return;
    const call = state.activeCalls.get(currentChatId());
    banner.classList.toggle('hidden', !call || !state.settings.calls_enabled);
    if (!call) return;
    title.textContent = isVoiceRoom(call)
      ? t('Voice room active')
      : (isVoiceCall(call) ? t('Voice call active') : t('Call in progress'));
    const count = Number(call.participant_count || 0);
    meta.textContent = count > 0
      ? (isVoiceRoom(call) ? t('{count} in voice room', { count }) : t('{count} in call', { count }))
      : t('Waiting');
    const join = document.getElementById('callBannerJoin');
    if (join) {
      const alreadyInside = Boolean(isCurrentCall(call) && state.room);
      join.textContent = alreadyInside ? t('Open') : (isVoiceRoom(call) ? t('Join voice room') : t('Join call'));
      join.disabled = Boolean(state.joining && !alreadyInside);
    }
  }

  function renderIncoming() {
    const wrap = document.getElementById('callIncoming');
    if (!wrap) return;
    const call = state.incomingCall;
    wrap.classList.toggle('hidden', !call || !state.settings.calls_enabled);
    if (!call) return;
    document.getElementById('callIncomingTitle').textContent = isVoiceCall(call) ? t('Incoming voice call') : t('Incoming call');
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

  async function startCall(mediaKind = 'video') {
    const chatId = currentChatId();
    if (!chatId || !isCallableChat()) return;
    setSurfaceStatus(t('Starting call...'));
    const kind = mediaKind === 'voice' ? 'voice' : 'video';
    const data = await api(`/api/chats/${chatId}/calls`, { method: 'POST', body: { media_kind: kind } });
    if (data.call) {
      const nextCall = normalizeClientCall(data.call, {
        forceVoice: kind === 'voice',
        roomMode: kind === 'voice' && currentChat()?.type === 'group' ? 'room' : 'ringing',
      });
      upsertCall(nextCall);
      renderAll();
      if (kind === 'voice') await joinVoiceCallDirectly(nextCall);
      else await openPrejoin(nextCall);
    }
  }

  async function joinVoiceCallDirectly(call) {
    if (!call?.id) return;
    ensureUi();
    if (isCurrentCall(call) && state.room) return revealCurrentCallSurface();
    state.pendingJoinCall = normalizeClientCall(call, {
      forceVoice: true,
      roomMode: call.room_mode || call.roomMode || (currentChat()?.type === 'group' ? 'room' : 'ringing'),
    });
    state.prejoinMode = 'join';
    state.prejoinMicEnabled = true;
    state.prejoinCameraEnabled = false;
    MEDIA.stopStream?.(state.previewStream);
    state.previewStream = null;
    MEDIA.attachPreview?.(document.getElementById('callPrejoinVideo'), null);
    document.getElementById('callPrejoin')?.classList.add('hidden');
    document.getElementById('callPrejoin')?.classList.remove('is-voice-call');
    document.getElementById('callSurface')?.classList.remove('is-behind-prejoin');
    await joinCall(state.pendingJoinCall);
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
    const endBtn = document.getElementById('callPrejoinEndBtn');
    if (joinBtn) {
      joinBtn.disabled = Boolean(busy);
      joinBtn.classList.toggle('is-busy', Boolean(busy));
    }
    if (cancelBtn) cancelBtn.disabled = Boolean(busy);
    if (endBtn) {
      endBtn.disabled = Boolean(busy || state.prejoinEnding);
      endBtn.classList.toggle('is-busy', Boolean(state.prejoinEnding));
    }
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

  function callStarterId(call = {}) {
    return Number(call.started_by || call.startedBy || call.started_by_user_id || call.startedByUserId || 0);
  }

  function canEndPendingPrejoinCall(call = state.pendingJoinCall) {
    return Boolean(
      call?.id
      && state.prejoinMode === 'join'
      && Number(currentUser()?.id || 0) === callStarterId(call)
    );
  }

  function renderPrejoinControls() {
    const mic = document.getElementById('callPrejoinMicBtn');
    const camera = document.getElementById('callPrejoinCameraBtn');
    const cameraWrap = document.getElementById('callCameraSelectWrap');
    const avatar = document.getElementById('callPrejoinAvatar');
    const video = document.getElementById('callPrejoinVideo');
    const endBtn = document.getElementById('callPrejoinEndBtn');
    const voiceMode = isVoiceCall(state.pendingJoinCall);
    setIconToggleState(mic, state.prejoinMicEnabled, t('Mic'), t('Mic off'));
    setIconToggleState(camera, state.prejoinCameraEnabled, t('Camera'), t('Camera off'));
    camera?.classList.toggle('hidden', voiceMode);
    cameraWrap?.classList.toggle('hidden', voiceMode);
    if (endBtn) {
      const canEnd = canEndPendingPrejoinCall();
      endBtn.classList.toggle('hidden', !canEnd);
      endBtn.disabled = Boolean(state.joining || state.prejoinEnding);
      endBtn.textContent = t('End');
      endBtn.closest('.call-prejoin-actions')?.classList.toggle('has-end-call', canEnd);
    }
    if (avatar) {
      const name = currentUser()?.display_name || t('You');
      avatar.textContent = initials(name);
      avatar.classList.toggle('hidden', voiceMode || (state.prejoinCameraEnabled && Boolean(state.previewStream)));
    }
    if (video) video.classList.toggle('hidden', voiceMode || !state.prejoinCameraEnabled || !state.previewStream);
  }

  function streamHasTrack(stream, kind) {
    const getter = kind === 'audio' ? 'getAudioTracks' : 'getVideoTracks';
    try {
      const tracks = stream?.[getter]?.() || Array.from(stream?.getTracks?.() || []).filter((track) => track?.kind === kind);
      return Array.from(tracks || []).some((track) => track?.readyState !== 'ended');
    } catch {
      return false;
    }
  }

  async function refreshPreview() {
    const voiceMode = isVoiceCall(state.pendingJoinCall);
    MEDIA.stopStream?.(state.previewStream);
    state.previewStream = null;
    MEDIA.attachPreview?.(document.getElementById('callPrejoinVideo'), null);
    renderPrejoinControls();
    if (!state.prejoinMicEnabled && (voiceMode || !state.prejoinCameraEnabled)) {
      setPrejoinStatus(voiceMode ? t('Mic is off') : t('Mic and camera are off'));
      return;
    }
    try {
      setPrejoinStatus(t('Checking devices...'));
      const previewOptions = {
        audioEnabled: state.prejoinMicEnabled,
        videoEnabled: !voiceMode && state.prejoinCameraEnabled,
        audioDeviceId: selectedDevice('audioinput'),
        videoDeviceId: voiceMode ? '' : selectedDevice('videoinput'),
      };
      const media = MEDIA.getPreviewMedia
        ? await MEDIA.getPreviewMedia(previewOptions)
        : { stream: await MEDIA.getPreviewStream?.(previewOptions), requestedAudio: previewOptions.audioEnabled, requestedVideo: previewOptions.videoEnabled };
      state.previewStream = media?.stream || null;
      const hasAudio = Boolean(previewOptions.audioEnabled && (media?.audio || streamHasTrack(state.previewStream, 'audio')));
      const hasVideo = Boolean(previewOptions.videoEnabled && (media?.video || streamHasTrack(state.previewStream, 'video')));
      if (previewOptions.audioEnabled && !hasAudio) state.prejoinMicEnabled = false;
      if (previewOptions.videoEnabled && !hasVideo) state.prejoinCameraEnabled = false;
      if (!voiceMode && hasVideo) MEDIA.attachPreview?.(document.getElementById('callPrejoinVideo'), state.previewStream);
      await populateDeviceSelects();
      if (previewOptions.audioEnabled && !hasAudio && previewOptions.videoEnabled && hasVideo) {
        setPrejoinStatus(t('Camera ready, microphone unavailable'), 'success');
      } else if (previewOptions.videoEnabled && !hasVideo && previewOptions.audioEnabled && hasAudio) {
        setPrejoinStatus(t('Microphone ready, camera unavailable'), 'success');
      } else {
        setPrejoinStatus(t('Devices ready'), 'success');
      }
    } catch (error) {
      const message = error?.code === 'media_unsupported'
        ? t('Media devices are not supported')
        : (error?.message || (voiceMode ? t('Microphone unavailable') : t('Camera or microphone unavailable')));
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
    state.prejoinEnding = false;
    const voiceMode = isVoiceCall(call);
    if (voiceMode) state.prejoinCameraEnabled = false;
    if (!options.keepIncoming) {
      state.incomingCall = null;
      NOTIFICATIONS.stopRingtone?.();
    }
    const wrap = document.getElementById('callPrejoin');
    wrap?.classList.toggle('is-voice-call', voiceMode);
    document.getElementById('callSurface')?.classList.add('is-behind-prejoin');
    const title = document.getElementById('callPrejoinTitle');
    const meta = document.getElementById('callPrejoinMeta');
    if (title) title.textContent = call.chat_name || callDisplayTitle(call);
    if (meta) meta.textContent = state.prejoinMode === 'devices'
      ? t('Change devices for this call')
      : (voiceMode ? t('Choose microphone before joining') : t('Choose devices before joining'));
    const joinBtn = document.getElementById('callPrejoinJoinBtn');
    if (joinBtn) joinBtn.textContent = state.prejoinMode === 'devices'
      ? t('Apply')
      : (isVoiceRoom(call) ? t('Join voice room') : t('Join'));
    setPrejoinBusy(false);
    renderPrejoinControls();
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
    state.prejoinEnding = false;
    setPrejoinBusy(false);
    document.getElementById('callPrejoin')?.classList.add('hidden');
    document.getElementById('callPrejoin')?.classList.remove('is-voice-call');
    document.getElementById('callSurface')?.classList.remove('is-behind-prejoin');
    renderPrejoinControls();
  }

  async function endPendingPrejoinCall() {
    const call = state.pendingJoinCall;
    if (!canEndPendingPrejoinCall(call) || state.prejoinEnding) return;
    state.prejoinEnding = true;
    setPrejoinBusy(true);
    renderPrejoinControls();
    setPrejoinStatus(t('Ending call...'));
    try {
      const data = await api(`/api/calls/${call.id}/end`, { method: 'POST', body: {} });
      removeCall(data?.call || { ...call, status: 'ended' });
      closePrejoin();
      await loadActiveCalls().catch(() => {});
    } catch (error) {
      setPrejoinStatus(error.message || t('Could not end call'), 'error');
    } finally {
      state.prejoinEnding = false;
      setPrejoinBusy(false);
      renderPrejoinControls();
      renderAll();
    }
  }

  async function applyPrejoinDevicesToRoom() {
    if (!state.room?.localParticipant) {
      closePrejoin();
      return;
    }
    const voiceMode = isVoiceCall(state.currentCall || state.pendingJoinCall);
    state.micEnabled = state.prejoinMicEnabled;
    state.cameraEnabled = voiceMode ? false : state.prejoinCameraEnabled;
    await state.room.localParticipant.setMicrophoneEnabled?.(
      state.micEnabled,
      selectedDevice('audioinput') ? { deviceId: selectedDevice('audioinput') } : undefined
    ).catch(() => {
      state.micEnabled = false;
    });
    if (!voiceMode) {
      await state.room.localParticipant.setCameraEnabled?.(
        state.cameraEnabled,
        selectedDevice('videoinput') ? { deviceId: selectedDevice('videoinput') } : undefined
      ).catch(() => {
        state.cameraEnabled = false;
      });
    }
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
    if (isVoiceCall(state.pendingJoinCall)) return;
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
    if (id !== 'callSpeakerSelect' && !(id === 'callCameraSelect' && isVoiceCall(state.pendingJoinCall))) await refreshPreview();
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
    if (call?.id && isCurrentCall(call) && state.room) return revealCurrentCallSurface();
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
      const nextCall = normalizeClientCall({ ...call, ...(data.call || {}) }, {
        forceVoice: isVoiceCall(call),
        roomMode: callRoomMode(call),
      });
      const voiceMode = isVoiceCall(nextCall);
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
        cameraEnabled: voiceMode ? false : state.prejoinCameraEnabled,
        audioDeviceId: selectedDevice('audioinput'),
        videoDeviceId: voiceMode ? '' : selectedDevice('videoinput'),
        previewStream: publishStream,
      });
      const joined = await api(`/api/calls/${call.id}/joined`, { method: 'POST', body: {} }).catch(() => null);
      if (joined?.call) {
        const joinedCall = normalizeClientCall({ ...nextCall, ...joined.call }, {
          forceVoice: voiceMode,
          roomMode: callRoomMode(nextCall),
        });
        upsertCall(joinedCall);
        state.currentCall = joinedCall;
      }
      setSurfaceStatus(t('Connected'));
    } catch (error) {
      MEDIA.stopStream?.(handoffPreviewStream);
      await disconnectRoom({ intentional: true });
      state.currentCall = null;
      clearSurfaceDuration();
      document.getElementById('callSurface')?.classList.add('hidden');
      state.pendingJoinCall = call;
      state.prejoinMode = 'join';
      document.getElementById('callPrejoin')?.classList.remove('hidden');
      document.getElementById('callPrejoin')?.classList.toggle('is-voice-call', isVoiceCall(call));
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
      surface.classList.toggle('is-voice-call', isVoiceCall(state.currentCall));
    }
    renderSurface();
  }

  function setSurfaceStatus(message) {
    const el = document.getElementById('callSurfaceStatus');
    if (el) el.textContent = message || '';
  }

  function refreshRoomTilesSoon(participant = null, local = false) {
    const render = () => {
      if (participant) replaceCallTile(participant, local);
      else renderRoomTiles();
    };
    window.setTimeout(render, 0);
    window.setTimeout(render, 180);
    window.setTimeout(render, 650);
  }

  async function connectRoom(url, token, options = {}) {
    if (!url || !token) throw new Error(t('LiveKit token is missing'));
    const LK = await ensureLiveKitClient();
    await disconnectRoom({ intentional: true });
    const room = new LK.Room({ adaptiveStream: true, dynacast: true });
    state.room = room;
    addCallDebug('connectRoom', `${url} client=${LK.version || 'unknown'}`);
    const events = LK.RoomEvent || {};
    room.on?.(events.TrackPublished || 'trackPublished', (publication, participant) => {
      addCallDebug('remote track published', `${participant?.identity || ''} ${publication?.kind || publication?.source || ''}`.trim());
      refreshRoomTilesSoon(participant, false);
    });
    room.on?.(events.TrackSubscribed || 'trackSubscribed', (track, _publication, participant) => {
      addCallDebug('remote track subscribed', `${track?.kind || track?.mediaStreamTrack?.kind || 'unknown'} ${track?.source || ''}`.trim());
      attachSubscribedTrack(track);
      if (participant) {
        const key = videoTileKey(participant, false);
        if (state.subscriptionChangingTiles.has(key)) {
          state.subscriptionChangingTiles.delete(key);
          state.videoCollapsedTiles.delete(key);
          replaceCallTile(participant, false);
          return;
        }
      }
      renderRoomTiles();
    });
    room.on?.(events.TrackSubscriptionFailed || 'trackSubscriptionFailed', (_trackSid, participant) => {
      addCallDebug('track subscription failed', participant?.identity || '');
      refreshRoomTilesSoon(participant, false);
    });
    room.on?.(events.TrackUnpublished || 'trackUnpublished', (publication, participant) => {
      addCallDebug('remote track unpublished', `${participant?.identity || ''} ${publication?.kind || publication?.source || ''}`.trim());
      refreshRoomTilesSoon(participant, false);
    });
    room.on?.(events.TrackUnsubscribed || 'trackUnsubscribed', (track, _publication, participant) => {
      addCallDebug('remote track unsubscribed', `${track?.kind || track?.mediaStreamTrack?.kind || 'unknown'} ${track?.source || ''}`.trim());
      detachTrack(track);
      if (participant) {
        const key = videoTileKey(participant, false);
        if (state.subscriptionChangingTiles.has(key)) {
          replaceCallTile(participant, false);
          return;
        }
      }
      renderRoomTiles();
    });
    room.on?.(events.ParticipantConnected || 'participantConnected', (participant) => {
      addCallDebug('participant connected', participant?.identity || '');
      renderRoomTiles();
      refreshRoomTilesSoon(participant, false);
    });
    room.on?.(events.ParticipantDisconnected || 'participantDisconnected', (participant) => {
      addCallDebug('participant disconnected', participant?.identity || '');
      renderRoomTiles();
    });
    room.on?.(events.LocalTrackPublished || 'localTrackPublished', (publication) => {
      addCallDebug('local track published', `${publication?.kind || publication?.track?.kind || 'unknown'} ${publication?.source || publication?.track?.source || ''}`.trim());
      notifyLocalMicrophoneTrackForAiNotes().catch(() => {});
      renderRoomTiles();
    });
    room.on?.(events.LocalTrackUnpublished || 'localTrackUnpublished', (publication) => {
      addCallDebug('local track unpublished', `${publication?.kind || publication?.track?.kind || 'unknown'} ${publication?.source || publication?.track?.source || ''}`.trim());
      scheduleLocalMediaRetry(3000, { resetCount: true });
      renderRoomTiles();
    });
    room.on?.(events.TrackMuted || 'trackMuted', (publication, participant) => {
      addCallDebug('track muted', `${participant?.identity || ''} ${publication?.kind || publication?.track?.kind || 'unknown'} ${publication?.source || publication?.track?.source || ''}`.trim());
      renderRoomTiles();
    });
    room.on?.(events.TrackUnmuted || 'trackUnmuted', (publication, participant) => {
      addCallDebug('track unmuted', `${participant?.identity || ''} ${publication?.kind || publication?.track?.kind || 'unknown'} ${publication?.source || publication?.track?.source || ''}`.trim());
      refreshRoomTilesSoon(participant, participant?.isLocal === true);
    });
    room.on?.(events.ActiveSpeakersChanged || 'activeSpeakersChanged', (speakers = []) => {
      addCallDebug('active speakers', speakers.map((participant) => participant?.identity || participant?.name || '').filter(Boolean).join(', '));
      setSpeakingParticipants(speakers);
    });
    room.on?.(events.Reconnecting || 'reconnecting', () => {
      state.roomConnectionState = 'reconnecting';
      state.roomConnectedAt = 0;
      addCallDebug('room reconnecting');
      setSurfaceStatus(t('Reconnecting...'));
    });
    room.on?.(events.Reconnected || 'reconnected', () => {
      state.roomConnectionState = 'connected';
      state.roomConnectedAt = Date.now();
      addCallDebug('room reconnected');
      setSurfaceStatus(t('Connected'));
      scheduleLocalMediaRetry(3500, { resetCount: true });
    });
    room.on?.(events.ConnectionStateChanged || 'connectionStateChanged', (connectionState) => {
      state.roomConnectionState = String(connectionState || '');
      if (state.roomConnectionState === 'connected') state.roomConnectedAt = Date.now();
      if (state.roomConnectionState && state.roomConnectionState !== 'connected') state.roomConnectedAt = 0;
      addCallDebug('connection state', state.roomConnectionState);
    });
    room.on?.(events.Disconnected || 'disconnected', (reason) => {
      state.room = null;
      state.roomConnectionState = 'disconnected';
      state.roomConnectedAt = 0;
      addCallDebug('room disconnected', String(reason || ''));
      if (!state.disconnectingIntentionally && state.currentCall?.id) {
        notifyLeaveCurrentCall({ fireAndForget: true }).catch(() => {});
      }
      setSurfaceStatus(t('Disconnected'));
      renderRoomTiles();
    });
    await room.connect(url, token);
    state.roomConnectionState = 'connected';
    state.roomConnectedAt = Date.now();
    addCallDebug('room connected', room.localParticipant?.identity || '');
    state.leaveSentForCallId = 0;
    state.micEnabled = options.micEnabled !== false;
    state.cameraEnabled = isVoiceCall(state.currentCall) ? false : options.cameraEnabled !== false;
    state.localMediaOptions = {
      audioDeviceId: options.audioDeviceId || '',
      videoDeviceId: options.videoDeviceId || '',
    };
    state.publishRetryCount = 0;
    MEDIA.stopStream?.(options.previewStream);
    applySpeakerDevice();
    renderSurfaceControls();
    renderRoomTiles();
    syncSurfaceDurationTimer();
    renderCallDebug();
    refreshRoomTilesSoon();
    addCallDebug('local media scheduled', 'after connect settle');
    scheduleLocalMediaRetry(3500, { resetCount: true });
    notifyLocalMicrophoneTrackForAiNotes().catch(() => {});
  }

  async function enableLocalMedia(reason = 'retry') {
    const result = { audio: false, video: false };
    const room = state.room;
    const options = state.localMediaOptions || {};
    if (state.publishingLocalTracks || !room?.localParticipant) return result;
    if (!isRoomStableForLocalPublish()) {
      addCallDebug('publish delayed', state.roomConnectionState || 'not connected');
      scheduleLocalMediaRetry(3000);
      return result;
    }
    state.publishingLocalTracks = true;
    addCallDebug('enable local media', reason);
    const enableWithTimeout = async (label, action, hasPublication) => {
      if (hasPublication()) return true;
      try {
        await Promise.race([
          action(),
          new Promise((_, reject) => window.setTimeout(() => reject(new Error(`${label} enable timed out`)), 22000)),
        ]);
        window.setTimeout(renderCallDebug, 0);
        return hasPublication();
      } catch (error) {
        addCallDebug(`${label} enable failed`, error?.message || String(error || ''));
        return hasPublication();
      }
    };
    try {
      if (state.micEnabled) {
        result.audio = await enableWithTimeout(
          'microphone',
          () => room.localParticipant.setMicrophoneEnabled?.(
            true,
            options.audioDeviceId ? { deviceId: options.audioDeviceId } : undefined
          ).then(() => {
            addCallDebug('microphone enabled');
          }),
          () => hasLocalAudioPublication(room)
        );
        if (!result.audio) setSurfaceStatus(t('Microphone unavailable'));
      } else {
        await room.localParticipant.setMicrophoneEnabled?.(false).catch(() => {});
      }
      if (isVoiceCall(state.currentCall)) {
        result.video = false;
      } else if (state.cameraEnabled) {
        result.video = await enableWithTimeout(
          'camera',
          () => room.localParticipant.setCameraEnabled?.(
            true,
            options.videoDeviceId ? { deviceId: options.videoDeviceId } : undefined
          ).then(() => {
            addCallDebug('camera enabled');
          }),
          () => hasLocalVideoPublication(room)
        );
        if (!result.video) setSurfaceStatus(t('Camera unavailable'));
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

  function localMicrophoneTrackId() {
    const publications = state.room?.localParticipant?.audioTrackPublications;
    if (!publications?.values) return '';
    for (const publication of publications.values()) {
      const source = String(publication?.source || publication?.track?.source || '').toLowerCase();
      const kind = String(publication?.kind || publication?.track?.kind || publication?.track?.mediaStreamTrack?.kind || '').toLowerCase();
      if (source && !source.includes('microphone') && !source.includes('unknown')) continue;
      if (kind && kind !== 'audio') continue;
      const trackId = String(
        publication?.trackSid
        || publication?.sid
        || publication?.track?.sid
        || publication?.track?.trackSid
        || ''
      ).trim();
      if (trackId) return trackId;
    }
    return '';
  }

  async function notifyLocalMicrophoneTrackForAiNotes() {
    const callId = Number(state.currentCall?.id || 0);
    if (!callId || state.currentCall?.ai_notes?.status !== 'recording') return;
    const trackId = localMicrophoneTrackId();
    if (!trackId) return;
    const key = `${callId}:${trackId}`;
    if (state.aiNotesTrackNotified.has(key)) return;
    state.aiNotesTrackNotified.add(key);
    try {
      await api(`/api/calls/${callId}/ai-notes/local-track`, {
        method: 'POST',
        body: { track_id: trackId },
      });
      addCallDebug('AI notes local track sent', trackId);
    } catch (error) {
      state.aiNotesTrackNotified.delete(key);
      addCallDebug('AI notes local track failed', error.message || '');
    }
  }

  function hasLocalAudioPublication(room = state.room) {
    return Number(room?.localParticipant?.audioTrackPublications?.size || 0) > 0;
  }

  function hasLocalVideoPublication(room = state.room) {
    return Number(room?.localParticipant?.videoTrackPublications?.size || 0) > 0;
  }

  function isRoomStableForLocalPublish() {
    if (!state.room?.localParticipant) return false;
    if (state.roomConnectionState && state.roomConnectionState !== 'connected') return false;
    if (!state.roomConnectedAt) return false;
    return Date.now() - state.roomConnectedAt >= 2500;
  }

  function scheduleLocalMediaRetry(delay = 1500, options = {}) {
    if (!state.room?.localParticipant) return;
    if (options.resetCount && state.publishRetryTimer) {
      window.clearTimeout(state.publishRetryTimer);
      state.publishRetryTimer = 0;
    }
    if (state.publishRetryTimer) return;
    if (options.resetCount) state.publishRetryCount = 0;
    if (state.publishRetryCount >= 8) {
      addCallDebug('media retry stopped', 'too many attempts');
      return;
    }
    state.publishRetryTimer = window.setTimeout(async () => {
      state.publishRetryTimer = 0;
      if (!state.room) return;
      if (state.publishingLocalTracks) {
        scheduleLocalMediaRetry(1000);
        return;
      }
      if (!isRoomStableForLocalPublish()) {
        addCallDebug('media retry delayed', state.roomConnectionState || 'not connected');
        scheduleLocalMediaRetry(2500);
        return;
      }
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
    clearSurfaceDuration();
    state.screenShareEnabled = false;
    if (state.publishRetryTimer) window.clearTimeout(state.publishRetryTimer);
    state.publishRetryTimer = 0;
    state.publishingLocalTracks = false;
    state.localMediaOptions = null;
    state.roomConnectionState = '';
    state.roomConnectedAt = 0;
    state.videoCollapsedTiles.clear();
    state.videoFillTiles.clear();
    state.subscriptionChangingTiles.clear();
    state.focusedVideoTileKey = '';
    state.speakingTileKeys.clear();
    state.lastTileTap = { key: '', at: 0 };
    state.aiNotesTrackNotified.clear();
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
    if (isVoiceCall(state.currentCall)) return;
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
    if (isVoiceCall(state.currentCall)) return;
    if (!state.settings.screen_share_enabled || !MEDIA.isScreenShareSupported?.()) return;
    state.screenShareEnabled = !state.screenShareEnabled;
    await state.room?.localParticipant?.setScreenShareEnabled?.(state.screenShareEnabled).catch(() => {
      state.screenShareEnabled = !state.screenShareEnabled;
    });
    renderSurfaceControls();
    renderRoomTiles();
  }

  async function toggleAiNotes() {
    const callId = Number(state.currentCall?.id || 0);
    if (!callId || !state.settings.call_ai_notes_enabled) return;
    const notes = state.currentCall?.ai_notes || null;
    const recording = notes?.status === 'recording';
    try {
      const data = await api(`/api/calls/${callId}/ai-notes/${recording ? 'cancel' : 'start'}`, { method: 'POST', body: {} });
      if (data?.call) {
        const nextCall = normalizeClientCall({ ...state.currentCall, ...data.call }, {
          forceVoice: isVoiceCall(state.currentCall),
          roomMode: callRoomMode(state.currentCall),
        });
        state.currentCall = nextCall;
        upsertCall(nextCall);
      }
      notifyLocalMicrophoneTrackForAiNotes().catch(() => {});
      renderAll();
    } catch (error) {
      addCallDebug('AI notes failed', error.message || '');
      const status = document.getElementById('callSurfaceStatus');
      if (status) status.textContent = error.message || t('AI notes failed');
    }
  }

  function transcriptStatus(message, type = '') {
    const el = document.getElementById('callTranscriptStatus');
    if (!el) return;
    el.classList.toggle('hidden', !message);
    el.classList.toggle('error', type === 'error');
    el.classList.toggle('success', type === 'success');
    el.textContent = message || '';
  }

  function syncTranscriptActions() {
    const retranscribe = document.getElementById('callTranscriptRetranscribe');
    if (!retranscribe) return;
    const canRetranscribe = Boolean(currentUser()?.is_admin && Number(state.transcriptModal.callId || 0));
    retranscribe.classList.toggle('hidden', !canRetranscribe);
    retranscribe.disabled = !canRetranscribe || retranscribe.dataset.pending === '1';
  }

  async function openTranscript(callId, runId = 0) {
    ensureUi();
    state.transcriptModal = { callId: Number(callId || 0), runId: Number(runId || 0), text: '', segments: [] };
    document.getElementById('callTranscriptText').textContent = '';
    syncTranscriptActions();
    transcriptStatus(t('Loading...'));
    bridge()?.openManagedModal?.('callTranscriptModal', { replaceStack: false });
    try {
      const data = runId
        ? await api(`/api/calls/transcript-runs/${Number(runId)}`)
        : await api(`/api/calls/${Number(callId)}/transcript`);
      state.transcriptModal = {
        callId: Number(data.call?.id || callId || 0),
        runId: Number(runId || data.run?.id || 0),
        text: data.transcript_text || '',
        segments: Array.isArray(data.segments) ? data.segments : [],
      };
      document.getElementById('callTranscriptText').textContent = state.transcriptModal.text || t('Transcript is empty');
      syncTranscriptActions();
      const approximate = runId ? data.run?.timing_approximate : data.ai_notes?.timing_approximate;
      transcriptStatus(approximate ? t('Timing is approximate') : '', approximate ? '' : 'success');
    } catch (error) {
      syncTranscriptActions();
      transcriptStatus(error.message || t('Could not load transcript'), 'error');
    }
  }

  async function copyTranscriptText() {
    const text = state.transcriptModal.text || document.getElementById('callTranscriptText')?.textContent || '';
    if (!text) return;
    await navigator.clipboard?.writeText(text).catch(() => {});
    transcriptStatus(t('Copied'), 'success');
  }

  async function retranscribeCurrentTranscript() {
    const button = document.getElementById('callTranscriptRetranscribe');
    const callId = Number(state.transcriptModal.callId || 0);
    if (!button || !currentUser()?.is_admin || !callId) return;
    button.dataset.pending = '1';
    syncTranscriptActions();
    transcriptStatus(t('Transcription...'));
    try {
      await api(`/api/calls/${callId}/transcribe/retry`, { method: 'POST', body: {} });
      transcriptStatus(t('Transcript queued'), 'success');
    } catch (error) {
      transcriptStatus(error.message || t('Could not start transcription'), 'error');
    } finally {
      delete button.dataset.pending;
      syncTranscriptActions();
    }
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
    clearSurfaceDuration();
    document.getElementById('callSurface')?.classList.add('hidden');
    await loadActiveCalls().catch(() => {});
  }

  function getParticipantName(participant, fallback) {
    return participant?.name || participant?.identity || fallback || t('Participant');
  }

  function firstVideoPublication(participant) {
    const publications = participant?.videoTrackPublications || participant?.trackPublications;
    if (!publications?.values) return null;
    for (const publication of publications.values()) {
      const track = publication?.track;
      const kind = publication?.kind || track?.kind || track?.mediaStreamTrack?.kind;
      if (kind !== 'audio') return publication;
    }
    return null;
  }

  function firstVisibleVideoTrack(participant) {
    const publications = participant?.videoTrackPublications || participant?.trackPublications;
    if (!publications?.values) return null;
    for (const publication of publications.values()) {
      const track = publication?.track;
      const kind = track?.kind || track?.mediaStreamTrack?.kind;
      const mediaTrack = track?.mediaStreamTrack;
      const isMuted = Boolean(publication?.isMuted || publication?.muted || track?.isMuted || mediaTrack?.muted);
      const isLive = !mediaTrack || mediaTrack.readyState === 'live';
      const isEnabled = !mediaTrack || mediaTrack.enabled !== false;
      if (track && kind !== 'audio' && !isMuted && isLive && isEnabled) return track;
    }
    return null;
  }

  function videoTileKey(participant, local = false) {
    return local ? 'local' : String(participant?.identity || participant?.sid || participant?.name || 'remote');
  }

  function isLocalRoomParticipant(participant) {
    const local = state.room?.localParticipant;
    return Boolean(
      participant
      && (participant === local
        || participant.isLocal === true
        || (local?.identity && participant.identity === local.identity))
    );
  }

  function applySpeakingTileClasses() {
    const grid = document.getElementById('callGrid');
    if (!grid) return;
    Array.from(grid.querySelectorAll('.call-tile')).forEach((tile) => {
      tile.classList.toggle('is-speaking', state.speakingTileKeys.has(tile.dataset.callTileKey));
    });
  }

  function setSpeakingParticipants(participants = []) {
    state.speakingTileKeys.clear();
    (Array.isArray(participants) ? participants : []).forEach((participant) => {
      if (!participant) return;
      state.speakingTileKeys.add(videoTileKey(participant, isLocalRoomParticipant(participant)));
    });
    if (isVoiceCall(state.currentCall)) renderVoiceRoomTiles();
    else applySpeakingTileClasses();
  }

  function safeVideoDimension(value) {
    const number = Math.round(Number(value || 0));
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function getVideoDimensions(video, track) {
    const videoWidth = safeVideoDimension(video?.videoWidth);
    const videoHeight = safeVideoDimension(video?.videoHeight);
    if (videoWidth && videoHeight) return { width: videoWidth, height: videoHeight };

    const trackWidth = safeVideoDimension(track?.dimensions?.width);
    const trackHeight = safeVideoDimension(track?.dimensions?.height);
    if (trackWidth && trackHeight) return { width: trackWidth, height: trackHeight };

    let settings = null;
    try {
      settings = track?.mediaStreamTrack?.getSettings?.() || null;
    } catch {
      settings = null;
    }
    const settingsWidth = safeVideoDimension(settings?.width);
    const settingsHeight = safeVideoDimension(settings?.height);
    if (settingsWidth && settingsHeight) return { width: settingsWidth, height: settingsHeight };

    return null;
  }

  function callVideoOrientation(dimensions) {
    const width = safeVideoDimension(dimensions?.width);
    const height = safeVideoDimension(dimensions?.height);
    if (!width || !height) return '';
    if (height > width * 1.08) return 'portrait';
    if (width > height * 1.08) return 'landscape';
    return 'square';
  }

  function updateCallGridLayout(grid = document.getElementById('callGrid')) {
    if (!grid) return;
    const tiles = Array.from(grid.children).filter((tile) => tile?.classList?.contains('call-tile'));
    const visibleTiles = tiles.filter((tile) => !tile.classList.contains('is-video-collapsed'));
    const count = visibleTiles.length;
    const orientations = visibleTiles.map((tile) => (
      tile.dataset.videoOrientation
      || (tile.classList.contains('is-video-portrait') ? 'portrait' : '')
      || (tile.classList.contains('is-video-square') ? 'square' : '')
      || 'landscape'
    ));
    const portraitCount = orientations.filter((item) => item === 'portrait').length;
    const landscapeCount = orientations.filter((item) => item === 'landscape').length;
    let layout = 'dense';
    if (count <= 1) layout = 'single';
    else if (count === 2 && portraitCount === 2) layout = 'portrait-pair';
    else if (count === 2 && landscapeCount === 2) layout = 'landscape-pair';
    else if (portraitCount && landscapeCount) layout = 'mixed';
    grid.dataset.callTileCount = String(count);
    grid.dataset.callLayout = layout;
  }

  function applyCallTileVideoGeometry(tile, video, track) {
    if (!tile || !video) return;
    const dimensions = getVideoDimensions(video, track);
    const orientation = callVideoOrientation(dimensions);
    if (!dimensions || !orientation) {
      updateCallGridLayout(tile.closest('#callGrid'));
      return;
    }
    tile.dataset.videoOrientation = orientation;
    tile.classList.toggle('is-video-portrait', orientation === 'portrait');
    tile.classList.toggle('is-video-landscape', orientation === 'landscape');
    tile.classList.toggle('is-video-square', orientation === 'square');
    tile.style.setProperty('--call-tile-aspect', `${dimensions.width} / ${dimensions.height}`);
    updateCallGridLayout(tile.closest('#callGrid'));
  }

  function bindCallTileVideoGeometry(tile, video, track) {
    if (!tile || !video) return;
    const refresh = () => applyCallTileVideoGeometry(tile, video, track);
    refresh();
    ['loadedmetadata', 'loadeddata', 'resize'].forEach((eventName) => {
      video.addEventListener(eventName, refresh);
    });
    window.requestAnimationFrame?.(refresh);
  }

  function updateVideoFocusButton(button, focused) {
    if (!button) return;
    const label = focused ? t('Exit full screen video') : t('Full screen video');
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', focused ? 'true' : 'false');
  }

  function renderVideoFitButton(tile, key, focused) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'call-tile-fit-btn call-icon-fill';
    updateVideoFocusButton(button, focused);
    button.innerHTML = '<span class="call-icon" aria-hidden="true"></span>';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setVideoTileFocus(tile, key, true);
    });
    tile.appendChild(button);
  }

  function canFocusVideoTile(local, isCollapsed, track) {
    return !isCollapsed && Boolean(track?.attach);
  }

  function applyVideoTileActionState() {
    const grid = document.getElementById('callGrid');
    if (!grid) return;
    Array.from(grid.querySelectorAll('.call-tile')).forEach((tile) => {
      const focused = Boolean(state.focusedVideoTileKey && tile.dataset.callTileKey === state.focusedVideoTileKey);
      tile.classList.toggle('is-video-fill', focused);
      updateVideoFocusButton(tile.querySelector('.call-tile-fit-btn'), focused);
    });
  }

  function applyVideoFocusClasses() {
    const grid = document.getElementById('callGrid');
    if (!grid) return;
    const focusKey = state.focusedVideoTileKey;
    grid.classList.toggle('is-video-focus-mode', Boolean(focusKey));
    Array.from(grid.children).forEach((tile) => {
      const isFocused = Boolean(focusKey && tile.dataset.callTileKey === focusKey);
      tile.classList.toggle('is-video-focused', isFocused);
      tile.classList.toggle('is-video-secondary', Boolean(focusKey && !isFocused));
    });
    applyVideoTileActionState();
  }

  function setFocusedVideoTile(key = '') {
    state.focusedVideoTileKey = key;
    state.videoFillTiles.clear();
    if (key) state.videoFillTiles.add(key);
    applyVideoFocusClasses();
  }

  function setVideoTileFocus(_tile, key, canFocus) {
    if (!canFocus) return;
    setFocusedVideoTile(state.focusedVideoTileKey === key ? '' : key);
  }

  function handleVideoTileDoubleTap(tile, key, canFocus) {
    setVideoTileFocus(tile, key, canFocus);
  }

  function setRemoteVideoCollapsed(participant, key, collapsed) {
    if (!participant || key === 'local') return;
    const publication = firstVideoPublication(participant);
    if (collapsed) {
      state.videoCollapsedTiles.add(key);
      if (state.focusedVideoTileKey === key) setFocusedVideoTile('');
      state.subscriptionChangingTiles.delete(key);
      try {
        publication?.setEnabled?.(false);
      } catch {}
      replaceCallTile(participant, false);
      return;
    }

    try {
      publication?.setEnabled?.(true);
      publication?.setSubscribed?.(true);
    } catch {}
    if (publication?.track) {
      state.videoCollapsedTiles.delete(key);
      state.subscriptionChangingTiles.delete(key);
      replaceCallTile(participant, false);
      return;
    }
    state.subscriptionChangingTiles.add(key);
    window.setTimeout(() => {
      const fresh = firstVideoPublication(participant);
      if (fresh?.track) {
        state.subscriptionChangingTiles.delete(key);
        state.videoCollapsedTiles.delete(key);
        replaceCallTile(participant, false);
      }
    }, 450);
  }

  function setVideoTileCollapsed(participant, key, collapsed, local = false) {
    if (local) {
      if (collapsed) state.videoCollapsedTiles.add(key);
      else state.videoCollapsedTiles.delete(key);
      if (collapsed && state.focusedVideoTileKey === key) setFocusedVideoTile('');
      replaceCallTile(participant, true);
      return;
    }
    setRemoteVideoCollapsed(participant, key, collapsed);
  }

  function replaceCallTile(participant, local = false) {
    const grid = document.getElementById('callGrid');
    if (!grid) return;
    const key = videoTileKey(participant, local);
    const current = Array.from(grid.children).find((item) => item.dataset.callTileKey === key);
    if (!current) return;
    current.replaceWith(renderCallTile(participant, local));
    updateCallGridLayout(grid);
    applyVideoFocusClasses();
    applySpeakingTileClasses();
  }

  function renderCallTile(participant, local) {
    const tile = document.createElement('div');
    tile.className = 'call-tile';
    const meta = callParticipantForRoomParticipant(participant, local);
    const name = meta?.display_name || meta?.username || getParticipantName(participant, local ? t('You') : t('Participant'));
    const tileKey = videoTileKey(participant, local);
    tile.dataset.callTileKey = tileKey;
    const isCollapsed = state.videoCollapsedTiles.has(tileKey);
    const track = isCollapsed ? null : firstVisibleVideoTrack(participant);
    if (state.focusedVideoTileKey === tileKey && !canFocusVideoTile(local, isCollapsed, track)) {
      state.focusedVideoTileKey = '';
      state.videoFillTiles.delete(tileKey);
    }
    const isFocused = state.focusedVideoTileKey === tileKey;
    const isFill = state.videoFillTiles.has(tileKey);
    tile.classList.toggle('is-video-fill', isFill);
    tile.classList.toggle('is-video-collapsed', isCollapsed);
    tile.classList.toggle('is-speaking', state.speakingTileKeys.has(tileKey));
    if (track?.attach) {
      try {
        const video = track.attach();
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.muted = Boolean(local);
        video.controls = false;
        video.removeAttribute('controls');
        video.preload = 'auto';
        tile.appendChild(video);
        bindCallTileVideoGeometry(tile, video, track);
        video.play?.().catch(() => {});
        renderVideoFitButton(tile, tileKey, isFocused);
      } catch {
        tile.innerHTML = bananaTilePlaceholder(name);
      }
    } else {
      tile.innerHTML = bananaTilePlaceholder(name);
    }
    const label = document.createElement('div');
    label.className = 'call-tile-name';
    const labelText = document.createElement('span');
    labelText.className = 'call-tile-name-text';
    labelText.textContent = local ? `${name} (${t('you')})` : name;
    label.appendChild(labelText);
    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'call-tile-subscribe-btn';
    collapseBtn.textContent = isCollapsed ? '+' : '-';
    collapseBtn.title = isCollapsed ? t('Resume video') : (local ? t('Hide local preview') : t('Pause video'));
    collapseBtn.setAttribute('aria-label', collapseBtn.title);
    collapseBtn.setAttribute('aria-pressed', isCollapsed ? 'true' : 'false');
    collapseBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setVideoTileCollapsed(participant, tileKey, !state.videoCollapsedTiles.has(tileKey), local);
    });
    label.appendChild(collapseBtn);
    tile.appendChild(label);
    const focusable = canFocusVideoTile(local, isCollapsed, track);
    tile.classList.toggle('is-video-focusable', focusable);
    tile.addEventListener('dblclick', (event) => {
      if (event.target?.closest?.('button')) return;
      event.preventDefault();
      handleVideoTileDoubleTap(tile, tileKey, focusable);
    });
    tile.addEventListener('touchend', (event) => {
      if (event.target?.closest?.('button')) return;
      const now = Date.now();
      const isDoubleTap = state.lastTileTap.key === tileKey && now - state.lastTileTap.at < 320;
      state.lastTileTap = { key: tileKey, at: now };
      if (!isDoubleTap) return;
      event.preventDefault();
      handleVideoTileDoubleTap(tile, tileKey, focusable);
    }, { passive: false });
    return tile;
  }

  function audioPublicationForParticipant(participant) {
    const publications = participant?.audioTrackPublications || participant?.trackPublications;
    if (!publications?.values) return null;
    for (const publication of publications.values()) {
      const track = publication?.track;
      const kind = publication?.kind || track?.kind || track?.mediaStreamTrack?.kind;
      const source = String(publication?.source || track?.source || '').toLowerCase();
      if (kind === 'audio' || source.includes('microphone')) return publication;
    }
    return null;
  }

  function isVoiceParticipantMuted(participant, local = false) {
    if (local) return !state.micEnabled;
    const publication = audioPublicationForParticipant(participant);
    if (!publication) return true;
    const track = publication.track || null;
    const mediaTrack = track?.mediaStreamTrack || null;
    return Boolean(publication.isMuted || publication.muted || track?.isMuted || mediaTrack?.muted || mediaTrack?.enabled === false);
  }

  function collectRoomParticipantsByUserId() {
    const map = new Map();
    const room = state.room;
    if (room?.localParticipant) {
      const userId = Number(currentUser()?.id || userIdFromIdentity(room.localParticipant.identity));
      if (userId) map.set(userId, { participant: room.localParticipant, local: true });
    }
    if (room?.remoteParticipants?.values) {
      for (const participant of room.remoteParticipants.values()) {
        const userId = userIdFromIdentity(participant?.identity);
        if (userId) map.set(userId, { participant, local: false });
      }
    }
    return map;
  }

  function renderVoiceParticipantTile(meta, roomParticipant = null, local = false) {
    const tile = document.createElement('div');
    tile.className = 'call-voice-tile';
    const name = meta?.display_name || meta?.username || getParticipantName(roomParticipant, local ? t('You') : t('Participant'));
    const connected = Boolean(roomParticipant);
    const muted = connected && isVoiceParticipantMuted(roomParticipant, local);
    const speaking = Boolean(connected && (roomParticipant?.isSpeaking || state.speakingTileKeys.has(videoTileKey(roomParticipant, local))));
    const stateText = connected
      ? (speaking ? t('Speaking') : (muted ? t('Muted') : t('Connected')))
      : (isVoiceRoom(state.currentCall) && meta?.state === 'invited' ? t('Can join') : participantStateText(meta?.state || 'invited'));
    tile.classList.toggle('is-connected', connected);
    tile.classList.toggle('is-muted', muted);
    tile.classList.toggle('is-speaking', speaking);
    tile.innerHTML = `
      ${avatarMarkup(meta || { display_name: name }, 'call-voice-avatar')}
      <div class="call-voice-main">
        <strong>${escapeHtml(local ? `${name} (${t('you')})` : name)}</strong>
        <small>${escapeHtml(stateText)}</small>
      </div>
      <span class="call-voice-state" aria-hidden="true"></span>
    `;
    return tile;
  }

  function renderVoiceRoomTiles() {
    const grid = document.getElementById('callGrid');
    if (!grid) return;
    grid.classList.add('is-voice-room-grid');
    grid.classList.remove('is-video-focus-mode');
    grid.replaceChildren();
    const roomByUserId = collectRoomParticipantsByUserId();
    const seen = new Set();
    const participants = [...(state.currentCall?.participants || [])].sort((a, b) => {
      const connectedA = roomByUserId.has(Number(a.user_id || 0)) ? 0 : 1;
      const connectedB = roomByUserId.has(Number(b.user_id || 0)) ? 0 : 1;
      return connectedA - connectedB || String(a.display_name || a.username || '').localeCompare(String(b.display_name || b.username || ''));
    });
    participants.forEach((meta) => {
      const userId = Number(meta.user_id || 0);
      const roomEntry = roomByUserId.get(userId) || null;
      seen.add(userId);
      grid.appendChild(renderVoiceParticipantTile(meta, roomEntry?.participant || null, Boolean(roomEntry?.local)));
    });
    roomByUserId.forEach((entry, userId) => {
      if (seen.has(userId)) return;
      const meta = callParticipantForRoomParticipant(entry.participant, entry.local) || {
        user_id: userId,
        display_name: getParticipantName(entry.participant, entry.local ? t('You') : t('Participant')),
        state: 'joined',
      };
      grid.appendChild(renderVoiceParticipantTile(meta, entry.participant, entry.local));
    });
    if (!grid.children.length) {
      const empty = document.createElement('div');
      empty.className = 'call-voice-empty';
      empty.textContent = t('Waiting');
      grid.appendChild(empty);
    }
    grid.dataset.callLayout = 'voice';
    grid.dataset.callTileCount = String(grid.children.length);
    renderParticipantsPanel();
  }

  function renderRoomTiles() {
    const grid = document.getElementById('callGrid');
    if (!grid) return;
    if (isVoiceCall(state.currentCall)) {
      renderVoiceRoomTiles();
      return;
    }
    grid.classList.remove('is-voice-room-grid');
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
      empty.innerHTML = `${bananaTilePlaceholder(t('Waiting'))}<div class="call-tile-name">${escapeHtml(t('Waiting'))}</div>`;
      grid.appendChild(empty);
      updateCallGridLayout(grid);
      renderParticipantsPanel();
      return;
    }
    participants.forEach(({ participant, local }) => {
      grid.appendChild(renderCallTile(participant, local));
    });
    updateCallGridLayout(grid);
    applyVideoFocusClasses();
    applySpeakingTileClasses();
    renderParticipantsPanel();
  }

  function participantStateText(stateName) {
    if (isVoiceRoom(state.currentCall) && stateName === 'invited') return t('Can join');
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
    if (!surface || !state.currentCall) {
      clearSurfaceDuration();
      return;
    }
    surface.classList.toggle('is-minimized', state.minimized);
    surface.classList.toggle('is-voice-call', isVoiceCall(state.currentCall));
    document.getElementById('callSurfaceTitle').textContent = state.currentCall.chat_name || callDisplayTitle(state.currentCall);
    syncSurfaceDurationTimer();
    const notes = state.currentCall.ai_notes || null;
    const status = document.getElementById('callSurfaceStatus');
    if (status) {
      status.textContent = notes?.status === 'recording'
        ? t('AI notes recording')
        : (notes?.transcript_status === 'processing' ? t('Transcript processing') : '');
      status.classList.toggle('is-recording', notes?.status === 'recording');
    }
    renderMinimizeButton();
    renderSurfaceControls();
    renderRoomTiles();
    renderParticipantsPanel();
    renderCallDebug();
  }

  function renderCallDebug() {
    const el = document.getElementById('callDebugLog');
    if (!el) return;
    el.classList.toggle('hidden', !state.settings.call_debug_enabled);
    if (!state.settings.call_debug_enabled) {
      el.textContent = '';
      return;
    }
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
    const aiNotes = document.getElementById('callAiNotesBtn');
    const leave = document.getElementById('callLeaveBtn');
    const end = document.getElementById('callEndBtn');
    const voiceMode = isVoiceCall(state.currentCall);
    setIconToggleState(mic, state.micEnabled, t('Mic'), t('Mic off'));
    setIconToggleState(camera, state.cameraEnabled, t('Camera'), t('Camera off'));
    camera?.classList.toggle('hidden', voiceMode);
    setToolButtonLabel(participants, t('Participants'));
    participants?.classList.toggle('is-active', state.participantsOpen);
    participants?.setAttribute('aria-pressed', state.participantsOpen ? 'true' : 'false');
    setToolButtonLabel(devices, t('Devices'));
    setToolButtonLabel(leave, t('Leave'));
    setToolButtonLabel(end, t('End for everyone'));
    if (screen) {
      const supported = Boolean(!voiceMode && state.settings.screen_share_enabled && MEDIA.isScreenShareSupported?.());
      screen.classList.toggle('hidden', !supported);
      setToolButtonLabel(screen, state.screenShareEnabled ? t('Stop sharing') : t('Share screen'));
      screen.classList.remove('is-off');
      screen.classList.toggle('is-active', state.screenShareEnabled);
      screen.setAttribute('aria-pressed', state.screenShareEnabled ? 'true' : 'false');
    }
    if (aiNotes) {
      const notes = state.currentCall?.ai_notes || null;
      const recording = notes?.status === 'recording';
      const available = Boolean(state.settings.call_ai_notes_enabled && state.currentCall?.status === 'active');
      aiNotes.classList.toggle('hidden', !state.settings.call_ai_notes_enabled);
      aiNotes.disabled = !available || ['processing', 'completed'].includes(notes?.transcript_status || '');
      setToolButtonLabel(aiNotes, recording ? t('Stop AI notes') : t('AI notes'));
      aiNotes.classList.toggle('is-active', recording);
      aiNotes.setAttribute('aria-pressed', recording ? 'true' : 'false');
    }
  }

  async function openCallAdminModal() {
    bridge()?.openManagedModal?.('callAdminModal', { replaceStack: true });
    await loadAdminSettings().catch((error) => setAdminStatus(error.message || t('Could not load call settings'), 'error'));
  }

  async function loadAdminSettings() {
    const [data, artifacts] = await Promise.all([
      api('/api/admin/call-settings'),
      api('/api/admin/call-artifacts').catch(() => ({ artifacts: [], bots: [] })),
    ]);
    state.adminSettings = data.settings || {};
    state.adminArtifacts = Array.isArray(artifacts.artifacts) ? artifacts.artifacts : [];
    state.adminArtifactBots = Array.isArray(artifacts.bots) ? artifacts.bots : [];
    state.adminLoaded = true;
    renderAdminSettings(data);
    return data;
  }

  function botOptionLabel(bot) {
    const status = bot.enabled === false ? ` ${t('(disabled)')}` : '';
    return `${bot.name || bot.mention || `#${bot.id}`} · ${bot.provider || 'ai'} / ${bot.kind || 'text'}${status}`;
  }

  function renderArtifactSettings() {
    const root = document.getElementById('callArtifactSettings');
    if (!root) return;
    const bots = state.adminArtifactBots || [];
    const options = [
      `<option value="">${escapeHtml(t('Bot not selected'))}</option>`,
      ...bots.map((bot) => `<option value="${Number(bot.id || 0)}">${escapeHtml(botOptionLabel(bot))}</option>`),
    ].join('');
    root.innerHTML = (state.adminArtifacts || []).map((artifact) => {
      const key = artifact.artifact_key || artifact.key || '';
      const selected = Number(artifact.bot_id || 0);
      const warning = selected && bots.find((bot) => Number(bot.id || 0) === selected)
        ? ''
        : (selected ? `<div class="call-admin-hint error">${escapeHtml(t('Selected bot is unavailable'))}</div>` : '');
      return `
        <div class="call-artifact-row" data-call-artifact-key="${escapeHtml(key)}">
          <label class="call-artifact-enabled">
            <input type="checkbox" data-call-artifact-enabled ${artifact.enabled ? 'checked' : ''}>
            <span>${escapeHtml(artifact.label || key)}</span>
          </label>
          <select class="modal-input" data-call-artifact-bot>${options}</select>
          <select class="modal-input" data-call-artifact-output>
            <option value="text">text</option>
            <option value="json">json</option>
            <option value="image">image</option>
          </select>
          <button type="button" class="call-admin-btn" data-call-artifact-test>${escapeHtml(t('Test'))}</button>
          <div class="call-admin-hint">${escapeHtml(t('Recommended: {value}', { value: artifact.recommended || 'convert' }))}</div>
          ${warning}
        </div>
      `;
    }).join('') || `<div class="call-admin-hint">${escapeHtml(t('No call artifacts configured'))}</div>`;
    root.querySelectorAll('[data-call-artifact-key]').forEach((row) => {
      const key = row.dataset.callArtifactKey || '';
      const artifact = (state.adminArtifacts || []).find((item) => (item.artifact_key || item.key) === key) || {};
      const bot = row.querySelector('[data-call-artifact-bot]');
      if (bot) bot.value = artifact.bot_id ? String(artifact.bot_id) : '';
      const output = row.querySelector('[data-call-artifact-output]');
      if (output) output.value = artifact.output_type || 'text';
      row.querySelector('[data-call-artifact-test]')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        setAdminStatus(t('Testing...'));
        try {
          const data = await api(`/api/admin/call-artifacts/${encodeURIComponent(key)}/test`, { method: 'POST', body: {} });
          const text = String(data.result?.text || data.result?.fileId || 'ok').slice(0, 240);
          setAdminStatus(`${t('Success')}: ${text}`, 'success');
        } catch (error) {
          setAdminStatus(error.message || t('Artifact test failed'), 'error');
        } finally {
          button.disabled = false;
        }
      });
    });
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
      callDebugToggle: settings.call_debug_enabled,
      callAiNotesToggle: settings.call_ai_notes_enabled,
    };
    Object.entries(fields).forEach(([id, checked]) => {
      const input = document.getElementById(id);
      if (input) input.checked = !!checked;
    });
    const ring = document.getElementById('callRingTimeoutMs');
    if (ring) ring.value = Number(settings.ring_timeout_ms || 60000);
    const max = document.getElementById('callMaxParticipants');
    if (max) max.value = Number(settings.max_call_participants || 20);
    const recordingPath = document.getElementById('callRecordingPath');
    if (recordingPath) recordingPath.value = settings.call_recording_path || '/opt/livekit-egress/recordings';
    const recordingMode = document.getElementById('callRecordingMode');
    if (recordingMode) recordingMode.value = settings.call_recording_mode || 'mixed_participant';
    const transcriptionMode = document.getElementById('callTranscriptionMode');
    if (transcriptionMode) transcriptionMode.value = settings.call_transcription_mode || 'manual';
    const preset = document.getElementById('callTranscriptionPreset');
    if (preset) {
      const provider = settings.call_transcription_provider || 'voice';
      const strategy = settings.call_transcription_strategy || 'hybrid';
      preset.value = `${provider}:${strategy}`;
    }
    const maxChunk = document.getElementById('callTranscriptionMaxChunkMb');
    if (maxChunk) maxChunk.value = Number(settings.call_transcription_max_chunk_mb || 24);
    const chunkMinutes = document.getElementById('callTranscriptionChunkMinutes');
    if (chunkMinutes) chunkMinutes.value = Number(settings.call_transcription_chunk_minutes || 12);
    renderArtifactSettings();
  }

  function adminPayload() {
    const payload = {
      calls_enabled: document.getElementById('callEnabledToggle')?.checked || false,
      allow_private_calls: document.getElementById('callPrivateToggle')?.checked !== false,
      allow_group_calls: document.getElementById('callGroupToggle')?.checked !== false,
      screen_share_enabled: document.getElementById('callScreenShareToggle')?.checked !== false,
      ringtone_enabled: document.getElementById('callRingtoneToggle')?.checked !== false,
      call_messages_enabled: document.getElementById('callMessagesToggle')?.checked !== false,
      call_debug_enabled: document.getElementById('callDebugToggle')?.checked === true,
      call_ai_notes_enabled: document.getElementById('callAiNotesToggle')?.checked === true,
      call_recording_path: document.getElementById('callRecordingPath')?.value || '',
      call_recording_mode: document.getElementById('callRecordingMode')?.value || 'mixed_participant',
      call_transcription_mode: document.getElementById('callTranscriptionMode')?.value || 'manual',
      call_transcription_provider: String(document.getElementById('callTranscriptionPreset')?.value || 'voice:hybrid').split(':')[0] || 'voice',
      call_transcription_strategy: String(document.getElementById('callTranscriptionPreset')?.value || 'voice:hybrid').split(':')[1] || 'hybrid',
      call_transcription_max_chunk_mb: Number(document.getElementById('callTranscriptionMaxChunkMb')?.value || 24),
      call_transcription_chunk_minutes: Number(document.getElementById('callTranscriptionChunkMinutes')?.value || 12),
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
      const artifacts = Array.from(document.querySelectorAll('[data-call-artifact-key]')).map((row) => ({
        artifact_key: row.dataset.callArtifactKey || '',
        enabled: row.querySelector('[data-call-artifact-enabled]')?.checked === true,
        bot_id: Number(row.querySelector('[data-call-artifact-bot]')?.value || 0) || null,
        output_type: row.querySelector('[data-call-artifact-output]')?.value || 'text',
      }));
      const data = await api('/api/admin/call-settings', { method: 'PUT', body: adminPayload() });
      const artifactData = await api('/api/admin/call-artifacts', { method: 'PUT', body: { artifacts } })
        .catch(() => ({ artifacts: state.adminArtifacts, bots: state.adminArtifactBots }));
      state.adminSettings = data.settings || state.adminSettings;
      state.adminArtifacts = Array.isArray(artifactData.artifacts) ? artifactData.artifacts : state.adminArtifacts;
      state.adminArtifactBots = Array.isArray(artifactData.bots) ? artifactData.bots : state.adminArtifactBots;
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
      const extra = [];
      extra.push(data.egress_ready ? t('Egress ready') : (data.egress_error ? `${t('Egress not ready')}: ${data.egress_error}` : ''));
      extra.push(data.recording_path_ready ? t('Recording path ready') : (data.recording_path_error ? `${t('Recording path error')}: ${data.recording_path_error}` : ''));
      const ok = data.ok && data.egress_ready && data.recording_path_ready;
      setAdminStatus(data.ok ? [t('LiveKit test passed'), ...extra.filter(Boolean)].join(' / ') : t('LiveKit test failed'), ok ? 'success' : 'error');
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
      else {
        const updatedCall = normalizeClientCall({ ...(state.currentCall?.id === msg.call.id ? state.currentCall : {}), ...msg.call }, {
          forceVoice: state.currentCall?.id === msg.call.id && isVoiceCall(state.currentCall),
          roomMode: state.currentCall?.id === msg.call.id ? callRoomMode(state.currentCall) : undefined,
        });
        upsertCall(updatedCall);
        if (state.currentCall?.id === msg.call.id) state.currentCall = updatedCall;
        if (msg.type === 'call_ai_notes_updated') {
          notifyLocalMicrophoneTrackForAiNotes().catch(() => {});
        }
      }
    }
    if (msg.type === 'call_invite' && msg.call && Number(msg.call.started_by) !== Number(currentUser()?.id || 0)) {
      state.incomingCall = msg.call;
      NOTIFICATIONS.startRingtone?.(state.settings.ringtone_enabled);
      NOTIFICATIONS.notifyIncoming?.(
        isVoiceCall(msg.call) ? t('Incoming voice call') : t('Incoming call'),
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

  hooks.openPrejoin = (call, options = {}) => openPrejoin(call, options);
  hooks.joinCallFromMessage = (call) => {
    if (call?.id && isCurrentCall(call) && state.room) return revealCurrentCallSurface();
    return isVoiceCall(call) ? joinVoiceCallDirectly(call) : openPrejoin(call);
  };
  hooks.isCurrentCall = (callId) => Boolean(Number(callId || 0) && state.room && Number(state.currentCall?.id || 0) === Number(callId || 0));
  hooks.openTranscript = (callId) => openTranscript(callId);
  hooks.openTranscriptRun = (runId) => openTranscript(0, runId);
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
