(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};
  const shared = aiAdmin.shared;
  if (!shared?.createDomAccess) throw new Error('BananzaApp.aiAdmin.shared is required before chatshot.js');

  function chatShotRouteBase(provider = 'openai') {
    if (provider === 'grok') return '/api/admin/grok-chatshot-bots';
    return '/api/admin/openai-chatshot-bots';
  }

  function normalizeChatShotState(data = {}) {
    return {
      chatId: Number(data.chatId || data.chat_id || 0),
      enabled: !!data.enabled,
      requested_enabled: !!data.requested_enabled,
      botId: Number(data.botId || data.bot_id || 0) || null,
      style: ['comic', 'illustration', 'photo'].includes(String(data.style || '').toLowerCase()) ? String(data.style).toLowerCase() : 'comic',
      banana_filter_enabled: data.banana_filter_enabled !== false
        && data.banana_filter_enabled !== 0
        && data.bananaFilterEnabled !== false
        && data.bananaFilterEnabled !== 0,
      ready: !!data.ready,
      message_count: Number(data.message_count || 0),
      source: data.source || (data.document ? 'document' : 'chat'),
      document_text_length: Number(data.document_text_length || data.documentTextLength || 0),
      bots: Array.isArray(data.bots) ? data.bots.map((bot) => ({
        id: Number(bot.id || 0),
        name: bot.name || 'ChatShot',
        provider: bot.provider || 'openai',
        image_model: bot.image_model || '',
      })).filter((bot) => bot.id > 0) : [],
      selectedBot: data.selectedBot || data.selected_bot || null,
    };
  }

  const CHATSHOT_SAVE_ECHO_TTL_MS = 2500;

  function chatShotSelectedBotId(state = {}) {
    return Number(state.botId || state.bot_id || state.selectedBot?.id || state.selected_bot?.id || 0) || null;
  }

  function chatShotBananaFilterEnabled(value) {
    return value !== false && value !== 0;
  }

  function chatShotStateSignature(state = {}) {
    return JSON.stringify([
      !!state.enabled,
      !!state.requested_enabled,
      chatShotSelectedBotId(state),
      ['comic', 'illustration', 'photo'].includes(String(state.style || '').toLowerCase()) ? String(state.style).toLowerCase() : 'comic',
      chatShotBananaFilterEnabled(state.banana_filter_enabled),
    ]);
  }

  function chatShotStateMatchesChat(state = {}, chat = {}) {
    return Boolean(chat)
      && !!state.requested_enabled === !!chat.chatshot_enabled
      && chatShotSelectedBotId(state) === (Number(chat.chatshot_bot_id || 0) || null)
      && String(state.style || 'comic') === String(chat.chatshot_style || 'comic')
      && chatShotBananaFilterEnabled(state.banana_filter_enabled) === (chat.chatshot_banana_filter_enabled !== 0);
  }

  function syncChatShotBotSelectOptions(botSelect, bots, selectedBotId) {
    const optionModels = bots.map((bot) => ({
      id: Number(bot.id || 0),
      label: bot.name || 'ChatShot',
    }));
    const signature = JSON.stringify(optionModels);
    if (botSelect.dataset.chatShotOptionsSignature !== signature) {
      botSelect.innerHTML = optionModels.map((bot) => `<option value="${bot.id}">${shared.esc(bot.label)}</option>`).join('');
      botSelect.dataset.chatShotOptionsSignature = signature;
    }
    if (bots.some((bot) => Number(bot.id) === selectedBotId)) botSelect.value = String(selectedBotId);
    botSelect.disabled = !bots.length || bots.length === 1;
  }

  function createDefaultAdminStates() {
    return {
      openai: { settings: {}, bots: [], chats: [], chatSettings: [], models: {} },
      grok: { settings: {}, bots: [], chats: [], chatSettings: [], models: {} },
    };
  }

  function createChatShotAdmin(options = {}) {
    const api = options.api || window.BananzaAppBridge?.api;
    if (typeof api !== 'function') throw new Error('ChatShot api is required');
    const dom = options.dom || {};
    const services = options.services || {};
    const getCurrentChatId = options.getCurrentChatId || (() => window.BananzaAppBridge?.getCurrentChatId?.() || 0);
    const states = options.states || createDefaultAdminStates();
    const selectedBotIds = options.selectedBotIds || { openai: null, grok: null };
    let activeProvider = options.activeProvider === 'grok' ? 'grok' : 'openai';
    const stateByChat = new Map();
    const requests = new Map();
    const failuresByChat = new Set();
    const generatingByChat = new Set();
    const recentSavesByChat = new Map();

    function rememberChatShotSaveEcho(chatId, state) {
      const id = Number(chatId || 0);
      if (!id || !state) return;
      recentSavesByChat.set(id, {
        state,
        signature: chatShotStateSignature(state),
        expiresAt: Date.now() + CHATSHOT_SAVE_ECHO_TTL_MS,
        remainingEchoes: 2,
      });
    }

    function forgetChatShotSaveEcho(chatId) {
      recentSavesByChat.delete(Number(chatId || 0));
    }

    function getRecentChatShotSave(chatId) {
      const id = Number(chatId || 0);
      const recent = recentSavesByChat.get(id);
      if (!recent) return null;
      if (recent.expiresAt < Date.now()) {
        recentSavesByChat.delete(id);
        return null;
      }
      return recent;
    }

    function consumeRecentChatShotSaveEcho(chatId, options = {}) {
      const id = Number(chatId || 0);
      const recent = getRecentChatShotSave(id);
      if (!recent) return false;
      if (options.chat && !chatShotStateMatchesChat(recent.state, options.chat)) return false;
      if (recent.remainingEchoes <= 0) return false;
      recent.remainingEchoes -= 1;
      return true;
    }

    function currentAdminState() {
      return states[activeProvider] || states.openai;
    }

    function currentAdminBot() {
      const selectedId = Number(selectedBotIds[activeProvider] || 0);
      return currentAdminState().bots.find((bot) => Number(bot.id) === selectedId) || null;
    }

    function mergeAdminState(provider = activeProvider, data = {}) {
      const incoming = data.state || data || {};
      if (!states[provider]) states[provider] = { settings: {}, bots: [], chats: [], chatSettings: [], models: {} };
      states[provider] = {
        settings: incoming.settings || states[provider].settings || {},
        bots: Array.isArray(incoming.bots) ? incoming.bots : (states[provider].bots || []),
        chats: Array.isArray(incoming.chats) ? incoming.chats : (states[provider].chats || []),
        chatSettings: Array.isArray(incoming.chatSettings) ? incoming.chatSettings : (states[provider].chatSettings || []),
        models: incoming.models || states[provider].models || {},
      };
      const bots = states[provider].bots || [];
      if (selectedBotIds[provider] && !bots.some((bot) => Number(bot.id) === Number(selectedBotIds[provider]))) {
        selectedBotIds[provider] = null;
      }
      if (!selectedBotIds[provider] && bots[0]) selectedBotIds[provider] = Number(bots[0].id) || null;
      stateByChat.clear();
      failuresByChat.clear();
      return states[provider];
    }

    function renderAdminSettings() {
      const access = shared.createDomAccess(dom);
      const title = access.byId('chatShotModalTitle');
      if (title) title.textContent = `${activeProvider === 'grok' ? 'Grok' : 'OpenAI'} ChatShot Bots`;
      const list = access.byId('chatShotBotList');
      if (list) {
        const selectedId = Number(selectedBotIds[activeProvider] || 0);
        const bots = currentAdminState().bots || [];
        list.innerHTML = bots.length ? bots.map((bot) => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === selectedId ? ' active' : ''}" data-chat-shot-bot-id="${bot.id}">
            <span class="ai-bot-list-main"><span class="ai-bot-list-copy"><strong>${shared.esc(bot.name || 'ChatShot')}</strong></span></span>
          </button>
        `).join('') : '<div class="ai-bot-empty">No ChatShot bots yet. Create the first one.</div>';
      }
      options.renderAdminSettings?.(currentAdminState(), activeProvider);
      return currentAdminState();
    }

    async function loadAdminState(provider = activeProvider) {
      activeProvider = provider === 'grok' ? 'grok' : 'openai';
      const data = await api(chatShotRouteBase(activeProvider));
      mergeAdminState(activeProvider, data);
      renderAdminSettings();
      return data;
    }

    function adminFormPayload(payload = {}) {
      if (Object.keys(payload).length) return payload;
      return {
        name: shared.valueOf('chatShotBotName', dom),
        enabled: shared.checkedOf('chatShotBotEnabled', dom),
        available_in_all_chats: shared.checkedOf('chatShotBotAvailableAllChats', dom),
        response_model: shared.valueOf('chatShotBotResponseModel', dom),
        image_model: shared.valueOf('chatShotBotImageModel', dom),
        image_resolution: shared.valueOf('chatShotBotImageResolution', dom),
        image_quality: shared.valueOf('chatShotBotImageQuality', dom),
        image_background: shared.valueOf('chatShotBotImageBackground', dom),
        image_output_format: shared.valueOf('chatShotBotImageOutputFormat', dom),
        image_aspect_ratio: shared.valueOf('chatShotBotAspectRatio', dom),
        chatshot_context_limit: shared.numberOf('chatShotBotContextLimit', dom, 50),
        temperature: shared.numberOf('chatShotBotTemperature', dom, 0.3),
        max_tokens: shared.numberOf('chatShotBotMaxTokens', dom, 900),
      };
    }

    async function saveAdminBot(payload = {}) {
      const body = adminFormPayload(payload);
      const selectedId = Number(selectedBotIds[activeProvider] || 0);
      const shouldUpdate = Boolean(selectedId && currentAdminState().bots.some((bot) => Number(bot.id) === selectedId));
      const base = chatShotRouteBase(activeProvider);
      const data = await api(shouldUpdate ? `${base}/${selectedId}` : base, {
        method: shouldUpdate ? 'PUT' : 'POST',
        body,
      });
      mergeAdminState(activeProvider, data || {});
      selectedBotIds[activeProvider] = Number(data?.bot?.id || selectedId || 0) || null;
      renderAdminSettings();
      return data;
    }

    async function disableAdminBot() {
      const bot = currentAdminBot();
      if (!bot) return null;
      const data = await api(`${chatShotRouteBase(activeProvider)}/${bot.id}`, { method: 'DELETE' });
      mergeAdminState(activeProvider, data || {});
      renderAdminSettings();
      return data;
    }

    async function testAdminBot(payload = {}) {
      const bot = currentAdminBot();
      if (!bot) throw new Error('Save a ChatShot bot first');
      return api(`${chatShotRouteBase(activeProvider)}/${bot.id}/test`, { method: 'POST', body: payload });
    }

    async function exportAdminBot() {
      const bot = currentAdminBot();
      if (!bot) throw new Error('Select a saved ChatShot bot first');
      return shared.exportJson({
        url: `${chatShotRouteBase(activeProvider)}/${bot.id}/export`,
        token: options.getToken?.() || window.BananzaAppBridge?.getToken?.() || '',
        fetchImpl: options.fetch || window.fetch?.bind(window),
        fallbackName: `bananza-${activeProvider}-chatshot-${bot.id}.json`,
      });
    }

    async function importAdminBot(file) {
      const data = await shared.importJsonFile({
        api,
        file,
        url: `${chatShotRouteBase(activeProvider)}/import`,
      });
      mergeAdminState(activeProvider, data || {});
      selectedBotIds[activeProvider] = Number(data?.bot?.id || 0) || selectedBotIds[activeProvider];
      renderAdminSettings();
      return data;
    }

    async function saveAdminChatSetting(payload = {}) {
      const body = Object.keys(payload).length ? payload : {
        chatId: Number(shared.valueOf('chatShotBotChatSelect', dom, 0)),
        botId: Number(shared.valueOf('chatShotBotChatBotSelect', dom, 0)),
        enabled: shared.checkedOf('chatShotBotChatEnabled', dom),
      };
      const data = await api(`${chatShotRouteBase(activeProvider)}/chat-settings`, {
        method: 'PUT',
        body,
      });
      mergeAdminState(activeProvider, data || {});
      renderAdminSettings();
      return data;
    }

    function getCurrentChatShotState(chatId = getCurrentChatId()) {
      return stateByChat.get(Number(chatId || 0)) || null;
    }

    async function loadChatShotState(chatId = getCurrentChatId(), { force = false } = {}) {
      const id = Number(chatId || 0);
      if (!id) return null;
      if (!force && stateByChat.has(id)) return stateByChat.get(id);
      if (!force && requests.has(id)) return requests.get(id);
      if (!force && failuresByChat.has(id)) return null;
      if (force) failuresByChat.delete(id);
      const request = api(`/api/chats/${id}/chatshot`)
        .then((data) => {
          const normalized = normalizeChatShotState(data);
          stateByChat.set(id, normalized);
          failuresByChat.delete(id);
          requests.delete(id);
          if (id === Number(getCurrentChatId() || 0)) {
            renderChatShotForm(normalized);
            syncChatShotButton();
          }
          return normalized;
        })
        .catch((error) => {
          requests.delete(id);
          failuresByChat.add(id);
          if (id === Number(getCurrentChatId() || 0)) syncChatShotButton();
          throw error;
        });
      requests.set(id, request);
      return request;
    }

    function invalidateChatShotState(chatId, options = {}) {
      const id = Number(chatId || 0);
      if (!id) return false;
      if (consumeRecentChatShotSaveEcho(id, options)) return false;
      const keepCurrentState = options.keepCurrentState && stateByChat.has(id);
      if (!keepCurrentState) stateByChat.delete(id);
      requests.delete(id);
      failuresByChat.delete(id);
      if (id === Number(getCurrentChatId() || 0)) syncChatShotButton();
      return true;
    }

    function renderChatShotForm(state = getCurrentChatShotState()) {
      const access = shared.createDomAccess(dom);
      const section = access.byId('chatShotSection');
      const toggle = access.byId('chatShotToggle');
      const botSelect = access.byId('chatShotBotSelect');
      const styleSelect = access.byId('chatShotStyleSelect');
      const bananaFilterToggle = access.byId('chatShotBananaFilterToggle');
      const bots = Array.isArray(state?.bots) ? state.bots : [];
      section?.classList?.toggle('hidden', !bots.length);
      if (toggle) {
        toggle.checked = !!state?.enabled || !!state?.requested_enabled;
        toggle.disabled = !bots.length;
      }
      if (botSelect) {
        const selectedBotId = Number(state?.botId || state?.selectedBot?.id || bots[0]?.id || 0);
        syncChatShotBotSelectOptions(botSelect, bots, selectedBotId);
      }
      if (styleSelect) styleSelect.value = state?.style || 'comic';
      if (bananaFilterToggle) {
        bananaFilterToggle.checked = state?.banana_filter_enabled !== false;
        bananaFilterToggle.disabled = !bots.length;
      }
      options.renderChatShotForm?.(state);
      return state;
    }

    async function saveChatShotChatSetting(payload = {}) {
      const chatId = Number(getCurrentChatId() || 0);
      if (!chatId) return null;
      const previous = getCurrentChatShotState(chatId);
      const body = Object.keys(payload).length ? payload : {
        enabled: shared.checkedOf('chatShotToggle', dom),
        botId: Number(shared.valueOf('chatShotBotSelect', dom, previous?.botId || 0)) || null,
        style: shared.valueOf('chatShotStyleSelect', dom, previous?.style || 'comic'),
        bananaFilterEnabled: shared.checkedOf('chatShotBananaFilterToggle', dom, true),
      };
      const optimisticState = normalizeChatShotState({
        ...(previous || {}),
        chatId,
        enabled: !!body.enabled && !!body.botId,
        requested_enabled: !!body.enabled,
        botId: body.botId,
        style: body.style,
        bananaFilterEnabled: body.bananaFilterEnabled,
        selectedBot: (previous?.bots || []).find((bot) => Number(bot.id) === Number(body.botId)) || previous?.selectedBot || null,
      });
      stateByChat.set(chatId, optimisticState);
      rememberChatShotSaveEcho(chatId, optimisticState);
      try {
        const data = await api(`/api/chats/${chatId}/chatshot`, { method: 'PUT', body });
        const normalized = normalizeChatShotState(data);
        stateByChat.set(chatId, normalized);
        renderChatShotForm(normalized);
        syncChatShotButton();
        rememberChatShotSaveEcho(chatId, normalized);
        return normalized;
      } catch (error) {
        forgetChatShotSaveEcho(chatId);
        if (previous) {
          stateByChat.set(chatId, previous);
          renderChatShotForm(previous);
        }
        syncChatShotButton();
        throw error;
      }
    }

    function syncChatShotButton() {
      const button = shared.createDomAccess(dom).byId('chatShotBtn');
      if (!button) return false;
      const chatId = Number(getCurrentChatId() || 0);
      const state = getCurrentChatShotState(chatId);
      const generating = generatingByChat.has(chatId);
      const isDocument = state?.source === 'document' || Number(options.getChatById?.(chatId)?.is_document || 0) === 1;
      const canRun = Boolean(state?.enabled && state?.botId && (state?.ready || isDocument));
      const shouldShow = Boolean(chatId && (generating || canRun));
      button.classList.toggle('hidden', !shouldShow);
      button.classList.toggle('is-pending', generating);
      button.disabled = generating || !shouldShow;
      options.onButtonSync?.(shouldShow, generating);
      return shouldShow;
    }

    async function runChatShotGeneration() {
      const chatId = Number(getCurrentChatId() || 0);
      if (!chatId || generatingByChat.has(chatId)) return null;
      const chat = options.getChatById?.(chatId) || null;
      const isDocument = Number(chat?.is_document || 0) === 1;
      generatingByChat.add(chatId);
      syncChatShotButton();
      try {
        return await api(isDocument ? `/api/documents/${chatId}/chatshot` : `/api/chats/${chatId}/chatshot`, { method: 'POST', body: {} });
      } finally {
        generatingByChat.delete(chatId);
        syncChatShotButton();
      }
    }

    return {
      chatShotRouteBase,
      currentBot: currentAdminBot,
      currentState: currentAdminState,
      disableBot: disableAdminBot,
      exportBotJson: exportAdminBot,
      getActiveProvider: () => activeProvider,
      getCurrentChatShotState,
      getGeneratingChatIds: () => new Set(generatingByChat),
      getState: () => states,
      importBotJsonFile: importAdminBot,
      invalidateChatShotState,
      loadChatShotState,
      loadState: loadAdminState,
      mergeAdminState,
      normalizeChatShotState,
      openSettingsModal: (provider = activeProvider) => loadAdminState(provider),
      renderChatShotForm,
      renderSettings: renderAdminSettings,
      runChatShotGeneration,
      saveBot: saveAdminBot,
      saveChatBotSettings: saveAdminChatSetting,
      saveChatShotChatSetting,
      setActiveProvider: (provider) => {
        activeProvider = provider === 'grok' ? 'grok' : 'openai';
        return activeProvider;
      },
      setSelectedBotId: (provider, botId) => {
        selectedBotIds[provider] = Number(botId || 0) || null;
      },
      syncChatShotButton,
      testBot: testAdminBot,
    };
  }

  let defaultController = null;

  function getDefaultController() {
    if (!defaultController) {
      defaultController = createChatShotAdmin({
        api: (...args) => window.BananzaAppBridge?.api?.(...args),
        getCurrentChatId: () => window.BananzaAppBridge?.getCurrentChatId?.() || 0,
      });
    }
    return defaultController;
  }

  aiAdmin.chatShot = {
    chatShotRouteBase,
    createChatShotAdmin,
    getDefaultController,
    invalidateChatShotState: (...args) => getDefaultController().invalidateChatShotState(...args),
    loadChatShotState: (...args) => getDefaultController().loadChatShotState(...args),
    normalizeChatShotState,
    renderChatShotForm: (...args) => getDefaultController().renderChatShotForm(...args),
    runChatShotGeneration: (...args) => getDefaultController().runChatShotGeneration(...args),
    saveChatShotChatSetting: (...args) => getDefaultController().saveChatShotChatSetting(...args),
    syncChatShotButton: (...args) => getDefaultController().syncChatShotButton(...args),
  };
})();
