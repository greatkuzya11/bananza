(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const messagesRoot = root.messages = root.messages || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createCallCardRenderer(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const dom = objectOrDefault(opts.dom);
    const actions = objectOrDefault(opts.actions);
    const formatters = objectOrDefault(opts.formatters || root.formatters);
    const api = typeof opts.api === 'function' ? opts.api : (() => Promise.resolve({}));
    const t = typeof opts.t === 'function' ? opts.t : (key) => String(key || '');
    const esc = typeof opts.esc === 'function' ? opts.esc : (typeof formatters.esc === 'function' ? formatters.esc : (value) => String(value ?? ''));
    const formatDuration = typeof opts.formatDuration === 'function' ? opts.formatDuration : (seconds) => {
      if (!seconds || !isFinite(seconds)) return '';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return m + ':' + String(s).padStart(2, '0');
    };
    const normalizeMimeType = typeof opts.normalizeMimeType === 'function' ? opts.normalizeMimeType : (typeof formatters.normalizeMimeType === 'function' ? formatters.normalizeMimeType : (value) => String(value || ''));
    const fileExtension = typeof opts.fileExtension === 'function' ? opts.fileExtension : (typeof formatters.fileExtension === 'function' ? formatters.fileExtension : (value) => String(value || '').split('.').pop());
    const clamp = typeof opts.clamp === 'function' ? opts.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
    const getToken = typeof opts.getToken === 'function' ? opts.getToken : () => '';
    const getCurrentUser = typeof opts.getCurrentUser === 'function' ? opts.getCurrentUser : () => null;
    const showCenterToast = typeof actions.showCenterToast === 'function' ? actions.showCenterToast : () => {};
    const copyTextToClipboard = typeof actions.copyTextToClipboard === 'function' ? actions.copyTextToClipboard : () => Promise.resolve(false);
    const openModal = typeof actions.openModal === 'function' ? actions.openModal : () => {};
    const closeModal = typeof actions.closeModal === 'function' ? actions.closeModal : () => {};
    const openMediaViewer = typeof actions.openMediaViewer === 'function' ? actions.openMediaViewer : () => {};
    const showMediaContextMenuForContext = typeof actions.showMediaContextMenuForContext === 'function' ? actions.showMediaContextMenuForContext : () => {};
    const getAbsoluteMessageMediaUrl = typeof actions.getAbsoluteMessageMediaUrl === 'function' ? actions.getAbsoluteMessageMediaUrl : (url) => String(url || '');
    const bindMediaPlaybackState = typeof actions.bindMediaPlaybackState === 'function' ? actions.bindMediaPlaybackState : () => {};
    const isMediaPlaybackCompleted = typeof actions.isMediaPlaybackCompleted === 'function' ? actions.isMediaPlaybackCompleted : () => false;
    const setMediaPlaybackCompleted = typeof actions.setMediaPlaybackCompleted === 'function' ? actions.setMediaPlaybackCompleted : () => false;
    const messagesEl = dom.messagesEl || doc.getElementById('messages');
    const $ = typeof opts.$ === 'function' ? opts.$ : (selector) => doc.querySelector(selector);
    const CALL_RECORDING_ROLE = 'call-recording-audio';
    const CALL_RECORDING_PROGRESS_STROKE_WIDTH = 3;
    const CALL_RECORDING_PROGRESS_HIT_RADIUS = 14;
    let callRecordingProgressCaptureInstalled = false;
    const callRecordingSeekRows = new Set();

    function resolveCallMessageMediaKind(msg, ...sources) {
      const fields = sources.map((source) => String(source?.media_kind || source?.mediaKind || '').toLowerCase());
      if (fields.includes('voice')) return 'voice';
      const texts = [
        msg?.text,
        ...sources.flatMap((source) => [source?.text, source?.title, source?.label]),
      ].map((value) => String(value || '').toLowerCase());
      if (sources.some((source) => String(source?.room_mode || source?.roomMode || '').toLowerCase() === 'room')) return 'voice';
      if (texts.some((value) => /\bvoice\s+(call|room)\b/.test(value))) return 'voice';
      return 'video';
    }
    
    
    
    function resolveCallMessageRoomMode(msg, ...sources) {
      if (sources.some((source) => String(source?.room_mode || source?.roomMode || '').toLowerCase() === 'room')) return 'room';
      if (String(msg?.text || '').toLowerCase().includes('voice room')) return 'room';
      return 'ringing';
    }
    
    
    
    function normalizeCallMessageData(msg) {
      const callMessage = msg?.call_message || {};
      const call = msg?.call || {};
      const rawCall = { ...callMessage, ...call };
      const id = Number(rawCall.id || rawCall.call_id || msg?.call_id || 0) || 0;
      const mediaKind = resolveCallMessageMediaKind(msg, callMessage, call, rawCall);
      const roomMode = resolveCallMessageRoomMode(msg, callMessage, call, rawCall);
      return {
        ...rawCall,
        id,
        media_kind: mediaKind,
        mediaKind,
        room_mode: roomMode,
        roomMode,
      };
    }
    
    
    
    function latestCallTranscriptRun(call) {
      return call?.primary_transcript_run
        || (Array.isArray(call?.transcript_runs) ? call.transcript_runs[0] : null)
        || null;
    }
    
    
    
    function latestCallArtifactBatch(call) {
      return call?.artifact_batch
        || (Array.isArray(call?.artifact_batches) ? call.artifact_batches[0] : null)
        || null;
    }
    
    
    
    function callArtifactProgress(batch) {
      const runs = Array.isArray(batch?.runs) ? batch.runs : [];
      if (!runs.length) return '';
      const ready = runs.filter((run) => run.status === 'completed').length;
      const failed = runs.filter((run) => run.status === 'error').length;
      const total = runs.length;
      if (failed) return `${callArtifactStatusLabel(batch.status || 'error')} ${ready}/${total}, ${t('Error')} ${failed}/${total}`;
      return `${callArtifactStatusLabel(batch.status || 'queued')} ${ready}/${total}`;
    }
    
    
    
    function pushCallMessageMeta(meta, icon, text, kind = '') {
      const value = String(text || '').trim();
      if (!value) return;
      if (meta.some((item) => item.kind === kind && item.text === value)) return;
      meta.push({ icon, text: value, kind });
    }
    
    
    
    function renderCallMessageMeta(meta) {
      const items = Array.isArray(meta) && meta.length
        ? meta
        : [{ icon: '&#128222;', text: t('Video call'), kind: 'default' }];
      return items
        .map((item) => {
          const kind = String(item?.kind || '').replace(/[^a-z0-9_-]/gi, '');
          const kindClass = kind ? ` call-message-meta-${kind}` : '';
          return `<span class="call-message-meta-item${kindClass}"><span class="call-message-meta-icon" aria-hidden="true">${item?.icon || '&#8226;'}</span><span class="call-message-meta-text">${esc(item?.text || '')}</span></span>`;
        })
        .join('');
    }
    
    
    
    function normalizeCallMixedRecording(call = {}) {
      const recording = call?.mixed_recording || call?.recording || null;
      if (!recording || String(recording.status || '').toLowerCase() !== 'completed') return null;
      const url = String(recording.url || '').trim();
      if (!url) return null;
      return {
        ...recording,
        url,
        duration_ms: recording.duration_ms == null ? null : Number(recording.duration_ms),
      };
    }
    
    
    
    function callRecordingPlaybackUrl(url) {
      const raw = String(url || '').trim();
      if (!raw || !getToken()) return raw;
      try {
        const parsed = new URL(raw, window.location.origin);
        parsed.searchParams.set('token', getToken());
        return parsed.pathname + parsed.search + parsed.hash;
      } catch {
        const separator = raw.includes('?') ? '&' : '?';
        return `${raw}${separator}token=${encodeURIComponent(getToken())}`;
      }
    }
    
    
    
    function callRecordingDurationSeconds(row, audio) {
      const mediaDuration = Number(audio?.duration || 0);
      if (Number.isFinite(mediaDuration) && mediaDuration > 0) return mediaDuration;
      const recordingMs = Number(row?.dataset?.callRecordingDurationMs || row?.querySelector?.('.call-recording-card')?.dataset?.callRecordingDurationMs || 0);
      if (Number.isFinite(recordingMs) && recordingMs > 0) return recordingMs / 1000;
      const messageDurationMs = Number(row?.__callRecordingCall?.duration_ms || 0);
      if (Number.isFinite(messageDurationMs) && messageDurationMs > 0) return messageDurationMs / 1000;
      return 0;
    }
    
    
    
    function parseCallRecordingRadiusValue(value) {
      const firstPart = String(value || '0').trim().split(/\s+/)[0] || '0';
      const parsed = Number.parseFloat(firstPart);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    
    
    
    function callRecordingRoundedRectPath(width, height, radii = {}, inset = 0) {
      const safeWidth = Math.max(1, Number(width) || 0);
      const safeHeight = Math.max(1, Number(height) || 0);
      const left = inset;
      const top = inset;
      const right = Math.max(left, safeWidth - inset);
      const bottom = Math.max(top, safeHeight - inset);
      const maxRadius = Math.max(0, Math.min(right - left, bottom - top) / 2);
      const topLeft = clamp(Number(radii.topLeft || 0) - inset, 0, maxRadius);
      const topRight = clamp(Number(radii.topRight || 0) - inset, 0, maxRadius);
      const bottomRight = clamp(Number(radii.bottomRight || 0) - inset, 0, maxRadius);
      const bottomLeft = clamp(Number(radii.bottomLeft || 0) - inset, 0, maxRadius);
      const commands = [`M ${left + topLeft} ${top}`, `H ${right - topRight}`];
      if (topRight > 0) commands.push(`A ${topRight} ${topRight} 0 0 1 ${right} ${top + topRight}`);
      else commands.push(`L ${right} ${top}`);
      commands.push(`V ${bottom - bottomRight}`);
      if (bottomRight > 0) commands.push(`A ${bottomRight} ${bottomRight} 0 0 1 ${right - bottomRight} ${bottom}`);
      else commands.push(`L ${right} ${bottom}`);
      commands.push(`H ${left + bottomLeft}`);
      if (bottomLeft > 0) commands.push(`A ${bottomLeft} ${bottomLeft} 0 0 1 ${left} ${bottom - bottomLeft}`);
      else commands.push(`L ${left} ${bottom}`);
      commands.push(`V ${top + topLeft}`);
      if (topLeft > 0) commands.push(`A ${topLeft} ${topLeft} 0 0 1 ${left + topLeft} ${top}`);
      else commands.push(`L ${left} ${top}`);
      commands.push('Z');
      return commands.join(' ');
    }
    
    
    
    function ensureCallRecordingFooterButton(row) {
      const footer = row?.querySelector?.('.msg-footer');
      if (!footer) return null;
      let button = footer.querySelector('.call-recording-play');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'voice-footer-play call-recording-play';
        button.setAttribute('aria-label', t('Play call recording'));
        footer.insertBefore(button, footer.firstChild);
      }
      return button;
    }
    
    
    
    function ensureCallRecordingProgress(row) {
      const card = row?.querySelector?.('.call-recording-card');
      const bubble = row?.querySelector?.('.msg-bubble');
      if (!row || !card || !bubble) return null;
      let controller = row.__callRecordingProgress || null;
      if (!controller) {
        controller = row.__callRecordingProgress = {};
      }
      controller.card = card;
      controller.bubble = bubble;
      controller.audio = row.querySelector('.call-recording-audio');
      controller.playButton = row.querySelector('.call-recording-play') || ensureCallRecordingFooterButton(row);
      controller.message = row.__messageData || {};
      controller.call = normalizeCallMessageData(controller.message);
      row.__callRecordingCall = controller.call;
      controller.recording = normalizeCallMixedRecording(controller.call);
      if (!controller.svg) {
        const shell = document.createElement('div');
        shell.className = 'call-recording-progress-shell';
        shell.innerHTML = `
          <svg class="call-recording-progress" viewBox="0 0 320 76" preserveAspectRatio="none" aria-hidden="true">
            <path class="call-recording-progress-track"></path>
            <path class="call-recording-progress-fill"></path>
            <path class="call-recording-progress-press"></path>
            <path class="call-recording-progress-hit"></path>
          </svg>
        `;
        bubble.insertBefore(shell, bubble.firstChild);
        controller.shell = shell;
        controller.svg = shell.querySelector('.call-recording-progress');
        controller.track = shell.querySelector('.call-recording-progress-track');
        controller.fill = shell.querySelector('.call-recording-progress-fill');
        controller.press = shell.querySelector('.call-recording-progress-press');
        controller.hit = shell.querySelector('.call-recording-progress-hit');
      } else if (controller.shell?.parentNode !== bubble) {
        bubble.insertBefore(controller.shell, bubble.firstChild);
      }
      refreshCallRecordingProgressShape(row);
      return controller;
    }
    
    
    
    function refreshCallRecordingProgressShape(row) {
      const controller = row?.__callRecordingProgress;
      if (!controller?.bubble || !controller.svg) return;
      const rect = controller.bubble.getBoundingClientRect?.() || {};
      const width = Math.max(120, Math.round(Number(rect.width || controller.bubble.offsetWidth || 320)));
      const height = Math.max(48, Math.round(Number(rect.height || controller.bubble.offsetHeight || 76)));
      const styles = window.getComputedStyle(controller.bubble);
      const d = callRecordingRoundedRectPath(width, height, {
        topLeft: parseCallRecordingRadiusValue(styles.borderTopLeftRadius),
        topRight: parseCallRecordingRadiusValue(styles.borderTopRightRadius),
        bottomRight: parseCallRecordingRadiusValue(styles.borderBottomRightRadius),
        bottomLeft: parseCallRecordingRadiusValue(styles.borderBottomLeftRadius),
      }, CALL_RECORDING_PROGRESS_STROKE_WIDTH / 2 + 0.5);
      controller.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      [controller.track, controller.fill, controller.press, controller.hit].forEach((pathEl) => {
        if (!pathEl) return;
        pathEl.setAttribute('d', d);
        pathEl.style.strokeDasharray = '';
        pathEl.style.strokeDashoffset = '';
      });
      try {
        controller.pathLength = Number(controller.fill?.getTotalLength?.() || controller.track?.getTotalLength?.() || 0);
      } catch {
        controller.pathLength = 0;
      }
      updateCallRecordingProgress(row);
    }
    
    
    
    function updateCallRecordingProgress(row) {
      const controller = row?.__callRecordingProgress;
      const audio = controller?.audio;
      if (!controller?.fill || !audio) return;
      const duration = callRecordingDurationSeconds(row, audio);
      const completed = Boolean(isMediaPlaybackCompleted(row.__messageData || {}, CALL_RECORDING_ROLE));
      const isPlaying = Boolean(!audio.paused && !audio.ended);
      const progress = completed && !isPlaying
        ? 1
        : (duration > 0 ? Math.max(0, Math.min(1, Number(audio.currentTime || 0) / duration)) : 0);
      const length = Number(controller.pathLength || 0);
      if (length > 0) {
        controller.fill.setAttribute('stroke-dasharray', `${length * progress} ${Math.max(0, length * (2 - progress))}`);
        controller.fill.setAttribute('stroke-dashoffset', '0');
        controller.fill.style.opacity = progress > 0 ? '1' : '.02';
      }
      row.classList.toggle('call-recording-playing', isPlaying);
      row.classList.toggle('call-recording-completed', completed && !isPlaying);
      syncCallRecordingPlayButton(controller.playButton, isPlaying);
    }
    
    
    
    function syncCallRecordingPlayButton(button, isPlaying) {
      if (!button) return;
      button.textContent = isPlaying ? '\u275a\u275a' : '\u25b6';
      button.classList.toggle('is-playing', Boolean(isPlaying));
      button.setAttribute('aria-label', t(isPlaying ? 'Pause call recording' : 'Play call recording'));
      button.setAttribute('title', t(isPlaying ? 'Pause call recording' : 'Play call recording'));
    }
    
    
    
    function pointToCallRecordingHit(controller, event) {
      const pathEl = controller?.hit || controller?.fill || controller?.track;
      const svg = controller?.svg;
      if (!pathEl || !svg || typeof pathEl.getTotalLength !== 'function' || typeof pathEl.getPointAtLength !== 'function') return null;
      const svgRect = svg.getBoundingClientRect?.();
      if (!svgRect || !(svgRect.width > 0) || !(svgRect.height > 0)) return null;
      const rawViewBox = String(svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
      const vbX = rawViewBox[0] || 0;
      const vbY = rawViewBox[1] || 0;
      const vbW = rawViewBox[2] || svgRect.width;
      const vbH = rawViewBox[3] || svgRect.height;
      let total = Number(controller.pathLength || 0);
      if (!(total > 0)) {
        try {
          total = Number(pathEl.getTotalLength() || 0);
        } catch {
          total = 0;
        }
      }
      if (!(total > 0)) return null;
      const x = Number(event.clientX || 0);
      const y = Number(event.clientY || 0);
      const samples = 96;
      let best = null;
      for (let index = 0; index <= samples; index += 1) {
        const length = total * (index / samples);
        let point;
        try {
          point = pathEl.getPointAtLength(length);
        } catch {
          continue;
        }
        const px = svgRect.left + ((Number(point.x || 0) - vbX) / vbW) * svgRect.width;
        const py = svgRect.top + ((Number(point.y || 0) - vbY) / vbH) * svgRect.height;
        const distance = Math.hypot(px - x, py - y);
        if (!best || distance < best.distance) best = { distance, length, total };
      }
      if (!best) return null;
      return {
        ...best,
        progress: Math.max(0, Math.min(1, best.length / best.total)),
      };
    }
    
    
    
    function shouldIgnoreCallRecordingPointer(event) {
      const target = event?.target;
      if (!(target instanceof Element)) return false;
      if (target.closest('.call-recording-progress-hit')) return true;
      if (!target.closest('.call-recording-card')) return true;
      return Boolean(target.closest('button, a, input, textarea, select, [role="button"], .call-message-actions, .msg-reply, .reaction-chip, .msg-delete-btn'));
    }
    
    
    
    function isPointerNearCallRecordingProgressRect(controller, event) {
      const rect = controller?.svg?.getBoundingClientRect?.();
      if (!rect || !(rect.width > 0) || !(rect.height > 0)) return false;
      const x = Number(event.clientX || 0);
      const y = Number(event.clientY || 0);
      const pad = CALL_RECORDING_PROGRESS_HIT_RADIUS + 2;
      if (x < rect.left - pad || x > rect.right + pad || y < rect.top - pad || y > rect.bottom + pad) return false;
      const edgeDistance = Math.min(
        Math.abs(x - rect.left),
        Math.abs(x - rect.right),
        Math.abs(y - rect.top),
        Math.abs(y - rect.bottom)
      );
      return edgeDistance <= pad;
    }
    
    
    
    function getCallRecordingSeekRows() {
      const rows = [];
      callRecordingSeekRows.forEach((row) => {
        if (!row?.isConnected) {
          callRecordingSeekRows.delete(row);
          return;
        }
        rows.push(row);
      });
      return rows;
    }
    
    
    
    function seekCallRecordingProgress(row, event, hit = null) {
      const controller = row?.__callRecordingProgress || ensureCallRecordingProgress(row);
      const audio = controller?.audio;
      if (!controller || !audio) return false;
      const resolvedHit = hit || pointToCallRecordingHit(controller, event);
      if (!resolvedHit) return false;
      const duration = callRecordingDurationSeconds(row, audio);
      if (!(duration > 0)) return false;
      const targetTime = Math.max(0, Math.min(duration, duration * resolvedHit.progress));
      const wasPaused = Boolean(audio.paused || audio.ended);
      try {
        audio.currentTime = targetTime;
      } catch {}
      setMediaPlaybackCompleted(row.__messageData || {}, CALL_RECORDING_ROLE, false);
      updateCallRecordingProgress(row);
      if (!wasPaused) {
        Promise.resolve(audio.play?.()).catch(() => {});
      }
      if (event) {
        event.preventDefault?.();
        event.stopPropagation?.();
        event.stopImmediatePropagation?.();
      }
      return true;
    }
    
    
    
    function resolveNearestCallRecordingHit(event) {
      if (!messagesEl || shouldIgnoreCallRecordingPointer(event)) return null;
      const candidates = [];
      getCallRecordingSeekRows().forEach((row) => {
        const controller = row.__callRecordingProgress || ensureCallRecordingProgress(row);
        if (!controller?.audio || !controller.hit) return;
        const duration = callRecordingDurationSeconds(row, controller.audio);
        if (!(duration > 0)) return;
        if (!isPointerNearCallRecordingProgressRect(controller, event)) return;
        const hit = pointToCallRecordingHit(controller, event);
        if (hit && hit.distance <= CALL_RECORDING_PROGRESS_HIT_RADIUS) candidates.push({ row, hit });
      });
      candidates.sort((a, b) => a.hit.distance - b.hit.distance);
      return candidates[0] || null;
    }
    
    
    
    function installCallRecordingProgressCapture() {
      if (callRecordingProgressCaptureInstalled) return;
      callRecordingProgressCaptureInstalled = true;
      document.addEventListener('pointerdown', (event) => {
        if (event.button != null && event.button !== 0) return;
        const best = resolveNearestCallRecordingHit(event);
        if (!best) return;
        best.row.classList.add('call-recording-progress-pressed');
        const clearPressed = () => best.row.classList.remove('call-recording-progress-pressed');
        document.addEventListener('pointerup', clearPressed, { once: true, capture: true });
        document.addEventListener('pointercancel', clearPressed, { once: true, capture: true });
        seekCallRecordingProgress(best.row, event, best.hit);
      }, true);
    }
    
    
    
    function renderCallMessageCard(msg) {
      const call = normalizeCallMessageData(msg);
      const status = String(call.status || 'active');
      const active = status === 'active' && call.can_join !== false;
      const duration = Number(call.duration_ms || 0);
      const notes = call.ai_notes || null;
      const mediaKind = String(call.media_kind || call.mediaKind || '').toLowerCase() === 'voice' ? 'voice' : 'video';
      const roomMode = String(call.room_mode || call.roomMode || '').toLowerCase() === 'room' ? 'room' : 'ringing';
      const voice = mediaKind === 'voice';
      const voiceRoom = voice && roomMode === 'room';
      const typeLabel = voiceRoom ? t('Voice room') : (voice ? t('Audio call') : t('Video call'));
      const labels = {
        active: voiceRoom ? t('Voice room active') : (voice ? t('Audio call started') : t('Video call started')),
        ended: voiceRoom ? t('Voice room ended') : (voice ? t('Audio call ended') : t('Video call ended')),
        missed: voice ? t('Audio call missed') : t('Video call missed'),
        declined: voice ? t('Audio call declined') : t('Video call declined'),
        failed: voice ? t('Audio call failed') : t('Video call failed'),
      };
      const meta = [];
      pushCallMessageMeta(meta, voice ? '&#9742;&#65039;' : '&#128249;', typeLabel, 'kind');
      pushCallMessageMeta(meta, '&#128100;', call.started_by_name ? t('Started by {name}', { name: call.started_by_name }) : '', 'started');
      pushCallMessageMeta(meta, '&#9201;', duration > 0 ? t('Duration {duration}', { duration: formatDuration(duration / 1000) }) : '', 'duration');
      if (notes?.status === 'recording') pushCallMessageMeta(meta, '&#127908;', t('AI notes recording'), 'ai-recording');
      else if (notes?.transcript_status === 'processing' || notes?.status === 'processing') pushCallMessageMeta(meta, '&#128221;', t('Transcript processing'), 'transcript');
      else if (notes?.transcript_status === 'completed' && notes?.transcript_ready) pushCallMessageMeta(meta, '&#128221;', t('Transcript ready'), 'transcript');
      else if (notes?.transcript_status === 'error') pushCallMessageMeta(meta, '&#9888;', t('Transcription error'), 'error');
      const recording = normalizeCallMixedRecording(call);
      const recordingUrl = recording?.url || '';
      const recordingDurationMs = Number(recording?.duration_ms || duration || 0);
      const actions = [];
      if (active) {
        const alreadyInside = Boolean(window.BananzaCallHooks?.isCurrentCall?.(call.id));
        const joinLabel = alreadyInside ? t('Open') : (voiceRoom ? t('Join voice room') : t('Join call'));
        actions.push(`<button type="button" class="call-message-action primary" data-call-card-join="${Number(call.id || 0)}">${esc(joinLabel)}</button>`);
        const user = getCurrentUser() || {};
        const canCopyExternalLink = Boolean(Number(call.id || 0) && (user.is_admin || Number(user.id || 0) === Number(call.started_by || 0)));
        if (canCopyExternalLink) {
          actions.push(`<button type="button" class="call-message-action" data-call-card-copy-link="${Number(call.id || 0)}">${esc(t('Copy call link'))}</button>`);
        }
      }
      if (!active && Number(call.id || 0)) {
        const transcriptRun = latestCallTranscriptRun(call);
        const transcriptStatus = String(transcriptRun?.status || '');
        const batch = latestCallArtifactBatch(call);
        const batchStatus = String(batch?.status || '');
        const artifactsReadyToOpen = ['completed', 'partial', 'error'].includes(batchStatus);
        const hasTranscriptionSource = Boolean(recordingUrl || notes || transcriptRun || batch);
        if (hasTranscriptionSource) {
          if (transcriptStatus === 'completed' || notes?.transcript_ready) {
            pushCallMessageMeta(meta, '&#128221;', t('Transcript ready'), 'transcript');
            actions.push(`<button type="button" class="call-message-action" data-call-card-transcript="${Number(call.id || 0)}">${esc(t('Transcript'))}</button>`);
          } else if (transcriptStatus === 'queued' || transcriptStatus === 'processing') {
            pushCallMessageMeta(meta, '&#128221;', t('Transcript processing'), 'transcript');
            actions.push(`<button type="button" class="call-message-action" disabled>${esc(t('Transcript processing'))}</button>`);
          } else if (transcriptStatus === 'error') {
            pushCallMessageMeta(meta, '&#9888;', transcriptRun?.error || t('Transcription error'), 'error');
            actions.push(`<button type="button" class="call-message-action" data-call-card-transcribe-retry="${Number(call.id || 0)}">${esc(t('Retry'))}</button>`);
          } else {
            actions.push(`<button type="button" class="call-message-action" data-call-card-transcribe="${Number(call.id || 0)}">${esc(t('Transcribe'))}</button>`);
          }
        }
        if (batch) {
          const progress = callArtifactProgress(batch);
          if (progress) pushCallMessageMeta(meta, '&#129504;', progress, 'summary');
        }
        if (hasTranscriptionSource && transcriptStatus === 'completed') {
          if (batchStatus === 'queued' || batchStatus === 'processing') {
            actions.push(`<button type="button" class="call-message-action" disabled>${esc(t('AI summary'))}...</button>`);
          } else {
            actions.push(`<button type="button" class="call-message-action" data-call-card-artifacts="${Number(call.id || 0)}">${esc(t('AI summary'))}</button>`);
          }
        } else if (hasTranscriptionSource && artifactsReadyToOpen) {
          actions.push(`<button type="button" class="call-message-action" data-call-card-artifacts="${Number(call.id || 0)}">${esc(t('AI summary'))}</button>`);
        }
      }
      const playbackHtml = recordingUrl ? `
        <audio class="call-recording-audio" preload="metadata" src="${esc(callRecordingPlaybackUrl(recordingUrl))}"></audio>
      ` : '';
      const iconClass = voice ? 'call-message-icon-voice' : 'call-message-icon-video';
      const cardIcon = voice ? '&#9742;&#65039;' : '&#128249;';
      return `
        <div class="call-message-card call-recording-card${recordingUrl ? ' has-call-recording' : ''}${voice ? ' is-voice-call-card' : ' is-video-call-card'}" data-call-card="${Number(call.id || 0)}" data-call-recording-duration-ms="${Number(recordingDurationMs || 0)}">
          ${playbackHtml}
          <div class="call-message-icon ${iconClass}" aria-hidden="true">${cardIcon}</div>
          <div class="call-message-main">
            <div class="call-message-title">${esc(labels[status] || labels.active)}</div>
            <div class="call-message-meta">${renderCallMessageMeta(meta)}</div>
          </div>
          ${actions.length ? `<div class="call-message-actions">${actions.join('')}</div>` : ''}
        </div>
      `;
    }
    
    
    
    function renderCallTranscriptRunCard(msg) {
      const run = msg?.call_transcript_run || {};
      const status = String(run.status || 'queued');
      const provider = run.resolved_provider || run.provider || 'voice';
      const strategy = run.strategy_label || run.strategy || 'transcript';
      const labels = {
        queued: t('Transcript queued'),
        processing: t('Transcript processing'),
        completed: t('Transcript ready'),
        error: t('Transcription error'),
        canceled: t('Canceled'),
      };
      const meta = [`${provider} / ${strategy}`];
      if (run.model) meta.push(run.model);
      if (run.error && status === 'error') meta.push(run.error);
      const actions = [];
      if (run.transcript_ready || status === 'completed') {
        actions.push(`<button type="button" class="call-message-action" data-call-transcript-run="${Number(run.id || 0)}">${esc(t('Transcript'))}</button>`);
      }
      return `
        <div class="call-message-card call-transcript-card" data-call-transcript-card="${Number(run.id || 0)}">
          <div class="call-message-icon" aria-hidden="true">\u2630</div>
          <div class="call-message-main">
            <div class="call-message-title">${esc(labels[status] || labels.queued)}</div>
            <div class="call-message-meta">${esc(meta.filter(Boolean).join(' / '))}</div>
          </div>
          ${actions.length ? `<div class="call-message-actions">${actions.join('')}</div>` : ''}
        </div>
      `;
    }
    
    
    
    function callArtifactStatusLabel(status) {
      const labels = {
        queued: t('Queued'),
        processing: t('Processing'),
        completed: t('Ready'),
        partial: t('Partially ready'),
        error: t('Error'),
        canceled: t('Canceled'),
        skipped: t('Skipped'),
      };
      return labels[status] || status || '';
    }
    
    
    
    function callArtifactStatusKind(status) {
      const raw = String(status || 'queued').trim().toLowerCase();
      return ['queued', 'processing', 'completed', 'partial', 'error', 'canceled', 'skipped'].includes(raw)
        ? raw
        : 'queued';
    }
    
    
    
    function callArtifactKey(run = {}) {
      return String(run.artifact_key || run.key || '').trim();
    }
    
    
    
    function callArtifactLabel(run = {}) {
      const key = callArtifactKey(run);
      if (key) {
        const translated = t(`callArtifact.${key}`);
        if (translated && translated !== `callArtifact.${key}`) return translated;
      }
      return String(run.label || key || t('Artifact')).trim();
    }
    
    
    
    function renderCallArtifactStatus(status) {
      const kind = callArtifactStatusKind(status);
      const label = callArtifactStatusLabel(kind);
      if (kind === 'completed') {
        return `<span class="call-artifact-status is-completed is-icon-only" aria-label="${esc(label)}" title="${esc(label)}"><span aria-hidden="true">&#10003;</span></span>`;
      }
      return `<span class="call-artifact-status is-${kind}">${esc(label)}</span>`;
    }
    
    
    
    function callArtifactTextShouldCollapse(text) {
      const source = String(text || '').trim();
      if (!source) return false;
      return source.split(/\r?\n/).length > 20 || source.length > 1800;
    }
    
    
    
    function renderCallArtifactTextLine(line, index) {
      const text = String(line || '').trimEnd();
      const heading = text.match(/^\s*#{1,6}\s+(.+)$/);
      if (heading) return `<h4>${esc(heading[1].trim())}</h4>`;
      const bullet = text.match(/^\s*[-*]\s+(.+)$/);
      if (bullet) return `<div class="call-artifact-list-line"><span aria-hidden="true">-</span><p>${esc(bullet[1].trim())}</p></div>`;
      const ordered = text.match(/^\s*(\d+[.)])\s+(.+)$/);
      if (ordered) return `<div class="call-artifact-list-line"><span>${esc(ordered[1])}</span><p>${esc(ordered[2].trim())}</p></div>`;
      if (!text.trim()) return index === 0 ? '' : '<div class="call-artifact-spacer" aria-hidden="true"></div>';
      return `<p>${esc(text.trim())}</p>`;
    }
    
    
    
    function renderCallArtifactText(text, runId = 0) {
      const source = String(text || '').trim();
      if (!source) return '';
      const collapsed = callArtifactTextShouldCollapse(source);
      const lines = source.split(/\r?\n/);
      return `
        <div class="call-artifact-text${collapsed ? ' is-collapsed' : ''}" data-call-artifact-text="${Number(runId || 0)}">
          ${lines.map(renderCallArtifactTextLine).join('')}
        </div>
        ${collapsed ? `<button type="button" class="call-admin-btn call-artifact-more" data-call-artifact-more="${Number(runId || 0)}"><span>${esc(t('Show more'))}</span><span class="call-artifact-more-icon" aria-hidden="true">&#8594;</span></button>` : ''}
      `;
    }
    
    
    
    function callArtifactImageUrl(run = {}) {
      return String(run?.file?.url || '').trim();
    }
    
    
    
    function callArtifactImageMime(run = {}) {
      return normalizeMimeType(run?.file?.mime_type || run?.file?.mime || 'image/png') || 'image/png';
    }
    
    
    
    function callArtifactImageFilename(run = {}) {
      const file = run?.file || {};
      let name = String(file.original_name || file.originalName || file.name || file.stored_name || file.storedName || '').trim();
      if (!name) name = String(callArtifactLabel(run) || 'callshot').trim() || 'callshot';
      if (!fileExtension(name)) {
        const mime = callArtifactImageMime(run);
        name += mime === 'image/jpeg' ? '.jpg' : (mime === 'image/webp' ? '.webp' : '.png');
      }
      return name;
    }
    
    
    
    function callArtifactImageContext(run = {}, mediaTarget = null) {
      const previewUrl = callArtifactImageUrl(run);
      const absoluteUrl = getAbsoluteMessageMediaUrl(previewUrl);
      if (!absoluteUrl) return null;
      return {
        row: null,
        msg: { id: 0 },
        mediaTarget,
        mediaKind: 'image',
        mediaKindLabel: 'Image',
        previewUrl,
        downloadUrl: previewUrl,
        absoluteUrl,
        filename: callArtifactImageFilename(run),
        mime: callArtifactImageMime(run),
        copyText: '',
        canCopyText: false,
        canReply: false,
        canForward: false,
        canSaveNote: false,
        canEdit: false,
        canReact: false,
        pinState: { show: false, isPinned: false, disabled: true },
        mediaContextKey: `call-artifact:${Number(run?.id || 0)}:${absoluteUrl}`,
      };
    }
    
    
    
    function renderCallArtifactImage(run = {}) {
      const src = callArtifactImageUrl(run);
      if (!src) return '';
      const label = callArtifactLabel(run);
      return `
        <button type="button" class="call-artifact-image-button" data-call-artifact-image="${Number(run?.id || 0)}" aria-label="${esc(t('Open'))} ${esc(label)}">
          <img class="call-artifact-image" src="${esc(src)}" alt="${esc(label)}">
        </button>
      `;
    }
    
    
    
    function renderCallArtifactRun(run) {
      const status = callArtifactStatusKind(run?.status);
      const hasBody = Boolean(run?.result_text || run?.file?.url || run?.error);
      return `
        <section class="call-artifact-item" data-call-artifact-item="${Number(run?.id || 0)}">
          <div class="call-artifact-head">
            <strong class="call-artifact-title">${esc(callArtifactLabel(run))}</strong>
            ${renderCallArtifactStatus(status)}
          </div>
          ${run?.file?.url ? renderCallArtifactImage(run) : ''}
          ${run?.result_text ? renderCallArtifactText(run.result_text, run.id) : ''}
          ${run?.error ? `<div class="call-artifact-error">${esc(run.error)}</div>` : ''}
          ${!hasBody ? `<div class="call-artifact-placeholder">${esc(callArtifactStatusLabel(status))}</div>` : ''}
          ${status === 'error' ? `<div class="call-artifact-actions"><button type="button" class="call-admin-btn" data-call-artifact-retry="${Number(run?.id || 0)}">${esc(t('Retry'))}</button></div>` : ''}
        </section>
      `;
    }
    
    
    
    function renderCallArtifactBatchCard(msg) {
      const batch = msg?.call_artifact_batch || {};
      const runs = Array.isArray(batch.runs) ? batch.runs : [];
      const ready = runs.filter((run) => run.status === 'completed').length;
      const total = runs.length;
      const meta = [`${ready}/${total || 0}`, callArtifactStatusLabel(batch.status || 'queued')].filter(Boolean);
      const preview = runs
        .filter((run) => run.status === 'completed' && run.result_text)
        .slice(0, 2)
        .map((run) => `${callArtifactLabel(run)}: ${String(run.result_text || '').slice(0, 140)}`)
        .join(' / ');
      return `
        <div class="call-message-card call-artifact-card" data-call-artifact-card="${Number(batch.id || 0)}">
          <div class="call-message-icon" aria-hidden="true">AI</div>
          <div class="call-message-main">
            <div class="call-message-title">${esc(t('Call AI summary'))}</div>
            <div class="call-message-meta">${esc(meta.join(' / '))}</div>
            ${preview ? `<div class="call-message-meta">${esc(preview)}</div>` : ''}
          </div>
          <div class="call-message-actions">
            <button type="button" class="call-message-action" data-call-artifacts-open="${Number(batch.id || 0)}">${esc(t('Open'))}</button>
          </div>
        </div>
      `;
    }
    
    
    
    function bindCallMessageControls(row) {
      const message = row?.__messageData || {};
      const call = normalizeCallMessageData(message);
      if (!call?.id) return;
      const recording = normalizeCallMixedRecording(call);
      const audio = row.querySelector('.call-recording-audio');
      if (recording && audio && audio.getAttribute('src') !== callRecordingPlaybackUrl(recording.url)) {
        audio.setAttribute('src', callRecordingPlaybackUrl(recording.url));
      }
      const playButton = recording && audio ? ensureCallRecordingFooterButton(row) : null;
      row.classList.toggle('call-recording-message', Boolean(recording && audio));
      if (!recording || !audio) callRecordingSeekRows.delete(row);
      if (recording && audio) {
        callRecordingSeekRows.add(row);
        row.dataset.callRecordingDurationMs = String(Number(recording.duration_ms || call.duration_ms || 0) || 0);
        bindMediaPlaybackState(audio, message, CALL_RECORDING_ROLE);
        const controller = ensureCallRecordingProgress(row);
        installCallRecordingProgressCapture();
        syncCallRecordingPlayButton(playButton, false);
        ['loadedmetadata', 'durationchange', 'timeupdate', 'seeking', 'seeked', 'play', 'pause', 'ended'].forEach((eventName) => {
          audio.addEventListener(eventName, () => updateCallRecordingProgress(row));
        });
        audio.addEventListener('play', () => {
          messagesEl?.querySelectorAll?.('.call-recording-audio')?.forEach((otherAudio) => {
            if (otherAudio === audio || otherAudio.paused) return;
            try {
              otherAudio.pause();
            } catch {}
          });
        });
        playButton?.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (audio.paused || audio.ended) {
            if (audio.ended) {
              try { audio.currentTime = 0; } catch {}
            }
            setMediaPlaybackCompleted(message, CALL_RECORDING_ROLE, false);
            Promise.resolve(audio.play?.()).catch(() => {});
          } else {
            try { audio.pause?.(); } catch {}
          }
          updateCallRecordingProgress(row);
        });
        controller?.hit?.addEventListener('pointerdown', (event) => {
          row.classList.add('call-recording-progress-pressed');
          const clearPressed = () => row.classList.remove('call-recording-progress-pressed');
          document.addEventListener('pointerup', clearPressed, { once: true, capture: true });
          document.addEventListener('pointercancel', clearPressed, { once: true, capture: true });
          seekCallRecordingProgress(row, event);
        });
        requestAnimationFrame(() => refreshCallRecordingProgressShape(row));
        if (typeof ResizeObserver !== 'undefined' && !row.__callRecordingResizeObserver) {
          row.__callRecordingResizeObserver = new ResizeObserver(() => refreshCallRecordingProgressShape(row));
          const bubble = row.querySelector('.msg-bubble');
          if (bubble) row.__callRecordingResizeObserver.observe(bubble);
        }
        updateCallRecordingProgress(row);
      }
      row.querySelector('[data-call-card-join]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        const button = event.currentTarget;
        if (button) button.disabled = true;
        Promise.resolve(window.BananzaCallHooks?.joinCallFromMessage?.(call))
          .then(() => {
            if (button && window.BananzaCallHooks?.isCurrentCall?.(call.id)) button.textContent = t('Open');
          })
          .catch((error) => {
            console.warn('[calls] join from message failed:', error?.message || error);
            showCenterToast(t('Could not join call'));
          })
          .finally(() => {
            if (button) button.disabled = false;
          });
      });
      row.querySelector('[data-call-card-copy-link]')?.addEventListener('click', async (event) => {
        event.stopPropagation();
        const button = event.currentTarget;
        if (!Number(call.id || 0)) return;
        button.disabled = true;
        try {
          const data = await api(`/api/calls/${Number(call.id || 0)}/external-link`, { method: 'POST', body: {} });
          const link = data?.external_url || data?.url || data?.external_path || '';
          const copied = await copyTextToClipboard(link);
          showCenterToast(copied ? t('Call link copied') : t('Could not copy call link'));
        } catch (error) {
          showCenterToast(error.message || t('Could not copy call link'));
        } finally {
          button.disabled = false;
        }
      });
      row.querySelector('[data-call-card-transcript]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        const run = latestCallTranscriptRun(call);
        if (run?.id) window.BananzaCallHooks?.openTranscriptRun?.(Number(run.id));
        else window.BananzaCallHooks?.openTranscript?.(call.id);
      });
      row.querySelector('[data-call-card-transcribe]')?.addEventListener('click', async (event) => {
        event.stopPropagation();
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await api(`/api/calls/${Number(call.id || 0)}/transcribe`, { method: 'POST', body: {} });
        } catch (error) {
          showCenterToast(error.message || t('Could not start transcription'));
        } finally {
          button.disabled = false;
        }
      });
      row.querySelector('[data-call-card-transcribe-retry]')?.addEventListener('click', async (event) => {
        event.stopPropagation();
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await api(`/api/calls/${Number(call.id || 0)}/transcribe/retry`, { method: 'POST', body: {} });
        } catch (error) {
          showCenterToast(error.message || t('Could not start transcription'));
        } finally {
          button.disabled = false;
        }
      });
      row.querySelector('[data-call-card-artifacts]')?.addEventListener('click', async (event) => {
        event.stopPropagation();
        const button = event.currentTarget;
        const existing = latestCallArtifactBatch(call);
        if (existing && ['completed', 'partial', 'error'].includes(String(existing.status || ''))) {
          openCallArtifactsModal(existing);
          return;
        }
        button.disabled = true;
        try {
          const result = await api(`/api/calls/${Number(call.id || 0)}/artifacts`, { method: 'POST', body: {} });
          if (result?.batch && ['completed', 'partial', 'error'].includes(String(result.batch.status || ''))) {
            openCallArtifactsModal(result.batch);
          }
        } catch (error) {
          showCenterToast(error.message || t('Could not start AI summary'));
        } finally {
          button.disabled = false;
        }
      });
    }
    
    
    
    function openCallArtifactsModal(batch) {
      if (!batch) return;
      let modal = $('#callArtifactsModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'callArtifactsModal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
          <div class="modal-content call-artifacts-modal">
            <div class="modal-header">
              <h3>${esc(t('Call AI summary'))}</h3>
              <button type="button" class="modal-close" id="callArtifactsClose" aria-label="${esc(t('Close'))}">&#10005;</button>
            </div>
            <div id="callArtifactsBody" class="modal-body call-artifacts-body"></div>
          </div>
        `;
        document.body.appendChild(modal);
        $('#callArtifactsClose')?.addEventListener('click', () => closeModal('callArtifactsModal'));
        modal.addEventListener('click', (event) => {
          if (event.target === modal) closeModal('callArtifactsModal');
        });
      }
      const body = $('#callArtifactsBody');
      const runs = Array.isArray(batch.runs) ? batch.runs : [];
      if (body) {
        const runsById = new Map(runs.map((run) => [Number(run?.id || 0), run]));
        body.innerHTML = runs.map(renderCallArtifactRun).join('') || `<div class="call-artifacts-empty">${esc(t('No artifacts yet'))}</div>`;
        body.querySelectorAll('[data-call-artifact-more]').forEach((button) => {
          button.addEventListener('click', () => {
            const id = Number(button.dataset.callArtifactMore || 0);
            const text = body.querySelector(`[data-call-artifact-text="${id}"]`);
            text?.classList.remove('is-collapsed');
            button.remove();
          });
        });
        body.querySelectorAll('[data-call-artifact-retry]').forEach((button) => {
          button.addEventListener('click', async () => {
            button.disabled = true;
            try {
              await api(`/api/calls/artifact-runs/${Number(button.dataset.callArtifactRetry || 0)}/retry`, { method: 'POST', body: {} });
              closeModal('callArtifactsModal');
            } catch (error) {
              showCenterToast(error.message || t('Could not retry artifact'));
            } finally {
              button.disabled = false;
            }
          });
        });
        body.querySelectorAll('[data-call-artifact-image]').forEach((button) => {
          const run = runsById.get(Number(button.dataset.callArtifactImage || 0));
          const src = callArtifactImageUrl(run);
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (src) openMediaViewer(src, 'image');
          });
          button.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const context = callArtifactImageContext(run, button);
            if (!context) return;
            showMediaContextMenuForContext(context, {
              target: button,
              x: event.clientX,
              y: event.clientY,
              source: 'contextmenu',
            });
          });
        });
      }
      openModal('callArtifactsModal');
    }
    
    
    
    function bindCallArtifactMessageControls(row) {
      row.querySelector('[data-call-artifacts-open]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        openCallArtifactsModal(row.__messageData?.call_artifact_batch);
      });
    }
    
    
    
    function bindCallTranscriptMessageControls(row) {
      row.querySelector('[data-call-transcript-run]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        window.BananzaCallHooks?.openTranscriptRun?.(Number(event.currentTarget.dataset.callTranscriptRun || 0));
      });
    }
    
    

    return {
      resolveCallMessageMediaKind,
      resolveCallMessageRoomMode,
      normalizeCallMessageData,
      latestCallTranscriptRun,
      latestCallArtifactBatch,
      callArtifactProgress,
      pushCallMessageMeta,
      renderCallMessageMeta,
      normalizeCallMixedRecording,
      callRecordingPlaybackUrl,
      callRecordingDurationSeconds,
      parseCallRecordingRadiusValue,
      callRecordingRoundedRectPath,
      ensureCallRecordingFooterButton,
      ensureCallRecordingProgress,
      refreshCallRecordingProgressShape,
      updateCallRecordingProgress,
      syncCallRecordingPlayButton,
      pointToCallRecordingHit,
      shouldIgnoreCallRecordingPointer,
      isPointerNearCallRecordingProgressRect,
      getCallRecordingSeekRows,
      seekCallRecordingProgress,
      resolveNearestCallRecordingHit,
      installCallRecordingProgressCapture,
      renderCallMessageCard,
      renderCallTranscriptRunCard,
      callArtifactStatusLabel,
      callArtifactStatusKind,
      callArtifactKey,
      callArtifactLabel,
      renderCallArtifactStatus,
      callArtifactTextShouldCollapse,
      renderCallArtifactTextLine,
      renderCallArtifactText,
      callArtifactImageUrl,
      callArtifactImageMime,
      callArtifactImageFilename,
      callArtifactImageContext,
      renderCallArtifactImage,
      renderCallArtifactRun,
      renderCallArtifactBatchCard,
      bindCallMessageControls,
      openCallArtifactsModal,
      bindCallArtifactMessageControls,
      bindCallTranscriptMessageControls,
    };
  }

  messagesRoot.callCards = {
    createCallCardRenderer,
  };
})();
