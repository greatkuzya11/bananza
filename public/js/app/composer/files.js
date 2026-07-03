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

    function bindButtonActivation(button, handler) {
      if (!button || button.__composerFilesActivationBound) return;
      button.__composerFilesActivationBound = true;
      if (typeof actions.bindTouchSafeButtonActivation === 'function') {
        actions.bindTouchSafeButtonActivation(button, handler);
        return;
      }
      button.addEventListener('click', (event) => handler({ event, startKeyboardOpen: false, keepKeyboardOpen: false }));
    }

    async function uploadFiles(fileList) {
      if (state.editTo) {
        (actions.alert || alert)('Finish editing before attaching files.');
        return false;
      }
      const incomingFiles = Array.from(fileList || []);
      if (incomingFiles.length === 0) return false;
      if (incomingFiles.length > MAX_ATTACHMENTS) {
        (actions.alert || alert)(`Use up to ${MAX_ATTACHMENTS} attachments.`);
        return false;
      }
      for (const f of incomingFiles) {
        if (f.size > MAX_FILE_SIZE) {
          (actions.alert || alert)(`File too large: ${f.name} (max ${MAX_FILE_SIZE_LABEL})`);
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
      const pendingFiles = (await Promise.all(incomingFiles.map((file) => localAttachmentFromFile(file)))).filter(Boolean);
      state.setPendingFiles(pendingFiles);
      renderPendingFiles();
      dom.msgInput?.focus();
      (actions.updateComposerAiOverrideState || noop)();
      (actions.refreshPollComposerActionState || noop)();
      (actions.refreshVoiceComposerState || noop)();
      (actions.scheduleMobileViewportRecovery || noop)();
      return true;
    }

    function renderPendingFiles() {
      const pendingFileEl = dom.pendingFileEl || doc.getElementById('pendingFile');
      const pendingFiles = state.pendingFiles || [];
      if (!pendingFiles.length) {
        clearPendingFile();
        return;
      }
      if (!pendingFileEl) return;
      pendingFileEl.classList.remove('hidden');
      const icon = (type) => type === 'image' ? '\u{1F5BC}' : type === 'audio' ? '\u{1F3B5}' : type === 'video' ? '\u{1F3AC}' : '\u{1F4C4}';
      if (pendingFiles.length === 1) {
        const file = pendingFiles[0];
        pendingFileEl.innerHTML = `
          <span>${icon(file.type)}</span>
          <span class="pending-file-name">${esc(file.name)} (${formatSize(file.size)})</span>
          <button class="pending-file-remove" title="Remove">x</button>
        `;
      } else {
        pendingFileEl.innerHTML = `
          <span>\u{1F4CE}</span>
          <span class="pending-file-name">${pendingFiles.length} files (${formatSize(pendingFiles.reduce((sum, file) => sum + file.size, 0))})</span>
          <button class="pending-file-remove" title="Remove all">x</button>
        `;
      }
      bindButtonActivation(pendingFileEl.querySelector('.pending-file-remove'), ({ event, startKeyboardOpen }) => {
        event?.stopPropagation?.();
        const keepComposerFocus = Boolean(startKeyboardOpen || (actions.isMobileComposerKeyboardOpen || (() => false))());
        clearPendingFile();
        if (keepComposerFocus) (actions.focusComposerKeepKeyboard || noop)(true);
      });
    }

    function clearPendingFile() {
      const pendingFileEl = dom.pendingFileEl || doc.getElementById('pendingFile');
      state.clearPendingFiles();
      if (pendingFileEl) {
        pendingFileEl.classList.add('hidden');
        pendingFileEl.innerHTML = '';
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

    function bindFileInput(input, { resetValue = false } = {}) {
      if (!input || input.__composerFilesInputBound) return;
      input.__composerFilesInputBound = true;
      input.addEventListener('change', () => {
        if (input.files?.length > 0) {
          uploadFiles(input.files);
          if (resetValue) input.value = '';
        }
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
        if (state.editTo) return;
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
