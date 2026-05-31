(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};

  function getI18n() {
    return window.BananzaI18n || null;
  }

  function t(key, params = {}) {
    const i18n = getI18n();
    return i18n?.t ? i18n.t(key, params) : String(key || '');
  }

  function tx(text, params = {}) {
    const i18n = getI18n();
    if (i18n?.text) return i18n.text(text, params);
    if (i18n?.t) return i18n.t(text, params);
    return String(text == null ? '' : text);
  }

  root.i18nHelpers = Object.freeze({
    t,
    tx,
  });
})();
