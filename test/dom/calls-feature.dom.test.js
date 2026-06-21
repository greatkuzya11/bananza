const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  loadBrowserScript,
} = require('../support/domHarness');

function waitForMs(window, ms = 0) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForCondition(window, predicate, { attempts = 30 } = {}) {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) return;
    await waitForMs(window, 0);
  }
  throw new Error('Timed out waiting for condition');
}

function dispatchPointer(window, target, type, init = {}) {
  const event = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: init.button ?? 0,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
  });
  Object.defineProperties(event, {
    pointerId: { configurable: true, value: init.pointerId ?? 1 },
    pointerType: { configurable: true, value: init.pointerType || 'mouse' },
    isPrimary: { configurable: true, value: true },
  });
  target.dispatchEvent(event);
  return event;
}

function installCallBridge(dom, state) {
  const { document, window } = dom.window;
  state.requests = [];
  state.viewportRecoveries = [];
  state.openedChats = [];
  state.chats = Array.isArray(state.chats) && state.chats.length ? state.chats : [state.chat];
  const chatById = (chatId) => state.chats.find((chat) => Number(chat.id || 0) === Number(chatId || 0)) || null;
  const setCurrentChat = (chatId) => {
    const chat = chatById(chatId) || state.chat;
    state.currentChat = chat;
    state.currentChatId = Number(chat?.id || chatId || 0) || state.chat.id;
    return chat;
  };
  setCurrentChat(state.currentChatId || state.currentChat?.id || state.chat.id);
  window.BananzaAppBridge = {
    api: async (url, opts = {}) => {
      state.requests.push({ url, opts });
      if (url === '/api/features') return state.features;
      if (url === '/api/calls/active') return { settings: state.features, calls: state.activeCalls || [] };
      if (/^\/api\/chats\/\d+\/calls\/active$/.test(url)) {
        const chatId = Number(url.match(/^\/api\/chats\/(\d+)\/calls\/active$/)?.[1] || 0);
        const call = Number(state.chatCall?.chat_id || state.chatCall?.chatId || 0) === chatId ? state.chatCall : null;
        return { call };
      }
      if (/^\/api\/chats\/\d+\/calls$/.test(url) && opts.method === 'POST') {
        const chatId = Number(url.match(/^\/api\/chats\/(\d+)\/calls$/)?.[1] || 0);
        const chat = chatById(chatId) || state.chat;
        state.startedCallPayload = opts.body || {};
        const mediaKind = state.startedCallPayload.media_kind || 'video';
        const roomMode = mediaKind === 'voice' && chat.type === 'group' ? 'room' : 'ringing';
        state.chatCall = state.createdCall || {
          id: 120,
          chat_id: chat.id,
          chat_name: chat.name,
          media_kind: mediaKind,
          room_mode: roomMode,
          participant_count: 0,
          started_by: state.user.id,
          status: 'active',
          participants: [
            { user_id: state.user.id, display_name: state.user.display_name, username: 'alice', state: 'invited' },
          ],
        };
        return { call: state.chatCall };
      }
      if (url === `/api/calls/${state.chatCall?.id}/token`) {
        return { call: state.chatCall, livekit: { url: 'ws://livekit.test', token: 'test-token' } };
      }
      if (url === `/api/calls/${state.chatCall?.id}/joined`) {
        state.chatCall = {
          ...state.chatCall,
          participants: (state.chatCall?.participants || []).map((participant) => (
            Number(participant.user_id) === Number(state.user.id)
              ? { ...participant, state: 'joined' }
              : participant
          )),
        };
        if (state.joinedResponseDropsCallKind) {
          const { media_kind, mediaKind, room_mode, roomMode, ...rest } = state.chatCall;
          return { call: rest };
        }
        return { call: state.chatCall };
      }
      if (url === `/api/calls/${state.chatCall?.id}/external-link`) {
        state.externalLinkRequests = (state.externalLinkRequests || 0) + 1;
        return { external_url: state.externalUrl || `https://example.test/call/${state.chatCall.id}` };
      }
      if (url === '/api/admin/call-settings' && !opts.method) return state.adminCallSettings;
      if (url === '/api/admin/call-settings' && opts.method === 'PUT') {
        state.savedAdminPayload = opts.body || {};
        state.adminCallSettings = {
          ...state.adminCallSettings,
          settings: {
            ...state.adminCallSettings.settings,
            calls_enabled: !!state.savedAdminPayload.calls_enabled,
            allow_private_calls: state.savedAdminPayload.allow_private_calls !== false,
            allow_group_calls: state.savedAdminPayload.allow_group_calls !== false,
            ring_timeout_ms: Number(state.savedAdminPayload.ring_timeout_ms || 60000),
            screen_share_enabled: state.savedAdminPayload.screen_share_enabled !== false,
            ringtone_enabled: state.savedAdminPayload.ringtone_enabled !== false,
            call_messages_enabled: state.savedAdminPayload.call_messages_enabled !== false,
            max_call_participants: Number(state.savedAdminPayload.max_call_participants || 20),
          },
          livekit_ready: true,
          livekit_config: {
            ...state.adminCallSettings.livekit_config,
            ws_url: state.savedAdminPayload.livekit_ws_url || '',
            effective_ws_url: state.savedAdminPayload.livekit_ws_url || '',
            masked_api_key: state.savedAdminPayload.livekit_api_key ? 'new...-key' : state.adminCallSettings.livekit_config.masked_api_key,
            masked_api_secret: state.savedAdminPayload.livekit_api_secret ? 'new...cret' : state.adminCallSettings.livekit_config.masked_api_secret,
            source: 'admin',
          },
          publicSettings: { ...state.features, calls_enabled: true, livekit_ready: true },
        };
        return state.adminCallSettings;
      }
      if (url.endsWith('/end')) {
        const endedCallId = Number(String(url).match(/\/api\/calls\/(\d+)\/end$/)?.[1] || 0);
        state.endedCallId = endedCallId;
        const endedCall = {
          ...(state.chatCall || {}),
          id: endedCallId || state.chatCall?.id,
          chat_id: state.chatCall?.chat_id || state.chat.id,
          status: 'ended',
        };
        if (Number(state.chatCall?.id || 0) === Number(endedCall.id || 0)) state.chatCall = endedCall;
        state.activeCalls = (state.activeCalls || []).filter((call) => Number(call.id || 0) !== Number(endedCall.id || 0));
        return { call: endedCall };
      }
      if (url.endsWith('/decline') || url.endsWith('/leave')) return { ok: true };
      throw new Error(`Unexpected call feature request: ${url}`);
    },
    applyLocalizedDom: () => {},
    closeManagedModal: (id) => document.getElementById(id)?.classList.add('hidden'),
    getCurrentChat: () => state.currentChat || state.chat,
    getCurrentChatId: () => state.currentChatId || state.chat.id,
    getCurrentUser: () => state.user,
    openChat: async (chatId, options = {}) => {
      state.openedChats.push({ method: 'openChat', chatId: Number(chatId || 0), options });
      setCurrentChat(chatId);
    },
    openChatFromPush: async (chatId) => {
      state.openedChats.push({ method: 'openChatFromPush', chatId: Number(chatId || 0) });
      setCurrentChat(chatId);
    },
    openManagedModal: (id) => document.getElementById(id)?.classList.remove('hidden'),
    registerManagedModal: () => {},
    recoverChatViewportLayout: (options = {}) => {
      state.viewportRecoveries.push(options);
    },
    showToast: (message) => {
      state.toasts = [...(state.toasts || []), message];
    },
    t: (key, params = {}) => window.BananzaI18n?.t?.(key, params) || key,
  };
}

