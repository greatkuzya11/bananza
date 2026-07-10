(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const foldersRoot = root.folders = root.folders || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function defaultEsc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function createChatFolderUi(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const win = opts.window || window;
    const dom = objectOrDefault(opts.dom);
    const store = opts.store;
    const config = objectOrDefault(opts.config);
    const formatters = objectOrDefault(opts.formatters);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const t = typeof opts.t === 'function' ? opts.t : (key) => String(key || '');
    const tx = typeof opts.tx === 'function' ? opts.tx : (text) => String(text == null ? '' : text);
    const esc = typeof formatters.esc === 'function' ? formatters.esc : defaultEsc;
    const ALL_CHATS_FOLDER_ID = Number(config.ALL_CHATS_FOLDER_ID) || 0;
    const CHAT_FOLDER_ICON_EMOJI = objectOrDefault(config.CHAT_FOLDER_ICON_EMOJI);

    let chatFolderPickerState = null;
    let chatFolderContextMenuState = null;
    let pendingChatFolderChipCenterBehavior = 'auto';
    let chatFolderStripPreviewFolderId = null;
    let chatFolderBarForceVisible = false;
    let chatFolderStripVisibilitySaveInFlight = false;
    let chatFolderStripManualScrollUntil = 0;

    function $(selector, rootEl = doc) {
      if (typeof dom.$ === 'function') return dom.$(selector, rootEl);
      return rootEl && typeof rootEl.querySelector === 'function' ? rootEl.querySelector(selector) : null;
    }

    function byId(id) {
      return doc.getElementById(id);
    }

    function normalizeChatFolderId(folderId) {
      if (store && typeof store.activeFolderId !== 'undefined' && typeof foldersRoot.store?.normalizeChatFolderId === 'function') {
        return foldersRoot.store.normalizeChatFolderId(folderId, config);
      }
      const nextId = Number(folderId || 0);
      return Number.isInteger(nextId) && nextId > 0 ? nextId : ALL_CHATS_FOLDER_ID;
    }

    function getEl(name, fallbackId) {
      return dom[name] || byId(fallbackId || name) || null;
    }

    function getChats() {
      const chats = typeof state.getChats === 'function' ? state.getChats() : [];
      return Array.isArray(chats) ? chats : [];
    }

    function getCurrentUser() {
      return typeof state.getCurrentUser === 'function' ? state.getCurrentUser() : null;
    }

    function setCurrentUser(user, optionsForSet = {}) {
      if (typeof state.setCurrentUser === 'function') return state.setCurrentUser(user, optionsForSet);
      return user;
    }

    function isHTMLElement(value) {
      return value instanceof win.HTMLElement;
    }

    function isFloatingSurfaceVisible(el) {
      if (typeof actions.isFloatingSurfaceVisible === 'function') return actions.isFloatingSurfaceVisible(el);
      return Boolean(el && !el.classList.contains('hidden'));
    }

    function openFloatingSurface(el) {
      if (typeof actions.openFloatingSurface === 'function') return actions.openFloatingSurface(el);
      el?.classList.remove('hidden');
      return el;
    }

    function closeFloatingSurface(el, closeOptions = {}) {
      if (typeof actions.closeFloatingSurface === 'function') return actions.closeFloatingSurface(el, closeOptions);
      el?.classList.add('hidden');
      if (typeof closeOptions.onAfterClose === 'function') closeOptions.onAfterClose();
      return el;
    }

    function clamp(value, min, max) {
      if (typeof actions.clamp === 'function') return actions.clamp(value, min, max);
      return Math.min(max, Math.max(min, value));
    }

    function getFloatingViewportRect() {
      if (typeof actions.getFloatingViewportRect === 'function') return actions.getFloatingViewportRect();
      return {
        left: 0,
        top: 0,
        right: Number(win.innerWidth || 0),
        bottom: Number(win.innerHeight || 0),
      };
    }

    function measureFloatingSurface(el, fallbackWidth, fallbackHeight) {
      if (typeof actions.measureFloatingSurface === 'function') {
        return actions.measureFloatingSurface(el, fallbackWidth, fallbackHeight);
      }
      return {
        width: Number(el?.offsetWidth || 0) || fallbackWidth,
        height: Number(el?.offsetHeight || 0) || fallbackHeight,
      };
    }

    function positionFloatingElement(el, left, top) {
      if (typeof actions.positionFloatingElement === 'function') return actions.positionFloatingElement(el, left, top);
      if (el) {
        el.style.left = `${Math.round(Number(left || 0))}px`;
        el.style.top = `${Math.round(Number(top || 0))}px`;
      }
      return el;
    }

    function prefersReducedMotion() {
      return typeof actions.prefersReducedMotion === 'function' ? actions.prefersReducedMotion() : false;
    }

    function currentModalAnimation() {
      return typeof state.getCurrentModalAnimation === 'function' ? state.getCurrentModalAnimation() : 'soft';
    }

    function chatFolderIconEmoji(kind = 'custom') {
      if (kind === 'all') return CHAT_FOLDER_ICON_EMOJI.all || '\uD83D\uDCAC';
      if (kind === 'bot_auto') return CHAT_FOLDER_ICON_EMOJI.bot_auto || '\uD83E\uDD16';
      return CHAT_FOLDER_ICON_EMOJI.custom || '\uD83D\uDCC1';
    }

    function chatFolderEmojiMarkup(kind = 'custom', className = 'chat-folder-picker-emoji') {
      return `<span class="${className}" aria-hidden="true">${esc(chatFolderIconEmoji(kind))}</span>`;
    }

    function chatFolderIconMarkup(kind = 'custom') {
      return chatFolderEmojiMarkup(kind);
    }

    function activeChatFolderStripRows() {
      return [{
        id: ALL_CHATS_FOLDER_ID,
        name: '\u0412\u0441\u0435 \u0447\u0430\u0442\u044b',
        kind: 'all',
      }].concat((store?.getFolders?.() || []).map((folder) => ({
        id: Number(folder.id || 0),
        name: folder.name || '\u041F\u0430\u043F\u043A\u0430',
        kind: folder.kind === 'bot_auto' ? 'bot_auto' : 'custom',
      })));
    }

    function getRenderedChatFolderSelectionId() {
      if (chatFolderStripPreviewFolderId != null) return normalizeChatFolderId(chatFolderStripPreviewFolderId);
      return normalizeChatFolderId(store?.activeFolderId);
    }

    function isChatFolderStripVisibleInAllChatsEnabled() {
      return Boolean(getCurrentUser()?.ui_show_chat_folder_strip_in_all_chats);
    }

    function syncChatFolderPickerAllChatsToggleState() {
      const chatFolderPicker = getEl('chatFolderPicker', 'chatFolderPicker');
      const toggle = chatFolderPicker?.querySelector('[data-chat-folder-strip-toggle]');
      if (!isHTMLElement(toggle)) return false;
      const enabled = isChatFolderStripVisibleInAllChatsEnabled();
      toggle.classList.toggle('is-active', enabled);
      toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      toggle.disabled = chatFolderStripVisibilitySaveInFlight;
      return true;
    }

    function applyChatFolderStripVisibilityInAllChats(enabled, { persist = true, renderBar = true, syncPicker = true } = {}) {
      const currentUser = getCurrentUser();
      if (!currentUser) return false;
      setCurrentUser({
        ...currentUser,
        ui_show_chat_folder_strip_in_all_chats: Boolean(enabled),
      }, { persist });
      if (renderBar) renderActiveChatFolderBar({ centerBehavior: 'auto' });
      if (syncPicker && isFloatingSurfaceVisible(getEl('chatFolderPicker', 'chatFolderPicker'))) {
        syncChatFolderPickerAllChatsToggleState();
      }
      return Boolean(enabled);
    }

    async function saveChatFolderStripVisibilityInAllChats(nextValue) {
      if (!getCurrentUser() || chatFolderStripVisibilitySaveInFlight) {
        return isChatFolderStripVisibleInAllChatsEnabled();
      }
      const desired = Boolean(nextValue);
      const previous = isChatFolderStripVisibleInAllChatsEnabled();
      if (desired === previous) {
        syncChatFolderPickerAllChatsToggleState();
        renderActiveChatFolderBar({ centerBehavior: 'auto' });
        return previous;
      }

      chatFolderStripVisibilitySaveInFlight = true;
      applyChatFolderStripVisibilityInAllChats(desired, { persist: true, renderBar: true, syncPicker: true });
      try {
        const res = typeof actions.saveStripVisibility === 'function'
          ? await actions.saveStripVisibility(desired)
          : { user: { ui_show_chat_folder_strip_in_all_chats: desired } };
        const currentUser = getCurrentUser();
        if (currentUser) {
          setCurrentUser({
            ...currentUser,
            ...(res?.user || {}),
            ui_show_chat_folder_strip_in_all_chats: Boolean(res?.user?.ui_show_chat_folder_strip_in_all_chats ?? desired),
          }, { persist: true });
        }
        renderActiveChatFolderBar({ centerBehavior: 'auto' });
        return isChatFolderStripVisibleInAllChatsEnabled();
      } catch (error) {
        applyChatFolderStripVisibilityInAllChats(previous, { persist: true, renderBar: true, syncPicker: true });
        throw error;
      } finally {
        chatFolderStripVisibilitySaveInFlight = false;
        syncChatFolderPickerAllChatsToggleState();
      }
    }

    function shouldShowChatFolderBarForSelection(
      folderId = getRenderedChatFolderSelectionId(),
      { forceVisible = chatFolderBarForceVisible } = {}
    ) {
      return (store?.getFolders?.() || []).length > 0
        && (Boolean(forceVisible)
          || normalizeChatFolderId(folderId) !== ALL_CHATS_FOLDER_ID
          || isChatFolderStripVisibleInAllChatsEnabled());
    }

    function shouldShowActiveChatFolderBar() {
      return shouldShowChatFolderBarForSelection();
    }

    function chatFolderStripStructureSignature(rows = []) {
      return rows.map((row) => `${Number(row.id || 0)}:${row.kind || 'custom'}:${row.name || ''}`).join('|');
    }

    function chatFolderStripLabelForSelection(folderId = getRenderedChatFolderSelectionId(), rows = activeChatFolderStripRows()) {
      const normalizedFolderId = normalizeChatFolderId(folderId);
      return rows.find((row) => Number(row.id || 0) === normalizedFolderId)?.name || '\u0412\u0441\u0435 \u0447\u0430\u0442\u044b';
    }

    function consumePendingChatFolderChipCenterBehavior() {
      const nextBehavior = pendingChatFolderChipCenterBehavior === 'smooth' ? 'smooth' : 'auto';
      pendingChatFolderChipCenterBehavior = 'auto';
      return nextBehavior;
    }

    function setPendingChatFolderChipCenterBehavior(behavior = 'auto') {
      pendingChatFolderChipCenterBehavior = behavior === 'smooth' ? 'smooth' : 'auto';
    }

    function cancelScheduledActiveChatFolderChipCenter() {
      const activeChatFolderStrip = getEl('activeChatFolderStrip', 'activeChatFolderStrip');
      if (!isHTMLElement(activeChatFolderStrip)) return;
      if (activeChatFolderStrip.__centerChipRafPrimary) {
        win.cancelAnimationFrame(activeChatFolderStrip.__centerChipRafPrimary);
        activeChatFolderStrip.__centerChipRafPrimary = 0;
      }
      if (activeChatFolderStrip.__centerChipRafSecondary) {
        win.cancelAnimationFrame(activeChatFolderStrip.__centerChipRafSecondary);
        activeChatFolderStrip.__centerChipRafSecondary = 0;
      }
    }

    function centerActiveChatFolderChip({ behavior = 'auto' } = {}) {
      const activeChatFolderStrip = getEl('activeChatFolderStrip', 'activeChatFolderStrip');
      const activeChatFolderBar = getEl('activeChatFolderBar', 'activeChatFolderBar');
      if (!isHTMLElement(activeChatFolderStrip) || !isHTMLElement(activeChatFolderBar)) return false;
      if (activeChatFolderBar.classList.contains('hidden')) return false;
      const activeChip = activeChatFolderStrip.querySelector('.active-chat-folder-chip.is-active[data-folder-chip], [data-folder-chip][aria-selected="true"]');
      if (!isHTMLElement(activeChip)) return false;
      const viewportWidth = Number(activeChatFolderStrip.clientWidth || 0);
      if (viewportWidth <= 0) return false;
      const maxScrollLeft = Math.max(0, Number(activeChatFolderStrip.scrollWidth || 0) - viewportWidth);
      const targetLeft = clamp(
        (Number(activeChip.offsetLeft || 0) + (Number(activeChip.offsetWidth || 0) / 2)) - (viewportWidth / 2),
        0,
        maxScrollLeft
      );
      const nextBehavior = behavior === 'smooth' && !prefersReducedMotion() && currentModalAnimation() !== 'none'
        ? 'smooth'
        : 'auto';
      if (Math.abs(Number(activeChatFolderStrip.scrollLeft || 0) - targetLeft) < 1) return true;
      if (typeof activeChatFolderStrip.scrollTo === 'function') {
        try {
          activeChatFolderStrip.scrollTo({ left: targetLeft, behavior: nextBehavior });
          if (nextBehavior === 'auto') activeChatFolderStrip.scrollLeft = targetLeft;
          return true;
        } catch {}
      }
      activeChatFolderStrip.scrollLeft = targetLeft;
      return true;
    }

    function getFolderStripMaxScrollLeft(strip) {
      if (!isHTMLElement(strip)) return 0;
      return Math.max(0, Number(strip.scrollWidth || 0) - Number(strip.clientWidth || 0));
    }

    function setFolderStripScrollLeft(strip, value) {
      if (!isHTMLElement(strip)) return false;
      const maxScrollLeft = getFolderStripMaxScrollLeft(strip);
      const nextLeft = clamp(Number(value || 0), 0, maxScrollLeft);
      if (Math.abs(Number(strip.scrollLeft || 0) - nextLeft) < 1) return false;
      strip.scrollLeft = nextLeft;
      return true;
    }

    function markManualFolderStripScroll() {
      chatFolderStripManualScrollUntil = Date.now() + 1500;
      cancelScheduledActiveChatFolderChipCenter();
    }

    function clearManualFolderStripScroll() {
      chatFolderStripManualScrollUntil = 0;
    }

    function bindActiveChatFolderStripMouseScroll(activeChatFolderStrip) {
      if (!isHTMLElement(activeChatFolderStrip) || activeChatFolderStrip.__folderStripMouseScrollBound) return false;
      activeChatFolderStrip.__folderStripMouseScrollBound = true;
      const dragState = {
        tracking: false,
        dragging: false,
        startX: 0,
        startY: 0,
        startScrollLeft: 0,
        suppressClickUntil: 0,
      };

      const clearDragState = () => {
        dragState.tracking = false;
        dragState.dragging = false;
        dragState.startX = 0;
        dragState.startY = 0;
        dragState.startScrollLeft = 0;
        activeChatFolderStrip.classList.remove('is-folder-strip-dragging');
      };

      const isScrollable = () => getFolderStripMaxScrollLeft(activeChatFolderStrip) > 0;

      activeChatFolderStrip.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || !isScrollable()) return;
        markManualFolderStripScroll();
        dragState.tracking = true;
        dragState.dragging = false;
        dragState.startX = Number(e.clientX || 0);
        dragState.startY = Number(e.clientY || 0);
        dragState.startScrollLeft = Number(activeChatFolderStrip.scrollLeft || 0);
      }, { passive: true });

      win.addEventListener('mousemove', (e) => {
        if (!dragState.tracking) return;
        if (typeof e.buttons === 'number' && e.buttons === 0) {
          clearDragState();
          return;
        }
        const dx = Number(e.clientX || 0) - dragState.startX;
        const dy = Number(e.clientY || 0) - dragState.startY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (!dragState.dragging) {
          if (absY > 8 && absY > absX) {
            clearDragState();
            return;
          }
          if (absX <= 4) return;
          dragState.dragging = true;
          activeChatFolderStrip.classList.add('is-folder-strip-dragging');
        }
        setFolderStripScrollLeft(activeChatFolderStrip, dragState.startScrollLeft - dx);
        if (e.cancelable) e.preventDefault();
      }, { passive: false });

      win.addEventListener('mouseup', (e) => {
        if (!dragState.tracking || e.button !== 0) return;
        const wasDragging = dragState.dragging;
        clearDragState();
        if (!wasDragging) return;
        dragState.suppressClickUntil = Date.now() + 400;
        if (e.cancelable) e.preventDefault();
      }, { passive: false });

      activeChatFolderStrip.addEventListener('click', (e) => {
        if (Date.now() > dragState.suppressClickUntil) return;
        e.preventDefault();
        e.stopPropagation();
      });

      activeChatFolderStrip.addEventListener('wheel', (e) => {
        if (!isScrollable()) return;
        const deltaX = Number(e.deltaX || 0);
        const deltaY = Number(e.deltaY || 0);
        const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
        if (!delta) return;
        markManualFolderStripScroll();
        const changed = setFolderStripScrollLeft(activeChatFolderStrip, Number(activeChatFolderStrip.scrollLeft || 0) + delta);
        if (changed && e.cancelable) e.preventDefault();
      }, { passive: false });

      return true;
    }

    function scheduleActiveChatFolderChipCenter({ behavior } = {}) {
      const activeChatFolderStrip = getEl('activeChatFolderStrip', 'activeChatFolderStrip');
      if (!isHTMLElement(activeChatFolderStrip)) return false;
      cancelScheduledActiveChatFolderChipCenter();
      if (behavior !== 'smooth' && Date.now() < chatFolderStripManualScrollUntil) return false;
      const nextBehavior = behavior === 'smooth' ? 'smooth' : consumePendingChatFolderChipCenterBehavior();
      activeChatFolderStrip.__centerChipRafPrimary = win.requestAnimationFrame(() => {
        activeChatFolderStrip.__centerChipRafPrimary = 0;
        activeChatFolderStrip.__centerChipRafSecondary = win.requestAnimationFrame(() => {
          activeChatFolderStrip.__centerChipRafSecondary = 0;
          centerActiveChatFolderChip({ behavior: nextBehavior });
        });
      });
      return true;
    }

    function renderChatFolderStripStructure({
      selectedFolderId = getRenderedChatFolderSelectionId(),
      forceVisible = chatFolderBarForceVisible,
    } = {}) {
      const activeChatFolderBar = getEl('activeChatFolderBar', 'activeChatFolderBar');
      const activeChatFolderName = getEl('activeChatFolderName', 'activeChatFolderName');
      const activeChatFolderStrip = getEl('activeChatFolderStrip', 'activeChatFolderStrip');
      if (!activeChatFolderBar || !activeChatFolderName || !activeChatFolderStrip) return false;
      const rows = activeChatFolderStripRows();
      const normalizedFolderId = normalizeChatFolderId(selectedFolderId);
      const shouldShow = shouldShowChatFolderBarForSelection(normalizedFolderId, { forceVisible });
      const signature = chatFolderStripStructureSignature(rows);
      activeChatFolderName.textContent = chatFolderStripLabelForSelection(normalizedFolderId, rows);
      if (activeChatFolderStrip.dataset.structureSignature !== signature) {
        activeChatFolderStrip.innerHTML = rows.map((row) => `
        <button
          type="button"
          class="active-chat-folder-chip"
          data-folder-chip="${Number(row.id || 0)}"
          role="tab"
          aria-selected="false"
        >${esc(row.name)}</button>
      `).join('');
        activeChatFolderStrip.dataset.structureSignature = signature;
      }
      activeChatFolderBar.classList.toggle('hidden', !shouldShow);
      if (!shouldShow) {
        cancelScheduledActiveChatFolderChipCenter();
        return false;
      }
      return true;
    }

    function syncActiveChatFolderStripState(
      selectedFolderId = getRenderedChatFolderSelectionId(),
      {
        centerBehavior,
        forceVisible = chatFolderBarForceVisible,
        skipStructure = false,
      } = {}
    ) {
      const activeChatFolderBar = getEl('activeChatFolderBar', 'activeChatFolderBar');
      const activeChatFolderName = getEl('activeChatFolderName', 'activeChatFolderName');
      const activeChatFolderStrip = getEl('activeChatFolderStrip', 'activeChatFolderStrip');
      if (!activeChatFolderBar || !activeChatFolderName || !activeChatFolderStrip) return false;
      const normalizedFolderId = normalizeChatFolderId(selectedFolderId);
      if (!skipStructure && !renderChatFolderStripStructure({ selectedFolderId: normalizedFolderId, forceVisible })) return false;
      if (activeChatFolderBar.classList.contains('hidden')) return false;
      const rows = activeChatFolderStripRows();
      activeChatFolderName.textContent = chatFolderStripLabelForSelection(normalizedFolderId, rows);
      activeChatFolderStrip.querySelectorAll('[data-folder-chip]').forEach((chip) => {
        if (!isHTMLElement(chip)) return;
        const isActive = Number(chip.dataset.folderChip || 0) === normalizedFolderId;
        chip.classList.toggle('is-active', isActive);
        chip.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      scheduleActiveChatFolderChipCenter({
        behavior: centerBehavior === 'smooth' ? 'smooth' : (centerBehavior === 'auto' ? 'auto' : consumePendingChatFolderChipCenterBehavior()),
      });
      return true;
    }

    function renderActiveChatFolderBar({
      selectedFolderId = getRenderedChatFolderSelectionId(),
      forceVisible = chatFolderBarForceVisible,
      centerBehavior,
    } = {}) {
      const normalizedFolderId = normalizeChatFolderId(selectedFolderId);
      if (!renderChatFolderStripStructure({ selectedFolderId: normalizedFolderId, forceVisible })) return false;
      return syncActiveChatFolderStripState(normalizedFolderId, {
        centerBehavior,
        forceVisible,
        skipStructure: true,
      });
    }

    function beginChatFolderStripPreview(folderId, { forceVisible = false, centerBehavior = 'auto' } = {}) {
      chatFolderStripPreviewFolderId = normalizeChatFolderId(folderId);
      chatFolderBarForceVisible = Boolean(forceVisible);
      renderActiveChatFolderBar({
        selectedFolderId: chatFolderStripPreviewFolderId,
        forceVisible: chatFolderBarForceVisible,
        centerBehavior,
      });
      return chatFolderStripPreviewFolderId;
    }

    function finalizeChatFolderStripPreview({ centerBehavior = 'auto' } = {}) {
      chatFolderStripPreviewFolderId = null;
      chatFolderBarForceVisible = false;
      renderActiveChatFolderBar({
        selectedFolderId: normalizeChatFolderId(store?.activeFolderId),
        forceVisible: false,
        centerBehavior,
      });
    }

    function renderFolderSelectableChatItem(chat, { selected = false } = {}) {
      const onlineUsers = typeof state.getOnlineUsers === 'function' ? state.getOnlineUsers() : new Set();
      const isOnline = chat?.type === 'private' && chat.private_user && onlineUsers.has(chat.private_user.id);
      const avatarHtml = typeof actions.chatItemAvatarHtml === 'function'
        ? actions.chatItemAvatarHtml(chat)
        : '<div class="chat-item-avatar">';
      const previewHtml = typeof actions.renderChatLastPreviewHtml === 'function'
        ? actions.renderChatLastPreviewHtml(chat)
        : esc(chat?.last_text || '');
      return `
      <div class="user-list-item${selected ? ' selected' : ''}" data-chat-id="${Number(chat?.id || 0)}">
        ${avatarHtml}
        ${isOnline ? '<div class="online-dot"></div>' : ''}
        </div>
        <div class="user-list-copy">
          <div class="name">${esc(chat?.name || 'Chat')}</div>
          <div class="user-list-meta">${previewHtml}</div>
        </div>
      </div>
    `;
    }

    function totalUnreadForFolder(folder) {
      return store?.totalUnreadForFolder?.(folder, getChats()) || 0;
    }

    function visibleChatCountForFolder(folder) {
      return store?.visibleChatCountForFolder?.(folder, getChats()) || 0;
    }

    function folderSummaryText(folder) {
      return store?.folderSummaryText?.(folder, getChats()) || '';
    }

    function renderChatFolderPicker() {
      const chatFolderPicker = getEl('chatFolderPicker', 'chatFolderPicker');
      if (!chatFolderPicker) return;
      const folders = store?.getFolders?.() || [];
      const activeFolderId = Number(store?.activeFolderId || 0);
      const showStripInAllChats = isChatFolderStripVisibleInAllChatsEnabled();
      const allUnread = totalUnreadForFolder(null);
      const allCount = visibleChatCountForFolder(null);
      const rows = [{
        id: ALL_CHATS_FOLDER_ID,
        name: '\u0412\u0441\u0435 \u0447\u0430\u0442\u044b',
        summary: `${allCount} \u0447\u0430\u0442\u043e\u0432${allUnread > 0 ? ` \u2022 ${allUnread} \u043d\u0435\u043f\u0440\u043e\u0447\u0438\u0442.` : ''}`,
        icon: chatFolderEmojiMarkup('all'),
        unread: allUnread,
        system: true,
        menu: false,
      }].concat(folders.map((folder) => ({
        id: Number(folder.id || 0),
        name: folder.name || '\u041F\u0430\u043F\u043A\u0430',
        summary: folderSummaryText(folder),
        icon: chatFolderEmojiMarkup(folder.kind),
        unread: totalUnreadForFolder(folder),
        system: Boolean(folder.system),
        menu: true,
      })));

      chatFolderPicker.innerHTML = `
      <div class="chat-context-menu-sheet">
        <div class="chat-context-menu-header">\u041F\u0430\u043F\u043A\u0438 \u0447\u0430\u0442\u043E\u0432</div>
        <div class="chat-folder-picker-list">
          ${rows.map((row) => `
            <div class="chat-folder-picker-row${activeFolderId === Number(row.id || 0) ? ' is-active' : ''}" data-folder-id="${Number(row.id || 0)}">
              <button type="button" class="chat-folder-picker-button" data-folder-select="${Number(row.id || 0)}">
                ${row.icon}
                <span class="chat-folder-picker-copy">
                  <span class="chat-folder-picker-name">${esc(row.name)}</span>
                  <span class="chat-folder-picker-summary">${esc(row.summary)}</span>
                </span>
                ${row.unread > 0 ? `<span class="unread-badge">${row.unread > 99 ? '99+' : row.unread}</span>` : ''}
              </button>
              ${Number(row.id || 0) === ALL_CHATS_FOLDER_ID ? `
                <button
                  type="button"
                  class="chat-folder-picker-strip-toggle${showStripInAllChats ? ' is-active' : ''}"
                  data-chat-folder-strip-toggle
                  aria-pressed="${showStripInAllChats ? 'true' : 'false'}"
                  aria-label="\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043F\u043E\u043B\u043E\u0441\u0443 \u043F\u0430\u043F\u043E\u043A"
                  ${chatFolderStripVisibilitySaveInFlight ? 'disabled' : ''}
                >
                  <span class="chat-folder-picker-strip-toggle-label">
                    <span>\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C</span>
                    <span>\u043F\u043E\u043B\u043E\u0441\u0443 \u043F\u0430\u043F\u043E\u043A</span>
                  </span>
                  <span class="chat-folder-picker-strip-toggle-switch" aria-hidden="true">
                    <span class="chat-folder-picker-strip-toggle-knob"></span>
                  </span>
                </button>
              ` : ''}
              ${row.menu ? `<button type="button" class="chat-folder-picker-menu-btn" data-folder-menu="${Number(row.id || 0)}" aria-label="Folder actions">&#8942;</button>` : ''}
            </div>
          `).join('') || '<div class="chat-folder-picker-empty">\u041F\u0430\u043F\u043E\u043A \u043F\u043E\u043A\u0430 \u043D\u0435\u0442</div>'}
        </div>
      </div>
    `;
      chatFolderPicker.setAttribute('aria-hidden', 'false');
      chatFolderPicker.setAttribute('role', 'menu');
    }

    function positionChatFolderPicker() {
      const chatFolderPicker = getEl('chatFolderPicker', 'chatFolderPicker');
      const chatFoldersBtn = getEl('chatFoldersBtn', 'chatFoldersBtn');
      if (!chatFolderPicker || chatFolderPicker.classList.contains('hidden') || !chatFoldersBtn) return;
      const buttonRect = chatFoldersBtn.getBoundingClientRect();
      const viewport = getFloatingViewportRect();
      const size = measureFloatingSurface(chatFolderPicker, 320, 420);
      const left = clamp(buttonRect.right - size.width, viewport.left + 8, viewport.right - size.width - 8);
      const top = clamp(buttonRect.bottom + 8, viewport.top + 8, viewport.bottom - size.height - 8);
      chatFolderPicker.style.right = 'auto';
      chatFolderPicker.style.bottom = 'auto';
      positionFloatingElement(chatFolderPicker, left, top);
    }

    function renderChatFolderContextMenu(folder) {
      const chatFolderContextMenu = getEl('chatFolderContextMenu', 'chatFolderContextMenu');
      if (!chatFolderContextMenu || !folder) return;
      const folderRows = store?.getFolders?.() || [];
      const index = folderRows.findIndex((entry) => Number(entry.id || 0) === Number(folder.id || 0));
      const menuActions = [
        {
          action: 'move-up-folder',
          icon: '&#8593;',
          label: t('Move up'),
          hidden: false,
          disabled: index <= 0,
        },
        {
          action: 'move-down-folder',
          icon: '&#8595;',
          label: t('Move down'),
          hidden: false,
          disabled: index < 0 || index >= folderRows.length - 1,
        },
        {
          action: 'rename-folder',
          icon: '&#9998;',
          label: t('Rename'),
          hidden: folder.kind !== 'custom',
          disabled: false,
        },
        {
          action: 'delete-folder',
          icon: '&#128465;',
          label: t('Delete'),
          hidden: folder.kind !== 'custom',
          disabled: false,
          danger: true,
        },
      ];
      chatFolderContextMenu.innerHTML = `
      <div class="chat-context-menu-sheet">
        <div class="chat-context-menu-header">${esc(folder.name || 'Folder')}</div>
        ${menuActions.filter((item) => !item.hidden).map((item) => `
          <button
            type="button"
            class="chat-context-menu-button${item.danger ? ' is-danger' : ''}"
            data-folder-action="${esc(item.action)}"
            ${item.disabled ? 'disabled' : ''}
          >
            <span class="chat-context-menu-icon" aria-hidden="true">${item.icon}</span>
            <span class="chat-context-menu-label">${esc(item.label)}</span>
          </button>
        `).join('')}
      </div>
    `;
      chatFolderContextMenu.setAttribute('aria-hidden', 'false');
      chatFolderContextMenu.setAttribute('role', 'menu');
      chatFolderContextMenu.dataset.folderId = String(folder.id);
    }

    function hideChatFolderContextMenu({ immediate = false } = {}) {
      const chatFolderContextMenuBackdrop = getEl('chatFolderContextMenuBackdrop', 'chatFolderContextMenuBackdrop');
      const chatFolderContextMenu = getEl('chatFolderContextMenu', 'chatFolderContextMenu');
      closeFloatingSurface(chatFolderContextMenuBackdrop, { immediate });
      closeFloatingSurface(chatFolderContextMenu, {
        immediate,
        onAfterClose: () => {
          if (chatFolderContextMenu) {
            chatFolderContextMenu.innerHTML = '';
            chatFolderContextMenu.setAttribute('aria-hidden', 'true');
            chatFolderContextMenu.style.left = '';
            chatFolderContextMenu.style.top = '';
          }
          chatFolderContextMenuState = null;
        },
      });
    }

    function positionChatFolderContextMenu() {
      const chatFolderContextMenu = getEl('chatFolderContextMenu', 'chatFolderContextMenu');
      if (!chatFolderContextMenuState || !chatFolderContextMenu || chatFolderContextMenu.classList.contains('hidden')) return;
      const anchor = chatFolderContextMenuState.anchor;
      if (!isHTMLElement(anchor) || !anchor.isConnected) {
        hideChatFolderContextMenu({ immediate: true });
        return;
      }
      const anchorRect = anchor.getBoundingClientRect();
      const viewport = getFloatingViewportRect();
      const size = measureFloatingSurface(chatFolderContextMenu, 220, 180);
      const left = clamp(anchorRect.right - size.width, viewport.left + 8, viewport.right - size.width - 8);
      const top = clamp(anchorRect.bottom + 6, viewport.top + 8, viewport.bottom - size.height - 8);
      chatFolderContextMenu.style.right = 'auto';
      chatFolderContextMenu.style.bottom = 'auto';
      positionFloatingElement(chatFolderContextMenu, left, top);
    }

    function getChatFolderContextMenuAnchor(folderId) {
      const chatFolderPicker = getEl('chatFolderPicker', 'chatFolderPicker');
      return chatFolderPicker?.querySelector(`[data-folder-menu="${Number(folderId || 0)}"]`) || null;
    }

    function refreshChatFolderContextMenu(folderId = chatFolderContextMenuState?.folderId) {
      const folder = store?.getFolderById?.(folderId);
      const anchor = getChatFolderContextMenuAnchor(folderId);
      if (!folder || !isHTMLElement(anchor)) {
        hideChatFolderContextMenu({ immediate: true });
        return;
      }
      chatFolderContextMenuState = {
        folderId: Number(folder.id || 0),
        anchor,
      };
      renderChatFolderContextMenu(folder);
      positionChatFolderContextMenu();
      win.requestAnimationFrame(() => {
        positionChatFolderContextMenu();
        getEl('chatFolderContextMenu', 'chatFolderContextMenu')?.querySelector('.chat-context-menu-button:not(:disabled)')?.focus({ preventScroll: true });
      });
    }

    function showChatFolderContextMenu(folderId, anchor) {
      const folder = store?.getFolderById?.(folderId);
      const chatFolderContextMenu = getEl('chatFolderContextMenu', 'chatFolderContextMenu');
      const chatFolderContextMenuBackdrop = getEl('chatFolderContextMenuBackdrop', 'chatFolderContextMenuBackdrop');
      if (!folder || !chatFolderContextMenu || !chatFolderContextMenuBackdrop) return;
      const normalizedFolderId = Number(folder.id || 0);
      if (isFloatingSurfaceVisible(chatFolderContextMenu) && Number(chatFolderContextMenuState?.folderId || 0) === normalizedFolderId) {
        hideChatFolderContextMenu();
        return;
      }
      hideChatFolderContextMenu({ immediate: true });
      chatFolderContextMenuState = {
        folderId: normalizedFolderId,
        anchor,
      };
      renderChatFolderContextMenu(folder);
      positionChatFolderContextMenu();
      openFloatingSurface(chatFolderContextMenuBackdrop);
      openFloatingSurface(chatFolderContextMenu);
      win.requestAnimationFrame(() => {
        positionChatFolderContextMenu();
        chatFolderContextMenu.querySelector('.chat-context-menu-button:not(:disabled)')?.focus({ preventScroll: true });
      });
    }

    function hideChatFolderPicker({ immediate = false } = {}) {
      const chatFolderPicker = getEl('chatFolderPicker', 'chatFolderPicker');
      const chatFolderPickerBackdrop = getEl('chatFolderPickerBackdrop', 'chatFolderPickerBackdrop');
      if (!chatFolderPicker) return Promise.resolve();
      hideChatFolderContextMenu({ immediate: true });
      closeFloatingSurface(chatFolderPickerBackdrop, { immediate });
      return new Promise((resolve) => {
        closeFloatingSurface(chatFolderPicker, {
          immediate,
          onAfterClose: () => {
            if (chatFolderPicker) {
              chatFolderPicker.innerHTML = '';
              chatFolderPicker.setAttribute('aria-hidden', 'true');
              chatFolderPicker.style.left = '';
              chatFolderPicker.style.top = '';
              chatFolderPicker.style.right = '';
              chatFolderPicker.style.bottom = '';
            }
            chatFolderPickerState = null;
            resolve();
          },
        });
      });
    }

    function showChatFolderPicker(opener = getEl('chatFoldersBtn', 'chatFoldersBtn')) {
      const chatFolderPicker = getEl('chatFolderPicker', 'chatFolderPicker');
      const chatFolderPickerBackdrop = getEl('chatFolderPickerBackdrop', 'chatFolderPickerBackdrop');
      if (!chatFolderPicker || !chatFolderPickerBackdrop) return;
      if (isFloatingSurfaceVisible(chatFolderPicker)) {
        hideChatFolderPicker();
        return;
      }
      if (!store?.loadedOnce && typeof actions.loadChatFolders === 'function') {
        actions.loadChatFolders({ silent: true, renderAfterLoad: false }).catch(() => {});
      }
      actions.hideChatContextMenu?.({ immediate: true });
      actions.hideMediaContextMenu?.({ immediate: true });
      hideChatFolderPicker({ immediate: true });
      chatFolderPickerState = { opener };
      renderChatFolderPicker();
      positionChatFolderPicker();
      openFloatingSurface(chatFolderPickerBackdrop);
      openFloatingSurface(chatFolderPicker);
      win.requestAnimationFrame(() => {
        positionChatFolderPicker();
        chatFolderPicker.querySelector('.chat-folder-picker-button')?.focus({ preventScroll: true });
      });
    }

    function refreshVisibleContextMenu() {
      if (isFloatingSurfaceVisible(getEl('chatFolderContextMenu', 'chatFolderContextMenu')) && chatFolderContextMenuState?.folderId) {
        refreshChatFolderContextMenu(chatFolderContextMenuState.folderId);
        return true;
      }
      return false;
    }

    function bindEvents({ bindTouchSafeButtonActivation } = {}) {
      const chatFoldersBtn = getEl('chatFoldersBtn', 'chatFoldersBtn');
      const activeChatFolderBar = getEl('activeChatFolderBar', 'activeChatFolderBar');
      const activeChatFolderStrip = getEl('activeChatFolderStrip', 'activeChatFolderStrip');
      const chatFolderPicker = getEl('chatFolderPicker', 'chatFolderPicker');
      const chatFolderPickerBackdrop = getEl('chatFolderPickerBackdrop', 'chatFolderPickerBackdrop');
      const chatFolderContextMenu = getEl('chatFolderContextMenu', 'chatFolderContextMenu');
      const chatFolderContextMenuBackdrop = getEl('chatFolderContextMenuBackdrop', 'chatFolderContextMenuBackdrop');
      const chatList = getEl('chatList', 'chatList');
      const bindTouchSafe = typeof bindTouchSafeButtonActivation === 'function'
        ? bindTouchSafeButtonActivation
        : (button, onActivate) => button?.addEventListener('click', onActivate);

      bindTouchSafe(chatFoldersBtn, () => {
        actions.animateChatHeaderActionButton?.('#chatFoldersBtn');
        showChatFolderPicker(chatFoldersBtn);
      });

      bindActiveChatFolderStripMouseScroll(activeChatFolderStrip);

      activeChatFolderBar?.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-folder-chip]');
        if (!chip) return;
        clearManualFolderStripScroll();
        const folderId = Number(chip.dataset.folderChip || 0);
        Promise.resolve(actions.transitionToChatFolder?.(folderId, { persist: true })).catch((error) => {
          console.warn('Failed to switch chat folder', error);
          actions.showCenterToast?.(error?.message || 'Could not open folder');
        });
      });

      chatFolderPicker?.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });
      chatFolderPicker?.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      chatFolderPicker?.addEventListener('touchstart', (e) => {
        e.stopPropagation();
      }, { passive: true });
      chatFolderPicker?.addEventListener('click', (e) => {
        e.stopPropagation();
        const stripToggle = e.target.closest('[data-chat-folder-strip-toggle]');
        if (stripToggle) {
          const nextValue = !isChatFolderStripVisibleInAllChatsEnabled();
          saveChatFolderStripVisibilityInAllChats(nextValue).catch((error) => {
            console.warn('Failed to update chat folder strip visibility', error);
            actions.showCenterToast?.(error?.message || 'Could not update setting');
          });
          return;
        }
        const menuBtn = e.target.closest('[data-folder-menu]');
        if (menuBtn) {
          const folderId = Number(menuBtn.dataset.folderMenu || 0);
          if (folderId) showChatFolderContextMenu(folderId, menuBtn);
          return;
        }
        const selectBtn = e.target.closest('[data-folder-select]');
        if (!selectBtn) return;
        const folderId = Number(selectBtn.dataset.folderSelect || 0);
        Promise.resolve(actions.transitionToChatFolder?.(folderId, { persist: true, closePicker: true })).catch((error) => {
          console.warn('Failed to switch chat folder', error);
          actions.showCenterToast?.(error?.message || 'Could not open folder');
        });
      });
      chatFolderPickerBackdrop?.addEventListener('click', () => {
        hideChatFolderPicker();
      });
      chatFolderPickerBackdrop?.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        hideChatFolderPicker();
      });
      chatFolderContextMenu?.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });
      chatFolderContextMenu?.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      chatFolderContextMenu?.addEventListener('touchstart', (e) => {
        e.stopPropagation();
      }, { passive: true });
      chatFolderContextMenu?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const btn = e.target.closest('.chat-context-menu-button[data-folder-action]');
        if (!btn || btn.disabled || !chatFolderContextMenuState?.folderId) return;
        const folderId = Number(chatFolderContextMenuState.folderId || 0);
        const action = btn.dataset.folderAction || '';
        const keepOpen = action === 'move-up-folder' || action === 'move-down-folder';
        if (!keepOpen) hideChatFolderContextMenu();
        try {
          await actions.handleFolderContextAction?.(action, folderId);
        } catch (error) {
          if (keepOpen) refreshChatFolderContextMenu(folderId);
          console.warn('Failed to handle folder menu action', error);
          actions.showCenterToast?.(error?.message || 'Could not update folder');
        }
      });
      chatFolderContextMenuBackdrop?.addEventListener('click', () => {
        hideChatFolderContextMenu();
      });
      chatFolderContextMenuBackdrop?.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        hideChatFolderContextMenu();
      });

      const syncChatFolderLayout = () => {
        if (isFloatingSurfaceVisible(getEl('chatFolderPicker', 'chatFolderPicker'))) positionChatFolderPicker();
        if (isFloatingSurfaceVisible(getEl('chatFolderContextMenu', 'chatFolderContextMenu'))) positionChatFolderContextMenu();
        if (shouldShowActiveChatFolderBar()) scheduleActiveChatFolderChipCenter({ behavior: 'auto' });
      };
      win.addEventListener('resize', syncChatFolderLayout, { passive: true });
      win.visualViewport?.addEventListener('resize', syncChatFolderLayout);
      win.visualViewport?.addEventListener('scroll', syncChatFolderLayout);
      chatList?.addEventListener('scroll', () => {
        if (isFloatingSurfaceVisible(getEl('chatFolderPicker', 'chatFolderPicker'))) hideChatFolderPicker({ immediate: true });
        else if (isFloatingSurfaceVisible(getEl('chatFolderContextMenu', 'chatFolderContextMenu'))) hideChatFolderContextMenu({ immediate: true });
      }, { passive: true });
    }

    return {
      chatFolderIconEmoji,
      chatFolderEmojiMarkup,
      chatFolderIconMarkup,
      shouldShowActiveChatFolderBar,
      activeChatFolderStripRows,
      getRenderedChatFolderSelectionId,
      isChatFolderStripVisibleInAllChatsEnabled,
      syncChatFolderPickerAllChatsToggleState,
      applyChatFolderStripVisibilityInAllChats,
      saveChatFolderStripVisibilityInAllChats,
      shouldShowChatFolderBarForSelection,
      chatFolderStripStructureSignature,
      chatFolderStripLabelForSelection,
      setPendingChatFolderChipCenterBehavior,
      cancelScheduledActiveChatFolderChipCenter,
      centerActiveChatFolderChip,
      scheduleActiveChatFolderChipCenter,
      renderChatFolderStripStructure,
      syncActiveChatFolderStripState,
      renderActiveChatFolderBar,
      beginChatFolderStripPreview,
      finalizeChatFolderStripPreview,
      renderFolderSelectableChatItem,
      renderChatFolderPicker,
      positionChatFolderPicker,
      showChatFolderPicker,
      hideChatFolderPicker,
      renderChatFolderContextMenu,
      positionChatFolderContextMenu,
      refreshChatFolderContextMenu,
      showChatFolderContextMenu,
      hideChatFolderContextMenu,
      getContextMenuState: () => (chatFolderContextMenuState ? { ...chatFolderContextMenuState } : null),
      getPickerState: () => (chatFolderPickerState ? { ...chatFolderPickerState } : null),
      refreshVisibleContextMenu,
      bindEvents,
    };
  }

  foldersRoot.ui = {
    createChatFolderUi,
  };
})();
