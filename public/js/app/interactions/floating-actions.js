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

function createFloatingMessageActions(options = {}) {
  const opts = objectOrDefault(options);
  const win = opts.window || window;
  const doc = opts.document || document;
  const dom = objectOrDefault(opts.dom);
  const state = objectOrDefault(opts.state);
  const actions = objectOrDefault(opts.actions);
  const config = objectOrDefault(opts.config || root.config);
  const getReactions = () => objectOrDefault(typeof opts.getReactions === 'function' ? opts.getReactions() : opts.reactions);
  const deps = { window: win, document: doc, Element: win.Element, HTMLElement: win.HTMLElement, reactionPicker: dom.reactionPicker, reactionEmojiPopover: dom.reactionEmojiPopover, messagesEl: dom.messagesEl, currentModalAnimation: getter(() => state.getCurrentModalAnimation?.() || 'soft'), MODAL_TRANSITION_BUFFER_MS: config.MODAL_TRANSITION_BUFFER_MS ?? 80, reactionPickerMsgId: getter(() => getReactions().getReactionPickerMsgId?.() || null), reactionPickerKeepKeyboard: getter(() => Boolean(getReactions().getReactionPickerKeepKeyboard?.())), renderReactionPickerContent: (...args) => getReactions().renderReactionPickerContent?.(...args), hideReactionUi: (...args) => getReactions().hideReactionUi?.(...args), showReactionPicker: (...args) => getReactions().showReactionPicker?.(...args), forceIosAnimationMount: actions.forceIosAnimationMount || function noop() {}, getElementTransitionTotalMs: actions.getElementTransitionTotalMs || (() => 0), prefersReducedMotion: actions.prefersReducedMotion || (() => false), isMobileComposerKeyboardOpen: actions.isMobileComposerKeyboardOpen || (() => false), focusComposerKeepKeyboard: actions.focusComposerKeepKeyboard || function noop() {} };
  const scope = createLegacyScope(deps, win);
  with (scope) {
const FLOATING_ACTION_MARGIN = 8;
const FLOATING_ACTION_GAP = 8;
let activeMessageActionsRow = null;
let activeMessageActionsEl = null;
let floatingMessageActionsState = null;
let suppressNextMessageActionTapUntil = 0;
function isFloatingSurfaceVisible(el) {
  return Boolean(el && !el.classList.contains('hidden'));
}

function getFloatingViewportRect() {
  const vv = window.visualViewport;
  const left = vv ? vv.offsetLeft : 0;
  const top = vv ? vv.offsetTop : 0;
  const width = vv ? vv.width : window.innerWidth;
  const height = vv ? vv.height : window.innerHeight;
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (max < min) return min;
  return Math.max(min, Math.min(value, max));
}

function findMessageRowById(msgId) {
  const key = String(msgId || '');
  if (!key) return null;
  return Array.from(messagesEl.querySelectorAll('.msg-row[data-msg-id]'))
    .find((row) => String(row.dataset.msgId || '') === key) || null;
}

function getFloatingMessageActionRow() {
  const key = reactionPickerMsgId || floatingMessageActionsState?.msgId || activeMessageActionsRow?.dataset?.msgId || '';
  if (!key) return null;
  const row = findMessageRowById(key);
  if (row && floatingMessageActionsState) floatingMessageActionsState.row = row;
  return row;
}

function updateFloatingMessageActionsState(row, options = {}) {
  const msgId = Number(row?.dataset.msgId || 0);
  if (!msgId || !row) return null;
  const next = floatingMessageActionsState?.msgId === msgId
    ? { ...floatingMessageActionsState }
    : { msgId, row, pointerX: null, pointerY: null, placement: 'above' };
  next.msgId = msgId;
  next.row = row;
  if (Number.isFinite(options.x)) next.pointerX = Number(options.x);
  if (Number.isFinite(options.y)) next.pointerY = Number(options.y);
  floatingMessageActionsState = next;
  return next;
}

function clearFloatingMessageActionsStateIfClosed() {
  if (activeMessageActionsRow || isFloatingSurfaceVisible(reactionPicker) || isFloatingSurfaceVisible(reactionEmojiPopover)) return;
  floatingMessageActionsState = null;
}

function suppressNextMessageActionTap(ms = 650) {
  suppressNextMessageActionTapUntil = Math.max(suppressNextMessageActionTapUntil, Date.now() + ms);
}

function measureFloatingSurface(el, fallbackWidth, fallbackHeight) {
  if (!(el instanceof HTMLElement)) return { width: fallbackWidth, height: fallbackHeight };
  const wasHidden = el.classList.contains('hidden');
  const wasOpen = el.classList.contains('is-open');
  const wasClosing = el.classList.contains('is-closing');
  const prevVisibility = el.style.visibility;
  const prevPointerEvents = el.style.pointerEvents;
  const prevLeft = el.style.left;
  const prevTop = el.style.top;

  if (wasHidden) el.classList.remove('hidden');
  el.classList.remove('is-open', 'is-closing');
  el.style.visibility = 'hidden';
  el.style.pointerEvents = 'none';
  el.style.left = '-9999px';
  el.style.top = '-9999px';

  const width = el.offsetWidth || fallbackWidth;
  const height = el.offsetHeight || fallbackHeight;

  el.style.visibility = prevVisibility;
  el.style.pointerEvents = prevPointerEvents;
  el.style.left = prevLeft;
  el.style.top = prevTop;
  if (wasHidden) el.classList.add('hidden');
  if (wasOpen) el.classList.add('is-open');
  if (wasClosing) el.classList.add('is-closing');

  return { width, height };
}

function openFloatingSurface(el) {
  if (!(el instanceof HTMLElement)) return;
  clearTimeout(el.__closeTimer);
  el.__closeTimer = null;
  if (el.__openFrame) cancelAnimationFrame(el.__openFrame);
  el.classList.remove('hidden', 'is-closing');
  forceIosAnimationMount(el, el.querySelector('.chat-context-menu-sheet'));
  if (prefersReducedMotion() || currentModalAnimation === 'none') {
    el.classList.add('is-open');
    return;
  }
  if (el.classList.contains('is-open')) return;
  el.__openFrame = requestAnimationFrame(() => {
    el.__openFrame = requestAnimationFrame(() => {
      el.classList.add('is-open');
      el.__openFrame = null;
    });
  });
}

function closeFloatingSurface(el, { immediate = false, onAfterClose = null } = {}) {
  if (!(el instanceof HTMLElement)) {
    onAfterClose?.();
    return false;
  }
  clearTimeout(el.__closeTimer);
  el.__closeTimer = null;
  if (el.__openFrame) {
    cancelAnimationFrame(el.__openFrame);
    el.__openFrame = null;
  }

  const finalize = () => {
    clearTimeout(el.__closeTimer);
    el.__closeTimer = null;
    el.classList.add('hidden');
    el.classList.remove('is-open', 'is-closing');
    onAfterClose?.();
  };

  if (el.classList.contains('hidden')) {
    finalize();
    return false;
  }

  if (immediate || prefersReducedMotion() || currentModalAnimation === 'none') {
    finalize();
    return true;
  }

  el.classList.remove('is-open');
  el.classList.add('is-closing');
  const onTransitionEnd = (event) => {
    if (event.target !== el || event.propertyName !== 'opacity') return;
    el.removeEventListener('transitionend', onTransitionEnd);
    finalize();
  };
  el.addEventListener('transitionend', onTransitionEnd);
  const closeFallbackMs = Math.max(MODAL_TRANSITION_BUFFER_MS, Math.ceil(getElementTransitionTotalMs(el) + MODAL_TRANSITION_BUFFER_MS));
  el.__closeTimer = setTimeout(() => {
    el.removeEventListener('transitionend', onTransitionEnd);
    finalize();
  }, closeFallbackMs);
  return true;
}


function getVisibleMessageAreaRect() {
  const viewport = getFloatingViewportRect();
  const messagesRect = messagesEl?.getBoundingClientRect?.();
  if (!messagesRect) return viewport;
  const left = Math.max(viewport.left, messagesRect.left);
  const top = Math.max(viewport.top, messagesRect.top);
  const right = Math.min(viewport.right, messagesRect.right);
  const bottom = Math.min(viewport.bottom, messagesRect.bottom);
  if (right <= left || bottom <= top) return viewport;
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function measureMessageActions(row) {
  const actions = getMessageActionsElement(row);
  if (!(actions instanceof HTMLElement)) return { width: 178, height: 36 };
  return {
    width: actions.offsetWidth || 178,
    height: actions.offsetHeight || 36,
  };
}

function getMessageActionsElement(row) {
  if (
    activeMessageActionsEl instanceof HTMLElement
    && activeMessageActionsRow
    && String(activeMessageActionsRow.dataset.msgId || '') === String(row?.dataset?.msgId || '')
  ) {
    return activeMessageActionsEl;
  }
  return row?.querySelector('.msg-actions') || null;
}

function portalMessageActions(row) {
  const actions = getMessageActionsElement(row);
  if (!(actions instanceof HTMLElement)) return null;
  if (!actions.__floatingActionsBound) {
    actions.addEventListener('click', (e) => {
      if (!actions.classList.contains('actions-floating-open')) return;
      const reactBtn = e.target.closest('.msg-react-btn');
      if (!reactBtn) return;
      e.preventDefault();
      e.stopPropagation();
      const keepComposerFocus = reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen();
      showReactionPicker(activeMessageActionsRow, reactBtn, { source: 'actions', keepComposerFocus });
    });
    actions.__floatingActionsBound = true;
  }
  if (!actions.__messageActionsHome) {
    actions.__messageActionsHome = {
      parent: actions.parentNode,
      nextSibling: actions.nextSibling,
    };
  }
  actions.style.setProperty('--msg-actions-bg', row.classList.contains('own') ? 'var(--bg-own-msg)' : 'var(--bg-other-msg)');
  if (actions.parentNode !== document.body) document.body.appendChild(actions);
  activeMessageActionsEl = actions;
  return actions;
}

function restoreMessageActions(actions) {
  if (!(actions instanceof HTMLElement)) return;
  const home = actions.__messageActionsHome;
  if (home?.parent?.isConnected) {
    if (home.nextSibling?.parentNode === home.parent) home.parent.insertBefore(actions, home.nextSibling);
    else home.parent.appendChild(actions);
  }
  delete actions.__messageActionsHome;
}

function clearMessageActionsPlacement(row) {
  const actions = getMessageActionsElement(row);
  row?.classList.remove('actions-open', 'actions-placement-above', 'actions-placement-below');
  if (!(actions instanceof HTMLElement)) {
    if (activeMessageActionsRow === row) activeMessageActionsEl = null;
    return;
  }
  actions.classList.remove('actions-floating-open', 'actions-placement-above', 'actions-placement-below');
  actions.style.removeProperty('left');
  actions.style.removeProperty('right');
  actions.style.removeProperty('top');
  actions.style.removeProperty('bottom');
  actions.style.removeProperty('--msg-actions-bg');
  restoreMessageActions(actions);
  if (activeMessageActionsEl === actions) activeMessageActionsEl = null;
}

function resolveMessageActionLayout(row, { includeActions = false, includePicker = false, reserveActionsForPicker = includePicker } = {}) {
  const rowRect = row?.getBoundingClientRect?.();
  if (!rowRect) return null;
  const bubbleRect = row.querySelector('.msg-bubble')?.getBoundingClientRect() || rowRect;
  const visibleArea = getVisibleMessageAreaRect();
  const hasActionSlot = includeActions || reserveActionsForPicker;
  const actionSize = hasActionSlot
    ? measureMessageActions(row)
    : { width: 0, height: 0 };
  const pickerSize = includePicker
    ? measureFloatingSurface(reactionPicker, 430, 56)
    : { width: 0, height: 0 };
  const actionSlotHeight = hasActionSlot ? actionSize.height : pickerSize.height;
  const actionSlotWidth = Math.max(1, hasActionSlot ? actionSize.width : pickerSize.width);
  const topVisible = rowRect.top >= visibleArea.top + FLOATING_ACTION_MARGIN;
  const bottomVisible = rowRect.bottom <= visibleArea.bottom - FLOATING_ACTION_MARGIN;
  const spaceAbove = rowRect.top - visibleArea.top - FLOATING_ACTION_MARGIN - FLOATING_ACTION_GAP;
  const spaceBelow = visibleArea.bottom - rowRect.bottom - FLOATING_ACTION_MARGIN - FLOATING_ACTION_GAP;
  let placement = 'above';
  if (!topVisible) placement = 'below';
  else if (!bottomVisible || spaceBelow < actionSlotHeight) placement = 'above';
  else if (spaceAbove < actionSlotHeight) placement = 'below';

  const preferredActionsLeft = row.classList.contains('own') ? bubbleRect.right - actionSlotWidth : bubbleRect.left;
  const virtualActionsLeft = clamp(
    preferredActionsLeft,
    visibleArea.left + FLOATING_ACTION_MARGIN,
    visibleArea.right - actionSlotWidth - FLOATING_ACTION_MARGIN
  );
  let virtualActionsTop = placement === 'above'
    ? rowRect.top - FLOATING_ACTION_GAP - actionSlotHeight
    : rowRect.bottom + FLOATING_ACTION_GAP;
  virtualActionsTop = clamp(
    virtualActionsTop,
    visibleArea.top + FLOATING_ACTION_MARGIN,
    visibleArea.bottom - actionSlotHeight - FLOATING_ACTION_MARGIN
  );

  let pickerLeft = null;
  let pickerTop = null;
  if (includePicker) {
    const preferredPickerLeft = row.classList.contains('own')
      ? virtualActionsLeft + actionSlotWidth - pickerSize.width
      : virtualActionsLeft;
    pickerLeft = clamp(
      preferredPickerLeft,
      visibleArea.left + FLOATING_ACTION_MARGIN,
      visibleArea.right - pickerSize.width - FLOATING_ACTION_MARGIN
    );
    pickerTop = placement === 'above'
      ? virtualActionsTop - FLOATING_ACTION_GAP - pickerSize.height
      : virtualActionsTop + actionSlotHeight + FLOATING_ACTION_GAP;
    pickerTop = clamp(
      pickerTop,
      visibleArea.top + FLOATING_ACTION_MARGIN,
      visibleArea.bottom - pickerSize.height - FLOATING_ACTION_MARGIN
    );
  }

  return {
    placement,
    pickerLeft,
    pickerTop,
    actionsLeft: includeActions ? virtualActionsLeft : null,
    actionsTop: includeActions ? virtualActionsTop : null,
  };
}

function positionFloatingElement(el, left, top) {
  if (!(el instanceof HTMLElement)) return;
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

function applyMessageActionsLayout(row, layout) {
  const actions = portalMessageActions(row);
  if (!(actions instanceof HTMLElement) || !layout) return false;
  row.classList.add('actions-open');
  row.classList.toggle('actions-placement-above', layout.placement === 'above');
  row.classList.toggle('actions-placement-below', layout.placement === 'below');
  actions.classList.add('actions-floating-open');
  actions.classList.toggle('actions-placement-above', layout.placement === 'above');
  actions.classList.toggle('actions-placement-below', layout.placement === 'below');
  actions.style.left = `${Math.round(layout.actionsLeft)}px`;
  actions.style.top = `${Math.round(layout.actionsTop)}px`;
  actions.style.right = 'auto';
  actions.style.bottom = 'auto';
  return true;
}

function positionReactionEmojiPopover() {
  if (!reactionEmojiPopover || reactionEmojiPopover.classList.contains('hidden')) return;
  const anchorRect = reactionPicker?.querySelector('[data-reaction-action="open-emoji-popover"]')?.getBoundingClientRect()
    || reactionPicker?.getBoundingClientRect();
  if (!anchorRect) return;
  const viewport = getVisibleMessageAreaRect();
  const size = measureFloatingSurface(reactionEmojiPopover, 254, 338);
  let left = anchorRect.left + (anchorRect.width - size.width) / 2;
  left = clamp(left, viewport.left + FLOATING_ACTION_MARGIN, viewport.right - size.width - FLOATING_ACTION_MARGIN);
  let top = anchorRect.top - size.height - FLOATING_ACTION_GAP;
  if (top < viewport.top + FLOATING_ACTION_MARGIN) top = anchorRect.bottom + FLOATING_ACTION_GAP;
  top = clamp(top, viewport.top + FLOATING_ACTION_MARGIN, viewport.bottom - size.height - FLOATING_ACTION_MARGIN);
  positionFloatingElement(reactionEmojiPopover, left, top);
}

function positionMessageActionSurfaces({ includeActions = Boolean(activeMessageActionsRow), includePicker = isFloatingSurfaceVisible(reactionPicker) } = {}) {
  if (!includeActions && !includePicker && !isFloatingSurfaceVisible(reactionEmojiPopover)) return null;
  const row = getFloatingMessageActionRow();
  if (!row) {
    hideFloatingMessageActions({ immediate: true });
    return null;
  }
  includeActions = Boolean(includeActions && activeMessageActionsRow && String(activeMessageActionsRow.dataset.msgId || '') === String(row.dataset.msgId || ''));
  if (includeActions) activeMessageActionsRow = row;
  if (includePicker) renderReactionPickerContent();
  const layout = resolveMessageActionLayout(row, { includeActions, includePicker, reserveActionsForPicker: includePicker });
  if (!layout) {
    hideFloatingMessageActions({ immediate: true });
    return null;
  }
  if (includePicker && Number.isFinite(layout.pickerTop)) positionFloatingElement(reactionPicker, layout.pickerLeft, layout.pickerTop);
  if (includeActions && Number.isFinite(layout.actionsTop) && !applyMessageActionsLayout(row, layout)) hideActiveMessageActions();
  if (floatingMessageActionsState) floatingMessageActionsState.placement = layout.placement;
  if (!reactionEmojiPopover.classList.contains('hidden')) positionReactionEmojiPopover();
  return layout;
}


function hideActiveMessageActions() {
  if (activeMessageActionsRow) clearMessageActionsPlacement(activeMessageActionsRow);
  messagesEl?.querySelectorAll('.msg-row.actions-open').forEach((row) => {
    if (row !== activeMessageActionsRow) clearMessageActionsPlacement(row);
  });
  activeMessageActionsRow = null;
  clearFloatingMessageActionsStateIfClosed();
}

function hideFloatingMessageActions(options = {}) {
  hideReactionUi({ keepComposerState: options.keepComposerState, immediate: options.immediate });
  hideActiveMessageActions();
}

function showMessageActions(row, { toggle = false, preserveReactionUi = false, keepComposerFocus = false } = {}) {
  if (!row || row.dataset.outbox === '1') return false;
  row.classList.remove('actions-hover-suppressed');
  const msg = row.__messageData || {};
  if (msg.is_deleted || !getMessageActionsElement(row)) return false;
  const shouldKeepComposerFocus = Boolean(keepComposerFocus);
  const sameRow = activeMessageActionsRow
    && String(activeMessageActionsRow.dataset.msgId || '') === String(row.dataset.msgId || '');
  if (sameRow && toggle) {
    const closingRow = activeMessageActionsRow;
    hideFloatingMessageActions({ keepComposerState: reactionPickerKeepKeyboard || shouldKeepComposerFocus });
    if (shouldKeepComposerFocus) focusComposerKeepKeyboard(true);
    closingRow?.classList.add('actions-hover-suppressed');
    closingRow?.addEventListener('pointerleave', () => {
      closingRow.classList.remove('actions-hover-suppressed');
    }, { once: true });
    return true;
  }
  if (!preserveReactionUi) hideReactionUi({ immediate: true, keepComposerState: reactionPickerKeepKeyboard || shouldKeepComposerFocus });
  hideActiveMessageActions();
  activeMessageActionsRow = row;
  updateFloatingMessageActionsState(row);
  positionMessageActionSurfaces({ includeActions: true, includePicker: isFloatingSurfaceVisible(reactionPicker) });
  if (shouldKeepComposerFocus) focusComposerKeepKeyboard(true);
  return true;
}


function getActiveMessageActionsRow() { return activeMessageActionsRow; }
function getActiveMessageActionsEl() { return activeMessageActionsEl; }
function getFloatingMessageActionsState() { return floatingMessageActionsState; }
function getSuppressNextMessageActionTapUntil() { return suppressNextMessageActionTapUntil; }
function isMessageActionTapSuppressed() { return Date.now() < suppressNextMessageActionTapUntil; }
__exports = { isFloatingSurfaceVisible, getFloatingViewportRect, clamp, findMessageRowById, getFloatingMessageActionRow, updateFloatingMessageActionsState, clearFloatingMessageActionsStateIfClosed, suppressNextMessageActionTap, measureFloatingSurface, openFloatingSurface, closeFloatingSurface, getVisibleMessageAreaRect, measureMessageActions, getMessageActionsElement, portalMessageActions, restoreMessageActions, clearMessageActionsPlacement, resolveMessageActionLayout, positionFloatingElement, applyMessageActionsLayout, positionReactionEmojiPopover, positionMessageActionSurfaces, hideActiveMessageActions, hideFloatingMessageActions, showMessageActions, getActiveMessageActionsRow, getActiveMessageActionsEl, getFloatingMessageActionsState, getSuppressNextMessageActionTapUntil, isMessageActionTapSuppressed };
  }
  return scope.__exports;
}
interactionsRoot.floatingActions = { createFloatingMessageActions };
})();
