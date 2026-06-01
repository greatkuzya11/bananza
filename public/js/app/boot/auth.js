(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function createAuthService(ctx) {
    const state = ctx?.state || {};
    const hooks = {
      cleanup: null,
      onApplyStoredUser: null,
      onResetUi: null,
      redirectToLogin: () => { location.href = '/login.html'; },
    };

    function normalizeUser(user) {
      if (!user || typeof user !== 'object') return null;
      return {
        ...user,
        ui_show_chat_folder_strip_in_all_chats: Boolean(user.ui_show_chat_folder_strip_in_all_chats),
      };
    }

    function configure(nextHooks = {}) {
      Object.keys(hooks).forEach((key) => {
        if (typeof nextHooks[key] === 'function' || nextHooks[key] === null) hooks[key] = nextHooks[key];
      });
      return service;
    }

    function getToken() {
      return state.getToken?.() || state.token || localStorage.getItem('token');
    }

    function setToken(token) {
      if (typeof state.setToken === 'function') return state.setToken(token);
      state.token = token || null;
      return state.token;
    }

    function getCurrentUser() {
      return state.getCurrentUser?.() || state.currentUser || null;
    }

    function setCurrentUser(user) {
      const normalized = normalizeUser(user);
      if (typeof state.setCurrentUser === 'function') return state.setCurrentUser(normalized);
      state.currentUser = normalized;
      return state.currentUser;
    }

    function checkAuth() {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      if (!token || !userStr) {
        hooks.redirectToLogin?.();
        return false;
      }
      try {
        const user = setCurrentUser(JSON.parse(userStr));
        setToken(token);
        hooks.onApplyStoredUser?.(user);
        return true;
      } catch {
        logout();
        return false;
      }
    }

    function clearSessionStorage() {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (typeof state.clearSession === 'function') state.clearSession();
      else {
        state.token = null;
        state.currentUser = null;
      }
    }

    function logout() {
      hooks.cleanup?.();
      state.clearWsReconnectTimer?.();
      clearSessionStorage();
      hooks.onResetUi?.();
      state.closeWs?.();
      hooks.redirectToLogin?.();
    }

    const service = {
      configure,
      checkAuth,
      logout,
      getToken,
      setToken,
      getCurrentUser,
      setCurrentUser,
      hasAuth: () => Boolean(getToken() && getCurrentUser()),
      clearSessionStorage,
    };
    return service;
  }

  bootRoot.createAuthService = createAuthService;
})();
