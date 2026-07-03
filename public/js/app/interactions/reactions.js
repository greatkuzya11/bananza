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

function createReactionController(options = {}) {
  const opts = objectOrDefault(options);
  const win = opts.window || window;
  const doc = opts.document || document;
  const dom = objectOrDefault(opts.dom);
  const state = objectOrDefault(opts.state);
  const actions = objectOrDefault(opts.actions);
  const getFloating = () => objectOrDefault(typeof opts.getFloatingActions === 'function' ? opts.getFloatingActions() : opts.floatingActions);
  const deps = {
    window: win, document: doc, Element: win.Element, HTMLElement: win.HTMLElement, messagesEl: dom.messagesEl, reactionPicker: dom.reactionPicker, reactionEmojiPopover: dom.reactionEmojiPopover,
    currentUser: getter(() => state.getCurrentUser?.() || {}), currentChatId: getter(() => state.getCurrentChatId?.() || null), contextConvertPendingMessageIds: state.contextConvertPendingMessageIds || new Set(), contextOriginalRestorePendingMessageIds: state.contextOriginalRestorePendingMessageIds || new Set(),
    api: opts.api || actions.api || (() => Promise.resolve({})), esc: opts.esc || ((value) => String(value == null ? '' : value)), t: opts.t || ((key) => String(key || '')),
    getEmojiPickerCategories: actions.getEmojiPickerCategories || (() => []), isCustomEmojiCategory: actions.isCustomEmojiCategory || (() => false), getEmojiCategoryItems: actions.getEmojiCategoryItems || (() => []), getRecentEmojiCategory: actions.getRecentEmojiCategory || (() => ''), isCustomEmojiToken: actions.isCustomEmojiToken || (() => false), createHorizontalSwipePager: actions.createHorizontalSwipePager || (() => null), scheduleScrollableItemCenter: actions.scheduleScrollableItemCenter || (() => false), rememberRecentEmoji: actions.rememberRecentEmoji || function noop() {},
    canContextConvertMessage: actions.canContextConvertMessage || (() => false), canRestoreContextOriginalMessage: actions.canRestoreContextOriginalMessage || (() => false), openMessageContextConvertPicker: actions.openMessageContextConvertPicker || (() => Promise.resolve(false)), restoreContextOriginalMessage: actions.restoreContextOriginalMessage || (() => Promise.resolve(false)), bindTouchSafeButtonActivation: actions.bindTouchSafeButtonActivation || function noop() {}, isMobileComposerKeyboardOpen: actions.isMobileComposerKeyboardOpen || (() => false), preventMobileComposerBlur: actions.preventMobileComposerBlur || (() => false), focusComposerKeepKeyboard: actions.focusComposerKeepKeyboard || function noop() {}, safeVibrate: actions.safeVibrate || function noop() {}, getSelectedMessageFragment: actions.getSelectedMessageFragment || (() => ''), isSelectableMessageTextTarget: actions.isSelectableMessageTextTarget || (() => false), getMessageMediaContextTarget: actions.getMessageMediaContextTarget || (() => null),
    isFloatingSurfaceVisible: (...args) => getFloating().isFloatingSurfaceVisible?.(...args), openFloatingSurface: (...args) => getFloating().openFloatingSurface?.(...args), closeFloatingSurface: (...args) => getFloating().closeFloatingSurface?.(...args), updateFloatingMessageActionsState: (...args) => getFloating().updateFloatingMessageActionsState?.(...args), clearFloatingMessageActionsStateIfClosed: (...args) => getFloating().clearFloatingMessageActionsStateIfClosed?.(...args), hideActiveMessageActions: (...args) => getFloating().hideActiveMessageActions?.(...args), hideFloatingMessageActions: (...args) => getFloating().hideFloatingMessageActions?.(...args), showMessageActions: (...args) => getFloating().showMessageActions?.(...args), positionMessageActionSurfaces: (...args) => getFloating().positionMessageActionSurfaces?.(...args), positionReactionEmojiPopover: (...args) => getFloating().positionReactionEmojiPopover?.(...args), suppressNextMessageActionTap: (...args) => getFloating().suppressNextMessageActionTap?.(...args), isMessageActionTapSuppressed: () => Boolean(getFloating().isMessageActionTapSuppressed?.()), activeMessageActionsRow: getter(() => getFloating().getActiveMessageActionsRow?.() || null), activeMessageActionsEl: getter(() => getFloating().getActiveMessageActionsEl?.() || null), floatingMessageActionsState: getter(() => getFloating().getFloatingMessageActionsState?.() || null),
  };
  const scope = createLegacyScope(deps, win);
  with (scope) {
const QUICK_REACTIONS = Object.freeze(['\uD83D\uDC4D', '\uD83D\uDC4E', '\u2764\uFE0F', '\uD83D\uDD25', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDCA9', '\uD83C\uDF89', '\uD83E\uDD21']);
const REACTION_PICKER_IDLE_MS = 5000;
let reactionEmojiSwipePager = null;
let reactionPickerMsgId = null;
let reactionPickerKeepKeyboard = false;
let reactionPickerIdleTimer = null;
let reactionUiGeneration = 0;
let reactionEmojiPopoverCategory = getEmojiPickerCategories()[0] || '';
let reactionMorePointerHandledUntil = 0;
const MESSAGE_INTERACTIVE_TARGET_SELECTOR = '.msg-actions, button, a, input, textarea, select, label, audio, video, .video-note-stage, .msg-reply, .reaction-badge, .msg-image, .msg-video, .msg-file, .link-preview, .msg-group-avatar';
function isLocationCardGestureTarget(target) {
  return Boolean(
    target?.closest?.('[data-location-card]')
    && !target.closest('[data-location-card] a, [data-location-card] .leaflet-control, [data-location-card] .leaflet-interactive, [data-location-card] input, [data-location-card] textarea, [data-location-card] select, [data-location-card] label')
  );
}
function isMessageInteractiveTarget(target) {
  if (!target?.closest) return false;
  if (isLocationCardGestureTarget(target)) return false;
  return Boolean(target.closest(MESSAGE_INTERACTIVE_TARGET_SELECTOR));
}
function suppressLocationCardClick(row, ms = 900) {
  if (!row?.querySelector?.('[data-location-card]')) return;
  row.__suppressLocationClickUntil = Date.now() + ms;
}
function renderReactions(reactions) {
  if (!reactions || reactions.length === 0) return '';
  const grouped = {};
  for (const r of reactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
    grouped[r.emoji].count++;
    if (+r.user_id === currentUser.id) grouped[r.emoji].mine = true;
  }
  return Object.entries(grouped).map(([emoji, { count, mine }]) =>
    `<button class="reaction-badge${mine ? ' mine' : ''}" data-emoji="${emoji}">${emoji}<span>${count}</span></button>`
  ).join('');
}

function updateReactionBar(msgId, reactions) {
  const row = messagesEl.querySelector(`[data-msg-id="${msgId}"]`);
  const rowChatId = Number(row?.__messageData?.chat_id || row?.__messageData?.chatId || currentChatId || 0);
  if (rowChatId && window.messageCache?.patchMessage) {
    window.messageCache.patchMessage(rowChatId, msgId, { reactions: Array.isArray(reactions) ? reactions : [] }).catch(() => {});
  }
  if (!row) return;
  if (row.__messageData) row.__messageData = { ...row.__messageData, reactions: Array.isArray(reactions) ? reactions : [] };
  const footer = row.querySelector('.msg-footer');
  if (!footer) return;
  let bar = footer.querySelector('.msg-reactions');
  if (reactions.length === 0) {
    if (bar) { bar.outerHTML = '<div></div>'; }
  } else {
    if (!bar) {
      const placeholder = footer.querySelector('div');
      if (placeholder) placeholder.outerHTML = `<div class="msg-reactions">${renderReactions(reactions)}</div>`;
    } else {
      bar.innerHTML = renderReactions(reactions);
    }
  }
}


function renderQuickReactionButtonsHtml({ buttonClass = '', moreAction = 'open-emoji-popover', messageId = 0 } = {}) {
  const messageAttr = Number(messageId || 0) > 0 ? ` data-message-id="${Number(messageId)}"` : '';
  const buttons = QUICK_REACTIONS.map((emoji) =>
    `<button type="button" class="${buttonClass}" data-reaction-action="toggle"${messageAttr} data-emoji="${esc(emoji)}" title="${esc(`React ${emoji}`)}">${esc(emoji)}</button>`
  );
  buttons.push(
    `<button type="button" class="${buttonClass} reaction-more-button" data-reaction-action="${esc(moreAction)}"${messageAttr} title="More reactions">\u22EF</button>`
  );
  return buttons.join('');
}

function renderReactionPickerContent() {
  if (!reactionPicker) return;
  const row = reactionPickerMsgId ? messagesEl.querySelector(`[data-msg-id="${reactionPickerMsgId}"]`) : null;
  const canConvert = canContextConvertMessage(row?.__messageData, row);
  const canRestoreOriginal = canRestoreContextOriginalMessage(row?.__messageData);
  reactionPicker.innerHTML = `
    <div class="reaction-picker-strip">
      ${renderQuickReactionButtonsHtml({ buttonClass: 'reaction-picker-button', moreAction: 'open-emoji-popover', messageId: reactionPickerMsgId })}
      ${canConvert ? `<button type="button" class="reaction-picker-button msg-context-convert-btn${contextConvertPendingMessageIds.has(Number(reactionPickerMsgId || 0)) ? ' is-pending' : ''}" data-reaction-action="context-convert" data-message-id="${Number(reactionPickerMsgId || 0)}" title="Transform with AI">\uD83C\uDF4C</button>` : ''}
      ${canRestoreOriginal ? `<button type="button" class="reaction-picker-button msg-restore-original-btn${contextOriginalRestorePendingMessageIds.has(Number(reactionPickerMsgId || 0)) ? ' is-pending' : ''}" data-reaction-action="restore-original" data-message-id="${Number(reactionPickerMsgId || 0)}" title="${esc(t('Restore original'))}" aria-label="${esc(t('Restore original'))}"${contextOriginalRestorePendingMessageIds.has(Number(reactionPickerMsgId || 0)) ? ' disabled' : ''}>&#8634;</button>` : ''}
    </div>
  `;
  reactionPicker.querySelector('.reaction-picker-strip')?.addEventListener('scroll', () => {
    bumpReactionPickerIdleTimer();
  }, { passive: true });
  const moreBtn = reactionPicker.querySelector('.reaction-more-button');
  bindTouchSafeButtonActivation(moreBtn, ({ event, startKeyboardOpen }) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const keepComposerFocus = Boolean(reactionPickerKeepKeyboard || startKeyboardOpen || isMobileComposerKeyboardOpen());
    handleReactionMoreButton(moreBtn, { keepComposerFocus });
  });
}

function getAdditionalReactionCategories() {
  const quickSet = new Set(QUICK_REACTIONS);
  return getEmojiPickerCategories()
    .filter((key) => !isCustomEmojiCategory(key))
    .map((key) => ({
      key,
      emojis: getEmojiCategoryItems(key).filter((emoji) => !quickSet.has(emoji) && !isCustomEmojiToken(emoji)),
    }))
    .filter((category) => category.key === getRecentEmojiCategory() || category.emojis.length > 0);
}

function getReactionEmojiCategoryKey(value) {
  const categories = getAdditionalReactionCategories();
  if (!categories.length) return '';
  return categories.some((category) => category.key === value) ? value : categories[0].key;
}

function getReactionEmojiCategoryKeys() {
  return getAdditionalReactionCategories().map((category) => category.key);
}

function renderReactionEmojiGridHtml(categoryKey) {
  const categories = getAdditionalReactionCategories();
  const activeCategory = categories.find((category) => category.key === categoryKey) || categories[0];
  const categoryEmojis = activeCategory?.emojis || [];
  return categoryEmojis.map((emoji) => `
    <button type="button" class="reaction-emoji-item" data-emoji="${esc(emoji)}" title="${esc(`React ${emoji}`)}">${esc(emoji)}</button>
  `).join('');
}

function getReactionEmojiLiveGrid() {
  return reactionEmojiPopover?.querySelector?.('.reaction-emoji-grid-swipe > .reaction-emoji-grid.horizontal-swipe-live')
    || reactionEmojiPopover?.querySelector?.('.reaction-emoji-grid');
}

function createReactionEmojiGridElement(categoryKey) {
  const grid = document.createElement('div');
  grid.className = 'reaction-emoji-grid';
  grid.innerHTML = renderReactionEmojiGridHtml(categoryKey);
  return grid;
}

function centerReactionEmojiActiveCategory({ behavior = 'auto' } = {}) {
  const tabs = reactionEmojiPopover?.querySelector?.('.reaction-emoji-tabs');
  return scheduleScrollableItemCenter(tabs, '.reaction-emoji-tab.active', { behavior });
}

function setReactionEmojiPopoverCategory(categoryKey, { reposition = true, centerBehavior = 'auto' } = {}) {
  const nextCategoryKey = getReactionEmojiCategoryKey(categoryKey);
  if (!nextCategoryKey) return '';
  reactionEmojiPopoverCategory = nextCategoryKey;
  reactionEmojiPopover?.querySelectorAll?.('.reaction-emoji-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.category === nextCategoryKey);
  });
  const grid = getReactionEmojiLiveGrid();
  if (grid) grid.innerHTML = renderReactionEmojiGridHtml(nextCategoryKey);
  bindReactionEmojiPopoverControls();
  centerReactionEmojiActiveCategory({ behavior: centerBehavior });
  if (reposition) positionReactionEmojiPopover();
  return nextCategoryKey;
}

function renderReactionEmojiPopoverContent() {
  if (!reactionEmojiPopover) return;
  const categories = getAdditionalReactionCategories();
  const categoryKey = getReactionEmojiCategoryKey(reactionEmojiPopoverCategory);
  reactionEmojiPopoverCategory = categoryKey;
  reactionEmojiSwipePager?.destroy();
  reactionEmojiPopover.innerHTML = `
    <div class="reaction-emoji-tabs">
      ${categories.map((category) => `
        <button type="button" class="reaction-emoji-tab${category.key === categoryKey ? ' active' : ''}" data-category="${esc(category.key)}">${esc(category.key)}</button>
      `).join('')}
    </div>
    <div class="reaction-emoji-grid-swipe horizontal-swipe-surface">
      <div class="reaction-emoji-grid horizontal-swipe-live">
        ${renderReactionEmojiGridHtml(categoryKey)}
      </div>
    </div>
  `;
  reactionEmojiPopover.querySelector('.reaction-emoji-tabs')?.addEventListener('scroll', () => {
    bumpReactionPickerIdleTimer();
  }, { passive: true });
  reactionEmojiPopover.querySelector('.reaction-emoji-grid-swipe > .reaction-emoji-grid')?.addEventListener('scroll', () => {
    bumpReactionPickerIdleTimer();
  }, { passive: true });
  reactionEmojiSwipePager = createHorizontalSwipePager({
    root: reactionEmojiPopover.querySelector('.reaction-emoji-grid-swipe'),
    getKeys: () => getReactionEmojiCategoryKeys(),
    getActiveKey: () => reactionEmojiPopoverCategory,
    setActiveKey: (category, meta = {}) => {
      setReactionEmojiPopoverCategory(category, {
        reposition: false,
        centerBehavior: meta.source === 'swipe' ? 'smooth' : 'auto',
      });
    },
    renderPage: (category) => createReactionEmojiGridElement(category),
    isAvailable: () => isFloatingSurfaceVisible(reactionEmojiPopover),
    onInteraction: () => bumpReactionPickerIdleTimer(),
    onSettled: (_category, meta = {}) => {
      centerReactionEmojiActiveCategory({ behavior: meta.source === 'swipe' ? 'smooth' : 'auto' });
      positionReactionEmojiPopover();
      bumpReactionPickerIdleTimer();
    },
  });
  bindReactionEmojiPopoverControls();
}

function bindReactionEmojiPopoverControls() {
  if (!reactionEmojiPopover) return;
  reactionEmojiPopover.querySelectorAll('.reaction-emoji-tab').forEach((tab) => {
    if (tab.dataset.reactionEmojiTouchBound === '1') return;
    tab.dataset.reactionEmojiTouchBound = '1';
    bindTouchSafeButtonActivation(tab, ({ event, startKeyboardOpen }) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const keepComposerFocus = Boolean(reactionPickerKeepKeyboard || startKeyboardOpen || isMobileComposerKeyboardOpen());
      if (keepComposerFocus) reactionPickerKeepKeyboard = true;
      setReactionEmojiPopoverCategory(tab.dataset.category || reactionEmojiPopoverCategory);
      bindReactionEmojiPopoverControls();
      bumpReactionPickerIdleTimer();
      if (keepComposerFocus) focusComposerKeepKeyboard(true);
    });
  });
  reactionEmojiPopover.querySelectorAll('.reaction-emoji-item').forEach((item) => {
    if (item.dataset.reactionEmojiTouchBound === '1') return;
    item.dataset.reactionEmojiTouchBound = '1';
    bindTouchSafeButtonActivation(item, ({ event, startKeyboardOpen }) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (!reactionPickerMsgId) return;
      const keepComposerFocus = Boolean(reactionPickerKeepKeyboard || startKeyboardOpen || isMobileComposerKeyboardOpen());
      if (keepComposerFocus) reactionPickerKeepKeyboard = true;
      toggleReaction(reactionPickerMsgId, item.dataset.emoji, { keepComposerFocus });
    });
  });
}


function clearReactionPickerIdleTimer() {
  clearTimeout(reactionPickerIdleTimer);
  reactionPickerIdleTimer = null;
}

function bumpReactionPickerIdleTimer() {
  clearReactionPickerIdleTimer();
  if (!isFloatingSurfaceVisible(reactionPicker) && !isFloatingSurfaceVisible(reactionEmojiPopover)) return;
  reactionPickerIdleTimer = setTimeout(() => {
    hideReactionUi({ immediate: false, keepComposerState: reactionPickerKeepKeyboard });
  }, REACTION_PICKER_IDLE_MS);
}

function hideReactionEmojiPopover(options = {}) {
  if (!reactionEmojiPopover) return;
  closeFloatingSurface(reactionEmojiPopover, {
    immediate: Boolean(options.immediate),
    onAfterClose: () => {
      reactionEmojiSwipePager?.reset();
      clearFloatingMessageActionsStateIfClosed();
    },
  });
}

function showReactionEmojiPopover({ keepComposerFocus = false } = {}) {
  const msgId = reactionPickerMsgId || Number(floatingMessageActionsState?.msgId || activeMessageActionsRow?.dataset?.msgId || 0);
  if (!msgId) return;
  reactionPickerMsgId = msgId;
  if (!getAdditionalReactionCategories().length) return;
  const shouldKeepComposerFocus = Boolean(keepComposerFocus);
  if (shouldKeepComposerFocus) reactionPickerKeepKeyboard = true;
  if (isFloatingSurfaceVisible(reactionEmojiPopover)) {
    hideReactionEmojiPopover();
    if (shouldKeepComposerFocus) focusComposerKeepKeyboard(true);
    return;
  }
  renderReactionEmojiPopoverContent();
  openFloatingSurface(reactionEmojiPopover);
  positionReactionEmojiPopover();
  bumpReactionPickerIdleTimer();
  if (shouldKeepComposerFocus) focusComposerKeepKeyboard(true);
}

function handleReactionMoreButton(btn, { keepComposerFocus = false } = {}) {
  if (!btn) return;
  const shouldKeepComposerFocus = Boolean(keepComposerFocus || reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen());
  if (shouldKeepComposerFocus) reactionPickerKeepKeyboard = true;
  else btn.blur?.();
  showReactionEmojiPopover({ keepComposerFocus: shouldKeepComposerFocus });
  reactionMorePointerHandledUntil = Date.now() + 450;
  bumpReactionPickerIdleTimer();
  if (shouldKeepComposerFocus) focusComposerKeepKeyboard(true);
}

function hideReactionUi(options = {}) {
  const keepComposerState = Boolean(options.keepComposerState);
  const closeGeneration = reactionUiGeneration;
  clearReactionPickerIdleTimer();
  hideReactionEmojiPopover({ immediate: options.immediate });
  closeFloatingSurface(reactionPicker, {
    immediate: Boolean(options.immediate),
    onAfterClose: () => {
      if (closeGeneration === reactionUiGeneration) {
        reactionPickerMsgId = null;
        if (!keepComposerState) reactionPickerKeepKeyboard = false;
      }
      if (keepComposerState) focusComposerKeepKeyboard(true);
      clearFloatingMessageActionsStateIfClosed();
    },
  });
  if (!isFloatingSurfaceVisible(reactionPicker) && !keepComposerState) reactionPickerKeepKeyboard = false;
}

function hideReactionPicker(options = {}) {
  hideReactionUi(options);
}


function showReactionPicker(row, trigger, options = {}) {
  if (!reactionPicker || !row) return;
  const msg = row.__messageData || {};
  const msgId = Number(row.dataset.msgId || msg.id || 0);
  if (!msgId || msg.is_deleted) return;

  const source = options.source || 'direct';
  const keepComposerFocus = Boolean(options.keepComposerFocus);
  const samePicker = reactionPickerMsgId === msgId && isFloatingSurfaceVisible(reactionPicker);
  if (samePicker) {
    updateFloatingMessageActionsState(row);
    positionMessageActionSurfaces({
      includeActions: Boolean(activeMessageActionsRow && String(activeMessageActionsRow.dataset.msgId || '') === String(msgId)),
      includePicker: true,
    });
    bumpReactionPickerIdleTimer();
    if (keepComposerFocus) focusComposerKeepKeyboard(true);
    return;
  }

  if (source === 'actions') {
    showMessageActions(row, { preserveReactionUi: true });
  } else {
    hideActiveMessageActions();
  }

  hideReactionUi({ keepComposerState: keepComposerFocus, immediate: true });
  reactionUiGeneration += 1;
  reactionPickerKeepKeyboard = keepComposerFocus;
  reactionPickerMsgId = msgId;
  updateFloatingMessageActionsState(row);
  renderReactionPickerContent();
  const includeActions = Boolean(activeMessageActionsRow && String(activeMessageActionsRow.dataset.msgId || '') === String(msgId));
  positionMessageActionSurfaces({ includeActions, includePicker: true });
  openFloatingSurface(reactionPicker);
  bumpReactionPickerIdleTimer();
  if (keepComposerFocus) focusComposerKeepKeyboard(true);
}

async function toggleReaction(msgId, emoji, options = {}) {
  const keepComposerFocus = Boolean(options.keepComposerFocus);
  hideFloatingMessageActions({ keepComposerState: keepComposerFocus });
  if (keepComposerFocus) focusComposerKeepKeyboard(true);
  try {
    const data = await api(`/api/messages/${msgId}/reactions`, { method: 'POST', body: { emoji } });
    if (data && data.reactions) updateReactionBar(msgId, data.reactions);
    rememberRecentEmoji(emoji);
  } catch (err) {
    console.warn('[reaction] failed:', err);
  } finally {
    reactionPickerKeepKeyboard = false;
    if (keepComposerFocus) focusComposerKeepKeyboard(true);
  }
}


function bindEvents() {
  if (bindEvents.__bound) return;
  bindEvents.__bound = true;
    // Reaction picker + extra emoji popover  
    const isReactionScrollSurface = (target) => Boolean(target?.closest?.(  
      '.reaction-picker-strip, .reaction-emoji-tabs, .reaction-emoji-grid, .reaction-emoji-grid-swipe'  
    ));  
    const keepReactionInteractionFromBlurringInput = (e) => {  
      if (e.type === 'touchstart' || e.type === 'touchmove' || isReactionScrollSurface(e.target)) {  
        if (isMobileComposerKeyboardOpen()) reactionPickerKeepKeyboard = true;  
        return;  
      }  
      if (preventMobileComposerBlur(e)) reactionPickerKeepKeyboard = true;  
    };  
    const markReactionInteraction = (e) => {  
      keepReactionInteractionFromBlurringInput(e);  
      bumpReactionPickerIdleTimer();  
    };  
    
    reactionPicker.addEventListener('pointerdown', (e) => {  
      markReactionInteraction(e);  
      e.stopPropagation();  
    });  
    reactionPicker.addEventListener('pointerup', (e) => {  
      const moreBtn = e.target.closest('.reaction-more-button');  
      if (!moreBtn || !reactionPicker.contains(moreBtn)) return;  
      e.preventDefault();
      e.stopPropagation();
      markReactionInteraction(e);
      handleReactionMoreButton(moreBtn, { keepComposerFocus: reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen() });
    });  
    reactionPicker.addEventListener('touchstart', (e) => {  
      markReactionInteraction(e);  
    }, { passive: true });  
    reactionPicker.addEventListener('touchmove', (e) => {  
      markReactionInteraction(e);  
    }, { passive: true });  
    reactionPicker.addEventListener('mousedown', (e) => {  
      markReactionInteraction(e);  
      if (!isReactionScrollSurface(e.target)) e.preventDefault();  
      e.stopPropagation();  
    });  
    reactionPicker.addEventListener('wheel', () => bumpReactionPickerIdleTimer(), { passive: true });  
    reactionPicker.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.target.closest('button[data-reaction-action]');
      const activeReactionMsgId = Number(
        btn?.dataset?.messageId
        || reactionPickerMsgId
        || floatingMessageActionsState?.msgId
        || activeMessageActionsRow?.dataset?.msgId
        || 0
      );
      if (!btn || !activeReactionMsgId) return;
      const action = btn.dataset.reactionAction || 'toggle';
      const keepComposerFocus = reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen();
      if (action === 'open-emoji-popover') {
        e.preventDefault();
        if (Date.now() >= reactionMorePointerHandledUntil) handleReactionMoreButton(btn, { keepComposerFocus });
        return;
      }
      if (action === 'context-convert') {
        e.preventDefault();
        const row = messagesEl.querySelector(`[data-msg-id="${activeReactionMsgId}"]`);
        if (row) {
          openMessageContextConvertPicker(row, btn, { keepComposerFocus }).catch((error) => {
            console.warn('[context-convert] picker open failed:', error.message);
          });  
        }
        return;
      }
      if (action === 'restore-original') {
        e.preventDefault();
        restoreContextOriginalMessage(activeReactionMsgId, { keepComposerFocus }).catch((error) => {
          console.warn('[context-convert] restore failed:', error.message);
        });
        return;
      }
      if (!btn.dataset.emoji) return;
      toggleReaction(activeReactionMsgId, btn.dataset.emoji, { keepComposerFocus });
    });
    
    reactionEmojiPopover?.addEventListener('pointerdown', (e) => {  
      markReactionInteraction(e);  
      e.stopPropagation();  
    });  
    reactionEmojiPopover?.addEventListener('touchstart', (e) => {  
      markReactionInteraction(e);  
    }, { passive: true });  
    reactionEmojiPopover?.addEventListener('touchmove', (e) => {  
      markReactionInteraction(e);  
    }, { passive: true });  
    reactionEmojiPopover?.addEventListener('mousedown', (e) => {  
      markReactionInteraction(e);  
      if (!isReactionScrollSurface(e.target)) e.preventDefault();  
      e.stopPropagation();  
    });  
    reactionEmojiPopover?.addEventListener('wheel', () => bumpReactionPickerIdleTimer(), { passive: true });  
    reactionEmojiPopover?.addEventListener('click', (e) => {  
      e.stopPropagation();  
      const tab = e.target.closest('.reaction-emoji-tab');  
      if (tab) {  
        setReactionEmojiPopoverCategory(tab.dataset.category || reactionEmojiPopoverCategory);  
        bumpReactionPickerIdleTimer();  
        return;  
      }  
    
      const item = e.target.closest('.reaction-emoji-item');  
      if (!item || !reactionPickerMsgId) return;  
      const keepComposerFocus = reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen();  
      toggleReaction(reactionPickerMsgId, item.dataset.emoji, { keepComposerFocus });  
    });  
    
    document.addEventListener('click', (e) => {
      const insideFloatingActions =
        reactionPicker.contains(e.target)
        || reactionEmojiPopover?.contains(e.target)
        || e.target.closest('.msg-actions');
      if (!insideFloatingActions && !e.target.closest('.msg-react-btn')) {  
        if (activeMessageActionsRow || isFloatingSurfaceVisible(reactionPicker) || isFloatingSurfaceVisible(reactionEmojiPopover)) {  
          hideFloatingMessageActions();  
        }
      }
    });
  
    document.addEventListener('click', (e) => {
      const restoreBtn = e.target.closest('.msg-restore-original-btn');
      if (!restoreBtn || restoreBtn.disabled) return;
      const row = restoreBtn.closest('.msg-row')
        || (activeMessageActionsEl?.contains(restoreBtn) ? activeMessageActionsRow : null);
      const messageId = Number(
        restoreBtn.dataset.messageId
        || row?.__messageData?.id
        || row?.dataset?.msgId
        || reactionPickerMsgId
        || floatingMessageActionsState?.msgId
        || activeMessageActionsRow?.dataset?.msgId
        || 0
      );
      if (!messageId) return;
      e.preventDefault();
      e.stopPropagation();
      const keepComposerFocus = reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen();
      restoreContextOriginalMessage(messageId, { keepComposerFocus }).catch((error) => {
        console.warn('[context-convert] restore failed:', error.message);
      });
    }, true);
  
    // Reaction badge click + react button (delegation)
    messagesEl.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.msg-react-btn, .reaction-badge')) return;
      keepReactionInteractionFromBlurringInput(e);  
    });  
    messagesEl.addEventListener('touchstart', (e) => {  
      if (!e.target.closest('.msg-react-btn, .reaction-badge')) return;  
      keepReactionInteractionFromBlurringInput(e);  
    }, { passive: true });  
    messagesEl.addEventListener('click', (e) => {  
      const mediaTarget = getMessageMediaContextTarget(e.target);  
      const row = mediaTarget?.closest('.msg-row');  
      if (!mediaTarget || !row || Date.now() >= Number(row.__suppressMediaClickUntil || 0)) return;  
      row.__suppressMediaClickUntil = 0;  
      e.preventDefault();  
      e.stopPropagation();  
    }, true);  
    const getMessageActionTapRow = (e) => {  
      if (e.defaultPrevented || Date.now() < suppressNextMessageActionTapUntil) return null;  
      if (isMessageInteractiveTarget(e.target) && e.target.closest(
        '.msg-actions, button, a, input, textarea, select, label, audio, video, .video-note-stage, .msg-reply, .reaction-badge, .msg-image, .msg-video, .msg-file, .link-preview, .msg-group-avatar'  
      )) return null;  
      const row = e.target.closest('.msg-row');  
      if (!row || row.dataset.outbox === '1' || row.querySelector('.msg-deleted')) return null;  
      return row;  
    };  
    messagesEl.addEventListener('click', (e) => {  
      if (Date.now() < suppressNextMessageActionTapUntil) {  
        e.preventDefault();  
        e.stopPropagation();  
        return;  
      }  
      const reactBtn = e.target.closest('.msg-react-btn');  
      if (reactBtn) {  
        e.stopPropagation();  
        const row = reactBtn.closest('.msg-row') || (activeMessageActionsEl?.contains(reactBtn) ? activeMessageActionsRow : null);  
        if (row) {  
          const keepComposerFocus = reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen();  
          showReactionPicker(row, reactBtn, { source: 'actions', keepComposerFocus });  
        }  
        return;  
      }  
      const badge = e.target.closest('.reaction-badge');  
      if (badge) {  
        const row = badge.closest('.msg-row');  
        if (row) {  
          const keepComposerFocus = reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen();  
          toggleReaction(+row.dataset.msgId, badge.dataset.emoji, { keepComposerFocus });  
        }  
        return;  
      }  
      const row = getMessageActionTapRow(e);
      if (row) {
        e.stopPropagation();
        showMessageActions(row, { toggle: true, keepComposerFocus: isMobileComposerKeyboardOpen() });
      }
    });
    
  
    // Long press/right-click on a message opens reactions directly.  
    (() => {  
      let lpTimer = null;  
      let lpStart = null;  
      const clearLongPress = () => {  
        clearTimeout(lpTimer);  
        lpTimer = null;  
        lpStart = null;  
      };  
      messagesEl.addEventListener('touchstart', (e) => {  
        if (e.touches.length !== 1) return;  
        const row = e.target.closest('.msg-row');  
        if (!row || (isMessageInteractiveTarget(e.target) && e.target.closest(
          '.msg-actions, button, a, input, textarea, select, label, audio, video, .video-note-stage, .msg-reply, .reaction-badge, .msg-image, .msg-video, .msg-file, .link-preview, .msg-group-avatar'  
        ))) return;
        if (getSelectedMessageFragment(row) || isSelectableMessageTextTarget(e.target)) return;  
        const touch = e.touches && e.touches[0] ? e.touches[0] : null;  
        lpStart = { row, x: touch?.clientX || 0, y: touch?.clientY || 0, startedOnLocationCard: isLocationCardGestureTarget(e.target) };
        lpTimer = setTimeout(() => {  
          lpTimer = null;  
          suppressNextMessageActionTap();
          if (lpStart?.startedOnLocationCard) suppressLocationCardClick(row);
          safeVibrate(30);  
          showReactionPicker(row, null, {  
            source: lpStart?.startedOnLocationCard ? 'actions' : 'long-press',
            keepComposerFocus: reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen(),  
          });  
        }, 500);  
      }, { passive: true });  
      messagesEl.addEventListener('touchend', clearLongPress, { passive: true });  
      messagesEl.addEventListener('touchcancel', clearLongPress, { passive: true });  
      messagesEl.addEventListener('touchmove', (e) => {  
        if (!lpStart || e.touches.length !== 1) return;  
        const touch = e.touches[0];  
        if (Math.hypot(touch.clientX - lpStart.x, touch.clientY - lpStart.y) > 10) clearLongPress();  
      }, { passive: true });  
      // Desktop right-click  
      messagesEl.addEventListener('contextmenu', (e) => {  
        const row = e.target.closest('.msg-row');  
        if (row && getSelectedMessageFragment(row)) return;  
        const startedOnLocationCard = isLocationCardGestureTarget(e.target);
        if (isMessageInteractiveTarget(e.target) && e.target.closest(
          '.msg-actions, button, a, input, textarea, select, label, audio, video, .video-note-stage, .msg-reply, .reaction-badge, .msg-image, .msg-video, .msg-file, .link-preview, .msg-group-avatar'  
        )) return;  
        if (!row) return;  
        e.preventDefault();  
        if (startedOnLocationCard) suppressLocationCardClick(row);
        showReactionPicker(row, null, {
          source: startedOnLocationCard ? 'actions' : 'long-press',
          keepComposerFocus: reactionPickerKeepKeyboard || isMobileComposerKeyboardOpen(),  
        });  
      });  
    })();  
    
  
}
function getReactionPickerMsgId() { return reactionPickerMsgId; }
function getReactionPickerKeepKeyboard() { return reactionPickerKeepKeyboard; }
function refreshReactionPickerForMessage(msg) {
  if (Number(reactionPickerMsgId || 0) === Number(msg?.id || 0) && isFloatingSurfaceVisible(reactionPicker)) {
    renderReactionPickerContent();
    positionMessageActionSurfaces({ includeActions: Boolean(activeMessageActionsRow), includePicker: true });
  }
}
__exports = { renderReactions, updateReactionBar, renderQuickReactionButtonsHtml, renderReactionPickerContent, showReactionPicker, hideReactionPicker, hideReactionUi, getAdditionalReactionCategories, getReactionEmojiCategoryKey, getReactionEmojiCategoryKeys, renderReactionEmojiGridHtml, getReactionEmojiLiveGrid, createReactionEmojiGridElement, centerReactionEmojiActiveCategory, setReactionEmojiPopoverCategory, renderReactionEmojiPopoverContent, bindReactionEmojiPopoverControls, showReactionEmojiPopover, hideReactionEmojiPopover, handleReactionMoreButton, toggleReaction, clearReactionPickerIdleTimer, bumpReactionPickerIdleTimer, bindEvents, getReactionPickerMsgId, getReactionPickerKeepKeyboard, refreshReactionPickerForMessage };
  }
  return scope.__exports;
}
interactionsRoot.reactions = { createReactionController };
})();
