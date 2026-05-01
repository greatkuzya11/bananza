const path = require('path');
const WebSocket = require('ws');
const { fixturesRoot } = require('./paths');

function assertExpectedStatus(status, expectedStatus, body, url) {
  const allowed = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (allowed.includes(status)) return;
  const error = new Error(`Expected HTTP ${allowed.join(' or ')}, got ${status} for ${url}`);
  error.status = status;
  error.body = body;
  throw error;
}

function parseBody(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function randomSuffix() {
  return `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 6)}`;
}

function makeUser(prefix = 'user') {
  const suffix = randomSuffix();
  const safePrefix = String(prefix).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 8) || 'user';
  const username = `${safePrefix}_${suffix}`.slice(0, 20);
  return {
    username,
    password: 'bananza_test_password',
    displayName: `${safePrefix} ${suffix}`.slice(0, 30),
  };
}

class ApiSession {
  constructor(baseUrl, { token = '', user = null } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.token = token;
    this.user = user;
  }

  clone() {
    return new ApiSession(this.baseUrl, {
      token: this.token,
      user: this.user,
    });
  }

  async request(route, {
    method = 'GET',
    json,
    body,
    formData,
    headers = {},
    searchParams,
    expectedStatus = 200,
  } = {}) {
    const url = new URL(route, `${this.baseUrl}/`);
    if (searchParams && typeof searchParams === 'object') {
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value == null) return;
        url.searchParams.set(key, String(value));
      });
    }

    const init = {
      method,
      headers: {
        ...headers,
      },
    };
    if (this.token) {
      init.headers.Authorization = `Bearer ${this.token}`;
    }
    if (json !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(json);
    } else if (formData) {
      init.body = formData;
    } else if (body !== undefined) {
      init.body = body;
    }

    const res = await fetch(url, init);
    const text = await res.text();
    const data = parseBody(text);
    assertExpectedStatus(res.status, expectedStatus, data, url.href);
    return {
      status: res.status,
      data,
      headers: Object.fromEntries(res.headers.entries()),
    };
  }

  async register(user = makeUser()) {
    const { data } = await this.request('/api/auth/register', {
      method: 'POST',
      json: {
        username: user.username,
        password: user.password,
        displayName: user.displayName,
      },
    });
    this.token = data.token;
    this.user = data.user;
    return { ...user, ...data };
  }

  async login({ username, password }) {
    const { data } = await this.request('/api/auth/login', {
      method: 'POST',
      json: { username, password },
    });
    this.token = data.token;
    this.user = data.user;
    return data;
  }

  async openWebSocket() {
    if (!this.token) throw new Error('Cannot open WebSocket without auth token');
    const wsUrl = `${this.baseUrl.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(this.token)}`;
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        socket.terminate();
        reject(new Error(`WebSocket timeout for ${wsUrl}`));
      }, 10_000);
      socket.once('open', () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  async uploadTextFile(filename = 'note.txt', text = 'Bananza attachment') {
    return this.uploadFile({
      filename,
      mimeType: 'text/plain',
      body: text,
    });
  }

  async uploadPngFile(filename = 'pixel.png') {
    const png = Buffer.from(
      '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6360606060000000040001F61738550000000049454E44AE426082',
      'hex'
    );
    return this.uploadFile({
      filename,
      mimeType: 'image/png',
      body: png,
    });
  }

  async uploadFile({
    filename = 'attachment.bin',
    mimeType = 'application/octet-stream',
    body = '',
    poster = null,
  } = {}) {
    const form = new FormData();
    form.append('file', new Blob([body], { type: mimeType }), filename);
    if (poster) {
      form.append(
        'poster',
        new Blob([poster.body ?? ''], { type: poster.mimeType || 'image/jpeg' }),
        poster.filename || 'poster.jpg'
      );
    }
    const { data } = await this.request('/api/upload', {
      method: 'POST',
      formData: form,
    });
    return data;
  }
}

function createSession(baseUrl) {
  return new ApiSession(baseUrl);
}

function fixturePath(name) {
  return path.join(fixturesRoot, name);
}

function waitForSocketMessage(socket, predicate, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error('Timed out waiting for WebSocket message'));
    }, timeoutMs);

    function onMessage(raw) {
      try {
        const message = JSON.parse(String(raw));
        if (!predicate(message)) return;
        clearTimeout(timer);
        socket.off('message', onMessage);
        resolve(message);
      } catch {}
    }

    socket.on('message', onMessage);
  });
}

module.exports = {
  ApiSession,
  createSession,
  fixturePath,
  makeUser,
  waitForSocketMessage,
};
