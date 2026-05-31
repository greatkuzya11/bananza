(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};
  const shared = aiAdmin.shared;
  if (!shared?.createProviderController) throw new Error('BananzaApp.aiAdmin.shared is required before grok.js');

  const defaultSettings = {
    grok_enabled: false,
    grok_base_url: 'https://api.x.ai/v1',
    grok_default_response_model: 'grok-4.20-reasoning',
    grok_default_summary_model: 'grok-4.20-reasoning',
    grok_default_embedding_model: 'text-embedding',
    grok_default_image_model: 'grok-imagine-image',
    grok_default_image_aspect_ratio: '1:1',
    grok_default_image_resolution: '1k',
    grok_temperature: 0.3,
    grok_max_tokens: 1000,
  };

  const defaultModels = {
    response: ['grok-4.20-reasoning'],
    summary: ['grok-4.20-reasoning'],
    embedding: ['text-embedding'],
    image: ['grok-imagine-image'],
    aspect_ratio: ['1:1', '16:9', '9:16'],
    resolution: ['1k', '2k'],
  };

  function createGrokAdmin(options = {}) {
    return shared.createProviderController({
      name: 'Grok',
      slug: 'grok',
      rootId: 'grokAiSettingsModal',
      modalId: 'grokAiSettingsModal',
      routes: {
        text: '/api/admin/grok-ai-bots',
        image: '/api/admin/grok-ai-bots',
        universal: '/api/admin/grok-universal-bots',
        settings: '/api/admin/grok-ai-bots/settings',
        testConnection: '/api/admin/grok-ai-bots/test-connection',
        refreshModels: '/api/admin/grok-ai-bots/models/refresh',
        deleteKey: '/api/admin/grok-ai-bots/key',
      },
      defaults: {
        settings: defaultSettings,
        bots: [],
        imageBots: [],
        universalBots: [],
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
            return deps.api('/api/admin/grok-ai-bots/key', { method: 'DELETE' }).then((data) => {
              base.mergeState(data || {});
              return data;
            });
          },
          saveImageBot(payload = {}) {
            return base.saveBot({ ...payload, kind: 'image' }, 'image');
          },
          saveUniversalBot(payload = {}) {
            return base.saveBot({ ...payload, kind: 'universal' }, 'universal');
          },
        };
      },
    });
  }

  aiAdmin.grok = {
    createGrokAdmin,
    defaultModels,
    defaultSettings,
  };
})();
