const { expect } = require('@playwright/test');
const { createSession, makeUser } = require('../support/api');
const { readContext } = require('./context');

function getContext() {
  return readContext();
}

function createApiSession() {
  return createSession(getContext().baseUrl);
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

module.exports = {
  createApiSession,
  getContext,
  installMediaMocks,
  loginViaUi,
  makeUser,
  openExistingChat,
  openPollComposer,
  openPrivateChat,
  registerViaUi,
  sendComposerMessage,
};
