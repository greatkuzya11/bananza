(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function createPublicBridge(ctx) {
    const coreApi = {
      api: (url, options) => ctx?.services?.api?.request?.(url, options),
      getToken: () => ctx?.services?.auth?.getToken?.() || '',
      getCurrentUser: () => ctx?.services?.auth?.getCurrentUser?.() || null,
      getCurrentChatId: () => ctx?.state?.getCurrentChatId?.() || ctx?.state?.currentChatId || null,
    };
    return root.createBridge
      ? root.createBridge(ctx, coreApi)
      : Object.assign((window.BananzaAppBridge = window.BananzaAppBridge || {}), coreApi);
  }

  bootRoot.createPublicBridge = createPublicBridge;
})();