async function bootCallFeature(state) {
  const dom = createAppDom();
  if (state.layoutMode) dom.window.localStorage.setItem('bananza.call.layoutMode.v1', state.layoutMode);
  installCallBridge(dom, state);
  loadBrowserScript(dom, 'public/js/i18n.js');
  loadBrowserScript(dom, 'public/js/calls/CallStore.js');
  loadBrowserScript(dom, 'public/js/calls/CallMedia.js');
  loadBrowserScript(dom, 'public/js/calls/CallNotifications.js');
  loadBrowserScript(dom, 'public/js/calls/CallFeature.js');
  dom.window.dispatchEvent(new dom.window.Event('bananza:ready'));
  await waitForCondition(dom.window, () => state.requests.some((request) => request.url === '/api/calls/active'));
  return dom;
}

async function bootExternalCallFeature(state) {
  const dom = createAppDom();
  const { window } = dom;
  if (state.layoutMode) window.localStorage.setItem('bananza.call.layoutMode.v1', state.layoutMode);
  state.requests = [];
  state.viewportRecoveries = [];
  window.BananzaExternalCall = { inviteToken: state.inviteToken || 'external-token' };
  window.BananzaAppBridge = {
    api: async (url, opts = {}) => {
      state.requests.push({ url, opts });
      if (url === `/api/calls/external/${state.inviteToken || 'external-token'}`) {
        return { settings: state.features, ended: false, call: state.externalCall };
      }
      if (url === `/api/calls/external/${state.inviteToken || 'external-token'}/token`) {
        state.tokenPayload = opts.body || {};
        state.externalGuest = { guest_id: 'guest123456789', display_name: state.tokenPayload.display_name, session_token: 'session-token' };
        state.externalCall = {
          ...state.externalCall,
          participants: [{ guest_id: state.externalGuest.guest_id, display_name: state.externalGuest.display_name, state: 'invited', is_guest: 1 }],
        };
        return { call: state.externalCall, guest: state.externalGuest, livekit: { url: 'ws://livekit.test', token: 'guest-token' } };
      }
      if (url === `/api/calls/external/${state.inviteToken || 'external-token'}/joined`) {
        state.joinedPayload = opts.body || {};
        state.externalCall = {
          ...state.externalCall,
          participant_count: 1,
          participants: (state.externalCall.participants || []).map((participant) => ({ ...participant, state: 'joined' })),
        };
        return { call: state.externalCall };
      }
      if (url === `/api/calls/external/${state.inviteToken || 'external-token'}/leave`) {
        state.leftPayload = opts.body || {};
        return { call: state.externalCall };
      }
      throw new Error(`Unexpected external call feature request: ${url}`);
    },
    applyLocalizedDom: () => {},
    getCurrentChat: () => null,
    getCurrentChatId: () => 0,
    getCurrentUser: () => null,
    refreshCallIndicators: () => {},
    recoverChatViewportLayout: (options = {}) => {
      state.viewportRecoveries.push(options);
    },
    syncChatHeaderActions: () => {},
    t: (key, params = {}) => window.BananzaI18n?.t?.(key, params) || key,
  };
  loadBrowserScript(dom, 'public/js/i18n.js');
  loadBrowserScript(dom, 'public/js/calls/CallStore.js');
  loadBrowserScript(dom, 'public/js/calls/CallMedia.js');
  loadBrowserScript(dom, 'public/js/calls/CallNotifications.js');
  loadBrowserScript(dom, 'public/js/calls/CallFeature.js');
  await waitForCondition(window, () => state.requests.some((request) => request.url === `/api/calls/external/${state.inviteToken || 'external-token'}`));
  return dom;
}

function defaultState(overrides = {}) {
  return {
    user: { id: 1, display_name: 'Alice', is_admin: 1 },
    chat: {
      id: 41,
      type: 'private',
      name: 'Bob',
      is_notes: 0,
      private_user: { id: 2, display_name: 'Bob', is_ai_bot: 0 },
    },
    features: {
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
    activeCalls: [],
    chatCall: null,
    adminCallSettings: {
      settings: {
        calls_enabled: false,
        allow_private_calls: true,
        allow_group_calls: true,
        ring_timeout_ms: 60000,
        screen_share_enabled: true,
        ringtone_enabled: true,
        call_messages_enabled: true,
        max_call_participants: 20,
      },
      livekit_ready: false,
      livekit_ws_url_present: false,
      livekit_config: {
        ws_url: '',
        effective_ws_url: '',
        masked_api_key: '',
        masked_api_secret: '',
        source: '',
      },
    },
    ...overrides,
  };
}

function defaultExternalState(overrides = {}) {
  return {
    inviteToken: 'external-token',
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
      screen_share_enabled: true,
      ringtone_enabled: true,
      call_messages_enabled: true,
      max_call_participants: 20,
    },
    externalCall: {
      id: 310,
      title: 'External demo',
      status: 'active',
      media_kind: 'video',
      room_mode: 'ringing',
      started_at: new Date(Date.now() - 5000).toISOString(),
      participants: [],
      participant_count: 0,
      can_join: true,
      can_screen_share: true,
    },
    ...overrides,
  };
}

function setVideoIntrinsicSize(video, width, height) {
  Object.defineProperty(video, 'videoWidth', {
    configurable: true,
    get: () => width,
  });
  Object.defineProperty(video, 'videoHeight', {
    configurable: true,
    get: () => height,
  });
}

function createMockVideoTrack(window, { width, height }) {
  let attachCount = 0;
  const track = {
    kind: 'video',
    source: 'camera',
    dimensions: { width, height },
    mediaStreamTrack: {
      kind: 'video',
      enabled: true,
      muted: false,
      readyState: 'live',
      getSettings: () => ({ width, height }),
    },
    get attachCount() {
      return attachCount;
    },
    attach(element = null) {
      attachCount += 1;
      const video = element || window.document.createElement('video');
      setVideoIntrinsicSize(video, width, height);
      video.play = () => Promise.resolve();
      return video;
    },
    detach(element = null) {
      if (element) return element;
      return [];
    },
  };
  return track;
}

function createMockParticipant(window, { identity, name, video = null, isLocal = false }) {
  const publications = new Map();
  if (video) {
    const pendingTrack = createMockVideoTrack(window, video);
    const track = video.subscribed === false ? null : pendingTrack;
    publications.set('camera', {
      kind: 'video',
      source: 'camera',
      track,
      pendingTrack,
      isMuted: false,
      muted: false,
      isEnabled: video.enabled !== false,
      isSubscribed: video.subscribed !== false,
      setEnabledCalls: 0,
      setSubscribedCalls: 0,
      setEnabled(enabled) {
        this.setEnabledCalls += 1;
        this.isEnabled = enabled;
      },
      setSubscribed(subscribed) {
        this.setSubscribedCalls += 1;
        this.isSubscribed = subscribed;
        if (subscribed && video.attachOnSubscribe) this.track = pendingTrack;
      },
    });
  }
  return {
    identity,
    name,
    isLocal,
    isSpeaking: false,
    videoTrackPublications: publications,
    audioTrackPublications: new Map(),
    trackPublications: publications,
    setCameraEnabled: async () => {},
    setMicrophoneEnabled: async () => {},
  };
}

