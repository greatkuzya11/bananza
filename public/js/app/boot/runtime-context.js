(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createRuntimeContext(options = {}) {
    const state = options.state || bootRoot.createInitialState?.() || {};
    const ctx = root.createContext
      ? root.createContext({
        config: root.config || {},
        state,
        dom: root.dom?.createDomRefs?.() || {},
        services: {},
        actions: {},
        bridge: window.BananzaAppBridge || {},
        t: root.i18nHelpers?.t,
        tx: root.i18nHelpers?.tx,
        events: options.events || {},
      })
      : {
        config: root.config || {},
        state,
        dom: root.dom?.createDomRefs?.() || {},
        services: {},
        actions: {},
        bridge: window.BananzaAppBridge || {},
      };

    ctx.features = objectOrDefault(options.features);
    ctx.boot = bootRoot;
    return ctx;
  }

  bootRoot.createRuntimeContext = createRuntimeContext;
})();
