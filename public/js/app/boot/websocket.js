(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function createWebSocketService(ctx) {
    const state = ctx?.state || {};
    const config = ctx?.config || {};
    const hooks = {
      getToken: () => state.getToken?.() || state.token || localStorage.getItem('token'),
      handleMessage: null,
      onOpen: null,
      onBlocked: null,
      onStateChange: null,
    };

    function configure(nextHooks = {}) {
      Object.keys(hooks).forEach((key) => {
        if (typeof nextHooks[key] === 'function' || nextHooks[key] === null) hooks[key] = nextHooks[key];
      });
      return service;
    }

    function notifyStateChange() {
      hooks.onStateChange?.(state);
    }

    function getSocket() {
      return state.getWs?.() || state.ws || null;
    }

    function setSocket(socket) {
      if (typeof state.setWs === 'function') state.setWs(socket);
      else state.ws = socket || null;
      notifyStateChange();
      return socket || null;
    }

    function clearReconnectTimer() {
      state.clearWsReconnectTimer?.();
      if (!state.clearWsReconnectTimer && state.wsReconnectTimer) {
        clearTimeout(state.wsReconnectTimer);
        state.wsReconnectTimer = null;
      }
      notifyStateChange();
    }

    function connect({ force = false } = {}) {
      const token = hooks.getToken?.() || '';
      if (!token) return null;
      const WebSocketImpl = window.WebSocket;
      if (typeof WebSocketImpl !== 'function') return null;
      const currentWs = getSocket();
      if (!force && currentWs && (currentWs.readyState === WebSocketImpl.OPEN || currentWs.readyState === WebSocketImpl.CONNECTING)) {
        return currentWs;
      }
      clearReconnectTimer();

      if (!force && currentWs && (currentWs.readyState === WebSocketImpl.CLOSING || currentWs.readyState === WebSocketImpl.CLOSED)) {
        try { currentWs.onclose = null; } catch (e) {}
        setSocket(null);
      }

      if (force && currentWs) {
        try {
          currentWs.onclose = null;
          currentWs.close(4000, 'resume refresh');
        } catch (e) {}
        setSocket(null);
      }

      const socket = new WebSocketImpl((config.WS_URL || '') + '?token=' + encodeURIComponent(token));
      setSocket(socket);

      socket.onopen = () => {
        if (getSocket() !== socket) return;
        state.wsRetry = 1000;
        notifyStateChange();
        hooks.onOpen?.(socket);
      };

      socket.onclose = (event) => {
        if (getSocket() === socket) setSocket(null);
        if (event.code === 4003) {
          hooks.onBlocked?.(event);
          return;
        }
        if (!hooks.getToken?.()) return;
        const retryDelay = state.wsRetry || 1000;
        state.wsReconnectTimer = setTimeout(() => {
          state.wsRetry = Math.min((state.wsRetry || 1000) * 2, 30000);
          connect();
        }, retryDelay);
        notifyStateChange();
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          Promise.resolve(hooks.handleMessage?.(payload)).catch(() => {});
        } catch {}
      };

      return socket;
    }

    const service = {
      configure,
      connect,
      handleMessage: (message) => hooks.handleMessage?.(message),
      getSocket,
      clearReconnectTimer,
    };
    return service;
  }

  bootRoot.createWebSocketService = createWebSocketService;
})();
