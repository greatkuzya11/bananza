(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const chatListRoot = root.chatList = root.chatList || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createChatListRecovery(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const win = opts.window || window;
    const store = opts.store;
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const config = objectOrDefault(opts.config);
    const RECOVERY_SYNC_MIN_INTERVAL_MS = Number(config.RECOVERY_SYNC_MIN_INTERVAL_MS || 1500);
    const RESUME_WS_REFRESH_AFTER_MS = Number(config.RESUME_WS_REFRESH_AFTER_MS || 30000);

    let lastHiddenAt = doc.hidden ? Date.now() : 0;
    let recoverySyncTimer = null;
    let recoverySyncPromise = null;
    let recoverySyncRequested = false;
    let recoverySyncLastStartedAt = 0;
    let pendingRecoveryChatIds = new Set();
    let deferredRecoveryReason = '';

    function hasAuth() {
      if (typeof state.hasAuth === 'function') return Boolean(state.hasAuth());
      return Boolean(state.getToken?.() && state.getCurrentUser?.());
    }

    function getCurrentChatId() {
      return typeof state.getCurrentChatId === 'function' ? state.getCurrentChatId() : null;
    }

    function isUiTransitionBusy() {
      return typeof actions.isUiTransitionBusy === 'function' ? actions.isUiTransitionBusy() : false;
    }

    function markRequested(reason = '') {
      recoverySyncRequested = true;
      if (reason) deferredRecoveryReason = reason;
    }

    function scheduleRecoverySync(reason = 'event', { chatId = null, immediate = false } = {}) {
      if (!hasAuth()) return;
      const id = Number(chatId || 0);
      if (Number.isInteger(id) && id > 0) pendingRecoveryChatIds.add(id);
      if (!store?.isInitialChatLoadFinished?.() && !getCurrentChatId()) return;
      if (doc.hidden) {
        markRequested(reason);
        return;
      }
      if (isUiTransitionBusy()) {
        markRequested(reason);
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
      if (!hasAuth()) return;
      if (isUiTransitionBusy()) {
        markRequested(reason);
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
        await Promise.resolve(actions.loadChats?.({ silent: true })).catch(() => store?.getChats?.() || []);

        const activeChatId = Number(getCurrentChatId() || 0);
        if (activeChatId) {
          await actions.syncCurrentChatMessages?.(activeChatId, {
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
      if (!hasAuth()) return;
      const hiddenFor = lastHiddenAt ? Date.now() - lastHiddenAt : 0;
      const shouldRefreshOpenSocket = Boolean(actions.isWebSocketOpenOrConnecting?.() && hiddenFor >= RESUME_WS_REFRESH_AFTER_MS);
      actions.connectWS?.({ force: shouldRefreshOpenSocket });
    }

    function handleAppResume(reason) {
      actions.applyScreenRotationPreference?.({ showStatus: false, reason });
      if (!hasAuth()) return;
      actions.syncMobileBaseSceneState?.({
        scene: actions.getResolvedMobileBaseScene?.(),
        hideInactive: !actions.isMobileRouteTransitionActive?.(),
        syncChatMetrics: actions.getResolvedMobileBaseScene?.() === 'chat',
        repaint: true,
      });
      actions.scheduleMobileViewportRecovery?.();
      refreshWebSocketAfterResume();
      scheduleRecoverySync(reason, { immediate: true });
    }

    function setupLifecycleRecovery() {
      doc.addEventListener('visibilitychange', () => {
        if (doc.hidden) {
          actions.flushCurrentChatScrollAnchor?.(getCurrentChatId(), { force: true, allowPendingMedia: true });
          lastHiddenAt = Date.now();
          return;
        }
        handleAppResume('visible');
      });
      win.addEventListener('focus', () => handleAppResume('focus'));
      win.addEventListener('pageshow', () => handleAppResume('pageshow'));
      win.addEventListener('online', () => handleAppResume('online'));
      win.addEventListener('pagehide', () => {
        actions.flushCurrentChatScrollAnchor?.(getCurrentChatId(), { force: true, allowPendingMedia: true });
        lastHiddenAt = Date.now();
      });
    }

    async function openChatFromPush(chatId) {
      const id = Number(chatId);
      if (!Number.isInteger(id) || id <= 0) return;
      if (!store?.getChatById?.(id)) await actions.loadChats?.();
      if (store?.getChatById?.(id)) await actions.openChat?.(id);
    }

    function flushDeferredRecoverySync(reason = 'transition-complete') {
      if (!hasAuth() || doc.hidden || isUiTransitionBusy()) return;
      if (!recoverySyncRequested && pendingRecoveryChatIds.size === 0) return;
      const nextReason = deferredRecoveryReason || reason;
      deferredRecoveryReason = '';
      scheduleRecoverySync(nextReason, { immediate: true });
    }

    function clearRecoveryTimer() {
      clearTimeout(recoverySyncTimer);
      recoverySyncTimer = null;
    }

    function getState() {
      return {
        lastHiddenAt,
        recoverySyncRequested,
        recoverySyncLastStartedAt,
        pendingRecoveryChatIds: [...pendingRecoveryChatIds],
        deferredRecoveryReason,
        running: Boolean(recoverySyncPromise),
      };
    }

    return {
      clearRecoveryTimer,
      flushDeferredRecoverySync,
      getState,
      handleAppResume,
      markRequested,
      openChatFromPush,
      refreshWebSocketAfterResume,
      runRecoverySync,
      scheduleRecoverySync,
      setupLifecycleRecovery,
    };
  }

  chatListRoot.recovery = {
    createChatListRecovery,
  };
})();

