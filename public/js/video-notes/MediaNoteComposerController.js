(function () {
  'use strict';

  const ns = window.BananzaVideoNotes = window.BananzaVideoNotes || {};

  const STORAGE_KEY = 'bananza-media-note-mode';
  const HOLD_DELAY_MS = 280;
  const VIEWPORT_GAP = 12;
  const MENU_GAP = 10;

  const TEXT = {
    audioTitle: '\u0410\u0443\u0434\u0438\u043e',
    audioSubtitle: '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435',
    videoTitle: '\u0412\u0438\u0434\u0435\u043e',
    videoSubtitle: '\u0412\u0438\u0434\u0435\u043e-\u0437\u0430\u043c\u0435\u0442\u043a\u0430',
    recordingVideo: '\u0418\u0434\u0435\u0442 \u0437\u0430\u043f\u0438\u0441\u044c \u0432\u0438\u0434\u0435\u043e',
    holdVideo: '\u0423\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0439\u0442\u0435 \u0434\u043b\u044f \u0437\u0430\u043f\u0438\u0441\u0438 \u0432\u0438\u0434\u0435\u043e',
    holdAudio: '\u0423\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0439\u0442\u0435 \u0434\u043b\u044f \u0437\u0430\u043f\u0438\u0441\u0438 \u0430\u0443\u0434\u0438\u043e',
    videoNote: '\u0412\u0438\u0434\u0435\u043e-\u0437\u0430\u043c\u0435\u0442\u043a\u0430',
    voiceNote: '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435',
    startError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043d\u0430\u0447\u0430\u0442\u044c \u0437\u0430\u043f\u0438\u0441\u044c',
    sendError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435',
  };

  function parseDurationMs(value) {
    return String(value || '0s')
      .split(',')
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed) return 0;
        if (trimmed.endsWith('ms')) return Number(trimmed.slice(0, -2)) || 0;
        if (trimmed.endsWith('s')) return (Number(trimmed.slice(0, -1)) || 0) * 1000;
        return Number(trimmed) || 0;
      })
      .reduce((max, next) => Math.max(max, next), 0);
  }

  class MediaNoteComposerController {
      constructor({ bridge, audioAdapter, videoRecorder } = {}) {
        this.bridge = bridge || window.BananzaAppBridge || null;
        this.audioAdapter = audioAdapter;
        this.videoRecorder = videoRecorder;
        this.mode = localStorage.getItem(STORAGE_KEY) === 'video' ? 'video' : 'audio';
        this.holdTimer = null;
        this.menuCloseTimer = null;
        this.menuOpenFrame = null;
        this.suppressNextClick = false;
        this.pointerId = null;
        this.touchIdentifier = null;
        this.activeGestureSource = '';
        this.gestureMode = '';
        this.preparedMode = '';
        this.ignoreSyntheticPointerUntil = 0;
        this.activeRecorderStartPromise = null;
        this.activeMode = '';
        this.menuEl = null;
        this.initialized = false;
        this.lastState = {};
      }

    getBridge() {
      return this.bridge || window.BananzaAppBridge || null;
    }

      ownsComposer() {
        return true;
      }

      isIosGestureTarget() {
        return Boolean(this.getBridge()?.isIosWebkit?.() && window.innerWidth <= 768);
      }

      shouldIgnorePointerEvent(event) {
        if (!this.isIosGestureTarget()) return false;
        if (event?.pointerType === 'touch') return true;
        return Date.now() < this.ignoreSyntheticPointerUntil;
      }

      resetGestureSession({ keepPreparedMode = false } = {}) {
        this.pointerId = null;
        this.touchIdentifier = null;
        this.activeGestureSource = '';
        this.gestureMode = '';
        if (!keepPreparedMode) this.preparedMode = '';
      }

    init() {
      if (this.initialized) return;
      const sendBtn = this.getBridge()?.getDom?.()?.sendBtn;
      if (!sendBtn) return;
      this.initialized = true;
      this.ensureMenu();

      sendBtn.addEventListener('click', (event) => {
        if (!this.suppressNextClick) return;
        this.suppressNextClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
        sendBtn.blur();
      }, true);

        sendBtn.addEventListener('pointerdown', (event) => this.handlePointerDown(event), { passive: false });
        sendBtn.addEventListener('pointerup', (event) => this.handlePointerUp(event), { passive: false });
        sendBtn.addEventListener('pointercancel', (event) => this.handlePointerCancel(event), { passive: false });
        sendBtn.addEventListener('pointerleave', () => {
          if (!this.activeMode && this.activeGestureSource !== 'touch') this.cancelHold();
        });
        sendBtn.addEventListener('touchstart', (event) => this.handleTouchStart(event), { passive: false });
        document.addEventListener('touchend', (event) => this.handleTouchEnd(event), { passive: false });
        document.addEventListener('touchcancel', (event) => this.handleTouchCancel(event), { passive: false });

        document.addEventListener('pointerdown', (event) => {
          if (!this.menuEl || this.menuEl.classList.contains('hidden')) return;
          const sendButton = this.getBridge()?.getDom?.()?.sendBtn;
          if (this.menuEl.contains(event.target) || sendButton?.contains(event.target)) return;
          this.closeMenu();
        });

      this.refreshComposerState();
    }

    ensureMenu() {
      if (this.menuEl) return this.menuEl;
      const menu = document.createElement('div');
      menu.className = 'media-note-mode-menu hidden';
      menu.setAttribute('aria-hidden', 'true');
      menu.innerHTML = `
        <button type="button" class="media-note-mode-item" data-mode="audio">
          <span class="media-note-mode-item-icon" aria-hidden="true">&#127897;</span>
          <span class="media-note-mode-item-copy">
            <strong>${TEXT.audioTitle}</strong>
            <small>${TEXT.audioSubtitle}</small>
          </span>
        </button>
        <button type="button" class="media-note-mode-item" data-mode="video">
          <span class="media-note-mode-item-icon" aria-hidden="true">&#127909;</span>
          <span class="media-note-mode-item-copy">
            <strong>${TEXT.videoTitle}</strong>
            <small>${TEXT.videoSubtitle}</small>
          </span>
        </button>
      `;
      document.body.appendChild(menu);
      menu.querySelectorAll('[data-mode]').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          this.setMode(button.dataset.mode);
        });
      });
      this.menuEl = menu;
      return menu;
    }

    setMode(mode) {
      this.mode = mode === 'video' ? 'video' : 'audio';
      localStorage.setItem(STORAGE_KEY, this.mode);
      this.closeMenu();
      this.refreshComposerState();
    }

    refreshComposerState(state = null) {
      if (state) this.lastState = { ...state };
      const sendBtn = this.getBridge()?.getDom?.()?.sendBtn;
      if (!sendBtn) return;
      const showMicMode = state?.showMicMode != null ? Boolean(state.showMicMode) : sendBtn.classList.contains('is-mic-mode');
      const videoRecording = this.activeMode === 'video' || this.videoRecorder?.isRecording?.();
      sendBtn.dataset.mediaNoteMode = this.mode;
      sendBtn.classList.toggle('is-video-note-mode', showMicMode && this.mode === 'video');
      sendBtn.classList.toggle('is-audio-note-mode', showMicMode && this.mode !== 'video');
      sendBtn.classList.toggle('is-recording', Boolean(state?.isRecording) || videoRecording);
      if (!showMicMode) {
        this.closeMenu({ immediate: true });
        return;
      }
      if (videoRecording) sendBtn.title = TEXT.recordingVideo;
      else if (this.activeMode === 'video') sendBtn.title = TEXT.holdVideo;
      else if (this.activeMode === 'audio') sendBtn.title = TEXT.holdAudio;
      else sendBtn.title = this.mode === 'video' ? TEXT.videoNote : TEXT.voiceNote;
      this.syncMenuSelection();
    }

    syncMenuSelection() {
      if (!this.menuEl) return;
      this.menuEl.querySelectorAll('[data-mode]').forEach((button) => {
        const active = button.dataset.mode === this.mode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

      canUseGesture() {
        return Boolean(this.audioAdapter?.canUseGesture?.());
      }

      async prepareSelectedRecorder(mode = this.gestureMode || this.mode) {
        if (!this.isIosGestureTarget()) return;
        const targetMode = mode === 'video' ? 'video' : 'audio';
        this.preparedMode = targetMode;
        if (targetMode === 'video') {
          await this.videoRecorder?.prepare?.();
          return;
        }
        await this.audioAdapter?.prepare?.();
      }

      async cancelPreparedRecorder(mode = this.preparedMode || this.gestureMode) {
        const targetMode = mode === 'video' ? 'video' : mode === 'audio' ? 'audio' : '';
        this.preparedMode = '';
        if (!targetMode) return;
        if (targetMode === 'video') {
          await this.videoRecorder?.cancelPrepared?.();
          return;
        }
        await this.audioAdapter?.cancelPrepared?.();
      }

      beginHoldGesture({ event, source, pointerId = null, touchIdentifier = null } = {}) {
        if (this.holdTimer || this.activeMode || this.activeGestureSource) return false;
        if (!this.canUseGesture()) return false;
        const sendBtn = this.getBridge()?.getDom?.()?.sendBtn;
        sendBtn?.blur?.();
        this.pointerId = pointerId;
        this.touchIdentifier = touchIdentifier;
        this.activeGestureSource = source;
        this.gestureMode = this.mode;
        this.preparedMode = '';
        if (source === 'pointer' && pointerId != null) {
          sendBtn?.setPointerCapture?.(pointerId);
        }
        if (this.isIosGestureTarget()) {
          this.prepareSelectedRecorder(this.gestureMode).catch(() => {});
        }
        this.holdTimer = window.setTimeout(() => {
          this.holdTimer = null;
          this.suppressNextClick = true;
          this.startSelectedRecorder(this.gestureMode).catch((error) => {
            this.activeMode = '';
            this.refreshComposerState();
            this.cancelPreparedRecorder(this.preparedMode || this.gestureMode).catch(() => {});
            this.resetGestureSession();
            window.BananzaVoiceHooks?.setRecorderMessage?.(error.message || TEXT.startError, 'error');
          });
        }, HOLD_DELAY_MS);
        event?.preventDefault?.();
        return true;
      }

      handlePointerDown(event) {
        if (typeof event.button === 'number' && event.button !== 0) return;
        if (this.shouldIgnorePointerEvent(event)) return;
        this.beginHoldGesture({
          event,
          source: 'pointer',
          pointerId: event.pointerId,
        });
      }

      handleTouchStart(event) {
        if (!this.isIosGestureTarget()) return;
        if ((event.touches?.length || 0) > 1) return;
        const touch = event.changedTouches?.[0];
        if (!touch) return;
        this.ignoreSyntheticPointerUntil = Date.now() + 900;
        this.beginHoldGesture({
          event,
          source: 'touch',
          touchIdentifier: touch.identifier,
        });
      }

      async startSelectedRecorder(mode = this.gestureMode || this.mode) {
        const targetMode = mode === 'video' ? 'video' : 'audio';
        this.closeMenu({ immediate: true });
        this.activeMode = targetMode;
        this.preparedMode = '';
        this.refreshComposerState();
        const startPromise = targetMode === 'video'
          ? Promise.resolve(this.videoRecorder?.start?.())
          : Promise.resolve(this.audioAdapter?.start?.());
        this.activeRecorderStartPromise = startPromise;
        try {
          await startPromise;
        } finally {
          if (this.activeRecorderStartPromise === startPromise) {
            this.activeRecorderStartPromise = null;
          }
        }
      }

      handlePointerUp(event) {
        if (this.shouldIgnorePointerEvent(event)) return;
        if (this.activeGestureSource && this.activeGestureSource !== 'pointer') return;
        this.finishGesture({ event, pointerId: event.pointerId, cancelOnly: false });
      }

      handlePointerCancel(event) {
        if (this.shouldIgnorePointerEvent(event)) return;
        if (this.activeGestureSource && this.activeGestureSource !== 'pointer') return;
        this.finishGesture({ event, pointerId: event.pointerId, cancelOnly: true });
      }

      handleTouchEnd(event) {
        if (this.activeGestureSource !== 'touch') return;
        const matchedTouch = Array.from(event.changedTouches || []).find((touch) => touch.identifier === this.touchIdentifier);
        if (!matchedTouch) return;
        this.finishGesture({ event, cancelOnly: false });
      }

      handleTouchCancel(event) {
        if (this.activeGestureSource !== 'touch') return;
        const matchedTouch = Array.from(event.changedTouches || []).find((touch) => touch.identifier === this.touchIdentifier);
        if (!matchedTouch) return;
        this.finishGesture({ event, cancelOnly: true });
      }

      finishGesture({ event, pointerId = null, cancelOnly = false } = {}) {
        const sendBtn = this.getBridge()?.getDom?.()?.sendBtn;
        if (pointerId != null) sendBtn?.releasePointerCapture?.(pointerId);
        sendBtn?.blur?.();
        if (this.holdTimer) {
          window.clearTimeout(this.holdTimer);
          this.holdTimer = null;
          const preparedMode = this.preparedMode || this.gestureMode;
          this.resetGestureSession({ keepPreparedMode: true });
          this.suppressNextClick = !cancelOnly;
          Promise.resolve(this.cancelPreparedRecorder(preparedMode))
            .catch(() => {})
            .finally(() => {
              this.preparedMode = '';
              if (cancelOnly) return;
              this.suppressNextClick = true;
              this.toggleMenu();
            });
          event?.preventDefault?.();
          return;
        }
        this.resetGestureSession();
        if (!this.activeMode) return;
        this.suppressNextClick = true;
        event?.preventDefault?.();
        this.stopActiveRecorder().catch((error) => {
          window.BananzaVoiceHooks?.setRecorderMessage?.(error.message || TEXT.sendError, 'error');
        });
      }

      async stopActiveRecorder() {
        if (this.activeRecorderStartPromise) {
          try {
            await this.activeRecorderStartPromise;
          } catch {}
        }
        const mode = this.activeMode;
        this.activeMode = '';
        this.refreshComposerState();
        if (mode === 'video') {
          await this.videoRecorder?.stopAndSend?.();
          return;
        }
        await this.audioAdapter?.stopAndSend?.();
      }

      cancelHold() {
        if (!this.holdTimer) return;
        window.clearTimeout(this.holdTimer);
        this.holdTimer = null;
        const preparedMode = this.preparedMode || this.gestureMode;
        this.resetGestureSession({ keepPreparedMode: true });
        this.cancelPreparedRecorder(preparedMode).catch(() => {});
      }

    handleAutoStopRequest() {
      if (!this.activeMode) return;
      this.stopActiveRecorder().catch(() => {});
    }

    toggleMenu() {
      if (!this.menuEl) return;
      if (this.menuEl.classList.contains('is-open') || this.menuEl.classList.contains('is-closing')) {
        this.closeMenu();
        return;
      }
      this.openMenu();
    }

    shouldSkipMotion() {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
      return this.getBridge()?.getCurrentModalAnimation?.() === 'none';
    }

    getMenuTransitionMs() {
      if (!this.menuEl) return 0;
      const styles = window.getComputedStyle(this.menuEl);
      const duration = parseDurationMs(styles.transitionDuration);
      const delay = parseDurationMs(styles.transitionDelay);
      return duration + delay;
    }

    clearMenuTimers() {
      if (this.menuOpenFrame) {
        cancelAnimationFrame(this.menuOpenFrame);
        this.menuOpenFrame = null;
      }
      if (this.menuCloseTimer) {
        clearTimeout(this.menuCloseTimer);
        this.menuCloseTimer = null;
      }
    }

    measureMenu() {
      const menu = this.ensureMenu();
      const wasHidden = menu.classList.contains('hidden');
      menu.classList.remove('hidden', 'is-open', 'is-closing');
      menu.classList.add('is-measuring');
      const width = menu.offsetWidth || 224;
      const height = menu.offsetHeight || 124;
      menu.classList.remove('is-measuring');
      if (wasHidden) menu.classList.add('hidden');
      return { width, height };
    }

    openMenu() {
      const sendBtn = this.getBridge()?.getDom?.()?.sendBtn;
      const menu = this.ensureMenu();
      if (!sendBtn || !menu) return;

      this.clearMenuTimers();
      this.syncMenuSelection();

      const rect = sendBtn.getBoundingClientRect();
      const { width, height } = this.measureMenu();
      let left = rect.right - width;
      left = Math.max(VIEWPORT_GAP, Math.min(left, window.innerWidth - width - VIEWPORT_GAP));

      let top = rect.top - height - MENU_GAP;
      let direction = 'up';
      if (top < VIEWPORT_GAP) {
        top = Math.min(window.innerHeight - height - VIEWPORT_GAP, rect.bottom + MENU_GAP);
        direction = 'down';
      }

        menu.dataset.direction = direction;
        menu.style.left = `${Math.round(left)}px`;
        menu.style.top = `${Math.round(top)}px`;
        menu.classList.remove('hidden', 'is-closing', 'is-open');
        menu.setAttribute('aria-hidden', 'false');
        if (this.isIosGestureTarget() && !this.shouldSkipMotion()) {
          void menu.offsetWidth;
        }
        this.menuOpenFrame = requestAnimationFrame(() => {
          this.menuOpenFrame = requestAnimationFrame(() => {
            menu.classList.add('is-open');
          this.menuOpenFrame = null;
        });
      });
    }

    finalizeMenuClose() {
      if (!this.menuEl) return;
      this.clearMenuTimers();
      this.menuEl.classList.remove('is-open', 'is-closing', 'is-measuring');
      this.menuEl.classList.add('hidden');
      this.menuEl.setAttribute('aria-hidden', 'true');
    }

    closeMenu({ immediate = false } = {}) {
      const menu = this.menuEl;
      if (!menu || menu.classList.contains('hidden')) return;
      this.clearMenuTimers();
      if (immediate || this.shouldSkipMotion()) {
        this.finalizeMenuClose();
        return;
      }

      menu.classList.remove('is-open');
      menu.classList.add('is-closing');
      menu.setAttribute('aria-hidden', 'true');

      const onTransitionEnd = (event) => {
        if (event.target !== menu || event.propertyName !== 'opacity') return;
        menu.removeEventListener('transitionend', onTransitionEnd);
        this.finalizeMenuClose();
      };

      menu.addEventListener('transitionend', onTransitionEnd);
      this.menuCloseTimer = window.setTimeout(() => {
        menu.removeEventListener('transitionend', onTransitionEnd);
        this.finalizeMenuClose();
      }, Math.max(220, this.getMenuTransitionMs() + 32));
    }
  }

  ns.MediaNoteComposerController = MediaNoteComposerController;
})();
