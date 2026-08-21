(function () {
  'use strict';

  const state = {
    bots: [],
    selectedBotId: null,
    options: { providers: [], models: {} },
    contextBots: [],
    imageBots: [],
    draftIdentity: null,
    refreshTimer: null,
    loading: false,
    history: {
      botId: null,
      userId: '',
      page: 1,
      data: null,
      objectUrls: [],
    },
  };

  const $ = (selector) => document.querySelector(selector);
  const bridge = () => window.BananzaAppBridge || {};
  const t = (key, params = {}) => bridge().t?.(key, params)
    || window.BananzaI18n?.t?.(key, params) || String(key || '');
  const esc = (value) => {
    const node = document.createElement('div');
    node.textContent = value == null ? '' : String(value);
    return node.innerHTML;
  };
  const isAdmin = () => Boolean(bridge().getCurrentUser?.()?.is_admin);
  const selectedBot = () => state.bots.find((bot) => Number(bot.id) === Number(state.selectedBotId)) || null;

  function setStatus(message = '', kind = '') {
    const node = $('#telegramBotsStatus');
    if (!node) return;
    node.textContent = message ? t(message) : '';
    node.className = `voice-admin-status${kind ? ` ${kind}` : ''}${message ? '' : ' hidden'}`;
  }

  function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (busy) {
      button.dataset.idleLabel = button.textContent;
      button.textContent = t(busyLabel);
      button.disabled = true;
    } else {
      button.textContent = button.dataset.idleLabel || button.textContent;
      delete button.dataset.idleLabel;
      button.disabled = false;
    }
  }

  function ensureUi() {
    if (!$('#settingsTelegramBots')) {
      const anchor = $('#settingsVoicePanel') || $('#settingsAdminPanel');
      if (anchor) {
        const button = document.createElement('button');
        button.id = 'settingsTelegramBots';
        button.type = 'button';
        button.className = 'settings-item hidden';
        button.textContent = `📨 ${t('Telegram bots')}`;
        anchor.insertAdjacentElement('afterend', button);
        button.addEventListener('click', openModal);
      }
    }
    if (!$('#telegramBotsModal')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <div id="telegramBotsModal" class="modal hidden">
          <div class="modal-content wide voice-admin-modal telegram-transcription-modal">
            <div class="modal-header">
              <h3>${esc(t('Telegram bots'))}</h3>
              <button type="button" class="modal-close" id="telegramBotsClose" aria-label="${esc(t('Close'))}">×</button>
            </div>
            <div class="modal-body">
              <div class="ai-bot-settings-block telegram-bots-layout">
                <div class="ai-bot-panel telegram-bots-list-panel">
                  <h4>${esc(t('Saved Telegram bots'))}</h4>
                  <div id="telegramBotsList" class="ai-bot-list"></div>
                  <div class="ai-bot-actions">
                    <button id="telegramBotsNew" type="button" class="weather-action-btn">${esc(t('New bot'))}</button>
                    <button id="telegramBotsSave" type="button" class="btn-primary">${esc(t('Save bot'))}</button>
                    <button id="telegramBotsHistory" type="button" class="weather-action-btn">${esc(t('History'))}</button>
                    <button id="telegramBotsDelete" type="button" class="weather-action-btn">${esc(t('Delete bot'))}</button>
                  </div>
                  <div id="telegramBotsStatus" class="voice-admin-status hidden" role="status" aria-live="polite"></div>
                </div>
                <div class="ai-bot-panel telegram-bot-editor">
                  <h4>${esc(t('Telegram bot settings'))}</h4>
                  <div class="field-group">
                    <label>${esc(t('Bot name'))}</label>
                    <input id="telegramBotName" class="modal-input" maxlength="120" placeholder="${esc(t('My Telegram bot'))}">
                  </div>
                  <div class="telegram-setup-card">
                    <strong>${esc(t('Create a bot in @BotFather'))}</strong>
                    <div class="voice-form-hint">${esc(t('Use /newbot, choose a name and username, then copy the bot token here. Telegram API ID, API hash, phone number, public URL, and manual webhook are not required.'))}</div>
                    <a class="weather-action-btn telegram-action-link" href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">${esc(t('Open @BotFather'))}</a>
                  </div>
                  <div class="field-group">
                    <label>${esc(t('Telegram bot token'))}</label>
                    <input type="password" id="telegramBotToken" class="modal-input" autocomplete="new-password" placeholder="${esc(t('Paste a new bot token'))}">
                    <div id="telegramBotTokenState" class="voice-key-state"></div>
                  </div>
                  <div class="voice-inline-actions">
                    <button id="telegramBotTestToken" type="button" class="btn-sm voice-inline-btn">${esc(t('Test bot'))}</button>
                    <button id="telegramBotDeleteToken" type="button" class="weather-action-btn">${esc(t('Delete token'))}</button>
                  </div>
                  <div id="telegramBotIdentity" class="telegram-bot-identity hidden"></div>
                  <div id="telegramBotWebhookConflict" class="telegram-warning hidden">
                    <span>${esc(t('This bot has an active webhook or another poller. Claiming it removes the webhook and drops pending updates.'))}</span>
                    <button id="telegramBotClaim" type="button" class="weather-action-btn">${esc(t('Claim bot for BananZa'))}</button>
                  </div>
                  <div class="field-group">
                    <label>${esc(t('Allowed Telegram user IDs'))}</label>
                    <textarea id="telegramBotAllowlist" class="modal-input telegram-allowlist" rows="4" placeholder="123456789"></textarea>
                    <div class="voice-form-hint">${esc(t('One numeric ID per line. Only private chats are accepted.'))}</div>
                  </div>
                  <div class="telegram-capability-grid">
                    <div class="settings-item settings-toggle-item">
                      <span>${esc(t('Enable Telegram transcription'))}</span>
                      <label class="toggle-switch"><input type="checkbox" id="telegramBotTranscriptionEnabled"><span class="toggle-slider"></span></label>
                    </div>
                    <div class="settings-item settings-toggle-item">
                      <span>${esc(t('Enable Telegram image generation'))}</span>
                      <label class="toggle-switch"><input type="checkbox" id="telegramBotImageEnabled"><span class="toggle-slider"></span></label>
                    </div>
                    <div id="telegramBotTranscriptImageToggle" class="settings-item settings-toggle-item hidden">
                      <span>${esc(t('Generate image from transcription'))}</span>
                      <label class="toggle-switch"><input type="checkbox" id="telegramBotGenerateImageFromTranscription"><span class="toggle-slider"></span></label>
                    </div>
                  </div>
                  <section id="telegramBotTranscriptionSection" class="telegram-feature-section">
                    <h4>${esc(t('Transcription'))}</h4>
                    <div class="field-grid">
                      <div class="field-group"><label>${esc(t('Active provider'))}</label><select id="telegramBotProvider" class="modal-input"></select></div>
                      <div class="field-group"><label>${esc(t('Model'))}</label><select id="telegramBotModel" class="modal-input"></select></div>
                      <div class="field-group"><label>${esc(t('Language'))}</label><input id="telegramBotLanguage" class="modal-input" value="ru"></div>
                      <div class="field-group"><label>${esc(t('Transcription timeout, ms'))}</label><input id="telegramBotTimeout" class="modal-input" type="number" min="5000" max="300000"></div>
                      <div class="field-group"><label>${esc(t('Maximum file size, MB'))}</label><input id="telegramBotMaxSize" class="modal-input" type="number" min="1" max="20"></div>
                      <div id="telegramBotVoskPathGroup" class="field-group hidden"><label>${esc(t('Vosk model path (optional)'))}</label><input id="telegramBotVoskPath" class="modal-input"></div>
                    </div>
                    <div class="settings-item settings-toggle-item"><span>${esc(t('Fallback to OpenAI'))}</span><label class="toggle-switch"><input type="checkbox" id="telegramBotFallback"><span class="toggle-slider"></span></label></div>
                    <div class="settings-item settings-toggle-item"><span>${esc(t('Use context bot'))}</span><label class="toggle-switch"><input type="checkbox" id="telegramBotContextEnabled"><span class="toggle-slider"></span></label></div>
                    <div class="field-group"><label>${esc(t('Context convert bot'))}</label><select id="telegramBotContextBot" class="modal-input"></select></div>
                    <div id="telegramBotProviderReadiness" class="telegram-provider-readiness"></div>
                    <div class="voice-inline-actions"><button id="telegramBotTestTranscription" type="button" class="btn-sm voice-inline-btn">${esc(t('Test model'))}</button><button id="telegramBotOpenVoice" type="button" class="weather-action-btn">${esc(t('Open voice provider settings'))}</button></div>
                  </section>
                  <section id="telegramBotImageSection" class="telegram-feature-section">
                    <h4>${esc(t('Image generation'))}</h4>
                    <div class="field-group"><label>${esc(t('Image bot'))}</label><select id="telegramBotImageBot" class="modal-input"></select></div>
                    <div id="telegramBotImageReadiness" class="telegram-provider-readiness"></div>
                    <button id="telegramBotTestImage" type="button" class="btn-sm voice-inline-btn">${esc(t('Test image bot'))}</button>
                  </section>
                  <div id="telegramBotRuntime" class="telegram-runtime"></div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(wrapper.firstElementChild);
      bindEvents();
      bridge().registerManagedModal?.('telegramBotsModal');
    }
    if (!$('#telegramBotHistoryModal')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <div id="telegramBotHistoryModal" class="modal hidden">
          <div class="modal-content wide voice-admin-modal telegram-history-modal">
            <div class="modal-header">
              <h3>${esc(t('Telegram bot history'))}</h3>
              <button type="button" class="modal-close" id="telegramBotHistoryClose" aria-label="${esc(t('Close'))}">×</button>
            </div>
            <div class="modal-body">
              <div class="telegram-history-toolbar">
                <div class="field-group">
                  <label for="telegramHistoryUser">${esc(t('User'))}</label>
                  <select id="telegramHistoryUser" class="modal-input"></select>
                </div>
                <button id="telegramHistoryClear" type="button" class="weather-action-btn">${esc(t('Clear bot history'))}</button>
              </div>
              <div id="telegramHistoryStatus" class="voice-admin-status hidden" role="status" aria-live="polite"></div>
              <div id="telegramHistoryList" class="telegram-history-list"></div>
              <div class="telegram-history-pager">
                <button id="telegramHistoryPrevious" type="button" class="weather-action-btn">${esc(t('Previous page'))}</button>
                <span id="telegramHistoryPage" class="settings-hint"></span>
                <button id="telegramHistoryNext" type="button" class="weather-action-btn">${esc(t('Next page'))}</button>
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(wrapper.firstElementChild);
      bindHistoryEvents();
      bridge().registerManagedModal?.('telegramBotHistoryModal');
    }
    $('#settingsTelegramBots')?.classList.toggle('hidden', !isAdmin());
  }

  function bindEvents() {
    $('#telegramBotsClose')?.addEventListener('click', closeModal);
    $('#telegramBotsModal')?.addEventListener('click', (event) => { if (event.target === $('#telegramBotsModal')) closeModal(); });
    $('#telegramBotsNew')?.addEventListener('click', newBot);
    $('#telegramBotsSave')?.addEventListener('click', saveBot);
    $('#telegramBotsHistory')?.addEventListener('click', openHistory);
    $('#telegramBotsDelete')?.addEventListener('click', deleteSelectedBot);
    $('#telegramBotTestToken')?.addEventListener('click', testToken);
    $('#telegramBotDeleteToken')?.addEventListener('click', deleteToken);
    $('#telegramBotClaim')?.addEventListener('click', claimBot);
    $('#telegramBotTestTranscription')?.addEventListener('click', testTranscription);
    $('#telegramBotTestImage')?.addEventListener('click', testImage);
    $('#telegramBotProvider')?.addEventListener('change', renderProviderFields);
    $('#telegramBotContextEnabled')?.addEventListener('change', syncContextBot);
    $('#telegramBotTranscriptionEnabled')?.addEventListener('change', syncFeatureSections);
    $('#telegramBotImageEnabled')?.addEventListener('change', syncFeatureSections);
    $('#telegramBotImageBot')?.addEventListener('change', renderImageReadiness);
    $('#telegramBotOpenVoice')?.addEventListener('click', () => { closeModal(); $('#settingsVoicePanel')?.click(); });
    $('#telegramBotsList')?.addEventListener('click', (event) => {
      const item = event.target.closest('[data-telegram-bot-id]');
      if (!item) return;
      state.selectedBotId = Number(item.dataset.telegramBotId);
      state.draftIdentity = null;
      render();
    });
  }

  function bindHistoryEvents() {
    $('#telegramBotHistoryClose')?.addEventListener('click', closeHistory);
    $('#telegramBotHistoryModal')?.addEventListener('click', (event) => {
      if (event.target === $('#telegramBotHistoryModal')) closeHistory();
    });
    $('#telegramHistoryUser')?.addEventListener('change', () => {
      state.history.userId = $('#telegramHistoryUser').value || '';
      state.history.page = 1;
      loadHistory();
    });
    $('#telegramHistoryPrevious')?.addEventListener('click', () => {
      if (state.history.page > 1) {
        state.history.page -= 1;
        loadHistory();
      }
    });
    $('#telegramHistoryNext')?.addEventListener('click', () => {
      const totalPages = Number(state.history.data?.total_pages || 1);
      if (state.history.page < totalPages) {
        state.history.page += 1;
        loadHistory();
      }
    });
    $('#telegramHistoryClear')?.addEventListener('click', clearHistory);
  }

  async function openModal() {
    if (!isAdmin()) return;
    ensureUi();
    bridge().openManagedModal?.('telegramBotsModal');
    await loadBots();
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = window.setInterval(refreshBots, 5000);
  }

  function closeModal() {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = null;
    bridge().closeManagedModal?.('telegramBotsModal') || $('#telegramBotsModal')?.classList.add('hidden');
  }

  function setHistoryStatus(message = '', kind = '') {
    const node = $('#telegramHistoryStatus');
    if (!node) return;
    node.textContent = message ? t(message) : '';
    node.className = `voice-admin-status${kind ? ` ${kind}` : ''}${message ? '' : ' hidden'}`;
  }

  function revokeHistoryObjectUrls() {
    state.history.objectUrls.forEach((url) => URL.revokeObjectURL?.(url));
    state.history.objectUrls = [];
  }

  async function openHistory() {
    const bot = selectedBot();
    if (!bot) return;
    state.history.botId = Number(bot.id);
    state.history.userId = '';
    state.history.page = 1;
    state.history.data = null;
    bridge().openManagedModal?.('telegramBotHistoryModal');
    await loadHistory();
  }

  function closeHistory() {
    revokeHistoryObjectUrls();
    bridge().closeManagedModal?.('telegramBotHistoryModal') || $('#telegramBotHistoryModal')?.classList.add('hidden');
  }

  function historyUserLabel(user) {
    const username = String(user.telegram_user_username || '').trim();
    const displayName = String(user.telegram_user_display_name || '').trim();
    return [displayName, username ? `@${username}` : '', user.telegram_user_id ? `#${user.telegram_user_id}` : ''].filter(Boolean).join(' · ');
  }

  function historyStatusLabel(status) {
    const labels = {
      queued: 'Queued', processing: 'Processing', delivering: 'Delivering', completed: 'Completed', error: 'Failed',
    };
    return t(labels[status] || status || '');
  }

  function formatHistoryDate(value) {
    const date = value ? new Date(`${String(value).replace(' ', 'T')}Z`) : null;
    return date && !Number.isNaN(date.valueOf()) ? date.toLocaleString() : '';
  }

  function renderHistory() {
    const data = state.history.data || { items: [], users: [], page: 1, total_pages: 1 };
    const select = $('#telegramHistoryUser');
    const items = Array.isArray(data.items) ? data.items : [];
    if (!select) return;
    select.innerHTML = `<option value="">${esc(t('All users'))}</option>${(data.users || []).map((user) => `<option value="${esc(user.telegram_user_id)}">${esc(historyUserLabel(user))}</option>`).join('')}`;
    select.value = state.history.userId;
    const list = $('#telegramHistoryList');
    revokeHistoryObjectUrls();
    list.innerHTML = items.length ? items.map((item) => {
      const identity = historyUserLabel(item) || t('User');
      const status = item.kind === 'combined'
        ? `${esc(historyStatusLabel(item.transcription_status))} · ${esc(historyStatusLabel(item.image_status))}`
        : esc(historyStatusLabel(item.status));
      const type = item.kind === 'combined' ? t('Transcription and image')
        : item.kind === 'image' ? t('Prompt and image') : t('Transcription');
      const transcript = String(item.transcript_text || '').trim();
      const prompt = String(item.prompt_text || '').trim();
      const combinedText = item.kind === 'combined' ? (prompt || transcript) : '';
      const resultText = combinedText || transcript || prompt;
      const resultTitle = item.kind === 'combined' ? t('Transcription result / Image prompt')
        : transcript ? t('Transcription result') : t('Image prompt');
      return `<article class="telegram-history-item">
        <div class="telegram-history-item-head"><strong>${esc(type)}</strong><span>${esc(identity)} · ${esc(formatHistoryDate(item.completed_at || item.created_at))}</span></div>
        <div class="telegram-history-meta">${status}${item.provider || item.model ? ` · ${esc([item.provider, item.model].filter(Boolean).join(' / '))}` : ''}</div>
        ${resultText ? `<details${item.kind === 'image' ? ' open' : ''}><summary>${esc(resultTitle)}</summary><pre>${esc(resultText)}</pre></details>` : ''}
        ${item.image_job_id && item.has_image ? `<div class="telegram-history-image" data-telegram-history-image="${Number(item.image_job_id)}"><span>${esc(t('Generated image'))}</span></div>` : ''}
        ${item.image_job_id && !item.has_image && item.image_status === 'completed' ? `<div class="telegram-history-missing-image">${esc(t('Image file is unavailable'))}</div>` : ''}
        ${item.error ? `<div class="telegram-runtime-error">${esc(item.error)}</div>` : ''}
      </article>`;
    }).join('') : `<div class="settings-hint">${esc(t('No Telegram history yet.'))}</div>`;
    $('#telegramHistoryPage').textContent = t('Page {page} of {pages}', { page: data.page || 1, pages: data.total_pages || 1 });
    $('#telegramHistoryPrevious').disabled = Number(data.page || 1) <= 1;
    $('#telegramHistoryNext').disabled = Number(data.page || 1) >= Number(data.total_pages || 1);
    loadHistoryPreviews(items).catch(() => {});
  }

  async function loadHistoryPreviews(items) {
    const botId = Number(state.history.botId || 0);
    const token = bridge().getToken?.();
    if (!botId || !token || !$('#telegramBotHistoryModal') || $('#telegramBotHistoryModal').classList.contains('hidden')) return;
    await Promise.all(items.filter((item) => item.image_job_id && item.has_image).map(async (item) => {
      const selector = `[data-telegram-history-image="${Number(item.image_job_id)}"]`;
      const container = $(selector);
      if (!container) return;
      try {
        const response = await fetch(`/api/admin/telegram-bots/${botId}/history/images/${Number(item.image_job_id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Image file is unavailable');
        const url = URL.createObjectURL(await response.blob());
        if (state.history.botId !== botId || !container.isConnected) {
          URL.revokeObjectURL(url);
          return;
        }
        state.history.objectUrls.push(url);
        container.innerHTML = `<img src="${url}" alt="${esc(t('Generated image'))}">`;
      } catch {
        container.textContent = t('Image file is unavailable');
      }
    }));
  }

  async function loadHistory({ preserveStatus = false } = {}) {
    const botId = Number(state.history.botId || 0);
    if (!botId) return;
    if (!preserveStatus) setHistoryStatus('Loading settings...', 'pending');
    try {
      const query = new URLSearchParams({ page: String(state.history.page), limit: '25' });
      if (state.history.userId) query.set('user_id', state.history.userId);
      const data = await bridge().api(`/api/admin/telegram-bots/${botId}/history?${query.toString()}`);
      if (state.history.botId !== botId) return;
      state.history.data = data;
      state.history.page = Number(data.page || 1);
      renderHistory();
      if (!preserveStatus) setHistoryStatus();
    } catch (error) {
      setHistoryStatus(error.message || 'Could not load Telegram bot history', 'error');
    }
  }

  async function clearHistory(event) {
    const botId = Number(state.history.botId || 0);
    if (!botId || !confirm(t('Clear all completed and failed Telegram operations for this bot? Active tasks will continue.'))) return;
    setBusy(event.currentTarget, true, 'Deleting...');
    try {
      const data = await bridge().api(`/api/admin/telegram-bots/${botId}/history`, { method: 'DELETE' });
      const cleared = data.cleared || {};
      const successMessage = t('Telegram history cleared: {records} records, {files} images', {
        records: Number(cleared.images || 0) + Number(cleared.transcriptions || 0),
        files: Number(cleared.files || 0),
      });
      state.history.page = 1;
      await loadHistory({ preserveStatus: true });
      setHistoryStatus(successMessage, 'success');
    } catch (error) {
      setHistoryStatus(error.message || 'Could not clear Telegram bot history', 'error');
    } finally { setBusy(event.currentTarget, false); }
  }

  async function loadBots() {
    if (state.loading) return;
    state.loading = true;
    setStatus('Loading settings...', 'pending');
    try {
      applyPayload(await bridge().api('/api/admin/telegram-bots'));
      setStatus();
    } catch (error) {
      setStatus(error.message || 'Could not load Telegram bots', 'error');
    } finally {
      state.loading = false;
    }
  }

  async function refreshBots() {
    try {
      const data = await bridge().api('/api/admin/telegram-bots');
      state.bots = Array.isArray(data.bots) ? data.bots : state.bots;
      state.options = data.options || state.options;
      state.contextBots = Array.isArray(data.contextConvertBots) ? data.contextConvertBots : state.contextBots;
      state.imageBots = Array.isArray(data.imageBots) ? data.imageBots : state.imageBots;
      renderList();
      const bot = selectedBot();
      if (bot) {
        renderRuntime(bot);
        renderIdentity(bot);
      }
    } catch {}
  }

  function applyPayload(data = {}, { preserveDraft = false } = {}) {
    state.bots = Array.isArray(data.bots) ? data.bots : state.bots;
    state.options = data.options || state.options;
    state.contextBots = Array.isArray(data.contextConvertBots) ? data.contextConvertBots : state.contextBots;
    state.imageBots = Array.isArray(data.imageBots) ? data.imageBots : state.imageBots;
    if (data.selected_bot_id) state.selectedBotId = Number(data.selected_bot_id);
    if (state.selectedBotId && !state.bots.some((bot) => Number(bot.id) === Number(state.selectedBotId))) state.selectedBotId = null;
    if (!state.selectedBotId && state.bots[0] && !(preserveDraft && state.draftIdentity)) state.selectedBotId = Number(state.bots[0].id);
    render();
  }

  function render() {
    renderList();
    fillForm(selectedBot());
  }

  function renderList() {
    const list = $('#telegramBotsList');
    if (!list) return;
    if (!state.bots.length) {
      list.innerHTML = `<div class="settings-hint">${esc(t('No Telegram bots yet. Create the first one.'))}</div>`;
      return;
    }
    list.innerHTML = state.bots.map((bot) => {
      const capabilities = bot.transcription_enabled && bot.image_generation_enabled
        ? t('Transcription and images') : bot.transcription_enabled ? t('Transcription only')
          : bot.image_generation_enabled ? t('Images only') : t('All features disabled');
      const identity = bot.telegram_bot_username ? `@${bot.telegram_bot_username}` : t('Not connected');
      const runtime = t(bot.runtime?.state || 'stopped');
      return `<button type="button" class="ai-bot-list-item${Number(bot.id) === Number(state.selectedBotId) ? ' active' : ''}" data-telegram-bot-id="${Number(bot.id)}">
        <strong>${esc(bot.name)}</strong><span>${esc(identity)} · ${esc(capabilities)} · ${esc(runtime)}</span>
      </button>`;
    }).join('');
  }

  function defaultDraft() {
    return {
      name: '', allowed_user_ids: [], transcription_enabled: false, image_generation_enabled: false,
      generate_image_from_transcription: false,
      active_provider: 'whisper', fallback_to_openai: false, context_bot_enabled: false,
      context_bot_id: null, image_bot_id: null, transcription_timeout_ms: 120000,
      max_file_size_bytes: 20 * 1024 * 1024, vosk_model: 'vosk-model-small-ru-0.22',
      vosk_model_path: '', whisper_model: 'base', whisper_language: 'ru',
      openai_model: 'gpt-4o-mini-transcribe', openai_language: 'ru', grok_language: 'ru',
      runtime: { state: 'stopped', queue: { total: 0, transcription: 0, images: 0 } },
    };
  }

  function fillForm(bot) {
    const value = bot || defaultDraft();
    $('#telegramBotName').value = value.name || '';
    $('#telegramBotToken').value = '';
    $('#telegramBotToken').placeholder = value.masked_bot_token
      ? t('Saved token {token}', { token: value.masked_bot_token }) : t('Paste a new bot token');
    $('#telegramBotTokenState').textContent = value.has_bot_token
      ? t('Token saved: {token}', { token: value.masked_bot_token }) : t('Token is not saved');
    $('#telegramBotDeleteToken').classList.toggle('hidden', !value.has_bot_token);
    $('#telegramBotAllowlist').value = (value.allowed_user_ids || []).join('\n');
    $('#telegramBotTranscriptionEnabled').checked = Boolean(value.transcription_enabled);
    $('#telegramBotImageEnabled').checked = Boolean(value.image_generation_enabled);
    $('#telegramBotGenerateImageFromTranscription').checked = Boolean(value.generate_image_from_transcription);
    $('#telegramBotTimeout').value = Number(value.transcription_timeout_ms || 120000);
    $('#telegramBotMaxSize').value = Math.round(Number(value.max_file_size_bytes || 20971520) / 1048576);
    $('#telegramBotFallback').checked = Boolean(value.fallback_to_openai);
    $('#telegramBotContextEnabled').checked = Boolean(value.context_bot_enabled);
    $('#telegramBotVoskPath').value = value.vosk_model_path || '';
    const provider = $('#telegramBotProvider');
    provider.innerHTML = (state.options.providers || []).map((item) => `<option value="${esc(item.value)}">${esc(t(item.label))}</option>`).join('');
    provider.value = value.active_provider || 'whisper';
    fillContextBots(value);
    fillImageBots(value);
    renderProviderFields(value);
    renderIdentity(value);
    renderRuntime(value);
    syncFeatureSections();
    $('#telegramBotsDelete').disabled = !bot;
    $('#telegramBotsHistory').disabled = !bot;
  }

  function providerModelKey(provider) {
    if (provider === 'openai') return 'openai_model';
    if (provider === 'whisper') return 'whisper_model';
    if (provider === 'grok') return null;
    return 'vosk_model';
  }

  function providerLanguageKey(provider) {
    if (provider === 'whisper') return 'whisper_language';
    if (provider === 'grok') return 'grok_language';
    return 'openai_language';
  }

  function renderProviderFields(source = selectedBot() || defaultDraft()) {
    const provider = $('#telegramBotProvider').value || 'whisper';
    const models = state.options.models?.[provider] || [];
    $('#telegramBotModel').innerHTML = models.length
      ? models.map((item) => `<option value="${esc(item.value)}">${esc(t(item.label))}</option>`).join('')
      : '<option value="speech-to-text">speech-to-text</option>';
    const modelKey = providerModelKey(provider);
    $('#telegramBotModel').value = modelKey ? (source[modelKey] || models[0]?.value || '') : 'speech-to-text';
    $('#telegramBotModel').disabled = provider === 'grok';
    $('#telegramBotLanguage').value = source[providerLanguageKey(provider)] || 'ru';
    $('#telegramBotVoskPathGroup').classList.toggle('hidden', provider !== 'vosk');
    renderProviderReadiness();
  }

  function fillContextBots(bot) {
    const rows = state.contextBots.filter((item) => item.enabled !== false && item.provider_enabled !== false);
    $('#telegramBotContextBot').innerHTML = rows.length
      ? rows.map((item) => `<option value="${Number(item.id)}">${esc(`${item.name || t('Unnamed bot')} (${item.provider || 'openai'})`)}</option>`).join('')
      : `<option value="">${esc(t('No context convert bots available'))}</option>`;
    $('#telegramBotContextBot').value = bot.context_bot_id ? String(bot.context_bot_id) : String(rows[0]?.id || '');
    syncContextBot();
  }

  function fillImageBots(bot) {
    const rows = state.imageBots.filter((item) => item.enabled !== false && item.provider_enabled !== false && item.allow_image_generate !== false);
    $('#telegramBotImageBot').innerHTML = rows.length
      ? rows.map((item) => `<option value="${Number(item.id)}">${esc(`${item.name || t('Unnamed bot')} (${item.provider || ''} · ${item.image_model || t('Default model')})`)}</option>`).join('')
      : `<option value="">${esc(t('No image bots available'))}</option>`;
    $('#telegramBotImageBot').value = bot.image_bot_id ? String(bot.image_bot_id) : String(rows[0]?.id || '');
    renderImageReadiness();
  }

  function syncContextBot() {
    $('#telegramBotContextBot').disabled = !$('#telegramBotContextEnabled').checked || !state.contextBots.length;
  }

  function syncFeatureSections() {
    const transcription = $('#telegramBotTranscriptionEnabled').checked;
    const images = $('#telegramBotImageEnabled').checked;
    const chainedImageToggle = $('#telegramBotTranscriptImageToggle');
    const chainedImage = $('#telegramBotGenerateImageFromTranscription');
    const canGenerateFromTranscript = transcription && images;
    chainedImageToggle.classList.toggle('hidden', !canGenerateFromTranscript);
    chainedImage.disabled = !canGenerateFromTranscript;
    if (!canGenerateFromTranscript) chainedImage.checked = false;
    $('#telegramBotTranscriptionSection').classList.toggle('is-disabled', !transcription);
    $('#telegramBotImageSection').classList.toggle('is-disabled', !images);
    $('#telegramBotTranscriptionSection').querySelectorAll('input,select,button').forEach((node) => { node.disabled = !transcription; });
    $('#telegramBotImageSection').querySelectorAll('input,select,button').forEach((node) => { node.disabled = !images; });
    if (transcription) { renderProviderFields(); syncContextBot(); }
    if (images) renderImageReadiness();
  }

  function renderProviderReadiness() {
    const bot = selectedBot();
    const readyMap = bot?.providerReadiness || state.bots[0]?.providerReadiness || {};
    const provider = $('#telegramBotProvider').value || 'whisper';
    const ready = Boolean(readyMap[provider]) && readyMap.fallback_openai !== false;
    const node = $('#telegramBotProviderReadiness');
    node.className = `telegram-provider-readiness ${ready ? 'ready' : 'error'}`;
    node.textContent = ready ? t('Provider is configured in voice settings') : t('Provider credentials or helper are missing in voice settings');
  }

  function renderImageReadiness() {
    const imageBot = state.imageBots.find((item) => Number(item.id) === Number($('#telegramBotImageBot').value));
    const node = $('#telegramBotImageReadiness');
    node.className = `telegram-provider-readiness ${imageBot ? 'ready' : 'error'}`;
    node.textContent = imageBot
      ? t('Image bot is ready: {provider} / {model}', { provider: imageBot.provider, model: imageBot.image_model || t('Default model') })
      : t('Select an enabled image bot with image generation permission');
  }

  function renderIdentity(bot) {
    const identity = state.draftIdentity?.bot || (bot.telegram_api_bot_id ? {
      id: bot.telegram_api_bot_id, name: bot.telegram_bot_name, username: bot.telegram_bot_username,
    } : null);
    const node = $('#telegramBotIdentity');
    node.classList.toggle('hidden', !identity);
    node.innerHTML = identity ? `<div><strong>${esc(t('Connected bot'))}:</strong> ${esc(identity.name || identity.id)}${identity.username ? ` · @${esc(identity.username)}` : ''}</div>${identity.username ? `<a class="btn-sm voice-inline-btn" href="https://t.me/${encodeURIComponent(identity.username)}" target="_blank" rel="noopener noreferrer">${esc(t('Open bot in Telegram'))}</a>` : ''}` : '';
    const conflict = Boolean(state.draftIdentity?.webhook?.active || bot.runtime?.webhook_conflict || bot.runtime?.state === 'conflict');
    $('#telegramBotWebhookConflict').classList.toggle('hidden', !conflict);
  }

  function renderRuntime(bot) {
    const runtime = bot.runtime || {};
    const queue = runtime.queue || {};
    $('#telegramBotRuntime').innerHTML = `<strong>${esc(t('Runtime status'))}:</strong> ${esc(t(runtime.state || 'stopped'))} · ${esc(t('Transcription queue'))}: ${Number(queue.transcription || 0)} · ${esc(t('Image queue'))}: ${Number(queue.images || 0)}${runtime.last_error ? `<div class="telegram-runtime-error">${esc(t(runtime.last_error))}</div>` : ''}`;
  }

  function serializeForm() {
    const provider = $('#telegramBotProvider').value || 'whisper';
    const body = {
      name: $('#telegramBotName').value,
      bot_token: $('#telegramBotToken').value,
      allowed_user_ids: $('#telegramBotAllowlist').value,
      transcription_enabled: $('#telegramBotTranscriptionEnabled').checked,
      image_generation_enabled: $('#telegramBotImageEnabled').checked,
      generate_image_from_transcription: $('#telegramBotGenerateImageFromTranscription').checked,
      active_provider: provider,
      fallback_to_openai: $('#telegramBotFallback').checked,
      context_bot_enabled: $('#telegramBotContextEnabled').checked,
      context_bot_id: Number($('#telegramBotContextBot').value || 0) || null,
      image_bot_id: Number($('#telegramBotImageBot').value || 0) || null,
      transcription_timeout_ms: Number($('#telegramBotTimeout').value || 120000),
      max_file_size_bytes: Number($('#telegramBotMaxSize').value || 20) * 1048576,
      vosk_model_path: $('#telegramBotVoskPath').value,
    };
    const modelKey = providerModelKey(provider);
    if (modelKey) body[modelKey] = $('#telegramBotModel').value;
    body[providerLanguageKey(provider)] = $('#telegramBotLanguage').value || 'ru';
    return body;
  }

  function newBot() {
    state.selectedBotId = null;
    state.draftIdentity = null;
    render();
    $('#telegramBotName').focus();
  }

  async function saveBot(event) {
    const button = event.currentTarget;
    setBusy(button, true, 'Saving...');
    setStatus('Saving...', 'pending');
    try {
      const id = Number(state.selectedBotId || 0);
      const data = await bridge().api(id ? `/api/admin/telegram-bots/${id}` : '/api/admin/telegram-bots', {
        method: id ? 'PUT' : 'POST', body: serializeForm(),
      });
      state.draftIdentity = null;
      applyPayload(data);
      setStatus('Telegram bot saved', 'success');
    } catch (error) {
      setStatus(error.message || 'Could not save Telegram bot', 'error');
    } finally { setBusy(button, false); }
  }

  async function deleteSelectedBot(event) {
    const id = Number(state.selectedBotId || 0);
    if (!id || !confirm(t('Delete this Telegram bot and its completed job history?'))) return;
    setBusy(event.currentTarget, true, 'Deleting...');
    try {
      state.selectedBotId = null;
      applyPayload(await bridge().api(`/api/admin/telegram-bots/${id}`, { method: 'DELETE' }));
      setStatus('Telegram bot deleted', 'success');
    } catch (error) {
      state.selectedBotId = id;
      setStatus(error.message || 'Could not delete Telegram bot', 'error');
    } finally { setBusy(event.currentTarget, false); }
  }

  async function testToken(event) {
    setBusy(event.currentTarget, true, 'Testing bot...');
    setStatus('Testing bot...', 'pending');
    try {
      state.draftIdentity = await bridge().api('/api/admin/telegram-bots/test-token', {
        method: 'POST', body: { telegram_bot_id: state.selectedBotId, bot_token: $('#telegramBotToken').value },
      });
      renderIdentity(selectedBot() || defaultDraft());
      const identity = state.draftIdentity.bot;
      setStatus(t('Bot connection works: {bot}', { bot: `${identity.name || identity.id}${identity.username ? ` @${identity.username}` : ''}` }), state.draftIdentity.webhook?.active ? 'warning' : 'success');
    } catch (error) { setStatus(error.message || 'Bot test failed', 'error'); }
    finally { setBusy(event.currentTarget, false); }
  }

  async function deleteToken(event) {
    const id = Number(state.selectedBotId || 0);
    if (!id || !confirm(t('Delete the saved Telegram bot token?'))) return;
    setBusy(event.currentTarget, true, 'Deleting...');
    try {
      applyPayload(await bridge().api(`/api/admin/telegram-bots/${id}/token`, { method: 'DELETE' }));
      setStatus('Token deleted', 'success');
    } catch (error) { setStatus(error.message || 'Could not delete token', 'error'); }
    finally { setBusy(event.currentTarget, false); }
  }

  async function claimBot(event) {
    const id = Number(state.selectedBotId || 0);
    if (!id || !confirm(t('Remove the current Telegram webhook and drop pending updates?'))) return;
    setBusy(event.currentTarget, true, 'Connecting bot...');
    try {
      state.draftIdentity = null;
      applyPayload(await bridge().api(`/api/admin/telegram-bots/${id}/claim`, { method: 'POST', body: {} }));
      setStatus('Bot connected', 'success');
    } catch (error) { setStatus(error.message || 'Could not connect bot', 'error'); }
    finally { setBusy(event.currentTarget, false); }
  }

  async function testTranscription(event) {
    setBusy(event.currentTarget, true, 'Testing...');
    setStatus('Testing...', 'pending');
    try {
      const data = await bridge().api('/api/admin/telegram-bots/test-transcription', {
        method: 'POST', body: { ...serializeForm(), telegram_bot_id: state.selectedBotId },
      });
      setStatus(t('Model works: {provider} / {model}, {latency} ms', data), 'success');
    } catch (error) { setStatus(error.message || 'Model test failed', 'error'); }
    finally { setBusy(event.currentTarget, false); }
  }

  async function testImage(event) {
    setBusy(event.currentTarget, true, 'Testing image bot...');
    setStatus('Testing image bot...', 'pending');
    try {
      const data = await bridge().api('/api/admin/telegram-bots/test-image', {
        method: 'POST', body: { image_bot_id: Number($('#telegramBotImageBot').value || 0) || null },
      });
      setStatus(t('Image bot works: {provider} / {model}, {latency} ms, {bytes} bytes', data), 'success');
    } catch (error) { setStatus(error.message || 'Image bot test failed', 'error'); }
    finally { setBusy(event.currentTarget, false); }
  }

  function bootstrap() { ensureUi(); }
  window.addEventListener('bananza:ready', bootstrap);
  window.addEventListener('bananza:languagechange', () => {
    window.BananzaI18n?.applyStaticDom?.($('#telegramBotsModal') || document);
    window.BananzaI18n?.applyStaticDom?.($('#telegramBotHistoryModal') || document);
    if ($('#telegramBotsModal')) render();
    if (!$('#telegramBotHistoryModal')?.classList.contains('hidden') && state.history.data) renderHistory();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  else bootstrap();
})();
