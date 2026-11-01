const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppDom, loadAppRuntimeScripts } = require('../support/domHarness');

function setup(t, request = async () => ({})) {
  const dom = createAppDom();
  t.after(() => dom.window.close());
  loadAppRuntimeScripts(dom);
  const w = dom.window;
  const doc = w.document;
  const root = w.BananzaApp.chatList;
  const store = root.store.createChatListStore({ chats: [
    { id: 1, name: 'Alpha', notify_enabled: true, sounds_enabled: false },
    { id: 2, name: 'Beta', notify_enabled: false, sounds_enabled: true },
    { id: 3, name: 'Gamma' },
  ] });
  const state = { filter: '', folder: null, refreshes: 0, opened: [], calls: [], toasts: [] };
  const folders = [{ id: 9, name: 'Work', kind: 'custom', chat_ids: [1, 2] }, { id: 10, name: 'Bots', kind: 'bot_auto', chat_ids: [] }];
  const selection = root.createSelectionController({
    document: doc, window: w, store,
    api: async (url, options) => { state.calls.push({ url, ...options }); return request(url, options); },
    t: (key, vars = {}) => key.replace(/\{(\w+)\}/g, (_, k) => String(vars[k])),
    actions: {
      getActiveFolder: () => state.folder,
      getFolders: () => folders,
      getFilter: () => state.filter,
      refresh: async () => { state.refreshes++; render(); },
      showToast: text => state.toasts.push(text),
    },
  });
  const renderer = root.render.createChatListRenderer({
    window: w, document: doc, store, dom: { chatList: doc.getElementById('chatList') },
    folders: { get activeFolderId() { return state.folder?.id || 0; }, getFolderById: () => state.folder },
    actions: { openChat: id => state.opened.push(id), syncChatListInteractions: () => selection.sync() },
  });
  const render = () => renderer.renderChatList(state.filter);
  const row = id => doc.querySelector(`#chatList [data-chat-id="${id}"]`);
  const click = (target, extra = {}) => target.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, ...extra }));
  const pointer = (target, type, extra = {}) => {
    const event = new w.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 20, clientY: 20, ...extra });
    Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: extra.pointerType || 'mouse' } });
    target.dispatchEvent(event);
  };
  render();
  return { dom, w, doc, root, store, state, selection, render, row, click, pointer };
}

test('selection intercepts rows and native checkboxes, keeps IDs across rerenders, and resets with scope', t => {
  const { store, state, selection, render, row, click, doc } = setup(t);
  click(row(1), { ctrlKey: true });
  assert.deepEqual([...store.getSelectionState().ids], [1]);
  click(row(2));
  assert.deepEqual([...store.getSelectionState().ids], [1, 2]);
  assert.deepEqual(state.opened, []);
  row(1).querySelector('input').click();
  assert.equal(row(1).querySelector('input').checked, false);
  store.patchChat(2, { last_text: 'Realtime', last_time: '2030-01-01' });
  render();
  assert.equal(row(2).querySelector('input').checked, true);
  click(doc.querySelector('[data-selection-action="actions"]'));
  store.removeChat(2);
  render();
  assert.equal(store.getSelectionState().ids.size, 0);
  assert.equal(store.getSelectionState().active, true);
  assert.equal(doc.querySelector('[data-selection-action="actions"]').disabled, false);
  assert.equal(doc.querySelector('[data-selection-action="all"]').disabled, false);
  assert.equal(doc.querySelector('[data-selection-action="notify-on"]').disabled, true);
  state.filter = 'Alpha'; render();
  assert.equal(store.getSelectionState().active, false);
  selection.start(1);
  state.folder = { id: 9, kind: 'custom', chat_ids: [1] }; render();
  assert.equal(store.getSelectionState().active, false);
});

