(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const settingsRoot = root.settings = root.settings || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createSoundSettings(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const win = opts.window || window;
    const api = typeof opts.api === 'function' ? opts.api : async () => ({});
    const actions = objectOrDefault(opts.actions);

    let soundSettings = {
      sounds_enabled: true,
      volume: 55,
      play_send: true,
      play_incoming: true,
      play_notifications: true,
      play_reactions: true,
      play_pins: true,
      play_invites: true,
      play_voice: true,
      play_mentions: true,
    };
    let soundSettingsLoaded = false;
    let soundSettingsSaveTimer = null;

    function byId(id) {
      return doc.getElementById(id);
    }

    function setInlineStatus(targetIds, message, type = '') {
      if (typeof actions.setInlineStatus === 'function') {
        actions.setInlineStatus(targetIds, message, type);
        return;
      }
      const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
      ids.forEach((id) => {
        const el = byId(id);
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('is-error', type === 'error');
        el.classList.toggle('is-success', type === 'success');
        el.classList.toggle('is-pending', type === 'pending');
      });
    }

    function applySoundSettings(next = {}) {
      soundSettings = {
        ...soundSettings,
        ...next,
        volume: Math.min(100, Math.max(0, Math.round(Number(next.volume ?? soundSettings.volume) || 0))),
      };
      win.BananzaSounds?.configure?.(soundSettings);
      renderSoundSettingsForm();
      return soundSettings;
    }

    function setSoundStatus(message, type = '') {
      setInlineStatus('settingsSoundsStatus', message, type);
    }

    function renderSoundSettingsForm() {
      const fields = {
        settingsSoundsEnabled: soundSettings.sounds_enabled,
        settingsSoundSend: soundSettings.play_send,
        settingsSoundIncoming: soundSettings.play_incoming,
        settingsSoundNotifications: soundSettings.play_notifications,
        settingsSoundReactions: soundSettings.play_reactions,
        settingsSoundPins: soundSettings.play_pins,
        settingsSoundInvites: soundSettings.play_invites,
        settingsSoundVoice: soundSettings.play_voice,
        settingsSoundMentions: soundSettings.play_mentions,
      };
      Object.entries(fields).forEach(([id, checked]) => {
        const input = byId(id);
        if (input) input.checked = !!checked;
      });
      const volumeInput = byId('settingsSoundsVolume');
      const volumeLabel = byId('settingsSoundsVolumeValue');
      if (volumeInput) volumeInput.value = soundSettings.volume;
      if (volumeLabel) volumeLabel.textContent = `${soundSettings.volume}%`;
    }

    function getSoundSettingsFromForm() {
      return {
        sounds_enabled: byId('settingsSoundsEnabled')?.checked ?? soundSettings.sounds_enabled,
        volume: Number(byId('settingsSoundsVolume')?.value ?? soundSettings.volume),
        play_send: byId('settingsSoundSend')?.checked ?? soundSettings.play_send,
        play_incoming: byId('settingsSoundIncoming')?.checked ?? soundSettings.play_incoming,
        play_notifications: byId('settingsSoundNotifications')?.checked ?? soundSettings.play_notifications,
        play_reactions: byId('settingsSoundReactions')?.checked ?? soundSettings.play_reactions,
        play_pins: byId('settingsSoundPins')?.checked ?? soundSettings.play_pins,
        play_invites: byId('settingsSoundInvites')?.checked ?? soundSettings.play_invites,
        play_voice: byId('settingsSoundVoice')?.checked ?? soundSettings.play_voice,
        play_mentions: byId('settingsSoundMentions')?.checked ?? soundSettings.play_mentions,
      };
    }

    async function loadSoundSettings() {
      try {
        const data = await api('/api/sound-settings');
        applySoundSettings(data.settings || soundSettings);
        soundSettingsLoaded = true;
      } catch {
        soundSettingsLoaded = false;
        win.BananzaSounds?.configure?.(soundSettings);
      }
      return soundSettings;
    }

    async function saveSoundSettings(patch = {}, { silent = false } = {}) {
      win.clearTimeout(soundSettingsSaveTimer);
      const next = { ...getSoundSettingsFromForm(), ...patch };
      applySoundSettings(next);
      if (!silent) setSoundStatus('\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u044E...');
      try {
        const data = await api('/api/sound-settings', { method: 'PUT', body: next });
        applySoundSettings(data.settings || next);
        soundSettingsLoaded = true;
        if (!silent) setSoundStatus('\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E', 'success');
      } catch (e) {
        setSoundStatus(e.message || '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0437\u0432\u0443\u043A\u0438', 'error');
        renderSoundSettingsForm();
      }
      return soundSettings;
    }

    function scheduleSoundSettingsSave(patch = {}) {
      win.clearTimeout(soundSettingsSaveTimer);
      applySoundSettings({ ...getSoundSettingsFromForm(), ...patch });
      soundSettingsSaveTimer = win.setTimeout(() => {
        saveSoundSettings({}, { silent: true }).catch(() => {});
      }, 350);
    }

    function playAppSound(type, options = {}) {
      if (doc.hidden && !options.allowHidden) return false;
      return win.BananzaSounds?.play?.(type, options) || false;
    }

    function previewSound(type) {
      win.BananzaSounds?.configure?.(getSoundSettingsFromForm());
      win.BananzaSounds?.preview?.(type);
    }

    function previewAllSounds() {
      const sequence = ['send', 'incoming', 'notification', 'pin', 'mention', 'reaction', 'invite', 'voice_start', 'voice_stop'];
      sequence.forEach((type, index) => {
        if (index === 0) {
          previewSound(type);
          return;
        }
        win.setTimeout(() => previewSound(type), index * 360);
      });
    }

    function localChatPreferenceEnabled(value) {
      return value !== false && value !== 0;
    }

    function isChatIncomingSoundEnabled(chatId) {
      const chat = actions.getChatById?.(chatId);
      return Boolean(soundSettings.sounds_enabled && (!chat || localChatPreferenceEnabled(chat.sounds_enabled)));
    }

    function isPinSoundEnabled(chatId) {
      return Boolean(soundSettings.play_pins !== false && isChatIncomingSoundEnabled(chatId));
    }

    function isMentionSoundEnabled() {
      return Boolean(soundSettings.sounds_enabled && soundSettings.play_mentions !== false);
    }

    function clearSaveTimer() {
      win.clearTimeout(soundSettingsSaveTimer);
      soundSettingsSaveTimer = null;
    }

    function bindEvents() {
      [
        'settingsSoundsEnabled',
        'settingsSoundSend',
        'settingsSoundIncoming',
        'settingsSoundNotifications',
        'settingsSoundReactions',
        'settingsSoundPins',
        'settingsSoundInvites',
        'settingsSoundVoice',
        'settingsSoundMentions',
      ].forEach((id) => {
        byId(id)?.addEventListener('change', () => saveSoundSettings());
      });
      byId('settingsSoundsVolume')?.addEventListener('input', () => scheduleSoundSettingsSave());
      byId('settingsSoundsVolume')?.addEventListener('change', () => saveSoundSettings());
      byId('settingsSoundsBlock')?.addEventListener('click', (event) => {
        const previewBtn = event.target.closest('[data-sound-preview]');
        if (!previewBtn) return;
        event.preventDefault();
        event.stopPropagation();
        previewSound(previewBtn.dataset.soundPreview);
      });
      byId('settingsSoundPreviewAll')?.addEventListener('click', previewAllSounds);
    }

    return {
      applySoundSettings,
      setSoundStatus,
      renderSoundSettingsForm,
      getSoundSettingsFromForm,
      loadSoundSettings,
      saveSoundSettings,
      scheduleSoundSettingsSave,
      playAppSound,
      previewSound,
      previewAllSounds,
      isChatIncomingSoundEnabled,
      isPinSoundEnabled,
      isMentionSoundEnabled,
      bindEvents,
      clearSaveTimer,
      getSettings: () => ({ ...soundSettings }),
      isLoaded: () => soundSettingsLoaded,
    };
  }

  settingsRoot.sound = {
    createSoundSettings,
  };
})();
