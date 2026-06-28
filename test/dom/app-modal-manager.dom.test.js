const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  loadAppScript,
  loadBrowserScript,
} = require('../support/domHarness');

function wait(dom, ms = 0) {
  return new Promise((resolve) => dom.window.setTimeout(resolve, ms));
}

function loadModalManager(dom) {
  loadBrowserScript(dom, 'public/js/app/modal-manager.js');
}

function createModal(document, id) {
  const modal = document.createElement('div');
  modal.id = id;
  modal.className = 'modal hidden';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal-content">
      <button id="${id}Focus" type="button" autofocus>Focus</button>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function createManagerHarness(options = {}) {
  const dom = createAppDom();
  loadModalManager(dom);
  const { document } = dom.window;
  const opener = document.createElement('button');
  opener.id = 'modalManagerOpener';
  opener.type = 'button';
  opener.textContent = 'Open';
  document.body.appendChild(opener);
  const modalA = createModal(document, 'modalManagerTestA');
  const modalB = createModal(document, 'modalManagerTestB');
  const manager = dom.window.BananzaApp.modalManager.createModalManager({
    document,
    window: dom.window,
    config: { MODAL_TRANSITION_BUFFER_MS: options.transitionBufferMs ?? 5 },
    actions: {
      closeMediaViewer() {},
      closeMobileComposerTransientUi() {},
      dismissMobileComposer() {},
      forceIosAnimationMount() {},
      getMobileComposerSafeReturnFocusEl() {
        return opener;
      },
      prefersReducedMotion() {
        return Boolean(options.reducedMotion);
      },
      scheduleMobileViewportRecovery() {},
    },
    getCurrentModalAnimation() {
      return options.animation || 'soft';
    },
    getCurrentModalAnimationSpeed() {
      return 8;
    },
    getModalAnimationSpeedFactor() {
      return 1;
    },
  });
  return { dom, manager, modalA, modalB, opener };
}

test('modal manager factory is published on BananzaApp', () => {
  const dom = createAppDom();
  loadModalManager(dom);

  assert.equal(typeof dom.window.BananzaApp.modalManager.createModalManager, 'function');
});

test('modal manager registers, opens, closes, and preserves duplicate register callbacks', async () => {
  const { dom, manager, modalA, opener } = createManagerHarness({ reducedMotion: true });
  let closed = 0;
  const onAfterClose = () => {
    closed += 1;
  };

  const firstEntry = manager.register('modalManagerTestA', { onAfterClose });
  const duplicateEntry = manager.register(modalA, { closeOnBackdrop: false });

  assert.equal(firstEntry.id, 'modalManagerTestA');
  assert.equal(duplicateEntry.id, 'modalManagerTestA');
  assert.equal(manager.getEntry('modalManagerTestA').onAfterClose, onAfterClose);
  assert.equal(manager.getEntry('modalManagerTestA').closeOnBackdrop, false);

  const opened = manager.open('modalManagerTestA', { opener });
  await wait(dom, 80);

  assert.equal(opened.id, 'modalManagerTestA');
  assert.equal(modalA.classList.contains('hidden'), false);
  assert.equal(modalA.classList.contains('is-open'), true);
  assert.equal(modalA.dataset.managedModal, '1');
  assert.equal(modalA.getAttribute('role'), 'dialog');
  assert.equal(modalA.getAttribute('aria-hidden'), 'false');
  assert.equal(modalA.getAttribute('aria-modal'), 'true');
  assert.equal(dom.window.history.state.modalId, 'modalManagerTestA');
  assert.equal(manager.hasOpen(), true);
  assert.equal(manager.getTop().id, 'modalManagerTestA');
  assert.equal(manager.getStack().length, 1);

  const stackCopy = manager.getStack();
  stackCopy.pop();
  assert.equal(manager.getStack().length, 1);

  assert.equal(manager.close('modalManagerTestA', { immediate: true }), true);
  assert.equal(modalA.classList.contains('hidden'), true);
  assert.equal(manager.hasOpen(), false);
  assert.equal(manager.getStack().length, 0);
  assert.equal(closed, 1);
  assert.equal(dom.window.document.activeElement, opener);
});

test('modal manager closes with transition fallback and onClose callback', async () => {
  const { dom, manager, modalA } = createManagerHarness({ reducedMotion: false, transitionBufferMs: 5 });
  let closed = 0;

  manager.register('modalManagerTestA', {
    onClose() {
      closed += 1;
    },
  });
  manager.open('modalManagerTestA');
  await wait(dom, 80);

  assert.equal(manager.close('modalManagerTestA'), true);
  assert.equal(modalA.classList.contains('is-closing'), true);
  assert.equal(manager.hasOpen(), true);

  await wait(dom, 30);

  assert.equal(modalA.classList.contains('hidden'), true);
  assert.equal(modalA.classList.contains('is-closing'), false);
  assert.equal(manager.hasOpen(), false);
  assert.equal(closed, 1);
});

test('modal manager restores a closing audit modal when it is reopened before transition cleanup', async () => {
  const { dom, manager } = createManagerHarness({ reducedMotion: false, transitionBufferMs: 20 });
  const { document } = dom.window;
  const adminModal = document.getElementById('adminModal');
  const auditModal = document.getElementById('adminBotAuditModal');

  manager.open('adminModal');
  manager.open('adminBotAuditModal');
  await wait(dom, 80);

  assert.equal(manager.close('adminBotAuditModal'), true);
  assert.equal(auditModal.classList.contains('is-closing'), true);

  manager.open('adminBotAuditModal');
  await wait(dom, 100);

  assert.deepEqual(Array.from(manager.getStack(), (entry) => entry.id), ['adminModal', 'adminBotAuditModal']);
  assert.equal(manager.getTop().id, 'adminBotAuditModal');
  assert.equal(adminModal.classList.contains('hidden'), false);
  assert.equal(auditModal.classList.contains('hidden'), false);
  assert.equal(auditModal.classList.contains('is-closing'), false);
  assert.equal(auditModal.getAttribute('aria-hidden'), 'false');
  assert.equal(auditModal.getAttribute('aria-modal'), 'true');

  manager.open('adminModal', { replaceStack: manager.getTop()?.id !== 'settingsModal' });
  manager.open('adminBotAuditModal');
  await wait(dom, 100);

  assert.deepEqual(Array.from(manager.getStack(), (entry) => entry.id), ['adminModal', 'adminBotAuditModal']);
  assert.equal(manager.getTop().id, 'adminBotAuditModal');
  assert.equal(adminModal.classList.contains('hidden'), false);
  assert.equal(auditModal.classList.contains('hidden'), false);
  assert.equal(auditModal.classList.contains('is-closing'), false);
});

test('modal manager handles nested stack, closeTop, closeAll, popstate, and inert state', async () => {
  const { dom, manager, modalA, modalB } = createManagerHarness({ reducedMotion: true });

  manager.open('modalManagerTestA');
  manager.open('modalManagerTestB');
  await wait(dom, 80);

  assert.equal(manager.getTop().id, 'modalManagerTestB');
  assert.deepEqual(Array.from(manager.getStack(), (entry) => entry.id), ['modalManagerTestA', 'modalManagerTestB']);
  assert.equal(modalA.hasAttribute('inert'), true);
  assert.equal(modalA.getAttribute('aria-hidden'), 'true');
  assert.equal(modalA.classList.contains('is-underlay'), true);
  assert.equal(modalB.hasAttribute('inert'), false);
  assert.equal(modalB.getAttribute('aria-hidden'), 'false');

  assert.equal(manager.handlePopState(new dom.window.PopStateEvent('popstate')), true);
  assert.equal(modalB.classList.contains('hidden'), true);
  assert.equal(manager.getTop().id, 'modalManagerTestA');
  assert.equal(modalA.hasAttribute('inert'), false);
  assert.equal(modalA.getAttribute('aria-hidden'), 'false');

  manager.open('modalManagerTestB');
  await wait(dom, 80);
  assert.equal(manager.closeTop({ immediate: true }), true);
  assert.equal(modalB.classList.contains('hidden'), true);
  assert.equal(modalA.classList.contains('hidden'), false);
  assert.equal(manager.getStack().length, 1);

  assert.equal(manager.closeAll({ immediate: true }), true);
  assert.equal(modalA.classList.contains('hidden'), true);
  assert.equal(modalB.classList.contains('hidden'), true);
  assert.equal(manager.hasOpen(), false);
});

test('app bridge opens and closes managed modals through the extracted manager', async () => {
  const dom = createAppDom();
  const { document } = dom.window;
  const bridgeModal = createModal(document, 'bridgeManagedModal');
  let closed = 0;

  dom.window.localStorage.setItem('token', 'test-token');
  dom.window.localStorage.setItem('user', JSON.stringify({ id: 1, display_name: 'Alice', is_admin: 1 }));
  dom.window.fetch = async () => {
    throw new Error('Network disabled in modal manager bridge test');
  };

  loadAppScript(dom);

  assert.ok(dom.window.BananzaAppBridge);
  assert.equal(typeof dom.window.BananzaAppBridge.openManagedModal, 'function');
  assert.equal(typeof dom.window.BananzaAppBridge.closeManagedModal, 'function');
  assert.equal(typeof dom.window.BananzaAppBridge.__testing.openSettingsModal, 'function');

  dom.window.BananzaAppBridge.registerManagedModal('bridgeManagedModal', {
    onAfterClose() {
      closed += 1;
    },
  });
  dom.window.BananzaAppBridge.openManagedModal('bridgeManagedModal');
  await wait(dom, 80);

  assert.equal(bridgeModal.classList.contains('hidden'), false);
  assert.equal(bridgeModal.getAttribute('aria-hidden'), 'false');

  dom.window.BananzaAppBridge.closeManagedModal('bridgeManagedModal', { immediate: true });
  assert.equal(bridgeModal.classList.contains('hidden'), true);
  assert.equal(closed, 1);

  dom.window.BananzaAppBridge.__testing.openSettingsModal();
  await wait(dom, 80);

  const settingsModal = document.getElementById('settingsModal');
  assert.equal(settingsModal.classList.contains('hidden'), false);
  dom.window.BananzaAppBridge.closeManagedModal('settingsModal', { immediate: true });
  assert.equal(settingsModal.classList.contains('hidden'), true);
});
