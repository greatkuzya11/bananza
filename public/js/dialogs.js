/* Application-owned dialogs. Never replace the synchronous browser globals. */
(function () {
  'use strict';
  let queue = Promise.resolve();
  let dialog = null;
  const t = value => window.BananzaI18n?.text?.(String(value ?? '')) ?? String(value ?? '');

  function createDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.id = 'appDialog';
    dialog.className = 'modal app-dialog hidden';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'appDialogTitle');
    dialog.setAttribute('aria-describedby', 'appDialogMessage');
    dialog.innerHTML = '<div class="modal-content"><div class="modal-header"><h3 id="appDialogTitle"></h3>'
      + '<button type="button" class="modal-close" data-dialog-cancel></button></div>'
      + '<form class="modal-body"><p id="appDialogMessage" class="app-dialog-message"></p>'
      + '<input id="appDialogInput" class="modal-input" autocomplete="off">'
      + '<div class="app-dialog-actions"><button type="button" class="app-dialog-cancel" data-dialog-cancel></button>'
      + '<button type="submit" class="btn-primary"></button></div></form></div>';
    document.body.appendChild(dialog);
    return dialog;
  }

  function show(kind, message, initial) {
    return new Promise(resolve => {
      const el = createDialog();
      const opener = document.activeElement;
      const input = el.querySelector('input');
      const form = el.querySelector('form');
      const primary = el.querySelector('[type="submit"]');
      const cancel = el.querySelector('.app-dialog-cancel');
      const close = el.querySelector('.modal-close');
      const bridge = window.BananzaAppBridge;
      const managed = Boolean(bridge?.registerManagedModal && bridge?.openManagedModal && bridge?.closeManagedModal);
      let result = kind === 'confirm' ? false : null;
      let done = false;
      let closing = false;
      let historyAdded = false;
      el.querySelector('h3').textContent = t(kind === 'prompt' ? 'Enter a value' : kind === 'confirm' ? 'Confirmation' : 'Notice');
      el.querySelector('p').textContent = t(message);
      input.hidden = kind !== 'prompt';
      input.disabled = kind !== 'prompt';
      input.value = String(initial ?? '');
      input.setAttribute('aria-label', t(message));
      primary.textContent = t('OK');
      cancel.textContent = t('Cancel');
      cancel.hidden = kind === 'alert';
      close.textContent = '\u00d7';
      close.setAttribute('aria-label', t('Close'));

      function finish() {
        if (done) return;
        done = true;
        form.removeEventListener('submit', submit);
        el.removeEventListener('click', click);
        document.removeEventListener('keydown', keydown, true);
        window.removeEventListener('popstate', pop, true);
        el.classList.add('hidden');
        el.classList.remove('is-open');
        if (opener?.isConnected) opener.focus?.({ preventScroll: true });
        resolve(result);
      }
      function dismiss(fromHistory = false) {
        if (closing) return;
        closing = true;
        if (managed) bridge.closeManagedModal(el.id);
        else if (historyAdded && !fromHistory) {
          // Finish on popstate so the next queued dialog owns a fresh entry.
          history.back();
        } else finish();
      }
      function submit(event) {
        event.preventDefault();
        result = kind === 'prompt' ? input.value : true;
        dismiss();
      }
      function click(event) {
        if (event.target.closest('[data-dialog-cancel]') || event.target === el) {
          event.preventDefault();
          event.stopPropagation();
          dismiss();
        }
      }
      function keydown(event) {
        if (done) return;
        if (event.key === 'Escape') {
          event.preventDefault(); event.stopImmediatePropagation(); dismiss();
        } else if (event.key === 'Tab') {
          const targets = [close, ...(kind === 'prompt' ? [input] : []), ...(kind !== 'alert' ? [cancel] : []), primary];
          const index = targets.indexOf(document.activeElement);
          if ((event.shiftKey && index <= 0) || (!event.shiftKey && (index === targets.length - 1 || index < 0))) {
            event.preventDefault();
            targets[event.shiftKey ? targets.length - 1 : 0].focus();
          }
        }
      }
      function pop(event) {
        if (!managed) { event.stopImmediatePropagation(); finish(); }
      }
      form.addEventListener('submit', submit);
      el.addEventListener('click', click);
      document.addEventListener('keydown', keydown, true);
      if (managed) {
        bridge.registerManagedModal(el.id, { onAfterClose: finish, closeOnBackdrop: true });
        bridge.openManagedModal(el.id, { replaceStack: false, opener });
      } else {
        el.classList.remove('hidden');
        el.classList.add('is-open');
        window.addEventListener('popstate', pop, true);
        try { history.pushState({ ...history.state, bananzaDialog: true }, ''); historyAdded = true; } catch (_) {}
      }
      window.requestAnimationFrame(() => {
        if (!done && !closing) (kind === 'prompt' ? input : kind === 'confirm' ? cancel : primary).focus();
      });
    });
  }
  function enqueue(kind, message, initial) {
    const next = queue.then(() => show(kind, message, initial));
    queue = next.catch(() => {});
    return next;
  }
  window.BananzaDialogs = Object.freeze({
    alert: message => enqueue('alert', message),
    confirm: message => enqueue('confirm', message),
    prompt: (message, initial = '') => enqueue('prompt', message, initial),
  });
})();
