(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};

  function i18nHelpers() {
    return root.i18nHelpers || {};
  }

  function t(key, params = {}) {
    const helpers = i18nHelpers();
    return typeof helpers.t === 'function' ? helpers.t(key, params) : String(key || '');
  }

  function esc(s) {
    if (typeof document !== 'undefined' && document.createElement) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function parseIsoLikeDate(iso) {
    const s = String(iso);
    const needsZ = !(/[zZ]$/.test(s) || /[+\-]\d{2}:?\d{2}$/.test(s));
    return new Date(needsZ ? s + 'Z' : s);
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      const d = parseIsoLikeDate(iso);
      if (isNaN(d.getTime())) return 'Invalid Date';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Invalid Date';
    }
  }

  function formatChatListTimestamp(iso) {
    if (!iso) return '';
    try {
      const d = parseIsoLikeDate(iso);
      if (isNaN(d.getTime())) return 'Invalid Date';
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return formatTime(iso);
      return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    } catch {
      return 'Invalid Date';
    }
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      const d = parseIsoLikeDate(iso);
      if (isNaN(d.getTime())) return 'Invalid Date';
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === today.toDateString()) return t('Today');
      if (d.toDateString() === yesterday.toDateString()) return t('Yesterday');
      return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return 'Invalid Date';
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }

  function fileExtension(name) {
    const m = String(name || '').toLowerCase().match(/\.[^.]+$/);
    return m ? m[0] : '';
  }

  function normalizeMimeType(value) {
    return String(value || '').split(';')[0].trim().toLowerCase();
  }

  function formatRelativeDuration(targetIso) {
    if (!targetIso) return '';
    const normalized = String(targetIso).includes('T') ? String(targetIso) : String(targetIso).replace(' ', 'T');
    const time = new Date(/[zZ]$|[+\-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`).getTime();
    if (!Number.isFinite(time)) return '';
    const diff = time - Date.now();
    if (diff <= 0) return 'soon';
    const minutes = Math.round(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(diff / 3600000);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(diff / 86400000);
    return `${days}d`;
  }

  function formatPollDeadline(poll) {
    if (!poll) return '';
    if (poll.is_closed) {
      return poll.closed_at ? `Closed ${formatTime(poll.closed_at)}` : 'Closed';
    }
    if (!poll.closes_at) return 'Open-ended';
    const relative = formatRelativeDuration(poll.closes_at);
    return relative ? `Ends in ${relative}` : `Ends ${formatTime(poll.closes_at)}`;
  }

  function initials(name) {
    const text = String(name || '').trim();
    if (!text) return '?';
    return text.split(/\s+/).map((w) => w[0]).join('').toUpperCase().substring(0, 2) || '?';
  }

  root.formatters = Object.freeze({
    esc,
    formatTime,
    formatChatListTimestamp,
    formatDate,
    formatSize,
    fileExtension,
    normalizeMimeType,
    formatRelativeDuration,
    formatPollDeadline,
    initials,
  });
})();
