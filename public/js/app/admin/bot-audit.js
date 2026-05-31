(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const admin = root.admin = root.admin || {};
  const botAudit = admin.botAudit = admin.botAudit || {};

  function formatBotAuditSource(source) {
    const value = String(source || '').trim().toLowerCase();
    if (value === 'private_chat_create') return 'Private chat';
    if (value === 'group_chat_create') return 'Group creation';
    if (value === 'group_member_add') return 'Add member';
    return value || 'Unknown';
  }

  function createBotAuditController(options = {}) {
    const documentRef = options.document || document;
    const select = typeof options.$ === 'function'
      ? options.$
      : (selector) => documentRef.querySelector(selector);
    const api = options.api;
    const esc = typeof options.esc === 'function' ? options.esc : (value) => String(value == null ? '' : value);
    const avatarHtml = typeof options.avatarHtml === 'function'
      ? options.avatarHtml
      : (name) => `<div class="avatar">${esc(name || 'Bot')}</div>`;
    const formatDate = typeof options.formatDate === 'function' ? options.formatDate : (value) => String(value || '');
    const formatTime = typeof options.formatTime === 'function' ? options.formatTime : (value) => String(value || '');
    const openModal = typeof options.openModal === 'function' ? options.openModal : () => {};

    async function openAdminBotAuditModal(userId, displayName = 'User') {
      if (!userId || typeof api !== 'function') return;
      select('#adminBotAuditTitle').textContent = `Bot audit: ${displayName}`;
      select('#adminBotAuditStatus').textContent = 'Loading...';
      select('#adminBotAuditList').innerHTML = '';
      openModal('adminBotAuditModal', { replaceStack: false });
      const data = await api(`/api/admin/users/${userId}/bot-additions`);
      const additions = Array.isArray(data?.additions) ? data.additions : [];
      select('#adminBotAuditStatus').textContent = additions.length ? '' : 'No bot additions recorded yet.';
      select('#adminBotAuditList').innerHTML = additions.map((entry) => `
        <div class="admin-user-row">
          ${avatarHtml(entry.bot_name || 'Bot', entry.bot_avatar_color || 'var(--accent)', entry.bot_avatar_url)}
          <div class="audit-entry-copy">
            <div class="name">${esc(entry.bot_name || 'Bot')} <span style="color:var(--text-secondary)">${esc(entry.bot_mention ? '@' + entry.bot_mention : '')}</span></div>
            <div class="audit-entry-meta">${esc((entry.chat_name || 'Chat') + (entry.chat_type ? ` \u2022 ${entry.chat_type}` : ''))}</div>
            <div class="audit-entry-meta">${esc([entry.bot_model || '', formatBotAuditSource(entry.source), entry.created_at ? `${formatDate(entry.created_at)} ${formatTime(entry.created_at)}` : ''].filter(Boolean).join(' \u2022 '))}</div>
          </div>
        </div>
      `).join('');
    }

    return {
      formatBotAuditSource,
      openAdminBotAuditModal,
    };
  }

  botAudit.formatBotAuditSource = formatBotAuditSource;
  botAudit.createBotAuditController = createBotAuditController;
})();
