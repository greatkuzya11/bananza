const { expect } = require('@playwright/test');
const { createSession, makeUser } = require('../support/api');
const { readContext } = require('./context');

function getContext() {
  return readContext();
}

function createApiSession() {
  return createSession(getContext().baseUrl);
}

function isMobileProject(testInfo) {
  return Boolean(String(testInfo?.project?.name || '').includes('mobile'));
}

function isDesktopProject(testInfo) {
  return !isMobileProject(testInfo);
}

async function installMediaMocks(page) {
  await page.addInitScript(() => {
    class FakeAudioNode {
      connect() { return this; }
      disconnect() {}
    }

    class FakeAudioParam {
      setValueAtTime() {}
      exponentialRampToValueAtTime() {}
      linearRampToValueAtTime() {}
    }

    class FakeAudioContext {
      constructor() {
        this.state = 'running';
        this.currentTime = 0;
        this.sampleRate = 44100;
        this.destination = new FakeAudioNode();
      }
      resume() { this.state = 'running'; return Promise.resolve(); }
      close() { this.state = 'closed'; return Promise.resolve(); }
      createOscillator() {
        return { connect() {}, disconnect() {}, start() {}, stop() {}, frequency: new FakeAudioParam(), type: 'sine' };
      }
      createGain() {
        return { connect() {}, disconnect() {}, gain: new FakeAudioParam() };
      }
      createBiquadFilter() {
        return { connect() {}, disconnect() {}, frequency: new FakeAudioParam(), Q: new FakeAudioParam(), type: 'lowpass' };
      }
      createBuffer(_channels, frameCount) {
        return { getChannelData: () => new Float32Array(frameCount) };
      }
      createBufferSource() {
        return { connect() {}, disconnect() {}, start() {}, stop() {}, buffer: null };
      }
      createMediaStreamSource() {
        return new FakeAudioNode();
      }
      createScriptProcessor() {
        return { connect() {}, disconnect() {}, onaudioprocess: null };
      }
    }

    class FakeTrack {
      stop() {}
    }

    class FakeMediaStream {
      getTracks() {
        return [new FakeTrack(), new FakeTrack()];
      }
    }

    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }
      constructor() {
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onstop = null;
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['video-note'], { type: 'video/webm' }) });
        this.onstop?.();
      }
    }

    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = FakeAudioContext;
    window.MediaRecorder = FakeMediaRecorder;
    navigator.mediaDevices = {
      async getUserMedia() {
        return new FakeMediaStream();
      },
    };
    navigator.vibrate = () => true;
    navigator.userActivation = { isActive: true, hasBeenActive: true };
    window.alert = () => {};
    window.confirm = () => true;
    HTMLMediaElement.prototype.play = async function play() {
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {};
    URL.createObjectURL = () => 'blob:playwright-mock';
    URL.revokeObjectURL = () => {};
  });
}

async function installFakeVisualViewport(page) {
  await page.addInitScript(() => {
    const listeners = new Map();
    const state = {
      width: window.innerWidth || document.documentElement.clientWidth || 412,
      height: window.innerHeight || document.documentElement.clientHeight || 844,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 1,
    };
    const fake = {
      get width() { return state.width; },
      get height() { return state.height; },
      get offsetTop() { return state.offsetTop; },
      get offsetLeft() { return state.offsetLeft; },
      get pageTop() { return state.offsetTop; },
      get pageLeft() { return state.offsetLeft; },
      get scale() { return state.scale; },
      addEventListener(type, callback) {
        if (typeof callback !== 'function') return;
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(callback);
      },
      removeEventListener(type, callback) {
        listeners.get(type)?.delete(callback);
      },
      dispatchEvent(event) {
        const type = event?.type || '';
        for (const callback of listeners.get(type) || []) {
          callback.call(fake, event);
        }
        const handler = fake[`on${type}`];
        if (typeof handler === 'function') handler.call(fake, event);
        return true;
      },
      onresize: null,
      onscroll: null,
    };

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      get() { return fake; },
    });

    window.__bananzaSetVisualViewport = (next = {}, eventType = 'resize') => {
      Object.assign(state, {
        width: Number(next.width ?? state.width) || state.width,
        height: Number(next.height ?? state.height) || state.height,
        offsetTop: Number(next.offsetTop ?? state.offsetTop) || 0,
        offsetLeft: Number(next.offsetLeft ?? state.offsetLeft) || 0,
        scale: Number(next.scale ?? state.scale) || 1,
      });
      fake.dispatchEvent(new Event(eventType));
    };
  });
}

async function setFakeVisualViewport(page, next, eventType = 'resize') {
  await page.evaluate(({ nextViewport, type }) => {
    window.__bananzaSetVisualViewport(nextViewport, type);
  }, { nextViewport: next, type: eventType });
}

async function registerViaUi(page, user) {
  const { baseUrl } = getContext();
  await page.goto(`${baseUrl}/login.html`);
  await page.locator('.tab[data-tab="register"]').click();
  await page.locator('#regUser').fill(user.username);
  await page.locator('#regName').fill(user.displayName);
  await page.locator('#regPass').fill(user.password);
  await page.locator('#regPassConfirm').fill(user.password);
  await page.locator('#registerForm .btn').click();
  await page.waitForURL(`${baseUrl}/`);
  await expect(page.locator('#chatList')).toBeVisible();
}

