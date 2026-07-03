const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { repoRoot } = require('../support/paths');
const RUNTIME_ASSEMBLY_LINE_LIMIT = 160;
const FEATURE_COMPOSITION_LINE_LIMIT = 180;
const COMPOSITION_SCRIPTS = [
  '/js/app/boot/composition/export-utils.js',
  '/js/app/boot/composition/feature-primitives.js',
  '/js/app/boot/composition/dom-shell.js',
  '/js/app/boot/composition/runtime-proxy-scope.js',
  '/js/app/boot/composition/ai-admin-composition.js',
  '/js/app/boot/composition/ui-shell-adapters.js',
  '/js/app/boot/composition/admin-settings-composition.js',
  '/js/app/boot/composition/folders-composition.js',
  '/js/app/boot/composition/chat-list-composition.js',
  '/js/app/boot/composition/open-chat-composition.js',
  '/js/app/boot/composition/messages-composition.js',
  '/js/app/boot/composition/composer-composition.js',
  '/js/app/boot/composition/shell-runtime-composition.js',
  '/js/app/boot/composition/interactions-composition.js',
];
const COMPOSITION_FILE_LIMITS = {
  'public/js/app/boot/composition/export-utils.js': 120,
  'public/js/app/boot/composition/feature-primitives.js': 120,
  'public/js/app/boot/composition/dom-shell.js': 450,
  'public/js/app/boot/composition/runtime-proxy-scope.js': 120,
  'public/js/app/boot/composition/ai-admin-composition.js': 620,
  'public/js/app/boot/composition/ui-shell-adapters.js': 140,
  'public/js/app/boot/composition/admin-settings-composition.js': 300,
  'public/js/app/boot/composition/folders-composition.js': 220,
  'public/js/app/boot/composition/chat-list-composition.js': 300,
  'public/js/app/boot/composition/open-chat-composition.js': 300,
  'public/js/app/boot/composition/messages-composition.js': 350,
  'public/js/app/boot/composition/composer-composition.js': 320,
  'public/js/app/boot/composition/shell-runtime-composition.js': 100,
  'public/js/app/boot/composition/interactions-composition.js': 320,
};

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
  const appIndex = scripts.findIndex((src) => src.startsWith('/js/app.js'));
  const performanceIndex = scripts.findIndex((src) => src.startsWith('/js/app/performance.js'));
  const featureLoaderIndex = scripts.findIndex((src) => src.startsWith('/js/app/feature-loader.js'));
  const featureRegistryIndex = scripts.findIndex((src) => src.startsWith('/js/app/feature-registry.js'));

  const bootScripts = [
    '/js/app/boot/state.js',
    '/js/app/boot/runtime-context.js',
    '/js/app/boot/api.js',
    '/js/app/boot/auth.js',
    '/js/app/boot/websocket.js',
    '/js/app/boot/ws-dispatch.js',
    '/js/app/boot/runtime-core.js',
    ...COMPOSITION_SCRIPTS,
    '/js/app/boot/feature-composition.js',
    '/js/app/boot/events.js',
    '/js/app/boot/public-bridge.js',
    '/js/app/boot/chat-list-service.js',
    '/js/app/boot/open-chat-service.js',
    '/js/app/boot/messages-service.js',
    '/js/app/boot/runtime-assembly.js',
    '/js/app/boot/init.js',
  ];

  assert.notEqual(runtimeIndex, -1, 'runtime.js script must be present');
  assert.notEqual(appIndex, -1, 'app.js script must be present');
  assert.notEqual(performanceIndex, -1, 'performance helper script must be present');
  assert.notEqual(featureLoaderIndex, -1, 'feature-loader.js script must be present');
  assert.notEqual(featureRegistryIndex, -1, 'feature-registry.js script must be present');
  assert.ok(performanceIndex < runtimeIndex, 'performance helper must load before runtime.js');
  assert.ok(performanceIndex < appIndex, 'performance helper must load before app.js');
  assert.ok(performanceIndex < featureLoaderIndex, 'feature-loader.js must load after performance.js');
  assert.ok(featureLoaderIndex < featureRegistryIndex, 'feature-registry.js must load after feature-loader.js');
  assert.ok(featureRegistryIndex < runtimeIndex, 'feature-registry.js must load before runtime.js');
  assert.ok(featureRegistryIndex < appIndex, 'feature-registry.js must load before app.js');
  for (const bootScript of bootScripts) {
    const scriptIndex = scripts.findIndex((src) => src.startsWith(bootScript));
    assert.notEqual(scriptIndex, -1, `${bootScript} script must be present`);
    assert.ok(scriptIndex < runtimeIndex, `${bootScript} must load before runtime.js`);
  }
});

