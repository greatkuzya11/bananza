(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};

  function createLocalProvidersRuntime(scope = {}) {
    with (scope) {
      function setDeepseekAiStatus(message, type = '') {
        setInlineStatus('deepseekAiStatus', message, type);
      }
    
      function setDeepseekAiProviderStatus(message, type = '') {
        setInlineStatus('deepseekAiProviderStatus', message, type);
      }
    
      function setDeepseekAiBalanceStatus(message, type = '') {
        setInlineStatus('deepseekAiBalanceStatus', message, type);
      }
    
      function setDeepseekBotStatus(message, type = '') {
        setInlineStatus('deepseekAiBotEditorStatus', message, type);
      }
    
      function setDeepseekChatStatus(message, type = '') {
        setInlineStatus('deepseekAiBotChatStatus', message, type);
      }
    
      function setDeepseekAiModelStatus(message, type = '') {
        setInlineStatus('deepseekAiModelStatus', message, type);
      }
    
      function currentDeepseekBot() {
        return deepseekBotState.bots.find(bot => Number(bot.id) === Number(selectedDeepseekBotId)) || null;
      }
    
      function getDeepseekChatSetting(chatId, botId) {
        return deepseekBotState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
      }
    
      function mergeDeepseekAiState(data = {}) {
        const state = data.state || data;
        if (state.settings) deepseekBotState.settings = { ...deepseekBotState.settings, ...state.settings };
        if (state.bots) deepseekBotState.bots = state.bots;
        if (state.chats) deepseekBotState.chats = state.chats;
        if (state.chatSettings) deepseekBotState.chatSettings = state.chatSettings;
        if (state.models) deepseekBotState.models = { ...deepseekBotState.models, ...state.models };
        if (selectedDeepseekBotId && !deepseekBotState.bots.some(bot => Number(bot.id) === Number(selectedDeepseekBotId))) {
          selectedDeepseekBotId = null;
        }
        composerStateController.mentionTargetsByChat.clear();
      }
    
      function renderDeepseekModelOptions(bot = currentDeepseekBot()) {
        const settings = deepseekBotState.settings || {};
        const models = deepseekBotState.models || {};
        const responseModels = models.response || ['deepseek-chat', 'deepseek-reasoner'];
        const summaryModels = models.summary || responseModels;
        setAiModelSelectOptions('deepseekAiDefaultResponseModel', responseModels, settings.deepseek_default_response_model || 'deepseek-chat');
        setAiModelSelectOptions('deepseekAiDefaultSummaryModel', summaryModels, settings.deepseek_default_summary_model || 'deepseek-chat');
        setAiModelSelectOptions('deepseekAiBotResponseModel', responseModels, bot?.response_model || settings.deepseek_default_response_model || 'deepseek-chat');
        setAiModelSelectOptions('deepseekAiBotSummaryModel', summaryModels, bot?.summary_model || settings.deepseek_default_summary_model || 'deepseek-chat');
      }
    
      function renderDeepseekBotAvatar(bot = currentDeepseekBot()) {
        const avatarEl = $('#deepseekAiBotAvatar');
        if (!avatarEl) return;
        const name = bot?.name || $('#deepseekAiBotName')?.value.trim() || 'DeepSeek AI';
        const color = bot?.avatar_color || '#65aadd';
        avatarEl.style.background = color;
        if (bot?.avatar_url) {
          avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
        } else {
          avatarEl.textContent = initials(name);
        }
    
        const hasSavedBot = Boolean(bot?.id);
        const input = $('#deepseekAiBotAvatarInput');
        const label = $('#deepseekAiBotAvatarLabel');
        if (input) {
          input.disabled = !hasSavedBot;
          input.value = '';
        }
        if (label) {
          label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
          label.title = hasSavedBot ? 'Change avatar' : 'Save the bot first';
        }
        $('#removeDeepseekAiBotAvatar')?.classList.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
      }
    
      function fillDeepseekBotForm(bot = null) {
        const settings = deepseekBotState.settings || {};
        selectedDeepseekBotId = bot ? bot.id : null;
        $('#deepseekAiBotName').value = bot?.name || 'DeepSeek AI';
        $('#deepseekAiBotMention').value = bot?.mention || 'deepseek';
        $('#deepseekAiBotEnabled').checked = bot ? !!bot.enabled : true;
        setBotVisibilityToggle('deepseekAiBotVisibleToUsers', !!bot?.visible_to_users);
        $('#deepseekAiBotResponseModel').value = bot?.response_model || settings.deepseek_default_response_model || 'deepseek-chat';
        $('#deepseekAiBotSummaryModel').value = bot?.summary_model || settings.deepseek_default_summary_model || 'deepseek-chat';
        $('#deepseekAiBotTemperature').value = bot?.temperature ?? settings.deepseek_temperature ?? 0.3;
        $('#deepseekAiBotMaxTokens').value = bot?.max_tokens ?? settings.deepseek_max_tokens ?? 1000;
        $('#deepseekAiBotStyle').value = bot?.style || 'Helpful DeepSeek assistant for chat';
        $('#deepseekAiBotTone').value = bot?.tone || 'warm, concise, attentive';
        $('#deepseekAiBotRules').value = bot?.behavior_rules || '';
        $('#deepseekAiBotSpeech').value = bot?.speech_patterns || '';
        renderDeepseekBotAvatar(bot);
        renderDeepseekModelOptions(bot);
        renderDeepseekBotList();
        renderDeepseekChatBotSettings();
      }
    
      function deepseekBotFormPayload() {
        return {
          name: $('#deepseekAiBotName')?.value.trim(),
          mention: $('#deepseekAiBotMention')?.value.trim(),
          enabled: $('#deepseekAiBotEnabled')?.checked,
          visible_to_users: getBotVisibilityToggle('deepseekAiBotVisibleToUsers'),
          response_model: $('#deepseekAiBotResponseModel')?.value.trim(),
          summary_model: $('#deepseekAiBotSummaryModel')?.value.trim(),
          temperature: Number($('#deepseekAiBotTemperature')?.value || 0.3),
          max_tokens: Number($('#deepseekAiBotMaxTokens')?.value || 1000),
          style: $('#deepseekAiBotStyle')?.value.trim(),
          tone: $('#deepseekAiBotTone')?.value.trim(),
          behavior_rules: $('#deepseekAiBotRules')?.value.trim(),
          speech_patterns: $('#deepseekAiBotSpeech')?.value.trim(),
        };
      }
    
      function renderDeepseekBotList() {
        const list = $('#deepseekAiBotList');
        if (!list) return;
        if (!deepseekBotState.bots.length) {
          list.innerHTML = '<div class="ai-bot-empty">No DeepSeek bots yet. Create the first one.</div>';
          return;
        }
        list.innerHTML = deepseekBotState.bots.map(bot => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedDeepseekBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
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
    
      function renderDeepseekChatBotSettings() {
        const chatSelect = $('#deepseekAiBotChatSelect');
        const botSelect = $('#deepseekAiBotChatBotSelect');
        if (!chatSelect || !botSelect) return;
        const currentChatValue = chatSelect.value || String(currentChatId || deepseekBotState.chats[0]?.id || '');
        const currentBotValue = botSelect.value || String(selectedDeepseekBotId || deepseekBotState.bots[0]?.id || '');
    
        chatSelect.innerHTML = deepseekBotState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
        botSelect.innerHTML = deepseekBotState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
        if (deepseekBotState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
        if (deepseekBotState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
        if (!botSelect.value && deepseekBotState.bots[0]) botSelect.value = String(deepseekBotState.bots[0].id);
    
        const setting = getDeepseekChatSetting(chatSelect.value, botSelect.value);
        $('#deepseekAiBotChatEnabled').checked = !!setting?.enabled;
        $('#deepseekAiBotChatMode').value = 'simple';
        $('#deepseekAiBotChatHotLimit').value = setting?.hot_context_limit || 50;
        $('#deepseekAiBotChatAutoReact').checked = !!setting?.auto_react_on_mention;
      }
    
      function renderDeepseekAiSettings() {
        const settings = deepseekBotState.settings || {};
        $('#deepseekAiGlobalEnabled').checked = !!settings.deepseek_enabled;
        $('#deepseekAiInteractiveEnabled').checked = !!settings.deepseek_interactive_enabled;
        $('#deepseekAiBaseUrl').value = settings.deepseek_base_url || 'https://api.deepseek.com';
        $('#deepseekAiTemperature').value = settings.deepseek_temperature ?? 0.3;
        $('#deepseekAiMaxTokens').value = settings.deepseek_max_tokens ?? 1000;
        $('#deepseekAiRequestTimeoutSeconds').value = Math.round(Number(settings.deepseek_request_timeout_ms || 600000) / 1000);
        $('#deepseekAiApiKey').value = '';
        $('#deepseekAiKeyStatus').textContent = settings.has_deepseek_key
          ? `Key saved: ${settings.masked_deepseek_key || '***'}`
          : 'Key is not saved';
        renderDeepseekModelOptions(currentDeepseekBot());
        $('#deepseekAiDefaultResponseModel').value = settings.deepseek_default_response_model || 'deepseek-chat';
        $('#deepseekAiDefaultSummaryModel').value = settings.deepseek_default_summary_model || 'deepseek-chat';
        const selected = currentDeepseekBot() || deepseekBotState.bots[0] || null;
        fillDeepseekBotForm(selected);
        renderDeepseekChatBotSettings();
        const models = deepseekBotState.models || {};
        if (models.error) {
          setDeepseekAiModelStatus(`Model list fallback is used: ${formatUiErrorMessage(models.error, 'Could not load DeepSeek models')}`, 'error');
        } else if (models.source === 'live') {
          setDeepseekAiModelStatus(`Loaded ${models.response?.length || 0} DeepSeek models for selectors.`, 'success');
        } else {
          setDeepseekAiModelStatus('Saved defaults are shown. Use "Refresh models" or "Test key" to load live DeepSeek models.');
        }
      }
    
      function deepseekAiSettingsPayload() {
        const body = {
          deepseek_enabled: $('#deepseekAiGlobalEnabled')?.checked,
          deepseek_interactive_enabled: $('#deepseekAiInteractiveEnabled')?.checked,
          deepseek_base_url: $('#deepseekAiBaseUrl')?.value.trim(),
          deepseek_default_response_model: $('#deepseekAiDefaultResponseModel')?.value.trim(),
          deepseek_default_summary_model: $('#deepseekAiDefaultSummaryModel')?.value.trim(),
          deepseek_temperature: Number($('#deepseekAiTemperature')?.value || 0.3),
          deepseek_max_tokens: Number($('#deepseekAiMaxTokens')?.value || 1000),
          deepseek_request_timeout_ms: Number($('#deepseekAiRequestTimeoutSeconds')?.value || 600) * 1000,
        };
        const key = $('#deepseekAiApiKey')?.value.trim();
        if (key) body.deepseek_api_key = key;
        return body;
      }
    
      async function persistDeepseekAiSettings() {
        const data = await api('/api/admin/deepseek-ai-bots/settings', {
          method: 'PUT',
          body: deepseekAiSettingsPayload(),
        });
        mergeDeepseekAiState(data);
        return data;
      }
    
      async function loadDeepseekAiState() {
        const data = await api('/api/admin/deepseek-ai-bots');
        mergeDeepseekAiState(data);
        renderDeepseekAiSettings();
      }
    
      async function saveDeepseekAiSettings() {
        setDeepseekAiProviderStatus('Saving...', 'pending');
        try {
          await persistDeepseekAiSettings();
          renderDeepseekAiSettings();
          setDeepseekAiProviderStatus(`Settings saved\n${providerInteractiveSummary('deepseek', deepseekBotState.settings)}`, 'success');
        } catch (e) {
          setDeepseekAiProviderStatus(e.message || 'Could not save settings', 'error');
        }
      }
    
      async function testDeepseekAiConnection() {
        const keyInput = $('#deepseekAiApiKey');
        const hasKey = Boolean(keyInput?.value.trim() || deepseekBotState.settings?.has_deepseek_key);
        if (!hasKey) {
          setDeepseekAiProviderStatus('Enter DeepSeek API key before testing.', 'error');
          keyInput?.focus();
          return;
        }
        setDeepseekAiProviderStatus('Checking DeepSeek connection...', 'pending');
        try {
          const data = await api('/api/admin/deepseek-ai-bots/test-connection', {
            method: 'POST',
            body: deepseekAiSettingsPayload(),
          });
          await persistDeepseekAiSettings();
          if (data.state?.models) mergeDeepseekAiState({ state: { models: data.state.models } });
          renderDeepseekAiSettings();
          const text = String(data.result?.text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
          setDeepseekAiProviderStatus(`Key verified (${data.result?.latencyMs || 0} ms). ${text}`, 'success');
        } catch (e) {
          setDeepseekAiProviderStatus(formatUiErrorMessage(e, 'Could not check DeepSeek key'), 'error');
        }
      }
    
      function formatDeepseekBalanceValue(value) {
        const text = String(value ?? '').trim();
        return text || '0.00';
      }
    
      function formatDeepseekBalanceResult(balance = {}) {
        const latency = Number(balance.latencyMs);
        const latencyText = Number.isFinite(latency) ? ` (${Math.round(latency)} ms)` : '';
        const availability = balance.is_available ? 'API calls available' : 'API calls unavailable';
        const rows = Array.isArray(balance.balance_infos) ? balance.balance_infos : [];
        const balanceLines = rows.length
          ? rows.map((row) => {
            const currency = String(row?.currency || 'Unknown').trim() || 'Unknown';
            return `${currency}: total ${formatDeepseekBalanceValue(row?.total_balance)}, granted ${formatDeepseekBalanceValue(row?.granted_balance)}, topped up ${formatDeepseekBalanceValue(row?.topped_up_balance)}`;
          })
          : ['No balance entries returned.'];
        return `${availability}${latencyText}\n${balanceLines.join('\n')}`;
      }
    
      async function checkDeepseekAiBalance() {
        const keyInput = $('#deepseekAiApiKey');
        const hasKey = Boolean(keyInput?.value.trim() || deepseekBotState.settings?.has_deepseek_key);
        if (!hasKey) {
          setDeepseekAiBalanceStatus('Enter or save DeepSeek API key before checking balance.', 'error');
          keyInput?.focus();
          return;
        }
        setDeepseekAiBalanceStatus('Checking DeepSeek balance...', 'pending');
        try {
          const data = await api('/api/admin/deepseek-ai-bots/balance', {
            method: 'POST',
            body: deepseekAiSettingsPayload(),
          });
          setDeepseekAiBalanceStatus(
            formatDeepseekBalanceResult(data.balance || {}),
            data.balance?.is_available ? 'success' : 'error'
          );
        } catch (e) {
          setDeepseekAiBalanceStatus(formatUiErrorMessage(e, 'Could not load DeepSeek balance'), 'error');
        }
      }
    
      async function refreshDeepseekAiModels() {
        const keyInput = $('#deepseekAiApiKey');
        const hasKey = Boolean(keyInput?.value.trim() || deepseekBotState.settings?.has_deepseek_key);
        if (!hasKey) {
          setDeepseekAiProviderStatus('Enter or save DeepSeek API key before loading models.', 'error');
          keyInput?.focus();
          return;
        }
        setDeepseekAiProviderStatus('Loading DeepSeek models...', 'pending');
        try {
          const data = await api('/api/admin/deepseek-ai-bots/models/refresh', {
            method: 'POST',
            body: deepseekAiSettingsPayload(),
          });
          mergeDeepseekAiState(data);
          renderDeepseekAiSettings();
          setDeepseekAiProviderStatus(`Models refreshed: ${deepseekBotState.models?.response?.length || 0}.`, 'success');
        } catch (e) {
          setDeepseekAiProviderStatus(formatUiErrorMessage(e, 'Could not load DeepSeek models'), 'error');
        }
      }
    
      async function deleteDeepseekAiKey() {
        if (!confirm('Delete DeepSeek API key for AI bots?')) return;
        try {
          const data = await api('/api/admin/deepseek-ai-bots/key', { method: 'DELETE' });
          mergeDeepseekAiState(data);
          renderDeepseekAiSettings();
          setDeepseekAiProviderStatus('Key deleted', 'success');
        } catch (e) {
          setDeepseekAiProviderStatus(e.message || 'Could not delete key', 'error');
        }
      }
    
      async function saveDeepseekBot() {
        const payload = deepseekBotFormPayload();
        if (!payload.name) { setDeepseekBotStatus('Enter bot name', 'error'); return; }
        setDeepseekBotStatus('Saving bot...', 'pending');
        try {
          await persistDeepseekAiSettings();
          const shouldUpdate = Boolean(selectedDeepseekBotId && deepseekBotState.bots.some(bot => Number(bot.id) === Number(selectedDeepseekBotId)));
          const url = shouldUpdate ? `/api/admin/deepseek-ai-bots/${selectedDeepseekBotId}` : '/api/admin/deepseek-ai-bots';
          const method = shouldUpdate ? 'PUT' : 'POST';
          const data = await api(url, { method, body: payload });
          mergeDeepseekAiState(data);
          selectedDeepseekBotId = data.bot?.id || selectedDeepseekBotId;
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
          renderDeepseekAiSettings();
          const status = buildVerifiedBotSaveStatus('Bot saved.', data.bot, payload, formatCapabilityState(data.bot || payload));
          setDeepseekBotStatus(status.message, status.type);
        } catch (e) {
          setDeepseekBotStatus(e.message || 'Could not save bot', 'error');
        }
      }
    
      async function uploadDeepseekBotAvatar(file) {
        if (!file) return;
        if (!selectedDeepseekBotId) {
          setDeepseekBotStatus('Save the bot before adding an avatar', 'error');
          renderDeepseekBotAvatar(null);
          return;
        }
        const fd = new FormData();
        fd.append('avatar', file);
        setDeepseekBotStatus('Uploading avatar...', 'pending');
        try {
          const data = await api(`/api/admin/deepseek-ai-bots/${selectedDeepseekBotId}/avatar`, { method: 'POST', body: fd });
          mergeDeepseekAiState(data);
          selectedDeepseekBotId = data.bot?.id || selectedDeepseekBotId;
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
          renderDeepseekBotList();
          renderDeepseekBotAvatar(currentDeepseekBot());
          refreshRenderedAiBotAvatar(data.bot);
          renderDeepseekChatBotSettings();
          setDeepseekBotStatus('Avatar saved', 'success');
        } catch (e) {
          setDeepseekBotStatus(e.message || 'Could not upload avatar', 'error');
          renderDeepseekBotAvatar(currentDeepseekBot());
        }
      }
    
      async function removeDeepseekBotAvatar() {
        if (!selectedDeepseekBotId) return;
        try {
          const data = await api(`/api/admin/deepseek-ai-bots/${selectedDeepseekBotId}/avatar`, { method: 'DELETE' });
          mergeDeepseekAiState(data);
          selectedDeepseekBotId = data.bot?.id || selectedDeepseekBotId;
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
          renderDeepseekBotList();
          renderDeepseekBotAvatar(currentDeepseekBot());
          refreshRenderedAiBotAvatar(data.bot);
          renderDeepseekChatBotSettings();
          setDeepseekBotStatus('Avatar removed', 'success');
        } catch (e) {
          setDeepseekBotStatus(e.message || 'Could not remove avatar', 'error');
        }
      }
    
      async function disableDeepseekBot() {
        if (!selectedDeepseekBotId) return;
        if (!confirm('Disable this DeepSeek bot in all chats?')) return;
        try {
          const data = await api(`/api/admin/deepseek-ai-bots/${selectedDeepseekBotId}`, { method: 'DELETE' });
          mergeDeepseekAiState(data);
          renderDeepseekAiSettings();
          setDeepseekBotStatus('Bot disabled', 'success');
        } catch (e) {
          setDeepseekBotStatus(e.message || 'Could not disable bot', 'error');
        }
      }
    
      async function testDeepseekBot() {
        if (!selectedDeepseekBotId) { setDeepseekBotStatus('Save the bot first', 'error'); return; }
        setDeepseekBotStatus('Testing model...', 'pending');
        try {
          await persistDeepseekAiSettings();
          const data = await api(`/api/admin/deepseek-ai-bots/${selectedDeepseekBotId}/test`, { method: 'POST', body: {} });
          const text = data.result?.text ? data.result.text.slice(0, 500) : '';
          setDeepseekBotStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
        } catch (e) {
          setDeepseekBotStatus(e.message || 'Test failed', 'error');
        }
      }
    
      async function exportDeepseekBotJson() {
        if (!selectedDeepseekBotId) { setDeepseekBotStatus('Choose a saved bot first', 'error'); return; }
        setDeepseekBotStatus('Preparing JSON...', 'pending');
        try {
          const headers = {};
          if (token) headers.Authorization = 'Bearer ' + token;
          const res = await fetch(`/api/admin/deepseek-ai-bots/${selectedDeepseekBotId}/export`, { headers });
          if (!res.ok) {
            let data = {};
            try { data = await res.json(); } catch {}
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          const blob = await res.blob();
          const bot = currentDeepseekBot();
          const fallbackName = `bananza-deepseek-bot-${bot?.mention || selectedDeepseekBotId}.json`;
          const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          setDeepseekBotStatus('JSON exported', 'success');
        } catch (e) {
          setDeepseekBotStatus(e.message || 'Could not export JSON', 'error');
        }
      }
    
      async function importDeepseekBotJsonFile(file) {
        if (!file) return;
        setDeepseekBotStatus('Importing JSON...', 'pending');
        try {
          const raw = await file.text();
          const payload = JSON.parse(raw);
          const data = await api('/api/admin/deepseek-ai-bots/import', { method: 'POST', body: payload });
          mergeDeepseekAiState(data);
          selectedDeepseekBotId = data.bot?.id || selectedDeepseekBotId;
          renderDeepseekAiSettings();
          const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
          setDeepseekBotStatus(`Bot imported.${warnings}`, warnings ? 'error' : 'success');
        } catch (e) {
          setDeepseekBotStatus(e.message || 'Could not import JSON', 'error');
        } finally {
          const input = $('#deepseekAiBotImportFile');
          if (input) input.value = '';
        }
      }
    
      async function saveDeepseekChatBotSettings() {
        const chatId = Number($('#deepseekAiBotChatSelect')?.value || 0);
        const botId = Number($('#deepseekAiBotChatBotSelect')?.value || 0);
        const botExists = deepseekBotState.bots.some(bot => Number(bot.id) === botId);
        if (!chatId || !botId) { setDeepseekChatStatus('Choose chat and bot', 'error'); return; }
        if (!botExists) {
          setDeepseekChatStatus('Save the bot first', 'error');
          await loadDeepseekAiState().catch(() => {});
          return;
        }
        try {
          await persistDeepseekAiSettings();
          const data = await api('/api/admin/deepseek-ai-bots/chat-settings', {
            method: 'PUT',
            body: {
              chatId,
              botId,
              enabled: $('#deepseekAiBotChatEnabled')?.checked,
              mode: 'simple',
              hot_context_limit: Number($('#deepseekAiBotChatHotLimit')?.value || 50),
              auto_react_on_mention: $('#deepseekAiBotChatAutoReact')?.checked,
            },
          });
          mergeDeepseekAiState(data);
          renderDeepseekChatBotSettings();
          setDeepseekChatStatus('Chat settings saved', 'success');
        } catch (e) {
          setDeepseekChatStatus(e.message || 'Could not save chat settings', 'error');
        }
      }
    
      function setQwenAiStatus(message, type = '') {
        setInlineStatus('qwenAiStatus', message, type);
      }
    
      function setQwenAiProviderStatus(message, type = '') {
        setInlineStatus('qwenAiProviderStatus', message, type);
      }
    
      function setQwenBotStatus(message, type = '') {
        setInlineStatus('qwenAiBotEditorStatus', message, type);
      }
    
      function setQwenChatStatus(message, type = '') {
        setInlineStatus('qwenAiBotChatStatus', message, type);
      }
    
      function setQwenAiModelStatus(message, type = '') {
        setInlineStatus('qwenAiModelStatus', message, type);
      }
    
      function currentQwenBot() {
        return qwenBotState.bots.find(bot => Number(bot.id) === Number(selectedQwenBotId)) || null;
      }
    
      function getQwenChatSetting(chatId, botId) {
        return qwenBotState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
      }
    
      function mergeQwenAiState(data = {}) {
        const state = data.state || data;
        if (state.settings) qwenBotState.settings = { ...qwenBotState.settings, ...state.settings };
        if (state.bots) qwenBotState.bots = state.bots;
        if (state.chats) qwenBotState.chats = state.chats;
        if (state.chatSettings) qwenBotState.chatSettings = state.chatSettings;
        if (state.models) qwenBotState.models = { ...qwenBotState.models, ...state.models };
        if (selectedQwenBotId && !qwenBotState.bots.some(bot => Number(bot.id) === Number(selectedQwenBotId))) {
          selectedQwenBotId = null;
        }
        composerStateController.mentionTargetsByChat.clear();
      }
    
      function renderQwenModelOptions(bot = currentQwenBot()) {
        const settings = qwenBotState.settings || {};
        const models = qwenBotState.models || {};
        const responseModels = models.response || ['qwen'];
        const summaryModels = models.summary || responseModels;
        setAiModelSelectOptions('qwenAiDefaultResponseModel', responseModels, settings.qwen_default_response_model || 'qwen');
        setAiModelSelectOptions('qwenAiDefaultSummaryModel', summaryModels, settings.qwen_default_summary_model || 'qwen');
        setAiModelSelectOptions('qwenAiBotResponseModel', responseModels, bot?.response_model || settings.qwen_default_response_model || 'qwen');
        setAiModelSelectOptions('qwenAiBotSummaryModel', summaryModels, bot?.summary_model || settings.qwen_default_summary_model || 'qwen');
      }
    
      function renderQwenBotAvatar(bot = currentQwenBot()) {
        const avatarEl = $('#qwenAiBotAvatar');
        if (!avatarEl) return;
        const name = bot?.name || $('#qwenAiBotName')?.value.trim() || 'Qwen AI';
        const color = bot?.avatar_color || '#65aadd';
        avatarEl.style.background = color;
        if (bot?.avatar_url) {
          avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
        } else {
          avatarEl.textContent = initials(name);
        }
    
        const hasSavedBot = Boolean(bot?.id);
        const input = $('#qwenAiBotAvatarInput');
        const label = $('#qwenAiBotAvatarLabel');
        if (input) {
          input.disabled = !hasSavedBot;
          input.value = '';
        }
        if (label) {
          label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
          label.title = hasSavedBot ? 'Change avatar' : 'Save the bot first';
        }
        $('#removeQwenAiBotAvatar')?.classList.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
      }
    
      function fillQwenBotForm(bot = null) {
        const settings = qwenBotState.settings || {};
        selectedQwenBotId = bot ? bot.id : null;
        $('#qwenAiBotName').value = bot?.name || 'Qwen AI';
        $('#qwenAiBotMention').value = bot?.mention || 'qwen';
        $('#qwenAiBotEnabled').checked = bot ? !!bot.enabled : true;
        setBotVisibilityToggle('qwenAiBotVisibleToUsers', !!bot?.visible_to_users);
        $('#qwenAiBotResponseModel').value = bot?.response_model || settings.qwen_default_response_model || 'qwen';
        $('#qwenAiBotSummaryModel').value = bot?.summary_model || settings.qwen_default_summary_model || 'qwen';
        $('#qwenAiBotTemperature').value = bot?.temperature ?? settings.qwen_temperature ?? 0.3;
        $('#qwenAiBotMaxTokens').value = bot?.max_tokens ?? settings.qwen_max_tokens ?? 1000;
        $('#qwenAiBotStyle').value = bot?.style || 'Helpful Qwen assistant for chat';
        $('#qwenAiBotTone').value = bot?.tone || 'warm, concise, attentive';
        $('#qwenAiBotRules').value = bot?.behavior_rules || '';
        $('#qwenAiBotSpeech').value = bot?.speech_patterns || '';
        renderQwenBotAvatar(bot);
        renderQwenModelOptions(bot);
        renderQwenBotList();
        renderQwenChatBotSettings();
      }
    
      function qwenBotFormPayload() {
        return {
          name: $('#qwenAiBotName')?.value.trim(),
          mention: $('#qwenAiBotMention')?.value.trim(),
          enabled: $('#qwenAiBotEnabled')?.checked,
          visible_to_users: getBotVisibilityToggle('qwenAiBotVisibleToUsers'),
          response_model: $('#qwenAiBotResponseModel')?.value.trim(),
          summary_model: $('#qwenAiBotSummaryModel')?.value.trim(),
          temperature: Number($('#qwenAiBotTemperature')?.value || 0.3),
          max_tokens: Number($('#qwenAiBotMaxTokens')?.value || 1000),
          style: $('#qwenAiBotStyle')?.value.trim(),
          tone: $('#qwenAiBotTone')?.value.trim(),
          behavior_rules: $('#qwenAiBotRules')?.value.trim(),
          speech_patterns: $('#qwenAiBotSpeech')?.value.trim(),
        };
      }
    
      function renderQwenBotList() {
        const list = $('#qwenAiBotList');
        if (!list) return;
        if (!qwenBotState.bots.length) {
          list.innerHTML = '<div class="ai-bot-empty">No Qwen bots yet. Create the first one.</div>';
          return;
        }
        list.innerHTML = qwenBotState.bots.map(bot => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedQwenBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
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
    
      function renderQwenChatBotSettings() {
        const chatSelect = $('#qwenAiBotChatSelect');
        const botSelect = $('#qwenAiBotChatBotSelect');
        if (!chatSelect || !botSelect) return;
        const currentChatValue = chatSelect.value || String(currentChatId || qwenBotState.chats[0]?.id || '');
        const currentBotValue = botSelect.value || String(selectedQwenBotId || qwenBotState.bots[0]?.id || '');
    
        chatSelect.innerHTML = qwenBotState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
        botSelect.innerHTML = qwenBotState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
        if (qwenBotState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
        if (qwenBotState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
        if (!botSelect.value && qwenBotState.bots[0]) botSelect.value = String(qwenBotState.bots[0].id);
    
        const setting = getQwenChatSetting(chatSelect.value, botSelect.value);
        $('#qwenAiBotChatEnabled').checked = !!setting?.enabled;
        $('#qwenAiBotChatMode').value = 'simple';
        $('#qwenAiBotChatHotLimit').value = setting?.hot_context_limit || 50;
        $('#qwenAiBotChatAutoReact').checked = !!setting?.auto_react_on_mention;
      }
    
      function renderQwenAiSettings() {
        const settings = qwenBotState.settings || {};
        $('#qwenAiGlobalEnabled').checked = !!settings.qwen_enabled;
        $('#qwenAiInteractiveEnabled').checked = !!settings.qwen_interactive_enabled;
        $('#qwenAiBaseUrl').value = settings.qwen_base_url || 'http://127.0.0.1:8000/v1';
        $('#qwenAiTemperature').value = settings.qwen_temperature ?? 0.3;
        $('#qwenAiMaxTokens').value = settings.qwen_max_tokens ?? 1000;
        $('#qwenAiRequestTimeoutSeconds').value = Math.round(Number(settings.qwen_request_timeout_ms || 600000) / 1000);
        $('#qwenAiApiKey').value = '';
        $('#qwenAiKeyStatus').textContent = settings.has_qwen_key
          ? `Key saved: ${settings.masked_qwen_key || '***'}`
          : 'Key is not saved';
        renderQwenModelOptions(currentQwenBot());
        $('#qwenAiDefaultResponseModel').value = settings.qwen_default_response_model || 'qwen';
        $('#qwenAiDefaultSummaryModel').value = settings.qwen_default_summary_model || 'qwen';
        const selected = currentQwenBot() || qwenBotState.bots[0] || null;
        fillQwenBotForm(selected);
        renderQwenChatBotSettings();
        const models = qwenBotState.models || {};
        if (models.error) {
          setQwenAiModelStatus(`Model list fallback is used: ${formatUiErrorMessage(models.error, 'Could not load Qwen models')}`, 'error');
        } else if (models.source === 'live') {
          setQwenAiModelStatus(`Loaded ${models.response?.length || 0} Qwen models for selectors.`, 'success');
        } else {
          setQwenAiModelStatus('Saved defaults are shown. Use "Refresh models" or "Test key" to load live Qwen models.');
        }
      }
    
      function qwenAiSettingsPayload() {
        const body = {
          qwen_enabled: $('#qwenAiGlobalEnabled')?.checked,
          qwen_interactive_enabled: $('#qwenAiInteractiveEnabled')?.checked,
          qwen_base_url: $('#qwenAiBaseUrl')?.value.trim(),
          qwen_default_response_model: $('#qwenAiDefaultResponseModel')?.value.trim(),
          qwen_default_summary_model: $('#qwenAiDefaultSummaryModel')?.value.trim(),
          qwen_temperature: Number($('#qwenAiTemperature')?.value || 0.3),
          qwen_max_tokens: Number($('#qwenAiMaxTokens')?.value || 1000),
          qwen_request_timeout_ms: Number($('#qwenAiRequestTimeoutSeconds')?.value || 600) * 1000,
        };
        const key = $('#qwenAiApiKey')?.value.trim();
        if (key) body.qwen_api_key = key;
        return body;
      }
    
      async function persistQwenAiSettings() {
        const data = await api('/api/admin/qwen-ai-bots/settings', {
          method: 'PUT',
          body: qwenAiSettingsPayload(),
        });
        mergeQwenAiState(data);
        return data;
      }
    
      async function loadQwenAiState() {
        const data = await api('/api/admin/qwen-ai-bots');
        mergeQwenAiState(data);
        renderQwenAiSettings();
      }
    
      async function saveQwenAiSettings() {
        setQwenAiProviderStatus('Saving...', 'pending');
        try {
          await persistQwenAiSettings();
          renderQwenAiSettings();
          setQwenAiProviderStatus(`Settings saved\n${providerInteractiveSummary('qwen', qwenBotState.settings)}`, 'success');
        } catch (e) {
          setQwenAiProviderStatus(e.message || 'Could not save settings', 'error');
        }
      }
    
      async function testQwenAiConnection() {
        const keyInput = $('#qwenAiApiKey');
        const hasKey = Boolean(keyInput?.value.trim() || qwenBotState.settings?.has_qwen_key);
        if (!hasKey) {
          setQwenAiProviderStatus('Enter Qwen API key before testing.', 'error');
          keyInput?.focus();
          return;
        }
        setQwenAiProviderStatus('Checking Qwen connection...', 'pending');
        try {
          const data = await api('/api/admin/qwen-ai-bots/test-connection', {
            method: 'POST',
            body: qwenAiSettingsPayload(),
          });
          await persistQwenAiSettings();
          if (data.state?.models) mergeQwenAiState({ state: { models: data.state.models } });
          renderQwenAiSettings();
          const text = String(data.result?.text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
          setQwenAiProviderStatus(`Key verified (${data.result?.latencyMs || 0} ms). ${text}`, 'success');
        } catch (e) {
          setQwenAiProviderStatus(formatUiErrorMessage(e, 'Could not check Qwen key'), 'error');
        }
      }
    
      async function refreshQwenAiModels() {
        const keyInput = $('#qwenAiApiKey');
        const hasKey = Boolean(keyInput?.value.trim() || qwenBotState.settings?.has_qwen_key);
        if (!hasKey) {
          setQwenAiProviderStatus('Enter or save Qwen API key before loading models.', 'error');
          keyInput?.focus();
          return;
        }
        setQwenAiProviderStatus('Loading Qwen models...', 'pending');
        try {
          const data = await api('/api/admin/qwen-ai-bots/models/refresh', {
            method: 'POST',
            body: qwenAiSettingsPayload(),
          });
          mergeQwenAiState(data);
          renderQwenAiSettings();
          setQwenAiProviderStatus(`Models refreshed: ${qwenBotState.models?.response?.length || 0}.`, 'success');
        } catch (e) {
          setQwenAiProviderStatus(formatUiErrorMessage(e, 'Could not load Qwen models'), 'error');
        }
      }
    
      async function deleteQwenAiKey() {
        if (!confirm('Delete Qwen API key for AI bots?')) return;
        try {
          const data = await api('/api/admin/qwen-ai-bots/key', { method: 'DELETE' });
          mergeQwenAiState(data);
          renderQwenAiSettings();
          setQwenAiProviderStatus('Key deleted', 'success');
        } catch (e) {
          setQwenAiProviderStatus(e.message || 'Could not delete key', 'error');
        }
      }
    
      async function saveQwenBot() {
        const payload = qwenBotFormPayload();
        if (!payload.name) { setQwenBotStatus('Enter bot name', 'error'); return; }
        setQwenBotStatus('Saving bot...', 'pending');
        try {
          await persistQwenAiSettings();
          const shouldUpdate = Boolean(selectedQwenBotId && qwenBotState.bots.some(bot => Number(bot.id) === Number(selectedQwenBotId)));
          const url = shouldUpdate ? `/api/admin/qwen-ai-bots/${selectedQwenBotId}` : '/api/admin/qwen-ai-bots';
          const method = shouldUpdate ? 'PUT' : 'POST';
          const data = await api(url, { method, body: payload });
          mergeQwenAiState(data);
          selectedQwenBotId = data.bot?.id || selectedQwenBotId;
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
          renderQwenAiSettings();
          const status = buildVerifiedBotSaveStatus('Bot saved.', data.bot, payload, formatCapabilityState(data.bot || payload));
          setQwenBotStatus(status.message, status.type);
        } catch (e) {
          setQwenBotStatus(e.message || 'Could not save bot', 'error');
        }
      }
    
      async function uploadQwenBotAvatar(file) {
        if (!file) return;
        if (!selectedQwenBotId) {
          setQwenBotStatus('Save the bot before adding an avatar', 'error');
          renderQwenBotAvatar(null);
          return;
        }
        const fd = new FormData();
        fd.append('avatar', file);
        setQwenBotStatus('Uploading avatar...', 'pending');
        try {
          const data = await api(`/api/admin/qwen-ai-bots/${selectedQwenBotId}/avatar`, { method: 'POST', body: fd });
          mergeQwenAiState(data);
          selectedQwenBotId = data.bot?.id || selectedQwenBotId;
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
          renderQwenBotList();
          renderQwenBotAvatar(currentQwenBot());
          refreshRenderedAiBotAvatar(data.bot);
          renderQwenChatBotSettings();
          setQwenBotStatus('Avatar saved', 'success');
        } catch (e) {
          setQwenBotStatus(e.message || 'Could not upload avatar', 'error');
          renderQwenBotAvatar(currentQwenBot());
        }
      }
    
      async function removeQwenBotAvatar() {
        if (!selectedQwenBotId) return;
        try {
          const data = await api(`/api/admin/qwen-ai-bots/${selectedQwenBotId}/avatar`, { method: 'DELETE' });
          mergeQwenAiState(data);
          selectedQwenBotId = data.bot?.id || selectedQwenBotId;
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
          renderQwenBotList();
          renderQwenBotAvatar(currentQwenBot());
          refreshRenderedAiBotAvatar(data.bot);
          renderQwenChatBotSettings();
          setQwenBotStatus('Avatar removed', 'success');
        } catch (e) {
          setQwenBotStatus(e.message || 'Could not remove avatar', 'error');
        }
      }
    
      async function disableQwenBot() {
        if (!selectedQwenBotId) return;
        if (!confirm('Disable this Qwen bot in all chats?')) return;
        try {
          const data = await api(`/api/admin/qwen-ai-bots/${selectedQwenBotId}`, { method: 'DELETE' });
          mergeQwenAiState(data);
          renderQwenAiSettings();
          setQwenBotStatus('Bot disabled', 'success');
        } catch (e) {
          setQwenBotStatus(e.message || 'Could not disable bot', 'error');
        }
      }
    
      async function testQwenBot() {
        if (!selectedQwenBotId) { setQwenBotStatus('Save the bot first', 'error'); return; }
        setQwenBotStatus('Testing model...', 'pending');
        try {
          await persistQwenAiSettings();
          const data = await api(`/api/admin/qwen-ai-bots/${selectedQwenBotId}/test`, { method: 'POST', body: {} });
          const text = data.result?.text ? data.result.text.slice(0, 500) : '';
          setQwenBotStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
        } catch (e) {
          setQwenBotStatus(e.message || 'Test failed', 'error');
        }
      }
    
      async function exportQwenBotJson() {
        if (!selectedQwenBotId) { setQwenBotStatus('Choose a saved bot first', 'error'); return; }
        setQwenBotStatus('Preparing JSON...', 'pending');
        try {
          const headers = {};
          if (token) headers.Authorization = 'Bearer ' + token;
          const res = await fetch(`/api/admin/qwen-ai-bots/${selectedQwenBotId}/export`, { headers });
          if (!res.ok) {
            let data = {};
            try { data = await res.json(); } catch {}
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          const blob = await res.blob();
          const bot = currentQwenBot();
          const fallbackName = `bananza-qwen-bot-${bot?.mention || selectedQwenBotId}.json`;
          const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          setQwenBotStatus('JSON exported', 'success');
        } catch (e) {
          setQwenBotStatus(e.message || 'Could not export JSON', 'error');
        }
      }
    
      async function importQwenBotJsonFile(file) {
        if (!file) return;
        setQwenBotStatus('Importing JSON...', 'pending');
        try {
          const raw = await file.text();
          const payload = JSON.parse(raw);
          const data = await api('/api/admin/qwen-ai-bots/import', { method: 'POST', body: payload });
          mergeQwenAiState(data);
          selectedQwenBotId = data.bot?.id || selectedQwenBotId;
          renderQwenAiSettings();
          const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
          setQwenBotStatus(`Bot imported.${warnings}`, warnings ? 'error' : 'success');
        } catch (e) {
          setQwenBotStatus(e.message || 'Could not import JSON', 'error');
        } finally {
          const input = $('#qwenAiBotImportFile');
          if (input) input.value = '';
        }
      }
    
      async function saveQwenChatBotSettings() {
        const chatId = Number($('#qwenAiBotChatSelect')?.value || 0);
        const botId = Number($('#qwenAiBotChatBotSelect')?.value || 0);
        const botExists = qwenBotState.bots.some(bot => Number(bot.id) === botId);
        if (!chatId || !botId) { setQwenChatStatus('Choose chat and bot', 'error'); return; }
        if (!botExists) {
          setQwenChatStatus('Save the bot first', 'error');
          await loadQwenAiState().catch(() => {});
          return;
        }
        try {
          await persistQwenAiSettings();
          const data = await api('/api/admin/qwen-ai-bots/chat-settings', {
            method: 'PUT',
            body: {
              chatId,
              botId,
              enabled: $('#qwenAiBotChatEnabled')?.checked,
              mode: 'simple',
              hot_context_limit: Number($('#qwenAiBotChatHotLimit')?.value || 50),
              auto_react_on_mention: $('#qwenAiBotChatAutoReact')?.checked,
            },
          });
          mergeQwenAiState(data);
          renderQwenChatBotSettings();
          setQwenChatStatus('Chat settings saved', 'success');
        } catch (e) {
          setQwenChatStatus(e.message || 'Could not save chat settings', 'error');
        }
      }
    
      function setYandexAiStatus(message, type = '') {
        setInlineStatus('yandexAiStatus', message, type);
      }
    
      function setYandexAiProviderStatus(message, type = '') {
        setInlineStatus('yandexAiProviderStatus', message, type);
      }
    
      function setYandexBotStatus(message, type = '') {
        setInlineStatus('yandexAiBotEditorStatus', message, type);
      }
    
      function setYandexChatStatus(message, type = '') {
        setInlineStatus('yandexAiBotChatStatus', message, type);
      }
    
      function setYandexAiModelStatus(message, type = '') {
        setInlineStatus('yandexAiModelStatus', message, type);
      }
    
      function formatUiErrorMessage(value, fallback = 'Unexpected error') {
        if (value == null) return tx(fallback);
        if (typeof value === 'string') return tx(value.trim() || fallback);
        if (value instanceof Error) return formatUiErrorMessage(value.message, fallback);
        if (Array.isArray(value)) {
          const text = value.map((item) => formatUiErrorMessage(item, '')).filter(Boolean).join('; ');
          return tx(text || fallback);
        }
        if (typeof value === 'object') {
          const nested = formatUiErrorMessage(
            value.message
            || value.error?.message
            || value.error
            || value.details?.[0]?.message
            || value.type
            || value.error?.type
            || value.code
            || value.description
            || value.reason,
            ''
          );
          if (nested) return tx(nested);
          try {
            const text = JSON.stringify(value);
            return tx(text === '{}' ? fallback : text);
          } catch {
            return tx(fallback);
          }
        }
        return tx(String(value).trim() || fallback);
      }
    
      function currentYandexBot() {
        return yandexBotState.bots.find(bot => Number(bot.id) === Number(selectedYandexBotId)) || null;
      }
    
      function getYandexChatSetting(chatId, botId) {
        return yandexBotState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
      }
    
      function mergeYandexAiState(data = {}) {
        const state = data.state || data;
        if (state.settings) yandexBotState.settings = { ...yandexBotState.settings, ...state.settings };
        if (state.bots) yandexBotState.bots = state.bots;
        if (state.chats) yandexBotState.chats = state.chats;
        if (state.chatSettings) yandexBotState.chatSettings = state.chatSettings;
        if (state.models) yandexBotState.models = { ...yandexBotState.models, ...state.models };
        if (selectedYandexBotId && !yandexBotState.bots.some(bot => Number(bot.id) === Number(selectedYandexBotId))) {
          selectedYandexBotId = null;
        }
        composerStateController.mentionTargetsByChat.clear();
      }
    
      function renderYandexModelOptions(bot = currentYandexBot()) {
        const settings = yandexBotState.settings || {};
        const models = yandexBotState.models || {};
        const responseModels = models.response || ['yandexgpt/latest', 'yandexgpt-lite/latest'];
        const summaryModels = models.summary || ['yandexgpt-lite/latest', 'yandexgpt/latest'];
        setAiModelSelectOptions('yandexAiDefaultResponseModel', responseModels, settings.yandex_default_response_model || 'yandexgpt/latest');
        setAiModelSelectOptions('yandexAiDefaultSummaryModel', summaryModels, settings.yandex_default_summary_model || 'yandexgpt-lite/latest');
        setAiModelSelectOptions('yandexAiBotResponseModel', responseModels, bot?.response_model || settings.yandex_default_response_model || 'yandexgpt/latest');
        setAiModelSelectOptions('yandexAiBotSummaryModel', summaryModels, bot?.summary_model || settings.yandex_default_summary_model || 'yandexgpt-lite/latest');
      }
    
      function renderYandexBotAvatar(bot = currentYandexBot()) {
        const avatarEl = $('#yandexAiBotAvatar');
        if (!avatarEl) return;
        const name = bot?.name || $('#yandexAiBotName')?.value.trim() || 'Yandex AI';
        const color = bot?.avatar_color || '#65aadd';
        avatarEl.style.background = color;
        if (bot?.avatar_url) {
          avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
        } else {
          avatarEl.textContent = initials(name);
        }
    
        const hasSavedBot = Boolean(bot?.id);
        const input = $('#yandexAiBotAvatarInput');
        const label = $('#yandexAiBotAvatarLabel');
        if (input) {
          input.disabled = !hasSavedBot;
          input.value = '';
        }
        if (label) {
          label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
          label.title = hasSavedBot ? 'Change avatar' : 'Save the bot first';
        }
        $('#removeYandexAiBotAvatar')?.classList.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
      }
    
      function fillYandexBotForm(bot = null) {
        const settings = yandexBotState.settings || {};
        selectedYandexBotId = bot ? bot.id : null;
        $('#yandexAiBotName').value = bot?.name || 'Yandex AI';
        $('#yandexAiBotMention').value = bot?.mention || 'yandex';
        $('#yandexAiBotEnabled').checked = bot ? !!bot.enabled : true;
        setBotVisibilityToggle('yandexAiBotVisibleToUsers', !!bot?.visible_to_users);
        $('#yandexAiBotResponseModel').value = bot?.response_model || settings.yandex_default_response_model || 'yandexgpt/latest';
        $('#yandexAiBotSummaryModel').value = bot?.summary_model || settings.yandex_default_summary_model || 'yandexgpt-lite/latest';
        $('#yandexAiBotTemperature').value = bot?.temperature ?? settings.yandex_temperature ?? 0.3;
        $('#yandexAiBotMaxTokens').value = bot?.max_tokens ?? settings.yandex_max_tokens ?? 1000;
        $('#yandexAiBotStyle').value = bot?.style || 'Helpful Yandex AI assistant for chat';
        $('#yandexAiBotTone').value = bot?.tone || 'warm, concise, attentive';
        $('#yandexAiBotRules').value = bot?.behavior_rules || '';
        $('#yandexAiBotSpeech').value = bot?.speech_patterns || '';
        renderYandexBotAvatar(bot);
        renderYandexModelOptions(bot);
        renderYandexBotList();
        renderYandexChatBotSettings();
      }
    
      function yandexBotFormPayload() {
        return {
          name: $('#yandexAiBotName')?.value.trim(),
          mention: $('#yandexAiBotMention')?.value.trim(),
          enabled: $('#yandexAiBotEnabled')?.checked,
          visible_to_users: getBotVisibilityToggle('yandexAiBotVisibleToUsers'),
          response_model: $('#yandexAiBotResponseModel')?.value.trim(),
          summary_model: $('#yandexAiBotSummaryModel')?.value.trim(),
          temperature: Number($('#yandexAiBotTemperature')?.value || 0.3),
          max_tokens: Number($('#yandexAiBotMaxTokens')?.value || 1000),
          style: $('#yandexAiBotStyle')?.value.trim(),
          tone: $('#yandexAiBotTone')?.value.trim(),
          behavior_rules: $('#yandexAiBotRules')?.value.trim(),
          speech_patterns: $('#yandexAiBotSpeech')?.value.trim(),
        };
      }
    
      function renderYandexBotList() {
        const list = $('#yandexAiBotList');
        if (!list) return;
        if (!yandexBotState.bots.length) {
          list.innerHTML = '<div class="ai-bot-empty">No Yandex bots yet. Create the first one.</div>';
          return;
        }
        list.innerHTML = yandexBotState.bots.map(bot => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedYandexBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
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
    
      function renderYandexChatBotSettings() {
        const chatSelect = $('#yandexAiBotChatSelect');
        const botSelect = $('#yandexAiBotChatBotSelect');
        if (!chatSelect || !botSelect) return;
        const currentChatValue = chatSelect.value || String(currentChatId || yandexBotState.chats[0]?.id || '');
        const currentBotValue = botSelect.value || String(selectedYandexBotId || yandexBotState.bots[0]?.id || '');
    
        chatSelect.innerHTML = yandexBotState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
        botSelect.innerHTML = yandexBotState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
        if (yandexBotState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
        if (yandexBotState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
        if (!botSelect.value && yandexBotState.bots[0]) botSelect.value = String(yandexBotState.bots[0].id);
    
        const setting = getYandexChatSetting(chatSelect.value, botSelect.value);
        $('#yandexAiBotChatEnabled').checked = !!setting?.enabled;
        $('#yandexAiBotChatMode').value = setting?.mode || 'simple';
        $('#yandexAiBotChatHotLimit').value = setting?.hot_context_limit || 50;
        $('#yandexAiBotChatAutoReact').checked = !!setting?.auto_react_on_mention;
      }
    
      function renderYandexAiSettings() {
        const settings = yandexBotState.settings || {};
        $('#yandexAiGlobalEnabled').checked = !!settings.yandex_enabled;
        $('#yandexAiInteractiveEnabled').checked = !!settings.yandex_interactive_enabled;
        $('#yandexAiFolderId').value = settings.yandex_folder_id || '';
        $('#yandexAiBaseUrl').value = settings.yandex_base_url || 'https://llm.api.cloud.yandex.net/foundationModels/v1';
        $('#yandexAiDocEmbeddingModel').value = settings.yandex_default_embedding_doc_model || 'text-search-doc/latest';
        $('#yandexAiQueryEmbeddingModel').value = settings.yandex_default_embedding_query_model || 'text-search-query/latest';
        $('#yandexAiTemperature').value = settings.yandex_temperature ?? 0.3;
        $('#yandexAiSummaryTemperature').value = settings.yandex_summary_temperature ?? 0.2;
        $('#yandexAiMaxTokens').value = settings.yandex_max_tokens || 1000;
        $('#yandexAiReasoningMode').value = settings.yandex_reasoning_mode || 'DISABLED';
        $('#yandexAiDataLoggingEnabled').checked = !!settings.yandex_data_logging_enabled;
        $('#yandexAiApiKey').value = '';
        $('#yandexAiKeyStatus').textContent = settings.has_yandex_key
          ? `Key saved: ${settings.masked_yandex_key || '***'}`
          : 'Key is not saved';
        renderYandexModelOptions(currentYandexBot());
        $('#yandexAiDefaultResponseModel').value = settings.yandex_default_response_model || 'yandexgpt/latest';
        $('#yandexAiDefaultSummaryModel').value = settings.yandex_default_summary_model || 'yandexgpt-lite/latest';
        const selected = currentYandexBot() || yandexBotState.bots[0] || null;
        fillYandexBotForm(selected);
        renderYandexChatBotSettings();
        const models = yandexBotState.models || {};
        if (models.error) {
          setYandexAiModelStatus(`Model list fallback is used: ${formatUiErrorMessage(models.error, 'Could not load Yandex models')}`, 'error');
        } else if (models.source === 'live') {
          setYandexAiModelStatus(`Loaded ${models.response?.length || 0} Yandex models for selectors.`, 'success');
        } else {
          setYandexAiModelStatus(settings.yandex_folder_id ? 'Static model fallback is shown. Press "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u043c\u043e\u0434\u0435\u043b\u0438" or "\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u043a\u043b\u044e\u0447" to load account models.' : '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u0434\u0435\u043d\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u043e\u0440 \u043a\u0430\u0442\u0430\u043b\u043e\u0433\u0430 \u0432 \u043f\u043e\u043b\u0435 Folder ID \u0432\u044b\u0448\u0435 \u043f\u0435\u0440\u0435\u0434 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u043e\u0439.');
        }
      }
    
      function yandexAiSettingsPayload() {
        const body = {
          yandex_enabled: $('#yandexAiGlobalEnabled')?.checked,
          yandex_interactive_enabled: $('#yandexAiInteractiveEnabled')?.checked,
          yandex_folder_id: $('#yandexAiFolderId')?.value.trim(),
          yandex_base_url: $('#yandexAiBaseUrl')?.value.trim(),
          yandex_default_response_model: $('#yandexAiDefaultResponseModel')?.value.trim(),
          yandex_default_summary_model: $('#yandexAiDefaultSummaryModel')?.value.trim(),
          yandex_default_embedding_doc_model: $('#yandexAiDocEmbeddingModel')?.value.trim(),
          yandex_default_embedding_query_model: $('#yandexAiQueryEmbeddingModel')?.value.trim(),
          yandex_temperature: Number($('#yandexAiTemperature')?.value || 0.3),
          yandex_summary_temperature: Number($('#yandexAiSummaryTemperature')?.value || 0.2),
          yandex_max_tokens: Number($('#yandexAiMaxTokens')?.value || 1000),
          yandex_reasoning_mode: $('#yandexAiReasoningMode')?.value || 'DISABLED',
          yandex_data_logging_enabled: $('#yandexAiDataLoggingEnabled')?.checked,
        };
        const key = $('#yandexAiApiKey')?.value.trim();
        if (key) body.yandex_api_key = key;
        return body;
      }
    
      async function persistYandexAiSettings() {
        const data = await api('/api/admin/yandex-ai-bots/settings', {
          method: 'PUT',
          body: yandexAiSettingsPayload(),
        });
        mergeYandexAiState(data);
        return data;
      }
    
      async function loadYandexAiState() {
        const data = await api('/api/admin/yandex-ai-bots');
        mergeYandexAiState(data);
        renderYandexAiSettings();
      }
    
      async function saveYandexAiSettings() {
        setYandexAiProviderStatus('Saving...', 'pending');
        try {
          await persistYandexAiSettings();
          renderYandexAiSettings();
          setYandexAiProviderStatus(`Settings saved\n${providerInteractiveSummary('yandex', yandexBotState.settings)}`, 'success');
        } catch (e) {
          setYandexAiProviderStatus(e.message || 'Could not save settings', 'error');
        }
      }
    
      async function testYandexAiConnection() {
        const folderInput = $('#yandexAiFolderId');
        const keyInput = $('#yandexAiApiKey');
        const folderId = folderInput?.value.trim();
        const hasKey = Boolean(keyInput?.value.trim() || yandexBotState.settings?.has_yandex_key);
        if (!folderId) {
          setYandexAiProviderStatus('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u0434\u0435\u043d\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u043e\u0440 \u043a\u0430\u0442\u0430\u043b\u043e\u0433\u0430 Yandex Cloud \u0432 \u043f\u043e\u043b\u0435 Folder ID.', 'error');
          setYandexAiModelStatus('Folder ID \u043d\u0443\u0436\u0435\u043d \u0434\u043b\u044f modelUri: gpt://<folder_ID>/yandexgpt/latest.', 'error');
          folderInput?.focus();
          return;
        }
        if (!hasKey) {
          setYandexAiProviderStatus('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 Yandex API key \u043f\u0435\u0440\u0435\u0434 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u043e\u0439.', 'error');
          keyInput?.focus();
          return;
        }
    
        setYandexAiProviderStatus('Checking Yandex connection...', 'pending');
        try {
          const data = await api('/api/admin/yandex-ai-bots/test-connection', {
            method: 'POST',
            body: yandexAiSettingsPayload(),
          });
          await persistYandexAiSettings();
          if (data.state?.models) mergeYandexAiState({ state: { models: data.state.models } });
          renderYandexAiSettings();
          const text = String(data.result?.text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
          const latency = data.result?.latencyMs || 0;
          const models = yandexBotState.models || {};
          const modelNote = models.source === 'live' ? ` \u041c\u043e\u0434\u0435\u043b\u0435\u0439 \u0432 \u0441\u0435\u043b\u0435\u043a\u0442\u043e\u0440\u0435: ${models.response?.length || 0}.` : '';
          setYandexAiProviderStatus(`\u041a\u043b\u044e\u0447 \u043f\u0440\u043e\u0432\u0435\u0440\u0435\u043d \u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d (${latency} ms). ${text}${modelNote}`, 'success');
          setYandexAiModelStatus(
            models.error
              ? `Key OK. Model list fallback is used: ${formatUiErrorMessage(models.error, 'Could not load Yandex models')}`
              : `OK: ${data.result?.model || 'Yandex model'}`,
            models.error ? 'error' : 'success'
          );
        } catch (e) {
          setYandexAiProviderStatus(formatUiErrorMessage(e, 'Could not check Yandex key'), 'error');
        }
      }
    
      async function refreshYandexAiModels() {
        const folderInput = $('#yandexAiFolderId');
        const keyInput = $('#yandexAiApiKey');
        const folderId = folderInput?.value.trim();
        const hasKey = Boolean(keyInput?.value.trim() || yandexBotState.settings?.has_yandex_key);
        if (!folderId) {
          setYandexAiProviderStatus('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u0434\u0435\u043d\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u043e\u0440 \u043a\u0430\u0442\u0430\u043b\u043e\u0433\u0430 Yandex Cloud \u0432 \u043f\u043e\u043b\u0435 Folder ID.', 'error');
          folderInput?.focus();
          return;
        }
        if (!hasKey) {
          setYandexAiProviderStatus('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043b\u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 Yandex API key \u043f\u0435\u0440\u0435\u0434 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u043e\u0439 \u043c\u043e\u0434\u0435\u043b\u0435\u0439.', 'error');
          keyInput?.focus();
          return;
        }
    
        setYandexAiProviderStatus('Loading Yandex models...', 'pending');
        try {
          const data = await api('/api/admin/yandex-ai-bots/models/refresh', {
            method: 'POST',
            body: yandexAiSettingsPayload(),
          });
          mergeYandexAiState(data);
          renderYandexAiSettings();
          setYandexAiProviderStatus(`\u041c\u043e\u0434\u0435\u043b\u0438 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b: ${yandexBotState.models?.response?.length || 0} \u0432 \u0441\u0435\u043b\u0435\u043a\u0442\u043e\u0440\u0435.`, 'success');
        } catch (e) {
          setYandexAiProviderStatus(formatUiErrorMessage(e, 'Could not load Yandex models'), 'error');
        }
      }
    
      async function deleteYandexAiKey() {
        if (!confirm('Delete Yandex API key for AI bots?')) return;
        try {
          const data = await api('/api/admin/yandex-ai-bots/key', { method: 'DELETE' });
          mergeYandexAiState(data);
          renderYandexAiSettings();
          setYandexAiProviderStatus('Key deleted', 'success');
        } catch (e) {
          setYandexAiProviderStatus(e.message || 'Could not delete key', 'error');
        }
      }
    
      async function saveYandexBot() {
        const payload = yandexBotFormPayload();
        if (!payload.name) { setYandexBotStatus('Enter bot name', 'error'); return; }
        setYandexBotStatus('Saving bot...', 'pending');
        try {
          await persistYandexAiSettings();
          const shouldUpdate = Boolean(selectedYandexBotId && yandexBotState.bots.some(bot => Number(bot.id) === Number(selectedYandexBotId)));
          const url = shouldUpdate ? `/api/admin/yandex-ai-bots/${selectedYandexBotId}` : '/api/admin/yandex-ai-bots';
          const method = shouldUpdate ? 'PUT' : 'POST';
          const data = await api(url, { method, body: payload });
          mergeYandexAiState(data);
          selectedYandexBotId = data.bot?.id || selectedYandexBotId;
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
          renderYandexAiSettings();
          const status = buildVerifiedBotSaveStatus('Bot saved.', data.bot, payload, formatCapabilityState(data.bot || payload));
          setYandexBotStatus(status.message, status.type);
        } catch (e) {
          setYandexBotStatus(e.message || 'Could not save bot', 'error');
        }
      }
    
      async function uploadYandexBotAvatar(file) {
        if (!file) return;
        if (!selectedYandexBotId) {
          setYandexBotStatus('Save the bot before adding an avatar', 'error');
          renderYandexBotAvatar(null);
          return;
        }
        const fd = new FormData();
        fd.append('avatar', file);
        setYandexBotStatus('Uploading avatar...', 'pending');
        try {
          const data = await api(`/api/admin/yandex-ai-bots/${selectedYandexBotId}/avatar`, { method: 'POST', body: fd });
          mergeYandexAiState(data);
          selectedYandexBotId = data.bot?.id || selectedYandexBotId;
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
          renderYandexBotList();
          renderYandexBotAvatar(currentYandexBot());
          refreshRenderedAiBotAvatar(data.bot);
          renderYandexChatBotSettings();
          setYandexBotStatus('Avatar saved', 'success');
        } catch (e) {
          setYandexBotStatus(e.message || 'Could not upload avatar', 'error');
          renderYandexBotAvatar(currentYandexBot());
        }
      }
    
      async function removeYandexBotAvatar() {
        if (!selectedYandexBotId) return;
        try {
          const data = await api(`/api/admin/yandex-ai-bots/${selectedYandexBotId}/avatar`, { method: 'DELETE' });
          mergeYandexAiState(data);
          selectedYandexBotId = data.bot?.id || selectedYandexBotId;
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
          renderYandexBotList();
          renderYandexBotAvatar(currentYandexBot());
          refreshRenderedAiBotAvatar(data.bot);
          renderYandexChatBotSettings();
          setYandexBotStatus('Avatar removed', 'success');
        } catch (e) {
          setYandexBotStatus(e.message || 'Could not remove avatar', 'error');
        }
      }
    
      async function disableYandexBot() {
        if (!selectedYandexBotId) return;
        if (!confirm('Disable this Yandex bot in all chats?')) return;
        try {
          const data = await api(`/api/admin/yandex-ai-bots/${selectedYandexBotId}`, { method: 'DELETE' });
          mergeYandexAiState(data);
          renderYandexAiSettings();
          setYandexBotStatus('Bot disabled', 'success');
        } catch (e) {
          setYandexBotStatus(e.message || 'Could not disable bot', 'error');
        }
      }
    
      async function testYandexBot() {
        if (!selectedYandexBotId) { setYandexBotStatus('Save the bot first', 'error'); return; }
        setYandexBotStatus('Testing model...', 'pending');
        try {
          await persistYandexAiSettings();
          const data = await api(`/api/admin/yandex-ai-bots/${selectedYandexBotId}/test`, { method: 'POST', body: {} });
          const text = data.result?.text ? data.result.text.slice(0, 500) : '';
          setYandexBotStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
        } catch (e) {
          setYandexBotStatus(e.message || 'Test failed', 'error');
        }
      }
    
      async function exportYandexBotJson() {
        if (!selectedYandexBotId) { setYandexBotStatus('Choose a saved bot first', 'error'); return; }
        setYandexBotStatus('Preparing JSON...', 'pending');
        try {
          const headers = {};
          if (token) headers.Authorization = 'Bearer ' + token;
          const res = await fetch(`/api/admin/yandex-ai-bots/${selectedYandexBotId}/export`, { headers });
          if (!res.ok) {
            let data = {};
            try { data = await res.json(); } catch {}
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          const blob = await res.blob();
          const bot = currentYandexBot();
          const fallbackName = `bananza-yandex-bot-${bot?.mention || selectedYandexBotId}.json`;
          const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          setYandexBotStatus('JSON exported', 'success');
        } catch (e) {
          setYandexBotStatus(e.message || 'Could not export JSON', 'error');
        }
      }
    
      async function importYandexBotJsonFile(file) {
        if (!file) return;
        setYandexBotStatus('Importing JSON...', 'pending');
        try {
          const raw = await file.text();
          const payload = JSON.parse(raw);
          const data = await api('/api/admin/yandex-ai-bots/import', { method: 'POST', body: payload });
          mergeYandexAiState(data);
          selectedYandexBotId = data.bot?.id || selectedYandexBotId;
          renderYandexAiSettings();
          const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
          setYandexBotStatus(`Bot imported.${warnings}`, warnings ? 'error' : 'success');
        } catch (e) {
          setYandexBotStatus(e.message || 'Could not import JSON', 'error');
        } finally {
          const input = $('#yandexAiBotImportFile');
          if (input) input.value = '';
        }
      }
    
      async function saveYandexChatBotSettings() {
        const chatId = Number($('#yandexAiBotChatSelect')?.value || 0);
        const botId = Number($('#yandexAiBotChatBotSelect')?.value || 0);
        const botExists = yandexBotState.bots.some(bot => Number(bot.id) === botId);
        if (!chatId || !botId) { setYandexChatStatus('Choose chat and bot', 'error'); return; }
        if (!botExists) {
          setYandexChatStatus('Save the bot first', 'error');
          await loadYandexAiState().catch(() => {});
          return;
        }
        try {
          await persistYandexAiSettings();
          const data = await api('/api/admin/yandex-ai-bots/chat-settings', {
            method: 'PUT',
            body: {
              chatId,
              botId,
              enabled: $('#yandexAiBotChatEnabled')?.checked,
              mode: $('#yandexAiBotChatMode')?.value || 'simple',
              hot_context_limit: Number($('#yandexAiBotChatHotLimit')?.value || 50),
              auto_react_on_mention: $('#yandexAiBotChatAutoReact')?.checked,
            },
          });
          mergeYandexAiState(data);
          renderYandexChatBotSettings();
          setYandexChatStatus('Chat settings saved', 'success');
        } catch (e) {
          setYandexChatStatus(e.message || 'Could not save chat settings', 'error');
        }
      }
    

      return {
        setDeepseekAiStatus, setDeepseekAiProviderStatus, setDeepseekAiBalanceStatus, setDeepseekBotStatus, setDeepseekChatStatus, setDeepseekAiModelStatus, currentDeepseekBot, getDeepseekChatSetting,
        mergeDeepseekAiState, renderDeepseekModelOptions, renderDeepseekBotAvatar, fillDeepseekBotForm, deepseekBotFormPayload, renderDeepseekBotList, renderDeepseekChatBotSettings, renderDeepseekAiSettings,
        deepseekAiSettingsPayload, persistDeepseekAiSettings, loadDeepseekAiState, saveDeepseekAiSettings, testDeepseekAiConnection, formatDeepseekBalanceValue, formatDeepseekBalanceResult, checkDeepseekAiBalance,
        refreshDeepseekAiModels, deleteDeepseekAiKey, saveDeepseekBot, uploadDeepseekBotAvatar, removeDeepseekBotAvatar, disableDeepseekBot, testDeepseekBot, exportDeepseekBotJson,
        importDeepseekBotJsonFile, saveDeepseekChatBotSettings, setQwenAiStatus, setQwenAiProviderStatus, setQwenBotStatus, setQwenChatStatus, setQwenAiModelStatus, currentQwenBot,
        getQwenChatSetting, mergeQwenAiState, renderQwenModelOptions, renderQwenBotAvatar, fillQwenBotForm, qwenBotFormPayload, renderQwenBotList, renderQwenChatBotSettings,
        renderQwenAiSettings, qwenAiSettingsPayload, persistQwenAiSettings, loadQwenAiState, saveQwenAiSettings, testQwenAiConnection, refreshQwenAiModels, deleteQwenAiKey,
        saveQwenBot, uploadQwenBotAvatar, removeQwenBotAvatar, disableQwenBot, testQwenBot, exportQwenBotJson, importQwenBotJsonFile, saveQwenChatBotSettings,
        setYandexAiStatus, setYandexAiProviderStatus, setYandexBotStatus, setYandexChatStatus, setYandexAiModelStatus, formatUiErrorMessage, currentYandexBot, getYandexChatSetting,
        mergeYandexAiState, renderYandexModelOptions, renderYandexBotAvatar, fillYandexBotForm, yandexBotFormPayload, renderYandexBotList, renderYandexChatBotSettings, renderYandexAiSettings,
        yandexAiSettingsPayload, persistYandexAiSettings, loadYandexAiState, saveYandexAiSettings, testYandexAiConnection, refreshYandexAiModels, deleteYandexAiKey, saveYandexBot,
        uploadYandexBotAvatar, removeYandexBotAvatar, disableYandexBot, testYandexBot, exportYandexBotJson, importYandexBotJsonFile, saveYandexChatBotSettings,
      };
    }
  }

  aiAdmin.localProvidersRuntime = { createLocalProvidersRuntime };
})();
