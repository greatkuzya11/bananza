(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const foldersRoot = root.folders = root.folders || {};

  function createMobileGesturesController(options = {}) {
    const windowRef = options.window || window;
    const dom = options.dom || {};
    const constants = options.constants || {};
    const actions = options.actions || {};

    let folderSwipeBound = false;
    let chatListPullBound = false;

    const getNumber = (name, fallback = 0) => Number(constants[name]) || fallback;

    function bindFolderSwipe() {
      if (folderSwipeBound) return false;
      folderSwipeBound = true;

      const {
        chatFolderListSurface,
        chatList,
        sidebar,
        chatSearch,
      } = dom;
      if (!chatFolderListSurface || !chatList || !sidebar) return false;

      const state = {
        tracking: false,
        dragging: false,
        switching: false,
        inputType: '',
        touchId: null,
        startX: 0,
        startY: 0,
        dx: 0,
      };

      const clearTracking = () => {
        state.tracking = false;
        state.dragging = false;
        state.inputType = '';
        state.touchId = null;
        state.startX = 0;
        state.startY = 0;
        state.dx = 0;
      };

      const getTrackedTouch = (touches) => {
        if (!touches?.length) return null;
        if (state.touchId == null) return touches[0] || null;
        return Array.from(touches).find((touch) => Number(touch.identifier) === Number(state.touchId)) || null;
      };

      const isBlockedStartTarget = (target) => {
        const blocked = target?.closest?.('button, a, input, textarea, select, label, [contenteditable="true"], .chat-context-menu, .modal');
        return Boolean(blocked);
      };

      const isAllowedStartTarget = (target) => {
        if (!target || !chatFolderListSurface.contains(target)) return false;
        return !isBlockedStartTarget(target);
      };

      const isSwipeAvailable = (inputType = state.inputType || 'touch') => {
        const mobileLayout = Boolean(actions.isMobileLayoutViewport?.());
        return (inputType === 'mouse' || mobileLayout)
        && !sidebar.classList.contains('sidebar-hidden')
        && (!mobileLayout || !sidebar.classList.contains('mobile-scene-hidden'))
        && !actions.isMobileViewportLayoutLocked?.()
        && !state.switching
        && !String(chatSearch?.value || '').trim()
        && actions.getFolders?.().length > 0
        && actions.getChatFolderPageRows?.().length > 1;
      };

      const dampEdgeOffset = (dx) => actions.clamp?.(
        Math.round(dx * getNumber('CHAT_FOLDER_SWIPE_EDGE_DAMPING')),
        -getNumber('CHAT_FOLDER_SWIPE_EDGE_MAX_PX'),
        getNumber('CHAT_FOLDER_SWIPE_EDGE_MAX_PX')
      ) ?? dx;

      const finishSwipeAsync = async (promise) => {
        state.switching = true;
        try {
          await promise;
        } catch (error) {
          console.warn('Failed to swipe chat folder', error);
          actions.showCenterToast?.(error?.message || 'Could not open folder');
          actions.resetChatFolderSwipeSurface?.();
        } finally {
          clearTracking();
          state.switching = false;
        }
      };

      const beginGesture = ({ inputType, clientX, clientY, touchId = null }) => {
        state.tracking = true;
        state.dragging = false;
        state.inputType = inputType;
        state.touchId = touchId == null ? null : Number(touchId);
        state.startX = clientX;
        state.startY = clientY;
        state.dx = 0;
      };

      const moveGesture = (clientX, clientY, e) => {
        if (!state.tracking || state.switching) return;
        const inputType = state.inputType || 'touch';
        const dx = clientX - state.startX;
        const dy = clientY - state.startY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        const swipeStartPx = getNumber('CHAT_FOLDER_SWIPE_START_PX');

        if (!state.dragging) {
          if (absY > swipeStartPx && absY >= absX) {
            clearTracking();
            return;
          }
          if (absX <= swipeStartPx || absX <= absY + 4) return;
          state.dragging = true;
          actions.clearChatContextLongPress?.();
          actions.resetChatFolderSwipeSurface?.();
        }

        if (!isSwipeAvailable(inputType)) {
          clearTracking();
          actions.resetChatFolderSwipeSurface?.();
          return;
        }

        state.dx = dx;
        const direction = dx < 0 ? 1 : -1;
        const adjacent = actions.getAdjacentChatFolderPage?.(direction);
        if (adjacent && actions.canAnimateChatFolderSwipe?.()) {
          const pager = actions.prepareChatFolderSwipePager?.(direction, adjacent.id);
          if (pager) actions.setChatFolderSwipeOffset?.(pager.baseOffset + dx, 'dragging');
        } else {
          actions.destroyChatFolderSwipePager?.();
          if (actions.canAnimateChatFolderSwipe?.()) {
            actions.setChatFolderSwipeOffset?.(adjacent ? dx : dampEdgeOffset(dx), 'dragging');
          }
        }
        if (e.cancelable) e.preventDefault();
      };

      const suppressFollowupTap = (inputType) => {
        if (inputType === 'mouse') {
          actions.suppressNextChatItemTap?.({ pointerType: 'mouse' });
          return;
        }
        actions.suppressNextChatItemTap?.();
      };

      const finishGesture = (e) => {
        if (!state.tracking) return;
        const wasDragging = state.dragging;
        const inputType = state.inputType || 'touch';
        const dx = state.dx;
        clearTracking();

        if (!wasDragging) {
          actions.resetChatFolderSwipeSurface?.();
          return;
        }

        suppressFollowupTap(inputType);
        if (e?.cancelable) e.preventDefault();

        const direction = dx < 0 ? 1 : -1;
        const adjacent = actions.getAdjacentChatFolderPage?.(direction);
        const shouldSwitch = Boolean(adjacent && Math.abs(dx) >= (actions.getChatFolderSwipeCommitDistance?.() || 0));
        const swipePromise = shouldSwitch
          ? actions.transitionToChatFolder?.(adjacent.id, { persist: true, swipeDirection: direction })
          : actions.snapChatFolderSwipeBack?.();
        finishSwipeAsync(swipePromise);
      };

      chatFolderListSurface.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1 || !isSwipeAvailable('touch') || !isAllowedStartTarget(e.target)) return;
        const touch = e.touches[0];
        beginGesture({
          inputType: 'touch',
          touchId: touch.identifier,
          clientX: touch.clientX,
          clientY: touch.clientY,
        });
      }, { passive: true });

      chatFolderListSurface.addEventListener('touchmove', (e) => {
        if (!state.tracking || state.inputType !== 'touch' || state.switching || e.touches.length !== 1) return;
        const touch = getTrackedTouch(e.touches);
        if (!touch) return;
        moveGesture(touch.clientX, touch.clientY, e);
      }, { passive: false });

      chatFolderListSurface.addEventListener('touchend', finishGesture, { passive: false });
      chatFolderListSurface.addEventListener('touchcancel', () => {
        if (!state.tracking || state.inputType !== 'touch') return;
        const wasDragging = state.dragging;
        clearTracking();
        if (!wasDragging) {
          actions.resetChatFolderSwipeSurface?.();
          return;
        }
        suppressFollowupTap('touch');
        finishSwipeAsync(actions.snapChatFolderSwipeBack?.());
      }, { passive: true });

      const beginMouseGesture = (e) => {
        if (e.button !== 0 || state.tracking || !isSwipeAvailable('mouse') || !isAllowedStartTarget(e.target)) return;
        beginGesture({
          inputType: 'mouse',
          clientX: e.clientX,
          clientY: e.clientY,
        });
        if (e.cancelable) e.preventDefault();
      };

      chatFolderListSurface.addEventListener('mousedown', beginMouseGesture, { passive: false });

      windowRef.addEventListener('mousemove', (e) => {
        if (!state.tracking || state.inputType !== 'mouse' || state.switching) return;
        if (typeof e.buttons === 'number' && e.buttons === 0) {
          finishGesture(e);
          return;
        }
        moveGesture(e.clientX, e.clientY, e);
      }, { passive: false });

      windowRef.addEventListener('mouseup', (e) => {
        if (!state.tracking || state.inputType !== 'mouse' || e.button !== 0) return;
        finishGesture(e);
      }, { passive: false });

      windowRef.addEventListener('resize', () => {
        if (!state.tracking && !state.switching) return;
        clearTracking();
        state.switching = false;
        actions.resetChatFolderSwipeSurface?.();
      }, { passive: true });

      return true;
    }

    function bindChatListPullRefresh() {
      if (chatListPullBound) return false;
      chatListPullBound = true;

      const {
        chatList,
        sidebar,
        chatListPullIndicator,
        chatListPullLabel,
        chatFolderListSurface,
      } = dom;
      if (!chatList || !sidebar || !chatListPullIndicator || !chatListPullLabel) return false;
      chatListPullIndicator.classList.remove('hidden');
      chatListPullIndicator.setAttribute('aria-hidden', 'true');

      const state = {
        tracking: false,
        engaged: false,
        refreshing: false,
        startY: 0,
        offset: 0,
      };
      let resetPullUiTimer = null;

      const translate = (key) => actions.tx?.(key) || key;
      const clearResetPullUiTimer = () => {
        if (!resetPullUiTimer) return;
        windowRef.clearTimeout(resetPullUiTimer);
        resetPullUiTimer = null;
      };

      const setChatListPullLabel = (key) => {
        chatListPullLabel.dataset.i18n = key;
        chatListPullLabel.textContent = translate(key);
      };
      setChatListPullLabel('Pull to refresh');

      const isSidebarListPullAvailable = () => (
        actions.isMobileLayoutViewport?.()
        && !sidebar.classList.contains('sidebar-hidden')
        && !state.refreshing
        && !actions.hasActiveChatListRequest?.()
      );

      const positionChatListPullIndicator = () => {
        const anchor = chatListPullIndicator.offsetParent || chatFolderListSurface || sidebar;
        const anchorRect = anchor.getBoundingClientRect();
        const listRect = chatList.getBoundingClientRect();
        const chipRect = chatListPullIndicator.querySelector('.chat-list-pull-chip')?.getBoundingClientRect?.();
        const chipHeight = Math.max(28, Math.round(chipRect?.height || 34));
        const anchorHeight = Math.max(0, Math.round(anchor.clientHeight || anchorRect.height || 0));
        const minTop = 6;
        const listTop = Math.max(0, Math.round(listRect.top - anchorRect.top));
        const gap = Math.max(0, state.offset);
        const centeredInGap = listTop + Math.max(minTop, Math.round((gap - chipHeight) / 2));
        const maxTop = anchorHeight > 0 ? Math.max(minTop, anchorHeight - chipHeight - minTop) : centeredInGap;
        const top = Math.max(minTop, Math.min(maxTop, centeredInGap));
        chatListPullIndicator.style.top = `${top}px`;
      };

      const setChatListPullUi = (offset, { dragging = false, refreshing = false } = {}) => {
        const ready = !refreshing && offset >= getNumber('CHAT_LIST_PULL_THRESHOLD');
        state.offset = Math.max(0, Math.round(offset));
        clearResetPullUiTimer();
        positionChatListPullIndicator();
        chatList.style.transition = dragging ? 'none' : 'padding-top .18s cubic-bezier(.22, .84, .24, 1)';
        chatList.style.paddingTop = `${state.offset}px`;
        chatListPullIndicator.setAttribute('aria-hidden', 'false');
        chatListPullIndicator.style.transform = 'translateY(0)';
        sidebar.classList.toggle('is-chat-list-pull-visible', state.offset > 0 || refreshing);
        sidebar.classList.toggle('is-chat-list-pull-ready', ready);
        sidebar.classList.toggle('is-chat-list-refreshing', refreshing);
        setChatListPullLabel(refreshing
          ? 'Refreshing chats...'
          : ready
            ? 'Release to refresh'
            : 'Pull to refresh');
      };

      const resetChatListPullUi = ({ immediate = false } = {}) => {
        clearResetPullUiTimer();
        state.engaged = false;
        state.offset = 0;
        sidebar.classList.remove('is-chat-list-pull-ready');
        if (immediate) {
          sidebar.classList.remove('is-chat-list-pull-visible', 'is-chat-list-refreshing');
          chatList.style.transition = '';
          chatList.style.paddingTop = '';
          chatListPullIndicator.style.transform = '';
          chatListPullIndicator.setAttribute('aria-hidden', 'true');
          setChatListPullLabel('Pull to refresh');
          return;
        }
        chatList.style.transition = 'padding-top .18s cubic-bezier(.22, .84, .24, 1)';
        chatList.style.paddingTop = '0px';
        chatListPullIndicator.style.transform = '';
        chatListPullIndicator.setAttribute('aria-hidden', 'true');
        setChatListPullLabel('Pull to refresh');
        resetPullUiTimer = windowRef.setTimeout(() => {
          if (state.tracking || state.refreshing) return;
          sidebar.classList.remove('is-chat-list-pull-visible', 'is-chat-list-refreshing');
          chatList.style.transition = '';
          chatList.style.paddingTop = '';
          resetPullUiTimer = null;
        }, 190);
      };

      const clearPullTracking = () => {
        state.tracking = false;
        state.startY = 0;
      };

      const startChatListPullRefresh = async () => {
        if (state.refreshing) return;
        state.refreshing = true;
        setChatListPullUi(getNumber('CHAT_LIST_PULL_REFRESH_OFFSET'), { refreshing: true });
        setChatListPullLabel('Reloading app...');
        windowRef.requestAnimationFrame(() => {
          windowRef.setTimeout(() => {
            windowRef.location.reload();
          }, 80);
        });
      };

      const dampPullDistance = (distance) => Math.min(
        getNumber('CHAT_LIST_PULL_MAX_OFFSET'),
        Math.round(distance * 0.62)
      );

      chatList.addEventListener('touchstart', (e) => {
        if (!isSidebarListPullAvailable() || e.touches.length !== 1) return;
        if (chatList.scrollTop > 0) return;
        state.tracking = true;
        state.engaged = false;
        state.startY = e.touches[0].clientY;
        state.offset = 0;
        positionChatListPullIndicator();
      }, { passive: true });

      chatList.addEventListener('touchmove', (e) => {
        if (!state.tracking || state.refreshing || e.touches.length !== 1) return;
        const delta = e.touches[0].clientY - state.startY;
        if (!state.engaged && delta <= getNumber('CHAT_LIST_PULL_TRIGGER_PX')) {
          if (delta < 0) clearPullTracking();
          return;
        }
        if (chatList.scrollTop > 0 || delta <= 0 || !isSidebarListPullAvailable()) {
          clearPullTracking();
          resetChatListPullUi({ immediate: true });
          return;
        }
        state.engaged = true;
        if (e.cancelable) e.preventDefault();
        setChatListPullUi(dampPullDistance(delta), { dragging: true });
      }, { passive: false });

      const handleChatListPullEnd = async () => {
        if (!state.tracking) return;
        const shouldRefresh = state.engaged && state.offset >= getNumber('CHAT_LIST_PULL_THRESHOLD') && !state.refreshing;
        clearPullTracking();
        if (shouldRefresh) {
          await startChatListPullRefresh();
          return;
        }
        resetChatListPullUi();
      };

      chatList.addEventListener('touchend', () => {
        handleChatListPullEnd().catch(() => {
          state.refreshing = false;
          resetChatListPullUi();
        });
      }, { passive: true });
      chatList.addEventListener('touchcancel', () => {
        clearPullTracking();
        if (!state.refreshing) resetChatListPullUi();
      }, { passive: true });

      const syncChatListPullLayout = () => {
        if (!sidebar.classList.contains('is-chat-list-pull-visible') && !state.refreshing) return;
        positionChatListPullIndicator();
      };
      windowRef.addEventListener('resize', syncChatListPullLayout, { passive: true });
      windowRef.visualViewport?.addEventListener('resize', syncChatListPullLayout);
      windowRef.visualViewport?.addEventListener('scroll', syncChatListPullLayout);

      return true;
    }

    function bindEvents() {
      return {
        folderSwipe: bindFolderSwipe(),
        chatListPullRefresh: bindChatListPullRefresh(),
      };
    }

    return {
      bindEvents,
      bindFolderSwipe,
      bindChatListPullRefresh,
    };
  }

  foldersRoot.createMobileGesturesController = createMobileGesturesController;
})();
