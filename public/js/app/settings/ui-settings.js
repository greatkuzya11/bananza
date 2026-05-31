(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const settingsRoot = root.settings = root.settings || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function readOnlySetHas(setLike, value) {
    return Boolean(setLike && typeof setLike.has === 'function' && setLike.has(value));
  }

  function createUiSettings(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const win = opts.window || window;
    const dom = objectOrDefault(opts.dom);
    const config = objectOrDefault(opts.config);
    const api = typeof opts.api === 'function' ? opts.api : async () => ({});
    const androidBridge = objectOrDefault(opts.androidBridge);
    const i18nHelpers = objectOrDefault(opts.i18nHelpers);
    const i18n = win.BananzaI18n || null;
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const getCurrentUser = typeof opts.getCurrentUser === 'function' ? opts.getCurrentUser : () => null;
    const setCurrentUser = typeof opts.setCurrentUser === 'function' ? opts.setCurrentUser : () => null;
    const t = typeof i18nHelpers.t === 'function'
      ? i18nHelpers.t
      : (key, params = {}) => (i18n?.t ? i18n.t(key, params) : String(key || ''));
    const tx = typeof i18nHelpers.tx === 'function'
      ? i18nHelpers.tx
      : (text, params = {}) => {
        if (i18n?.text) return i18n.text(text, params);
        if (i18n?.t) return i18n.t(text, params);
        return String(text == null ? '' : text);
      };
    const esc = typeof opts.esc === 'function'
      ? opts.esc
      : (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const UI_THEMES = Array.isArray(config.UI_THEMES) ? config.UI_THEMES : [];
    const UI_THEME_IDS = config.UI_THEME_IDS || new Set(UI_THEMES.map((theme) => theme.id));
    const UI_VISUAL_MODES = Array.isArray(config.UI_VISUAL_MODES) ? config.UI_VISUAL_MODES : [];
    const UI_VISUAL_MODE_IDS = config.UI_VISUAL_MODE_IDS || new Set(UI_VISUAL_MODES.map((mode) => mode.id));
    const POLL_STYLES = Array.isArray(config.POLL_STYLES) ? config.POLL_STYLES : [];
    const POLL_STYLE_IDS = config.POLL_STYLE_IDS || new Set(POLL_STYLES.map((style) => style.id));
    const MODAL_ANIMATION_STYLES = Array.isArray(config.MODAL_ANIMATION_STYLES) ? config.MODAL_ANIMATION_STYLES : [];
    const MODAL_ANIMATION_STYLE_IDS = config.MODAL_ANIMATION_STYLE_IDS || new Set(MODAL_ANIMATION_STYLES.map((style) => style.id));
    const MODAL_ANIMATION_SPEED_DEFAULT = Number(config.MODAL_ANIMATION_SPEED_DEFAULT) || 8;
    const MODAL_ANIMATION_SPEED_FACTORS = objectOrDefault(config.MODAL_ANIMATION_SPEED_FACTORS);
    const MOBILE_FONT_SIZE_DEFAULT = Number(config.MOBILE_FONT_SIZE_DEFAULT) || 5;
    const MOBILE_FONT_SIZE_MIN = Number(config.MOBILE_FONT_SIZE_MIN) || 1;
    const MOBILE_FONT_SIZE_MAX = Number(config.MOBILE_FONT_SIZE_MAX) || 10;
    const MOBILE_FONT_SIZE_PERCENTS = objectOrDefault(config.MOBILE_FONT_SIZE_PERCENTS);
    const MICROPHONE_MODE_STORAGE_KEY = opts.microphoneModeStorageKey || 'microphoneMode';
    const MICROPHONE_MODE_VALUES = new Set(['voice_message', 'dictation']);
    const SCREEN_ROTATION_ALLOWED_STORAGE_KEY = opts.screenRotationAllowedStorageKey || 'screenRotationAllowed';

    let modalAnimationSaveTimer = null;
    let modalAnimationSaveInFlight = false;
    let modalAnimationSaveQueued = false;
    let modalAnimationStatusTimer = null;
    let mobileFontSizeSaveTimer = null;
    let mobileFontSizeSaveInFlight = false;
    let mobileFontSizeSaveQueued = false;
    let mobileFontSizeStatusTimer = null;
    let screenRotationStatusTimer = null;

    function $(selector, rootEl = doc) {
      if (typeof dom.$ === 'function') return dom.$(selector, rootEl);
      return rootEl?.querySelector?.(selector) || null;
    }

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
        el.textContent = tx(message || '');
        el.classList.toggle('is-error', type === 'error');
        el.classList.toggle('is-success', type === 'success');
        el.classList.toggle('is-pending', type === 'pending');
      });
    }

    function readState(name, fallback) {
      const getter = state[`get${name}`];
      if (typeof getter !== 'function') return fallback;
      const value = getter();
      return value == null ? fallback : value;
    }

    function writeState(name, value) {
      const setter = state[`set${name}`];
      if (typeof setter === 'function') setter(value);
      return value;
    }

    function updateCurrentUserPatch(patch, persist = true) {
      const user = getCurrentUser();
      if (!user) return null;
      return setCurrentUser({ ...user, ...patch }, { persist });
    }

    function currentUiTheme() {
      return normalizeUiTheme(readState('CurrentUiTheme', 'bananza'));
    }

    function setCurrentUiTheme(value) {
      return writeState('CurrentUiTheme', normalizeUiTheme(value));
    }

    function currentVisualMode() {
      return normalizeVisualMode(readState('CurrentVisualMode', 'classic'));
    }

    function setCurrentVisualMode(value) {
      return writeState('CurrentVisualMode', normalizeVisualMode(value));
    }

    function pollComposerStyle() {
      return normalizePollStyle(readState('PollComposerStyle', 'pulse'));
    }

    function setPollComposerStyle(value) {
      return writeState('PollComposerStyle', normalizePollStyle(value));
    }

    function currentModalAnimation() {
      return normalizeModalAnimationStyle(readState('CurrentModalAnimation', 'soft'));
    }

    function setCurrentModalAnimation(value) {
      return writeState('CurrentModalAnimation', normalizeModalAnimationStyle(value));
    }

    function currentModalAnimationSpeed() {
      return normalizeModalAnimationSpeed(readState('CurrentModalAnimationSpeed', MODAL_ANIMATION_SPEED_DEFAULT));
    }

    function setCurrentModalAnimationSpeed(value) {
      return writeState('CurrentModalAnimationSpeed', normalizeModalAnimationSpeed(value));
    }

    function currentMobileFontSize() {
      return normalizeMobileFontSize(readState('CurrentMobileFontSize', MOBILE_FONT_SIZE_DEFAULT));
    }

    function setCurrentMobileFontSize(value) {
      return writeState('CurrentMobileFontSize', normalizeMobileFontSize(value));
    }

    function currentUiLanguage() {
      return normalizeUiLanguage(readState('CurrentUiLanguage', i18n?.getLanguage?.() || 'ru'));
    }

    function setCurrentUiLanguage(value) {
      return writeState('CurrentUiLanguage', normalizeUiLanguage(value));
    }

    function normalizeUiTheme(theme) {
      return readOnlySetHas(UI_THEME_IDS, theme) ? theme : 'bananza';
    }

    function renderThemePicker() {
      const picker = byId('settingsThemePicker');
      if (!picker) return;
      const mode = visualModeMeta(currentVisualMode());
      picker.innerHTML = UI_THEMES.map(theme => `
      <button type="button" class="theme-card${theme.id === currentUiTheme() ? ' active' : ''}" data-theme="${theme.id}">
        <span class="theme-card-swatches">
          <span style="background:${theme.colors[0]}"></span>
          <span style="background:${theme.colors[1]}"></span>
        </span>
        <span class="theme-card-copy">
          <strong>${esc(theme.name)}</strong>
          <small>${esc(theme.note)} &middot; Rich Banan UX ${visualModeStateLabel(mode.id)}</small>
        </span>
        <span class="theme-card-preview theme-card-preview--${mode.id}" aria-hidden="true">
          <i style="background:${theme.other}"></i>
          <i style="background:${theme.own}"></i>
        </span>
      </button>
    `).join('');
    }

    function applyUiTheme(theme, persist = true) {
      const nextTheme = normalizeUiTheme(theme);
      setCurrentUiTheme(nextTheme);
      doc.documentElement.dataset.uiTheme = nextTheme;
      if (getCurrentUser()) updateCurrentUserPatch({ ui_theme: nextTheme }, persist);
      renderThemePicker();
    }

    async function selectUiTheme(theme) {
      const nextTheme = normalizeUiTheme(theme);
      if (nextTheme === currentUiTheme()) return;
      const prevTheme = currentUiTheme();
      applyUiTheme(nextTheme);
      setThemeStatus('Saving...');
      try {
        const res = await api('/api/user/theme', { method: 'PATCH', body: { theme: nextTheme } });
        setCurrentUser({ ...getCurrentUser(), ...res.user });
        applyUiTheme(getCurrentUser()?.ui_theme);
        setThemeStatus('Saved', 'success');
        win.setTimeout(() => {
          if (byId('settingsThemeStatus')?.textContent === tx('Saved')) setThemeStatus('');
        }, 1200);
      } catch (e) {
        applyUiTheme(prevTheme);
        setThemeStatus(e.message || 'Theme save failed', 'error');
      }
    }

    function setThemeStatus(message, type = '') {
      const el = byId('settingsThemeStatus');
      if (!el) return;
      el.textContent = tx(message || '');
      el.classList.toggle('is-error', type === 'error');
      el.classList.toggle('is-success', type === 'success');
    }

    function normalizeUiLanguage(language) {
      return i18n?.normalizeLanguage?.(language) || (String(language || '').toLowerCase() === 'en' ? 'en' : 'ru');
    }

    function languageDisplayName(language = currentUiLanguage()) {
      return normalizeUiLanguage(language) === 'en' ? t('English') : t('Russian');
    }

    function renderLanguagePicker() {
      const picker = byId('settingsLanguagePicker');
      if (!picker) return;
      picker.querySelectorAll('[data-language-option]').forEach((button) => {
        const lang = normalizeUiLanguage(button.dataset.languageOption);
        button.classList.toggle('active', lang === currentUiLanguage());
      });
    }

    function applyUiLanguage(language, persist = true) {
      const nextLanguage = normalizeUiLanguage(language);
      setCurrentUiLanguage(nextLanguage);
      i18n?.setLanguage?.(nextLanguage, { persist });
      doc.documentElement.lang = nextLanguage;
      if (getCurrentUser()) updateCurrentUserPatch({ ui_language: nextLanguage }, persist);
      syncLanguageSettingsButton();
      renderLanguagePicker();
      refreshLocalizedUi();
    }

    async function selectUiLanguage(language) {
      const nextLanguage = normalizeUiLanguage(language);
      if (nextLanguage === currentUiLanguage()) return;
      const previousLanguage = currentUiLanguage();
      applyUiLanguage(nextLanguage);
      setLanguageStatus('Saving...');
      try {
        const res = await api('/api/user/language', { method: 'PATCH', body: { language: nextLanguage } });
        setCurrentUser({ ...getCurrentUser(), ...res.user });
        applyUiLanguage(getCurrentUser()?.ui_language);
        setLanguageStatus('Saved', 'success');
        win.setTimeout(() => {
          if (byId('settingsLanguageStatus')?.textContent === tx('Saved')) setLanguageStatus('');
        }, 1200);
      } catch (error) {
        applyUiLanguage(previousLanguage);
        setLanguageStatus(error.message || 'Language save failed', 'error');
      }
    }

    function refreshLocalizedUi() {
      syncLanguageSettingsButton();
      syncModalAnimationSettingsButton();
      syncMobileFontSettingsButton();
      applyVisualMode(currentVisualMode(), false);
      renderThemePicker();
      renderVisualModePicker();
      renderPollStylePicker();
      renderModalAnimationOptions();
      renderLanguagePicker();
      i18n?.applyStaticDom?.(doc);
      actions.refreshLocalizedUiRuntime?.();
    }

    function syncLanguageSettingsButton() {
      const panelBtn = byId('settingsLanguagePanel');
      if (!panelBtn) return;
      panelBtn.textContent = `\uD83C\uDF10 ${t('Interface language')}: ${languageDisplayName(currentUiLanguage())}`;
    }

    function setLanguageStatus(message, type = '') {
      const el = byId('settingsLanguageStatus');
      if (!el) return;
      el.textContent = tx(message || '');
      el.classList.toggle('is-error', type === 'error');
      el.classList.toggle('is-success', type === 'success');
    }

    function normalizeVisualMode(mode) {
      return readOnlySetHas(UI_VISUAL_MODE_IDS, mode) ? mode : 'classic';
    }

    function visualModeMeta(mode) {
      const id = normalizeVisualMode(mode);
      return UI_VISUAL_MODES.find(item => item.id === id) || UI_VISUAL_MODES[0] || { id: 'classic', name: 'Off', note: '' };
    }

    function visualModeStateLabel(mode) {
      return normalizeVisualMode(mode) === 'rich' ? 'On' : 'Off';
    }

    function renderVisualModePicker() {
      const picker = byId('settingsVisualModePicker');
      if (!picker) return;
      picker.innerHTML = UI_VISUAL_MODES.map(mode => `
      <button type="button" class="visual-mode-card${mode.id === currentVisualMode() ? ' active' : ''}" data-visual-mode-option="${mode.id}">
        <span class="visual-mode-card-preview visual-mode-card-preview--${mode.id}" aria-hidden="true">
          <i></i><i></i><i></i>
        </span>
        <span class="visual-mode-card-copy">
          <strong>${esc(mode.name)}</strong>
          <small>${esc(mode.note)}</small>
        </span>
      </button>
    `).join('');
    }

    function applyVisualMode(mode, persist = true) {
      const nextMode = normalizeVisualMode(mode);
      setCurrentVisualMode(nextMode);
      doc.documentElement.dataset.visualMode = nextMode;
      if (getCurrentUser()) updateCurrentUserPatch({ ui_visual_mode: nextMode }, persist);
      const panelBtn = byId('settingsVisualModePanel');
      if (panelBtn) panelBtn.textContent = `\uD83C\uDF4C ${t('Rich Banan UX')}: ${t(visualModeStateLabel(nextMode))}`;
      renderVisualModePicker();
      renderThemePicker();
    }

    async function selectVisualMode(mode) {
      const nextMode = normalizeVisualMode(mode);
      if (nextMode === currentVisualMode()) return;
      const prevMode = currentVisualMode();
      applyVisualMode(nextMode);
      setVisualModeStatus('Saving...');
      try {
        const res = await api('/api/user/visual-mode', { method: 'PATCH', body: { mode: nextMode } });
        setCurrentUser({ ...getCurrentUser(), ...res.user });
        applyVisualMode(getCurrentUser()?.ui_visual_mode);
        setVisualModeStatus('Saved', 'success');
        win.setTimeout(() => {
          if (byId('settingsVisualModeStatus')?.textContent === tx('Saved')) setVisualModeStatus('');
        }, 1200);
      } catch (e) {
        applyVisualMode(prevMode);
        setVisualModeStatus(e.message || 'Visual mode save failed', 'error');
      }
    }

    function setVisualModeStatus(message, type = '') {
      const el = byId('settingsVisualModeStatus');
      if (!el) return;
      el.textContent = tx(message || '');
      el.classList.toggle('is-error', type === 'error');
      el.classList.toggle('is-success', type === 'success');
    }

    function normalizePollStyle(style) {
      return readOnlySetHas(POLL_STYLE_IDS, style) ? style : 'pulse';
    }

    function pollStyleMeta(style) {
      return POLL_STYLES.find((item) => item.id === normalizePollStyle(style)) || POLL_STYLES[0] || { id: 'pulse', name: 'Pulse', note: '' };
    }

    function renderPollStyleCardPreview(styleId) {
      if (styleId === 'stack') {
        return `
        <span class="poll-style-card-preview poll-style-card-preview--stack" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
      `;
      }
      if (styleId === 'orbit') {
        return `
        <span class="poll-style-card-preview poll-style-card-preview--orbit" aria-hidden="true">
          <span class="poll-style-card-ring"></span>
          <span class="poll-style-card-legend">
            <i></i>
            <i></i>
            <i></i>
          </span>
        </span>
      `;
      }
      return `
      <span class="poll-style-card-preview poll-style-card-preview--pulse" aria-hidden="true">
        <i></i>
        <i></i>
        <i></i>
      </span>
    `;
    }

    function renderPollStylePicker() {
      const picker = byId('settingsPollStylePicker');
      if (!picker) return;
      picker.innerHTML = POLL_STYLES.map((style) => `
      <button type="button" class="poll-style-card${style.id === pollComposerStyle() ? ' active' : ''}" data-poll-style-option="${style.id}">
        ${renderPollStyleCardPreview(style.id)}
        <span class="poll-style-card-copy">
          <strong>${esc(style.name)}</strong>
          <small>${esc(style.note)}</small>
        </span>
      </button>
    `).join('');
    }

    function setPollStyleSurface(modalEl, style) {
      if (!modalEl) return;
      modalEl.dataset.pollStyle = normalizePollStyle(style);
    }

    function syncPollComposerStyleUi() {
      const style = normalizePollStyle(pollComposerStyle());
      const meta = pollStyleMeta(style);
      setPollStyleSurface(dom.pollComposerModal || byId('pollComposerModal'), style);
      setPollStyleSurface(dom.pollStyleSettingsModal || byId('pollStyleSettingsModal'), style);
      const nameEl = byId('pollComposerStyleName');
      const noteEl = byId('pollComposerStyleNote');
      const btnEl = byId('pollComposerStyleBtn');
      if (nameEl) nameEl.textContent = meta.name;
      if (noteEl) noteEl.textContent = meta.note;
      if (btnEl) btnEl.textContent = `Poll Style: ${meta.name}`;
      renderPollStylePicker();
    }

    function selectPollStyle(style) {
      const nextStyle = normalizePollStyle(style);
      if (nextStyle === pollComposerStyle()) return;
      setPollComposerStyle(nextStyle);
      syncPollComposerStyleUi();
      actions.refreshPollComposerPreview?.();
      setPollStyleStatus('Applies to this poll only', 'success');
    }

    function setPollStyleStatus(message, type = '') {
      const el = byId('settingsPollStyleStatus');
      if (!el) return;
      el.textContent = tx(message || '');
      el.classList.toggle('is-error', type === 'error');
      el.classList.toggle('is-success', type === 'success');
    }

    function normalizeModalAnimationStyle(style) {
      return readOnlySetHas(MODAL_ANIMATION_STYLE_IDS, style) ? style : 'soft';
    }

    function modalAnimationMeta(style = currentModalAnimation()) {
      const id = normalizeModalAnimationStyle(style);
      return MODAL_ANIMATION_STYLES.find((item) => item.id === id) || MODAL_ANIMATION_STYLES[0] || { id: 'soft', name: 'Soft', note: '' };
    }

    function syncModalAnimationSettingsButton() {
      const panelBtn = byId('settingsAnimationPanel');
      if (!panelBtn) return;
      const meta = modalAnimationMeta(currentModalAnimation());
      panelBtn.textContent = `\u2728 ${t('Animation')}: ${t(meta.name)}, ${normalizeModalAnimationSpeed(currentModalAnimationSpeed())}/10`;
    }

    function normalizeModalAnimationSpeed(speed) {
      const next = Math.round(Number(speed));
      if (!Number.isFinite(next)) return MODAL_ANIMATION_SPEED_DEFAULT;
      return Math.min(10, Math.max(1, next));
    }

    function getModalAnimationSpeedFactor(speed = currentModalAnimationSpeed()) {
      return MODAL_ANIMATION_SPEED_FACTORS[normalizeModalAnimationSpeed(speed)] || 1;
    }

    function setModalAnimationStatus(message, type = '') {
      const el = byId('settingsAnimationStatus');
      if (!el) return;
      el.textContent = tx(message || '');
      el.classList.toggle('is-error', type === 'error');
      el.classList.toggle('is-success', type === 'success');
    }

    function clearModalAnimationStatusTimer() {
      win.clearTimeout(modalAnimationStatusTimer);
      modalAnimationStatusTimer = null;
    }

    function scheduleModalAnimationStatusClear() {
      clearModalAnimationStatusTimer();
      modalAnimationStatusTimer = win.setTimeout(() => {
        if (byId('settingsAnimationStatus')?.textContent === tx('Saved')) setModalAnimationStatus('');
      }, 1200);
    }

    function getPersistedModalAnimationPreferences() {
      const user = getCurrentUser();
      return {
        style: normalizeModalAnimationStyle(user?.ui_modal_animation),
        speed: normalizeModalAnimationSpeed(user?.ui_modal_animation_speed),
      };
    }

    function getCurrentModalAnimationPreferences() {
      return {
        style: normalizeModalAnimationStyle(currentModalAnimation()),
        speed: normalizeModalAnimationSpeed(currentModalAnimationSpeed()),
      };
    }

    function modalAnimationPreferencesEqual(a = {}, b = {}) {
      return normalizeModalAnimationStyle(a.style) === normalizeModalAnimationStyle(b.style)
        && normalizeModalAnimationSpeed(a.speed) === normalizeModalAnimationSpeed(b.speed);
    }

    function renderModalAnimationOptions() {
      const wrap = byId('settingsAnimationOptions');
      if (!wrap) return;
      wrap.innerHTML = MODAL_ANIMATION_STYLES.map((style) => `
      <button
        type="button"
        class="animation-style-card${style.id === currentModalAnimation() ? ' active' : ''}"
        data-modal-animation-style="${style.id}"
        aria-pressed="${style.id === currentModalAnimation() ? 'true' : 'false'}"
        ${style.id === currentModalAnimation() ? 'aria-current="true"' : ''}
      >
        <strong>${esc(style.name)}</strong>
        <small>${esc(style.note)}</small>
        ${style.id === currentModalAnimation() ? '<span class="animation-selected-mark">Selected</span>' : ''}
      </button>
    `).join('');
    }

    function renderModalAnimationSpeedControl() {
      const input = byId('settingsAnimationSpeed');
      const value = byId('settingsAnimationSpeedValue');
      const control = doc.querySelector('.animation-speed-control');
      if (input) input.value = String(normalizeModalAnimationSpeed(currentModalAnimationSpeed()));
      if (value) value.textContent = `${normalizeModalAnimationSpeed(currentModalAnimationSpeed())}/10`;
      control?.classList.toggle('is-inactive', currentModalAnimation() === 'none');
    }

    function applyModalAnimation(style, persist = true) {
      const nextStyle = normalizeModalAnimationStyle(style);
      setCurrentModalAnimation(nextStyle);
      doc.documentElement.dataset.modalAnimation = nextStyle;
      if (getCurrentUser() && persist) updateCurrentUserPatch({ ui_modal_animation: nextStyle }, true);
      syncModalAnimationSettingsButton();
      renderModalAnimationOptions();
      renderModalAnimationSpeedControl();
    }

    function applyModalAnimationSpeed(speed, persist = true) {
      const nextSpeed = normalizeModalAnimationSpeed(speed);
      setCurrentModalAnimationSpeed(nextSpeed);
      doc.documentElement.style.setProperty('--modal-animation-speed-factor', String(getModalAnimationSpeedFactor(nextSpeed)));
      if (getCurrentUser() && persist) updateCurrentUserPatch({ ui_modal_animation_speed: nextSpeed }, true);
      syncModalAnimationSettingsButton();
      renderModalAnimationSpeedControl();
    }

    async function flushModalAnimationSave() {
      win.clearTimeout(modalAnimationSaveTimer);
      modalAnimationSaveTimer = null;
      if (modalAnimationSaveInFlight || !getCurrentUser()) return;
      const nextPrefs = getCurrentModalAnimationPreferences();
      const prevPrefs = getPersistedModalAnimationPreferences();
      if (modalAnimationPreferencesEqual(nextPrefs, prevPrefs)) {
        modalAnimationSaveQueued = false;
        setModalAnimationStatus('');
        return;
      }

      modalAnimationSaveInFlight = true;
      modalAnimationSaveQueued = false;
      clearModalAnimationStatusTimer();
      setModalAnimationStatus('Saving...');
      let didSave = false;
      const requestPrefs = { ...nextPrefs };

      try {
        const res = await api('/api/user/modal-animation', { method: 'PATCH', body: requestPrefs });
        setCurrentUser({ ...getCurrentUser(), ...res.user });
        didSave = true;

        const localChangedSinceRequest = !modalAnimationPreferencesEqual(getCurrentModalAnimationPreferences(), requestPrefs);
        if (!localChangedSinceRequest) {
          applyModalAnimation(getCurrentUser()?.ui_modal_animation, false);
          applyModalAnimationSpeed(getCurrentUser()?.ui_modal_animation_speed, false);
        }

        const pendingLocalChanges = !modalAnimationPreferencesEqual(getCurrentModalAnimationPreferences(), getPersistedModalAnimationPreferences());
        if (!pendingLocalChanges && !modalAnimationSaveTimer) {
          setModalAnimationStatus('Saved', 'success');
          scheduleModalAnimationStatusClear();
        } else {
          setModalAnimationStatus('Saving...');
        }
      } catch (e) {
        const localChangedSinceRequest = !modalAnimationPreferencesEqual(getCurrentModalAnimationPreferences(), requestPrefs);
        if (!localChangedSinceRequest) {
          applyModalAnimation(prevPrefs.style, false);
          applyModalAnimationSpeed(prevPrefs.speed, false);
        }
        setModalAnimationStatus(e.message || 'Animation save failed', 'error');
      } finally {
        modalAnimationSaveInFlight = false;
        const pendingLocalChanges = !modalAnimationPreferencesEqual(getCurrentModalAnimationPreferences(), getPersistedModalAnimationPreferences());
        if (didSave && !modalAnimationSaveTimer && pendingLocalChanges) {
          modalAnimationSaveQueued = false;
          flushModalAnimationSave().catch(() => {});
        } else if (!pendingLocalChanges && !modalAnimationSaveTimer) {
          modalAnimationSaveQueued = false;
        }
      }
    }

    function scheduleModalAnimationSave({ debounce = 0 } = {}) {
      clearModalAnimationStatusTimer();
      const nextPrefs = getCurrentModalAnimationPreferences();
      const prevPrefs = getPersistedModalAnimationPreferences();
      if (modalAnimationPreferencesEqual(nextPrefs, prevPrefs)) {
        win.clearTimeout(modalAnimationSaveTimer);
        modalAnimationSaveTimer = null;
        modalAnimationSaveQueued = false;
        if (!modalAnimationSaveInFlight) setModalAnimationStatus('');
        return;
      }

      setModalAnimationStatus('Saving...');
      win.clearTimeout(modalAnimationSaveTimer);

      if (debounce > 0) {
        modalAnimationSaveQueued = true;
        modalAnimationSaveTimer = win.setTimeout(() => {
          modalAnimationSaveTimer = null;
          if (modalAnimationSaveInFlight) return;
          flushModalAnimationSave().catch(() => {});
        }, debounce);
        return;
      }

      if (modalAnimationSaveInFlight) {
        modalAnimationSaveQueued = true;
        return;
      }

      flushModalAnimationSave().catch(() => {});
    }

    function selectModalAnimation(style) {
      const nextStyle = normalizeModalAnimationStyle(style);
      if (nextStyle === currentModalAnimation()) return;
      applyModalAnimation(nextStyle, false);
      scheduleModalAnimationSave();
    }

    function updateModalAnimationSpeed(speed, { immediate = false } = {}) {
      applyModalAnimationSpeed(speed, false);
      scheduleModalAnimationSave({ debounce: immediate ? 0 : 350 });
    }

    function normalizeMobileFontSize(size) {
      const next = Math.round(Number(size));
      if (!Number.isFinite(next)) return MOBILE_FONT_SIZE_DEFAULT;
      return Math.min(MOBILE_FONT_SIZE_MAX, Math.max(MOBILE_FONT_SIZE_MIN, next));
    }

    function getMobileFontAdjustPercent(size = currentMobileFontSize()) {
      return MOBILE_FONT_SIZE_PERCENTS[normalizeMobileFontSize(size)] || MOBILE_FONT_SIZE_PERCENTS[MOBILE_FONT_SIZE_DEFAULT] || 100;
    }

    function hasAndroidNativeBridge() {
      return Boolean(androidBridge.hasAndroidNativeBridge?.());
    }

    function notifyAndroidScreenRotationPreference(reason = 'sync') {
      return androidBridge.notifyAndroidScreenRotationPreference?.(getScreenRotationAllowed(), reason);
    }

    function setMobileFontAdjustPercent(percent = 100) {
      const value = `${Math.round(Number(percent) || 100)}%`;
      doc.documentElement.style.setProperty('-webkit-text-size-adjust', value, 'important');
      doc.documentElement.style.setProperty('text-size-adjust', value, 'important');
    }

    function notifyAndroidMobileFontSize(size = currentMobileFontSize()) {
      const mobileLayout = Boolean(actions.isMobileLayoutViewport?.());
      const effectiveSize = mobileLayout ? normalizeMobileFontSize(size) : MOBILE_FONT_SIZE_DEFAULT;
      return androidBridge.notifyAndroidMobileFontSize?.(effectiveSize, mobileLayout);
    }

    function syncMobileFontSettingsButton() {
      const panelBtn = byId('settingsMobileFontPanel');
      if (!panelBtn) return;
      panelBtn.textContent = `\uD83D\uDD20 ${t('Font Size (mobile)')}: ${normalizeMobileFontSize(currentMobileFontSize())}/10`;
    }

    function setMobileFontSizeStatus(message, type = '') {
      const el = byId('settingsMobileFontStatus');
      if (!el) return;
      el.textContent = tx(message || '');
      el.classList.toggle('is-error', type === 'error');
      el.classList.toggle('is-success', type === 'success');
    }

    function clearMobileFontSizeStatusTimer() {
      win.clearTimeout(mobileFontSizeStatusTimer);
      mobileFontSizeStatusTimer = null;
    }

    function scheduleMobileFontSizeStatusClear() {
      clearMobileFontSizeStatusTimer();
      mobileFontSizeStatusTimer = win.setTimeout(() => {
        if (byId('settingsMobileFontStatus')?.textContent === tx('Saved')) setMobileFontSizeStatus('');
      }, 1200);
    }

    function getPersistedMobileFontSize() {
      return normalizeMobileFontSize(getCurrentUser()?.ui_mobile_font_size);
    }

    function renderMobileFontSizeControl() {
      const input = byId('settingsMobileFontSize');
      const value = byId('settingsMobileFontSizeValue');
      if (input) input.value = String(normalizeMobileFontSize(currentMobileFontSize()));
      if (value) value.textContent = `${normalizeMobileFontSize(currentMobileFontSize())}/10`;
    }

    function applyMobileFontSize(size, persist = true) {
      const nextSize = normalizeMobileFontSize(size);
      setCurrentMobileFontSize(nextSize);
      setMobileFontAdjustPercent(hasAndroidNativeBridge() ? 100 : (actions.isMobileLayoutViewport?.() ? getMobileFontAdjustPercent(nextSize) : 100));
      if (getCurrentUser() && persist) updateCurrentUserPatch({ ui_mobile_font_size: nextSize }, true);
      syncMobileFontSettingsButton();
      renderMobileFontSizeControl();
      notifyAndroidMobileFontSize(nextSize);
    }

    function syncMobileFontSizeViewportState() {
      applyMobileFontSize(currentMobileFontSize(), false);
    }

    async function flushMobileFontSizeSave() {
      win.clearTimeout(mobileFontSizeSaveTimer);
      mobileFontSizeSaveTimer = null;
      if (mobileFontSizeSaveInFlight || !getCurrentUser()) return;
      const nextSize = normalizeMobileFontSize(currentMobileFontSize());
      const prevSize = getPersistedMobileFontSize();
      if (nextSize === prevSize) {
        mobileFontSizeSaveQueued = false;
        setMobileFontSizeStatus('');
        return;
      }

      mobileFontSizeSaveInFlight = true;
      mobileFontSizeSaveQueued = false;
      clearMobileFontSizeStatusTimer();
      setMobileFontSizeStatus('Saving...');
      let didSave = false;
      const requestSize = nextSize;

      try {
        const res = await api('/api/user/mobile-font-size', { method: 'PATCH', body: { size: requestSize } });
        setCurrentUser({ ...getCurrentUser(), ...res.user });
        didSave = true;

        const localChangedSinceRequest = normalizeMobileFontSize(currentMobileFontSize()) !== requestSize;
        if (!localChangedSinceRequest) applyMobileFontSize(getCurrentUser()?.ui_mobile_font_size, false);

        const pendingLocalChanges = normalizeMobileFontSize(currentMobileFontSize()) !== getPersistedMobileFontSize();
        if (!pendingLocalChanges && !mobileFontSizeSaveTimer) {
          setMobileFontSizeStatus('Saved', 'success');
          scheduleMobileFontSizeStatusClear();
        } else {
          setMobileFontSizeStatus('Saving...');
        }
      } catch (e) {
        const localChangedSinceRequest = normalizeMobileFontSize(currentMobileFontSize()) !== requestSize;
        if (!localChangedSinceRequest) applyMobileFontSize(prevSize, false);
        setMobileFontSizeStatus(e.message || 'Font size save failed', 'error');
      } finally {
        mobileFontSizeSaveInFlight = false;
        const pendingLocalChanges = normalizeMobileFontSize(currentMobileFontSize()) !== getPersistedMobileFontSize();
        if (didSave && !mobileFontSizeSaveTimer && pendingLocalChanges) {
          mobileFontSizeSaveQueued = false;
          flushMobileFontSizeSave().catch(() => {});
        } else if (!pendingLocalChanges && !mobileFontSizeSaveTimer) {
          mobileFontSizeSaveQueued = false;
        }
      }
    }

    function scheduleMobileFontSizeSave({ debounce = 0 } = {}) {
      clearMobileFontSizeStatusTimer();
      const nextSize = normalizeMobileFontSize(currentMobileFontSize());
      const prevSize = getPersistedMobileFontSize();
      if (nextSize === prevSize) {
        win.clearTimeout(mobileFontSizeSaveTimer);
        mobileFontSizeSaveTimer = null;
        mobileFontSizeSaveQueued = false;
        if (!mobileFontSizeSaveInFlight) setMobileFontSizeStatus('');
        return;
      }

      setMobileFontSizeStatus('Saving...');
      win.clearTimeout(mobileFontSizeSaveTimer);

      if (debounce > 0) {
        mobileFontSizeSaveQueued = true;
        mobileFontSizeSaveTimer = win.setTimeout(() => {
          mobileFontSizeSaveTimer = null;
          if (mobileFontSizeSaveInFlight) return;
          flushMobileFontSizeSave().catch(() => {});
        }, debounce);
        return;
      }

      if (mobileFontSizeSaveInFlight) {
        mobileFontSizeSaveQueued = true;
        return;
      }

      flushMobileFontSizeSave().catch(() => {});
    }

    function updateMobileFontSize(size, { immediate = false } = {}) {
      applyMobileFontSize(size, false);
      scheduleMobileFontSizeSave({ debounce: immediate ? 0 : 350 });
    }

    function clearMobileFontSizeSaveTimer() {
      win.clearTimeout(mobileFontSizeSaveTimer);
      mobileFontSizeSaveTimer = null;
    }

    function getScreenRotationAllowed() {
      return readState('ScreenRotationAllowed', true) !== false;
    }

    function syncScreenRotationToggle() {
      const toggle = byId('settingsScreenRotationAllowed');
      if (toggle) toggle.checked = getScreenRotationAllowed();
    }

    function setScreenRotationStatus(message = '', type = '') {
      if (screenRotationStatusTimer) {
        win.clearTimeout(screenRotationStatusTimer);
        screenRotationStatusTimer = null;
      }
      setInlineStatus('settingsScreenRotationStatus', message, type);
    }

    function clearScreenRotationStatusSoon(delayMs = 2200) {
      if (screenRotationStatusTimer) win.clearTimeout(screenRotationStatusTimer);
      screenRotationStatusTimer = win.setTimeout(() => {
        screenRotationStatusTimer = null;
        setInlineStatus('settingsScreenRotationStatus', '', '');
      }, delayMs);
    }

    async function applyScreenRotationPreference({ showStatus = false, reason = '' } = {}) {
      syncScreenRotationToggle();
      const allowed = getScreenRotationAllowed();
      const nativeBridgeAvailable = hasAndroidNativeBridge();
      notifyAndroidScreenRotationPreference(reason || 'sync');
      if (showStatus) {
        if (allowed) {
          setScreenRotationStatus('Screen rotation allowed', 'success');
          clearScreenRotationStatusSoon();
        } else if (nativeBridgeAvailable) {
          setScreenRotationStatus('Portrait lock is active', 'success');
          clearScreenRotationStatusSoon();
        } else {
          setScreenRotationStatus('Saved. Install the updated Android app to lock screen rotation.', 'pending');
        }
      }
      return { allowed, locked: !allowed && nativeBridgeAvailable, nativeBridge: nativeBridgeAvailable };
    }

    function setScreenRotationAllowed(value, { persist = true, showStatus = true } = {}) {
      const allowed = Boolean(value);
      writeState('ScreenRotationAllowed', allowed);
      if (persist) win.localStorage.setItem(SCREEN_ROTATION_ALLOWED_STORAGE_KEY, allowed ? '1' : '0');
      syncScreenRotationToggle();
      return applyScreenRotationPreference({ showStatus, reason: 'setting-change' });
    }

    function normalizeMicrophoneMode(value) {
      const next = String(value || '').trim();
      return MICROPHONE_MODE_VALUES.has(next) ? next : 'voice_message';
    }

    function getMicrophoneMode() {
      return normalizeMicrophoneMode(readState('MicrophoneMode', 'voice_message'));
    }

    function setMicrophoneMode(value, { persist = true } = {}) {
      const nextMode = normalizeMicrophoneMode(value);
      writeState('MicrophoneMode', nextMode);
      if (persist) win.localStorage.setItem(MICROPHONE_MODE_STORAGE_KEY, nextMode);
      const toggle = byId('settingsMicrophoneMode');
      if (toggle) toggle.checked = nextMode === 'voice_message';
      actions.refreshVoiceComposerState?.();
      return nextMode;
    }

    function getSendByEnter() {
      return readState('SendByEnter', win.localStorage.getItem('sendByEnter') !== '0') !== false;
    }

    function setSendByEnter(value, { persist = true } = {}) {
      const enabled = Boolean(value);
      writeState('SendByEnter', enabled);
      if (persist) win.localStorage.setItem('sendByEnter', enabled ? '1' : '0');
      const toggle = byId('settingsSendEnter');
      if (toggle) toggle.checked = enabled;
      return enabled;
    }

    function getScrollRestoreMode() {
      return readState('ScrollRestoreMode', win.localStorage.getItem('scrollRestoreMode') || 'bottom') === 'restore' ? 'restore' : 'bottom';
    }

    function setScrollRestoreMode(mode = 'bottom', { persist = true } = {}) {
      const nextMode = mode === 'restore' ? 'restore' : 'bottom';
      writeState('ScrollRestoreMode', nextMode);
      if (persist) win.localStorage.setItem('scrollRestoreMode', nextMode);
      const toggle = byId('settingsScrollRestore');
      if (toggle) toggle.checked = nextMode === 'restore';
      return nextMode;
    }

    function getOpenLastChatOnReload() {
      return readState('OpenLastChatOnReload', win.localStorage.getItem('openLastChatOnReload') !== '0') !== false;
    }

    function setOpenLastChatOnReload(value, { persist = true } = {}) {
      const enabled = Boolean(value);
      writeState('OpenLastChatOnReload', enabled);
      if (persist) win.localStorage.setItem('openLastChatOnReload', enabled ? '1' : '0');
      const toggle = byId('settingsOpenLastChat');
      if (toggle) toggle.checked = enabled;
      return enabled;
    }

    function syncSimplePreferenceToggles() {
      const sendToggle = byId('settingsSendEnter');
      if (sendToggle) sendToggle.checked = getSendByEnter();
      const micToggle = byId('settingsMicrophoneMode');
      if (micToggle) micToggle.checked = getMicrophoneMode() === 'voice_message';
      const scrollToggle = byId('settingsScrollRestore');
      if (scrollToggle) scrollToggle.checked = getScrollRestoreMode() === 'restore';
      const openLastToggle = byId('settingsOpenLastChat');
      if (openLastToggle) openLastToggle.checked = getOpenLastChatOnReload();
      syncScreenRotationToggle();
    }

    return {
      normalizeUiTheme,
      renderThemePicker,
      applyUiTheme,
      selectUiTheme,
      setThemeStatus,
      normalizeUiLanguage,
      languageDisplayName,
      renderLanguagePicker,
      applyUiLanguage,
      selectUiLanguage,
      refreshLocalizedUi,
      syncLanguageSettingsButton,
      setLanguageStatus,
      normalizeVisualMode,
      visualModeMeta,
      visualModeStateLabel,
      renderVisualModePicker,
      applyVisualMode,
      selectVisualMode,
      setVisualModeStatus,
      normalizePollStyle,
      pollStyleMeta,
      renderPollStyleCardPreview,
      renderPollStylePicker,
      setPollStyleSurface,
      syncPollComposerStyleUi,
      selectPollStyle,
      setPollStyleStatus,
      normalizeModalAnimationStyle,
      modalAnimationMeta,
      syncModalAnimationSettingsButton,
      normalizeModalAnimationSpeed,
      getModalAnimationSpeedFactor,
      setModalAnimationStatus,
      clearModalAnimationStatusTimer,
      scheduleModalAnimationStatusClear,
      getPersistedModalAnimationPreferences,
      getCurrentModalAnimationPreferences,
      modalAnimationPreferencesEqual,
      renderModalAnimationOptions,
      renderModalAnimationSpeedControl,
      applyModalAnimation,
      applyModalAnimationSpeed,
      flushModalAnimationSave,
      scheduleModalAnimationSave,
      selectModalAnimation,
      updateModalAnimationSpeed,
      normalizeMobileFontSize,
      getMobileFontAdjustPercent,
      setMobileFontAdjustPercent,
      notifyAndroidMobileFontSize,
      syncMobileFontSettingsButton,
      setMobileFontSizeStatus,
      clearMobileFontSizeStatusTimer,
      scheduleMobileFontSizeStatusClear,
      getPersistedMobileFontSize,
      renderMobileFontSizeControl,
      applyMobileFontSize,
      syncMobileFontSizeViewportState,
      flushMobileFontSizeSave,
      scheduleMobileFontSizeSave,
      updateMobileFontSize,
      clearMobileFontSizeSaveTimer,
      hasAndroidNativeBridge,
      notifyAndroidScreenRotationPreference,
      getScreenRotationAllowed,
      syncScreenRotationToggle,
      setScreenRotationStatus,
      clearScreenRotationStatusSoon,
      applyScreenRotationPreference,
      setScreenRotationAllowed,
      normalizeMicrophoneMode,
      getMicrophoneMode,
      setMicrophoneMode,
      getSendByEnter,
      setSendByEnter,
      getScrollRestoreMode,
      setScrollRestoreMode,
      getOpenLastChatOnReload,
      setOpenLastChatOnReload,
      syncSimplePreferenceToggles,
    };
  }

  settingsRoot.ui = {
    createUiSettings,
  };
})();
