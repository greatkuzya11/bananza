(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};
  const shared = aiAdmin.shared;
  if (!shared?.createProviderController) throw new Error('BananzaApp.aiAdmin.shared is required before qwen.js');

  const defaultSettings = {
    qwen_enabled: false,
    qwen_base_url: 'http://127.0.0.1:8000/v1',
    qwen_default_response_model: 'qwen',
    qwen_default_summary_model: 'qwen',
    qwen_temperature: 0.3,
    qwen_max_tokens: 1000,
    qwen_request_timeout_ms: 600000,
  };

  const defaultModels = {
    response: ['qwen'],
    summary: ['qwen'],
  };

  function createQwenAdmin(options = {}) {
    return shared.createProviderController({
      name: 'Qwen',
      slug: 'qwen',
      rootId: 'qwenAiSettingsModal',
      modalId: 'qwenAiSettingsModal',
      routes: {
        text: '/api/admin/qwen-ai-bots',
        settings: '/api/admin/qwen-ai-bots/settings',
        testConnection: '/api/admin/qwen-ai-bots/test-connection',
        refreshModels: '/api/admin/qwen-ai-bots/models/refresh',
        deleteKey: '/api/admin/qwen-ai-bots/key',
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
          deleteKey() {
            return deps.api('/api/admin/qwen-ai-bots/key', { method: 'DELETE' }).then((data) => {
              base.mergeState(data || {});
              return data;
            });
          },
        };
      },
    });
  }

  aiAdmin.qwen = {
    createQwenAdmin,
    defaultModels,
    defaultSettings,
  };
})();
