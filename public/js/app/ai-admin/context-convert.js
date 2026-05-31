(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};
  const shared = aiAdmin.shared;
  if (!shared?.createDomAccess) throw new Error('BananzaApp.aiAdmin.shared is required before context-convert.js');

  const providerOrder = ['openai', 'yandex', 'deepseek', 'qwen', 'grok'];

  function contextConvertProviderLabel(provider = 'openai') {
    if (provider === 'yandex') return 'Yandex';
    if (provider === 'deepseek') return 'DeepSeek';
    if (provider === 'qwen') return 'Qwen';
    if (provider === 'grok') return 'Grok';
    return 'OpenAI';
  }

  function providerAccent(provider = 'openai') {
    if (provider === 'yandex') return '#fc9b28';
    if (provider === 'deepseek') return '#2a9d8f';
    if (provider === 'qwen') return '#8b5cf6';
    if (provider === 'grok') return '#5f8cff';
    return '#10a37f';
  }

  function contextConvertRouteBase(provider = 'openai') {
    if (provider === 'yandex') return '/api/admin/yandex-convert-bots';
    if (provider === 'deepseek') return '/api/admin/deepseek-convert-bots';
    if (provider === 'qwen') return '/api/admin/qwen-convert-bots';
    if (provider === 'grok') return '/api/admin/grok-convert-bots';
    return '/api/admin/openai-convert-bots';
  }

  function createDefaultAdminStates() {
    return providerOrder.reduce((states, provider) => {
      states[provider] = {
        settings: {},
        bots: [],
        chats: [],
        chatSettings: [],
        models: { response: [] },
      };
      return states;
    }, {});
  }

  function normalizeContextConvertAvailability(data = {}) {
    return {
      enabled: !!data.enabled,
      bots: Array.isArray(data.bots) ? data.bots.map((bot) => ({
        id: Number(bot.id || 0),
        name: bot.name || '',
        provider: bot.provider || 'openai',
        transform_prompt_preview: bot.transform_prompt_preview || '',
      })).filter((bot) => bot.id > 0) : [],
    };
  }

  function createContextConvertAdmin(options = {}) {
    const api = options.api || window.BananzaAppBridge?.api;
    if (typeof api !== 'function') throw new Error('Context convert api is required');
    const dom = options.dom || {};
    const services = options.services || {};
    const getCurrentChatId = options.getCurrentChatId || (() => window.BananzaAppBridge?.getCurrentChatId?.() || 0);
    const states = options.states || createDefaultAdminStates();
    const selectedBotIds = options.selectedBotIds || {};
    providerOrder.forEach((provider) => {
      if (!Object.prototype.hasOwnProperty.call(selectedBotIds, provider)) selectedBotIds[provider] = null;
    });
    let activeProvider = providerOrder.includes(options.activeProvider) ? options.activeProvider : 'openai';
    const availabilityByChat = new Map();
    const availabilityRequests = new Map();
    const pendingMessageIds = new Set();
    let composerPending = false;

    function currentState() {
      return states[activeProvider] || states.openai;
    }

    function currentBot() {
      const selectedId = Number(selectedBotIds[activeProvider] || 0);
      return currentState().bots.find((bot) => Number(bot.id) === selectedId) || null;
    }

    function mergeAdminState(provider = activeProvider, data = {}) {
      const state = data.state || data || {};
      if (!states[provider]) states[provider] = { settings: {}, bots: [], chats: [], chatSettings: [], models: {} };
      states[provider] = {
        settings: state.settings || states[provider].settings || {},
        bots: Array.isArray(state.bots) ? state.bots : (states[provider].bots || []),
        chats: Array.isArray(state.chats) ? state.chats : (states[provider].chats || []),
        chatSettings: Array.isArray(state.chatSettings) ? state.chatSettings : (states[provider].chatSettings || []),
        models: state.models || states[provider].models || {},
      };
      const bots = states[provider].bots || [];
      if (selectedBotIds[provider] && !bots.some((bot) => Number(bot.id) === Number(selectedBotIds[provider]))) {
        selectedBotIds[provider] = null;
      }
      if (!selectedBotIds[provider] && bots[0]) selectedBotIds[provider] = Number(bots[0].id) || null;
      return states[provider];
    }

    function renderAdminSettings() {
      const access = shared.createDomAccess(dom);
      const title = access.byId('contextConvertModalTitle');
      if (title) title.textContent = `${contextConvertProviderLabel(activeProvider)} Context Convert Bots`;
      const list = access.byId('contextConvertBotList');
      if (list) {
        const selectedId = Number(selectedBotIds[activeProvider] || 0);
        const bots = currentState().bots || [];
        list.innerHTML = bots.length ? bots.map((bot) => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === selectedId ? ' active' : ''}" data-context-convert-bot-id="${bot.id}">
            <span class="ai-bot-list-main"><span class="ai-bot-list-copy"><strong>${shared.esc(bot.name || 'Convert bot')}</strong></span></span>
          </button>
        `).join('') : '<div class="ai-bot-empty">No convert bots yet. Create the first one.</div>';
      }
      options.renderAdminSettings?.(currentState(), activeProvider);
      return currentState();
    }

    async function loadAdminState(provider = activeProvider) {
      activeProvider = providerOrder.includes(provider) ? provider : 'openai';
      const data = await api(contextConvertRouteBase(activeProvider));
      mergeAdminState(activeProvider, data);
      renderAdminSettings();
      return data;
    }

    function adminFormPayload(payload = {}) {
      if (Object.keys(payload).length) return payload;
      return {
        name: shared.valueOf('contextConvertBotName', dom),
        enabled: shared.checkedOf('contextConvertBotEnabled', dom),
        available_in_all_chats: shared.checkedOf('contextConvertBotAvailableAllChats', dom),
        response_model: shared.valueOf('contextConvertBotResponseModel', dom),
        temperature: shared.numberOf('contextConvertBotTemperature', dom, 0.3),
        max_tokens: shared.numberOf('contextConvertBotMaxTokens', dom, 1000),
        transform_prompt: shared.valueOf('contextConvertBotPrompt', dom),
      };
    }

    async function saveAdminBot(payload = {}) {
      const body = adminFormPayload(payload);
      const selectedId = Number(selectedBotIds[activeProvider] || 0);
      const shouldUpdate = Boolean(selectedId && currentState().bots.some((bot) => Number(bot.id) === selectedId));
      const base = contextConvertRouteBase(activeProvider);
      const data = await api(shouldUpdate ? `${base}/${selectedId}` : base, {
        method: shouldUpdate ? 'PUT' : 'POST',
        body,
      });
      mergeAdminState(activeProvider, data);
      selectedBotIds[activeProvider] = Number(data.bot?.id || selectedId || 0) || null;
      renderAdminSettings();
      return data;
    }

    async function disableAdminBot() {
      const bot = currentBot();
      if (!bot) return null;
      const data = await api(`${contextConvertRouteBase(activeProvider)}/${bot.id}`, { method: 'DELETE' });
      mergeAdminState(activeProvider, data);
      renderAdminSettings();
      return data;
    }

    async function testAdminBot(text = '') {
      const bot = currentBot();
      if (!bot) throw new Error('Save a convert bot first');
      return api(`${contextConvertRouteBase(activeProvider)}/${bot.id}/test`, {
        method: 'POST',
        body: { text },
      });
    }

    async function exportAdminBot() {
      const bot = currentBot();
      if (!bot) throw new Error('Select a saved convert bot first');
      return shared.exportJson({
        url: `${contextConvertRouteBase(activeProvider)}/${bot.id}/export`,
        token: options.getToken?.() || window.BananzaAppBridge?.getToken?.() || '',
        fetchImpl: options.fetch || window.fetch?.bind(window),
        fallbackName: `bananza-${activeProvider}-convert-${bot.id}.json`,
      });
    }

    async function importAdminBot(file) {
      const data = await shared.importJsonFile({
        api,
        file,
        url: `${contextConvertRouteBase(activeProvider)}/import`,
      });
      mergeAdminState(activeProvider, data || {});
      selectedBotIds[activeProvider] = Number(data?.bot?.id || 0) || selectedBotIds[activeProvider];
      renderAdminSettings();
      return data;
    }

    async function saveChatSetting(payload = {}) {
      const body = Object.keys(payload).length ? payload : {
        chatId: Number(shared.valueOf('contextConvertBotChatSelect', dom, 0)),
        botId: Number(shared.valueOf('contextConvertBotChatBotSelect', dom, 0)),
        enabled: shared.checkedOf('contextConvertBotChatEnabled', dom),
      };
      const data = await api(`${contextConvertRouteBase(activeProvider)}/chat-settings`, {
        method: 'PUT',
        body,
      });
      mergeAdminState(activeProvider, data || {});
      renderAdminSettings();
      return data;
    }

    async function loadAvailability(chatId = getCurrentChatId(), { force = false } = {}) {
      const id = Number(chatId || 0);
      if (!id) return { enabled: false, bots: [] };
      if (!force && availabilityByChat.has(id)) return availabilityByChat.get(id);
      if (!force && availabilityRequests.has(id)) return availabilityRequests.get(id);
      const request = api(`/api/chats/${id}/context-convert-bots`)
        .then((data) => {
          const normalized = normalizeContextConvertAvailability(data);
          availabilityByChat.set(id, normalized);
          availabilityRequests.delete(id);
          options.onAvailabilityChange?.(id, normalized);
          return normalized;
        })
        .catch((error) => {
          availabilityRequests.delete(id);
          throw error;
        });
      availabilityRequests.set(id, request);
      return request;
    }

    function invalidateAvailability(chatId) {
      const id = Number(chatId || 0);
      if (!id) return;
      availabilityByChat.delete(id);
      availabilityRequests.delete(id);
      options.onAvailabilityChange?.(id, null);
    }

    function isAvailableForChat(chatId = getCurrentChatId()) {
      const state = availabilityByChat.get(Number(chatId || 0));
      return Boolean(state?.enabled && state.bots?.length);
    }

    async function transformComposerTextWithContextConvertBot(bot) {
      const chatId = Number(getCurrentChatId() || 0);
      const composer = services.composer || {};
      const text = String(composer.getText?.({ trim: true }) || composer.getText?.() || '');
      if (!chatId || !bot?.id || !text.trim()) return null;
      composerPending = true;
      options.onComposerPendingChange?.(composerPending);
      try {
        const data = await api(`/api/chats/${chatId}/context-convert`, {
          method: 'POST',
          body: { botId: bot.id, text: text.trim() },
        });
        composer.setText?.(data.text || '');
        return data;
      } finally {
        composerPending = false;
        options.onComposerPendingChange?.(composerPending);
      }
    }

    async function transformMessageWithContextConvertBot(messageId, bot) {
      const id = Number(messageId || 0);
      if (!id || !bot?.id || pendingMessageIds.has(id)) return null;
      pendingMessageIds.add(id);
      options.onMessagePendingChange?.(id, true);
      try {
        const data = await api(`/api/messages/${id}/context-convert`, {
          method: 'POST',
          body: { botId: bot.id },
        });
        services.messages?.applyMessageUpdate?.(data.message);
        return data;
      } finally {
        pendingMessageIds.delete(id);
        options.onMessagePendingChange?.(id, false);
      }
    }

    async function restoreContextOriginalMessage(messageId) {
      const id = Number(messageId || 0);
      if (!id) return null;
      const data = await api(`/api/messages/${id}/context-convert/restore-original`, { method: 'POST' });
      services.messages?.applyMessageUpdate?.(data.message);
      return data;
    }

    function openComposerContextConvertPicker() {
      return options.openPicker?.({ mode: 'composer' }) || null;
    }

    function openMessageContextConvertPicker(row, anchorEl = null, pickerOptions = {}) {
      return options.openPicker?.({ mode: 'message', row, anchorEl, ...pickerOptions }) || null;
    }

    return {
      contextConvertProviderLabel,
      contextConvertRouteBase,
      currentBot,
      currentState,
      disableBot: disableAdminBot,
      exportBotJson: exportAdminBot,
      getActiveProvider: () => activeProvider,
      getAvailability: (chatId) => availabilityByChat.get(Number(chatId || 0)) || null,
      getPendingMessageIds: () => new Set(pendingMessageIds),
      getState: () => states,
      importBotJsonFile: importAdminBot,
      invalidateContextConvertAvailability: invalidateAvailability,
      isContextTransformAvailableForChat: isAvailableForChat,
      loadContextConvertAvailability: loadAvailability,
      loadState: loadAdminState,
      mergeAdminState,
      normalizeContextConvertAvailability,
      openComposerContextConvertPicker,
      openMessageContextConvertPicker,
      openSettingsModal: (provider = activeProvider) => loadAdminState(provider),
      providerAccent,
      renderSettings: renderAdminSettings,
      restoreContextOriginalMessage,
      saveBot: saveAdminBot,
      saveChatBotSettings: saveChatSetting,
      setActiveProvider: (provider) => {
        activeProvider = providerOrder.includes(provider) ? provider : 'openai';
        return activeProvider;
      },
      setSelectedBotId: (provider, botId) => {
        selectedBotIds[provider] = Number(botId || 0) || null;
      },
      testBot: testAdminBot,
      transformComposerTextWithContextConvertBot,
      transformMessageWithContextConvertBot,
    };
  }

  let defaultController = null;

  function getDefaultController() {
    if (!defaultController) {
      defaultController = createContextConvertAdmin({
        api: (...args) => window.BananzaAppBridge?.api?.(...args),
        getCurrentChatId: () => window.BananzaAppBridge?.getCurrentChatId?.() || 0,
        services: {
          composer: window.BananzaAppBridge?.composer || {},
          messages: window.BananzaAppBridge?.messages || {},
        },
      });
    }
    return defaultController;
  }

  aiAdmin.contextConvert = {
    contextConvertProviderLabel,
    contextConvertRouteBase,
    createContextConvertAdmin,
    getDefaultController,
    invalidateContextConvertAvailability: (...args) => getDefaultController().invalidateContextConvertAvailability(...args),
    isContextTransformAvailableForChat: (...args) => getDefaultController().isContextTransformAvailableForChat(...args),
    loadContextConvertAvailability: (...args) => getDefaultController().loadContextConvertAvailability(...args),
    normalizeContextConvertAvailability,
    openComposerContextConvertPicker: (...args) => getDefaultController().openComposerContextConvertPicker(...args),
    openMessageContextConvertPicker: (...args) => getDefaultController().openMessageContextConvertPicker(...args),
    providerAccent,
    restoreContextOriginalMessage: (...args) => getDefaultController().restoreContextOriginalMessage(...args),
    transformComposerTextWithContextConvertBot: (...args) => getDefaultController().transformComposerTextWithContextConvertBot(...args),
    transformMessageWithContextConvertBot: (...args) => getDefaultController().transformMessageWithContextConvertBot(...args),
  };
})();
