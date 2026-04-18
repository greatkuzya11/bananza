(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIG
  // ═══════════════════════════════════════════════════════════════════════════
  const WS_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
  const PAGE_SIZE = 50;
  const MESSAGE_CACHE_LIMIT = 800;
  const MENTION_PICKER_TAP_DEAD_ZONE = 10;
  const MAX_MSG = 5000;
  const MAX_ATTACHMENTS = 10;
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const FILE_TYPE_BY_MIME = {
    'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image',
    'application/pdf': 'document', 'text/plain': 'document',
    'application/msword': 'document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
    'application/vnd.ms-excel': 'document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
    'application/zip': 'document',
    'application/x-rar-compressed': 'document', 'application/vnd.rar': 'document',
    'application/x-msdownload': 'document', 'application/octet-stream': 'document',
    'audio/mpeg': 'audio', 'audio/wav': 'audio', 'audio/ogg': 'audio',
    'audio/mp4': 'audio', 'audio/x-m4a': 'audio', 'audio/aac': 'audio',
    'video/mp4': 'video', 'video/webm': 'video', 'video/quicktime': 'video',
  };
  const ALLOWED_FILE_EXT = new Set([
    '.jpg','.jpeg','.png','.webp','.gif',
    '.pdf','.txt','.doc','.docx','.xls','.xlsx','.zip','.rar','.exe',
    '.mp3','.wav','.ogg','.m4a',
    '.mp4','.webm','.mov',
  ]);
  const UI_THEMES = [
    { id: 'bananza', name: 'BananZa', note: 'Classic blue', colors: ['#17212b', '#5eb5f7'], own: '#2b5278', other: '#182533' },
    { id: 'banan-hero', name: 'Banan Hero', note: 'Grass + signal', colors: ['#15171a', '#ffd33f'], own: '#496436', other: '#202228' },
    { id: 'midnight-ocean', name: 'Midnight Ocean', note: 'Navy + teal', colors: ['#071823', '#2dd4bf'], own: '#14506a', other: '#102434' },
    { id: 'nord-aurora', name: 'Nord Aurora', note: 'Graphite + aurora', colors: ['#2e3440', '#88c0d0'], own: '#3b5f75', other: '#293340' },
    { id: 'rose-pine', name: 'Rose Pine', note: 'Plum + rose', colors: ['#191724', '#eb6f92'], own: '#3a2a4a', other: '#221f33' },
    { id: 'dracula-neon', name: 'Dracula Neon', note: 'Violet + pink', colors: ['#282a36', '#ff79c6'], own: '#4b3a69', other: '#242636' },
    { id: 'tokyo-night', name: 'Tokyo Night', note: 'Ink + electric blue', colors: ['#1a1b26', '#7aa2f7'], own: '#2b4d7d', other: '#202437' },
  ];
  const UI_THEME_IDS = new Set(UI_THEMES.map(t => t.id));
  const MODAL_ANIMATION_STYLES = [
    { id: 'soft', name: 'Soft', note: 'Stronger lift with a smooth modal feel.' },
    { id: 'lift', name: 'Lift', note: 'More vertical travel and a clearer close motion.' },
    { id: 'zoom', name: 'Zoom', note: 'Content pops from scale with a dense backdrop.' },
    { id: 'slide', name: 'Slide', note: 'More obvious upward slide, closer to a sheet feel.' },
    { id: 'fade', name: 'Fade', note: 'Pure fade, but slower and more noticeable than before.' },
    { id: 'none', name: 'None', note: 'Instant open/close with no animation.' },
  ];
  const MODAL_ANIMATION_STYLE_IDS = new Set(MODAL_ANIMATION_STYLES.map(style => style.id));
  const MODAL_ANIMATION_SPEED_DEFAULT = 8;
  const MODAL_ANIMATION_SPEED_FACTORS = Object.freeze({
    1: 4.5,
    2: 4.0,
    3: 3.5,
    4: 3.0,
    5: 2.3,
    6: 1.8,
    7: 1.5,
    8: 1.0,
    9: 0.8,
    10: 0.5,
  });
  const MODAL_TRANSITION_BUFFER_MS = 80;
  const CHAT_LIST_CACHE_VERSION = 3;
  const CHAT_LIST_CACHE_SYNC_DEBOUNCE_MS = 250;
  const CHAT_LIST_REQUEST_TIMEOUT_MS = 9000;
  const RECOVERY_SYNC_MIN_INTERVAL_MS = 1200;
  const RECOVERY_CATCHUP_MAX_PAGES = 5;
  const RESUME_WS_REFRESH_AFTER_MS = 25000;
  const NOTES_CHAT_EMOJI = '📝';
  const CHAT_CONTEXT_LONG_PRESS_MS = 500;

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  let currentUser = null;
  let token = null;
  let chats = [];
  let chatListLoadedOnce = false;
  let initialChatLoadFinished = false;
  let chatListRequestSeq = 0;
  let chatListAbortController = null;
  let chatListCacheSyncTimer = null;
  let currentChatId = null;
  let ws = null;
  let wsRetry = 1000;
  let wsReconnectTimer = null;
  let lastHiddenAt = document.hidden ? Date.now() : 0;
  let recoverySyncTimer = null;
  let recoverySyncPromise = null;
  let recoverySyncRequested = false;
  let recoverySyncLastStartedAt = 0;
  let pendingRecoveryChatIds = new Set();
  let onlineUsers = new Set();
  let chatMembersCache = new Map();
  let chatPinsByChat = new Map();
  let activePinIndexByChat = new Map();
  let loadingMore = false;
  let loadingMoreAfter = false;
  let hasMore = true;
  let hasMoreAfter = false;
  let pendingFile = null;
  let pendingFiles = []; // queue for multi-file upload
  let outboxObjectUrls = new Map();
  let outboxSending = new Set();
  let retryLayoutTimer = null;
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
  let scrollPositions = {}; // chatId -> { messageId, offsetTop, atBottom, savedAt }
  let scrollPositionsUserKey = '';
  let suppressScrollAnchorSave = false;
  let scrollAnchorSaveTimer = null;
  let currentUiTheme = 'bananza';
  let currentModalAnimation = 'soft';
  let currentModalAnimationSpeed = MODAL_ANIMATION_SPEED_DEFAULT;
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
    notify_pins: true,
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
    play_pins: true,
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
  let aiModelCatalog = {
    source: 'fallback',
    response: ['gpt-4o-mini'],
    summary: ['gpt-4o-mini'],
    embedding: ['text-embedding-3-small'],
    error: '',
  };
  let selectedAiBotId = null;
  let yandexBotState = {
    settings: {
      yandex_enabled: false,
      yandex_folder_id: '',
      yandex_base_url: 'https://llm.api.cloud.yandex.net/foundationModels/v1',
      yandex_default_response_model: 'yandexgpt/latest',
      yandex_default_summary_model: 'yandexgpt-lite/latest',
      yandex_default_embedding_doc_model: 'text-search-doc/latest',
      yandex_default_embedding_query_model: 'text-search-query/latest',
      yandex_temperature: 0.3,
      yandex_summary_temperature: 0.2,
      yandex_max_tokens: 1000,
      yandex_reasoning_mode: 'DISABLED',
      yandex_data_logging_enabled: false,
    },
    bots: [],
    chats: [],
    chatSettings: [],
    models: {
      response: ['yandexgpt/latest', 'yandexgpt-lite/latest'],
      summary: ['yandexgpt-lite/latest', 'yandexgpt/latest'],
      docEmbedding: ['text-search-doc/latest'],
      queryEmbedding: ['text-search-query/latest'],
    },
  };
  let selectedYandexBotId = null;
  let forwardMessageState = null;
  let forwardMessageBusy = false;
  let savingToNotesMessageIds = new Set();
  let centerToastTimer = null;
  let chatContextMenuState = null;
  let chatContextLongPressTimer = null;
  let chatContextLongPressStart = null;
  let chatContextLongPressRow = null;
  let suppressNextChatItemTapUntil = 0;
  let suppressChatContextDismissUntil = 0;
  let mentionTargetsByChat = new Map();
  let mentionPickerState = { active: false, start: 0, end: 0, selected: 0, targets: [], source: null };
  let mentionPickerPointerState = null;
  let avatarUserMenuState = null;
  let chatMemberLastReads = new Map();
  const modalRegistry = new Map();
  let modalStack = [];
  let modalHistoryDepth = 0;
  let modalSkipPopstateCount = 0;
  let pendingModalHistoryRewind = 0;
  let modalHistorySyncTimer = null;
  let modalHistorySyncDueAt = 0;
  let modalAnimationSaveTimer = null;
  let modalAnimationSaveInFlight = false;
  let modalAnimationSaveQueued = false;
  let modalAnimationStatusTimer = null;
  let searchAllChats = false;
  let searchRequestSeq = 0;
  let searchPanelHistoryPushed = false;
  let searchPanelSkipNextPopstate = false;
  let searchPanelCloseTimer = null;
  let searchPanelOpenFrame = null;
  let searchPanelTransitionHandler = null;
  let searchPanelPendingAction = null;
  let searchPanelReturnFocusEl = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM
  // ═══════════════════════════════════════════════════════════════════════════
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const sidebar = $('#sidebar');
  const chatList = $('#chatList');
  const chatListStatus = $('#chatListStatus');
  const chatSearch = $('#chatSearch');
  const chatArea = $('#chatArea');
  const emptyState = $('#emptyState');
  const chatView = $('#chatView');
  const backBtn = $('#backBtn');
  const chatTitle = $('#chatTitle');
  const chatHeaderAvatar = $('#chatHeaderAvatar');
  const chatStatus = $('#chatStatus');
  const pinnedBar = $('#pinnedBar');
  const messagesEl = $('#messages');
  const loadMoreWrap = $('#loadMoreWrap');
  const loadMoreBtn = $('#loadMoreBtn');
  const typingBar = $('#typingBar');
  const msgInput = $('#msgInput');
  const mentionOpenBtn = $('#mentionOpenBtn');
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
  const reactionEmojiPopover = $('#reactionEmojiPopover');
  const chatContextMenuBackdrop = $('#chatContextMenuBackdrop');
  const chatContextMenu = $('#chatContextMenu');
  const replyBar = $('#replyBar');
  const replyBarName = $('#replyBarName');
  const replyBarText = $('#replyBarText');
  const searchPanel = $('#searchPanel');
  const searchPanelSheet = $('#searchPanelSheet');
  const searchInput = $('#searchInput');
  const searchResults = $('#searchResults');
  const searchAllChatsToggle = $('#searchAllChatsToggle');
  const dragOverlay = $('#dragOverlay');
  const newChatModal = $('#newChatModal');
  const adminModal = $('#adminModal');
  const chatInfoModal = $('#chatInfoModal');
  const menuDrawer = $('#menuDrawer');
  const currentUserInfo = $('#currentUserInfo');
  const weatherWidget = $('#weatherWidget');
  const settingsModal = $('#settingsModal');
  const themeSettingsModal = $('#themeSettingsModal');
  const animationSettingsModal = $('#animationSettingsModal');
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
    registerManagedModal: (id, options) => registerModal(id, options),
    openManagedModal: (id, options) => openModal(id, options),
    closeManagedModal: (id, options) => closeModal(id, options),
    closeTopManagedModal: (options) => closeTopModal(options),
    getToken: () => token || localStorage.getItem('token'),
    getCurrentUser: () => currentUser,
    getCurrentChatId: () => currentChatId,
    getCurrentModalAnimation: () => currentModalAnimation,
    getCurrentModalAnimationSpeed: () => currentModalAnimationSpeed,
    getPendingFiles: () => [...pendingFiles],
    getReplyTo: () => replyTo ? { ...replyTo } : null,
    getEditTo: () => editTo ? { ...editTo } : null,
    queueVoiceMessage: (payload) => queueVoiceOutbox(payload),
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

  // Weather widget interactivity: click or keyboard activates a forced refresh
  if (weatherWidget) {
    weatherWidget.addEventListener('click', (e) => {
      if (!weatherSettings.enabled || !weatherSettings.location) return;
      // fire-and-forget; UI shows loading state inside loadCurrentWeather
      loadCurrentWeather(true).catch(() => {});
    });
    weatherWidget.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        weatherWidget.click();
      }
    });
  }

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

  function normalizeModalAnimationStyle(style) {
    return MODAL_ANIMATION_STYLE_IDS.has(style) ? style : 'soft';
  }

  function normalizeModalAnimationSpeed(speed) {
    const next = Math.round(Number(speed));
    if (!Number.isFinite(next)) return MODAL_ANIMATION_SPEED_DEFAULT;
    return Math.min(10, Math.max(1, next));
  }

  function getModalAnimationSpeedFactor(speed = currentModalAnimationSpeed) {
    return MODAL_ANIMATION_SPEED_FACTORS[normalizeModalAnimationSpeed(speed)] || 1;
  }

  function setModalAnimationStatus(message, type = '') {
    const el = $('#settingsAnimationStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function clearModalAnimationStatusTimer() {
    clearTimeout(modalAnimationStatusTimer);
    modalAnimationStatusTimer = null;
  }

  function scheduleModalAnimationStatusClear() {
    clearModalAnimationStatusTimer();
    modalAnimationStatusTimer = setTimeout(() => {
      if ($('#settingsAnimationStatus')?.textContent === 'Saved') setModalAnimationStatus('');
    }, 1200);
  }

  function getPersistedModalAnimationPreferences() {
    return {
      style: normalizeModalAnimationStyle(currentUser?.ui_modal_animation),
      speed: normalizeModalAnimationSpeed(currentUser?.ui_modal_animation_speed),
    };
  }

  function getCurrentModalAnimationPreferences() {
    return {
      style: normalizeModalAnimationStyle(currentModalAnimation),
      speed: normalizeModalAnimationSpeed(currentModalAnimationSpeed),
    };
  }

  function modalAnimationPreferencesEqual(a = {}, b = {}) {
    return normalizeModalAnimationStyle(a.style) === normalizeModalAnimationStyle(b.style)
      && normalizeModalAnimationSpeed(a.speed) === normalizeModalAnimationSpeed(b.speed);
  }

  function renderModalAnimationOptions() {
    const wrap = $('#settingsAnimationOptions');
    if (!wrap) return;
    wrap.innerHTML = MODAL_ANIMATION_STYLES.map((style) => `
      <button type="button" class="animation-style-card${style.id === currentModalAnimation ? ' active' : ''}" data-modal-animation-style="${style.id}">
        <strong>${esc(style.name)}</strong>
        <small>${esc(style.note)}</small>
      </button>
    `).join('');
  }

  function renderModalAnimationSpeedControl() {
    const input = $('#settingsAnimationSpeed');
    const value = $('#settingsAnimationSpeedValue');
    const control = document.querySelector('.animation-speed-control');
    if (input) input.value = String(normalizeModalAnimationSpeed(currentModalAnimationSpeed));
    if (value) value.textContent = `${normalizeModalAnimationSpeed(currentModalAnimationSpeed)}/10`;
    control?.classList.toggle('is-inactive', currentModalAnimation === 'none');
  }

  function applyModalAnimation(style, persist = true) {
    const nextStyle = normalizeModalAnimationStyle(style);
    currentModalAnimation = nextStyle;
    document.documentElement.dataset.modalAnimation = nextStyle;
    if (currentUser && persist) {
      currentUser.ui_modal_animation = nextStyle;
      persistCurrentUser();
    }
    renderModalAnimationOptions();
    renderModalAnimationSpeedControl();
  }

  function applyModalAnimationSpeed(speed, persist = true) {
    const nextSpeed = normalizeModalAnimationSpeed(speed);
    currentModalAnimationSpeed = nextSpeed;
    document.documentElement.style.setProperty('--modal-animation-speed-factor', String(getModalAnimationSpeedFactor(nextSpeed)));
    if (currentUser && persist) {
      currentUser.ui_modal_animation_speed = nextSpeed;
      persistCurrentUser();
    }
    renderModalAnimationSpeedControl();
  }

  async function flushModalAnimationSave() {
    clearTimeout(modalAnimationSaveTimer);
    modalAnimationSaveTimer = null;
    if (modalAnimationSaveInFlight || !currentUser) return;
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
      currentUser = { ...currentUser, ...res.user };
      persistCurrentUser();
      didSave = true;

      const localChangedSinceRequest = !modalAnimationPreferencesEqual(getCurrentModalAnimationPreferences(), requestPrefs);
      if (!localChangedSinceRequest) {
        applyModalAnimation(currentUser.ui_modal_animation, false);
        applyModalAnimationSpeed(currentUser.ui_modal_animation_speed, false);
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
      clearTimeout(modalAnimationSaveTimer);
      modalAnimationSaveTimer = null;
      modalAnimationSaveQueued = false;
      if (!modalAnimationSaveInFlight) setModalAnimationStatus('');
      return;
    }

    setModalAnimationStatus('Saving...');
    clearTimeout(modalAnimationSaveTimer);

    if (debounce > 0) {
      modalAnimationSaveQueued = true;
      modalAnimationSaveTimer = setTimeout(() => {
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
    if (nextStyle === currentModalAnimation) return;
    applyModalAnimation(nextStyle, false);
    scheduleModalAnimationSave();
  }

  function updateModalAnimationSpeed(speed, { immediate = false } = {}) {
    applyModalAnimationSpeed(speed, false);
    scheduleModalAnimationSave({ debounce: immediate ? 0 : 350 });
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
    if (!iso) return '';
    try {
      const s = String(iso);
      const needsZ = !(/[zZ]$/.test(s) || /[+\-]\d{2}:?\d{2}$/.test(s));
      const d = new Date(needsZ ? s + 'Z' : s);
      if (isNaN(d.getTime())) return 'Invalid Date';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Invalid Date';
    }
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      const s = String(iso);
      const needsZ = !(/[zZ]$/.test(s) || /[+\-]\d{2}:?\d{2}$/.test(s));
      const d = new Date(needsZ ? s + 'Z' : s);
      if (isNaN(d.getTime())) return 'Invalid Date';
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === today.toDateString()) return 'Today';
      if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return 'Invalid Date';
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function fileExtension(name) {
    const m = String(name || '').toLowerCase().match(/\.[^.]+$/);
    return m ? m[0] : '';
  }

  function getLocalFileType(file) {
    if (!file) return null;
    const ext = fileExtension(file.name);
    if (!ALLOWED_FILE_EXT.has(ext)) return null;
    if (FILE_TYPE_BY_MIME[file.type]) return FILE_TYPE_BY_MIME[file.type];
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return 'image';
    if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) return 'audio';
    if (['.mp4', '.webm', '.mov'].includes(ext)) return 'video';
    return 'document';
  }

  function makeClientId(prefix = 'c') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function isClientSideMessage(msg) {
    return Boolean(msg?.is_outbox || msg?.client_status || (typeof msg?.id === 'string' && msg.id.startsWith('c-')));
  }

  function initials(name) {
    const text = String(name || '').trim();
    if (!text) return '?';
    return text.split(/\s+/).map(w => w[0]).join('').toUpperCase().substring(0, 2) || '?';
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

  function persistCurrentUser() {
    if (!currentUser) return;
    localStorage.setItem('user', JSON.stringify(currentUser));
  }

  function chatListCacheKey() {
    const userId = Number(currentUser?.id || 0);
    return userId > 0 ? `bananza:chat-list:${userId}` : '';
  }

  function normalizeCachedChats(rawChats) {
    return sortChatsInPlace((Array.isArray(rawChats) ? rawChats : [])
      .filter((chat) => Number(chat?.id || 0) > 0)
      .map((chat) => normalizeChatListEntry(chat)));
  }

  function readChatListCache() {
    const key = chatListCacheKey();
    if (!key) return [];
    try {
      const raw = JSON.parse(localStorage.getItem(key) || 'null');
      if (Array.isArray(raw)) return normalizeCachedChats(raw);
      if (!raw || Number(raw.version) !== CHAT_LIST_CACHE_VERSION) return [];
      return normalizeCachedChats(raw.chats);
    } catch {
      return [];
    }
  }

  function collectChatAvatarUrls(sourceChats = chats) {
    const urls = new Set();
    for (const chat of Array.isArray(sourceChats) ? sourceChats : []) {
      const chatAvatar = String(chat?.avatar_url || '').trim();
      const privateAvatar = String(chat?.private_user?.avatar_url || '').trim();
      if (chatAvatar) urls.add(chatAvatar);
      if (privateAvatar) urls.add(privateAvatar);
    }
    return Array.from(urls);
  }

  function warmChatListAvatarAssets(sourceChats = chats) {
    const avatarUrls = collectChatAvatarUrls(sourceChats).slice(0, 32);
    if (!avatarUrls.length || !window.cacheAssets) return;
    window.cacheAssets(avatarUrls).catch(() => {});
  }

  function persistChatListCache() {
    const key = chatListCacheKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify({
        version: CHAT_LIST_CACHE_VERSION,
        savedAt: Date.now(),
        chats: normalizeCachedChats(chats),
      }));
    } catch (e) {}
    warmChatListAvatarAssets();
  }

  function scheduleChatListCacheSync() {
    clearTimeout(chatListCacheSyncTimer);
    chatListCacheSyncTimer = setTimeout(() => {
      chatListCacheSyncTimer = null;
      persistChatListCache();
    }, CHAT_LIST_CACHE_SYNC_DEBOUNCE_MS);
  }

  function setChatListStatus(message = '', type = '') {
    if (!chatListStatus) return;
    chatListStatus.textContent = message;
    chatListStatus.classList.toggle('hidden', !message);
    chatListStatus.classList.toggle('is-loading', type === 'loading');
    chatListStatus.classList.toggle('is-info', type === 'info');
    chatListStatus.classList.toggle('is-error', type === 'error');
  }

  function hydrateChatListCache() {
    const cachedChats = readChatListCache();
    if (!cachedChats.length) return false;
    chats = cachedChats;
    chatListLoadedOnce = true;
    renderChatList(chatSearch?.value || '');
    setChatListStatus('Showing saved chats while refreshing...', 'info');
    warmChatListAvatarAssets(cachedChats);
    return true;
  }

  function setAvatarElementVisual(el, { name = '', color = '#65aadd', avatarUrl = '', fallbackText = '' } = {}) {
    if (!el) return;
    el.style.background = color || '#65aadd';
    if (avatarUrl) {
      el.innerHTML = `<img class="avatar-img" src="${esc(avatarUrl)}" alt="" loading="lazy" onerror="this.remove()">`;
      return;
    }
    el.textContent = fallbackText || initials(name || '?');
  }

  function renderCurrentChatHeader(chat = chats.find(c => c.id === currentChatId)) {
    if (!chat) {
      chatTitle.textContent = 'Chat';
      chatHeaderAvatar.style.display = 'none';
      return;
    }
    chatTitle.textContent = chat.name || 'Chat';
    chatHeaderAvatar.style.display = '';
    if (isNotesChat(chat)) {
      setAvatarElementVisual(chatHeaderAvatar, {
        name: chat.name,
        color: '#5eb5f7',
        avatarUrl: '',
        fallbackText: chat.avatar_emoji || NOTES_CHAT_EMOJI,
      });
      return;
    }
    if (chat.type === 'private' && chat.private_user) {
      setAvatarElementVisual(chatHeaderAvatar, {
        name: chat.name,
        color: chat.private_user.avatar_color || '#65aadd',
        avatarUrl: chat.private_user.avatar_url || '',
        fallbackText: initials(chat.name || '?'),
      });
      return;
    }
    setAvatarElementVisual(chatHeaderAvatar, {
      name: chat.name,
      color: '#5eb5f7',
      avatarUrl: chat.avatar_url || '',
      fallbackText: chat.type === 'general' ? '🌐' : '👥',
    });
  }

  function refreshChatInfoPresentation(chat = chats.find(c => c.id === currentChatId)) {
    if (!chat || chatInfoModal?.classList.contains('hidden') || Number(chat.id) !== Number(currentChatId)) return;
    $('#chatInfoTitle').textContent = chat.name || 'Chat Info';
    syncChatInfoStatusVisibility(chat);

    const editSection = $('#chatEditSection');
    if (editSection) {
      if (!isNotesChat(chat) && (chat.type === 'group' || chat.type === 'general')) {
        editSection.classList.remove('hidden');
        setAvatarElementVisual($('#chatAvatar'), {
          name: chat.name,
          color: '#5eb5f7',
          avatarUrl: chat.avatar_url || '',
          fallbackText: chat.type === 'general' ? '🌐' : '👥',
        });
        $('#removeChatAvatar')?.classList.toggle('hidden', !chat.avatar_url);
        if ($('#chatNameInput')) $('#chatNameInput').value = chat.name || '';
      } else {
        editSection.classList.add('hidden');
      }
    }

    const bgPreviewEl = $('#chatBackgroundPreview');
    const removeBgBtn = $('#removeChatBackground');
    const bgStyleSelect = $('#chatBackgroundStyle');
    if (bgPreviewEl) {
      if (chat.background_url) {
        bgPreviewEl.style.backgroundImage = `url(${esc(chat.background_url)})`;
        applyBackgroundStyleToElement(bgPreviewEl, chat.background_style || 'cover');
        removeBgBtn?.classList.remove('hidden');
      } else {
        bgPreviewEl.style.backgroundImage = '';
        applyBackgroundStyleToElement(bgPreviewEl, 'cover');
        removeBgBtn?.classList.add('hidden');
      }
    }
    if (bgStyleSelect) bgStyleSelect.value = chat.background_style || 'cover';
  }

  function syncChatInfoStatusVisibility(chat = getChatById(currentChatId)) {
    const statusEl = $('#chatInfoStatus');
    if (!statusEl) return;
    const shouldHide = isNotesChat(chat);
    statusEl.classList.toggle('hidden', shouldHide);
    if (shouldHide) {
      statusEl.classList.remove('online', 'offline', 'bot');
      statusEl.style.color = '';
      statusEl.innerHTML = '';
    }
  }

  function updateUserListItemElement(item, user) {
    if (!item || !user) return;
    const avatarEl = item.querySelector('.avatar, .chat-item-avatar');
    if (avatarEl) {
      setAvatarElementVisual(avatarEl, {
        name: user.display_name || '',
        color: user.avatar_color || '#65aadd',
        avatarUrl: user.avatar_url || '',
      });
    }
    const nameEl = item.querySelector('.name');
    if (nameEl && user.display_name) nameEl.textContent = user.display_name;
  }

  function updateAdminUserRowElement(row, user) {
    if (!row || !user) return;
    const avatarEl = row.querySelector('.avatar');
    if (avatarEl) {
      setAvatarElementVisual(avatarEl, {
        name: user.display_name || '',
        color: user.avatar_color || '#65aadd',
        avatarUrl: user.avatar_url || '',
      });
    }
    const nameEl = row.querySelector('.name');
    if (nameEl) {
      const username = user.username || nameEl.querySelector('span')?.textContent?.replace(/^@/, '') || '';
      nameEl.innerHTML = `${esc(user.display_name || '')}${username ? ` <span style="color:var(--text-secondary)">@${esc(username)}</span>` : ''}`;
    }
  }

  function refreshRenderedUserMessages(user) {
    const userId = Number(user?.id || user?.user_id || 0);
    if (!userId || !messagesEl) return;
    const bot = aiBotState?.bots?.find?.((item) => Number(item.user_id) === userId) || null;
    const mentionToken = bot?.mention || user.username || '';

    messagesEl.querySelectorAll(`.msg-group[data-user-id="${userId}"]`).forEach((group) => {
      const avatarEl = group.querySelector('.msg-group-avatar');
      if (avatarEl) {
        avatarEl.title = user.display_name || avatarEl.title || '';
        avatarEl.dataset.displayName = user.display_name || avatarEl.dataset.displayName || '';
        if (mentionToken) avatarEl.dataset.mentionToken = mentionToken;
        setAvatarElementVisual(avatarEl, {
          name: user.display_name || '',
          color: user.avatar_color || '#65aadd',
          avatarUrl: user.avatar_url || '',
        });
      }
      const senderEl = group.querySelector('.msg-sender');
      if (senderEl) {
        senderEl.textContent = user.display_name || senderEl.textContent;
        senderEl.style.color = user.avatar_color || senderEl.style.color;
      }
    });

    messagesEl.querySelectorAll(`.msg-row[data-user-id="${userId}"]`).forEach((row) => {
      if (row.__messageData) {
        row.__messageData.display_name = user.display_name || row.__messageData.display_name;
        row.__messageData.avatar_color = user.avatar_color || row.__messageData.avatar_color;
        row.__messageData.avatar_url = user.avatar_url || null;
        if (user.username) row.__messageData.username = user.username;
      }
      if (row.__replyPayload && user.display_name) {
        row.__replyPayload.display_name = user.display_name;
      }
      const senderEl = row.querySelector('.msg-sender');
      if (senderEl) {
        senderEl.textContent = user.display_name || senderEl.textContent;
        senderEl.style.color = user.avatar_color || senderEl.style.color;
      }
    });
  }

  function applyChatUpdate(nextChat = {}) {
    const chatId = Number(nextChat.id || 0);
    if (!chatId) return null;
    const idx = chats.findIndex((chat) => Number(chat.id) === chatId);
    if (idx < 0) return null;
    const current = chats[idx] || {};
    chats[idx] = normalizeChatListEntry({
      ...current,
      ...nextChat,
      background_url: Object.prototype.hasOwnProperty.call(nextChat, 'background_url')
        ? (nextChat.background_url || null)
        : (current.background_url || null),
      background_style: nextChat.background_style || current.background_style || 'cover',
    });
    if ((current.type === 'private' || nextChat.type === 'private') && current.private_user && !nextChat.private_user) {
      chats[idx].name = current.name;
    }
    sortChatsInPlace(chats);
    const updated = getChatById(chatId);
    renderChatList(chatSearch.value);
    if (currentChatId === chatId) {
      renderCurrentChatHeader(updated);
      applyChatBackground(updated);
      updateChatStatus();
      renderPinnedBar(chatId);
      refreshVisiblePinButtons(chatId);
    }
    refreshChatInfoPresentation(updated);
    renderChatPinSettingsForm(updated);
    return updated;
  }

  function applyUserUpdate(nextUser = {}) {
    const userId = Number(nextUser.id || nextUser.user_id || 0);
    if (!userId) return null;
    const user = {
      ...nextUser,
      id: userId,
      user_id: userId,
      avatar_url: nextUser.avatar_url || null,
    };

    if (currentUser && Number(currentUser.id) === userId) {
      currentUser = {
        ...currentUser,
        ...user,
        avatar_url: user.avatar_url,
      };
      if (user.ui_theme) applyUiTheme(user.ui_theme, false);
      if (Object.prototype.hasOwnProperty.call(user, 'ui_modal_animation')) {
        applyModalAnimation(user.ui_modal_animation, false);
      }
      if (Object.prototype.hasOwnProperty.call(user, 'ui_modal_animation_speed')) {
        applyModalAnimationSpeed(user.ui_modal_animation_speed, false);
      }
      persistCurrentUser();
      updateCurrentUserFooter();
      if (!menuDrawer.classList.contains('hidden')) openMenuDrawer();
    }

    let shouldRenderChats = false;
    let aiBotChanged = false;

    allUsers = allUsers.map((entry) => {
      if (Number(entry.id) !== userId) return entry;
      shouldRenderChats = true;
      return { ...entry, ...user, avatar_url: user.avatar_url };
    });

    chats = chats.map((chat) => {
      if (chat.type === 'private' && chat.private_user && Number(chat.private_user.id) === userId) {
        shouldRenderChats = true;
        return {
          ...chat,
          name: user.display_name || chat.name,
          private_user: {
            ...chat.private_user,
            ...user,
            avatar_url: user.avatar_url,
          },
        };
      }
      return chat;
    });

    chatMembersCache.forEach((members, chatId) => {
      let changed = false;
      const nextMembers = members.map((member) => {
        if (Number(member.id) !== userId) return member;
        changed = true;
        return {
          ...member,
          ...user,
          avatar_url: user.avatar_url,
        };
      });
      if (changed) chatMembersCache.set(chatId, nextMembers);
    });

    mentionTargetsByChat.forEach((targets, chatId) => {
      let changed = false;
      const nextTargets = targets.map((target) => {
        if (Number(target.user_id) !== userId) return target;
        changed = true;
        return {
          ...target,
          display_name: user.display_name || target.display_name,
          avatar_color: user.avatar_color || target.avatar_color,
          avatar_url: user.avatar_url,
          username: user.username || target.username,
        };
      });
      if (changed) mentionTargetsByChat.set(chatId, nextTargets);
    });

    aiBotState.bots = aiBotState.bots.map((bot) => {
      if (Number(bot.user_id) !== userId) return bot;
      aiBotChanged = true;
      return {
        ...bot,
        name: user.display_name || bot.name,
        avatar_color: user.avatar_color || bot.avatar_color,
        avatar_url: user.avatar_url,
      };
    });

    if (aiBotChanged) {
      renderAiBotList();
      renderAiBotAvatar(currentAiBot());
    }

    refreshRenderedUserMessages(user);
    document.querySelectorAll(`.user-list-item[data-uid="${userId}"]`).forEach((item) => updateUserListItemElement(item, user));
    document.querySelectorAll(`.admin-user-row[data-uid="${userId}"]`).forEach((row) => updateAdminUserRowElement(row, user));
    if (!chatInfoModal.classList.contains('hidden')) {
      refreshChatMemberStatuses();
      refreshChatInfoStatus();
    }

    if (shouldRenderChats) renderChatList(chatSearch.value);
    if (currentChatId) {
      const currentChat = chats.find((chat) => Number(chat.id) === Number(currentChatId));
      if (currentChat) {
        renderCurrentChatHeader(currentChat);
        refreshChatInfoPresentation(currentChat);
        updateChatStatus();
      }
    }

    if (mentionPickerState.active && mentionTargetsByChat.has(Number(currentChatId))) {
      const targets = mentionTargetsByChat.get(Number(currentChatId)) || [];
      if (targets.length) renderMentionPicker(targets);
      else hideMentionPicker();
    }

    try { window.messageCache?.updateMessagesByUser?.(user).catch(() => {}); } catch (e) {}
    return user;
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
    // Make widget accessible / interactive when visible
    weatherWidget.setAttribute('role', 'button');
    weatherWidget.tabIndex = 0;
    weatherWidget.classList.toggle('interactive', !weatherWidget.classList.contains('hidden'));
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
    const pinsInput = $('#settingsNotifyPins');
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
    if (pinsInput) pinsInput.checked = notificationSettings.notify_pins !== false;
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
      notify_pins: $('#settingsNotifyPins')?.checked ?? notificationSettings.notify_pins,
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
      settingsSoundPins: soundSettings.play_pins,
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
      play_pins: $('#settingsSoundPins')?.checked ?? soundSettings.play_pins,
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
    const sequence = ['send', 'incoming', 'notification', 'pin', 'mention', 'reaction', 'invite', 'voice_start', 'voice_stop'];
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

  function getChatPinOrder(chat) {
    const order = Number(chat?.chat_list_pin_order);
    return Number.isFinite(order) && order > 0 ? Math.floor(order) : null;
  }

  function isChatPinned(chatOrId) {
    const chat = typeof chatOrId === 'object' && chatOrId !== null ? chatOrId : getChatById(chatOrId);
    return getChatPinOrder(chat) != null || Boolean(chat && (chat.is_pinned === true || chat.is_pinned === 1 || chat.is_pinned === '1'));
  }

  function normalizeChatListEntry(chat = {}) {
    const next = {
      ...chat,
      private_user: chat?.private_user ? { ...chat.private_user } : null,
    };
    const pinOrder = getChatPinOrder(next);
    next.chat_list_pin_order = pinOrder;
    next.is_pinned = pinOrder != null;
    if (Object.prototype.hasOwnProperty.call(next, 'notify_enabled')) {
      next.notify_enabled = localChatPreferenceEnabled(next.notify_enabled);
    }
    if (Object.prototype.hasOwnProperty.call(next, 'sounds_enabled')) {
      next.sounds_enabled = localChatPreferenceEnabled(next.sounds_enabled);
    }
    return next;
  }

  function compareChatActivity(a, b) {
    if (a?.last_time && b?.last_time) {
      const byLastTime = String(b.last_time).localeCompare(String(a.last_time));
      if (byLastTime) return byLastTime;
    } else if (a?.last_time) {
      return -1;
    } else if (b?.last_time) {
      return 1;
    }
    const byCreatedAt = String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
    if (byCreatedAt) return byCreatedAt;
    return Number(b?.id || 0) - Number(a?.id || 0);
  }

  function compareChatsForList(a, b) {
    const pinA = getChatPinOrder(a);
    const pinB = getChatPinOrder(b);
    const aPinned = pinA != null;
    const bPinned = pinB != null;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned && pinA !== pinB) return pinA - pinB;
    return compareChatActivity(a, b);
  }

  function sortChatsInPlace(list = chats) {
    if (!Array.isArray(list)) return list;
    list.sort(compareChatsForList);
    return list;
  }

  function getPinnedChats(list = chats) {
    return (Array.isArray(list) ? list : []).filter((chat) => isChatPinned(chat)).sort(compareChatsForList);
  }

  function getPinnedChatMoveState(chatId, list = chats) {
    const pinned = getPinnedChats(list);
    const index = pinned.findIndex((chat) => Number(chat.id || 0) === Number(chatId || 0));
    return {
      index,
      total: pinned.length,
      canMoveUp: index > 0,
      canMoveDown: index >= 0 && index < pinned.length - 1,
    };
  }

  function isNotesChat(chatOrId) {
    const chat = typeof chatOrId === 'object' && chatOrId !== null ? chatOrId : getChatById(chatOrId);
    return Boolean(chat && (chat.type === 'notes' || Number(chat.is_notes) === 1));
  }

  function isCurrentNotesChat() {
    return isNotesChat(currentChatId);
  }

  function isChatNotificationEnabled(chatId) {
    const chat = getChatById(chatId);
    return chat ? localChatPreferenceEnabled(chat.notify_enabled) : true;
  }

  function isChatIncomingSoundEnabled(chatId) {
    const chat = getChatById(chatId);
    return Boolean(soundSettings.sounds_enabled && (!chat || localChatPreferenceEnabled(chat.sounds_enabled)));
  }

  function isPinNotificationEnabled(chatId) {
    return Boolean(notificationSettings.notify_pins !== false && isChatNotificationEnabled(chatId));
  }

  function isPinSoundEnabled(chatId) {
    return Boolean(soundSettings.play_pins !== false && isChatIncomingSoundEnabled(chatId));
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

  function chatAllowsUnpinAnyPin(chat) {
    return chat && (chat.allow_unpin_any_pin === true || chat.allow_unpin_any_pin === 1 || chat.allow_unpin_any_pin === '1');
  }

  function canManagePinSettings(chat = getChatById(currentChatId)) {
    if (!currentUser || !chat) return false;
    return Boolean(currentUser.is_admin || Number(chat.created_by || 0) === Number(currentUser.id));
  }

  function setChatPinSettingsStatus(message, type = '') {
    const el = $('#chatPinSettingsStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function renderChatPinSettingsForm(chat = getChatById(currentChatId)) {
    const section = $('#chatPinSettingsSection');
    const toggle = $('#chatAllowUnpinAnyPinToggle');
    if (!section || !toggle) return;
    const canManage = canManagePinSettings(chat);
    section.classList.toggle('hidden', isNotesChat(chat) || !canManage);
    toggle.checked = chatAllowsUnpinAnyPin(chat);
    setChatPinSettingsStatus('');
  }

  async function saveChatPinSettings() {
    if (!currentChatId) return;
    const chat = getChatById(currentChatId);
    if (!canManagePinSettings(chat)) return;
    const next = { allow_unpin_any_pin: $('#chatAllowUnpinAnyPinToggle')?.checked ?? false };
    if (chat) chat.allow_unpin_any_pin = next.allow_unpin_any_pin;
    renderChatPinSettingsForm(chat);
    renderPinnedBar(currentChatId);
    refreshVisiblePinButtons(currentChatId);
    setChatPinSettingsStatus('Saving...');
    try {
      const updated = await api(`/api/chats/${currentChatId}/pin-settings`, { method: 'PUT', body: next });
      applyChatUpdate(updated || {});
      setChatPinSettingsStatus('Saved', 'success');
    } catch (e) {
      setChatPinSettingsStatus(e.message || 'Could not save pin settings', 'error');
      await loadChats({ silent: true });
      renderChatPinSettingsForm(getChatById(currentChatId));
    }
  }

  function normalizePin(raw) {
    if (!raw) return null;
    const messageId = Number(raw.message_id || raw.messageId || 0);
    const chatId = Number(raw.chat_id || raw.chatId || currentChatId || 0);
    if (!messageId || !chatId) return null;
    return {
      id: Number(raw.id || 0),
      chat_id: chatId,
      message_id: messageId,
      pinned_by: Number(raw.pinned_by || raw.pinnedBy || 0),
      pinned_by_name: raw.pinned_by_name || raw.pinnedByName || '',
      created_at: raw.created_at || raw.createdAt || '',
      message_user_id: Number(raw.message_user_id || raw.messageUserId || 0),
      message_author_name: raw.message_author_name || raw.messageAuthorName || '',
      preview_text: raw.preview_text || raw.previewText || '',
      file_name: raw.file_name || raw.fileName || null,
      file_type: raw.file_type || raw.fileType || null,
      is_voice_note: Boolean(raw.is_voice_note || raw.isVoiceNote),
    };
  }

  function normalizePins(pins = []) {
    const seen = new Set();
    return (Array.isArray(pins) ? pins : [])
      .map(normalizePin)
      .filter((pin) => {
        if (!pin || seen.has(pin.message_id)) return false;
        seen.add(pin.message_id);
        return true;
      });
  }

  function getPinPreviewText(pin) {
    return String(pin?.preview_text || pin?.file_name || (pin?.is_voice_note ? 'Voice message' : 'Pinned message')).trim() || 'Pinned message';
  }

  function getPinActorName(pin) {
    return String(pin?.pinned_by_name || 'Someone').trim() || 'Someone';
  }

  function getPinToastText(pin) {
    return `${getPinActorName(pin)} pinned: ${getPinPreviewText(pin)}`;
  }

  function buildPinBrowserNotification(pin, chatId) {
    const chat = getChatById(chatId);
    const actorName = getPinActorName(pin);
    const preview = getPinPreviewText(pin);
    return {
      title: chat?.type === 'private' ? actorName : (chat?.name || 'BananZa'),
      body: chat?.type === 'private'
        ? `Pinned message: ${preview}`
        : `${actorName} pinned: ${preview}`,
    };
  }

  function getChatPins(chatId = currentChatId) {
    return chatPinsByChat.get(Number(chatId || 0)) || [];
  }

  function getPinForMessage(messageId, chatId = currentChatId) {
    const mid = Number(messageId || 0);
    if (!mid) return null;
    return getChatPins(chatId).find(pin => Number(pin.message_id) === mid) || null;
  }

  function canUnpinPin(pin) {
    if (!pin || !currentUser) return false;
    if (currentUser.is_admin) return true;
    if (Number(pin.pinned_by) === Number(currentUser.id)) return true;
    return chatAllowsUnpinAnyPin(getChatById(pin.chat_id));
  }

  function getPinActionState(msg) {
    if (!msg || msg.is_deleted || isClientSideMessage(msg)) return { show: false };
    const chatId = Number(msg.chat_id || msg.chatId || currentChatId || 0);
    const pin = getPinForMessage(msg.id, chatId);
    if (!pin) {
      return {
        show: true,
        isPinned: false,
        disabled: false,
        title: 'Pin message',
        label: 'Pin',
        iconHtml: '&#128204;',
      };
    }
    const canUnpin = canUnpinPin(pin);
    return {
      show: true,
      isPinned: true,
      disabled: !canUnpin,
      pin,
      title: canUnpin ? 'Unpin message' : `Pinned by ${pin.pinned_by_name || 'another user'}`,
      label: canUnpin ? 'Unpin' : 'Pinned',
      iconHtml: '&#128204;',
    };
  }

  function renderPinActionButton(msg) {
    const state = getPinActionState(msg);
    if (!state.show) return '';
    const classes = ['msg-pin-btn'];
    if (state.isPinned) classes.push('active');
    if (state.disabled) classes.push('disabled');
    return `<button class="${classes.join(' ')}" title="${esc(state.title)}" ${state.disabled ? 'disabled' : ''}>${state.iconHtml}</button>`;
  }

  function applyPinsUpdate(data = {}) {
    const chatId = Number(data.chatId || data.chat_id || currentChatId || 0);
    if (!chatId) return;
    const previousPins = getChatPins(chatId);
    const previousIndex = Math.max(0, Number(activePinIndexByChat.get(chatId) || 0));
    const previousPin = previousPins[previousIndex] || previousPins[0] || null;
    const nextPins = normalizePins(data.pins);
    chatPinsByChat.set(chatId, nextPins);

    let nextIndex = 0;
    if (previousPin) {
      const found = nextPins.findIndex(pin => Number(pin.message_id) === Number(previousPin.message_id));
      if (found >= 0) nextIndex = found;
    }
    if (nextPins.length) activePinIndexByChat.set(chatId, Math.min(nextIndex, nextPins.length - 1));
    else activePinIndexByChat.set(chatId, 0);

    if (Object.prototype.hasOwnProperty.call(data, 'allow_unpin_any_pin')) {
      const chat = getChatById(chatId);
      if (chat) chat.allow_unpin_any_pin = !!data.allow_unpin_any_pin;
    }

    if (Number(currentChatId || 0) === chatId) {
      renderPinnedBar(chatId);
      refreshVisiblePinButtons(chatId);
      renderChatPinSettingsForm(getChatById(chatId));
    }
  }

  function handlePinnedMessageUpdate(data = {}) {
    const chatId = Number(data.chatId || data.chat_id || 0);
    if (!chatId) return;
    if (Number(data.actorId || 0) === Number(currentUser?.id || 0)) return;
    const messageId = Number(data.messageId || data.message_id || 0);
    if (!messageId) return;
    const pin = getPinForMessage(messageId, chatId);
    if (!pin) return;

    if (!document.hidden) {
      if (isPinNotificationEnabled(chatId)) {
        showCenterToast(getPinToastText(pin));
      }
      if (isPinSoundEnabled(chatId)) {
        playAppSound('pin');
      }
      return;
    }

    if (
      'Notification' in window &&
      Notification.permission === 'granted' &&
      notificationSettings.push_enabled &&
      isPinNotificationEnabled(chatId) &&
      !pushDeviceSubscribed
    ) {
      const content = buildPinBrowserNotification(pin, chatId);
      new Notification(content.title, {
        body: content.body.substring(0, 100),
        icon: '/favicon.ico',
      });
    }
  }

  async function loadChatPins(chatId = currentChatId) {
    const id = Number(chatId || 0);
    if (!id) return [];
    try {
      const data = await api(`/api/chats/${id}/pins`);
      applyPinsUpdate({ chatId: id, pins: data.pins || [], allow_unpin_any_pin: data.allow_unpin_any_pin });
      return getChatPins(id);
    } catch (e) {
      if (Number(currentChatId || 0) === id) renderPinnedBar(id);
      return [];
    }
  }

  function renderPinnedBar(chatId = currentChatId) {
    if (!pinnedBar) return;
    const id = Number(chatId || 0);
    if (!id || Number(currentChatId || 0) !== id) {
      pinnedBar.classList.add('hidden');
      pinnedBar.innerHTML = '';
      return;
    }
    const pins = getChatPins(id);
    if (!pins.length) {
      pinnedBar.classList.add('hidden');
      pinnedBar.innerHTML = '';
      return;
    }

    const index = Math.min(Math.max(0, Number(activePinIndexByChat.get(id) || 0)), pins.length - 1);
    activePinIndexByChat.set(id, index);
    const activePin = pins[index];
    const canUnpinActive = canUnpinPin(activePin);
    const isMultiple = pins.length > 1;

    pinnedBar.innerHTML = `
      <div class="pinned-bar-viewport" role="list" aria-label="Pinned messages">
        ${pins.map((pin, pinIndex) => {
          const preview = pin.preview_text || pin.file_name || (pin.is_voice_note ? 'Voice message' : 'Pinned message');
          const author = pin.message_author_name ? `${pin.message_author_name}` : 'Message';
          const pinnedBy = pin.pinned_by_name ? `Pinned by ${pin.pinned_by_name}` : 'Pinned message';
          return `
            <button type="button" class="pinned-bar-item${pinIndex === index ? ' active' : ''}" data-pin-index="${pinIndex}" title="Jump to pinned message">
              <span class="pinned-bar-icon" aria-hidden="true">&#128204;</span>
              <span class="pinned-bar-copy">
                <strong>${esc(preview)}</strong>
                <small>${esc(author)} &middot; ${esc(pinnedBy)}</small>
              </span>
            </button>
          `;
        }).join('')}
      </div>
      <div class="pinned-bar-side">
        <button type="button" class="pinned-bar-close${canUnpinActive ? '' : ' hidden'}" title="Unpin message" aria-label="Unpin pinned message">&times;</button>
        ${isMultiple ? `<span class="pinned-bar-count">${index + 1}/${pins.length}</span>` : ''}
      </div>
      ${isMultiple ? '<div class="pinned-bar-scrollbar" aria-hidden="true"><span class="pinned-bar-scrollbar-thumb"></span></div>' : ''}
    `;
    pinnedBar.classList.toggle('has-multiple', isMultiple);
    pinnedBar.classList.remove('hidden');

    const viewport = pinnedBar.querySelector('.pinned-bar-viewport');
    const updateScrollbar = () => {
      const track = pinnedBar.querySelector('.pinned-bar-scrollbar');
      const thumb = pinnedBar.querySelector('.pinned-bar-scrollbar-thumb');
      if (!viewport || !track || !thumb) return;
      const scrollHeight = Math.max(viewport.scrollHeight, viewport.clientHeight);
      const scrollRange = Math.max(1, scrollHeight - viewport.clientHeight);
      const trackHeight = track.clientHeight || viewport.clientHeight || 1;
      const thumbHeight = Math.max(14, Math.round((viewport.clientHeight / scrollHeight) * trackHeight));
      const maxTop = Math.max(0, trackHeight - thumbHeight);
      const top = Math.round(maxTop * ((viewport.scrollTop || 0) / scrollRange));
      thumb.style.height = `${thumbHeight}px`;
      thumb.style.transform = `translateY(${top}px)`;
    };
    const syncActivePinFromScroll = () => {
      if (!viewport) return;
      const firstItem = viewport.querySelector('.pinned-bar-item');
      const itemHeight = firstItem ? firstItem.getBoundingClientRect().height : viewport.clientHeight;
      const nextIndex = Math.min(pins.length - 1, Math.max(0, Math.round((viewport.scrollTop || 0) / Math.max(1, itemHeight || 1))));
      activePinIndexByChat.set(id, nextIndex);
      const countEl = pinnedBar.querySelector('.pinned-bar-count');
      if (countEl) countEl.textContent = `${nextIndex + 1}/${pins.length}`;
      pinnedBar.querySelectorAll('.pinned-bar-item').forEach((item) => {
        item.classList.toggle('active', Number(item.dataset.pinIndex || 0) === nextIndex);
      });
      const closeBtn = pinnedBar.querySelector('.pinned-bar-close');
      if (closeBtn) closeBtn.classList.toggle('hidden', !canUnpinPin(pins[nextIndex]));
      updateScrollbar();
    };

    viewport?.addEventListener('scroll', () => {
      if (pins.length <= 1) return;
      window.requestAnimationFrame(syncActivePinFromScroll);
    });
    requestAnimationFrame(() => {
      const targetItem = viewport?.querySelector(`.pinned-bar-item[data-pin-index="${index}"]`);
      if (viewport && targetItem) viewport.scrollTop = targetItem.offsetTop;
      if (isMultiple) syncActivePinFromScroll();
      else updateScrollbar();
    });

    pinnedBar.querySelectorAll('.pinned-bar-item').forEach((item) => {
      item.addEventListener('click', () => {
        const pinIndex = Number(item.dataset.pinIndex || 0);
        activePinIndexByChat.set(id, pinIndex);
        jumpToPinnedMessage(pins[pinIndex]);
      });
    });
    pinnedBar.querySelector('.pinned-bar-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const pinIndex = Math.min(pins.length - 1, Math.max(0, Number(activePinIndexByChat.get(id) || 0)));
      unpinPin(pins[pinIndex]);
    });
  }

  async function jumpToPinnedMessage(pin) {
    if (!pin?.message_id || !pin?.chat_id) return false;
    const sameChat = Number(pin.chat_id) === Number(currentChatId || 0);
    if (sameChat && scrollToMessage(pin.message_id, { highlightClass: 'is-pin-hit' })) return true;
    await openChat(pin.chat_id, {
      anchorMessageId: pin.message_id,
      suppressHistoryPush: sameChat,
      source: 'pin',
    });
    if (scrollToMessage(pin.message_id, { highlightClass: 'is-pin-hit' })) return true;
    showCenterToast('Pinned message not found');
    return false;
  }

  async function pinMessage(msg) {
    if (!msg?.id) return;
    try {
      const chatId = Number(msg.chat_id || msg.chatId || currentChatId || 0);
      const data = await api(`/api/messages/${msg.id}/pin`, { method: 'POST' });
      applyPinsUpdate({ chatId, pins: data.pins || [], allow_unpin_any_pin: data.allow_unpin_any_pin });
      showCenterToast('Message pinned');
    } catch (e) {
      showCenterToast(e.message || 'Could not pin message');
    }
  }

  async function unpinPin(pin) {
    if (!pin?.message_id) return;
    if (!canUnpinPin(pin)) {
      showCenterToast('Only the pin owner or admin can unpin this');
      return;
    }
    try {
      const data = await api(`/api/messages/${pin.message_id}/pin`, { method: 'DELETE' });
      applyPinsUpdate({ chatId: pin.chat_id, pins: data.pins || [], allow_unpin_any_pin: data.allow_unpin_any_pin });
      showCenterToast('Message unpinned');
    } catch (e) {
      showCenterToast(e.message || 'Could not unpin message');
    }
  }

  async function togglePinFromRow(row) {
    const msg = row?.__messageData;
    const state = getPinActionState(msg);
    if (!state.show) return;
    hideFloatingMessageActions();
    if (state.isPinned) {
      if (state.disabled) {
        showCenterToast('Only the pin owner or admin can unpin this');
        return;
      }
      await unpinPin(state.pin);
      return;
    }
    await pinMessage(msg);
  }

  function refreshVisiblePinButtons(chatId = currentChatId) {
    const id = Number(chatId || 0);
    if (!id || Number(currentChatId || 0) !== id) return;
    messagesEl.querySelectorAll('.msg-row[data-msg-id]').forEach((row) => {
      const btn = row.querySelector('.msg-pin-btn');
      if (!btn) return;
      const state = getPinActionState(row.__messageData);
      if (!state.show) {
        btn.remove();
        return;
      }
      btn.classList.toggle('active', !!state.isPinned);
      btn.classList.toggle('disabled', !!state.disabled);
      btn.disabled = !!state.disabled;
      btn.title = state.title;
      btn.innerHTML = state.iconHtml;
    });
  }

  function setAiBotStatus(message, type = '') {
    const el = $('#aiBotsStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function setAiModelStatus(message, type = '') {
    const el = $('#aiBotsModelStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function uniqueAiModelValues(values = []) {
    const seen = new Set();
    const result = [];
    values.forEach((value) => {
      const text = String(value || '').trim();
      if (!text) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push(text);
    });
    return result;
  }

  function setAiModelSelectOptions(id, values, currentValue) {
    const select = document.getElementById(id);
    if (!select) return;
    const current = String(currentValue || '').trim();
    const options = uniqueAiModelValues([current, ...values]);
    select.innerHTML = options.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
    if (current) select.value = current;
  }

  function renderAiModelOptions(bot = currentAiBot()) {
    const settings = aiBotState.settings || {};
    const responseModels = aiModelCatalog.response || [];
    const summaryModels = aiModelCatalog.summary || responseModels;
    const embeddingModels = aiModelCatalog.embedding || ['text-embedding-3-small'];
    setAiModelSelectOptions('aiBotsDefaultResponseModel', responseModels, settings.default_response_model || 'gpt-4o-mini');
    setAiModelSelectOptions('aiBotsDefaultSummaryModel', summaryModels, settings.default_summary_model || 'gpt-4o-mini');
    setAiModelSelectOptions('aiBotsDefaultEmbeddingModel', embeddingModels, settings.default_embedding_model || 'text-embedding-3-small');
    setAiModelSelectOptions('aiBotResponseModel', responseModels, bot?.response_model || settings.default_response_model || 'gpt-4o-mini');
    setAiModelSelectOptions('aiBotSummaryModel', summaryModels, bot?.summary_model || settings.default_summary_model || 'gpt-4o-mini');
    const botEmbedding = $('#aiBotEmbeddingModel');
    if (botEmbedding) botEmbedding.value = settings.default_embedding_model || 'text-embedding-3-small';
  }

  async function loadAiModelOptions(refresh = false) {
    const data = await api(`/api/admin/ai-bots/models${refresh ? '?refresh=1' : ''}`);
    aiModelCatalog = {
      source: data.source || 'fallback',
      response: data.response || aiModelCatalog.response,
      summary: data.summary || data.response || aiModelCatalog.summary,
      embedding: data.embedding || aiModelCatalog.embedding,
      error: data.error || '',
      fetched_at: data.fetched_at || '',
    };
    renderAiModelOptions(currentAiBot());
    if (aiModelCatalog.source === 'openai') {
      setAiModelStatus(aiModelCatalog.fetched_at ? `Модели загружены: ${aiModelCatalog.fetched_at}` : 'Модели загружены', 'success');
    } else if (aiModelCatalog.error) {
      setAiModelStatus(`Fallback models: ${aiModelCatalog.error}`, 'error');
    } else {
      setAiModelStatus('Fallback models');
    }
    return aiModelCatalog;
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

  function renderAiBotAvatar(bot = currentAiBot()) {
    const avatarEl = $('#aiBotAvatar');
    if (!avatarEl) return;
    const name = bot?.name || $('#aiBotName')?.value.trim() || 'Bananza AI';
    const color = bot?.avatar_color || '#65aadd';
    avatarEl.style.background = color;
    if (bot?.avatar_url) {
      avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
    } else {
      avatarEl.textContent = initials(name);
    }

    const hasSavedBot = Boolean(bot?.id);
    const input = $('#aiBotAvatarInput');
    const label = $('#aiBotAvatarLabel');
    if (input) {
      input.disabled = !hasSavedBot;
      input.value = '';
    }
    if (label) {
      label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
      label.title = hasSavedBot ? 'Сменить аватар' : 'Сначала сохраните бота';
    }
    $('#removeAiBotAvatar')?.classList.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
  }

  function refreshRenderedAiBotAvatar(bot) {
    if (!bot?.user_id || !messagesEl) return;
    messagesEl.querySelectorAll(`.msg-group-avatar[data-user-id="${Number(bot.user_id)}"]`).forEach((avatarEl) => {
      avatarEl.title = bot.name || avatarEl.title || '';
      avatarEl.dataset.displayName = bot.name || avatarEl.dataset.displayName || '';
      if (bot.mention) avatarEl.dataset.mentionToken = bot.mention;
      setAvatarElementVisual(avatarEl, {
        name: bot.name || 'AI',
        color: bot.avatar_color || '#65aadd',
        avatarUrl: bot.avatar_url || '',
      });
    });
  }


  function fillAiBotForm(bot = null) {
    const settings = aiBotState.settings || {};
    selectedAiBotId = bot ? bot.id : null;
    $('#aiBotName').value = bot?.name || 'Bananza AI';
    $('#aiBotMention').value = bot?.mention || 'bananza';
    $('#aiBotEnabled').checked = bot ? !!bot.enabled : true;
    $('#aiBotResponseModel').value = bot?.response_model || settings.default_response_model || 'gpt-4o-mini';
    $('#aiBotSummaryModel').value = bot?.summary_model || settings.default_summary_model || 'gpt-4o-mini';
    $('#aiBotEmbeddingModel').value = settings.default_embedding_model || 'text-embedding-3-small';
    $('#aiBotTemperature').value = bot?.temperature ?? 0.55;
    $('#aiBotMaxTokens').value = bot?.max_tokens ?? 1000;
    $('#aiBotStyle').value = bot?.style || 'Полезный AI-помощник для чата';
    $('#aiBotTone').value = bot?.tone || 'тёплый, внимательный, краткий';
    $('#aiBotRules').value = bot?.behavior_rules || '';
    $('#aiBotSpeech').value = bot?.speech_patterns || '';
    renderAiBotAvatar(bot);
    renderAiModelOptions(bot);
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
      temperature: Number($('#aiBotTemperature')?.value || 0.55),
      max_tokens: Number($('#aiBotMaxTokens')?.value || 1000),
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
        <span class="ai-bot-list-main">
          <span class="ai-bot-list-avatar" style="background:${esc(bot.avatar_color || '#65aadd')}">
            ${bot.avatar_url ? `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">` : esc(initials(bot.name || '?'))}
          </span>
          <span class="ai-bot-list-copy">
            <strong>${esc(bot.name)}</strong>
            <small>@${esc(bot.mention)} · ${bot.enabled ? 'enabled' : 'disabled'}</small>
          </span>
        </span>
        <span class="ai-bot-list-model">${bot.response_model ? esc(bot.response_model) : ''}</span>
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
    renderAiModelOptions(selected);
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
    loadAiModelOptions(false).catch((e) => {
      setAiModelStatus(e.message || 'Не удалось загрузить список моделей', 'error');
    });
  }

  async function saveAiBotSettings() {
    setAiBotStatus('Сохраняю...');
    try {
      await persistAiBotSettings();
      await loadAiModelOptions(true).catch(() => {});
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
      await loadAiModelOptions(true).catch(() => {});
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
      if (data.bot?.user_id) {
        applyUserUpdate({
          id: data.bot.user_id,
          user_id: data.bot.user_id,
          display_name: data.bot.name,
          avatar_color: data.bot.avatar_color,
          avatar_url: data.bot.avatar_url,
          is_ai_bot: 1,
        });
      }
      renderAiBotSettings();
      setAiBotStatus('Бот сохранён', 'success');
    } catch (e) {
      setAiBotStatus(e.message || 'Не удалось сохранить бота', 'error');
    }
  }

  async function uploadAiBotAvatar(file) {
    if (!file) return;
    if (!selectedAiBotId) {
      setAiBotStatus('Сначала сохраните бота, потом добавьте аватар', 'error');
      renderAiBotAvatar(null);
      return;
    }
    const fd = new FormData();
    fd.append('avatar', file);
    setAiBotStatus('Загружаю аватар...');
    try {
      const data = await api(`/api/admin/ai-bots/${selectedAiBotId}/avatar`, { method: 'POST', body: fd });
      mergeAiBotState(data);
      selectedAiBotId = data.bot?.id || selectedAiBotId;
      if (data.bot?.user_id) {
        applyUserUpdate({
          id: data.bot.user_id,
          user_id: data.bot.user_id,
          display_name: data.bot.name,
          avatar_color: data.bot.avatar_color,
          avatar_url: data.bot.avatar_url,
          is_ai_bot: 1,
        });
      }
      renderAiBotList();
      renderAiBotAvatar(currentAiBot());
      refreshRenderedAiBotAvatar(data.bot);
      renderAiChatBotSettings();
      setAiBotStatus('Аватар сохранён', 'success');
    } catch (e) {
      setAiBotStatus(e.message || 'Не удалось загрузить аватар', 'error');
      renderAiBotAvatar(currentAiBot());
    }
  }

  async function removeAiBotAvatar() {
    if (!selectedAiBotId) return;
    try {
      const data = await api(`/api/admin/ai-bots/${selectedAiBotId}/avatar`, { method: 'DELETE' });
      mergeAiBotState(data);
      selectedAiBotId = data.bot?.id || selectedAiBotId;
      if (data.bot?.user_id) {
        applyUserUpdate({
          id: data.bot.user_id,
          user_id: data.bot.user_id,
          display_name: data.bot.name,
          avatar_color: data.bot.avatar_color,
          avatar_url: data.bot.avatar_url,
          is_ai_bot: 1,
        });
      }
      renderAiBotList();
      renderAiBotAvatar(currentAiBot());
      refreshRenderedAiBotAvatar(data.bot);
      renderAiChatBotSettings();
      setAiBotStatus('Аватар удалён', 'success');
    } catch (e) {
      setAiBotStatus(e.message || 'Не удалось удалить аватар', 'error');
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

  function filenameFromContentDisposition(header, fallback) {
    const match = String(header || '').match(/filename="?([^";]+)"?/i);
    return match ? match[1] : fallback;
  }

  async function exportAiBotJson() {
    if (!selectedAiBotId) { setAiBotStatus('Сначала выберите сохранённого бота', 'error'); return; }
    setAiBotStatus('Готовлю JSON...');
    try {
      const headers = {};
      if (token) headers.Authorization = 'Bearer ' + token;
      const res = await fetch(`/api/admin/ai-bots/${selectedAiBotId}/export`, { headers });
      if (!res.ok) {
        let data = {};
        try { data = await res.json(); } catch {}
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const bot = currentAiBot();
      const fallbackName = `bananza-bot-${bot?.mention || selectedAiBotId}.json`;
      const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setAiBotStatus('JSON выгружен', 'success');
    } catch (e) {
      setAiBotStatus(e.message || 'Не удалось выгрузить JSON', 'error');
    }
  }

  async function importAiBotJsonFile(file) {
    if (!file) return;
    setAiBotStatus('Загружаю JSON...');
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const data = await api('/api/admin/ai-bots/import', { method: 'POST', body: payload });
      mergeAiBotState(data);
      selectedAiBotId = data.bot?.id || selectedAiBotId;
      renderAiBotSettings();
      const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
      setAiBotStatus(`Бот импортирован.${warnings}`, warnings ? 'error' : 'success');
    } catch (e) {
      setAiBotStatus(e.message || 'Не удалось импортировать JSON', 'error');
    } finally {
      const input = $('#aiBotImportFile');
      if (input) input.value = '';
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

  function setYandexAiStatus(message, type = '') {
    const el = $('#yandexAiStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function setYandexAiModelStatus(message, type = '') {
    const el = $('#yandexAiModelStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function formatUiErrorMessage(value, fallback = 'Unexpected error') {
    if (value == null) return fallback;
    if (typeof value === 'string') return value.trim() || fallback;
    if (value instanceof Error) return formatUiErrorMessage(value.message, fallback);
    if (Array.isArray(value)) {
      const text = value.map((item) => formatUiErrorMessage(item, '')).filter(Boolean).join('; ');
      return text || fallback;
    }
    if (typeof value === 'object') {
      const nested = formatUiErrorMessage(
        value.message
        || value.error?.message
        || value.error
        || value.details?.[0]?.message
        || value.type
        || value.error?.type
        || value.code
        || value.description
        || value.reason,
        ''
      );
      if (nested) return nested;
      try {
        const text = JSON.stringify(value);
        return text === '{}' ? fallback : text;
      } catch {
        return fallback;
      }
    }
    return String(value).trim() || fallback;
  }

  function currentYandexBot() {
    return yandexBotState.bots.find(bot => Number(bot.id) === Number(selectedYandexBotId)) || null;
  }

  function getYandexChatSetting(chatId, botId) {
    return yandexBotState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
  }

  function mergeYandexAiState(data = {}) {
    const state = data.state || data;
    if (state.settings) yandexBotState.settings = { ...yandexBotState.settings, ...state.settings };
    if (state.bots) yandexBotState.bots = state.bots;
    if (state.chats) yandexBotState.chats = state.chats;
    if (state.chatSettings) yandexBotState.chatSettings = state.chatSettings;
    if (state.models) yandexBotState.models = { ...yandexBotState.models, ...state.models };
    if (selectedYandexBotId && !yandexBotState.bots.some(bot => Number(bot.id) === Number(selectedYandexBotId))) {
      selectedYandexBotId = null;
    }
    mentionTargetsByChat.clear();
  }

  function renderYandexModelOptions(bot = currentYandexBot()) {
    const settings = yandexBotState.settings || {};
    const models = yandexBotState.models || {};
    const responseModels = models.response || ['yandexgpt/latest', 'yandexgpt-lite/latest'];
    const summaryModels = models.summary || ['yandexgpt-lite/latest', 'yandexgpt/latest'];
    setAiModelSelectOptions('yandexAiDefaultResponseModel', responseModels, settings.yandex_default_response_model || 'yandexgpt/latest');
    setAiModelSelectOptions('yandexAiDefaultSummaryModel', summaryModels, settings.yandex_default_summary_model || 'yandexgpt-lite/latest');
    setAiModelSelectOptions('yandexAiBotResponseModel', responseModels, bot?.response_model || settings.yandex_default_response_model || 'yandexgpt/latest');
    setAiModelSelectOptions('yandexAiBotSummaryModel', summaryModels, bot?.summary_model || settings.yandex_default_summary_model || 'yandexgpt-lite/latest');
  }

  function renderYandexBotAvatar(bot = currentYandexBot()) {
    const avatarEl = $('#yandexAiBotAvatar');
    if (!avatarEl) return;
    const name = bot?.name || $('#yandexAiBotName')?.value.trim() || 'Yandex AI';
    const color = bot?.avatar_color || '#65aadd';
    avatarEl.style.background = color;
    if (bot?.avatar_url) {
      avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
    } else {
      avatarEl.textContent = initials(name);
    }

    const hasSavedBot = Boolean(bot?.id);
    const input = $('#yandexAiBotAvatarInput');
    const label = $('#yandexAiBotAvatarLabel');
    if (input) {
      input.disabled = !hasSavedBot;
      input.value = '';
    }
    if (label) {
      label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
      label.title = hasSavedBot ? 'Change avatar' : 'Save the bot first';
    }
    $('#removeYandexAiBotAvatar')?.classList.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
  }

  function fillYandexBotForm(bot = null) {
    const settings = yandexBotState.settings || {};
    selectedYandexBotId = bot ? bot.id : null;
    $('#yandexAiBotName').value = bot?.name || 'Yandex AI';
    $('#yandexAiBotMention').value = bot?.mention || 'yandex';
    $('#yandexAiBotEnabled').checked = bot ? !!bot.enabled : true;
    $('#yandexAiBotResponseModel').value = bot?.response_model || settings.yandex_default_response_model || 'yandexgpt/latest';
    $('#yandexAiBotSummaryModel').value = bot?.summary_model || settings.yandex_default_summary_model || 'yandexgpt-lite/latest';
    $('#yandexAiBotTemperature').value = bot?.temperature ?? settings.yandex_temperature ?? 0.3;
    $('#yandexAiBotMaxTokens').value = bot?.max_tokens ?? settings.yandex_max_tokens ?? 1000;
    $('#yandexAiBotStyle').value = bot?.style || 'Helpful Yandex AI assistant for chat';
    $('#yandexAiBotTone').value = bot?.tone || 'warm, concise, attentive';
    $('#yandexAiBotRules').value = bot?.behavior_rules || '';
    $('#yandexAiBotSpeech').value = bot?.speech_patterns || '';
    renderYandexBotAvatar(bot);
    renderYandexModelOptions(bot);
    renderYandexBotList();
    renderYandexChatBotSettings();
  }

  function yandexBotFormPayload() {
    return {
      name: $('#yandexAiBotName')?.value.trim(),
      mention: $('#yandexAiBotMention')?.value.trim(),
      enabled: $('#yandexAiBotEnabled')?.checked,
      response_model: $('#yandexAiBotResponseModel')?.value.trim(),
      summary_model: $('#yandexAiBotSummaryModel')?.value.trim(),
      temperature: Number($('#yandexAiBotTemperature')?.value || 0.3),
      max_tokens: Number($('#yandexAiBotMaxTokens')?.value || 1000),
      style: $('#yandexAiBotStyle')?.value.trim(),
      tone: $('#yandexAiBotTone')?.value.trim(),
      behavior_rules: $('#yandexAiBotRules')?.value.trim(),
      speech_patterns: $('#yandexAiBotSpeech')?.value.trim(),
    };
  }

  function renderYandexBotList() {
    const list = $('#yandexAiBotList');
    if (!list) return;
    if (!yandexBotState.bots.length) {
      list.innerHTML = '<div class="ai-bot-empty">No Yandex bots yet. Create the first one.</div>';
      return;
    }
    list.innerHTML = yandexBotState.bots.map(bot => `
      <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedYandexBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
        <span class="ai-bot-list-main">
          <span class="ai-bot-list-avatar" style="background:${esc(bot.avatar_color || '#65aadd')}">
            ${bot.avatar_url ? `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">` : esc(initials(bot.name || '?'))}
          </span>
          <span class="ai-bot-list-copy">
            <strong>${esc(bot.name)}</strong>
            <small>@${esc(bot.mention)} · ${bot.enabled ? 'enabled' : 'disabled'}</small>
          </span>
        </span>
        <span class="ai-bot-list-model">${bot.response_model ? esc(bot.response_model) : ''}</span>
      </button>
    `).join('');
  }

  function renderYandexChatBotSettings() {
    const chatSelect = $('#yandexAiBotChatSelect');
    const botSelect = $('#yandexAiBotChatBotSelect');
    if (!chatSelect || !botSelect) return;
    const currentChatValue = chatSelect.value || String(currentChatId || yandexBotState.chats[0]?.id || '');
    const currentBotValue = botSelect.value || String(selectedYandexBotId || yandexBotState.bots[0]?.id || '');

    chatSelect.innerHTML = yandexBotState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
    botSelect.innerHTML = yandexBotState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
    if (yandexBotState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
    if (yandexBotState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
    if (!botSelect.value && yandexBotState.bots[0]) botSelect.value = String(yandexBotState.bots[0].id);

    const setting = getYandexChatSetting(chatSelect.value, botSelect.value);
    $('#yandexAiBotChatEnabled').checked = !!setting?.enabled;
    $('#yandexAiBotChatMode').value = setting?.mode || 'simple';
    $('#yandexAiBotChatHotLimit').value = setting?.hot_context_limit || 50;
  }

  function renderYandexAiSettings() {
    const settings = yandexBotState.settings || {};
    $('#yandexAiGlobalEnabled').checked = !!settings.yandex_enabled;
    $('#yandexAiFolderId').value = settings.yandex_folder_id || '';
    $('#yandexAiBaseUrl').value = settings.yandex_base_url || 'https://llm.api.cloud.yandex.net/foundationModels/v1';
    $('#yandexAiDocEmbeddingModel').value = settings.yandex_default_embedding_doc_model || 'text-search-doc/latest';
    $('#yandexAiQueryEmbeddingModel').value = settings.yandex_default_embedding_query_model || 'text-search-query/latest';
    $('#yandexAiTemperature').value = settings.yandex_temperature ?? 0.3;
    $('#yandexAiSummaryTemperature').value = settings.yandex_summary_temperature ?? 0.2;
    $('#yandexAiMaxTokens').value = settings.yandex_max_tokens || 1000;
    $('#yandexAiReasoningMode').value = settings.yandex_reasoning_mode || 'DISABLED';
    $('#yandexAiDataLoggingEnabled').checked = !!settings.yandex_data_logging_enabled;
    $('#yandexAiApiKey').value = '';
    $('#yandexAiKeyStatus').textContent = settings.has_yandex_key
      ? `Key saved: ${settings.masked_yandex_key || '***'}`
      : 'Key is not saved';
    renderYandexModelOptions(currentYandexBot());
    $('#yandexAiDefaultResponseModel').value = settings.yandex_default_response_model || 'yandexgpt/latest';
    $('#yandexAiDefaultSummaryModel').value = settings.yandex_default_summary_model || 'yandexgpt-lite/latest';
    const selected = currentYandexBot() || yandexBotState.bots[0] || null;
    fillYandexBotForm(selected);
    renderYandexChatBotSettings();
    const models = yandexBotState.models || {};
    if (models.error) {
      setYandexAiModelStatus(`Model list fallback is used: ${formatUiErrorMessage(models.error, 'Could not load Yandex models')}`, 'error');
    } else if (models.source === 'live') {
      setYandexAiModelStatus(`Loaded ${models.response?.length || 0} Yandex models for selectors.`, 'success');
    } else {
      setYandexAiModelStatus(settings.yandex_folder_id ? 'Static model fallback is shown. Press "Обновить модели" or "Проверить ключ" to load account models.' : 'Введите идентификатор каталога в поле Folder ID выше перед проверкой.');
    }
  }

  function yandexAiSettingsPayload() {
    const body = {
      yandex_enabled: $('#yandexAiGlobalEnabled')?.checked,
      yandex_folder_id: $('#yandexAiFolderId')?.value.trim(),
      yandex_base_url: $('#yandexAiBaseUrl')?.value.trim(),
      yandex_default_response_model: $('#yandexAiDefaultResponseModel')?.value.trim(),
      yandex_default_summary_model: $('#yandexAiDefaultSummaryModel')?.value.trim(),
      yandex_default_embedding_doc_model: $('#yandexAiDocEmbeddingModel')?.value.trim(),
      yandex_default_embedding_query_model: $('#yandexAiQueryEmbeddingModel')?.value.trim(),
      yandex_temperature: Number($('#yandexAiTemperature')?.value || 0.3),
      yandex_summary_temperature: Number($('#yandexAiSummaryTemperature')?.value || 0.2),
      yandex_max_tokens: Number($('#yandexAiMaxTokens')?.value || 1000),
      yandex_reasoning_mode: $('#yandexAiReasoningMode')?.value || 'DISABLED',
      yandex_data_logging_enabled: $('#yandexAiDataLoggingEnabled')?.checked,
    };
    const key = $('#yandexAiApiKey')?.value.trim();
    if (key) body.yandex_api_key = key;
    return body;
  }

  async function persistYandexAiSettings() {
    const data = await api('/api/admin/yandex-ai-bots/settings', {
      method: 'PUT',
      body: yandexAiSettingsPayload(),
    });
    mergeYandexAiState(data);
    return data;
  }

  async function loadYandexAiState() {
    const data = await api('/api/admin/yandex-ai-bots');
    mergeYandexAiState(data);
    renderYandexAiSettings();
  }

  async function saveYandexAiSettings() {
    setYandexAiStatus('Saving...');
    try {
      await persistYandexAiSettings();
      renderYandexAiSettings();
      setYandexAiStatus('Settings saved', 'success');
    } catch (e) {
      setYandexAiStatus(e.message || 'Could not save settings', 'error');
    }
  }

  async function testYandexAiConnection() {
    const folderInput = $('#yandexAiFolderId');
    const keyInput = $('#yandexAiApiKey');
    const folderId = folderInput?.value.trim();
    const hasKey = Boolean(keyInput?.value.trim() || yandexBotState.settings?.has_yandex_key);
    if (!folderId) {
      setYandexAiStatus('Введите идентификатор каталога Yandex Cloud в поле Folder ID.', 'error');
      setYandexAiModelStatus('Folder ID нужен для modelUri: gpt://<folder_ID>/yandexgpt/latest.', 'error');
      folderInput?.focus();
      return;
    }
    if (!hasKey) {
      setYandexAiStatus('Введите Yandex API key перед проверкой.', 'error');
      keyInput?.focus();
      return;
    }

    setYandexAiStatus('Checking Yandex connection...');
    try {
      const data = await api('/api/admin/yandex-ai-bots/test-connection', {
        method: 'POST',
        body: yandexAiSettingsPayload(),
      });
      await persistYandexAiSettings();
      if (data.state?.models) mergeYandexAiState({ state: { models: data.state.models } });
      renderYandexAiSettings();
      const text = String(data.result?.text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
      const latency = data.result?.latencyMs || 0;
      const models = yandexBotState.models || {};
      const modelNote = models.source === 'live' ? ` Моделей в селекторе: ${models.response?.length || 0}.` : '';
      setYandexAiStatus(`Ключ проверен и сохранен (${latency} ms). ${text}${modelNote}`, 'success');
      setYandexAiModelStatus(
        models.error
          ? `Key OK. Model list fallback is used: ${formatUiErrorMessage(models.error, 'Could not load Yandex models')}`
          : `OK: ${data.result?.model || 'Yandex model'}`,
        models.error ? 'error' : 'success'
      );
    } catch (e) {
      setYandexAiStatus(formatUiErrorMessage(e, 'Could not check Yandex key'), 'error');
    }
  }

  async function refreshYandexAiModels() {
    const folderInput = $('#yandexAiFolderId');
    const keyInput = $('#yandexAiApiKey');
    const folderId = folderInput?.value.trim();
    const hasKey = Boolean(keyInput?.value.trim() || yandexBotState.settings?.has_yandex_key);
    if (!folderId) {
      setYandexAiStatus('Введите идентификатор каталога Yandex Cloud в поле Folder ID.', 'error');
      folderInput?.focus();
      return;
    }
    if (!hasKey) {
      setYandexAiStatus('Введите или сохраните Yandex API key перед загрузкой моделей.', 'error');
      keyInput?.focus();
      return;
    }

    setYandexAiStatus('Loading Yandex models...');
    try {
      const data = await api('/api/admin/yandex-ai-bots/models/refresh', {
        method: 'POST',
        body: yandexAiSettingsPayload(),
      });
      mergeYandexAiState(data);
      renderYandexAiSettings();
      setYandexAiStatus(`Модели обновлены: ${yandexBotState.models?.response?.length || 0} в селекторе.`, 'success');
    } catch (e) {
      setYandexAiStatus(formatUiErrorMessage(e, 'Could not load Yandex models'), 'error');
    }
  }

  async function deleteYandexAiKey() {
    if (!confirm('Delete Yandex API key for AI bots?')) return;
    try {
      const data = await api('/api/admin/yandex-ai-bots/key', { method: 'DELETE' });
      mergeYandexAiState(data);
      renderYandexAiSettings();
      setYandexAiStatus('Key deleted', 'success');
    } catch (e) {
      setYandexAiStatus(e.message || 'Could not delete key', 'error');
    }
  }

  async function saveYandexBot() {
    const payload = yandexBotFormPayload();
    if (!payload.name) { setYandexAiStatus('Enter bot name', 'error'); return; }
    setYandexAiStatus('Saving bot...');
    try {
      await persistYandexAiSettings();
      const shouldUpdate = Boolean(selectedYandexBotId && yandexBotState.bots.some(bot => Number(bot.id) === Number(selectedYandexBotId)));
      const url = shouldUpdate ? `/api/admin/yandex-ai-bots/${selectedYandexBotId}` : '/api/admin/yandex-ai-bots';
      const method = shouldUpdate ? 'PUT' : 'POST';
      const data = await api(url, { method, body: payload });
      mergeYandexAiState(data);
      selectedYandexBotId = data.bot?.id || selectedYandexBotId;
      if (data.bot?.user_id) {
        applyUserUpdate({
          id: data.bot.user_id,
          user_id: data.bot.user_id,
          display_name: data.bot.name,
          avatar_color: data.bot.avatar_color,
          avatar_url: data.bot.avatar_url,
          is_ai_bot: 1,
        });
      }
      renderYandexAiSettings();
      setYandexAiStatus('Bot saved', 'success');
    } catch (e) {
      setYandexAiStatus(e.message || 'Could not save bot', 'error');
    }
  }

  async function uploadYandexBotAvatar(file) {
    if (!file) return;
    if (!selectedYandexBotId) {
      setYandexAiStatus('Save the bot before adding an avatar', 'error');
      renderYandexBotAvatar(null);
      return;
    }
    const fd = new FormData();
    fd.append('avatar', file);
    setYandexAiStatus('Uploading avatar...');
    try {
      const data = await api(`/api/admin/yandex-ai-bots/${selectedYandexBotId}/avatar`, { method: 'POST', body: fd });
      mergeYandexAiState(data);
      selectedYandexBotId = data.bot?.id || selectedYandexBotId;
      if (data.bot?.user_id) {
        applyUserUpdate({
          id: data.bot.user_id,
          user_id: data.bot.user_id,
          display_name: data.bot.name,
          avatar_color: data.bot.avatar_color,
          avatar_url: data.bot.avatar_url,
          is_ai_bot: 1,
        });
      }
      renderYandexBotList();
      renderYandexBotAvatar(currentYandexBot());
      refreshRenderedAiBotAvatar(data.bot);
      renderYandexChatBotSettings();
      setYandexAiStatus('Avatar saved', 'success');
    } catch (e) {
      setYandexAiStatus(e.message || 'Could not upload avatar', 'error');
      renderYandexBotAvatar(currentYandexBot());
    }
  }

  async function removeYandexBotAvatar() {
    if (!selectedYandexBotId) return;
    try {
      const data = await api(`/api/admin/yandex-ai-bots/${selectedYandexBotId}/avatar`, { method: 'DELETE' });
      mergeYandexAiState(data);
      selectedYandexBotId = data.bot?.id || selectedYandexBotId;
      if (data.bot?.user_id) {
        applyUserUpdate({
          id: data.bot.user_id,
          user_id: data.bot.user_id,
          display_name: data.bot.name,
          avatar_color: data.bot.avatar_color,
          avatar_url: data.bot.avatar_url,
          is_ai_bot: 1,
        });
      }
      renderYandexBotList();
      renderYandexBotAvatar(currentYandexBot());
      refreshRenderedAiBotAvatar(data.bot);
      renderYandexChatBotSettings();
      setYandexAiStatus('Avatar removed', 'success');
    } catch (e) {
      setYandexAiStatus(e.message || 'Could not remove avatar', 'error');
    }
  }

  async function disableYandexBot() {
    if (!selectedYandexBotId) return;
    if (!confirm('Disable this Yandex bot in all chats?')) return;
    try {
      const data = await api(`/api/admin/yandex-ai-bots/${selectedYandexBotId}`, { method: 'DELETE' });
      mergeYandexAiState(data);
      renderYandexAiSettings();
      setYandexAiStatus('Bot disabled', 'success');
    } catch (e) {
      setYandexAiStatus(e.message || 'Could not disable bot', 'error');
    }
  }

  async function testYandexBot() {
    if (!selectedYandexBotId) { setYandexAiStatus('Save the bot first', 'error'); return; }
    setYandexAiStatus('Testing model...');
    try {
      await persistYandexAiSettings();
      const data = await api(`/api/admin/yandex-ai-bots/${selectedYandexBotId}/test`, { method: 'POST', body: {} });
      const text = data.result?.text ? data.result.text.slice(0, 500) : '';
      setYandexAiStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
    } catch (e) {
      setYandexAiStatus(e.message || 'Test failed', 'error');
    }
  }

  async function exportYandexBotJson() {
    if (!selectedYandexBotId) { setYandexAiStatus('Choose a saved bot first', 'error'); return; }
    setYandexAiStatus('Preparing JSON...');
    try {
      const headers = {};
      if (token) headers.Authorization = 'Bearer ' + token;
      const res = await fetch(`/api/admin/yandex-ai-bots/${selectedYandexBotId}/export`, { headers });
      if (!res.ok) {
        let data = {};
        try { data = await res.json(); } catch {}
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const bot = currentYandexBot();
      const fallbackName = `bananza-yandex-bot-${bot?.mention || selectedYandexBotId}.json`;
      const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setYandexAiStatus('JSON exported', 'success');
    } catch (e) {
      setYandexAiStatus(e.message || 'Could not export JSON', 'error');
    }
  }

  async function importYandexBotJsonFile(file) {
    if (!file) return;
    setYandexAiStatus('Importing JSON...');
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const data = await api('/api/admin/yandex-ai-bots/import', { method: 'POST', body: payload });
      mergeYandexAiState(data);
      selectedYandexBotId = data.bot?.id || selectedYandexBotId;
      renderYandexAiSettings();
      const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
      setYandexAiStatus(`Bot imported.${warnings}`, warnings ? 'error' : 'success');
    } catch (e) {
      setYandexAiStatus(e.message || 'Could not import JSON', 'error');
    } finally {
      const input = $('#yandexAiBotImportFile');
      if (input) input.value = '';
    }
  }

  async function saveYandexChatBotSettings() {
    const chatId = Number($('#yandexAiBotChatSelect')?.value || 0);
    const botId = Number($('#yandexAiBotChatBotSelect')?.value || 0);
    const botExists = yandexBotState.bots.some(bot => Number(bot.id) === botId);
    if (!chatId || !botId) { setYandexAiStatus('Choose chat and bot', 'error'); return; }
    if (!botExists) {
      setYandexAiStatus('Save the bot first', 'error');
      await loadYandexAiState().catch(() => {});
      return;
    }
    try {
      await persistYandexAiSettings();
      const data = await api('/api/admin/yandex-ai-bots/chat-settings', {
        method: 'PUT',
        body: {
          chatId,
          botId,
          enabled: $('#yandexAiBotChatEnabled')?.checked,
          mode: $('#yandexAiBotChatMode')?.value || 'simple',
          hot_context_limit: Number($('#yandexAiBotChatHotLimit')?.value || 50),
        },
      });
      mergeYandexAiState(data);
      renderYandexChatBotSettings();
      setYandexAiStatus('Chat settings saved', 'success');
    } catch (e) {
      setYandexAiStatus(e.message || 'Could not save chat settings', 'error');
    }
  }

  function getPayloadChatId(payload = {}) {
    const id = Number(payload.chatId || payload.chat_id || 0);
    return Number.isInteger(id) && id > 0 ? id : 0;
  }

  function scheduleRecoverySync(reason = 'event', { chatId = null, immediate = false } = {}) {
    if (!token || !currentUser) return;
    const id = Number(chatId || 0);
    if (Number.isInteger(id) && id > 0) pendingRecoveryChatIds.add(id);
    if (!initialChatLoadFinished && !currentChatId) return;
    if (document.hidden) {
      recoverySyncRequested = true;
      return;
    }

    recoverySyncRequested = true;
    const elapsed = Date.now() - recoverySyncLastStartedAt;
    const delay = immediate ? 0 : Math.max(0, RECOVERY_SYNC_MIN_INTERVAL_MS - elapsed);
    clearTimeout(recoverySyncTimer);
    recoverySyncTimer = setTimeout(() => {
      recoverySyncTimer = null;
      runRecoverySync(reason).catch(() => {});
    }, delay);
  }

  async function runRecoverySync(reason = 'event') {
    if (!token || !currentUser) return;
    if (recoverySyncPromise) {
      recoverySyncRequested = true;
      return recoverySyncPromise;
    }

    recoverySyncRequested = false;
    recoverySyncLastStartedAt = Date.now();
    const requestedChatIds = [...pendingRecoveryChatIds];
    pendingRecoveryChatIds.clear();

    recoverySyncPromise = (async () => {
      await loadChats({ silent: true }).catch(() => chats);

      const activeChatId = Number(currentChatId || 0);
      if (activeChatId) {
        await catchUpCurrentChat(activeChatId, {
          fromPush: requestedChatIds.includes(activeChatId) || reason === 'push',
        });
      }
    })();

    try {
      return await recoverySyncPromise;
    } finally {
      recoverySyncPromise = null;
      if (recoverySyncRequested || pendingRecoveryChatIds.size > 0) {
        scheduleRecoverySync('queued');
      }
    }
  }

  function refreshWebSocketAfterResume() {
    if (!token) return;
    const hiddenFor = lastHiddenAt ? Date.now() - lastHiddenAt : 0;
    const shouldRefreshOpenSocket = ws
      && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
      && hiddenFor >= RESUME_WS_REFRESH_AFTER_MS;
    connectWS({ force: shouldRefreshOpenSocket });
  }

  function handleAppResume(reason) {
    if (!token || !currentUser) return;
    refreshWebSocketAfterResume();
    scheduleRecoverySync(reason, { immediate: true });
  }

  function setupLifecycleRecovery() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        lastHiddenAt = Date.now();
        return;
      }
      handleAppResume('visible');
    });
    window.addEventListener('focus', () => handleAppResume('focus'));
    window.addEventListener('pageshow', () => handleAppResume('pageshow'));
    window.addEventListener('online', () => handleAppResume('online'));
    window.addEventListener('pagehide', () => { lastHiddenAt = Date.now(); });
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
    } else if (data.type === 'push_received') {
      const chatId = getPayloadChatId(data.payload || {});
      scheduleRecoverySync('push', {
        chatId,
        immediate: Boolean(chatId && Number(chatId) === Number(currentChatId || 0)),
      });
    }
  }

  function chatItemAvatarHtml(chat) {
    if (isNotesChat(chat)) {
      return `<div class="chat-item-avatar notes-chat-avatar" style="background:#5eb5f7">${esc(chat.avatar_emoji || NOTES_CHAT_EMOJI)}`;
    }
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

  function suppressNextChatItemTap(ms = 650) {
    suppressNextChatItemTapUntil = Math.max(suppressNextChatItemTapUntil, Date.now() + Math.max(0, Number(ms) || 0));
  }

  function clearChatContextLongPress() {
    clearTimeout(chatContextLongPressTimer);
    chatContextLongPressTimer = null;
    chatContextLongPressStart = null;
    chatContextLongPressRow = null;
  }

  function renderChatContextMenu(chat) {
    if (!chatContextMenu || !chat) return;
    const pinned = isChatPinned(chat);
    const moveState = getPinnedChatMoveState(chat.id);
    const notificationsEnabled = localChatPreferenceEnabled(chat.notify_enabled);
    const soundsEnabled = localChatPreferenceEnabled(chat.sounds_enabled);
    const actions = [
      {
        action: 'toggle-pin',
        icon: '&#128204;',
        label: pinned ? 'Unpin' : 'Pin',
        hidden: false,
        disabled: false,
      },
      {
        action: 'move-up',
        icon: '&#8593;',
        label: 'Move up',
        hidden: !pinned,
        disabled: !moveState.canMoveUp,
      },
      {
        action: 'move-down',
        icon: '&#8595;',
        label: 'Move down',
        hidden: !pinned,
        disabled: !moveState.canMoveDown,
      },
      {
        action: 'toggle-notifications',
        icon: '&#128276;',
        label: notificationsEnabled ? 'Disable notifications' : 'Enable notifications',
        hidden: false,
        disabled: false,
      },
      {
        action: 'toggle-sound',
        icon: '&#128266;',
        label: soundsEnabled ? 'Disable sound' : 'Enable sound',
        hidden: false,
        disabled: false,
      },
    ];
    chatContextMenu.innerHTML = `
      <div class="chat-context-menu-sheet">
        <div class="chat-context-menu-header">${esc(chat.name || 'Chat')}</div>
        ${actions
          .filter((item) => !item.hidden)
          .map((item) => `
            <button
              type="button"
              class="chat-context-menu-button"
              data-chat-action="${esc(item.action)}"
              ${item.disabled ? 'disabled' : ''}
            >
              <span class="chat-context-menu-icon" aria-hidden="true">${item.icon}</span>
              <span class="chat-context-menu-label">${esc(item.label)}</span>
            </button>
          `).join('')}
      </div>
    `;
    chatContextMenu.setAttribute('aria-hidden', 'false');
    chatContextMenu.setAttribute('role', 'menu');
    chatContextMenu.dataset.chatId = String(chat.id);
  }

  function positionChatContextMenu() {
    if (!chatContextMenuState || !chatContextMenu || chatContextMenu.classList.contains('hidden')) return;
    const row = chatList.querySelector(`.chat-item[data-chat-id="${chatContextMenuState.chatId}"]`) || chatContextMenuState.row;
    if (!(row instanceof HTMLElement)) {
      hideChatContextMenu({ immediate: true });
      return;
    }
    chatContextMenuState.row = row;
    const rowRect = row.getBoundingClientRect();
    const viewport = getFloatingViewportRect();
    const size = measureFloatingSurface(chatContextMenu, 236, 260);
    const gap = 6;
    const horizontalPadding = 8;
    const preferredLeft = Math.min(rowRect.left + 10, rowRect.right - size.width);
    const left = clamp(preferredLeft, viewport.left + horizontalPadding, viewport.right - size.width - horizontalPadding);
    const belowTop = rowRect.bottom + gap;
    const aboveTop = rowRect.top - size.height - gap;
    const fitsBelow = belowTop + size.height <= viewport.bottom - horizontalPadding;
    const preferredTop = fitsBelow || aboveTop < viewport.top + horizontalPadding
      ? belowTop
      : aboveTop;
    const top = clamp(preferredTop, viewport.top + horizontalPadding, viewport.bottom - size.height - horizontalPadding);
    chatContextMenu.style.right = 'auto';
    chatContextMenu.style.bottom = 'auto';
    positionFloatingElement(chatContextMenu, left, top);
  }

  function hideChatContextMenu({ immediate = false } = {}) {
    clearChatContextLongPress();
    closeFloatingSurface(chatContextMenuBackdrop, { immediate });
    closeFloatingSurface(chatContextMenu, {
      immediate,
      onAfterClose: () => {
        if (chatContextMenu) {
          chatContextMenu.innerHTML = '';
          chatContextMenu.setAttribute('aria-hidden', 'true');
          chatContextMenu.style.left = '';
          chatContextMenu.style.top = '';
          chatContextMenu.style.right = '';
          chatContextMenu.style.bottom = '';
        }
        chatContextMenuState = null;
      },
    });
  }

  function showChatContextMenuForRow(row, { x = null, y = null, source = 'contextmenu' } = {}) {
    const chatId = Number(row?.dataset?.chatId || 0);
    if (!chatId) return;
    const chat = getChatById(chatId);
    if (!chat || !chatContextMenu || !chatContextMenuBackdrop) return;
    const isSameChatOpen = isFloatingSurfaceVisible(chatContextMenu) && Number(chatContextMenuState?.chatId || 0) === chatId;
    if (isSameChatOpen) {
      hideChatContextMenu();
      return;
    }
    hideChatContextMenu({ immediate: true });
    chatContextMenuState = {
      chatId,
      row,
      source,
      pointerX: typeof x === 'number' && Number.isFinite(x) ? x : null,
      pointerY: typeof y === 'number' && Number.isFinite(y) ? y : null,
    };
    renderChatContextMenu(chat);
    positionChatContextMenu();
    openFloatingSurface(chatContextMenuBackdrop);
    openFloatingSurface(chatContextMenu);
    requestAnimationFrame(() => {
      positionChatContextMenu();
      chatContextMenu.querySelector('.chat-context-menu-button:not(:disabled)')?.focus({ preventScroll: true });
    });
  }

  async function setChatSidebarPin(chatId, pinned) {
    try {
      await api(`/api/chats/${chatId}/sidebar-pin`, { method: 'PUT', body: { pinned } });
      await loadChats({ silent: true });
      showCenterToast(pinned ? 'Chat pinned' : 'Chat unpinned');
    } catch (e) {
      showCenterToast(e.message || (pinned ? 'Could not pin chat' : 'Could not unpin chat'));
    }
  }

  async function moveChatSidebarPin(chatId, direction) {
    try {
      await api(`/api/chats/${chatId}/sidebar-pin/move`, { method: 'POST', body: { direction } });
      await loadChats({ silent: true });
      showCenterToast(direction === 'up' ? 'Moved up' : 'Moved down');
    } catch (e) {
      showCenterToast(e.message || 'Could not move pinned chat');
    }
  }

  async function updateChatContextPreference(chatId, changes) {
    const chat = getChatById(chatId);
    if (!chat) return;
    const next = {
      notify_enabled: Object.prototype.hasOwnProperty.call(changes, 'notify_enabled')
        ? !!changes.notify_enabled
        : localChatPreferenceEnabled(chat.notify_enabled),
      sounds_enabled: Object.prototype.hasOwnProperty.call(changes, 'sounds_enabled')
        ? !!changes.sounds_enabled
        : localChatPreferenceEnabled(chat.sounds_enabled),
    };
    try {
      const data = await api(`/api/chats/${chatId}/preferences`, { method: 'PUT', body: next });
      Object.assign(chat, data.preferences || next);
      renderChatList(chatSearch.value);
      if (Number(currentChatId || 0) === Number(chatId)) {
        renderChatPreferencesForm(chat);
      }
      if (Object.prototype.hasOwnProperty.call(changes, 'notify_enabled')) {
        showCenterToast(next.notify_enabled ? 'Notifications enabled' : 'Notifications disabled');
      } else if (Object.prototype.hasOwnProperty.call(changes, 'sounds_enabled')) {
        showCenterToast(next.sounds_enabled ? 'Sound enabled' : 'Sound disabled');
      }
    } catch (e) {
      showCenterToast(e.message || 'Could not update chat preferences');
    }
  }

  async function handleChatContextMenuAction(action, chatId) {
    const chat = getChatById(chatId);
    if (!chat) return;
    if (action === 'toggle-pin') {
      await setChatSidebarPin(chatId, !isChatPinned(chat));
      return;
    }
    if (action === 'move-up') {
      await moveChatSidebarPin(chatId, 'up');
      return;
    }
    if (action === 'move-down') {
      await moveChatSidebarPin(chatId, 'down');
      return;
    }
    if (action === 'toggle-notifications') {
      await updateChatContextPreference(chatId, {
        notify_enabled: !localChatPreferenceEnabled(chat.notify_enabled),
      });
      return;
    }
    if (action === 'toggle-sound') {
      await updateChatContextPreference(chatId, {
        sounds_enabled: !localChatPreferenceEnabled(chat.sounds_enabled),
      });
    }
  }

  async function copyTextToClipboard(text) {
    const value = String(text || '');
    if (!value) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (e) {}
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', 'readonly');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    document.body.appendChild(area);
    area.focus();
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    area.remove();
    return ok;
  }

  function modalIdOf(modalOrId) {
    if (typeof modalOrId === 'string') return modalOrId;
    return modalOrId?.id || '';
  }

  function modalEntryOf(modalOrId) {
    return modalRegistry.get(modalIdOf(modalOrId)) || null;
  }

  function rememberActiveElement() {
    return document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  function focusElementIfPossible(el) {
    if (!(el instanceof HTMLElement) || !el.isConnected) return false;
    if (el.matches('[disabled], [aria-hidden="true"]')) return false;
    if (el.closest('[inert]')) return false;
    try {
      el.focus({ preventScroll: true });
      return true;
    } catch {
      try {
        el.focus();
        return true;
      } catch {
        return false;
      }
    }
  }

  function getModalFocusableTarget(entry) {
    return entry?.el?.querySelector?.(
      '[autofocus], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    ) || null;
  }

  function setModalInertState(entry, disabled) {
    if (!entry?.el) return;
    if (disabled) {
      entry.el.setAttribute('inert', '');
      entry.el.setAttribute('aria-hidden', 'true');
      entry.el.removeAttribute('aria-modal');
    } else {
      entry.el.removeAttribute('inert');
      entry.el.setAttribute('aria-hidden', 'false');
      entry.el.setAttribute('aria-modal', 'true');
    }
  }

  function updateModalStackState() {
    let activeTopIndex = -1;
    for (let index = modalStack.length - 1; index >= 0; index -= 1) {
      if (!modalStack[index]?.isClosing) {
        activeTopIndex = index;
        break;
      }
    }
    modalStack.forEach((entry, index) => {
      const isTop = index === activeTopIndex;
      entry.el.style.setProperty('--modal-layer-z', String(150 + index * 4));
      entry.el.classList.toggle('is-underlay', !entry.isClosing && !isTop);
      if (isTop && !entry.isClosing) setModalInertState(entry, false);
      else setModalInertState(entry, true);
    });
  }

  function pushModalHistoryState(modalId) {
    history.pushState({ ...(history.state || {}), modalId, modalDepth: modalHistoryDepth + 1 }, '');
    modalHistoryDepth += 1;
  }

  function rewindModalHistory(steps = 1) {
    const depth = Math.min(Number(steps) || 0, modalHistoryDepth);
    if (!depth) return;
    modalSkipPopstateCount += depth;
    modalHistoryDepth -= depth;
    history.go(-depth);
  }

  function parseTransitionTimeMs(value) {
    const text = String(value || '').trim();
    if (!text) return 0;
    if (text.endsWith('ms')) return Math.max(0, Number.parseFloat(text) || 0);
    if (text.endsWith('s')) return Math.max(0, (Number.parseFloat(text) || 0) * 1000);
    return Math.max(0, Number.parseFloat(text) || 0);
  }

  function getElementTransitionTotalMs(el) {
    if (!(el instanceof Element)) return 0;
    const styles = getComputedStyle(el);
    const durations = String(styles.transitionDuration || '').split(',').map(parseTransitionTimeMs);
    const delays = String(styles.transitionDelay || '').split(',').map(parseTransitionTimeMs);
    const count = Math.max(durations.length, delays.length);
    let max = 0;
    for (let index = 0; index < count; index += 1) {
      const duration = durations[durations.length ? index % durations.length : 0] || 0;
      const delay = delays[delays.length ? index % delays.length : 0] || 0;
      max = Math.max(max, duration + delay);
    }
    return max;
  }

  function getModalTransitionFallbackMs(entryOrEl) {
    const entry = entryOrEl?.el ? entryOrEl : modalEntryOf(entryOrEl);
    const modalEl = entry?.el || entryOrEl;
    if (!(modalEl instanceof HTMLElement)) return MODAL_TRANSITION_BUFFER_MS;
    const contentEl = modalEl.querySelector('.modal-content');
    const maxDuration = Math.max(
      getElementTransitionTotalMs(modalEl),
      getElementTransitionTotalMs(contentEl)
    );
    return Math.max(MODAL_TRANSITION_BUFFER_MS, Math.ceil(maxDuration + MODAL_TRANSITION_BUFFER_MS));
  }

  function getModalEntriesTransitionFallbackMs(entries = []) {
    return entries.reduce((max, entry) => Math.max(max, getModalTransitionFallbackMs(entry)), MODAL_TRANSITION_BUFFER_MS);
  }

  function flushPendingModalHistoryRewind() {
    clearTimeout(modalHistorySyncTimer);
    modalHistorySyncTimer = null;
    modalHistorySyncDueAt = 0;
    if (!pendingModalHistoryRewind) return;
    const steps = pendingModalHistoryRewind;
    pendingModalHistoryRewind = 0;
    rewindModalHistory(steps);
  }

  function scheduleModalHistoryRewind(steps = 1, delayMs = MODAL_TRANSITION_BUFFER_MS) {
    const count = Math.max(0, Number(steps) || 0);
    if (!count) return;
    pendingModalHistoryRewind += count;
    const nextDueAt = Date.now() + Math.max(MODAL_TRANSITION_BUFFER_MS, Number(delayMs) || 0);
    modalHistorySyncDueAt = Math.max(modalHistorySyncDueAt, nextDueAt);
    clearTimeout(modalHistorySyncTimer);
    modalHistorySyncTimer = setTimeout(() => {
      flushPendingModalHistoryRewind();
    }, Math.max(0, modalHistorySyncDueAt - Date.now()));
  }

  function finalizeModalClose(entry) {
    if (!entry?.el) return false;
    clearTimeout(entry.closeTimer);
    entry.closeTimer = null;
    entry.isClosing = false;
    entry.el.classList.add('hidden');
    entry.el.classList.remove('is-open', 'is-underlay', 'is-closing');
    entry.el.style.removeProperty('--modal-layer-z');
    entry.el.removeAttribute('inert');
    entry.el.setAttribute('aria-hidden', 'true');
    entry.el.removeAttribute('aria-modal');
    modalStack = modalStack.filter((item) => item !== entry);
    updateModalStackState();
    try {
      entry.onAfterClose?.();
    } catch (e) {}
    if (!focusElementIfPossible(entry.returnFocusEl)) {
      focusElementIfPossible(getModalFocusableTarget(getTopModal()));
    }
    return true;
  }

  function beginModalClose(entry, { immediate = false } = {}) {
    if (!entry?.el || entry.isClosing) return false;
    entry.isClosing = true;
    if (entry.openFrame) {
      cancelAnimationFrame(entry.openFrame);
      entry.openFrame = null;
    }
    entry.el.classList.remove('is-open', 'is-underlay');
    entry.el.classList.add('is-closing');
    setModalInertState(entry, true);
    updateModalStackState();
    if (immediate || prefersReducedMotion() || currentModalAnimation === 'none') {
      return finalizeModalClose(entry);
    }

    const onTransitionEnd = (event) => {
      if (event.target !== entry.el || event.propertyName !== 'opacity') return;
      entry.el.removeEventListener('transitionend', onTransitionEnd);
      finalizeModalClose(entry);
    };
    entry.el.addEventListener('transitionend', onTransitionEnd);
    clearTimeout(entry.closeTimer);
    const closeFallbackMs = getModalTransitionFallbackMs(entry);
    entry.closeTimer = setTimeout(() => {
      entry.el.removeEventListener('transitionend', onTransitionEnd);
      finalizeModalClose(entry);
    }, closeFallbackMs);
    return true;
  }

  function registerModal(modalOrId, options = {}) {
    const el = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
    if (!el?.id) return null;
    const current = modalRegistry.get(el.id) || {};
    const entry = {
      id: el.id,
      el,
      closeOnBackdrop: options.closeOnBackdrop !== false,
      onAfterClose: options.onAfterClose || current.onAfterClose || null,
      isClosing: false,
      closeTimer: null,
      openFrame: null,
      returnFocusEl: null,
    };
    modalRegistry.set(el.id, entry);
    el.dataset.managedModal = '1';
    if (!el.hasAttribute('role')) el.setAttribute('role', 'dialog');
    return entry;
  }

  function registerBuiltinModals() {
    [
      newChatModal,
      adminModal,
      chatInfoModal,
      menuDrawer,
      settingsModal,
      themeSettingsModal,
      animationSettingsModal,
      weatherSettingsModal,
      notificationSettingsModal,
      soundSettingsModal,
      aiBotSettingsModal,
      yandexAiSettingsModal,
      changePasswordModal,
    ].forEach((modal) => registerModal(modal));
    registerModal(forwardMessageModal, { onAfterClose: resetForwardMessageModal });
  }

  function getTopModal() {
    return modalStack[modalStack.length - 1] || null;
  }

  function hasOpenModal() {
    return modalStack.length > 0;
  }

  function openModal(modalOrId, { replaceStack = false, opener = null } = {}) {
    const entry = registerModal(modalOrId);
    if (!entry?.el) return null;
    flushPendingModalHistoryRewind();
    const reuseHistoryEntry = replaceStack && modalHistoryDepth === 1;
    if (replaceStack && modalStack.length) {
      closeAllModals({ immediate: true, includeMedia: false, syncHistory: !reuseHistoryEntry });
    }
    const existingIndex = modalStack.indexOf(entry);
    if (existingIndex !== -1) {
      if (existingIndex !== modalStack.length - 1) {
        const removable = modalStack.slice(existingIndex + 1).reverse();
        removable.forEach((item) => beginModalClose(item, { immediate: true }));
      }
      entry.returnFocusEl = opener instanceof HTMLElement ? opener : entry.returnFocusEl;
      updateModalStackState();
      return entry;
    }

    entry.returnFocusEl = opener instanceof HTMLElement ? opener : rememberActiveElement();
    entry.isClosing = false;
    clearTimeout(entry.closeTimer);
    if (entry.openFrame) cancelAnimationFrame(entry.openFrame);
    entry.el.classList.remove('hidden', 'is-closing', 'is-underlay');
    entry.el.classList.remove('is-open');
    modalStack.push(entry);
    updateModalStackState();
    if (reuseHistoryEntry) {
      history.replaceState({ ...(history.state || {}), modalId: entry.id, modalDepth: 1 }, '');
      modalHistoryDepth = 1;
    } else {
      pushModalHistoryState(entry.id);
    }
    entry.openFrame = requestAnimationFrame(() => {
      entry.openFrame = requestAnimationFrame(() => {
        entry.el.classList.add('is-open');
        entry.openFrame = null;
      });
    });
    return entry;
  }

  function closeModal(modalOrId, { immediate = false, fromHistory = false } = {}) {
    const entry = modalEntryOf(modalOrId);
    if (!entry) return false;
    const index = modalStack.indexOf(entry);
    if (index === -1) {
      entry.onAfterClose?.();
      return false;
    }
    const toClose = modalStack.slice(index).reverse();
    toClose.forEach((item) => beginModalClose(item, { immediate }));
    if (!fromHistory) {
      if (immediate || prefersReducedMotion() || currentModalAnimation === 'none') rewindModalHistory(toClose.length);
      else scheduleModalHistoryRewind(toClose.length, getModalEntriesTransitionFallbackMs(toClose));
    } else {
      modalHistoryDepth = Math.max(0, modalHistoryDepth - toClose.length);
    }
    return true;
  }

  function closeTopModal(options = {}) {
    const top = getTopModal();
    if (!top) return false;
    return closeModal(top.id, options);
  }

  function closeAllModals({ immediate = false, includeMedia = true, syncHistory = true } = {}) {
    if (modalStack.length) {
      const toClose = [...modalStack].reverse();
      toClose.forEach((entry) => beginModalClose(entry, { immediate }));
      if (syncHistory) {
        if (immediate || prefersReducedMotion() || currentModalAnimation === 'none') rewindModalHistory(modalHistoryDepth);
        else scheduleModalHistoryRewind(modalHistoryDepth, getModalEntriesTransitionFallbackMs(toClose));
      }
      modalHistoryDepth = 0;
    }
    if (includeMedia) closeMediaViewer();
    return true;
  }

  function closeForwardMessageModal(options = {}) {
    if (!forwardMessageModal) {
      resetForwardMessageModal();
      return false;
    }
    return closeModal(forwardMessageModal, options);
  }

  function renderForwardChatList(filter = '') {
    if (!forwardChatList) return;
    const query = String(filter || '').trim().toLowerCase();
    const forwardableChats = chats.filter(chat => !isNotesChat(chat));
    const filtered = query
      ? forwardableChats.filter(chat => getChatSearchHaystack(chat).includes(query))
      : forwardableChats;

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
    hideFloatingMessageActions();
    openModal('forwardMessageModal', { replaceStack: true });
    forwardMessageState = { id: message.id };
    renderForwardChatList();
    requestAnimationFrame(() => forwardChatSearch?.focus());
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

  async function saveMessageToNotes(message, button = null) {
    const messageId = Number(message?.id || 0);
    if (!messageId || savingToNotesMessageIds.has(messageId)) return;
    savingToNotesMessageIds.add(messageId);
    if (button) button.disabled = true;
    try {
      const saved = await api(`/api/messages/${messageId}/save-to-notes`, { method: 'POST' });
      if (saved?.chat_id) updateChatListLastMessage(saved);
      showCenterToast('Сохранено в заметки');
      playAppSound('send');
    } catch (e) {
      showCenterToast(e.message || 'Не удалось сохранить в заметки');
    } finally {
      savingToNotesMessageIds.delete(messageId);
      if (button) button.disabled = false;
      hideFloatingMessageActions();
    }
  }

  async function jumpToSavedOriginal(message) {
    const originalId = Number(message?.saved_from_message_id || 0);
    if (!originalId) {
      showCenterToast('Оригинальное сообщение удалено');
      return false;
    }

    try {
      const target = await api(`/api/messages/${originalId}/jump-target`);
      const chatId = Number(target?.chatId || 0);
      const messageId = Number(target?.messageId || originalId);
      if (!chatId || !messageId) throw new Error('Original message deleted');
      if (!chats.find(c => Number(c.id) === chatId)) await loadChats({ silent: true });
      await openChat(chatId, {
        anchorMessageId: messageId,
        suppressHistoryPush: chatId === Number(currentChatId || 0),
        source: 'saved_original',
      });
      if (scrollToMessage(messageId)) return true;
      showCenterToast('Оригинальное сообщение удалено');
      return false;
    } catch (e) {
      showCenterToast('Оригинальное сообщение удалено');
      return false;
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
      if (typeof e.button === 'number' && e.button !== 0) return;
      const item = e.target.closest('.mention-picker-item');
      if (!item) return;
      mentionPickerPointerState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startIndex: Number(item.dataset.index),
        moved: false,
      };
    }, { passive: true });
    picker.addEventListener('pointermove', (e) => {
      if (!mentionPickerPointerState || e.pointerId !== mentionPickerPointerState.pointerId || mentionPickerPointerState.moved) return;
      const dx = e.clientX - mentionPickerPointerState.startX;
      const dy = e.clientY - mentionPickerPointerState.startY;
      if ((dx * dx) + (dy * dy) > (MENTION_PICKER_TAP_DEAD_ZONE * MENTION_PICKER_TAP_DEAD_ZONE)) {
        mentionPickerPointerState.moved = true;
      }
    }, { passive: true });
    picker.addEventListener('scroll', () => {
      if (mentionPickerPointerState) mentionPickerPointerState.moved = true;
    }, { passive: true });
    picker.addEventListener('pointercancel', () => {
      mentionPickerPointerState = null;
    }, { passive: true });
    picker.addEventListener('pointerup', (e) => {
      const pointerState = mentionPickerPointerState;
      mentionPickerPointerState = null;
      if (!pointerState || e.pointerId !== pointerState.pointerId || pointerState.moved) return;
      const item = e.target.closest('.mention-picker-item');
      if (!item) return;
      const index = Number(item.dataset.index);
      if (!Number.isInteger(index) || index !== pointerState.startIndex) return;
      e.preventDefault();
      e.stopPropagation();
      const target = mentionPickerState.targets[index];
      if (target) insertMentionTarget(target);
    }, { passive: false });
    return picker;
  }

  function isComposerMeaningfullyEmpty() {
    return !String(msgInput?.value || '').trim();
  }

  function getManualMentionRange() {
    const value = String(msgInput?.value || '');
    if (!value.trim()) return { start: 0, end: value.length };
    const start = msgInput?.selectionStart ?? value.length;
    const end = msgInput?.selectionEnd ?? start;
    return { start, end };
  }

  function syncMentionOpenButton() {
    if (!mentionOpenBtn) return;
    const visible = Boolean(currentChatId && isComposerMeaningfullyEmpty());
    mentionOpenBtn.classList.toggle('hidden', !visible);
    mentionOpenBtn.disabled = !visible;
    mentionOpenBtn.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function hideMentionPicker() {
    mentionPickerState = { active: false, start: 0, end: 0, selected: 0, targets: [], source: null };
    mentionPickerPointerState = null;
    closeFloatingSurface($('#mentionPicker'));
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

  function renderMentionPicker(targets, options = {}) {
    const picker = ensureMentionPicker();
    const { source = mentionPickerState.source || 'trigger', preserveSelection = true } = options;
    if (!targets.length) {
      hideMentionPicker();
      return;
    }
    mentionPickerState.targets = targets;
    mentionPickerState.source = source;
    mentionPickerState.selected = preserveSelection
      ? Math.min(mentionPickerState.selected, targets.length - 1)
      : 0;
    picker.innerHTML = targets.map((target, index) => `
      <button type="button" class="mention-picker-item${index === mentionPickerState.selected ? ' active' : ''}" data-index="${index}">
        <span class="mention-picker-avatar" style="background:${esc(target.avatar_color || '#65aadd')}">${target.avatar_url ? `<img src="${esc(target.avatar_url)}" alt="">` : esc((target.display_name || target.token || '?').trim()[0] || '?')}</span>
        <span class="mention-picker-copy">
          <strong>${esc(target.display_name || target.token)}</strong>
          <small>@${esc(target.token)}${target.is_ai_bot ? ' &middot; AI' : ''}</small>
        </span>
      </button>
    `).join('');
    mentionPickerState.active = true;
    openFloatingSurface(picker);
    positionMentionPicker();
    requestAnimationFrame(() => positionMentionPicker());
  }

  async function openMentionPickerFromButton() {
    const chatId = Number(currentChatId || 0);
    if (mentionPickerState.active && mentionPickerState.source === 'button') {
      hideMentionPicker();
      focusComposerKeepKeyboard(true);
      return;
    }
    if (!chatId || !msgInput || !isComposerMeaningfullyEmpty()) {
      syncMentionOpenButton();
      return;
    }
    try {
      const targets = await loadMentionTargets(chatId);
      if (chatId !== Number(currentChatId || 0) || !isComposerMeaningfullyEmpty()) return;
      const range = getManualMentionRange();
      mentionPickerState.start = range.start;
      mentionPickerState.end = range.end;
      renderMentionPicker(targets, { source: 'button', preserveSelection: false });
      focusComposerKeepKeyboard(true);
    } catch {
      hideMentionPicker();
    }
  }

  async function updateMentionPicker() {
    const trigger = findMentionTrigger();
    if (!trigger) {
      if (mentionPickerState.active && mentionPickerState.source === 'button' && isComposerMeaningfullyEmpty()) {
        const chatId = Number(currentChatId || 0);
        try {
          const targets = await loadMentionTargets(chatId);
          if (chatId !== Number(currentChatId || 0) || !mentionPickerState.active || mentionPickerState.source !== 'button' || !isComposerMeaningfullyEmpty()) return;
          const range = getManualMentionRange();
          mentionPickerState.start = range.start;
          mentionPickerState.end = range.end;
          renderMentionPicker(targets, { source: 'button' });
        } catch {
          hideMentionPicker();
        }
      } else {
        hideMentionPicker();
      }
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
      renderMentionPicker(filtered, { source: 'trigger' });
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
    syncMentionOpenButton();
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
    syncMentionOpenButton();
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
      applyModalAnimation(currentUser.ui_modal_animation, false);
      applyModalAnimationSpeed(currentUser.ui_modal_animation_speed, false);
    } catch { logout(); return false; }
    return true;
  }

  function logout() {
    clearTimeout(chatListCacheSyncTimer);
    clearTimeout(wsReconnectTimer);
    if (chatListAbortController) chatListAbortController.abort();
    try { if (window.clearAssetCache) window.clearAssetCache().catch(()=>{}); } catch (e) {}
    try { if (window.messageCache && window.messageCache.clearUserCache) window.messageCache.clearUserCache().catch(()=>{}); } catch (e) {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    token = null;
    if (ws) {
      try { ws.onclose = null; ws.close(); } catch (e) {}
      ws = null;
    }
    location.href = '/login.html';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBSOCKET
  // ═══════════════════════════════════════════════════════════════════════════
  function connectWS({ force = false } = {}) {
    if (!token) return;
    if (!force && ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;

    if (!force && ws && (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED)) {
      try { ws.onclose = null; } catch (e) {}
      ws = null;
    }

    if (force && ws) {
      try {
        ws.onclose = null;
        ws.close(4000, 'resume refresh');
      } catch (e) {}
      ws = null;
    }

    const socket = new WebSocket(WS_URL + '?token=' + encodeURIComponent(token));
    ws = socket;

    socket.onopen = () => {
      if (ws !== socket) return;
      wsRetry = 1000;
      if (initialChatLoadFinished) scheduleRecoverySync('ws-open');
    };

    socket.onclose = (e) => {
      if (ws === socket) ws = null;
      if (e.code === 4003) {
        alert('Your account has been blocked by an administrator.');
        logout();
        return;
      }
      if (!token) return;
      const retryDelay = wsRetry;
      wsReconnectTimer = setTimeout(() => {
        wsRetry = Math.min(wsRetry * 2, 30000);
        connectWS();
      }, retryDelay);
    };

    socket.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        Promise.resolve(handleWSMessage(payload)).catch(() => {});
      } catch {}
    };
  }

  async function handleWSMessage(msg) {
    switch (msg.type) {
      case 'message': {
        const isOwnIncomingMessage = msg.message.user_id === currentUser.id;
        const isMentionForMe = isMessageMentioningCurrentUser(msg.message);
        applyOwnReadStateToMessage(msg.message, msg.message.chat_id);
        if (!isOwnIncomingMessage && !document.hidden) {
          if (isMentionForMe && isMentionSoundEnabled()) {
            playAppSound('mention');
          } else if (isChatIncomingSoundEnabled(msg.message.chat_id)) {
            playAppSound(msg.message.chat_id === currentChatId ? 'incoming' : 'notification');
          }
        }
        // If this message echoes a client_id, remove optimistic placeholder first
        try {
          if (msg.message && msg.message.client_id) {
            await window.messageCache?.deleteOutboxItem?.(msg.message.chat_id, msg.message.client_id);
            revokeOutboxObjectUrls(msg.message.client_id);
            outboxSending.delete(msg.message.client_id);
            const optimisticEl = messagesEl.querySelector(`.msg-row[data-outbox="1"][data-client-id="${msg.message.client_id}"]`);
            if (optimisticEl) {
              const wasNearBottom = isNearBottom();
              const anchor = !wasNearBottom && !isNearBottom(8) ? captureScrollAnchor() : null;
              optimisticEl.remove();
              forgetDisplayedMessage(optimisticEl.dataset.msgId);
              cleanupEmptyMessageGroups();
              if (anchor) requestAnimationFrame(() => restoreScrollAnchor(anchor, 1));
            }
          }
        } catch (e) {}
        // Update chat list regardless
        updateChatListLastMessage(msg.message);
        try { if (window.messageCache) window.messageCache.upsertMessage(msg.message).catch(()=>{}); } catch (e) {}
        try {
          if (msg.message.file_type === 'image' && msg.message.file_stored && window.cacheAssets) {
            window.cacheAssets([`/uploads/${msg.message.file_stored}`]).catch(()=>{});
          }
        } catch (e) {}
        // Track unread for non-current chats
        if (msg.message.chat_id !== currentChatId && msg.message.user_id !== currentUser.id) {
          const chat = chats.find(c => c.id === msg.message.chat_id);
          if (chat) {
            chat.unread_count = (chat.unread_count || 0) + 1;
            if (!chat.first_unread_id) chat.first_unread_id = msg.message.id;
            renderChatList(chatSearch.value);
          }
        }
        // Only render if we're in the relevant chat
        if (msg.message.chat_id === currentChatId && !isMessageDisplayed(msg.message.id)) {
          const wasNearBottom = isNearBottom();
          const isAiBotResponse = msg.message.ai_generated || msg.message.ai_bot_id;
          const shouldPreserveIncomingScroll = scrollRestoreMode === 'restore'
            && !isOwnIncomingMessage
            && !isAiBotResponse
            && (!wasNearBottom || document.hidden);
          const scrollTopBefore = messagesEl.scrollTop;
          appendMessage(msg.message);
          if (isOwnIncomingMessage || (!document.hidden && wasNearBottom && !shouldPreserveIncomingScroll)) {
            scrollToBottom(false, !isOwnIncomingMessage);
          } else if (shouldPreserveIncomingScroll) {
            messagesEl.scrollTop = scrollTopBefore;
            if (!isOwnIncomingMessage) {
              const chat = chats.find(c => c.id === currentChatId);
              if (chat) {
                chat.unread_count = (chat.unread_count || 0) + 1;
                if (!chat.first_unread_id) chat.first_unread_id = msg.message.id;
                renderChatList(chatSearch.value);
              }
            }
            saveCurrentScrollAnchor(currentChatId, { force: true });
            updateScrollBottomButton();
          } else if (!isOwnIncomingMessage && (!wasNearBottom || document.hidden)) {
            const chat = chats.find(c => c.id === currentChatId);
            if (chat) {
              chat.unread_count = (chat.unread_count || 0) + 1;
              if (!chat.first_unread_id) chat.first_unread_id = msg.message.id;
              renderChatList(chatSearch.value);
            }
          }
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
        markMessageDeleted(msg.messageId, msg.chatId);
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
      case 'chat_list_updated': {
        if (chatListAbortController) break;
        loadChats({ silent: true }).catch(() => {});
        break;
      }
      case 'messages_read': {
        const readState = await reconcileChatReadState(
          msg.chatId,
          { [msg.userId]: msg.lastReadId },
          { updateVisible: msg.chatId === currentChatId }
        );
        if (false && msg.chatId === currentChatId) {
          // Update own messages UI (double-check) if applicable.
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
        // Update cached chat object unread info if the event is about the current user
        if (false && msg.userId === currentUser.id) {
          const c = chats.find(c => c.id === msg.chatId);
          if (c) {
            c.last_read_id = Math.max(Number(c.last_read_id || 0), Number(msg.lastReadId || 0));
            if (!c.last_message_id || Number(msg.lastReadId || 0) >= Number(c.last_message_id || 0)) {
              c.unread_count = 0;
              c.first_unread_id = null;
            }
            renderChatList(chatSearch.value);
          }
        }
        if (readState.chatReadChanged) renderChatList(chatSearch.value);
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
      case 'user_updated': {
        applyUserUpdate(msg.user || {});
        break;
      }
      case 'pins_updated': {
        applyPinsUpdate(msg);
        if (msg.action === 'pinned') {
          handlePinnedMessageUpdate(msg);
        }
        break;
      }
      case 'chat_updated': {
        applyChatUpdate(msg.chat || {});
        break;
      }
      case 'chat_removed': {
        chatMemberLastReads.delete(Number(msg.chatId) || 0);
        chats = chats.filter(c => c.id !== msg.chatId);
        renderChatList(chatSearch.value);
        if (currentChatId === msg.chatId) {
          hideFloatingMessageActions({ immediate: true });
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
  async function loadChats({ silent = false } = {}) {
    const requestId = ++chatListRequestSeq;
    if (chatListAbortController) chatListAbortController.abort();
    const controller = new AbortController();
    chatListAbortController = controller;
    const timeoutId = setTimeout(() => {
      try { controller.abort(); } catch (e) {}
    }, CHAT_LIST_REQUEST_TIMEOUT_MS);
    if (!silent) {
      const hasSidebarContent = chats.length > 0 || chatList.childElementCount > 0;
      if (!chatListLoadedOnce && !hasSidebarContent) setChatListStatus('Loading chats...', 'loading');
      else setChatListStatus('Refreshing chats...', 'loading');
    }
    try {
      const nextChats = await api('/api/chats', { signal: controller.signal });
      if (requestId !== chatListRequestSeq) return chats;
      chats = normalizeCachedChats(nextChats);
      chatListLoadedOnce = true;
      renderChatList(chatSearch.value);
      const currentChat = getChatById(currentChatId);
      if (currentChat) {
        renderCurrentChatHeader(currentChat);
        applyChatBackground(currentChat);
        updateChatStatus();
        refreshChatInfoPresentation(currentChat);
        renderChatPreferencesForm(currentChat);
        renderChatPinSettingsForm(currentChat);
      }
      setChatListStatus('', '');
      return chats;
    } catch (e) {
      if (requestId !== chatListRequestSeq) return chats;
      const isAbort = e?.name === 'AbortError';
      if (chats.length > 0) {
        setChatListStatus(
          isAbort
            ? 'Chat refresh took too long. Showing saved chats.'
            : 'Could not refresh chats. Showing saved chats.',
          'info'
        );
      } else {
        setChatListStatus(
          isAbort
            ? 'Chat list took too long to load. Tap refresh to try again.'
            : 'Could not load chats. Tap refresh to try again.',
          'error'
        );
      }
      console.warn('Failed to load chats', e);
      return chats;
    } finally {
      clearTimeout(timeoutId);
      if (chatListAbortController === controller) chatListAbortController = null;
    }
  }

  async function loadAllUsers() {
    try {
      allUsers = await api('/api/users');
      if (chatSearch.value) renderChatList(chatSearch.value);
    } catch {}
  }

  function appendChatListSeparator(label, parent = chatList) {
    const sep = document.createElement('div');
    sep.className = 'chat-list-separator';
    sep.textContent = label;
    parent.appendChild(sep);
    return sep;
  }

  function createChatListItem(chat) {
    const el = document.createElement('div');
    const pinned = isChatPinned(chat);
    el.className = 'chat-item' + (chat.id === currentChatId ? ' active' : '') + (pinned ? ' is-pinned' : '');
    el.dataset.chatId = chat.id;
    el.dataset.pinned = pinned ? '1' : '0';

    const displayName = chat.name;
    const isOnline = chat.type === 'private' && chat.private_user && onlineUsers.has(chat.private_user.id);
    const lastMsg = getChatLastPreviewText(chat);
    const lastTime = chat.last_time ? formatTime(chat.last_time) : '';
    const unread = chat.unread_count > 0 ? `<span class="unread-badge">${chat.unread_count > 99 ? '99+' : chat.unread_count}</span>` : '';
    const pinIndicator = pinned ? '<span class="chat-item-state-indicator chat-item-pin-indicator" aria-hidden="true" title="Pinned">&#128204;</span>' : '';
    const notifyDisabledIndicator = pinned && !localChatPreferenceEnabled(chat.notify_enabled)
      ? '<span class="chat-item-state-indicator chat-item-muted-indicator" aria-hidden="true" title="Notifications off">&#128277;</span>'
      : '';
    const soundDisabledIndicator = pinned && !localChatPreferenceEnabled(chat.sounds_enabled)
      ? '<span class="chat-item-state-indicator chat-item-muted-indicator" aria-hidden="true" title="Sound off">&#128263;</span>'
      : '';

    el.innerHTML = `
      ${chatItemAvatarHtml(chat)}
        ${isOnline ? '<div class="online-dot"></div>' : ''}
      </div>
      <div class="chat-item-body">
        <div class="chat-item-top">
          <span class="chat-item-name">${esc(displayName)}</span>
          <span class="chat-item-meta">
            ${pinIndicator}
            ${notifyDisabledIndicator}
            ${soundDisabledIndicator}
            <span class="chat-item-time">${lastTime}</span>
          </span>
        </div>
        <div class="chat-item-last">
          <span>${esc(lastMsg).substring(0, 60)}</span>
          ${unread}
        </div>
      </div>
    `;
    el.addEventListener('click', () => {
      if (Date.now() < suppressNextChatItemTapUntil) return;
      openChat(chat.id);
    });
    return el;
  }

  function renderChatList(filter = '') {
    hideChatContextMenu({ immediate: true });
    chatList.innerHTML = '';
    const normalizedFilter = String(filter || '').trim().toLowerCase();
    const filteredChats = normalizedFilter
      ? chats.filter((chat) => getChatSearchHaystack(chat).includes(normalizedFilter))
      : chats;
    const pinnedChats = filteredChats.filter((chat) => isChatPinned(chat));
    const regularChats = filteredChats.filter((chat) => !isChatPinned(chat));

    if (pinnedChats.length) {
      const pinnedGroup = document.createElement('div');
      pinnedGroup.className = 'chat-list-group chat-list-group--pinned';
      appendChatListSeparator('Pinned', pinnedGroup);
      pinnedChats.forEach((chat) => {
        pinnedGroup.appendChild(createChatListItem(chat));
      });
      chatList.appendChild(pinnedGroup);
    }

    regularChats.forEach((chat) => {
      chatList.appendChild(createChatListItem(chat));
    });

    // When searching, also show users without existing private chats
    if (normalizedFilter) {
      const privatePeerIds = new Set(
        chats.filter(c => c.type === 'private' && c.private_user).map(c => c.private_user.id)
      );
      const matchingUsers = allUsers.filter(u =>
        !privatePeerIds.has(u.id) &&
        (u.display_name.toLowerCase().includes(normalizedFilter) ||
         u.username.toLowerCase().includes(normalizedFilter))
      );
      if (matchingUsers.length > 0) {
        appendChatListSeparator('Users');
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
    scheduleChatListCacheSync();
  }

  function updateChatListLastMessage(msg) {
    const chat = chats.find(c => c.id === msg.chat_id);
    if (chat) {
      chat.last_text = msg.text || (msg.is_voice_note ? msg.transcription_text || null : null);
      chat.last_time = msg.created_at;
      chat.last_user = msg.display_name;
      chat.last_file_id = msg.file_id;
      chat.last_message_id = Math.max(Number(chat.last_message_id || 0), Number(msg.id || 0));
      sortChatsInPlace(chats);
      renderChatList(chatSearch.value);
    }
  }

  function updateOnlineDisplay() {
    renderChatList(chatSearch.value);
    if (currentChatId) updateChatStatus();
    refreshAdminUserStatuses();
    try { refreshChatMemberStatuses(); } catch (e) {}
    try { refreshChatInfoStatus(); } catch (e) {}
  }

  function updateScrollBottomButton() {
    if (!scrollBottomBtn) return;
    const hasMessages = Boolean(messagesEl.querySelector('.msg-row'));
    const shouldShow = Boolean(currentChatId && hasMessages && (!isNearBottom(8) || hasMoreAfter));
    scrollBottomBtn.classList.toggle('visible', shouldShow);
  }

  function normalizeMemberLastReads(value) {
    const normalized = {};
    if (!value || typeof value !== 'object') return normalized;
    for (const [rawUserId, rawLastReadId] of Object.entries(value)) {
      const userId = Number(rawUserId);
      const lastReadId = Number(rawLastReadId);
      if (!Number.isFinite(userId) || userId <= 0) continue;
      normalized[userId] = Number.isFinite(lastReadId) && lastReadId > 0 ? Math.floor(lastReadId) : 0;
    }
    return normalized;
  }

  function getChatMemberLastReads(chatId) {
    const id = Number(chatId || 0);
    if (!Number.isFinite(id) || id <= 0) return null;
    return chatMemberLastReads.get(id) || null;
  }

  function storeChatMemberLastReads(chatId, incomingReads, { replace = false } = {}) {
    const id = Number(chatId || 0);
    if (!Number.isFinite(id) || id <= 0) return null;
    const nextReads = normalizeMemberLastReads(incomingReads);
    const merged = replace
      ? nextReads
      : { ...(chatMemberLastReads.get(id) || {}), ...nextReads };
    chatMemberLastReads.set(id, merged);
    return merged;
  }

  function getChatReadReceiptThreshold(chatId) {
    const reads = getChatMemberLastReads(chatId);
    const currentUserId = Number(currentUser?.id || 0);
    if (!reads || !currentUserId) return null;
    const otherReads = Object.entries(reads)
      .filter(([userId]) => Number(userId) !== currentUserId)
      .map(([, lastReadId]) => Math.max(0, Number(lastReadId) || 0));
    if (!otherReads.length) return Number.MAX_SAFE_INTEGER;
    return otherReads.reduce((min, lastReadId) => Math.min(min, lastReadId), Number.MAX_SAFE_INTEGER);
  }

  function applyOwnReadStateToMessage(msg, chatId = msg?.chat_id || msg?.chatId || currentChatId) {
    if (!msg || Number(msg.user_id || 0) !== Number(currentUser?.id || 0)) return msg;
    const threshold = getChatReadReceiptThreshold(chatId);
    if (threshold == null) return msg;
    msg.is_read = Number(msg.id || 0) <= threshold ? 1 : 0;
    return msg;
  }

  function applyOwnReadStateToMessages(chatId, messages = []) {
    if (!Array.isArray(messages)) return messages;
    messages.forEach((msg) => applyOwnReadStateToMessage(msg, chatId));
    return messages;
  }

  function updateVisibleOwnReadState(chatId = currentChatId) {
    const id = Number(chatId || 0);
    if (!id || id !== Number(currentChatId || 0)) return;
    const threshold = getChatReadReceiptThreshold(id);
    if (threshold == null) return;
    messagesEl.querySelectorAll('.msg-row.own').forEach((row) => {
      const msgId = Number(row.dataset.msgId || 0);
      const statusEl = row.querySelector('.msg-status');
      if (!msgId || !statusEl) return;
      const isRead = msgId <= threshold;
      statusEl.classList.toggle('read', isRead);
      statusEl.textContent = isRead ? '✓✓' : '✓';
      if (row.__messageData) row.__messageData.is_read = isRead ? 1 : 0;
    });
  }

  function updateLocalChatReadProgress(chatId, lastReadId) {
    const id = Number(chatId || 0);
    const readId = Number(lastReadId || 0);
    if (!id || !readId) return false;
    const chat = chats.find(c => c.id === id);
    if (!chat) return false;
    const prevLastReadId = Number(chat.last_read_id || 0);
    const nextLastReadId = Math.max(prevLastReadId, readId);
    const prevUnreadCount = Number(chat.unread_count || 0);
    const prevFirstUnreadId = chat.first_unread_id ?? null;
    chat.last_read_id = nextLastReadId;
    if (!chat.last_message_id || nextLastReadId >= Number(chat.last_message_id || 0)) {
      chat.unread_count = 0;
      chat.first_unread_id = null;
    }
    return prevLastReadId !== chat.last_read_id
      || prevUnreadCount !== Number(chat.unread_count || 0)
      || prevFirstUnreadId !== (chat.first_unread_id ?? null);
  }

  async function reconcileChatReadState(chatId, incomingReads, { replace = false, updateVisible = false } = {}) {
    const id = Number(chatId || 0);
    if (!id) return { reads: null, chatReadChanged: false, threshold: null, applied: false };
    const hadBaseline = chatMemberLastReads.has(id);
    const reads = storeChatMemberLastReads(id, incomingReads, { replace });
    if (!reads) return { reads: null, chatReadChanged: false, threshold: null, applied: false };

    const currentUserLastRead = Number(reads[currentUser?.id] || 0);
    const chatReadChanged = currentUserLastRead > 0 ? updateLocalChatReadProgress(id, currentUserLastRead) : false;
    const threshold = getChatReadReceiptThreshold(id);
    const chat = chats.find(c => c.id === id);
    const safeToApply = threshold != null && (replace || hadBaseline || chat?.type === 'private');

    if (safeToApply) {
      try {
        if (window.messageCache && typeof window.messageCache.syncOwnMessageReadState === 'function') {
          await window.messageCache.syncOwnMessageReadState(id, threshold);
        }
      } catch (e) {}
      if (updateVisible) updateVisibleOwnReadState(id);
    }

    return { reads, chatReadChanged, threshold, applied: safeToApply };
  }

  function normalizeMessagesPage(data) {
    if (Array.isArray(data)) return { messages: data, hasMoreBefore: null, hasMoreAfter: null };
    if (data && Array.isArray(data.messages)) {
      return {
        messages: data.messages,
        hasMoreBefore: typeof data.has_more_before === 'boolean' ? data.has_more_before : null,
        hasMoreAfter: typeof data.has_more_after === 'boolean' ? data.has_more_after : null,
      };
    }
    return { messages: [], hasMoreBefore: false, hasMoreAfter: false };
  }

  function setHasMoreBefore(value) {
    hasMore = Boolean(value);
    loadMoreWrap.classList.toggle('hidden', !hasMore);
  }

  function setHasMoreAfter(value) {
    hasMoreAfter = Boolean(value);
    updateScrollBottomButton();
  }

  function messageIdKey(id) {
    const key = String(id ?? '').trim();
    return key || '';
  }

  function rememberDisplayedMessage(id) {
    const key = messageIdKey(id);
    if (key) displayedMsgIds.add(key);
  }

  function forgetDisplayedMessage(id) {
    const key = messageIdKey(id);
    if (key) displayedMsgIds.delete(key);
  }

  function isMessageDisplayed(id) {
    const key = messageIdKey(id);
    return key ? displayedMsgIds.has(key) : false;
  }

  function getMessageIdNumber(msg) {
    const id = Number(msg?.id || 0);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  function minMessageId(messages = []) {
    return messages.reduce((min, msg) => {
      const id = getMessageIdNumber(msg);
      return id ? Math.min(min, id) : min;
    }, Number.MAX_SAFE_INTEGER);
  }

  function maxMessageId(messages = []) {
    return messages.reduce((max, msg) => Math.max(max, getMessageIdNumber(msg)), 0);
  }

  function filterNewMessages(messages = []) {
    const seen = new Set();
    return (Array.isArray(messages) ? messages : []).filter((msg) => {
      const key = messageIdKey(msg?.id);
      if (!key || seen.has(key) || isMessageDisplayed(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function cacheMessages(chatId, messages = []) {
    if (!Array.isArray(messages) || !messages.length) return;
    try {
      window.messageCache?.writeWindow?.(chatId, messages, { limit: MESSAGE_CACHE_LIMIT }).catch(() => {});
    } catch (e) {}
  }

  function cacheCursorPage(chatId, direction, cursor, messages = [], page = {}) {
    if (!Array.isArray(messages) || !messages.length || !cursor) return;
    try {
      window.messageCache?.writePage?.(chatId, {
        direction,
        cursor,
        messages,
        hasMoreBefore: page.hasMoreBefore,
        hasMoreAfter: page.hasMoreAfter,
        limit: MESSAGE_CACHE_LIMIT,
      }).catch(() => {});
    } catch (e) {}
  }

  async function readCachedCursorPage(chatId, direction, cursor) {
    try {
      const page = await window.messageCache?.readPage?.(chatId, direction, cursor);
      if (page?.complete && Array.isArray(page.messages) && page.messages.length) return page;
    } catch (e) {}
    return null;
  }

  function updateHasMoreAfterFromChat(chatId = currentChatId) {
    const chat = chats.find(c => Number(c.id) === Number(chatId));
    const lastMessageId = Number(chat?.last_message_id || 0);
    const maxRenderedId = getMaxRenderedMessageId();
    setHasMoreAfter(Boolean(lastMessageId && maxRenderedId && maxRenderedId < lastMessageId));
  }

  function maybeLoadMoreAtTop() {
    if (!suppressScrollAnchorSave && messagesEl.scrollTop < 60 && hasMore && !loadingMore && !loadingMoreAfter) {
      loadMore();
      return true;
    }
    return false;
  }

  function maybeLoadMoreAtBottom() {
    if (!suppressScrollAnchorSave && hasMoreAfter && !loadingMoreAfter && !loadingMore && isNearBottom(80)) {
      loadMoreAfter();
      return true;
    }
    return false;
  }

  function scrollAnchorStorageKey() {
    return currentUser?.id ? `bananza:scrollAnchors:${currentUser.id}` : '';
  }

  function ensureScrollAnchorsLoaded() {
    const key = scrollAnchorStorageKey();
    if (!key || key === scrollPositionsUserKey) return;
    scrollPositionsUserKey = key;
    try {
      scrollPositions = JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch {
      scrollPositions = {};
    }
  }

  function persistScrollAnchors() {
    const key = scrollAnchorStorageKey();
    if (!key) return;
    scrollPositionsUserKey = key;
    localStorage.setItem(key, JSON.stringify(scrollPositions));
  }

  function getRenderedMessageRows() {
    return Array.from(messagesEl.querySelectorAll('.msg-row[data-msg-id]'));
  }

  function isDeletedMessageRow(row) {
    return Boolean(row?.__messageData?.is_deleted);
  }

  function pickScrollAnchorRow(rows, atBottom, containerRect) {
    const isVisible = (row) => {
      const rect = row.getBoundingClientRect();
      return rect.bottom >= containerRect.top + 6 && rect.top <= containerRect.bottom - 6;
    };
    const visibleRows = rows.filter(isVisible);
    const liveRows = rows.filter((row) => !isDeletedMessageRow(row));
    const visibleLiveRows = visibleRows.filter((row) => !isDeletedMessageRow(row));

    if (visibleLiveRows.length) {
      return atBottom ? visibleLiveRows[visibleLiveRows.length - 1] : visibleLiveRows[0];
    }
    if (liveRows.length) {
      if (atBottom) {
        return [...liveRows].reverse().find((row) => {
          const rect = row.getBoundingClientRect();
          return rect.top <= containerRect.bottom - 6;
        }) || liveRows[liveRows.length - 1];
      }
      return liveRows.find((row) => {
        const rect = row.getBoundingClientRect();
        return rect.bottom >= containerRect.top + 6;
      }) || liveRows[0];
    }
    if (visibleRows.length) {
      return atBottom ? visibleRows[visibleRows.length - 1] : visibleRows[0];
    }
    return atBottom ? rows[rows.length - 1] : rows[0];
  }

  function findRestorableAnchorRow(anchor) {
    const messageId = Number(anchor?.messageId || 0);
    if (!messageId) return null;
    const exact = messagesEl.querySelector(`[data-msg-id="${messageId}"]`);
    if (exact) return exact;

    const liveRows = getRenderedMessageRows().filter((row) => !isDeletedMessageRow(row));
    if (!liveRows.length) return null;

    let before = null;
    let after = null;
    for (const row of liveRows) {
      const rowId = Number(row.dataset.msgId) || 0;
      if (!rowId) continue;
      if (rowId < messageId) before = row;
      else if (rowId > messageId) {
        after = row;
        break;
      }
    }

    return anchor?.atBottom
      ? before || after || liveRows[liveRows.length - 1]
      : after || before || liveRows[0];
  }

  function getMaxRenderedMessageId() {
    return getRenderedMessageRows().reduce((max, row) => Math.max(max, Number(row.dataset.msgId) || 0), 0);
  }

  function captureScrollAnchor() {
    const rows = getRenderedMessageRows();
    if (!rows.length) return null;
    const containerRect = messagesEl.getBoundingClientRect();
    const atBottom = isNearBottom(8);
    const row = pickScrollAnchorRow(rows, atBottom, containerRect);
    if (!row) return null;
    const rect = row.getBoundingClientRect();
    return {
      messageId: Number(row.dataset.msgId) || 0,
      offsetTop: Math.round(rect.top - containerRect.top),
      atBottom,
      savedAt: Date.now(),
    };
  }

  function saveCurrentScrollAnchor(chatId = currentChatId, { force = false } = {}) {
    if (!chatId || (!force && suppressScrollAnchorSave)) return;
    ensureScrollAnchorsLoaded();
    const anchor = captureScrollAnchor();
    if (!anchor?.messageId) return;
    scrollPositions[chatId] = anchor;
    persistScrollAnchors();
  }

  function scheduleScrollAnchorSave() {
    if (suppressScrollAnchorSave || !currentChatId) return;
    clearTimeout(scrollAnchorSaveTimer);
    scrollAnchorSaveTimer = setTimeout(() => saveCurrentScrollAnchor(), 140);
  }

  function restoreScrollAnchor(anchor, attempts = 3) {
    if (!anchor?.messageId) return false;
    const row = findRestorableAnchorRow(anchor);
    if (!row) return false;
    const apply = () => {
      const containerRect = messagesEl.getBoundingClientRect();
      const rect = row.getBoundingClientRect();
      messagesEl.scrollTop += (rect.top - containerRect.top) - (Number(anchor.offsetTop) || 0);
      updateScrollBottomButton();
    };
    apply();
    if (attempts > 1) setTimeout(() => restoreScrollAnchor(anchor, attempts - 1), 120);
    return true;
  }

  function anchorForChatOpen(chat) {
    if (!chat) return null;
    ensureScrollAnchorsLoaded();
    const saved = scrollRestoreMode === 'restore' ? scrollPositions[chat.id] : null;
    if (saved?.messageId) return { ...saved, mode: 'restore' };

    const lastReadId = Number(chat.last_read_id || 0);
    const lastMessageId = Number(chat.last_message_id || 0);
    const hasUnread = Number(chat.unread_count || 0) > 0 && lastReadId < lastMessageId;
    if (hasUnread) {
      const anchorId = lastReadId || Number(chat.first_unread_id || 0);
      if (anchorId) return { messageId: anchorId, offsetTop: 72, atBottom: false, mode: 'last_read' };
    }
    return null;
  }

  async function markChatReadThrough(chatId, lastReadId) {
    const id = Number(chatId);
    const readId = Number(lastReadId || 0);
    if (!id || !readId) return;
    await api(`/api/chats/${id}/read`, { method: 'POST', body: { lastReadId: readId } });
    const chat = chats.find(c => c.id === id);
    if (chat) {
      chat.last_read_id = Math.max(Number(chat.last_read_id || 0), readId);
      if (!chat.last_message_id || readId >= Number(chat.last_message_id || 0)) {
        chat.unread_count = 0;
        chat.first_unread_id = null;
      } else {
        await loadChats().catch(() => {});
        return;
      }
      renderChatList(chatSearch.value);
    }
  }

  function markCurrentChatReadIfAtBottom(force = false) {
    if (!currentChatId || (!force && !isNearBottom(8))) return;
    const chat = chats.find(c => c.id === currentChatId);
    const readId = getMaxRenderedMessageId();
    if (!readId || (chat && Number(chat.last_read_id || 0) >= readId)) return;
    markChatReadThrough(currentChatId, readId).catch(() => {});
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
            <div class="admin-user-last">Last: ${u.last_activity ? formatDate(u.last_activity) + ' ' + formatTime(u.last_activity) : '—'}</div>
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

  function refreshChatMemberStatuses() {
    if (chatInfoModal.classList.contains('hidden')) return;
    const list = $('#chatMemberList');
    if (!list) return;
    list.querySelectorAll('.user-list-item').forEach(item => {
      const uid = +item.dataset.uid;
      const statusEl = item.querySelector('.admin-user-status');
      if (!statusEl) return;
      const isBot = item.dataset.bot === '1';
      if (isBot) {
        statusEl.classList.remove('online','offline');
        statusEl.classList.add('bot');
        statusEl.innerHTML = `<span class="status-dot"></span>bot`;
      } else {
        const isOnline = onlineUsers.has(uid);
        statusEl.classList.toggle('online', isOnline);
        statusEl.classList.toggle('offline', !isOnline);
        statusEl.innerHTML = `<span class="status-dot"></span>${isOnline ? 'online' : 'offline'}`;
      }
    });
  }

  function refreshChatInfoStatus() {
    const el = $('#chatInfoStatus');
    if (!el) return;
    const chat = getChatById(currentChatId);
    syncChatInfoStatusVisibility(chat);
    if (isNotesChat(chat)) return;
    const memberList = $('#chatMemberList');
    if (!memberList) {
      el.classList.remove('online'); el.classList.add('offline');
      el.innerHTML = `<span class="status-dot"></span>offline`;
      return;
    }
    const items = memberList.querySelectorAll('.user-list-item');
    const humanItems = Array.from(items).filter(it => it.dataset.bot !== '1');
    const botItems = Array.from(items).filter(it => it.dataset.bot === '1');
    const total = humanItems.length;
    let onlineCount = 0;
    humanItems.forEach(it => { if (onlineUsers.has(+it.dataset.uid)) onlineCount++; });
    if (total <= 1) {
      if (total === 1) {
        const isOnline = onlineUsers.has(+humanItems[0].dataset.uid);
        el.classList.toggle('online', isOnline);
        el.classList.toggle('offline', !isOnline);
        el.innerHTML = `<span class="status-dot"></span>${isOnline ? 'online' : 'offline'}`;
      } else if (botItems.length === 1 && items.length === 1) {
        // single bot participant
        el.classList.remove('online','offline');
        el.innerHTML = `<span class="status-dot"></span>bot`;
      } else {
        el.classList.remove('online','offline');
        el.innerHTML = `0/${total} online`;
      }
    } else {
      el.classList.remove('online','offline');
      el.innerHTML = `${onlineCount}/${total} online`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPEN CHAT
  // ═══════════════════════════════════════════════════════════════════════════
  async function openChat(chatId, options = {}) {
    const targetChatId = Number(chatId);
    const previousChatId = Number(currentChatId || 0);
    const sameChat = previousChatId === targetChatId;
    const explicitAnchorId = Number(options?.anchorMessageId || 0);
    const suppressHistoryPush = Boolean(options?.suppressHistoryPush);
    // Save scroll position of previous chat
    if (currentChatId) {
      saveCurrentScrollAnchor(currentChatId, { force: true });
    }
    hideMentionPicker();
    hideAvatarUserMenu();
    hideChatContextMenu({ immediate: true });
    hideFloatingMessageActions({ immediate: true });

    currentChatId = targetChatId;
    displayedMsgIds.clear();
    hasMore = false; // prevent scroll handler triggering loadMore during DOM clear
    setHasMoreAfter(false);
    suppressScrollAnchorSave = true;

    emptyState.classList.add('hidden');
    chatView.classList.remove('hidden');

    // Update sidebar active state
    chatList.querySelectorAll('.chat-item[data-chat-id]').forEach(el => {
      el.classList.toggle('active', +el.dataset.chatId === targetChatId);
    });

    // Mobile: hide sidebar
    if (window.innerWidth <= 768) {
      cancelPendingSidebarReveal();
      sidebar.classList.remove('sidebar-no-transition');
      sidebar.classList.add('sidebar-hidden');
      if (!suppressHistoryPush) {
        history.pushState({ chat: targetChatId }, '');
      }
    }

    const chat = chats.find(c => c.id === targetChatId);
    const restoreAnchor = explicitAnchorId
      ? { messageId: explicitAnchorId, offsetTop: 72, atBottom: false, mode: sameChat ? 'search_same_chat' : 'search' }
      : anchorForChatOpen(chat);
    renderCurrentChatHeader(chat);
    renderPinnedBar(targetChatId);
    loadChatPins(targetChatId).catch(() => {});

    updateChatStatus();
    // Apply chat background (if present)
    applyChatBackground(chat);

    // Clear and load messages (show cached messages first if available)
    compactView = !!compactViewMap[targetChatId];
    messagesEl.classList.toggle('compact-view', compactView);
    loadMoreWrap.classList.add('hidden');
    messagesEl.querySelectorAll('.msg-row, .msg-group, .date-separator').forEach(el => el.remove());
    try {
      if (window.messageCache) {
        const cachedMsgs = restoreAnchor?.messageId
          ? await window.messageCache.readAround(targetChatId, restoreAnchor.messageId, { limit: PAGE_SIZE })
          : await window.messageCache.readLatest(targetChatId, { limit: PAGE_SIZE });
        if (Array.isArray(cachedMsgs) && cachedMsgs.length) {
          applyOwnReadStateToMessages(targetChatId, cachedMsgs);
          displayedMsgIds.clear();
          const cachedFirstId = minMessageId(cachedMsgs);
          const cachedLastId = maxMessageId(cachedMsgs);
          setHasMoreBefore(cachedFirstId !== Number.MAX_SAFE_INTEGER && cachedFirstId > 1 && (restoreAnchor?.messageId ? true : cachedMsgs.length >= PAGE_SIZE));
          setHasMoreAfter(Boolean(restoreAnchor?.messageId && chat?.last_message_id && cachedLastId < Number(chat.last_message_id || 0)));
          renderMessages(cachedMsgs);
          await renderOutboxForChat(targetChatId);
          if (restoreAnchor?.messageId) {
            requestAnimationFrame(() => restoreScrollAnchor(restoreAnchor, 1));
          } else {
            scrollToBottom(true);
          }
          // cache assets in background (background, avatars, first 5 images)
          (async () => {
            try {
              const assetUrls = new Set();
              if (chat?.background_url) assetUrls.add(chat.background_url);
              for (const m of cachedMsgs) {
                if (m.avatar_url) assetUrls.add(m.avatar_url);
                if (m.file_type === 'image' && m.file_stored) assetUrls.add(`/uploads/${m.file_stored}`);
              }
              await window.cacheAssets(Array.from(assetUrls).slice(0, 12));
            } catch (e) {}
          })();
        }
      }
    } catch (e) {}

    let scrollRestoreScheduled = false;
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      params.set('meta', '1');
      if (restoreAnchor?.messageId) params.set('anchor', String(restoreAnchor.messageId));
      const raw = await api(`/api/chats/${targetChatId}/messages?${params}`);
      const page = normalizeMessagesPage(raw);
      const msgs = page.messages;
      const memberLastReads = raw && raw.member_last_reads ? raw.member_last_reads : null;
      const readState = await reconcileChatReadState(targetChatId, memberLastReads, {
        replace: true,
        updateVisible: currentChatId === targetChatId,
      });
      if (readState.chatReadChanged) renderChatList(chatSearch.value);
      applyOwnReadStateToMessages(chatId, msgs);
      // Re-clear after async gap: WS may have appended messages while we waited
      if (currentChatId !== targetChatId) { suppressScrollAnchorSave = false; return; } // user switched chats

      // If DOM already contains the same messages in the same order, skip re-render to avoid blinking.
      try {
        const domRows = Array.from(messagesEl.querySelectorAll('.msg-row'));
        const domIds = domRows.map(el => Number(el.dataset.msgId || 0));
        const fetchedIds = (msgs || []).map(m => Number(m.id || 0));
        const same = domIds.length > 0 && domIds.length === fetchedIds.length && domIds.every((id, idx) => id === fetchedIds[idx]);
        if (same) {
          // Persist network-fetched messages to IndexedDB for offline/low-traffic history reuse.
          cacheMessages(targetChatId, msgs || []);
          setHasMoreBefore(page.hasMoreBefore ?? (restoreAnchor?.messageId ? msgs.length > 0 : msgs.length >= PAGE_SIZE));
          setHasMoreAfter(page.hasMoreAfter ?? Boolean(restoreAnchor?.messageId && chat?.last_message_id && maxMessageId(msgs) < Number(chat.last_message_id || 0)));
          if (restoreAnchor?.messageId) {
            requestAnimationFrame(() => {
              if (!restoreScrollAnchor(restoreAnchor)) {
                messagesEl.scrollTop = 0;
                updateScrollBottomButton();
              }
            });
          } else {
            scrollToBottom(true);
          }
          requestAnimationFrame(() => {
            updateScrollBottomButton();
            setTimeout(() => {
              if (currentChatId !== targetChatId) return;
              suppressScrollAnchorSave = false;
              saveCurrentScrollAnchor(targetChatId, { force: true });
              maybeLoadMoreAtTop();
              maybeLoadMoreAtBottom();
            }, 260);
          });
          scrollRestoreScheduled = true;
        } else {
          messagesEl.querySelectorAll('.msg-row, .msg-group, .date-separator').forEach(el => el.remove());
          displayedMsgIds.clear();
          setHasMoreBefore(page.hasMoreBefore ?? (restoreAnchor?.messageId ? msgs.length > 0 : msgs.length >= PAGE_SIZE));
          setHasMoreAfter(page.hasMoreAfter ?? Boolean(restoreAnchor?.messageId && chat?.last_message_id && maxMessageId(msgs) < Number(chat.last_message_id || 0)));
          renderMessages(msgs);
        }
      } catch (e) {
        messagesEl.querySelectorAll('.msg-row, .msg-group, .date-separator').forEach(el => el.remove());
        displayedMsgIds.clear();
        setHasMoreBefore(page.hasMoreBefore ?? (restoreAnchor?.messageId ? msgs.length > 0 : msgs.length >= PAGE_SIZE));
        setHasMoreAfter(page.hasMoreAfter ?? Boolean(restoreAnchor?.messageId && chat?.last_message_id && maxMessageId(msgs) < Number(chat.last_message_id || 0)));
        renderMessages(msgs);
      }
      // Persist network-fetched messages to IndexedDB for offline/low-traffic history reuse.
      cacheMessages(targetChatId, msgs || []);
      // Cache background, avatars, and first 5 images
      (async () => {
        try {
          const assetUrls = new Set();
          if (chat?.background_url) assetUrls.add(chat.background_url);
          for (const m of msgs) {
            if (m.avatar_url) assetUrls.add(m.avatar_url);
            if (m.file_type === 'image' && m.file_stored) assetUrls.add(`/uploads/${m.file_stored}`);
          }
          await window.cacheAssets(Array.from(assetUrls).slice(0, 12));
        } catch (e) {}
      })();
      await renderOutboxForChat(targetChatId);
      if (restoreAnchor?.messageId) {
        requestAnimationFrame(() => {
          if (!restoreScrollAnchor(restoreAnchor)) {
            messagesEl.scrollTop = 0;
            updateScrollBottomButton();
          }
        });
      } else {
        scrollToBottom(true);
      }
      requestAnimationFrame(() => {
        updateScrollBottomButton();
        setTimeout(() => {
          if (currentChatId !== targetChatId) return;
          suppressScrollAnchorSave = false;
          saveCurrentScrollAnchor(targetChatId, { force: true });
          maybeLoadMoreAtTop();
          maybeLoadMoreAtBottom();
        }, 260);
      });
      scrollRestoreScheduled = true;
    } catch {
      await renderOutboxForChat(targetChatId);
    }
    if (!scrollRestoreScheduled && currentChatId === targetChatId && suppressScrollAnchorSave) {
      suppressScrollAnchorSave = false;
      maybeLoadMoreAtTop();
      maybeLoadMoreAtBottom();
    }

    clearReply();
    if (editTo) clearEdit({ clearInput: true });
    syncMentionOpenButton();
    if (window.innerWidth > 768) msgInput.focus();
    window.BananzaVoiceHooks?.refreshComposerState?.();
    updateScrollBottomButton();
    localStorage.setItem('lastChat', targetChatId);
  }

  function updateChatStatus() {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    if (isNotesChat(chat)) {
      chatStatus.classList.remove('online', 'offline');
      chatStatus.textContent = 'Личный чат';
      chatStatus.style.color = '';
      return;
    }
    if (chat.type === 'private' && chat.private_user) {
      const isOnline = onlineUsers.has(chat.private_user.id);
      chatStatus.textContent = isOnline ? 'online' : 'offline';
      chatStatus.style.color = isOnline ? 'var(--success)' : '';
    } else {
      // Prefer counting only members of this chat if we have them cached
      const members = chatMembersCache.get(chat.id);
      if (Array.isArray(members)) {
          const humanMembers = members.filter(m => !m.is_ai_bot);
          const total = humanMembers.length;
          let onlineCount = 0;
          for (const m of humanMembers) if (onlineUsers.has(m.id)) onlineCount++;
        if (total <= 1) {
          const isOnline = total === 1 && onlineUsers.has(humanMembers[0].id);
          chatStatus.classList.toggle('online', isOnline);
          chatStatus.classList.toggle('offline', !isOnline);
          chatStatus.textContent = isOnline ? 'online' : 'offline';
          chatStatus.style.color = isOnline ? 'var(--success)' : '';
        } else {
          chatStatus.classList.remove('online','offline');
          if (onlineCount === total && total > 0) {
            chatStatus.innerHTML = `<span class="admin-user-status online"><span class="status-dot"></span>Все в сборе</span>`;
            chatStatus.style.color = '';
          } else {
            chatStatus.textContent = `${onlineCount}/${total} online`;
            chatStatus.style.color = '';
          }
        }
      } else {
        // Fallback: show global online count, then asynchronously prime the cache
        const onlineCount = [...onlineUsers].length;
        chatStatus.textContent = `${onlineCount} online`;
        chatStatus.style.color = '';
        (async () => {
          try {
            const fetched = await api(`/api/chats/${chat.id}/members`);
            if (fetched && currentChatId === chat.id) {
              chatMembersCache.set(chat.id, fetched);
              updateChatStatus();
            }
          } catch (e) {}
        })();
      }
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
    const avatar = document.createElement('div');
    avatar.className = 'msg-group-avatar';
    avatar.setAttribute('role', 'button');
    avatar.tabIndex = 0;
    avatar.title = name || '';
    avatar.dataset.userId = String(Number(msg.user_id) || 0);
    avatar.dataset.displayName = name || '';
    avatar.dataset.mentionToken = mentionToken || '';
    avatar.dataset.isAiBot = isAiBot ? '1' : '0';
    setAvatarElementVisual(avatar, {
      name: name || '',
      color: avatarColor,
      avatarUrl: avatarUrl || '',
    });
    group.appendChild(avatar);
    const body = document.createElement('div');
    body.className = 'msg-group-body';
    group.appendChild(body);
    return { group, body };
  }

  function renderMessages(msgs) {
    let lastDate = null;
    const existingFirst = messagesEl.querySelector('.date-separator, .msg-row, .msg-group');
    let currentGroupBody = null;

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      if (isMessageDisplayed(msg?.id)) continue;
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
      rememberDisplayedMessage(msg.id);
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
    rememberDisplayedMessage(msg.id);
    try {
      if (window.messageCache) window.messageCache.upsertMessage(msg).catch(()=>{});
    } catch (e) {}
    try {
      if (msg.file_type === 'image' && msg.file_stored && window.cacheAssets) {
        window.cacheAssets([`/uploads/${msg.file_stored}`]).catch(()=>{});
      }
    } catch (e) {}
    if (!loadingMoreAfter) updateHasMoreAfterFromChat(currentChatId);
    updateScrollBottomButton();
  }

  function createMessageEl(msg, showName = true) {
    applyOwnReadStateToMessage(msg, msg?.chat_id || msg?.chatId || currentChatId);
    const isOwn = msg.user_id === currentUser.id;
    const isClientMessage = isClientSideMessage(msg);
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
    if (msg.client_id) row.dataset.clientId = msg.client_id;
    if (isClientMessage) row.dataset.outbox = '1';
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
      if (msg.saved_from_message_id) {
        const savedName = (msg.saved_from_display_name || '').trim() || 'Unknown';
        html += `<button type="button" class="msg-saved-origin" data-origin-id="${Number(msg.saved_from_message_id) || 0}">
          <span>Сохранено от ${esc(savedName)}</span>
          <strong>К оригиналу</strong>
        </button>`;
      }

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
      if (msg.file_id && (msg.file_stored || msg.client_file_url)) {
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
        if (!isClientMessage && (isOwn || currentUser.is_admin)) {
          html += `<button class="msg-delete-btn" data-id="${msg.id}" title="Delete">🗑</button>`;
        }
    }

    // Client-side status overrides server read icons when present
    let statusIcon = '';
    if (isOwn && !msg.is_deleted) {
      if (msg.client_status) statusIcon = `<span class="msg-status failed">!</span>`;
      else statusIcon = `<span class="msg-status${msg.is_read ? ' read' : ''}">${msg.is_read ? '✓✓' : '✓'}</span>`;
    }
    const editedIcon = !msg.is_deleted && msg.edited_at ? '<span class="msg-edited" title="Edited">✎</span>' : '';
    const reactionsHtml = (!msg.is_deleted && msg.reactions && msg.reactions.length > 0)
      ? `<div class="msg-reactions">${renderReactions(msg.reactions)}</div>` : '<div></div>';
    html += `<div class="msg-footer">${reactionsHtml}<span class="msg-time">${statusIcon}${editedIcon}${formatTime(msg.created_at)}</span></div>`;

    // Message action icons are shown on hover/focus and can be pinned by tapping the message.
    if (!msg.is_deleted && !isClientMessage) {
      html += '<div class="msg-actions">';
      html += '<button class="msg-copy-btn" title="Копировать">⧉</button>';
      html += '<button class="msg-reply-btn" title="Reply">↩</button>';
      if (canEditMessage(msg)) html += '<button class="msg-edit-btn" title="Edit">✏️</button>';
      if (canSaveMessageToNotes(msg)) html += '<button class="msg-save-note-btn" title="Сохранить в заметки">📝</button>';
      if (canForwardMessage(msg)) html += '<button class="msg-forward-btn" title="Forward">📤</button>';
      html += '<button class="msg-react-btn" title="React">🙂</button>';
      html += '</div>';
    }
    html += '</div>'; // msg-bubble
    html += '</div>'; // msg-content

    row.innerHTML = html;
    // Persist client_status on row for CSS/logic; apply class for failed state so retry button can be overlayed
    if (msg.client_status) row.dataset.clientStatus = msg.client_status;
    if (msg.client_status) row.classList.add('client-failed');
    const actionsEl = row.querySelector('.msg-actions');
    if (actionsEl && !row.querySelector('.msg-pin-btn')) {
      const pinWrap = document.createElement('span');
      pinWrap.innerHTML = renderPinActionButton(msg);
      const pinButton = pinWrap.firstElementChild;
      if (pinButton) actionsEl.insertBefore(pinButton, actionsEl.querySelector('.msg-react-btn'));
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

    const copyBtn = row.querySelector('.msg-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('mousedown', (e) => e.preventDefault());
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await copyMessageFromRow(row);
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

    const saveNoteBtn = row.querySelector('.msg-save-note-btn');
    if (saveNoteBtn) {
      saveNoteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveMessageToNotes(row.__messageData, saveNoteBtn);
      });
    }

    const pinBtn = row.querySelector('.msg-pin-btn');
    if (pinBtn) {
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePinFromRow(row);
      });
    }

    const retryBtn = row.querySelector('.msg-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', (e) => { e.stopPropagation(); retrySend(row); });
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

    const savedOrigin = row.querySelector('.msg-saved-origin');
    if (savedOrigin) {
      savedOrigin.addEventListener('click', (e) => {
        e.stopPropagation();
        jumpToSavedOriginal(row.__messageData);
      });
    }

    const img = row.querySelector('.msg-image');
    if (img) {
      img.draggable = false;
      const markWideImage = () => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        row.classList.toggle('wide-media-message', img.naturalWidth >= img.naturalHeight);
      };
      img.addEventListener('dragstart', (e) => e.preventDefault());
      img.addEventListener('click', (e) => {
        if (Date.now() < (row.__suppressMediaClickUntil || 0)) {
          e.preventDefault();
          e.stopPropagation();
          row.__suppressMediaClickUntil = 0;
          return;
        }
        openImageViewer(img.src);
      });
      const wasNearBottom = isNearBottom();
      img.addEventListener('load', () => {
        const anchor = !wasNearBottom && !isNearBottom(8) ? captureScrollAnchor() : null;
        markWideImage();
        if (anchor) requestAnimationFrame(() => restoreScrollAnchor(anchor, 1));
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
        const anchor = !isNearBottom(8) ? captureScrollAnchor() : null;
        markWideVideo();
        if (anchor) requestAnimationFrame(() => restoreScrollAnchor(anchor, 1));
        const dur = formatDuration(video.duration);
        const durEl = document.createElement('span');
        durEl.className = 'media-duration';
        durEl.textContent = dur;
        video.parentElement.querySelector('div:last-child')?.prepend(durEl);
      });
      if (video.readyState >= 1) markWideVideo();
    }

    window.BananzaVoiceHooks?.decorateMessageRow?.(row, msg);
    // Ensure status UI is in sync (adds retry button when failed)
    updateRowStatus(row);

    return row;
  }

  // Update visible status indicator inside a message row according to __messageData.client_status
  function updateRowStatus(row) {
    try {
      const d = row.__messageData || {};
      const statusEl = row.querySelector('.msg-status');
      if (!statusEl) return;
      if (d.client_status) {
        row.classList.add('client-failed');
        row.dataset.clientStatus = d.client_status;
        let retryBtn = row.querySelector('.msg-retry-btn');
        if (!retryBtn) {
          retryBtn = document.createElement('button');
          retryBtn.type = 'button';
          retryBtn.className = 'msg-retry-btn';
          retryBtn.title = 'Retry';
          retryBtn.setAttribute('aria-label', 'Retry sending message');
          retryBtn.textContent = '\u21bb';
          const bubble = row.querySelector('.msg-bubble');
          if (bubble) bubble.appendChild(retryBtn);
          else row.appendChild(retryBtn);
          retryBtn.addEventListener('mousedown', (e) => e.preventDefault());
          retryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.currentTarget.blur();
            retrySend(row);
          });
        }
        const isSending = outboxSending.has(d.client_id || row.dataset.clientId || row.dataset.msgId);
        statusEl.className = `msg-status ${isSending ? 'sending' : 'failed'}`;
        statusEl.textContent = isSending ? '\u23f3' : '!';
        retryBtn.disabled = isSending;
        row.classList.toggle('client-sending', isSending);
        scheduleRetryLayout();
        return;
      }
      statusEl.className = `msg-status${d.is_read ? ' read' : ''}`;
      statusEl.textContent = d.is_read ? '✓✓' : '✓';
      row.classList.remove('client-failed', 'client-sending');
      delete row.dataset.clientStatus;
      const retryBtn = row.querySelector('.msg-retry-btn');
      const retrySlot = retryBtn?.closest('.msg-retry-slot');
      if (retryBtn) retryBtn.remove();
      if (retrySlot && retrySlot.childElementCount === 0) retrySlot.remove();
    } catch (e) {}
  }

  async function retrySend(row) {
    const clientId = row?.dataset.clientId || row?.dataset.msgId;
    const chatId = Number(row?.__messageData?.chat_id || row?.__messageData?.chatId || currentChatId || 0);
    if (!clientId || !chatId) return;
    const item = row.__outboxItem || await window.messageCache?.getOutboxItem?.(chatId, clientId);
    if (!item) return;
    await trySendOutboxItem(item);
  }

  function formatDuration(seconds) {
    if (!seconds || !isFinite(seconds)) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function renderFileAttachment(msg) {
    const url = msg.client_file_url || `/uploads/${msg.file_stored}`;
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

  function cleanupDuplicateDateSeparators() {
    const seenDates = new Set();
    messagesEl.querySelectorAll('.date-separator').forEach(sep => {
      const text = sep.textContent.trim();
      if (seenDates.has(text)) sep.remove();
      else seenDates.add(text);
    });
  }

  async function catchUpCurrentChat(chatId, { fromPush = false } = {}) {
    const id = Number(chatId || 0);
    if (!id || Number(currentChatId || 0) !== id) return false;

    if (loadingMore || loadingMoreAfter) {
      recoverySyncRequested = true;
      return false;
    }

    const initialLastId = getMaxRenderedMessageId();
    if (!initialLastId) {
      await openChat(id, { suppressHistoryPush: true });
      return true;
    }

    const wasNearBottom = isNearBottom(120);
    const anchor = wasNearBottom ? null : captureScrollAnchor();
    let cursor = initialLastId;
    let appendedAny = false;
    let hasMoreAfterValue = false;

    loadingMoreAfter = true;
    try {
      for (let pageIndex = 0; pageIndex < RECOVERY_CATCHUP_MAX_PAGES; pageIndex += 1) {
        if (Number(currentChatId || 0) !== id) return appendedAny;

        const params = new URLSearchParams({ limit: String(PAGE_SIZE), meta: '1', after: String(cursor) });
        const raw = await api(`/api/chats/${id}/messages?${params}`);
        const page = normalizeMessagesPage(raw);
        const msgs = page.messages || [];

        const memberLastReads = raw && raw.member_last_reads ? raw.member_last_reads : null;
        const readState = await reconcileChatReadState(id, memberLastReads, {
          replace: true,
          updateVisible: Number(currentChatId || 0) === id,
        });
        if (readState.chatReadChanged) renderChatList(chatSearch.value);

        applyOwnReadStateToMessages(id, msgs);
        if (Number(currentChatId || 0) !== id) return appendedAny;

        const newMessages = filterNewMessages(msgs);
        if (newMessages.length) {
          newMessages.forEach((message) => appendMessage(message));
          updateChatListLastMessage(newMessages[newMessages.length - 1]);
          appendedAny = true;
        } else if (fromPush && msgs.length) {
          updateChatListLastMessage(msgs[msgs.length - 1]);
        }

        if (msgs.length) cacheMessages(id, msgs);

        const fetchedLastId = maxMessageId(msgs);
        hasMoreAfterValue = page.hasMoreAfter ?? (msgs.length >= PAGE_SIZE);
        if (!fetchedLastId || fetchedLastId <= cursor || !hasMoreAfterValue) break;
        cursor = fetchedLastId;
      }
    } catch (e) {
      if (Number(currentChatId || 0) === id) updateHasMoreAfterFromChat(id);
      return appendedAny;
    } finally {
      loadingMoreAfter = false;
    }

    if (Number(currentChatId || 0) !== id) return appendedAny;

    const chat = chats.find(c => Number(c.id) === id);
    const renderedLastId = getMaxRenderedMessageId();
    const hasMoreFromChat = Boolean(
      chat?.last_message_id && renderedLastId && renderedLastId < Number(chat.last_message_id || 0)
    );
    setHasMoreAfter(Boolean(hasMoreAfterValue || hasMoreFromChat));

    if (appendedAny) {
      cleanupDuplicateDateSeparators();
      if (wasNearBottom && !document.hidden) {
        scrollToBottom(true, true);
      } else {
        if (anchor) requestAnimationFrame(() => restoreScrollAnchor(anchor, 2));
        saveCurrentScrollAnchor(id, { force: true });
        updateScrollBottomButton();
      }
    } else {
      updateScrollBottomButton();
    }

    return appendedAny;
  }

  // Load more messages
  async function loadMore() {
    if (loadingMore || loadingMoreAfter || !hasMore || !currentChatId) return;
    const chatId = currentChatId;
    const firstMsg = messagesEl.querySelector('.msg-row[data-msg-id]');
    const firstId = firstMsg ? Number(firstMsg.dataset.msgId || 0) : 0;
    if (!firstId) {
      setHasMoreBefore(false);
      return;
    }

    loadingMore = true;
    loadMoreBtn.textContent = 'Loading...';

    try {
      let page = await readCachedCursorPage(chatId, 'before', firstId);
      let msgs = page?.messages || [];
      if (!page) {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), meta: '1', before: String(firstId) });
        const raw = await api(`/api/chats/${chatId}/messages?${params}`);
        page = normalizeMessagesPage(raw);
        msgs = page.messages;
        const memberLastReads = raw && raw.member_last_reads ? raw.member_last_reads : null;
        const readState = await reconcileChatReadState(chatId, memberLastReads, {
          replace: true,
          updateVisible: currentChatId === chatId,
        });
        if (readState.chatReadChanged) renderChatList(chatSearch.value);
        cacheCursorPage(chatId, 'before', firstId, msgs, page);
      }
      applyOwnReadStateToMessages(chatId, msgs);
      if (currentChatId !== chatId) return;
      setHasMoreBefore(page.hasMoreBefore ?? msgs.length >= PAGE_SIZE);

      // Capture scroll state RIGHT before DOM mutation (not before async fetch)
      const scrollTopBefore = messagesEl.scrollTop;
      const scrollHeightBefore = messagesEl.scrollHeight;
      const newMessages = filterNewMessages(msgs);

      if (newMessages.length) {
        renderMessages(newMessages);
        cleanupDuplicateDateSeparators();
        cacheMessages(chatId, msgs);
      }

      // Restore scroll position: keep user at the same visual spot
      messagesEl.scrollTop = scrollTopBefore + (messagesEl.scrollHeight - scrollHeightBefore);
      saveCurrentScrollAnchor(currentChatId, { force: true });
    } catch {}
    finally {
      loadingMore = false;
      loadMoreBtn.textContent = 'Load earlier messages';
    }
  }

  async function loadMoreAfter() {
    if (loadingMoreAfter || loadingMore || !hasMoreAfter || !currentChatId) return;
    const chatId = currentChatId;
    const lastId = getMaxRenderedMessageId();
    if (!lastId) {
      setHasMoreAfter(false);
      return;
    }

    loadingMoreAfter = true;
    try {
      let page = await readCachedCursorPage(chatId, 'after', lastId);
      let msgs = page?.messages || [];
      if (!page) {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), meta: '1', after: String(lastId) });
        const raw = await api(`/api/chats/${chatId}/messages?${params}`);
        page = normalizeMessagesPage(raw);
        msgs = page.messages;
        const memberLastReads = raw && raw.member_last_reads ? raw.member_last_reads : null;
        const readState = await reconcileChatReadState(chatId, memberLastReads, {
          replace: true,
          updateVisible: currentChatId === chatId,
        });
        if (readState.chatReadChanged) renderChatList(chatSearch.value);
        cacheCursorPage(chatId, 'after', lastId, msgs, page);
      }

      applyOwnReadStateToMessages(chatId, msgs);
      if (currentChatId !== chatId) return;
      setHasMoreAfter(page.hasMoreAfter ?? msgs.length >= PAGE_SIZE);

      const newMessages = filterNewMessages(msgs);
      if (newMessages.length) {
        for (const msg of newMessages) appendMessage(msg);
        cacheMessages(chatId, msgs);
        saveCurrentScrollAnchor(currentChatId, { force: true });
      }
    } catch {}
    finally {
      loadingMoreAfter = false;
      updateScrollBottomButton();
    }
  }

  function isNearBottom(threshold = 150) {
    return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < threshold;
  }

  function scrollToBottom(instant = false, markRead = false) {
    requestAnimationFrame(() => {
      messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: instant ? 'instant' : 'smooth' });
      if (scrollBottomBtn) scrollBottomBtn.classList.remove('visible');
      requestAnimationFrame(updateScrollBottomButton);
      if (!instant) setTimeout(updateScrollBottomButton, 260);
      if (hasMoreAfter) setTimeout(() => maybeLoadMoreAtBottom(), instant ? 0 : 320);
      if (markRead) setTimeout(() => markCurrentChatReadIfAtBottom(true), instant ? 0 : 320);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  function getReplySnapshot(source = replyTo) {
    if (!source?.id) return null;
    return {
      id: source.id,
      display_name: source.display_name || source.displayName || '',
      text: source.text || '',
      is_voice_note: Boolean(source.is_voice_note),
    };
  }

  function localAttachmentFromFile(file) {
    const type = getLocalFileType(file);
    if (!type) return null;
    return {
      localId: makeClientId('f'),
      file,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      type,
    };
  }

  function outboxUrlKey(clientId, part = 'file') {
    return `${clientId}:${part}`;
  }

  function getOutboxObjectUrl(clientId, blob, part = 'file') {
    if (!blob) return '';
    const key = outboxUrlKey(clientId, part);
    if (outboxObjectUrls.has(key)) return outboxObjectUrls.get(key);
    const url = URL.createObjectURL(blob);
    outboxObjectUrls.set(key, url);
    return url;
  }

  function revokeOutboxObjectUrls(clientId) {
    const prefix = `${clientId}:`;
    for (const [key, url] of outboxObjectUrls.entries()) {
      if (!key.startsWith(prefix)) continue;
      try { URL.revokeObjectURL(url); } catch (e) {}
      outboxObjectUrls.delete(key);
    }
  }

  function findOutboxRow(clientId) {
    if (!clientId) return null;
    return messagesEl.querySelector(`.msg-row[data-outbox="1"][data-client-id="${clientId}"], .msg-row[data-outbox="1"][data-msg-id="${clientId}"]`);
  }

  function cleanupEmptyMessageGroups() {
    messagesEl.querySelectorAll('.msg-group').forEach((group) => {
      if (!group.querySelector('.msg-row')) group.remove();
    });
  }

  function removeOutboxRows() {
    messagesEl.querySelectorAll('.msg-row[data-outbox="1"]').forEach((row) => {
      forgetDisplayedMessage(row.dataset.msgId);
      revokeOutboxObjectUrls(row.dataset.clientId || row.dataset.msgId);
      row.remove();
    });
    cleanupEmptyMessageGroups();
  }

  function buildLocalMessageFromOutbox(item) {
    const attachment = (item.attachments && item.attachments[0]) || null;
    const serverMeta = item.serverFileMeta || null;
    const isVoice = item.kind === 'voice';
    const voice = item.voice || {};
    const fileBlob = isVoice ? voice.blob : attachment?.file;
    const localUrl = serverMeta?.stored_name ? '' : getOutboxObjectUrl(item.clientId, fileBlob, attachment?.localId || 'file');
    const fileName = serverMeta?.original_name || attachment?.name || voice.name || 'voice-note.wav';
    const fileSize = serverMeta?.size || attachment?.size || fileBlob?.size || 0;
    const fileMime = serverMeta?.mime_type || attachment?.mime || voice.mime || 'audio/wav';
    const fileType = serverMeta?.type || attachment?.type || (isVoice ? 'audio' : null);
    const reply = item.reply || null;

    return {
      id: item.clientId,
      client_id: item.clientId,
      client_status: item.status || 'failed',
      is_outbox: true,
      chat_id: item.chatId,
      user_id: currentUser.id,
      username: currentUser.username,
      display_name: currentUser.display_name,
      avatar_color: currentUser.avatar_color,
      avatar_url: currentUser.avatar_url,
      text: item.text || null,
      file_id: (attachment || isVoice || serverMeta) ? (item.serverFileId || item.clientId) : null,
      file_name: fileName,
      file_stored: serverMeta?.stored_name || null,
      client_file_url: localUrl,
      file_mime: fileMime,
      file_size: fileSize,
      file_type: fileType,
      reply_to_id: item.replyToId || null,
      reply_display_name: reply?.display_name || null,
      reply_text: reply?.text || null,
      reply_is_voice_note: reply?.is_voice_note ? 1 : 0,
      created_at: item.createdAt,
      is_read: false,
      reactions: [],
      previews: [],
      is_deleted: false,
      is_voice_note: isVoice,
      voice_duration_ms: isVoice ? voice.durationMs : null,
      transcription_status: 'idle',
      transcription_text: '',
      transcription_provider: '',
      transcription_model: '',
      transcription_error: '',
    };
  }

  function renderOutboxItem(item) {
    if (!item || Number(item.chatId) !== Number(currentChatId)) return null;
    if (isMessageDisplayed(item.clientId)) return findOutboxRow(item.clientId);
    const localMsg = buildLocalMessageFromOutbox(item);
    appendMessage(localMsg);
    const row = findOutboxRow(item.clientId);
    if (row) {
      row.__outboxItem = item;
      row.__messageData = { ...(row.__messageData || {}), ...localMsg };
      updateRowStatus(row);
    }
    scheduleRetryLayout();
    return row;
  }

  async function renderOutboxForChat(chatId) {
    const id = Number(chatId || 0);
    if (!id || id !== Number(currentChatId || 0)) return;
    removeOutboxRows();
    const items = await window.messageCache?.readOutbox?.(id) || [];
    if (id !== Number(currentChatId || 0)) return;
    items
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
      .forEach((item) => renderOutboxItem(item));
    updateScrollBottomButton();
  }

  function scheduleRetryLayout() {
    clearTimeout(retryLayoutTimer);
    retryLayoutTimer = setTimeout(() => requestAnimationFrame(layoutRetryButtons), 0);
  }

  function layoutRetryButtons() {
    if (!messagesEl) return;
    const containerRect = messagesEl.getBoundingClientRect();
    messagesEl.querySelectorAll('.msg-row[data-outbox="1"] .msg-retry-btn').forEach((btn) => {
      const row = btn.closest('.msg-row');
      const bubble = row?.querySelector('.msg-bubble') || btn.closest('.msg-bubble');
      if (!bubble) return;
      const bubbleRect = bubble.getBoundingClientRect();
      const retryWidth = btn.offsetWidth || 22;
      const useRightSide = Boolean(row?.classList.contains('own') && messagesEl.classList.contains('compact-view'));
      const shouldInline = useRightSide
        ? bubbleRect.right + retryWidth + 2 > containerRect.right - 2
        : bubbleRect.left - retryWidth - 2 < containerRect.left + 2;
      btn.classList.toggle('retry-side-right', useRightSide);
      btn.classList.toggle('retry-side-left', !useRightSide);
      bubble.classList.toggle('retry-inline', shouldInline);
      if (shouldInline) {
        const footer = bubble.querySelector('.msg-footer');
        let slot = footer?.querySelector('.msg-retry-slot');
        if (footer && !slot) {
          slot = document.createElement('span');
          slot.className = 'msg-retry-slot';
          const time = footer.querySelector('.msg-time');
          footer.insertBefore(slot, time || null);
        }
        if (slot) {
          if (btn.parentElement !== slot) slot.appendChild(btn);
        }
        btn.classList.add('inline');
      } else {
        const slot = bubble.querySelector('.msg-retry-slot');
        if (btn.parentElement !== bubble) bubble.appendChild(btn);
        if (slot && slot.childElementCount === 0) slot.remove();
        btn.classList.remove('inline');
      }
    });
  }

  async function persistOutboxItem(item) {
    item.status = item.status || 'failed';
    await window.messageCache?.upsertOutboxItem?.(item);
    const row = findOutboxRow(item.clientId);
    if (row) row.__outboxItem = item;
    return item;
  }

  function setOutboxSending(clientId, sending) {
    if (!clientId) return;
    if (sending) outboxSending.add(clientId);
    else outboxSending.delete(clientId);
    const row = findOutboxRow(clientId);
    if (row) updateRowStatus(row);
  }

  async function uploadOutboxAttachment(item) {
    if (item.serverFileId) return item.serverFileId;
    const attachment = item.attachments && item.attachments[0];
    if (!attachment?.file) throw new Error('Attachment is not available locally');
    const fd = new FormData();
    fd.append('file', attachment.file, attachment.name || 'attachment');
    const data = await api('/api/upload', { method: 'POST', body: fd });
    item.serverFileId = data.id;
    item.serverFileMeta = data;
    await persistOutboxItem(item);
    return data.id;
  }

  async function sendOutboxMessageItem(item) {
    const attachment = item.attachments && item.attachments[0];
    let fileId = item.serverFileId || null;
    if (attachment && !fileId) fileId = await uploadOutboxAttachment(item);
    return api(`/api/chats/${item.chatId}/messages`, {
      method: 'POST',
      body: {
        text: item.text || null,
        fileId: fileId || null,
        replyToId: item.replyToId || null,
        client_id: item.clientId,
      },
    });
  }

  async function sendOutboxVoiceItem(item) {
    const voice = item.voice || {};
    if (!voice.blob) throw new Error('Voice note is not available locally');
    const formData = new FormData();
    formData.append('file', voice.blob, voice.name || `voice-note-${Date.now()}.wav`);
    formData.append('durationMs', String(voice.durationMs || 0));
    formData.append('sampleRate', String(voice.sampleRate || 16000));
    formData.append('client_id', item.clientId);
    if (item.replyToId) formData.append('replyToId', String(item.replyToId));
    return api(`/api/chats/${item.chatId}/voice-message`, {
      method: 'POST',
      body: formData,
    });
  }

  async function completeOutboxSend(item, serverMsg) {
    if (!serverMsg) return;
    await window.messageCache?.deleteOutboxItem?.(item.chatId, item.clientId);
    revokeOutboxObjectUrls(item.clientId);
    outboxSending.delete(item.clientId);
    applyOwnReadStateToMessage(serverMsg, item.chatId);
    try { window.messageCache?.upsertMessage?.(serverMsg).catch(()=>{}); } catch (e) {}
    updateChatListLastMessage(serverMsg);

    const row = findOutboxRow(item.clientId);
    const alreadyDisplayed = isMessageDisplayed(serverMsg.id);
    if (row) {
      forgetDisplayedMessage(row.dataset.msgId);
      if (alreadyDisplayed) {
        row.remove();
        cleanupEmptyMessageGroups();
      } else {
        const showName = Boolean(row.querySelector('.msg-sender'));
        const replacement = createMessageEl(serverMsg, showName);
        row.replaceWith(replacement);
        rememberDisplayedMessage(serverMsg.id);
      }
    } else if (Number(serverMsg.chat_id) === Number(currentChatId) && !alreadyDisplayed) {
      appendMessage(serverMsg);
    }
    updateScrollBottomButton();
  }

  async function trySendOutboxItem(rawItem) {
    const latest = await window.messageCache?.getOutboxItem?.(rawItem.chatId, rawItem.clientId);
    const item = latest || rawItem;
    if (!item?.clientId || outboxSending.has(item.clientId)) return;
    setOutboxSending(item.clientId, true);
    try {
      const serverMsg = item.kind === 'voice'
        ? await sendOutboxVoiceItem(item)
        : await sendOutboxMessageItem(item);
      await completeOutboxSend(item, serverMsg);
    } catch (e) {
      item.status = 'failed';
      await persistOutboxItem(item);
    } finally {
      setOutboxSending(item.clientId, false);
    }
  }

  async function queueOutboxItem(item, { attempt = true } = {}) {
    await persistOutboxItem(item);
    renderOutboxItem(item);
    if (attempt) await trySendOutboxItem(item);
    return item;
  }

  function createMessageOutboxItem({ text = null, attachment = null, reply = null, createdAt = null } = {}) {
    const clientId = makeClientId('c');
    return {
      clientId,
      chatId: currentChatId,
      userId: currentUser.id,
      status: 'failed',
      kind: 'message',
      createdAt: createdAt || new Date().toISOString(),
      text: text || null,
      replyToId: reply?.id || null,
      reply,
      attachments: attachment ? [attachment] : [],
      serverFileId: null,
      serverFileMeta: null,
    };
  }

  async function queueVoiceOutbox({ blob, durationMs, sampleRate, replyTo: suppliedReply } = {}) {
    if (!currentChatId || !blob) return null;
    const reply = getReplySnapshot(suppliedReply || replyTo);
    const clientId = makeClientId('c');
    const voiceName = `voice-note-${Date.now()}.wav`;
    const item = {
      clientId,
      chatId: currentChatId,
      userId: currentUser.id,
      status: 'failed',
      kind: 'voice',
      createdAt: new Date().toISOString(),
      text: null,
      replyToId: reply?.id || null,
      reply,
      attachments: [{
        localId: 'voice',
        file: blob,
        name: voiceName,
        size: blob.size || 0,
        mime: 'audio/wav',
        type: 'audio',
      }],
      voice: {
        blob,
        name: voiceName,
        durationMs,
        sampleRate,
        mime: 'audio/wav',
      },
    };
    clearReply();
    await queueOutboxItem(item, { attempt: false });
    playAppSound('send');
    scrollToBottom();
    trySendOutboxItem(item);
    return item;
  }

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

    if (!text && filesToSend.length === 0) return;
    if (text.length > MAX_MSG) { alert('Message too long'); return; }
    animateSendButton();

    const replySnapshot = getReplySnapshot();
    msgInput.value = '';
    autoResize();
    syncMentionOpenButton();
    clearPendingFile();
    clearReply();
    window.BananzaVoiceHooks?.refreshComposerState?.();

    const items = [];
    const firstAttachment = filesToSend[0] || null;
    items.push(createMessageOutboxItem({
      text: text || null,
      attachment: firstAttachment,
      reply: replySnapshot,
      createdAt: new Date().toISOString(),
    }));
    for (let i = 1; i < filesToSend.length; i++) {
      items.push(createMessageOutboxItem({
        text: null,
        attachment: filesToSend[i],
        reply: null,
        createdAt: new Date(Date.now() + i).toISOString(),
      }));
    }

    for (const item of items) await queueOutboxItem(item, { attempt: false });
    playAppSound('send');
    scrollToBottom();
    for (const item of items) await trySendOutboxItem(item);
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

  function markMessageDeleted(msgId, chatId = currentChatId) {
    try { if (window.messageCache) window.messageCache.deleteMessage(chatId, msgId).catch(()=>{}); } catch (e) {}
    ensureScrollAnchorsLoaded();
    const activeChatId = Number(currentChatId || 0);
    const targetChatId = Number(chatId || activeChatId || 0);
    const savedAnchor = targetChatId ? scrollPositions[targetChatId] : null;
    const deletedAnchorWasSaved = Boolean(savedAnchor?.messageId && Number(savedAnchor.messageId) === Number(msgId));
    const isActiveChat = targetChatId > 0 && targetChatId === activeChatId;
    const preserveAnchor = isActiveChat ? captureScrollAnchor() : null;
    const el = messagesEl.querySelector(`[data-msg-id="${msgId}"]`);
    if (!el) {
      if (deletedAnchorWasSaved && targetChatId) {
        delete scrollPositions[targetChatId];
        persistScrollAnchors();
      }
      console.warn('[markDeleted] element not found for', msgId);
      return;
    }
    const bubble = el.querySelector('.msg-bubble');
    if (!bubble) { console.warn('[markDeleted] bubble not found'); return; }
    const timeEl = bubble.querySelector('.msg-time');
    const timeText = timeEl ? timeEl.textContent : '';
    bubble.innerHTML = `<span class="msg-deleted">Message deleted</span><span class="msg-time">${esc(timeText)}</span>`;
    if (el.__messageData) {
      el.__messageData = {
        ...el.__messageData,
        is_deleted: true,
        text: null,
        file_id: null,
        file_name: null,
        file_stored: null,
        file_type: null,
        file_mime: null,
        previews: [],
        reactions: [],
        edited_at: null,
      };
    }
    if (
      String(activeMessageActionsRow?.dataset?.msgId || '') === String(msgId)
      || String(reactionPickerMsgId || '') === String(msgId)
    ) {
      hideFloatingMessageActions({ immediate: true });
    }
    if (el.__replyPayload) el.__replyPayload.text = 'Message deleted';
    el.querySelector('.msg-reply-btn')?.remove();
    el.querySelector('.msg-react-btn')?.remove();
    el.querySelector('.msg-edit-btn')?.remove();
    el.querySelector('.msg-save-note-btn')?.remove();
    el.querySelector('.msg-forward-btn')?.remove();
    el.querySelector('.msg-actions')?.remove();
    if (editTo?.id === msgId) clearEdit({ clearInput: true });
    requestAnimationFrame(() => {
      if (isActiveChat && preserveAnchor?.messageId) restoreScrollAnchor(preserveAnchor, 1);
      if (targetChatId) saveCurrentScrollAnchor(targetChatId, { force: true });
    });
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
    applyOwnReadStateToMessage(msg, msg.chat_id || currentChatId);
    try { if (window.messageCache) window.messageCache.upsertMessage(msg).catch(()=>{}); } catch (e) {}
    if (msg.chat_id !== currentChatId) return;

    const row = messagesEl.querySelector(`[data-msg-id="${msg.id}"]`);
    if (!row) return;
    const nextMsg = { ...msg };
    if (row.querySelector('.msg-status.read')) nextMsg.is_read = true;
    const showName = Boolean(row.querySelector('.msg-sender'));
    const replacement = createMessageEl(nextMsg, showName);
    row.replaceWith(replacement);
    rememberDisplayedMessage(nextMsg.id);
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
    const files = Array.from(fileList).slice(0, MAX_ATTACHMENTS);
    if (files.length === 0) return;
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) { alert(`File too large: ${f.name} (max 25 MB)`); return; }
      if (!getLocalFileType(f)) { alert(`File type not allowed: ${f.name}`); return; }
    }

    pendingFiles = files.map(localAttachmentFromFile).filter(Boolean);
    pendingFile = pendingFiles[0] || null;
    renderPendingFiles();
    msgInput.focus();
    window.BananzaVoiceHooks?.refreshComposerState?.();
  }

  function renderPendingFiles() {
    if (pendingFiles.length === 0) { clearPendingFile(); return; }
    pendingFileEl.classList.remove('hidden');
    const icon = (t) => t === 'image' ? '🖼' : t === 'audio' ? '🎵' : t === 'video' ? '🎬' : '📄';
    if (pendingFiles.length === 1) {
      const d = pendingFiles[0];
      pendingFileEl.innerHTML = `
        <span>${icon(d.type)}</span>
        <span class="pending-file-name">${esc(d.name)} (${formatSize(d.size)})</span>
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
    if (isClientSideMessage(msg)) return false;
    if (!currentUser.is_admin && msg.user_id !== currentUser.id) return false;
    return Boolean(msg.is_voice_note || msg.file_id || msg.text);
  }

  function canForwardMessage(msg) {
    if (!currentUser || !msg || msg.is_deleted) return false;
    if (isClientSideMessage(msg)) return false;
    return Boolean(msg.is_voice_note || msg.file_id || msg.text);
  }

  function canSaveMessageToNotes(msg) {
    if (!canForwardMessage(msg)) return false;
    if (isCurrentNotesChat()) return false;
    return true;
  }

  function getEditableText(row) {
    const msg = row?.__messageData || {};
    if (msg.is_voice_note || row?.__voiceMessage?.is_voice_note) {
      return (row?.__voiceMessage?.transcription_text || msg.transcription_text || '').trim();
    }
    return msg.text || '';
  }

  function getSelectedMessageFragment(row) {
    const selection = window.getSelection?.();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return '';
    const text = selection.toString();
    const bubble = row?.querySelector('.msg-bubble');
    if (!bubble || !text.trim()) return '';
    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if (!anchorNode || !focusNode) return '';
    return bubble.contains(anchorNode) && bubble.contains(focusNode) ? text.trim() : '';
  }

  function getMessageCopyText(row) {
    const msg = row?.__messageData || {};
    const parts = [];
    if (msg.forwarded_from_display_name) {
      parts.push(`Переслано от ${msg.forwarded_from_display_name}`);
    }
    if (msg.reply_to_id && msg.reply_display_name) {
      const replyText = getReplyQuoteText(msg).trim();
      const replyName = String(msg.reply_display_name || '').trim();
      if (replyName || replyText) parts.push([replyName, replyText].filter(Boolean).join(': '));
    }
    if (msg.file_id && msg.file_name) parts.push(msg.file_name);
    const mainText = getEditableText(row).trim();
    if (mainText) parts.push(mainText);
    if (!parts.length && msg.file_id) parts.push('Вложение');
    return parts.filter(Boolean).join('\n').trim();
  }

  async function copyMessageFromRow(row) {
    if (!row) return;
    const selectedText = getSelectedMessageFragment(row);
    const text = selectedText || getMessageCopyText(row);
    if (!text) return;
    hideFloatingMessageActions();
    const copied = await copyTextToClipboard(text);
    showCenterToast(copied
      ? (selectedText ? 'Фрагмент скопирован' : 'Сообщение скопировано')
      : 'Не удалось скопировать');
  }

  function setReplyFromRow(row) {
    if (row?.dataset.outbox === '1') return;
    const payload = row?.__replyPayload;
    if (!payload || row.querySelector('.msg-deleted')) return;
    hideFloatingMessageActions();
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
    hideFloatingMessageActions();
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
    syncMentionOpenButton();
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
    syncMentionOpenButton();
    window.BananzaVoiceHooks?.refreshComposerState?.();
  }

  function setupMessageSwipeGestures() {
    const threshold = 42;
    const maxOffset = 68;
    const lockStartPx = 8;
    const verticalCancelPx = 22;
    const mediaClickSuppressMs = 700;
    let swipe = null;

    const isInteractiveTarget = (target) => Boolean(target.closest(
      'button, a, input, textarea, select, label, audio, video, .msg-reply, .reaction-badge, .msg-file, .link-preview, .msg-group-avatar'
    ));
    const suppressMediaClickAfterSwipe = (row) => {
      if (!row?.querySelector?.('.msg-image')) return;
      row.__suppressMediaClickUntil = Date.now() + mediaClickSuppressMs;
    };
    const isSwipeGestureActive = (inputType) => Boolean(swipe && swipe.inputType === inputType);
    const canReplyFromRow = (row) => Boolean(
      row?.__replyPayload && row.dataset.outbox !== '1' && !row.querySelector('.msg-deleted')
    );
    const ensureIndicator = (row, kind) => {
      let indicator = row.querySelector('.swipe-message-indicator');
      if (!indicator) {
        indicator = document.createElement('div');
        row.appendChild(indicator);
      }
      indicator.className = `swipe-message-indicator swipe-${kind}-indicator`;
      indicator.textContent = kind === 'reply' ? '\u21A9' : '\u270E';
      return indicator;
    };
    const beginSwipe = ({ row, startX, startY, startedOnMedia = false, inputType = 'touch', pointerId = null }) => {
      swipe = {
        row,
        content: row.querySelector('.msg-content'),
        startX,
        startY,
        dx: 0,
        kind: null,
        locked: false,
        startedOnMedia,
        inputType,
        pointerId,
      };
    };
    const updateSwipe = ({ clientX, clientY, event = null }) => {
      if (!swipe) return;
      const rawDx = clientX - swipe.startX;
      const dy = clientY - swipe.startY;
      const absX = Math.abs(rawDx);
      const absY = Math.abs(dy);

      if (!swipe.locked) {
        if (absY > verticalCancelPx && absY > absX * 1.35) {
          finishSwipe(false);
          return;
        }
        if (absX < lockStartPx || absX < absY * 0.75) return;
        const kind = rawDx < 0 ? 'reply' : 'edit';
        if ((kind === 'reply' && !canReplyFromRow(swipe.row)) || (kind === 'edit' && !canEditMessage(swipe.row.__messageData))) {
          finishSwipe(false);
          return;
        }
        swipe.kind = kind;
        swipe.locked = true;
        suppressNextMessageActionTap();
        hideFloatingMessageActions({ immediate: true });
        ensureIndicator(swipe.row, kind);
        swipe.row.classList.add(`swipe-${kind}-active`);
      }

      if (event?.cancelable) event.preventDefault();
      swipe.dx = Math.min(absX, maxOffset);
      const offset = swipe.kind === 'reply' ? -swipe.dx : swipe.dx;
      if (swipe.content) swipe.content.style.transform = `translateX(${offset}px)`;
      swipe.row.classList.toggle(`swipe-${swipe.kind}-ready`, absX >= threshold);
    };
    const finishSwipe = (shouldApply) => {
      if (!swipe) return;
      const { row, content, kind, locked, startedOnMedia } = swipe;
      row.classList.remove('swipe-reply-active', 'swipe-reply-ready', 'swipe-edit-active', 'swipe-edit-ready');
      if (content) content.style.transform = '';
      const indicator = row.querySelector('.swipe-message-indicator');
      setTimeout(() => indicator?.remove(), 180);
      if (locked && startedOnMedia) suppressMediaClickAfterSwipe(row);
      if (shouldApply && kind) {
        navigator.vibrate?.(18);
        if (kind === 'reply') setReplyFromRow(row);
        else if (kind === 'edit') setEditFromRow(row);
      }
      swipe = null;
    };

    messagesEl.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || isInteractiveTarget(e.target)) return;
      const row = e.target.closest('.msg-row');
      if (!row || row.dataset.outbox === '1' || row.querySelector('.msg-deleted')) return;
      const touch = e.touches[0];
      beginSwipe({
        row,
        startX: touch.clientX,
        startY: touch.clientY,
        startedOnMedia: Boolean(e.target.closest('.msg-image')),
        inputType: 'touch',
      });
    }, { passive: true });

    messagesEl.addEventListener('touchmove', (e) => {
      if (!isSwipeGestureActive('touch') || e.touches.length !== 1) return;
      const touch = e.touches[0];
      updateSwipe({ clientX: touch.clientX, clientY: touch.clientY, event: e });
    }, { passive: false });

    messagesEl.addEventListener('touchend', () => {
      if (!isSwipeGestureActive('touch')) return;
      finishSwipe(Boolean(swipe?.locked && swipe.dx >= threshold));
    }, { passive: true });
    messagesEl.addEventListener('touchcancel', () => {
      if (!isSwipeGestureActive('touch')) return;
      finishSwipe(false);
    }, { passive: true });

    messagesEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || !e.isPrimary || e.button !== 0 || isInteractiveTarget(e.target)) return;
      const row = e.target.closest('.msg-row');
      if (!row || row.dataset.outbox === '1' || row.querySelector('.msg-deleted')) return;
      beginSwipe({
        row,
        startX: e.clientX,
        startY: e.clientY,
        startedOnMedia: Boolean(e.target.closest('.msg-image')),
        inputType: 'pointer',
        pointerId: e.pointerId,
      });
    });
    document.addEventListener('pointermove', (e) => {
      if (!isSwipeGestureActive('pointer') || e.pointerId !== swipe?.pointerId) return;
      updateSwipe({ clientX: e.clientX, clientY: e.clientY, event: e });
    });
    document.addEventListener('pointerup', (e) => {
      if (!isSwipeGestureActive('pointer') || e.pointerId !== swipe?.pointerId) return;
      finishSwipe(Boolean(swipe?.locked && swipe.dx >= threshold));
    });
    document.addEventListener('pointercancel', (e) => {
      if (!isSwipeGestureActive('pointer') || e.pointerId !== swipe?.pointerId) return;
      finishSwipe(false);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════════════════
  let searchDebounce = null;

  function isSearchPanelOpen() {
    return Boolean(searchPanel && searchPanel.getAttribute('aria-hidden') === 'false');
  }

  function clearSearchResults() {
    if (searchResults) searchResults.innerHTML = '';
  }

  function updateSearchTriggerState(active) {
    $('#searchBtn')?.classList.toggle('is-active', !!active);
  }

  function renderSearchResultsEmpty(message = 'No results') {
    if (!searchResults) return;
    searchResults.innerHTML = `<div class="search-results-empty">${esc(message)}</div>`;
  }

  function renderSearchScopeToggle() {
    if (!searchAllChatsToggle) return;
    const forcedGlobal = !currentChatId;
    searchAllChatsToggle.checked = forcedGlobal ? true : searchAllChats;
    searchAllChatsToggle.disabled = forcedGlobal;
    searchAllChatsToggle.setAttribute('aria-disabled', forcedGlobal ? 'true' : 'false');
    searchPanel?.querySelector('.search-panel-scope')?.classList.toggle('is-disabled', forcedGlobal);
  }

  function clearSearchPanelTransitionState() {
    clearTimeout(searchPanelCloseTimer);
    searchPanelCloseTimer = null;
    if (searchPanelTransitionHandler) {
      searchPanelSheet?.removeEventListener('transitionend', searchPanelTransitionHandler);
      searchPanelTransitionHandler = null;
    }
    if (searchPanelOpenFrame) {
      cancelAnimationFrame(searchPanelOpenFrame);
      searchPanelOpenFrame = null;
    }
  }

  function ensureSearchPanelReady() {
    if (!searchPanel) return;
    if (searchPanel.dataset.ready === '1') return;
    searchPanel.dataset.ready = '1';
    searchPanel.classList.remove('hidden', 'is-open', 'is-closing');
    searchPanel.setAttribute('aria-hidden', 'true');
    renderSearchScopeToggle();
    updateSearchTriggerState(false);
  }

  function getSearchPanelTransitionFallbackMs() {
    const maxDuration = Math.max(
      getElementTransitionTotalMs(searchPanel),
      getElementTransitionTotalMs(searchPanelSheet)
    );
    return Math.max(MODAL_TRANSITION_BUFFER_MS, Math.ceil(maxDuration + MODAL_TRANSITION_BUFFER_MS));
  }

  function focusSearchInput() {
    if (!searchInput) return;
    try {
      searchInput.focus({ preventScroll: true });
    } catch {
      searchInput.focus();
    }
  }

  function flushSearchPanelPendingAction() {
    const action = searchPanelPendingAction;
    searchPanelPendingAction = null;
    if (typeof action !== 'function') return;
    setTimeout(() => {
      try {
        action();
      } catch (e) {}
    }, 0);
  }

  function shouldAutoFocusSearchInput() {
    return window.innerWidth > 768;
  }

  function waitForMs(ms = 0) {
    return new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
  }

  async function animateSearchResultChatSwitch(targetChatId) {
    if (window.innerWidth > 768) return;
    if (!currentChatId || Number(targetChatId) === Number(currentChatId)) return;
    if (prefersReducedMotion()) {
      revealSidebarFromChat({ forceAnimation: true });
      return;
    }
    const transitionMs = Math.max(180, Math.ceil(getElementTransitionTotalMs(sidebar) || 250));
    if (sidebar.classList.contains('sidebar-hidden')) {
      if (history.state?.chat) {
        navigateBackToChatList();
      } else {
        revealSidebarFromChat({ forceAnimation: true });
      }
      await waitForMs(transitionMs + 24);
    }
  }

  function formatSearchResultTimestamp(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const sameYear = date.getFullYear() === now.getFullYear();
    return date.toLocaleString([], sameYear
      ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function finalizeSearchPanelClose() {
    if (!searchPanel) return false;
    clearSearchPanelTransitionState();
    searchPanel.classList.remove('is-open', 'is-closing');
    searchPanel.setAttribute('aria-hidden', 'true');
    updateSearchTriggerState(false);
    clearTimeout(searchDebounce);
    searchDebounce = null;
    searchRequestSeq += 1;
    searchAllChats = false;
    if (searchInput) searchInput.value = '';
    clearSearchResults();
    renderSearchScopeToggle();
    return true;
  }

  function openSearchPanel() {
    if (!searchPanel) return;
    ensureSearchPanelReady();
    if (isSearchPanelOpen() && !searchPanel.classList.contains('is-closing')) {
      if (shouldAutoFocusSearchInput()) focusSearchInput();
      return;
    }
    clearSearchPanelTransitionState();
    clearTimeout(searchDebounce);
    searchDebounce = null;
    searchRequestSeq += 1;
    searchPanelPendingAction = null;
    searchPanelReturnFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : $('#searchBtn');
    searchAllChats = false;
    renderSearchScopeToggle();
    if (searchInput) searchInput.value = '';
    clearSearchResults();
    searchPanel.setAttribute('aria-hidden', 'false');
    searchPanel.classList.remove('is-open', 'is-closing');
    updateSearchTriggerState(true);
    if (!searchPanelHistoryPushed) {
      history.pushState({ ...(history.state || {}), searchPanel: true }, '');
      searchPanelHistoryPushed = true;
    }
    searchPanelOpenFrame = requestAnimationFrame(() => {
      searchPanel.classList.add('is-open');
      searchPanelOpenFrame = null;
      if (shouldAutoFocusSearchInput()) {
        requestAnimationFrame(() => {
          if (isSearchPanelOpen()) focusSearchInput();
        });
      }
    });
  }

  function closeSearchPanel({ fromHistory = false, immediate = false, afterClose = null } = {}) {
    if (!searchPanel) return false;
    if (!isSearchPanelOpen()) {
      if (typeof afterClose === 'function') afterClose();
      return false;
    }
    if (typeof afterClose === 'function') searchPanelPendingAction = afterClose;
    clearTimeout(searchDebounce);
    searchDebounce = null;
    searchRequestSeq += 1;
    clearSearchPanelTransitionState();

    const finish = () => {
      finalizeSearchPanelClose();
      if (fromHistory) searchPanelHistoryPushed = false;
      if (searchPanelHistoryPushed && !fromHistory) {
        searchPanelSkipNextPopstate = true;
        searchPanelHistoryPushed = false;
        history.back();
        return true;
      }
      const shouldRestoreFocus = !searchPanelPendingAction;
      if (shouldRestoreFocus) {
        focusElementIfPossible(searchPanelReturnFocusEl || $('#searchBtn'));
      }
      searchPanelReturnFocusEl = null;
      flushSearchPanelPendingAction();
      return true;
    };

    searchPanel.classList.remove('is-open');
    if (immediate || prefersReducedMotion() || currentModalAnimation === 'none') {
      return finish();
    }
    searchPanel.classList.add('is-closing');
    searchPanelTransitionHandler = (event) => {
      if (event.target !== searchPanelSheet || event.propertyName !== 'transform') return;
      finish();
    };
    searchPanelSheet?.addEventListener('transitionend', searchPanelTransitionHandler);
    searchPanelCloseTimer = setTimeout(finish, getSearchPanelTransitionFallbackMs());
    return true;
  }

  function performSearch({ immediate = false } = {}) {
    const q = searchInput.value.trim();
    clearTimeout(searchDebounce);
    searchDebounce = null;
    const requestId = ++searchRequestSeq;
    if (q.length < 2) {
      clearSearchResults();
      return;
    }
    const runSearch = async () => {
      try {
        const params = new URLSearchParams({ q });
        const isGlobalSearch = searchAllChats || !currentChatId;
        if (!isGlobalSearch && currentChatId) params.set('chatId', currentChatId);
        const results = await api(`/api/messages/search?${params}`);
        if (requestId !== searchRequestSeq || !isSearchPanelOpen()) return;
        clearSearchResults();
        if (results.length === 0) {
          renderSearchResultsEmpty('No results');
          return;
        }
        const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const queryPattern = new RegExp(`(${escapedQuery})`, 'gi');
        for (const r of results) {
          const el = document.createElement('div');
          el.className = 'search-result-item';
          const highlighted = esc(r.text || '').replace(
            queryPattern,
            '<mark>$1</mark>'
          );
          const chatContext = r.chat_name
            ? r.chat_name
            : (r.chat_type === 'group' ? 'Group chat' : 'Direct chat');
          el.innerHTML = `
            <div class="search-result-meta">
              <div class="search-result-name">${esc(r.display_name || 'Unknown')}</div>
              <div class="search-result-chat">${esc(chatContext)}</div>
            </div>
            <div class="search-result-text">${highlighted}</div>
            <div class="search-result-time">${esc(formatSearchResultTimestamp(r.created_at))}</div>
          `;
          el.addEventListener('click', () => {
            closeSearchPanel({
              afterClose: () => {
                jumpToSearchResult(r).catch((e) => {
                  showCenterToast(e?.message || 'Message not found');
                });
              },
            });
          });
          searchResults.appendChild(el);
        }
      } catch (e) {
        if (requestId !== searchRequestSeq) return;
        renderSearchResultsEmpty(e?.message || 'Search failed');
      }
    };
    if (immediate) {
      runSearch();
      return;
    }
    searchDebounce = setTimeout(runSearch, 300);
  }

  function scrollToMessage(msgId, { behavior = 'smooth', highlight = true, highlightClass = 'is-search-hit' } = {}) {
    const row = messagesEl.querySelector(`[data-msg-id="${msgId}"]`);
    if (!row) return false;
    row.scrollIntoView({ behavior, block: 'center' });
    if (highlight) {
      clearTimeout(row.__searchHitTimer);
      row.classList.add(highlightClass);
      row.__searchHitTimer = setTimeout(() => {
        row.classList.remove(highlightClass);
      }, 1800);
    }
    return true;
  }

  async function jumpToSearchResult(result) {
    const chatId = Number(result?.chat_id || 0);
    const messageId = Number(result?.id || 0);
    if (!chatId || !messageId) {
      showCenterToast('Message not found');
      return false;
    }
    const sameChat = chatId === Number(currentChatId || 0);
    if (sameChat && scrollToMessage(messageId)) return true;
    await animateSearchResultChatSwitch(chatId);
    await openChat(chatId, {
      anchorMessageId: messageId,
      suppressHistoryPush: sameChat,
      source: 'search',
    });
    if (scrollToMessage(messageId)) return true;
    showCenterToast('Message not found');
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SIDEBAR RESIZE
  // ═══════════════════════════════════════════════════════════════════════════
  (() => {
    const handle = $('#resizeHandle');
    if (!handle) return;
    let dragging = false;
    let startX, startW;
    const SIDEBAR_WIDTH_KEY = 'sidebarWidth';
    const MIN_SIDEBAR_WIDTH = 200;
    const MAX_SIDEBAR_WIDTH = 600;

    function clampSidebarWidth(value) {
      const width = Number(value || 0);
      const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0, MIN_SIDEBAR_WIDTH);
      const maxAllowed = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, viewportWidth - 80));
      if (!Number.isFinite(width) || width <= 0) return maxAllowed;
      return Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxAllowed, Math.round(width)));
    }

    function applySidebarWidth() {
      if (window.innerWidth <= 768) {
        sidebar.style.width = '';
        return;
      }
      const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY) || 0);
      if (saved > 0) sidebar.style.width = `${clampSidebarWidth(saved)}px`;
      else sidebar.style.width = `${clampSidebarWidth(sidebar.offsetWidth || 320)}px`;
    }

    function persistSidebarWidth(width = sidebar.offsetWidth) {
      if (window.innerWidth <= 768) return;
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clampSidebarWidth(width)));
    }

    applySidebarWidth();
    window.addEventListener('resize', applySidebarWidth);

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
      const newW = clampSidebarWidth(startW + e.clientX - startX);
      sidebar.style.width = newW + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      persistSidebarWidth(sidebar.offsetWidth);
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
      const newW = clampSidebarWidth(startW + e.touches[0].clientX - startX);
      sidebar.style.width = newW + 'px';
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('active');
      persistSidebarWidth(sidebar.offsetWidth);
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
      : `${names.join(', ')} печатают..`;
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
  const GALLERY_PREFETCH_COUNT = 3;
  const GALLERY_VIDEO_PRELOAD_LIMIT = 3;
  const GALLERY_IMAGE_PRELOAD_LIMIT = 12;
  const GALLERY_LOADING_TEXT = '\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0435\u0449\u0451 \u043c\u0435\u0434\u0438\u0430...';
  const GALLERY_FIRST_TEXT = '\u042d\u0442\u043e \u043f\u0435\u0440\u0432\u043e\u0435 \u043c\u0435\u0434\u0438\u0430';
  const GALLERY_LAST_TEXT = '\u042d\u0442\u043e \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u043c\u0435\u0434\u0438\u0430';
  const GALLERY_LOAD_ERROR_TEXT = '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437';
  let galleryItems = []; // { id, chatId, src, type, fileName, fileMime, fileSize }
  let galleryIndex = 0;
  let gallerySourceChatId = 0;
  let galleryHasMoreBefore = false;
  let galleryHasMoreAfter = false;
  let galleryLoadingBefore = false;
  let galleryLoadingAfter = false;
  let galleryLoadPromises = { before: null, after: null };
  let galleryLoadErrors = { before: false, after: false };
  let gallerySessionId = 0;
  let galleryImagePreloads = new Map();
  let galleryVideoPreloads = new Map();
  let galleryEdgeToastTimer = null;
  let galleryEdgeBounceTimer = null;
  let ivScale = 1, ivPanX = 0, ivPanY = 0;
  let mediaViewerSuppressClickUntil = 0;
  let ivZoomAnimationTimer = null;
  let ivZoomAnimationImg = null;
  let ivHistoryPushed = false;    // true when we pushed { view: 'mediaviewer' } to history
  let ivSkipNextPopstate = false; // skip chat-nav after closeMediaViewer calls history.back()

  // ═══════════════════════════════════════════════════════════════════════════
  // REACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const QUICK_REACTIONS = Object.freeze(['👍', '👎', '❤️', '🔥', '😂', '😮', '😢', '💩', '🎉', '🤡']);
  const FLOATING_ACTION_MARGIN = 8;
  const FLOATING_ACTION_GAP = 8;
  const REACTION_PICKER_IDLE_MS = 5000;
  let reactionPickerMsgId = null;
  let reactionPickerKeepKeyboard = false;
  let activeMessageActionsRow = null;
  let activeMessageActionsEl = null;
  let floatingMessageActionsState = null;
  let reactionPickerIdleTimer = null;
  let reactionEmojiPopoverCategory = Object.keys(EMOJIS)[0] || '';
  let suppressNextMessageActionTapUntil = 0;
  let reactionMorePointerHandledUntil = 0;

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

  function isFloatingSurfaceVisible(el) {
    return Boolean(el && !el.classList.contains('hidden'));
  }

  function getFloatingViewportRect() {
    const vv = window.visualViewport;
    const left = vv ? vv.offsetLeft : 0;
    const top = vv ? vv.offsetTop : 0;
    const width = vv ? vv.width : window.innerWidth;
    const height = vv ? vv.height : window.innerHeight;
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
    };
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (max < min) return min;
    return Math.max(min, Math.min(value, max));
  }

  function findMessageRowById(msgId) {
    const key = String(msgId || '');
    if (!key) return null;
    return Array.from(messagesEl.querySelectorAll('.msg-row[data-msg-id]'))
      .find((row) => String(row.dataset.msgId || '') === key) || null;
  }

  function getFloatingMessageActionRow() {
    const key = reactionPickerMsgId || floatingMessageActionsState?.msgId || activeMessageActionsRow?.dataset?.msgId || '';
    if (!key) return null;
    const row = findMessageRowById(key);
    if (row && floatingMessageActionsState) floatingMessageActionsState.row = row;
    return row;
  }

  function updateFloatingMessageActionsState(row, options = {}) {
    const msgId = Number(row?.dataset.msgId || 0);
    if (!msgId || !row) return null;
    const next = floatingMessageActionsState?.msgId === msgId
      ? { ...floatingMessageActionsState }
      : { msgId, row, pointerX: null, pointerY: null, placement: 'above' };
    next.msgId = msgId;
    next.row = row;
    if (Number.isFinite(options.x)) next.pointerX = Number(options.x);
    if (Number.isFinite(options.y)) next.pointerY = Number(options.y);
    floatingMessageActionsState = next;
    return next;
  }

  function clearFloatingMessageActionsStateIfClosed() {
    if (activeMessageActionsRow || isFloatingSurfaceVisible(reactionPicker) || isFloatingSurfaceVisible(reactionEmojiPopover)) return;
    floatingMessageActionsState = null;
  }

  function suppressNextMessageActionTap(ms = 650) {
    suppressNextMessageActionTapUntil = Math.max(suppressNextMessageActionTapUntil, Date.now() + ms);
  }

  function measureFloatingSurface(el, fallbackWidth, fallbackHeight) {
    if (!(el instanceof HTMLElement)) return { width: fallbackWidth, height: fallbackHeight };
    const wasHidden = el.classList.contains('hidden');
    const wasOpen = el.classList.contains('is-open');
    const wasClosing = el.classList.contains('is-closing');
    const prevVisibility = el.style.visibility;
    const prevPointerEvents = el.style.pointerEvents;
    const prevLeft = el.style.left;
    const prevTop = el.style.top;

    if (wasHidden) el.classList.remove('hidden');
    el.classList.remove('is-open', 'is-closing');
    el.style.visibility = 'hidden';
    el.style.pointerEvents = 'none';
    el.style.left = '-9999px';
    el.style.top = '-9999px';

    const width = el.offsetWidth || fallbackWidth;
    const height = el.offsetHeight || fallbackHeight;

    el.style.visibility = prevVisibility;
    el.style.pointerEvents = prevPointerEvents;
    el.style.left = prevLeft;
    el.style.top = prevTop;
    if (wasHidden) el.classList.add('hidden');
    if (wasOpen) el.classList.add('is-open');
    if (wasClosing) el.classList.add('is-closing');

    return { width, height };
  }

  function openFloatingSurface(el) {
    if (!(el instanceof HTMLElement)) return;
    clearTimeout(el.__closeTimer);
    el.__closeTimer = null;
    if (el.__openFrame) cancelAnimationFrame(el.__openFrame);
    el.classList.remove('hidden', 'is-closing');
    if (prefersReducedMotion() || currentModalAnimation === 'none') {
      el.classList.add('is-open');
      return;
    }
    if (el.classList.contains('is-open')) return;
    el.__openFrame = requestAnimationFrame(() => {
      el.__openFrame = requestAnimationFrame(() => {
        el.classList.add('is-open');
        el.__openFrame = null;
      });
    });
  }

  function closeFloatingSurface(el, { immediate = false, onAfterClose = null } = {}) {
    if (!(el instanceof HTMLElement)) {
      onAfterClose?.();
      return false;
    }
    clearTimeout(el.__closeTimer);
    el.__closeTimer = null;
    if (el.__openFrame) {
      cancelAnimationFrame(el.__openFrame);
      el.__openFrame = null;
    }

    const finalize = () => {
      clearTimeout(el.__closeTimer);
      el.__closeTimer = null;
      el.classList.add('hidden');
      el.classList.remove('is-open', 'is-closing');
      onAfterClose?.();
    };

    if (el.classList.contains('hidden')) {
      finalize();
      return false;
    }

    if (immediate || prefersReducedMotion() || currentModalAnimation === 'none') {
      finalize();
      return true;
    }

    el.classList.remove('is-open');
    el.classList.add('is-closing');
    const onTransitionEnd = (event) => {
      if (event.target !== el || event.propertyName !== 'opacity') return;
      el.removeEventListener('transitionend', onTransitionEnd);
      finalize();
    };
    el.addEventListener('transitionend', onTransitionEnd);
    const closeFallbackMs = Math.max(MODAL_TRANSITION_BUFFER_MS, Math.ceil(getElementTransitionTotalMs(el) + MODAL_TRANSITION_BUFFER_MS));
    el.__closeTimer = setTimeout(() => {
      el.removeEventListener('transitionend', onTransitionEnd);
      finalize();
    }, closeFallbackMs);
    return true;
  }

  function renderQuickReactionButtonsHtml({ buttonClass = '', moreAction = 'open-emoji-popover' } = {}) {
    const buttons = QUICK_REACTIONS.map((emoji) =>
      `<button type="button" class="${buttonClass}" data-reaction-action="toggle" data-emoji="${esc(emoji)}" title="${esc(`React ${emoji}`)}">${esc(emoji)}</button>`
    );
    buttons.push(
      `<button type="button" class="${buttonClass} reaction-more-button" data-reaction-action="${esc(moreAction)}" title="More reactions">⋯</button>`
    );
    return buttons.join('');
  }

  function renderReactionPickerContent() {
    if (!reactionPicker) return;
    reactionPicker.innerHTML = `
      <div class="reaction-picker-strip">
        ${renderQuickReactionButtonsHtml({ buttonClass: 'reaction-picker-button', moreAction: 'open-emoji-popover' })}
      </div>
    `;
    reactionPicker.querySelector('.reaction-picker-strip')?.addEventListener('scroll', () => {
      bumpReactionPickerIdleTimer();
    }, { passive: true });
  }

  function getAdditionalReactionCategories() {
    const quickSet = new Set(QUICK_REACTIONS);
    return Object.entries(EMOJIS || {})
      .map(([key, emojis]) => ({
        key,
        emojis: (Array.isArray(emojis) ? emojis : []).filter((emoji) => !quickSet.has(emoji)),
      }))
      .filter((category) => category.emojis.length > 0);
  }

  function getReactionEmojiCategoryKey(value) {
    const categories = getAdditionalReactionCategories();
    if (!categories.length) return '';
    return categories.some((category) => category.key === value) ? value : categories[0].key;
  }

  function renderReactionEmojiPopoverContent() {
    if (!reactionEmojiPopover) return;
    const categories = getAdditionalReactionCategories();
    const categoryKey = getReactionEmojiCategoryKey(reactionEmojiPopoverCategory);
    reactionEmojiPopoverCategory = categoryKey;
    const activeCategory = categories.find((category) => category.key === categoryKey) || categories[0];
    const categoryEmojis = activeCategory?.emojis || [];
    reactionEmojiPopover.innerHTML = `
      <div class="reaction-emoji-tabs">
        ${categories.map((category) => `
          <button type="button" class="reaction-emoji-tab${category.key === categoryKey ? ' active' : ''}" data-category="${esc(category.key)}">${esc(category.key)}</button>
        `).join('')}
      </div>
      <div class="reaction-emoji-grid">
        ${categoryEmojis.map((emoji) => `
          <button type="button" class="reaction-emoji-item" data-emoji="${esc(emoji)}" title="${esc(`React ${emoji}`)}">${esc(emoji)}</button>
        `).join('')}
      </div>
    `;
    reactionEmojiPopover.querySelector('.reaction-emoji-tabs')?.addEventListener('scroll', () => {
      bumpReactionPickerIdleTimer();
    }, { passive: true });
    reactionEmojiPopover.querySelector('.reaction-emoji-grid')?.addEventListener('scroll', () => {
      bumpReactionPickerIdleTimer();
    }, { passive: true });
  }

  function getVisibleMessageAreaRect() {
    const viewport = getFloatingViewportRect();
    const messagesRect = messagesEl?.getBoundingClientRect?.();
    if (!messagesRect) return viewport;
    const left = Math.max(viewport.left, messagesRect.left);
    const top = Math.max(viewport.top, messagesRect.top);
    const right = Math.min(viewport.right, messagesRect.right);
    const bottom = Math.min(viewport.bottom, messagesRect.bottom);
    if (right <= left || bottom <= top) return viewport;
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  function measureMessageActions(row) {
    const actions = getMessageActionsElement(row);
    if (!(actions instanceof HTMLElement)) return { width: 178, height: 36 };
    return {
      width: actions.offsetWidth || 178,
      height: actions.offsetHeight || 36,
    };
  }

  function getMessageActionsElement(row) {
    if (
      activeMessageActionsEl instanceof HTMLElement
      && activeMessageActionsRow
      && String(activeMessageActionsRow.dataset.msgId || '') === String(row?.dataset?.msgId || '')
    ) {
      return activeMessageActionsEl;
    }
    return row?.querySelector('.msg-actions') || null;
  }

  function portalMessageActions(row) {
    const actions = getMessageActionsElement(row);
    if (!(actions instanceof HTMLElement)) return null;
    if (!actions.__floatingActionsBound) {
      actions.addEventListener('click', (e) => {
        if (!actions.classList.contains('actions-floating-open')) return;
        const reactBtn = e.target.closest('.msg-react-btn');
        if (!reactBtn) return;
        e.preventDefault();
        e.stopPropagation();
        const keepComposerFocus = reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen();
        showReactionPicker(activeMessageActionsRow, reactBtn, { source: 'actions', keepComposerFocus });
      });
      actions.__floatingActionsBound = true;
    }
    if (!actions.__messageActionsHome) {
      actions.__messageActionsHome = {
        parent: actions.parentNode,
        nextSibling: actions.nextSibling,
      };
    }
    actions.style.setProperty('--msg-actions-bg', row.classList.contains('own') ? 'var(--bg-own-msg)' : 'var(--bg-other-msg)');
    if (actions.parentNode !== document.body) document.body.appendChild(actions);
    activeMessageActionsEl = actions;
    return actions;
  }

  function restoreMessageActions(actions) {
    if (!(actions instanceof HTMLElement)) return;
    const home = actions.__messageActionsHome;
    if (home?.parent?.isConnected) {
      if (home.nextSibling?.parentNode === home.parent) home.parent.insertBefore(actions, home.nextSibling);
      else home.parent.appendChild(actions);
    }
    delete actions.__messageActionsHome;
  }

  function clearMessageActionsPlacement(row) {
    const actions = getMessageActionsElement(row);
    row?.classList.remove('actions-open', 'actions-placement-above', 'actions-placement-below');
    if (!(actions instanceof HTMLElement)) {
      if (activeMessageActionsRow === row) activeMessageActionsEl = null;
      return;
    }
    actions.classList.remove('actions-floating-open', 'actions-placement-above', 'actions-placement-below');
    actions.style.removeProperty('left');
    actions.style.removeProperty('right');
    actions.style.removeProperty('top');
    actions.style.removeProperty('bottom');
    actions.style.removeProperty('--msg-actions-bg');
    restoreMessageActions(actions);
    if (activeMessageActionsEl === actions) activeMessageActionsEl = null;
  }

  function resolveMessageActionLayout(row, { includeActions = false, includePicker = false, reserveActionsForPicker = includePicker } = {}) {
    const rowRect = row?.getBoundingClientRect?.();
    if (!rowRect) return null;
    const bubbleRect = row.querySelector('.msg-bubble')?.getBoundingClientRect() || rowRect;
    const visibleArea = getVisibleMessageAreaRect();
    const hasActionSlot = includeActions || reserveActionsForPicker;
    const actionSize = hasActionSlot
      ? measureMessageActions(row)
      : { width: 0, height: 0 };
    const pickerSize = includePicker
      ? measureFloatingSurface(reactionPicker, 430, 56)
      : { width: 0, height: 0 };
    const actionSlotHeight = hasActionSlot ? actionSize.height : pickerSize.height;
    const actionSlotWidth = Math.max(1, hasActionSlot ? actionSize.width : pickerSize.width);
    const topVisible = rowRect.top >= visibleArea.top + FLOATING_ACTION_MARGIN;
    const bottomVisible = rowRect.bottom <= visibleArea.bottom - FLOATING_ACTION_MARGIN;
    const spaceAbove = rowRect.top - visibleArea.top - FLOATING_ACTION_MARGIN - FLOATING_ACTION_GAP;
    const spaceBelow = visibleArea.bottom - rowRect.bottom - FLOATING_ACTION_MARGIN - FLOATING_ACTION_GAP;
    let placement = 'above';
    if (!topVisible) placement = 'below';
    else if (!bottomVisible || spaceBelow < actionSlotHeight) placement = 'above';
    else if (spaceAbove < actionSlotHeight) placement = 'below';

    const preferredActionsLeft = row.classList.contains('own') ? bubbleRect.right - actionSlotWidth : bubbleRect.left;
    const virtualActionsLeft = clamp(
      preferredActionsLeft,
      visibleArea.left + FLOATING_ACTION_MARGIN,
      visibleArea.right - actionSlotWidth - FLOATING_ACTION_MARGIN
    );
    let virtualActionsTop = placement === 'above'
      ? rowRect.top - FLOATING_ACTION_GAP - actionSlotHeight
      : rowRect.bottom + FLOATING_ACTION_GAP;
    virtualActionsTop = clamp(
      virtualActionsTop,
      visibleArea.top + FLOATING_ACTION_MARGIN,
      visibleArea.bottom - actionSlotHeight - FLOATING_ACTION_MARGIN
    );

    let pickerLeft = null;
    let pickerTop = null;
    if (includePicker) {
      const preferredPickerLeft = row.classList.contains('own')
        ? virtualActionsLeft + actionSlotWidth - pickerSize.width
        : virtualActionsLeft;
      pickerLeft = clamp(
        preferredPickerLeft,
        visibleArea.left + FLOATING_ACTION_MARGIN,
        visibleArea.right - pickerSize.width - FLOATING_ACTION_MARGIN
      );
      pickerTop = placement === 'above'
        ? virtualActionsTop - FLOATING_ACTION_GAP - pickerSize.height
        : virtualActionsTop + actionSlotHeight + FLOATING_ACTION_GAP;
      pickerTop = clamp(
        pickerTop,
        visibleArea.top + FLOATING_ACTION_MARGIN,
        visibleArea.bottom - pickerSize.height - FLOATING_ACTION_MARGIN
      );
    }

    return {
      placement,
      pickerLeft,
      pickerTop,
      actionsLeft: includeActions ? virtualActionsLeft : null,
      actionsTop: includeActions ? virtualActionsTop : null,
    };
  }

  function positionFloatingElement(el, left, top) {
    if (!(el instanceof HTMLElement)) return;
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  }

  function applyMessageActionsLayout(row, layout) {
    const actions = portalMessageActions(row);
    if (!(actions instanceof HTMLElement) || !layout) return false;
    row.classList.add('actions-open');
    row.classList.toggle('actions-placement-above', layout.placement === 'above');
    row.classList.toggle('actions-placement-below', layout.placement === 'below');
    actions.classList.add('actions-floating-open');
    actions.classList.toggle('actions-placement-above', layout.placement === 'above');
    actions.classList.toggle('actions-placement-below', layout.placement === 'below');
    actions.style.left = `${Math.round(layout.actionsLeft)}px`;
    actions.style.top = `${Math.round(layout.actionsTop)}px`;
    actions.style.right = 'auto';
    actions.style.bottom = 'auto';
    return true;
  }

  function positionReactionEmojiPopover() {
    if (!reactionEmojiPopover || reactionEmojiPopover.classList.contains('hidden')) return;
    const anchorRect = reactionPicker?.querySelector('[data-reaction-action="open-emoji-popover"]')?.getBoundingClientRect()
      || reactionPicker?.getBoundingClientRect();
    if (!anchorRect) return;
    const viewport = getVisibleMessageAreaRect();
    const size = measureFloatingSurface(reactionEmojiPopover, 340, 260);
    let left = anchorRect.left + (anchorRect.width - size.width) / 2;
    left = clamp(left, viewport.left + FLOATING_ACTION_MARGIN, viewport.right - size.width - FLOATING_ACTION_MARGIN);
    let top = anchorRect.top - size.height - FLOATING_ACTION_GAP;
    if (top < viewport.top + FLOATING_ACTION_MARGIN) top = anchorRect.bottom + FLOATING_ACTION_GAP;
    top = clamp(top, viewport.top + FLOATING_ACTION_MARGIN, viewport.bottom - size.height - FLOATING_ACTION_MARGIN);
    positionFloatingElement(reactionEmojiPopover, left, top);
  }

  function positionMessageActionSurfaces({ includeActions = Boolean(activeMessageActionsRow), includePicker = isFloatingSurfaceVisible(reactionPicker) } = {}) {
    if (!includeActions && !includePicker && !isFloatingSurfaceVisible(reactionEmojiPopover)) return null;
    const row = getFloatingMessageActionRow();
    if (!row) {
      hideFloatingMessageActions({ immediate: true });
      return null;
    }
    includeActions = Boolean(includeActions && activeMessageActionsRow && String(activeMessageActionsRow.dataset.msgId || '') === String(row.dataset.msgId || ''));
    if (includeActions) activeMessageActionsRow = row;
    if (includePicker) renderReactionPickerContent();
    const layout = resolveMessageActionLayout(row, { includeActions, includePicker, reserveActionsForPicker: includePicker });
    if (!layout) {
      hideFloatingMessageActions({ immediate: true });
      return null;
    }
    if (includePicker && Number.isFinite(layout.pickerTop)) positionFloatingElement(reactionPicker, layout.pickerLeft, layout.pickerTop);
    if (includeActions && Number.isFinite(layout.actionsTop) && !applyMessageActionsLayout(row, layout)) hideActiveMessageActions();
    if (floatingMessageActionsState) floatingMessageActionsState.placement = layout.placement;
    if (!reactionEmojiPopover.classList.contains('hidden')) positionReactionEmojiPopover();
    return layout;
  }

  function clearReactionPickerIdleTimer() {
    clearTimeout(reactionPickerIdleTimer);
    reactionPickerIdleTimer = null;
  }

  function bumpReactionPickerIdleTimer() {
    clearReactionPickerIdleTimer();
    if (!isFloatingSurfaceVisible(reactionPicker) && !isFloatingSurfaceVisible(reactionEmojiPopover)) return;
    reactionPickerIdleTimer = setTimeout(() => {
      hideReactionUi({ immediate: false, keepComposerState: reactionPickerKeepKeyboard });
    }, REACTION_PICKER_IDLE_MS);
  }

  function hideReactionEmojiPopover(options = {}) {
    if (!reactionEmojiPopover) return;
    closeFloatingSurface(reactionEmojiPopover, {
      immediate: Boolean(options.immediate),
      onAfterClose: () => {
        clearFloatingMessageActionsStateIfClosed();
      },
    });
  }

  function showReactionEmojiPopover() {
    const msgId = reactionPickerMsgId || Number(floatingMessageActionsState?.msgId || activeMessageActionsRow?.dataset?.msgId || 0);
    if (!msgId) return;
    reactionPickerMsgId = msgId;
    if (!getAdditionalReactionCategories().length) return;
    if (isFloatingSurfaceVisible(reactionEmojiPopover)) {
      hideReactionEmojiPopover();
      return;
    }
    renderReactionEmojiPopoverContent();
    openFloatingSurface(reactionEmojiPopover);
    positionReactionEmojiPopover();
    bumpReactionPickerIdleTimer();
  }

  function handleReactionMoreButton(btn) {
    if (!btn) return;
    btn.blur?.();
    showReactionEmojiPopover();
    reactionMorePointerHandledUntil = Date.now() + 450;
    bumpReactionPickerIdleTimer();
  }

  function hideReactionUi(options = {}) {
    const keepComposerState = Boolean(options.keepComposerState);
    clearReactionPickerIdleTimer();
    hideReactionEmojiPopover({ immediate: options.immediate });
    closeFloatingSurface(reactionPicker, {
      immediate: Boolean(options.immediate),
      onAfterClose: () => {
        reactionPickerMsgId = null;
        if (!keepComposerState) reactionPickerKeepKeyboard = false;
        if (keepComposerState) focusComposerKeepKeyboard(true);
        clearFloatingMessageActionsStateIfClosed();
      },
    });
    if (!isFloatingSurfaceVisible(reactionPicker) && !keepComposerState) reactionPickerKeepKeyboard = false;
  }

  function hideReactionPicker(options = {}) {
    hideReactionUi(options);
  }

  function hideActiveMessageActions() {
    if (activeMessageActionsRow) clearMessageActionsPlacement(activeMessageActionsRow);
    messagesEl?.querySelectorAll('.msg-row.actions-open').forEach((row) => {
      if (row !== activeMessageActionsRow) clearMessageActionsPlacement(row);
    });
    activeMessageActionsRow = null;
    clearFloatingMessageActionsStateIfClosed();
  }

  function hideFloatingMessageActions(options = {}) {
    hideReactionUi({ keepComposerState: options.keepComposerState, immediate: options.immediate });
    hideActiveMessageActions();
  }

  function showMessageActions(row, { toggle = false, preserveReactionUi = false } = {}) {
    if (!row || row.dataset.outbox === '1') return false;
    row.classList.remove('actions-hover-suppressed');
    const msg = row.__messageData || {};
    if (msg.is_deleted || !getMessageActionsElement(row)) return false;
    const sameRow = activeMessageActionsRow
      && String(activeMessageActionsRow.dataset.msgId || '') === String(row.dataset.msgId || '');
    if (sameRow && toggle) {
      const closingRow = activeMessageActionsRow;
      hideFloatingMessageActions({ keepComposerState: reactionPickerKeepKeyboard });
      closingRow?.classList.add('actions-hover-suppressed');
      closingRow?.addEventListener('pointerleave', () => {
        closingRow.classList.remove('actions-hover-suppressed');
      }, { once: true });
      return true;
    }
    if (!preserveReactionUi) hideReactionUi({ immediate: true, keepComposerState: reactionPickerKeepKeyboard });
    hideActiveMessageActions();
    activeMessageActionsRow = row;
    updateFloatingMessageActionsState(row);
    positionMessageActionSurfaces({ includeActions: true, includePicker: isFloatingSurfaceVisible(reactionPicker) });
    return true;
  }

  function showReactionPicker(row, trigger, options = {}) {
    if (!reactionPicker || !row) return;
    const msg = row.__messageData || {};
    const msgId = Number(row.dataset.msgId || msg.id || 0);
    if (!msgId || msg.is_deleted) return;

    const source = options.source || 'direct';
    const keepComposerFocus = Boolean(options.keepComposerFocus);
    const samePicker = reactionPickerMsgId === msgId && isFloatingSurfaceVisible(reactionPicker);
    if (samePicker) {
      updateFloatingMessageActionsState(row);
      positionMessageActionSurfaces({
        includeActions: Boolean(activeMessageActionsRow && String(activeMessageActionsRow.dataset.msgId || '') === String(msgId)),
        includePicker: true,
      });
      bumpReactionPickerIdleTimer();
      if (keepComposerFocus) focusComposerKeepKeyboard(true);
      return;
    }

    if (source === 'actions') {
      showMessageActions(row, { preserveReactionUi: true });
    } else {
      hideActiveMessageActions();
    }

    hideReactionUi({ keepComposerState: keepComposerFocus, immediate: true });
    reactionPickerKeepKeyboard = keepComposerFocus;
    reactionPickerMsgId = msgId;
    updateFloatingMessageActionsState(row);
    renderReactionPickerContent();
    const includeActions = Boolean(activeMessageActionsRow && String(activeMessageActionsRow.dataset.msgId || '') === String(msgId));
    positionMessageActionSurfaces({ includeActions, includePicker: true });
    openFloatingSurface(reactionPicker);
    bumpReactionPickerIdleTimer();
    if (keepComposerFocus) focusComposerKeepKeyboard(true);
  }

  async function toggleReaction(msgId, emoji, options = {}) {
    const keepComposerFocus = Boolean(options.keepComposerFocus);
    hideFloatingMessageActions({ keepComposerState: keepComposerFocus });
    if (keepComposerFocus) focusComposerKeepKeyboard(true);
    try {
      const data = await api(`/api/messages/${msgId}/reactions`, { method: 'POST', body: { emoji } });
      if (data && data.reactions) updateReactionBar(msgId, data.reactions);
    } catch (err) {
      console.warn('[reaction] failed:', err);
    } finally {
      reactionPickerKeepKeyboard = false;
      if (keepComposerFocus) focusComposerKeepKeyboard(true);
    }
  }

  function normalizeGallerySrc(src) {
    const value = String(src || '').trim();
    if (!value) return '';
    try { return new URL(value, location.origin).href; } catch { return value; }
  }

  function galleryItemKey(item) {
    const id = Number(item?.id || 0);
    if (id) return `${Number(item.chatId || gallerySourceChatId || currentChatId || 0)}:${id}:${item.type}`;
    return `${item?.type || ''}:${normalizeGallerySrc(item?.src || '')}`;
  }

  function galleryItemFromMessage(msg, fallbackSrc = '') {
    const type = msg?.file_type === 'video' ? 'video' : (msg?.file_type === 'image' ? 'image' : '');
    const src = normalizeGallerySrc(fallbackSrc || msg?.client_file_url || (msg?.file_stored ? `/uploads/${msg.file_stored}` : ''));
    if (!type || !src) return null;
    return {
      id: Number(msg.id || 0),
      chatId: Number(msg.chat_id || msg.chatId || currentChatId || 0),
      src,
      type,
      fileName: msg.file_name || '',
      fileMime: msg.file_mime || '',
      fileSize: Number(msg.file_size || 0),
    };
  }

  function collectGalleryItems() {
    const items = [];
    const seen = new Set();
    messagesEl.querySelectorAll('.msg-image, .msg-video video').forEach(el => {
      const row = el.closest('.msg-row');
      const isImage = el.tagName === 'IMG';
      const source = isImage
        ? (el.currentSrc || el.src || el.getAttribute('src') || '')
        : (el.querySelector('source')?.getAttribute('src') || el.currentSrc || el.src || '');
      const fallback = {
        ...(row?.__messageData || {}),
        id: Number(row?.dataset.msgId || row?.__messageData?.id || 0),
        chat_id: row?.__messageData?.chat_id || row?.__messageData?.chatId || currentChatId,
        file_type: row?.__messageData?.file_type || (isImage ? 'image' : 'video'),
        file_name: row?.__messageData?.file_name || el.getAttribute('alt') || '',
        file_mime: row?.__messageData?.file_mime || el.querySelector?.('source')?.getAttribute('type') || '',
      };
      const item = galleryItemFromMessage(fallback, source);
      const key = galleryItemKey(item);
      if (!item || seen.has(key)) return;
      seen.add(key);
      items.push(item);
    });
    galleryItems = items;
  }

  function ivCurrentImg() {
    if (galleryItems[galleryIndex]?.type === 'video') return null;
    return ivStrip.querySelectorAll('.iv-slide')[galleryIndex]?.querySelector('img') || null;
  }
  function ivClearZoomTransition() {
    clearTimeout(ivZoomAnimationTimer);
    ivZoomAnimationTimer = null;
    if (ivZoomAnimationImg) ivZoomAnimationImg.style.transition = '';
    ivZoomAnimationImg = null;
  }
  function ivPrepareZoomTransition(img) {
    ivClearZoomTransition();
    if (!img || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    ivZoomAnimationImg = img;
    img.style.transition = 'transform 220ms cubic-bezier(.2, .8, .2, 1)';
    // Force the browser to commit the current transform before changing it.
    void img.offsetWidth;
    ivZoomAnimationTimer = setTimeout(ivClearZoomTransition, 280);
  }
  function ivApplyTransform() {
    const img = ivCurrentImg();
    if (img) img.style.transform = `scale(${ivScale}) translate(${ivPanX}px, ${ivPanY}px)`;
  }
  function ivResetZoom(animated = false) {
    const img = ivCurrentImg();
    if (animated) ivPrepareZoomTransition(img);
    else ivClearZoomTransition();
    ivScale = 1; ivPanX = 0; ivPanY = 0;
    if (img) img.style.transform = '';
  }
  function ivToggleZoomAt(clientX = window.innerWidth / 2, clientY = window.innerHeight / 2) {
    if (galleryItems[galleryIndex]?.type === 'video') return false;
    const img = ivCurrentImg();
    if (ivScale > 1) {
      ivResetZoom(true);
      return true;
    }
    ivPrepareZoomTransition(img);
    const ZOOM = 2.5;
    ivScale = ZOOM;
    ivPanX = (clientX - window.innerWidth / 2) * (1 / ZOOM - 1);
    ivPanY = (clientY - window.innerHeight / 2) * (1 / ZOOM - 1);
    ivApplyTransform();
    return true;
  }

  function gallerySlideHtml(item) {
    const key = esc(galleryItemKey(item));
    if (item.type === 'video') {
      const mime = item.fileMime ? ` type="${esc(item.fileMime)}"` : '';
      return `<div class="iv-slide iv-slide-video" data-gallery-key="${key}"><video controls playsinline preload="metadata"><source src="${esc(item.src)}"${mime}></video></div>`;
    }
    return `<div class="iv-slide" data-gallery-key="${key}"><img src="${esc(item.src)}" alt="${esc(item.fileName || '')}"></div>`;
  }

  function renderGalleryStrip() {
    ivStrip.innerHTML = galleryItems.map(gallerySlideHtml).join('');
  }

  function setGalleryStripPosition(animated = false) {
    ivStrip.style.transition = animated ? 'transform 0.3s ease' : 'none';
    ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;
  }

  function galleryEdgeCursor(direction) {
    const list = direction === 'before' ? galleryItems : [...galleryItems].reverse();
    const item = list.find(entry => Number(entry.id || 0) > 0);
    return Number(item?.id || 0);
  }

  function normalizeMediaPage(data) {
    return {
      media: Array.isArray(data?.media) ? data.media : [],
      hasMoreBefore: typeof data?.has_more_before === 'boolean' ? data.has_more_before : null,
      hasMoreAfter: typeof data?.has_more_after === 'boolean' ? data.has_more_after : null,
    };
  }

  async function readCachedGalleryMediaPage(chatId, direction, cursor) {
    try {
      const page = await window.messageCache?.readMediaPage?.(chatId, direction, cursor);
      if (page?.complete) return page;
    } catch (e) {}
    return null;
  }

  function cacheGalleryMediaPage(chatId, direction, cursor, page) {
    try {
      window.messageCache?.writeMediaPage?.(chatId, {
        direction,
        cursor,
        media: page.media || [],
        hasMoreBefore: page.hasMoreBefore,
        hasMoreAfter: page.hasMoreAfter,
        limit: MESSAGE_CACHE_LIMIT,
      }).catch(() => {});
    } catch (e) {}
  }

  function ensureGalleryLoadingEl() {
    let el = imageViewer.querySelector('.iv-loading');
    if (!el) {
      el = document.createElement('div');
      el.className = 'iv-loading';
      el.innerHTML = '<span class="iv-loading-dot"></span><span class="iv-loading-text"></span>';
      imageViewer.appendChild(el);
    }
    const textEl = el.querySelector('.iv-loading-text');
    if (textEl) textEl.textContent = GALLERY_LOADING_TEXT;
    return el;
  }

  function ensureGalleryEdgeHintEl() {
    let el = imageViewer.querySelector('.iv-edge-hint');
    if (!el) {
      el = document.createElement('div');
      el.className = 'iv-edge-hint';
      imageViewer.appendChild(el);
    }
    return el;
  }

  function showGalleryEdgeHint(text, tone = '') {
    const el = ensureGalleryEdgeHintEl();
    clearTimeout(galleryEdgeToastTimer);
    el.className = `iv-edge-hint ${tone || ''}`.trim();
    el.textContent = text;
    requestAnimationFrame(() => el.classList.add('visible'));
    galleryEdgeToastTimer = setTimeout(() => {
      el.classList.remove('visible');
    }, tone === 'error' ? 1900 : 1450);
  }

  function bounceGalleryEdge(dir) {
    if (imageViewer.classList.contains('hidden')) return;
    clearTimeout(galleryEdgeBounceTimer);
    const base = -galleryIndex * window.innerWidth;
    const offset = dir < 0 ? 42 : -42;
    ivStrip.style.transition = 'transform 0.16s ease-out';
    ivStrip.style.transform = `translateX(${base + offset}px)`;
    galleryEdgeBounceTimer = setTimeout(() => {
      setGalleryStripPosition(true);
    }, 130);
  }

  function setGalleryLoading(direction, value) {
    if (direction === 'before') galleryLoadingBefore = Boolean(value);
    else galleryLoadingAfter = Boolean(value);
    const loading = galleryLoadingBefore || galleryLoadingAfter;
    if (loading) ensureGalleryLoadingEl();
    imageViewer.classList.toggle('iv-is-loading', loading);
    updateGalleryArrows();
  }

  function appendGalleryMedia(direction, media = []) {
    const existing = new Set(galleryItems.map(galleryItemKey));
    const nextItems = [];
    for (const msg of media) {
      const item = galleryItemFromMessage(msg);
      const key = galleryItemKey(item);
      if (!item || existing.has(key)) continue;
      existing.add(key);
      nextItems.push(item);
    }
    if (!nextItems.length) return 0;

    if (direction === 'before') {
      galleryItems = [...nextItems, ...galleryItems];
      galleryIndex += nextItems.length;
      if (!imageViewer.classList.contains('hidden')) {
        ivStrip.insertAdjacentHTML('afterbegin', nextItems.map(gallerySlideHtml).join(''));
        setGalleryStripPosition(false);
      }
      return nextItems.length;
    }

    galleryItems = [...galleryItems, ...nextItems];
    if (!imageViewer.classList.contains('hidden')) {
      ivStrip.insertAdjacentHTML('beforeend', nextItems.map(gallerySlideHtml).join(''));
    }
    return nextItems.length;
  }

  async function loadGalleryDirection(direction, sessionId) {
    const chatId = gallerySourceChatId || currentChatId;
    const cursor = galleryEdgeCursor(direction);
    if (!chatId || !cursor) return false;
    if (direction === 'before' && !galleryHasMoreBefore) return false;
    if (direction === 'after' && !galleryHasMoreAfter) return false;

    setGalleryLoading(direction, true);
    galleryLoadErrors[direction] = false;
    try {
      let page = await readCachedGalleryMediaPage(chatId, direction, cursor);
      if (!page) {
        const params = new URLSearchParams({ limit: String(GALLERY_PREFETCH_COUNT) });
        params.set(direction, String(cursor));
        const raw = await api(`/api/chats/${chatId}/media?${params}`);
        page = normalizeMediaPage(raw);
        cacheGalleryMediaPage(chatId, direction, cursor, page);
      }
      if (sessionId !== gallerySessionId || imageViewer.classList.contains('hidden')) return false;
      if (direction === 'before' && typeof page.hasMoreBefore === 'boolean') galleryHasMoreBefore = page.hasMoreBefore;
      if (direction === 'after' && typeof page.hasMoreAfter === 'boolean') galleryHasMoreAfter = page.hasMoreAfter;
      const added = appendGalleryMedia(direction, page.media || []);
      updateGalleryArrows();
      preloadGalleryAssets();
      return added > 0;
    } catch (e) {
      galleryLoadErrors[direction] = true;
      return false;
    } finally {
      if (sessionId === gallerySessionId) setGalleryLoading(direction, false);
    }
  }

  function ensureGalleryBuffered(direction) {
    if (galleryLoadPromises[direction]) return galleryLoadPromises[direction];
    const sessionId = gallerySessionId;
    galleryLoadPromises[direction] = loadGalleryDirection(direction, sessionId)
      .finally(() => {
        if (gallerySessionId === sessionId) galleryLoadPromises[direction] = null;
      });
    return galleryLoadPromises[direction];
  }

  function cleanupGalleryPreloads() {
    galleryImagePreloads.clear();
    galleryVideoPreloads.forEach(video => {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.remove();
      } catch (e) {}
    });
    galleryVideoPreloads.clear();
  }

  function preloadGalleryAssets() {
    if (!galleryItems.length) return;
    const start = Math.max(0, galleryIndex - GALLERY_PREFETCH_COUNT);
    const end = Math.min(galleryItems.length, galleryIndex + GALLERY_PREFETCH_COUNT + 1);
    const nearby = galleryItems.slice(start, end);
    const imageUrls = nearby.filter(item => item.type === 'image').map(item => item.src);
    if (imageUrls.length) {
      try { window.cacheAssets?.(imageUrls).catch(() => {}); } catch (e) {}
      const wantedImages = new Set(imageUrls);
      imageUrls.forEach(url => {
        if (galleryImagePreloads.has(url)) return;
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
        galleryImagePreloads.set(url, img);
      });
      for (const key of [...galleryImagePreloads.keys()]) {
        if (galleryImagePreloads.size <= GALLERY_IMAGE_PRELOAD_LIMIT && wantedImages.has(key)) continue;
        galleryImagePreloads.delete(key);
      }
    }

    const videos = nearby
      .filter(item => item.type === 'video')
      .sort((a, b) => Math.abs(galleryItems.indexOf(a) - galleryIndex) - Math.abs(galleryItems.indexOf(b) - galleryIndex))
      .slice(0, GALLERY_VIDEO_PRELOAD_LIMIT);
    const wantedVideos = new Set(videos.map(item => item.src));
    videos.forEach(item => {
      if (galleryVideoPreloads.has(item.src)) return;
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.src = item.src;
      video.style.display = 'none';
      video.setAttribute('aria-hidden', 'true');
      document.body.appendChild(video);
      try { video.load(); } catch (e) {}
      galleryVideoPreloads.set(item.src, video);
    });
    for (const [src, video] of [...galleryVideoPreloads.entries()]) {
      if (wantedVideos.has(src)) continue;
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.remove();
      } catch (e) {}
      galleryVideoPreloads.delete(src);
    }
  }

  function queueGalleryBuffering() {
    if (imageViewer.classList.contains('hidden')) return;
    if (galleryIndex <= 1 && galleryHasMoreBefore) ensureGalleryBuffered('before');
    if (galleryItems.length - galleryIndex <= 2 && galleryHasMoreAfter) ensureGalleryBuffered('after');
  }

  function playCurrentGalleryVideo(delay = 0) {
    if (galleryItems[galleryIndex]?.type !== 'video') return;
    setTimeout(() => {
      ivStrip.querySelectorAll('.iv-slide')[galleryIndex]?.querySelector('video')?.play().catch(() => {});
    }, delay);
  }

  function moveGalleryToIndex(newIdx) {
    if (newIdx < 0 || newIdx >= galleryItems.length) return false;
    ivStrip.querySelectorAll('.iv-slide')[galleryIndex]?.querySelector('video')?.pause();
    ivResetZoom();
    galleryIndex = newIdx;
    setGalleryStripPosition(true);
    updateGalleryArrows();
    playCurrentGalleryVideo(350);
    preloadGalleryAssets();
    queueGalleryBuffering();
    return true;
  }

  function openMediaViewer(src, type = 'image') {
    gallerySessionId += 1;
    ivClearZoomTransition();
    mediaViewerSuppressClickUntil = 0;
    gallerySourceChatId = currentChatId;
    galleryLoadPromises = { before: null, after: null };
    galleryLoadErrors = { before: false, after: false };
    galleryLoadingBefore = false;
    galleryLoadingAfter = false;
    clearTimeout(galleryEdgeToastTimer);
    clearTimeout(galleryEdgeBounceTimer);
    imageViewer.querySelector('.iv-edge-hint')?.classList.remove('visible');
    cleanupGalleryPreloads();
    collectGalleryItems();
    const targetSrc = normalizeGallerySrc(src);
    galleryIndex = galleryItems.findIndex(item => normalizeGallerySrc(item.src) === targetSrc && item.type === type);
    if (galleryIndex < 0 && targetSrc) {
      galleryItems.push({ id: 0, chatId: currentChatId || 0, src: targetSrc, type, fileName: '', fileMime: '', fileSize: 0 });
      galleryIndex = galleryItems.length - 1;
    }
    if (galleryIndex < 0) galleryIndex = 0;
    galleryHasMoreBefore = Boolean(galleryEdgeCursor('before'));
    galleryHasMoreAfter = Boolean(galleryEdgeCursor('after'));
    renderGalleryStrip();
    ivScale = 1; ivPanX = 0; ivPanY = 0;
    setGalleryStripPosition(false);
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
    playCurrentGalleryVideo();
    preloadGalleryAssets();
    ensureGalleryBuffered('before');
    ensureGalleryBuffered('after');
  }
  // Backward-compat alias used by existing image click handlers
  function openImageViewer(src) { openMediaViewer(src, 'image'); }

  function closeMediaViewer() {
    if (imageViewer.classList.contains('hidden')) return;
    gallerySessionId += 1;
    ivClearZoomTransition();
    mediaViewerSuppressClickUntil = 0;
    ivStrip.querySelectorAll('video').forEach(v => v.pause());
    imageViewer.classList.add('hidden');
    imageViewer.classList.remove('iv-is-loading');
    galleryLoadPromises = { before: null, after: null };
    galleryLoadErrors = { before: false, after: false };
    galleryLoadingBefore = false;
    galleryLoadingAfter = false;
    clearTimeout(galleryEdgeToastTimer);
    clearTimeout(galleryEdgeBounceTimer);
    imageViewer.querySelector('.iv-edge-hint')?.classList.remove('visible');
    cleanupGalleryPreloads();
    if (ivHistoryPushed) {
      ivHistoryPushed = false;
      ivSkipNextPopstate = true;
      history.back();
    }
  }

  function updateGalleryArrows() {
    const prev = imageViewer.querySelector('.iv-prev');
    const next = imageViewer.querySelector('.iv-next');
    prev.style.display = (galleryIndex > 0 || galleryHasMoreBefore || galleryLoadingBefore) ? '' : 'none';
    next.style.display = (galleryIndex < galleryItems.length - 1 || galleryHasMoreAfter || galleryLoadingAfter) ? '' : 'none';
  }

  async function galleryNav(dir) {
    const newIdx = galleryIndex + dir;
    if (newIdx < 0 || newIdx >= galleryItems.length) {
      const direction = dir < 0 ? 'before' : 'after';
      const canLoad = direction === 'before' ? galleryHasMoreBefore : galleryHasMoreAfter;
      if (!canLoad && !galleryLoadPromises[direction]) {
        updateGalleryArrows();
        bounceGalleryEdge(dir);
        showGalleryEdgeHint(dir < 0 ? GALLERY_FIRST_TEXT : GALLERY_LAST_TEXT, direction);
        return;
      }
      setGalleryStripPosition(true);
      const added = await ensureGalleryBuffered(direction);
      if (!added) {
        updateGalleryArrows();
        bounceGalleryEdge(dir);
        showGalleryEdgeHint(
          galleryLoadErrors[direction] ? GALLERY_LOAD_ERROR_TEXT : (dir < 0 ? GALLERY_FIRST_TEXT : GALLERY_LAST_TEXT),
          galleryLoadErrors[direction] ? 'error' : direction
        );
        return;
      }
      const retryIdx = galleryIndex + dir;
      if (retryIdx < 0 || retryIdx >= galleryItems.length) return;
      moveGalleryToIndex(retryIdx);
      return;
    }
    moveGalleryToIndex(newIdx);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════════════════════
  // New chat modal
  async function openNewChatModal() {
    openModal('newChatModal', { replaceStack: true });
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
    openModal('adminModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
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
    openModal('settingsModal', { replaceStack: true });
    const adminItem = $('#settingsAdminPanel');
    if (currentUser.is_admin) adminItem.classList.remove('hidden');
    else adminItem.classList.add('hidden');
    const aiBotsItem = $('#settingsAiBotsPanel');
    if (currentUser.is_admin) aiBotsItem?.classList.remove('hidden');
    else aiBotsItem?.classList.add('hidden');
    const yandexAiItem = $('#settingsYandexAiPanel');
    if (currentUser.is_admin) yandexAiItem?.classList.remove('hidden');
    else yandexAiItem?.classList.add('hidden');
    $('#settingsSendEnter').checked = sendByEnter;
    $('#settingsScrollRestore').checked = scrollRestoreMode === 'restore';
    $('#settingsOpenLastChat').checked = openLastChatOnReload;
    window.BananzaVoiceHooks?.onSettingsOpened?.({ currentUser });
  }

  function openThemeSettingsModal() {
    openModal('themeSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
    renderThemePicker();
    setThemeStatus('');
  }

  function openAnimationSettingsModal() {
    openModal('animationSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
    renderModalAnimationOptions();
    renderModalAnimationSpeedControl();
    setModalAnimationStatus('');
  }

  function openWeatherSettingsModal() {
    openModal('weatherSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
    renderWeatherSettingsForm();
    if (!weatherSettingsLoaded) loadWeatherSettings().then(renderWeatherSettingsForm);
  }

  function openNotificationSettingsModal() {
    openModal('notificationSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
    renderNotificationSettingsForm();
    setNotificationStatus('');
    if (!notificationSettingsLoaded) {
      loadNotificationSettings().catch(() => {});
    } else {
      refreshPushDeviceState().catch(() => {});
    }
  }

  function openSoundSettingsModal() {
    openModal('soundSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
    renderSoundSettingsForm();
    setSoundStatus('');
    if (!soundSettingsLoaded) loadSoundSettings().catch(() => {});
  }

  function openAiBotSettingsModal() {
    if (!currentUser?.is_admin) return;
    openModal('aiBotSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
    setAiBotStatus('Загружаю...');
    loadAiBotState().then(() => setAiBotStatus('')).catch((e) => {
      setAiBotStatus(e.message || 'Не удалось загрузить AI-ботов', 'error');
    });
  }

  function openYandexAiSettingsModal() {
    if (!currentUser?.is_admin) return;
    openModal('yandexAiSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
    setYandexAiStatus('Loading...');
    loadYandexAiState().then(() => setYandexAiStatus('')).catch((e) => {
      setYandexAiStatus(e.message || 'Could not load Yandex AI bots', 'error');
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
    openModal('changePasswordModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
    resetChangePasswordFields();
    $('#cpError').textContent = '';
    $('#cpSuccess').textContent = '';
  }

  // Chat info modal
  async function openChatInfoModal() {
    if (!currentChatId) return;
    openModal('chatInfoModal', { replaceStack: true });

    const chat = chats.find(c => c.id === currentChatId);
    $('#chatInfoTitle').textContent = chat ? chat.name : 'Chat Info';
    syncChatInfoStatusVisibility(chat);

    // Sync compact view toggle
    $('#compactViewToggle').checked = compactView;
    await loadChatPreferences(currentChatId);
    renderChatPinSettingsForm(chat);

    // Group edit section
    const editSection = $('#chatEditSection');
    if (chat && !isNotesChat(chat) && (chat.type === 'group' || chat.type === 'general')) {
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
          const updated = await api(`/api/chats/${currentChatId}`, { method: 'PUT', body: { name } });
          applyChatUpdate(updated || {});
          closeAllModals();
        } catch (e) { alert(e.message); }
      };

      // Upload chat avatar
      $('#chatAvatarInput').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('avatar', file);
        try {
          const updated = await api(`/api/chats/${currentChatId}/avatar`, { method: 'POST', body: fd });
          applyChatUpdate(updated || {});
          refreshChatInfoPresentation(updated || {});
        } catch (e) { alert(e.message); }
      };

      // Remove chat avatar
      removeChatAvatarBtn.onclick = async () => {
        try {
          const updated = await api(`/api/chats/${currentChatId}/avatar`, { method: 'DELETE' });
          applyChatUpdate(updated || {});
          refreshChatInfoPresentation(updated || {});
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
            const updated = await api(`/api/chats/${currentChatId}/background`, { method: 'POST', body: fd });
            applyChatUpdate(updated || {});
            refreshChatInfoPresentation(updated || {});
          } catch (err) { alert(err.message); }
        };

        removeBgBtn.onclick = async () => {
          if (!confirm('Remove background?')) return;
          try {
            const updated = await api(`/api/chats/${currentChatId}/background`, { method: 'DELETE' });
            applyChatUpdate(updated || {});
            refreshChatInfoPresentation(updated || {});
          } catch (err) { alert(err.message); }
        };

        bgStyleSelect.onchange = async () => {
          try {
            const style = bgStyleSelect.value;
            const updated = await api(`/api/chats/${currentChatId}/background-style`, { method: 'PUT', body: { style } });
            applyChatUpdate(updated || {});
            refreshChatInfoPresentation(updated || {});
          } catch (err) { alert(err.message); }
        };
      }
    } catch (e) {}

    try {
      const members = await api(`/api/chats/${currentChatId}/members`);
      // Cache members for this chat so header can count per-chat online users
      try { chatMembersCache.set(currentChatId, members); } catch (e) {}
      const memberList = $('#chatMemberList');
      const ownerId = Number(chat?.created_by || 0);
      const canRemove = chat && chat.type === 'group' && (ownerId === Number(currentUser.id) || currentUser.is_admin);

      memberList.innerHTML = members.map(u => {
        const isOwner = ownerId && Number(u.id) === ownerId;
        return `
        <div class="user-list-item${isOwner ? ' chat-owner' : ''}" data-uid="${u.id}" data-bot="${u.is_ai_bot ? 1 : 0}">
          <div class="member-avatar-wrap${isOwner ? ' is-owner' : ''}" title="${isOwner ? 'Chat creator' : ''}">
            ${avatarHtml(u.display_name, u.avatar_color, u.avatar_url)}
            ${isOwner ? '<span class="member-owner-crown" aria-label="Chat creator" title="Chat creator">&#128081;</span>' : ''}
          </div>
          <div>
            <div class="name">${esc(u.display_name)}</div>
            <div class="admin-user-status ${u.is_ai_bot ? 'bot' : (onlineUsers.has(u.id) ? 'online' : 'offline')}">
              <span class="status-dot"></span>${u.is_ai_bot ? 'bot' : (onlineUsers.has(u.id) ? 'online' : 'offline')}
            </div>
          </div>
          ${canRemove && u.id !== currentUser.id ? `<button class="member-remove" data-uid="${u.id}" title="Remove">✕</button>` : ''}
        </div>
      `;
      }).join('');

      // Update status indicators in modal
      try { refreshChatMemberStatuses(); } catch (e) {}
      try { refreshChatInfoStatus(); } catch (e) {}

      // Remove member handlers
      memberList.querySelectorAll('.member-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Remove this member?')) return;
          try {
            await api(`/api/chats/${currentChatId}/members/${btn.dataset.uid}`, { method: 'DELETE' });
            // Invalidate cached members for this chat and refresh modal
            try { chatMembersCache.delete(currentChatId); } catch (e) {}
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
              // Invalidate cached members for this chat and refresh modal
              try { chatMembersCache.delete(currentChatId); } catch (e) {}
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
    hideFloatingMessageActions({ immediate: true });
    openModal('menuDrawer', { replaceStack: true });

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
        applyUserUpdate(res.user || {});
      } catch (e) { alert(e.message); }
    });

    // Remove avatar
    $('#removeProfileAvatar').addEventListener('click', async () => {
      try {
        const res = await api('/api/profile/avatar', { method: 'DELETE' });
        applyUserUpdate(res.user || { id: currentUser.id, avatar_url: null });
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
        applyUserUpdate(res.user || {});
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

  function animateBackButton() {
    if (!backBtn) return;
    backBtn.classList.remove('is-spinning');
    void backBtn.offsetWidth;
    backBtn.classList.add('is-spinning');
    clearTimeout(backBtn.__spinTimer);
    backBtn.__spinTimer = setTimeout(() => {
      backBtn.classList.remove('is-spinning');
    }, 230);
  }

  function animateChatHeaderActionButton(buttonOrSelector) {
    const button = typeof buttonOrSelector === 'string' ? $(buttonOrSelector) : buttonOrSelector;
    if (!button) return;
    button.classList.remove('is-spinning');
    void button.offsetWidth;
    button.classList.add('is-spinning');
    clearTimeout(button.__spinTimer);
    button.__spinTimer = setTimeout(() => {
      button.classList.remove('is-spinning');
    }, 380);
  }

  function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  function cancelPendingSidebarReveal() {
    if (!sidebar?.__revealFrame) return;
    cancelAnimationFrame(sidebar.__revealFrame);
    sidebar.__revealFrame = 0;
  }

  function revealSidebarFromChat({ forceAnimation = false } = {}) {
    if (!sidebar) return;
    hideFloatingMessageActions({ immediate: true });
    cancelPendingSidebarReveal();
    sidebar.classList.remove('sidebar-no-transition');

    if (prefersReducedMotion()) {
      sidebar.classList.remove('sidebar-hidden');
      return;
    }

    if (!sidebar.classList.contains('sidebar-hidden')) {
      if (!forceAnimation) return;
      sidebar.classList.add('sidebar-no-transition');
      sidebar.classList.add('sidebar-hidden');
      void sidebar.offsetWidth;
      sidebar.classList.remove('sidebar-no-transition');
    } else {
      void sidebar.offsetWidth;
    }

    sidebar.__revealFrame = requestAnimationFrame(() => {
      sidebar.classList.remove('sidebar-hidden');
      sidebar.__revealFrame = 0;
    });
  }

  function navigateBackToChatList() {
    hideFloatingMessageActions({ immediate: true });
    if (history.state && history.state.chat) {
      history.back();
      return;
    }
    revealSidebarFromChat({ forceAnimation: true });
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
    setupMessageSwipeGestures();
    ensureSearchPanelReady();

    // Send message
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sendBtn.blur();
      sendMessage();
      // Keep keyboard open on mobile
      if (window.innerWidth <= 768) msgInput.focus();
    });
    mentionOpenBtn?.addEventListener('mousedown', (e) => {
      if (typeof e.button === 'number' && e.button !== 0) return;
      e.preventDefault();
    });
    mentionOpenBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      openMentionPickerFromButton();
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
      syncMentionOpenButton();
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
      positionMessageActionSurfaces();
      scheduleRetryLayout();
    });
    window.visualViewport?.addEventListener('scroll', () => {
      positionMentionPicker();
      positionAvatarUserMenu(avatarUserMenuState?.anchor);
      positionMessageActionSurfaces();
    });
    window.addEventListener('resize', () => {
      positionMessageActionSurfaces();
      scheduleRetryLayout();
    });
    document.addEventListener('pointerdown', (e) => {
      const picker = $('#mentionPicker');
      if (!picker || picker.classList.contains('hidden')) return;
      if (picker.contains(e.target) || e.target === msgInput || e.target.closest('#mentionOpenBtn')) return;
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
    syncMentionOpenButton();
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
      if (Date.now() < mediaViewerSuppressClickUntil && e.target.closest('.iv-slide')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.target.closest('.iv-prev')) { galleryNav(-1); return; }
      if (e.target.closest('.iv-next')) { galleryNav(1); return; }
      if (e.target.closest('.iv-close')) closeMediaViewer();
    });
    imageViewer.addEventListener('dblclick', (e) => {
      if (imageViewer.classList.contains('hidden')) return;
      if (e.target.closest('.iv-prev, .iv-next, .iv-close, video')) return;
      const slide = e.target.closest('.iv-slide');
      if (!slide || slide.classList.contains('iv-slide-video')) return;
      e.preventDefault();
      e.stopPropagation();
      ivToggleZoomAt(e.clientX, e.clientY);
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
        const touchedSlide = e.target.closest('.iv-slide');
        const isImageSlideTouch = Boolean(touchedSlide && !touchedSlide.classList.contains('iv-slide-video'));
        const canImageZoomTouch = isImageSlideTouch && galleryItems[galleryIndex]?.type !== 'video';
        if (e.touches.length === 2) {
          // Pinch zoom for images only
          if (canImageZoomTouch) {
            ivClearZoomTransition();
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
            canImageZoomTouch &&
            now - lastTapTime < 300 &&
            Math.abs(tx - lastTapX) < 40 &&
            Math.abs(ty - lastTapY) < 40
          ) {
            lastTapTime = 0;
            mediaViewerSuppressClickUntil = Date.now() + 450;
            ivToggleZoomAt(tx, ty);
            return;
          }
          lastTapTime = canImageZoomTouch ? now : 0;
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
          ivClearZoomTransition();
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

    // Reaction picker + extra emoji popover
    const isReactionScrollSurface = (target) => Boolean(target?.closest?.(
      '.reaction-picker-strip, .reaction-emoji-tabs, .reaction-emoji-grid'
    ));
    const keepReactionInteractionFromBlurringInput = (e) => {
      if (e.type === 'touchstart' || e.type === 'touchmove' || isReactionScrollSurface(e.target)) {
        if (isMobileComposerKeyboardOpen()) reactionPickerKeepKeyboard = true;
        return;
      }
      if (preventMobileComposerBlur(e)) reactionPickerKeepKeyboard = true;
    };
    const markReactionInteraction = (e) => {
      keepReactionInteractionFromBlurringInput(e);
      bumpReactionPickerIdleTimer();
    };

    reactionPicker.addEventListener('pointerdown', (e) => {
      markReactionInteraction(e);
      e.stopPropagation();
    });
    reactionPicker.addEventListener('pointerup', (e) => {
      const moreBtn = e.target.closest('.reaction-more-button');
      if (!moreBtn || !reactionPicker.contains(moreBtn)) return;
      e.preventDefault();
      e.stopPropagation();
      markReactionInteraction(e);
      handleReactionMoreButton(moreBtn);
    });
    reactionPicker.addEventListener('touchstart', (e) => {
      markReactionInteraction(e);
    }, { passive: true });
    reactionPicker.addEventListener('touchmove', (e) => {
      markReactionInteraction(e);
    }, { passive: true });
    reactionPicker.addEventListener('mousedown', (e) => {
      markReactionInteraction(e);
      if (!isReactionScrollSurface(e.target)) e.preventDefault();
      e.stopPropagation();
    });
    reactionPicker.addEventListener('wheel', () => bumpReactionPickerIdleTimer(), { passive: true });
    reactionPicker.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.target.closest('button[data-reaction-action]');
      if (!btn || !reactionPickerMsgId) return;
      const action = btn.dataset.reactionAction || 'toggle';
      const keepComposerFocus = reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen();
      if (action === 'open-emoji-popover') {
        e.preventDefault();
        if (Date.now() >= reactionMorePointerHandledUntil) handleReactionMoreButton(btn);
        return;
      }
      if (!btn.dataset.emoji) return;
      toggleReaction(reactionPickerMsgId, btn.dataset.emoji, { keepComposerFocus });
    });

    reactionEmojiPopover?.addEventListener('pointerdown', (e) => {
      markReactionInteraction(e);
      e.stopPropagation();
    });
    reactionEmojiPopover?.addEventListener('touchstart', (e) => {
      markReactionInteraction(e);
    }, { passive: true });
    reactionEmojiPopover?.addEventListener('touchmove', (e) => {
      markReactionInteraction(e);
    }, { passive: true });
    reactionEmojiPopover?.addEventListener('mousedown', (e) => {
      markReactionInteraction(e);
      if (!isReactionScrollSurface(e.target)) e.preventDefault();
      e.stopPropagation();
    });
    reactionEmojiPopover?.addEventListener('wheel', () => bumpReactionPickerIdleTimer(), { passive: true });
    reactionEmojiPopover?.addEventListener('click', (e) => {
      e.stopPropagation();
      const tab = e.target.closest('.reaction-emoji-tab');
      if (tab) {
        reactionEmojiPopoverCategory = tab.dataset.category || reactionEmojiPopoverCategory;
        renderReactionEmojiPopoverContent();
        positionReactionEmojiPopover();
        bumpReactionPickerIdleTimer();
        return;
      }

      const item = e.target.closest('.reaction-emoji-item');
      if (!item || !reactionPickerMsgId) return;
      const keepComposerFocus = reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen();
      toggleReaction(reactionPickerMsgId, item.dataset.emoji, { keepComposerFocus });
    });

    document.addEventListener('click', (e) => {
      const insideFloatingActions =
        reactionPicker.contains(e.target)
        || reactionEmojiPopover?.contains(e.target)
        || e.target.closest('.msg-actions');
      if (!insideFloatingActions && !e.target.closest('.msg-react-btn')) {
        if (activeMessageActionsRow || isFloatingSurfaceVisible(reactionPicker) || isFloatingSurfaceVisible(reactionEmojiPopover)) {
          hideFloatingMessageActions();
        }
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
    }, { passive: true });
    const getMessageActionTapRow = (e) => {
      if (e.defaultPrevented || Date.now() < suppressNextMessageActionTapUntil) return null;
      if (e.target.closest(
        '.msg-actions, button, a, input, textarea, select, label, audio, video, .msg-reply, .reaction-badge, .msg-image, .msg-video, .msg-file, .link-preview, .msg-group-avatar'
      )) return null;
      const row = e.target.closest('.msg-row');
      if (!row || row.dataset.outbox === '1' || row.querySelector('.msg-deleted')) return null;
      return row;
    };
    messagesEl.addEventListener('click', (e) => {
      if (Date.now() < suppressNextMessageActionTapUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const reactBtn = e.target.closest('.msg-react-btn');
      if (reactBtn) {
        e.stopPropagation();
        const row = reactBtn.closest('.msg-row') || (activeMessageActionsEl?.contains(reactBtn) ? activeMessageActionsRow : null);
        if (row) {
          const keepComposerFocus = reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen();
          showReactionPicker(row, reactBtn, { source: 'actions', keepComposerFocus });
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
        return;
      }
      const row = getMessageActionTapRow(e);
      if (row) {
        e.stopPropagation();
        showMessageActions(row, { toggle: true });
      }
    });

    // Long press/right-click on a message opens reactions directly.
    (() => {
      let lpTimer = null;
      let lpStart = null;
      const clearLongPress = () => {
        clearTimeout(lpTimer);
        lpTimer = null;
        lpStart = null;
      };
      messagesEl.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const row = e.target.closest('.msg-row');
        if (!row || e.target.closest(
          '.msg-actions, button, a, input, textarea, select, label, audio, video, .msg-reply, .reaction-badge, .msg-image, .msg-video, .msg-file, .link-preview, .msg-group-avatar'
        )) return;
        const touch = e.touches && e.touches[0] ? e.touches[0] : null;
        lpStart = { row, x: touch?.clientX || 0, y: touch?.clientY || 0 };
        lpTimer = setTimeout(() => {
          lpTimer = null;
          suppressNextMessageActionTap();
          navigator.vibrate?.(30);
          showReactionPicker(row, null, {
            source: 'long-press',
            keepComposerFocus: reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen(),
          });
        }, 500);
      }, { passive: true });
      messagesEl.addEventListener('touchend', clearLongPress, { passive: true });
      messagesEl.addEventListener('touchcancel', clearLongPress, { passive: true });
      messagesEl.addEventListener('touchmove', (e) => {
        if (!lpStart || e.touches.length !== 1) return;
        const touch = e.touches[0];
        if (Math.hypot(touch.clientX - lpStart.x, touch.clientY - lpStart.y) > 10) clearLongPress();
      }, { passive: true });
      // Desktop right-click
      messagesEl.addEventListener('contextmenu', (e) => {
        const row = e.target.closest('.msg-row');
        if (e.target.closest(
          '.msg-actions, button, a, input, textarea, select, label, audio, video, .msg-reply, .reaction-badge, .msg-image, .msg-video, .msg-file, .link-preview, .msg-group-avatar'
        )) return;
        if (!row) return;
        e.preventDefault();
        showReactionPicker(row, null, {
          source: 'long-press',
          keepComposerFocus: reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen(),
        });
      });
    })();

    (() => {
      chatContextMenu?.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });
      chatContextMenu?.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      chatContextMenu?.addEventListener('touchstart', (e) => {
        e.stopPropagation();
      }, { passive: true });
      chatContextMenu?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const btn = e.target.closest('.chat-context-menu-button[data-chat-action]');
        if (!btn || btn.disabled || !chatContextMenuState?.chatId) return;
        const chatId = Number(chatContextMenuState.chatId || 0);
        const action = btn.dataset.chatAction || '';
        hideChatContextMenu();
        await handleChatContextMenuAction(action, chatId);
      });
      chatContextMenuBackdrop?.addEventListener('click', () => {
        if (Date.now() < suppressChatContextDismissUntil) return;
        hideChatContextMenu();
      });
      chatContextMenuBackdrop?.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (Date.now() < suppressChatContextDismissUntil) return;
        hideChatContextMenu();
      });
      chatList.addEventListener('scroll', () => {
        if (isFloatingSurfaceVisible(chatContextMenu)) hideChatContextMenu({ immediate: true });
      }, { passive: true });
      const syncChatContextMenuLayout = () => {
        if (!isFloatingSurfaceVisible(chatContextMenu)) return;
        positionChatContextMenu();
      };
      window.addEventListener('resize', syncChatContextMenuLayout, { passive: true });
      window.visualViewport?.addEventListener('resize', syncChatContextMenuLayout);
      window.visualViewport?.addEventListener('scroll', syncChatContextMenuLayout);
      let startPoint = null;
      chatList.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const row = e.target.closest('.chat-item[data-chat-id]');
        if (!row || !chatList.contains(row) || e.target.closest('button, a, input, textarea, select, label')) return;
        const touch = e.touches[0];
        startPoint = { x: touch.clientX, y: touch.clientY };
        chatContextLongPressStart = startPoint;
        chatContextLongPressRow = row;
        clearTimeout(chatContextLongPressTimer);
        chatContextLongPressTimer = setTimeout(() => {
          chatContextLongPressTimer = null;
          suppressNextChatItemTap();
          suppressChatContextDismissUntil = Date.now() + 550;
          navigator.vibrate?.(30);
          showChatContextMenuForRow(row, {
            x: startPoint?.x,
            y: startPoint?.y,
            source: 'long-press',
          });
        }, CHAT_CONTEXT_LONG_PRESS_MS);
      }, { passive: true });
      chatList.addEventListener('touchmove', (e) => {
        if (!startPoint || e.touches.length !== 1) return;
        const touch = e.touches[0];
        if (Math.hypot(touch.clientX - startPoint.x, touch.clientY - startPoint.y) > 10) {
          clearChatContextLongPress();
          startPoint = null;
        }
      }, { passive: true });
      chatList.addEventListener('touchend', () => {
        clearChatContextLongPress();
        startPoint = null;
      }, { passive: true });
      chatList.addEventListener('touchcancel', () => {
        clearChatContextLongPress();
        startPoint = null;
      }, { passive: true });
      chatList.addEventListener('contextmenu', (e) => {
        const row = e.target.closest('.chat-item[data-chat-id]');
        if (!row || !chatList.contains(row) || e.target.closest('button, a, input, textarea, select, label')) return;
        e.preventDefault();
        showChatContextMenuForRow(row, {
          x: e.clientX,
          y: e.clientY,
          source: 'contextmenu',
        });
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
    backBtn?.addEventListener('click', () => {
      if (hasOpenModal()) {
        closeTopModal();
        return;
      }
      if (isSearchPanelOpen()) {
        closeSearchPanel();
        return;
      }
      if (backBtn.__isNavigating) return;
      const finishBackNavigation = () => {
        navigateBackToChatList();
        clearTimeout(backBtn.__spinTimer);
        backBtn.classList.remove('is-spinning');
        backBtn.__isNavigating = false;
      };
      backBtn.__isNavigating = true;
      clearTimeout(backBtn.__navTimer);
      if (prefersReducedMotion()) {
        finishBackNavigation();
        return;
      }
      animateBackButton();
      backBtn.__navTimer = setTimeout(finishBackNavigation, 120);
    });

    // Android back gesture / button
    window.addEventListener('popstate', () => {
      if (modalSkipPopstateCount > 0) {
        modalSkipPopstateCount -= 1;
        return;
      }
      if (searchPanelSkipNextPopstate) {
        searchPanelSkipNextPopstate = false;
        const shouldRestoreFocus = !searchPanelPendingAction;
        if (shouldRestoreFocus) {
          focusElementIfPossible(searchPanelReturnFocusEl || $('#searchBtn'));
        }
        searchPanelReturnFocusEl = null;
        flushSearchPanelPendingAction();
        return;
      }
      if (ivSkipNextPopstate) {
        ivSkipNextPopstate = false;
        return;
      }
      if (hasOpenModal()) {
        closeTopModal({ fromHistory: true });
        return;
      }
      if (isSearchPanelOpen()) {
        closeSearchPanel({ fromHistory: true });
        return;
      }
      if (!imageViewer.classList.contains('hidden')) {
        gallerySessionId += 1;
        ivStrip.querySelectorAll('video').forEach(v => v.pause());
        imageViewer.classList.add('hidden');
        imageViewer.classList.remove('iv-is-loading');
        galleryLoadPromises = { before: null, after: null };
        galleryLoadErrors = { before: false, after: false };
        galleryLoadingBefore = false;
        galleryLoadingAfter = false;
        clearTimeout(galleryEdgeToastTimer);
        clearTimeout(galleryEdgeBounceTimer);
        imageViewer.querySelector('.iv-edge-hint')?.classList.remove('visible');
        cleanupGalleryPreloads();
        ivHistoryPushed = false;
        return;
      }
      if (window.innerWidth <= 768) {
        if (sidebar.classList.contains('sidebar-hidden')) {
          // Going back from chat to chat list
          revealSidebarFromChat();
        } else {
          // Already on chat list — push state back to prevent exit
          history.pushState({ view: 'chatlist' }, '');
        }
      }
    });

    // New chat
    $('#newChatBtn').addEventListener('click', openNewChatModal);
    $('#refreshChatsBtn')?.addEventListener('click', async () => {
      animateChatHeaderActionButton('#refreshChatsBtn');
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
      btn.addEventListener('click', (e) => {
        const modal = e.currentTarget.closest('.modal');
        if (!modal) return;
        closeModal(modal.id);
      });
    });
    $$('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        const entry = modalEntryOf(modal.id);
        if (!entry?.closeOnBackdrop) return;
        if (e.target === modal && getTopModal()?.id === modal.id) closeModal(modal.id);
      });
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
    $('#settingsAnimationPanel')?.addEventListener('click', openAnimationSettingsModal);
    $('#settingsWeatherPanel').addEventListener('click', openWeatherSettingsModal);
    $('#settingsNotificationsPanel')?.addEventListener('click', openNotificationSettingsModal);
    $('#settingsSoundsPanel')?.addEventListener('click', openSoundSettingsModal);
    $('#settingsAiBotsPanel')?.addEventListener('click', openAiBotSettingsModal);
    $('#settingsYandexAiPanel')?.addEventListener('click', openYandexAiSettingsModal);
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
    $('#settingsAnimationOptions')?.addEventListener('click', (e) => {
      const card = e.target.closest('[data-modal-animation-style]');
      if (!card) return;
      selectModalAnimation(card.dataset.modalAnimationStyle);
    });
    $('#settingsAnimationSpeed')?.addEventListener('input', (e) => {
      updateModalAnimationSpeed(e.target.value, { immediate: false });
    });
    $('#settingsAnimationSpeed')?.addEventListener('change', (e) => {
      updateModalAnimationSpeed(e.target.value, { immediate: true });
    });
    $('#settingsAnimationSpeed')?.addEventListener('blur', (e) => {
      updateModalAnimationSpeed(e.target.value, { immediate: true });
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
    ['settingsNotifyMessages', 'settingsNotifyChatInvites', 'settingsNotifyReactions', 'settingsNotifyPins', 'settingsNotifyMentions'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => saveNotificationSettings());
    });

    // Sound settings
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
    $('#aiBotsRefreshModels')?.addEventListener('click', () => {
      setAiModelStatus('Загружаю модели...');
      loadAiModelOptions(true).catch((e) => setAiModelStatus(e.message || 'Не удалось загрузить модели', 'error'));
    });
    $('#aiBotsDeleteKey')?.addEventListener('click', deleteAiBotKey);
    $('#aiBotCreateNew')?.addEventListener('click', () => {
      fillAiBotForm(null);
      setAiBotStatus('Новый бот: заполните поля и сохраните');
    });
    $('#aiBotSave')?.addEventListener('click', saveAiBot);
    $('#aiBotDisable')?.addEventListener('click', disableAiBot);
    $('#aiBotTest')?.addEventListener('click', testAiBot);
    $('#aiBotExportJson')?.addEventListener('click', exportAiBotJson);
    $('#aiBotImportJson')?.addEventListener('click', () => $('#aiBotImportFile')?.click());
    $('#aiBotImportFile')?.addEventListener('change', (event) => importAiBotJsonFile(event.target.files?.[0]));
    $('#aiBotAvatarInput')?.addEventListener('change', (event) => uploadAiBotAvatar(event.target.files?.[0]));
    $('#removeAiBotAvatar')?.addEventListener('click', removeAiBotAvatar);
    $('#aiBotName')?.addEventListener('input', () => {
      if (!currentAiBot()?.avatar_url) renderAiBotAvatar(currentAiBot());
    });
    $('#aiBotList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-bot-list-item');
      if (!btn) return;
      const bot = aiBotState.bots.find(item => item.id === Number(btn.dataset.botId));
      if (bot) fillAiBotForm(bot);
    });
    $('#aiBotChatSelect')?.addEventListener('change', renderAiChatBotSettings);
    $('#aiBotChatBotSelect')?.addEventListener('change', renderAiChatBotSettings);
    $('#aiBotChatSave')?.addEventListener('click', saveAiChatBotSettings);

    // Yandex AI bot admin settings
    $('#yandexAiSaveSettings')?.addEventListener('click', saveYandexAiSettings);
    $('#yandexAiTestConnection')?.addEventListener('click', testYandexAiConnection);
    $('#yandexAiRefreshModels')?.addEventListener('click', refreshYandexAiModels);
    $('#yandexAiDeleteKey')?.addEventListener('click', deleteYandexAiKey);
    $('#yandexAiBotCreateNew')?.addEventListener('click', () => {
      fillYandexBotForm(null);
      setYandexAiStatus('New Yandex bot: fill fields and save');
    });
    $('#yandexAiBotSave')?.addEventListener('click', saveYandexBot);
    $('#yandexAiBotDisable')?.addEventListener('click', disableYandexBot);
    $('#yandexAiBotTest')?.addEventListener('click', testYandexBot);
    $('#yandexAiBotExportJson')?.addEventListener('click', exportYandexBotJson);
    $('#yandexAiBotImportJson')?.addEventListener('click', () => $('#yandexAiBotImportFile')?.click());
    $('#yandexAiBotImportFile')?.addEventListener('change', (event) => importYandexBotJsonFile(event.target.files?.[0]));
    $('#yandexAiBotAvatarInput')?.addEventListener('change', (event) => uploadYandexBotAvatar(event.target.files?.[0]));
    $('#removeYandexAiBotAvatar')?.addEventListener('click', removeYandexBotAvatar);
    $('#yandexAiBotName')?.addEventListener('input', () => {
      if (!currentYandexBot()?.avatar_url) renderYandexBotAvatar(currentYandexBot());
    });
    $('#yandexAiBotList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-bot-list-item');
      if (!btn) return;
      const bot = yandexBotState.bots.find(item => Number(item.id) === Number(btn.dataset.botId));
      if (bot) fillYandexBotForm(bot);
    });
    $('#yandexAiBotChatSelect')?.addEventListener('change', renderYandexChatBotSettings);
    $('#yandexAiBotChatBotSelect')?.addEventListener('change', renderYandexChatBotSettings);
    $('#yandexAiBotChatSave')?.addEventListener('click', saveYandexChatBotSettings);

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
    $('#chatInfoBtn').addEventListener('click', () => {
      animateChatHeaderActionButton('#chatInfoBtn');
      openChatInfoModal();
    });

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
    $('#chatAllowUnpinAnyPinToggle')?.addEventListener('change', () => saveChatPinSettings());

    // Logout
    $('#logoutBtn').addEventListener('click', () => { if (confirm('Logout?')) logout(); });

    // Load more
    loadMoreBtn.addEventListener('click', loadMore);
    scrollBottomBtn?.addEventListener('mousedown', (e) => e.preventDefault());
    scrollBottomBtn?.addEventListener('click', () => {
      scrollBottomBtn.blur();
      scrollToBottom(false, true);
    });

    // Scroll to load more
    messagesEl.addEventListener('scroll', () => {
      hideAvatarUserMenu();
      hideFloatingMessageActions({ immediate: true });
      if (!suppressScrollAnchorSave && !loadingMore && !loadingMoreAfter) scheduleScrollAnchorSave();
      maybeLoadMoreAtTop();
      maybeLoadMoreAtBottom();
      if (!suppressScrollAnchorSave && isNearBottom(8)) markCurrentChatReadIfAtBottom();
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
    $('#searchBtn').addEventListener('click', () => {
      animateChatHeaderActionButton('#searchBtn');
      openSearchPanel();
    });
    $('#searchClose').addEventListener('click', () => closeSearchPanel());
    searchInput.addEventListener('input', () => performSearch());
    searchAllChatsToggle?.addEventListener('change', () => {
      if (!currentChatId) {
        searchAllChats = false;
        renderSearchScopeToggle();
        if (searchInput.value.trim().length >= 2) performSearch({ immediate: true });
        return;
      }
      searchAllChats = !!searchAllChatsToggle.checked;
      if (searchInput.value.trim().length >= 2) {
        performSearch({ immediate: true });
      } else {
        clearSearchResults();
      }
    });
    searchPanel?.addEventListener('click', (e) => {
      if (e.target === searchPanel) closeSearchPanel();
    });

    // Drag & drop
    chatView.addEventListener('dragenter', handleDragEnter);
    chatView.addEventListener('dragover', handleDragOver);
    chatView.addEventListener('dragleave', handleDragLeave);
    chatView.addEventListener('drop', handleDrop);

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isFloatingSurfaceVisible(chatContextMenu)) {
          e.preventDefault();
          hideChatContextMenu();
          return;
        }
        if (hasOpenModal()) {
          e.preventDefault();
          closeTopModal();
          return;
        }
        if (isSearchPanelOpen()) {
          e.preventDefault();
          closeSearchPanel();
          return;
        }
        hideAvatarUserMenu();
        clearReply();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════
  async function init() {
    if (!checkAuth()) return;
    hydrateChatListCache();

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
      applyModalAnimation(currentUser.ui_modal_animation);
      applyModalAnimationSpeed(currentUser.ui_modal_animation_speed);
      localStorage.setItem('user', JSON.stringify(currentUser));
      await window.messageCache?.init?.(currentUser.id);
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

    registerBuiltinModals();
    setupEvents();
    setupProfileEvents();
    initEmojiPicker();
    connectWS();
    await loadChats();
    initialChatLoadFinished = true;
    setupLifecycleRecovery();
    loadAllUsers().catch(() => {});

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
