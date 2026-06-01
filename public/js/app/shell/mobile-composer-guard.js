(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const shellRoot = root.shell = root.shell || {};

  function createMobileComposerGuard(options = {}) {
    const win = options.window || window;
    const doc = options.document || win.document || document;
    const dom = options.dom || {};
    const mobileViewport = options.mobileViewport || {};
    const actions = options.actions || {};
    const controllers = options.controllers || {};
    const state = {
      viewportFrame: 0,
      dockTop: 0,
      dockHeight: 0,
      dockWidth: 0,
      dockBottom: 0,
      dockInputHeight: 0,
      dockRecentInputDelta: 0,
      dockRecentInputDeltaAt: 0,
      dockActive: false,
      iosComposerFocused: false,
      iosComposerBlurTimer: null,
      composerDismissClickSuppressUntil: 0,
      avatarUserMenuClickSuppressUntil: 0,
      composerGesture: emptyComposerGesture(),
      messageGesture: emptyMessageGesture(),
    };

    const get = (name) => (typeof options[name] === 'function' ? options[name]() : options[name]);
    const call = (name, fallback, ...args) => {
      const fn = actions[name];
      if (typeof fn !== 'function') return fallback;
      return fn(...args);
    };
    const controller = (name) => (typeof controllers[name] === 'function' ? controllers[name]() : controllers[name]);
    const element = (name) => dom[name] || null;
    const rootEl = () => doc?.documentElement || null;
    const $ = (selector) => (typeof actions.$ === 'function' ? actions.$(selector) : doc.querySelector(selector));
    const isElement = (value) => value instanceof (win.Element || Element);
    const isHtmlElement = (value) => value instanceof (win.HTMLElement || HTMLElement);

    function emptyComposerGesture() {
      return { source: '', pointerId: null, touchId: null, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false, target: null };
    }

    function emptyMessageGesture() {
      return { source: '', pointerId: null, touchId: null, startX: 0, startY: 0, moved: false, target: null, keyboardOpenAtStart: false };
    }

    function getMobileAppViewportHeight(viewport = null) {
      if (typeof mobileViewport.getMobileAppViewportHeight === 'function') return mobileViewport.getMobileAppViewportHeight(viewport);
      return Math.max(0, Number(viewport?.height) || win.visualViewport?.height || win.innerHeight || 0);
    }

    function getMobileAppViewportTopInset() {
      return typeof mobileViewport.getMobileAppViewportTopInset === 'function' ? mobileViewport.getMobileAppViewportTopInset() : 0;
    }

    function isIosMobileViewportTarget() {
      return typeof mobileViewport.isIosMobileViewportTarget === 'function'
        ? mobileViewport.isIosMobileViewportTarget()
        : Boolean(isIosViewportFixTarget() && isMobileViewportTarget());
    }

    function isMobileViewportTarget() {
      return typeof mobileViewport.isMobileViewportTarget === 'function'
        ? mobileViewport.isMobileViewportTarget()
        : Boolean(win.innerWidth <= 768);
    }

    function isIosViewportFixTarget() {
      return Boolean(mobileViewport.isIosViewportFixTarget?.());
    }

    function isIosWebkitMotionAllowed() {
      return typeof mobileViewport.isIosWebkitMotionAllowed === 'function' ? mobileViewport.isIosWebkitMotionAllowed() : false;
    }

    function forceIosAnimationMount(...elements) {
      return mobileViewport.forceIosAnimationMount?.(...elements);
    }

    function getMobileVisualViewportMetrics() {
      if (typeof mobileViewport.getMobileVisualViewportMetrics === 'function') return mobileViewport.getMobileVisualViewportMetrics();
      const height = Math.max(0, win.visualViewport?.height || win.innerHeight || 0);
      const top = Math.max(0, win.visualViewport?.offsetTop || 0);
      const width = Math.max(0, win.visualViewport?.width || win.innerWidth || 0);
      return { top, height, width, bottom: top + height };
    }

    function getIosVisualViewportMetrics() {
      return typeof mobileViewport.getIosVisualViewportMetrics === 'function'
        ? mobileViewport.getIosVisualViewportMetrics()
        : getMobileVisualViewportMetrics();
    }

    function getMobileViewportBaselineHeight() {
      return typeof mobileViewport.getMobileViewportBaselineHeight === 'function'
        ? mobileViewport.getMobileViewportBaselineHeight()
        : Math.max(0, win.visualViewport?.height || win.innerHeight || 0);
    }

    function getIosViewportBaselineHeight() {
      return typeof mobileViewport.getIosViewportBaselineHeight === 'function'
        ? mobileViewport.getIosViewportBaselineHeight()
        : getMobileViewportBaselineHeight();
    }

    function isMobileKeyboardOpen() {
      return typeof mobileViewport.isMobileKeyboardOpen === 'function' ? mobileViewport.isMobileKeyboardOpen() : false;
    }

    function isIosKeyboardOpen() {
      return typeof mobileViewport.isIosKeyboardOpen === 'function'
        ? mobileViewport.isIosKeyboardOpen()
        : Boolean(isIosMobileViewportTarget() && isMobileKeyboardOpen());
    }

    function isMobileChatKeyboardLayoutActive() {
      return typeof mobileViewport.isMobileChatKeyboardLayoutActive === 'function' ? mobileViewport.isMobileChatKeyboardLayoutActive() : false;
    }

    function isIosChatKeyboardLayoutActive() {
      return typeof mobileViewport.isIosChatKeyboardLayoutActive === 'function'
        ? mobileViewport.isIosChatKeyboardLayoutActive()
        : Boolean(isIosMobileViewportTarget() && isMobileChatKeyboardLayoutActive());
    }

    function resetMobileKeyboardDock() {
      state.dockActive = false;
      state.dockTop = 0;
      state.dockHeight = 0;
      state.dockWidth = 0;
      state.dockBottom = 0;
      state.dockInputHeight = 0;
      state.dockRecentInputDelta = 0;
      state.dockRecentInputDeltaAt = 0;
    }

    function noteMobileKeyboardInputDelta(delta) {
      state.dockRecentInputDelta = delta;
      state.dockRecentInputDeltaAt = Date.now();
    }

    function getLockedMobileKeyboardViewportMetrics(viewport, keyboardLayoutActive, inputHeight = 0) {
      if (!keyboardLayoutActive) {
        resetMobileKeyboardDock();
        return viewport;
      }

      const height = Math.max(0, Number(viewport?.height) || 0);
      const width = Math.max(0, Number(viewport?.width) || 0);
      const top = Math.max(0, Number(viewport?.top) || 0);
      const bottom = top + height;
      const nextInputHeight = Math.max(0, Number(inputHeight) || 0);
      const bottomDelta = bottom - state.dockBottom;
      const topDelta = top - state.dockTop;
      const heightDelta = height - state.dockHeight;
      const inputDelta = nextInputHeight - state.dockInputHeight;
      const recentDeltaAge = Date.now() - state.dockRecentInputDeltaAt;
      const recentInputDelta = recentDeltaAge >= 0 && recentDeltaAge < 700 ? state.dockRecentInputDelta : 0;
      const relevantInputGrowth = Math.max(inputDelta, recentInputDelta, 0);
      const relevantInputShrink = Math.max(0 - inputDelta, 0 - recentInputDelta, 0);
      const inputDrivenBottomShrink = state.dockActive && bottomDelta < -1 && relevantInputGrowth > 1 && Math.abs(bottomDelta) <= relevantInputGrowth + 24;
      const inputDrivenBottomGrowth = state.dockActive && bottomDelta > 1 && relevantInputShrink > 1 && bottomDelta <= relevantInputShrink + 24;
      const scrollOnlyViewportShift = state.dockActive
        && Math.abs(width - state.dockWidth) <= 48
        && Math.abs(heightDelta) <= 1
        && Math.abs(topDelta) > 1
        && Math.abs(bottomDelta - topDelta) <= 1;
      const shouldResetDock = !state.dockActive
        || Math.abs(width - state.dockWidth) > 48
        || (Math.abs(bottomDelta) > 48 && !inputDrivenBottomShrink && !inputDrivenBottomGrowth && !scrollOnlyViewportShift);
      const shouldAcceptSmallBottomChange = state.dockActive
        && Math.abs(bottomDelta) > 1
        && Math.abs(bottomDelta) <= 48
        && !inputDrivenBottomShrink
        && !inputDrivenBottomGrowth
        && !scrollOnlyViewportShift;

      if (shouldResetDock) {
        state.dockTop = top;
        state.dockHeight = height;
        state.dockWidth = width;
        state.dockBottom = bottom;
        state.dockActive = true;
      } else if (shouldAcceptSmallBottomChange) {
        state.dockTop = top;
        state.dockHeight = height;
        state.dockBottom = bottom;
      }
      state.dockInputHeight = nextInputHeight;
      state.dockHeight = Math.max(0, state.dockBottom - state.dockTop);
      return { ...viewport, top: state.dockTop, height: state.dockHeight, bottom: state.dockBottom };
    }

    function restoreMobileKeyboardDocumentScroll() {
      return Boolean(mobileViewport.restoreMobileKeyboardDocumentScroll?.());
    }

    function syncMobileViewportLayoutState() {
      const root = rootEl();
      if (!root) return;
      if (!isMobileViewportTarget()) {
        root.classList.remove('is-mobile-keyboard-open', 'is-mobile-chat-keyboard-layout');
        root.classList.remove('is-ios-keyboard-open', 'is-ios-chat-keyboard-layout');
        return;
      }
      const headerHeight = Math.max(0, Math.round(element('chatHeader')?.getBoundingClientRect?.().height || 0));
      const inputHeight = Math.max(0, Math.round(element('inputArea')?.getBoundingClientRect?.().height || 0));
      const keyboardOpen = isMobileKeyboardOpen();
      const keyboardLayoutActive = isMobileChatKeyboardLayoutActive();
      const viewport = getLockedMobileKeyboardViewportMetrics(getMobileVisualViewportMetrics(), keyboardLayoutActive, inputHeight);

      root.classList.toggle('is-mobile-keyboard-open', keyboardOpen);
      root.classList.toggle('is-mobile-chat-keyboard-layout', keyboardLayoutActive);
      if (isIosViewportFixTarget()) root.classList.add('is-ios-webkit');
      root.classList.toggle('is-ios-keyboard-open', Boolean(isIosViewportFixTarget() && keyboardOpen));
      root.classList.toggle('is-ios-chat-keyboard-layout', Boolean(isIosViewportFixTarget() && keyboardLayoutActive));
      root.style.setProperty('--mobile-visual-viewport-top', `${Math.round(viewport.top)}px`);
      root.style.setProperty('--mobile-visual-viewport-height', `${Math.round(viewport.height)}px`);
      root.style.setProperty('--mobile-chat-header-height', `${headerHeight}px`);
      root.style.setProperty('--mobile-chat-input-area-height', `${inputHeight}px`);
      root.style.setProperty('--ios-visual-viewport-top', `${Math.round(viewport.top)}px`);
      root.style.setProperty('--ios-visual-viewport-height', `${Math.round(viewport.height)}px`);
      root.style.setProperty('--ios-chat-header-height', `${headerHeight}px`);
      root.style.setProperty('--ios-chat-input-area-height', `${inputHeight}px`);
      restoreMobileKeyboardDocumentScroll();
    }

    function queueMobileViewportLayoutSync() {
      if (state.viewportFrame) win.cancelAnimationFrame(state.viewportFrame);
      state.viewportFrame = win.requestAnimationFrame(() => {
        state.viewportFrame = 0;
        syncMobileViewportLayoutState();
      });
    }

    function isMobileComposerKeyboardOpen() {
      return Boolean(isMobileViewportTarget() && isMobileKeyboardOpen());
    }

    function focusComposerKeepKeyboard(force = false) {
      const msgInput = element('msgInput');
      if (!msgInput || (!force && !isMobileComposerKeyboardOpen())) return;
      win.requestAnimationFrame(() => {
        try {
          msgInput.focus({ preventScroll: true });
        } catch {
          msgInput.focus();
        }
      });
    }

    function restoreComposerFocusAfterMentionPicker(keyboardAttached = controller('composerState')?.mentionPickerState?.keyboardAttached) {
      if (!isMobileViewportTarget() || keyboardAttached) {
        focusComposerKeepKeyboard(true);
        return true;
      }
      return false;
    }

    function dismissMentionPickerAfterKeyboardClose() {
      if (!isMobileViewportTarget()) return false;
      return Boolean(controller('mentions')?.dismissMentionPickerAfterKeyboardClose?.());
    }

    function preventMobileComposerBlur(event) {
      if (!isMobileComposerKeyboardOpen()) return false;
      event.preventDefault();
      return true;
    }

    function isMobileComposerSessionActive() {
      const msgInput = element('msgInput');
      if (!isMobileViewportTarget()) return false;
      return Boolean(doc.activeElement === msgInput || state.iosComposerFocused || isMobileComposerKeyboardOpen());
    }

    function setIosComposerFocused(value) {
      state.iosComposerFocused = Boolean(value);
    }

    function getIosComposerFocused() {
      return state.iosComposerFocused;
    }

    function clearIosComposerBlurTimer() {
      if (state.iosComposerBlurTimer) win.clearTimeout(state.iosComposerBlurTimer);
      state.iosComposerBlurTimer = null;
    }

    function scheduleIosComposerBlur() {
      clearIosComposerBlurTimer();
      state.iosComposerBlurTimer = win.setTimeout(() => {
        state.iosComposerFocused = false;
        resetMobileKeyboardDock();
        queueMobileViewportLayoutSync();
      }, 180);
      win.requestAnimationFrame(() => queueMobileViewportLayoutSync());
    }

    function suppressMobileComposerDismissClick(ms = 520) {
      state.composerDismissClickSuppressUntil = Math.max(state.composerDismissClickSuppressUntil, Date.now() + ms);
    }

    function isMobileComposerDismissClickSuppressed() {
      return Date.now() < state.composerDismissClickSuppressUntil;
    }

    function resetMobileComposerGestureGuard(source = '') {
      if (source && state.composerGesture.source && state.composerGesture.source !== source) return;
      state.composerGesture = emptyComposerGesture();
    }

    function isTouchLikePointerEvent(event) {
      return Boolean(event && typeof event.pointerType === 'string' && event.pointerType !== 'mouse');
    }

    function getComposerGuardTextarea(target) {
      if (!isElement(target)) return null;
      const textarea = target.closest?.('#msgInput');
      return textarea instanceof (win.HTMLTextAreaElement || HTMLTextAreaElement) ? textarea : null;
    }

    function getMobileKeyboardDockScrollSurface(target) {
      if (!isElement(target)) return null;
      return getComposerGuardTextarea(target) || target.closest?.('.emoji-grid, .reaction-emoji-grid, .mention-picker-list');
    }

    function scrollMobileKeyboardDockSurface(surface, clientY, dy) {
      if (!isElement(surface)) return false;
      const maxScrollTop = Math.max(0, Number(surface.scrollHeight || 0) - Number(surface.clientHeight || 0));
      if (maxScrollTop <= 1) return false;
      const scrollTop = Math.max(0, Number(surface.scrollTop || 0));
      if (dy < 0 && scrollTop >= maxScrollTop - 1) return false;
      if (dy > 0 && scrollTop <= 1) return false;
      const gesture = state.composerGesture;
      const previousY = Number.isFinite(Number(gesture.lastY)) && gesture.lastY ? Number(gesture.lastY) : Number(gesture.startY || clientY || 0);
      const deltaY = Number(clientY || 0) - previousY;
      if (!deltaY) return true;
      surface.scrollTop = Math.max(0, Math.min(maxScrollTop, scrollTop - deltaY));
      gesture.lastY = Number(clientY || 0);
      return true;
    }

    function isMobileKeyboardDockGestureSurface(target) {
      if (!isElement(target)) return false;
      const inputArea = element('inputArea');
      if (inputArea?.contains?.(target)) return true;
      const floatingSurface = target.closest?.('.emoji-picker, #mentionPicker, #contextConvertPicker, #attachMenu, #reactionPicker, #reactionEmojiPopover');
      return Boolean(floatingSurface && call('isFloatingSurfaceVisible', false, floatingSurface));
    }

    function handleMobileComposerDockMove(event, clientX, clientY) {
      if (event?.__bananzaMobileComposerDockHandled) return true;
      const gesture = state.composerGesture;
      const target = gesture.target;
      if (!target || !isMobileKeyboardDockGestureSurface(target) || !isMobileComposerSessionActive()) return false;
      const dx = clientX - gesture.startX;
      const dy = clientY - gesture.startY;
      if (Math.abs(dy) < 4 || Math.abs(dy) <= Math.abs(dx) || !event?.cancelable) return false;
      const consumedByScrollSurface = scrollMobileKeyboardDockSurface(getMobileKeyboardDockScrollSurface(target), clientY, dy);
      gesture.moved = true;
      event.preventDefault();
      event.stopPropagation?.();
      event.__bananzaMobileComposerDockHandled = true;
      if (!consumedByScrollSurface) restoreMobileKeyboardDocumentScroll();
      queueMobileViewportLayoutSync();
      return true;
    }

    function startMobileComposerDockGesture({ source, pointerId = null, touchId = null, clientX = 0, clientY = 0, target = null } = {}) {
      if (!isMobileKeyboardDockGestureSurface(target) || !isMobileComposerSessionActive()) return false;
      state.composerGesture = {
        source,
        pointerId,
        touchId,
        startX: Number(clientX || 0),
        startY: Number(clientY || 0),
        lastX: Number(clientX || 0),
        lastY: Number(clientY || 0),
        moved: false,
        target: isElement(target) ? target : null,
      };
      return true;
    }

    function finishMobileComposerDockGesture(event, source = '') {
      const gesture = state.composerGesture;
      if (source && gesture.source && gesture.source !== source) return;
      const shouldConsumeEnd = Boolean(gesture.moved && gesture.target && isMobileKeyboardDockGestureSurface(gesture.target));
      resetMobileComposerGestureGuard(source);
      if (!shouldConsumeEnd || !event?.cancelable) return;
      event.preventDefault();
      event.stopImmediatePropagation?.();
      event.stopPropagation?.();
      suppressMobileComposerDismissClick();
    }

    function trackedTouch(touches, touchId) {
      const list = Array.from(touches || []);
      return touchId == null ? list[0] : list.find((item) => Number(item.identifier) === touchId);
    }

    function setupMobileComposerGestureGuard() {
      const inputArea = element('inputArea');
      if (!isHtmlElement(inputArea) || inputArea.__mobileComposerGestureGuardBound) return;
      inputArea.__mobileComposerGestureGuardBound = true;

      inputArea.addEventListener('pointerdown', (event) => {
        if (!isTouchLikePointerEvent(event) || (typeof event.button === 'number' && event.button !== 0)) return;
        startMobileComposerDockGesture({ source: 'pointer', pointerId: Number.isFinite(Number(event.pointerId)) ? Number(event.pointerId) : null, clientX: event.clientX, clientY: event.clientY, target: event.target });
      }, { passive: true });
      inputArea.addEventListener('pointermove', (event) => {
        const gesture = state.composerGesture;
        if (gesture.source !== 'pointer' || !isTouchLikePointerEvent(event)) return;
        if (gesture.pointerId != null && Number(event.pointerId) !== gesture.pointerId) return;
        handleMobileComposerDockMove(event, Number(event.clientX || 0), Number(event.clientY || 0));
      }, { passive: false });
      ['pointerup', 'pointercancel'].forEach((type) => {
        inputArea.addEventListener(type, (event) => finishMobileComposerDockGesture(event, 'pointer'), { passive: false });
      });

      inputArea.addEventListener('touchstart', (event) => {
        if (state.composerGesture.source === 'pointer') return;
        const touch = event.changedTouches?.[0] || event.touches?.[0] || null;
        if (!touch) return;
        startMobileComposerDockGesture({ source: 'touch', touchId: Number.isFinite(Number(touch.identifier)) ? Number(touch.identifier) : null, clientX: touch.clientX, clientY: touch.clientY, target: event.target });
      }, { passive: true });
      inputArea.addEventListener('touchmove', (event) => {
        const gesture = state.composerGesture;
        if (gesture.source !== 'touch') return;
        const touch = trackedTouch(event.touches, gesture.touchId);
        if (!touch) return;
        handleMobileComposerDockMove(event, Number(touch.clientX || 0), Number(touch.clientY || 0));
      }, { passive: false });
      ['touchend', 'touchcancel'].forEach((type) => {
        inputArea.addEventListener(type, (event) => finishMobileComposerDockGesture(event, 'touch'), { passive: false });
      });

      doc.addEventListener('pointerdown', (event) => {
        if (inputArea.contains(event.target) || state.composerGesture.source === 'touch') return;
        if (!isTouchLikePointerEvent(event) || (typeof event.button === 'number' && event.button !== 0)) return;
        startMobileComposerDockGesture({ source: 'dock-pointer', pointerId: Number.isFinite(Number(event.pointerId)) ? Number(event.pointerId) : null, clientX: event.clientX, clientY: event.clientY, target: event.target });
      }, { passive: true, capture: true });
      doc.addEventListener('pointermove', (event) => {
        const gesture = state.composerGesture;
        if (gesture.source !== 'dock-pointer' && gesture.source !== 'pointer') return;
        if (!isTouchLikePointerEvent(event)) return;
        if (gesture.pointerId != null && Number(event.pointerId) !== gesture.pointerId) return;
        handleMobileComposerDockMove(event, Number(event.clientX || 0), Number(event.clientY || 0));
      }, { passive: false, capture: true });
      ['pointerup', 'pointercancel'].forEach((type) => {
        doc.addEventListener(type, (event) => {
          const source = state.composerGesture.source;
          if (source !== 'dock-pointer' && source !== 'pointer') return;
          finishMobileComposerDockGesture(event, source);
        }, { passive: false, capture: true });
      });
      doc.addEventListener('touchstart', (event) => {
        if (inputArea.contains(event.target) || state.composerGesture.source === 'pointer') return;
        const touch = event.changedTouches?.[0] || event.touches?.[0] || null;
        if (!touch) return;
        startMobileComposerDockGesture({ source: 'dock-touch', touchId: Number.isFinite(Number(touch.identifier)) ? Number(touch.identifier) : null, clientX: touch.clientX, clientY: touch.clientY, target: event.target });
      }, { passive: true, capture: true });
      doc.addEventListener('touchmove', (event) => {
        const gesture = state.composerGesture;
        if (gesture.source !== 'dock-touch' && gesture.source !== 'touch') return;
        const touch = trackedTouch(event.touches, gesture.touchId);
        if (!touch) return;
        handleMobileComposerDockMove(event, Number(touch.clientX || 0), Number(touch.clientY || 0));
      }, { passive: false, capture: true });
      ['touchend', 'touchcancel'].forEach((type) => {
        doc.addEventListener(type, (event) => {
          const source = state.composerGesture.source;
          if (source !== 'dock-touch' && source !== 'touch') return;
          finishMobileComposerDockGesture(event, source);
        }, { passive: false, capture: true });
      });
    }

    function preserveMobileComposerOnPointerDown(event, { requireOpenKeyboard = true } = {}) {
      if (!call('isMobileLayoutViewport', false)) return false;
      if (requireOpenKeyboard && !isMobileComposerKeyboardOpen()) return false;
      if (typeof event.button === 'number' && event.button !== 0) return false;
      event.preventDefault();
      return true;
    }

    function dismissMobileComposer({ consumeTap = false, forceRecovery = true, reason = '', recoveryDelayMs = 240 } = {}) {
      const msgInput = element('msgInput');
      if (!call('isMobileLayoutViewport', false)) return false;
      const hadComposerSession = isMobileComposerSessionActive();
      if (consumeTap) suppressMobileComposerDismissClick();
      if (doc.activeElement === msgInput) {
        try { msgInput.blur(); } catch {}
      }
      state.iosComposerFocused = false;
      queueMobileViewportLayoutSync();
      if (forceRecovery) call('scheduleMobileViewportRecovery', undefined, recoveryDelayMs);
      return hadComposerSession;
    }

    function hideAttachMenu({ immediate = false } = {}) {
      return call('closeFloatingSurface', undefined, $('#attachMenu'), { immediate });
    }

    function closeMobileComposerTransientUi({ immediate = true, preserveEmoji = false } = {}) {
      call('hideMentionPicker');
      if (call('isContextConvertPickerActive', false)) call('hideContextConvertPicker');
      call('hideFloatingMessageActions', undefined, { immediate, keepComposerState: false });
      call('hideAvatarUserMenu');
      call('clearActivePulseVoterPopover', undefined, { skipRefresh: true });
      if (!preserveEmoji) call('closeEmojiPicker', undefined, { immediate });
      hideAttachMenu({ immediate });
    }

    function getMobileComposerSafeReturnFocusEl(fallback = null) {
      const active = call('rememberActiveElement', null);
      const msgInput = element('msgInput');
      if (call('isMobileLayoutViewport', false) && active === msgInput) return isHtmlElement(fallback) ? fallback : null;
      return isHtmlElement(active) ? active : (isHtmlElement(fallback) ? fallback : null);
    }

    function isPickerDismissPassThroughTarget(target) {
      return Boolean(isElement(target) && target.closest('#menuBtn, #settingsBtn, #searchBtn, #chatShotBtn, #chatSettingsActionBtn, #callStartBtn, #callVoiceStartBtn, #chatInfoBtn, #backBtn, #emojiBtn, #attachBtn, #mentionOpenBtn, #composerContextConvertBtn, #msgInput'));
    }

    function isFollowupClickSuppressPassThroughTarget(target) {
      return Boolean(isElement(target) && target.closest('.msg-actions button, #reactionPicker button[data-reaction-action], #reactionEmojiPopover button'));
    }

    function consumeOutsidePickerDismissGesture(event, suppressFollowupClick) {
      suppressFollowupClick();
      event.preventDefault();
      event.stopImmediatePropagation?.();
      event.stopPropagation();
    }

    function suppressSearchPanelFollowupClick(ms = 550) {
      return controller('search')?.suppressSearchPanelFollowupClick?.(ms);
    }

    function suppressAvatarUserMenuFollowupClick(ms = 550) {
      state.avatarUserMenuClickSuppressUntil = Math.max(state.avatarUserMenuClickSuppressUntil, Date.now() + ms);
    }

    function isAvatarUserMenuClickSuppressed() {
      return Date.now() < state.avatarUserMenuClickSuppressUntil;
    }

    function bindTouchSafeButtonActivation(button, onActivate, { suppressClickMs = 520 } = {}) {
      if (!isHtmlElement(button) || typeof onActivate !== 'function' || button.__touchSafeActivationBound === '1') return;
      button.__touchSafeActivationBound = '1';
      const gestureState = { source: '', pointerId: null, touchId: null, keyboardOpenAtStart: false };
      const clearGestureState = () => {
        gestureState.source = '';
        gestureState.pointerId = null;
        gestureState.touchId = null;
        gestureState.keyboardOpenAtStart = false;
      };
      const suppressFollowupClick = (ms = suppressClickMs) => {
        button.__touchSafeSuppressUntil = Math.max(Number(button.__touchSafeSuppressUntil || 0), Date.now() + Math.max(0, Number(ms) || 0));
      };
      const isFollowupClickSuppressed = () => Date.now() < Number(button.__touchSafeSuppressUntil || 0);
      const buildActivationContext = (event, source) => {
        const startKeyboardOpen = Boolean(gestureState.keyboardOpenAtStart || button.__mouseDownKeyboardWasOpen || (source === 'click' && isMobileComposerKeyboardOpen()));
        return { event, source, startKeyboardOpen, keepKeyboardOpen: !call('isMobileLayoutViewport', false) || startKeyboardOpen || isMobileComposerKeyboardOpen(), isTouchLike: source === 'pointer' || source === 'touch' };
      };
      const maybePreserveComposerOnGestureStart = (event, keyboardOpenAtStart) => {
        if (!call('isMobileLayoutViewport', false) || !keyboardOpenAtStart || !event?.cancelable) return false;
        event.preventDefault();
        return true;
      };
      const startGesture = (event, source) => {
        gestureState.source = source;
        gestureState.pointerId = source === 'pointer' && Number.isFinite(Number(event.pointerId)) ? Number(event.pointerId) : null;
        const touch = source === 'touch' ? (event.changedTouches?.[0] || event.touches?.[0] || null) : null;
        gestureState.touchId = touch && Number.isFinite(Number(touch.identifier)) ? Number(touch.identifier) : null;
        gestureState.keyboardOpenAtStart = isMobileComposerKeyboardOpen();
        maybePreserveComposerOnGestureStart(event, gestureState.keyboardOpenAtStart);
      };
      const activateFromGesture = (event, source) => {
        const context = buildActivationContext(event, source);
        suppressFollowupClick();
        button.__mouseDownKeyboardWasOpen = false;
        clearGestureState();
        onActivate(context);
        event.preventDefault?.();
        event.stopPropagation?.();
      };
      button.addEventListener('pointerdown', (event) => {
        if (gestureState.source === 'touch' || !isTouchLikePointerEvent(event) || (typeof event.button === 'number' && event.button !== 0)) return;
        startGesture(event, 'pointer');
      }, { passive: false });
      button.addEventListener('pointerup', (event) => {
        if (gestureState.source !== 'pointer') return;
        if (!isTouchLikePointerEvent(event)) {
          clearGestureState();
          return;
        }
        if (gestureState.pointerId != null && Number(event.pointerId) !== gestureState.pointerId) return;
        activateFromGesture(event, 'pointer');
      }, { passive: false });
      button.addEventListener('pointercancel', () => {
        if (gestureState.source === 'pointer') clearGestureState();
      }, { passive: true });
      button.addEventListener('touchstart', (event) => {
        if (gestureState.source === 'pointer' || gestureState.source === 'touch') return;
        startGesture(event, 'touch');
      }, { passive: false });
      button.addEventListener('touchend', (event) => {
        if (gestureState.source !== 'touch') return;
        if (gestureState.touchId != null) {
          const matchesTouch = Array.from(event.changedTouches || []).some((touch) => Number(touch.identifier) === gestureState.touchId);
          if (!matchesTouch && (event.changedTouches?.length || 0) > 0) return;
        }
        activateFromGesture(event, 'touch');
      }, { passive: false });
      button.addEventListener('touchcancel', () => {
        if (gestureState.source === 'touch') clearGestureState();
      }, { passive: true });
      button.addEventListener('mousedown', (event) => {
        if (typeof event.button === 'number' && event.button !== 0) return;
        button.__mouseDownKeyboardWasOpen = isMobileComposerKeyboardOpen();
        if (call('isMobileLayoutViewport', false) && button.__mouseDownKeyboardWasOpen && event.cancelable) event.preventDefault();
      });
      button.addEventListener('click', (event) => {
        if (isFollowupClickSuppressed()) {
          event.preventDefault();
          event.stopPropagation();
          button.__mouseDownKeyboardWasOpen = false;
          return;
        }
        const context = buildActivationContext(event, 'click');
        button.__mouseDownKeyboardWasOpen = false;
        clearGestureState();
        onActivate(context);
      });
    }

    function isMobileComposerDismissMessageTarget(target) {
      const messagesEl = element('messagesEl');
      if (!isElement(target)) return false;
      const row = target.closest('.msg-row');
      if (!row || !messagesEl?.contains(row) || row.dataset.outbox === '1' || row.querySelector('.msg-deleted')) return false;
      if (target.closest('.msg-actions, button, a, input, textarea, select, label, audio, video, .video-note-stage, .msg-reply, .reaction-badge, .msg-image, .msg-video, .msg-file, .link-preview, .msg-group-avatar')) return false;
      return true;
    }

    function isMobileComposerDismissBackgroundTarget(target) {
      const messagesEl = element('messagesEl');
      if (!isElement(target) || !messagesEl?.contains(target)) return false;
      if (target.closest('.msg-row')) return false;
      if (target.closest('button, a, input, textarea, select, label, audio, video')) return false;
      return true;
    }

    function resetMobileMessageInteractionGuard(source = '') {
      if (source && state.messageGesture.source && state.messageGesture.source !== source) return;
      state.messageGesture = emptyMessageGesture();
    }

    function isMobileMessageKeyboardPreserveTarget(target) {
      return isMobileComposerDismissMessageTarget(target) || isMobileComposerDismissBackgroundTarget(target);
    }

    function shouldKeepComposerForMobileMessageInteraction() {
      if (!call('isMobileLayoutViewport', false)) return false;
      return Boolean(state.messageGesture.keyboardOpenAtStart || isMobileComposerKeyboardOpen());
    }

    function startMobileMessageInteractionGuard({ source, pointerId = null, touchId = null, clientX = 0, clientY = 0, target = null } = {}) {
      if (!isMobileComposerSessionActive() || !isMobileMessageKeyboardPreserveTarget(target)) return false;
      state.messageGesture = { source, pointerId, touchId, startX: Number(clientX || 0), startY: Number(clientY || 0), moved: false, target: isElement(target) ? target : null, keyboardOpenAtStart: isMobileComposerKeyboardOpen() };
      return state.messageGesture.keyboardOpenAtStart;
    }

    function updateMobileMessageInteractionGuard(clientX, clientY) {
      const gesture = state.messageGesture;
      if (!gesture.source) return;
      const dx = Number(clientX || 0) - gesture.startX;
      const dy = Number(clientY || 0) - gesture.startY;
      if (Math.hypot(dx, dy) > 10) gesture.moved = true;
    }

    function finishMobileMessageInteractionGuard(event, source = '') {
      const gesture = state.messageGesture;
      if (!gesture.source || (source && gesture.source !== source)) return;
      const { target, moved, keyboardOpenAtStart } = gesture;
      resetMobileMessageInteractionGuard(source);
      if (!keyboardOpenAtStart || moved || !target || !isMobileMessageKeyboardPreserveTarget(target)) return;
      if (controller('floatingActions')?.isMessageActionTapSuppressed?.() || call('isFloatingSurfaceVisible', false, element('reactionPicker'))) {
        focusComposerKeepKeyboard(true);
        return;
      }
      if (event?.cancelable) event.preventDefault();
      suppressMobileComposerDismissClick();
      const row = isMobileComposerDismissMessageTarget(target) ? target.closest('.msg-row') : null;
      if (row) call('showMessageActions', undefined, row, { toggle: true, keepComposerFocus: true });
      else call('hideFloatingMessageActions', undefined, { keepComposerState: true });
      focusComposerKeepKeyboard(true);
    }

    function setupMobileMessageInteractionGuard() {
      const messagesEl = element('messagesEl');
      if (!isHtmlElement(messagesEl) || messagesEl.__mobileMessageInteractionGuardBound) return;
      messagesEl.__mobileMessageInteractionGuardBound = true;
      messagesEl.addEventListener('pointerdown', (event) => {
        if (!isTouchLikePointerEvent(event) || (typeof event.button === 'number' && event.button !== 0)) return;
        startMobileMessageInteractionGuard({ source: 'pointer', pointerId: Number.isFinite(Number(event.pointerId)) ? Number(event.pointerId) : null, clientX: event.clientX, clientY: event.clientY, target: event.target });
      }, { passive: true, capture: true });
      messagesEl.addEventListener('pointermove', (event) => {
        const gesture = state.messageGesture;
        if (gesture.source !== 'pointer' || !isTouchLikePointerEvent(event)) return;
        if (gesture.pointerId != null && Number(event.pointerId) !== gesture.pointerId) return;
        updateMobileMessageInteractionGuard(event.clientX, event.clientY);
      }, { passive: true, capture: true });
      ['pointerup', 'pointercancel'].forEach((type) => {
        messagesEl.addEventListener(type, (event) => {
          const gesture = state.messageGesture;
          if (gesture.source !== 'pointer') return;
          if (gesture.pointerId != null && Number(event.pointerId) !== gesture.pointerId) return;
          if (type === 'pointercancel') resetMobileMessageInteractionGuard('pointer');
          else finishMobileMessageInteractionGuard(event, 'pointer');
        }, { passive: false, capture: true });
      });
      messagesEl.addEventListener('touchstart', (event) => {
        if (state.messageGesture.source === 'pointer') return;
        const touch = event.changedTouches?.[0] || event.touches?.[0] || null;
        if (!touch) return;
        startMobileMessageInteractionGuard({ source: 'touch', touchId: Number.isFinite(Number(touch.identifier)) ? Number(touch.identifier) : null, clientX: touch.clientX, clientY: touch.clientY, target: event.target });
      }, { passive: true, capture: true });
      messagesEl.addEventListener('touchmove', (event) => {
        const gesture = state.messageGesture;
        if (gesture.source !== 'touch') return;
        const touch = trackedTouch(event.touches, gesture.touchId);
        if (!touch) return;
        updateMobileMessageInteractionGuard(touch.clientX, touch.clientY);
      }, { passive: true, capture: true });
      ['touchend', 'touchcancel'].forEach((type) => {
        messagesEl.addEventListener(type, (event) => {
          const gesture = state.messageGesture;
          if (gesture.source !== 'touch') return;
          if (type === 'touchcancel') {
            resetMobileMessageInteractionGuard('touch');
            return;
          }
          if (gesture.touchId != null && (event.changedTouches?.length || 0) > 0) {
            const matchesTouch = Array.from(event.changedTouches || []).some((touch) => Number(touch.identifier) === gesture.touchId);
            if (!matchesTouch) return;
          }
          finishMobileMessageInteractionGuard(event, 'touch');
        }, { passive: false, capture: true });
      });
    }

    function shouldBypassLockedMobileViewportSync(newViewportHeight, { force = false, mentionPickerDismissed = false } = {}) {
      if (typeof mobileViewport.shouldBypassLockedMobileViewportSync === 'function') {
        return mobileViewport.shouldBypassLockedMobileViewportSync(newViewportHeight, { force, mentionPickerDismissed });
      }
      return true;
    }

    function getMobileKeyboardDockSnapshot() {
      const root = rootEl();
      return {
        keyboardOpen: root?.classList.contains('is-mobile-keyboard-open') || false,
        chatKeyboardLayout: root?.classList.contains('is-mobile-chat-keyboard-layout') || false,
        iosKeyboardOpen: root?.classList.contains('is-ios-keyboard-open') || false,
        iosChatKeyboardLayout: root?.classList.contains('is-ios-chat-keyboard-layout') || false,
        mobileViewportTop: root?.style.getPropertyValue('--mobile-visual-viewport-top') || '',
        mobileViewportHeight: root?.style.getPropertyValue('--mobile-visual-viewport-height') || '',
        mobileInputHeight: root?.style.getPropertyValue('--mobile-chat-input-area-height') || '',
        appHeight: doc.getElementById('app')?.style?.height || '',
        dockActive: state.dockActive,
        dockBottom: state.dockBottom,
        dockInputHeight: state.dockInputHeight,
        dockRecentInputDelta: state.dockRecentInputDelta,
      };
    }

    return {
      getMobileAppViewportHeight,
      getMobileAppViewportTopInset,
      isIosMobileViewportTarget,
      isMobileViewportTarget,
      isIosWebkitMotionAllowed,
      forceIosAnimationMount,
      getMobileVisualViewportMetrics,
      getIosVisualViewportMetrics,
      getMobileViewportBaselineHeight,
      getIosViewportBaselineHeight,
      isMobileKeyboardOpen,
      isIosKeyboardOpen,
      isMobileChatKeyboardLayoutActive,
      isIosChatKeyboardLayoutActive,
      resetMobileKeyboardDock,
      getLockedMobileKeyboardViewportMetrics,
      noteMobileKeyboardInputDelta,
      restoreMobileKeyboardDocumentScroll,
      syncMobileViewportLayoutState,
      syncIosViewportLayoutState: syncMobileViewportLayoutState,
      queueMobileViewportLayoutSync,
      queueIosViewportLayoutSync: queueMobileViewportLayoutSync,
      isMobileComposerKeyboardOpen,
      focusComposerKeepKeyboard,
      restoreComposerFocusAfterMentionPicker,
      dismissMentionPickerAfterKeyboardClose,
      preventMobileComposerBlur,
      isMobileComposerSessionActive,
      setIosComposerFocused,
      getIosComposerFocused,
      clearIosComposerBlurTimer,
      scheduleIosComposerBlur,
      suppressMobileComposerDismissClick,
      isMobileComposerDismissClickSuppressed,
      setupMobileComposerGestureGuard,
      preserveMobileComposerOnPointerDown,
      dismissMobileComposer,
      closeMobileComposerTransientUi,
      hideAttachMenu,
      getMobileComposerSafeReturnFocusEl,
      isTouchLikePointerEvent,
      isPickerDismissPassThroughTarget,
      isFollowupClickSuppressPassThroughTarget,
      consumeOutsidePickerDismissGesture,
      suppressSearchPanelFollowupClick,
      suppressAvatarUserMenuFollowupClick,
      isAvatarUserMenuClickSuppressed,
      bindTouchSafeButtonActivation,
      shouldKeepComposerForMobileMessageInteraction,
      setupMobileMessageInteractionGuard,
      shouldBypassLockedMobileViewportSync,
      getMobileKeyboardDockSnapshot,
    };
  }

  shellRoot.createMobileComposerGuard = createMobileComposerGuard;
})();
