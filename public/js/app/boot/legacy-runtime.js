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
      // UTILS
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
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
    
      function getComposerTextValue(...args) { return composerTextController?.getComposerTextValue?.(...args) || ''; }
    
      function setComposerTextValue(...args) { return composerTextController?.setComposerTextValue?.(...args); }
    
      function normalizeComposerInputValue(...args) { return composerTextController?.normalizeComposerInputValue?.(...args) || false; }
    
      function snapComposerSelectionToCustomEmojiBoundary(...args) { return composerTextController?.snapComposerSelectionToCustomEmojiBoundary?.(...args) || false; }
    
      function insertComposerTextAtSelection(...args) { return composerTextController?.insertComposerTextAtSelection?.(...args); }
    
      function normalizeMicrophoneMode(value) { return uiSettings.normalizeMicrophoneMode(value); }
      function getMicrophoneMode() { return uiSettings.getMicrophoneMode(); }
      function setMicrophoneMode(value, options = {}) { return uiSettings.setMicrophoneMode(value, options); }
      function getScreenRotationAllowed() { return uiSettings.getScreenRotationAllowed(); }
      function syncScreenRotationToggle() { return uiSettings.syncScreenRotationToggle(); }
      function setScreenRotationStatus(message = '', type = '') { return uiSettings.setScreenRotationStatus(message, type); }
      function clearScreenRotationStatusSoon(delayMs = 2200) { return uiSettings.clearScreenRotationStatusSoon(delayMs); }
      function applyScreenRotationPreference(options = {}) { return uiSettings.applyScreenRotationPreference(options); }
      function setScreenRotationAllowed(value, options = {}) { return uiSettings.setScreenRotationAllowed(value, options); }
      function insertDictatedText(...args) { return composerTextController?.insertDictatedText?.(...args) || getComposerTextValue(); }
    
      function getEmojiPickerInsertionValue(...args) { return composerTextController?.getEmojiPickerInsertionValue?.(...args) || ''; }
    
      function deleteComposerCustomEmojiCluster(...args) { return composerTextController?.deleteComposerCustomEmojiCluster?.(...args) || false; }
    
      function handleComposerCustomEmojiKeydown(...args) { return composerTextController?.handleComposerCustomEmojiKeydown?.(...args) || false; }
    
      function handleComposerCustomEmojiBeforeInput(...args) { return composerTextController?.handleComposerCustomEmojiBeforeInput?.(...args) || false; }
    
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
    
      function mentionKey(...args) { return composerMentionsController?.mentionKey?.(...args) || ''; }
    
      function renderMessageText(text, mentions = []) {
        const source = String(text || '');
        if (!source) return '';
        const mentionMap = new Map();
        (Array.isArray(mentions) ? mentions : []).forEach((mention) => {
          const token = mentionKey(mention.token || mention.mention || mention.username);
          if (token && !mentionMap.has(token)) mentionMap.set(token, mention);
        });
        const re = /(:qip-infium-\d{3}:|:qip-hd-[a-z0-9][a-z0-9-]{0,63}:)|(https?:\/\/[^\s<>"')\]]+)|@([a-zA-Z0-9_][a-zA-Z0-9_-]{0,31})/gi;
        let html = '';
        let lastIndex = 0;
        let match;
        while ((match = re.exec(source))) {
          html += esc(source.slice(lastIndex, match.index));
          if (match[1]) {
            html += isCustomEmojiToken(match[1])
              ? renderCustomEmojiHtml(match[1])
              : esc(match[1]);
          } else if (match[2]) {
            const url = match[2];
            html += `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`;
          } else {
            const prev = match.index > 0 ? source[match.index - 1] : '';
            const token = mentionKey(match[3]);
            const mention = !prev || !/[A-Za-z0-9_.-]/.test(prev) ? mentionMap.get(token) : null;
            if (mention) {
              html += `<button type="button" class="mention-link${mention.is_ai_bot ? ' is-bot' : ''}" data-mention-user-id="${Number(mention.user_id) || 0}" data-mention-token="${esc(mention.token || mention.mention || mention.username || token)}" data-mention-bot="${mention.is_ai_bot ? '1' : '0'}">@${esc(match[3])}</button>`;
            } else {
              html += esc(match[0]);
            }
          }
          lastIndex = re.lastIndex;
        }
        html += esc(source.slice(lastIndex));
        return html;
      }
    
      function normalizeUiTheme(theme) { return uiSettings.normalizeUiTheme(theme); }
      function renderThemePicker() { return uiSettings.renderThemePicker(); }
      function applyUiTheme(theme, persist = true) { return uiSettings.applyUiTheme(theme, persist); }
      function selectUiTheme(theme) { return uiSettings.selectUiTheme(theme); }
      function setThemeStatus(message, type = '') { return uiSettings.setThemeStatus(message, type); }
      function normalizeUiLanguage(language) { return uiSettings.normalizeUiLanguage(language); }
      function languageDisplayName(language = currentUiLanguage) { return uiSettings.languageDisplayName(language); }
      function renderLanguagePicker() { return uiSettings.renderLanguagePicker(); }
      function applyUiLanguage(language, persist = true) { return uiSettings.applyUiLanguage(language, persist); }
      function selectUiLanguage(language) { return uiSettings.selectUiLanguage(language); }
      function refreshLocalizedUi() { return uiSettings.refreshLocalizedUi(); }
      function syncLanguageSettingsButton() { return uiSettings.syncLanguageSettingsButton(); }
      function setLanguageStatus(message, type = '') { return uiSettings.setLanguageStatus(message, type); }
      function normalizeVisualMode(mode) { return uiSettings.normalizeVisualMode(mode); }
      function visualModeMeta(mode) { return uiSettings.visualModeMeta(mode); }
      function visualModeStateLabel(mode) { return uiSettings.visualModeStateLabel(mode); }
      function renderVisualModePicker() { return uiSettings.renderVisualModePicker(); }
      function applyVisualMode(mode, persist = true) { return uiSettings.applyVisualMode(mode, persist); }
      function selectVisualMode(mode) { return uiSettings.selectVisualMode(mode); }
      function setVisualModeStatus(message, type = '') { return uiSettings.setVisualModeStatus(message, type); }
      function normalizePollStyle(style) { return uiSettings.normalizePollStyle(style); }
      function pollStyleMeta(style) { return uiSettings.pollStyleMeta(style); }
      function renderPollStyleCardPreview(styleId) { return uiSettings.renderPollStyleCardPreview(styleId); }
      function renderPollStylePicker() { return uiSettings.renderPollStylePicker(); }
      function setPollStyleSurface(modalEl, style) { return uiSettings.setPollStyleSurface(modalEl, style); }
      function syncPollComposerStyleUi() { return uiSettings.syncPollComposerStyleUi(); }
      function selectPollStyle(style) { return uiSettings.selectPollStyle(style); }
      function setPollStyleStatus(message, type = '') { return uiSettings.setPollStyleStatus(message, type); }
      function normalizeModalAnimationStyle(style) { return uiSettings.normalizeModalAnimationStyle(style); }
      function modalAnimationMeta(style = currentModalAnimation) { return uiSettings.modalAnimationMeta(style); }
      function syncModalAnimationSettingsButton() { return uiSettings.syncModalAnimationSettingsButton(); }
      function normalizeModalAnimationSpeed(speed) { return uiSettings.normalizeModalAnimationSpeed(speed); }
      function getModalAnimationSpeedFactor(speed = currentModalAnimationSpeed) { return uiSettings.getModalAnimationSpeedFactor(speed); }
      function setModalAnimationStatus(message, type = '') { return uiSettings.setModalAnimationStatus(message, type); }
      function clearModalAnimationStatusTimer() { return uiSettings.clearModalAnimationStatusTimer(); }
      function scheduleModalAnimationStatusClear() { return uiSettings.scheduleModalAnimationStatusClear(); }
      function getPersistedModalAnimationPreferences() { return uiSettings.getPersistedModalAnimationPreferences(); }
      function getCurrentModalAnimationPreferences() { return uiSettings.getCurrentModalAnimationPreferences(); }
      function modalAnimationPreferencesEqual(a = {}, b = {}) { return uiSettings.modalAnimationPreferencesEqual(a, b); }
      function renderModalAnimationOptions() { return uiSettings.renderModalAnimationOptions(); }
      function renderModalAnimationSpeedControl() { return uiSettings.renderModalAnimationSpeedControl(); }
      function applyModalAnimation(style, persist = true) { return uiSettings.applyModalAnimation(style, persist); }
      function applyModalAnimationSpeed(speed, persist = true) { return uiSettings.applyModalAnimationSpeed(speed, persist); }
      function flushModalAnimationSave() { return uiSettings.flushModalAnimationSave(); }
      function scheduleModalAnimationSave(options = {}) { return uiSettings.scheduleModalAnimationSave(options); }
      function selectModalAnimation(style) { return uiSettings.selectModalAnimation(style); }
      function updateModalAnimationSpeed(speed, options = {}) { return uiSettings.updateModalAnimationSpeed(speed, options); }
      function normalizeMobileFontSize(size) { return uiSettings.normalizeMobileFontSize(size); }
      function getMobileFontAdjustPercent(size = currentMobileFontSize) { return uiSettings.getMobileFontAdjustPercent(size); }
      function hasAndroidNativeBridge() { return uiSettings.hasAndroidNativeBridge(); }
      function notifyAndroidScreenRotationPreference(reason = 'sync') { return uiSettings.notifyAndroidScreenRotationPreference(reason); }
      function setMobileFontAdjustPercent(percent = 100) { return uiSettings.setMobileFontAdjustPercent(percent); }
      function notifyAndroidMobileFontSize(size = currentMobileFontSize) { return uiSettings.notifyAndroidMobileFontSize(size); }
      function syncMobileFontSettingsButton() { return uiSettings.syncMobileFontSettingsButton(); }
      function setMobileFontSizeStatus(message, type = '') { return uiSettings.setMobileFontSizeStatus(message, type); }
      function clearMobileFontSizeStatusTimer() { return uiSettings.clearMobileFontSizeStatusTimer(); }
      function scheduleMobileFontSizeStatusClear() { return uiSettings.scheduleMobileFontSizeStatusClear(); }
      function getPersistedMobileFontSize() { return uiSettings.getPersistedMobileFontSize(); }
      function renderMobileFontSizeControl() { return uiSettings.renderMobileFontSizeControl(); }
      function applyMobileFontSize(size, persist = true) { return uiSettings.applyMobileFontSize(size, persist); }
      function syncMobileFontSizeViewportState() { return uiSettings.syncMobileFontSizeViewportState(); }
      function flushMobileFontSizeSave() { return uiSettings.flushMobileFontSizeSave(); }
      function scheduleMobileFontSizeSave(options = {}) { return uiSettings.scheduleMobileFontSizeSave(options); }
      function updateMobileFontSize(size, options = {}) { return uiSettings.updateMobileFontSize(size, options); }
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
        if (isSingleCustomEmojiMessage(value)) return true;
        const graphemes = splitGraphemes(value);
        if (graphemes.length !== 1) return false;
        const pattern = getSingleEmojiPattern();
        if (pattern) return pattern.test(graphemes[0]);
        return /^(?:[\u00A9\u00AE]|[\u203C-\u3299]\uFE0F?|[\uD800-\uDBFF][\uDC00-\uDFFF])$/.test(graphemes[0]);
      }
    
      function applyPosterToVideoElement(...args) {
        return messageAttachmentRenderer?.applyPosterToVideoElement?.(...args);
      }
    
      function markAttachmentPosterAvailable(...args) {
        return messageAttachmentRenderer?.markAttachmentPosterAvailable?.(...args);
      }
    
      function ensureAttachmentPoster(...args) {
        return messageAttachmentRenderer?.ensureAttachmentPoster?.(...args);
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
    
      function setPollComposerStatus(...args) { return pollComposerController?.setPollComposerStatus?.(...args); }
    
      function readPollComposerForm(...args) { return pollComposerController?.readPollComposerForm?.(...args) || { question: '', options: [] }; }
    
      function renderPollComposerOptionInputs(...args) { return pollComposerController?.renderPollComposerOptionInputs?.(...args); }
    
      function refreshPollComposerActionState(...args) { return pollComposerController?.refreshPollComposerActionState?.(...args); }
    
      function buildPollComposerPreviewMessage(...args) { return pollComposerController?.buildPollComposerPreviewMessage?.(...args) || null; }
    
      function refreshPollComposerPreview(...args) { return pollComposerController?.refreshPollComposerPreview?.(...args); }
    
      function resetPollComposer(...args) { return pollComposerController?.resetPollComposer?.(...args); }
    
      function openPollComposer(...args) { return pollComposerController?.openPollComposer?.(...args); }
    
async function submitPollComposer(...args) { return pollComposerController?.submitPollComposer?.(...args); }
    
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
          return ['AI bot', botMentionText(user), botModelText(user)].filter(Boolean).join(' \u2022 ');
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
            ${canRemove && Number(user.id) !== Number(currentUser?.id || 0) ? `<button class="member-remove" data-uid="${user.id}" title="Remove">\u2715</button>` : ''}
          </div>
        `;
      }
    
      function formatBotAuditSource(source) {
        return adminBotAuditController.formatBotAuditSource(source);
      }
    
      function ensureBotVisibilityToggles() {
        const configs = [
          ['aiBotEnabled', 'aiBotVisibleToUsers'],
          ['openAiUniversalBotEnabled', 'openAiUniversalBotVisibleToUsers'],
          ['openAiImageBotEnabled', 'openAiImageBotVisibleToUsers'],
          ['deepseekAiBotEnabled', 'deepseekAiBotVisibleToUsers'],
          ['qwenAiBotEnabled', 'qwenAiBotVisibleToUsers'],
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
        if (!app || !window.visualViewport || !isMobileLayoutViewport()) return;
        const newViewportHeight = Math.max(0, window.visualViewport?.height || 0);
        const mentionPickerDismissed = dismissMentionPickerAfterKeyboardClose();
        getMobileViewportBaselineHeight();
        const rawViewport = getMobileVisualViewportMetrics();
        const inputHeight = Math.max(0, Math.round(inputArea?.getBoundingClientRect?.().height || 0));
        const keyboardLayoutActive = isMobileChatKeyboardLayoutActive();
        const viewport = getLockedMobileKeyboardViewportMetrics(rawViewport, keyboardLayoutActive, inputHeight);
        const newAppHeight = getMobileAppViewportHeight(keyboardLayoutActive ? viewport : rawViewport);
        if (!shouldBypassLockedMobileViewportSync(newViewportHeight, { force, mentionPickerDismissed })) {
          mobileViewportPrevHeight = newViewportHeight;
          queueMobileViewportLayoutSync();
          return;
        }
        app.style.height = `${Math.round(newAppHeight)}px`;
        app.style.paddingTop = '0px';
        syncChatAreaMetrics();
        queueMobileViewportLayoutSync();
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
        if (!window.visualViewport || !isMobileLayoutViewport()) return false;
        if (mobileViewportRecoveryFrame) cancelAnimationFrame(mobileViewportRecoveryFrame);
        clearTimeout(mobileViewportRecoveryTimer);
    
        const runRecovery = () => {
          forceMobileViewportLayoutSync();
          syncChatAreaMetrics();
          queueMobileViewportLayoutSync();
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
        window.visualViewport.addEventListener('scroll', syncMobileAppHeightToViewport);
        window.addEventListener('scroll', () => {
          if (!restoreMobileKeyboardDocumentScroll()) return;
          queueMobileViewportLayoutSync();
        }, { passive: true });
        window.addEventListener('orientationchange', () => {
          mobileVisualViewportBaselineHeight = 0;
          mobileVisualViewportBaselineWidth = 0;
          resetMobileKeyboardDock();
          syncMobileAppHeightToViewport({ force: true });
        });
        if ('ResizeObserver' in window && !mobileViewportElementResizeObserver) {
          mobileViewportElementResizeObserver = new ResizeObserver(() => {
            queueMobileViewportLayoutSync();
          });
          if (chatHeader) mobileViewportElementResizeObserver.observe(chatHeader);
          if (inputArea) mobileViewportElementResizeObserver.observe(inputArea);
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
        return openChatController.isCurrentChatOpenTransition(seq, chatId);
      }
    
      function isUiTransitionBusy() {
        return Boolean(openChatController.isChatOpenInProgress() || mobileRouteTransitionActive);
      }
    
      function isMobileViewportLayoutLocked() {
        if (!isMobileLayoutViewport()) return false;
        if (mobileRouteTransitionActive) return true;
        if (hasOpenModal()) return true;
        if (searchPanel && searchPanel.getAttribute('aria-hidden') === 'false') return true;
        if (isFloatingSurfaceVisible(chatContextMenuBackdrop)
          || isFloatingSurfaceVisible(chatContextMenu)
          || isFloatingSurfaceVisible(chatFolderPickerBackdrop)
          || isFloatingSurfaceVisible(chatFolderPicker)
          || isFloatingSurfaceVisible(chatFolderContextMenuBackdrop)
          || isFloatingSurfaceVisible(chatFolderContextMenu)
          || isFloatingSurfaceVisible(mediaContextMenuBackdrop)
          || isFloatingSurfaceVisible(mediaContextMenu)
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
        return chatListService.flushDeferredRecoverySync(reason);
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
          chatListStore.resetHiddenChatSearch();
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
    
      function setChatFolderManageStatus(message, type = '') { return folderManageModalController.setChatFolderManageStatus(message, type); }
      function chatFolderIconEmoji(kind = 'custom') { return folderUiController.chatFolderIconEmoji(kind); }
      function chatFolderEmojiMarkup(kind = 'custom', className = 'chat-folder-picker-emoji') { return folderUiController.chatFolderEmojiMarkup(kind, className); }
      function chatFolderIconMarkup(kind = 'custom') { return folderUiController.chatFolderIconMarkup(kind); }
      function normalizeChatFolderId(folderId) { return window.BananzaApp.folders.store.normalizeChatFolderId(folderId, appConfig); }
      function shouldShowActiveChatFolderBar() { return folderUiController.shouldShowActiveChatFolderBar(); }
      function activeChatFolderStripRows() { return folderUiController.activeChatFolderStripRows(); }
      function getRenderedChatFolderSelectionId() { return folderUiController.getRenderedChatFolderSelectionId(); }
      function isChatFolderStripVisibleInAllChatsEnabled() { return folderUiController.isChatFolderStripVisibleInAllChatsEnabled(); }
      function syncChatFolderPickerAllChatsToggleState() { return folderUiController.syncChatFolderPickerAllChatsToggleState(); }
      function applyChatFolderStripVisibilityInAllChats(enabled, options = {}) { return folderUiController.applyChatFolderStripVisibilityInAllChats(enabled, options); }
      function saveChatFolderStripVisibilityInAllChats(nextValue) { return folderUiController.saveChatFolderStripVisibilityInAllChats(nextValue); }
      function shouldShowChatFolderBarForSelection(folderId, options = {}) { return folderUiController.shouldShowChatFolderBarForSelection(folderId, options); }
      function chatFolderStripStructureSignature(rows = []) { return folderUiController.chatFolderStripStructureSignature(rows); }
      function chatFolderStripLabelForSelection(folderId, rows) { return folderUiController.chatFolderStripLabelForSelection(folderId, rows); }
      function setPendingChatFolderChipCenterBehavior(behavior = 'auto') { return folderUiController.setPendingChatFolderChipCenterBehavior(behavior); }
      function cancelScheduledActiveChatFolderChipCenter() { return folderUiController.cancelScheduledActiveChatFolderChipCenter(); }
      function centerActiveChatFolderChip(options = {}) { return folderUiController.centerActiveChatFolderChip(options); }
      function scheduleActiveChatFolderChipCenter(options = {}) { return folderUiController.scheduleActiveChatFolderChipCenter(options); }
      function renderChatFolderStripStructure(options = {}) { return folderUiController.renderChatFolderStripStructure(options); }
      function syncActiveChatFolderStripState(selectedFolderId, options = {}) { return folderUiController.syncActiveChatFolderStripState(selectedFolderId, options); }
      function renderActiveChatFolderBar(options = {}) { return folderUiController.renderActiveChatFolderBar(options); }
      function beginChatFolderStripPreview(folderId, options = {}) { return folderUiController.beginChatFolderStripPreview(folderId, options); }
      function finalizeChatFolderStripPreview(options = {}) { return folderUiController.finalizeChatFolderStripPreview(options); }
    
      function getChatFolderSwitchTargets() {
        return [chatFolderListSurface].filter((el) => (
          el instanceof HTMLElement && !el.classList.contains('hidden')
        ));
      }
    
      function resetChatFolderSwitchAnimations(targets = []) {
        targets.forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          el.classList.remove(
            'is-folder-switching',
            'is-folder-switching-in',
            'is-folder-switching-out',
            'is-folder-switching-active'
          );
        });
      }
    
      function destroyChatFolderSwipePager() {
        const state = chatFolderSwipePagerState;
        chatFolderSwipePagerState = null;
        if (state?.stage instanceof HTMLElement) state.stage.remove();
        if (chatFolderListSurface instanceof HTMLElement) {
          chatFolderListSurface.classList.remove('is-folder-swipe-paging');
        }
        if (chatList instanceof HTMLElement) chatList.classList.remove('is-folder-swipe-source');
      }
    
      function resetChatFolderSwipeSurface() {
        if (!(chatFolderListSurface instanceof HTMLElement)) return;
        destroyChatFolderSwipePager();
        chatFolderListSurface.classList.remove(
          'is-folder-swipe-dragging',
          'is-folder-swipe-settling',
          'is-folder-swipe-preparing',
          'is-folder-swipe-paging'
        );
        chatFolderListSurface.style.transform = '';
      }
    
      function waitForAnimationFrames(count = 1) {
        return new Promise((resolve) => {
          const step = (remaining) => {
            if (remaining <= 0) {
              resolve();
              return;
            }
            requestAnimationFrame(() => step(remaining - 1));
          };
          step(Math.max(1, Number(count || 1)));
        });
      }
    
      function waitForMs(ms = 0) {
        return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms || 0))));
      }
    
      async function playChatFolderSwitchPhase(targets, phase) {
        if (!targets.length) return;
        const phaseClass = phase === 'in' ? 'is-folder-switching-in' : 'is-folder-switching-out';
        resetChatFolderSwitchAnimations(targets);
        targets.forEach((el) => {
          el.classList.add('is-folder-switching', phaseClass);
          void el.offsetWidth;
        });
        await waitForAnimationFrames(1);
        targets.forEach((el) => el.classList.add('is-folder-switching-active'));
        const transitionMs = Math.max(...targets.map((el) => Math.ceil(getElementTransitionTotalMs(el))), 0);
        await waitForMs(Math.max(transitionMs, 180) + 24);
      }
    
      function canAnimateChatFolderContent({ allowDuringMobileRoute = false } = {}) {
        return !prefersReducedMotion()
          && currentModalAnimation !== 'none'
          && getChatFolderSwitchTargets().length > 0
          && (allowDuringMobileRoute || !mobileRouteTransitionActive);
      }
    
      async function animateChatFolderContentEntry({ allowDuringMobileRoute = false } = {}) {
        if (!canAnimateChatFolderContent({ allowDuringMobileRoute })) return false;
        const targets = getChatFolderSwitchTargets();
        const seq = ++chatFolderSwitchSeq;
        try {
          await playChatFolderSwitchPhase(targets, 'in');
          return seq === chatFolderSwitchSeq;
        } finally {
          if (seq === chatFolderSwitchSeq) resetChatFolderSwitchAnimations(targets);
        }
      }
    
      function getChatFolderPageRows() {
        return activeChatFolderStripRows()
          .map((row) => ({
            ...row,
            id: normalizeChatFolderId(row?.id),
          }))
          .filter((row, index, rows) => rows.findIndex((entry) => entry.id === row.id) === index);
      }
    
      function getChatFolderPageIndex(folderId = chatFolderStore.activeFolderId, rows = getChatFolderPageRows()) {
        const normalizedFolderId = normalizeChatFolderId(folderId);
        const index = rows.findIndex((row) => Number(row.id || 0) === normalizedFolderId);
        return index >= 0 ? index : 0;
      }
    
      function getAdjacentChatFolderPage(direction, folderId = chatFolderStore.activeFolderId) {
        const rows = getChatFolderPageRows();
        if (rows.length <= 1) return null;
        const dir = direction < 0 ? -1 : 1;
        const currentIndex = getChatFolderPageIndex(folderId, rows);
        const nextIndex = currentIndex + dir;
        return nextIndex >= 0 && nextIndex < rows.length ? rows[nextIndex] : null;
      }
    
      function getChatFolderSwipeSurfaceWidth() {
        return Math.max(
          1,
          Math.round(
            Number(chatFolderListSurface?.clientWidth || 0)
            || Number(sidebar?.clientWidth || 0)
            || Number(window.innerWidth || 0)
            || 1
          )
        );
      }
    
      function getChatFolderSwipeCommitDistance() {
        const width = getChatFolderSwipeSurfaceWidth();
        return Math.min(128, Math.max(CHAT_FOLDER_SWIPE_COMMIT_MIN_PX, Math.round(width * CHAT_FOLDER_SWIPE_COMMIT_RATIO)));
      }
    
      function canAnimateChatFolderSwipe() {
        return !prefersReducedMotion()
          && currentModalAnimation !== 'none'
          && chatFolderListSurface instanceof HTMLElement
          && !mobileRouteTransitionActive;
      }
    
      function getChatFolderSwipeTransformTarget() {
        return chatFolderSwipePagerState?.track instanceof HTMLElement
          ? chatFolderSwipePagerState.track
          : chatFolderListSurface;
      }
    
      function createChatFolderSwipePage(folderId, role = '') {
        const page = document.createElement('div');
        page.className = 'chat-list chat-folder-swipe-page';
        page.dataset.folderSwipePage = String(normalizeChatFolderId(folderId));
        if (role) page.dataset.folderSwipeRole = role;
        renderChatListInto(page, {
          filter: chatSearch?.value || '',
          folderId,
          includeSearchExtras: false,
        });
        return page;
      }
    
      function prepareChatFolderSwipePager(direction, adjacentFolderId) {
        if (!canAnimateChatFolderSwipe() || !(chatFolderListSurface instanceof HTMLElement) || !(chatList instanceof HTMLElement)) {
          destroyChatFolderSwipePager();
          return null;
        }
        const swipeDirection = direction < 0 ? -1 : 1;
        const width = getChatFolderSwipeSurfaceWidth();
        const currentFolderId = normalizeChatFolderId(chatFolderStore.activeFolderId);
        const nextFolderId = normalizeChatFolderId(adjacentFolderId);
        const currentState = chatFolderSwipePagerState;
        if (
          currentState
          && currentState.direction === swipeDirection
          && currentState.currentFolderId === currentFolderId
          && currentState.nextFolderId === nextFolderId
          && currentState.width === width
          && currentState.track instanceof HTMLElement
          && currentState.stage instanceof HTMLElement
        ) {
          return currentState;
        }
    
        destroyChatFolderSwipePager();
    
        const stage = document.createElement('div');
        stage.className = 'chat-folder-swipe-stage';
        stage.setAttribute('aria-hidden', 'true');
    
        const track = document.createElement('div');
        track.className = 'chat-folder-swipe-track';
    
        const currentPage = createChatFolderSwipePage(currentFolderId, 'current');
        const adjacentPage = createChatFolderSwipePage(nextFolderId, 'adjacent');
        currentPage.scrollTop = chatList.scrollTop;
    
        if (swipeDirection > 0) {
          track.append(currentPage, adjacentPage);
        } else {
          track.append(adjacentPage, currentPage);
        }
        stage.appendChild(track);
        chatFolderListSurface.appendChild(stage);
    
        chatFolderSwipePagerState = {
          stage,
          track,
          direction: swipeDirection,
          currentFolderId,
          nextFolderId,
          width,
          baseOffset: swipeDirection > 0 ? 0 : -width,
        };
        chatFolderListSurface.classList.add('is-folder-swipe-paging');
        chatList.classList.add('is-folder-swipe-source');
        setChatFolderSwipeOffset(chatFolderSwipePagerState.baseOffset, 'preparing');
        return chatFolderSwipePagerState;
      }
    
      function setChatFolderSwipeOffset(offset, mode = 'dragging') {
        if (!(chatFolderListSurface instanceof HTMLElement)) return false;
        chatFolderListSurface.classList.toggle('is-folder-swipe-dragging', mode === 'dragging');
        chatFolderListSurface.classList.toggle('is-folder-swipe-settling', mode === 'settling');
        chatFolderListSurface.classList.toggle('is-folder-swipe-preparing', mode === 'preparing');
        chatFolderListSurface.classList.toggle('is-folder-swipe-paging', Boolean(chatFolderSwipePagerState));
        const target = getChatFolderSwipeTransformTarget();
        if (!(target instanceof HTMLElement)) return false;
        if (target !== chatFolderListSurface) chatFolderListSurface.style.transform = '';
        target.style.transform = `translate3d(${Math.round(Number(offset || 0))}px, 0, 0)`;
        return true;
      }
    
      async function settleChatFolderSwipeOffset(offset) {
        if (!(chatFolderListSurface instanceof HTMLElement)) return false;
        setChatFolderSwipeOffset(offset, 'settling');
        const target = getChatFolderSwipeTransformTarget();
        const transitionMs = Math.ceil(getElementTransitionTotalMs(target));
        await waitForMs(Math.max(transitionMs, 180) + 24);
        return true;
      }
    
      async function snapChatFolderSwipeBack() {
        if (!canAnimateChatFolderSwipe()) {
          resetChatFolderSwipeSurface();
          return false;
        }
        try {
          await settleChatFolderSwipeOffset(0);
          return true;
        } finally {
          resetChatFolderSwipeSurface();
        }
      }
    
      async function transitionToChatFolderBySwipe(folderId, { persist = true, closePicker = false, direction = 1 } = {}) {
        const nextFolderId = normalizeChatFolderId(folderId);
        const currentFolderId = normalizeChatFolderId(chatFolderStore.activeFolderId);
        if (currentFolderId === nextFolderId) {
          if (closePicker) await hideChatFolderPicker();
          await snapChatFolderSwipeBack();
          return getActiveChatFolder();
        }
    
        if (closePicker) await hideChatFolderPicker();
    
        const swipeDirection = direction < 0 ? -1 : 1;
        const canAnimate = canAnimateChatFolderSwipe();
        const centerBehavior = canAnimate ? 'smooth' : 'auto';
        const currentShowsBar = shouldShowChatFolderBarForSelection(currentFolderId, { forceVisible: false });
        const nextShowsBar = shouldShowChatFolderBarForSelection(nextFolderId, { forceVisible: false });
        const seq = ++chatFolderSwitchSeq;
        const previewPrepared = currentShowsBar || nextShowsBar;
    
        try {
          if (previewPrepared) {
            beginChatFolderStripPreview(nextFolderId, { forceVisible: true, centerBehavior });
          }
    
          if (!canAnimate) {
            resetChatFolderSwipeSurface();
            setActiveChatFolder(nextFolderId, { persist, render: false });
            renderChatList(chatSearch?.value || '');
            return getActiveChatFolder();
          }
    
          let pager = chatFolderSwipePagerState;
          if (
            !pager
            || pager.direction !== swipeDirection
            || pager.currentFolderId !== currentFolderId
            || pager.nextFolderId !== nextFolderId
          ) {
            pager = prepareChatFolderSwipePager(swipeDirection, nextFolderId);
          }
          if (!pager) {
            setActiveChatFolder(nextFolderId, { persist, render: false });
            renderChatList(chatSearch?.value || '');
            return getActiveChatFolder();
          }
    
          const finalOffset = swipeDirection > 0 ? -pager.width : 0;
          await settleChatFolderSwipeOffset(finalOffset);
          if (seq !== chatFolderSwitchSeq) return getActiveChatFolder();
    
          setActiveChatFolder(nextFolderId, { persist, render: false });
          renderChatList(chatSearch?.value || '');
          return getActiveChatFolder();
        } finally {
          if (seq === chatFolderSwitchSeq) {
            resetChatFolderSwipeSurface();
            if (previewPrepared) finalizeChatFolderStripPreview({ centerBehavior: 'auto' });
          } else {
            resetChatFolderSwipeSurface();
          }
        }
      }
    
      async function transitionToChatFolder(folderId, { persist = true, closePicker = false, swipeDirection = 0 } = {}) {
        const nextFolderId = normalizeChatFolderId(folderId);
        if (swipeDirection) {
          return transitionToChatFolderBySwipe(nextFolderId, { persist, closePicker, direction: swipeDirection });
        }
        const currentFolderId = normalizeChatFolderId(chatFolderStore.activeFolderId);
        if (currentFolderId === nextFolderId) {
          if (closePicker) await hideChatFolderPicker();
          return getActiveChatFolder();
        }
    
        if (closePicker) await hideChatFolderPicker();
    
        const canAnimate = canAnimateChatFolderContent();
        const centerBehavior = canAnimate ? 'smooth' : 'auto';
        const currentShowsBar = shouldShowChatFolderBarForSelection(currentFolderId, { forceVisible: false });
        const nextShowsBar = shouldShowChatFolderBarForSelection(nextFolderId, { forceVisible: false });
        const touchedTargets = new Set();
        const seq = ++chatFolderSwitchSeq;
        let previewPrepared = false;
    
        try {
          if (currentShowsBar) {
            beginChatFolderStripPreview(nextFolderId, { forceVisible: true, centerBehavior });
            previewPrepared = true;
          }
    
          if (canAnimate) {
            const exitTargets = getChatFolderSwitchTargets();
            exitTargets.forEach((el) => touchedTargets.add(el));
            await playChatFolderSwitchPhase(exitTargets, 'out');
            if (seq !== chatFolderSwitchSeq) return getActiveChatFolder();
          }
    
          if (!previewPrepared && nextShowsBar) {
            beginChatFolderStripPreview(nextFolderId, { forceVisible: true, centerBehavior });
            previewPrepared = true;
          }
    
          setActiveChatFolder(nextFolderId, { persist, render: false });
          renderChatList(chatSearch?.value || '');
    
          if (!canAnimate) return getActiveChatFolder();
    
          const enterTargets = getChatFolderSwitchTargets();
          enterTargets.forEach((el) => touchedTargets.add(el));
          await playChatFolderSwitchPhase(enterTargets, 'in');
          return getActiveChatFolder();
        } finally {
          if (seq === chatFolderSwitchSeq) {
            resetChatFolderSwitchAnimations([...touchedTargets]);
            finalizeChatFolderStripPreview({ centerBehavior: 'auto' });
          }
        }
      }
    
      function setActiveChatFolder(folderId, { persist = true, render = true } = {}) {
        return folderActionsController.setActiveChatFolder(folderId, { persist, render });
      }
    
      async function loadChatFolders({ silent = false, renderAfterLoad = true } = {}) {
        return folderActionsController.loadChatFolders({ silent, renderAfterLoad });
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
          closeChatHeaderActions();
          chatTitle.textContent = 'Chat';
          chatHeaderAvatar.style.display = 'none';
          syncChatShotButton();
          window.BananzaCallHooks?.onChatChanged?.(null, null);
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
          syncChatShotButton();
          window.BananzaCallHooks?.onChatChanged?.(chat.id, chat);
          return;
        }
        if (chat.type === 'private' && chat.private_user) {
          setAvatarElementVisual(chatHeaderAvatar, {
            name: chat.private_user.display_name || chat.name,
            color: chat.private_user.avatar_color || '#65aadd',
            avatarUrl: chat.private_user.avatar_url || '',
            fallbackText: initials(chat.private_user.display_name || chat.name || '?'),
          });
          syncChatShotButton();
          window.BananzaCallHooks?.onChatChanged?.(chat.id, chat);
          return;
        }
        setAvatarElementVisual(chatHeaderAvatar, {
          name: chat.name,
          color: '#5eb5f7',
          avatarUrl: chat.avatar_url || '',
          fallbackText: chat.type === 'general' ? '\ud83c\udf10' : '\ud83d\udc65',
        });
        syncChatShotButton();
        window.BananzaCallHooks?.onChatChanged?.(chat.id, chat);
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
              fallbackText: chat.type === 'general' ? '\ud83c\udf10' : '\ud83d\udc65',
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
        renderChatShotForm(getCurrentChatShotState());
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
        const result = chatListService.applyChatUpdate(nextChat);
        refreshChatListReferences();
        syncCoreStateToRuntime();
        return result;
      }
    
      function applyCurrentUserUpdateFromPresence(user = {}) {
        const userId = Number(user.id || user.user_id || 0);
        if (!userId || !currentUser || Number(currentUser.id) !== userId) return null;
        currentUser = {
          ...currentUser,
          ...user,
          avatar_url: user.avatar_url,
        };
        currentUser.ui_show_chat_folder_strip_in_all_chats = Boolean(currentUser.ui_show_chat_folder_strip_in_all_chats);
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
        if (Object.prototype.hasOwnProperty.call(user, 'ui_language')) {
          applyUiLanguage(user.ui_language, false);
        }
        if (Object.prototype.hasOwnProperty.call(user, 'ui_show_chat_folder_strip_in_all_chats')) {
          renderActiveChatFolderBar({ centerBehavior: 'auto' });
          if (isFloatingSurfaceVisible(chatFolderPicker)) syncChatFolderPickerAllChatsToggleState();
        }
        syncCoreStateToRuntime();
        persistCurrentUser();
        updateCurrentUserFooter();
        if (!menuDrawer.classList.contains('hidden')) renderProfileEditor({ preserveStatus: true });
        return currentUser;
      }
    
      function patchChatMembersCacheForPresence(user = {}) {
        const userId = Number(user.id || user.user_id || 0);
        if (!userId) return false;
        let patched = false;
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
          if (changed) {
            patched = true;
            chatMembersCache.set(chatId, nextMembers);
          }
        });
        return patched;
      }
    
      function patchMentionTargetsForPresence(user = {}) {
        const userId = Number(user.id || user.user_id || 0);
        if (!userId) return false;
        let patched = false;
        composerStateController.mentionTargetsByChat.forEach((targets, chatId) => {
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
          if (changed) {
            patched = true;
            composerStateController.mentionTargetsByChat.set(chatId, nextTargets);
          }
        });
        return patched;
      }
    
      function patchAiBotUserForPresence(user = {}) {
        const userId = Number(user.id || user.user_id || 0);
        if (!userId) return false;
        let aiBotChanged = false;
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
        return aiBotChanged;
      }
    
      function refreshMentionPickerForUserUpdate() {
        return composerMentionsController?.refreshMentionPickerForUserUpdate?.();
      }
    
      function applyUserUpdate(nextUser = {}) {
        const result = chatListService.applyUserUpdate(nextUser);
        refreshChatListReferences();
        syncCoreStateToRuntime();
        return result;
      }
    
      function weatherLocationLabel(location) { return weatherSettingsController.weatherLocationLabel(location); }
      function weatherIcon(code, isDay) { return weatherSettingsController.weatherIcon(code, isDay); }
      function formatWeatherValue(value, fallback, precision = 0) { return weatherSettingsController.formatWeatherValue(value, fallback, precision); }
      function renderWeatherWidget(data) { return weatherSettingsController.renderWeatherWidget(data); }
      function setWeatherStatus(message, type = '') { return weatherSettingsController.setWeatherStatus(message, type); }
      function renderWeatherSettingsForm(draft = {}) { return weatherSettingsController.renderWeatherSettingsForm(draft); }
      function renderWeatherSearchResults(results) { return weatherSettingsController.renderWeatherSearchResults(results); }
      function scheduleWeatherRefresh() { return weatherSettingsController.scheduleWeatherRefresh(); }
      function loadWeatherSettings() { return weatherSettingsController.loadWeatherSettings(); }
      function loadCurrentWeather(force = false) { return weatherSettingsController.loadCurrentWeather(force); }
      function searchWeatherLocations() { return weatherSettingsController.searchWeatherLocations(); }
      function saveWeatherSettings() { return weatherSettingsController.saveWeatherSettings(); }
      function isLocalhost() { return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname); }
      function isPushSupported() { return notificationSettingsController.isPushSupported(); }
      function setNotificationStatus(message, type = '') { return notificationSettingsController.setNotificationStatus(message, type); }
      function notificationPermissionLabel() { return notificationSettingsController.notificationPermissionLabel(); }
      function renderNotificationSettingsForm() { return notificationSettingsController.renderNotificationSettingsForm(); }
      function loadNotificationSettings() { return notificationSettingsController.loadNotificationSettings(); }
      function saveNotificationSettings(patch = {}) { return notificationSettingsController.saveNotificationSettings(patch); }
      function enablePushNotifications() { return notificationSettingsController.enablePushNotifications(); }
      function disablePushOnThisDevice() { return notificationSettingsController.disablePushOnThisDevice(); }
      function testPushNotification() { return notificationSettingsController.testPushNotification(); }
      function refreshPushDeviceState() { return notificationSettingsController.refreshPushDeviceState(); }
      function applySoundSettings(next = {}) { return soundSettingsController.applySoundSettings(next); }
      function setSoundStatus(message, type = '') { return soundSettingsController.setSoundStatus(message, type); }
      function renderSoundSettingsForm() { return soundSettingsController.renderSoundSettingsForm(); }
      function getSoundSettingsFromForm() { return soundSettingsController.getSoundSettingsFromForm(); }
      function loadSoundSettings() { return soundSettingsController.loadSoundSettings(); }
      function saveSoundSettings(patch = {}, options = {}) { return soundSettingsController.saveSoundSettings(patch, options); }
      function scheduleSoundSettingsSave(patch = {}) { return soundSettingsController.scheduleSoundSettingsSave(patch); }
      function playAppSound(type, options = {}) { return soundSettingsController.playAppSound(type, options); }
      function previewSound(type) { return soundSettingsController.previewSound(type); }
      function previewAllSounds() { return soundSettingsController.previewAllSounds(); }
      function getChatById(chatId) {
        return chatListService.getChatById(chatId);
      }
    
      function isChatPinned(chatOrId) {
        const chat = typeof chatOrId === 'object' && chatOrId !== null ? chatOrId : getChatById(chatOrId);
        return getChatPinOrder(chat) != null || Boolean(chat && (chat.is_pinned === true || chat.is_pinned === 1 || chat.is_pinned === '1'));
      }
    
      function getActiveChatFolder() {
        return chatFolderStore.getActiveChatFolder();
      }
    
      function isAllChatsFolderActive() {
        return chatFolderStore.isAllChatsFolderActive();
      }
    
      function getFolderPinnedChatOrder(folderId, chatOrId) {
        return chatFolderStore.getFolderPinnedChatOrder(folderId, chatOrId);
      }
    
      function isChatPinnedInFolder(folderId, chatOrId) {
        return chatFolderStore.isChatPinnedInFolder(folderId, chatOrId);
      }
    
      function compareChatsForFolder(folderId, a, b) {
        return chatFolderStore.compareChatsForFolder(folderId, a, b, compareChatActivity);
      }
    
      function folderSummaryText(folder) {
        return chatFolderStore.folderSummaryText(folder, chats);
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
        return soundSettingsController.isChatIncomingSoundEnabled(chatId);
      }
    
      function isPinNotificationEnabled(chatId) {
        const settings = notificationSettingsController.getSettings();
        return Boolean(settings.notify_pins !== false && isChatNotificationEnabled(chatId));
      }
    
      function isPinSoundEnabled(chatId) {
        return soundSettingsController.isPinSoundEnabled(chatId);
      }
    
      function isMentionSoundEnabled() {
        return soundSettingsController.isMentionSoundEnabled();
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
        $('#chatNotifyHint')?.classList.toggle('hidden', !!notificationSettingsController.getSettings().push_enabled);
        $('#chatSoundHint')?.classList.toggle('hidden', !!soundSettingsController.getSettings().sounds_enabled);
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
          setChatPreferencesStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0447\u0430\u0442\u0430', 'error');
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
        setChatPreferencesStatus('\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e...');
        try {
          const data = await api(`/api/chats/${currentChatId}/preferences`, { method: 'PUT', body: next });
          const preferences = data.preferences || next;
          if (chat) Object.assign(chat, preferences);
          renderChatPreferencesForm(chat || preferences);
          setChatPreferencesStatus('\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e', 'success');
        } catch (e) {
          setChatPreferencesStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0447\u0430\u0442\u0430', 'error');
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
        const fallback = pin?.is_voice_note ? t(pin?.is_video_note ? 'Video note' : 'Voice message') : t('Pinned message');
        return String(
          pin?.preview_text
          || pin?.file_name
          || fallback
        ).trim() || fallback;
      }
    
      function getPinActorName(pin) {
        return String(pin?.pinned_by_name || t('Someone')).trim() || t('Someone');
      }
    
      function getPinToastText(pin) {
        return t('{name} pinned: {preview}', {
          name: getPinActorName(pin),
          preview: getPinPreviewText(pin),
        });
      }
    
      function buildPinBrowserNotification(pin, chatId) {
        const chat = getChatById(chatId);
        const actorName = getPinActorName(pin);
        const preview = getPinPreviewText(pin);
        return {
          title: chat?.type === 'private' ? actorName : (chat?.name || 'BananZa'),
          body: chat?.type === 'private'
            ? t('Pinned message: {preview}', { preview })
            : t('{name} pinned: {preview}', { name: actorName, preview }),
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
            title: t('Pin message'),
            label: t('Pin'),
            iconHtml: '&#128204;',
          };
        }
        const canUnpin = canUnpinPin(pin);
        return {
          show: true,
          isPinned: true,
          disabled: !canUnpin,
          pin,
          title: canUnpin ? t('Unpin message') : t('Pinned by {name}', { name: pin.pinned_by_name || t('another user') }),
          label: canUnpin ? t('Unpin') : t('Pinned'),
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
          notificationSettingsController.getSettings().push_enabled &&
          isPinNotificationEnabled(chatId) &&
          !notificationSettingsController.isPushDeviceSubscribed()
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
          <div class="pinned-bar-viewport" role="list" aria-label="${esc(t('Pinned messages'))}">
            ${pins.map((pin, pinIndex) => {
              const preview = getPinPreviewText(pin);
              const author = pin.message_author_name ? `${pin.message_author_name}` : t('Message');
              const pinnedBy = pin.pinned_by_name ? t('Pinned by {name}', { name: pin.pinned_by_name }) : t('Pinned message');
              return `
                <button type="button" class="pinned-bar-item${pinIndex === index ? ' active' : ''}" data-pin-index="${pinIndex}" title="${esc(t('Jump to pinned message'))}">
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
            <button type="button" class="pinned-bar-close${canUnpinActive ? '' : ' hidden'}" title="${esc(t('Unpin message'))}" aria-label="${esc(t('Unpin pinned message'))}">&times;</button>
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
          el.textContent = tx(message || '');
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
            if (pendingLabel) btn.textContent = tx(pendingLabel);
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
        openAiImageState.settings = { ...openAiImageState.settings, ...settings };
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
        renderOpenAiImageModelOptions(currentOpenAiImageBot());
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
            setAiModelStatus(aiModelCatalog.fetched_at ? `\u041c\u043e\u0434\u0435\u043b\u0438 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b: ${aiModelCatalog.fetched_at}` : '\u041c\u043e\u0434\u0435\u043b\u0438 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b', 'success');
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
          if (data.state.chats) openAiImageState.chats = data.state.chats;
        } else if (data.settings) {
          syncSharedOpenAiSettings(data.settings);
          aiBotState = { ...aiBotState, settings: aiBotState.settings };
        }
        if (selectedAiBotId && !aiBotState.bots.some(bot => Number(bot.id) === Number(selectedAiBotId))) {
          selectedAiBotId = null;
        }
        composerStateController.mentionTargetsByChat.clear();
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
        composerStateController.mentionTargetsByChat.clear();
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
                <small>@${esc(bot.mention)} \u00b7 ${bot.enabled ? 'enabled' : 'disabled'}</small>
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
          label.title = hasSavedBot ? '\u0421\u043c\u0435\u043d\u0438\u0442\u044c \u0430\u0432\u0430\u0442\u0430\u0440' : '\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 \u0431\u043e\u0442\u0430';
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
              '\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435.',
              detailLine,
            ].filter(Boolean).join('\n'),
          };
        }
        return {
          type: 'error',
          message: [
            savedLabel,
            '\u0421\u0435\u0440\u0432\u0435\u0440 \u0432\u0435\u0440\u043d\u0443\u043b \u043e\u0442\u043b\u0438\u0447\u0430\u044e\u0449\u0438\u0435\u0441\u044f \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044f. \u0424\u043e\u0440\u043c\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0430 \u043f\u043e \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u043e\u043c\u0443 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u044e.',
            verification.mismatches.length ? `\u041f\u043e\u043b\u044f: ${verification.mismatches.join(', ')}` : '',
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
        $('#aiBotStyle').value = bot?.style || '\u041f\u043e\u043b\u0435\u0437\u043d\u044b\u0439 AI-\u043f\u043e\u043c\u043e\u0449\u043d\u0438\u043a \u0434\u043b\u044f \u0447\u0430\u0442\u0430';
        $('#aiBotTone').value = bot?.tone || '\u0442\u0451\u043f\u043b\u044b\u0439, \u0432\u043d\u0438\u043c\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0439, \u043a\u0440\u0430\u0442\u043a\u0438\u0439';
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
          list.innerHTML = '<div class="ai-bot-empty">\u0411\u043e\u0442\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442. \u0421\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u0431\u043e\u0442\u0430.</div>';
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
                <small>@${esc(bot.mention)} \u00b7 ${bot.enabled ? 'enabled' : 'disabled'}</small>
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
          ? `\u041a\u043b\u044e\u0447 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d: ${settings.masked_openai_key || '***'}`
          : '\u041a\u043b\u044e\u0447 \u043d\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d';
    
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
        renderOpenAiImageSettings();
        loadAiModelOptions(false).catch((e) => {
          setAiModelStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0441\u043f\u0438\u0441\u043e\u043a \u043c\u043e\u0434\u0435\u043b\u0435\u0439', 'error');
        });
      }
    
      async function saveAiBotSettings() {
        setAiBotSettingsStatus('\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e...');
        try {
          await persistAiBotSettings();
          await loadAiModelOptions(true).catch(() => {});
          renderAiBotSettings();
          renderOpenAiUniversalSettings();
          renderOpenAiImageSettings();
          setAiBotSettingsStatus(`\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b\n${providerInteractiveSummary('openai', aiBotState.settings)}`, 'success');
        } catch (e) {
          setAiBotSettingsStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438', 'error');
        }
      }
    
      async function deleteAiBotKey() {
        if (!confirm('\u0423\u0434\u0430\u043b\u0438\u0442\u044c OpenAI API key \u0434\u043b\u044f AI-\u0431\u043e\u0442\u043e\u0432?')) return;
        try {
          const data = await api('/api/admin/ai-bots/openai-key', { method: 'DELETE' });
          mergeAiBotState(data);
          await loadAiModelOptions(true).catch(() => {});
          renderAiBotSettings();
          renderOpenAiUniversalSettings();
          renderOpenAiImageSettings();
          setAiBotSettingsStatus('\u041a\u043b\u044e\u0447 \u0443\u0434\u0430\u043b\u0451\u043d', 'success');
        } catch (e) {
          setAiBotSettingsStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043a\u043b\u044e\u0447', 'error');
        }
      }
    
      async function saveAiBot() {
        const payload = aiBotFormPayload();
        if (!payload.name) { setAiBotStatus('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043c\u044f \u0431\u043e\u0442\u0430', 'error'); return; }
        setAiBotStatus('\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e \u0431\u043e\u0442\u0430...');
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
          const status = buildVerifiedBotSaveStatus('\u0411\u043e\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d.', data.bot, payload, formatCapabilityState(data.bot || payload));
          setAiBotStatus(status.message, status.type);
        } catch (e) {
          setAiBotStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0431\u043e\u0442\u0430', 'error');
        }
      }
    
      async function uploadAiBotAvatar(file) {
        if (!file) return;
        if (!selectedAiBotId) {
          setAiBotStatus('\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 \u0431\u043e\u0442\u0430, \u043f\u043e\u0442\u043e\u043c \u0434\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0430\u0432\u0430\u0442\u0430\u0440', 'error');
          renderAiBotAvatar(null);
          return;
        }
        const fd = new FormData();
        fd.append('avatar', file);
        setAiBotStatus('\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e \u0430\u0432\u0430\u0442\u0430\u0440...');
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
          setAiBotStatus('\u0410\u0432\u0430\u0442\u0430\u0440 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d', 'success');
        } catch (e) {
          setAiBotStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0430\u0432\u0430\u0442\u0430\u0440', 'error');
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
          setAiBotStatus('\u0410\u0432\u0430\u0442\u0430\u0440 \u0443\u0434\u0430\u043b\u0451\u043d', 'success');
        } catch (e) {
          setAiBotStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0430\u0432\u0430\u0442\u0430\u0440', 'error');
        }
      }
    
      async function disableAiBot() {
        if (!selectedAiBotId) return;
        if (!confirm('\u041e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u044d\u0442\u043e\u0433\u043e \u0431\u043e\u0442\u0430 \u0432\u043e \u0432\u0441\u0435\u0445 \u0447\u0430\u0442\u0430\u0445?')) return;
        try {
          const data = await api(`/api/admin/ai-bots/${selectedAiBotId}`, { method: 'DELETE' });
          mergeAiBotState(data);
          renderAiBotSettings();
          setAiBotStatus('\u0411\u043e\u0442 \u043e\u0442\u043a\u043b\u044e\u0447\u0451\u043d', 'success');
        } catch (e) {
          setAiBotStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0431\u043e\u0442\u0430', 'error');
        }
      }
    
      async function testAiBot() {
        if (!selectedAiBotId) { setAiBotStatus('\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 \u0431\u043e\u0442\u0430', 'error'); return; }
        setAiBotStatus('\u041f\u0440\u043e\u0432\u0435\u0440\u044f\u044e \u043c\u043e\u0434\u0435\u043b\u044c...');
        try {
          const data = await api(`/api/admin/ai-bots/${selectedAiBotId}/test`, { method: 'POST', body: {} });
          const text = data.result?.text ? data.result.text.slice(0, 500) : '';
          setAiBotStatus(`\u0423\u0441\u043f\u0435\u0448\u043d\u043e (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
        } catch (e) {
          setAiBotStatus(e.message || '\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u043d\u0435 \u0443\u0434\u0430\u043b\u0430\u0441\u044c', 'error');
        }
      }
    
      function filenameFromContentDisposition(header, fallback) {
        const match = String(header || '').match(/filename="?([^";]+)"?/i);
        return match ? match[1] : fallback;
      }
    
      async function exportAiBotJson() {
        if (!selectedAiBotId) { setAiBotStatus('\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u043e\u0433\u043e \u0431\u043e\u0442\u0430', 'error'); return; }
        setAiBotStatus('\u0413\u043e\u0442\u043e\u0432\u043b\u044e JSON...');
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
          setAiBotStatus('JSON \u0432\u044b\u0433\u0440\u0443\u0436\u0435\u043d', 'success');
        } catch (e) {
          setAiBotStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u0433\u0440\u0443\u0437\u0438\u0442\u044c JSON', 'error');
        }
      }
    
      async function importAiBotJsonFile(file) {
        if (!file) return;
        setAiBotStatus('\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e JSON...');
        try {
          const raw = await file.text();
          const payload = JSON.parse(raw);
          const data = await api('/api/admin/ai-bots/import', { method: 'POST', body: payload });
          mergeAiBotState(data);
          selectedAiBotId = data.bot?.id || selectedAiBotId;
          renderAiBotSettings();
          const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
          setAiBotStatus(`\u0411\u043e\u0442 \u0438\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u043d.${warnings}`, warnings ? 'error' : 'success');
        } catch (e) {
          setAiBotStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c JSON', 'error');
        } finally {
          const input = $('#aiBotImportFile');
          if (input) input.value = '';
        }
      }
    
      async function saveAiChatBotSettings() {
        const chatId = Number($('#aiBotChatSelect')?.value || 0);
        const botId = Number($('#aiBotChatBotSelect')?.value || 0);
        const botExists = aiBotState.bots.some(bot => Number(bot.id) === botId);
        if (!chatId || !botId) { setAiBotChatStatus('\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0447\u0430\u0442 \u0438 \u0431\u043e\u0442\u0430', 'error'); return; }
        if (!botExists) {
          setAiBotChatStatus('\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 \u0431\u043e\u0442\u0430', 'error');
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
          setAiBotChatStatus('\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0447\u0430\u0442\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b', 'success');
        } catch (e) {
          setAiBotChatStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0447\u0430\u0442\u0430', 'error');
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
    
      function setOpenAiImageModalStatus(message, type = '') {
        setOpenAiStatus('openAiImageStatus', message, type);
      }
    
      function setOpenAiImageStatus(message, type = '') {
        setOpenAiStatus(['openAiImageBotEditorStatus', 'openAiImageBotEditorStatusBottom'], message, type);
      }
    
      function setOpenAiImageChatStatus(message, type = '') {
        setOpenAiStatus('openAiImageBotChatStatus', message, type);
      }
    
      function mergeOpenAiImageState(data = {}) {
        const state = data.state || data;
        if (state.settings) syncSharedOpenAiSettings(state.settings);
        if (state.bots) openAiImageState.bots = state.bots;
        if (state.chats) openAiImageState.chats = state.chats;
        if (state.chatSettings) openAiImageState.chatSettings = state.chatSettings;
        if (state.models) {
          openAiImageState.models = { ...openAiImageState.models, ...state.models };
          if (Array.isArray(state.models.image) && state.models.image.length) {
            aiModelCatalog.image = state.models.image;
          }
        }
        openAiImageState.settings = aiBotState.settings;
        if (selectedOpenAiImageBotId && !openAiImageState.bots.some(bot => Number(bot.id) === Number(selectedOpenAiImageBotId))) {
          selectedOpenAiImageBotId = null;
        }
        composerStateController.mentionTargetsByChat.clear();
        updateComposerAiOverrideState().catch(() => {});
      }
    
      function currentOpenAiImageBot() {
        return openAiImageState.bots.find(bot => Number(bot.id) === Number(selectedOpenAiImageBotId)) || null;
      }
    
      function getOpenAiImageChatSetting(chatId, botId) {
        return openAiImageState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
      }
    
      function renderOpenAiImageModelOptions(bot = currentOpenAiImageBot()) {
        const settings = openAiImageState.settings || aiBotState.settings || {};
        const models = openAiImageState.models || {};
        const imageModels = models.image || aiModelCatalog.image || ['gpt-image-2'];
        setAiModelSelectOptions('openAiImageBotModel', imageModels, bot?.image_model || settings.openai_default_image_model || 'gpt-image-2');
        setStaticSelectOptions('openAiImageBotImageSize', models.image_size || OPENAI_IMAGE_SIZE_OPTIONS, bot?.image_resolution || settings.openai_default_image_size || '1024x1024');
        setStaticSelectOptions('openAiImageBotImageQuality', models.image_quality || OPENAI_IMAGE_QUALITY_OPTIONS, bot?.image_quality || settings.openai_default_image_quality || 'auto');
        setStaticSelectOptions('openAiImageBotImageBackground', models.image_background || OPENAI_IMAGE_BACKGROUND_OPTIONS, bot?.image_background || settings.openai_default_image_background || 'auto');
        setStaticSelectOptions('openAiImageBotImageOutputFormat', models.image_output_format || OPENAI_IMAGE_OUTPUT_OPTIONS, bot?.image_output_format || settings.openai_default_image_output_format || 'png');
      }
    
      function renderOpenAiImageBotAvatar(bot = currentOpenAiImageBot()) {
        const avatarEl = $('#openAiImageBotAvatar');
        if (!avatarEl) return;
        const name = bot?.name || $('#openAiImageBotName')?.value.trim() || 'OpenAI Images';
        const color = bot?.avatar_color || '#65aadd';
        avatarEl.style.background = color;
        if (bot?.avatar_url) {
          avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
        } else {
          avatarEl.textContent = initials(name);
        }
    
        const hasSavedBot = Boolean(bot?.id);
        const input = $('#openAiImageBotAvatarInput');
        const label = $('#openAiImageBotAvatarLabel');
        if (input) {
          input.disabled = !hasSavedBot;
          input.value = '';
        }
        if (label) {
          label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
          label.title = hasSavedBot ? 'Change avatar' : 'Save the bot first';
        }
        $('#removeOpenAiImageBotAvatar')?.classList.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
      }
    
      function renderOpenAiImageBotList() {
        const list = $('#openAiImageBotList');
        if (!list) return;
        if (!openAiImageState.bots.length) {
          list.innerHTML = '<div class="ai-bot-empty">No OpenAI image bots yet. Create the first one.</div>';
          return;
        }
        list.innerHTML = openAiImageState.bots.map(bot => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedOpenAiImageBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
            <span class="ai-bot-list-main">
              <span class="ai-bot-list-avatar" style="background:${esc(bot.avatar_color || '#65aadd')}">
                ${bot.avatar_url ? `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">` : esc(initials(bot.name || '?'))}
              </span>
              <span class="ai-bot-list-copy">
                <strong>${esc(bot.name)}</strong>
                <small>@${esc(bot.mention)} \u0412\u00b7 ${bot.enabled ? 'enabled' : 'disabled'}</small>
              </span>
            </span>
            <span class="ai-bot-list-model">${bot.image_model ? esc(bot.image_model) : ''}</span>
          </button>
        `).join('');
      }
    
      function fillOpenAiImageBotForm(bot = null) {
        selectedOpenAiImageBotId = bot ? bot.id : null;
        $('#openAiImageBotName').value = bot?.name || 'OpenAI Images';
        $('#openAiImageBotMention').value = bot?.mention || 'openai_image';
        $('#openAiImageBotEnabled').checked = bot ? !!bot.enabled : true;
        setBotVisibilityToggle('openAiImageBotVisibleToUsers', !!bot?.visible_to_users);
        $('#openAiImageBotAllowImageGenerate').checked = bot?.allow_image_generate ?? true;
        $('#openAiImageBotAllowImageEdit').checked = bot?.allow_image_edit ?? true;
        renderOpenAiImageModelOptions(bot);
        renderOpenAiImageBotAvatar(bot);
        renderOpenAiImageBotList();
        renderOpenAiImageChatBotSettings();
      }
    
      function openAiImageBotFormPayload() {
        return {
          kind: 'image',
          name: $('#openAiImageBotName')?.value.trim(),
          mention: $('#openAiImageBotMention')?.value.trim(),
          enabled: $('#openAiImageBotEnabled')?.checked,
          visible_to_users: getBotVisibilityToggle('openAiImageBotVisibleToUsers'),
          image_model: $('#openAiImageBotModel')?.value.trim(),
          image_resolution: $('#openAiImageBotImageSize')?.value.trim(),
          image_quality: $('#openAiImageBotImageQuality')?.value.trim(),
          image_background: $('#openAiImageBotImageBackground')?.value.trim(),
          image_output_format: $('#openAiImageBotImageOutputFormat')?.value.trim(),
          allow_image_generate: $('#openAiImageBotAllowImageGenerate')?.checked,
          allow_image_edit: $('#openAiImageBotAllowImageEdit')?.checked,
        };
      }
    
      function renderOpenAiImageChatBotSettings() {
        const chatSelect = $('#openAiImageBotChatSelect');
        const botSelect = $('#openAiImageBotChatBotSelect');
        if (!chatSelect || !botSelect) return;
        const currentChatValue = chatSelect.value || String(currentChatId || openAiImageState.chats[0]?.id || '');
        const currentBotValue = botSelect.value || String(selectedOpenAiImageBotId || openAiImageState.bots[0]?.id || '');
        chatSelect.innerHTML = openAiImageState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
        botSelect.innerHTML = openAiImageState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
        if (openAiImageState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
        if (openAiImageState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
        if (!botSelect.value && openAiImageState.bots[0]) botSelect.value = String(openAiImageState.bots[0].id);
        const setting = getOpenAiImageChatSetting(chatSelect.value, botSelect.value);
        $('#openAiImageBotChatEnabled').checked = !!setting?.enabled;
      }
    
      function renderOpenAiImageSettings() {
        const selected = currentOpenAiImageBot() || openAiImageState.bots[0] || null;
        fillOpenAiImageBotForm(selected);
        renderOpenAiImageChatBotSettings();
      }
    
      async function loadOpenAiImageState() {
        const data = await api('/api/admin/openai-image-bots');
        mergeOpenAiImageState({ state: data });
        renderOpenAiImageSettings();
        return data;
      }
    
      function syncOpenAiImageBotUser(bot) {
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
    
      async function saveOpenAiImageBot() {
        const payload = openAiImageBotFormPayload();
        if (!payload.name) { setOpenAiImageStatus('Enter image bot name', 'error'); return; }
        setOpenAiImageStatus('Saving OpenAI image bot...', 'pending');
        try {
          const shouldUpdate = Boolean(selectedOpenAiImageBotId && openAiImageState.bots.some(bot => Number(bot.id) === Number(selectedOpenAiImageBotId)));
          const url = shouldUpdate ? `/api/admin/openai-image-bots/${selectedOpenAiImageBotId}` : '/api/admin/openai-image-bots';
          const method = shouldUpdate ? 'PUT' : 'POST';
          const data = await api(url, { method, body: payload });
          mergeOpenAiImageState(data);
          selectedOpenAiImageBotId = data.bot?.id || selectedOpenAiImageBotId;
          syncOpenAiImageBotUser(data.bot);
          renderOpenAiImageSettings();
          const status = buildVerifiedBotSaveStatus('Image bot saved.', data.bot, payload);
          setOpenAiImageStatus(status.message, status.type);
        } catch (e) {
          setOpenAiImageStatus(e.message || 'Could not save OpenAI image bot', 'error');
        }
      }
    
      async function uploadOpenAiImageBotAvatar(file) {
        if (!file) return;
        if (!selectedOpenAiImageBotId) {
          setOpenAiImageStatus('Save the bot before adding an avatar', 'error');
          renderOpenAiImageBotAvatar(null);
          return;
        }
        const fd = new FormData();
        fd.append('avatar', file);
        setOpenAiImageStatus('Uploading avatar...', 'pending');
        try {
          const data = await api(`/api/admin/openai-image-bots/${selectedOpenAiImageBotId}/avatar`, { method: 'POST', body: fd });
          mergeOpenAiImageState(data);
          selectedOpenAiImageBotId = data.bot?.id || selectedOpenAiImageBotId;
          syncOpenAiImageBotUser(data.bot);
          renderOpenAiImageSettings();
          refreshRenderedAiBotAvatar(data.bot);
          setOpenAiImageStatus('Avatar saved', 'success');
        } catch (e) {
          setOpenAiImageStatus(e.message || 'Could not upload avatar', 'error');
        }
      }
    
      async function removeOpenAiImageBotAvatar() {
        if (!selectedOpenAiImageBotId) return;
        try {
          const data = await api(`/api/admin/openai-image-bots/${selectedOpenAiImageBotId}/avatar`, { method: 'DELETE' });
          mergeOpenAiImageState(data);
          selectedOpenAiImageBotId = data.bot?.id || selectedOpenAiImageBotId;
          syncOpenAiImageBotUser(data.bot);
          renderOpenAiImageSettings();
          refreshRenderedAiBotAvatar(data.bot);
          setOpenAiImageStatus('Avatar removed', 'success');
        } catch (e) {
          setOpenAiImageStatus(e.message || 'Could not remove avatar', 'error');
        }
      }
    
      async function disableOpenAiImageBot() {
        if (!selectedOpenAiImageBotId) return;
        if (!confirm('Disable this OpenAI image bot in all chats?')) return;
        try {
          const data = await api(`/api/admin/openai-image-bots/${selectedOpenAiImageBotId}`, { method: 'DELETE' });
          mergeOpenAiImageState(data);
          renderOpenAiImageSettings();
          setOpenAiImageStatus('Image bot disabled', 'success');
        } catch (e) {
          setOpenAiImageStatus(e.message || 'Could not disable image bot', 'error');
        }
      }
    
      async function testOpenAiImageBot() {
        if (!selectedOpenAiImageBotId) { setOpenAiImageStatus('Save the bot first', 'error'); return; }
        setOpenAiImageStatus('Testing image bot...', 'pending');
        try {
          const data = await api(`/api/admin/openai-image-bots/${selectedOpenAiImageBotId}/test`, { method: 'POST', body: {} });
          const text = data.result?.text ? data.result.text.slice(0, 500) : '';
          setOpenAiImageStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
        } catch (e) {
          setOpenAiImageStatus(e.message || 'Image bot test failed', 'error');
        }
      }
    
      async function exportOpenAiImageBotJson() {
        if (!selectedOpenAiImageBotId) { setOpenAiImageStatus('Choose a saved bot first', 'error'); return; }
        setOpenAiImageStatus('Preparing JSON...', 'pending');
        try {
          const headers = {};
          if (token) headers.Authorization = 'Bearer ' + token;
          const res = await fetch(`/api/admin/openai-image-bots/${selectedOpenAiImageBotId}/export`, { headers });
          if (!res.ok) {
            let data = {};
            try { data = await res.json(); } catch {}
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          const blob = await res.blob();
          const bot = currentOpenAiImageBot();
          const fallbackName = `bananza-openai-image-${bot?.mention || selectedOpenAiImageBotId}.json`;
          const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          setOpenAiImageStatus('JSON exported', 'success');
        } catch (e) {
          setOpenAiImageStatus(e.message || 'Could not export JSON', 'error');
        }
      }
    
      async function importOpenAiImageBotJsonFile(file) {
        if (!file) return;
        setOpenAiImageStatus('Importing JSON...', 'pending');
        try {
          const raw = await file.text();
          const payload = JSON.parse(raw);
          const data = await api('/api/admin/openai-image-bots/import', { method: 'POST', body: payload });
          mergeOpenAiImageState(data);
          selectedOpenAiImageBotId = data.bot?.id || selectedOpenAiImageBotId;
          renderOpenAiImageSettings();
          const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
          setOpenAiImageStatus(`Image bot imported.${warnings}`, warnings ? 'error' : 'success');
        } catch (e) {
          setOpenAiImageStatus(e.message || 'Could not import JSON', 'error');
        } finally {
          const input = $('#openAiImageBotImportFile');
          if (input) input.value = '';
        }
      }
    
      async function saveOpenAiImageChatBotSettings() {
        const chatId = Number($('#openAiImageBotChatSelect')?.value || 0);
        const botId = Number($('#openAiImageBotChatBotSelect')?.value || 0);
        const botExists = openAiImageState.bots.some(bot => Number(bot.id) === Number(botId));
        if (!chatId || !botId) { setOpenAiImageChatStatus('Choose chat and image bot', 'error'); return; }
        if (!botExists) {
          setOpenAiImageChatStatus('Save the image bot first', 'error');
          await loadOpenAiImageState().catch(() => {});
          return;
        }
        try {
          const data = await api('/api/admin/openai-image-bots/chat-settings', {
            method: 'PUT',
            body: {
              chatId,
              botId,
              enabled: $('#openAiImageBotChatEnabled')?.checked,
              mode: 'simple',
              hot_context_limit: 50,
            },
          });
          mergeOpenAiImageState(data);
          renderOpenAiImageChatBotSettings();
          setOpenAiImageChatStatus('Image bot chat settings saved', 'success');
        } catch (e) {
          setOpenAiImageChatStatus(e.message || 'Could not save image bot chat settings', 'error');
        }
      }
    
      function setDeepseekAiStatus(message, type = '') {
        setInlineStatus('deepseekAiStatus', message, type);
      }
    
      function setDeepseekAiProviderStatus(message, type = '') {
        setInlineStatus('deepseekAiProviderStatus', message, type);
      }
    
      function setDeepseekAiBalanceStatus(message, type = '') {
        setInlineStatus('deepseekAiBalanceStatus', message, type);
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
        composerStateController.mentionTargetsByChat.clear();
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
                <small>@${esc(bot.mention)} \u00b7 ${bot.enabled ? 'enabled' : 'disabled'}</small>
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
        $('#deepseekAiRequestTimeoutSeconds').value = Math.round(Number(settings.deepseek_request_timeout_ms || 600000) / 1000);
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
          deepseek_request_timeout_ms: Number($('#deepseekAiRequestTimeoutSeconds')?.value || 600) * 1000,
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
    
      function formatDeepseekBalanceValue(value) {
        const text = String(value ?? '').trim();
        return text || '0.00';
      }
    
      function formatDeepseekBalanceResult(balance = {}) {
        const latency = Number(balance.latencyMs);
        const latencyText = Number.isFinite(latency) ? ` (${Math.round(latency)} ms)` : '';
        const availability = balance.is_available ? 'API calls available' : 'API calls unavailable';
        const rows = Array.isArray(balance.balance_infos) ? balance.balance_infos : [];
        const balanceLines = rows.length
          ? rows.map((row) => {
            const currency = String(row?.currency || 'Unknown').trim() || 'Unknown';
            return `${currency}: total ${formatDeepseekBalanceValue(row?.total_balance)}, granted ${formatDeepseekBalanceValue(row?.granted_balance)}, topped up ${formatDeepseekBalanceValue(row?.topped_up_balance)}`;
          })
          : ['No balance entries returned.'];
        return `${availability}${latencyText}\n${balanceLines.join('\n')}`;
      }
    
      async function checkDeepseekAiBalance() {
        const keyInput = $('#deepseekAiApiKey');
        const hasKey = Boolean(keyInput?.value.trim() || deepseekBotState.settings?.has_deepseek_key);
        if (!hasKey) {
          setDeepseekAiBalanceStatus('Enter or save DeepSeek API key before checking balance.', 'error');
          keyInput?.focus();
          return;
        }
        setDeepseekAiBalanceStatus('Checking DeepSeek balance...', 'pending');
        try {
          const data = await api('/api/admin/deepseek-ai-bots/balance', {
            method: 'POST',
            body: deepseekAiSettingsPayload(),
          });
          setDeepseekAiBalanceStatus(
            formatDeepseekBalanceResult(data.balance || {}),
            data.balance?.is_available ? 'success' : 'error'
          );
        } catch (e) {
          setDeepseekAiBalanceStatus(formatUiErrorMessage(e, 'Could not load DeepSeek balance'), 'error');
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
    
      function setQwenAiStatus(message, type = '') {
        setInlineStatus('qwenAiStatus', message, type);
      }
    
      function setQwenAiProviderStatus(message, type = '') {
        setInlineStatus('qwenAiProviderStatus', message, type);
      }
    
      function setQwenBotStatus(message, type = '') {
        setInlineStatus('qwenAiBotEditorStatus', message, type);
      }
    
      function setQwenChatStatus(message, type = '') {
        setInlineStatus('qwenAiBotChatStatus', message, type);
      }
    
      function setQwenAiModelStatus(message, type = '') {
        setInlineStatus('qwenAiModelStatus', message, type);
      }
    
      function currentQwenBot() {
        return qwenBotState.bots.find(bot => Number(bot.id) === Number(selectedQwenBotId)) || null;
      }
    
      function getQwenChatSetting(chatId, botId) {
        return qwenBotState.chatSettings.find(item => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
      }
    
      function mergeQwenAiState(data = {}) {
        const state = data.state || data;
        if (state.settings) qwenBotState.settings = { ...qwenBotState.settings, ...state.settings };
        if (state.bots) qwenBotState.bots = state.bots;
        if (state.chats) qwenBotState.chats = state.chats;
        if (state.chatSettings) qwenBotState.chatSettings = state.chatSettings;
        if (state.models) qwenBotState.models = { ...qwenBotState.models, ...state.models };
        if (selectedQwenBotId && !qwenBotState.bots.some(bot => Number(bot.id) === Number(selectedQwenBotId))) {
          selectedQwenBotId = null;
        }
        composerStateController.mentionTargetsByChat.clear();
      }
    
      function renderQwenModelOptions(bot = currentQwenBot()) {
        const settings = qwenBotState.settings || {};
        const models = qwenBotState.models || {};
        const responseModels = models.response || ['qwen'];
        const summaryModels = models.summary || responseModels;
        setAiModelSelectOptions('qwenAiDefaultResponseModel', responseModels, settings.qwen_default_response_model || 'qwen');
        setAiModelSelectOptions('qwenAiDefaultSummaryModel', summaryModels, settings.qwen_default_summary_model || 'qwen');
        setAiModelSelectOptions('qwenAiBotResponseModel', responseModels, bot?.response_model || settings.qwen_default_response_model || 'qwen');
        setAiModelSelectOptions('qwenAiBotSummaryModel', summaryModels, bot?.summary_model || settings.qwen_default_summary_model || 'qwen');
      }
    
      function renderQwenBotAvatar(bot = currentQwenBot()) {
        const avatarEl = $('#qwenAiBotAvatar');
        if (!avatarEl) return;
        const name = bot?.name || $('#qwenAiBotName')?.value.trim() || 'Qwen AI';
        const color = bot?.avatar_color || '#65aadd';
        avatarEl.style.background = color;
        if (bot?.avatar_url) {
          avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
        } else {
          avatarEl.textContent = initials(name);
        }
    
        const hasSavedBot = Boolean(bot?.id);
        const input = $('#qwenAiBotAvatarInput');
        const label = $('#qwenAiBotAvatarLabel');
        if (input) {
          input.disabled = !hasSavedBot;
          input.value = '';
        }
        if (label) {
          label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
          label.title = hasSavedBot ? 'Change avatar' : 'Save the bot first';
        }
        $('#removeQwenAiBotAvatar')?.classList.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
      }
    
      function fillQwenBotForm(bot = null) {
        const settings = qwenBotState.settings || {};
        selectedQwenBotId = bot ? bot.id : null;
        $('#qwenAiBotName').value = bot?.name || 'Qwen AI';
        $('#qwenAiBotMention').value = bot?.mention || 'qwen';
        $('#qwenAiBotEnabled').checked = bot ? !!bot.enabled : true;
        setBotVisibilityToggle('qwenAiBotVisibleToUsers', !!bot?.visible_to_users);
        $('#qwenAiBotResponseModel').value = bot?.response_model || settings.qwen_default_response_model || 'qwen';
        $('#qwenAiBotSummaryModel').value = bot?.summary_model || settings.qwen_default_summary_model || 'qwen';
        $('#qwenAiBotTemperature').value = bot?.temperature ?? settings.qwen_temperature ?? 0.3;
        $('#qwenAiBotMaxTokens').value = bot?.max_tokens ?? settings.qwen_max_tokens ?? 1000;
        $('#qwenAiBotStyle').value = bot?.style || 'Helpful Qwen assistant for chat';
        $('#qwenAiBotTone').value = bot?.tone || 'warm, concise, attentive';
        $('#qwenAiBotRules').value = bot?.behavior_rules || '';
        $('#qwenAiBotSpeech').value = bot?.speech_patterns || '';
        renderQwenBotAvatar(bot);
        renderQwenModelOptions(bot);
        renderQwenBotList();
        renderQwenChatBotSettings();
      }
    
      function qwenBotFormPayload() {
        return {
          name: $('#qwenAiBotName')?.value.trim(),
          mention: $('#qwenAiBotMention')?.value.trim(),
          enabled: $('#qwenAiBotEnabled')?.checked,
          visible_to_users: getBotVisibilityToggle('qwenAiBotVisibleToUsers'),
          response_model: $('#qwenAiBotResponseModel')?.value.trim(),
          summary_model: $('#qwenAiBotSummaryModel')?.value.trim(),
          temperature: Number($('#qwenAiBotTemperature')?.value || 0.3),
          max_tokens: Number($('#qwenAiBotMaxTokens')?.value || 1000),
          style: $('#qwenAiBotStyle')?.value.trim(),
          tone: $('#qwenAiBotTone')?.value.trim(),
          behavior_rules: $('#qwenAiBotRules')?.value.trim(),
          speech_patterns: $('#qwenAiBotSpeech')?.value.trim(),
        };
      }
    
      function renderQwenBotList() {
        const list = $('#qwenAiBotList');
        if (!list) return;
        if (!qwenBotState.bots.length) {
          list.innerHTML = '<div class="ai-bot-empty">No Qwen bots yet. Create the first one.</div>';
          return;
        }
        list.innerHTML = qwenBotState.bots.map(bot => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === Number(selectedQwenBotId) ? ' active' : ''}" data-bot-id="${bot.id}">
            <span class="ai-bot-list-main">
              <span class="ai-bot-list-avatar" style="background:${esc(bot.avatar_color || '#65aadd')}">
                ${bot.avatar_url ? `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="" loading="lazy" onerror="this.remove()">` : esc(initials(bot.name || '?'))}
              </span>
              <span class="ai-bot-list-copy">
                <strong>${esc(bot.name)}</strong>
                <small>@${esc(bot.mention)} \u00b7 ${bot.enabled ? 'enabled' : 'disabled'}</small>
              </span>
            </span>
            <span class="ai-bot-list-model">${bot.response_model ? esc(bot.response_model) : ''}</span>
          </button>
        `).join('');
      }
    
      function renderQwenChatBotSettings() {
        const chatSelect = $('#qwenAiBotChatSelect');
        const botSelect = $('#qwenAiBotChatBotSelect');
        if (!chatSelect || !botSelect) return;
        const currentChatValue = chatSelect.value || String(currentChatId || qwenBotState.chats[0]?.id || '');
        const currentBotValue = botSelect.value || String(selectedQwenBotId || qwenBotState.bots[0]?.id || '');
    
        chatSelect.innerHTML = qwenBotState.chats.map(chat => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
        botSelect.innerHTML = qwenBotState.bots.map(bot => `<option value="${bot.id}">${esc(bot.name)} @${esc(bot.mention)}</option>`).join('');
        if (qwenBotState.chats.some(chat => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
        if (qwenBotState.bots.some(bot => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
        if (!botSelect.value && qwenBotState.bots[0]) botSelect.value = String(qwenBotState.bots[0].id);
    
        const setting = getQwenChatSetting(chatSelect.value, botSelect.value);
        $('#qwenAiBotChatEnabled').checked = !!setting?.enabled;
        $('#qwenAiBotChatMode').value = 'simple';
        $('#qwenAiBotChatHotLimit').value = setting?.hot_context_limit || 50;
        $('#qwenAiBotChatAutoReact').checked = !!setting?.auto_react_on_mention;
      }
    
      function renderQwenAiSettings() {
        const settings = qwenBotState.settings || {};
        $('#qwenAiGlobalEnabled').checked = !!settings.qwen_enabled;
        $('#qwenAiInteractiveEnabled').checked = !!settings.qwen_interactive_enabled;
        $('#qwenAiBaseUrl').value = settings.qwen_base_url || 'http://127.0.0.1:8000/v1';
        $('#qwenAiTemperature').value = settings.qwen_temperature ?? 0.3;
        $('#qwenAiMaxTokens').value = settings.qwen_max_tokens ?? 1000;
        $('#qwenAiRequestTimeoutSeconds').value = Math.round(Number(settings.qwen_request_timeout_ms || 600000) / 1000);
        $('#qwenAiApiKey').value = '';
        $('#qwenAiKeyStatus').textContent = settings.has_qwen_key
          ? `Key saved: ${settings.masked_qwen_key || '***'}`
          : 'Key is not saved';
        renderQwenModelOptions(currentQwenBot());
        $('#qwenAiDefaultResponseModel').value = settings.qwen_default_response_model || 'qwen';
        $('#qwenAiDefaultSummaryModel').value = settings.qwen_default_summary_model || 'qwen';
        const selected = currentQwenBot() || qwenBotState.bots[0] || null;
        fillQwenBotForm(selected);
        renderQwenChatBotSettings();
        const models = qwenBotState.models || {};
        if (models.error) {
          setQwenAiModelStatus(`Model list fallback is used: ${formatUiErrorMessage(models.error, 'Could not load Qwen models')}`, 'error');
        } else if (models.source === 'live') {
          setQwenAiModelStatus(`Loaded ${models.response?.length || 0} Qwen models for selectors.`, 'success');
        } else {
          setQwenAiModelStatus('Saved defaults are shown. Use "Refresh models" or "Test key" to load live Qwen models.');
        }
      }
    
      function qwenAiSettingsPayload() {
        const body = {
          qwen_enabled: $('#qwenAiGlobalEnabled')?.checked,
          qwen_interactive_enabled: $('#qwenAiInteractiveEnabled')?.checked,
          qwen_base_url: $('#qwenAiBaseUrl')?.value.trim(),
          qwen_default_response_model: $('#qwenAiDefaultResponseModel')?.value.trim(),
          qwen_default_summary_model: $('#qwenAiDefaultSummaryModel')?.value.trim(),
          qwen_temperature: Number($('#qwenAiTemperature')?.value || 0.3),
          qwen_max_tokens: Number($('#qwenAiMaxTokens')?.value || 1000),
          qwen_request_timeout_ms: Number($('#qwenAiRequestTimeoutSeconds')?.value || 600) * 1000,
        };
        const key = $('#qwenAiApiKey')?.value.trim();
        if (key) body.qwen_api_key = key;
        return body;
      }
    
      async function persistQwenAiSettings() {
        const data = await api('/api/admin/qwen-ai-bots/settings', {
          method: 'PUT',
          body: qwenAiSettingsPayload(),
        });
        mergeQwenAiState(data);
        return data;
      }
    
      async function loadQwenAiState() {
        const data = await api('/api/admin/qwen-ai-bots');
        mergeQwenAiState(data);
        renderQwenAiSettings();
      }
    
      async function saveQwenAiSettings() {
        setQwenAiProviderStatus('Saving...', 'pending');
        try {
          await persistQwenAiSettings();
          renderQwenAiSettings();
          setQwenAiProviderStatus(`Settings saved\n${providerInteractiveSummary('qwen', qwenBotState.settings)}`, 'success');
        } catch (e) {
          setQwenAiProviderStatus(e.message || 'Could not save settings', 'error');
        }
      }
    
      async function testQwenAiConnection() {
        const keyInput = $('#qwenAiApiKey');
        const hasKey = Boolean(keyInput?.value.trim() || qwenBotState.settings?.has_qwen_key);
        if (!hasKey) {
          setQwenAiProviderStatus('Enter Qwen API key before testing.', 'error');
          keyInput?.focus();
          return;
        }
        setQwenAiProviderStatus('Checking Qwen connection...', 'pending');
        try {
          const data = await api('/api/admin/qwen-ai-bots/test-connection', {
            method: 'POST',
            body: qwenAiSettingsPayload(),
          });
          await persistQwenAiSettings();
          if (data.state?.models) mergeQwenAiState({ state: { models: data.state.models } });
          renderQwenAiSettings();
          const text = String(data.result?.text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
          setQwenAiProviderStatus(`Key verified (${data.result?.latencyMs || 0} ms). ${text}`, 'success');
        } catch (e) {
          setQwenAiProviderStatus(formatUiErrorMessage(e, 'Could not check Qwen key'), 'error');
        }
      }
    
      async function refreshQwenAiModels() {
        const keyInput = $('#qwenAiApiKey');
        const hasKey = Boolean(keyInput?.value.trim() || qwenBotState.settings?.has_qwen_key);
        if (!hasKey) {
          setQwenAiProviderStatus('Enter or save Qwen API key before loading models.', 'error');
          keyInput?.focus();
          return;
        }
        setQwenAiProviderStatus('Loading Qwen models...', 'pending');
        try {
          const data = await api('/api/admin/qwen-ai-bots/models/refresh', {
            method: 'POST',
            body: qwenAiSettingsPayload(),
          });
          mergeQwenAiState(data);
          renderQwenAiSettings();
          setQwenAiProviderStatus(`Models refreshed: ${qwenBotState.models?.response?.length || 0}.`, 'success');
        } catch (e) {
          setQwenAiProviderStatus(formatUiErrorMessage(e, 'Could not load Qwen models'), 'error');
        }
      }
    
      async function deleteQwenAiKey() {
        if (!confirm('Delete Qwen API key for AI bots?')) return;
        try {
          const data = await api('/api/admin/qwen-ai-bots/key', { method: 'DELETE' });
          mergeQwenAiState(data);
          renderQwenAiSettings();
          setQwenAiProviderStatus('Key deleted', 'success');
        } catch (e) {
          setQwenAiProviderStatus(e.message || 'Could not delete key', 'error');
        }
      }
    
      async function saveQwenBot() {
        const payload = qwenBotFormPayload();
        if (!payload.name) { setQwenBotStatus('Enter bot name', 'error'); return; }
        setQwenBotStatus('Saving bot...', 'pending');
        try {
          await persistQwenAiSettings();
          const shouldUpdate = Boolean(selectedQwenBotId && qwenBotState.bots.some(bot => Number(bot.id) === Number(selectedQwenBotId)));
          const url = shouldUpdate ? `/api/admin/qwen-ai-bots/${selectedQwenBotId}` : '/api/admin/qwen-ai-bots';
          const method = shouldUpdate ? 'PUT' : 'POST';
          const data = await api(url, { method, body: payload });
          mergeQwenAiState(data);
          selectedQwenBotId = data.bot?.id || selectedQwenBotId;
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
          renderQwenAiSettings();
          const status = buildVerifiedBotSaveStatus('Bot saved.', data.bot, payload, formatCapabilityState(data.bot || payload));
          setQwenBotStatus(status.message, status.type);
        } catch (e) {
          setQwenBotStatus(e.message || 'Could not save bot', 'error');
        }
      }
    
      async function uploadQwenBotAvatar(file) {
        if (!file) return;
        if (!selectedQwenBotId) {
          setQwenBotStatus('Save the bot before adding an avatar', 'error');
          renderQwenBotAvatar(null);
          return;
        }
        const fd = new FormData();
        fd.append('avatar', file);
        setQwenBotStatus('Uploading avatar...', 'pending');
        try {
          const data = await api(`/api/admin/qwen-ai-bots/${selectedQwenBotId}/avatar`, { method: 'POST', body: fd });
          mergeQwenAiState(data);
          selectedQwenBotId = data.bot?.id || selectedQwenBotId;
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
          renderQwenBotList();
          renderQwenBotAvatar(currentQwenBot());
          refreshRenderedAiBotAvatar(data.bot);
          renderQwenChatBotSettings();
          setQwenBotStatus('Avatar saved', 'success');
        } catch (e) {
          setQwenBotStatus(e.message || 'Could not upload avatar', 'error');
          renderQwenBotAvatar(currentQwenBot());
        }
      }
    
      async function removeQwenBotAvatar() {
        if (!selectedQwenBotId) return;
        try {
          const data = await api(`/api/admin/qwen-ai-bots/${selectedQwenBotId}/avatar`, { method: 'DELETE' });
          mergeQwenAiState(data);
          selectedQwenBotId = data.bot?.id || selectedQwenBotId;
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
          renderQwenBotList();
          renderQwenBotAvatar(currentQwenBot());
          refreshRenderedAiBotAvatar(data.bot);
          renderQwenChatBotSettings();
          setQwenBotStatus('Avatar removed', 'success');
        } catch (e) {
          setQwenBotStatus(e.message || 'Could not remove avatar', 'error');
        }
      }
    
      async function disableQwenBot() {
        if (!selectedQwenBotId) return;
        if (!confirm('Disable this Qwen bot in all chats?')) return;
        try {
          const data = await api(`/api/admin/qwen-ai-bots/${selectedQwenBotId}`, { method: 'DELETE' });
          mergeQwenAiState(data);
          renderQwenAiSettings();
          setQwenBotStatus('Bot disabled', 'success');
        } catch (e) {
          setQwenBotStatus(e.message || 'Could not disable bot', 'error');
        }
      }
    
      async function testQwenBot() {
        if (!selectedQwenBotId) { setQwenBotStatus('Save the bot first', 'error'); return; }
        setQwenBotStatus('Testing model...', 'pending');
        try {
          await persistQwenAiSettings();
          const data = await api(`/api/admin/qwen-ai-bots/${selectedQwenBotId}/test`, { method: 'POST', body: {} });
          const text = data.result?.text ? data.result.text.slice(0, 500) : '';
          setQwenBotStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
        } catch (e) {
          setQwenBotStatus(e.message || 'Test failed', 'error');
        }
      }
    
      async function exportQwenBotJson() {
        if (!selectedQwenBotId) { setQwenBotStatus('Choose a saved bot first', 'error'); return; }
        setQwenBotStatus('Preparing JSON...', 'pending');
        try {
          const headers = {};
          if (token) headers.Authorization = 'Bearer ' + token;
          const res = await fetch(`/api/admin/qwen-ai-bots/${selectedQwenBotId}/export`, { headers });
          if (!res.ok) {
            let data = {};
            try { data = await res.json(); } catch {}
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          const blob = await res.blob();
          const bot = currentQwenBot();
          const fallbackName = `bananza-qwen-bot-${bot?.mention || selectedQwenBotId}.json`;
          const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          setQwenBotStatus('JSON exported', 'success');
        } catch (e) {
          setQwenBotStatus(e.message || 'Could not export JSON', 'error');
        }
      }
    
      async function importQwenBotJsonFile(file) {
        if (!file) return;
        setQwenBotStatus('Importing JSON...', 'pending');
        try {
          const raw = await file.text();
          const payload = JSON.parse(raw);
          const data = await api('/api/admin/qwen-ai-bots/import', { method: 'POST', body: payload });
          mergeQwenAiState(data);
          selectedQwenBotId = data.bot?.id || selectedQwenBotId;
          renderQwenAiSettings();
          const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
          setQwenBotStatus(`Bot imported.${warnings}`, warnings ? 'error' : 'success');
        } catch (e) {
          setQwenBotStatus(e.message || 'Could not import JSON', 'error');
        } finally {
          const input = $('#qwenAiBotImportFile');
          if (input) input.value = '';
        }
      }
    
      async function saveQwenChatBotSettings() {
        const chatId = Number($('#qwenAiBotChatSelect')?.value || 0);
        const botId = Number($('#qwenAiBotChatBotSelect')?.value || 0);
        const botExists = qwenBotState.bots.some(bot => Number(bot.id) === botId);
        if (!chatId || !botId) { setQwenChatStatus('Choose chat and bot', 'error'); return; }
        if (!botExists) {
          setQwenChatStatus('Save the bot first', 'error');
          await loadQwenAiState().catch(() => {});
          return;
        }
        try {
          await persistQwenAiSettings();
          const data = await api('/api/admin/qwen-ai-bots/chat-settings', {
            method: 'PUT',
            body: {
              chatId,
              botId,
              enabled: $('#qwenAiBotChatEnabled')?.checked,
              mode: 'simple',
              hot_context_limit: Number($('#qwenAiBotChatHotLimit')?.value || 50),
              auto_react_on_mention: $('#qwenAiBotChatAutoReact')?.checked,
            },
          });
          mergeQwenAiState(data);
          renderQwenChatBotSettings();
          setQwenChatStatus('Chat settings saved', 'success');
        } catch (e) {
          setQwenChatStatus(e.message || 'Could not save chat settings', 'error');
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
        if (value == null) return tx(fallback);
        if (typeof value === 'string') return tx(value.trim() || fallback);
        if (value instanceof Error) return formatUiErrorMessage(value.message, fallback);
        if (Array.isArray(value)) {
          const text = value.map((item) => formatUiErrorMessage(item, '')).filter(Boolean).join('; ');
          return tx(text || fallback);
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
          if (nested) return tx(nested);
          try {
            const text = JSON.stringify(value);
            return tx(text === '{}' ? fallback : text);
          } catch {
            return tx(fallback);
          }
        }
        return tx(String(value).trim() || fallback);
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
        composerStateController.mentionTargetsByChat.clear();
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
                <small>@${esc(bot.mention)} \u00b7 ${bot.enabled ? 'enabled' : 'disabled'}</small>
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
          setYandexAiModelStatus(settings.yandex_folder_id ? 'Static model fallback is shown. Press "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u043c\u043e\u0434\u0435\u043b\u0438" or "\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u043a\u043b\u044e\u0447" to load account models.' : '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u0434\u0435\u043d\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u043e\u0440 \u043a\u0430\u0442\u0430\u043b\u043e\u0433\u0430 \u0432 \u043f\u043e\u043b\u0435 Folder ID \u0432\u044b\u0448\u0435 \u043f\u0435\u0440\u0435\u0434 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u043e\u0439.');
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
          setYandexAiProviderStatus('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u0434\u0435\u043d\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u043e\u0440 \u043a\u0430\u0442\u0430\u043b\u043e\u0433\u0430 Yandex Cloud \u0432 \u043f\u043e\u043b\u0435 Folder ID.', 'error');
          setYandexAiModelStatus('Folder ID \u043d\u0443\u0436\u0435\u043d \u0434\u043b\u044f modelUri: gpt://<folder_ID>/yandexgpt/latest.', 'error');
          folderInput?.focus();
          return;
        }
        if (!hasKey) {
          setYandexAiProviderStatus('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 Yandex API key \u043f\u0435\u0440\u0435\u0434 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u043e\u0439.', 'error');
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
          const modelNote = models.source === 'live' ? ` \u041c\u043e\u0434\u0435\u043b\u0435\u0439 \u0432 \u0441\u0435\u043b\u0435\u043a\u0442\u043e\u0440\u0435: ${models.response?.length || 0}.` : '';
          setYandexAiProviderStatus(`\u041a\u043b\u044e\u0447 \u043f\u0440\u043e\u0432\u0435\u0440\u0435\u043d \u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d (${latency} ms). ${text}${modelNote}`, 'success');
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
          setYandexAiProviderStatus('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u0434\u0435\u043d\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u043e\u0440 \u043a\u0430\u0442\u0430\u043b\u043e\u0433\u0430 Yandex Cloud \u0432 \u043f\u043e\u043b\u0435 Folder ID.', 'error');
          folderInput?.focus();
          return;
        }
        if (!hasKey) {
          setYandexAiProviderStatus('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043b\u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 Yandex API key \u043f\u0435\u0440\u0435\u0434 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u043e\u0439 \u043c\u043e\u0434\u0435\u043b\u0435\u0439.', 'error');
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
          setYandexAiProviderStatus(`\u041c\u043e\u0434\u0435\u043b\u0438 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b: ${yandexBotState.models?.response?.length || 0} \u0432 \u0441\u0435\u043b\u0435\u043a\u0442\u043e\u0440\u0435.`, 'success');
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
        composerStateController.mentionTargetsByChat.clear();
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
        composerStateController.mentionTargetsByChat.clear();
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
                <small>@${esc(bot.mention)} \u00b7 ${bot.enabled ? 'enabled' : 'disabled'}</small>
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
                <small>@${esc(bot.mention)} \u00b7 ${bot.enabled ? 'enabled' : 'disabled'}</small>
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
                <small>@${esc(bot.mention)} \u00b7 ${bot.enabled ? 'enabled' : 'disabled'}</small>
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
        $('#grokAiImageBotRiskFilter').checked = bot?.image_risk_filter_enabled ?? true;
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
        $('#grokAiUniversalBotRiskFilter').checked = bot?.image_risk_filter_enabled ?? true;
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
          image_risk_filter_enabled: $('#grokAiImageBotRiskFilter')?.checked,
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
          image_risk_filter_enabled: $('#grokAiUniversalBotRiskFilter')?.checked,
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
        return chatListRenderer.chatItemAvatarHtml(chat);
      }
    
      async function loadHiddenChatSearch(query) {
        return chatListService.searchHiddenChats(query);
      }
    
      function scheduleHiddenChatSearch(query) {
        return chatListService.scheduleHiddenChatSearch(query);
      }
    
      async function openHiddenChatFromSearch(chatId) {
        return chatListService.openHiddenChatFromSearch(chatId);
      }
    
      async function openPrivateChatFromDirectory(userId) {
        const id = Number(userId || 0);
        if (!id) return;
        const chat = await api('/api/chats/private', { method: 'POST', body: { targetUserId: id } });
        await loadChats();
        await openChat(chat.id);
        setChatSearchOpen(false, { clear: true, focus: false });
        return chat;
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
        toast.textContent = tx(message);
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
    
      function getFolderPinnedChatMoveState(folderId, chatId) {
        const folder = chatFolderStore.getFolderById(folderId);
        const pinned = Array.isArray(folder?.pins) ? folder.pins : [];
        const index = pinned.findIndex((entry) => Number(entry.chat_id || 0) === Number(chatId || 0));
        return {
          index,
          total: pinned.length,
          canMoveUp: index > 0,
          canMoveDown: index >= 0 && index < pinned.length - 1,
        };
      }
    
      function renderFolderSelectableChatItem(chat, options = {}) { return folderUiController.renderFolderSelectableChatItem(chat, options); }
      function totalUnreadForFolder(folder) { return chatFolderStore.totalUnreadForFolder(folder, chats); }
      function visibleChatCountForFolder(folder) { return chatFolderStore.visibleChatCountForFolder(folder, chats); }
      function renderChatFolderPicker() { return folderUiController.renderChatFolderPicker(); }
      function positionChatFolderPicker() { return folderUiController.positionChatFolderPicker(); }
      function hideChatFolderContextMenu(options = {}) { return folderUiController.hideChatFolderContextMenu(options); }
      function renderChatFolderContextMenu(folder) { return folderUiController.renderChatFolderContextMenu(folder); }
      function positionChatFolderContextMenu() { return folderUiController.positionChatFolderContextMenu(); }
      function refreshChatFolderContextMenu(folderId) { return folderUiController.refreshChatFolderContextMenu(folderId); }
      function showChatFolderContextMenu(folderId, anchor) { return folderUiController.showChatFolderContextMenu(folderId, anchor); }
      function hideChatFolderPicker(options = {}) { return folderUiController.hideChatFolderPicker(options); }
      function showChatFolderPicker(opener = chatFoldersBtn) { return folderUiController.showChatFolderPicker(opener); }
      async function createChatFolder(name, chatIds = []) { return folderActionsController.createChatFolder(name, chatIds); }
      async function renameChatFolder(folderId, nextName = '') { return folderActionsController.renameChatFolder(folderId, nextName); }
      async function deleteChatFolder(folderId) { return folderActionsController.deleteChatFolder(folderId); }
      async function setChatFolderOrder(folderIds = []) { return folderActionsController.setChatFolderOrder(folderIds); }
      async function moveChatFolder(folderId, direction) { return folderActionsController.moveChatFolder(folderId, direction); }
      async function addChatsToFolder(folderId, chatIds = []) { return folderActionsController.addChatsToFolder(folderId, chatIds); }
      async function removeChatFromFolder(folderId, chatId) { return folderActionsController.removeChatFromFolder(folderId, chatId); }
      async function setFolderChatPin(folderId, chatId, pinned) { return folderActionsController.setFolderChatPin(folderId, chatId, pinned); }
      async function moveFolderChatPin(folderId, chatId, direction) { return folderActionsController.moveFolderChatPin(folderId, chatId, direction); }
      async function handleChatFolderContextMenuAction(action, folderId) { return folderActionsController.handleChatFolderContextMenuAction(action, folderId); }
      function resetChatFolderManageModal() { return folderManageModalController.resetChatFolderManageModal(); }
      function renderChatFolderManageModal(chatId) { return folderManageModalController.renderChatFolderManageModal(chatId); }
      async function openChatFolderManageModal(chatId, opener = null) { return folderManageModalController.openChatFolderManageModal(chatId, opener); }
      async function saveChatFolderManageChanges() { return folderManageModalController.saveChatFolderManageChanges(); }
    
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
        if (!isMobileLayoutViewport() || !sidebar) return;
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
        hideAttachMenu({ immediate: true });
        clearActivePulseVoterPopover({ skipRefresh: true });
        hideAvatarUserMenu();
        clearReply();
        if (composerStateController.editTo) clearEdit({ clearInput: true });
        currentChatId = null;
        updateComposerAiOverrideState().catch(() => {});
        messageStateController?.clearDisplayedMessages?.();
        messageStateController?.clearDisplayedPinEvents?.();
        chatPinsByChat.delete(id);
        readReceiptController.clearChatMemberLastReads(id);
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
        const result = await chatListService.removeChatLocally(chatId, { clearCache });
        refreshChatListReferences();
        syncCoreStateToRuntime();
        return result;
      }
    
      async function clearLocalChatHistory(chatId, { clearCache = true } = {}) {
        const id = Number(chatId || 0);
        if (!id) return;
        resetChatPreviewAfterHistoryClear(id);
        chatPinsByChat.set(id, []);
        readReceiptController.clearChatMemberLastReads(id);
        if (Number(currentChatId || 0) === id) {
          hideFloatingMessageActions({ immediate: true });
          clearReply();
          if (composerStateController.editTo) clearEdit({ clearInput: true });
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
          showCenterToast('\u0427\u0430\u0442 \u0441\u043a\u0440\u044b\u0442');
        } catch (e) {
          showCenterToast(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u0440\u044b\u0442\u044c \u0447\u0430\u0442');
        }
      }
    
      async function leaveChat(chatId) {
        const chat = getChatById(chatId);
        if (!canLeaveChat(chat)) return;
        if (!confirm('\u0412\u044b\u0439\u0442\u0438 \u0438\u0437 \u044d\u0442\u043e\u0433\u043e \u0447\u0430\u0442\u0430?')) return;
        try {
          await api(`/api/chats/${chatId}/members/me`, { method: 'DELETE' });
          await removeChatLocally(chatId, { clearCache: true });
          closeAllModals({ immediate: true });
          showCenterToast('\u0412\u044b \u0432\u044b\u0448\u043b\u0438 \u0438\u0437 \u0447\u0430\u0442\u0430');
        } catch (e) {
          showCenterToast(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u0439\u0442\u0438 \u0438\u0437 \u0447\u0430\u0442\u0430');
        }
      }
    
      async function deleteChatCompletely(chatId) {
        const chat = getChatById(chatId);
        if (!canManageDestructiveChat(chat)) return;
        if (!confirm('\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0447\u0430\u0442, \u0432\u0441\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u0438 \u043c\u0435\u0434\u0438\u0430 \u0431\u0435\u0437 \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f?')) return;
        try {
          await api(`/api/chats/${chatId}`, { method: 'DELETE' });
          await removeChatLocally(chatId, { clearCache: true });
          closeAllModals({ immediate: true });
          showCenterToast('\u0427\u0430\u0442 \u0443\u0434\u0430\u043b\u0451\u043d');
        } catch (e) {
          showCenterToast(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0447\u0430\u0442');
        }
      }
    
      async function clearChatHistoryForEveryone(chatId) {
        const chat = getChatById(chatId);
        if (!canManageDestructiveChat(chat)) return;
        if (!confirm('\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0438\u0441\u0442\u043e\u0440\u0438\u044e \u0447\u0430\u0442\u0430 \u0434\u043b\u044f \u0432\u0441\u0435\u0445 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432?')) return;
        try {
          await api(`/api/chats/${chatId}/history`, { method: 'DELETE' });
          await clearLocalChatHistory(chatId, { clearCache: true });
          await loadChats({ silent: true });
          showCenterToast('\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u043e\u0447\u0438\u0449\u0435\u043d\u0430');
        } catch (e) {
          showCenterToast(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0438\u0441\u0442\u043e\u0440\u0438\u044e');
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
    
      function modalEntryOf(modalOrId) {
        return modalManager.getEntry(modalOrId);
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
    
      function registerModal(modalOrId, options = {}) {
        return modalManager.register(modalOrId, options);
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
    
      function ensureQwenTextBotsModalContent() {
        const modalBlock = $('#qwenAiTextBotsBlock');
        if (!modalBlock) return;
        const botPanel = $('#qwenAiBotList')?.closest('.ai-bot-panel');
        const chatPanel = $('#qwenAiBotChatSelect')?.closest('.ai-bot-panel');
        [botPanel, chatPanel].forEach((panel) => {
          if (panel && panel.parentElement !== modalBlock) {
            modalBlock.appendChild(panel);
          }
        });
      }
    
      function registerBuiltinModals() {
        ensureDeepseekTextBotsModalContent();
        ensureQwenTextBotsModalContent();
        modalManager.registerBuiltins([
          newChatModal,
          adminModal,
          chatInfoModal,
          menuDrawer,
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
          { modal: grokImageRiskConfirmModal, onAfterClose: handleGrokImageRiskModalClosed },
          { modal: chatFolderManageModal, onAfterClose: resetChatFolderManageModal },
          { modal: forwardMessageModal, onAfterClose: resetForwardMessageModal },
          { modal: pollComposerModal, onAfterClose: resetPollComposer },
          { modal: pollVotersModal, onAfterClose: resetPollVotersModal },
        ]);
      }
    
      function getTopModal() {
        return modalManager.getTop();
      }
    
      function hasOpenModal() {
        return modalManager.hasOpen();
      }
    
      function openModal(modalOrId, options = {}) {
        return modalManager.open(modalOrId, options);
      }
    
      function closeModal(modalOrId, options = {}) {
        return modalManager.close(modalOrId, options);
      }
    
      function closeTopModal(options = {}) {
        return modalManager.closeTop(options);
      }
    
      function closeAllModals(options = {}) {
        return modalManager.closeAll(options);
      }
    
      async function retryGrokImageRiskPrompt(row, button = null) {
        const noticeId = Number(row?.dataset?.msgId || row?.__messageData?.id || 0);
        if (!noticeId || grokImageRiskRetryPending.has(noticeId)) return;
        grokImageRiskRetryPending.add(noticeId);
        if (button) {
          button.disabled = true;
          button.classList.add('is-pending');
        }
        try {
          const message = await api(`/api/messages/${noticeId}/grok-image-risk-retry`, { method: 'POST' });
          if (message) {
            if (Number(message.chat_id || message.chatId || 0) === Number(currentChatId || 0)) {
              appendTimelineItems([message]);
              scrollToBottom();
            }
            showCenterToast(t('Sent again'));
            playAppSound('send');
          }
        } catch (e) {
          showCenterToast(e.message || t('Could not send again'));
        } finally {
          grokImageRiskRetryPending.delete(noticeId);
          if (button) {
            button.disabled = false;
            button.classList.remove('is-pending');
          }
        }
      }
    
      async function jumpToSavedOriginal(message) {
        const originalId = Number(message?.saved_from_message_id || 0);
        if (!originalId) {
          showCenterToast('\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u043e');
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
          showCenterToast('\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u043e');
          return false;
        } catch (e) {
          showCenterToast('\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u043e');
          return false;
        }
      }
    
      function normalizeMentionTarget(...args) { return composerMentionsController?.normalizeMentionTarget?.(...args) || null; }
    
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
    
      function isGrokUniversalBotTarget(target) {
        if (!target) return false;
        return String(target.bot_provider || target.ai_bot_provider || '').toLowerCase() === 'grok'
          && String(target.bot_kind || target.ai_bot_kind || '').toLowerCase() === 'universal';
      }
    
      function grokUniversalTargetAllowsImage(target) {
        if (!isGrokUniversalBotTarget(target)) return false;
        return target.allow_image_generate !== false || target.allow_image_edit !== false;
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
          image_risk_filter_enabled: source.image_risk_filter_enabled ?? source.ai_bot_image_risk_filter_enabled ?? true,
          document_default_format: String(source.document_default_format || 'md').toLowerCase() === 'txt' ? 'txt' : 'md',
        };
      }
    
      function getDirectPrivateAiBotTarget(loadedTargets = []) {
        const chat = getChatById(currentChatId);
        const peer = chat?.type === 'private' ? chat.private_user : null;
        if (!peer || Number(peer.is_ai_bot || 0) === 0) return null;
        const peerUserId = Number(peer.id || peer.user_id || 0);
        const peerBotId = Number(peer.ai_bot_id || peer.bot_id || 0);
        const loaded = (loadedTargets || []).find((target) => {
          const targetUserId = Number(target.user_id || target.id || 0);
          const targetBotId = Number(target.bot_id || target.ai_bot_id || 0);
          return (peerUserId && targetUserId === peerUserId) || (peerBotId && targetBotId === peerBotId);
        }) || null;
        return buildReplyBotTarget({
          user_id: peerUserId,
          display_name: peer.display_name || chat.name || '',
          ai_bot_id: peerBotId,
          ai_bot_mention: peer.ai_bot_mention || peer.username || '',
          ai_bot_provider: peer.ai_bot_provider || '',
          ai_bot_kind: peer.ai_bot_kind || '',
          ai_bot_image_risk_filter_enabled: peer.ai_bot_image_risk_filter_enabled ?? true,
        }, loaded);
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
        const directPrivateTarget = getDirectPrivateAiBotTarget(targets);
        if (isUniversalBotTarget(directPrivateTarget)) return directPrivateTarget;
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
        const text = getComposerTextValue();
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
        const directPrivateTarget = getDirectPrivateAiBotTarget(targets);
        if (isGrokImageBotTarget(directPrivateTarget)) return directPrivateTarget;
        return null;
      }
    
      async function analyzeOutgoingGrokImageRisk(text, replySnapshot = null, composerAiOverride = {}) {
        if (!aiImageRiskApi?.analyzeAiImageRisk) return { risky: false, matches: [], prompt: '', target: null };
        const overrideTarget = composerAiOverride?.ai_override_target || null;
        const overrideMode = String(composerAiOverride?.ai_response_mode_hint || '').toLowerCase();
        let target = null;
        if (
          grokUniversalTargetAllowsImage(overrideTarget)
          && overrideMode !== 'text'
          && overrideMode !== 'document'
        ) {
          target = overrideTarget;
        }
        if (!target) target = await resolveTriggeredGrokImageBot(text, replySnapshot);
        if (!target) {
          const universalTarget = await resolveComposerUniversalBotTarget(text, replySnapshot);
          const sameOverrideTarget = Number(overrideTarget?.bot_id || overrideTarget?.ai_bot_id || 0)
            && Number(overrideTarget?.bot_id || overrideTarget?.ai_bot_id || 0) === Number(universalTarget?.bot_id || universalTarget?.ai_bot_id || 0);
          const universalMode = sameOverrideTarget ? overrideMode : 'auto';
          if (
            grokUniversalTargetAllowsImage(universalTarget)
            && universalMode !== 'text'
            && universalMode !== 'document'
          ) {
            target = universalTarget;
          }
        }
        if (!target) return { risky: false, matches: [], prompt: '', target: null };
        if (target.image_risk_filter_enabled === false || target.ai_bot_image_risk_filter_enabled === false) {
          return { risky: false, matches: [], prompt: '', target };
        }
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
    
      async function loadMentionTargets(...args) { return composerMentionsController?.loadMentionTargets?.(...args) || []; }
    
      function suppressMentionPickerFollowupClick(...args) { return composerMentionsController?.suppressMentionPickerFollowupClick?.(...args); }
    
      function suppressContextConvertPickerFollowupClick(ms = 550) {
        contextConvertPickerClickSuppressUntil = Math.max(contextConvertPickerClickSuppressUntil, Date.now() + ms);
      }
    
      function clearContextConvertPickerFollowupClickSuppress() {
        contextConvertPickerClickSuppressUntil = 0;
      }
    
      function ensureMentionPickerBackdrop(...args) { return composerMentionsController?.ensureMentionPickerBackdrop?.(...args); }
    
      function ensureMentionPicker(...args) { return composerMentionsController?.ensureMentionPicker?.(...args); }
    
      function isComposerMeaningfullyEmpty(...args) { return composerMentionsController?.isComposerMeaningfullyEmpty?.(...args) || false; }
    
      function getManualMentionRange(...args) { return composerMentionsController?.getManualMentionRange?.(...args) || { start: 0, end: 0 }; }
    
      function syncMentionOpenButton(...args) { return composerMentionsController?.syncMentionOpenButton?.(...args); }
    
      function hideMentionPicker(...args) { return composerMentionsController?.hideMentionPicker?.(...args); }
    
      function findMentionTrigger(...args) { return composerMentionsController?.findMentionTrigger?.(...args) || null; }
    
      function positionMentionPicker(...args) { return composerMentionsController?.positionMentionPicker?.(...args); }
    
      function renderMentionPicker(...args) { return composerMentionsController?.renderMentionPicker?.(...args); }
    
      async function openMentionPickerFromButton(...args) { return composerMentionsController?.openMentionPickerFromButton?.(...args); }
    
      async function updateMentionPicker(...args) { return composerMentionsController?.updateMentionPicker?.(...args); }
    
      function insertMentionTarget(...args) { return composerMentionsController?.insertMentionTarget?.(...args); }
    
      function insertMentionTokenIntoComposer(...args) { return composerMentionsController?.insertMentionTokenIntoComposer?.(...args); }
    
      function insertRawMentionTriggerAtCursor(...args) { return composerMentionsController?.insertRawMentionTriggerAtCursor?.(...args); }
    
      async function openPrivateChatWithUser(userId) {
        const id = Number(userId);
        if (!id || id === currentUser?.id) return;
        const chat = await api('/api/chats/private', { method: 'POST', body: { targetUserId: id } });
        await loadChats();
        if (chat?.id) openChat(chat.id);
      }
    
      function handleMentionPickerKeydown(...args) { return composerMentionsController?.handleMentionPickerKeydown?.(...args) || false; }
    
      async function handleMentionClick(...args) { return composerMentionsController?.handleMentionClick?.(...args); }
    
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
          suppressAvatarUserMenuFollowupClick();
          hideAvatarUserMenu();
          if (action === 'mention') {
            insertMentionTokenIntoComposer(target.token);
          } else if (action === 'private') {
            openPrivateChatWithUser(target.userId).catch((error) => {
              console.warn('[avatar-menu] private chat failed:', error.message);
            });
          }
        }, { passive: false });
        menu.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
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
        if (provider === 'qwen') return 'Qwen';
        if (provider === 'grok') return 'Grok';
        return 'OpenAI';
      }
    
      function providerAccent(provider = 'openai') {
        if (provider === 'yandex') return '#fc9b28';
        if (provider === 'deepseek') return '#2a9d8f';
        if (provider === 'qwen') return '#8b5cf6';
        if (provider === 'grok') return '#5f8cff';
        return '#10a37f';
      }
    
      function contextConvertRouteBase(provider = 'openai') {
        if (provider === 'yandex') return '/api/admin/yandex-convert-bots';
        if (provider === 'deepseek') return '/api/admin/deepseek-convert-bots';
        if (provider === 'qwen') return '/api/admin/qwen-convert-bots';
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
        if (provider === 'qwen' && state.settings) qwenBotState.settings = { ...qwenBotState.settings, ...state.settings };
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
                <small>${bot.enabled ? 'enabled' : 'disabled'}${bot.available_in_all_chats ? ' \u00b7 all chats' : ''}${bot.response_model ? ` \u00b7 ${esc(bot.response_model)}` : ''}</small>
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
        const enabledToggle = $('#contextConvertBotEnabled');
        const allChatsToggle = $('#contextConvertBotAvailableAllChats');
        if (enabledToggle) enabledToggle.checked = bot?.enabled !== false;
        if (allChatsToggle) {
          allChatsToggle.checked = !!bot?.available_in_all_chats;
          allChatsToggle.disabled = !enabledToggle?.checked;
        }
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
        const bot = state.bots.find((item) => Number(item.id) === Number(botSelect.value));
        const isGlobalBot = !!bot?.available_in_all_chats;
        const chatEnabledToggle = $('#contextConvertBotChatEnabled');
        if (chatEnabledToggle) {
          chatEnabledToggle.checked = isGlobalBot || !!setting?.enabled;
          chatEnabledToggle.disabled = isGlobalBot;
        }
        const saveButton = $('#contextConvertBotChatSave');
        if (saveButton) saveButton.disabled = isGlobalBot;
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
          available_in_all_chats: $('#contextConvertBotAvailableAllChats')?.checked,
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
        const state = currentContextConvertAdminState();
        const bot = state.bots.find((item) => Number(item.id) === Number(botId));
        if (bot?.available_in_all_chats) {
          renderContextConvertChatSettings();
          setContextConvertChatStatus('This bot is already available in all context-enabled chats', 'success');
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
    
      function chatShotRouteBase(provider = 'openai') {
        if (provider === 'grok') return '/api/admin/grok-chatshot-bots';
        return '/api/admin/openai-chatshot-bots';
      }
    
      function currentChatShotAdminState() {
        return chatShotAdminStates[activeChatShotProvider] || chatShotAdminStates.openai;
      }
    
      function currentChatShotAdminBot() {
        const state = currentChatShotAdminState();
        const selectedId = Number(selectedChatShotBotIds[activeChatShotProvider] || 0);
        return state.bots.find((bot) => Number(bot.id) === selectedId) || null;
      }
    
      function getChatShotAdminChatSetting(chatId, botId) {
        const state = currentChatShotAdminState();
        return state.chatSettings.find((item) => Number(item.chat_id) === Number(chatId) && Number(item.bot_id) === Number(botId)) || null;
      }
    
      function setChatShotModalStatus(message, type = '') {
        setInlineStatus('chatShotAdminStatus', message, type);
      }
    
      function setChatShotBotStatus(message, type = '') {
        setInlineStatus(['chatShotBotEditorStatus', 'chatShotBotEditorStatusBottom'], message, type);
      }
    
      function setChatShotAdminChatStatus(message, type = '') {
        setInlineStatus('chatShotBotChatStatus', message, type);
      }
    
      function mergeChatShotAdminState(provider = 'openai', data = {}) {
        const state = data.state || data;
        if (!chatShotAdminStates[provider]) return;
        chatShotAdminStates[provider] = {
          settings: state.settings || chatShotAdminStates[provider].settings,
          bots: state.bots || chatShotAdminStates[provider].bots,
          chats: state.chats || chatShotAdminStates[provider].chats,
          chatSettings: state.chatSettings || chatShotAdminStates[provider].chatSettings,
          models: state.models || chatShotAdminStates[provider].models,
        };
        if (provider === 'openai' && state.settings) syncSharedOpenAiSettings(state.settings);
        if (provider === 'grok' && state.settings) grokBotState.settings = { ...grokBotState.settings, ...state.settings };
        const bots = chatShotAdminStates[provider].bots || [];
        if (selectedChatShotBotIds[provider] && !bots.some((bot) => Number(bot.id) === Number(selectedChatShotBotIds[provider]))) {
          selectedChatShotBotIds[provider] = null;
        }
        if (!selectedChatShotBotIds[provider] && bots[0]) {
          selectedChatShotBotIds[provider] = Number(bots[0].id);
        }
        chatShotStateByChat.clear();
        chatShotStateFailuresByChat.clear();
      }
    
      function renderChatShotBotList() {
        const list = $('#chatShotBotList');
        if (!list) return;
        const state = currentChatShotAdminState();
        const selectedId = Number(selectedChatShotBotIds[activeChatShotProvider] || 0);
        if (!state.bots.length) {
          list.innerHTML = '<div class="ai-bot-empty">No ChatShot bots yet. Create the first one.</div>';
          return;
        }
        list.innerHTML = state.bots.map((bot) => `
          <button type="button" class="ai-bot-list-item${Number(bot.id) === selectedId ? ' active' : ''}" data-chat-shot-bot-id="${bot.id}">
            <span class="ai-bot-list-main">
              <span class="ai-bot-list-copy">
                <strong>${esc(bot.name || 'ChatShot')}</strong>
                <small>${bot.enabled ? 'enabled' : 'disabled'}${bot.available_in_all_chats ? ' \u0412\u00b7 all chats' : ''}${bot.image_model ? ` \u0412\u00b7 ${esc(bot.image_model)}` : ''}</small>
              </span>
            </span>
          </button>
        `).join('');
      }
    
      function renderChatShotAdminForm() {
        const state = currentChatShotAdminState();
        const bot = currentChatShotAdminBot() || null;
        const isGrok = activeChatShotProvider === 'grok';
        const responseModels = state.models?.response || [];
        const imageModels = state.models?.image || [];
        setAiModelSelectOptions('chatShotBotResponseModel', responseModels, bot?.response_model || responseModels[0] || '');
        setAiModelSelectOptions('chatShotBotImageModel', imageModels, bot?.image_model || imageModels[0] || '');
        setStaticSelectOptions('chatShotBotImageResolution', isGrok ? (state.models?.resolution || ['1k', '2k']) : (state.models?.image_size || OPENAI_IMAGE_SIZE_OPTIONS), bot?.image_resolution || (isGrok ? '1k' : '1024x1024'));
        setStaticSelectOptions('chatShotBotImageQuality', state.models?.image_quality || OPENAI_IMAGE_QUALITY_OPTIONS, bot?.image_quality || 'auto');
        setStaticSelectOptions('chatShotBotImageBackground', state.models?.image_background || OPENAI_IMAGE_BACKGROUND_OPTIONS, bot?.image_background || 'auto');
        setStaticSelectOptions('chatShotBotImageOutputFormat', state.models?.image_output_format || OPENAI_IMAGE_OUTPUT_OPTIONS, bot?.image_output_format || 'png');
        setStaticSelectOptions('chatShotBotAspectRatio', state.models?.aspect_ratio || ['1:1', '16:9', '9:16', 'auto'], bot?.image_aspect_ratio || '1:1');
        $('#chatShotBotName').value = bot?.name || `${contextConvertProviderLabel(activeChatShotProvider)} ChatShot`;
        $('#chatShotBotContextLimit').value = bot?.chatshot_context_limit ?? 50;
        $('#chatShotBotTemperature').value = bot?.temperature ?? 0.3;
        $('#chatShotBotMaxTokens').value = bot?.max_tokens ?? 900;
        $('#chatShotBotEnabled').checked = bot?.enabled !== false;
        const allChatsToggle = $('#chatShotBotAvailableAllChats');
        if (allChatsToggle) {
          allChatsToggle.checked = !!bot?.available_in_all_chats;
          allChatsToggle.disabled = !$('#chatShotBotEnabled')?.checked;
        }
        $('#chatShotBotGrokAspectWrap')?.classList.toggle('hidden', !isGrok);
        $('#chatShotBotOpenAiQualityWrap')?.classList.toggle('hidden', isGrok);
        $('#chatShotBotOpenAiBackgroundWrap')?.classList.toggle('hidden', isGrok);
        $('#chatShotBotOpenAiOutputWrap')?.classList.toggle('hidden', isGrok);
      }
    
      function renderChatShotAdminChatSettings() {
        const state = currentChatShotAdminState();
        const chatSelect = $('#chatShotBotChatSelect');
        const botSelect = $('#chatShotBotChatBotSelect');
        if (!chatSelect || !botSelect) return;
        const currentChatValue = chatSelect.value || String(currentChatId || state.chats[0]?.id || '');
        const currentBotValue = botSelect.value || String(selectedChatShotBotIds[activeChatShotProvider] || state.bots[0]?.id || '');
        chatSelect.innerHTML = state.chats.map((chat) => `<option value="${chat.id}">${esc(chat.name)} (${esc(chat.type)})</option>`).join('');
        botSelect.innerHTML = state.bots.map((bot) => `<option value="${bot.id}">${esc(bot.name)}</option>`).join('');
        if (state.chats.some((chat) => String(chat.id) === String(currentChatValue))) chatSelect.value = currentChatValue;
        if (state.bots.some((bot) => String(bot.id) === String(currentBotValue))) botSelect.value = currentBotValue;
        if (!botSelect.value && state.bots[0]) botSelect.value = String(state.bots[0].id);
        const setting = getChatShotAdminChatSetting(chatSelect.value, botSelect.value);
        const bot = state.bots.find((item) => Number(item.id) === Number(botSelect.value));
        const isGlobalBot = !!bot?.available_in_all_chats;
        const chatEnabledToggle = $('#chatShotBotChatEnabled');
        if (chatEnabledToggle) {
          chatEnabledToggle.checked = isGlobalBot || !!setting?.enabled;
          chatEnabledToggle.disabled = isGlobalBot;
        }
        const saveButton = $('#chatShotBotChatSave');
        if (saveButton) saveButton.disabled = isGlobalBot;
      }
    
      function renderChatShotAdminSettings() {
        $('#chatShotModalTitle').textContent = `${contextConvertProviderLabel(activeChatShotProvider)} ChatShot Bots`;
        renderChatShotBotList();
        renderChatShotAdminForm();
        renderChatShotAdminChatSettings();
      }
    
      function chatShotAdminFormPayload() {
        return {
          name: $('#chatShotBotName')?.value.trim(),
          enabled: $('#chatShotBotEnabled')?.checked,
          available_in_all_chats: $('#chatShotBotAvailableAllChats')?.checked,
          response_model: $('#chatShotBotResponseModel')?.value.trim(),
          image_model: $('#chatShotBotImageModel')?.value.trim(),
          image_resolution: $('#chatShotBotImageResolution')?.value.trim(),
          image_quality: $('#chatShotBotImageQuality')?.value.trim(),
          image_background: $('#chatShotBotImageBackground')?.value.trim(),
          image_output_format: $('#chatShotBotImageOutputFormat')?.value.trim(),
          image_aspect_ratio: $('#chatShotBotAspectRatio')?.value.trim(),
          chatshot_context_limit: Number($('#chatShotBotContextLimit')?.value || 50),
          temperature: Number($('#chatShotBotTemperature')?.value || 0.3),
          max_tokens: Number($('#chatShotBotMaxTokens')?.value || 900),
        };
      }
    
      async function loadChatShotAdminState(provider = activeChatShotProvider) {
        const data = await api(chatShotRouteBase(provider));
        mergeChatShotAdminState(provider, data);
        if (provider === activeChatShotProvider) renderChatShotAdminSettings();
        return data;
      }
    
      function openChatShotBotsModal(provider = 'openai') {
        if (!currentUser?.is_admin) return;
        activeChatShotProvider = provider === 'grok' ? 'grok' : 'openai';
        const openerId = activeChatShotProvider === 'grok' ? 'grokAiOpenChatShotBots' : 'openAiOpenChatShotBots';
        openModal('chatShotBotsModal', { replaceStack: false, opener: $(`#${openerId}`) });
        resetManagedModalScroll('chatShotBotsModal');
        setChatShotModalStatus('Loading...');
        const state = chatShotAdminStates[activeChatShotProvider];
        if (state?.bots?.length || state?.chats?.length) {
          renderChatShotAdminSettings();
          setChatShotModalStatus('Refreshing...');
        }
        loadChatShotAdminState(activeChatShotProvider).then(() => {
          renderChatShotAdminSettings();
          resetManagedModalScroll('chatShotBotsModal');
          setChatShotModalStatus('');
        }).catch((error) => {
          setChatShotModalStatus(error.message || 'Could not load ChatShot bots', 'error');
        });
      }
    
      async function saveChatShotAdminBot() {
        const payload = chatShotAdminFormPayload();
        if (!payload.name) {
          setChatShotBotStatus('Enter bot name', 'error');
          return;
        }
        const selectedId = Number(selectedChatShotBotIds[activeChatShotProvider] || 0);
        const state = currentChatShotAdminState();
        const shouldUpdate = Boolean(selectedId && state.bots.some((bot) => Number(bot.id) === selectedId));
        const url = shouldUpdate ? `${chatShotRouteBase(activeChatShotProvider)}/${selectedId}` : chatShotRouteBase(activeChatShotProvider);
        setChatShotBotStatus('Saving...');
        try {
          const data = await api(url, { method: shouldUpdate ? 'PUT' : 'POST', body: payload });
          mergeChatShotAdminState(activeChatShotProvider, data);
          selectedChatShotBotIds[activeChatShotProvider] = Number(data.bot?.id || selectedId || 0) || null;
          renderChatShotAdminSettings();
          setChatShotBotStatus('ChatShot bot saved', 'success');
        } catch (error) {
          setChatShotBotStatus(error.message || 'Could not save ChatShot bot', 'error');
        }
      }
    
      async function disableChatShotAdminBot() {
        const bot = currentChatShotAdminBot();
        if (!bot) return;
        if (!confirm('Disable this ChatShot bot in all chats?')) return;
        try {
          const data = await api(`${chatShotRouteBase(activeChatShotProvider)}/${bot.id}`, { method: 'DELETE' });
          mergeChatShotAdminState(activeChatShotProvider, data);
          renderChatShotAdminSettings();
          setChatShotBotStatus('ChatShot bot disabled', 'success');
        } catch (error) {
          setChatShotBotStatus(error.message || 'Could not disable ChatShot bot', 'error');
        }
      }
    
      async function testChatShotAdminBot() {
        const bot = currentChatShotAdminBot();
        if (!bot) {
          setChatShotBotStatus('Save a ChatShot bot first', 'error');
          return;
        }
        const sample = window.prompt('Chat context for test prompt:', 'User: We planned a friendly weekend meetup. Friend: Bring something bright and funny.');
        if (sample == null) return;
        setChatShotBotStatus('Testing...');
        try {
          const data = await api(`${chatShotRouteBase(activeChatShotProvider)}/${bot.id}/test`, {
            method: 'POST',
            body: { text: sample, style: 'comic' },
          });
          const text = String(data.result?.text || '').trim().slice(0, 600);
          setChatShotBotStatus(`Success (${data.result?.latencyMs || 0} ms): ${text}`, 'success');
        } catch (error) {
          setChatShotBotStatus(error.message || 'ChatShot bot test failed', 'error');
        }
      }
    
      async function exportChatShotAdminBot() {
        const bot = currentChatShotAdminBot();
        if (!bot) {
          setChatShotBotStatus('Select a saved ChatShot bot first', 'error');
          return;
        }
        setChatShotBotStatus('Preparing JSON...');
        try {
          const res = await fetch(`${chatShotRouteBase(activeChatShotProvider)}/${bot.id}/export`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Export failed');
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filenameFromContentDisposition(
            res.headers.get('content-disposition'),
            `bananza-${activeChatShotProvider}-chatshot-${bot.id}.json`
          );
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          setChatShotBotStatus('JSON exported', 'success');
        } catch (error) {
          setChatShotBotStatus(error.message || 'Could not export JSON', 'error');
        }
      }
    
      async function importChatShotAdminBot(file) {
        if (!file) return;
        setChatShotBotStatus('Importing JSON...');
        try {
          const raw = await file.text();
          const payload = JSON.parse(raw);
          const data = await api(`${chatShotRouteBase(activeChatShotProvider)}/import`, {
            method: 'POST',
            body: payload,
          });
          mergeChatShotAdminState(activeChatShotProvider, data);
          selectedChatShotBotIds[activeChatShotProvider] = Number(data.bot?.id || 0) || selectedChatShotBotIds[activeChatShotProvider];
          renderChatShotAdminSettings();
          const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
          setChatShotBotStatus(`JSON imported.${warnings}`.trim(), warnings ? 'warning' : 'success');
        } catch (error) {
          setChatShotBotStatus(error.message || 'Could not import JSON', 'error');
        }
      }
    
      async function saveChatShotAdminChatSetting() {
        const chatId = Number($('#chatShotBotChatSelect')?.value || 0);
        const botId = Number($('#chatShotBotChatBotSelect')?.value || 0);
        if (!chatId || !botId) {
          setChatShotAdminChatStatus('Select chat and bot', 'error');
          return;
        }
        const state = currentChatShotAdminState();
        const bot = state.bots.find((item) => Number(item.id) === Number(botId));
        if (bot?.available_in_all_chats) {
          renderChatShotAdminChatSettings();
          setChatShotAdminChatStatus('This bot is already available in all chats', 'success');
          return;
        }
        setChatShotAdminChatStatus('Saving...');
        try {
          const data = await api(`${chatShotRouteBase(activeChatShotProvider)}/chat-settings`, {
            method: 'PUT',
            body: {
              chatId,
              botId,
              enabled: $('#chatShotBotChatEnabled')?.checked,
            },
          });
          mergeChatShotAdminState(activeChatShotProvider, data);
          invalidateChatShotState(chatId);
          renderChatShotAdminChatSettings();
          setChatShotAdminChatStatus('Chat setting saved', 'success');
        } catch (error) {
          setChatShotAdminChatStatus(error.message || 'Could not save chat setting', 'error');
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
    
      function normalizeChatShotState(data = {}) {
        return {
          chatId: Number(data.chatId || data.chat_id || 0),
          enabled: !!data.enabled,
          requested_enabled: !!data.requested_enabled,
          botId: Number(data.botId || data.bot_id || 0) || null,
          style: ['comic', 'illustration', 'photo'].includes(String(data.style || '').toLowerCase()) ? String(data.style).toLowerCase() : 'comic',
          banana_filter_enabled: data.banana_filter_enabled !== false
            && data.banana_filter_enabled !== 0
            && data.bananaFilterEnabled !== false
            && data.bananaFilterEnabled !== 0,
          ready: !!data.ready,
          message_count: Number(data.message_count || 0),
          bots: Array.isArray(data.bots) ? data.bots.map((bot) => ({
            id: Number(bot.id || 0),
            name: bot.name || 'ChatShot',
            provider: bot.provider || 'openai',
            image_model: bot.image_model || '',
          })).filter((bot) => bot.id > 0) : [],
          selectedBot: data.selectedBot || data.selected_bot || null,
        };
      }
    
      function getCurrentChatShotState() {
        return chatShotStateByChat.get(Number(currentChatId || 0)) || null;
      }
    
      function setChatShotChatStatus(message, type = '') {
        const el = $('#chatShotChatStatus');
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('is-error', type === 'error');
        el.classList.toggle('is-success', type === 'success');
      }
    
      async function loadChatShotState(chatId = currentChatId, { force = false } = {}) {
        const id = Number(chatId || 0);
        if (!id) return null;
        if (!force && chatShotStateByChat.has(id)) return chatShotStateByChat.get(id);
        if (!force && chatShotStateRequests.has(id)) return chatShotStateRequests.get(id);
        if (!force && chatShotStateFailuresByChat.has(id)) return null;
        if (force) chatShotStateFailuresByChat.delete(id);
        const request = api(`/api/chats/${id}/chatshot`)
          .then((data) => {
            const normalized = normalizeChatShotState(data);
            chatShotStateByChat.set(id, normalized);
            chatShotStateFailuresByChat.delete(id);
            chatShotStateRequests.delete(id);
            if (id === Number(currentChatId || 0)) {
              renderChatShotForm(normalized);
              syncChatShotButton();
            }
            return normalized;
          })
          .catch((error) => {
            chatShotStateRequests.delete(id);
            chatShotStateFailuresByChat.add(id);
            if (id === Number(currentChatId || 0)) {
              chatShotStateByChat.delete(id);
              syncChatShotButton();
            }
            throw error;
          });
        chatShotStateRequests.set(id, request);
        return request;
      }
    
      function invalidateChatShotState(chatId) {
        const id = Number(chatId || 0);
        if (!id) return;
        chatShotStateByChat.delete(id);
        chatShotStateRequests.delete(id);
        chatShotStateFailuresByChat.delete(id);
        if (id === Number(currentChatId || 0)) {
          syncChatShotButton();
          if (!chatInfoModal?.classList.contains('hidden')) {
            loadChatShotState(id, { force: true }).catch((error) => {
              renderChatShotForm(null);
              setChatShotChatStatus(error.message || 'Could not load ChatShot', 'error');
            });
          }
        }
      }
    
      function renderChatShotForm(state = getCurrentChatShotState()) {
        const section = $('#chatShotSection');
        const toggle = $('#chatShotToggle');
        const botSelect = $('#chatShotBotSelect');
        const styleSelect = $('#chatShotStyleSelect');
        const bananaFilterToggle = $('#chatShotBananaFilterToggle');
        if (!section || !toggle || !botSelect || !styleSelect || !bananaFilterToggle) return;
        const bots = Array.isArray(state?.bots) ? state.bots : [];
        section.classList.toggle('hidden', !bots.length);
        toggle.checked = !!state?.enabled || !!state?.requested_enabled;
        toggle.disabled = !bots.length;
        const selectedBotId = Number(state?.botId || state?.selectedBot?.id || bots[0]?.id || 0);
        botSelect.innerHTML = bots.map((bot) => `<option value="${bot.id}">${esc(bot.name)} (${esc(contextConvertProviderLabel(bot.provider))})</option>`).join('');
        if (bots.some((bot) => Number(bot.id) === selectedBotId)) botSelect.value = String(selectedBotId);
        botSelect.disabled = !bots.length || bots.length === 1;
        styleSelect.value = state?.style || 'comic';
        bananaFilterToggle.checked = state?.banana_filter_enabled !== false;
        bananaFilterToggle.disabled = !bots.length;
        const messageCount = Number(state?.message_count || 0);
        if (!bots.length) setChatShotChatStatus('');
        else if (toggle.checked && messageCount < 2) setChatShotChatStatus('ChatShot \u0432\u043a\u043b\u044e\u0447\u0438\u0442\u0441\u044f \u043f\u043e\u0441\u043b\u0435 \u0434\u0432\u0443\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0432 \u0447\u0430\u0442\u0435.');
        else setChatShotChatStatus('');
      }
    
      async function saveChatShotChatSetting() {
        if (!currentChatId) return;
        const previous = getCurrentChatShotState();
        const payload = {
          enabled: $('#chatShotToggle')?.checked,
          botId: Number($('#chatShotBotSelect')?.value || previous?.botId || 0) || null,
          style: $('#chatShotStyleSelect')?.value || previous?.style || 'comic',
          bananaFilterEnabled: $('#chatShotBananaFilterToggle')?.checked !== false,
        };
        setChatShotChatStatus('Saving...');
        try {
          const data = await api(`/api/chats/${currentChatId}/chatshot`, {
            method: 'PUT',
            body: payload,
          });
          const normalized = normalizeChatShotState(data);
          chatShotStateByChat.set(Number(currentChatId), normalized);
          renderChatShotForm(normalized);
          syncChatShotButton();
          setChatShotChatStatus('Saved', 'success');
        } catch (error) {
          if (previous) {
            chatShotStateByChat.set(Number(currentChatId), previous);
            renderChatShotForm(previous);
          }
          syncChatShotButton();
          setChatShotChatStatus(error.message || 'Could not save ChatShot setting', 'error');
        }
      }
    
      function syncChatShotButton() {
        if (!chatShotBtn) return;
        const chatId = Number(currentChatId || 0);
        const state = getCurrentChatShotState();
        const generating = chatShotGeneratingByChat.has(chatId);
        const shouldShow = Boolean(chatId && (generating || (state?.enabled && state?.ready && state?.botId)));
        chatShotBtn.classList.toggle('hidden', !shouldShow);
        chatShotBtn.classList.toggle('is-pending', generating);
        chatShotBtn.disabled = generating || !shouldShow;
        syncChatHeaderActionsAccessibility();
        if (chatId && !state && !chatShotStateRequests.has(chatId) && !chatShotStateFailuresByChat.has(chatId)) {
          loadChatShotState(chatId).catch(() => {});
        }
      }
    
      async function runChatShotGeneration() {
        const chatId = Number(currentChatId || 0);
        if (!chatId || chatShotGeneratingByChat.has(chatId)) return;
        chatShotGeneratingByChat.add(chatId);
        syncChatShotButton();
        try {
          await api(`/api/chats/${chatId}/chatshot`, { method: 'POST', body: {} });
        } catch (error) {
          showCenterToast(error.message || 'ChatShot generation failed');
        } finally {
          chatShotGeneratingByChat.delete(chatId);
          syncChatShotButton();
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
                <span class="mention-picker-avatar" style="background:${esc(providerAccent(bot.provider))}">\ud83c\udf4c</span>
                <span class="mention-picker-copy">
                  <strong>${esc(bot.name)}</strong>
                  <small>${esc(contextConvertProviderLabel(bot.provider))}${bot.transform_prompt_preview ? ` \u00b7 ${esc(bot.transform_prompt_preview)}` : ''}</small>
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
    
      function canRestoreContextOriginalMessage(msg) {
        if (!currentUser || !msg || msg.is_deleted) return false;
        if (!msg.context_transform_original_available) return false;
        if (isClientSideMessage(msg)) return false;
        if (isPollMessage(msg)) return false;
        if (msg.call || msg.call_message || msg.is_call_message) return false;
        if (msg.call_transcript_run || msg.is_call_transcript_message) return false;
        if (msg.call_artifact_batch || msg.is_call_artifact_message) return false;
        if (msg.ai_generated || msg.ai_bot_id || msg.is_ai_bot) return false;
        if (!currentUser.is_admin && msg.user_id !== currentUser.id) return false;
        return Boolean(msg.is_voice_note || msg.file_id || msg.text || msg.transcription_text);
      }
    
      function bindContextConvertMessageButton(button, row) {
        if (!button || !row || button.dataset.contextConvertBound === '1') return button;
        button.dataset.contextConvertBound = '1';
        bindTouchSafeButtonActivation(button, ({ event, startKeyboardOpen }) => {
          event?.stopPropagation?.();
          const keepComposerFocus = Boolean(getReactionPickerKeepKeyboard() || startKeyboardOpen || isMobileComposerKeyboardOpen());
          openMessageContextConvertPicker(row, button, {
            keepComposerFocus,
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
        button.textContent = '\ud83c\udf4c';
        return bindContextConvertMessageButton(button, row);
      }
    
      function bindContextOriginalRestoreButton(button, row) {
        if (!button || !row || button.dataset.contextOriginalRestoreBound === '1') return button;
        button.dataset.contextOriginalRestoreBound = '1';
        bindTouchSafeButtonActivation(button, ({ event, startKeyboardOpen }) => {
          event?.stopPropagation?.();
          const keepComposerFocus = Boolean(getReactionPickerKeepKeyboard() || startKeyboardOpen || isMobileComposerKeyboardOpen());
          restoreContextOriginalMessage(Number(row?.__messageData?.id || row?.dataset?.msgId || 0), { keepComposerFocus }).catch((error) => {
            console.warn('[context-convert] restore failed:', error.message);
          });
        });
        return button;
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
        if (getActiveMessageActionsRow() || isFloatingSurfaceVisible(reactionPicker)) {
          positionMessageActionSurfaces({
            includeActions: Boolean(getActiveMessageActionsRow()),
            includePicker: isFloatingSurfaceVisible(reactionPicker),
          });
        }
      }
    
      function syncContextConvertComposerButton() {
        if (!composerContextConvertBtn) return;
        const hasText = Boolean(currentChatId && !composerStateController.editTo && getComposerTextValue({ trim: true }));
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
        if (contextConvertComposerPending || !currentChatId || composerStateController.editTo) return;
        const text = getComposerTextValue({ trim: true });
        if (!text) return;
        const keyboardAttached = Boolean(
          Object.prototype.hasOwnProperty.call(options, 'keyboardAttached')
            ? options.keyboardAttached
            : (!isMobileLayoutViewport() || isMobileComposerKeyboardOpen())
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
        const text = getComposerTextValue({ trim: true });
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
          setComposerTextValue(data.text || '');
          autoResize();
          if (keepKeyboardOpen) focusComposerKeepKeyboard(true);
          msgInput.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (error) {
          alert(error.message || 'Could not transform text');
        } finally {
          clearContextConvertPickerFollowupClickSuppress();
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
        if (Number(getReactionPickerMsgId() || 0) === id && isFloatingSurfaceVisible(reactionPicker)) {
          renderReactionPickerContent();
        }
      }
    
      function syncContextOriginalRestorePendingMessageState(messageId) {
        const id = Number(messageId || 0);
        if (!id) return;
        const pending = contextOriginalRestorePendingMessageIds.has(id);
        const row = messagesEl.querySelector(`[data-msg-id="${id}"]`);
        row?.querySelectorAll('.msg-restore-original-btn').forEach((btn) => {
          btn.classList.toggle('is-pending', pending);
          btn.disabled = pending;
        });
        if (Number(getReactionPickerMsgId() || 0) === id && isFloatingSurfaceVisible(reactionPicker)) {
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
          clearContextConvertPickerFollowupClickSuppress();
          contextConvertPendingMessageIds.delete(id);
          syncContextConvertPendingMessageState(id);
        }
      }
    
      async function restoreContextOriginalMessage(messageId, options = {}) {
        const id = Number(messageId || 0);
        if (!id || contextOriginalRestorePendingMessageIds.has(id)) return;
        const keepComposerFocus = Boolean(options.keepComposerFocus);
        hideFloatingMessageActions({ keepComposerState: keepComposerFocus, immediate: true });
        if (keepComposerFocus) focusComposerKeepKeyboard(true);
        contextOriginalRestorePendingMessageIds.add(id);
        syncContextOriginalRestorePendingMessageState(id);
        try {
          const preserveAnchor = captureScrollAnchor();
          const data = await api(`/api/messages/${id}/context-convert/restore-original`, {
            method: 'POST',
          });
          applyMessageUpdate(data.message, { preserveAnchor });
          if (preserveAnchor?.messageId) {
            requestAnimationFrame(() => restoreScrollAnchor(preserveAnchor, 2));
          }
          loadChats().catch(() => {});
        } catch (error) {
          showCenterToast(error.message || t('Could not restore original message'));
        } finally {
          contextOriginalRestorePendingMessageIds.delete(id);
          syncContextOriginalRestorePendingMessageState(id);
          if (keepComposerFocus) focusComposerKeepKeyboard(true);
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
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // AUTH
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      authService.configure?.({
        onApplyStoredUser: (user) => {
          currentUser = user;
          token = authService.getToken?.() || localStorage.getItem('token');
          applyUiTheme(currentUser.ui_theme, false);
          applyVisualMode(currentUser.ui_visual_mode, false);
          applyModalAnimation(currentUser.ui_modal_animation, false);
          applyModalAnimationSpeed(currentUser.ui_modal_animation_speed, false);
          applyMobileFontSize(currentUser.ui_mobile_font_size, false);
          syncCoreStateToRuntime();
        },
        cleanup: () => {
          chatListService.clearCacheSyncTimer();
          openChatController.clearMessageBackgroundSyncTimer();
          websocketService.clearReconnectTimer?.();
          uiSettings.clearMobileFontSizeSaveTimer();
          clearMobileFontSizeStatusTimer();
          chatListService.abortChatListRequest();
          try { if (window.clearAssetCache) window.clearAssetCache().catch(()=>{}); } catch (e) {}
          try { if (window.messageCache && window.messageCache.clearUserCache) window.messageCache.clearUserCache().catch(()=>{}); } catch (e) {}
          composerStateController.resetComposerDraftsForCurrentUser({ removeStorage: true });
        },
        onResetUi: () => {
          currentMobileFontSize = MOBILE_FONT_SIZE_DEFAULT;
          setMobileFontAdjustPercent(100);
        },
        redirectToLogin: () => { location.href = '/login.html'; },
      });
      checkAuth = () => {
        const ok = authService.checkAuth?.() || false;
        syncCoreStateFromRuntime();
        return ok;
      };
      logout = () => {
        syncCoreStateToRuntime();
        const result = authService.logout?.();
        syncCoreStateFromRuntime();
        return result;
      };
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // WEBSOCKET
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      websocketService.configure?.({
        getToken: () => token || authService.getToken?.() || localStorage.getItem('token'),
        handleMessage: (payload) => handleWSMessage(payload),
        onOpen: () => {
          if (chatListStore.isInitialChatLoadFinished()) scheduleRecoverySync('ws-open');
        },
        onBlocked: () => {
          alert('Your account has been blocked by an administrator.');
          logout();
        },
        onStateChange: () => syncCoreStateFromRuntime(),
      });
      connectWS = (options = {}) => {
        syncCoreStateToRuntime();
        const socket = websocketService.connect?.(options) || null;
        syncCoreStateFromRuntime();
        return socket;
      };
    
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
            // If this message echoes a client_id, promote the optimistic row in place.
            try {
              if (msg.message && msg.message.client_id) {
                await window.messageCache?.deleteOutboxItem?.(msg.message.chat_id, msg.message.client_id);
                messageStateController?.setOutboxSending?.(msg.message.client_id, false);
                if (isVisibleCurrentChat) promoteOutboxRow(msg.message.client_id, msg.message, { mediaAutoScrollToBottom: true });
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
              chatListService.incrementUnread(msg.message.chat_id, msg.message.id);
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
                  chatListService.incrementUnread(currentChatId, msg.message.id);
                }
                saveCurrentScrollAnchor(currentChatId, { force: true });
                updateScrollBottomButton();
              } else if (!isOwnIncomingMessage && (!wasNearBottom || document.hidden)) {
                chatListService.incrementUnread(currentChatId, msg.message.id);
              }
            }
            if (
              Number(msg.message.chat_id || 0) === Number(currentChatId || 0)
              && String(msg.message.ai_bot_kind || '').toLowerCase() !== 'chatshot'
            ) {
              const state = getCurrentChatShotState();
              if (state) {
                state.message_count = Number(state.message_count || 0) + 1;
                state.ready = Boolean(state.enabled && state.botId && state.message_count >= 2);
                chatShotStateByChat.set(Number(currentChatId), state);
                syncChatShotButton();
                if (!chatInfoModal?.classList.contains('hidden')) renderChatShotForm(state);
              }
            }
            // Fallback notification for old/no-push browsers while this page is still running.
            if (
              document.hidden &&
              msg.message.user_id !== currentUser.id &&
              'Notification' in window &&
              Notification.permission === 'granted' &&
              notificationSettingsController.getSettings().push_enabled &&
              ((isMentionForMe && notificationSettingsController.getSettings().notify_mentions !== false) ||
                (notificationSettingsController.getSettings().notify_messages && isChatNotificationEnabled(msg.message.chat_id))) &&
              !notificationSettingsController.isPushDeviceSubscribed()
            ) {
              const title = isMentionForMe ? `${msg.message.display_name} \u0443\u043f\u043e\u043c\u044f\u043d\u0443\u043b(\u0430) \u0432\u0430\u0441` : msg.message.display_name;
              const body = msg.message.text || (msg.message.is_voice_note ? msg.message.transcription_text : '') || '\ud83d\udcce File';
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
            chatListService.setOnlineUsers(msg.userIds);
            refreshChatListReferences();
            break;
          }
          case 'typing': {
            if (msg.chatId === currentChatId && msg.userId !== currentUser.id) {
              if (msg.isTyping === false) hideTyping(msg.username);
              else showTyping(msg.username, msg);
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
            if (chatListService.hasActiveChatListRequest()) break;
            loadChats({ silent: true }).catch(() => {});
            break;
          }
          case 'chat_folders_updated': {
            loadChatFolders({ silent: true }).catch(() => {});
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
                    statusEl.textContent = '\u2713\u2713';
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
          case 'voice_settings_updated':
          case 'video_note_settings_updated': {
            window.BananzaVoiceHooks?.handleWSMessage?.(msg);
            window.BananzaVideoNoteHooks?.handleWSMessage?.(msg);
            window.BananzaVideoNoteAdminHooks?.handleWSMessage?.(msg);
            break;
          }
          case 'call_invite':
          case 'call_updated':
          case 'call_participant_updated':
          case 'call_ended':
          case 'call_ai_notes_updated':
          case 'call_settings_updated': {
            window.BananzaCallHooks?.handleWSMessage?.(msg);
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
          case 'chatshot_bots_updated': {
            invalidateChatShotState(msg.chatId || msg.chat_id);
            if (Number(msg.chatId || msg.chat_id || 0) === Number(currentChatId || 0)) {
              loadChatShotState(currentChatId, { force: true }).catch(() => {});
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
    
      function sendTyping(...args) { return composerTypingDragDropController?.sendTyping?.(...args); }
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // CHAT LIST
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function scheduleMessageBackgroundSync(delayMs = 450) {
        return openChatController.scheduleMessageBackgroundSync(delayMs);
      }
    
      function shouldBackgroundSyncMessages() {
        return openChatController.shouldBackgroundSyncMessages();
      }
    
      async function syncChatMessagesInBackground(chat, { allowColdPrewarm = false } = {}) {
        return openChatController.syncChatMessagesInBackground(chat, { allowColdPrewarm });
      }
    
      async function runMessageBackgroundSync() {
        return openChatController.runMessageBackgroundSync();
      }
    
      function updateScrollBottomButton() {
        return scrollController.updateScrollBottomButton();
      }
    
      function normalizeMemberLastReads(value) {
        return readReceiptController.normalizeMemberLastReads(value);
      }
    
      function getChatMemberLastReads(chatId) {
        return readReceiptController.getChatMemberLastReads(chatId);
      }
    
      function storeChatMemberLastReads(chatId, incomingReads, { replace = false } = {}) {
        return readReceiptController.storeChatMemberLastReads(chatId, incomingReads, { replace });
      }
    
      function getChatReadReceiptThreshold(chatId) {
        return readReceiptController.getChatReadReceiptThreshold(chatId);
      }
    
      function applyOwnReadStateToMessage(msg, chatId = msg?.chat_id || msg?.chatId || currentChatId) {
        return readReceiptController.applyOwnReadStateToMessage(msg, chatId);
      }
    
      function applyOwnReadStateToMessages(chatId, messages = []) {
        return readReceiptController.applyOwnReadStateToMessages(chatId, messages);
      }
    
function updateVisibleOwnReadState(chatId = currentChatId) {
        return readReceiptController.updateVisibleOwnReadState(chatId);
      }
    
      function updateLocalChatReadProgress(chatId, lastReadId) {
        return readReceiptController.updateLocalChatReadProgress(chatId, lastReadId);
      }
    
      async function reconcileChatReadState(chatId, incomingReads, { replace = false, updateVisible = false } = {}) {
        return readReceiptController.reconcileChatReadState(chatId, incomingReads, { replace, updateVisible });
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
    
      function rememberDisplayedMessage(id) {
        return messageStateController?.rememberDisplayedMessage?.(id);
      }
    
      function forgetDisplayedMessage(id) {
        return messageStateController?.forgetDisplayedMessage?.(id);
      }
    
      function isMessageDisplayed(id) {
        return Boolean(messageStateController?.isMessageDisplayed?.(id));
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
    
      function isDeletedMessageRow(row) {
        return Boolean(row?.__messageData?.is_deleted);
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
    

      function renderAdminUserRow(u) {
        return adminUsersController.renderAdminUserRow(u);
      }
    
      function refreshAdminUserStatuses() {
        return adminUsersController.refreshAdminUserStatuses();
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
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // CHAT SHELL AND COMPOSER DRAFTS
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function normalizeComposerDraftChatId(...args) { return composerStateController.normalizeComposerDraftChatId(...args); }
    
      function getComposerDraftStorageKey(...args) { return composerStateController.getComposerDraftStorageKey(...args); }
    
      function persistComposerDrafts(...args) { return composerStateController.persistComposerDrafts(...args); }
    
      function hydrateComposerDraftsForCurrentUser(...args) { return composerStateController.hydrateComposerDraftsForCurrentUser(...args); }
    
      function saveComposerDraft(chatId = currentChatId) {
        if (!normalizeComposerDraftChatId(chatId) || composerStateController.editTo || !msgInput) return;
        composerStateController.saveComposerDraftValue(chatId, getComposerTextValue());
      }
    
      function clearComposerDraft(chatId = currentChatId) { return composerStateController.clearComposerDraft(chatId); }
    
      function restoreComposerDraft(chatId = currentChatId) {
        if (!normalizeComposerDraftChatId(chatId) || !msgInput) return;
        setComposerTextValue(composerStateController.getComposerDraft(chatId) || '');
        autoResize();
        syncMentionOpenButton();
        window.BananzaVoiceHooks?.refreshComposerState?.();
        updateComposerAiOverrideState().catch(() => {});
      }
    
      function updateChatStatus() {
        const chat = chats.find(c => c.id === currentChatId);
        if (!chat) return;
        if (isNotesChat(chat)) {
          chatStatus.classList.remove('online', 'offline');
          chatStatus.textContent = '\u041b\u0438\u0447\u043d\u044b\u0439 \u0447\u0430\u0442';
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
                chatStatus.innerHTML = `<span class="admin-user-status online"><span class="status-dot"></span><span class="admin-user-status-label">\u0412\u0441\u0435 \u0432 \u0441\u0431\u043e\u0440\u0435</span></span>`;
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
        return mediaPlaybackController.resolveMediaPlaybackChatId(message);
      }
    
      function resolveMediaPlaybackKey(message = {}, role = '') {
        return mediaPlaybackController.resolveMediaPlaybackKey(message, role);
      }
    
      function normalizeMediaPlaybackCompletedEntries(source = null) {
        return mediaPlaybackController.normalizeMediaPlaybackCompletedEntries(source);
      }
    
      function getMediaPlaybackCompletedBucket(chatId, { create = false } = {}) {
        return mediaPlaybackController.getMediaPlaybackCompletedBucket(chatId, { create });
      }
    
      function applyMediaPlaybackCompletedMeta(chatId, source = null) {
        return mediaPlaybackController.applyMediaPlaybackCompletedMeta(chatId, source);
      }
    
      function exportMediaPlaybackCompletedMeta(chatId) {
        return mediaPlaybackController.exportMediaPlaybackCompletedMeta(chatId);
      }
    
      function primeMediaPlaybackCompletedCache(chatId, meta = null) {
        return mediaPlaybackController.primeMediaPlaybackCompletedCache(chatId, meta);
      }
    
      function isMediaPlaybackCompleted(message = {}, role = '') {
        return mediaPlaybackController.isMediaPlaybackCompleted(message, role);
      }
    
      function setMediaPlaybackCompleted(message = {}, role = '', completed) {
        return mediaPlaybackController.setMediaPlaybackCompleted(message, role, completed);
      }
    
      function isMediaPlaybackNearEnd(mediaEl, epsilon = 0.08) {
        return mediaPlaybackController.isMediaPlaybackNearEnd(mediaEl, epsilon);
      }
    
      function getMediaPlaybackBucket(chatId, { create = false } = {}) {
        return mediaPlaybackController.getMediaPlaybackBucket(chatId, { create });
      }
    
      function readMediaPlaybackState(message = {}, role = '') {
        return mediaPlaybackController.readMediaPlaybackState(message, role);
      }
    
      function writeMediaPlaybackState(message = {}, role = '', snapshot = null) {
        return mediaPlaybackController.writeMediaPlaybackState(message, role, snapshot);
      }
    
      function clearMediaPlaybackState(message = {}, role = '') {
        return mediaPlaybackController.clearMediaPlaybackState(message, role);
      }
    
      function captureBoundMediaPlaybackState(mediaEl) {
        return mediaPlaybackController.captureBoundMediaPlaybackState(mediaEl);
      }
    
      function bindMediaPlaybackState(mediaEl, message = {}, role = '') {
        return mediaPlaybackController.bindMediaPlaybackState(mediaEl, message, role);
      }
    
      function pauseCurrentChatMediaPlayback() {
        return mediaPlaybackController.pauseCurrentChatMediaPlayback();
      }
    
      function getMediaNoteFallbackLabel(msg, { voiceLabel = '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435', videoLabel = '\u0412\u0438\u0434\u0435\u043e-\u0437\u0430\u043c\u0435\u0442\u043a\u0430' } = {}) {
        if (!msg?.is_voice_note) return '';
        return msg?.is_video_note ? videoLabel : voiceLabel;
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
        if (!scrollBottomBtn || !isMobileLayoutViewport()) return false;
        if (!isMobileComposerKeyboardOpen()) return false;
        if (e?.type === 'pointerdown' || e?.type === 'pointerup') {
          if (typeof e.button === 'number' && e.button !== 0) return false;
          if (e.pointerType === 'mouse') return false;
        }
        return true;
      }
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function getReplySnapshot(...args) { return composerReplyEditController?.getReplySnapshot?.(...args) || null; }
    
      // COMPOSER SEND
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      async function saveEditedMessage(...args) { return composerSendController?.saveEditedMessage?.(...args); }
    
      async function sendMessage(...args) { return composerSendController?.sendMessage?.(...args); }
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // FILE UPLOAD
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      async function uploadFiles(...args) { return composerFilesController?.uploadFiles?.(...args); }
    
      function renderPendingFiles(...args) { return composerFilesController?.renderPendingFiles?.(...args); }
    
      function clearPendingFile(...args) { return composerFilesController?.clearPendingFile?.(...args); }
    
      function hideAttachMenu(...args) { return composerFilesController?.hideAttachMenu?.(...args); }
    
      // REPLY
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function getReplyPreviewText(...args) { return composerReplyEditController?.getReplyPreviewText?.(...args) || 'Attachment'; }
    
      function getReplyQuoteText(...args) { return composerReplyEditController?.getReplyQuoteText?.(...args) || 'Attachment'; }
    
      function canEditMessage(...args) { return Boolean(composerReplyEditController?.canEditMessage?.(...args)); }
    
      function canForwardMessage(...args) { return Boolean(composerReplyEditController?.canForwardMessage?.(...args)); }
    
      function canSaveMessageToNotes(...args) { return Boolean(composerReplyEditController?.canSaveMessageToNotes?.(...args)); }
    
      function getEditableText(...args) { return composerReplyEditController?.getEditableText?.(...args) || ''; }
    
      function getSelectedMessageFragment(...args) { return composerReplyEditController?.getSelectedMessageFragment?.(...args) || ''; }
    
      function isSelectableMessageTextTarget(...args) { return Boolean(composerReplyEditController?.isSelectableMessageTextTarget?.(...args)); }
    
      function getMessageCopyTextData(...args) { return composerReplyEditController?.getMessageCopyTextData?.(...args) || { text: '', hasMeaningfulContent: false }; }
    
      function getMessageCopyText(...args) { return composerReplyEditController?.getMessageCopyText?.(...args) || ''; }
    
      async function copyMessageFromRow(...args) { return composerReplyEditController?.copyMessageFromRow?.(...args); }
    
      function setReplyFromRow(...args) { return composerReplyEditController?.setReplyFromRow?.(...args); }
    
      function setReply(...args) { return composerReplyEditController?.setReply?.(...args); }
    
      function clearReply(...args) { return composerReplyEditController?.clearReply?.(...args); }
    
      function setEditFromRow(...args) { return composerReplyEditController?.setEditFromRow?.(...args); }
    
      function clearEdit(...args) { return composerReplyEditController?.clearEdit?.(...args); }
    
      function setupMessageSwipeGestures(...args) { return composerReplyEditController?.setupMessageSwipeGestures?.(...args); }
    
      // INTERACTIONS
      function getReactionPickerMsgId() { return reactionController?.getReactionPickerMsgId?.() || null; }
      function getReactionPickerKeepKeyboard() { return Boolean(reactionController?.getReactionPickerKeepKeyboard?.()); }
      function getActiveMessageActionsRow() { return floatingMessageActionsController?.getActiveMessageActionsRow?.() || null; }
      function getActiveMessageActionsEl() { return floatingMessageActionsController?.getActiveMessageActionsEl?.() || null; }
      function getFloatingMessageActionsState() { return floatingMessageActionsController?.getFloatingMessageActionsState?.() || null; }
    
      function isSearchPanelOpen() { return Boolean(searchController?.isSearchPanelOpen?.()); }
      function clearSearchResults() { return searchController?.clearSearchResults?.(); }
      function updateSearchTriggerState(active) { return searchController?.updateSearchTriggerState?.(active); }
      function renderSearchResultsEmpty(message) { return searchController?.renderSearchResultsEmpty?.(message); }
      function renderSearchScopeToggle() { return searchController?.renderSearchScopeToggle?.(); }
      function clearSearchPanelTransitionState() { return searchController?.clearSearchPanelTransitionState?.(); }
      function ensureSearchPanelReady() { return searchController?.ensureSearchPanelReady?.(); }
      function getSearchPanelTransitionFallbackMs() { return searchController?.getSearchPanelTransitionFallbackMs?.() || MODAL_TRANSITION_BUFFER_MS; }
      function focusSearchInput() { return searchController?.focusSearchInput?.(); }
      function flushSearchPanelPendingAction() { return searchController?.flushSearchPanelPendingAction?.(); }
      function queueSearchPanelPendingAction(action) { return Boolean(searchController?.queueSearchPanelPendingAction?.(action)); }
      function shouldAutoFocusSearchInput() { return searchController?.shouldAutoFocusSearchInput?.() ?? true; }
      function horizontalPagerCommitDistance(width) { return searchController?.horizontalPagerCommitDistance?.(width) || Math.max(1, Math.round(Number(width || 0) * 0.22)); }
      function canAnimateHorizontalPager() { return Boolean(searchController?.canAnimateHorizontalPager?.()); }
      function stripCloneIds(rootEl) { return searchController?.stripCloneIds?.(rootEl) || rootEl; }
      function syncClonedFormControls(sourceRoot, cloneRoot) { return searchController?.syncClonedFormControls?.(sourceRoot, cloneRoot) || cloneRoot; }
      function createHorizontalSwipePager(options = {}) { return searchController?.createHorizontalSwipePager?.(options) || null; }
      function cancelScheduledScrollableItemCenter(strip) { return searchController?.cancelScheduledScrollableItemCenter?.(strip); }
      function centerScrollableItem(strip, item, options = {}) { return Boolean(searchController?.centerScrollableItem?.(strip, item, options)); }
      function scheduleScrollableItemCenter(strip, activeSelector, options = {}) { return Boolean(searchController?.scheduleScrollableItemCenter?.(strip, activeSelector, options)); }
      function openSearchPanel(options = {}) { return searchController?.openSearchPanel?.(options); }
      function closeSearchPanel(options = {}) { return Boolean(searchController?.closeSearchPanel?.(options)); }
      function performSearch(options = {}) { return searchController?.performSearch?.(options); }
      function scrollToMessage(msgId, options = {}) { return Boolean(searchController?.scrollToMessage?.(msgId, options)); }
      async function jumpToSearchResult(result) { return searchController?.jumpToSearchResult?.(result) || false; }
      async function animateSearchResultChatSwitch(targetChatId) { return searchController?.animateSearchResultChatSwitch?.(targetChatId); }
      function formatSearchResultTimestamp(value) { return searchController?.formatSearchResultTimestamp?.(value) || ''; }
      function suppressSearchPanelFollowupClick(ms) { return searchController?.suppressSearchPanelFollowupClick?.(ms); }
    
      function isFloatingSurfaceVisible(el) { return floatingMessageActionsController?.isFloatingSurfaceVisible?.(el) ?? Boolean(el && !el.classList.contains('hidden')); }
      function getFloatingViewportRect() { return floatingMessageActionsController?.getFloatingViewportRect?.() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, right: window.innerWidth, bottom: window.innerHeight }; }
      function clamp(value, min, max) { return floatingMessageActionsController?.clamp?.(value, min, max) ?? Math.max(min, Math.min(value, max)); }
      function findMessageRowById(msgId) { return floatingMessageActionsController?.findMessageRowById?.(msgId) || null; }
      function getFloatingMessageActionRow() { return floatingMessageActionsController?.getFloatingMessageActionRow?.() || null; }
      function updateFloatingMessageActionsState(row, options = {}) { return floatingMessageActionsController?.updateFloatingMessageActionsState?.(row, options) || null; }
      function clearFloatingMessageActionsStateIfClosed() { return floatingMessageActionsController?.clearFloatingMessageActionsStateIfClosed?.(); }
      function suppressNextMessageActionTap(ms) { return floatingMessageActionsController?.suppressNextMessageActionTap?.(ms); }
      function measureFloatingSurface(el, fallbackWidth, fallbackHeight) { return floatingMessageActionsController?.measureFloatingSurface?.(el, fallbackWidth, fallbackHeight) || { width: fallbackWidth, height: fallbackHeight }; }
      function openFloatingSurface(el) { return floatingMessageActionsController?.openFloatingSurface?.(el); }
      function closeFloatingSurface(el, options = {}) { return floatingMessageActionsController?.closeFloatingSurface?.(el, options); }
      function getVisibleMessageAreaRect() { return floatingMessageActionsController?.getVisibleMessageAreaRect?.() || getFloatingViewportRect(); }
      function measureMessageActions(row) { return floatingMessageActionsController?.measureMessageActions?.(row) || { width: 178, height: 36 }; }
      function getMessageActionsElement(row) { return floatingMessageActionsController?.getMessageActionsElement?.(row) || row?.querySelector?.('.msg-actions') || null; }
      function portalMessageActions(row) { return floatingMessageActionsController?.portalMessageActions?.(row) || null; }
      function restoreMessageActions(actions) { return floatingMessageActionsController?.restoreMessageActions?.(actions); }
      function clearMessageActionsPlacement(row) { return floatingMessageActionsController?.clearMessageActionsPlacement?.(row); }
      function resolveMessageActionLayout(row, options = {}) { return floatingMessageActionsController?.resolveMessageActionLayout?.(row, options) || null; }
      function positionFloatingElement(el, left, top) { return floatingMessageActionsController?.positionFloatingElement?.(el, left, top); }
      function applyMessageActionsLayout(row, layout) { return Boolean(floatingMessageActionsController?.applyMessageActionsLayout?.(row, layout)); }
      function positionReactionEmojiPopover() { return floatingMessageActionsController?.positionReactionEmojiPopover?.(); }
      function positionMessageActionSurfaces(options = {}) { return floatingMessageActionsController?.positionMessageActionSurfaces?.(options) || null; }
      function hideActiveMessageActions() { return floatingMessageActionsController?.hideActiveMessageActions?.(); }
      function hideFloatingMessageActions(options = {}) { return floatingMessageActionsController?.hideFloatingMessageActions?.(options); }
      function showMessageActions(row, options = {}) { return Boolean(floatingMessageActionsController?.showMessageActions?.(row, options)); }
    
      function renderReactions(reactions) { return reactionController?.renderReactions?.(reactions) || ''; }
      function updateReactionBar(msgId, reactions) { return reactionController?.updateReactionBar?.(msgId, reactions); }
      function renderQuickReactionButtonsHtml(options = {}) { return reactionController?.renderQuickReactionButtonsHtml?.(options) || ''; }
      function renderReactionPickerContent() { return reactionController?.renderReactionPickerContent?.(); }
      function showReactionPicker(row, trigger, options = {}) { return reactionController?.showReactionPicker?.(row, trigger, options); }
      function hideReactionPicker(options = {}) { return reactionController?.hideReactionPicker?.(options); }
      function hideReactionUi(options = {}) { return reactionController?.hideReactionUi?.(options); }
      async function toggleReaction(msgId, emoji, options = {}) { return reactionController?.toggleReaction?.(msgId, emoji, options); }
    
      function openMediaViewer(src, type = 'image') { return mediaViewerController?.openMediaViewer?.(src, type); }
      function openImageViewer(src) { return mediaViewerController?.openImageViewer?.(src); }
      function closeMediaViewer() { return mediaViewerController?.closeMediaViewer?.(); }
      function handleMediaViewerControlActivation(event) { return Boolean(mediaViewerController?.handleMediaViewerControlActivation?.(event)); }
      function updateGalleryArrows() { return mediaViewerController?.updateGalleryArrows?.(); }
      async function galleryNav(dir) { return mediaViewerController?.galleryNav?.(dir); }
      function suppressMediaViewerFollowupClick(ms) { return mediaViewerController?.suppressMediaViewerFollowupClick?.(ms); }
    
      function clearChatContextLongPress() { return contextMenusController?.clearChatContextLongPress?.(); }
      function clearMediaContextLongPress() { return contextMenusController?.clearMediaContextLongPress?.(); }
      function getMessageMediaContextTarget(target) { return contextMenusController?.getMessageMediaContextTarget?.(target) || null; }
      function getMessageMediaKindLabel(kind) { return contextMenusController?.getMessageMediaKindLabel?.(kind) || 'File'; }
      function getDefaultMessageMediaMime(kind) { return contextMenusController?.getDefaultMessageMediaMime?.(kind) || 'application/octet-stream'; }
      function getAbsoluteMessageMediaUrl(url) { return contextMenusController?.getAbsoluteMessageMediaUrl?.(url) || ''; }
      function getMessageMediaContext(row, target) { return contextMenusController?.getMessageMediaContext?.(row, target) || null; }
      function canShareMediaFileContext(context) { return Boolean(contextMenusController?.canShareMediaFileContext?.(context)); }
      async function fetchMessageMediaBlob(context) { return contextMenusController?.fetchMessageMediaBlob?.(context); }
      async function copyImageFromMediaContext(context) { return contextMenusController?.copyImageFromMediaContext?.(context); }
      async function shareMediaFromContext(context) { return contextMenusController?.shareMediaFromContext?.(context); }
      function renderMediaContextMenu(context) { return contextMenusController?.renderMediaContextMenu?.(context); }
      function positionMediaContextMenu() { return contextMenusController?.positionMediaContextMenu?.(); }
      function hideMediaContextMenu(options = {}) { return contextMenusController?.hideMediaContextMenu?.(options); }
      function showMediaContextMenuForRow(row, target, options = {}) { return contextMenusController?.showMediaContextMenuForRow?.(row, target, options); }
      function showMediaContextMenuForContext(context, options = {}) { return contextMenusController?.showMediaContextMenuForContext?.(context, options); }
      async function handleMediaContextMenuAction(action, context) { return contextMenusController?.handleMediaContextMenuAction?.(action, context); }
      function renderChatContextMenu(chat) { return contextMenusController?.renderChatContextMenu?.(chat); }
      function positionChatContextMenu() { return contextMenusController?.positionChatContextMenu?.(); }
      function hideChatContextMenu(options = {}) { return contextMenusController?.hideChatContextMenu?.(options); }
      function showChatContextMenuForRow(row, options = {}) { return contextMenusController?.showChatContextMenuForRow?.(row, options); }
      async function updateChatContextPreference(chatId, changes) { return contextMenusController?.updateChatContextPreference?.(chatId, changes); }
      async function handleChatContextMenuAction(action, chatId) { return contextMenusController?.handleChatContextMenuAction?.(action, chatId); }
    
      function setForwardMessageStatus(message = '', type = '') { return forwardingController?.setForwardMessageStatus?.(message, type); }
      function resetForwardMessageModal() { return forwardingController?.resetForwardMessageModal?.(); }
      function closeForwardMessageModal(options = {}) { return forwardingController?.closeForwardMessageModal?.(options); }
      function renderForwardChatList(filter = '') { return forwardingController?.renderForwardChatList?.(filter); }
      function openForwardMessageModal(message) { return forwardingController?.openForwardMessageModal?.(message); }
      async function forwardMessageToChat(targetChatId) { return forwardingController?.forwardMessageToChat?.(targetChatId); }
      async function saveMessageToNotes(message, button = null) { return forwardingController?.saveMessageToNotes?.(message, button); }
    
      // SIDEBAR RESIZE
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
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
          if (isMobileLayoutViewport()) {
            sidebar.style.width = '';
            return;
          }
          const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY) || 0);
          if (saved > 0) sidebar.style.width = `${clampSidebarWidth(saved)}px`;
          else sidebar.style.width = `${clampSidebarWidth(sidebar.offsetWidth || 320)}px`;
        }
    
        function persistSidebarWidth(width = sidebar.offsetWidth) {
          if (isMobileLayoutViewport()) return;
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
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // DRAG & DROP
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function handleDragEnter(...args) { return composerTypingDragDropController?.handleDragEnter?.(...args); }
    
      function handleDragOver(...args) { return composerTypingDragDropController?.handleDragOver?.(...args); }
    
      function handleDragLeave(...args) { return composerTypingDragDropController?.handleDragLeave?.(...args); }
    
      function handleDrop(...args) { return composerTypingDragDropController?.handleDrop?.(...args); }
    
      function renderTypingBar(...args) { return composerTypingDragDropController?.renderTypingBar?.(...args); }
    
      function showTyping(...args) { return composerTypingDragDropController?.showTyping?.(...args); }
    
      function hideTyping(...args) { return composerTypingDragDropController?.hideTyping?.(...args); }
    
      // EMOJI PICKER
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function normalizeRecentEmojiValue(...args) { return composerEmojiPickerController?.normalizeRecentEmojiValue?.(...args) || ''; }
    
      function isValidRecentEmojiValue(...args) { return Boolean(composerEmojiPickerController?.isValidRecentEmojiValue?.(...args)); }
    
      function normalizeRecentEmojiList(...args) { return composerEmojiPickerController?.normalizeRecentEmojiList?.(...args) || []; }
    
      function mergeRecentEmojiLists(...args) { return composerEmojiPickerController?.mergeRecentEmojiLists?.(...args) || []; }
    
      function getRecentEmojiStorageKey(...args) { return composerEmojiPickerController?.getRecentEmojiStorageKey?.(...args) || ''; }
    
      function getRecentEmojiCategory(...args) { return composerEmojiPickerController?.getRecentEmojiCategory?.(...args) || ''; }
    
      function loadLocalRecentEmojis(...args) { return composerEmojiPickerController?.loadLocalRecentEmojis?.(...args) || []; }
    
      function persistLocalRecentEmojis(...args) { return composerEmojiPickerController?.persistLocalRecentEmojis?.(...args); }
    
      async function loadRecentEmojis(...args) { return composerEmojiPickerController?.loadRecentEmojis?.(...args); }
    
      function rememberRecentEmoji(...args) { return composerEmojiPickerController?.rememberRecentEmoji?.(...args); }
    
      function syncRecentEmojiToServer(...args) { return composerEmojiPickerController?.syncRecentEmojiToServer?.(...args) || Promise.resolve(null); }
    
      function getEmojiPickerCategories(...args) { return composerEmojiPickerController?.getEmojiPickerCategories?.(...args) || []; }
    
      function isCustomEmojiCategory(...args) { return Boolean(composerEmojiPickerController?.isCustomEmojiCategory?.(...args)); }
    
      function getEmojiCategoryItems(...args) { return composerEmojiPickerController?.getEmojiCategoryItems?.(...args) || []; }
    
      function getEmojiCategoryLabel(...args) { return composerEmojiPickerController?.getEmojiCategoryLabel?.(...args) || ''; }
    
      function renderEmojiGridItemHtml(...args) { return composerEmojiPickerController?.renderEmojiGridItemHtml?.(...args) || ''; }
    
      function renderEmojiGridItemsHtml(...args) { return composerEmojiPickerController?.renderEmojiGridItemsHtml?.(...args) || ''; }
    
      function renderEmojiPickerGrid(...args) { return composerEmojiPickerController?.renderEmojiPickerGrid?.(...args); }
    
      function setEmojiPickerCategory(...args) { return composerEmojiPickerController?.setEmojiPickerCategory?.(...args); }
    
      function initEmojiPicker(...args) { return composerEmojiPickerController?.initEmojiPicker?.(...args); }
    
      function syncEmojiPickerButton(...args) { return composerEmojiPickerController?.syncEmojiPickerButton?.(...args); }
    
      function positionEmojiPicker(...args) { return composerEmojiPickerController?.positionEmojiPicker?.(...args); }
    
      function openEmojiPicker(...args) { return composerEmojiPickerController?.openEmojiPicker?.(...args) || false; }
    
      function closeEmojiPicker(...args) { return composerEmojiPickerController?.closeEmojiPicker?.(...args); }
    
      function dismissEmojiPickerOutsideGesture(...args) { return composerEmojiPickerController?.dismissEmojiPickerOutsideGesture?.(...args); }
    
      function toggleEmojiPicker(...args) { return composerEmojiPickerController?.toggleEmojiPicker?.(...args) || false; }
    
      // MODALS
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // New chat modal
      function getSelectableFolderChats() { return newFolderTabController.getSelectableFolderChats(); }
      function getSelectedNewFolderChatIds() { return newFolderTabController.getSelectedNewFolderChatIds(); }
      function renderNewFolderChatList(filter = '') { return newFolderTabController.renderNewFolderChatList(filter); }
      function resetNewFolderForm() { return newFolderTabController.resetNewFolderForm(); }
    
      const NEW_CHAT_MODAL_TABS = Object.freeze(['private', 'group', 'folder']);
    
      function normalizeNewChatModalTab(tabName = 'private') {
        const nextTab = String(tabName || 'private');
        return NEW_CHAT_MODAL_TABS.includes(nextTab) ? nextTab : 'private';
      }
    
      function getNewChatModalActiveTab() {
        const activeTab = newChatModal?.querySelector?.('.modal-tab.active')?.dataset?.tab;
        return normalizeNewChatModalTab(activeTab);
      }
    
      function getNewChatTabPane(tabName = 'private') {
        const nextTab = normalizeNewChatModalTab(tabName);
        return newChatModal?.querySelector?.(`#${nextTab}Tab`) || null;
      }
    
      function prepareNewChatTabContent(tabName = 'private') {
        const nextTab = normalizeNewChatModalTab(tabName);
        if (nextTab === 'folder') {
          renderNewFolderChatList(newFolderChatSearchInput?.value || '');
        }
        return nextTab;
      }
    
      function createNewChatTabPreview(tabName = 'private') {
        const nextTab = prepareNewChatTabContent(tabName);
        const pane = getNewChatTabPane(nextTab);
        if (!(pane instanceof HTMLElement)) return document.createElement('div');
        const clone = pane.cloneNode(true);
        syncClonedFormControls(pane, clone);
        stripCloneIds(clone);
        clone.classList.add('active');
        clone.classList.remove('horizontal-swipe-live');
        clone.setAttribute('aria-hidden', 'true');
        return clone;
      }
    
      function applyNewChatModalTab(tabName = 'private') {
        if (!newChatModal) return;
        const nextTab = prepareNewChatTabContent(tabName);
        newChatModal.querySelectorAll('.modal-tab').forEach((tab) => {
          tab.classList.toggle('active', tab.dataset.tab === nextTab);
        });
        newChatModal.querySelectorAll('.tab-pane').forEach((pane) => {
          const isActive = pane.id === `${nextTab}Tab`;
          pane.classList.toggle('active', isActive);
          pane.classList.toggle('horizontal-swipe-live', isActive);
        });
        return nextTab;
      }
    
      function setNewChatModalTab(tabName = 'private', { animate = false, direction = 0, source = 'tab' } = {}) {
        const nextTab = normalizeNewChatModalTab(tabName);
        if (animate && newChatTabSwipePager && getNewChatModalActiveTab() !== nextTab) {
          return newChatTabSwipePager.goToKey(nextTab, { direction, source });
        }
        return applyNewChatModalTab(nextTab);
      }
    
      function initNewChatTabSwipePager() {
        const body = newChatModal?.querySelector?.('.modal-body');
        const tabs = newChatModal?.querySelector?.('.modal-tabs');
        if (!(body instanceof HTMLElement)) return null;
        newChatTabSwipePager?.destroy();
        newChatTabSwipePager = createHorizontalSwipePager({
          root: body,
          listenTargets: [tabs],
          getKeys: () => NEW_CHAT_MODAL_TABS,
          getActiveKey: () => getNewChatModalActiveTab(),
          setActiveKey: (tabName) => {
            applyNewChatModalTab(tabName);
          },
          renderPage: (tabName) => createNewChatTabPreview(tabName),
          pageGap: 16,
          isAvailable: () => isFloatingSurfaceVisible(newChatModal),
          getCommitDistance: (width) => Math.max(32, Math.min(
            48,
            Math.round(Math.max(1, Number(width || 0)) * 0.12)
          )),
          isAllowedStartTarget: (target) => {
            if (!(target instanceof Element)) return false;
            if (target.closest('.modal-tabs .modal-tab')) return true;
            return !target.closest('button, a, input, textarea, select, label, [contenteditable="true"]');
          },
        });
        applyNewChatModalTab(getNewChatModalActiveTab());
        return newChatTabSwipePager;
      }
    
      async function openNewChatModal() {
        openModal('newChatModal', { replaceStack: true });
        newChatTabSwipePager?.reset();
        setNewChatModalTab('private');
        $('#groupName').value = '';
        resetNewFolderForm();
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
          renderNewFolderChatList();
        } catch {}
      }
    
      // Admin modal
      async function openAdminModal() {
        return adminUsersController.openAdminModal();
      }
    
      async function openAdminBotAuditModal(userId, displayName = 'User') {
        return adminBotAuditController.openAdminBotAuditModal(userId, displayName);
      }
    
      function setBackupExportStatus(message, type = '') {
        return adminBackupController.setBackupExportStatus(message, type);
      }
    
      function setBackupRestoreStatus(message, type = '') {
        return adminBackupController.setBackupRestoreStatus(message, type);
      }
    
      function syncBackupRestoreFileName() {
        return adminBackupController.syncBackupRestoreFileName();
      }
    
      function resetBackupRestoreState({ clearFile = false } = {}) {
        return adminBackupController.resetBackupRestoreState({ clearFile });
      }
    
      function renderBackupRestorePreview(data = {}) {
        return adminBackupController.renderBackupRestorePreview(data);
      }
    
      function openBackupExportModal() {
        return adminBackupController.openBackupExportModal();
      }
    
      async function downloadBackupExport() {
        return adminBackupController.downloadBackupExport();
      }
    
      async function previewBackupRestore() {
        return adminBackupController.previewBackupRestore();
      }
    
      async function applyBackupRestore() {
        return adminBackupController.applyBackupRestore();
      }
    
      // Settings modal
      function openSettingsModal(opener = $('#settingsBtn')) { return settingsModalController.openSettingsModal(opener); }
      function openLanguageSettingsModal() { return settingsModalController.openLanguageSettingsModal(); }
      function openThemeSettingsModal() { return settingsModalController.openThemeSettingsModal(); }
      function openVisualModeSettingsModal() { return settingsModalController.openVisualModeSettingsModal(); }
      function openPollStyleSettingsModal() { return settingsModalController.openPollStyleSettingsModal(); }
      function openAnimationSettingsModal() { return settingsModalController.openAnimationSettingsModal(); }
      function openMobileFontSettingsModal() { return settingsModalController.openMobileFontSettingsModal(); }
      function openWeatherSettingsModal() { return settingsModalController.openWeatherSettingsModal(); }
      function openNotificationSettingsModal() { return settingsModalController.openNotificationSettingsModal(); }
      function openSoundSettingsModal() { return settingsModalController.openSoundSettingsModal(); }
      function openAiBotSettingsModal() {
        if (!currentUser?.is_admin) return;
        openModal('aiBotSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
        resetManagedModalScroll('aiBotSettingsModal');
        setAiBotModalStatus('\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e...', 'pending');
        Promise.all([loadAiBotState(), loadOpenAiUniversalState(), loadOpenAiImageState()]).then(() => {
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
        setAiBotTextModalStatus('\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e...', 'pending');
        loadAiBotState().then(() => {
          renderOpenAiTextBotsSettings();
          resetManagedModalScroll('openAiTextBotsModal');
          setAiBotTextModalStatus('');
        }).catch((e) => {
          setAiBotTextModalStatus(e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c OpenAI text bots', 'error');
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
    
      function openOpenAiImageBotsModal() {
        if (!currentUser?.is_admin) return;
        openModal('openAiImageBotsModal', { replaceStack: false, opener: $('#openAiOpenImageBots') });
        resetManagedModalScroll('openAiImageBotsModal');
        setOpenAiImageModalStatus('Loading...', 'pending');
        const hasState = openAiImageState.chats.length || openAiImageState.bots.length;
        if (hasState) {
          renderOpenAiImageSettings();
          resetManagedModalScroll('openAiImageBotsModal');
          setOpenAiImageModalStatus('Refreshing...', 'pending');
        }
        loadOpenAiImageState().then(() => {
          renderOpenAiImageSettings();
          resetManagedModalScroll('openAiImageBotsModal');
          setOpenAiImageModalStatus('');
        }).catch((e) => {
          setOpenAiImageModalStatus(e.message || 'Could not load OpenAI image bots', 'error');
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
    
      function openQwenAiSettingsModal() {
        if (!currentUser?.is_admin) return;
        openModal('qwenAiSettingsModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
        setQwenAiStatus('Loading...');
        loadQwenAiState().then(() => setQwenAiStatus('')).catch((e) => {
          setQwenAiStatus(e.message || 'Could not load Qwen AI bots', 'error');
        });
      }
    
      function openQwenTextBotsModal() {
        if (!currentUser?.is_admin) return;
        ensureQwenTextBotsModalContent();
        openModal('qwenAiTextBotsModal', { replaceStack: false, opener: $('#qwenAiOpenTextBots') });
        resetManagedModalScroll('qwenAiTextBotsModal');
        setQwenBotStatus('Loading...', 'pending');
        setQwenChatStatus('');
        loadQwenAiState().then(() => {
          resetManagedModalScroll('qwenAiTextBotsModal');
          setQwenBotStatus('');
        }).catch((e) => {
          setQwenBotStatus(e.message || 'Could not load Qwen text bots', 'error');
        });
      }
    
      function resetManagedModalScroll(modalId) {
        return settingsModalController.resetManagedModalScroll(modalId);
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
      async function openChatInfoModal(opener = getChatSettingsActionOpener()) {
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
        renderChatShotForm(getCurrentChatShotState());
        loadChatShotState(currentChatId, { force: true }).catch((error) => {
          renderChatShotForm(null);
          setChatShotChatStatus(error.message || 'Could not load ChatShot', 'error');
        });
        renderChatDangerControls(chat);
        window.dispatchEvent(new CustomEvent('bananza:chatinfoopen', { detail: { chatId: currentChatId } }));
        const contextTransformToggle = $('#chatContextTransformToggle');
        if (contextTransformToggle) {
          contextTransformToggle.onchange = () => {
            saveChatContextTransformSetting().catch((error) => {
              setChatContextTransformStatus(error.message || 'Could not save context transform setting', 'error');
            });
          };
        }
        ['chatShotToggle', 'chatShotBotSelect', 'chatShotStyleSelect', 'chatShotBananaFilterToggle'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            el.onchange = () => {
              saveChatShotChatSetting().catch((error) => {
                setChatShotChatStatus(error.message || 'Could not save ChatShot setting', 'error');
              });
            };
          }
        });
    
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
            chatAvatarEl.innerHTML = chat.type === 'general' ? '\ud83c\udf10' : '\ud83d\udc65';
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
              ${canRemove && u.id !== currentUser.id ? `<button class="member-remove" data-uid="${u.id}" title="Remove">\u2715</button>` : ''}
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
                      <div class="user-list-meta">${esc(['@' + (bot.mention || ''), bot.model || ''].filter(Boolean).join(' \u2022 '))}</div>
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
    
      function setProfileStatus(message, type = '') {
        setInlineStatus('profileStatus', message, type);
      }
    
      function getProfileSelectedColor() {
        const checked = $('#colorPicker input[name="profileAvatarColor"]:checked');
        return checked?.value || currentUser?.avatar_color || AVATAR_COLORS[3];
      }
    
      function setProfileAvatarUploadPending(pending) {
        const input = $('#profileAvatarInput');
        if (input) input.disabled = !!pending;
        document.querySelectorAll('.profile-avatar-picker').forEach((button) => {
          button.classList.toggle('is-pending', !!pending);
          if (pending) button.setAttribute('aria-busy', 'true');
          else button.removeAttribute('aria-busy');
          if ('disabled' in button) button.disabled = !!pending;
        });
      }
    
      function renderProfileAvatarPreview(color = currentUser?.avatar_color) {
        const avatarEl = $('#profileAvatar');
        setAvatarElementVisual(avatarEl, {
          name: currentUser?.display_name || currentUser?.username || '',
          color: color || currentUser?.avatar_color || AVATAR_COLORS[3],
          avatarUrl: currentUser?.avatar_url || '',
        });
        $('#removeProfileAvatar')?.classList.toggle('hidden', !currentUser?.avatar_url);
      }
    
      function syncProfileColorSelection(color) {
        const selected = color || getProfileSelectedColor();
        $('#colorPicker')?.querySelectorAll('.color-swatch').forEach((swatch) => {
          const input = swatch.querySelector('input[name="profileAvatarColor"]');
          const isActive = input?.value === selected;
          swatch.classList.toggle('active', isActive);
          if (input) input.checked = isActive;
        });
        if (!currentUser?.avatar_url) renderProfileAvatarPreview(selected);
      }
    
      function renderProfileColorPicker() {
        const picker = $('#colorPicker');
        if (!picker) return;
        const selectedColor = currentUser?.avatar_color || AVATAR_COLORS[3];
        picker.innerHTML = AVATAR_COLORS.map((color, index) =>
          `<label class="color-swatch${color === selectedColor ? ' active' : ''}" style="--profile-color:${esc(color)}">
            <input type="radio" name="profileAvatarColor" value="${esc(color)}" ${color === selectedColor ? 'checked' : ''} aria-label="${esc(`${t('Avatar Color')} ${index + 1}`)}">
            <span class="color-swatch-dot" aria-hidden="true"></span>
          </label>`
        ).join('');
      }
    
      function renderProfileEditor({ preserveStatus = false } = {}) {
        if (!currentUser) return;
        renderProfileAvatarPreview();
        $('#profileDisplayPreview').textContent = currentUser.display_name || currentUser.username || '';
        $('#profileUsername').textContent = '@' + currentUser.username;
        $('#profileName').value = currentUser.display_name || '';
        renderProfileColorPicker();
        if (!preserveStatus) setProfileStatus('');
      }
    
      function openMenuDrawer(opener = $('#menuBtn')) {
        hideFloatingMessageActions({ immediate: true });
        renderProfileEditor();
        openModal('menuDrawer', { replaceStack: true, opener });
      }
    
      async function uploadProfileAvatar(file) {
        if (!file) return;
        const fd = new FormData();
        fd.append('avatar', file);
        setProfileStatus('Uploading...', 'pending');
        setProfileAvatarUploadPending(true);
        try {
          const res = await api('/api/profile/avatar', { method: 'POST', body: fd });
          applyUserUpdate(res.user || {});
          setProfileStatus('Profile saved', 'success');
        } catch (e) {
          setProfileStatus(e.message || 'Upload failed', 'error');
        } finally {
          setProfileAvatarUploadPending(false);
        }
      }
    
      async function removeProfileAvatar() {
        setProfileStatus('Removing...', 'pending');
        try {
          const res = await api('/api/profile/avatar', { method: 'DELETE' });
          applyUserUpdate(res.user || { id: currentUser.id, avatar_url: null });
          setProfileStatus('Profile saved', 'success');
        } catch (e) {
          setProfileStatus(e.message || 'Remove avatar failed', 'error');
        }
      }
    
      async function saveProfileChanges() {
        const name = $('#profileName')?.value.trim() || '';
        if (!name) {
          setProfileStatus('Name is required', 'error');
          $('#profileName')?.focus();
          return;
        }
        const color = getProfileSelectedColor();
        setProfileStatus('Saving...', 'pending');
        try {
          const res = await api('/api/profile', { method: 'PUT', body: { displayName: name, avatarColor: color } });
          applyUserUpdate(res.user || {});
          setProfileStatus('Profile saved', 'success');
        } catch (e) {
          setProfileStatus(e.message || 'Profile save failed', 'error');
        }
      }
    
      function setupProfileEvents() {
        $$('.profile-avatar-picker').forEach((button) => {
          button.addEventListener('click', () => $('#profileAvatarInput')?.click());
        });
    
        $('#profileAvatarInput')?.addEventListener('change', async (e) => {
          const file = e.target.files?.[0];
          await uploadProfileAvatar(file);
          e.target.value = '';
        });
    
        $('#removeProfileAvatar')?.addEventListener('click', () => {
          withActionButtons('removeProfileAvatar', 'Removing...', removeProfileAvatar).catch((e) => {
            setProfileStatus(e.message || 'Remove avatar failed', 'error');
          });
        });
    
        $('#colorPicker')?.addEventListener('change', (e) => {
          const input = e.target.closest('input[name="profileAvatarColor"]');
          if (!input) return;
          syncProfileColorSelection(input.value);
          setProfileStatus('');
        });
    
        $('#profileName')?.addEventListener('input', (e) => {
          const value = e.target.value.trim();
          if (value) $('#profileDisplayPreview').textContent = value;
          setProfileStatus('');
        });
    
        $('#profileForm')?.addEventListener('submit', (e) => {
          e.preventDefault();
          withActionButtons('saveProfileBtn', 'Saving...', saveProfileChanges).catch((error) => {
            setProfileStatus(error.message || 'Profile save failed', 'error');
          });
        });
      }
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // AUTO RESIZE TEXTAREA
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function getVisibleComposerToolCount(...args) { return composerTextController?.getVisibleComposerToolCount?.(...args) || 0; }
    
      function getComposerInputWidthForMode(...args) { return composerTextController?.getComposerInputWidthForMode?.(...args) || 1; }
    
      function getNormalComposerInputWidth(...args) { return composerTextController?.getNormalComposerInputWidth?.(...args) || 1; }
    
      function measureMsgInputScrollHeight(...args) { return composerTextController?.measureMsgInputScrollHeight?.(...args) || 0; }
    
      function getComposerInputTextMetrics(...args) { return composerTextController?.getComposerInputTextMetrics?.(...args) || { lineHeight: 20, paddingY: 0, borderY: 0, singleLineHeight: 20, twoLineHeight: 40 }; }
    
      function renderComposerRichPreviewContent(...args) { return composerTextController?.renderComposerRichPreviewContent?.(...args) || { html: '', hasEmoji: false, maxEmojiHeight: 0 }; }
    
      function syncComposerRichPreview(...args) { return composerTextController?.syncComposerRichPreview?.(...args) || 0; }
    
      function autoResize(...args) { return composerTextController?.autoResize?.(...args); }
    
      function animateSendButton(...args) { return composerTextController?.animateSendButton?.(...args); }
    
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
    
      function isMobileChatHistoryState(state = history.state) {
        return Boolean(state && typeof state === 'object' && Number(state.chat || 0) > 0);
      }
    
      function isResolvedMobileChatScene() {
        return Boolean(isMobileLayoutViewport() && getResolvedMobileBaseScene() === 'chat');
      }
    
      function normalizeMobileChatListHistoryState() {
        if (!isMobileLayoutViewport()) return;
        pendingMobileChatListHistoryNormalization = false;
        const currentState = history.state;
        const alreadyNormalized = Boolean(
          currentState
          && typeof currentState === 'object'
          && currentState.view === 'chatlist'
          && !Object.prototype.hasOwnProperty.call(currentState, 'chat')
        );
        if (alreadyNormalized) return;
        history.replaceState({ view: 'chatlist' }, '');
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
        hideAttachMenu({ immediate: true });
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
        void animateChatFolderContentEntry({ allowDuringMobileRoute: true });
    
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
        if (fromInAppButton && isResolvedMobileChatScene()) {
          if (isMobileChatHistoryState(history.state)) {
            pendingMobileChatListHistoryNormalization = true;
            inAppChatBackSkipNextPopstate = true;
            revealSidebarFromChat({ forceAnimation: true });
            history.back();
            return;
          }
          revealSidebarFromChat({ forceAnimation: true });
          normalizeMobileChatListHistoryState();
          return;
        }
        if (fromInAppButton && isMobileLayoutViewport()) {
          normalizeMobileChatListHistoryState();
          return;
        }
        if (isMobileChatHistoryState(history.state)) {
          history.back();
          return;
        }
        if (isResolvedMobileChatScene()) {
          revealSidebarFromChat({ forceAnimation: true });
          normalizeMobileChatListHistoryState();
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
    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      // EVENT LISTENERS
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
      function createLegacyEventScope() {
        const scope = Object.create(null);
        const bindGlobal = (name, value) => {
          if (typeof value !== 'undefined') scope[name] = value;
        };
        bindGlobal('window', window);
        bindGlobal('document', document);
        bindGlobal('$', $);
        bindGlobal('$$', $$);
        bindGlobal('console', window.console || console);
        bindGlobal('Math', window.Math || Math);
        bindGlobal('Date', window.Date || Date);
        bindGlobal('Number', window.Number || Number);
        bindGlobal('String', window.String || String);
        bindGlobal('Boolean', window.Boolean || Boolean);
        bindGlobal('Array', window.Array || Array);
        bindGlobal('Object', window.Object || Object);
        bindGlobal('Promise', window.Promise || Promise);
        bindGlobal('Set', window.Set || Set);
        bindGlobal('Map', window.Map || Map);
        bindGlobal('WeakMap', window.WeakMap || WeakMap);
        bindGlobal('RegExp', window.RegExp || RegExp);
        bindGlobal('JSON', window.JSON || JSON);
        bindGlobal('parseInt', window.parseInt || parseInt);
        bindGlobal('parseFloat', window.parseFloat || parseFloat);
        bindGlobal('encodeURIComponent', window.encodeURIComponent || encodeURIComponent);
        bindGlobal('decodeURIComponent', window.decodeURIComponent || decodeURIComponent);
        bindGlobal('URL', window.URL);
        bindGlobal('URLSearchParams', window.URLSearchParams);
        bindGlobal('FormData', window.FormData);
        bindGlobal('Blob', window.Blob);
        bindGlobal('File', window.File);
        bindGlobal('FileReader', window.FileReader);
        bindGlobal('Image', window.Image);
        bindGlobal('MutationObserver', window.MutationObserver);
        bindGlobal('IntersectionObserver', window.IntersectionObserver);
        bindGlobal('ResizeObserver', window.ResizeObserver);
        bindGlobal('localStorage', window.localStorage);
        bindGlobal('sessionStorage', window.sessionStorage);
        bindGlobal('history', window.history);
        bindGlobal('navigator', window.navigator);
        bindGlobal('location', window.location);
        bindGlobal('confirm', window.confirm?.bind?.(window));
        bindGlobal('alert', window.alert?.bind?.(window));
        bindGlobal('setTimeout', window.setTimeout?.bind?.(window) || setTimeout);
        bindGlobal('clearTimeout', window.clearTimeout?.bind?.(window) || clearTimeout);
        bindGlobal('setInterval', window.setInterval?.bind?.(window) || setInterval);
        bindGlobal('clearInterval', window.clearInterval?.bind?.(window) || clearInterval);
        bindGlobal('requestAnimationFrame', window.requestAnimationFrame?.bind?.(window) || ((callback) => window.setTimeout(callback, 16)));
        bindGlobal('cancelAnimationFrame', window.cancelAnimationFrame?.bind?.(window) || ((id) => window.clearTimeout(id)));

        const names = "          activateScrollBottomButton activeChatFolderBar activeChatFolderName activeChatFolderStrip activeChatFolderStripRows activeChatShotProvider activeContextConvertProvider activePinIndexByChat\n          addChatsToFolder adminBackupController adminBackupFactory adminBotAuditController adminBotAuditFactory adminModal adminUsersController adminUsersFactory\n          aiBotFormPayload aiBotSettingsModal aiBotSettingsPayload aiBotState aiImageRiskApi aiModelCatalog aiModelRefreshTriggeredByButton ALL_CHATS_FOLDER_ID\n          allUsers analyzeOutgoingGrokImageRisk anchorForChatOpen androidBridge animateBackButton animateChatFolderContentEntry animateChatHeaderActionButton animateSearchResultChatSwitch\n          animateSendButton animationSettingsModal api appBridge appConfig appContext appDom appDomApi\n          appendMessage appendPinEventIfVisible appendTimelineItems applyBackgroundStyleToElement applyBackupRestore applyChatBackground applyChatFolderStripVisibilityInAllChats applyChatUpdate\n          applyCurrentUserUpdateFromPresence applyMediaPlaybackCompletedMeta applyMessageActionsLayout applyMessageUpdate applyMobileFontSize applyModalAnimation applyModalAnimationSpeed applyNewChatModalTab\n          applyOwnReadStateToMessage applyOwnReadStateToMessages applyPinsUpdate applyPollUpdate applyPosterToVideoElement applyScreenRotationPreference applySoundSettings applyUiLanguage\n          applyUiTheme applyUserUpdate applyVisualMode appRuntime attachBtn attachmentHelpers AUDIO_EXTENSIONS AUDIO_MIME_TYPES\n          authService autoResize AVATAR_COLORS avatarHtml avatarMenuTargetFromEl avatarUserMenuState backBtn beginChatFolderStripPreview\n          beginMobileRouteTransition bindAsyncActionButtons bindCallArtifactMessageControls bindCallMessageControls bindCallTranscriptMessageControls bindContextConvertMessageButton bindContextOriginalRestoreButton bindMediaPlaybackState\n          bindPollControls bindPulseInlineVoterControls bindTouchSafeButtonActivation blurFocusedElementWithin BOT_SAVE_BOOLEAN_FIELDS BOT_SAVE_NUMERIC_FIELDS botChatMemberMetaText botMentionText\n          botModelText buildLocalMessageFromOutbox buildMessagesFragment buildMessagesRootChildren buildOptimisticPollState buildPinBrowserNotification buildPollComposerPreviewMessage buildPollOrbitGradient\n          buildPollRenderState buildPulsePreviewVoters buildReplyBotTarget buildTimelineItems buildVerifiedBotSaveStatus cacheCursorPage cacheMessages callArtifactImageContext\n          callArtifactImageFilename callArtifactImageMime callArtifactImageUrl callArtifactKey callArtifactLabel callArtifactProgress callArtifactStatusKind callArtifactStatusLabel\n          callArtifactTextShouldCollapse callRecordingDurationSeconds callRecordingPlaybackUrl callRecordingRoundedRectPath canAnimateChatFolderContent canAnimateChatFolderSwipe canAnimateHorizontalPager canCaptureCurrentChatScrollAnchor\n          cancelPendingMediaBottomScrollIfNeeded cancelPendingSidebarReveal cancelScheduledActiveChatFolderChipCenter cancelScheduledScrollableItemCenter canClosePollMessage canContextConvertMessage canEditMessage canForwardMessage\n          canHideChat canLeaveChat canManageContextTransformSettings canManageDestructiveChat canManagePinSettings canRestoreContextOriginalMessage canSaveMessageToNotes canShareMediaFileContext\n          canUnpinPin captureBoundMediaPlaybackState captureScrollAnchor catchUpCurrentChat centerActiveChatFolderChip centerScrollableItem centerToastTimer changePasswordModal\n          CHAT_CONTEXT_LONG_PRESS_MS CHAT_FOLDER_ICON_EMOJI CHAT_FOLDER_SWIPE_COMMIT_MIN_PX CHAT_FOLDER_SWIPE_COMMIT_RATIO CHAT_FOLDER_SWIPE_EDGE_DAMPING CHAT_FOLDER_SWIPE_EDGE_MAX_PX CHAT_FOLDER_SWIPE_START_PX CHAT_LIST_CACHE_SYNC_DEBOUNCE_MS\n          CHAT_LIST_CACHE_VERSION CHAT_LIST_PULL_MAX_OFFSET CHAT_LIST_PULL_REFRESH_OFFSET CHAT_LIST_PULL_THRESHOLD CHAT_LIST_PULL_TRIGGER_PX CHAT_LIST_REQUEST_TIMEOUT_MS chatAllowsUnpinAnyPin chatArea\n          chatAreaResizeObserver chatContextMenu chatContextMenuBackdrop chatFolderContent chatFolderContextMenu chatFolderContextMenuBackdrop chatFolderEmojiMarkup chatFolderIconEmoji\n          chatFolderIconMarkup chatFolderListSurface chatFolderManageModal chatFolderManageSaveBtn chatFolderPicker chatFolderPickerBackdrop chatFoldersBtn chatFolderStore\n          chatFolderStripLabelForSelection chatFolderStripStructureSignature chatFolderSwipePagerState chatFolderSwitchSeq chatHeader chatHeaderActions chatHeaderActionsOpen chatHeaderActionsShell\n          chatHeaderAvatar chatInfoBtn chatInfoModal chatItemAvatarHtml chatList chatListCacheKey chatListControllers chatListDataController\n          chatListDataFactory chatListPullIcon chatListPullIndicator chatListPullLabel chatListRecoveryController chatListRecoveryFactory chatListRenderer chatListRendererFactory\n          chatListService chatListStatus chatListStore chatListStoreApi chatListStoreFactory chatMembersCache chatPinsByChat chats\n          chatSearch chatSearchClear chatSearchToggle chatSettingsActionBtn chatShotAdminFormPayload chatShotAdminStates chatShotBotsModal chatShotBtn\n          chatShotGeneratingByChat chatShotRouteBase chatShotStateByChat chatShotStateFailuresByChat chatShotStateRequests chatStatus chatTitle chatView\n          checkAuth checkDeepseekAiBalance clamp cleanupDuplicateDateSeparators cleanupEmptyMessageGroups clearActivePulseVoterPopover clearActivePulseVoterPopoverForMessage clearCachedChat\n          clearChatContextLongPress clearChatHistoryForEveryone clearComposerDraft clearContextConvertPickerFollowupClickSuppress clearEdit clearEmojiPickerKeyboardOpenStabilizer clearFloatingMessageActionsStateIfClosed clearLocalChatHistory\n          clearMediaContextLongPress clearMediaPlaybackState clearMessageActionsPlacement clearMobileFontSizeStatusTimer clearMobileSceneElementState clearMobileSceneRepaint clearModalAnimationStatusTimer clearPendingFile\n          clearPendingMediaBottomScroll clearRenderedMessages clearReply clearScheduledScrollAnchorSave clearScreenRotationStatusSoon clearSearchPanelTransitionState clearSearchResults closeAllModals\n          closeChatHeaderActions closeChatViewForChat closeEmojiPicker closeFloatingSurface closeForwardMessageModal closeMediaViewer closeMobileComposerTransientUi closeModal\n          closePollMessage closeSearchPanel closeTopModal collectChatAvatarUrls compactView compactViewMap compareChatActivity compareChatsForFolder\n          compareChatsForList completeOutboxSend composerAiOverrideDocumentFormatEl composerAiOverrideDocumentWrap composerAiOverrideEl composerAiOverrideHint composerAiOverrideLabel composerAiOverrideModeEl\n          composerAiOverrideSeq composerAiOverrideState composerContextConvertBtn composerCustomEmojiClusterBoundary composerEmojiPickerController composerEmojiPickerFactory composerFactories composerFilesController\n          composerFilesFactory composerMentionsController composerMentionsFactory composerReplyEditController composerReplyEditFactory composerRichPreview composerSendController composerSendFactory\n          composerServices composerStateController composerStateFactory composerTextController composerTextFactory composerTypingDragDropController composerTypingDragDropFactory connectWS\n          consumeOutsidePickerDismissGesture contextConvertAdminFormPayload contextConvertAdminStates contextConvertAvailabilityByChat contextConvertAvailabilityRequests contextConvertBotsModal contextConvertComposerPending contextConvertPendingMessageIds\n          contextConvertPickerClickSuppressUntil contextConvertPickerPointerState contextConvertPickerState contextConvertProviderLabel contextConvertRouteBase contextMenusController contextMenusFactory contextOriginalRestorePendingMessageIds\n          copyImageFromMediaContext copyMessageFromRow copyTextToClipboard coreApiService createAttachmentPosterBlob createChatFolder createChatFolderSwipePage createContextConvertMessageButton\n          createFallbackDomRefs createFolderBtn createHorizontalSwipePager createMessageEl createMessageGroup createMessageOutboxItem createNewChatTabPreview createTimeoutError\n          currentAiBot currentChatId currentChatShotAdminBot currentChatShotAdminState currentContextConvertAdminBot currentContextConvertAdminState currentDeepseekBot currentGrokBot\n          currentGrokImageBot currentGrokTextBotFormFingerprint currentGrokUniversalBot currentMobileFontSize currentModalAnimation currentModalAnimationSpeed currentOpenAiImageBot currentOpenAiUniversalBot\n          currentQwenBot currentUiLanguage currentUiTheme currentUser currentUserInfo currentVisualMode currentYandexBot CUSTOM_EMOJI_BY_CATEGORY\n          CUSTOM_EMOJI_CATALOGS customEmoji debugMessageCache deepseekAiSettingsModal deepseekAiSettingsPayload deepseekAiTextBotsModal deepseekBotFormPayload deepseekBotState\n          deferBackButtonNavigationRelease deleteAiBotKey deleteChatCompletely deleteChatFolder deleteComposerCustomEmojiCluster deleteDeepseekAiKey deleteGrokAiKey deleteMessage\n          deleteQwenAiKey deleteYandexAiKey destroyChatFolderSwipePager disableAiBot disableChatShotAdminBot disableContextConvertAdminBot disableDeepseekBot disableGrokBot\n          disableGrokUniversalBot disableOpenAiImageBot disableOpenAiUniversalBot disablePushOnThisDevice disableQwenBot disableYandexBot dismissEmojiPickerOutsideGesture dismissMentionPickerAfterKeyboardClose\n          dismissMobileComposer DOCUMENT_FORMAT_OPTIONS downloadBackupExport dragOverlay drawVideoPosterBlob emojiBtn emojiPicker emptyState\n          enablePushNotifications endMobileRouteTransition ensureAttachmentPoster ensureAvatarUserMenu ensureBotVisibilityToggles ensureCallRecordingFooterButton ensureCallRecordingProgress ensureContextConvertPicker\n          ensureContextConvertPickerBackdrop ensureDeepseekTextBotsModalContent ensureMentionPicker ensureMentionPickerBackdrop ensurePulseInlineVoters ensureQwenTextBotsModalContent ensureScrollAnchorsLoaded ensureScrollDateIndicator\n          ensureSearchPanelReady esc escapeRegExpText exportAiBotJson exportChatShotAdminBot exportContextConvertAdminBot exportDeepseekBotJson exportGrokBotJson\n          exportGrokUniversalBotJson exportMediaPlaybackCompletedMeta exportOpenAiImageBotJson exportOpenAiUniversalBotJson exportQwenBotJson exportYandexBotJson extractMentionTokensFromText fetchMessageMediaBlob\n          fileExtension fileInput filenameFromContentDisposition fillAiBotForm fillDeepseekBotForm fillGrokBotForm fillGrokImageBotForm fillGrokUniversalBotForm\n          fillOpenAiImageBotForm fillOpenAiUniversalBotForm fillQwenBotForm fillYandexBotForm filterNewMessages filterNewPinEvents finalizeChatFolderStripPreview findComposerCustomEmojiClusterAfter\n          findComposerCustomEmojiClusterAt findComposerCustomEmojiClusterBefore findMentionTrigger findMessageRowById findOutboxRow findRestorableAnchorRow floatingMessageActionsController floatingMessageActionsFactory\n          flushCurrentChatScrollAnchor flushDeferredRecoverySync flushMobileFontSizeSave flushModalAnimationSave flushSearchPanelPendingAction focusChatSearchInput focusComposerKeepKeyboard focusElementIfPossible\n          focusSearchInput folderActionsController folderActionsFactory folderControllers folderManageModalController folderManageModalFactory folderStoreFactory folderSummaryText\n          folderUiController folderUiFactory forceIosAnimationMount forceMobileViewportLayoutSync forgetDisplayedMessage formatBotAuditSource formatCapabilityState formatChatListTimestamp\n          formatDate formatDeepseekBalanceResult formatDeepseekBalanceValue formatDuration formatPollDeadline formatRelativeDuration formatSearchResultTimestamp formatSize\n          formatters formatTime formatUiErrorMessage formatWeatherValue forwardChatList forwardChatSearch forwardingController forwardingControllerFactory\n          forwardMessageModal forwardMessageStatus forwardMessageToChat galleryNav getAbsoluteMessageMediaUrl getActiveChatFolder getActiveMessageActionsEl getActiveMessageActionsRow\n          getAdjacentChatFolderPage getAiChatSetting getAttachmentDownloadUrl getAttachmentPosterUrl getAttachmentPreviewUrl getBotVisibilityToggle getCallRecordingSeekRows getChatById\n          getChatFolderPageIndex getChatFolderPageRows getChatFolderSwipeCommitDistance getChatFolderSwipeSurfaceWidth getChatFolderSwipeTransformTarget getChatFolderSwitchTargets getChatLastMessageId getChatLastPreviewText\n          getChatMemberLastReads getChatPinOrder getChatPins getChatReadReceiptThreshold getChatSearchHaystack getChatSettingsActionOpener getChatShotAdminChatSetting getComposerAiOverridePayload\n          getComposerCustomEmojiCluster getComposerCustomEmojiClusterEnd getComposerCustomEmojiItemFromMarker getComposerDraftStorageKey getComposerInputTextMetrics getComposerInputWidthForMode getComposerTextValue getContextConvertChatSetting\n          getCurrentChatContextConvertState getCurrentChatShotState getCurrentModalAnimationPreferences getCustomEmoji getCustomEmojiCatalog getCustomEmojiRenderedSize getDeepseekChatSetting getDefaultMessageMediaMime\n          getDirectPrivateAiBotTarget getEditableText getElementTransitionTotalMs getEmojiCategoryItems getEmojiCategoryLabel getEmojiPickerCategories getEmojiPickerInsertionValue getFloatingMessageActionRow\n          getFloatingMessageActionsState getFloatingViewportRect getFolderPinnedChatMoveState getFolderPinnedChatOrder getGrokChatSetting getGrokImageChatSetting getGrokUniversalChatSetting getIosViewportBaselineHeight\n          getIosVisualViewportMetrics getLockedMobileKeyboardViewportMetrics getManualMentionRange getMaxRenderedMessageId getMediaNoteFallbackLabel getMediaPlaybackBucket getMediaPlaybackCompletedBucket getMessageActionsElement\n          getMessageCopyText getMessageCopyTextData getMessageIdNumber getMessageMediaContext getMessageMediaContextTarget getMessageMediaKindLabel getMessagesAfterLoader getMessagesLastContentChild\n          getMicrophoneMode getMobileAppViewportHeight getMobileAppViewportTopInset getMobileComposerSafeReturnFocusEl getMobileFontAdjustPercent getMobileViewportBaselineHeight getMobileVisualViewportMetrics getModalAnimationSpeedFactor\n          getNewChatModalActiveTab getNewChatTabPane getNormalComposerInputWidth getOpenAiImageChatSetting getOpenAiUniversalChatSetting getOutboxObjectUrl getPayloadChatId getPersistedMobileFontSize\n          getPersistedModalAnimationPreferences getPinActionState getPinActorName getPinForMessage getPinnedChatMoveState getPinnedChats getPinPreviewText getPinToastText\n          getPollCompactFooterMeta getProfileSelectedColor getPulseInlineVotersRevision getPulseVoterDisplayName getPulseVoterPopoverElement getQwenChatSetting getReactionPickerKeepKeyboard getReactionPickerMsgId\n          getRecentEmojiCategory getRecentEmojiStorageKey getRenderedChatFolderSelectionId getRenderedMessageIdList getRenderedMessageRows getReplyPreviewText getReplyQuoteText getReplySnapshot\n          getResolvedMobileBaseScene getScreenRotationAllowed getScrollDateTextForRow getSearchPanelTransitionFallbackMs getSelectableFolderChats getSelectedMessageFragment getSelectedNewFolderChatIds getSingleEmojiPattern\n          getSoundSettingsFromForm getStoredAttachmentPosterUrl getStoredAttachmentUrl getTopModal getUniversalBotModes getVisibleComposerToolCount getVisibleMessageAreaRect getYandexChatSetting\n          GROK_TEXT_BOT_DIRTY_STATUS grokAiImageBotsModal grokAiSettingsModal grokAiSettingsPayload grokAiTextBotsModal grokAiUniversalBotsModal grokBotFormPayload grokBotState\n          grokImageBotFormPayload grokImageRiskCancel grokImageRiskConfirm grokImageRiskConfirmModal grokImageRiskConfirmResolver grokImageRiskRetryPending grokImageRiskTerms grokTextBotFormFingerprint\n          grokTextBotFormHydrating grokUniversalBotFormPayload grokUniversalState grokUniversalTargetAllowsImage handleAppResume handleChatContextMenuAction handleChatFolderContextMenuAction handleComposerCustomEmojiBeforeInput\n          handleComposerCustomEmojiKeydown handleDragEnter handleDragLeave handleDragOver handleDrop handleGrokImageRiskModalClosed handleMediaContextMenuAction handleMediaViewerControlActivation\n          handleMentionClick handleMentionPickerKeydown handlePinnedMessageUpdate handleServiceWorkerMessage handleWSMessage hasAndroidNativeBridge hasOpenModal hideActiveMessageActions\n          hideAttachMenu hideAvatarUserMenu hideChatContextMenu hideChatFolderContextMenu hideChatFolderPicker hideChatFromList hideContextConvertPicker hideFloatingMessageActions\n          hideMediaContextMenu hideMentionPicker hideReactionPicker hideReactionUi hideScrollDateIndicator hideTyping HORIZONTAL_PAGER_SWIPE_COMMIT_MIN_PX HORIZONTAL_PAGER_SWIPE_COMMIT_RATIO\n          HORIZONTAL_PAGER_SWIPE_EDGE_DAMPING HORIZONTAL_PAGER_SWIPE_EDGE_MAX_PX HORIZONTAL_PAGER_SWIPE_START_PX horizontalPagerCommitDistance hydrateChatListCache hydrateComposerDraftsForCurrentUser hydratePulseInlineVoters i18n\n          i18nHelpers IMAGE_EXTENSIONS IMAGE_MIME_TYPES imageViewer importAiBotJsonFile importChatShotAdminBot importContextConvertAdminBot importDeepseekBotJsonFile\n          importGrokBotJsonFile importGrokUniversalBotJsonFile importOpenAiImageBotJsonFile importOpenAiUniversalBotJsonFile importQwenBotJsonFile importYandexBotJsonFile inAppChatBackSkipNextPopstate initEmojiPicker\n          initials initNewChatTabSwipePager inputArea inputRow insertAtMessagesEnd insertComposerTextAtSelection insertDictatedText insertMentionTarget\n          insertMentionTokenIntoComposer insertRawMentionTriggerAtCursor installCallRecordingProgressCapture interactionFactories interactionServices interactionState invalidateChatShotState invalidateContextConvertAvailability\n          invalidatePulseInlineVotersForMessage iosBackNavigationToken isAbortError isAiBotDirectoryUser isAllChatsFolderActive isChatFolderStripVisibleInAllChatsEnabled isChatIncomingSoundEnabled isChatListWaitingForActiveFolder\n          isChatNotificationEnabled isChatPinned isChatPinnedInFolder isChatSearchOpen isClientSideMessage isComposerMeaningfullyEmpty isContextTransformAvailableForChat isCurrentChatActivelyVisible\n          isCurrentChatOpenTransition isCurrentMessageRow isCurrentNotesChat isCustomEmojiCategory isCustomEmojiToken isDeletedMessageRow isFloatingSurfaceVisible isFollowupClickSuppressPassThroughTarget\n          isGeneralChat isGrokImageBotTarget isGrokUniversalBotTarget isGroupLikeCurrentChat isGroupOrPrivateChat isIosChatKeyboardLayoutActive isIosKeyboardOpen isIosMobileViewportTarget\n          isIosViewportFixTarget isIosWebkitMotionAllowed isLocalhost isMediaPlaybackCompleted isMediaPlaybackNearEnd isMentionSoundEnabled isMessageDisplayed isMessageMentioningCurrentUser\n          isMobileBaseSceneHardHidden isMobileChatHistoryState isMobileChatKeyboardLayoutActive isMobileComposerKeyboardOpen isMobileComposerSessionActive isMobileKeyboardOpen isMobileLayoutViewport isMobileViewportLayoutLocked\n          isMobileViewportTarget isNearBottom isNotesChat isPickerDismissPassThroughTarget isPinEventDisplayed isPinNotificationEnabled isPinSoundEnabled isPointerNearCallRecordingProgressRect\n          isPollMessage isPulsePoll isPulseVoterOptionExpanded isPushSupported isResolvedMobileChatScene isSearchPanelOpen isSelectableMessageTextTarget isSingleCustomEmojiMessage\n          isSingleEmojiMessage isTouchLikePointerEvent isUiTransitionBusy isUniversalBotTarget isValidRecentEmojiValue isVideoAttachmentMessage ivStrip jumpToPinnedMessage\n          jumpToSavedOriginal jumpToSearchResult languageDisplayName languageSettingsModal latestCallArtifactBatch latestCallTranscriptRun layoutRetryButtons leaveChat\n          linkify loadAiBotState loadAiModelOptions loadAllUsers loadChatFolders loadChatPins loadChatPreferences loadChats\n          loadChatShotAdminState loadChatShotState loadContextConvertAdminState loadContextConvertAvailability loadCurrentWeather loadDeepseekAiState loadGrokAiState loadGrokUniversalState\n          loadHiddenChatSearch loadLocalRecentEmojis loadMentionTargets loadMore loadMoreAfter loadMoreAfterWrap loadMoreBtn loadMoreWrap\n          loadNotificationSettings loadOpenAiImageState loadOpenAiUniversalState loadQwenAiState loadRecentEmojis loadSoundSettings loadWeatherSettings loadYandexAiState\n          localAttachmentFromFile localChatPreferenceEnabled logout makeClientId markAttachmentPosterAvailable markChatReadThrough markCurrentChatReadIfAtBottom markMessageDeleted\n          markPendingMediaBottomScroll markPendingMediaBottomScrollForMessages MAX_ATTACHMENTS MAX_FILE_SIZE MAX_FILE_SIZE_LABEL MAX_MSG maxMessageId maybeLoadMoreAtBottom\n          maybeLoadMoreAtTop measureFloatingSurface measureMessageActions measureMsgInputScrollHeight MEDIA_CONTEXT_LONG_PRESS_MS MEDIA_CONTEXT_TARGET_SELECTOR mediaContextMenu mediaContextMenuBackdrop\n          mediaPlaybackController mediaPlaybackFactory mediaViewerController mediaViewerFactory MENTION_PICKER_TAP_DEAD_ZONE mentionKey mentionOpenBtn menuDrawer\n          mergeAiBotState mergeChatShotAdminState mergeContextConvertAdminState mergeDeepseekAiState mergeGrokAiState mergeGrokUniversalState mergeOpenAiImageState mergeOpenAiUniversalState\n          mergeQwenAiState mergeRecentEmojiLists mergeYandexAiState MESSAGE_BACKGROUND_SYNC_CONCURRENCY MESSAGE_BACKGROUND_SYNC_MAX_CHATS MESSAGE_BACKGROUND_SYNC_MAX_PAGES MESSAGE_CACHE_LIMIT messageAttachmentFactory\n          messageAttachmentRenderer messageCallCardFactory messageCallCardRenderer messageHasDeferredMediaLayout messageIdKey messageOutbox messageOutboxFactory messagePollFactory\n          messagePollRenderer messageRenderer messageRendererFactory messagesEl messageServiceCall messageServiceDelegates messageServices messagesService\n          messageStateController messageStateFactory messageUpdates messageUpdatesFactory MICROPHONE_MODE_STORAGE_KEY MICROPHONE_MODE_VALUES microphoneMode minMessageId\n          MOBILE_FONT_SIZE_DEFAULT MOBILE_FONT_SIZE_MAX MOBILE_FONT_SIZE_MIN MOBILE_FONT_SIZE_PERCENTS mobileBaseScene mobileComposerGuard mobileFontSettingsModal mobileRouteTransitionActive\n          mobileRouteTransitionTimer mobileSceneRepaintCleanupFrame mobileSceneRepaintFrame mobileSceneRepaintTarget mobileViewportElementResizeObserver mobileViewportHeightSyncBound mobileViewportPrevHeight mobileViewportRecoveryFrame\n          mobileViewportRecoveryTimer mobileViewportShell mobileVisualViewportBaselineHeight mobileVisualViewportBaselineWidth MODAL_ANIMATION_SPEED_DEFAULT MODAL_ANIMATION_SPEED_FACTORS MODAL_ANIMATION_STYLE_IDS MODAL_ANIMATION_STYLES\n          MODAL_TRANSITION_BUFFER_MS modalAnimationMeta modalAnimationPreferencesEqual modalEntryOf modalManager modalManagerFactory mountGrokBotPanels mountPulseVoterPopover\n          moveChatFolder moveChatSidebarPin moveFocusOutOfChatHeaderActions moveFolderChatPin msgInput navigateBackToChatList NEW_CHAT_MODAL_TABS newChatModal\n          newChatTabSwipePager newFolderChatList newFolderChatSearchInput newFolderNameInput newFolderTabController newFolderTabFactory nextPollVoteSelection normalizeBotSaveComparisonValue\n          normalizeCachedChats normalizeCallMessageData normalizeCallMixedRecording normalizeChatFolderId normalizeChatListEntry normalizeChatShotState normalizeComposerDraftChatId normalizeComposerInputValue\n          normalizeComposerTextToInternal normalizeContextConvertAvailability normalizeMediaPlaybackCompletedEntries normalizeMemberLastReads normalizeMentionTarget normalizeMicrophoneMode normalizeMimeType normalizeMobileBaseScene\n          normalizeMobileChatListHistoryState normalizeMobileFontSize normalizeModalAnimationSpeed normalizeModalAnimationStyle normalizeNewChatModalTab normalizePin normalizePinEvent normalizePinEvents\n          normalizePins normalizePoll normalizePollStyle normalizeRecentEmojiList normalizeRecentEmojiValue normalizeUiLanguage normalizeUiTheme normalizeVisualMode\n          noteMessageScrollUserIntent NOTES_CHAT_EMOJI notificationPermissionLabel notificationSettingsController notificationSettingsFactory notificationSettingsModal notifyAndroidMobileFontSize notifyAndroidScreenRotationPreference\n          onlineUsers openAdminBotAuditModal openAdminModal OPENAI_IMAGE_BACKGROUND_OPTIONS OPENAI_IMAGE_OUTPUT_OPTIONS OPENAI_IMAGE_QUALITY_OPTIONS OPENAI_IMAGE_SIZE_OPTIONS openAiBotSettingsModal\n          openAiImageBotFormPayload openAiImageBotsModal openAiImageState openAiTextBotsModal openAiUniversalBotFormPayload openAiUniversalBotsModal openAiUniversalState openAnimationSettingsModal\n          openAvatarUserMenu openBackupExportModal openCallArtifactsModal openChangePasswordModal openChat openChatController openChatControllerFactory openChatControllers\n          openChatFolderManageModal openChatFromPush openChatInfoModal openChatPagesController openChatPagesFactory openChatService openChatShotBotsModal openComposerContextConvertPicker\n          openContextConvertBotsModal openDeepseekAiSettingsModal openDeepseekTextBotsModal openEmojiPicker openFloatingSurface openForwardMessageModal openGrokAiSettingsModal openGrokImageBotsModal\n          openGrokImageRiskConfirm openGrokTextBotsModal openGrokUniversalBotsModal openHiddenChatFromSearch openImageViewer openLanguageSettingsModal openLastChatOnReload openMediaViewer\n          openMentionPickerFromButton openMenuDrawer openMessageContextConvertPicker openMobileFontSettingsModal openModal openNewChatModal openNotificationSettingsModal openOpenAiImageBotsModal\n          openOpenAiTextBotsModal openOpenAiUniversalBotsModal openPollComposer openPollStyleSettingsModal openPollVotersModal openPrivateChatFromDirectory openPrivateChatWithUser openQwenAiSettingsModal\n          openQwenTextBotsModal openSearchPanel openSettingsModal openSoundSettingsModal openThemeSettingsModal openVisualModeSettingsModal openWeatherSettingsModal openYandexAiSettingsModal\n          outboxUrlKey PAGE_SIZE PAGINATION_BOTTOM_THRESHOLD PAGINATION_FETCH_MAX_PAGES PAGINATION_TOP_THRESHOLD parseCallRecordingRadiusValue parseTransitionTimeMs patchAiBotUserForPresence\n          patchChatMembersCacheForPresence patchMentionTargetsForPresence pauseCurrentChatMediaPlayback pendingFileEl pendingMobileChatListHistoryNormalization performSearch persistAiBotSettings persistChatListCache\n          persistComposerDrafts persistCurrentUser persistDeepseekAiSettings persistGrokAiSettings persistLocalRecentEmojis persistOutboxItem persistQwenAiSettings persistScrollAnchors\n          persistYandexAiSettings pickScrollAnchorRow pickScrollDateMessageRow pinEventIdKey pinMessage pinnedBar playAppSound playChatFolderSwitchPhase\n          pointToCallRecordingHit POLL_CLOSE_PRESET_MS POLL_MAX_OPTIONS POLL_MIN_OPTIONS POLL_STYLE_IDS POLL_STYLES pollAccentVar pollBtn\n          pollComposerController pollComposerFactory pollComposerModal pollComposerPreview pollComposerStatus pollComposerStyle pollOptionsList pollQuestionInput\n          pollStyleMeta pollStyleSettingsModal pollVotersList pollVotersMeta pollVotersModal pollVotersStatus pollVotersTitle portalMessageActions\n          positionAvatarUserMenu positionChatContextMenu positionChatFolderContextMenu positionChatFolderPicker positionContextConvertPicker positionEmojiPicker positionFloatingElement positionMediaContextMenu\n          positionMentionPicker positionMessageActionSurfaces positionReactionEmojiPopover positionScrollDateIndicator prefersReducedMotion prepareChatFolderSwipePager prepareNewChatTabContent presenceController\n          presenceControllerFactory preserveMobileComposerOnPointerDown preventMobileComposerBlur previewAllSounds previewBackupRestore previewSound primeAppendedMessageSideEffects primeMediaPlaybackCompletedCache\n          promoteOutboxRow providerAccent providerInteractiveEnabled providerInteractiveSummary pulseInlineVotersCacheKey pushCallMessageMeta queueIosViewportLayoutSync queueMobileViewportLayoutSync\n          queueOutboxItem queueSearchPanelPendingAction queueVideoNoteOutbox queueVoiceOutbox qwenAiSettingsModal qwenAiSettingsPayload qwenAiTextBotsModal qwenBotFormPayload\n          qwenBotState reactionController reactionControllerFactory reactionEmojiPopover reactionEmojiSwipePager reactionPicker readCachedChatRange readCachedCursorPage\n          readChatListCache readMediaPlaybackState readPollComposerForm readReceiptController readReceiptFactory reconcileChatReadState RECOVERY_CATCHUP_MAX_PAGES RECOVERY_SYNC_MIN_INTERVAL_MS\n          refreshAdminUserStatuses refreshCallRecordingProgressShape refreshChatFolderContextMenu refreshChatInfoPresentation refreshChatInfoStatus refreshChatListReferences refreshChatMemberStatuses refreshDateSeparators\n          refreshDeepseekAiModels refreshGrokAiModels refreshGrokTextBotDirtyState refreshLocalizedUi refreshMentionPickerForUserUpdate refreshPollComposerActionState refreshPollComposerPreview refreshPulseInlineVoterSlots\n          refreshPushDeviceState refreshQwenAiModels refreshRenderedAiBotAvatar refreshRenderedUserMessages refreshScrollDateIndicator refreshVisiblePinButtons refreshVoiceComposerState refreshWebSocketAfterResume\n          refreshYandexAiModels registerBuiltinModals registerModal rememberActiveElement rememberDisplayedMessage rememberPinEvent rememberRecentEmoji removeAiBotAvatar\n          removeChatFromFolder removeChatLocally removeDeepseekBotAvatar removeDuplicatePromotedRows removeGrokBotAvatar removeGrokUniversalBotAvatar removeOpenAiImageBotAvatar removeOpenAiUniversalBotAvatar\n          removeOutboxRows removeProfileAvatar removeQwenBotAvatar removeYandexBotAvatar renameChatFolder renderActiveChatFolderBar renderAdminUserRow renderAiBotAvatar\n          renderAiBotList renderAiBotSettings renderAiChatBotSettings renderAiModelOptions renderBackupRestorePreview renderCallArtifactBatchCard renderCallArtifactImage renderCallArtifactRun\n          renderCallArtifactStatus renderCallArtifactText renderCallArtifactTextLine renderCallMessageCard renderCallMessageMeta renderCallTranscriptRunCard renderChatContextMenu renderChatContextTransformForm\n          renderChatDangerControls renderChatFolderContextMenu renderChatFolderManageModal renderChatFolderPicker renderChatFolderStripStructure renderChatLastPreviewHtml renderChatList renderChatListInto\n          renderChatMemberItem renderChatPinSettingsForm renderChatPreferencesForm renderChatShotAdminChatSettings renderChatShotAdminForm renderChatShotAdminSettings renderChatShotBotList renderChatShotForm\n          renderComposerAiOverride renderComposerRichPreviewContent renderContextConvertAdminSettings renderContextConvertBotList renderContextConvertChatSettings renderContextConvertForm renderContextConvertPicker renderCurrentChatHeader\n          renderCustomEmojiHtml renderCustomEmojiPreviewHtml renderDeepseekAiSettings renderDeepseekBotAvatar renderDeepseekBotList renderDeepseekChatBotSettings renderDeepseekModelOptions renderedMessageIdsMatch\n          renderEmojiGridItemHtml renderEmojiGridItemsHtml renderEmojiPickerGrid renderFileAttachment renderFolderSelectableChatItem renderForwardChatList renderGrokAiSettings renderGrokBotAvatar\n          renderGrokBotList renderGrokBotModelOptions renderGrokChatBotSettings renderGrokGlobalImageModelOptions renderGrokGlobalTextModelOptions renderGrokImageBotAvatar renderGrokImageBotList renderGrokImageBotModelOptions\n          renderGrokImageBotsSettings renderGrokImageChatBotSettings renderGrokImageRiskTerms renderGrokTextBotsSettings renderGrokUniversalBotAvatar renderGrokUniversalBotList renderGrokUniversalBotModelOptions renderGrokUniversalBotsSettings\n          renderGrokUniversalChatBotSettings renderLanguagePicker renderLinkPreview renderMediaContextMenu renderMentionPicker renderMessages renderMessageText renderMobileFontSizeControl\n          renderModalAnimationOptions renderModalAnimationSpeedControl renderNamedGrokAvatar renderNewFolderChatList renderNotificationSettingsForm renderOpenAiImageBotAvatar renderOpenAiImageBotList renderOpenAiImageChatBotSettings\n          renderOpenAiImageModelOptions renderOpenAiImageSettings renderOpenAiProviderSettings renderOpenAiTextBotsSettings renderOpenAiUniversalBotAvatar renderOpenAiUniversalBotList renderOpenAiUniversalChatBotSettings renderOpenAiUniversalModelOptions\n          renderOpenAiUniversalSettings renderOrbitPollCard renderOutboxForChat renderOutboxItem renderPendingFiles renderPinActionButton renderPinnedBar renderPinSystemEvent\n          renderPollCard renderPollCloseButton renderPollCompactFooter renderPollComposerOptionInputs renderPollStyleCardPreview renderPollStylePicker renderPollVotersButton renderProfileAvatarPreview\n          renderProfileColorPicker renderProfileEditor renderPulseInlineVoterAvatar renderPulseInlineVoterStack renderPulseInlineVoterSummary renderPulseInlineVoterSummaryContent renderPulsePollCard renderQuickReactionButtonsHtml\n          renderQwenAiSettings renderQwenBotAvatar renderQwenBotList renderQwenChatBotSettings renderQwenModelOptions renderReactionPickerContent renderReactions renderResolvedFileAttachment\n          renderSearchResultsEmpty renderSearchScopeToggle renderSelectableUserItem renderSoundSettingsForm renderStackPollCard renderThemePicker renderTypingBar renderVisualModePicker\n          renderWeatherSearchResults renderWeatherSettingsForm renderWeatherWidget renderYandexAiSettings renderYandexBotAvatar renderYandexBotList renderYandexChatBotSettings renderYandexModelOptions\n          replaceRenderedMessage replaceRenderedMessages replaceRenderedPollCard replyBar replyBarName replyBarText requireCoreExport requireCoreFunction\n          resetBackButtonNavigationState resetBackupRestoreState resetChangePasswordFields resetChatFolderManageModal resetChatFolderSwipeSurface resetChatFolderSwitchAnimations resetChatPreviewAfterHistoryClear resetForwardMessageModal\n          resetManagedModalScroll resetMobileKeyboardDock resetNewFolderForm resetPollComposer resetPollVotersModal resetReusableMessageRow resolveActionButtons resolveAttachmentUrl\n          resolveCallMessageMediaKind resolveCallMessageRoomMode resolveComposerUniversalBotTarget resolveMediaPlaybackChatId resolveMediaPlaybackKey resolveMessageActionLayout resolveNearestCallRecordingHit resolveTriggeredGrokImageBot\n          resolveUiTarget restoreComposerDraft restoreComposerFocusAfterMentionPicker restoreContextOriginalMessage restoreMessageActions restoreMobileKeyboardDocumentScroll restoreScrollAnchor RESUME_WS_REFRESH_AFTER_MS\n          retryGrokImageRiskPrompt retrySend revealActiveMobileChatRoute revealChatHydration revealChatListAfterActiveChatClose revealSidebarFromChat revokeOutboxObjectUrls runChatShotGeneration\n          runMessageBackgroundSync runRecoverySync runtimeState safeVibrate saveAiBot saveAiBotSettings saveAiChatBotSettings saveChatContextTransformSetting\n          saveChatFolderManageChanges saveChatFolderStripVisibilityInAllChats saveChatPinSettings saveChatPreferences saveChatShotAdminBot saveChatShotAdminChatSetting saveChatShotChatSetting saveComposerDraft\n          saveContextConvertAdminBot saveContextConvertAdminChatSetting saveCurrentScrollAnchor saveDeepseekAiSettings saveDeepseekBot saveDeepseekChatBotSettings saveEditedMessage saveGrokAiSettings\n          saveGrokBot saveGrokChatBotSettings saveGrokImageBot saveGrokImageChatBotSettings saveGrokUniversalBot saveGrokUniversalChatBotSettings saveMessageToNotes saveNotificationSettings\n          saveOpenAiImageBot saveOpenAiImageChatBotSettings saveOpenAiUniversalBot saveOpenAiUniversalChatBotSettings saveProfileChanges saveQwenAiSettings saveQwenBot saveQwenChatBotSettings\n          saveSoundSettings saveWeatherSettings saveYandexAiSettings saveYandexBot saveYandexChatBotSettings scheduleActiveChatFolderChipCenter scheduleActiveMobileSceneRepaint scheduleChatListCacheSync\n          scheduleHiddenChatSearch scheduleMediaBottomScrollAnchorSave scheduleMessageBackgroundSync scheduleMobileFontSizeSave scheduleMobileFontSizeStatusClear scheduleMobileViewportRecovery scheduleModalAnimationSave scheduleModalAnimationStatusClear\n          schedulePulseVoterPopoverAutoHide scheduleRecoverySync scheduleRetryLayout scheduleScrollableItemCenter scheduleScrollAnchorSave scheduleScrollDateIndicatorUpdate scheduleSoundSettingsSave scheduleWeatherRefresh\n          SCREEN_ROTATION_ALLOWED_STORAGE_KEY screenRotationAllowed SCROLL_DATE_HIDE_DELAY_MS scrollAnchorStorageKey scrollBottomBtn scrollBottomFollowupClickSuppressUntil scrollController scrollControllerFactory\n          scrollRestoreMode scrollToBottom scrollToMessage searchAllChatsToggle searchBtn searchController searchControllerFactory searchInput\n          searchPanel searchPanelSheet searchResults searchWeatherLocations seekCallRecordingProgress seekVideoFrame selectedAiBotId selectedChatShotBotIds\n          selectedContextConvertBotIds selectedDeepseekBotId selectedGrokBotId selectedGrokImageBotId selectedGrokUniversalBotId selectedOpenAiImageBotId selectedOpenAiUniversalBotId selectedQwenBotId\n          selectedYandexBotId selectModalAnimation selectPollStyle selectUiLanguage selectUiTheme selectVisualMode sendBtn sendByEnter\n          sendComposerWsPayload sendMessage sendOutboxMessageItem sendOutboxVideoNoteItem sendOutboxVoiceItem sendTyping serializeComposerTextValue setActionButtonsPending\n          setActiveChatFolder setAiBotChatStatus setAiBotModalStatus setAiBotSettingsStatus setAiBotStatus setAiBotTextModalStatus setAiModelSelectOptions setAiModelStatus\n          setAvatarElementVisual setBackupExportStatus setBackupRestoreStatus setBotVisibilityToggle setChatContextTransformStatus setChatDangerStatus setChatFolderManageStatus setChatFolderOrder\n          setChatFolderSwipeOffset setChatHeaderActionsOpen setChatHydrating setChatListStatus setChatPinSettingsStatus setChatPreferencesStatus setChatSearchOpen setChatShotAdminChatStatus\n          setChatShotBotStatus setChatShotChatStatus setChatShotModalStatus setChatSidebarPin setComposerContextConvertButtonVisible setComposerTextValue setContextConvertBotStatus setContextConvertChatStatus\n          setContextConvertInlineStatus setContextConvertModalStatus setCurrentUserFromSettings setDeepseekAiBalanceStatus setDeepseekAiModelStatus setDeepseekAiProviderStatus setDeepseekAiStatus setDeepseekBotStatus\n          setDeepseekChatStatus setEditFromRow setEmojiPickerCategory setFolderChatPin setForwardMessageStatus setGrokAiModelStatus setGrokAiProviderStatus setGrokAiStatus\n          setGrokBotStatus setGrokImageChatStatus setGrokImageEditorStatus setGrokImageStatus setGrokStatus setGrokTextChatStatus setGrokTextEditorStatus setGrokTextStatus\n          setGrokUniversalChatStatus setGrokUniversalEditorStatus setGrokUniversalStatus setHasMoreAfter setHasMoreBefore setInlineStatus setLanguageStatus setLoadMoreAfterLoading\n          setMediaPlaybackCompleted setMicrophoneMode setMobileFontAdjustPercent setMobileFontSizeStatus setMobileSceneElementState setModalAnimationStatus setNewChatModalTab setNotificationStatus\n          setOpenAiImageChatStatus setOpenAiImageModalStatus setOpenAiImageStatus setOpenAiStatus setOpenAiUniversalChatStatus setOpenAiUniversalModalStatus setOpenAiUniversalStatus setOutboxSending\n          setPendingChatFolderChipCenterBehavior setPollComposerStatus setPollStyleStatus setPollStyleSurface setProfileAvatarUploadPending setProfileStatus setQwenAiModelStatus setQwenAiProviderStatus\n          setQwenAiStatus setQwenBotStatus setQwenChatStatus setReply setReplyFromRow setScreenRotationAllowed setScreenRotationStatus setSoundStatus\n          setStaticSelectOptions setThemeStatus settingsControllers settingsModal settingsModalController settingsModalFactory settleChatFolderSwipeOffset settleDeferredMediaBottomScroll\n          setupChatAreaMetricsSync setupLifecycleRecovery setupMessageSwipeGestures setupMobileComposerGestureGuard setupMobileMessageInteractionGuard setupMobileViewportHeightSync setupPasswordPreviewToggles setupProfileEvents\n          setVisualModeStatus setWeatherStatus setYandexAiModelStatus setYandexAiProviderStatus setYandexAiStatus setYandexBotStatus setYandexChatStatus shareMediaFromContext\n          shouldAutoFocusSearchInput shouldBackgroundSyncMessages shouldBypassLockedMobileViewportSync shouldIgnoreCallRecordingPointer shouldKeepComposerForMobileMessageInteraction shouldKeepEmojiPickerKeyboard shouldPreserveKeyboardForScrollBottomGesture shouldShowActiveChatFolderBar\n          shouldShowChatFolderBarForSelection showCenterToast showChatContextMenuForRow showChatFolderContextMenu showChatFolderPicker showMediaContextMenuForContext showMediaContextMenuForRow showMessageActions\n          showReactionPicker showTyping sidebar sidebarSearch singleEmojiPattern snapChatFolderSwipeBack snapComposerSelectionToCustomEmojiBoundary sortChatsInPlace\n          soundSettingsController soundSettingsFactory soundSettingsModal splitGraphemes stabilizeEmojiPickerKeyboardOnOpen storeChatMemberLastReads stripCloneIds stripTriggeredBotMention\n          suppressAvatarUserMenuFollowupClick suppressContextConvertPickerFollowupClick suppressMediaViewerFollowupClick suppressMentionPickerFollowupClick suppressNextChatItemTap suppressNextChatItemTapUntil suppressNextMessageActionTap suppressScrollBottomFollowupClick\n          suppressSearchPanelFollowupClick syncActiveChatFolderStripState syncBackupRestoreFileName syncCallRecordingPlayButton syncChatAreaMetrics syncChatAreaMetricsFromViewport syncChatFolderPickerAllChatsToggleState syncChatHeaderActionsAccessibility\n          syncChatInfoStatusVisibility syncChatMessagesInBackground syncChatShotButton syncClonedFormControls syncComposerRichPreview syncContextConvertComposerButton syncContextConvertPendingMessageState syncContextOriginalRestorePendingMessageState\n          syncCoreStateFromRuntime syncCoreStateToRuntime syncCurrentChatContextConvertUi syncEmojiPickerButton syncGrokBotUser syncGrokTextBotFormFingerprint syncIosViewportLayoutState syncLanguageSettingsButton\n          syncMentionOpenButton syncMobileAppHeightToViewport syncMobileBaseSceneState syncMobileFontSettingsButton syncMobileFontSizeViewportState syncMobileViewportLayoutState syncModalAnimationSettingsButton syncOpenAiImageBotUser\n          syncOpenAiUniversalBotUser syncPollComposerStyleUi syncProfileColorSelection syncRecentEmojiToServer syncScreenRotationToggle syncSharedGrokSettings syncSharedOpenAiSettings syncVisibleContextConvertMessageButtons\n          t testAiBot testChatShotAdminBot testContextConvertAdminBot testDeepseekAiConnection testDeepseekBot testGrokAiConnection testGrokBot\n          testGrokUniversalBot testOpenAiImageBot testOpenAiUniversalBot testPushNotification testQwenAiConnection testQwenBot testYandexAiConnection testYandexBot\n          themeSettingsModal timelineTimestamp toggleChatHeaderActions toggleEmojiPicker togglePinFromRow togglePollVote togglePulseVoterOptionExpanded togglePulseVoterPopover\n          toggleReaction token totalUnreadForFolder transformComposerTextWithContextConvertBot transformMessageWithContextConvertBot transitionToChatFolder transitionToChatFolderBySwipe trySendOutboxItem\n          tx typingBar UI_THEME_IDS UI_THEMES UI_VISUAL_MODE_IDS UI_VISUAL_MODES uiSettings uiSettingsFactory\n          uniqueAiModelValues unpinPin updateCallRecordingProgress updateChatContextPreference updateChatListLastMessage updateChatStatus updateComposerAiOverrideState updateCurrentUserFooter\n          updateFloatingMessageActionsState updateGalleryArrows updateHasMoreAfterFromChat updateLocalChatReadProgress updateMentionPicker updateMobileFontSize updateModalAnimationSpeed updateOnlineDisplay\n          updateReactionBar updateRowStatus updateScrollBottomButton updateScrollDateIndicator updateSearchTriggerState updateVisibleOwnReadStateRows updateVisibleReplyQuotesFromMessage uploadAiBotAvatar\n          uploadDeepseekBotAvatar uploadFiles uploadGrokBotAvatar uploadGrokUniversalBotAvatar uploadOpenAiImageBotAvatar uploadOpenAiUniversalBotAvatar uploadOutboxAttachment uploadProfileAvatar\n          uploadQwenBotAvatar uploadYandexBotAvatar userSecondaryLineText verifyBotSaveResponse VIDEO_EXTENSIONS VIDEO_MIME_TYPES VIDEO_POSTER_CAPTURE_SEEKS VIDEO_POSTER_CAPTURE_TIMEOUT_MS\n          VIDEO_POSTER_MAX_DIMENSION VIDEO_POSTER_MIME VIDEO_POSTER_QUALITY visibleChatCountForFolder visualModeMeta visualModeSettingsModal visualModeStateLabel waitForAnimationFrames\n          waitForMediaEvent waitForMs waitForVideoFrame warmChatListAvatarAssets warmMessageWindowAssets weatherIcon weatherLocationLabel weatherSettingsController\n          weatherSettingsFactory weatherSettingsModal weatherWidget websocketService wireAiBotToggleLabels withActionButtons withStableOutboxMedia writeCachedChatMeta\n          writeMediaPlaybackState ws WS_URL wsReconnectTimer wsRetry yandexAiSettingsModal yandexAiSettingsPayload yandexBotFormPayload\n          yandexBotState".trim().split(/\s+/).filter(Boolean);
        names.forEach((__bananzaScopeName) => {
          if (Object.prototype.hasOwnProperty.call(scope, __bananzaScopeName)) return;
          Object.defineProperty(scope, __bananzaScopeName, {
            configurable: true,
            enumerable: false,
            get() { return eval(__bananzaScopeName); },
            set(__bananzaScopeValue) { eval(__bananzaScopeName + ' = __bananzaScopeValue'); },
          });
        });

        return new Proxy(scope, {
          has() { return true; },
          get(target, key) {
            if (key === Symbol.unscopables) return undefined;
            if (Object.prototype.hasOwnProperty.call(target, key)) return target[key];
            if (typeof key === 'string' && key in window) return window[key];
            return undefined;
          },
          set(target, key, value) {
            target[key] = value;
            return true;
          },
        });
      }

      let shellEventController = null;
      const setupEvents = () => {
        if (!shellEventController) {
          shellEventController = window.BananzaApp?.shell?.createEventController?.({
            scope: createLegacyEventScope(),
          }) || null;
        }
        return shellEventController?.bindAll?.();
      };

    
      // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
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
