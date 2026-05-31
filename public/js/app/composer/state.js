(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const composerRoot = root.composer = root.composer || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function clonePlain(value) {
    return value && typeof value === 'object' ? { ...value } : value;
  }

  function normalizeDraftChatId(chatId) {
    const id = Number(chatId || 0);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  function createDefaultMentionPickerState() {
    return {
      active: false,
      start: 0,
      end: 0,
      selected: 0,
      targets: [],
      source: null,
      keyboardAttached: false,
    };
  }

  function createComposerState(options = {}) {
    const opts = objectOrDefault(options);
    const storage = opts.storage || window.localStorage;
    const maxDraftLength = Math.max(1, Number(opts.maxDraftLength || opts.MAX_MSG || 4096) || 4096);
    const getCurrentUser = typeof opts.getCurrentUser === 'function' ? opts.getCurrentUser : () => null;

    let pendingFile = null;
    let pendingFiles = [];
    const composerDraftsByChatId = new Map();
    let composerDraftsLoadedForUserId = 0;
    let replyTo = null;
    let editTo = null;
    let typingSendTimeout = null;
    let typingDisplayTimeouts = {};
    const mentionTargetsByChat = new Map();
    let mentionPickerState = createDefaultMentionPickerState();
    let mentionPickerPointerState = null;
    let mentionPickerClickSuppressUntil = 0;
    let emojiPickerOpen = false;
    let emojiPickerKeyboardAttached = false;
    let emojiPickerAnchorEl = null;
    let emojiPickerKeyboardStabilizeFrame = 0;
    let emojiPickerKeyboardStabilizeTimer = null;
    let emojiSwipePager = null;
    let pollComposerOptions = ['', ''];
    let pollVotersState = {};

    function getReplyTo() {
      return replyTo ? clonePlain(replyTo) : null;
    }

    function setReplyTo(value) {
      replyTo = value ? clonePlain(value) : null;
      return getReplyTo();
    }

    function clearReplyTo() {
      replyTo = null;
      return null;
    }

    function getEditTo() {
      return editTo ? clonePlain(editTo) : null;
    }

    function setEditTo(value) {
      editTo = value ? clonePlain(value) : null;
      return getEditTo();
    }

    function clearEditTo() {
      editTo = null;
      return null;
    }

    function getPendingFiles() {
      return pendingFiles.slice();
    }

    function setPendingFiles(files = []) {
      pendingFiles = Array.isArray(files) ? files.slice() : [];
      pendingFile = pendingFiles[0] || null;
      return getPendingFiles();
    }

    function clearPendingFiles() {
      pendingFile = null;
      pendingFiles = [];
      return [];
    }

    function getComposerDraftStorageKey(userId = getCurrentUser()?.id) {
      const id = Number(userId || 0);
      return Number.isFinite(id) && id > 0 ? `bananza:composerDrafts:v1:${id}` : '';
    }

    function persistComposerDrafts() {
      const key = getComposerDraftStorageKey();
      if (!key) return;
      try {
        if (!composerDraftsByChatId.size) {
          storage.removeItem(key);
          return;
        }
        const payload = {};
        composerDraftsByChatId.forEach((text, chatId) => {
          if (normalizeDraftChatId(chatId) && text) payload[String(chatId)] = String(text).slice(0, maxDraftLength);
        });
        if (Object.keys(payload).length) storage.setItem(key, JSON.stringify(payload));
        else storage.removeItem(key);
      } catch (e) {}
    }

    function hydrateComposerDraftsForCurrentUser({ force = false } = {}) {
      const userId = Number(getCurrentUser()?.id || 0);
      if (!userId) return;
      if (!force && composerDraftsLoadedForUserId === userId) return;
      composerDraftsByChatId.clear();
      composerDraftsLoadedForUserId = userId;
      const key = getComposerDraftStorageKey(userId);
      if (!key) return;
      try {
        const raw = JSON.parse(storage.getItem(key) || '{}');
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
        Object.entries(raw).forEach(([chatId, text]) => {
          const id = normalizeDraftChatId(chatId);
          if (id && typeof text === 'string' && text) composerDraftsByChatId.set(id, text.slice(0, maxDraftLength));
        });
      } catch (e) {
        storage.removeItem(key);
      }
    }

    function saveComposerDraftValue(chatId, text) {
      hydrateComposerDraftsForCurrentUser();
      const id = normalizeDraftChatId(chatId);
      if (!id) return;
      const value = String(text || '').slice(0, maxDraftLength);
      if (value) composerDraftsByChatId.set(id, value);
      else composerDraftsByChatId.delete(id);
      persistComposerDrafts();
    }

    function clearComposerDraft(chatId) {
      hydrateComposerDraftsForCurrentUser();
      const id = normalizeDraftChatId(chatId);
      if (id) composerDraftsByChatId.delete(id);
      persistComposerDrafts();
    }

    function getComposerDraft(chatId) {
      hydrateComposerDraftsForCurrentUser();
      const id = normalizeDraftChatId(chatId);
      return id ? composerDraftsByChatId.get(id) || '' : '';
    }

    function resetComposerDraftsForCurrentUser({ removeStorage = false } = {}) {
      if (removeStorage) {
        const key = getComposerDraftStorageKey();
        if (key) storage.removeItem(key);
      }
      composerDraftsByChatId.clear();
      composerDraftsLoadedForUserId = 0;
    }

    function resetMentionPickerState(patch = {}) {
      mentionPickerState = { ...createDefaultMentionPickerState(), ...objectOrDefault(patch) };
      return mentionPickerState;
    }

    const api = {
      getReplyTo,
      setReplyTo,
      clearReplyTo,
      getEditTo,
      setEditTo,
      clearEditTo,
      getPendingFiles,
      setPendingFiles,
      clearPendingFiles,
      normalizeComposerDraftChatId: normalizeDraftChatId,
      getComposerDraftStorageKey,
      hydrateComposerDraftsForCurrentUser,
      persistComposerDrafts,
      saveComposerDraftValue,
      clearComposerDraft,
      getComposerDraft,
      resetComposerDraftsForCurrentUser,
      composerDraftsByChatId,
      mentionTargetsByChat,
      getMentionPickerState: () => mentionPickerState,
      setMentionPickerState: (value) => {
        mentionPickerState = { ...mentionPickerState, ...objectOrDefault(value) };
        return mentionPickerState;
      },
      resetMentionPickerState,
      getPollComposerOptions: () => pollComposerOptions.slice(),
      setPollComposerOptions: (optionsList = []) => {
        pollComposerOptions = Array.isArray(optionsList) ? optionsList.slice() : [];
        return pollComposerOptions.slice();
      },
      getPollVotersState: () => clonePlain(pollVotersState) || {},
      setPollVotersState: (value = {}) => {
        pollVotersState = objectOrDefault(value);
        return pollVotersState;
      },
    };

    Object.defineProperties(api, {
      pendingFile: {
        get: () => pendingFile,
        set: (value) => { pendingFile = value || null; },
      },
      pendingFiles: {
        get: () => pendingFiles,
        set: (value) => { setPendingFiles(value); },
      },
      composerDraftsLoadedForUserId: {
        get: () => composerDraftsLoadedForUserId,
        set: (value) => { composerDraftsLoadedForUserId = Number(value || 0) || 0; },
      },
      replyTo: {
        get: () => replyTo,
        set: (value) => { replyTo = value || null; },
      },
      editTo: {
        get: () => editTo,
        set: (value) => { editTo = value || null; },
      },
      typingSendTimeout: {
        get: () => typingSendTimeout,
        set: (value) => { typingSendTimeout = value || null; },
      },
      typingDisplayTimeouts: {
        get: () => typingDisplayTimeouts,
        set: (value) => { typingDisplayTimeouts = value && typeof value === 'object' ? value : {}; },
      },
      mentionPickerState: {
        get: () => mentionPickerState,
        set: (value) => { mentionPickerState = objectOrDefault(value); },
      },
      mentionPickerPointerState: {
        get: () => mentionPickerPointerState,
        set: (value) => { mentionPickerPointerState = value || null; },
      },
      mentionPickerClickSuppressUntil: {
        get: () => mentionPickerClickSuppressUntil,
        set: (value) => { mentionPickerClickSuppressUntil = Number(value || 0) || 0; },
      },
      emojiPickerOpen: {
        get: () => emojiPickerOpen,
        set: (value) => { emojiPickerOpen = Boolean(value); },
      },
      emojiPickerKeyboardAttached: {
        get: () => emojiPickerKeyboardAttached,
        set: (value) => { emojiPickerKeyboardAttached = Boolean(value); },
      },
      emojiPickerAnchorEl: {
        get: () => emojiPickerAnchorEl,
        set: (value) => { emojiPickerAnchorEl = value || null; },
      },
      emojiPickerKeyboardStabilizeFrame: {
        get: () => emojiPickerKeyboardStabilizeFrame,
        set: (value) => { emojiPickerKeyboardStabilizeFrame = value || 0; },
      },
      emojiPickerKeyboardStabilizeTimer: {
        get: () => emojiPickerKeyboardStabilizeTimer,
        set: (value) => { emojiPickerKeyboardStabilizeTimer = value || null; },
      },
      emojiSwipePager: {
        get: () => emojiSwipePager,
        set: (value) => { emojiSwipePager = value || null; },
      },
      pollComposerOptions: {
        get: () => pollComposerOptions,
        set: (value) => { pollComposerOptions = Array.isArray(value) ? value : []; },
      },
      pollVotersState: {
        get: () => pollVotersState,
        set: (value) => { pollVotersState = objectOrDefault(value); },
      },
    });

    return api;
  }

  composerRoot.state = {
    createComposerState,
  };
})();