function installMockLiveKitRoom(dom, { localVideo = null, remoteVideos = [] } = {}) {
  const { window } = dom;
  let connected = false;
  let disconnected = false;
  let roomInstance = null;
  const handlers = new Map();
  window.LivekitClient = {
    Room: class {
      constructor() {
        this.localParticipant = createMockParticipant(window, {
          identity: 'user:1',
          name: 'Alice',
          video: localVideo,
          isLocal: true,
        });
        this.remoteParticipants = new Map(remoteVideos.map((remote) => [
          remote.identity,
          createMockParticipant(window, {
            identity: remote.identity,
            name: remote.name,
            video: remote.video,
          }),
        ]));
        roomInstance = this;
      }

      on(event, callback) {
        handlers.set(event, callback);
        return this;
      }

      async connect() {
        connected = true;
      }

      disconnect() {
        disconnected = true;
      }
    },
    RoomEvent: { ActiveSpeakersChanged: 'activeSpeakersChanged' },
    Track: { Source: { Camera: 'camera', Microphone: 'microphone' } },
  };
  return {
    emit: (event, ...args) => handlers.get(event)?.(...args),
    getLocalParticipant: () => roomInstance?.localParticipant || null,
    getRemoteParticipant: (identity) => roomInstance?.remoteParticipants?.get(identity) || null,
    isConnected: () => connected,
    isDisconnected: () => disconnected,
  };
}

test('CallFeature hides the header button until calls and LiveKit are enabled', async (t) => {
  const state = defaultState();
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());

  const { document, BananzaCallHooks } = dom.window;
  const btn = document.getElementById('callStartBtn');
  const voiceBtn = document.getElementById('callVoiceStartBtn');
  assert.ok(btn);
  assert.ok(voiceBtn);
  assert.equal(btn.textContent, String.fromCodePoint(0x1F4F9));
  assert.equal(voiceBtn.textContent, String.fromCodePoint(0x260E, 0xFE0F));
  assert.equal(btn.parentElement?.id, 'chatHeaderActions');
  assert.equal(btn.classList.contains('hidden'), true);
  assert.equal(voiceBtn.classList.contains('hidden'), true);

  state.features = { ...state.features, calls_enabled: true, livekit_ready: true };
  BananzaCallHooks.handleWSMessage({ type: 'call_settings_updated', settings: state.features });
  BananzaCallHooks.onChatChanged();
  await waitForCondition(dom.window, () => !btn.classList.contains('hidden'));
  assert.equal(voiceBtn.classList.contains('hidden'), false);

  state.features = { ...state.features, livekit_ready: false };
  BananzaCallHooks.handleWSMessage({ type: 'call_settings_updated', settings: state.features });
  assert.equal(btn.classList.contains('hidden'), true);
  assert.equal(voiceBtn.classList.contains('hidden'), true);
});

test('CallFeature shows and declines incoming call overlay', async (t) => {
  const state = defaultState({
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
    },
  });
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());

  const call = {
    id: 91,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    started_by: 2,
    started_by_name: 'Bob',
    status: 'active',
  };
  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_invite', call });

  const incoming = dom.window.document.getElementById('callIncoming');
  assert.equal(incoming.classList.contains('hidden'), false);
  assert.match(dom.window.document.getElementById('callIncomingMeta').textContent, /Bob/);

  dom.window.document.getElementById('callDeclineBtn').click();
  await waitForCondition(dom.window, () => state.requests.some((request) => request.url === '/api/calls/91/decline'));
  await waitForCondition(dom.window, () => incoming.classList.contains('hidden'));
  assert.equal(incoming.classList.contains('hidden'), true);
});

test('CallFeature opens the host chat before accepting an incoming video call', async (t) => {
  const callChat = {
    id: 52,
    type: 'private',
    name: 'Carol',
    is_notes: 0,
    private_user: { id: 3, display_name: 'Carol', is_ai_bot: 0 },
  };
  const state = defaultState({
    chats: [
      defaultState().chat,
      callChat,
    ],
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
    },
  });
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());

  const call = {
    id: 191,
    chat_id: callChat.id,
    chat_name: callChat.name,
    media_kind: 'video',
    room_mode: 'ringing',
    started_by: 3,
    started_by_name: 'Carol',
    status: 'active',
  };
  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_invite', call });
  dom.window.document.getElementById('callAcceptBtn').click();

  await waitForCondition(dom.window, () => state.openedChats.length > 0);
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));

  assert.deepEqual(state.openedChats[0], { method: 'openChatFromPush', chatId: callChat.id });
  assert.equal(state.currentChatId, callChat.id);
  assert.equal(dom.window.document.getElementById('callPrejoinTitle').textContent, callChat.name);
});

test('CallFeature opens the host chat before accepting an incoming voice call', async (t) => {
  const callChat = {
    id: 53,
    type: 'private',
    name: 'Dima',
    is_notes: 0,
    private_user: { id: 4, display_name: 'Dima', is_ai_bot: 0 },
  };
  const call = {
    id: 192,
    chat_id: callChat.id,
    chat_name: callChat.name,
    media_kind: 'voice',
    room_mode: 'ringing',
    participant_count: 1,
    started_by: 4,
    started_by_name: 'Dima',
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'invited' },
      { user_id: 4, display_name: 'Dima', username: 'dima', state: 'joined' },
    ],
  };
  const state = defaultState({
    chats: [
      defaultState().chat,
      callChat,
    ],
    chatCall: call,
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
    },
  });
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());
  const roomState = installMockLiveKitRoom(dom);

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_invite', call });
  dom.window.document.getElementById('callAcceptBtn').click();

  await waitForCondition(dom.window, () => state.openedChats.length > 0);
  await waitForCondition(dom.window, () => roomState.isConnected());
  await waitForCondition(dom.window, () => state.requests.some((request) => request.url === '/api/calls/192/joined'));

  assert.deepEqual(state.openedChats[0], { method: 'openChatFromPush', chatId: callChat.id });
  assert.equal(state.currentChatId, callChat.id);
  assert.equal(dom.window.document.getElementById('callSurface').classList.contains('hidden'), false);
  assert.ok(state.viewportRecoveries.some((item) => item.reason === 'call_prejoin_open'));
});

test('CallFeature lets the call initiator end a call from video prejoin', async (t) => {
  const state = defaultState({
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
    },
  });
  state.chatCall = {
    id: 95,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    participant_count: 1,
    started_by: state.user.id,
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'invited' },
    ],
  };
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: state.chatCall });
  assert.equal(dom.window.document.getElementById('callBanner').classList.contains('hidden'), false);
  dom.window.document.getElementById('callBannerJoin').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  assert.equal(dom.window.document.getElementById('callBanner').classList.contains('hidden'), true);

  const endBtn = dom.window.document.getElementById('callPrejoinEndBtn');
  assert.equal(endBtn.classList.contains('hidden'), false);
  assert.equal(endBtn.textContent.trim(), dom.window.BananzaI18n.t('End'));
  endBtn.click();

  await waitForCondition(dom.window, () => state.requests.some((request) => request.url === '/api/calls/95/end'));
  await waitForCondition(dom.window, () => dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  assert.equal(state.endedCallId, 95);
});

test('CallFeature hides prejoin end button for non-initiators and device selection mode', async (t) => {
  const state = defaultState({
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
    },
  });
  state.chatCall = {
    id: 96,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    participant_count: 1,
    started_by: 2,
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'invited' },
      { user_id: 2, display_name: 'Bob', username: 'bob', state: 'joined' },
    ],
  };
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: state.chatCall });
  assert.equal(dom.window.document.getElementById('callBanner').classList.contains('hidden'), false);
  dom.window.document.getElementById('callBannerJoin').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  assert.equal(dom.window.document.getElementById('callBanner').classList.contains('hidden'), true);
  assert.equal(dom.window.document.getElementById('callPrejoinEndBtn').classList.contains('hidden'), true);

  dom.window.document.getElementById('callPrejoinCancelBtn').click();
  assert.equal(dom.window.document.getElementById('callBanner').classList.contains('hidden'), false);
  state.chatCall = { ...state.chatCall, started_by: state.user.id };
  await dom.window.BananzaCallHooks.openPrejoin(state.chatCall, { mode: 'devices' });
  assert.equal(dom.window.document.getElementById('callBanner').classList.contains('hidden'), true);
  assert.equal(dom.window.document.getElementById('callPrejoinEndBtn').classList.contains('hidden'), true);
});