async function loginViaUi(page, user) {
  const { baseUrl } = getContext();
  await page.goto(`${baseUrl}/login.html`);
  await page.locator('#loginUser').fill(user.username);
  await page.locator('#loginPass').fill(user.password);
  await page.locator('#loginForm .btn').click();
  await page.waitForURL(`${baseUrl}/`);
  await expect(page.locator('#chatList')).toBeVisible();
}

async function openPrivateChat(page, displayName) {
  await page.locator('#newChatBtn').click();
  await expect(page.locator('#newChatModal')).toBeVisible();
  await page.locator('#userListPrivate .user-list-item').filter({ hasText: displayName }).first().click();
  await expect(page.locator('#chatTitle')).toContainText(displayName);
}

async function openExistingChat(page, label) {
  await page.locator('#chatList').getByText(label, { exact: false }).first().click();
  await expect(page.locator('#chatTitle')).toContainText(label);
}

async function sendComposerMessage(page, text) {
  await page.locator('#msgInput').fill(text);
  await page.locator('#sendBtn').click();
  await expect(page.locator('#messages')).toContainText(text);
}

async function openPollComposer(page, { mobile = false } = {}) {
  const searchPanel = page.locator('#searchPanel');
  if ((await searchPanel.getAttribute('aria-hidden')) === 'false') {
    await page.keyboard.press('Escape');
    await expect(searchPanel).toHaveAttribute('aria-hidden', 'true');
  }

  if (mobile) {
    await page.locator('#attachBtn').click();
    await expect(page.locator('#attachMenu')).toBeVisible();
    await page.locator('#attachMenuPoll').click();
  } else {
    await page.locator('#pollBtn').click();
  }
  await expect(page.locator('#pollComposerModal')).toBeVisible();
}

function messageRowByText(page, text) {
  return page.locator('.msg-row').filter({ hasText: text }).last();
}

async function getCurrentChatId(page) {
  const chatId = await page.locator('#chatList .chat-item.active').first().getAttribute('data-chat-id');
  const parsed = Number(chatId || 0);
  if (!parsed) throw new Error('Could not resolve current chat id from active chat row');
  return parsed;
}

async function openMessageActions(page, row, testInfo) {
  await expect(row).toBeVisible();
  await row.scrollIntoViewIfNeeded();
  if (isMobileProject(testInfo)) {
    await row.tap();
    await expect(page.locator('.msg-actions.actions-floating-open')).toBeVisible();
    return;
  }
  await row.hover();
  await expect(row.locator('.msg-actions')).toBeVisible();
}

async function clickMessageAction(page, row, selector, testInfo) {
  await openMessageActions(page, row, testInfo);
  const action = isMobileProject(testInfo)
    ? page.locator(`.msg-actions.actions-floating-open ${selector}`).first()
    : row.locator(selector).first();
  await expect(action).toBeVisible();
  await action.click({ force: true });
}

async function setupContextConvertForChat(chatId, options = {}) {
  const { adminUser } = getContext();
  const admin = createApiSession();
  await admin.login(adminUser);
  await admin.request('/api/admin/ai-bots/settings', {
    method: 'PUT',
    json: {
      enabled: true,
      openai_api_key: 'sk-playwright-context-convert',
      default_response_model: 'gpt-4o-mini',
    },
  });
  const created = await admin.request('/api/admin/openai-convert-bots', {
    method: 'POST',
    json: {
      name: String(options.name || `PW Convert ${Date.now().toString(36)}`).slice(0, 30),
      enabled: true,
      available_in_all_chats: true,
      response_model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 1000,
      transform_prompt: 'Rewrite the source text and return only the rewritten text.',
    },
  });
  await admin.request(`/api/chats/${chatId}/context-transform-settings`, {
    method: 'PUT',
    json: { context_transform_enabled: true },
  });
  return created.data.bot;
}

async function expectMobileScene(page, scene) {
  await expect.poll(async () => {
    return page.evaluate(() => window.BananzaAppBridge.__testing.getMobileBaseSceneSnapshot());
  }).toMatchObject(scene === 'sidebar'
    ? {
      scene: 'sidebar',
      sidebar: { sidebarHidden: false, mobileSceneHidden: false, inert: false },
      chatArea: { mobileSceneHidden: true, inert: true },
    }
    : {
      scene: 'chat',
      sidebar: { sidebarHidden: true, mobileSceneHidden: true, inert: true },
      chatArea: { mobileSceneHidden: false, inert: false },
    });
}

module.exports = {
  createApiSession,
  clickMessageAction,
  expectMobileScene,
  getCurrentChatId,
  getContext,
  installFakeVisualViewport,
  installMediaMocks,
  isDesktopProject,
  isMobileProject,
  loginViaUi,
  makeUser,
  messageRowByText,
  openExistingChat,
  openMessageActions,
  openPollComposer,
  openPrivateChat,
  registerViaUi,
  sendComposerMessage,
  setFakeVisualViewport,
  setupContextConvertForChat,
};
