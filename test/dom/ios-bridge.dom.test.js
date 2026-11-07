const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

test('native bridge preserves Android payloads and routes iOS commands asynchronously', async () => {
  const dom = new JSDOM('', { url: 'https://chat.example.com', runScripts: 'outside-only' });
  const { window } = dom;
  window.eval(fs.readFileSync(path.join(__dirname, '../../public/js/app/android-bridge.js'), 'utf8'));
  const bridge = window.BananzaApp.nativeBridge;
  assert.equal(bridge.hasNativeBridge(), false);
  const android = [];
  window.BananzaAndroid = { postMessage: value => android.push(JSON.parse(value)) };
  window.BananzaApp.androidBridge.notifyAndroidScreenRotationPreference(false);
  assert.equal(android[0].type, 'screen_rotation_preference');
  assert.equal(android[0].payload.allowed, false);
  const ios = [];
  window.BananzaIOS = { request: async (type, payload) => { ios.push({ type, payload }); } };
  assert.equal(bridge.isIOS(), true);
  window.BananzaApp.androidBridge.notifyAndroidMobileFontSize(7, true);
  await Promise.resolve();
  assert.equal(ios[0].type, 'mobile_font_size'); assert.equal(ios[0].payload.size, 7);
  assert.equal(android.length, 1); dom.window.close();
});

test('injected iOS bootstrap refuses a different origin and synchronizes token removal', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../../ios/BananZa/Resources/native-bootstrap.js'), 'utf8');
  const dom = new JSDOM('', { url: 'https://chat.example.com', runScripts: 'outside-only' });
  const { window } = dom; const messages = [];
  window.webkit = { messageHandlers: { bananza: { postMessage: async message => { messages.push(message); return {}; } } } };
  window.__bananzaTrustedOrigin = 'https://different.example.com'; window.eval(source);
  assert.equal(window.BananzaIOS, undefined);
  window.__bananzaTrustedOrigin = 'https://chat.example.com'; window.eval(source);
  window.localStorage.setItem('token', 'session-token');
  window.localStorage.removeItem('token');
  assert.equal(messages.at(-2).payload.token, 'session-token');
  assert.equal(messages.at(-1).payload.token, '');
  assert.equal(messages.at(-1).version, 1); dom.window.close();
});