test('CallFeature copies call links from prejoin and active surface', async (t) => {
  const state = defaultState({
    chat: {
      id: 141,
      type: 'group',
      name: 'Solo call room',
      is_notes: 0,
    },
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
      screen_share_enabled: true,
      ringtone_enabled: true,
      call_messages_enabled: true,
      max_call_participants: 20,
    },
    externalUrl: 'https://example.test/call/solo-room-token',
    createdCall: {
      id: 1410,
      chat_id: 141,
      chat_name: 'Solo call room',
      media_kind: 'video',
      room_mode: 'room',
      participant_count: 0,
      started_by: 1,
      status: 'active',
      participants: [
        { user_id: 1, display_name: 'Alice', username: 'alice', state: 'invited' },
      ],
    },
  });
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());

  const copied = [];
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text) => {
        copied.push(text);
      },
    },
  });

  const roomState = installMockLiveKitRoom(dom);
  const startBtn = dom.window.document.getElementById('callStartBtn');
  await waitForCondition(dom.window, () => !startBtn.classList.contains('hidden'));
  startBtn.click();
  await waitForCondition(dom.window, () => state.startedCallPayload?.media_kind === 'video');
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));

  const prejoinCopy = dom.window.document.getElementById('callPrejoinCopyLinkBtn');
  assert.equal(prejoinCopy.classList.contains('hidden'), false);
  prejoinCopy.click();
  await waitForCondition(dom.window, () => copied.length === 1);
  assert.deepEqual(copied, [state.externalUrl]);
  assert.equal(state.externalLinkRequests, 1);
  assert.equal(dom.window.document.getElementById('callPrejoinStatus').textContent, dom.window.BananzaI18n.t('Call link copied'));

  dom.window.document.getElementById('callPrejoinJoinBtn').click();
  await waitForCondition(dom.window, () => roomState.isConnected());
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callSurface').classList.contains('hidden'));

  const surfaceCopy = dom.window.document.getElementById('callCopyLinkBtn');
  assert.equal(surfaceCopy.classList.contains('hidden'), false);
  assert.ok(surfaceCopy.querySelector('.call-icon'));
  surfaceCopy.click();
  await waitForCondition(dom.window, () => copied.length === 2);
  assert.deepEqual(copied, [state.externalUrl, state.externalUrl]);
  assert.equal(state.externalLinkRequests, 2);
  assert.equal(state.toasts.at(-1), dom.window.BananzaI18n.t('Call link copied'));
});

test('CallFeature external mode requires guest name and hides internal-only controls', async (t) => {
  const state = defaultExternalState();
  const dom = await bootExternalCallFeature(state);
  t.after(() => dom.window.close());

  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  assert.equal(dom.window.document.getElementById('callGuestNameWrap').classList.contains('hidden'), false);
  assert.equal(dom.window.document.getElementById('callPrejoinEndBtn').classList.contains('hidden'), true);
  assert.equal(dom.window.document.getElementById('callPrejoinCancelBtn').classList.contains('hidden'), true);

  dom.window.document.getElementById('callPrejoinJoinBtn').click();
  await waitForCondition(dom.window, () => dom.window.document.getElementById('callPrejoinStatus').textContent === dom.window.BananzaI18n.t('Name is required'));
  assert.equal(state.requests.some((request) => request.url.endsWith('/token')), false);

  installMockLiveKitRoom(dom);
  dom.window.document.getElementById('callGuestNameInput').value = 'Outside Guest';
  dom.window.document.getElementById('callPrejoinJoinBtn').click();
  await waitForCondition(dom.window, () => Boolean(state.joinedPayload));

  assert.equal(state.tokenPayload.display_name, 'Outside Guest');
  assert.equal(state.joinedPayload.guest_id, 'guest123456789');
  assert.equal(state.joinedPayload.session_token, 'session-token');
  assert.equal(dom.window.document.getElementById('callPrejoin').classList.contains('hidden'), true);
  assert.equal(dom.window.document.getElementById('callSurface').classList.contains('hidden'), false);
  assert.equal(dom.window.document.getElementById('callEndBtn').classList.contains('hidden'), true);
  assert.equal(dom.window.document.getElementById('callAiNotesBtn').classList.contains('hidden'), true);

  dom.window.document.getElementById('callLeaveBtn').click();
  await waitForCondition(dom.window, () => Boolean(state.leftPayload));
  assert.deepEqual(state.viewportRecoveries, []);
});

test('CallFeature treats partial prejoin media success as usable preview state', async (t) => {
  const state = defaultState({
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
    },
  });
  state.chatCall = {
    id: 97,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    participant_count: 1,
    started_by: 2,
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'invited' },
      { user_id: 2, display_name: 'Bob', username: 'bob', state: 'joined' },
    ],
  };
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());

  dom.window.MediaStream = class {
    constructor(tracks = []) {
      this.tracks = tracks;
    }

    getTracks() {
      return this.tracks;
    }

    getAudioTracks() {
      return this.tracks.filter((track) => track.kind === 'audio');
    }

    getVideoTracks() {
      return this.tracks.filter((track) => track.kind === 'video');
    }
  };
  state.previewRequests = [];
  Object.defineProperty(dom.window.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: async () => [],
      getUserMedia: async (constraints) => {
        state.previewRequests.push(constraints);
        if (constraints.video) throw new Error('camera fail');
        return new dom.window.MediaStream([{ kind: 'audio', readyState: 'live', stop() {} }]);
      },
    },
  });

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: state.chatCall });
  dom.window.document.getElementById('callBannerJoin').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  await waitForCondition(dom.window, () => (
    dom.window.document.getElementById('callPrejoinStatus').textContent === dom.window.BananzaI18n.t('Microphone ready, camera unavailable')
  ));

  const status = dom.window.document.getElementById('callPrejoinStatus');
  assert.equal(status.classList.contains('error'), false);
  assert.equal(status.textContent, dom.window.BananzaI18n.t('Microphone ready, camera unavailable'));
  assert.notEqual(status.textContent, dom.window.BananzaI18n.t('Camera or microphone unavailable'));
  assert.equal(dom.window.document.getElementById('callPrejoinCameraBtn').classList.contains('is-off'), true);
  assert.equal(dom.window.document.getElementById('callPrejoinMicBtn').classList.contains('is-off'), false);
  assert.equal(state.previewRequests.some((constraints) => constraints.audio && !constraints.video), true);
  assert.equal(state.previewRequests.some((constraints) => constraints.video && !constraints.audio), true);
});

