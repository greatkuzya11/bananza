(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function createRuntimeCore(scope = {}) {
    with (scope) {
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

      const __bananzaRuntimeExportNames = ["ALL_CHATS_FOLDER_ID","AUDIO_EXTENSIONS","AUDIO_MIME_TYPES","CHAT_CONTEXT_LONG_PRESS_MS","CHAT_FOLDER_ICON_EMOJI","CHAT_FOLDER_SWIPE_COMMIT_MIN_PX","CHAT_FOLDER_SWIPE_COMMIT_RATIO","CHAT_FOLDER_SWIPE_EDGE_DAMPING","CHAT_FOLDER_SWIPE_EDGE_MAX_PX","CHAT_FOLDER_SWIPE_START_PX","CHAT_LIST_CACHE_SYNC_DEBOUNCE_MS","CHAT_LIST_CACHE_VERSION","CHAT_LIST_PULL_MAX_OFFSET","CHAT_LIST_PULL_REFRESH_OFFSET","CHAT_LIST_PULL_THRESHOLD","CHAT_LIST_PULL_TRIGGER_PX","CHAT_LIST_REQUEST_TIMEOUT_MS","CUSTOM_EMOJI_BY_CATEGORY","CUSTOM_EMOJI_CATALOGS","HORIZONTAL_PAGER_SWIPE_COMMIT_MIN_PX","HORIZONTAL_PAGER_SWIPE_COMMIT_RATIO","HORIZONTAL_PAGER_SWIPE_EDGE_DAMPING","HORIZONTAL_PAGER_SWIPE_EDGE_MAX_PX","HORIZONTAL_PAGER_SWIPE_START_PX","IMAGE_EXTENSIONS","IMAGE_MIME_TYPES","MAX_ATTACHMENTS","MAX_FILE_SIZE","MAX_FILE_SIZE_LABEL","MAX_MSG","MEDIA_CONTEXT_LONG_PRESS_MS","MEDIA_CONTEXT_TARGET_SELECTOR","MENTION_PICKER_TAP_DEAD_ZONE","MESSAGE_BACKGROUND_SYNC_CONCURRENCY","MESSAGE_BACKGROUND_SYNC_MAX_CHATS","MESSAGE_BACKGROUND_SYNC_MAX_PAGES","MESSAGE_CACHE_LIMIT","MICROPHONE_MODE_STORAGE_KEY","MICROPHONE_MODE_VALUES","MOBILE_FONT_SIZE_DEFAULT","MOBILE_FONT_SIZE_MAX","MOBILE_FONT_SIZE_MIN","MOBILE_FONT_SIZE_PERCENTS","MODAL_ANIMATION_SPEED_DEFAULT","MODAL_ANIMATION_SPEED_FACTORS","MODAL_ANIMATION_STYLES","MODAL_ANIMATION_STYLE_IDS","MODAL_TRANSITION_BUFFER_MS","NOTES_CHAT_EMOJI","PAGE_SIZE","PAGINATION_BOTTOM_THRESHOLD","PAGINATION_FETCH_MAX_PAGES","PAGINATION_TOP_THRESHOLD","POLL_CLOSE_PRESET_MS","POLL_MAX_OPTIONS","POLL_MIN_OPTIONS","POLL_STYLES","POLL_STYLE_IDS","RECOVERY_CATCHUP_MAX_PAGES","RECOVERY_SYNC_MIN_INTERVAL_MS","RESUME_WS_REFRESH_AFTER_MS","SCREEN_ROTATION_ALLOWED_STORAGE_KEY","SCROLL_DATE_HIDE_DELAY_MS","UI_THEMES","UI_THEME_IDS","UI_VISUAL_MODES","UI_VISUAL_MODE_IDS","VIDEO_EXTENSIONS","VIDEO_MIME_TYPES","VIDEO_POSTER_CAPTURE_SEEKS","VIDEO_POSTER_CAPTURE_TIMEOUT_MS","VIDEO_POSTER_MAX_DIMENSION","VIDEO_POSTER_MIME","VIDEO_POSTER_QUALITY","WS_URL","activeChatShotProvider","activeContextConvertProvider","activePinIndexByChat","aiBotState","aiImageRiskApi","aiModelCatalog","aiModelRefreshTriggeredByButton","allUsers","anchorForChatOpen","api","appConfig","appRuntime","appendMessage","appendPinEventIfVisible","appendTimelineItems","applyMessageUpdate","applyPollUpdate","attachmentHelpers","authService","avatarUserMenuState","bindCallArtifactMessageControls","bindCallMessageControls","bindCallTranscriptMessageControls","bindPollControls","bindPulseInlineVoterControls","buildLocalMessageFromOutbox","buildMessagesFragment","buildMessagesRootChildren","buildOptimisticPollState","buildPollOrbitGradient","buildPollRenderState","buildPulsePreviewVoters","buildTimelineItems","cacheCursorPage","cacheMessages","callArtifactImageContext","callArtifactImageFilename","callArtifactImageMime","callArtifactImageUrl","callArtifactKey","callArtifactLabel","callArtifactProgress","callArtifactStatusKind","callArtifactStatusLabel","callArtifactTextShouldCollapse","callRecordingDurationSeconds","callRecordingPlaybackUrl","callRecordingRoundedRectPath","canCaptureCurrentChatScrollAnchor","canClosePollMessage","cancelPendingMediaBottomScrollIfNeeded","captureScrollAnchor","catchUpCurrentChat","centerToastTimer","chatAreaResizeObserver","chatFolderSwipePagerState","chatFolderSwitchSeq","chatHeaderActionsOpen","chatListCacheKey","chatListService","chatListStoreApi","chatMembersCache","chatPinsByChat","chatShotAdminStates","chatShotGeneratingByChat","chatShotStateByChat","chatShotStateFailuresByChat","chatShotStateRequests","chats","checkAuth","cleanupDuplicateDateSeparators","cleanupEmptyMessageGroups","clearActivePulseVoterPopover","clearActivePulseVoterPopoverForMessage","clearPendingMediaBottomScroll","clearRenderedMessages","clearScheduledScrollAnchorSave","closePollMessage","collectChatAvatarUrls","compactView","compactViewMap","compareChatActivity","compareChatsForList","completeOutboxSend","composerAiOverrideSeq","composerAiOverrideState","composerCustomEmojiClusterBoundary","connectWS","contextConvertAdminStates","contextConvertAvailabilityByChat","contextConvertAvailabilityRequests","contextConvertComposerPending","contextConvertPendingMessageIds","contextConvertPickerClickSuppressUntil","contextConvertPickerPointerState","contextConvertPickerState","contextOriginalRestorePendingMessageIds","coreApiService","createAttachmentPosterBlob","createMessageEl","createMessageGroup","createMessageOutboxItem","createTimeoutError","currentChatId","currentMobileFontSize","currentModalAnimation","currentModalAnimationSpeed","currentUiLanguage","currentUiTheme","currentUser","currentVisualMode","customEmoji","debugMessageCache","deepseekBotState","deleteMessage","drawVideoPosterBlob","ensureCallRecordingFooterButton","ensureCallRecordingProgress","ensurePulseInlineVoters","ensureScrollAnchorsLoaded","ensureScrollDateIndicator","esc","fileExtension","filterNewMessages","filterNewPinEvents","findComposerCustomEmojiClusterAfter","findComposerCustomEmojiClusterAt","findComposerCustomEmojiClusterBefore","findOutboxRow","findRestorableAnchorRow","flushCurrentChatScrollAnchor","formatChatListTimestamp","formatDate","formatDuration","formatPollDeadline","formatRelativeDuration","formatSize","formatTime","formatters","getAttachmentDownloadUrl","getAttachmentPosterUrl","getAttachmentPreviewUrl","getCallRecordingSeekRows","getChatLastMessageId","getChatLastPreviewText","getChatPinOrder","getChatSearchHaystack","getComposerCustomEmojiCluster","getComposerCustomEmojiClusterEnd","getComposerCustomEmojiItemFromMarker","getCustomEmoji","getCustomEmojiCatalog","getCustomEmojiRenderedSize","getMaxRenderedMessageId","getMessageIdNumber","getMessagesAfterLoader","getMessagesLastContentChild","getOutboxObjectUrl","getPollCompactFooterMeta","getPulseInlineVotersRevision","getPulseVoterDisplayName","getPulseVoterPopoverElement","getRenderedMessageIdList","getRenderedMessageRows","getScrollDateTextForRow","getStoredAttachmentPosterUrl","getStoredAttachmentUrl","grokBotState","grokImageRiskConfirmResolver","grokImageRiskRetryPending","grokTextBotFormFingerprint","grokTextBotFormHydrating","grokUniversalState","handleAppResume","hideScrollDateIndicator","hydrateChatListCache","hydratePulseInlineVoters","i18n","i18nHelpers","inAppChatBackSkipNextPopstate","initials","insertAtMessagesEnd","installCallRecordingProgressCapture","invalidatePulseInlineVotersForMessage","iosBackNavigationToken","isChatListWaitingForActiveFolder","isCurrentMessageRow","isCustomEmojiToken","isNearBottom","isPinEventDisplayed","isPointerNearCallRecordingProgressRect","isPollMessage","isPulsePoll","isPulseVoterOptionExpanded","isSingleCustomEmojiMessage","isVideoAttachmentMessage","latestCallArtifactBatch","latestCallTranscriptRun","layoutRetryButtons","loadAllUsers","loadChats","loadMore","loadMoreAfter","localChatPreferenceEnabled","logout","markChatReadThrough","markCurrentChatReadIfAtBottom","markMessageDeleted","markPendingMediaBottomScroll","markPendingMediaBottomScrollForMessages","maxMessageId","maybeLoadMoreAtBottom","maybeLoadMoreAtTop","messageAttachmentRenderer","messageCallCardRenderer","messageHasDeferredMediaLayout","messageIdKey","messageOutbox","messagePollRenderer","messageRenderer","messageServiceCall","messageServiceDelegates","messageStateController","messageUpdates","messagesService","microphoneMode","minMessageId","mobileBaseScene","mobileRouteTransitionActive","mobileRouteTransitionTimer","mobileSceneRepaintCleanupFrame","mobileSceneRepaintFrame","mobileSceneRepaintTarget","mobileViewportElementResizeObserver","mobileViewportHeightSyncBound","mobileViewportPrevHeight","mobileViewportRecoveryFrame","mobileViewportRecoveryTimer","mobileVisualViewportBaselineHeight","mobileVisualViewportBaselineWidth","mountPulseVoterPopover","newChatTabSwipePager","nextPollVoteSelection","normalizeCachedChats","normalizeCallMessageData","normalizeCallMixedRecording","normalizeChatListEntry","normalizeComposerTextToInternal","normalizeMimeType","normalizePoll","noteMessageScrollUserIntent","onlineUsers","openAiImageState","openAiUniversalState","openCallArtifactsModal","openChat","openChatFromPush","openChatService","openLastChatOnReload","openPollVotersModal","outboxUrlKey","parseCallRecordingRadiusValue","pendingMobileChatListHistoryNormalization","persistChatListCache","persistOutboxItem","persistScrollAnchors","pickScrollAnchorRow","pickScrollDateMessageRow","pinEventIdKey","pointToCallRecordingHit","pollAccentVar","pollComposerStyle","positionScrollDateIndicator","primeAppendedMessageSideEffects","promoteOutboxRow","pulseInlineVotersCacheKey","pushCallMessageMeta","queueOutboxItem","queueVideoNoteOutbox","queueVoiceOutbox","qwenBotState","reactionEmojiSwipePager","readCachedChatRange","readCachedCursorPage","readChatListCache","refreshCallRecordingProgressShape","refreshChatListReferences","refreshDateSeparators","refreshPulseInlineVoterSlots","refreshScrollDateIndicator","refreshWebSocketAfterResume","rememberPinEvent","removeDuplicatePromotedRows","removeOutboxRows","renderCallArtifactBatchCard","renderCallArtifactImage","renderCallArtifactRun","renderCallArtifactStatus","renderCallArtifactText","renderCallArtifactTextLine","renderCallMessageCard","renderCallMessageMeta","renderCallTranscriptRunCard","renderChatLastPreviewHtml","renderChatList","renderChatListInto","renderCustomEmojiHtml","renderCustomEmojiPreviewHtml","renderFileAttachment","renderLinkPreview","renderMessages","renderOrbitPollCard","renderOutboxForChat","renderOutboxItem","renderPinSystemEvent","renderPollCard","renderPollCloseButton","renderPollCompactFooter","renderPollVotersButton","renderPulseInlineVoterAvatar","renderPulseInlineVoterStack","renderPulseInlineVoterSummary","renderPulseInlineVoterSummaryContent","renderPulsePollCard","renderResolvedFileAttachment","renderStackPollCard","renderedMessageIdsMatch","replaceRenderedMessage","replaceRenderedMessages","replaceRenderedPollCard","requireCoreExport","requireCoreFunction","resetPollVotersModal","resetReusableMessageRow","resolveAttachmentUrl","resolveCallMessageMediaKind","resolveCallMessageRoomMode","resolveNearestCallRecordingHit","restoreScrollAnchor","retrySend","revokeOutboxObjectUrls","runRecoverySync","runtimeState","saveCurrentScrollAnchor","scheduleChatListCacheSync","scheduleMediaBottomScrollAnchorSave","schedulePulseVoterPopoverAutoHide","scheduleRecoverySync","scheduleRetryLayout","scheduleScrollAnchorSave","scheduleScrollDateIndicatorUpdate","screenRotationAllowed","scrollAnchorStorageKey","scrollBottomFollowupClickSuppressUntil","scrollRestoreMode","scrollToBottom","seekCallRecordingProgress","seekVideoFrame","selectedAiBotId","selectedChatShotBotIds","selectedContextConvertBotIds","selectedDeepseekBotId","selectedGrokBotId","selectedGrokImageBotId","selectedGrokUniversalBotId","selectedOpenAiImageBotId","selectedOpenAiUniversalBotId","selectedQwenBotId","selectedYandexBotId","sendByEnter","sendOutboxMessageItem","sendOutboxVideoNoteItem","sendOutboxVoiceItem","serializeComposerTextValue","setChatListStatus","setHasMoreAfter","setHasMoreBefore","setLoadMoreAfterLoading","setOutboxSending","settleDeferredMediaBottomScroll","setupLifecycleRecovery","shouldIgnoreCallRecordingPointer","suppressNextChatItemTapUntil","syncCallRecordingPlayButton","syncCoreStateFromRuntime","syncCoreStateToRuntime","t","timelineTimestamp","togglePollVote","togglePulseVoterOptionExpanded","togglePulseVoterPopover","token","trySendOutboxItem","tx","updateCallRecordingProgress","updateChatListLastMessage","updateHasMoreAfterFromChat","updateOnlineDisplay","updateRowStatus","updateScrollDateIndicator","updateVisibleOwnReadStateRows","updateVisibleReplyQuotesFromMessage","uploadOutboxAttachment","waitForMediaEvent","waitForVideoFrame","warmChatListAvatarAssets","warmMessageWindowAssets","websocketService","withStableOutboxMedia","writeCachedChatMeta","ws","wsReconnectTimer","wsRetry","yandexBotState"];
      const __bananzaRuntimeExports = {};
      __bananzaRuntimeExportNames.forEach((name) => {
        Object.defineProperty(__bananzaRuntimeExports, name, {
          configurable: true,
          enumerable: true,
          get() { return eval(name); },
          set(__bananzaRuntimeExportValue) { eval(name + ' = __bananzaRuntimeExportValue'); },
        });
      });
      return __bananzaRuntimeExports;
    }
  }

  bootRoot.createRuntimeCore = createRuntimeCore;
})();
