const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  loadBrowserScript,
  setDocumentHidden,
} = require('../support/domHarness');

test('sounds script exposes BananzaSounds and respects settings toggles', () => {
  const dom = createAppDom();
  loadBrowserScript(dom, 'public/js/sounds.js');

  const sounds = dom.window.BananzaSounds;
  assert.ok(sounds);

  sounds.configure({ volume: 75, play_notifications: false });
  const settings = sounds.getSettings();
  assert.equal(settings.volume, 75);
  assert.equal(settings.play_notifications, false);

  sounds.unlock();
  assert.equal(sounds.preview('send'), true);
  assert.equal(sounds.play('notification'), false);

  setDocumentHidden(dom.window.document, true);
  assert.equal(sounds.play('incoming'), false);
});
