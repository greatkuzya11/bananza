(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function getDefaultDocument() {
    return typeof document !== 'undefined' ? document : null;
  }

  function createChatHeaderActions(options = {}) {
    const opts = objectOrDefault(options);
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const doc = opts.document || getDefaultDocument();

    function getRef(name) {
      return dom[name] || null;
    }

    function queryById(id) {
      if (typeof dom.$ === 'function') return dom.$(`#${id}`);
      return doc?.getElementById?.(id) || null;
    }

    function getOpen() {
      if (typeof state.getChatHeaderActionsOpen !== 'function') return false;
      try {
        return Boolean(state.getChatHeaderActionsOpen());
      } catch {
        return false;
      }
    }

    function setOpenValue(open) {
      if (typeof state.setChatHeaderActionsOpen !== 'function') return Boolean(open);
      try {
        return Boolean(state.setChatHeaderActionsOpen(Boolean(open)));
      } catch {
        return Boolean(open);
      }
    }

    function getChatSettingsActionOpener() {
      return getRef('chatSettingsActionBtn')
        || getRef('chatInfoBtn')
        || queryById('chatSettingsActionBtn')
        || queryById('chatInfoBtn');
    }

    function moveFocusOutOfChatHeaderActions() {
      const chatHeaderActions = getRef('chatHeaderActions');
      if (!chatHeaderActions) return;
      const active = doc?.activeElement;
      const ElementCtor = doc?.defaultView?.Element || (typeof Element !== 'undefined' ? Element : null);
      if (!ElementCtor || !(active instanceof ElementCtor) || !chatHeaderActions.contains(active)) return;
      const fallback = getRef('chatInfoBtn') || queryById('chatInfoBtn');
      if (fallback && typeof fallback.focus === 'function' && !fallback.disabled && !fallback.hidden) {
        try {
          fallback.focus({ preventScroll: true });
        } catch {
          fallback.focus();
        }
      }
      if (doc?.activeElement === active && typeof active.blur === 'function') {
        active.blur();
      }
    }

    function syncChatHeaderActionsAccessibility() {
      const chatHeaderActions = getRef('chatHeaderActions');
      const chatInfoBtn = getRef('chatInfoBtn');
      if (!chatHeaderActions) return;
      const isOpen = getOpen();
      if (!isOpen) moveFocusOutOfChatHeaderActions();
      chatHeaderActions.inert = !isOpen;
      chatHeaderActions.classList.toggle('is-open', isOpen);
      chatHeaderActions.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      if (chatInfoBtn) {
        chatInfoBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        chatInfoBtn.classList.toggle('is-active', isOpen);
      }
      chatHeaderActions.querySelectorAll('button').forEach((button) => {
        if (isOpen && !button.classList.contains('hidden') && !button.hidden) {
          button.removeAttribute('tabindex');
        } else {
          button.tabIndex = -1;
        }
      });
    }

    function setChatHeaderActionsOpen(open) {
      const nextOpen = Boolean(open);
      if (getOpen() === nextOpen) {
        syncChatHeaderActionsAccessibility();
        return getOpen();
      }
      const current = setOpenValue(nextOpen);
      syncChatHeaderActionsAccessibility();
      return current;
    }

    function toggleChatHeaderActions() {
      return setChatHeaderActionsOpen(!getOpen());
    }

    function closeChatHeaderActions() {
      return setChatHeaderActionsOpen(false);
    }

    return {
      getChatSettingsActionOpener,
      moveFocusOutOfChatHeaderActions,
      syncChatHeaderActionsAccessibility,
      setChatHeaderActionsOpen,
      toggleChatHeaderActions,
      closeChatHeaderActions,
    };
  }

  root.chatHeaderActions = {
    createChatHeaderActions,
  };
})();
