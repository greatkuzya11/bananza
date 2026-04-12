(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIG
  // ═══════════════════════════════════════════════════════════════════════════
  const WS_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
  const PAGE_SIZE = 50;
  const MAX_MSG = 5000;
  const UI_THEMES = [
    { id: 'bananza', name: 'BananZa', note: 'Classic blue', colors: ['#17212b', '#5eb5f7'], own: '#2b5278', other: '#182533' },
    { id: 'midnight-ocean', name: 'Midnight Ocean', note: 'Navy + teal', colors: ['#071823', '#2dd4bf'], own: '#14506a', other: '#102434' },
    { id: 'nord-aurora', name: 'Nord Aurora', note: 'Graphite + aurora', colors: ['#2e3440', '#88c0d0'], own: '#3b5f75', other: '#293340' },
    { id: 'rose-pine', name: 'Rose Pine', note: 'Plum + rose', colors: ['#191724', '#eb6f92'], own: '#3a2a4a', other: '#221f33' },
    { id: 'dracula-neon', name: 'Dracula Neon', note: 'Violet + pink', colors: ['#282a36', '#ff79c6'], own: '#4b3a69', other: '#242636' },
    { id: 'tokyo-night', name: 'Tokyo Night', note: 'Ink + electric blue', colors: ['#1a1b26', '#7aa2f7'], own: '#2b4d7d', other: '#202437' },
  ];
  const UI_THEME_IDS = new Set(UI_THEMES.map(t => t.id));

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  let currentUser = null;
  let token = null;
  let chats = [];
  let currentChatId = null;
  let ws = null;
  let wsRetry = 1000;
  let onlineUsers = new Set();
  let loadingMore = false;
  let hasMore = true;
  let pendingFile = null;
  let pendingFiles = []; // queue for multi-file upload
  let typingSendTimeout = null;
  let typingDisplayTimeouts = {};
  let displayedMsgIds = new Set();
  let replyTo = null; // { id, display_name, text }
  let editTo = null; // { id, text, is_voice_note, allowEmpty }
  let allUsers = [];
  let compactViewMap = JSON.parse(localStorage.getItem('compactViewMap') || '{}');
  let compactView = false;
  let sendByEnter = localStorage.getItem('sendByEnter') !== '0';
  let scrollRestoreMode = localStorage.getItem('scrollRestoreMode') || 'bottom'; // 'bottom' | 'restore'
  let openLastChatOnReload = localStorage.getItem('openLastChatOnReload') !== '0';
  let scrollPositions = {}; // chatId -> scrollTop
  let currentUiTheme = 'bananza';
  let weatherSettings = { enabled: false, refresh_minutes: 30, location: null };
  let weatherSettingsLoaded = false;
  let selectedWeatherLocation = null;
  let weatherSearchResults = [];
  let weatherTimer = null;
  let weatherSearchTimer = null;
  let notificationSettings = {
    push_enabled: false,
    notify_messages: true,
    notify_chat_invites: true,
    notify_reactions: true,
    notify_mentions: true,
  };
  let notificationSettingsLoaded = false;
  let pushDeviceSubscribed = false;
  let soundSettings = {
    sounds_enabled: true,
    volume: 55,
    play_send: true,
    play_incoming: true,
    play_notifications: true,
    play_reactions: true,
    play_invites: true,
    play_voice: true,
    play_mentions: true,
  };
  let soundSettingsLoaded = false;
  let soundSettingsSaveTimer = null;
  let aiBotState = {
    settings: { enabled: false, default_response_model: 'gpt-4o-mini', default_summary_model: 'gpt-4o-mini', default_embedding_model: 'text-embedding-3-small', chunk_size: 50, retrieval_top_k: 6 },
    bots: [],
    chats: [],
    chatSettings: [],
  };
  let selectedAiBotId = null;
  let forwardMessageState = null;
  let forwardMessageBusy = false;
  let forwardModalCloseTimer = null;
  let centerToastTimer = null;
  let mentionTargetsByChat = new Map();
  let mentionPickerState = { active: false, start: 0, end: 0, selected: 0, targets: [] };
  let avatarUserMenuState = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM
  // ═══════════════════════════════════════════════════════════════════════════
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const sidebar = $('#sidebar');
  const chatList = $('#chatList');
  const chatSearch = $('#chatSearch');
  const chatArea = $('#chatArea');
  const emptyState = $('#emptyState');
  const chatView = $('#chatView');
  const chatTitle = $('#chatTitle');
  const chatHeaderAvatar = $('#chatHeaderAvatar');
  const chatStatus = $('#chatStatus');
  const messagesEl = $('#messages');
  const loadMoreWrap = $('#loadMoreWrap');
  const loadMoreBtn = $('#loadMoreBtn');
  const typingBar = $('#typingBar');
  const msgInput = $('#msgInput');
  const sendBtn = $('#sendBtn');
  const scrollBottomBtn = $('#scrollBottomBtn');
  const attachBtn = $('#attachBtn');
  const emojiBtn = $('#emojiBtn');
  const fileInput = $('#fileInput');
  const pendingFileEl = $('#pendingFile');
  const emojiPicker = $('#emojiPicker');
  const imageViewer = $('#imageViewer');
  const ivStrip = $('#ivStrip');
  const reactionPicker = $('#reactionPicker');
  const replyBar = $('#replyBar');
  const replyBarName = $('#replyBarName');
  const replyBarText = $('#replyBarText');
  const searchPanel = $('#searchPanel');
  const searchInput = $('#searchInput');
  const searchResults = $('#searchResults');
  const dragOverlay = $('#dragOverlay');
  const newChatModal = $('#newChatModal');
  const adminModal = $('#adminModal');
  const chatInfoModal = $('#chatInfoModal');
  const menuDrawer = $('#menuDrawer');
  const currentUserInfo = $('#currentUserInfo');
  const weatherWidget = $('#weatherWidget');
  const settingsModal = $('#settingsModal');
  const themeSettingsModal = $('#themeSettingsModal');
  const weatherSettingsModal = $('#weatherSettingsModal');
  const notificationSettingsModal = $('#notificationSettingsModal');
  const soundSettingsModal = $('#soundSettingsModal');
  const aiBotSettingsModal = $('#aiBotSettingsModal');
  const changePasswordModal = $('#changePasswordModal');
  const forwardMessageModal = $('#forwardMessageModal');
  const forwardChatSearch = $('#forwardChatSearch');
  const forwardChatList = $('#forwardChatList');
  const forwardMessageStatus = $('#forwardMessageStatus');

  function isMobileComposerKeyboardOpen() {
    if (window.innerWidth > 768) return false;
    if (window.visualViewport) {
      return window.innerHeight - window.visualViewport.height > 80;
    }
    return document.activeElement === msgInput;
  }

  function focusComposerKeepKeyboard(force = false) {
    if (!force && !isMobileComposerKeyboardOpen()) return;
    requestAnimationFrame(() => {
      try {
        msgInput.focus({ preventScroll: true });
      } catch {
        msgInput.focus();
      }
    });
  }

  function preventMobileComposerBlur(e) {
    if (!isMobileComposerKeyboardOpen()) return false;
    e.preventDefault();
    return true;
  }

  const appBridge = window.BananzaAppBridge = window.BananzaAppBridge || {};
  Object.assign(appBridge, {
    api: (url, opts) => api(url, opts),
    animateSendButton: () => animateSendButton(),
    autoResize: () => autoResize(),
    clearReply: () => clearReply(),
    closeAllModals: () => closeAllModals(),
    getToken: () => token || localStorage.getItem('token'),
    getCurrentUser: () => currentUser,
    getCurrentChatId: () => currentChatId,
    getPendingFiles: () => [...pendingFiles],
    getReplyTo: () => replyTo ? { ...replyTo } : null,
    getEditTo: () => editTo ? { ...editTo } : null,
    updateReplyPreview: (messageId, text) => {
      if (replyTo?.id === messageId && !editTo) {
        replyTo.text = text || '📎 Attachment';
        replyBarText.textContent = replyTo.text;
      }
    },
    scrollToBottom: (instant = false) => scrollToBottom(instant),
    playSound: (type, options) => playAppSound(type, options),
    getDom: () => ({
      sendBtn,
      msgInput,
      messagesEl,
      pendingFileEl,
      settingsModal,
      chatView,
    }),
    isMobileLayout: () => window.innerWidth <= 768,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════════════════════════════════════════
  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function linkify(text) {
    return esc(text).replace(
      /https?:\/\/[^\s<>"')\]]+/gi,
      (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
  }

  function mentionKey(value) {
    return String(value || '').replace(/^@+/, '').toLowerCase();
  }

  function renderMessageText(text, mentions = []) {
    const source = String(text || '');
    if (!source) return '';
    const mentionMap = new Map();
    (Array.isArray(mentions) ? mentions : []).forEach((mention) => {
      const token = mentionKey(mention.token || mention.mention || mention.username);
      if (token && !mentionMap.has(token)) mentionMap.set(token, mention);
    });
    const re = /(https?:\/\/[^\s<>"')\]]+)|@([a-zA-Z0-9_][a-zA-Z0-9_-]{0,31})/gi;
    let html = '';
    let lastIndex = 0;
    let match;
    while ((match = re.exec(source))) {
      html += esc(source.slice(lastIndex, match.index));
      if (match[1]) {
        const url = match[1];
        html += `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`;
      } else {
        const prev = match.index > 0 ? source[match.index - 1] : '';
        const token = mentionKey(match[2]);
        const mention = !prev || !/[A-Za-z0-9_.-]/.test(prev) ? mentionMap.get(token) : null;
        if (mention) {
          html += `<button type="button" class="mention-link${mention.is_ai_bot ? ' is-bot' : ''}" data-mention-user-id="${Number(mention.user_id) || 0}" data-mention-token="${esc(mention.token || mention.mention || mention.username || token)}" data-mention-bot="${mention.is_ai_bot ? '1' : '0'}">@${esc(match[2])}</button>`;
        } else {
          html += esc(match[0]);
        }
      }
      lastIndex = re.lastIndex;
    }
    html += esc(source.slice(lastIndex));
    return html;
  }

  function normalizeUiTheme(theme) {
    return UI_THEME_IDS.has(theme) ? theme : 'bananza';
  }

  function setThemeStatus(message, type = '') {
    const el = $('#settingsThemeStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function renderThemePicker() {
    const picker = $('#settingsThemePicker');
    if (!picker) return;
    picker.innerHTML = UI_THEMES.map(theme => `
      <button type="button" class="theme-card${theme.id === currentUiTheme ? ' active' : ''}" data-theme="${theme.id}">
        <span class="theme-card-swatches">
          <span style="background:${theme.colors[0]}"></span>
          <span style="background:${theme.colors[1]}"></span>
        </span>
        <span class="theme-card-copy">
          <strong>${esc(theme.name)}</strong>
          <small>${esc(theme.note)}</small>
        </span>
        <span class="theme-card-preview" aria-hidden="true">
          <i style="background:${theme.other}"></i>
          <i style="background:${theme.own}"></i>
        </span>
      </button>
    `).join('');
  }

  function applyUiTheme(theme, persist = true) {
    const nextTheme = normalizeUiTheme(theme);
    currentUiTheme = nextTheme;
    document.documentElement.dataset.uiTheme = nextTheme;
    if (currentUser) {
      currentUser.ui_theme = nextTheme;
      if (persist) localStorage.setItem('user', JSON.stringify(currentUser));
    }
    renderThemePicker();
  }

  async function selectUiTheme(theme) {
    const nextTheme = normalizeUiTheme(theme);
    if (nextTheme === currentUiTheme) return;
    const prevTheme = currentUiTheme;
    applyUiTheme(nextTheme);
    setThemeStatus('Saving...');
    try {
      const res = await api('/api/user/theme', { method: 'PATCH', body: { theme: nextTheme } });
      currentUser = { ...currentUser, ...res.user };
      applyUiTheme(currentUser.ui_theme);
      setThemeStatus('Saved', 'success');
      setTimeout(() => {
        if ($('#settingsThemeStatus')?.textContent === 'Saved') setThemeStatus('');
      }, 1200);
    } catch (e) {
      applyUiTheme(prevTheme);
      setThemeStatus(e.message || 'Theme save failed', 'error');
    }
  }

  let singleEmojiPattern = null;
  function getSingleEmojiPattern() {
    if (singleEmojiPattern !== null) return singleEmojiPattern;
    try {
      singleEmojiPattern = new RegExp(
        '^(?:' +
          '(?:\\p{Regional_Indicator}{2})|' +
          '(?:[0-9#*]\\uFE0F?\\u20E3)|' +
          '(?:\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:\\p{Emoji_Modifier})?(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:\\p{Emoji_Modifier})?)*)' +
        ')$',
        'u'
      );
    } catch {
      singleEmojiPattern = false;
    }
    return singleEmojiPattern;
  }

  function splitGraphemes(value) {
    if (window.Intl?.Segmenter) {
      return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), part => part.segment);
    }
    return Array.from(value);
  }

  function isSingleEmojiMessage(text) {
    const value = String(text || '').trim();
    if (!value) return false;
    const graphemes = splitGraphemes(value);
    if (graphemes.length !== 1) return false;
    const pattern = getSingleEmojiPattern();
    if (pattern) return pattern.test(graphemes[0]);
    return /^(?:[\u00A9\u00AE]|[\u203C-\u3299]\uFE0F?|[\uD800-\uDBFF][\uDC00-\uDFFF])$/.test(graphemes[0]);
  }

  function formatTime(iso) {
    const d = new Date(iso + 'Z');
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(iso) {
    const d = new Date(iso + 'Z');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function initials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2) || '?';
  }

  function avatarHtml(name, color, avatarUrl, size) {
    const cls = size === 'large' ? 'avatar-large' : 'avatar';
    if (avatarUrl) {
      return `<div class="${cls}" style="background:${color}"><img class="avatar-img" src="${esc(avatarUrl)}" alt="" loading="lazy" onerror="this.remove()"></div>`;
    }
    return `<div class="${cls}" style="background:${color}">${initials(name)}</div>`;
  }

  function updateCurrentUserFooter() {
    currentUserInfo.innerHTML = avatarHtml(currentUser.display_name, currentUser.avatar_color, currentUser.avatar_url, 28) +
      `<span class="current-user-name">${esc(currentUser.display_name)}</span>`;
  }

  function weatherLocationLabel(location) {
    if (!location) return '';
    return [location.name, location.admin1, location.country].filter(Boolean).join(', ');
  }

  function weatherIcon(code, isDay) {
    if (code === 0) return isDay ? '☀️' : '🌙';
    if (code === 1 || code === 2) return isDay ? '🌤️' : '☁️';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '🌧️';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '❄️';
    if (code >= 95) return '⛈️';
    return '🌡️';
  }

  function formatWeatherValue(value, fallback, precision = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const rounded = precision ? (Math.round(n * 10) / 10).toFixed(1) : String(Math.round(n));
    return rounded.replace(/\.0$/, '').replace('.', ',');
  }

  function renderWeatherWidget(data) {
    if (!weatherWidget) return;
    if (!weatherSettings.enabled || !weatherSettings.location) {
      weatherWidget.classList.add('hidden');
      return;
    }
    const temp = `${formatWeatherValue(data?.temperature, '--')}°`;
    const wind = `${formatWeatherValue(data?.wind_speed, '--', 1)} м/с`;
    const icon = data ? weatherIcon(Number(data.weather_code), data.is_day) : '⛅';
    weatherWidget.classList.remove('hidden', 'is-loading', 'is-error');
    if (!data) weatherWidget.classList.add('is-error');
    weatherWidget.title = data
      ? `Weather: ${weatherLocationLabel(weatherSettings.location)}`
      : 'Weather unavailable';
    weatherWidget.innerHTML = `<span class="weather-widget-icon">${icon}</span><span>${temp}</span><span>${wind}</span>`;
  }

  function setWeatherStatus(message, type = '') {
    const el = $('#settingsWeatherStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function renderWeatherSettingsForm(draft = {}) {
    const enabledInput = $('#settingsWeatherEnabled');
    const controls = $('#settingsWeatherControls');
    const refreshInput = $('#settingsWeatherRefresh');
    const selectedEl = $('#settingsWeatherSelected');
    if (!enabledInput || !controls || !refreshInput || !selectedEl) return;
    const enabled = draft.enabled ?? weatherSettings.enabled;
    enabledInput.checked = !!enabled;
    controls.classList.toggle('hidden', !enabledInput.checked);
    refreshInput.value = draft.refresh_minutes ?? weatherSettings.refresh_minutes ?? 30;
    selectedWeatherLocation = selectedWeatherLocation || weatherSettings.location;
    const label = weatherLocationLabel(selectedWeatherLocation);
    selectedEl.textContent = label ? `Selected: ${label}` : 'No city selected';
  }

  function renderWeatherSearchResults(results) {
    const wrap = $('#settingsWeatherResults');
    if (!wrap) return;
    weatherSearchResults = results || [];
    if (!weatherSearchResults.length) {
      wrap.classList.add('hidden');
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = weatherSearchResults.map((item, index) => {
      const title = esc(weatherLocationLabel(item));
      const details = [item.country_code, item.population ? `pop. ${item.population}` : '']
        .filter(Boolean).join(' · ');
      return `<button type="button" class="weather-result-item" data-index="${index}">
        <span>${title}</span>
        ${details ? `<small>${esc(details)}</small>` : ''}
      </button>`;
    }).join('');
    wrap.classList.remove('hidden');
  }

  function scheduleWeatherRefresh() {
    clearTimeout(weatherTimer);
    if (!weatherSettings.enabled || !weatherSettings.location) return;
    const minutes = Math.min(180, Math.max(10, Number(weatherSettings.refresh_minutes) || 30));
    weatherTimer = setTimeout(() => {
      loadCurrentWeather(false);
    }, minutes * 60 * 1000);
  }

  async function loadWeatherSettings() {
    try {
      const data = await api('/api/weather/settings');
      weatherSettings = data.settings || weatherSettings;
      selectedWeatherLocation = weatherSettings.location;
      weatherSettingsLoaded = true;
      renderWeatherSettingsForm();
    } catch {
      weatherSettingsLoaded = false;
    }
  }

  async function loadCurrentWeather(force = false) {
    clearTimeout(weatherTimer);
    if (!weatherSettings.enabled || !weatherSettings.location) {
      renderWeatherWidget(null);
      return;
    }
    weatherWidget?.classList.add('is-loading');
    try {
      const data = await api(`/api/weather/current${force ? '?force=1' : ''}`);
      if (!data || !data.enabled) {
        weatherSettings = data?.settings || weatherSettings;
        weatherSettingsLoaded = true;
        renderWeatherWidget(null);
        return;
      }
      weatherSettings = data.settings || weatherSettings;
      selectedWeatherLocation = weatherSettings.location;
      weatherSettingsLoaded = true;
      renderWeatherWidget(data);
      renderWeatherSettingsForm();
      setWeatherStatus(force ? `Updated ${new Date(data.fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '', 'success');
    } catch (e) {
      renderWeatherWidget(null);
      if (force) setWeatherStatus(e.message || 'Weather update failed', 'error');
    } finally {
      weatherWidget?.classList.remove('is-loading');
      scheduleWeatherRefresh();
    }
  }

  async function searchWeatherLocations() {
    const input = $('#settingsWeatherSearch');
    if (!input) return;
    const q = input.value.trim();
    if (q.length < 2) {
      renderWeatherSearchResults([]);
      setWeatherStatus('Type at least 2 characters');
      return;
    }
    setWeatherStatus('Searching...');
    try {
      const data = await api(`/api/weather/search?q=${encodeURIComponent(q)}`);
      renderWeatherSearchResults(data.results || []);
      setWeatherStatus(data.results?.length ? '' : 'No cities found');
    } catch (e) {
      renderWeatherSearchResults([]);
      setWeatherStatus(e.message || 'Weather search failed', 'error');
    }
  }

  async function saveWeatherSettings() {
    const enabled = !!$('#settingsWeatherEnabled')?.checked;
    const refreshInput = $('#settingsWeatherRefresh');
    const refreshMinutes = Math.min(180, Math.max(10, Number(refreshInput?.value) || 30));
    const location = selectedWeatherLocation || weatherSettings.location;
    if (enabled && !location) {
      setWeatherStatus('Choose a city first', 'error');
      return;
    }
    setWeatherStatus('Saving...');
    try {
      const data = await api('/api/weather/settings', {
        method: 'PUT',
        body: { enabled, location, refresh_minutes: refreshMinutes },
      });
      weatherSettings = data.settings || weatherSettings;
      selectedWeatherLocation = weatherSettings.location;
      weatherSettingsLoaded = true;
      renderWeatherSettingsForm();
      setWeatherStatus('Saved', 'success');
      if (weatherSettings.enabled) await loadCurrentWeather(true);
      else {
        clearTimeout(weatherTimer);
        renderWeatherWidget(null);
      }
    } catch (e) {
      setWeatherStatus(e.message || 'Weather settings save failed', 'error');
    }
  }

  function isLocalhost() {
    return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  }

  function isPushSupported() {
    return Boolean(
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      (location.protocol === 'https:' || isLocalhost())
    );
  }

  function setNotificationStatus(message, type = '') {
    const el = $('#settingsNotificationsStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function notificationPermissionLabel() {
    if (!('Notification' in window)) return 'не поддерживается';
    if (Notification.permission === 'granted') return 'разрешены';
    if (Notification.permission === 'denied') return 'запрещены в браузере';
    return 'ещё не запрашивались';
  }

  function renderNotificationSettingsForm() {
    const supportEl = $('#settingsNotificationsSupport');
    const enabledInput = $('#settingsNotificationsEnabled');
    const messagesInput = $('#settingsNotifyMessages');
    const invitesInput = $('#settingsNotifyChatInvites');
    const reactionsInput = $('#settingsNotifyReactions');
    const mentionsInput = $('#settingsNotifyMentions');
    const enableBtn = $('#settingsPushEnable');
    const disableBtn = $('#settingsPushDisable');
    const testBtn = $('#settingsPushTest');
    if (!supportEl || !enabledInput || !messagesInput || !invitesInput || !reactionsInput) return;

    const supported = isPushSupported();
    supportEl.classList.toggle('is-ready', supported && Notification.permission === 'granted' && pushDeviceSubscribed);
    supportEl.classList.toggle('is-error', !supported || Notification.permission === 'denied');
    supportEl.textContent = supported
      ? `Статус: ${notificationPermissionLabel()}. Это устройство ${pushDeviceSubscribed ? 'подписано' : 'не подписано'}.`
      : 'Web Push недоступен: нужен HTTPS и браузер с Service Worker/Push API.';

    enabledInput.checked = !!notificationSettings.push_enabled;
    messagesInput.checked = !!notificationSettings.notify_messages;
    invitesInput.checked = !!notificationSettings.notify_chat_invites;
    reactionsInput.checked = !!notificationSettings.notify_reactions;
    if (mentionsInput) mentionsInput.checked = notificationSettings.notify_mentions !== false;

    if (enableBtn) enableBtn.disabled = !supported || Notification.permission === 'denied';
    if (disableBtn) disableBtn.disabled = !supported || !pushDeviceSubscribed;
    if (testBtn) testBtn.disabled = !supported || !pushDeviceSubscribed;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  async function ensurePushRegistration() {
    if (!isPushSupported()) throw new Error('Web Push недоступен в этом браузере или без HTTPS');
    return navigator.serviceWorker.register('/sw.js');
  }

  async function refreshPushDeviceState() {
    if (!isPushSupported()) {
      pushDeviceSubscribed = false;
      renderNotificationSettingsForm();
      return false;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      pushDeviceSubscribed = !!subscription;
    } catch {
      pushDeviceSubscribed = false;
    }
    renderNotificationSettingsForm();
    return pushDeviceSubscribed;
  }

  async function loadNotificationSettings() {
    try {
      const data = await api('/api/notification-settings');
      notificationSettings = data.settings || notificationSettings;
      notificationSettingsLoaded = true;
    } catch {
      notificationSettingsLoaded = false;
    }
    await refreshPushDeviceState();
  }

  async function saveNotificationSettings(patch = {}) {
    const next = {
      ...notificationSettings,
      ...patch,
      notify_messages: $('#settingsNotifyMessages')?.checked ?? notificationSettings.notify_messages,
      notify_chat_invites: $('#settingsNotifyChatInvites')?.checked ?? notificationSettings.notify_chat_invites,
      notify_reactions: $('#settingsNotifyReactions')?.checked ?? notificationSettings.notify_reactions,
      notify_mentions: $('#settingsNotifyMentions')?.checked ?? notificationSettings.notify_mentions,
    };
    if (Object.prototype.hasOwnProperty.call(patch, 'push_enabled')) {
      next.push_enabled = !!patch.push_enabled;
    } else {
      next.push_enabled = $('#settingsNotificationsEnabled')?.checked ?? notificationSettings.push_enabled;
    }
    setNotificationStatus('Сохраняю...');
    try {
      const data = await api('/api/notification-settings', { method: 'PUT', body: next });
      notificationSettings = data.settings || next;
      notificationSettingsLoaded = true;
      renderNotificationSettingsForm();
      setNotificationStatus('Сохранено', 'success');
    } catch (e) {
      setNotificationStatus(e.message || 'Не удалось сохранить уведомления', 'error');
      renderNotificationSettingsForm();
    }
  }

  async function enablePushNotifications() {
    if (!isPushSupported()) {
      setNotificationStatus('Web Push недоступен: нужен HTTPS и поддержка браузера', 'error');
      renderNotificationSettingsForm();
      return;
    }
    try {
      setNotificationStatus('Запрашиваю разрешение...');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setNotificationStatus('Уведомления запрещены в браузере', 'error');
        renderNotificationSettingsForm();
        return;
      }

      const registration = await ensurePushRegistration();
      const keyData = await api('/api/push/vapid-public-key');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        });
      }
      const data = await api('/api/push/subscribe', {
        method: 'POST',
        body: { subscription: subscription.toJSON() },
      });
      notificationSettings = data.settings || { ...notificationSettings, push_enabled: true };
      pushDeviceSubscribed = true;
      renderNotificationSettingsForm();
      setNotificationStatus('Уведомления включены на этом устройстве', 'success');
    } catch (e) {
      setNotificationStatus(e.message || 'Не удалось включить уведомления', 'error');
      await refreshPushDeviceState();
    }
  }

  async function disablePushOnThisDevice() {
    if (!isPushSupported()) return;
    try {
      setNotificationStatus('Отключаю устройство...');
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api('/api/push/subscribe', {
          method: 'DELETE',
          body: { endpoint: subscription.endpoint },
        });
        await subscription.unsubscribe();
      }
      pushDeviceSubscribed = false;
      renderNotificationSettingsForm();
      setNotificationStatus('Это устройство отключено', 'success');
    } catch (e) {
      setNotificationStatus(e.message || 'Не удалось отключить устройство', 'error');
      await refreshPushDeviceState();
    }
  }

  async function testPushNotification() {
    try {
      setNotificationStatus('Отправляю тест...');
      const data = await api('/api/push/test', {
        method: 'POST',
        body: { chatId: currentChatId || null },
      });
      setNotificationStatus(data.sent > 0 ? 'Тестовое уведомление отправлено' : 'Тест не отправлен', data.sent > 0 ? 'success' : 'error');
    } catch (e) {
      setNotificationStatus(e.message || 'Не удалось отправить тест', 'error');
    }
  }

  function applySoundSettings(next = {}) {
    soundSettings = {
      ...soundSettings,
      ...next,
      volume: Math.min(100, Math.max(0, Math.round(Number(next.volume ?? soundSettings.volume) || 0))),
    };
    window.BananzaSounds?.configure?.(soundSettings);
    renderSoundSettingsForm();
  }

  function setSoundStatus(message, type = '') {
    const el = $('#settingsSoundsStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function renderSoundSettingsForm() {
    const fields = {
      settingsSoundsEnabled: soundSettings.sounds_enabled,
      settingsSoundSend: soundSettings.play_send,
      settingsSoundIncoming: soundSettings.play_incoming,
      settingsSoundNotifications: soundSettings.play_notifications,
      settingsSoundReactions: soundSettings.play_reactions,
      settingsSoundInvites: soundSettings.play_invites,
      settingsSoundVoice: soundSettings.play_voice,
      settingsSoundMentions: soundSettings.play_mentions,
    };
    Object.entries(fields).forEach(([id, checked]) => {
      const input = document.getElementById(id);
      if (input) input.checked = !!checked;
    });
    const volumeInput = $('#settingsSoundsVolume');
    const volumeLabel = $('#settingsSoundsVolumeValue');
    if (volumeInput) volumeInput.value = soundSettings.volume;
    if (volumeLabel) volumeLabel.textContent = `${soundSettings.volume}%`;
  }

  function getSoundSettingsFromForm() {
    return {
      sounds_enabled: $('#settingsSoundsEnabled')?.checked ?? soundSettings.sounds_enabled,
      volume: Number($('#settingsSoundsVolume')?.value ?? soundSettings.volume),
      play_send: $('#settingsSoundSend')?.checked ?? soundSettings.play_send,
      play_incoming: $('#settingsSoundIncoming')?.checked ?? soundSettings.play_incoming,
      play_notifications: $('#settingsSoundNotifications')?.checked ?? soundSettings.play_notifications,
      play_reactions: $('#settingsSoundReactions')?.checked ?? soundSettings.play_reactions,
      play_invites: $('#settingsSoundInvites')?.checked ?? soundSettings.play_invites,
      play_voice: $('#settingsSoundVoice')?.checked ?? soundSettings.play_voice,
      play_mentions: $('#settingsSoundMentions')?.checked ?? soundSettings.play_mentions,
    };
  }

  async function loadSoundSettings() {
    try {
      const data = await api('/api/sound-settings');
      applySoundSettings(data.settings || soundSettings);
      soundSettingsLoaded = true;
    } catch {
      soundSettingsLoaded = false;
      window.BananzaSounds?.configure?.(soundSettings);
    }
  }

  async function saveSoundSettings(patch = {}, { silent = false } = {}) {
    clearTimeout(soundSettingsSaveTimer);
    const next = { ...getSoundSettingsFromForm(), ...patch };
    applySoundSettings(next);
    if (!silent) setSoundStatus('Сохраняю...');
    try {
      const data = await api('/api/sound-settings', { method: 'PUT', body: next });
      applySoundSettings(data.settings || next);
      soundSettingsLoaded = true;
      if (!silent) setSoundStatus('Сохранено', 'success');
    } catch (e) {
      setSoundStatus(e.message || 'Не удалось сохранить звуки', 'error');
      renderSoundSettingsForm();
    }
  }

  function scheduleSoundSettingsSave(patch = {}) {
    clearTimeout(soundSettingsSaveTimer);
    applySoundSettings({ ...getSoundSettingsFromForm(), ...patch });
    soundSettingsSaveTimer = setTimeout(() => {
      saveSoundSettings({}, { silent: true }).catch(() => {});
    }, 350);
  }

  function playAppSound(type, options = {}) {
    if (document.hidden && !options.allowHidden) return false;
    return window.BananzaSounds?.play?.(type, options) || false;
  }

  function previewSound(type) {
    window.BananzaSounds?.configure?.(getSoundSettingsFromForm());
    window.BananzaSounds?.preview?.(type);
  }

  function previewAllSounds() {
    const sequence = ['send', 'incoming', 'notification', 'mention', 'reaction', 'invite', 'voice_start', 'voice_stop'];
    sequence.forEach((type, index) => {
      if (index === 0) {
        previewSound(type);
        return;
      }
      setTimeout(() => previewSound(type), index * 360);
    });
  }

  function localChatPreferenceEnabled(value) {
    return value !== false && value !== 0;
  }

  function getChatById(chatId) {
    const id = Number(chatId);
    return chats.find(c => c.id === id) || null;
  }

  function isChatNotificationEnabled(chatId) {
    const chat = getChatById(chatId);
    return chat ? localChatPreferenceEnabled(chat.notify_enabled) : true;
  }

  function isChatIncomingSoundEnabled(chatId) {
    const chat = getChatById(chatId);
    return Boolean(soundSettings.sounds_enabled && (!chat || localChatPreferenceEnabled(chat.sounds_enabled)));
  }

  function isMentionSoundEnabled() {
    return Boolean(soundSettings.sounds_enabled && soundSettings.play_mentions !== false);
  }

  function isMessageMentioningCurrentUser(message) {
    if (message?.forwarded_from_message_id) return false;
    const userId = Number(currentUser?.id);
    return Boolean(userId && Array.isArray(message?.mentions) && message.mentions.some(mention => Number(mention.user_id) === userId));
  }

  function setChatPreferencesStatus(message, type = '') {
    const el = $('#chatPreferencesStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function renderChatPreferencesForm(chat) {
    const notifyToggle = $('#chatNotifyToggle');
    const soundToggle = $('#chatSoundToggle');
    if (!notifyToggle || !soundToggle) return;
    notifyToggle.checked = localChatPreferenceEnabled(chat?.notify_enabled);
    soundToggle.checked = localChatPreferenceEnabled(chat?.sounds_enabled);
    $('#chatNotifyHint')?.classList.toggle('hidden', !!notificationSettings.push_enabled);
    $('#chatSoundHint')?.classList.toggle('hidden', !!soundSettings.sounds_enabled);
  }

  async function loadChatPreferences(chatId) {
    const chat = getChatById(chatId);
    renderChatPreferencesForm(chat);
    setChatPreferencesStatus('');
    try {
      const data = await api(`/api/chats/${chatId}/preferences`);
      const preferences = data.preferences || data;
      if (chat) Object.assign(chat, preferences);
      renderChatPreferencesForm(chat || preferences);
    } catch (e) {
      setChatPreferencesStatus(e.message || 'Не удалось загрузить настройки чата', 'error');
    }
  }

  async function saveChatPreferences() {
    if (!currentChatId) return;
    const chat = getChatById(currentChatId);
    const next = {
      notify_enabled: $('#chatNotifyToggle')?.checked ?? true,
      sounds_enabled: $('#chatSoundToggle')?.checked ?? true,
    };
    if (chat) Object.assign(chat, next);
    renderChatPreferencesForm(chat || next);
    setChatPreferencesStatus('Сохраняю...');
    try {
      const data = await api(`/api/chats/${currentChatId}/preferences`, { method: 'PUT', body: next });
      const preferences = data.preferences || next;
      if (chat) Object.assign(chat, preferences);
      renderChatPreferencesForm(chat || preferences);
      setChatPreferencesStatus('Сохранено', 'success');
    } catch (e) {
      setChatPreferencesStatus(e.message || 'Не удалось сохранить настройки чата', 'error');
      if (chat) await loadChatPreferences(currentChatId);
    }
  }

  function setAiBotStatus(message, type = '') {
    const el = $('#aiBotsStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function mergeAiBotState(data = {}) {
    if (data.state) {
      aiBotState = {
        settings: data.state.settings || aiBotState.settings,
        bots: data.state.bots || aiBotState.bots,
        chats: data.state.chats || aiBotState.chats,
        chatSettings: data.state.chatSettings || aiBotState.chatSettings,
      };
    } else if (data.settings) {
      aiBotState = { ...aiBotState, settings: { ...aiBotState.settings, ...data.settings } };
    }
    if (selectedAiBotId && !aiBotState.bots.some(bot => Number(bot.id) === Number(selectedAiBotId))) {
      selectedAiBotId = null;
    }
    mentionTargetsByChat.clear();
  }

  function currentAiBot() {
    return aiBotState.bots.find(bot => bot.id === selectedAiBotId) || null;
  }

  function getAiChatSetting(chatId, botId) {
    return aiBotState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
  }

  function fillAiBotForm(bot = null) {
    const settings = aiBotState.settings || {};
    selectedAiBotId = bot ? bot.id : null;
    $('#aiBotName').value = bot?.name || 'Bananza AI';
    $('#aiBotMention').value = bot?.mention || 'bananza';
    $('#aiBotEnabled').checked = bot ? !!bot.enabled : true;
    $('#aiBotResponseModel').value = bot?.response_model || settings.default_response_model || 'gpt-4o-mini';
    $('#aiBotSummaryModel').value = bot?.summary_model || settings.default_summary_model || 'gpt-4o-mini';
    $('#aiBotEmbeddingModel').value = bot?.embedding_model || settings.default_embedding_model || 'text-embedding-3-small';
    $('#aiBotStyle').value = bot?.style || 'Полезный AI-помощник для чата';
    $('#aiBotTone').value = bot?.tone || 'тёплый, внимательный, краткий';
    $('#aiBotRules').value = bot?.behavior_rules || '';
    $('#aiBotSpeech').value = bot?.speech_patterns || '';
    renderAiBotList();
    renderAiChatBotSettings();
  }

  function aiBotFormPayload() {
    return {
      name: $('#aiBotName')?.value.trim(),
      mention: $('#aiBotMention')?.value.trim(),
      enabled: $('#aiBotEnabled')?.checked,
      response_model: $('#aiBotResponseModel')?.value.trim(),
      summary_model: $('#aiBotSummaryModel')?.value.trim(),
      embedding_model: $('#aiBotEmbeddingModel')?.value.trim(),
      style: $('#aiBotStyle')?.value.trim(),
      tone: $('#aiBotTone')?.value.trim(),
      behavior_rules: $('#aiBotRules')?.value.trim(),
      speech_patterns: $('#aiBotSpeech')?.value.trim(),
    };
  }

  function renderAiBotList() {
    const list = $('#aiBotList');
    if (!list) return;
    if (!aiBotState.bots.length) {
      list.innerHTML = '<div class="ai-bot-empty">Ботов пока нет. Создайте первого бота.</div>';
      return;
    }
    list.innerHTML = aiBotState.bots.map(bot => `
      <button type="button" class="ai-bot-list-item${bot.id === selectedAiBotId ? ' active' : ''}" data-bot-id="${bot.id}">
        <span><strong>${esc(bot.name)}</strong><small>@${esc(bot.mention)} · ${bot.enabled ? 'enabled' : 'disabled'}</small></span>
        <span>${bot.response_model ? esc(bot.response_model) : ''}</span>
      </button>
    `).join('');
  }

  function renderAiChatBotSettings() {
    const chatSelect = $('#aiBotChatSelect');
    const botSelect = $('#aiBotChatBotSelect');
    if (!chatSelect || !botSelect) return;
    const currentChatValue = chatSelect.value || String(currentChatId || aiBotState.chats[0]?.id || '');
    const currentBotValue = botSelect.value || String(selectedAiBotId || aiBotState.bots[0]?.id || '');

    chatSelect.innerHTML = aiBotState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
    botSelect.innerHTML = aiBotState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
    if (aiBotState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
    if (aiBotState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
    if (!botSelect.value && aiBotState.bots[0]) botSelect.value = String(aiBotState.bots[0].id);

    const setting = getAiChatSetting(chatSelect.value, botSelect.value);
    $('#aiBotChatEnabled').checked = !!setting?.enabled;
    $('#aiBotChatMode').value = setting?.mode || 'simple';
    $('#aiBotChatHotLimit').value = setting?.hot_context_limit || 50;
  }

  function renderAiBotSettings() {
    const settings = aiBotState.settings || {};
    $('#aiBotsGlobalEnabled').checked = !!settings.enabled;
    $('#aiBotsDefaultResponseModel').value = settings.default_response_model || 'gpt-4o-mini';
    $('#aiBotsDefaultSummaryModel').value = settings.default_summary_model || 'gpt-4o-mini';
    $('#aiBotsDefaultEmbeddingModel').value = settings.default_embedding_model || 'text-embedding-3-small';
    $('#aiBotsChunkSize').value = settings.chunk_size || 50;
    $('#aiBotsRetrievalTopK').value = settings.retrieval_top_k || 6;
    $('#aiBotsApiKey').value = '';
    $('#aiBotsKeyStatus').textContent = settings.has_openai_key
      ? `Ключ сохранён: ${settings.masked_openai_key || '***'}`
      : 'Ключ не сохранён';

    const selected = currentAiBot() || aiBotState.bots[0] || null;
    fillAiBotForm(selected);
    renderAiChatBotSettings();
  }

  function aiBotSettingsPayload() {
    const body = {
      enabled: $('#aiBotsGlobalEnabled')?.checked,
      default_response_model: $('#aiBotsDefaultResponseModel')?.value.trim(),
      default_summary_model: $('#aiBotsDefaultSummaryModel')?.value.trim(),
      default_embedding_model: $('#aiBotsDefaultEmbeddingModel')?.value.trim(),
      chunk_size: Number($('#aiBotsChunkSize')?.value || 50),
      retrieval_top_k: Number($('#aiBotsRetrievalTopK')?.value || 6),
    };
    const key = $('#aiBotsApiKey')?.value.trim();
    if (key) body.openai_api_key = key;
    return body;
  }

  async function persistAiBotSettings() {
    const data = await api('/api/admin/ai-bots/settings', {
      method: 'PUT',
      body: aiBotSettingsPayload(),
    });
    mergeAiBotState(data);
    return data;
  }

  async function loadAiBotState() {
    const data = await api('/api/admin/ai-bots');
    mergeAiBotState({ state: data });
    renderAiBotSettings();
  }

  async function saveAiBotSettings() {
    setAiBotStatus('Сохраняю...');
    try {
      await persistAiBotSettings();
      renderAiBotSettings();
      setAiBotStatus('Настройки сохранены', 'success');
    } catch (e) {
      setAiBotStatus(e.message || 'Не удалось сохранить настройки', 'error');
    }
  }

  async function deleteAiBotKey() {
    if (!confirm('Удалить OpenAI API key для AI-ботов?')) return;
    try {
      const data = await api('/api/admin/ai-bots/openai-key', { method: 'DELETE' });
      mergeAiBotState(data);
      renderAiBotSettings();
      setAiBotStatus('Ключ удалён', 'success');
    } catch (e) {
      setAiBotStatus(e.message || 'Не удалось удалить ключ', 'error');
    }
  }

  async function saveAiBot() {
    const payload = aiBotFormPayload();
    if (!payload.name) { setAiBotStatus('Введите имя бота', 'error'); return; }
    setAiBotStatus('Сохраняю бота...');
    try {
      await persistAiBotSettings();
      const shouldUpdate = Boolean(selectedAiBotId && aiBotState.bots.some(bot => Number(bot.id) === Number(selectedAiBotId)));
      const url = shouldUpdate ? `/api/admin/ai-bots/${selectedAiBotId}` : '/api/admin/ai-bots';
      const method = shouldUpdate ? 'PUT' : 'POST';
      const data = await api(url, { method, body: payload });
      mergeAiBotState(data);
      selectedAiBotId = data.bot?.id || selectedAiBotId;
      renderAiBotSettings();
      setAiBotStatus('Бот сохранён', 'success');
    } catch (e) {
      setAiBotStatus(e.message || 'Не удалось сохранить бота', 'error');
    }
  }

  async function disableAiBot() {
    if (!selectedAiBotId) return;
    if (!confirm('Отключить этого бота во всех чатах?')) return;
    try {
      const data = await api(`/api/admin/ai-bots/${selectedAiBotId}`, { method: 'DELETE' });
      mergeAiBotState(data);
      renderAiBotSettings();
      setAiBotStatus('Бот отключён', 'success');
    } catch (e) {
      setAiBotStatus(e.message || 'Не удалось отключить бота', 'error');
    }
  }

  async function testAiBot() {
    if (!selectedAiBotId) { setAiBotStatus('Сначала сохраните бота', 'error'); return; }
    setAiBotStatus('Проверяю модель...');
    try {
      const data = await api(`/api/admin/ai-bots/${selectedAiBotId}/test`, { method: 'POST', body: {} });
      const text = data.result?.text ? data.result.text.slice(0, 500) : '';
      setAiBotStatus(`Успешно (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
    } catch (e) {
      setAiBotStatus(e.message || 'Проверка не удалась', 'error');
    }
  }

  async function saveAiChatBotSettings() {
    const chatId = Number($('#aiBotChatSelect')?.value || 0);
    const botId = Number($('#aiBotChatBotSelect')?.value || 0);
    const botExists = aiBotState.bots.some(bot => Number(bot.id) === botId);
    if (!chatId || !botId) { setAiBotStatus('Выберите чат и бота', 'error'); return; }
    if (!botExists) {
      setAiBotStatus('Сначала сохраните бота', 'error');
      await loadAiBotState().catch(() => {});
      return;
    }
    try {
      await persistAiBotSettings();
      const data = await api('/api/admin/ai-bots/chat-settings', {
        method: 'PUT',
        body: {
          chatId,
          botId,
          enabled: $('#aiBotChatEnabled')?.checked,
          mode: $('#aiBotChatMode')?.value || 'simple',
          hot_context_limit: Number($('#aiBotChatHotLimit')?.value || 50),
        },
      });
      mergeAiBotState(data);
      renderAiChatBotSettings();
      setAiBotStatus('Настройки чата сохранены', 'success');
    } catch (e) {
      setAiBotStatus(e.message || 'Не удалось сохранить настройки чата', 'error');
    }
  }

  async function openChatFromPush(chatId) {
    const id = Number(chatId);
    if (!Number.isInteger(id) || id <= 0) return;
    if (!chats.find(c => c.id === id)) await loadChats();
    if (chats.find(c => c.id === id)) await openChat(id);
  }

  function handleServiceWorkerMessage(event) {
    const data = event.data || {};
    if (data.type === 'open_chat') {
      openChatFromPush(data.chatId).catch(() => {});
    }
  }

  function chatItemAvatarHtml(chat) {
    if (chat.type === 'private' && chat.private_user) {
      const u = chat.private_user;
      if (u.avatar_url) {
        return `<div class="chat-item-avatar" style="background:${u.avatar_color}"><img class="avatar-img" src="${esc(u.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">`;
      }
      return `<div class="chat-item-avatar" style="background:${u.avatar_color}">${initials(chat.name)}`;
    }
    if (chat.avatar_url) {
      return `<div class="chat-item-avatar" style="background:#5eb5f7"><img class="avatar-img" src="${esc(chat.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">`;
    }
    const icon = chat.type === 'general' ? '🌐' : '👥';
    return `<div class="chat-item-avatar" style="background:#5eb5f7">${icon}`;
  }

  function getChatLastPreviewText(chat) {
    if (chat.last_text) {
      return (chat.last_user ? chat.last_user + ': ' : '') + chat.last_text;
    }
    if (chat.last_file_id) {
      return (chat.last_user ? chat.last_user + ': ' : '') + '📎 File';
    }
    return '';
  }

  function getChatSearchHaystack(chat) {
    return [
      chat?.name || '',
      chat?.private_user?.display_name || '',
      chat?.private_user?.username || '',
    ].join(' ').toLowerCase();
  }

  function setForwardMessageStatus(message = '', type = '') {
    if (!forwardMessageStatus) return;
    forwardMessageStatus.textContent = message;
    forwardMessageStatus.classList.toggle('hidden', !message);
    forwardMessageStatus.classList.toggle('is-error', type === 'error');
    forwardMessageStatus.classList.toggle('is-success', type === 'success');
  }

  function resetForwardMessageModal() {
    forwardMessageState = null;
    forwardMessageBusy = false;
    if (forwardChatSearch) forwardChatSearch.value = '';
    if (forwardChatList) forwardChatList.innerHTML = '';
    setForwardMessageStatus('');
  }

  function showCenterToast(message) {
    let toast = document.getElementById('centerToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'centerToast';
      toast.className = 'center-toast';
      document.body.appendChild(toast);
    }
    clearTimeout(centerToastTimer);
    toast.textContent = message;
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    centerToastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2000);
  }

  function closeForwardMessageModal({ animate = false } = {}) {
    if (!forwardMessageModal) {
      resetForwardMessageModal();
      return;
    }

    clearTimeout(forwardModalCloseTimer);
    if (forwardMessageModal.classList.contains('hidden')) {
      forwardMessageModal.classList.remove('is-closing');
      resetForwardMessageModal();
      return;
    }

    if (!animate) {
      forwardMessageModal.classList.add('hidden');
      forwardMessageModal.classList.remove('is-closing');
      resetForwardMessageModal();
      return;
    }

    forwardMessageModal.classList.add('is-closing');
    forwardModalCloseTimer = setTimeout(() => {
      forwardMessageModal.classList.add('hidden');
      forwardMessageModal.classList.remove('is-closing');
      resetForwardMessageModal();
    }, 180);
  }

  function renderForwardChatList(filter = '') {
    if (!forwardChatList) return;
    const query = String(filter || '').trim().toLowerCase();
    const filtered = query
      ? chats.filter(chat => getChatSearchHaystack(chat).includes(query))
      : chats;

    if (filtered.length === 0) {
      forwardChatList.innerHTML = '<div class="forward-empty-state">Подходящих чатов не найдено</div>';
      return;
    }

    forwardChatList.innerHTML = filtered.map((chat) => {
      const isOnline = chat.type === 'private' && chat.private_user && onlineUsers.has(chat.private_user.id);
      const lastMsg = getChatLastPreviewText(chat);
      const lastTime = chat.last_time ? formatTime(chat.last_time) : '';
      return `
        <button type="button" class="chat-item forward-chat-item${chat.id === currentChatId ? ' is-current' : ''}" data-chat-id="${chat.id}">
          ${chatItemAvatarHtml(chat)}
            ${isOnline ? '<div class="online-dot"></div>' : ''}
          </div>
          <div class="chat-item-body">
            <div class="chat-item-top">
              <span class="chat-item-name">${esc(chat.name)}</span>
              <span class="chat-item-time">${lastTime}</span>
            </div>
            <div class="chat-item-last"><span>${esc(lastMsg).substring(0, 60) || 'Без сообщений'}</span></div>
          </div>
        </button>
      `;
    }).join('');
  }

  function openForwardMessageModal(message) {
    if (!message?.id) return;
    hideReactionPicker();
    closeAllModals();
    clearTimeout(forwardModalCloseTimer);
    forwardMessageModal?.classList.remove('is-closing');
    forwardMessageState = { id: message.id };
    renderForwardChatList();
    forwardMessageModal?.classList.remove('hidden');
    forwardChatSearch?.focus();
  }

  async function forwardMessageToChat(targetChatId) {
    if (!forwardMessageState?.id || !targetChatId || forwardMessageBusy) return;
    forwardMessageBusy = true;
    setForwardMessageStatus('Пересылаю...');
    try {
      await api(`/api/messages/${forwardMessageState.id}/forward`, {
        method: 'POST',
        body: { targetChatId },
      });
      closeAllModals();
      showCenterToast('Сообщение переслано');
      playAppSound('send');
      if (targetChatId === currentChatId) scrollToBottom();
    } catch (e) {
      setForwardMessageStatus(e.message || 'Не удалось переслать сообщение', 'error');
    } finally {
      forwardMessageBusy = false;
    }
  }

  async function api(url, opts = {}) {
    const headers = { ...opts.headers };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (opts.body && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 204) return null;
    const contentType = res.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const rawText = await res.text();
      const plainText = rawText
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      data = { error: plainText || res.statusText || 'Unexpected server response' };
    }
    if (!res.ok) {
      if (res.status === 401) { logout(); return; }
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    if (!contentType.includes('application/json')) {
      throw new Error(data?.error || 'Unexpected server response');
    }
    return data;
  }

  function normalizeMentionTarget(raw) {
    if (!raw) return null;
    const token = String(raw.token || raw.mention || raw.username || '').replace(/^@+/, '').trim();
    if (!token) return null;
    return {
      ...raw,
      token,
      mention: token,
      user_id: Number(raw.user_id) || 0,
      is_ai_bot: Boolean(raw.is_ai_bot),
    };
  }

  async function loadMentionTargets(chatId = currentChatId) {
    const id = Number(chatId);
    if (!id) return [];
    if (mentionTargetsByChat.has(id)) return mentionTargetsByChat.get(id);
    const data = await api(`/api/chats/${id}/mention-targets`);
    const targets = (data.targets || []).map(normalizeMentionTarget).filter(Boolean);
    mentionTargetsByChat.set(id, targets);
    return targets;
  }

  function ensureMentionPicker() {
    let picker = $('#mentionPicker');
    if (picker) return picker;
    picker = document.createElement('div');
    picker.id = 'mentionPicker';
    picker.className = 'mention-picker hidden';
    document.body.appendChild(picker);
    picker.addEventListener('pointerdown', (e) => {
      const item = e.target.closest('.mention-picker-item');
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      const target = mentionPickerState.targets[Number(item.dataset.index)];
      if (target) insertMentionTarget(target);
    }, { passive: false });
    return picker;
  }

  function hideMentionPicker() {
    mentionPickerState = { active: false, start: 0, end: 0, selected: 0, targets: [] };
    $('#mentionPicker')?.classList.add('hidden');
  }

  function findMentionTrigger() {
    if (!currentChatId || !msgInput) return null;
    const value = msgInput.value || '';
    const cursor = msgInput.selectionStart ?? value.length;
    const left = value.slice(0, cursor);
    const match = left.match(/(^|\s)@([a-zA-Z0-9_-]{0,32})$/);
    if (!match) return null;
    const atIndex = cursor - match[2].length - 1;
    const prev = atIndex > 0 ? value[atIndex - 1] : '';
    if (prev && !/\s/.test(prev)) return null;
    return { start: atIndex, end: cursor, query: match[2].toLowerCase() };
  }

  function positionMentionPicker() {
    const picker = $('#mentionPicker');
    if (!picker || picker.classList.contains('hidden')) return;
    const rect = msgInput.getBoundingClientRect();
    const vv = window.visualViewport;
    const viewportLeft = vv ? vv.offsetLeft : 0;
    const viewportTop = vv ? vv.offsetTop : 0;
    const viewportWidth = vv ? vv.width : window.innerWidth;
    const viewportHeight = vv ? vv.height : window.innerHeight;
    const width = Math.min(Math.max(rect.width, 240), viewportWidth - 16);
    picker.style.width = `${width}px`;
    const height = picker.offsetHeight || 180;
    const left = Math.max(viewportLeft + 8, Math.min(rect.left + viewportLeft, viewportLeft + viewportWidth - width - 8));
    const top = Math.max(viewportTop + 8, Math.min(rect.top + viewportTop - height - 8, viewportTop + viewportHeight - height - 8));
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
  }

  function renderMentionPicker(targets) {
    const picker = ensureMentionPicker();
    if (!targets.length) {
      hideMentionPicker();
      return;
    }
    mentionPickerState.targets = targets;
    mentionPickerState.selected = Math.min(mentionPickerState.selected, targets.length - 1);
    picker.innerHTML = targets.map((target, index) => `
      <button type="button" class="mention-picker-item${index === mentionPickerState.selected ? ' active' : ''}" data-index="${index}">
        <span class="mention-picker-avatar" style="background:${esc(target.avatar_color || '#65aadd')}">${target.avatar_url ? `<img src="${esc(target.avatar_url)}" alt="">` : esc((target.display_name || target.token || '?').trim()[0] || '?')}</span>
        <span class="mention-picker-copy">
          <strong>${esc(target.display_name || target.token)}</strong>
          <small>@${esc(target.token)}${target.is_ai_bot ? ' &middot; AI' : ''}</small>
        </span>
      </button>
    `).join('');
    picker.classList.remove('hidden');
    mentionPickerState.active = true;
    positionMentionPicker();
  }

  async function updateMentionPicker() {
    const trigger = findMentionTrigger();
    if (!trigger) {
      hideMentionPicker();
      return;
    }
    mentionPickerState.start = trigger.start;
    mentionPickerState.end = trigger.end;
    const chatId = currentChatId;
    try {
      const targets = await loadMentionTargets(chatId);
      const latest = findMentionTrigger();
      if (chatId !== currentChatId || !latest || latest.start !== trigger.start || latest.end !== trigger.end || latest.query !== trigger.query) return;
      const query = trigger.query;
      const filtered = targets.filter((target) => {
        const haystack = [
          target.token,
          target.username,
          target.display_name,
          target.is_ai_bot ? 'ai bot' : '',
        ].join(' ').toLowerCase();
        return !query || haystack.includes(query);
      }).slice(0, 8);
      renderMentionPicker(filtered);
    } catch {
      hideMentionPicker();
    }
  }

  function insertMentionTarget(target) {
    if (!target || !msgInput) return;
    const tokenValue = `@${String(target.token || target.mention || '').replace(/^@+/, '')} `;
    const value = msgInput.value || '';
    const start = mentionPickerState.start ?? (msgInput.selectionStart || 0);
    const end = mentionPickerState.end ?? (msgInput.selectionEnd || start);
    msgInput.value = value.slice(0, start) + tokenValue + value.slice(end);
    const cursor = start + tokenValue.length;
    msgInput.setSelectionRange(cursor, cursor);
    hideMentionPicker();
    autoResize();
    window.BananzaVoiceHooks?.refreshComposerState?.();
    focusComposerKeepKeyboard(true);
    msgInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function insertMentionTokenIntoComposer(token) {
    const clean = String(token || '').replace(/^@+/, '').trim();
    if (!clean || !msgInput) return;
    const value = msgInput.value || '';
    const cursor = msgInput.selectionStart ?? value.length;
    const prefix = cursor > 0 && !/\s/.test(value[cursor - 1]) ? ' ' : '';
    const insertion = `${prefix}@${clean} `;
    msgInput.value = value.slice(0, cursor) + insertion + value.slice(cursor);
    const nextCursor = cursor + insertion.length;
    msgInput.setSelectionRange(nextCursor, nextCursor);
    autoResize();
    window.BananzaVoiceHooks?.refreshComposerState?.();
    focusComposerKeepKeyboard(true);
    msgInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function openPrivateChatWithUser(userId) {
    const id = Number(userId);
    if (!id || id === currentUser?.id) return;
    const chat = await api('/api/chats/private', { method: 'POST', body: { targetUserId: id } });
    await loadChats();
    if (chat?.id) openChat(chat.id);
  }

  function handleMentionPickerKeydown(e) {
    if (!mentionPickerState.active) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      mentionPickerState.selected = (mentionPickerState.selected + 1) % mentionPickerState.targets.length;
      renderMentionPicker(mentionPickerState.targets);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      mentionPickerState.selected = (mentionPickerState.selected - 1 + mentionPickerState.targets.length) % mentionPickerState.targets.length;
      renderMentionPicker(mentionPickerState.targets);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMentionTarget(mentionPickerState.targets[mentionPickerState.selected]);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      hideMentionPicker();
      return true;
    }
    return false;
  }

  async function handleMentionClick(e, btn) {
    e.preventDefault();
    e.stopPropagation();
    const tokenValue = btn.dataset.mentionToken || '';
    if (btn.dataset.mentionBot === '1') {
      insertMentionTokenIntoComposer(tokenValue);
      return;
    }
    const userId = Number(btn.dataset.mentionUserId);
    if (!userId || userId === currentUser?.id) return;
    try {
      await openPrivateChatWithUser(userId);
    } catch (error) {
      console.warn('[mentions] private chat failed:', error.message);
    }
  }

  function isGroupLikeCurrentChat() {
    const chat = getChatById(currentChatId);
    return Boolean(chat && (chat.type === 'group' || chat.type === 'general'));
  }

  function ensureAvatarUserMenu() {
    let menu = $('#avatarUserMenu');
    if (menu) return menu;
    menu = document.createElement('div');
    menu.id = 'avatarUserMenu';
    menu.className = 'avatar-user-menu hidden';
    menu.addEventListener('pointerdown', (e) => {
      const action = e.target.closest('[data-avatar-action]')?.dataset.avatarAction;
      if (!action || !avatarUserMenuState) return;
      e.preventDefault();
      e.stopPropagation();
      const target = avatarUserMenuState.target;
      hideAvatarUserMenu();
      if (action === 'mention') {
        insertMentionTokenIntoComposer(target.token);
      } else if (action === 'private') {
        openPrivateChatWithUser(target.userId).catch((error) => {
          console.warn('[avatar-menu] private chat failed:', error.message);
        });
      }
    }, { passive: false });
    document.body.appendChild(menu);
    return menu;
  }

  function hideAvatarUserMenu() {
    avatarUserMenuState = null;
    $('#avatarUserMenu')?.classList.add('hidden');
  }

  function positionAvatarUserMenu(anchor) {
    const menu = $('#avatarUserMenu');
    if (!menu || menu.classList.contains('hidden') || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const vv = window.visualViewport;
    const viewportLeft = vv ? vv.offsetLeft : 0;
    const viewportTop = vv ? vv.offsetTop : 0;
    const viewportWidth = vv ? vv.width : window.innerWidth;
    const viewportHeight = vv ? vv.height : window.innerHeight;
    const width = menu.offsetWidth || 190;
    const height = menu.offsetHeight || 92;
    let left = rect.left + viewportLeft + rect.width + 8;
    if (left + width > viewportLeft + viewportWidth - 8) left = rect.left + viewportLeft - width - 8;
    left = Math.max(viewportLeft + 8, Math.min(left, viewportLeft + viewportWidth - width - 8));
    let top = rect.top + viewportTop - Math.max(0, (height - rect.height) / 2);
    top = Math.max(viewportTop + 8, Math.min(top, viewportTop + viewportHeight - height - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function avatarMenuTargetFromEl(avatarEl) {
    if (!avatarEl) return null;
    const userId = Number(avatarEl.dataset.userId || 0);
    const token = String(avatarEl.dataset.mentionToken || '').replace(/^@+/, '').trim();
    if (!userId || !token) return null;
    return {
      userId,
      token,
      displayName: avatarEl.dataset.displayName || '',
      isAiBot: avatarEl.dataset.isAiBot === '1',
      isSelf: userId === currentUser?.id,
    };
  }

  function openAvatarUserMenu(avatarEl) {
    if (!isGroupLikeCurrentChat()) return;
    const target = avatarMenuTargetFromEl(avatarEl);
    if (!target) return;
    hideMentionPicker();
    const menu = ensureAvatarUserMenu();
    const canOpenPrivate = !target.isSelf && !target.isAiBot;
    menu.innerHTML = `
      <button type="button" data-avatar-action="mention">&#1059;&#1087;&#1086;&#1084;&#1103;&#1085;&#1091;&#1090;&#1100;</button>
      ${canOpenPrivate ? '<button type="button" data-avatar-action="private">&#1055;&#1077;&#1088;&#1077;&#1081;&#1090;&#1080; &#1074; &#1083;&#1080;&#1095;&#1085;&#1099;&#1081; &#1095;&#1072;&#1090;</button>' : ''}
    `;
    avatarUserMenuState = { target, anchor: avatarEl };
    menu.classList.remove('hidden');
    positionAvatarUserMenu(avatarEl);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════════════════
  function checkAuth() {
    token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) { location.href = '/login.html'; return false; }
    try {
      currentUser = JSON.parse(userStr);
      applyUiTheme(currentUser.ui_theme, false);
    } catch { logout(); return false; }
    return true;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (ws) ws.close();
    location.href = '/login.html';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBSOCKET
  // ═══════════════════════════════════════════════════════════════════════════
  function connectWS() {
    ws = new WebSocket(WS_URL + '?token=' + encodeURIComponent(token));

    ws.onopen = () => { wsRetry = 1000; };

    ws.onclose = (e) => {
      if (e.code === 4003) {
        alert('Your account has been blocked by an administrator.');
        logout();
        return;
      }
      setTimeout(() => { wsRetry = Math.min(wsRetry * 2, 30000); connectWS(); }, wsRetry);
    };

    ws.onmessage = (e) => {
      try { handleWSMessage(JSON.parse(e.data)); } catch {}
    };
  }

  function handleWSMessage(msg) {
    switch (msg.type) {
      case 'message': {
        const isOwnIncomingMessage = msg.message.user_id === currentUser.id;
        const isMentionForMe = isMessageMentioningCurrentUser(msg.message);
        if (!isOwnIncomingMessage && !document.hidden) {
          if (isMentionForMe && isMentionSoundEnabled()) {
            playAppSound('mention');
          } else if (isChatIncomingSoundEnabled(msg.message.chat_id)) {
            playAppSound(msg.message.chat_id === currentChatId ? 'incoming' : 'notification');
          }
        }
        // Update chat list regardless
        updateChatListLastMessage(msg.message);
        // Track unread for non-current chats
        if (msg.message.chat_id !== currentChatId && msg.message.user_id !== currentUser.id) {
          const chat = chats.find(c => c.id === msg.message.chat_id);
          if (chat) { chat.unread_count = (chat.unread_count || 0) + 1; renderChatList(chatSearch.value); }
        }
        // Only render if we're in the relevant chat
        if (msg.message.chat_id === currentChatId && !displayedMsgIds.has(msg.message.id)) {
          const wasNearBottom = isNearBottom();
          const isAiBotResponse = msg.message.ai_generated || msg.message.ai_bot_id;
          const shouldPreserveIncomingScroll = scrollRestoreMode === 'restore' && !isOwnIncomingMessage && !isAiBotResponse;
          const scrollTopBefore = messagesEl.scrollTop;
          appendMessage(msg.message);
          if (isOwnIncomingMessage || (wasNearBottom && !shouldPreserveIncomingScroll)) {
            scrollToBottom();
          } else if (shouldPreserveIncomingScroll) {
            messagesEl.scrollTop = scrollTopBefore;
            scrollPositions[currentChatId] = scrollTopBefore;
            updateScrollBottomButton();
          }
          // Mark as read
          api(`/api/chats/${currentChatId}/read`, { method: 'POST' }).catch(() => {});
        }
        // Fallback notification for old/no-push browsers while this page is still running.
        if (
          document.hidden &&
          msg.message.user_id !== currentUser.id &&
          'Notification' in window &&
          Notification.permission === 'granted' &&
          notificationSettings.push_enabled &&
          ((isMentionForMe && notificationSettings.notify_mentions !== false) ||
            (notificationSettings.notify_messages && isChatNotificationEnabled(msg.message.chat_id))) &&
          !pushDeviceSubscribed
        ) {
          const title = isMentionForMe ? `${msg.message.display_name} \u0443\u043f\u043e\u043c\u044f\u043d\u0443\u043b(\u0430) \u0432\u0430\u0441` : msg.message.display_name;
          const body = msg.message.text || (msg.message.is_voice_note ? msg.message.transcription_text : '') || '📎 File';
          new Notification(title, { body: body.substring(0, 100), icon: '/favicon.ico' });
        }
        break;
      }
      case 'link_preview': {
        if (msg.messageId) {
          const el = messagesEl.querySelector(`[data-msg-id="${msg.messageId}"]`);
          if (el) {
            const bubble = el.querySelector('.msg-bubble');
            const existing = bubble.querySelector('.link-preview');
            if (!existing) {
              const footer = bubble.querySelector('.msg-footer');
              if (footer) footer.insertAdjacentHTML('beforebegin', renderLinkPreview(msg.preview));
              else bubble.insertAdjacentHTML('beforeend', renderLinkPreview(msg.preview));
            }
          }
        }
        break;
      }
      case 'message_deleted': {
        markMessageDeleted(msg.messageId);
        loadChats();
        break;
      }
      case 'message_updated': {
        applyMessageUpdate(msg.message);
        loadChats();
        break;
      }
      case 'online': {
        onlineUsers = new Set(msg.userIds);
        updateOnlineDisplay();
        break;
      }
      case 'typing': {
        if (msg.chatId === currentChatId && msg.userId !== currentUser.id) {
          if (msg.isTyping === false) hideTyping(msg.username);
          else showTyping(msg.username);
        }
        break;
      }
      case 'chat_created': {
        if (msg.is_invite && msg.actorId !== currentUser.id && !document.hidden) {
          playAppSound('invite');
        }
        loadChats();
        break;
      }
      case 'messages_read': {
        if (msg.chatId === currentChatId && msg.userId !== currentUser.id) {
          // Update all own messages up to lastReadId to show double checkmark
          messagesEl.querySelectorAll('.msg-row.own').forEach(row => {
            const msgId = +row.dataset.msgId;
            if (msgId <= msg.lastReadId) {
              const statusEl = row.querySelector('.msg-status');
              if (statusEl && !statusEl.classList.contains('read')) {
                statusEl.classList.add('read');
                statusEl.textContent = '✓✓';
              }
            }
          });
        }
        break;
      }
      case 'reaction': {
        updateReactionBar(msg.messageId, msg.reactions);
        if (
          msg.action === 'added' &&
          msg.targetUserId === currentUser.id &&
          msg.actorId !== currentUser.id &&
          !document.hidden &&
          isChatIncomingSoundEnabled(msg.chatId)
        ) {
          playAppSound('reaction');
        }
        break;
      }
      case 'message_transcription':
      case 'voice_settings_updated': {
        window.BananzaVoiceHooks?.handleWSMessage?.(msg);
        break;
      }
      case 'chat_updated': {
        const idx = chats.findIndex(c => c.id === msg.chat.id);
        if (idx >= 0) {
          chats[idx] = {
            ...chats[idx],
            name: msg.chat.name,
            avatar_url: msg.chat.avatar_url,
            background_url: msg.chat.background_url || null,
            background_style: msg.chat.background_style || 'cover',
          };
          renderChatList(chatSearch.value);
          if (currentChatId === msg.chat.id) {
            chatTitle.textContent = msg.chat.name;
            applyChatBackground(msg.chat);
          }
        }
        break;
      }
      case 'chat_removed': {
        chats = chats.filter(c => c.id !== msg.chatId);
        renderChatList(chatSearch.value);
        if (currentChatId === msg.chatId) {
          currentChatId = null;
          chatView.classList.add('hidden');
          emptyState.classList.remove('hidden');
        }
        break;
      }
    }
  }

  function sendTyping() {
    if (!ws || ws.readyState !== 1 || !currentChatId) return;
    ws.send(JSON.stringify({ type: 'typing', chatId: currentChatId }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT LIST
  // ═══════════════════════════════════════════════════════════════════════════
  async function loadChats() {
    try {
      chats = await api('/api/chats');
      renderChatList();
    } catch {}
  }

  async function loadAllUsers() {
    try { allUsers = await api('/api/users'); } catch {}
  }

  function renderChatList(filter = '') {
    chatList.innerHTML = '';
    const filtered = filter
      ? chats.filter(c => getChatSearchHaystack(c).includes(filter.toLowerCase()))
      : chats;

    for (const chat of filtered) {
      const el = document.createElement('div');
      el.className = 'chat-item' + (chat.id === currentChatId ? ' active' : '');
      el.dataset.chatId = chat.id;

      const avatarColor = chat.type === 'private' && chat.private_user
        ? chat.private_user.avatar_color : '#5eb5f7';
      const displayName = chat.name;
      const isOnline = chat.type === 'private' && chat.private_user && onlineUsers.has(chat.private_user.id);

      const lastMsg = getChatLastPreviewText(chat);

      const lastTime = chat.last_time ? formatTime(chat.last_time) : '';

      const unread = chat.unread_count > 0 ? `<span class="unread-badge">${chat.unread_count > 99 ? '99+' : chat.unread_count}</span>` : '';

      el.innerHTML = `
        ${chatItemAvatarHtml(chat)}
          ${isOnline ? '<div class="online-dot"></div>' : ''}
        </div>
        <div class="chat-item-body">
          <div class="chat-item-top">
            <span class="chat-item-name">${esc(displayName)}</span>
            <span class="chat-item-time">${lastTime}</span>
          </div>
          <div class="chat-item-last">
            <span>${esc(lastMsg).substring(0, 60)}</span>
            ${unread}
          </div>
        </div>
      `;
      el.addEventListener('click', () => openChat(chat.id));
      chatList.appendChild(el);
    }

    // When searching, also show users without existing private chats
    if (filter) {
      const privatePeerIds = new Set(
        chats.filter(c => c.type === 'private' && c.private_user).map(c => c.private_user.id)
      );
      const matchingUsers = allUsers.filter(u =>
        !privatePeerIds.has(u.id) &&
        (u.display_name.toLowerCase().includes(filter.toLowerCase()) ||
         u.username.toLowerCase().includes(filter.toLowerCase()))
      );
      if (matchingUsers.length > 0) {
        const sep = document.createElement('div');
        sep.className = 'chat-list-separator';
        sep.textContent = 'Users';
        chatList.appendChild(sep);
      }
      for (const u of matchingUsers) {
        const el = document.createElement('div');
        el.className = 'chat-item';
        const isOnline = onlineUsers.has(u.id);
        el.innerHTML = `
          <div class="chat-item-avatar" style="background:${u.avatar_color || '#5eb5f7'}">
            ${u.avatar_url ? `<img class="avatar-img" src="${esc(u.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">` : initials(u.display_name)}
            ${isOnline ? '<div class="online-dot"></div>' : ''}
          </div>
          <div class="chat-item-body">
            <div class="chat-item-top">
              <span class="chat-item-name">${esc(u.display_name)}</span>
            </div>
            <div class="chat-item-last"><span>@${esc(u.username)}</span></div>
          </div>
        `;
        el.addEventListener('click', async () => {
          try {
            const chat = await api('/api/chats/private', { method: 'POST', body: { targetUserId: u.id } });
            await loadChats();
            openChat(chat.id);
            chatSearch.value = '';
          } catch (e) { alert(e.message); }
        });
        chatList.appendChild(el);
      }
    }
  }

  function updateChatListLastMessage(msg) {
    const chat = chats.find(c => c.id === msg.chat_id);
    if (chat) {
      chat.last_text = msg.text || (msg.is_voice_note ? msg.transcription_text || null : null);
      chat.last_time = msg.created_at;
      chat.last_user = msg.display_name;
      chat.last_file_id = msg.file_id;
      // Re-sort
      chats.sort((a, b) => {
        if (!a.last_time && !b.last_time) return 0;
        if (!a.last_time) return 1;
        if (!b.last_time) return -1;
        return b.last_time.localeCompare(a.last_time);
      });
      renderChatList(chatSearch.value);
    }
  }

  function updateOnlineDisplay() {
    renderChatList(chatSearch.value);
    if (currentChatId) updateChatStatus();
    refreshAdminUserStatuses();
  }

  function updateScrollBottomButton() {
    if (!scrollBottomBtn) return;
    const hasMessages = Boolean(messagesEl.querySelector('.msg-row'));
    const shouldShow = Boolean(currentChatId && hasMessages && !isNearBottom(8));
    scrollBottomBtn.classList.toggle('visible', shouldShow);
  }

  function renderAdminUserRow(u) {
    const isOnline = onlineUsers.has(u.id);
    return `
      <div class="admin-user-row" data-uid="${u.id}">
        ${avatarHtml(u.display_name, u.avatar_color, u.avatar_url)}
        <div class="info">
          <div class="name">${esc(u.display_name)} <span style="color:var(--text-secondary)">@${esc(u.username)}</span></div>
          <div class="meta">
            <div class="admin-user-status ${isOnline ? 'online' : 'offline'}">
              <span class="status-dot"></span>${isOnline ? 'online' : 'offline'}
            </div>
            <div class="admin-user-joined">Joined: ${new Date(u.created_at + 'Z').toLocaleDateString()}</div>
          </div>
        </div>
        ${u.is_admin ? '<span class="badge badge-admin">Admin</span>' : ''}
        ${u.is_blocked ? '<span class="badge badge-blocked">Blocked</span>' : ''}
        ${!u.is_admin ? `<div class="admin-user-actions">
          <button class="reset-btn" data-uid="${u.id}" title="Reset password to 123456">🔑 Reset</button>
          <button class="block-btn ${u.is_blocked ? 'is-blocked' : ''}" data-uid="${u.id}">${u.is_blocked ? 'Unblock' : 'Block'}</button>
        </div>` : ''}
      </div>
    `;
  }

  function refreshAdminUserStatuses() {
    if (adminModal.classList.contains('hidden')) return;
    const list = $('#adminUserList');
    if (!list) return;
    list.querySelectorAll('.admin-user-row').forEach(row => {
      const uid = +row.dataset.uid;
      const statusEl = row.querySelector('.admin-user-status');
      if (!statusEl) return;
      const isOnline = onlineUsers.has(uid);
      statusEl.classList.toggle('online', isOnline);
      statusEl.classList.toggle('offline', !isOnline);
      statusEl.innerHTML = `<span class="status-dot"></span>${isOnline ? 'online' : 'offline'}`;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPEN CHAT
  // ═══════════════════════════════════════════════════════════════════════════
  async function openChat(chatId) {
    // Save scroll position of previous chat
    if (currentChatId) {
      scrollPositions[currentChatId] = messagesEl.scrollTop;
    }
    hideMentionPicker();
    hideAvatarUserMenu();

    currentChatId = chatId;
    displayedMsgIds.clear();
    hasMore = false; // prevent scroll handler triggering loadMore during DOM clear

    emptyState.classList.add('hidden');
    chatView.classList.remove('hidden');

    // Update sidebar active state
    chatList.querySelectorAll('.chat-item').forEach(el => {
      el.classList.toggle('active', +el.dataset.chatId === chatId);
    });

    // Mobile: hide sidebar
    if (window.innerWidth <= 768) {
      sidebar.classList.add('sidebar-hidden');
      history.pushState({ chat: chatId }, '');
    }

    const chat = chats.find(c => c.id === chatId);
    chatTitle.textContent = chat ? chat.name : 'Chat';

    // Header avatar
    if (chat) {
      chatHeaderAvatar.style.display = '';
      if (chat.type === 'private' && chat.private_user) {
        const u = chat.private_user;
        if (u.avatar_url) {
          chatHeaderAvatar.style.background = u.avatar_color;
          chatHeaderAvatar.innerHTML = `<img class="avatar-img" src="${esc(u.avatar_url)}" alt="">`;
        } else {
          chatHeaderAvatar.style.background = u.avatar_color;
          chatHeaderAvatar.innerHTML = initials(chat.name);
        }
      } else {
        const bg = chat.avatar_url ? '#5eb5f7' : '#5eb5f7';
        chatHeaderAvatar.style.background = bg;
        if (chat.avatar_url) {
          chatHeaderAvatar.innerHTML = `<img class="avatar-img" src="${esc(chat.avatar_url)}" alt="">`;
        } else {
          chatHeaderAvatar.innerHTML = chat.type === 'general' ? '🌐' : '👥';
        }
      }
    } else {
      chatHeaderAvatar.style.display = 'none';
    }

    updateChatStatus();
    // Apply chat background (if present)
    applyChatBackground(chat);

    // Clear and load messages
    messagesEl.querySelectorAll('.msg-row, .msg-group, .date-separator').forEach(el => el.remove());
    compactView = !!compactViewMap[chatId];
    messagesEl.classList.toggle('compact-view', compactView);
    loadMoreWrap.classList.add('hidden');

    try {
      const msgs = await api(`/api/chats/${chatId}/messages?limit=${PAGE_SIZE}`);
      // Re-clear after async gap: WS may have appended messages while we waited
      if (currentChatId !== chatId) return; // user switched chats
      messagesEl.querySelectorAll('.msg-row, .msg-group, .date-separator').forEach(el => el.remove());
      displayedMsgIds.clear();
      hasMore = msgs.length >= PAGE_SIZE;
      if (hasMore) loadMoreWrap.classList.remove('hidden');
      renderMessages(msgs);
      if (scrollRestoreMode === 'restore' && scrollPositions[chatId] != null) {
        requestAnimationFrame(() => { messagesEl.scrollTop = scrollPositions[chatId]; });
      } else {
        scrollToBottom(true);
      }
      requestAnimationFrame(updateScrollBottomButton);
    } catch {}

    // Mark chat as read
    try {
      await api(`/api/chats/${chatId}/read`, { method: 'POST' });
      const chat = chats.find(c => c.id === chatId);
      if (chat) { chat.unread_count = 0; renderChatList(chatSearch.value); }
    } catch {}

    clearReply();
    if (editTo) clearEdit({ clearInput: true });
    if (window.innerWidth > 768) msgInput.focus();
    window.BananzaVoiceHooks?.refreshComposerState?.();
    updateScrollBottomButton();
    localStorage.setItem('lastChat', chatId);
  }

  function updateChatStatus() {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    if (chat.type === 'private' && chat.private_user) {
      chatStatus.textContent = onlineUsers.has(chat.private_user.id) ? 'online' : 'offline';
      chatStatus.style.color = onlineUsers.has(chat.private_user.id) ? 'var(--success)' : '';
    } else {
      const onlineCount = [...onlineUsers].length;
      chatStatus.textContent = `${onlineCount} online`;
      chatStatus.style.color = '';
    }
  }

  function applyBackgroundStyleToElement(el, style) {
    switch (style) {
      case 'cover':
        el.style.backgroundSize = 'cover'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center center'; break;
      case 'contain':
        el.style.backgroundSize = 'contain'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center center'; break;
      case '100%':
        el.style.backgroundSize = '100%'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center center'; break;
      case 'tile':
        el.style.backgroundSize = 'auto'; el.style.backgroundRepeat = 'repeat'; el.style.backgroundPosition = 'left top'; break;
      case 'center':
        el.style.backgroundSize = 'contain'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center center'; break;
      default:
        el.style.backgroundSize = 'cover'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center center';
    }
  }

  // Apply chat background to messages area
  function applyChatBackground(chat) {
    if (!messagesEl) return;
    if (!chat || !chat.background_url) {
      messagesEl.classList.remove('has-bg');
      messagesEl.style.backgroundImage = '';
      messagesEl.style.backgroundSize = '';
      messagesEl.style.backgroundRepeat = '';
      messagesEl.style.backgroundPosition = '';
      return;
    }
    messagesEl.classList.add('has-bg');
    messagesEl.style.backgroundImage = `url(${chat.background_url})`;
    applyBackgroundStyleToElement(messagesEl, chat.background_style || 'cover');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════
  function createMessageGroup(msg, isOwn) {
    const group = document.createElement('div');
    group.className = 'msg-group';
    group.dataset.userId = msg.user_id;
    const avatarColor = isOwn ? (currentUser.avatar_color || '#65aadd') : (msg.avatar_color || '#65aadd');
    const avatarUrl = isOwn ? currentUser.avatar_url : msg.avatar_url;
    const name = isOwn ? currentUser.display_name : msg.display_name;
    const isAiBot = !isOwn && (Number(msg.is_ai_bot) !== 0 || Number(msg.ai_bot_id) > 0 || Number(msg.ai_generated) > 0);
    const mentionToken = isAiBot ? (msg.ai_bot_mention || msg.username) : (isOwn ? currentUser.username : msg.username);
    group.innerHTML = `<div class="msg-group-avatar" role="button" tabindex="0" title="${esc(name)}" data-user-id="${Number(msg.user_id) || 0}" data-display-name="${esc(name)}" data-mention-token="${esc(mentionToken || '')}" data-is-ai-bot="${isAiBot ? '1' : '0'}">${avatarHtml(name, avatarColor, avatarUrl, 32)}</div>`;
    const body = document.createElement('div');
    body.className = 'msg-group-body';
    group.appendChild(body);
    return { group, body };
  }

  function renderMessages(msgs) {
    let lastDate = null;
    const existingFirst = messagesEl.querySelector('.msg-row, .msg-group');
    let currentGroupBody = null;

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const msgDate = formatDate(msg.created_at);
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        currentGroupBody = null;
        const sep = document.createElement('div');
        sep.className = 'date-separator';
        sep.innerHTML = `<span>${msgDate}</span>`;
        if (existingFirst) messagesEl.insertBefore(sep, existingFirst);
        else messagesEl.appendChild(sep);
      }

      const prevMsg = i > 0 ? msgs[i - 1] : null;
      const sameUser = prevMsg && prevMsg.user_id === msg.user_id && formatDate(prevMsg.created_at) === msgDate;
      const isOwn = msg.user_id === currentUser.id;
      const useGroup = !isOwn || compactView;

      const startsGroup = useGroup && (!sameUser || !currentGroupBody);
      if (startsGroup) {
        const { group, body } = createMessageGroup(msg, isOwn);
        currentGroupBody = body;
        if (existingFirst) messagesEl.insertBefore(group, existingFirst);
        else messagesEl.appendChild(group);
      }

      const showName = useGroup && startsGroup;
      const el = createMessageEl(msg, showName);

      if (useGroup) {
        currentGroupBody.appendChild(el);
      } else {
        currentGroupBody = null;
        if (existingFirst) messagesEl.insertBefore(el, existingFirst);
        else messagesEl.appendChild(el);
      }
      displayedMsgIds.add(msg.id);
    }
    updateScrollBottomButton();
  }

  function appendMessage(msg) {
    const msgDate = formatDate(msg.created_at);
    const isOwn = msg.user_id === currentUser.id;
    const useGroup = !isOwn || compactView;
    let lastChild = messagesEl.lastElementChild;

    // Date separator: compare against last separator in DOM
    const seps = messagesEl.querySelectorAll('.date-separator');
    const lastSepDate = seps.length ? seps[seps.length - 1].textContent.trim() : null;
    if (lastSepDate !== msgDate) {
      const sep = document.createElement('div');
      sep.className = 'date-separator';
      sep.innerHTML = `<span>${msgDate}</span>`;
      messagesEl.appendChild(sep);
      lastChild = null;
    }

    // Check if we can append to existing group
    let sameGroup = false;
    let groupBody = null;
    if (useGroup && lastChild && lastChild.classList.contains('msg-group') && +lastChild.dataset.userId === msg.user_id) {
      sameGroup = true;
      groupBody = lastChild.querySelector('.msg-group-body');
    }

    if (useGroup && (!sameGroup || !groupBody)) {
      const { group, body } = createMessageGroup(msg, isOwn);
      groupBody = body;
      sameGroup = false;
      messagesEl.appendChild(group);
    }

    const showName = useGroup && !sameGroup;
    const el = createMessageEl(msg, showName);

    if (useGroup) {
      groupBody.appendChild(el);
    } else {
      messagesEl.appendChild(el);
    }
    displayedMsgIds.add(msg.id);
    updateScrollBottomButton();
  }

  function createMessageEl(msg, showName = true) {
    const isOwn = msg.user_id === currentUser.id;
    const isMediaMessage = Boolean(
      !msg.is_deleted &&
      msg.file_id &&
      ['image', 'audio', 'video', 'document'].includes(msg.file_type)
    );
    const isEmojiOnly = Boolean(
      !msg.is_deleted &&
      !msg.is_voice_note &&
      !msg.file_id &&
      !msg.forwarded_from_display_name &&
      !msg.reply_to_id &&
      msg.text &&
      !(msg.previews && msg.previews.length) &&
      isSingleEmojiMessage(msg.text)
    );
    const row = document.createElement('div');
    row.className = `msg-row ${isOwn ? 'own' : 'other'}${isEmojiOnly ? ' emoji-only-message' : ''}${isMediaMessage ? ' media-message' : ''}`;
    row.dataset.msgId = msg.id;
    row.dataset.date = formatDate(msg.created_at);
    row.dataset.userId = msg.user_id;
    row.__messageData = { ...msg };
    row.__replyPayload = {
      id: msg.id,
      display_name: isOwn ? currentUser.display_name : msg.display_name,
      text: getReplyPreviewText(msg),
    };
    row.__voiceBootstrap = {
      id: msg.id,
      is_voice_note: !!msg.is_voice_note,
      voice_duration_ms: msg.voice_duration_ms || null,
      transcription_status: msg.transcription_status || 'idle',
      transcription_text: msg.transcription_text || '',
      transcription_provider: msg.transcription_provider || '',
      transcription_model: msg.transcription_model || '',
      transcription_error: msg.transcription_error || '',
    };

    let html = '';

    html += '<div class="msg-content">';

    // Sender name (first in group)
    if (showName && (!isOwn || compactView)) {
      const nameColor = isOwn ? (currentUser.avatar_color || '#65aadd') : (msg.avatar_color || '#65aadd');
      const nameText = isOwn ? currentUser.display_name : msg.display_name;
      html += `<div class="msg-sender" style="color:${nameColor}">${esc(nameText)}</div>`;
    }

    html += '<div class="msg-bubble">';

    if (msg.is_deleted) {
      html += `<span class="msg-deleted">Message deleted</span>`;
    } else {
      if (msg.forwarded_from_display_name) {
        html += `<div class="msg-forwarded">Переслано от ${esc(msg.forwarded_from_display_name)}</div>`;
      }

      // Reply reference
      if (msg.reply_to_id && msg.reply_display_name) {
        const replyText = getReplyQuoteText(msg);
        html += `<div class="msg-reply" data-reply-id="${msg.reply_to_id}">
          <div class="msg-reply-name">${esc(msg.reply_display_name)}</div>
          <div class="msg-reply-text">${esc(replyText)}</div>
        </div>`;
      }

      // File attachment
      if (msg.file_id && msg.file_stored) {
        html += renderFileAttachment(msg);
      }

      // Text
      if (msg.text) {
        html += `<div class="msg-text">${isEmojiOnly ? esc(msg.text.trim()) : renderMessageText(msg.text, msg.mentions)}</div>`;
      }

      // Link previews
      if (msg.previews && msg.previews.length > 0) {
        for (const p of msg.previews) {
          html += renderLinkPreview(p);
        }
      }

      // Delete button (inside bubble)
      if (isOwn || currentUser.is_admin) {
        html += `<button class="msg-delete-btn" data-id="${msg.id}" title="Delete">🗑</button>`;
      }
    }

    const statusIcon = isOwn && !msg.is_deleted ? `<span class="msg-status${msg.is_read ? ' read' : ''}">${msg.is_read ? '✓✓' : '✓'}</span>` : '';
    const editedIcon = !msg.is_deleted && msg.edited_at ? '<span class="msg-edited" title="Edited">✎</span>' : '';
    const reactionsHtml = (!msg.is_deleted && msg.reactions && msg.reactions.length > 0)
      ? `<div class="msg-reactions">${renderReactions(msg.reactions)}</div>` : '<div></div>';
    html += `<div class="msg-footer">${reactionsHtml}<span class="msg-time">${statusIcon}${editedIcon}${formatTime(msg.created_at)}</span></div>`;
    html += '</div>'; // msg-bubble
    html += '</div>'; // msg-content

    // Reply/edit/react buttons outside bubble
    if (!msg.is_deleted) {
      html += '<div class="msg-actions">';
      html += '<button class="msg-reply-btn" title="Reply">↩</button>';
      if (canEditMessage(msg)) html += '<button class="msg-edit-btn" title="Edit">✏️</button>';
      if (canForwardMessage(msg)) html += '<button class="msg-forward-btn" title="Forward">📤</button>';
      html += '<button class="msg-react-btn" title="React">🙂</button>';
      html += '</div>';
    }

    row.innerHTML = html;
    if (isMediaMessage) {
      const mediaContent = row.querySelector(':scope > .msg-content');
      const mediaActions = row.querySelector(':scope > .msg-actions');
      if (mediaContent && mediaActions) {
        const shell = document.createElement('div');
        shell.className = 'media-actions-shell';
        row.insertBefore(shell, mediaContent);
        shell.appendChild(mediaContent);
        shell.appendChild(mediaActions);
      }
    }

    // Event listeners
    const deleteBtn = row.querySelector('.msg-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteMessage(msg.id); });
    }

    const replyBtn = row.querySelector('.msg-reply-btn');
    if (replyBtn) {
      replyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setReplyFromRow(row);
      });
    }

    const editBtn = row.querySelector('.msg-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setEditFromRow(row);
      });
    }

    const forwardBtn = row.querySelector('.msg-forward-btn');
    if (forwardBtn) {
      forwardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openForwardMessageModal(row.__messageData);
      });
    }

    row.querySelectorAll('.mention-link').forEach((btn) => {
      btn.addEventListener('click', (e) => handleMentionClick(e, btn));
    });

    // (react button handled via delegation on messagesEl)

    // Click reply quote to scroll to original message
    const replyQuote = row.querySelector('.msg-reply');
    if (replyQuote) {
      replyQuote.style.cursor = 'pointer';
      replyQuote.addEventListener('click', () => scrollToMessage(+replyQuote.dataset.replyId));
    }

    const img = row.querySelector('.msg-image');
    if (img) {
      const markWideImage = () => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        row.classList.toggle('wide-media-message', img.naturalWidth >= img.naturalHeight);
      };
      img.addEventListener('click', () => openImageViewer(img.src));
      const wasNearBottom = isNearBottom();
      img.addEventListener('load', () => {
        markWideImage();
        if (wasNearBottom && (scrollRestoreMode !== 'restore' || isOwn)) scrollToBottom();
      });
      if (img.complete) markWideImage();
    }

    const expandBtn = row.querySelector('.msg-expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const video = row.querySelector('.msg-video video');
        const src = video?.querySelector('source')?.getAttribute('src') || '';
        if (src) openMediaViewer(src, 'video');
      });
    }

    // Audio/video duration
    const audio = row.querySelector('audio');
    if (audio) {
      audio.addEventListener('loadedmetadata', () => {
        const dur = formatDuration(audio.duration);
        const durEl = document.createElement('span');
        durEl.className = 'media-duration';
        durEl.textContent = dur;
        audio.parentElement.querySelector('div:last-child')?.prepend(durEl);
      });
    }
    const video = row.querySelector('video');
    if (video) {
      const markWideVideo = () => {
        if (!video.videoWidth || !video.videoHeight) return;
        row.classList.toggle('wide-media-message', video.videoWidth >= video.videoHeight);
      };
      video.addEventListener('loadedmetadata', () => {
        markWideVideo();
        const dur = formatDuration(video.duration);
        const durEl = document.createElement('span');
        durEl.className = 'media-duration';
        durEl.textContent = dur;
        video.parentElement.querySelector('div:last-child')?.prepend(durEl);
      });
      if (video.readyState >= 1) markWideVideo();
    }

    window.BananzaVoiceHooks?.decorateMessageRow?.(row, msg);

    return row;
  }

  function formatDuration(seconds) {
    if (!seconds || !isFinite(seconds)) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function renderFileAttachment(msg) {
    const url = `/uploads/${msg.file_stored}`;
    switch (msg.file_type) {
      case 'image':
        return `<img class="msg-image" src="${url}" alt="${esc(msg.file_name)}">`;
      case 'audio':
        return `<div class="msg-audio">
          <div style="font-size:13px;margin-bottom:4px">🎵 ${esc(msg.file_name)}</div>
          <audio controls preload="none"><source src="${url}" type="${msg.file_mime}"></audio>
          <div style="font-size:11px;color:var(--text-secondary)">${formatSize(msg.file_size)} · <a href="${url}" download="${esc(msg.file_name)}">Download</a></div>
        </div>`;
      case 'video':
        return `<div class="msg-video">
          <div class="msg-video-wrap">
            <video controls preload="metadata" playsinline><source src="${url}" type="${msg.file_mime}"></video>
            <button class="msg-expand-btn" type="button" title="Fullscreen">&#x26F6;</button>
          </div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${esc(msg.file_name)} · ${formatSize(msg.file_size)} · <a href="${url}" download="${esc(msg.file_name)}">Download</a></div>
        </div>`;
      default:
        return `<a class="msg-file" href="${url}" download="${esc(msg.file_name)}">
          <div class="msg-file-icon">📄</div>
          <div class="msg-file-info">
            <div class="msg-file-name">${esc(msg.file_name)}</div>
            <div class="msg-file-size">${formatSize(msg.file_size)}</div>
          </div>
        </a>`;
    }
  }

  function renderLinkPreview(p) {
    if (!p || (!p.title && !p.description && !p.image)) return '';
    let html = `<a class="link-preview" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">`;
    if (p.hostname) html += `<div class="lp-host">${esc(p.hostname)}</div>`;
    if (p.title) html += `<div class="lp-title">${esc(p.title)}</div>`;
    if (p.description) html += `<div class="lp-desc">${esc(p.description)}</div>`;
    if (p.image) html += `<img class="lp-image" src="${esc(p.image)}" alt="" loading="lazy" onerror="this.remove()">`;
    html += '</a>';
    return html;
  }

  // Load more messages
  async function loadMore() {
    if (loadingMore || !hasMore || !currentChatId) return;
    loadingMore = true;
    loadMoreBtn.textContent = 'Loading...';

    const firstMsg = messagesEl.querySelector('.msg-row');
    const firstId = firstMsg ? firstMsg.dataset.msgId : null;

    try {
      const url = `/api/chats/${currentChatId}/messages?limit=${PAGE_SIZE}${firstId ? '&before=' + firstId : ''}`;
      const msgs = await api(url);
      hasMore = msgs.length >= PAGE_SIZE;
      if (!hasMore) loadMoreWrap.classList.add('hidden');

      // Capture scroll state RIGHT before DOM mutation (not before async fetch)
      const scrollTopBefore = messagesEl.scrollTop;
      const scrollHeightBefore = messagesEl.scrollHeight;

      // Insert at top
      let lastDate = null;
      const insertBefore = messagesEl.querySelector('.date-separator, .msg-row');
      for (const msg of msgs) {
        const msgDate = formatDate(msg.created_at);
        if (msgDate !== lastDate) {
          lastDate = msgDate;
          const sep = document.createElement('div');
          sep.className = 'date-separator';
          sep.innerHTML = `<span>${msgDate}</span>`;
          messagesEl.insertBefore(sep, insertBefore);
        }
        const el = createMessageEl(msg);
        messagesEl.insertBefore(el, insertBefore);
        displayedMsgIds.add(msg.id);
      }

      // Remove duplicate date separators (keep first occurrence of each date)
      const seenDates = new Set();
      messagesEl.querySelectorAll('.date-separator').forEach(sep => {
        const text = sep.textContent.trim();
        if (seenDates.has(text)) sep.remove();
        else seenDates.add(text);
      });

      // Restore scroll position: keep user at the same visual spot
      messagesEl.scrollTop = scrollTopBefore + (messagesEl.scrollHeight - scrollHeightBefore);
    } catch {}

    loadingMore = false;
    loadMoreBtn.textContent = 'Load earlier messages';
  }

  function isNearBottom(threshold = 150) {
    return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < threshold;
  }

  function scrollToBottom(instant = false) {
    requestAnimationFrame(() => {
      messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: instant ? 'instant' : 'smooth' });
      if (scrollBottomBtn) scrollBottomBtn.classList.remove('visible');
      requestAnimationFrame(updateScrollBottomButton);
      if (!instant) setTimeout(updateScrollBottomButton, 260);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEND MESSAGE
  // ═══════════════════════════════════════════════════════════════════════════
  async function saveEditedMessage() {
    if (!editTo) return;
    const nextText = msgInput.value.trim();
    if (nextText.length > MAX_MSG) { alert('Message too long'); return; }
    if (!nextText && !editTo.allowEmpty) { alert('Text cannot be empty'); return; }

    if (nextText === editTo.text.trim()) {
      clearEdit({ clearInput: true });
      return;
    }

    try {
      const updated = await api(`/api/messages/${editTo.id}`, {
        method: 'PATCH',
        body: { text: nextText }
      });
      applyMessageUpdate(updated);
      clearEdit({ clearInput: true });
      loadChats();
    } catch (e) {
      alert(e.message);
    }
  }

  async function sendMessage() {
    if (!currentChatId) return;
    if (editTo) {
      await saveEditedMessage();
      return;
    }
    const text = msgInput.value.trim();
    const filesToSend = [...pendingFiles];
    const firstFileId = filesToSend.length > 0 ? filesToSend[0].id : null;

    if (!text && !firstFileId) return;
    if (text.length > MAX_MSG) { alert('Message too long'); return; }
    animateSendButton();

    msgInput.value = '';
    autoResize();
    clearPendingFile();
    const replyToId = replyTo ? replyTo.id : null;
    clearReply();
    window.BananzaVoiceHooks?.refreshComposerState?.();

    try {
      // First message: text + first file (or just text)
      await api(`/api/chats/${currentChatId}/messages`, {
        method: 'POST',
        body: { text: text || null, fileId: firstFileId, replyToId }
      });
      // Remaining files: one message per file
      for (let i = 1; i < filesToSend.length; i++) {
        await api(`/api/chats/${currentChatId}/messages`, {
          method: 'POST',
          body: { text: null, fileId: filesToSend[i].id, replyToId: null }
        });
      }
      playAppSound('send');
      scrollToBottom();
    } catch (e) {
      alert(e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE MESSAGE
  // ═══════════════════════════════════════════════════════════════════════════
  async function deleteMessage(id) {
    if (!confirm('Delete this message?')) return;
    try {
      await api(`/api/messages/${id}`, { method: 'DELETE' });
      // Immediately update UI in case WS is slow
      markMessageDeleted(id);
      loadChats();
    } catch (err) { console.error('[delete] failed:', err); }
  }

  function markMessageDeleted(msgId) {
    const el = messagesEl.querySelector(`[data-msg-id="${msgId}"]`);
    if (!el) { console.warn('[markDeleted] element not found for', msgId); return; }
    const bubble = el.querySelector('.msg-bubble');
    if (!bubble) { console.warn('[markDeleted] bubble not found'); return; }
    const timeEl = bubble.querySelector('.msg-time');
    const timeText = timeEl ? timeEl.textContent : '';
    bubble.innerHTML = `<span class="msg-deleted">Message deleted</span><span class="msg-time">${esc(timeText)}</span>`;
    el.querySelector('.msg-reply-btn')?.remove();
    el.querySelector('.msg-react-btn')?.remove();
    el.querySelector('.msg-edit-btn')?.remove();
    el.querySelector('.msg-forward-btn')?.remove();
    el.querySelector('.msg-actions')?.remove();
    if (editTo?.id === msgId) clearEdit({ clearInput: true });
  }

  function updateVisibleReplyQuotesFromMessage(msg) {
    if (!msg?.id) return;
    const text = getReplyPreviewText(msg);
    if (replyTo?.id === msg.id && !editTo) {
      replyTo.text = text;
      replyBarText.textContent = text || '📎 Attachment';
    }
    messagesEl.querySelectorAll(`.msg-reply[data-reply-id="${msg.id}"] .msg-reply-text`).forEach((el) => {
      el.textContent = text;
    });
  }

  function applyMessageUpdate(msg) {
    if (!msg?.id) return;
    updateVisibleReplyQuotesFromMessage(msg);
    if (msg.chat_id !== currentChatId) return;

    const row = messagesEl.querySelector(`[data-msg-id="${msg.id}"]`);
    if (!row) return;
    const nextMsg = { ...msg };
    if (row.querySelector('.msg-status.read')) nextMsg.is_read = true;
    const showName = Boolean(row.querySelector('.msg-sender'));
    const replacement = createMessageEl(nextMsg, showName);
    row.replaceWith(replacement);
    displayedMsgIds.add(nextMsg.id);
    updateScrollBottomButton();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════
  async function uploadFiles(fileList) {
    if (editTo) {
      alert('Finish editing before attaching files.');
      return;
    }
    const files = Array.from(fileList).slice(0, 10);
    if (files.length === 0) return;
    for (const f of files) {
      if (f.size > 25 * 1024 * 1024) { alert(`File too large: ${f.name} (max 25 MB)`); return; }
    }

    pendingFileEl.classList.remove('hidden');
    pendingFileEl.innerHTML = `<span>📎</span><span class="pending-file-name">Uploading 0/${files.length}...</span>`;

    const uploaded = [];
    try {
      for (let i = 0; i < files.length; i++) {
        pendingFileEl.querySelector('.pending-file-name').textContent = `Uploading ${i + 1}/${files.length}...`;
        const fd = new FormData();
        fd.append('file', files[i]);
        const data = await api('/api/upload', { method: 'POST', body: fd });
        uploaded.push(data);
      }
      pendingFiles = uploaded;
      pendingFile = uploaded[0];
      renderPendingFiles();
      msgInput.focus();
      window.BananzaVoiceHooks?.refreshComposerState?.();
    } catch (e) {
      alert(e.message);
      clearPendingFile();
    }
  }

  function renderPendingFiles() {
    if (pendingFiles.length === 0) { clearPendingFile(); return; }
    pendingFileEl.classList.remove('hidden');
    const icon = (t) => t === 'image' ? '🖼' : t === 'audio' ? '🎵' : t === 'video' ? '🎬' : '📄';
    if (pendingFiles.length === 1) {
      const d = pendingFiles[0];
      pendingFileEl.innerHTML = `
        <span>${icon(d.type)}</span>
        <span class="pending-file-name">${esc(d.original_name)} (${formatSize(d.size)})</span>
        <button class="pending-file-remove" title="Remove">✕</button>
      `;
    } else {
      pendingFileEl.innerHTML = `
        <span>📎</span>
        <span class="pending-file-name">${pendingFiles.length} files (${formatSize(pendingFiles.reduce((s, f) => s + f.size, 0))})</span>
        <button class="pending-file-remove" title="Remove all">✕</button>
      `;
    }
    pendingFileEl.querySelector('.pending-file-remove').addEventListener('click', clearPendingFile);
  }

  function clearPendingFile() {
    pendingFile = null;
    pendingFiles = [];
    pendingFileEl.classList.add('hidden');
    pendingFileEl.innerHTML = '';
    fileInput.value = '';
    window.BananzaVoiceHooks?.refreshComposerState?.();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPLY
  // ═══════════════════════════════════════════════════════════════════════════
  function getReplyPreviewText(msg) {
    if (msg?.text) return msg.text.substring(0, 100);
    if (msg?.is_voice_note) {
      const transcript = (msg.transcription_text || '').trim();
      return transcript ? transcript.substring(0, 100) : 'Голосовое сообщение';
    }
    if (msg?.file_name) return msg.file_name.substring(0, 100);
    return 'Attachment';
  }

  function getReplyQuoteText(msg) {
    const serverText = (msg?.reply_text || '').trim();
    if (serverText) return serverText.substring(0, 100);

    const sourceRow = msg?.reply_to_id
      ? messagesEl.querySelector(`[data-msg-id="${msg.reply_to_id}"]`)
      : null;
    const sourceText = (sourceRow?.__replyPayload?.text || '').trim();
    if (sourceText && sourceText !== 'Attachment') return sourceText.substring(0, 100);

    const isVoiceReply = Boolean(
      msg?.reply_is_voice_note ||
      sourceRow?.__voiceMessage?.is_voice_note ||
      sourceRow?.__voiceBootstrap?.is_voice_note
    );
    return isVoiceReply ? 'Голосовое сообщение' : 'Attachment';
  }

  function canEditMessage(msg) {
    if (!currentUser || !msg || msg.is_deleted) return false;
    if (!currentUser.is_admin && msg.user_id !== currentUser.id) return false;
    return Boolean(msg.is_voice_note || msg.file_id || msg.text);
  }

  function canForwardMessage(msg) {
    if (!currentUser || !msg || msg.is_deleted) return false;
    return Boolean(msg.is_voice_note || msg.file_id || msg.text);
  }

  function getEditableText(row) {
    const msg = row?.__messageData || {};
    if (msg.is_voice_note || row?.__voiceMessage?.is_voice_note) {
      return (row?.__voiceMessage?.transcription_text || msg.transcription_text || '').trim();
    }
    return msg.text || '';
  }

  function setReplyFromRow(row) {
    const payload = row?.__replyPayload;
    if (!payload || row.querySelector('.msg-deleted')) return;
    setReply(payload.id, payload.display_name, payload.text);
  }

  function setReply(id, name, text) {
    if (editTo) clearEdit({ clearInput: true });
    replyTo = { id, display_name: name, text };
    replyBarName.textContent = name;
    replyBarText.textContent = text || '📎 Attachment';
    replyBar.classList.remove('edit-bar');
    replyBar.classList.remove('hidden');
    msgInput.focus();
  }

  function clearReply() {
    replyTo = null;
    if (!editTo) replyBar.classList.add('hidden');
  }

  function setEditFromRow(row) {
    const msg = row?.__messageData;
    if (!canEditMessage(msg)) return;
    if (pendingFiles.length > 0) {
      alert('Finish or remove pending attachments before editing a message.');
      return;
    }

    const text = getEditableText(row);
    hideReactionPicker();
    replyTo = null;
    editTo = {
      id: msg.id,
      text,
      is_voice_note: Boolean(msg.is_voice_note || row.__voiceMessage?.is_voice_note),
      allowEmpty: Boolean(msg.file_id && !(msg.is_voice_note || row.__voiceMessage?.is_voice_note)),
    };
    replyBarName.textContent = 'Редактирование';
    replyBarText.textContent = editTo.is_voice_note ? 'Текст голосового сообщения' : 'Сообщение';
    replyBar.classList.add('edit-bar');
    replyBar.classList.remove('hidden');
    msgInput.value = text;
    autoResize();
    attachBtn.disabled = true;
    attachBtn.classList.add('disabled');
    window.BananzaVoiceHooks?.refreshComposerState?.();
    msgInput.focus();
  }

  function clearEdit({ clearInput = true } = {}) {
    editTo = null;
    replyBar.classList.remove('edit-bar');
    replyBar.classList.add('hidden');
    attachBtn.disabled = false;
    attachBtn.classList.remove('disabled');
    if (clearInput) {
      msgInput.value = '';
      autoResize();
    }
    window.BananzaVoiceHooks?.refreshComposerState?.();
  }

  function setupSwipeReplyGesture() {
    const threshold = 42;
    const maxOffset = 68;
    const lockStartPx = 8;
    const verticalCancelPx = 22;
    let swipe = null;

    const isMobile = () => window.innerWidth <= 768;
    const isInteractiveTarget = (target) => Boolean(target.closest(
      'button, a, input, textarea, select, label, audio, video, .msg-reply, .reaction-badge, .msg-image, .msg-video'
    ));
    const ensureIndicator = (row) => {
      let indicator = row.querySelector('.swipe-reply-indicator');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'swipe-reply-indicator';
        indicator.textContent = '\u21A9';
        row.appendChild(indicator);
      }
      return indicator;
    };
    const finishSwipe = (shouldReply) => {
      if (!swipe) return;
      const { row, content } = swipe;
      row.classList.remove('swipe-reply-active', 'swipe-reply-ready');
      if (content) content.style.transform = '';
      const indicator = row.querySelector('.swipe-reply-indicator');
      setTimeout(() => indicator?.remove(), 180);
      if (shouldReply) {
        navigator.vibrate?.(18);
        setReplyFromRow(row);
      }
      swipe = null;
    };

    messagesEl.addEventListener('touchstart', (e) => {
      if (!isMobile() || e.touches.length !== 1 || isInteractiveTarget(e.target)) return;
      const row = e.target.closest('.msg-row');
      if (!row || row.querySelector('.msg-deleted') || !row.__replyPayload) return;
      const touch = e.touches[0];
      swipe = {
        row,
        content: row.querySelector('.msg-content'),
        startX: touch.clientX,
        startY: touch.clientY,
        dx: 0,
        locked: false,
      };
    }, { passive: true });

    messagesEl.addEventListener('touchmove', (e) => {
      if (!swipe || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = swipe.startX - touch.clientX;
      const dy = touch.clientY - swipe.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (!swipe.locked) {
        if ((absY > verticalCancelPx && absY > absX * 1.35) || dx < -10) {
          finishSwipe(false);
          return;
        }
        if (dx < lockStartPx || absX < absY * 0.75) return;
        if (!e.cancelable) {
          finishSwipe(false);
          return;
        }
        swipe.locked = true;
        hideReactionPicker();
        ensureIndicator(swipe.row);
        swipe.row.classList.add('swipe-reply-active');
      }

      if (!e.cancelable) {
        finishSwipe(false);
        return;
      }
      e.preventDefault();
      swipe.dx = Math.max(0, Math.min(dx, maxOffset));
      if (swipe.content) swipe.content.style.transform = `translateX(${-swipe.dx}px)`;
      swipe.row.classList.toggle('swipe-reply-ready', dx >= threshold);
    }, { passive: false });

    messagesEl.addEventListener('touchend', () => {
      finishSwipe(Boolean(swipe?.locked && swipe.dx >= threshold));
    }, { passive: true });
    messagesEl.addEventListener('touchcancel', () => finishSwipe(false), { passive: true });
  }

  function setupSwipeEditGesture() {
    const threshold = 42;
    const maxOffset = 68;
    const lockStartPx = 8;
    const verticalCancelPx = 22;
    let swipe = null;

    const isMobile = () => window.innerWidth <= 768;
    const isInteractiveTarget = (target) => Boolean(target.closest(
      'button, a, input, textarea, select, label, audio, video, .msg-reply, .reaction-badge, .msg-image, .msg-video'
    ));
    const finishSwipe = (shouldEdit) => {
      if (!swipe) return;
      const { row, content } = swipe;
      row.classList.remove('swipe-edit-active', 'swipe-edit-ready');
      if (content) content.style.transform = '';
      if (shouldEdit) {
        navigator.vibrate?.(18);
        setEditFromRow(row);
      }
      swipe = null;
    };

    messagesEl.addEventListener('touchstart', (e) => {
      if (!isMobile() || e.touches.length !== 1 || isInteractiveTarget(e.target)) return;
      const row = e.target.closest('.msg-row');
      if (!row || !canEditMessage(row.__messageData)) return;
      const touch = e.touches[0];
      swipe = {
        row,
        content: row.querySelector('.msg-content'),
        startX: touch.clientX,
        startY: touch.clientY,
        dx: 0,
        locked: false,
      };
    }, { passive: true });

    messagesEl.addEventListener('touchmove', (e) => {
      if (!swipe || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - swipe.startX;
      const dy = touch.clientY - swipe.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (!swipe.locked) {
        if ((absY > verticalCancelPx && absY > absX * 1.35) || dx < -10) {
          finishSwipe(false);
          return;
        }
        if (dx < lockStartPx || absX < absY * 0.75) return;
        if (!e.cancelable) {
          finishSwipe(false);
          return;
        }
        swipe.locked = true;
        hideReactionPicker();
        swipe.row.classList.add('swipe-edit-active');
      }

      if (!e.cancelable) {
        finishSwipe(false);
        return;
      }
      e.preventDefault();
      swipe.dx = Math.max(0, Math.min(dx, maxOffset));
      if (swipe.content) swipe.content.style.transform = `translateX(${swipe.dx}px)`;
      swipe.row.classList.toggle('swipe-edit-ready', dx >= threshold);
    }, { passive: false });

    messagesEl.addEventListener('touchend', () => {
      finishSwipe(Boolean(swipe?.locked && swipe.dx >= threshold));
    }, { passive: true });
    messagesEl.addEventListener('touchcancel', () => finishSwipe(false), { passive: true });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════════════════
  let searchDebounce = null;

  function openSearchPanel() {
    searchPanel.classList.remove('hidden');
    searchInput.value = '';
    searchResults.innerHTML = '';
    searchInput.focus();
  }

  function closeSearchPanel() {
    searchPanel.classList.add('hidden');
    searchInput.value = '';
    searchResults.innerHTML = '';
  }

  function performSearch() {
    const q = searchInput.value.trim();
    if (q.length < 2) { searchResults.innerHTML = ''; return; }
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q });
        if (currentChatId) params.set('chatId', currentChatId);
        const results = await api(`/api/messages/search?${params}`);
        searchResults.innerHTML = '';
        if (results.length === 0) {
          searchResults.innerHTML = '<div style="padding:12px;color:var(--text-secondary)">No results</div>';
          return;
        }
        for (const r of results) {
          const el = document.createElement('div');
          el.className = 'search-result-item';
          const highlighted = esc(r.text || '').replace(
            new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
            '<mark>$1</mark>'
          );
          el.innerHTML = `
            <div style="font-weight:600;font-size:13px;color:var(--accent)">${esc(r.display_name)}</div>
            <div class="search-result-text">${highlighted}</div>
            <div style="font-size:11px;color:var(--text-secondary)">${formatTime(r.created_at)}</div>
          `;
          el.addEventListener('click', () => {
            closeSearchPanel();
            if (r.chat_id !== currentChatId) {
              openChat(r.chat_id).then(() => scrollToMessage(r.id));
            } else {
              scrollToMessage(r.id);
            }
          });
          searchResults.appendChild(el);
        }
      } catch {}
    }, 300);
  }

  function scrollToMessage(msgId) {
    const el = messagesEl.querySelector(`[data-msg-id="${msgId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'background 0.3s';
      el.style.background = 'rgba(94,181,247,0.15)';
      setTimeout(() => { el.style.background = ''; }, 1500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SIDEBAR RESIZE
  // ═══════════════════════════════════════════════════════════════════════════
  (() => {
    const handle = $('#resizeHandle');
    if (!handle) return;
    let dragging = false;
    let startX, startW;

    const saved = localStorage.getItem('sidebarWidth');
    if (saved) sidebar.style.width = saved + 'px';

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startW = sidebar.offsetWidth;
      handle.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const newW = Math.max(200, Math.min(600, startW + e.clientX - startX));
      sidebar.style.width = newW + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('sidebarWidth', sidebar.offsetWidth);
    });

    // Touch support
    handle.addEventListener('touchstart', (e) => {
      dragging = true;
      startX = e.touches[0].clientX;
      startW = sidebar.offsetWidth;
      handle.classList.add('active');
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const newW = Math.max(200, Math.min(600, startW + e.touches[0].clientX - startX));
      sidebar.style.width = newW + 'px';
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('active');
      localStorage.setItem('sidebarWidth', sidebar.offsetWidth);
    });
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAG & DROP
  // ═══════════════════════════════════════════════════════════════════════════
  let dragCounter = 0;

  function handleDragEnter(e) {
    e.preventDefault();
    dragCounter++;
    if (currentChatId) dragOverlay.classList.remove('hidden');
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) { dragOverlay.classList.add('hidden'); dragCounter = 0; }
  }

  function handleDrop(e) {
    e.preventDefault();
    dragCounter = 0;
    dragOverlay.classList.add('hidden');
    if (!currentChatId) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) uploadFiles(files);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPING INDICATOR
  // ═══════════════════════════════════════════════════════════════════════════
  function renderTypingBar() {
    const names = Object.keys(typingDisplayTimeouts);
    if (names.length === 0) {
      typingBar.classList.add('hidden');
      typingBar.textContent = '';
      return;
    }
    typingBar.classList.remove('hidden');
    typingBar.textContent = names.length === 1
      ? `${names[0]} печатает...`
      : `${names.slice(0, 2).join(', ')} печатают...`;
  }

  function showTyping(username) {
    const name = username || 'Someone';
    clearTimeout(typingDisplayTimeouts[name]);
    typingDisplayTimeouts[name] = setTimeout(() => {
      delete typingDisplayTimeouts[name];
      renderTypingBar();
    }, 3000);
    renderTypingBar();
  }

  function hideTyping(username) {
    const name = username || 'Someone';
    clearTimeout(typingDisplayTimeouts[name]);
    delete typingDisplayTimeouts[name];
    renderTypingBar();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EMOJI PICKER
  // ═══════════════════════════════════════════════════════════════════════════
  const EMOJIS = {
    '😀': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😘','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
    '👋': ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','💪','🦾','🖤'],
    '❤️': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','❤️‍🔥','❤️‍🩹','♥️'],
    '🎉': ['🎉','🎊','🎈','🎁','🏆','🥇','🥈','🥉','⚽','🏀','🎾','🎮','🎯','🎲','🔔','🎵','🎶','🎤','🎧','📱','💻','💡','📷','🎬','📚','✏️','📝','🔑','🔒','⭐','🌟','💫','✨','⚡','🔥','💯','🚀','🛸'],
    '🍕': ['🍕','🍔','🍟','🌭','🍿','🧀','🥚','🍳','🥞','🧇','🥓','🍗','🍖','🌮','🌯','🍝','🍜','🍣','🍱','🥟','🍦','🍩','🍪','🎂','🍰','🧁','🍫','🍬','🍭','☕','🍵','🧃','🧋','🍺','🍻','🥂','🍷','🍸','🍹','🥤','🍌'],
    '🌿': ['🌸','🌺','🌻','🌹','🌷','🌼','🌿','☘️','🍀','🍁','🍂','🌲','🌳','🌴','🌵','🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦄','🐝','🐛','🦋','🐌','🐞','🌍','🌙','☀️','⛅','🌈','💧','❄️'],
  };

  function initEmojiPicker() {
    const cats = Object.keys(EMOJIS);
    let html = '<div class="emoji-tabs">';
    cats.forEach((cat, i) => {
      html += `<div class="emoji-tab ${i === 0 ? 'active' : ''}" data-cat="${i}">${cat}</div>`;
    });
    html += '</div><div class="emoji-grid">';
    EMOJIS[cats[0]].forEach(e => { html += `<div class="emoji-item">${e}</div>`; });
    html += '</div>';
    emojiPicker.innerHTML = html;

    emojiPicker.addEventListener('click', (e) => {
      const tab = e.target.closest('.emoji-tab');
      if (tab) {
        emojiPicker.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const grid = emojiPicker.querySelector('.emoji-grid');
        const emojis = EMOJIS[cats[+tab.dataset.cat]];
        grid.innerHTML = emojis.map(em => `<div class="emoji-item">${em}</div>`).join('');
        return;
      }
      const item = e.target.closest('.emoji-item');
      if (item) {
        const pos = msgInput.selectionStart;
        const before = msgInput.value.substring(0, pos);
        const after = msgInput.value.substring(pos);
        msgInput.value = before + item.textContent + after;
        msgInput.selectionStart = msgInput.selectionEnd = pos + item.textContent.length;
        msgInput.dispatchEvent(new Event('input', { bubbles: true }));
        msgInput.focus();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIA VIEWER
  // ═══════════════════════════════════════════════════════════════════════════
  let galleryItems = []; // { src, type: 'image'|'video' }
  let galleryIndex = 0;
  let ivScale = 1, ivPanX = 0, ivPanY = 0;
  let ivHistoryPushed = false;    // true when we pushed { view: 'mediaviewer' } to history
  let ivSkipNextPopstate = false; // skip chat-nav after closeMediaViewer calls history.back()

  // ═══════════════════════════════════════════════════════════════════════════
  // REACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  let reactionPickerMsgId = null;
  let reactionPickerKeepKeyboard = false;

  function renderReactions(reactions) {
    if (!reactions || reactions.length === 0) return '';
    const grouped = {};
    for (const r of reactions) {
      if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
      grouped[r.emoji].count++;
      if (+r.user_id === currentUser.id) grouped[r.emoji].mine = true;
    }
    return Object.entries(grouped).map(([emoji, { count, mine }]) =>
      `<button class="reaction-badge${mine ? ' mine' : ''}" data-emoji="${emoji}">${emoji}<span>${count}</span></button>`
    ).join('');
  }

  function updateReactionBar(msgId, reactions) {
    const row = messagesEl.querySelector(`[data-msg-id="${msgId}"]`);
    if (!row) return;
    const footer = row.querySelector('.msg-footer');
    if (!footer) return;
    let bar = footer.querySelector('.msg-reactions');
    if (reactions.length === 0) {
      if (bar) { bar.outerHTML = '<div></div>'; }
    } else {
      if (!bar) {
        const placeholder = footer.querySelector('div');
        if (placeholder) placeholder.outerHTML = `<div class="msg-reactions">${renderReactions(reactions)}</div>`;
      } else {
        bar.innerHTML = renderReactions(reactions);
      }
    }
  }

  function showReactionPicker(row, trigger, options = {}) {
    reactionPickerKeepKeyboard = Boolean(options.keepComposerFocus);
    reactionPickerMsgId = +row.dataset.msgId;
    reactionPicker.classList.remove('hidden');
    // Position near the trigger
    const triggerEl = (trigger instanceof Element ? trigger : row);
    const rect = triggerEl.getBoundingClientRect();
    const pw = reactionPicker.offsetWidth || 370;
    const ph = reactionPicker.offsetHeight || 52;
    let left = rect.left;
    let top = rect.top - ph - 8;
    if (top < 8) top = rect.bottom + 8;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    reactionPicker.style.left = left + 'px';
    reactionPicker.style.top = top + 'px';
    if (reactionPickerKeepKeyboard) focusComposerKeepKeyboard(true);
  }

  function hideReactionPicker(options = {}) {
    reactionPicker.classList.add('hidden');
    reactionPickerMsgId = null;
    if (!options.keepComposerState) reactionPickerKeepKeyboard = false;
  }

  async function toggleReaction(msgId, emoji, options = {}) {
    const keepComposerFocus = Boolean(options.keepComposerFocus);
    hideReactionPicker({ keepComposerState: keepComposerFocus });
    if (keepComposerFocus) focusComposerKeepKeyboard(true);
    console.log('[reaction] sending', msgId, emoji);
    try {
      const data = await api(`/api/messages/${msgId}/reactions`, { method: 'POST', body: { emoji } });
      console.log('[reaction] response', data);
      if (data && data.reactions) updateReactionBar(msgId, data.reactions);
    } catch (err) {
      console.warn('[reaction] failed:', err);
    } finally {
      reactionPickerKeepKeyboard = false;
      if (keepComposerFocus) focusComposerKeepKeyboard(true);
    }
  }

  function collectGalleryItems() {
    galleryItems = [];
    messagesEl.querySelectorAll('.msg-image, .msg-video video').forEach(el => {
      if (el.tagName === 'IMG') {
        galleryItems.push({ src: el.src, type: 'image' });
      } else if (el.tagName === 'VIDEO') {
        const src = el.querySelector('source')?.getAttribute('src') || '';
        if (src) galleryItems.push({ src, type: 'video' });
      }
    });
  }

  function ivCurrentImg() {
    if (galleryItems[galleryIndex]?.type === 'video') return null;
    return ivStrip.querySelectorAll('.iv-slide')[galleryIndex]?.querySelector('img') || null;
  }
  function ivApplyTransform() {
    const img = ivCurrentImg();
    if (img) img.style.transform = `scale(${ivScale}) translate(${ivPanX}px, ${ivPanY}px)`;
  }
  function ivResetZoom() {
    ivScale = 1; ivPanX = 0; ivPanY = 0;
    const img = ivCurrentImg();
    if (img) img.style.transform = '';
  }

  function openMediaViewer(src, type = 'image') {
    collectGalleryItems();
    galleryIndex = galleryItems.findIndex(item => item.src === src && item.type === type);
    if (galleryIndex < 0) galleryIndex = 0;
    ivStrip.innerHTML = galleryItems.map(item => {
      if (item.type === 'video') {
        return `<div class="iv-slide iv-slide-video"><video controls playsinline><source src="${esc(item.src)}"></video></div>`;
      }
      return `<div class="iv-slide"><img src="${esc(item.src)}" alt=""></div>`;
    }).join('');
    ivScale = 1; ivPanX = 0; ivPanY = 0;
    ivStrip.style.transition = 'none';
    ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;
    updateGalleryArrows();
    if (window.innerWidth <= 768) {
      history.pushState({ view: 'mediaviewer' }, '');
      ivHistoryPushed = true;
    }
    // Pause any playing videos in the chat view (user opened fullscreen viewer)
    try {
      messagesEl.querySelectorAll('.msg-video video').forEach(v => {
        try { if (!v.paused) v.pause(); } catch (e) {}
      });
    } catch (e) {}

    imageViewer.classList.remove('hidden');
    if (galleryItems[galleryIndex]?.type === 'video') {
      ivStrip.querySelectorAll('.iv-slide')[galleryIndex]?.querySelector('video')?.play().catch(() => {});
    }
  }
  // Backward-compat alias used by existing image click handlers
  function openImageViewer(src) { openMediaViewer(src, 'image'); }

  function closeMediaViewer() {
    if (imageViewer.classList.contains('hidden')) return;
    ivStrip.querySelectorAll('video').forEach(v => v.pause());
    imageViewer.classList.add('hidden');
    if (ivHistoryPushed) {
      ivHistoryPushed = false;
      ivSkipNextPopstate = true;
      history.back();
    }
  }

  function updateGalleryArrows() {
    const prev = imageViewer.querySelector('.iv-prev');
    const next = imageViewer.querySelector('.iv-next');
    prev.style.display = galleryItems.length > 1 && galleryIndex > 0 ? '' : 'none';
    next.style.display = galleryItems.length > 1 && galleryIndex < galleryItems.length - 1 ? '' : 'none';
  }

  function galleryNav(dir) {
    const newIdx = galleryIndex + dir;
    if (newIdx < 0 || newIdx >= galleryItems.length) return;
    ivStrip.querySelectorAll('.iv-slide')[galleryIndex]?.querySelector('video')?.pause();
    ivResetZoom();
    galleryIndex = newIdx;
    ivStrip.style.transition = 'transform 0.3s ease';
    ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;
    updateGalleryArrows();
    if (galleryItems[galleryIndex]?.type === 'video') {
      setTimeout(() => {
        ivStrip.querySelectorAll('.iv-slide')[galleryIndex]?.querySelector('video')?.play().catch(() => {});
      }, 350);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════════════════════
  function closeAllModals() {
    const shouldAnimateForwardModal = Boolean(
      forwardMessageModal &&
      !forwardMessageModal.classList.contains('hidden') &&
      !forwardMessageModal.classList.contains('is-closing')
    );
    [
      newChatModal,
      adminModal,
      chatInfoModal,
      menuDrawer,
      emojiPicker,
      settingsModal,
      themeSettingsModal,
      weatherSettingsModal,
      notificationSettingsModal,
      soundSettingsModal,
      aiBotSettingsModal,
      changePasswordModal,
    ].forEach(m => m.classList.add('hidden'));
    closeForwardMessageModal({ animate: shouldAnimateForwardModal });
    closeMediaViewer();
    window.BananzaVoiceHooks?.closeAll?.();
  }

  // New chat modal
  async function openNewChatModal() {
    closeAllModals();
    newChatModal.classList.remove('hidden');
    try {
      const users = await api('/api/users');
      const privateList = $('#userListPrivate');
      const groupList = $('#userListGroup');

      privateList.innerHTML = users.map(u => `
        <div class="user-list-item" data-uid="${u.id}">
          ${avatarHtml(u.display_name, u.avatar_color, u.avatar_url)}
          <div>
            <div class="name">${esc(u.display_name)}</div>
            <div class="status-text">${u.online ? 'online' : 'offline'}</div>
          </div>
        </div>
      `).join('') || '<div style="color:var(--text-secondary);padding:12px">No other users yet</div>';

      groupList.innerHTML = users.map(u => `
        <div class="user-list-item" data-uid="${u.id}">
          ${avatarHtml(u.display_name, u.avatar_color, u.avatar_url)}
          <div>
            <div class="name">${esc(u.display_name)}</div>
          </div>
        </div>
      `).join('');

      // Private: click to start chat
      privateList.querySelectorAll('.user-list-item').forEach(el => {
        el.addEventListener('click', async () => {
          try {
            const chat = await api('/api/chats/private', { method: 'POST', body: { targetUserId: +el.dataset.uid } });
            closeAllModals();
            await loadChats();
            openChat(chat.id);
          } catch {}
        });
      });

      // Group: toggle selection
      groupList.querySelectorAll('.user-list-item').forEach(el => {
        el.addEventListener('click', () => el.classList.toggle('selected'));
      });
    } catch {}
  }

  // Admin modal
  async function openAdminModal() {
    closeAllModals();
    adminModal.classList.remove('hidden');
    try {
      const users = await api('/api/admin/users');
      const list = $('#adminUserList');
      list.innerHTML = users.map(renderAdminUserRow).join('');

      list.querySelectorAll('.block-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await api(`/api/admin/users/${btn.dataset.uid}/block`, { method: 'POST' });
            openAdminModal();
          } catch {}
        });
      });
      list.querySelectorAll('.reset-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Reset password to 123456?')) return;
          try {
            await api(`/api/admin/users/${btn.dataset.uid}/reset-password`, { method: 'POST' });
            alert('Password has been reset to 123456');
          } catch (e) { alert(e.message); }
        });
      });
    } catch {}
  }

  // Settings modal
  function openSettingsModal() {
    closeAllModals();
    settingsModal.classList.remove('hidden');
    const adminItem = $('#settingsAdminPanel');
    if (currentUser.is_admin) adminItem.classList.remove('hidden');
    else adminItem.classList.add('hidden');
    const aiBotsItem = $('#settingsAiBotsPanel');
    if (currentUser.is_admin) aiBotsItem?.classList.remove('hidden');
    else aiBotsItem?.classList.add('hidden');
    $('#settingsSendEnter').checked = sendByEnter;
    $('#settingsScrollRestore').checked = scrollRestoreMode === 'restore';
    $('#settingsOpenLastChat').checked = openLastChatOnReload;
    window.BananzaVoiceHooks?.onSettingsOpened?.({ currentUser });
  }

  function openThemeSettingsModal() {
    closeAllModals();
    themeSettingsModal.classList.remove('hidden');
    renderThemePicker();
    setThemeStatus('');
  }

  function openWeatherSettingsModal() {
    closeAllModals();
    weatherSettingsModal.classList.remove('hidden');
    renderWeatherSettingsForm();
    if (!weatherSettingsLoaded) loadWeatherSettings().then(renderWeatherSettingsForm);
  }

  function openNotificationSettingsModal() {
    closeAllModals();
    notificationSettingsModal.classList.remove('hidden');
    renderNotificationSettingsForm();
    setNotificationStatus('');
    if (!notificationSettingsLoaded) {
      loadNotificationSettings().catch(() => {});
    } else {
      refreshPushDeviceState().catch(() => {});
    }
  }

  function openSoundSettingsModal() {
    closeAllModals();
    soundSettingsModal.classList.remove('hidden');
    renderSoundSettingsForm();
    setSoundStatus('');
    if (!soundSettingsLoaded) loadSoundSettings().catch(() => {});
  }

  function openAiBotSettingsModal() {
    if (!currentUser?.is_admin) return;
    closeAllModals();
    aiBotSettingsModal.classList.remove('hidden');
    setAiBotStatus('Загружаю...');
    loadAiBotState().then(() => setAiBotStatus('')).catch((e) => {
      setAiBotStatus(e.message || 'Не удалось загрузить AI-ботов', 'error');
    });
  }

  function resetChangePasswordFields() {
    ['cpOldPass', 'cpNewPass', 'cpNewPassConfirm'].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      input.value = '';
      input.type = 'password';
    });
  }

  function openChangePasswordModal() {
    closeAllModals();
    changePasswordModal.classList.remove('hidden');
    resetChangePasswordFields();
    $('#cpError').textContent = '';
    $('#cpSuccess').textContent = '';
  }

  // Chat info modal
  async function openChatInfoModal() {
    if (!currentChatId) return;
    closeAllModals();
    chatInfoModal.classList.remove('hidden');

    const chat = chats.find(c => c.id === currentChatId);
    $('#chatInfoTitle').textContent = chat ? chat.name : 'Chat Info';

    // Sync compact view toggle
    $('#compactViewToggle').checked = compactView;
    await loadChatPreferences(currentChatId);

    // Group edit section
    const editSection = $('#chatEditSection');
    if (chat && (chat.type === 'group' || chat.type === 'general')) {
      editSection.classList.remove('hidden');
      const chatAvatarEl = $('#chatAvatar');
      const removeChatAvatarBtn = $('#removeChatAvatar');

      if (chat.avatar_url) {
        chatAvatarEl.style.background = '#5eb5f7';
        chatAvatarEl.innerHTML = `<img class="avatar-img" src="${esc(chat.avatar_url)}" alt="">`;
        removeChatAvatarBtn.classList.remove('hidden');
      } else {
        chatAvatarEl.style.background = '#5eb5f7';
        chatAvatarEl.innerHTML = chat.type === 'general' ? '🌐' : '👥';
        removeChatAvatarBtn.classList.add('hidden');
      }

      $('#chatNameInput').value = chat.name;

      // Save name
      $('#saveChatNameBtn').onclick = async () => {
        const name = $('#chatNameInput').value.trim();
        if (!name) return;
        try {
          await api(`/api/chats/${currentChatId}`, { method: 'PUT', body: { name } });
          await loadChats();
          closeAllModals();
          chatTitle.textContent = name;
        } catch (e) { alert(e.message); }
      };

      // Upload chat avatar
      $('#chatAvatarInput').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('avatar', file);
        try {
          await api(`/api/chats/${currentChatId}/avatar`, { method: 'POST', body: fd });
          await loadChats();
          openChatInfoModal();
        } catch (e) { alert(e.message); }
      };

      // Remove chat avatar
      removeChatAvatarBtn.onclick = async () => {
        try {
          await api(`/api/chats/${currentChatId}/avatar`, { method: 'DELETE' });
          await loadChats();
          openChatInfoModal();
        } catch (e) { alert(e.message); }
      };
    } else {
      editSection.classList.add('hidden');
    }

    // Background controls (available for all chats)
    try {
      const bgPreviewEl = $('#chatBackgroundPreview');
      const bgInput = $('#chatBackgroundInput');
      const removeBgBtn = $('#removeChatBackground');
      const bgStyleSelect = $('#chatBackgroundStyle');

      if (bgPreviewEl) {
        if (chat && chat.background_url) {
          bgPreviewEl.style.backgroundImage = `url(${esc(chat.background_url)})`;
          applyBackgroundStyleToElement(bgPreviewEl, chat.background_style || 'cover');
          removeBgBtn.classList.remove('hidden');
        } else {
          bgPreviewEl.style.backgroundImage = '';
          applyBackgroundStyleToElement(bgPreviewEl, 'cover');
          removeBgBtn.classList.add('hidden');
        }
        bgStyleSelect.value = chat && chat.background_style ? chat.background_style : 'cover';

        bgInput.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const fd = new FormData();
          fd.append('background', file);
          fd.append('style', bgStyleSelect.value || 'cover');
          try {
            await api(`/api/chats/${currentChatId}/background`, { method: 'POST', body: fd });
            await loadChats();
            openChatInfoModal();
            const updated = chats.find(c => c.id === currentChatId);
            applyChatBackground(updated);
          } catch (err) { alert(err.message); }
        };

        removeBgBtn.onclick = async () => {
          if (!confirm('Remove background?')) return;
          try {
            await api(`/api/chats/${currentChatId}/background`, { method: 'DELETE' });
            await loadChats();
            openChatInfoModal();
            const updated = chats.find(c => c.id === currentChatId);
            applyChatBackground(updated);
          } catch (err) { alert(err.message); }
        };

        bgStyleSelect.onchange = async () => {
          try {
            const style = bgStyleSelect.value;
            await api(`/api/chats/${currentChatId}/background-style`, { method: 'PUT', body: { style } });
            await loadChats();
            openChatInfoModal();
            const updated = chats.find(c => c.id === currentChatId);
            applyChatBackground(updated);
          } catch (err) { alert(err.message); }
        };
      }
    } catch (e) {}

    try {
      const members = await api(`/api/chats/${currentChatId}/members`);
      const memberList = $('#chatMemberList');
      const canRemove = chat && chat.type === 'group' && (chat.created_by === currentUser.id || currentUser.is_admin);

      memberList.innerHTML = members.map(u => `
        <div class="user-list-item" data-uid="${u.id}">
          ${avatarHtml(u.display_name, u.avatar_color, u.avatar_url)}
          <div>
            <div class="name">${esc(u.display_name)}</div>
            <div class="status-text">${onlineUsers.has(u.id) ? 'online' : 'offline'}</div>
          </div>
          ${canRemove && u.id !== currentUser.id ? `<button class="member-remove" data-uid="${u.id}" title="Remove">✕</button>` : ''}
        </div>
      `).join('');

      // Remove member handlers
      memberList.querySelectorAll('.member-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Remove this member?')) return;
          try {
            await api(`/api/chats/${currentChatId}/members/${btn.dataset.uid}`, { method: 'DELETE' });
            openChatInfoModal();
          } catch (e) { alert(e.message); }
        });
      });

      // Add member section for groups
      const addWrap = $('#addMemberWrap');
      if (chat && chat.type === 'group') {
        addWrap.classList.remove('hidden');
        const allUsers = await api('/api/users');
        const memberIds = new Set(members.map(m => m.id));
        const nonMembers = allUsers.filter(u => !memberIds.has(u.id));

        const addList = $('#addMemberList');
        addList.innerHTML = nonMembers.map(u => `
          <div class="user-list-item" data-uid="${u.id}">
            ${avatarHtml(u.display_name, u.avatar_color, u.avatar_url)}
            <div><div class="name">${esc(u.display_name)}</div></div>
          </div>
        `).join('') || '<div style="color:var(--text-secondary)">All users are already members</div>';

        addList.querySelectorAll('.user-list-item').forEach(el => {
          el.addEventListener('click', async () => {
            try {
              await api(`/api/chats/${currentChatId}/members`, { method: 'POST', body: { userId: +el.dataset.uid } });
              openChatInfoModal();
            } catch {}
          });
        });
      } else {
        addWrap.classList.add('hidden');
      }
    } catch {}
  }

  // Profile editor (menu drawer)
  const AVATAR_COLORS = ['#e17076','#7bc862','#e5ca77','#65aadd','#a695e7','#ee7aae','#6ec9cb','#faa774'];

  function openMenuDrawer() {
    closeAllModals();
    menuDrawer.classList.remove('hidden');

    // Avatar
    const avatarEl = $('#profileAvatar');
    avatarEl.style.background = currentUser.avatar_color;
    if (currentUser.avatar_url) {
      avatarEl.innerHTML = `<img class="avatar-img" src="${esc(currentUser.avatar_url)}" alt="">`;
      $('#removeProfileAvatar').classList.remove('hidden');
    } else {
      avatarEl.innerHTML = initials(currentUser.display_name);
      $('#removeProfileAvatar').classList.add('hidden');
    }

    // Fields
    $('#profileUsername').textContent = '@' + currentUser.username;
    $('#profileName').value = currentUser.display_name;

    // Color picker
    const picker = $('#colorPicker');
    picker.innerHTML = AVATAR_COLORS.map(c =>
      `<div class="color-swatch${c === currentUser.avatar_color ? ' active' : ''}" data-color="${c}" style="background:${c}"></div>`
    ).join('');
  }

  function setupProfileEvents() {
    // Upload avatar
    $('#profileAvatarInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('avatar', file);
      try {
        const res = await api('/api/profile/avatar', { method: 'POST', body: fd });
        currentUser.avatar_url = res.user.avatar_url;
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateCurrentUserFooter();
        openMenuDrawer();
      } catch (e) { alert(e.message); }
    });

    // Remove avatar
    $('#removeProfileAvatar').addEventListener('click', async () => {
      try {
        await api('/api/profile/avatar', { method: 'DELETE' });
        currentUser.avatar_url = null;
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateCurrentUserFooter();
        openMenuDrawer();
      } catch (e) { alert(e.message); }
    });

    // Color picker
    $('#colorPicker').addEventListener('click', (e) => {
      const swatch = e.target.closest('.color-swatch');
      if (!swatch) return;
      $('#colorPicker').querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
    });

    // Save
    $('#saveProfileBtn').addEventListener('click', async () => {
      const name = $('#profileName').value.trim();
      if (!name) return;
      const activeSwatch = $('#colorPicker .color-swatch.active');
      const color = activeSwatch ? activeSwatch.dataset.color : currentUser.avatar_color;
      try {
        const res = await api('/api/profile', { method: 'PUT', body: { displayName: name, avatarColor: color } });
        currentUser.display_name = res.user.display_name;
        currentUser.avatar_color = res.user.avatar_color;
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateCurrentUserFooter();
        await loadChats();
        closeAllModals();
      } catch (e) { alert(e.message); }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO RESIZE TEXTAREA
  // ═══════════════════════════════════════════════════════════════════════════
  function autoResize() {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 150) + 'px';
  }

  function animateSendButton() {
    if (!sendBtn) return;
    sendBtn.classList.remove('send-fly');
    void sendBtn.offsetWidth;
    sendBtn.classList.add('send-fly');
    clearTimeout(sendBtn.__sendFlyTimer);
    sendBtn.__sendFlyTimer = setTimeout(() => {
      sendBtn.classList.remove('send-fly');
      window.BananzaVoiceHooks?.refreshComposerState?.();
    }, 320);
  }

  function setupPasswordPreviewToggles() {
    $$('.pw-toggle').forEach(btn => {
      if (btn.dataset.bound === '1') return;
      const targetId = btn.dataset.target;
      const getInput = () => targetId ? document.getElementById(targetId) : null;
      const setVisible = (visible) => {
        const input = getInput();
        if (!input) return;
        input.type = visible ? 'text' : 'password';
        btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
      };
      let pressPreviewed = false;
      const show = (e) => {
        e.preventDefault();
        pressPreviewed = true;
        setVisible(true);
      };
      const hide = (e) => {
        e?.preventDefault?.();
        setVisible(false);
      };

      btn.dataset.bound = '1';
      btn.addEventListener('pointerdown', show);
      btn.addEventListener('pointerup', hide);
      btn.addEventListener('pointercancel', hide);
      btn.addEventListener('pointerleave', hide);
      btn.addEventListener('touchstart', show, { passive: false });
      btn.addEventListener('touchend', hide, { passive: false });
      btn.addEventListener('touchcancel', hide, { passive: false });
      btn.addEventListener('blur', hide);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (pressPreviewed) {
          pressPreviewed = false;
          return;
        }
        setVisible(true);
        setTimeout(() => setVisible(false), 500);
      });
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') show(e);
      });
      btn.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' || e.key === ' ') hide(e);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════
  function setupEvents() {
    setupPasswordPreviewToggles();
    setupSwipeReplyGesture();
    setupSwipeEditGesture();

    // Send message
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sendBtn.blur();
      sendMessage();
      // Keep keyboard open on mobile
      if (window.innerWidth <= 768) msgInput.focus();
    });
    msgInput.addEventListener('keydown', (e) => {
      if (handleMentionPickerKeydown(e)) return;
      if (e.key === 'Enter') {
        if (sendByEnter && !e.shiftKey && !e.ctrlKey) { e.preventDefault(); sendMessage(); }
        else if (!sendByEnter && e.ctrlKey) { e.preventDefault(); sendMessage(); }
      }
    });
    msgInput.addEventListener('input', () => {
      autoResize();
      window.BananzaVoiceHooks?.refreshComposerState?.();
      updateMentionPicker();
      // Typing indicator
      if (!typingSendTimeout) {
        sendTyping();
        typingSendTimeout = setTimeout(() => { typingSendTimeout = null; }, 2000);
      }
    });
    msgInput.addEventListener('click', updateMentionPicker);
    msgInput.addEventListener('keyup', (e) => {
      if (!['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) updateMentionPicker();
    });
    window.visualViewport?.addEventListener('resize', () => {
      positionMentionPicker();
      positionAvatarUserMenu(avatarUserMenuState?.anchor);
    });
    document.addEventListener('pointerdown', (e) => {
      const picker = $('#mentionPicker');
      if (!picker || picker.classList.contains('hidden')) return;
      if (picker.contains(e.target) || e.target === msgInput) return;
      hideMentionPicker();
    });
    document.addEventListener('pointerdown', (e) => {
      const menu = $('#avatarUserMenu');
      if (!menu || menu.classList.contains('hidden')) return;
      if (menu.contains(e.target) || e.target.closest('.msg-group-avatar')) return;
      hideAvatarUserMenu();
    });

    // File attach
    const fileInputGallery = $('#fileInputGallery');
    const fileInputCamera = $('#fileInputCamera');
    const fileInputDocs = $('#fileInputDocs');
    const attachMenu = $('#attachMenu');
    const attachMenuOverlay = $('#attachMenuOverlay');
    const isMobileAttachMenu = () => window.innerWidth <= 768;
    const positionAttachMenu = () => {
      if (!attachMenu || attachMenu.classList.contains('hidden')) return;
      const rect = attachBtn.getBoundingClientRect();
      const vv = window.visualViewport;
      const viewportLeft = vv ? vv.offsetLeft : 0;
      const viewportTop = vv ? vv.offsetTop : 0;
      const viewportWidth = vv ? vv.width : window.innerWidth;
      const viewportHeight = vv ? vv.height : window.innerHeight;
      const mw = attachMenu.offsetWidth || 160;
      const mh = attachMenu.offsetHeight || 145;
      let left = rect.left + viewportLeft;
      left = Math.max(viewportLeft + 8, Math.min(left, viewportLeft + viewportWidth - mw - 8));
      const preferredTop = rect.top + viewportTop - mh - 8;
      const fallbackTop = rect.bottom + viewportTop + 8;
      const maxTop = Math.max(viewportTop + 8, viewportTop + viewportHeight - mh - 8);
      let top = preferredTop;
      if (top < viewportTop + 8) top = Math.min(fallbackTop, maxTop);
      top = Math.max(viewportTop + 8, Math.min(top, maxTop));
      attachMenu.style.left = left + 'px';
      attachMenu.style.top = top + 'px';
    };
    const closeAttachMenu = () => { attachMenu.classList.add('hidden'); };
    const keepAttachButtonFromBlurringInput = (e) => {
      if (!isMobileAttachMenu()) return;
      e.preventDefault();
    };

    attachBtn.addEventListener('pointerdown', keepAttachButtonFromBlurringInput, { passive: false });
    attachBtn.addEventListener('mousedown', keepAttachButtonFromBlurringInput);

    attachBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (editTo) return;
      if (isMobileAttachMenu()) {
        const keepKeyboardOpen = isMobileComposerKeyboardOpen();
        if (!attachMenu.classList.contains('hidden')) {
          attachMenu.classList.add('hidden');
          return;
        }
        attachMenu.classList.remove('hidden');
        positionAttachMenu();
        if (keepKeyboardOpen) focusComposerKeepKeyboard(true);
      } else {
        fileInput.click();
      }
    });
    window.visualViewport?.addEventListener('resize', () => {
      if (isMobileAttachMenu() && !attachMenu.classList.contains('hidden')) {
        positionAttachMenu();
      }
    });
    // Close on outside click (no overlay needed)
    document.addEventListener('click', (e) => {
      if (!attachMenu.classList.contains('hidden') && !attachMenu.contains(e.target) && e.target !== attachBtn) {
        attachMenu.classList.add('hidden');
      }
    });
    attachMenuOverlay.addEventListener('click', closeAttachMenu);
    $('#attachMenuCancel') && $('#attachMenuCancel').addEventListener('click', closeAttachMenu);
    $('#attachMenuGallery').addEventListener('click', () => { closeAttachMenu(); fileInputGallery.click(); });
    $('#attachMenuCamera').addEventListener('click', () => { closeAttachMenu(); fileInputCamera.click(); });
    $('#attachMenuFile').addEventListener('click', () => { closeAttachMenu(); fileInputDocs.click(); });

    fileInput.addEventListener('change', () => { if (fileInput.files.length > 0) uploadFiles(fileInput.files); });
    fileInputGallery.addEventListener('change', () => { if (fileInputGallery.files.length > 0) { uploadFiles(fileInputGallery.files); fileInputGallery.value = ''; } });
    fileInputCamera.addEventListener('change', () => { if (fileInputCamera.files.length > 0) { uploadFiles(fileInputCamera.files); fileInputCamera.value = ''; } });
    fileInputDocs.addEventListener('change', () => { if (fileInputDocs.files.length > 0) { uploadFiles(fileInputDocs.files); fileInputDocs.value = ''; } });

    // Emoji
    emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      emojiPicker.classList.toggle('hidden');
    });

    // Media viewer close
    imageViewer.addEventListener('click', (e) => {
      if (e.target.closest('.iv-prev')) { galleryNav(-1); return; }
      if (e.target.closest('.iv-next')) { galleryNav(1); return; }
      if (e.target.closest('.iv-close') || e.target.classList.contains('iv-slide')) closeMediaViewer();
    });
    document.addEventListener('keydown', (e) => {
      if (imageViewer.classList.contains('hidden')) return;
      if (e.key === 'ArrowLeft') galleryNav(-1);
      else if (e.key === 'ArrowRight') galleryNav(1);
      else if (e.key === 'Escape') closeMediaViewer();
    });

    messagesEl.addEventListener('pointerdown', (e) => {
      const avatar = e.target.closest('.msg-group-avatar');
      if (!avatar || !messagesEl.contains(avatar) || !isGroupLikeCurrentChat()) return;
      e.preventDefault();
      e.stopPropagation();
      openAvatarUserMenu(avatar);
    }, { passive: false });
    messagesEl.addEventListener('keydown', (e) => {
      const avatar = e.target.closest('.msg-group-avatar');
      if (!avatar || !isGroupLikeCurrentChat() || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      openAvatarUserMenu(avatar);
    });

    // Strip swipe + pinch-zoom + double-tap for media viewer
    (() => {
      let startX = 0, startY = 0, dragging = false, dx = 0;
      let panBaseX = 0, panBaseY = 0;
      let pinching = false, pinchDist0 = 0, scaleBase = 1;
      const MAX_SCALE = 5;
      let lastTapTime = 0, lastTapX = 0, lastTapY = 0;

      imageViewer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          // Pinch zoom for images only
          if (galleryItems[galleryIndex]?.type !== 'video') {
            pinching = true; dragging = false;
            const t = e.touches;
            pinchDist0 = Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
            scaleBase = ivScale;
          }
          return;
        }
        if (e.touches.length === 1) {
          const now = Date.now();
          const tx = e.touches[0].clientX;
          const ty = e.touches[0].clientY;
          // Double-tap to zoom (images only)
          if (
            galleryItems[galleryIndex]?.type !== 'video' &&
            now - lastTapTime < 300 &&
            Math.abs(tx - lastTapX) < 40 &&
            Math.abs(ty - lastTapY) < 40
          ) {
            lastTapTime = 0;
            if (ivScale > 1) {
              ivResetZoom();
            } else {
              const ZOOM = 2.5;
              ivScale = ZOOM;
              ivPanX = (tx - window.innerWidth / 2) * (1 / ZOOM - 1);
              ivPanY = (ty - window.innerHeight / 2) * (1 / ZOOM - 1);
              ivApplyTransform();
            }
            return;
          }
          lastTapTime = now;
          lastTapX = tx;
          lastTapY = ty;
          startX = tx;
          startY = ty;
          panBaseX = ivPanX; panBaseY = ivPanY;
          dragging = false; dx = 0;
          if (ivScale === 1) ivStrip.style.transition = 'none';
        }
      }, { passive: true });

      imageViewer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
          if (galleryItems[galleryIndex]?.type === 'video') return;
          const t = e.touches;
          const dist = Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
          ivScale = Math.min(MAX_SCALE, Math.max(1, scaleBase * dist / pinchDist0));
          ivApplyTransform();
          return;
        }
        if (pinching || e.touches.length !== 1) return;
        const cx = e.touches[0].clientX;
        const cy = e.touches[0].clientY;
        if (ivScale > 1) {
          ivPanX = panBaseX + (cx - startX) / ivScale;
          ivPanY = panBaseY + (cy - startY) / ivScale;
          ivApplyTransform();
          return;
        }
        dx = cx - startX;
        const dy = cy - startY;
        if (!dragging && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) dragging = true;
        if (!dragging) return;
        ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth + dx}px)`;
      }, { passive: true });

      imageViewer.addEventListener('touchend', (e) => {
        if (pinching) {
          if (e.touches.length < 2) pinching = false;
          return;
        }
        if (ivScale > 1) return;
        if (dragging && Math.abs(dx) > 50) {
          galleryNav(dx < 0 ? 1 : -1);
        } else {
          ivStrip.style.transition = 'transform 0.3s ease';
          ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;
          updateGalleryArrows();
        }
        dragging = false;
      }, { passive: true });

      window.addEventListener('resize', () => {
        if (!imageViewer.classList.contains('hidden')) {
          ivStrip.style.transition = 'none';
          ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;
        }
      });
    })();

    // Reaction picker: emoji click
    const keepReactionInteractionFromBlurringInput = (e) => {
      if (e.type === 'touchstart' && 'PointerEvent' in window) return;
      if (preventMobileComposerBlur(e)) reactionPickerKeepKeyboard = true;
    };
    reactionPicker.addEventListener('pointerdown', keepReactionInteractionFromBlurringInput);
    reactionPicker.addEventListener('touchstart', keepReactionInteractionFromBlurringInput, { passive: false });
    reactionPicker.addEventListener('mousedown', (e) => {
      keepReactionInteractionFromBlurringInput(e);
      e.preventDefault(); // prevent blur/focus changes
      e.stopPropagation();
    });
    reactionPicker.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.target.closest('button[data-emoji]');
      if (btn && reactionPickerMsgId) {
        const keepComposerFocus = reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen();
        toggleReaction(reactionPickerMsgId, btn.dataset.emoji, { keepComposerFocus });
      }
    });

    // Reaction picker: close on outside click
    document.addEventListener('click', (e) => {
      if (!reactionPicker.classList.contains('hidden') && !reactionPicker.contains(e.target) && !e.target.closest('.msg-react-btn')) {
        hideReactionPicker();
      }
    });

    // Reaction badge click + react button (delegation)
    messagesEl.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.msg-react-btn, .reaction-badge')) return;
      keepReactionInteractionFromBlurringInput(e);
    });
    messagesEl.addEventListener('touchstart', (e) => {
      if (!e.target.closest('.msg-react-btn, .reaction-badge')) return;
      keepReactionInteractionFromBlurringInput(e);
    }, { passive: false });
    messagesEl.addEventListener('click', (e) => {
      const reactBtn = e.target.closest('.msg-react-btn');
      if (reactBtn) {
        e.stopPropagation();
        const row = reactBtn.closest('.msg-row');
        if (row) {
          const keepComposerFocus = reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen();
          showReactionPicker(row, reactBtn, { keepComposerFocus });
        }
        return;
      }
      const badge = e.target.closest('.reaction-badge');
      if (badge) {
        const row = badge.closest('.msg-row');
        if (row) {
          const keepComposerFocus = reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen();
          toggleReaction(+row.dataset.msgId, badge.dataset.emoji, { keepComposerFocus });
        }
      }
    });

    // Long press on message for reaction picker (mobile)
    (() => {
      let lpTimer = null;
      messagesEl.addEventListener('touchstart', (e) => {
        const row = e.target.closest('.msg-row');
        if (!row || e.target.closest('.msg-react-btn, .msg-reply-btn, .msg-edit-btn, .msg-forward-btn, .msg-group-avatar') || e.target.closest('.reaction-badge')) return;
        lpTimer = setTimeout(() => {
          lpTimer = null;
          navigator.vibrate && navigator.vibrate(30);
          showReactionPicker(row, null, { keepComposerFocus: isMobileComposerKeyboardOpen() });
        }, 500);
      }, { passive: true });
      messagesEl.addEventListener('touchend', () => { clearTimeout(lpTimer); lpTimer = null; }, { passive: true });
      messagesEl.addEventListener('touchmove', () => { clearTimeout(lpTimer); lpTimer = null; }, { passive: true });
      // Desktop right-click
      messagesEl.addEventListener('contextmenu', (e) => {
        const row = e.target.closest('.msg-row');
        if (!row) return;
        e.preventDefault();
        showReactionPicker(row, null);
      });
    })();

    // Sidebar search
    chatSearch.addEventListener('input', () => {
      renderChatList(chatSearch.value);
      $('#chatSearchClear').classList.toggle('hidden', !chatSearch.value);
    });
    $('#chatSearchClear').addEventListener('click', () => {
      chatSearch.value = '';
      renderChatList();
      $('#chatSearchClear').classList.add('hidden');
      chatSearch.focus();
    });

    // Back button (mobile)
    $('#backBtn').addEventListener('click', () => {
      sidebar.classList.remove('sidebar-hidden');
      if (history.state && history.state.chat) history.back();
    });

    // Android back gesture / button
    window.addEventListener('popstate', (e) => {
      if (window.innerWidth <= 768) {
        // Skip: popstate was triggered by closeMediaViewer's history.back()
        if (ivSkipNextPopstate) {
          ivSkipNextPopstate = false;
          return;
        }
        // Close media viewer if open (back pressed while viewing media)
        if (!imageViewer.classList.contains('hidden')) {
          ivStrip.querySelectorAll('video').forEach(v => v.pause());
          imageViewer.classList.add('hidden');
          ivHistoryPushed = false;
          return;
        }
        if (sidebar.classList.contains('sidebar-hidden')) {
          // Going back from chat to chat list
          sidebar.classList.remove('sidebar-hidden');
        } else {
          // Already on chat list — push state back to prevent exit
          history.pushState({ view: 'chatlist' }, '');
        }
      }
    });

    // New chat
    $('#newChatBtn').addEventListener('click', openNewChatModal);
    $('#refreshChatsBtn')?.addEventListener('click', async () => {
      await loadChats();
      if (currentChatId) updateChatStatus();
    });

    // Create group
    $('#createGroupBtn').addEventListener('click', async () => {
      const name = $('#groupName').value.trim();
      if (!name) { alert('Enter group name'); return; }
      const selected = [...$$('#userListGroup .user-list-item.selected')].map(el => +el.dataset.uid);
      try {
        const chat = await api('/api/chats', { method: 'POST', body: { name, type: 'group', memberIds: selected } });
        closeAllModals();
        await loadChats();
        openChat(chat.id);
      } catch (e) { alert(e.message); }
    });

    // Modal tabs
    newChatModal.querySelectorAll('.modal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        newChatModal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        newChatModal.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
      });
    });

    // Modal close buttons
    $$('.modal-close').forEach(btn => {
      btn.addEventListener('click', closeAllModals);
    });
    $$('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => { if (e.target === modal) closeAllModals(); });
    });

    forwardChatSearch?.addEventListener('input', () => {
      renderForwardChatList(forwardChatSearch.value);
      setForwardMessageStatus('');
    });
    forwardChatList?.addEventListener('click', (e) => {
      const btn = e.target.closest('.forward-chat-item');
      if (!btn) return;
      forwardMessageToChat(+btn.dataset.chatId);
    });

    // Settings button
    $('#settingsBtn').addEventListener('click', openSettingsModal);

    // Settings sub-buttons
    $('#settingsThemePanel').addEventListener('click', openThemeSettingsModal);
    $('#settingsWeatherPanel').addEventListener('click', openWeatherSettingsModal);
    $('#settingsNotificationsPanel')?.addEventListener('click', openNotificationSettingsModal);
    $('#settingsSoundsPanel')?.addEventListener('click', openSoundSettingsModal);
    $('#settingsAiBotsPanel')?.addEventListener('click', openAiBotSettingsModal);
    $('#settingsChangePassword').addEventListener('click', openChangePasswordModal);
    $('#settingsAdminPanel').addEventListener('click', openAdminModal);

    // Send by Enter toggle
    $('#settingsSendEnter').addEventListener('change', (e) => {
      sendByEnter = e.target.checked;
      localStorage.setItem('sendByEnter', sendByEnter ? '1' : '0');
    });

    // Scroll restore toggle
    $('#settingsScrollRestore').addEventListener('change', (e) => {
      scrollRestoreMode = e.target.checked ? 'restore' : 'bottom';
      localStorage.setItem('scrollRestoreMode', scrollRestoreMode);
    });

    // Startup view toggle
    $('#settingsOpenLastChat').addEventListener('change', (e) => {
      openLastChatOnReload = e.target.checked;
      localStorage.setItem('openLastChatOnReload', openLastChatOnReload ? '1' : '0');
    });

    // UI theme picker
    $('#settingsThemePicker')?.addEventListener('click', (e) => {
      const card = e.target.closest('.theme-card');
      if (!card) return;
      selectUiTheme(card.dataset.theme);
    });

    // Weather settings
    $('#settingsWeatherEnabled')?.addEventListener('change', async (e) => {
      $('#settingsWeatherControls')?.classList.toggle('hidden', !e.target.checked);
      if (!e.target.checked) await saveWeatherSettings();
    });
    $('#settingsWeatherSearchBtn')?.addEventListener('click', searchWeatherLocations);
    $('#settingsWeatherSearch')?.addEventListener('input', () => {
      clearTimeout(weatherSearchTimer);
      if ($('#settingsWeatherSearch').value.trim().length < 2) {
        renderWeatherSearchResults([]);
        return;
      }
      weatherSearchTimer = setTimeout(searchWeatherLocations, 350);
    });
    $('#settingsWeatherSearch')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchWeatherLocations();
      }
    });
    $('#settingsWeatherResults')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.weather-result-item');
      if (!btn) return;
      selectedWeatherLocation = weatherSearchResults[+btn.dataset.index] || null;
      renderWeatherSettingsForm({
        enabled: $('#settingsWeatherEnabled')?.checked,
        refresh_minutes: $('#settingsWeatherRefresh')?.value,
      });
      renderWeatherSearchResults([]);
      setWeatherStatus(selectedWeatherLocation ? 'City selected, save settings' : '', selectedWeatherLocation ? 'success' : '');
    });
    $('#settingsWeatherSave')?.addEventListener('click', saveWeatherSettings);
    $('#settingsWeatherRefreshNow')?.addEventListener('click', saveWeatherSettings);

    // Notification settings
    $('#settingsPushEnable')?.addEventListener('click', enablePushNotifications);
    $('#settingsPushDisable')?.addEventListener('click', disablePushOnThisDevice);
    $('#settingsPushTest')?.addEventListener('click', testPushNotification);
    $('#settingsNotificationsEnabled')?.addEventListener('change', async (e) => {
      await saveNotificationSettings({ push_enabled: e.target.checked });
      if (e.target.checked && !pushDeviceSubscribed) {
        if (!isPushSupported()) {
          setNotificationStatus('Настройки сохранены, но на этом устройстве Web Push недоступен.', 'success');
        } else if (Notification.permission === 'denied') {
          setNotificationStatus('Настройки сохранены, но браузер запретил уведомления. Разрешите их в настройках сайта.', 'success');
        } else {
          setNotificationStatus('Настройки сохранены. Чтобы получать push на этом устройстве, нажмите «Включить на этом устройстве».', 'success');
        }
      }
    });
    ['settingsNotifyMessages', 'settingsNotifyChatInvites', 'settingsNotifyReactions', 'settingsNotifyMentions'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => saveNotificationSettings());
    });

    // Sound settings
    [
      'settingsSoundsEnabled',
      'settingsSoundSend',
      'settingsSoundIncoming',
      'settingsSoundNotifications',
      'settingsSoundReactions',
      'settingsSoundInvites',
      'settingsSoundVoice',
      'settingsSoundMentions',
    ].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => saveSoundSettings());
    });
    $('#settingsSoundsVolume')?.addEventListener('input', () => scheduleSoundSettingsSave());
    $('#settingsSoundsVolume')?.addEventListener('change', () => saveSoundSettings());
    $('#settingsSoundsBlock')?.addEventListener('click', (event) => {
      const previewBtn = event.target.closest('[data-sound-preview]');
      if (!previewBtn) return;
      event.preventDefault();
      event.stopPropagation();
      previewSound(previewBtn.dataset.soundPreview);
    });
    $('#settingsSoundPreviewAll')?.addEventListener('click', previewAllSounds);

    // AI bot admin settings
    $('#aiBotsSaveSettings')?.addEventListener('click', saveAiBotSettings);
    $('#aiBotsDeleteKey')?.addEventListener('click', deleteAiBotKey);
    $('#aiBotCreateNew')?.addEventListener('click', () => {
      fillAiBotForm(null);
      setAiBotStatus('Новый бот: заполните поля и сохраните');
    });
    $('#aiBotSave')?.addEventListener('click', saveAiBot);
    $('#aiBotDisable')?.addEventListener('click', disableAiBot);
    $('#aiBotTest')?.addEventListener('click', testAiBot);
    $('#aiBotList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-bot-list-item');
      if (!btn) return;
      const bot = aiBotState.bots.find(item => item.id === Number(btn.dataset.botId));
      if (bot) fillAiBotForm(bot);
    });
    $('#aiBotChatSelect')?.addEventListener('change', renderAiChatBotSettings);
    $('#aiBotChatBotSelect')?.addEventListener('change', renderAiChatBotSettings);
    $('#aiBotChatSave')?.addEventListener('click', saveAiChatBotSettings);

    // Change password save
    $('#cpSaveBtn').addEventListener('click', async () => {
      const cpErr = $('#cpError');
      const cpOk = $('#cpSuccess');
      cpErr.textContent = '';
      cpOk.textContent = '';
      const oldPass = $('#cpOldPass').value;
      const newPass = $('#cpNewPass').value;
      const confirmPass = $('#cpNewPassConfirm').value;
      if (!oldPass || !newPass) { cpErr.textContent = 'Fill in all fields'; return; }
      if (newPass !== confirmPass) { cpErr.textContent = 'New passwords do not match'; return; }
      if (newPass.length < 6) { cpErr.textContent = 'Password must be at least 6 characters'; return; }
      try {
        await api('/api/profile/change-password', { method: 'POST', body: { oldPassword: oldPass, newPassword: newPass } });
        cpOk.textContent = 'Password changed successfully!';
        resetChangePasswordFields();
      } catch (e) { cpErr.textContent = e.message; }
    });

    // Menu button
    $('#menuBtn').addEventListener('click', openMenuDrawer);

    // Chat info button
    $('#chatInfoBtn').addEventListener('click', openChatInfoModal);

    // Compact view toggle (per-chat)
    $('#compactViewToggle').addEventListener('change', (e) => {
      compactView = e.target.checked;
      if (currentChatId) {
        if (compactView) compactViewMap[currentChatId] = true;
        else delete compactViewMap[currentChatId];
        localStorage.setItem('compactViewMap', JSON.stringify(compactViewMap));
      }
      messagesEl.classList.toggle('compact-view', compactView);
      // Re-render
      if (currentChatId) openChat(currentChatId);
    });
    $('#chatNotifyToggle')?.addEventListener('change', () => saveChatPreferences());
    $('#chatSoundToggle')?.addEventListener('change', () => saveChatPreferences());

    // Logout
    $('#logoutBtn').addEventListener('click', () => { if (confirm('Logout?')) logout(); });

    // Load more
    loadMoreBtn.addEventListener('click', loadMore);
    scrollBottomBtn?.addEventListener('mousedown', (e) => e.preventDefault());
    scrollBottomBtn?.addEventListener('click', () => {
      scrollBottomBtn.blur();
      scrollToBottom();
    });

    // Scroll to load more
    messagesEl.addEventListener('scroll', () => {
      hideAvatarUserMenu();
      if (currentChatId) scrollPositions[currentChatId] = messagesEl.scrollTop;
      if (messagesEl.scrollTop < 60 && hasMore && !loadingMore) loadMore();
      updateScrollBottomButton();
    });

    // Close emoji picker on outside click
    document.addEventListener('click', (e) => {
      if (!emojiPicker.classList.contains('hidden') && !emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.classList.add('hidden');
      }
    });

    // Reply bar close
    $('#replyBarClose').addEventListener('click', () => {
      if (editTo) clearEdit({ clearInput: true });
      else clearReply();
    });

    // Search
    $('#searchBtn').addEventListener('click', openSearchPanel);
    $('#searchClose').addEventListener('click', closeSearchPanel);
    searchInput.addEventListener('input', performSearch);

    // Drag & drop
    chatView.addEventListener('dragenter', handleDragEnter);
    chatView.addEventListener('dragover', handleDragOver);
    chatView.addEventListener('dragleave', handleDragLeave);
    chatView.addEventListener('drop', handleDrop);

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideAvatarUserMenu();
        closeSearchPanel();
        clearReply();
        closeAllModals();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════
  async function init() {
    if (!checkAuth()) return;

    // Mobile keyboard resize fix
    if (window.visualViewport && window.innerWidth <= 768) {
      const app = document.getElementById('app');
      let prevVVHeight = window.visualViewport.height;
      const onVVResize = () => {
        const newHeight = window.visualViewport.height;
        app.style.height = newHeight + 'px';
        // If keyboard appeared (viewport shrunk) — scroll messages to bottom
        if (newHeight < prevVVHeight) {
          requestAnimationFrame(() => {
            messagesEl.scrollTop = messagesEl.scrollHeight;
          });
        }
        prevVVHeight = newHeight;
      };
      window.visualViewport.addEventListener('resize', onVVResize);
    }

    // Mobile navigation: set initial history state for chat list
    if (window.innerWidth <= 768) {
      history.replaceState({ view: 'chatlist' }, '');
    }

    // Verify token
    try {
      const data = await api('/api/auth/me');
      currentUser = data.user;
      applyUiTheme(currentUser.ui_theme);
      localStorage.setItem('user', JSON.stringify(currentUser));
    } catch { return; }

    // Update UI
    updateCurrentUserFooter();
    loadWeatherSettings().then(() => loadCurrentWeather(false)).catch(() => {});
    await loadSoundSettings().catch(() => {});
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    loadNotificationSettings().catch(() => {});

    setupEvents();
    setupProfileEvents();
    initEmojiPicker();
    connectWS();
    await loadAllUsers();
    await loadChats();

    // Optional startup behavior: push deep-link, restore the last opened chat, or stay on the chat list.
    const startupChatId = Number(new URLSearchParams(location.search).get('chatId'));
    if (startupChatId && chats.find(c => c.id === startupChatId)) {
      await openChat(startupChatId);
      history.replaceState(history.state || {}, '', location.pathname);
    } else if (openLastChatOnReload) {
      const lastChat = +localStorage.getItem('lastChat');
      if (lastChat && chats.find(c => c.id === lastChat)) {
        await openChat(lastChat);
      }
    }

    window.dispatchEvent(new Event('bananza:ready'));
  }

  init();
})();
