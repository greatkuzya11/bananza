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
    const win = doc?.defaultView;
    const panel = dom.chatHeaderActions;
    const capsule = panel?.closest('.chat-actions-capsule');

    function visibleButtons() {
      return Array.from(panel?.querySelectorAll('button') || []).filter(button =>
        !button.hidden && !button.classList.contains('hidden') && win?.getComputedStyle(button).display !== 'none');
    }

    function setStyleValue(element, name, value) {
      if (element && element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
    }

    function syncOverflow() {
      if (!panel || !capsule) return;
      // Entry transforms temporarily enlarge scrollWidth. Measure layout widths
      // only, and do not create a scroll surface while the capsule is resizing.
      const resizing = capsule.getAnimations?.().some(animation =>
        animation.transitionProperty === 'width' && animation.playState === 'running');
      const required = visibleButtons().reduce((width, button) => width + button.offsetWidth, 0);
      const overflowing = getOpen() && !resizing && required > panel.getBoundingClientRect().width + 0.5;
      const changed = panel.classList.contains('is-overflowing') !== overflowing;
      panel.classList.toggle('is-overflowing', overflowing);
      if (changed && overflowing && panel.contains(doc.activeElement)) {
        doc.activeElement.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
    }

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
      capsule?.classList.toggle('is-open', isOpen);
      const visible = visibleButtons();
      setStyleValue(capsule, '--chat-action-count', String(visible.length));
      visible.forEach((button, index) => {
        const distance = visible.length - index;
        setStyleValue(button, '--chat-header-action-delay', `${(distance - 1) * 35}ms`);
        setStyleValue(button, '--chat-header-action-offset', `${distance * 44}px`);
      });
      if (chatInfoBtn) {
        chatInfoBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        chatInfoBtn.classList.toggle('is-active', isOpen);
      }
      chatHeaderActions.querySelectorAll('button').forEach((button) => {
        if (isOpen && visible.includes(button)) {
          button.removeAttribute('tabindex');
        } else {
          button.tabIndex = -1;
        }
      });
      syncOverflow();
    }

    function setChatHeaderActionsOpen(open) {
      const nextOpen = Boolean(open);
      if (getOpen() === nextOpen) {
        syncChatHeaderActionsAccessibility();
        return getOpen();
      }
      const current = setOpenValue(nextOpen);
      syncChatHeaderActionsAccessibility();
      if (nextOpen && panel) panel.scrollLeft = 0;
      return current;
    }

    function toggleChatHeaderActions() {
      return setChatHeaderActionsOpen(!getOpen());
    }

    function closeChatHeaderActions() {
      return setChatHeaderActionsOpen(false);
    }

    getRef('chatHeaderActions')?.addEventListener('focusin', (event) => {
      if (!getOpen() || !panel?.classList.contains('is-overflowing')) return;
      const button = event.target?.closest?.('button');
      if (!button || !getRef('chatHeaderActions').contains(button)) return;
      button.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    });

    // Dynamic call/ChatShot controls can change while the capsule is open.
    if (panel && win?.ResizeObserver) new win.ResizeObserver(syncOverflow).observe(panel);
    for (const type of ['transitionend', 'transitioncancel']) {
      capsule?.addEventListener(type, event => {
        if (event.target === capsule && event.propertyName === 'width') syncOverflow();
      });
    }
    if (panel && win?.MutationObserver) {
      new win.MutationObserver(records => {
        if (records.some(record => record.type === 'childList'
          || record.target.matches?.('button'))) syncChatHeaderActionsAccessibility();
      }).observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    }
    capsule?.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const toggle = getRef('chatInfoBtn');
      const buttons = [...visibleButtons().filter(button => !button.disabled), toggle].filter(Boolean);
      const index = buttons.indexOf(doc.activeElement);
      if (index < 0) return;
      event.preventDefault();
      setChatHeaderActionsOpen(true);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (index + (event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next].focus({ preventScroll: true });
    });
    panel?.addEventListener('click', event => {
      if (event.target.closest?.('button:not(:disabled)')) closeChatHeaderActions();
    }, true);
    doc?.addEventListener('pointerdown', event => {
      if (getOpen() && capsule && !capsule.contains(event.target)) closeChatHeaderActions();
    }, true);

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
