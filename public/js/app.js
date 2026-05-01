(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIG
  // ═══════════════════════════════════════════════════════════════════════════
  const WS_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
  const PAGE_SIZE = 50;
  const MESSAGE_CACHE_LIMIT = 800;
  const MESSAGE_BACKGROUND_SYNC_CONCURRENCY = 2;
  const MESSAGE_BACKGROUND_SYNC_MAX_CHATS = 6;
  const MESSAGE_BACKGROUND_SYNC_MAX_PAGES = 3;
  const MENTION_PICKER_TAP_DEAD_ZONE = 10;
  const MAX_MSG = 5000;
  const MAX_ATTACHMENTS = 10;
  const MAX_FILE_SIZE = 1024 * 1024 * 1024;
  const MAX_FILE_SIZE_LABEL = '1 GB';
  const VIDEO_POSTER_MIME = 'image/jpeg';
  const VIDEO_POSTER_MAX_DIMENSION = 960;
  const VIDEO_POSTER_QUALITY = 0.82;
  const VIDEO_POSTER_CAPTURE_TIMEOUT_MS = 8000;
  const VIDEO_POSTER_CAPTURE_SEEKS = Object.freeze([0, 0.05, 0.12, 0.25]);
  const POLL_MIN_OPTIONS = 2;
  const POLL_MAX_OPTIONS = 10;
  const POLL_CLOSE_PRESET_MS = Object.freeze({
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  });
  const IMAGE_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif', 'image/bmp',
  ]);
  const AUDIO_MIME_TYPES = new Set([
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg',
    'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/x-flac',
  ]);
  const VIDEO_MIME_TYPES = new Set([
    'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg', 'video/x-m4v',
  ]);
  const IMAGE_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.bmp',
  ]);
  const AUDIO_EXTENSIONS = new Set([
    '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.weba',
  ]);
  const VIDEO_EXTENSIONS = new Set([
    '.mp4', '.webm', '.mov', '.ogv', '.m4v',
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
  const UI_VISUAL_MODES = [
    { id: 'classic', name: 'Off', note: 'Classic flat theme surfaces.' },
    { id: 'rich', name: 'On', note: 'Layered gradients, glass cards and theme-colored glow.' },
  ];
  const UI_VISUAL_MODE_IDS = new Set(UI_VISUAL_MODES.map(mode => mode.id));
  const POLL_STYLES = [
    { id: 'pulse', name: 'Pulse', note: 'Hero gradients and bold result cards', accent: ['var(--accent)', 'var(--link)'] },
    { id: 'stack', name: 'Stack', note: 'Compact rows with dense readable stats', accent: ['var(--border-light)', 'var(--accent)'] },
    { id: 'orbit', name: 'Orbit', note: 'Mini chart with colorful legend blocks', accent: ['var(--link)', 'var(--success)'] },
  ];
  const POLL_STYLE_IDS = new Set(POLL_STYLES.map((style) => style.id));
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
  const MOBILE_FONT_SIZE_DEFAULT = 5;
  const MOBILE_FONT_SIZE_MIN = 1;
  const MOBILE_FONT_SIZE_MAX = 10;
  const MOBILE_FONT_SIZE_PERCENTS = Object.freeze({
    1: 84,
    2: 88,
    3: 92,
    4: 96,
    5: 100,
    6: 104,
    7: 108,
    8: 112,
    9: 116,
    10: 120,
  });
  const MODAL_TRANSITION_BUFFER_MS = 80;
  const CHAT_LIST_CACHE_VERSION = 3;
  const CHAT_LIST_CACHE_SYNC_DEBOUNCE_MS = 250;
  const CHAT_LIST_REQUEST_TIMEOUT_MS = 9000;
  const RECOVERY_SYNC_MIN_INTERVAL_MS = 1200;
  const RECOVERY_CATCHUP_MAX_PAGES = 5;
  const PAGINATION_FETCH_MAX_PAGES = 6;
  const PAGINATION_TOP_THRESHOLD = 120;
  const PAGINATION_BOTTOM_THRESHOLD = 120;
  const CHAT_LIST_PULL_TRIGGER_PX = 10;
  const CHAT_LIST_PULL_THRESHOLD = 64;
  const CHAT_LIST_PULL_MAX_OFFSET = 96;
  const CHAT_LIST_PULL_REFRESH_OFFSET = 56;
  const RESUME_WS_REFRESH_AFTER_MS = 25000;
  const NOTES_CHAT_EMOJI = '📝';
  const CHAT_CONTEXT_LONG_PRESS_MS = 500;
  const aiImageRiskApi = window.BananzaAiImageRisk || null;

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
  let hiddenChatSearchTimer = null;
  let hiddenChatSearchSeq = 0;
  let hiddenChatSearchQuery = '';
  let hiddenChatSearchResults = [];
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
  let pollComposerOptions = ['', ''];
  let pollVotePending = new Set();
  let pollClosePending = new Set();
  let pollVotersState = null;
  const PULSE_INLINE_VOTER_LIMIT = 5;
  const PULSE_VOTER_POPOVER_AUTOHIDE_MS = 5000;
  const PULSE_PREVIEW_AVATAR_COLORS = Object.freeze(['#6f7f95', '#758cab', '#6a879b', '#8276a8', '#748b85']);
  let pulseInlineVotersCache = new Map();
  let pulseInlineVotersPending = new Map();
  let pulseInlineVotersRevision = new Map();
  let expandedPulseVoterOptions = new Set();
  let activePulseVoterPopover = null;
  let outboxObjectUrls = new Map();
  let outboxSending = new Set();
  let pendingVideoPosterBackfills = new Map();
  let failedVideoPosterBackfills = new Set();
  let retryLayoutTimer = null;
  let typingSendTimeout = null;
  let typingDisplayTimeouts = {};
  let displayedMsgIds = new Set();
  let displayedPinEventIds = new Set();
  let replyTo = null; // { id, display_name, text }
  let grokImageRiskConfirmResolver = null;
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
  let scheduledScrollAnchorSaveChatId = 0;
  let currentUiTheme = 'bananza';
  let currentVisualMode = 'classic';
  let pollComposerStyle = 'pulse';
  let currentModalAnimation = 'soft';
  let currentModalAnimationSpeed = MODAL_ANIMATION_SPEED_DEFAULT;
  let currentMobileFontSize = MOBILE_FONT_SIZE_DEFAULT;
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
    settings: {
      enabled: false,
      default_response_model: 'gpt-5.4',
      default_summary_model: 'gpt-5.4',
      default_embedding_model: 'text-embedding-3-small',
      openai_default_image_model: 'gpt-image-2',
      openai_default_image_size: '1024x1024',
      openai_default_image_quality: 'auto',
      openai_default_image_background: 'auto',
      openai_default_image_output_format: 'png',
      openai_default_document_format: 'md',
      chunk_size: 50,
      retrieval_top_k: 6,
    },
    bots: [],
    chats: [],
    chatSettings: [],
  };
  let aiModelCatalog = {
    source: 'fallback',
    response: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'],
    summary: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'],
    embedding: ['text-embedding-3-small'],
    image: ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'],
    error: '',
  };
  let aiModelRefreshTriggeredByButton = false;
  let selectedAiBotId = null;
  let openAiUniversalState = {
    settings: { ...aiBotState.settings },
    bots: [],
    chats: [],
    chatSettings: [],
  };
  let selectedOpenAiUniversalBotId = null;
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
  let deepseekBotState = {
    settings: {
      deepseek_enabled: false,
      deepseek_base_url: 'https://api.deepseek.com',
      deepseek_default_response_model: 'deepseek-chat',
      deepseek_default_summary_model: 'deepseek-chat',
      deepseek_temperature: 0.3,
      deepseek_max_tokens: 1000,
    },
    bots: [],
    chats: [],
    chatSettings: [],
    models: {
      response: ['deepseek-chat', 'deepseek-reasoner'],
      summary: ['deepseek-chat', 'deepseek-reasoner'],
    },
  };
  let selectedDeepseekBotId = null;
  let grokBotState = {
    settings: {
      grok_enabled: false,
      grok_base_url: 'https://api.x.ai/v1',
      grok_default_response_model: 'grok-4.20-reasoning',
      grok_default_summary_model: 'grok-4.20-reasoning',
      grok_default_embedding_model: 'text-embedding',
      grok_default_image_model: 'grok-imagine-image',
      grok_default_image_aspect_ratio: '1:1',
      grok_default_image_resolution: '1k',
      grok_temperature: 0.3,
      grok_max_tokens: 1000,
    },
    bots: [],
    imageBots: [],
    chats: [],
    chatSettings: [],
    imageChatSettings: [],
    models: {
      response: ['grok-4.20-reasoning'],
      summary: ['grok-4.20-reasoning'],
      embedding: ['text-embedding'],
      image: ['grok-imagine-image'],
      aspect_ratio: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2', '19.5:9', '9:19.5', '20:9', '9:20', 'auto'],
      resolution: ['1k', '2k'],
    },
  };
  let selectedGrokBotId = null;
  let selectedGrokImageBotId = null;
  let grokTextBotFormFingerprint = '';
  let grokTextBotFormHydrating = false;
  let grokUniversalState = {
    settings: { ...grokBotState.settings },
    bots: [],
    chats: [],
    chatSettings: [],
    models: { ...grokBotState.models },
  };
  let selectedGrokUniversalBotId = null;
  let contextConvertAdminStates = {
    openai: {
      settings: { ...aiBotState.settings },
      bots: [],
      chats: [],
      chatSettings: [],
      models: { response: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'] },
    },
    yandex: {
      settings: { ...yandexBotState.settings },
      bots: [],
      chats: [],
      chatSettings: [],
      models: { response: ['yandexgpt/latest', 'yandexgpt-lite/latest'] },
    },
    deepseek: {
      settings: { ...deepseekBotState.settings },
      bots: [],
      chats: [],
      chatSettings: [],
      models: { response: ['deepseek-chat', 'deepseek-reasoner'] },
    },
    grok: {
      settings: { ...grokBotState.settings },
      bots: [],
      chats: [],
      chatSettings: [],
      models: { response: ['grok-4.20-reasoning'] },
    },
  };
  let selectedContextConvertBotIds = {
    openai: null,
    yandex: null,
    deepseek: null,
    grok: null,
  };
  let activeContextConvertProvider = 'openai';
  let contextConvertAvailabilityByChat = new Map();
  let contextConvertAvailabilityRequests = new Map();
  let contextConvertComposerPending = false;
  let contextConvertPendingMessageIds = new Set();
  let contextConvertPickerState = {
    active: false,
    selected: 0,
    bots: [],
    mode: 'composer',
    chatId: 0,
    messageId: 0,
    anchorEl: null,
    keyboardAttached: false,
  };
  let contextConvertPickerPointerState = null;
  let contextConvertPickerClickSuppressUntil = 0;
  let composerAiOverrideState = {
    target: null,
    mode: 'auto',
    documentFormat: 'md',
  };
  let composerAiOverrideSeq = 0;
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
  let mentionPickerState = { active: false, start: 0, end: 0, selected: 0, targets: [], source: null, keyboardAttached: false };
  let mentionPickerPointerState = null;
  let mentionPickerClickSuppressUntil = 0;
  let emojiPickerOpen = false;
  let emojiPickerKeyboardAttached = false;
  let emojiPickerAnchorEl = null;
  let emojiPickerKeyboardStabilizeFrame = 0;
  let emojiPickerKeyboardStabilizeTimer = null;
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
  let mobileFontSizeSaveTimer = null;
  let mobileFontSizeSaveInFlight = false;
  let mobileFontSizeSaveQueued = false;
  let mobileFontSizeStatusTimer = null;
  let chatAreaResizeObserver = null;
  let searchAllChats = false;
  let searchRequestSeq = 0;
  let searchPanelHistoryPushed = false;
  let searchPanelSkipNextPopstate = false;
  let searchPanelCloseTimer = null;
  let searchPanelOpenFrame = null;
  let searchPanelTransitionHandler = null;
  let searchPanelPendingAction = null;
  let searchPanelReturnFocusEl = null;
  let searchPanelFollowupClickSuppressUntil = 0;
  let chatOpenSeq = 0;
  let chatMessageAbortController = null;
  let chatOpenInProgress = false;
  let deferredRecoveryReason = '';
  let scrollRestoreTimers = new Set();
  let mobileRouteTransitionActive = false;
  let mobileRouteTransitionTimer = null;
  let mobileBaseScene = 'sidebar';
  let mobileSceneRepaintFrame = 0;
  let mobileSceneRepaintCleanupFrame = 0;
  let mobileSceneRepaintTarget = null;
  const mediaPlaybackStateByChat = new Map();
  let messageBackgroundSyncTimer = null;
  let messageBackgroundSyncRunning = false;
  let messageBackgroundSyncRequested = false;
  const messageBackgroundSyncInFlight = new Set();
  let iosViewportLayoutSyncFrame = 0;
  let iosViewportElementResizeObserver = null;
  let iosVisualViewportBaselineHeight = 0;
  let iosComposerFocused = false;
  let iosComposerBlurTimer = null;
  let iosBackNavigationToken = 0;
  let inAppChatBackSkipNextPopstate = false;
  let mobileViewportPrevHeight = 0;
  let mobileViewportHeightSyncBound = false;
  let mobileViewportRecoveryFrame = 0;
  let mobileViewportRecoveryTimer = null;
  let mobileComposerDismissClickSuppressUntil = 0;
  let scrollBottomFollowupClickSuppressUntil = 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM
  // ═══════════════════════════════════════════════════════════════════════════
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const sidebar = $('#sidebar');
  const chatList = $('#chatList');
  const chatListStatus = $('#chatListStatus');
  const chatListPullIndicator = $('#chatListPullIndicator');
  const chatListPullIcon = $('#chatListPullIcon');
  const chatListPullLabel = $('#chatListPullLabel');
  const sidebarSearch = $('#sidebarSearch');
  const chatSearch = $('#chatSearch');
  const chatSearchToggle = $('#chatSearchToggle');
  const chatSearchClear = $('#chatSearchClear');
  const chatArea = $('#chatArea');
  const emptyState = $('#emptyState');
  const chatView = $('#chatView');
  const chatHeader = chatView?.querySelector('.chat-header');
  const backBtn = $('#backBtn');
  const chatTitle = $('#chatTitle');
  const chatHeaderAvatar = $('#chatHeaderAvatar');
  const chatStatus = $('#chatStatus');
  const pinnedBar = $('#pinnedBar');
  const messagesEl = $('#messages');
  const loadMoreWrap = $('#loadMoreWrap');
  const loadMoreBtn = $('#loadMoreBtn');
  const loadMoreAfterWrap = $('#loadMoreAfterWrap');
  const typingBar = $('#typingBar');
  const msgInput = $('#msgInput');
  const inputArea = chatView?.querySelector('.input-area');
  const mentionOpenBtn = $('#mentionOpenBtn');
  const sendBtn = $('#sendBtn');
  const scrollBottomBtn = $('#scrollBottomBtn');
  const composerContextConvertBtn = $('#composerContextConvertBtn');
  const attachBtn = $('#attachBtn');
  const pollBtn = $('#pollBtn');
  const emojiBtn = $('#emojiBtn');
  const fileInput = $('#fileInput');
  const pendingFileEl = $('#pendingFile');
  const composerAiOverrideEl = $('#composerAiOverride');
  const composerAiOverrideLabel = $('#composerAiOverrideLabel');
  const composerAiOverrideHint = $('#composerAiOverrideHint');
  const composerAiOverrideModeEl = $('#composerAiOverrideMode');
  const composerAiOverrideDocumentWrap = $('#composerAiOverrideDocumentWrap');
  const composerAiOverrideDocumentFormatEl = $('#composerAiOverrideDocumentFormat');
  const emojiPicker = $('#emojiPicker');
  const imageViewer = $('#imageViewer');
  const ivStrip = $('#ivStrip');
  const reactionPicker = $('#reactionPicker');
  const reactionEmojiPopover = $('#reactionEmojiPopover');
  const chatContextMenuBackdrop = $('#chatContextMenuBackdrop');
  const chatContextMenu = $('#chatContextMenu');
  const OPENAI_IMAGE_SIZE_OPTIONS = ['auto', '1024x1024', '1024x1536', '1536x1024'];
  const OPENAI_IMAGE_QUALITY_OPTIONS = ['auto', 'low', 'medium', 'high'];
  const OPENAI_IMAGE_BACKGROUND_OPTIONS = ['auto', 'transparent', 'opaque'];
  const OPENAI_IMAGE_OUTPUT_OPTIONS = ['png', 'webp', 'jpeg'];
  const DOCUMENT_FORMAT_OPTIONS = ['md', 'txt'];
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
  const visualModeSettingsModal = $('#visualModeSettingsModal');
  const pollStyleSettingsModal = $('#pollStyleSettingsModal');
  const animationSettingsModal = $('#animationSettingsModal');
  const mobileFontSettingsModal = $('#mobileFontSettingsModal');
  const weatherSettingsModal = $('#weatherSettingsModal');
  const notificationSettingsModal = $('#notificationSettingsModal');
  const soundSettingsModal = $('#soundSettingsModal');
  const aiBotSettingsModal = $('#aiBotSettingsModal');
  const openAiTextBotsModal = $('#openAiTextBotsModal');
  const openAiUniversalBotsModal = $('#openAiUniversalBotsModal');
  const contextConvertBotsModal = $('#contextConvertBotsModal');
  const yandexAiSettingsModal = $('#yandexAiSettingsModal');
  const deepseekAiSettingsModal = $('#deepseekAiSettingsModal');
  const deepseekAiTextBotsModal = $('#deepseekAiTextBotsModal');
  const grokAiSettingsModal = $('#grokAiSettingsModal');
  const grokAiTextBotsModal = $('#grokAiTextBotsModal');
  const grokAiImageBotsModal = $('#grokAiImageBotsModal');
  const grokAiUniversalBotsModal = $('#grokAiUniversalBotsModal');
  const changePasswordModal = $('#changePasswordModal');
  const forwardMessageModal = $('#forwardMessageModal');
  const forwardChatSearch = $('#forwardChatSearch');
  const forwardChatList = $('#forwardChatList');
  const forwardMessageStatus = $('#forwardMessageStatus');
  const grokImageRiskConfirmModal = $('#grokImageRiskConfirmModal');
  const grokImageRiskTerms = $('#grokImageRiskTerms');
  const grokImageRiskCancel = $('#grokImageRiskCancel');
  const grokImageRiskConfirm = $('#grokImageRiskConfirm');
  const pollComposerModal = $('#pollComposerModal');
  const pollQuestionInput = $('#pollQuestionInput');
  const pollOptionsList = $('#pollOptionsList');
  const pollComposerPreview = $('#pollComposerPreview');
  const pollComposerStatus = $('#pollComposerStatus');
  const pollVotersModal = $('#pollVotersModal');
  const pollVotersMeta = $('#pollVotersMeta');
  const pollVotersTitle = $('#pollVotersTitle');
  const pollVotersStatus = $('#pollVotersStatus');
  const pollVotersList = $('#pollVotersList');
  const isIosViewportFixTarget = (() => {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
    return /iP(hone|ad|od)/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  })();
  if (isIosViewportFixTarget) {
    document.documentElement.classList.add('is-ios-webkit');
  }

  function getMobileAppViewportHeight() {
    const vv = window.visualViewport;
    const viewportHeight = Math.max(0, vv?.height || window.innerHeight || 0);
    if (!isIosViewportFixTarget || !vv) return viewportHeight;
    return Math.max(0, viewportHeight + Math.max(0, vv.offsetTop || 0));
  }

  function getMobileAppViewportTopInset() {
    if (!isIosViewportFixTarget) return 0;
    return Math.max(0, window.visualViewport?.offsetTop || 0);
  }

  function isIosMobileViewportTarget() {
    return Boolean(isIosViewportFixTarget && window.innerWidth <= 768);
  }

  function isIosWebkitMotionAllowed() {
    return Boolean(
      isIosViewportFixTarget
      && currentModalAnimation !== 'none'
      && !prefersReducedMotion()
    );
  }

  function forceIosAnimationMount(...elements) {
    if (!isIosWebkitMotionAllowed()) return;
    elements.forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      void el.offsetWidth;
    });
  }

  function getIosVisualViewportMetrics() {
    const vv = window.visualViewport;
    const top = Math.max(0, vv?.offsetTop || 0);
    const height = Math.max(0, vv?.height || window.innerHeight || 0);
    return {
      top,
      height,
      bottom: top + height,
    };
  }

  function getIosViewportBaselineHeight() {
    const vv = window.visualViewport;
    const currentHeight = Math.max(
      0,
      (vv?.height || 0) + Math.max(0, vv?.offsetTop || 0),
      window.innerHeight || 0,
      document.documentElement?.clientHeight || 0
    );
    if (currentHeight > iosVisualViewportBaselineHeight) {
      iosVisualViewportBaselineHeight = currentHeight;
    }
    return Math.max(iosVisualViewportBaselineHeight, currentHeight);
  }

  function isIosKeyboardOpen() {
    if (!isIosMobileViewportTarget() || !window.visualViewport) return false;
    const vv = window.visualViewport;
    const viewportTop = Math.max(0, vv.offsetTop || 0);
    const viewportHeight = Math.max(0, vv.height || 0);
    const visibleBottom = viewportTop + viewportHeight;
    const baselineHeight = getIosViewportBaselineHeight();
    const layoutHeight = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0, baselineHeight);
    const keyboardOverlap = Math.max(
      0,
      layoutHeight - visibleBottom,
      baselineHeight - visibleBottom,
      baselineHeight - viewportHeight
    );
    return keyboardOverlap > 80;
  }

  function isIosChatKeyboardLayoutActive() {
    if (!isIosMobileViewportTarget() || !window.visualViewport) return false;
    if (chatView?.classList.contains('hidden')) return false;
    if (document.activeElement !== msgInput && !iosComposerFocused) return false;
    return isIosKeyboardOpen();
  }

  function syncIosViewportLayoutState() {
    if (!isIosViewportFixTarget) return;
    const root = document.documentElement;
    const viewport = getIosVisualViewportMetrics();
    const headerHeight = Math.max(0, Math.round(chatHeader?.getBoundingClientRect?.().height || 0));
    const inputHeight = Math.max(0, Math.round(inputArea?.getBoundingClientRect?.().height || 0));
    const keyboardOpen = isIosKeyboardOpen();
    const keyboardLayoutActive = isIosChatKeyboardLayoutActive();

    root.classList.add('is-ios-webkit');
    root.classList.toggle('is-ios-keyboard-open', keyboardOpen);
    root.classList.toggle('is-ios-chat-keyboard-layout', keyboardLayoutActive);
    root.style.setProperty('--ios-visual-viewport-top', `${Math.round(viewport.top)}px`);
    root.style.setProperty('--ios-visual-viewport-height', `${Math.round(viewport.height)}px`);
    root.style.setProperty('--ios-chat-header-height', `${headerHeight}px`);
    root.style.setProperty('--ios-chat-input-area-height', `${inputHeight}px`);
  }

  function queueIosViewportLayoutSync() {
    if (!isIosViewportFixTarget) return;
    if (iosViewportLayoutSyncFrame) cancelAnimationFrame(iosViewportLayoutSyncFrame);
    iosViewportLayoutSyncFrame = requestAnimationFrame(() => {
      iosViewportLayoutSyncFrame = 0;
      syncIosViewportLayoutState();
    });
  }

  function isMobileComposerKeyboardOpen() {
    if (window.innerWidth > 768) return false;
    if (isIosViewportFixTarget) return isIosKeyboardOpen();
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

  function restoreComposerFocusAfterMentionPicker(keyboardAttached = mentionPickerState.keyboardAttached) {
    if (window.innerWidth > 768 || keyboardAttached) {
      focusComposerKeepKeyboard(true);
      return true;
    }
    return false;
  }

  function dismissMentionPickerAfterKeyboardClose() {
    if (window.innerWidth > 768) return false;
    if (!mentionPickerState.active || !mentionPickerState.keyboardAttached) return false;
    if (isMobileComposerKeyboardOpen()) return false;
    hideMentionPicker();
    return true;
  }

  function preventMobileComposerBlur(e) {
    if (!isMobileComposerKeyboardOpen()) return false;
    e.preventDefault();
    return true;
  }

  function isMobileComposerSessionActive() {
    if (window.innerWidth > 768) return false;
    return Boolean(document.activeElement === msgInput || iosComposerFocused || isMobileComposerKeyboardOpen());
  }

  function suppressMobileComposerDismissClick(ms = 520) {
    mobileComposerDismissClickSuppressUntil = Math.max(mobileComposerDismissClickSuppressUntil, Date.now() + ms);
  }

  function preserveMobileComposerOnPointerDown(e, { requireOpenKeyboard = true } = {}) {
    if (window.innerWidth > 768) return false;
    if (requireOpenKeyboard && !isMobileComposerKeyboardOpen()) return false;
    if (typeof e.button === 'number' && e.button !== 0) return false;
    e.preventDefault();
    return true;
  }

  function dismissMobileComposer({ consumeTap = false, forceRecovery = true, reason = '', recoveryDelayMs = 240 } = {}) {
    if (window.innerWidth > 768) return false;
    const hadComposerSession = isMobileComposerSessionActive();
    if (consumeTap) suppressMobileComposerDismissClick();
    if (document.activeElement === msgInput) {
      try { msgInput.blur(); } catch {}
    }
    if (iosComposerFocused) iosComposerFocused = false;
    queueIosViewportLayoutSync();
    if (forceRecovery) scheduleMobileViewportRecovery(recoveryDelayMs);
    return hadComposerSession;
  }

  function closeMobileComposerTransientUi({ immediate = true, preserveEmoji = false } = {}) {
    hideMentionPicker();
    if (contextConvertPickerState.active) hideContextConvertPicker();
    hideFloatingMessageActions({ immediate, keepComposerState: false });
    hideAvatarUserMenu();
    clearActivePulseVoterPopover({ skipRefresh: true });
    if (!preserveEmoji) closeEmojiPicker({ immediate });
    const attachMenu = $('#attachMenu');
    if (attachMenu) attachMenu.classList.add('hidden');
  }

  function getMobileComposerSafeReturnFocusEl(fallback = null) {
    const active = rememberActiveElement();
    if (window.innerWidth <= 768 && active === msgInput) {
      return fallback instanceof HTMLElement ? fallback : null;
    }
    return active instanceof HTMLElement ? active : (fallback instanceof HTMLElement ? fallback : null);
  }

  function isTouchLikePointerEvent(event) {
    return Boolean(event && typeof event.pointerType === 'string' && event.pointerType !== 'mouse');
  }

  function isPickerDismissPassThroughTarget(target) {
    return Boolean(
      target instanceof Element
      && target.closest(
        '#menuBtn, #settingsBtn, #searchBtn, #chatInfoBtn, #backBtn, #emojiBtn, #attachBtn, #mentionOpenBtn, #composerContextConvertBtn, #msgInput'
      )
    );
  }

  function consumeOutsidePickerDismissGesture(event, suppressFollowupClick) {
    suppressFollowupClick();
    event.preventDefault();
    event.stopImmediatePropagation?.();
    event.stopPropagation();
  }

  function suppressSearchPanelFollowupClick(ms = 550) {
    searchPanelFollowupClickSuppressUntil = Math.max(searchPanelFollowupClickSuppressUntil, Date.now() + ms);
  }

  // Touch-first browsers can drop the synthesized click after we prevent textarea blur.
  // For these controls we execute the action directly from pointerup/touchend and only
  // keep click as the desktop/mouse fallback.
  function bindTouchSafeButtonActivation(button, onActivate, { suppressClickMs = 520 } = {}) {
    if (!(button instanceof HTMLElement) || typeof onActivate !== 'function') return;
    const gestureState = {
      source: '',
      pointerId: null,
      touchId: null,
      keyboardOpenAtStart: false,
    };

    const clearGestureState = () => {
      gestureState.source = '';
      gestureState.pointerId = null;
      gestureState.touchId = null;
      gestureState.keyboardOpenAtStart = false;
    };

    const suppressFollowupClick = (ms = suppressClickMs) => {
      button.__touchSafeSuppressUntil = Math.max(
        Number(button.__touchSafeSuppressUntil || 0),
        Date.now() + Math.max(0, Number(ms) || 0)
      );
    };

    const isFollowupClickSuppressed = () => Date.now() < Number(button.__touchSafeSuppressUntil || 0);

    const buildActivationContext = (event, source) => {
      const startKeyboardOpen = Boolean(
        gestureState.keyboardOpenAtStart
        || button.__mouseDownKeyboardWasOpen
        || (source === 'click' && isMobileComposerKeyboardOpen())
      );
      return {
        event,
        source,
        startKeyboardOpen,
        keepKeyboardOpen: window.innerWidth > 768 || startKeyboardOpen || isMobileComposerKeyboardOpen(),
        isTouchLike: source === 'pointer' || source === 'touch',
      };
    };

    const maybePreserveComposerOnGestureStart = (event, keyboardOpenAtStart) => {
      if (window.innerWidth > 768 || !keyboardOpenAtStart || !event?.cancelable) return false;
      event.preventDefault();
      return true;
    };

    const startGesture = (event, source) => {
      gestureState.source = source;
      gestureState.pointerId = source === 'pointer' && Number.isFinite(Number(event.pointerId))
        ? Number(event.pointerId)
        : null;
      const touch = source === 'touch'
        ? (event.changedTouches?.[0] || event.touches?.[0] || null)
        : null;
      gestureState.touchId = touch && Number.isFinite(Number(touch.identifier))
        ? Number(touch.identifier)
        : null;
      gestureState.keyboardOpenAtStart = isMobileComposerKeyboardOpen();
      maybePreserveComposerOnGestureStart(event, gestureState.keyboardOpenAtStart);
    };

    const activateFromGesture = (event, source) => {
      const context = buildActivationContext(event, source);
      suppressFollowupClick();
      button.__mouseDownKeyboardWasOpen = false;
      clearGestureState();
      onActivate(context);
      event.preventDefault?.();
      event.stopPropagation?.();
    };

    button.addEventListener('pointerdown', (event) => {
      if (gestureState.source === 'touch') return;
      if (!isTouchLikePointerEvent(event)) return;
      if (typeof event.button === 'number' && event.button !== 0) return;
      startGesture(event, 'pointer');
    }, { passive: false });

    button.addEventListener('pointerup', (event) => {
      if (gestureState.source !== 'pointer') return;
      if (!isTouchLikePointerEvent(event)) {
        clearGestureState();
        return;
      }
      if (gestureState.pointerId != null && Number(event.pointerId) !== gestureState.pointerId) return;
      activateFromGesture(event, 'pointer');
    }, { passive: false });

    button.addEventListener('pointercancel', () => {
      if (gestureState.source === 'pointer') clearGestureState();
    }, { passive: true });

    button.addEventListener('touchstart', (event) => {
      if (gestureState.source === 'pointer' || gestureState.source === 'touch') return;
      startGesture(event, 'touch');
    }, { passive: false });

    button.addEventListener('touchend', (event) => {
      if (gestureState.source !== 'touch') return;
      if (gestureState.touchId != null) {
        const matchesTouch = Array.from(event.changedTouches || [])
          .some((touch) => Number(touch.identifier) === gestureState.touchId);
        if (!matchesTouch && (event.changedTouches?.length || 0) > 0) return;
      }
      activateFromGesture(event, 'touch');
    }, { passive: false });

    button.addEventListener('touchcancel', () => {
      if (gestureState.source === 'touch') clearGestureState();
    }, { passive: true });

    button.addEventListener('mousedown', (event) => {
      if (typeof event.button === 'number' && event.button !== 0) return;
      button.__mouseDownKeyboardWasOpen = isMobileComposerKeyboardOpen();
      if (window.innerWidth <= 768 && button.__mouseDownKeyboardWasOpen && event.cancelable) {
        event.preventDefault();
      }
    });

    button.addEventListener('click', (event) => {
      if (isFollowupClickSuppressed()) {
        event.preventDefault();
        event.stopPropagation();
        button.__mouseDownKeyboardWasOpen = false;
        return;
      }
      const context = buildActivationContext(event, 'click');
      button.__mouseDownKeyboardWasOpen = false;
      clearGestureState();
      onActivate(context);
    });
  }

  function isMobileComposerDismissMessageTarget(target) {
    if (!(target instanceof Element)) return false;
    const row = target.closest('.msg-row');
    if (!row || !messagesEl.contains(row) || row.dataset.outbox === '1' || row.querySelector('.msg-deleted')) return false;
    if (target.closest(
      '.msg-actions, button, a, input, textarea, select, label, audio, video, .video-note-stage, .msg-reply, .reaction-badge, .msg-image, .msg-video, .msg-file, .link-preview, .msg-group-avatar'
    )) return false;
    return true;
  }

  function isMobileComposerDismissBackgroundTarget(target) {
    if (!(target instanceof Element) || !messagesEl.contains(target)) return false;
    if (target.closest('.msg-row')) return false;
    if (target.closest('button, a, input, textarea, select, label, audio, video')) return false;
    return true;
  }

  function shouldKeepEmojiPickerKeyboard() {
    return Boolean(emojiPickerKeyboardAttached || isMobileComposerKeyboardOpen());
  }

  function clearEmojiPickerKeyboardOpenStabilizer() {
    if (emojiPickerKeyboardStabilizeFrame) {
      cancelAnimationFrame(emojiPickerKeyboardStabilizeFrame);
      emojiPickerKeyboardStabilizeFrame = 0;
    }
    if (emojiPickerKeyboardStabilizeTimer) {
      clearTimeout(emojiPickerKeyboardStabilizeTimer);
      emojiPickerKeyboardStabilizeTimer = null;
    }
  }

  function stabilizeEmojiPickerKeyboardOnOpen(keepKeyboardOpen = emojiPickerKeyboardAttached) {
    if (window.innerWidth > 768 || !keepKeyboardOpen) return false;
    clearEmojiPickerKeyboardOpenStabilizer();
    const apply = () => {
      if (!emojiPickerOpen || !shouldKeepEmojiPickerKeyboard()) return false;
      focusComposerKeepKeyboard(true);
      forceMobileViewportLayoutSync();
      syncChatAreaMetrics();
      queueIosViewportLayoutSync();
      return true;
    };
    emojiPickerKeyboardStabilizeFrame = requestAnimationFrame(() => {
      emojiPickerKeyboardStabilizeFrame = 0;
      apply();
    });
    emojiPickerKeyboardStabilizeTimer = setTimeout(() => {
      emojiPickerKeyboardStabilizeTimer = null;
      apply();
    }, 150);
    return true;
  }

  function shouldBypassLockedMobileViewportSync(newViewportHeight, { force = false, mentionPickerDismissed = false } = {}) {
    if (force || mentionPickerDismissed || isIosViewportFixTarget) return true;
    if (!isMobileViewportLayoutLocked()) return true;
    const nextHeight = Math.max(0, Number(newViewportHeight) || 0);
    const prevHeight = Math.max(0, Number(mobileViewportPrevHeight) || 0);
    const delta = nextHeight - prevHeight;
    if (Math.abs(delta) < 48) return false;
    if (delta > 0) return true;
    return Boolean(document.activeElement === msgInput || iosComposerFocused || isMobileComposerKeyboardOpen());
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
    isIosWebkit: () => isIosViewportFixTarget,
    getCurrentModalAnimation: () => currentModalAnimation,
    getCurrentModalAnimationSpeed: () => currentModalAnimationSpeed,
    getPendingFiles: () => [...pendingFiles],
    getReplyTo: () => replyTo ? { ...replyTo } : null,
    getEditTo: () => editTo ? { ...editTo } : null,
    queueVoiceMessage: (payload) => queueVoiceOutbox(payload),
    queueVideoNote: (payload) => queueVideoNoteOutbox(payload),
    updateReplyPreview: (messageId, text) => {
      if (replyTo?.id === messageId && !editTo) {
        replyTo.text = text || '📎 Attachment';
        replyBarText.textContent = replyTo.text;
      }
    },
    scrollToBottom: (instant = false) => scrollToBottom(instant),
    playSound: (type, options) => playAppSound(type, options),
    bindMediaPlayback: (mediaEl, message, role) => bindMediaPlaybackState(mediaEl, message, role),
    getAttachmentPreviewUrl: (source) => getAttachmentPreviewUrl(source),
    getAttachmentDownloadUrl: (source) => getAttachmentDownloadUrl(source),
    getAttachmentPosterUrl: (source) => getAttachmentPosterUrl(source),
    ensureAttachmentPoster: (source, options = {}) => ensureAttachmentPoster(source, options),
    createAttachmentPosterBlob: (source) => createAttachmentPosterBlob(source),
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
  Object.assign(appBridge.__testing = appBridge.__testing || {}, {
    getChats: () => chats.map((chat) => normalizeChatListEntry(chat)),
    setChats: (nextChats = [], options = {}) => {
      chats = (Array.isArray(nextChats) ? nextChats : []).map((chat) => normalizeChatListEntry(chat));
      if (Object.prototype.hasOwnProperty.call(options, 'currentChatId')) {
        const nextCurrentChatId = Number(options.currentChatId || 0);
        currentChatId = nextCurrentChatId > 0 ? nextCurrentChatId : null;
      }
      renderChatList(chatSearch.value);
      renderCurrentChatHeader(getChatById(currentChatId));
      refreshChatInfoPresentation(getChatById(currentChatId));
      return chats.map((chat) => normalizeChatListEntry(chat));
    },
    setCurrentChatId: (chatId) => {
      const nextCurrentChatId = Number(chatId || 0);
      currentChatId = nextCurrentChatId > 0 ? nextCurrentChatId : null;
      const currentChat = getChatById(currentChatId);
      renderCurrentChatHeader(currentChat);
      refreshChatInfoPresentation(currentChat);
      return currentChat ? normalizeChatListEntry(currentChat) : null;
    },
    applyChatUpdate: (nextChat = {}) => applyChatUpdate(nextChat),
    dismissMobileComposer: (options = {}) => dismissMobileComposer(options),
    openMediaViewer: (src, type = 'image') => openMediaViewer(src, type),
    closeMediaViewer: () => closeMediaViewer(),
    getMediaViewerState: () => ({
      scale: ivScale,
      panX: ivPanX,
      panY: ivPanY,
      transform: ivCurrentImg()?.style?.transform || '',
    }),
    openSettingsModal: (opener = $('#settingsBtn')) => openSettingsModal(opener),
    openChatInfoModal: (opener = $('#chatInfoBtn')) => openChatInfoModal(opener),
    openChat: (chatId, options = {}) => openChat(chatId, options),
    revealSidebarFromChat: (options = {}) => revealSidebarFromChat(options),
    flushCurrentChatScrollAnchor: (chatId, options = {}) => flushCurrentChatScrollAnchor(chatId, options),
    readScrollAnchors: () => JSON.parse(JSON.stringify(scrollPositions || {})),
    setScrollRestoreMode: (mode = 'bottom') => {
      scrollRestoreMode = mode === 'restore' ? 'restore' : 'bottom';
      localStorage.setItem('scrollRestoreMode', scrollRestoreMode);
      const toggle = $('#settingsScrollRestore');
      if (toggle) toggle.checked = scrollRestoreMode === 'restore';
      return scrollRestoreMode;
    },
    setReply: (...args) => setReply(...args),
    setEditFromRow: (row) => setEditFromRow(row),
    setMobileBaseScene: (scene, options = {}) => syncMobileBaseSceneState({
      scene,
      hideInactive: Object.prototype.hasOwnProperty.call(options, 'hideInactive') ? !!options.hideInactive : true,
      syncChatMetrics: Boolean(options.syncChatMetrics),
      repaint: Boolean(options.repaint),
    }),
    getMobileBaseSceneSnapshot: () => ({
      scene: getResolvedMobileBaseScene(),
      routeTransitionActive: mobileRouteTransitionActive,
      sidebar: {
        sidebarHidden: sidebar?.classList?.contains('sidebar-hidden') || false,
        mobileSceneHidden: sidebar?.classList?.contains('mobile-scene-hidden') || false,
        inert: sidebar?.hasAttribute?.('inert') || false,
        ariaHidden: sidebar?.getAttribute?.('aria-hidden') || null,
      },
      chatArea: {
        mobileSceneHidden: chatArea?.classList?.contains('mobile-scene-hidden') || false,
        inert: chatArea?.hasAttribute?.('inert') || false,
        ariaHidden: chatArea?.getAttribute?.('aria-hidden') || null,
      },
    }),
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
  function isMobileLayoutViewport() {
    return window.innerWidth <= 768;
  }

  function normalizeMobileBaseScene(scene) {
    return scene === 'chat' ? 'chat' : 'sidebar';
  }

  function clearMobileSceneRepaint() {
    if (mobileSceneRepaintFrame) {
      cancelAnimationFrame(mobileSceneRepaintFrame);
      mobileSceneRepaintFrame = 0;
    }
    if (mobileSceneRepaintCleanupFrame) {
      cancelAnimationFrame(mobileSceneRepaintCleanupFrame);
      mobileSceneRepaintCleanupFrame = 0;
    }
    sidebar?.classList?.remove('mobile-scene-repaint');
    chatArea?.classList?.remove('mobile-scene-repaint');
    mobileSceneRepaintTarget = null;
  }

  function getResolvedMobileBaseScene(scene = mobileBaseScene) {
    const declaredScene = normalizeMobileBaseScene(document.documentElement?.dataset?.mobileScene || scene);
    if (!sidebar || !chatArea) return declaredScene;
    if (!isMobileLayoutViewport()) return declaredScene;
    if (chatArea.classList.contains('mobile-scene-hidden')) return 'sidebar';
    if (sidebar.classList.contains('mobile-scene-hidden')) return 'chat';
    if (mobileRouteTransitionActive) return declaredScene;
    if (sidebar.classList.contains('sidebar-hidden')) return 'chat';
    return declaredScene;
  }

  function isMobileBaseSceneHardHidden(el) {
    return Boolean(isMobileLayoutViewport() && el instanceof HTMLElement && el.classList.contains('mobile-scene-hidden'));
  }

  function setMobileSceneElementState(el, { active = false, hardHide = false } = {}) {
    if (!(el instanceof HTMLElement)) return;
    el.classList.toggle('mobile-scene-hidden', Boolean(hardHide));
    el.dataset.mobileSceneState = hardHide ? 'hidden' : (active ? 'active' : 'mounted');
    if (active) {
      el.removeAttribute('inert');
      el.setAttribute('aria-hidden', 'false');
    } else {
      blurFocusedElementWithin(el);
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    }
  }

  function clearMobileSceneElementState(el) {
    if (!(el instanceof HTMLElement)) return;
    el.classList.remove('mobile-scene-hidden', 'mobile-scene-repaint');
    delete el.dataset.mobileSceneState;
    el.removeAttribute('inert');
    el.removeAttribute('aria-hidden');
  }

  function scheduleActiveMobileSceneRepaint(scene = mobileBaseScene) {
    if (!isMobileLayoutViewport()) {
      clearMobileSceneRepaint();
      return false;
    }
    const target = normalizeMobileBaseScene(scene) === 'chat' ? chatArea : sidebar;
    if (!(target instanceof HTMLElement)) return false;
    clearMobileSceneRepaint();
    mobileSceneRepaintTarget = target;
    target.classList.add('mobile-scene-repaint');
    mobileSceneRepaintFrame = requestAnimationFrame(() => {
      mobileSceneRepaintFrame = 0;
      mobileSceneRepaintCleanupFrame = requestAnimationFrame(() => {
        mobileSceneRepaintCleanupFrame = 0;
        mobileSceneRepaintTarget?.classList?.remove('mobile-scene-repaint');
        mobileSceneRepaintTarget = null;
      });
    });
    return true;
  }

  function syncMobileBaseSceneState(options = {}) {
    if (!sidebar || !chatArea) return normalizeMobileBaseScene(options.scene || mobileBaseScene);
    const scene = normalizeMobileBaseScene(options.scene || getResolvedMobileBaseScene());
    mobileBaseScene = scene;

    if (!isMobileLayoutViewport()) {
      clearMobileSceneRepaint();
      clearMobileSceneElementState(sidebar);
      clearMobileSceneElementState(chatArea);
      sidebar.classList.remove('sidebar-hidden', 'sidebar-no-transition');
      sidebar.style.transform = '';
      sidebar.style.willChange = '';
      delete document.documentElement.dataset.mobileScene;
      return scene;
    }

    const hideInactive = Object.prototype.hasOwnProperty.call(options, 'hideInactive')
      ? !!options.hideInactive
      : !mobileRouteTransitionActive;
    const syncChatMetrics = Boolean(options.syncChatMetrics && scene === 'chat');
    const root = document.documentElement;

    if (scene === 'sidebar') {
      sidebar.classList.remove('sidebar-hidden');
      sidebar.classList.remove('mobile-scene-hidden');
    } else {
      chatArea.classList.remove('mobile-scene-hidden');
      sidebar.classList.add('sidebar-hidden');
    }

    if (syncChatMetrics) {
      syncMobileAppHeightToViewport({ force: true });
      syncChatAreaMetrics({ force: true });
      queueIosViewportLayoutSync();
    }

    setMobileSceneElementState(sidebar, {
      active: scene === 'sidebar',
      hardHide: hideInactive && scene !== 'sidebar',
    });
    setMobileSceneElementState(chatArea, {
      active: scene === 'chat',
      hardHide: hideInactive && scene !== 'chat',
    });

    root.dataset.mobileScene = scene;
    if (options.repaint) scheduleActiveMobileSceneRepaint(scene);
    return scene;
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

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

  function normalizePollStyle(style) {
    return POLL_STYLE_IDS.has(style) ? style : 'pulse';
  }

  function pollStyleMeta(style) {
    return POLL_STYLES.find((item) => item.id === normalizePollStyle(style)) || POLL_STYLES[0];
  }

  function setPollStyleStatus(message, type = '') {
    const el = $('#settingsPollStyleStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
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
    const picker = $('#settingsPollStylePicker');
    if (!picker) return;
    picker.innerHTML = POLL_STYLES.map((style) => `
      <button type="button" class="poll-style-card${style.id === pollComposerStyle ? ' active' : ''}" data-poll-style-option="${style.id}">
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
    const style = normalizePollStyle(pollComposerStyle);
    const meta = pollStyleMeta(style);
    setPollStyleSurface(pollComposerModal, style);
    setPollStyleSurface(pollStyleSettingsModal, style);
    const nameEl = $('#pollComposerStyleName');
    const noteEl = $('#pollComposerStyleNote');
    const btnEl = $('#pollComposerStyleBtn');
    if (nameEl) nameEl.textContent = meta.name;
    if (noteEl) noteEl.textContent = meta.note;
    if (btnEl) btnEl.textContent = `Poll Style: ${meta.name}`;
    renderPollStylePicker();
  }

  function selectPollStyle(style) {
    const nextStyle = normalizePollStyle(style);
    if (nextStyle === pollComposerStyle) return;
    pollComposerStyle = nextStyle;
    syncPollComposerStyleUi();
    refreshPollComposerPreview();
    setPollStyleStatus('Applies to this poll only', 'success');
  }

  function setThemeStatus(message, type = '') {
    const el = $('#settingsThemeStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function normalizeVisualMode(mode) {
    return UI_VISUAL_MODE_IDS.has(mode) ? mode : 'classic';
  }

  function visualModeMeta(mode) {
    const id = normalizeVisualMode(mode);
    return UI_VISUAL_MODES.find(item => item.id === id) || UI_VISUAL_MODES[0];
  }

  function visualModeStateLabel(mode) {
    return normalizeVisualMode(mode) === 'rich' ? 'On' : 'Off';
  }

  function setVisualModeStatus(message, type = '') {
    const el = $('#settingsVisualModeStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function renderVisualModePicker() {
    const picker = $('#settingsVisualModePicker');
    if (!picker) return;
    picker.innerHTML = UI_VISUAL_MODES.map(mode => `
      <button type="button" class="visual-mode-card${mode.id === currentVisualMode ? ' active' : ''}" data-visual-mode-option="${mode.id}">
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

  function renderThemePicker() {
    const picker = $('#settingsThemePicker');
    if (!picker) return;
    const mode = visualModeMeta(currentVisualMode);
    picker.innerHTML = UI_THEMES.map(theme => `
      <button type="button" class="theme-card${theme.id === currentUiTheme ? ' active' : ''}" data-theme="${theme.id}">
        <span class="theme-card-swatches">
          <span style="background:${theme.colors[0]}"></span>
          <span style="background:${theme.colors[1]}"></span>
        </span>
        <span class="theme-card-copy">
          <strong>${esc(theme.name)}</strong>
          <small>${esc(theme.note)} · Rich Banan UX ${visualModeStateLabel(mode.id)}</small>
        </span>
        <span class="theme-card-preview theme-card-preview--${mode.id}" aria-hidden="true">
          <i style="background:${theme.other}"></i>
          <i style="background:${theme.own}"></i>
        </span>
      </button>
    `).join('');
  }

  function applyVisualMode(mode, persist = true) {
    const nextMode = normalizeVisualMode(mode);
    currentVisualMode = nextMode;
    document.documentElement.dataset.visualMode = nextMode;
    if (currentUser) {
      currentUser.ui_visual_mode = nextMode;
      if (persist) localStorage.setItem('user', JSON.stringify(currentUser));
    }
    const panelBtn = $('#settingsVisualModePanel');
    if (panelBtn) panelBtn.textContent = `\uD83C\uDF4C Rich Banan UX: ${visualModeStateLabel(nextMode)}`;
    renderVisualModePicker();
    renderThemePicker();
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

  async function selectVisualMode(mode) {
    const nextMode = normalizeVisualMode(mode);
    if (nextMode === currentVisualMode) return;
    const prevMode = currentVisualMode;
    applyVisualMode(nextMode);
    setVisualModeStatus('Saving...');
    try {
      const res = await api('/api/user/visual-mode', { method: 'PATCH', body: { mode: nextMode } });
      currentUser = { ...currentUser, ...res.user };
      applyVisualMode(currentUser.ui_visual_mode);
      setVisualModeStatus('Saved', 'success');
      setTimeout(() => {
        if ($('#settingsVisualModeStatus')?.textContent === 'Saved') setVisualModeStatus('');
      }, 1200);
    } catch (e) {
      applyVisualMode(prevMode);
      setVisualModeStatus(e.message || 'Visual mode save failed', 'error');
    }
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

  function modalAnimationMeta(style = currentModalAnimation) {
    const id = normalizeModalAnimationStyle(style);
    return MODAL_ANIMATION_STYLES.find((item) => item.id === id) || MODAL_ANIMATION_STYLES[0];
  }

  function syncModalAnimationSettingsButton() {
    const panelBtn = $('#settingsAnimationPanel');
    if (!panelBtn) return;
    const meta = modalAnimationMeta(currentModalAnimation);
    panelBtn.textContent = `✨ Animation: ${meta.name}, ${normalizeModalAnimationSpeed(currentModalAnimationSpeed)}/10`;
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
      <button
        type="button"
        class="animation-style-card${style.id === currentModalAnimation ? ' active' : ''}"
        data-modal-animation-style="${style.id}"
        aria-pressed="${style.id === currentModalAnimation ? 'true' : 'false'}"
        ${style.id === currentModalAnimation ? 'aria-current="true"' : ''}
      >
        <strong>${esc(style.name)}</strong>
        <small>${esc(style.note)}</small>
        ${style.id === currentModalAnimation ? '<span class="animation-selected-mark">Selected</span>' : ''}
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
    syncModalAnimationSettingsButton();
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
    syncModalAnimationSettingsButton();
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

  function normalizeMobileFontSize(size) {
    const next = Math.round(Number(size));
    if (!Number.isFinite(next)) return MOBILE_FONT_SIZE_DEFAULT;
    return Math.min(MOBILE_FONT_SIZE_MAX, Math.max(MOBILE_FONT_SIZE_MIN, next));
  }

  function getMobileFontAdjustPercent(size = currentMobileFontSize) {
    return MOBILE_FONT_SIZE_PERCENTS[normalizeMobileFontSize(size)] || MOBILE_FONT_SIZE_PERCENTS[MOBILE_FONT_SIZE_DEFAULT];
  }

  function hasAndroidNativeBridge() {
    return Boolean(window.BananzaAndroid && typeof window.BananzaAndroid.postMessage === 'function');
  }

  function setMobileFontAdjustPercent(percent = 100) {
    const value = `${Math.round(Number(percent) || 100)}%`;
    document.documentElement.style.setProperty('-webkit-text-size-adjust', value, 'important');
    document.documentElement.style.setProperty('text-size-adjust', value, 'important');
  }

  function notifyAndroidMobileFontSize(size = currentMobileFontSize) {
    if (!hasAndroidNativeBridge()) return;
    try {
      const effectiveSize = isMobileLayoutViewport() ? normalizeMobileFontSize(size) : MOBILE_FONT_SIZE_DEFAULT;
      window.BananzaAndroid.postMessage(JSON.stringify({
        type: 'mobile_font_size',
        payload: {
          size: effectiveSize,
          mobileLayout: isMobileLayoutViewport(),
        },
      }));
    } catch (e) {}
  }

  function syncMobileFontSettingsButton() {
    const panelBtn = $('#settingsMobileFontPanel');
    if (!panelBtn) return;
    panelBtn.textContent = `\uD83D\uDD20 Font Size (mobile): ${normalizeMobileFontSize(currentMobileFontSize)}/10`;
  }

  function setMobileFontSizeStatus(message, type = '') {
    const el = $('#settingsMobileFontStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function clearMobileFontSizeStatusTimer() {
    clearTimeout(mobileFontSizeStatusTimer);
    mobileFontSizeStatusTimer = null;
  }

  function scheduleMobileFontSizeStatusClear() {
    clearMobileFontSizeStatusTimer();
    mobileFontSizeStatusTimer = setTimeout(() => {
      if ($('#settingsMobileFontStatus')?.textContent === 'Saved') setMobileFontSizeStatus('');
    }, 1200);
  }

  function getPersistedMobileFontSize() {
    return normalizeMobileFontSize(currentUser?.ui_mobile_font_size);
  }

  function renderMobileFontSizeControl() {
    const input = $('#settingsMobileFontSize');
    const value = $('#settingsMobileFontSizeValue');
    if (input) input.value = String(normalizeMobileFontSize(currentMobileFontSize));
    if (value) value.textContent = `${normalizeMobileFontSize(currentMobileFontSize)}/10`;
  }

  function applyMobileFontSize(size, persist = true) {
    const nextSize = normalizeMobileFontSize(size);
    currentMobileFontSize = nextSize;
    setMobileFontAdjustPercent(hasAndroidNativeBridge() ? 100 : (isMobileLayoutViewport() ? getMobileFontAdjustPercent(nextSize) : 100));
    if (currentUser && persist) {
      currentUser.ui_mobile_font_size = nextSize;
      persistCurrentUser();
    }
    syncMobileFontSettingsButton();
    renderMobileFontSizeControl();
    notifyAndroidMobileFontSize(nextSize);
  }

  function syncMobileFontSizeViewportState() {
    applyMobileFontSize(currentMobileFontSize, false);
  }

  async function flushMobileFontSizeSave() {
    clearTimeout(mobileFontSizeSaveTimer);
    mobileFontSizeSaveTimer = null;
    if (mobileFontSizeSaveInFlight || !currentUser) return;
    const nextSize = normalizeMobileFontSize(currentMobileFontSize);
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
      currentUser = { ...currentUser, ...res.user };
      persistCurrentUser();
      didSave = true;

      const localChangedSinceRequest = normalizeMobileFontSize(currentMobileFontSize) !== requestSize;
      if (!localChangedSinceRequest) {
        applyMobileFontSize(currentUser.ui_mobile_font_size, false);
      }

      const pendingLocalChanges = normalizeMobileFontSize(currentMobileFontSize) !== getPersistedMobileFontSize();
      if (!pendingLocalChanges && !mobileFontSizeSaveTimer) {
        setMobileFontSizeStatus('Saved', 'success');
        scheduleMobileFontSizeStatusClear();
      } else {
        setMobileFontSizeStatus('Saving...');
      }
    } catch (e) {
      const localChangedSinceRequest = normalizeMobileFontSize(currentMobileFontSize) !== requestSize;
      if (!localChangedSinceRequest) {
        applyMobileFontSize(prevSize, false);
      }
      setMobileFontSizeStatus(e.message || 'Font size save failed', 'error');
    } finally {
      mobileFontSizeSaveInFlight = false;
      const pendingLocalChanges = normalizeMobileFontSize(currentMobileFontSize) !== getPersistedMobileFontSize();
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
    const nextSize = normalizeMobileFontSize(currentMobileFontSize);
    const prevSize = getPersistedMobileFontSize();
    if (nextSize === prevSize) {
      clearTimeout(mobileFontSizeSaveTimer);
      mobileFontSizeSaveTimer = null;
      mobileFontSizeSaveQueued = false;
      if (!mobileFontSizeSaveInFlight) setMobileFontSizeStatus('');
      return;
    }

    setMobileFontSizeStatus('Saving...');
    clearTimeout(mobileFontSizeSaveTimer);

    if (debounce > 0) {
      mobileFontSizeSaveQueued = true;
      mobileFontSizeSaveTimer = setTimeout(() => {
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
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }

  function fileExtension(name) {
    const m = String(name || '').toLowerCase().match(/\.[^.]+$/);
    return m ? m[0] : '';
  }

  function normalizeMimeType(value) {
    return String(value || '').split(';')[0].trim().toLowerCase();
  }

  function getStoredAttachmentUrl(storedName, { preview = false } = {}) {
    const name = String(storedName || '').trim();
    if (!name) return '';
    const encoded = encodeURIComponent(name);
    return preview ? `/uploads/${encoded}/preview` : `/uploads/${encoded}`;
  }

  function getStoredAttachmentPosterUrl(storedName) {
    const name = String(storedName || '').trim();
    return name ? `/uploads/${encodeURIComponent(name)}/poster` : '';
  }

  function resolveAttachmentUrl(source, { preview = false } = {}) {
    if (!source) return '';
    if (typeof source === 'string') {
      return getStoredAttachmentUrl(source, { preview });
    }
    const localUrl = String(source.client_file_url || source.clientFileUrl || '').trim();
    if (localUrl) return localUrl;
    return getStoredAttachmentUrl(source.file_stored || source.stored_name || source.storedName || '', { preview });
  }

  function getAttachmentPreviewUrl(source) {
    return resolveAttachmentUrl(source, { preview: true });
  }

  function getAttachmentDownloadUrl(source) {
    return resolveAttachmentUrl(source, { preview: false });
  }

  function getAttachmentPosterUrl(source) {
    if (!source) return '';
    if (typeof source === 'string') {
      return getStoredAttachmentPosterUrl(source);
    }
    const localPosterUrl = String(source.client_poster_url || source.clientPosterUrl || '').trim();
    if (localPosterUrl) return localPosterUrl;
    const hasPoster = Boolean(
      source.file_poster_available
      || source.filePosterAvailable
      || source.poster_available
      || source.posterAvailable
    );
    if (!hasPoster) return '';
    const storedName = source.file_stored || source.stored_name || source.storedName || '';
    return getStoredAttachmentPosterUrl(storedName);
  }

  function isVideoAttachmentMessage(source) {
    return String(source?.file_type || source?.fileType || '').trim().toLowerCase() === 'video';
  }

  function applyPosterToVideoElement(videoEl, posterUrl) {
    if (!(videoEl instanceof HTMLVideoElement) || !posterUrl) return;
    if (videoEl.getAttribute('poster') === posterUrl) return;
    videoEl.setAttribute('poster', posterUrl);
    try { videoEl.poster = posterUrl; } catch (e) {}
  }

  function markAttachmentPosterAvailable(source, { clientPosterUrl = '' } = {}) {
    if (!source || typeof source !== 'object') return source;
    source.file_poster_available = true;
    source.filePosterAvailable = true;
    source.poster_available = true;
    source.posterAvailable = true;
    if (clientPosterUrl) {
      source.client_poster_url = clientPosterUrl;
      source.clientPosterUrl = clientPosterUrl;
    }
    return source;
  }

  function createTimeoutError(message = 'Timed out') {
    const error = new Error(message);
    error.name = 'TimeoutError';
    return error;
  }

  function waitForMediaEvent(target, eventNames = [], {
    ready = null,
    timeoutMs = VIDEO_POSTER_CAPTURE_TIMEOUT_MS,
  } = {}) {
    return new Promise((resolve, reject) => {
      if (typeof ready === 'function' && ready()) {
        resolve();
        return;
      }

      const names = [...new Set((Array.isArray(eventNames) ? eventNames : [eventNames]).filter(Boolean))];
      const cleanup = () => {
        clearTimeout(timerId);
        names.forEach((name) => target.removeEventListener(name, onReady));
        target.removeEventListener('error', onError);
      };
      const finish = (callback) => {
        cleanup();
        callback();
      };
      const onReady = () => {
        if (typeof ready === 'function' && !ready()) return;
        finish(resolve);
      };
      const onError = () => {
        finish(() => reject(target.error || new Error('Media load failed')));
      };
      const timerId = setTimeout(() => {
        finish(() => reject(createTimeoutError('Media load timed out')));
      }, timeoutMs);

      names.forEach((name) => target.addEventListener(name, onReady));
      target.addEventListener('error', onError);
    });
  }

  async function waitForVideoFrame(video) {
    if (video.readyState >= 2 && video.videoWidth && video.videoHeight) return;
    await waitForMediaEvent(video, ['loadeddata', 'canplay', 'seeked'], {
      ready: () => video.readyState >= 2 && video.videoWidth && video.videoHeight,
    });
  }

  async function seekVideoFrame(video, time) {
    const duration = Number(video.duration || 0);
    const safeTime = duration > 0
      ? Math.min(Math.max(0, Number(time || 0)), Math.max(0, duration - 0.05))
      : Math.max(0, Number(time || 0));
    const epsilon = safeTime > 0 ? 0.02 : 0.001;
    if (Math.abs(Number(video.currentTime || 0) - safeTime) <= epsilon) {
      await waitForVideoFrame(video);
      return;
    }

    await new Promise((resolve, reject) => {
      const onSeeked = () => cleanup(resolve);
      const onError = () => cleanup(() => reject(video.error || new Error('Video seek failed')));
      const cleanup = (callback) => {
        clearTimeout(timerId);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        callback();
      };
      const timerId = setTimeout(() => cleanup(resolve), 650);
      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', onError, { once: true });
      try {
        video.currentTime = safeTime;
      } catch (error) {
        cleanup(() => reject(error));
      }
    });
    await waitForVideoFrame(video);
  }

  async function drawVideoPosterBlob(video) {
    const width = Number(video.videoWidth || 0);
    const height = Number(video.videoHeight || 0);
    if (!width || !height) return null;

    const scale = Math.min(1, VIDEO_POSTER_MAX_DIMENSION / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (typeof canvas.toBlob === 'function') {
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob && blob.size ? blob : null), VIDEO_POSTER_MIME, VIDEO_POSTER_QUALITY);
      });
    }

    const dataUrl = canvas.toDataURL(VIDEO_POSTER_MIME, VIDEO_POSTER_QUALITY);
    if (!dataUrl) return null;
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return blob && blob.size ? blob : null;
  }

  async function createAttachmentPosterBlob(source) {
    const sourceUrl = source instanceof Blob
      ? URL.createObjectURL(source)
      : String(source || '').trim();
    if (!sourceUrl) return null;

    const shouldRevokeUrl = source instanceof Blob;
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');

    try {
      video.src = sourceUrl;
      video.load?.();
      await waitForMediaEvent(video, ['loadedmetadata', 'loadeddata', 'canplay'], {
        ready: () => video.readyState >= 1 && video.videoWidth && video.videoHeight,
      });

      const duration = Number(video.duration || 0);
      const seekTargets = [...new Set(VIDEO_POSTER_CAPTURE_SEEKS
        .map((time) => {
          if (duration > 0) return Math.min(Math.max(0, Number(time || 0)), Math.max(0, duration - 0.05));
          return Math.max(0, Number(time || 0));
        })
        .filter((time) => Number.isFinite(time) && time >= 0))];

      if (!seekTargets.length) seekTargets.push(0);
      for (const seekTarget of seekTargets) {
        try {
          await seekVideoFrame(video, seekTarget);
          const posterBlob = await drawVideoPosterBlob(video);
          if (posterBlob) return posterBlob;
        } catch (error) {}
      }
    } catch (error) {
      return null;
    } finally {
      try {
        video.pause?.();
        video.removeAttribute('src');
        video.load?.();
      } catch (error) {}
      if (shouldRevokeUrl) {
        try { URL.revokeObjectURL(sourceUrl); } catch (error) {}
      }
    }

    return null;
  }

  function getAttachmentPosterBackfillKey(source) {
    if (!source || typeof source !== 'object') return '';
    const messageId = Number(source.id || 0);
    if (messageId > 0) return `message:${messageId}`;
    const storedName = String(source.file_stored || source.stored_name || source.storedName || '').trim();
    return storedName ? `file:${storedName}` : '';
  }

  async function ensureAttachmentPoster(source, { videoEl = null, onReady = null } = {}) {
    const existingPosterUrl = getAttachmentPosterUrl(source);
    if (existingPosterUrl) {
      applyPosterToVideoElement(videoEl, existingPosterUrl);
      if (typeof onReady === 'function') onReady(existingPosterUrl);
      return existingPosterUrl;
    }
    if (!source || typeof source !== 'object' || !isVideoAttachmentMessage(source) || isClientSideMessage(source)) return '';

    const backfillKey = getAttachmentPosterBackfillKey(source);
    if (!backfillKey || failedVideoPosterBackfills.has(backfillKey)) return '';

    let task = pendingVideoPosterBackfills.get(backfillKey);
    if (!task) {
      task = (async () => {
        const previewUrl = getAttachmentPreviewUrl(source);
        const posterBlob = await createAttachmentPosterBlob(previewUrl);
        if (!posterBlob) return '';

        const formData = new FormData();
        formData.append('poster', posterBlob, 'video-poster.jpg');
        const response = await api(`/api/messages/${Number(source.id || 0)}/poster`, {
          method: 'POST',
          body: formData,
        });
        const updatedMessage = response?.message || null;
        if (updatedMessage && typeof source === 'object') {
          Object.assign(source, updatedMessage);
          applyMessageUpdate(updatedMessage);
          return getAttachmentPosterUrl(updatedMessage);
        }
        markAttachmentPosterAvailable(source);
        return getStoredAttachmentPosterUrl(source.file_stored || source.stored_name || source.storedName || '');
      })().catch((error) => {
        failedVideoPosterBackfills.add(backfillKey);
        return '';
      }).finally(() => {
        pendingVideoPosterBackfills.delete(backfillKey);
      });
      pendingVideoPosterBackfills.set(backfillKey, task);
    }

    const posterUrl = await task;
    if (!posterUrl) return '';
    failedVideoPosterBackfills.delete(backfillKey);
    markAttachmentPosterAvailable(source);
    applyPosterToVideoElement(videoEl, posterUrl);
    if (typeof onReady === 'function') onReady(posterUrl);
    return posterUrl;
  }

  async function localAttachmentFromFile(file) {
    if (!file) return null;
    const mime = normalizeMimeType(file.type);
    const ext = fileExtension(file.name);
    const type = IMAGE_MIME_TYPES.has(mime) || IMAGE_EXTENSIONS.has(ext)
      ? 'image'
      : (AUDIO_MIME_TYPES.has(mime) || AUDIO_EXTENSIONS.has(ext)
          ? 'audio'
          : (VIDEO_MIME_TYPES.has(mime) || VIDEO_EXTENSIONS.has(ext) ? 'video' : 'document'));
    if (!type) return null;

    const attachment = {
      localId: makeClientId('f'),
      file,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      type,
    };
    if (type === 'video') {
      try {
        const posterBlob = await createAttachmentPosterBlob(file);
        if (posterBlob) attachment.posterBlob = posterBlob;
      } catch (error) {}
    }
    return attachment;
  }

  function makeClientId(prefix = 'c') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function isClientSideMessage(msg) {
    return Boolean(msg?.is_outbox || msg?.client_status || (typeof msg?.id === 'string' && msg.id.startsWith('c-')));
  }

  function normalizePoll(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const myOptionIds = [...new Set((Array.isArray(raw.my_option_ids) ? raw.my_option_ids : raw.myOptionIds || [])
      .map((value) => Number(value || 0))
      .filter((value) => Number.isInteger(value) && value > 0))];
    return {
      created_by: Number(raw.created_by || raw.createdBy || 0),
      closed_by: raw.closed_by == null && raw.closedBy == null ? null : Number(raw.closed_by || raw.closedBy || 0),
      style: normalizePollStyle(raw.style),
      allows_multiple: Boolean(raw.allows_multiple ?? raw.allowsMultiple),
      show_voters: Boolean(raw.show_voters ?? raw.showVoters),
      closes_at: raw.closes_at || raw.closesAt || null,
      closed_at: raw.closed_at || raw.closedAt || null,
      created_at: raw.created_at || raw.createdAt || null,
      is_closed: Boolean(raw.is_closed ?? raw.isClosed ?? raw.closed_at ?? raw.closedAt),
      total_votes: Number(raw.total_votes || raw.totalVotes || 0),
      total_voters: Number(raw.total_voters || raw.totalVoters || 0),
      my_option_ids: myOptionIds,
      options: (Array.isArray(raw.options) ? raw.options : []).map((option, index) => ({
        id: Number(option.id || 0),
        text: String(option.text || '').trim(),
        position: Number(option.position ?? index),
        vote_count: Number(option.vote_count || option.voteCount || 0),
        voted_by_me: Boolean(option.voted_by_me ?? option.votedByMe ?? myOptionIds.includes(Number(option.id || 0))),
      })).filter((option) => option.id > 0),
    };
  }

  function isPollMessage(msg) {
    return Boolean(normalizePoll(msg?.poll));
  }

  function isPulsePoll(pollOrMessage) {
    const poll = pollOrMessage?.poll ? normalizePoll(pollOrMessage.poll) : normalizePoll(pollOrMessage);
    return normalizePollStyle(poll?.style) === 'pulse';
  }

  function pulseInlineVotersCacheKey(messageId, optionId) {
    return `${Number(messageId || 0)}:${Number(optionId || 0)}`;
  }

  function getPulseInlineVotersRevision(messageId) {
    return Number(pulseInlineVotersRevision.get(Number(messageId || 0)) || 0);
  }

  function invalidatePulseInlineVotersForMessage(messageId) {
    const resolvedMessageId = Number(messageId || 0);
    if (!resolvedMessageId) return;
    const prefix = `${resolvedMessageId}:`;
    pulseInlineVotersRevision.set(resolvedMessageId, getPulseInlineVotersRevision(resolvedMessageId) + 1);
    [...pulseInlineVotersCache.keys()].forEach((key) => {
      if (key.startsWith(prefix)) pulseInlineVotersCache.delete(key);
    });
  }

  function getPulseVoterDisplayName(voter) {
    const displayName = String(voter?.display_name || '').trim();
    if (displayName) return displayName;
    const username = String(voter?.username || '').trim();
    if (username) return `@${username}`;
    return 'User';
  }

  function isPulseVoterOptionExpanded(messageId, optionId) {
    return expandedPulseVoterOptions.has(pulseInlineVotersCacheKey(messageId, optionId));
  }

  function getPulseVoterPopoverElement(popover = activePulseVoterPopover) {
    if (!messagesEl || !popover) return null;
    const key = pulseInlineVotersCacheKey(popover.messageId, popover.optionId);
    const slot = messagesEl.querySelector(`[data-poll-inline-voters="${key}"]`);
    if (!(slot instanceof Element)) return null;
    return slot.querySelector(`[data-poll-voter-popover][data-poll-voter-id="${Number(popover.voterId || 0)}"]`);
  }

  function schedulePulseVoterPopoverAutoHide(popover = activePulseVoterPopover) {
    if (!popover) return;
    clearTimeout(popover.autoHideTimer);
    popover.autoHideTimer = setTimeout(() => {
      if (activePulseVoterPopover !== popover) return;
      clearActivePulseVoterPopover();
    }, PULSE_VOTER_POPOVER_AUTOHIDE_MS);
  }

  function mountPulseVoterPopover(popover = activePulseVoterPopover) {
    if (!popover || activePulseVoterPopover !== popover) return;
    const el = getPulseVoterPopoverElement(popover);
    if (!(el instanceof HTMLElement)) return;
    schedulePulseVoterPopoverAutoHide(popover);
    openFloatingSurface(el);
  }

  function clearActivePulseVoterPopover({ skipRefresh = false, immediate = false } = {}) {
    const current = activePulseVoterPopover;
    if (!current) return;
    clearTimeout(current.autoHideTimer);
    current.autoHideTimer = null;
    const finalize = () => {
      clearTimeout(current.autoHideTimer);
      current.autoHideTimer = null;
      if (activePulseVoterPopover === current) activePulseVoterPopover = null;
      if (!skipRefresh) refreshPulseInlineVoterSlots(current.messageId, current.optionId);
    };
    const el = getPulseVoterPopoverElement(current);
    if (!(el instanceof HTMLElement) || skipRefresh) {
      finalize();
      return;
    }
    closeFloatingSurface(el, { immediate, onAfterClose: finalize });
  }

  function clearActivePulseVoterPopoverForMessage(messageId, { skipRefresh = false } = {}) {
    if (!activePulseVoterPopover || Number(activePulseVoterPopover.messageId) !== Number(messageId || 0)) return;
    clearActivePulseVoterPopover({ skipRefresh });
  }

  function bindPulseInlineVoterControls(scope, messageId) {
    const resolvedMessageId = Number(messageId || 0);
    if (!(scope instanceof Element) || !resolvedMessageId) return;
    scope.querySelectorAll('[data-poll-voter-avatar]').forEach((btn) => {
      if (btn.dataset.boundPulseVoterAvatar === '1') return;
      btn.dataset.boundPulseVoterAvatar = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePulseVoterPopover(
          resolvedMessageId,
          Number(btn.dataset.pollOptionId || 0),
          Number(btn.dataset.pollVoterId || btn.dataset.pollVoterAvatar || 0)
        );
      });
    });
    scope.querySelectorAll('[data-poll-voter-more]').forEach((btn) => {
      if (btn.dataset.boundPulseVoterMore === '1') return;
      btn.dataset.boundPulseVoterMore = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePulseVoterOptionExpanded(resolvedMessageId, Number(btn.dataset.pollOptionId || 0));
      });
    });
  }

  function togglePulseVoterOptionExpanded(messageId, optionId) {
    const resolvedMessageId = Number(messageId || 0);
    const resolvedOptionId = Number(optionId || 0);
    if (!resolvedMessageId || !resolvedOptionId) return;
    const key = pulseInlineVotersCacheKey(resolvedMessageId, resolvedOptionId);
    const next = new Set(expandedPulseVoterOptions);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expandedPulseVoterOptions = next;
    clearActivePulseVoterPopover({ skipRefresh: true });
    refreshPulseInlineVoterSlots(resolvedMessageId, resolvedOptionId);
  }

  function togglePulseVoterPopover(messageId, optionId, voterId) {
    const resolvedMessageId = Number(messageId || 0);
    const resolvedOptionId = Number(optionId || 0);
    const resolvedVoterId = Number(voterId || 0);
    if (!resolvedMessageId || !resolvedOptionId || !resolvedVoterId) return;
    const previous = activePulseVoterPopover;
    const isSame =
      previous &&
      Number(previous.messageId) === resolvedMessageId &&
      Number(previous.optionId) === resolvedOptionId &&
      Number(previous.voterId) === resolvedVoterId;
    if (isSame) {
      clearActivePulseVoterPopover();
      return;
    }
    if (previous) {
      const sameSlot =
        Number(previous.messageId) === resolvedMessageId &&
        Number(previous.optionId) === resolvedOptionId;
      clearActivePulseVoterPopover({ skipRefresh: sameSlot, immediate: true });
    }
    const next = { messageId: resolvedMessageId, optionId: resolvedOptionId, voterId: resolvedVoterId, autoHideTimer: null };
    activePulseVoterPopover = next;
    refreshPulseInlineVoterSlots(resolvedMessageId, resolvedOptionId);
    mountPulseVoterPopover(next);
  }

  function formatRelativeDuration(targetIso) {
    if (!targetIso) return '';
    const normalized = String(targetIso).includes('T') ? String(targetIso) : String(targetIso).replace(' ', 'T');
    const time = new Date(/[zZ]$|[+\-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`).getTime();
    if (!Number.isFinite(time)) return '';
    const diff = time - Date.now();
    if (diff <= 0) return 'soon';
    const minutes = Math.round(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(diff / 3600000);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(diff / 86400000);
    return `${days}d`;
  }

  function formatPollDeadline(poll) {
    if (!poll) return '';
    if (poll.is_closed) {
      return poll.closed_at ? `Closed ${formatTime(poll.closed_at)}` : 'Closed';
    }
    if (!poll.closes_at) return 'Open-ended';
    const relative = formatRelativeDuration(poll.closes_at);
    return relative ? `Ends in ${relative}` : `Ends ${formatTime(poll.closes_at)}`;
  }

  function getPollCompactFooterMeta(poll) {
    if (!poll) return null;
    if (poll.is_closed) {
      return { label: 'Closed', tone: 'closed' };
    }
    if (!poll.closes_at) return null;
    const relative = formatRelativeDuration(poll.closes_at);
    return {
      label: relative ? `Ends in ${relative}` : `Ends ${formatTime(poll.closes_at)}`,
      tone: 'deadline',
    };
  }

  function canClosePollMessage(msg) {
    const poll = normalizePoll(msg?.poll);
    if (!currentUser || !poll || poll.is_closed) return false;
    const chat = getChatById(msg?.chat_id || msg?.chatId || currentChatId);
    return Boolean(
      currentUser.is_admin ||
      Number(poll.created_by || 0) === Number(currentUser.id || 0) ||
      Number(chat?.created_by || 0) === Number(currentUser.id || 0)
    );
  }

  function setPollComposerStatus(message, type = '') {
    if (!pollComposerStatus) return;
    pollComposerStatus.textContent = message || '';
    pollComposerStatus.classList.toggle('is-error', type === 'error');
    pollComposerStatus.classList.toggle('is-success', type === 'success');
  }

  function readPollComposerForm() {
    const optionInputs = Array.from(pollOptionsList?.querySelectorAll('input[data-poll-option-index]') || []);
    const options = optionInputs.map((input) => input.value.trim()).filter(Boolean);
    return {
      question: String(pollQuestionInput?.value || '').trim(),
      options,
      style: normalizePollStyle(pollComposerStyle),
      allows_multiple: !!$('#pollAllowMultiple')?.checked,
      show_voters: !!$('#pollShowVoters')?.checked,
      close_preset: String($('#pollClosePreset')?.value || '').trim() || null,
    };
  }

  function renderPollComposerOptionInputs() {
    if (!pollOptionsList) return;
    pollComposerOptions = pollComposerOptions.slice(0, POLL_MAX_OPTIONS);
    while (pollComposerOptions.length < POLL_MIN_OPTIONS) pollComposerOptions.push('');
    pollOptionsList.innerHTML = pollComposerOptions.map((value, index) => `
      <div class="poll-option-editor" data-poll-option-row="${index}">
        <span class="poll-option-index">${index + 1}</span>
        <input
          type="text"
          class="modal-input"
          maxlength="160"
          data-poll-option-index="${index}"
          placeholder="Option ${index + 1}"
          value="${esc(value)}"
        >
        <button
          type="button"
          class="poll-option-remove"
          data-poll-option-remove="${index}"
          ${pollComposerOptions.length <= POLL_MIN_OPTIONS ? 'disabled' : ''}
          title="Remove option"
        >✕</button>
      </div>
    `).join('');
  }

  function refreshPollComposerActionState() {
    const enabled = Boolean(currentChatId && !isCurrentNotesChat() && !editTo && pendingFiles.length === 0);
    if (pollBtn) {
      pollBtn.disabled = !enabled;
      pollBtn.classList.toggle('disabled', !enabled);
    }
    const mobilePollBtn = $('#attachMenuPoll');
    if (mobilePollBtn) {
      mobilePollBtn.disabled = !enabled;
      mobilePollBtn.classList.toggle('disabled', !enabled);
    }
  }

  function buildPollComposerPreviewMessage() {
    const form = readPollComposerForm();
    const fallbackOptions = ['Friday night', 'Saturday brunch', 'Sunday reset', 'Next week'];
    const optionTexts = [...form.options];
    while (optionTexts.length < 3) optionTexts.push(fallbackOptions[optionTexts.length] || `Option ${optionTexts.length + 1}`);
    const previewTexts = optionTexts.slice(0, Math.min(Math.max(optionTexts.length, 3), 5));
    const previewVotes = previewTexts.map((_, index) => Math.max(2, previewTexts.length * 4 - index * 2));
    const myOptionIds = form.allows_multiple
      ? previewTexts.slice(0, Math.min(2, previewTexts.length)).map((_, index) => index + 1)
      : [1];
    const totalVotes = previewVotes.reduce((sum, count) => sum + count, 0);
    const closesAt = form.close_preset && POLL_CLOSE_PRESET_MS[form.close_preset]
      ? new Date(Date.now() + POLL_CLOSE_PRESET_MS[form.close_preset]).toISOString()
      : null;
    return {
      id: -1,
      chat_id: currentChatId || 0,
      user_id: currentUser?.id || 0,
      text: form.question || 'Where should we go this weekend?',
      poll: {
        created_by: currentUser?.id || 0,
        closed_by: null,
        style: form.style,
        allows_multiple: form.allows_multiple,
        show_voters: form.show_voters,
        closes_at: closesAt,
        closed_at: null,
        created_at: new Date().toISOString(),
        is_closed: false,
        total_votes: totalVotes,
        total_voters: form.allows_multiple ? Math.max(6, Math.round(totalVotes * 0.72)) : totalVotes,
        my_option_ids: myOptionIds,
        options: previewTexts.map((text, index) => ({
          id: index + 1,
          text,
          position: index,
          vote_count: previewVotes[index] || 0,
          voted_by_me: myOptionIds.includes(index + 1),
        })),
      },
    };
  }

  function refreshPollComposerPreview() {
    if (!pollComposerPreview) return;
    const previewMessage = buildPollComposerPreviewMessage();
    const styleMeta = pollStyleMeta(previewMessage.poll?.style);
    const questionClass = isPulsePoll(previewMessage.poll)
      ? 'poll-composer-preview-question poll-question-block'
      : 'poll-composer-preview-question';
    pollComposerPreview.innerHTML = `
      <div class="poll-composer-preview-shell">
        <div class="poll-composer-preview-meta">
          <span class="poll-composer-preview-style">${esc(styleMeta.name)} style</span>
          <span class="poll-composer-preview-note">${esc(styleMeta.note)}</span>
        </div>
        <div class="poll-composer-preview-message">
          <div class="${questionClass}">${esc(previewMessage.text || '')}</div>
          ${renderPollCard(previewMessage, { preview: true })}
        </div>
      </div>
    `;
  }

  function resetPollComposer() {
    pollComposerOptions = ['', ''];
    pollComposerStyle = 'pulse';
    if (pollQuestionInput) pollQuestionInput.value = '';
    if ($('#pollAllowMultiple')) $('#pollAllowMultiple').checked = false;
    if ($('#pollShowVoters')) $('#pollShowVoters').checked = false;
    if ($('#pollClosePreset')) $('#pollClosePreset').value = '';
    renderPollComposerOptionInputs();
    syncPollComposerStyleUi();
    setPollComposerStatus('');
    refreshPollComposerPreview();
  }

  function openPollComposer() {
    if (!currentChatId) return;
    if (isCurrentNotesChat()) {
      alert('Polls are not available in notes chat.');
      return;
    }
    if (editTo) {
      alert('Finish editing before creating a poll.');
      return;
    }
    if (pendingFiles.length > 0) {
      alert('Remove pending attachments before creating a poll.');
      return;
    }
    resetPollComposer();
    if (pollQuestionInput) pollQuestionInput.value = String(msgInput?.value || '').trim();
    refreshPollComposerPreview();
    syncChatAreaMetrics();
    openModal('pollComposerModal', { opener: pollBtn || attachBtn });
    requestAnimationFrame(() => pollQuestionInput?.focus());
  }

  function buildOptimisticPollState(poll, nextOptionIds) {
    const previousSet = new Set((poll?.my_option_ids || []).map((id) => Number(id)));
    const nextSet = new Set((Array.isArray(nextOptionIds) ? nextOptionIds : []).map((id) => Number(id)));
    const wasVoter = previousSet.size > 0;
    const willVoter = nextSet.size > 0;
    return {
      ...poll,
      total_votes: Math.max(0, Number(poll.total_votes || 0) - previousSet.size + nextSet.size),
      total_voters: Math.max(0, Number(poll.total_voters || 0) - (wasVoter ? 1 : 0) + (willVoter ? 1 : 0)),
      my_option_ids: [...nextSet],
      options: (poll.options || []).map((option) => ({
        ...option,
        vote_count: Math.max(
          0,
          Number(option.vote_count || 0) - (previousSet.has(Number(option.id)) ? 1 : 0) + (nextSet.has(Number(option.id)) ? 1 : 0)
        ),
        voted_by_me: nextSet.has(Number(option.id)),
      })),
    };
  }

  function nextPollVoteSelection(poll, optionId) {
    const selected = new Set((poll?.my_option_ids || []).map((id) => Number(id)));
    const id = Number(optionId || 0);
    if (!id) return [];
    if (poll?.allows_multiple) {
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      return [...selected];
    }
    if (selected.has(id)) return [];
    return [id];
  }

  function replaceRenderedMessage(nextMsg, options = {}) {
    if (!nextMsg?.id) return false;
    const row = messagesEl.querySelector(`[data-msg-id="${nextMsg.id}"]`);
    if (!row) return false;
    const preserveAnchor = options.preserveAnchor?.messageId ? { ...options.preserveAnchor } : null;
    const restoreAttempts = Number(options.restoreAttempts || 2);
    const prepared = { ...nextMsg };
    if (row.querySelector('.msg-status.read')) prepared.is_read = true;
    const showName = Boolean(row.querySelector('.msg-sender'));
    const replacement = createMessageEl(prepared, showName);
    row.replaceWith(replacement);
    rememberDisplayedMessage(prepared.id);
    if (preserveAnchor) {
      requestAnimationFrame(() => restoreScrollAnchor(preserveAnchor, restoreAttempts));
    }
    updateScrollBottomButton();
    return true;
  }

  function replaceRenderedPollCard(row, nextMsg) {
    if (!row || !nextMsg?.poll) return false;
    const currentCard = row.querySelector('.poll-card');
    if (!currentCard) return false;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderPollCard(nextMsg, { liveUpdate: true }).trim();
    const nextCard = wrapper.firstElementChild;
    if (!nextCard) return false;
    currentCard.replaceWith(nextCard);
    row.__messageData = { ...nextMsg };
    row.classList.toggle('poll-message', Boolean(!nextMsg.is_deleted && nextMsg.poll));
    bindPollControls(row);
    hydratePulseInlineVoters(row);
    return true;
  }

  function applyPollUpdate(chatId, messageId, poll) {
    const normalizedPoll = normalizePoll(poll);
    if (!normalizedPoll) return;
    const id = Number(messageId || 0);
    if (!id) return;
    clearActivePulseVoterPopoverForMessage(id, { skipRefresh: true });
    if (isPulsePoll(normalizedPoll) && normalizedPoll.show_voters) {
      invalidatePulseInlineVotersForMessage(id);
    }
    const resolvedChatId = Number(chatId || currentChatId || 0);
    if (resolvedChatId && window.messageCache?.patchMessage) {
      window.messageCache.patchMessage(resolvedChatId, id, { poll: normalizedPoll }).catch(() => {});
    }
    const row = messagesEl.querySelector(`[data-msg-id="${id}"]`);
    if (!row || Number(currentChatId || 0) !== resolvedChatId) return;
    const nextMsg = { ...(row.__messageData || {}), poll: normalizedPoll };
    if (!replaceRenderedPollCard(row, nextMsg)) {
      replaceRenderedMessage(nextMsg);
    }
  }

  async function submitPollComposer() {
    if (!currentChatId) return;
    const payload = readPollComposerForm();
    if (!payload.question) {
      setPollComposerStatus('Question is required', 'error');
      return;
    }
    if (payload.options.length < POLL_MIN_OPTIONS || payload.options.length > POLL_MAX_OPTIONS) {
      setPollComposerStatus(`Use ${POLL_MIN_OPTIONS}-${POLL_MAX_OPTIONS} filled options`, 'error');
      return;
    }
    const uniqueOptions = payload.options.map((option) => option.toLowerCase());
    if (new Set(uniqueOptions).size !== uniqueOptions.length) {
      setPollComposerStatus('Options must be unique', 'error');
      return;
    }

    setPollComposerStatus('Sending...');
    try {
      const message = await api(`/api/chats/${currentChatId}/messages`, {
        method: 'POST',
        body: {
          text: payload.question,
          replyToId: replyTo?.id || null,
          poll: {
            style: payload.style,
            options: payload.options,
            allows_multiple: payload.allows_multiple,
            show_voters: payload.show_voters,
            close_preset: payload.close_preset,
          },
        },
      });
      closeModal('pollComposerModal');
      msgInput.value = '';
      autoResize();
      syncMentionOpenButton();
      clearReply();
      window.BananzaVoiceHooks?.refreshComposerState?.();
      if (message?.chat_id) {
        updateChatListLastMessage(message);
        try { window.messageCache?.upsertMessage?.(message).catch(() => {}); } catch (e) {}
        if (Number(message.chat_id) === Number(currentChatId) && !isMessageDisplayed(message.id)) {
          appendMessage(message);
          scrollToBottom(false, true);
        }
      }
      playAppSound('send');
    } catch (error) {
      setPollComposerStatus(error.message || 'Could not send poll', 'error');
    }
  }

  async function togglePollVote(messageId, optionId) {
    const row = messagesEl.querySelector(`[data-msg-id="${messageId}"]`);
    const msg = row?.__messageData || {};
    const poll = normalizePoll(msg.poll);
    if (!poll || poll.is_closed || pollVotePending.has(Number(messageId))) return;
    const nextSelection = nextPollVoteSelection(poll, optionId);
    const optimisticPoll = buildOptimisticPollState(poll, nextSelection);
    pollVotePending.add(Number(messageId));
    applyPollUpdate(msg.chat_id, messageId, optimisticPoll);
    try {
      const data = await api(`/api/messages/${messageId}/poll-vote`, {
        method: 'POST',
        body: { optionIds: nextSelection },
      });
      pollVotePending.delete(Number(messageId));
      if (data?.poll) applyPollUpdate(msg.chat_id, messageId, data.poll);
    } catch (error) {
      pollVotePending.delete(Number(messageId));
      if (error?.poll) applyPollUpdate(msg.chat_id, messageId, error.poll);
      else applyPollUpdate(msg.chat_id, messageId, poll);
      showCenterToast(error.message || 'Could not update vote');
    }
  }

  async function closePollMessage(messageId) {
    const row = messagesEl.querySelector(`[data-msg-id="${messageId}"]`);
    const msg = row?.__messageData || {};
    if (!canClosePollMessage(msg) || pollClosePending.has(Number(messageId))) return;
    pollClosePending.add(Number(messageId));
    applyPollUpdate(msg.chat_id, messageId, { ...normalizePoll(msg.poll), is_closed: false });
    try {
      const data = await api(`/api/messages/${messageId}/poll-close`, { method: 'POST' });
      pollClosePending.delete(Number(messageId));
      if (data?.poll) applyPollUpdate(msg.chat_id, messageId, data.poll);
    } catch (error) {
      pollClosePending.delete(Number(messageId));
      applyPollUpdate(msg.chat_id, messageId, msg.poll);
      showCenterToast(error.message || 'Could not close poll');
    }
  }

  function pollAccentVar(index = 0) {
    return `var(--poll-accent-${(Number(index || 0) % 6) + 1})`;
  }

  function buildPollRenderState(message, { preview = false, liveUpdate = false } = {}) {
    const poll = normalizePoll(message?.poll);
    if (!poll) return null;
    const messageId = preview ? 0 : Number(message?.id || 0);
    const totalVotes = Math.max(0, Number(poll.total_votes || 0));
    const interactionLocked = preview || pollVotePending.has(messageId) || pollClosePending.has(messageId);
    return {
      preview,
      liveUpdate,
      messageId,
      poll,
      totalVotes,
      canClose: !preview && canClosePollMessage(message),
      interactionLocked,
      options: (poll.options || []).map((option, index) => {
        const voteCount = Math.max(0, Number(option.vote_count || 0));
        return {
          ...option,
          index,
          accentVar: pollAccentVar(index),
          selected: !!option.voted_by_me,
          voteCount,
          percentage: totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0,
          voteLabel: voteCount === 1 ? '1 vote' : `${voteCount} votes`,
          voterLabel: voteCount === 1 ? '1 voter' : `${voteCount} voters`,
          mark: poll.allows_multiple ? '✓' : '●',
        };
      }),
    };
  }

  function buildPollOrbitGradient(options = [], totalVotes = 0) {
    if (!totalVotes) return 'conic-gradient(rgba(255,255,255,.08) 0deg 360deg)';
    let current = 0;
    const segments = [];
    options.forEach((option) => {
      const share = Number(option.voteCount || 0) / totalVotes;
      if (share <= 0) return;
      const next = current + share * 360;
      segments.push(`${option.accentVar} ${current.toFixed(2)}deg ${next.toFixed(2)}deg`);
      current = next;
    });
    if (current < 360) segments.push(`rgba(255,255,255,.08) ${current.toFixed(2)}deg 360deg`);
    return `conic-gradient(${segments.join(', ')})`;
  }

  function renderPollCloseButton(state, extraClass = '') {
    if (!state.canClose) return '';
    return `<button type="button" class="poll-close-btn${extraClass ? ` ${extraClass}` : ''}" data-poll-close="${state.messageId}" ${state.poll.is_closed || state.interactionLocked ? 'disabled' : ''}>Close</button>`;
  }

  function renderPollCompactFooter(state, extraClass = '') {
    const meta = getPollCompactFooterMeta(state?.poll);
    const closeButton = renderPollCloseButton(state);
    if (!meta && !closeButton) return '';
    return `
      <div class="poll-card-footer poll-card-footer--minimal${extraClass ? ` ${extraClass}` : ''}">
        ${meta ? `<span class="poll-card-footer-meta is-${meta.tone}">${esc(meta.label)}</span>` : ''}
        ${closeButton}
      </div>
    `;
  }

  function renderPollVotersButton(state, option, label = 'View voters') {
    if (!state.poll.show_voters) return '<span></span>';
    return `<button
      type="button"
      class="poll-option-voters"
      data-poll-voters="${state.messageId}"
      data-poll-option-id="${Number(option.id)}"
      ${state.preview || option.voteCount === 0 ? 'disabled' : ''}
    >${label}</button>`;
  }

  function renderPulseInlineVoterAvatar(voter, { placeholder = false, messageId = 0, optionId = 0 } = {}) {
    const background = esc(voter?.avatar_color || '#6f7f95');
    const name = getPulseVoterDisplayName(voter);
    const title = placeholder ? '' : esc(name);
    const avatarHtml = !placeholder && voter?.avatar_url
      ? `<span class="poll-pulse-voter-avatar" style="--poll-inline-avatar-bg:${background};" title="${title}">
          <img class="avatar-img" src="${esc(voter.avatar_url)}" alt="${title}" loading="lazy" onerror="this.remove()">
        </span>`
      : `<span class="poll-pulse-voter-avatar${placeholder ? ' poll-pulse-voter-avatar--placeholder' : ''}" style="--poll-inline-avatar-bg:${background};"${title ? ` title="${title}"` : ''}>${placeholder ? '' : esc(initials(voter?.display_name || voter?.username || 'V'))}</span>`;
    if (placeholder) {
      return `<span class="poll-pulse-voter-entry">${avatarHtml}</span>`;
    }
    const voterId = Number(voter?.id || 0);
    const popoverOpen = Boolean(
      activePulseVoterPopover &&
      Number(activePulseVoterPopover.messageId) === Number(messageId) &&
      Number(activePulseVoterPopover.optionId) === Number(optionId) &&
      Number(activePulseVoterPopover.voterId) === voterId
    );
    return `
      <span class="poll-pulse-voter-entry">
        <button
          type="button"
          class="poll-pulse-voter-avatar-btn"
          data-poll-voter-avatar="${voterId}"
          data-poll-option-id="${Number(optionId)}"
          data-poll-voter-id="${voterId}"
          aria-label="${title}"
          title="${title}"
        >
          ${avatarHtml}
        </button>
        ${popoverOpen ? `<span class="poll-pulse-voter-popover hidden" data-poll-voter-popover data-poll-option-id="${Number(optionId)}" data-poll-voter-id="${voterId}">${esc(name)}</span>` : ''}
      </span>
    `;
  }

  function renderPulseInlineVoterStack(voters = [], totalCount = 0, { preview = false, messageId = 0, optionId = 0 } = {}) {
    const resolvedTotal = Math.max(0, Number(totalCount || voters.length || 0));
    if (resolvedTotal <= 0) return '';
    const overflow = Math.max(0, resolvedTotal - PULSE_INLINE_VOTER_LIMIT);
    const canExpand = overflow > 0;
    const expanded = !preview && canExpand && isPulseVoterOptionExpanded(messageId, optionId);
    const visible = preview || !expanded
      ? (Array.isArray(voters) ? voters : []).slice(0, PULSE_INLINE_VOTER_LIMIT)
      : (Array.isArray(voters) ? voters : []);
    const label = resolvedTotal === 1 ? '1 voter' : `${resolvedTotal} voters`;
    const toggleHtml = canExpand
      ? (
        preview
          ? `<span class="poll-pulse-voter-more is-static" aria-hidden="true">+${overflow}</span>`
          : `<button
              type="button"
              class="poll-pulse-voter-more${expanded ? ' is-expanded' : ''}"
              data-poll-voter-more="${pulseInlineVotersCacheKey(messageId, optionId)}"
              data-poll-option-id="${Number(optionId)}"
              aria-expanded="${expanded ? 'true' : 'false'}"
              aria-label="${expanded ? `Collapse ${overflow} extra voters` : `Show ${overflow} more voters`}"
            >${expanded ? `&minus;${overflow}` : `+${overflow}`}</button>`
      )
      : '';
    return `
      <span class="poll-pulse-voter-stack${expanded ? ' is-expanded' : ''}" aria-label="${esc(label)}">
        ${visible.map((voter) => renderPulseInlineVoterAvatar(voter, { placeholder: preview || !!voter?.placeholder, messageId, optionId })).join('')}
        ${toggleHtml}
      </span>
    `;
  }

  function buildPulsePreviewVoters(totalCount = 0) {
    const resolvedTotal = Math.max(0, Number(totalCount || 0));
    return Array.from({ length: Math.min(resolvedTotal, PULSE_INLINE_VOTER_LIMIT) }, (_, index) => ({
      placeholder: true,
      avatar_color: PULSE_PREVIEW_AVATAR_COLORS[index % PULSE_PREVIEW_AVATAR_COLORS.length],
    }));
  }

  function renderPulseInlineVoterSummaryContent({ messageId = 0, poll = null, option = null, preview = false } = {}) {
    const voteCount = Math.max(0, Number((option?.voteCount ?? option?.vote_count) || 0));
    const fallbackLabel = esc(option?.voterLabel || (voteCount === 1 ? '1 voter' : `${voteCount} voters`));
    if (!poll || !option) return `<span class="poll-pulse-voter-count">${fallbackLabel}</span>`;
    if (!poll.show_voters) {
      return `<span class="poll-pulse-voter-count">${fallbackLabel}</span>`;
    }
    if (preview) {
      const previewVoters = buildPulsePreviewVoters(voteCount);
      return previewVoters.length
        ? renderPulseInlineVoterStack(previewVoters, voteCount, { preview: true, messageId, optionId: option.id })
        : `<span class="poll-pulse-voter-count">${fallbackLabel}</span>`;
    }
    const cachedVoters = pulseInlineVotersCache.get(pulseInlineVotersCacheKey(messageId, option.id));
    if (Array.isArray(cachedVoters) && cachedVoters.length) {
      return renderPulseInlineVoterStack(cachedVoters, voteCount, { messageId, optionId: option.id });
    }
    return `<span class="poll-pulse-voter-count">${fallbackLabel}</span>`;
  }

  function renderPulseInlineVoterSummary(state, option) {
    const messageId = state.preview ? 0 : state.messageId;
    const key = state.preview ? '' : pulseInlineVotersCacheKey(messageId, option.id);
    return `<span class="poll-pulse-voter-summary"${key ? ` data-poll-inline-voters="${key}" data-poll-option-id="${Number(option.id)}"` : ''}>
      ${renderPulseInlineVoterSummaryContent({ messageId, poll: state.poll, option, preview: state.preview })}
    </span>`;
  }

  function refreshPulseInlineVoterSlots(messageId, optionId = null) {
    if (!messagesEl) return;
    const resolvedMessageId = Number(messageId || 0);
    if (!resolvedMessageId) return;
    const selector = optionId
      ? `[data-poll-inline-voters="${pulseInlineVotersCacheKey(resolvedMessageId, optionId)}"]`
      : `[data-poll-inline-voters^="${resolvedMessageId}:"]`;
    messagesEl.querySelectorAll(selector).forEach((slot) => {
      const row = slot.closest('.msg-row');
      const poll = normalizePoll(row?.__messageData?.poll);
      const resolvedOptionId = Number(optionId || slot.dataset.pollOptionId || 0);
      const option = (poll?.options || []).find((item) => Number(item.id) === resolvedOptionId);
      if (!poll || !isPulsePoll(poll) || !option) return;
      slot.innerHTML = renderPulseInlineVoterSummaryContent({
        messageId: resolvedMessageId,
        poll,
        option,
        preview: false,
      });
      bindPulseInlineVoterControls(slot, resolvedMessageId);
      if (
        activePulseVoterPopover &&
        Number(activePulseVoterPopover.messageId) === resolvedMessageId &&
        Number(activePulseVoterPopover.optionId) === resolvedOptionId
      ) {
        mountPulseVoterPopover(activePulseVoterPopover);
      }
    });
  }

  function ensurePulseInlineVoters(messageId, optionId) {
    const resolvedMessageId = Number(messageId || 0);
    const resolvedOptionId = Number(optionId || 0);
    if (!resolvedMessageId || !resolvedOptionId) return Promise.resolve([]);
    const cacheKey = pulseInlineVotersCacheKey(resolvedMessageId, resolvedOptionId);
    if (pulseInlineVotersCache.has(cacheKey)) {
      refreshPulseInlineVoterSlots(resolvedMessageId, resolvedOptionId);
      return Promise.resolve(pulseInlineVotersCache.get(cacheKey) || []);
    }
    const revision = getPulseInlineVotersRevision(resolvedMessageId);
    const pendingKey = `${cacheKey}:${revision}`;
    if (pulseInlineVotersPending.has(pendingKey)) {
      return pulseInlineVotersPending.get(pendingKey);
    }
    const request = api(`/api/messages/${resolvedMessageId}/poll-voters?optionId=${resolvedOptionId}`)
      .then((data) => {
        const voters = Array.isArray(data?.voters) ? data.voters : [];
        if (getPulseInlineVotersRevision(resolvedMessageId) !== revision) return voters;
        pulseInlineVotersCache.set(cacheKey, voters);
        refreshPulseInlineVoterSlots(resolvedMessageId, resolvedOptionId);
        return voters;
      })
      .catch(() => [])
      .finally(() => {
        pulseInlineVotersPending.delete(pendingKey);
      });
    pulseInlineVotersPending.set(pendingKey, request);
    return request;
  }

  function hydratePulseInlineVoters(row) {
    const messageId = Number(row?.dataset?.msgId || row?.__messageData?.id || 0);
    const poll = normalizePoll(row?.__messageData?.poll);
    if (!row || !messageId || !poll || !isPulsePoll(poll) || !poll.show_voters) return;
    if (!row.isConnected) {
      if (!row.__pulseInlineHydrateScheduled) {
        row.__pulseInlineHydrateScheduled = true;
        requestAnimationFrame(() => {
          row.__pulseInlineHydrateScheduled = false;
          hydratePulseInlineVoters(row);
        });
      }
      return;
    }
    (poll.options || []).forEach((option) => {
      if (Math.max(0, Number(option.vote_count || 0)) <= 0) return;
      ensurePulseInlineVoters(messageId, Number(option.id)).catch(() => {});
    });
  }

  function renderPulsePollCard(state) {
    const optionsHtml = state.options.map((option) => `
      <div class="poll-pulse-option${option.selected ? ' selected' : ''}" style="--poll-option-accent:${option.accentVar};">
        <span class="poll-pulse-option-glow"></span>
        <div
          class="poll-pulse-option-main"
          data-poll-vote="${state.messageId}"
          data-poll-option-id="${Number(option.id)}"
          role="button"
          tabindex="${state.poll.is_closed || state.interactionLocked ? '-1' : '0'}"
          aria-disabled="${state.poll.is_closed || state.interactionLocked ? 'true' : 'false'}"
        >
          <span class="poll-pulse-option-text">${esc(option.text)}</span>
          <span class="poll-pulse-progress" aria-hidden="true">
            <span class="poll-pulse-progress-track">
              <span class="poll-pulse-progress-fill" style="width:${option.percentage}%"></span>
              <span class="poll-pulse-progress-percent">${option.percentage}%</span>
            </span>
          </span>
          ${renderPulseInlineVoterSummary(state, option)}
        </div>
      </div>
    `).join('');

    return `
      <div class="poll-card poll-card--pulse${state.preview ? ' is-preview' : ''}${state.liveUpdate ? ' is-live-update' : ''}">
        <div class="poll-pulse-options">${optionsHtml}</div>
        ${renderPollCompactFooter(state)}
      </div>
    `;
  }

  function renderStackPollCard(state) {
    const optionsHtml = state.options.map((option) => `
      <div class="poll-stack-option${option.selected ? ' selected' : ''}" style="--poll-option-accent:${option.accentVar};">
        <button
          type="button"
          class="poll-stack-option-main"
          data-poll-vote="${state.messageId}"
          data-poll-option-id="${Number(option.id)}"
          ${state.poll.is_closed || state.interactionLocked ? 'disabled' : ''}
        >
          <span class="poll-stack-option-top">
            <span class="poll-stack-option-left">
              <span class="poll-stack-option-dot"></span>
              <span class="poll-stack-option-text">${esc(option.text)}</span>
            </span>
            <span class="poll-stack-option-right">
              <span class="poll-stack-option-percent">${option.percentage}%</span>
              <span class="poll-stack-option-check${state.poll.allows_multiple ? ' multi' : ''}">${option.selected ? option.mark : ''}</span>
            </span>
          </span>
          <span class="poll-stack-option-bar"><i style="width:${option.percentage}%"></i></span>
        </button>
        <div class="poll-stack-option-footer">
          <span class="poll-stat-chip">${option.voteLabel}</span>
          ${renderPollVotersButton(state, option)}
        </div>
      </div>
    `).join('');

    return `
      <div class="poll-card poll-card--stack${state.preview ? ' is-preview' : ''}${state.liveUpdate ? ' is-live-update' : ''}">
        <div class="poll-stack-options">${optionsHtml}</div>
        ${renderPollCompactFooter(state)}
      </div>
    `;
  }

  function renderOrbitPollCard(state) {
    const orbitGradient = buildPollOrbitGradient(state.options, state.totalVotes);
    const optionsHtml = state.options.map((option) => `
      <div class="poll-orbit-option${option.selected ? ' selected' : ''}" style="--poll-option-accent:${option.accentVar};">
        <button
          type="button"
          class="poll-orbit-option-main"
          data-poll-vote="${state.messageId}"
          data-poll-option-id="${Number(option.id)}"
          ${state.poll.is_closed || state.interactionLocked ? 'disabled' : ''}
        >
          <span class="poll-orbit-option-swatch">${option.index + 1}</span>
          <span class="poll-orbit-option-copy">
            <strong>${esc(option.text)}</strong>
            <small>${option.voteLabel}</small>
          </span>
          <span class="poll-orbit-option-side">
            <em>${option.percentage}%</em>
            <span class="poll-orbit-option-check${state.poll.allows_multiple ? ' multi' : ''}" aria-hidden="true"></span>
          </span>
        </button>
        <span class="poll-orbit-option-bar"><i style="width:${option.percentage}%"></i></span>
        ${state.poll.show_voters ? `<div class="poll-orbit-option-footer">${renderPollVotersButton(state, option, 'Voters')}</div>` : ''}
      </div>
    `).join('');

    return `
      <div class="poll-card poll-card--orbit${state.preview ? ' is-preview' : ''}${state.liveUpdate ? ' is-live-update' : ''}">
        <div class="poll-orbit-hero poll-orbit-hero--solo">
          <div class="poll-orbit-chart" style="--poll-orbit-chart:${orbitGradient};">
            <div class="poll-orbit-chart-center">
              <strong>${state.totalVotes || 0}</strong>
              <small>${state.totalVotes === 1 ? 'vote' : 'votes'}</small>
            </div>
          </div>
        </div>
        <div class="poll-orbit-options">${optionsHtml}</div>
        ${renderPollCompactFooter(state)}
      </div>
    `;
  }

  function resetPollVotersModal() {
    pollVotersState = null;
    setPollStyleSurface(pollVotersModal, 'pulse');
    if (pollVotersTitle) pollVotersTitle.textContent = 'Voters';
    if (pollVotersMeta) {
      pollVotersMeta.innerHTML = '';
      pollVotersMeta.classList.add('hidden');
    }
    if (pollVotersStatus) {
      pollVotersStatus.textContent = '';
      pollVotersStatus.classList.remove('is-error', 'is-success');
    }
    if (pollVotersList) pollVotersList.innerHTML = '';
  }

  async function openPollVotersModal(messageId, optionId) {
    const row = messagesEl.querySelector(`[data-msg-id="${messageId}"]`);
    const msg = row?.__messageData || {};
    const poll = normalizePoll(msg.poll);
    const option = (poll?.options || []).find((item) => Number(item.id) === Number(optionId));
    const optionIndex = Math.max(0, (poll?.options || []).findIndex((item) => Number(item.id) === Number(optionId)));
    if (!poll || !poll.show_voters || !option) return;
    setPollStyleSurface(pollVotersModal, poll.style);
    pollVotersState = { messageId: Number(messageId), optionId: Number(optionId) };
    if (pollVotersTitle) pollVotersTitle.textContent = `Voters: ${option.text}`;
    if (pollVotersMeta) {
      pollVotersMeta.innerHTML = `
        <span class="poll-voters-chip" style="--poll-option-accent:${pollAccentVar(optionIndex)};">${Math.max(0, Number(option.vote_count || 0))} votes</span>
        <span class="poll-voters-chip">${poll.allows_multiple ? 'Multiple choice' : 'Single choice'}</span>
        <span class="poll-voters-chip">${esc(formatPollDeadline(poll))}</span>
      `;
      pollVotersMeta.classList.remove('hidden');
    }
    if (pollVotersStatus) {
      pollVotersStatus.textContent = 'Loading...';
      pollVotersStatus.classList.remove('is-error', 'is-success');
    }
    if (pollVotersList) pollVotersList.innerHTML = '';
    syncChatAreaMetrics();
    openModal('pollVotersModal');
    try {
      const data = await api(`/api/messages/${messageId}/poll-voters?optionId=${optionId}`);
      if (!pollVotersState || pollVotersState.messageId !== Number(messageId) || pollVotersState.optionId !== Number(optionId)) return;
      const voters = Array.isArray(data?.voters) ? data.voters : [];
      if (pollVotersStatus) pollVotersStatus.textContent = voters.length ? '' : 'No voters yet';
      if (pollVotersList) {
        pollVotersList.innerHTML = voters.map((voter) => `
          <div class="poll-voter-item">
            ${avatarHtml(voter.display_name, voter.avatar_color, voter.avatar_url, 32)}
            <div class="poll-voter-meta">
              <span class="poll-voter-name">${esc(voter.display_name || voter.username || 'User')}</span>
              <span class="poll-voter-time">${esc(voter.voted_at ? `${formatDate(voter.voted_at)} ${formatTime(voter.voted_at)}` : '')}</span>
            </div>
          </div>
        `).join('') || '<div class="settings-hint">No voters yet</div>';
      }
    } catch (error) {
      if (pollVotersStatus) {
        pollVotersStatus.textContent = error.message || 'Could not load voters';
        pollVotersStatus.classList.add('is-error');
      }
    }
  }

  function renderPollCard(message, options = {}) {
    const state = buildPollRenderState(message, options);
    if (!state) return '';
    const style = normalizePollStyle(state.poll?.style);
    if (style === 'stack') return renderStackPollCard(state);
    if (style === 'orbit') return renderOrbitPollCard(state);
    return renderPulsePollCard(state);
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

  function isAiBotDirectoryUser(user) {
    return Number(user?.is_ai_bot) !== 0;
  }

  function botMentionText(user) {
    const mention = String(user?.ai_bot_mention || '').trim();
    if (mention) return `@${mention}`;
    const username = String(user?.username || '').trim();
    return username ? `@${username}` : '';
  }

  function botModelText(user) {
    return String(user?.ai_bot_model || '').trim();
  }

  function botChatMemberMetaText(user) {
    return [botMentionText(user), botModelText(user)].filter(Boolean).join(' \u2022 ') || 'AI bot';
  }

  function userSecondaryLineText(user, { showPresence = false } = {}) {
    if (isAiBotDirectoryUser(user)) {
      return ['AI bot', botMentionText(user), botModelText(user)].filter(Boolean).join(' • ');
    }
    if (showPresence) return user?.online ? 'online' : 'offline';
    return user?.username ? `@${user.username}` : '';
  }

  function renderSelectableUserItem(user, { showPresence = false } = {}) {
    return `
      <div class="user-list-item${isAiBotDirectoryUser(user) ? ' is-ai-bot' : ''}" data-uid="${user.id}">
        ${avatarHtml(user.display_name, user.avatar_color, user.avatar_url)}
        <div class="user-list-copy">
          <div class="name">${esc(user.display_name)}</div>
          <div class="user-list-meta">${esc(userSecondaryLineText(user, { showPresence }))}</div>
        </div>
      </div>
    `;
  }

  function renderChatMemberItem(user, { ownerId = 0, canRemove = false } = {}) {
    const isOwner = ownerId && Number(user?.id) === Number(ownerId);
    const isBot = isAiBotDirectoryUser(user);
    const isOnline = onlineUsers.has(user?.id);
    return `
      <div class="user-list-item${isOwner ? ' chat-owner' : ''}${isBot ? ' is-ai-bot' : ''}" data-uid="${user.id}" data-bot="${isBot ? 1 : 0}">
        <div class="member-avatar-wrap${isOwner ? ' is-owner' : ''}" title="${isOwner ? 'Chat creator' : ''}">
          ${avatarHtml(user.display_name, user.avatar_color, user.avatar_url)}
          ${isOwner ? '<span class="member-owner-crown" aria-label="Chat creator" title="Chat creator">&#128081;</span>' : ''}
        </div>
        <div class="user-list-copy">
          <div class="name">${esc(user.display_name)}</div>
          ${isBot
            ? `<div class="user-list-meta">${esc(botChatMemberMetaText(user))}</div>`
            : `<div class="admin-user-status ${isOnline ? 'online' : 'offline'}"><span class="status-dot"></span>${isOnline ? 'online' : 'offline'}</div>`}
        </div>
        ${canRemove && Number(user.id) !== Number(currentUser?.id || 0) ? `<button class="member-remove" data-uid="${user.id}" title="Remove">✕</button>` : ''}
      </div>
    `;
  }

  function formatBotAuditSource(source) {
    const value = String(source || '').trim().toLowerCase();
    if (value === 'private_chat_create') return 'Private chat';
    if (value === 'group_chat_create') return 'Group creation';
    if (value === 'group_member_add') return 'Add member';
    return value || 'Unknown';
  }

  function ensureBotVisibilityToggles() {
    const configs = [
      ['aiBotEnabled', 'aiBotVisibleToUsers'],
      ['openAiUniversalBotEnabled', 'openAiUniversalBotVisibleToUsers'],
      ['deepseekAiBotEnabled', 'deepseekAiBotVisibleToUsers'],
      ['yandexAiBotEnabled', 'yandexAiBotVisibleToUsers'],
      ['grokAiBotEnabled', 'grokAiBotVisibleToUsers'],
      ['grokAiImageBotEnabled', 'grokAiImageBotVisibleToUsers'],
      ['grokAiUniversalBotEnabled', 'grokAiUniversalBotVisibleToUsers'],
    ];
    configs.forEach(([enabledId, visibleId]) => {
      if (document.getElementById(visibleId)) return;
      const enabledInput = document.getElementById(enabledId);
      const grid = enabledInput?.closest('.ai-bot-grid');
      if (!grid) return;
      const wrap = document.createElement('div');
      wrap.className = 'ai-bot-toggle-label';
      wrap.innerHTML = `
        <span>Display to users</span>
        <label class="toggle-switch">
          <input type="checkbox" id="${visibleId}">
          <span class="toggle-slider"></span>
        </label>
      `;
      grid.appendChild(wrap);
    });
  }

  function setBotVisibilityToggle(inputId, value = false) {
    const input = document.getElementById(inputId);
    if (input) input.checked = !!value;
  }

  function getBotVisibilityToggle(inputId) {
    return !!document.getElementById(inputId)?.checked;
  }

  function updateCurrentUserFooter() {
    currentUserInfo.innerHTML = avatarHtml(currentUser.display_name, currentUser.avatar_color, currentUser.avatar_url, 28) +
      `<span class="current-user-name">${esc(currentUser.display_name)}</span>`;
  }

  function persistCurrentUser() {
    if (!currentUser) return;
    localStorage.setItem('user', JSON.stringify(currentUser));
  }

  function syncChatAreaMetrics(options = {}) {
    if (!chatArea) return;
    const force = Boolean(options && typeof options === 'object' && options.force);
    if (!force && isMobileBaseSceneHardHidden(chatArea)) return;
    const rect = chatArea.getBoundingClientRect();
    const root = document.documentElement;
    const width = Math.max(0, rect.width || 0);
    const height = Math.max(0, rect.height || 0);
    if (!force && isMobileLayoutViewport() && (!width || !height)) return;
    root.style.setProperty('--chat-area-left', `${Math.max(0, rect.left || 0)}px`);
    root.style.setProperty('--chat-area-top', `${Math.max(0, rect.top || 0)}px`);
    root.style.setProperty('--chat-area-width', `${Math.max(0, width || window.innerWidth || 0)}px`);
    root.style.setProperty('--chat-area-height', `${Math.max(0, height || window.innerHeight || 0)}px`);
    queueIosViewportLayoutSync();
  }

  function syncMobileAppHeightToViewport(options = {}) {
    const force = Boolean(options && typeof options === 'object' && options.force);
    const app = document.getElementById('app');
    if (!app || !window.visualViewport || window.innerWidth > 768) return;
    const newViewportHeight = Math.max(0, window.visualViewport?.height || 0);
    const mentionPickerDismissed = dismissMentionPickerAfterKeyboardClose();
    getIosViewportBaselineHeight();
    const newAppHeight = getMobileAppViewportHeight();
    if (!shouldBypassLockedMobileViewportSync(newViewportHeight, { force, mentionPickerDismissed })) {
      mobileViewportPrevHeight = newViewportHeight;
      return;
    }
    app.style.height = `${Math.round(newAppHeight)}px`;
    app.style.paddingTop = '0px';
    syncChatAreaMetrics();
    if (newViewportHeight < mobileViewportPrevHeight && messagesEl) {
      requestAnimationFrame(() => {
        if (!shouldBypassLockedMobileViewportSync(newViewportHeight, { force, mentionPickerDismissed })) return;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    }
    mobileViewportPrevHeight = newViewportHeight;
  }

  function forceMobileViewportLayoutSync() {
    syncMobileAppHeightToViewport({ force: true });
    syncChatAreaMetrics();
  }

  function scheduleMobileViewportRecovery(retryDelayMs = 140) {
    if (!window.visualViewport || window.innerWidth > 768) return false;
    if (mobileViewportRecoveryFrame) cancelAnimationFrame(mobileViewportRecoveryFrame);
    clearTimeout(mobileViewportRecoveryTimer);

    const runRecovery = () => {
      forceMobileViewportLayoutSync();
      syncChatAreaMetrics();
      queueIosViewportLayoutSync();
    };

    mobileViewportRecoveryFrame = requestAnimationFrame(() => {
      mobileViewportRecoveryFrame = 0;
      runRecovery();
    });

    mobileViewportRecoveryTimer = setTimeout(() => {
      mobileViewportRecoveryTimer = null;
      requestAnimationFrame(runRecovery);
    }, Math.max(60, Number(retryDelayMs) || 140));
    return true;
  }

  function setupMobileViewportHeightSync() {
    if (!window.visualViewport || !isMobileLayoutViewport() || mobileViewportHeightSyncBound) return;
    mobileViewportHeightSyncBound = true;
    mobileViewportPrevHeight = Math.max(0, window.visualViewport.height || 0);
    syncMobileAppHeightToViewport({ force: true });
    window.visualViewport.addEventListener('resize', syncMobileAppHeightToViewport);
    if (isIosViewportFixTarget) {
      window.visualViewport.addEventListener('scroll', syncMobileAppHeightToViewport);
      window.addEventListener('orientationchange', syncMobileAppHeightToViewport);
      if ('ResizeObserver' in window && !iosViewportElementResizeObserver) {
        iosViewportElementResizeObserver = new ResizeObserver(() => {
          queueIosViewportLayoutSync();
        });
        if (chatHeader) iosViewportElementResizeObserver.observe(chatHeader);
        if (inputArea) iosViewportElementResizeObserver.observe(inputArea);
      }
    }
  }

  function setupChatAreaMetricsSync() {
    syncMobileBaseSceneState({ hideInactive: true, syncChatMetrics: getResolvedMobileBaseScene() === 'chat' });
    syncChatAreaMetrics();
    window.addEventListener('resize', syncMobileBaseSceneState);
    window.addEventListener('resize', syncChatAreaMetrics);
    window.visualViewport?.addEventListener('resize', syncChatAreaMetricsFromViewport);
    window.visualViewport?.addEventListener('scroll', syncChatAreaMetricsFromViewport);
    if ('ResizeObserver' in window && chatArea && !chatAreaResizeObserver) {
      chatAreaResizeObserver = new ResizeObserver(syncChatAreaMetrics);
      chatAreaResizeObserver.observe(chatArea);
    }
  }

  function isAbortError(error) {
    return error?.name === 'AbortError';
  }

  function isCurrentChatOpenTransition(seq, chatId = currentChatId) {
    return Number(seq || 0) === Number(chatOpenSeq || 0)
      && Number(chatId || 0) === Number(currentChatId || 0);
  }

  function isUiTransitionBusy() {
    return Boolean(chatOpenInProgress || mobileRouteTransitionActive);
  }

  function isMobileViewportLayoutLocked() {
    if (window.innerWidth > 768) return false;
    if (mobileRouteTransitionActive) return true;
    if (modalStack.some((entry) => entry?.el && !entry.el.classList.contains('hidden'))) return true;
    if (searchPanel && searchPanel.getAttribute('aria-hidden') === 'false') return true;
    if (isFloatingSurfaceVisible(chatContextMenuBackdrop)
      || isFloatingSurfaceVisible(chatContextMenu)
      || isFloatingSurfaceVisible(reactionPicker)
      || isFloatingSurfaceVisible(reactionEmojiPopover)
      || isFloatingSurfaceVisible($('#mentionPicker'))
      || isFloatingSurfaceVisible(emojiPicker)
      || isFloatingSurfaceVisible(imageViewer)) {
      return true;
    }
    const attachMenu = $('#attachMenu');
    return Boolean(attachMenu && !attachMenu.classList.contains('hidden'));
  }

  function syncChatAreaMetricsFromViewport() {
    if (isMobileViewportLayoutLocked() && !isIosViewportFixTarget) return;
    syncChatAreaMetrics();
  }

  function flushDeferredRecoverySync(reason = 'transition-complete') {
    if (!token || !currentUser || document.hidden || isUiTransitionBusy()) return;
    if (!recoverySyncRequested && pendingRecoveryChatIds.size === 0) return;
    const nextReason = deferredRecoveryReason || reason;
    deferredRecoveryReason = '';
    scheduleRecoverySync(nextReason, { immediate: true });
  }

  function cancelPendingScrollRestores() {
    scrollRestoreTimers.forEach((timer) => clearTimeout(timer));
    scrollRestoreTimers.clear();
  }

  function setChatHydrating(active) {
    if (active) document.documentElement.dataset.viewTransition = 'chat-open';
    else if (document.documentElement.dataset.viewTransition === 'chat-open') delete document.documentElement.dataset.viewTransition;
  }

  function revealChatHydration(seq, chatId = currentChatId) {
    if (seq && !isCurrentChatOpenTransition(seq, chatId)) return false;
    setChatHydrating(false);
    return true;
  }

  function beginChatOpenTransition(chatId) {
    chatOpenSeq += 1;
    const seq = chatOpenSeq;
    if (chatMessageAbortController) {
      try { chatMessageAbortController.abort(); } catch (e) {}
    }
    cancelPendingScrollRestores();
    chatMessageAbortController = new AbortController();
    chatOpenInProgress = true;
    document.documentElement.dataset.viewTransition = 'chat-open';
    setChatHydrating(true);
    return { seq, controller: chatMessageAbortController, chatId: Number(chatId || 0) };
  }

  function endChatOpenTransition(seq, chatId = currentChatId) {
    if (!isCurrentChatOpenTransition(seq, chatId)) return false;
    chatOpenInProgress = false;
    chatMessageAbortController = null;
    delete document.documentElement.dataset.viewTransition;
    revealChatHydration(seq, chatId);
    flushDeferredRecoverySync();
    return true;
  }

  function beginMobileRouteTransition(durationMs = 340) {
    if (!isMobileLayoutViewport()) return false;
    mobileRouteTransitionActive = true;
    clearTimeout(mobileRouteTransitionTimer);
    document.documentElement.classList.add('is-mobile-route-transitioning');
    mobileRouteTransitionTimer = setTimeout(() => {
      endMobileRouteTransition();
    }, Math.max(120, Number(durationMs) || 340));
    return true;
  }

  function endMobileRouteTransition() {
    const finalScene = normalizeMobileBaseScene(mobileBaseScene);
    clearTimeout(mobileRouteTransitionTimer);
    mobileRouteTransitionTimer = null;
    mobileRouteTransitionActive = false;
    document.documentElement.classList.remove('is-mobile-route-transitioning');
    syncMobileBaseSceneState({
      scene: finalScene,
      hideInactive: true,
      syncChatMetrics: finalScene === 'chat',
      repaint: true,
    });
    flushDeferredRecoverySync();
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

  function isChatSearchOpen() {
    return Boolean(sidebarSearch && sidebarSearch.getAttribute('aria-hidden') === 'false');
  }

  function focusChatSearchInput() {
    requestAnimationFrame(() => {
      if (isChatSearchOpen()) focusElementIfPossible(chatSearch);
    });
  }

  function setChatSearchOpen(open, { clear = false, focus = false, render = true } = {}) {
    if (!sidebarSearch || !chatSearch) return false;
    const shouldOpen = !!open;

    if (clear) {
      chatSearch.value = '';
      clearTimeout(hiddenChatSearchTimer);
      hiddenChatSearchTimer = null;
      hiddenChatSearchSeq += 1;
      hiddenChatSearchQuery = '';
      hiddenChatSearchResults = [];
    }

    sidebarSearch.classList.toggle('is-collapsed', !shouldOpen);
    sidebarSearch.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    sidebar?.classList.toggle('sidebar-search-open', shouldOpen);
    chatSearchToggle?.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    chatSearchToggle?.classList.toggle('is-active', shouldOpen);
    chatSearch.tabIndex = shouldOpen ? 0 : -1;
    if (chatSearchClear) chatSearchClear.tabIndex = shouldOpen ? 0 : -1;

    if (clear && render) {
      renderChatList();
    }

    if (shouldOpen && focus) {
      focusChatSearchInput();
    } else if (!shouldOpen) {
      if (document.activeElement === chatSearch) chatSearch.blur();
      if (focus) focusElementIfPossible(chatSearchToggle);
    }

    return true;
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
        name: chat.private_user.display_name || chat.name,
        color: chat.private_user.avatar_color || '#65aadd',
        avatarUrl: chat.private_user.avatar_url || '',
        fallbackText: initials(chat.private_user.display_name || chat.name || '?'),
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
    renderChatDangerControls(chat);
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
    const previousContextTransform = !!current.context_transform_enabled;
    chats[idx] = normalizeChatListEntry({
      ...current,
      ...nextChat,
      background_url: Object.prototype.hasOwnProperty.call(nextChat, 'background_url')
        ? (nextChat.background_url || null)
        : (current.background_url || null),
      background_style: nextChat.background_style || current.background_style || 'cover',
    });
    if ((current.type === 'private' || nextChat.type === 'private') && current.private_user && !nextChat.private_user) {
      chats[idx].private_user = { ...current.private_user };
      if (Number(current.private_user.is_ai_bot) === 0) {
        chats[idx].name = current.name;
      }
    }
    sortChatsInPlace(chats);
    const updated = getChatById(chatId);
    if (previousContextTransform !== !!updated?.context_transform_enabled) {
      invalidateContextConvertAvailability(chatId);
    }
    renderChatList(chatSearch.value);
    if (currentChatId === chatId) {
      renderCurrentChatHeader(updated);
      applyChatBackground(updated);
      updateChatStatus();
      renderPinnedBar(chatId);
      refreshVisiblePinButtons(chatId);
      renderChatDangerControls(updated);
    }
    refreshChatInfoPresentation(updated);
    renderChatPinSettingsForm(updated);
    renderChatContextTransformForm(updated);
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
      if (Object.prototype.hasOwnProperty.call(user, 'ui_visual_mode')) {
        applyVisualMode(user.ui_visual_mode, false);
      }
      if (Object.prototype.hasOwnProperty.call(user, 'ui_modal_animation')) {
        applyModalAnimation(user.ui_modal_animation, false);
      }
      if (Object.prototype.hasOwnProperty.call(user, 'ui_modal_animation_speed')) {
        applyModalAnimationSpeed(user.ui_modal_animation_speed, false);
      }
      if (Object.prototype.hasOwnProperty.call(user, 'ui_mobile_font_size')) {
        applyMobileFontSize(user.ui_mobile_font_size, false);
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
    setInlineStatus('settingsWeatherStatus', message, type);
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
    setInlineStatus('settingsNotificationsStatus', message, type);
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
    return chats.find(c => Number(c.id) === id) || null;
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
      id: Number(chat?.id || 0),
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

  function isGeneralChat(chat) {
    return String(chat?.type || '') === 'general';
  }

  function isGroupOrPrivateChat(chat) {
    const type = String(chat?.type || '');
    return type === 'group' || type === 'private';
  }

  function canHideChat(chat) {
    return Boolean(chat && isGroupOrPrivateChat(chat) && !isNotesChat(chat) && !isGeneralChat(chat));
  }

  function canLeaveChat(chat) {
    return Boolean(
      chat
      && chat.type === 'group'
      && !isNotesChat(chat)
      && !isGeneralChat(chat)
      && Number(chat.created_by || 0) !== Number(currentUser?.id || 0)
    );
  }

  function canManageDestructiveChat(chat) {
    return Boolean(
      currentUser
      && chat
      && isGroupOrPrivateChat(chat)
      && !isNotesChat(chat)
      && !isGeneralChat(chat)
      && (currentUser.is_admin || Number(chat.created_by || 0) === Number(currentUser.id))
    );
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

  function canManageContextTransformSettings(chat = getChatById(currentChatId)) {
    if (!currentUser || !chat) return false;
    return Boolean(currentUser.is_admin || Number(chat.created_by || 0) === Number(currentUser.id));
  }

  function setChatContextTransformStatus(message, type = '') {
    const el = $('#chatContextTransformStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function renderChatContextTransformForm(chat = getChatById(currentChatId)) {
    const section = $('#chatContextTransformSection');
    const toggle = $('#chatContextTransformToggle');
    if (!section || !toggle) return;
    const canManage = canManageContextTransformSettings(chat);
    section.classList.toggle('hidden', !canManage);
    toggle.checked = !!chat?.context_transform_enabled;
    setChatContextTransformStatus('');
  }

  async function saveChatContextTransformSetting() {
    if (!currentChatId) return;
    const chat = getChatById(currentChatId);
    const enabled = !!$('#chatContextTransformToggle')?.checked;
    const previousEnabled = !!chat?.context_transform_enabled;
    if (chat) chat.context_transform_enabled = enabled ? 1 : 0;
    renderChatContextTransformForm(chat);
    syncCurrentChatContextConvertUi();
    setChatContextTransformStatus('Saving...');
    try {
      const updated = await api(`/api/chats/${currentChatId}/context-transform-settings`, {
        method: 'PUT',
        body: { context_transform_enabled: enabled },
      });
      applyChatUpdate(updated || {});
      setChatContextTransformStatus('Saved', 'success');
      invalidateContextConvertAvailability(currentChatId);
      if (enabled) loadContextConvertAvailability(currentChatId, { force: true }).catch(() => {});
    } catch (error) {
      if (chat) chat.context_transform_enabled = previousEnabled ? 1 : 0;
      renderChatContextTransformForm(chat);
      syncCurrentChatContextConvertUi();
      setChatContextTransformStatus(error.message || 'Could not save context transform setting', 'error');
    }
  }

  function setChatDangerStatus(message, type = '') {
    const el = $('#chatDangerStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function renderChatDangerControls(chat = getChatById(currentChatId)) {
    const section = $('#chatDangerSection');
    if (!section) return;
    const clearBtn = $('#clearChatHistoryBtn');
    const leaveBtn = $('#leaveChatBtn');
    const deleteBtn = $('#deleteChatBtn');
    const showClear = canManageDestructiveChat(chat);
    const showLeave = canLeaveChat(chat);
    const showDelete = canManageDestructiveChat(chat);
    section.classList.toggle('hidden', !(showClear || showLeave || showDelete));
    clearBtn?.classList.toggle('hidden', !showClear);
    leaveBtn?.classList.toggle('hidden', !showLeave);
    deleteBtn?.classList.toggle('hidden', !showDelete);
    setChatDangerStatus('');
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
      is_video_note: Boolean(raw.is_video_note || raw.isVideoNote),
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
    return String(
      pin?.preview_text
      || pin?.file_name
      || (pin?.is_voice_note ? (pin?.is_video_note ? 'Видео-заметка' : 'Голосовое сообщение') : 'Pinned message')
    ).trim() || 'Pinned message';
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
    const hadActiveSelection = activePinIndexByChat.has(chatId);
    const previousIndex = Math.max(0, Number(activePinIndexByChat.get(chatId) || 0));
    const previousPin = previousPins[previousIndex] || previousPins[0] || null;
    const nextPins = normalizePins(data.pins);
    const action = String(data.action || '').toLowerCase();
    const pinnedMessageId = Number(data.messageId || data.message_id || 0);
    chatPinsByChat.set(chatId, nextPins);

    let nextIndex = nextPins.length
      ? (hadActiveSelection ? Math.min(previousIndex, nextPins.length - 1) : nextPins.length - 1)
      : 0;
    if (action === 'pinned' && pinnedMessageId) {
      const pinnedIndex = nextPins.findIndex(pin => Number(pin.message_id) === pinnedMessageId);
      if (pinnedIndex >= 0) nextIndex = pinnedIndex;
    } else if (action && previousPin) {
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
      applyPinsUpdate({ ...data, chatId: id });
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
      queueIosViewportLayoutSync();
      return;
    }
    const pins = getChatPins(id);
    if (!pins.length) {
      pinnedBar.classList.add('hidden');
      pinnedBar.innerHTML = '';
      queueIosViewportLayoutSync();
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
          const preview = pin.preview_text || pin.file_name || (pin.is_voice_note ? (pin.is_video_note ? 'Видео-заметка' : 'Голосовое сообщение') : 'Pinned message');
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
    queueIosViewportLayoutSync();

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
      applyPinsUpdate({ ...data, chatId });
      appendPinEventIfVisible(data.pin_event || data.pinEvent);
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
      applyPinsUpdate({ ...data, chatId: pin.chat_id });
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

  function resolveUiTarget(target) {
    if (!target) return null;
    if (typeof target !== 'string') return target;
    if (target.startsWith('#')) return document.querySelector(target);
    return document.getElementById(target) || document.querySelector(target);
  }

  function setInlineStatus(targetIds, message, type = '') {
    const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
    ids.forEach((targetId) => {
      const el = resolveUiTarget(targetId);
      if (!el) return;
      el.textContent = message || '';
      el.classList.toggle('is-error', type === 'error');
      el.classList.toggle('is-success', type === 'success');
      el.classList.toggle('is-pending', type === 'pending');
    });
  }

  function resolveActionButtons(targetIds) {
    const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
    return ids.map((targetId) => resolveUiTarget(targetId)).filter(Boolean);
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
          console.error('Admin action failed', error);
        });
      });
    });
  }

  function setOpenAiStatus(statusId, message, type = '') {
    setInlineStatus(statusId, message, type);
  }

  function setAiBotModalStatus(message, type = '') {
    setOpenAiStatus('aiBotsStatus', message, type);
  }

  function setAiBotSettingsStatus(message, type = '') {
    setOpenAiStatus('aiBotsProviderStatus', message, type);
  }

  function setAiBotStatus(message, type = '') {
    setOpenAiStatus(['aiBotEditorStatus', 'aiBotEditorStatusBottom'], message, type);
  }

  function setAiBotTextModalStatus(message, type = '') {
    setOpenAiStatus('openAiTextStatus', message, type);
  }

  function setAiBotChatStatus(message, type = '') {
    setOpenAiStatus('aiBotChatStatus', message, type);
  }

  function setAiModelStatus(message, type = '') {
    setOpenAiStatus('aiBotsModelStatus', message, type);
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

  function setStaticSelectOptions(id, values, currentValue) {
    const select = document.getElementById(id);
    if (!select) return;
    const current = String(currentValue || '').trim();
    const options = [...new Set([current, ...values].filter(Boolean))];
    select.innerHTML = options.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
    if (current) select.value = current;
  }

  function syncSharedOpenAiSettings(settings = {}) {
    aiBotState.settings = { ...aiBotState.settings, ...settings };
    openAiUniversalState.settings = { ...openAiUniversalState.settings, ...settings };
  }

  function syncSharedGrokSettings(settings = {}) {
    grokBotState.settings = { ...grokBotState.settings, ...settings };
    grokUniversalState.settings = { ...grokUniversalState.settings, ...settings };
  }

  function renderAiModelOptions(bot = currentAiBot()) {
    const settings = aiBotState.settings || {};
    const responseModels = aiModelCatalog.response || [];
    const summaryModels = aiModelCatalog.summary || responseModels;
    const embeddingModels = aiModelCatalog.embedding || ['text-embedding-3-small'];
    const imageModels = aiModelCatalog.image || ['gpt-image-2'];
    setAiModelSelectOptions('aiBotsDefaultResponseModel', responseModels, settings.default_response_model || 'gpt-5.4');
    setAiModelSelectOptions('aiBotsDefaultSummaryModel', summaryModels, settings.default_summary_model || 'gpt-5.4');
    setAiModelSelectOptions('aiBotsDefaultEmbeddingModel', embeddingModels, settings.default_embedding_model || 'text-embedding-3-small');
    setAiModelSelectOptions('aiBotsDefaultImageModel', imageModels, settings.openai_default_image_model || 'gpt-image-2');
    setStaticSelectOptions('aiBotsDefaultImageSize', OPENAI_IMAGE_SIZE_OPTIONS, settings.openai_default_image_size || '1024x1024');
    setStaticSelectOptions('aiBotsDefaultImageQuality', OPENAI_IMAGE_QUALITY_OPTIONS, settings.openai_default_image_quality || 'auto');
    setStaticSelectOptions('aiBotsDefaultImageBackground', OPENAI_IMAGE_BACKGROUND_OPTIONS, settings.openai_default_image_background || 'auto');
    setStaticSelectOptions('aiBotsDefaultImageOutputFormat', OPENAI_IMAGE_OUTPUT_OPTIONS, settings.openai_default_image_output_format || 'png');
    setStaticSelectOptions('aiBotsDefaultDocumentFormat', DOCUMENT_FORMAT_OPTIONS, settings.openai_default_document_format || 'md');
    setAiModelSelectOptions('aiBotResponseModel', responseModels, bot?.response_model || settings.default_response_model || 'gpt-5.4');
    setAiModelSelectOptions('aiBotSummaryModel', summaryModels, bot?.summary_model || settings.default_summary_model || 'gpt-5.4');
    const botEmbedding = $('#aiBotEmbeddingModel');
    if (botEmbedding) botEmbedding.value = settings.default_embedding_model || 'text-embedding-3-small';
    renderOpenAiUniversalModelOptions(currentOpenAiUniversalBot());
  }

  async function loadAiModelOptions(refresh = false) {
    const showActionStatus = refresh && aiModelRefreshTriggeredByButton;
    if (showActionStatus) {
      setActionButtonsPending('aiBotsRefreshModels', true, 'Refreshing...');
      setAiBotSettingsStatus('Refreshing models...', 'pending');
    }
    try {
      const data = await api(`/api/admin/ai-bots/models${refresh ? '?refresh=1' : ''}`);
      aiModelCatalog = {
        source: data.source || 'fallback',
        response: data.response || aiModelCatalog.response,
        summary: data.summary || data.response || aiModelCatalog.summary,
        embedding: data.embedding || aiModelCatalog.embedding,
        image: data.image || aiModelCatalog.image,
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
      if (showActionStatus) {
        if (aiModelCatalog.source === 'openai') {
          setAiBotSettingsStatus(
            aiModelCatalog.fetched_at ? `Models refreshed: ${aiModelCatalog.fetched_at}` : 'Models refreshed',
            'success'
          );
        } else if (aiModelCatalog.error) {
          setAiBotSettingsStatus(`Fallback models: ${aiModelCatalog.error}`, 'error');
        } else {
          setAiBotSettingsStatus('Fallback model list is shown');
        }
      }
      return aiModelCatalog;
    } catch (error) {
      if (showActionStatus) {
        setAiBotSettingsStatus(error.message || 'Could not refresh models', 'error');
      }
      throw error;
    } finally {
      if (showActionStatus) {
        aiModelRefreshTriggeredByButton = false;
        setActionButtonsPending('aiBotsRefreshModels', false);
      }
    }
  }

  function mergeAiBotState(data = {}) {
    if (data.state) {
      syncSharedOpenAiSettings(data.state.settings || {});
      aiBotState = {
        settings: aiBotState.settings,
        bots: data.state.bots || aiBotState.bots,
        chats: data.state.chats || aiBotState.chats,
        chatSettings: data.state.chatSettings || aiBotState.chatSettings,
      };
      if (data.state.chats) openAiUniversalState.chats = data.state.chats;
    } else if (data.settings) {
      syncSharedOpenAiSettings(data.settings);
      aiBotState = { ...aiBotState, settings: aiBotState.settings };
    }
    if (selectedAiBotId && !aiBotState.bots.some(bot => Number(bot.id) === Number(selectedAiBotId))) {
      selectedAiBotId = null;
    }
    mentionTargetsByChat.clear();
    updateComposerAiOverrideState().catch(() => {});
  }

  function currentAiBot() {
    return aiBotState.bots.find(bot => bot.id === selectedAiBotId) || null;
  }

  function setOpenAiUniversalModalStatus(message, type = '') {
    setOpenAiStatus('openAiUniversalStatus', message, type);
  }

  function setOpenAiUniversalStatus(message, type = '') {
    setOpenAiStatus(['openAiUniversalBotEditorStatus', 'openAiUniversalBotEditorStatusBottom'], message, type);
  }

  function setOpenAiUniversalChatStatus(message, type = '') {
    setOpenAiStatus('openAiUniversalBotChatStatus', message, type);
  }

  function mergeOpenAiUniversalState(data = {}) {
    const state = data.state || data;
    if (state.settings) syncSharedOpenAiSettings(state.settings);
    if (state.bots) openAiUniversalState.bots = state.bots;
    if (state.chats) openAiUniversalState.chats = state.chats;
    if (state.chatSettings) openAiUniversalState.chatSettings = state.chatSettings;
    openAiUniversalState.settings = aiBotState.settings;
    if (selectedOpenAiUniversalBotId && !openAiUniversalState.bots.some(bot => Number(bot.id) === Number(selectedOpenAiUniversalBotId))) {
      selectedOpenAiUniversalBotId = null;
    }
    mentionTargetsByChat.clear();
    updateComposerAiOverrideState().catch(() => {});
  }

  function currentOpenAiUniversalBot() {
    return openAiUniversalState.bots.find(bot => Number(bot.id) === Number(selectedOpenAiUniversalBotId)) || null;
  }

  function getOpenAiUniversalChatSetting(chatId, botId) {
    return openAiUniversalState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
  }

  function renderOpenAiUniversalModelOptions(bot = currentOpenAiUniversalBot()) {
    const settings = openAiUniversalState.settings || aiBotState.settings || {};
    const responseModels = aiModelCatalog.response || ['gpt-5.4'];
    const summaryModels = aiModelCatalog.summary || responseModels;
    const imageModels = aiModelCatalog.image || ['gpt-image-2'];
    setAiModelSelectOptions('openAiUniversalBotResponseModel', responseModels, bot?.response_model || settings.default_response_model || 'gpt-5.4');
    setAiModelSelectOptions('openAiUniversalBotSummaryModel', summaryModels, bot?.summary_model || settings.default_summary_model || 'gpt-5.4');
    setAiModelSelectOptions('openAiUniversalBotImageModel', imageModels, bot?.image_model || settings.openai_default_image_model || 'gpt-image-2');
    setStaticSelectOptions('openAiUniversalBotImageSize', OPENAI_IMAGE_SIZE_OPTIONS, bot?.image_resolution || settings.openai_default_image_size || '1024x1024');
    setStaticSelectOptions('openAiUniversalBotImageQuality', OPENAI_IMAGE_QUALITY_OPTIONS, bot?.image_quality || settings.openai_default_image_quality || 'auto');
    setStaticSelectOptions('openAiUniversalBotImageBackground', OPENAI_IMAGE_BACKGROUND_OPTIONS, bot?.image_background || settings.openai_default_image_background || 'auto');
    setStaticSelectOptions('openAiUniversalBotImageOutputFormat', OPENAI_IMAGE_OUTPUT_OPTIONS, bot?.image_output_format || settings.openai_default_image_output_format || 'png');
    setStaticSelectOptions('openAiUniversalBotDocumentFormat', DOCUMENT_FORMAT_OPTIONS, bot?.document_default_format || settings.openai_default_document_format || 'md');
    setStaticSelectOptions('openAiUniversalBotTestDocumentFormat', DOCUMENT_FORMAT_OPTIONS, bot?.document_default_format || settings.openai_default_document_format || 'md');
  }

  function renderOpenAiUniversalBotAvatar(bot = currentOpenAiUniversalBot()) {
    const avatarEl = $('#openAiUniversalBotAvatar');
    if (!avatarEl) return;
    const name = bot?.name || $('#openAiUniversalBotName')?.value.trim() || 'OpenAI Universal';
    const color = bot?.avatar_color || '#65aadd';
    avatarEl.style.background = color;
    if (bot?.avatar_url) {
      avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
    } else {
      avatarEl.textContent = initials(name);
    }

    const hasSavedBot = Boolean(bot?.id);
    const input = $('#openAiUniversalBotAvatarInput');
    const label = $('#openAiUniversalBotAvatarLabel');
    if (input) {
      input.disabled = !hasSavedBot;
      input.value = '';
    }
    if (label) {
      label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
      label.title = hasSavedBot ? 'Change avatar' : 'Save the bot first';
    }
    $('#removeOpenAiUniversalBotAvatar')?.classList.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
  }

  function renderOpenAiUniversalBotList() {
    const list = $('#openAiUniversalBotList');
    if (!list) return;
    if (!openAiUniversalState.bots.length) {
      list.innerHTML = '<div class="ai-bot-empty">No OpenAI universal bots yet. Create the first one.</div>';
      return;
    }
    list.innerHTML = openAiUniversalState.bots.map(bot => `
      <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedOpenAiUniversalBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
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

  function fillOpenAiUniversalBotForm(bot = null) {
    const settings = openAiUniversalState.settings || aiBotState.settings || {};
    selectedOpenAiUniversalBotId = bot ? bot.id : null;
    $('#openAiUniversalBotName').value = bot?.name || 'OpenAI Universal';
    $('#openAiUniversalBotMention').value = bot?.mention || 'openai_universal';
    $('#openAiUniversalBotEnabled').checked = bot ? !!bot.enabled : true;
    setBotVisibilityToggle('openAiUniversalBotVisibleToUsers', !!bot?.visible_to_users);
    $('#openAiUniversalBotAllowText').checked = bot?.allow_text ?? true;
    $('#openAiUniversalBotAllowImageGenerate').checked = bot?.allow_image_generate ?? true;
    $('#openAiUniversalBotAllowImageEdit').checked = bot?.allow_image_edit ?? true;
    $('#openAiUniversalBotAllowDocument').checked = bot?.allow_document ?? true;
    $('#openAiUniversalBotTemperature').value = bot?.temperature ?? 0.55;
    $('#openAiUniversalBotMaxTokens').value = bot?.max_tokens ?? 1000;
    $('#openAiUniversalBotStyle').value = bot?.style || 'Helpful OpenAI universal assistant for chat';
    $('#openAiUniversalBotTone').value = bot?.tone || 'warm, concise, attentive';
    $('#openAiUniversalBotRules').value = bot?.behavior_rules || '';
    $('#openAiUniversalBotSpeech').value = bot?.speech_patterns || '';
    $('#openAiUniversalBotTestMode').value = 'auto';
    renderOpenAiUniversalModelOptions(bot);
    $('#openAiUniversalBotDocumentFormat').value = bot?.document_default_format || settings.openai_default_document_format || 'md';
    $('#openAiUniversalBotTestDocumentFormat').value = bot?.document_default_format || settings.openai_default_document_format || 'md';
    renderOpenAiUniversalBotAvatar(bot);
    renderOpenAiUniversalBotList();
    renderOpenAiUniversalChatBotSettings();
  }

  function openAiUniversalBotFormPayload() {
    return {
      kind: 'universal',
      name: $('#openAiUniversalBotName')?.value.trim(),
      mention: $('#openAiUniversalBotMention')?.value.trim(),
      enabled: $('#openAiUniversalBotEnabled')?.checked,
      visible_to_users: getBotVisibilityToggle('openAiUniversalBotVisibleToUsers'),
      response_model: $('#openAiUniversalBotResponseModel')?.value.trim(),
      summary_model: $('#openAiUniversalBotSummaryModel')?.value.trim(),
      image_model: $('#openAiUniversalBotImageModel')?.value.trim(),
      image_resolution: $('#openAiUniversalBotImageSize')?.value.trim(),
      image_quality: $('#openAiUniversalBotImageQuality')?.value.trim(),
      image_background: $('#openAiUniversalBotImageBackground')?.value.trim(),
      image_output_format: $('#openAiUniversalBotImageOutputFormat')?.value.trim(),
      document_default_format: $('#openAiUniversalBotDocumentFormat')?.value.trim(),
      allow_text: $('#openAiUniversalBotAllowText')?.checked,
      allow_image_generate: $('#openAiUniversalBotAllowImageGenerate')?.checked,
      allow_image_edit: $('#openAiUniversalBotAllowImageEdit')?.checked,
      allow_document: $('#openAiUniversalBotAllowDocument')?.checked,
      temperature: Number($('#openAiUniversalBotTemperature')?.value || 0.55),
      max_tokens: Number($('#openAiUniversalBotMaxTokens')?.value || 1000),
      style: $('#openAiUniversalBotStyle')?.value.trim(),
      tone: $('#openAiUniversalBotTone')?.value.trim(),
      behavior_rules: $('#openAiUniversalBotRules')?.value.trim(),
      speech_patterns: $('#openAiUniversalBotSpeech')?.value.trim(),
    };
  }

  function renderOpenAiUniversalChatBotSettings() {
    const chatSelect = $('#openAiUniversalBotChatSelect');
    const botSelect = $('#openAiUniversalBotChatBotSelect');
    if (!chatSelect || !botSelect) return;
    const currentChatValue = chatSelect.value || String(currentChatId || openAiUniversalState.chats[0]?.id || '');
    const currentBotValue = botSelect.value || String(selectedOpenAiUniversalBotId || openAiUniversalState.bots[0]?.id || '');
    chatSelect.innerHTML = openAiUniversalState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
    botSelect.innerHTML = openAiUniversalState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
    if (openAiUniversalState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
    if (openAiUniversalState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
    if (!botSelect.value && openAiUniversalState.bots[0]) botSelect.value = String(openAiUniversalState.bots[0].id);
    const setting = getOpenAiUniversalChatSetting(chatSelect.value, botSelect.value);
    $('#openAiUniversalBotChatEnabled').checked = !!setting?.enabled;
    $('#openAiUniversalBotChatMode').value = setting?.mode || 'simple';
    $('#openAiUniversalBotChatHotLimit').value = setting?.hot_context_limit || 50;
    $('#openAiUniversalBotChatAutoReact').checked = !!setting?.auto_react_on_mention;
  }

  function renderOpenAiUniversalSettings() {
    const selected = currentOpenAiUniversalBot() || openAiUniversalState.bots[0] || null;
    fillOpenAiUniversalBotForm(selected);
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

  function providerInteractiveEnabled(provider, settings = {}) {
    if (provider === 'yandex') return !!settings.yandex_interactive_enabled;
    if (provider === 'deepseek') return !!settings.deepseek_interactive_enabled;
    if (provider === 'grok') return !!settings.grok_interactive_enabled;
    return !!settings.openai_interactive_enabled;
  }

  function providerInteractiveSummary(provider, settings = {}) {
    return `Interactive actions: ${providerInteractiveEnabled(provider, settings) ? 'on' : 'off'}`;
  }

  const BOT_SAVE_BOOLEAN_FIELDS = new Set([
    'enabled',
    'visible_to_users',
    'allow_text',
    'allow_image_generate',
    'allow_image_edit',
    'allow_document',
    'allow_poll_create',
    'allow_poll_vote',
    'allow_react',
    'allow_pin',
  ]);
  const BOT_SAVE_NUMERIC_FIELDS = new Set([
    'temperature',
    'max_tokens',
  ]);

  function normalizeBotSaveComparisonValue(key, value) {
    if (BOT_SAVE_BOOLEAN_FIELDS.has(key) || typeof value === 'boolean') return value ? 1 : 0;
    if (BOT_SAVE_NUMERIC_FIELDS.has(key) || typeof value === 'number') {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    }
    return String(value ?? '').trim();
  }

  function verifyBotSaveResponse(bot, payload = {}) {
    if (!bot || !payload || typeof payload !== 'object') {
      return { ok: false, mismatches: ['server_response'] };
    }
    const mismatches = Object.keys(payload).filter((key) => (
      normalizeBotSaveComparisonValue(key, bot[key]) !== normalizeBotSaveComparisonValue(key, payload[key])
    ));
    return { ok: mismatches.length === 0, mismatches };
  }

  function buildVerifiedBotSaveStatus(savedLabel, bot, payload = {}, detailLine = '') {
    const verification = verifyBotSaveResponse(bot, payload);
    if (verification.ok) {
      return {
        type: 'success',
        message: [
          savedLabel,
          'Значения сохранены на сервере.',
          detailLine,
        ].filter(Boolean).join('\n'),
      };
    }
    return {
      type: 'error',
      message: [
        savedLabel,
        'Сервер вернул отличающиеся значения. Форма обновлена по сохранённому состоянию.',
        verification.mismatches.length ? `Поля: ${verification.mismatches.join(', ')}` : '',
        detailLine,
      ].filter(Boolean).join('\n'),
    };
  }


  function fillAiBotForm(bot = null) {
    const settings = aiBotState.settings || {};
    selectedAiBotId = bot ? bot.id : null;
    $('#aiBotName').value = bot?.name || 'Bananza AI';
    $('#aiBotMention').value = bot?.mention || 'bananza';
    $('#aiBotEnabled').checked = bot ? !!bot.enabled : true;
    setBotVisibilityToggle('aiBotVisibleToUsers', !!bot?.visible_to_users);
    $('#aiBotResponseModel').value = bot?.response_model || settings.default_response_model || 'gpt-5.4';
    $('#aiBotSummaryModel').value = bot?.summary_model || settings.default_summary_model || 'gpt-5.4';
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
      visible_to_users: getBotVisibilityToggle('aiBotVisibleToUsers'),
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
    $('#aiBotChatAutoReact').checked = !!setting?.auto_react_on_mention;
  }

  function renderOpenAiProviderSettings() {
    const settings = aiBotState.settings || {};
    $('#aiBotsGlobalEnabled').checked = !!settings.enabled;
    $('#aiBotsInteractiveEnabled').checked = !!settings.openai_interactive_enabled;
    $('#aiBotsDefaultResponseModel').value = settings.default_response_model || 'gpt-5.4';
    $('#aiBotsDefaultSummaryModel').value = settings.default_summary_model || 'gpt-5.4';
    $('#aiBotsDefaultEmbeddingModel').value = settings.default_embedding_model || 'text-embedding-3-small';
    $('#aiBotsDefaultImageModel').value = settings.openai_default_image_model || 'gpt-image-2';
    $('#aiBotsDefaultImageSize').value = settings.openai_default_image_size || '1024x1024';
    $('#aiBotsDefaultImageQuality').value = settings.openai_default_image_quality || 'auto';
    $('#aiBotsDefaultImageBackground').value = settings.openai_default_image_background || 'auto';
    $('#aiBotsDefaultImageOutputFormat').value = settings.openai_default_image_output_format || 'png';
    $('#aiBotsDefaultDocumentFormat').value = settings.openai_default_document_format || 'md';
    $('#aiBotsChunkSize').value = settings.chunk_size || 50;
    $('#aiBotsRetrievalTopK').value = settings.retrieval_top_k || 6;
    $('#aiBotsApiKey').value = '';
    $('#aiBotsKeyStatus').textContent = settings.has_openai_key
      ? `Ключ сохранён: ${settings.masked_openai_key || '***'}`
      : 'Ключ не сохранён';

    renderAiModelOptions(currentAiBot() || aiBotState.bots[0] || null);
  }

  function renderOpenAiTextBotsSettings() {
    fillAiBotForm(currentAiBot() || aiBotState.bots[0] || null);
  }

  function renderAiBotSettings() {
    renderOpenAiProviderSettings();
    renderOpenAiTextBotsSettings();
  }

  function aiBotSettingsPayload() {
    const body = {
      enabled: $('#aiBotsGlobalEnabled')?.checked,
      openai_interactive_enabled: $('#aiBotsInteractiveEnabled')?.checked,
      default_response_model: $('#aiBotsDefaultResponseModel')?.value.trim(),
      default_summary_model: $('#aiBotsDefaultSummaryModel')?.value.trim(),
      default_embedding_model: $('#aiBotsDefaultEmbeddingModel')?.value.trim(),
      openai_default_image_model: $('#aiBotsDefaultImageModel')?.value.trim(),
      openai_default_image_size: $('#aiBotsDefaultImageSize')?.value.trim(),
      openai_default_image_quality: $('#aiBotsDefaultImageQuality')?.value.trim(),
      openai_default_image_background: $('#aiBotsDefaultImageBackground')?.value.trim(),
      openai_default_image_output_format: $('#aiBotsDefaultImageOutputFormat')?.value.trim(),
      openai_default_document_format: $('#aiBotsDefaultDocumentFormat')?.value.trim(),
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
    renderOpenAiUniversalSettings();
    loadAiModelOptions(false).catch((e) => {
      setAiModelStatus(e.message || 'Не удалось загрузить список моделей', 'error');
    });
  }

  async function saveAiBotSettings() {
    setAiBotSettingsStatus('Сохраняю...');
    try {
      await persistAiBotSettings();
      await loadAiModelOptions(true).catch(() => {});
      renderAiBotSettings();
      renderOpenAiUniversalSettings();
      setAiBotSettingsStatus(`Настройки сохранены\n${providerInteractiveSummary('openai', aiBotState.settings)}`, 'success');
    } catch (e) {
      setAiBotSettingsStatus(e.message || 'Не удалось сохранить настройки', 'error');
    }
  }

  async function deleteAiBotKey() {
    if (!confirm('Удалить OpenAI API key для AI-ботов?')) return;
    try {
      const data = await api('/api/admin/ai-bots/openai-key', { method: 'DELETE' });
      mergeAiBotState(data);
      await loadAiModelOptions(true).catch(() => {});
      renderAiBotSettings();
      renderOpenAiUniversalSettings();
      setAiBotSettingsStatus('Ключ удалён', 'success');
    } catch (e) {
      setAiBotSettingsStatus(e.message || 'Не удалось удалить ключ', 'error');
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
      const status = buildVerifiedBotSaveStatus('Бот сохранён.', data.bot, payload, formatCapabilityState(data.bot || payload));
      setAiBotStatus(status.message, status.type);
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
    if (!chatId || !botId) { setAiBotChatStatus('Выберите чат и бота', 'error'); return; }
    if (!botExists) {
      setAiBotChatStatus('Сначала сохраните бота', 'error');
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
          auto_react_on_mention: $('#aiBotChatAutoReact')?.checked,
        },
      });
      mergeAiBotState(data);
      renderAiChatBotSettings();
      setAiBotChatStatus('Настройки чата сохранены', 'success');
    } catch (e) {
      setAiBotChatStatus(e.message || 'Не удалось сохранить настройки чата', 'error');
    }
  }

  async function loadOpenAiUniversalState() {
    const data = await api('/api/admin/openai-universal-bots');
    mergeOpenAiUniversalState({ state: data });
    renderOpenAiUniversalSettings();
    return data;
  }

  function syncOpenAiUniversalBotUser(bot) {
    if (!bot?.user_id) return;
    applyUserUpdate({
      id: bot.user_id,
      user_id: bot.user_id,
      display_name: bot.name,
      avatar_color: bot.avatar_color,
      avatar_url: bot.avatar_url,
      is_ai_bot: 1,
    });
  }

  async function saveOpenAiUniversalBot() {
    const payload = openAiUniversalBotFormPayload();
    if (!payload.name) { setOpenAiUniversalStatus('Enter bot name', 'error'); return; }
    setOpenAiUniversalStatus('Saving universal bot...');
    try {
      const shouldUpdate = Boolean(selectedOpenAiUniversalBotId && openAiUniversalState.bots.some(bot => Number(bot.id) === Number(selectedOpenAiUniversalBotId)));
      const url = shouldUpdate ? `/api/admin/openai-universal-bots/${selectedOpenAiUniversalBotId}` : '/api/admin/openai-universal-bots';
      const method = shouldUpdate ? 'PUT' : 'POST';
      const data = await api(url, { method, body: payload });
      mergeOpenAiUniversalState(data);
      selectedOpenAiUniversalBotId = data.bot?.id || selectedOpenAiUniversalBotId;
      syncOpenAiUniversalBotUser(data.bot);
      renderOpenAiUniversalSettings();
      const status = buildVerifiedBotSaveStatus('Universal bot saved.', data.bot, payload, formatCapabilityState(data.bot || payload));
      setOpenAiUniversalStatus(status.message, status.type);
    } catch (e) {
      setOpenAiUniversalStatus(e.message || 'Could not save universal bot', 'error');
    }
  }

  async function uploadOpenAiUniversalBotAvatar(file) {
    if (!file) return;
    if (!selectedOpenAiUniversalBotId) {
      setOpenAiUniversalStatus('Save the bot before adding an avatar', 'error');
      renderOpenAiUniversalBotAvatar(null);
      return;
    }
    const fd = new FormData();
    fd.append('avatar', file);
    setOpenAiUniversalStatus('Uploading avatar...');
    try {
      const data = await api(`/api/admin/openai-universal-bots/${selectedOpenAiUniversalBotId}/avatar`, { method: 'POST', body: fd });
      mergeOpenAiUniversalState(data);
      selectedOpenAiUniversalBotId = data.bot?.id || selectedOpenAiUniversalBotId;
      syncOpenAiUniversalBotUser(data.bot);
      renderOpenAiUniversalSettings();
      refreshRenderedAiBotAvatar(data.bot);
      setOpenAiUniversalStatus('Avatar saved', 'success');
    } catch (e) {
      setOpenAiUniversalStatus(e.message || 'Could not upload avatar', 'error');
    }
  }

  async function removeOpenAiUniversalBotAvatar() {
    if (!selectedOpenAiUniversalBotId) return;
    try {
      const data = await api(`/api/admin/openai-universal-bots/${selectedOpenAiUniversalBotId}/avatar`, { method: 'DELETE' });
      mergeOpenAiUniversalState(data);
      selectedOpenAiUniversalBotId = data.bot?.id || selectedOpenAiUniversalBotId;
      syncOpenAiUniversalBotUser(data.bot);
      renderOpenAiUniversalSettings();
      refreshRenderedAiBotAvatar(data.bot);
      setOpenAiUniversalStatus('Avatar removed', 'success');
    } catch (e) {
      setOpenAiUniversalStatus(e.message || 'Could not remove avatar', 'error');
    }
  }

  async function disableOpenAiUniversalBot() {
    if (!selectedOpenAiUniversalBotId) return;
    if (!confirm('Disable this OpenAI universal bot in all chats?')) return;
    try {
      const data = await api(`/api/admin/openai-universal-bots/${selectedOpenAiUniversalBotId}`, { method: 'DELETE' });
      mergeOpenAiUniversalState(data);
      renderOpenAiUniversalSettings();
      setOpenAiUniversalStatus('Universal bot disabled', 'success');
    } catch (e) {
      setOpenAiUniversalStatus(e.message || 'Could not disable universal bot', 'error');
    }
  }

  async function testOpenAiUniversalBot() {
    if (!selectedOpenAiUniversalBotId) { setOpenAiUniversalStatus('Save the bot first', 'error'); return; }
    setOpenAiUniversalStatus('Testing universal bot...');
    try {
      const data = await api(`/api/admin/openai-universal-bots/${selectedOpenAiUniversalBotId}/test`, {
        method: 'POST',
        body: {
          mode: $('#openAiUniversalBotTestMode')?.value || 'auto',
          document_format: $('#openAiUniversalBotTestDocumentFormat')?.value || 'md',
        },
      });
      const text = data.result?.text ? data.result.text.slice(0, 500) : '';
      setOpenAiUniversalStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
    } catch (e) {
      setOpenAiUniversalStatus(e.message || 'Universal bot test failed', 'error');
    }
  }

  async function exportOpenAiUniversalBotJson() {
    if (!selectedOpenAiUniversalBotId) { setOpenAiUniversalStatus('Choose a saved bot first', 'error'); return; }
    setOpenAiUniversalStatus('Preparing JSON...');
    try {
      const headers = {};
      if (token) headers.Authorization = 'Bearer ' + token;
      const res = await fetch(`/api/admin/openai-universal-bots/${selectedOpenAiUniversalBotId}/export`, { headers });
      if (!res.ok) {
        let data = {};
        try { data = await res.json(); } catch {}
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const bot = currentOpenAiUniversalBot();
      const fallbackName = `bananza-openai-universal-${bot?.mention || selectedOpenAiUniversalBotId}.json`;
      const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setOpenAiUniversalStatus('JSON exported', 'success');
    } catch (e) {
      setOpenAiUniversalStatus(e.message || 'Could not export JSON', 'error');
    }
  }

  async function importOpenAiUniversalBotJsonFile(file) {
    if (!file) return;
    setOpenAiUniversalStatus('Importing JSON...');
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const data = await api('/api/admin/openai-universal-bots/import', { method: 'POST', body: payload });
      mergeOpenAiUniversalState(data);
      selectedOpenAiUniversalBotId = data.bot?.id || selectedOpenAiUniversalBotId;
      renderOpenAiUniversalSettings();
      const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
      setOpenAiUniversalStatus(`Universal bot imported.${warnings}`, warnings ? 'error' : 'success');
    } catch (e) {
      setOpenAiUniversalStatus(e.message || 'Could not import JSON', 'error');
    } finally {
      const input = $('#openAiUniversalBotImportFile');
      if (input) input.value = '';
    }
  }

  async function saveOpenAiUniversalChatBotSettings() {
    const chatId = Number($('#openAiUniversalBotChatSelect')?.value || 0);
    const botId = Number($('#openAiUniversalBotChatBotSelect')?.value || 0);
    const botExists = openAiUniversalState.bots.some(bot => Number(bot.id) === Number(botId));
    if (!chatId || !botId) { setOpenAiUniversalChatStatus('Choose chat and bot', 'error'); return; }
    if (!botExists) {
      setOpenAiUniversalChatStatus('Save the bot first', 'error');
      await loadOpenAiUniversalState().catch(() => {});
      return;
    }
    try {
      const data = await api('/api/admin/openai-universal-bots/chat-settings', {
        method: 'PUT',
        body: {
          chatId,
          botId,
          enabled: $('#openAiUniversalBotChatEnabled')?.checked,
          mode: $('#openAiUniversalBotChatMode')?.value || 'simple',
          hot_context_limit: Number($('#openAiUniversalBotChatHotLimit')?.value || 50),
          auto_react_on_mention: $('#openAiUniversalBotChatAutoReact')?.checked,
        },
      });
      mergeOpenAiUniversalState(data);
      renderOpenAiUniversalChatBotSettings();
      setOpenAiUniversalChatStatus('Chat settings saved', 'success');
    } catch (e) {
      setOpenAiUniversalChatStatus(e.message || 'Could not save chat settings', 'error');
    }
  }

  function setDeepseekAiStatus(message, type = '') {
    setInlineStatus('deepseekAiStatus', message, type);
  }

  function setDeepseekAiProviderStatus(message, type = '') {
    setInlineStatus('deepseekAiProviderStatus', message, type);
  }

  function setDeepseekBotStatus(message, type = '') {
    setInlineStatus('deepseekAiBotEditorStatus', message, type);
  }

  function setDeepseekChatStatus(message, type = '') {
    setInlineStatus('deepseekAiBotChatStatus', message, type);
  }

  function setDeepseekAiModelStatus(message, type = '') {
    setInlineStatus('deepseekAiModelStatus', message, type);
  }

  function currentDeepseekBot() {
    return deepseekBotState.bots.find(bot => Number(bot.id) === Number(selectedDeepseekBotId)) || null;
  }

  function getDeepseekChatSetting(chatId, botId) {
    return deepseekBotState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
  }

  function mergeDeepseekAiState(data = {}) {
    const state = data.state || data;
    if (state.settings) deepseekBotState.settings = { ...deepseekBotState.settings, ...state.settings };
    if (state.bots) deepseekBotState.bots = state.bots;
    if (state.chats) deepseekBotState.chats = state.chats;
    if (state.chatSettings) deepseekBotState.chatSettings = state.chatSettings;
    if (state.models) deepseekBotState.models = { ...deepseekBotState.models, ...state.models };
    if (selectedDeepseekBotId && !deepseekBotState.bots.some(bot => Number(bot.id) === Number(selectedDeepseekBotId))) {
      selectedDeepseekBotId = null;
    }
    mentionTargetsByChat.clear();
  }

  function renderDeepseekModelOptions(bot = currentDeepseekBot()) {
    const settings = deepseekBotState.settings || {};
    const models = deepseekBotState.models || {};
    const responseModels = models.response || ['deepseek-chat', 'deepseek-reasoner'];
    const summaryModels = models.summary || responseModels;
    setAiModelSelectOptions('deepseekAiDefaultResponseModel', responseModels, settings.deepseek_default_response_model || 'deepseek-chat');
    setAiModelSelectOptions('deepseekAiDefaultSummaryModel', summaryModels, settings.deepseek_default_summary_model || 'deepseek-chat');
    setAiModelSelectOptions('deepseekAiBotResponseModel', responseModels, bot?.response_model || settings.deepseek_default_response_model || 'deepseek-chat');
    setAiModelSelectOptions('deepseekAiBotSummaryModel', summaryModels, bot?.summary_model || settings.deepseek_default_summary_model || 'deepseek-chat');
  }

  function renderDeepseekBotAvatar(bot = currentDeepseekBot()) {
    const avatarEl = $('#deepseekAiBotAvatar');
    if (!avatarEl) return;
    const name = bot?.name || $('#deepseekAiBotName')?.value.trim() || 'DeepSeek AI';
    const color = bot?.avatar_color || '#65aadd';
    avatarEl.style.background = color;
    if (bot?.avatar_url) {
      avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
    } else {
      avatarEl.textContent = initials(name);
    }

    const hasSavedBot = Boolean(bot?.id);
    const input = $('#deepseekAiBotAvatarInput');
    const label = $('#deepseekAiBotAvatarLabel');
    if (input) {
      input.disabled = !hasSavedBot;
      input.value = '';
    }
    if (label) {
      label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
      label.title = hasSavedBot ? 'Change avatar' : 'Save the bot first';
    }
    $('#removeDeepseekAiBotAvatar')?.classList.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
  }

  function fillDeepseekBotForm(bot = null) {
    const settings = deepseekBotState.settings || {};
    selectedDeepseekBotId = bot ? bot.id : null;
    $('#deepseekAiBotName').value = bot?.name || 'DeepSeek AI';
    $('#deepseekAiBotMention').value = bot?.mention || 'deepseek';
    $('#deepseekAiBotEnabled').checked = bot ? !!bot.enabled : true;
    setBotVisibilityToggle('deepseekAiBotVisibleToUsers', !!bot?.visible_to_users);
    $('#deepseekAiBotResponseModel').value = bot?.response_model || settings.deepseek_default_response_model || 'deepseek-chat';
    $('#deepseekAiBotSummaryModel').value = bot?.summary_model || settings.deepseek_default_summary_model || 'deepseek-chat';
    $('#deepseekAiBotTemperature').value = bot?.temperature ?? settings.deepseek_temperature ?? 0.3;
    $('#deepseekAiBotMaxTokens').value = bot?.max_tokens ?? settings.deepseek_max_tokens ?? 1000;
    $('#deepseekAiBotStyle').value = bot?.style || 'Helpful DeepSeek assistant for chat';
    $('#deepseekAiBotTone').value = bot?.tone || 'warm, concise, attentive';
    $('#deepseekAiBotRules').value = bot?.behavior_rules || '';
    $('#deepseekAiBotSpeech').value = bot?.speech_patterns || '';
    renderDeepseekBotAvatar(bot);
    renderDeepseekModelOptions(bot);
    renderDeepseekBotList();
    renderDeepseekChatBotSettings();
  }

  function deepseekBotFormPayload() {
    return {
      name: $('#deepseekAiBotName')?.value.trim(),
      mention: $('#deepseekAiBotMention')?.value.trim(),
      enabled: $('#deepseekAiBotEnabled')?.checked,
      visible_to_users: getBotVisibilityToggle('deepseekAiBotVisibleToUsers'),
      response_model: $('#deepseekAiBotResponseModel')?.value.trim(),
      summary_model: $('#deepseekAiBotSummaryModel')?.value.trim(),
      temperature: Number($('#deepseekAiBotTemperature')?.value || 0.3),
      max_tokens: Number($('#deepseekAiBotMaxTokens')?.value || 1000),
      style: $('#deepseekAiBotStyle')?.value.trim(),
      tone: $('#deepseekAiBotTone')?.value.trim(),
      behavior_rules: $('#deepseekAiBotRules')?.value.trim(),
      speech_patterns: $('#deepseekAiBotSpeech')?.value.trim(),
    };
  }

  function renderDeepseekBotList() {
    const list = $('#deepseekAiBotList');
    if (!list) return;
    if (!deepseekBotState.bots.length) {
      list.innerHTML = '<div class="ai-bot-empty">No DeepSeek bots yet. Create the first one.</div>';
      return;
    }
    list.innerHTML = deepseekBotState.bots.map(bot => `
      <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedDeepseekBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
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

  function renderDeepseekChatBotSettings() {
    const chatSelect = $('#deepseekAiBotChatSelect');
    const botSelect = $('#deepseekAiBotChatBotSelect');
    if (!chatSelect || !botSelect) return;
    const currentChatValue = chatSelect.value || String(currentChatId || deepseekBotState.chats[0]?.id || '');
    const currentBotValue = botSelect.value || String(selectedDeepseekBotId || deepseekBotState.bots[0]?.id || '');

    chatSelect.innerHTML = deepseekBotState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
    botSelect.innerHTML = deepseekBotState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
    if (deepseekBotState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
    if (deepseekBotState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
    if (!botSelect.value && deepseekBotState.bots[0]) botSelect.value = String(deepseekBotState.bots[0].id);

    const setting = getDeepseekChatSetting(chatSelect.value, botSelect.value);
    $('#deepseekAiBotChatEnabled').checked = !!setting?.enabled;
    $('#deepseekAiBotChatMode').value = 'simple';
    $('#deepseekAiBotChatHotLimit').value = setting?.hot_context_limit || 50;
    $('#deepseekAiBotChatAutoReact').checked = !!setting?.auto_react_on_mention;
  }

  function renderDeepseekAiSettings() {
    const settings = deepseekBotState.settings || {};
    $('#deepseekAiGlobalEnabled').checked = !!settings.deepseek_enabled;
    $('#deepseekAiInteractiveEnabled').checked = !!settings.deepseek_interactive_enabled;
    $('#deepseekAiBaseUrl').value = settings.deepseek_base_url || 'https://api.deepseek.com';
    $('#deepseekAiTemperature').value = settings.deepseek_temperature ?? 0.3;
    $('#deepseekAiMaxTokens').value = settings.deepseek_max_tokens ?? 1000;
    $('#deepseekAiApiKey').value = '';
    $('#deepseekAiKeyStatus').textContent = settings.has_deepseek_key
      ? `Key saved: ${settings.masked_deepseek_key || '***'}`
      : 'Key is not saved';
    renderDeepseekModelOptions(currentDeepseekBot());
    $('#deepseekAiDefaultResponseModel').value = settings.deepseek_default_response_model || 'deepseek-chat';
    $('#deepseekAiDefaultSummaryModel').value = settings.deepseek_default_summary_model || 'deepseek-chat';
    const selected = currentDeepseekBot() || deepseekBotState.bots[0] || null;
    fillDeepseekBotForm(selected);
    renderDeepseekChatBotSettings();
    const models = deepseekBotState.models || {};
    if (models.error) {
      setDeepseekAiModelStatus(`Model list fallback is used: ${formatUiErrorMessage(models.error, 'Could not load DeepSeek models')}`, 'error');
    } else if (models.source === 'live') {
      setDeepseekAiModelStatus(`Loaded ${models.response?.length || 0} DeepSeek models for selectors.`, 'success');
    } else {
      setDeepseekAiModelStatus('Saved defaults are shown. Use "Refresh models" or "Test key" to load live DeepSeek models.');
    }
  }

  function deepseekAiSettingsPayload() {
    const body = {
      deepseek_enabled: $('#deepseekAiGlobalEnabled')?.checked,
      deepseek_interactive_enabled: $('#deepseekAiInteractiveEnabled')?.checked,
      deepseek_base_url: $('#deepseekAiBaseUrl')?.value.trim(),
      deepseek_default_response_model: $('#deepseekAiDefaultResponseModel')?.value.trim(),
      deepseek_default_summary_model: $('#deepseekAiDefaultSummaryModel')?.value.trim(),
      deepseek_temperature: Number($('#deepseekAiTemperature')?.value || 0.3),
      deepseek_max_tokens: Number($('#deepseekAiMaxTokens')?.value || 1000),
    };
    const key = $('#deepseekAiApiKey')?.value.trim();
    if (key) body.deepseek_api_key = key;
    return body;
  }

  async function persistDeepseekAiSettings() {
    const data = await api('/api/admin/deepseek-ai-bots/settings', {
      method: 'PUT',
      body: deepseekAiSettingsPayload(),
    });
    mergeDeepseekAiState(data);
    return data;
  }

  async function loadDeepseekAiState() {
    const data = await api('/api/admin/deepseek-ai-bots');
    mergeDeepseekAiState(data);
    renderDeepseekAiSettings();
  }

  async function saveDeepseekAiSettings() {
    setDeepseekAiProviderStatus('Saving...', 'pending');
    try {
      await persistDeepseekAiSettings();
      renderDeepseekAiSettings();
      setDeepseekAiProviderStatus(`Settings saved\n${providerInteractiveSummary('deepseek', deepseekBotState.settings)}`, 'success');
    } catch (e) {
      setDeepseekAiProviderStatus(e.message || 'Could not save settings', 'error');
    }
  }

  async function testDeepseekAiConnection() {
    const keyInput = $('#deepseekAiApiKey');
    const hasKey = Boolean(keyInput?.value.trim() || deepseekBotState.settings?.has_deepseek_key);
    if (!hasKey) {
      setDeepseekAiProviderStatus('Enter DeepSeek API key before testing.', 'error');
      keyInput?.focus();
      return;
    }
    setDeepseekAiProviderStatus('Checking DeepSeek connection...', 'pending');
    try {
      const data = await api('/api/admin/deepseek-ai-bots/test-connection', {
        method: 'POST',
        body: deepseekAiSettingsPayload(),
      });
      await persistDeepseekAiSettings();
      if (data.state?.models) mergeDeepseekAiState({ state: { models: data.state.models } });
      renderDeepseekAiSettings();
      const text = String(data.result?.text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
      setDeepseekAiProviderStatus(`Key verified (${data.result?.latencyMs || 0} ms). ${text}`, 'success');
    } catch (e) {
      setDeepseekAiProviderStatus(formatUiErrorMessage(e, 'Could not check DeepSeek key'), 'error');
    }
  }

  async function refreshDeepseekAiModels() {
    const keyInput = $('#deepseekAiApiKey');
    const hasKey = Boolean(keyInput?.value.trim() || deepseekBotState.settings?.has_deepseek_key);
    if (!hasKey) {
      setDeepseekAiProviderStatus('Enter or save DeepSeek API key before loading models.', 'error');
      keyInput?.focus();
      return;
    }
    setDeepseekAiProviderStatus('Loading DeepSeek models...', 'pending');
    try {
      const data = await api('/api/admin/deepseek-ai-bots/models/refresh', {
        method: 'POST',
        body: deepseekAiSettingsPayload(),
      });
      mergeDeepseekAiState(data);
      renderDeepseekAiSettings();
      setDeepseekAiProviderStatus(`Models refreshed: ${deepseekBotState.models?.response?.length || 0}.`, 'success');
    } catch (e) {
      setDeepseekAiProviderStatus(formatUiErrorMessage(e, 'Could not load DeepSeek models'), 'error');
    }
  }

  async function deleteDeepseekAiKey() {
    if (!confirm('Delete DeepSeek API key for AI bots?')) return;
    try {
      const data = await api('/api/admin/deepseek-ai-bots/key', { method: 'DELETE' });
      mergeDeepseekAiState(data);
      renderDeepseekAiSettings();
      setDeepseekAiProviderStatus('Key deleted', 'success');
    } catch (e) {
      setDeepseekAiProviderStatus(e.message || 'Could not delete key', 'error');
    }
  }

  async function saveDeepseekBot() {
    const payload = deepseekBotFormPayload();
    if (!payload.name) { setDeepseekBotStatus('Enter bot name', 'error'); return; }
    setDeepseekBotStatus('Saving bot...', 'pending');
    try {
      await persistDeepseekAiSettings();
      const shouldUpdate = Boolean(selectedDeepseekBotId && deepseekBotState.bots.some(bot => Number(bot.id) === Number(selectedDeepseekBotId)));
      const url = shouldUpdate ? `/api/admin/deepseek-ai-bots/${selectedDeepseekBotId}` : '/api/admin/deepseek-ai-bots';
      const method = shouldUpdate ? 'PUT' : 'POST';
      const data = await api(url, { method, body: payload });
      mergeDeepseekAiState(data);
      selectedDeepseekBotId = data.bot?.id || selectedDeepseekBotId;
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
      renderDeepseekAiSettings();
      const status = buildVerifiedBotSaveStatus('Bot saved.', data.bot, payload, formatCapabilityState(data.bot || payload));
      setDeepseekBotStatus(status.message, status.type);
    } catch (e) {
      setDeepseekBotStatus(e.message || 'Could not save bot', 'error');
    }
  }

  async function uploadDeepseekBotAvatar(file) {
    if (!file) return;
    if (!selectedDeepseekBotId) {
      setDeepseekBotStatus('Save the bot before adding an avatar', 'error');
      renderDeepseekBotAvatar(null);
      return;
    }
    const fd = new FormData();
    fd.append('avatar', file);
    setDeepseekBotStatus('Uploading avatar...', 'pending');
    try {
      const data = await api(`/api/admin/deepseek-ai-bots/${selectedDeepseekBotId}/avatar`, { method: 'POST', body: fd });
      mergeDeepseekAiState(data);
      selectedDeepseekBotId = data.bot?.id || selectedDeepseekBotId;
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
      renderDeepseekBotList();
      renderDeepseekBotAvatar(currentDeepseekBot());
      refreshRenderedAiBotAvatar(data.bot);
      renderDeepseekChatBotSettings();
      setDeepseekBotStatus('Avatar saved', 'success');
    } catch (e) {
      setDeepseekBotStatus(e.message || 'Could not upload avatar', 'error');
      renderDeepseekBotAvatar(currentDeepseekBot());
    }
  }

  async function removeDeepseekBotAvatar() {
    if (!selectedDeepseekBotId) return;
    try {
      const data = await api(`/api/admin/deepseek-ai-bots/${selectedDeepseekBotId}/avatar`, { method: 'DELETE' });
      mergeDeepseekAiState(data);
      selectedDeepseekBotId = data.bot?.id || selectedDeepseekBotId;
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
      renderDeepseekBotList();
      renderDeepseekBotAvatar(currentDeepseekBot());
      refreshRenderedAiBotAvatar(data.bot);
      renderDeepseekChatBotSettings();
      setDeepseekBotStatus('Avatar removed', 'success');
    } catch (e) {
      setDeepseekBotStatus(e.message || 'Could not remove avatar', 'error');
    }
  }

  async function disableDeepseekBot() {
    if (!selectedDeepseekBotId) return;
    if (!confirm('Disable this DeepSeek bot in all chats?')) return;
    try {
      const data = await api(`/api/admin/deepseek-ai-bots/${selectedDeepseekBotId}`, { method: 'DELETE' });
      mergeDeepseekAiState(data);
      renderDeepseekAiSettings();
      setDeepseekBotStatus('Bot disabled', 'success');
    } catch (e) {
      setDeepseekBotStatus(e.message || 'Could not disable bot', 'error');
    }
  }

  async function testDeepseekBot() {
    if (!selectedDeepseekBotId) { setDeepseekBotStatus('Save the bot first', 'error'); return; }
    setDeepseekBotStatus('Testing model...', 'pending');
    try {
      await persistDeepseekAiSettings();
      const data = await api(`/api/admin/deepseek-ai-bots/${selectedDeepseekBotId}/test`, { method: 'POST', body: {} });
      const text = data.result?.text ? data.result.text.slice(0, 500) : '';
      setDeepseekBotStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
    } catch (e) {
      setDeepseekBotStatus(e.message || 'Test failed', 'error');
    }
  }

  async function exportDeepseekBotJson() {
    if (!selectedDeepseekBotId) { setDeepseekBotStatus('Choose a saved bot first', 'error'); return; }
    setDeepseekBotStatus('Preparing JSON...', 'pending');
    try {
      const headers = {};
      if (token) headers.Authorization = 'Bearer ' + token;
      const res = await fetch(`/api/admin/deepseek-ai-bots/${selectedDeepseekBotId}/export`, { headers });
      if (!res.ok) {
        let data = {};
        try { data = await res.json(); } catch {}
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const bot = currentDeepseekBot();
      const fallbackName = `bananza-deepseek-bot-${bot?.mention || selectedDeepseekBotId}.json`;
      const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDeepseekBotStatus('JSON exported', 'success');
    } catch (e) {
      setDeepseekBotStatus(e.message || 'Could not export JSON', 'error');
    }
  }

  async function importDeepseekBotJsonFile(file) {
    if (!file) return;
    setDeepseekBotStatus('Importing JSON...', 'pending');
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const data = await api('/api/admin/deepseek-ai-bots/import', { method: 'POST', body: payload });
      mergeDeepseekAiState(data);
      selectedDeepseekBotId = data.bot?.id || selectedDeepseekBotId;
      renderDeepseekAiSettings();
      const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
      setDeepseekBotStatus(`Bot imported.${warnings}`, warnings ? 'error' : 'success');
    } catch (e) {
      setDeepseekBotStatus(e.message || 'Could not import JSON', 'error');
    } finally {
      const input = $('#deepseekAiBotImportFile');
      if (input) input.value = '';
    }
  }

  async function saveDeepseekChatBotSettings() {
    const chatId = Number($('#deepseekAiBotChatSelect')?.value || 0);
    const botId = Number($('#deepseekAiBotChatBotSelect')?.value || 0);
    const botExists = deepseekBotState.bots.some(bot => Number(bot.id) === botId);
    if (!chatId || !botId) { setDeepseekChatStatus('Choose chat and bot', 'error'); return; }
    if (!botExists) {
      setDeepseekChatStatus('Save the bot first', 'error');
      await loadDeepseekAiState().catch(() => {});
      return;
    }
    try {
      await persistDeepseekAiSettings();
      const data = await api('/api/admin/deepseek-ai-bots/chat-settings', {
        method: 'PUT',
        body: {
          chatId,
          botId,
          enabled: $('#deepseekAiBotChatEnabled')?.checked,
          mode: 'simple',
          hot_context_limit: Number($('#deepseekAiBotChatHotLimit')?.value || 50),
          auto_react_on_mention: $('#deepseekAiBotChatAutoReact')?.checked,
        },
      });
      mergeDeepseekAiState(data);
      renderDeepseekChatBotSettings();
      setDeepseekChatStatus('Chat settings saved', 'success');
    } catch (e) {
      setDeepseekChatStatus(e.message || 'Could not save chat settings', 'error');
    }
  }

  function setYandexAiStatus(message, type = '') {
    setInlineStatus('yandexAiStatus', message, type);
  }

  function setYandexAiProviderStatus(message, type = '') {
    setInlineStatus('yandexAiProviderStatus', message, type);
  }

  function setYandexBotStatus(message, type = '') {
    setInlineStatus('yandexAiBotEditorStatus', message, type);
  }

  function setYandexChatStatus(message, type = '') {
    setInlineStatus('yandexAiBotChatStatus', message, type);
  }

  function setYandexAiModelStatus(message, type = '') {
    setInlineStatus('yandexAiModelStatus', message, type);
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
    setBotVisibilityToggle('yandexAiBotVisibleToUsers', !!bot?.visible_to_users);
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
      visible_to_users: getBotVisibilityToggle('yandexAiBotVisibleToUsers'),
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
    $('#yandexAiBotChatAutoReact').checked = !!setting?.auto_react_on_mention;
  }

  function renderYandexAiSettings() {
    const settings = yandexBotState.settings || {};
    $('#yandexAiGlobalEnabled').checked = !!settings.yandex_enabled;
    $('#yandexAiInteractiveEnabled').checked = !!settings.yandex_interactive_enabled;
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
      yandex_interactive_enabled: $('#yandexAiInteractiveEnabled')?.checked,
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
    setYandexAiProviderStatus('Saving...', 'pending');
    try {
      await persistYandexAiSettings();
      renderYandexAiSettings();
      setYandexAiProviderStatus(`Settings saved\n${providerInteractiveSummary('yandex', yandexBotState.settings)}`, 'success');
    } catch (e) {
      setYandexAiProviderStatus(e.message || 'Could not save settings', 'error');
    }
  }

  async function testYandexAiConnection() {
    const folderInput = $('#yandexAiFolderId');
    const keyInput = $('#yandexAiApiKey');
    const folderId = folderInput?.value.trim();
    const hasKey = Boolean(keyInput?.value.trim() || yandexBotState.settings?.has_yandex_key);
    if (!folderId) {
      setYandexAiProviderStatus('Введите идентификатор каталога Yandex Cloud в поле Folder ID.', 'error');
      setYandexAiModelStatus('Folder ID нужен для modelUri: gpt://<folder_ID>/yandexgpt/latest.', 'error');
      folderInput?.focus();
      return;
    }
    if (!hasKey) {
      setYandexAiProviderStatus('Введите Yandex API key перед проверкой.', 'error');
      keyInput?.focus();
      return;
    }

    setYandexAiProviderStatus('Checking Yandex connection...', 'pending');
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
      setYandexAiProviderStatus(`Ключ проверен и сохранен (${latency} ms). ${text}${modelNote}`, 'success');
      setYandexAiModelStatus(
        models.error
          ? `Key OK. Model list fallback is used: ${formatUiErrorMessage(models.error, 'Could not load Yandex models')}`
          : `OK: ${data.result?.model || 'Yandex model'}`,
        models.error ? 'error' : 'success'
      );
    } catch (e) {
      setYandexAiProviderStatus(formatUiErrorMessage(e, 'Could not check Yandex key'), 'error');
    }
  }

  async function refreshYandexAiModels() {
    const folderInput = $('#yandexAiFolderId');
    const keyInput = $('#yandexAiApiKey');
    const folderId = folderInput?.value.trim();
    const hasKey = Boolean(keyInput?.value.trim() || yandexBotState.settings?.has_yandex_key);
    if (!folderId) {
      setYandexAiProviderStatus('Введите идентификатор каталога Yandex Cloud в поле Folder ID.', 'error');
      folderInput?.focus();
      return;
    }
    if (!hasKey) {
      setYandexAiProviderStatus('Введите или сохраните Yandex API key перед загрузкой моделей.', 'error');
      keyInput?.focus();
      return;
    }

    setYandexAiProviderStatus('Loading Yandex models...', 'pending');
    try {
      const data = await api('/api/admin/yandex-ai-bots/models/refresh', {
        method: 'POST',
        body: yandexAiSettingsPayload(),
      });
      mergeYandexAiState(data);
      renderYandexAiSettings();
      setYandexAiProviderStatus(`Модели обновлены: ${yandexBotState.models?.response?.length || 0} в селекторе.`, 'success');
    } catch (e) {
      setYandexAiProviderStatus(formatUiErrorMessage(e, 'Could not load Yandex models'), 'error');
    }
  }

  async function deleteYandexAiKey() {
    if (!confirm('Delete Yandex API key for AI bots?')) return;
    try {
      const data = await api('/api/admin/yandex-ai-bots/key', { method: 'DELETE' });
      mergeYandexAiState(data);
      renderYandexAiSettings();
      setYandexAiProviderStatus('Key deleted', 'success');
    } catch (e) {
      setYandexAiProviderStatus(e.message || 'Could not delete key', 'error');
    }
  }

  async function saveYandexBot() {
    const payload = yandexBotFormPayload();
    if (!payload.name) { setYandexBotStatus('Enter bot name', 'error'); return; }
    setYandexBotStatus('Saving bot...', 'pending');
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
      const status = buildVerifiedBotSaveStatus('Bot saved.', data.bot, payload, formatCapabilityState(data.bot || payload));
      setYandexBotStatus(status.message, status.type);
    } catch (e) {
      setYandexBotStatus(e.message || 'Could not save bot', 'error');
    }
  }

  async function uploadYandexBotAvatar(file) {
    if (!file) return;
    if (!selectedYandexBotId) {
      setYandexBotStatus('Save the bot before adding an avatar', 'error');
      renderYandexBotAvatar(null);
      return;
    }
    const fd = new FormData();
    fd.append('avatar', file);
    setYandexBotStatus('Uploading avatar...', 'pending');
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
      setYandexBotStatus('Avatar saved', 'success');
    } catch (e) {
      setYandexBotStatus(e.message || 'Could not upload avatar', 'error');
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
      setYandexBotStatus('Avatar removed', 'success');
    } catch (e) {
      setYandexBotStatus(e.message || 'Could not remove avatar', 'error');
    }
  }

  async function disableYandexBot() {
    if (!selectedYandexBotId) return;
    if (!confirm('Disable this Yandex bot in all chats?')) return;
    try {
      const data = await api(`/api/admin/yandex-ai-bots/${selectedYandexBotId}`, { method: 'DELETE' });
      mergeYandexAiState(data);
      renderYandexAiSettings();
      setYandexBotStatus('Bot disabled', 'success');
    } catch (e) {
      setYandexBotStatus(e.message || 'Could not disable bot', 'error');
    }
  }

  async function testYandexBot() {
    if (!selectedYandexBotId) { setYandexBotStatus('Save the bot first', 'error'); return; }
    setYandexBotStatus('Testing model...', 'pending');
    try {
      await persistYandexAiSettings();
      const data = await api(`/api/admin/yandex-ai-bots/${selectedYandexBotId}/test`, { method: 'POST', body: {} });
      const text = data.result?.text ? data.result.text.slice(0, 500) : '';
      setYandexBotStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
    } catch (e) {
      setYandexBotStatus(e.message || 'Test failed', 'error');
    }
  }

  async function exportYandexBotJson() {
    if (!selectedYandexBotId) { setYandexBotStatus('Choose a saved bot first', 'error'); return; }
    setYandexBotStatus('Preparing JSON...', 'pending');
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
      setYandexBotStatus('JSON exported', 'success');
    } catch (e) {
      setYandexBotStatus(e.message || 'Could not export JSON', 'error');
    }
  }

  async function importYandexBotJsonFile(file) {
    if (!file) return;
    setYandexBotStatus('Importing JSON...', 'pending');
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const data = await api('/api/admin/yandex-ai-bots/import', { method: 'POST', body: payload });
      mergeYandexAiState(data);
      selectedYandexBotId = data.bot?.id || selectedYandexBotId;
      renderYandexAiSettings();
      const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
      setYandexBotStatus(`Bot imported.${warnings}`, warnings ? 'error' : 'success');
    } catch (e) {
      setYandexBotStatus(e.message || 'Could not import JSON', 'error');
    } finally {
      const input = $('#yandexAiBotImportFile');
      if (input) input.value = '';
    }
  }

  async function saveYandexChatBotSettings() {
    const chatId = Number($('#yandexAiBotChatSelect')?.value || 0);
    const botId = Number($('#yandexAiBotChatBotSelect')?.value || 0);
    const botExists = yandexBotState.bots.some(bot => Number(bot.id) === botId);
    if (!chatId || !botId) { setYandexChatStatus('Choose chat and bot', 'error'); return; }
    if (!botExists) {
      setYandexChatStatus('Save the bot first', 'error');
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
          auto_react_on_mention: $('#yandexAiBotChatAutoReact')?.checked,
        },
      });
      mergeYandexAiState(data);
      renderYandexChatBotSettings();
      setYandexChatStatus('Chat settings saved', 'success');
    } catch (e) {
      setYandexChatStatus(e.message || 'Could not save chat settings', 'error');
    }
  }

  function setGrokStatus(statusId, message, type = '') {
    setInlineStatus(statusId, message, type);
  }

  function setGrokAiStatus(message, type = '') {
    setGrokStatus('grokAiStatus', message, type);
  }

  function setGrokTextStatus(message, type = '') {
    setGrokStatus('grokAiTextStatus', message, type);
  }

  function setGrokImageStatus(message, type = '') {
    setGrokStatus('grokAiImageStatus', message, type);
  }

  function setGrokUniversalStatus(message, type = '') {
    setGrokStatus('grokAiUniversalStatus', message, type);
  }

  function setGrokAiProviderStatus(message, type = '') {
    setGrokStatus('grokAiProviderStatus', message, type);
  }

  function setGrokTextEditorStatus(message, type = '') {
    setGrokStatus(['grokAiBotEditorStatus', 'grokAiBotEditorStatusBottom'], message, type);
  }

  function setGrokImageEditorStatus(message, type = '') {
    setGrokStatus('grokAiImageBotEditorStatus', message, type);
  }

  function setGrokUniversalEditorStatus(message, type = '') {
    setGrokStatus('grokAiUniversalBotEditorStatus', message, type);
  }

  function setGrokTextChatStatus(message, type = '') {
    setGrokStatus('grokAiBotChatStatus', message, type);
  }

  function setGrokImageChatStatus(message, type = '') {
    setGrokStatus('grokAiImageBotChatStatus', message, type);
  }

  function setGrokUniversalChatStatus(message, type = '') {
    setGrokStatus('grokAiUniversalBotChatStatus', message, type);
  }

  function setGrokBotStatus(kind = 'text', message, type = '') {
    if (kind === 'image') setGrokImageEditorStatus(message, type);
    else if (kind === 'universal') setGrokUniversalEditorStatus(message, type);
    else setGrokTextEditorStatus(message, type);
  }

  function setGrokAiModelStatus(message, type = '') {
    setInlineStatus('grokAiModelStatus', message, type);
  }

  function wireAiBotToggleLabels() {
    document.querySelectorAll('.ai-bot-toggle-label').forEach((label) => {
      if (label.dataset.toggleLabelBound === '1') return;
      label.dataset.toggleLabelBound = '1';
      label.addEventListener('click', (e) => {
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (!checkbox || checkbox.disabled) return;
        if (e.target === checkbox) return;
        // Nested <label> elements are invalid HTML and can double-toggle on some browsers.
        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('input', { bubbles: true }));
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  function currentGrokBot() {
    return grokBotState.bots.find(bot => Number(bot.id) === Number(selectedGrokBotId)) || null;
  }

  function currentGrokImageBot() {
    return grokBotState.imageBots.find(bot => Number(bot.id) === Number(selectedGrokImageBotId)) || null;
  }

  function currentGrokUniversalBot() {
    return grokUniversalState.bots.find(bot => Number(bot.id) === Number(selectedGrokUniversalBotId)) || null;
  }

  function getGrokChatSetting(chatId, botId) {
    return grokBotState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
  }

  function getGrokImageChatSetting(chatId, botId) {
    return grokBotState.imageChatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
  }

  function getGrokUniversalChatSetting(chatId, botId) {
    return grokUniversalState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
  }

  function mergeGrokAiState(data = {}) {
    const state = data.state || data;
    if (state.settings) syncSharedGrokSettings(state.settings);
    if (state.bots) grokBotState.bots = state.bots;
    if (state.imageBots) grokBotState.imageBots = state.imageBots;
    if (state.chats) grokBotState.chats = state.chats;
    if (state.chatSettings) grokBotState.chatSettings = state.chatSettings;
    if (state.imageChatSettings) grokBotState.imageChatSettings = state.imageChatSettings;
    if (state.chats) grokUniversalState.chats = state.chats;
    if (state.models) {
      grokBotState.models = { ...grokBotState.models, ...state.models };
      grokUniversalState.models = { ...grokUniversalState.models, ...state.models };
    }
    grokUniversalState.settings = grokBotState.settings;
    if (selectedGrokBotId && !grokBotState.bots.some(bot => Number(bot.id) === Number(selectedGrokBotId))) {
      selectedGrokBotId = null;
    }
    if (selectedGrokImageBotId && !grokBotState.imageBots.some(bot => Number(bot.id) === Number(selectedGrokImageBotId))) {
      selectedGrokImageBotId = null;
    }
    mentionTargetsByChat.clear();
    updateComposerAiOverrideState().catch(() => {});
  }

  function mergeGrokUniversalState(data = {}) {
    const state = data.state || data;
    if (state.settings) syncSharedGrokSettings(state.settings);
    if (state.bots) grokUniversalState.bots = state.bots;
    if (state.chats) grokUniversalState.chats = state.chats;
    if (state.chatSettings) grokUniversalState.chatSettings = state.chatSettings;
    if (state.models) {
      grokUniversalState.models = { ...grokUniversalState.models, ...state.models };
      grokBotState.models = { ...grokBotState.models, ...state.models };
    }
    grokUniversalState.settings = grokBotState.settings;
    if (selectedGrokUniversalBotId && !grokUniversalState.bots.some(bot => Number(bot.id) === Number(selectedGrokUniversalBotId))) {
      selectedGrokUniversalBotId = null;
    }
    mentionTargetsByChat.clear();
    updateComposerAiOverrideState().catch(() => {});
  }

  function renderNamedGrokAvatar({ bot, avatarId, nameId, fallbackName, inputId, labelId, removeId }) {
    const avatarEl = $(avatarId);
    if (!avatarEl) return;
    const name = bot?.name || $(nameId)?.value.trim() || fallbackName;
    const color = bot?.avatar_color || '#65aadd';
    avatarEl.style.background = color;
    if (bot?.avatar_url) {
      avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
    } else {
      avatarEl.textContent = initials(name);
    }

    const hasSavedBot = Boolean(bot?.id);
    const input = $(inputId);
    const label = $(labelId);
    if (input) {
      input.disabled = !hasSavedBot;
      input.value = '';
    }
    if (label) {
      label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
      label.title = hasSavedBot ? 'Change avatar' : 'Save the bot first';
    }
    $(removeId)?.classList.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
  }

  function renderGrokBotAvatar(bot = currentGrokBot()) {
    renderNamedGrokAvatar({
      bot,
      avatarId: 'grokAiBotAvatar',
      nameId: 'grokAiBotName',
      fallbackName: 'Grok AI',
      inputId: 'grokAiBotAvatarInput',
      labelId: 'grokAiBotAvatarLabel',
      removeId: 'removeGrokAiBotAvatar',
    });
  }

  function renderGrokImageBotAvatar(bot = currentGrokImageBot()) {
    renderNamedGrokAvatar({
      bot,
      avatarId: 'grokAiImageBotAvatar',
      nameId: 'grokAiImageBotName',
      fallbackName: 'Grok Images',
      inputId: 'grokAiImageBotAvatarInput',
      labelId: 'grokAiImageBotAvatarLabel',
      removeId: 'removeGrokAiImageBotAvatar',
    });
  }

  function renderGrokUniversalBotAvatar(bot = currentGrokUniversalBot()) {
    renderNamedGrokAvatar({
      bot,
      avatarId: 'grokAiUniversalBotAvatar',
      nameId: 'grokAiUniversalBotName',
      fallbackName: 'Grok Universal',
      inputId: 'grokAiUniversalBotAvatarInput',
      labelId: 'grokAiUniversalBotAvatarLabel',
      removeId: 'removeGrokAiUniversalBotAvatar',
    });
  }

  function mountGrokBotPanels() {
    const settingsBlock = $('#grokAiSettingsBlock');
    const textBlock = $('#grokAiTextBotsBlock');
    const imageBlock = $('#grokAiImageBotsBlock');
    const universalBlock = $('#grokAiUniversalBotsBlock');
    const textPanel = $('#grokAiBotList')?.closest('.ai-bot-panel');
    const imagePanel = $('#grokAiImageBotList')?.closest('.ai-bot-panel');
    const universalPanel = $('#grokAiUniversalBotList')?.closest('.ai-bot-panel');
    const globalStatus = $('#grokAiStatus');
    const textStatus = $('#grokAiTextStatus');
    const imageStatus = $('#grokAiImageStatus');
    const universalStatus = $('#grokAiUniversalStatus');
    const navPanel = $('#grokAiNavPanel');

    if (settingsBlock && navPanel && globalStatus && navPanel.parentElement !== settingsBlock) {
      settingsBlock.insertBefore(navPanel, globalStatus);
    }
    if (textBlock && textPanel && textStatus && textPanel.parentElement !== textBlock) {
      textBlock.insertBefore(textPanel, textStatus);
    }
    if (imageBlock && imagePanel && imageStatus && imagePanel.parentElement !== imageBlock) {
      imageBlock.insertBefore(imagePanel, imageStatus);
    }
    if (universalBlock && universalPanel && universalStatus && universalPanel.parentElement !== universalBlock) {
      universalBlock.insertBefore(universalPanel, universalStatus);
    }
    textPanel?.classList.remove('hidden');
    imagePanel?.classList.remove('hidden');
    universalPanel?.classList.remove('hidden');
  }

  function renderGrokGlobalTextModelOptions() {
    const settings = grokBotState.settings || {};
    const models = grokBotState.models || {};
    const responseModels = models.response || ['grok-4.20-reasoning'];
    const summaryModels = models.summary || responseModels;
    const embeddingModels = models.embedding || ['text-embedding'];
    setAiModelSelectOptions('grokAiDefaultResponseModel', responseModels, settings.grok_default_response_model || responseModels[0] || '');
    setAiModelSelectOptions('grokAiDefaultSummaryModel', summaryModels, settings.grok_default_summary_model || summaryModels[0] || '');
    setAiModelSelectOptions('grokAiDefaultEmbeddingModel', embeddingModels, settings.grok_default_embedding_model || embeddingModels[0] || '');
  }

  function renderGrokBotModelOptions(bot = currentGrokBot()) {
    const settings = grokBotState.settings || {};
    const models = grokBotState.models || {};
    const responseModels = models.response || ['grok-4.20-reasoning'];
    const summaryModels = models.summary || responseModels;
    setAiModelSelectOptions('grokAiBotResponseModel', responseModels, bot?.response_model || settings.grok_default_response_model || responseModels[0] || '');
    setAiModelSelectOptions('grokAiBotSummaryModel', summaryModels, bot?.summary_model || settings.grok_default_summary_model || summaryModels[0] || '');
  }

  function renderGrokUniversalBotModelOptions(bot = currentGrokUniversalBot()) {
    const settings = grokUniversalState.settings || grokBotState.settings || {};
    const models = grokUniversalState.models || grokBotState.models || {};
    const responseModels = models.response || ['grok-4.20-reasoning'];
    const summaryModels = models.summary || responseModels;
    const imageModels = models.image || ['grok-imagine-image'];
    const aspectRatios = models.aspect_ratio || ['1:1', '16:9', '9:16'];
    const resolutions = models.resolution || ['1k', '2k'];
    setAiModelSelectOptions('grokAiUniversalBotResponseModel', responseModels, bot?.response_model || settings.grok_default_response_model || responseModels[0] || '');
    setAiModelSelectOptions('grokAiUniversalBotSummaryModel', summaryModels, bot?.summary_model || settings.grok_default_summary_model || summaryModels[0] || '');
    setAiModelSelectOptions('grokAiUniversalBotImageModel', imageModels, bot?.image_model || settings.grok_default_image_model || imageModels[0] || '');
    setAiModelSelectOptions('grokAiUniversalBotAspectRatio', aspectRatios, bot?.image_aspect_ratio || settings.grok_default_image_aspect_ratio || aspectRatios[0] || '');
    setAiModelSelectOptions('grokAiUniversalBotResolution', resolutions, bot?.image_resolution || settings.grok_default_image_resolution || resolutions[0] || '');
  }

  function renderGrokGlobalImageModelOptions() {
    const settings = grokBotState.settings || {};
    const models = grokBotState.models || {};
    const imageModels = models.image || ['grok-imagine-image'];
    const aspectRatios = models.aspect_ratio || ['1:1', '16:9', '9:16'];
    const resolutions = models.resolution || ['1k', '2k'];
    setAiModelSelectOptions('grokAiDefaultImageModel', imageModels, settings.grok_default_image_model || imageModels[0] || '');
    setAiModelSelectOptions('grokAiDefaultAspectRatio', aspectRatios, settings.grok_default_image_aspect_ratio || aspectRatios[0] || '');
    setAiModelSelectOptions('grokAiDefaultResolution', resolutions, settings.grok_default_image_resolution || resolutions[0] || '');
  }

  function renderGrokImageBotModelOptions(bot = currentGrokImageBot()) {
    const settings = grokBotState.settings || {};
    const models = grokBotState.models || {};
    const imageModels = models.image || ['grok-imagine-image'];
    const aspectRatios = models.aspect_ratio || ['1:1', '16:9', '9:16'];
    const resolutions = models.resolution || ['1k', '2k'];
    setAiModelSelectOptions('grokAiImageBotModel', imageModels, bot?.image_model || settings.grok_default_image_model || imageModels[0] || '');
    setAiModelSelectOptions('grokAiImageBotAspectRatio', aspectRatios, bot?.image_aspect_ratio || settings.grok_default_image_aspect_ratio || aspectRatios[0] || '');
    setAiModelSelectOptions('grokAiImageBotResolution', resolutions, bot?.image_resolution || settings.grok_default_image_resolution || resolutions[0] || '');
  }

  function renderGrokBotList() {
    const list = $('#grokAiBotList');
    if (!list) return;
    if (!grokBotState.bots.length) {
      list.innerHTML = '<div class="ai-bot-empty">No Grok text bots yet. Create the first one.</div>';
      return;
    }
    list.innerHTML = grokBotState.bots.map(bot => `
      <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedGrokBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
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

  function renderGrokImageBotList() {
    const list = $('#grokAiImageBotList');
    if (!list) return;
    if (!grokBotState.imageBots.length) {
      list.innerHTML = '<div class="ai-bot-empty">No Grok image bots yet. Create the first one.</div>';
      return;
    }
    list.innerHTML = grokBotState.imageBots.map(bot => `
      <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedGrokImageBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
        <span class="ai-bot-list-main">
          <span class="ai-bot-list-avatar" style="background:${esc(bot.avatar_color || '#65aadd')}">
            ${bot.avatar_url ? `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">` : esc(initials(bot.name || '?'))}
          </span>
          <span class="ai-bot-list-copy">
            <strong>${esc(bot.name)}</strong>
            <small>@${esc(bot.mention)} · ${bot.enabled ? 'enabled' : 'disabled'}</small>
          </span>
        </span>
        <span class="ai-bot-list-model">${bot.image_model ? esc(bot.image_model) : ''}</span>
      </button>
    `).join('');
  }

  function renderGrokUniversalBotList() {
    const list = $('#grokAiUniversalBotList');
    if (!list) return;
    if (!grokUniversalState.bots.length) {
      list.innerHTML = '<div class="ai-bot-empty">No Grok universal bots yet. Create the first one.</div>';
      return;
    }
    list.innerHTML = grokUniversalState.bots.map(bot => `
      <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedGrokUniversalBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
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

  function fillGrokBotForm(bot = null) {
    const settings = grokBotState.settings || {};
    grokTextBotFormHydrating = true;
    selectedGrokBotId = bot ? bot.id : null;
    $('#grokAiBotName').value = bot?.name || 'Grok AI';
    $('#grokAiBotMention').value = bot?.mention || 'grok';
    $('#grokAiBotEnabled').checked = bot ? !!bot.enabled : true;
    setBotVisibilityToggle('grokAiBotVisibleToUsers', !!bot?.visible_to_users);
    $('#grokAiBotTemperature').value = bot?.temperature ?? settings.grok_temperature ?? 0.3;
    $('#grokAiBotMaxTokens').value = bot?.max_tokens ?? settings.grok_max_tokens ?? 1000;
    $('#grokAiBotStyle').value = bot?.style || 'Helpful Grok assistant for chat';
    $('#grokAiBotTone').value = bot?.tone || 'warm, concise, attentive';
    $('#grokAiBotRules').value = bot?.behavior_rules || '';
    $('#grokAiBotSpeech').value = bot?.speech_patterns || '';
    renderGrokBotModelOptions(bot);
    renderGrokBotAvatar(bot);
    renderGrokBotList();
    renderGrokChatBotSettings();
    grokTextBotFormHydrating = false;
    syncGrokTextBotFormFingerprint();
  }

  function fillGrokImageBotForm(bot = null) {
    selectedGrokImageBotId = bot ? bot.id : null;
    $('#grokAiImageBotName').value = bot?.name || 'Grok Images';
    $('#grokAiImageBotMention').value = bot?.mention || 'grok_image';
    $('#grokAiImageBotEnabled').checked = bot ? !!bot.enabled : true;
    setBotVisibilityToggle('grokAiImageBotVisibleToUsers', !!bot?.visible_to_users);
    $('#grokAiImageBotStyle').value = bot?.style || 'Visual prompt specialist for chat';
    $('#grokAiImageBotTone').value = bot?.tone || 'clear, imaginative, precise';
    $('#grokAiImageBotRules').value = bot?.behavior_rules || '';
    $('#grokAiImageBotSpeech').value = bot?.speech_patterns || '';
    renderGrokImageBotModelOptions(bot);
    renderGrokImageBotAvatar(bot);
    renderGrokImageBotList();
    renderGrokImageChatBotSettings();
  }

  function fillGrokUniversalBotForm(bot = null) {
    const settings = grokUniversalState.settings || grokBotState.settings || {};
    selectedGrokUniversalBotId = bot ? bot.id : null;
    $('#grokAiUniversalBotName').value = bot?.name || 'Grok Universal';
    $('#grokAiUniversalBotMention').value = bot?.mention || 'grok_universal';
    $('#grokAiUniversalBotEnabled').checked = bot ? !!bot.enabled : true;
    setBotVisibilityToggle('grokAiUniversalBotVisibleToUsers', !!bot?.visible_to_users);
    $('#grokAiUniversalBotAllowText').checked = bot?.allow_text ?? true;
    $('#grokAiUniversalBotAllowImageGenerate').checked = bot?.allow_image_generate ?? true;
    $('#grokAiUniversalBotAllowImageEdit').checked = bot?.allow_image_edit ?? true;
    $('#grokAiUniversalBotTemperature').value = bot?.temperature ?? settings.grok_temperature ?? 0.3;
    $('#grokAiUniversalBotMaxTokens').value = bot?.max_tokens ?? settings.grok_max_tokens ?? 1000;
    $('#grokAiUniversalBotStyle').value = bot?.style || 'Helpful Grok universal assistant for chat';
    $('#grokAiUniversalBotTone').value = bot?.tone || 'warm, concise, attentive';
    $('#grokAiUniversalBotRules').value = bot?.behavior_rules || '';
    $('#grokAiUniversalBotSpeech').value = bot?.speech_patterns || '';
    $('#grokAiUniversalBotTestMode').value = 'auto';
    renderGrokUniversalBotModelOptions(bot);
    renderGrokUniversalBotAvatar(bot);
    renderGrokUniversalBotList();
    renderGrokUniversalChatBotSettings();
  }

  function grokBotFormPayload() {
    return {
      kind: 'text',
      name: $('#grokAiBotName')?.value.trim(),
      mention: $('#grokAiBotMention')?.value.trim(),
      enabled: $('#grokAiBotEnabled')?.checked,
      visible_to_users: getBotVisibilityToggle('grokAiBotVisibleToUsers'),
      response_model: $('#grokAiBotResponseModel')?.value.trim(),
      summary_model: $('#grokAiBotSummaryModel')?.value.trim(),
      temperature: Number($('#grokAiBotTemperature')?.value || 0.3),
      max_tokens: Number($('#grokAiBotMaxTokens')?.value || 1000),
      style: $('#grokAiBotStyle')?.value.trim(),
      tone: $('#grokAiBotTone')?.value.trim(),
      behavior_rules: $('#grokAiBotRules')?.value.trim(),
      speech_patterns: $('#grokAiBotSpeech')?.value.trim(),
    };
  }

  const GROK_TEXT_BOT_DIRTY_STATUS = 'Bot settings changed. Click "Save bot" to apply them.';

  function formatCapabilityState(bot = {}) {
    const values = [
      !!bot.allow_poll_create,
      !!bot.allow_poll_vote,
      !!bot.allow_react,
      !!bot.allow_pin,
    ];
    if (values.every(Boolean)) return 'interactive actions: on';
    if (values.every((value) => !value)) return 'interactive actions: off';
    return [
      `poll create: ${bot.allow_poll_create ? 'on' : 'off'}`,
      `poll vote: ${bot.allow_poll_vote ? 'on' : 'off'}`,
      `reactions: ${bot.allow_react ? 'on' : 'off'}`,
      `pin: ${bot.allow_pin ? 'on' : 'off'}`,
    ].join(', ');
  }

  function currentGrokTextBotFormFingerprint() {
    return JSON.stringify(grokBotFormPayload());
  }

  function refreshGrokTextBotDirtyState() {
    const saveBtns = ['grokAiBotSave', 'grokAiBotSaveBottom'].map((id) => $(id)).filter(Boolean);
    const statusEl = $('#grokAiBotEditorStatus') || $('#grokAiBotEditorStatusBottom');
    if (!saveBtns.length || grokTextBotFormHydrating) return;
    const isDirty = currentGrokTextBotFormFingerprint() !== grokTextBotFormFingerprint;
    saveBtns.forEach((saveBtn) => {
      saveBtn.textContent = isDirty ? 'Save bot changes' : 'Save bot';
    });
    if (isDirty) {
      if (!statusEl?.textContent || statusEl.textContent === GROK_TEXT_BOT_DIRTY_STATUS) {
        setGrokTextEditorStatus(GROK_TEXT_BOT_DIRTY_STATUS);
      }
      return;
    }
    if (statusEl?.textContent === GROK_TEXT_BOT_DIRTY_STATUS) {
      setGrokTextEditorStatus('');
    }
  }

  function syncGrokTextBotFormFingerprint() {
    grokTextBotFormFingerprint = currentGrokTextBotFormFingerprint();
    refreshGrokTextBotDirtyState();
  }

  function grokImageBotFormPayload() {
    return {
      kind: 'image',
      name: $('#grokAiImageBotName')?.value.trim(),
      mention: $('#grokAiImageBotMention')?.value.trim(),
      enabled: $('#grokAiImageBotEnabled')?.checked,
      visible_to_users: getBotVisibilityToggle('grokAiImageBotVisibleToUsers'),
      image_model: $('#grokAiImageBotModel')?.value.trim(),
      image_aspect_ratio: $('#grokAiImageBotAspectRatio')?.value.trim(),
      image_resolution: $('#grokAiImageBotResolution')?.value.trim(),
      style: $('#grokAiImageBotStyle')?.value.trim(),
      tone: $('#grokAiImageBotTone')?.value.trim(),
      behavior_rules: $('#grokAiImageBotRules')?.value.trim(),
      speech_patterns: $('#grokAiImageBotSpeech')?.value.trim(),
    };
  }

  function grokUniversalBotFormPayload() {
    return {
      kind: 'universal',
      name: $('#grokAiUniversalBotName')?.value.trim(),
      mention: $('#grokAiUniversalBotMention')?.value.trim(),
      enabled: $('#grokAiUniversalBotEnabled')?.checked,
      visible_to_users: getBotVisibilityToggle('grokAiUniversalBotVisibleToUsers'),
      response_model: $('#grokAiUniversalBotResponseModel')?.value.trim(),
      summary_model: $('#grokAiUniversalBotSummaryModel')?.value.trim(),
      image_model: $('#grokAiUniversalBotImageModel')?.value.trim(),
      image_aspect_ratio: $('#grokAiUniversalBotAspectRatio')?.value.trim(),
      image_resolution: $('#grokAiUniversalBotResolution')?.value.trim(),
      allow_text: $('#grokAiUniversalBotAllowText')?.checked,
      allow_image_generate: $('#grokAiUniversalBotAllowImageGenerate')?.checked,
      allow_image_edit: $('#grokAiUniversalBotAllowImageEdit')?.checked,
      temperature: Number($('#grokAiUniversalBotTemperature')?.value || 0.3),
      max_tokens: Number($('#grokAiUniversalBotMaxTokens')?.value || 1000),
      style: $('#grokAiUniversalBotStyle')?.value.trim(),
      tone: $('#grokAiUniversalBotTone')?.value.trim(),
      behavior_rules: $('#grokAiUniversalBotRules')?.value.trim(),
      speech_patterns: $('#grokAiUniversalBotSpeech')?.value.trim(),
    };
  }

  function renderGrokChatBotSettings() {
    const chatSelect = $('#grokAiBotChatSelect');
    const botSelect = $('#grokAiBotChatBotSelect');
    if (!chatSelect || !botSelect) return;
    const currentChatValue = chatSelect.value || String(currentChatId || grokBotState.chats[0]?.id || '');
    const currentBotValue = botSelect.value || String(selectedGrokBotId || grokBotState.bots[0]?.id || '');
    chatSelect.innerHTML = grokBotState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
    botSelect.innerHTML = grokBotState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
    if (grokBotState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
    if (grokBotState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
    if (!botSelect.value && grokBotState.bots[0]) botSelect.value = String(grokBotState.bots[0].id);
    const setting = getGrokChatSetting(chatSelect.value, botSelect.value);
    $('#grokAiBotChatEnabled').checked = !!setting?.enabled;
    $('#grokAiBotChatMode').value = setting?.mode || 'simple';
    $('#grokAiBotChatHotLimit').value = setting?.hot_context_limit || 50;
    $('#grokAiBotChatAutoReact').checked = !!setting?.auto_react_on_mention;
  }

  function renderGrokImageChatBotSettings() {
    const chatSelect = $('#grokAiImageBotChatSelect');
    const botSelect = $('#grokAiImageBotChatBotSelect');
    if (!chatSelect || !botSelect) return;
    const currentChatValue = chatSelect.value || String(currentChatId || grokBotState.chats[0]?.id || '');
    const currentBotValue = botSelect.value || String(selectedGrokImageBotId || grokBotState.imageBots[0]?.id || '');
    chatSelect.innerHTML = grokBotState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
    botSelect.innerHTML = grokBotState.imageBots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
    if (grokBotState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
    if (grokBotState.imageBots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
    if (!botSelect.value && grokBotState.imageBots[0]) botSelect.value = String(grokBotState.imageBots[0].id);
    const setting = getGrokImageChatSetting(chatSelect.value, botSelect.value);
    $('#grokAiImageBotChatEnabled').checked = !!setting?.enabled;
  }

  function renderGrokUniversalChatBotSettings() {
    const chatSelect = $('#grokAiUniversalBotChatSelect');
    const botSelect = $('#grokAiUniversalBotChatBotSelect');
    if (!chatSelect || !botSelect) return;
    const currentChatValue = chatSelect.value || String(currentChatId || grokUniversalState.chats[0]?.id || '');
    const currentBotValue = botSelect.value || String(selectedGrokUniversalBotId || grokUniversalState.bots[0]?.id || '');
    chatSelect.innerHTML = grokUniversalState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
    botSelect.innerHTML = grokUniversalState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
    if (grokUniversalState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
    if (grokUniversalState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
    if (!botSelect.value && grokUniversalState.bots[0]) botSelect.value = String(grokUniversalState.bots[0].id);
    const setting = getGrokUniversalChatSetting(chatSelect.value, botSelect.value);
    $('#grokAiUniversalBotChatEnabled').checked = !!setting?.enabled;
    $('#grokAiUniversalBotChatMode').value = setting?.mode || 'simple';
    $('#grokAiUniversalBotChatHotLimit').value = setting?.hot_context_limit || 50;
    $('#grokAiUniversalBotChatAutoReact').checked = !!setting?.auto_react_on_mention;
  }

  function renderGrokAiSettings() {
    mountGrokBotPanels();
    const settings = grokBotState.settings || {};
    $('#grokAiGlobalEnabled').checked = !!settings.grok_enabled;
    $('#grokAiInteractiveEnabled').checked = !!settings.grok_interactive_enabled;
    $('#grokAiBaseUrl').value = settings.grok_base_url || 'https://api.x.ai/v1';
    $('#grokAiTemperature').value = settings.grok_temperature ?? 0.3;
    $('#grokAiMaxTokens').value = settings.grok_max_tokens ?? 1000;
    $('#grokAiApiKey').value = '';
    $('#grokAiKeyStatus').textContent = settings.has_grok_key
      ? `Key saved: ${settings.masked_grok_key || '***'}`
      : 'Key is not saved';
    renderGrokGlobalTextModelOptions();
    renderGrokGlobalImageModelOptions();
    const models = grokBotState.models || {};
    if (models.error) {
      setGrokAiModelStatus(`Model list fallback is used: ${formatUiErrorMessage(models.error, 'Could not load Grok models')}`, 'error');
    } else if (models.source === 'live') {
      setGrokAiModelStatus(`Loaded ${models.response?.length || 0} text models and ${models.image?.length || 0} image models.`, 'success');
    } else {
      setGrokAiModelStatus('Saved defaults are shown. Use "Refresh models" or "Test key" to load live Grok models.');
    }
  }

  function renderGrokTextBotsSettings() {
    mountGrokBotPanels();
    fillGrokBotForm(currentGrokBot() || grokBotState.bots[0] || null);
    renderGrokChatBotSettings();
  }

  function renderGrokImageBotsSettings() {
    mountGrokBotPanels();
    fillGrokImageBotForm(currentGrokImageBot() || grokBotState.imageBots[0] || null);
    renderGrokImageChatBotSettings();
  }

  function renderGrokUniversalBotsSettings() {
    mountGrokBotPanels();
    fillGrokUniversalBotForm(currentGrokUniversalBot() || grokUniversalState.bots[0] || null);
    renderGrokUniversalChatBotSettings();
  }

  function grokAiSettingsPayload() {
    const body = {
      grok_enabled: $('#grokAiGlobalEnabled')?.checked,
      grok_interactive_enabled: $('#grokAiInteractiveEnabled')?.checked,
      grok_base_url: $('#grokAiBaseUrl')?.value.trim(),
      grok_default_response_model: $('#grokAiDefaultResponseModel')?.value.trim(),
      grok_default_summary_model: $('#grokAiDefaultSummaryModel')?.value.trim(),
      grok_default_embedding_model: $('#grokAiDefaultEmbeddingModel')?.value.trim(),
      grok_default_image_model: $('#grokAiDefaultImageModel')?.value.trim(),
      grok_default_image_aspect_ratio: $('#grokAiDefaultAspectRatio')?.value.trim(),
      grok_default_image_resolution: $('#grokAiDefaultResolution')?.value.trim(),
      grok_temperature: Number($('#grokAiTemperature')?.value || 0.3),
      grok_max_tokens: Number($('#grokAiMaxTokens')?.value || 1000),
    };
    const key = $('#grokAiApiKey')?.value.trim();
    if (key) body.grok_api_key = key;
    return body;
  }

  async function persistGrokAiSettings() {
    const data = await api('/api/admin/grok-ai-bots/settings', {
      method: 'PUT',
      body: grokAiSettingsPayload(),
    });
    mergeGrokAiState(data);
    return data;
  }

  async function loadGrokAiState() {
    const data = await api('/api/admin/grok-ai-bots');
    mergeGrokAiState(data);
    return data;
  }

  function syncGrokBotUser(bot) {
    if (!bot?.user_id) return;
    applyUserUpdate({
      id: bot.user_id,
      user_id: bot.user_id,
      display_name: bot.name,
      avatar_color: bot.avatar_color,
      avatar_url: bot.avatar_url,
      is_ai_bot: 1,
    });
  }

  async function saveGrokAiSettings() {
    setGrokAiProviderStatus('Saving...', 'pending');
    try {
      await persistGrokAiSettings();
      renderGrokAiSettings();
      setGrokAiProviderStatus(`Settings saved\n${providerInteractiveSummary('grok', grokBotState.settings)}`, 'success');
    } catch (e) {
      setGrokAiProviderStatus(e.message || 'Could not save settings', 'error');
    }
  }

  async function testGrokAiConnection() {
    const keyInput = $('#grokAiApiKey');
    const hasKey = Boolean(keyInput?.value.trim() || grokBotState.settings?.has_grok_key);
    if (!hasKey) {
      setGrokAiProviderStatus('Enter Grok API key before testing.', 'error');
      keyInput?.focus();
      return;
    }
    setGrokAiProviderStatus('Checking Grok connection...', 'pending');
    try {
      const data = await api('/api/admin/grok-ai-bots/test-connection', {
        method: 'POST',
        body: grokAiSettingsPayload(),
      });
      await persistGrokAiSettings();
      if (data.state?.models) mergeGrokAiState({ state: { models: data.state.models } });
      renderGrokAiSettings();
      const text = String(data.result?.text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
      setGrokAiProviderStatus(`Key verified (${data.result?.latencyMs || 0} ms). ${text}`, 'success');
    } catch (e) {
      setGrokAiProviderStatus(formatUiErrorMessage(e, 'Could not check Grok key'), 'error');
    }
  }

  async function refreshGrokAiModels() {
    const keyInput = $('#grokAiApiKey');
    const hasKey = Boolean(keyInput?.value.trim() || grokBotState.settings?.has_grok_key);
    if (!hasKey) {
      setGrokAiProviderStatus('Enter or save Grok API key before loading models.', 'error');
      keyInput?.focus();
      return;
    }
    setGrokAiProviderStatus('Loading Grok models...', 'pending');
    try {
      const data = await api('/api/admin/grok-ai-bots/models/refresh', {
        method: 'POST',
        body: grokAiSettingsPayload(),
      });
      mergeGrokAiState(data);
      renderGrokAiSettings();
      setGrokAiProviderStatus(`Models refreshed: ${grokBotState.models?.response?.length || 0} text / ${grokBotState.models?.image?.length || 0} image.`, 'success');
    } catch (e) {
      setGrokAiProviderStatus(formatUiErrorMessage(e, 'Could not load Grok models'), 'error');
    }
  }

  async function deleteGrokAiKey() {
    if (!confirm('Delete Grok API key for AI bots?')) return;
    try {
      const data = await api('/api/admin/grok-ai-bots/key', { method: 'DELETE' });
      mergeGrokAiState(data);
      renderGrokAiSettings();
      setGrokAiProviderStatus('Key deleted', 'success');
    } catch (e) {
      setGrokAiProviderStatus(e.message || 'Could not delete key', 'error');
    }
  }

  async function saveGrokBot() {
    const payload = grokBotFormPayload();
    if (!payload.name) { setGrokTextEditorStatus('Enter bot name', 'error'); return; }
    setGrokTextEditorStatus('Saving Grok bot...', 'pending');
    try {
      const shouldUpdate = Boolean(selectedGrokBotId && grokBotState.bots.some(bot => Number(bot.id) === Number(selectedGrokBotId)));
      const url = shouldUpdate ? `/api/admin/grok-ai-bots/${selectedGrokBotId}` : '/api/admin/grok-ai-bots';
      const method = shouldUpdate ? 'PUT' : 'POST';
      const data = await api(url, { method, body: payload });
      mergeGrokAiState(data);
      selectedGrokBotId = data.bot?.id || selectedGrokBotId;
      syncGrokBotUser(data.bot);
      renderGrokTextBotsSettings();
      const status = buildVerifiedBotSaveStatus('Text bot saved.', data.bot, payload, formatCapabilityState(data.bot || payload));
      setGrokTextEditorStatus(status.message, status.type);
    } catch (e) {
      setGrokTextEditorStatus(e.message || 'Could not save Grok bot', 'error');
    }
  }

  async function saveGrokImageBot() {
    const payload = grokImageBotFormPayload();
    if (!payload.name) { setGrokImageEditorStatus('Enter image bot name', 'error'); return; }
    setGrokImageEditorStatus('Saving Grok image bot...', 'pending');
    try {
      const shouldUpdate = Boolean(selectedGrokImageBotId && grokBotState.imageBots.some(bot => Number(bot.id) === Number(selectedGrokImageBotId)));
      const url = shouldUpdate ? `/api/admin/grok-ai-bots/${selectedGrokImageBotId}` : '/api/admin/grok-ai-bots';
      const method = shouldUpdate ? 'PUT' : 'POST';
      const data = await api(url, { method, body: payload });
      mergeGrokAiState(data);
      selectedGrokImageBotId = data.bot?.id || selectedGrokImageBotId;
      syncGrokBotUser(data.bot);
      renderGrokImageBotsSettings();
      const status = buildVerifiedBotSaveStatus('Image bot saved.', data.bot, payload);
      setGrokImageEditorStatus(status.message, status.type);
    } catch (e) {
      setGrokImageEditorStatus(e.message || 'Could not save image bot', 'error');
    }
  }

  async function uploadGrokBotAvatar(file, kind = 'text') {
    if (!file) return;
    const botId = kind === 'text' ? selectedGrokBotId : selectedGrokImageBotId;
    if (!botId) {
      setGrokBotStatus(kind, 'Save the bot before adding an avatar', 'error');
      if (kind === 'text') renderGrokBotAvatar(null);
      else renderGrokImageBotAvatar(null);
      return;
    }
    const fd = new FormData();
    fd.append('avatar', file);
    setGrokBotStatus(kind, 'Uploading avatar...');
    try {
      const data = await api(`/api/admin/grok-ai-bots/${botId}/avatar`, { method: 'POST', body: fd });
      mergeGrokAiState(data);
      if (kind === 'text') selectedGrokBotId = data.bot?.id || selectedGrokBotId;
      else selectedGrokImageBotId = data.bot?.id || selectedGrokImageBotId;
      syncGrokBotUser(data.bot);
      if (kind === 'text') renderGrokTextBotsSettings();
      else renderGrokImageBotsSettings();
      refreshRenderedAiBotAvatar(data.bot);
      setGrokBotStatus(kind, 'Avatar saved', 'success');
    } catch (e) {
      setGrokBotStatus(kind, e.message || 'Could not upload avatar', 'error');
    }
  }

  async function removeGrokBotAvatar(kind = 'text') {
    const botId = kind === 'text' ? selectedGrokBotId : selectedGrokImageBotId;
    if (!botId) return;
    try {
      const data = await api(`/api/admin/grok-ai-bots/${botId}/avatar`, { method: 'DELETE' });
      mergeGrokAiState(data);
      if (kind === 'text') selectedGrokBotId = data.bot?.id || selectedGrokBotId;
      else selectedGrokImageBotId = data.bot?.id || selectedGrokImageBotId;
      syncGrokBotUser(data.bot);
      if (kind === 'text') renderGrokTextBotsSettings();
      else renderGrokImageBotsSettings();
      refreshRenderedAiBotAvatar(data.bot);
      setGrokBotStatus(kind, 'Avatar removed', 'success');
    } catch (e) {
      setGrokBotStatus(kind, e.message || 'Could not remove avatar', 'error');
    }
  }

  async function disableGrokBot(kind = 'text') {
    const botId = kind === 'text' ? selectedGrokBotId : selectedGrokImageBotId;
    if (!botId) return;
    if (!confirm(`Disable this Grok ${kind === 'text' ? 'text' : 'image'} bot in all chats?`)) return;
    try {
      const data = await api(`/api/admin/grok-ai-bots/${botId}`, { method: 'DELETE' });
      mergeGrokAiState(data);
      if (kind === 'text') renderGrokTextBotsSettings();
      else renderGrokImageBotsSettings();
      setGrokBotStatus(kind, `${kind === 'text' ? 'Text' : 'Image'} bot disabled`, 'success');
    } catch (e) {
      setGrokBotStatus(kind, e.message || 'Could not disable bot', 'error');
    }
  }

  async function testGrokBot(kind = 'text') {
    const botId = kind === 'text' ? selectedGrokBotId : selectedGrokImageBotId;
    if (!botId) { setGrokBotStatus(kind, 'Save the bot first', 'error'); return; }
    setGrokBotStatus(kind, 'Testing model...');
    try {
      const data = await api(`/api/admin/grok-ai-bots/${botId}/test`, { method: 'POST', body: {} });
      const text = data.result?.text ? data.result.text.slice(0, 500) : '';
      setGrokBotStatus(kind, `Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
    } catch (e) {
      setGrokBotStatus(kind, e.message || 'Test failed', 'error');
    }
  }

  async function exportGrokBotJson(kind = 'text') {
    const botId = kind === 'text' ? selectedGrokBotId : selectedGrokImageBotId;
    if (!botId) { setGrokBotStatus(kind, 'Choose a saved bot first', 'error'); return; }
    setGrokBotStatus(kind, 'Preparing JSON...');
    try {
      const headers = {};
      if (token) headers.Authorization = 'Bearer ' + token;
      const res = await fetch(`/api/admin/grok-ai-bots/${botId}/export`, { headers });
      if (!res.ok) {
        let data = {};
        try { data = await res.json(); } catch {}
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const bot = kind === 'text' ? currentGrokBot() : currentGrokImageBot();
      const fallbackName = `bananza-grok-bot-${bot?.mention || botId}.json`;
      const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setGrokBotStatus(kind, 'JSON exported', 'success');
    } catch (e) {
      setGrokBotStatus(kind, e.message || 'Could not export JSON', 'error');
    }
  }

  async function importGrokBotJsonFile(file, kind = 'text') {
    if (!file) return;
    setGrokBotStatus(kind, 'Importing JSON...');
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const data = await api('/api/admin/grok-ai-bots/import', { method: 'POST', body: payload });
      mergeGrokAiState(data);
      const importedKind = (data.bot?.kind || kind) === 'image' ? 'image' : 'text';
      if (importedKind === 'image') {
        selectedGrokImageBotId = data.bot?.id || selectedGrokImageBotId;
        if (kind === 'image') renderGrokImageBotsSettings();
      } else {
        selectedGrokBotId = data.bot?.id || selectedGrokBotId;
        if (kind === 'text') renderGrokTextBotsSettings();
      }
      const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
      const message = importedKind !== kind
        ? `Bot imported as ${importedKind} bot.${warnings} Open the ${importedKind} bot window to edit it.`
        : `Bot imported.${warnings}`;
      setGrokBotStatus(kind, message, warnings ? 'error' : 'success');
    } catch (e) {
      setGrokBotStatus(kind, e.message || 'Could not import JSON', 'error');
    } finally {
      const input = kind === 'text' ? $('#grokAiBotImportFile') : $('#grokAiImageBotImportFile');
      if (input) input.value = '';
    }
  }

  async function saveGrokChatBotSettings() {
    const chatId = Number($('#grokAiBotChatSelect')?.value || 0);
    const botId = Number($('#grokAiBotChatBotSelect')?.value || 0);
    const botExists = grokBotState.bots.some(bot => Number(bot.id) === Number(botId));
    if (!chatId || !botId) { setGrokTextChatStatus('Choose chat and bot', 'error'); return; }
    if (!botExists) {
      setGrokTextChatStatus('Save the bot first', 'error');
      await loadGrokAiState().then(renderGrokTextBotsSettings).catch(() => {});
      return;
    }
    try {
      const data = await api('/api/admin/grok-ai-bots/chat-settings', {
        method: 'PUT',
        body: {
          chatId,
          botId,
          enabled: $('#grokAiBotChatEnabled')?.checked,
          mode: $('#grokAiBotChatMode')?.value || 'simple',
          hot_context_limit: Number($('#grokAiBotChatHotLimit')?.value || 50),
          auto_react_on_mention: $('#grokAiBotChatAutoReact')?.checked,
        },
      });
      mergeGrokAiState(data);
      renderGrokChatBotSettings();
      setGrokTextChatStatus('Chat settings saved', 'success');
    } catch (e) {
      setGrokTextChatStatus(e.message || 'Could not save chat settings', 'error');
    }
  }

  async function saveGrokImageChatBotSettings() {
    const chatId = Number($('#grokAiImageBotChatSelect')?.value || 0);
    const botId = Number($('#grokAiImageBotChatBotSelect')?.value || 0);
    const botExists = grokBotState.imageBots.some(bot => Number(bot.id) === Number(botId));
    if (!chatId || !botId) { setGrokImageChatStatus('Choose chat and image bot', 'error'); return; }
    if (!botExists) {
      setGrokImageChatStatus('Save the image bot first', 'error');
      await loadGrokAiState().then(renderGrokImageBotsSettings).catch(() => {});
      return;
    }
    try {
      const data = await api('/api/admin/grok-ai-bots/chat-settings', {
        method: 'PUT',
        body: {
          chatId,
          botId,
          enabled: $('#grokAiImageBotChatEnabled')?.checked,
          mode: 'simple',
          hot_context_limit: 50,
        },
      });
      mergeGrokAiState(data);
      renderGrokImageChatBotSettings();
      setGrokImageChatStatus('Image bot chat settings saved', 'success');
    } catch (e) {
      setGrokImageChatStatus(e.message || 'Could not save image bot chat settings', 'error');
    }
  }

  async function loadGrokUniversalState() {
    const data = await api('/api/admin/grok-universal-bots');
    mergeGrokUniversalState(data);
    renderGrokUniversalBotsSettings();
    return data;
  }

  async function saveGrokUniversalBot() {
    const payload = grokUniversalBotFormPayload();
    if (!payload.name) { setGrokUniversalEditorStatus('Enter bot name', 'error'); return; }
    setGrokUniversalEditorStatus('Saving universal bot...', 'pending');
    try {
      const shouldUpdate = Boolean(selectedGrokUniversalBotId && grokUniversalState.bots.some(bot => Number(bot.id) === Number(selectedGrokUniversalBotId)));
      const url = shouldUpdate ? `/api/admin/grok-universal-bots/${selectedGrokUniversalBotId}` : '/api/admin/grok-universal-bots';
      const method = shouldUpdate ? 'PUT' : 'POST';
      const data = await api(url, { method, body: payload });
      mergeGrokUniversalState(data);
      selectedGrokUniversalBotId = data.bot?.id || selectedGrokUniversalBotId;
      syncGrokBotUser(data.bot);
      renderGrokUniversalBotsSettings();
      const status = buildVerifiedBotSaveStatus('Universal bot saved.', data.bot, payload, formatCapabilityState(data.bot || payload));
      setGrokUniversalEditorStatus(status.message, status.type);
    } catch (e) {
      setGrokUniversalEditorStatus(e.message || 'Could not save universal bot', 'error');
    }
  }

  async function uploadGrokUniversalBotAvatar(file) {
    if (!file) return;
    if (!selectedGrokUniversalBotId) {
      setGrokUniversalEditorStatus('Save the bot before adding an avatar', 'error');
      renderGrokUniversalBotAvatar(null);
      return;
    }
    const fd = new FormData();
    fd.append('avatar', file);
    setGrokUniversalEditorStatus('Uploading avatar...', 'pending');
    try {
      const data = await api(`/api/admin/grok-universal-bots/${selectedGrokUniversalBotId}/avatar`, { method: 'POST', body: fd });
      mergeGrokUniversalState(data);
      selectedGrokUniversalBotId = data.bot?.id || selectedGrokUniversalBotId;
      syncGrokBotUser(data.bot);
      renderGrokUniversalBotsSettings();
      refreshRenderedAiBotAvatar(data.bot);
      setGrokUniversalEditorStatus('Avatar saved', 'success');
    } catch (e) {
      setGrokUniversalEditorStatus(e.message || 'Could not upload avatar', 'error');
    }
  }

  async function removeGrokUniversalBotAvatar() {
    if (!selectedGrokUniversalBotId) return;
    try {
      const data = await api(`/api/admin/grok-universal-bots/${selectedGrokUniversalBotId}/avatar`, { method: 'DELETE' });
      mergeGrokUniversalState(data);
      selectedGrokUniversalBotId = data.bot?.id || selectedGrokUniversalBotId;
      syncGrokBotUser(data.bot);
      renderGrokUniversalBotsSettings();
      refreshRenderedAiBotAvatar(data.bot);
      setGrokUniversalEditorStatus('Avatar removed', 'success');
    } catch (e) {
      setGrokUniversalEditorStatus(e.message || 'Could not remove avatar', 'error');
    }
  }

  async function disableGrokUniversalBot() {
    if (!selectedGrokUniversalBotId) return;
    if (!confirm('Disable this Grok universal bot in all chats?')) return;
    try {
      const data = await api(`/api/admin/grok-universal-bots/${selectedGrokUniversalBotId}`, { method: 'DELETE' });
      mergeGrokUniversalState(data);
      renderGrokUniversalBotsSettings();
      setGrokUniversalEditorStatus('Universal bot disabled', 'success');
    } catch (e) {
      setGrokUniversalEditorStatus(e.message || 'Could not disable universal bot', 'error');
    }
  }

  async function testGrokUniversalBot() {
    if (!selectedGrokUniversalBotId) { setGrokUniversalEditorStatus('Save the bot first', 'error'); return; }
    setGrokUniversalEditorStatus('Testing universal bot...', 'pending');
    try {
      const data = await api(`/api/admin/grok-universal-bots/${selectedGrokUniversalBotId}/test`, {
        method: 'POST',
        body: {
          mode: $('#grokAiUniversalBotTestMode')?.value || 'auto',
        },
      });
      const text = data.result?.text ? data.result.text.slice(0, 500) : '';
      setGrokUniversalEditorStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
    } catch (e) {
      setGrokUniversalEditorStatus(e.message || 'Universal bot test failed', 'error');
    }
  }

  async function exportGrokUniversalBotJson() {
    if (!selectedGrokUniversalBotId) { setGrokUniversalEditorStatus('Choose a saved bot first', 'error'); return; }
    setGrokUniversalEditorStatus('Preparing JSON...', 'pending');
    try {
      const headers = {};
      if (token) headers.Authorization = 'Bearer ' + token;
      const res = await fetch(`/api/admin/grok-universal-bots/${selectedGrokUniversalBotId}/export`, { headers });
      if (!res.ok) {
        let data = {};
        try { data = await res.json(); } catch {}
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const bot = currentGrokUniversalBot();
      const fallbackName = `bananza-grok-universal-${bot?.mention || selectedGrokUniversalBotId}.json`;
      const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setGrokUniversalEditorStatus('JSON exported', 'success');
    } catch (e) {
      setGrokUniversalEditorStatus(e.message || 'Could not export JSON', 'error');
    }
  }

  async function importGrokUniversalBotJsonFile(file) {
    if (!file) return;
    setGrokUniversalEditorStatus('Importing JSON...', 'pending');
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const data = await api('/api/admin/grok-universal-bots/import', { method: 'POST', body: payload });
      mergeGrokUniversalState(data);
      selectedGrokUniversalBotId = data.bot?.id || selectedGrokUniversalBotId;
      renderGrokUniversalBotsSettings();
      const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
      setGrokUniversalEditorStatus(`Universal bot imported.${warnings}`, warnings ? 'error' : 'success');
    } catch (e) {
      setGrokUniversalEditorStatus(e.message || 'Could not import JSON', 'error');
    } finally {
      const input = $('#grokAiUniversalBotImportFile');
      if (input) input.value = '';
    }
  }

  async function saveGrokUniversalChatBotSettings() {
    const chatId = Number($('#grokAiUniversalBotChatSelect')?.value || 0);
    const botId = Number($('#grokAiUniversalBotChatBotSelect')?.value || 0);
    const botExists = grokUniversalState.bots.some(bot => Number(bot.id) === Number(botId));
    if (!chatId || !botId) { setGrokUniversalChatStatus('Choose chat and bot', 'error'); return; }
    if (!botExists) {
      setGrokUniversalChatStatus('Save the bot first', 'error');
      await loadGrokUniversalState().catch(() => {});
      return;
    }
    try {
      const data = await api('/api/admin/grok-universal-bots/chat-settings', {
        method: 'PUT',
        body: {
          chatId,
          botId,
          enabled: $('#grokAiUniversalBotChatEnabled')?.checked,
          mode: $('#grokAiUniversalBotChatMode')?.value || 'simple',
          hot_context_limit: Number($('#grokAiUniversalBotChatHotLimit')?.value || 50),
          auto_react_on_mention: $('#grokAiUniversalBotChatAutoReact')?.checked,
        },
      });
      mergeGrokUniversalState(data);
      renderGrokUniversalChatBotSettings();
      setGrokUniversalChatStatus('Chat settings saved', 'success');
    } catch (e) {
      setGrokUniversalChatStatus(e.message || 'Could not save chat settings', 'error');
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
    if (isUiTransitionBusy()) {
      recoverySyncRequested = true;
      deferredRecoveryReason = reason || deferredRecoveryReason;
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
    if (isUiTransitionBusy()) {
      recoverySyncRequested = true;
      deferredRecoveryReason = reason || deferredRecoveryReason;
      return;
    }
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
    syncMobileBaseSceneState({
      scene: getResolvedMobileBaseScene(),
      hideInactive: !mobileRouteTransitionActive,
      syncChatMetrics: getResolvedMobileBaseScene() === 'chat',
      repaint: true,
    });
    scheduleMobileViewportRecovery();
    refreshWebSocketAfterResume();
    scheduleRecoverySync(reason, { immediate: true });
  }

  function setupLifecycleRecovery() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        flushCurrentChatScrollAnchor(currentChatId, { force: true, allowPendingMedia: true });
        lastHiddenAt = Date.now();
        return;
      }
      handleAppResume('visible');
    });
    window.addEventListener('focus', () => handleAppResume('focus'));
    window.addEventListener('pageshow', () => handleAppResume('pageshow'));
    window.addEventListener('online', () => handleAppResume('online'));
    window.addEventListener('pagehide', () => {
      flushCurrentChatScrollAnchor(currentChatId, { force: true, allowPendingMedia: true });
      lastHiddenAt = Date.now();
    });
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
      return `<div class="chat-item-avatar" style="background:${u.avatar_color}">${initials(u.display_name || chat.name)}`;
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
      chat?.private_user?.ai_bot_mention || '',
      chat?.private_user?.ai_bot_model || '',
    ].join(' ').toLowerCase();
  }

  async function loadHiddenChatSearch(query) {
    const normalized = String(query || '').trim().toLowerCase();
    const requestId = ++hiddenChatSearchSeq;
    if (normalized.length < 2) {
      hiddenChatSearchQuery = '';
      hiddenChatSearchResults = [];
      renderChatList(chatSearch.value);
      return;
    }
    try {
      const data = await api(`/api/chats/hidden?q=${encodeURIComponent(normalized)}`);
      if (requestId !== hiddenChatSearchSeq) return;
      hiddenChatSearchQuery = normalized;
      hiddenChatSearchResults = normalizeCachedChats(data.chats || data || []);
      renderChatList(chatSearch.value);
    } catch (e) {
      if (requestId !== hiddenChatSearchSeq) return;
      hiddenChatSearchQuery = normalized;
      hiddenChatSearchResults = [];
    }
  }

  function scheduleHiddenChatSearch(query) {
    const normalized = String(query || '').trim().toLowerCase();
    clearTimeout(hiddenChatSearchTimer);
    if (normalized.length < 2) {
      hiddenChatSearchSeq += 1;
      hiddenChatSearchQuery = '';
      hiddenChatSearchResults = [];
      return;
    }
    if (hiddenChatSearchQuery === normalized) return;
    hiddenChatSearchTimer = setTimeout(() => {
      hiddenChatSearchTimer = null;
      loadHiddenChatSearch(normalized);
    }, 180);
  }

  async function openHiddenChatFromSearch(chatId) {
    const id = Number(chatId || 0);
    if (!id) return;
    try {
      await api(`/api/chats/${id}/unhide`, { method: 'POST' });
      await loadChats({ silent: true });
      await openChat(id);
      setChatSearchOpen(false, { clear: true, focus: false });
    } catch (e) {
      showCenterToast(e.message || 'Не удалось открыть скрытый чат');
    }
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
      {
        action: 'hide-chat',
        icon: '&#128065;',
        label: 'Скрыть',
        hidden: !canHideChat(chat),
        disabled: false,
      },
      {
        action: 'leave-chat',
        icon: '&#8617;',
        label: 'Выйти из чата',
        hidden: !canLeaveChat(chat),
        disabled: false,
        danger: true,
      },
      {
        action: 'delete-chat',
        icon: '&#128465;',
        label: 'Удалить чат',
        hidden: !canManageDestructiveChat(chat),
        disabled: false,
        danger: true,
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
              class="chat-context-menu-button${item.danger ? ' is-danger' : ''}"
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

  async function clearCachedChat(chatId, { includeOutbox = true } = {}) {
    try {
      await window.messageCache?.clearChat?.(chatId, { includeOutbox });
    } catch (e) {}
  }

  function resetChatPreviewAfterHistoryClear(chatId) {
    const chat = getChatById(chatId);
    if (!chat) return;
    chat.last_text = null;
    chat.last_time = null;
    chat.last_user = null;
    chat.last_file_id = null;
    chat.last_message_id = 0;
    chat.first_unread_id = null;
    chat.unread_count = 0;
  }

  function revealChatListAfterActiveChatClose() {
    if (window.innerWidth > 768 || !sidebar) return;
    resetBackButtonNavigationState();
    revealSidebarFromChat();
  }

  function closeChatViewForChat(chatId) {
    const id = Number(chatId || 0);
    if (!id || Number(currentChatId || 0) !== id) return;
    markCurrentChatReadIfAtBottom(false);
    flushCurrentChatScrollAnchor(id, { force: true, allowPendingMedia: true });
    pauseCurrentChatMediaPlayback();
    dismissMobileComposer({ forceRecovery: true, reason: 'close-chat-view', recoveryDelayMs: 280 });
    hideFloatingMessageActions({ immediate: true });
    hideMentionPicker();
    closeEmojiPicker({ immediate: true });
    clearActivePulseVoterPopover({ skipRefresh: true });
    hideAvatarUserMenu();
    clearReply();
    if (editTo) clearEdit({ clearInput: true });
    currentChatId = null;
    updateComposerAiOverrideState().catch(() => {});
    displayedMsgIds.clear();
    chatPinsByChat.delete(id);
    chatMemberLastReads.delete(id);
    replaceRenderedMessages([]);
    setHasMoreBefore(false);
    setHasMoreAfter(false);
    chatView.classList.add('hidden');
    emptyState.classList.remove('hidden');
    renderCurrentChatHeader(null);
    applyChatBackground(null);
    if (String(localStorage.getItem('lastChat') || '') === String(id)) {
      localStorage.removeItem('lastChat');
    }
    revealChatListAfterActiveChatClose();
  }

  async function removeChatLocally(chatId, { clearCache = false } = {}) {
    const id = Number(chatId || 0);
    if (!id) return;
    chats = chats.filter((chat) => Number(chat.id || 0) !== id);
    chatPinsByChat.delete(id);
    chatMemberLastReads.delete(id);
    closeChatViewForChat(id);
    renderChatList(chatSearch.value);
    if (clearCache) await clearCachedChat(id, { includeOutbox: true });
  }

  async function clearLocalChatHistory(chatId, { clearCache = true } = {}) {
    const id = Number(chatId || 0);
    if (!id) return;
    resetChatPreviewAfterHistoryClear(id);
    chatPinsByChat.set(id, []);
    chatMemberLastReads.delete(id);
    if (Number(currentChatId || 0) === id) {
      hideFloatingMessageActions({ immediate: true });
      clearReply();
      if (editTo) clearEdit({ clearInput: true });
      replaceRenderedMessages([]);
      setHasMoreBefore(false);
      setHasMoreAfter(false);
      renderPinnedBar(id);
      updateScrollBottomButton();
    }
    renderChatList(chatSearch.value);
    if (clearCache) await clearCachedChat(id, { includeOutbox: true });
  }

  async function hideChatFromList(chatId) {
    const chat = getChatById(chatId);
    if (!canHideChat(chat)) return;
    try {
      await api(`/api/chats/${chatId}/hide`, { method: 'POST' });
      await removeChatLocally(chatId, { clearCache: false });
      showCenterToast('Чат скрыт');
    } catch (e) {
      showCenterToast(e.message || 'Не удалось скрыть чат');
    }
  }

  async function leaveChat(chatId) {
    const chat = getChatById(chatId);
    if (!canLeaveChat(chat)) return;
    if (!confirm('Выйти из этого чата?')) return;
    try {
      await api(`/api/chats/${chatId}/members/me`, { method: 'DELETE' });
      await removeChatLocally(chatId, { clearCache: true });
      closeAllModals({ immediate: true });
      showCenterToast('Вы вышли из чата');
    } catch (e) {
      showCenterToast(e.message || 'Не удалось выйти из чата');
    }
  }

  async function deleteChatCompletely(chatId) {
    const chat = getChatById(chatId);
    if (!canManageDestructiveChat(chat)) return;
    if (!confirm('Удалить чат, все сообщения и медиа без восстановления?')) return;
    try {
      await api(`/api/chats/${chatId}`, { method: 'DELETE' });
      await removeChatLocally(chatId, { clearCache: true });
      closeAllModals({ immediate: true });
      showCenterToast('Чат удалён');
    } catch (e) {
      showCenterToast(e.message || 'Не удалось удалить чат');
    }
  }

  async function clearChatHistoryForEveryone(chatId) {
    const chat = getChatById(chatId);
    if (!canManageDestructiveChat(chat)) return;
    if (!confirm('Очистить историю чата для всех участников?')) return;
    try {
      await api(`/api/chats/${chatId}/history`, { method: 'DELETE' });
      await clearLocalChatHistory(chatId, { clearCache: true });
      await loadChats({ silent: true });
      showCenterToast('История очищена');
    } catch (e) {
      showCenterToast(e.message || 'Не удалось очистить историю');
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
      return;
    }
    if (action === 'hide-chat') {
      await hideChatFromList(chatId);
      return;
    }
    if (action === 'leave-chat') {
      await leaveChat(chatId);
      return;
    }
    if (action === 'delete-chat') {
      await deleteChatCompletely(chatId);
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

  function blurFocusedElementWithin(root) {
    if (!(root instanceof HTMLElement)) return false;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !root.contains(active)) return false;
    try {
      active.blur();
      return true;
    } catch {
      return false;
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
      blurFocusedElementWithin(entry.el);
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
    scheduleMobileViewportRecovery();
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

    const transitionTarget = entry.el.querySelector('.modal-content') || entry.el;
    const onTransitionEnd = (event) => {
      if (event.target !== transitionTarget || !['opacity', 'transform'].includes(event.propertyName)) return;
      transitionTarget.removeEventListener('transitionend', onTransitionEnd);
      finalizeModalClose(entry);
    };
    transitionTarget.addEventListener('transitionend', onTransitionEnd);
    clearTimeout(entry.closeTimer);
    const closeFallbackMs = getModalTransitionFallbackMs(entry);
    entry.closeTimer = setTimeout(() => {
      transitionTarget.removeEventListener('transitionend', onTransitionEnd);
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

  function handleGrokImageRiskModalClosed() {
    if (grokImageRiskTerms) {
      grokImageRiskTerms.innerHTML = '';
      grokImageRiskTerms.classList.add('hidden');
    }
    if (!grokImageRiskConfirmResolver) return;
    const resolve = grokImageRiskConfirmResolver;
    grokImageRiskConfirmResolver = null;
    resolve(false);
  }

  function ensureDeepseekTextBotsModalContent() {
    const modalBlock = $('#deepseekAiTextBotsBlock');
    if (!modalBlock) return;
    const botPanel = $('#deepseekAiBotList')?.closest('.ai-bot-panel');
    const chatPanel = $('#deepseekAiBotChatSelect')?.closest('.ai-bot-panel');
    [botPanel, chatPanel].forEach((panel) => {
      if (panel && panel.parentElement !== modalBlock) {
        modalBlock.appendChild(panel);
      }
    });
  }

  function registerBuiltinModals() {
    ensureDeepseekTextBotsModalContent();
    [
      newChatModal,
      adminModal,
      chatInfoModal,
      menuDrawer,
      settingsModal,
      themeSettingsModal,
      visualModeSettingsModal,
      pollStyleSettingsModal,
      animationSettingsModal,
      mobileFontSettingsModal,
      weatherSettingsModal,
      notificationSettingsModal,
      soundSettingsModal,
      aiBotSettingsModal,
      openAiTextBotsModal,
      openAiUniversalBotsModal,
      yandexAiSettingsModal,
      deepseekAiSettingsModal,
      deepseekAiTextBotsModal,
      grokAiSettingsModal,
      grokAiTextBotsModal,
      grokAiImageBotsModal,
      grokAiUniversalBotsModal,
      changePasswordModal,
      grokImageRiskConfirmModal,
    ].forEach((modal) => registerModal(modal));
    registerModal(grokImageRiskConfirmModal, { onAfterClose: handleGrokImageRiskModalClosed });
    registerModal(forwardMessageModal, { onAfterClose: resetForwardMessageModal });
    registerModal(pollComposerModal, { onAfterClose: resetPollComposer });
    registerModal(pollVotersModal, { onAfterClose: resetPollVotersModal });
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
    closeMobileComposerTransientUi({ immediate: true });
    dismissMobileComposer({ forceRecovery: true, reason: `modal:${entry.id}` });
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

    entry.returnFocusEl = opener instanceof HTMLElement ? opener : getMobileComposerSafeReturnFocusEl();
    entry.isClosing = false;
    clearTimeout(entry.closeTimer);
    if (entry.openFrame) cancelAnimationFrame(entry.openFrame);
    entry.el.classList.remove('hidden', 'is-closing', 'is-underlay');
    entry.el.classList.remove('is-open');
    forceIosAnimationMount(entry.el, entry.el.querySelector('.modal-content'));
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
    scheduleMobileViewportRecovery();
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

  function focusForwardChatSearchAfterOpen(entry) {
    if (!forwardChatSearch) return;
    const focus = () => {
      if (!entry?.el || entry.el.classList.contains('hidden') || entry.isClosing) return;
      try {
        forwardChatSearch.focus({ preventScroll: true });
      } catch {
        forwardChatSearch.focus();
      }
    };
    if (window.innerWidth > 768 || prefersReducedMotion() || currentModalAnimation === 'none') {
      requestAnimationFrame(focus);
      return;
    }
    const contentEl = entry?.el?.querySelector('.modal-content');
    if (!(contentEl instanceof HTMLElement)) {
      setTimeout(focus, MODAL_TRANSITION_BUFFER_MS);
      return;
    }
    let done = false;
    let timer = null;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      contentEl.removeEventListener('transitionend', onTransitionEnd);
      requestAnimationFrame(focus);
    };
    const onTransitionEnd = (event) => {
      if (event.target !== contentEl || !['opacity', 'transform'].includes(event.propertyName)) return;
      finish();
    };
    contentEl.addEventListener('transitionend', onTransitionEnd);
    timer = setTimeout(finish, getModalTransitionFallbackMs(entry));
  }

  function openForwardMessageModal(message) {
    if (!message?.id) return;
    hideFloatingMessageActions();
    const entry = openModal('forwardMessageModal', { replaceStack: true });
    forwardMessageState = { id: message.id };
    renderForwardChatList();
    focusForwardChatSearchAfterOpen(entry);
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
      bot_id: Number(raw.bot_id) || 0,
      bot_provider: String(raw.bot_provider || '').trim(),
      bot_kind: String(raw.bot_kind || '').trim(),
      allow_text: Boolean(raw.allow_text),
      allow_image_generate: Boolean(raw.allow_image_generate),
      allow_image_edit: Boolean(raw.allow_image_edit),
      allow_document: Boolean(raw.allow_document),
      allow_poll_create: Boolean(raw.allow_poll_create),
      allow_poll_vote: Boolean(raw.allow_poll_vote),
      allow_react: Boolean(raw.allow_react),
      allow_pin: Boolean(raw.allow_pin),
      document_default_format: String(raw.document_default_format || '').trim().toLowerCase() === 'txt' ? 'txt' : 'md',
    };
  }

  function escapeRegExpText(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function extractMentionTokensFromText(text) {
    const source = String(text || '');
    const tokens = [];
    const re = /@([a-zA-Z0-9_][a-zA-Z0-9_-]{0,31})/g;
    let match;
    while ((match = re.exec(source))) {
      const prev = match.index > 0 ? source[match.index - 1] : '';
      if (prev && /[A-Za-z0-9_.-]/.test(prev)) continue;
      tokens.push(String(match[1] || '').toLowerCase());
    }
    return [...new Set(tokens)];
  }

  function isGrokImageBotTarget(target) {
    if (!target) return false;
    return String(target.bot_provider || target.ai_bot_provider || '').toLowerCase() === 'grok'
      && String(target.bot_kind || target.ai_bot_kind || '').toLowerCase() === 'image';
  }

  function isUniversalBotTarget(target) {
    if (!target) return false;
    const provider = String(target.bot_provider || target.ai_bot_provider || '').toLowerCase();
    const kind = String(target.bot_kind || target.ai_bot_kind || '').toLowerCase();
    return (provider === 'openai' || provider === 'grok') && kind === 'universal';
  }

  function buildReplyBotTarget(replySnapshot, loadedTarget = null) {
    const source = loadedTarget || replySnapshot || {};
    const token = String(source.token || source.mention || source.ai_bot_mention || '').replace(/^@+/, '').trim();
    return {
      ...source,
      token,
      mention: token,
      display_name: source.display_name || '',
      bot_id: Number(source.bot_id || source.ai_bot_id) || 0,
      bot_provider: source.bot_provider || source.ai_bot_provider || '',
      bot_kind: source.bot_kind || source.ai_bot_kind || '',
      allow_text: source.allow_text ?? true,
      allow_image_generate: source.allow_image_generate ?? true,
      allow_image_edit: source.allow_image_edit ?? true,
      allow_document: source.allow_document ?? false,
      allow_poll_create: source.allow_poll_create ?? false,
      allow_poll_vote: source.allow_poll_vote ?? false,
      allow_react: source.allow_react ?? false,
      allow_pin: source.allow_pin ?? false,
      document_default_format: String(source.document_default_format || 'md').toLowerCase() === 'txt' ? 'txt' : 'md',
    };
  }

  function getUniversalBotModes(target) {
    if (!isUniversalBotTarget(target)) return [];
    const provider = String(target.bot_provider || target.ai_bot_provider || '').toLowerCase();
    const allowText = target.allow_text !== false;
    const allowImage = target.allow_image_generate !== false || target.allow_image_edit !== false;
    const allowDocument = provider === 'openai' && target.allow_document !== false;
    const modes = ['auto'];
    if (allowText) modes.push('text');
    if (allowImage) modes.push('image');
    if (allowDocument) modes.push('document');
    return [...new Set(modes)];
  }

  async function resolveComposerUniversalBotTarget(text = '', replySnapshot = null) {
    const chatId = Number(currentChatId || 0);
    if (!chatId) return null;
    const tokens = extractMentionTokensFromText(text);
    const targets = await loadMentionTargets(chatId);
    const byToken = new Map();
    const byId = new Map();
    targets.forEach((target) => {
      const token = String(target.token || target.mention || '').toLowerCase();
      if (token && !byToken.has(token)) byToken.set(token, target);
      const botId = Number(target.bot_id || 0);
      if (botId && !byId.has(botId)) byId.set(botId, target);
    });
    for (const token of tokens) {
      const target = byToken.get(token);
      if (isUniversalBotTarget(target)) return target;
    }
    if (replySnapshot && isUniversalBotTarget(replySnapshot)) {
      const loadedTarget = byId.get(Number(replySnapshot.ai_bot_id || replySnapshot.bot_id || 0)) || null;
      return buildReplyBotTarget(replySnapshot, loadedTarget);
    }
    return null;
  }

  function renderComposerAiOverride() {
    if (!composerAiOverrideEl || !composerAiOverrideModeEl) return;
    const target = composerAiOverrideState.target;
    if (!isUniversalBotTarget(target)) {
      composerAiOverrideEl.classList.add('hidden');
      composerAiOverrideState.mode = 'auto';
      composerAiOverrideState.documentFormat = 'md';
      return;
    }
    const modes = getUniversalBotModes(target);
    composerAiOverrideEl.classList.remove('hidden');
    if (composerAiOverrideLabel) {
      const name = target.display_name || target.token || target.mention || 'AI bot';
      composerAiOverrideLabel.textContent = `${name} response`;
    }
    if (composerAiOverrideHint) {
      const provider = String(target.bot_provider || '').toLowerCase();
      composerAiOverrideHint.textContent = provider === 'openai' ? 'Text, image, document' : 'Text or image';
    }
    composerAiOverrideModeEl.innerHTML = modes.map((mode) => {
      const label = mode === 'auto'
        ? 'Auto'
        : mode === 'text'
          ? 'Text'
          : mode === 'image'
            ? 'Image'
            : 'Document';
      return `<option value="${mode}">${label}</option>`;
    }).join('');
    if (!modes.includes(composerAiOverrideState.mode)) composerAiOverrideState.mode = 'auto';
    composerAiOverrideModeEl.value = composerAiOverrideState.mode;
    const showDocument = composerAiOverrideState.mode === 'document' && modes.includes('document');
    composerAiOverrideDocumentWrap?.classList.toggle('hidden', !showDocument);
    if (composerAiOverrideDocumentFormatEl) {
      const nextFormat = String(composerAiOverrideState.documentFormat || target.document_default_format || 'md').toLowerCase() === 'txt' ? 'txt' : 'md';
      composerAiOverrideState.documentFormat = nextFormat;
      composerAiOverrideDocumentFormatEl.value = nextFormat;
    }
  }

  async function updateComposerAiOverrideState() {
    if (!composerAiOverrideEl) return;
    const seq = ++composerAiOverrideSeq;
    const text = msgInput?.value || '';
    const replySnapshot = getReplySnapshot();
    try {
      const target = await resolveComposerUniversalBotTarget(text, replySnapshot);
      if (seq !== composerAiOverrideSeq) return;
      const previousTargetId = Number(composerAiOverrideState.target?.bot_id || 0);
      const nextTargetId = Number(target?.bot_id || 0);
      if (previousTargetId !== nextTargetId) {
        composerAiOverrideState.mode = 'auto';
        composerAiOverrideState.documentFormat = target?.document_default_format || 'md';
      }
      composerAiOverrideState.target = target;
    } catch (e) {
      if (seq !== composerAiOverrideSeq) return;
      composerAiOverrideState.target = null;
      composerAiOverrideState.mode = 'auto';
      composerAiOverrideState.documentFormat = 'md';
    }
    renderComposerAiOverride();
  }

  function getComposerAiOverridePayload() {
    const target = composerAiOverrideState.target;
    if (!isUniversalBotTarget(target)) return {};
    const modes = getUniversalBotModes(target);
    const mode = modes.includes(composerAiOverrideState.mode) ? composerAiOverrideState.mode : 'auto';
    const payload = {
      ai_response_mode_hint: mode,
      ai_override_target: target,
    };
    if (mode === 'document') {
      payload.ai_document_format_hint = String(composerAiOverrideState.documentFormat || target.document_default_format || 'md').toLowerCase() === 'txt' ? 'txt' : 'md';
    }
    return payload;
  }

  function stripTriggeredBotMention(text, target) {
    const original = String(text || '').trim();
    if (!original || !target) return original;
    const patterns = [
      target.token ? new RegExp(`@${escapeRegExpText(target.token)}\\b`, 'ig') : null,
      target.mention ? new RegExp(`@${escapeRegExpText(target.mention)}\\b`, 'ig') : null,
      target.display_name ? new RegExp(`@${escapeRegExpText(target.display_name)}\\b`, 'ig') : null,
    ].filter(Boolean);
    let next = original;
    patterns.forEach((pattern) => {
      next = next.replace(pattern, ' ');
    });
    next = next.replace(/\s+/g, ' ').replace(/^[\s,.:;!?-]+/, '').trim();
    return next || original;
  }

  async function resolveTriggeredGrokImageBot(text, replySnapshot = null) {
    const tokens = extractMentionTokensFromText(text);
    const findTarget = (targets) => {
      const byToken = new Map();
      targets.forEach((target) => {
        const token = String(target.token || target.mention || '').toLowerCase();
        if (token && !byToken.has(token)) byToken.set(token, target);
      });
      for (const token of tokens) {
        const target = byToken.get(token);
        if (isGrokImageBotTarget(target)) return target;
      }
      return null;
    };
    const targets = await loadMentionTargets(currentChatId);
    const directTarget = findTarget(targets);
    if (directTarget) return directTarget;
    if (tokens.length) {
      const staleAiTarget = targets.some((target) => {
        const token = String(target.token || target.mention || '').toLowerCase();
        return token && tokens.includes(token)
          && Boolean(target.is_ai_bot)
          && (!String(target.bot_provider || '').trim() || !String(target.bot_kind || '').trim());
      });
      if (staleAiTarget) {
        const refreshedTargets = await loadMentionTargets(currentChatId, { force: true });
        const refreshedTarget = findTarget(refreshedTargets);
        if (refreshedTarget) return refreshedTarget;
      }
    }
    if (isGrokImageBotTarget(replySnapshot)) {
      return {
        token: String(replySnapshot.ai_bot_mention || replySnapshot.mention || '').replace(/^@+/, '').trim(),
        mention: String(replySnapshot.ai_bot_mention || replySnapshot.mention || '').replace(/^@+/, '').trim(),
        display_name: replySnapshot.display_name || '',
        bot_id: Number(replySnapshot.ai_bot_id) || 0,
        bot_provider: replySnapshot.ai_bot_provider || '',
        bot_kind: replySnapshot.ai_bot_kind || '',
      };
    }
    return null;
  }

  async function analyzeOutgoingGrokImageRisk(text, replySnapshot = null) {
    if (!aiImageRiskApi?.analyzeAiImageRisk) return { risky: false, matches: [], prompt: '', target: null };
    const target = await resolveTriggeredGrokImageBot(text, replySnapshot);
    if (!target) return { risky: false, matches: [], prompt: '', target: null };
    const prompt = stripTriggeredBotMention(text, target);
    if (!prompt) return { risky: false, matches: [], prompt: '', target };
    const result = aiImageRiskApi.analyzeAiImageRisk(prompt);
    return { ...result, prompt, target };
  }

  function renderGrokImageRiskTerms(matches = []) {
    if (!grokImageRiskTerms) return;
    const terms = matches
      .map((item) => String(item?.term || '').trim())
      .filter(Boolean)
      .slice(0, 6);
    if (!terms.length) {
      grokImageRiskTerms.innerHTML = '';
      grokImageRiskTerms.classList.add('hidden');
      return;
    }
    grokImageRiskTerms.innerHTML = terms.map((term) => `<span class="grok-risk-term">${esc(term)}</span>`).join('');
    grokImageRiskTerms.classList.remove('hidden');
  }

  function openGrokImageRiskConfirm(matches = []) {
    if (!grokImageRiskConfirmModal) return Promise.resolve(true);
    if (grokImageRiskConfirmResolver) {
      const resolvePending = grokImageRiskConfirmResolver;
      grokImageRiskConfirmResolver = null;
      resolvePending(false);
    }
    renderGrokImageRiskTerms(matches);
    openModal('grokImageRiskConfirmModal', { replaceStack: false, opener: sendBtn });
    return new Promise((resolve) => {
      grokImageRiskConfirmResolver = resolve;
    });
  }

  async function loadMentionTargets(chatId = currentChatId, { force = false } = {}) {
    const id = Number(chatId);
    if (!id) return [];
    if (!force && mentionTargetsByChat.has(id)) return mentionTargetsByChat.get(id);
    if (force) mentionTargetsByChat.delete(id);
    const data = await api(`/api/chats/${id}/mention-targets`);
    const targets = (data.targets || []).map(normalizeMentionTarget).filter(Boolean);
    mentionTargetsByChat.set(id, targets);
    if (id === Number(currentChatId || 0)) updateComposerAiOverrideState().catch(() => {});
    return targets;
  }

  function suppressMentionPickerFollowupClick(ms = 550) {
    mentionPickerClickSuppressUntil = Math.max(mentionPickerClickSuppressUntil, Date.now() + ms);
  }

  function suppressContextConvertPickerFollowupClick(ms = 550) {
    contextConvertPickerClickSuppressUntil = Math.max(contextConvertPickerClickSuppressUntil, Date.now() + ms);
  }

  function ensureMentionPickerBackdrop() {
    let backdrop = $('#mentionPickerBackdrop');
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = 'mentionPickerBackdrop';
    backdrop.className = 'mention-picker-backdrop hidden';
    document.body.appendChild(backdrop);
    const blockAndClose = (e) => {
      e.preventDefault();
      e.stopPropagation();
      suppressMentionPickerFollowupClick();
      hideMentionPicker();
    };
    backdrop.addEventListener('pointerdown', blockAndClose, { passive: false });
    backdrop.addEventListener('click', blockAndClose, { passive: false });
    backdrop.addEventListener('contextmenu', blockAndClose, { passive: false });
    return backdrop;
  }

  function ensureMentionPicker() {
    let picker = $('#mentionPicker');
    ensureMentionPickerBackdrop();
    if (picker) return picker;
    picker = document.createElement('div');
    picker.id = 'mentionPicker';
    picker.className = 'mention-picker hidden';
    document.body.appendChild(picker);
    picker.addEventListener('pointerdown', (e) => {
      if (typeof e.button === 'number' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const item = e.target.closest('.mention-picker-item');
      if (!item) return;
      mentionPickerPointerState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startIndex: Number(item.dataset.index),
        moved: false,
      };
    }, { passive: false });
    picker.addEventListener('pointermove', (e) => {
      e.stopPropagation();
      if (!mentionPickerPointerState || e.pointerId !== mentionPickerPointerState.pointerId || mentionPickerPointerState.moved) return;
      const dx = e.clientX - mentionPickerPointerState.startX;
      const dy = e.clientY - mentionPickerPointerState.startY;
      if ((dx * dx) + (dy * dy) > (MENTION_PICKER_TAP_DEAD_ZONE * MENTION_PICKER_TAP_DEAD_ZONE)) {
        mentionPickerPointerState.moved = true;
      }
    }, { passive: false });
    picker.addEventListener('scroll', () => {
      if (mentionPickerPointerState) mentionPickerPointerState.moved = true;
    }, { passive: true, capture: true });
    picker.addEventListener('pointercancel', () => {
      mentionPickerPointerState = null;
    }, { passive: true });
    picker.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      suppressMentionPickerFollowupClick();
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
    picker.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
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
    const visible = Boolean(currentChatId);
    mentionOpenBtn.classList.toggle('hidden', !visible);
    mentionOpenBtn.classList.toggle('is-open', mentionPickerState.active);
    mentionOpenBtn.disabled = !visible;
    mentionOpenBtn.setAttribute('aria-hidden', visible ? 'false' : 'true');
    mentionOpenBtn.setAttribute('aria-expanded', mentionPickerState.active ? 'true' : 'false');
    syncContextConvertComposerButton();
  }

  function hideMentionPicker(options = {}) {
    const immediate = Boolean(options.immediate);
    mentionPickerState = { active: false, start: 0, end: 0, selected: 0, targets: [], source: null, keyboardAttached: false };
    mentionPickerPointerState = null;
    closeFloatingSurface($('#mentionPickerBackdrop'), { immediate });
    closeFloatingSurface($('#mentionPicker'), { immediate });
    syncMentionOpenButton();
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
    const previousScrollTop = picker.querySelector('.mention-picker-list')?.scrollTop || 0;
    const {
      source = mentionPickerState.source || 'trigger',
      preserveSelection = true,
      keyboardAttached = mentionPickerState.keyboardAttached,
    } = options;
    if (!targets.length) {
      hideMentionPicker();
      return;
    }
    mentionPickerState.targets = targets;
    mentionPickerState.source = source;
    mentionPickerState.keyboardAttached = Boolean(keyboardAttached);
    mentionPickerState.selected = preserveSelection
      ? Math.min(mentionPickerState.selected, targets.length - 1)
      : 0;
    picker.innerHTML = `
      <div class="mention-picker-list">
        ${targets.map((target, index) => `
          <button type="button" class="mention-picker-item${index === mentionPickerState.selected ? ' active' : ''}" data-index="${index}">
            <span class="mention-picker-avatar" style="background:${esc(target.avatar_color || '#65aadd')}">${target.avatar_url ? `<img src="${esc(target.avatar_url)}" alt="">` : esc((target.display_name || target.token || '?').trim()[0] || '?')}</span>
            <span class="mention-picker-copy">
              <strong>${esc(target.display_name || target.token)}</strong>
              <small>@${esc(target.token)}${target.is_ai_bot ? ' &middot; AI' : ''}</small>
            </span>
          </button>
        `).join('')}
      </div>
    `;
    mentionPickerState.active = true;
    openFloatingSurface(picker);
    syncMentionOpenButton();
    positionMentionPicker();
    const list = picker.querySelector('.mention-picker-list');
    if (list) {
      list.scrollTop = previousScrollTop;
      list.querySelector('.mention-picker-item.active')?.scrollIntoView({ block: 'nearest' });
    }
    requestAnimationFrame(() => positionMentionPicker());
  }

  async function openMentionPickerFromButton(options = {}) {
    const keyboardAttached = Boolean(
      window.innerWidth > 768
      || (Object.prototype.hasOwnProperty.call(options, 'keyboardAttached')
        ? options.keyboardAttached
        : isMobileComposerKeyboardOpen())
    );
    const chatId = Number(currentChatId || 0);
    if (mentionPickerState.active && mentionPickerState.source === 'button') {
      hideMentionPicker();
      restoreComposerFocusAfterMentionPicker(keyboardAttached);
      return;
    }
    if (!chatId || !msgInput) {
      syncMentionOpenButton();
      return;
    }
    if (!isComposerMeaningfullyEmpty()) {
      insertRawMentionTriggerAtCursor();
      return;
    }
    try {
      const targets = await loadMentionTargets(chatId);
      if (chatId !== Number(currentChatId || 0) || !isComposerMeaningfullyEmpty()) return;
      const range = getManualMentionRange();
      mentionPickerState.start = range.start;
      mentionPickerState.end = range.end;
      renderMentionPicker(targets, { source: 'button', preserveSelection: false, keyboardAttached });
      restoreComposerFocusAfterMentionPicker(keyboardAttached);
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
          renderMentionPicker(targets, { source: 'button', keyboardAttached: mentionPickerState.keyboardAttached });
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
      });
      const visibleTargets = query ? filtered.slice(0, 8) : filtered;
      renderMentionPicker(visibleTargets, { source: 'trigger', keyboardAttached: window.innerWidth > 768 || isMobileComposerKeyboardOpen() });
    } catch {
      hideMentionPicker();
    }
  }

  function insertMentionTarget(target) {
    if (!target || !msgInput) return;
    const keyboardAttached = Boolean(mentionPickerState.keyboardAttached);
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
    restoreComposerFocusAfterMentionPicker(keyboardAttached);
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

  function insertRawMentionTriggerAtCursor() {
    if (!msgInput) return;
    const value = msgInput.value || '';
    const start = Math.max(0, msgInput.selectionStart ?? value.length);
    const end = Math.max(start, msgInput.selectionEnd ?? start);
    msgInput.value = value.slice(0, start) + '@' + value.slice(end);
    const nextCursor = start + 1;
    msgInput.setSelectionRange(nextCursor, nextCursor);
    autoResize();
    syncMentionOpenButton();
    window.BananzaVoiceHooks?.refreshComposerState?.();
    try {
      msgInput.focus({ preventScroll: true });
    } catch {
      msgInput.focus();
    }
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

  function contextConvertProviderLabel(provider = 'openai') {
    if (provider === 'yandex') return 'Yandex';
    if (provider === 'deepseek') return 'DeepSeek';
    if (provider === 'grok') return 'Grok';
    return 'OpenAI';
  }

  function providerAccent(provider = 'openai') {
    if (provider === 'yandex') return '#fc9b28';
    if (provider === 'deepseek') return '#2a9d8f';
    if (provider === 'grok') return '#5f8cff';
    return '#10a37f';
  }

  function contextConvertRouteBase(provider = 'openai') {
    if (provider === 'yandex') return '/api/admin/yandex-convert-bots';
    if (provider === 'deepseek') return '/api/admin/deepseek-convert-bots';
    if (provider === 'grok') return '/api/admin/grok-convert-bots';
    return '/api/admin/openai-convert-bots';
  }

  function currentContextConvertAdminState() {
    return contextConvertAdminStates[activeContextConvertProvider] || contextConvertAdminStates.openai;
  }

  function currentContextConvertAdminBot() {
    const state = currentContextConvertAdminState();
    const selectedId = Number(selectedContextConvertBotIds[activeContextConvertProvider] || 0);
    return state.bots.find((bot) => Number(bot.id) === selectedId) || null;
  }

  function getContextConvertChatSetting(chatId, botId) {
    const state = currentContextConvertAdminState();
    return state.chatSettings.find((item) => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
  }

  function setContextConvertInlineStatus(targetIds, message, type = '') {
    setInlineStatus(targetIds, message, type);
  }

  function setContextConvertModalStatus(message, type = '') {
    setContextConvertInlineStatus('contextConvertStatus', message, type);
  }

  function setContextConvertBotStatus(message, type = '') {
    setContextConvertInlineStatus(['contextConvertBotEditorStatus', 'contextConvertBotEditorStatusBottom'], message, type);
  }

  function setContextConvertChatStatus(message, type = '') {
    setContextConvertInlineStatus('contextConvertBotChatStatus', message, type);
  }

  function mergeContextConvertAdminState(provider = 'openai', data = {}) {
    const state = data.state || data;
    if (!contextConvertAdminStates[provider]) return;
    contextConvertAdminStates[provider] = {
      settings: state.settings || contextConvertAdminStates[provider].settings,
      bots: state.bots || contextConvertAdminStates[provider].bots,
      chats: state.chats || contextConvertAdminStates[provider].chats,
      chatSettings: state.chatSettings || contextConvertAdminStates[provider].chatSettings,
      models: state.models || contextConvertAdminStates[provider].models,
    };
    if (provider === 'openai' && state.settings) syncSharedOpenAiSettings(state.settings);
    if (provider === 'yandex' && state.settings) yandexBotState.settings = { ...yandexBotState.settings, ...state.settings };
    if (provider === 'deepseek' && state.settings) deepseekBotState.settings = { ...deepseekBotState.settings, ...state.settings };
    if (provider === 'grok' && state.settings) grokBotState.settings = { ...grokBotState.settings, ...state.settings };
    const bots = contextConvertAdminStates[provider].bots || [];
    if (selectedContextConvertBotIds[provider] && !bots.some((bot) => Number(bot.id) === Number(selectedContextConvertBotIds[provider]))) {
      selectedContextConvertBotIds[provider] = null;
    }
    if (!selectedContextConvertBotIds[provider] && bots[0]) {
      selectedContextConvertBotIds[provider] = Number(bots[0].id);
    }
    contextConvertAvailabilityByChat.clear();
  }

  function renderContextConvertBotList() {
    const list = $('#contextConvertBotList');
    if (!list) return;
    const state = currentContextConvertAdminState();
    const selectedId = Number(selectedContextConvertBotIds[activeContextConvertProvider] || 0);
    if (!state.bots.length) {
      list.innerHTML = '<div class="ai-bot-empty">No convert bots yet. Create the first one.</div>';
      return;
    }
    list.innerHTML = state.bots.map((bot) => `
      <button type="button" class="ai-bot-list-item${Number(bot.id) === selectedId ? ' active' : ''}" data-context-convert-bot-id="${bot.id}">
        <span class="ai-bot-list-main">
          <span class="ai-bot-list-copy">
            <strong>${esc(bot.name || 'Convert bot')}</strong>
            <small>${bot.enabled ? 'enabled' : 'disabled'}${bot.response_model ? ` · ${esc(bot.response_model)}` : ''}</small>
          </span>
        </span>
      </button>
    `).join('');
  }

  function renderContextConvertForm() {
    const state = currentContextConvertAdminState();
    const bot = currentContextConvertAdminBot() || null;
    const responseModels = state.models?.response || [];
    setAiModelSelectOptions(
      'contextConvertBotResponseModel',
      responseModels,
      bot?.response_model || responseModels[0] || ''
    );
    $('#contextConvertBotName').value = bot?.name || `${contextConvertProviderLabel(activeContextConvertProvider)} Convert`;
    $('#contextConvertBotTemperature').value = bot?.temperature ?? 0.3;
    $('#contextConvertBotMaxTokens').value = bot?.max_tokens ?? 1000;
    $('#contextConvertBotEnabled').checked = bot?.enabled !== false;
    $('#contextConvertBotPrompt').value = bot?.transform_prompt || '';
  }

  function renderContextConvertChatSettings() {
    const state = currentContextConvertAdminState();
    const chatSelect = $('#contextConvertBotChatSelect');
    const botSelect = $('#contextConvertBotChatBotSelect');
    if (!chatSelect || !botSelect) return;
    const currentChatValue = chatSelect.value || String(currentChatId || state.chats[0]?.id || '');
    const currentBotValue = botSelect.value || String(selectedContextConvertBotIds[activeContextConvertProvider] || state.bots[0]?.id || '');
    chatSelect.innerHTML = state.chats.map((chat) => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
    botSelect.innerHTML = state.bots.map((bot) => `<option value="${bot.id}">${esc(bot.name)}</option>`).join('');
    if (state.chats.some((chat) => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
    if (state.bots.some((bot) => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
    if (!botSelect.value && state.bots[0]) botSelect.value = String(state.bots[0].id);
    const setting = getContextConvertChatSetting(chatSelect.value, botSelect.value);
    $('#contextConvertBotChatEnabled').checked = !!setting?.enabled;
  }

  function renderContextConvertAdminSettings() {
    $('#contextConvertModalTitle').textContent = `${contextConvertProviderLabel(activeContextConvertProvider)} Context Convert Bots`;
    renderContextConvertBotList();
    renderContextConvertForm();
    renderContextConvertChatSettings();
  }

  function contextConvertAdminFormPayload() {
    return {
      name: $('#contextConvertBotName')?.value.trim(),
      enabled: $('#contextConvertBotEnabled')?.checked,
      response_model: $('#contextConvertBotResponseModel')?.value.trim(),
      temperature: Number($('#contextConvertBotTemperature')?.value || 0.3),
      max_tokens: Number($('#contextConvertBotMaxTokens')?.value || 1000),
      transform_prompt: $('#contextConvertBotPrompt')?.value.trim(),
    };
  }

  async function loadContextConvertAdminState(provider = activeContextConvertProvider) {
    const data = await api(contextConvertRouteBase(provider));
    mergeContextConvertAdminState(provider, data);
    if (provider === activeContextConvertProvider) renderContextConvertAdminSettings();
    return data;
  }

  function openContextConvertBotsModal(provider = 'openai') {
    if (!currentUser?.is_admin) return;
    activeContextConvertProvider = provider;
    openModal('contextConvertBotsModal', { replaceStack: false, opener: $(`#${provider === 'openai' ? 'openAiOpenConvertBots' : (provider === 'grok' ? 'grokAiOpenConvertBots' : `${provider}AiOpenConvertBots`)}`) });
    resetManagedModalScroll('contextConvertBotsModal');
    setContextConvertModalStatus('Loading...');
    const state = contextConvertAdminStates[provider];
    if (state?.bots?.length || state?.chats?.length) {
      renderContextConvertAdminSettings();
      setContextConvertModalStatus('Refreshing...');
    }
    loadContextConvertAdminState(provider).then(() => {
      renderContextConvertAdminSettings();
      resetManagedModalScroll('contextConvertBotsModal');
      setContextConvertModalStatus('');
    }).catch((error) => {
      setContextConvertModalStatus(error.message || 'Could not load convert bots', 'error');
    });
  }

  async function saveContextConvertAdminBot() {
    const payload = contextConvertAdminFormPayload();
    if (!payload.name) {
      setContextConvertBotStatus('Enter bot name', 'error');
      return;
    }
    if (!payload.transform_prompt) {
      setContextConvertBotStatus('Enter transform prompt', 'error');
      return;
    }
    const selectedId = Number(selectedContextConvertBotIds[activeContextConvertProvider] || 0);
    const state = currentContextConvertAdminState();
    const shouldUpdate = Boolean(selectedId && state.bots.some((bot) => Number(bot.id) === selectedId));
    const url = shouldUpdate
      ? `${contextConvertRouteBase(activeContextConvertProvider)}/${selectedId}`
      : contextConvertRouteBase(activeContextConvertProvider);
    const method = shouldUpdate ? 'PUT' : 'POST';
    setContextConvertBotStatus('Saving...');
    try {
      const data = await api(url, { method, body: payload });
      mergeContextConvertAdminState(activeContextConvertProvider, data);
      selectedContextConvertBotIds[activeContextConvertProvider] = Number(data.bot?.id || selectedId || 0) || null;
      renderContextConvertAdminSettings();
      setContextConvertBotStatus('Convert bot saved', 'success');
    } catch (error) {
      setContextConvertBotStatus(error.message || 'Could not save convert bot', 'error');
    }
  }

  async function disableContextConvertAdminBot() {
    const bot = currentContextConvertAdminBot();
    if (!bot) return;
    if (!confirm('Disable this convert bot in all chats?')) return;
    try {
      const data = await api(`${contextConvertRouteBase(activeContextConvertProvider)}/${bot.id}`, { method: 'DELETE' });
      mergeContextConvertAdminState(activeContextConvertProvider, data);
      renderContextConvertAdminSettings();
      setContextConvertBotStatus('Convert bot disabled', 'success');
    } catch (error) {
      setContextConvertBotStatus(error.message || 'Could not disable convert bot', 'error');
    }
  }

  async function testContextConvertAdminBot() {
    const bot = currentContextConvertAdminBot();
    if (!bot) {
      setContextConvertBotStatus('Save a convert bot first', 'error');
      return;
    }
    const sample = window.prompt('Source text for test transform:', 'Can you rewrite this text to sound clearer and more concise?');
    if (sample == null) return;
    setContextConvertBotStatus('Testing...');
    try {
      const data = await api(`${contextConvertRouteBase(activeContextConvertProvider)}/${bot.id}/test`, {
        method: 'POST',
        body: { text: sample },
      });
      const text = String(data.result?.text || '').trim().slice(0, 500);
      setContextConvertBotStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
    } catch (error) {
      setContextConvertBotStatus(error.message || 'Convert bot test failed', 'error');
    }
  }

  async function exportContextConvertAdminBot() {
    const bot = currentContextConvertAdminBot();
    if (!bot) {
      setContextConvertBotStatus('Select a saved convert bot first', 'error');
      return;
    }
    setContextConvertBotStatus('Preparing JSON...');
    try {
      const res = await fetch(`${contextConvertRouteBase(activeContextConvertProvider)}/${bot.id}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenameFromContentDisposition(
        res.headers.get('content-disposition'),
        `bananza-${activeContextConvertProvider}-convert-${bot.id}.json`
      );
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setContextConvertBotStatus('JSON exported', 'success');
    } catch (error) {
      setContextConvertBotStatus(error.message || 'Could not export JSON', 'error');
    }
  }

  async function importContextConvertAdminBot(file) {
    if (!file) return;
    setContextConvertBotStatus('Importing JSON...');
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const data = await api(`${contextConvertRouteBase(activeContextConvertProvider)}/import`, {
        method: 'POST',
        body: payload,
      });
      mergeContextConvertAdminState(activeContextConvertProvider, data);
      selectedContextConvertBotIds[activeContextConvertProvider] = Number(data.bot?.id || 0) || selectedContextConvertBotIds[activeContextConvertProvider];
      renderContextConvertAdminSettings();
      const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
      setContextConvertBotStatus(`JSON imported.${warnings}`.trim(), warnings ? 'warning' : 'success');
    } catch (error) {
      setContextConvertBotStatus(error.message || 'Could not import JSON', 'error');
    }
  }

  async function saveContextConvertAdminChatSetting() {
    const chatId = Number($('#contextConvertBotChatSelect')?.value || 0);
    const botId = Number($('#contextConvertBotChatBotSelect')?.value || 0);
    if (!chatId || !botId) {
      setContextConvertChatStatus('Select chat and bot', 'error');
      return;
    }
    setContextConvertChatStatus('Saving...');
    try {
      const data = await api(`${contextConvertRouteBase(activeContextConvertProvider)}/chat-settings`, {
        method: 'PUT',
        body: {
          chatId,
          botId,
          enabled: $('#contextConvertBotChatEnabled')?.checked,
        },
      });
      mergeContextConvertAdminState(activeContextConvertProvider, data);
      renderContextConvertChatSettings();
      setContextConvertChatStatus('Chat setting saved', 'success');
    } catch (error) {
      setContextConvertChatStatus(error.message || 'Could not save chat setting', 'error');
    }
  }

  function normalizeContextConvertAvailability(data = {}) {
    return {
      enabled: !!data.enabled,
      bots: Array.isArray(data.bots) ? data.bots.map((bot) => ({
        id: Number(bot.id || 0),
        name: bot.name || '',
        provider: bot.provider || 'openai',
        transform_prompt_preview: bot.transform_prompt_preview || '',
      })).filter((bot) => bot.id > 0) : [],
    };
  }

  async function loadContextConvertAvailability(chatId = currentChatId, { force = false } = {}) {
    const id = Number(chatId || 0);
    if (!id) return { enabled: false, bots: [] };
    if (!force && contextConvertAvailabilityByChat.has(id)) return contextConvertAvailabilityByChat.get(id);
    if (!force && contextConvertAvailabilityRequests.has(id)) return contextConvertAvailabilityRequests.get(id);
    const request = api(`/api/chats/${id}/context-convert-bots`)
      .then((data) => {
        const normalized = normalizeContextConvertAvailability(data);
        contextConvertAvailabilityByChat.set(id, normalized);
        contextConvertAvailabilityRequests.delete(id);
        if (id === Number(currentChatId || 0)) syncCurrentChatContextConvertUi();
        return normalized;
      })
      .catch((error) => {
        contextConvertAvailabilityRequests.delete(id);
        throw error;
      });
    contextConvertAvailabilityRequests.set(id, request);
    return request;
  }

  function invalidateContextConvertAvailability(chatId) {
    const id = Number(chatId || 0);
    if (!id) return;
    contextConvertAvailabilityByChat.delete(id);
    contextConvertAvailabilityRequests.delete(id);
    if (id === Number(currentChatId || 0)) {
      syncCurrentChatContextConvertUi();
    }
  }

  function ensureContextConvertPickerBackdrop() {
    let backdrop = $('#contextConvertPickerBackdrop');
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = 'contextConvertPickerBackdrop';
    backdrop.className = 'mention-picker-backdrop hidden';
    document.body.appendChild(backdrop);
    const dismiss = (e) => {
      e.preventDefault();
      e.stopPropagation();
      suppressContextConvertPickerFollowupClick();
      hideContextConvertPicker();
    };
    backdrop.addEventListener('pointerdown', dismiss, { passive: false });
    backdrop.addEventListener('click', dismiss, { passive: false });
    backdrop.addEventListener('contextmenu', dismiss, { passive: false });
    return backdrop;
  }

  function ensureContextConvertPicker() {
    let picker = $('#contextConvertPicker');
    ensureContextConvertPickerBackdrop();
    if (picker) return picker;
    picker = document.createElement('div');
    picker.id = 'contextConvertPicker';
    picker.className = 'mention-picker context-convert-picker hidden';
    document.body.appendChild(picker);
    picker.addEventListener('pointerdown', (e) => {
      if (typeof e.button === 'number' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const item = e.target.closest('.mention-picker-item');
      if (!item) return;
      contextConvertPickerPointerState = {
        pointerId: e.pointerId,
        startIndex: Number(item.dataset.index),
        moved: false,
      };
    }, { passive: false });
    picker.addEventListener('scroll', () => {
      if (contextConvertPickerPointerState) contextConvertPickerPointerState.moved = true;
    }, { passive: true, capture: true });
    picker.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      suppressContextConvertPickerFollowupClick();
      const pointerState = contextConvertPickerPointerState;
      contextConvertPickerPointerState = null;
      if (!pointerState || pointerState.pointerId !== e.pointerId || pointerState.moved) return;
      const item = e.target.closest('.mention-picker-item');
      if (!item) return;
      const index = Number(item.dataset.index);
      if (!Number.isInteger(index) || index !== pointerState.startIndex) return;
      const bot = contextConvertPickerState.bots[index];
      if (!bot) return;
      if (contextConvertPickerState.mode === 'message') transformMessageWithContextConvertBot(contextConvertPickerState.messageId, bot);
      else transformComposerTextWithContextConvertBot(bot);
    }, { passive: false });
    picker.addEventListener('pointercancel', () => {
      contextConvertPickerPointerState = null;
    }, { passive: true });
    picker.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    return picker;
  }

  function positionContextConvertPicker() {
    const picker = $('#contextConvertPicker');
    if (!picker || picker.classList.contains('hidden')) return;
    const anchor = contextConvertPickerState.anchorEl || composerContextConvertBtn || msgInput;
    const rect = anchor?.getBoundingClientRect?.();
    if (!rect) return;
    const vv = window.visualViewport;
    const viewportLeft = vv ? vv.offsetLeft : 0;
    const viewportTop = vv ? vv.offsetTop : 0;
    const viewportWidth = vv ? vv.width : window.innerWidth;
    const viewportHeight = vv ? vv.height : window.innerHeight;
    const isContextConvertPicker = picker.classList.contains('context-convert-picker');
    const maxContextConvertWidth = Math.max(96, Math.min(viewportWidth - 16, Math.floor(viewportWidth * (2 / 3))));
    const widestContextConvertLabel = isContextConvertPicker
      ? Array.from(picker.querySelectorAll('.context-convert-picker-label'))
          .reduce((maxWidth, label) => Math.max(maxWidth, Math.ceil(label.scrollWidth || label.getBoundingClientRect().width || 0)), 0)
      : 0;
    const width = isContextConvertPicker
      ? clamp(widestContextConvertLabel + 40, 96, maxContextConvertWidth)
      : Math.min(Math.max(Math.max(rect.width, 260), 260), viewportWidth - 16);
    picker.style.width = `${width}px`;
    const height = picker.offsetHeight || 220;
    const left = Math.max(viewportLeft + 8, Math.min(rect.left + viewportLeft, viewportLeft + viewportWidth - width - 8));
    let top = rect.top + viewportTop - height - 8;
    if (top < viewportTop + 8) top = rect.bottom + viewportTop + 8;
    top = Math.max(viewportTop + 8, Math.min(top, viewportTop + viewportHeight - height - 8));
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
  }

  function renderContextConvertPicker(bots, options = {}) {
    const picker = ensureContextConvertPicker();
    if (!bots.length) {
      hideContextConvertPicker();
      return;
    }
    contextConvertPickerState = {
      ...contextConvertPickerState,
      active: true,
      selected: Math.min(contextConvertPickerState.selected || 0, bots.length - 1),
      bots,
      mode: options.mode || contextConvertPickerState.mode || 'composer',
      chatId: Number(options.chatId || contextConvertPickerState.chatId || currentChatId || 0),
      messageId: Number(options.messageId || 0),
      anchorEl: options.anchorEl || contextConvertPickerState.anchorEl || composerContextConvertBtn,
      keyboardAttached: Boolean(options.keyboardAttached),
    };
    picker.innerHTML = `
      <div class="mention-picker-list">
        ${bots.map((bot, index) => `
          <button type="button" class="mention-picker-item${index === contextConvertPickerState.selected ? ' active' : ''}" data-index="${index}">
            <span class="mention-picker-avatar" style="background:${esc(providerAccent(bot.provider))}">🍌</span>
            <span class="mention-picker-copy">
              <strong>${esc(bot.name)}</strong>
              <small>${esc(contextConvertProviderLabel(bot.provider))}${bot.transform_prompt_preview ? ` · ${esc(bot.transform_prompt_preview)}` : ''}</small>
            </span>
          </button>
        `).join('')}
      </div>
    `;
    picker.querySelectorAll('.mention-picker-item').forEach((item, index) => {
      const bot = bots[index];
      item.classList.add('context-convert-picker-item');
      item.innerHTML = `<span class="context-convert-picker-label">${esc(bot?.name || 'Convert bot')}</span>`;
    });
    openFloatingSurface(picker);
    positionContextConvertPicker();
    requestAnimationFrame(() => positionContextConvertPicker());
  }

  function hideContextConvertPicker(options = {}) {
    const immediate = Boolean(options.immediate);
    contextConvertPickerState = {
      active: false,
      selected: 0,
      bots: [],
      mode: 'composer',
      chatId: 0,
      messageId: 0,
      anchorEl: null,
      keyboardAttached: false,
    };
    contextConvertPickerPointerState = null;
    closeFloatingSurface($('#contextConvertPickerBackdrop'), { immediate });
    closeFloatingSurface($('#contextConvertPicker'), { immediate });
  }

  function getCurrentChatContextConvertState() {
    return contextConvertAvailabilityByChat.get(Number(currentChatId || 0)) || { enabled: false, bots: [] };
  }

  function isContextTransformAvailableForChat(chatId = currentChatId) {
    const id = Number(chatId || 0);
    if (!id) return false;
    const chat = getChatById(id);
    const availability = contextConvertAvailabilityByChat.get(id) || { enabled: false, bots: [] };
    return Boolean(chat?.context_transform_enabled && availability.enabled && availability.bots.length);
  }

  function setComposerContextConvertButtonVisible(visible) {
    if (!composerContextConvertBtn) return;
    if (visible) {
      if (composerContextConvertBtn.classList.contains('hidden') || composerContextConvertBtn.classList.contains('is-closing')) {
        openFloatingSurface(composerContextConvertBtn);
      }
      return;
    }
    if (!composerContextConvertBtn.classList.contains('hidden')) {
      closeFloatingSurface(composerContextConvertBtn);
    }
  }

  function canContextConvertMessage(msg, row = null, options = {}) {
    if (!options.ignoreChatAvailability && !isContextTransformAvailableForChat()) return false;
    if (!canEditMessage(msg)) return false;
    if (msg?.ai_generated || msg?.ai_bot_id || msg?.is_ai_bot) return false;
    const text = row ? getEditableText(row) : ((msg?.is_voice_note ? msg?.transcription_text : msg?.text) || '');
    return Boolean(String(text || '').trim());
  }

  function bindContextConvertMessageButton(button, row) {
    if (!button || !row || button.dataset.contextConvertBound === '1') return button;
    button.dataset.contextConvertBound = '1';
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      openMessageContextConvertPicker(row, button, {
        keepComposerFocus: reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen(),
      }).catch((error) => {
        console.warn('[context-convert] picker open failed:', error.message);
      });
    });
    return button;
  }

  function createContextConvertMessageButton(row) {
    const msg = row?.__messageData || {};
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `msg-context-convert-btn${contextConvertPendingMessageIds.has(Number(msg.id || 0)) ? ' is-pending' : ''}`;
    button.title = 'Transform with AI';
    button.textContent = '🍌';
    return bindContextConvertMessageButton(button, row);
  }

  function syncVisibleContextConvertMessageButtons() {
    if (!messagesEl || !Number(currentChatId || 0)) return;
    const transformAvailable = isContextTransformAvailableForChat(currentChatId);
    messagesEl.querySelectorAll('.msg-row[data-msg-id]').forEach((row) => {
      const msg = row.__messageData || null;
      const actionsEl = row.querySelector('.msg-actions');
      if (!msg || !actionsEl) return;
      const existingButton = actionsEl.querySelector('.msg-context-convert-btn');
      const shouldShow = transformAvailable && canContextConvertMessage(msg, row, { ignoreChatAvailability: true });
      if (!shouldShow) {
        existingButton?.remove();
        return;
      }
      if (existingButton) {
        existingButton.classList.toggle('is-pending', contextConvertPendingMessageIds.has(Number(msg.id || 0)));
        bindContextConvertMessageButton(existingButton, row);
        return;
      }
      const button = createContextConvertMessageButton(row);
      const insertBefore = actionsEl.querySelector('.msg-save-note-btn, .msg-forward-btn, .msg-react-btn');
      if (insertBefore) actionsEl.insertBefore(button, insertBefore);
      else actionsEl.appendChild(button);
    });
  }

  function syncCurrentChatContextConvertUi() {
    syncContextConvertComposerButton();
    const chatId = Number(currentChatId || 0);
    if (!chatId) return;
    if (contextConvertPickerState.active && contextConvertPickerState.chatId === chatId && !isContextTransformAvailableForChat(chatId)) {
      hideContextConvertPicker();
    }
    syncVisibleContextConvertMessageButtons();
    if (activeMessageActionsRow || isFloatingSurfaceVisible(reactionPicker)) {
      positionMessageActionSurfaces({
        includeActions: Boolean(activeMessageActionsRow),
        includePicker: isFloatingSurfaceVisible(reactionPicker),
      });
    }
  }

  function syncContextConvertComposerButton() {
    if (!composerContextConvertBtn) return;
    const hasText = Boolean(currentChatId && !editTo && String(msgInput?.value || '').trim());
    const currentChat = getChatById(currentChatId);
    const availability = getCurrentChatContextConvertState();
    const shouldShow = Boolean((hasText || contextConvertComposerPending) && isContextTransformAvailableForChat(currentChatId));
    if (!shouldShow && contextConvertPickerState.active && contextConvertPickerState.mode === 'composer') {
      hideContextConvertPicker();
    }
    setComposerContextConvertButtonVisible(shouldShow);
    const shouldOffsetForScrollFab = Boolean(
      scrollBottomBtn?.classList.contains('visible')
      && (shouldShow || !composerContextConvertBtn.classList.contains('hidden'))
    );
    composerContextConvertBtn.classList.toggle('with-scroll-bottom', shouldOffsetForScrollFab);
    composerContextConvertBtn.classList.toggle('is-pending', contextConvertComposerPending);
    composerContextConvertBtn.disabled = contextConvertComposerPending;
    if (currentChat?.context_transform_enabled && !availability.bots.length && currentChatId) {
      loadContextConvertAvailability(currentChatId).catch(() => {});
    }
  }

  async function openComposerContextConvertPicker(options = {}) {
    if (contextConvertComposerPending || !currentChatId || editTo) return;
    const text = String(msgInput?.value || '').trim();
    if (!text) return;
    const keyboardAttached = Boolean(
      Object.prototype.hasOwnProperty.call(options, 'keyboardAttached')
        ? options.keyboardAttached
        : (window.innerWidth > 768 || isMobileComposerKeyboardOpen())
    );
    hideMentionPicker();
    const availability = await loadContextConvertAvailability(currentChatId).catch(() => ({ enabled: false, bots: [] }));
    if (!availability.enabled || !availability.bots.length) {
      syncContextConvertComposerButton();
      return;
    }
    if (contextConvertPickerState.active && contextConvertPickerState.mode === 'composer') {
      hideContextConvertPicker();
      if (keyboardAttached) focusComposerKeepKeyboard(true);
      return;
    }
    renderContextConvertPicker(availability.bots, {
      mode: 'composer',
      chatId: currentChatId,
      anchorEl: composerContextConvertBtn,
      keyboardAttached,
    });
    if (keyboardAttached) focusComposerKeepKeyboard(true);
  }

  async function transformComposerTextWithContextConvertBot(bot) {
    const text = String(msgInput?.value || '').trim();
    if (!bot?.id || !text || !currentChatId) return;
    const keepKeyboardOpen = Boolean(contextConvertPickerState.keyboardAttached);
    hideContextConvertPicker();
    contextConvertComposerPending = true;
    syncContextConvertComposerButton();
    try {
      const data = await api(`/api/chats/${currentChatId}/context-convert`, {
        method: 'POST',
        body: {
          botId: bot.id,
          text,
        },
      });
      msgInput.value = data.text || '';
      autoResize();
      if (keepKeyboardOpen) focusComposerKeepKeyboard(true);
      msgInput.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (error) {
      alert(error.message || 'Could not transform text');
    } finally {
      contextConvertComposerPending = false;
      syncContextConvertComposerButton();
    }
  }

  function syncContextConvertPendingMessageState(messageId) {
    const id = Number(messageId || 0);
    if (!id) return;
    const pending = contextConvertPendingMessageIds.has(id);
    const row = messagesEl.querySelector(`[data-msg-id="${id}"]`);
    row?.classList.toggle('context-convert-pending', pending);
    row?.querySelectorAll('.msg-context-convert-btn').forEach((btn) => btn.classList.toggle('is-pending', pending));
    if (Number(reactionPickerMsgId || 0) === id && isFloatingSurfaceVisible(reactionPicker)) {
      renderReactionPickerContent();
    }
  }

  async function transformMessageWithContextConvertBot(messageId, bot) {
    const id = Number(messageId || 0);
    if (!id || !bot?.id || contextConvertPendingMessageIds.has(id)) return;
    hideContextConvertPicker();
    contextConvertPendingMessageIds.add(id);
    syncContextConvertPendingMessageState(id);
    try {
      const preserveAnchor = captureScrollAnchor();
      const data = await api(`/api/messages/${id}/context-convert`, {
        method: 'POST',
        body: { botId: bot.id },
      });
      applyMessageUpdate(data.message, { preserveAnchor });
      if (preserveAnchor?.messageId) {
        requestAnimationFrame(() => restoreScrollAnchor(preserveAnchor, 2));
      }
      loadChats().catch(() => {});
    } catch (error) {
      showCenterToast(error.message || 'Could not transform message');
    } finally {
      contextConvertPendingMessageIds.delete(id);
      syncContextConvertPendingMessageState(id);
    }
  }

  async function openMessageContextConvertPicker(row, anchorEl = null, { keepComposerFocus = false } = {}) {
    const msg = row?.__messageData || null;
    if (!canContextConvertMessage(msg, row) || !currentChatId) return;
    const stableAnchor = anchorEl && row?.contains?.(anchorEl) ? anchorEl : row;
    hideMentionPicker();
    hideFloatingMessageActions({ keepComposerState: keepComposerFocus, immediate: true });
    const availability = await loadContextConvertAvailability(currentChatId).catch(() => ({ enabled: false, bots: [] }));
    if (!availability.enabled || !availability.bots.length) return;
    renderContextConvertPicker(availability.bots, {
      mode: 'message',
      chatId: currentChatId,
      messageId: Number(msg.id || 0),
      anchorEl: stableAnchor,
      keyboardAttached: keepComposerFocus,
    });
    if (keepComposerFocus) focusComposerKeepKeyboard(true);
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
      applyVisualMode(currentUser.ui_visual_mode, false);
      applyModalAnimation(currentUser.ui_modal_animation, false);
      applyModalAnimationSpeed(currentUser.ui_modal_animation_speed, false);
      applyMobileFontSize(currentUser.ui_mobile_font_size, false);
    } catch { logout(); return false; }
    return true;
  }

  function logout() {
    clearTimeout(chatListCacheSyncTimer);
    clearTimeout(messageBackgroundSyncTimer);
    clearTimeout(wsReconnectTimer);
    clearTimeout(mobileFontSizeSaveTimer);
    clearMobileFontSizeStatusTimer();
    if (chatListAbortController) chatListAbortController.abort();
    try { if (window.clearAssetCache) window.clearAssetCache().catch(()=>{}); } catch (e) {}
    try { if (window.messageCache && window.messageCache.clearUserCache) window.messageCache.clearUserCache().catch(()=>{}); } catch (e) {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    token = null;
    currentMobileFontSize = MOBILE_FONT_SIZE_DEFAULT;
    setMobileFontAdjustPercent(100);
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
        const isVisibleCurrentChat = isCurrentChatActivelyVisible(msg.message.chat_id);
        applyOwnReadStateToMessage(msg.message, msg.message.chat_id);
        if (!isOwnIncomingMessage && !document.hidden) {
          if (isMentionForMe && isMentionSoundEnabled()) {
            playAppSound('mention');
          } else if (isChatIncomingSoundEnabled(msg.message.chat_id)) {
            playAppSound(isVisibleCurrentChat ? 'incoming' : 'notification');
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
            window.cacheAssets([getAttachmentPreviewUrl(msg.message)]).catch(()=>{});
          }
        } catch (e) {}
        // Track unread for non-current chats
        if (!isVisibleCurrentChat && msg.message.user_id !== currentUser.id) {
          const chat = chats.find(c => c.id === msg.message.chat_id);
          if (chat) {
            chat.unread_count = (chat.unread_count || 0) + 1;
            if (!chat.first_unread_id) chat.first_unread_id = msg.message.id;
            renderChatList(chatSearch.value);
          }
        }
        // Only render if we're in the relevant chat
        if (isVisibleCurrentChat && !isMessageDisplayed(msg.message.id)) {
          const wasNearBottom = isNearBottom();
          const isAiBotResponse = msg.message.ai_generated || msg.message.ai_bot_id;
          const shouldPreserveIncomingScroll = scrollRestoreMode === 'restore'
            && !isOwnIncomingMessage
            && !isAiBotResponse
            && (!wasNearBottom || document.hidden);
          const shouldAutoScrollIncomingMedia = isOwnIncomingMessage
            || (!document.hidden && wasNearBottom && !shouldPreserveIncomingScroll);
          const scrollTopBefore = messagesEl.scrollTop;
          appendMessage(msg.message, { mediaAutoScrollToBottom: shouldAutoScrollIncomingMedia });
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
          const previewChatId = Number(msg.chatId || msg.chat_id || el?.__messageData?.chat_id || el?.__messageData?.chatId || currentChatId || 0);
          if (previewChatId && window.messageCache?.patchMessage) {
            const previousPreviews = Array.isArray(el?.__messageData?.previews) ? el.__messageData.previews : [];
            const nextPreviews = msg.preview
              ? [...previousPreviews.filter((item) => item?.url !== msg.preview.url), msg.preview]
              : previousPreviews;
            window.messageCache.patchMessage(previewChatId, msg.messageId, { previews: nextPreviews }).catch(() => {});
            if (el?.__messageData) el.__messageData = { ...el.__messageData, previews: nextPreviews };
          }
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
      case 'poll_updated': {
        applyPollUpdate(msg.chatId || msg.chat_id, msg.messageId || msg.message_id, msg.poll);
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
          { updateVisible: isCurrentChatActivelyVisible(msg.chatId) }
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
        window.BananzaVideoNoteHooks?.handleWSMessage?.(msg);
        break;
      }
      case 'user_updated': {
        applyUserUpdate(msg.user || {});
        break;
      }
      case 'user_directory_changed': {
        loadAllUsers().catch(() => {});
        break;
      }
      case 'pins_updated': {
        applyPinsUpdate(msg);
        if (msg.action === 'pinned') {
          appendPinEventIfVisible(msg.pin_event || msg.pinEvent);
          handlePinnedMessageUpdate(msg);
        }
        break;
      }
      case 'chat_updated': {
        applyChatUpdate(msg.chat || {});
        break;
      }
      case 'context_convert_bots_updated': {
        invalidateContextConvertAvailability(msg.chatId || msg.chat_id);
        if (Number(msg.chatId || msg.chat_id || 0) === Number(currentChatId || 0)) {
          loadContextConvertAvailability(currentChatId, { force: true }).catch(() => {});
        }
        break;
      }
      case 'chat_history_cleared': {
        const chatId = Number(msg.chatId || msg.chat_id || 0);
        await clearLocalChatHistory(chatId, { clearCache: true });
        loadChats({ silent: true }).catch(() => {});
        break;
      }
      case 'chat_removed': {
        await removeChatLocally(msg.chatId, { clearCache: true });
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
        renderChatDangerControls(currentChat);
      }
      setChatListStatus('', '');
      scheduleMessageBackgroundSync();
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

  function scheduleMessageBackgroundSync(delayMs = 450) {
    clearTimeout(messageBackgroundSyncTimer);
    messageBackgroundSyncTimer = setTimeout(() => {
      messageBackgroundSyncTimer = null;
      runMessageBackgroundSync().catch(() => {});
    }, Math.max(0, Number(delayMs) || 0));
  }

  function shouldBackgroundSyncMessages() {
    return Boolean(token && currentUser && initialChatLoadFinished && !document.hidden && !isUiTransitionBusy());
  }

  function selectBackgroundMessageSyncChats() {
    const indexed = (Array.isArray(chats) ? chats : [])
      .map((chat, index) => ({ chat, index }))
      .filter(({ chat }) => Number(chat?.id || 0) > 0 && Number(chat?.last_message_id || 0) > 0)
      .filter(({ chat }) => Number(chat.id) !== Number(currentChatId || 0));
    indexed.sort((a, b) => {
      const score = (item) => {
        const chat = item.chat;
        let value = 0;
        if (Number(chat.unread_count || 0) > 0) value += 1000;
        if (isChatPinned(chat)) value += 500;
        value += Math.max(0, 100 - item.index);
        return value;
      };
      return score(b) - score(a);
    });
    return indexed.slice(0, MESSAGE_BACKGROUND_SYNC_MAX_CHATS).map((item) => item.chat);
  }

  async function syncChatMessagesInBackground(chat, { allowColdPrewarm = false } = {}) {
    const chatId = Number(chat?.id || 0);
    const serverLastId = Number(chat?.last_message_id || 0);
    if (!chatId || !serverLastId || Number(currentChatId || 0) === chatId) return false;
    if (messageBackgroundSyncInFlight.has(chatId)) return false;
    messageBackgroundSyncInFlight.add(chatId);
    try {
      const range = await readCachedChatRange(chatId);
      const cachedMax = Number(range?.maxId || 0);
      if (cachedMax && serverLastId <= cachedMax) {
        await writeCachedChatMeta(chatId, {
          maxId: cachedMax,
          lastKnownServerId: serverLastId,
          hasMoreAfter: false,
        });
        return false;
      }

      if (!cachedMax) {
        const shouldPrewarm = Boolean(allowColdPrewarm);
        if (!shouldPrewarm) return false;
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), meta: '1' });
        const result = await fetchMessagesPage(chatId, params);
        const msgs = result.messages || [];
        const readState = await reconcileChatReadState(chatId, result.memberLastReads, { replace: true, updateVisible: false });
        if (readState.chatReadChanged) renderChatList(chatSearch.value);
        applyOwnReadStateToMessages(chatId, msgs);
        await cacheMessages(chatId, msgs, result.page, {
          writeEmptyMeta: true,
          lastKnownServerId: serverLastId,
        });
        warmMessageWindowAssets(chat, msgs);
        return msgs.length > 0;
      }

      let cursor = cachedMax;
      let wroteAny = false;
      for (let pageIndex = 0; pageIndex < MESSAGE_BACKGROUND_SYNC_MAX_PAGES; pageIndex += 1) {
        if (!shouldBackgroundSyncMessages()) break;
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), meta: '1', after: String(cursor) });
        const result = await fetchMessagesPage(chatId, params);
        const msgs = result.messages || [];
        const readState = await reconcileChatReadState(chatId, result.memberLastReads, { replace: true, updateVisible: false });
        if (readState.chatReadChanged) renderChatList(chatSearch.value);
        applyOwnReadStateToMessages(chatId, msgs);
        await cacheMessages(chatId, msgs, result.page, {
          writeEmptyMeta: true,
          lastKnownServerId: serverLastId,
        });
        if (!msgs.length) {
          await writeCachedChatMeta(chatId, {
            maxId: cursor,
            lastKnownServerId: serverLastId,
            hasMoreAfter: result.page.hasMoreAfter ?? false,
          });
          break;
        }
        warmMessageWindowAssets(chat, msgs);
        wroteAny = true;
        const fetchedLastId = maxMessageId(msgs);
        if (!fetchedLastId || fetchedLastId <= cursor || !(result.page.hasMoreAfter ?? (msgs.length >= PAGE_SIZE))) break;
        cursor = fetchedLastId;
      }
      return wroteAny;
    } catch (e) {
      return false;
    } finally {
      messageBackgroundSyncInFlight.delete(chatId);
    }
  }

  async function runMessageBackgroundSync() {
    if (messageBackgroundSyncRunning) {
      messageBackgroundSyncRequested = true;
      return;
    }
    if (!shouldBackgroundSyncMessages()) {
      scheduleMessageBackgroundSync(1200);
      return;
    }
    messageBackgroundSyncRunning = true;
    messageBackgroundSyncRequested = false;
    try {
      const queue = selectBackgroundMessageSyncChats();
      let cursor = 0;
      const workers = Array.from({ length: Math.min(MESSAGE_BACKGROUND_SYNC_CONCURRENCY, queue.length) }, async () => {
        while (cursor < queue.length && shouldBackgroundSyncMessages()) {
          const queueIndex = cursor++;
          const chat = queue[queueIndex];
          const allowColdPrewarm = queueIndex < 2 || Number(chat?.unread_count || 0) > 0 || isChatPinned(chat);
          await syncChatMessagesInBackground(chat, { allowColdPrewarm });
        }
      });
      await Promise.all(workers);
    } finally {
      messageBackgroundSyncRunning = false;
      if (messageBackgroundSyncRequested) scheduleMessageBackgroundSync(900);
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

  function createChatListItem(chat, { hiddenSearchResult = false } = {}) {
    const el = document.createElement('div');
    const isActive = Number(chat.id) === Number(currentChatId);
    const pinned = isChatPinned(chat);
    el.className = 'chat-item'
      + (isActive ? ' active' : '')
      + (pinned ? ' is-pinned' : '')
      + (hiddenSearchResult ? ' is-hidden-search-result' : '');
    el.dataset.chatId = chat.id;
    el.dataset.pinned = pinned ? '1' : '0';

    const displayName = chat.name;
    const isOnline = chat.type === 'private' && chat.private_user && onlineUsers.has(chat.private_user.id);
    const lastMsg = getChatLastPreviewText(chat);
    const lastTime = chat.last_time ? formatTime(chat.last_time) : '';
    const unread = chat.unread_count > 0
      ? `<span class="unread-badge${isActive ? ' unread-badge--active-chat' : ''}" data-unread-count="${chat.unread_count}">${chat.unread_count > 99 ? '99+' : chat.unread_count}</span>`
      : '';
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
      const openAction = hiddenSearchResult ? openHiddenChatFromSearch(chat.id) : openChat(chat.id);
      Promise.resolve(openAction).catch((error) => {
        console.warn('Failed to open chat', error);
        showCenterToast(error?.message || 'Could not open chat');
      });
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
      scheduleHiddenChatSearch(normalizedFilter);
      const hiddenMatches = hiddenChatSearchQuery === normalizedFilter
        ? hiddenChatSearchResults.filter((chat) => !chats.some((visible) => Number(visible.id) === Number(chat.id)))
        : [];
      if (hiddenMatches.length > 0) {
        appendChatListSeparator('Скрытые чаты');
        hiddenMatches.forEach((chat) => {
          chatList.appendChild(createChatListItem(chat, { hiddenSearchResult: true }));
        });
      }
      const privateHumanPeerIds = new Set(
        [...chats, ...hiddenMatches]
          .filter(c => c.type === 'private' && c.private_user && Number(c.private_user.is_ai_bot) === 0)
          .map(c => c.private_user.id)
      );
      const matchingUsers = allUsers.filter(u =>
        (Number(u?.is_ai_bot) !== 0 || !privateHumanPeerIds.has(u.id)) &&
        (u.display_name.toLowerCase().includes(normalizedFilter) ||
         u.username.toLowerCase().includes(normalizedFilter) ||
         String(u.ai_bot_mention || '').toLowerCase().includes(normalizedFilter) ||
         String(u.ai_bot_model || '').toLowerCase().includes(normalizedFilter))
      );
      if (matchingUsers.length > 0) {
        appendChatListSeparator('People & bots');
      }
      for (const u of matchingUsers) {
        const el = document.createElement('div');
        el.className = 'chat-item';
        const isOnline = !isAiBotDirectoryUser(u) && onlineUsers.has(u.id);
        el.innerHTML = `
          <div class="chat-item-avatar" style="background:${u.avatar_color || '#5eb5f7'}">
            ${u.avatar_url ? `<img class="avatar-img" src="${esc(u.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">` : initials(u.display_name)}
            ${isOnline ? '<div class="online-dot"></div>' : ''}
          </div>
          <div class="chat-item-body">
            <div class="chat-item-top">
              <span class="chat-item-name">${esc(u.display_name)}</span>
            </div>
            <div class="chat-item-last"><span>${esc(userSecondaryLineText(u))}</span></div>
          </div>
        `;
        el.addEventListener('click', async () => {
          try {
            const chat = await api('/api/chats/private', { method: 'POST', body: { targetUserId: u.id } });
            await loadChats();
            openChat(chat.id);
            setChatSearchOpen(false, { clear: true, focus: false });
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
      chat.last_text = msg.text || (msg.is_voice_note ? msg.transcription_text || getMediaNoteFallbackLabel(msg) || null : null);
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
    syncContextConvertComposerButton();
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

  function normalizePinEvent(raw = {}) {
    const id = Number(raw.id || raw.event_id || 0);
    const chatId = Number(raw.chat_id || raw.chatId || currentChatId || 0);
    const messageId = Number(raw.message_id || raw.messageId || 0);
    if (!id || !chatId || !messageId) return null;
    return {
      id,
      chat_id: chatId,
      message_id: messageId,
      action: raw.action === 'unpinned' ? 'unpinned' : 'pinned',
      actor_id: raw.actor_id == null && raw.actorId == null ? null : Number(raw.actor_id || raw.actorId || 0),
      actor_name: raw.actor_name || raw.actorName || '',
      message_author_id: raw.message_author_id == null && raw.messageAuthorId == null ? null : Number(raw.message_author_id || raw.messageAuthorId || 0),
      message_author_name: raw.message_author_name || raw.messageAuthorName || '',
      message_preview: raw.message_preview || raw.messagePreview || raw.preview_text || '',
      created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
    };
  }

  function normalizePinEvents(events = []) {
    const seen = new Set();
    return (Array.isArray(events) ? events : [])
      .map(normalizePinEvent)
      .filter((event) => {
        if (!event || event.action !== 'pinned' || seen.has(event.id)) return false;
        seen.add(event.id);
        return true;
      });
  }

  function normalizeMessagesPage(data) {
    if (Array.isArray(data)) return { messages: data, pinEvents: [], hasMoreBefore: null, hasMoreAfter: null };
    if (data && Array.isArray(data.messages)) {
      return {
        messages: data.messages,
        pinEvents: normalizePinEvents(data.pin_events || data.pinEvents || []),
        hasMoreBefore: typeof data.has_more_before === 'boolean' ? data.has_more_before : null,
        hasMoreAfter: typeof data.has_more_after === 'boolean' ? data.has_more_after : null,
      };
    }
    return { messages: [], pinEvents: [], hasMoreBefore: false, hasMoreAfter: false };
  }

  async function fetchMessagesPage(chatId, params, { signal = null } = {}) {
    const query = params instanceof URLSearchParams ? params : new URLSearchParams(params || {});
    const raw = await api(`/api/chats/${chatId}/messages?${query}`, signal ? { signal } : {});
    const page = normalizeMessagesPage(raw);
    return {
      raw,
      page,
      messages: page.messages || [],
      pinEvents: page.pinEvents || [],
      memberLastReads: raw && raw.member_last_reads ? raw.member_last_reads : null,
    };
  }

  function setHasMoreBefore(value) {
    hasMore = Boolean(value);
    loadMoreWrap.classList.toggle('hidden', !hasMore);
  }

  function setLoadMoreAfterLoading(value) {
    if (!loadMoreAfterWrap) return;
    const loading = Boolean(value);
    loadMoreAfterWrap.classList.toggle('hidden', !loading);
    loadMoreAfterWrap.setAttribute('aria-hidden', loading ? 'false' : 'true');
  }

  function setHasMoreAfter(value) {
    hasMoreAfter = Boolean(value);
    if (!hasMoreAfter) setLoadMoreAfterLoading(false);
    updateScrollBottomButton();
  }

  function getMessagesAfterLoader() {
    return loadMoreAfterWrap && loadMoreAfterWrap.parentElement === messagesEl ? loadMoreAfterWrap : null;
  }

  function getMessagesLastContentChild() {
    const afterLoader = getMessagesAfterLoader();
    return afterLoader ? afterLoader.previousElementSibling : messagesEl.lastElementChild;
  }

  function insertAtMessagesEnd(node) {
    messagesEl.insertBefore(node, getMessagesAfterLoader());
  }

  function buildMessagesRootChildren(fragment = null) {
    const children = [];
    if (loadMoreWrap) children.push(loadMoreWrap);
    if (fragment) children.push(fragment);
    if (loadMoreAfterWrap) children.push(loadMoreAfterWrap);
    return children;
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

  function getChatLastMessageId(chatId, fallback = 0) {
    const chat = getChatById(chatId);
    const value = Number(chat?.last_message_id || 0);
    return Number.isFinite(value) && value > 0 ? value : Number(fallback || 0);
  }

  function cacheMessages(chatId, messages = [], page = null, options = {}) {
    if (!Array.isArray(messages)) return Promise.resolve(false);
    const list = messages.filter(Boolean);
    if (!list.length && !options.writeEmptyMeta) return Promise.resolve(false);
    const lastKnownServerId = Number(options.lastKnownServerId || 0)
      || getChatLastMessageId(chatId, maxMessageId(list));
    try {
      const write = window.messageCache?.writeWindow?.(chatId, list, {
        limit: MESSAGE_CACHE_LIMIT,
        hasMoreBefore: page?.hasMoreBefore,
        hasMoreAfter: page?.hasMoreAfter,
        lastKnownServerId,
        replaceRange: Boolean(options.replaceRange),
      });
      return Promise.resolve(write).catch(() => false);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  function writeCachedChatMeta(chatId, patch = {}) {
    try {
      const write = window.messageCache?.writeChatMeta?.(chatId, {
        ...patch,
        lastKnownServerId: patch.lastKnownServerId || getChatLastMessageId(chatId, patch.maxId),
      });
      return Promise.resolve(write).catch(() => null);
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  async function readCachedChatRange(chatId) {
    try {
      const range = await window.messageCache?.getCachedRange?.(chatId);
      if (range) return range;
      return await window.messageCache?.readChatMeta?.(chatId);
    } catch (e) {
      return null;
    }
  }

  function debugMessageCache(event, detail = {}) {
    try {
      if (localStorage.getItem('bananza:debugMessageCache') !== '1') return;
      console.info('[message-cache]', event, detail);
    } catch (e) {}
  }

  function revealActiveMobileChatRoute({ suppressHistoryPush = false, chatId = currentChatId } = {}) {
    if (!isMobileLayoutViewport() || !sidebar) return;
    cancelPendingSidebarReveal();
    syncMobileBaseSceneState({
      scene: 'chat',
      hideInactive: false,
      syncChatMetrics: true,
    });
    sidebar.classList.remove('sidebar-no-transition');
    sidebar.classList.add('sidebar-hidden');
    if (!suppressHistoryPush) {
      history.pushState({ chat: Number(chatId || currentChatId || 0) }, '');
    }
    const transitionMs = prefersReducedMotion()
      ? 0
      : Math.max(180, Math.ceil(getElementTransitionTotalMs(sidebar) || 250));
    if (transitionMs <= 0) {
      endMobileRouteTransition();
      return;
    }
    beginMobileRouteTransition(transitionMs + 90);
  }

  function warmMessageWindowAssets(chat, messages = []) {
    if (!window.cacheAssets) return;
    (async () => {
      try {
        const assetUrls = new Set();
        if (chat?.background_url) assetUrls.add(chat.background_url);
        for (const message of messages || []) {
          if (message.avatar_url) assetUrls.add(message.avatar_url);
          if (message.file_type === 'image' && message.file_stored) assetUrls.add(getAttachmentPreviewUrl(message));
        }
        await window.cacheAssets(Array.from(assetUrls).slice(0, 12));
      } catch (e) {}
    })();
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
    if (!suppressScrollAnchorSave && messagesEl.scrollTop < PAGINATION_TOP_THRESHOLD && hasMore && !loadingMore && !loadingMoreAfter) {
      loadMore();
      return true;
    }
    return false;
  }

  function maybeLoadMoreAtBottom() {
    if (!suppressScrollAnchorSave && hasMoreAfter && !loadingMoreAfter && !loadingMore && isNearBottom(PAGINATION_BOTTOM_THRESHOLD)) {
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

  function saveCurrentScrollAnchor(chatId = currentChatId, { force = false, allowPendingMedia = false } = {}) {
    const targetChatId = Number(chatId || currentChatId || 0);
    if (!targetChatId || (!force && suppressScrollAnchorSave)) return false;
    if (
      !allowPendingMedia
      && targetChatId === Number(currentChatId || 0)
      && pendingMediaBottomScrollRows.size
    ) {
      return false;
    }
    ensureScrollAnchorsLoaded();
    const anchor = captureScrollAnchor();
    if (!anchor?.messageId) return false;
    scrollPositions[targetChatId] = anchor;
    persistScrollAnchors();
    return true;
  }

  function canCaptureCurrentChatScrollAnchor(chatId = currentChatId) {
    const targetChatId = Number(chatId || currentChatId || 0);
    if (!targetChatId || Number(currentChatId || 0) !== targetChatId) return false;
    if (!(messagesEl instanceof HTMLElement) || !messagesEl.isConnected) return false;
    return isCurrentChatActivelyVisible(targetChatId);
  }

  function isCurrentChatActivelyVisible(chatId = currentChatId) {
    const targetChatId = Number(chatId || currentChatId || 0);
    if (!targetChatId || Number(currentChatId || 0) !== targetChatId) return false;
    if (!(chatView instanceof HTMLElement) || chatView.classList.contains('hidden')) return false;
    if (!isMobileLayoutViewport()) return true;
    if (!(chatArea instanceof HTMLElement)) return true;
    if (chatArea.hasAttribute('inert') || chatArea.classList.contains('mobile-scene-hidden')) return false;
    return getResolvedMobileBaseScene() === 'chat';
  }

  function clearScheduledScrollAnchorSave() {
    clearTimeout(scrollAnchorSaveTimer);
    scrollAnchorSaveTimer = null;
    scheduledScrollAnchorSaveChatId = 0;
  }

  function flushCurrentChatScrollAnchor(chatId = currentChatId, { force = true, allowPendingMedia = true } = {}) {
    const targetChatId = Number(chatId || currentChatId || 0);
    clearScheduledScrollAnchorSave();
    if (!targetChatId) return false;
    if (!canCaptureCurrentChatScrollAnchor(targetChatId)) return false;
    return saveCurrentScrollAnchor(targetChatId, {
      force,
      allowPendingMedia,
    });
  }

  function scheduleScrollAnchorSave() {
    if (suppressScrollAnchorSave || !currentChatId) return;
    const targetChatId = Number(currentChatId || 0);
    if (!targetChatId) return;
    clearScheduledScrollAnchorSave();
    scheduledScrollAnchorSaveChatId = targetChatId;
    scrollAnchorSaveTimer = setTimeout(() => {
      scrollAnchorSaveTimer = null;
      const scheduledChatId = Number(scheduledScrollAnchorSaveChatId || 0);
      scheduledScrollAnchorSaveChatId = 0;
      if (!scheduledChatId || Number(currentChatId || 0) !== scheduledChatId) return;
      saveCurrentScrollAnchor(scheduledChatId);
    }, 140);
  }

  function restoreScrollAnchor(anchor, attempts = 3, options = {}) {
    if (!anchor?.messageId) return false;
    const guardSeq = Number(options.openSeq || 0);
    const guardChatId = Number(options.chatId || currentChatId || 0);
    const isGuardCurrent = () => (
      (!guardSeq || Number(chatOpenSeq || 0) === guardSeq)
      && (!guardChatId || Number(currentChatId || 0) === guardChatId)
    );
    if (!isGuardCurrent()) return false;
    const row = findRestorableAnchorRow(anchor);
    if (!row) return false;
    const apply = () => {
      if (!isGuardCurrent()) return;
      const containerRect = messagesEl.getBoundingClientRect();
      const rect = row.getBoundingClientRect();
      messagesEl.scrollTop += (rect.top - containerRect.top) - (Number(anchor.offsetTop) || 0);
      updateScrollBottomButton();
    };
    apply();
    if (attempts > 1) {
      const timer = setTimeout(() => {
        scrollRestoreTimers.delete(timer);
        restoreScrollAnchor(anchor, attempts - 1, options);
      }, 120);
      scrollRestoreTimers.add(timer);
    }
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
    if (!isCurrentChatActivelyVisible() || (!force && !isNearBottom(8))) return;
    const chat = chats.find(c => c.id === currentChatId);
    const readId = getMaxRenderedMessageId();
    if (!readId || (chat && Number(chat.last_read_id || 0) >= readId)) return;
    markChatReadThrough(currentChatId, readId).catch(() => {});
  }

  function renderAdminUserRow(u) {
    const isOnline = onlineUsers.has(u.id);
    const badges = [
      u.is_admin ? '<span class="badge badge-admin">Admin</span>' : '',
      u.is_blocked ? '<span class="badge badge-blocked">Blocked</span>' : '',
    ].filter(Boolean).join('');
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
        ${badges ? `<div class="admin-user-badges">${badges}</div>` : ''}
        <div class="admin-user-controls">
          ${!u.is_admin ? `<div class="admin-user-toggle">
            <span>Add bots</span>
            <label class="toggle-switch">
              <input type="checkbox" class="bot-access-toggle" data-uid="${u.id}" ${u.can_add_bots_to_chats ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>` : ''}
          <button class="admin-user-audit-btn bot-audit-btn" data-uid="${u.id}" data-name="${esc(u.display_name)}" type="button">Bot audit</button>
        </div>
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
      if (item.dataset.bot === '1') return;
      const uid = +item.dataset.uid;
      const statusEl = item.querySelector('.admin-user-status');
      if (!statusEl) return;
      const isOnline = onlineUsers.has(uid);
      statusEl.classList.toggle('online', isOnline);
      statusEl.classList.toggle('offline', !isOnline);
      statusEl.innerHTML = `<span class="status-dot"></span>${isOnline ? 'online' : 'offline'}`;
    });
  }

  function refreshChatInfoStatus() {
    const el = $('#chatInfoStatus');
    if (!el) return;
    const chat = getChatById(currentChatId);
    syncChatInfoStatusVisibility(chat);
    if (isNotesChat(chat)) return;
    if (chat?.type === 'private' && Number(chat?.private_user?.is_ai_bot) !== 0) {
      el.classList.remove('online', 'offline');
      el.innerHTML = `<span class="status-dot"></span>AI bot`;
      return;
    }
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
        el.innerHTML = `<span class="status-dot"></span>AI bot`;
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
    const chat = getChatById(targetChatId);
    if (!chat) {
      throw new Error('Chat not found in local list');
    }
    const previousChatId = Number(currentChatId || 0);
    const sameChat = previousChatId === targetChatId;
    const explicitAnchorId = Number(options?.anchorMessageId || 0);
    const suppressHistoryPush = Boolean(options?.suppressHistoryPush);
    const { seq, controller } = beginChatOpenTransition(targetChatId);
    let restoreAnchor = null;
    let cachedMsgs = [];
    let cachedRange = null;
    let committedWindow = false;
    let postOpenScheduled = false;
    const openStartedAt = performance.now();
    const isCurrentOpen = () => isCurrentChatOpenTransition(seq, targetChatId);

    const applyOpenScroll = () => {
      if (!isCurrentOpen()) return;
      if (restoreAnchor?.atBottom) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
        updateScrollBottomButton();
      } else if (restoreAnchor?.messageId) {
        if (!restoreScrollAnchor(restoreAnchor, 1, { openSeq: seq, chatId: targetChatId })) {
          messagesEl.scrollTop = 0;
          updateScrollBottomButton();
        }
      } else {
        messagesEl.scrollTop = messagesEl.scrollHeight;
        updateScrollBottomButton();
      }
    };

    const commitMessageWindow = async (msgs = [], page = null, { source = 'network', pinEvents = [] } = {}) => {
      if (!isCurrentOpen()) return false;
      const list = Array.isArray(msgs) ? msgs : [];
      const shouldAutoScrollRenderedMedia = Boolean(restoreAnchor?.atBottom || !restoreAnchor?.messageId);
      const firstId = minMessageId(list);
      const lastId = maxMessageId(list);
      const cacheHasMoreBefore = firstId !== Number.MAX_SAFE_INTEGER
        && firstId > 1
        && (restoreAnchor?.messageId ? true : list.length >= PAGE_SIZE);
      const networkHasMoreBefore = restoreAnchor?.messageId ? list.length > 0 : list.length >= PAGE_SIZE;
      const fallbackHasMoreAfter = Boolean(
        restoreAnchor?.messageId
        && chat?.last_message_id
        && lastId
        && lastId < Number(chat.last_message_id || 0)
      );

      setHasMoreBefore(page?.hasMoreBefore ?? (source === 'cache' ? cacheHasMoreBefore : networkHasMoreBefore));
      setHasMoreAfter(page?.hasMoreAfter ?? fallbackHasMoreAfter);
      replaceRenderedMessages(list, pinEvents, {
        mediaAutoScrollToBottom: shouldAutoScrollRenderedMedia,
      });
      if (!isCurrentOpen()) return false;
      committedWindow = true;
      renderOutboxForChat(targetChatId).catch(() => {});
      return true;
    };

    const revealCommittedWindow = () => {
      if (!isCurrentOpen()) return;
      revealActiveMobileChatRoute({ suppressHistoryPush, chatId: targetChatId });
      applyOpenScroll();
      revealChatHydration(seq, targetChatId);
      finishVisibleOpen();
      schedulePostOpenWork();
    };

    const finishVisibleOpen = () => {
      if (!isCurrentOpen()) return;
      clearReply();
      if (editTo) clearEdit({ clearInput: true });
      syncMentionOpenButton();
      loadContextConvertAvailability(targetChatId).catch(() => {});
      if (window.innerWidth > 768) msgInput.focus();
      refreshPollComposerActionState();
      window.BananzaVoiceHooks?.refreshComposerState?.();
      updateScrollBottomButton();
      localStorage.setItem('lastChat', targetChatId);
    };

    const schedulePostOpenWork = () => {
      if (postOpenScheduled) return;
      postOpenScheduled = true;
      requestAnimationFrame(() => {
        if (!isCurrentOpen()) return;
        updateScrollBottomButton();
        setTimeout(() => {
          if (!isCurrentOpen()) return;
          suppressScrollAnchorSave = false;
          saveCurrentScrollAnchor(targetChatId, { force: true });
          maybeLoadMoreAtTop();
          maybeLoadMoreAtBottom();
          // Short chats can open fully visible without ever producing a scroll event.
          markCurrentChatReadIfAtBottom(false);
          endChatOpenTransition(seq, targetChatId);
        }, 260);
      });
    };

    const reconcileFetchedPage = async ({ raw, page, messages: msgs, memberLastReads }) => {
      const readState = await reconcileChatReadState(targetChatId, memberLastReads, {
        replace: true,
        updateVisible: currentChatId === targetChatId,
      });
      if (!isCurrentOpen()) return false;
      if (readState.chatReadChanged) renderChatList(chatSearch.value);
      applyOwnReadStateToMessages(targetChatId, msgs);
      await cacheMessages(targetChatId, msgs || [], page, {
        writeEmptyMeta: true,
        lastKnownServerId: getChatLastMessageId(targetChatId, maxMessageId(msgs)),
      });
      if (raw && !Array.isArray(raw) && (!msgs || !msgs.length)) {
        await writeCachedChatMeta(targetChatId, {
          maxId: cachedRange?.maxId || maxMessageId(cachedMsgs),
          hasMoreAfter: page.hasMoreAfter,
          lastKnownServerId: getChatLastMessageId(targetChatId, cachedRange?.maxId || maxMessageId(cachedMsgs)),
        });
      }
      return true;
    };

    const fetchFullWindow = async () => {
      const networkStartedAt = performance.now();
      debugMessageCache('network-window-start', {
        chatId: targetChatId,
        elapsedMs: Math.round(networkStartedAt - openStartedAt),
        anchor: restoreAnchor?.messageId || null,
      });
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      params.set('meta', '1');
      if (restoreAnchor?.messageId && !restoreAnchor?.atBottom) params.set('anchor', String(restoreAnchor.messageId));
      const result = await fetchMessagesPage(targetChatId, params, { signal: controller.signal });
      debugMessageCache('network-window-done', {
        chatId: targetChatId,
        fetchMs: Math.round(performance.now() - networkStartedAt),
        count: result.messages?.length || 0,
      });
      const { page, messages: msgs, pinEvents } = result;
      if (!isCurrentOpen()) return false;
      if (!await reconcileFetchedPage(result)) return false;
      if (!isCurrentOpen()) return false;
      if (committedWindow && renderedMessageIdsMatch(msgs) && !pinEvents.length) {
        setHasMoreBefore(page.hasMoreBefore ?? (restoreAnchor?.messageId ? msgs.length > 0 : msgs.length >= PAGE_SIZE));
        setHasMoreAfter(page.hasMoreAfter ?? Boolean(restoreAnchor?.messageId && chat?.last_message_id && maxMessageId(msgs) < Number(chat.last_message_id || 0)));
        renderOutboxForChat(targetChatId).catch(() => {});
        if (!isCurrentOpen()) return false;
      } else {
        if (!await commitMessageWindow(msgs, page, { source: 'network', pinEvents })) return false;
      }
      warmMessageWindowAssets(chat, msgs);
      revealCommittedWindow();
      return true;
    };

    const syncNewMessagesAfter = async (initialCursor, { maxPages = RECOVERY_CATCHUP_MAX_PAGES, lightOnly = false } = {}) => {
      let cursor = Number(initialCursor || 0);
      if (!cursor) return false;
      let appendedAny = false;
      for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
        if (!isCurrentOpen()) return appendedAny;
        const params = new URLSearchParams({
          limit: String(lightOnly ? 1 : PAGE_SIZE),
          meta: '1',
          after: String(cursor),
        });
        const result = await fetchMessagesPage(targetChatId, params, { signal: controller.signal });
        const { page, messages: msgs, pinEvents } = result;
        if (!await reconcileFetchedPage(result)) return appendedAny;
        if (!isCurrentOpen()) return appendedAny;

        if (!msgs.length) {
          await writeCachedChatMeta(targetChatId, {
            maxId: cursor,
            hasMoreAfter: page.hasMoreAfter ?? false,
            lastKnownServerId: getChatLastMessageId(targetChatId, cursor),
          });
          setHasMoreAfter(page.hasMoreAfter ?? false);
          return appendedAny;
        }

        const newMessages = filterNewMessages(msgs);
        const newPinEvents = filterNewPinEvents(pinEvents);
        if (newMessages.length || newPinEvents.length) {
          const wasNearBottom = isNearBottom(120);
          const anchor = wasNearBottom ? null : captureScrollAnchor();
          appendTimelineItems(newMessages, newPinEvents, {
            mediaAutoScrollToBottom: Boolean(wasNearBottom),
          });
          if (newMessages.length) updateChatListLastMessage(newMessages[newMessages.length - 1]);
          if (wasNearBottom) {
            scrollToBottom(false, true);
          } else if (anchor?.messageId) {
            requestAnimationFrame(() => restoreScrollAnchor(anchor, 1, { openSeq: seq, chatId: targetChatId }));
          }
          appendedAny = true;
        }

        const fetchedLastId = maxMessageId(msgs);
        setHasMoreAfter(page.hasMoreAfter ?? Boolean(fetchedLastId && getChatLastMessageId(targetChatId, fetchedLastId) > fetchedLastId));
        if (!fetchedLastId || fetchedLastId <= cursor || !(page.hasMoreAfter ?? (msgs.length >= PAGE_SIZE))) break;
        cursor = fetchedLastId;
        if (lightOnly) break;
      }
      if (appendedAny && isCurrentOpen()) saveCurrentScrollAnchor(targetChatId, { force: true });
      return appendedAny;
    };

    const syncCachedOpenInBackground = async () => {
      try {
        const refreshed = await fetchFullWindow();
        if (!refreshed || !isCurrentOpen()) return;
        const renderedMax = getMaxRenderedMessageId();
        const serverLastId = getChatLastMessageId(targetChatId, renderedMax);
        if (serverLastId > renderedMax) {
          await syncNewMessagesAfter(renderedMax, { maxPages: RECOVERY_CATCHUP_MAX_PAGES });
        }
      } catch (error) {
        if (!isAbortError(error)) updateHasMoreAfterFromChat(targetChatId);
      }
    };

    // Save scroll position of previous chat
    if (currentChatId) {
      flushCurrentChatScrollAnchor(currentChatId, { force: true, allowPendingMedia: true });
    }
    if (previousChatId && !sameChat) {
      pauseCurrentChatMediaPlayback();
    }
    hideMentionPicker();
    closeEmojiPicker({ immediate: true });
    hideContextConvertPicker();
    clearActivePulseVoterPopover({ skipRefresh: true });
    hideAvatarUserMenu();
    hideChatContextMenu({ immediate: true });
    hideFloatingMessageActions({ immediate: true });

    currentChatId = targetChatId;
    displayedMsgIds.clear();
    displayedPinEventIds.clear();
    hasMore = false; // prevent scroll handler triggering loadMore during DOM clear
    setHasMoreAfter(false);
    suppressScrollAnchorSave = true;
    setChatHydrating(true);

    emptyState.classList.add('hidden');
    chatView.classList.remove('hidden');
    requestAnimationFrame(syncChatAreaMetrics);

    // Update sidebar active state
    chatList.querySelectorAll('.chat-item[data-chat-id]').forEach(el => {
      el.classList.toggle('active', +el.dataset.chatId === targetChatId);
    });

    restoreAnchor = explicitAnchorId
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
    setLoadMoreAfterLoading(false);

    try {
      if (window.messageCache) {
        const cacheStartedAt = performance.now();
        cachedRange = await readCachedChatRange(targetChatId);
        const preferLatestCachedWindow = !restoreAnchor?.messageId || restoreAnchor?.atBottom;
        cachedMsgs = preferLatestCachedWindow
          ? await window.messageCache.readLatest(targetChatId, { limit: PAGE_SIZE })
          : await window.messageCache.readAround(targetChatId, restoreAnchor.messageId, { limit: PAGE_SIZE });
        const cacheReadMs = Math.round(performance.now() - cacheStartedAt);
        const hasAnchorInCache = !restoreAnchor?.messageId || restoreAnchor?.atBottom
          || cachedMsgs.some((msg) => Number(msg?.id || 0) === Number(restoreAnchor.messageId));
        const hasCachedWindowMeta = cachedRange?.windowCached === true
          || typeof cachedRange?.hasMoreBefore === 'boolean'
          || typeof cachedRange?.hasMoreAfter === 'boolean';
        const cachedMinId = Number(cachedRange?.minId || minMessageId(cachedMsgs) || 0);
        const cacheLooksLikeWindow = hasCachedWindowMeta
          || cachedMsgs.length >= PAGE_SIZE
          || (cachedMinId > 0 && cachedMinId <= 1);
        debugMessageCache(cacheLooksLikeWindow && cachedMsgs.length && hasAnchorInCache ? 'hit' : 'miss', {
          chatId: targetChatId,
          cacheReadMs,
          count: cachedMsgs.length,
          windowCached: cachedRange?.windowCached === true,
          hasCachedWindowMeta,
          hasAnchorInCache,
          anchor: restoreAnchor?.messageId || null,
        });
        if (isCurrentOpen() && Array.isArray(cachedMsgs) && cachedMsgs.length && hasAnchorInCache && cacheLooksLikeWindow) {
          applyOwnReadStateToMessages(targetChatId, cachedMsgs);
          await commitMessageWindow(cachedMsgs, {
            hasMoreBefore: typeof cachedRange?.hasMoreBefore === 'boolean' ? cachedRange.hasMoreBefore : null,
            hasMoreAfter: typeof cachedRange?.hasMoreAfter === 'boolean'
              ? cachedRange.hasMoreAfter
              : Boolean(getChatLastMessageId(targetChatId, maxMessageId(cachedMsgs)) > maxMessageId(cachedMsgs)),
          }, { source: 'cache' });
          warmMessageWindowAssets(chat, cachedMsgs);
          revealCommittedWindow();
          syncCachedOpenInBackground();
          return;
        }
      }
    } catch (e) {}

    try {
      await fetchFullWindow();
    } catch (error) {
      if (isAbortError(error) || !isCurrentOpen()) return;
      if (!committedWindow) {
        if (Array.isArray(cachedMsgs) && cachedMsgs.length) {
          applyOwnReadStateToMessages(targetChatId, cachedMsgs);
          if (!await commitMessageWindow(cachedMsgs, null, { source: 'cache' })) return;
        } else {
          renderOutboxForChat(targetChatId).catch(() => {});
          if (!isCurrentOpen()) return;
        }
      }
      revealCommittedWindow();
    }
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
      if (Number(chat.private_user.is_ai_bot) !== 0) {
        chatStatus.classList.remove('online', 'offline');
        chatStatus.textContent = 'AI bot';
        chatStatus.style.color = '';
        return;
      }
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

  function resolveMediaPlaybackChatId(message = {}) {
    return Number(message?.chat_id || message?.chatId || currentChatId || 0);
  }

  function resolveMediaPlaybackKey(message = {}, role = '') {
    const normalizedRole = String(role || '').trim();
    const rawId = String(
      message?.id
      || message?.client_id
      || message?.clientId
      || message?.file_stored
      || message?.client_file_url
      || ''
    ).trim();
    if (!normalizedRole || !rawId) return '';
    return `${normalizedRole}:${rawId}`;
  }

  function getMediaPlaybackBucket(chatId, { create = false } = {}) {
    const id = Number(chatId || 0);
    if (!id) return null;
    let bucket = mediaPlaybackStateByChat.get(id);
    if (!bucket && create) {
      bucket = new Map();
      mediaPlaybackStateByChat.set(id, bucket);
    }
    return bucket || null;
  }

  function readMediaPlaybackState(message = {}, role = '') {
    const chatId = resolveMediaPlaybackChatId(message);
    const key = resolveMediaPlaybackKey(message, role);
    if (!chatId || !key) return null;
    const bucket = getMediaPlaybackBucket(chatId);
    if (!bucket?.has(key)) return null;
    return { ...(bucket.get(key) || {}) };
  }

  function writeMediaPlaybackState(message = {}, role = '', snapshot = null) {
    const chatId = resolveMediaPlaybackChatId(message);
    const key = resolveMediaPlaybackKey(message, role);
    if (!chatId || !key) return;
    const bucket = getMediaPlaybackBucket(chatId, { create: true });
    const currentTime = Math.max(0, Number(snapshot?.currentTime || 0));
    const shouldResume = Boolean(snapshot?.shouldResume);
    if (!shouldResume && currentTime <= 0.05) {
      bucket.delete(key);
      if (!bucket.size) mediaPlaybackStateByChat.delete(chatId);
      return;
    }
    bucket.set(key, {
      currentTime,
      shouldResume,
      updatedAt: Date.now(),
    });
  }

  function clearMediaPlaybackState(message = {}, role = '') {
    const chatId = resolveMediaPlaybackChatId(message);
    const key = resolveMediaPlaybackKey(message, role);
    if (!chatId || !key) return;
    const bucket = getMediaPlaybackBucket(chatId);
    if (!bucket) return;
    bucket.delete(key);
    if (!bucket.size) mediaPlaybackStateByChat.delete(chatId);
  }

  function captureBoundMediaPlaybackState(mediaEl) {
    if (!mediaEl) return;
    const role = String(mediaEl.dataset.playbackRole || '').trim();
    const row = mediaEl.closest('.msg-row');
    const message = row?.__messageData || null;
    if (!message || !role) return;
    writeMediaPlaybackState(message, role, {
      currentTime: Number(mediaEl.currentTime || 0),
      shouldResume: !mediaEl.paused && !mediaEl.ended,
    });
  }

  function bindMediaPlaybackState(mediaEl, message = {}, role = '') {
    if (!mediaEl || !message) return;
    const resolvedRole = String(role || '').trim();
    const key = resolveMediaPlaybackKey(message, resolvedRole);
    if (!resolvedRole || !key) return;
    if (mediaEl.__bananzaPlaybackBoundKey === key) return;
    mediaEl.__bananzaPlaybackBoundKey = key;
    mediaEl.dataset.playbackRole = resolvedRole;

    let lastPersistAt = 0;
    let restored = false;
    let restoreStarted = false;
    const persistSnapshot = ({ force = false } = {}) => {
      const now = Date.now();
      if (!force && now - lastPersistAt < 500) return;
      lastPersistAt = now;
      captureBoundMediaPlaybackState(mediaEl);
    };

    const applySavedState = () => {
      if (restored || restoreStarted) return;
      const saved = readMediaPlaybackState(message, resolvedRole);
      if (!saved) return;
      restoreStarted = true;
      const targetTime = Math.max(0, Number(saved.currentTime || 0));
      const resumePlayback = () => {
        restored = true;
        restoreStarted = false;
        if (saved.shouldResume) {
          Promise.resolve(mediaEl.play?.()).catch(() => {});
        }
      };
      if (targetTime > 0.05) {
        const maxTime = Number.isFinite(mediaEl.duration) && mediaEl.duration > 0
          ? Math.max(0, mediaEl.duration - 0.05)
          : targetTime;
        const nextTime = Math.min(targetTime, maxTime);
        let resumeScheduled = false;
        const finalizeRestore = () => {
          if (resumeScheduled) return;
          resumeScheduled = true;
          try {
            if (Math.abs(Number(mediaEl.currentTime || 0) - nextTime) > 0.1) {
              mediaEl.currentTime = nextTime;
            }
          } catch (e) {}
          resumePlayback();
        };
        try {
          mediaEl.addEventListener('seeked', finalizeRestore, { once: true });
          mediaEl.currentTime = nextTime;
        } catch (e) {}
        setTimeout(finalizeRestore, 180);
        return;
      }
      resumePlayback();
    };

    mediaEl.addEventListener('play', () => persistSnapshot({ force: true }));
    mediaEl.addEventListener('pause', () => {
      if (mediaEl.__bananzaAutoPaused) {
        mediaEl.__bananzaAutoPaused = false;
        writeMediaPlaybackState(message, resolvedRole, {
          currentTime: Number(mediaEl.currentTime || 0),
          shouldResume: true,
        });
        return;
      }
      persistSnapshot({ force: true });
    });
    mediaEl.addEventListener('timeupdate', () => persistSnapshot());
    mediaEl.addEventListener('ended', () => {
      clearMediaPlaybackState(message, resolvedRole);
    });
    mediaEl.addEventListener('loadedmetadata', applySavedState, { once: true });
    mediaEl.addEventListener('canplay', applySavedState, { once: true });

    const saved = readMediaPlaybackState(message, resolvedRole);
    if (saved) {
      try {
        if ((mediaEl.getAttribute('preload') || '').toLowerCase() === 'none') {
          mediaEl.setAttribute('preload', saved.shouldResume ? 'auto' : 'metadata');
        }
        mediaEl.load?.();
      } catch (e) {}
      if (mediaEl.readyState >= 1) {
        requestAnimationFrame(applySavedState);
      }
    }
  }

  function pauseCurrentChatMediaPlayback() {
    if (!messagesEl) return;
    messagesEl.querySelectorAll('audio, video').forEach((mediaEl) => {
      const shouldResume = !mediaEl.paused && !mediaEl.ended;
      if (shouldResume) {
        mediaEl.__bananzaAutoPaused = true;
        const role = String(mediaEl.dataset.playbackRole || '').trim();
        const row = mediaEl.closest('.msg-row');
        const message = row?.__messageData || null;
        if (message && role) {
          writeMediaPlaybackState(message, role, {
            currentTime: Number(mediaEl.currentTime || 0),
            shouldResume: true,
          });
        }
      } else {
        captureBoundMediaPlaybackState(mediaEl);
      }
      try {
        mediaEl.pause?.();
      } catch (e) {
        mediaEl.__bananzaAutoPaused = false;
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════
  function clearRenderedMessages({ resetDisplayed = true } = {}) {
    setLoadMoreAfterLoading(false);
    messagesEl.replaceChildren(...buildMessagesRootChildren());
    if (resetDisplayed) {
      displayedMsgIds.clear();
      displayedPinEventIds.clear();
    }
  }

  function getRenderedMessageIdList() {
    return Array.from(messagesEl.querySelectorAll('.msg-row[data-msg-id]'))
      .filter((row) => row.dataset.outbox !== '1')
      .map((row) => Number(row.dataset.msgId || 0));
  }

  function renderedMessageIdsMatch(msgs = []) {
    const domIds = getRenderedMessageIdList();
    const nextIds = (Array.isArray(msgs) ? msgs : []).map((msg) => Number(msg?.id || 0));
    return domIds.length > 0
      && domIds.length === nextIds.length
      && domIds.every((id, index) => id === nextIds[index]);
  }

  function pinEventIdKey(id) {
    const key = String(id ?? '').trim();
    return key || '';
  }

  function rememberPinEvent(id) {
    const key = pinEventIdKey(id);
    if (key) displayedPinEventIds.add(key);
  }

  function isPinEventDisplayed(id) {
    const key = pinEventIdKey(id);
    return key ? displayedPinEventIds.has(key) : false;
  }

  function filterNewPinEvents(events = []) {
    const seen = new Set();
    return normalizePinEvents(events).filter((event) => {
      const key = pinEventIdKey(event.id);
      if (!key || seen.has(key) || isPinEventDisplayed(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function timelineTimestamp(item) {
    const value = item?.created_at || item?.createdAt || '';
    const time = value ? Date.parse(/[zZ]$|[+\-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`) : NaN;
    return Number.isFinite(time) ? time : 0;
  }

  function buildTimelineItems(msgs = [], pinEvents = []) {
    return [
      ...(Array.isArray(msgs) ? msgs : []).map((message) => ({ kind: 'message', message, created_at: message?.created_at })),
      ...normalizePinEvents(pinEvents).map((event) => ({ kind: 'pin-event', event, created_at: event.created_at })),
    ].sort((a, b) => {
      const byTime = timelineTimestamp(a) - timelineTimestamp(b);
      if (byTime) return byTime;
      if (a.kind !== b.kind) return a.kind === 'message' ? -1 : 1;
      const aId = Number(a.message?.id || a.event?.id || 0);
      const bId = Number(b.message?.id || b.event?.id || 0);
      return aId - bId;
    });
  }

  function renderPinSystemEvent(event) {
    const item = normalizePinEvent(event);
    if (!item || item.action !== 'pinned') return null;
    const row = document.createElement('div');
    row.className = 'pin-system-row';
    row.dataset.pinEventId = String(item.id);
    row.dataset.pinMessageId = String(item.message_id);
    row.dataset.chatId = String(item.chat_id);
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.title = 'Jump to pinned message';
    const actor = String(item.actor_name || 'Someone').trim() || 'Someone';
    const preview = String(item.message_preview || 'Pinned message').trim() || 'Pinned message';
    row.innerHTML = `
      <span class="pin-system-icon" aria-hidden="true">&#128204;</span>
      <span class="pin-system-copy"><strong>${esc(actor)}</strong> запинил(а): ${esc(preview)}</span>
    `;
    const jump = () => jumpToPinnedMessage({ chat_id: item.chat_id, message_id: item.message_id });
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      jump();
    });
    row.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      jump();
    });
    return row;
  }

  function buildMessagesFragment(msgs = [], pinEvents = [], options = {}) {
    const fragment = document.createDocumentFragment();
    let lastDate = null;
    let currentGroupBody = null;
    const items = buildTimelineItems(msgs, pinEvents);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const createdAt = item.created_at;
      const msgDate = formatDate(createdAt);
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        currentGroupBody = null;
        const sep = document.createElement('div');
        sep.className = 'date-separator';
        sep.innerHTML = `<span>${msgDate}</span>`;
        fragment.appendChild(sep);
      }

      if (item.kind === 'pin-event') {
        if (isPinEventDisplayed(item.event?.id)) continue;
        const systemRow = renderPinSystemEvent(item.event);
        if (!systemRow) continue;
        currentGroupBody = null;
        fragment.appendChild(systemRow);
        rememberPinEvent(item.event.id);
        continue;
      }

      const msg = item.message;
      if (isMessageDisplayed(msg?.id)) continue;
      const prevMessageItem = [...items.slice(0, i)].reverse().find((entry) => entry.kind === 'message');
      const prevMsg = prevMessageItem?.message || null;
      const sameUser = prevMsg && prevMsg.user_id === msg.user_id && formatDate(prevMsg.created_at) === msgDate;
      const isOwn = msg.user_id === currentUser.id;
      const useGroup = !isOwn || compactView;
      const startsGroup = useGroup && (!sameUser || !currentGroupBody);

      if (startsGroup) {
        const { group, body } = createMessageGroup(msg, isOwn);
        currentGroupBody = body;
        fragment.appendChild(group);
      }

      const showName = useGroup && startsGroup;
      const el = createMessageEl(msg, showName, options);
      if (useGroup) {
        currentGroupBody.appendChild(el);
      } else {
        currentGroupBody = null;
        fragment.appendChild(el);
      }
      rememberDisplayedMessage(msg.id);
    }

    return fragment;
  }

  function replaceRenderedMessages(msgs = [], pinEvents = [], options = {}) {
    displayedMsgIds.clear();
    displayedPinEventIds.clear();
    pendingMediaBottomScrollRows.clear();
    const fragment = buildMessagesFragment(Array.isArray(msgs) ? msgs : [], pinEvents, options);
    messagesEl.replaceChildren(...buildMessagesRootChildren(fragment));
    updateScrollBottomButton();
  }

  function primeAppendedMessageSideEffects(messages = []) {
    const list = Array.isArray(messages) ? messages : [];
    list.forEach((msg) => {
      try {
        if (window.messageCache) window.messageCache.upsertMessage(msg).catch(()=>{});
      } catch (e) {}
      try {
        if (msg?.file_type === 'image' && msg.file_stored && window.cacheAssets) {
          window.cacheAssets([getAttachmentPreviewUrl(msg)]).catch(()=>{});
        }
      } catch (e) {}
    });
    if (!loadingMoreAfter && list.length) updateHasMoreAfterFromChat(currentChatId);
  }

  function appendTimelineItems(msgs = [], pinEvents = [], options = {}) {
    const messages = filterNewMessages(msgs);
    const events = filterNewPinEvents(pinEvents);
    if (!events.length) {
      messages.forEach((message) => appendMessage(message, options));
      return;
    }
    const fragment = buildMessagesFragment(messages, events, options);
    if (fragment.childNodes.length) {
      insertAtMessagesEnd(fragment);
      markPendingMediaBottomScrollForMessages(messages, Boolean(options.mediaAutoScrollToBottom));
      primeAppendedMessageSideEffects(messages);
      cleanupDuplicateDateSeparators();
      updateScrollBottomButton();
    }
  }

  function appendPinEventIfVisible(event) {
    const item = normalizePinEvent(event);
    if (!item || item.action !== 'pinned' || Number(item.chat_id || 0) !== Number(currentChatId || 0)) return false;
    const wasNearBottom = isNearBottom(120);
    const anchor = wasNearBottom ? null : captureScrollAnchor();
    appendTimelineItems([], [item]);
    if (wasNearBottom) {
      scrollToBottom(false, true);
    } else if (anchor?.messageId) {
      requestAnimationFrame(() => restoreScrollAnchor(anchor, 1));
      saveCurrentScrollAnchor(currentChatId, { force: true });
    }
    return true;
  }

  function isCurrentMessageRow(row) {
    if (!row?.isConnected) return false;
    const rowChatId = Number(row.__messageData?.chat_id || row.__messageData?.chatId || currentChatId || 0);
    return !rowChatId || rowChatId === Number(currentChatId || 0);
  }

  function messageHasDeferredMediaLayout(msg) {
    if (!msg || Boolean(msg.is_video_note)) return false;
    return msg.file_type === 'image' || msg.file_type === 'video';
  }

  function clearPendingMediaBottomScroll(row) {
    if (!row) return;
    row.__autoScrollMediaToBottomOnLoad = false;
    pendingMediaBottomScrollRows.delete(row);
  }

  function noteMessageScrollUserIntent() {
    mediaBottomAutoScrollUserIntentAt = Date.now();
  }

  function scheduleMediaBottomScrollAnchorSave(chatId = currentChatId) {
    const targetChatId = Number(chatId || currentChatId || 0);
    if (!targetChatId) return;
    requestAnimationFrame(() => {
      if (pendingMediaBottomScrollRows.size) return;
      saveCurrentScrollAnchor(targetChatId, { force: true, allowPendingMedia: true });
    });
  }

  function settleDeferredMediaBottomScroll(chatId = currentChatId) {
    const targetChatId = Number(chatId || currentChatId || 0);
    if (!targetChatId) return;
    const guardOptions = { chatId: targetChatId };
    scrollToBottom(true, true, guardOptions);
    requestAnimationFrame(() => {
      scrollToBottom(true, true, guardOptions);
      setTimeout(() => {
        if (Number(currentChatId || 0) !== targetChatId) return;
        scrollToBottom(true, true, guardOptions);
        if (!pendingMediaBottomScrollRows.size) {
          saveCurrentScrollAnchor(targetChatId, { force: true, allowPendingMedia: true });
        }
      }, 80);
    });
  }

  function markPendingMediaBottomScroll(row, msg, enabled = false) {
    clearPendingMediaBottomScroll(row);
    if (!enabled || !messageHasDeferredMediaLayout(msg)) return;
    row.__autoScrollMediaToBottomOnLoad = true;
    pendingMediaBottomScrollRows.add(row);
  }

  function markPendingMediaBottomScrollForMessages(messages = [], enabled = false) {
    if (!enabled) return;
    const list = Array.isArray(messages) ? messages : [];
    list.forEach((msg) => {
      if (!messageHasDeferredMediaLayout(msg)) return;
      const row = messagesEl.querySelector(`.msg-row[data-msg-id="${Number(msg.id || 0)}"]`);
      if (row) markPendingMediaBottomScroll(row, msg, true);
    });
  }

  function cancelPendingMediaBottomScrollIfNeeded() {
    if (!pendingMediaBottomScrollRows.size || isNearBottom(8)) return;
    if (Date.now() - mediaBottomAutoScrollUserIntentAt > 450) return;
    for (const row of [...pendingMediaBottomScrollRows]) {
      clearPendingMediaBottomScroll(row);
    }
    scheduleMediaBottomScrollAnchorSave();
  }

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

  function renderMessages(msgs, pinEvents = []) {
    const existingFirst = messagesEl.querySelector('.date-separator, .pin-system-row, .msg-row, .msg-group');
    const fragment = buildMessagesFragment(msgs, pinEvents);
    if (existingFirst) messagesEl.insertBefore(fragment, existingFirst);
    else insertAtMessagesEnd(fragment);
    updateScrollBottomButton();
  }

  function appendMessage(msg, options = {}) {
    const msgDate = formatDate(msg.created_at);
    const isOwn = msg.user_id === currentUser.id;
    const useGroup = !isOwn || compactView;
    let lastChild = getMessagesLastContentChild();

    // Date separator: compare against last separator in DOM
    const seps = messagesEl.querySelectorAll('.date-separator');
    const lastSepDate = seps.length ? seps[seps.length - 1].textContent.trim() : null;
    if (lastSepDate !== msgDate) {
      const sep = document.createElement('div');
      sep.className = 'date-separator';
      sep.innerHTML = `<span>${msgDate}</span>`;
      insertAtMessagesEnd(sep);
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
      insertAtMessagesEnd(group);
    }

    const showName = useGroup && !sameGroup;
    const el = createMessageEl(msg, showName, options);

    if (useGroup) {
      groupBody.appendChild(el);
    } else {
      insertAtMessagesEnd(el);
    }
    rememberDisplayedMessage(msg.id);
    try {
      if (window.messageCache) window.messageCache.upsertMessage(msg).catch(()=>{});
    } catch (e) {}
    try {
      if (msg.file_type === 'image' && msg.file_stored && window.cacheAssets) {
        window.cacheAssets([getAttachmentPreviewUrl(msg)]).catch(()=>{});
      }
    } catch (e) {}
    if (!loadingMoreAfter) updateHasMoreAfterFromChat(currentChatId);
    updateScrollBottomButton();
  }

  function bindPollControls(row) {
    const messageId = Number(row?.dataset?.msgId || row?.__messageData?.id || 0);
    if (!row || !messageId) return;
    row.querySelectorAll('[data-poll-vote]').forEach((control) => {
      const activateVote = (e) => {
        if (control.matches(':disabled') || control.getAttribute('aria-disabled') === 'true') return;
        e.stopPropagation();
        togglePollVote(messageId, Number(control.dataset.pollOptionId || 0));
      };
      control.addEventListener('click', activateVote);
      if (!(control instanceof HTMLButtonElement)) {
        control.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          activateVote(e);
        });
      }
    });

    row.querySelectorAll('[data-poll-voters]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPollVotersModal(messageId, Number(btn.dataset.pollOptionId || 0));
      });
    });

    bindPulseInlineVoterControls(row, messageId);

    const pollCloseBtn = row.querySelector('[data-poll-close]');
    if (pollCloseBtn) {
      pollCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closePollMessage(messageId);
      });
    }
  }

  function createMessageEl(msg, showName = true, options = {}) {
    applyOwnReadStateToMessage(msg, msg?.chat_id || msg?.chatId || currentChatId);
    const isOwn = msg.user_id === currentUser.id;
    const isClientMessage = isClientSideMessage(msg);
    const normalizedPoll = normalizePoll(msg?.poll);
    const isPulsePollMessage = Boolean(!msg.is_deleted && normalizedPoll && isPulsePoll(normalizedPoll));
    const isMediaMessage = Boolean(
      !msg.is_deleted &&
      msg.file_id &&
      ['image', 'audio', 'video', 'document'].includes(msg.file_type)
    );
    const isEmojiOnly = Boolean(
      !msg.is_deleted &&
      !msg.poll &&
      !msg.is_voice_note &&
      !msg.file_id &&
      !msg.forwarded_from_display_name &&
      !msg.reply_to_id &&
      msg.text &&
      !(msg.previews && msg.previews.length) &&
      isSingleEmojiMessage(msg.text)
    );
    const isPollMessage = Boolean(!msg.is_deleted && msg.poll);
    const row = document.createElement('div');
    row.className = `msg-row ${isOwn ? 'own' : 'other'}${isEmojiOnly ? ' emoji-only-message' : ''}${isMediaMessage ? ' media-message' : ''}${isPollMessage ? ' poll-message' : ''}`;
    if (contextConvertPendingMessageIds.has(Number(msg.id || 0))) row.classList.add('context-convert-pending');
    row.dataset.msgId = msg.id;
    if (msg.client_id) row.dataset.clientId = msg.client_id;
    if (isClientMessage) row.dataset.outbox = '1';
    row.dataset.date = formatDate(msg.created_at);
    row.dataset.userId = msg.user_id;
    row.__messageData = { ...msg };
    markPendingMediaBottomScroll(row, msg, Boolean(options.mediaAutoScrollToBottom));
    row.__replyPayload = {
      id: msg.id,
      display_name: isOwn ? currentUser.display_name : msg.display_name,
      text: getReplyPreviewText(msg),
      is_voice_note: Boolean(msg.is_voice_note),
      is_video_note: Boolean(msg.is_video_note),
      ai_bot_id: Number(msg.ai_bot_id) || 0,
      ai_bot_mention: msg.ai_bot_mention || '',
      ai_bot_provider: msg.ai_bot_provider || '',
      ai_bot_kind: msg.ai_bot_kind || '',
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
        const textClasses = isPulsePollMessage ? 'msg-text poll-question-block' : 'msg-text';
        html += `<div class="${textClasses}">${isEmojiOnly ? esc(msg.text.trim()) : renderMessageText(msg.text, msg.mentions)}</div>`;
      }

      if (msg.poll) {
        html += renderPollCard(msg);
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
      if (msg.client_status) {
        const isFailedStatus = String(msg.client_status || '').toLowerCase() === 'failed';
        statusIcon = `<span class="msg-status ${isFailedStatus ? 'failed' : 'sending'}">${isFailedStatus ? '!' : '\u23f3'}</span>`;
      }
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
      if (canContextConvertMessage(msg)) html += `<button class="msg-context-convert-btn${contextConvertPendingMessageIds.has(Number(msg.id || 0)) ? ' is-pending' : ''}" title="Transform with AI">🍌</button>`;
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
    if (msg.client_status && String(msg.client_status || '').toLowerCase() === 'failed') row.classList.add('client-failed');
    if (msg.client_status && String(msg.client_status || '').toLowerCase() !== 'failed') row.classList.add('client-sending');
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

    const contextConvertBtn = row.querySelector('.msg-context-convert-btn');
    if (contextConvertBtn) bindContextConvertMessageButton(contextConvertBtn, row);

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

    bindPollControls(row);
    hydratePulseInlineVoters(row);

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
      let imageLayoutHandled = false;
      let imageLayoutRetryFrame = 0;
      const markWideImage = () => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        row.classList.toggle('wide-media-message', img.naturalWidth >= img.naturalHeight);
      };
      const finalizeImageLayout = () => {
        if (!row.isConnected) {
          if (imageLayoutRetryFrame) return;
          imageLayoutRetryFrame = requestAnimationFrame(() => {
            imageLayoutRetryFrame = 0;
            finalizeImageLayout();
          });
          return;
        }
        if (imageLayoutHandled) return;
        imageLayoutHandled = true;
        if (!isCurrentMessageRow(row)) {
          clearPendingMediaBottomScroll(row);
          return;
        }
        const rowChatId = Number(row.__messageData?.chat_id || row.__messageData?.chatId || currentChatId || 0);
        const shouldAutoScroll = Boolean(row.__autoScrollMediaToBottomOnLoad);
        const anchor = !shouldAutoScroll && !isNearBottom(8) ? captureScrollAnchor() : null;
        markWideImage();
        if (anchor) requestAnimationFrame(() => restoreScrollAnchor(anchor, 1));
        clearPendingMediaBottomScroll(row);
        if (shouldAutoScroll) settleDeferredMediaBottomScroll(rowChatId);
        else scheduleMediaBottomScrollAnchorSave(rowChatId);
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
      img.addEventListener('load', finalizeImageLayout);
      if (img.complete) finalizeImageLayout();
    }

    const expandBtn = row.querySelector('.msg-expand-btn');
    if (expandBtn && !msg.is_video_note) {
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
      if (!msg.is_voice_note) {
        bindMediaPlaybackState(audio, msg, 'attachment-audio');
      }
      audio.addEventListener('loadedmetadata', () => {
        const dur = formatDuration(audio.duration);
        const durEl = document.createElement('span');
        durEl.className = 'media-duration';
        durEl.textContent = dur;
        audio.parentElement.querySelector('div:last-child')?.prepend(durEl);
      });
    }
    const video = row.querySelector('video');
    if (video && !msg.is_video_note) {
      bindMediaPlaybackState(video, msg, 'attachment-video');
      const initialPosterUrl = getAttachmentPosterUrl(msg);
      if (initialPosterUrl) {
        applyPosterToVideoElement(video, initialPosterUrl);
      } else {
        ensureAttachmentPoster(msg, { videoEl: video }).catch(() => {});
      }
      let videoLayoutHandled = false;
      let videoLayoutRetryFrame = 0;
      const markWideVideo = () => {
        if (!video.videoWidth || !video.videoHeight) return;
        row.classList.toggle('wide-media-message', video.videoWidth >= video.videoHeight);
      };
      const finalizeVideoLayout = () => {
        if (!row.isConnected) {
          if (videoLayoutRetryFrame) return;
          videoLayoutRetryFrame = requestAnimationFrame(() => {
            videoLayoutRetryFrame = 0;
            finalizeVideoLayout();
          });
          return;
        }
        if (videoLayoutHandled) return;
        videoLayoutHandled = true;
        if (!isCurrentMessageRow(row)) {
          clearPendingMediaBottomScroll(row);
          return;
        }
        const rowChatId = Number(row.__messageData?.chat_id || row.__messageData?.chatId || currentChatId || 0);
        const shouldAutoScroll = Boolean(row.__autoScrollMediaToBottomOnLoad);
        const anchor = !shouldAutoScroll && !isNearBottom(8) ? captureScrollAnchor() : null;
        markWideVideo();
        if (anchor) requestAnimationFrame(() => restoreScrollAnchor(anchor, 1));
        const dur = formatDuration(video.duration);
        const durEl = document.createElement('span');
        durEl.className = 'media-duration';
        durEl.textContent = dur;
        video.parentElement.querySelector('div:last-child')?.prepend(durEl);
        clearPendingMediaBottomScroll(row);
        if (shouldAutoScroll) settleDeferredMediaBottomScroll(rowChatId);
        else scheduleMediaBottomScrollAnchorSave(rowChatId);
      };
      video.addEventListener('loadedmetadata', finalizeVideoLayout);
      if (video.readyState >= 1) finalizeVideoLayout();
    }

    window.BananzaVideoNoteHooks?.decorateMessageRow?.(row, msg);
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
        const statusValue = String(d.client_status || '').toLowerCase();
        const isSending = statusValue !== 'failed' || outboxSending.has(d.client_id || row.dataset.clientId || row.dataset.msgId);
        statusEl.className = `msg-status ${isSending ? 'sending' : 'failed'}`;
        statusEl.textContent = isSending ? '\u23f3' : '!';
        retryBtn.disabled = isSending;
        row.classList.toggle('client-failed', !isSending);
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

  function getMediaNoteFallbackLabel(msg, { voiceLabel = 'Голосовое сообщение', videoLabel = 'Видео-заметка' } = {}) {
    if (!msg?.is_voice_note) return '';
    return msg?.is_video_note ? videoLabel : voiceLabel;
  }

  function renderResolvedFileAttachment(msg) {
    const previewUrl = getAttachmentPreviewUrl(msg);
    const downloadUrl = getAttachmentDownloadUrl(msg) || previewUrl;
    const posterUrl = getAttachmentPosterUrl(msg);
    const posterAttr = posterUrl ? ` poster="${esc(posterUrl)}"` : '';
    switch (msg.file_type) {
      case 'image':
        return `<img class="msg-image" src="${previewUrl}" alt="${esc(msg.file_name)}">`;
      case 'audio':
        return `<div class="msg-audio">
          <div style="font-size:13px;margin-bottom:4px">рџЋµ ${esc(msg.file_name)}</div>
          <audio controls preload="none"><source src="${previewUrl}" type="${msg.file_mime}"></audio>
          <div style="font-size:11px;color:var(--text-secondary)">${formatSize(msg.file_size)} · <a href="${downloadUrl}" download="${esc(msg.file_name)}">Download</a></div>
        </div>`;
      case 'video':
        return `<div class="msg-video">
          <div class="msg-video-wrap">
            <video controls preload="metadata" playsinline${posterAttr}><source src="${previewUrl}" type="${msg.file_mime}"></video>
            <button class="msg-expand-btn" type="button" title="Fullscreen">&#x26F6;</button>
          </div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${esc(msg.file_name)} · ${formatSize(msg.file_size)} · <a href="${downloadUrl}" download="${esc(msg.file_name)}">Download</a></div>
        </div>`;
      default:
        return `<a class="msg-file" href="${downloadUrl}" download="${esc(msg.file_name)}">
          <div class="msg-file-icon">рџ“„</div>
          <div class="msg-file-info">
            <div class="msg-file-name">${esc(msg.file_name)}</div>
            <div class="msg-file-size">${formatSize(msg.file_size)}</div>
          </div>
        </a>`;
    }
  }

  function renderFileAttachment(msg) {
    const customVideoNoteAttachment = window.BananzaVideoNoteHooks?.renderAttachment?.(msg);
    if (customVideoNoteAttachment) return customVideoNoteAttachment;
    return renderResolvedFileAttachment(msg);
    const previewUrl = getAttachmentPreviewUrl(msg);
    const downloadUrl = getAttachmentDownloadUrl(msg) || previewUrl;
    switch (msg.file_type) {
      case 'image':
        return `<img class="msg-image" src="${previewUrl}" alt="${esc(msg.file_name)}">`;
      case 'audio':
        return `<div class="msg-audio">
          <div style="font-size:13px;margin-bottom:4px">🎵 ${esc(msg.file_name)}</div>
          <audio controls preload="none"><source src="${previewUrl}" type="${msg.file_mime}"></audio>
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
    if (isUiTransitionBusy()) {
      recoverySyncRequested = true;
      deferredRecoveryReason = fromPush ? 'push' : 'catch-up';
      return false;
    }

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
        const pinEvents = page.pinEvents || [];

        const memberLastReads = raw && raw.member_last_reads ? raw.member_last_reads : null;
        const readState = await reconcileChatReadState(id, memberLastReads, {
          replace: true,
          updateVisible: Number(currentChatId || 0) === id,
        });
        if (readState.chatReadChanged) renderChatList(chatSearch.value);

        applyOwnReadStateToMessages(id, msgs);
        if (Number(currentChatId || 0) !== id) return appendedAny;

        const newMessages = filterNewMessages(msgs);
        const newPinEvents = filterNewPinEvents(pinEvents);
        if (newMessages.length || newPinEvents.length) {
          appendTimelineItems(newMessages, newPinEvents, {
            mediaAutoScrollToBottom: Boolean(wasNearBottom && !document.hidden),
          });
          if (newMessages.length) updateChatListLastMessage(newMessages[newMessages.length - 1]);
          appendedAny = true;
        } else if (fromPush && msgs.length) {
          updateChatListLastMessage(msgs[msgs.length - 1]);
        }

        if (msgs.length) await cacheMessages(id, msgs, page);

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
      let cursor = firstId;
      let prependedAny = false;
      let scrollTopBefore = 0;
      let scrollHeightBefore = 0;

      for (let pageIndex = 0; pageIndex < PAGINATION_FETCH_MAX_PAGES; pageIndex += 1) {
        let page = await readCachedCursorPage(chatId, 'before', cursor);
        let msgs = page?.messages || [];
        if (!page) {
          const params = new URLSearchParams({ limit: String(PAGE_SIZE), meta: '1', before: String(cursor) });
          const raw = await api(`/api/chats/${chatId}/messages?${params}`);
          page = normalizeMessagesPage(raw);
          msgs = page.messages;
          const memberLastReads = raw && raw.member_last_reads ? raw.member_last_reads : null;
          const readState = await reconcileChatReadState(chatId, memberLastReads, {
            replace: true,
            updateVisible: currentChatId === chatId,
          });
          if (readState.chatReadChanged) renderChatList(chatSearch.value);
          cacheCursorPage(chatId, 'before', cursor, msgs, page);
        }
        applyOwnReadStateToMessages(chatId, msgs);
        if (currentChatId !== chatId) return;

        const hasMoreBeforeValue = page.hasMoreBefore ?? msgs.length >= PAGE_SIZE;
        setHasMoreBefore(hasMoreBeforeValue);

        const newMessages = filterNewMessages(msgs);
        const newPinEvents = filterNewPinEvents(page.pinEvents || []);
        if (newMessages.length || newPinEvents.length) {
          scrollTopBefore = messagesEl.scrollTop;
          scrollHeightBefore = messagesEl.scrollHeight;
          renderMessages(newMessages, newPinEvents);
          cleanupDuplicateDateSeparators();
          if (newMessages.length) await cacheMessages(chatId, msgs, page);
          prependedAny = true;
          break;
        }

        const fetchedFirstId = minMessageId(msgs);
        if (!fetchedFirstId || fetchedFirstId >= cursor || !hasMoreBeforeValue) break;
        cursor = fetchedFirstId;
      }

      if (prependedAny) {
        messagesEl.scrollTop = scrollTopBefore + (messagesEl.scrollHeight - scrollHeightBefore);
        saveCurrentScrollAnchor(currentChatId, { force: true });
        if (hasMore && messagesEl.scrollTop < PAGINATION_TOP_THRESHOLD) {
          requestAnimationFrame(() => maybeLoadMoreAtTop());
        }
      } else {
        updateScrollBottomButton();
      }
    } catch (e) {
      console.warn('[pagination] loadMore failed:', e?.message || e);
    }
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
    setLoadMoreAfterLoading(true);
    try {
      let cursor = lastId;
      let appendedAny = false;
      let bottomOffsetBefore = 0;

      for (let pageIndex = 0; pageIndex < PAGINATION_FETCH_MAX_PAGES; pageIndex += 1) {
        let page = await readCachedCursorPage(chatId, 'after', cursor);
        let msgs = page?.messages || [];
        if (!page) {
          const params = new URLSearchParams({ limit: String(PAGE_SIZE), meta: '1', after: String(cursor) });
          const raw = await api(`/api/chats/${chatId}/messages?${params}`);
          page = normalizeMessagesPage(raw);
          msgs = page.messages;
          const memberLastReads = raw && raw.member_last_reads ? raw.member_last_reads : null;
          const readState = await reconcileChatReadState(chatId, memberLastReads, {
            replace: true,
            updateVisible: currentChatId === chatId,
          });
          if (readState.chatReadChanged) renderChatList(chatSearch.value);
          cacheCursorPage(chatId, 'after', cursor, msgs, page);
        }

        applyOwnReadStateToMessages(chatId, msgs);
        if (currentChatId !== chatId) return;

        const hasMoreAfterValue = page.hasMoreAfter ?? msgs.length >= PAGE_SIZE;
        setHasMoreAfter(hasMoreAfterValue);

        const newMessages = filterNewMessages(msgs);
        const newPinEvents = filterNewPinEvents(page.pinEvents || []);
        if (newMessages.length || newPinEvents.length) {
          bottomOffsetBefore = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
          appendTimelineItems(newMessages, newPinEvents, {
            mediaAutoScrollToBottom: bottomOffsetBefore <= 8,
          });
          if (newMessages.length) await cacheMessages(chatId, msgs, page);
          appendedAny = true;
          break;
        }

        const fetchedLastId = maxMessageId(msgs);
        if (!fetchedLastId || fetchedLastId <= cursor || !hasMoreAfterValue) break;
        cursor = fetchedLastId;
      }

      if (appendedAny) {
        messagesEl.scrollTop = Math.max(0, messagesEl.scrollHeight - messagesEl.clientHeight - bottomOffsetBefore);
        saveCurrentScrollAnchor(currentChatId, { force: true });
        if (hasMoreAfter && isNearBottom(PAGINATION_BOTTOM_THRESHOLD)) {
          requestAnimationFrame(() => maybeLoadMoreAtBottom());
        }
      }
    } catch (e) {
      console.warn('[pagination] loadMoreAfter failed:', e?.message || e);
    }
    finally {
      loadingMoreAfter = false;
      setLoadMoreAfterLoading(false);
      updateScrollBottomButton();
    }
  }

  function isNearBottom(threshold = 150) {
    return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < threshold;
  }

  function scrollToBottom(instant = false, markRead = false, options = {}) {
    const guardChatId = Number(options.chatId || currentChatId || 0);
    const guardSeq = Number(options.openSeq || 0);
    const isGuardCurrent = () => (
      (!guardChatId || Number(currentChatId || 0) === guardChatId)
      && (!guardSeq || Number(chatOpenSeq || 0) === guardSeq)
    );
    requestAnimationFrame(() => {
      if (!isGuardCurrent()) return;
      messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: instant ? 'instant' : 'smooth' });
      if (scrollBottomBtn) scrollBottomBtn.classList.remove('visible');
      requestAnimationFrame(() => {
        if (isGuardCurrent()) updateScrollBottomButton();
      });
      if (!instant) setTimeout(() => {
        if (isGuardCurrent()) updateScrollBottomButton();
      }, 260);
      if (hasMoreAfter) setTimeout(() => {
        if (isGuardCurrent()) maybeLoadMoreAtBottom();
      }, instant ? 0 : 320);
      if (markRead) setTimeout(() => {
        if (isGuardCurrent()) markCurrentChatReadIfAtBottom(true);
      }, instant ? 0 : 320);
    });
  }

  function suppressScrollBottomFollowupClick(ms = 520) {
    scrollBottomFollowupClickSuppressUntil = Math.max(scrollBottomFollowupClickSuppressUntil, Date.now() + ms);
  }

  function activateScrollBottomButton() {
    if (!scrollBottomBtn) return false;
    scrollBottomBtn.blur();
    scrollToBottom(false, true);
    return true;
  }

  function shouldPreserveKeyboardForScrollBottomGesture(e) {
    if (!scrollBottomBtn || window.innerWidth > 768) return false;
    if (!isMobileComposerKeyboardOpen()) return false;
    if (e?.type === 'pointerdown' || e?.type === 'pointerup') {
      if (typeof e.button === 'number' && e.button !== 0) return false;
      if (e.pointerType === 'mouse') return false;
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  function getReplySnapshot(source = replyTo) {
    if (!source?.id) return null;
    return {
      id: source.id,
      display_name: source.display_name || source.displayName || '',
      text: source.text || '',
      is_voice_note: Boolean(source.is_voice_note),
      is_video_note: Boolean(source.is_video_note),
      ai_bot_id: Number(source.ai_bot_id) || 0,
      ai_bot_mention: source.ai_bot_mention || '',
      ai_bot_provider: source.ai_bot_provider || '',
      ai_bot_kind: source.ai_bot_kind || '',
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
    const isVideoNote = item.kind === 'video_note';
    const mediaNote = isVideoNote ? (item.videoNote || {}) : (item.voice || {});
    const fileBlob = (isVoice || isVideoNote) ? mediaNote.blob : attachment?.file;
    const posterBlob = isVideoNote ? (mediaNote.posterBlob || attachment?.posterBlob || null) : (attachment?.posterBlob || null);
    const localUrl = serverMeta?.stored_name ? '' : getOutboxObjectUrl(item.clientId, fileBlob, attachment?.localId || (isVideoNote ? 'video-note' : 'file'));
    const localPosterUrl = posterBlob ? getOutboxObjectUrl(item.clientId, posterBlob, `${attachment?.localId || (isVideoNote ? 'video-note' : 'file')}-poster`) : '';
    const fileName = serverMeta?.original_name || attachment?.name || mediaNote.name || (isVideoNote ? 'video-note.webm' : 'voice-note.wav');
    const fileSize = serverMeta?.size || attachment?.size || fileBlob?.size || 0;
    const fileMime = serverMeta?.mime_type || attachment?.mime || mediaNote.mime || (isVideoNote ? 'video/webm' : 'audio/wav');
    const fileType = serverMeta?.type || attachment?.type || (isVideoNote ? 'video' : (isVoice ? 'audio' : null));
    const hasPoster = Boolean(
      localPosterUrl
      || serverMeta?.poster_available
      || serverMeta?.posterAvailable
      || (fileType === 'video' && posterBlob)
    );
    const reply = item.reply || null;

    return {
      id: item.clientId,
      client_id: item.clientId,
      client_status: item.status || 'queued',
      is_outbox: true,
      chat_id: item.chatId,
      user_id: currentUser.id,
      username: currentUser.username,
      display_name: currentUser.display_name,
      avatar_color: currentUser.avatar_color,
      avatar_url: currentUser.avatar_url,
      text: item.text || null,
      file_id: (attachment || isVoice || isVideoNote || serverMeta) ? (item.serverFileId || item.clientId) : null,
      file_name: fileName,
      file_stored: serverMeta?.stored_name || null,
      client_file_url: localUrl,
      client_poster_url: localPosterUrl,
      file_mime: fileMime,
      file_size: fileSize,
      file_type: fileType,
      file_poster_available: hasPoster,
      reply_to_id: item.replyToId || null,
      reply_display_name: reply?.display_name || null,
      reply_text: reply?.text || null,
      reply_is_voice_note: reply?.is_voice_note ? 1 : 0,
      reply_note_kind: reply?.is_video_note ? 'video_note' : (reply?.is_voice_note ? 'voice' : null),
      created_at: item.createdAt,
      is_read: false,
      reactions: [],
      previews: [],
      is_deleted: false,
      is_voice_note: isVoice || isVideoNote,
      is_video_note: isVideoNote,
      media_note_kind: isVideoNote ? 'video_note' : (isVoice ? 'voice' : null),
      voice_duration_ms: (isVoice || isVideoNote) ? mediaNote.durationMs : null,
      video_note_shape_id: isVideoNote ? mediaNote.shapeId || 'banana-fat' : null,
      video_note_shape_snapshot: isVideoNote ? mediaNote.shapeSnapshot || null : null,
      transcription_status: 'idle',
      transcription_text: '',
      transcription_provider: '',
      transcription_model: '',
      transcription_error: '',
      ai_response_mode_hint: item.aiResponseModeHint || null,
      ai_document_format_hint: item.aiDocumentFormatHint || null,
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
    item.status = item.status || 'queued';
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
    if (attachment.posterBlob) {
      fd.append('poster', attachment.posterBlob, 'video-poster.jpg');
    }
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
        aiImageRiskAccepted: Boolean(item.aiImageRiskAccepted),
        ai_response_mode_hint: item.aiResponseModeHint || null,
        ai_document_format_hint: item.aiDocumentFormatHint || null,
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

  async function sendOutboxVideoNoteItem(item) {
    const videoNote = item.videoNote || {};
    if (!videoNote.blob || !videoNote.audioBlob) throw new Error('Video note is not available locally');
    const normalizedVideoMime = String(videoNote.mime || 'video/webm').split(';')[0].trim().toLowerCase() || 'video/webm';
    const formData = new FormData();
    formData.append('video', videoNote.blob, videoNote.name || `video-note-${Date.now()}.webm`);
    formData.append('audio', videoNote.audioBlob, videoNote.audioName || `video-note-${Date.now()}.wav`);
    if (videoNote.posterBlob) {
      formData.append('poster', videoNote.posterBlob, 'video-note-poster.jpg');
    }
    formData.append('durationMs', String(videoNote.durationMs || 0));
    formData.append('sampleRate', String(videoNote.sampleRate || 16000));
    formData.append('videoMime', normalizedVideoMime);
    formData.append('client_id', item.clientId);
    formData.append('shapeId', String(videoNote.shapeId || 'banana-fat'));
    formData.append('shapeSnapshot', JSON.stringify(videoNote.shapeSnapshot || null));
    if (item.replyToId) formData.append('replyToId', String(item.replyToId));
    return api(`/api/chats/${item.chatId}/video-note`, {
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
      appendMessage(serverMsg, { mediaAutoScrollToBottom: true });
    }
    updateScrollBottomButton();
    if (Number(serverMsg.chat_id) === Number(currentChatId)) {
      requestAnimationFrame(() => {
        scrollToBottom();
        requestAnimationFrame(() => scrollToBottom());
      });
    }
  }

  async function trySendOutboxItem(rawItem) {
    const latest = await window.messageCache?.getOutboxItem?.(rawItem.chatId, rawItem.clientId);
    const item = latest || rawItem;
    if (!item?.clientId || outboxSending.has(item.clientId)) return;
    item.status = 'sending';
    await persistOutboxItem(item);
    setOutboxSending(item.clientId, true);
    try {
      const serverMsg = item.kind === 'voice'
        ? await sendOutboxVoiceItem(item)
        : item.kind === 'video_note'
          ? await sendOutboxVideoNoteItem(item)
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

  function createMessageOutboxItem({
    text = null,
    attachment = null,
    reply = null,
    createdAt = null,
    aiImageRiskAccepted = false,
    aiResponseModeHint = null,
    aiDocumentFormatHint = null,
  } = {}) {
    const clientId = makeClientId('c');
    return {
      clientId,
      chatId: currentChatId,
      userId: currentUser.id,
      status: 'queued',
      kind: 'message',
      createdAt: createdAt || new Date().toISOString(),
      text: text || null,
      aiImageRiskAccepted: Boolean(aiImageRiskAccepted),
      aiResponseModeHint: aiResponseModeHint || null,
      aiDocumentFormatHint: aiDocumentFormatHint || null,
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
      status: 'queued',
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

  async function queueVideoNoteOutbox({
    videoBlob,
    audioBlob,
    posterBlob,
    durationMs,
    sampleRate,
    videoMime,
    shapeId,
    shapeSnapshot,
    replyTo: suppliedReply,
  } = {}) {
    if (!currentChatId || !videoBlob || !audioBlob) return null;
    const reply = getReplySnapshot(suppliedReply || replyTo);
    const clientId = makeClientId('c');
    const videoName = `video-note-${Date.now()}.webm`;
    const audioName = `video-note-${Date.now()}.wav`;
    const item = {
      clientId,
      chatId: currentChatId,
      userId: currentUser.id,
      status: 'queued',
      kind: 'video_note',
      createdAt: new Date().toISOString(),
      text: null,
      replyToId: reply?.id || null,
      reply,
      attachments: [{
        localId: 'video-note',
        file: videoBlob,
        name: videoName,
        size: videoBlob.size || 0,
        mime: videoMime || 'video/webm',
        type: 'video',
        posterBlob: posterBlob || null,
      }],
      videoNote: {
        blob: videoBlob,
        audioBlob,
        posterBlob: posterBlob || null,
        name: videoName,
        audioName,
        durationMs,
        sampleRate,
        mime: videoMime || 'video/webm',
        shapeId: shapeId || 'banana-fat',
        shapeSnapshot: shapeSnapshot || null,
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
      const preserveAnchor = captureScrollAnchor();
      applyMessageUpdate(updated, { preserveAnchor });
      clearEdit({ clearInput: true });
      if (preserveAnchor?.messageId) {
        requestAnimationFrame(() => {
          restoreScrollAnchor(preserveAnchor, 2);
          saveCurrentScrollAnchor(currentChatId, { force: true });
        });
      } else {
        saveCurrentScrollAnchor(currentChatId, { force: true });
      }
      loadChats().catch(() => {});
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
    const replySnapshot = getReplySnapshot();
    const composerAiOverride = getComposerAiOverridePayload();
    let aiImageRiskAccepted = false;
    if (text) {
      try {
        let risk;
        const forcedUniversalGrokImage = composerAiOverride.ai_response_mode_hint === 'image'
          && String(composerAiOverride.ai_override_target?.bot_provider || '').toLowerCase() === 'grok'
          && isUniversalBotTarget(composerAiOverride.ai_override_target);
        if (forcedUniversalGrokImage && aiImageRiskApi?.analyzeAiImageRisk) {
          const prompt = stripTriggeredBotMention(text, composerAiOverride.ai_override_target);
          risk = prompt
            ? { ...aiImageRiskApi.analyzeAiImageRisk(prompt), prompt, target: composerAiOverride.ai_override_target }
            : { risky: false, matches: [], prompt: '', target: composerAiOverride.ai_override_target };
        } else {
          risk = await analyzeOutgoingGrokImageRisk(text, replySnapshot);
        }
        if (risk.risky) {
          const confirmed = await openGrokImageRiskConfirm(risk.matches);
          if (!confirmed) return;
          aiImageRiskAccepted = true;
        }
      } catch (e) {
        console.warn('[grok-image-risk] precheck failed:', e?.message || e);
      }
    }
    animateSendButton();
    msgInput.value = '';
    autoResize();
    syncMentionOpenButton();
    clearPendingFile();
    clearReply();
    window.BananzaVoiceHooks?.refreshComposerState?.();
    scheduleMobileViewportRecovery();

    const items = [];
    const firstAttachment = filesToSend[0] || null;
    items.push(createMessageOutboxItem({
      text: text || null,
      attachment: firstAttachment,
      reply: replySnapshot,
      createdAt: new Date().toISOString(),
      aiImageRiskAccepted,
      aiResponseModeHint: composerAiOverride.ai_response_mode_hint || null,
      aiDocumentFormatHint: composerAiOverride.ai_document_format_hint || null,
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
    if (
      String(activeMessageActionsRow?.dataset?.msgId || '') === String(msgId)
      || String(reactionPickerMsgId || '') === String(msgId)
    ) {
      hideFloatingMessageActions({ immediate: true });
    }
    if (editTo?.id === msgId) clearEdit({ clearInput: true });
    el.querySelectorAll('audio, video').forEach((media) => {
      try {
        media.pause?.();
        media.currentTime = 0;
      } catch (e) {}
    });

    const previousMessage = el.__messageData ? { ...el.__messageData } : null;
    const deletedPreviewText = 'Message deleted';
    const deletedMessage = {
      ...(previousMessage || {}),
      id: Number(previousMessage?.id || msgId || 0),
      chat_id: Number(previousMessage?.chat_id || previousMessage?.chatId || targetChatId || activeChatId || 0),
      user_id: Number(previousMessage?.user_id || el.dataset.userId || 0),
      is_deleted: true,
      text: deletedPreviewText,
      file_id: null,
      file_name: null,
      file_stored: null,
      file_type: null,
      file_mime: null,
      file_size: null,
      client_file_url: '',
      client_poster_url: '',
      file_poster_available: false,
      previews: [],
      reactions: [],
      edited_at: null,
      poll: null,
      is_voice_note: false,
      is_video_note: false,
      voice_duration_ms: null,
      media_note_duration_ms: null,
      transcription_status: 'idle',
      transcription_text: '',
      transcription_provider: '',
      transcription_model: '',
      transcription_error: '',
      client_status: null,
    };

    let replaced = false;
    try {
      replaced = replaceRenderedMessage(deletedMessage);
    } catch (e) {
      console.warn('[markDeleted] rerender failed for', msgId, e);
    }

    if (!replaced) {
      const bubble = el.querySelector('.msg-bubble');
      if (!bubble) {
        console.warn('[markDeleted] bubble not found');
        return;
      }
      const timeEl = bubble.querySelector('.msg-time');
      const timeText = timeEl ? timeEl.textContent : '';
      bubble.innerHTML = `<span class="msg-deleted">Message deleted</span><span class="msg-time">${esc(timeText)}</span>`;
      el.classList.remove('video-note-row', 'video-note-playing', 'media-message', 'poll-message', 'emoji-only-message', 'client-failed', 'client-sending');
      delete el.dataset.clientStatus;
      el.__messageData = deletedMessage;
      el.__voiceMessage = null;
      if (el.__replyPayload) {
        el.__replyPayload = {
          ...el.__replyPayload,
          text: deletedPreviewText,
          is_voice_note: false,
          is_video_note: false,
        };
      }
      el.querySelector('.msg-reply-btn')?.remove();
      el.querySelector('.msg-react-btn')?.remove();
      el.querySelector('.msg-edit-btn')?.remove();
      el.querySelector('.msg-context-convert-btn')?.remove();
      el.querySelector('.msg-save-note-btn')?.remove();
      el.querySelector('.msg-forward-btn')?.remove();
      el.querySelector('.msg-actions')?.remove();
    } else {
      const replacement = messagesEl.querySelector(`[data-msg-id="${msgId}"]`);
      if (replacement?.__replyPayload) {
        replacement.__replyPayload = {
          ...replacement.__replyPayload,
          text: deletedPreviewText,
          is_voice_note: false,
          is_video_note: false,
        };
      }
    }

    updateVisibleReplyQuotesFromMessage(deletedMessage);
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

  function applyMessageUpdate(msg, options = {}) {
    if (!msg?.id) return;
    updateVisibleReplyQuotesFromMessage(msg);
    applyOwnReadStateToMessage(msg, msg.chat_id || currentChatId);
    try { if (window.messageCache) window.messageCache.upsertMessage(msg).catch(()=>{}); } catch (e) {}
    if (msg.chat_id !== currentChatId) return;
    replaceRenderedMessage(msg, options);
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
      if (f.size > MAX_FILE_SIZE) { alert(`File too large: ${f.name} (max ${MAX_FILE_SIZE_LABEL})`); return; }
    }

    pendingFiles = (await Promise.all(files.map((file) => localAttachmentFromFile(file)))).filter(Boolean);
    pendingFile = pendingFiles[0] || null;
    renderPendingFiles();
    msgInput.focus();
    updateComposerAiOverrideState().catch(() => {});
    refreshPollComposerActionState();
    window.BananzaVoiceHooks?.refreshComposerState?.();
    scheduleMobileViewportRecovery();
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
    refreshPollComposerActionState();
    window.BananzaVoiceHooks?.refreshComposerState?.();
    scheduleMobileViewportRecovery();
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

  function getReplyPreviewText(msg) {
    if (msg?.text) return msg.text.substring(0, 100);
    if (msg?.is_voice_note) {
      const transcript = (msg.transcription_text || '').trim();
      return transcript ? transcript.substring(0, 100) : getMediaNoteFallbackLabel(msg);
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
    if (!isVoiceReply) return 'Attachment';
    return getMediaNoteFallbackLabel({
      is_voice_note: true,
      is_video_note: Boolean(sourceRow?.__messageData?.is_video_note || msg?.reply_note_kind === 'video_note'),
    });
  }

  function canEditMessage(msg) {
    if (!currentUser || !msg || msg.is_deleted) return false;
    if (isClientSideMessage(msg)) return false;
    if (isPollMessage(msg)) return false;
    if (!currentUser.is_admin && msg.user_id !== currentUser.id) return false;
    return Boolean(msg.is_voice_note || msg.file_id || msg.text);
  }

  function canForwardMessage(msg) {
    if (!currentUser || !msg || msg.is_deleted) return false;
    if (isClientSideMessage(msg)) return false;
    if (isPollMessage(msg)) return false;
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

  function isSelectableMessageTextTarget(target) {
    return Boolean(target?.closest?.(
      '.msg-text, .msg-forwarded, .msg-reply-text, .msg-file-name, .msg-file-size, .link-preview'
    ));
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
    setReply(payload.id, payload.display_name, payload.text, payload);
  }

  function setReply(id, name, text, meta = null) {
    if (editTo) clearEdit({ clearInput: true });
    replyTo = {
      id,
      display_name: name,
      text,
      is_voice_note: Boolean(meta?.is_voice_note),
      is_video_note: Boolean(meta?.is_video_note),
      ai_bot_id: Number(meta?.ai_bot_id) || 0,
      ai_bot_mention: meta?.ai_bot_mention || '',
      ai_bot_provider: meta?.ai_bot_provider || '',
      ai_bot_kind: meta?.ai_bot_kind || '',
    };
    replyBarName.textContent = name;
    replyBarText.textContent = text || '📎 Attachment';
    replyBar.classList.remove('edit-bar');
    replyBar.classList.remove('hidden');
    msgInput.focus();
  }

  function clearReply() {
    replyTo = null;
    if (!editTo) replyBar.classList.add('hidden');
    queueIosViewportLayoutSync();
    updateComposerAiOverrideState().catch(() => {});
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
    refreshPollComposerActionState();
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
    refreshPollComposerActionState();
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
        safeVibrate(18);
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

  function queueSearchPanelPendingAction(action) {
    if (typeof action !== 'function') return false;
    if (typeof searchPanelPendingAction !== 'function') {
      searchPanelPendingAction = action;
      return true;
    }
    const previousAction = searchPanelPendingAction;
    searchPanelPendingAction = () => {
      try {
        previousAction();
      } finally {
        action();
      }
    };
    return true;
  }

  function shouldAutoFocusSearchInput() {
    return true;
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
    blurFocusedElementWithin(searchPanel);
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

  function openSearchPanel(options = {}) {
    if (!searchPanel) return;
    const focusInput = Object.prototype.hasOwnProperty.call(options, 'focusInput')
      ? Boolean(options.focusInput)
      : shouldAutoFocusSearchInput();
    const suppressFollowupClick = Boolean(options.suppressFollowupClick);
    if (suppressFollowupClick) suppressSearchPanelFollowupClick();
    closeMobileComposerTransientUi({ immediate: true });
    dismissMobileComposer({ forceRecovery: true, reason: 'search-panel' });
    ensureSearchPanelReady();
    if (isSearchPanelOpen() && !searchPanel.classList.contains('is-closing')) {
      if (focusInput) focusSearchInput();
      return;
    }
    clearSearchPanelTransitionState();
    clearTimeout(searchDebounce);
    searchDebounce = null;
    searchRequestSeq += 1;
    searchPanelPendingAction = null;
    searchPanelReturnFocusEl = getMobileComposerSafeReturnFocusEl($('#searchBtn'));
    searchAllChats = false;
    renderSearchScopeToggle();
    if (searchInput) searchInput.value = '';
    clearSearchResults();
    searchPanel.setAttribute('aria-hidden', 'false');
    searchPanel.classList.remove('is-open', 'is-closing');
    forceIosAnimationMount(searchPanel, searchPanelSheet);
    updateSearchTriggerState(true);
    if (focusInput && window.innerWidth <= 768) focusSearchInput();
    if (!searchPanelHistoryPushed) {
      history.pushState({ ...(history.state || {}), searchPanel: true }, '');
      searchPanelHistoryPushed = true;
    }
    searchPanelOpenFrame = requestAnimationFrame(() => {
      searchPanel.classList.add('is-open');
      searchPanelOpenFrame = null;
      if (focusInput) {
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
      typingBar.replaceChildren();
      return;
    }

    const label = document.createElement('span');
    label.className = 'typing-bar-label';
    label.textContent = names.length === 1
      ? `${names[0]} печатает`
      : `${names.join(', ')} печатают`;

    const dots = document.createElement('span');
    dots.className = 'typing-bar-dots';
    dots.setAttribute('aria-hidden', 'true');

    for (let i = 0; i < 3; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'typing-bar-dot';
      dot.textContent = '.';
      dots.appendChild(dot);
    }

    typingBar.classList.remove('hidden');
    typingBar.replaceChildren(label, dots);
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
    syncEmojiPickerButton();

    const isEmojiPickerScrollSurface = (target) => Boolean(
      target instanceof Element
      && (target.classList.contains('emoji-grid') || target.classList.contains('emoji-tabs'))
    );
    const keepEmojiPickerInteractionFromBlurringInput = (e) => {
      if (e.type === 'touchstart' || e.type === 'touchmove') return;
      if (isEmojiPickerScrollSurface(e.target)) return;
      if (shouldKeepEmojiPickerKeyboard()) preventMobileComposerBlur(e);
    };

    emojiPicker.addEventListener('pointerdown', (e) => {
      keepEmojiPickerInteractionFromBlurringInput(e);
      e.stopPropagation();
    });
    emojiPicker.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    }, { passive: true });
    emojiPicker.addEventListener('touchmove', (e) => {
      e.stopPropagation();
    }, { passive: true });
    emojiPicker.addEventListener('mousedown', (e) => {
      keepEmojiPickerInteractionFromBlurringInput(e);
      if (!isEmojiPickerScrollSurface(e.target)) e.preventDefault();
      e.stopPropagation();
    });

    emojiPicker.addEventListener('click', (e) => {
      e.stopPropagation();
      const tab = e.target.closest('.emoji-tab');
      if (tab) {
        emojiPicker.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const grid = emojiPicker.querySelector('.emoji-grid');
        const emojis = EMOJIS[cats[+tab.dataset.cat]];
        grid.innerHTML = emojis.map(em => `<div class="emoji-item">${em}</div>`).join('');
        positionEmojiPicker();
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
        if (window.innerWidth > 768 || shouldKeepEmojiPickerKeyboard()) {
          focusComposerKeepKeyboard(true);
        }
      }
    });
  }

  function syncEmojiPickerButton() {
    if (!emojiBtn) return;
    const isOpen = Boolean(emojiPickerOpen && isFloatingSurfaceVisible(emojiPicker));
    emojiBtn.classList.toggle('is-open', isOpen);
    emojiBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  function positionEmojiPicker(anchorEl = emojiPickerAnchorEl || emojiBtn) {
    if (!(emojiPicker instanceof HTMLElement) || !isFloatingSurfaceVisible(emojiPicker)) return;
    const anchor = anchorEl instanceof HTMLElement ? anchorEl : emojiBtn;
    if (!(anchor instanceof HTMLElement)) return;
    const rect = anchor.getBoundingClientRect();
    const viewport = getFloatingViewportRect();
    const desiredWidth = window.innerWidth <= 768 ? 300 : 340;
    const width = Math.min(desiredWidth, Math.max(180, viewport.width - 16));
    emojiPicker.style.width = `${Math.round(width)}px`;
    const pickerSize = measureFloatingSurface(
      emojiPicker,
      width,
      Math.min(320, Math.max(180, viewport.height - 16))
    );
    const left = clamp(
      rect.left + viewport.left + ((rect.width - pickerSize.width) / 2),
      viewport.left + 8,
      viewport.right - pickerSize.width - 8
    );
    const top = clamp(
      rect.top + viewport.top - pickerSize.height - 8,
      viewport.top + 8,
      viewport.bottom - pickerSize.height - 8
    );
    positionFloatingElement(emojiPicker, left, top);
  }

  function openEmojiPicker(anchorEl = emojiBtn, { keepKeyboardOpen } = {}) {
    if (!(emojiPicker instanceof HTMLElement)) return false;
    const keyboardAttached = typeof keepKeyboardOpen === 'boolean'
      ? keepKeyboardOpen
      : (window.innerWidth > 768 || isMobileComposerKeyboardOpen());
    emojiPickerAnchorEl = anchorEl instanceof HTMLElement ? anchorEl : emojiBtn;
    emojiPickerKeyboardAttached = keyboardAttached;
    emojiPickerOpen = true;
    openFloatingSurface(emojiPicker);
    syncEmojiPickerButton();
    positionEmojiPicker(emojiPickerAnchorEl);
    requestAnimationFrame(() => positionEmojiPicker(emojiPickerAnchorEl));
    stabilizeEmojiPickerKeyboardOnOpen(keyboardAttached);
    return true;
  }

  function closeEmojiPicker({ immediate = false } = {}) {
    emojiPickerOpen = false;
    clearEmojiPickerKeyboardOpenStabilizer();
    syncEmojiPickerButton();
    return closeFloatingSurface(emojiPicker, {
      immediate,
      onAfterClose: () => {
        emojiPickerKeyboardAttached = false;
        emojiPickerAnchorEl = null;
        if (emojiPicker instanceof HTMLElement) {
          emojiPicker.style.left = '';
          emojiPicker.style.top = '';
          emojiPicker.style.width = '';
        }
        syncEmojiPickerButton();
      },
    });
  }

  function toggleEmojiPicker(anchorEl = emojiBtn, options = {}) {
    if (isFloatingSurfaceVisible(emojiPicker)) {
      closeEmojiPicker();
      return false;
    }
    openEmojiPicker(anchorEl, options);
    return true;
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
  let galleryItems = []; // { id, chatId, src, type, fileName, fileMime, fileSize, posterSrc, message }
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
  const pendingMediaBottomScrollRows = new Set();
  let mediaBottomAutoScrollUserIntentAt = 0;
  let galleryEdgeToastTimer = null;
  let galleryEdgeBounceTimer = null;
  let ivScale = 1, ivPanX = 0, ivPanY = 0;
  let mediaViewerSuppressClickUntil = 0;
  let mediaViewerFollowupClickSuppressUntil = 0;
  const IMAGE_VIEWER_DOUBLE_TAP_DELAY_MS = 300;
  const IMAGE_VIEWER_TAP_MAX_DRIFT_PX = 14;
  const IMAGE_VIEWER_DOUBLE_TAP_DISTANCE_PX = 40;
  const IMAGE_VIEWER_SWIPE_START_PX = 6;
  const IMAGE_VIEWER_SWIPE_COMMIT_PX = 50;
  const IMAGE_VIEWER_MAX_SCALE = 5;
  const ivTouchState = {
    activeTouchId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    dx: 0,
    dragging: false,
    tapCandidate: false,
    canTapZoom: false,
    panBaseX: 0,
    panBaseY: 0,
    pinching: false,
    pinchDist0: 0,
    pinchMidpoint0X: 0,
    pinchMidpoint0Y: 0,
    pinchBasePanX: 0,
    pinchBasePanY: 0,
    pinchAnchorX: 0,
    pinchAnchorY: 0,
    scaleBase: 1,
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
  };
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
    const rowChatId = Number(row?.__messageData?.chat_id || row?.__messageData?.chatId || currentChatId || 0);
    if (rowChatId && window.messageCache?.patchMessage) {
      window.messageCache.patchMessage(rowChatId, msgId, { reactions: Array.isArray(reactions) ? reactions : [] }).catch(() => {});
    }
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
    forceIosAnimationMount(el, el.querySelector('.chat-context-menu-sheet'));
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
    const row = reactionPickerMsgId ? messagesEl.querySelector(`[data-msg-id="${reactionPickerMsgId}"]`) : null;
    const canConvert = canContextConvertMessage(row?.__messageData, row);
    reactionPicker.innerHTML = `
      <div class="reaction-picker-strip">
        ${renderQuickReactionButtonsHtml({ buttonClass: 'reaction-picker-button', moreAction: 'open-emoji-popover' })}
        ${canConvert ? `<button type="button" class="reaction-picker-button msg-context-convert-btn${contextConvertPendingMessageIds.has(Number(reactionPickerMsgId || 0)) ? ' is-pending' : ''}" data-reaction-action="context-convert" title="Transform with AI">🍌</button>` : ''}
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

  function galleryItemFromMessage(msg, fallbackSrc = '', fallbackPoster = '') {
    if (msg?.is_video_note) return null;
    const type = msg?.file_type === 'video' ? 'video' : (msg?.file_type === 'image' ? 'image' : '');
    const src = normalizeGallerySrc(fallbackSrc || getAttachmentPreviewUrl(msg));
    const posterSrc = type === 'video'
      ? normalizeGallerySrc(fallbackPoster || getAttachmentPosterUrl(msg))
      : '';
    if (!type || !src) return null;
    return {
      id: Number(msg.id || 0),
      chatId: Number(msg.chat_id || msg.chatId || currentChatId || 0),
      src,
      type,
      posterSrc,
      fileName: msg.file_name || '',
      fileMime: msg.file_mime || '',
      fileSize: Number(msg.file_size || 0),
      message: msg && typeof msg === 'object' ? msg : null,
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
      const poster = isImage ? '' : (el.getAttribute('poster') || el.poster || '');
      const fallback = {
        ...(row?.__messageData || {}),
        id: Number(row?.dataset.msgId || row?.__messageData?.id || 0),
        chat_id: row?.__messageData?.chat_id || row?.__messageData?.chatId || currentChatId,
        file_type: row?.__messageData?.file_type || (isImage ? 'image' : 'video'),
        file_name: row?.__messageData?.file_name || el.getAttribute('alt') || '',
        file_mime: row?.__messageData?.file_mime || el.querySelector?.('source')?.getAttribute('type') || '',
      };
      const item = galleryItemFromMessage(fallback, source, poster);
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
  function clearImageViewerLastTap() {
    ivTouchState.lastTapTime = 0;
    ivTouchState.lastTapX = 0;
    ivTouchState.lastTapY = 0;
  }
  function rememberImageViewerTap(x, y, time = Date.now()) {
    ivTouchState.lastTapTime = time;
    ivTouchState.lastTapX = x;
    ivTouchState.lastTapY = y;
  }
  function clearImageViewerActiveTouch() {
    ivTouchState.activeTouchId = null;
    ivTouchState.startX = 0;
    ivTouchState.startY = 0;
    ivTouchState.currentX = 0;
    ivTouchState.currentY = 0;
    ivTouchState.dx = 0;
    ivTouchState.dragging = false;
    ivTouchState.tapCandidate = false;
    ivTouchState.canTapZoom = false;
    ivTouchState.panBaseX = 0;
    ivTouchState.panBaseY = 0;
  }
  function resetImageViewerTouchState({ preserveLastTap = false } = {}) {
    clearImageViewerActiveTouch();
    ivTouchState.pinching = false;
    ivTouchState.pinchDist0 = 0;
    ivTouchState.pinchMidpoint0X = 0;
    ivTouchState.pinchMidpoint0Y = 0;
    ivTouchState.pinchBasePanX = 0;
    ivTouchState.pinchBasePanY = 0;
    ivTouchState.pinchAnchorX = 0;
    ivTouchState.pinchAnchorY = 0;
    ivTouchState.scaleBase = ivScale;
    if (!preserveLastTap) clearImageViewerLastTap();
  }
  function getTrackedImageViewerTouch(touchList) {
    if (!touchList?.length) return null;
    if (ivTouchState.activeTouchId == null) return touchList[0] || null;
    return Array.from(touchList).find((touch) => touch.identifier === ivTouchState.activeTouchId) || null;
  }
  function getImageViewerTouchMidpoint(touchList) {
    if (!touchList?.length || touchList.length < 2) return null;
    const firstTouch = touchList[0];
    const secondTouch = touchList[1];
    return {
      x: (firstTouch.clientX + secondTouch.clientX) / 2,
      y: (firstTouch.clientY + secondTouch.clientY) / 2,
    };
  }
  function getImageViewerViewportCenter() {
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
  }
  function ivGetImagePointForClient(clientX, clientY, scale = ivScale, panX = ivPanX, panY = ivPanY) {
    const { x: centerX, y: centerY } = getImageViewerViewportCenter();
    const safeScale = Math.max(Number(scale) || 1, 0.0001);
    return {
      x: centerX + (clientX - centerX - panX) / safeScale,
      y: centerY + (clientY - centerY - panY) / safeScale,
    };
  }
  function ivResolvePanForAnchor(anchorX, anchorY, clientX, clientY, scale = ivScale) {
    const { x: centerX, y: centerY } = getImageViewerViewportCenter();
    const nextScale = Math.max(Number(scale) || 1, 1);
    return {
      x: clientX - centerX - (anchorX - centerX) * nextScale,
      y: clientY - centerY - (anchorY - centerY) * nextScale,
    };
  }
  function isImageViewerDoubleTap(x, y, time = Date.now()) {
    if (!ivTouchState.lastTapTime) return false;
    if (time - ivTouchState.lastTapTime > IMAGE_VIEWER_DOUBLE_TAP_DELAY_MS) return false;
    return Math.hypot(x - ivTouchState.lastTapX, y - ivTouchState.lastTapY) <= IMAGE_VIEWER_DOUBLE_TAP_DISTANCE_PX;
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
    if (!img) return;
    if (ivScale === 1 && ivPanX === 0 && ivPanY === 0) {
      img.style.transform = '';
      return;
    }
    img.style.transform = `translate3d(${ivPanX}px, ${ivPanY}px, 0) scale(${ivScale})`;
  }
  function ivSetZoomState(scale, panX = ivPanX, panY = ivPanY) {
    const nextScale = Math.min(IMAGE_VIEWER_MAX_SCALE, Math.max(1, Number(scale) || 1));
    ivScale = nextScale;
    if (nextScale === 1) {
      ivPanX = 0;
      ivPanY = 0;
    } else {
      ivPanX = Number.isFinite(panX) ? panX : 0;
      ivPanY = Number.isFinite(panY) ? panY : 0;
    }
    ivApplyTransform();
  }
  function ivZoomAroundClient(clientX, clientY, scale) {
    const nextScale = Math.min(IMAGE_VIEWER_MAX_SCALE, Math.max(1, Number(scale) || 1));
    if (nextScale === 1) {
      ivSetZoomState(1);
      return;
    }
    const anchor = ivGetImagePointForClient(clientX, clientY);
    const nextPan = ivResolvePanForAnchor(anchor.x, anchor.y, clientX, clientY, nextScale);
    ivSetZoomState(nextScale, nextPan.x, nextPan.y);
  }
  function ivResetZoom(animated = false) {
    const img = ivCurrentImg();
    if (animated) ivPrepareZoomTransition(img);
    else ivClearZoomTransition();
    ivSetZoomState(1);
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
    ivZoomAroundClient(clientX, clientY, ZOOM);
    return true;
  }

  function getGallerySlideElement(itemOrIndex = galleryIndex) {
    if (!ivStrip) return null;
    if (typeof itemOrIndex === 'number') {
      return ivStrip.querySelectorAll('.iv-slide')[itemOrIndex] || null;
    }
    const key = galleryItemKey(itemOrIndex);
    if (!key) return null;
    return [...ivStrip.querySelectorAll('.iv-slide')].find((slide) => slide.dataset.galleryKey === key) || null;
  }

  function getGalleryVideoElement(itemOrIndex = galleryIndex) {
    return getGallerySlideElement(itemOrIndex)?.querySelector('video') || null;
  }

  function updateGalleryItemPoster(item, posterUrl) {
    if (!item || item.type !== 'video' || !posterUrl) return '';
    item.posterSrc = posterUrl;
    if (item.message && typeof item.message === 'object') {
      markAttachmentPosterAvailable(item.message);
    }
    applyPosterToVideoElement(getGalleryVideoElement(item), posterUrl);
    return posterUrl;
  }

  async function ensureGalleryItemPoster(item, { slideEl = null } = {}) {
    if (!item || item.type !== 'video') return '';
    const existingPosterUrl = item.posterSrc || getAttachmentPosterUrl(item.message);
    const videoEl = slideEl?.querySelector('video') || getGalleryVideoElement(item);
    if (existingPosterUrl) {
      return updateGalleryItemPoster(item, existingPosterUrl);
    }
    if (!item.message || typeof item.message !== 'object') return '';
    const posterUrl = await ensureAttachmentPoster(item.message, {
      videoEl,
      onReady: (readyPosterUrl) => {
        if (readyPosterUrl) updateGalleryItemPoster(item, readyPosterUrl);
      },
    }).catch(() => '');
    if (posterUrl) updateGalleryItemPoster(item, posterUrl);
    return posterUrl;
  }

  function gallerySlideHtml(item) {
    const key = esc(galleryItemKey(item));
    if (item.type === 'video') {
      const mime = item.fileMime ? ` type="${esc(item.fileMime)}"` : '';
      const posterAttr = item.posterSrc ? ` poster="${esc(item.posterSrc)}"` : '';
      return `<div class="iv-slide iv-slide-video" data-gallery-key="${key}"><video controls playsinline preload="metadata"${posterAttr}><source src="${esc(item.src)}"${mime}></video></div>`;
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
    const imageUrls = [...new Set([
      ...nearby.filter(item => item.type === 'image').map(item => item.src),
      ...nearby.filter(item => item.type === 'video' && item.posterSrc).map(item => item.posterSrc),
    ])];
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
      galleryVideoPreloads.set(item.src, video);
    });
    for (const [src, video] of [...galleryVideoPreloads.entries()]) {
      if (wantedVideos.has(src)) continue;
      try {
        video.pause();
        video.removeAttribute('src');
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

  function suppressMediaViewerFollowupClick(ms = 550) {
    mediaViewerFollowupClickSuppressUntil = Math.max(
      mediaViewerFollowupClickSuppressUntil,
      Date.now() + Math.max(0, Number(ms) || 0)
    );
  }

  function moveGalleryToIndex(newIdx) {
    if (newIdx < 0 || newIdx >= galleryItems.length) return false;
    resetImageViewerTouchState();
    ivStrip.querySelectorAll('.iv-slide')[galleryIndex]?.querySelector('video')?.pause();
    ivResetZoom();
    galleryIndex = newIdx;
    setGalleryStripPosition(true);
    updateGalleryArrows();
    ensureGalleryItemPoster(galleryItems[galleryIndex]).catch(() => {});
    preloadGalleryAssets();
    queueGalleryBuffering();
    return true;
  }

  function openMediaViewer(src, type = 'image') {
    gallerySessionId += 1;
    closeMobileComposerTransientUi({ immediate: true });
    dismissMobileComposer({ forceRecovery: true, reason: 'media-viewer-open', recoveryDelayMs: 280 });
    ivClearZoomTransition();
    mediaViewerSuppressClickUntil = 0;
    mediaViewerFollowupClickSuppressUntil = 0;
    resetImageViewerTouchState();
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
    ensureGalleryItemPoster(galleryItems[galleryIndex]).catch(() => {});
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
    resetImageViewerTouchState();
    ivStrip.querySelectorAll('video').forEach(v => v.pause());
    ivResetZoom();
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
    scheduleMobileViewportRecovery(280);
  }

  function handleMediaViewerControlActivation(e) {
    if (imageViewer.classList.contains('hidden')) return false;
    if (e.type === 'pointerup' && e.pointerType === 'mouse' && e.button !== 0) return false;
    const closeBtn = e.target.closest('.iv-close');
    if (!closeBtn || !imageViewer.contains(closeBtn)) return false;
    e.preventDefault();
    e.stopPropagation();
    if (
      e.type === 'touchend'
      || (e.type === 'pointerup' && String(e.pointerType || '').toLowerCase() !== 'mouse')
    ) {
      suppressMediaViewerFollowupClick();
    }
    closeMediaViewer();
    return true;
  }

  function updateGalleryArrows() {
    const prev = imageViewer.querySelector('.iv-prev');
    const next = imageViewer.querySelector('.iv-next');
    prev.style.display = (galleryIndex > 0 || galleryHasMoreBefore || galleryLoadingBefore) ? '' : 'none';
    next.style.display = (galleryIndex < galleryItems.length - 1 || galleryHasMoreAfter || galleryLoadingAfter) ? '' : 'none';
  }

  async function galleryNav(dir) {
    resetImageViewerTouchState();
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

      privateList.innerHTML = users.map((user) => renderSelectableUserItem(user, { showPresence: true })).join('')
        || '<div style="color:var(--text-secondary);padding:12px">No other users yet</div>';

      groupList.innerHTML = users.map((user) => renderSelectableUserItem(user)).join('');

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

      list.querySelectorAll('.bot-access-toggle').forEach(input => {
        input.addEventListener('change', async () => {
          try {
            await api(`/api/admin/users/${input.dataset.uid}/bot-access`, {
              method: 'PUT',
              body: { can_add_bots_to_chats: !!input.checked },
            });
          } catch (e) {
            input.checked = !input.checked;
            alert(e.message);
          }
        });
      });
      list.querySelectorAll('.bot-audit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          openAdminBotAuditModal(Number(btn.dataset.uid || 0), btn.dataset.name || 'User').catch((error) => {
            alert(error.message || 'Could not load bot audit');
          });
        });
      });

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

  async function openAdminBotAuditModal(userId, displayName = 'User') {
    if (!userId) return;
    $('#adminBotAuditTitle').textContent = `Bot audit: ${displayName}`;
    $('#adminBotAuditStatus').textContent = 'Loading...';
    $('#adminBotAuditList').innerHTML = '';
    openModal('adminBotAuditModal', { replaceStack: false });
    const data = await api(`/api/admin/users/${userId}/bot-additions`);
    const additions = Array.isArray(data?.additions) ? data.additions : [];
    $('#adminBotAuditStatus').textContent = additions.length ? '' : 'No bot additions recorded yet.';
    $('#adminBotAuditList').innerHTML = additions.map((entry) => `
      <div class="admin-user-row">
        ${avatarHtml(entry.bot_name || 'Bot', entry.bot_avatar_color || 'var(--accent)', entry.bot_avatar_url)}
        <div class="audit-entry-copy">
          <div class="name">${esc(entry.bot_name || 'Bot')} <span style="color:var(--text-secondary)">${esc(entry.bot_mention ? '@' + entry.bot_mention : '')}</span></div>
          <div class="audit-entry-meta">${esc((entry.chat_name || 'Chat') + (entry.chat_type ? ` • ${entry.chat_type}` : ''))}</div>
          <div class="audit-entry-meta">${esc([entry.bot_model || '', formatBotAuditSource(entry.source), entry.created_at ? `${formatDate(entry.created_at)} ${formatTime(entry.created_at)}` : ''].filter(Boolean).join(' • '))}</div>
        </div>
      </div>
    `).join('');
  }

  // Settings modal
  function openSettingsModal(opener = $('#settingsBtn')) {
    openModal('settingsModal', { replaceStack: true, opener });
    const adminItem = $('#settingsAdminPanel');
    if (currentUser.is_admin) adminItem.classList.remove('hidden');
    else adminItem.classList.add('hidden');
    const aiBotsItem = $('#settingsAiBotsPanel');
    if (currentUser.is_admin) aiBotsItem?.classList.remove('hidden');
    else aiBotsItem?.classList.add('hidden');
    const yandexAiItem = $('#settingsYandexAiPanel');
    if (currentUser.is_admin) yandexAiItem?.classList.remove('hidden');
    else yandexAiItem?.classList.add('hidden');
    const deepseekAiItem = $('#settingsDeepSeekAiPanel');
    if (currentUser.is_admin) deepseekAiItem?.classList.remove('hidden');
    else deepseekAiItem?.classList.add('hidden');
    const grokAiItem = $('#settingsGrokAiPanel');
    if (currentUser.is_admin) grokAiItem?.classList.remove('hidden');
    else grokAiItem?.classList.add('hidden');
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

  function openVisualModeSettingsModal() {
    openModal('visualModeSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
    renderVisualModePicker();
    setVisualModeStatus('');
  }

  function openPollStyleSettingsModal() {
    syncPollComposerStyleUi();
    openModal('pollStyleSettingsModal', {
      replaceStack: false,
      opener: $('#pollComposerStyleBtn'),
    });
    renderPollStylePicker();
    setPollStyleStatus('Applies to this poll only');
  }

  function openAnimationSettingsModal() {
    openModal('animationSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
    renderModalAnimationOptions();
    renderModalAnimationSpeedControl();
    setModalAnimationStatus('');
  }

  function openMobileFontSettingsModal() {
    openModal('mobileFontSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
    renderMobileFontSizeControl();
    setMobileFontSizeStatus('');
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
    resetManagedModalScroll('aiBotSettingsModal');
    setAiBotModalStatus('Загружаю...', 'pending');
    Promise.all([loadAiBotState(), loadOpenAiUniversalState()]).then(() => {
      resetManagedModalScroll('aiBotSettingsModal');
      setAiBotModalStatus('');
    }).catch((e) => {
      const message = e.message || 'Could not load OpenAI AI bots';
      setAiBotModalStatus(message, 'error');
    });
  }

  function openOpenAiTextBotsModal() {
    if (!currentUser?.is_admin) return;
    openModal('openAiTextBotsModal', { replaceStack: false, opener: $('#openAiOpenTextBots') });
    resetManagedModalScroll('openAiTextBotsModal');
    setAiBotTextModalStatus('Загружаю...', 'pending');
    loadAiBotState().then(() => {
      renderOpenAiTextBotsSettings();
      resetManagedModalScroll('openAiTextBotsModal');
      setAiBotTextModalStatus('');
    }).catch((e) => {
      setAiBotTextModalStatus(e.message || 'Не удалось загрузить OpenAI text bots', 'error');
    });
  }

  function openOpenAiUniversalBotsModal() {
    if (!currentUser?.is_admin) return;
    openModal('openAiUniversalBotsModal', { replaceStack: false, opener: $('#openAiOpenUniversalBots') });
    resetManagedModalScroll('openAiUniversalBotsModal');
    setOpenAiUniversalModalStatus('Loading...', 'pending');
    loadOpenAiUniversalState().then(() => {
      renderOpenAiUniversalSettings();
      resetManagedModalScroll('openAiUniversalBotsModal');
      setOpenAiUniversalModalStatus('');
    }).catch((e) => {
      setOpenAiUniversalModalStatus(e.message || 'Could not load OpenAI universal bots', 'error');
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

  function openDeepseekAiSettingsModal() {
    if (!currentUser?.is_admin) return;
    openModal('deepseekAiSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
    setDeepseekAiStatus('Loading...');
    loadDeepseekAiState().then(() => setDeepseekAiStatus('')).catch((e) => {
      setDeepseekAiStatus(e.message || 'Could not load DeepSeek AI bots', 'error');
    });
  }

  function openDeepseekTextBotsModal() {
    if (!currentUser?.is_admin) return;
    ensureDeepseekTextBotsModalContent();
    openModal('deepseekAiTextBotsModal', { replaceStack: false, opener: $('#deepseekAiOpenTextBots') });
    resetManagedModalScroll('deepseekAiTextBotsModal');
    setDeepseekBotStatus('Loading...', 'pending');
    setDeepseekChatStatus('');
    loadDeepseekAiState().then(() => {
      resetManagedModalScroll('deepseekAiTextBotsModal');
      setDeepseekBotStatus('');
    }).catch((e) => {
      setDeepseekBotStatus(e.message || 'Could not load DeepSeek text bots', 'error');
    });
  }

  function resetManagedModalScroll(modalId) {
    const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
    const body = modal?.querySelector('.modal-body');
    if (!body) return;
    requestAnimationFrame(() => {
      body.scrollTop = 0;
    });
  }

  function openGrokAiSettingsModal() {
    if (!currentUser?.is_admin) return;
    openModal('grokAiSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
    resetManagedModalScroll('grokAiSettingsModal');
    setGrokAiStatus('Loading...');
    loadGrokAiState().then(() => {
      renderGrokAiSettings();
      resetManagedModalScroll('grokAiSettingsModal');
      setGrokAiStatus('');
    }).catch((e) => {
      setGrokAiStatus(e.message || 'Could not load Grok AI bots', 'error');
    });
  }

  function openGrokTextBotsModal() {
    if (!currentUser?.is_admin) return;
    mountGrokBotPanels();
    openModal('grokAiTextBotsModal', { replaceStack: false, opener: $('#grokAiOpenTextBots') });
    resetManagedModalScroll('grokAiTextBotsModal');
    setGrokTextStatus('Loading...');
    const hasState = grokBotState.chats.length || grokBotState.bots.length || grokBotState.imageBots.length;
    if (hasState) {
      renderGrokTextBotsSettings();
      resetManagedModalScroll('grokAiTextBotsModal');
      setGrokTextStatus('Refreshing...');
    }
    loadGrokAiState().then(() => {
      renderGrokTextBotsSettings();
      resetManagedModalScroll('grokAiTextBotsModal');
      setGrokTextStatus('');
    }).catch((e) => {
      setGrokTextStatus(e.message || 'Could not load Grok text bots', 'error');
    });
  }

  function openGrokImageBotsModal() {
    if (!currentUser?.is_admin) return;
    mountGrokBotPanels();
    openModal('grokAiImageBotsModal', { replaceStack: false, opener: $('#grokAiOpenImageBots') });
    resetManagedModalScroll('grokAiImageBotsModal');
    setGrokImageStatus('Loading...');
    const hasState = grokBotState.chats.length || grokBotState.bots.length || grokBotState.imageBots.length;
    if (hasState) {
      renderGrokImageBotsSettings();
      resetManagedModalScroll('grokAiImageBotsModal');
      setGrokImageStatus('Refreshing...');
    }
    loadGrokAiState().then(() => {
      renderGrokImageBotsSettings();
      resetManagedModalScroll('grokAiImageBotsModal');
      setGrokImageStatus('');
    }).catch((e) => {
      setGrokImageStatus(e.message || 'Could not load Grok image bots', 'error');
    });
  }

  function openGrokUniversalBotsModal() {
    if (!currentUser?.is_admin) return;
    mountGrokBotPanels();
    openModal('grokAiUniversalBotsModal', { replaceStack: false, opener: $('#grokAiOpenUniversalBots') });
    resetManagedModalScroll('grokAiUniversalBotsModal');
    setGrokUniversalStatus('Loading...');
    loadGrokUniversalState().then(() => {
      renderGrokUniversalBotsSettings();
      resetManagedModalScroll('grokAiUniversalBotsModal');
      setGrokUniversalStatus('');
    }).catch((e) => {
      setGrokUniversalStatus(e.message || 'Could not load Grok universal bots', 'error');
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
  async function openChatInfoModal(opener = $('#chatInfoBtn')) {
    if (!currentChatId) return;
    openModal('chatInfoModal', { replaceStack: true, opener });

    const chat = chats.find(c => c.id === currentChatId);
    $('#chatInfoTitle').textContent = chat ? chat.name : 'Chat Info';
    syncChatInfoStatusVisibility(chat);

    // Sync compact view toggle
    $('#compactViewToggle').checked = compactView;
    await loadChatPreferences(currentChatId);
    renderChatPinSettingsForm(chat);
    renderChatContextTransformForm(chat);
    renderChatDangerControls(chat);
    const contextTransformToggle = $('#chatContextTransformToggle');
    if (contextTransformToggle) {
      contextTransformToggle.onchange = () => {
        saveChatContextTransformSetting().catch((error) => {
          setChatContextTransformStatus(error.message || 'Could not save context transform setting', 'error');
        });
      };
    }

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
      const targetChatId = currentChatId;
      const clearBtn = $('#clearChatHistoryBtn');
      const leaveBtn = $('#leaveChatBtn');
      const deleteBtn = $('#deleteChatBtn');
      if (clearBtn) clearBtn.onclick = async () => {
        await clearChatHistoryForEveryone(targetChatId);
        renderChatDangerControls(getChatById(targetChatId));
      };
      if (leaveBtn) leaveBtn.onclick = async () => {
        await leaveChat(targetChatId);
      };
      if (deleteBtn) deleteBtn.onclick = async () => {
        await deleteChatCompletely(targetChatId);
      };
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
              <span class="status-dot"></span>${u.is_ai_bot ? 'AI bot' : (onlineUsers.has(u.id) ? 'online' : 'offline')}
            </div>
          </div>
          ${canRemove && u.id !== currentUser.id ? `<button class="member-remove" data-uid="${u.id}" title="Remove">✕</button>` : ''}
        </div>
      `;
      }).join('');
      memberList.innerHTML = members.map((user) => renderChatMemberItem(user, { ownerId, canRemove })).join('');

      // Update status indicators in modal
      try { refreshChatMemberStatuses(); } catch (e) {}
      try { refreshChatInfoStatus(); } catch (e) {}
      try {
        const botData = { bots: [] };
        const botSection = $('#chatBotInfoSection');
        const botList = $('#chatBotList');
        const bots = Array.isArray(botData?.bots) ? botData.bots : [];
        if (botSection && botList) {
          if (!bots.length) {
            botSection.classList.add('hidden');
            botList.innerHTML = '';
          } else {
            botSection.classList.remove('hidden');
            botList.innerHTML = bots.map((bot) => `
              <div class="user-list-item is-ai-bot" data-uid="${bot.user_id}">
                ${avatarHtml(bot.name, bot.avatar_color, bot.avatar_url)}
                <div class="user-list-copy">
                  <div class="name">${esc(bot.name)}</div>
                  <div class="user-list-meta">${esc(['@' + (bot.mention || ''), bot.model || ''].filter(Boolean).join(' • '))}</div>
                </div>
              </div>
            `).join('');
          }
        }
      } catch (e) {}

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
        addList.innerHTML = nonMembers.map((user) => renderSelectableUserItem(user)).join('')
          || '<div style="color:var(--text-secondary)">All users are already members</div>';

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

  function openMenuDrawer(opener = $('#menuBtn')) {
    hideFloatingMessageActions({ immediate: true });
    openModal('menuDrawer', { replaceStack: true, opener });

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
    queueIosViewportLayoutSync();
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

  function resetBackButtonNavigationState() {
    if (!backBtn) return;
    clearTimeout(backBtn.__navTimer);
    clearTimeout(backBtn.__unlockTimer);
    clearTimeout(backBtn.__spinTimer);
    inAppChatBackSkipNextPopstate = false;
    backBtn.classList.remove('is-spinning');
    backBtn.__isNavigating = false;
  }

  function deferBackButtonNavigationRelease() {
    if (!backBtn) return;
    clearTimeout(backBtn.__unlockTimer);
    // iOS Safari can deliver the history transition slightly later than the tap handler.
    backBtn.__unlockTimer = setTimeout(() => {
      if (!backBtn) return;
      if (isIosViewportFixTarget) iosBackNavigationToken = 0;
      inAppChatBackSkipNextPopstate = false;
      backBtn.__isNavigating = false;
      backBtn.classList.remove('is-spinning');
    }, isIosViewportFixTarget ? 420 : 260);
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
    if (!sidebar) return;
    if (sidebar.__revealFrame) {
      cancelAnimationFrame(sidebar.__revealFrame);
      sidebar.__revealFrame = 0;
    }
    if (sidebar.__revealFallbackTimer) {
      clearTimeout(sidebar.__revealFallbackTimer);
      sidebar.__revealFallbackTimer = null;
    }
    if (sidebar.__revealAnimation) {
      const animation = sidebar.__revealAnimation;
      sidebar.__revealAnimation = null;
      animation.onfinish = null;
      animation.oncancel = null;
      try { animation.cancel(); } catch {}
    }
    try {
      sidebar.getAnimations?.().forEach((animation) => {
        if (animation?.id === 'sidebarRevealAnimation') animation.cancel();
      });
    } catch {}
    sidebar.style.transform = '';
    sidebar.style.willChange = '';
    clearTimeout(mobileRouteTransitionTimer);
    mobileRouteTransitionTimer = null;
    mobileRouteTransitionActive = false;
    document.documentElement.classList.remove('is-mobile-route-transitioning');
  }

  function revealSidebarFromChat({ forceAnimation = false } = {}) {
    if (!sidebar) return;
    const shouldAnimateReveal = Boolean(
      forceAnimation
      || (isMobileLayoutViewport() && getResolvedMobileBaseScene() === 'chat')
      || sidebar.classList.contains('sidebar-hidden')
    );
    markCurrentChatReadIfAtBottom(false);
    flushCurrentChatScrollAnchor(currentChatId, { force: true, allowPendingMedia: true });
    pauseCurrentChatMediaPlayback();
    dismissMobileComposer({ forceRecovery: true, reason: 'reveal-sidebar', recoveryDelayMs: 280 });
    hideFloatingMessageActions({ immediate: true });
    hideMentionPicker();
    closeEmojiPicker({ immediate: true });
    cancelPendingSidebarReveal();
    syncMobileBaseSceneState({
      scene: 'sidebar',
      hideInactive: false,
    });

    if (!shouldAnimateReveal) {
      syncMobileBaseSceneState({ scene: 'sidebar', hideInactive: true, repaint: true });
      flushDeferredRecoverySync();
      return;
    }

    sidebar.classList.add('sidebar-no-transition');
    sidebar.classList.add('sidebar-hidden');
    void sidebar.offsetWidth;

    beginMobileRouteTransition(Math.max(260, Math.ceil(getElementTransitionTotalMs(sidebar) || 250)) + 90);

    const finishReveal = () => {
      if (!sidebar) return;
      const animation = sidebar.__revealAnimation;
      if (sidebar.__revealAnimation) {
        sidebar.__revealAnimation.onfinish = null;
        sidebar.__revealAnimation.oncancel = null;
        sidebar.__revealAnimation = null;
      }
      if (sidebar.__revealFallbackTimer) {
        clearTimeout(sidebar.__revealFallbackTimer);
        sidebar.__revealFallbackTimer = null;
      }
      sidebar.__revealFrame = 0;
      sidebar.classList.remove('sidebar-hidden');
      sidebar.classList.remove('sidebar-no-transition');
      sidebar.style.transform = '';
      sidebar.style.willChange = '';
      try { animation?.cancel?.(); } catch {}
      endMobileRouteTransition();
    };

    // Mobile browsers can lose the previous transform frame after background resume.
    // Start every reveal from an explicit offscreen transform so the slide always runs.
    sidebar.classList.add('sidebar-no-transition');
    sidebar.style.willChange = 'transform';
    sidebar.style.transform = 'translate3d(-100%,0,0)';
    sidebar.classList.remove('sidebar-hidden');
    void sidebar.offsetWidth;
    sidebar.classList.remove('sidebar-no-transition');

    if (!isIosViewportFixTarget && typeof sidebar.animate === 'function') {
      const animation = sidebar.animate(
        [
          { transform: 'translate3d(-100%,0,0)' },
          { transform: 'translate3d(0,0,0)' },
        ],
        {
          duration: 260,
          easing: 'cubic-bezier(.2,.85,.2,1)',
          fill: 'forwards',
        }
      );
      animation.id = 'sidebarRevealAnimation';
      sidebar.__revealAnimation = animation;
      animation.onfinish = finishReveal;
      animation.oncancel = () => {
        if (sidebar.__revealAnimation === animation) sidebar.__revealAnimation = null;
      };
      return;
    }

    sidebar.__revealFrame = requestAnimationFrame(() => {
      sidebar.style.transform = 'translate3d(0,0,0)';
      sidebar.__revealFrame = 0;
      sidebar.__revealFallbackTimer = setTimeout(finishReveal, 280);
    });
  }

  function navigateBackToChatList({ fromInAppButton = false } = {}) {
    hideFloatingMessageActions({ immediate: true });
    if (fromInAppButton && history.state?.chat) {
      inAppChatBackSkipNextPopstate = true;
      revealSidebarFromChat({ forceAnimation: true });
      history.back();
      return;
    }
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
    wireAiBotToggleLabels();
    ensureSearchPanelReady();
    document.addEventListener('click', (e) => {
      if (
        Date.now() >= mentionPickerClickSuppressUntil
        && Date.now() >= contextConvertPickerClickSuppressUntil
        && Date.now() >= searchPanelFollowupClickSuppressUntil
        && Date.now() >= mobileComposerDismissClickSuppressUntil
        && Date.now() >= mediaViewerFollowupClickSuppressUntil
      ) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
    const dismissMobileComposerMessageTap = (e) => {
      if (!isMobileComposerSessionActive()) return;
      if (e.type === 'pointerdown' && typeof e.button === 'number' && e.button !== 0) return;
      if (!isMobileComposerDismissMessageTarget(e.target) && !isMobileComposerDismissBackgroundTarget(e.target)) return;
      dismissMobileComposer({ consumeTap: true, forceRecovery: true, reason: 'message-or-background-tap' });
      e.preventDefault();
      e.stopImmediatePropagation?.();
      e.stopPropagation();
    };
    const dismissMentionPickerOutsideGesture = (e) => {
      const picker = $('#mentionPicker');
      if (!picker || picker.classList.contains('hidden')) return;
      const target = e.target;
      if (picker.contains(target) || target === msgInput || target?.closest?.('#mentionOpenBtn')) return;
      hideMentionPicker({ immediate: true });
      if (isPickerDismissPassThroughTarget(target)) return;
      consumeOutsidePickerDismissGesture(e, suppressMentionPickerFollowupClick);
    };
    const dismissContextConvertPickerOutsideGesture = (e) => {
      const picker = $('#contextConvertPicker');
      if (!picker || picker.classList.contains('hidden')) return;
      const target = e.target;
      if (picker.contains(target) || target?.closest?.('#composerContextConvertBtn')) return;
      hideContextConvertPicker({ immediate: true });
      if (isPickerDismissPassThroughTarget(target)) return;
      consumeOutsidePickerDismissGesture(e, suppressContextConvertPickerFollowupClick);
    };
    document.addEventListener('pointerdown', dismissMentionPickerOutsideGesture, { passive: false, capture: true });
    document.addEventListener('touchstart', dismissMentionPickerOutsideGesture, { passive: false, capture: true });
    document.addEventListener('pointerdown', dismissContextConvertPickerOutsideGesture, { passive: false, capture: true });
    document.addEventListener('touchstart', dismissContextConvertPickerOutsideGesture, { passive: false, capture: true });
    messagesEl.addEventListener('pointerdown', dismissMobileComposerMessageTap, { passive: false, capture: true });
    messagesEl.addEventListener('touchstart', dismissMobileComposerMessageTap, { passive: false, capture: true });

    // Send message
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sendBtn.blur();
      sendMessage();
      // Keep keyboard open on mobile
      if (window.innerWidth <= 768) msgInput.focus();
    });
    bindTouchSafeButtonActivation(mentionOpenBtn, ({ startKeyboardOpen }) => {
      openMentionPickerFromButton({ keyboardAttached: startKeyboardOpen }).catch((error) => {
        console.warn('[mentions] composer picker open failed:', error.message);
      });
    });
    bindTouchSafeButtonActivation(composerContextConvertBtn, ({ startKeyboardOpen }) => {
      openComposerContextConvertPicker({ keyboardAttached: startKeyboardOpen }).catch((error) => {
        console.warn('[context-convert] composer picker open failed:', error.message);
      });
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
      updateComposerAiOverrideState().catch(() => {});
      updateMentionPicker();
      // Typing indicator
      if (!typingSendTimeout) {
        sendTyping();
        typingSendTimeout = setTimeout(() => { typingSendTimeout = null; }, 2000);
      }
    });
    msgInput.addEventListener('focus', () => {
      clearTimeout(iosComposerBlurTimer);
      iosComposerBlurTimer = null;
      iosComposerFocused = true;
      getIosViewportBaselineHeight();
      queueIosViewportLayoutSync();
    });
    msgInput.addEventListener('blur', () => {
      clearTimeout(iosComposerBlurTimer);
      iosComposerBlurTimer = setTimeout(() => {
        iosComposerFocused = false;
        queueIosViewportLayoutSync();
      }, 180);
      requestAnimationFrame(() => queueIosViewportLayoutSync());
    });
    composerAiOverrideModeEl?.addEventListener('change', () => {
      composerAiOverrideState.mode = composerAiOverrideModeEl.value || 'auto';
      renderComposerAiOverride();
    });
    composerAiOverrideDocumentFormatEl?.addEventListener('change', () => {
      composerAiOverrideState.documentFormat = composerAiOverrideDocumentFormatEl.value || 'md';
      renderComposerAiOverride();
    });
    msgInput.addEventListener('click', updateMentionPicker);
    msgInput.addEventListener('keyup', (e) => {
      if (!['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) updateMentionPicker();
    });
    window.visualViewport?.addEventListener('resize', () => {
      const mentionPickerDismissed = dismissMentionPickerAfterKeyboardClose();
      if (mentionPickerDismissed) forceMobileViewportLayoutSync();
      positionEmojiPicker();
      positionMentionPicker();
      positionContextConvertPicker();
      positionAvatarUserMenu(avatarUserMenuState?.anchor);
      positionMessageActionSurfaces();
      scheduleRetryLayout();
      queueIosViewportLayoutSync();
    });
    window.visualViewport?.addEventListener('scroll', () => {
      const mentionPickerDismissed = dismissMentionPickerAfterKeyboardClose();
      if (mentionPickerDismissed) forceMobileViewportLayoutSync();
      positionEmojiPicker();
      positionMentionPicker();
      positionContextConvertPicker();
      positionAvatarUserMenu(avatarUserMenuState?.anchor);
      positionMessageActionSurfaces();
      queueIosViewportLayoutSync();
    });
    window.addEventListener('resize', () => {
      positionEmojiPicker();
      positionContextConvertPicker();
      positionMessageActionSurfaces();
      scheduleRetryLayout();
      queueIosViewportLayoutSync();
    });
    document.addEventListener('pointerdown', (e) => {
      const menu = $('#avatarUserMenu');
      if (!menu || menu.classList.contains('hidden')) return;
      if (menu.contains(e.target) || e.target.closest('.msg-group-avatar')) return;
      hideAvatarUserMenu();
    });
    document.addEventListener('pointerdown', (e) => {
      if (!activePulseVoterPopover) return;
      if (e.target.closest('[data-poll-voter-avatar], [data-poll-voter-more], [data-poll-voter-popover]')) return;
      clearActivePulseVoterPopover();
    });

    // File attach
    const fileInputGallery = $('#fileInputGallery');
    const fileInputCamera = $('#fileInputCamera');
    const fileInputDocs = $('#fileInputDocs');
    syncMentionOpenButton();
    renderComposerAiOverride();
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
    bindTouchSafeButtonActivation(attachBtn, ({ keepKeyboardOpen }) => {
      if (editTo) return;
      if (isMobileAttachMenu()) {
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
    $('#attachMenuPoll')?.addEventListener('click', () => { closeAttachMenu(); openPollComposer(); });

    fileInput.addEventListener('change', () => { if (fileInput.files.length > 0) uploadFiles(fileInput.files); });
    fileInputGallery.addEventListener('change', () => { if (fileInputGallery.files.length > 0) { uploadFiles(fileInputGallery.files); fileInputGallery.value = ''; } });
    fileInputCamera.addEventListener('change', () => { if (fileInputCamera.files.length > 0) { uploadFiles(fileInputCamera.files); fileInputCamera.value = ''; } });
    fileInputDocs.addEventListener('change', () => { if (fileInputDocs.files.length > 0) { uploadFiles(fileInputDocs.files); fileInputDocs.value = ''; } });
    pollBtn?.addEventListener('click', openPollComposer);
    $('#pollAddOptionBtn')?.addEventListener('click', () => {
      if (pollComposerOptions.length >= POLL_MAX_OPTIONS) return;
      pollComposerOptions.push('');
      renderPollComposerOptionInputs();
      refreshPollComposerPreview();
      const nextInput = pollOptionsList?.querySelector(`input[data-poll-option-index="${pollComposerOptions.length - 1}"]`);
      nextInput?.focus();
    });
    pollOptionsList?.addEventListener('input', (e) => {
      const input = e.target.closest('input[data-poll-option-index]');
      if (!input) return;
      const index = Number(input.dataset.pollOptionIndex || -1);
      if (index < 0) return;
      pollComposerOptions[index] = input.value;
      setPollComposerStatus('');
      refreshPollComposerPreview();
    });
    pollOptionsList?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-poll-option-remove]');
      if (!btn) return;
      const index = Number(btn.dataset.pollOptionRemove || -1);
      if (index < 0 || pollComposerOptions.length <= POLL_MIN_OPTIONS) return;
      pollComposerOptions.splice(index, 1);
      renderPollComposerOptionInputs();
      refreshPollComposerPreview();
    });
    pollQuestionInput?.addEventListener('input', () => {
      setPollComposerStatus('');
      refreshPollComposerPreview();
    });
    $('#pollAllowMultiple')?.addEventListener('change', refreshPollComposerPreview);
    $('#pollShowVoters')?.addEventListener('change', refreshPollComposerPreview);
    $('#pollClosePreset')?.addEventListener('change', refreshPollComposerPreview);
    $('#pollComposerStyleBtn')?.addEventListener('click', openPollStyleSettingsModal);
    $('#pollSubmitBtn')?.addEventListener('click', submitPollComposer);

    // Emoji
    bindTouchSafeButtonActivation(emojiBtn, ({ keepKeyboardOpen }) => {
      toggleEmojiPicker(emojiBtn, { keepKeyboardOpen });
    });

    // Media viewer close
    imageViewer.addEventListener('pointerup', (e) => {
      handleMediaViewerControlActivation(e);
    }, { passive: false });
    imageViewer.addEventListener('touchend', (e) => {
      handleMediaViewerControlActivation(e);
    }, { passive: false });
    imageViewer.addEventListener('click', (e) => {
      if (handleMediaViewerControlActivation(e)) return;
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
      imageViewer.addEventListener('touchstart', (e) => {
        if (e.target.closest('.iv-prev, .iv-next, .iv-close')) return;
        const touchedSlide = e.target.closest('.iv-slide');
        if (!touchedSlide) return;
        const isImageSlideTouch = Boolean(touchedSlide && !touchedSlide.classList.contains('iv-slide-video'));
        const canImageZoomTouch = isImageSlideTouch && galleryItems[galleryIndex]?.type !== 'video';
        if (e.touches.length === 2) {
          clearImageViewerActiveTouch();
          clearImageViewerLastTap();
          if (canImageZoomTouch) {
            ivClearZoomTransition();
            ivTouchState.pinching = true;
            const t = e.touches;
            ivTouchState.pinchDist0 = Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
            const midpoint = getImageViewerTouchMidpoint(t);
            ivTouchState.pinchMidpoint0X = midpoint?.x || 0;
            ivTouchState.pinchMidpoint0Y = midpoint?.y || 0;
            ivTouchState.pinchBasePanX = ivPanX;
            ivTouchState.pinchBasePanY = ivPanY;
            const anchor = midpoint
              ? ivGetImagePointForClient(midpoint.x, midpoint.y, ivScale, ivPanX, ivPanY)
              : { x: 0, y: 0 };
            ivTouchState.pinchAnchorX = anchor.x;
            ivTouchState.pinchAnchorY = anchor.y;
            ivTouchState.scaleBase = ivScale;
            e.preventDefault();
          }
          return;
        }
        if (e.touches.length !== 1) {
          resetImageViewerTouchState();
          return;
        }
        const touch = e.touches[0];
        const tx = touch.clientX;
        const ty = touch.clientY;
        ivTouchState.activeTouchId = touch.identifier;
        ivTouchState.startX = tx;
        ivTouchState.startY = ty;
        ivTouchState.currentX = tx;
        ivTouchState.currentY = ty;
        ivTouchState.dx = 0;
        ivTouchState.dragging = false;
        ivTouchState.tapCandidate = true;
        ivTouchState.canTapZoom = canImageZoomTouch;
        ivTouchState.panBaseX = ivPanX;
        ivTouchState.panBaseY = ivPanY;
        ivTouchState.pinching = false;
        ivTouchState.pinchDist0 = 0;
        ivTouchState.scaleBase = ivScale;
        if (!canImageZoomTouch) clearImageViewerLastTap();
        if (ivScale === 1) ivStrip.style.transition = 'none';
      }, { passive: false });

      imageViewer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
          if (!ivTouchState.pinching || galleryItems[galleryIndex]?.type === 'video') return;
          const t = e.touches;
          const baseDist = Math.max(ivTouchState.pinchDist0 || 0, 1);
          const dist = Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
          const midpoint = getImageViewerTouchMidpoint(t);
          if (!midpoint) return;
          const nextScale = Math.min(IMAGE_VIEWER_MAX_SCALE, Math.max(1, ivTouchState.scaleBase * dist / baseDist));
          const nextPan = ivResolvePanForAnchor(
            ivTouchState.pinchAnchorX,
            ivTouchState.pinchAnchorY,
            midpoint.x,
            midpoint.y,
            nextScale
          );
          ivSetZoomState(nextScale, nextPan.x, nextPan.y);
          e.preventDefault();
          return;
        }
        if (ivTouchState.pinching || e.touches.length !== 1) return;
        const touch = getTrackedImageViewerTouch(e.touches);
        if (!touch) return;
        const cx = touch.clientX;
        const cy = touch.clientY;
        ivTouchState.currentX = cx;
        ivTouchState.currentY = cy;
        const moveX = cx - ivTouchState.startX;
        const moveY = cy - ivTouchState.startY;
        if (ivTouchState.tapCandidate && Math.hypot(moveX, moveY) > IMAGE_VIEWER_TAP_MAX_DRIFT_PX) {
          ivTouchState.tapCandidate = false;
        }
        if (ivScale > 1) {
          ivClearZoomTransition();
          ivSetZoomState(ivScale, ivTouchState.panBaseX + moveX, ivTouchState.panBaseY + moveY);
          e.preventDefault();
          return;
        }
        ivTouchState.dx = moveX;
        if (!ivTouchState.dragging && Math.abs(moveX) > Math.abs(moveY) && Math.abs(moveX) > IMAGE_VIEWER_SWIPE_START_PX) {
          ivTouchState.dragging = true;
        }
        if (!ivTouchState.dragging) return;
        ivTouchState.tapCandidate = false;
        ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth + ivTouchState.dx}px)`;
        e.preventDefault();
      }, { passive: false });

      imageViewer.addEventListener('touchend', (e) => {
        if (ivTouchState.pinching) {
          if (e.touches.length < 2) {
            ivTouchState.pinching = false;
            ivTouchState.pinchDist0 = 0;
            ivTouchState.pinchMidpoint0X = 0;
            ivTouchState.pinchMidpoint0Y = 0;
            ivTouchState.pinchBasePanX = ivPanX;
            ivTouchState.pinchBasePanY = ivPanY;
            ivTouchState.pinchAnchorX = 0;
            ivTouchState.pinchAnchorY = 0;
            ivTouchState.scaleBase = ivScale;
            if (e.touches.length === 1) {
              const remainingTouch = e.touches[0];
              ivTouchState.activeTouchId = remainingTouch.identifier;
              ivTouchState.startX = remainingTouch.clientX;
              ivTouchState.startY = remainingTouch.clientY;
              ivTouchState.currentX = remainingTouch.clientX;
              ivTouchState.currentY = remainingTouch.clientY;
              ivTouchState.dx = 0;
              ivTouchState.dragging = false;
              ivTouchState.tapCandidate = false;
              ivTouchState.canTapZoom = false;
              ivTouchState.panBaseX = ivPanX;
              ivTouchState.panBaseY = ivPanY;
              clearImageViewerLastTap();
              return;
            }
          }
          clearImageViewerActiveTouch();
          clearImageViewerLastTap();
          return;
        }
        const touch = getTrackedImageViewerTouch(e.changedTouches);
        if (!touch) {
          if (!e.touches.length) clearImageViewerActiveTouch();
          return;
        }
        const endX = touch.clientX;
        const endY = touch.clientY;
        const wasDragging = ivTouchState.dragging;
        const wasTapCandidate = ivTouchState.tapCandidate;
        const canTapZoom = ivTouchState.canTapZoom;
        const travelX = endX - ivTouchState.startX;
        const travelY = endY - ivTouchState.startY;
        const dragDistance = Math.hypot(travelX, travelY);
        const dragDx = ivTouchState.dx;
        clearImageViewerActiveTouch();

        if (wasTapCandidate && dragDistance <= IMAGE_VIEWER_TAP_MAX_DRIFT_PX) {
          if (canTapZoom) {
            const now = Date.now();
            if (isImageViewerDoubleTap(endX, endY, now)) {
              e.preventDefault();
              clearImageViewerLastTap();
              mediaViewerSuppressClickUntil = Math.max(mediaViewerSuppressClickUntil, Date.now() + 450);
              ivToggleZoomAt(endX, endY);
              return;
            }
            rememberImageViewerTap(endX, endY, now);
          } else {
            clearImageViewerLastTap();
          }
        } else {
          clearImageViewerLastTap();
        }

        if (ivScale > 1) {
          if (!wasTapCandidate) e.preventDefault();
          return;
        }
        if (wasDragging && Math.abs(dragDx) > IMAGE_VIEWER_SWIPE_COMMIT_PX) {
          e.preventDefault();
          galleryNav(dragDx < 0 ? 1 : -1);
        } else {
          ivStrip.style.transition = 'transform 0.3s ease';
          ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;
          updateGalleryArrows();
        }
      }, { passive: false });

      imageViewer.addEventListener('touchcancel', () => {
        resetImageViewerTouchState();
        if (imageViewer.classList.contains('hidden') || ivScale > 1) return;
        ivStrip.style.transition = 'transform 0.3s ease';
        ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;
        updateGalleryArrows();
      }, { passive: false });

      window.addEventListener('resize', () => {
        resetImageViewerTouchState();
        if (!imageViewer.classList.contains('hidden')) {
          ivStrip.style.transition = 'none';
          ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;
          ivApplyTransform();
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
      if (action === 'context-convert') {
        e.preventDefault();
        const row = messagesEl.querySelector(`[data-msg-id="${reactionPickerMsgId}"]`);
        if (row) {
          openMessageContextConvertPicker(row, btn, { keepComposerFocus }).catch((error) => {
            console.warn('[context-convert] picker open failed:', error.message);
          });
        }
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
        '.msg-actions, button, a, input, textarea, select, label, audio, video, .video-note-stage, .msg-reply, .reaction-badge, .msg-image, .msg-video, .msg-file, .link-preview, .msg-group-avatar'
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
        if (getSelectedMessageFragment(row) || isSelectableMessageTextTarget(e.target)) return;
        const touch = e.touches && e.touches[0] ? e.touches[0] : null;
        lpStart = { row, x: touch?.clientX || 0, y: touch?.clientY || 0 };
        lpTimer = setTimeout(() => {
          lpTimer = null;
          suppressNextMessageActionTap();
          safeVibrate(30);
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
        if (row && getSelectedMessageFragment(row)) return;
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
      let startPointerId = null;
      const clearChatContextPointerPress = () => {
        clearChatContextLongPress();
        startPoint = null;
        startPointerId = null;
      };
      chatList.addEventListener('pointerdown', (e) => {
        if (e.button && e.button !== 0) return;
        if (startPointerId != null) return;
        const row = e.target.closest('.chat-item[data-chat-id]');
        if (!row || !chatList.contains(row) || e.target.closest('button, a, input, textarea, select, label')) return;
        startPointerId = e.pointerId;
        startPoint = { x: e.clientX, y: e.clientY };
        chatContextLongPressStart = startPoint;
        chatContextLongPressRow = row;
        clearTimeout(chatContextLongPressTimer);
        chatContextLongPressTimer = setTimeout(() => {
          chatContextLongPressTimer = null;
          suppressNextChatItemTap();
          suppressChatContextDismissUntil = Date.now() + 550;
          safeVibrate(30);
          showChatContextMenuForRow(row, {
            x: startPoint?.x,
            y: startPoint?.y,
            source: 'long-press',
          });
        }, CHAT_CONTEXT_LONG_PRESS_MS);
      }, { passive: true });
      chatList.addEventListener('pointermove', (e) => {
        if (!startPoint || e.pointerId !== startPointerId) return;
        if (Math.hypot(e.clientX - startPoint.x, e.clientY - startPoint.y) > 10) {
          clearChatContextPointerPress();
        }
      }, { passive: true });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
        chatList.addEventListener(type, (e) => {
          if (startPointerId != null && e.pointerId !== startPointerId) return;
          clearChatContextPointerPress();
        }, { passive: true });
      });
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

    (() => {
      if (!chatList || !sidebar || !chatListPullIndicator || !chatListPullLabel) return;
      chatListPullIndicator.classList.remove('hidden');
      chatListPullIndicator.setAttribute('aria-hidden', 'true');

      const state = {
        tracking: false,
        engaged: false,
        refreshing: false,
        startY: 0,
        offset: 0,
      };
      let resetPullUiTimer = null;

      const clearResetPullUiTimer = () => {
        if (!resetPullUiTimer) return;
        clearTimeout(resetPullUiTimer);
        resetPullUiTimer = null;
      };

      const isSidebarListPullAvailable = () => (
        window.innerWidth <= 768
        && !sidebar.classList.contains('sidebar-hidden')
        && !state.refreshing
        && !chatListAbortController
      );

      const positionChatListPullIndicator = () => {
        const sidebarRect = sidebar.getBoundingClientRect();
        const listRect = chatList.getBoundingClientRect();
        const top = Math.max(0, Math.round(listRect.top - sidebarRect.top + 8));
        chatListPullIndicator.style.top = `${top}px`;
      };

      const setChatListPullUi = (offset, { dragging = false, refreshing = false } = {}) => {
        const ready = !refreshing && offset >= CHAT_LIST_PULL_THRESHOLD;
        state.offset = Math.max(0, Math.round(offset));
        clearResetPullUiTimer();
        positionChatListPullIndicator();
        chatList.style.transition = dragging ? 'none' : 'padding-top .18s cubic-bezier(.22, .84, .24, 1)';
        chatList.style.paddingTop = `${state.offset}px`;
        chatListPullIndicator.setAttribute('aria-hidden', 'false');
        chatListPullIndicator.style.transform = `translateY(${Math.max(0, Math.min(18, Math.round(state.offset * 0.26)))}px)`;
        sidebar.classList.toggle('is-chat-list-pull-visible', state.offset > 0 || refreshing);
        sidebar.classList.toggle('is-chat-list-pull-ready', ready);
        sidebar.classList.toggle('is-chat-list-refreshing', refreshing);
        chatListPullLabel.textContent = refreshing
          ? 'Refreshing chats...'
          : ready
            ? 'Release to refresh'
            : 'Pull to refresh';
      };

      const resetChatListPullUi = ({ immediate = false } = {}) => {
        clearResetPullUiTimer();
        state.engaged = false;
        state.offset = 0;
        sidebar.classList.remove('is-chat-list-pull-ready');
        if (immediate) {
          sidebar.classList.remove('is-chat-list-pull-visible', 'is-chat-list-refreshing');
          chatList.style.transition = '';
          chatList.style.paddingTop = '';
          chatListPullIndicator.style.transform = '';
          chatListPullIndicator.setAttribute('aria-hidden', 'true');
          chatListPullLabel.textContent = 'Pull to refresh';
          return;
        }
        chatList.style.transition = 'padding-top .18s cubic-bezier(.22, .84, .24, 1)';
        chatList.style.paddingTop = '0px';
        chatListPullIndicator.style.transform = '';
        chatListPullIndicator.setAttribute('aria-hidden', 'true');
        chatListPullLabel.textContent = 'Pull to refresh';
        resetPullUiTimer = setTimeout(() => {
          if (state.tracking || state.refreshing) return;
          sidebar.classList.remove('is-chat-list-pull-visible', 'is-chat-list-refreshing');
          chatList.style.transition = '';
          chatList.style.paddingTop = '';
          resetPullUiTimer = null;
        }, 190);
      };

      const clearPullTracking = () => {
        state.tracking = false;
        state.startY = 0;
      };

      const startChatListPullRefresh = async () => {
        if (state.refreshing) return;
        state.refreshing = true;
        setChatListPullUi(CHAT_LIST_PULL_REFRESH_OFFSET, { refreshing: true });
        chatListPullLabel.textContent = 'Reloading app...';
        animateChatHeaderActionButton('#refreshChatsBtn');
        requestAnimationFrame(() => {
          setTimeout(() => {
            window.location.reload();
          }, 80);
        });
      };

      const dampPullDistance = (distance) => Math.min(CHAT_LIST_PULL_MAX_OFFSET, Math.round(distance * 0.62));

      chatList.addEventListener('touchstart', (e) => {
        if (!isSidebarListPullAvailable() || e.touches.length !== 1) return;
        if (chatList.scrollTop > 0) return;
        state.tracking = true;
        state.engaged = false;
        state.startY = e.touches[0].clientY;
        state.offset = 0;
        positionChatListPullIndicator();
      }, { passive: true });

      chatList.addEventListener('touchmove', (e) => {
        if (!state.tracking || state.refreshing || e.touches.length !== 1) return;
        const delta = e.touches[0].clientY - state.startY;
        if (!state.engaged && delta <= CHAT_LIST_PULL_TRIGGER_PX) {
          if (delta < 0) clearPullTracking();
          return;
        }
        if (chatList.scrollTop > 0 || delta <= 0 || !isSidebarListPullAvailable()) {
          clearPullTracking();
          resetChatListPullUi({ immediate: true });
          return;
        }
        state.engaged = true;
        e.preventDefault();
        setChatListPullUi(dampPullDistance(delta), { dragging: true });
      }, { passive: false });

      const handleChatListPullEnd = async () => {
        if (!state.tracking) return;
        const shouldRefresh = state.engaged && state.offset >= CHAT_LIST_PULL_THRESHOLD && !state.refreshing;
        clearPullTracking();
        if (shouldRefresh) {
          await startChatListPullRefresh();
          return;
        }
        resetChatListPullUi();
      };

      chatList.addEventListener('touchend', () => {
        handleChatListPullEnd().catch(() => {
          state.refreshing = false;
          resetChatListPullUi();
        });
      }, { passive: true });
      chatList.addEventListener('touchcancel', () => {
        clearPullTracking();
        if (!state.refreshing) resetChatListPullUi();
      }, { passive: true });

      const syncChatListPullLayout = () => {
        if (!sidebar.classList.contains('is-chat-list-pull-visible') && !state.refreshing) return;
        positionChatListPullIndicator();
      };
      window.addEventListener('resize', syncChatListPullLayout, { passive: true });
      window.visualViewport?.addEventListener('resize', syncChatListPullLayout);
      window.visualViewport?.addEventListener('scroll', syncChatListPullLayout);
    })();

    // Sidebar search
    setChatSearchOpen(false, { clear: true, focus: false, render: false });
    chatSearchToggle?.addEventListener('click', () => {
      if (isChatSearchOpen()) {
        setChatSearchOpen(false, { clear: true, focus: true });
        return;
      }
      setChatSearchOpen(true, { focus: true });
    });
    chatSearch.addEventListener('input', () => {
      if (!isChatSearchOpen()) setChatSearchOpen(true);
      renderChatList(chatSearch.value);
    });
    chatSearchClear?.addEventListener('click', () => {
      setChatSearchOpen(false, { clear: true, focus: true });
    });

    // Back button (mobile)
    bindTouchSafeButtonActivation(backBtn, () => {
      if (hasOpenModal()) {
        closeTopModal();
        return;
      }
      if (isSearchPanelOpen()) {
        closeSearchPanel();
        return;
      }
      if (searchPanelSkipNextPopstate) {
        queueSearchPanelPendingAction(() => {
          navigateBackToChatList({ fromInAppButton: true });
        });
        return;
      }
      if (backBtn.__isNavigating) return;
      const expectsHistoryPopstate = Boolean(history.state && history.state.chat);
      const finishBackNavigation = () => {
        navigateBackToChatList({ fromInAppButton: true });
        clearTimeout(backBtn.__spinTimer);
        backBtn.classList.remove('is-spinning');
        if (expectsHistoryPopstate) {
          deferBackButtonNavigationRelease();
          return;
        }
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
      if (inAppChatBackSkipNextPopstate) {
        inAppChatBackSkipNextPopstate = false;
        searchPanelSkipNextPopstate = false;
        ivSkipNextPopstate = false;
        iosBackNavigationToken = 0;
        resetBackButtonNavigationState();
        return;
      }
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
      if (iosBackNavigationToken > 0) {
        iosBackNavigationToken -= 1;
        resetBackButtonNavigationState();
        return;
      }
      resetBackButtonNavigationState();
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
        scheduleMobileViewportRecovery(280);
        return;
      }
      if (window.innerWidth <= 768) {
        if (sidebar.classList.contains('sidebar-hidden')) {
          // Going back from chat to chat list
          navigateBackToChatList();
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

    const adminBotAuditCloseBtn = document.querySelector('#adminBotAuditModal .modal-close');
    if (adminBotAuditCloseBtn) {
      adminBotAuditCloseBtn.textContent = '\u2715';
      adminBotAuditCloseBtn.setAttribute('aria-label', 'Close');
      adminBotAuditCloseBtn.setAttribute('title', 'Close');
    }

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
    bindTouchSafeButtonActivation($('#settingsBtn'), () => openSettingsModal($('#settingsBtn')));

    // Settings sub-buttons
    $('#settingsThemePanel').addEventListener('click', openThemeSettingsModal);
    $('#settingsVisualModePanel')?.addEventListener('click', openVisualModeSettingsModal);
    $('#settingsAnimationPanel')?.addEventListener('click', openAnimationSettingsModal);
    $('#settingsMobileFontPanel')?.addEventListener('click', openMobileFontSettingsModal);
    $('#settingsWeatherPanel').addEventListener('click', openWeatherSettingsModal);
    $('#settingsNotificationsPanel')?.addEventListener('click', openNotificationSettingsModal);
    $('#settingsSoundsPanel')?.addEventListener('click', openSoundSettingsModal);
    $('#settingsAiBotsPanel')?.addEventListener('click', openAiBotSettingsModal);
    $('#settingsYandexAiPanel')?.addEventListener('click', openYandexAiSettingsModal);
    $('#settingsDeepSeekAiPanel')?.addEventListener('click', openDeepseekAiSettingsModal);
    $('#settingsGrokAiPanel')?.addEventListener('click', openGrokAiSettingsModal);
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
    $('#settingsVisualModePicker')?.addEventListener('click', (e) => {
      const card = e.target.closest('[data-visual-mode-option]');
      if (!card) return;
      selectVisualMode(card.dataset.visualModeOption);
    });
    $('#settingsPollStylePicker')?.addEventListener('click', (e) => {
      const card = e.target.closest('[data-poll-style-option]');
      if (!card) return;
      selectPollStyle(card.dataset.pollStyleOption);
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
    $('#settingsMobileFontSize')?.addEventListener('input', (e) => {
      updateMobileFontSize(e.target.value, { immediate: false });
    });
    $('#settingsMobileFontSize')?.addEventListener('change', (e) => {
      updateMobileFontSize(e.target.value, { immediate: true });
    });
    $('#settingsMobileFontSize')?.addEventListener('blur', (e) => {
      updateMobileFontSize(e.target.value, { immediate: true });
    });

    // Weather settings
    $('#settingsWeatherEnabled')?.addEventListener('change', async (e) => {
      $('#settingsWeatherControls')?.classList.toggle('hidden', !e.target.checked);
      if (!e.target.checked) await saveWeatherSettings();
    });
    bindAsyncActionButtons('settingsWeatherSearchBtn', null, 'Searching...', searchWeatherLocations);
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
        withActionButtons('settingsWeatherSearchBtn', 'Searching...', searchWeatherLocations).catch(() => {});
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
    bindAsyncActionButtons('settingsWeatherSave', null, 'Saving...', saveWeatherSettings);
    bindAsyncActionButtons('settingsWeatherRefreshNow', null, 'Refreshing...', saveWeatherSettings);

    // Notification settings
    bindAsyncActionButtons('settingsPushEnable', null, 'Enabling...', enablePushNotifications);
    bindAsyncActionButtons('settingsPushDisable', null, 'Disabling...', disablePushOnThisDevice);
    bindAsyncActionButtons('settingsPushTest', null, 'Testing...', testPushNotification);
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

    grokImageRiskCancel?.addEventListener('click', () => {
      closeModal('grokImageRiskConfirmModal');
    });
    grokImageRiskConfirm?.addEventListener('click', () => {
      const resolve = grokImageRiskConfirmResolver;
      grokImageRiskConfirmResolver = null;
      closeModal('grokImageRiskConfirmModal');
      if (typeof resolve === 'function') resolve(true);
    });

    // AI bot admin settings
    bindAsyncActionButtons('aiBotsSaveSettings', null, 'Saving...', saveAiBotSettings);
    $('#aiBotsRefreshModels')?.addEventListener('click', () => {
      if ($('#aiBotsRefreshModels')?.dataset.adminBusy === '1') return;
      aiModelRefreshTriggeredByButton = true;
      setAiModelStatus('Загружаю модели...');
      loadAiModelOptions(true).catch((e) => setAiModelStatus(e.message || 'Не удалось загрузить модели', 'error'));
    });
    bindAsyncActionButtons('aiBotsDeleteKey', null, 'Deleting...', deleteAiBotKey);
    $('#openAiOpenTextBots')?.addEventListener('click', openOpenAiTextBotsModal);
    $('#openAiOpenUniversalBots')?.addEventListener('click', openOpenAiUniversalBotsModal);
    $('#openAiOpenConvertBots')?.addEventListener('click', () => openContextConvertBotsModal('openai'));
    $('#aiBotCreateNew')?.addEventListener('click', () => {
      fillAiBotForm(null);
      setAiBotStatus('Новый бот: заполните поля и сохраните');
    });
    bindAsyncActionButtons(['aiBotSave', 'aiBotSaveBottom'], null, 'Saving...', saveAiBot);
    bindAsyncActionButtons('aiBotDisable', null, 'Disabling...', disableAiBot);
    bindAsyncActionButtons('aiBotTest', null, 'Testing...', testAiBot);
    bindAsyncActionButtons('aiBotExportJson', null, 'Preparing...', exportAiBotJson);
    $('#aiBotImportJson')?.addEventListener('click', () => $('#aiBotImportFile')?.click());
    $('#aiBotImportFile')?.addEventListener('change', (event) => importAiBotJsonFile(event.target.files?.[0]));
    $('#aiBotAvatarInput')?.addEventListener('change', (event) => uploadAiBotAvatar(event.target.files?.[0]));
    bindAsyncActionButtons('removeAiBotAvatar', null, 'Removing...', removeAiBotAvatar);
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
    bindAsyncActionButtons('aiBotChatSave', null, 'Saving...', saveAiChatBotSettings);
    $('#openAiUniversalBotCreateNew')?.addEventListener('click', () => {
      fillOpenAiUniversalBotForm(null);
      setOpenAiUniversalStatus('New OpenAI universal bot: fill fields and save');
    });
    bindAsyncActionButtons(['openAiUniversalBotSave', 'openAiUniversalBotSaveBottom'], null, 'Saving...', saveOpenAiUniversalBot);
    bindAsyncActionButtons('openAiUniversalBotDisable', null, 'Disabling...', disableOpenAiUniversalBot);
    bindAsyncActionButtons('openAiUniversalBotTest', null, 'Testing...', testOpenAiUniversalBot);
    bindAsyncActionButtons('openAiUniversalBotExportJson', null, 'Preparing...', exportOpenAiUniversalBotJson);
    $('#openAiUniversalBotImportJson')?.addEventListener('click', () => $('#openAiUniversalBotImportFile')?.click());
    $('#openAiUniversalBotImportFile')?.addEventListener('change', (event) => importOpenAiUniversalBotJsonFile(event.target.files?.[0]));
    $('#openAiUniversalBotAvatarInput')?.addEventListener('change', (event) => uploadOpenAiUniversalBotAvatar(event.target.files?.[0]));
    bindAsyncActionButtons('removeOpenAiUniversalBotAvatar', null, 'Removing...', removeOpenAiUniversalBotAvatar);
    $('#openAiUniversalBotName')?.addEventListener('input', () => {
      if (!currentOpenAiUniversalBot()?.avatar_url) renderOpenAiUniversalBotAvatar(currentOpenAiUniversalBot());
    });
    $('#openAiUniversalBotList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-bot-list-item');
      if (!btn) return;
      const bot = openAiUniversalState.bots.find(item => Number(item.id) === Number(btn.dataset.botId));
      if (bot) fillOpenAiUniversalBotForm(bot);
    });
    $('#openAiUniversalBotChatSelect')?.addEventListener('change', renderOpenAiUniversalChatBotSettings);
    $('#openAiUniversalBotChatBotSelect')?.addEventListener('change', renderOpenAiUniversalChatBotSettings);
    bindAsyncActionButtons('openAiUniversalBotChatSave', null, 'Saving...', saveOpenAiUniversalChatBotSettings);

    // Yandex AI bot admin settings
    bindAsyncActionButtons('yandexAiSaveSettings', null, 'Saving...', saveYandexAiSettings);
    bindAsyncActionButtons('yandexAiTestConnection', null, 'Testing...', testYandexAiConnection);
    bindAsyncActionButtons('yandexAiRefreshModels', null, 'Refreshing...', refreshYandexAiModels);
    bindAsyncActionButtons('yandexAiDeleteKey', null, 'Deleting...', deleteYandexAiKey);
    $('#yandexAiOpenConvertBots')?.addEventListener('click', () => openContextConvertBotsModal('yandex'));
    $('#yandexAiBotCreateNew')?.addEventListener('click', () => {
      fillYandexBotForm(null);
      setYandexBotStatus('New Yandex bot: fill fields and save');
    });
    bindAsyncActionButtons('yandexAiBotSave', null, 'Saving...', saveYandexBot);
    bindAsyncActionButtons('yandexAiBotDisable', null, 'Disabling...', disableYandexBot);
    bindAsyncActionButtons('yandexAiBotTest', null, 'Testing...', testYandexBot);
    bindAsyncActionButtons('yandexAiBotExportJson', null, 'Preparing...', exportYandexBotJson);
    $('#yandexAiBotImportJson')?.addEventListener('click', () => $('#yandexAiBotImportFile')?.click());
    $('#yandexAiBotImportFile')?.addEventListener('change', (event) => importYandexBotJsonFile(event.target.files?.[0]));
    $('#yandexAiBotAvatarInput')?.addEventListener('change', (event) => uploadYandexBotAvatar(event.target.files?.[0]));
    bindAsyncActionButtons('removeYandexAiBotAvatar', null, 'Removing...', removeYandexBotAvatar);
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
    bindAsyncActionButtons('yandexAiBotChatSave', null, 'Saving...', saveYandexChatBotSettings);

    // DeepSeek AI bot admin settings
    bindAsyncActionButtons('deepseekAiSaveSettings', null, 'Saving...', saveDeepseekAiSettings);
    bindAsyncActionButtons('deepseekAiTestConnection', null, 'Testing...', testDeepseekAiConnection);
    bindAsyncActionButtons('deepseekAiRefreshModels', null, 'Refreshing...', refreshDeepseekAiModels);
    bindAsyncActionButtons('deepseekAiDeleteKey', null, 'Deleting...', deleteDeepseekAiKey);
    $('#deepseekAiOpenTextBots')?.addEventListener('click', openDeepseekTextBotsModal);
    $('#deepseekAiOpenConvertBots')?.addEventListener('click', () => openContextConvertBotsModal('deepseek'));
    $('#deepseekAiBotCreateNew')?.addEventListener('click', () => {
      fillDeepseekBotForm(null);
      setDeepseekBotStatus('New DeepSeek bot: fill fields and save');
    });
    bindAsyncActionButtons('deepseekAiBotSave', null, 'Saving...', saveDeepseekBot);
    bindAsyncActionButtons('deepseekAiBotDisable', null, 'Disabling...', disableDeepseekBot);
    bindAsyncActionButtons('deepseekAiBotTest', null, 'Testing...', testDeepseekBot);
    bindAsyncActionButtons('deepseekAiBotExportJson', null, 'Preparing...', exportDeepseekBotJson);
    $('#deepseekAiBotImportJson')?.addEventListener('click', () => $('#deepseekAiBotImportFile')?.click());
    $('#deepseekAiBotImportFile')?.addEventListener('change', (event) => importDeepseekBotJsonFile(event.target.files?.[0]));
    $('#deepseekAiBotAvatarInput')?.addEventListener('change', (event) => uploadDeepseekBotAvatar(event.target.files?.[0]));
    bindAsyncActionButtons('removeDeepseekAiBotAvatar', null, 'Removing...', removeDeepseekBotAvatar);
    $('#deepseekAiBotName')?.addEventListener('input', () => {
      if (!currentDeepseekBot()?.avatar_url) renderDeepseekBotAvatar(currentDeepseekBot());
    });
    $('#deepseekAiBotList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-bot-list-item');
      if (!btn) return;
      const bot = deepseekBotState.bots.find(item => Number(item.id) === Number(btn.dataset.botId));
      if (bot) fillDeepseekBotForm(bot);
    });
    $('#deepseekAiBotChatSelect')?.addEventListener('change', renderDeepseekChatBotSettings);
    $('#deepseekAiBotChatBotSelect')?.addEventListener('change', renderDeepseekChatBotSettings);
    bindAsyncActionButtons('deepseekAiBotChatSave', null, 'Saving...', saveDeepseekChatBotSettings);

    // Grok AI bot admin settings
    bindAsyncActionButtons('grokAiSaveSettings', null, 'Saving...', saveGrokAiSettings);
    bindAsyncActionButtons('grokAiTestConnection', null, 'Testing...', testGrokAiConnection);
    bindAsyncActionButtons('grokAiRefreshModels', null, 'Refreshing...', refreshGrokAiModels);
    bindAsyncActionButtons('grokAiDeleteKey', null, 'Deleting...', deleteGrokAiKey);
    $('#grokAiOpenTextBots')?.addEventListener('click', openGrokTextBotsModal);
    $('#grokAiOpenImageBots')?.addEventListener('click', openGrokImageBotsModal);
    $('#grokAiOpenUniversalBots')?.addEventListener('click', openGrokUniversalBotsModal);
    $('#grokAiOpenConvertBots')?.addEventListener('click', () => openContextConvertBotsModal('grok'));
    $('#grokAiBotCreateNew')?.addEventListener('click', () => {
      fillGrokBotForm(null);
      setGrokTextEditorStatus('New Grok text bot: fill fields and save');
    });
    bindAsyncActionButtons(['grokAiBotSave', 'grokAiBotSaveBottom'], null, 'Saving...', saveGrokBot);
    bindAsyncActionButtons('grokAiBotDisable', null, 'Disabling...', () => disableGrokBot('text'));
    bindAsyncActionButtons('grokAiBotTest', null, 'Testing...', () => testGrokBot('text'));
    bindAsyncActionButtons('grokAiBotExportJson', null, 'Preparing...', () => exportGrokBotJson('text'));
    $('#grokAiBotImportJson')?.addEventListener('click', () => $('#grokAiBotImportFile')?.click());
    $('#grokAiBotImportFile')?.addEventListener('change', (event) => importGrokBotJsonFile(event.target.files?.[0], 'text'));
    $('#grokAiBotAvatarInput')?.addEventListener('change', (event) => uploadGrokBotAvatar(event.target.files?.[0], 'text'));
    bindAsyncActionButtons('removeGrokAiBotAvatar', null, 'Removing...', () => removeGrokBotAvatar('text'));
    $('#grokAiBotName')?.addEventListener('input', () => {
      if (!currentGrokBot()?.avatar_url) renderGrokBotAvatar(currentGrokBot());
    });
    [
      'grokAiBotName',
      'grokAiBotMention',
      'grokAiBotEnabled',
      'grokAiBotResponseModel',
      'grokAiBotSummaryModel',
      'grokAiBotTemperature',
      'grokAiBotMaxTokens',
      'grokAiBotStyle',
      'grokAiBotTone',
      'grokAiBotRules',
      'grokAiBotSpeech',
    ].forEach((id) => {
      $(id)?.addEventListener('input', refreshGrokTextBotDirtyState);
      $(id)?.addEventListener('change', refreshGrokTextBotDirtyState);
    });
    $('#grokAiBotList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-bot-list-item');
      if (!btn) return;
      const bot = grokBotState.bots.find(item => Number(item.id) === Number(btn.dataset.botId));
      if (bot) fillGrokBotForm(bot);
    });
    $('#grokAiBotChatSelect')?.addEventListener('change', renderGrokChatBotSettings);
    $('#grokAiBotChatBotSelect')?.addEventListener('change', renderGrokChatBotSettings);
    bindAsyncActionButtons('grokAiBotChatSave', null, 'Saving...', saveGrokChatBotSettings);

    $('#grokAiImageBotCreateNew')?.addEventListener('click', () => {
      fillGrokImageBotForm(null);
      setGrokImageEditorStatus('New Grok image bot: fill fields and save');
    });
    bindAsyncActionButtons('grokAiImageBotSave', null, 'Saving...', saveGrokImageBot);
    bindAsyncActionButtons('grokAiImageBotDisable', null, 'Disabling...', () => disableGrokBot('image'));
    bindAsyncActionButtons('grokAiImageBotTest', null, 'Testing...', () => testGrokBot('image'));
    bindAsyncActionButtons('grokAiImageBotExportJson', null, 'Preparing...', () => exportGrokBotJson('image'));
    $('#grokAiImageBotImportJson')?.addEventListener('click', () => $('#grokAiImageBotImportFile')?.click());
    $('#grokAiImageBotImportFile')?.addEventListener('change', (event) => importGrokBotJsonFile(event.target.files?.[0], 'image'));
    $('#grokAiImageBotAvatarInput')?.addEventListener('change', (event) => uploadGrokBotAvatar(event.target.files?.[0], 'image'));
    bindAsyncActionButtons('removeGrokAiImageBotAvatar', null, 'Removing...', () => removeGrokBotAvatar('image'));
    $('#grokAiImageBotName')?.addEventListener('input', () => {
      if (!currentGrokImageBot()?.avatar_url) renderGrokImageBotAvatar(currentGrokImageBot());
    });
    $('#grokAiImageBotList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-bot-list-item');
      if (!btn) return;
      const bot = grokBotState.imageBots.find(item => Number(item.id) === Number(btn.dataset.botId));
      if (bot) fillGrokImageBotForm(bot);
    });
    $('#grokAiImageBotChatSelect')?.addEventListener('change', renderGrokImageChatBotSettings);
    $('#grokAiImageBotChatBotSelect')?.addEventListener('change', renderGrokImageChatBotSettings);
    bindAsyncActionButtons('grokAiImageBotChatSave', null, 'Saving...', saveGrokImageChatBotSettings);
    $('#grokAiUniversalBotCreateNew')?.addEventListener('click', () => {
      fillGrokUniversalBotForm(null);
      setGrokUniversalEditorStatus('New Grok universal bot: fill fields and save');
    });
    bindAsyncActionButtons('grokAiUniversalBotSave', null, 'Saving...', saveGrokUniversalBot);
    bindAsyncActionButtons('grokAiUniversalBotDisable', null, 'Disabling...', disableGrokUniversalBot);
    bindAsyncActionButtons('grokAiUniversalBotTest', null, 'Testing...', testGrokUniversalBot);
    bindAsyncActionButtons('grokAiUniversalBotExportJson', null, 'Preparing...', exportGrokUniversalBotJson);
    $('#grokAiUniversalBotImportJson')?.addEventListener('click', () => $('#grokAiUniversalBotImportFile')?.click());
    $('#grokAiUniversalBotImportFile')?.addEventListener('change', (event) => importGrokUniversalBotJsonFile(event.target.files?.[0]));
    $('#grokAiUniversalBotAvatarInput')?.addEventListener('change', (event) => uploadGrokUniversalBotAvatar(event.target.files?.[0]));
    bindAsyncActionButtons('removeGrokAiUniversalBotAvatar', null, 'Removing...', removeGrokUniversalBotAvatar);
    $('#grokAiUniversalBotName')?.addEventListener('input', () => {
      if (!currentGrokUniversalBot()?.avatar_url) renderGrokUniversalBotAvatar(currentGrokUniversalBot());
    });
    $('#grokAiUniversalBotList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-bot-list-item');
      if (!btn) return;
      const bot = grokUniversalState.bots.find(item => Number(item.id) === Number(btn.dataset.botId));
      if (bot) fillGrokUniversalBotForm(bot);
    });
    $('#grokAiUniversalBotChatSelect')?.addEventListener('change', renderGrokUniversalChatBotSettings);
    $('#grokAiUniversalBotChatBotSelect')?.addEventListener('change', renderGrokUniversalChatBotSettings);
    bindAsyncActionButtons('grokAiUniversalBotChatSave', null, 'Saving...', saveGrokUniversalChatBotSettings);
    $('#contextConvertBotCreateNew')?.addEventListener('click', () => {
      selectedContextConvertBotIds[activeContextConvertProvider] = null;
      renderContextConvertAdminSettings();
      setContextConvertBotStatus('New convert bot: fill fields and save');
      setContextConvertChatStatus('');
    });
    bindAsyncActionButtons(['contextConvertBotSave', 'contextConvertBotSaveBottom'], null, 'Saving...', saveContextConvertAdminBot);
    bindAsyncActionButtons('contextConvertBotDisable', null, 'Disabling...', disableContextConvertAdminBot);
    bindAsyncActionButtons('contextConvertBotTest', null, 'Testing...', testContextConvertAdminBot);
    bindAsyncActionButtons('contextConvertBotExportJson', null, 'Preparing...', exportContextConvertAdminBot);
    $('#contextConvertBotImportJson')?.addEventListener('click', () => $('#contextConvertBotImportFile')?.click());
    $('#contextConvertBotImportFile')?.addEventListener('change', (event) => {
      importContextConvertAdminBot(event.target.files?.[0]);
      event.target.value = '';
    });
    $('#contextConvertBotList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-context-convert-bot-id]');
      if (!btn) return;
      selectedContextConvertBotIds[activeContextConvertProvider] = Number(btn.dataset.contextConvertBotId || 0) || null;
      renderContextConvertAdminSettings();
      setContextConvertBotStatus('');
      setContextConvertChatStatus('');
    });
    $('#contextConvertBotChatSelect')?.addEventListener('change', renderContextConvertChatSettings);
    $('#contextConvertBotChatBotSelect')?.addEventListener('change', renderContextConvertChatSettings);
    bindAsyncActionButtons('contextConvertBotChatSave', null, 'Saving...', saveContextConvertAdminChatSetting);

    // Change password save
    $('#cpSaveBtn').addEventListener('click', async () => {
      await withActionButtons('cpSaveBtn', 'Saving...', async () => {
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
    });

    // Menu button
    bindTouchSafeButtonActivation($('#menuBtn'), () => openMenuDrawer($('#menuBtn')));

    // Chat info button
    bindTouchSafeButtonActivation($('#chatInfoBtn'), () => {
      animateChatHeaderActionButton('#chatInfoBtn');
      openChatInfoModal($('#chatInfoBtn'));
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
    $('#profileLogoutBtn')?.addEventListener('click', () => { if (confirm('Logout?')) logout(); });

    // Load more
    loadMoreBtn.addEventListener('click', loadMore);
    const keepScrollBottomButtonKeyboardState = (e) => {
      if (!shouldPreserveKeyboardForScrollBottomGesture(e)) return;
      e.preventDefault();
    };
    const activateScrollBottomFromGesture = (e) => {
      if (Date.now() < scrollBottomFollowupClickSuppressUntil) {
        e.preventDefault?.();
        return;
      }
      if (!shouldPreserveKeyboardForScrollBottomGesture(e)) return;
      suppressScrollBottomFollowupClick();
      activateScrollBottomButton();
      e.preventDefault();
      e.stopPropagation();
    };
    scrollBottomBtn?.addEventListener('pointerdown', keepScrollBottomButtonKeyboardState, { passive: false });
    scrollBottomBtn?.addEventListener('pointerup', activateScrollBottomFromGesture, { passive: false });
    scrollBottomBtn?.addEventListener('touchstart', keepScrollBottomButtonKeyboardState, { passive: false });
    scrollBottomBtn?.addEventListener('touchend', activateScrollBottomFromGesture, { passive: false });
    scrollBottomBtn?.addEventListener('click', (e) => {
      if (Date.now() < scrollBottomFollowupClickSuppressUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      activateScrollBottomButton();
    });
    messagesEl.addEventListener('wheel', noteMessageScrollUserIntent, { passive: true });
    messagesEl.addEventListener('touchmove', noteMessageScrollUserIntent, { passive: true });

    // Scroll to load more
    messagesEl.addEventListener('scroll', () => {
      hideAvatarUserMenu();
      hideFloatingMessageActions({ immediate: true });
      if (contextConvertPickerState.active && contextConvertPickerState.mode === 'message') hideContextConvertPicker();
      else positionContextConvertPicker();
      cancelPendingMediaBottomScrollIfNeeded();
      if (!suppressScrollAnchorSave && !loadingMore && !loadingMoreAfter) scheduleScrollAnchorSave();
      maybeLoadMoreAtTop();
      maybeLoadMoreAtBottom();
      if (!suppressScrollAnchorSave && isNearBottom(8)) markCurrentChatReadIfAtBottom();
      updateScrollBottomButton();
    });

    // Close emoji picker on outside click
    document.addEventListener('click', (e) => {
      if (isFloatingSurfaceVisible(emojiPicker) && !emojiPicker.contains(e.target) && !e.target.closest('#emojiBtn')) {
        closeEmojiPicker();
      }
    });

    // Reply bar close
    $('#replyBarClose').addEventListener('click', () => {
      if (editTo) clearEdit({ clearInput: true });
      else clearReply();
    });

    // Search
    bindTouchSafeButtonActivation($('#searchBtn'), ({ isTouchLike }) => {
      animateChatHeaderActionButton('#searchBtn');
      openSearchPanel({ focusInput: true, suppressFollowupClick: isTouchLike });
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
        if (contextConvertPickerState.active) {
          e.preventDefault();
          hideContextConvertPicker();
          return;
        }
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
        if (isChatSearchOpen()) {
          e.preventDefault();
          setChatSearchOpen(false, { clear: true, focus: true });
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
    setChatSearchOpen(false, { clear: true, focus: false, render: false });
    hydrateChatListCache();

    setupMobileViewportHeightSync();
    window.addEventListener('resize', syncMobileFontSizeViewportState, { passive: true });
    window.addEventListener('orientationchange', syncMobileFontSizeViewportState);
    window.visualViewport?.addEventListener('resize', syncMobileFontSizeViewportState);

    // Mobile navigation: set initial history state for chat list
    if (window.innerWidth <= 768) {
      history.replaceState({ view: 'chatlist' }, '');
    }

    // Verify token
    try {
      const data = await api('/api/auth/me');
      currentUser = data.user;
      applyUiTheme(currentUser.ui_theme);
      applyVisualMode(currentUser.ui_visual_mode);
      applyModalAnimation(currentUser.ui_modal_animation);
      applyModalAnimationSpeed(currentUser.ui_modal_animation_speed);
      applyMobileFontSize(currentUser.ui_mobile_font_size);
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

    ensureBotVisibilityToggles();
    registerBuiltinModals();
    setupEvents();
    setupChatAreaMetricsSync();
    resetPollComposer();
    resetPollVotersModal();
    refreshPollComposerActionState();
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
