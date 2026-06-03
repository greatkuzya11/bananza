const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  loadBrowserScripts,
} = require('../support/domHarness');

function loadFeatureLoader(dom, { registry = false } = {}) {
  const scripts = [
    'public/js/app/namespace.js',
    'public/js/app/performance.js',
    'public/js/app/feature-loader.js',
  ];
  if (registry) scripts.push('public/js/app/feature-registry.js');
  loadBrowserScripts(dom, scripts);
  return dom.window.BananzaApp.featureLoader;
}

function scriptPathname(script) {
  return new URL(script.src, script.ownerDocument.defaultView.location.href).pathname;
}

function findScript(dom, src) {
  const expected = new URL(src, dom.window.location.href).pathname;
  return [...dom.window.document.querySelectorAll('script[src]')]
    .find((script) => scriptPathname(script) === expected);
}

function findScripts(dom, src) {
  const expected = new URL(src, dom.window.location.href).pathname;
  return [...dom.window.document.querySelectorAll('script[src]')]
    .filter((script) => scriptPathname(script) === expected);
}

function dispatchScript(dom, src, type = 'load', { last = false } = {}) {
  const scripts = findScripts(dom, src);
  assert.ok(scripts.length > 0, `${src} script should exist before ${type}`);
  const script = last ? scripts[scripts.length - 1] : scripts[0];
  script.dispatchEvent(new dom.window.Event(type));
  return script;
}

async function flushTasks(dom) {
  await Promise.resolve();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  await Promise.resolve();
}

test('feature registry publishes lazy-load feature packs', () => {
  const dom = createAppDom();
  const loader = loadFeatureLoader(dom, { registry: true });

  assert.equal(typeof loader.registerFeature, 'function');
  assert.equal(typeof loader.loadFeature, 'function');
  assert.equal(typeof loader.preloadFeature, 'function');
  assert.equal(typeof loader.preloadByStrategy, 'function');
  assert.equal(typeof loader.getRegisteredFeatures, 'function');

  const features = loader.getRegisteredFeatures();
  const featureNames = Array.from(features, (feature) => feature.name).sort();
  assert.deepEqual(featureNames, [
    'admin',
    'ai-admin',
    'ai-admin-events',
    'ai-admin-runtime',
    'ai-admin-ui',
    'context-chatshot-runtime',
    'grok-risk-runtime',
    'grok-runtime',
    'interactions',
    'local-providers-runtime',
    'media-viewer',
    'openai-runtime',
    'profile-avatar-camera',
    'search',
    'settings',
  ]);
  assert.equal(features.find((feature) => feature.name === 'settings')?.preload, 'idle');
  assert.equal(features.find((feature) => feature.name === 'admin')?.preload, 'admin-idle');
  assert.equal(features.find((feature) => feature.name === 'ai-admin-runtime')?.preload, 'manual');
  assert.equal(features.find((feature) => feature.name === 'openai-runtime')?.preload, 'interaction');
  assert.equal(features.find((feature) => feature.name === 'profile-avatar-camera')?.preload, 'interaction');
  assert.equal(features.find((feature) => feature.name === 'context-chatshot-runtime')?.preload, 'manual');
});

test('loadFeature appends scripts in order and resolves when all scripts load', async () => {
  const dom = createAppDom();
  const loader = loadFeatureLoader(dom);
  loader.registerFeature('demo', ['/js/app/demo-one.js', '/js/app/demo-two.js']);

  const pending = loader.loadFeature('demo');
  const first = findScript(dom, '/js/app/demo-one.js');
  assert.ok(first, 'first script should be appended immediately');
  assert.equal(first.dataset.bananzaFeature, 'demo');
  assert.equal(first.dataset.bananzaFeatureStatus, 'loading');
  assert.equal(findScript(dom, '/js/app/demo-two.js'), undefined);

  dispatchScript(dom, '/js/app/demo-one.js');
  await flushTasks(dom);
  const second = findScript(dom, '/js/app/demo-two.js');
  assert.ok(second, 'second script should be appended after first load');
  assert.equal(second.dataset.bananzaFeatureStatus, 'loading');

  dispatchScript(dom, '/js/app/demo-two.js');
  const state = await pending;
  assert.equal(state.status, 'loaded');
  assert.deepEqual(Array.from(state.loadedScripts), ['/js/app/demo-one.js', '/js/app/demo-two.js']);
});

test('loadFeature reuses in-flight and loaded feature promises without duplicate scripts', async () => {
  const dom = createAppDom();
  const loader = loadFeatureLoader(dom);
  loader.registerFeature('single', ['/js/app/single.js']);

  const firstLoad = loader.loadFeature('single');
  const secondLoad = loader.loadFeature('single');
  assert.equal(firstLoad, secondLoad);
  dispatchScript(dom, '/js/app/single.js');
  await firstLoad;

  const loadedAgain = await loader.loadFeature('single');
  assert.equal(loadedAgain.status, 'loaded');
  assert.equal(findScripts(dom, '/js/app/single.js').length, 1);
});

test('loadFeature retries after script load failure', async () => {
  const dom = createAppDom();
  const loader = loadFeatureLoader(dom);
  loader.registerFeature('retry', ['/js/app/retry.js']);

  const firstLoad = loader.loadFeature('retry');
  dispatchScript(dom, '/js/app/retry.js', 'error');
  await assert.rejects(firstLoad, /Failed to load feature "retry"/);
  assert.equal(loader.getFeatureState('retry').status, 'failed');

  const secondLoad = loader.loadFeature('retry');
  assert.equal(findScripts(dom, '/js/app/retry.js').length, 2);
  dispatchScript(dom, '/js/app/retry.js', 'load', { last: true });
  const state = await secondLoad;
  assert.equal(state.status, 'loaded');
  assert.equal(findScripts(dom, '/js/app/retry.js').length, 2);
});