test('performance baseline helper is loaded early and initial app scripts stay bounded', () => {
  const indexHtml = readRelative('public/index.html');
  const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
  const appScripts = scripts
    .filter((src) => src.startsWith('/js/app'))
    .map((src) => src.split('?')[0]);

  assert.ok(appScripts.includes('/js/app/performance.js'), 'performance helper must be in the app script graph');
  assert.ok(appScripts.includes('/js/app/feature-loader.js'), 'feature loader must be in the app script graph');
  assert.ok(appScripts.includes('/js/app/feature-registry.js'), 'feature registry must be in the app script graph');
  assert.ok(appScripts.length <= 99, `initial /js/app script count ${appScripts.length} should stay at or below the lazy-load target`);
  [
    '/js/app/admin/bot-audit.js',
    '/js/app/admin/backup.js',
    '/js/app/admin/users.js',
    '/js/app/ai-admin/shared.js',
    '/js/app/ai-admin/openai.js',
    '/js/app/ai-admin/events.js',
    '/js/app/ai-admin/controller.js',
  ].forEach((script) => {
    assert.ok(!appScripts.includes(script), `${script} must stay out of the initial app script graph`);
  });
  [
    '/js/app/ai-admin/openai-runtime.js',
    '/js/app/ai-admin/local-providers-runtime.js',
    '/js/app/ai-admin/grok-runtime.js',
    '/js/app/ai-admin/context-chatshot-runtime.js',
    '/js/app/ai-admin/grok-image-risk-runtime.js',
  ].forEach((script) => {
    assert.ok(!appScripts.includes(script), `${script} must stay out of the initial app script graph`);
  });

  const performanceSource = readRelative('public/js/app/performance.js');
  const featureLoaderSource = readRelative('public/js/app/feature-loader.js');
  const featureRegistrySource = readRelative('public/js/app/feature-registry.js');
  assert.match(performanceSource, /getSummary/);
  assert.match(performanceSource, /resetForTests/);
  assert.match(performanceSource, /bananza:startup-total/);
  assert.ok(lineCount(featureLoaderSource) < 300, 'feature-loader.js should stay below 300 lines');
  assert.ok(lineCount(featureRegistrySource) < 200, 'feature-registry.js should stay below 200 lines');
  assert.match(featureLoaderSource, /loadFeature/);
  assert.match(featureLoaderSource, /preloadByStrategy/);
  assert.match(featureRegistrySource, /ai-admin/);
  assert.match(featureRegistrySource, /admin-idle/);
  assert.match(featureRegistrySource, /interaction/);
});

test('new boot modules stay small and keep assembly debt visible', () => {
  const bootDir = path.join(repoRoot, 'public/js/app/boot');
  const files = fs.readdirSync(bootDir)
    .filter((name) => name.endsWith('.js'))
    .sort();

  assert.ok(files.includes('runtime-assembly.js'), 'runtime-assembly.js must stay explicitly named while runtime assembly remains');

  for (const file of files) {
    if (file === 'runtime-assembly.js') continue;
    const source = readRelative(`public/js/app/boot/${file}`);
    const lineLimits = {
      'feature-composition.js': FEATURE_COMPOSITION_LINE_LIMIT,
      'init.js': 250,
      'public-bridge.js': 550,
      'runtime-core.js': 700,
      'ws-dispatch.js': 950,
    };
    const maxLines = lineLimits[file] || 250;
    assert.ok(lineCount(source) < maxLines, `${file} should stay below ${maxLines} lines`);
    if (file !== 'ws-dispatch.js' && file !== 'feature-composition.js') {
      assert.doesNotMatch(source, /\bCHAT LIST\b|\bMESSAGES\b|\bEVENT LISTENERS\b/);
    }
  }
});

