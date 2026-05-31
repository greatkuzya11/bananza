(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};
  const shared = aiAdmin.shared;
  if (!shared?.createProviderController) throw new Error('BananzaApp.aiAdmin.shared is required before deepseek.js');

  const defaultSettings = {
    deepseek_enabled: false,
    deepseek_base_url: 'https://api.deepseek.com',
    deepseek_default_response_model: 'deepseek-chat',
    deepseek_default_summary_model: 'deepseek-chat',
    deepseek_temperature: 0.3,
    deepseek_max_tokens: 1000,
    deepseek_request_timeout_ms: 600000,
  };

  const defaultModels = {
    response: ['deepseek-chat', 'deepseek-reasoner'],
    summary: ['deepseek-chat', 'deepseek-reasoner'],
  };

  function createDeepseekAdmin(options = {}) {
    return shared.createProviderController({
      name: 'DeepSeek',
      slug: 'deepseek',
      rootId: 'deepseekAiSettingsModal',
      modalId: 'deepseekAiSettingsModal',
      routes: {
        text: '/api/admin/deepseek-ai-bots',
        settings: '/api/admin/deepseek-ai-bots/settings',
        testConnection: '/api/admin/deepseek-ai-bots/test-connection',
        refreshModels: '/api/admin/deepseek-ai-bots/models/refresh',
        balance: '/api/admin/deepseek-ai-bots/balance',
        deleteKey: '/api/admin/deepseek-ai-bots/key',
      },
      defaults: {
        settings: defaultSettings,
        bots: [],
        chats: [],
        chatSettings: [],
        models: defaultModels,
      },
    }, {
      ...options,
      extraMethods(base, deps) {
        return {
          testConnection(payload = {}) {
            return base.callExtra('testConnection', payload, 'POST');
          },
          refreshModels(payload = {}) {
            return base.callExtra('refreshModels', payload, 'POST');
          },
          checkBalance(payload = {}) {
            return base.callExtra('balance', payload, 'POST');
          },
          deleteKey() {
            return deps.api('/api/admin/deepseek-ai-bots/key', { method: 'DELETE' }).then((data) => {
              base.mergeState(data || {});
              return data;
            });
          },
        };
      },
    });
  }

  aiAdmin.deepseek = {
    createDeepseekAdmin,
    defaultModels,
    defaultSettings,
  };
})();
