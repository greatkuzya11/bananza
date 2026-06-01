(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function bindGlobalEvents(ctx) {
    return ctx;
  }

  bootRoot.bindGlobalEvents = bindGlobalEvents;
})();
