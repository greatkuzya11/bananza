(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};
  const compositionRoot = bootRoot.composition = bootRoot.composition || {};

  compositionRoot.composeAiAdmin = function composeAiAdmin(scope = {}) {
    with (scope) {
      const AI_ADMIN_EXPORT_NAMES = `
        aiAdminController aiAdminRuntimeApi installAiAdminRuntimeModules ensureAiRuntimeFeature
        ensureOpenAiRuntime ensureLocalProvidersRuntime ensureGrokRuntime ensureContextChatShotRuntime ensureGrokRiskRuntime ensureFullAiRuntime ensureAiAdminRuntime
        setInlineStatus resolveActionButtons setActionButtonsPending withActionButtons bindAsyncActionButtons setOpenAiStatus
        setAiBotModalStatus setAiBotSettingsStatus setAiBotStatus setAiBotTextModalStatus setAiBotChatStatus setAiModelStatus
        uniqueAiModelValues setAiModelSelectOptions setStaticSelectOptions syncSharedOpenAiSettings syncSharedGrokSettings renderAiModelOptions
        loadAiModelOptions mergeAiBotState currentAiBot setOpenAiUniversalModalStatus setOpenAiUniversalStatus setOpenAiUniversalChatStatus
        mergeOpenAiUniversalState currentOpenAiUniversalBot getOpenAiUniversalChatSetting renderOpenAiUniversalModelOptions renderOpenAiUniversalBotAvatar renderOpenAiUniversalBotList
        fillOpenAiUniversalBotForm openAiUniversalBotFormPayload renderOpenAiUniversalChatBotSettings renderOpenAiUniversalSettings getAiChatSetting renderAiBotAvatar
        refreshRenderedAiBotAvatar providerInteractiveEnabled providerInteractiveSummary normalizeBotSaveComparisonValue verifyBotSaveResponse buildVerifiedBotSaveStatus
        fillAiBotForm aiBotFormPayload renderAiBotList renderAiChatBotSettings renderOpenAiProviderSettings renderOpenAiTextBotsSettings
        renderAiBotSettings aiBotSettingsPayload persistAiBotSettings loadAiBotState saveAiBotSettings deleteAiBotKey
        saveAiBot uploadAiBotAvatar removeAiBotAvatar disableAiBot testAiBot filenameFromContentDisposition
        exportAiBotJson importAiBotJsonFile saveAiChatBotSettings loadOpenAiUniversalState syncOpenAiUniversalBotUser saveOpenAiUniversalBot
        uploadOpenAiUniversalBotAvatar removeOpenAiUniversalBotAvatar disableOpenAiUniversalBot testOpenAiUniversalBot exportOpenAiUniversalBotJson importOpenAiUniversalBotJsonFile
        saveOpenAiUniversalChatBotSettings setOpenAiImageModalStatus setOpenAiImageStatus setOpenAiImageChatStatus mergeOpenAiImageState currentOpenAiImageBot
        getOpenAiImageChatSetting renderOpenAiImageModelOptions renderOpenAiImageBotAvatar renderOpenAiImageBotList fillOpenAiImageBotForm openAiImageBotFormPayload
        renderOpenAiImageChatBotSettings renderOpenAiImageSettings loadOpenAiImageState syncOpenAiImageBotUser saveOpenAiImageBot uploadOpenAiImageBotAvatar
        removeOpenAiImageBotAvatar disableOpenAiImageBot testOpenAiImageBot exportOpenAiImageBotJson importOpenAiImageBotJsonFile saveOpenAiImageChatBotSettings
        setDeepseekAiStatus setDeepseekAiProviderStatus setDeepseekAiBalanceStatus setDeepseekBotStatus setDeepseekChatStatus setDeepseekAiModelStatus
        currentDeepseekBot getDeepseekChatSetting mergeDeepseekAiState renderDeepseekModelOptions renderDeepseekBotAvatar fillDeepseekBotForm
        deepseekBotFormPayload renderDeepseekBotList renderDeepseekChatBotSettings renderDeepseekAiSettings deepseekAiSettingsPayload persistDeepseekAiSettings
        loadDeepseekAiState saveDeepseekAiSettings testDeepseekAiConnection formatDeepseekBalanceValue formatDeepseekBalanceResult checkDeepseekAiBalance
        refreshDeepseekAiModels deleteDeepseekAiKey saveDeepseekBot uploadDeepseekBotAvatar removeDeepseekBotAvatar disableDeepseekBot
        testDeepseekBot exportDeepseekBotJson importDeepseekBotJsonFile saveDeepseekChatBotSettings setQwenAiStatus setQwenAiProviderStatus
        setQwenBotStatus setQwenChatStatus setQwenAiModelStatus currentQwenBot getQwenChatSetting mergeQwenAiState
        renderQwenModelOptions renderQwenBotAvatar fillQwenBotForm qwenBotFormPayload renderQwenBotList renderQwenChatBotSettings
        renderQwenAiSettings qwenAiSettingsPayload persistQwenAiSettings loadQwenAiState saveQwenAiSettings testQwenAiConnection
        refreshQwenAiModels deleteQwenAiKey saveQwenBot uploadQwenBotAvatar removeQwenBotAvatar disableQwenBot
        testQwenBot exportQwenBotJson importQwenBotJsonFile saveQwenChatBotSettings setYandexAiStatus setYandexAiProviderStatus
        setYandexBotStatus setYandexChatStatus setYandexAiModelStatus formatUiErrorMessage currentYandexBot getYandexChatSetting
        mergeYandexAiState renderYandexModelOptions renderYandexBotAvatar fillYandexBotForm yandexBotFormPayload renderYandexBotList
        renderYandexChatBotSettings renderYandexAiSettings yandexAiSettingsPayload persistYandexAiSettings loadYandexAiState saveYandexAiSettings
        testYandexAiConnection refreshYandexAiModels deleteYandexAiKey saveYandexBot uploadYandexBotAvatar removeYandexBotAvatar
        disableYandexBot testYandexBot exportYandexBotJson importYandexBotJsonFile saveYandexChatBotSettings
        GROK_TEXT_BOT_DIRTY_STATUS setGrokStatus setGrokAiStatus setGrokTextStatus setGrokImageStatus setGrokUniversalStatus
        setGrokAiProviderStatus setGrokTextEditorStatus setGrokImageEditorStatus setGrokUniversalEditorStatus setGrokTextChatStatus setGrokImageChatStatus
        setGrokUniversalChatStatus setGrokBotStatus setGrokAiModelStatus wireAiBotToggleLabels currentGrokBot currentGrokImageBot
        currentGrokUniversalBot getGrokChatSetting getGrokImageChatSetting getGrokUniversalChatSetting mergeGrokAiState mergeGrokUniversalState
        renderNamedGrokAvatar renderGrokBotAvatar renderGrokImageBotAvatar renderGrokUniversalBotAvatar mountGrokBotPanels renderGrokGlobalTextModelOptions
        renderGrokBotModelOptions renderGrokUniversalBotModelOptions renderGrokGlobalImageModelOptions renderGrokImageBotModelOptions renderGrokBotList renderGrokImageBotList
        renderGrokUniversalBotList fillGrokBotForm fillGrokImageBotForm fillGrokUniversalBotForm grokBotFormPayload formatCapabilityState
        currentGrokTextBotFormFingerprint refreshGrokTextBotDirtyState syncGrokTextBotFormFingerprint grokImageBotFormPayload grokUniversalBotFormPayload renderGrokChatBotSettings
        renderGrokImageChatBotSettings renderGrokUniversalChatBotSettings renderGrokAiSettings renderGrokTextBotsSettings renderGrokImageBotsSettings renderGrokUniversalBotsSettings
        grokAiSettingsPayload persistGrokAiSettings loadGrokAiState syncGrokBotUser saveGrokAiSettings testGrokAiConnection
        refreshGrokAiModels deleteGrokAiKey saveGrokBot saveGrokImageBot uploadGrokBotAvatar removeGrokBotAvatar
        disableGrokBot testGrokBot exportGrokBotJson importGrokBotJsonFile saveGrokChatBotSettings saveGrokImageChatBotSettings
        loadGrokUniversalState saveGrokUniversalBot uploadGrokUniversalBotAvatar removeGrokUniversalBotAvatar disableGrokUniversalBot testGrokUniversalBot
        exportGrokUniversalBotJson importGrokUniversalBotJsonFile saveGrokUniversalChatBotSettings retryGrokImageRiskPrompt jumpToSavedOriginal normalizeMentionTarget
        escapeRegExpText extractMentionTokensFromText isGrokImageBotTarget isUniversalBotTarget isGrokUniversalBotTarget grokUniversalTargetAllowsImage
        buildReplyBotTarget getDirectPrivateAiBotTarget getUniversalBotModes resolveComposerUniversalBotTarget renderComposerAiOverride updateComposerAiOverrideState
        getComposerAiOverridePayload stripTriggeredBotMention resolveTriggeredGrokImageBot analyzeOutgoingGrokImageRisk renderGrokImageRiskTerms openGrokImageRiskConfirm
        contextConvertProviderLabel providerAccent contextConvertRouteBase currentContextConvertAdminState currentContextConvertAdminBot getContextConvertChatSetting
        setContextConvertInlineStatus setContextConvertModalStatus setContextConvertBotStatus setContextConvertChatStatus mergeContextConvertAdminState renderContextConvertBotList
        renderContextConvertForm renderContextConvertChatSettings renderContextConvertAdminSettings contextConvertAdminFormPayload loadContextConvertAdminState openContextConvertBotsModal
        saveContextConvertAdminBot disableContextConvertAdminBot testContextConvertAdminBot exportContextConvertAdminBot importContextConvertAdminBot saveContextConvertAdminChatSetting
        chatShotRouteBase currentChatShotAdminState currentChatShotAdminBot getChatShotAdminChatSetting setChatShotModalStatus setChatShotBotStatus
        setChatShotAdminChatStatus mergeChatShotAdminState renderChatShotBotList renderChatShotAdminForm renderChatShotAdminChatSettings renderChatShotAdminSettings
        chatShotAdminFormPayload loadChatShotAdminState openChatShotBotsModal saveChatShotAdminBot disableChatShotAdminBot testChatShotAdminBot
        exportChatShotAdminBot importChatShotAdminBot saveChatShotAdminChatSetting normalizeContextConvertAvailability loadContextConvertAvailability invalidateContextConvertAvailability
        normalizeChatShotState getCurrentChatShotState setChatShotChatStatus loadChatShotState invalidateChatShotState renderChatShotForm
        saveChatShotChatSetting syncChatShotButton runChatShotGeneration ensureContextConvertPickerBackdrop ensureContextConvertPicker positionContextConvertPicker
        renderContextConvertPicker hideContextConvertPicker getCurrentChatContextConvertState isContextTransformAvailableForChat setComposerContextConvertButtonVisible canContextConvertMessage
        canRestoreContextOriginalMessage bindContextConvertMessageButton createContextConvertMessageButton bindContextOriginalRestoreButton syncVisibleContextConvertMessageButtons syncCurrentChatContextConvertUi
        syncContextConvertComposerButton openComposerContextConvertPicker transformComposerTextWithContextConvertBot syncContextConvertPendingMessageState syncContextOriginalRestorePendingMessageState transformMessageWithContextConvertBot
        restoreContextOriginalMessage openMessageContextConvertPicker
      `.trim().split(/\s+/);

      function createRuntimeOnlyAiAdminController() {
        const installedRuntimeModules = new Set();
        const runtimeApi = {};

        function installRuntimeModule(key, factory, runtimeScope) {
          if (!key || typeof factory !== 'function' || installedRuntimeModules.has(key)) return;
          Object.assign(runtimeApi, factory(runtimeScope) || {});
          installedRuntimeModules.add(key);
        }

        return {
          installRuntimeModules(runtimeScope = {}) {
            const aiAdminRoot = window.BananzaApp?.aiAdmin || {};
            installRuntimeModule('openai', aiAdminRoot.openaiRuntime?.createOpenAiRuntime, runtimeScope);
            installRuntimeModule('localProviders', aiAdminRoot.localProvidersRuntime?.createLocalProvidersRuntime, runtimeScope);
            installRuntimeModule('grok', aiAdminRoot.grokRuntime?.createGrokRuntime, runtimeScope);
            installRuntimeModule('grokImageRisk', aiAdminRoot.grokImageRiskRuntime?.createGrokImageRiskRuntime, runtimeScope);
            installRuntimeModule('contextChatShot', aiAdminRoot.contextChatShotRuntime?.createContextChatShotRuntime, runtimeScope);
            return runtimeApi;
          },
          getRuntimeApi: () => runtimeApi,
        };
      }

      const aiAdminController = window.BananzaApp?.aiAdmin?.createController?.({
        window,
        document,
        ctx,
        dom: appDom,
      }) || createRuntimeOnlyAiAdminController();
      const aiAdminRuntimeApi = {};
      const aiRuntimeFeaturePromises = Object.create(null);
      const lazyRuntimeFunctions = Object.create(null);

      function installAiAdminRuntimeModules() {
        Object.assign(aiAdminRuntimeApi, aiAdminController?.installRuntimeModules?.(createRuntimeProxyScope()) || {});
        return aiAdminRuntimeApi;
      }

      function ensureAiRuntimeFeature(featureName) {
        installAiAdminRuntimeModules();
        if (!featureName) return Promise.resolve(aiAdminRuntimeApi);
        if (aiRuntimeFeaturePromises[featureName]) return aiRuntimeFeaturePromises[featureName];
        aiRuntimeFeaturePromises[featureName] = (async () => {
          const loader = window.BananzaApp?.featureLoader;
          if (loader?.loadFeature) await loader.loadFeature(featureName);
          return installAiAdminRuntimeModules();
        })().finally(() => {
          delete aiRuntimeFeaturePromises[featureName];
        });
        return aiRuntimeFeaturePromises[featureName];
      }

      function ensureOpenAiRuntime() { return ensureAiRuntimeFeature('openai-runtime'); }
      function ensureLocalProvidersRuntime() { return ensureAiRuntimeFeature('local-providers-runtime'); }
      function ensureGrokRuntime() { return ensureAiRuntimeFeature('grok-runtime'); }
      function ensureContextChatShotRuntime() { return ensureAiRuntimeFeature('context-chatshot-runtime'); }
      function ensureGrokRiskRuntime() { return ensureAiRuntimeFeature('grok-risk-runtime'); }
      function ensureFullAiRuntime() { return ensureAiRuntimeFeature('ai-admin-runtime'); }
      function ensureAiAdminRuntime() { return ensureFullAiRuntime(); }

      installAiAdminRuntimeModules();

      function textValue(value) {
        if (typeof tx === 'function') return tx(value || '');
        return String(value == null ? '' : value);
      }

      function escapeHtml(value) {
        if (typeof esc === 'function') return esc(value);
        return String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function resolveFallbackTarget(targetId) {
        if (!targetId) return null;
        if (typeof targetId !== 'string') return targetId;
        return document.getElementById(targetId.replace(/^#/, '')) || document.querySelector(targetId);
      }

      function fallbackSetInlineStatus(targetIds, message, type = '') {
        const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
        ids.forEach((targetId) => {
          const el = resolveFallbackTarget(targetId);
          if (!el) return;
          el.textContent = textValue(message || '');
          el.classList.toggle('is-error', type === 'error');
          el.classList.toggle('is-success', type === 'success');
          el.classList.toggle('is-pending', type === 'pending');
          el.classList.toggle('is-warning', type === 'warning');
        });
      }

      function fallbackResolveActionButtons(targetIds) {
        const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
        return ids.map((targetId) => resolveFallbackTarget(targetId)).filter(Boolean);
      }

      function fallbackSetActionButtonsPending(targetIds, pending = false, pendingLabel = '') {
        const buttons = fallbackResolveActionButtons(targetIds);
        buttons.forEach((btn) => {
          if (pending) {
            btn.dataset.pendingRestoreLabel = btn.textContent || '';
            btn.dataset.pendingRestoreDisabled = btn.disabled ? '1' : '0';
            btn.dataset.adminBusy = '1';
            btn.disabled = true;
            btn.classList.add('is-pending');
            btn.setAttribute('aria-busy', 'true');
            if (pendingLabel) btn.textContent = textValue(pendingLabel);
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

      async function fallbackWithActionButtons(targetIds, pendingLabel, task) {
        const buttons = fallbackResolveActionButtons(targetIds);
        if (buttons.some((btn) => btn.dataset.adminBusy === '1')) return undefined;
        fallbackSetActionButtonsPending(buttons, true, pendingLabel);
        try {
          return await task();
        } finally {
          fallbackSetActionButtonsPending(buttons, false);
        }
      }

      function fallbackBindAsyncActionButtons(triggerIds, targetIds, pendingLabel, task) {
        const busyTargets = targetIds == null ? triggerIds : targetIds;
        fallbackResolveActionButtons(triggerIds).forEach((btn) => {
          if (btn.dataset.bananzaAsyncActionBound === '1') return;
          btn.dataset.bananzaAsyncActionBound = '1';
          btn.addEventListener('click', () => {
            fallbackWithActionButtons(busyTargets, pendingLabel, task).catch((error) => {
              console.error('Admin action failed', error);
            });
          });
        });
      }

      function fallbackUniqueAiModelValues(values = []) {
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

      function fallbackSetSelectOptions(id, values = [], currentValue = '') {
        const select = document.getElementById(id);
        if (!select) return;
        const current = String(currentValue || '').trim();
        const options = fallbackUniqueAiModelValues([current, ...values]);
        select.innerHTML = options.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
        if (current) select.value = current;
      }

      function fallbackSyncSharedOpenAiSettings(settings = {}) {
        if (aiBotState?.settings) aiBotState.settings = { ...aiBotState.settings, ...settings };
        if (openAiUniversalState?.settings) openAiUniversalState.settings = { ...openAiUniversalState.settings, ...settings };
        if (openAiImageState?.settings) openAiImageState.settings = { ...openAiImageState.settings, ...settings };
      }

      function fallbackSyncSharedGrokSettings(settings = {}) {
        if (grokBotState?.settings) grokBotState.settings = { ...grokBotState.settings, ...settings };
        if (grokUniversalState?.settings) grokUniversalState.settings = { ...grokUniversalState.settings, ...settings };
      }

      function fallbackFilenameFromContentDisposition(header, fallback) {
        const match = String(header || '').match(/filename="?([^";]+)"?/i);
        return match ? match[1] : fallback;
      }

      function fallbackFormatUiErrorMessage(error, fallback = 'Request failed') {
        return error?.message || String(error || fallback);
      }

      function fallbackWireAiBotToggleLabels() {
        document.querySelectorAll('.ai-bot-toggle-label').forEach((label) => {
          if (label.dataset.toggleLabelBound === '1') return;
          label.dataset.toggleLabelBound = '1';
          label.addEventListener('click', (e) => {
            const checkbox = label.querySelector('input[type="checkbox"]');
            if (!checkbox || checkbox.disabled || e.target === checkbox) return;
            e.preventDefault();
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('input', { bubbles: true }));
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          });
        });
      }

      function fallbackHideComposerAiOverride() {
        if (composerAiOverrideEl) composerAiOverrideEl.classList.add('hidden');
        if (composerAiOverrideState) {
          composerAiOverrideState.target = null;
          composerAiOverrideState.mode = 'auto';
          composerAiOverrideState.documentFormat = 'md';
        }
      }

      function shouldPrimeComposerAiRuntime() {
        const text = typeof getComposerTextValue === 'function' ? getComposerTextValue({ trim: true }) : '';
        if (/@[A-Za-z0-9_][A-Za-z0-9_-]*/.test(String(text || ''))) return true;
        const reply = typeof getReplySnapshot === 'function' ? getReplySnapshot() : null;
        return Boolean(reply?.is_ai_bot || reply?.ai_bot_id || reply?.ai_bot_provider);
      }

      async function fallbackUpdateComposerAiOverrideState() {
        if (!shouldPrimeComposerAiRuntime()) {
          fallbackHideComposerAiOverride();
          return;
        }
        await ensureGrokRiskRuntime();
        const fn = runtimeFunction('updateComposerAiOverrideState');
        if (fn) return fn();
        fallbackHideComposerAiOverride();
      }

      function fallbackSyncContextConvertComposerButton() {
        if (composerContextConvertBtn) {
          composerContextConvertBtn.classList.add('hidden');
          composerContextConvertBtn.classList.remove('with-scroll-bottom', 'is-pending');
          composerContextConvertBtn.disabled = false;
        }
        const hasText = Boolean(currentChatId && !composerStateController?.editTo && getComposerTextValue?.({ trim: true }));
        const chat = typeof getChatById === 'function' ? getChatById(currentChatId) : null;
        if (hasText && chat?.context_transform_enabled) {
          ensureContextChatShotRuntime()
            .then(() => runtimeFunction('syncContextConvertComposerButton')?.())
            .catch(() => {});
        }
      }

      function fallbackNormalizeContextConvertAvailability(data = {}) {
        return {
          enabled: Boolean(data.enabled),
          bots: Array.isArray(data.bots) ? data.bots : [],
          settings: data.settings || null,
        };
      }

      function fallbackNormalizeChatShotState(data = {}) {
        return {
          enabled: Boolean(data.enabled),
          bots: Array.isArray(data.bots) ? data.bots : [],
          selectedBotIds: Array.isArray(data.selectedBotIds) ? data.selectedBotIds : [],
          style: data.style || '',
          bananaFilter: Boolean(data.bananaFilter),
        };
      }

      function runtimeFunction(name) {
        const value = aiAdminRuntimeApi[name];
        return typeof value === 'function' ? value : null;
      }

      function featureForRuntimeName(name) {
        if (!name || typeof name !== 'string') return '';
        if (/^(retryGrokImageRiskPrompt|jumpToSavedOriginal|normalizeMentionTarget|escapeRegExpText|extractMentionTokensFromText|isGrokImageBotTarget|isUniversalBotTarget|isGrokUniversalBotTarget|grokUniversalTargetAllowsImage|buildReplyBotTarget|getDirectPrivateAiBotTarget|getUniversalBotModes|resolveComposerUniversalBotTarget|renderComposerAiOverride|updateComposerAiOverrideState|getComposerAiOverridePayload|stripTriggeredBotMention|resolveTriggeredGrokImageBot|analyzeOutgoingGrokImageRisk|renderGrokImageRiskTerms|openGrokImageRiskConfirm)$/.test(name)) return 'grok-risk-runtime';
        if (/ContextConvert|contextConvert|ChatShot|chatShot/.test(name)) return 'context-chatshot-runtime';
        if (/Deepseek|deepseek|Qwen|qwen|Yandex|yandex|formatUiErrorMessage/.test(name)) return 'local-providers-runtime';
        if (/Grok|grok|GROK/.test(name)) return 'grok-runtime';
        if (/OpenAi|openAi|AiBot|aiBot|AiModel|aiModel|providerInteractive|normalizeBotSave|verifyBotSave|buildVerifiedBotSave|filenameFromContentDisposition/.test(name)) return 'openai-runtime';
        return '';
      }

      function isLikelyAsyncRuntimeFunction(name) {
        return /^(load|save|delete|upload|remove|disable|test|export|import|refresh|check|persist|open|run|transform|restore|retry|jump|analyze|update)/i.test(name);
      }

      function createLazyRuntimeFunction(name, featureName) {
        if (lazyRuntimeFunctions[name]) return lazyRuntimeFunctions[name];
        const fallback = runtimeFallbacks[name];
        const lazyFn = isLikelyAsyncRuntimeFunction(name)
          ? async function lazyAsyncRuntimeFunction(...args) {
            await ensureAiRuntimeFeature(featureName);
            const fn = runtimeFunction(name);
            if (fn) return fn(...args);
            if (typeof fallback === 'function') return fallback(...args);
            return undefined;
          }
          : function lazySyncRuntimeFunction(...args) {
            const fn = runtimeFunction(name);
            if (fn) return fn(...args);
            ensureAiRuntimeFeature(featureName)
              .then(() => runtimeFunction(name)?.(...args))
              .catch((error) => console.warn(`[ai-runtime] lazy ${name} failed:`, error?.message || error));
            if (typeof fallback === 'function') return fallback(...args);
            return undefined;
          };
        lazyRuntimeFunctions[name] = lazyFn;
        return lazyFn;
      }

      const runtimeFallbacks = {
        setInlineStatus: fallbackSetInlineStatus,
        resolveActionButtons: fallbackResolveActionButtons,
        setActionButtonsPending: fallbackSetActionButtonsPending,
        withActionButtons: fallbackWithActionButtons,
        bindAsyncActionButtons: fallbackBindAsyncActionButtons,
        setOpenAiStatus: fallbackSetInlineStatus,
        setAiBotModalStatus: (message, type = '') => fallbackSetInlineStatus('aiBotsStatus', message, type),
        setAiBotSettingsStatus: (message, type = '') => fallbackSetInlineStatus('aiBotsProviderStatus', message, type),
        setAiBotStatus: (message, type = '') => fallbackSetInlineStatus(['aiBotEditorStatus', 'aiBotEditorStatusBottom'], message, type),
        setAiBotTextModalStatus: (message, type = '') => fallbackSetInlineStatus('openAiTextStatus', message, type),
        setAiBotChatStatus: (message, type = '') => fallbackSetInlineStatus('aiBotChatStatus', message, type),
        setAiModelStatus: (message, type = '') => fallbackSetInlineStatus('aiBotsModelStatus', message, type),
        uniqueAiModelValues: fallbackUniqueAiModelValues,
        setAiModelSelectOptions: fallbackSetSelectOptions,
        setStaticSelectOptions: fallbackSetSelectOptions,
        syncSharedOpenAiSettings: fallbackSyncSharedOpenAiSettings,
        syncSharedGrokSettings: fallbackSyncSharedGrokSettings,
        renderAiModelOptions: () => {},
        loadAiModelOptions: async () => ({}),
        filenameFromContentDisposition: fallbackFilenameFromContentDisposition,
        formatUiErrorMessage: fallbackFormatUiErrorMessage,
        setDeepseekAiStatus: (message, type = '') => fallbackSetInlineStatus('deepseekAiStatus', message, type),
        setDeepseekAiProviderStatus: (message, type = '') => fallbackSetInlineStatus('deepseekAiProviderStatus', message, type),
        setDeepseekAiBalanceStatus: (message, type = '') => fallbackSetInlineStatus('deepseekAiBalanceStatus', message, type),
        setDeepseekBotStatus: (message, type = '') => fallbackSetInlineStatus('deepseekAiBotEditorStatus', message, type),
        setDeepseekChatStatus: (message, type = '') => fallbackSetInlineStatus('deepseekAiBotChatStatus', message, type),
        setDeepseekAiModelStatus: (message, type = '') => fallbackSetInlineStatus('deepseekAiModelStatus', message, type),
        setQwenAiStatus: (message, type = '') => fallbackSetInlineStatus('qwenAiStatus', message, type),
        setQwenAiProviderStatus: (message, type = '') => fallbackSetInlineStatus('qwenAiProviderStatus', message, type),
        setQwenBotStatus: (message, type = '') => fallbackSetInlineStatus('qwenAiBotEditorStatus', message, type),
        setQwenChatStatus: (message, type = '') => fallbackSetInlineStatus('qwenAiBotChatStatus', message, type),
        setQwenAiModelStatus: (message, type = '') => fallbackSetInlineStatus('qwenAiModelStatus', message, type),
        setYandexAiStatus: (message, type = '') => fallbackSetInlineStatus('yandexAiStatus', message, type),
        setYandexAiProviderStatus: (message, type = '') => fallbackSetInlineStatus('yandexAiProviderStatus', message, type),
        setYandexBotStatus: (message, type = '') => fallbackSetInlineStatus('yandexAiBotEditorStatus', message, type),
        setYandexChatStatus: (message, type = '') => fallbackSetInlineStatus('yandexAiBotChatStatus', message, type),
        setYandexAiModelStatus: (message, type = '') => fallbackSetInlineStatus('yandexAiModelStatus', message, type),
        GROK_TEXT_BOT_DIRTY_STATUS: 'Bot settings changed. Click "Save bot" to apply them.',
        setGrokStatus: (statusId, message, type = '') => fallbackSetInlineStatus(statusId, message, type),
        setGrokAiStatus: (message, type = '') => fallbackSetInlineStatus('grokAiStatus', message, type),
        setGrokTextStatus: (message, type = '') => fallbackSetInlineStatus('grokAiTextStatus', message, type),
        setGrokImageStatus: (message, type = '') => fallbackSetInlineStatus('grokAiImageStatus', message, type),
        setGrokUniversalStatus: (message, type = '') => fallbackSetInlineStatus('grokAiUniversalStatus', message, type),
        setGrokAiProviderStatus: (message, type = '') => fallbackSetInlineStatus('grokAiProviderStatus', message, type),
        setGrokTextEditorStatus: (message, type = '') => fallbackSetInlineStatus(['grokAiBotEditorStatus', 'grokAiBotEditorStatusBottom'], message, type),
        setGrokImageEditorStatus: (message, type = '') => fallbackSetInlineStatus('grokAiImageBotEditorStatus', message, type),
        setGrokUniversalEditorStatus: (message, type = '') => fallbackSetInlineStatus('grokAiUniversalBotEditorStatus', message, type),
        setGrokTextChatStatus: (message, type = '') => fallbackSetInlineStatus('grokAiBotChatStatus', message, type),
        setGrokImageChatStatus: (message, type = '') => fallbackSetInlineStatus('grokAiImageBotChatStatus', message, type),
        setGrokUniversalChatStatus: (message, type = '') => fallbackSetInlineStatus('grokAiUniversalBotChatStatus', message, type),
        setGrokBotStatus: (kind = 'text', message, type = '') => {
          const id = kind === 'image' ? 'grokAiImageBotEditorStatus' : kind === 'universal' ? 'grokAiUniversalBotEditorStatus' : ['grokAiBotEditorStatus', 'grokAiBotEditorStatusBottom'];
          fallbackSetInlineStatus(id, message, type);
        },
        setGrokAiModelStatus: (message, type = '') => fallbackSetInlineStatus('grokAiModelStatus', message, type),
        wireAiBotToggleLabels: fallbackWireAiBotToggleLabels,
        currentGrokTextBotFormFingerprint: () => '',
        refreshGrokTextBotDirtyState: () => {},
        syncGrokTextBotFormFingerprint: () => {},
        renderComposerAiOverride: fallbackHideComposerAiOverride,
        updateComposerAiOverrideState: fallbackUpdateComposerAiOverrideState,
        getComposerAiOverridePayload: () => ({}),
        analyzeOutgoingGrokImageRisk: async (...args) => {
          await ensureGrokRiskRuntime();
          return runtimeFunction('analyzeOutgoingGrokImageRisk')?.(...args) || { risky: false, matches: [], prompt: '', target: null };
        },
        openGrokImageRiskConfirm: async (...args) => {
          await ensureGrokRiskRuntime();
          const fn = runtimeFunction('openGrokImageRiskConfirm');
          return fn ? fn(...args) : true;
        },
        renderGrokImageRiskTerms: () => {},
        contextConvertProviderLabel: (provider = 'openai') => provider === 'yandex' ? 'Yandex' : provider === 'deepseek' ? 'DeepSeek' : provider === 'qwen' ? 'Qwen' : provider === 'grok' ? 'Grok' : 'OpenAI',
        providerAccent: () => '#10a37f',
        contextConvertRouteBase: () => '/api/admin/openai-convert-bots',
        currentContextConvertAdminState: () => contextConvertAdminStates?.[activeContextConvertProvider] || contextConvertAdminStates?.openai || {},
        currentContextConvertAdminBot: () => null,
        setContextConvertInlineStatus: fallbackSetInlineStatus,
        setContextConvertModalStatus: (message, type = '') => fallbackSetInlineStatus('contextConvertStatus', message, type),
        setContextConvertBotStatus: (message, type = '') => fallbackSetInlineStatus(['contextConvertBotEditorStatus', 'contextConvertBotEditorStatusBottom'], message, type),
        setContextConvertChatStatus: (message, type = '') => fallbackSetInlineStatus('contextConvertBotChatStatus', message, type),
        normalizeContextConvertAvailability: fallbackNormalizeContextConvertAvailability,
        loadContextConvertAvailability: async (...args) => {
          await ensureContextChatShotRuntime();
          return runtimeFunction('loadContextConvertAvailability')?.(...args) || fallbackNormalizeContextConvertAvailability();
        },
        invalidateContextConvertAvailability: (...args) => runtimeFunction('invalidateContextConvertAvailability')?.(...args),
        normalizeChatShotState: fallbackNormalizeChatShotState,
        getCurrentChatShotState: () => runtimeFunction('getCurrentChatShotState')?.() || null,
        setChatShotChatStatus: (message, type = '') => fallbackSetInlineStatus('chatShotStatus', message, type),
        loadChatShotState: async (...args) => {
          await ensureContextChatShotRuntime();
          return runtimeFunction('loadChatShotState')?.(...args) || fallbackNormalizeChatShotState();
        },
        invalidateChatShotState: (...args) => runtimeFunction('invalidateChatShotState')?.(...args),
        renderChatShotForm: (...args) => runtimeFunction('renderChatShotForm')?.(...args),
        saveChatShotChatSetting: async (...args) => {
          await ensureContextChatShotRuntime();
          return runtimeFunction('saveChatShotChatSetting')?.(...args);
        },
        syncChatShotButton: (...args) => runtimeFunction('syncChatShotButton')?.(...args),
        runChatShotGeneration: async (...args) => {
          await ensureContextChatShotRuntime();
          return runtimeFunction('runChatShotGeneration')?.(...args);
        },
        isContextTransformAvailableForChat: () => false,
        canContextConvertMessage: () => false,
        canRestoreContextOriginalMessage: () => false,
        syncContextConvertComposerButton: fallbackSyncContextConvertComposerButton,
        syncCurrentChatContextConvertUi: () => fallbackSyncContextConvertComposerButton(),
        syncVisibleContextConvertMessageButtons: () => {},
        bindContextConvertMessageButton: (button) => button,
        bindContextOriginalRestoreButton: (button) => button,
        createContextConvertMessageButton: () => null,
        hideContextConvertPicker: () => {},
        openComposerContextConvertPicker: async (...args) => {
          await ensureContextChatShotRuntime();
          return runtimeFunction('openComposerContextConvertPicker')?.(...args);
        },
        openMessageContextConvertPicker: async (...args) => {
          await ensureContextChatShotRuntime();
          return runtimeFunction('openMessageContextConvertPicker')?.(...args);
        },
        transformComposerTextWithContextConvertBot: async (...args) => {
          await ensureContextChatShotRuntime();
          return runtimeFunction('transformComposerTextWithContextConvertBot')?.(...args);
        },
        transformMessageWithContextConvertBot: async (...args) => {
          await ensureContextChatShotRuntime();
          return runtimeFunction('transformMessageWithContextConvertBot')?.(...args);
        },
        restoreContextOriginalMessage: async (...args) => {
          await ensureContextChatShotRuntime();
          return runtimeFunction('restoreContextOriginalMessage')?.(...args);
        },
      };

      function getAiAdminExportValue(name) {
        if (name === 'aiAdminController') return aiAdminController;
        if (name === 'aiAdminRuntimeApi') return aiAdminRuntimeApi;
        if (name === 'installAiAdminRuntimeModules') return installAiAdminRuntimeModules;
        if (name === 'ensureAiRuntimeFeature') return ensureAiRuntimeFeature;
        if (name === 'ensureOpenAiRuntime') return ensureOpenAiRuntime;
        if (name === 'ensureLocalProvidersRuntime') return ensureLocalProvidersRuntime;
        if (name === 'ensureGrokRuntime') return ensureGrokRuntime;
        if (name === 'ensureContextChatShotRuntime') return ensureContextChatShotRuntime;
        if (name === 'ensureGrokRiskRuntime') return ensureGrokRiskRuntime;
        if (name === 'ensureFullAiRuntime') return ensureFullAiRuntime;
        if (name === 'ensureAiAdminRuntime') return ensureAiAdminRuntime;
        if (Object.prototype.hasOwnProperty.call(aiAdminRuntimeApi, name)) return aiAdminRuntimeApi[name];
        if (Object.prototype.hasOwnProperty.call(runtimeFallbacks, name)) return runtimeFallbacks[name];
        const featureName = featureForRuntimeName(name);
        if (featureName) return createLazyRuntimeFunction(name, featureName);
        return undefined;
      }

      return window.BananzaApp.boot.composition.createEvalExports(AI_ADMIN_EXPORT_NAMES, {
        get: getAiAdminExportValue,
        set: (name, value) => {
          if (name === 'aiAdminRuntimeApi' && value && typeof value === 'object') {
            Object.assign(aiAdminRuntimeApi, value);
            return;
          }
          aiAdminRuntimeApi[name] = value;
        },
      });
    }
  };
})();