test('CallFeature joins and leaves a mocked LiveKit room', async (t) => {
  const state = defaultState({
    user: { id: 1, display_name: 'Alice', is_admin: 1, avatar_color: '#112233', avatar_url: '/uploads/avatars/alice.png' },
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
    },
  });
  state.chatCall = {
    id: 92,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    participant_count: 1,
    started_by: 2,
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'joined', avatar_color: '#112233', avatar_url: '/uploads/avatars/alice.png' },
      { user_id: 2, display_name: 'Bob', username: 'bob', state: 'invited', avatar_color: '#445566', avatar_url: '/uploads/avatars/bob.png' },
    ],
  };
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());

  let connected = false;
  let disconnected = false;
  dom.window.LivekitClient = {
    Room: class {
      constructor() {
        this.localParticipant = {
          identity: 'user:1',
          name: 'Alice',
          trackPublications: new Map(),
          setCameraEnabled: async () => {},
          setMicrophoneEnabled: async () => {},
        };
        this.remoteParticipants = new Map();
      }

      on() {}

      async connect() {
        connected = true;
      }

      disconnect() {
        disconnected = true;
      }
    },
    RoomEvent: {},
    Track: { Source: { Camera: 'camera', Microphone: 'microphone' } },
  };

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: state.chatCall });
  const banner = dom.window.document.getElementById('callBanner');
  assert.equal(banner.classList.contains('hidden'), false);

  dom.window.document.getElementById('callBannerJoin').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  assert.equal(banner.classList.contains('hidden'), true);
  assert.deepEqual(state.viewportRecoveries.map((item) => item.reason), ['call_prejoin_open']);
  const prejoinMic = dom.window.document.getElementById('callPrejoinMicBtn');
  const prejoinCamera = dom.window.document.getElementById('callPrejoinCameraBtn');
  assert.equal(prejoinMic.textContent.trim(), '');
  assert.equal(prejoinCamera.textContent.trim(), '');
  assert.ok(prejoinMic.querySelector('.call-icon'));
  assert.ok(prejoinCamera.querySelector('.call-icon'));
  prejoinMic.click();
  await waitForCondition(dom.window, () => prejoinMic.classList.contains('is-off'));
  assert.equal(prejoinMic.getAttribute('aria-label'), dom.window.BananzaI18n.t('Mic off'));
  dom.window.document.getElementById('callPrejoinJoinBtn').click();
  await waitForCondition(dom.window, () => connected);
  await waitForCondition(dom.window, () => state.requests.some((request) => request.url === '/api/calls/92/joined'));
  assert.equal(dom.window.document.getElementById('callSurface').classList.contains('hidden'), false);
  assert.equal(banner.classList.contains('hidden'), true);
  assert.equal(dom.window.document.getElementById('callMicBtn').textContent.trim(), '');
  assert.ok(dom.window.document.getElementById('callCameraBtn').querySelector('.call-icon'));
  assert.equal(dom.window.document.querySelector('.call-tile-placeholder')?.textContent.trim(), '🍌');
  assert.ok(dom.window.document.querySelector('#callParticipantsBtn .call-icon'));
  assert.ok(dom.window.document.querySelector('#callDeviceBtn .call-icon'));
  const aiNotesBtn = dom.window.document.getElementById('callAiNotesBtn');
  assert.ok(aiNotesBtn.querySelector('.call-icon'));
  assert.equal(aiNotesBtn.classList.contains('call-icon-ai-badge'), true);
  assert.equal(aiNotesBtn.classList.contains('call-icon-ai-notes'), false);
  assert.ok(dom.window.document.querySelector('#callLeaveBtn .call-icon'));
  dom.window.document.getElementById('callParticipantsBtn').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callParticipantsPanel').classList.contains('hidden'));
  assert.equal(dom.window.document.querySelectorAll('.call-participant-avatar img').length, 2);
  assert.ok(dom.window.document.getElementById('callSurface'));

  dom.window.document.getElementById('callMinimizeBtn').click();
  await waitForCondition(dom.window, () => dom.window.document.getElementById('callSurface').classList.contains('is-minimized'));
  assert.deepEqual(state.viewportRecoveries.map((item) => item.reason), ['call_prejoin_open', 'call_minimized']);
  assert.equal(dom.window.document.getElementById('callParticipantsBtn').classList.contains('hidden'), true);
  assert.equal(dom.window.document.getElementById('callParticipantsPanel').classList.contains('hidden'), true);
  const surface = dom.window.document.getElementById('callSurface');
  const surfaceCard = surface.querySelector('.call-surface-card');
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 400, right: 500, bottom: 400 });
  surfaceCard.getBoundingClientRect = () => {
    const x = Number.parseFloat(surface.style.getPropertyValue('--call-mini-x')) || 122;
    const y = Number.parseFloat(surface.style.getPropertyValue('--call-mini-y')) || 310;
    return { left: x, top: y, width: 360, height: 72, right: x + 360, bottom: y + 72 };
  };
  dispatchPointer(dom.window, surfaceCard, 'pointerdown', { clientX: 200, clientY: 330 });
  await waitForMs(dom.window, 320);
  dispatchPointer(dom.window, dom.window, 'pointermove', { clientX: 470, clientY: 390 });
  dispatchPointer(dom.window, dom.window, 'pointerup', { clientX: 470, clientY: 390 });
  await waitForCondition(dom.window, () => surface.classList.contains('is-mini-positioned'));
  assert.equal(surface.style.getPropertyValue('--call-mini-x'), '128px');
  assert.equal(surface.style.getPropertyValue('--call-mini-y'), '316px');
  await waitForMs(dom.window, 240);
  surfaceCard.click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callSurface').classList.contains('is-minimized'));
  assert.equal(dom.window.document.getElementById('callParticipantsBtn').classList.contains('hidden'), false);

  dom.window.document.getElementById('callLeaveBtn').click();
  await waitForCondition(dom.window, () => disconnected);
  assert.ok(state.requests.some((request) => request.url === '/api/calls/92/leave'));
  await waitForCondition(dom.window, () => state.viewportRecoveries.length === 3);
  assert.deepEqual(state.viewportRecoveries.map((item) => item.reason), ['call_prejoin_open', 'call_minimized', 'call_left']);
});

test('CallFeature shows live call duration from started_at in the surface header', async (t) => {
  const startedAt = '2026-01-01 12:00:00';
  const initialNow = Date.parse('2026-01-01T12:00:42Z');
  let now = initialNow;
  const state = defaultState({
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
    },
  });
  state.chatCall = {
    id: 94,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    participant_count: 1,
    started_by: 2,
    started_at: startedAt,
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'joined' },
      { user_id: 2, display_name: 'Bob', username: 'bob', state: 'invited' },
    ],
  };
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());
  dom.window.Date.now = () => now;
  const roomState = installMockLiveKitRoom(dom);

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: state.chatCall });
  dom.window.document.getElementById('callBannerJoin').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  dom.window.document.getElementById('callPrejoinJoinBtn').click();
  await waitForCondition(dom.window, () => roomState.isConnected());
  await waitForCondition(dom.window, () => state.requests.some((request) => request.url === '/api/calls/94/joined'));

  const title = dom.window.document.getElementById('callSurfaceTitle');
  const duration = dom.window.document.getElementById('callSurfaceDuration');
  assert.equal(title.textContent, state.chat.name);
  await waitForCondition(dom.window, () => !duration.hidden && duration.textContent === '0:42');

  now += 5000;
  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: { ...state.chatCall } });
  await waitForCondition(dom.window, () => !duration.hidden && duration.textContent === '0:47');
});

test('CallFeature hides live call duration when started_at is missing', async (t) => {
  const state = defaultState({
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
    },
  });
  state.chatCall = {
    id: 95,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    participant_count: 1,
    started_by: 2,
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'joined' },
      { user_id: 2, display_name: 'Bob', username: 'bob', state: 'invited' },
    ],
  };
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());
  const roomState = installMockLiveKitRoom(dom);

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: state.chatCall });
  dom.window.document.getElementById('callBannerJoin').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  dom.window.document.getElementById('callPrejoinJoinBtn').click();
  await waitForCondition(dom.window, () => roomState.isConnected());

  const duration = dom.window.document.getElementById('callSurfaceDuration');
  assert.equal(duration.hidden, true);
  assert.equal(duration.textContent, '');
});