test('feature composition is a small orchestrator and composition files stay bounded', () => {
  const indexHtml = readRelative('public/index.html');
  const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
  const runtimeCoreIndex = scripts.findIndex((src) => src.startsWith('/js/app/boot/runtime-core.js'));
  const featureCompositionIndex = scripts.findIndex((src) => src.startsWith('/js/app/boot/feature-composition.js'));
  const featureComposition = readRelative('public/js/app/boot/feature-composition.js');

  assert.notEqual(runtimeCoreIndex, -1, 'runtime-core.js script must be present');
  assert.notEqual(featureCompositionIndex, -1, 'feature-composition.js script must be present');
  assert.ok(lineCount(featureComposition) < FEATURE_COMPOSITION_LINE_LIMIT, `feature-composition.js should stay below ${FEATURE_COMPOSITION_LINE_LIMIT} lines`);
  assert.match(featureComposition, /composeFeatureRuntime/);

  const forbiddenFeatureCompositionPatterns = [
    /__bananzaRuntimeExportNames/,
    /\bfunction\s+createRuntimeProxyScope\b/,
    /\bfunction\s+createFallbackDomRefs\b/,
    /createMessageRenderer/,
    /createChatListStore/,
    /createOpenChatController/,
    /installRuntimeModules/,
    /createUiRuntimeAdapter/,
    /createShellRuntimeAdapter/,
    /window\.BananzaApp\?\.composer/,
    /window\.BananzaApp\?\.messages/,
    /window\.BananzaApp\?\.chatList/,
    /window\.BananzaApp\?\.folders/,
    /window\.BananzaApp\?\.interactions/,
    /window\.BananzaApp\?\.aiAdmin/,
  ];

  for (const pattern of forbiddenFeatureCompositionPatterns) {
    assert.doesNotMatch(featureComposition, pattern, `feature-composition.js must not contain ${pattern}`);
  }

  for (const script of COMPOSITION_SCRIPTS) {
    const scriptIndex = scripts.findIndex((src) => src.startsWith(script));
    const filePath = `public${script}`;
    const source = readRelative(filePath);
    const maxLines = COMPOSITION_FILE_LIMITS[filePath] || 450;
    assert.notEqual(scriptIndex, -1, `${script} script must be present`);
    assert.ok(runtimeCoreIndex < scriptIndex, `${script} must load after runtime-core.js`);
    assert.ok(scriptIndex < featureCompositionIndex, `${script} must load before feature-composition.js`);
    assert.ok(lineCount(source) < maxLines, `${filePath} should stay below ${maxLines} lines`);
    assert.doesNotMatch(source, /__bananzaRuntimeExportNames/, `${filePath} must not keep the old monolithic export registry`);
  }
});

