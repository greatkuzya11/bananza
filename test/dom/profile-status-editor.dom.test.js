const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  loadBrowserScript,
} = require('../support/domHarness');

function createEditor(dom, currentUser) {
  loadBrowserScript(dom, 'public/js/app/shell/events.js');
  return dom.window.BananzaApp.shell.profileStatusEditor.createProfileStatusEditor({
    $: (selector) => dom.window.document.querySelector(selector),
    esc: (value) => String(value ?? ''),
    t: (value) => value,
    getCurrentUser: () => currentUser,
    setProfileStatus: () => {},
  });
}

test('profile status editor preserves explicit No status selection', () => {
  const dom = createAppDom();
  const editor = createEditor(dom, {
    username: 'bob',
    profile_status_key: 'custom',
    profile_status_text: 'Focus mode',
  });

  editor.hydrate();
  const select = dom.window.document.querySelector('#profileUserStatusSelect');
  assert.equal(select.value, 'custom');

  select.value = '';
  editor.syncSelection();

  const selection = editor.getSelection();
  assert.equal(selection.key, '');
  assert.equal(selection.text, '');
  assert.equal(dom.window.document.querySelector('#profileCustomStatusWrap').classList.contains('hidden'), true);
  assert.equal(dom.window.document.querySelector('#profileUserStatusPreview').textContent, '@bob');
});

test('profile status editor treats an emptied custom status as empty input', () => {
  const dom = createAppDom();
  const editor = createEditor(dom, {
    username: 'bob',
    profile_status_key: 'custom',
    profile_status_text: 'Focus mode',
  });

  editor.hydrate();
  const input = dom.window.document.querySelector('#profileCustomStatus');
  input.value = '';
  editor.syncSelection();

  const selection = editor.getSelection();
  assert.equal(selection.key, 'custom');
  assert.equal(selection.text, '');
});
