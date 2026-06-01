(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function registerCoreServices(ctx) {
    if (!ctx || typeof ctx !== 'object') return ctx;
    ctx.services.api = bootRoot.createApiService?.(ctx) || {};
    ctx.services.auth = bootRoot.createAuthService?.(ctx) || {};
    ctx.services.websocket = bootRoot.createWebSocketService?.(ctx) || {};
    ctx.services.chatList = bootRoot.createChatListService?.(ctx) || {};
    return ctx;
  }

  function init() {
    if (window.__bananzaAppRuntimeStarted) return window.BananzaAppBridge || null;
    window.__bananzaAppRuntimeStarted = true;

    const ctx = bootRoot.createRuntimeContext?.() || null;
    registerCoreServices(ctx);
    bootRoot.createPublicBridge?.(ctx);
    bootRoot.bindGlobalEvents?.(ctx);

    if (typeof bootRoot.runLegacyRuntime !== 'function') {
      throw new Error('BananzaApp legacy runtime module is required before runtime.js');
    }

    return bootRoot.runLegacyRuntime(ctx);
  }

  bootRoot.registerCoreServices = registerCoreServices;
  bootRoot.init = init;
})();