test('runtime assembly no longer owns extracted shell and websocket sections', () => {
  const assembly = readRelative('public/js/app/boot/runtime-assembly.js');
  const indexHtml = readRelative('public/index.html');
  const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
  const assemblyIndex = scripts.findIndex((src) => src.startsWith('/js/app/boot/runtime-assembly.js'));
  const extractedRuntimeScripts = [
    '/js/app/shell/ui-runtime.js',
    '/js/app/shell/shell-runtime.js',
    '/js/app/shell/mobile-runtime-adapters.js',
    '/js/app/boot/ws-dispatch.js',
    '/js/app/boot/runtime-core.js',
    ...COMPOSITION_SCRIPTS,
    '/js/app/boot/feature-composition.js',
  ];
  const extractedRuntimeLimits = {
    'public/js/app/shell/ui-runtime.js': 3100,
    'public/js/app/shell/shell-runtime.js': 1500,
    'public/js/app/shell/mobile-runtime-adapters.js': 150,
    'public/js/app/boot/ws-dispatch.js': 950,
    'public/js/app/boot/runtime-core.js': 700,
    'public/js/app/boot/feature-composition.js': FEATURE_COMPOSITION_LINE_LIMIT,
    ...COMPOSITION_FILE_LIMITS,
  };

  assert.ok(lineCount(assembly) < RUNTIME_ASSEMBLY_LINE_LIMIT, `runtime-assembly.js line count ${lineCount(assembly)} should stay below ${RUNTIME_ASSEMBLY_LINE_LIMIT}`);
  assert.notEqual(assemblyIndex, -1, 'runtime-assembly.js script must be present');

  for (const script of extractedRuntimeScripts) {
    const scriptIndex = scripts.findIndex((src) => src.startsWith(script));
    assert.notEqual(scriptIndex, -1, `${script} script must be present`);
    assert.ok(scriptIndex < assemblyIndex, `${script} must load before runtime-assembly.js`);
    const filePath = `public${script}`;
    const source = readRelative(filePath);
    assert.ok(lineCount(source) < extractedRuntimeLimits[filePath], `${filePath} should stay below ${extractedRuntimeLimits[filePath]} lines`);
  }

  const forbiddenAssemblySections = [
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
    /\bfunction\s+createRuntimeEventScope\b/,
    /\bfunction\s+getMobileAppViewportHeight\b/,
    /\bconst\s+composerFactories\b/,
    /\bfunction\s+createRuntimeProxyScope\b/,
    /Object\.assign\(appBridge/,
    /\basync\s+function\s+init\b/,
  ];

  for (const pattern of forbiddenAssemblySections) {
    assert.doesNotMatch(assembly, pattern, `runtime-assembly.js must not contain extracted runtime section ${pattern}`);
  }
});

test('runtime composition and adapters do not expose legacy naming', () => {
  const files = [
    'public/js/app/boot/runtime-assembly.js',
    'public/js/app/boot/runtime-core.js',
    'public/js/app/boot/feature-composition.js',
    ...COMPOSITION_SCRIPTS.map((script) => `public${script}`),
    'public/js/app/boot/public-bridge.js',
    'public/js/app/boot/ws-dispatch.js',
    'public/js/app/boot/init.js',
    'public/js/app/shell/ui-runtime.js',
    'public/js/app/shell/shell-runtime.js',
    'public/js/app/shell/mobile-runtime-adapters.js',
    'public/js/app/ai-admin/controller.js',
    'public/js/app/ai-admin/openai-runtime.js',
    'public/js/app/ai-admin/local-providers-runtime.js',
    'public/js/app/ai-admin/grok-runtime.js',
    'public/js/app/ai-admin/grok-image-risk-runtime.js',
    'public/js/app/ai-admin/context-chatshot-runtime.js',
  ];

  for (const file of files) {
    assert.doesNotMatch(readRelative(file), /legacy/i, `${file} must not expose legacy runtime naming`);
  }
});

test('ai admin provider ownership stays out of runtime assembly', () => {
  const assembly = readRelative('public/js/app/boot/runtime-assembly.js');
  const indexHtml = readRelative('public/index.html');
  const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
  const assemblyIndex = scripts.findIndex((src) => src.startsWith('/js/app/boot/runtime-assembly.js'));

  const aiRuntimeScripts = [
    '/js/app/ai-admin/openai-runtime.js',
    '/js/app/ai-admin/local-providers-runtime.js',
    '/js/app/ai-admin/grok-runtime.js',
    '/js/app/ai-admin/context-chatshot-runtime.js',
    '/js/app/ai-admin/grok-image-risk-runtime.js',
  ];

  assert.ok(lineCount(assembly) < RUNTIME_ASSEMBLY_LINE_LIMIT, `runtime-assembly.js line count ${lineCount(assembly)} should stay below ${RUNTIME_ASSEMBLY_LINE_LIMIT}`);
  assert.notEqual(assemblyIndex, -1, 'runtime-assembly.js script must be present');
  assert.equal(scripts.findIndex((src) => src.startsWith('/js/app/ai-admin/controller.js')), -1, 'ai admin controller script must be lazy-loaded');
  assert.equal(scripts.findIndex((src) => src.startsWith('/js/app/ai-admin/events.js')), -1, 'ai admin events script must be lazy-loaded');
  assert.equal(scripts.findIndex((src) => src.startsWith('/js/app/admin/users.js')), -1, 'generic admin scripts must be lazy-loaded');

  for (const aiRuntimeScript of aiRuntimeScripts) {
    const scriptIndex = scripts.findIndex((src) => src.startsWith(aiRuntimeScript));
    assert.equal(scriptIndex, -1, `${aiRuntimeScript} script must be lazy-loaded outside the initial script graph`);
  }

  const forbiddenAssemblyProviderBodies = [
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

  for (const pattern of forbiddenAssemblyProviderBodies) {
    assert.doesNotMatch(assembly, pattern, `runtime-assembly.js must not contain provider body ${pattern}`);
  }
});

test('core auth api and websocket ownership lives in boot modules', () => {
  const assembly = readRelative('public/js/app/boot/runtime-assembly.js');
  const runtimeCore = readRelative('public/js/app/boot/runtime-core.js');
  const api = readRelative('public/js/app/boot/api.js');
  const auth = readRelative('public/js/app/boot/auth.js');
  const websocket = readRelative('public/js/app/boot/websocket.js');
  const wsDispatch = readRelative('public/js/app/boot/ws-dispatch.js');

  assert.ok(lineCount(assembly) < RUNTIME_ASSEMBLY_LINE_LIMIT, `runtime-assembly.js line count ${lineCount(assembly)} should keep trending down`);
  assert.doesNotMatch(assembly, /\basync\s+function\s+api\b|\bfunction\s+api\b/);
  assert.doesNotMatch(assembly, /\bfunction\s+checkAuth\b/);
  assert.doesNotMatch(assembly, /\bfunction\s+logout\b/);
  assert.doesNotMatch(assembly, /\bfunction\s+connectWS\b/);
  assert.doesNotMatch(assembly, /authService\.configure/);
  assert.doesNotMatch(assembly, /websocketService\.configure/);
  assert.doesNotMatch(assembly, /coreApiService\.request/);
  assert.match(runtimeCore, /coreApiService\.request/);

  assert.match(api, /\basync\s+function\s+request\b/);
  assert.match(auth, /\bfunction\s+configure\b/);
  assert.match(auth, /\bfunction\s+checkAuth\b/);
  assert.match(auth, /\bfunction\s+logout\b/);
  assert.match(websocket, /\bfunction\s+configure\b/);
  assert.match(websocket, /\bfunction\s+connect\b/);
  assert.match(wsDispatch, /websocketService\.configure/);
});

test('chat list state and presence ownership lives behind boot service', () => {
  const assembly = readRelative('public/js/app/boot/runtime-assembly.js');
  const chatListComposition = readRelative('public/js/app/boot/composition/chat-list-composition.js');
  const chatListService = readRelative('public/js/app/boot/chat-list-service.js');
  const state = readRelative('public/js/app/boot/state.js');

  assert.ok(lineCount(assembly) < RUNTIME_ASSEMBLY_LINE_LIMIT, `runtime-assembly.js line count ${lineCount(assembly)} should stay below ${RUNTIME_ASSEMBLY_LINE_LIMIT}`);
  assert.match(chatListService, /createChatListService/);
  assert.match(chatListService, /setOnlineUsers/);
  assert.match(state, /syncChatListStore/);
  assert.doesNotMatch(assembly, /\bfunction\s+renderChatList\b/);
  assert.doesNotMatch(assembly, /\bfunction\s+loadChats\b/);
  assert.doesNotMatch(assembly, /\bfunction\s+loadAllUsers\b/);
  assert.doesNotMatch(assembly, /\bfunction\s+hydrateChatListCache\b/);
  assert.doesNotMatch(assembly, /chatListService\.configure/);
  assert.doesNotMatch(assembly, /chatListService\.getChats/);
  assert.match(chatListComposition, /chatListService\.configure/);
});

test('open chat pagination and scroll ownership lives behind open-chat service', () => {
  const assembly = readRelative('public/js/app/boot/runtime-assembly.js');
  const runtimeCore = readRelative('public/js/app/boot/runtime-core.js');
  const openChatComposition = readRelative('public/js/app/boot/composition/open-chat-composition.js');
  const openChatService = readRelative('public/js/app/boot/open-chat-service.js');
  const openChatController = readRelative('public/js/app/open-chat/controller.js');
  const state = readRelative('public/js/app/boot/state.js');

  assert.ok(lineCount(assembly) < RUNTIME_ASSEMBLY_LINE_LIMIT, `runtime-assembly.js line count ${lineCount(assembly)} should stay below ${RUNTIME_ASSEMBLY_LINE_LIMIT}`);
  assert.match(openChatService, /createOpenChatService/);
  assert.match(openChatService, /scrollToBottom/);
  assert.match(openChatService, /loadMoreAfter/);
  assert.match(openChatController, /setCurrentChat/);
  assert.match(openChatController, /setStateMessages/);
  assert.match(state, /setCurrentChat/);
  assert.match(state, /mergeMessages/);
  assert.doesNotMatch(assembly, /\bOPEN CHAT\b/);
  assert.doesNotMatch(assembly, /\bfunction\s+openChat\b/);
  assert.doesNotMatch(assembly, /\bfunction\s+loadMessages\b/);
  assert.doesNotMatch(assembly, /\bfunction\s+loadMoreMessages\b/);
  assert.doesNotMatch(assembly, /\bfunction\s+loadMore\b/);
  assert.doesNotMatch(assembly, /\bfunction\s+loadMoreAfter\b/);
  assert.doesNotMatch(assembly, /\bfunction\s+scrollToBottom\b/);
  assert.doesNotMatch(assembly, /\bfunction\s+restoreScrollAnchor\b/);
  assert.doesNotMatch(assembly, /openChatService\.configure/);
  assert.doesNotMatch(assembly, /openChatService\.openChat/);
  assert.match(openChatComposition, /openChatService\.configure/);
  assert.match(runtimeCore, /openChatService\.openChat/);
});

test('message rendering update and outbox ownership lives behind messages service', () => {
  const assembly = readRelative('public/js/app/boot/runtime-assembly.js');
  const runtimeCore = readRelative('public/js/app/boot/runtime-core.js');
  const messagesComposition = readRelative('public/js/app/boot/composition/messages-composition.js');
  const messagesService = readRelative('public/js/app/boot/messages-service.js');
  const state = readRelative('public/js/app/boot/state.js');

  assert.ok(lineCount(assembly) < RUNTIME_ASSEMBLY_LINE_LIMIT, `runtime-assembly.js line count ${lineCount(assembly)} should keep trending down`);
  assert.match(messagesService, /createMessagesService/);
  assert.match(messagesService, /replaceRenderedMessages/);
  assert.match(messagesService, /appendMessage/);
  assert.match(messagesService, /applyMessageUpdate/);
  assert.match(messagesService, /completeOutboxSend/);
  assert.match(state, /setMessages/);
  assert.match(state, /mergeMessages/);

  const forbiddenAssemblyPatterns = [
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

  for (const pattern of forbiddenAssemblyPatterns) {
    assert.doesNotMatch(assembly, pattern, `runtime-assembly.js must not contain ${pattern}`);
  }

  assert.doesNotMatch(assembly, /messagesService\.configure/);
  assert.doesNotMatch(assembly, /messagesService\?\.appendMessage|messageServiceCall/);
  assert.match(messagesComposition, /messagesService\.configure/);
  assert.match(runtimeCore, /messageServiceCall/);
});
