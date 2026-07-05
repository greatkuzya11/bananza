(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const admin = root.admin = root.admin || {};
  const users = admin.users = admin.users || {};

  const TOKEN_PRESETS = [
    { value: '3600', label: '1 hour' },
    { value: '86400', label: '1 day' },
    { value: '604800', label: '7 days' },
    { value: '2592000', label: '30 days' },
    { value: 'custom', label: 'Custom' },
  ];
  const TOKEN_UNITS = [
    { value: 'minutes', label: 'minutes' },
    { value: 'hours', label: 'hours' },
    { value: 'days', label: 'days' },
  ];

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
    const tx = typeof options.tx === 'function' ? options.tx : (value) => String(value == null ? '' : value);
    const copyTextToClipboard = typeof options.copyTextToClipboard === 'function'
      ? options.copyTextToClipboard
      : () => Promise.resolve(false);
    const alertFn = typeof options.alert === 'function' ? options.alert : (message) => alert(message);
    const confirmFn = typeof options.confirm === 'function' ? options.confirm : (message) => confirm(message);
    const openAdminBotAuditModal = typeof options.openAdminBotAuditModal === 'function'
      ? options.openAdminBotAuditModal
      : () => Promise.resolve();

    function tokenOptionHtml(option, selectedValue = '2592000') {
      return `<option value="${esc(option.value)}" ${option.value === selectedValue ? 'selected' : ''}>${esc(tx(option.label))}</option>`;
    }

    function renderTokenControls() {
      return `
        <div class="admin-user-token-panel hidden">
          <div class="settings-hint admin-token-hint">${esc(tx('Tokens are shown once and are not stored by BananZa.'))}</div>
          <div class="api-token-compact-grid">
            <label class="api-token-field">
              <span>${esc(tx('Token lifetime'))}</span>
              <select class="modal-input admin-token-preset">
                ${TOKEN_PRESETS.map((option) => tokenOptionHtml(option)).join('')}
              </select>
            </label>
            <div class="api-token-custom-row admin-token-custom-row hidden">
              <input class="modal-input admin-token-custom-amount" type="number" min="1" step="1" value="1" aria-label="${esc(tx('Custom token lifetime amount'))}">
              <select class="modal-input admin-token-custom-unit" aria-label="${esc(tx('Custom token lifetime unit'))}">
                ${TOKEN_UNITS.map((option) => tokenOptionHtml(option, 'days')).join('')}
              </select>
            </div>
            <label class="admin-token-never-row">
              <span>${esc(tx('Never expires'))}</span>
              <span class="toggle-switch">
                <input type="checkbox" class="admin-token-never">
                <span class="toggle-slider"></span>
              </span>
            </label>
          </div>
          <div class="admin-token-actions">
            <button class="admin-token-generate-btn" type="button">${esc(tx('Generate token'))}</button>
            <button class="admin-token-copy-btn" type="button" disabled>${esc(tx('Copy token'))}</button>
          </div>
          <textarea class="modal-input admin-token-output" readonly spellcheck="false" rows="3" placeholder="${esc(tx('Generated token appears here once'))}"></textarea>
          <div class="theme-settings-status admin-token-status" role="status" aria-live="polite"></div>
        </div>
      `;
    }

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
            <button class="admin-user-audit-btn admin-user-token-btn" data-uid="${u.id}" type="button">${esc(tx('API token'))}</button>
            <button class="admin-user-audit-btn bot-audit-btn" data-uid="${u.id}" data-name="${esc(u.display_name)}" type="button">Bot audit</button>
          </div>
          ${!u.is_admin ? `<div class="admin-user-actions">
            <button class="reset-btn" data-uid="${u.id}" title="Reset password to 123456">\ud83d\udd11 Reset</button>
            <button class="block-btn ${u.is_blocked ? 'is-blocked' : ''}" data-uid="${u.id}">${u.is_blocked ? 'Unblock' : 'Block'}</button>
          </div>` : ''}
          ${renderTokenControls()}
        </div>
      `;
    }

    function setAdminTokenStatus(panel, message, type = '') {
      const status = panel?.querySelector('.admin-token-status');
      if (!status) return;
      status.textContent = message ? tx(message) : '';
      status.classList.toggle('is-error', type === 'error');
      status.classList.toggle('is-success', type === 'success');
      status.classList.toggle('is-pending', type === 'pending');
    }

    function clearAdminTokenPanel(panel) {
      const output = panel?.querySelector('.admin-token-output');
      const copyBtn = panel?.querySelector('.admin-token-copy-btn');
      if (output) output.value = '';
      if (copyBtn) copyBtn.disabled = true;
      setAdminTokenStatus(panel, '');
    }

    function syncAdminTokenPanel(panel) {
      const never = !!panel?.querySelector('.admin-token-never')?.checked;
      const preset = panel?.querySelector('.admin-token-preset');
      const customRow = panel?.querySelector('.admin-token-custom-row');
      const custom = preset?.value === 'custom';
      if (preset) preset.disabled = never;
      customRow?.classList.toggle('hidden', never || !custom);
      panel?.querySelectorAll('.admin-token-custom-amount, .admin-token-custom-unit').forEach((el) => {
        el.disabled = never || !custom;
      });
    }

    function adminTokenPayload(panel) {
      if (panel?.querySelector('.admin-token-never')?.checked) return { neverExpires: true };
      const preset = panel?.querySelector('.admin-token-preset')?.value || '2592000';
      if (preset !== 'custom') return { expiresInSeconds: Number(preset) };
      const amount = Number(panel?.querySelector('.admin-token-custom-amount')?.value || 0);
      const unit = panel?.querySelector('.admin-token-custom-unit')?.value || 'days';
      const multipliers = { minutes: 60, hours: 3600, days: 86400 };
      return { expiresInSeconds: Math.floor(amount * (multipliers[unit] || 86400)) };
    }

    function formatAdminTokenStatus(data) {
      if (data?.never_expires) return 'Token generated. It never expires.';
      const date = data?.expires_at ? new Date(data.expires_at) : null;
      if (date && Number.isFinite(date.getTime())) {
        return tx('Token generated. Expires at {time}', { time: date.toLocaleString() });
      }
      return 'Token generated.';
    }

    async function generateAdminToken(btn) {
      const row = btn?.closest('.admin-user-row');
      const panel = row?.querySelector('.admin-user-token-panel');
      const uid = Number(btn?.dataset.uid || row?.dataset.uid || 0);
      const output = panel?.querySelector('.admin-token-output');
      const copyBtn = panel?.querySelector('.admin-token-copy-btn');
      if (!uid || !panel) return;
      btn.disabled = true;
      clearAdminTokenPanel(panel);
      setAdminTokenStatus(panel, 'Generating token...', 'pending');
      try {
        const data = await api(`/api/admin/users/${uid}/tokens`, {
          method: 'POST',
          body: adminTokenPayload(panel),
        });
        if (output) output.value = data?.token || '';
        if (copyBtn) copyBtn.disabled = !data?.token;
        setAdminTokenStatus(panel, formatAdminTokenStatus(data), 'success');
      } catch (error) {
        setAdminTokenStatus(panel, error?.message || 'Could not generate token', 'error');
      } finally {
        btn.disabled = false;
      }
    }

    async function copyAdminToken(btn) {
      const panel = btn?.closest('.admin-user-token-panel');
      const token = panel?.querySelector('.admin-token-output')?.value || '';
      const copied = await copyTextToClipboard(token);
      setAdminTokenStatus(panel, copied ? 'Token copied' : 'Could not copy token', copied ? 'success' : 'error');
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
        list.querySelectorAll('.admin-user-token-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const panel = btn.closest('.admin-user-row')?.querySelector('.admin-user-token-panel');
            if (!panel) return;
            panel.classList.toggle('hidden');
            syncAdminTokenPanel(panel);
          });
        });
        list.querySelectorAll('.admin-token-preset').forEach(input => {
          input.addEventListener('change', () => {
            const panel = input.closest('.admin-user-token-panel');
            clearAdminTokenPanel(panel);
            syncAdminTokenPanel(panel);
          });
        });
        list.querySelectorAll('.admin-token-never').forEach(input => {
          input.addEventListener('change', () => {
            const panel = input.closest('.admin-user-token-panel');
            clearAdminTokenPanel(panel);
            syncAdminTokenPanel(panel);
          });
        });
        list.querySelectorAll('.admin-token-custom-amount').forEach(input => {
          input.addEventListener('input', () => clearAdminTokenPanel(input.closest('.admin-user-token-panel')));
        });
        list.querySelectorAll('.admin-token-custom-unit').forEach(input => {
          input.addEventListener('change', () => clearAdminTokenPanel(input.closest('.admin-user-token-panel')));
        });
        list.querySelectorAll('.admin-token-generate-btn').forEach(btn => {
          btn.addEventListener('click', () => generateAdminToken(btn));
        });
        list.querySelectorAll('.admin-token-copy-btn').forEach(btn => {
          btn.addEventListener('click', () => copyAdminToken(btn));
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
