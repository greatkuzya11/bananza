(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};

  function createOpenAiRuntime(scope = {}) {
    with (scope) {
      function setInlineStatus(targetIds, message, type = '') {
        const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
        ids.forEach((targetId) => {
          const el = resolveUiTarget(targetId);
          if (!el) return;
          el.textContent = tx(message || '');
          el.classList.toggle('is-error', type === 'error');
          el.classList.toggle('is-success', type === 'success');
          el.classList.toggle('is-pending', type === 'pending');
        });
      }
    
      function resolveActionButtons(targetIds) {
        const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
        return ids.map((targetId) => resolveUiTarget(targetId)).filter(Boolean);
      }
    
      function setActionButtonsPending(targetIds, pending = false, pendingLabel = '') {
        const buttons = resolveActionButtons(targetIds);
        buttons.forEach((btn) => {
          if (pending) {
            btn.dataset.pendingRestoreLabel = btn.textContent || '';
            btn.dataset.pendingRestoreDisabled = btn.disabled ? '1' : '0';
            btn.dataset.adminBusy = '1';
            btn.disabled = true;
            btn.classList.add('is-pending');
            btn.setAttribute('aria-busy', 'true');
            if (pendingLabel) btn.textContent = tx(pendingLabel);
            return;
          }
          const restoreDisabled = btn.dataset.pendingRestoreDisabled === '1';
          if (Object.prototype.hasOwnProperty.call(btn.dataset, 'pendingRestoreLabel')) {
            btn.textContent = btn.dataset.pendingRestoreLabel;
          }
          btn.disabled = restoreDisabled;
          btn.classList.remove('is-pending');
          btn.removeAttribute('aria-busy');
          delete btn.dataset.adminBusy;
          delete btn.dataset.pendingRestoreLabel;
          delete btn.dataset.pendingRestoreDisabled;
        });
        return buttons;
      }
    
      async function withActionButtons(targetIds, pendingLabel, task) {
        const buttons = resolveActionButtons(targetIds);
        if (buttons.some((btn) => btn.dataset.adminBusy === '1')) return;
        setActionButtonsPending(buttons, true, pendingLabel);
        try {
          return await task();
        } finally {
          setActionButtonsPending(buttons, false);
        }
      }
    
      function bindAsyncActionButtons(triggerIds, targetIds, pendingLabel, task) {
        const triggers = resolveActionButtons(triggerIds);
        const busyTargets = targetIds == null ? triggerIds : targetIds;
        triggers.forEach((btn) => {
          btn.addEventListener('click', () => {
            withActionButtons(busyTargets, pendingLabel, async () => {
              await task();
            }).catch((error) => {
              console.error('Admin action failed', error);
            });
          });
        });
      }
    
      function setOpenAiStatus(statusId, message, type = '') {
        setInlineStatus(statusId, message, type);
      }
    
      function setAiBotModalStatus(message, type = '') {
        setOpenAiStatus('aiBotsStatus', message, type);
      }
    
      function setAiBotSettingsStatus(message, type = '') {
        setOpenAiStatus('aiBotsProviderStatus', message, type);
      }
    
      function setAiBotStatus(message, type = '') {
        setOpenAiStatus(['aiBotEditorStatus', 'aiBotEditorStatusBottom'], message, type);
      }
    
      function setAiBotTextModalStatus(message, type = '') {
        setOpenAiStatus('openAiTextStatus', message, type);
      }
    
      function setAiBotChatStatus(message, type = '') {
        setOpenAiStatus('aiBotChatStatus', message, type);
      }
    
      function setAiModelStatus(message, type = '') {
        setOpenAiStatus('aiBotsModelStatus', message, type);
      }
    
      function uniqueAiModelValues(values = []) {
        const seen = new Set();
        const result = [];
        values.forEach((value) => {
          const text = String(value || '').trim();
          if (!text) return;
          const key = text.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          result.push(text);
        });
        return result;
      }
    
      function setAiModelSelectOptions(id, values, currentValue) {
        const select = document.getElementById(id);
        if (!select) return;
        const current = String(currentValue || '').trim();
        const options = uniqueAiModelValues([current, ...values]);
        select.innerHTML = options.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
        if (current) select.value = current;
      }
    
      function setStaticSelectOptions(id, values, currentValue) {
        const select = document.getElementById(id);
        if (!select) return;
        const current = String(currentValue || '').trim();
        const options = [...new Set([current, ...values].filter(Boolean))];
        select.innerHTML = options.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
        if (current) select.value = current;
      }
    
      function syncSharedOpenAiSettings(settings = {}) {
        aiBotState.settings = { ...aiBotState.settings, ...settings };
        openAiUniversalState.settings = { ...openAiUniversalState.settings, ...settings };
        openAiImageState.settings = { ...openAiImageState.settings, ...settings };
      }
    
      function syncSharedGrokSettings(settings = {}) {
        grokBotState.settings = { ...grokBotState.settings, ...settings };
        grokUniversalState.settings = { ...grokUniversalState.settings, ...settings };
      }
    
      function renderAiModelOptions(bot = currentAiBot()) {
        const settings = aiBotState.settings || {};
        const responseModels = aiModelCatalog.response || [];
        const summaryModels = aiModelCatalog.summary || responseModels;
        const embeddingModels = aiModelCatalog.embedding || ['text-embedding-3-small'];
        const imageModels = aiModelCatalog.image || ['gpt-image-2'];
        setAiModelSelectOptions('aiBotsDefaultResponseModel', responseModels, settings.default_response_model || 'gpt-5.4');
        setAiModelSelectOptions('aiBotsDefaultSummaryModel', summaryModels, settings.default_summary_model || 'gpt-5.4');
        setAiModelSelectOptions('aiBotsDefaultEmbeddingModel', embeddingModels, settings.default_embedding_model || 'text-embedding-3-small');
        setAiModelSelectOptions('aiBotsDefaultImageModel', imageModels, settings.openai_default_image_model || 'gpt-image-2');
        setStaticSelectOptions('aiBotsDefaultImageSize', OPENAI_IMAGE_SIZE_OPTIONS, settings.openai_default_image_size || '1024x1024');
        setStaticSelectOptions('aiBotsDefaultImageQuality', OPENAI_IMAGE_QUALITY_OPTIONS, settings.openai_default_image_quality || 'auto');
        setStaticSelectOptions('aiBotsDefaultImageBackground', OPENAI_IMAGE_BACKGROUND_OPTIONS, settings.openai_default_image_background || 'auto');
        setStaticSelectOptions('aiBotsDefaultImageOutputFormat', OPENAI_IMAGE_OUTPUT_OPTIONS, settings.openai_default_image_output_format || 'png');
        setStaticSelectOptions('aiBotsDefaultDocumentFormat', DOCUMENT_FORMAT_OPTIONS, settings.openai_default_document_format || 'md');
        setAiModelSelectOptions('aiBotResponseModel', responseModels, bot?.response_model || settings.default_response_model || 'gpt-5.4');
        setAiModelSelectOptions('aiBotSummaryModel', summaryModels, bot?.summary_model || settings.default_summary_model || 'gpt-5.4');
        const botEmbedding = $('#aiBotEmbeddingModel');
        if (botEmbedding) botEmbedding.value = settings.default_embedding_model || 'text-embedding-3-small';
        renderOpenAiUniversalModelOptions(currentOpenAiUniversalBot());
        renderOpenAiImageModelOptions(currentOpenAiImageBot());
      }
    
      async function loadAiModelOptions(refresh = false) {
        const showActionStatus = refresh && aiModelRefreshTriggeredByButton;
        if (showActionStatus) {
          setActionButtonsPending('aiBotsRefreshModels', true, 'Refreshing...');
          setAiBotSettingsStatus('Refreshing models...', 'pending');
        }
        try {
          const data = await api(`/api/admin/ai-bots/models${refresh ? '?refresh=1' : ''}`);
          aiModelCatalog = {
            source: data.source || 'fallback',
            response: data.response || aiModelCatalog.response,
            summary: data.summary || data.response || aiModelCatalog.summary,
            embedding: data.embedding || aiModelCatalog.embedding,
            image: data.image || aiModelCatalog.image,
            error: data.error || '',
            fetched_at: data.fetched_at || '',
          };
          renderAiModelOptions(currentAiBot());
          if (aiModelCatalog.source === 'openai') {
            setAiModelStatus(aiModelCatalog.fetched_at ? `\u041c\u043e\u0434\u0435\u043b\u0438 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b: ${aiModelCatalog.fetched_at}` : '\u041c\u043e\u0434\u0435\u043b\u0438 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b', 'success');
          } else if (aiModelCatalog.error) {
            setAiModelStatus(`Fallback models: ${aiModelCatalog.error}`, 'error');
          } else {
            setAiModelStatus('Fallback models');
          }
          if (showActionStatus) {
            if (aiModelCatalog.source === 'openai') {
              setAiBotSettingsStatus(
                aiModelCatalog.fetched_at ? `Models refreshed: ${aiModelCatalog.fetched_at}` : 'Models refreshed',
                'success'
              );
            } else if (aiModelCatalog.error) {
              setAiBotSettingsStatus(`Fallback models: ${aiModelCatalog.error}`, 'error');
            } else {
              setAiBotSettingsStatus('Fallback model list is shown');
            }
          }
          return aiModelCatalog;
        } catch (error) {
          if (showActionStatus) {
            setAiBotSettingsStatus(error.message || 'Could not refresh models', 'error');
          }
          throw error;
        } finally {
          if (showActionStatus) {
            aiModelRefreshTriggeredByButton = false;
            setActionButtonsPending('aiBotsRefreshModels', false);
          }
        }
      }
    
      function mergeAiBotState(data = {}) {
        if (data.state) {
          syncSharedOpenAiSettings(data.state.settings || {});
          aiBotState = {
            settings: aiBotState.settings,
            bots: data.state.bots || aiBotState.bots,
            chats: data.state.chats || aiBotState.chats,
            chatSettings: data.state.chatSettings || aiBotState.chatSettings,
          };
          if (data.state.chats) openAiUniversalState.chats = data.state.chats;
          if (data.state.chats) openAiImageState.chats = data.state.chats;
        } else if (data.settings) {
          syncSharedOpenAiSettings(data.settings);
          aiBotState = { ...aiBotState, settings: aiBotState.settings };
        }
        if (selectedAiBotId && !aiBotState.bots.some(bot => Number(bot.id) === Number(selectedAiBotId))) {
          selectedAiBotId = null;
        }
        composerStateController.mentionTargetsByChat.clear();
        updateComposerAiOverrideState().catch(() => {});
      }
    
      function currentAiBot() {
        return aiBotState.bots.find(bot => bot.id === selectedAiBotId) || null;
      }
    
      function setOpenAiUniversalModalStatus(message, type = '') {
        setOpenAiStatus('openAiUniversalStatus', message, type);
      }
    
      function setOpenAiUniversalStatus(message, type = '') {
        setOpenAiStatus(['openAiUniversalBotEditorStatus', 'openAiUniversalBotEditorStatusBottom'], message, type);
      }
    
      function setOpenAiUniversalChatStatus(message, type = '') {
        setOpenAiStatus('openAiUniversalBotChatStatus', message, type);
      }
    
      function mergeOpenAiUniversalState(data = {}) {
        const state = data.state || data;
        if (state.settings) syncSharedOpenAiSettings(state.settings);
        if (state.bots) openAiUniversalState.bots = state.bots;
        if (state.chats) openAiUniversalState.chats = state.chats;
        if (state.chatSettings) openAiUniversalState.chatSettings = state.chatSettings;
        openAiUniversalState.settings = aiBotState.settings;
        if (selectedOpenAiUniversalBotId && !openAiUniversalState.bots.some(bot => Number(bot.id) === Number(selectedOpenAiUniversalBotId))) {
          selectedOpenAiUniversalBotId = null;
        }
        composerStateController.mentionTargetsByChat.clear();
        updateComposerAiOverrideState().catch(() => {});
      }
    
      function currentOpenAiUniversalBot() {
        return openAiUniversalState.bots.find(bot => Number(bot.id) === Number(selectedOpenAiUniversalBotId)) || null;
      }
    
      function getOpenAiUniversalChatSetting(chatId, botId) {
        return openAiUniversalState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
      }
    
      function renderOpenAiUniversalModelOptions(bot = currentOpenAiUniversalBot()) {
        const settings = openAiUniversalState.settings || aiBotState.settings || {};
        const responseModels = aiModelCatalog.response || ['gpt-5.4'];
        const summaryModels = aiModelCatalog.summary || responseModels;
        const imageModels = aiModelCatalog.image || ['gpt-image-2'];
        setAiModelSelectOptions('openAiUniversalBotResponseModel', responseModels, bot?.response_model || settings.default_response_model || 'gpt-5.4');
        setAiModelSelectOptions('openAiUniversalBotSummaryModel', summaryModels, bot?.summary_model || settings.default_summary_model || 'gpt-5.4');
        setAiModelSelectOptions('openAiUniversalBotImageModel', imageModels, bot?.image_model || settings.openai_default_image_model || 'gpt-image-2');
        setStaticSelectOptions('openAiUniversalBotImageSize', OPENAI_IMAGE_SIZE_OPTIONS, bot?.image_resolution || settings.openai_default_image_size || '1024x1024');
        setStaticSelectOptions('openAiUniversalBotImageQuality', OPENAI_IMAGE_QUALITY_OPTIONS, bot?.image_quality || settings.openai_default_image_quality || 'auto');
        setStaticSelectOptions('openAiUniversalBotImageBackground', OPENAI_IMAGE_BACKGROUND_OPTIONS, bot?.image_background || settings.openai_default_image_background || 'auto');
        setStaticSelectOptions('openAiUniversalBotImageOutputFormat', OPENAI_IMAGE_OUTPUT_OPTIONS, bot?.image_output_format || settings.openai_default_image_output_format || 'png');
        setStaticSelectOptions('openAiUniversalBotDocumentFormat', DOCUMENT_FORMAT_OPTIONS, bot?.document_default_format || settings.openai_default_document_format || 'md');
        setStaticSelectOptions('openAiUniversalBotTestDocumentFormat', DOCUMENT_FORMAT_OPTIONS, bot?.document_default_format || settings.openai_default_document_format || 'md');
      }
    
      function renderOpenAiUniversalBotAvatar(bot = currentOpenAiUniversalBot()) {
        const avatarEl = $('#openAiUniversalBotAvatar');
        if (!avatarEl) return;
        const name = bot?.name || $('#openAiUniversalBotName')?.value.trim() || 'OpenAI Universal';
        const color = bot?.avatar_color || '#65aadd';
        avatarEl.style.background = color;
        if (bot?.avatar_url) {
          avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
        } else {
          avatarEl.textContent = initials(name);
        }
    
        const hasSavedBot = Boolean(bot?.id);
        const input = $('#openAiUniversalBotAvatarInput');
        const label = $('#openAiUniversalBotAvatarLabel');
        if (input) {
          input.disabled = !hasSavedBot;
          input.value = '';
        }
        if (label) {
          label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
          label.title = hasSavedBot ? 'Change avatar' : 'Save the bot first';
        }
        $('#removeOpenAiUniversalBotAvatar')?.classList.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
      }
    
      function renderOpenAiUniversalBotList() {
        const list = $('#openAiUniversalBotList');
        if (!list) return;
        if (!openAiUniversalState.bots.length) {
          list.innerHTML = '<div class="ai-bot-empty">No OpenAI universal bots yet. Create the first one.</div>';
          return;
        }
        list.innerHTML = openAiUniversalState.bots.map(bot => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedOpenAiUniversalBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
            <span class="ai-bot-list-main">
              <span class="ai-bot-list-avatar" style="background:${esc(bot.avatar_color || '#65aadd')}">
                ${bot.avatar_url ? `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">` : esc(initials(bot.name || '?'))}
              </span>
              <span class="ai-bot-list-copy">
                <strong>${esc(bot.name)}</strong>
                <small>@${esc(bot.mention)} \u00b7 ${bot.enabled ? 'enabled' : 'disabled'}</small>
              </span>
            </span>
            <span class="ai-bot-list-model">${bot.response_model ? esc(bot.response_model) : ''}</span>
          </button>
        `).join('');
      }
    
      function fillOpenAiUniversalBotForm(bot = null) {
        const settings = openAiUniversalState.settings || aiBotState.settings || {};
        selectedOpenAiUniversalBotId = bot ? bot.id : null;
        $('#openAiUniversalBotName').value = bot?.name || 'OpenAI Universal';
        $('#openAiUniversalBotMention').value = bot?.mention || 'openai_universal';
        $('#openAiUniversalBotEnabled').checked = bot ? !!bot.enabled : true;
        setBotVisibilityToggle('openAiUniversalBotVisibleToUsers', !!bot?.visible_to_users);
        $('#openAiUniversalBotAllowText').checked = bot?.allow_text ?? true;
        $('#openAiUniversalBotAllowImageGenerate').checked = bot?.allow_image_generate ?? true;
        $('#openAiUniversalBotAllowImageEdit').checked = bot?.allow_image_edit ?? true;
        $('#openAiUniversalBotAllowDocument').checked = bot?.allow_document ?? true;
        $('#openAiUniversalBotTemperature').value = bot?.temperature ?? 0.55;
        $('#openAiUniversalBotMaxTokens').value = bot?.max_tokens ?? 1000;
        $('#openAiUniversalBotStyle').value = bot?.style || 'Helpful OpenAI universal assistant for chat';
        $('#openAiUniversalBotTone').value = bot?.tone || 'warm, concise, attentive';
        $('#openAiUniversalBotRules').value = bot?.behavior_rules || '';
        $('#openAiUniversalBotSpeech').value = bot?.speech_patterns || '';
        $('#openAiUniversalBotTestMode').value = 'auto';
        renderOpenAiUniversalModelOptions(bot);
        $('#openAiUniversalBotDocumentFormat').value = bot?.document_default_format || settings.openai_default_document_format || 'md';
        $('#openAiUniversalBotTestDocumentFormat').value = bot?.document_default_format || settings.openai_default_document_format || 'md';
        renderOpenAiUniversalBotAvatar(bot);
        renderOpenAiUniversalBotList();
        renderOpenAiUniversalChatBotSettings();
      }
    
      function openAiUniversalBotFormPayload() {
        return {
          kind: 'universal',
          name: $('#openAiUniversalBotName')?.value.trim(),
          mention: $('#openAiUniversalBotMention')?.value.trim(),
          enabled: $('#openAiUniversalBotEnabled')?.checked,
          visible_to_users: getBotVisibilityToggle('openAiUniversalBotVisibleToUsers'),
          response_model: $('#openAiUniversalBotResponseModel')?.value.trim(),
          summary_model: $('#openAiUniversalBotSummaryModel')?.value.trim(),
          image_model: $('#openAiUniversalBotImageModel')?.value.trim(),
          image_resolution: $('#openAiUniversalBotImageSize')?.value.trim(),
          image_quality: $('#openAiUniversalBotImageQuality')?.value.trim(),
          image_background: $('#openAiUniversalBotImageBackground')?.value.trim(),
          image_output_format: $('#openAiUniversalBotImageOutputFormat')?.value.trim(),
          document_default_format: $('#openAiUniversalBotDocumentFormat')?.value.trim(),
          allow_text: $('#openAiUniversalBotAllowText')?.checked,
          allow_image_generate: $('#openAiUniversalBotAllowImageGenerate')?.checked,
          allow_image_edit: $('#openAiUniversalBotAllowImageEdit')?.checked,
          allow_document: $('#openAiUniversalBotAllowDocument')?.checked,
          temperature: Number($('#openAiUniversalBotTemperature')?.value || 0.55),
          max_tokens: Number($('#openAiUniversalBotMaxTokens')?.value || 1000),
          style: $('#openAiUniversalBotStyle')?.value.trim(),
          tone: $('#openAiUniversalBotTone')?.value.trim(),
          behavior_rules: $('#openAiUniversalBotRules')?.value.trim(),
          speech_patterns: $('#openAiUniversalBotSpeech')?.value.trim(),
        };
      }
    
      function renderOpenAiUniversalChatBotSettings() {
        const chatSelect = $('#openAiUniversalBotChatSelect');
        const botSelect = $('#openAiUniversalBotChatBotSelect');
        if (!chatSelect || !botSelect) return;
        const currentChatValue = chatSelect.value || String(currentChatId || openAiUniversalState.chats[0]?.id || '');
        const currentBotValue = botSelect.value || String(selectedOpenAiUniversalBotId || openAiUniversalState.bots[0]?.id || '');
        chatSelect.innerHTML = openAiUniversalState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
        botSelect.innerHTML = openAiUniversalState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
        if (openAiUniversalState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
        if (openAiUniversalState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
        if (!botSelect.value && openAiUniversalState.bots[0]) botSelect.value = String(openAiUniversalState.bots[0].id);
        const setting = getOpenAiUniversalChatSetting(chatSelect.value, botSelect.value);
        $('#openAiUniversalBotChatEnabled').checked = !!setting?.enabled;
        $('#openAiUniversalBotChatMode').value = setting?.mode || 'simple';
        $('#openAiUniversalBotChatHotLimit').value = setting?.hot_context_limit || 50;
        $('#openAiUniversalBotChatAutoReact').checked = !!setting?.auto_react_on_mention;
      }
    
      function renderOpenAiUniversalSettings() {
        const selected = currentOpenAiUniversalBot() || openAiUniversalState.bots[0] || null;
        fillOpenAiUniversalBotForm(selected);
      }
    
      function getAiChatSetting(chatId, botId) {
        return aiBotState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
      }
    
      function renderAiBotAvatar(bot = currentAiBot()) {
        const avatarEl = $('#aiBotAvatar');
        if (!avatarEl) return;
        const name = bot?.name || $('#aiBotName')?.value.trim() || 'Bananza AI';
        const color = bot?.avatar_color || '#65aadd';
        avatarEl.style.background = color;
        if (bot?.avatar_url) {
          avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
        } else {
          avatarEl.textContent = initials(name);
        }
    
        const hasSavedBot = Boolean(bot?.id);
        const input = $('#aiBotAvatarInput');
        const label = $('#aiBotAvatarLabel');
        if (input) {
          input.disabled = !hasSavedBot;
          input.value = '';
        }
        if (label) {
          label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
          label.title = hasSavedBot ? '\u0421\u043c\u0435\u043d\u0438\u0442\u044c \u0430\u0432\u0430\u0442\u0430\u0440' : '\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 \u0431\u043e\u0442\u0430';
        }
        $('#removeAiBotAvatar')?.classList.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
      }
    
      function refreshRenderedAiBotAvatar(bot) {
        if (!bot?.user_id || !messagesEl) return;
        messagesEl.querySelectorAll(`.msg-group-avatar[data-user-id="${Number(bot.user_id)}"]`).forEach((avatarEl) => {
          avatarEl.title = bot.name || avatarEl.title || '';
          avatarEl.dataset.displayName = bot.name || avatarEl.dataset.displayName || '';
          if (bot.mention) avatarEl.dataset.mentionToken = bot.mention;
          setAvatarElementVisual(avatarEl, {
            name: bot.name || 'AI',
            color: bot.avatar_color || '#65aadd',
            avatarUrl: bot.avatar_url || '',
          });
        });
      }
    
      function providerInteractiveEnabled(provider, settings = {}) {
        if (provider === 'yandex') return !!settings.yandex_interactive_enabled;
        if (provider === 'deepseek') return !!settings.deepseek_interactive_enabled;
        if (provider === 'grok') return !!settings.grok_interactive_enabled;
        return !!settings.openai_interactive_enabled;
      }
    
      function providerInteractiveSummary(provider, settings = {}) {
        return `Interactive actions: ${providerInteractiveEnabled(provider, settings) ? 'on' : 'off'}`;
      }
    
      const BOT_SAVE_BOOLEAN_FIELDS = new Set([
        'enabled',
        'visible_to_users',
        'allow_text',
        'allow_image_generate',
        'allow_image_edit',
        'allow_document',
        'allow_poll_create',
        'allow_poll_vote',
        'allow_react',
        'allow_pin',
      ]);
      const BOT_SAVE_NUMERIC_FIELDS = new Set([
        'temperature',
        'max_tokens',
      ]);
    
      function normalizeBotSaveComparisonValue(key, value) {
        if (BOT_SAVE_BOOLEAN_FIELDS.has(key) || typeof value === 'boolean') return value ? 1 : 0;
        if (BOT_SAVE_NUMERIC_FIELDS.has(key) || typeof value === 'number') {
          const numeric = Number(value);
          return Number.isFinite(numeric) ? numeric : null;
        }
        return String(value ?? '').trim();
      }
    
      function verifyBotSaveResponse(bot, payload = {}) {
        if (!bot || !payload || typeof payload !== 'object') {
          return { ok: false, mismatches: ['server_response'] };
        }
        const mismatches = Object.keys(payload).filter((key) => (
          normalizeBotSaveComparisonValue(key, bot[key]) !== normalizeBotSaveComparisonValue(key, payload[key])
        ));
        return { ok: mismatches.length === 0, mismatches };
      }
    
      function buildVerifiedBotSaveStatus(savedLabel, bot, payload = {}, detailLine = '') {
        const verification = verifyBotSaveResponse(bot, payload);
        if (verification.ok) {
          return {
            type: 'success',
            message: [
              savedLabel,
              '\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435.',
              detailLine,
            ].filter(Boolean).join('\n'),
          };
        }
        return {
          type: 'error',
          message: [
            savedLabel,
            '\u0421\u0435\u0440\u0432\u0435\u0440 \u0432\u0435\u0440\u043d\u0443\u043b \u043e\u0442\u043b\u0438\u0447\u0430\u044e\u0449\u0438\u0435\u0441\u044f \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044f. \u0424\u043e\u0440\u043c\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0430 \u043f\u043e \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u043e\u043c\u0443 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u044e.',
            verification.mismatches.length ? `\u041f\u043e\u043b\u044f: ${verification.mismatches.join(', ')}` : '',
            detailLine,
          ].filter(Boolean).join('\n'),
        };
      }
    
    
      function fillAiBotForm(bot = null) {
        const settings = aiBotState.settings || {};
        selectedAiBotId = bot ? bot.id : null;
        $('#aiBotName').value = bot?.name || 'Bananza AI';
        $('#aiBotMention').value = bot?.mention || 'bananza';
        $('#aiBotEnabled').checked = bot ? !!bot.enabled : true;
        setBotVisibilityToggle('aiBotVisibleToUsers', !!bot?.visible_to_users);
        $('#aiBotResponseModel').value = bot?.response_model || settings.default_response_model || 'gpt-5.4';
        $('#aiBotSummaryModel').value = bot?.summary_model || settings.default_summary_model || 'gpt-5.4';
        $('#aiBotEmbeddingModel').value = settings.default_embedding_model || 'text-embedding-3-small';
        $('#aiBotTemperature').value = bot?.temperature ?? 0.55;
        $('#aiBotMaxTokens').value = bot?.max_tokens ?? 1000;
        $('#aiBotStyle').value = bot?.style || '\u041f\u043e\u043b\u0435\u0437\u043d\u044b\u0439 AI-\u043f\u043e\u043c\u043e\u0449\u043d\u0438\u043a \u0434\u043b\u044f \u0447\u0430\u0442\u0430';
        $('#aiBotTone').value = bot?.tone || '\u0442\u0451\u043f\u043b\u044b\u0439, \u0432\u043d\u0438\u043c\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0439, \u043a\u0440\u0430\u0442\u043a\u0438\u0439';
        $('#aiBotRules').value = bot?.behavior_rules || '';
        $('#aiBotSpeech').value = bot?.speech_patterns || '';
        renderAiBotAvatar(bot);
        renderAiModelOptions(bot);
        renderAiBotList();
        renderAiChatBotSettings();
      }
    
      function aiBotFormPayload() {
        return {
          name: $('#aiBotName')?.value.trim(),
          mention: $('#aiBotMention')?.value.trim(),
          enabled: $('#aiBotEnabled')?.checked,
          visible_to_users: getBotVisibilityToggle('aiBotVisibleToUsers'),
          response_model: $('#aiBotResponseModel')?.value.trim(),
          summary_model: $('#aiBotSummaryModel')?.value.trim(),
          temperature: Number($('#aiBotTemperature')?.value || 0.55),
          max_tokens: Number($('#aiBotMaxTokens')?.value || 1000),
          style: $('#aiBotStyle')?.value.trim(),
          tone: $('#aiBotTone')?.value.trim(),
          behavior_rules: $('#aiBotRules')?.value.trim(),
          speech_patterns: $('#aiBotSpeech')?.value.trim(),
        };
      }
    
      function renderAiBotList() {
        const list = $('#aiBotList');
        if (!list) return;
        if (!aiBotState.bots.length) {
          list.innerHTML = '<div class="ai-bot-empty">\u0411\u043e\u0442\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442. \u0421\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u0431\u043e\u0442\u0430.</div>';
          return;
        }
        list.innerHTML = aiBotState.bots.map(bot => `
          <button type="button" class="ai-bot-list-item${bot.id === selectedAiBotId ? ' active' : ''}" data-bot-id="${bot.id}">
            <span class="ai-bot-list-main">
              <span class="ai-bot-list-avatar" style="background:${esc(bot.avatar_color || '#65aadd')}">
                ${bot.avatar_url ? `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">` : esc(initials(bot.name || '?'))}
              </span>
              <span class="ai-bot-list-copy">
                <strong>${esc(bot.name)}</strong>
                <small>@${esc(bot.mention)} \u00b7 ${bot.enabled ? 'enabled' : 'disabled'}</small>
              </span>
            </span>
            <span class="ai-bot-list-model">${bot.response_model ? esc(bot.response_model) : ''}</span>
          </button>
        `).join('');
      }
    
      function renderAiChatBotSettings() {
        const chatSelect = $('#aiBotChatSelect');
        const botSelect = $('#aiBotChatBotSelect');
        if (!chatSelect || !botSelect) return;
        const currentChatValue = chatSelect.value || String(currentChatId || aiBotState.chats[0]?.id || '');
        const currentBotValue = botSelect.value || String(selectedAiBotId || aiBotState.bots[0]?.id || '');
    
        chatSelect.innerHTML = aiBotState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
        botSelect.innerHTML = aiBotState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
        if (aiBotState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
        if (aiBotState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
        if (!botSelect.value && aiBotState.bots[0]) botSelect.value = String(aiBotState.bots[0].id);
    
        const setting = getAiChatSetting(chatSelect.value, botSelect.value);
        $('#aiBotChatEnabled').checked = !!setting?.enabled;
        $('#aiBotChatMode').value = setting?.mode || 'simple';
        $('#aiBotChatHotLimit').value = setting?.hot_context_limit || 50;
        $('#aiBotChatAutoReact').checked = !!setting?.auto_react_on_mention;
      }
    
      function renderOpenAiProviderSettings() {
        const settings = aiBotState.settings || {};
        $('#aiBotsGlobalEnabled').checked = !!settings.enabled;
        $('#aiBotsInteractiveEnabled').checked = !!settings.openai_interactive_enabled;
        $('#aiBotsDefaultResponseModel').value = settings.default_response_model || 'gpt-5.4';
        $('#aiBotsDefaultSummaryModel').value = settings.default_summary_model || 'gpt-5.4';
        $('#aiBotsDefaultEmbeddingModel').value = settings.default_embedding_model || 'text-embedding-3-small';
        $('#aiBotsDefaultImageModel').value = settings.openai_default_image_model || 'gpt-image-2';
        $('#aiBotsDefaultImageSize').value = settings.openai_default_image_size || '1024x1024';
        $('#aiBotsDefaultImageQuality').value = settings.openai_default_image_quality || 'auto';
        $('#aiBotsDefaultImageBackground').value = settings.openai_default_image_background || 'auto';
        $('#aiBotsDefaultImageOutputFormat').value = settings.openai_default_image_output_format || 'png';
        $('#aiBotsDefaultDocumentFormat').value = settings.openai_default_document_format || 'md';
        $('#aiBotsChunkSize').value = settings.chunk_size || 50;
        $('#aiBotsRetrievalTopK').value = settings.retrieval_top_k || 6;
        $('#aiBotsApiKey').value = '';
        $('#aiBotsKeyStatus').textContent = settings.has_openai_key
          ? `\u041a\u043b\u044e\u0447 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d: ${settings.masked_openai_key || '***'}`
          : '\u041a\u043b\u044e\u0447 \u043d\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d';
    
        renderAiModelOptions(currentAiBot() || aiBotState.bots[0] || null);
      }
    
      function renderOpenAiTextBotsSettings() {
        fillAiBotForm(currentAiBot() || aiBotState.bots[0] || null);
      }
    
      function renderAiBotSettings() {
        renderOpenAiProviderSettings();
        renderOpenAiTextBotsSettings();
      }
    
      function aiBotSettingsPayload() {
        const body = {
          enabled: $('#aiBotsGlobalEnabled')?.checked,
          openai_interactive_enabled: $('#aiBotsInteractiveEnabled')?.checked,
          default_response_model: $('#aiBotsDefaultResponseModel')?.value.trim(),
          default_summary_model: $('#aiBotsDefaultSummaryModel')?.value.trim(),
          default_embedding_model: $('#aiBotsDefaultEmbeddingModel')?.value.trim(),
          openai_default_image_model: $('#aiBotsDefaultImageModel')?.value.trim(),
          openai_default_image_size: $('#aiBotsDefaultImageSize')?.value.trim(),
          openai_default_image_quality: $('#aiBotsDefaultImageQuality')?.value.trim(),
          openai_default_image_background: $('#aiBotsDefaultImageBackground')?.value.trim(),
          openai_default_image_output_format: $('#aiBotsDefaultImageOutputFormat')?.value.trim(),
          openai_default_document_format: $('#aiBotsDefaultDocumentFormat')?.value.trim(),
          chunk_size: Number($('#aiBotsChunkSize')?.value || 50),
          retrieval_top_k: Number($('#aiBotsRetrievalTopK')?.value || 6),
        };
        const key = $('#aiBotsApiKey')?.value.trim();
        if (key) body.openai_api_key = key;
        return body;
      }
    
      async function persistAiBotSettings() {
        const data = await api('/api/admin/ai-bots/settings', {
          method: 'PUT',
          body: aiBotSettingsPayload(),
        });
        mergeAiBotState(data);
        return data;
      }
    
      async function loadAiBotState() {
        const data = await api('/api/admin/ai-bots');
        mergeAiBotState({ state: data });
        renderAiBotSettings();
        renderOpenAiUniversalSettings();
        renderOpenAiImageSettings();
        loadAiModelOptions(false).catch((e) => {
          setAiModelStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0441\u043f\u0438\u0441\u043e\u043a \u043c\u043e\u0434\u0435\u043b\u0435\u0439', 'error');
        });
      }
    
      async function saveAiBotSettings() {
        setAiBotSettingsStatus('\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e...');
        try {
          await persistAiBotSettings();
          await loadAiModelOptions(true).catch(() => {});
          renderAiBotSettings();
          renderOpenAiUniversalSettings();
          renderOpenAiImageSettings();
          setAiBotSettingsStatus(`\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b\n${providerInteractiveSummary('openai', aiBotState.settings)}`, 'success');
        } catch (e) {
          setAiBotSettingsStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438', 'error');
        }
      }
    
      async function deleteAiBotKey() {
        if (!confirm('\u0423\u0434\u0430\u043b\u0438\u0442\u044c OpenAI API key \u0434\u043b\u044f AI-\u0431\u043e\u0442\u043e\u0432?')) return;
        try {
          const data = await api('/api/admin/ai-bots/openai-key', { method: 'DELETE' });
          mergeAiBotState(data);
          await loadAiModelOptions(true).catch(() => {});
          renderAiBotSettings();
          renderOpenAiUniversalSettings();
          renderOpenAiImageSettings();
          setAiBotSettingsStatus('\u041a\u043b\u044e\u0447 \u0443\u0434\u0430\u043b\u0451\u043d', 'success');
        } catch (e) {
          setAiBotSettingsStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043a\u043b\u044e\u0447', 'error');
        }
      }
    
      async function saveAiBot() {
        const payload = aiBotFormPayload();
        if (!payload.name) { setAiBotStatus('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043c\u044f \u0431\u043e\u0442\u0430', 'error'); return; }
        setAiBotStatus('\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e \u0431\u043e\u0442\u0430...');
        try {
          await persistAiBotSettings();
          const shouldUpdate = Boolean(selectedAiBotId && aiBotState.bots.some(bot => Number(bot.id) === Number(selectedAiBotId)));
          const url = shouldUpdate ? `/api/admin/ai-bots/${selectedAiBotId}` : '/api/admin/ai-bots';
          const method = shouldUpdate ? 'PUT' : 'POST';
          const data = await api(url, { method, body: payload });
          mergeAiBotState(data);
          selectedAiBotId = data.bot?.id || selectedAiBotId;
          if (data.bot?.user_id) {
            applyUserUpdate({
              id: data.bot.user_id,
              user_id: data.bot.user_id,
              display_name: data.bot.name,
              avatar_color: data.bot.avatar_color,
              avatar_url: data.bot.avatar_url,
              is_ai_bot: 1,
            });
          }
          renderAiBotSettings();
          const status = buildVerifiedBotSaveStatus('\u0411\u043e\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d.', data.bot, payload, formatCapabilityState(data.bot || payload));
          setAiBotStatus(status.message, status.type);
        } catch (e) {
          setAiBotStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0431\u043e\u0442\u0430', 'error');
        }
      }
    
      async function uploadAiBotAvatar(file) {
        if (!file) return;
        if (!selectedAiBotId) {
          setAiBotStatus('\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 \u0431\u043e\u0442\u0430, \u043f\u043e\u0442\u043e\u043c \u0434\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0430\u0432\u0430\u0442\u0430\u0440', 'error');
          renderAiBotAvatar(null);
          return;
        }
        const fd = new FormData();
        fd.append('avatar', file);
        setAiBotStatus('\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e \u0430\u0432\u0430\u0442\u0430\u0440...');
        try {
          const data = await api(`/api/admin/ai-bots/${selectedAiBotId}/avatar`, { method: 'POST', body: fd });
          mergeAiBotState(data);
          selectedAiBotId = data.bot?.id || selectedAiBotId;
          if (data.bot?.user_id) {
            applyUserUpdate({
              id: data.bot.user_id,
              user_id: data.bot.user_id,
              display_name: data.bot.name,
              avatar_color: data.bot.avatar_color,
              avatar_url: data.bot.avatar_url,
              is_ai_bot: 1,
            });
          }
          renderAiBotList();
          renderAiBotAvatar(currentAiBot());
          refreshRenderedAiBotAvatar(data.bot);
          renderAiChatBotSettings();
          setAiBotStatus('\u0410\u0432\u0430\u0442\u0430\u0440 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d', 'success');
        } catch (e) {
          setAiBotStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0430\u0432\u0430\u0442\u0430\u0440', 'error');
          renderAiBotAvatar(currentAiBot());
        }
      }
    
      async function removeAiBotAvatar() {
        if (!selectedAiBotId) return;
        try {
          const data = await api(`/api/admin/ai-bots/${selectedAiBotId}/avatar`, { method: 'DELETE' });
          mergeAiBotState(data);
          selectedAiBotId = data.bot?.id || selectedAiBotId;
          if (data.bot?.user_id) {
            applyUserUpdate({
              id: data.bot.user_id,
              user_id: data.bot.user_id,
              display_name: data.bot.name,
              avatar_color: data.bot.avatar_color,
              avatar_url: data.bot.avatar_url,
              is_ai_bot: 1,
            });
          }
          renderAiBotList();
          renderAiBotAvatar(currentAiBot());
          refreshRenderedAiBotAvatar(data.bot);
          renderAiChatBotSettings();
          setAiBotStatus('\u0410\u0432\u0430\u0442\u0430\u0440 \u0443\u0434\u0430\u043b\u0451\u043d', 'success');
        } catch (e) {
          setAiBotStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0430\u0432\u0430\u0442\u0430\u0440', 'error');
        }
      }
    
      async function disableAiBot() {
        if (!selectedAiBotId) return;
        if (!confirm('\u041e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u044d\u0442\u043e\u0433\u043e \u0431\u043e\u0442\u0430 \u0432\u043e \u0432\u0441\u0435\u0445 \u0447\u0430\u0442\u0430\u0445?')) return;
        try {
          const data = await api(`/api/admin/ai-bots/${selectedAiBotId}`, { method: 'DELETE' });
          mergeAiBotState(data);
          renderAiBotSettings();
          setAiBotStatus('\u0411\u043e\u0442 \u043e\u0442\u043a\u043b\u044e\u0447\u0451\u043d', 'success');
        } catch (e) {
          setAiBotStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0431\u043e\u0442\u0430', 'error');
        }
      }
    
      async function testAiBot() {
        if (!selectedAiBotId) { setAiBotStatus('\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 \u0431\u043e\u0442\u0430', 'error'); return; }
        setAiBotStatus('\u041f\u0440\u043e\u0432\u0435\u0440\u044f\u044e \u043c\u043e\u0434\u0435\u043b\u044c...');
        try {
          const data = await api(`/api/admin/ai-bots/${selectedAiBotId}/test`, { method: 'POST', body: {} });
          const text = data.result?.text ? data.result.text.slice(0, 500) : '';
          setAiBotStatus(`\u0423\u0441\u043f\u0435\u0448\u043d\u043e (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
        } catch (e) {
          setAiBotStatus(e.message || '\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u043d\u0435 \u0443\u0434\u0430\u043b\u0430\u0441\u044c', 'error');
        }
      }
    
      function filenameFromContentDisposition(header, fallback) {
        const match = String(header || '').match(/filename="?([^";]+)"?/i);
        return match ? match[1] : fallback;
      }
    
      async function exportAiBotJson() {
        if (!selectedAiBotId) { setAiBotStatus('\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u043e\u0433\u043e \u0431\u043e\u0442\u0430', 'error'); return; }
        setAiBotStatus('\u0413\u043e\u0442\u043e\u0432\u043b\u044e JSON...');
        try {
          const headers = {};
          if (token) headers.Authorization = 'Bearer ' + token;
          const res = await fetch(`/api/admin/ai-bots/${selectedAiBotId}/export`, { headers });
          if (!res.ok) {
            let data = {};
            try { data = await res.json(); } catch {}
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          const blob = await res.blob();
          const bot = currentAiBot();
          const fallbackName = `bananza-bot-${bot?.mention || selectedAiBotId}.json`;
          const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          setAiBotStatus('JSON \u0432\u044b\u0433\u0440\u0443\u0436\u0435\u043d', 'success');
        } catch (e) {
          setAiBotStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u0433\u0440\u0443\u0437\u0438\u0442\u044c JSON', 'error');
        }
      }
    
      async function importAiBotJsonFile(file) {
        if (!file) return;
        setAiBotStatus('\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e JSON...');
        try {
          const raw = await file.text();
          const payload = JSON.parse(raw);
          const data = await api('/api/admin/ai-bots/import', { method: 'POST', body: payload });
          mergeAiBotState(data);
          selectedAiBotId = data.bot?.id || selectedAiBotId;
          renderAiBotSettings();
          const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
          setAiBotStatus(`\u0411\u043e\u0442 \u0438\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u043d.${warnings}`, warnings ? 'error' : 'success');
        } catch (e) {
          setAiBotStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c JSON', 'error');
        } finally {
          const input = $('#aiBotImportFile');
          if (input) input.value = '';
        }
      }
    
      async function saveAiChatBotSettings() {
        const chatId = Number($('#aiBotChatSelect')?.value || 0);
        const botId = Number($('#aiBotChatBotSelect')?.value || 0);
        const botExists = aiBotState.bots.some(bot => Number(bot.id) === botId);
        if (!chatId || !botId) { setAiBotChatStatus('\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0447\u0430\u0442 \u0438 \u0431\u043e\u0442\u0430', 'error'); return; }
        if (!botExists) {
          setAiBotChatStatus('\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 \u0431\u043e\u0442\u0430', 'error');
          await loadAiBotState().catch(() => {});
          return;
        }
        try {
          await persistAiBotSettings();
          const data = await api('/api/admin/ai-bots/chat-settings', {
            method: 'PUT',
            body: {
              chatId,
              botId,
              enabled: $('#aiBotChatEnabled')?.checked,
              mode: $('#aiBotChatMode')?.value || 'simple',
              hot_context_limit: Number($('#aiBotChatHotLimit')?.value || 50),
              auto_react_on_mention: $('#aiBotChatAutoReact')?.checked,
            },
          });
          mergeAiBotState(data);
          renderAiChatBotSettings();
          setAiBotChatStatus('\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0447\u0430\u0442\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b', 'success');
        } catch (e) {
          setAiBotChatStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0447\u0430\u0442\u0430', 'error');
        }
      }
    
      async function loadOpenAiUniversalState() {
        const data = await api('/api/admin/openai-universal-bots');
        mergeOpenAiUniversalState({ state: data });
        renderOpenAiUniversalSettings();
        return data;
      }
    
      function syncOpenAiUniversalBotUser(bot) {
        if (!bot?.user_id) return;
        applyUserUpdate({
          id: bot.user_id,
          user_id: bot.user_id,
          display_name: bot.name,
          avatar_color: bot.avatar_color,
          avatar_url: bot.avatar_url,
          is_ai_bot: 1,
        });
      }
    
      async function saveOpenAiUniversalBot() {
        const payload = openAiUniversalBotFormPayload();
        if (!payload.name) { setOpenAiUniversalStatus('Enter bot name', 'error'); return; }
        setOpenAiUniversalStatus('Saving universal bot...');
        try {
          const shouldUpdate = Boolean(selectedOpenAiUniversalBotId && openAiUniversalState.bots.some(bot => Number(bot.id) === Number(selectedOpenAiUniversalBotId)));
          const url = shouldUpdate ? `/api/admin/openai-universal-bots/${selectedOpenAiUniversalBotId}` : '/api/admin/openai-universal-bots';
          const method = shouldUpdate ? 'PUT' : 'POST';
          const data = await api(url, { method, body: payload });
          mergeOpenAiUniversalState(data);
          selectedOpenAiUniversalBotId = data.bot?.id || selectedOpenAiUniversalBotId;
          syncOpenAiUniversalBotUser(data.bot);
          renderOpenAiUniversalSettings();
          const status = buildVerifiedBotSaveStatus('Universal bot saved.', data.bot, payload, formatCapabilityState(data.bot || payload));
          setOpenAiUniversalStatus(status.message, status.type);
        } catch (e) {
          setOpenAiUniversalStatus(e.message || 'Could not save universal bot', 'error');
        }
      }
    
      async function uploadOpenAiUniversalBotAvatar(file) {
        if (!file) return;
        if (!selectedOpenAiUniversalBotId) {
          setOpenAiUniversalStatus('Save the bot before adding an avatar', 'error');
          renderOpenAiUniversalBotAvatar(null);
          return;
        }
        const fd = new FormData();
        fd.append('avatar', file);
        setOpenAiUniversalStatus('Uploading avatar...');
        try {
          const data = await api(`/api/admin/openai-universal-bots/${selectedOpenAiUniversalBotId}/avatar`, { method: 'POST', body: fd });
          mergeOpenAiUniversalState(data);
          selectedOpenAiUniversalBotId = data.bot?.id || selectedOpenAiUniversalBotId;
          syncOpenAiUniversalBotUser(data.bot);
          renderOpenAiUniversalSettings();
          refreshRenderedAiBotAvatar(data.bot);
          setOpenAiUniversalStatus('Avatar saved', 'success');
        } catch (e) {
          setOpenAiUniversalStatus(e.message || 'Could not upload avatar', 'error');
        }
      }
    
      async function removeOpenAiUniversalBotAvatar() {
        if (!selectedOpenAiUniversalBotId) return;
        try {
          const data = await api(`/api/admin/openai-universal-bots/${selectedOpenAiUniversalBotId}/avatar`, { method: 'DELETE' });
          mergeOpenAiUniversalState(data);
          selectedOpenAiUniversalBotId = data.bot?.id || selectedOpenAiUniversalBotId;
          syncOpenAiUniversalBotUser(data.bot);
          renderOpenAiUniversalSettings();
          refreshRenderedAiBotAvatar(data.bot);
          setOpenAiUniversalStatus('Avatar removed', 'success');
        } catch (e) {
          setOpenAiUniversalStatus(e.message || 'Could not remove avatar', 'error');
        }
      }
    
      async function disableOpenAiUniversalBot() {
        if (!selectedOpenAiUniversalBotId) return;
        if (!confirm('Disable this OpenAI universal bot in all chats?')) return;
        try {
          const data = await api(`/api/admin/openai-universal-bots/${selectedOpenAiUniversalBotId}`, { method: 'DELETE' });
          mergeOpenAiUniversalState(data);
          renderOpenAiUniversalSettings();
          setOpenAiUniversalStatus('Universal bot disabled', 'success');
        } catch (e) {
          setOpenAiUniversalStatus(e.message || 'Could not disable universal bot', 'error');
        }
      }
    
      async function testOpenAiUniversalBot() {
        if (!selectedOpenAiUniversalBotId) { setOpenAiUniversalStatus('Save the bot first', 'error'); return; }
        setOpenAiUniversalStatus('Testing universal bot...');
        try {
          const data = await api(`/api/admin/openai-universal-bots/${selectedOpenAiUniversalBotId}/test`, {
            method: 'POST',
            body: {
              mode: $('#openAiUniversalBotTestMode')?.value || 'auto',
              document_format: $('#openAiUniversalBotTestDocumentFormat')?.value || 'md',
            },
          });
          const text = data.result?.text ? data.result.text.slice(0, 500) : '';
          setOpenAiUniversalStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
        } catch (e) {
          setOpenAiUniversalStatus(e.message || 'Universal bot test failed', 'error');
        }
      }
    
      async function exportOpenAiUniversalBotJson() {
        if (!selectedOpenAiUniversalBotId) { setOpenAiUniversalStatus('Choose a saved bot first', 'error'); return; }
        setOpenAiUniversalStatus('Preparing JSON...');
        try {
          const headers = {};
          if (token) headers.Authorization = 'Bearer ' + token;
          const res = await fetch(`/api/admin/openai-universal-bots/${selectedOpenAiUniversalBotId}/export`, { headers });
          if (!res.ok) {
            let data = {};
            try { data = await res.json(); } catch {}
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          const blob = await res.blob();
          const bot = currentOpenAiUniversalBot();
          const fallbackName = `bananza-openai-universal-${bot?.mention || selectedOpenAiUniversalBotId}.json`;
          const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          setOpenAiUniversalStatus('JSON exported', 'success');
        } catch (e) {
          setOpenAiUniversalStatus(e.message || 'Could not export JSON', 'error');
        }
      }
    
      async function importOpenAiUniversalBotJsonFile(file) {
        if (!file) return;
        setOpenAiUniversalStatus('Importing JSON...');
        try {
          const raw = await file.text();
          const payload = JSON.parse(raw);
          const data = await api('/api/admin/openai-universal-bots/import', { method: 'POST', body: payload });
          mergeOpenAiUniversalState(data);
          selectedOpenAiUniversalBotId = data.bot?.id || selectedOpenAiUniversalBotId;
          renderOpenAiUniversalSettings();
          const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
          setOpenAiUniversalStatus(`Universal bot imported.${warnings}`, warnings ? 'error' : 'success');
        } catch (e) {
          setOpenAiUniversalStatus(e.message || 'Could not import JSON', 'error');
        } finally {
          const input = $('#openAiUniversalBotImportFile');
          if (input) input.value = '';
        }
      }
    
      async function saveOpenAiUniversalChatBotSettings() {
        const chatId = Number($('#openAiUniversalBotChatSelect')?.value || 0);
        const botId = Number($('#openAiUniversalBotChatBotSelect')?.value || 0);
        const botExists = openAiUniversalState.bots.some(bot => Number(bot.id) === Number(botId));
        if (!chatId || !botId) { setOpenAiUniversalChatStatus('Choose chat and bot', 'error'); return; }
        if (!botExists) {
          setOpenAiUniversalChatStatus('Save the bot first', 'error');
          await loadOpenAiUniversalState().catch(() => {});
          return;
        }
        try {
          const data = await api('/api/admin/openai-universal-bots/chat-settings', {
            method: 'PUT',
            body: {
              chatId,
              botId,
              enabled: $('#openAiUniversalBotChatEnabled')?.checked,
              mode: $('#openAiUniversalBotChatMode')?.value || 'simple',
              hot_context_limit: Number($('#openAiUniversalBotChatHotLimit')?.value || 50),
              auto_react_on_mention: $('#openAiUniversalBotChatAutoReact')?.checked,
            },
          });
          mergeOpenAiUniversalState(data);
          renderOpenAiUniversalChatBotSettings();
          setOpenAiUniversalChatStatus('Chat settings saved', 'success');
        } catch (e) {
          setOpenAiUniversalChatStatus(e.message || 'Could not save chat settings', 'error');
        }
      }
    
      function setOpenAiImageModalStatus(message, type = '') {
        setOpenAiStatus('openAiImageStatus', message, type);
      }
    
      function setOpenAiImageStatus(message, type = '') {
        setOpenAiStatus(['openAiImageBotEditorStatus', 'openAiImageBotEditorStatusBottom'], message, type);
      }
    
      function setOpenAiImageChatStatus(message, type = '') {
        setOpenAiStatus('openAiImageBotChatStatus', message, type);
      }
    
      function mergeOpenAiImageState(data = {}) {
        const state = data.state || data;
        if (state.settings) syncSharedOpenAiSettings(state.settings);
        if (state.bots) openAiImageState.bots = state.bots;
        if (state.chats) openAiImageState.chats = state.chats;
        if (state.chatSettings) openAiImageState.chatSettings = state.chatSettings;
        if (state.models) {
          openAiImageState.models = { ...openAiImageState.models, ...state.models };
          if (Array.isArray(state.models.image) && state.models.image.length) {
            aiModelCatalog.image = state.models.image;
          }
        }
        openAiImageState.settings = aiBotState.settings;
        if (selectedOpenAiImageBotId && !openAiImageState.bots.some(bot => Number(bot.id) === Number(selectedOpenAiImageBotId))) {
          selectedOpenAiImageBotId = null;
        }
        composerStateController.mentionTargetsByChat.clear();
        updateComposerAiOverrideState().catch(() => {});
      }
    
      function currentOpenAiImageBot() {
        return openAiImageState.bots.find(bot => Number(bot.id) === Number(selectedOpenAiImageBotId)) || null;
      }
    
      function getOpenAiImageChatSetting(chatId, botId) {
        return openAiImageState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
      }
    
      function renderOpenAiImageModelOptions(bot = currentOpenAiImageBot()) {
        const settings = openAiImageState.settings || aiBotState.settings || {};
        const models = openAiImageState.models || {};
        const imageModels = models.image || aiModelCatalog.image || ['gpt-image-2'];
        setAiModelSelectOptions('openAiImageBotModel', imageModels, bot?.image_model || settings.openai_default_image_model || 'gpt-image-2');
        setStaticSelectOptions('openAiImageBotImageSize', models.image_size || OPENAI_IMAGE_SIZE_OPTIONS, bot?.image_resolution || settings.openai_default_image_size || '1024x1024');
        setStaticSelectOptions('openAiImageBotImageQuality', models.image_quality || OPENAI_IMAGE_QUALITY_OPTIONS, bot?.image_quality || settings.openai_default_image_quality || 'auto');
        setStaticSelectOptions('openAiImageBotImageBackground', models.image_background || OPENAI_IMAGE_BACKGROUND_OPTIONS, bot?.image_background || settings.openai_default_image_background || 'auto');
        setStaticSelectOptions('openAiImageBotImageOutputFormat', models.image_output_format || OPENAI_IMAGE_OUTPUT_OPTIONS, bot?.image_output_format || settings.openai_default_image_output_format || 'png');
      }
    
      function renderOpenAiImageBotAvatar(bot = currentOpenAiImageBot()) {
        const avatarEl = $('#openAiImageBotAvatar');
        if (!avatarEl) return;
        const name = bot?.name || $('#openAiImageBotName')?.value.trim() || 'OpenAI Images';
        const color = bot?.avatar_color || '#65aadd';
        avatarEl.style.background = color;
        if (bot?.avatar_url) {
          avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
        } else {
          avatarEl.textContent = initials(name);
        }
    
        const hasSavedBot = Boolean(bot?.id);
        const input = $('#openAiImageBotAvatarInput');
        const label = $('#openAiImageBotAvatarLabel');
        if (input) {
          input.disabled = !hasSavedBot;
          input.value = '';
        }
        if (label) {
          label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
          label.title = hasSavedBot ? 'Change avatar' : 'Save the bot first';
        }
        $('#removeOpenAiImageBotAvatar')?.classList.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
      }
    
      function renderOpenAiImageBotList() {
        const list = $('#openAiImageBotList');
        if (!list) return;
        if (!openAiImageState.bots.length) {
          list.innerHTML = '<div class="ai-bot-empty">No OpenAI image bots yet. Create the first one.</div>';
          return;
        }
        list.innerHTML = openAiImageState.bots.map(bot => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedOpenAiImageBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
            <span class="ai-bot-list-main">
              <span class="ai-bot-list-avatar" style="background:${esc(bot.avatar_color || '#65aadd')}">
                ${bot.avatar_url ? `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">` : esc(initials(bot.name || '?'))}
              </span>
              <span class="ai-bot-list-copy">
                <strong>${esc(bot.name)}</strong>
                <small>@${esc(bot.mention)} \u0412\u00b7 ${bot.enabled ? 'enabled' : 'disabled'}</small>
              </span>
            </span>
            <span class="ai-bot-list-model">${bot.image_model ? esc(bot.image_model) : ''}</span>
          </button>
        `).join('');
      }
    
      function fillOpenAiImageBotForm(bot = null) {
        selectedOpenAiImageBotId = bot ? bot.id : null;
        $('#openAiImageBotName').value = bot?.name || 'OpenAI Images';
        $('#openAiImageBotMention').value = bot?.mention || 'openai_image';
        $('#openAiImageBotEnabled').checked = bot ? !!bot.enabled : true;
        setBotVisibilityToggle('openAiImageBotVisibleToUsers', !!bot?.visible_to_users);
        $('#openAiImageBotAllowImageGenerate').checked = bot?.allow_image_generate ?? true;
        $('#openAiImageBotAllowImageEdit').checked = bot?.allow_image_edit ?? true;
        renderOpenAiImageModelOptions(bot);
        renderOpenAiImageBotAvatar(bot);
        renderOpenAiImageBotList();
        renderOpenAiImageChatBotSettings();
      }
    
      function openAiImageBotFormPayload() {
        return {
          kind: 'image',
          name: $('#openAiImageBotName')?.value.trim(),
          mention: $('#openAiImageBotMention')?.value.trim(),
          enabled: $('#openAiImageBotEnabled')?.checked,
          visible_to_users: getBotVisibilityToggle('openAiImageBotVisibleToUsers'),
          image_model: $('#openAiImageBotModel')?.value.trim(),
          image_resolution: $('#openAiImageBotImageSize')?.value.trim(),
          image_quality: $('#openAiImageBotImageQuality')?.value.trim(),
          image_background: $('#openAiImageBotImageBackground')?.value.trim(),
          image_output_format: $('#openAiImageBotImageOutputFormat')?.value.trim(),
          allow_image_generate: $('#openAiImageBotAllowImageGenerate')?.checked,
          allow_image_edit: $('#openAiImageBotAllowImageEdit')?.checked,
        };
      }
    
      function renderOpenAiImageChatBotSettings() {
        const chatSelect = $('#openAiImageBotChatSelect');
        const botSelect = $('#openAiImageBotChatBotSelect');
        if (!chatSelect || !botSelect) return;
        const currentChatValue = chatSelect.value || String(currentChatId || openAiImageState.chats[0]?.id || '');
        const currentBotValue = botSelect.value || String(selectedOpenAiImageBotId || openAiImageState.bots[0]?.id || '');
        chatSelect.innerHTML = openAiImageState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
        botSelect.innerHTML = openAiImageState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
        if (openAiImageState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
        if (openAiImageState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
        if (!botSelect.value && openAiImageState.bots[0]) botSelect.value = String(openAiImageState.bots[0].id);
        const setting = getOpenAiImageChatSetting(chatSelect.value, botSelect.value);
        $('#openAiImageBotChatEnabled').checked = !!setting?.enabled;
      }
    
      function renderOpenAiImageSettings() {
        const selected = currentOpenAiImageBot() || openAiImageState.bots[0] || null;
        fillOpenAiImageBotForm(selected);
        renderOpenAiImageChatBotSettings();
      }
    
      async function loadOpenAiImageState() {
        const data = await api('/api/admin/openai-image-bots');
        mergeOpenAiImageState({ state: data });
        renderOpenAiImageSettings();
        return data;
      }
    
      function syncOpenAiImageBotUser(bot) {
        if (!bot?.user_id) return;
        applyUserUpdate({
          id: bot.user_id,
          user_id: bot.user_id,
          display_name: bot.name,
          avatar_color: bot.avatar_color,
          avatar_url: bot.avatar_url,
          is_ai_bot: 1,
        });
      }
    
      async function saveOpenAiImageBot() {
        const payload = openAiImageBotFormPayload();
        if (!payload.name) { setOpenAiImageStatus('Enter image bot name', 'error'); return; }
        setOpenAiImageStatus('Saving OpenAI image bot...', 'pending');
        try {
          const shouldUpdate = Boolean(selectedOpenAiImageBotId && openAiImageState.bots.some(bot => Number(bot.id) === Number(selectedOpenAiImageBotId)));
          const url = shouldUpdate ? `/api/admin/openai-image-bots/${selectedOpenAiImageBotId}` : '/api/admin/openai-image-bots';
          const method = shouldUpdate ? 'PUT' : 'POST';
          const data = await api(url, { method, body: payload });
          mergeOpenAiImageState(data);
          selectedOpenAiImageBotId = data.bot?.id || selectedOpenAiImageBotId;
          syncOpenAiImageBotUser(data.bot);
          renderOpenAiImageSettings();
          const status = buildVerifiedBotSaveStatus('Image bot saved.', data.bot, payload);
          setOpenAiImageStatus(status.message, status.type);
        } catch (e) {
          setOpenAiImageStatus(e.message || 'Could not save OpenAI image bot', 'error');
        }
      }
    
      async function uploadOpenAiImageBotAvatar(file) {
        if (!file) return;
        if (!selectedOpenAiImageBotId) {
          setOpenAiImageStatus('Save the bot before adding an avatar', 'error');
          renderOpenAiImageBotAvatar(null);
          return;
        }
        const fd = new FormData();
        fd.append('avatar', file);
        setOpenAiImageStatus('Uploading avatar...', 'pending');
        try {
          const data = await api(`/api/admin/openai-image-bots/${selectedOpenAiImageBotId}/avatar`, { method: 'POST', body: fd });
          mergeOpenAiImageState(data);
          selectedOpenAiImageBotId = data.bot?.id || selectedOpenAiImageBotId;
          syncOpenAiImageBotUser(data.bot);
          renderOpenAiImageSettings();
          refreshRenderedAiBotAvatar(data.bot);
          setOpenAiImageStatus('Avatar saved', 'success');
        } catch (e) {
          setOpenAiImageStatus(e.message || 'Could not upload avatar', 'error');
        }
      }
    
      async function removeOpenAiImageBotAvatar() {
        if (!selectedOpenAiImageBotId) return;
        try {
          const data = await api(`/api/admin/openai-image-bots/${selectedOpenAiImageBotId}/avatar`, { method: 'DELETE' });
          mergeOpenAiImageState(data);
          selectedOpenAiImageBotId = data.bot?.id || selectedOpenAiImageBotId;
          syncOpenAiImageBotUser(data.bot);
          renderOpenAiImageSettings();
          refreshRenderedAiBotAvatar(data.bot);
          setOpenAiImageStatus('Avatar removed', 'success');
        } catch (e) {
          setOpenAiImageStatus(e.message || 'Could not remove avatar', 'error');
        }
      }
    
      async function disableOpenAiImageBot() {
        if (!selectedOpenAiImageBotId) return;
        if (!confirm('Disable this OpenAI image bot in all chats?')) return;
        try {
          const data = await api(`/api/admin/openai-image-bots/${selectedOpenAiImageBotId}`, { method: 'DELETE' });
          mergeOpenAiImageState(data);
          renderOpenAiImageSettings();
          setOpenAiImageStatus('Image bot disabled', 'success');
        } catch (e) {
          setOpenAiImageStatus(e.message || 'Could not disable image bot', 'error');
        }
      }
    
      async function testOpenAiImageBot() {
        if (!selectedOpenAiImageBotId) { setOpenAiImageStatus('Save the bot first', 'error'); return; }
        setOpenAiImageStatus('Testing image bot...', 'pending');
        try {
          const data = await api(`/api/admin/openai-image-bots/${selectedOpenAiImageBotId}/test`, { method: 'POST', body: {} });
          const text = data.result?.text ? data.result.text.slice(0, 500) : '';
          setOpenAiImageStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
        } catch (e) {
          setOpenAiImageStatus(e.message || 'Image bot test failed', 'error');
        }
      }
    
      async function exportOpenAiImageBotJson() {
        if (!selectedOpenAiImageBotId) { setOpenAiImageStatus('Choose a saved bot first', 'error'); return; }
        setOpenAiImageStatus('Preparing JSON...', 'pending');
        try {
          const headers = {};
          if (token) headers.Authorization = 'Bearer ' + token;
          const res = await fetch(`/api/admin/openai-image-bots/${selectedOpenAiImageBotId}/export`, { headers });
          if (!res.ok) {
            let data = {};
            try { data = await res.json(); } catch {}
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          const blob = await res.blob();
          const bot = currentOpenAiImageBot();
          const fallbackName = `bananza-openai-image-${bot?.mention || selectedOpenAiImageBotId}.json`;
          const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          setOpenAiImageStatus('JSON exported', 'success');
        } catch (e) {
          setOpenAiImageStatus(e.message || 'Could not export JSON', 'error');
        }
      }
    
      async function importOpenAiImageBotJsonFile(file) {
        if (!file) return;
        setOpenAiImageStatus('Importing JSON...', 'pending');
        try {
          const raw = await file.text();
          const payload = JSON.parse(raw);
          const data = await api('/api/admin/openai-image-bots/import', { method: 'POST', body: payload });
          mergeOpenAiImageState(data);
          selectedOpenAiImageBotId = data.bot?.id || selectedOpenAiImageBotId;
          renderOpenAiImageSettings();
          const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
          setOpenAiImageStatus(`Image bot imported.${warnings}`, warnings ? 'error' : 'success');
        } catch (e) {
          setOpenAiImageStatus(e.message || 'Could not import JSON', 'error');
        } finally {
          const input = $('#openAiImageBotImportFile');
          if (input) input.value = '';
        }
      }
    
      async function saveOpenAiImageChatBotSettings() {
        const chatId = Number($('#openAiImageBotChatSelect')?.value || 0);
        const botId = Number($('#openAiImageBotChatBotSelect')?.value || 0);
        const botExists = openAiImageState.bots.some(bot => Number(bot.id) === Number(botId));
        if (!chatId || !botId) { setOpenAiImageChatStatus('Choose chat and image bot', 'error'); return; }
        if (!botExists) {
          setOpenAiImageChatStatus('Save the image bot first', 'error');
          await loadOpenAiImageState().catch(() => {});
          return;
        }
        try {
          const data = await api('/api/admin/openai-image-bots/chat-settings', {
            method: 'PUT',
            body: {
              chatId,
              botId,
              enabled: $('#openAiImageBotChatEnabled')?.checked,
              mode: 'simple',
              hot_context_limit: 50,
            },
          });
          mergeOpenAiImageState(data);
          renderOpenAiImageChatBotSettings();
          setOpenAiImageChatStatus('Image bot chat settings saved', 'success');
        } catch (e) {
          setOpenAiImageChatStatus(e.message || 'Could not save image bot chat settings', 'error');
        }
      }
    
      return {
        setInlineStatus, resolveActionButtons, setActionButtonsPending, withActionButtons, bindAsyncActionButtons, setOpenAiStatus,
        setAiBotModalStatus, setAiBotSettingsStatus, setAiBotStatus, setAiBotTextModalStatus, setAiBotChatStatus, setAiModelStatus,
        uniqueAiModelValues, setAiModelSelectOptions, setStaticSelectOptions, syncSharedOpenAiSettings, syncSharedGrokSettings, renderAiModelOptions,
        loadAiModelOptions, mergeAiBotState, currentAiBot, setOpenAiUniversalModalStatus, setOpenAiUniversalStatus, setOpenAiUniversalChatStatus,
        mergeOpenAiUniversalState, currentOpenAiUniversalBot, getOpenAiUniversalChatSetting, renderOpenAiUniversalModelOptions, renderOpenAiUniversalBotAvatar, renderOpenAiUniversalBotList,
        fillOpenAiUniversalBotForm, openAiUniversalBotFormPayload, renderOpenAiUniversalChatBotSettings, renderOpenAiUniversalSettings, getAiChatSetting, renderAiBotAvatar,
        refreshRenderedAiBotAvatar, providerInteractiveEnabled, providerInteractiveSummary, normalizeBotSaveComparisonValue, verifyBotSaveResponse, buildVerifiedBotSaveStatus,
        fillAiBotForm, aiBotFormPayload, renderAiBotList, renderAiChatBotSettings, renderOpenAiProviderSettings, renderOpenAiTextBotsSettings,
        renderAiBotSettings, aiBotSettingsPayload, persistAiBotSettings, loadAiBotState, saveAiBotSettings, deleteAiBotKey,
        saveAiBot, uploadAiBotAvatar, removeAiBotAvatar, disableAiBot, testAiBot, filenameFromContentDisposition,
        exportAiBotJson, importAiBotJsonFile, saveAiChatBotSettings, loadOpenAiUniversalState, syncOpenAiUniversalBotUser, saveOpenAiUniversalBot,
        uploadOpenAiUniversalBotAvatar, removeOpenAiUniversalBotAvatar, disableOpenAiUniversalBot, testOpenAiUniversalBot, exportOpenAiUniversalBotJson, importOpenAiUniversalBotJsonFile,
        saveOpenAiUniversalChatBotSettings, setOpenAiImageModalStatus, setOpenAiImageStatus, setOpenAiImageChatStatus, mergeOpenAiImageState, currentOpenAiImageBot,
        getOpenAiImageChatSetting, renderOpenAiImageModelOptions, renderOpenAiImageBotAvatar, renderOpenAiImageBotList, fillOpenAiImageBotForm, openAiImageBotFormPayload,
        renderOpenAiImageChatBotSettings, renderOpenAiImageSettings, loadOpenAiImageState, syncOpenAiImageBotUser, saveOpenAiImageBot, uploadOpenAiImageBotAvatar,
        removeOpenAiImageBotAvatar, disableOpenAiImageBot, testOpenAiImageBot, exportOpenAiImageBotJson, importOpenAiImageBotJsonFile, saveOpenAiImageChatBotSettings,
      };
    }
  }

  aiAdmin.openaiRuntime = { createOpenAiRuntime };
})();