test('CallFeature starts and joins a voice room without camera UI or publishing', async (t) => {
  const state = defaultState({
    user: { id: 1, display_name: 'Alice', is_admin: 1 },
    chat: {
      id: 51,
      type: 'group',
      name: 'Team room',
      is_notes: 0,
    },
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
      screen_share_enabled: true,
      ringtone_enabled: true,
      call_messages_enabled: true,
      max_call_participants: 20,
    },
    joinedResponseDropsCallKind: true,
  });
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());

  Object.defineProperty(dom.window.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: async () => [],
      getUserMedia: async (constraints) => {
        state.previewConstraints = constraints;
        return { getTracks: () => [{ stop() {} }] };
      },
    },
  });

  let connected = false;
  let cameraCalls = 0;
  let micCalls = 0;
  dom.window.LivekitClient = {
    Room: class {
      constructor() {
        const audioPublications = new Map();
        this.localParticipant = {
          identity: 'user:1',
          name: 'Alice',
          audioTrackPublications: audioPublications,
          videoTrackPublications: new Map(),
          trackPublications: audioPublications,
          setCameraEnabled: async () => {
            cameraCalls += 1;
          },
          setMicrophoneEnabled: async (enabled) => {
            micCalls += 1;
            if (enabled) {
              audioPublications.set('microphone', {
                kind: 'audio',
                source: 'microphone',
                isMuted: false,
                track: { kind: 'audio', source: 'microphone', mediaStreamTrack: { kind: 'audio', enabled: true, readyState: 'live' } },
              });
            } else {
              audioPublications.clear();
            }
          },
        };
        this.remoteParticipants = new Map();
      }

      on() {}

      async connect() {
        connected = true;
      }

      disconnect() {}
    },
    RoomEvent: {},
    Track: { Source: { Camera: 'camera', Microphone: 'microphone' } },
  };

  dom.window.document.getElementById('callVoiceStartBtn').click();
  await waitForCondition(dom.window, () => state.startedCallPayload?.media_kind === 'voice');
  await waitForCondition(dom.window, () => connected);
  assert.equal(dom.window.document.getElementById('callPrejoin').classList.contains('hidden'), true);
  assert.equal(state.previewConstraints, undefined);
  assert.equal(dom.window.document.getElementById('callSurface').classList.contains('is-voice-call'), true);
  assert.equal(dom.window.document.getElementById('callLayoutBtn').classList.contains('hidden'), true);
  assert.equal(dom.window.document.getElementById('callCameraBtn').classList.contains('hidden'), true);
  assert.equal(dom.window.document.getElementById('callScreenBtn').classList.contains('hidden'), true);
  assert.ok(dom.window.document.querySelector('.call-voice-tile'));
  assert.equal(dom.window.document.querySelector('.call-tile'), null);

  await waitForMs(dom.window, 3800);
  assert.equal(micCalls >= 1, true);
  assert.equal(cameraCalls, 0);
});

test('CallFeature adapts active call tiles to portrait pair geometry', async (t) => {
  const state = defaultState({
    layoutMode: 'adaptive',
    user: { id: 1, display_name: 'Alice', is_admin: 1 },
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
      screen_share_enabled: true,
      ringtone_enabled: true,
      call_messages_enabled: true,
      max_call_participants: 20,
    },
  });
  state.chatCall = {
    id: 93,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    participant_count: 2,
    started_by: 2,
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'joined' },
      { user_id: 2, display_name: 'Bob', username: 'bob', state: 'joined' },
    ],
  };
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());
  const roomState = installMockLiveKitRoom(dom, {
    localVideo: { width: 720, height: 1280 },
    remoteVideos: [
      { identity: 'user:2', name: 'Bob', video: { width: 720, height: 1280 } },
    ],
  });

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: state.chatCall });
  dom.window.document.getElementById('callBannerJoin').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  dom.window.document.getElementById('callPrejoinJoinBtn').click();
  await waitForCondition(dom.window, () => roomState.isConnected());

  const grid = dom.window.document.getElementById('callGrid');
  await waitForCondition(dom.window, () => grid.dataset.callLayout === 'portrait-pair');
  assert.equal(grid.dataset.callTileCount, '2');

  const localTile = grid.querySelector('[data-call-tile-key="local"]');
  const remoteTile = grid.querySelector('[data-call-tile-key="user:2"]');
  assert.ok(localTile);
  assert.ok(remoteTile);
  assert.equal(localTile.dataset.videoOrientation, 'portrait');
  assert.equal(remoteTile.dataset.videoOrientation, 'portrait');
  assert.equal(localTile.classList.contains('is-video-portrait'), true);
  assert.equal(remoteTile.classList.contains('is-video-portrait'), true);
  assert.equal(localTile.style.getPropertyValue('--call-tile-aspect'), '720 / 1280');
  assert.equal(remoteTile.style.getPropertyValue('--call-tile-aspect'), '720 / 1280');

  const prejoinVideo = dom.window.document.getElementById('callPrejoinVideo');
  const prejoinPreview = dom.window.document.querySelector('.call-prejoin-preview');
  assert.equal(prejoinVideo.dataset.videoOrientation, undefined);
  assert.equal(prejoinVideo.style.getPropertyValue('--call-tile-aspect'), '');
  assert.equal(prejoinPreview.dataset.callLayout, undefined);
  assert.equal(prejoinPreview.classList.contains('is-video-portrait'), false);
});

test('CallFeature fits all fullscreen video tiles and persists layout mode', async (t) => {
  const state = defaultState({
    user: { id: 1, display_name: 'Alice', is_admin: 1 },
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
      screen_share_enabled: true,
      ringtone_enabled: true,
      call_messages_enabled: true,
      max_call_participants: 20,
    },
  });
  state.chatCall = {
    id: 99,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    participant_count: 3,
    started_by: 2,
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'joined' },
      { user_id: 2, display_name: 'Bob', username: 'bob', state: 'joined' },
      { user_id: 3, display_name: 'Cara', username: 'cara', state: 'joined' },
    ],
  };
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());
  const roomState = installMockLiveKitRoom(dom, {
    localVideo: { width: 1280, height: 720 },
    remoteVideos: [
      { identity: 'user:2', name: 'Bob', video: { width: 1280, height: 720 } },
      { identity: 'user:3', name: 'Cara', video: { width: 1280, height: 720 } },
    ],
  });

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: state.chatCall });
  dom.window.document.getElementById('callBannerJoin').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  dom.window.document.getElementById('callPrejoinJoinBtn').click();
  await waitForCondition(dom.window, () => roomState.isConnected());

  const grid = dom.window.document.getElementById('callGrid');
  await waitForCondition(dom.window, () => grid.dataset.callLayout === 'fit-all');
  assert.equal(grid.dataset.callTileCount, '3');
  assert.equal(grid.dataset.callFitCols, '2');
  assert.equal(grid.dataset.callFitRows, '2');
  assert.equal(grid.style.getPropertyValue('--call-fit-cols'), '2');
  assert.equal(grid.style.getPropertyValue('--call-fit-rows'), '2');

  const layoutBtn = dom.window.document.getElementById('callLayoutBtn');
  assert.ok(layoutBtn);
  assert.equal(layoutBtn.classList.contains('hidden'), false);
  assert.equal(layoutBtn.getAttribute('aria-pressed'), 'true');

  layoutBtn.click();
  await waitForCondition(dom.window, () => grid.dataset.callLayout === 'dense');
  assert.equal(dom.window.localStorage.getItem('bananza.call.layoutMode.v1'), 'adaptive');
  assert.equal(layoutBtn.getAttribute('aria-pressed'), 'false');
  assert.match(layoutBtn.textContent, /Адаптивно|Adaptive/);
  assert.equal(grid.style.getPropertyValue('--call-fit-cols'), '');
  assert.equal(grid.style.getPropertyValue('--call-fit-rows'), '');

  dom.window.document.getElementById('callMinimizeBtn').click();
  await waitForCondition(dom.window, () => dom.window.document.getElementById('callSurface').classList.contains('is-minimized'));
  assert.equal(layoutBtn.classList.contains('hidden'), true);
});