test('loadFeature treats already-present static scripts as loaded without duplicates', async () => {
  const dom = createAppDom();
  const loader = loadFeatureLoader(dom);
  const existing = dom.window.document.createElement('script');
  existing.src = '/js/app/existing.js?v=static';
  dom.window.document.head.appendChild(existing);

  loader.registerFeature('existing', ['/js/app/existing.js']);
  const state = await loader.loadFeature('existing');

  assert.equal(state.status, 'loaded');
  assert.equal(findScripts(dom, '/js/app/existing.js').length, 1);
});

test('loadFeature waits for shared in-flight scripts between feature packs', async () => {
  const dom = createAppDom();
  const loader = loadFeatureLoader(dom);
  loader.registerFeature('wide', ['/js/app/shared.js', '/js/app/wide-only.js']);
  loader.registerFeature('narrow', ['/js/app/shared.js']);

  const wideLoad = loader.loadFeature('wide');
  const narrowLoad = loader.loadFeature('narrow');
  assert.equal(loader.getFeatureState('narrow').status, 'loading');
  assert.equal(findScripts(dom, '/js/app/shared.js').length, 1);

  await flushTasks(dom);
  assert.equal(loader.getFeatureState('narrow').status, 'loading');
  dispatchScript(dom, '/js/app/shared.js');

  const narrowState = await narrowLoad;
  assert.equal(narrowState.status, 'loaded');
  await flushTasks(dom);
  dispatchScript(dom, '/js/app/wide-only.js');
  const wideState = await wideLoad;
  assert.equal(wideState.status, 'loaded');
});

test('preloadFeature schedules load work through requestIdleCallback', async () => {
  const dom = createAppDom();
  const loader = loadFeatureLoader(dom);
  let idleCallback = null;
  dom.window.requestIdleCallback = (callback) => {
    idleCallback = callback;
    return 1;
  };
  loader.registerFeature('idle', ['/js/app/idle.js']);

  const pending = loader.preloadFeature('idle');
  assert.equal(findScript(dom, '/js/app/idle.js'), undefined);
  assert.equal(typeof idleCallback, 'function');
  idleCallback();
  await flushTasks(dom);
  assert.ok(findScript(dom, '/js/app/idle.js'), 'preload should append script after idle callback');
  dispatchScript(dom, '/js/app/idle.js');

  const state = await pending;
  assert.equal(state.status, 'loaded');
});

test('preloadByStrategy preloads matching feature packs only', async () => {
  const dom = createAppDom();
  const loader = loadFeatureLoader(dom);
  let idleCallbacks = [];
  dom.window.requestIdleCallback = (callback) => {
    idleCallbacks.push(callback);
    return idleCallbacks.length;
  };
  loader.registerFeature('idle-one', ['/js/app/idle-one.js'], { preload: 'idle' });
  loader.registerFeature('idle-two', ['/js/app/idle-two.js'], { preload: ['idle', 'admin-idle'] });
  loader.registerFeature('manual-one', ['/js/app/manual-one.js'], { preload: 'manual' });

  const pending = loader.preloadByStrategy('idle');
  assert.equal(findScript(dom, '/js/app/idle-one.js'), undefined);
  assert.equal(findScript(dom, '/js/app/idle-two.js'), undefined);
  assert.equal(findScript(dom, '/js/app/manual-one.js'), undefined);
  assert.equal(idleCallbacks.length, 2);

  idleCallbacks.forEach((callback) => callback());
  await flushTasks(dom);
  assert.ok(findScript(dom, '/js/app/idle-one.js'));
  assert.ok(findScript(dom, '/js/app/idle-two.js'));
  assert.equal(findScript(dom, '/js/app/manual-one.js'), undefined);

  dispatchScript(dom, '/js/app/idle-one.js');
  dispatchScript(dom, '/js/app/idle-two.js');
  const states = await pending;
  assert.deepEqual(Array.from(states, (state) => state.name).sort(), ['idle-one', 'idle-two']);
  assert.equal(loader.getFeatureState('idle-one').status, 'loaded');
  assert.equal(loader.getFeatureState('idle-two').status, 'loaded');
});

test('loadFeature and preloadFeature record performance marks and measures', async () => {
  const dom = createAppDom();
  const loader = loadFeatureLoader(dom);
  loader.registerFeature('perf', ['/js/app/perf.js']);
  loader.registerFeature('perf-preload', ['/js/app/perf-preload.js']);

  const pending = loader.loadFeature('perf');
  dispatchScript(dom, '/js/app/perf.js');
  await pending;
  const preloadPending = loader.preloadFeature('perf-preload');
  await flushTasks(dom);
  dispatchScript(dom, '/js/app/perf-preload.js');
  await preloadPending;

  const summary = dom.window.BananzaApp.performance.getSummary();
  assert.equal(typeof summary.marks['bananza:feature-load:perf:start'], 'number');
  assert.equal(typeof summary.marks['bananza:feature-load:perf:end'], 'number');
  assert.equal(typeof summary.measures['bananza:feature-load:perf'], 'number');
  assert.equal(typeof summary.marks['bananza:feature-preload:perf-preload:start'], 'number');
  assert.equal(typeof summary.marks['bananza:feature-preload:perf-preload:end'], 'number');
  assert.equal(typeof summary.measures['bananza:feature-preload:perf-preload'], 'number');
});
