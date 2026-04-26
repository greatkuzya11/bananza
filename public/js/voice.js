(function () {
  'use strict';

  const state = {
    ready: false,
    uiReady: false,
    features: {
      voice_notes_enabled: false,
      auto_transcribe_on_send: false,
      voice_note_ui_mode: 'compact',
    },
    admin: {
      settings: null,
      options: null,
      loading: false,
    },
    recorder: {
      holdTimer: null,
      holdDelayMs: 280,
      recording: false,
      suppressNextClick: false,
      startAt: 0,
      stream: null,
      audioContext: null,
      source: null,
      processor: null,
      sink: null,
      chunks: [],
      timerId: null,
      sampleRate: 16000,
      uploading: false,
      prepared: false,
      preparePromise: null,
    },
    playback: {
      activeAudio: null,
      activeButton: null,
    },
  };

  const hooks = window.BananzaVoiceHooks = window.BananzaVoiceHooks || {};

  function safeVibrate(pattern) {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    const activation = navigator.userActivation;
    if (activation && !activation.hasBeenActive) return false;
    try {
      return navigator.vibrate(pattern);
    } catch (e) {
      return false;
    }
  }

  Object.assign(hooks, {
    closeAll: () => hideVoiceAdminModal({ immediate: true }),
    decorateMessageRow: (row, msg) => decorateMessageRow(row, msg),
    handleWSMessage: (msg) => handleWSMessage(msg),
    onSettingsOpened: () => syncAdminEntryVisibility(),
    refreshComposerState: () => syncSendButtonState(),
    canUseGesture: () => canUseVoiceGesture(),
    prepareExternalRecording: () => prepareRecording(),
    cancelPreparedRecording: () => cancelPreparedRecording(),
    startExternalRecording: () => startRecording(),
    stopExternalRecording: () => stopRecordingAndSend(),
    cancelExternalRecording: () => cancelActiveRecording(),
    isRecording: () => Boolean(state.recorder.recording),
    isUploading: () => Boolean(state.recorder.uploading),
    getFeatures: () => ({ ...state.features }),
    setRecorderMessage: (text, kind) => setRecorderMessage(text, kind),
    hideRecorderBar: () => hideRecorderBar(),
    formatDurationMs: (durationMs) => formatDurationMs(durationMs),
  });

  function getBridge() {
    return window.BananzaAppBridge || null;
  }

  function getDom() {
    return getBridge()?.getDom?.() || {};
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

  function formatDurationMs(durationMs) {
    if (!durationMs || durationMs < 1) return '0:00';
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  async function ensureReady() {
    if (state.ready || !getBridge()) return;
    ensureVoiceUi();
    attachRecorderEvents();
    await refreshPublicFeatures();
    refreshVisibleVoiceRows();
    syncAdminEntryVisibility();
    state.ready = true;
  }

  function ensureVoiceUi() {
    if (state.uiReady) return;

    const settingsAdminPanel = document.getElementById('settingsAdminPanel');
    if (settingsAdminPanel && !document.getElementById('settingsVoicePanel')) {
      const btn = document.createElement('button');
      btn.id = 'settingsVoicePanel';
      btn.className = 'settings-item hidden';
      btn.textContent = '🎙️ Голос и расшифровка';
      settingsAdminPanel.insertAdjacentElement('afterend', btn);
      btn.addEventListener('click', openVoiceAdminModal);
    }

    if (!document.getElementById('voiceAdminModal')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <div id="voiceAdminModal" class="modal hidden">
          <div class="modal-content voice-admin-modal">
            <div class="modal-header">
              <h3>Голос и расшифровка</h3>
              <button type="button" class="modal-close" id="voiceAdminClose">×</button>
            </div>
            <div class="modal-body">
              <div class="settings-item settings-toggle-item">
                <span>Включить голосовые сообщения</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="voiceEnabledToggle">
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="settings-item settings-toggle-item">
                <span>Расшифровывать сразу после записи</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="voiceAutoTranscribeToggle">
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="settings-item settings-toggle-item">
                <span>Fallback на OpenAI</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="voiceFallbackToggle">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="field-group">
                <label>Интерфейс голосовых сообщений</label>
                <select id="voiceNoteUiMode" class="modal-input"></select>
              </div>

              <div class="field-group">
                <label>Активный провайдер</label>
                <select id="voiceActiveProvider" class="modal-input"></select>
                <div id="voiceProviderHint" class="voice-form-hint">Выберите провайдер. Модель для него появится в блоке ниже.</div>
              </div>

              <div class="field-grid">
                <div class="field-group">
                  <label>Минимальная длина записи, мс</label>
                  <input type="number" id="voiceMinRecordMs" class="modal-input" min="300" max="10000">
                </div>
                <div class="field-group">
                  <label>Максимальная длина записи, мс</label>
                  <input type="number" id="voiceMaxRecordMs" class="modal-input" min="5000" max="600000">
                </div>
                <div class="field-group">
                  <label>Таймаут расшифровки, мс</label>
                  <input type="number" id="voiceTimeoutMs" class="modal-input" min="5000" max="300000">
                </div>
                <div class="field-group">
                  <label>Concurrency очереди</label>
                  <input type="number" id="voiceQueueConcurrency" class="modal-input" min="1" max="4">
                </div>
              </div>

              <div id="voiceProviderVosk" class="voice-provider-panel">
                <div class="field-group">
                  <label>Vosk helper URL</label>
                  <input type="text" id="voiceVoskHelperUrl" class="modal-input" placeholder="http://127.0.0.1:2700">
                </div>
                <div class="field-group">
                  <label>Модель Vosk</label>
                  <select id="voiceVoskModel" class="modal-input"></select>
                </div>
                <div class="field-group">
                  <label>Путь к модели Vosk (необязательно)</label>
                  <input type="text" id="voiceVoskModelPath" class="modal-input">
                </div>
              </div>

              <div id="voiceProviderOpenAI" class="voice-provider-panel">
                <div class="field-group">
                  <label>Модель OpenAI</label>
                  <select id="voiceOpenAIModel" class="modal-input"></select>
                </div>
                <div class="field-group">
                  <label>Язык</label>
                  <input type="text" id="voiceOpenAILanguage" class="modal-input" placeholder="ru">
                </div>
                <div class="field-group">
                  <label>API-ключ OpenAI</label>
                  <input type="password" id="voiceOpenAIKey" class="modal-input" placeholder="Введите новый ключ">
                  <div id="voiceOpenAIKeyState" class="voice-key-state"></div>
                </div>
                <div class="voice-inline-actions">
                  <button type="button" id="voiceReplaceKeyBtn" class="btn-sm voice-inline-btn">Заменить ключ</button>
                  <button type="button" id="voiceDeleteKeyBtn" class="btn-text voice-inline-danger">Удалить ключ</button>
                </div>
              </div>

              <div id="voiceProviderGrok" class="voice-provider-panel">
                <div class="field-group">
                  <label>Модель Grok</label>
                  <select id="voiceGrokModel" class="modal-input"></select>
                </div>
                <div class="field-group">
                  <label>Язык</label>
                  <input type="text" id="voiceGrokLanguage" class="modal-input" placeholder="ru">
                </div>
                <div class="field-group">
                  <label>API-ключ Grok</label>
                  <input type="password" id="voiceGrokKey" class="modal-input" placeholder="Введите новый ключ">
                  <div id="voiceGrokKeyState" class="voice-key-state"></div>
                </div>
                <div class="voice-inline-actions">
                  <button type="button" id="voiceReplaceGrokKeyBtn" class="btn-sm voice-inline-btn">Заменить ключ</button>
                  <button type="button" id="voiceDeleteGrokKeyBtn" class="btn-text voice-inline-danger">Удалить ключ</button>
                </div>
              </div>

              <div class="voice-inline-actions voice-admin-actions">
                <div id="voiceSelectedModelMeta" class="voice-selected-model-meta"></div>
                <button type="button" id="voiceTestModelBtn" class="btn-sm voice-inline-btn">Проверить модель</button>
                <button type="button" id="voiceSaveSettingsBtn" class="btn-primary">Сохранить</button>
              </div>

              <div id="voiceAdminStatus" class="voice-admin-status hidden"></div>
              <div id="voiceLastTest" class="voice-last-test hidden"></div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(wrapper.firstElementChild);
    }

    getBridge()?.registerManagedModal?.('voiceAdminModal');

    if (!document.getElementById('voiceRecorderBar')) {
      const inputArea = document.querySelector('.input-area');
      const pendingFile = document.getElementById('pendingFile');
      if (inputArea && pendingFile) {
        const bar = document.createElement('div');
        bar.id = 'voiceRecorderBar';
        bar.className = 'voice-recorder-bar hidden';
        bar.innerHTML = `
          <div class="voice-recorder-dot"></div>
          <div class="voice-recorder-text">Запись...</div>
          <div class="voice-recorder-time">0:00</div>
        `;
        inputArea.insertBefore(bar, pendingFile);
      }
    }

    bindVoiceUiEvents();
    state.uiReady = true;
  }

  function bindVoiceUiEvents() {
    const modal = document.getElementById('voiceAdminModal');
    if (!modal || modal.dataset.bound === '1') return;
    modal.dataset.bound = '1';

    document.getElementById('voiceAdminClose')?.addEventListener('click', hideVoiceAdminModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) hideVoiceAdminModal();
    });

    document.getElementById('voiceActiveProvider')?.addEventListener('change', syncProviderPanels);
    document.getElementById('voiceVoskModel')?.addEventListener('change', syncProviderPanels);
    document.getElementById('voiceOpenAIModel')?.addEventListener('change', syncProviderPanels);
    document.getElementById('voiceGrokModel')?.addEventListener('change', syncProviderPanels);
    document.getElementById('voiceReplaceKeyBtn')?.addEventListener('click', () => {
      const input = document.getElementById('voiceOpenAIKey');
      if (!input) return;
      input.value = '';
      input.focus();
    });
    document.getElementById('voiceReplaceGrokKeyBtn')?.addEventListener('click', () => {
      const input = document.getElementById('voiceGrokKey');
      if (!input) return;
      input.value = '';
      input.focus();
    });
    bindAsyncActionButtons('voiceDeleteKeyBtn', null, 'Deleting...', deleteOpenAIKey);
    bindAsyncActionButtons('voiceDeleteGrokKeyBtn', null, 'Deleting...', deleteGrokKey);
    bindAsyncActionButtons('voiceSaveSettingsBtn', null, 'Saving...', saveVoiceSettings);
    bindAsyncActionButtons('voiceTestModelBtn', null, 'Testing...', testCurrentModel);
  }

  async function refreshPublicFeatures() {
    if (!getBridge()) return;
    try {
      const data = await getBridge().api('/api/features');
      state.features = {
        voice_notes_enabled: Boolean(data.voice_notes_enabled),
        auto_transcribe_on_send: Boolean(data.auto_transcribe_on_send),
        voice_note_ui_mode: data.voice_note_ui_mode || 'compact',
      };
    } catch {}
    syncSendButtonState();
    refreshVisibleVoiceRows();
  }

  function syncSendButtonState() {
    const bridge = getBridge();
    const { sendBtn, msgInput } = getDom();
    if (!sendBtn || !bridge) return;
    const hasText = Boolean(msgInput?.value.trim());
    const hasPendingFiles = Boolean(bridge.getPendingFiles?.().length);
    const hasChat = Boolean(bridge.getCurrentChatId?.());
    const isEditing = Boolean(bridge.getEditTo?.());
    const keepSendIcon = sendBtn.classList.contains('send-fly');
    const showMicMode = Boolean(
      state.features.voice_notes_enabled &&
      hasChat &&
      !hasText &&
      !hasPendingFiles &&
      !isEditing &&
      !state.recorder.uploading &&
      !keepSendIcon
    );
    const keepMicMode = showMicMode || Boolean(state.recorder.recording);
    sendBtn.classList.toggle('voice-enabled', Boolean(state.features.voice_notes_enabled));
    sendBtn.classList.toggle('is-mic-mode', keepMicMode);
    sendBtn.classList.toggle('is-send-mode', !keepMicMode && !state.recorder.recording);
    sendBtn.classList.toggle('is-recording', Boolean(state.recorder.recording));
    sendBtn.classList.toggle('is-uploading', Boolean(state.recorder.uploading));
    sendBtn.title = state.recorder.recording
      ? 'Идет запись'
      : state.recorder.uploading
        ? 'Отправка голосового сообщения'
        : isEditing
          ? 'Сохранить'
          : showMicMode
            ? 'Удерживайте для записи'
            : 'Отправить';
    window.BananzaMediaNoteHooks?.refreshComposerState?.({
      showMicMode: keepMicMode,
      isEditing,
      isRecording: Boolean(state.recorder.recording),
      isUploading: Boolean(state.recorder.uploading),
      features: { ...state.features },
    });
  }

  async function ensureRecorderWorklet(audioContext) {
    if (!audioContext?.audioWorklet?.addModule) return false;
    try {
      await audioContext.audioWorklet.addModule('/js/voice-recorder-worklet.js');
      return true;
    } catch {
      return false;
    }
  }

  async function createRecorderGraph(audioContext, stream, chunks) {
    const source = audioContext.createMediaStreamSource(stream);

    if (await ensureRecorderWorklet(audioContext)) {
      const processor = new AudioWorkletNode(audioContext, 'bananza-voice-recorder', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: 'explicit',
      });
      const sink = audioContext.createGain();
      sink.gain.value = 0;
      processor.port.onmessage = (event) => {
        if (!state.recorder.recording) return;
        const channelData = event.data;
        if (!channelData?.length) return;
        chunks.push(channelData instanceof Float32Array ? channelData : new Float32Array(channelData));
      };
      source.connect(processor);
      processor.connect(sink);
      sink.connect(audioContext.destination);
      return { source, processor, sink };
    }

    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (audioEvent) => {
      if (!state.recorder.recording) return;
      chunks.push(new Float32Array(audioEvent.inputBuffer.getChannelData(0)));
    };
    source.connect(processor);
    processor.connect(audioContext.destination);
    return { source, processor, sink: null };
  }

  function syncAdminEntryVisibility() {
    const btn = document.getElementById('settingsVoicePanel');
    if (!btn) return;
    btn.classList.toggle('hidden', !isAdmin());
  }

  async function openVoiceAdminModal() {
    if (!isAdmin()) return;
    ensureVoiceUi();
    if (getBridge()?.openManagedModal) getBridge().openManagedModal('voiceAdminModal');
    else document.getElementById('voiceAdminModal')?.classList.remove('hidden');
    await loadAdminSettings();
  }

  function hideVoiceAdminModal(options = {}) {
    if (getBridge()?.closeManagedModal) {
      getBridge().closeManagedModal('voiceAdminModal', options);
      return;
    }
    document.getElementById('voiceAdminModal')?.classList.add('hidden');
  }

  function setAdminStatus(message, kind) {
    const el = document.getElementById('voiceAdminStatus');
    if (!el) return;
    if (!message) {
      el.className = 'voice-admin-status hidden';
      el.textContent = '';
      return;
    }
    el.className = `voice-admin-status ${kind || ''}`;
    el.textContent = message;
  }

  function resolveActionButtons(targetIds) {
    const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
    return ids
      .map((targetId) => (typeof targetId === 'string' ? document.getElementById(targetId) : targetId))
      .filter(Boolean);
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
        if (pendingLabel) btn.textContent = pendingLabel;
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
          console.error('Voice admin action failed', error);
        });
      });
    });
  }

  async function loadAdminSettings() {
    if (state.admin.loading) return;
    state.admin.loading = true;
    setAdminStatus('Загрузка настроек...', 'pending');
    try {
      const data = await getBridge().api('/api/admin/voice-settings');
      state.admin.settings = data.settings;
      state.admin.options = data.options;
      fillAdminForm();
      renderLastTest();
      setAdminStatus('', '');
    } catch (error) {
      setAdminStatus(error.message || 'Не удалось загрузить настройки', 'error');
    } finally {
      state.admin.loading = false;
    }
  }

  function fillSelect(selectId, items, selectedValue, emptyLabel = 'Нет доступных вариантов') {
    const select = document.getElementById(selectId);
    if (!select) return;
    const normalizedItems = Array.isArray(items) ? items : [];
    if (!normalizedItems.length) {
      select.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>`;
      select.value = '';
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML = normalizedItems
      .map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
      .join('');
    select.value = selectedValue || (normalizedItems[0] ? normalizedItems[0].value : '');
  }

  function fillAdminForm() {
    const settings = state.admin.settings;
    const options = state.admin.options;
    if (!settings || !options) return;

    document.getElementById('voiceEnabledToggle').checked = Boolean(settings.voice_notes_enabled);
    document.getElementById('voiceAutoTranscribeToggle').checked = Boolean(settings.auto_transcribe_on_send);
    document.getElementById('voiceFallbackToggle').checked = Boolean(settings.fallback_to_openai);
    fillSelect('voiceNoteUiMode', options.ui_modes || [
      { value: 'compact', label: 'Compact' },
      { value: 'full', label: 'Full' },
    ], settings.voice_note_ui_mode || 'compact');
    document.getElementById('voiceMinRecordMs').value = settings.min_record_ms;
    document.getElementById('voiceMaxRecordMs').value = settings.max_record_ms;
    document.getElementById('voiceTimeoutMs').value = settings.transcription_timeout_ms;
    document.getElementById('voiceQueueConcurrency').value = settings.queue_concurrency;

    fillSelect('voiceActiveProvider', options.providers, settings.active_provider);
    fillSelect('voiceVoskModel', options.models?.vosk || [], settings.vosk_model);
    fillSelect('voiceOpenAIModel', options.models?.openai || [], settings.openai_model);
    fillSelect('voiceGrokModel', options.models?.grok || [], 'speech-to-text');

    document.getElementById('voiceVoskHelperUrl').value = settings.vosk_helper_url || '';
    document.getElementById('voiceVoskModelPath').value = settings.vosk_model_path || '';
    document.getElementById('voiceOpenAILanguage').value = settings.openai_language || 'ru';
    document.getElementById('voiceOpenAIKey').value = '';
    document.getElementById('voiceOpenAIKey').placeholder = settings.masked_openai_key
      ? `Сохранён ключ ${settings.masked_openai_key}`
      : 'Введите новый ключ';
    document.getElementById('voiceOpenAIKeyState').textContent = settings.has_openai_key
      ? `Ключ сохранён: ${settings.masked_openai_key}`
      : 'Ключ не сохранён';
    document.getElementById('voiceDeleteKeyBtn').classList.toggle('hidden', !settings.has_openai_key);
    document.getElementById('voiceGrokLanguage').value = settings.grok_language || 'ru';
    document.getElementById('voiceGrokKey').value = '';
    document.getElementById('voiceGrokKey').placeholder = settings.masked_grok_key
      ? `Сохранён ключ ${settings.masked_grok_key}`
      : 'Введите новый ключ';
    document.getElementById('voiceGrokKeyState').textContent = settings.has_grok_key
      ? `Ключ сохранён: ${settings.masked_grok_key}`
      : 'Ключ не сохранён';
    document.getElementById('voiceDeleteGrokKeyBtn').classList.toggle('hidden', !settings.has_grok_key);
    syncProviderPanels();
  }

  function syncProviderPanels() {
    const provider = document.getElementById('voiceActiveProvider')?.value || 'vosk';
    const providerHint = document.getElementById('voiceProviderHint');
    const selectedMeta = document.getElementById('voiceSelectedModelMeta');
    const testBtn = document.getElementById('voiceTestModelBtn');
    const selectedModel = provider === 'openai'
      ? (document.getElementById('voiceOpenAIModel')?.value || 'не выбрана')
      : provider === 'grok'
        ? (document.getElementById('voiceGrokModel')?.value || 'speech-to-text')
        : (document.getElementById('voiceVoskModel')?.value || 'не выбрана');

    document.getElementById('voiceProviderVosk')?.classList.toggle('hidden', provider !== 'vosk');
    document.getElementById('voiceProviderOpenAI')?.classList.toggle('hidden', provider !== 'openai');
    document.getElementById('voiceProviderGrok')?.classList.toggle('hidden', provider !== 'grok');
    if (providerHint) {
      providerHint.textContent = provider === 'openai'
        ? 'Выберите модель OpenAI ниже. Для проверки нужен сохранённый API-ключ.'
        : provider === 'grok'
          ? 'Выберите профиль Grok STT ниже. Для проверки нужен сохранённый API-ключ Grok.'
          : 'Выберите модель Vosk ниже и затем нажмите «Проверить модель».';
    }
    if (selectedMeta) {
      selectedMeta.textContent = `Сейчас выбрано: ${
        provider === 'openai' ? 'OpenAI' : (provider === 'grok' ? 'Grok' : 'Vosk')
      } / ${selectedModel}`;
    }
    if (testBtn) {
      testBtn.title = `Проверить ${
        provider === 'openai' ? 'OpenAI' : (provider === 'grok' ? 'Grok' : 'Vosk')
      }: ${selectedModel}`;
    }
  }

  function serializeAdminForm() {
    return {
      voice_notes_enabled: document.getElementById('voiceEnabledToggle')?.checked || false,
      auto_transcribe_on_send: document.getElementById('voiceAutoTranscribeToggle')?.checked || false,
      fallback_to_openai: document.getElementById('voiceFallbackToggle')?.checked || false,
      voice_note_ui_mode: document.getElementById('voiceNoteUiMode')?.value || 'compact',
      active_provider: document.getElementById('voiceActiveProvider')?.value || 'vosk',
      min_record_ms: Number(document.getElementById('voiceMinRecordMs')?.value || 500),
      max_record_ms: Number(document.getElementById('voiceMaxRecordMs')?.value || 120000),
      transcription_timeout_ms: Number(document.getElementById('voiceTimeoutMs')?.value || 60000),
      queue_concurrency: Number(document.getElementById('voiceQueueConcurrency')?.value || 1),
      vosk_helper_url: document.getElementById('voiceVoskHelperUrl')?.value || '',
      vosk_model: document.getElementById('voiceVoskModel')?.value || '',
      vosk_model_path: document.getElementById('voiceVoskModelPath')?.value || '',
      openai_model: document.getElementById('voiceOpenAIModel')?.value || '',
      openai_language: document.getElementById('voiceOpenAILanguage')?.value || 'ru',
      openai_api_key: document.getElementById('voiceOpenAIKey')?.value || '',
      grok_language: document.getElementById('voiceGrokLanguage')?.value || 'ru',
      grok_api_key: document.getElementById('voiceGrokKey')?.value || '',
    };
  }

  async function saveVoiceSettings() {
    setAdminStatus('Сохранение настроек...', 'pending');
    try {
      const data = await getBridge().api('/api/admin/voice-settings', {
        method: 'PUT',
        body: serializeAdminForm(),
      });
      state.admin.settings = data.settings;
      state.admin.options = data.options;
      state.features = data.publicSettings || state.features;
      fillAdminForm();
      renderLastTest();
      syncSendButtonState();
      refreshVisibleVoiceRows();
      setAdminStatus('Настройки сохранены', 'success');
    } catch (error) {
      setAdminStatus(error.message || 'Не удалось сохранить настройки', 'error');
    }
  }

  async function deleteOpenAIKey() {
    if (!confirm('Удалить сохранённый OpenAI API-ключ?')) return;
    setAdminStatus('Удаление ключа...', 'pending');
    try {
      const data = await getBridge().api('/api/admin/voice-settings/openai-key', {
        method: 'DELETE',
      });
      state.admin.settings = data.settings;
      state.admin.options = data.options;
      fillAdminForm();
      setAdminStatus('Ключ удалён', 'success');
    } catch (error) {
      setAdminStatus(error.message || 'Не удалось удалить ключ', 'error');
    }
  }

  async function deleteGrokKey() {
    if (!confirm('Удалить сохранённый Grok API-ключ?')) return;
    setAdminStatus('Удаление ключа...', 'pending');
    try {
      const data = await getBridge().api('/api/admin/voice-settings/grok-key', {
        method: 'DELETE',
      });
      state.admin.settings = data.settings;
      state.admin.options = data.options;
      fillAdminForm();
      setAdminStatus('Ключ удалён', 'success');
    } catch (error) {
      setAdminStatus(error.message || 'Не удалось удалить ключ', 'error');
    }
  }

  async function testCurrentModel() {
    setAdminStatus('Проверка модели...', 'pending');
    try {
      const data = await getBridge().api('/api/admin/voice-settings/test-model', {
        method: 'POST',
        body: serializeAdminForm(),
      });
      state.admin.settings = data.settings || state.admin.settings;
      fillAdminForm();
      renderLastTest(data.result);
      setAdminStatus(
        data.ok === false ? (data.error || 'Проверка модели завершилась ошибкой') : 'Проверка модели прошла успешно',
        data.ok === false ? 'error' : 'success'
      );
    } catch (error) {
      setAdminStatus(error.message || 'Проверка модели завершилась ошибкой', 'error');
    }
  }

  function renderLastTest(overrideResult) {
    const el = document.getElementById('voiceLastTest');
    const settings = state.admin.settings;
    if (!el || !settings) return;

    const result = overrideResult || (
      settings.last_model_test_at ? {
        status: settings.last_model_test_status,
        provider: settings.last_model_test_provider,
        model: settings.last_model_test_model,
        latencyMs: settings.last_model_test_latency_ms,
        testedAt: settings.last_model_test_at,
        text: settings.last_model_test_excerpt,
        error: settings.last_model_test_error,
      } : null
    );

    if (!result) {
      el.className = 'voice-last-test hidden';
      el.innerHTML = '';
      return;
    }

    const testedAt = result.testedAt ? new Date(result.testedAt).toLocaleString() : '—';
    const bodyText = result.status === 'success'
      ? escapeHtml(result.text || '—')
      : escapeHtml(result.error || 'Ошибка');
    el.className = `voice-last-test ${result.status === 'success' ? 'success' : 'error'}`;
    el.innerHTML = `
      <div class="voice-last-test-title">Последняя проверка модели</div>
      <div><strong>Статус:</strong> ${result.status === 'success' ? 'успешно' : 'ошибка'}</div>
      <div><strong>Провайдер:</strong> ${escapeHtml(result.provider || '—')}</div>
      <div><strong>Модель:</strong> ${escapeHtml(result.model || '—')}</div>
      <div><strong>Время ответа:</strong> ${result.latencyMs != null ? `${result.latencyMs} мс` : '—'}</div>
      <div><strong>Проверено:</strong> ${escapeHtml(testedAt)}</div>
      <div class="voice-last-test-body">${bodyText}</div>
    `;
  }

  function handleWSMessage(msg) {
    if (msg.type === 'voice_settings_updated') {
      state.features = {
        voice_notes_enabled: Boolean(msg.settings?.voice_notes_enabled),
        auto_transcribe_on_send: Boolean(msg.settings?.auto_transcribe_on_send),
        voice_note_ui_mode: msg.settings?.voice_note_ui_mode || 'compact',
      };
      syncSendButtonState();
      refreshVisibleVoiceRows();
      return;
    }

    if (msg.type === 'message_transcription') {
      applyTranscriptionUpdate(msg);
    }
  }

  function decorateMessageRow(row, msg) {
    if (!row || !msg) return;
    row.__voiceMessage = {
      ...(row.__voiceMessage || {}),
      id: msg.id,
      is_voice_note: Boolean(msg.is_voice_note),
      voice_duration_ms: msg.voice_duration_ms,
      transcription_status: msg.transcription_status || 'idle',
      transcription_text: msg.transcription_text || '',
      transcription_provider: msg.transcription_provider || '',
      transcription_model: msg.transcription_model || '',
      transcription_error: msg.transcription_error || '',
    };
    renderVoiceRow(row, row.__voiceMessage);
  }

  function refreshVisibleVoiceRows() {
    const { messagesEl } = getDom();
    if (!messagesEl) return;
    messagesEl.querySelectorAll('.msg-row').forEach((row) => {
      if (!row.__voiceMessage && row.__voiceBootstrap?.is_voice_note) {
        row.__voiceMessage = { ...row.__voiceBootstrap };
      }
      if (row.__voiceMessage?.is_voice_note) {
        renderVoiceRow(row, row.__voiceMessage);
      }
    });
  }

  function ensureVoiceAudioSnapshot(audioWrap) {
    if (!audioWrap.dataset.originalHtml) {
      audioWrap.dataset.originalHtml = audioWrap.innerHTML;
    }
    const titleEl = audioWrap.querySelector('div');
    if (titleEl && !audioWrap.dataset.originalTitle) {
      audioWrap.dataset.originalTitle = titleEl.textContent || '';
    }
    const sourceEl = audioWrap.querySelector('audio source');
    const audioEl = audioWrap.querySelector('audio');
    if (!audioWrap.dataset.voiceSrc) {
      audioWrap.dataset.voiceSrc = sourceEl?.src || audioEl?.src || '';
    }
    if (!audioWrap.dataset.voiceMime) {
      audioWrap.dataset.voiceMime = sourceEl?.type || '';
    }
  }

  function stopActiveCompactPlayback(exceptAudio = null) {
    const activeAudio = state.playback.activeAudio;
    if (!activeAudio || activeAudio === exceptAudio) return;
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {}
    if (state.playback.activeButton) {
      syncCompactPlayButton(state.playback.activeButton, false);
    }
    state.playback.activeAudio = null;
    state.playback.activeButton = null;
  }

  function syncCompactPlayButton(button, isPlaying) {
    if (!button) return;
    button.textContent = isPlaying ? '❚❚' : '▶';
    button.classList.toggle('is-playing', isPlaying);
    button.setAttribute('aria-label', isPlaying ? 'Pause voice note' : 'Play voice note');
  }

  function bindCompactVoicePlayer(audioWrap, button) {
    const audioEl = audioWrap.querySelector('.voice-compact-audio');
    if (!audioEl || !button || audioEl.dataset.bound === '1') return;

    audioEl.dataset.bound = '1';
    syncCompactPlayButton(button, false);

    button.addEventListener('click', () => {
      if (audioEl.paused) {
        stopActiveCompactPlayback(audioEl);
        audioEl.play().catch(() => {
          syncCompactPlayButton(button, false);
        });
        return;
      }
      audioEl.pause();
    });

    audioEl.addEventListener('play', () => {
      if (state.playback.activeAudio && state.playback.activeAudio !== audioEl) {
        stopActiveCompactPlayback(audioEl);
      }
      state.playback.activeAudio = audioEl;
      state.playback.activeButton = button;
      syncCompactPlayButton(button, true);
    });

    audioEl.addEventListener('pause', () => {
      if (state.playback.activeAudio === audioEl) {
        state.playback.activeAudio = null;
        state.playback.activeButton = null;
      }
      syncCompactPlayButton(button, false);
    });

    audioEl.addEventListener('ended', () => {
      if (state.playback.activeAudio === audioEl) {
        state.playback.activeAudio = null;
        state.playback.activeButton = null;
      }
      audioEl.currentTime = 0;
      syncCompactPlayButton(button, false);
    });
  }

  function restoreVoiceAudioMarkup(audioWrap) {
    ensureVoiceAudioSnapshot(audioWrap);
    if (state.playback.activeAudio && audioWrap.contains(state.playback.activeAudio)) {
      stopActiveCompactPlayback();
    }
    if (audioWrap.dataset.renderMode !== 'full' && audioWrap.dataset.originalHtml) {
      audioWrap.innerHTML = audioWrap.dataset.originalHtml;
    }
    audioWrap.dataset.renderMode = 'full';
  }

  function renderCompactVoiceAudio(audioWrap) {
    ensureVoiceAudioSnapshot(audioWrap);
    if (state.playback.activeAudio && audioWrap.contains(state.playback.activeAudio)) {
      stopActiveCompactPlayback();
    }

    if (audioWrap.dataset.renderMode !== 'compact') {
      const src = audioWrap.dataset.voiceSrc || '';
      const mime = audioWrap.dataset.voiceMime || 'audio/wav';
      audioWrap.innerHTML = `
        <audio class="voice-compact-audio" preload="none">
          <source src="${escapeHtml(src)}" type="${escapeHtml(mime)}">
        </audio>
      `;
      audioWrap.dataset.renderMode = 'compact';
    }
  }

  function ensureCompactFooterButton(bubble) {
    const footer = bubble.querySelector('.msg-footer');
    if (!footer) return null;

    let button = footer.querySelector('.voice-footer-play');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'voice-footer-play';
      button.setAttribute('aria-label', 'Play voice note');
      footer.insertBefore(button, footer.firstChild);
    }
    return button;
  }

  function removeCompactFooterButton(bubble) {
    const button = bubble?.querySelector('.voice-footer-play');
    if (!button) return;
    if (state.playback.activeButton === button) {
      stopActiveCompactPlayback();
    }
    button.remove();
  }

  function ensureVoicePanel(bubble) {
    let panel = bubble.querySelector('.voice-transcription');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'voice-transcription';
      const footer = bubble.querySelector('.msg-footer');
      if (footer) bubble.insertBefore(panel, footer);
      else bubble.appendChild(panel);
    }
    return panel;
  }

  function renderFullVoicePanel(panel, message, row) {
    const status = message.transcription_status || 'idle';
    if (status === 'pending') {
      panel.innerHTML = '<div class="voice-transcription-status pending">Расшифровка...</div>';
      return;
    }

    if (status === 'completed' && message.transcription_text) {
      panel.innerHTML = `
        <div class="voice-transcription-block">
          <div class="voice-transcription-label">Текст</div>
          <div class="voice-transcription-text">${escapeHtml(message.transcription_text)}</div>
        </div>
      `;
      return;
    }

    if (status === 'error') {
      panel.innerHTML = `
        <div class="voice-transcription-block error">
          <div class="voice-transcription-label">Ошибка расшифровки</div>
          <div class="voice-transcription-text">${escapeHtml(message.transcription_error || 'Не удалось получить текст')}</div>
          <button type="button" class="voice-transcribe-btn retry">Повторить</button>
        </div>
      `;
      return;
    }

    panel.innerHTML = '<button type="button" class="voice-transcribe-btn">В текст</button>';
  }

  function renderCompactVoicePanel(panel, message, row) {
    const status = message.transcription_status || 'idle';
    if (status === 'pending') {
      panel.innerHTML = '<div class="voice-transcription-inline pending">Расшифровка...</div>';
      return;
    }

    if (status === 'completed' && message.transcription_text) {
      panel.innerHTML = `
        <div class="voice-transcription-compact-text">${escapeHtml(message.transcription_text)}</div>
      `;
      return;
    }

    if (status === 'error') {
      panel.innerHTML = `
        <div class="voice-transcription-inline error">
          <span class="voice-transcription-inline-text">${escapeHtml(message.transcription_error || 'Ошибка расшифровки')}</span>
          <button type="button" class="voice-transcribe-btn compact retry">Повторить</button>
        </div>
      `;
      return;
    }

    panel.innerHTML = '<button type="button" class="voice-transcribe-btn compact">В текст</button>';
  }

  function renderVoiceRow(row, message) {
    if (!row || !message?.is_voice_note) return;
    const bubble = row.querySelector('.msg-bubble');
    const audioWrap = row.querySelector('.msg-audio');
    if (!bubble || !audioWrap) return;

    ensureVoiceAudioSnapshot(audioWrap);
    let panel = bubble.querySelector('.voice-transcription');

    if (!state.features.voice_notes_enabled) {
      row.classList.remove('voice-note-row', 'voice-note-compact', 'voice-note-full');
      restoreVoiceAudioMarkup(audioWrap);
      getBridge()?.bindMediaPlayback?.(audioWrap.querySelector('audio'), row.__messageData || message, 'voice-note-audio');
      removeCompactFooterButton(bubble);
      const titleEl = audioWrap.querySelector('div');
      if (titleEl && audioWrap.dataset.originalTitle) {
        titleEl.textContent = audioWrap.dataset.originalTitle;
        titleEl.classList.remove('voice-note-title');
      }
      if (panel) panel.remove();
      return;
    }

    const isCompactMode = (state.features.voice_note_ui_mode || 'compact') === 'compact';
    row.classList.add('voice-note-row');
    row.classList.toggle('voice-note-compact', isCompactMode);
    row.classList.toggle('voice-note-full', !isCompactMode);

    panel = ensureVoicePanel(bubble);

    if (isCompactMode) {
      renderCompactVoiceAudio(audioWrap);
      getBridge()?.bindMediaPlayback?.(audioWrap.querySelector('.voice-compact-audio'), row.__messageData || message, 'voice-note-audio');
      const button = ensureCompactFooterButton(bubble);
      bindCompactVoicePlayer(audioWrap, button);
      renderCompactVoicePanel(panel, message, row);
      return;
    }

    restoreVoiceAudioMarkup(audioWrap);
    getBridge()?.bindMediaPlayback?.(audioWrap.querySelector('audio'), row.__messageData || message, 'voice-note-audio');
    removeCompactFooterButton(bubble);
    const titleEl = audioWrap.querySelector('div');
    if (titleEl) {
      titleEl.textContent = `Голосовое сообщение · ${formatDurationMs(message.voice_duration_ms)}`;
      titleEl.classList.add('voice-note-title');
    }
    renderFullVoicePanel(panel, message, row);
  }

  async function requestManualTranscription(messageId, row) {
    try {
      const response = await getBridge().api(`/api/messages/${messageId}/transcribe`, {
        method: 'POST',
      });
      if (response?.status === 'completed' && response?.text) {
        applyTranscriptionUpdate({
          type: 'message_transcription',
          messageId,
          chatId: response.chatId || row?.__messageData?.chat_id || row?.__messageData?.chatId || 0,
          status: response.status,
          text: response.text,
          provider: response.provider || '',
          model: response.model || '',
          error: response.error || '',
        });
        return;
      }
      if (row?.__voiceMessage) {
        row.__voiceMessage.transcription_status = response?.status || 'pending';
        row.__voiceMessage.transcription_text = response?.text || '';
        row.__voiceMessage.transcription_provider = response?.provider || '';
        row.__voiceMessage.transcription_model = response?.model || '';
        row.__voiceMessage.transcription_error = response?.error || '';
        renderVoiceRow(row, row.__voiceMessage);
      }
      if (row?.__messageData) {
        row.__messageData.transcription_status = response?.status || 'pending';
        row.__messageData.transcription_text = response?.text || '';
        row.__messageData.transcription_provider = response?.provider || '';
        row.__messageData.transcription_model = response?.model || '';
        row.__messageData.transcription_error = response?.error || '';
      }
      const resolvedChatId = Number(
        response?.chatId || row?.__messageData?.chat_id || row?.__messageData?.chatId || getBridge()?.getCurrentChatId?.() || 0
      );
      if (resolvedChatId && window.messageCache?.patchMessage) {
        window.messageCache.patchMessage(resolvedChatId, messageId, {
          transcription_status: response?.status || 'pending',
          transcription_text: response?.text || '',
          transcription_provider: response?.provider || '',
          transcription_model: response?.model || '',
          transcription_error: response?.error || '',
        }).catch(() => {});
      }
    } catch (error) {
      if (row?.__voiceMessage) {
        row.__voiceMessage.transcription_status = 'error';
        row.__voiceMessage.transcription_error = error.message || 'Не удалось запустить расшифровку';
        renderVoiceRow(row, row.__voiceMessage);
      }
    }
  }

  function applyTranscriptionUpdate(msg) {
    const { messagesEl } = getDom();
    if (!messagesEl) return;
    if (msg.status === 'completed' && msg.text) {
      getBridge()?.updateReplyPreview?.(msg.messageId, msg.text.substring(0, 100));
      messagesEl.querySelectorAll(`.msg-reply[data-reply-id="${msg.messageId}"] .msg-reply-text`).forEach((el) => {
        el.textContent = msg.text.substring(0, 100);
      });
    }
    const row = messagesEl?.querySelector(`[data-msg-id="${msg.messageId}"]`);
    const resolvedChatId = Number(
      msg.chatId || row?.__messageData?.chat_id || row?.__messageData?.chatId || getBridge()?.getCurrentChatId?.() || 0
    );
    if (resolvedChatId && window.messageCache?.patchMessage) {
      window.messageCache.patchMessage(resolvedChatId, msg.messageId, {
        transcription_status: msg.status || 'idle',
        transcription_text: msg.text || '',
        transcription_provider: msg.provider || '',
        transcription_model: msg.model || '',
        transcription_error: msg.error || '',
      }).catch(() => {});
    }
    if (!row) return;
    row.__voiceMessage = {
      ...(row.__voiceMessage || {}),
      id: msg.messageId,
      is_voice_note: true,
      transcription_status: msg.status || 'idle',
      transcription_text: msg.text || '',
      transcription_provider: msg.provider || '',
      transcription_model: msg.model || '',
      transcription_error: msg.error || '',
    };
    if (row.__replyPayload && msg.status === 'completed' && msg.text) {
      row.__replyPayload.text = msg.text.substring(0, 100);
    }
    if (row.__messageData) {
      row.__messageData.is_voice_note = true;
      row.__messageData.transcription_status = msg.status || 'idle';
      row.__messageData.transcription_text = msg.text || '';
      row.__messageData.transcription_provider = msg.provider || '';
      row.__messageData.transcription_model = msg.model || '';
      row.__messageData.transcription_error = msg.error || '';
    }
    renderVoiceRow(row, row.__voiceMessage);
  }

  function attachRecorderEvents() {
    const { sendBtn, messagesEl } = getDom();
    if (messagesEl && messagesEl.dataset.voiceMessageBound !== '1') {
      messagesEl.dataset.voiceMessageBound = '1';
      messagesEl.addEventListener('scroll', () => {
        if (state.recorder.recording) updateRecorderBar();
      });

      messagesEl.addEventListener('click', (event) => {
        const transcribeBtn = event.target.closest('.voice-transcribe-btn');
        if (!transcribeBtn) return;
        const row = transcribeBtn.closest('.msg-row');
        const messageId = row?.__voiceMessage?.id || Number(row?.dataset.msgId || 0);
        if (!messageId) return;
        event.preventDefault();
        event.stopPropagation();
        requestManualTranscription(messageId, row);
      });
    }

    if (!sendBtn || sendBtn.dataset.voiceBound === '1' || window.BananzaMediaNoteHooks?.ownsComposer?.()) return;
    sendBtn.dataset.voiceBound = '1';

    sendBtn.addEventListener('click', (event) => {
      if (!state.recorder.suppressNextClick) return;
      state.recorder.suppressNextClick = false;
      sendBtn.blur();
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    sendBtn.addEventListener('pointerdown', handleSendPointerDown, { passive: false });
    sendBtn.addEventListener('pointerup', handleSendPointerUp, { passive: false });
    sendBtn.addEventListener('pointercancel', cancelPendingHold, { passive: false });
    sendBtn.addEventListener('pointerleave', () => {
      if (!state.recorder.recording) cancelPendingHold();
    });
  }

  function canUseVoiceGesture() {
    const bridge = getBridge();
    const { msgInput } = getDom();
    return Boolean(
      bridge &&
      state.features.voice_notes_enabled &&
      bridge.getCurrentChatId?.() &&
      msgInput &&
      !msgInput.value.trim() &&
      bridge.getPendingFiles?.().length === 0 &&
      !bridge.getEditTo?.() &&
      !state.recorder.recording &&
      !state.recorder.uploading
    );
  }

  function isIosGesturePreparationTarget() {
    return Boolean(getBridge()?.isIosWebkit?.() && window.innerWidth <= 768);
  }

  async function ensureRecorderResources() {
    if (state.recorder.preparePromise) {
      await state.recorder.preparePromise;
    }
    if (
      state.recorder.stream
      && state.recorder.audioContext
      && state.recorder.source
      && state.recorder.processor
    ) {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Микрофон не поддерживается браузером');
    }
    const preparePromise = (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('AudioContext недоступен');
      }

      let audioContext = null;
      try {
        audioContext = new AudioContextClass();
        await audioContext.resume();
        const chunks = [];
        const { source, processor, sink } = await createRecorderGraph(audioContext, stream, chunks);
        state.recorder.stream = stream;
        state.recorder.audioContext = audioContext;
        state.recorder.source = source;
        state.recorder.processor = processor;
        state.recorder.sink = sink;
        state.recorder.chunks = chunks;
        state.recorder.sampleRate = audioContext.sampleRate || 16000;
      } catch (error) {
        try { stream.getTracks().forEach((track) => track.stop()); } catch {}
        try { audioContext?.close?.().catch(() => {}); } catch {}
        state.recorder.processor = null;
        state.recorder.sink = null;
        state.recorder.source = null;
        state.recorder.stream = null;
        state.recorder.audioContext = null;
        state.recorder.chunks = [];
        throw error;
      }
    })();

    state.recorder.preparePromise = preparePromise;
    try {
      await preparePromise;
    } finally {
      if (state.recorder.preparePromise === preparePromise) {
        state.recorder.preparePromise = null;
      }
    }
  }

  async function prepareRecording() {
    if (!isIosGesturePreparationTarget() || state.recorder.recording) return;
    await ensureRecorderResources();
    state.recorder.prepared = true;
  }

  async function cancelPreparedRecording() {
    if (state.recorder.recording) return;
    if (state.recorder.preparePromise) {
      try {
        await state.recorder.preparePromise;
      } catch {
        return;
      }
    }
    if (!state.recorder.prepared && !state.recorder.stream && !state.recorder.audioContext) return;
    cleanupRecorderGraph({ clearChunks: true });
  }

  function handleSendPointerDown(event) {
    if (typeof event.button === 'number' && event.button !== 0) return;
    event.currentTarget?.blur?.();
    if (!canUseVoiceGesture()) return;
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    state.recorder.holdTimer = window.setTimeout(() => {
      state.recorder.holdTimer = null;
      state.recorder.suppressNextClick = true;
      startRecording().catch((error) => {
        setRecorderMessage(error.message || 'Не удалось начать запись', 'error');
      });
    }, state.recorder.holdDelayMs);
    event.preventDefault();
  }

  function handleSendPointerUp(event) {
    event.currentTarget?.blur?.();
    event.currentTarget?.releasePointerCapture?.(event.pointerId);
    if (state.recorder.holdTimer) {
      clearTimeout(state.recorder.holdTimer);
      state.recorder.holdTimer = null;
      return;
    }

    if (!state.recorder.recording) return;
    event.preventDefault();
    state.recorder.suppressNextClick = true;
    stopRecordingAndSend().catch((error) => {
      setRecorderMessage(error.message || 'Не удалось отправить голосовое сообщение', 'error');
    });
  }

  function cancelPendingHold() {
    if (!state.recorder.holdTimer) return;
    clearTimeout(state.recorder.holdTimer);
    state.recorder.holdTimer = null;
  }

  async function startRecording() {
    if (state.recorder.recording) return;
    await ensureRecorderResources();
    state.recorder.prepared = false;
    state.recorder.recording = true;
    state.recorder.startAt = Date.now();
    state.recorder.chunks.length = 0;
    state.recorder.timerId = window.setInterval(updateRecorderBar, 200);

    syncSendButtonState();
    setRecorderMessage('Запись...', 'recording');
    updateRecorderBar();
    safeVibrate(30);
    getBridge()?.playSound?.('voice_start');
    return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Микрофон не поддерживается браузером');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('AudioContext недоступен');
    }

    const audioContext = new AudioContextClass();
    await audioContext.resume();
    const chunks = [];
    const { source, processor, sink } = await createRecorderGraph(audioContext, stream, chunks);

    state.recorder.recording = true;
    state.recorder.startAt = Date.now();
    state.recorder.stream = stream;
    state.recorder.audioContext = audioContext;
    state.recorder.source = source;
    state.recorder.processor = processor;
    state.recorder.sink = sink;
    state.recorder.chunks = chunks;
    state.recorder.sampleRate = audioContext.sampleRate || 16000;
    state.recorder.timerId = window.setInterval(updateRecorderBar, 200);

    syncSendButtonState();
    setRecorderMessage('Запись...', 'recording');
    updateRecorderBar();
    safeVibrate(30);
    getBridge()?.playSound?.('voice_start');
  }

  async function stopRecordingAndSend() {
    if (!state.recorder.recording) return;
    const durationMs = Date.now() - state.recorder.startAt;

    cleanupRecorderGraph();
    getBridge()?.playSound?.('voice_stop');

    const minRecordMs = 0;
    const maxRecordMs = durationMs;
    if (false) {
      setRecorderMessage('Слишком короткая запись', 'error');
      return;
    }

    const safeDurationMs = durationMs;
    const wavBlob = encodeVoiceBlob(state.recorder.chunks, state.recorder.sampleRate, 16000);
    state.recorder.uploading = true;
    syncSendButtonState();
    setRecorderMessage('Отправка голосового сообщения...', 'pending');

    try {
      await getBridge().queueVoiceMessage?.({
        blob: wavBlob,
        durationMs,
        sampleRate: 16000,
        replyTo: getBridge().getReplyTo?.(),
      });
      hideRecorderBar();
    } finally {
      state.recorder.uploading = false;
      state.recorder.chunks = [];
      syncSendButtonState();
    }
  }

  async function cancelActiveRecording() {
    if (!state.recorder.recording) return;
    cleanupRecorderGraph({ clearChunks: true });
    getBridge()?.playSound?.('voice_stop');
    hideRecorderBar();
  }

  function cleanupRecorderGraph({ clearChunks = false } = {}) {
    state.recorder.recording = false;
    state.recorder.prepared = false;
    state.recorder.startAt = 0;
    if (state.recorder.timerId) {
      clearInterval(state.recorder.timerId);
      state.recorder.timerId = null;
    }
    if (state.recorder.processor?.port) {
      state.recorder.processor.port.onmessage = null;
    }
    state.recorder.processor?.disconnect();
    state.recorder.sink?.disconnect();
    state.recorder.source?.disconnect();
    state.recorder.stream?.getTracks().forEach((track) => track.stop());
    state.recorder.audioContext?.close().catch(() => {});
    state.recorder.processor = null;
    state.recorder.sink = null;
    state.recorder.source = null;
    state.recorder.stream = null;
    state.recorder.audioContext = null;
    if (clearChunks) state.recorder.chunks = [];
    syncSendButtonState();
  }

  function mergeChunks(chunks) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    chunks.forEach((chunk) => {
      result.set(chunk, offset);
      offset += chunk.length;
    });
    return result;
  }

  function downsampleBuffer(buffer, sourceSampleRate, targetSampleRate) {
    if (targetSampleRate >= sourceSampleRate) return buffer;
    const ratio = sourceSampleRate / targetSampleRate;
    const length = Math.round(buffer.length / ratio);
    const result = new Float32Array(length);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
        accum += buffer[i];
        count += 1;
      }
      result[offsetResult] = count ? accum / count : 0;
      offsetResult += 1;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  function encodeVoiceBlob(chunks, sourceSampleRate, targetSampleRate) {
    const merged = mergeChunks(chunks);
    const downsampled = downsampleBuffer(merged, sourceSampleRate, targetSampleRate);
    const buffer = new ArrayBuffer(44 + downsampled.length * 2);
    const view = new DataView(buffer);

    function writeString(offset, text) {
      for (let i = 0; i < text.length; i += 1) {
        view.setUint8(offset + i, text.charCodeAt(i));
      }
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + downsampled.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetSampleRate, true);
    view.setUint32(28, targetSampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, downsampled.length * 2, true);

    let offset = 44;
    downsampled.forEach((sample) => {
      const clipped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
      offset += 2;
    });

    return new Blob([buffer], { type: 'audio/wav' });
  }

  function updateRecorderBar() {
    const bar = document.getElementById('voiceRecorderBar');
    if (!bar) return;
    bar.classList.remove('hidden');
    bar.querySelector('.voice-recorder-time').textContent = formatDurationMs(Date.now() - state.recorder.startAt);
  }

  function setRecorderMessage(text, kind) {
    const bar = document.getElementById('voiceRecorderBar');
    if (!bar) return;
    bar.className = `voice-recorder-bar ${kind || ''}`;
    bar.classList.remove('hidden');
    bar.querySelector('.voice-recorder-text').textContent = text;
    if (kind !== 'recording') {
      bar.querySelector('.voice-recorder-dot').classList.add('hidden');
      bar.querySelector('.voice-recorder-time').textContent = '';
      if (kind !== 'pending') {
        window.setTimeout(hideRecorderBar, 1800);
      }
    } else {
      bar.querySelector('.voice-recorder-dot').classList.remove('hidden');
    }
  }

  function hideRecorderBar() {
    const bar = document.getElementById('voiceRecorderBar');
    if (!bar) return;
    bar.className = 'voice-recorder-bar hidden';
    bar.querySelector('.voice-recorder-dot').classList.remove('hidden');
    bar.querySelector('.voice-recorder-text').textContent = 'Запись...';
    bar.querySelector('.voice-recorder-time').textContent = '0:00';
  }

  function bootstrap() {
    ensureVoiceUi();
    syncAdminEntryVisibility();
    if (getBridge()?.getCurrentUser?.()) {
      ensureReady().catch(() => {});
    }
  }

  window.addEventListener('bananza:ready', () => {
    ensureReady().catch(() => {});
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
