(function () {
  'use strict';

  const ns = window.BananzaVideoNotes = window.BananzaVideoNotes || {};

  const STORAGE_KEY = 'bananza-media-note-mode';
  const HOLD_DELAY_MS = 1000;
  const CLICK_SUPPRESS_MS = 500;
  const MODAL_ANIMATION_SPEED_FACTORS = Object.freeze({
    1: 4.5,
    2: 4.0,
    3: 3.5,
    4: 3.0,
    5: 2.3,
    6: 1.8,
    7: 1.5,
    8: 1.0,
    9: 0.8,
    10: 0.5,
  });

  const TEXT = {
    recordingVideo: '\u0418\u0434\u0435\u0442 \u0437\u0430\u043f\u0438\u0441\u044c \u0432\u0438\u0434\u0435\u043e',
    holdVideo: '\u0423\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0439\u0442\u0435 \u0434\u043b\u044f \u0437\u0430\u043f\u0438\u0441\u0438 \u0432\u0438\u0434\u0435\u043e',
    holdAudio: '\u0423\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0439\u0442\u0435 \u0434\u043b\u044f \u0437\u0430\u043f\u0438\u0441\u0438 \u0430\u0443\u0434\u0438\u043e',
    videoNote: '\u0412\u0438\u0434\u0435\u043e-\u0437\u0430\u043c\u0435\u0442\u043a\u0430',
    voiceNote: '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435',
    startError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043d\u0430\u0447\u0430\u0442\u044c \u0437\u0430\u043f\u0438\u0441\u044c',
    sendError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435',
  };

  class MediaNoteComposerController {
    constructor({ bridge, audioAdapter, videoRecorder } = {}) {
      this.bridge = bridge || window.BananzaAppBridge || null;
      this.audioAdapter = audioAdapter;
      this.videoRecorder = videoRecorder;
      this.mode = localStorage.getItem(STORAGE_KEY) === 'video' ? 'video' : 'audio';
      this.holdTimer = null;
      this.pointerId = null;
      this.touchIdentifier = null;
      this.activeGestureSource = '';
      this.gestureMode = '';
      this.ignoreSyntheticPointerUntil = 0;
      this.activeRecorderStartPromise = null;
      this.activeMode = '';
      this.initialized = false;
      this.lastState = {};
      this.holdArmed = false;
      this.suppressClickUntil = 0;
      this.modeSwitchAnimationTimer = null;
      this.forceIdleUi = false;
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

    isClickSuppressed() {
      return Date.now() < this.suppressClickUntil;
    }

    suppressClick(ms = CLICK_SUPPRESS_MS) {
      this.suppressClickUntil = Math.max(this.suppressClickUntil, Date.now() + ms);
    }

    setHoldArmed(nextValue) {
      const next = Boolean(nextValue);
      if (this.holdArmed === next) return;
      this.holdArmed = next;
      this.refreshComposerState();
    }

    resetGestureSession() {
      this.pointerId = null;
      this.touchIdentifier = null;
      this.activeGestureSource = '';
      this.gestureMode = '';
      this.setHoldArmed(false);
    }

    init() {
      if (this.initialized) return;
      const sendBtn = this.getBridge()?.getDom?.()?.sendBtn;
      if (!sendBtn) return;
      this.initialized = true;

      sendBtn.addEventListener('click', (event) => {
        if (!this.isClickSuppressed()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        sendBtn.blur();
      }, true);

      sendBtn.addEventListener('pointerdown', (event) => this.handlePointerDown(event), { passive: false });
      sendBtn.addEventListener('pointerup', (event) => this.handlePointerUp(event), { passive: false });
      sendBtn.addEventListener('pointercancel', (event) => this.handlePointerCancel(event), { passive: false });
      sendBtn.addEventListener('touchstart', (event) => this.handleTouchStart(event), { passive: false });

      document.addEventListener('touchend', (event) => this.handleTouchEnd(event), { passive: false });
      document.addEventListener('touchcancel', (event) => this.handleTouchCancel(event), { passive: false });

      this.refreshComposerState();
    }

    setMode(mode) {
      return this.setModeInternal(mode, { animate: true });
    }

    setModeInternal(mode, { animate = false } = {}) {
      const nextMode = mode === 'video' ? 'video' : 'audio';
      if (this.mode === nextMode) {
        this.refreshComposerState();
        return;
      }
      this.mode = nextMode;
      localStorage.setItem(STORAGE_KEY, this.mode);
      this.refreshComposerState();
      if (animate) this.playModeSwitchAnimation();
    }

    toggleMode() {
      this.setModeInternal(this.mode === 'video' ? 'audio' : 'video', { animate: true });
    }

    refreshComposerState(state = null) {
      if (state) this.lastState = { ...this.lastState, ...state };
      const sendBtn = this.getBridge()?.getDom?.()?.sendBtn;
      if (!sendBtn) return;

      const showMicMode = state?.showMicMode != null
        ? Boolean(state.showMicMode)
        : sendBtn.classList.contains('is-mic-mode');
      const videoRecording = Boolean(this.videoRecorder?.isRecording?.());
      const audioRecording = Boolean(this.audioAdapter?.isRecording?.());
      const recorderStarted = Boolean(state?.isRecording) || videoRecording || audioRecording;
      const isRecording = !this.forceIdleUi && recorderStarted;
      const startPending = Boolean(this.activeMode && this.activeRecorderStartPromise && !recorderStarted);

      if (!showMicMode && this.holdArmed) this.holdArmed = false;

      sendBtn.dataset.mediaNoteMode = this.mode;
      sendBtn.classList.toggle('is-video-note-mode', showMicMode && this.mode === 'video');
      sendBtn.classList.toggle('is-audio-note-mode', showMicMode && this.mode !== 'video');
      sendBtn.classList.toggle('is-recording', isRecording);
      sendBtn.classList.toggle('is-hold-armed', showMicMode && this.holdArmed && !isRecording);

      if (!showMicMode) return;
      if (isRecording && this.activeMode === 'video') sendBtn.title = TEXT.recordingVideo;
      else if (isRecording) sendBtn.title = TEXT.holdAudio;
      else if (startPending) sendBtn.title = this.activeMode === 'video' ? TEXT.holdVideo : TEXT.holdAudio;
      else if (isRecording || this.holdArmed) sendBtn.title = this.mode === 'video' ? TEXT.holdVideo : TEXT.holdAudio;
      else sendBtn.title = this.mode === 'video' ? TEXT.videoNote : TEXT.voiceNote;
    }

    canUseGesture() {
      return Boolean(this.audioAdapter?.canUseGesture?.());
    }

    getModeSwitchAnimationDurationMs() {
      const animationStyle = String(
        this.getBridge()?.getCurrentModalAnimation?.()
        || document.documentElement?.dataset?.modalAnimation
        || 'soft'
      ).toLowerCase();
      const rawSpeed = Number(this.getBridge()?.getCurrentModalAnimationSpeed?.() || 8);
      const safeSpeed = Math.min(10, Math.max(1, Math.round(rawSpeed) || 8));
      const factor = MODAL_ANIMATION_SPEED_FACTORS[safeSpeed] || 1;
      const baseDuration = animationStyle === 'none'
        ? 0
        : animationStyle === 'zoom'
          ? 180
          : animationStyle === 'slide'
            ? 240
            : animationStyle === 'fade'
              ? 160
              : 220;
      return Math.max(0, Math.round(baseDuration * factor));
    }

    playModeSwitchAnimation() {
      const sendBtn = this.getBridge()?.getDom?.()?.sendBtn;
      if (!sendBtn) return;
      if (this.modeSwitchAnimationTimer) {
        clearTimeout(this.modeSwitchAnimationTimer);
        this.modeSwitchAnimationTimer = null;
      }
      sendBtn.classList.remove('is-mode-switching');
      void sendBtn.offsetWidth;
      sendBtn.classList.add('is-mode-switching');
      const durationMs = this.getModeSwitchAnimationDurationMs();
      if (durationMs <= 0) {
        requestAnimationFrame(() => sendBtn.classList.remove('is-mode-switching'));
        return;
      }
      this.modeSwitchAnimationTimer = window.setTimeout(() => {
        sendBtn.classList.remove('is-mode-switching');
        this.modeSwitchAnimationTimer = null;
      }, durationMs + 40);
    }

    beginHoldGesture({ event, source, pointerId = null, touchIdentifier = null } = {}) {
      if (this.holdTimer || this.activeMode || this.activeGestureSource || this.activeRecorderStartPromise) return false;
      if (!this.canUseGesture()) return false;

      const sendBtn = this.getBridge()?.getDom?.()?.sendBtn;
      sendBtn?.blur?.();
      this.pointerId = pointerId;
      this.touchIdentifier = touchIdentifier;
      this.activeGestureSource = source;
      this.gestureMode = this.mode;
      this.setHoldArmed(true);

      if (source === 'pointer' && pointerId != null) {
        sendBtn?.setPointerCapture?.(pointerId);
      }

      this.holdTimer = window.setTimeout(() => {
        this.holdTimer = null;
        this.setHoldArmed(false);
        this.suppressClick();
        this.startSelectedRecorder(this.gestureMode).catch((error) => {
          this.forceIdleUi = false;
          this.activeMode = '';
          this.refreshComposerState();
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

    abortPendingHold({ suppressClick = false } = {}) {
      if (!this.holdTimer) return;
      window.clearTimeout(this.holdTimer);
      this.holdTimer = null;
      if (suppressClick) this.suppressClick();
      this.resetGestureSession();
    }

    async startSelectedRecorder(mode = this.gestureMode || this.mode) {
      const targetMode = mode === 'video' ? 'video' : 'audio';
      this.forceIdleUi = false;
      this.activeMode = targetMode;
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
        this.abortPendingHold({ suppressClick: !cancelOnly });
        if (!cancelOnly) {
          this.toggleMode();
        }
        event?.preventDefault?.();
        return;
      }

      const hasRecordingFlow = Boolean(this.activeMode || this.activeRecorderStartPromise);
      this.resetGestureSession();
      if (!hasRecordingFlow) {
        if (cancelOnly) event?.preventDefault?.();
        return;
      }

      this.suppressClick();
      event?.preventDefault?.();
      const action = cancelOnly ? this.cancelActiveRecorder() : this.stopActiveRecorder();
      action.catch((error) => {
        window.BananzaVoiceHooks?.setRecorderMessage?.(error.message || TEXT.sendError, 'error');
      });
    }

    async stopActiveRecorder() {
      const mode = this.activeMode;
      if (!mode) return;
      this.forceIdleUi = true;
      this.activeMode = '';
      this.refreshComposerState();
      if (this.activeRecorderStartPromise) {
        try {
          await this.activeRecorderStartPromise;
        } catch {}
      }
      try {
        if (mode === 'video') {
          await this.videoRecorder?.stopAndSend?.();
          return;
        }
        await this.audioAdapter?.stopAndSend?.();
      } finally {
        this.forceIdleUi = false;
        this.refreshComposerState();
      }
    }

    async cancelActiveRecorder() {
      const mode = this.activeMode;
      if (!mode) return;
      this.forceIdleUi = true;
      this.activeMode = '';
      this.refreshComposerState();
      if (this.activeRecorderStartPromise) {
        try {
          await this.activeRecorderStartPromise;
        } catch {}
      }
      try {
        if (mode === 'video') {
          await this.videoRecorder?.cancel?.();
          return;
        }
        await this.audioAdapter?.cancel?.();
      } finally {
        this.forceIdleUi = false;
        this.refreshComposerState();
      }
    }

    cancelHold() {
      this.abortPendingHold({ suppressClick: true });
    }
  }

  ns.MediaNoteComposerController = MediaNoteComposerController;
})();