test('CallFeature stacks focused secondary videos in one desktop rail', async (t) => {
  const state = defaultState({
    user: { id: 1, display_name: 'Alice', is_admin: 1 },
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
      screen_share_enabled: true,
      ringtone_enabled: true,
      call_messages_enabled: true,
      max_call_participants: 20,
    },
  });
  state.chatCall = {
    id: 100,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    participant_count: 4,
    started_by: 2,
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'joined' },
      { user_id: 2, display_name: 'Bob', username: 'bob', state: 'joined' },
      { user_id: 3, display_name: 'Cara', username: 'cara', state: 'joined' },
      { user_id: 4, display_name: 'Dan', username: 'dan', state: 'joined' },
    ],
  };
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());
  const roomState = installMockLiveKitRoom(dom, {
    localVideo: { width: 1280, height: 720 },
    remoteVideos: [
      { identity: 'user:2', name: 'Bob', video: { width: 1280, height: 720 } },
      { identity: 'user:3', name: 'Cara', video: { width: 1280, height: 720 } },
      { identity: 'user:4', name: 'Dan', video: { width: 1280, height: 720 } },
    ],
  });

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: state.chatCall });
  dom.window.document.getElementById('callBannerJoin').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  dom.window.document.getElementById('callPrejoinJoinBtn').click();
  await waitForCondition(dom.window, () => roomState.isConnected());

  const grid = dom.window.document.getElementById('callGrid');
  await waitForCondition(dom.window, () => grid.dataset.callLayout === 'fit-all');
  const focusedTile = grid.querySelector('[data-call-tile-key="user:3"]');
  const focusBtn = focusedTile.querySelector('.call-tile-fit-btn');
  assert.ok(focusedTile);
  assert.ok(focusBtn);

  focusBtn.click();
  await waitForCondition(dom.window, () => grid.classList.contains('is-video-focus-mode'));
  assert.equal(focusedTile.classList.contains('is-video-focused'), true);
  assert.equal(grid.dataset.videoSecondaryCount, '3');
  assert.notEqual(grid.style.getPropertyValue('--call-focus-rail-width'), '');
  assert.notEqual(grid.style.getPropertyValue('--call-focus-thumb-height'), '');
  const secondaryTiles = Array.from(grid.querySelectorAll('.call-tile.is-video-secondary'));
  assert.equal(secondaryTiles.length, 3);
  const tops = secondaryTiles.map((tile) => tile.style.getPropertyValue('--call-secondary-top'));
  assert.equal(tops.every(Boolean), true);
  assert.equal(new Set(tops).size, 3);
  assert.equal(focusedTile.style.getPropertyValue('--call-secondary-top'), '');

  focusBtn.click();
  await waitForCondition(dom.window, () => !grid.classList.contains('is-video-focus-mode'));
  assert.equal(grid.hasAttribute('data-video-secondary-count'), false);
  assert.equal(grid.style.getPropertyValue('--call-focus-rail-width'), '');
  assert.equal(grid.style.getPropertyValue('--call-focus-thumb-height'), '');
  assert.equal(Array.from(grid.querySelectorAll('.call-tile')).every((tile) => (
    tile.style.getPropertyValue('--call-secondary-top') === ''
  )), true);
});

test('CallFeature focuses video tiles and marks active speakers', async (t) => {
  const state = defaultState({
    user: { id: 1, display_name: 'Alice', is_admin: 1 },
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
      screen_share_enabled: true,
      ringtone_enabled: true,
      call_messages_enabled: true,
      max_call_participants: 20,
    },
  });
  state.chatCall = {
    id: 98,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    participant_count: 2,
    started_by: 2,
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'joined' },
      { user_id: 2, display_name: 'Bob', username: 'bob', state: 'joined' },
    ],
  };
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());
  const roomState = installMockLiveKitRoom(dom, {
    localVideo: { width: 1280, height: 720 },
    remoteVideos: [
      { identity: 'user:2', name: 'Bob', video: { width: 1280, height: 720 } },
    ],
  });

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: state.chatCall });
  dom.window.document.getElementById('callBannerJoin').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  dom.window.document.getElementById('callPrejoinJoinBtn').click();
  await waitForCondition(dom.window, () => roomState.isConnected());

  const grid = dom.window.document.getElementById('callGrid');
  await waitForCondition(dom.window, () => grid.querySelectorAll('.call-tile-fit-btn').length === 2);
  await waitForCondition(dom.window, () => grid.dataset.callLayout === 'fit-all');
  const localTile = grid.querySelector('[data-call-tile-key="local"]');
  const remoteTile = grid.querySelector('[data-call-tile-key="user:2"]');
  const focusBtn = remoteTile.querySelector('.call-tile-fit-btn');
  assert.ok(localTile);
  assert.ok(remoteTile);
  assert.ok(focusBtn);

  focusBtn.click();
  await waitForCondition(dom.window, () => grid.classList.contains('is-video-focus-mode'));
  assert.equal(remoteTile.classList.contains('is-video-focused'), true);
  assert.equal(remoteTile.classList.contains('is-video-fill'), false);
  assert.equal(focusBtn.getAttribute('aria-pressed'), 'true');

  focusBtn.click();
  await waitForCondition(dom.window, () => !grid.classList.contains('is-video-focus-mode'));
  await waitForCondition(dom.window, () => grid.dataset.callLayout === 'fit-all');
  assert.equal(remoteTile.classList.contains('is-video-focused'), false);
  assert.equal(focusBtn.getAttribute('aria-pressed'), 'false');

  roomState.emit('activeSpeakersChanged', [
    roomState.getLocalParticipant(),
    roomState.getRemoteParticipant('user:2'),
  ]);
  await waitForCondition(dom.window, () => (
    localTile.classList.contains('is-speaking') && remoteTile.classList.contains('is-speaking')
  ));

  roomState.emit('activeSpeakersChanged', []);
  await waitForCondition(dom.window, () => (
    !localTile.classList.contains('is-speaking') && !remoteTile.classList.contains('is-speaking')
  ));
});

test('CallFeature marks landscape active call tiles from video geometry', async (t) => {
  const state = defaultState({
    layoutMode: 'adaptive',
    user: { id: 1, display_name: 'Alice', is_admin: 1 },
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
      screen_share_enabled: true,
      ringtone_enabled: true,
      call_messages_enabled: true,
      max_call_participants: 20,
    },
  });
  state.chatCall = {
    id: 94,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    participant_count: 1,
    started_by: 1,
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'joined' },
    ],
  };
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());
  const roomState = installMockLiveKitRoom(dom, {
    localVideo: { width: 1280, height: 720 },
  });

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: state.chatCall });
  dom.window.document.getElementById('callBannerJoin').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  dom.window.document.getElementById('callPrejoinJoinBtn').click();
  await waitForCondition(dom.window, () => roomState.isConnected());

  const grid = dom.window.document.getElementById('callGrid');
  await waitForCondition(dom.window, () => grid.dataset.callLayout === 'single');
  const tile = grid.querySelector('[data-call-tile-key="local"]');
  assert.ok(tile);
  assert.equal(tile.dataset.videoOrientation, 'landscape');
  assert.equal(tile.classList.contains('is-video-landscape'), true);
  assert.equal(tile.style.getPropertyValue('--call-tile-aspect'), '1280 / 720');
});

