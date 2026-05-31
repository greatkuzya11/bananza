(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const messagesRoot = root.messages = root.messages || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function noop() {}

  function createMessageAttachmentRenderer(options = {}) {
    const opts = objectOrDefault(options);
    const helpers = objectOrDefault(opts.attachments || root.attachments);
    const formatters = objectOrDefault(opts.formatters || root.formatters);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const api = typeof opts.api === 'function' ? opts.api : (() => Promise.resolve({}));
    const esc = typeof opts.esc === 'function'
      ? opts.esc
      : (typeof formatters.esc === 'function' ? formatters.esc : (value) => String(value ?? ''));
    const formatSize = typeof opts.formatSize === 'function'
      ? opts.formatSize
      : (typeof formatters.formatSize === 'function' ? formatters.formatSize : (value) => String(value || ''));
    const getAttachmentPreviewUrl = typeof helpers.getAttachmentPreviewUrl === 'function'
      ? helpers.getAttachmentPreviewUrl
      : () => '';
    const getAttachmentDownloadUrl = typeof helpers.getAttachmentDownloadUrl === 'function'
      ? helpers.getAttachmentDownloadUrl
      : getAttachmentPreviewUrl;
    const getAttachmentPosterUrl = typeof helpers.getAttachmentPosterUrl === 'function'
      ? helpers.getAttachmentPosterUrl
      : () => '';
    const getStoredAttachmentPosterUrl = typeof helpers.getStoredAttachmentPosterUrl === 'function'
      ? helpers.getStoredAttachmentPosterUrl
      : () => '';
    const isVideoAttachmentMessage = typeof helpers.isVideoAttachmentMessage === 'function'
      ? helpers.isVideoAttachmentMessage
      : (source) => String(source?.file_type || source?.type || '') === 'video';
    const createAttachmentPosterBlob = typeof helpers.createAttachmentPosterBlob === 'function'
      ? helpers.createAttachmentPosterBlob
      : () => Promise.resolve(null);
    const messageCache = objectOrDefault(opts.messageCache || window.messageCache);

    function formatDuration(seconds) {
      if (!seconds || !isFinite(seconds)) return '';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return m + ':' + String(s).padStart(2, '0');
    }

    function applyPosterToVideoElement(videoEl, posterUrl) {
      if (!(videoEl instanceof HTMLVideoElement) || !posterUrl) return;
      if (videoEl.getAttribute('poster') === posterUrl) return;
      videoEl.setAttribute('poster', posterUrl);
      try { videoEl.poster = posterUrl; } catch (e) {}
    }

    function markAttachmentPosterAvailable(source, { clientPosterUrl = '' } = {}) {
      if (!source || typeof source !== 'object') return source;
      source.file_poster_available = true;
      source.filePosterAvailable = true;
      source.poster_available = true;
      source.posterAvailable = true;
      if (clientPosterUrl) {
        source.client_poster_url = clientPosterUrl;
        source.clientPosterUrl = clientPosterUrl;
      }
      return source;
    }

    function getAttachmentPosterBackfillKey(source) {
      if (!source || typeof source !== 'object') return '';
      const messageId = Number(source.id || 0);
      if (messageId > 0) return `message:${messageId}`;
      const storedName = String(source.file_stored || source.stored_name || source.storedName || '').trim();
      return storedName ? `file:${storedName}` : '';
    }

    async function ensureAttachmentPoster(source, { videoEl = null, onReady = null } = {}) {
      const existingPosterUrl = getAttachmentPosterUrl(source);
      if (existingPosterUrl) {
        applyPosterToVideoElement(videoEl, existingPosterUrl);
        if (typeof onReady === 'function') onReady(existingPosterUrl);
        return existingPosterUrl;
      }
      if (
        !source
        || typeof source !== 'object'
        || !isVideoAttachmentMessage(source)
        || actions.isClientSideMessage?.(source)
      ) {
        return '';
      }

      const backfillKey = getAttachmentPosterBackfillKey(source);
      if (!backfillKey || state.failedVideoPosterBackfills?.has?.(backfillKey)) return '';

      let task = state.pendingVideoPosterBackfills?.get?.(backfillKey);
      if (!task) {
        task = (async () => {
          const previewUrl = getAttachmentPreviewUrl(source);
          const posterBlob = await createAttachmentPosterBlob(previewUrl);
          if (!posterBlob) return '';

          const formData = new FormData();
          formData.append('poster', posterBlob, 'video-poster.jpg');
          const response = await api(`/api/messages/${Number(source.id || 0)}/poster`, {
            method: 'POST',
            body: formData,
          });
          const updatedMessage = response?.message || null;
          if (updatedMessage && typeof source === 'object') {
            Object.assign(source, updatedMessage);
            actions.applyMessageUpdate?.(updatedMessage);
            return getAttachmentPosterUrl(updatedMessage);
          }
          markAttachmentPosterAvailable(source);
          return getStoredAttachmentPosterUrl(source.file_stored || source.stored_name || source.storedName || '');
        })().catch(() => {
          state.failedVideoPosterBackfills?.add?.(backfillKey);
          return '';
        }).finally(() => {
          state.pendingVideoPosterBackfills?.delete?.(backfillKey);
        });
        state.pendingVideoPosterBackfills?.set?.(backfillKey, task);
      }

      const posterUrl = await task;
      if (!posterUrl) return '';
      state.failedVideoPosterBackfills?.delete?.(backfillKey);
      markAttachmentPosterAvailable(source);
      applyPosterToVideoElement(videoEl, posterUrl);
      if (typeof onReady === 'function') onReady(posterUrl);
      try {
        const chatId = Number(source.chat_id || source.chatId || 0);
        if (chatId && source.id && messageCache.patchMessage) {
          messageCache.patchMessage(chatId, source.id, { file_poster_available: true }).catch(noop);
        }
      } catch (e) {}
      return posterUrl;
    }

    function renderResolvedFileAttachment(msg) {
      const previewUrl = getAttachmentPreviewUrl(msg);
      const downloadUrl = getAttachmentDownloadUrl(msg) || previewUrl;
      const posterUrl = getAttachmentPosterUrl(msg);
      const posterAttr = posterUrl ? ` poster="${esc(posterUrl)}"` : '';
      switch (msg.file_type) {
        case 'image':
          return `<img class="msg-image" src="${previewUrl}" alt="${esc(msg.file_name)}">`;
        case 'audio':
          return `<div class="msg-audio">
          <div style="font-size:13px;margin-bottom:4px">&#127925; ${esc(msg.file_name)}</div>
          <audio controls preload="none"><source src="${previewUrl}" type="${msg.file_mime}"></audio>
          <div style="font-size:11px;color:var(--text-secondary)">${formatSize(msg.file_size)} &middot; <a href="${downloadUrl}" download="${esc(msg.file_name)}">Download</a></div>
        </div>`;
        case 'video':
          return `<div class="msg-video">
          <div class="msg-video-wrap">
            <video controls preload="metadata" playsinline${posterAttr}><source src="${previewUrl}" type="${msg.file_mime}"></video>
            <button class="msg-expand-btn" type="button" title="Fullscreen">&#x26F6;</button>
          </div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${esc(msg.file_name)} &middot; ${formatSize(msg.file_size)} &middot; <a href="${downloadUrl}" download="${esc(msg.file_name)}">Download</a></div>
        </div>`;
        default:
          return `<a class="msg-file" href="${downloadUrl}" download="${esc(msg.file_name)}">
          <div class="msg-file-icon">&#128196;</div>
          <div class="msg-file-info">
            <div class="msg-file-name">${esc(msg.file_name)}</div>
            <div class="msg-file-size">${formatSize(msg.file_size)}</div>
          </div>
        </a>`;
      }
    }

    function renderFileAttachment(msg) {
      const customVideoNoteAttachment = window.BananzaVideoNoteHooks?.renderAttachment?.(msg);
      if (customVideoNoteAttachment) return customVideoNoteAttachment;
      return renderResolvedFileAttachment(msg);
    }

    function renderLinkPreview(p) {
      if (!p || (!p.title && !p.description && !p.image)) return '';
      let html = `<a class="link-preview" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">`;
      if (p.hostname) html += `<div class="lp-host">${esc(p.hostname)}</div>`;
      if (p.title) html += `<div class="lp-title">${esc(p.title)}</div>`;
      if (p.description) html += `<div class="lp-desc">${esc(p.description)}</div>`;
      if (p.image) html += `<img class="lp-image" src="${esc(p.image)}" alt="" loading="lazy" onerror="this.remove()">`;
      html += '</a>';
      return html;
    }

    return {
      renderResolvedFileAttachment,
      renderFileAttachment,
      renderLinkPreview,
      formatDuration,
      ensureAttachmentPoster,
      applyPosterToVideoElement,
      markAttachmentPosterAvailable,
    };
  }

  messagesRoot.attachments = {
    createMessageAttachmentRenderer,
  };
})();
