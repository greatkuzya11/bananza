/* Local Lucide masks decorate controls only; user content and emoji stay untouched. */
(function () {
  'use strict';
  const byId = {
    settingsBtn: 'settings', newChatBtn: 'pencil', chatSearchToggle: 'search', searchBtn: 'search',
    chatSearchClear: 'x', backBtn: 'arrow-left', chatShotBtn: 'camera', chatSettingsActionBtn: 'ellipsis',
    chatFoldersBtn: 'folder', chatHeaderActionsToggle: 'ellipsis', chatInfoBtn: 'settings', attachBtn: 'paperclip', sendBtn: 'send',
    pollBtn: 'bar-chart-3', emojiBtn: 'smile', scrollBottomBtn: 'chevron-down', searchClose: 'x',
    composerContextConvertBtn: 'banana',
  };
  // Labelled actions can share a legacy emoji but need distinct semantic icons.
  const leadingById = { settingsChangePassword: 'lock' };
  const symbols = {
    '\u260e': 'phone',
    '\u2699': 'settings', '\u2715': 'x', '\u00d7': 'x', '\u2716': 'x', '\u2713': 'check',
    '\u2714': 'check', '\u270e': 'pencil', '\u270f': 'pencil', '\u2795': 'plus',
    '\ud83d\udd0d': 'search', '\ud83d\udc48': 'arrow-left', '\ud83d\udcce': 'paperclip',
    '\ud83d\udcf7': 'camera', '\ud83c\udfa5': 'video', '\ud83d\udcf9': 'video',
    '\ud83c\udfa4': 'mic', '\ud83c\udfa8': 'palette', '\u2728': 'sparkles',
    '\ud83d\udd14': 'bell', '\ud83d\udd15': 'volume-x', '\ud83d\udd0a': 'volume-2',
    '\ud83c\udf10': 'globe', '\ud83d\uddfa': 'map-pin', '\ud83d\udccd': 'map-pin',
    '\u26c5': 'cloud-sun', '\ud83d\udd11': 'key-round', '\ud83d\udd12': 'lock',
    '\ud83d\udee1': 'shield', '\ud83d\udcbe': 'hard-drive', '\ud83d\udce6': 'hard-drive',
    '\ud83d\udc64': 'user', '\ud83d\udc65': 'users', '\ud83e\udd16': 'bot',
    '\ud83d\uddd1': 'trash-2', '\ud83d\udccc': 'pin', '\ud83d\udcc1': 'folder',
    '\ud83d\udcc4': 'file-text', '\ud83d\udccb': 'copy', '\ud83d\udd17': 'external-link',
    '\u2139': 'info', '\u25b6': 'play', '\u23f8': 'pause', '\u21bb': 'refresh-cw',
    '\ud83d\udee0': 'settings', '\ud83d\udcf1': 'monitor', '\ud83d\udd20': 'monitor',
    '\ud83d\udeaa': 'log-out', '\ud83d\uddbc': 'image', '\ud83d\udcde': 'phone',
    '\ud83d\udc41': 'eye', '\ud83d\ude48': 'eye-off',
    '\u21b6': 'undo-2', '\u21b7': 'redo-2', '\u00b6': 'pilcrow',
    '\ud835\udc01': 'bold', '\ud835\udc3c': 'italic', 'U\u0332': 'underline',
    '\u2328': 'code', '\u21e4': 'align-left', '\u2194': 'align-center', '\u21e5': 'align-right',
    '\u2022': 'list', '\u2116': 'list-ordered', '\u2611': 'list-todo', '\u275d': 'quote',
    '\ud83d\udcbb': 'code', '\u2702': 'unlink', '\ud83e\uddf9': 'remove-formatting',
    '\u25a6': 'table', '\u22ef': 'ellipsis', '\ud835\udc05': 'type',
    '\ud83c\udf99': 'mic', '\u2709': 'send', '\ud83d\udce8': 'send',
    '\ud83d\udd04': 'rotate-cw', '\ud83d\ude80': 'sparkles',
    '\u2b07': 'download', '\u2b06': 'upload', '\u21a9': 'reply', '\u21aa': 'forward',
    '\ud83c\udfac': 'clapperboard', '\ud83e\uddf0': 'hard-drive',
    '\ud83d\udc13': 'bird', '\ud83d\udc0b': 'whale', '\ud83e\udde0': 'brain',
    '\ud83d\udcac': 'message-circle', '\ud83c\udf4c': 'banana',
    '\ud83d\udcca': 'bar-chart-3', '\ud83d\udcdd': 'file-text',
    '\ud83d\udce4': 'forward', '\ud83d\ude42': 'smile',
    '\ud83d\udd01': 'repeat-2', '\u21ba': 'rotate-cw',
    '\u2191': 'arrow-up', '\u2193': 'arrow-down', '\u2796': 'minus',
    '\u29c9': 'copy', '\u2705': 'check', '\u274c': 'x', '\u26a0': 'info',
  };
  const selector = 'button, .settings-toggle-item > span:first-child, .attach-menu-icon, .chat-context-menu-icon, .media-context-menu-icon, .chat-back-btn-icon, .chat-folder-picker-emoji, .pinned-bar-icon, .sidebar-header h2, .login-body .logo h1, .empty-icon';
  const excluded = '.emoji-picker, .reaction-emoji-popover, .msg-reactions, [data-reaction], [data-emoji], .document-editor, .msg-text';

  function glyph(name) {
    const el = document.createElement('span');
    el.className = 'ui-glyph';
    el.dataset.icon = name;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }
  function decorate(el) {
    if (el.closest(excluded) || el.querySelector(':scope > .ui-glyph')) return;
    const fixed = byId[el.id] || (el.classList.contains('modal-close') ? 'x' : null);
    if (fixed) {
      if (el.classList.contains('modal-close') && !el.hasAttribute('aria-label')) {
        el.setAttribute('data-i18n-aria-label', 'Close');
        el.setAttribute('aria-label', window.BananzaI18n?.t?.('Close') || 'Close');
      }
      const legacy = document.createElement('span');
      legacy.className = 'ui-icon-legacy';
      while (el.firstChild) legacy.appendChild(el.firstChild);
      el.append(legacy, glyph(fixed));
      return;
    }
    // Only replace a known leading UI symbol, never arbitrary text or a user emoji.
    const text = [...el.childNodes].find(node => node.nodeType === 3 && node.textContent.trim());
    if (!text) return;
    const raw = text.textContent;
    const prefix = raw.match(/^\s*/)[0];
    const symbol = Object.keys(symbols).find(value => raw.slice(prefix.length).startsWith(value));
    if (!symbol) return;
    let end = prefix.length + symbol.length;
    if (raw.charCodeAt(end) === 0xfe0f) end++;
    const old = document.createElement('span');
    old.className = 'ui-icon-legacy';
    old.textContent = raw.slice(0, end);
    const next = glyph(leadingById[el.id] || symbols[symbol]);
    text.before(old, next);
    text.textContent = raw.slice(end);
  }
  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.matches(selector)) decorate(root);
    root.querySelectorAll(selector).forEach(decorate);
  }
  function start() {
    scan(document.body);
    const pending = new Set();
    let scheduled = false;
    const observer = new MutationObserver(records => {
      records.forEach(record => {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        const control = target?.closest(selector);
        if (control) pending.add(control);
        record.addedNodes.forEach(node => { if (node.nodeType === 1 && !node.matches('.ui-glyph,.ui-icon-legacy')) pending.add(node); });
      });
      if (!pending.size || scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const nodes = [...pending]; pending.clear();
        nodes.forEach(node => { if (node.isConnected) scan(node); });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
