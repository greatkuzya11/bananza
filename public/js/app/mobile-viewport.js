(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function getDefaultWindow() {
    return typeof window !== 'undefined' ? window : null;
  }

  function getDefaultDocument() {
    return typeof document !== 'undefined' ? document : null;
  }

  function createMobileViewportShell(options = {}) {
    const opts = objectOrDefault(options);
    const win = opts.window || getDefaultWindow();
    const doc = opts.document || win?.document || getDefaultDocument();
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const localBaseline = { height: 0, width: 0 };

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

    function writeState(name, value) {
      const setter = state[name];
      if (typeof setter !== 'function') return false;
      try {
        setter(value);
        return true;
      } catch {
        return false;
      }
    }

    function callAction(name, fallback, ...args) {
      const action = actions[name];
      if (typeof action !== 'function') return fallback;
      try {
        return action(...args);
      } catch {
        return fallback;
      }
    }

    function getElement(name) {
      return dom[name] || null;
    }

    function detectIosViewportFixTarget() {
      const nav = win?.navigator || {};
      const ua = nav.userAgent || '';
      const platform = nav.platform || '';
      const maxTouchPoints = Number(nav.maxTouchPoints || 0);
      return /iP(hone|ad|od)/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
    }

    const iosViewportFixTarget = detectIosViewportFixTarget();

    function isIosViewportFixTarget() {
      return iosViewportFixTarget;
    }

    function isMobileViewportTarget() {
      const width = Number(win?.innerWidth || 0);
      return Boolean(width > 0 && width <= 768);
    }

    function isIosMobileViewportTarget() {
      return Boolean(iosViewportFixTarget && isMobileViewportTarget());
    }

    function isIosWebkitMotionAllowed() {
      return Boolean(
        iosViewportFixTarget
        && readState('getCurrentModalAnimation', 'soft') !== 'none'
        && !callAction('prefersReducedMotion', false)
      );
    }

    function forceIosAnimationMount(...elements) {
      if (!isIosWebkitMotionAllowed()) return;
      const HTMLElementCtor = win?.HTMLElement || getDefaultWindow()?.HTMLElement;
      elements.forEach((el) => {
        if (HTMLElementCtor && !(el instanceof HTMLElementCtor)) return;
        if (!el || typeof el !== 'object') return;
        void el.offsetWidth;
      });
    }

    function getMobileAppViewportHeight(viewport = null) {
      const vv = win?.visualViewport || null;
      const viewportHeight = Math.max(0, Number(viewport?.height) || vv?.height || win?.innerHeight || 0);
      if (!iosViewportFixTarget || !vv) return viewportHeight;
      const viewportTop = Math.max(
        0,
        viewport && Object.prototype.hasOwnProperty.call(viewport, 'top')
          ? (Number(viewport.top) || 0)
          : (vv.offsetTop || 0)
      );
      return Math.max(0, viewportHeight + viewportTop);
    }

    function getMobileAppViewportTopInset() {
      if (!iosViewportFixTarget) return 0;
      return Math.max(0, win?.visualViewport?.offsetTop || 0);
    }

    function getMobileVisualViewportMetrics() {
      const vv = win?.visualViewport || null;
      const docEl = doc?.documentElement || null;
      const top = Math.max(0, vv?.offsetTop || 0);
      const height = Math.max(0, vv?.height || win?.innerHeight || 0);
      const width = Math.max(0, vv?.width || win?.innerWidth || docEl?.clientWidth || 0);
      return {
        top,
        height,
        width,
        bottom: top + height,
      };
    }

    function getIosVisualViewportMetrics() {
      return getMobileVisualViewportMetrics();
    }

    function getBaselineHeight() {
      return Number(readState('getMobileVisualViewportBaselineHeight', localBaseline.height) || 0);
    }

    function getBaselineWidth() {
      return Number(readState('getMobileVisualViewportBaselineWidth', localBaseline.width) || 0);
    }

    function setBaseline(height, width) {
      localBaseline.height = Math.max(0, Number(height) || 0);
      localBaseline.width = Math.max(0, Number(width) || 0);
      writeState('setMobileVisualViewportBaselineHeight', localBaseline.height);
      writeState('setMobileVisualViewportBaselineWidth', localBaseline.width);
    }

    function getMobileViewportBaselineHeight() {
      const vv = win?.visualViewport || null;
      const docEl = doc?.documentElement || null;
      const viewportWidth = Math.max(0, vv?.width || win?.innerWidth || docEl?.clientWidth || 0);
      const currentHeight = Math.max(
        0,
        (vv?.height || 0) + Math.max(0, vv?.offsetTop || 0),
        win?.innerHeight || 0,
        docEl?.clientHeight || 0
      );
      const baselineWidth = getBaselineWidth();
      const baselineHeight = getBaselineHeight();
      const widthChanged = baselineWidth > 0
        && viewportWidth > 0
        && Math.abs(viewportWidth - baselineWidth) > 48;
      if (!baselineHeight || widthChanged) {
        setBaseline(currentHeight, viewportWidth);
      } else if (currentHeight > baselineHeight) {
        setBaseline(currentHeight, viewportWidth);
      }
      return Math.max(getBaselineHeight(), currentHeight);
    }

    function getIosViewportBaselineHeight() {
      return getMobileViewportBaselineHeight();
    }

    function isMobileKeyboardOpen() {
      if (!isMobileViewportTarget()) return false;
      const msgInput = getElement('msgInput');
      if (!win?.visualViewport) return doc?.activeElement === msgInput;
      const vv = win.visualViewport;
      const viewportTop = Math.max(0, vv.offsetTop || 0);
      const viewportHeight = Math.max(0, vv.height || 0);
      const visibleBottom = viewportTop + viewportHeight;
      const baselineHeight = getMobileViewportBaselineHeight();
      const layoutHeight = Math.max(win?.innerHeight || 0, doc?.documentElement?.clientHeight || 0, baselineHeight);
      const keyboardOverlap = Math.max(
        0,
        layoutHeight - visibleBottom,
        baselineHeight - visibleBottom,
        baselineHeight - viewportHeight
      );
      return keyboardOverlap > 80;
    }

    function isIosKeyboardOpen() {
      return Boolean(isIosMobileViewportTarget() && isMobileKeyboardOpen());
    }

    function isMobileChatKeyboardLayoutActive() {
      if (!isMobileViewportTarget() || !win?.visualViewport) return false;
      const chatView = getElement('chatView');
      const msgInput = getElement('msgInput');
      if (chatView?.classList?.contains('hidden')) return false;
      if (doc?.activeElement !== msgInput && !readState('getIosComposerFocused', false)) return false;
      return isMobileKeyboardOpen();
    }

    function isIosChatKeyboardLayoutActive() {
      return Boolean(isIosMobileViewportTarget() && isMobileChatKeyboardLayoutActive());
    }

    function restoreMobileKeyboardDocumentScroll() {
      if (!isMobileChatKeyboardLayoutActive()) return false;
      if (!win?.scrollX && !win?.scrollY) return false;
      try {
        win.scrollTo(0, 0);
        return true;
      } catch {
        return false;
      }
    }

    function shouldBypassLockedMobileViewportSync(newViewportHeight, options = {}) {
      const syncOptions = objectOrDefault(options);
      const force = Boolean(syncOptions.force);
      const mentionPickerDismissed = Object.prototype.hasOwnProperty.call(syncOptions, 'mentionPickerDismissed')
        ? Boolean(syncOptions.mentionPickerDismissed)
        : Boolean(readState('getMentionPickerDismissed', false));
      if (force || mentionPickerDismissed || iosViewportFixTarget) return true;
      if (!callAction('isMobileViewportLayoutLocked', false)) return true;
      const nextHeight = Math.max(0, Number(newViewportHeight) || 0);
      const prevHeight = Math.max(0, Number(readState('getMobileViewportPrevHeight', 0)) || 0);
      const delta = nextHeight - prevHeight;
      if (Math.abs(delta) < 48) return false;
      if (delta > 0) return true;
      return Boolean(
        doc?.activeElement === getElement('msgInput')
        || readState('getIosComposerFocused', false)
        || callAction('isMobileComposerKeyboardOpen', false)
      );
    }

    return {
      isIosViewportFixTarget,
      isIosMobileViewportTarget,
      isMobileViewportTarget,
      isIosWebkitMotionAllowed,
      getMobileAppViewportHeight,
      getMobileAppViewportTopInset,
      getMobileVisualViewportMetrics,
      getIosVisualViewportMetrics,
      getMobileViewportBaselineHeight,
      getIosViewportBaselineHeight,
      isMobileKeyboardOpen,
      isIosKeyboardOpen,
      isMobileChatKeyboardLayoutActive,
      isIosChatKeyboardLayoutActive,
      forceIosAnimationMount,
      restoreMobileKeyboardDocumentScroll,
      shouldBypassLockedMobileViewportSync,
    };
  }

  root.mobileViewport = {
    createMobileViewportShell,
  };
})();
