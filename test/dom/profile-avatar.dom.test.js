const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  installVisualViewportMock,
  loadAppScript,
} = require('../support/domHarness');

function createJsonResponse(dom, data, init = {}) {
  return new dom.window.Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function wait(dom, ms = 0) {
  return new Promise((resolve) => dom.window.setTimeout(resolve, ms));
}

async function waitFor(dom, predicate, timeoutMs = 700) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) assert.fail('Timed out waiting for profile avatar condition');
    await wait(dom, 10);
  }
}

function installAppRuntimeStubs(dom, { fetchHandler = null } = {}) {
  const { window } = dom;
  const currentUser = {
    id: 1,
    username: 'alice',
    display_name: 'Alice',
    is_admin: 1,
    ui_theme: 'bananza',
    ui_visual_mode: 'classic',
    ui_modal_animation: 'none',
    ui_modal_animation_speed: 8,
    ui_mobile_font_size: 5,
    ui_show_chat_folder_strip_in_all_chats: false,
  };

  window.alert = () => {};
  window.Notification = class Notification {
    static permission = 'default';
    static requestPermission() {
      return Promise.resolve('default');
    }
  };
  window.navigator.serviceWorker = {
    addEventListener() {},
    register() {
      return Promise.resolve();
    },
    getRegistration() {
      return Promise.resolve({
        pushManager: {
          getSubscription() {
            return Promise.resolve(null);
          },
        },
      });
    },
  };
  window.WebSocket = class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    constructor() {
      this.readyState = window.WebSocket.OPEN;
      window.setTimeout(() => this.onopen?.(), 0);
    }
    close() {
      this.readyState = window.WebSocket.CLOSED;
      this.onclose?.({ code: 1000 });
    }
    send() {}
  };

  window.localStorage.setItem('token', 'test-token');
  window.localStorage.setItem('user', JSON.stringify(currentUser));

  window.fetch = async (input, init = {}) => {
    const url = new URL(String(input), window.location.origin);
    if (typeof fetchHandler === 'function') {
      const handled = await fetchHandler({ dom, window, url, input, init, currentUser });
      if (handled) return handled;
    }
    switch (url.pathname) {
      case '/api/auth/me':
        return createJsonResponse(dom, { user: currentUser });
      case '/api/chats':
        return createJsonResponse(dom, []);
      case '/api/chat-folders':
        return createJsonResponse(dom, { folders: [] });
      case '/api/users':
        return createJsonResponse(dom, []);
      case '/api/user/recent-emojis':
        return createJsonResponse(dom, { emojis: [] });
      case '/api/weather/settings':
        return createJsonResponse(dom, { settings: { enabled: false, location: null, refresh_minutes: 30 } });
      case '/api/sound-settings':
        return createJsonResponse(dom, {
          settings: {
            sounds_enabled: true,
            volume: 100,
            play_send: true,
            play_incoming: true,
            play_notifications: true,
            play_reactions: true,
            play_pins: true,
            play_invites: true,
            play_voice: true,
            play_mentions: true,
          },
        });
      case '/api/notification-settings':
        return createJsonResponse(dom, {
          settings: {
            push_enabled: false,
            notify_messages: true,
            notify_chat_invites: true,
            notify_reactions: true,
            notify_pins: true,
            notify_mentions: true,
          },
        });
      default:
        throw new Error(`Unexpected fetch in profile avatar DOM test: ${url.pathname}`);
    }
  };
}

async function bootProfileApp(options = {}) {
  const dom = createAppDom();
  installAppRuntimeStubs(dom, options);
  installVisualViewportMock(dom.window, {
    width: 390,
    height: 844,
    offsetTop: 0,
    offsetLeft: 0,
  });
  const ready = new Promise((resolve) => {
    dom.window.addEventListener('bananza:ready', resolve, { once: true });
  });
  loadAppScript(dom);
  await ready;
  await wait(dom);
  return dom;
}

test('profile avatar buttons route gallery and camera fallback to separate inputs', async () => {
  const dom = await bootProfileApp();
  const { document, navigator } = dom.window;
  const galleryInput = document.getElementById('profileAvatarInput');
  const cameraInput = document.getElementById('profileAvatarCameraInput');
  let galleryClicks = 0;
  let cameraClicks = 0;

  galleryInput.click = () => { galleryClicks += 1; };
  cameraInput.click = () => { cameraClicks += 1; };

  document.getElementById('profileAvatarPickBtn').click();
  assert.equal(galleryClicks, 1);
  assert.equal(cameraClicks, 0);

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: undefined,
  });
  document.getElementById('profileAvatarPickIcon').click();
  assert.equal(galleryClicks, 1);
  assert.equal(cameraClicks, 1);
});

test('profile camera modal captures JPEG avatar and stops media tracks', async () => {
  let uploadedAvatar = null;
  const dom = await bootProfileApp({
    fetchHandler({ dom: testDom, url, init, currentUser }) {
      if (url.pathname !== '/api/profile/avatar') return null;
      uploadedAvatar = init.body.get('avatar');
      return createJsonResponse(testDom, {
        user: { ...currentUser, avatar_url: '/uploads/avatar-camera.jpg' },
      });
    },
  });
  const { document, navigator } = dom.window;
  const stoppedTracks = [];
  const formDataAppendCalls = [];
  const originalFormDataAppend = dom.window.FormData.prototype.append;
  dom.window.FormData.prototype.append = function append(name, value, filename) {
    formDataAppendCalls.push({ name, value, filename });
    if (arguments.length >= 3) return originalFormDataAppend.call(this, name, value, filename);
    return originalFormDataAppend.call(this, name, value);
  };
  const stream = {
    getTracks() {
      return [
        { stop() { stoppedTracks.push('video'); } },
      ];
    },
  };
  let constraints = null;
  let drewFrame = false;

  navigator.mediaDevices.getUserMedia = async (nextConstraints) => {
    constraints = nextConstraints;
    return stream;
  };

  dom.window.HTMLCanvasElement.prototype.getContext = () => ({
    drawImage() {
      drewFrame = true;
    },
  });
  dom.window.HTMLCanvasElement.prototype.toBlob = (callback, type, quality) => {
    assert.equal(type, 'image/jpeg');
    assert.equal(quality, 0.92);
    callback(new dom.window.Blob(['avatar-camera'], { type: 'image/jpeg' }));
  };

  const video = document.getElementById('profileCameraVideo');
  video.play = () => Promise.resolve();
  Object.defineProperty(video, 'videoWidth', { configurable: true, value: 320 });
  Object.defineProperty(video, 'videoHeight', { configurable: true, value: 240 });

  document.getElementById('profileAvatarPickIcon').click();
  await waitFor(dom, () => video.srcObject === stream);

  assert.deepEqual(JSON.parse(JSON.stringify(constraints)), { video: { facingMode: 'user' }, audio: false });
  assert.equal(document.getElementById('profileCameraModal').classList.contains('hidden'), false);

  document.getElementById('profileCameraCaptureBtn').click();
  await waitFor(dom, () => uploadedAvatar && stoppedTracks.length === 1);

  assert.equal(drewFrame, true);
  const avatarAppend = formDataAppendCalls.find((call) => call.name === 'avatar');
  assert.ok(uploadedAvatar);
  assert.equal(avatarAppend.filename, 'avatar-camera.jpg');
  assert.equal(avatarAppend.value.type, 'image/jpeg');
  assert.deepEqual(stoppedTracks, ['video']);
});
