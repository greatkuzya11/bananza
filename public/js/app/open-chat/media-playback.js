(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const openChatRoot = root.openChat = root.openChat || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createMediaPlaybackController(options = {}) {
    const opts = objectOrDefault(options);
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const pages = objectOrDefault(opts.pages);
    const mediaPlaybackStateByChat = new Map();
    const mediaPlaybackCompletedByChat = new Map();

    function getMessagesEl() {
      return dom.messagesEl || document.getElementById('messages');
    }

    function getCache() {
      return opts.cache || window.messageCache || null;
    }

    function resolveMediaPlaybackChatId(message = {}) {
      return Number(message?.chat_id || message?.chatId || state.getCurrentChatId?.() || 0);
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

    function normalizeMediaPlaybackCompletedEntries(source = null) {
      if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
      return Object.entries(source)
        .map(([rawKey, rawUpdatedAt]) => {
          const key = String(rawKey || '').trim();
          const updatedAt = Number(rawUpdatedAt || 0);
          return [
            key,
            Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 1,
          ];
        })
        .filter(([key]) => Boolean(key));
    }

    function getMediaPlaybackCompletedBucket(chatId, { create = false } = {}) {
      const id = Number(chatId || 0);
      if (!id) return null;
      let bucket = mediaPlaybackCompletedByChat.get(id);
      if (!bucket && create) {
        bucket = new Map();
        mediaPlaybackCompletedByChat.set(id, bucket);
      }
      return bucket || null;
    }

    function applyMediaPlaybackCompletedMeta(chatId, source = null) {
      const id = Number(chatId || 0);
      if (!id) return null;
      const entries = normalizeMediaPlaybackCompletedEntries(source);
      if (!entries.length) {
        mediaPlaybackCompletedByChat.delete(id);
        return null;
      }
      const bucket = new Map(entries);
      mediaPlaybackCompletedByChat.set(id, bucket);
      return bucket;
    }

    function exportMediaPlaybackCompletedMeta(chatId) {
      const bucket = getMediaPlaybackCompletedBucket(chatId);
      if (!bucket?.size) return null;
      const trimmedEntries = Array.from(bucket.entries())
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
        .slice(0, 400);
      if (!trimmedEntries.length) {
        mediaPlaybackCompletedByChat.delete(Number(chatId || 0));
        return null;
      }
      if (trimmedEntries.length !== bucket.size) {
        mediaPlaybackCompletedByChat.set(Number(chatId || 0), new Map(trimmedEntries));
      }
      return Object.fromEntries(trimmedEntries);
    }

    function primeMediaPlaybackCompletedCache(chatId, meta = null) {
      const id = Number(chatId || 0);
      if (!id) return Promise.resolve(null);
      if (meta && Object.prototype.hasOwnProperty.call(meta, 'mediaPlaybackCompleted')) {
        return Promise.resolve(applyMediaPlaybackCompletedMeta(id, meta.mediaPlaybackCompleted));
      }
      if (mediaPlaybackCompletedByChat.has(id)) {
        return Promise.resolve(getMediaPlaybackCompletedBucket(id));
      }
      try {
        const read = getCache()?.readChatMeta?.(id);
        return Promise.resolve(read)
          .then((stored) => applyMediaPlaybackCompletedMeta(id, stored?.mediaPlaybackCompleted))
          .catch(() => getMediaPlaybackCompletedBucket(id));
      } catch (e) {
        return Promise.resolve(getMediaPlaybackCompletedBucket(id));
      }
    }

    function isMediaPlaybackCompleted(message = {}, role = '') {
      const chatId = resolveMediaPlaybackChatId(message);
      const key = resolveMediaPlaybackKey(message, role);
      if (!chatId || !key) return false;
      return Boolean(getMediaPlaybackCompletedBucket(chatId)?.has(key));
    }

    function writeCompletedMeta(chatId) {
      const patch = {
        mediaPlaybackCompleted: exportMediaPlaybackCompletedMeta(chatId),
      };
      if (typeof pages.writeCachedChatMeta === 'function') {
        pages.writeCachedChatMeta(chatId, patch).catch(() => {});
        return;
      }
      try {
        getCache()?.writeChatMeta?.(chatId, patch)?.catch?.(() => {});
      } catch (e) {}
    }

    function setMediaPlaybackCompleted(message = {}, role = '', completed) {
      const chatId = resolveMediaPlaybackChatId(message);
      const key = resolveMediaPlaybackKey(message, role);
      if (!chatId || !key) return false;
      const nextCompleted = Boolean(completed);
      const bucket = getMediaPlaybackCompletedBucket(chatId, { create: nextCompleted });
      const hadCompleted = Boolean(bucket?.has(key));
      if (nextCompleted) {
        if (hadCompleted) return true;
        bucket.set(key, Date.now());
      } else {
        if (!hadCompleted || !bucket) return false;
        bucket.delete(key);
        if (!bucket.size) mediaPlaybackCompletedByChat.delete(chatId);
      }
      writeCompletedMeta(chatId);
      return nextCompleted;
    }

    function isMediaPlaybackNearEnd(mediaEl, epsilon = 0.08) {
      const duration = Number(mediaEl?.duration || 0);
      if (!(duration > 0)) return Boolean(mediaEl?.ended);
      return Number(mediaEl.currentTime || 0) >= Math.max(0, duration - Math.max(0.01, Number(epsilon || 0)));
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
      const clearCompletedState = () => {
        if (!isMediaPlaybackNearEnd(mediaEl)) {
          setMediaPlaybackCompleted(message, resolvedRole, false);
        }
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

      mediaEl.addEventListener('play', () => {
        clearCompletedState();
        persistSnapshot({ force: true });
      });
      mediaEl.addEventListener('pause', () => {
        if (mediaEl.__bananzaAutoPaused) {
          mediaEl.__bananzaAutoPaused = false;
          writeMediaPlaybackState(message, resolvedRole, {
            currentTime: Number(mediaEl.currentTime || 0),
            shouldResume: true,
          });
          return;
        }
        if (mediaEl.ended) {
          setMediaPlaybackCompleted(message, resolvedRole, true);
        }
        persistSnapshot({ force: true });
      });
      mediaEl.addEventListener('timeupdate', () => persistSnapshot());
      mediaEl.addEventListener('seeking', clearCompletedState);
      mediaEl.addEventListener('ended', () => {
        setMediaPlaybackCompleted(message, resolvedRole, true);
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
      const messagesEl = getMessagesEl();
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

    function getState() {
      return {
        mediaPlaybackStateByChat,
        mediaPlaybackCompletedByChat,
      };
    }

    return {
      applyMediaPlaybackCompletedMeta,
      bindMediaPlaybackState,
      captureBoundMediaPlaybackState,
      clearMediaPlaybackState,
      exportMediaPlaybackCompletedMeta,
      getMediaPlaybackBucket,
      getMediaPlaybackCompletedBucket,
      getState,
      isMediaPlaybackCompleted,
      isMediaPlaybackNearEnd,
      normalizeMediaPlaybackCompletedEntries,
      pauseCurrentChatMediaPlayback,
      primeMediaPlaybackCompletedCache,
      readMediaPlaybackState,
      resolveMediaPlaybackChatId,
      resolveMediaPlaybackKey,
      setMediaPlaybackCompleted,
      writeMediaPlaybackState,
    };
  }

  openChatRoot.mediaPlayback = {
    createMediaPlaybackController,
  };
})();
