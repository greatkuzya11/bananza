(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};

  function objectOrDefault(value) {
    return value && (typeof value === 'object' || typeof value === 'function') ? value : {};
  }

  function createBridge(ctx, publicApi) {
    const bridge = objectOrDefault(window.BananzaAppBridge);
    window.BananzaAppBridge = bridge;
    Object.assign(bridge, objectOrDefault(publicApi));
    bridge.__testing = objectOrDefault(bridge.__testing);
    if (ctx && typeof ctx === 'object') ctx.bridge = bridge;
    return bridge;
  }

  if (typeof root.createBridge !== 'function') root.createBridge = createBridge;
})();
