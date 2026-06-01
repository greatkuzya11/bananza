(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function createInitialState(seed = {}) {
    const state = {
      currentUser: null,
      token: null,
      chats: [],
      currentChatId: null,
      currentChat: null,
      messages: [],
      ws: null,
      wsRetry: 1000,
      wsReconnectTimer: null,
      onlineUsers: new Set(),
      chatMembersCache: new Map(),
      chatPinsByChat: new Map(),
      activePinIndexByChat: new Map(),
      allUsers: [],
      features: {},
      ...seed,
    };

    state.getCurrentUser = function getCurrentUser() {
      return state.currentUser;
    };
    state.setCurrentUser = function setCurrentUser(user) {
      state.currentUser = user || null;
      return state.currentUser;
    };
    state.getToken = function getToken() {
      return state.token || localStorage.getItem('token');
    };
    state.setToken = function setToken(nextToken) {
      state.token = nextToken || null;
      return state.token;
    };
    state.clearSession = function clearSession() {
      state.token = null;
      state.currentUser = null;
      return state;
    };
    state.getCurrentChatId = function getCurrentChatId() {
      return state.currentChatId;
    };
    state.setCurrentChatId = function setCurrentChatId(chatId) {
      const nextChatId = Number(chatId || 0);
      state.currentChatId = nextChatId > 0 ? nextChatId : null;
      state.currentChat = state.getCurrentChat();
      return state.currentChatId;
    };
    state.getCurrentChat = function getCurrentChat() {
      const id = Number(state.currentChatId || 0);
      if (!id) return null;
      if (state.currentChat && Number(state.currentChat.id || 0) === id) return state.currentChat;
      return (Array.isArray(state.chats) ? state.chats : []).find((chat) => Number(chat.id || 0) === id) || null;
    };
    state.setCurrentChat = function setCurrentChat(chat) {
      state.currentChat = chat || null;
      return state.currentChat;
    };
    state.getChats = function getChats() {
      return state.chats;
    };
    state.setChats = function setChats(chats) {
      state.chats = Array.isArray(chats) ? chats : [];
      state.currentChat = state.getCurrentChat();
      return state.chats;
    };
    state.getMessages = function getMessages() {
      return state.messages;
    };
    state.setMessages = function setMessages(messages) {
      state.messages = Array.isArray(messages) ? messages : [];
      return state.messages;
    };
    state.mergeMessages = function mergeMessages(messages, { prepend = false } = {}) {
      const incoming = Array.isArray(messages) ? messages.filter(Boolean) : [];
      if (!incoming.length) return state.messages;
      const combined = prepend ? [...incoming, ...state.messages] : [...state.messages, ...incoming];
      const seen = new Set();
      state.messages = combined.filter((message) => {
        const key = String(message?.id ?? '').trim();
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return state.messages;
    };
    state.getAllUsers = function getAllUsers() {
      return state.allUsers;
    };
    state.setAllUsers = function setAllUsers(users) {
      state.allUsers = Array.isArray(users) ? users : [];
      return state.allUsers;
    };
    state.getOnlineUsers = function getOnlineUsers() {
      return state.onlineUsers;
    };
    state.setOnlineUsers = function setOnlineUsers(userIds) {
      const nextOnlineUsers = state.onlineUsers instanceof Set ? state.onlineUsers : new Set();
      nextOnlineUsers.clear();
      (Array.isArray(userIds) ? userIds : Array.from(userIds || [])).forEach((userId) => {
        const id = Number(userId || 0);
        if (Number.isFinite(id) && id > 0) nextOnlineUsers.add(id);
      });
      state.onlineUsers = nextOnlineUsers;
      return state.onlineUsers;
    };
    state.syncChatListStore = function syncChatListStore(store) {
      if (!store || typeof store !== 'object') return state;
      state.chats = store.getMutableChats?.() || store.getChats?.() || state.chats || [];
      state.allUsers = store.getMutableAllUsers?.() || store.getAllUsers?.() || state.allUsers || [];
      state.onlineUsers = store.getMutableOnlineUsers?.() || store.getOnlineUsers?.() || state.onlineUsers || new Set();
      state.currentChat = state.getCurrentChat();
      return state;
    };
    state.getWs = function getWs() {
      return state.ws;
    };
    state.setWs = function setWs(socket) {
      state.ws = socket || null;
      return state.ws;
    };
    state.clearWsReconnectTimer = function clearWsReconnectTimer() {
      if (state.wsReconnectTimer) clearTimeout(state.wsReconnectTimer);
      state.wsReconnectTimer = null;
      return state;
    };
    state.closeWs = function closeWs(code, reason) {
      if (!state.ws) return false;
      try {
        state.ws.onclose = null;
        if (code != null) state.ws.close(code, reason);
        else state.ws.close();
      } catch (e) {}
      state.ws = null;
      return true;
    };

    return state;
  }

  bootRoot.createInitialState = createInitialState;
})();
