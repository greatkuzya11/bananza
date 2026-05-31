(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};
  const shared = aiAdmin.shared;
  if (!shared?.createProviderController) throw new Error('BananzaApp.aiAdmin.shared is required before yandex.js');

  const defaultSettings = {
    yandex_enabled: false,
    yandex_folder_id: '',
    yandex_base_url: 'https://llm.api.cloud.yandex.net/foundationModels/v1',
    yandex_default_response_model: 'yandexgpt/latest',
    yandex_default_summary_model: 'yandexgpt-lite/latest',
    yandex_default_embedding_doc_model: 'text-search-doc/latest',
    yandex_default_embedding_query_model: 'text-search-query/latest',
    yandex_temperature: 0.3,
    yandex_summary_temperature: 0.2,
    yandex_max_tokens: 1000,
    yandex_reasoning_mode: 'DISABLED',
    yandex_data_logging_enabled: false,
  };

  const defaultModels = {
    response: ['yandexgpt/latest', 'yandexgpt-lite/latest'],
    summary: ['yandexgpt-lite/latest', 'yandexgpt/latest'],
    docEmbedding: ['text-search-doc/latest'],
    queryEmbedding: ['text-search-query/latest'],
  };

  function createYandexAdmin(options = {}) {
    return shared.createProviderController({
      name: 'Yandex',
      slug: 'yandex',
      rootId: 'yandexAiSettingsModal',
      modalId: 'yandexAiSettingsModal',
      routes: {
        text: '/api/admin/yandex-ai-bots',
        settings: '/api/admin/yandex-ai-bots/settings',
        testConnection: '/api/admin/yandex-ai-bots/test-connection',
        refreshModels: '/api/admin/yandex-ai-bots/models/refresh',
        deleteKey: '/api/admin/yandex-ai-bots/key',
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
            return deps.api('/api/admin/yandex-ai-bots/key', { method: 'DELETE' }).then((data) => {
              base.mergeState(data || {});
              return data;
            });
          },
        };
      },
    });
  }

  aiAdmin.yandex = {
    createYandexAdmin,
    defaultModels,
    defaultSettings,
  };
})();
