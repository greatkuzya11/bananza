(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdminRoot = root.aiAdmin = root.aiAdmin || {};

  function createEventController(options = {}) {
    const scope = options.scope || {};
    let bound = false;

    function bindEvents() {
      if (bound) return false;
      bound = true;
      with (scope) {
        $('#settingsAiBotsPanel')?.addEventListener('click', openAiBotSettingsModal);
        $('#settingsYandexAiPanel')?.addEventListener('click', openYandexAiSettingsModal);
        $('#settingsDeepSeekAiPanel')?.addEventListener('click', openDeepseekAiSettingsModal);
        $('#settingsQwenAiPanel')?.addEventListener('click', openQwenAiSettingsModal);
        $('#settingsGrokAiPanel')?.addEventListener('click', openGrokAiSettingsModal);

        grokImageRiskCancel?.addEventListener('click', () => {
          closeModal('grokImageRiskConfirmModal');
        });
        grokImageRiskConfirm?.addEventListener('click', () => {
          const resolve = grokImageRiskConfirmResolver;
          grokImageRiskConfirmResolver = null;
          closeModal('grokImageRiskConfirmModal');
          if (typeof resolve === 'function') resolve(true);
        });
    
        // AI bot admin settings
        bindAsyncActionButtons('aiBotsSaveSettings', null, 'Saving...', saveAiBotSettings);
        $('#aiBotsRefreshModels')?.addEventListener('click', () => {
          if ($('#aiBotsRefreshModels')?.dataset.adminBusy === '1') return;
          aiModelRefreshTriggeredByButton = true;
          setAiModelStatus('\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e \u043c\u043e\u0434\u0435\u043b\u0438...');
          loadAiModelOptions(true).catch((e) => setAiModelStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043c\u043e\u0434\u0435\u043b\u0438', 'error'));
        });
        bindAsyncActionButtons('aiBotsDeleteKey', null, 'Deleting...', deleteAiBotKey);
        $('#openAiOpenTextBots')?.addEventListener('click', openOpenAiTextBotsModal);
        $('#openAiOpenUniversalBots')?.addEventListener('click', openOpenAiUniversalBotsModal);
        $('#openAiOpenImageBots')?.addEventListener('click', openOpenAiImageBotsModal);
        $('#openAiOpenConvertBots')?.addEventListener('click', () => openContextConvertBotsModal('openai'));
        $('#openAiOpenChatShotBots')?.addEventListener('click', () => openChatShotBotsModal('openai'));
        $('#aiBotCreateNew')?.addEventListener('click', () => {
          fillAiBotForm(null);
          setAiBotStatus('\u041d\u043e\u0432\u044b\u0439 \u0431\u043e\u0442: \u0437\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043f\u043e\u043b\u044f \u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435');
        });
        bindAsyncActionButtons(['aiBotSave', 'aiBotSaveBottom'], null, 'Saving...', saveAiBot);
        bindAsyncActionButtons('aiBotDisable', null, 'Disabling...', disableAiBot);
        bindAsyncActionButtons('aiBotTest', null, 'Testing...', testAiBot);
        bindAsyncActionButtons('aiBotExportJson', null, 'Preparing...', exportAiBotJson);
        $('#aiBotImportJson')?.addEventListener('click', () => $('#aiBotImportFile')?.click());
        $('#aiBotImportFile')?.addEventListener('change', (event) => importAiBotJsonFile(event.target.files?.[0]));
        $('#aiBotAvatarInput')?.addEventListener('change', (event) => uploadAiBotAvatar(event.target.files?.[0]));
        bindAsyncActionButtons('removeAiBotAvatar', null, 'Removing...', removeAiBotAvatar);
        $('#aiBotName')?.addEventListener('input', () => {
          if (!currentAiBot()?.avatar_url) renderAiBotAvatar(currentAiBot());
        });
        $('#aiBotList')?.addEventListener('click', (e) => {
          const btn = e.target.closest('.ai-bot-list-item');
          if (!btn) return;
          const bot = aiBotState.bots.find(item => item.id === Number(btn.dataset.botId));
          if (bot) fillAiBotForm(bot);
        });
        $('#aiBotChatSelect')?.addEventListener('change', renderAiChatBotSettings);
        $('#aiBotChatBotSelect')?.addEventListener('change', renderAiChatBotSettings);
        bindAsyncActionButtons('aiBotChatSave', null, 'Saving...', saveAiChatBotSettings);
        $('#openAiUniversalBotCreateNew')?.addEventListener('click', () => {
          fillOpenAiUniversalBotForm(null);
          setOpenAiUniversalStatus('New OpenAI universal bot: fill fields and save');
        });
        bindAsyncActionButtons(['openAiUniversalBotSave', 'openAiUniversalBotSaveBottom'], null, 'Saving...', saveOpenAiUniversalBot);
        bindAsyncActionButtons('openAiUniversalBotDisable', null, 'Disabling...', disableOpenAiUniversalBot);
        bindAsyncActionButtons('openAiUniversalBotTest', null, 'Testing...', testOpenAiUniversalBot);
        bindAsyncActionButtons('openAiUniversalBotExportJson', null, 'Preparing...', exportOpenAiUniversalBotJson);
        $('#openAiUniversalBotImportJson')?.addEventListener('click', () => $('#openAiUniversalBotImportFile')?.click());
        $('#openAiUniversalBotImportFile')?.addEventListener('change', (event) => importOpenAiUniversalBotJsonFile(event.target.files?.[0]));
        $('#openAiUniversalBotAvatarInput')?.addEventListener('change', (event) => uploadOpenAiUniversalBotAvatar(event.target.files?.[0]));
        bindAsyncActionButtons('removeOpenAiUniversalBotAvatar', null, 'Removing...', removeOpenAiUniversalBotAvatar);
        $('#openAiUniversalBotName')?.addEventListener('input', () => {
          if (!currentOpenAiUniversalBot()?.avatar_url) renderOpenAiUniversalBotAvatar(currentOpenAiUniversalBot());
        });
        $('#openAiUniversalBotList')?.addEventListener('click', (e) => {
          const btn = e.target.closest('.ai-bot-list-item');
          if (!btn) return;
          const bot = openAiUniversalState.bots.find(item => Number(item.id) === Number(btn.dataset.botId));
          if (bot) fillOpenAiUniversalBotForm(bot);
        });
        $('#openAiUniversalBotChatSelect')?.addEventListener('change', renderOpenAiUniversalChatBotSettings);
        $('#openAiUniversalBotChatBotSelect')?.addEventListener('change', renderOpenAiUniversalChatBotSettings);
        bindAsyncActionButtons('openAiUniversalBotChatSave', null, 'Saving...', saveOpenAiUniversalChatBotSettings);
        $('#openAiImageBotCreateNew')?.addEventListener('click', () => {
          fillOpenAiImageBotForm(null);
          setOpenAiImageStatus('New OpenAI image bot: fill fields and save');
        });
        bindAsyncActionButtons(['openAiImageBotSave', 'openAiImageBotSaveBottom'], null, 'Saving...', saveOpenAiImageBot);
        bindAsyncActionButtons('openAiImageBotDisable', null, 'Disabling...', disableOpenAiImageBot);
        bindAsyncActionButtons('openAiImageBotTest', null, 'Testing...', testOpenAiImageBot);
        bindAsyncActionButtons('openAiImageBotExportJson', null, 'Preparing...', exportOpenAiImageBotJson);
        $('#openAiImageBotImportJson')?.addEventListener('click', () => $('#openAiImageBotImportFile')?.click());
        $('#openAiImageBotImportFile')?.addEventListener('change', (event) => importOpenAiImageBotJsonFile(event.target.files?.[0]));
        $('#openAiImageBotAvatarInput')?.addEventListener('change', (event) => uploadOpenAiImageBotAvatar(event.target.files?.[0]));
        bindAsyncActionButtons('removeOpenAiImageBotAvatar', null, 'Removing...', removeOpenAiImageBotAvatar);
        $('#openAiImageBotName')?.addEventListener('input', () => {
          if (!currentOpenAiImageBot()?.avatar_url) renderOpenAiImageBotAvatar(currentOpenAiImageBot());
        });
        $('#openAiImageBotList')?.addEventListener('click', (e) => {
          const btn = e.target.closest('.ai-bot-list-item');
          if (!btn) return;
          const bot = openAiImageState.bots.find(item => Number(item.id) === Number(btn.dataset.botId));
          if (bot) fillOpenAiImageBotForm(bot);
        });
        $('#openAiImageBotChatSelect')?.addEventListener('change', renderOpenAiImageChatBotSettings);
        $('#openAiImageBotChatBotSelect')?.addEventListener('change', renderOpenAiImageChatBotSettings);
        bindAsyncActionButtons('openAiImageBotChatSave', null, 'Saving...', saveOpenAiImageChatBotSettings);
    
        // Yandex AI bot admin settings
        bindAsyncActionButtons('yandexAiSaveSettings', null, 'Saving...', saveYandexAiSettings);
        bindAsyncActionButtons('yandexAiTestConnection', null, 'Testing...', testYandexAiConnection);
        bindAsyncActionButtons('yandexAiRefreshModels', null, 'Refreshing...', refreshYandexAiModels);
        bindAsyncActionButtons('yandexAiDeleteKey', null, 'Deleting...', deleteYandexAiKey);
        $('#yandexAiOpenConvertBots')?.addEventListener('click', () => openContextConvertBotsModal('yandex'));
        $('#yandexAiBotCreateNew')?.addEventListener('click', () => {
          fillYandexBotForm(null);
          setYandexBotStatus('New Yandex bot: fill fields and save');
        });
        bindAsyncActionButtons('yandexAiBotSave', null, 'Saving...', saveYandexBot);
        bindAsyncActionButtons('yandexAiBotDisable', null, 'Disabling...', disableYandexBot);
        bindAsyncActionButtons('yandexAiBotTest', null, 'Testing...', testYandexBot);
        bindAsyncActionButtons('yandexAiBotExportJson', null, 'Preparing...', exportYandexBotJson);
        $('#yandexAiBotImportJson')?.addEventListener('click', () => $('#yandexAiBotImportFile')?.click());
        $('#yandexAiBotImportFile')?.addEventListener('change', (event) => importYandexBotJsonFile(event.target.files?.[0]));
        $('#yandexAiBotAvatarInput')?.addEventListener('change', (event) => uploadYandexBotAvatar(event.target.files?.[0]));
        bindAsyncActionButtons('removeYandexAiBotAvatar', null, 'Removing...', removeYandexBotAvatar);
        $('#yandexAiBotName')?.addEventListener('input', () => {
          if (!currentYandexBot()?.avatar_url) renderYandexBotAvatar(currentYandexBot());
        });
        $('#yandexAiBotList')?.addEventListener('click', (e) => {
          const btn = e.target.closest('.ai-bot-list-item');
          if (!btn) return;
          const bot = yandexBotState.bots.find(item => Number(item.id) === Number(btn.dataset.botId));
          if (bot) fillYandexBotForm(bot);
        });
        $('#yandexAiBotChatSelect')?.addEventListener('change', renderYandexChatBotSettings);
        $('#yandexAiBotChatBotSelect')?.addEventListener('change', renderYandexChatBotSettings);
        bindAsyncActionButtons('yandexAiBotChatSave', null, 'Saving...', saveYandexChatBotSettings);
    
        // DeepSeek AI bot admin settings
        bindAsyncActionButtons('deepseekAiSaveSettings', null, 'Saving...', saveDeepseekAiSettings);
        bindAsyncActionButtons('deepseekAiTestConnection', null, 'Testing...', testDeepseekAiConnection);
        bindAsyncActionButtons('deepseekAiRefreshModels', null, 'Refreshing...', refreshDeepseekAiModels);
        bindAsyncActionButtons('deepseekAiCheckBalance', null, 'Checking...', checkDeepseekAiBalance);
        bindAsyncActionButtons('deepseekAiDeleteKey', null, 'Deleting...', deleteDeepseekAiKey);
        $('#deepseekAiOpenTextBots')?.addEventListener('click', openDeepseekTextBotsModal);
        $('#deepseekAiOpenConvertBots')?.addEventListener('click', () => openContextConvertBotsModal('deepseek'));
        $('#deepseekAiBotCreateNew')?.addEventListener('click', () => {
          fillDeepseekBotForm(null);
          setDeepseekBotStatus('New DeepSeek bot: fill fields and save');
        });
        bindAsyncActionButtons('deepseekAiBotSave', null, 'Saving...', saveDeepseekBot);
        bindAsyncActionButtons('deepseekAiBotDisable', null, 'Disabling...', disableDeepseekBot);
        bindAsyncActionButtons('deepseekAiBotTest', null, 'Testing...', testDeepseekBot);
        bindAsyncActionButtons('deepseekAiBotExportJson', null, 'Preparing...', exportDeepseekBotJson);
        $('#deepseekAiBotImportJson')?.addEventListener('click', () => $('#deepseekAiBotImportFile')?.click());
        $('#deepseekAiBotImportFile')?.addEventListener('change', (event) => importDeepseekBotJsonFile(event.target.files?.[0]));
        $('#deepseekAiBotAvatarInput')?.addEventListener('change', (event) => uploadDeepseekBotAvatar(event.target.files?.[0]));
        bindAsyncActionButtons('removeDeepseekAiBotAvatar', null, 'Removing...', removeDeepseekBotAvatar);
        $('#deepseekAiBotName')?.addEventListener('input', () => {
          if (!currentDeepseekBot()?.avatar_url) renderDeepseekBotAvatar(currentDeepseekBot());
        });
        $('#deepseekAiBotList')?.addEventListener('click', (e) => {
          const btn = e.target.closest('.ai-bot-list-item');
          if (!btn) return;
          const bot = deepseekBotState.bots.find(item => Number(item.id) === Number(btn.dataset.botId));
          if (bot) fillDeepseekBotForm(bot);
        });
        $('#deepseekAiBotChatSelect')?.addEventListener('change', renderDeepseekChatBotSettings);
        $('#deepseekAiBotChatBotSelect')?.addEventListener('change', renderDeepseekChatBotSettings);
        bindAsyncActionButtons('deepseekAiBotChatSave', null, 'Saving...', saveDeepseekChatBotSettings);
    
        // Qwen AI bot admin settings
        bindAsyncActionButtons('qwenAiSaveSettings', null, 'Saving...', saveQwenAiSettings);
        bindAsyncActionButtons('qwenAiTestConnection', null, 'Testing...', testQwenAiConnection);
        bindAsyncActionButtons('qwenAiRefreshModels', null, 'Refreshing...', refreshQwenAiModels);
        bindAsyncActionButtons('qwenAiDeleteKey', null, 'Deleting...', deleteQwenAiKey);
        $('#qwenAiOpenTextBots')?.addEventListener('click', openQwenTextBotsModal);
        $('#qwenAiOpenConvertBots')?.addEventListener('click', () => openContextConvertBotsModal('qwen'));
        $('#qwenAiBotCreateNew')?.addEventListener('click', () => {
          fillQwenBotForm(null);
          setQwenBotStatus('New Qwen bot: fill fields and save');
        });
        bindAsyncActionButtons('qwenAiBotSave', null, 'Saving...', saveQwenBot);
        bindAsyncActionButtons('qwenAiBotDisable', null, 'Disabling...', disableQwenBot);
        bindAsyncActionButtons('qwenAiBotTest', null, 'Testing...', testQwenBot);
        bindAsyncActionButtons('qwenAiBotExportJson', null, 'Preparing...', exportQwenBotJson);
        $('#qwenAiBotImportJson')?.addEventListener('click', () => $('#qwenAiBotImportFile')?.click());
        $('#qwenAiBotImportFile')?.addEventListener('change', (event) => importQwenBotJsonFile(event.target.files?.[0]));
        $('#qwenAiBotAvatarInput')?.addEventListener('change', (event) => uploadQwenBotAvatar(event.target.files?.[0]));
        bindAsyncActionButtons('removeQwenAiBotAvatar', null, 'Removing...', removeQwenBotAvatar);
        $('#qwenAiBotName')?.addEventListener('input', () => {
          if (!currentQwenBot()?.avatar_url) renderQwenBotAvatar(currentQwenBot());
        });
        $('#qwenAiBotList')?.addEventListener('click', (e) => {
          const btn = e.target.closest('.ai-bot-list-item');
          if (!btn) return;
          const bot = qwenBotState.bots.find(item => Number(item.id) === Number(btn.dataset.botId));
          if (bot) fillQwenBotForm(bot);
        });
        $('#qwenAiBotChatSelect')?.addEventListener('change', renderQwenChatBotSettings);
        $('#qwenAiBotChatBotSelect')?.addEventListener('change', renderQwenChatBotSettings);
        bindAsyncActionButtons('qwenAiBotChatSave', null, 'Saving...', saveQwenChatBotSettings);
    
        // Grok AI bot admin settings
        bindAsyncActionButtons('grokAiSaveSettings', null, 'Saving...', saveGrokAiSettings);
        bindAsyncActionButtons('grokAiTestConnection', null, 'Testing...', testGrokAiConnection);
        bindAsyncActionButtons('grokAiRefreshModels', null, 'Refreshing...', refreshGrokAiModels);
        bindAsyncActionButtons('grokAiDeleteKey', null, 'Deleting...', deleteGrokAiKey);
        $('#grokAiOpenTextBots')?.addEventListener('click', openGrokTextBotsModal);
        $('#grokAiOpenImageBots')?.addEventListener('click', openGrokImageBotsModal);
        $('#grokAiOpenUniversalBots')?.addEventListener('click', openGrokUniversalBotsModal);
        $('#grokAiOpenConvertBots')?.addEventListener('click', () => openContextConvertBotsModal('grok'));
        $('#grokAiOpenChatShotBots')?.addEventListener('click', () => openChatShotBotsModal('grok'));
        $('#grokAiBotCreateNew')?.addEventListener('click', () => {
          fillGrokBotForm(null);
          setGrokTextEditorStatus('New Grok text bot: fill fields and save');
        });
        bindAsyncActionButtons(['grokAiBotSave', 'grokAiBotSaveBottom'], null, 'Saving...', saveGrokBot);
        bindAsyncActionButtons('grokAiBotDisable', null, 'Disabling...', () => disableGrokBot('text'));
        bindAsyncActionButtons('grokAiBotTest', null, 'Testing...', () => testGrokBot('text'));
        bindAsyncActionButtons('grokAiBotExportJson', null, 'Preparing...', () => exportGrokBotJson('text'));
        $('#grokAiBotImportJson')?.addEventListener('click', () => $('#grokAiBotImportFile')?.click());
        $('#grokAiBotImportFile')?.addEventListener('change', (event) => importGrokBotJsonFile(event.target.files?.[0], 'text'));
        $('#grokAiBotAvatarInput')?.addEventListener('change', (event) => uploadGrokBotAvatar(event.target.files?.[0], 'text'));
        bindAsyncActionButtons('removeGrokAiBotAvatar', null, 'Removing...', () => removeGrokBotAvatar('text'));
        $('#grokAiBotName')?.addEventListener('input', () => {
          if (!currentGrokBot()?.avatar_url) renderGrokBotAvatar(currentGrokBot());
        });
        [
          'grokAiBotName',
          'grokAiBotMention',
          'grokAiBotEnabled',
          'grokAiBotResponseModel',
          'grokAiBotSummaryModel',
          'grokAiBotTemperature',
          'grokAiBotMaxTokens',
          'grokAiBotStyle',
          'grokAiBotTone',
          'grokAiBotRules',
          'grokAiBotSpeech',
        ].forEach((id) => {
          $(id)?.addEventListener('input', refreshGrokTextBotDirtyState);
          $(id)?.addEventListener('change', refreshGrokTextBotDirtyState);
        });
        $('#grokAiBotList')?.addEventListener('click', (e) => {
          const btn = e.target.closest('.ai-bot-list-item');
          if (!btn) return;
          const bot = grokBotState.bots.find(item => Number(item.id) === Number(btn.dataset.botId));
          if (bot) fillGrokBotForm(bot);
        });
        $('#grokAiBotChatSelect')?.addEventListener('change', renderGrokChatBotSettings);
        $('#grokAiBotChatBotSelect')?.addEventListener('change', renderGrokChatBotSettings);
        bindAsyncActionButtons('grokAiBotChatSave', null, 'Saving...', saveGrokChatBotSettings);
    
        $('#grokAiImageBotCreateNew')?.addEventListener('click', () => {
          fillGrokImageBotForm(null);
          setGrokImageEditorStatus('New Grok image bot: fill fields and save');
        });
        bindAsyncActionButtons('grokAiImageBotSave', null, 'Saving...', saveGrokImageBot);
        bindAsyncActionButtons('grokAiImageBotDisable', null, 'Disabling...', () => disableGrokBot('image'));
        bindAsyncActionButtons('grokAiImageBotTest', null, 'Testing...', () => testGrokBot('image'));
        bindAsyncActionButtons('grokAiImageBotExportJson', null, 'Preparing...', () => exportGrokBotJson('image'));
        $('#grokAiImageBotImportJson')?.addEventListener('click', () => $('#grokAiImageBotImportFile')?.click());
        $('#grokAiImageBotImportFile')?.addEventListener('change', (event) => importGrokBotJsonFile(event.target.files?.[0], 'image'));
        $('#grokAiImageBotAvatarInput')?.addEventListener('change', (event) => uploadGrokBotAvatar(event.target.files?.[0], 'image'));
        bindAsyncActionButtons('removeGrokAiImageBotAvatar', null, 'Removing...', () => removeGrokBotAvatar('image'));
        $('#grokAiImageBotName')?.addEventListener('input', () => {
          if (!currentGrokImageBot()?.avatar_url) renderGrokImageBotAvatar(currentGrokImageBot());
        });
        $('#grokAiImageBotList')?.addEventListener('click', (e) => {
          const btn = e.target.closest('.ai-bot-list-item');
          if (!btn) return;
          const bot = grokBotState.imageBots.find(item => Number(item.id) === Number(btn.dataset.botId));
          if (bot) fillGrokImageBotForm(bot);
        });
        $('#grokAiImageBotChatSelect')?.addEventListener('change', renderGrokImageChatBotSettings);
        $('#grokAiImageBotChatBotSelect')?.addEventListener('change', renderGrokImageChatBotSettings);
        bindAsyncActionButtons('grokAiImageBotChatSave', null, 'Saving...', saveGrokImageChatBotSettings);
        $('#grokAiUniversalBotCreateNew')?.addEventListener('click', () => {
          fillGrokUniversalBotForm(null);
          setGrokUniversalEditorStatus('New Grok universal bot: fill fields and save');
        });
        bindAsyncActionButtons('grokAiUniversalBotSave', null, 'Saving...', saveGrokUniversalBot);
        bindAsyncActionButtons('grokAiUniversalBotDisable', null, 'Disabling...', disableGrokUniversalBot);
        bindAsyncActionButtons('grokAiUniversalBotTest', null, 'Testing...', testGrokUniversalBot);
        bindAsyncActionButtons('grokAiUniversalBotExportJson', null, 'Preparing...', exportGrokUniversalBotJson);
        $('#grokAiUniversalBotImportJson')?.addEventListener('click', () => $('#grokAiUniversalBotImportFile')?.click());
        $('#grokAiUniversalBotImportFile')?.addEventListener('change', (event) => importGrokUniversalBotJsonFile(event.target.files?.[0]));
        $('#grokAiUniversalBotAvatarInput')?.addEventListener('change', (event) => uploadGrokUniversalBotAvatar(event.target.files?.[0]));
        bindAsyncActionButtons('removeGrokAiUniversalBotAvatar', null, 'Removing...', removeGrokUniversalBotAvatar);
        $('#grokAiUniversalBotName')?.addEventListener('input', () => {
          if (!currentGrokUniversalBot()?.avatar_url) renderGrokUniversalBotAvatar(currentGrokUniversalBot());
        });
        $('#grokAiUniversalBotList')?.addEventListener('click', (e) => {
          const btn = e.target.closest('.ai-bot-list-item');
          if (!btn) return;
          const bot = grokUniversalState.bots.find(item => Number(item.id) === Number(btn.dataset.botId));
          if (bot) fillGrokUniversalBotForm(bot);
        });
        $('#grokAiUniversalBotChatSelect')?.addEventListener('change', renderGrokUniversalChatBotSettings);
        $('#grokAiUniversalBotChatBotSelect')?.addEventListener('change', renderGrokUniversalChatBotSettings);
        bindAsyncActionButtons('grokAiUniversalBotChatSave', null, 'Saving...', saveGrokUniversalChatBotSettings);
        $('#contextConvertBotCreateNew')?.addEventListener('click', () => {
          selectedContextConvertBotIds[activeContextConvertProvider] = null;
          renderContextConvertAdminSettings();
          setContextConvertBotStatus('New convert bot: fill fields and save');
          setContextConvertChatStatus('');
        });
        bindAsyncActionButtons(['contextConvertBotSave', 'contextConvertBotSaveBottom'], null, 'Saving...', saveContextConvertAdminBot);
        bindAsyncActionButtons('contextConvertBotDisable', null, 'Disabling...', disableContextConvertAdminBot);
        bindAsyncActionButtons('contextConvertBotTest', null, 'Testing...', testContextConvertAdminBot);
        bindAsyncActionButtons('contextConvertBotExportJson', null, 'Preparing...', exportContextConvertAdminBot);
        $('#contextConvertBotEnabled')?.addEventListener('change', (event) => {
          const allChatsToggle = $('#contextConvertBotAvailableAllChats');
          if (allChatsToggle) allChatsToggle.disabled = !event.target.checked;
        });
        $('#contextConvertBotImportJson')?.addEventListener('click', () => $('#contextConvertBotImportFile')?.click());
        $('#contextConvertBotImportFile')?.addEventListener('change', (event) => {
          importContextConvertAdminBot(event.target.files?.[0]);
          event.target.value = '';
        });
        $('#contextConvertBotList')?.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-context-convert-bot-id]');
          if (!btn) return;
          selectedContextConvertBotIds[activeContextConvertProvider] = Number(btn.dataset.contextConvertBotId || 0) || null;
          renderContextConvertAdminSettings();
          setContextConvertBotStatus('');
          setContextConvertChatStatus('');
        });
        $('#contextConvertBotChatSelect')?.addEventListener('change', renderContextConvertChatSettings);
        $('#contextConvertBotChatBotSelect')?.addEventListener('change', renderContextConvertChatSettings);
        bindAsyncActionButtons('contextConvertBotChatSave', null, 'Saving...', saveContextConvertAdminChatSetting);
        $('#chatShotBotCreateNew')?.addEventListener('click', () => {
          selectedChatShotBotIds[activeChatShotProvider] = null;
          renderChatShotAdminSettings();
          setChatShotBotStatus('New ChatShot bot: fill fields and save');
          setChatShotAdminChatStatus('');
        });
        bindAsyncActionButtons(['chatShotBotSave', 'chatShotBotSaveBottom'], null, 'Saving...', saveChatShotAdminBot);
        bindAsyncActionButtons('chatShotBotDisable', null, 'Disabling...', disableChatShotAdminBot);
        bindAsyncActionButtons('chatShotBotTest', null, 'Testing...', testChatShotAdminBot);
        bindAsyncActionButtons('chatShotBotExportJson', null, 'Preparing...', exportChatShotAdminBot);
        $('#chatShotBotEnabled')?.addEventListener('change', (event) => {
          const allChatsToggle = $('#chatShotBotAvailableAllChats');
          if (allChatsToggle) allChatsToggle.disabled = !event.target.checked;
        });
        $('#chatShotBotImportJson')?.addEventListener('click', () => $('#chatShotBotImportFile')?.click());
        $('#chatShotBotImportFile')?.addEventListener('change', (event) => {
          importChatShotAdminBot(event.target.files?.[0]);
          event.target.value = '';
        });
        $('#chatShotBotList')?.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-chat-shot-bot-id]');
          if (!btn) return;
          selectedChatShotBotIds[activeChatShotProvider] = Number(btn.dataset.chatShotBotId || 0) || null;
          renderChatShotAdminSettings();
          setChatShotBotStatus('');
          setChatShotAdminChatStatus('');
        });
        $('#chatShotBotChatSelect')?.addEventListener('change', renderChatShotAdminChatSettings);
        $('#chatShotBotChatBotSelect')?.addEventListener('change', renderChatShotAdminChatSettings);
        bindAsyncActionButtons('chatShotBotChatSave', null, 'Saving...', saveChatShotAdminChatSetting);
    

      }
      return true;
    }

    return { bindEvents };
  }

  aiAdminRoot.createEventController = createEventController;
})();
