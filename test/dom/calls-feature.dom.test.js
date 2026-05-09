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

function installCallBridge(dom, state) {
  const { document, window } = dom.window;
  state.requests = [];
  window.BananzaAppBridge = {
    api: async (url, opts = {}) => {
      state.requests.push({ url, opts });
      if (url === '/api/features') return state.features;
      if (url === '/api/calls/active') return { settings: state.features, calls: state.activeCalls || [] };
      if (url === `/api/chats/${state.chat.id}/calls/active`) return { call: state.chatCall || null };
      if (url === `/api/calls/${state.chatCall?.id}/token`) {
        return { call: state.chatCall, livekit: { url: 'ws://livekit.test', token: 'test-token' } };
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
      if (url.endsWith('/decline') || url.endsWith('/leave') || url.endsWith('/end')) return { ok: true };
      throw new Error(`Unexpected call feature request: ${url}`);
    },
    applyLocalizedDom: () => {},
    closeManagedModal: (id) => document.getElementById(id)?.classList.add('hidden'),
    getCurrentChat: () => state.chat,
    getCurrentChatId: () => state.chat.id,
    getCurrentUser: () => state.user,
    openManagedModal: (id) => document.getElementById(id)?.classList.remove('hidden'),
    registerManagedModal: () => {},
    t: (key, params = {}) => window.BananzaI18n?.t?.(key, params) || key,
  };
}

async function bootCallFeature(state) {
  const dom = createAppDom();
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

test('CallFeature hides the header button until calls and LiveKit are enabled', async (t) => {
  const state = defaultState();
  const dom = await bootCallFeature(state);
  t.after(() => dom.window.close());

  const { document, BananzaCallHooks } = dom.window;
  const btn = document.getElementById('callStartBtn');
  assert.ok(btn);
  assert.equal(btn.classList.contains('hidden'), true);

  state.features = { ...state.features, calls_enabled: true, livekit_ready: true };
  BananzaCallHooks.handleWSMessage({ type: 'call_settings_updated', settings: state.features });
  BananzaCallHooks.onChatChanged();
  await waitForCondition(dom.window, () => !btn.classList.contains('hidden'));

  state.features = { ...state.features, livekit_ready: false };
  BananzaCallHooks.handleWSMessage({ type: 'call_settings_updated', settings: state.features });
  assert.equal(btn.classList.contains('hidden'), true);
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
  assert.equal(dom.window.document.getElementById('callSurface').classList.contains('hidden'), false);
  assert.equal(dom.window.document.getElementById('callMicBtn').textContent.trim(), '');
  assert.ok(dom.window.document.getElementById('callCameraBtn').querySelector('.call-icon'));
  assert.ok(dom.window.document.querySelector('.call-tile-placeholder img[src="/uploads/avatars/alice.png"]'));
  assert.ok(dom.window.document.querySelector('#callParticipantsBtn .call-icon'));
  assert.ok(dom.window.document.querySelector('#callDeviceBtn .call-icon'));
  assert.ok(dom.window.document.querySelector('#callLeaveBtn .call-icon'));
  dom.window.document.getElementById('callParticipantsBtn').click();
  await waitForCondition(dom.window, () => !dom.window.document.getElementById('callParticipantsPanel').classList.contains('hidden'));
  assert.equal(dom.window.document.querySelectorAll('.call-participant-avatar img').length, 2);
  assert.equal(
    dom.window.document.getElementById('callSurfaceStatus').textContent,
    dom.window.BananzaI18n.t('Connected')
  );

  dom.window.document.getElementById('callLeaveBtn').click();
  await waitForCondition(dom.window, () => disconnected);
  assert.ok(state.requests.some((request) => request.url === '/api/calls/92/leave'));
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
