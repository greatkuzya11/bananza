(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  bootRoot.runLegacyRuntime = function runLegacyRuntime(ctx) {
      'use strict';
      if (ctx && typeof ctx === 'object') window.__bananzaBootContext = ctx;
    
      const appRuntime = window.BananzaApp || null;
      const appConfig = window.BananzaApp?.config || {};
      const i18nHelpers = window.BananzaApp?.i18nHelpers || {};
      const formatters = window.BananzaApp?.formatters || {};
      const attachmentHelpers = window.BananzaApp?.attachments || {};
      const customEmoji = window.BananzaApp?.customEmoji || {};
    
      function requireCoreExport(source, name) {
        if (source && Object.prototype.hasOwnProperty.call(source, name)) return source[name];
        throw new Error(`BananzaApp core helper "${name}" is not available`);
      }
    
      function requireCoreFunction(source, name) {
        const value = requireCoreExport(source, name);
        if (typeof value !== 'function') {
          throw new Error(`BananzaApp core helper "${name}" must be a function`);
        }
        return value;
      }
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // CONFIG
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      const WS_URL = requireCoreExport(appConfig, 'WS_URL');
      const PAGE_SIZE = requireCoreExport(appConfig, 'PAGE_SIZE');
      const MESSAGE_CACHE_LIMIT = requireCoreExport(appConfig, 'MESSAGE_CACHE_LIMIT');
      const MESSAGE_BACKGROUND_SYNC_CONCURRENCY = requireCoreExport(appConfig, 'MESSAGE_BACKGROUND_SYNC_CONCURRENCY');
      const MESSAGE_BACKGROUND_SYNC_MAX_CHATS = requireCoreExport(appConfig, 'MESSAGE_BACKGROUND_SYNC_MAX_CHATS');
      const MESSAGE_BACKGROUND_SYNC_MAX_PAGES = requireCoreExport(appConfig, 'MESSAGE_BACKGROUND_SYNC_MAX_PAGES');
      const MENTION_PICKER_TAP_DEAD_ZONE = requireCoreExport(appConfig, 'MENTION_PICKER_TAP_DEAD_ZONE');
      const MAX_MSG = requireCoreExport(appConfig, 'MAX_MSG');
      const MAX_ATTACHMENTS = requireCoreExport(appConfig, 'MAX_ATTACHMENTS');
      const MAX_FILE_SIZE = requireCoreExport(appConfig, 'MAX_FILE_SIZE');
      const MAX_FILE_SIZE_LABEL = requireCoreExport(appConfig, 'MAX_FILE_SIZE_LABEL');
      const VIDEO_POSTER_MIME = requireCoreExport(appConfig, 'VIDEO_POSTER_MIME');
      const VIDEO_POSTER_MAX_DIMENSION = requireCoreExport(appConfig, 'VIDEO_POSTER_MAX_DIMENSION');
      const VIDEO_POSTER_QUALITY = requireCoreExport(appConfig, 'VIDEO_POSTER_QUALITY');
      const VIDEO_POSTER_CAPTURE_TIMEOUT_MS = requireCoreExport(appConfig, 'VIDEO_POSTER_CAPTURE_TIMEOUT_MS');
      const VIDEO_POSTER_CAPTURE_SEEKS = requireCoreExport(appConfig, 'VIDEO_POSTER_CAPTURE_SEEKS');
      const POLL_MIN_OPTIONS = requireCoreExport(appConfig, 'POLL_MIN_OPTIONS');
      const POLL_MAX_OPTIONS = requireCoreExport(appConfig, 'POLL_MAX_OPTIONS');
      const POLL_CLOSE_PRESET_MS = requireCoreExport(appConfig, 'POLL_CLOSE_PRESET_MS');
      const IMAGE_MIME_TYPES = requireCoreExport(appConfig, 'IMAGE_MIME_TYPES');
      const AUDIO_MIME_TYPES = requireCoreExport(appConfig, 'AUDIO_MIME_TYPES');
      const VIDEO_MIME_TYPES = requireCoreExport(appConfig, 'VIDEO_MIME_TYPES');
      const IMAGE_EXTENSIONS = requireCoreExport(appConfig, 'IMAGE_EXTENSIONS');
      const AUDIO_EXTENSIONS = requireCoreExport(appConfig, 'AUDIO_EXTENSIONS');
      const VIDEO_EXTENSIONS = requireCoreExport(appConfig, 'VIDEO_EXTENSIONS');
      const UI_THEMES = requireCoreExport(appConfig, 'UI_THEMES');
      const UI_THEME_IDS = requireCoreExport(appConfig, 'UI_THEME_IDS');
      const UI_VISUAL_MODES = requireCoreExport(appConfig, 'UI_VISUAL_MODES');
      const UI_VISUAL_MODE_IDS = requireCoreExport(appConfig, 'UI_VISUAL_MODE_IDS');
      const POLL_STYLES = requireCoreExport(appConfig, 'POLL_STYLES');
      const POLL_STYLE_IDS = requireCoreExport(appConfig, 'POLL_STYLE_IDS');
      const MODAL_ANIMATION_STYLES = requireCoreExport(appConfig, 'MODAL_ANIMATION_STYLES');
      const MODAL_ANIMATION_STYLE_IDS = requireCoreExport(appConfig, 'MODAL_ANIMATION_STYLE_IDS');
      const MODAL_ANIMATION_SPEED_DEFAULT = requireCoreExport(appConfig, 'MODAL_ANIMATION_SPEED_DEFAULT');
      const MODAL_ANIMATION_SPEED_FACTORS = requireCoreExport(appConfig, 'MODAL_ANIMATION_SPEED_FACTORS');
      const MOBILE_FONT_SIZE_DEFAULT = requireCoreExport(appConfig, 'MOBILE_FONT_SIZE_DEFAULT');
      const MOBILE_FONT_SIZE_MIN = requireCoreExport(appConfig, 'MOBILE_FONT_SIZE_MIN');
      const MOBILE_FONT_SIZE_MAX = requireCoreExport(appConfig, 'MOBILE_FONT_SIZE_MAX');
      const MOBILE_FONT_SIZE_PERCENTS = requireCoreExport(appConfig, 'MOBILE_FONT_SIZE_PERCENTS');
      const MODAL_TRANSITION_BUFFER_MS = requireCoreExport(appConfig, 'MODAL_TRANSITION_BUFFER_MS');
      const CHAT_LIST_CACHE_VERSION = requireCoreExport(appConfig, 'CHAT_LIST_CACHE_VERSION');
      const CHAT_LIST_CACHE_SYNC_DEBOUNCE_MS = requireCoreExport(appConfig, 'CHAT_LIST_CACHE_SYNC_DEBOUNCE_MS');
      const CHAT_LIST_REQUEST_TIMEOUT_MS = requireCoreExport(appConfig, 'CHAT_LIST_REQUEST_TIMEOUT_MS');
      const RECOVERY_SYNC_MIN_INTERVAL_MS = requireCoreExport(appConfig, 'RECOVERY_SYNC_MIN_INTERVAL_MS');
      const RECOVERY_CATCHUP_MAX_PAGES = requireCoreExport(appConfig, 'RECOVERY_CATCHUP_MAX_PAGES');
      const PAGINATION_FETCH_MAX_PAGES = requireCoreExport(appConfig, 'PAGINATION_FETCH_MAX_PAGES');
      const PAGINATION_TOP_THRESHOLD = requireCoreExport(appConfig, 'PAGINATION_TOP_THRESHOLD');
      const PAGINATION_BOTTOM_THRESHOLD = requireCoreExport(appConfig, 'PAGINATION_BOTTOM_THRESHOLD');
      const SCROLL_DATE_HIDE_DELAY_MS = requireCoreExport(appConfig, 'SCROLL_DATE_HIDE_DELAY_MS');
      const CHAT_LIST_PULL_TRIGGER_PX = requireCoreExport(appConfig, 'CHAT_LIST_PULL_TRIGGER_PX');
      const CHAT_LIST_PULL_THRESHOLD = requireCoreExport(appConfig, 'CHAT_LIST_PULL_THRESHOLD');
      const CHAT_LIST_PULL_MAX_OFFSET = requireCoreExport(appConfig, 'CHAT_LIST_PULL_MAX_OFFSET');
      const CHAT_LIST_PULL_REFRESH_OFFSET = requireCoreExport(appConfig, 'CHAT_LIST_PULL_REFRESH_OFFSET');
      const CHAT_FOLDER_SWIPE_START_PX = requireCoreExport(appConfig, 'CHAT_FOLDER_SWIPE_START_PX');
      const CHAT_FOLDER_SWIPE_COMMIT_MIN_PX = requireCoreExport(appConfig, 'CHAT_FOLDER_SWIPE_COMMIT_MIN_PX');
      const CHAT_FOLDER_SWIPE_COMMIT_RATIO = requireCoreExport(appConfig, 'CHAT_FOLDER_SWIPE_COMMIT_RATIO');
      const CHAT_FOLDER_SWIPE_EDGE_DAMPING = requireCoreExport(appConfig, 'CHAT_FOLDER_SWIPE_EDGE_DAMPING');
      const CHAT_FOLDER_SWIPE_EDGE_MAX_PX = requireCoreExport(appConfig, 'CHAT_FOLDER_SWIPE_EDGE_MAX_PX');
      const HORIZONTAL_PAGER_SWIPE_START_PX = requireCoreExport(appConfig, 'HORIZONTAL_PAGER_SWIPE_START_PX');
      const HORIZONTAL_PAGER_SWIPE_COMMIT_MIN_PX = requireCoreExport(appConfig, 'HORIZONTAL_PAGER_SWIPE_COMMIT_MIN_PX');
      const HORIZONTAL_PAGER_SWIPE_COMMIT_RATIO = requireCoreExport(appConfig, 'HORIZONTAL_PAGER_SWIPE_COMMIT_RATIO');
      const HORIZONTAL_PAGER_SWIPE_EDGE_DAMPING = requireCoreExport(appConfig, 'HORIZONTAL_PAGER_SWIPE_EDGE_DAMPING');
      const HORIZONTAL_PAGER_SWIPE_EDGE_MAX_PX = requireCoreExport(appConfig, 'HORIZONTAL_PAGER_SWIPE_EDGE_MAX_PX');
      const RESUME_WS_REFRESH_AFTER_MS = requireCoreExport(appConfig, 'RESUME_WS_REFRESH_AFTER_MS');
      const NOTES_CHAT_EMOJI = requireCoreExport(appConfig, 'NOTES_CHAT_EMOJI');
      const CHAT_CONTEXT_LONG_PRESS_MS = requireCoreExport(appConfig, 'CHAT_CONTEXT_LONG_PRESS_MS');
      const MEDIA_CONTEXT_LONG_PRESS_MS = requireCoreExport(appConfig, 'MEDIA_CONTEXT_LONG_PRESS_MS');
      const MEDIA_CONTEXT_TARGET_SELECTOR = requireCoreExport(appConfig, 'MEDIA_CONTEXT_TARGET_SELECTOR');
      const ALL_CHATS_FOLDER_ID = requireCoreExport(appConfig, 'ALL_CHATS_FOLDER_ID');
      const CHAT_FOLDER_ICON_EMOJI = requireCoreExport(appConfig, 'CHAT_FOLDER_ICON_EMOJI');
      const aiImageRiskApi = window.BananzaAiImageRisk || null;
      const i18n = window.BananzaI18n || null;
      const t = typeof i18nHelpers.t === 'function'
        ? (key, params = {}) => i18nHelpers.t(key, params)
        : (key, params = {}) => (i18n?.t ? i18n.t(key, params) : String(key || ''));
      const tx = typeof i18nHelpers.tx === 'function'
        ? (text, params = {}) => i18nHelpers.tx(text, params)
        : (text, params = {}) => {
          if (i18n?.text) return i18n.text(text, params);
          if (i18n?.t) return i18n.t(text, params);
          return String(text == null ? '' : text);
        };
      const esc = requireCoreFunction(formatters, 'esc');
      const formatTime = requireCoreFunction(formatters, 'formatTime');
      const formatChatListTimestamp = requireCoreFunction(formatters, 'formatChatListTimestamp');
      const formatDate = requireCoreFunction(formatters, 'formatDate');
      const formatSize = requireCoreFunction(formatters, 'formatSize');
      const fileExtension = requireCoreFunction(formatters, 'fileExtension');
      const normalizeMimeType = requireCoreFunction(formatters, 'normalizeMimeType');
      const formatRelativeDuration = requireCoreFunction(formatters, 'formatRelativeDuration');
      const formatPollDeadline = requireCoreFunction(formatters, 'formatPollDeadline');
      const initials = requireCoreFunction(formatters, 'initials');
      const getStoredAttachmentUrl = requireCoreFunction(attachmentHelpers, 'getStoredAttachmentUrl');
      const getStoredAttachmentPosterUrl = requireCoreFunction(attachmentHelpers, 'getStoredAttachmentPosterUrl');
      const resolveAttachmentUrl = requireCoreFunction(attachmentHelpers, 'resolveAttachmentUrl');
      const getAttachmentPreviewUrl = requireCoreFunction(attachmentHelpers, 'getAttachmentPreviewUrl');
      const getAttachmentDownloadUrl = requireCoreFunction(attachmentHelpers, 'getAttachmentDownloadUrl');
      const getAttachmentPosterUrl = requireCoreFunction(attachmentHelpers, 'getAttachmentPosterUrl');
      const isVideoAttachmentMessage = requireCoreFunction(attachmentHelpers, 'isVideoAttachmentMessage');
      const createTimeoutError = requireCoreFunction(attachmentHelpers, 'createTimeoutError');
      const waitForMediaEvent = requireCoreFunction(attachmentHelpers, 'waitForMediaEvent');
      const waitForVideoFrame = requireCoreFunction(attachmentHelpers, 'waitForVideoFrame');
      const seekVideoFrame = requireCoreFunction(attachmentHelpers, 'seekVideoFrame');
      const drawVideoPosterBlob = requireCoreFunction(attachmentHelpers, 'drawVideoPosterBlob');
      const createAttachmentPosterBlob = requireCoreFunction(attachmentHelpers, 'createAttachmentPosterBlob');
      const CUSTOM_EMOJI_CATALOGS = requireCoreExport(customEmoji, 'CUSTOM_EMOJI_CATALOGS');
      const CUSTOM_EMOJI_BY_CATEGORY = requireCoreExport(customEmoji, 'CUSTOM_EMOJI_BY_CATEGORY');
      const getCustomEmoji = requireCoreFunction(customEmoji, 'getCustomEmoji');
      const getCustomEmojiCatalog = requireCoreFunction(customEmoji, 'getCustomEmojiCatalog');
      const isCustomEmojiToken = requireCoreFunction(customEmoji, 'isCustomEmojiToken');
      const isSingleCustomEmojiMessage = requireCoreFunction(customEmoji, 'isSingleCustomEmojiMessage');
      const getCustomEmojiRenderedSize = requireCoreFunction(customEmoji, 'getCustomEmojiRenderedSize');
      const renderCustomEmojiHtml = requireCoreFunction(customEmoji, 'renderCustomEmojiHtml');
      const getComposerCustomEmojiCluster = requireCoreFunction(customEmoji, 'getComposerCustomEmojiCluster');
      const getComposerCustomEmojiItemFromMarker = requireCoreFunction(customEmoji, 'getComposerCustomEmojiItemFromMarker');
      const getComposerCustomEmojiClusterEnd = requireCoreFunction(customEmoji, 'getComposerCustomEmojiClusterEnd');
      const findComposerCustomEmojiClusterAt = requireCoreFunction(customEmoji, 'findComposerCustomEmojiClusterAt');
      const findComposerCustomEmojiClusterBefore = requireCoreFunction(customEmoji, 'findComposerCustomEmojiClusterBefore');
      const findComposerCustomEmojiClusterAfter = requireCoreFunction(customEmoji, 'findComposerCustomEmojiClusterAfter');
      const composerCustomEmojiClusterBoundary = requireCoreFunction(customEmoji, 'composerCustomEmojiClusterBoundary');
      const normalizeComposerTextToInternal = requireCoreFunction(customEmoji, 'normalizeComposerTextToInternal');
      const serializeComposerTextValue = requireCoreFunction(customEmoji, 'serializeComposerTextValue');
      const grokImageRiskRetryPending = new Set();
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // STATE
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      const runtimeState = ctx?.state || bootRoot.createInitialState?.() || {};
      const coreApiService = ctx?.services?.api || bootRoot.createApiService?.(ctx || { state: runtimeState, tx }) || {};
      const authService = ctx?.services?.auth || bootRoot.createAuthService?.(ctx || { state: runtimeState }) || {};
      const websocketService = ctx?.services?.websocket || bootRoot.createWebSocketService?.(ctx || { state: runtimeState, config: appConfig }) || {};
      const chatListService = ctx?.services?.chatList || bootRoot.createChatListService?.(ctx || { state: runtimeState }) || {};
      const openChatService = ctx?.services?.openChat || bootRoot.createOpenChatService?.(ctx || { state: runtimeState }) || {};
      const messagesService = ctx?.services?.messages || bootRoot.createMessagesService?.(ctx || { state: runtimeState }) || {};
      if (ctx?.services && !ctx.services.chatList) ctx.services.chatList = chatListService;
      if (ctx?.services && !ctx.services.openChat) ctx.services.openChat = openChatService;
      if (ctx?.services && !ctx.services.messages) ctx.services.messages = messagesService;
      let currentUser = runtimeState.getCurrentUser?.() || runtimeState.currentUser || null;
      let token = runtimeState.getToken?.() || runtimeState.token || null;
      let chats = chatListService.getChats?.() || runtimeState.chats || [];
      let currentChatId = runtimeState.getCurrentChatId?.() || runtimeState.currentChatId || null;
      let ws = runtimeState.getWs?.() || runtimeState.ws || null;
      let wsRetry = runtimeState.wsRetry || 1000;
      let wsReconnectTimer = runtimeState.wsReconnectTimer || null;
      let onlineUsers = chatListService.getOnlineUsers?.() || (runtimeState.onlineUsers instanceof Set ? runtimeState.onlineUsers : new Set());
      let chatMembersCache = runtimeState.chatMembersCache instanceof Map ? runtimeState.chatMembersCache : new Map();
      let chatPinsByChat = runtimeState.chatPinsByChat instanceof Map ? runtimeState.chatPinsByChat : new Map();
      let activePinIndexByChat = runtimeState.activePinIndexByChat instanceof Map ? runtimeState.activePinIndexByChat : new Map();
      let allUsers = chatListService.getAllUsers?.() || (Array.isArray(runtimeState.allUsers) ? runtimeState.allUsers : []);
      const refreshChatListReferences = () => {
        chats = chatListService.getChats?.() || chats;
        allUsers = chatListService.getAllUsers?.() || allUsers;
        onlineUsers = chatListService.getOnlineUsers?.() || onlineUsers;
        return { chats, allUsers, onlineUsers };
      };
      function syncCoreStateFromRuntime() {
        currentUser = runtimeState.getCurrentUser?.() || runtimeState.currentUser || null;
        token = runtimeState.getToken?.() || runtimeState.token || null;
        currentChatId = runtimeState.getCurrentChatId?.() || runtimeState.currentChatId || null;
        ws = runtimeState.getWs?.() || runtimeState.ws || null;
        wsRetry = runtimeState.wsRetry || 1000;
        wsReconnectTimer = runtimeState.wsReconnectTimer || null;
        return runtimeState;
      }
      function syncCoreStateToRuntime() {
        runtimeState.chats = chats;
        runtimeState.currentUser = currentUser || null;
        runtimeState.token = token || null;
        runtimeState.currentChatId = currentChatId || null;
        runtimeState.currentChat = getChatById(currentChatId);
        runtimeState.ws = ws || null;
        runtimeState.wsRetry = wsRetry || 1000;
        runtimeState.wsReconnectTimer = wsReconnectTimer || null;
        runtimeState.onlineUsers = onlineUsers;
        runtimeState.chatMembersCache = chatMembersCache;
        runtimeState.chatPinsByChat = chatPinsByChat;
        runtimeState.activePinIndexByChat = activePinIndexByChat;
        runtimeState.allUsers = allUsers;
        chatListService.syncRuntimeState?.();
        openChatService.syncRuntimeState?.();
        refreshChatListReferences();
        return runtimeState;
      }
      const api = (url, opts = {}) => coreApiService.request(url, opts);
      const chatListStoreApi = window.BananzaApp.chatList.store;
      const localChatPreferenceEnabled = (value) => chatListStoreApi.localChatPreferenceEnabled(value);
      const getChatPinOrder = (chat) => chatListStoreApi.getChatPinOrder(chat);
      const normalizeChatListEntry = (chat = {}) => chatListStoreApi.normalizeChatListEntry(chat);
      const compareChatActivity = (a, b) => chatListStoreApi.compareChatActivity(a, b);
      const compareChatsForList = (a, b) => chatListStoreApi.compareChatsForList(a, b);
      const getChatLastPreviewText = (chat) => chatListStoreApi.getChatLastPreviewText(chat);
      const getChatSearchHaystack = (chat) => chatListStoreApi.getChatSearchHaystack(chat);
      const renderCustomEmojiPreviewHtml = (text, options = {}) => chatListService.renderCustomEmojiPreviewHtml?.(text, options) || '';
      const renderChatLastPreviewHtml = (chat, options = {}) => chatListService.renderChatLastPreviewHtml?.(chat, options) || '';
      const chatListCacheKey = () => chatListService.chatListCacheKey?.() || '';
      const normalizeCachedChats = (rawChats) => chatListService.normalizeCachedChats?.(rawChats) || [];
      const readChatListCache = () => chatListService.readChatListCache?.() || [];
      const collectChatAvatarUrls = (sourceChats = chats) => chatListService.collectChatAvatarUrls?.(sourceChats) || [];
      const warmChatListAvatarAssets = (sourceChats = chats) => chatListService.warmChatListAvatarAssets?.(sourceChats);
      const persistChatListCache = () => chatListService.persistChatListCache?.();
      const scheduleChatListCacheSync = () => chatListService.scheduleChatListCacheSync?.();
      const setChatListStatus = (message = '', type = '') => chatListService.setChatListStatus?.(message, type);
      const isChatListWaitingForActiveFolder = (folderId) => chatListService.isChatListWaitingForActiveFolder?.(folderId);
      const hydrateChatListCache = () => chatListService.hydrateChatListCache?.();
      const loadChats = (options = {}) => Promise.resolve(chatListService.loadChats?.(options)).then((result) => {
        refreshChatListReferences();
        return result || chats;
      });
      const loadAllUsers = () => Promise.resolve(chatListService.loadAllUsers?.()).then((result) => {
        refreshChatListReferences();
        return result || allUsers;
      });
      const renderChatList = (filter = '') => chatListService.renderChatList?.(filter);
      const renderChatListInto = (parent = chatList, options = {}) => chatListService.renderChatListInto?.(parent, options);
      const updateChatListLastMessage = (msg) => chatListService.updateChatListLastMessage?.(msg);
      const updateOnlineDisplay = () => chatListService.updateOnlineDisplay?.();
      const scheduleRecoverySync = (reason = 'event', options = {}) => chatListService.scheduleRecoverySync?.(reason, options);
      const runRecoverySync = (reason = 'event') => chatListService.runRecoverySync?.(reason);
      const refreshWebSocketAfterResume = () => chatListService.refreshWebSocketAfterResume?.();
      const handleAppResume = (reason) => chatListService.handleAppResume?.(reason);
      const setupLifecycleRecovery = () => chatListService.setupLifecycleRecovery?.();
      const openChat = (chatId, options = {}) => openChatService.openChat?.(chatId, options);
      const openChatFromPush = (chatId) => openChatService.openChatFromPush?.(chatId);
      const catchUpCurrentChat = (chatId, options = {}) => openChatService.catchUpCurrentChat?.(chatId, options);
      const loadMore = () => openChatService.loadMore?.();
      const loadMoreAfter = () => openChatService.loadMoreAfter?.();
      const updateHasMoreAfterFromChat = (chatId = currentChatId) => openChatService.updateHasMoreAfterFromChat?.(chatId);
      const maybeLoadMoreAtTop = () => openChatService.maybeLoadMoreAtTop?.();
      const maybeLoadMoreAtBottom = () => openChatService.maybeLoadMoreAtBottom?.();
      const isNearBottom = (threshold = 150) => openChatService.isNearBottom?.(threshold);
      const scrollToBottom = (instant = false, markRead = false, options = {}) => openChatService.scrollToBottom?.(instant, markRead, options);
      const saveCurrentScrollAnchor = (chatId = currentChatId, options = {}) => openChatService.saveCurrentScrollAnchor?.(chatId, options);
      const flushCurrentChatScrollAnchor = (chatId = currentChatId, options = {}) => openChatService.flushCurrentChatScrollAnchor?.(chatId, options);
      const scheduleScrollAnchorSave = () => openChatService.scheduleScrollAnchorSave?.();
      const restoreScrollAnchor = (anchor, attempts = 3, options = {}) => openChatService.restoreScrollAnchor?.(anchor, attempts, options);
      const markCurrentChatReadIfAtBottom = (force = false) => openChatService.markCurrentChatReadIfAtBottom?.(force);
      const markChatReadThrough = (chatId, lastReadId) => openChatService.markChatReadThrough?.(chatId, lastReadId);
      const setHasMoreBefore = (value) => openChatService.setHasMoreBefore?.(value);
      const setLoadMoreAfterLoading = (value) => openChatService.setLoadMoreAfterLoading?.(value);
      const setHasMoreAfter = (value) => openChatService.setHasMoreAfter?.(value);
      const getMessagesAfterLoader = () => openChatService.getMessagesAfterLoader?.();
      const getMessagesLastContentChild = () => openChatService.getMessagesLastContentChild?.();
      const insertAtMessagesEnd = (node) => openChatService.insertAtMessagesEnd?.(node);
      const buildMessagesRootChildren = (fragment = null) => openChatService.buildMessagesRootChildren?.(fragment);
      const messageIdKey = (id) => openChatService.messageIdKey?.(id);
      const getMessageIdNumber = (msg) => openChatService.getMessageIdNumber?.(msg);
      const minMessageId = (messages = []) => openChatService.minMessageId?.(messages);
      const maxMessageId = (messages = []) => openChatService.maxMessageId?.(messages);
      const filterNewMessages = (messages = []) => openChatService.filterNewMessages?.(messages) || [];
      const getChatLastMessageId = (chatId, fallback = 0) => openChatService.getChatLastMessageId?.(chatId, fallback);
      const cacheMessages = (chatId, messages = [], page = null, options = {}) => openChatService.cacheMessages?.(chatId, messages, page, options);
      const writeCachedChatMeta = (chatId, patch = {}) => openChatService.writeCachedChatMeta?.(chatId, patch);
      const readCachedChatRange = (chatId) => openChatService.readCachedChatRange?.(chatId);
      const debugMessageCache = (event, detail = {}) => openChatService.debugMessageCache?.(event, detail);
      const warmMessageWindowAssets = (chat, messages = []) => openChatService.warmMessageWindowAssets?.(chat, messages);
      const cacheCursorPage = (chatId, direction, cursor, messages = [], page = {}) => openChatService.cacheCursorPage?.(chatId, direction, cursor, messages, page);
      const readCachedCursorPage = (chatId, direction, cursor) => openChatService.readCachedCursorPage?.(chatId, direction, cursor);
      const scrollAnchorStorageKey = () => openChatService.scrollAnchorStorageKey?.();
      const ensureScrollAnchorsLoaded = () => openChatService.ensureScrollAnchorsLoaded?.();
      const persistScrollAnchors = () => openChatService.persistScrollAnchors?.();
      const getRenderedMessageRows = () => openChatService.getRenderedMessageRows?.() || [];
      const ensureScrollDateIndicator = () => openChatService.ensureScrollDateIndicator?.();
      const hideScrollDateIndicator = (options = {}) => openChatService.hideScrollDateIndicator?.(options);
      const pickScrollDateMessageRow = () => openChatService.pickScrollDateMessageRow?.();
      const getScrollDateTextForRow = (row) => openChatService.getScrollDateTextForRow?.(row);
      const positionScrollDateIndicator = (el) => openChatService.positionScrollDateIndicator?.(el);
      const updateScrollDateIndicator = (options = {}) => openChatService.updateScrollDateIndicator?.(options);
      const scheduleScrollDateIndicatorUpdate = (options = {}) => openChatService.scheduleScrollDateIndicatorUpdate?.(options);
      const refreshScrollDateIndicator = () => openChatService.refreshScrollDateIndicator?.();
      const pickScrollAnchorRow = (rows, atBottom, containerRect) => openChatService.pickScrollAnchorRow?.(rows, atBottom, containerRect);
      const findRestorableAnchorRow = (anchor) => openChatService.findRestorableAnchorRow?.(anchor);
      const getMaxRenderedMessageId = () => openChatService.getMaxRenderedMessageId?.() || 0;
      const captureScrollAnchor = () => openChatService.captureScrollAnchor?.();
      const canCaptureCurrentChatScrollAnchor = (chatId = currentChatId) => openChatService.canCaptureCurrentChatScrollAnchor?.(chatId);
      const clearScheduledScrollAnchorSave = () => openChatService.clearScheduledScrollAnchorSave?.();
      const anchorForChatOpen = (chat) => openChatService.anchorForChatOpen?.(chat, scrollRestoreMode);
      const messageServiceCall = (method, ...args) => messagesService?.[method]?.(...args);
      const messageServiceDelegates = new Proxy({}, {
        get: (_target, method) => (...args) => messageServiceCall(method, ...args),
      });
      const {
        normalizePoll, isPollMessage, isPulsePoll, pulseInlineVotersCacheKey, getPulseInlineVotersRevision,
        invalidatePulseInlineVotersForMessage, getPulseVoterDisplayName, isPulseVoterOptionExpanded,
        getPulseVoterPopoverElement, schedulePulseVoterPopoverAutoHide, mountPulseVoterPopover,
        clearActivePulseVoterPopover, clearActivePulseVoterPopoverForMessage, bindPulseInlineVoterControls,
        togglePulseVoterOptionExpanded, togglePulseVoterPopover, getPollCompactFooterMeta, canClosePollMessage,
        buildOptimisticPollState, nextPollVoteSelection, resetReusableMessageRow, withStableOutboxMedia,
        replaceRenderedMessage, replaceRenderedPollCard, applyPollUpdate, togglePollVote, closePollMessage,
        pollAccentVar, buildPollRenderState, buildPollOrbitGradient, renderPollCloseButton, renderPollCompactFooter,
        renderPollVotersButton, renderPulseInlineVoterAvatar, renderPulseInlineVoterStack, buildPulsePreviewVoters,
        renderPulseInlineVoterSummaryContent, renderPulseInlineVoterSummary, refreshPulseInlineVoterSlots,
        ensurePulseInlineVoters, hydratePulseInlineVoters, renderPulsePollCard, renderStackPollCard, renderOrbitPollCard,
        resetPollVotersModal, openPollVotersModal, renderPollCard, updateVisibleOwnReadStateRows,
        clearRenderedMessages, getRenderedMessageIdList, renderedMessageIdsMatch, pinEventIdKey, rememberPinEvent,
        isPinEventDisplayed, filterNewPinEvents, timelineTimestamp, buildTimelineItems, renderPinSystemEvent,
        buildMessagesFragment, replaceRenderedMessages, primeAppendedMessageSideEffects, appendTimelineItems,
        appendPinEventIfVisible, isCurrentMessageRow, messageHasDeferredMediaLayout, clearPendingMediaBottomScroll,
        noteMessageScrollUserIntent, scheduleMediaBottomScrollAnchorSave, settleDeferredMediaBottomScroll,
        markPendingMediaBottomScroll, markPendingMediaBottomScrollForMessages, cancelPendingMediaBottomScrollIfNeeded,
        createMessageGroup, renderMessages, appendMessage, bindPollControls, createMessageEl, updateRowStatus,
        retrySend, formatDuration, renderResolvedFileAttachment, renderFileAttachment, renderLinkPreview,
        resolveCallMessageMediaKind, resolveCallMessageRoomMode, normalizeCallMessageData, latestCallTranscriptRun,
        latestCallArtifactBatch, callArtifactProgress, pushCallMessageMeta, renderCallMessageMeta,
        normalizeCallMixedRecording, callRecordingPlaybackUrl, callRecordingDurationSeconds,
        parseCallRecordingRadiusValue, callRecordingRoundedRectPath, ensureCallRecordingFooterButton,
        ensureCallRecordingProgress, refreshCallRecordingProgressShape, updateCallRecordingProgress,
        syncCallRecordingPlayButton, pointToCallRecordingHit, shouldIgnoreCallRecordingPointer,
        isPointerNearCallRecordingProgressRect, getCallRecordingSeekRows, seekCallRecordingProgress,
        resolveNearestCallRecordingHit, installCallRecordingProgressCapture, renderCallMessageCard,
        renderCallTranscriptRunCard, callArtifactStatusLabel, callArtifactStatusKind, callArtifactKey,
        callArtifactLabel, renderCallArtifactStatus, callArtifactTextShouldCollapse, renderCallArtifactTextLine,
        renderCallArtifactText, callArtifactImageUrl, callArtifactImageMime, callArtifactImageFilename,
        callArtifactImageContext, renderCallArtifactImage, renderCallArtifactRun, renderCallArtifactBatchCard,
        bindCallMessageControls, openCallArtifactsModal, bindCallArtifactMessageControls,
        bindCallTranscriptMessageControls, cleanupDuplicateDateSeparators, refreshDateSeparators,
        outboxUrlKey, getOutboxObjectUrl, revokeOutboxObjectUrls, findOutboxRow, removeDuplicatePromotedRows,
        promoteOutboxRow, cleanupEmptyMessageGroups, removeOutboxRows, buildLocalMessageFromOutbox,
        renderOutboxItem, renderOutboxForChat, scheduleRetryLayout, layoutRetryButtons, persistOutboxItem,
        setOutboxSending, uploadOutboxAttachment, sendOutboxMessageItem, sendOutboxVoiceItem,
        sendOutboxVideoNoteItem, completeOutboxSend, trySendOutboxItem, queueOutboxItem,
        createMessageOutboxItem, queueVoiceOutbox, queueVideoNoteOutbox, deleteMessage, markMessageDeleted,
        updateVisibleReplyQuotesFromMessage, applyMessageUpdate,
      } = messageServiceDelegates;
      let checkAuth = () => false;
      let logout = () => {};
      let connectWS = () => null;
      coreApiService.configure?.({
        getToken: () => token || runtimeState.getToken?.() || runtimeState.token || localStorage.getItem('token'),
        onUnauthorized: () => logout(),
        tx,
      });
      let messageStateController = null;
      let messageAttachmentRenderer = null;
      let messagePollRenderer = null;
      let messageCallCardRenderer = null;
      let messageRenderer = null;
      let messageOutbox = null;
      let messageUpdates = null;
      let grokImageRiskConfirmResolver = null;
      let compactViewMap = JSON.parse(localStorage.getItem('compactViewMap') || '{}');
      let compactView = false;
      let sendByEnter = localStorage.getItem('sendByEnter') !== '0';
      const MICROPHONE_MODE_STORAGE_KEY = 'microphoneMode';
      const MICROPHONE_MODE_VALUES = new Set(['voice_message', 'dictation']);
      let microphoneMode = MICROPHONE_MODE_VALUES.has(localStorage.getItem(MICROPHONE_MODE_STORAGE_KEY))
        ? localStorage.getItem(MICROPHONE_MODE_STORAGE_KEY)
        : 'voice_message';
      let scrollRestoreMode = localStorage.getItem('scrollRestoreMode') || 'bottom'; // 'bottom' | 'restore'
      let openLastChatOnReload = localStorage.getItem('openLastChatOnReload') !== '0';
      const SCREEN_ROTATION_ALLOWED_STORAGE_KEY = 'screenRotationAllowed';
      let screenRotationAllowed = localStorage.getItem(SCREEN_ROTATION_ALLOWED_STORAGE_KEY) !== '0';
      let currentUiTheme = 'bananza';
      let currentVisualMode = 'classic';
      let pollComposerStyle = 'pulse';
      let currentModalAnimation = 'soft';
      let currentModalAnimationSpeed = MODAL_ANIMATION_SPEED_DEFAULT;
      let currentMobileFontSize = MOBILE_FONT_SIZE_DEFAULT;
      let currentUiLanguage = i18n?.getLanguage?.() || 'ru';
      let chatFolderSwitchSeq = 0;
      let chatFolderSwipePagerState = null;
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
      let openAiImageState = {
        settings: { ...aiBotState.settings },
        bots: [],
        chats: [],
        chatSettings: [],
        models: {
          image: ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'],
          image_size: ['auto', '1024x1024', '1024x1536', '1536x1024'],
          image_quality: ['auto', 'low', 'medium', 'high'],
          image_background: ['auto', 'transparent', 'opaque'],
          image_output_format: ['png', 'webp', 'jpeg'],
        },
      };
      let selectedOpenAiImageBotId = null;
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
          deepseek_request_timeout_ms: 600000,
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
      let qwenBotState = {
        settings: {
          qwen_enabled: false,
          qwen_base_url: 'http://127.0.0.1:8000/v1',
          qwen_default_response_model: 'qwen',
          qwen_default_summary_model: 'qwen',
          qwen_temperature: 0.3,
          qwen_max_tokens: 1000,
          qwen_request_timeout_ms: 600000,
        },
        bots: [],
        chats: [],
        chatSettings: [],
        models: {
          response: ['qwen'],
          summary: ['qwen'],
        },
      };
      let selectedQwenBotId = null;
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
        qwen: {
          settings: { ...qwenBotState.settings },
          bots: [],
          chats: [],
          chatSettings: [],
          models: { response: ['qwen'] },
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
        qwen: null,
        grok: null,
      };
      let activeContextConvertProvider = 'openai';
      let contextConvertAvailabilityByChat = new Map();
      let contextConvertAvailabilityRequests = new Map();
      let contextConvertComposerPending = false;
      let contextConvertPendingMessageIds = new Set();
      let contextOriginalRestorePendingMessageIds = new Set();
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
      let chatShotAdminStates = {
        openai: {
          settings: { ...aiBotState.settings },
          bots: [],
          chats: [],
          chatSettings: [],
          models: {
            response: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'],
            image: ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'],
            image_size: ['auto', '1024x1024', '1024x1536', '1536x1024'],
            image_quality: ['auto', 'low', 'medium', 'high'],
            image_background: ['auto', 'transparent', 'opaque'],
            image_output_format: ['png', 'webp', 'jpeg'],
          },
        },
        grok: {
          settings: { ...grokBotState.settings },
          bots: [],
          chats: [],
          chatSettings: [],
          models: { ...grokBotState.models },
        },
      };
      let selectedChatShotBotIds = {
        openai: null,
        grok: null,
      };
      let activeChatShotProvider = 'openai';
      let chatShotStateByChat = new Map();
      let chatShotStateRequests = new Map();
      let chatShotStateFailuresByChat = new Set();
      let chatShotGeneratingByChat = new Set();
      let composerAiOverrideState = {
        target: null,
        mode: 'auto',
        documentFormat: 'md',
      };
      let composerAiOverrideSeq = 0;
      let centerToastTimer = null;
      let suppressNextChatItemTapUntil = 0;
      let reactionEmojiSwipePager = null;
      let newChatTabSwipePager = null;
      let avatarUserMenuState = null;
      let chatAreaResizeObserver = null;
      let chatHeaderActionsOpen = false;
      let mobileRouteTransitionActive = false;
      let mobileRouteTransitionTimer = null;
      let mobileBaseScene = 'sidebar';
      let mobileSceneRepaintFrame = 0;
      let mobileSceneRepaintCleanupFrame = 0;
      let mobileSceneRepaintTarget = null;
      let mobileViewportElementResizeObserver = null;
      let mobileVisualViewportBaselineHeight = 0;
      let mobileVisualViewportBaselineWidth = 0;
      let iosBackNavigationToken = 0;
      let inAppChatBackSkipNextPopstate = false;
      let pendingMobileChatListHistoryNormalization = false;
      let mobileViewportPrevHeight = 0;
      let mobileViewportHeightSyncBound = false;
      let mobileViewportRecoveryFrame = 0;
      let mobileViewportRecoveryTimer = null;
      let scrollBottomFollowupClickSuppressUntil = 0;
    
      const composerFactories = window.BananzaApp?.composer || {};
      const composerStateFactory = composerFactories.state?.createComposerState;
      const composerTextFactory = composerFactories.text?.createComposerTextController;
      const composerReplyEditFactory = composerFactories.replyEdit?.createReplyEditController;
      const composerFilesFactory = composerFactories.files?.createComposerFilesController;
      const composerSendFactory = composerFactories.send?.createComposerSendController;
      const composerEmojiPickerFactory = composerFactories.emojiPicker?.createEmojiPickerController;
      const composerMentionsFactory = composerFactories.mentions?.createMentionPickerController;
      const composerTypingDragDropFactory = composerFactories.typingDragDrop?.createTypingDragDropController;
      const pollComposerFactory = composerFactories.pollComposer?.createPollComposerController;
      const interactionFactories = window.BananzaApp?.interactions || {};
      const searchControllerFactory = interactionFactories.search?.createSearchController;
      const reactionControllerFactory = interactionFactories.reactions?.createReactionController;
      const floatingMessageActionsFactory = interactionFactories.floatingActions?.createFloatingMessageActions;
      const mediaViewerFactory = interactionFactories.mediaViewer?.createMediaViewer;
      const contextMenusFactory = interactionFactories.contextMenus?.createContextMenus;
      const forwardingControllerFactory = interactionFactories.forwarding?.createForwardingController;
      if (typeof composerStateFactory !== 'function'
        || typeof composerTextFactory !== 'function'
        || typeof composerReplyEditFactory !== 'function'
        || typeof composerFilesFactory !== 'function'
        || typeof composerSendFactory !== 'function'
        || typeof composerEmojiPickerFactory !== 'function'
        || typeof composerMentionsFactory !== 'function'
        || typeof composerTypingDragDropFactory !== 'function'
        || typeof pollComposerFactory !== 'function') {
        throw new Error('BananzaApp composer modules are required before app.js');
      }
      if (typeof searchControllerFactory !== 'function'
        || typeof reactionControllerFactory !== 'function'
        || typeof floatingMessageActionsFactory !== 'function'
        || typeof mediaViewerFactory !== 'function'
        || typeof contextMenusFactory !== 'function'
        || typeof forwardingControllerFactory !== 'function') {
        throw new Error('BananzaApp interaction modules are required before app.js');
      }
      const composerStateController = composerStateFactory({
        storage: localStorage,
        maxDraftLength: MAX_MSG,
        getCurrentUser: () => currentUser,
      });
      let composerTextController = null;
      let composerReplyEditController = null;
      let composerFilesController = null;
      let composerSendController = null;
      let composerEmojiPickerController = null;
      let composerMentionsController = null;
      let composerTypingDragDropController = null;
      let pollComposerController = null;
      let searchController = null;
      let reactionController = null;
      let floatingMessageActionsController = null;
      let mediaViewerController = null;
      let contextMenusController = null;
      let forwardingController = null;

      function clamp(value, min, max) {
        return floatingMessageActionsController?.clamp?.(value, min, max) ?? Math.max(min, Math.min(value, max));
      }
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // DOM
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      const appDomApi = window.BananzaApp?.dom || {};
      const $ = typeof appDomApi.$ === 'function'
        ? (selector, root = document) => appDomApi.$(selector, root)
        : (selector, root = document) => root?.querySelector?.(selector) || null;
      const $$ = typeof appDomApi.$$ === 'function'
        ? (selector, root = document) => appDomApi.$$(selector, root)
        : (selector, root = document) => Array.from(root?.querySelectorAll?.(selector) || []);
    
      function createFallbackDomRefs() {
        const aliases = {
          composerAiOverrideDocumentFormatEl: 'composerAiOverrideDocumentFormat',
          composerAiOverrideDocumentWrap: 'composerAiOverrideDocumentWrap',
          composerAiOverrideEl: 'composerAiOverride',
          composerAiOverrideHint: 'composerAiOverrideHint',
          composerAiOverrideLabel: 'composerAiOverrideLabel',
          composerAiOverrideModeEl: 'composerAiOverrideMode',
          messagesEl: 'messages',
          pendingFileEl: 'pendingFile',
        };
        return new Proxy({ $, $$ }, {
          get(target, key) {
            if (Object.prototype.hasOwnProperty.call(target, key)) return target[key];
            if (key === 'chatHeader') return $('#chatView')?.querySelector('.chat-header') || null;
            if (key === 'inputArea') return $('#chatView')?.querySelector('.input-area') || null;
            if (key === 'inputRow') return $('#chatView')?.querySelector('.input-row') || null;
            if (typeof key !== 'string') return null;
            return document.getElementById(aliases[key] || key) || null;
          },
        });
      }
    
      const appDom = window.BananzaApp?.dom?.createDomRefs?.() || createFallbackDomRefs();
      appDom.$ = $;
      appDom.$$ = $$;
    
      const {
        sidebar,
        chatList,
        chatListStatus,
        chatListPullIndicator,
        chatListPullIcon,
        chatListPullLabel,
        sidebarSearch,
        chatSearch,
        chatSearchToggle,
        chatSearchClear,
        chatFoldersBtn,
        chatFolderContent,
        chatFolderListSurface,
        activeChatFolderBar,
        activeChatFolderStrip,
        activeChatFolderName,
        chatArea,
        emptyState,
        chatView,
        chatHeader,
        backBtn,
        chatTitle,
        chatHeaderAvatar,
        chatStatus,
        chatHeaderActions,
        searchBtn,
        chatShotBtn,
        chatSettingsActionBtn,
        chatInfoBtn,
        pinnedBar,
        messagesEl,
        loadMoreWrap,
        loadMoreBtn,
        loadMoreAfterWrap,
        typingBar,
        msgInput,
        composerRichPreview,
        inputArea,
        inputRow,
        mentionOpenBtn,
        sendBtn,
        scrollBottomBtn,
        composerContextConvertBtn,
        attachBtn,
        pollBtn,
        emojiBtn,
        fileInput,
        pendingFileEl,
        composerAiOverrideEl,
        composerAiOverrideLabel,
        composerAiOverrideHint,
        composerAiOverrideModeEl,
        composerAiOverrideDocumentWrap,
        composerAiOverrideDocumentFormatEl,
        emojiPicker,
        imageViewer,
        ivStrip,
        reactionPicker,
        reactionEmojiPopover,
        chatContextMenuBackdrop,
        chatContextMenu,
        chatFolderPickerBackdrop,
        chatFolderPicker,
        chatFolderContextMenuBackdrop,
        chatFolderContextMenu,
        mediaContextMenuBackdrop,
        mediaContextMenu,
        replyBar,
        replyBarName,
        replyBarText,
        searchPanel,
        searchPanelSheet,
        searchInput,
        searchResults,
        searchAllChatsToggle,
        dragOverlay,
        newChatModal,
        newFolderNameInput,
        newFolderChatSearchInput,
        newFolderChatList,
        createFolderBtn,
        adminModal,
        chatInfoModal,
        menuDrawer,
        currentUserInfo,
        weatherWidget,
        settingsModal,
        languageSettingsModal,
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
        openAiImageBotsModal,
        contextConvertBotsModal,
        chatShotBotsModal,
        yandexAiSettingsModal,
        deepseekAiSettingsModal,
        deepseekAiTextBotsModal,
        qwenAiSettingsModal,
        qwenAiTextBotsModal,
        grokAiSettingsModal,
        grokAiTextBotsModal,
        grokAiImageBotsModal,
        grokAiUniversalBotsModal,
        changePasswordModal,
        forwardMessageModal,
        forwardChatSearch,
        forwardChatList,
        forwardMessageStatus,
        grokImageRiskConfirmModal,
        grokImageRiskTerms,
        grokImageRiskCancel,
        grokImageRiskConfirm,
        pollComposerModal,
        pollQuestionInput,
        pollOptionsList,
        pollComposerPreview,
        pollComposerStatus,
        pollVotersModal,
        pollVotersMeta,
        pollVotersTitle,
        pollVotersStatus,
        pollVotersList,
        chatFolderManageModal,
        chatFolderManageSaveBtn,
      } = appDom;
      const OPENAI_IMAGE_SIZE_OPTIONS = ['auto', '1024x1024', '1024x1536', '1536x1024'];
      const OPENAI_IMAGE_QUALITY_OPTIONS = ['auto', 'low', 'medium', 'high'];
      const OPENAI_IMAGE_BACKGROUND_OPTIONS = ['auto', 'transparent', 'opaque'];
      const OPENAI_IMAGE_OUTPUT_OPTIONS = ['png', 'webp', 'jpeg'];
      const DOCUMENT_FORMAT_OPTIONS = ['md', 'txt'];
      let mobileComposerGuard = null;
    
      const mobileViewportShell = window.BananzaApp?.mobileViewport?.createMobileViewportShell?.({
        document,
        window,
        dom: appDom,
        state: {
          getCurrentModalAnimation: () => currentModalAnimation,
          getIosComposerFocused: () => mobileComposerGuard?.getIosComposerFocused?.() || false,
          getMobileViewportPrevHeight: () => mobileViewportPrevHeight,
          getMobileVisualViewportBaselineHeight: () => mobileVisualViewportBaselineHeight,
          getMobileVisualViewportBaselineWidth: () => mobileVisualViewportBaselineWidth,
          setMobileVisualViewportBaselineHeight: (value) => {
            mobileVisualViewportBaselineHeight = Math.max(0, Number(value) || 0);
          },
          setMobileVisualViewportBaselineWidth: (value) => {
            mobileVisualViewportBaselineWidth = Math.max(0, Number(value) || 0);
          },
        },
        actions: {
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          isMobileViewportLayoutLocked: () => isMobileViewportLayoutLocked(),
          prefersReducedMotion: () => prefersReducedMotion(),
        },
      }) || {};
      const androidBridge = window.BananzaApp?.androidBridge || {
        hasAndroidNativeBridge: () => false,
        notifyAndroidScreenRotationPreference: () => false,
        notifyAndroidMobileFontSize: () => false,
      };
      const chatHeaderActionsShell = window.BananzaApp?.chatHeaderActions?.createChatHeaderActions?.({
        document,
        dom: appDom,
        state: {
          getChatHeaderActionsOpen: () => chatHeaderActionsOpen,
          setChatHeaderActionsOpen: (open) => {
            chatHeaderActionsOpen = Boolean(open);
            return chatHeaderActionsOpen;
          },
        },
      }) || null;
      mobileComposerGuard = window.BananzaApp?.shell?.createMobileComposerGuard?.({
        window,
        document,
        dom: appDom,
        mobileViewport: mobileViewportShell,
        controllers: {
          composerState: () => composerStateController,
          mentions: () => composerMentionsController,
          search: () => searchController,
          floatingActions: () => floatingMessageActionsController,
        },
        actions: {
          $,
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          isMobileViewportLayoutLocked: () => isMobileViewportLayoutLocked(),
          scheduleMobileViewportRecovery: (retryDelayMs) => scheduleMobileViewportRecovery(retryDelayMs),
          isFloatingSurfaceVisible: (el) => isFloatingSurfaceVisible(el),
          isContextConvertPickerActive: () => Boolean(contextConvertPickerState.active),
          hideMentionPicker: (...args) => hideMentionPicker(...args),
          hideContextConvertPicker: (...args) => hideContextConvertPicker(...args),
          hideFloatingMessageActions: (...args) => hideFloatingMessageActions(...args),
          hideAvatarUserMenu: (...args) => hideAvatarUserMenu(...args),
          clearActivePulseVoterPopover: (...args) => clearActivePulseVoterPopover(...args),
          closeEmojiPicker: (...args) => closeEmojiPicker(...args),
          closeFloatingSurface: (...args) => closeFloatingSurface(...args),
          rememberActiveElement: () => rememberActiveElement(),
          showMessageActions: (...args) => showMessageActions(...args),
        },
      }) || {};
    
      const appContext = appRuntime?.createContext ? appRuntime.createContext({
        config: {
          PAGE_SIZE,
          MESSAGE_CACHE_LIMIT,
          MAX_MSG,
          MAX_ATTACHMENTS,
        },
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          getChats: () => chats,
          runtimeState,
        },
        dom: appDom,
        services: {
          api: (url, opts) => api(url, opts),
          auth: authService,
          websocket: websocketService,
          androidBridge,
          chatHeaderActions: chatHeaderActionsShell,
          mobileViewport: mobileViewportShell,
          mobileComposerGuard,
          t,
          tx,
        },
        t,
        tx,
      }) : null;
      if (appContext) {
        appContext.dom = appDom;
        appContext.services = appContext.services || {};
        appContext.services.mobileViewport = mobileViewportShell;
        appContext.services.mobileComposerGuard = mobileComposerGuard;
        appContext.services.androidBridge = androidBridge;
        appContext.services.chatHeaderActions = chatHeaderActionsShell;
        appContext.services.auth = authService;
        appContext.services.websocket = websocketService;
        appContext.state.runtimeState = runtimeState;
      }
    
      const modalManagerFactory = window.BananzaApp?.modalManager?.createModalManager;
      if (typeof modalManagerFactory !== 'function') {
        throw new Error('BananzaApp modal manager module is required before app.js');
      }
      const modalManager = modalManagerFactory({
        document,
        window,
        dom: appDom,
        config: { MODAL_TRANSITION_BUFFER_MS },
        state: {
          getCurrentModalAnimation: () => currentModalAnimation,
          getCurrentModalAnimationSpeed: () => currentModalAnimationSpeed,
        },
        actions: {
          closeMediaViewer: () => closeMediaViewer(),
          closeMobileComposerTransientUi: (options) => closeMobileComposerTransientUi(options),
          dismissMobileComposer: (options) => dismissMobileComposer(options),
          forceIosAnimationMount: (...elements) => forceIosAnimationMount(...elements),
          getMobileComposerSafeReturnFocusEl: () => getMobileComposerSafeReturnFocusEl(),
          prefersReducedMotion: () => prefersReducedMotion(),
          scheduleMobileViewportRecovery: (retryDelayMs) => scheduleMobileViewportRecovery(retryDelayMs),
        },
        getCurrentModalAnimation: () => currentModalAnimation,
        getCurrentModalAnimationSpeed: () => currentModalAnimationSpeed,
        getModalAnimationSpeedFactor: (speed) => getModalAnimationSpeedFactor(speed),
      });
      if (appContext) appContext.services.modals = modalManager;

      function createLegacyAiAdminScope() {
        const scope = Object.create(null);
        Object.assign(scope, {
          window, document, console: window.console || console, $, $$,
          Math: window.Math || Math, Date: window.Date || Date, Number: window.Number || Number,
          String: window.String || String, Boolean: window.Boolean || Boolean, Array: window.Array || Array,
          Object: window.Object || Object, Promise: window.Promise || Promise, Set: window.Set || Set,
          Map: window.Map || Map, JSON: window.JSON || JSON, URL: window.URL,
          FormData: window.FormData, Blob: window.Blob, File: window.File, FileReader: window.FileReader,
          localStorage: window.localStorage, sessionStorage: window.sessionStorage, navigator: window.navigator,
          location: window.location, history: window.history,
          alert: window.alert?.bind?.(window), confirm: window.confirm?.bind?.(window),
          fetch: window.fetch?.bind?.(window),
          setTimeout: window.setTimeout?.bind?.(window), clearTimeout: window.clearTimeout?.bind?.(window),
          requestAnimationFrame: window.requestAnimationFrame?.bind?.(window) || ((callback) => window.setTimeout(callback, 16)),
          cancelAnimationFrame: window.cancelAnimationFrame?.bind?.(window) || ((id) => window.clearTimeout(id)),
        });
        return new Proxy(scope, {
          has() { return true; },
          get(target, key) {
            if (key === Symbol.unscopables) return undefined;
            if (Object.prototype.hasOwnProperty.call(target, key)) return target[key];
            if (typeof key === 'string' && key in window) return window[key];
            if (typeof key === 'string' && /^[A-Za-z_$][\w$]*$/.test(key)) {
              try { return eval(key); } catch (error) { return undefined; }
            }
            return undefined;
          },
          set(target, key, value) {
            if (typeof key === 'string' && /^[A-Za-z_$][\w$]*$/.test(key)) {
              const __bananzaAiAdminScopeValue = value;
              try { eval(key + ' = __bananzaAiAdminScopeValue'); return true; } catch (error) {}
            }
            target[key] = value;
            return true;
          },
        });
      }

      const aiAdminController = window.BananzaApp?.aiAdmin?.createController?.({
        window,
        document,
        ctx,
        dom: appDom,
      }) || null;
      const aiAdminLegacyApi = aiAdminController?.installLegacyModules?.(createLegacyAiAdminScope()) || {};
      const {
        setInlineStatus, resolveActionButtons, setActionButtonsPending, withActionButtons, bindAsyncActionButtons, setOpenAiStatus,
        setAiBotModalStatus, setAiBotSettingsStatus, setAiBotStatus, setAiBotTextModalStatus, setAiBotChatStatus, setAiModelStatus,
        uniqueAiModelValues, setAiModelSelectOptions, setStaticSelectOptions, syncSharedOpenAiSettings, syncSharedGrokSettings, renderAiModelOptions,
        loadAiModelOptions, mergeAiBotState, currentAiBot, setOpenAiUniversalModalStatus, setOpenAiUniversalStatus, setOpenAiUniversalChatStatus,
        mergeOpenAiUniversalState, currentOpenAiUniversalBot, getOpenAiUniversalChatSetting, renderOpenAiUniversalModelOptions, renderOpenAiUniversalBotAvatar, renderOpenAiUniversalBotList,
        fillOpenAiUniversalBotForm, openAiUniversalBotFormPayload, renderOpenAiUniversalChatBotSettings, renderOpenAiUniversalSettings, getAiChatSetting, renderAiBotAvatar,
        refreshRenderedAiBotAvatar, providerInteractiveEnabled, providerInteractiveSummary, normalizeBotSaveComparisonValue, verifyBotSaveResponse, buildVerifiedBotSaveStatus,
        fillAiBotForm, aiBotFormPayload, renderAiBotList, renderAiChatBotSettings, renderOpenAiProviderSettings, renderOpenAiTextBotsSettings,
        renderAiBotSettings, aiBotSettingsPayload, persistAiBotSettings, loadAiBotState, saveAiBotSettings, deleteAiBotKey,
        saveAiBot, uploadAiBotAvatar, removeAiBotAvatar, disableAiBot, testAiBot, filenameFromContentDisposition,
        exportAiBotJson, importAiBotJsonFile, saveAiChatBotSettings, loadOpenAiUniversalState, syncOpenAiUniversalBotUser, saveOpenAiUniversalBot,
        uploadOpenAiUniversalBotAvatar, removeOpenAiUniversalBotAvatar, disableOpenAiUniversalBot, testOpenAiUniversalBot, exportOpenAiUniversalBotJson, importOpenAiUniversalBotJsonFile,
        saveOpenAiUniversalChatBotSettings, setOpenAiImageModalStatus, setOpenAiImageStatus, setOpenAiImageChatStatus, mergeOpenAiImageState, currentOpenAiImageBot,
        getOpenAiImageChatSetting, renderOpenAiImageModelOptions, renderOpenAiImageBotAvatar, renderOpenAiImageBotList, fillOpenAiImageBotForm, openAiImageBotFormPayload,
        renderOpenAiImageChatBotSettings, renderOpenAiImageSettings, loadOpenAiImageState, syncOpenAiImageBotUser, saveOpenAiImageBot, uploadOpenAiImageBotAvatar,
        removeOpenAiImageBotAvatar, disableOpenAiImageBot, testOpenAiImageBot, exportOpenAiImageBotJson, importOpenAiImageBotJsonFile, saveOpenAiImageChatBotSettings,
        setDeepseekAiStatus, setDeepseekAiProviderStatus, setDeepseekAiBalanceStatus, setDeepseekBotStatus, setDeepseekChatStatus, setDeepseekAiModelStatus,
        currentDeepseekBot, getDeepseekChatSetting, mergeDeepseekAiState, renderDeepseekModelOptions, renderDeepseekBotAvatar, fillDeepseekBotForm,
        deepseekBotFormPayload, renderDeepseekBotList, renderDeepseekChatBotSettings, renderDeepseekAiSettings, deepseekAiSettingsPayload, persistDeepseekAiSettings,
        loadDeepseekAiState, saveDeepseekAiSettings, testDeepseekAiConnection, formatDeepseekBalanceValue, formatDeepseekBalanceResult, checkDeepseekAiBalance,
        refreshDeepseekAiModels, deleteDeepseekAiKey, saveDeepseekBot, uploadDeepseekBotAvatar, removeDeepseekBotAvatar, disableDeepseekBot,
        testDeepseekBot, exportDeepseekBotJson, importDeepseekBotJsonFile, saveDeepseekChatBotSettings, setQwenAiStatus, setQwenAiProviderStatus,
        setQwenBotStatus, setQwenChatStatus, setQwenAiModelStatus, currentQwenBot, getQwenChatSetting, mergeQwenAiState,
        renderQwenModelOptions, renderQwenBotAvatar, fillQwenBotForm, qwenBotFormPayload, renderQwenBotList, renderQwenChatBotSettings,
        renderQwenAiSettings, qwenAiSettingsPayload, persistQwenAiSettings, loadQwenAiState, saveQwenAiSettings, testQwenAiConnection,
        refreshQwenAiModels, deleteQwenAiKey, saveQwenBot, uploadQwenBotAvatar, removeQwenBotAvatar, disableQwenBot,
        testQwenBot, exportQwenBotJson, importQwenBotJsonFile, saveQwenChatBotSettings, setYandexAiStatus, setYandexAiProviderStatus,
        setYandexBotStatus, setYandexChatStatus, setYandexAiModelStatus, formatUiErrorMessage, currentYandexBot, getYandexChatSetting,
        mergeYandexAiState, renderYandexModelOptions, renderYandexBotAvatar, fillYandexBotForm, yandexBotFormPayload, renderYandexBotList,
        renderYandexChatBotSettings, renderYandexAiSettings, yandexAiSettingsPayload, persistYandexAiSettings, loadYandexAiState, saveYandexAiSettings,
        testYandexAiConnection, refreshYandexAiModels, deleteYandexAiKey, saveYandexBot, uploadYandexBotAvatar, removeYandexBotAvatar,
        disableYandexBot, testYandexBot, exportYandexBotJson, importYandexBotJsonFile, saveYandexChatBotSettings,
        GROK_TEXT_BOT_DIRTY_STATUS, setGrokStatus, setGrokAiStatus, setGrokTextStatus, setGrokImageStatus, setGrokUniversalStatus,
        setGrokAiProviderStatus, setGrokTextEditorStatus, setGrokImageEditorStatus, setGrokUniversalEditorStatus, setGrokTextChatStatus, setGrokImageChatStatus,
        setGrokUniversalChatStatus, setGrokBotStatus, setGrokAiModelStatus, wireAiBotToggleLabels, currentGrokBot, currentGrokImageBot,
        currentGrokUniversalBot, getGrokChatSetting, getGrokImageChatSetting, getGrokUniversalChatSetting, mergeGrokAiState, mergeGrokUniversalState,
        renderNamedGrokAvatar, renderGrokBotAvatar, renderGrokImageBotAvatar, renderGrokUniversalBotAvatar, mountGrokBotPanels, renderGrokGlobalTextModelOptions,
        renderGrokBotModelOptions, renderGrokUniversalBotModelOptions, renderGrokGlobalImageModelOptions, renderGrokImageBotModelOptions, renderGrokBotList, renderGrokImageBotList,
        renderGrokUniversalBotList, fillGrokBotForm, fillGrokImageBotForm, fillGrokUniversalBotForm, grokBotFormPayload, formatCapabilityState,
        currentGrokTextBotFormFingerprint, refreshGrokTextBotDirtyState, syncGrokTextBotFormFingerprint, grokImageBotFormPayload, grokUniversalBotFormPayload, renderGrokChatBotSettings,
        renderGrokImageChatBotSettings, renderGrokUniversalChatBotSettings, renderGrokAiSettings, renderGrokTextBotsSettings, renderGrokImageBotsSettings, renderGrokUniversalBotsSettings,
        grokAiSettingsPayload, persistGrokAiSettings, loadGrokAiState, syncGrokBotUser, saveGrokAiSettings, testGrokAiConnection,
        refreshGrokAiModels, deleteGrokAiKey, saveGrokBot, saveGrokImageBot, uploadGrokBotAvatar, removeGrokBotAvatar,
        disableGrokBot, testGrokBot, exportGrokBotJson, importGrokBotJsonFile, saveGrokChatBotSettings, saveGrokImageChatBotSettings,
        loadGrokUniversalState, saveGrokUniversalBot, uploadGrokUniversalBotAvatar, removeGrokUniversalBotAvatar, disableGrokUniversalBot, testGrokUniversalBot,
        exportGrokUniversalBotJson, importGrokUniversalBotJsonFile, saveGrokUniversalChatBotSettings, retryGrokImageRiskPrompt, jumpToSavedOriginal, normalizeMentionTarget,
        escapeRegExpText, extractMentionTokensFromText, isGrokImageBotTarget, isUniversalBotTarget, isGrokUniversalBotTarget, grokUniversalTargetAllowsImage,
        buildReplyBotTarget, getDirectPrivateAiBotTarget, getUniversalBotModes, resolveComposerUniversalBotTarget, renderComposerAiOverride, updateComposerAiOverrideState,
        getComposerAiOverridePayload, stripTriggeredBotMention, resolveTriggeredGrokImageBot, analyzeOutgoingGrokImageRisk, renderGrokImageRiskTerms, openGrokImageRiskConfirm,
        contextConvertProviderLabel, providerAccent, contextConvertRouteBase, currentContextConvertAdminState, currentContextConvertAdminBot, getContextConvertChatSetting,
        setContextConvertInlineStatus, setContextConvertModalStatus, setContextConvertBotStatus, setContextConvertChatStatus, mergeContextConvertAdminState, renderContextConvertBotList,
        renderContextConvertForm, renderContextConvertChatSettings, renderContextConvertAdminSettings, contextConvertAdminFormPayload, loadContextConvertAdminState, openContextConvertBotsModal,
        saveContextConvertAdminBot, disableContextConvertAdminBot, testContextConvertAdminBot, exportContextConvertAdminBot, importContextConvertAdminBot, saveContextConvertAdminChatSetting,
        chatShotRouteBase, currentChatShotAdminState, currentChatShotAdminBot, getChatShotAdminChatSetting, setChatShotModalStatus, setChatShotBotStatus,
        setChatShotAdminChatStatus, mergeChatShotAdminState, renderChatShotBotList, renderChatShotAdminForm, renderChatShotAdminChatSettings, renderChatShotAdminSettings,
        chatShotAdminFormPayload, loadChatShotAdminState, openChatShotBotsModal, saveChatShotAdminBot, disableChatShotAdminBot, testChatShotAdminBot,
        exportChatShotAdminBot, importChatShotAdminBot, saveChatShotAdminChatSetting, normalizeContextConvertAvailability, loadContextConvertAvailability, invalidateContextConvertAvailability,
        normalizeChatShotState, getCurrentChatShotState, setChatShotChatStatus, loadChatShotState, invalidateChatShotState, renderChatShotForm,
        saveChatShotChatSetting, syncChatShotButton, runChatShotGeneration, ensureContextConvertPickerBackdrop, ensureContextConvertPicker, positionContextConvertPicker,
        renderContextConvertPicker, hideContextConvertPicker, getCurrentChatContextConvertState, isContextTransformAvailableForChat, setComposerContextConvertButtonVisible, canContextConvertMessage,
        canRestoreContextOriginalMessage, bindContextConvertMessageButton, createContextConvertMessageButton, bindContextOriginalRestoreButton, syncVisibleContextConvertMessageButtons, syncCurrentChatContextConvertUi,
        syncContextConvertComposerButton, openComposerContextConvertPicker, transformComposerTextWithContextConvertBot, syncContextConvertPendingMessageState, syncContextOriginalRestorePendingMessageState, transformMessageWithContextConvertBot,
        restoreContextOriginalMessage, openMessageContextConvertPicker,
      } = aiAdminLegacyApi;

      const legacyUiRuntimeApi = window.BananzaApp?.shell?.legacyUiRuntime?.createLegacyUiRuntime?.(createLegacyAiAdminScope()) || {};
      const {
        isMobileLayoutViewport, normalizeMobileBaseScene, clearMobileSceneRepaint, getResolvedMobileBaseScene, isMobileBaseSceneHardHidden, setMobileSceneElementState,
        clearMobileSceneElementState, scheduleActiveMobileSceneRepaint, syncMobileBaseSceneState, getComposerTextValue, setComposerTextValue, normalizeComposerInputValue,
        snapComposerSelectionToCustomEmojiBoundary, insertComposerTextAtSelection, normalizeMicrophoneMode, getMicrophoneMode, setMicrophoneMode, getScreenRotationAllowed,
        syncScreenRotationToggle, setScreenRotationStatus, clearScreenRotationStatusSoon, applyScreenRotationPreference, setScreenRotationAllowed, insertDictatedText,
        getEmojiPickerInsertionValue, deleteComposerCustomEmojiCluster, handleComposerCustomEmojiKeydown, handleComposerCustomEmojiBeforeInput, safeVibrate, linkify,
        mentionKey, renderMessageText, normalizeUiTheme, renderThemePicker, applyUiTheme, selectUiTheme,
        setThemeStatus, normalizeUiLanguage, languageDisplayName, renderLanguagePicker, applyUiLanguage, selectUiLanguage,
        refreshLocalizedUi, syncLanguageSettingsButton, setLanguageStatus, normalizeVisualMode, visualModeMeta, visualModeStateLabel,
        renderVisualModePicker, applyVisualMode, selectVisualMode, setVisualModeStatus, normalizePollStyle, pollStyleMeta,
        renderPollStyleCardPreview, renderPollStylePicker, setPollStyleSurface, syncPollComposerStyleUi, selectPollStyle, setPollStyleStatus,
        normalizeModalAnimationStyle, modalAnimationMeta, syncModalAnimationSettingsButton, normalizeModalAnimationSpeed, getModalAnimationSpeedFactor, setModalAnimationStatus,
        clearModalAnimationStatusTimer, scheduleModalAnimationStatusClear, getPersistedModalAnimationPreferences, getCurrentModalAnimationPreferences, modalAnimationPreferencesEqual, renderModalAnimationOptions,
        renderModalAnimationSpeedControl, applyModalAnimation, applyModalAnimationSpeed, flushModalAnimationSave, scheduleModalAnimationSave, selectModalAnimation,
        updateModalAnimationSpeed, normalizeMobileFontSize, getMobileFontAdjustPercent, hasAndroidNativeBridge, notifyAndroidScreenRotationPreference, setMobileFontAdjustPercent,
        notifyAndroidMobileFontSize, syncMobileFontSettingsButton, setMobileFontSizeStatus, clearMobileFontSizeStatusTimer, scheduleMobileFontSizeStatusClear, getPersistedMobileFontSize,
        renderMobileFontSizeControl, applyMobileFontSize, syncMobileFontSizeViewportState, flushMobileFontSizeSave, scheduleMobileFontSizeSave, updateMobileFontSize,
        getSingleEmojiPattern, splitGraphemes, isSingleEmojiMessage, applyPosterToVideoElement, markAttachmentPosterAvailable, ensureAttachmentPoster,
        localAttachmentFromFile, makeClientId, isClientSideMessage, setPollComposerStatus, readPollComposerForm, renderPollComposerOptionInputs,
        refreshPollComposerActionState, buildPollComposerPreviewMessage, refreshPollComposerPreview, resetPollComposer, openPollComposer, avatarHtml,
        isAiBotDirectoryUser, botMentionText, botModelText, botChatMemberMetaText, userSecondaryLineText, renderSelectableUserItem,
        renderChatMemberItem, formatBotAuditSource, ensureBotVisibilityToggles, setBotVisibilityToggle, getBotVisibilityToggle, updateCurrentUserFooter,
        persistCurrentUser, syncChatAreaMetrics, syncMobileAppHeightToViewport, forceMobileViewportLayoutSync, scheduleMobileViewportRecovery, setupMobileViewportHeightSync,
        setupChatAreaMetricsSync, isAbortError, isCurrentChatOpenTransition, isUiTransitionBusy, isMobileViewportLayoutLocked, syncChatAreaMetricsFromViewport,
        flushDeferredRecoverySync, setChatHydrating, revealChatHydration, beginMobileRouteTransition, endMobileRouteTransition, isChatSearchOpen,
        focusChatSearchInput, setChatSearchOpen, setChatFolderManageStatus, chatFolderIconEmoji, chatFolderEmojiMarkup, chatFolderIconMarkup,
        normalizeChatFolderId, shouldShowActiveChatFolderBar, activeChatFolderStripRows, getRenderedChatFolderSelectionId, isChatFolderStripVisibleInAllChatsEnabled, syncChatFolderPickerAllChatsToggleState,
        applyChatFolderStripVisibilityInAllChats, saveChatFolderStripVisibilityInAllChats, shouldShowChatFolderBarForSelection, chatFolderStripStructureSignature, chatFolderStripLabelForSelection, setPendingChatFolderChipCenterBehavior,
        cancelScheduledActiveChatFolderChipCenter, centerActiveChatFolderChip, scheduleActiveChatFolderChipCenter, renderChatFolderStripStructure, syncActiveChatFolderStripState, renderActiveChatFolderBar,
        beginChatFolderStripPreview, finalizeChatFolderStripPreview, getChatFolderSwitchTargets, resetChatFolderSwitchAnimations, destroyChatFolderSwipePager, resetChatFolderSwipeSurface,
        waitForAnimationFrames, waitForMs, playChatFolderSwitchPhase, canAnimateChatFolderContent, animateChatFolderContentEntry, getChatFolderPageRows,
        getChatFolderPageIndex, getAdjacentChatFolderPage, getChatFolderSwipeSurfaceWidth, getChatFolderSwipeCommitDistance, canAnimateChatFolderSwipe, getChatFolderSwipeTransformTarget,
        createChatFolderSwipePage, prepareChatFolderSwipePager, setChatFolderSwipeOffset, settleChatFolderSwipeOffset, snapChatFolderSwipeBack, transitionToChatFolderBySwipe,
        transitionToChatFolder, setActiveChatFolder, loadChatFolders, setAvatarElementVisual, renderCurrentChatHeader, refreshChatInfoPresentation,
        syncChatInfoStatusVisibility, refreshRenderedUserMessages, applyChatUpdate, applyCurrentUserUpdateFromPresence, patchChatMembersCacheForPresence, patchMentionTargetsForPresence,
        patchAiBotUserForPresence, refreshMentionPickerForUserUpdate, applyUserUpdate, weatherLocationLabel, weatherIcon, formatWeatherValue,
        renderWeatherWidget, setWeatherStatus, renderWeatherSettingsForm, renderWeatherSearchResults, scheduleWeatherRefresh, loadWeatherSettings,
        loadCurrentWeather, searchWeatherLocations, saveWeatherSettings, isLocalhost, isPushSupported, setNotificationStatus,
        notificationPermissionLabel, renderNotificationSettingsForm, loadNotificationSettings, saveNotificationSettings, enablePushNotifications, disablePushOnThisDevice,
        testPushNotification, refreshPushDeviceState, applySoundSettings, setSoundStatus, renderSoundSettingsForm, getSoundSettingsFromForm,
        loadSoundSettings, saveSoundSettings, scheduleSoundSettingsSave, playAppSound, previewSound, previewAllSounds,
        getChatById, isChatPinned, getActiveChatFolder, isAllChatsFolderActive, getFolderPinnedChatOrder, isChatPinnedInFolder,
        compareChatsForFolder, folderSummaryText, sortChatsInPlace, getPinnedChats, getPinnedChatMoveState, isNotesChat,
        isCurrentNotesChat, isChatNotificationEnabled, isChatIncomingSoundEnabled, isPinNotificationEnabled, isPinSoundEnabled, isMentionSoundEnabled,
        isMessageMentioningCurrentUser, setChatPreferencesStatus, renderChatPreferencesForm, loadChatPreferences, saveChatPreferences, chatAllowsUnpinAnyPin,
        canManagePinSettings, isGeneralChat, isGroupOrPrivateChat, canHideChat, canLeaveChat, canManageDestructiveChat,
        setChatPinSettingsStatus, renderChatPinSettingsForm, canManageContextTransformSettings, setChatContextTransformStatus, renderChatContextTransformForm, saveChatContextTransformSetting,
        setChatDangerStatus, renderChatDangerControls, saveChatPinSettings, normalizePin, normalizePins, getPinPreviewText,
        getPinActorName, getPinToastText, buildPinBrowserNotification, getChatPins, getPinForMessage, canUnpinPin,
        getPinActionState, renderPinActionButton, applyPinsUpdate, handlePinnedMessageUpdate, loadChatPins, renderPinnedBar,
        jumpToPinnedMessage, pinMessage, unpinPin, togglePinFromRow, refreshVisiblePinButtons, resolveUiTarget,
        getPayloadChatId, handleServiceWorkerMessage, chatItemAvatarHtml, loadHiddenChatSearch, scheduleHiddenChatSearch, openHiddenChatFromSearch,
        openPrivateChatFromDirectory, showCenterToast, suppressNextChatItemTap, getFolderPinnedChatMoveState, renderFolderSelectableChatItem, totalUnreadForFolder,
        visibleChatCountForFolder, renderChatFolderPicker, positionChatFolderPicker, hideChatFolderContextMenu, renderChatFolderContextMenu, positionChatFolderContextMenu,
        refreshChatFolderContextMenu, showChatFolderContextMenu, hideChatFolderPicker, showChatFolderPicker, createChatFolder, renameChatFolder,
        deleteChatFolder, setChatFolderOrder, moveChatFolder, addChatsToFolder, removeChatFromFolder, setFolderChatPin,
        moveFolderChatPin, handleChatFolderContextMenuAction, resetChatFolderManageModal, renderChatFolderManageModal, openChatFolderManageModal, saveChatFolderManageChanges,
        setChatSidebarPin, moveChatSidebarPin, clearCachedChat, resetChatPreviewAfterHistoryClear, revealChatListAfterActiveChatClose, closeChatViewForChat,
        removeChatLocally, clearLocalChatHistory, hideChatFromList, leaveChat, deleteChatCompletely, clearChatHistoryForEveryone,
        copyTextToClipboard, modalEntryOf, rememberActiveElement, focusElementIfPossible, blurFocusedElementWithin, parseTransitionTimeMs,
        getElementTransitionTotalMs, registerModal, handleGrokImageRiskModalClosed, ensureDeepseekTextBotsModalContent, ensureQwenTextBotsModalContent, registerBuiltinModals,
        getTopModal, hasOpenModal, openModal, closeModal, closeTopModal, closeAllModals,
        loadMentionTargets, suppressMentionPickerFollowupClick, suppressContextConvertPickerFollowupClick, clearContextConvertPickerFollowupClickSuppress, ensureMentionPickerBackdrop, ensureMentionPicker,
        isComposerMeaningfullyEmpty, getManualMentionRange, syncMentionOpenButton, hideMentionPicker, findMentionTrigger, positionMentionPicker,
        renderMentionPicker, openMentionPickerFromButton, updateMentionPicker, insertMentionTarget, insertMentionTokenIntoComposer, insertRawMentionTriggerAtCursor,
        openPrivateChatWithUser, handleMentionPickerKeydown, handleMentionClick, isGroupLikeCurrentChat, ensureAvatarUserMenu, hideAvatarUserMenu,
        positionAvatarUserMenu, avatarMenuTargetFromEl, openAvatarUserMenu, singleEmojiPattern,
      } = legacyUiRuntimeApi;

      const adminBotAuditFactory = window.BananzaApp?.admin?.botAudit?.createBotAuditController;
      const adminBackupFactory = window.BananzaApp?.admin?.backup?.createBackupController;
      const adminUsersFactory = window.BananzaApp?.admin?.users?.createAdminUsersController;
      if (typeof adminBotAuditFactory !== 'function'
        || typeof adminBackupFactory !== 'function'
        || typeof adminUsersFactory !== 'function') {
        throw new Error('BananzaApp admin modules are required before app.js');
      }
      const adminBotAuditController = adminBotAuditFactory({
        document,
        $,
        api: (url, opts) => api(url, opts),
        esc,
        avatarHtml,
        formatDate,
        formatTime,
        openModal: (id, options = {}) => openModal(id, options),
      });
      const adminBackupController = adminBackupFactory({
        document,
        window,
        $,
        api: (url, opts) => api(url, opts),
        fetch: (url, opts) => window.fetch(url, opts),
        openModal: (id, options = {}) => openModal(id, options),
        getTopModal: () => getTopModal(),
        setInlineStatus: (id, message, type = '') => setInlineStatus(id, message, type),
        tx,
        esc,
        formatSize,
        filenameFromContentDisposition,
        getCurrentUser: () => currentUser,
        getToken: () => token,
        onRestoreApplied: () => {
          websocketService.clearReconnectTimer?.();
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          token = null;
          currentUser = null;
          if (ws) {
            try { ws.onclose = null; ws.close(1012, 'Backup restore'); } catch (e) {}
            ws = null;
          }
          syncCoreStateToRuntime();
          setTimeout(() => {
            location.href = '/login.html';
          }, 900);
        },
      });
      const adminUsersController = adminUsersFactory({
        document,
        $,
        api: (url, opts) => api(url, opts),
        openModal: (id, options = {}) => openModal(id, options),
        getTopModal: () => getTopModal(),
        getOnlineUsers: () => onlineUsers,
        avatarHtml,
        esc,
        formatDate,
        formatTime,
        alert: (message) => alert(message),
        confirm: (message) => confirm(message),
        openAdminBotAuditModal: (userId, displayName) => openAdminBotAuditModal(userId, displayName),
      });
      if (appContext) {
        appContext.services.admin = {
          users: adminUsersController,
          botAudit: adminBotAuditController,
          backup: adminBackupController,
        };
      }
    
      const uiSettingsFactory = window.BananzaApp?.settings?.ui?.createUiSettings;
      const weatherSettingsFactory = window.BananzaApp?.settings?.weather?.createWeatherSettings;
      const notificationSettingsFactory = window.BananzaApp?.settings?.notifications?.createNotificationSettings;
      const soundSettingsFactory = window.BananzaApp?.settings?.sound?.createSoundSettings;
      const settingsModalFactory = window.BananzaApp?.settings?.modal?.createSettingsModal;
      if (typeof uiSettingsFactory !== 'function'
        || typeof weatherSettingsFactory !== 'function'
        || typeof notificationSettingsFactory !== 'function'
        || typeof soundSettingsFactory !== 'function'
        || typeof settingsModalFactory !== 'function') {
        throw new Error('BananzaApp settings modules are required before app.js');
      }
    
      function setCurrentUserFromSettings(nextUser = null, { persist = true } = {}) {
        currentUser = nextUser;
        syncCoreStateToRuntime();
        if (currentUser && persist) persistCurrentUser();
        return currentUser;
      }
    
      const uiSettings = uiSettingsFactory({
        document,
        window,
        dom: appDom,
        config: appConfig,
        api: (url, opts) => api(url, opts),
        modals: modalManager,
        androidBridge,
        mobileViewport: mobileViewportShell,
        i18nHelpers,
        esc,
        getCurrentUser: () => currentUser,
        setCurrentUser: setCurrentUserFromSettings,
        state: {
          getCurrentUiTheme: () => currentUiTheme,
          setCurrentUiTheme: (value) => { currentUiTheme = value; },
          getCurrentVisualMode: () => currentVisualMode,
          setCurrentVisualMode: (value) => { currentVisualMode = value; },
          getPollComposerStyle: () => pollComposerStyle,
          setPollComposerStyle: (value) => { pollComposerStyle = value; },
          getCurrentModalAnimation: () => currentModalAnimation,
          setCurrentModalAnimation: (value) => { currentModalAnimation = value; },
          getCurrentModalAnimationSpeed: () => currentModalAnimationSpeed,
          setCurrentModalAnimationSpeed: (value) => { currentModalAnimationSpeed = value; },
          getCurrentMobileFontSize: () => currentMobileFontSize,
          setCurrentMobileFontSize: (value) => { currentMobileFontSize = value; },
          getCurrentUiLanguage: () => currentUiLanguage,
          setCurrentUiLanguage: (value) => { currentUiLanguage = value; },
          getMicrophoneMode: () => microphoneMode,
          setMicrophoneMode: (value) => { microphoneMode = value; },
          getScreenRotationAllowed: () => screenRotationAllowed,
          setScreenRotationAllowed: (value) => { screenRotationAllowed = Boolean(value); },
          getSendByEnter: () => sendByEnter,
          setSendByEnter: (value) => { sendByEnter = Boolean(value); },
          getScrollRestoreMode: () => scrollRestoreMode,
          setScrollRestoreMode: (value) => { scrollRestoreMode = value === 'restore' ? 'restore' : 'bottom'; },
          getOpenLastChatOnReload: () => openLastChatOnReload,
          setOpenLastChatOnReload: (value) => { openLastChatOnReload = Boolean(value); },
        },
        actions: {
          setInlineStatus: (...args) => setInlineStatus(...args),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          refreshPollComposerPreview: () => refreshPollComposerPreview(),
          refreshVoiceComposerState: () => window.BananzaVoiceHooks?.refreshComposerState?.(),
          refreshLocalizedUiRuntime: () => {
            if (chatList) renderChatList(chatSearch?.value || '');
            if (currentChatId) {
              renderCurrentChatHeader(getChatById(currentChatId));
              updateChatStatus();
              renderPinnedBar(currentChatId);
              refreshDateSeparators();
            }
            const chatMenuState = contextMenusController?.getChatContextMenuState?.();
            if (isFloatingSurfaceVisible(chatContextMenu) && chatMenuState?.chatId) renderChatContextMenu(getChatById(chatMenuState.chatId));
            if (isFloatingSurfaceVisible(chatFolderPicker)) renderChatFolderPicker();
            folderUiController.refreshVisibleContextMenu();
            const mediaMenuState = contextMenusController?.getMediaContextMenuState?.();
            if (isFloatingSurfaceVisible(mediaContextMenu) && mediaMenuState?.context) {
              renderMediaContextMenu(mediaMenuState.context);
              positionMediaContextMenu();
            }
          },
        },
      });
      const weatherSettingsController = weatherSettingsFactory({
        document,
        window,
        dom: appDom,
        api: (url, opts) => api(url, opts),
        esc,
        actions: {
          setInlineStatus: (...args) => setInlineStatus(...args),
        },
      });
      const notificationSettingsController = notificationSettingsFactory({
        document,
        window,
        api: (url, opts) => api(url, opts),
        state: {
          getCurrentChatId: () => currentChatId,
        },
        actions: {
          setInlineStatus: (...args) => setInlineStatus(...args),
        },
      });
      const soundSettingsController = soundSettingsFactory({
        document,
        window,
        api: (url, opts) => api(url, opts),
        actions: {
          setInlineStatus: (...args) => setInlineStatus(...args),
          getChatById: (chatId) => getChatById(chatId),
        },
      });
      const settingsModalController = settingsModalFactory({
        document,
        window,
        dom: appDom,
        modals: modalManager,
        ui: uiSettings,
        weather: weatherSettingsController,
        notifications: notificationSettingsController,
        sound: soundSettingsController,
        getCurrentUser: () => currentUser,
      });
      const settingsControllers = {
        ui: uiSettings,
        weather: weatherSettingsController,
        notifications: notificationSettingsController,
        sound: soundSettingsController,
        modal: settingsModalController,
      };
      if (appContext) appContext.services.settings = settingsControllers;
    
      const folderStoreFactory = window.BananzaApp?.folders?.store?.createChatFolderStore;
      const folderUiFactory = window.BananzaApp?.folders?.ui?.createChatFolderUi;
      const folderActionsFactory = window.BananzaApp?.folders?.actions?.createChatFolderActions;
      const folderManageModalFactory = window.BananzaApp?.folders?.manageModal?.createChatFolderManageModal;
      const newFolderTabFactory = window.BananzaApp?.folders?.newFolderTab?.createNewFolderTab;
      if (typeof folderStoreFactory !== 'function'
        || typeof folderUiFactory !== 'function'
        || typeof folderActionsFactory !== 'function'
        || typeof folderManageModalFactory !== 'function'
        || typeof newFolderTabFactory !== 'function') {
        throw new Error('BananzaApp folder modules are required before app.js');
      }
    
      const chatFolderStore = folderStoreFactory({
        getCurrentUser: () => currentUser,
        storage: localStorage,
        config: appConfig,
        compareChatActivity: (a, b) => compareChatActivity(a, b),
      });
      let folderActionsController = null;
      let folderManageModalController = null;
      const folderUiController = folderUiFactory({
        document,
        window,
        dom: appDom,
        store: chatFolderStore,
        config: appConfig,
        formatters,
        t,
        tx,
        state: {
          getCurrentUser: () => currentUser,
          setCurrentUser: (nextUser, { persist = true } = {}) => setCurrentUserFromSettings(nextUser, { persist }),
          getChats: () => chats,
          getOnlineUsers: () => onlineUsers,
          getCurrentModalAnimation: () => currentModalAnimation,
        },
        actions: {
          renderChatList: (filter) => renderChatList(filter),
          transitionToChatFolder: (folderId, options = {}) => transitionToChatFolder(folderId, options),
          loadChatFolders: (options = {}) => folderActionsController?.loadChatFolders(options) || Promise.resolve([]),
          handleFolderContextAction: (action, folderId) => folderActionsController?.handleChatFolderContextMenuAction(action, folderId),
          saveStripVisibility: (nextValue) => folderActionsController?.saveStripVisibility(nextValue),
          hideChatContextMenu: (options = {}) => hideChatContextMenu(options),
          hideMediaContextMenu: (options = {}) => hideMediaContextMenu(options),
          showCenterToast: (message) => showCenterToast(message),
          isFloatingSurfaceVisible: (el) => isFloatingSurfaceVisible(el),
          openFloatingSurface: (el) => openFloatingSurface(el),
          closeFloatingSurface: (el, options = {}) => closeFloatingSurface(el, options),
          getFloatingViewportRect: () => getFloatingViewportRect(),
          measureFloatingSurface: (el, fallbackWidth, fallbackHeight) => measureFloatingSurface(el, fallbackWidth, fallbackHeight),
          positionFloatingElement: (el, left, top) => positionFloatingElement(el, left, top),
          clamp: (value, min, max) => clamp(value, min, max),
          prefersReducedMotion: () => prefersReducedMotion(),
          chatItemAvatarHtml: (chat) => chatItemAvatarHtml(chat),
          renderChatLastPreviewHtml: (chat) => renderChatLastPreviewHtml(chat),
          animateChatHeaderActionButton: (buttonOrSelector) => animateChatHeaderActionButton(buttonOrSelector),
        },
      });
      folderActionsController = folderActionsFactory({
        document,
        window,
        api: (url, opts) => api(url, opts),
        store: chatFolderStore,
        ui: folderUiController,
        t,
        tx,
        state: {
          getChatSearchValue: () => chatSearch?.value || '',
        },
        actions: {
          renderChatList: (filter) => renderChatList(filter),
          showCenterToast: (message) => showCenterToast(message),
          isAbortError: (error) => isAbortError(error),
          transitionToChatFolder: (folderId, options = {}) => transitionToChatFolder(folderId, options),
          refreshManageModal: () => {
            const state = folderManageModalController?.getState?.();
            if (state?.chatId) folderManageModalController.renderChatFolderManageModal(state.chatId);
          },
        },
      });
      folderManageModalController = folderManageModalFactory({
        document,
        dom: appDom,
        store: chatFolderStore,
        ui: folderUiController,
        modals: modalManager,
        formatters,
        getChats: () => chats,
        getChatById: (chatId) => getChatById(chatId),
        actions: {
          loadChatFolders: (options = {}) => folderActionsController.loadChatFolders(options),
          addChatsToFolder: (folderId, chatIds) => folderActionsController.addChatsToFolder(folderId, chatIds),
          removeChatFromFolder: (folderId, chatId) => folderActionsController.removeChatFromFolder(folderId, chatId),
          openModal: (id, options = {}) => openModal(id, options),
        },
      });
      const newFolderTabController = newFolderTabFactory({
        document,
        window,
        dom: appDom,
        ui: folderUiController,
        state: {
          getChats: () => chats,
        },
        actions: {
          compareChatsForList: (a, b) => compareChatsForList(a, b),
          getChatSearchHaystack: (chat) => getChatSearchHaystack(chat),
          createChatFolder: (name, chatIds) => folderActionsController.createChatFolder(name, chatIds),
          closeAllModals: () => closeAllModals(),
          alert: (message) => alert(message),
        },
      });
      const folderControllers = {
        store: chatFolderStore,
        ui: folderUiController,
        actions: folderActionsController,
        manageModal: folderManageModalController,
        newFolderTab: newFolderTabController,
      };
      if (appContext) appContext.services.folders = folderControllers;
    
      const chatListStoreFactory = window.BananzaApp?.chatList?.store?.createChatListStore;
      const chatListRendererFactory = window.BananzaApp?.chatList?.render?.createChatListRenderer;
      const chatListDataFactory = window.BananzaApp?.chatList?.data?.createChatListDataController;
      const presenceControllerFactory = window.BananzaApp?.chatList?.presence?.createPresenceController;
      const chatListRecoveryFactory = window.BananzaApp?.chatList?.recovery?.createChatListRecovery;
      if (typeof chatListStoreFactory !== 'function'
        || typeof chatListRendererFactory !== 'function'
        || typeof chatListDataFactory !== 'function'
        || typeof presenceControllerFactory !== 'function'
        || typeof chatListRecoveryFactory !== 'function') {
        throw new Error('BananzaApp chat list modules are required before app.js');
      }
    
      const chatListStore = chatListStoreFactory({
        chats,
        allUsers,
        onlineUsers,
        compareChatsForList: (a, b) => compareChatsForList(a, b),
      });
      chatListService.configure?.({ store: chatListStore });
      refreshChatListReferences();
      syncCoreStateToRuntime();
    
      const chatListRenderer = chatListRendererFactory({
        document,
        window,
        dom: appDom,
        store: chatListStore,
        folders: folderControllers,
        formatters,
        customEmoji,
        config: appConfig,
        t,
        tx,
        state: {
          getChatSearchValue: () => chatSearch?.value || '',
          getCurrentChatId: () => currentChatId,
          shouldSuppressChatItemTap: () => Date.now() < suppressNextChatItemTapUntil,
        },
        actions: {
          alert: (message) => alert(message),
          compareChatsForFolder: (folderId, a, b) => compareChatsForFolder(folderId, a, b),
          getCurrentChatId: () => currentChatId,
          hideChatContextMenu: (options = {}) => hideChatContextMenu(options),
          isAiBotDirectoryUser: (user) => isAiBotDirectoryUser(user),
          isChatListWaitingForActiveFolder: (folderId) => isChatListWaitingForActiveFolder(folderId),
          isChatPinned: (chat) => isChatPinned(chat),
          isChatPinnedInFolder: (folderId, chat) => isChatPinnedInFolder(folderId, chat),
          isNotesChat: (chat) => isNotesChat(chat),
          normalizeChatFolderId: (folderId) => normalizeChatFolderId(folderId),
          openChat: (chatId) => openChat(chatId),
          openHiddenChatFromSearch: (chatId) => openHiddenChatFromSearch(chatId),
          openPrivateChatFromDirectory: (userId) => openPrivateChatFromDirectory(userId),
          renderChatFolderPicker: () => renderChatFolderPicker(),
          scheduleChatListCacheSync: () => scheduleChatListCacheSync(),
          scheduleHiddenChatSearch: (query) => scheduleHiddenChatSearch(query),
          showToast: (message) => showCenterToast(message),
          userSecondaryLineText: (user) => userSecondaryLineText(user),
        },
      });
    
      const chatListDataController = chatListDataFactory({
        document,
        window,
        dom: appDom,
        api: (url, opts) => api(url, opts),
        store: chatListStore,
        renderer: chatListRenderer,
        folders: folderControllers,
        cache: {
          storage: localStorage,
          cacheAssets: (urls) => window.cacheAssets?.(urls),
        },
        config: appConfig,
        tx,
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          getChatSearchValue: () => chatSearch?.value || '',
        },
        actions: {
          applyChatBackground: (chat) => applyChatBackground(chat),
          clearCachedChat: (chatId, options = {}) => clearCachedChat(chatId, options),
          clearChatLocalState: (chatId) => {
            chatPinsByChat.delete(Number(chatId || 0));
            readReceiptController.clearChatMemberLastReads(Number(chatId || 0));
          },
          closeChatViewForChat: (chatId) => closeChatViewForChat(chatId),
          compareChatsForList: (a, b) => compareChatsForList(a, b),
          getCurrentChatShotState: () => getCurrentChatShotState(),
          getMediaNoteFallbackLabel: (msg) => getMediaNoteFallbackLabel(msg),
          invalidateChatShotState: (chatId) => invalidateChatShotState(chatId),
          invalidateContextConvertAvailability: (chatId) => invalidateContextConvertAvailability(chatId),
          isAbortError: (error) => isAbortError(error),
          loadChatFolders: (options = {}) => loadChatFolders(options),
          normalizeChatFolderId: (folderId) => normalizeChatFolderId(folderId),
          openChat: (chatId) => openChat(chatId),
          refreshChatInfoPresentation: (chat) => refreshChatInfoPresentation(chat),
          refreshVisiblePinButtons: (chatId) => refreshVisiblePinButtons(chatId),
          renderChatContextTransformForm: (chat) => renderChatContextTransformForm(chat),
          renderChatDangerControls: (chat) => renderChatDangerControls(chat),
          renderChatPinSettingsForm: (chat) => renderChatPinSettingsForm(chat),
          renderChatPreferencesForm: (chat) => renderChatPreferencesForm(chat),
          renderChatShotForm: (state) => renderChatShotForm(state),
          renderCurrentChatHeader: (chat) => renderCurrentChatHeader(chat),
          renderPinnedBar: (chatId) => renderPinnedBar(chatId),
          scheduleMessageBackgroundSync: () => scheduleMessageBackgroundSync(),
          setChatSearchOpen: (open, options = {}) => setChatSearchOpen(open, options),
          showToast: (message) => showCenterToast(message),
          updateChatStatus: () => updateChatStatus(),
        },
      });
    
      const presenceController = presenceControllerFactory({
        document,
        window,
        store: chatListStore,
        renderer: chatListRenderer,
        formatters,
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          getChatSearchValue: () => chatSearch?.value || '',
        },
        actions: {
          applyCurrentUserUpdate: (user) => applyCurrentUserUpdateFromPresence(user),
          isChatInfoVisible: () => !chatInfoModal?.classList.contains('hidden'),
          patchAiBotUser: (user) => patchAiBotUserForPresence(user),
          patchChatMembersCache: (user) => patchChatMembersCacheForPresence(user),
          patchMentionTargets: (user) => patchMentionTargetsForPresence(user),
          refreshAdminUserStatuses: () => refreshAdminUserStatuses(),
          refreshChatInfoPresentation: (chat) => refreshChatInfoPresentation(chat),
          refreshChatInfoStatus: () => refreshChatInfoStatus(),
          refreshChatMemberStatuses: () => refreshChatMemberStatuses(),
          refreshMentionPickerForUserUpdate: () => refreshMentionPickerForUserUpdate(),
          refreshRenderedUserMessages: (user) => refreshRenderedUserMessages(user),
          renderCurrentChatHeader: (chat) => renderCurrentChatHeader(chat),
          setAvatarElementVisual: (el, options = {}) => setAvatarElementVisual(el, options),
          updateCachedMessagesByUser: (user) => window.messageCache?.updateMessagesByUser?.(user).catch(() => {}),
          updateChatStatus: () => updateChatStatus(),
        },
      });
    
      const chatListRecoveryController = chatListRecoveryFactory({
        document,
        window,
        store: chatListStore,
        config: appConfig,
        state: {
          getCurrentChatId: () => currentChatId,
          getCurrentUser: () => currentUser,
          getToken: () => token,
          hasAuth: () => Boolean(token && currentUser),
        },
        actions: {
          applyScreenRotationPreference: (options = {}) => applyScreenRotationPreference(options).catch(() => {}),
          connectWS: (options = {}) => connectWS(options),
          flushCurrentChatScrollAnchor: (chatId, options = {}) => flushCurrentChatScrollAnchor(chatId, options),
          getResolvedMobileBaseScene: () => getResolvedMobileBaseScene(),
          isMobileRouteTransitionActive: () => mobileRouteTransitionActive,
          isUiTransitionBusy: () => isUiTransitionBusy(),
          isWebSocketOpenOrConnecting: () => Boolean(ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)),
          loadChats: (options = {}) => loadChats(options),
          openChat: (chatId, options = {}) => openChat(chatId, options),
          scheduleMobileViewportRecovery: () => scheduleMobileViewportRecovery(),
          syncCurrentChatMessages: (chatId, options = {}) => (
            appContext?.services?.openChat?.controller?.catchUpCurrentChat?.(chatId, options)
            || catchUpCurrentChat(chatId, options)
          ),
          syncMobileBaseSceneState: (options = {}) => syncMobileBaseSceneState(options),
        },
      });
    
      const chatListControllers = {
        store: chatListStore,
        renderer: chatListRenderer,
        data: chatListDataController,
        presence: presenceController,
        recovery: chatListRecoveryController,
        service: chatListService,
      };
      chatListService.configure?.({
        store: chatListStore,
        renderer: chatListRenderer,
        data: chatListDataController,
        presence: presenceController,
        recovery: chatListRecoveryController,
      });
      refreshChatListReferences();
      syncCoreStateToRuntime();
      if (appContext) appContext.services.chatList = chatListControllers;
    
      const openChatPagesFactory = window.BananzaApp?.openChat?.pages?.createMessagePagesController;
      const readReceiptFactory = window.BananzaApp?.openChat?.readReceipts?.createReadReceiptController;
      const scrollControllerFactory = window.BananzaApp?.openChat?.scroll?.createScrollController;
      const mediaPlaybackFactory = window.BananzaApp?.openChat?.mediaPlayback?.createMediaPlaybackController;
      const openChatControllerFactory = window.BananzaApp?.openChat?.controller?.createOpenChatController;
      if (typeof openChatPagesFactory !== 'function'
        || typeof readReceiptFactory !== 'function'
        || typeof scrollControllerFactory !== 'function'
        || typeof mediaPlaybackFactory !== 'function'
        || typeof openChatControllerFactory !== 'function') {
        throw new Error('BananzaApp open-chat modules are required before app.js');
      }
    
      let openChatController = null;
      const openChatPagesController = openChatPagesFactory({
        window,
        document,
        api: (url, opts) => api(url, opts),
        attachments: attachmentHelpers,
        config: appConfig,
        storage: localStorage,
        cacheAssets: (urls) => window.cacheAssets?.(urls),
        state: {
          getCurrentChatId: () => currentChatId,
          getChatById: (chatId) => getChatById(chatId),
        },
        actions: {
          isMessageDisplayed: (id) => isMessageDisplayed(id),
          normalizePinEvent: (raw) => normalizePinEvent(raw),
          normalizePinEvents: (events) => normalizePinEvents(events),
        },
      });
      const readReceiptController = readReceiptFactory({
        window,
        document,
        api: (url, opts) => api(url, opts),
        services: {
          chatList: chatListControllers,
        },
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          getChats: () => chats,
          getChatById: (chatId) => getChatById(chatId),
        },
        actions: {
          getMaxRenderedMessageId: () => getMaxRenderedMessageId(),
          isCurrentChatActivelyVisible: (chatId) => isCurrentChatActivelyVisible(chatId),
          isNearBottom: (threshold) => isNearBottom(threshold),
          loadChats: (options = {}) => loadChats(options),
          renderChatList: () => renderChatList(chatSearch?.value || ''),
          updateVisibleOwnReadState: (chatId, threshold) => updateVisibleOwnReadStateRows(chatId, threshold),
        },
      });
      const scrollController = scrollControllerFactory({
        window,
        document,
        dom: appDom,
        config: appConfig,
        storage: localStorage,
        formatDate,
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          getOpenSeq: () => openChatController?.getOpenSeq?.() || 0,
          getScrollRestoreMode: () => scrollRestoreMode,
        },
        actions: {
          getHasMoreAfter: () => Boolean(openChatController?.hasMoreAfter?.()),
          hasPendingMediaBottomScroll: () => Boolean(messageStateController?.hasPendingMediaBottomScroll?.()),
          isCurrentChatActivelyVisible: (chatId) => isCurrentChatActivelyVisible(chatId),
          markCurrentChatReadIfAtBottom: (force) => markCurrentChatReadIfAtBottom(force),
          maybeLoadMoreAtBottom: () => maybeLoadMoreAtBottom(),
          syncComposerButton: () => syncContextConvertComposerButton(),
        },
      });
      const mediaPlaybackController = mediaPlaybackFactory({
        window,
        document,
        dom: appDom,
        pages: openChatPagesController,
        state: {
          getCurrentChatId: () => currentChatId,
        },
      });
      openChatController = openChatControllerFactory({
        window,
        document,
        dom: appDom,
        config: appConfig,
        pages: openChatPagesController,
        readReceipts: readReceiptController,
        scroll: scrollController,
        mediaPlayback: mediaPlaybackController,
        services: {
          chatList: chatListControllers,
          folders: folderControllers,
        },
        state: {
          getToken: () => token,
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          setCurrentChatId: (chatId) => {
            const nextId = Number(chatId || 0);
            currentChatId = nextId > 0 ? nextId : null;
            runtimeState.setCurrentChatId?.(currentChatId);
            runtimeState.setCurrentChat?.(getChatById(currentChatId));
            openChatService.syncRuntimeState?.();
            return currentChatId;
          },
          setCurrentChat: (chat) => {
            runtimeState.setCurrentChat?.(chat);
            return chat || null;
          },
          setMessages: (messages) => openChatService.setMessages?.(messages),
          mergeMessages: (messages, options = {}) => openChatService.mergeMessages?.(messages, options),
          getChats: () => chats,
          getChatById: (chatId) => getChatById(chatId),
          getChatSearchValue: () => chatSearch?.value || '',
          getCompactViewMap: () => compactViewMap,
          setCompactView: (value) => { compactView = Boolean(value); },
          getScrollRestoreMode: () => scrollRestoreMode,
          hasEdit: () => Boolean(composerStateController.editTo),
        },
        actions: {
          appendTimelineItems: (messages, pinEvents, options = {}) => appendTimelineItems(messages, pinEvents, options),
          applyChatBackground: (chat) => applyChatBackground(chat),
          cleanupDuplicateDateSeparators: () => cleanupDuplicateDateSeparators(),
          clearDisplayedTimelineState: () => {
            messageStateController?.clearDisplayedMessages?.();
            messageStateController?.clearDisplayedPinEvents?.();
          },
          clearEdit: (options = {}) => clearEdit(options),
          clearPendingFile: () => clearPendingFile(),
          clearReply: () => clearReply(),
          closeChatHeaderActions: () => closeChatHeaderActions(),
          closeTransientUi: () => {
            hideMentionPicker();
            closeEmojiPicker({ immediate: true });
            hideAttachMenu({ immediate: true });
            hideContextConvertPicker();
            clearActivePulseVoterPopover({ skipRefresh: true });
            hideAvatarUserMenu();
            hideChatContextMenu({ immediate: true });
            hideFloatingMessageActions({ immediate: true });
          },
          filterNewPinEvents: (events) => filterNewPinEvents(events),
          flushDeferredRecoverySync: () => flushDeferredRecoverySync(),
          isAbortError: (error) => isAbortError(error),
          isChatPinned: (chat) => isChatPinned(chat),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          isUiTransitionBusy: () => isUiTransitionBusy(),
          loadChatPins: (chatId) => loadChatPins(chatId),
          loadChatShotState: (chatId, options = {}) => loadChatShotState(chatId, options),
          loadChats: (options = {}) => loadChats(options),
          loadContextConvertAvailability: (chatId, options = {}) => loadContextConvertAvailability(chatId, options),
          markRecoveryRequested: (reason) => chatListService.markRecoveryRequested(reason),
          refreshPollComposerActionState: () => refreshPollComposerActionState(),
          refreshVoiceComposerState: () => window.BananzaVoiceHooks?.refreshComposerState?.(),
          renderChatList: (filter = chatSearch?.value || '') => renderChatList(filter),
          renderCurrentChatHeader: (chat) => renderCurrentChatHeader(chat),
          renderedMessageIdsMatch: (messages) => renderedMessageIdsMatch(messages),
          renderMessages: (messages, options = {}) => renderMessages(messages, options.pinEvents || []),
          renderOutboxForChat: (chatId) => renderOutboxForChat(chatId),
          renderPinnedBar: (chatId) => renderPinnedBar(chatId),
          replaceRenderedMessages: (messages, options = {}) => replaceRenderedMessages(messages, options.pinEvents || [], options),
          restoreComposerDraft: (chatId) => restoreComposerDraft(chatId),
          revealActiveMobileChatRoute: (options = {}) => revealActiveMobileChatRoute(options),
          revealChatHydration: (seq, chatId) => revealChatHydration(seq, chatId),
          saveComposerDraft: (chatId) => saveComposerDraft(chatId),
          setChatHydrating: (active) => setChatHydrating(active),
          syncChatAreaMetrics: () => syncChatAreaMetrics(),
          syncChatShotButton: () => syncChatShotButton(),
          syncMentionOpenButton: () => syncMentionOpenButton(),
          updateChatListLastMessage: (message) => updateChatListLastMessage(message),
          updateChatStatus: () => updateChatStatus(),
        },
      });
      const openChatControllers = {
        pages: openChatPagesController,
        readReceipts: readReceiptController,
        scroll: scrollController,
        mediaPlayback: mediaPlaybackController,
        controller: openChatController,
        service: openChatService,
      };
      openChatService.configure?.(openChatControllers);
      openChatService.syncRuntimeState?.();
      if (appContext) appContext.services.openChat = openChatControllers;
    
      const messageStateFactory = window.BananzaApp?.messages?.state?.createMessageState;
      const messageAttachmentFactory = window.BananzaApp?.messages?.attachments?.createMessageAttachmentRenderer;
      const messagePollFactory = window.BananzaApp?.messages?.polls?.createPollMessageRenderer;
      const messageCallCardFactory = window.BananzaApp?.messages?.callCards?.createCallCardRenderer;
      const messageOutboxFactory = window.BananzaApp?.messages?.outbox?.createMessageOutbox;
      const messageUpdatesFactory = window.BananzaApp?.messages?.updates?.createMessageUpdates;
      const messageRendererFactory = window.BananzaApp?.messages?.render?.createMessageRenderer;
      if (typeof messageStateFactory !== 'function'
        || typeof messageAttachmentFactory !== 'function'
        || typeof messagePollFactory !== 'function'
        || typeof messageCallCardFactory !== 'function'
        || typeof messageOutboxFactory !== 'function'
        || typeof messageUpdatesFactory !== 'function'
        || typeof messageRendererFactory !== 'function') {
        throw new Error('BananzaApp message modules are required before app.js');
      }
    
      messageStateController = messageStateFactory({
        messageIdKey: (id) => messageIdKey(id),
      });
      messageAttachmentRenderer = messageAttachmentFactory({
        window,
        document,
        api: (url, opts) => api(url, opts),
        attachments: attachmentHelpers,
        formatters,
        esc,
        formatSize,
        state: messageStateController,
        actions: {
          isClientSideMessage: (msg) => isClientSideMessage(msg),
          applyMessageUpdate: (msg, options = {}) => applyMessageUpdate(msg, options),
        },
      });
      messageCallCardRenderer = messageCallCardFactory({
        window,
        document,
        dom: { messagesEl },
        api: (url, opts) => api(url, opts),
        formatters,
        t,
        esc,
        formatDuration: (seconds) => messageAttachmentRenderer.formatDuration(seconds),
        normalizeMimeType,
        fileExtension,
        clamp,
        getToken: () => token,
        $,
        actions: {
          showCenterToast: (message) => showCenterToast(message),
          openModal: (id, options = {}) => openModal(id, options),
          closeModal: (id, options = {}) => closeModal(id, options),
          openMediaViewer: (src, type = 'image') => openMediaViewer(src, type),
          showMediaContextMenuForContext: (context, options = {}) => showMediaContextMenuForContext(context, options),
          getAbsoluteMessageMediaUrl: (url) => getAbsoluteMessageMediaUrl(url),
          bindMediaPlaybackState: (mediaEl, message, role) => bindMediaPlaybackState(mediaEl, message, role),
          isMediaPlaybackCompleted: (message, role) => isMediaPlaybackCompleted(message, role),
          setMediaPlaybackCompleted: (message, role, completed) => setMediaPlaybackCompleted(message, role, completed),
        },
      });
      messagePollRenderer = messagePollFactory({
        window,
        document,
        dom: {
          messagesEl,
          pollVotersModal,
          pollVotersMeta,
          pollVotersTitle,
          pollVotersStatus,
          pollVotersList,
        },
        api: (url, opts) => api(url, opts),
        formatters,
        ui: uiSettings,
        t,
        esc,
        initials,
        formatTime,
        formatDate,
        formatRelativeDuration,
        formatPollDeadline,
        normalizePollStyle: (style) => normalizePollStyle(style),
        setPollStyleSurface: (modalEl, style) => setPollStyleSurface(modalEl, style),
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          getChatById: (chatId) => getChatById(chatId),
        },
        actions: {
          replaceRenderedMessage: (msg, options = {}) => messageRenderer?.replaceRenderedMessage?.(msg, options),
          syncChatAreaMetrics: () => syncChatAreaMetrics(),
          showCenterToast: (message) => showCenterToast(message),
          openModal: (id, options = {}) => openModal(id, options),
          openFloatingSurface: (el) => openFloatingSurface(el),
          closeFloatingSurface: (el, options = {}) => closeFloatingSurface(el, options),
          avatarHtml: (name, color, avatarUrl, size) => avatarHtml(name, color, avatarUrl, size),
        },
      });
      messageRenderer = messageRendererFactory({
        window,
        document,
        dom: { messagesEl },
        formatters,
        attachmentHelpers,
        attachmentRenderer: messageAttachmentRenderer,
        pollRenderer: messagePollRenderer,
        callCardRenderer: messageCallCardRenderer,
        messageState: messageStateController,
        t,
        esc,
        formatDate,
        formatTime,
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
          isCompactView: () => compactView,
          contextConvertPendingMessageIds,
          contextOriginalRestorePendingMessageIds,
          grokImageRiskRetryPending,
          getReactionPickerKeepKeyboard: () => getReactionPickerKeepKeyboard(),
        },
        actions: {
          setLoadMoreAfterLoading: (value) => setLoadMoreAfterLoading(value),
          hideScrollDateIndicator: (options = {}) => hideScrollDateIndicator(options),
          buildMessagesRootChildren: (fragment = null) => buildMessagesRootChildren(fragment),
          normalizePinEvents: (events = []) => normalizePinEvents(events),
          normalizePinEvent: (event) => normalizePinEvent(event),
          jumpToPinnedMessage: (pin) => jumpToPinnedMessage(pin),
          filterNewMessages: (messages = []) => filterNewMessages(messages),
          insertAtMessagesEnd: (node) => insertAtMessagesEnd(node),
          getMessagesLastContentChild: () => getMessagesLastContentChild(),
          updateScrollBottomButton: () => updateScrollBottomButton(),
          refreshScrollDateIndicator: () => refreshScrollDateIndicator(),
          updateHasMoreAfterFromChat: (chatId) => updateHasMoreAfterFromChat(chatId),
          isLoadingMoreAfter: () => openChatController?.isLoadingMoreAfter?.(),
          setAvatarElementVisual: (el, options = {}) => setAvatarElementVisual(el, options),
          applyOwnReadStateToMessage: (msg, chatId) => applyOwnReadStateToMessage(msg, chatId),
          isClientSideMessage: (msg) => isClientSideMessage(msg),
          isSingleEmojiMessage: (text) => isSingleEmojiMessage(text),
          isSingleCustomEmojiMessage: (text) => isSingleCustomEmojiMessage(text),
          renderCustomEmojiHtml: (text, options = {}) => renderCustomEmojiHtml(text, options),
          canContextConvertMessage: (msg) => canContextConvertMessage(msg),
          canRestoreContextOriginalMessage: (msg) => canRestoreContextOriginalMessage(msg),
          canSaveMessageToNotes: (msg) => canSaveMessageToNotes(msg),
          canForwardMessage: (msg) => canForwardMessage(msg),
          canEditMessage: (msg) => canEditMessage(msg),
          getReplyPreviewText: (msg) => getReplyPreviewText(msg),
          getReplyQuoteText: (msg) => getReplyQuoteText(msg),
          renderMessageText: (text, mentions) => renderMessageText(text, mentions),
          renderReactions: (reactions) => renderReactions(reactions),
          renderPinActionButton: (msg) => renderPinActionButton(msg),
          deleteMessage: (id) => deleteMessage(id),
          bindTouchSafeButtonActivation: (button, handler) => bindTouchSafeButtonActivation(button, handler),
          setReplyFromRow: (row) => setReplyFromRow(row),
          copyMessageFromRow: (row) => copyMessageFromRow(row),
          setEditFromRow: (row) => setEditFromRow(row),
          bindContextConvertMessageButton: (button, row) => bindContextConvertMessageButton(button, row),
          bindContextOriginalRestoreButton: (button, row) => bindContextOriginalRestoreButton(button, row),
          showReactionPicker: (row, anchor, options = {}) => showReactionPicker(row, anchor, options),
          openForwardMessageModal: (msg) => openForwardMessageModal(msg),
          saveMessageToNotes: (msg, button) => saveMessageToNotes(msg, button),
          togglePinFromRow: (row) => togglePinFromRow(row),
          retrySend: (row) => messageOutbox?.retrySend?.(row),
          scheduleRetryLayout: () => messageOutbox?.scheduleRetryLayout?.(),
          retryGrokImageRiskPrompt: (row, button) => retryGrokImageRiskPrompt(row, button),
          handleMentionClick: (event, button) => handleMentionClick(event, button),
          scrollToMessage: (id) => scrollToMessage(id),
          jumpToSavedOriginal: (msg) => jumpToSavedOriginal(msg),
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          openImageViewer: (src) => openImageViewer(src),
          openMediaViewer: (src, type = 'image') => openMediaViewer(src, type),
          bindMediaPlaybackState: (mediaEl, message, role) => bindMediaPlaybackState(mediaEl, message, role),
          isNearBottom: (threshold) => isNearBottom(threshold),
          captureScrollAnchor: () => captureScrollAnchor(),
          restoreScrollAnchor: (anchor, attempts) => restoreScrollAnchor(anchor, attempts),
          saveCurrentScrollAnchor: (chatId, options = {}) => saveCurrentScrollAnchor(chatId, options),
          scrollToBottom: (instant = false, markRead = false, options = {}) => scrollToBottom(instant, markRead, options),
        },
      });
      messageOutbox = messageOutboxFactory({
        window,
        document,
        dom: { messagesEl },
        api: (url, opts) => api(url, opts),
        renderer: messageRenderer,
        messageState: messageStateController,
        state: {
          getCurrentUser: () => currentUser,
          getCurrentChatId: () => currentChatId,
        },
        actions: {
          updateScrollBottomButton: () => updateScrollBottomButton(),
          isNearBottom: (threshold) => isNearBottom(threshold),
          captureScrollAnchor: () => captureScrollAnchor(),
          restoreScrollAnchor: (anchor, attempts) => restoreScrollAnchor(anchor, attempts),
          applyOwnReadStateToMessage: (msg, chatId) => applyOwnReadStateToMessage(msg, chatId),
          updateChatListLastMessage: (msg) => updateChatListLastMessage(msg),
          scrollToBottom: (instant = false, markRead = false, options = {}) => scrollToBottom(instant, markRead, options),
          getReplySnapshot: (source) => getReplySnapshot(source),
          clearReply: () => clearReply(),
          playAppSound: (type, options = {}) => playAppSound(type, options),
          makeClientId: (prefix) => makeClientId(prefix),
        },
      });
      messageUpdates = messageUpdatesFactory({
        window,
        document,
        dom: { messagesEl },
        api: (url, opts) => api(url, opts),
        renderer: messageRenderer,
        messageCache: window.messageCache,
        esc,
        state: {
          getCurrentChatId: () => currentChatId,
          getEditMessageId: () => composerStateController.editTo?.id || 0,
        },
        actions: {
          loadChats: () => loadChats(),
          ensureScrollAnchorsLoaded: () => ensureScrollAnchorsLoaded(),
          getScrollAnchor: (chatId) => scrollController.getScrollAnchor(chatId),
          deleteScrollAnchor: (chatId) => scrollController.deleteScrollAnchor(chatId),
          captureScrollAnchor: () => captureScrollAnchor(),
          restoreScrollAnchor: (anchor, attempts) => restoreScrollAnchor(anchor, attempts),
          saveCurrentScrollAnchor: (chatId, options = {}) => saveCurrentScrollAnchor(chatId, options),
          hideDeletedMessageSurfaces: (msgId) => {
            if (
              String(getActiveMessageActionsRow()?.dataset?.msgId || '') === String(msgId)
              || String(getReactionPickerMsgId() || '') === String(msgId)
            ) {
              hideFloatingMessageActions({ immediate: true });
            }
          },
          clearEdit: (options = {}) => clearEdit(options),
          getReplyPreviewText: (msg) => getReplyPreviewText(msg),
          updateReplyBarFromMessage: (msg, text) => composerReplyEditController?.updateReplyPreview?.(msg.id, text),
          applyOwnReadStateToMessage: (msg, chatId) => applyOwnReadStateToMessage(msg, chatId),
          refreshReactionPickerForMessage: (msg) => {
            if (Number(getReactionPickerMsgId() || 0) === Number(msg.id || 0) && isFloatingSurfaceVisible(reactionPicker)) {
              renderReactionPickerContent();
              positionMessageActionSurfaces({
                includeActions: Boolean(getActiveMessageActionsRow()),
                includePicker: true,
              });
            }
          },
        },
      });
      messagesService.configure?.({
        state: messageStateController,
        attachments: messageAttachmentRenderer,
        polls: messagePollRenderer,
        callCards: messageCallCardRenderer,
        renderer: messageRenderer,
        outbox: messageOutbox,
        updates: messageUpdates,
      });
      const messageServices = messagesService;
      if (appContext) appContext.services.messages = messageServices;
    
      const refreshVoiceComposerState = () => window.BananzaVoiceHooks?.refreshComposerState?.();
      const sendComposerWsPayload = (payload) => {
        const openState = window.WebSocket?.OPEN ?? 1;
        if (!ws || ws.readyState !== openState) return false;
        ws.send(JSON.stringify(payload));
        return true;
      };
    
      composerTextController = composerTextFactory({
        window,
        document,
        dom: appDom,
        state: composerStateController,
        customEmoji: window.BananzaApp?.customEmoji,
        formatters: window.BananzaApp?.formatters,
        esc,
        actions: {
          noteMobileKeyboardInputDelta: (delta) => {
            mobileComposerGuard?.noteMobileKeyboardInputDelta?.(delta);
          },
          isFloatingSurfaceVisible: (el) => isFloatingSurfaceVisible(el),
          positionEmojiPicker: (anchor) => positionEmojiPicker(anchor),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          scheduleMobileViewportRecovery: (delay) => scheduleMobileViewportRecovery(delay),
          queueIosViewportLayoutSync: () => queueIosViewportLayoutSync(),
          refreshVoiceComposerState,
        },
      });
    
      composerReplyEditController = composerReplyEditFactory({
        window,
        document,
        dom: appDom,
        state: composerStateController,
        text: composerTextController,
        getCurrentUser: () => currentUser,
        getCurrentChatId: () => currentChatId,
        actions: {
          alert: (message) => alert(message),
          isClientSideMessage: (msg) => isClientSideMessage(msg),
          isPollMessage: (msg) => isPollMessage(msg),
          isCurrentNotesChat: () => isCurrentNotesChat(),
          getMediaNoteFallbackLabel: (msg) => getMediaNoteFallbackLabel(msg),
          hideFloatingMessageActions: (options = {}) => hideFloatingMessageActions(options),
          copyTextToClipboard: (textValue) => copyTextToClipboard(textValue),
          showCenterToast: (message) => showCenterToast(message),
          syncMentionOpenButton: () => syncMentionOpenButton(),
          refreshPollComposerActionState: () => refreshPollComposerActionState(),
          refreshVoiceComposerState,
          queueIosViewportLayoutSync: () => queueIosViewportLayoutSync(),
          updateComposerAiOverrideState: () => updateComposerAiOverrideState().catch(() => {}),
          clearComposerDraft: (chatId) => clearComposerDraft(chatId),
          shouldKeepComposerForMobileMessageInteraction: () => shouldKeepComposerForMobileMessageInteraction(),
          suppressNextMessageActionTap: () => suppressNextMessageActionTap(),
          focusComposerKeepKeyboard: (force) => focusComposerKeepKeyboard(force),
          safeVibrate: (pattern) => safeVibrate(pattern),
        },
      });
    
      composerFilesController = composerFilesFactory({
        window,
        document,
        dom: appDom,
        state: composerStateController,
        config: { MAX_ATTACHMENTS, MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL },
        formatters: window.BananzaApp?.formatters,
        esc,
        formatSize,
        actions: {
          alert: (message) => alert(message),
          localAttachmentFromFile: (file) => localAttachmentFromFile(file),
          updateComposerAiOverrideState: () => updateComposerAiOverrideState().catch(() => {}),
          refreshPollComposerActionState: () => refreshPollComposerActionState(),
          refreshVoiceComposerState,
          scheduleMobileViewportRecovery: () => scheduleMobileViewportRecovery(),
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          focusComposerKeepKeyboard: (force) => focusComposerKeepKeyboard(force),
          bindTouchSafeButtonActivation: (button, handler) => bindTouchSafeButtonActivation(button, handler),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          isFloatingSurfaceVisible: (el) => isFloatingSurfaceVisible(el),
          openFloatingSurface: (el) => openFloatingSurface(el),
          closeFloatingSurface: (el, options = {}) => closeFloatingSurface(el, options),
        },
      });
    
      composerSendController = composerSendFactory({
        window,
        dom: appDom,
        state: composerStateController,
        text: composerTextController,
        replyEdit: composerReplyEditController,
        files: composerFilesController,
        services: { messages: messageServices },
        api: (url, opts) => api(url, opts),
        config: { MAX_MSG },
        getCurrentChatId: () => currentChatId,
        actions: {
          alert: (message) => alert(message),
          captureScrollAnchor: () => captureScrollAnchor(),
          applyMessageUpdate: (message, options = {}) => applyMessageUpdate(message, options),
          restoreScrollAnchor: (anchor, attempts) => restoreScrollAnchor(anchor, attempts),
          saveCurrentScrollAnchor: (chatId, options = {}) => saveCurrentScrollAnchor(chatId, options),
          loadChats: () => loadChats(),
          clearComposerDraft: (chatId) => clearComposerDraft(chatId),
          syncMentionOpenButton: () => syncMentionOpenButton(),
          refreshVoiceComposerState,
          scheduleMobileViewportRecovery: () => scheduleMobileViewportRecovery(),
          resolveComposerAiOverridePayload: () => getComposerAiOverridePayload(),
          analyzeOutgoingGrokImageRisk: (messageText, replySnapshot, composerAiOverride) =>
            analyzeOutgoingGrokImageRisk(messageText, replySnapshot, composerAiOverride),
          openGrokImageRiskConfirm: (matches) => openGrokImageRiskConfirm(matches),
          playAppSound: (type, options = {}) => playAppSound(type, options),
          scrollToBottom: (...args) => scrollToBottom(...args),
        },
      });
    
      composerEmojiPickerController = composerEmojiPickerFactory({
        window,
        document,
        dom: appDom,
        state: composerStateController,
        text: composerTextController,
        storage: localStorage,
        customEmoji: window.BananzaApp?.customEmoji,
        formatters: window.BananzaApp?.formatters,
        esc,
        t: (key, params) => t(key, params),
        api: (url, opts) => api(url, opts),
        getCurrentUser: () => currentUser,
        actions: {
          isSingleEmojiMessage: (value) => isSingleEmojiMessage(value),
          scheduleScrollableItemCenter: (...args) => scheduleScrollableItemCenter(...args),
          createHorizontalSwipePager: (options) => createHorizontalSwipePager(options),
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          focusComposerKeepKeyboard: (force) => focusComposerKeepKeyboard(force),
          forceMobileViewportLayoutSync: () => forceMobileViewportLayoutSync(),
          syncChatAreaMetrics: () => syncChatAreaMetrics(),
          queueIosViewportLayoutSync: () => queueIosViewportLayoutSync(),
          isFloatingSurfaceVisible: (el) => isFloatingSurfaceVisible(el),
          preventMobileComposerBlur: (event) => preventMobileComposerBlur(event),
          getFloatingViewportRect: () => getFloatingViewportRect(),
          measureFloatingSurface: (el, fallbackWidth, fallbackHeight) => measureFloatingSurface(el, fallbackWidth, fallbackHeight),
          clamp: (value, min, max) => clamp(value, min, max),
          positionFloatingElement: (el, left, top) => positionFloatingElement(el, left, top),
          openFloatingSurface: (el) => openFloatingSurface(el),
          closeFloatingSurface: (el, options = {}) => closeFloatingSurface(el, options),
        },
      });
    
      composerMentionsController = composerMentionsFactory({
        window,
        document,
        dom: appDom,
        state: composerStateController,
        text: composerTextController,
        api: (url, opts) => api(url, opts),
        esc,
        getCurrentChatId: () => currentChatId,
        getCurrentUser: () => currentUser,
        config: { MENTION_PICKER_TAP_DEAD_ZONE },
        actions: {
          updateComposerAiOverrideState: () => updateComposerAiOverrideState().catch(() => {}),
          syncContextConvertComposerButton: () => syncContextConvertComposerButton(),
          closeFloatingSurface: (el, options = {}) => closeFloatingSurface(el, options),
          openFloatingSurface: (el) => openFloatingSurface(el),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          restoreComposerFocusAfterMentionPicker: (keyboardAttached) => restoreComposerFocusAfterMentionPicker(keyboardAttached),
          refreshVoiceComposerState,
          focusComposerKeepKeyboard: (force) => focusComposerKeepKeyboard(force),
          openPrivateChatWithUser: (userId) => openPrivateChatWithUser(userId),
          consumeOutsidePickerDismissGesture: (event, suppressFollowupClick) =>
            consumeOutsidePickerDismissGesture(event, suppressFollowupClick),
          isPickerDismissPassThroughTarget: (target) => isPickerDismissPassThroughTarget(target),
        },
      });
    
      composerTypingDragDropController = composerTypingDragDropFactory({
        dom: appDom,
        state: composerStateController,
        files: composerFilesController,
        getCurrentChatId: () => currentChatId,
        actions: {
          sendWs: (payload) => sendComposerWsPayload(payload),
        },
      });
    
      pollComposerController = pollComposerFactory({
        window,
        document,
        dom: appDom,
        state: composerStateController,
        text: composerTextController,
        replyEdit: composerReplyEditController,
        api: (url, opts) => api(url, opts),
        config: { POLL_MIN_OPTIONS, POLL_MAX_OPTIONS, POLL_CLOSE_PRESET_MS },
        esc,
        getCurrentChatId: () => currentChatId,
        getCurrentUser: () => currentUser,
        actions: {
          alert: (message) => alert(message),
          normalizePollStyle: (style) => normalizePollStyle(style),
          getPollComposerStyle: () => pollComposerStyle,
          setPollComposerStyle: (value) => { pollComposerStyle = value; },
          pollStyleMeta: (style) => pollStyleMeta(style),
          isPulsePoll: (...args) => isPulsePoll(...args),
          renderPollCard: (...args) => renderPollCard(...args),
          syncPollComposerStyleUi: () => syncPollComposerStyleUi(),
          isCurrentNotesChat: () => isCurrentNotesChat(),
          syncChatAreaMetrics: () => syncChatAreaMetrics(),
          openModal: (id, options = {}) => openModal(id, options),
          closeModal: (id, options = {}) => closeModal(id, options),
          clearComposerDraft: (chatId) => clearComposerDraft(chatId),
          syncMentionOpenButton: () => syncMentionOpenButton(),
          refreshVoiceComposerState,
          updateChatListLastMessage: (message) => updateChatListLastMessage(message),
          cacheMessage: (message) => window.messageCache?.upsertMessage?.(message).catch(() => {}),
          isMessageDisplayed: (id) => isMessageDisplayed(id),
          appendMessage: (...args) => appendMessage(...args),
          scrollToBottom: (...args) => scrollToBottom(...args),
          playAppSound: (type, options = {}) => playAppSound(type, options),
          openPollStyleSettingsModal: () => openPollStyleSettingsModal(),
        },
      });
    
      const legacyShellRuntimeApi = window.BananzaApp?.shell?.legacyShellRuntime?.createLegacyShellRuntime?.(createLegacyAiAdminScope()) || {};
      const {
        handleDragEnter, handleDragOver, handleDragLeave, handleDrop, renderTypingBar, showTyping, hideTyping, normalizeRecentEmojiValue,
        isValidRecentEmojiValue, normalizeRecentEmojiList, mergeRecentEmojiLists, getRecentEmojiStorageKey, getRecentEmojiCategory, loadLocalRecentEmojis, persistLocalRecentEmojis, loadRecentEmojis,
        rememberRecentEmoji, syncRecentEmojiToServer, getEmojiPickerCategories, isCustomEmojiCategory, getEmojiCategoryItems, getEmojiCategoryLabel, renderEmojiGridItemHtml, renderEmojiGridItemsHtml,
        renderEmojiPickerGrid, setEmojiPickerCategory, initEmojiPicker, syncEmojiPickerButton, positionEmojiPicker, openEmojiPicker, closeEmojiPicker, dismissEmojiPickerOutsideGesture,
        toggleEmojiPicker, getSelectableFolderChats, getSelectedNewFolderChatIds, renderNewFolderChatList, resetNewFolderForm, normalizeNewChatModalTab, getNewChatModalActiveTab, getNewChatTabPane,
        prepareNewChatTabContent, createNewChatTabPreview, applyNewChatModalTab, setNewChatModalTab, initNewChatTabSwipePager, openNewChatModal, openAdminModal, openAdminBotAuditModal,
        setBackupExportStatus, setBackupRestoreStatus, syncBackupRestoreFileName, resetBackupRestoreState, renderBackupRestorePreview, openBackupExportModal, downloadBackupExport, previewBackupRestore,
        applyBackupRestore, openSettingsModal, openLanguageSettingsModal, openThemeSettingsModal, openVisualModeSettingsModal, openPollStyleSettingsModal, openAnimationSettingsModal, openMobileFontSettingsModal,
        openWeatherSettingsModal, openNotificationSettingsModal, openSoundSettingsModal, openAiBotSettingsModal, openOpenAiTextBotsModal, openOpenAiUniversalBotsModal, openOpenAiImageBotsModal, openYandexAiSettingsModal,
        openDeepseekAiSettingsModal, openDeepseekTextBotsModal, openQwenAiSettingsModal, openQwenTextBotsModal, resetManagedModalScroll, openGrokAiSettingsModal, openGrokTextBotsModal, openGrokImageBotsModal,
        openGrokUniversalBotsModal, resetChangePasswordFields, openChangePasswordModal, openChatInfoModal, setProfileStatus, getProfileSelectedColor, setProfileAvatarUploadPending, renderProfileAvatarPreview,
        syncProfileColorSelection, renderProfileColorPicker, renderProfileEditor, openMenuDrawer, uploadProfileAvatar, removeProfileAvatar, saveProfileChanges, setupProfileEvents,
        getVisibleComposerToolCount, getComposerInputWidthForMode, getNormalComposerInputWidth, measureMsgInputScrollHeight, getComposerInputTextMetrics, renderComposerRichPreviewContent, syncComposerRichPreview, autoResize,
        animateSendButton, animateBackButton, resetBackButtonNavigationState, deferBackButtonNavigationRelease, animateChatHeaderActionButton, prefersReducedMotion, cancelPendingSidebarReveal, isMobileChatHistoryState,
        isResolvedMobileChatScene, normalizeMobileChatListHistoryState, revealSidebarFromChat, navigateBackToChatList, setupPasswordPreviewToggles, createLegacyEventScope, NEW_CHAT_MODAL_TABS, AVATAR_COLORS,
        setupEvents,
      } = legacyShellRuntimeApi;

      const composerServices = {
        state: composerStateController,
        text: composerTextController,
        replyEdit: composerReplyEditController,
        files: composerFilesController,
        send: composerSendController,
        emojiPicker: composerEmojiPickerController,
        mentions: composerMentionsController,
        typingDragDrop: composerTypingDragDropController,
        pollComposer: pollComposerController,
      };
      if (appContext) appContext.services.composer = composerServices;
    
      const interactionState = {
        getCurrentUser: () => currentUser,
        getCurrentChatId: () => currentChatId,
        getCurrentModalAnimation: () => currentModalAnimation,
        getChats: () => chats,
        getOnlineUsers: () => onlineUsers,
        contextConvertPendingMessageIds,
        contextOriginalRestorePendingMessageIds,
      };
      searchController = searchControllerFactory({
        window,
        document,
        dom: appDom,
        state: interactionState,
        config: appConfig,
        api: (url, opts) => api(url, opts),
        esc,
        t,
        tx,
        $,
        services: {
          openChat: { openChat, scroll: scrollController },
          messages: messageServices,
        },
        actions: {
          clamp: (value, min, max) => clamp(value, min, max),
          showCenterToast: (message) => showCenterToast(message),
          openChat: (chatId, options = {}) => openChat(chatId, options),
          closeMobileComposerTransientUi: (options = {}) => closeMobileComposerTransientUi(options),
          dismissMobileComposer: (options = {}) => dismissMobileComposer(options),
          getMobileComposerSafeReturnFocusEl: (fallback) => getMobileComposerSafeReturnFocusEl(fallback),
          forceIosAnimationMount: (el) => forceIosAnimationMount(el),
          getElementTransitionTotalMs: (el) => getElementTransitionTotalMs(el),
          focusElementIfPossible: (el) => focusElementIfPossible(el),
          blurFocusedElementWithin: (root) => blurFocusedElementWithin(root),
          prefersReducedMotion: () => prefersReducedMotion(),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          revealSidebarFromChat: (options = {}) => revealSidebarFromChat(options),
          normalizeMobileChatListHistoryState: (...args) => normalizeMobileChatListHistoryState(...args),
          isResolvedMobileChatScene: (scene) => isResolvedMobileChatScene(scene),
          waitForAnimationFrames: (count) => waitForAnimationFrames(count),
        },
      });
      floatingMessageActionsController = floatingMessageActionsFactory({
        window,
        document,
        dom: appDom,
        state: interactionState,
        config: appConfig,
        getReactions: () => reactionController,
        actions: {
          forceIosAnimationMount: (el) => forceIosAnimationMount(el),
          getElementTransitionTotalMs: (el) => getElementTransitionTotalMs(el),
          prefersReducedMotion: () => prefersReducedMotion(),
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          focusComposerKeepKeyboard: (force) => focusComposerKeepKeyboard(force),
        },
      });
      forwardingController = forwardingControllerFactory({
        window,
        document,
        dom: appDom,
        state: interactionState,
        config: appConfig,
        api: (url, opts) => api(url, opts),
        esc,
        actions: {
          isNotesChat: (chat) => isNotesChat(chat),
          getChatSearchHaystack: (chat) => getChatSearchHaystack(chat),
          formatChatListTimestamp: (value) => formatChatListTimestamp(value),
          chatItemAvatarHtml: (chat) => chatItemAvatarHtml(chat),
          renderChatLastPreviewHtml: (chat, options = {}) => renderChatLastPreviewHtml(chat, options),
          closeModal: (modalOrId, options = {}) => closeModal(modalOrId, options),
          openModal: (modalOrId, options = {}) => openModal(modalOrId, options),
          closeAllModals: (options = {}) => closeAllModals(options),
          showCenterToast: (message) => showCenterToast(message),
          playAppSound: (type, options = {}) => playAppSound(type, options),
          scrollToBottom: (instant, markRead, options = {}) => scrollToBottom(instant, markRead, options),
          updateChatListLastMessage: (message) => updateChatListLastMessage(message),
          hideFloatingMessageActions: (options = {}) => hideFloatingMessageActions(options),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          prefersReducedMotion: () => prefersReducedMotion(),
          getElementTransitionTotalMs: (el) => getElementTransitionTotalMs(el),
        },
      });
      reactionController = reactionControllerFactory({
        window,
        document,
        dom: appDom,
        state: interactionState,
        api: (url, opts) => api(url, opts),
        esc,
        t,
        getFloatingActions: () => floatingMessageActionsController,
        actions: {
          getEmojiPickerCategories: () => getEmojiPickerCategories(),
          isCustomEmojiCategory: (category) => isCustomEmojiCategory(category),
          getEmojiCategoryItems: (category) => getEmojiCategoryItems(category),
          getRecentEmojiCategory: () => getRecentEmojiCategory(),
          isCustomEmojiToken: (value) => isCustomEmojiToken(value),
          createHorizontalSwipePager: (options = {}) => createHorizontalSwipePager(options),
          scheduleScrollableItemCenter: (...args) => scheduleScrollableItemCenter(...args),
          rememberRecentEmoji: (emoji) => rememberRecentEmoji(emoji),
          canContextConvertMessage: (msg, row, options = {}) => canContextConvertMessage(msg, row, options),
          canRestoreContextOriginalMessage: (msg) => canRestoreContextOriginalMessage(msg),
          openMessageContextConvertPicker: (row, anchor, options = {}) => openMessageContextConvertPicker(row, anchor, options),
          restoreContextOriginalMessage: (messageId, options = {}) => restoreContextOriginalMessage(messageId, options),
          bindTouchSafeButtonActivation: (button, handler, options = {}) => bindTouchSafeButtonActivation(button, handler, options),
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          preventMobileComposerBlur: (event) => preventMobileComposerBlur(event),
          focusComposerKeepKeyboard: (force) => focusComposerKeepKeyboard(force),
          safeVibrate: (pattern) => safeVibrate(pattern),
          getSelectedMessageFragment: (row) => getSelectedMessageFragment(row),
          isSelectableMessageTextTarget: (target) => isSelectableMessageTextTarget(target),
          getMessageMediaContextTarget: (target) => getMessageMediaContextTarget(target),
        },
      });
      mediaViewerController = mediaViewerFactory({
        window,
        document,
        dom: appDom,
        state: interactionState,
        config: appConfig,
        api: (url, opts) => api(url, opts),
        esc,
        services: {
          openChat: { mediaPlayback: mediaPlaybackController },
        },
        actions: {
          getAttachmentPreviewUrl: (source) => getAttachmentPreviewUrl(source),
          getAttachmentPosterUrl: (source) => getAttachmentPosterUrl(source),
          ensureAttachmentPoster: (source, options = {}) => ensureAttachmentPoster(source, options),
          markAttachmentPosterAvailable: (message) => markAttachmentPosterAvailable(message),
          applyPosterToVideoElement: (videoEl, posterUrl) => applyPosterToVideoElement(videoEl, posterUrl),
          closeMobileComposerTransientUi: (options = {}) => closeMobileComposerTransientUi(options),
          dismissMobileComposer: (options = {}) => dismissMobileComposer(options),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          scheduleMobileViewportRecovery: (delay) => scheduleMobileViewportRecovery(delay),
          isGroupLikeCurrentChat: () => isGroupLikeCurrentChat(),
          openAvatarUserMenu: (avatarEl) => openAvatarUserMenu(avatarEl),
        },
      });
      contextMenusController = contextMenusFactory({
        window,
        document,
        dom: appDom,
        state: interactionState,
        config: appConfig,
        api: (url, opts) => api(url, opts),
        esc,
        t,
        tx,
        confirm: (message) => confirm(message),
        getFloatingActions: () => floatingMessageActionsController,
        getReactions: () => reactionController,
        getForwarding: () => forwardingController,
        services: {
          chatList: chatListControllers,
          folders: folderControllers,
          openChat: openChatControllers,
          messages: messageServices,
          composer: composerServices,
        },
        actions: {
          getChatById: (chatId) => getChatById(chatId),
          getActiveChatFolder: () => getActiveChatFolder(),
          getPinnedChatMoveState: (chatId, list = chats) => getPinnedChatMoveState(chatId, list),
          getFolderPinnedChatMoveState: (folderId, chatId) => getFolderPinnedChatMoveState(folderId, chatId),
          isChatPinned: (chat) => isChatPinned(chat),
          isChatPinnedInFolder: (folderId, chat) => isChatPinnedInFolder(folderId, chat),
          localChatPreferenceEnabled: (value) => localChatPreferenceEnabled(value),
          canHideChat: (chat) => canHideChat(chat),
          canLeaveChat: (chat) => canLeaveChat(chat),
          canManageDestructiveChat: (chat) => canManageDestructiveChat(chat),
          setChatSidebarPin: (chatId, pinned) => setChatSidebarPin(chatId, pinned),
          moveChatSidebarPin: (chatId, direction) => moveChatSidebarPin(chatId, direction),
          setFolderChatPin: (folderId, chatId, pinned) => setFolderChatPin(folderId, chatId, pinned),
          moveFolderChatPin: (folderId, chatId, direction) => moveFolderChatPin(folderId, chatId, direction),
          removeChatFromFolder: (folderId, chatId) => removeChatFromFolder(folderId, chatId),
          openChatFolderManageModal: (chatId, opener) => openChatFolderManageModal(chatId, opener),
          hideChatFromList: (chatId) => hideChatFromList(chatId),
          leaveChat: (chatId) => leaveChat(chatId),
          deleteChatCompletely: (chatId) => deleteChatCompletely(chatId),
          loadChats: () => loadChats(),
          renderChatList: (filter) => renderChatList(filter),
          renderChatPreferencesForm: (chat) => renderChatPreferencesForm(chat),
          getAttachmentPreviewUrl: (source) => getAttachmentPreviewUrl(source),
          getAttachmentDownloadUrl: (source) => getAttachmentDownloadUrl(source),
          getMediaNoteFallbackLabel: (msg) => getMediaNoteFallbackLabel(msg),
          normalizeMimeType: (value) => normalizeMimeType(value),
          filenameFromContentDisposition: (header, fallback) => filenameFromContentDisposition(header, fallback),
          getMessageCopyTextData: (row) => getMessageCopyTextData(row),
          canForwardMessage: (msg) => canForwardMessage(msg),
          canSaveMessageToNotes: (msg) => canSaveMessageToNotes(msg),
          canEditMessage: (msg) => canEditMessage(msg),
          getPinActionState: (msg) => getPinActionState(msg),
          copyTextToClipboard: (text) => copyTextToClipboard(text),
          showCenterToast: (message) => showCenterToast(message),
          setReplyFromRow: (row) => setReplyFromRow(row),
          setEditFromRow: (row) => setEditFromRow(row),
          togglePinFromRow: (row) => togglePinFromRow(row),
          hasAndroidNativeBridge: () => hasAndroidNativeBridge(),
          safeVibrate: (pattern) => safeVibrate(pattern),
          isMobileLayoutViewport: () => isMobileLayoutViewport(),
          isMobileComposerKeyboardOpen: () => isMobileComposerKeyboardOpen(),
          focusComposerKeepKeyboard: (force) => focusComposerKeepKeyboard(force),
        },
      });
      const interactionServices = {
        search: searchController,
        reactions: reactionController,
        floatingActions: floatingMessageActionsController,
        mediaViewer: mediaViewerController,
        contextMenus: contextMenusController,
        forwarding: forwardingController,
      };
      if (appContext) appContext.services.interactions = interactionServices;
      const isIosViewportFixTarget = Boolean(mobileViewportShell.isIosViewportFixTarget?.());
      if (isIosViewportFixTarget) {
        document.documentElement.classList.add('is-ios-webkit');
      }
    
      function getMobileAppViewportHeight(...args) { return mobileComposerGuard?.getMobileAppViewportHeight?.(...args) || 0; }
      function getMobileAppViewportTopInset(...args) { return mobileComposerGuard?.getMobileAppViewportTopInset?.(...args) || 0; }
      function isIosMobileViewportTarget(...args) { return Boolean(mobileComposerGuard?.isIosMobileViewportTarget?.(...args)); }
      function isMobileViewportTarget(...args) { return Boolean(mobileComposerGuard?.isMobileViewportTarget?.(...args)); }
      function isIosWebkitMotionAllowed(...args) { return Boolean(mobileComposerGuard?.isIosWebkitMotionAllowed?.(...args)); }
      function forceIosAnimationMount(...args) { return mobileComposerGuard?.forceIosAnimationMount?.(...args); }
      function getMobileVisualViewportMetrics(...args) { return mobileComposerGuard?.getMobileVisualViewportMetrics?.(...args) || { top: 0, height: window.innerHeight || 0, width: window.innerWidth || 0, bottom: window.innerHeight || 0 }; }
      function getIosVisualViewportMetrics(...args) { return mobileComposerGuard?.getIosVisualViewportMetrics?.(...args) || getMobileVisualViewportMetrics(); }
      function getMobileViewportBaselineHeight(...args) { return mobileComposerGuard?.getMobileViewportBaselineHeight?.(...args) || 0; }
      function getIosViewportBaselineHeight(...args) { return mobileComposerGuard?.getIosViewportBaselineHeight?.(...args) || getMobileViewportBaselineHeight(); }
      function isMobileKeyboardOpen(...args) { return Boolean(mobileComposerGuard?.isMobileKeyboardOpen?.(...args)); }
      function isIosKeyboardOpen(...args) { return Boolean(mobileComposerGuard?.isIosKeyboardOpen?.(...args)); }
      function isMobileChatKeyboardLayoutActive(...args) { return Boolean(mobileComposerGuard?.isMobileChatKeyboardLayoutActive?.(...args)); }
      function isIosChatKeyboardLayoutActive(...args) { return Boolean(mobileComposerGuard?.isIosChatKeyboardLayoutActive?.(...args)); }
      function resetMobileKeyboardDock(...args) { return mobileComposerGuard?.resetMobileKeyboardDock?.(...args); }
      function getLockedMobileKeyboardViewportMetrics(...args) { return mobileComposerGuard?.getLockedMobileKeyboardViewportMetrics?.(...args); }
      function restoreMobileKeyboardDocumentScroll(...args) { return Boolean(mobileComposerGuard?.restoreMobileKeyboardDocumentScroll?.(...args)); }
      function syncMobileViewportLayoutState(...args) { return mobileComposerGuard?.syncMobileViewportLayoutState?.(...args); }
      function syncIosViewportLayoutState(...args) { return mobileComposerGuard?.syncIosViewportLayoutState?.(...args); }
      function queueMobileViewportLayoutSync(...args) { return mobileComposerGuard?.queueMobileViewportLayoutSync?.(...args); }
      function queueIosViewportLayoutSync(...args) { return mobileComposerGuard?.queueIosViewportLayoutSync?.(...args); }
      function isMobileComposerKeyboardOpen(...args) { return Boolean(mobileComposerGuard?.isMobileComposerKeyboardOpen?.(...args)); }
      function focusComposerKeepKeyboard(...args) { return mobileComposerGuard?.focusComposerKeepKeyboard?.(...args); }
      function restoreComposerFocusAfterMentionPicker(...args) { return Boolean(mobileComposerGuard?.restoreComposerFocusAfterMentionPicker?.(...args)); }
      function dismissMentionPickerAfterKeyboardClose(...args) { return Boolean(mobileComposerGuard?.dismissMentionPickerAfterKeyboardClose?.(...args)); }
      function preventMobileComposerBlur(...args) { return Boolean(mobileComposerGuard?.preventMobileComposerBlur?.(...args)); }
      function isMobileComposerSessionActive(...args) { return Boolean(mobileComposerGuard?.isMobileComposerSessionActive?.(...args)); }
      function setupMobileComposerGestureGuard(...args) { return mobileComposerGuard?.setupMobileComposerGestureGuard?.(...args); }
      function preserveMobileComposerOnPointerDown(...args) { return Boolean(mobileComposerGuard?.preserveMobileComposerOnPointerDown?.(...args)); }
      function dismissMobileComposer(...args) { return Boolean(mobileComposerGuard?.dismissMobileComposer?.(...args)); }
      function closeMobileComposerTransientUi(...args) { return mobileComposerGuard?.closeMobileComposerTransientUi?.(...args); }
      function hideAttachMenu(...args) { return mobileComposerGuard?.hideAttachMenu?.(...args); }
      function getMobileComposerSafeReturnFocusEl(...args) { return mobileComposerGuard?.getMobileComposerSafeReturnFocusEl?.(...args) || null; }
      function isTouchLikePointerEvent(...args) { return Boolean(mobileComposerGuard?.isTouchLikePointerEvent?.(...args)); }
      function isPickerDismissPassThroughTarget(...args) { return Boolean(mobileComposerGuard?.isPickerDismissPassThroughTarget?.(...args)); }
      function isFollowupClickSuppressPassThroughTarget(...args) { return Boolean(mobileComposerGuard?.isFollowupClickSuppressPassThroughTarget?.(...args)); }
      function consumeOutsidePickerDismissGesture(...args) { return mobileComposerGuard?.consumeOutsidePickerDismissGesture?.(...args); }
      function suppressSearchPanelFollowupClick(...args) { return mobileComposerGuard?.suppressSearchPanelFollowupClick?.(...args); }
      function suppressAvatarUserMenuFollowupClick(...args) { return mobileComposerGuard?.suppressAvatarUserMenuFollowupClick?.(...args); }
      function bindTouchSafeButtonActivation(...args) { return mobileComposerGuard?.bindTouchSafeButtonActivation?.(...args); }
      function shouldKeepComposerForMobileMessageInteraction(...args) { return Boolean(mobileComposerGuard?.shouldKeepComposerForMobileMessageInteraction?.(...args)); }
      function setupMobileMessageInteractionGuard(...args) { return mobileComposerGuard?.setupMobileMessageInteractionGuard?.(...args); }
      function shouldBypassLockedMobileViewportSync(...args) { return mobileComposerGuard?.shouldBypassLockedMobileViewportSync?.(...args) ?? true; }

      function getChatSettingsActionOpener() {
        return chatHeaderActionsShell?.getChatSettingsActionOpener?.()
          || chatSettingsActionBtn
          || chatInfoBtn
          || $('#chatSettingsActionBtn')
          || $('#chatInfoBtn');
      }
    
      function moveFocusOutOfChatHeaderActions() {
        return chatHeaderActionsShell?.moveFocusOutOfChatHeaderActions?.();
      }
    
      function syncChatHeaderActionsAccessibility() {
        return chatHeaderActionsShell?.syncChatHeaderActionsAccessibility?.();
      }
    
      function setChatHeaderActionsOpen(open) {
        if (chatHeaderActionsShell?.setChatHeaderActionsOpen) {
          return chatHeaderActionsShell.setChatHeaderActionsOpen(open);
        }
        chatHeaderActionsOpen = Boolean(open);
        return chatHeaderActionsOpen;
      }
    
      function toggleChatHeaderActions() {
        return chatHeaderActionsShell?.toggleChatHeaderActions?.() ?? setChatHeaderActionsOpen(!chatHeaderActionsOpen);
      }
    
      function closeChatHeaderActions() {
        return chatHeaderActionsShell?.closeChatHeaderActions?.() ?? setChatHeaderActionsOpen(false);
      }

      function shouldKeepEmojiPickerKeyboard(...args) { return composerEmojiPickerController?.shouldKeepEmojiPickerKeyboard?.(...args) || false; }
    
      function clearEmojiPickerKeyboardOpenStabilizer(...args) { return composerEmojiPickerController?.clearEmojiPickerKeyboardOpenStabilizer?.(...args); }
    
      function stabilizeEmojiPickerKeyboardOnOpen(...args) { return composerEmojiPickerController?.stabilizeEmojiPickerKeyboardOnOpen?.(...args) || false; }
    
      const appBridge = appRuntime?.createBridge
        ? appRuntime.createBridge(appContext)
        : (window.BananzaAppBridge = window.BananzaAppBridge || {});
      if (appContext) appContext.bridge = appBridge;
      Object.assign(appBridge, {
        api: (url, opts) => api(url, opts),
        animateSendButton: () => animateSendButton(),
        autoResize: () => autoResize(),
        clearReply: () => clearReply(),
        closeAllModals: (options) => closeAllModals(options),
        registerManagedModal: (id, options) => registerModal(id, options),
        openManagedModal: (id, options) => openModal(id, options),
        openModal: (id, options) => openModal(id, options),
        closeManagedModal: (id, options) => closeModal(id, options),
        closeTopManagedModal: (options) => closeTopModal(options),
        showToast: (message) => showCenterToast(message),
        closeChatHeaderActions: () => closeChatHeaderActions(),
        syncChatHeaderActions: () => syncChatHeaderActionsAccessibility(),
        getToken: () => token || localStorage.getItem('token'),
        getCurrentUser: () => currentUser,
        getCurrentChatId: () => currentChatId,
        getCurrentChat: () => getChatById(currentChatId) ? { ...getChatById(currentChatId) } : null,
        isIosWebkit: () => isIosViewportFixTarget,
        getCurrentModalAnimation: () => currentModalAnimation,
        getCurrentModalAnimationSpeed: () => currentModalAnimationSpeed,
        getCurrentLanguage: () => currentUiLanguage,
        t: (key, params) => t(key, params),
        tx: (text, params) => tx(text, params),
        onLanguageChange: (listener) => i18n?.onChange?.(listener) || (() => {}),
        applyLocalizedDom: (root) => i18n?.applyStaticDom?.(root || document),
        refreshCallIndicators: () => {
          if (chatList) renderChatList(chatSearch?.value || '');
        },
        getPendingFiles: () => composerStateController.getPendingFiles(),
        getReplyTo: () => composerStateController.getReplyTo(),
        getEditTo: () => composerStateController.getEditTo(),
        getMicrophoneMode: () => getMicrophoneMode(),
        getScreenRotationAllowed: () => getScreenRotationAllowed(),
        openSettingsModal: (opener = $('#settingsBtn')) => openSettingsModal(opener),
        openLanguageSettingsModal: () => openLanguageSettingsModal(),
        openThemeSettingsModal: () => openThemeSettingsModal(),
        openVisualModeSettingsModal: () => openVisualModeSettingsModal(),
        openPollStyleSettingsModal: () => openPollStyleSettingsModal(),
        openAnimationSettingsModal: () => openAnimationSettingsModal(),
        openMobileFontSettingsModal: () => openMobileFontSettingsModal(),
        openWeatherSettingsModal: () => openWeatherSettingsModal(),
        openNotificationSettingsModal: () => openNotificationSettingsModal(),
        openSoundSettingsModal: () => openSoundSettingsModal(),
        openAiBotSettingsModal: () => openAiBotSettingsModal(),
        openOpenAiTextBotsModal: () => openOpenAiTextBotsModal(),
        openOpenAiUniversalBotsModal: () => openOpenAiUniversalBotsModal(),
        openOpenAiImageBotsModal: () => openOpenAiImageBotsModal(),
        openYandexAiSettingsModal: () => openYandexAiSettingsModal(),
        openDeepseekAiSettingsModal: () => openDeepseekAiSettingsModal(),
        openDeepseekTextBotsModal: () => openDeepseekTextBotsModal(),
        openQwenAiSettingsModal: () => openQwenAiSettingsModal(),
        openQwenTextBotsModal: () => openQwenTextBotsModal(),
        openGrokAiSettingsModal: () => openGrokAiSettingsModal(),
        openGrokTextBotsModal: () => openGrokTextBotsModal(),
        openGrokImageBotsModal: () => openGrokImageBotsModal(),
        openGrokUniversalBotsModal: () => openGrokUniversalBotsModal(),
        openContextConvertBotsModal: (provider) => openContextConvertBotsModal(provider),
        openChatShotBotsModal: (provider) => openChatShotBotsModal(provider),
        insertDictatedText: (text) => insertDictatedText(text),
        queueVoiceMessage: (payload) => queueVoiceOutbox(payload),
        queueVideoNote: (payload) => queueVideoNoteOutbox(payload),
        updateReplyPreview: (messageId, text) => composerReplyEditController?.updateReplyPreview?.(messageId, text),
        scrollToBottom: (instant = false) => scrollToBottom(instant),
        playSound: (type, options) => playAppSound(type, options),
        bindMediaPlayback: (mediaEl, message, role) => bindMediaPlaybackState(mediaEl, message, role),
        isMediaPlaybackCompleted: (message, role) => isMediaPlaybackCompleted(message, role),
        setMediaPlaybackCompleted: (message, role, completed) => setMediaPlaybackCompleted(message, role, completed),
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
        isMobileLayout: () => isMobileLayoutViewport(),
      });
      Object.assign(appBridge.__testing = appBridge.__testing || {}, {
        getChats: () => chatListService.getChats().map((chat) => normalizeChatListEntry(chat)),
        getOnlineUsers: () => Array.from(chatListService.getOnlineUsers()),
        getChatFolders: () => chatFolderStore.getFolders(),
        setChats: (nextChats = [], options = {}) => {
          chatListService.setChats(nextChats);
          refreshChatListReferences();
          if (Object.prototype.hasOwnProperty.call(options, 'currentChatId')) {
            const nextCurrentChatId = Number(options.currentChatId || 0);
            currentChatId = nextCurrentChatId > 0 ? nextCurrentChatId : null;
            syncCoreStateToRuntime();
          }
          renderChatList(chatSearch.value);
          renderCurrentChatHeader(getChatById(currentChatId));
          refreshChatInfoPresentation(getChatById(currentChatId));
          return chatListService.getChats().map((chat) => normalizeChatListEntry(chat));
        },
        setOnlineUsers: (userIds = []) => Array.from(chatListService.setOnlineUsers(userIds)),
        setCurrentChatId: (chatId) => {
          const nextCurrentChatId = Number(chatId || 0);
          currentChatId = nextCurrentChatId > 0 ? nextCurrentChatId : null;
          syncCoreStateToRuntime();
          const currentChat = getChatById(currentChatId);
          renderCurrentChatHeader(currentChat);
          refreshChatInfoPresentation(currentChat);
          return currentChat ? normalizeChatListEntry(currentChat) : null;
        },
        setChatFolders: (nextFolders = [], options = {}) => {
          chatFolderStore.setFolders(nextFolders, { persist: false });
          if (Object.prototype.hasOwnProperty.call(options, 'activeFolderId')) {
            chatFolderStore.setActiveFolderId(options.activeFolderId, { persist: false });
          }
          renderActiveChatFolderBar();
          renderChatList(chatSearch?.value || '');
          return chatFolderStore.getFolders();
        },
        getCurrentUser: () => (currentUser ? { ...currentUser } : null),
        setCurrentUser: (nextUser = {}) => {
          const nextId = Number(nextUser.id || currentUser?.id || 0);
          if (!nextId) return null;
          applyUserUpdate({
            ...(currentUser || {}),
            ...nextUser,
            id: nextId,
          });
          return currentUser ? { ...currentUser } : null;
        },
        normalizeContextConvertAvailability: (data = {}) => normalizeContextConvertAvailability(data),
        loadContextConvertAvailability: (chatId, options = {}) => loadContextConvertAvailability(chatId, options),
        invalidateContextConvertAvailability: (chatId) => invalidateContextConvertAvailability(chatId),
        isContextTransformAvailableForChat: (chatId) => isContextTransformAvailableForChat(chatId),
        normalizeChatShotState: (data = {}) => normalizeChatShotState(data),
        loadChatShotState: (chatId, options = {}) => loadChatShotState(chatId, options),
        invalidateChatShotState: (chatId) => invalidateChatShotState(chatId),
        syncChatShotButton: () => syncChatShotButton(),
        runChatShotGeneration: () => runChatShotGeneration(),
        analyzeOutgoingGrokImageRisk: (text, replySnapshot = null, composerAiOverride = {}) => analyzeOutgoingGrokImageRisk(text, replySnapshot, composerAiOverride),
        openGrokImageRiskConfirm: (matches = []) => openGrokImageRiskConfirm(matches),
        retryGrokImageRiskPrompt: (row, button = null) => retryGrokImageRiskPrompt(row, button),
        setContextConvertAdminState: (provider = 'openai', state = {}, selectedBotId = null) => {
          const nextProvider = contextConvertAdminStates[provider] ? provider : 'openai';
          activeContextConvertProvider = nextProvider;
          mergeContextConvertAdminState(nextProvider, state);
          if (selectedBotId != null) {
            selectedContextConvertBotIds[nextProvider] = Number(selectedBotId || 0) || null;
          }
          renderContextConvertAdminSettings();
          return currentContextConvertAdminState();
        },
        setActiveChatFolder: (folderId, options = {}) => {
          setActiveChatFolder(folderId, {
            persist: Boolean(options.persist),
            render: !Object.prototype.hasOwnProperty.call(options, 'render') || Boolean(options.render),
            closePicker: Boolean(options.closePicker),
          });
          return getActiveChatFolder();
        },
        transitionToChatFolder: (folderId, options = {}) => transitionToChatFolder(folderId, options),
        centerActiveChatFolderChip: (options = {}) => centerActiveChatFolderChip(options),
        getActiveChatFolder: () => getActiveChatFolder(),
        applyChatUpdate: (nextChat = {}) => applyChatUpdate(nextChat),
        dismissMobileComposer: (options = {}) => dismissMobileComposer(options),
        openMediaViewer: (src, type = 'image') => openMediaViewer(src, type),
        closeMediaViewer: () => closeMediaViewer(),
        getMediaViewerState: () => mediaViewerController?.getMediaViewerState?.() || {
          scale: 1,
          panX: 0,
          panY: 0,
          transform: '',
        },
        openSettingsModal: (opener = $('#settingsBtn')) => openSettingsModal(opener),
        openChatInfoModal: (opener = getChatSettingsActionOpener()) => openChatInfoModal(opener),
        closeChatHeaderActions: () => closeChatHeaderActions(),
        getChatHeaderActionsOpen: () => chatHeaderActionsOpen,
        openChat: (chatId, options = {}) => openChat(chatId, options),
        openChatControllers: () => openChatControllers,
        openChatState: () => openChatController.getState(),
        scrollToBottom: (instant = false, markRead = false, options = {}) => scrollToBottom(instant, markRead, options),
        bindMediaPlayback: (mediaEl, message, role) => bindMediaPlaybackState(mediaEl, message, role),
        isMediaPlaybackCompleted: (message, role) => isMediaPlaybackCompleted(message, role),
        setMediaPlaybackCompleted: (message, role, completed) => setMediaPlaybackCompleted(message, role, completed),
        renderOutboxItem: (item) => renderOutboxItem(item),
        completeOutboxSend: (item, serverMsg) => completeOutboxSend(item, serverMsg),
        appendMessage: (msg, options = {}) => appendMessage(msg, options),
        applyMessageUpdate: (msg, options = {}) => applyMessageUpdate(msg, options),
        handleWSMessage: (msg) => handleWSMessage(msg),
        revealSidebarFromChat: (options = {}) => revealSidebarFromChat(options),
        flushCurrentChatScrollAnchor: (chatId, options = {}) => flushCurrentChatScrollAnchor(chatId, options),
        readScrollAnchors: () => scrollController.readScrollAnchors(),
        setScrollRestoreMode: (mode = 'bottom') => {
          return uiSettings.setScrollRestoreMode(mode);
        },
        setMicrophoneMode: (mode = 'voice_message') => setMicrophoneMode(mode),
        getScreenRotationAllowed: () => getScreenRotationAllowed(),
        setScreenRotationAllowed: (allowed, options = {}) => setScreenRotationAllowed(allowed, options),
        applyScreenRotationPreference: (options = {}) => applyScreenRotationPreference(options),
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
        getMobileKeyboardDockSnapshot: () => mobileComposerGuard?.getMobileKeyboardDockSnapshot?.() || {},
      });
    
      weatherSettingsController.bindWidget();
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      const legacyWsDispatchApi = window.BananzaApp?.boot?.wsDispatch?.createLegacyWsDispatch?.(createLegacyAiAdminScope()) || {};
      const {
        handleWSMessage, sendTyping, scheduleMessageBackgroundSync, shouldBackgroundSyncMessages, syncChatMessagesInBackground, runMessageBackgroundSync, updateScrollBottomButton, normalizeMemberLastReads,
        getChatMemberLastReads, storeChatMemberLastReads, getChatReadReceiptThreshold, applyOwnReadStateToMessage, applyOwnReadStateToMessages, updateLocalChatReadProgress, reconcileChatReadState, normalizePinEvent,
        normalizePinEvents, rememberDisplayedMessage, forgetDisplayedMessage, isMessageDisplayed, revealActiveMobileChatRoute, isDeletedMessageRow, isCurrentChatActivelyVisible, renderAdminUserRow,
        refreshAdminUserStatuses, refreshChatMemberStatuses, refreshChatInfoStatus, normalizeComposerDraftChatId, getComposerDraftStorageKey, persistComposerDrafts, hydrateComposerDraftsForCurrentUser, saveComposerDraft,
        clearComposerDraft, restoreComposerDraft, updateChatStatus, applyBackgroundStyleToElement, applyChatBackground, resolveMediaPlaybackChatId, resolveMediaPlaybackKey, normalizeMediaPlaybackCompletedEntries,
        getMediaPlaybackCompletedBucket, applyMediaPlaybackCompletedMeta, exportMediaPlaybackCompletedMeta, primeMediaPlaybackCompletedCache, isMediaPlaybackCompleted, setMediaPlaybackCompleted, isMediaPlaybackNearEnd, getMediaPlaybackBucket,
        readMediaPlaybackState, writeMediaPlaybackState, clearMediaPlaybackState, captureBoundMediaPlaybackState, bindMediaPlaybackState, pauseCurrentChatMediaPlayback, getMediaNoteFallbackLabel, suppressScrollBottomFollowupClick,
        activateScrollBottomButton, shouldPreserveKeyboardForScrollBottomGesture, getReplySnapshot, saveEditedMessage, sendMessage, uploadFiles, renderPendingFiles, clearPendingFile,
        getReplyPreviewText, getReplyQuoteText, canEditMessage, canForwardMessage, canSaveMessageToNotes, getEditableText, getSelectedMessageFragment, isSelectableMessageTextTarget,
        getMessageCopyTextData, getMessageCopyText, copyMessageFromRow, setReplyFromRow, setReply, clearReply, setEditFromRow, clearEdit,
        setupMessageSwipeGestures, getReactionPickerMsgId, getReactionPickerKeepKeyboard, getActiveMessageActionsRow, getActiveMessageActionsEl, getFloatingMessageActionsState, isSearchPanelOpen, clearSearchResults,
        updateSearchTriggerState, renderSearchResultsEmpty, renderSearchScopeToggle, clearSearchPanelTransitionState, ensureSearchPanelReady, getSearchPanelTransitionFallbackMs, focusSearchInput, flushSearchPanelPendingAction,
        queueSearchPanelPendingAction, shouldAutoFocusSearchInput, horizontalPagerCommitDistance, canAnimateHorizontalPager, stripCloneIds, syncClonedFormControls, createHorizontalSwipePager, cancelScheduledScrollableItemCenter,
        centerScrollableItem, scheduleScrollableItemCenter, openSearchPanel, closeSearchPanel, performSearch, scrollToMessage, jumpToSearchResult, animateSearchResultChatSwitch,
        formatSearchResultTimestamp, isFloatingSurfaceVisible, getFloatingViewportRect, findMessageRowById, getFloatingMessageActionRow, updateFloatingMessageActionsState, clearFloatingMessageActionsStateIfClosed,
        suppressNextMessageActionTap, measureFloatingSurface, openFloatingSurface, closeFloatingSurface, getVisibleMessageAreaRect, measureMessageActions, getMessageActionsElement, portalMessageActions,
        restoreMessageActions, clearMessageActionsPlacement, resolveMessageActionLayout, positionFloatingElement, applyMessageActionsLayout, positionReactionEmojiPopover, positionMessageActionSurfaces, hideActiveMessageActions,
        hideFloatingMessageActions, showMessageActions, renderReactions, updateReactionBar, renderQuickReactionButtonsHtml, renderReactionPickerContent, showReactionPicker, hideReactionPicker,
        hideReactionUi, toggleReaction, openMediaViewer, openImageViewer, closeMediaViewer, handleMediaViewerControlActivation, updateGalleryArrows, galleryNav,
        suppressMediaViewerFollowupClick, clearChatContextLongPress, clearMediaContextLongPress, getMessageMediaContextTarget, getMessageMediaKindLabel, getDefaultMessageMediaMime, getAbsoluteMessageMediaUrl, getMessageMediaContext,
        canShareMediaFileContext, fetchMessageMediaBlob, copyImageFromMediaContext, shareMediaFromContext, renderMediaContextMenu, positionMediaContextMenu, hideMediaContextMenu, showMediaContextMenuForRow,
        showMediaContextMenuForContext, handleMediaContextMenuAction, renderChatContextMenu, positionChatContextMenu, hideChatContextMenu, showChatContextMenuForRow, updateChatContextPreference, handleChatContextMenuAction,
        setForwardMessageStatus, resetForwardMessageModal, closeForwardMessageModal, renderForwardChatList, openForwardMessageModal, forwardMessageToChat, saveMessageToNotes,
      } = legacyWsDispatchApi;

      // INIT
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      async function init() {
        if (!checkAuth()) return;
        chatFolderStore.hydrateActiveFolderId();
        setChatSearchOpen(false, { clear: true, focus: false, render: false });
        syncChatHeaderActionsAccessibility();
        hydrateChatListCache();
    
        setupMobileViewportHeightSync();
        applyScreenRotationPreference({ showStatus: false, reason: 'init' }).catch(() => {});
        window.addEventListener('resize', syncMobileFontSizeViewportState, { passive: true });
        window.addEventListener('resize', () => {
          applyScreenRotationPreference({ showStatus: false, reason: 'resize' }).catch(() => {});
        }, { passive: true });
        window.addEventListener('orientationchange', syncMobileFontSizeViewportState);
        window.addEventListener('orientationchange', () => {
          applyScreenRotationPreference({ showStatus: false, reason: 'orientationchange' }).catch(() => {});
        });
        window.visualViewport?.addEventListener('resize', syncMobileFontSizeViewportState);
    
        // Mobile navigation: set initial history state for chat list
        if (isMobileLayoutViewport()) {
          history.replaceState({ view: 'chatlist' }, '');
        }
    
        // Verify token
        try {
          const data = await api('/api/auth/me');
          currentUser = {
            ...data.user,
            ui_show_chat_folder_strip_in_all_chats: Boolean(data.user?.ui_show_chat_folder_strip_in_all_chats),
          };
          syncCoreStateToRuntime();
          chatFolderStore.hydrateActiveFolderId();
          applyUiTheme(currentUser.ui_theme);
          applyVisualMode(currentUser.ui_visual_mode);
          applyModalAnimation(currentUser.ui_modal_animation);
          applyModalAnimationSpeed(currentUser.ui_modal_animation_speed);
          applyMobileFontSize(currentUser.ui_mobile_font_size);
          applyUiLanguage(currentUser.ui_language || 'ru');
          localStorage.setItem('user', JSON.stringify(currentUser));
          await window.messageCache?.init?.(currentUser.id);
          hydrateComposerDraftsForCurrentUser({ force: true });
        } catch { return; }
    
        // Update UI
        updateCurrentUserFooter();
        renderActiveChatFolderBar();
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
        await loadRecentEmojis();
        initEmojiPicker();
        connectWS();
        await loadChats();
        chatListStore.setInitialChatLoadFinished(true);
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
    
    return window.BananzaAppBridge || null;
  };
})();
