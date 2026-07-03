(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const settingsRoot = root.settings = root.settings || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createSettingsModal(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const win = opts.window || window;
    const dom = objectOrDefault(opts.dom);
    const ui = objectOrDefault(opts.ui);
    const weather = objectOrDefault(opts.weather);
    const maps = objectOrDefault(opts.maps);
    const notifications = objectOrDefault(opts.notifications);
    const sound = objectOrDefault(opts.sound);
    const modals = objectOrDefault(opts.modals);
    const getCurrentUser = typeof opts.getCurrentUser === 'function' ? opts.getCurrentUser : () => null;
    const actions = objectOrDefault(opts.actions);

    function $(selector, rootEl = doc) {
      if (typeof dom.$ === 'function') return dom.$(selector, rootEl);
      return rootEl?.querySelector?.(selector) || null;
    }

    function byId(id) {
      return doc.getElementById(id);
    }

    function openModal(id, optionsForOpen = {}) {
      if (typeof modals.open === 'function') return modals.open(id, optionsForOpen);
      return actions.openModal?.(id, optionsForOpen);
    }

    function getTopModal() {
      if (typeof modals.getTop === 'function') return modals.getTop();
      return actions.getTopModal?.() || null;
    }

    function openSettingsModal(opener = byId('settingsBtn')) {
      openModal('settingsModal', { replaceStack: true, opener });
      const currentUser = getCurrentUser() || {};
      const adminItem = byId('settingsAdminPanel');
      if (currentUser.is_admin) adminItem?.classList.remove('hidden');
      else adminItem?.classList.add('hidden');
      const backupItem = byId('settingsBackupPanel');
      if (currentUser.is_admin) backupItem?.classList.remove('hidden');
      else backupItem?.classList.add('hidden');
      const mapsItem = byId('settingsMapsPanel');
      if (currentUser.is_admin) mapsItem?.classList.remove('hidden');
      else mapsItem?.classList.add('hidden');
      const aiBotsItem = byId('settingsAiBotsPanel');
      if (currentUser.is_admin) aiBotsItem?.classList.remove('hidden');
      else aiBotsItem?.classList.add('hidden');
      const yandexAiItem = byId('settingsYandexAiPanel');
      if (currentUser.is_admin) yandexAiItem?.classList.remove('hidden');
      else yandexAiItem?.classList.add('hidden');
      const deepseekAiItem = byId('settingsDeepSeekAiPanel');
      if (currentUser.is_admin) deepseekAiItem?.classList.remove('hidden');
      else deepseekAiItem?.classList.add('hidden');
      const qwenAiItem = byId('settingsQwenAiPanel');
      if (currentUser.is_admin) qwenAiItem?.classList.remove('hidden');
      else qwenAiItem?.classList.add('hidden');
      const grokAiItem = byId('settingsGrokAiPanel');
      if (currentUser.is_admin) grokAiItem?.classList.remove('hidden');
      else grokAiItem?.classList.add('hidden');
      const aiInitiativesItem = byId('settingsAiInitiativesPanel');
      if (currentUser.is_admin) aiInitiativesItem?.classList.remove('hidden');
      else aiInitiativesItem?.classList.add('hidden');
      ui.syncSimplePreferenceToggles?.();
      ui.applyScreenRotationPreference?.({ showStatus: !ui.getScreenRotationAllowed?.(), reason: 'settings-open' }).catch(() => {});
      ui.syncLanguageSettingsButton?.();
      win.BananzaVoiceHooks?.onSettingsOpened?.({ currentUser });
      win.BananzaVideoNoteAdminHooks?.onSettingsOpened?.({ currentUser });
      win.BananzaCallHooks?.onSettingsOpened?.({ currentUser });
    }

    function openLanguageSettingsModal() {
      openModal('languageSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
      ui.renderLanguagePicker?.();
      ui.setLanguageStatus?.('');
    }

    function openThemeSettingsModal() {
      openModal('themeSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
      ui.renderThemePicker?.();
      ui.setThemeStatus?.('');
    }

    function openVisualModeSettingsModal() {
      openModal('visualModeSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
      ui.renderVisualModePicker?.();
      ui.setVisualModeStatus?.('');
    }

    function openPollStyleSettingsModal() {
      ui.syncPollComposerStyleUi?.();
      openModal('pollStyleSettingsModal', {
        replaceStack: false,
        opener: byId('pollComposerStyleBtn'),
      });
      ui.renderPollStylePicker?.();
      ui.setPollStyleStatus?.('Applies to this poll only');
    }

    function openAnimationSettingsModal() {
      openModal('animationSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
      ui.renderModalAnimationOptions?.();
      ui.renderModalAnimationSpeedControl?.();
      ui.setModalAnimationStatus?.('');
    }

    function openMobileFontSettingsModal() {
      openModal('mobileFontSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
      ui.renderMobileFontSizeControl?.();
      ui.setMobileFontSizeStatus?.('');
    }

    function openWeatherSettingsModal() {
      openModal('weatherSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
      weather.renderWeatherSettingsForm?.();
      if (!weather.isWeatherSettingsLoaded?.()) weather.loadWeatherSettings?.().then(weather.renderWeatherSettingsForm);
    }

    function openMapSettingsModal() {
      openModal('mapSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
      maps.renderMapSettingsForm?.();
      if (!maps.isLoaded?.()) {
        const loadMaps = maps.loadMapSettings || maps.loadSettings;
        loadMaps?.call(maps).then(maps.renderMapSettingsForm).catch(() => {});
      }
    }

    function openNotificationSettingsModal() {
      openModal('notificationSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
      notifications.renderNotificationSettingsForm?.();
      notifications.setNotificationStatus?.('');
      if (!notifications.isLoaded?.()) {
        notifications.loadNotificationSettings?.().catch(() => {});
      } else {
        notifications.refreshPushDeviceState?.().catch(() => {});
      }
    }

    function openSoundSettingsModal() {
      openModal('soundSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
      sound.renderSoundSettingsForm?.();
      sound.setSoundStatus?.('');
      if (!sound.isLoaded?.()) sound.loadSoundSettings?.().catch(() => {});
    }

    function resetManagedModalScroll(modalId) {
      const modal = typeof modalId === 'string' ? byId(modalId) : modalId;
      const body = modal?.querySelector('.modal-body');
      if (!body) return;
      win.requestAnimationFrame(() => {
        body.scrollTop = 0;
      });
    }

    function bindEvents({ bindTouchSafeButtonActivation } = {}) {
      const bindTouchSafe = typeof bindTouchSafeButtonActivation === 'function'
        ? bindTouchSafeButtonActivation
        : (button, onActivate) => button?.addEventListener('click', onActivate);

      bindTouchSafe(byId('settingsBtn'), () => openSettingsModal(byId('settingsBtn')));
      byId('settingsThemePanel')?.addEventListener('click', openThemeSettingsModal);
      byId('settingsVisualModePanel')?.addEventListener('click', openVisualModeSettingsModal);
      byId('settingsAnimationPanel')?.addEventListener('click', openAnimationSettingsModal);
      byId('settingsMobileFontPanel')?.addEventListener('click', openMobileFontSettingsModal);
      byId('settingsWeatherPanel')?.addEventListener('click', openWeatherSettingsModal);
      byId('settingsMapsPanel')?.addEventListener('click', openMapSettingsModal);
      byId('settingsNotificationsPanel')?.addEventListener('click', openNotificationSettingsModal);
      byId('settingsSoundsPanel')?.addEventListener('click', openSoundSettingsModal);
      byId('settingsLanguagePanel')?.addEventListener('click', openLanguageSettingsModal);

      byId('settingsSendEnter')?.addEventListener('change', (e) => {
        ui.setSendByEnter?.(e.target.checked);
      });
      byId('settingsMicrophoneMode')?.addEventListener('change', (e) => {
        ui.setMicrophoneMode?.(e.target.checked ? 'voice_message' : 'dictation');
      });
      byId('settingsScrollRestore')?.addEventListener('change', (e) => {
        ui.setScrollRestoreMode?.(e.target.checked ? 'restore' : 'bottom');
      });
      byId('settingsOpenLastChat')?.addEventListener('change', (e) => {
        ui.setOpenLastChatOnReload?.(e.target.checked);
      });
      byId('settingsScreenRotationAllowed')?.addEventListener('change', (e) => {
        ui.setScreenRotationAllowed?.(e.target.checked, { showStatus: true }).catch(() => {});
      });

      byId('settingsThemePicker')?.addEventListener('click', (e) => {
        const card = e.target.closest('.theme-card');
        if (!card) return;
        ui.selectUiTheme?.(card.dataset.theme);
      });
      byId('settingsVisualModePicker')?.addEventListener('click', (e) => {
        const card = e.target.closest('[data-visual-mode-option]');
        if (!card) return;
        ui.selectVisualMode?.(card.dataset.visualModeOption);
      });
      byId('settingsPollStylePicker')?.addEventListener('click', (e) => {
        const card = e.target.closest('[data-poll-style-option]');
        if (!card) return;
        ui.selectPollStyle?.(card.dataset.pollStyleOption);
      });
      byId('settingsLanguagePicker')?.addEventListener('click', (e) => {
        const card = e.target.closest('[data-language-option]');
        if (!card) return;
        ui.selectUiLanguage?.(card.dataset.languageOption);
      });
      byId('settingsAnimationOptions')?.addEventListener('click', (e) => {
        const card = e.target.closest('[data-modal-animation-style]');
        if (!card) return;
        ui.selectModalAnimation?.(card.dataset.modalAnimationStyle);
      });
      byId('settingsAnimationSpeed')?.addEventListener('input', (e) => {
        ui.updateModalAnimationSpeed?.(e.target.value, { immediate: false });
      });
      byId('settingsAnimationSpeed')?.addEventListener('change', (e) => {
        ui.updateModalAnimationSpeed?.(e.target.value, { immediate: true });
      });
      byId('settingsAnimationSpeed')?.addEventListener('blur', (e) => {
        ui.updateModalAnimationSpeed?.(e.target.value, { immediate: true });
      });
      byId('settingsMobileFontSize')?.addEventListener('input', (e) => {
        ui.updateMobileFontSize?.(e.target.value, { immediate: false });
      });
      byId('settingsMobileFontSize')?.addEventListener('change', (e) => {
        ui.updateMobileFontSize?.(e.target.value, { immediate: true });
      });
      byId('settingsMobileFontSize')?.addEventListener('blur', (e) => {
        ui.updateMobileFontSize?.(e.target.value, { immediate: true });
      });
    }

    return {
      openSettingsModal,
      openLanguageSettingsModal,
      openThemeSettingsModal,
      openVisualModeSettingsModal,
      openPollStyleSettingsModal,
      openAnimationSettingsModal,
      openMobileFontSettingsModal,
      openWeatherSettingsModal,
      openMapSettingsModal,
      openNotificationSettingsModal,
      openSoundSettingsModal,
      resetManagedModalScroll,
      bindEvents,
    };
  }

  settingsRoot.modal = {
    createSettingsModal,
  };
})();
