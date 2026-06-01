(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};

  function createController(options = {}) {
    const installedLegacyModules = new Set();
    const legacyApi = {};

    function installLegacyModule(key, factory, scope) {
      if (!key || typeof factory !== 'function' || installedLegacyModules.has(key)) return legacyApi;
      const api = factory(scope) || {};
      Object.assign(legacyApi, api);
      installedLegacyModules.add(key);
      return legacyApi;
    }

    function installLegacyModules(scope = {}) {
      installLegacyModule('openai', aiAdmin.openaiRuntime?.createLegacyOpenAiRuntime, scope);
      installLegacyModule('localProviders', aiAdmin.localProvidersRuntime?.createLegacyLocalProvidersRuntime, scope);
      installLegacyModule('grok', aiAdmin.grokRuntime?.createLegacyGrokRuntime, scope);
      installLegacyModule('grokImageRisk', aiAdmin.grokImageRiskRuntime?.createLegacyGrokImageRiskRuntime, scope);
      installLegacyModule('contextChatShot', aiAdmin.contextChatShotRuntime?.createLegacyContextChatShotRuntime, scope);
      return legacyApi;
    }

    return {
      options,
      installLegacyModules,
      getLegacyApi: () => legacyApi,
    };
  }

  aiAdmin.createController = createController;
})();
