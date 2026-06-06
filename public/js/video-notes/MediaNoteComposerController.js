(function () {
  'use strict';

  const ns = window.BananzaVideoNotes = window.BananzaVideoNotes || {};

  const STORAGE_KEY = 'bananza-media-note-mode';
  const HOLD_DELAY_MS = 1000;
  const CLICK_SUPPRESS_MS = 500;
  const EXPANDED_HIT_SLOP_MOUSE_PX = 8;
  const EXPANDED_HIT_SLOP_TOUCH_PX = 18;
  const START_EXCLUSION_SELECTOR = [
    '#msgInput',
    '.composer-input-wrap',
    '#attachBtn',
    '#pollBtn',
    '#emojiBtn',
    '#mentionOpenBtn',
    '#composerContextConvertBtn',
    '.scroll-bottom-btn',
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
  ].join(',');
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
    recordingVideo: 'Recording video',
    holdVideo: 'Hold to record video',
    holdAudio: 'Hold to record audio',
    holdDictation: 'Hold to dictate into message',
    videoNote: 'Video note',
    voiceNote: 'Voice message',
    startError: 'Could not start recording',
    sendError: 'Could not send message',
  };

  class MediaNoteComposerController {
    constructor({ bridge, audioAdapter, videoRecorder } = {}) {
      this.bridge = bridge || window.BananzaAppBridge || null;
      this.audioAdapter = audioAdapter;
      this.videoRecorder = videoRecorder;
      this.mode = 'audio';
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      this.holdTimer = null;
      this.holdDelayMs = HOLD_DELAY_MS;
      this.expandedHitSlopMousePx = EXPANDED_HIT_SLOP_MOUSE_PX;
      this.expandedHitSlopTouchPx = EXPANDED_HIT_SLOP_TOUCH_PX;
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

    t(key, params = {}) {
      return this.getBridge()?.t?.(key, params)
        || window.BananzaI18n?.t?.(key, params)
        || String(key || '');
    }

    ownsComposer() {
      return true;
    }

    getFeatures() {
      return {
        ...(window.BananzaVoiceHooks?.getFeatures?.() || {}),
        ...(this.lastState.features || {}),
      };
    }

    isVoiceEnabled() {
      const features = this.getFeatures();
      if (!features.__loaded) return true;
      return Boolean(features.voice_notes_enabled);
    }

    isVideoEnabled() {
      const features = this.getFeatures();
      if (!features.__loaded) return false;
      return features.video_notes_enabled !== false;
    }

    isDictationMode() {
      return String(this.getBridge()?.getMicrophoneMode?.() || '') === 'dictation';
    }

    resolveAllowedMode(mode = this.mode) {
      const voiceEnabled = this.isVoiceEnabled();
      const videoEnabled = this.isVideoEnabled();
      if (mode === 'video' && videoEnabled) return 'video';
      if (mode !== 'video' && voiceEnabled) return 'audio';
      if (videoEnabled) return 'video';
      if (voiceEnabled) return 'audio';
      return '';
    }

    syncAllowedMode() {
      const allowedMode = this.resolveAllowedMode(this.mode);
      if (!allowedMode || allowedMode === this.mode) return allowedMode;
      this.mode = allowedMode;
      return allowedMode;
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

      document.addEventListener('pointerdown', (event) => this.handleDocumentPointerDown(event), { passive: false, capture: true });
      document.addEventListener('pointerup', (event) => this.handleDocumentPointerUp(event), { passive: false, capture: true });
      document.addEventListener('pointercancel', (event) => this.handleDocumentPointerCancel(event), { passive: false, capture: true });
      document.addEventListener('touchstart', (event) => this.handleDocumentTouchStart(event), { passive: false, capture: true });
      document.addEventListener('touchend', (event) => this.handleTouchEnd(event), { passive: false, capture: true });
      document.addEventListener('touchcancel', (event) => this.handleTouchCancel(event), { passive: false, capture: true });
      this.getBridge()?.onLanguageChange?.(() => this.refreshComposerState());
      window.addEventListener('bananza:languagechange', () => this.refreshComposerState());

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
      this.refreshComposerState();
      if (animate) this.playModeSwitchAnimation();
    }

    toggleMode() {
      if (this.isVoiceEnabled() && this.isVideoEnabled()) {
        this.setModeInternal(this.mode === 'video' ? 'audio' : 'video', { animate: true });
        return;
      }
      const allowedMode = this.resolveAllowedMode(this.mode);
      if (allowedMode) this.setModeInternal(allowedMode, { animate: false });
    }

    refreshComposerState(state = null) {
      if (state) this.lastState = { ...this.lastState, ...state };
      const sendBtn = this.getBridge()?.getDom?.()?.sendBtn;
      if (!sendBtn) return;
      this.syncAllowedMode();

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
      const audioHoldTitle = this.isDictationMode() ? TEXT.holdDictation : TEXT.holdAudio;
      const audioIdleTitle = this.isDictationMode() ? TEXT.holdDictation : TEXT.voiceNote;
      if (isRecording && this.activeMode === 'video') sendBtn.title = this.t(TEXT.recordingVideo);
      else if (isRecording) sendBtn.title = this.t(audioHoldTitle);
      else if (startPending) sendBtn.title = this.t(this.activeMode === 'video' ? TEXT.holdVideo : audioHoldTitle);
      else if (isRecording || this.holdArmed) sendBtn.title = this.t(this.mode === 'video' ? TEXT.holdVideo : audioHoldTitle);
      else sendBtn.title = this.t(this.mode === 'video' ? TEXT.videoNote : audioIdleTitle);
    }

    canUseGesture() {
      return Boolean(this.resolveAllowedMode(this.mode) && this.audioAdapter?.canUseGesture?.());
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

    getSendButton() {
      return this.getBridge()?.getDom?.()?.sendBtn || null;
    }

    getGesturePoint(event) {
      const touch = event?.changedTouches?.[0] || event?.touches?.[0] || null;
      const source = touch || event || {};
      const clientX = Number(source.clientX);
      const clientY = Number(source.clientY);
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
      return { clientX, clientY };
    }

    getGestureKind(event) {
      if (event?.changedTouches || event?.touches) return 'touch';
      return String(event?.pointerType || 'mouse').toLowerCase();
    }

    getExpandedHitSlop(event) {
      const kind = this.getGestureKind(event);
      if (kind === 'touch' || kind === 'pen') return this.expandedHitSlopTouchPx;
      return this.expandedHitSlopMousePx;
    }

    isPointInsideRect(point, rect, slop = 0) {
      if (!point || !rect) return false;
      const left = Number(rect.left);
      const right = Number(rect.right);
      const top = Number(rect.top);
      const bottom = Number(rect.bottom);
      if (![left, right, top, bottom].every(Number.isFinite)) return false;
      return (
        point.clientX >= left - slop
        && point.clientX <= right + slop
        && point.clientY >= top - slop
        && point.clientY <= bottom + slop
      );
    }

    isPointInsideSendButton(event, sendBtn) {
      return this.isPointInsideRect(this.getGesturePoint(event), sendBtn?.getBoundingClientRect?.(), 0);
    }

    isPointInsideExpandedSendButton(event, sendBtn) {
      return this.isPointInsideRect(
        this.getGesturePoint(event),
        sendBtn?.getBoundingClientRect?.(),
        this.getExpandedHitSlop(event)
      );
    }

    isProtectedStartTarget(target, sendBtn) {
      if (!target || typeof target.closest !== 'function') return false;
      if (sendBtn && (target === sendBtn || sendBtn.contains?.(target))) return false;
      const button = target.closest('button');
      if (button && button !== sendBtn) return true;
      return Boolean(target.closest(START_EXCLUSION_SELECTOR));
    }

    getUnderlyingStartTarget(event, sendBtn) {
      const point = this.getGesturePoint(event);
      if (!point || !sendBtn || typeof document.elementFromPoint !== 'function') return null;
      const previousPointerEvents = sendBtn.style.pointerEvents;
      try {
        sendBtn.style.pointerEvents = 'none';
        return document.elementFromPoint(point.clientX, point.clientY);
      } catch {
        return null;
      } finally {
        sendBtn.style.pointerEvents = previousPointerEvents;
      }
    }

    isProtectedExpandedStart(event, sendBtn) {
      if (this.isProtectedStartTarget(event?.target, sendBtn)) return true;
      if (!sendBtn || !(event?.target === sendBtn || sendBtn.contains?.(event?.target))) return false;
      if (this.isPointInsideSendButton(event, sendBtn)) return false;
      return this.isProtectedStartTarget(this.getUnderlyingStartTarget(event, sendBtn), sendBtn);
    }

    canStartPointerGestureFromEvent(event, { allowButtonTarget = false } = {}) {
      if (typeof event?.button === 'number' && event.button !== 0) return false;
      const sendBtn = this.getSendButton();
      if (!sendBtn) return false;
      const isSendButtonTarget = event?.target === sendBtn || sendBtn.contains?.(event?.target);
      if (isSendButtonTarget && !allowButtonTarget) return false;
      if (!isSendButtonTarget && !this.isPointInsideExpandedSendButton(event, sendBtn)) return false;
      return !this.isProtectedExpandedStart(event, sendBtn);
    }

    canStartTouchGestureFromEvent(event, { allowButtonTarget = false } = {}) {
      if ((event?.touches?.length || 0) > 1) return false;
      const sendBtn = this.getSendButton();
      if (!sendBtn) return false;
      const isSendButtonTarget = event?.target === sendBtn || sendBtn.contains?.(event?.target);
      if (isSendButtonTarget && !allowButtonTarget) return false;
      if (!isSendButtonTarget && !this.isPointInsideExpandedSendButton(event, sendBtn)) return false;
      return !this.isProtectedExpandedStart(event, sendBtn);
    }

    capturePointer(sendBtn, pointerId) {
      if (pointerId == null || !sendBtn?.setPointerCapture) return;
      try {
        sendBtn.setPointerCapture(pointerId);
      } catch {}
    }

    releasePointer(sendBtn, pointerId) {
      if (pointerId == null || !sendBtn?.releasePointerCapture) return;
      try {
        sendBtn.releasePointerCapture(pointerId);
      } catch {}
    }

    matchesActivePointer(event) {
      if (this.activeGestureSource !== 'pointer') return false;
      if (this.pointerId == null) return true;
      return Number(event?.pointerId) === Number(this.pointerId);
    }

    isSendButtonEventTarget(event) {
      const sendBtn = this.getSendButton();
      return Boolean(sendBtn && (event?.target === sendBtn || sendBtn.contains?.(event?.target)));
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

      const sendBtn = this.getSendButton();
      sendBtn?.blur?.();
      this.pointerId = pointerId;
      this.touchIdentifier = touchIdentifier;
      this.activeGestureSource = source;
      this.gestureMode = this.mode;
      this.setHoldArmed(true);

      if (source === 'pointer' && pointerId != null) {
        this.capturePointer(sendBtn, pointerId);
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
          window.BananzaVoiceHooks?.setRecorderMessage?.(error.message || this.t(TEXT.startError), 'error');
        });
      }, this.holdDelayMs);

      event?.preventDefault?.();
      return true;
    }

    handlePointerDown(event) {
      if (this.shouldIgnorePointerEvent(event)) return;
      if (!this.canStartPointerGestureFromEvent(event, { allowButtonTarget: true })) return;
      this.beginHoldGesture({
        event,
        source: 'pointer',
        pointerId: event.pointerId,
      });
    }

    handleTouchStart(event) {
      if (!this.isIosGestureTarget()) return;
      if (!this.canStartTouchGestureFromEvent(event, { allowButtonTarget: true })) return;
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      this.ignoreSyntheticPointerUntil = Date.now() + 900;
      this.beginHoldGesture({
        event,
        source: 'touch',
        touchIdentifier: touch.identifier,
      });
    }

    handleDocumentPointerDown(event) {
      if (this.activeGestureSource || this.holdTimer || this.activeMode || this.activeRecorderStartPromise) return;
      if (this.shouldIgnorePointerEvent(event)) return;
      if (!this.canStartPointerGestureFromEvent(event, { allowButtonTarget: false })) return;
      this.beginHoldGesture({
        event,
        source: 'pointer',
        pointerId: event.pointerId,
      });
    }

    handleDocumentTouchStart(event) {
      if (!this.isIosGestureTarget()) return;
      if (this.activeGestureSource || this.holdTimer || this.activeMode || this.activeRecorderStartPromise) return;
      if (!this.canStartTouchGestureFromEvent(event, { allowButtonTarget: false })) return;
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
      const targetMode = this.resolveAllowedMode(mode);
      if (!targetMode) throw new Error(this.t(TEXT.startError));
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
      if (!this.matchesActivePointer(event)) return;
      if (this.activeGestureSource && this.activeGestureSource !== 'pointer') return;
      this.finishGesture({ event, pointerId: event.pointerId, cancelOnly: false });
    }

    handlePointerCancel(event) {
      if (this.shouldIgnorePointerEvent(event)) return;
      if (!this.matchesActivePointer(event)) return;
      if (this.activeGestureSource && this.activeGestureSource !== 'pointer') return;
      this.finishGesture({ event, pointerId: event.pointerId, cancelOnly: true });
    }

    handleDocumentPointerUp(event) {
      if (!this.matchesActivePointer(event)) return;
      if (this.isSendButtonEventTarget(event)) return;
      this.finishGesture({ event, pointerId: event.pointerId, cancelOnly: false });
    }

    handleDocumentPointerCancel(event) {
      if (!this.matchesActivePointer(event)) return;
      if (this.isSendButtonEventTarget(event)) return;
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
      const sendBtn = this.getSendButton();
      this.releasePointer(sendBtn, pointerId != null ? pointerId : this.pointerId);
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
        window.BananzaVoiceHooks?.setRecorderMessage?.(error.message || this.t(TEXT.sendError), 'error');
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
