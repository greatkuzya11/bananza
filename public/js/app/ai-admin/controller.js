(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};

  function createController(options = {}) {
    const installedRuntimeModules = new Set();
    const runtimeApi = {};

    function installRuntimeModule(key, factory, scope) {
      if (!key || typeof factory !== 'function' || installedRuntimeModules.has(key)) return runtimeApi;
      const api = factory(scope) || {};
      Object.assign(runtimeApi, api);
      installedRuntimeModules.add(key);
      return runtimeApi;
    }

    function installRuntimeModules(scope = {}) {
      installRuntimeModule('openai', aiAdmin.openaiRuntime?.createOpenAiRuntime, scope);
      installRuntimeModule('localProviders', aiAdmin.localProvidersRuntime?.createLocalProvidersRuntime, scope);
      installRuntimeModule('grok', aiAdmin.grokRuntime?.createGrokRuntime, scope);
      installRuntimeModule('grokImageRisk', aiAdmin.grokImageRiskRuntime?.createGrokImageRiskRuntime, scope);
      installRuntimeModule('contextChatShot', aiAdmin.contextChatShotRuntime?.createContextChatShotRuntime, scope);
      return runtimeApi;
    }

    return {
      options,
      installRuntimeModules,
      getRuntimeApi: () => runtimeApi,
    };
  }

  aiAdmin.createController = createController;
})();
