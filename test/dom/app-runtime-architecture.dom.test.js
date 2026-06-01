const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { repoRoot } = require('../support/paths');
const LEGACY_RUNTIME_LINE_LIMIT = 3200;

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
    '/js/app/boot/ws-dispatch.js',
    '/js/app/boot/events.js',
    '/js/app/boot/public-bridge.js',
    '/js/app/boot/chat-list-service.js',
    '/js/app/boot/open-chat-service.js',
    '/js/app/boot/messages-service.js',
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
    const maxLines = file === 'ws-dispatch.js' ? 950 : 250;
    assert.ok(lineCount(source) < maxLines, `${file} should stay below ${maxLines} lines`);
    if (file !== 'ws-dispatch.js') {
      assert.doesNotMatch(source, /\bCHAT LIST\b|\bMESSAGES\b|\bEVENT LISTENERS\b/);
    }
  }
});

test('legacy runtime no longer owns extracted shell and websocket sections', () => {
  const legacy = readRelative('public/js/app/boot/legacy-runtime.js');
  const indexHtml = readRelative('public/index.html');
  const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
  const legacyIndex = scripts.findIndex((src) => src.startsWith('/js/app/boot/legacy-runtime.js'));
  const extractedRuntimeScripts = [
    '/js/app/shell/ui-runtime.js',
    '/js/app/shell/shell-runtime.js',
    '/js/app/boot/ws-dispatch.js',
  ];
  const extractedRuntimeLimits = {
    'public/js/app/shell/ui-runtime.js': 2900,
    'public/js/app/shell/shell-runtime.js': 1450,
    'public/js/app/boot/ws-dispatch.js': 950,
  };

  assert.ok(lineCount(legacy) < LEGACY_RUNTIME_LINE_LIMIT, `legacy-runtime.js line count ${lineCount(legacy)} should stay below ${LEGACY_RUNTIME_LINE_LIMIT}`);
  assert.notEqual(legacyIndex, -1, 'legacy-runtime.js script must be present');

  for (const script of extractedRuntimeScripts) {
    const scriptIndex = scripts.findIndex((src) => src.startsWith(script));
    assert.notEqual(scriptIndex, -1, `${script} script must be present`);
    assert.ok(scriptIndex < legacyIndex, `${script} must load before legacy-runtime.js`);
    const filePath = `public${script}`;
    const source = readRelative(filePath);
    assert.ok(lineCount(source) < extractedRuntimeLimits[filePath], `${filePath} should stay below ${extractedRuntimeLimits[filePath]} lines`);
  }

  const forbiddenLegacySections = [
    /\bUTILS\b/,
    /\bWEBSOCKET\b/,
    /\bSIDEBAR RESIZE\b/,
    /\bMODALS\b/,
    /\bAUTO RESIZE TEXTAREA\b/,
    /\bEVENT LISTENERS\b/,
    /\bfunction\s+handleWSMessage\b/,
    /\bfunction\s+openNewChatModal\b/,
    /\bfunction\s+openChatInfoModal\b/,
    /\bfunction\s+setupProfileEvents\b/,
    /\bfunction\s+autoResize\b/,
    /\bfunction\s+createLegacyEventScope\b/,
  ];

  for (const pattern of forbiddenLegacySections) {
    assert.doesNotMatch(legacy, pattern, `legacy-runtime.js must not contain extracted legacy section ${pattern}`);
  }
});

test('ai admin provider ownership stays out of legacy runtime', () => {
  const legacy = readRelative('public/js/app/boot/legacy-runtime.js');
  const indexHtml = readRelative('public/index.html');
  const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
  const legacyIndex = scripts.findIndex((src) => src.startsWith('/js/app/boot/legacy-runtime.js'));
  const aiControllerIndex = scripts.findIndex((src) => src.startsWith('/js/app/ai-admin/controller.js'));

  const aiRuntimeScripts = [
    '/js/app/ai-admin/openai-runtime.js',
    '/js/app/ai-admin/local-providers-runtime.js',
    '/js/app/ai-admin/grok-runtime.js',
    '/js/app/ai-admin/context-chatshot-runtime.js',
    '/js/app/ai-admin/grok-image-risk-runtime.js',
  ];

  assert.ok(lineCount(legacy) < LEGACY_RUNTIME_LINE_LIMIT, `legacy-runtime.js line count ${lineCount(legacy)} should stay below ${LEGACY_RUNTIME_LINE_LIMIT}`);
  assert.notEqual(legacyIndex, -1, 'legacy-runtime.js script must be present');
  assert.notEqual(aiControllerIndex, -1, 'ai admin controller script must be present');

  for (const aiRuntimeScript of aiRuntimeScripts) {
    const scriptIndex = scripts.findIndex((src) => src.startsWith(aiRuntimeScript));
    assert.notEqual(scriptIndex, -1, `${aiRuntimeScript} script must be present`);
    assert.ok(scriptIndex < aiControllerIndex, `${aiRuntimeScript} must load before ai-admin/controller.js`);
    assert.ok(scriptIndex < legacyIndex, `${aiRuntimeScript} must load before legacy-runtime.js`);
  }

  const forbiddenLegacyProviderBodies = [
    /\bfunction\s+setOpenAiStatus\b/,
    /\bfunction\s+saveAiBot\b/,
    /\bfunction\s+setDeepseekAiStatus\b/,
    /\bfunction\s+setQwenAiStatus\b/,
    /\bfunction\s+setYandexAiStatus\b/,
    /\bfunction\s+setGrokStatus\b/,
    /\bfunction\s+retryGrokImageRiskPrompt\b/,
    /\bfunction\s+contextConvertProviderLabel\b/,
    /\bfunction\s+renderContextConvertAdminSettings\b/,
    /\bfunction\s+runChatShotGeneration\b/,
  ];

  for (const pattern of forbiddenLegacyProviderBodies) {
    assert.doesNotMatch(legacy, pattern, `legacy-runtime.js must not contain provider body ${pattern}`);
  }
});

