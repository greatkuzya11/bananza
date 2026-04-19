(function () {
  'use strict';

  const ns = window.BananzaVideoNotes = window.BananzaVideoNotes || {};

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function formatDurationMs(durationMs) {
    const totalSeconds = Math.max(0, Math.round(Number(durationMs || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function applyMaskStyle(node, maskUrl) {
    if (!node) return;
    const imageValue = maskUrl ? `url("${maskUrl}")` : '';
    node.style.webkitMaskImage = imageValue;
    node.style.maskImage = imageValue;
    node.style.webkitMaskRepeat = 'no-repeat';
    node.style.maskRepeat = 'no-repeat';
    node.style.webkitMaskPosition = 'center';
    node.style.maskPosition = 'center';
    node.style.webkitMaskSize = '100% 100%';
    node.style.maskSize = '100% 100%';
  }

  class VideoNoteViewer {
    constructor({ bridge, shapeRegistry } = {}) {
      this.bridge = bridge || window.BananzaAppBridge || null;
      this.shapeRegistry = shapeRegistry;
      this.root = null;
      this.videoEl = null;
      this.captionEl = null;
      this.stageEl = null;
      this.closeBtn = null;
      this.currentMessageId = 0;
    }

    getBridge() {
      return this.bridge || window.BananzaAppBridge || null;
    }

    ensureUi() {
      if (this.root) return this.root;
      const wrapper = document.createElement('div');
      wrapper.id = 'videoNoteViewer';
      wrapper.className = 'modal hidden video-note-viewer-modal';
      wrapper.innerHTML = `
        <div class="video-note-viewer-backdrop"></div>
        <div class="video-note-viewer-shell">
          <button type="button" class="video-note-viewer-close" aria-label="Close">&times;</button>
          <div class="video-note-viewer-stage">
            <video class="video-note-viewer-video" playsinline controls preload="metadata"></video>
          </div>
          <div class="video-note-viewer-caption"></div>
        </div>
      `;
      document.body.appendChild(wrapper);
      this.root = wrapper;
      this.videoEl = wrapper.querySelector('.video-note-viewer-video');
      this.captionEl = wrapper.querySelector('.video-note-viewer-caption');
      this.stageEl = wrapper.querySelector('.video-note-viewer-stage');
      this.closeBtn = wrapper.querySelector('.video-note-viewer-close');
      this.closeBtn?.addEventListener('click', () => this.close());
      wrapper.querySelector('.video-note-viewer-backdrop')?.addEventListener('click', () => this.close());
      wrapper.addEventListener('click', (event) => {
        if (event.target === wrapper) this.close();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.root && !this.root.classList.contains('hidden')) this.close();
      });
      this.getBridge()?.registerManagedModal?.('videoNoteViewer');
      return wrapper;
    }

    open(message) {
      if (!message?.file_stored && !message?.client_file_url) return;
      const root = this.ensureUi();
      const snapshot = this.shapeRegistry?.snapshotFromMessage?.(message);
      const maskUrl = this.shapeRegistry?.getMaskUrl?.(snapshot);
      const src = message.client_file_url || `/uploads/${message.file_stored}`;
      this.currentMessageId = Number(message.id || 0);
      if (this.videoEl) {
        this.videoEl.src = src;
        this.videoEl.dataset.messageId = String(this.currentMessageId || '');
        applyMaskStyle(this.videoEl, maskUrl);
      }
      if (this.stageEl) {
        applyMaskStyle(this.stageEl, maskUrl);
      }
      if (this.captionEl) {
        const caption = String(message.transcription_text || '').trim();
        this.captionEl.innerHTML = caption ? `<span>${escapeHtml(caption)}</span>` : '';
      }
      const bridge = this.getBridge();
      if (bridge?.openManagedModal) bridge.openManagedModal('videoNoteViewer');
      else root.classList.remove('hidden');
      this.videoEl?.play?.().catch(() => {});
    }

    close() {
      if (!this.root) return;
      try {
        this.videoEl?.pause?.();
        if (this.videoEl) this.videoEl.currentTime = 0;
      } catch {}
      const bridge = this.getBridge();
      if (bridge?.closeManagedModal) bridge.closeManagedModal('videoNoteViewer');
      else this.root.classList.add('hidden');
    }
  }

  ns.VideoNoteViewer = VideoNoteViewer;
})();