test('select all respects visible scope, excludes hidden/users, and Escape closes menus before selection', t => {
  const { doc, w, state, store, selection, render, row, click } = setup(t);
  state.filter = 'Alpha'; render();
  doc.getElementById('chatList').insertAdjacentHTML('beforeend', '<div class="chat-item is-hidden-search-result" data-chat-id="99"></div><div class="chat-item"></div>');
  selection.start(1);
  click(doc.querySelector('[data-selection-action="actions"]'));
  click(doc.querySelector('[data-selection-action="all"]'));
  assert.deepEqual([...store.getSelectionState().ids], [1]);
  click(doc.querySelector('[data-selection-action="actions"]'));
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(doc.querySelector('.chat-selection-actions'), null);
  assert.equal(store.getSelectionState().active, true);
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(store.getSelectionState().active, false);
  Object.defineProperty(w.navigator, 'platform', { value: 'MacIntel' });
  click(row(1), { metaKey: true });
  assert.equal(store.getSelectionState().active, true);
});

test('selection replaces header controls and outside clicks only dismiss its popover', t => {
  const { doc, selection, store, row, click } = setup(t);
  selection.start(1);
  const header = doc.querySelector('.sidebar-header');
  assert.equal(doc.getElementById('chatSelectionPanel').parentElement, header);
  assert.equal(header.querySelector('#newChatBtn').inert, true);
  assert.equal(doc.querySelector('.chat-selection-count').textContent, '1 selected');
  assert.ok(row(1).querySelector('.chat-item-avatar .chat-selection-badge'));
  assert.equal(row(1).querySelector('input').getAttribute('aria-label'), 'Select chat Alpha');
  click(doc.querySelector('[data-selection-action="actions"]'));
  click(row(2));
  assert.equal(doc.querySelector('.chat-selection-actions'), null);
  assert.deepEqual([...store.getSelectionState().ids], [1]);
  click(row(1));
  assert.equal(doc.querySelector('.chat-selection-count').textContent, '0 selected');
  click(doc.querySelector('[data-selection-action="actions"]'));
  assert.equal(doc.querySelector('[data-selection-action="folders"]').disabled, true);
  click(doc.querySelector('[data-selection-action="all"]'));
  assert.equal(store.getSelectionState().ids.size, 3);
  selection.cancel();
  assert.equal(header.querySelector('#newChatBtn').inert, false);
  assert.equal(doc.querySelector('.chat-selection-badge'), null);
});

test('bulk preferences are explicit, sequential, preserve other fields, and retain only failed IDs', async t => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const { doc, store, state, selection, row, click } = setup(t, async (url, options) => {
    await pending;
    if (url.includes('/2/')) throw new Error('Forbidden');
    return { preferences: options.body };
  });
  selection.start(1); click(row(2));
  const first = selection.run('notify-off');
  assert.equal(doc.getElementById('chatSelectionPanel').getAttribute('aria-busy'), 'true');
  assert.equal(doc.querySelector('[data-selection-action="actions"]').disabled, true);
  assert.equal(doc.querySelector('[data-selection-action="cancel"]').disabled, true);
  assert.equal(row(1).querySelector('input').disabled, true);
  assert.ok(doc.querySelector('.chat-selection-progress'));
  await selection.run('sound-on');
  click(row(3)); selection.cancel();
  assert.equal(state.calls.length, 1);
  assert.deepEqual([...store.getSelectionState().ids], [1, 2]);
  release(); await first;
  assert.equal(state.calls.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(state.calls[0].body)), { notify_enabled: false });
  assert.equal(store.getChatById(1).sounds_enabled, false);
  assert.equal(store.getChatById(1).notify_enabled, false);
  assert.deepEqual([...store.getSelectionState().ids], [2]);
  assert.equal(state.refreshes, 1);
  assert.equal(doc.querySelector('.chat-selection-progress'), null);
  assert.equal(row(2).querySelector('input').disabled, false);
  assert.match(state.toasts[0], /Updated chats: 1. Failed: 1/);
});