test('core auth api and websocket ownership lives in boot modules', () => {
  const legacy = readRelative('public/js/app/boot/legacy-runtime.js');
  const api = readRelative('public/js/app/boot/api.js');
  const auth = readRelative('public/js/app/boot/auth.js');
  const websocket = readRelative('public/js/app/boot/websocket.js');
  const wsDispatch = readRelative('public/js/app/boot/ws-dispatch.js');

  assert.ok(lineCount(legacy) < LEGACY_RUNTIME_LINE_LIMIT, `legacy-runtime.js line count ${lineCount(legacy)} should keep trending down`);
  assert.doesNotMatch(legacy, /\basync\s+function\s+api\b|\bfunction\s+api\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+checkAuth\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+logout\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+connectWS\b/);
  assert.doesNotMatch(legacy, /authService\.configure/);
  assert.doesNotMatch(legacy, /websocketService\.configure/);
  assert.match(legacy, /coreApiService\.request/);

  assert.match(api, /\basync\s+function\s+request\b/);
  assert.match(auth, /\bfunction\s+configure\b/);
  assert.match(auth, /\bfunction\s+checkAuth\b/);
  assert.match(auth, /\bfunction\s+logout\b/);
  assert.match(websocket, /\bfunction\s+configure\b/);
  assert.match(websocket, /\bfunction\s+connect\b/);
  assert.match(wsDispatch, /websocketService\.configure/);
});

test('chat list state and presence ownership lives behind boot service', () => {
  const legacy = readRelative('public/js/app/boot/legacy-runtime.js');
  const chatListService = readRelative('public/js/app/boot/chat-list-service.js');
  const state = readRelative('public/js/app/boot/state.js');

  assert.ok(lineCount(legacy) < LEGACY_RUNTIME_LINE_LIMIT, `legacy-runtime.js line count ${lineCount(legacy)} should stay below ${LEGACY_RUNTIME_LINE_LIMIT}`);
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

test('open chat pagination and scroll ownership lives behind open-chat service', () => {
  const legacy = readRelative('public/js/app/boot/legacy-runtime.js');
  const openChatService = readRelative('public/js/app/boot/open-chat-service.js');
  const openChatController = readRelative('public/js/app/open-chat/controller.js');
  const state = readRelative('public/js/app/boot/state.js');

  assert.ok(lineCount(legacy) < LEGACY_RUNTIME_LINE_LIMIT, `legacy-runtime.js line count ${lineCount(legacy)} should stay below ${LEGACY_RUNTIME_LINE_LIMIT}`);
  assert.match(openChatService, /createOpenChatService/);
  assert.match(openChatService, /scrollToBottom/);
  assert.match(openChatService, /loadMoreAfter/);
  assert.match(openChatController, /setCurrentChat/);
  assert.match(openChatController, /setStateMessages/);
  assert.match(state, /setCurrentChat/);
  assert.match(state, /mergeMessages/);
  assert.doesNotMatch(legacy, /\bOPEN CHAT\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+openChat\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+loadMessages\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+loadMoreMessages\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+loadMore\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+loadMoreAfter\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+scrollToBottom\b/);
  assert.doesNotMatch(legacy, /\bfunction\s+restoreScrollAnchor\b/);
  assert.match(legacy, /openChatService\.configure/);
  assert.match(legacy, /openChatService\.openChat/);
});

test('message rendering update and outbox ownership lives behind messages service', () => {
  const legacy = readRelative('public/js/app/boot/legacy-runtime.js');
  const messagesService = readRelative('public/js/app/boot/messages-service.js');
  const state = readRelative('public/js/app/boot/state.js');

  assert.ok(lineCount(legacy) < LEGACY_RUNTIME_LINE_LIMIT, `legacy-runtime.js line count ${lineCount(legacy)} should keep trending down`);
  assert.match(messagesService, /createMessagesService/);
  assert.match(messagesService, /replaceRenderedMessages/);
  assert.match(messagesService, /appendMessage/);
  assert.match(messagesService, /applyMessageUpdate/);
  assert.match(messagesService, /completeOutboxSend/);
  assert.match(state, /setMessages/);
  assert.match(state, /mergeMessages/);

  const forbiddenLegacyPatterns = [
    /\bMESSAGES\b/,
    /\bSEND MESSAGE\b/,
    /\bfunction\s+renderMessages\b/,
    /\bfunction\s+appendMessage\b/,
    /\bfunction\s+createMessageEl\b/,
    /\bfunction\s+replaceRenderedMessages\b/,
    /\bfunction\s+applyMessageUpdate\b/,
    /\bfunction\s+updateRowStatus\b/,
    /\bfunction\s+renderOutboxForChat\b/,
    /\bfunction\s+completeOutboxSend\b/,
    /\bfunction\s+renderPollCard\b/,
    /\bfunction\s+renderFileAttachment\b/,
    /\bfunction\s+renderCallMessageMeta\b/,
  ];

  for (const pattern of forbiddenLegacyPatterns) {
    assert.doesNotMatch(legacy, pattern, `legacy-runtime.js must not contain ${pattern}`);
  }

  assert.match(legacy, /messagesService\.configure/);
  assert.match(legacy, /messagesService\?\.appendMessage|messageServiceCall/);
});