test('CallFeature keeps attached video elements across call rerenders', async (t) => {
  const state = defaultState({
    user: { id: 1, display_name: 'Alice', is_admin: 1 },
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
      screen_share_enabled: true,
      ringtone_enabled: true,
      call_messages_enabled: true,
      max_call_participants: 20,
    },
  });
  state.chatCall = {
    id: 101,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    participant_count: 2,
    started_by: 2,
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'joined' },
      { user_id: 2, display_name: 'Bob', username: 'bob', state: 'joined' },
    ],
  };
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());
  const roomState = installMockLiveKitRoom(dom, {
    localVideo: { width: 1280, height: 720 },
    remoteVideos: [
      { identity: 'user:2', name: 'Bob', video: { width: 1280, height: 720 } },
    ],
  });

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: state.chatCall });
  dom.window.document.getElementById('callBannerJoin').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  dom.window.document.getElementById('callPrejoinJoinBtn').click();
  await waitForCondition(dom.window, () => roomState.isConnected());

  const grid = dom.window.document.getElementById('callGrid');
  await waitForCondition(dom.window, () => grid.querySelector('[data-call-tile-key="user:2"] video'));
  await waitForMs(dom.window, 720);
  const remoteParticipant = roomState.getRemoteParticipant('user:2');
  const remoteTrack = remoteParticipant.videoTrackPublications.get('camera').track;
  const remoteTile = grid.querySelector('[data-call-tile-key="user:2"]');
  const remoteVideo = remoteTile.querySelector('video');

  assert.equal(remoteTrack.attachCount, 1);
  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: { ...state.chatCall } });

  const nextRemoteTile = grid.querySelector('[data-call-tile-key="user:2"]');
  assert.strictEqual(nextRemoteTile, remoteTile);
  assert.strictEqual(nextRemoteTile.querySelector('video'), remoteVideo);
  assert.equal(remoteTrack.attachCount, 1);
});

test('CallFeature keeps video visible during temporary muted media stream state', async (t) => {
  const state = defaultState({
    user: { id: 1, display_name: 'Alice', is_admin: 1 },
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
      screen_share_enabled: true,
      ringtone_enabled: true,
      call_messages_enabled: true,
      max_call_participants: 20,
    },
  });
  state.chatCall = {
    id: 102,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    participant_count: 2,
    started_by: 2,
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'joined' },
      { user_id: 2, display_name: 'Bob', username: 'bob', state: 'joined' },
    ],
  };
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());
  const roomState = installMockLiveKitRoom(dom, {
    localVideo: { width: 1280, height: 720 },
    remoteVideos: [
      { identity: 'user:2', name: 'Bob', video: { width: 1280, height: 720 } },
    ],
  });

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: state.chatCall });
  dom.window.document.getElementById('callBannerJoin').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  dom.window.document.getElementById('callPrejoinJoinBtn').click();
  await waitForCondition(dom.window, () => roomState.isConnected());

  const grid = dom.window.document.getElementById('callGrid');
  await waitForCondition(dom.window, () => grid.querySelector('[data-call-tile-key="user:2"] video'));
  const remoteParticipant = roomState.getRemoteParticipant('user:2');
  const remotePublication = remoteParticipant.videoTrackPublications.get('camera');
  const remoteTrack = remotePublication.track;
  const remoteTile = grid.querySelector('[data-call-tile-key="user:2"]');
  const remoteVideo = remoteTile.querySelector('video');

  remoteTrack.mediaStreamTrack.muted = true;
  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: { ...state.chatCall } });
  roomState.emit('trackStreamStateChanged', remotePublication, 'paused', remoteParticipant);

  const pausedTile = grid.querySelector('[data-call-tile-key="user:2"]');
  assert.strictEqual(pausedTile.querySelector('video'), remoteVideo);
  assert.equal(pausedTile.querySelector('.call-tile-placeholder'), null);
  assert.equal(remoteTrack.attachCount, 1);

  remoteTrack.mediaStreamTrack.muted = false;
  roomState.emit('trackStreamStateChanged', remotePublication, 'active', remoteParticipant);
  assert.strictEqual(grid.querySelector('[data-call-tile-key="user:2"] video'), remoteVideo);
});

test('CallFeature requests remote video subscription when a joined participant has no track yet', async (t) => {
  const state = defaultState({
    user: { id: 1, display_name: 'Alice', is_admin: 1 },
    features: {
      calls_enabled: true,
      livekit_ready: true,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
      screen_share_enabled: true,
      ringtone_enabled: true,
      call_messages_enabled: true,
      max_call_participants: 20,
    },
  });
  state.chatCall = {
    id: 103,
    chat_id: state.chat.id,
    chat_name: state.chat.name,
    participant_count: 2,
    started_by: 2,
    status: 'active',
    participants: [
      { user_id: 1, display_name: 'Alice', username: 'alice', state: 'joined' },
      { user_id: 2, display_name: 'Bob', username: 'bob', state: 'joined' },
    ],
  };
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());
  const roomState = installMockLiveKitRoom(dom, {
    localVideo: { width: 1280, height: 720 },
    remoteVideos: [
      { identity: 'user:2', name: 'Bob', video: { width: 1280, height: 720, subscribed: false } },
    ],
  });

  dom.window.BananzaCallHooks.handleWSMessage({ type: 'call_updated', call: state.chatCall });
  dom.window.document.getElementById('callBannerJoin').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callPrejoin').classList.contains('hidden'));
  dom.window.document.getElementById('callPrejoinJoinBtn').click();
  await waitForCondition(dom.window, () => roomState.isConnected());

  const grid = dom.window.document.getElementById('callGrid');
  const remoteParticipant = roomState.getRemoteParticipant('user:2');
  const remotePublication = remoteParticipant.videoTrackPublications.get('camera');
  await waitForCondition(dom.window, () => remotePublication.setSubscribedCalls > 0);
  assert.equal(remotePublication.setEnabledCalls > 0, true);

  const remoteTile = grid.querySelector('[data-call-tile-key="user:2"]');
  assert.ok(remoteTile.querySelector('.call-tile-placeholder'));
  assert.equal(remoteTile.querySelector('video'), null);

  remotePublication.track = remotePublication.pendingTrack;
  roomState.emit('trackSubscribed', remotePublication.track, remotePublication, remoteParticipant);

  await waitForCondition(dom.window, () => grid.querySelector('[data-call-tile-key="user:2"] video'));
  assert.equal(grid.querySelector('[data-call-tile-key="user:2"] .call-tile-placeholder'), null);
  assert.equal(remotePublication.pendingTrack.attachCount, 1);
});

test('CallFeature admin modal saves LiveKit credentials without requiring visible secrets', async (t) => {
  const state = defaultState({
    adminCallSettings: {
      settings: {
        calls_enabled: false,
        allow_private_calls: true,
        allow_group_calls: true,
        ring_timeout_ms: 60000,
      },
      livekit_ready: false,
      livekit_ws_url_present: false,
      livekit_config: {
        ws_url: '',
        effective_ws_url: '',
        masked_api_key: '',
        masked_api_secret: '',
        source: '',
      },
    },
  });
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());

  dom.window.BananzaCallHooks.onSettingsOpened({ currentUser: state.user });
  dom.window.document.getElementById('settingsCallPanel').click();
  await waitForCondition(dom.window, () => state.requests.some((request) => request.url === '/api/admin/call-settings'));

  dom.window.document.getElementById('callLiveKitWsUrl').value = 'wss://admin.livekit.test';
  dom.window.document.getElementById('callLiveKitApiKey').value = 'new-api-key';
  dom.window.document.getElementById('callLiveKitApiSecret').value = 'new-api-secret';
  dom.window.document.getElementById('callEnabledToggle').checked = true;
  dom.window.document.getElementById('callSaveBtn').click();

  await waitForCondition(dom.window, () => state.savedAdminPayload);
  assert.equal(state.savedAdminPayload.livekit_ws_url, 'wss://admin.livekit.test');
  assert.equal(state.savedAdminPayload.livekit_api_key, 'new-api-key');
  assert.equal(state.savedAdminPayload.livekit_api_secret, 'new-api-secret');
  await waitForCondition(dom.window, () => dom.window.document.getElementById('callLiveKitApiSecret').value === '');
  assert.equal(dom.window.document.getElementById('callLiveKitApiSecret').value, '');
  assert.match(dom.window.document.getElementById('callLiveKitApiSecret').getAttribute('placeholder'), /new/);
});
