const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  loadAppShellScripts,
} = require('../support/domHarness');

test('BananzaApp namespace registers and installs modules once', () => {
  const dom = createAppDom();
  loadAppShellScripts(dom);

  const { BananzaApp } = dom.window;
  assert.equal(typeof BananzaApp.register, 'function');
  assert.equal(typeof BananzaApp.install, 'function');
  assert.equal(typeof BananzaApp.installAll, 'function');
  assert.equal(typeof BananzaApp.get, 'function');
  assert.equal(typeof BananzaApp.has, 'function');
  assert.equal(typeof BananzaApp.list, 'function');

  let alphaCalls = 0;
  BananzaApp.register('alpha', (ctx) => {
    alphaCalls += 1;
    return { ctx, value: 'alpha-result' };
  });
  BananzaApp.register('beta', () => 'beta-result');

  assert.deepEqual(Array.from(BananzaApp.list()), ['alpha', 'beta']);
  assert.equal(BananzaApp.has('alpha'), true);
  assert.equal(BananzaApp.has('missing'), false);

  const ctx = { marker: 'ctx' };
  const firstAlpha = BananzaApp.install('alpha', ctx);
  const secondAlpha = BananzaApp.install('alpha', { marker: 'other' });
  assert.equal(firstAlpha, secondAlpha);
  assert.equal(firstAlpha.ctx, ctx);
  assert.equal(alphaCalls, 1);
  assert.equal(BananzaApp.get('alpha'), firstAlpha);

  const all = BananzaApp.installAll({ marker: 'all' }, ['beta', 'alpha']);
  assert.deepEqual(Object.keys(all), ['beta', 'alpha']);
  assert.equal(all.beta, 'beta-result');
  assert.equal(all.alpha, firstAlpha);

  assert.throws(
    () => BananzaApp.register('alpha', () => ({})),
    /already registered/
  );

  const existingApp = dom.window.BananzaApp;
  loadAppShellScripts(dom);
  assert.equal(dom.window.BananzaApp, existingApp);
  assert.deepEqual(Array.from(dom.window.BananzaApp.list()), ['alpha', 'beta']);
});

test('BananzaApp createContext provides defaults and an internal event bus', () => {
  const dom = createAppDom();
  loadAppShellScripts(dom);

  const ctx = dom.window.BananzaApp.createContext();
  assert.deepEqual(Object.keys(ctx.config), []);
  assert.deepEqual(Object.keys(ctx.state), []);
  assert.deepEqual(Object.keys(ctx.dom), []);
  assert.deepEqual(Object.keys(ctx.services), []);
  assert.deepEqual(Object.keys(ctx.actions), []);
  assert.deepEqual(Object.keys(ctx.bridge), []);
  assert.equal(ctx.t('hello'), 'hello');
  assert.equal(ctx.t(''), '');
  assert.equal(ctx.tx(null), '');
  assert.equal(ctx.tx('Text'), 'Text');

  const seen = [];
  const off = ctx.events.on('change', (payload, type) => {
    seen.push({ payload, type });
  });
  ctx.events.emit('change', { ok: true });
  off();
  ctx.events.emit('change', { ok: false });

  assert.deepEqual(seen, [{ payload: { ok: true }, type: 'change' }]);
});

test('BananzaApp createBridge preserves existing bridge and __testing', () => {
  const dom = createAppDom();
  loadAppShellScripts(dom);

  const existingBridge = { existing: true };
  dom.window.BananzaAppBridge = existingBridge;
  const ctx = {};
  const bridge = dom.window.BananzaApp.createBridge(ctx, {
    ping() {
      return 'pong';
    },
  });

  assert.equal(bridge, existingBridge);
  assert.equal(dom.window.BananzaAppBridge, existingBridge);
  assert.equal(ctx.bridge, existingBridge);
  assert.equal(bridge.existing, true);
  assert.equal(bridge.ping(), 'pong');
  assert.equal(typeof bridge.__testing, 'object');

  const existingTesting = bridge.__testing;
  const secondBridge = dom.window.BananzaApp.createBridge(ctx, { added: true });
  assert.equal(secondBridge, existingBridge);
  assert.equal(secondBridge.__testing, existingTesting);
  assert.equal(secondBridge.added, true);
});
