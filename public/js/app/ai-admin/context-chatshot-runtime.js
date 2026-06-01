(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};

  function createLegacyContextChatShotRuntime(scope = {}) {
    with (scope) {
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
    
      function currentContextConvertAdminState() {
        return contextConvertAdminStates[activeContextConvertProvider] || contextConvertAdminStates.openai;
      }
    
      function currentContextConvertAdminBot() {
        const state = currentContextConvertAdminState();
        const selectedId = Number(selectedContextConvertBotIds[activeContextConvertProvider] || 0);
        return state.bots.find((bot) => Number(bot.id) === selectedId) || null;
      }
    
      function getContextConvertChatSetting(chatId, botId) {
        const state = currentContextConvertAdminState();
        return state.chatSettings.find((item) => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
      }
    
      function setContextConvertInlineStatus(targetIds, message, type = '') {
        setInlineStatus(targetIds, message, type);
      }
    
      function setContextConvertModalStatus(message, type = '') {
        setContextConvertInlineStatus('contextConvertStatus', message, type);
      }
    
      function setContextConvertBotStatus(message, type = '') {
        setContextConvertInlineStatus(['contextConvertBotEditorStatus', 'contextConvertBotEditorStatusBottom'], message, type);
      }
    
      function setContextConvertChatStatus(message, type = '') {
        setContextConvertInlineStatus('contextConvertBotChatStatus', message, type);
      }
    
      function mergeContextConvertAdminState(provider = 'openai', data = {}) {
        const state = data.state || data;
        if (!contextConvertAdminStates[provider]) return;
        contextConvertAdminStates[provider] = {
          settings: state.settings || contextConvertAdminStates[provider].settings,
          bots: state.bots || contextConvertAdminStates[provider].bots,
          chats: state.chats || contextConvertAdminStates[provider].chats,
          chatSettings: state.chatSettings || contextConvertAdminStates[provider].chatSettings,
          models: state.models || contextConvertAdminStates[provider].models,
        };
        if (provider === 'openai' && state.settings) syncSharedOpenAiSettings(state.settings);
        if (provider === 'yandex' && state.settings) yandexBotState.settings = { ...yandexBotState.settings, ...state.settings };
        if (provider === 'deepseek' && state.settings) deepseekBotState.settings = { ...deepseekBotState.settings, ...state.settings };
        if (provider === 'qwen' && state.settings) qwenBotState.settings = { ...qwenBotState.settings, ...state.settings };
        if (provider === 'grok' && state.settings) grokBotState.settings = { ...grokBotState.settings, ...state.settings };
        const bots = contextConvertAdminStates[provider].bots || [];
        if (selectedContextConvertBotIds[provider] && !bots.some((bot) => Number(bot.id) === Number(selectedContextConvertBotIds[provider]))) {
          selectedContextConvertBotIds[provider] = null;
        }
        if (!selectedContextConvertBotIds[provider] && bots[0]) {
          selectedContextConvertBotIds[provider] = Number(bots[0].id);
        }
        contextConvertAvailabilityByChat.clear();
      }
    
      function renderContextConvertBotList() {
        const list = $('#contextConvertBotList');
        if (!list) return;
        const state = currentContextConvertAdminState();
        const selectedId = Number(selectedContextConvertBotIds[activeContextConvertProvider] || 0);
        if (!state.bots.length) {
          list.innerHTML = '<div class="ai-bot-empty">No convert bots yet. Create the first one.</div>';
          return;
        }
        list.innerHTML = state.bots.map((bot) => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === selectedId ? ' active' : ''}" data-context-convert-bot-id="${bot.id}">
            <span class="ai-bot-list-main">
              <span class="ai-bot-list-copy">
                <strong>${esc(bot.name || 'Convert bot')}</strong>
                <small>${bot.enabled ? 'enabled' : 'disabled'}${bot.available_in_all_chats ? ' \u00b7 all chats' : ''}${bot.response_model ? ` \u00b7 ${esc(bot.response_model)}` : ''}</small>
              </span>
            </span>
          </button>
        `).join('');
      }
    
      function renderContextConvertForm() {
        const state = currentContextConvertAdminState();
        const bot = currentContextConvertAdminBot() || null;
        const responseModels = state.models?.response || [];
        setAiModelSelectOptions(
          'contextConvertBotResponseModel',
          responseModels,
          bot?.response_model || responseModels[0] || ''
        );
        $('#contextConvertBotName').value = bot?.name || `${contextConvertProviderLabel(activeContextConvertProvider)} Convert`;
        $('#contextConvertBotTemperature').value = bot?.temperature ?? 0.3;
        $('#contextConvertBotMaxTokens').value = bot?.max_tokens ?? 1000;
        const enabledToggle = $('#contextConvertBotEnabled');
        const allChatsToggle = $('#contextConvertBotAvailableAllChats');
        if (enabledToggle) enabledToggle.checked = bot?.enabled !== false;
        if (allChatsToggle) {
          allChatsToggle.checked = !!bot?.available_in_all_chats;
          allChatsToggle.disabled = !enabledToggle?.checked;
        }
        $('#contextConvertBotPrompt').value = bot?.transform_prompt || '';
      }
    
      function renderContextConvertChatSettings() {
        const state = currentContextConvertAdminState();
        const chatSelect = $('#contextConvertBotChatSelect');
        const botSelect = $('#contextConvertBotChatBotSelect');
        if (!chatSelect || !botSelect) return;
        const currentChatValue = chatSelect.value || String(currentChatId || state.chats[0]?.id || '');
        const currentBotValue = botSelect.value || String(selectedContextConvertBotIds[activeContextConvertProvider] || state.bots[0]?.id || '');
        chatSelect.innerHTML = state.chats.map((chat) => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
        botSelect.innerHTML = state.bots.map((bot) => `<option value="${bot.id}">${esc(bot.name)}</option>`).join('');
        if (state.chats.some((chat) => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
        if (state.bots.some((bot) => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
        if (!botSelect.value && state.bots[0]) botSelect.value = String(state.bots[0].id);
        const setting = getContextConvertChatSetting(chatSelect.value, botSelect.value);
        const bot = state.bots.find((item) => Number(item.id) === Number(botSelect.value));
        const isGlobalBot = !!bot?.available_in_all_chats;
        const chatEnabledToggle = $('#contextConvertBotChatEnabled');
        if (chatEnabledToggle) {
          chatEnabledToggle.checked = isGlobalBot || !!setting?.enabled;
          chatEnabledToggle.disabled = isGlobalBot;
        }
        const saveButton = $('#contextConvertBotChatSave');
        if (saveButton) saveButton.disabled = isGlobalBot;
      }
    
      function renderContextConvertAdminSettings() {
        $('#contextConvertModalTitle').textContent = `${contextConvertProviderLabel(activeContextConvertProvider)} Context Convert Bots`;
        renderContextConvertBotList();
        renderContextConvertForm();
        renderContextConvertChatSettings();
      }
    
      function contextConvertAdminFormPayload() {
        return {
          name: $('#contextConvertBotName')?.value.trim(),
          enabled: $('#contextConvertBotEnabled')?.checked,
          available_in_all_chats: $('#contextConvertBotAvailableAllChats')?.checked,
          response_model: $('#contextConvertBotResponseModel')?.value.trim(),
          temperature: Number($('#contextConvertBotTemperature')?.value || 0.3),
          max_tokens: Number($('#contextConvertBotMaxTokens')?.value || 1000),
          transform_prompt: $('#contextConvertBotPrompt')?.value.trim(),
        };
      }
    
      async function loadContextConvertAdminState(provider = activeContextConvertProvider) {
        const data = await api(contextConvertRouteBase(provider));
        mergeContextConvertAdminState(provider, data);
        if (provider === activeContextConvertProvider) renderContextConvertAdminSettings();
        return data;
      }
    
      function openContextConvertBotsModal(provider = 'openai') {
        if (!currentUser?.is_admin) return;
        activeContextConvertProvider = provider;
        openModal('contextConvertBotsModal', { replaceStack: false, opener: $(`#${provider === 'openai' ? 'openAiOpenConvertBots' : (provider === 'grok' ? 'grokAiOpenConvertBots' : `${provider}AiOpenConvertBots`)}`) });
        resetManagedModalScroll('contextConvertBotsModal');
        setContextConvertModalStatus('Loading...');
        const state = contextConvertAdminStates[provider];
        if (state?.bots?.length || state?.chats?.length) {
          renderContextConvertAdminSettings();
          setContextConvertModalStatus('Refreshing...');
        }
        loadContextConvertAdminState(provider).then(() => {
          renderContextConvertAdminSettings();
          resetManagedModalScroll('contextConvertBotsModal');
          setContextConvertModalStatus('');
        }).catch((error) => {
          setContextConvertModalStatus(error.message || 'Could not load convert bots', 'error');
        });
      }
    
      async function saveContextConvertAdminBot() {
        const payload = contextConvertAdminFormPayload();
        if (!payload.name) {
          setContextConvertBotStatus('Enter bot name', 'error');
          return;
        }
        if (!payload.transform_prompt) {
          setContextConvertBotStatus('Enter transform prompt', 'error');
          return;
        }
        const selectedId = Number(selectedContextConvertBotIds[activeContextConvertProvider] || 0);
        const state = currentContextConvertAdminState();
        const shouldUpdate = Boolean(selectedId && state.bots.some((bot) => Number(bot.id) === selectedId));
        const url = shouldUpdate
          ? `${contextConvertRouteBase(activeContextConvertProvider)}/${selectedId}`
          : contextConvertRouteBase(activeContextConvertProvider);
        const method = shouldUpdate ? 'PUT' : 'POST';
        setContextConvertBotStatus('Saving...');
        try {
          const data = await api(url, { method, body: payload });
          mergeContextConvertAdminState(activeContextConvertProvider, data);
          selectedContextConvertBotIds[activeContextConvertProvider] = Number(data.bot?.id || selectedId || 0) || null;
          renderContextConvertAdminSettings();
          setContextConvertBotStatus('Convert bot saved', 'success');
        } catch (error) {
          setContextConvertBotStatus(error.message || 'Could not save convert bot', 'error');
        }
      }
    
      async function disableContextConvertAdminBot() {
        const bot = currentContextConvertAdminBot();
        if (!bot) return;
        if (!confirm('Disable this convert bot in all chats?')) return;
        try {
          const data = await api(`${contextConvertRouteBase(activeContextConvertProvider)}/${bot.id}`, { method: 'DELETE' });
          mergeContextConvertAdminState(activeContextConvertProvider, data);
          renderContextConvertAdminSettings();
          setContextConvertBotStatus('Convert bot disabled', 'success');
        } catch (error) {
          setContextConvertBotStatus(error.message || 'Could not disable convert bot', 'error');
        }
      }
    
      async function testContextConvertAdminBot() {
        const bot = currentContextConvertAdminBot();
        if (!bot) {
          setContextConvertBotStatus('Save a convert bot first', 'error');
          return;
        }
        const sample = window.prompt('Source text for test transform:', 'Can you rewrite this text to sound clearer and more concise?');
        if (sample == null) return;
        setContextConvertBotStatus('Testing...');
        try {
          const data = await api(`${contextConvertRouteBase(activeContextConvertProvider)}/${bot.id}/test`, {
            method: 'POST',
            body: { text: sample },
          });
          const text = String(data.result?.text || '').trim().slice(0, 500);
          setContextConvertBotStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
        } catch (error) {
          setContextConvertBotStatus(error.message || 'Convert bot test failed', 'error');
        }
      }
    
      async function exportContextConvertAdminBot() {
        const bot = currentContextConvertAdminBot();
        if (!bot) {
          setContextConvertBotStatus('Select a saved convert bot first', 'error');
          return;
        }
        setContextConvertBotStatus('Preparing JSON...');
        try {
          const res = await fetch(`${contextConvertRouteBase(activeContextConvertProvider)}/${bot.id}/export`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Export failed');
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filenameFromContentDisposition(
            res.headers.get('content-disposition'),
            `bananza-${activeContextConvertProvider}-convert-${bot.id}.json`
          );
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          setContextConvertBotStatus('JSON exported', 'success');
        } catch (error) {
          setContextConvertBotStatus(error.message || 'Could not export JSON', 'error');
        }
      }
    
      async function importContextConvertAdminBot(file) {
        if (!file) return;
        setContextConvertBotStatus('Importing JSON...');
        try {
          const raw = await file.text();
          const payload = JSON.parse(raw);
          const data = await api(`${contextConvertRouteBase(activeContextConvertProvider)}/import`, {
            method: 'POST',
            body: payload,
          });
          mergeContextConvertAdminState(activeContextConvertProvider, data);
          selectedContextConvertBotIds[activeContextConvertProvider] = Number(data.bot?.id || 0) || selectedContextConvertBotIds[activeContextConvertProvider];
          renderContextConvertAdminSettings();
          const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
          setContextConvertBotStatus(`JSON imported.${warnings}`.trim(), warnings ? 'warning' : 'success');
        } catch (error) {
          setContextConvertBotStatus(error.message || 'Could not import JSON', 'error');
        }
      }
    
      async function saveContextConvertAdminChatSetting() {
        const chatId = Number($('#contextConvertBotChatSelect')?.value || 0);
        const botId = Number($('#contextConvertBotChatBotSelect')?.value || 0);
        if (!chatId || !botId) {
          setContextConvertChatStatus('Select chat and bot', 'error');
          return;
        }
        const state = currentContextConvertAdminState();
        const bot = state.bots.find((item) => Number(item.id) === Number(botId));
        if (bot?.available_in_all_chats) {
          renderContextConvertChatSettings();
          setContextConvertChatStatus('This bot is already available in all context-enabled chats', 'success');
          return;
        }
        setContextConvertChatStatus('Saving...');
        try {
          const data = await api(`${contextConvertRouteBase(activeContextConvertProvider)}/chat-settings`, {
            method: 'PUT',
            body: {
              chatId,
              botId,
              enabled: $('#contextConvertBotChatEnabled')?.checked,
            },
          });
          mergeContextConvertAdminState(activeContextConvertProvider, data);
          renderContextConvertChatSettings();
          setContextConvertChatStatus('Chat setting saved', 'success');
        } catch (error) {
          setContextConvertChatStatus(error.message || 'Could not save chat setting', 'error');
        }
      }
    
      function chatShotRouteBase(provider = 'openai') {
        if (provider === 'grok') return '/api/admin/grok-chatshot-bots';
        return '/api/admin/openai-chatshot-bots';
      }
    
      function currentChatShotAdminState() {
        return chatShotAdminStates[activeChatShotProvider] || chatShotAdminStates.openai;
      }
    
      function currentChatShotAdminBot() {
        const state = currentChatShotAdminState();
        const selectedId = Number(selectedChatShotBotIds[activeChatShotProvider] || 0);
        return state.bots.find((bot) => Number(bot.id) === selectedId) || null;
      }
    
      function getChatShotAdminChatSetting(chatId, botId) {
        const state = currentChatShotAdminState();
        return state.chatSettings.find((item) => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
      }
    
      function setChatShotModalStatus(message, type = '') {
        setInlineStatus('chatShotAdminStatus', message, type);
      }
    
      function setChatShotBotStatus(message, type = '') {
        setInlineStatus(['chatShotBotEditorStatus', 'chatShotBotEditorStatusBottom'], message, type);
      }
    
      function setChatShotAdminChatStatus(message, type = '') {
        setInlineStatus('chatShotBotChatStatus', message, type);
      }
    
      function mergeChatShotAdminState(provider = 'openai', data = {}) {
        const state = data.state || data;
        if (!chatShotAdminStates[provider]) return;
        chatShotAdminStates[provider] = {
          settings: state.settings || chatShotAdminStates[provider].settings,
          bots: state.bots || chatShotAdminStates[provider].bots,
          chats: state.chats || chatShotAdminStates[provider].chats,
          chatSettings: state.chatSettings || chatShotAdminStates[provider].chatSettings,
          models: state.models || chatShotAdminStates[provider].models,
        };
        if (provider === 'openai' && state.settings) syncSharedOpenAiSettings(state.settings);
        if (provider === 'grok' && state.settings) grokBotState.settings = { ...grokBotState.settings, ...state.settings };
        const bots = chatShotAdminStates[provider].bots || [];
        if (selectedChatShotBotIds[provider] && !bots.some((bot) => Number(bot.id) === Number(selectedChatShotBotIds[provider]))) {
          selectedChatShotBotIds[provider] = null;
        }
        if (!selectedChatShotBotIds[provider] && bots[0]) {
          selectedChatShotBotIds[provider] = Number(bots[0].id);
        }
        chatShotStateByChat.clear();
        chatShotStateFailuresByChat.clear();
      }
    
      function renderChatShotBotList() {
        const list = $('#chatShotBotList');
        if (!list) return;
        const state = currentChatShotAdminState();
        const selectedId = Number(selectedChatShotBotIds[activeChatShotProvider] || 0);
        if (!state.bots.length) {
          list.innerHTML = '<div class="ai-bot-empty">No ChatShot bots yet. Create the first one.</div>';
          return;
        }
        list.innerHTML = state.bots.map((bot) => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === selectedId ? ' active' : ''}" data-chat-shot-bot-id="${bot.id}">
            <span class="ai-bot-list-main">
              <span class="ai-bot-list-copy">
                <strong>${esc(bot.name || 'ChatShot')}</strong>
                <small>${bot.enabled ? 'enabled' : 'disabled'}${bot.available_in_all_chats ? ' \u0412\u00b7 all chats' : ''}${bot.image_model ? ` \u0412\u00b7 ${esc(bot.image_model)}` : ''}</small>
              </span>
            </span>
          </button>
        `).join('');
      }
    
      function renderChatShotAdminForm() {
        const state = currentChatShotAdminState();
        const bot = currentChatShotAdminBot() || null;
        const isGrok = activeChatShotProvider === 'grok';
        const responseModels = state.models?.response || [];
        const imageModels = state.models?.image || [];
        setAiModelSelectOptions('chatShotBotResponseModel', responseModels, bot?.response_model || responseModels[0] || '');
        setAiModelSelectOptions('chatShotBotImageModel', imageModels, bot?.image_model || imageModels[0] || '');
        setStaticSelectOptions('chatShotBotImageResolution', isGrok ? (state.models?.resolution || ['1k', '2k']) : (state.models?.image_size || OPENAI_IMAGE_SIZE_OPTIONS), bot?.image_resolution || (isGrok ? '1k' : '1024x1024'));
        setStaticSelectOptions('chatShotBotImageQuality', state.models?.image_quality || OPENAI_IMAGE_QUALITY_OPTIONS, bot?.image_quality || 'auto');
        setStaticSelectOptions('chatShotBotImageBackground', state.models?.image_background || OPENAI_IMAGE_BACKGROUND_OPTIONS, bot?.image_background || 'auto');
        setStaticSelectOptions('chatShotBotImageOutputFormat', state.models?.image_output_format || OPENAI_IMAGE_OUTPUT_OPTIONS, bot?.image_output_format || 'png');
        setStaticSelectOptions('chatShotBotAspectRatio', state.models?.aspect_ratio || ['1:1', '16:9', '9:16', 'auto'], bot?.image_aspect_ratio || '1:1');
        $('#chatShotBotName').value = bot?.name || `${contextConvertProviderLabel(activeChatShotProvider)} ChatShot`;
        $('#chatShotBotContextLimit').value = bot?.chatshot_context_limit ?? 50;
        $('#chatShotBotTemperature').value = bot?.temperature ?? 0.3;
        $('#chatShotBotMaxTokens').value = bot?.max_tokens ?? 900;
        $('#chatShotBotEnabled').checked = bot?.enabled !== false;
        const allChatsToggle = $('#chatShotBotAvailableAllChats');
        if (allChatsToggle) {
          allChatsToggle.checked = !!bot?.available_in_all_chats;
          allChatsToggle.disabled = !$('#chatShotBotEnabled')?.checked;
        }
        $('#chatShotBotGrokAspectWrap')?.classList.toggle('hidden', !isGrok);
        $('#chatShotBotOpenAiQualityWrap')?.classList.toggle('hidden', isGrok);
        $('#chatShotBotOpenAiBackgroundWrap')?.classList.toggle('hidden', isGrok);
        $('#chatShotBotOpenAiOutputWrap')?.classList.toggle('hidden', isGrok);
      }
    
      function renderChatShotAdminChatSettings() {
        const state = currentChatShotAdminState();
        const chatSelect = $('#chatShotBotChatSelect');
        const botSelect = $('#chatShotBotChatBotSelect');
        if (!chatSelect || !botSelect) return;
        const currentChatValue = chatSelect.value || String(currentChatId || state.chats[0]?.id || '');
        const currentBotValue = botSelect.value || String(selectedChatShotBotIds[activeChatShotProvider] || state.bots[0]?.id || '');
        chatSelect.innerHTML = state.chats.map((chat) => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
        botSelect.innerHTML = state.bots.map((bot) => `<option value="${bot.id}">${esc(bot.name)}</option>`).join('');
        if (state.chats.some((chat) => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
        if (state.bots.some((bot) => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
        if (!botSelect.value && state.bots[0]) botSelect.value = String(state.bots[0].id);
        const setting = getChatShotAdminChatSetting(chatSelect.value, botSelect.value);
        const bot = state.bots.find((item) => Number(item.id) === Number(botSelect.value));
        const isGlobalBot = !!bot?.available_in_all_chats;
        const chatEnabledToggle = $('#chatShotBotChatEnabled');
        if (chatEnabledToggle) {
          chatEnabledToggle.checked = isGlobalBot || !!setting?.enabled;
          chatEnabledToggle.disabled = isGlobalBot;
        }
        const saveButton = $('#chatShotBotChatSave');
        if (saveButton) saveButton.disabled = isGlobalBot;
      }
    
      function renderChatShotAdminSettings() {
        $('#chatShotModalTitle').textContent = `${contextConvertProviderLabel(activeChatShotProvider)} ChatShot Bots`;
        renderChatShotBotList();
        renderChatShotAdminForm();
        renderChatShotAdminChatSettings();
      }
    
      function chatShotAdminFormPayload() {
        return {
          name: $('#chatShotBotName')?.value.trim(),
          enabled: $('#chatShotBotEnabled')?.checked,
          available_in_all_chats: $('#chatShotBotAvailableAllChats')?.checked,
          response_model: $('#chatShotBotResponseModel')?.value.trim(),
          image_model: $('#chatShotBotImageModel')?.value.trim(),
          image_resolution: $('#chatShotBotImageResolution')?.value.trim(),
          image_quality: $('#chatShotBotImageQuality')?.value.trim(),
          image_background: $('#chatShotBotImageBackground')?.value.trim(),
          image_output_format: $('#chatShotBotImageOutputFormat')?.value.trim(),
          image_aspect_ratio: $('#chatShotBotAspectRatio')?.value.trim(),
          chatshot_context_limit: Number($('#chatShotBotContextLimit')?.value || 50),
          temperature: Number($('#chatShotBotTemperature')?.value || 0.3),
          max_tokens: Number($('#chatShotBotMaxTokens')?.value || 900),
        };
      }
    
      async function loadChatShotAdminState(provider = activeChatShotProvider) {
        const data = await api(chatShotRouteBase(provider));
        mergeChatShotAdminState(provider, data);
        if (provider === activeChatShotProvider) renderChatShotAdminSettings();
        return data;
      }
    
      function openChatShotBotsModal(provider = 'openai') {
        if (!currentUser?.is_admin) return;
        activeChatShotProvider = provider === 'grok' ? 'grok' : 'openai';
        const openerId = activeChatShotProvider === 'grok' ? 'grokAiOpenChatShotBots' : 'openAiOpenChatShotBots';
        openModal('chatShotBotsModal', { replaceStack: false, opener: $(`#${openerId}`) });
        resetManagedModalScroll('chatShotBotsModal');
        setChatShotModalStatus('Loading...');
        const state = chatShotAdminStates[activeChatShotProvider];
        if (state?.bots?.length || state?.chats?.length) {
          renderChatShotAdminSettings();
          setChatShotModalStatus('Refreshing...');
        }
        loadChatShotAdminState(activeChatShotProvider).then(() => {
          renderChatShotAdminSettings();
          resetManagedModalScroll('chatShotBotsModal');
          setChatShotModalStatus('');
        }).catch((error) => {
          setChatShotModalStatus(error.message || 'Could not load ChatShot bots', 'error');
        });
      }
    
      async function saveChatShotAdminBot() {
        const payload = chatShotAdminFormPayload();
        if (!payload.name) {
          setChatShotBotStatus('Enter bot name', 'error');
          return;
        }
        const selectedId = Number(selectedChatShotBotIds[activeChatShotProvider] || 0);
        const state = currentChatShotAdminState();
        const shouldUpdate = Boolean(selectedId && state.bots.some((bot) => Number(bot.id) === selectedId));
        const url = shouldUpdate ? `${chatShotRouteBase(activeChatShotProvider)}/${selectedId}` : chatShotRouteBase(activeChatShotProvider);
        setChatShotBotStatus('Saving...');
        try {
          const data = await api(url, { method: shouldUpdate ? 'PUT' : 'POST', body: payload });
          mergeChatShotAdminState(activeChatShotProvider, data);
          selectedChatShotBotIds[activeChatShotProvider] = Number(data.bot?.id || selectedId || 0) || null;
          renderChatShotAdminSettings();
          setChatShotBotStatus('ChatShot bot saved', 'success');
        } catch (error) {
          setChatShotBotStatus(error.message || 'Could not save ChatShot bot', 'error');
        }
      }
    
      async function disableChatShotAdminBot() {
        const bot = currentChatShotAdminBot();
        if (!bot) return;
        if (!confirm('Disable this ChatShot bot in all chats?')) return;
        try {
          const data = await api(`${chatShotRouteBase(activeChatShotProvider)}/${bot.id}`, { method: 'DELETE' });
          mergeChatShotAdminState(activeChatShotProvider, data);
          renderChatShotAdminSettings();
          setChatShotBotStatus('ChatShot bot disabled', 'success');
        } catch (error) {
          setChatShotBotStatus(error.message || 'Could not disable ChatShot bot', 'error');
        }
      }
    
      async function testChatShotAdminBot() {
        const bot = currentChatShotAdminBot();
        if (!bot) {
          setChatShotBotStatus('Save a ChatShot bot first', 'error');
          return;
        }
        const sample = window.prompt('Chat context for test prompt:', 'User: We planned a friendly weekend meetup. Friend: Bring something bright and funny.');
        if (sample == null) return;
        setChatShotBotStatus('Testing...');
        try {
          const data = await api(`${chatShotRouteBase(activeChatShotProvider)}/${bot.id}/test`, {
            method: 'POST',
            body: { text: sample, style: 'comic' },
          });
          const text = String(data.result?.text || '').trim().slice(0, 600);
          setChatShotBotStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
        } catch (error) {
          setChatShotBotStatus(error.message || 'ChatShot bot test failed', 'error');
        }
      }
    
      async function exportChatShotAdminBot() {
        const bot = currentChatShotAdminBot();
        if (!bot) {
          setChatShotBotStatus('Select a saved ChatShot bot first', 'error');
          return;
        }
        setChatShotBotStatus('Preparing JSON...');
        try {
          const res = await fetch(`${chatShotRouteBase(activeChatShotProvider)}/${bot.id}/export`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Export failed');
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filenameFromContentDisposition(
            res.headers.get('content-disposition'),
            `bananza-${activeChatShotProvider}-chatshot-${bot.id}.json`
          );
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          setChatShotBotStatus('JSON exported', 'success');
        } catch (error) {
          setChatShotBotStatus(error.message || 'Could not export JSON', 'error');
        }
      }
    
      async function importChatShotAdminBot(file) {
        if (!file) return;
        setChatShotBotStatus('Importing JSON...');
        try {
          const raw = await file.text();
          const payload = JSON.parse(raw);
          const data = await api(`${chatShotRouteBase(activeChatShotProvider)}/import`, {
            method: 'POST',
            body: payload,
          });
          mergeChatShotAdminState(activeChatShotProvider, data);
          selectedChatShotBotIds[activeChatShotProvider] = Number(data.bot?.id || 0) || selectedChatShotBotIds[activeChatShotProvider];
          renderChatShotAdminSettings();
          const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
          setChatShotBotStatus(`JSON imported.${warnings}`.trim(), warnings ? 'warning' : 'success');
        } catch (error) {
          setChatShotBotStatus(error.message || 'Could not import JSON', 'error');
        }
      }
    
      async function saveChatShotAdminChatSetting() {
        const chatId = Number($('#chatShotBotChatSelect')?.value || 0);
        const botId = Number($('#chatShotBotChatBotSelect')?.value || 0);
        if (!chatId || !botId) {
          setChatShotAdminChatStatus('Select chat and bot', 'error');
          return;
        }
        const state = currentChatShotAdminState();
        const bot = state.bots.find((item) => Number(item.id) === Number(botId));
        if (bot?.available_in_all_chats) {
          renderChatShotAdminChatSettings();
          setChatShotAdminChatStatus('This bot is already available in all chats', 'success');
          return;
        }
        setChatShotAdminChatStatus('Saving...');
        try {
          const data = await api(`${chatShotRouteBase(activeChatShotProvider)}/chat-settings`, {
            method: 'PUT',
            body: {
              chatId,
              botId,
              enabled: $('#chatShotBotChatEnabled')?.checked,
            },
          });
          mergeChatShotAdminState(activeChatShotProvider, data);
          invalidateChatShotState(chatId);
          renderChatShotAdminChatSettings();
          setChatShotAdminChatStatus('Chat setting saved', 'success');
        } catch (error) {
          setChatShotAdminChatStatus(error.message || 'Could not save chat setting', 'error');
        }
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
    
      async function loadContextConvertAvailability(chatId = currentChatId, { force = false } = {}) {
        const id = Number(chatId || 0);
        if (!id) return { enabled: false, bots: [] };
        if (!force && contextConvertAvailabilityByChat.has(id)) return contextConvertAvailabilityByChat.get(id);
        if (!force && contextConvertAvailabilityRequests.has(id)) return contextConvertAvailabilityRequests.get(id);
        const request = api(`/api/chats/${id}/context-convert-bots`)
          .then((data) => {
            const normalized = normalizeContextConvertAvailability(data);
            contextConvertAvailabilityByChat.set(id, normalized);
            contextConvertAvailabilityRequests.delete(id);
            if (id === Number(currentChatId || 0)) syncCurrentChatContextConvertUi();
            return normalized;
          })
          .catch((error) => {
            contextConvertAvailabilityRequests.delete(id);
            throw error;
          });
        contextConvertAvailabilityRequests.set(id, request);
        return request;
      }
    
      function invalidateContextConvertAvailability(chatId) {
        const id = Number(chatId || 0);
        if (!id) return;
        contextConvertAvailabilityByChat.delete(id);
        contextConvertAvailabilityRequests.delete(id);
        if (id === Number(currentChatId || 0)) {
          syncCurrentChatContextConvertUi();
        }
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
          bots: Array.isArray(data.bots) ? data.bots.map((bot) => ({
            id: Number(bot.id || 0),
            name: bot.name || 'ChatShot',
            provider: bot.provider || 'openai',
            image_model: bot.image_model || '',
          })).filter((bot) => bot.id > 0) : [],
          selectedBot: data.selectedBot || data.selected_bot || null,
        };
      }
    
      function getCurrentChatShotState() {
        return chatShotStateByChat.get(Number(currentChatId || 0)) || null;
      }
    
      function setChatShotChatStatus(message, type = '') {
        const el = $('#chatShotChatStatus');
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('is-error', type === 'error');
        el.classList.toggle('is-success', type === 'success');
      }
    
      async function loadChatShotState(chatId = currentChatId, { force = false } = {}) {
        const id = Number(chatId || 0);
        if (!id) return null;
        if (!force && chatShotStateByChat.has(id)) return chatShotStateByChat.get(id);
        if (!force && chatShotStateRequests.has(id)) return chatShotStateRequests.get(id);
        if (!force && chatShotStateFailuresByChat.has(id)) return null;
        if (force) chatShotStateFailuresByChat.delete(id);
        const request = api(`/api/chats/${id}/chatshot`)
          .then((data) => {
            const normalized = normalizeChatShotState(data);
            chatShotStateByChat.set(id, normalized);
            chatShotStateFailuresByChat.delete(id);
            chatShotStateRequests.delete(id);
            if (id === Number(currentChatId || 0)) {
              renderChatShotForm(normalized);
              syncChatShotButton();
            }
            return normalized;
          })
          .catch((error) => {
            chatShotStateRequests.delete(id);
            chatShotStateFailuresByChat.add(id);
            if (id === Number(currentChatId || 0)) {
              chatShotStateByChat.delete(id);
              syncChatShotButton();
            }
            throw error;
          });
        chatShotStateRequests.set(id, request);
        return request;
      }
    
      function invalidateChatShotState(chatId) {
        const id = Number(chatId || 0);
        if (!id) return;
        chatShotStateByChat.delete(id);
        chatShotStateRequests.delete(id);
        chatShotStateFailuresByChat.delete(id);
        if (id === Number(currentChatId || 0)) {
          syncChatShotButton();
          if (!chatInfoModal?.classList.contains('hidden')) {
            loadChatShotState(id, { force: true }).catch((error) => {
              renderChatShotForm(null);
              setChatShotChatStatus(error.message || 'Could not load ChatShot', 'error');
            });
          }
        }
      }
    
      function renderChatShotForm(state = getCurrentChatShotState()) {
        const section = $('#chatShotSection');
        const toggle = $('#chatShotToggle');
        const botSelect = $('#chatShotBotSelect');
        const styleSelect = $('#chatShotStyleSelect');
        const bananaFilterToggle = $('#chatShotBananaFilterToggle');
        if (!section || !toggle || !botSelect || !styleSelect || !bananaFilterToggle) return;
        const bots = Array.isArray(state?.bots) ? state.bots : [];
        section.classList.toggle('hidden', !bots.length);
        toggle.checked = !!state?.enabled || !!state?.requested_enabled;
        toggle.disabled = !bots.length;
        const selectedBotId = Number(state?.botId || state?.selectedBot?.id || bots[0]?.id || 0);
        botSelect.innerHTML = bots.map((bot) => `<option value="${bot.id}">${esc(bot.name)} (${esc(contextConvertProviderLabel(bot.provider))})</option>`).join('');
        if (bots.some((bot) => Number(bot.id) === selectedBotId)) botSelect.value = String(selectedBotId);
        botSelect.disabled = !bots.length || bots.length === 1;
        styleSelect.value = state?.style || 'comic';
        bananaFilterToggle.checked = state?.banana_filter_enabled !== false;
        bananaFilterToggle.disabled = !bots.length;
        const messageCount = Number(state?.message_count || 0);
        if (!bots.length) setChatShotChatStatus('');
        else if (toggle.checked && messageCount < 2) setChatShotChatStatus('ChatShot \u0432\u043a\u043b\u044e\u0447\u0438\u0442\u0441\u044f \u043f\u043e\u0441\u043b\u0435 \u0434\u0432\u0443\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0432 \u0447\u0430\u0442\u0435.');
        else setChatShotChatStatus('');
      }
    
      async function saveChatShotChatSetting() {
        if (!currentChatId) return;
        const previous = getCurrentChatShotState();
        const payload = {
          enabled: $('#chatShotToggle')?.checked,
          botId: Number($('#chatShotBotSelect')?.value || previous?.botId || 0) || null,
          style: $('#chatShotStyleSelect')?.value || previous?.style || 'comic',
          bananaFilterEnabled: $('#chatShotBananaFilterToggle')?.checked !== false,
        };
        setChatShotChatStatus('Saving...');
        try {
          const data = await api(`/api/chats/${currentChatId}/chatshot`, {
            method: 'PUT',
            body: payload,
          });
          const normalized = normalizeChatShotState(data);
          chatShotStateByChat.set(Number(currentChatId), normalized);
          renderChatShotForm(normalized);
          syncChatShotButton();
          setChatShotChatStatus('Saved', 'success');
        } catch (error) {
          if (previous) {
            chatShotStateByChat.set(Number(currentChatId), previous);
            renderChatShotForm(previous);
          }
          syncChatShotButton();
          setChatShotChatStatus(error.message || 'Could not save ChatShot setting', 'error');
        }
      }
    
      function syncChatShotButton() {
        if (!chatShotBtn) return;
        const chatId = Number(currentChatId || 0);
        const state = getCurrentChatShotState();
        const generating = chatShotGeneratingByChat.has(chatId);
        const shouldShow = Boolean(chatId && (generating || (state?.enabled && state?.ready && state?.botId)));
        chatShotBtn.classList.toggle('hidden', !shouldShow);
        chatShotBtn.classList.toggle('is-pending', generating);
        chatShotBtn.disabled = generating || !shouldShow;
        syncChatHeaderActionsAccessibility();
        if (chatId && !state && !chatShotStateRequests.has(chatId) && !chatShotStateFailuresByChat.has(chatId)) {
          loadChatShotState(chatId).catch(() => {});
        }
      }
    
      async function runChatShotGeneration() {
        const chatId = Number(currentChatId || 0);
        if (!chatId || chatShotGeneratingByChat.has(chatId)) return;
        chatShotGeneratingByChat.add(chatId);
        syncChatShotButton();
        try {
          await api(`/api/chats/${chatId}/chatshot`, { method: 'POST', body: {} });
        } catch (error) {
          showCenterToast(error.message || 'ChatShot generation failed');
        } finally {
          chatShotGeneratingByChat.delete(chatId);
          syncChatShotButton();
        }
      }
    
      function ensureContextConvertPickerBackdrop() {
        let backdrop = $('#contextConvertPickerBackdrop');
        if (backdrop) return backdrop;
        backdrop = document.createElement('div');
        backdrop.id = 'contextConvertPickerBackdrop';
        backdrop.className = 'mention-picker-backdrop hidden';
        document.body.appendChild(backdrop);
        const dismiss = (e) => {
          e.preventDefault();
          e.stopPropagation();
          suppressContextConvertPickerFollowupClick();
          hideContextConvertPicker();
        };
        backdrop.addEventListener('pointerdown', dismiss, { passive: false });
        backdrop.addEventListener('click', dismiss, { passive: false });
        backdrop.addEventListener('contextmenu', dismiss, { passive: false });
        return backdrop;
      }
    
      function ensureContextConvertPicker() {
        let picker = $('#contextConvertPicker');
        ensureContextConvertPickerBackdrop();
        if (picker) return picker;
        picker = document.createElement('div');
        picker.id = 'contextConvertPicker';
        picker.className = 'mention-picker context-convert-picker hidden';
        document.body.appendChild(picker);
        picker.addEventListener('pointerdown', (e) => {
          if (typeof e.button === 'number' && e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          const item = e.target.closest('.mention-picker-item');
          if (!item) return;
          contextConvertPickerPointerState = {
            pointerId: e.pointerId,
            startIndex: Number(item.dataset.index),
            moved: false,
          };
        }, { passive: false });
        picker.addEventListener('scroll', () => {
          if (contextConvertPickerPointerState) contextConvertPickerPointerState.moved = true;
        }, { passive: true, capture: true });
        picker.addEventListener('pointerup', (e) => {
          e.preventDefault();
          e.stopPropagation();
          suppressContextConvertPickerFollowupClick();
          const pointerState = contextConvertPickerPointerState;
          contextConvertPickerPointerState = null;
          if (!pointerState || pointerState.pointerId !== e.pointerId || pointerState.moved) return;
          const item = e.target.closest('.mention-picker-item');
          if (!item) return;
          const index = Number(item.dataset.index);
          if (!Number.isInteger(index) || index !== pointerState.startIndex) return;
          const bot = contextConvertPickerState.bots[index];
          if (!bot) return;
          if (contextConvertPickerState.mode === 'message') transformMessageWithContextConvertBot(contextConvertPickerState.messageId, bot);
          else transformComposerTextWithContextConvertBot(bot);
        }, { passive: false });
        picker.addEventListener('pointercancel', () => {
          contextConvertPickerPointerState = null;
        }, { passive: true });
        picker.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        return picker;
      }
    
      function positionContextConvertPicker() {
        const picker = $('#contextConvertPicker');
        if (!picker || picker.classList.contains('hidden')) return;
        const anchor = contextConvertPickerState.anchorEl || composerContextConvertBtn || msgInput;
        const rect = anchor?.getBoundingClientRect?.();
        if (!rect) return;
        const vv = window.visualViewport;
        const viewportLeft = vv ? vv.offsetLeft : 0;
        const viewportTop = vv ? vv.offsetTop : 0;
        const viewportWidth = vv ? vv.width : window.innerWidth;
        const viewportHeight = vv ? vv.height : window.innerHeight;
        const isContextConvertPicker = picker.classList.contains('context-convert-picker');
        const maxContextConvertWidth = Math.max(96, Math.min(viewportWidth - 16, Math.floor(viewportWidth * (2 / 3))));
        const widestContextConvertLabel = isContextConvertPicker
          ? Array.from(picker.querySelectorAll('.context-convert-picker-label'))
              .reduce((maxWidth, label) => Math.max(maxWidth, Math.ceil(label.scrollWidth || label.getBoundingClientRect().width || 0)), 0)
          : 0;
        const width = isContextConvertPicker
          ? clamp(widestContextConvertLabel + 40, 96, maxContextConvertWidth)
          : Math.min(Math.max(Math.max(rect.width, 260), 260), viewportWidth - 16);
        picker.style.width = `${width}px`;
        const height = picker.offsetHeight || 220;
        const left = Math.max(viewportLeft + 8, Math.min(rect.left + viewportLeft, viewportLeft + viewportWidth - width - 8));
        let top = rect.top + viewportTop - height - 8;
        if (top < viewportTop + 8) top = rect.bottom + viewportTop + 8;
        top = Math.max(viewportTop + 8, Math.min(top, viewportTop + viewportHeight - height - 8));
        picker.style.left = `${left}px`;
        picker.style.top = `${top}px`;
      }
    
      function renderContextConvertPicker(bots, options = {}) {
        const picker = ensureContextConvertPicker();
        if (!bots.length) {
          hideContextConvertPicker();
          return;
        }
        contextConvertPickerState = {
          ...contextConvertPickerState,
          active: true,
          selected: Math.min(contextConvertPickerState.selected || 0, bots.length - 1),
          bots,
          mode: options.mode || contextConvertPickerState.mode || 'composer',
          chatId: Number(options.chatId || contextConvertPickerState.chatId || currentChatId || 0),
          messageId: Number(options.messageId || 0),
          anchorEl: options.anchorEl || contextConvertPickerState.anchorEl || composerContextConvertBtn,
          keyboardAttached: Boolean(options.keyboardAttached),
        };
        picker.innerHTML = `
          <div class="mention-picker-list">
            ${bots.map((bot, index) => `
              <button type="button" class="mention-picker-item${index === contextConvertPickerState.selected ? ' active' : ''}" data-index="${index}">
                <span class="mention-picker-avatar" style="background:${esc(providerAccent(bot.provider))}">\ud83c\udf4c</span>
                <span class="mention-picker-copy">
                  <strong>${esc(bot.name)}</strong>
                  <small>${esc(contextConvertProviderLabel(bot.provider))}${bot.transform_prompt_preview ? ` \u00b7 ${esc(bot.transform_prompt_preview)}` : ''}</small>
                </span>
              </button>
            `).join('')}
          </div>
        `;
        picker.querySelectorAll('.mention-picker-item').forEach((item, index) => {
          const bot = bots[index];
          item.classList.add('context-convert-picker-item');
          item.innerHTML = `<span class="context-convert-picker-label">${esc(bot?.name || 'Convert bot')}</span>`;
        });
        openFloatingSurface(picker);
        positionContextConvertPicker();
        requestAnimationFrame(() => positionContextConvertPicker());
      }
    
      function hideContextConvertPicker(options = {}) {
        const immediate = Boolean(options.immediate);
        contextConvertPickerState = {
          active: false,
          selected: 0,
          bots: [],
          mode: 'composer',
          chatId: 0,
          messageId: 0,
          anchorEl: null,
          keyboardAttached: false,
        };
        contextConvertPickerPointerState = null;
        closeFloatingSurface($('#contextConvertPickerBackdrop'), { immediate });
        closeFloatingSurface($('#contextConvertPicker'), { immediate });
      }
    
      function getCurrentChatContextConvertState() {
        return contextConvertAvailabilityByChat.get(Number(currentChatId || 0)) || { enabled: false, bots: [] };
      }
    
      function isContextTransformAvailableForChat(chatId = currentChatId) {
        const id = Number(chatId || 0);
        if (!id) return false;
        const chat = getChatById(id);
        const availability = contextConvertAvailabilityByChat.get(id) || { enabled: false, bots: [] };
        return Boolean(chat?.context_transform_enabled && availability.enabled && availability.bots.length);
      }
    
      function setComposerContextConvertButtonVisible(visible) {
        if (!composerContextConvertBtn) return;
        if (visible) {
          if (composerContextConvertBtn.classList.contains('hidden') || composerContextConvertBtn.classList.contains('is-closing')) {
            openFloatingSurface(composerContextConvertBtn);
          }
          return;
        }
        if (!composerContextConvertBtn.classList.contains('hidden')) {
          closeFloatingSurface(composerContextConvertBtn);
        }
      }
    
      function canContextConvertMessage(msg, row = null, options = {}) {
        if (!options.ignoreChatAvailability && !isContextTransformAvailableForChat()) return false;
        if (!canEditMessage(msg)) return false;
        if (msg?.ai_generated || msg?.ai_bot_id || msg?.is_ai_bot) return false;
        const text = row ? getEditableText(row) : ((msg?.is_voice_note ? msg?.transcription_text : msg?.text) || '');
        return Boolean(String(text || '').trim());
      }
    
      function canRestoreContextOriginalMessage(msg) {
        if (!currentUser || !msg || msg.is_deleted) return false;
        if (!msg.context_transform_original_available) return false;
        if (isClientSideMessage(msg)) return false;
        if (isPollMessage(msg)) return false;
        if (msg.call || msg.call_message || msg.is_call_message) return false;
        if (msg.call_transcript_run || msg.is_call_transcript_message) return false;
        if (msg.call_artifact_batch || msg.is_call_artifact_message) return false;
        if (msg.ai_generated || msg.ai_bot_id || msg.is_ai_bot) return false;
        if (!currentUser.is_admin && msg.user_id !== currentUser.id) return false;
        return Boolean(msg.is_voice_note || msg.file_id || msg.text || msg.transcription_text);
      }
    
      function bindContextConvertMessageButton(button, row) {
        if (!button || !row || button.dataset.contextConvertBound === '1') return button;
        button.dataset.contextConvertBound = '1';
        bindTouchSafeButtonActivation(button, ({ event, startKeyboardOpen }) => {
          event?.stopPropagation?.();
          const keepComposerFocus = Boolean(getReactionPickerKeepKeyboard() || startKeyboardOpen || isMobileComposerKeyboardOpen());
          openMessageContextConvertPicker(row, button, {
            keepComposerFocus,
          }).catch((error) => {
            console.warn('[context-convert] picker open failed:', error.message);
          });
        });
        return button;
      }
    
      function createContextConvertMessageButton(row) {
        const msg = row?.__messageData || {};
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `msg-context-convert-btn${contextConvertPendingMessageIds.has(Number(msg.id || 0)) ? ' is-pending' : ''}`;
        button.title = 'Transform with AI';
        button.textContent = '\ud83c\udf4c';
        return bindContextConvertMessageButton(button, row);
      }
    
      function bindContextOriginalRestoreButton(button, row) {
        if (!button || !row || button.dataset.contextOriginalRestoreBound === '1') return button;
        button.dataset.contextOriginalRestoreBound = '1';
        bindTouchSafeButtonActivation(button, ({ event, startKeyboardOpen }) => {
          event?.stopPropagation?.();
          const keepComposerFocus = Boolean(getReactionPickerKeepKeyboard() || startKeyboardOpen || isMobileComposerKeyboardOpen());
          restoreContextOriginalMessage(Number(row?.__messageData?.id || row?.dataset?.msgId || 0), { keepComposerFocus }).catch((error) => {
            console.warn('[context-convert] restore failed:', error.message);
          });
        });
        return button;
      }
    
      function syncVisibleContextConvertMessageButtons() {
        if (!messagesEl || !Number(currentChatId || 0)) return;
        const transformAvailable = isContextTransformAvailableForChat(currentChatId);
        messagesEl.querySelectorAll('.msg-row[data-msg-id]').forEach((row) => {
          const msg = row.__messageData || null;
          const actionsEl = row.querySelector('.msg-actions');
          if (!msg || !actionsEl) return;
          const existingButton = actionsEl.querySelector('.msg-context-convert-btn');
          const shouldShow = transformAvailable && canContextConvertMessage(msg, row, { ignoreChatAvailability: true });
          if (!shouldShow) {
            existingButton?.remove();
            return;
          }
          if (existingButton) {
            existingButton.classList.toggle('is-pending', contextConvertPendingMessageIds.has(Number(msg.id || 0)));
            bindContextConvertMessageButton(existingButton, row);
            return;
          }
          const button = createContextConvertMessageButton(row);
          const insertBefore = actionsEl.querySelector('.msg-save-note-btn, .msg-forward-btn, .msg-react-btn');
          if (insertBefore) actionsEl.insertBefore(button, insertBefore);
          else actionsEl.appendChild(button);
        });
      }
    
      function syncCurrentChatContextConvertUi() {
        syncContextConvertComposerButton();
        const chatId = Number(currentChatId || 0);
        if (!chatId) return;
        if (contextConvertPickerState.active && contextConvertPickerState.chatId === chatId && !isContextTransformAvailableForChat(chatId)) {
          hideContextConvertPicker();
        }
        syncVisibleContextConvertMessageButtons();
        if (getActiveMessageActionsRow() || isFloatingSurfaceVisible(reactionPicker)) {
          positionMessageActionSurfaces({
            includeActions: Boolean(getActiveMessageActionsRow()),
            includePicker: isFloatingSurfaceVisible(reactionPicker),
          });
        }
      }
    
      function syncContextConvertComposerButton() {
        if (!composerContextConvertBtn) return;
        const hasText = Boolean(currentChatId && !composerStateController.editTo && getComposerTextValue({ trim: true }));
        const currentChat = getChatById(currentChatId);
        const availability = getCurrentChatContextConvertState();
        const shouldShow = Boolean((hasText || contextConvertComposerPending) && isContextTransformAvailableForChat(currentChatId));
        if (!shouldShow && contextConvertPickerState.active && contextConvertPickerState.mode === 'composer') {
          hideContextConvertPicker();
        }
        setComposerContextConvertButtonVisible(shouldShow);
        const shouldOffsetForScrollFab = Boolean(
          scrollBottomBtn?.classList.contains('visible')
          && (shouldShow || !composerContextConvertBtn.classList.contains('hidden'))
        );
        composerContextConvertBtn.classList.toggle('with-scroll-bottom', shouldOffsetForScrollFab);
        composerContextConvertBtn.classList.toggle('is-pending', contextConvertComposerPending);
        composerContextConvertBtn.disabled = contextConvertComposerPending;
        if (currentChat?.context_transform_enabled && !availability.bots.length && currentChatId) {
          loadContextConvertAvailability(currentChatId).catch(() => {});
        }
      }
    
      async function openComposerContextConvertPicker(options = {}) {
        if (contextConvertComposerPending || !currentChatId || composerStateController.editTo) return;
        const text = getComposerTextValue({ trim: true });
        if (!text) return;
        const keyboardAttached = Boolean(
          Object.prototype.hasOwnProperty.call(options, 'keyboardAttached')
            ? options.keyboardAttached
            : (!isMobileLayoutViewport() || isMobileComposerKeyboardOpen())
        );
        hideMentionPicker();
        const availability = await loadContextConvertAvailability(currentChatId).catch(() => ({ enabled: false, bots: [] }));
        if (!availability.enabled || !availability.bots.length) {
          syncContextConvertComposerButton();
          return;
        }
        if (contextConvertPickerState.active && contextConvertPickerState.mode === 'composer') {
          hideContextConvertPicker();
          if (keyboardAttached) focusComposerKeepKeyboard(true);
          return;
        }
        renderContextConvertPicker(availability.bots, {
          mode: 'composer',
          chatId: currentChatId,
          anchorEl: composerContextConvertBtn,
          keyboardAttached,
        });
        if (keyboardAttached) focusComposerKeepKeyboard(true);
      }
    
      async function transformComposerTextWithContextConvertBot(bot) {
        const text = getComposerTextValue({ trim: true });
        if (!bot?.id || !text || !currentChatId) return;
        const keepKeyboardOpen = Boolean(contextConvertPickerState.keyboardAttached);
        hideContextConvertPicker();
        contextConvertComposerPending = true;
        syncContextConvertComposerButton();
        try {
          const data = await api(`/api/chats/${currentChatId}/context-convert`, {
            method: 'POST',
            body: {
              botId: bot.id,
              text,
            },
          });
          setComposerTextValue(data.text || '');
          autoResize();
          if (keepKeyboardOpen) focusComposerKeepKeyboard(true);
          msgInput.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (error) {
          alert(error.message || 'Could not transform text');
        } finally {
          clearContextConvertPickerFollowupClickSuppress();
          contextConvertComposerPending = false;
          syncContextConvertComposerButton();
        }
      }
    
      function syncContextConvertPendingMessageState(messageId) {
        const id = Number(messageId || 0);
        if (!id) return;
        const pending = contextConvertPendingMessageIds.has(id);
        const row = messagesEl.querySelector(`[data-msg-id="${id}"]`);
        row?.classList.toggle('context-convert-pending', pending);
        row?.querySelectorAll('.msg-context-convert-btn').forEach((btn) => btn.classList.toggle('is-pending', pending));
        if (Number(getReactionPickerMsgId() || 0) === id && isFloatingSurfaceVisible(reactionPicker)) {
          renderReactionPickerContent();
        }
      }
    
      function syncContextOriginalRestorePendingMessageState(messageId) {
        const id = Number(messageId || 0);
        if (!id) return;
        const pending = contextOriginalRestorePendingMessageIds.has(id);
        const row = messagesEl.querySelector(`[data-msg-id="${id}"]`);
        row?.querySelectorAll('.msg-restore-original-btn').forEach((btn) => {
          btn.classList.toggle('is-pending', pending);
          btn.disabled = pending;
        });
        if (Number(getReactionPickerMsgId() || 0) === id && isFloatingSurfaceVisible(reactionPicker)) {
          renderReactionPickerContent();
        }
      }
    
      async function transformMessageWithContextConvertBot(messageId, bot) {
        const id = Number(messageId || 0);
        if (!id || !bot?.id || contextConvertPendingMessageIds.has(id)) return;
        hideContextConvertPicker();
        contextConvertPendingMessageIds.add(id);
        syncContextConvertPendingMessageState(id);
        try {
          const preserveAnchor = captureScrollAnchor();
          const data = await api(`/api/messages/${id}/context-convert`, {
            method: 'POST',
            body: { botId: bot.id },
          });
          applyMessageUpdate(data.message, { preserveAnchor });
          if (preserveAnchor?.messageId) {
            requestAnimationFrame(() => restoreScrollAnchor(preserveAnchor, 2));
          }
          loadChats().catch(() => {});
        } catch (error) {
          showCenterToast(error.message || 'Could not transform message');
        } finally {
          clearContextConvertPickerFollowupClickSuppress();
          contextConvertPendingMessageIds.delete(id);
          syncContextConvertPendingMessageState(id);
        }
      }
    
      async function restoreContextOriginalMessage(messageId, options = {}) {
        const id = Number(messageId || 0);
        if (!id || contextOriginalRestorePendingMessageIds.has(id)) return;
        const keepComposerFocus = Boolean(options.keepComposerFocus);
        hideFloatingMessageActions({ keepComposerState: keepComposerFocus, immediate: true });
        if (keepComposerFocus) focusComposerKeepKeyboard(true);
        contextOriginalRestorePendingMessageIds.add(id);
        syncContextOriginalRestorePendingMessageState(id);
        try {
          const preserveAnchor = captureScrollAnchor();
          const data = await api(`/api/messages/${id}/context-convert/restore-original`, {
            method: 'POST',
          });
          applyMessageUpdate(data.message, { preserveAnchor });
          if (preserveAnchor?.messageId) {
            requestAnimationFrame(() => restoreScrollAnchor(preserveAnchor, 2));
          }
          loadChats().catch(() => {});
        } catch (error) {
          showCenterToast(error.message || t('Could not restore original message'));
        } finally {
          contextOriginalRestorePendingMessageIds.delete(id);
          syncContextOriginalRestorePendingMessageState(id);
          if (keepComposerFocus) focusComposerKeepKeyboard(true);
        }
      }
    
      async function openMessageContextConvertPicker(row, anchorEl = null, { keepComposerFocus = false } = {}) {
        const msg = row?.__messageData || null;
        if (!canContextConvertMessage(msg, row) || !currentChatId) return;
        const stableAnchor = anchorEl && row?.contains?.(anchorEl) ? anchorEl : row;
        hideMentionPicker();
        hideFloatingMessageActions({ keepComposerState: keepComposerFocus, immediate: true });
        const availability = await loadContextConvertAvailability(currentChatId).catch(() => ({ enabled: false, bots: [] }));
        if (!availability.enabled || !availability.bots.length) return;
        renderContextConvertPicker(availability.bots, {
          mode: 'message',
          chatId: currentChatId,
          messageId: Number(msg.id || 0),
          anchorEl: stableAnchor,
          keyboardAttached: keepComposerFocus,
        });
        if (keepComposerFocus) focusComposerKeepKeyboard(true);
      }
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // AUTH
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

      return {
        contextConvertProviderLabel, providerAccent, contextConvertRouteBase, currentContextConvertAdminState, currentContextConvertAdminBot, getContextConvertChatSetting, setContextConvertInlineStatus, setContextConvertModalStatus,
        setContextConvertBotStatus, setContextConvertChatStatus, mergeContextConvertAdminState, renderContextConvertBotList, renderContextConvertForm, renderContextConvertChatSettings, renderContextConvertAdminSettings, contextConvertAdminFormPayload,
        loadContextConvertAdminState, openContextConvertBotsModal, saveContextConvertAdminBot, disableContextConvertAdminBot, testContextConvertAdminBot, exportContextConvertAdminBot, importContextConvertAdminBot, saveContextConvertAdminChatSetting,
        chatShotRouteBase, currentChatShotAdminState, currentChatShotAdminBot, getChatShotAdminChatSetting, setChatShotModalStatus, setChatShotBotStatus, setChatShotAdminChatStatus, mergeChatShotAdminState,
        renderChatShotBotList, renderChatShotAdminForm, renderChatShotAdminChatSettings, renderChatShotAdminSettings, chatShotAdminFormPayload, loadChatShotAdminState, openChatShotBotsModal, saveChatShotAdminBot,
        disableChatShotAdminBot, testChatShotAdminBot, exportChatShotAdminBot, importChatShotAdminBot, saveChatShotAdminChatSetting, normalizeContextConvertAvailability, loadContextConvertAvailability, invalidateContextConvertAvailability,
        normalizeChatShotState, getCurrentChatShotState, setChatShotChatStatus, loadChatShotState, invalidateChatShotState, renderChatShotForm, saveChatShotChatSetting, syncChatShotButton,
        runChatShotGeneration, ensureContextConvertPickerBackdrop, ensureContextConvertPicker, positionContextConvertPicker, renderContextConvertPicker, hideContextConvertPicker, getCurrentChatContextConvertState, isContextTransformAvailableForChat,
        setComposerContextConvertButtonVisible, canContextConvertMessage, canRestoreContextOriginalMessage, bindContextConvertMessageButton, createContextConvertMessageButton, bindContextOriginalRestoreButton, syncVisibleContextConvertMessageButtons, syncCurrentChatContextConvertUi,
        syncContextConvertComposerButton, openComposerContextConvertPicker, transformComposerTextWithContextConvertBot, syncContextConvertPendingMessageState, syncContextOriginalRestorePendingMessageState, transformMessageWithContextConvertBot, restoreContextOriginalMessage, openMessageContextConvertPicker,
      };
    }
  }

  aiAdmin.contextChatShotRuntime = { createLegacyContextChatShotRuntime };
})();
