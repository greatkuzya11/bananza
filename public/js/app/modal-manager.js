(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const DEFAULT_MODAL_TRANSITION_BUFFER_MS = 180;

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createModalManager(options = {}) {
    const opts = objectOrDefault(options);
    const win = opts.window || (typeof window !== 'undefined' ? window : null);
    const doc = opts.document || win?.document || (typeof document !== 'undefined' ? document : null);
    const config = objectOrDefault(opts.config);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const modalTransitionBufferMs = Math.max(
      0,
      Number(config.MODAL_TRANSITION_BUFFER_MS ?? DEFAULT_MODAL_TRANSITION_BUFFER_MS) || DEFAULT_MODAL_TRANSITION_BUFFER_MS
    );
    const modalRegistry = new Map();
    let modalStack = [];
    let modalHistoryDepth = 0;
    let modalSkipPopstateCount = 0;
    let pendingModalHistoryRewind = 0;
    let modalHistorySyncTimer = null;
    let modalHistorySyncDueAt = 0;

    function isElement(el) {
      if (!el) return false;
      const ElementCtor = win?.Element;
      return ElementCtor ? el instanceof ElementCtor : Boolean(el.nodeType === 1);
    }

    function isHTMLElement(el) {
      if (!el) return false;
      const HTMLElementCtor = win?.HTMLElement;
      return HTMLElementCtor ? el instanceof HTMLElementCtor : isElement(el);
    }

    function callAction(name, fallback, ...args) {
      const action = actions[name] || opts[name];
      if (typeof action !== 'function') return fallback;
      try {
        const value = action(...args);
        return value == null ? fallback : value;
      } catch {
        return fallback;
      }
    }

    function callOption(name, fallback, ...args) {
      const fn = opts[name];
      if (typeof fn !== 'function') return fallback;
      try {
        const value = fn(...args);
        return value == null ? fallback : value;
      } catch {
        return fallback;
      }
    }

    function readState(name, fallback) {
      const getter = state[name];
      if (typeof getter !== 'function') return fallback;
      try {
        const value = getter();
        return value == null ? fallback : value;
      } catch {
        return fallback;
      }
    }

    function modalIdOf(modalOrId) {
      if (typeof modalOrId === 'string') return modalOrId;
      return modalOrId?.id || '';
    }

    function modalEntryOf(modalOrId) {
      return modalRegistry.get(modalIdOf(modalOrId)) || null;
    }

    function focusElementIfPossible(el) {
      if (!isHTMLElement(el) || !el.isConnected) return false;
      if (typeof el.matches === 'function' && el.matches('[disabled], [aria-hidden="true"]')) return false;
      if (typeof el.closest === 'function' && el.closest('[inert]')) return false;
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

    function blurFocusedElementWithin(container) {
      if (!isHTMLElement(container)) return false;
      const active = doc?.activeElement;
      if (!isHTMLElement(active) || !container.contains(active)) return false;
      try {
        active.blur();
        return true;
      } catch {
        return false;
      }
    }

    function getModalFocusableTarget(entry) {
      return entry?.el?.querySelector?.(
        '[autofocus], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ) || null;
    }

    function setModalInertState(entry, disabled) {
      if (!entry?.el) return;
      if (disabled) {
        blurFocusedElementWithin(entry.el);
        entry.el.setAttribute('inert', '');
        entry.el.setAttribute('aria-hidden', 'true');
        entry.el.removeAttribute('aria-modal');
      } else {
        entry.el.removeAttribute('inert');
        entry.el.setAttribute('aria-hidden', 'false');
        entry.el.setAttribute('aria-modal', 'true');
      }
    }

    function updateModalStackState() {
      let activeTopIndex = -1;
      for (let index = modalStack.length - 1; index >= 0; index -= 1) {
        if (!modalStack[index]?.isClosing) {
          activeTopIndex = index;
          break;
        }
      }
      modalStack.forEach((entry, index) => {
        const isTop = index === activeTopIndex;
        entry.el.style.setProperty('--modal-layer-z', String(150 + index * 4));
        entry.el.classList.toggle('is-underlay', !entry.isClosing && !isTop);
        if (isTop && !entry.isClosing) setModalInertState(entry, false);
        else setModalInertState(entry, true);
      });
    }

    function pushModalHistoryState(modalId) {
      const history = win?.history;
      if (!history?.pushState) return;
      history.pushState({ ...(history.state || {}), modalId, modalDepth: modalHistoryDepth + 1 }, '');
      modalHistoryDepth += 1;
    }

    function rewindModalHistory(steps = 1) {
      const history = win?.history;
      const depth = Math.min(Number(steps) || 0, modalHistoryDepth);
      if (!depth || !history?.go) return;
      modalSkipPopstateCount += depth;
      modalHistoryDepth -= depth;
      history.go(-depth);
    }

    function parseTransitionTimeMs(value) {
      const text = String(value || '').trim();
      if (!text) return 0;
      if (text.endsWith('ms')) return Math.max(0, Number.parseFloat(text) || 0);
      if (text.endsWith('s')) return Math.max(0, (Number.parseFloat(text) || 0) * 1000);
      return Math.max(0, Number.parseFloat(text) || 0);
    }

    function getElementTransitionTotalMs(el) {
      if (!isElement(el)) return 0;
      const styles = win?.getComputedStyle?.(el);
      if (!styles) return 0;
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

    function getModalTransitionFallbackMs(entryOrEl) {
      const entry = entryOrEl?.el ? entryOrEl : modalEntryOf(entryOrEl);
      const modalEl = entry?.el || entryOrEl;
      if (!isHTMLElement(modalEl)) return modalTransitionBufferMs;
      const contentEl = modalEl.querySelector('.modal-content');
      const maxDuration = Math.max(
        getElementTransitionTotalMs(modalEl),
        getElementTransitionTotalMs(contentEl)
      );
      return Math.max(modalTransitionBufferMs, Math.ceil(maxDuration + modalTransitionBufferMs));
    }

    function getModalEntriesTransitionFallbackMs(entries = []) {
      return entries.reduce((max, entry) => Math.max(max, getModalTransitionFallbackMs(entry)), modalTransitionBufferMs);
    }

    function flushPendingModalHistoryRewind() {
      win?.clearTimeout?.(modalHistorySyncTimer);
      modalHistorySyncTimer = null;
      modalHistorySyncDueAt = 0;
      if (!pendingModalHistoryRewind) return;
      const steps = pendingModalHistoryRewind;
      pendingModalHistoryRewind = 0;
      rewindModalHistory(steps);
    }

    function scheduleModalHistoryRewind(steps = 1, delayMs = modalTransitionBufferMs) {
      const count = Math.max(0, Number(steps) || 0);
      if (!count) return;
      pendingModalHistoryRewind += count;
      const nextDueAt = Date.now() + Math.max(modalTransitionBufferMs, Number(delayMs) || 0);
      modalHistorySyncDueAt = Math.max(modalHistorySyncDueAt, nextDueAt);
      win?.clearTimeout?.(modalHistorySyncTimer);
      modalHistorySyncTimer = win?.setTimeout?.(() => {
        flushPendingModalHistoryRewind();
      }, Math.max(0, modalHistorySyncDueAt - Date.now())) || null;
    }

    function currentModalAnimation() {
      return callOption('getCurrentModalAnimation', readState('getCurrentModalAnimation', 'soft'));
    }

    function prefersReducedMotion() {
      return Boolean(callAction('prefersReducedMotion', false));
    }

    function shouldCloseImmediately(immediate) {
      return Boolean(immediate || prefersReducedMotion() || currentModalAnimation() === 'none');
    }

    function finalizeModalClose(entry) {
      if (!entry?.el) return false;
      win?.clearTimeout?.(entry.closeTimer);
      entry.closeTimer = null;
      entry.isClosing = false;
      entry.el.classList.add('hidden');
      entry.el.classList.remove('is-open', 'is-underlay', 'is-closing');
      entry.el.style.removeProperty('--modal-layer-z');
      entry.el.removeAttribute('inert');
      entry.el.setAttribute('aria-hidden', 'true');
      entry.el.removeAttribute('aria-modal');
      modalStack = modalStack.filter((item) => item !== entry);
      updateModalStackState();
      try {
        entry.onAfterClose?.();
      } catch {}
      try {
        opts.onModalClosed?.(entry);
      } catch {}
      if (!focusElementIfPossible(entry.returnFocusEl)) {
        focusElementIfPossible(getModalFocusableTarget(getTop()));
      }
      callAction('scheduleMobileViewportRecovery', false);
      return true;
    }

    function beginModalClose(entry, { immediate = false } = {}) {
      if (!entry?.el || entry.isClosing) return false;
      entry.isClosing = true;
      if (entry.openFrame) {
        win?.cancelAnimationFrame?.(entry.openFrame);
        entry.openFrame = null;
      }
      entry.el.classList.remove('is-open', 'is-underlay');
      entry.el.classList.add('is-closing');
      setModalInertState(entry, true);
      updateModalStackState();
      if (shouldCloseImmediately(immediate)) {
        return finalizeModalClose(entry);
      }

      const transitionTarget = entry.el.querySelector('.modal-content') || entry.el;
      const onTransitionEnd = (event) => {
        if (event.target !== transitionTarget || !['opacity', 'transform'].includes(event.propertyName)) return;
        transitionTarget.removeEventListener('transitionend', onTransitionEnd);
        finalizeModalClose(entry);
      };
      transitionTarget.addEventListener('transitionend', onTransitionEnd);
      win?.clearTimeout?.(entry.closeTimer);
      entry.closeTimer = win?.setTimeout?.(() => {
        transitionTarget.removeEventListener('transitionend', onTransitionEnd);
        finalizeModalClose(entry);
      }, getModalTransitionFallbackMs(entry)) || null;
      return true;
    }

    function register(modalOrId, options = {}) {
      const el = typeof modalOrId === 'string' ? doc?.getElementById?.(modalOrId) : modalOrId;
      if (!el?.id) return null;
      const current = modalRegistry.get(el.id) || {};
      const onAfterClose = options.onAfterClose || options.onClose || current.onAfterClose || null;
      const entry = {
        id: el.id,
        el,
        closeOnBackdrop: options.closeOnBackdrop !== false,
        onAfterClose,
        isClosing: current.isClosing || false,
        closeTimer: current.closeTimer || null,
        openFrame: current.openFrame || null,
        returnFocusEl: current.returnFocusEl || null,
      };
      const stackIndex = modalStack.indexOf(current);
      if (stackIndex !== -1) modalStack[stackIndex] = entry;
      modalRegistry.set(el.id, entry);
      el.dataset.managedModal = '1';
      if (!el.hasAttribute('role')) el.setAttribute('role', 'dialog');
      return entry;
    }

    function getTop() {
      return modalStack[modalStack.length - 1] || null;
    }

    function hasOpen() {
      return modalStack.length > 0;
    }

    function open(modalOrId, { replaceStack = false, opener = null } = {}) {
      const entry = register(modalOrId);
      if (!entry?.el) return null;
      callAction('closeMobileComposerTransientUi', false, { immediate: true });
      callAction('dismissMobileComposer', false, { forceRecovery: true, reason: `modal:${entry.id}` });
      flushPendingModalHistoryRewind();
      const reuseHistoryEntry = replaceStack && modalHistoryDepth === 1;
      if (replaceStack && modalStack.length) {
        closeAll({ immediate: true, includeMedia: false, syncHistory: !reuseHistoryEntry });
      }
      const existingIndex = modalStack.indexOf(entry);
      if (existingIndex !== -1) {
        if (existingIndex !== modalStack.length - 1) {
          const removable = modalStack.slice(existingIndex + 1).reverse();
          removable.forEach((item) => beginModalClose(item, { immediate: true }));
        }
        entry.returnFocusEl = isHTMLElement(opener) ? opener : entry.returnFocusEl;
        updateModalStackState();
        return entry;
      }

      entry.returnFocusEl = isHTMLElement(opener)
        ? opener
        : callAction('getMobileComposerSafeReturnFocusEl', null);
      entry.isClosing = false;
      win?.clearTimeout?.(entry.closeTimer);
      if (entry.openFrame) win?.cancelAnimationFrame?.(entry.openFrame);
      entry.el.classList.remove('hidden', 'is-closing', 'is-underlay');
      entry.el.classList.remove('is-open');
      callAction('forceIosAnimationMount', false, entry.el, entry.el.querySelector('.modal-content'));
      modalStack.push(entry);
      updateModalStackState();
      if (reuseHistoryEntry) {
        win?.history?.replaceState?.({ ...(win.history.state || {}), modalId: entry.id, modalDepth: 1 }, '');
        modalHistoryDepth = 1;
      } else {
        pushModalHistoryState(entry.id);
      }
      entry.openFrame = win?.requestAnimationFrame?.(() => {
        entry.openFrame = win?.requestAnimationFrame?.(() => {
          entry.el.classList.add('is-open');
          entry.openFrame = null;
        }) || null;
      }) || null;
      try {
        opts.onModalOpened?.(entry);
      } catch {}
      return entry;
    }

    function close(modalOrId, { immediate = false, fromHistory = false } = {}) {
      const entry = modalEntryOf(modalOrId);
      if (!entry) return false;
      const index = modalStack.indexOf(entry);
      if (index === -1) {
        try {
          entry.onAfterClose?.();
        } catch {}
        return false;
      }
      const toClose = modalStack.slice(index).reverse();
      toClose.forEach((item) => beginModalClose(item, { immediate }));
      if (!fromHistory) {
        if (shouldCloseImmediately(immediate)) rewindModalHistory(toClose.length);
        else scheduleModalHistoryRewind(toClose.length, getModalEntriesTransitionFallbackMs(toClose));
      } else {
        modalHistoryDepth = Math.max(0, modalHistoryDepth - toClose.length);
      }
      return true;
    }

    function closeTop(options = {}) {
      const top = getTop();
      if (!top) return false;
      return close(top.id, options);
    }

    function closeAll({ immediate = false, includeMedia = true, syncHistory = true } = {}) {
      if (modalStack.length) {
        const toClose = [...modalStack].reverse();
        toClose.forEach((entry) => beginModalClose(entry, { immediate }));
        if (syncHistory) {
          if (shouldCloseImmediately(immediate)) rewindModalHistory(modalHistoryDepth);
          else scheduleModalHistoryRewind(modalHistoryDepth, getModalEntriesTransitionFallbackMs(toClose));
        }
        modalHistoryDepth = 0;
      }
      if (includeMedia) callAction('closeMediaViewer', false);
      callAction('scheduleMobileViewportRecovery', false);
      return true;
    }

    function syncHistory() {
      flushPendingModalHistoryRewind();
      return modalHistoryDepth;
    }

    function handlePopState(event, optionsForEvent = {}) {
      if (modalSkipPopstateCount > 0) {
        modalSkipPopstateCount -= 1;
        return true;
      }
      if (optionsForEvent?.skipOnly) return false;
      if (hasOpen()) {
        closeTop({ fromHistory: true });
        return true;
      }
      return false;
    }

    function registerBuiltins(definitions = []) {
      if (!Array.isArray(definitions)) return [];
      return definitions.map((definition) => {
        if (Array.isArray(definition)) return register(definition[0], definition[1] || {});
        if (definition && typeof definition === 'object' && !isElement(definition)) {
          const modal = definition.modal || definition.el || definition.id;
          const { modal: _modal, el: _el, id: _id, ...definitionOptions } = definition;
          return register(modal, definitionOptions);
        }
        return register(definition);
      });
    }

    return {
      register,
      open,
      close,
      closeTop,
      closeAll,
      getTop,
      hasOpen,
      getStack: () => modalStack.slice(),
      getEntry: (modalOrId) => modalEntryOf(modalOrId),
      syncHistory,
      handlePopState,
      registerBuiltins,
    };
  }

  root.modalManager = {
    createModalManager,
  };
})();
