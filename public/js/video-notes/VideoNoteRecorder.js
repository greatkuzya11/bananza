(function () {
  'use strict';

  const ns = window.BananzaVideoNotes = window.BananzaVideoNotes || {};

  const MAX_DURATION_MS = 30000;
  const TARGET_SAMPLE_RATE = 16000;

  function normalizeMimeType(value, fallback = '') {
    const base = String(value || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    return base || fallback;
  }

  function formatDurationMs(durationMs) {
    const totalSeconds = Math.max(0, Math.round(Number(durationMs || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function mergeChunks(chunks) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    chunks.forEach((chunk) => {
      result.set(chunk, offset);
      offset += chunk.length;
    });
    return result;
  }

  function downsampleBuffer(buffer, sourceSampleRate, targetSampleRate) {
    if (targetSampleRate >= sourceSampleRate) return buffer;
    const ratio = sourceSampleRate / targetSampleRate;
    const length = Math.round(buffer.length / ratio);
    const result = new Float32Array(length);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
        accum += buffer[i];
        count += 1;
      }
      result[offsetResult] = count ? accum / count : 0;
      offsetResult += 1;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  function encodeWavBlob(chunks, sourceSampleRate, targetSampleRate = TARGET_SAMPLE_RATE) {
    const merged = mergeChunks(chunks);
    const downsampled = downsampleBuffer(merged, sourceSampleRate, targetSampleRate);
    const buffer = new ArrayBuffer(44 + downsampled.length * 2);
    const view = new DataView(buffer);

    function writeString(offset, text) {
      for (let i = 0; i < text.length; i += 1) {
        view.setUint8(offset + i, text.charCodeAt(i));
      }
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + downsampled.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetSampleRate, true);
    view.setUint32(28, targetSampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, downsampled.length * 2, true);

    let offset = 44;
    downsampled.forEach((sample) => {
      const clipped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
      offset += 2;
    });

    return new Blob([buffer], { type: 'audio/wav' });
  }

  function applyPreviewMask(node, maskUrl) {
    if (!node) return;
    const imageValue = maskUrl ? `url("${maskUrl}")` : '';
    node.style.setProperty('--video-note-preview-mask', imageValue);
    node.style.webkitMaskImage = imageValue;
    node.style.maskImage = imageValue;
    node.style.webkitMaskRepeat = 'no-repeat';
    node.style.maskRepeat = 'no-repeat';
    node.style.webkitMaskPosition = 'center';
    node.style.maskPosition = 'center';
    node.style.webkitMaskSize = '100% 100%';
    node.style.maskSize = '100% 100%';
  }

  class VideoNoteRecorder {
    constructor({
      bridge,
      shapeRegistry,
      getSelectedShapeId,
      onStateChange,
      onAutoStopRequest,
    } = {}) {
      this.bridge = bridge || window.BananzaAppBridge || null;
      this.shapeRegistry = shapeRegistry;
      this.getSelectedShapeId = typeof getSelectedShapeId === 'function' ? getSelectedShapeId : (() => 'banana-fat');
      this.onStateChange = typeof onStateChange === 'function' ? onStateChange : (() => {});
      this.onAutoStopRequest = typeof onAutoStopRequest === 'function' ? onAutoStopRequest : null;
      this.reset();
    }

    reset() {
      this.recording = false;
      this.startAt = 0;
      this.stream = null;
      this.mediaRecorder = null;
      this.videoChunks = [];
      this.audioChunks = [];
      this.audioContext = null;
      this.audioSource = null;
      this.audioProcessor = null;
      this.audioSink = null;
      this.sampleRate = TARGET_SAMPLE_RATE;
      this.timerId = null;
      this.autoStopTimer = null;
      this.stoppingPromise = null;
      this.prepared = false;
      this.preparePromise = null;
      this.preparedMimeType = '';
      this.previewEl = null;
      this.previewVideo = null;
      this.previewTimer = null;
      this.previewHint = null;
    }

    canUseGesture() {
      return Boolean(window.BananzaVoiceHooks?.canUseGesture?.());
    }

    isRecording() {
      return Boolean(this.recording);
    }

    isIosGesturePreparationTarget() {
      return Boolean(this.bridge?.isIosWebkit?.() && window.innerWidth <= 768);
    }

    async ensurePreparedResources() {
      if (this.preparePromise) {
        await this.preparePromise;
      }
      if (
        this.stream
        && this.audioContext
        && this.audioSource
        && this.audioProcessor
        && this.preparedMimeType
      ) {
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('РљР°РјРµСЂР° РЅРµРґРѕСЃС‚СѓРїРЅР° РІ СЌС‚РѕРј Р±СЂР°СѓР·РµСЂРµ');
      }

      const preparePromise = (async () => {
        const mimeType = this.pickVideoMime();
        if (!mimeType) {
          throw new Error('MediaRecorder РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ Р·Р°РїРёСЃСЊ РІРёРґРµРѕ');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: 'user',
            width: { ideal: 360, max: 480 },
            height: { ideal: 360, max: 480 },
            aspectRatio: { ideal: 1 },
            frameRate: { ideal: 24, max: 24 },
          },
        });

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          stream.getTracks().forEach((track) => track.stop());
          throw new Error('AudioContext РЅРµРґРѕСЃС‚СѓРїРµРЅ');
        }

        let audioContext = null;
        try {
          audioContext = new AudioContextClass();
          await audioContext.resume();
          const source = audioContext.createMediaStreamSource(stream);
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          const sink = audioContext.createGain();
          sink.gain.value = 0;
          const audioChunks = [];
          processor.onaudioprocess = (event) => {
            if (!this.recording) return;
            audioChunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
          };
          source.connect(processor);
          processor.connect(sink);
          sink.connect(audioContext.destination);

          this.stream = stream;
          this.audioContext = audioContext;
          this.audioSource = source;
          this.audioProcessor = processor;
          this.audioSink = sink;
          this.audioChunks = audioChunks;
          this.videoChunks = [];
          this.sampleRate = audioContext.sampleRate || TARGET_SAMPLE_RATE;
          this.preparedMimeType = mimeType;
        } catch (error) {
          try { stream.getTracks().forEach((track) => track.stop()); } catch {}
          try { audioContext?.close?.().catch(() => {}); } catch {}
          this.stream = null;
          this.audioContext = null;
          this.audioSource = null;
          this.audioProcessor = null;
          this.audioSink = null;
          this.audioChunks = [];
          this.videoChunks = [];
          this.preparedMimeType = '';
          throw error;
        }
      })();

      this.preparePromise = preparePromise;
      try {
        await preparePromise;
      } finally {
        if (this.preparePromise === preparePromise) {
          this.preparePromise = null;
        }
      }
    }

    async prepare() {
      if (!this.isIosGesturePreparationTarget() || this.recording) return;
      await this.ensurePreparedResources();
      this.prepared = true;
    }

    async cancelPrepared() {
      if (this.recording) return;
      if (this.preparePromise) {
        try {
          await this.preparePromise;
        } catch {
          return;
        }
      }
      if (!this.prepared && !this.stream && !this.audioContext) return;
      this.cleanup();
    }

    ensurePreview() {
      if (this.previewEl) return this.previewEl;
      const inputArea = document.querySelector('.input-area');
      const pendingFile = document.getElementById('pendingFile');
      if (!inputArea || !pendingFile) return null;
      const wrapper = document.createElement('div');
      wrapper.className = 'video-note-recorder-preview hidden';
      wrapper.innerHTML = `
        <div class="video-note-recorder-preview-media">
          <video class="video-note-recorder-preview-video" autoplay muted playsinline></video>
        </div>
        <div class="video-note-recorder-preview-copy">
          <div class="video-note-recorder-preview-title">Видео</div>
          <div class="video-note-recorder-preview-meta">
            <span class="video-note-recorder-preview-dot"></span>
            <span class="video-note-recorder-preview-time">0:00</span>
          </div>
        </div>
      `;
      inputArea.insertBefore(wrapper, pendingFile);
      this.previewEl = wrapper;
      this.previewVideo = wrapper.querySelector('.video-note-recorder-preview-video');
      this.previewTimer = wrapper.querySelector('.video-note-recorder-preview-time');
      this.previewHint = wrapper.querySelector('.video-note-recorder-preview-title');
      return wrapper;
    }

    pickVideoMime() {
      const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      if (!window.MediaRecorder) return '';
      return candidates.find((type) => {
        try {
          return window.MediaRecorder.isTypeSupported(type);
        } catch {
          return false;
        }
      }) || '';
    }

    applyPreviewShapeMask() {
      const shapeId = this.getSelectedShapeId();
      const snapshot = this.shapeRegistry?.snapshotFor?.(shapeId) || null;
      const maskUrl = this.shapeRegistry?.getMaskUrl?.(snapshot) || '';
      applyPreviewMask(this.previewVideo, maskUrl);
    }

    async start() {
      if (this.recording) return;
      await this.ensurePreparedResources();
      const preparedMimeType = this.preparedMimeType || this.pickVideoMime();
      if (!preparedMimeType) {
        throw new Error('MediaRecorder РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ Р·Р°РїРёСЃСЊ РІРёРґРµРѕ');
      }
      const preparedRecorder = new MediaRecorder(this.stream, { mimeType: preparedMimeType });
      this.prepared = false;
      this.videoChunks.length = 0;
      this.audioChunks.length = 0;
      preparedRecorder.ondataavailable = (event) => {
        if (event.data?.size) this.videoChunks.push(event.data);
      };

      this.recording = true;
      this.startAt = Date.now();
      this.mediaRecorder = preparedRecorder;
      this.stoppingPromise = null;

      const previewNode = this.ensurePreview();
      if (previewNode && this.previewVideo) {
        this.applyPreviewShapeMask();
        this.previewVideo.srcObject = this.stream;
        previewNode.classList.remove('hidden');
      }

      this.updatePreview();
      this.timerId = window.setInterval(() => this.updatePreview(), 200);
      this.autoStopTimer = window.setTimeout(() => {
        if (!this.recording) return;
        if (this.onAutoStopRequest) {
          this.onAutoStopRequest();
          return;
        }
        this.stopAndSend().catch(() => {});
      }, MAX_DURATION_MS);

      preparedRecorder.start();
      this.onStateChange({ recording: true });
      return;
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Камера недоступна в этом браузере');
      }
      const mimeType = this.pickVideoMime();
      if (!mimeType) {
        throw new Error('MediaRecorder не поддерживает запись видео');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: { ideal: 360, max: 480 },
          height: { ideal: 360, max: 480 },
          aspectRatio: { ideal: 1 },
          frameRate: { ideal: 24, max: 24 },
        },
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('AudioContext недоступен');
      }

      const audioContext = new AudioContextClass();
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const sink = audioContext.createGain();
      sink.gain.value = 0;
      processor.onaudioprocess = (event) => {
        if (!this.recording) return;
        this.audioChunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(sink);
      sink.connect(audioContext.destination);

      const recorder = new MediaRecorder(stream, { mimeType });
      const videoChunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) videoChunks.push(event.data);
      };

      this.recording = true;
      this.startAt = Date.now();
      this.stream = stream;
      this.mediaRecorder = recorder;
      this.videoChunks = videoChunks;
      this.audioChunks = [];
      this.audioContext = audioContext;
      this.audioSource = source;
      this.audioProcessor = processor;
      this.audioSink = sink;
      this.sampleRate = audioContext.sampleRate || TARGET_SAMPLE_RATE;
      this.stoppingPromise = null;

      const preview = this.ensurePreview();
      if (preview && this.previewVideo) {
        this.applyPreviewShapeMask();
        this.previewVideo.srcObject = stream;
        preview.classList.remove('hidden');
      }

      this.updatePreview();
      this.timerId = window.setInterval(() => this.updatePreview(), 200);
      this.autoStopTimer = window.setTimeout(() => {
        if (!this.recording) return;
        if (this.onAutoStopRequest) {
          this.onAutoStopRequest();
          return;
        }
        this.stopAndSend().catch(() => {});
      }, MAX_DURATION_MS);

      recorder.start();
      this.onStateChange({ recording: true });
    }

    updatePreview() {
      if (!this.previewTimer) return;
      const elapsed = Date.now() - this.startAt;
      this.previewTimer.textContent = formatDurationMs(elapsed);
    }

    async stopAndSend() {
      if (this.stoppingPromise) return this.stoppingPromise;
      this.stoppingPromise = this.finishAndQueue();
      try {
        await this.stoppingPromise;
      } finally {
        this.stoppingPromise = null;
      }
    }

    async finishAndQueue() {
      if (!this.recording || !this.mediaRecorder) return;
      const elapsed = Math.min(Date.now() - this.startAt, MAX_DURATION_MS);
      const mediaRecorder = this.mediaRecorder;
      const videoChunks = this.videoChunks;

      const stoppedBlob = await new Promise((resolve, reject) => {
        mediaRecorder.onstop = () => {
          resolve(new Blob(videoChunks, {
            type: normalizeMimeType(mediaRecorder.mimeType, 'video/webm'),
          }));
        };
        mediaRecorder.onerror = () => reject(mediaRecorder.error || new Error('Video note record failed'));
        try {
          mediaRecorder.stop();
        } catch (error) {
          reject(error);
        }
      });

      const audioBlob = encodeWavBlob(this.audioChunks, this.sampleRate, TARGET_SAMPLE_RATE);
      const shapeId = this.getSelectedShapeId();
      const shapeSnapshot = this.shapeRegistry?.snapshotFor?.(shapeId) || null;

      this.cleanup();
      window.BananzaVoiceHooks?.setRecorderMessage?.('Отправка видео-заметки...', 'pending');
      await this.bridge?.queueVideoNote?.({
        videoBlob: stoppedBlob,
        audioBlob,
        durationMs: elapsed,
        sampleRate: TARGET_SAMPLE_RATE,
        videoMime: normalizeMimeType(stoppedBlob.type, 'video/webm'),
        shapeId,
        shapeSnapshot,
        replyTo: this.bridge?.getReplyTo?.(),
      });
      window.BananzaVoiceHooks?.hideRecorderBar?.();
    }

    cancel() {
      this.cleanup();
    }

    cleanup() {
      this.recording = false;
      this.prepared = false;
      if (this.timerId) window.clearInterval(this.timerId);
      if (this.autoStopTimer) window.clearTimeout(this.autoStopTimer);
      this.timerId = null;
      this.autoStopTimer = null;

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try { this.mediaRecorder.stop(); } catch {}
      }
      this.mediaRecorder = null;
      this.audioProcessor?.disconnect();
      this.audioSink?.disconnect();
      this.audioSource?.disconnect();
      this.audioProcessor = null;
      this.audioSink = null;
      this.audioSource = null;
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = null;
      if (this.previewVideo) {
        try { this.previewVideo.pause(); } catch {}
        this.previewVideo.srcObject = null;
      }
      if (this.previewEl) this.previewEl.classList.add('hidden');
      this.audioContext?.close().catch(() => {});
      this.audioContext = null;
      this.videoChunks = [];
      this.audioChunks = [];
      this.preparedMimeType = '';
      this.onStateChange({ recording: false });
    }
  }

  ns.VideoNoteRecorder = VideoNoteRecorder;
})();
