const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { repoRoot } = require('../support/paths');

function readRelative(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
}

function lineCount(source) {
  return source.trim().split(/\r?\n/).length;
}

test('app runtime entrypoint stays a small boot shell', () => {
  const appJs = readRelative('public/js/app.js');
  const runtimeJs = readRelative('public/js/app/runtime.js');

  assert.ok(lineCount(appJs) < 100, `public/js/app.js line count ${lineCount(appJs)} should stay below 100`);
  assert.ok(lineCount(runtimeJs) < 800, `public/js/app/runtime.js line count ${lineCount(runtimeJs)} should stay below 800`);
  assert.match(runtimeJs, /createAppRuntime/);
  assert.match(runtimeJs, /boot\.init/);

  const forbiddenRuntimePatterns = [
    /\bCHAT LIST\b/,
    /\bOPEN CHAT\b/,
    /\bMESSAGES\b/,
    /\bSEND MESSAGE\b/,
    /\bINTERACTIONS\b/,
    /\bEMOJI PICKER\b/,
    /\bMODALS\b/,
    /\bAUTO RESIZE TEXTAREA\b/,
    /\bEVENT LISTENERS\b/,
    /\bfunction\s+renderMessage\b/,
    /\bfunction\s+sendMessage\b/,
    /\bfunction\s+openChat\b/,
    /\bfunction\s+renderChatList\b/,
    /\bfunction\s+showSettingsModal\b/,
    /\bfunction\s+setupContextMenu\b/,
    /\bfunction\s+saveAiBot\b/,
    /\bopenai\b/i,
    /\byandex\b/i,
    /\bdeepseek\b/i,
    /\bqwen\b/i,
    /\bgrok\b/i,
  ];

  for (const pattern of forbiddenRuntimePatterns) {
    assert.doesNotMatch(runtimeJs, pattern, `runtime.js must not contain ${pattern}`);
  }
});

test('boot scripts are explicit and load before runtime entrypoint', () => {
  const indexHtml = readRelative('public/index.html');
  const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
  const runtimeIndex = scripts.findIndex((src) => src.startsWith('/js/app/runtime.js'));

  const bootScripts = [
    '/js/app/boot/state.js',
    '/js/app/boot/runtime-context.js',
    '/js/app/boot/api.js',
    '/js/app/boot/auth.js',
    '/js/app/boot/websocket.js',
    '/js/app/boot/events.js',
    '/js/app/boot/public-bridge.js',
    '/js/app/boot/chat-list-service.js',
    '/js/app/boot/legacy-runtime.js',
    '/js/app/boot/init.js',
  ];

  assert.notEqual(runtimeIndex, -1, 'runtime.js script must be present');
  for (const bootScript of bootScripts) {
    const scriptIndex = scripts.findIndex((src) => src.startsWith(bootScript));
    assert.notEqual(scriptIndex, -1, `${bootScript} script must be present`);
    assert.ok(scriptIndex < runtimeIndex, `${bootScript} must load before runtime.js`);
  }
});

test('new boot modules stay small and keep legacy debt isolated', () => {
  const bootDir = path.join(repoRoot, 'public/js/app/boot');
  const files = fs.readdirSync(bootDir)
    .filter((name) => name.endsWith('.js'))
    .sort();

  assert.ok(files.includes('legacy-runtime.js'), 'legacy-runtime.js must stay explicitly named while old closure debt remains');

  for (const file of files) {
    if (file === 'legacy-runtime.js') continue;
    const source = readRelative(`public/js/app/boot/${file}`);
    assert.ok(lineCount(source) < 250, `${file} should stay below 250 lines`);
    assert.doesNotMatch(source, /\bCHAT LIST\b|\bMESSAGES\b|\bEVENT LISTENERS\b/);
  }
});

test('core auth api and websocket ownership lives in boot modules', () => {
  const legacy = readRelative('public/js/app/boot/legacy-runtime.js');
  const api = readRelative('public/js/app/boot/api.js');
  const auth = readRelative('public/js/app/boot/auth.js');
  const websocket = readRelative('public/js/app/boot/websocket.js');

  assert.ok(lineCount(legacy) < 16650, `legacy-runtime.js line count ${lineCount(legacy)} should keep trending down`);
  assert.doesNotMatch(legacy, /\basync\s+function\s+api\b|\bfunction\s+api\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+checkAuth\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+logout\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+connectWS\b/);
  assert.match(legacy, /coreApiService\.request/);
  assert.match(legacy, /authService\.configure/);
  assert.match(legacy, /websocketService\.configure/);

  assert.match(api, /\basync\s+function\s+request\b/);
  assert.match(auth, /\bfunction\s+checkAuth\b/);
  assert.match(auth, /\bfunction\s+logout\b/);
  assert.match(websocket, /\bfunction\s+connect\b/);
});

test('chat list state and presence ownership lives behind boot service', () => {
  const legacy = readRelative('public/js/app/boot/legacy-runtime.js');
  const chatListService = readRelative('public/js/app/boot/chat-list-service.js');
  const state = readRelative('public/js/app/boot/state.js');

  assert.ok(lineCount(legacy) < 16550, `legacy-runtime.js line count ${lineCount(legacy)} should stay below 16550`);
  assert.match(chatListService, /createChatListService/);
  assert.match(chatListService, /setOnlineUsers/);
  assert.match(state, /syncChatListStore/);
  assert.doesNotMatch(legacy, /\bfunction\s+renderChatList\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+loadChats\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+loadAllUsers\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+hydrateChatListCache\b/);
  assert.match(legacy, /chatListService\.configure/);
  assert.match(legacy, /chatListService\.getChats/);
});
