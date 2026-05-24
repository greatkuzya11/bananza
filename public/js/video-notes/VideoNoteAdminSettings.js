(function () {
  'use strict';

  const ns = window.BananzaVideoNotes = window.BananzaVideoNotes || {};
  const VIDEO_NOTE_SETTINGS_ICON = String.fromCodePoint(0x1F3AC);

  const state = {
    uiReady: false,
    admin: {
      settings: null,
      options: null,
      loading: false,
    },
  };

  const hooks = window.BananzaVideoNoteAdminHooks = window.BananzaVideoNoteAdminHooks || {};
  Object.assign(hooks, {
    closeAll: (options = {}) => hideVideoNoteAdminModal(options),
    handleWSMessage: (msg) => handleWSMessage(msg),
    onSettingsOpened: () => syncAdminEntryVisibility(),
  });

  function getBridge() {
    return window.BananzaAppBridge || null;
  }

  function t(key, params = {}) {
    return getBridge()?.t?.(key, params)
      || window.BananzaI18n?.t?.(key, params)
      || String(key || '');
  }

  function videoNoteSettingsLabel() {
    return `${VIDEO_NOTE_SETTINGS_ICON} ${t('Video notes')}`;
  }

  function tx(text, params = {}) {
    return getBridge()?.tx?.(text, params)
      || window.BananzaI18n?.text?.(text, params)
      || String(text == null ? '' : text);
  }

  function currentUser() {
    return getBridge()?.getCurrentUser?.() || null;
  }

  function isAdmin() {
    return Boolean(currentUser()?.is_admin);
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function applyLocalizedDom(root = document) {
    getBridge()?.applyLocalizedDom?.(root);
    window.BananzaI18n?.applyStaticDom?.(root);
  }

  function ensureVideoNoteAdminUi() {
    if (state.uiReady) return;

    const settingsAdminPanel = document.getElementById('settingsAdminPanel');
    if (settingsAdminPanel && !document.getElementById('settingsVideoNotePanel')) {
      const btn = document.createElement('button');
      btn.id = 'settingsVideoNotePanel';
      btn.className = 'settings-item hidden';
      btn.textContent = videoNoteSettingsLabel();
      settingsAdminPanel.insertAdjacentElement('afterend', btn);
      btn.addEventListener('click', openVideoNoteAdminModal);
    }

    if (!document.getElementById('videoNoteAdminModal')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <div id="videoNoteAdminModal" class="modal hidden">
          <div class="modal-content voice-admin-modal video-note-admin-modal">
            <div class="modal-header">
              <h3>${t('Video notes')}</h3>
              <button type="button" class="modal-close" id="videoNoteAdminClose" aria-label="${t('Close')}">&times;</button>
            </div>
            <div class="modal-body">
              <div class="settings-item settings-toggle-item">
                <span>${t('Enable video notes')}</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="videoNoteEnabledToggle">
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="field-group">
                <label>${t('Default video note shape')}</label>
                <select id="videoNoteDefaultShape" class="modal-input"></select>
              </div>
              <div class="field-group">
                <label>${t('Video note transcription')}</label>
                <select id="videoNoteTranscriptionMode" class="modal-input"></select>
              </div>
              <div class="field-group">
                <label>${t('Transcription provider')}</label>
                <select id="videoNoteTranscriptionProvider" class="modal-input"></select>
                <div class="voice-form-hint">${t('Use voice provider inherits the active voice transcription settings.')}</div>
              </div>
              <div class="field-group">
                <label>${t('Maximum video note length, ms')}</label>
                <input type="number" id="videoNoteMaxDurationMs" class="modal-input" min="5000" max="120000" step="1000">
              </div>
              <div class="voice-inline-actions voice-admin-actions">
                <button type="button" id="videoNoteSaveSettingsBtn" class="btn-primary">${t('Save')}</button>
              </div>
              <div id="videoNoteAdminStatus" class="voice-admin-status hidden"></div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(wrapper.firstElementChild);
      applyLocalizedDom(document.getElementById('videoNoteAdminModal'));
    }

    getBridge()?.registerManagedModal?.('videoNoteAdminModal');
    bindVideoNoteAdminUiEvents();
    state.uiReady = true;
  }

  function bindVideoNoteAdminUiEvents() {
    const modal = document.getElementById('videoNoteAdminModal');
    if (!modal || modal.dataset.bound === '1') return;
    modal.dataset.bound = '1';
    document.getElementById('videoNoteAdminClose')?.addEventListener('click', hideVideoNoteAdminModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) hideVideoNoteAdminModal();
    });
    document.getElementById('videoNoteSaveSettingsBtn')?.addEventListener('click', () => {
      saveVideoNoteSettings().catch((error) => {
        setAdminStatus(error.message || 'Could not save settings', 'error');
      });
    });
  }

  function syncAdminEntryVisibility() {
    ensureVideoNoteAdminUi();
    const btn = document.getElementById('settingsVideoNotePanel');
    if (!btn) return;
    btn.textContent = videoNoteSettingsLabel();
    btn.classList.toggle('hidden', !isAdmin());
  }

  async function openVideoNoteAdminModal() {
    if (!isAdmin()) return;
    ensureVideoNoteAdminUi();
    if (getBridge()?.openManagedModal) getBridge().openManagedModal('videoNoteAdminModal');
    else document.getElementById('videoNoteAdminModal')?.classList.remove('hidden');
    await loadAdminSettings();
  }

  function hideVideoNoteAdminModal(options = {}) {
    if (getBridge()?.closeManagedModal) {
      getBridge().closeManagedModal('videoNoteAdminModal', options);
      return;
    }
    document.getElementById('videoNoteAdminModal')?.classList.add('hidden');
  }

  function setAdminStatus(message, kind) {
    const el = document.getElementById('videoNoteAdminStatus');
    if (!el) return;
    if (!message) {
      el.className = 'voice-admin-status hidden';
      el.textContent = '';
      return;
    }
    el.className = `voice-admin-status ${kind || ''}`;
    el.textContent = tx(message);
  }

  async function loadAdminSettings() {
    if (state.admin.loading) return;
    state.admin.loading = true;
    setAdminStatus('Loading settings...', 'pending');
    try {
      const data = await getBridge().api('/api/admin/video-note-settings');
      state.admin.settings = data.settings;
      state.admin.options = data.options;
      fillAdminForm();
      setAdminStatus('', '');
    } catch (error) {
      setAdminStatus(error.message || 'Could not load settings', 'error');
    } finally {
      state.admin.loading = false;
    }
  }

  function fillSelect(selectId, items, selectedValue) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const normalizedItems = Array.isArray(items) ? items : [];
    select.innerHTML = normalizedItems
      .map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(tx(item.label))}</option>`)
      .join('');
    select.value = selectedValue || (normalizedItems[0] ? normalizedItems[0].value : '');
  }

  function fillAdminForm() {
    const settings = state.admin.settings;
    const options = state.admin.options;
    if (!settings || !options) return;
    document.getElementById('videoNoteEnabledToggle').checked = settings.video_notes_enabled !== false;
    fillSelect('videoNoteDefaultShape', options.shapes, settings.video_note_default_shape_id || 'banana-fat');
    fillSelect('videoNoteTranscriptionMode', options.transcription_modes, settings.video_note_transcription_mode || 'manual');
    fillSelect('videoNoteTranscriptionProvider', options.providers, settings.video_note_transcription_provider || 'voice');
    document.getElementById('videoNoteMaxDurationMs').value = Number(settings.video_note_max_duration_ms || 30000);
  }

  function serializeAdminForm() {
    return {
      video_notes_enabled: document.getElementById('videoNoteEnabledToggle')?.checked || false,
      video_note_default_shape_id: document.getElementById('videoNoteDefaultShape')?.value || 'banana-fat',
      video_note_transcription_mode: document.getElementById('videoNoteTranscriptionMode')?.value || 'manual',
      video_note_transcription_provider: document.getElementById('videoNoteTranscriptionProvider')?.value || 'voice',
      video_note_max_duration_ms: Number(document.getElementById('videoNoteMaxDurationMs')?.value || 30000),
    };
  }

  async function saveVideoNoteSettings() {
    setAdminStatus('Saving settings...', 'pending');
    const data = await getBridge().api('/api/admin/video-note-settings', {
      method: 'PUT',
      body: serializeAdminForm(),
    });
    state.admin.settings = data.settings;
    state.admin.options = data.options;
    fillAdminForm();
    window.BananzaVoiceHooks?.handleWSMessage?.({
      type: 'video_note_settings_updated',
      settings: data.publicSettings || data.settings,
    });
    window.BananzaVideoNoteHooks?.refreshComposerState?.();
    setAdminStatus('Settings saved', 'success');
  }

  function handleWSMessage(msg) {
    if (msg?.type !== 'video_note_settings_updated') return;
    if (state.admin.settings) {
      state.admin.settings = { ...state.admin.settings, ...(msg.settings || {}) };
      fillAdminForm();
    }
    window.BananzaVideoNoteHooks?.refreshComposerState?.();
  }

  function bootstrap() {
    ensureVideoNoteAdminUi();
    syncAdminEntryVisibility();
    getBridge()?.onLanguageChange?.(() => {
      if (!state.uiReady) return;
      const btn = document.getElementById('settingsVideoNotePanel');
      if (btn) btn.textContent = videoNoteSettingsLabel();
      if (state.admin.settings) {
        state.uiReady = false;
        document.getElementById('videoNoteAdminModal')?.remove();
        ensureVideoNoteAdminUi();
        fillAdminForm();
      }
    });
  }

  window.addEventListener('bananza:ready', bootstrap);
  if (document.readyState !== 'loading') {
    bootstrap();
  } else {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  }

  ns.VideoNoteAdminSettings = { ensureVideoNoteAdminUi };
})();
