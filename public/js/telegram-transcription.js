(function () {
  'use strict';

  const state = {
    settings: null,
    options: null,
    contextBots: [],
    readiness: {},
    runtime: null,
    loading: false,
    refreshTimer: null,
  };

  function bridge() {
    return window.BananzaAppBridge || null;
  }

  function t(key, params = {}) {
    return bridge()?.t?.(key, params) || window.BananzaI18n?.t?.(key, params) || String(key || '');
  }

  function esc(value) {
    const node = document.createElement('div');
    node.textContent = value == null ? '' : String(value);
    return node.innerHTML;
  }

  function isAdmin() {
    return Boolean(bridge()?.getCurrentUser?.()?.is_admin);
  }

  function setStatus(message, kind = '') {
    const node = document.getElementById('telegramTranscriptionAdminStatus');
    if (!node) return;
    node.textContent = message ? t(message) : '';
    node.className = `voice-admin-status${kind ? ` ${kind}` : ''}${message ? '' : ' hidden'}`;
  }

  function setBotTestStatus(message, kind = '') {
    const node = document.getElementById('telegramTranscriptionBotTestStatus');
    if (!node) return;
    node.textContent = message ? t(message) : '';
    node.className = `telegram-bot-test-status${kind ? ` ${kind}` : ''}${message ? '' : ' hidden'}`;
  }

  function setButtonBusy(button, busy, busyLabel) {
    if (!button) return;
    if (busy) {
      button.dataset.idleLabel = button.textContent;
      button.textContent = t(busyLabel);
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      return;
    }
    button.textContent = button.dataset.idleLabel || button.textContent;
    delete button.dataset.idleLabel;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }

  function ensureUi() {
    if (!document.getElementById('settingsTelegramTranscription')) {
      const anchor = document.getElementById('settingsVoicePanel') || document.getElementById('settingsAdminPanel');
      if (anchor) {
        const button = document.createElement('button');
        button.id = 'settingsTelegramTranscription';
        button.type = 'button';
        button.className = 'settings-item hidden';
        button.textContent = `📨 ${t('Telegram transcription')}`;
        anchor.insertAdjacentElement('afterend', button);
        button.addEventListener('click', openModal);
      }
    }

    if (!document.getElementById('telegramTranscriptionModal')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <div id="telegramTranscriptionModal" class="modal hidden">
          <div class="modal-content voice-admin-modal telegram-transcription-modal">
            <div class="modal-header">
              <h3>${esc(t('Telegram transcription'))}</h3>
              <button type="button" class="modal-close" id="telegramTranscriptionClose" aria-label="${esc(t('Close'))}">×</button>
            </div>
            <div class="modal-body">
              <div class="telegram-setup-card">
                <strong>${esc(t('1. Create a bot in @BotFather'))}</strong>
                <div class="voice-form-hint">${esc(t('Use /newbot, choose a name and username, then copy the bot token here. Telegram API ID, API hash, phone number, public URL, and manual webhook are not required.'))}</div>
                <a class="weather-action-btn telegram-action-link" href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">${esc(t('Open @BotFather'))}</a>
              </div>

              <div class="settings-item settings-toggle-item">
                <span>${esc(t('Enable Telegram transcription'))}</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="telegramTranscriptionEnabled">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="field-group">
                <label>${esc(t('Telegram bot token'))}</label>
                <input type="password" id="telegramTranscriptionToken" class="modal-input" autocomplete="new-password" placeholder="${esc(t('Paste a new bot token'))}">
                <div id="telegramTranscriptionTokenState" class="voice-key-state"></div>
              </div>
              <div class="voice-inline-actions">
                <button type="button" id="telegramTranscriptionTestBot" class="btn-sm voice-inline-btn">${esc(t('Test bot'))}</button>
                <button type="button" id="telegramTranscriptionConnect" class="btn-primary">${esc(t('Check and connect'))}</button>
                <button type="button" id="telegramTranscriptionDeleteToken" class="weather-action-btn">${esc(t('Delete token'))}</button>
              </div>
              <div id="telegramTranscriptionBotTestStatus" class="telegram-bot-test-status hidden" role="status" aria-live="polite"></div>

              <div id="telegramTranscriptionBotIdentity" class="telegram-bot-identity hidden"></div>
              <div id="telegramTranscriptionWebhookConflict" class="telegram-warning hidden">
                <span>${esc(t('This bot has an active webhook or another poller. Claiming it removes the webhook and drops pending updates.'))}</span>
                <button type="button" id="telegramTranscriptionClaim" class="weather-action-btn">${esc(t('Claim bot for BananZa'))}</button>
              </div>

              <div class="telegram-setup-card">
                <strong>${esc(t('2. Open the bot and send /start'))}</strong>
                <div class="voice-form-hint">${esc(t('The bot will reply with your numeric Telegram ID. Add that ID to the access list below.'))}</div>
              </div>

              <div class="field-group">
                <label>${esc(t('Allowed Telegram user IDs'))}</label>
                <textarea id="telegramTranscriptionAllowlist" class="modal-input telegram-allowlist" rows="4" placeholder="123456789"></textarea>
                <div class="voice-form-hint">${esc(t('One numeric ID per line. Only private chats are accepted.'))}</div>
              </div>

              <div class="field-grid">
                <div class="field-group">
                  <label>${esc(t('Active provider'))}</label>
                  <select id="telegramTranscriptionProvider" class="modal-input"></select>
                </div>
                <div class="field-group">
                  <label>${esc(t('Model'))}</label>
                  <select id="telegramTranscriptionModel" class="modal-input"></select>
                </div>
                <div class="field-group">
                  <label>${esc(t('Language'))}</label>
                  <input id="telegramTranscriptionLanguage" class="modal-input" type="text" placeholder="ru">
                </div>
                <div class="field-group">
                  <label>${esc(t('Transcription timeout, ms'))}</label>
                  <input id="telegramTranscriptionTimeout" class="modal-input" type="number" min="5000" max="300000">
                </div>
                <div class="field-group">
                  <label>${esc(t('Maximum file size, MB'))}</label>
                  <input id="telegramTranscriptionMaxSize" class="modal-input" type="number" min="1" max="20">
                </div>
                <div id="telegramTranscriptionVoskPathGroup" class="field-group hidden">
                  <label>${esc(t('Vosk model path (optional)'))}</label>
                  <input id="telegramTranscriptionVoskPath" class="modal-input" type="text">
                </div>
              </div>

              <div class="settings-item settings-toggle-item">
                <span>${esc(t('Fallback to OpenAI'))}</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="telegramTranscriptionFallback">
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="settings-item settings-toggle-item">
                <span>${esc(t('Use context bot'))}</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="telegramTranscriptionContextEnabled">
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="field-group">
                <label>${esc(t('Context convert bot'))}</label>
                <select id="telegramTranscriptionContextBot" class="modal-input"></select>
              </div>

              <div id="telegramTranscriptionProviderReadiness" class="telegram-provider-readiness"></div>
              <div class="voice-inline-actions voice-admin-actions">
                <button type="button" id="telegramTranscriptionOpenVoice" class="weather-action-btn">${esc(t('Open voice provider settings'))}</button>
                <button type="button" id="telegramTranscriptionTestModel" class="btn-sm voice-inline-btn">${esc(t('Test model'))}</button>
                <button type="button" id="telegramTranscriptionSave" class="btn-primary">${esc(t('Save'))}</button>
              </div>

              <div id="telegramTranscriptionRuntime" class="telegram-runtime"></div>
              <div id="telegramTranscriptionAdminStatus" class="voice-admin-status hidden"></div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(wrapper.firstElementChild);
      bindEvents();
      bridge()?.registerManagedModal?.('telegramTranscriptionModal');
    }
    document.getElementById('settingsTelegramTranscription')?.classList.toggle('hidden', !isAdmin());
  }

  function bindEvents() {
    const modal = document.getElementById('telegramTranscriptionModal');
    document.getElementById('telegramTranscriptionClose')?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    document.getElementById('telegramTranscriptionProvider')?.addEventListener('change', renderProviderFields);
    document.getElementById('telegramTranscriptionContextEnabled')?.addEventListener('change', syncContextSelect);
    document.getElementById('telegramTranscriptionSave')?.addEventListener('click', saveSettings);
    document.getElementById('telegramTranscriptionConnect')?.addEventListener('click', connectBot);
    document.getElementById('telegramTranscriptionTestBot')?.addEventListener('click', testBot);
    document.getElementById('telegramTranscriptionTestModel')?.addEventListener('click', testModel);
    document.getElementById('telegramTranscriptionClaim')?.addEventListener('click', claimBot);
    document.getElementById('telegramTranscriptionDeleteToken')?.addEventListener('click', deleteToken);
    document.getElementById('telegramTranscriptionOpenVoice')?.addEventListener('click', () => {
      closeModal();
      document.getElementById('settingsVoicePanel')?.click();
    });
  }

  async function openModal() {
    if (!isAdmin()) return;
    ensureUi();
    bridge()?.openManagedModal?.('telegramTranscriptionModal');
    await loadSettings();
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = window.setInterval(refreshRuntime, 5000);
  }

  function closeModal() {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = null;
    if (bridge()?.closeManagedModal) bridge().closeManagedModal('telegramTranscriptionModal');
    else document.getElementById('telegramTranscriptionModal')?.classList.add('hidden');
  }

  async function loadSettings() {
    if (state.loading) return;
    state.loading = true;
    setStatus('Loading settings...', 'pending');
    try {
      applyPayload(await bridge().api('/api/admin/telegram-transcription'));
      setStatus('', '');
    } catch (error) {
      setStatus(error.message || 'Could not load settings', 'error');
    } finally {
      state.loading = false;
    }
  }

  async function refreshRuntime() {
    try {
      const data = await bridge().api('/api/admin/telegram-transcription');
      state.runtime = data.runtime;
      state.readiness = data.providerReadiness || state.readiness;
      renderRuntime();
      renderReadiness();
    } catch {}
  }

  function applyPayload(data = {}) {
    state.settings = data.settings || state.settings;
    state.options = data.options || state.options;
    state.contextBots = data.contextConvertBots || [];
    state.readiness = data.providerReadiness || {};
    state.runtime = data.runtime || null;
    fillForm();
  }

  function fillForm() {
    const settings = state.settings;
    if (!settings) return;
    document.getElementById('telegramTranscriptionEnabled').checked = Boolean(settings.enabled);
    document.getElementById('telegramTranscriptionToken').value = '';
    document.getElementById('telegramTranscriptionToken').placeholder = settings.masked_bot_token
      ? t('Saved token {token}', { token: settings.masked_bot_token })
      : t('Paste a new bot token');
    document.getElementById('telegramTranscriptionTokenState').textContent = settings.has_bot_token
      ? t('Token saved: {token}', { token: settings.masked_bot_token })
      : t('Token is not saved');
    document.getElementById('telegramTranscriptionDeleteToken').classList.toggle('hidden', !settings.has_bot_token);
    document.getElementById('telegramTranscriptionAllowlist').value = (settings.allowed_user_ids || []).join('\n');
    document.getElementById('telegramTranscriptionTimeout').value = Number(settings.transcription_timeout_ms || 120000);
    document.getElementById('telegramTranscriptionMaxSize').value = Math.round(Number(settings.max_file_size_bytes || 20971520) / 1048576);
    document.getElementById('telegramTranscriptionFallback').checked = Boolean(settings.fallback_to_openai);
    document.getElementById('telegramTranscriptionContextEnabled').checked = Boolean(settings.context_bot_enabled);
    document.getElementById('telegramTranscriptionVoskPath').value = settings.vosk_model_path || '';

    const providerSelect = document.getElementById('telegramTranscriptionProvider');
    providerSelect.innerHTML = (state.options?.providers || []).map((item) => (
      `<option value="${esc(item.value)}">${esc(t(item.label))}</option>`
    )).join('');
    providerSelect.value = settings.active_provider || 'whisper';
    renderProviderFields();
    fillContextBots();
    renderIdentity();
    renderReadiness();
    renderRuntime();
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

  function renderProviderFields() {
    const provider = document.getElementById('telegramTranscriptionProvider')?.value || 'whisper';
    const modelSelect = document.getElementById('telegramTranscriptionModel');
    const modelKey = providerModelKey(provider);
    const models = state.options?.models?.[provider] || [];
    modelSelect.innerHTML = models.map((item) => `<option value="${esc(item.value)}">${esc(t(item.label))}</option>`).join('');
    if (!models.length) modelSelect.innerHTML = '<option value="speech-to-text">speech-to-text</option>';
    modelSelect.value = modelKey ? (state.settings?.[modelKey] || models[0]?.value || '') : 'speech-to-text';
    modelSelect.disabled = provider === 'grok';
    document.getElementById('telegramTranscriptionLanguage').value = state.settings?.[providerLanguageKey(provider)] || 'ru';
    document.getElementById('telegramTranscriptionVoskPathGroup').classList.toggle('hidden', provider !== 'vosk');
    renderReadiness();
  }

  function fillContextBots() {
    const select = document.getElementById('telegramTranscriptionContextBot');
    const selectable = (state.contextBots || []).filter((bot) => bot.enabled !== false && bot.provider_enabled !== false);
    select.innerHTML = selectable.length
      ? selectable.map((bot) => `<option value="${Number(bot.id)}">${esc(`${bot.name || t('Unnamed bot')} (${bot.provider || 'openai'})`)}</option>`).join('')
      : `<option value="">${esc(t('No context convert bots available'))}</option>`;
    select.value = state.settings?.context_bot_id ? String(state.settings.context_bot_id) : String(selectable[0]?.id || '');
    syncContextSelect();
  }

  function syncContextSelect() {
    const enabled = Boolean(document.getElementById('telegramTranscriptionContextEnabled')?.checked);
    const hasBots = Boolean((state.contextBots || []).some((bot) => bot.enabled !== false && bot.provider_enabled !== false));
    document.getElementById('telegramTranscriptionContextBot').disabled = !enabled || !hasBots;
  }

  function renderIdentity() {
    const node = document.getElementById('telegramTranscriptionBotIdentity');
    const username = state.settings?.bot_username || '';
    if (!state.settings?.bot_id) {
      node.classList.add('hidden');
      node.innerHTML = '';
      return;
    }
    const title = state.settings.bot_name || username || state.settings.bot_id;
    node.classList.remove('hidden');
    node.innerHTML = `
      <div><strong>${esc(t('Connected bot'))}:</strong> ${esc(title)}${username ? ` · @${esc(username)}` : ''}</div>
      ${username ? `<a class="btn-sm voice-inline-btn" href="https://t.me/${encodeURIComponent(username)}" target="_blank" rel="noopener noreferrer">${esc(t('Open bot in Telegram'))}</a>` : ''}`;
  }

  function renderReadiness() {
    const node = document.getElementById('telegramTranscriptionProviderReadiness');
    if (!node) return;
    const provider = document.getElementById('telegramTranscriptionProvider')?.value || state.settings?.active_provider || 'whisper';
    const ready = Boolean(state.readiness?.[provider]);
    const fallbackReady = state.readiness?.fallback_openai !== false;
    node.className = `telegram-provider-readiness ${ready && fallbackReady ? 'ready' : 'error'}`;
    if (['whisper', 'vosk'].includes(provider) && state.readiness?.ffmpeg === false) {
      node.textContent = t('FFmpeg is unavailable. Install project dependencies or set BANANZA_FFMPEG_PATH.');
    } else {
      node.textContent = ready && fallbackReady
        ? t('Provider is configured in voice settings')
        : t('Provider credentials or helper are missing in voice settings');
    }
  }

  function renderRuntime() {
    const node = document.getElementById('telegramTranscriptionRuntime');
    if (!node || !state.runtime) return;
    const queue = state.runtime.queue || {};
    node.innerHTML = `
      <strong>${esc(t('Runtime status'))}:</strong> ${esc(t(state.runtime.state || 'stopped'))}
      · ${esc(t('Queue'))}: ${Number(queue.total || 0)}
      ${state.runtime.last_error ? `<div class="telegram-runtime-error">${esc(t(state.runtime.last_error))}</div>` : ''}`;
    document.getElementById('telegramTranscriptionWebhookConflict')?.classList.toggle(
      'hidden',
      !state.runtime.webhook_conflict && state.runtime.state !== 'conflict'
    );
  }

  function serializeForm({ forceEnabled } = {}) {
    const provider = document.getElementById('telegramTranscriptionProvider')?.value || 'whisper';
    const modelKey = providerModelKey(provider);
    const languageKey = providerLanguageKey(provider);
    const body = {
      enabled: forceEnabled == null ? Boolean(document.getElementById('telegramTranscriptionEnabled')?.checked) : Boolean(forceEnabled),
      bot_token: document.getElementById('telegramTranscriptionToken')?.value || '',
      allowed_user_ids: document.getElementById('telegramTranscriptionAllowlist')?.value || '',
      active_provider: provider,
      fallback_to_openai: Boolean(document.getElementById('telegramTranscriptionFallback')?.checked),
      context_bot_enabled: Boolean(document.getElementById('telegramTranscriptionContextEnabled')?.checked),
      context_bot_id: Number(document.getElementById('telegramTranscriptionContextBot')?.value || 0) || null,
      transcription_timeout_ms: Number(document.getElementById('telegramTranscriptionTimeout')?.value || 120000),
      max_file_size_bytes: Number(document.getElementById('telegramTranscriptionMaxSize')?.value || 20) * 1048576,
      vosk_model_path: document.getElementById('telegramTranscriptionVoskPath')?.value || '',
    };
    if (modelKey) body[modelKey] = document.getElementById('telegramTranscriptionModel')?.value || '';
    body[languageKey] = document.getElementById('telegramTranscriptionLanguage')?.value || 'ru';
    return body;
  }

  async function saveSettings(event, options = {}) {
    const button = event?.currentTarget;
    if (button) button.disabled = true;
    setStatus('Saving settings...', 'pending');
    try {
      const data = await bridge().api('/api/admin/telegram-transcription', {
        method: 'PUT',
        body: serializeForm(options),
      });
      applyPayload(data);
      setStatus('Settings saved', 'success');
      return data;
    } catch (error) {
      setStatus(error.message || 'Could not save settings', 'error');
      throw error;
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function connectBot(event) {
    document.getElementById('telegramTranscriptionEnabled').checked = true;
    try {
      await saveSettings(event, { forceEnabled: true });
      setStatus('Bot connected. Open it in Telegram and send /start.', 'success');
    } catch {}
  }

  async function testBot(event) {
    const button = event.currentTarget;
    setButtonBusy(button, true, 'Testing bot...');
    setBotTestStatus('Testing bot...', 'pending');
    try {
      const data = await bridge().api('/api/admin/telegram-transcription/test-bot', {
        method: 'POST',
        body: { bot_token: document.getElementById('telegramTranscriptionToken')?.value || '' },
      });
      const username = data.bot?.username ? ` @${data.bot.username}` : '';
      const botLabel = `${data.bot?.name || data.bot?.id || ''}${username}`.trim();
      state.settings = {
        ...(state.settings || {}),
        bot_id: String(data.bot?.id || ''),
        bot_name: String(data.bot?.name || ''),
        bot_username: String(data.bot?.username || ''),
      };
      renderIdentity();
      const result = t('Bot connection works: {bot}', { bot: botLabel });
      const webhookWarning = data.webhook?.active
        ? ` ${t('An active webhook blocks long polling. Claim the bot for BananZa below.')}`
        : '';
      setBotTestStatus(`${result}${webhookWarning}`, data.webhook?.active ? 'warning' : 'success');
      document.getElementById('telegramTranscriptionWebhookConflict')?.classList.toggle('hidden', !data.webhook?.active);
    } catch (error) {
      setBotTestStatus(error.message || 'Bot test failed', 'error');
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function testModel(event) {
    event.currentTarget.disabled = true;
    setStatus('Testing...', 'pending');
    try {
      const data = await bridge().api('/api/admin/telegram-transcription/test-model', {
        method: 'POST',
        body: serializeForm(),
      });
      setStatus(t('Model works: {provider} / {model}, {latency} ms', {
        provider: data.provider,
        model: data.model,
        latency: data.latency_ms,
      }), 'success');
    } catch (error) {
      setStatus(error.message || 'Model test failed', 'error');
    } finally {
      event.currentTarget.disabled = false;
    }
  }

  async function claimBot(event) {
    if (!confirm(t('Remove the current Telegram webhook and drop pending updates?'))) return;
    event.currentTarget.disabled = true;
    setStatus('Connecting bot...', 'pending');
    try {
      applyPayload(await bridge().api('/api/admin/telegram-transcription/claim', { method: 'POST', body: {} }));
      setStatus('Bot connected', 'success');
    } catch (error) {
      setStatus(error.message || 'Could not connect bot', 'error');
    } finally {
      event.currentTarget.disabled = false;
    }
  }

  async function deleteToken(event) {
    if (!confirm(t('Delete the saved Telegram bot token?'))) return;
    event.currentTarget.disabled = true;
    try {
      applyPayload(await bridge().api('/api/admin/telegram-transcription/token', { method: 'DELETE' }));
      setStatus('Token deleted', 'success');
    } catch (error) {
      setStatus(error.message || 'Could not delete token', 'error');
    } finally {
      event.currentTarget.disabled = false;
    }
  }

  function bootstrap() {
    ensureUi();
  }

  window.addEventListener('bananza:ready', bootstrap);
  window.addEventListener('bananza:languagechange', () => {
    window.BananzaI18n?.applyStaticDom?.(document.getElementById('telegramTranscriptionModal') || document);
    if (state.settings) fillForm();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  else bootstrap();
})();