test('folder batch add uses one request, checks returned membership, and removal uses individual deletes', async t => {
  const { state, store, selection, row, click, render, doc } = setup(t, async () => ({ folder: { chat_ids: [1, 2] } }));
  selection.start(1); click(row(2));
  await selection.run('folder:10');
  assert.equal(state.calls.length, 0);
  await selection.run('folder:9');
  assert.equal(state.calls.length, 1);
  assert.deepEqual(Array.from(state.calls[0].body.chatIds), [1, 2]);
  assert.equal(store.getSelectionState().active, false);
  state.folder = { id: 9, kind: 'custom', chat_ids: [1, 2] }; render();
  selection.start(1); click(row(2));
  click(doc.querySelector('[data-selection-action="actions"]'));
  assert.ok(doc.querySelector('[data-selection-action="remove"]'));
  await selection.run('remove');
  assert.deepEqual(state.calls.slice(1).map(call => call.method), ['DELETE', 'DELETE']);
  assert.equal(state.refreshes, 2);
});

function menus(h) {
  const { w, doc, store, selection } = h;
  const floating = {
    isFloatingSurfaceVisible: el => !el.classList.contains('hidden'),
    openFloatingSurface: el => el?.classList.remove('hidden'),
    closeFloatingSurface: (el, opts) => { el?.classList.add('hidden'); opts?.onAfterClose?.(); },
    getFloatingViewportRect: () => ({ left: 0, right: 1024, top: 0, bottom: 768 }),
    measureFloatingSurface: () => ({ width: 236, height: 260 }),
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    positionFloatingElement: () => {},
  };
  const controller = w.BananzaApp.interactions.contextMenus.createContextMenus({
    window: w, document: doc, config: { CHAT_CONTEXT_LONG_PRESS_MS: 20 }, floatingActions: floating,
    dom: { chatList: doc.getElementById('chatList'), messagesEl: doc.getElementById('messages'),
      chatContextMenu: doc.getElementById('chatContextMenu'), chatContextMenuBackdrop: doc.getElementById('chatContextMenuBackdrop') },
    actions: { getChatById: id => store.getChatById(id), selectChat: id => selection.start(id) },
  });
  controller.bindEvents();
  return controller;
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('long press opens once, survives delayed release and duplicate contextmenu, and next gesture works', async t => {
  const h = setup(t);
  const { w, doc, row, pointer, click, state, store } = h;
  const errors = [];
  w.addEventListener('error', e => { errors.push(e.message); e.preventDefault(); });
  const context = menus(h);
  pointer(row(1), 'pointerdown');
  await wait(40);
  assert.equal(context.getChatContextMenuState()?.chatId, 1);
  await wait(600);
  pointer(doc.getElementById('chatContextMenuBackdrop'), 'pointerup');
  click(doc.getElementById('chatContextMenuBackdrop'));
  assert.equal(context.getChatContextMenuState()?.chatId, 1);
  row(1).dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  assert.equal(context.getChatContextMenuState()?.chatId, 1);
  doc.getElementById('chatContextMenuBackdrop').dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  assert.equal(context.getChatContextMenuState()?.chatId, 1);
  assert.deepEqual(state.opened, []);
  const select = doc.querySelector('[data-chat-action="select-chat"]');
  pointer(select, 'pointerdown'); pointer(select, 'pointerup'); click(select);
  assert.equal(store.getSelectionState().active, true);
  h.selection.cancel();
  pointer(row(2), 'pointerdown'); pointer(row(2), 'pointerup'); click(row(2));
  assert.deepEqual(state.opened, [2]);
  assert.deepEqual(errors, []);
});

test('movement, scroll, cancellation and blur abort holding; rerender retains menu until chat disappears', async t => {
  const h = setup(t);
  const { w, doc, row, pointer } = h;
  const context = menus(h);
  for (const abort of [
    () => pointer(row(1), 'pointermove', { clientX: 40 }),
    () => doc.getElementById('chatList').dispatchEvent(new w.Event('scroll')),
    () => pointer(row(1), 'pointercancel'),
    () => w.dispatchEvent(new w.Event('blur')),
  ]) {
    pointer(row(1), 'pointerdown'); abort(); await wait(35);
    assert.equal(context.getChatContextMenuState(), null);
  }
  pointer(row(1), 'pointerdown', { pointerType: 'touch' }); await wait(40);
  h.render(); context.syncChatContextMenu();
  assert.equal(context.getChatContextMenuState()?.chatId, 1);
  h.store.removeChat(1); h.render(); context.syncChatContextMenu();
  assert.equal(context.getChatContextMenuState(), null);
});
