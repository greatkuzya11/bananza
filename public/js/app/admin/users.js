(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const admin = root.admin = root.admin || {};
  const users = admin.users = admin.users || {};

  function createAdminUsersController(options = {}) {
    const documentRef = options.document || document;
    const select = typeof options.$ === 'function'
      ? options.$
      : (selector) => documentRef.querySelector(selector);
    const api = options.api;
    const openModal = typeof options.openModal === 'function' ? options.openModal : () => {};
    const getTopModal = typeof options.getTopModal === 'function' ? options.getTopModal : () => null;
    const getOnlineUsers = typeof options.getOnlineUsers === 'function' ? options.getOnlineUsers : () => new Set();
    const avatarHtml = typeof options.avatarHtml === 'function'
      ? options.avatarHtml
      : (name) => `<div class="avatar">${esc(name || '')}</div>`;
    const esc = typeof options.esc === 'function' ? options.esc : (value) => String(value == null ? '' : value);
    const formatDate = typeof options.formatDate === 'function' ? options.formatDate : (value) => String(value || '');
    const formatTime = typeof options.formatTime === 'function' ? options.formatTime : (value) => String(value || '');
    const alertFn = typeof options.alert === 'function' ? options.alert : (message) => alert(message);
    const confirmFn = typeof options.confirm === 'function' ? options.confirm : (message) => confirm(message);
    const openAdminBotAuditModal = typeof options.openAdminBotAuditModal === 'function'
      ? options.openAdminBotAuditModal
      : () => Promise.resolve();

    function renderAdminUserRow(u) {
      const onlineUsers = getOnlineUsers();
      const isOnline = onlineUsers.has(u.id);
      const badges = [
        u.is_admin ? '<span class="badge badge-admin">Admin</span>' : '',
        u.is_blocked ? '<span class="badge badge-blocked">Blocked</span>' : '',
      ].filter(Boolean).join('');
      return `
        <div class="admin-user-row" data-uid="${u.id}">
          ${avatarHtml(u.display_name, u.avatar_color, u.avatar_url)}
          <div class="info">
            <div class="name">${esc(u.display_name)} <span style="color:var(--text-secondary)">@${esc(u.username)}</span></div>
            <div class="meta">
              <div class="admin-user-status ${isOnline ? 'online' : 'offline'}">
                <span class="status-dot"></span>${isOnline ? 'online' : 'offline'}
              </div>
              <div class="admin-user-joined">Joined: ${new Date(u.created_at + 'Z').toLocaleDateString()}</div>
              <div class="admin-user-last">Last: ${u.last_activity ? formatDate(u.last_activity) + ' ' + formatTime(u.last_activity) : '\u2014'}</div>
            </div>
          </div>
          ${badges ? `<div class="admin-user-badges">${badges}</div>` : ''}
          <div class="admin-user-controls">
            ${!u.is_admin ? `<div class="admin-user-toggle">
              <span>Add bots</span>
              <label class="toggle-switch">
                <input type="checkbox" class="bot-access-toggle" data-uid="${u.id}" ${u.can_add_bots_to_chats ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>` : ''}
            <button class="admin-user-audit-btn bot-audit-btn" data-uid="${u.id}" data-name="${esc(u.display_name)}" type="button">Bot audit</button>
          </div>
          ${!u.is_admin ? `<div class="admin-user-actions">
            <button class="reset-btn" data-uid="${u.id}" title="Reset password to 123456">\ud83d\udd11 Reset</button>
            <button class="block-btn ${u.is_blocked ? 'is-blocked' : ''}" data-uid="${u.id}">${u.is_blocked ? 'Unblock' : 'Block'}</button>
          </div>` : ''}
        </div>
      `;
    }

    function refreshAdminUserStatuses() {
      const adminModal = select('#adminModal');
      if (adminModal?.classList.contains('hidden')) return;
      const list = select('#adminUserList');
      if (!list) return;
      const onlineUsers = getOnlineUsers();
      list.querySelectorAll('.admin-user-row').forEach(row => {
        const uid = +row.dataset.uid;
        const statusEl = row.querySelector('.admin-user-status');
        if (!statusEl) return;
        const isOnline = onlineUsers.has(uid);
        statusEl.classList.toggle('online', isOnline);
        statusEl.classList.toggle('offline', !isOnline);
        statusEl.innerHTML = `<span class="status-dot"></span>${isOnline ? 'online' : 'offline'}`;
      });
    }

    async function openAdminModal() {
      openModal('adminModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
      try {
        const adminUsers = await api('/api/admin/users');
        const list = select('#adminUserList');
        list.innerHTML = adminUsers.map(renderAdminUserRow).join('');

        list.querySelectorAll('.bot-access-toggle').forEach(input => {
          input.addEventListener('change', async () => {
            try {
              await api(`/api/admin/users/${input.dataset.uid}/bot-access`, {
                method: 'PUT',
                body: { can_add_bots_to_chats: !!input.checked },
              });
            } catch (e) {
              input.checked = !input.checked;
              alertFn(e.message);
            }
          });
        });
        list.querySelectorAll('.bot-audit-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            openAdminBotAuditModal(Number(btn.dataset.uid || 0), btn.dataset.name || 'User').catch((error) => {
              alertFn(error.message || 'Could not load bot audit');
            });
          });
        });

        list.querySelectorAll('.block-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              await api(`/api/admin/users/${btn.dataset.uid}/block`, { method: 'POST' });
              openAdminModal();
            } catch {}
          });
        });
        list.querySelectorAll('.reset-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirmFn('Reset password to 123456?')) return;
            try {
              await api(`/api/admin/users/${btn.dataset.uid}/reset-password`, { method: 'POST' });
              alertFn('Password has been reset to 123456');
            } catch (e) { alertFn(e.message); }
          });
        });
      } catch {}
    }

    return {
      renderAdminUserRow,
      refreshAdminUserStatuses,
      openAdminModal,
    };
  }

  users.createAdminUsersController = createAdminUsersController;
})();
