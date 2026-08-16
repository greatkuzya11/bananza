(function () {
  'use strict';

  const state = {
    settings: null,
    telegram: null,
    imageBots: [],
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
    const node = document.getElementById('telegramImageGenerationStatus');
    if (!node) return;
    node.textContent = message ? t(message) : '';
    node.className = `voice-admin-status${kind ? ` ${kind}` : ''}${message ? '' : ' hidden'}`;
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
    if (!document.getElementById('settingsTelegramImageGeneration')) {
      const anchor = document.getElementById('settingsTelegramTranscription')
        || document.getElementById('settingsVoicePanel')
        || document.getElementById('settingsAdminPanel');
      if (anchor) {
        const button = document.createElement('button');
        button.id = 'settingsTelegramImageGeneration';
        button.type = 'button';
        button.className = 'settings-item hidden';
        button.textContent = `🎨 ${t('Telegram image generation')}`;
        anchor.insertAdjacentElement('afterend', button);
        button.addEventListener('click', openModal);
      }
    }

    if (!document.getElementById('telegramImageGenerationModal')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <div id="telegramImageGenerationModal" class="modal hidden">
          <div class="modal-content voice-admin-modal telegram-transcription-modal telegram-image-generation-modal">
            <div class="modal-header">
              <h3>${esc(t('Telegram image generation'))}</h3>
              <button type="button" class="modal-close" id="telegramImageGenerationClose" aria-label="${esc(t('Close'))}">×</button>
            </div>
            <div class="modal-body">
              <div class="telegram-setup-card">
                <strong>${esc(t('Shared Telegram bot'))}</strong>
                <div id="telegramImageGenerationTelegramState" class="voice-form-hint"></div>
                <button type="button" id="telegramImageGenerationOpenTelegram" class="weather-action-btn">${esc(t('Open Telegram bot settings'))}</button>
              </div>

              <div class="settings-item settings-toggle-item">
                <span>${esc(t('Enable Telegram image generation'))}</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="telegramImageGenerationEnabled">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="field-group">
                <label>${esc(t('Image bot'))}</label>
                <select id="telegramImageGenerationBot" class="modal-input"></select>
                <div class="voice-form-hint">${esc(t('Only enabled OpenAI and Grok image bots with image generation permission are available.'))}</div>
              </div>

              <div id="telegramImageGenerationReadiness" class="telegram-provider-readiness"></div>
              <div class="voice-inline-actions voice-admin-actions">
                <button type="button" id="telegramImageGenerationTest" class="btn-sm voice-inline-btn">${esc(t('Test image bot'))}</button>
                <button type="button" id="telegramImageGenerationSave" class="btn-primary">${esc(t('Save'))}</button>
              </div>

              <div id="telegramImageGenerationRuntime" class="telegram-runtime"></div>
              <div id="telegramImageGenerationStatus" class="voice-admin-status hidden" role="status" aria-live="polite"></div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(wrapper.firstElementChild);
      bindEvents();
      bridge()?.registerManagedModal?.('telegramImageGenerationModal');
    }
    document.getElementById('settingsTelegramImageGeneration')?.classList.toggle('hidden', !isAdmin());
  }

  function bindEvents() {
    const modal = document.getElementById('telegramImageGenerationModal');
    document.getElementById('telegramImageGenerationClose')?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    document.getElementById('telegramImageGenerationBot')?.addEventListener('change', renderReadiness);
    document.getElementById('telegramImageGenerationSave')?.addEventListener('click', saveSettings);
    document.getElementById('telegramImageGenerationTest')?.addEventListener('click', testImageBot);
    document.getElementById('telegramImageGenerationOpenTelegram')?.addEventListener('click', () => {
      closeModal();
      document.getElementById('settingsTelegramTranscription')?.click();
    });
  }

  async function openModal() {
    if (!isAdmin()) return;
    ensureUi();
    bridge()?.openManagedModal?.('telegramImageGenerationModal');
    await loadSettings();
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = window.setInterval(refreshRuntime, 5000);
  }

  function closeModal() {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = null;
    if (bridge()?.closeManagedModal) bridge().closeManagedModal('telegramImageGenerationModal');
    else document.getElementById('telegramImageGenerationModal')?.classList.add('hidden');
  }

  async function loadSettings() {
    if (state.loading) return;
    state.loading = true;
    setStatus('Loading settings...', 'pending');
    try {
      applyPayload(await bridge().api('/api/admin/telegram-image-generation'));
      setStatus('', '');
    } catch (error) {
      setStatus(error.message || 'Could not load settings', 'error');
    } finally {
      state.loading = false;
    }
  }

  async function refreshRuntime() {
    try {
      const data = await bridge().api('/api/admin/telegram-image-generation');
      state.runtime = data.runtime || state.runtime;
      state.telegram = data.telegram || state.telegram;
      renderRuntime();
      renderTelegramState();
    } catch {}
  }

  function applyPayload(data = {}) {
    state.settings = data.settings || state.settings;
    state.telegram = data.telegram || state.telegram;
    state.imageBots = Array.isArray(data.imageBots) ? data.imageBots : state.imageBots;
    state.runtime = data.runtime || state.runtime;
    fillForm();
  }

  function fillForm() {
    if (!state.settings) return;
    document.getElementById('telegramImageGenerationEnabled').checked = Boolean(state.settings.enabled);
    const select = document.getElementById('telegramImageGenerationBot');
    select.innerHTML = state.imageBots.length
      ? state.imageBots.map((bot) => `<option value="${Number(bot.id)}">${esc(`${bot.name || t('Unnamed bot')} (${bot.provider || 'openai'} · ${bot.image_model || t('Default model')})`)}</option>`).join('')
      : `<option value="">${esc(t('No image bots available'))}</option>`;
    const desired = String(state.settings.image_bot_id || '');
    if (state.imageBots.some((bot) => String(bot.id) === desired)) select.value = desired;
    if (!select.value && state.imageBots[0]) select.value = String(state.imageBots[0].id);
    select.disabled = !state.imageBots.length;
    renderTelegramState();
    renderReadiness();
    renderRuntime();
  }

  function renderTelegramState() {
    const node = document.getElementById('telegramImageGenerationTelegramState');
    if (!node) return;
    if (!state.telegram?.configured) {
      node.textContent = t('Telegram bot is not configured');
      return;
    }
    const username = state.telegram.bot_username ? ` @${state.telegram.bot_username}` : '';
    const name = state.telegram.bot_name || state.telegram.bot_id || t('Connected bot');
    node.textContent = `${name}${username} · ${t('Allowed users: {count}', { count: Number(state.telegram.allowed_user_count || 0) })}`;
  }

  function selectedBot() {
    const id = Number(document.getElementById('telegramImageGenerationBot')?.value || 0);
    return state.imageBots.find((bot) => Number(bot.id) === id) || null;
  }

  function renderReadiness() {
    const node = document.getElementById('telegramImageGenerationReadiness');
    if (!node) return;
    const bot = selectedBot();
    const ready = Boolean(state.telegram?.configured && bot);
    node.className = `telegram-provider-readiness ${ready ? 'ready' : 'error'}`;
    node.textContent = ready
      ? t('Image bot is ready: {provider} / {model}', { provider: bot.provider, model: bot.image_model || t('Default model') })
      : t('Configure the shared Telegram bot and an enabled image bot first');
    document.getElementById('telegramImageGenerationTest').disabled = !bot;
  }

  function renderRuntime() {
    const node = document.getElementById('telegramImageGenerationRuntime');
    if (!node || !state.runtime) return;
    const queue = state.runtime.queue?.image || {};
    node.innerHTML = `
      <strong>${esc(t('Runtime status'))}:</strong> ${esc(t(state.runtime.state || 'stopped'))}
      · ${esc(t('Image queue'))}: ${Number(queue.total || 0)}
      ${state.runtime.last_error ? `<div class="telegram-runtime-error">${esc(t(state.runtime.last_error))}</div>` : ''}`;
  }

  async function saveSettings(event) {
    const button = event.currentTarget;
    setButtonBusy(button, true, 'Saving...');
    setStatus('Saving...', 'pending');
    try {
      applyPayload(await bridge().api('/api/admin/telegram-image-generation', {
        method: 'PUT',
        body: {
          enabled: Boolean(document.getElementById('telegramImageGenerationEnabled')?.checked),
          image_bot_id: Number(document.getElementById('telegramImageGenerationBot')?.value || 0) || null,
        },
      }));
      setStatus('Telegram image settings saved', 'success');
    } catch (error) {
      setStatus(error.message || 'Could not save Telegram image settings', 'error');
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function testImageBot(event) {
    const button = event.currentTarget;
    setButtonBusy(button, true, 'Testing image bot...');
    setStatus('Testing image bot...', 'pending');
    try {
      const data = await bridge().api('/api/admin/telegram-image-generation/test', {
        method: 'POST',
        body: { image_bot_id: Number(document.getElementById('telegramImageGenerationBot')?.value || 0) || null },
      });
      setStatus(t('Image bot works: {provider} / {model}, {latency} ms, {bytes} bytes', {
        provider: data.provider,
        model: data.model,
        latency: data.latency_ms,
        bytes: data.bytes,
      }), 'success');
    } catch (error) {
      setStatus(error.message || 'Image bot test failed', 'error');
    } finally {
      setButtonBusy(button, false);
    }
  }

  function bootstrap() {
    ensureUi();
  }

  window.addEventListener('bananza:ready', bootstrap);
  window.addEventListener('bananza:languagechange', () => {
    window.BananzaI18n?.applyStaticDom?.(document.getElementById('telegramImageGenerationModal') || document);
    if (state.settings) fillForm();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  else bootstrap();
})();
