const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  installAppBridge,
  loadBrowserScript,
} = require('../support/domHarness');
const {
  DEFAULT_VOICE_SETTINGS,
  VOICE_SETTINGS_OPTIONS,
} = require('../../voice/settings');

function waitTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test('voice admin switches to Whisper and saves its selected model', async () => {
  const dom = createAppDom();
  let savedBody = null;
  let settings = {
    ...DEFAULT_VOICE_SETTINGS,
    has_openai_key: false,
    masked_openai_key: '',
    has_grok_key: false,
    masked_grok_key: '',
  };

  installAppBridge(dom, {
    t: (key) => key,
    tx: (text) => text,
    applyLocalizedDom() {},
    async api(url, options = {}) {
      if (url === '/api/features') {
        return {
          voice_notes_enabled: true,
          auto_transcribe_on_send: false,
          voice_note_ui_mode: 'compact',
        };
      }
      if (url === '/api/admin/voice-settings' && options.method === 'PUT') {
        savedBody = options.body;
        settings = { ...settings, ...options.body };
        return {
          settings,
          options: VOICE_SETTINGS_OPTIONS,
          contextConvertBots: [],
          publicSettings: {
            voice_notes_enabled: settings.voice_notes_enabled,
            auto_transcribe_on_send: settings.auto_transcribe_on_send,
            voice_note_ui_mode: settings.voice_note_ui_mode,
          },
        };
      }
      if (url === '/api/admin/voice-settings') {
        return {
          settings,
          options: VOICE_SETTINGS_OPTIONS,
          contextConvertBots: [],
        };
      }
      return {};
    },
  });

  loadBrowserScript(dom, 'public/js/voice.js');
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await waitTick();

  dom.window.document.getElementById('settingsVoicePanel').click();
  await waitTick();
  await waitTick();

  const providerSelect = dom.window.document.getElementById('voiceActiveProvider');
  const modelSelect = dom.window.document.getElementById('voiceWhisperModel');
  assert.ok([...providerSelect.options].some((option) => option.value === 'whisper'));
  assert.deepEqual([...modelSelect.options].map((option) => option.value), [
    'ggml-tiny.bin',
    'ggml-tiny-q5_1.bin',
    'ggml-base.bin',
    'ggml-base-q5_1.bin',
  ]);

  providerSelect.value = 'whisper';
  providerSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(dom.window.document.getElementById('voiceProviderWhisper').classList.contains('hidden'), false);
  assert.equal(dom.window.document.getElementById('voiceProviderVosk').classList.contains('hidden'), true);

  modelSelect.value = 'ggml-tiny-q5_1.bin';
  dom.window.document.getElementById('voiceWhisperModelsDir').value = '/opt/bananza/voice/models';
  dom.window.document.getElementById('voiceSaveSettingsBtn').click();
  await waitTick();
  await waitTick();

  assert.equal(savedBody.active_provider, 'whisper');
  assert.equal(savedBody.whisper_model, 'ggml-tiny-q5_1.bin');
  assert.equal(savedBody.whisper_models_dir, '/opt/bananza/voice/models');
});
