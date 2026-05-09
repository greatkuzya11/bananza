(function () {
  'use strict';

  const hooks = window.BananzaCallHooks = window.BananzaCallHooks || {};
  const VIDEO_ICON = String.fromCodePoint(0x1F4F9);
  const PHONE_ICON = String.fromCodePoint(0x260E);

  const state = {
    ready: false,
    uiReady: false,
    settings: {
      calls_enabled: false,
      livekit_ready: false,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
    },
    activeCalls: new Map(),
    incomingCall: null,
    currentCall: null,
    room: null,
    livekitLoadPromise: null,
    joining: false,
    micEnabled: true,
    cameraEnabled: true,
    minimized: false,
    adminLoaded: false,
    adminSettings: null,
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

  function api(url, opts) {
    const call = bridge()?.api;
    if (!call) return Promise.reject(new Error(t('App is not ready')));
    return call(url, opts);
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
    if (state.incomingCall?.id === call?.id) state.incomingCall = null;
    if (state.currentCall?.id === call?.id) state.currentCall = { ...state.currentCall, ...call, status: 'ended' };
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
      btn.addEventListener('click', () => startCall().catch((error) => setSurfaceStatus(error.message || t('Could not start call'))));
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
        if (call) joinCall(call).catch((error) => setSurfaceStatus(error.message || t('Could not join call')));
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
        if (state.incomingCall) joinCall(state.incomingCall).catch((error) => setSurfaceStatus(error.message || t('Could not join call')));
      });
      document.getElementById('callDeclineBtn')?.addEventListener('click', () => {
        if (state.incomingCall) declineCall(state.incomingCall).catch(() => {});
      });
      applyLocalized(incoming);
    }

    if (!document.getElementById('callSurface')) {
      const surface = document.createElement('div');
      surface.id = 'callSurface';
      surface.className = 'call-surface hidden';
      surface.innerHTML = `
        <div class="call-surface-head">
          <div>
            <div class="call-surface-title" id="callSurfaceTitle">${escapeHtml(t('Video call'))}</div>
            <div class="call-surface-status" id="callSurfaceStatus"></div>
          </div>
          <div class="call-inline-actions">
            <button type="button" id="callMinimizeBtn" class="call-control-btn" title="${escapeHtml(t('Minimize'))}" aria-label="${escapeHtml(t('Minimize'))}">_</button>
          </div>
        </div>
        <div id="callGrid" class="call-grid"></div>
        <div class="call-controls">
          <button type="button" id="callMicBtn" class="call-control-btn">${escapeHtml(t('Mic'))}</button>
          <button type="button" id="callCameraBtn" class="call-control-btn">${escapeHtml(t('Camera'))}</button>
          <button type="button" id="callLeaveBtn" class="call-control-btn danger">${escapeHtml(t('Leave'))}</button>
          <button type="button" id="callEndBtn" class="call-control-btn danger">${escapeHtml(t('End for everyone'))}</button>
        </div>
      `;
      document.body.appendChild(surface);
      document.getElementById('callMinimizeBtn')?.addEventListener('click', toggleMinimized);
      document.getElementById('callMicBtn')?.addEventListener('click', toggleMic);
      document.getElementById('callCameraBtn')?.addEventListener('click', toggleCamera);
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
            <div class="field-group">
              <label>${escapeHtml(t('Ring timeout, ms'))}</label>
              <input type="number" id="callRingTimeoutMs" class="modal-input" min="10000" max="300000" step="1000">
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
  }

  function renderAdminEntry() {
    const btn = document.getElementById('settingsCallPanel');
    if (!btn) return;
    btn.classList.toggle('hidden', !currentUser()?.is_admin);
  }

  async function refreshPublicFeatures() {
    const data = await api('/api/features');
    state.settings = {
      ...state.settings,
      ...data,
      calls_enabled: Boolean(data.calls_enabled),
      livekit_ready: Boolean(data.livekit_ready),
    };
    if (!state.settings.calls_enabled) {
      state.activeCalls.clear();
      state.incomingCall = null;
      if (state.room) await disconnectRoom();
    }
    renderAll();
    return state.settings;
  }

  async function loadActiveCalls() {
    const data = await api('/api/calls/active');
    if (data.settings) {
      state.settings = {
        ...state.settings,
        ...data.settings,
        calls_enabled: Boolean(data.settings.calls_enabled),
        livekit_ready: Boolean(data.settings.livekit_ready),
      };
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
      await joinCall(data.call);
    }
  }

  async function declineCall(call) {
    if (!call?.id) return;
    await api(`/api/calls/${call.id}/decline`, { method: 'POST', body: {} }).catch(() => {});
    if (state.incomingCall?.id === call.id) state.incomingCall = null;
    renderAll();
  }

  async function joinCall(call) {
    if (!call?.id || state.joining) return;
    state.joining = true;
    state.incomingCall = null;
    showSurface(call);
    setSurfaceStatus(t('Joining call...'));
    try {
      const data = await api(`/api/calls/${call.id}/token`, { method: 'POST', body: {} });
      const nextCall = data.call || call;
      upsertCall(nextCall);
      state.currentCall = nextCall;
      await connectRoom(data.livekit?.url, data.livekit?.token);
      setSurfaceStatus(t('Connected'));
    } finally {
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

  async function connectRoom(url, token) {
    if (!url || !token) throw new Error(t('LiveKit token is missing'));
    const LK = await ensureLiveKitClient();
    await disconnectRoom();
    const room = new LK.Room({ adaptiveStream: true, dynacast: true });
    state.room = room;
    const events = LK.RoomEvent || {};
    room.on?.(events.TrackSubscribed || 'trackSubscribed', (track) => {
      attachSubscribedTrack(track);
      renderRoomTiles();
    });
    room.on?.(events.TrackUnsubscribed || 'trackUnsubscribed', (track) => {
      detachTrack(track);
      renderRoomTiles();
    });
    room.on?.(events.ParticipantConnected || 'participantConnected', renderRoomTiles);
    room.on?.(events.ParticipantDisconnected || 'participantDisconnected', renderRoomTiles);
    room.on?.(events.LocalTrackPublished || 'localTrackPublished', renderRoomTiles);
    room.on?.(events.LocalTrackUnpublished || 'localTrackUnpublished', renderRoomTiles);
    room.on?.(events.Disconnected || 'disconnected', () => {
      state.room = null;
      setSurfaceStatus(t('Disconnected'));
      renderRoomTiles();
    });
    await room.connect(url, token);
    await room.localParticipant?.setMicrophoneEnabled?.(true).catch(() => {
      state.micEnabled = false;
      setSurfaceStatus(t('Microphone unavailable'));
    });
    await room.localParticipant?.setCameraEnabled?.(true).catch(() => {
      state.cameraEnabled = false;
      setSurfaceStatus(t('Camera unavailable'));
    });
    renderRoomTiles();
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
      }
    }
  }

  function detachTrack(track) {
    try {
      track?.detach?.().forEach((el) => el.remove());
    } catch {}
    document.querySelectorAll('[data-call-remote-audio="1"]').forEach((el) => el.remove());
  }

  async function disconnectRoom() {
    const room = state.room;
    state.room = null;
    try {
      room?.disconnect?.();
    } catch {}
    document.querySelectorAll('[data-call-remote-audio="1"]').forEach((el) => el.remove());
  }

  async function toggleMic() {
    state.micEnabled = !state.micEnabled;
    await state.room?.localParticipant?.setMicrophoneEnabled?.(state.micEnabled).catch(() => {
      state.micEnabled = !state.micEnabled;
    });
    renderSurfaceControls();
  }

  async function toggleCamera() {
    state.cameraEnabled = !state.cameraEnabled;
    await state.room?.localParticipant?.setCameraEnabled?.(state.cameraEnabled).catch(() => {
      state.cameraEnabled = !state.cameraEnabled;
    });
    renderSurfaceControls();
    renderRoomTiles();
  }

  function toggleMinimized() {
    state.minimized = !state.minimized;
    const surface = document.getElementById('callSurface');
    surface?.classList.toggle('is-minimized', state.minimized);
  }

  async function leaveCall(endForEveryone) {
    const call = state.currentCall;
    await disconnectRoom();
    if (call?.id) {
      await api(`/api/calls/${call.id}/${endForEveryone ? 'end' : 'leave'}`, { method: 'POST', body: {} }).catch(() => {});
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
      empty.innerHTML = `<div class="call-tile-placeholder">${escapeHtml(initials(currentUser()?.display_name || 'Me'))}</div><div class="call-tile-name">${escapeHtml(t('Waiting'))}</div>`;
      grid.appendChild(empty);
      return;
    }
    participants.forEach(({ participant, local }) => {
      const tile = document.createElement('div');
      tile.className = 'call-tile';
      const name = getParticipantName(participant, local ? t('You') : t('Participant'));
      const track = firstVideoTrack(participant);
      if (track?.attach) {
        try {
          const video = track.attach();
          video.autoplay = true;
          video.playsInline = true;
          video.muted = Boolean(local);
          tile.appendChild(video);
        } catch {
          tile.innerHTML = `<div class="call-tile-placeholder">${escapeHtml(initials(name))}</div>`;
        }
      } else {
        tile.innerHTML = `<div class="call-tile-placeholder">${escapeHtml(initials(name))}</div>`;
      }
      const label = document.createElement('div');
      label.className = 'call-tile-name';
      label.textContent = local ? `${name} (${t('you')})` : name;
      tile.appendChild(label);
      grid.appendChild(tile);
    });
  }

  function renderSurface() {
    const surface = document.getElementById('callSurface');
    if (!surface || !state.currentCall) return;
    surface.classList.toggle('is-minimized', state.minimized);
    document.getElementById('callSurfaceTitle').textContent = state.currentCall.chat_name || t('Video call');
    renderSurfaceControls();
    renderRoomTiles();
  }

  function renderSurfaceControls() {
    const mic = document.getElementById('callMicBtn');
    const camera = document.getElementById('callCameraBtn');
    if (mic) {
      mic.textContent = state.micEnabled ? t('Mic') : t('Mic off');
      mic.classList.toggle('is-off', !state.micEnabled);
    }
    if (camera) {
      camera.textContent = state.cameraEnabled ? t('Camera') : t('Camera off');
      camera.classList.toggle('is-off', !state.cameraEnabled);
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
    };
    Object.entries(fields).forEach(([id, checked]) => {
      const input = document.getElementById(id);
      if (input) input.checked = !!checked;
    });
    const ring = document.getElementById('callRingTimeoutMs');
    if (ring) ring.value = Number(settings.ring_timeout_ms || 60000);
  }

  function adminPayload() {
    const payload = {
      calls_enabled: document.getElementById('callEnabledToggle')?.checked || false,
      allow_private_calls: document.getElementById('callPrivateToggle')?.checked !== false,
      allow_group_calls: document.getElementById('callGroupToggle')?.checked !== false,
      ring_timeout_ms: Number(document.getElementById('callRingTimeoutMs')?.value || 60000),
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
        state.settings = {
          ...state.settings,
          ...data.publicSettings,
          calls_enabled: Boolean(data.publicSettings.calls_enabled),
          livekit_ready: Boolean(data.publicSettings.livekit_ready),
        };
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
      state.settings = {
        ...state.settings,
        ...(msg.settings || {}),
        calls_enabled: Boolean(msg.settings?.calls_enabled),
        livekit_ready: Boolean(msg.settings?.livekit_ready),
      };
      if (!state.settings.calls_enabled) {
        state.incomingCall = null;
        state.activeCalls.clear();
        if (state.currentCall) leaveCall(false).catch(() => {});
      }
      renderAll();
      return;
    }
    if (msg.call) {
      if (msg.type === 'call_ended') removeCall(msg.call);
      else upsertCall(msg.call);
    }
    if (msg.type === 'call_invite' && msg.call && Number(msg.call.started_by) !== Number(currentUser()?.id || 0)) {
      state.incomingCall = msg.call;
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

  async function bootstrap() {
    ensureUi();
    await refreshPublicFeatures().catch(() => {});
    await loadActiveCalls().catch(() => {});
    state.ready = true;
    renderAll();
  }

  window.addEventListener('bananza:ready', bootstrap);
})();
