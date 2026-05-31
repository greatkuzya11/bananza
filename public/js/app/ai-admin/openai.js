(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};
  const shared = aiAdmin.shared;
  if (!shared?.createProviderController) throw new Error('BananzaApp.aiAdmin.shared is required before openai.js');

  const defaultSettings = {
    enabled: false,
    default_response_model: 'gpt-5.4',
    default_summary_model: 'gpt-5.4',
    default_embedding_model: 'text-embedding-3-small',
    openai_default_image_model: 'gpt-image-2',
    openai_default_image_size: '1024x1024',
    openai_default_image_quality: 'auto',
    openai_default_image_background: 'auto',
    openai_default_image_output_format: 'png',
    openai_default_document_format: 'md',
    chunk_size: 50,
    retrieval_top_k: 6,
  };

  const defaultModels = {
    response: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'],
    summary: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'],
    embedding: ['text-embedding-3-small'],
    image: ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'],
    image_size: ['auto', '1024x1024', '1024x1536', '1536x1024'],
    image_quality: ['auto', 'low', 'medium', 'high'],
    image_background: ['auto', 'transparent', 'opaque'],
    image_output_format: ['png', 'webp', 'jpeg'],
  };

  function createOpenAiAdmin(options = {}) {
    const controller = shared.createProviderController({
      name: 'OpenAI',
      slug: 'openai',
      rootId: 'aiBotSettingsModal',
      modalId: 'aiBotSettingsModal',
      routes: {
        text: '/api/admin/ai-bots',
        universal: '/api/admin/openai-universal-bots',
        image: '/api/admin/openai-image-bots',
        settings: '/api/admin/ai-bots/settings',
        models: '/api/admin/ai-bots/models',
        deleteKey: '/api/admin/ai-bots/openai-key',
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
          async loadModelOptions(refresh = false) {
            const suffix = refresh ? '?refresh=1' : '';
            const data = await deps.api(`/api/admin/ai-bots/models${suffix}`);
            base.mergeState({ models: data });
            return data;
          },
          async refreshModels() {
            return this.loadModelOptions(true);
          },
          async deleteKey() {
            return deps.api('/api/admin/ai-bots/openai-key', { method: 'DELETE' }).then((data) => {
              base.mergeState(data || {});
              return data;
            });
          },
          renderModelSelect(id, values, currentValue) {
            return shared.setModelSelectOptions(id, values, currentValue, { dom: deps.dom });
          },
        };
      },
    });
    return controller;
  }

  aiAdmin.openai = {
    createOpenAiAdmin,
    defaultModels,
    defaultSettings,
  };
})();
