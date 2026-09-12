(function () {
  'use strict';

  const i18n = window.BananzaI18n || {};
  const t = typeof i18n.t === 'function' ? i18n.t : (key) => String(key || '');
  function applySavedTheme() {
    window.BananzaAppearance.apply(document, window.BananzaAppearance.read(window.localStorage));
  }

  function tokenFromPath() {
    const match = /^\/doc\/([^/?#]+)/.exec(window.location.pathname || '');
    return match ? decodeURIComponent(match[1]) : '';
  }

  function setStatus(text, kind = 'offline') {
    const el = document.getElementById('documentGuestStatus');
    if (!el) return;
    el.textContent = text;
    el.dataset.status = kind;
  }

  async function requestJson(url, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    return data;
  }

  function syncConnectionStatus(status, count) {
    const online = status === 'online';
    const label = online ? t('Online') : t('Offline');
    const people = Number(count || 0) > 1 ? ` (${Number(count || 0)})` : '';
    setStatus(`${label}${people}`, online ? 'online' : 'offline');
  }

  async function start() {
    const token = tokenFromPath();
    if (!token) {
      setStatus(t('Invite link is invalid'), 'offline');
      return;
    }
    try {
      setStatus(t('Preparing link...'), 'offline');
      const session = await requestJson(`/api/document-invites/${encodeURIComponent(token)}/session`);
      const titleInput = document.getElementById('documentGuestTitleInput');
      if (titleInput) titleInput.value = session.document?.title || '';
      if (!window.BananzaDocumentEditor?.createEditor) throw new Error(t('Editor unavailable'));
      window.BananzaDocumentEditor.createEditor({
        editorEl: document.getElementById('documentGuestEditor'),
        toolbarEl: document.getElementById('documentGuestToolbar'),
        titleInput,
        room: session.room,
        wsBase: session.wsBase || '/doc-ws',
        guestToken: session.guestToken || token,
        user: session.user || { name: 'Guest', color: '#8b93a7' },
        initialTitle: session.document?.title || '',
        t,
        onStatusChange: syncConnectionStatus,
      });
    } catch (error) {
      setStatus(error?.message || t('Could not join chat by link'), 'offline');
    }
  }

  applySavedTheme();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
