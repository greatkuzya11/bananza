(function () {
  'use strict';
  const root = window.BananzaApp = window.BananzaApp || {};
  const chatListRoot = root.chatList = root.chatList || {};

  // A consumed gesture lasts until its click or a new pointer/keyboard gesture.
  chatListRoot.createTapGuard = function ({ document: doc = document, window: win = window } = {}) {
    let pending = false;
    const clear = () => { pending = false; };
    const suppress = () => { pending = true; };
    const consume = (event) => {
      if (!pending) return false;
      clear();
      event?.preventDefault();
      event?.stopImmediatePropagation();
      return true;
    };
    doc.addEventListener('pointerdown', clear, true);
    doc.addEventListener('keydown', clear, true);
    doc.addEventListener('click', consume, true);
    win.addEventListener('blur', clear);
    return { suppress, consume, clear };
  };

  chatListRoot.createSelectionController = function (opts) {
    const { document: doc, window: win, store, api, t, actions } = opts;
    const list = doc.getElementById('chatList');
    const panel = doc.getElementById('chatSelectionPanel');
    const header = panel?.closest('.sidebar-header');
    const selection = store.getSelectionState();
    let menu = '';
    let lastScope = '';
    const rows = () => Array.from(list.querySelectorAll('.chat-item[data-chat-id]:not(.is-hidden-search-result)'));
    const visibleIds = () => new Set(rows().map(row => Number(row.dataset.chatId)));
    const folder = () => actions.getActiveFolder?.();
    const scope = () => JSON.stringify([Number(folder()?.id || 0), actions.getFilter?.() || '']);

    function button(label, action, parent, disabled = false) {
      const el = doc.createElement('button');
      el.type = 'button';
      el.textContent = t(label);
      el.dataset.selectionAction = action;
      el.disabled = disabled;
      parent.append(el);
      return el;
    }

    function renderPanel() {
      if (!panel) return;
      const focusedAction = panel.contains(doc.activeElement) ? doc.activeElement.dataset.selectionAction : null;
      panel.replaceChildren();
      panel.classList.toggle('hidden', !selection.active);
      header?.classList.toggle('is-selecting-chats', selection.active);
      for (const child of header?.children || []) {
        if (child !== panel) child.inert = selection.active;
      }
      panel.setAttribute('aria-busy', String(selection.busy));
      if (!selection.active) return;
      const cancelButton = button('Cancel selection', 'cancel', panel, selection.busy);
      cancelButton.className = 'chat-selection-cancel';
      cancelButton.setAttribute('aria-label', t('Cancel selection'));
      cancelButton.title = t('Cancel selection');
      cancelButton.textContent = '\u00d7';
      const summary = doc.createElement('span');
      summary.className = 'chat-selection-count';
      summary.setAttribute('role', 'status');
      summary.textContent = t('{count} selected', { count: selection.ids.size });
      panel.append(summary);
      if (selection.busy) {
        const progress = doc.createElement('span');
        progress.className = 'chat-selection-progress';
        progress.setAttribute('role', 'status');
        progress.setAttribute('aria-label', t('Updating selected chats...'));
        progress.title = t('Updating selected chats...');
        panel.append(progress);
      }
      const toggle = button('Actions', 'actions', panel, selection.busy);
      toggle.className = 'chat-selection-toggle';
      toggle.setAttribute('aria-controls', 'chatSelectionActions');
      toggle.setAttribute('aria-expanded', String(Boolean(menu)));
      if (menu) {
        const sheet = doc.createElement('div');
        sheet.className = 'chat-selection-actions';
        sheet.id = 'chatSelectionActions';
        sheet.setAttribute('role', 'group');
        sheet.setAttribute('aria-label', t(menu === 'folders' ? 'Add to folder' : 'Actions'));
        if (menu === 'folders') {
          button('Back', 'back', sheet);
          const folders = (actions.getFolders?.() || []).filter(item => item.kind === 'custom');
          if (!folders.length) {
            const empty = doc.createElement('span');
            empty.textContent = t('No custom folders. Create one in Chat folders.');
            sheet.append(empty);
          }
          folders.forEach(item => {
            const el = button('', `folder:${item.id}`, sheet);
            el.textContent = item.name;
          });
        } else {
          button('Select all', 'all', sheet);
          button('Deselect all', 'none', sheet, !selection.ids.size);
          button('Add to folder', 'folders', sheet, !selection.ids.size);
          if (folder()?.kind === 'custom') button('Remove from this folder', 'remove', sheet, !selection.ids.size);
          button('Enable notifications', 'notify-on', sheet, !selection.ids.size);
          button('Disable notifications', 'notify-off', sheet, !selection.ids.size);
          button('Enable sound', 'sound-on', sheet, !selection.ids.size);
          button('Disable sound', 'sound-off', sheet, !selection.ids.size);
          button('Delete selected chats', 'delete', sheet, !Array.from(selection.ids).some(id => actions.canDeleteChat?.(store.getChatById(id))));
        }
        panel.append(sheet);
      }
      if (focusedAction) Array.from(panel.querySelectorAll('button')).find(el => el.dataset.selectionAction === focusedAction)?.focus({ preventScroll: true });
    }

    function sync() {
      const nextScope = scope();
      if (selection.active && nextScope !== lastScope && !selection.busy) {
        selection.active = false;
        selection.ids.clear();
        menu = '';
      }
      if (!selection.busy) lastScope = nextScope;
      const visible = visibleIds();
      if (!selection.busy) {
        for (const id of selection.ids) if (!visible.has(id) || !store.getChatById(id)) selection.ids.delete(id);
      }
      if (!selection.ids.size && menu === 'folders') menu = 'actions';
      list.classList.toggle('is-selecting-chats', selection.active);
      for (const row of rows()) {
        const id = Number(row.dataset.chatId);
        row.classList.toggle('is-selected', selection.active && selection.ids.has(id));
        let checkbox = row.querySelector('.chat-selection-checkbox');
        let badge = row.querySelector('.chat-selection-badge');
        if (!selection.active) { checkbox?.remove(); badge?.remove(); continue; }
        if (!checkbox) {
          checkbox = doc.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'chat-selection-checkbox';
          row.prepend(checkbox);
        }
        if (!badge) {
          badge = doc.createElement('span');
          badge.className = 'chat-selection-badge';
          badge.setAttribute('aria-hidden', 'true');
          badge.textContent = '\u2713';
          row.querySelector('.chat-item-avatar')?.append(badge);
        }
        checkbox.checked = selection.ids.has(id);
        checkbox.disabled = selection.busy;
        checkbox.setAttribute('aria-label', t('Select chat {name}', { name: store.getChatById(id)?.name || '' }));
      }
      renderPanel();
    }

    function start(chatId) {
      if (selection.busy || !visibleIds().has(Number(chatId))) return;
      selection.active = true;
      lastScope = scope();
      selection.ids.add(Number(chatId));
      menu = '';
      sync();
      rows().find(row => Number(row.dataset.chatId) === Number(chatId))?.querySelector('input')?.focus({ preventScroll: true });
    }

    function cancel() {
      if (selection.busy) return;
      selection.active = false;
      selection.ids.clear();
      menu = '';
      sync();
    }

    async function run(action) {
      if (selection.busy || !selection.ids.size) return;
      const targetFolder = action.startsWith('folder:') ? Number(action.slice(7)) : Number(folder()?.id || 0);
      if (action.startsWith('folder:') && !(actions.getFolders?.() || []).some(item => item.id === targetFolder && item.kind === 'custom')) return;
      if (action === 'remove' && folder()?.kind !== 'custom') return;
      if (!['delete', 'remove', 'notify-on', 'notify-off', 'sound-on', 'sound-off'].includes(action) && !action.startsWith('folder:')) return;
      const ids = Array.from(selection.ids);
      if (action === 'delete' && !ids.some(id => actions.canDeleteChat?.(store.getChatById(id)))) return;
      const failed = [];
      selection.busy = true;
      menu = '';
      sync();
      let refreshFailed = false;
      try {
        if (action === 'delete' && !(await win.BananzaDialogs.confirm(t('Permanently delete selected chats ({count}) for everyone? This cannot be undone. Chats you cannot delete will remain selected.', { count: ids.length })))) {
          failed.push(...ids);
          return;
        }
        if (action.startsWith('folder:')) {
          try {
            const data = await api(`/api/chat-folders/${targetFolder}/chats`, { method: 'POST', body: { chatIds: ids } });
            const members = new Set(data.folder?.chat_ids || []);
            ids.forEach(id => { if (!members.has(id)) failed.push(id); });
          } catch { failed.push(...ids); }
        } else {
          for (const id of ids) {
            try {
              if (action === 'delete') {
                if (!actions.canDeleteChat?.(store.getChatById(id))) {
                  failed.push(id);
                  continue;
                }
                await api(`/api/chats/${id}`, { method: 'DELETE' });
                await actions.removeChatLocally(id, { clearCache: true });
              } else if (action === 'remove') {
                await api(`/api/chat-folders/${targetFolder}/chats/${id}`, { method: 'DELETE' });
              } else {
                const field = action.startsWith('notify') ? 'notify_enabled' : 'sounds_enabled';
                const data = await api(`/api/chats/${id}/preferences`, { method: 'PUT', body: { [field]: action.endsWith('-on') } });
                store.patchChat(id, data.preferences || { [field]: action.endsWith('-on') });
              }
            } catch { failed.push(id); }
          }
        }
        try { await actions.refresh?.(); } catch { refreshFailed = true; }
      } catch (error) {
        failed.push(...ids.filter(id => !failed.includes(id)));
        throw error;
      } finally {
        selection.busy = false;
        selection.ids.clear();
        failed.forEach(id => selection.ids.add(id));
        selection.active = failed.length > 0;
        sync();
      }
      actions.showToast?.(t(action === 'delete' ? 'Deleted chats: {success}. Failed: {failed}.' : 'Updated chats: {success}. Failed: {failed}.', { success: ids.length - failed.length, failed: failed.length }));
      if (refreshFailed) actions.showToast?.(t('Could not refresh chats. Reload the list.'));
    }

    list.addEventListener('click', event => {
      const row = event.target.closest('.chat-item');
      if (!row) return;
      const modifier = /Mac|iPhone|iPad/.test(win.navigator.platform) ? event.metaKey : event.ctrlKey;
      if (!selection.active && !modifier) return;
      const id = Number(row.dataset.chatId);
      if (!selection.active && (!id || row.classList.contains('is-hidden-search-result'))) return;
      event.stopImmediatePropagation();
      // Let native checkbox activation finish; other row clicks are intercepted.
      if (!event.target.matches('.chat-selection-checkbox')) event.preventDefault();
      if (selection.busy || !visibleIds().has(id)) return;
      selection.active = true;
      lastScope = scope();
      if (selection.ids.has(id)) selection.ids.delete(id); else selection.ids.add(id);
      sync();
    }, true);
    panel?.addEventListener('click', event => {
      const action = event.target.closest('button')?.dataset.selectionAction;
      if (!action || selection.busy) return;
      if (action === 'cancel') cancel();
      else if (action === 'all' || action === 'none') {
        if (action === 'all') visibleIds().forEach(id => selection.ids.add(id));
        else selection.ids.clear();
        menu = ''; sync();
        panel.querySelector('[data-selection-action="actions"]')?.focus();
      }
      else if (action === 'actions') { menu = menu ? '' : 'actions'; renderPanel(); }
      else if (action === 'folders') { menu = 'folders'; renderPanel(); }
      else if (action === 'back') { menu = 'actions'; renderPanel(); }
      else { run(action).catch(() => actions.showToast?.(t('Action failed'))); }
      if (menu) panel.querySelector('.chat-selection-actions button')?.focus();
    });
    doc.addEventListener('click', event => {
      if (!menu || panel?.contains(event.target)) return;
      // Dismissing the popover must not toggle the row underneath it.
      event.preventDefault();
      event.stopImmediatePropagation();
      menu = ''; renderPanel();
      panel?.querySelector('[data-selection-action="actions"]')?.focus({ preventScroll: true });
    }, true);
    doc.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !selection.active) return;
      const dialog = doc.getElementById('appDialog');
      if (dialog && !dialog.classList.contains('hidden')) return;
      if (!doc.getElementById('chatContextMenu')?.classList.contains('hidden')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (selection.busy) return;
      if (menu) { menu = ''; renderPanel(); panel?.querySelector('[data-selection-action="actions"]')?.focus(); }
      else cancel();
    }, true);
    return { start, cancel, sync, run, isBusy: () => selection.busy };
  };
})();
