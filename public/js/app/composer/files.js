(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const composerRoot = root.composer = root.composer || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function noop() {}

  function createComposerFilesController(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const win = opts.window || window;
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const config = objectOrDefault(opts.config);
    const formatters = objectOrDefault(opts.formatters || root.formatters);
    const esc = typeof opts.esc === 'function'
      ? opts.esc
      : (typeof formatters.esc === 'function' ? formatters.esc : (value) => String(value == null ? '' : value));
    const formatSize = typeof opts.formatSize === 'function'
      ? opts.formatSize
      : (typeof formatters.formatSize === 'function' ? formatters.formatSize : (size) => String(size || 0));

    const MAX_ATTACHMENTS = Number(config.MAX_ATTACHMENTS || opts.MAX_ATTACHMENTS || 10) || 10;
    const MAX_FILE_SIZE = Number(config.MAX_FILE_SIZE || opts.MAX_FILE_SIZE || Infinity);
    const MAX_FILE_SIZE_LABEL = config.MAX_FILE_SIZE_LABEL || opts.MAX_FILE_SIZE_LABEL || formatSize(MAX_FILE_SIZE);
    const PREPARATION_FEEDBACK_MIN_MS = 500;

    const t = (key, params) => win.BananzaI18n?.t(key, params) || key.replace(/\{(\w+)\}/g, (_, name) => params?.[name] ?? '');
    const getCurrentChatId = opts.getCurrentChatId || actions.getCurrentChatId || (() => null);
    const previewUrls = new Map();
    const thumbnails = new WeakMap();
    const previewJobs = new Map();
    const renderedCards = new Map();
    const leavingFiles = new Set();
    const cardAnimations = new Map();
    let scrollIndicatorTimer = null;
    let stripResizeObserver = null;
    let thumbnailQueue = Promise.resolve();
    let selectionEpoch = 0;
    let pendingPicker = null;
    const cancelledPickers = new WeakSet();

    function syncPreviewUrls({ keepUrls = false } = {}) {
      const active = new Set(state.pendingFiles || []);
      for (const [file, cancel] of previewJobs) {
        if (!active.has(file)) cancel();
      }
      if (keepUrls) return;
      for (const file of leavingFiles) active.add(file);
      for (const [file, url] of previewUrls) {
        if (active.has(file)) continue;
        win.URL.revokeObjectURL(url);
        previewUrls.delete(file);
      }
    }

    function previewFor(file) {
      if (file.serverFileMeta) {
        return file.type === 'image' ? root.attachments?.getAttachmentPreviewUrl(file.serverFileMeta) || ''
          : file.type === 'video' ? root.attachments?.getAttachmentPosterUrl(file.serverFileMeta) || '' : '';
      }
      const blob = file.type === 'image'
        ? (thumbnails.has(file) ? thumbnails.get(file) : file.file)
        : file.posterBlob;
      if (!blob || !win.URL?.createObjectURL) return '';
      if (!previewUrls.has(file)) previewUrls.set(file, win.URL.createObjectURL(blob));
      return previewUrls.get(file);
    }

    function createThumbnail(file, isCurrent) {
      // Serialize decoding across selections too: ten large originals must not be
      // resident in memory together. Removing a card terminates its active worker.
      const task = thumbnailQueue.then(async () => {
        if (!isCurrent()) return;
        if (typeof win.Worker !== 'function' || typeof win.OffscreenCanvas !== 'function') {
          const blob = await createFallbackThumbnail(file);
          if (isCurrent()) thumbnails.set(file, blob);
          return;
        }
        const blob = await new Promise(resolve => {
          let worker;
          let timer;
          const finish = result => {
            win.clearTimeout(timer);
            worker?.terminate();
            previewJobs.delete(file);
            resolve(result);
          };
          previewJobs.set(file, () => finish(null));
          timer = win.setTimeout(() => finish(null), 30000);
          try {
            worker = new win.Worker('/js/app/composer/image-preview-worker.js?v=20261024-worker-preview');
            worker.onmessage = event => finish(event.data?.blob || null);
            worker.onerror = () => finish(null);
            worker.postMessage({ file: file.file });
          } catch (error) { finish(null); }
        });
        // A failed/unsupported image remains sendable as a file card. Do not
        // retry decoding the full original on the UI thread after worker failure.
        if (isCurrent()) thumbnails.set(file, blob);
      });
      thumbnailQueue = task.catch(noop);
      return task;
    }

    function createFallbackThumbnail(file) {
      // Older browsers still decode one image at a time and retain only 128px.
      // Documents never enter either image path or read their contents here.
      if (!win.URL?.createObjectURL) return Promise.resolve(null);
      return new Promise(resolve => {
        const source = win.URL.createObjectURL(file.file);
        const image = new win.Image();
        let settled = false;
        const finish = blob => {
          if (settled) return;
          settled = true;
          win.clearTimeout(timer);
          image.onload = image.onerror = null;
          image.removeAttribute('src');
          win.URL.revokeObjectURL(source);
          previewJobs.delete(file);
          resolve(blob);
        };
        const timer = win.setTimeout(() => finish(null), 30000);
        previewJobs.set(file, () => finish(null));
        image.decoding = 'async';
        image.onerror = () => finish(null);
        image.onload = async () => {
          try {
            // decode() avoids forcing a synchronous decode during drawImage().
            if (typeof image.decode === 'function') await image.decode();
            if (settled) return;
            const scale = Math.min(1, 128 / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = doc.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(finish, 'image/png');
          } catch (error) { finish(null); }
        };
        image.src = source;
      });
    }

    function uploadFiles(fileList, { replaceFile = null } = {}) {
      const incoming = Array.from(fileList || []);
      const epoch = selectionEpoch;
      const chatId = getCurrentChatId();
      return addFiles(incoming, epoch, chatId, replaceFile);
    }

    function isPreparingFiles() {
      return Boolean(pendingPicker?.returned) || (state.pendingFiles || []).some(file => file.preparing);
    }

    function startFilePicker(input) {
      if (state.editTo && (!state.editTo.attachmentsEditable || state.editTo.saving)) return;
      const wasReceiving = Boolean(pendingPicker?.returned);
      if (pendingPicker && pendingPicker.input !== input) cancelledPickers.add(pendingPicker.input);
      cancelledPickers.delete(input);
      pendingPicker = { input, epoch: selectionEpoch, chatId: getCurrentChatId(), leftPage: false, returned: false, replaceFile: input.__replaceFile || null };
      delete input.__replaceFile;
      if (wasReceiving) renderPendingFiles();
    }

    function cancelFilePicker(input) {
      if (pendingPicker?.input !== input) return;
      cancelledPickers.add(input);
      pendingPicker = null;
      renderPendingFiles();
      (actions.refreshVoiceComposerState || noop)();
      (actions.scheduleMobileViewportRecovery || noop)();
    }

    function showReceivingFiles(picker = pendingPicker) {
      if (!picker || picker !== pendingPicker || picker.returned) return;
      if (picker.epoch !== selectionEpoch || picker.chatId !== getCurrentChatId()) {
        cancelFilePicker(picker.input);
        return;
      }
      picker.returned = true;
      renderPendingFiles();
      (actions.refreshVoiceComposerState || noop)();
      (actions.scheduleMobileViewportRecovery || noop)();
    }

    // A chooser may close before file import finishes and change is dispatched.
    // Do not read input.files here: the browser may not have populated it yet.
    win.addEventListener('blur', () => { if (pendingPicker) pendingPicker.leftPage = true; });
    win.addEventListener('focus', () => {
      if (pendingPicker?.leftPage && doc.visibilityState !== 'hidden') showReceivingFiles();
    });
    doc.addEventListener('visibilitychange', () => {
      if (!pendingPicker) return;
      if (doc.visibilityState === 'hidden') pendingPicker.leftPage = true;
      else if (pendingPicker.leftPage) showReceivingFiles();
    });

    function allowLoadingIndicatorToPaint() {
      return new Promise(resolve => {
        const fallback = win.setTimeout(resolve, 100);
        win.requestAnimationFrame(() => win.setTimeout(() => {
          win.clearTimeout(fallback);
          resolve();
        }, 0));
      });
    }

    let removedButtonGesture = null;
    // Touch activation removes the target before the browser dispatches click.
    // Consume that click even if it is retargeted to media behind the panel.
    doc.addEventListener('click', event => {
      const gesture = removedButtonGesture;
      if (!gesture || Date.now() > gesture.until || event.detail === 0) return;
      if (Math.abs(event.clientX - gesture.x) > 24 || Math.abs(event.clientY - gesture.y) > 24) return;
      removedButtonGesture = null;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    const resetRemovedButtonGesture = () => { removedButtonGesture = null; };
    doc.addEventListener('pointerdown', resetRemovedButtonGesture, true);
    doc.addEventListener('touchstart', resetRemovedButtonGesture, { capture: true, passive: true });

    function bindButtonActivation(button, handler) {
      if (!button || button.__composerFilesActivationBound) return;
      button.__composerFilesActivationBound = true;
      const activate = context => {
        if (button.matches('.pending-files-clear, .pending-file-remove')) {
          const event = context.event;
          event?.preventDefault?.();
          event?.stopPropagation?.();
          if (event?.type === 'pointerup' || event?.type === 'touchend') {
            const point = event.changedTouches?.[0] || event;
            removedButtonGesture = { x: point.clientX, y: point.clientY, until: Date.now() + 550 };
          }
        }
        handler(context);
      };
      if (typeof actions.bindTouchSafeButtonActivation === 'function') {
        actions.bindTouchSafeButtonActivation(button, activate);
        return;
      }
      button.addEventListener('click', (event) => activate({ event, startKeyboardOpen: false, keepKeyboardOpen: false }));
    }

    async function addFiles(fileList, epoch, chatId, replaceFile = null) {
      if (epoch !== selectionEpoch || chatId !== getCurrentChatId()) return false;
      if (state.editTo && (!state.editTo.attachmentsEditable || state.editTo.saving)) {
        (actions.alert || alert)('Finish editing before attaching files.');
        return false;
      }
      const incomingFiles = Array.from(fileList || []);
      if (incomingFiles.length === 0) return false;
      if (replaceFile && (!(state.pendingFiles || []).includes(replaceFile) || incomingFiles.length !== 1)) return false;
      if ((state.pendingFiles || []).length + incomingFiles.length - (replaceFile ? 1 : 0) > MAX_ATTACHMENTS) {
        (actions.alert || alert)(t('Use up to {count} attachments.', { count: MAX_ATTACHMENTS }));
        return false;
      }
      for (const f of incomingFiles) {
        if (f.size > MAX_FILE_SIZE) {
          (actions.alert || alert)(t('File too large: {name} (max {size})', { name: f.name, size: MAX_FILE_SIZE_LABEL }));
          return false;
        }
      }

      const localAttachmentFromFile = actions.localAttachmentFromFile || ((file) => Promise.resolve({
        localId: `f-${Date.now()}`,
        file,
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
        type: 'document',
      }));
      const placeholders = incomingFiles.map(file => ({
        file, name: file.name, size: file.size, mime: file.type,
        type: file.type.startsWith('image/') ? 'image' : 'document', preparing: true,
      }));
      state.setPendingFiles(replaceFile
        ? state.pendingFiles.map(file => file === replaceFile ? placeholders[0] : file)
        : [...(state.pendingFiles || []), ...placeholders]);
      renderPendingFiles();
      const feedbackStartedAt = win.performance.now();
      dom.msgInput?.focus();
      (actions.updateComposerAiOverrideState || noop)();
      (actions.refreshPollComposerActionState || noop)();
      (actions.refreshVoiceComposerState || noop)();
      (actions.scheduleMobileViewportRecovery || noop)();
      // A native chooser can return with expensive file/preview work still ahead.
      // Give the visible loading cards a paint before starting that work.
      await allowLoadingIndicatorToPaint();
      const results = await Promise.all(placeholders.map(async placeholder => {
        const isCurrent = () => epoch === selectionEpoch && chatId === getCurrentChatId()
          && (state.pendingFiles || []).includes(placeholder);
        if (!isCurrent()) return false;
        let prepared;
        try { prepared = await localAttachmentFromFile(placeholder.file); }
        catch (error) { /* Remove the failed card below without losing other selections. */ }
        if (!isCurrent()) return false;
        if (prepared) {
          Object.assign(placeholder, prepared);
          if (placeholder.type === 'image') await createThumbnail(placeholder, isCurrent);
          if (!isCurrent()) return false;
          // Keep the loading state until the thumbnail itself can be displayed.
          const preview = previewFor(placeholder);
          if (preview && typeof win.Image?.prototype?.decode === 'function') {
            const image = new win.Image();
            image.decoding = 'async';
            image.src = preview;
            try { await image.decode(); } catch (error) { /* The file can still be sent without a preview. */ }
          }
          // Fast local files otherwise finish within one frame, making feedback invisible.
          const feedbackRemaining = PREPARATION_FEEDBACK_MIN_MS - (win.performance.now() - feedbackStartedAt);
          if (feedbackRemaining > 0) await new Promise(resolve => win.setTimeout(resolve, feedbackRemaining));
          if (!isCurrent()) return false;
          placeholder.preparing = false;
        }
        else state.setPendingFiles(replaceFile
          ? state.pendingFiles.map(file => file === placeholder ? replaceFile : file)
          : state.pendingFiles.filter(file => file !== placeholder));
        renderPendingFiles();
        (actions.refreshPollComposerActionState || noop)();
        (actions.refreshVoiceComposerState || noop)();
        (actions.scheduleMobileViewportRecovery || noop)();
        if (!prepared) (actions.alert || alert)(t('Could not prepare {name}.', { name: placeholder.name }));
        return Boolean(prepared);
      }));
      return results.some(Boolean);
    }

    function resetPendingCards() {
      stripResizeObserver?.disconnect();
      stripResizeObserver = null;
      for (const animation of cardAnimations.values()) animation.cancel();
      cardAnimations.clear();
      (dom.pendingFileEl || doc.getElementById('pendingFile'))?.querySelectorAll('.pending-file-card.is-removing').forEach(card => card.remove());
      renderedCards.clear();
      leavingFiles.clear();
      win.clearTimeout(scrollIndicatorTimer);
    }

    function animatePendingCard(card, appearing, done = noop) {
      const panel = dom.pendingFileEl || doc.getElementById('pendingFile');
      const style = win.getComputedStyle(panel);
      const base = style.getPropertyValue(appearing ? '--floating-duration-base' : '--floating-close-duration-base').trim();
      const factor = parseFloat(style.getPropertyValue('--modal-animation-speed-factor')) || 1;
      const duration = (parseFloat(base) || 0) * (base.endsWith('ms') ? 1 : 1000) * factor;
      const transform = style.getPropertyValue(appearing ? '--floating-enter-transform' : '--floating-close-transform').trim() || 'none';
      const from = appearing ? { opacity: 0, transform } : { opacity: win.getComputedStyle(card).opacity, transform: win.getComputedStyle(card).transform };
      cardAnimations.get(card)?.cancel();
      cardAnimations.delete(card);
      if (!duration || typeof card.animate !== 'function' || win.matchMedia?.('(prefers-reduced-motion: reduce)').matches || doc.documentElement.dataset.modalAnimation === 'none') {
        done();
        return;
      }
      const animation = card.animate([from, appearing ? { opacity: 1, transform: 'none' } : { opacity: 0, transform }], {
        duration, easing: style.getPropertyValue('--floating-ease').trim() || 'ease-out', fill: 'both',
      });
      cardAnimations.set(card, animation);
      animation.finished.then(() => {
        if (cardAnimations.get(card) !== animation) return;
        cardAnimations.delete(card);
        done();
        animation.cancel();
      }).catch(noop);
    }

    function updateStripScrollbar(strip) {
      const hasMany = (state.pendingFiles || []).length > 3;
      const maxScroll = Math.max(0, strip.scrollWidth - strip.clientWidth);
      strip.classList.toggle('has-many-attachments', hasMany);
      strip.classList.toggle('is-scrollable', maxScroll > 1);
      const track = strip.nextElementSibling;
      const thumb = track?.firstElementChild;
      if (thumb) {
        const trackWidth = track.clientWidth;
        const thumbWidth = Math.min(trackWidth, Math.max(24, trackWidth * strip.clientWidth / (strip.scrollWidth || 1)));
        const progress = maxScroll ? Math.max(0, Math.min(1, strip.scrollLeft / maxScroll)) : 0;
        thumb.style.width = `${thumbWidth}px`;
        thumb.style.transform = `translateX(${progress * (trackWidth - thumbWidth)}px)`;
      }
      if (!hasMany || maxScroll <= 1) {
        strip.classList.remove('is-scrolling');
        win.clearTimeout(scrollIndicatorTimer);
      }
      // Ignore scroll events caused by layout changes rather than scrolling.
      strip.__lastScrollLeft = strip.scrollLeft;
    }

    function hidePendingFiles({ immediate = false } = {}) {
      const panel = dom.pendingFileEl || doc.getElementById('pendingFile');
      if (!panel) { syncPreviewUrls(); return; }
      if (!immediate && panel.classList.contains('is-closing')) return;
      panel.inert = true;
      panel.setAttribute('aria-hidden', 'true');
      const afterClose = () => {
        resetPendingCards();
        panel.innerHTML = '';
        syncPreviewUrls();
        (actions.scheduleMobileViewportRecovery || noop)();
      };
      if (typeof actions.closeFloatingSurface === 'function') {
        actions.closeFloatingSurface(panel, { immediate, onAfterClose: afterClose });
        // The synchronous fallback used by embedders may omit the callback.
        if (panel.classList.contains('hidden')) afterClose();
      } else {
        panel.classList.add('hidden');
        afterClose();
      }
    }

    function renderPendingFiles() {
      const pendingFileEl = dom.pendingFileEl || doc.getElementById('pendingFile');
      const pendingFiles = state.pendingFiles || [];
      const receiving = Boolean(pendingPicker?.returned);
      actions.syncEditBar?.();
      if (!pendingFiles.length && !receiving && !state.editTo?.usesAttachmentPanel) {
        if (pendingPicker) {
          if (dom.sendBtn) dom.sendBtn.disabled = false;
          pendingFileEl?.setAttribute('aria-busy', 'false');
          hidePendingFiles();
          return;
        }
        clearPendingFile();
        return;
      }
      if (!pendingFileEl) return;
      const preparing = isPreparingFiles();
      if (dom.sendBtn) dom.sendBtn.disabled = preparing;
      pendingFileEl.setAttribute('aria-busy', String(preparing));
      const shouldOpen = pendingFileEl.classList.contains('hidden') || pendingFileEl.classList.contains('is-closing');
      pendingFileEl.inert = false;
      pendingFileEl.setAttribute('aria-hidden', 'false');
      let strip = pendingFileEl.querySelector('.pending-file-strip');
      if (!strip || shouldOpen) {
        resetPendingCards();
        pendingFileEl.innerHTML = `<div class="pending-file-strip-wrap"><div class="pending-file-strip" role="list"><button type="button" class="pending-file-add" aria-label="${esc(t('Add attachments'))}" title="${esc(t('Add attachments'))}">+</button></div><div class="pending-file-scrollbar" aria-hidden="true"><span></span></div></div><button type="button" class="pending-files-clear" title="${esc(t('Remove all'))}" aria-label="${esc(t('Remove all'))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`;
        strip = pendingFileEl.querySelector('.pending-file-strip');
        strip.addEventListener('scroll', () => {
          const moved = strip.scrollLeft !== strip.__lastScrollLeft;
          updateStripScrollbar(strip);
          if (!moved || (state.pendingFiles || []).length <= 3 || !strip.classList.contains('is-scrollable')) return;
          strip.classList.add('is-scrolling');
          win.clearTimeout(scrollIndicatorTimer);
          scrollIndicatorTimer = win.setTimeout(() => strip.classList.remove('is-scrolling'), 600);
        }, { passive: true });
        if (typeof win.ResizeObserver === 'function') {
          stripResizeObserver = new win.ResizeObserver(() => updateStripScrollbar(strip));
          stripResizeObserver.observe(strip);
        }
        bindButtonActivation(pendingFileEl.querySelector('.pending-files-clear'), ({ event, startKeyboardOpen }) => {
          event?.stopPropagation?.();
          if (state.editTo?.attachmentsEditable) actions.cancelEdit?.();
          else clearPendingFile();
          if (startKeyboardOpen) (actions.focusComposerKeepKeyboard || noop)(true);
        });
        bindButtonActivation(strip.querySelector('.pending-file-add'), () => dom.attachBtn?.click());
      }
      const closeLabel = t(state.editTo?.attachmentsEditable ? 'Cancel editing' : 'Remove all');
      const closeButton = pendingFileEl.querySelector('.pending-files-clear');
      closeButton.title = closeLabel;
      closeButton.setAttribute('aria-label', closeLabel);
      const scrollLeft = strip.scrollLeft;
      let receivingCard = strip.querySelector('.pending-file-receiving');
      if (receiving && !receivingCard) {
        receivingCard = doc.createElement('div');
        receivingCard.className = 'pending-file-card has-preview pending-file-receiving is-preparing';
        receivingCard.setAttribute('role', 'listitem');
        receivingCard.innerHTML = `<span class="pending-file-thumb" aria-hidden="true"></span><span class="pending-file-spinner" aria-hidden="true"></span><span class="pending-file-details" role="status">${esc(t('Receiving selected files...'))}</span><button type="button" class="pending-file-remove pending-picker-cancel" aria-label="${esc(t('Cancel'))}" title="${esc(t('Cancel'))}">&times;</button>`;
        strip.prepend(receivingCard);
        bindButtonActivation(receivingCard.querySelector('.pending-picker-cancel'), () => {
          if (pendingPicker) cancelFilePicker(pendingPicker.input);
        });
      } else if (!receiving) receivingCard?.remove();

      for (const [file, card] of renderedCards) {
        if (pendingFiles.includes(file)) continue;
        renderedCards.delete(file);
        leavingFiles.add(file);
        card.inert = true;
        card.classList.add('is-removing');
        card.setAttribute('aria-hidden', 'true');
        animatePendingCard(card, false, () => {
          const left = strip.scrollLeft;
          card.remove();
          leavingFiles.delete(file);
          syncPreviewUrls();
          strip.scrollLeft = left;
          updateStripScrollbar(strip);
        });
      }
      const addedCards = [];
      pendingFiles.forEach((file, index) => {
        let card = renderedCards.get(file);
        if (!card) {
          card = doc.createElement('div');
          card.className = 'pending-file-card';
          card.setAttribute('role', 'listitem');
          renderedCards.set(file, card);
          const nextCard = pendingFiles.slice(index + 1).map(file => renderedCards.get(file)).find(el => el?.isConnected);
          strip.insertBefore(card, nextCard || strip.querySelector('.pending-file-add'));
          addedCards.push(card);
        }
        const preview = file.preparing ? '' : previewFor(file);
        const waitingForMedia = file.preparing && (file.type === 'image' || file.type === 'video' || file.mime?.startsWith('video/'));
        const ext = (file.name.split('.').pop() || '').slice(0, 8).toUpperCase();
        card.classList.toggle('has-preview', Boolean(preview || waitingForMedia));
        card.classList.toggle('is-preparing', Boolean(file.preparing));
        const content = `${preview ? `<img class="pending-file-thumb" decoding="async" src="${esc(preview)}" alt="${esc(file.name)}">` : waitingForMedia ? '<span class="pending-file-thumb" aria-hidden="true"></span>' : `<span class="pending-file-format">${esc(ext || t('File'))}</span>`}
          ${file.preparing ? '<span class="pending-file-spinner" aria-hidden="true"></span>' : ''}
          <span class="pending-file-details"><span class="pending-file-name" title="${esc(file.name)}">${esc(file.name)}</span><span${file.preparing ? ' role="status"' : ''}>${esc(file.preparing ? t('Preparing attachment...') : formatSize(file.size))}</span></span>
          <button type="button" class="pending-file-remove" data-index="" aria-label="${esc(t('Remove attachment'))}" title="${esc(t('Remove attachment'))}">&times;</button>
          ${state.editTo?.attachmentsEditable && !file.preparing ? `<button type="button" class="pending-file-replace" aria-label="${esc(t('Replace attachment'))}" title="${esc(t('Replace attachment'))}">&#8635;</button>` : ''}`;
        if (card.__content !== content) {
          card.__content = content;
          card.innerHTML = content;
          bindButtonActivation(card.querySelector('.pending-file-remove'), ({ event, startKeyboardOpen }) => {
            event?.stopPropagation?.();
            state.setPendingFiles((state.pendingFiles || []).filter(item => item !== file));
            renderPendingFiles();
            (actions.refreshPollComposerActionState || noop)();
            (actions.refreshVoiceComposerState || noop)();
            (actions.scheduleMobileViewportRecovery || noop)();
            if (startKeyboardOpen) (actions.focusComposerKeepKeyboard || noop)(true);
          });
          card.querySelector('img')?.addEventListener('error', event => { event.target.hidden = true; });
          bindButtonActivation(card.querySelector('.pending-file-replace'), ({ event }) => {
            event?.stopPropagation?.();
            let input = doc.getElementById('fileInputReplace');
            if (!input) {
              input = doc.createElement('input');
              input.id = 'fileInputReplace';
              input.type = 'file';
              input.hidden = true;
              doc.body.appendChild(input);
              bindFileInput(input);
            }
            input.__replaceFile = file;
            input.click();
          });
        }
        card.querySelector('.pending-file-remove').dataset.index = index;
      });
      syncPreviewUrls();
      if (shouldOpen) (actions.openFloatingSurface || (el => el.classList.remove('hidden')))(pendingFileEl);
      strip.scrollLeft = scrollLeft;
      updateStripScrollbar(strip);
      addedCards.forEach(card => animatePendingCard(card, true));
    }

    function clearPendingFile({ immediate = false } = {}) {
      const pendingFileEl = dom.pendingFileEl || doc.getElementById('pendingFile');
      selectionEpoch += 1;
      if (pendingPicker) cancelledPickers.add(pendingPicker.input);
      pendingPicker = null;
      state.clearPendingFiles();
      resetPendingCards();
      // Stop work immediately, but retain thumbnail URLs until the closing
      // animation finishes so the panel does not fade out with broken images.
      syncPreviewUrls({ keepUrls: true });
      if (dom.sendBtn) dom.sendBtn.disabled = false;
      if (pendingFileEl) {
        pendingFileEl.setAttribute('aria-busy', 'false');
        hidePendingFiles({ immediate });
      }
      if (dom.fileInput) dom.fileInput.value = '';
      (actions.refreshPollComposerActionState || noop)();
      (actions.refreshVoiceComposerState || noop)();
      (actions.scheduleMobileViewportRecovery || noop)();
    }

    function isMobileAttachMenu() {
      return (actions.isMobileLayoutViewport || (() => false))();
    }

    function getAttachMenu() {
      return doc.getElementById('attachMenu');
    }

    function positionAttachMenu() {
      const attachMenu = getAttachMenu();
      const attachBtn = dom.attachBtn;
      if (!attachMenu || attachMenu.classList.contains('hidden') || !attachBtn) return;
      const rect = attachBtn.getBoundingClientRect();
      const vv = win.visualViewport;
      const viewportLeft = vv ? vv.offsetLeft : 0;
      const viewportTop = vv ? vv.offsetTop : 0;
      const viewportWidth = vv ? vv.width : win.innerWidth;
      const viewportHeight = vv ? vv.height : win.innerHeight;
      const menuWidth = attachMenu.offsetWidth || 160;
      const menuHeight = attachMenu.offsetHeight || 190;
      let left = rect.left + viewportLeft;
      left = Math.max(viewportLeft + 8, Math.min(left, viewportLeft + viewportWidth - menuWidth - 8));
      const preferredTop = rect.top + viewportTop - menuHeight - 8;
      const fallbackTop = rect.bottom + viewportTop + 8;
      const maxTop = Math.max(viewportTop + 8, viewportTop + viewportHeight - menuHeight - 8);
      let top = preferredTop;
      if (top < viewportTop + 8) top = Math.min(fallbackTop, maxTop);
      top = Math.max(viewportTop + 8, Math.min(top, maxTop));
      attachMenu.style.left = left + 'px';
      attachMenu.style.top = top + 'px';
    }

    function hideAttachMenu(options = {}) {
      const attachMenu = getAttachMenu();
      if (!attachMenu) return false;
      return (actions.closeFloatingSurface || ((el) => el?.classList.add('hidden')))(attachMenu, options);
    }

    function openAttachMenu({ keepKeyboardOpen } = {}) {
      const attachMenu = getAttachMenu();
      if (!attachMenu) return false;
      (actions.openFloatingSurface || ((el) => el?.classList.remove('hidden')))(attachMenu);
      positionAttachMenu();
      win.requestAnimationFrame(positionAttachMenu);
      if (keepKeyboardOpen) (actions.focusComposerKeepKeyboard || noop)(true);
      return true;
    }

    function bindFileInput(input, { resetValue = true } = {}) {
      if (!input || input.__composerFilesInputBound) return;
      input.__composerFilesInputBound = true;
      input.addEventListener('click', () => startFilePicker(input));
      input.addEventListener('cancel', () => cancelFilePicker(input));
      input.addEventListener('input', () => {
        if (pendingPicker?.input === input) showReceivingFiles();
      });
      input.addEventListener('change', async () => {
        let picker = pendingPicker?.input === input ? pendingPicker : null;
        const stale = cancelledPickers.has(input) || (picker && (
          picker.epoch !== selectionEpoch || picker.chatId !== getCurrentChatId()
        ));
        if (stale) {
          if (picker) cancelFilePicker(input);
          if (resetValue) input.value = '';
          return;
        }
        if (!picker) {
          startFilePicker(input);
          picker = pendingPicker;
        }
        if (!picker) return;
        showReceivingFiles(picker);
        await allowLoadingIndicatorToPaint();
        if (picker !== pendingPicker || picker.epoch !== selectionEpoch || picker.chatId !== getCurrentChatId()) return;
        const selectedFiles = Array.from(input.files || []);
        if (resetValue) input.value = '';
        pendingPicker = null;
        if (selectedFiles.length) uploadFiles(selectedFiles, { replaceFile: picker.replaceFile }).finally(renderPendingFiles);
        else renderPendingFiles();
      });
    }

    function shouldUseAttachMenu() {
      return isMobileAttachMenu() || Boolean((actions.shouldUseAttachMenu || (() => false))());
    }

    function bindAttachMenuEvents({ openPollComposer = noop, openLocationPicker = noop } = {}) {
      if (!dom.attachBtn || dom.attachBtn.__composerAttachMenuBound) return;
      const attachMenu = getAttachMenu();
      const attachMenuOverlay = doc.getElementById('attachMenuOverlay');
      const fileInputGallery = doc.getElementById('fileInputGallery');
      const fileInputCamera = doc.getElementById('fileInputCamera');
      const fileInputDocs = doc.getElementById('fileInputDocs');

      dom.attachBtn.__composerAttachMenuBound = true;
      bindButtonActivation(dom.attachBtn, ({ keepKeyboardOpen }) => {
        if (state.editTo && (!state.editTo.attachmentsEditable || state.editTo.saving)) return;
        if (shouldUseAttachMenu()) {
          if ((actions.isFloatingSurfaceVisible || ((el) => !el?.classList.contains('hidden')))(attachMenu)) {
            hideAttachMenu();
            return;
          }
          openAttachMenu({ keepKeyboardOpen });
        } else {
          dom.fileInput?.click();
        }
      });

      win.visualViewport?.addEventListener('resize', () => {
        if (isMobileAttachMenu() && attachMenu && !attachMenu.classList.contains('hidden')) {
          positionAttachMenu();
        }
      });
      doc.addEventListener('click', (event) => {
        if (
          attachMenu
          && (actions.isFloatingSurfaceVisible || ((el) => !el?.classList.contains('hidden')))(attachMenu)
          && !attachMenu.contains(event.target)
          && !event.target.closest('#attachBtn')
        ) {
          hideAttachMenu();
        }
      });

      attachMenuOverlay?.addEventListener('click', () => hideAttachMenu());
      doc.getElementById('attachMenuCancel')?.addEventListener('click', () => hideAttachMenu());
      doc.getElementById('attachMenuGallery')?.addEventListener('click', () => { hideAttachMenu(); fileInputGallery?.click(); });
      doc.getElementById('attachMenuCamera')?.addEventListener('click', () => { hideAttachMenu(); fileInputCamera?.click(); });
      doc.getElementById('attachMenuFile')?.addEventListener('click', () => { hideAttachMenu(); fileInputDocs?.click(); });
      doc.getElementById('attachMenuPoll')?.addEventListener('click', () => { hideAttachMenu(); openPollComposer(); });
      doc.getElementById('attachMenuLocation')?.addEventListener('click', () => { hideAttachMenu(); openLocationPicker(); });

      bindFileInput(dom.fileInput);
      bindFileInput(fileInputGallery, { resetValue: true });
      bindFileInput(fileInputCamera, { resetValue: true });
      bindFileInput(fileInputDocs, { resetValue: true });
    }

    return {
      uploadFiles,
      isPreparingFiles,
      renderPendingFiles,
      clearPendingFile,
      hideAttachMenu,
      closeAttachMenu: hideAttachMenu,
      openAttachMenu,
      positionAttachMenu,
      bindAttachMenuEvents,
    };
  }

  composerRoot.files = {
    createComposerFilesController,
  };
})();
