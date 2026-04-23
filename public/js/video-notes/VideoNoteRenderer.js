(function () {
  'use strict';

  const ns = window.BananzaVideoNotes = window.BananzaVideoNotes || {};

  const TEXT = {
    playLabel: 'Play video note',
    pauseLabel: 'Pause video note',
    transcriptLabel: '\u0420\u0430\u0441\u0448\u0438\u0444\u0440\u043e\u0432\u043a\u0430',
    shapeCircleLabel: 'Switch video note to circle',
    shapeBananaLabel: 'Switch video note to banana',
    pending: '\u0420\u0430\u0441\u0448\u0438\u0444\u0440\u043e\u0432\u043a\u0430...',
    hidden: '\u0420\u0430\u0441\u0448\u0438\u0444\u0440\u043e\u0432\u043a\u0430 \u0441\u043a\u0440\u044b\u0442\u0430',
    defaultError: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0440\u0430\u0441\u0448\u0438\u0444\u0440\u043e\u0432\u043a\u0438',
    requestError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0440\u0430\u0441\u0448\u0438\u0444\u0440\u043e\u0432\u043a\u0443',
    bridgeError: '\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 \u043a API \u0447\u0430\u0442\u0430',
  };

  const PLAYING_PROGRESS_MAX = 0.9;
  const MIN_PLAYING_PROGRESS_GAP_PX = 72;
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

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function applyMaskStyle(node, maskUrl) {
    if (!node) return;
    const imageValue = maskUrl ? `url("${maskUrl}")` : '';
    node.style.setProperty('--video-note-mask', imageValue);
    node.style.webkitMaskImage = imageValue;
    node.style.maskImage = imageValue;
    node.style.webkitMaskRepeat = 'no-repeat';
    node.style.maskRepeat = 'no-repeat';
    node.style.webkitMaskPosition = 'center';
    node.style.maskPosition = 'center';
    node.style.webkitMaskSize = '100% 100%';
    node.style.maskSize = '100% 100%';
  }

  function sanitizeIdPart(value) {
    return String(value || 'note').replace(/[^a-zA-Z0-9_-]+/g, '-');
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  class VideoNoteRenderer {
    constructor({ bridge, shapeRegistry } = {}) {
      this.bridge = bridge || window.BananzaAppBridge || null;
      this.shapeRegistry = shapeRegistry;
      this.expandedIds = new Set();
      this.boundContainers = new WeakSet();
      this.progressFrames = new WeakMap();
    }

    getBridge() {
      return this.bridge || window.BananzaAppBridge || null;
    }

    getShapeSwitchAnimationDurationMs() {
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

    playShapeSwitchAnimation(row, nextShapeId) {
      const note = row?.querySelector('.video-note');
      if (!note) return;
      if (row.__shapeSwitchAnimationTimer) {
        clearTimeout(row.__shapeSwitchAnimationTimer);
        row.__shapeSwitchAnimationTimer = null;
      }
      note.classList.remove('is-shape-switching');
      delete note.dataset.shapeSwitchTo;
      void note.offsetWidth;
      note.dataset.shapeSwitchTo = String(nextShapeId || '');
      note.classList.add('is-shape-switching');
      const durationMs = this.getShapeSwitchAnimationDurationMs();
      if (durationMs <= 0) {
        requestAnimationFrame(() => {
          note.classList.remove('is-shape-switching');
          delete note.dataset.shapeSwitchTo;
        });
        return;
      }
      row.__shapeSwitchAnimationTimer = window.setTimeout(() => {
        note.classList.remove('is-shape-switching');
        delete note.dataset.shapeSwitchTo;
        row.__shapeSwitchAnimationTimer = null;
      }, durationMs + 40);
    }

    scrollToBottomSoon() {
      const bridge = this.getBridge();
      if (!bridge?.scrollToBottom) return;
      requestAnimationFrame(() => bridge.scrollToBottom());
      window.setTimeout(() => bridge.scrollToBottom(), 220);
    }

    renderProgressSvg(snapshot, gradientId) {
      const viewBox = escapeHtml(snapshot?.viewBox || '0 0 320 220');
      const path = escapeHtml(snapshot?.path || '');
      return `
        <svg class="video-note-progress" viewBox="${viewBox}" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color: var(--accent);"></stop>
              <stop offset="55%" style="stop-color: var(--link, var(--accent));"></stop>
              <stop offset="100%" style="stop-color: color-mix(in srgb, var(--accent) 64%, #ffffff 36%);"></stop>
            </linearGradient>
          </defs>
          <path class="video-note-progress-track" d="${path}"></path>
          <path class="video-note-progress-fill" d="${path}" stroke="url(#${gradientId})"></path>
        </svg>
      `;
    }

    renderAttachment(message) {
      if (!message?.is_video_note) return '';
      const snapshot = this.shapeRegistry?.snapshotFromMessage?.(message);
      const effectiveShapeId = this.getEffectiveShapeId(message);
      const maskUrl = this.shapeRegistry?.getMaskUrl?.(snapshot) || '';
      const src = message.client_file_url || `/uploads/${message.file_stored}`;
      const gradientId = `video-note-progress-${sanitizeIdPart(message.id || message.client_id || 'local')}`;
      return `
        <div class="video-note" data-video-note="1">
          <button
            type="button"
            class="video-note-shape-toggle-btn"
            aria-label="${escapeHtml(this.getShapeToggleLabel(effectiveShapeId))}"
            data-shape-id="${escapeHtml(effectiveShapeId)}"
          >${escapeHtml(this.getShapeToggleGlyph(effectiveShapeId))}</button>
          <div class="video-note-stage" role="button" tabindex="0" aria-label="${TEXT.playLabel}">
            <div class="video-note-shape" style="--video-note-mask:url('${maskUrl}')">
              <video class="video-note-video" playsinline preload="metadata">
                <source src="${escapeHtml(src)}" type="${escapeHtml(message.file_mime || 'video/webm')}">
              </video>
              ${this.renderProgressSvg(snapshot, gradientId)}
            </div>
          </div>
          <div class="video-note-toolbar">
            <button type="button" class="video-note-transcript-btn" aria-label="${TEXT.transcriptLabel}">&#127908;</button>
          </div>
          <div class="video-note-transcript" aria-hidden="true"></div>
        </div>
      `;
    }

    bindDelegatedEvents(container) {
      if (!container || this.boundContainers.has(container)) return;
      this.boundContainers.add(container);

      container.addEventListener('click', (event) => {
        const shapeToggleBtn = event.target.closest('.video-note-shape-toggle-btn');
        if (shapeToggleBtn) {
          const row = shapeToggleBtn.closest('.msg-row');
          if (!row?.querySelector('.video-note')) return;
          event.preventDefault();
          event.stopPropagation();
          this.toggleShape(row);
          return;
        }

        const transcriptBtn = event.target.closest('.video-note-transcript-btn');
        if (transcriptBtn) {
          const row = transcriptBtn.closest('.msg-row');
          if (!row?.querySelector('.video-note')) return;
          event.preventDefault();
          event.stopPropagation();
          this.toggleTranscript(row).catch(() => {});
          return;
        }

        const stage = event.target.closest('.video-note-stage');
        if (!stage) return;
        const row = stage.closest('.msg-row');
        if (!row?.querySelector('.video-note')) return;
        event.preventDefault();
        event.stopPropagation();
        this.togglePlayback(row);
      });

      container.addEventListener('keydown', (event) => {
        const stage = event.target.closest('.video-note-stage');
        if (!stage) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const row = stage.closest('.msg-row');
        if (!row?.querySelector('.video-note')) return;
        event.preventDefault();
        this.togglePlayback(row);
      });
    }

    decorateMessageRow(row, message) {
      if (!row || !message?.is_video_note) return;
      if (row.dataset.videoNoteBound !== '1') {
        row.dataset.videoNoteBound = '1';
        const video = row.querySelector('.video-note-video');
        const syncUi = () => {
          this.refreshPlaybackUi(row);
          this.refreshProgressUi(row);
        };
        video?.addEventListener('loadedmetadata', syncUi);
        video?.addEventListener('durationchange', syncUi);
        video?.addEventListener('timeupdate', () => this.refreshProgressUi(row));
        video?.addEventListener('seeking', () => this.refreshProgressUi(row));
        video?.addEventListener('play', () => {
          row.classList.add('video-note-playing');
          this.startProgressLoop(row);
          syncUi();
        });
        video?.addEventListener('pause', () => {
          row.classList.remove('video-note-playing');
          this.stopProgressLoop(row);
          syncUi();
        });
        video?.addEventListener('ended', () => {
          row.classList.remove('video-note-playing');
          this.stopProgressLoop(row);
          syncUi();
        });
        this.getBridge()?.bindMediaPlayback?.(video, message, 'video-note-video');
      }
      row.classList.add('video-note-row', 'media-message');
      row.__messageData = { ...(row.__messageData || {}), ...message };
      this.refreshRow(row);
    }

    refreshPlaybackUi(row) {
      const video = row?.querySelector('.video-note-video');
      const stage = row?.querySelector('.video-note-stage');
      if (!video || !stage) return;
      const isPlaying = !video.paused && !video.ended;
      row.classList.toggle('video-note-playing', isPlaying);
      stage.setAttribute('aria-label', isPlaying ? TEXT.pauseLabel : TEXT.playLabel);
    }

    refreshProgressUi(row) {
      const video = row?.querySelector('.video-note-video');
      const fill = row?.querySelector('.video-note-progress-fill');
      if (!video || !fill) return;

      let pathLength = Number(fill.dataset.pathLength || 0);
      if (!pathLength) {
        try {
          pathLength = fill.getTotalLength();
          fill.dataset.pathLength = String(pathLength);
        } catch {
          pathLength = 0;
        }
      }
      if (!pathLength) return;

      const message = row?.__messageData || {};
      const declaredDurationMs = Number(message.media_note_duration_ms || message.voice_duration_ms || 0);
      const metadataDuration = Number(video.duration || 0);
      const declaredDuration = declaredDurationMs > 0 ? declaredDurationMs / 1000 : 0;
      const duration = Math.max(
        Number.isFinite(metadataDuration) ? metadataDuration : 0,
        Number.isFinite(declaredDuration) ? declaredDuration : 0
      );
      let progress = duration > 0
        ? clamp((Number(video.currentTime || 0) / duration), 0, 1)
        : 0;
      if (!video.ended) {
        const visibleCap = Math.min(
          PLAYING_PROGRESS_MAX,
          Math.max(0, (pathLength - MIN_PLAYING_PROGRESS_GAP_PX) / pathLength)
        );
        progress = Math.min(progress, visibleCap);
      }

      const filledLength = clamp(progress * pathLength, 0, pathLength);
      fill.setAttribute('stroke-dasharray', `${filledLength} ${pathLength * 2}`);
      fill.setAttribute('stroke-dashoffset', '0');
      fill.style.opacity = progress > 0 ? '1' : '.02';
    }

    startProgressLoop(row) {
      if (!row || this.progressFrames.has(row)) return;
      const tick = () => {
        this.refreshProgressUi(row);
        const video = row.querySelector('.video-note-video');
        if (video && !video.paused && !video.ended) {
          this.progressFrames.set(row, window.requestAnimationFrame(tick));
          return;
        }
        this.progressFrames.delete(row);
      };
      this.progressFrames.set(row, window.requestAnimationFrame(tick));
    }

    stopProgressLoop(row) {
      const frameId = row ? this.progressFrames.get(row) : null;
      if (frameId) window.cancelAnimationFrame(frameId);
      if (row) this.progressFrames.delete(row);
    }

    syncTranscriptState(row, expanded) {
      const note = row?.querySelector('.video-note');
      const transcript = row?.querySelector('.video-note-transcript');
      if (!note || !transcript) return;
      if (expanded) {
        const targetHeight = clamp(transcript.scrollHeight + 18, 56, 220);
        transcript.style.setProperty('--video-note-transcript-height', `${targetHeight}px`);
      }
      note.classList.toggle('is-transcript-open', expanded);
      transcript.classList.toggle('is-open', expanded);
      transcript.setAttribute('aria-hidden', expanded ? 'false' : 'true');
    }

    getEffectiveShapeId(message) {
      return this.shapeRegistry?.getEffectiveShapeId?.(message) || 'banana-fat';
    }

    getShapeToggleGlyph(shapeId) {
      return shapeId === 'circle' ? '\ud83c\udf4c' : '\u25ef';
    }

    getShapeToggleLabel(shapeId) {
      return shapeId === 'circle' ? TEXT.shapeBananaLabel : TEXT.shapeCircleLabel;
    }

    syncShapeState(row, message) {
      const note = row?.querySelector('.video-note');
      const shape = row?.querySelector('.video-note-shape');
      const video = row?.querySelector('.video-note-video');
      const progress = row?.querySelector('.video-note-progress');
      const track = row?.querySelector('.video-note-progress-track');
      const fill = row?.querySelector('.video-note-progress-fill');
      const toggleBtn = row?.querySelector('.video-note-shape-toggle-btn');
      if (!note || !shape || !video || !progress || !track || !fill || !toggleBtn) return;

      const effectiveShapeId = this.getEffectiveShapeId(message);
      const snapshot = this.shapeRegistry?.snapshotFromMessage?.(message);
      const maskUrl = this.shapeRegistry?.getMaskUrl?.(snapshot) || '';
      applyMaskStyle(video, maskUrl);

      note.dataset.shapeId = effectiveShapeId;
      shape.dataset.shapeId = effectiveShapeId;
      progress.setAttribute('viewBox', snapshot?.viewBox || '0 0 320 220');
      track.setAttribute('d', snapshot?.path || '');
      fill.setAttribute('d', snapshot?.path || '');
      delete fill.dataset.pathLength;

      toggleBtn.dataset.shapeId = effectiveShapeId;
      toggleBtn.textContent = this.getShapeToggleGlyph(effectiveShapeId);
      toggleBtn.setAttribute('aria-label', this.getShapeToggleLabel(effectiveShapeId));
    }

    refreshRow(row) {
      const message = row?.__messageData || {};
      if (!message?.is_video_note) return;
      const note = row.querySelector('.video-note');
      const transcript = row.querySelector('.video-note-transcript');
      const transcriptBtn = row.querySelector('.video-note-transcript-btn');
      const video = row.querySelector('.video-note-video');
      if (!note || !transcript || !transcriptBtn || !video) return;
      this.syncShapeState(row, message);

      const expanded = this.expandedIds.has(Number(message.id || 0));

      const status = String(message.transcription_status || 'idle');
      if (status === 'completed' && String(message.transcription_text || '').trim()) {
        transcript.innerHTML = `<div class="video-note-transcript-text">${escapeHtml(message.transcription_text)}</div>`;
        transcriptBtn.classList.remove('is-pending', 'is-error');
      } else if (status === 'pending') {
        transcript.innerHTML = `<div class="video-note-transcript-status pending">${TEXT.pending}</div>`;
        transcriptBtn.classList.add('is-pending');
        transcriptBtn.classList.remove('is-error');
      } else if (status === 'error') {
        transcript.innerHTML = `<div class="video-note-transcript-status error">${escapeHtml(message.transcription_error || TEXT.defaultError)}</div>`;
        transcriptBtn.classList.remove('is-pending');
        transcriptBtn.classList.add('is-error');
      } else {
        transcript.innerHTML = `<div class="video-note-transcript-status">${TEXT.hidden}</div>`;
        transcriptBtn.classList.remove('is-pending', 'is-error');
      }

      this.syncTranscriptState(row, expanded);
      this.refreshPlaybackUi(row);
      this.refreshProgressUi(row);
      if (!video.paused && !video.ended) this.startProgressLoop(row);
    }

    toggleShape(row) {
      const message = row?.__messageData || {};
      if (!message?.is_video_note || !this.shapeRegistry?.setMessageShapeOverride) return;
      const nextShapeId = this.getEffectiveShapeId(message) === 'circle' ? 'banana-fat' : 'circle';
      this.shapeRegistry.setMessageShapeOverride(message, nextShapeId);
      this.refreshRow(row);
      this.playShapeSwitchAnimation(row, nextShapeId);
    }

    togglePlayback(row) {
      const video = row?.querySelector('.video-note-video');
      if (!video) return;
      if (video.paused) {
        if (video.ended) {
          try {
            video.currentTime = 0;
          } catch (error) {}
        }
        video.play().catch(() => {});
        return;
      }
      video.pause();
    }

    async toggleTranscript(row) {
      const message = row?.__messageData || {};
      const messageId = Number(message.id || row?.dataset?.msgId || 0);
      if (!messageId) return;

      const status = String(message.transcription_status || 'idle');
      if (status === 'idle' || status === 'error') {
        this.expandedIds.add(messageId);
        this.updateMessage(row, {
          transcription_status: 'pending',
          transcription_error: '',
        });
        try {
          const bridge = this.getBridge();
          if (!bridge?.api) throw new Error(TEXT.bridgeError);
          const response = await bridge.api(`/api/messages/${messageId}/transcribe`, { method: 'POST' });
          const patch = {
            transcription_status: response?.status || 'pending',
            transcription_text: response?.text || '',
            transcription_provider: response?.provider || '',
            transcription_model: response?.model || '',
            transcription_error: response?.error || '',
          };
          const resolvedChatId = Number(
            response?.chatId || row?.__messageData?.chat_id || row?.__messageData?.chatId || bridge?.getCurrentChatId?.() || 0
          );
          if (resolvedChatId && window.messageCache?.patchMessage) {
            window.messageCache.patchMessage(resolvedChatId, messageId, patch).catch(() => {});
          }
          if (patch.transcription_status === 'completed' && patch.transcription_text) {
            this.expandedIds.add(messageId);
            bridge?.updateReplyPreview?.(messageId, patch.transcription_text.substring(0, 100));
            if (row?.__replyPayload) row.__replyPayload.text = patch.transcription_text.substring(0, 100);
            document.querySelectorAll(`.msg-reply[data-reply-id="${messageId}"] .msg-reply-text`).forEach((el) => {
              el.textContent = patch.transcription_text.substring(0, 100);
            });
          }
          if (response?.status) {
            this.updateMessage(row, patch);
          }
        } catch (error) {
          this.updateMessage(row, {
            transcription_status: 'error',
            transcription_error: error.message || TEXT.requestError,
          });
        }
        return;
      }

      if (this.expandedIds.has(messageId)) this.expandedIds.delete(messageId);
      else this.expandedIds.add(messageId);
      this.refreshRow(row);
    }

    updateMessage(row, patch) {
      row.__messageData = { ...(row.__messageData || {}), ...(patch || {}) };
      this.refreshRow(row);
    }

    handleWSMessage(msg) {
      if (msg?.type !== 'message_transcription') return;
      const row = document.querySelector(`.msg-row[data-msg-id="${Number(msg.messageId || 0)}"]`);
      if (!row?.__messageData?.is_video_note) return;
      this.updateMessage(row, {
        transcription_status: msg.status || 'idle',
        transcription_text: msg.text || '',
        transcription_provider: msg.provider || '',
        transcription_model: msg.model || '',
        transcription_error: msg.error || '',
      });
      if (msg.status === 'completed' && msg.text) {
        this.expandedIds.add(Number(msg.messageId || 0));
        this.refreshRow(row);
      }
    }
  }

  ns.VideoNoteRenderer = VideoNoteRenderer;
})();
