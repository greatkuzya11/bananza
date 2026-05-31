(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const composerRoot = root.composer = root.composer || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function noop() {}

  function normalizeMentionTarget(raw) {
    if (!raw) return null;
    const token = String(raw.token || raw.mention || raw.username || '').replace(/^@+/, '').trim();
    if (!token) return null;
    return {
      ...raw,
      token,
      mention: token,
      user_id: Number(raw.user_id) || 0,
      is_ai_bot: Boolean(raw.is_ai_bot),
      bot_id: Number(raw.bot_id) || 0,
      bot_provider: String(raw.bot_provider || '').trim(),
      bot_kind: String(raw.bot_kind || '').trim(),
      allow_text: Boolean(raw.allow_text),
      allow_image_generate: Boolean(raw.allow_image_generate),
      allow_image_edit: Boolean(raw.allow_image_edit),
      allow_document: Boolean(raw.allow_document),
      allow_poll_create: Boolean(raw.allow_poll_create),
      allow_poll_vote: Boolean(raw.allow_poll_vote),
      allow_react: Boolean(raw.allow_react),
      allow_pin: Boolean(raw.allow_pin),
      image_risk_filter_enabled: raw.image_risk_filter_enabled !== false,
      document_default_format: String(raw.document_default_format || '').trim().toLowerCase() === 'txt' ? 'txt' : 'md',
    };
  }

  function createMentionPickerController(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const win = opts.window || window;
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const text = objectOrDefault(opts.text);
    const actions = objectOrDefault(opts.actions);
    const api = typeof opts.api === 'function' ? opts.api : (() => Promise.resolve({}));
    const formatters = objectOrDefault(opts.formatters || root.formatters);
    const esc = typeof opts.esc === 'function'
      ? opts.esc
      : (typeof formatters.esc === 'function' ? formatters.esc : (value) => String(value == null ? '' : value));
    const MENTION_PICKER_TAP_DEAD_ZONE = Number(opts.MENTION_PICKER_TAP_DEAD_ZONE || opts.config?.MENTION_PICKER_TAP_DEAD_ZONE || 8) || 8;
    const getCurrentChatId = typeof opts.getCurrentChatId === 'function'
      ? opts.getCurrentChatId
      : (typeof actions.getCurrentChatId === 'function' ? actions.getCurrentChatId : () => null);
    const getCurrentUser = typeof opts.getCurrentUser === 'function'
      ? opts.getCurrentUser
      : (typeof actions.getCurrentUser === 'function' ? actions.getCurrentUser : () => null);

    function mentionKey(value) {
      return String(value || '').replace(/^@+/, '').toLowerCase();
    }

    async function loadMentionTargets(chatId = getCurrentChatId(), { force = false } = {}) {
      const id = Number(chatId);
      if (!id) return [];
      if (!force && state.mentionTargetsByChat.has(id)) return state.mentionTargetsByChat.get(id);
      if (force) state.mentionTargetsByChat.delete(id);
      const data = await api(`/api/chats/${id}/mention-targets`);
      const sourceTargets = data.targets || data.users || [];
      const targets = sourceTargets.map(normalizeMentionTarget).filter(Boolean);
      state.mentionTargetsByChat.set(id, targets);
      if (id === Number(getCurrentChatId() || 0)) (actions.updateComposerAiOverrideState || noop)();
      return targets;
    }

    function suppressMentionPickerFollowupClick(ms = 550) {
      state.mentionPickerClickSuppressUntil = Math.max(state.mentionPickerClickSuppressUntil, Date.now() + ms);
    }

    function ensureMentionPickerBackdrop() {
      let backdrop = doc.getElementById('mentionPickerBackdrop');
      if (backdrop) return backdrop;
      backdrop = doc.createElement('div');
      backdrop.id = 'mentionPickerBackdrop';
      backdrop.className = 'mention-picker-backdrop hidden';
      doc.body.appendChild(backdrop);
      const blockAndClose = (event) => {
        event.preventDefault();
        event.stopPropagation();
        suppressMentionPickerFollowupClick();
        hideMentionPicker();
      };
      backdrop.addEventListener('pointerdown', blockAndClose, { passive: false });
      backdrop.addEventListener('click', blockAndClose, { passive: false });
      backdrop.addEventListener('contextmenu', blockAndClose, { passive: false });
      return backdrop;
    }

    function ensureMentionPicker() {
      let picker = doc.getElementById('mentionPicker');
      ensureMentionPickerBackdrop();
      if (picker) return picker;
      picker = doc.createElement('div');
      picker.id = 'mentionPicker';
      picker.className = 'mention-picker hidden';
      doc.body.appendChild(picker);
      picker.addEventListener('pointerdown', (event) => {
        if (typeof event.button === 'number' && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const item = event.target.closest('.mention-picker-item');
        if (!item) return;
        state.mentionPickerPointerState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startIndex: Number(item.dataset.index),
          moved: false,
        };
      }, { passive: false });
      picker.addEventListener('pointermove', (event) => {
        event.stopPropagation();
        const pointerState = state.mentionPickerPointerState;
        if (!pointerState || event.pointerId !== pointerState.pointerId || pointerState.moved) return;
        const dx = event.clientX - pointerState.startX;
        const dy = event.clientY - pointerState.startY;
        if ((dx * dx) + (dy * dy) > (MENTION_PICKER_TAP_DEAD_ZONE * MENTION_PICKER_TAP_DEAD_ZONE)) {
          pointerState.moved = true;
        }
      }, { passive: false });
      picker.addEventListener('scroll', () => {
        if (state.mentionPickerPointerState) state.mentionPickerPointerState.moved = true;
      }, { passive: true, capture: true });
      picker.addEventListener('pointercancel', () => {
        state.mentionPickerPointerState = null;
      }, { passive: true });
      picker.addEventListener('pointerup', (event) => {
        event.preventDefault();
        event.stopPropagation();
        suppressMentionPickerFollowupClick();
        const pointerState = state.mentionPickerPointerState;
        state.mentionPickerPointerState = null;
        if (!pointerState || event.pointerId !== pointerState.pointerId || pointerState.moved) return;
        const item = event.target.closest('.mention-picker-item');
        if (!item) return;
        const index = Number(item.dataset.index);
        if (!Number.isInteger(index) || index !== pointerState.startIndex) return;
        event.preventDefault();
        event.stopPropagation();
        const target = state.mentionPickerState.targets[index];
        if (target) insertMentionTarget(target);
      }, { passive: false });
      picker.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      return picker;
    }

    function isComposerMeaningfullyEmpty() {
      return !text.getComposerTextValue?.({ trim: true });
    }

    function getManualMentionRange() {
      const value = String(dom.msgInput?.value || '');
      if (!value.trim()) return { start: 0, end: value.length };
      const start = dom.msgInput?.selectionStart ?? value.length;
      const end = dom.msgInput?.selectionEnd ?? start;
      return { start, end };
    }

    function syncMentionOpenButton() {
      if (!dom.mentionOpenBtn) return;
      const visible = Boolean(getCurrentChatId());
      dom.mentionOpenBtn.classList.toggle('hidden', !visible);
      dom.mentionOpenBtn.classList.toggle('is-open', state.mentionPickerState.active);
      dom.mentionOpenBtn.disabled = !visible;
      dom.mentionOpenBtn.setAttribute('aria-hidden', visible ? 'false' : 'true');
      dom.mentionOpenBtn.setAttribute('aria-expanded', state.mentionPickerState.active ? 'true' : 'false');
      (actions.syncContextConvertComposerButton || noop)();
    }

    function hideMentionPicker(options = {}) {
      const immediate = Boolean(options.immediate);
      state.resetMentionPickerState();
      state.mentionPickerPointerState = null;
      (actions.closeFloatingSurface || ((el) => el?.classList.add('hidden')))(doc.getElementById('mentionPickerBackdrop'), { immediate });
      (actions.closeFloatingSurface || ((el) => el?.classList.add('hidden')))(doc.getElementById('mentionPicker'), { immediate });
      syncMentionOpenButton();
    }

    function findMentionTrigger() {
      if (!getCurrentChatId() || !dom.msgInput) return null;
      const value = dom.msgInput.value || '';
      const cursor = dom.msgInput.selectionStart ?? value.length;
      const left = value.slice(0, cursor);
      const match = left.match(/(^|\s)@([a-zA-Z0-9_-]{0,32})$/);
      if (!match) return null;
      const atIndex = cursor - match[2].length - 1;
      const prev = atIndex > 0 ? value[atIndex - 1] : '';
      if (prev && !/\s/.test(prev)) return null;
      return { start: atIndex, end: cursor, query: match[2].toLowerCase() };
    }

    function positionMentionPicker() {
      const picker = doc.getElementById('mentionPicker');
      if (!picker || picker.classList.contains('hidden') || !dom.msgInput) return;
      const rect = dom.msgInput.getBoundingClientRect();
      const vv = win.visualViewport;
      const viewportLeft = vv ? vv.offsetLeft : 0;
      const viewportTop = vv ? vv.offsetTop : 0;
      const viewportWidth = vv ? vv.width : win.innerWidth;
      const viewportHeight = vv ? vv.height : win.innerHeight;
      const width = Math.min(Math.max(rect.width, 240), viewportWidth - 16);
      picker.style.width = `${width}px`;
      const height = picker.offsetHeight || 180;
      const left = Math.max(viewportLeft + 8, Math.min(rect.left + viewportLeft, viewportLeft + viewportWidth - width - 8));
      const top = Math.max(viewportTop + 8, Math.min(rect.top + viewportTop - height - 8, viewportTop + viewportHeight - height - 8));
      picker.style.left = `${left}px`;
      picker.style.top = `${top}px`;
    }

    function renderMentionPicker(targets, options = {}) {
      const picker = ensureMentionPicker();
      const previousScrollTop = picker.querySelector('.mention-picker-list')?.scrollTop || 0;
      const {
        source = state.mentionPickerState.source || 'trigger',
        preserveSelection = true,
        keyboardAttached = state.mentionPickerState.keyboardAttached,
      } = options;
      if (!targets.length) {
        hideMentionPicker();
        return;
      }
      state.mentionPickerState.targets = targets;
      state.mentionPickerState.source = source;
      state.mentionPickerState.keyboardAttached = Boolean(keyboardAttached);
      state.mentionPickerState.selected = preserveSelection
        ? Math.min(state.mentionPickerState.selected, targets.length - 1)
        : 0;
      picker.innerHTML = `
        <div class="mention-picker-list">
          ${targets.map((target, index) => `
            <button type="button" class="mention-picker-item${index === state.mentionPickerState.selected ? ' active' : ''}" data-index="${index}">
              <span class="mention-picker-avatar" style="background:${esc(target.avatar_color || '#65aadd')}">${target.avatar_url ? `<img src="${esc(target.avatar_url)}" alt="">` : esc((target.display_name || target.token || '?').trim()[0] || '?')}</span>
              <span class="mention-picker-copy">
                <strong>${esc(target.display_name || target.token)}</strong>
                <small>@${esc(target.token)}${target.is_ai_bot ? ' &middot; AI' : ''}</small>
              </span>
            </button>
          `).join('')}
        </div>
      `;
      state.mentionPickerState.active = true;
      (actions.openFloatingSurface || ((el) => el?.classList.remove('hidden')))(picker);
      syncMentionOpenButton();
      positionMentionPicker();
      const list = picker.querySelector('.mention-picker-list');
      if (list) {
        list.scrollTop = previousScrollTop;
        list.querySelector('.mention-picker-item.active')?.scrollIntoView({ block: 'nearest' });
      }
      win.requestAnimationFrame(() => positionMentionPicker());
    }

    async function openMentionPickerFromButton(options = {}) {
      const keyboardAttached = Boolean(
        !(actions.isMobileLayoutViewport || (() => false))()
        || (Object.prototype.hasOwnProperty.call(options, 'keyboardAttached')
          ? options.keyboardAttached
          : (actions.isMobileComposerKeyboardOpen || (() => false))())
      );
      const chatId = Number(getCurrentChatId() || 0);
      if (state.mentionPickerState.active && state.mentionPickerState.source === 'button') {
        hideMentionPicker();
        (actions.restoreComposerFocusAfterMentionPicker || noop)(keyboardAttached);
        return;
      }
      if (!chatId || !dom.msgInput) {
        syncMentionOpenButton();
        return;
      }
      if (!isComposerMeaningfullyEmpty()) {
        insertRawMentionTriggerAtCursor();
        return;
      }
      try {
        const targets = await loadMentionTargets(chatId);
        if (chatId !== Number(getCurrentChatId() || 0) || !isComposerMeaningfullyEmpty()) return;
        const range = getManualMentionRange();
        state.mentionPickerState.start = range.start;
        state.mentionPickerState.end = range.end;
        renderMentionPicker(targets, { source: 'button', preserveSelection: false, keyboardAttached });
        (actions.restoreComposerFocusAfterMentionPicker || noop)(keyboardAttached);
      } catch {
        hideMentionPicker();
      }
    }

    async function updateMentionPicker() {
      const trigger = findMentionTrigger();
      if (!trigger) {
        if (state.mentionPickerState.active && state.mentionPickerState.source === 'button' && isComposerMeaningfullyEmpty()) {
          const chatId = Number(getCurrentChatId() || 0);
          try {
            const targets = await loadMentionTargets(chatId);
            if (chatId !== Number(getCurrentChatId() || 0) || !state.mentionPickerState.active || state.mentionPickerState.source !== 'button' || !isComposerMeaningfullyEmpty()) return;
            const range = getManualMentionRange();
            state.mentionPickerState.start = range.start;
            state.mentionPickerState.end = range.end;
            renderMentionPicker(targets, { source: 'button', keyboardAttached: state.mentionPickerState.keyboardAttached });
          } catch {
            hideMentionPicker();
          }
        } else {
          hideMentionPicker();
        }
        return;
      }
      state.mentionPickerState.start = trigger.start;
      state.mentionPickerState.end = trigger.end;
      const chatId = getCurrentChatId();
      try {
        const targets = await loadMentionTargets(chatId);
        const latest = findMentionTrigger();
        if (chatId !== getCurrentChatId() || !latest || latest.start !== trigger.start || latest.end !== trigger.end || latest.query !== trigger.query) return;
        const query = trigger.query;
        const filtered = targets.filter((target) => {
          const haystack = [
            target.token,
            target.username,
            target.display_name,
            target.is_ai_bot ? 'ai bot' : '',
          ].join(' ').toLowerCase();
          return !query || haystack.includes(query);
        });
        const visibleTargets = query ? filtered.slice(0, 8) : filtered;
        renderMentionPicker(visibleTargets, { source: 'trigger', keyboardAttached: !(actions.isMobileLayoutViewport || (() => false))() || (actions.isMobileComposerKeyboardOpen || (() => false))() });
      } catch {
        hideMentionPicker();
      }
    }

    function insertMentionTarget(target) {
      if (!target || !dom.msgInput) return;
      const keyboardAttached = Boolean(state.mentionPickerState.keyboardAttached);
      const tokenValue = `@${String(target.token || target.mention || '').replace(/^@+/, '')} `;
      const value = dom.msgInput.value || '';
      const start = state.mentionPickerState.start ?? (dom.msgInput.selectionStart || 0);
      const end = state.mentionPickerState.end ?? (dom.msgInput.selectionEnd || start);
      dom.msgInput.value = value.slice(0, start) + tokenValue + value.slice(end);
      const cursor = start + tokenValue.length;
      dom.msgInput.setSelectionRange(cursor, cursor);
      hideMentionPicker();
      text.autoResize?.();
      syncMentionOpenButton();
      (actions.refreshVoiceComposerState || noop)();
      (actions.restoreComposerFocusAfterMentionPicker || noop)(keyboardAttached);
      dom.msgInput.dispatchEvent(new win.Event('input', { bubbles: true }));
    }

    function insertMentionTokenIntoComposer(token) {
      const clean = String(token || '').replace(/^@+/, '').trim();
      if (!clean || !dom.msgInput) return;
      text.snapComposerSelectionToCustomEmojiBoundary?.();
      const value = dom.msgInput.value || '';
      const cursor = dom.msgInput.selectionStart ?? value.length;
      const prefix = cursor > 0 && !/\s/.test(value[cursor - 1]) ? ' ' : '';
      const insertion = `${prefix}@${clean} `;
      dom.msgInput.value = value.slice(0, cursor) + insertion + value.slice(cursor);
      const nextCursor = cursor + insertion.length;
      dom.msgInput.setSelectionRange(nextCursor, nextCursor);
      text.autoResize?.();
      syncMentionOpenButton();
      (actions.refreshVoiceComposerState || noop)();
      (actions.focusComposerKeepKeyboard || noop)(true);
      dom.msgInput.dispatchEvent(new win.Event('input', { bubbles: true }));
    }

    function insertRawMentionTriggerAtCursor() {
      if (!dom.msgInput) return;
      text.snapComposerSelectionToCustomEmojiBoundary?.();
      const value = dom.msgInput.value || '';
      const start = Math.max(0, dom.msgInput.selectionStart ?? value.length);
      const end = Math.max(start, dom.msgInput.selectionEnd ?? start);
      dom.msgInput.value = value.slice(0, start) + '@' + value.slice(end);
      const nextCursor = start + 1;
      dom.msgInput.setSelectionRange(nextCursor, nextCursor);
      text.autoResize?.();
      syncMentionOpenButton();
      (actions.refreshVoiceComposerState || noop)();
      try {
        dom.msgInput.focus({ preventScroll: true });
      } catch {
        dom.msgInput.focus();
      }
      dom.msgInput.dispatchEvent(new win.Event('input', { bubbles: true }));
    }

    function handleMentionPickerKeydown(event) {
      if (!state.mentionPickerState.active) return false;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        state.mentionPickerState.selected = (state.mentionPickerState.selected + 1) % state.mentionPickerState.targets.length;
        renderMentionPicker(state.mentionPickerState.targets);
        return true;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        state.mentionPickerState.selected = (state.mentionPickerState.selected - 1 + state.mentionPickerState.targets.length) % state.mentionPickerState.targets.length;
        renderMentionPicker(state.mentionPickerState.targets);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insertMentionTarget(state.mentionPickerState.targets[state.mentionPickerState.selected]);
        return true;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        hideMentionPicker();
        return true;
      }
      return false;
    }

    async function handleMentionClick(event, button) {
      event.preventDefault();
      event.stopPropagation();
      const tokenValue = button.dataset.mentionToken || '';
      if (button.dataset.mentionBot === '1') {
        insertMentionTokenIntoComposer(tokenValue);
        return;
      }
      const currentUser = getCurrentUser();
      const userId = Number(button.dataset.mentionUserId);
      if (!userId || userId === currentUser?.id) return;
      try {
        await (actions.openPrivateChatWithUser || (() => Promise.resolve()))(userId);
      } catch (error) {
        console.warn('[mentions] private chat failed:', error.message);
      }
    }

    function dismissMentionPickerAfterKeyboardClose() {
      if (!state.mentionPickerState.active || !state.mentionPickerState.keyboardAttached) return false;
      if ((actions.isMobileComposerKeyboardOpen || (() => false))()) return false;
      hideMentionPicker({ immediate: true });
      return true;
    }

    function dismissMentionPickerOutsideGesture(event) {
      const picker = doc.getElementById('mentionPicker');
      if (!picker || picker.classList.contains('hidden')) return;
      const target = event.target;
      if (picker.contains(target) || target === dom.msgInput || target?.closest?.('#mentionOpenBtn')) return;
      hideMentionPicker({ immediate: true });
      if ((actions.isPickerDismissPassThroughTarget || (() => false))(target)) return;
      (actions.consumeOutsidePickerDismissGesture || noop)(event, suppressMentionPickerFollowupClick);
    }

    function refreshMentionPickerForUserUpdate() {
      const chatId = Number(getCurrentChatId());
      if (state.mentionPickerState.active && state.mentionTargetsByChat.has(chatId)) {
        const targets = state.mentionTargetsByChat.get(chatId) || [];
        if (targets.length) renderMentionPicker(targets);
        else hideMentionPicker();
      }
    }

    return {
      mentionKey,
      normalizeMentionTarget,
      loadMentionTargets,
      suppressMentionPickerFollowupClick,
      ensureMentionPickerBackdrop,
      ensureMentionPicker,
      isComposerMeaningfullyEmpty,
      getManualMentionRange,
      syncMentionOpenButton,
      hideMentionPicker,
      findMentionTrigger,
      positionMentionPicker,
      renderMentionPicker,
      openMentionPickerFromButton,
      updateMentionPicker,
      insertMentionTarget,
      insertMentionTokenIntoComposer,
      insertRawMentionTriggerAtCursor,
      handleMentionPickerKeydown,
      handleMentionClick,
      dismissMentionPickerAfterKeyboardClose,
      dismissMentionPickerOutsideGesture,
      refreshMentionPickerForUserUpdate,
    };
  }

  composerRoot.mentions = {
    createMentionPickerController,
  };
})();
