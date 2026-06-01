(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};

  function createLegacyGrokRuntime(scope = {}) {
    with (scope) {
      function setGrokStatus(statusId, message, type = '') {
        setInlineStatus(statusId, message, type);
      }
    
      function setGrokAiStatus(message, type = '') {
        setGrokStatus('grokAiStatus', message, type);
      }
    
      function setGrokTextStatus(message, type = '') {
        setGrokStatus('grokAiTextStatus', message, type);
      }
    
      function setGrokImageStatus(message, type = '') {
        setGrokStatus('grokAiImageStatus', message, type);
      }
    
      function setGrokUniversalStatus(message, type = '') {
        setGrokStatus('grokAiUniversalStatus', message, type);
      }
    
      function setGrokAiProviderStatus(message, type = '') {
        setGrokStatus('grokAiProviderStatus', message, type);
      }
    
      function setGrokTextEditorStatus(message, type = '') {
        setGrokStatus(['grokAiBotEditorStatus', 'grokAiBotEditorStatusBottom'], message, type);
      }
    
      function setGrokImageEditorStatus(message, type = '') {
        setGrokStatus('grokAiImageBotEditorStatus', message, type);
      }
    
      function setGrokUniversalEditorStatus(message, type = '') {
        setGrokStatus('grokAiUniversalBotEditorStatus', message, type);
      }
    
      function setGrokTextChatStatus(message, type = '') {
        setGrokStatus('grokAiBotChatStatus', message, type);
      }
    
      function setGrokImageChatStatus(message, type = '') {
        setGrokStatus('grokAiImageBotChatStatus', message, type);
      }
    
      function setGrokUniversalChatStatus(message, type = '') {
        setGrokStatus('grokAiUniversalBotChatStatus', message, type);
      }
    
      function setGrokBotStatus(kind = 'text', message, type = '') {
        if (kind === 'image') setGrokImageEditorStatus(message, type);
        else if (kind === 'universal') setGrokUniversalEditorStatus(message, type);
        else setGrokTextEditorStatus(message, type);
      }
    
      function setGrokAiModelStatus(message, type = '') {
        setInlineStatus('grokAiModelStatus', message, type);
      }
    
      function wireAiBotToggleLabels() {
        document.querySelectorAll('.ai-bot-toggle-label').forEach((label) => {
          if (label.dataset.toggleLabelBound === '1') return;
          label.dataset.toggleLabelBound = '1';
          label.addEventListener('click', (e) => {
            const checkbox = label.querySelector('input[type="checkbox"]');
            if (!checkbox || checkbox.disabled) return;
            if (e.target === checkbox) return;
            // Nested <label> elements are invalid HTML and can double-toggle on some browsers.
            e.preventDefault();
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('input', { bubbles: true }));
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          });
        });
      }
    
      function currentGrokBot() {
        return grokBotState.bots.find(bot => Number(bot.id) === Number(selectedGrokBotId)) || null;
      }
    
      function currentGrokImageBot() {
        return grokBotState.imageBots.find(bot => Number(bot.id) === Number(selectedGrokImageBotId)) || null;
      }
    
      function currentGrokUniversalBot() {
        return grokUniversalState.bots.find(bot => Number(bot.id) === Number(selectedGrokUniversalBotId)) || null;
      }
    
      function getGrokChatSetting(chatId, botId) {
        return grokBotState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
      }
    
      function getGrokImageChatSetting(chatId, botId) {
        return grokBotState.imageChatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
      }
    
      function getGrokUniversalChatSetting(chatId, botId) {
        return grokUniversalState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
      }
    
      function mergeGrokAiState(data = {}) {
        const state = data.state || data;
        if (state.settings) syncSharedGrokSettings(state.settings);
        if (state.bots) grokBotState.bots = state.bots;
        if (state.imageBots) grokBotState.imageBots = state.imageBots;
        if (state.chats) grokBotState.chats = state.chats;
        if (state.chatSettings) grokBotState.chatSettings = state.chatSettings;
        if (state.imageChatSettings) grokBotState.imageChatSettings = state.imageChatSettings;
        if (state.chats) grokUniversalState.chats = state.chats;
        if (state.models) {
          grokBotState.models = { ...grokBotState.models, ...state.models };
          grokUniversalState.models = { ...grokUniversalState.models, ...state.models };
        }
        grokUniversalState.settings = grokBotState.settings;
        if (selectedGrokBotId && !grokBotState.bots.some(bot => Number(bot.id) === Number(selectedGrokBotId))) {
          selectedGrokBotId = null;
        }
        if (selectedGrokImageBotId && !grokBotState.imageBots.some(bot => Number(bot.id) === Number(selectedGrokImageBotId))) {
          selectedGrokImageBotId = null;
        }
        composerStateController.mentionTargetsByChat.clear();
        updateComposerAiOverrideState().catch(() => {});
      }
    
      function mergeGrokUniversalState(data = {}) {
        const state = data.state || data;
        if (state.settings) syncSharedGrokSettings(state.settings);
        if (state.bots) grokUniversalState.bots = state.bots;
        if (state.chats) grokUniversalState.chats = state.chats;
        if (state.chatSettings) grokUniversalState.chatSettings = state.chatSettings;
        if (state.models) {
          grokUniversalState.models = { ...grokUniversalState.models, ...state.models };
          grokBotState.models = { ...grokBotState.models, ...state.models };
        }
        grokUniversalState.settings = grokBotState.settings;
        if (selectedGrokUniversalBotId && !grokUniversalState.bots.some(bot => Number(bot.id) === Number(selectedGrokUniversalBotId))) {
          selectedGrokUniversalBotId = null;
        }
        composerStateController.mentionTargetsByChat.clear();
        updateComposerAiOverrideState().catch(() => {});
      }
    
      function renderNamedGrokAvatar({ bot, avatarId, nameId, fallbackName, inputId, labelId, removeId }) {
        const avatarEl = $(avatarId);
        if (!avatarEl) return;
        const name = bot?.name || $(nameId)?.value.trim() || fallbackName;
        const color = bot?.avatar_color || '#65aadd';
        avatarEl.style.background = color;
        if (bot?.avatar_url) {
          avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
        } else {
          avatarEl.textContent = initials(name);
        }
    
        const hasSavedBot = Boolean(bot?.id);
        const input = $(inputId);
        const label = $(labelId);
        if (input) {
          input.disabled = !hasSavedBot;
          input.value = '';
        }
        if (label) {
          label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
          label.title = hasSavedBot ? 'Change avatar' : 'Save the bot first';
        }
        $(removeId)?.classList.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
      }
    
      function renderGrokBotAvatar(bot = currentGrokBot()) {
        renderNamedGrokAvatar({
          bot,
          avatarId: 'grokAiBotAvatar',
          nameId: 'grokAiBotName',
          fallbackName: 'Grok AI',
          inputId: 'grokAiBotAvatarInput',
          labelId: 'grokAiBotAvatarLabel',
          removeId: 'removeGrokAiBotAvatar',
        });
      }
    
      function renderGrokImageBotAvatar(bot = currentGrokImageBot()) {
        renderNamedGrokAvatar({
          bot,
          avatarId: 'grokAiImageBotAvatar',
          nameId: 'grokAiImageBotName',
          fallbackName: 'Grok Images',
          inputId: 'grokAiImageBotAvatarInput',
          labelId: 'grokAiImageBotAvatarLabel',
          removeId: 'removeGrokAiImageBotAvatar',
        });
      }
    
      function renderGrokUniversalBotAvatar(bot = currentGrokUniversalBot()) {
        renderNamedGrokAvatar({
          bot,
          avatarId: 'grokAiUniversalBotAvatar',
          nameId: 'grokAiUniversalBotName',
          fallbackName: 'Grok Universal',
          inputId: 'grokAiUniversalBotAvatarInput',
          labelId: 'grokAiUniversalBotAvatarLabel',
          removeId: 'removeGrokAiUniversalBotAvatar',
        });
      }
    
      function mountGrokBotPanels() {
        const settingsBlock = $('#grokAiSettingsBlock');
        const textBlock = $('#grokAiTextBotsBlock');
        const imageBlock = $('#grokAiImageBotsBlock');
        const universalBlock = $('#grokAiUniversalBotsBlock');
        const textPanel = $('#grokAiBotList')?.closest('.ai-bot-panel');
        const imagePanel = $('#grokAiImageBotList')?.closest('.ai-bot-panel');
        const universalPanel = $('#grokAiUniversalBotList')?.closest('.ai-bot-panel');
        const globalStatus = $('#grokAiStatus');
        const textStatus = $('#grokAiTextStatus');
        const imageStatus = $('#grokAiImageStatus');
        const universalStatus = $('#grokAiUniversalStatus');
        const navPanel = $('#grokAiNavPanel');
    
        if (settingsBlock && navPanel && globalStatus && navPanel.parentElement !== settingsBlock) {
          settingsBlock.insertBefore(navPanel, globalStatus);
        }
        if (textBlock && textPanel && textStatus && textPanel.parentElement !== textBlock) {
          textBlock.insertBefore(textPanel, textStatus);
        }
        if (imageBlock && imagePanel && imageStatus && imagePanel.parentElement !== imageBlock) {
          imageBlock.insertBefore(imagePanel, imageStatus);
        }
        if (universalBlock && universalPanel && universalStatus && universalPanel.parentElement !== universalBlock) {
          universalBlock.insertBefore(universalPanel, universalStatus);
        }
        textPanel?.classList.remove('hidden');
        imagePanel?.classList.remove('hidden');
        universalPanel?.classList.remove('hidden');
      }
    
      function renderGrokGlobalTextModelOptions() {
        const settings = grokBotState.settings || {};
        const models = grokBotState.models || {};
        const responseModels = models.response || ['grok-4.20-reasoning'];
        const summaryModels = models.summary || responseModels;
        const embeddingModels = models.embedding || ['text-embedding'];
        setAiModelSelectOptions('grokAiDefaultResponseModel', responseModels, settings.grok_default_response_model || responseModels[0] || '');
        setAiModelSelectOptions('grokAiDefaultSummaryModel', summaryModels, settings.grok_default_summary_model || summaryModels[0] || '');
        setAiModelSelectOptions('grokAiDefaultEmbeddingModel', embeddingModels, settings.grok_default_embedding_model || embeddingModels[0] || '');
      }
    
      function renderGrokBotModelOptions(bot = currentGrokBot()) {
        const settings = grokBotState.settings || {};
        const models = grokBotState.models || {};
        const responseModels = models.response || ['grok-4.20-reasoning'];
        const summaryModels = models.summary || responseModels;
        setAiModelSelectOptions('grokAiBotResponseModel', responseModels, bot?.response_model || settings.grok_default_response_model || responseModels[0] || '');
        setAiModelSelectOptions('grokAiBotSummaryModel', summaryModels, bot?.summary_model || settings.grok_default_summary_model || summaryModels[0] || '');
      }
    
      function renderGrokUniversalBotModelOptions(bot = currentGrokUniversalBot()) {
        const settings = grokUniversalState.settings || grokBotState.settings || {};
        const models = grokUniversalState.models || grokBotState.models || {};
        const responseModels = models.response || ['grok-4.20-reasoning'];
        const summaryModels = models.summary || responseModels;
        const imageModels = models.image || ['grok-imagine-image'];
        const aspectRatios = models.aspect_ratio || ['1:1', '16:9', '9:16'];
        const resolutions = models.resolution || ['1k', '2k'];
        setAiModelSelectOptions('grokAiUniversalBotResponseModel', responseModels, bot?.response_model || settings.grok_default_response_model || responseModels[0] || '');
        setAiModelSelectOptions('grokAiUniversalBotSummaryModel', summaryModels, bot?.summary_model || settings.grok_default_summary_model || summaryModels[0] || '');
        setAiModelSelectOptions('grokAiUniversalBotImageModel', imageModels, bot?.image_model || settings.grok_default_image_model || imageModels[0] || '');
        setAiModelSelectOptions('grokAiUniversalBotAspectRatio', aspectRatios, bot?.image_aspect_ratio || settings.grok_default_image_aspect_ratio || aspectRatios[0] || '');
        setAiModelSelectOptions('grokAiUniversalBotResolution', resolutions, bot?.image_resolution || settings.grok_default_image_resolution || resolutions[0] || '');
      }
    
      function renderGrokGlobalImageModelOptions() {
        const settings = grokBotState.settings || {};
        const models = grokBotState.models || {};
        const imageModels = models.image || ['grok-imagine-image'];
        const aspectRatios = models.aspect_ratio || ['1:1', '16:9', '9:16'];
        const resolutions = models.resolution || ['1k', '2k'];
        setAiModelSelectOptions('grokAiDefaultImageModel', imageModels, settings.grok_default_image_model || imageModels[0] || '');
        setAiModelSelectOptions('grokAiDefaultAspectRatio', aspectRatios, settings.grok_default_image_aspect_ratio || aspectRatios[0] || '');
        setAiModelSelectOptions('grokAiDefaultResolution', resolutions, settings.grok_default_image_resolution || resolutions[0] || '');
      }
    
      function renderGrokImageBotModelOptions(bot = currentGrokImageBot()) {
        const settings = grokBotState.settings || {};
        const models = grokBotState.models || {};
        const imageModels = models.image || ['grok-imagine-image'];
        const aspectRatios = models.aspect_ratio || ['1:1', '16:9', '9:16'];
        const resolutions = models.resolution || ['1k', '2k'];
        setAiModelSelectOptions('grokAiImageBotModel', imageModels, bot?.image_model || settings.grok_default_image_model || imageModels[0] || '');
        setAiModelSelectOptions('grokAiImageBotAspectRatio', aspectRatios, bot?.image_aspect_ratio || settings.grok_default_image_aspect_ratio || aspectRatios[0] || '');
        setAiModelSelectOptions('grokAiImageBotResolution', resolutions, bot?.image_resolution || settings.grok_default_image_resolution || resolutions[0] || '');
      }
    
      function renderGrokBotList() {
        const list = $('#grokAiBotList');
        if (!list) return;
        if (!grokBotState.bots.length) {
          list.innerHTML = '<div class="ai-bot-empty">No Grok text bots yet. Create the first one.</div>';
          return;
        }
        list.innerHTML = grokBotState.bots.map(bot => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedGrokBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
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
    
      function renderGrokImageBotList() {
        const list = $('#grokAiImageBotList');
        if (!list) return;
        if (!grokBotState.imageBots.length) {
          list.innerHTML = '<div class="ai-bot-empty">No Grok image bots yet. Create the first one.</div>';
          return;
        }
        list.innerHTML = grokBotState.imageBots.map(bot => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedGrokImageBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
            <span class="ai-bot-list-main">
              <span class="ai-bot-list-avatar" style="background:${esc(bot.avatar_color || '#65aadd')}">
                ${bot.avatar_url ? `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">` : esc(initials(bot.name || '?'))}
              </span>
              <span class="ai-bot-list-copy">
                <strong>${esc(bot.name)}</strong>
                <small>@${esc(bot.mention)} \u00b7 ${bot.enabled ? 'enabled' : 'disabled'}</small>
              </span>
            </span>
            <span class="ai-bot-list-model">${bot.image_model ? esc(bot.image_model) : ''}</span>
          </button>
        `).join('');
      }
    
      function renderGrokUniversalBotList() {
        const list = $('#grokAiUniversalBotList');
        if (!list) return;
        if (!grokUniversalState.bots.length) {
          list.innerHTML = '<div class="ai-bot-empty">No Grok universal bots yet. Create the first one.</div>';
          return;
        }
        list.innerHTML = grokUniversalState.bots.map(bot => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedGrokUniversalBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
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
    
      function fillGrokBotForm(bot = null) {
        const settings = grokBotState.settings || {};
        grokTextBotFormHydrating = true;
        selectedGrokBotId = bot ? bot.id : null;
        $('#grokAiBotName').value = bot?.name || 'Grok AI';
        $('#grokAiBotMention').value = bot?.mention || 'grok';
        $('#grokAiBotEnabled').checked = bot ? !!bot.enabled : true;
        setBotVisibilityToggle('grokAiBotVisibleToUsers', !!bot?.visible_to_users);
        $('#grokAiBotTemperature').value = bot?.temperature ?? settings.grok_temperature ?? 0.3;
        $('#grokAiBotMaxTokens').value = bot?.max_tokens ?? settings.grok_max_tokens ?? 1000;
        $('#grokAiBotStyle').value = bot?.style || 'Helpful Grok assistant for chat';
        $('#grokAiBotTone').value = bot?.tone || 'warm, concise, attentive';
        $('#grokAiBotRules').value = bot?.behavior_rules || '';
        $('#grokAiBotSpeech').value = bot?.speech_patterns || '';
        renderGrokBotModelOptions(bot);
        renderGrokBotAvatar(bot);
        renderGrokBotList();
        renderGrokChatBotSettings();
        grokTextBotFormHydrating = false;
        syncGrokTextBotFormFingerprint();
      }
    
      function fillGrokImageBotForm(bot = null) {
        selectedGrokImageBotId = bot ? bot.id : null;
        $('#grokAiImageBotName').value = bot?.name || 'Grok Images';
        $('#grokAiImageBotMention').value = bot?.mention || 'grok_image';
        $('#grokAiImageBotEnabled').checked = bot ? !!bot.enabled : true;
        $('#grokAiImageBotRiskFilter').checked = bot?.image_risk_filter_enabled ?? true;
        setBotVisibilityToggle('grokAiImageBotVisibleToUsers', !!bot?.visible_to_users);
        $('#grokAiImageBotStyle').value = bot?.style || 'Visual prompt specialist for chat';
        $('#grokAiImageBotTone').value = bot?.tone || 'clear, imaginative, precise';
        $('#grokAiImageBotRules').value = bot?.behavior_rules || '';
        $('#grokAiImageBotSpeech').value = bot?.speech_patterns || '';
        renderGrokImageBotModelOptions(bot);
        renderGrokImageBotAvatar(bot);
        renderGrokImageBotList();
        renderGrokImageChatBotSettings();
      }
    
      function fillGrokUniversalBotForm(bot = null) {
        const settings = grokUniversalState.settings || grokBotState.settings || {};
        selectedGrokUniversalBotId = bot ? bot.id : null;
        $('#grokAiUniversalBotName').value = bot?.name || 'Grok Universal';
        $('#grokAiUniversalBotMention').value = bot?.mention || 'grok_universal';
        $('#grokAiUniversalBotEnabled').checked = bot ? !!bot.enabled : true;
        $('#grokAiUniversalBotRiskFilter').checked = bot?.image_risk_filter_enabled ?? true;
        setBotVisibilityToggle('grokAiUniversalBotVisibleToUsers', !!bot?.visible_to_users);
        $('#grokAiUniversalBotAllowText').checked = bot?.allow_text ?? true;
        $('#grokAiUniversalBotAllowImageGenerate').checked = bot?.allow_image_generate ?? true;
        $('#grokAiUniversalBotAllowImageEdit').checked = bot?.allow_image_edit ?? true;
        $('#grokAiUniversalBotTemperature').value = bot?.temperature ?? settings.grok_temperature ?? 0.3;
        $('#grokAiUniversalBotMaxTokens').value = bot?.max_tokens ?? settings.grok_max_tokens ?? 1000;
        $('#grokAiUniversalBotStyle').value = bot?.style || 'Helpful Grok universal assistant for chat';
        $('#grokAiUniversalBotTone').value = bot?.tone || 'warm, concise, attentive';
        $('#grokAiUniversalBotRules').value = bot?.behavior_rules || '';
        $('#grokAiUniversalBotSpeech').value = bot?.speech_patterns || '';
        $('#grokAiUniversalBotTestMode').value = 'auto';
        renderGrokUniversalBotModelOptions(bot);
        renderGrokUniversalBotAvatar(bot);
        renderGrokUniversalBotList();
        renderGrokUniversalChatBotSettings();
      }
    
      function grokBotFormPayload() {
        return {
          kind: 'text',
          name: $('#grokAiBotName')?.value.trim(),
          mention: $('#grokAiBotMention')?.value.trim(),
          enabled: $('#grokAiBotEnabled')?.checked,
          visible_to_users: getBotVisibilityToggle('grokAiBotVisibleToUsers'),
          response_model: $('#grokAiBotResponseModel')?.value.trim(),
          summary_model: $('#grokAiBotSummaryModel')?.value.trim(),
          temperature: Number($('#grokAiBotTemperature')?.value || 0.3),
          max_tokens: Number($('#grokAiBotMaxTokens')?.value || 1000),
          style: $('#grokAiBotStyle')?.value.trim(),
          tone: $('#grokAiBotTone')?.value.trim(),
          behavior_rules: $('#grokAiBotRules')?.value.trim(),
          speech_patterns: $('#grokAiBotSpeech')?.value.trim(),
        };
      }
    
      const GROK_TEXT_BOT_DIRTY_STATUS = 'Bot settings changed. Click "Save bot" to apply them.';
    
      function formatCapabilityState(bot = {}) {
        const values = [
          !!bot.allow_poll_create,
          !!bot.allow_poll_vote,
          !!bot.allow_react,
          !!bot.allow_pin,
        ];
        if (values.every(Boolean)) return 'interactive actions: on';
        if (values.every((value) => !value)) return 'interactive actions: off';
        return [
          `poll create: ${bot.allow_poll_create ? 'on' : 'off'}`,
          `poll vote: ${bot.allow_poll_vote ? 'on' : 'off'}`,
          `reactions: ${bot.allow_react ? 'on' : 'off'}`,
          `pin: ${bot.allow_pin ? 'on' : 'off'}`,
        ].join(', ');
      }
    
      function currentGrokTextBotFormFingerprint() {
        return JSON.stringify(grokBotFormPayload());
      }
    
      function refreshGrokTextBotDirtyState() {
        const saveBtns = ['grokAiBotSave', 'grokAiBotSaveBottom'].map((id) => $(id)).filter(Boolean);
        const statusEl = $('#grokAiBotEditorStatus') || $('#grokAiBotEditorStatusBottom');
        if (!saveBtns.length || grokTextBotFormHydrating) return;
        const isDirty = currentGrokTextBotFormFingerprint() !== grokTextBotFormFingerprint;
        saveBtns.forEach((saveBtn) => {
          saveBtn.textContent = isDirty ? 'Save bot changes' : 'Save bot';
        });
        if (isDirty) {
          if (!statusEl?.textContent || statusEl.textContent === GROK_TEXT_BOT_DIRTY_STATUS) {
            setGrokTextEditorStatus(GROK_TEXT_BOT_DIRTY_STATUS);
          }
          return;
        }
        if (statusEl?.textContent === GROK_TEXT_BOT_DIRTY_STATUS) {
          setGrokTextEditorStatus('');
        }
      }
    
      function syncGrokTextBotFormFingerprint() {
        grokTextBotFormFingerprint = currentGrokTextBotFormFingerprint();
        refreshGrokTextBotDirtyState();
      }
    
      function grokImageBotFormPayload() {
        return {
          kind: 'image',
          name: $('#grokAiImageBotName')?.value.trim(),
          mention: $('#grokAiImageBotMention')?.value.trim(),
          enabled: $('#grokAiImageBotEnabled')?.checked,
          image_risk_filter_enabled: $('#grokAiImageBotRiskFilter')?.checked,
          visible_to_users: getBotVisibilityToggle('grokAiImageBotVisibleToUsers'),
          image_model: $('#grokAiImageBotModel')?.value.trim(),
          image_aspect_ratio: $('#grokAiImageBotAspectRatio')?.value.trim(),
          image_resolution: $('#grokAiImageBotResolution')?.value.trim(),
          style: $('#grokAiImageBotStyle')?.value.trim(),
          tone: $('#grokAiImageBotTone')?.value.trim(),
          behavior_rules: $('#grokAiImageBotRules')?.value.trim(),
          speech_patterns: $('#grokAiImageBotSpeech')?.value.trim(),
        };
      }
    
      function grokUniversalBotFormPayload() {
        return {
          kind: 'universal',
          name: $('#grokAiUniversalBotName')?.value.trim(),
          mention: $('#grokAiUniversalBotMention')?.value.trim(),
          enabled: $('#grokAiUniversalBotEnabled')?.checked,
          image_risk_filter_enabled: $('#grokAiUniversalBotRiskFilter')?.checked,
          visible_to_users: getBotVisibilityToggle('grokAiUniversalBotVisibleToUsers'),
          response_model: $('#grokAiUniversalBotResponseModel')?.value.trim(),
          summary_model: $('#grokAiUniversalBotSummaryModel')?.value.trim(),
          image_model: $('#grokAiUniversalBotImageModel')?.value.trim(),
          image_aspect_ratio: $('#grokAiUniversalBotAspectRatio')?.value.trim(),
          image_resolution: $('#grokAiUniversalBotResolution')?.value.trim(),
          allow_text: $('#grokAiUniversalBotAllowText')?.checked,
          allow_image_generate: $('#grokAiUniversalBotAllowImageGenerate')?.checked,
          allow_image_edit: $('#grokAiUniversalBotAllowImageEdit')?.checked,
          temperature: Number($('#grokAiUniversalBotTemperature')?.value || 0.3),
          max_tokens: Number($('#grokAiUniversalBotMaxTokens')?.value || 1000),
          style: $('#grokAiUniversalBotStyle')?.value.trim(),
          tone: $('#grokAiUniversalBotTone')?.value.trim(),
          behavior_rules: $('#grokAiUniversalBotRules')?.value.trim(),
          speech_patterns: $('#grokAiUniversalBotSpeech')?.value.trim(),
        };
      }
    
      function renderGrokChatBotSettings() {
        const chatSelect = $('#grokAiBotChatSelect');
        const botSelect = $('#grokAiBotChatBotSelect');
        if (!chatSelect || !botSelect) return;
        const currentChatValue = chatSelect.value || String(currentChatId || grokBotState.chats[0]?.id || '');
        const currentBotValue = botSelect.value || String(selectedGrokBotId || grokBotState.bots[0]?.id || '');
        chatSelect.innerHTML = grokBotState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
        botSelect.innerHTML = grokBotState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
        if (grokBotState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
        if (grokBotState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
        if (!botSelect.value && grokBotState.bots[0]) botSelect.value = String(grokBotState.bots[0].id);
        const setting = getGrokChatSetting(chatSelect.value, botSelect.value);
        $('#grokAiBotChatEnabled').checked = !!setting?.enabled;
        $('#grokAiBotChatMode').value = setting?.mode || 'simple';
        $('#grokAiBotChatHotLimit').value = setting?.hot_context_limit || 50;
        $('#grokAiBotChatAutoReact').checked = !!setting?.auto_react_on_mention;
      }
    
      function renderGrokImageChatBotSettings() {
        const chatSelect = $('#grokAiImageBotChatSelect');
        const botSelect = $('#grokAiImageBotChatBotSelect');
        if (!chatSelect || !botSelect) return;
        const currentChatValue = chatSelect.value || String(currentChatId || grokBotState.chats[0]?.id || '');
        const currentBotValue = botSelect.value || String(selectedGrokImageBotId || grokBotState.imageBots[0]?.id || '');
        chatSelect.innerHTML = grokBotState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
        botSelect.innerHTML = grokBotState.imageBots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
        if (grokBotState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
        if (grokBotState.imageBots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
        if (!botSelect.value && grokBotState.imageBots[0]) botSelect.value = String(grokBotState.imageBots[0].id);
        const setting = getGrokImageChatSetting(chatSelect.value, botSelect.value);
        $('#grokAiImageBotChatEnabled').checked = !!setting?.enabled;
      }
    
      function renderGrokUniversalChatBotSettings() {
        const chatSelect = $('#grokAiUniversalBotChatSelect');
        const botSelect = $('#grokAiUniversalBotChatBotSelect');
        if (!chatSelect || !botSelect) return;
        const currentChatValue = chatSelect.value || String(currentChatId || grokUniversalState.chats[0]?.id || '');
        const currentBotValue = botSelect.value || String(selectedGrokUniversalBotId || grokUniversalState.bots[0]?.id || '');
        chatSelect.innerHTML = grokUniversalState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
        botSelect.innerHTML = grokUniversalState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
        if (grokUniversalState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
        if (grokUniversalState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
        if (!botSelect.value && grokUniversalState.bots[0]) botSelect.value = String(grokUniversalState.bots[0].id);
        const setting = getGrokUniversalChatSetting(chatSelect.value, botSelect.value);
        $('#grokAiUniversalBotChatEnabled').checked = !!setting?.enabled;
        $('#grokAiUniversalBotChatMode').value = setting?.mode || 'simple';
        $('#grokAiUniversalBotChatHotLimit').value = setting?.hot_context_limit || 50;
        $('#grokAiUniversalBotChatAutoReact').checked = !!setting?.auto_react_on_mention;
      }
    
      function renderGrokAiSettings() {
        mountGrokBotPanels();
        const settings = grokBotState.settings || {};
        $('#grokAiGlobalEnabled').checked = !!settings.grok_enabled;
        $('#grokAiInteractiveEnabled').checked = !!settings.grok_interactive_enabled;
        $('#grokAiBaseUrl').value = settings.grok_base_url || 'https://api.x.ai/v1';
        $('#grokAiTemperature').value = settings.grok_temperature ?? 0.3;
        $('#grokAiMaxTokens').value = settings.grok_max_tokens ?? 1000;
        $('#grokAiApiKey').value = '';
        $('#grokAiKeyStatus').textContent = settings.has_grok_key
          ? `Key saved: ${settings.masked_grok_key || '***'}`
          : 'Key is not saved';
        renderGrokGlobalTextModelOptions();
        renderGrokGlobalImageModelOptions();
        const models = grokBotState.models || {};
        if (models.error) {
          setGrokAiModelStatus(`Model list fallback is used: ${formatUiErrorMessage(models.error, 'Could not load Grok models')}`, 'error');
        } else if (models.source === 'live') {
          setGrokAiModelStatus(`Loaded ${models.response?.length || 0} text models and ${models.image?.length || 0} image models.`, 'success');
        } else {
          setGrokAiModelStatus('Saved defaults are shown. Use "Refresh models" or "Test key" to load live Grok models.');
        }
      }
    
      function renderGrokTextBotsSettings() {
        mountGrokBotPanels();
        fillGrokBotForm(currentGrokBot() || grokBotState.bots[0] || null);
        renderGrokChatBotSettings();
      }
    
      function renderGrokImageBotsSettings() {
        mountGrokBotPanels();
        fillGrokImageBotForm(currentGrokImageBot() || grokBotState.imageBots[0] || null);
        renderGrokImageChatBotSettings();
      }
    
      function renderGrokUniversalBotsSettings() {
        mountGrokBotPanels();
        fillGrokUniversalBotForm(currentGrokUniversalBot() || grokUniversalState.bots[0] || null);
        renderGrokUniversalChatBotSettings();
      }
    
      function grokAiSettingsPayload() {
        const body = {
          grok_enabled: $('#grokAiGlobalEnabled')?.checked,
          grok_interactive_enabled: $('#grokAiInteractiveEnabled')?.checked,
          grok_base_url: $('#grokAiBaseUrl')?.value.trim(),
          grok_default_response_model: $('#grokAiDefaultResponseModel')?.value.trim(),
          grok_default_summary_model: $('#grokAiDefaultSummaryModel')?.value.trim(),
          grok_default_embedding_model: $('#grokAiDefaultEmbeddingModel')?.value.trim(),
          grok_default_image_model: $('#grokAiDefaultImageModel')?.value.trim(),
          grok_default_image_aspect_ratio: $('#grokAiDefaultAspectRatio')?.value.trim(),
          grok_default_image_resolution: $('#grokAiDefaultResolution')?.value.trim(),
          grok_temperature: Number($('#grokAiTemperature')?.value || 0.3),
          grok_max_tokens: Number($('#grokAiMaxTokens')?.value || 1000),
        };
        const key = $('#grokAiApiKey')?.value.trim();
        if (key) body.grok_api_key = key;
        return body;
      }
    
      async function persistGrokAiSettings() {
        const data = await api('/api/admin/grok-ai-bots/settings', {
          method: 'PUT',
          body: grokAiSettingsPayload(),
        });
        mergeGrokAiState(data);
        return data;
      }
    
      async function loadGrokAiState() {
        const data = await api('/api/admin/grok-ai-bots');
        mergeGrokAiState(data);
        return data;
      }
    
      function syncGrokBotUser(bot) {
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
    
      async function saveGrokAiSettings() {
        setGrokAiProviderStatus('Saving...', 'pending');
        try {
          await persistGrokAiSettings();
          renderGrokAiSettings();
          setGrokAiProviderStatus(`Settings saved\n${providerInteractiveSummary('grok', grokBotState.settings)}`, 'success');
        } catch (e) {
          setGrokAiProviderStatus(e.message || 'Could not save settings', 'error');
        }
      }
    
      async function testGrokAiConnection() {
        const keyInput = $('#grokAiApiKey');
        const hasKey = Boolean(keyInput?.value.trim() || grokBotState.settings?.has_grok_key);
        if (!hasKey) {
          setGrokAiProviderStatus('Enter Grok API key before testing.', 'error');
          keyInput?.focus();
          return;
        }
        setGrokAiProviderStatus('Checking Grok connection...', 'pending');
        try {
          const data = await api('/api/admin/grok-ai-bots/test-connection', {
            method: 'POST',
            body: grokAiSettingsPayload(),
          });
          await persistGrokAiSettings();
          if (data.state?.models) mergeGrokAiState({ state: { models: data.state.models } });
          renderGrokAiSettings();
          const text = String(data.result?.text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
          setGrokAiProviderStatus(`Key verified (${data.result?.latencyMs || 0} ms). ${text}`, 'success');
        } catch (e) {
          setGrokAiProviderStatus(formatUiErrorMessage(e, 'Could not check Grok key'), 'error');
        }
      }
    
      async function refreshGrokAiModels() {
        const keyInput = $('#grokAiApiKey');
        const hasKey = Boolean(keyInput?.value.trim() || grokBotState.settings?.has_grok_key);
        if (!hasKey) {
          setGrokAiProviderStatus('Enter or save Grok API key before loading models.', 'error');
          keyInput?.focus();
          return;
        }
        setGrokAiProviderStatus('Loading Grok models...', 'pending');
        try {
          const data = await api('/api/admin/grok-ai-bots/models/refresh', {
            method: 'POST',
            body: grokAiSettingsPayload(),
          });
          mergeGrokAiState(data);
          renderGrokAiSettings();
          setGrokAiProviderStatus(`Models refreshed: ${grokBotState.models?.response?.length || 0} text / ${grokBotState.models?.image?.length || 0} image.`, 'success');
        } catch (e) {
          setGrokAiProviderStatus(formatUiErrorMessage(e, 'Could not load Grok models'), 'error');
        }
      }
    
      async function deleteGrokAiKey() {
        if (!confirm('Delete Grok API key for AI bots?')) return;
        try {
          const data = await api('/api/admin/grok-ai-bots/key', { method: 'DELETE' });
          mergeGrokAiState(data);
          renderGrokAiSettings();
          setGrokAiProviderStatus('Key deleted', 'success');
        } catch (e) {
          setGrokAiProviderStatus(e.message || 'Could not delete key', 'error');
        }
      }
    
      async function saveGrokBot() {
        const payload = grokBotFormPayload();
        if (!payload.name) { setGrokTextEditorStatus('Enter bot name', 'error'); return; }
        setGrokTextEditorStatus('Saving Grok bot...', 'pending');
        try {
          const shouldUpdate = Boolean(selectedGrokBotId && grokBotState.bots.some(bot => Number(bot.id) === Number(selectedGrokBotId)));
          const url = shouldUpdate ? `/api/admin/grok-ai-bots/${selectedGrokBotId}` : '/api/admin/grok-ai-bots';
          const method = shouldUpdate ? 'PUT' : 'POST';
          const data = await api(url, { method, body: payload });
          mergeGrokAiState(data);
          selectedGrokBotId = data.bot?.id || selectedGrokBotId;
          syncGrokBotUser(data.bot);
          renderGrokTextBotsSettings();
          const status = buildVerifiedBotSaveStatus('Text bot saved.', data.bot, payload, formatCapabilityState(data.bot || payload));
          setGrokTextEditorStatus(status.message, status.type);
        } catch (e) {
          setGrokTextEditorStatus(e.message || 'Could not save Grok bot', 'error');
        }
      }
    
      async function saveGrokImageBot() {
        const payload = grokImageBotFormPayload();
        if (!payload.name) { setGrokImageEditorStatus('Enter image bot name', 'error'); return; }
        setGrokImageEditorStatus('Saving Grok image bot...', 'pending');
        try {
          const shouldUpdate = Boolean(selectedGrokImageBotId && grokBotState.imageBots.some(bot => Number(bot.id) === Number(selectedGrokImageBotId)));
          const url = shouldUpdate ? `/api/admin/grok-ai-bots/${selectedGrokImageBotId}` : '/api/admin/grok-ai-bots';
          const method = shouldUpdate ? 'PUT' : 'POST';
          const data = await api(url, { method, body: payload });
          mergeGrokAiState(data);
          selectedGrokImageBotId = data.bot?.id || selectedGrokImageBotId;
          syncGrokBotUser(data.bot);
          renderGrokImageBotsSettings();
          const status = buildVerifiedBotSaveStatus('Image bot saved.', data.bot, payload);
          setGrokImageEditorStatus(status.message, status.type);
        } catch (e) {
          setGrokImageEditorStatus(e.message || 'Could not save image bot', 'error');
        }
      }
    
      async function uploadGrokBotAvatar(file, kind = 'text') {
        if (!file) return;
        const botId = kind === 'text' ? selectedGrokBotId : selectedGrokImageBotId;
        if (!botId) {
          setGrokBotStatus(kind, 'Save the bot before adding an avatar', 'error');
          if (kind === 'text') renderGrokBotAvatar(null);
          else renderGrokImageBotAvatar(null);
          return;
        }
        const fd = new FormData();
        fd.append('avatar', file);
        setGrokBotStatus(kind, 'Uploading avatar...');
        try {
          const data = await api(`/api/admin/grok-ai-bots/${botId}/avatar`, { method: 'POST', body: fd });
          mergeGrokAiState(data);
          if (kind === 'text') selectedGrokBotId = data.bot?.id || selectedGrokBotId;
          else selectedGrokImageBotId = data.bot?.id || selectedGrokImageBotId;
          syncGrokBotUser(data.bot);
          if (kind === 'text') renderGrokTextBotsSettings();
          else renderGrokImageBotsSettings();
          refreshRenderedAiBotAvatar(data.bot);
          setGrokBotStatus(kind, 'Avatar saved', 'success');
        } catch (e) {
          setGrokBotStatus(kind, e.message || 'Could not upload avatar', 'error');
        }
      }
    
      async function removeGrokBotAvatar(kind = 'text') {
        const botId = kind === 'text' ? selectedGrokBotId : selectedGrokImageBotId;
        if (!botId) return;
        try {
          const data = await api(`/api/admin/grok-ai-bots/${botId}/avatar`, { method: 'DELETE' });
          mergeGrokAiState(data);
          if (kind === 'text') selectedGrokBotId = data.bot?.id || selectedGrokBotId;
          else selectedGrokImageBotId = data.bot?.id || selectedGrokImageBotId;
          syncGrokBotUser(data.bot);
          if (kind === 'text') renderGrokTextBotsSettings();
          else renderGrokImageBotsSettings();
          refreshRenderedAiBotAvatar(data.bot);
          setGrokBotStatus(kind, 'Avatar removed', 'success');
        } catch (e) {
          setGrokBotStatus(kind, e.message || 'Could not remove avatar', 'error');
        }
      }
    
      async function disableGrokBot(kind = 'text') {
        const botId = kind === 'text' ? selectedGrokBotId : selectedGrokImageBotId;
        if (!botId) return;
        if (!confirm(`Disable this Grok ${kind === 'text' ? 'text' : 'image'} bot in all chats?`)) return;
        try {
          const data = await api(`/api/admin/grok-ai-bots/${botId}`, { method: 'DELETE' });
          mergeGrokAiState(data);
          if (kind === 'text') renderGrokTextBotsSettings();
          else renderGrokImageBotsSettings();
          setGrokBotStatus(kind, `${kind === 'text' ? 'Text' : 'Image'} bot disabled`, 'success');
        } catch (e) {
          setGrokBotStatus(kind, e.message || 'Could not disable bot', 'error');
        }
      }
    
      async function testGrokBot(kind = 'text') {
        const botId = kind === 'text' ? selectedGrokBotId : selectedGrokImageBotId;
        if (!botId) { setGrokBotStatus(kind, 'Save the bot first', 'error'); return; }
        setGrokBotStatus(kind, 'Testing model...');
        try {
          const data = await api(`/api/admin/grok-ai-bots/${botId}/test`, { method: 'POST', body: {} });
          const text = data.result?.text ? data.result.text.slice(0, 500) : '';
          setGrokBotStatus(kind, `Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
        } catch (e) {
          setGrokBotStatus(kind, e.message || 'Test failed', 'error');
        }
      }
    
      async function exportGrokBotJson(kind = 'text') {
        const botId = kind === 'text' ? selectedGrokBotId : selectedGrokImageBotId;
        if (!botId) { setGrokBotStatus(kind, 'Choose a saved bot first', 'error'); return; }
        setGrokBotStatus(kind, 'Preparing JSON...');
        try {
          const headers = {};
          if (token) headers.Authorization = 'Bearer ' + token;
          const res = await fetch(`/api/admin/grok-ai-bots/${botId}/export`, { headers });
          if (!res.ok) {
            let data = {};
            try { data = await res.json(); } catch {}
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          const blob = await res.blob();
          const bot = kind === 'text' ? currentGrokBot() : currentGrokImageBot();
          const fallbackName = `bananza-grok-bot-${bot?.mention || botId}.json`;
          const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          setGrokBotStatus(kind, 'JSON exported', 'success');
        } catch (e) {
          setGrokBotStatus(kind, e.message || 'Could not export JSON', 'error');
        }
      }
    
      async function importGrokBotJsonFile(file, kind = 'text') {
        if (!file) return;
        setGrokBotStatus(kind, 'Importing JSON...');
        try {
          const raw = await file.text();
          const payload = JSON.parse(raw);
          const data = await api('/api/admin/grok-ai-bots/import', { method: 'POST', body: payload });
          mergeGrokAiState(data);
          const importedKind = (data.bot?.kind || kind) === 'image' ? 'image' : 'text';
          if (importedKind === 'image') {
            selectedGrokImageBotId = data.bot?.id || selectedGrokImageBotId;
            if (kind === 'image') renderGrokImageBotsSettings();
          } else {
            selectedGrokBotId = data.bot?.id || selectedGrokBotId;
            if (kind === 'text') renderGrokTextBotsSettings();
          }
          const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
          const message = importedKind !== kind
            ? `Bot imported as ${importedKind} bot.${warnings} Open the ${importedKind} bot window to edit it.`
            : `Bot imported.${warnings}`;
          setGrokBotStatus(kind, message, warnings ? 'error' : 'success');
        } catch (e) {
          setGrokBotStatus(kind, e.message || 'Could not import JSON', 'error');
        } finally {
          const input = kind === 'text' ? $('#grokAiBotImportFile') : $('#grokAiImageBotImportFile');
          if (input) input.value = '';
        }
      }
    
      async function saveGrokChatBotSettings() {
        const chatId = Number($('#grokAiBotChatSelect')?.value || 0);
        const botId = Number($('#grokAiBotChatBotSelect')?.value || 0);
        const botExists = grokBotState.bots.some(bot => Number(bot.id) === Number(botId));
        if (!chatId || !botId) { setGrokTextChatStatus('Choose chat and bot', 'error'); return; }
        if (!botExists) {
          setGrokTextChatStatus('Save the bot first', 'error');
          await loadGrokAiState().then(renderGrokTextBotsSettings).catch(() => {});
          return;
        }
        try {
          const data = await api('/api/admin/grok-ai-bots/chat-settings', {
            method: 'PUT',
            body: {
              chatId,
              botId,
              enabled: $('#grokAiBotChatEnabled')?.checked,
              mode: $('#grokAiBotChatMode')?.value || 'simple',
              hot_context_limit: Number($('#grokAiBotChatHotLimit')?.value || 50),
              auto_react_on_mention: $('#grokAiBotChatAutoReact')?.checked,
            },
          });
          mergeGrokAiState(data);
          renderGrokChatBotSettings();
          setGrokTextChatStatus('Chat settings saved', 'success');
        } catch (e) {
          setGrokTextChatStatus(e.message || 'Could not save chat settings', 'error');
        }
      }
    
      async function saveGrokImageChatBotSettings() {
        const chatId = Number($('#grokAiImageBotChatSelect')?.value || 0);
        const botId = Number($('#grokAiImageBotChatBotSelect')?.value || 0);
        const botExists = grokBotState.imageBots.some(bot => Number(bot.id) === Number(botId));
        if (!chatId || !botId) { setGrokImageChatStatus('Choose chat and image bot', 'error'); return; }
        if (!botExists) {
          setGrokImageChatStatus('Save the image bot first', 'error');
          await loadGrokAiState().then(renderGrokImageBotsSettings).catch(() => {});
          return;
        }
        try {
          const data = await api('/api/admin/grok-ai-bots/chat-settings', {
            method: 'PUT',
            body: {
              chatId,
              botId,
              enabled: $('#grokAiImageBotChatEnabled')?.checked,
              mode: 'simple',
              hot_context_limit: 50,
            },
          });
          mergeGrokAiState(data);
          renderGrokImageChatBotSettings();
          setGrokImageChatStatus('Image bot chat settings saved', 'success');
        } catch (e) {
          setGrokImageChatStatus(e.message || 'Could not save image bot chat settings', 'error');
        }
      }
    
      async function loadGrokUniversalState() {
        const data = await api('/api/admin/grok-universal-bots');
        mergeGrokUniversalState(data);
        renderGrokUniversalBotsSettings();
        return data;
      }
    
      async function saveGrokUniversalBot() {
        const payload = grokUniversalBotFormPayload();
        if (!payload.name) { setGrokUniversalEditorStatus('Enter bot name', 'error'); return; }
        setGrokUniversalEditorStatus('Saving universal bot...', 'pending');
        try {
          const shouldUpdate = Boolean(selectedGrokUniversalBotId && grokUniversalState.bots.some(bot => Number(bot.id) === Number(selectedGrokUniversalBotId)));
          const url = shouldUpdate ? `/api/admin/grok-universal-bots/${selectedGrokUniversalBotId}` : '/api/admin/grok-universal-bots';
          const method = shouldUpdate ? 'PUT' : 'POST';
          const data = await api(url, { method, body: payload });
          mergeGrokUniversalState(data);
          selectedGrokUniversalBotId = data.bot?.id || selectedGrokUniversalBotId;
          syncGrokBotUser(data.bot);
          renderGrokUniversalBotsSettings();
          const status = buildVerifiedBotSaveStatus('Universal bot saved.', data.bot, payload, formatCapabilityState(data.bot || payload));
          setGrokUniversalEditorStatus(status.message, status.type);
        } catch (e) {
          setGrokUniversalEditorStatus(e.message || 'Could not save universal bot', 'error');
        }
      }
    
      async function uploadGrokUniversalBotAvatar(file) {
        if (!file) return;
        if (!selectedGrokUniversalBotId) {
          setGrokUniversalEditorStatus('Save the bot before adding an avatar', 'error');
          renderGrokUniversalBotAvatar(null);
          return;
        }
        const fd = new FormData();
        fd.append('avatar', file);
        setGrokUniversalEditorStatus('Uploading avatar...', 'pending');
        try {
          const data = await api(`/api/admin/grok-universal-bots/${selectedGrokUniversalBotId}/avatar`, { method: 'POST', body: fd });
          mergeGrokUniversalState(data);
          selectedGrokUniversalBotId = data.bot?.id || selectedGrokUniversalBotId;
          syncGrokBotUser(data.bot);
          renderGrokUniversalBotsSettings();
          refreshRenderedAiBotAvatar(data.bot);
          setGrokUniversalEditorStatus('Avatar saved', 'success');
        } catch (e) {
          setGrokUniversalEditorStatus(e.message || 'Could not upload avatar', 'error');
        }
      }
    
      async function removeGrokUniversalBotAvatar() {
        if (!selectedGrokUniversalBotId) return;
        try {
          const data = await api(`/api/admin/grok-universal-bots/${selectedGrokUniversalBotId}/avatar`, { method: 'DELETE' });
          mergeGrokUniversalState(data);
          selectedGrokUniversalBotId = data.bot?.id || selectedGrokUniversalBotId;
          syncGrokBotUser(data.bot);
          renderGrokUniversalBotsSettings();
          refreshRenderedAiBotAvatar(data.bot);
          setGrokUniversalEditorStatus('Avatar removed', 'success');
        } catch (e) {
          setGrokUniversalEditorStatus(e.message || 'Could not remove avatar', 'error');
        }
      }
    
      async function disableGrokUniversalBot() {
        if (!selectedGrokUniversalBotId) return;
        if (!confirm('Disable this Grok universal bot in all chats?')) return;
        try {
          const data = await api(`/api/admin/grok-universal-bots/${selectedGrokUniversalBotId}`, { method: 'DELETE' });
          mergeGrokUniversalState(data);
          renderGrokUniversalBotsSettings();
          setGrokUniversalEditorStatus('Universal bot disabled', 'success');
        } catch (e) {
          setGrokUniversalEditorStatus(e.message || 'Could not disable universal bot', 'error');
        }
      }
    
      async function testGrokUniversalBot() {
        if (!selectedGrokUniversalBotId) { setGrokUniversalEditorStatus('Save the bot first', 'error'); return; }
        setGrokUniversalEditorStatus('Testing universal bot...', 'pending');
        try {
          const data = await api(`/api/admin/grok-universal-bots/${selectedGrokUniversalBotId}/test`, {
            method: 'POST',
            body: {
              mode: $('#grokAiUniversalBotTestMode')?.value || 'auto',
            },
          });
          const text = data.result?.text ? data.result.text.slice(0, 500) : '';
          setGrokUniversalEditorStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
        } catch (e) {
          setGrokUniversalEditorStatus(e.message || 'Universal bot test failed', 'error');
        }
      }
    
      async function exportGrokUniversalBotJson() {
        if (!selectedGrokUniversalBotId) { setGrokUniversalEditorStatus('Choose a saved bot first', 'error'); return; }
        setGrokUniversalEditorStatus('Preparing JSON...', 'pending');
        try {
          const headers = {};
          if (token) headers.Authorization = 'Bearer ' + token;
          const res = await fetch(`/api/admin/grok-universal-bots/${selectedGrokUniversalBotId}/export`, { headers });
          if (!res.ok) {
            let data = {};
            try { data = await res.json(); } catch {}
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          const blob = await res.blob();
          const bot = currentGrokUniversalBot();
          const fallbackName = `bananza-grok-universal-${bot?.mention || selectedGrokUniversalBotId}.json`;
          const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          setGrokUniversalEditorStatus('JSON exported', 'success');
        } catch (e) {
          setGrokUniversalEditorStatus(e.message || 'Could not export JSON', 'error');
        }
      }
    
      async function importGrokUniversalBotJsonFile(file) {
        if (!file) return;
        setGrokUniversalEditorStatus('Importing JSON...', 'pending');
        try {
          const raw = await file.text();
          const payload = JSON.parse(raw);
          const data = await api('/api/admin/grok-universal-bots/import', { method: 'POST', body: payload });
          mergeGrokUniversalState(data);
          selectedGrokUniversalBotId = data.bot?.id || selectedGrokUniversalBotId;
          renderGrokUniversalBotsSettings();
          const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
          setGrokUniversalEditorStatus(`Universal bot imported.${warnings}`, warnings ? 'error' : 'success');
        } catch (e) {
          setGrokUniversalEditorStatus(e.message || 'Could not import JSON', 'error');
        } finally {
          const input = $('#grokAiUniversalBotImportFile');
          if (input) input.value = '';
        }
      }
    
      async function saveGrokUniversalChatBotSettings() {
        const chatId = Number($('#grokAiUniversalBotChatSelect')?.value || 0);
        const botId = Number($('#grokAiUniversalBotChatBotSelect')?.value || 0);
        const botExists = grokUniversalState.bots.some(bot => Number(bot.id) === Number(botId));
        if (!chatId || !botId) { setGrokUniversalChatStatus('Choose chat and bot', 'error'); return; }
        if (!botExists) {
          setGrokUniversalChatStatus('Save the bot first', 'error');
          await loadGrokUniversalState().catch(() => {});
          return;
        }
        try {
          const data = await api('/api/admin/grok-universal-bots/chat-settings', {
            method: 'PUT',
            body: {
              chatId,
              botId,
              enabled: $('#grokAiUniversalBotChatEnabled')?.checked,
              mode: $('#grokAiUniversalBotChatMode')?.value || 'simple',
              hot_context_limit: Number($('#grokAiUniversalBotChatHotLimit')?.value || 50),
              auto_react_on_mention: $('#grokAiUniversalBotChatAutoReact')?.checked,
            },
          });
          mergeGrokUniversalState(data);
          renderGrokUniversalChatBotSettings();
          setGrokUniversalChatStatus('Chat settings saved', 'success');
        } catch (e) {
          setGrokUniversalChatStatus(e.message || 'Could not save chat settings', 'error');
        }
      }
    

      return {
        GROK_TEXT_BOT_DIRTY_STATUS, setGrokStatus, setGrokAiStatus, setGrokTextStatus, setGrokImageStatus, setGrokUniversalStatus, setGrokAiProviderStatus, setGrokTextEditorStatus,
        setGrokImageEditorStatus, setGrokUniversalEditorStatus, setGrokTextChatStatus, setGrokImageChatStatus, setGrokUniversalChatStatus, setGrokBotStatus, setGrokAiModelStatus, wireAiBotToggleLabels,
        currentGrokBot, currentGrokImageBot, currentGrokUniversalBot, getGrokChatSetting, getGrokImageChatSetting, getGrokUniversalChatSetting, mergeGrokAiState, mergeGrokUniversalState,
        renderNamedGrokAvatar, renderGrokBotAvatar, renderGrokImageBotAvatar, renderGrokUniversalBotAvatar, mountGrokBotPanels, renderGrokGlobalTextModelOptions, renderGrokBotModelOptions, renderGrokUniversalBotModelOptions,
        renderGrokGlobalImageModelOptions, renderGrokImageBotModelOptions, renderGrokBotList, renderGrokImageBotList, renderGrokUniversalBotList, fillGrokBotForm, fillGrokImageBotForm, fillGrokUniversalBotForm,
        grokBotFormPayload, formatCapabilityState, currentGrokTextBotFormFingerprint, refreshGrokTextBotDirtyState, syncGrokTextBotFormFingerprint, grokImageBotFormPayload, grokUniversalBotFormPayload, renderGrokChatBotSettings,
        renderGrokImageChatBotSettings, renderGrokUniversalChatBotSettings, renderGrokAiSettings, renderGrokTextBotsSettings, renderGrokImageBotsSettings, renderGrokUniversalBotsSettings, grokAiSettingsPayload, persistGrokAiSettings,
        loadGrokAiState, syncGrokBotUser, saveGrokAiSettings, testGrokAiConnection, refreshGrokAiModels, deleteGrokAiKey, saveGrokBot, saveGrokImageBot,
        uploadGrokBotAvatar, removeGrokBotAvatar, disableGrokBot, testGrokBot, exportGrokBotJson, importGrokBotJsonFile, saveGrokChatBotSettings, saveGrokImageChatBotSettings,
        loadGrokUniversalState, saveGrokUniversalBot, uploadGrokUniversalBotAvatar, removeGrokUniversalBotAvatar, disableGrokUniversalBot, testGrokUniversalBot, exportGrokUniversalBotJson, importGrokUniversalBotJsonFile,
        saveGrokUniversalChatBotSettings,
      };
    }
  }

  aiAdmin.grokRuntime = { createLegacyGrokRuntime };
})();
