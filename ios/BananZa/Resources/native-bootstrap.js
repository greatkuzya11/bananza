(function () {
  'use strict';
  if (window !== window.top || !window.webkit?.messageHandlers?.bananza) return;
  // The host prepends the exact trusted origin. Native code independently verifies every message.
  if (location.origin !== window.__bananzaTrustedOrigin) return;
  const request = (type, payload = {}) => window.webkit.messageHandlers.bananza.postMessage({ version: 1, type, payload });
  window.BananzaIOS = { request, version: 1, capabilities: { notifications: true, media: true, calls: true } };
  let lastSession = '';
  const sync = () => {
    const bridge = window.BananzaAppBridge;
    const payload = {
      token: localStorage.getItem('token') || '',
      userId: bridge?.getCurrentUser?.()?.id || 0,
      chatId: bridge?.getCurrentChatId?.() || 0,
      visible: !document.hidden,
      language: window.BananzaI18n?.getLanguage?.() || localStorage.getItem('bananza.uiLanguage') || 'ru',
    };
    const key = JSON.stringify(payload);
    if (key !== lastSession) {
      lastSession = key;
      request('session', payload).catch(() => { lastSession = ''; });
    }
  };
  const originalSet = Storage.prototype.setItem;
  const originalRemove = Storage.prototype.removeItem;
  const originalClear = Storage.prototype.clear;
  Storage.prototype.setItem = function (key, value) { originalSet.call(this, key, value); if (this === localStorage && key === 'token') sync(); };
  Storage.prototype.removeItem = function (key) { originalRemove.call(this, key); if (this === localStorage && key === 'token') sync(); };
  Storage.prototype.clear = function () { originalClear.call(this); if (this === localStorage) sync(); };
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('bananza:ready', sync);
  window.addEventListener('bananza:ios-open-chat', event => {
    const id = Number(event.detail?.chatId);
    if (id > 0) window.BananzaAppBridge?.openChatFromPush?.(id);
  });
  window.addEventListener('DOMContentLoaded', sync, { once: true });
  window.setInterval(sync, 1500);
})();
