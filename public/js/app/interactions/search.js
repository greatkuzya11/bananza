(function () {

function objectOrDefault(value) {
  return value && typeof value === 'object' ? value : {};
}

function getter(fn) {
  fn.__bananzaInteractionGetter = true;
  return fn;
}

function createLegacyScope(deps, win) {
  const target = Object.create(null);
  return new Proxy(target, {
    has(_target, prop) {
      return prop !== Symbol.unscopables;
    },
    get(_target, prop) {
      if (prop === Symbol.unscopables) return undefined;
      if (Object.prototype.hasOwnProperty.call(target, prop)) return target[prop];
      if (Object.prototype.hasOwnProperty.call(deps, prop)) {
        const value = deps[prop];
        return value && value.__bananzaInteractionGetter ? value() : value;
      }
      const value = win[prop];
      if (
        typeof value === 'function'
        && (prop === 'setTimeout'
          || prop === 'clearTimeout'
          || prop === 'requestAnimationFrame'
          || prop === 'cancelAnimationFrame')
      ) {
        return value.bind(win);
      }
      return value;
    },
    set(_target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
}


const root = window.BananzaApp = window.BananzaApp || {};
const interactionsRoot = root.interactions = root.interactions || {};

function createSearchController(options = {}) {
  const opts = objectOrDefault(options);
  const win = opts.window || window;
  const doc = opts.document || document;
  const dom = objectOrDefault(opts.dom);
  const state = objectOrDefault(opts.state);
  const actions = objectOrDefault(opts.actions);
  const config = objectOrDefault(opts.config || root.config);
  const deps = {
    window: win,
    document: doc,
    history: win.history,
    location: win.location,
    Element: win.Element,
    HTMLElement: win.HTMLElement,
    HTMLInputElement: win.HTMLInputElement,
    HTMLTextAreaElement: win.HTMLTextAreaElement,
    HTMLSelectElement: win.HTMLSelectElement,
    Node: win.Node,
    URLSearchParams: win.URLSearchParams,
    searchPanel: dom.searchPanel,
    searchPanelSheet: dom.searchPanelSheet,
    searchInput: dom.searchInput,
    searchResults: dom.searchResults,
    searchAllChatsToggle: dom.searchAllChatsToggle,
    searchBtn: dom.searchBtn,
    chatInfoBtn: dom.chatInfoBtn,
    messagesEl: dom.messagesEl,
    sidebar: dom.sidebar,
    currentChatId: getter(() => state.getCurrentChatId?.() || null),
    currentModalAnimation: getter(() => state.getCurrentModalAnimation?.() || 'soft'),
    HORIZONTAL_PAGER_SWIPE_START_PX: config.HORIZONTAL_PAGER_SWIPE_START_PX ?? 10,
    HORIZONTAL_PAGER_SWIPE_COMMIT_MIN_PX: config.HORIZONTAL_PAGER_SWIPE_COMMIT_MIN_PX ?? 64,
    HORIZONTAL_PAGER_SWIPE_COMMIT_RATIO: config.HORIZONTAL_PAGER_SWIPE_COMMIT_RATIO ?? 0.22,
    HORIZONTAL_PAGER_SWIPE_EDGE_DAMPING: config.HORIZONTAL_PAGER_SWIPE_EDGE_DAMPING ?? 0.34,
    HORIZONTAL_PAGER_SWIPE_EDGE_MAX_PX: config.HORIZONTAL_PAGER_SWIPE_EDGE_MAX_PX ?? 52,
    MODAL_TRANSITION_BUFFER_MS: config.MODAL_TRANSITION_BUFFER_MS ?? 80,
    api: opts.api || actions.api || (() => Promise.resolve([])),
    esc: opts.esc || ((value) => String(value == null ? '' : value)),
    t: opts.t || ((key) => String(key || '')),
    tx: opts.tx || ((text) => String(text == null ? '' : text)),
    $: opts.$ || ((selector, rootNode = doc) => rootNode?.querySelector?.(selector) || null),
    clamp: actions.clamp || ((value, min, max) => Math.max(min, Math.min(value, max))),
    showCenterToast: actions.showCenterToast || function noop() {},
    openChat: actions.openChat || (() => Promise.resolve(false)),
    closeMobileComposerTransientUi: actions.closeMobileComposerTransientUi || function noop() {},
    dismissMobileComposer: actions.dismissMobileComposer || function noop() {},
    getMobileComposerSafeReturnFocusEl: actions.getMobileComposerSafeReturnFocusEl || ((fallback) => fallback || null),
    forceIosAnimationMount: actions.forceIosAnimationMount || function noop() {},
    getElementTransitionTotalMs: actions.getElementTransitionTotalMs || (() => 0),
    focusElementIfPossible: actions.focusElementIfPossible || ((el) => { try { el?.focus?.({ preventScroll: true }); return true; } catch { return false; } }),
    blurFocusedElementWithin: actions.blurFocusedElementWithin || function noop() {},
    prefersReducedMotion: actions.prefersReducedMotion || (() => false),
    isMobileLayoutViewport: actions.isMobileLayoutViewport || (() => false),
    revealSidebarFromChat: actions.revealSidebarFromChat || function noop() {},
    normalizeMobileChatListHistoryState: actions.normalizeMobileChatListHistoryState || function noop() {},
    isResolvedMobileChatScene: actions.isResolvedMobileChatScene || (() => false),
    waitForAnimationFrames: actions.waitForAnimationFrames || ((count = 1) => new Promise((resolve) => {
      let remaining = Math.max(1, Number(count) || 1);
      const step = () => { remaining -= 1; if (remaining <= 0) resolve(); else win.requestAnimationFrame(step); };
      win.requestAnimationFrame(step);
    })),
  };
  const scope = createLegacyScope(deps, win);
  with (scope) {
let searchPanelFollowupClickSuppressUntil = 0;
function suppressSearchPanelFollowupClick(ms = 550) {
  searchPanelFollowupClickSuppressUntil = Math.max(searchPanelFollowupClickSuppressUntil, Date.now() + ms);
}
// SEARCH
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
let searchDebounce = null;
let searchRequestSeq = 0;
let searchAllChats = false;
let searchPanelHistoryPushed = false;
let searchPanelSkipNextPopstate = false;
let searchPanelPendingAction = null;
let searchPanelReturnFocusEl = null;
let searchPanelOpenFrame = null;
let searchPanelCloseTimer = null;
let searchPanelTransitionHandler = null;

function isSearchPanelOpen() {
  return Boolean(searchPanel && searchPanel.getAttribute('aria-hidden') === 'false');
}

function clearSearchResults() {
  if (searchResults) searchResults.innerHTML = '';
}

function updateSearchTriggerState(active) {
  $('#searchBtn')?.classList.toggle('is-active', !!active);
}

function localizedSearchText(message) {
  return tx(message == null ? '' : message);
}

function renderSearchResultsEmpty(message = 'No results', kind = 'empty') {
  if (!searchResults) return;
  const safeKind = String(kind || 'empty').replace(/[^a-z0-9_-]/gi, '');
  searchResults.innerHTML = `<div class="search-results-empty search-results-empty--${esc(safeKind)}">${esc(localizedSearchText(message))}</div>`;
}

function renderSearchResultsIdle() {
  renderSearchResultsEmpty('Type at least 2 characters to search', 'idle');
}

function renderSearchResultsLoading() {
  renderSearchResultsEmpty('Searching...', 'loading');
}

function renderSearchScopeToggle() {
  if (!searchAllChatsToggle) return;
  const forcedGlobal = !currentChatId;
  const effectiveAllChats = forcedGlobal ? true : searchAllChats;
  searchAllChatsToggle.checked = effectiveAllChats;
  searchAllChatsToggle.disabled = forcedGlobal;
  searchAllChatsToggle.setAttribute('aria-disabled', forcedGlobal ? 'true' : 'false');
  const scopeEl = searchPanel?.querySelector('.search-panel-scope');
  scopeEl?.classList.toggle('is-disabled', forcedGlobal);
  scopeEl?.classList.toggle('is-all-chats', effectiveAllChats);
}

function clearSearchPanelTransitionState() {
  clearTimeout(searchPanelCloseTimer);
  searchPanelCloseTimer = null;
  if (searchPanelTransitionHandler) {
    searchPanelSheet?.removeEventListener('transitionend', searchPanelTransitionHandler);
    searchPanelTransitionHandler = null;
  }
  if (searchPanelOpenFrame) {
    cancelAnimationFrame(searchPanelOpenFrame);
    searchPanelOpenFrame = null;
  }
}

function ensureSearchPanelReady() {
  if (!searchPanel) return;
  if (searchPanel.dataset.ready === '1') return;
  searchPanel.dataset.ready = '1';
  searchPanel.classList.remove('hidden', 'is-open', 'is-closing');
  searchPanel.setAttribute('aria-hidden', 'true');
  renderSearchScopeToggle();
  updateSearchTriggerState(false);
}

function getSearchPanelTransitionFallbackMs() {
  const maxDuration = Math.max(
    getElementTransitionTotalMs(searchPanel),
    getElementTransitionTotalMs(searchPanelSheet)
  );
  return Math.max(MODAL_TRANSITION_BUFFER_MS, Math.ceil(maxDuration + MODAL_TRANSITION_BUFFER_MS));
}

function focusSearchInput() {
  if (!searchInput) return;
  try {
    searchInput.focus({ preventScroll: true });
  } catch {
    searchInput.focus();
  }
}

function flushSearchPanelPendingAction() {
  const action = searchPanelPendingAction;
  searchPanelPendingAction = null;
  if (typeof action !== 'function') return;
  setTimeout(() => {
    try {
      action();
    } catch (e) {}
  }, 0);
}

function queueSearchPanelPendingAction(action) {
  if (typeof action !== 'function') return false;
  if (typeof searchPanelPendingAction !== 'function') {
    searchPanelPendingAction = action;
    return true;
  }
  const previousAction = searchPanelPendingAction;
  searchPanelPendingAction = () => {
    try {
      previousAction();
    } finally {
      action();
    }
  };
  return true;
}

function shouldAutoFocusSearchInput() {
  return true;
}

function waitForMs(ms = 0) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });
}

function horizontalPagerCommitDistance(width) {
  const normalizedWidth = Math.max(1, Math.round(Number(width || 0) || 1));
  return Math.min(128, Math.max(
    HORIZONTAL_PAGER_SWIPE_COMMIT_MIN_PX,
    Math.round(normalizedWidth * HORIZONTAL_PAGER_SWIPE_COMMIT_RATIO)
  ));
}

function canAnimateHorizontalPager() {
  return !prefersReducedMotion() && currentModalAnimation !== 'none';
}

function stripCloneIds(root) {
  if (!(root instanceof Element)) return root;
  if (root.hasAttribute('id')) root.removeAttribute('id');
  root.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  return root;
}

function syncClonedFormControls(sourceRoot, cloneRoot) {
  if (!(sourceRoot instanceof Element) || !(cloneRoot instanceof Element)) return cloneRoot;
  const sourceControls = sourceRoot.querySelectorAll('input, textarea, select');
  const cloneControls = cloneRoot.querySelectorAll('input, textarea, select');
  sourceControls.forEach((source, index) => {
    const clone = cloneControls[index];
    if (!clone) return;
    if (source instanceof HTMLInputElement && clone instanceof HTMLInputElement) {
      clone.checked = source.checked;
      clone.value = source.value;
      return;
    }
    if (source instanceof HTMLTextAreaElement && clone instanceof HTMLTextAreaElement) {
      clone.value = source.value;
      clone.textContent = source.value;
      return;
    }
    if (source instanceof HTMLSelectElement && clone instanceof HTMLSelectElement) {
      clone.selectedIndex = source.selectedIndex;
      clone.value = source.value;
    }
  });
  return cloneRoot;
}

function cancelScheduledScrollableItemCenter(strip) {
  if (!(strip instanceof HTMLElement)) return;
  if (strip.__scrollableCenterRafPrimary) {
    cancelAnimationFrame(strip.__scrollableCenterRafPrimary);
    strip.__scrollableCenterRafPrimary = 0;
  }
  if (strip.__scrollableCenterRafSecondary) {
    cancelAnimationFrame(strip.__scrollableCenterRafSecondary);
    strip.__scrollableCenterRafSecondary = 0;
  }
}

function centerScrollableItem(strip, item, { behavior = 'auto' } = {}) {
  if (!(strip instanceof HTMLElement) || !(item instanceof HTMLElement)) return false;
  const viewportWidth = Number(strip.clientWidth || 0);
  if (viewportWidth <= 0) return false;
  const maxScrollLeft = Math.max(0, Number(strip.scrollWidth || 0) - viewportWidth);
  const targetLeft = clamp(
    (Number(item.offsetLeft || 0) + (Number(item.offsetWidth || 0) / 2)) - (viewportWidth / 2),
    0,
    maxScrollLeft
  );
  const nextBehavior = behavior === 'smooth' && !prefersReducedMotion() && currentModalAnimation !== 'none'
    ? 'smooth'
    : 'auto';
  if (Math.abs(Number(strip.scrollLeft || 0) - targetLeft) < 1) return true;
  if (typeof strip.scrollTo === 'function') {
    try {
      strip.scrollTo({ left: targetLeft, behavior: nextBehavior });
      if (nextBehavior === 'auto') strip.scrollLeft = targetLeft;
      return true;
    } catch {}
  }
  strip.scrollLeft = targetLeft;
  return true;
}

function scheduleScrollableItemCenter(strip, activeSelector, { behavior = 'auto' } = {}) {
  if (!(strip instanceof HTMLElement)) return false;
  cancelScheduledScrollableItemCenter(strip);
  const nextBehavior = behavior === 'smooth' ? 'smooth' : 'auto';
  strip.__scrollableCenterRafPrimary = requestAnimationFrame(() => {
    strip.__scrollableCenterRafPrimary = 0;
    strip.__scrollableCenterRafSecondary = requestAnimationFrame(() => {
      strip.__scrollableCenterRafSecondary = 0;
      const item = strip.querySelector(activeSelector);
      centerScrollableItem(strip, item, { behavior: nextBehavior });
    });
  });
  return true;
}

function createHorizontalSwipePager(options = {}) {
  const root = options.root;
  if (!(root instanceof HTMLElement)) return null;
  const listenTargets = [root, ...(Array.isArray(options.listenTargets) ? options.listenTargets : [])]
    .filter((target) => target instanceof HTMLElement)
    .filter((target, index, list) => list.indexOf(target) === index);
  root.classList.add('horizontal-swipe-surface');
  listenTargets.forEach((target) => {
    if (target !== root) target.classList.add('horizontal-swipe-listen-target');
  });

  const state = {
    tracking: false,
    dragging: false,
    switching: false,
    pointerId: null,
    captureTarget: null,
    inputKind: '',
    startX: 0,
    startY: 0,
    dx: 0,
    pager: null,
    suppressClickUntil: 0,
  };

  const getKeys = () => (options.getKeys?.() || []).map((key) => String(key || '')).filter(Boolean);
  const getActiveKey = () => String(options.getActiveKey?.() || getKeys()[0] || '');
  const getRootContentWidth = () => {
    const rootWidth = Number(root.clientWidth || 0);
    if (rootWidth <= 0) return 0;
    const style = window.getComputedStyle?.(root);
    const paddingLeft = Number.parseFloat(style?.paddingLeft || '0') || 0;
    const paddingRight = Number.parseFloat(style?.paddingRight || '0') || 0;
    return Math.max(1, Math.round(rootWidth - paddingLeft - paddingRight));
  };
  const getWidth = () => Math.max(
    1,
    Math.round(
      Number(options.getWidth?.() || 0)
      || getRootContentWidth()
      || Number(root.clientWidth || 0)
      || Number(window.innerWidth || 0)
      || 1
    )
  );
  const getKeyIndex = (key, keys = getKeys()) => {
    const index = keys.findIndex((entry) => entry === String(key || ''));
    return index >= 0 ? index : 0;
  };
  const getCommitDistance = () => {
    const width = getWidth();
    const customDistance = Number(options.getCommitDistance?.(width) || 0);
    return customDistance > 0 ? customDistance : horizontalPagerCommitDistance(width);
  };
  const getPageGap = (width = getWidth()) => Math.max(
    0,
    Math.round(
      Number(options.getPageGap?.(width) ?? options.pageGap ?? 0) || 0
    )
  );
  const getPageStep = (width = getWidth()) => width + getPageGap(width);
  const isAvailable = () => (
    !state.switching
    && root.isConnected
    && !root.classList.contains('hidden')
    && getKeys().length > 1
    && options.isAvailable?.() !== false
  );
  const canAnimate = () => canAnimateHorizontalPager() && options.canAnimate?.() !== false;
  const containsAllowedTarget = (target) => listenTargets.some((entry) => entry.contains(target));
  const isAllowedStartTarget = (target) => (
    target instanceof Element
    && containsAllowedTarget(target)
    && options.isAllowedStartTarget?.(target) !== false
  );

  const capturePointer = (target, pointerId) => {
    if (!(target instanceof HTMLElement) || pointerId == null) return false;
    try {
      target.setPointerCapture?.(pointerId);
      state.captureTarget = target;
      return true;
    } catch {
      return false;
    }
  };

  const clearTracking = (event = null) => {
    const pointerId = event?.pointerId ?? state.pointerId;
    if (state.captureTarget instanceof HTMLElement && pointerId != null) {
      try {
        if (state.captureTarget.hasPointerCapture?.(pointerId)) {
          state.captureTarget.releasePointerCapture?.(pointerId);
        }
      } catch {}
    }
    state.tracking = false;
    state.dragging = false;
    state.pointerId = null;
    state.captureTarget = null;
    state.inputKind = '';
    state.startX = 0;
    state.startY = 0;
    state.dx = 0;
  };

  const destroyPager = () => {
    const pager = state.pager;
    state.pager = null;
    if (pager?.stage instanceof HTMLElement) pager.stage.remove();
    root.classList.remove('is-horizontal-swipe-paging');
  };

  const resetSurface = () => {
    destroyPager();
    root.classList.remove(
      'is-horizontal-swipe-dragging',
      'is-horizontal-swipe-settling',
      'is-horizontal-swipe-preparing',
      'is-horizontal-swipe-paging'
    );
    root.style.transform = '';
  };

  const getTransformTarget = () => (
    state.pager?.track instanceof HTMLElement ? state.pager.track : root
  );

  const setOffset = (offset, mode = 'dragging') => {
    root.classList.toggle('is-horizontal-swipe-dragging', mode === 'dragging');
    root.classList.toggle('is-horizontal-swipe-settling', mode === 'settling');
    root.classList.toggle('is-horizontal-swipe-preparing', mode === 'preparing');
    root.classList.toggle('is-horizontal-swipe-paging', Boolean(state.pager));
    const target = getTransformTarget();
    if (!(target instanceof HTMLElement)) return false;
    if (target !== root) root.style.transform = '';
    target.style.transform = `translate3d(${Math.round(Number(offset || 0))}px, 0, 0)`;
    return true;
  };

  const settleOffset = async (offset) => {
    setOffset(offset, 'settling');
    const target = getTransformTarget();
    const transitionMs = Math.ceil(getElementTransitionTotalMs(target));
    await waitForMs(Math.max(transitionMs, 180) + 24);
    return true;
  };

  const createPage = (key, role = '') => {
    const page = document.createElement('div');
    page.className = `horizontal-swipe-page${options.pageClassName ? ` ${options.pageClassName}` : ''}`;
    page.dataset.horizontalSwipePage = String(key || '');
    if (role) page.dataset.horizontalSwipeRole = role;
    const content = options.renderPage?.(key, role);
    if (content instanceof Node) page.appendChild(content);
    return page;
  };

  const preparePager = (direction, nextKey) => {
    if (!canAnimate()) {
      destroyPager();
      return null;
    }
    const keys = getKeys();
    const swipeDirection = direction < 0 ? -1 : 1;
    const currentKey = getActiveKey() || keys[0] || '';
    const targetKey = String(nextKey || '');
    const width = getWidth();
    const pageGap = getPageGap(width);
    const pageStep = width + pageGap;
    const currentPager = state.pager;
    if (
      currentPager
      && currentPager.direction === swipeDirection
      && currentPager.currentKey === currentKey
      && currentPager.nextKey === targetKey
      && currentPager.width === width
      && currentPager.pageGap === pageGap
      && currentPager.track instanceof HTMLElement
      && currentPager.stage instanceof HTMLElement
    ) {
      return currentPager;
    }

    destroyPager();

    const stage = document.createElement('div');
    stage.className = `horizontal-swipe-stage${options.stageClassName ? ` ${options.stageClassName}` : ''}`;
    stage.setAttribute('aria-hidden', 'true');

    const track = document.createElement('div');
    track.className = 'horizontal-swipe-track';
    if (pageGap > 0) track.style.columnGap = `${pageGap}px`;

    const currentPage = createPage(currentKey, 'current');
    const adjacentPage = createPage(targetKey, 'adjacent');
    if (swipeDirection > 0) track.append(currentPage, adjacentPage);
    else track.append(adjacentPage, currentPage);
    stage.appendChild(track);
    root.appendChild(stage);

    state.pager = {
      stage,
      track,
      direction: swipeDirection,
      currentKey,
      nextKey: targetKey,
      width,
      pageGap,
      pageStep,
      baseOffset: swipeDirection > 0 ? 0 : -pageStep,
    };
    setOffset(state.pager.baseOffset, 'preparing');
    return state.pager;
  };

  const snapBack = async () => {
    if (!canAnimate()) {
      resetSurface();
      return false;
    }
    const targetOffset = state.pager ? state.pager.baseOffset : 0;
    try {
      await settleOffset(targetOffset);
      return true;
    } finally {
      resetSurface();
    }
  };

  const applyActiveKey = (key, direction, source = 'swipe') => {
    options.setActiveKey?.(key, { direction, source });
    options.onSettled?.(key, { direction, source });
  };

  const transitionToKey = async (key, { direction = 1, source = 'swipe' } = {}) => {
    const keys = getKeys();
    const nextKey = String(key || '');
    if (!keys.includes(nextKey)) {
      await snapBack();
      return false;
    }
    const currentKey = getActiveKey() || keys[0] || '';
    if (currentKey === nextKey) {
      await snapBack();
      return false;
    }

    const swipeDirection = direction < 0 ? -1 : 1;
    if (!canAnimate()) {
      resetSurface();
      applyActiveKey(nextKey, swipeDirection, source);
      return true;
    }

    let pager = state.pager;
    if (
      !pager
      || pager.direction !== swipeDirection
      || pager.currentKey !== currentKey
      || pager.nextKey !== nextKey
    ) {
      pager = preparePager(swipeDirection, nextKey);
      await waitForAnimationFrames(1);
    }
    if (!pager) {
      applyActiveKey(nextKey, swipeDirection, source);
      return true;
    }

    const finalOffset = swipeDirection > 0 ? -(pager.pageStep || getPageStep(pager.width)) : 0;
    try {
      await settleOffset(finalOffset);
      applyActiveKey(nextKey, swipeDirection, source);
      return true;
    } finally {
      resetSurface();
    }
  };

  const runTransition = async (task) => {
    if (state.switching) return false;
    state.switching = true;
    try {
      return await task();
    } catch (error) {
      console.warn('[swipe-pager] transition failed:', error);
      resetSurface();
      options.onError?.(error);
      return false;
    } finally {
      clearTracking();
      state.switching = false;
    }
  };

  const getAdjacentKey = (direction) => {
    const keys = getKeys();
    if (keys.length <= 1) return '';
    const currentIndex = getKeyIndex(getActiveKey(), keys);
    const nextIndex = currentIndex + (direction < 0 ? -1 : 1);
    return nextIndex >= 0 && nextIndex < keys.length ? keys[nextIndex] : '';
  };

  const dampEdgeOffset = (dx) => clamp(
    Math.round(dx * HORIZONTAL_PAGER_SWIPE_EDGE_DAMPING),
    -HORIZONTAL_PAGER_SWIPE_EDGE_MAX_PX,
    HORIZONTAL_PAGER_SWIPE_EDGE_MAX_PX
  );

  const suppressFollowupClick = () => {
    state.suppressClickUntil = Math.max(state.suppressClickUntil, Date.now() + 550);
  };

  const handlePointerDown = (event) => {
    if (event.isPrimary === false) return;
    if (event.pointerType === 'mouse') return;
    if (!isAvailable() || !isAllowedStartTarget(event.target)) return;
    state.tracking = true;
    state.dragging = false;
    state.pointerId = event.pointerId;
    state.captureTarget = null;
    state.inputKind = 'pointer';
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.dx = 0;
    options.onInteraction?.(event);
  };

  const handlePointerMove = (event) => {
    if (!state.tracking || state.switching || event.pointerId !== state.pointerId) return;
    options.onInteraction?.(event);
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!state.dragging) {
      if (absY > HORIZONTAL_PAGER_SWIPE_START_PX && absY >= absX) {
        clearTracking(event);
        resetSurface();
        return;
      }
      if (absX <= HORIZONTAL_PAGER_SWIPE_START_PX || absX <= absY + 4) return;
      state.dragging = true;
      if (!(state.captureTarget instanceof HTMLElement)) capturePointer(root, event.pointerId);
      options.onDragStart?.(event);
      resetSurface();
    }

    if (!isAvailable()) {
      clearTracking(event);
      resetSurface();
      return;
    }

    state.dx = dx;
    const direction = dx < 0 ? 1 : -1;
    const adjacentKey = getAdjacentKey(direction);
    if (adjacentKey && canAnimate()) {
      const pager = preparePager(direction, adjacentKey);
      if (pager) setOffset(pager.baseOffset + dx, 'dragging');
    } else {
      destroyPager();
      if (canAnimate()) setOffset(adjacentKey ? dx : dampEdgeOffset(dx), 'dragging');
    }
    if (event.cancelable) event.preventDefault();
  };

  const toMouseGestureEvent = (event) => ({
    pointerId: 'mouse',
    pointerType: 'mouse',
    target: event.target,
    currentTarget: event.currentTarget,
    clientX: event.clientX,
    clientY: event.clientY,
    cancelable: event.cancelable,
    preventDefault: () => event.preventDefault(),
    stopPropagation: () => event.stopPropagation(),
    stopImmediatePropagation: () => event.stopImmediatePropagation?.(),
  });

  const handleMouseDown = (event) => {
    if (event.button !== 0) return;
    if (!isAvailable() || !isAllowedStartTarget(event.target)) return;
    state.tracking = true;
    state.dragging = false;
    state.pointerId = 'mouse';
    state.captureTarget = null;
    state.inputKind = 'mouse';
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.dx = 0;
    options.onInteraction?.(event);
  };

  const handleMouseMove = (event) => {
    if (!state.tracking || state.inputKind !== 'mouse') return;
    if ((event.buttons & 1) !== 1) {
      finishPointerGesture(toMouseGestureEvent(event));
      return;
    }
    handlePointerMove(toMouseGestureEvent(event));
  };

  const finishMouseGesture = (event) => {
    if (!state.tracking || state.inputKind !== 'mouse') return;
    finishPointerGesture(toMouseGestureEvent(event));
  };

  const cancelMouseGesture = (event) => {
    if (!state.tracking || state.inputKind !== 'mouse') return;
    cancelPointerGesture(event ? toMouseGestureEvent(event) : { pointerId: 'mouse' });
  };

  const finishPointerGesture = (event) => {
    if (!state.tracking || (event?.pointerId != null && event.pointerId !== state.pointerId)) return;
    const wasDragging = state.dragging;
    const dx = state.dx;
    clearTracking(event);
    if (!wasDragging) {
      resetSurface();
      return;
    }

    suppressFollowupClick();
    if (event?.cancelable) event.preventDefault();
    event?.stopPropagation?.();

    const direction = dx < 0 ? 1 : -1;
    const adjacentKey = getAdjacentKey(direction);
    const shouldSwitch = Boolean(adjacentKey && Math.abs(dx) >= getCommitDistance());
    runTransition(() => (
      shouldSwitch
        ? transitionToKey(adjacentKey, { direction, source: 'swipe' })
        : snapBack()
    ));
  };

  const cancelPointerGesture = (event) => {
    if (!state.tracking || (event?.pointerId != null && event.pointerId !== state.pointerId)) return;
    const wasDragging = state.dragging;
    clearTracking(event);
    if (!wasDragging) {
      resetSurface();
      return;
    }
    suppressFollowupClick();
    runTransition(() => snapBack());
  };

  const suppressClick = (event) => {
    if (Date.now() >= state.suppressClickUntil) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  listenTargets.forEach((target) => {
    target.addEventListener('pointerdown', handlePointerDown, { passive: true });
    target.addEventListener('mousedown', handleMouseDown, { passive: true });
    target.addEventListener('click', suppressClick, true);
  });
  document.addEventListener('pointermove', handlePointerMove, { passive: false });
  document.addEventListener('pointerup', finishPointerGesture, { passive: false });
  document.addEventListener('pointercancel', cancelPointerGesture, { passive: true });
  document.addEventListener('mousemove', handleMouseMove, { passive: false });
  document.addEventListener('mouseup', finishMouseGesture, { passive: false });
  window.addEventListener('blur', cancelMouseGesture, { passive: true });

  return {
    goToKey: (key, { direction = 0, source = 'tab' } = {}) => {
      const keys = getKeys();
      const nextKey = String(key || '');
      if (!keys.includes(nextKey)) return Promise.resolve(false);
      const currentIndex = getKeyIndex(getActiveKey(), keys);
      const nextIndex = getKeyIndex(nextKey, keys);
      const resolvedDirection = direction || (nextIndex >= currentIndex ? 1 : -1);
      return runTransition(() => transitionToKey(nextKey, { direction: resolvedDirection, source }));
    },
    reset: resetSurface,
    destroy: () => {
      listenTargets.forEach((target) => {
        target.removeEventListener('pointerdown', handlePointerDown);
        target.removeEventListener('mousedown', handleMouseDown);
        target.removeEventListener('click', suppressClick, true);
        if (target !== root) target.classList.remove('horizontal-swipe-listen-target');
      });
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', finishPointerGesture);
      document.removeEventListener('pointercancel', cancelPointerGesture);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', finishMouseGesture);
      window.removeEventListener('blur', cancelMouseGesture);
      clearTracking();
      resetSurface();
    },
  };
}

async function animateSearchResultChatSwitch(targetChatId) {
  if (!isMobileLayoutViewport()) return;
  if (!currentChatId || Number(targetChatId) === Number(currentChatId)) return;
  if (prefersReducedMotion()) {
    revealSidebarFromChat({ forceAnimation: true });
    normalizeMobileChatListHistoryState();
    return;
  }
  const transitionMs = Math.max(180, Math.ceil(getElementTransitionTotalMs(sidebar) || 250));
  if (isResolvedMobileChatScene()) {
    revealSidebarFromChat({ forceAnimation: true });
    normalizeMobileChatListHistoryState();
    await waitForMs(transitionMs + 24);
  }
}

function formatSearchResultTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleString([], sameYear
    ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function finalizeSearchPanelClose() {
  if (!searchPanel) return false;
  clearSearchPanelTransitionState();
  searchPanel.classList.remove('is-open', 'is-closing');
  blurFocusedElementWithin(searchPanel);
  searchPanel.setAttribute('aria-hidden', 'true');
  updateSearchTriggerState(false);
  clearTimeout(searchDebounce);
  searchDebounce = null;
  searchRequestSeq += 1;
  searchAllChats = false;
  if (searchInput) searchInput.value = '';
  clearSearchResults();
  renderSearchScopeToggle();
  return true;
}

function openSearchPanel(options = {}) {
  if (!searchPanel) return;
  const focusInput = Object.prototype.hasOwnProperty.call(options, 'focusInput')
    ? Boolean(options.focusInput)
    : shouldAutoFocusSearchInput();
  const suppressFollowupClick = Boolean(options.suppressFollowupClick);
  if (suppressFollowupClick) suppressSearchPanelFollowupClick();
  closeMobileComposerTransientUi({ immediate: true });
  dismissMobileComposer({ forceRecovery: true, reason: 'search-panel' });
  ensureSearchPanelReady();
  if (isSearchPanelOpen() && !searchPanel.classList.contains('is-closing')) {
    if (focusInput) focusSearchInput();
    return;
  }
  clearSearchPanelTransitionState();
  clearTimeout(searchDebounce);
  searchDebounce = null;
  searchRequestSeq += 1;
  searchPanelPendingAction = null;
  searchPanelReturnFocusEl = getMobileComposerSafeReturnFocusEl(chatInfoBtn || searchBtn);
  searchAllChats = false;
  renderSearchScopeToggle();
  if (searchInput) searchInput.value = '';
  renderSearchResultsIdle();
  searchPanel.setAttribute('aria-hidden', 'false');
  searchPanel.classList.remove('is-open', 'is-closing');
  forceIosAnimationMount(searchPanel, searchPanelSheet);
  updateSearchTriggerState(true);
  if (focusInput && isMobileLayoutViewport()) focusSearchInput();
  if (!searchPanelHistoryPushed) {
    history.pushState({ ...(history.state || {}), searchPanel: true }, '');
    searchPanelHistoryPushed = true;
  }
  searchPanelOpenFrame = requestAnimationFrame(() => {
    searchPanel.classList.add('is-open');
    searchPanelOpenFrame = null;
    if (focusInput) {
      requestAnimationFrame(() => {
        if (isSearchPanelOpen()) focusSearchInput();
      });
    }
  });
}

function closeSearchPanel({ fromHistory = false, immediate = false, afterClose = null } = {}) {
  if (!searchPanel) return false;
  if (!isSearchPanelOpen()) {
    if (typeof afterClose === 'function') afterClose();
    return false;
  }
  if (typeof afterClose === 'function') searchPanelPendingAction = afterClose;
  clearTimeout(searchDebounce);
  searchDebounce = null;
  searchRequestSeq += 1;
  clearSearchPanelTransitionState();

  const finish = () => {
    finalizeSearchPanelClose();
    if (fromHistory) searchPanelHistoryPushed = false;
    if (searchPanelHistoryPushed && !fromHistory) {
      searchPanelSkipNextPopstate = true;
      searchPanelHistoryPushed = false;
      history.back();
      return true;
    }
    const shouldRestoreFocus = !searchPanelPendingAction;
    if (shouldRestoreFocus) {
      focusElementIfPossible(searchPanelReturnFocusEl || chatInfoBtn || searchBtn);
    }
    searchPanelReturnFocusEl = null;
    flushSearchPanelPendingAction();
    return true;
  };

  searchPanel.classList.remove('is-open');
  if (immediate || prefersReducedMotion() || currentModalAnimation === 'none') {
    return finish();
  }
  searchPanel.classList.add('is-closing');
  searchPanelTransitionHandler = (event) => {
    if (event.target !== searchPanelSheet || event.propertyName !== 'transform') return;
    finish();
  };
  searchPanelSheet?.addEventListener('transitionend', searchPanelTransitionHandler);
  searchPanelCloseTimer = setTimeout(finish, getSearchPanelTransitionFallbackMs());
  return true;
}

function performSearch({ immediate = false } = {}) {
  const q = searchInput.value.trim();
  clearTimeout(searchDebounce);
  searchDebounce = null;
  const requestId = ++searchRequestSeq;
  if (q.length < 2) {
    renderSearchResultsIdle();
    return;
  }
  const runSearch = async () => {
    try {
      renderSearchResultsLoading();
      const params = new URLSearchParams({ q });
      const isGlobalSearch = searchAllChats || !currentChatId;
      if (!isGlobalSearch && currentChatId) params.set('chatId', currentChatId);
      const results = await api(`/api/messages/search?${params}`);
      if (requestId !== searchRequestSeq || !isSearchPanelOpen()) return;
      clearSearchResults();
      if (results.length === 0) {
        renderSearchResultsEmpty('No results', 'empty');
        return;
      }
      const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const queryPattern = new RegExp(`(${escapedQuery})`, 'gi');
      for (const r of results) {
        const el = document.createElement('div');
        el.className = 'search-result-item';
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        const highlighted = esc(r.text || '').replace(
          queryPattern,
          '<mark>$1</mark>'
        );
        const chatContext = r.chat_name
          ? r.chat_name
          : t(r.chat_type === 'group' ? 'Group chat' : 'Direct chat');
        const displayName = r.display_name || t('Unknown');
        el.innerHTML = `
          <div class="search-result-meta">
            <div class="search-result-name">${esc(displayName)}</div>
            <div class="search-result-chat">${esc(chatContext)}</div>
          </div>
          <div class="search-result-text">${highlighted}</div>
          <div class="search-result-time">${esc(formatSearchResultTimestamp(r.created_at))}</div>
        `;
        const activateResult = () => {
          closeSearchPanel({
            afterClose: () => {
              jumpToSearchResult(r).catch((e) => {
                showCenterToast(localizedSearchText(e?.message || 'Message not found'));
              });
            },
          });
        };
        el.addEventListener('click', activateResult);
        el.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          activateResult();
        });
        searchResults.appendChild(el);
      }
    } catch (e) {
      if (requestId !== searchRequestSeq) return;
      renderSearchResultsEmpty(e?.message || 'Search failed', 'error');
    }
  };
  if (immediate) {
    runSearch();
    return;
  }
  searchDebounce = setTimeout(runSearch, 300);
}

function scrollToMessage(msgId, { behavior = 'smooth', highlight = true, highlightClass = 'is-search-hit' } = {}) {
  const row = messagesEl.querySelector(`[data-msg-id="${msgId}"]`);
  if (!row) return false;
  row.scrollIntoView({ behavior, block: 'center' });
  if (highlight) {
    clearTimeout(row.__searchHitTimer);
    row.classList.add(highlightClass);
    row.__searchHitTimer = setTimeout(() => {
      row.classList.remove(highlightClass);
    }, 1800);
  }
  return true;
}

async function jumpToSearchResult(result) {
  const chatId = Number(result?.chat_id || 0);
  const messageId = Number(result?.id || 0);
  if (!chatId || !messageId) {
    showCenterToast(t('Message not found'));
    return false;
  }
  const sameChat = chatId === Number(currentChatId || 0);
  if (sameChat && scrollToMessage(messageId)) return true;
  await animateSearchResultChatSwitch(chatId);
  await openChat(chatId, {
    anchorMessageId: messageId,
    suppressHistoryPush: sameChat,
    source: 'search',
  });
  if (scrollToMessage(messageId)) return true;
  showCenterToast(t('Message not found'));
  return false;
}

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

function bindEvents(options = {}) {
  if (bindEvents.__bound) return;
  bindEvents.__bound = true;
  const bindTouchSafeButtonActivation = options.bindTouchSafeButtonActivation || actions.bindTouchSafeButtonActivation;
  const closeChatHeaderActions = options.closeChatHeaderActions || actions.closeChatHeaderActions || function noop() {};
  const animateChatHeaderActionButton = options.animateChatHeaderActionButton || actions.animateChatHeaderActionButton || function noop() {};
  if (typeof bindTouchSafeButtonActivation === 'function') {
    bindTouchSafeButtonActivation(searchBtn, ({ isTouchLike } = {}) => {
      closeChatHeaderActions();
      animateChatHeaderActionButton(searchBtn);
      openSearchPanel({ focusInput: true, suppressFollowupClick: isTouchLike });
    });
  } else {
    searchBtn?.addEventListener('click', () => {
      closeChatHeaderActions();
      animateChatHeaderActionButton(searchBtn);
      openSearchPanel({ focusInput: true });
    });
  }
  $('#searchClose')?.addEventListener('click', () => closeSearchPanel());
  searchInput?.addEventListener('input', () => performSearch());
  searchAllChatsToggle?.addEventListener('change', () => {
    if (!currentChatId) {
      searchAllChats = false;
      renderSearchScopeToggle();
      if (searchInput.value.trim().length >= 2) performSearch({ immediate: true });
      return;
    }
    searchAllChats = !!searchAllChatsToggle.checked;
    renderSearchScopeToggle();
    if (searchInput.value.trim().length >= 2) performSearch({ immediate: true });
    else clearSearchResults();
  });
  searchPanel?.addEventListener('click', (event) => {
    if (event.target === searchPanel) closeSearchPanel();
  });
}
function handlePopStateSkip() {
  if (!searchPanelSkipNextPopstate) return false;
  searchPanelSkipNextPopstate = false;
  const shouldRestoreFocus = !searchPanelPendingAction;
  if (shouldRestoreFocus) focusElementIfPossible(searchPanelReturnFocusEl || chatInfoBtn || searchBtn);
  searchPanelReturnFocusEl = null;
  flushSearchPanelPendingAction();
  return true;
}
function resetPopStateSkip() { searchPanelSkipNextPopstate = false; }
function isFollowupClickSuppressed() { return Date.now() < searchPanelFollowupClickSuppressUntil; }
function hasPopStateSkipPending() { return Boolean(searchPanelSkipNextPopstate); }
__exports = { isSearchPanelOpen, clearSearchResults, updateSearchTriggerState, renderSearchResultsEmpty, renderSearchScopeToggle, clearSearchPanelTransitionState, ensureSearchPanelReady, getSearchPanelTransitionFallbackMs, focusSearchInput, flushSearchPanelPendingAction, queueSearchPanelPendingAction, shouldAutoFocusSearchInput, horizontalPagerCommitDistance, canAnimateHorizontalPager, stripCloneIds, syncClonedFormControls, createHorizontalSwipePager, cancelScheduledScrollableItemCenter, centerScrollableItem, scheduleScrollableItemCenter, openSearchPanel, closeSearchPanel, performSearch, scrollToMessage, jumpToSearchResult, animateSearchResultChatSwitch, formatSearchResultTimestamp, bindEvents, handlePopStateSkip, resetPopStateSkip, isFollowupClickSuppressed, suppressSearchPanelFollowupClick, hasPopStateSkipPending };
  }
  return scope.__exports;
}
interactionsRoot.search = { createSearchController };
})();
