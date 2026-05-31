const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
const { repoRoot } = require('./paths');

const appShellScriptPaths = Object.freeze([
  'public/js/app/namespace.js',
  'public/js/app/context.js',
  'public/js/app/bridge.js',
]);
const appCoreHelperScriptPaths = Object.freeze([
  'public/js/app/config.js',
  'public/js/app/i18n-helpers.js',
  'public/js/app/formatters.js',
  'public/js/app/attachments.js',
  'public/js/app/custom-emoji.js',
]);
const appDomMobileShellScriptPaths = Object.freeze([
  'public/js/app/dom.js',
  'public/js/app/android-bridge.js',
  'public/js/app/mobile-viewport.js',
  'public/js/app/chat-header-actions.js',
]);
const appModalManagerScriptPaths = Object.freeze([
  'public/js/app/modal-manager.js',
]);
const appSettingsScriptPaths = Object.freeze([
  'public/js/app/settings/ui-settings.js',
  'public/js/app/settings/weather-settings.js',
  'public/js/app/settings/notification-settings.js',
  'public/js/app/settings/sound-settings.js',
  'public/js/app/settings/settings-modal.js',
]);
const appFolderScriptPaths = Object.freeze([
  'public/js/app/folders/store.js',
  'public/js/app/folders/ui.js',
  'public/js/app/folders/actions.js',
  'public/js/app/folders/manage-modal.js',
  'public/js/app/folders/new-folder-tab.js',
]);
const appChatListScriptPaths = Object.freeze([
  'public/js/app/chat-list/store.js',
  'public/js/app/chat-list/render.js',
  'public/js/app/chat-list/data.js',
  'public/js/app/chat-list/presence.js',
  'public/js/app/chat-list/recovery.js',
]);
const appOpenChatScriptPaths = Object.freeze([
  'public/js/app/open-chat/pages.js',
  'public/js/app/open-chat/read-receipts.js',
  'public/js/app/open-chat/scroll.js',
  'public/js/app/open-chat/media-playback.js',
  'public/js/app/open-chat/controller.js',
]);
const appMessageScriptPaths = Object.freeze([
  'public/js/app/messages/state.js',
  'public/js/app/messages/attachments.js',
  'public/js/app/messages/polls.js',
  'public/js/app/messages/call-cards.js',
  'public/js/app/messages/outbox.js',
  'public/js/app/messages/updates.js',
  'public/js/app/messages/render.js',
]);
const appComposerScriptPaths = Object.freeze([
  'public/js/app/composer/state.js',
  'public/js/app/composer/text.js',
  'public/js/app/composer/reply-edit.js',
  'public/js/app/composer/files.js',
  'public/js/app/composer/send.js',
  'public/js/app/composer/emoji-picker.js',
  'public/js/app/composer/mentions.js',
  'public/js/app/composer/typing-dragdrop.js',
  'public/js/app/composer/poll-composer.js',
]);
const appRuntimeScriptPaths = Object.freeze([
  ...appShellScriptPaths,
  ...appCoreHelperScriptPaths,
  ...appDomMobileShellScriptPaths,
  ...appModalManagerScriptPaths,
  ...appSettingsScriptPaths,
  ...appFolderScriptPaths,
  ...appChatListScriptPaths,
  ...appOpenChatScriptPaths,
  ...appMessageScriptPaths,
  ...appComposerScriptPaths,
]);

class FakeAudioNode {
  connect() {
    return this;
  }

  disconnect() {}
}

class FakeAudioParam {
  setValueAtTime() {}

  exponentialRampToValueAtTime() {}

  linearRampToValueAtTime() {}
}

class FakeAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = new FakeAudioNode();
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  close() {
    this.state = 'closed';
    return Promise.resolve();
  }

  createOscillator() {
    return Object.assign(new FakeAudioNode(), {
      frequency: new FakeAudioParam(),
      start() {},
      stop() {},
      type: 'sine',
    });
  }

  createGain() {
    return Object.assign(new FakeAudioNode(), {
      gain: new FakeAudioParam(),
    });
  }

  createBiquadFilter() {
    return Object.assign(new FakeAudioNode(), {
      frequency: new FakeAudioParam(),
      Q: new FakeAudioParam(),
      type: 'lowpass',
    });
  }

  createBuffer(channels, frameCount) {
    return {
      getChannelData() {
        return new Float32Array(frameCount);
      },
    };
  }

  createBufferSource() {
    return Object.assign(new FakeAudioNode(), {
      start() {},
      stop() {},
      buffer: null,
    });
  }

  createMediaStreamSource() {
    return new FakeAudioNode();
  }

  createScriptProcessor() {
    return Object.assign(new FakeAudioNode(), {
      onaudioprocess: null,
    });
  }
}

class FakeTrack {
  stop() {}
}

class FakeMediaStream {
  getTracks() {
    return [new FakeTrack(), new FakeTrack()];
  }
}

class FakeMediaRecorder {
  static isTypeSupported() {
    return true;
  }

  constructor() {
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob(['video-note'], { type: 'video/webm' }),
    });
    this.onstop?.();
  }
}

function setDocumentHidden(document, hidden) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    enumerable: true,
    get() {
      return hidden;
    },
  });
}

function installVisualViewportMock(window, initialMetrics = {}) {
  const target = new window.EventTarget();
  const metrics = {
    width: Math.max(0, Number(initialMetrics.width ?? window.innerWidth ?? 0) || 0),
    height: Math.max(0, Number(initialMetrics.height ?? window.innerHeight ?? 0) || 0),
    offsetTop: Math.max(0, Number(initialMetrics.offsetTop ?? 0) || 0),
    offsetLeft: Math.max(0, Number(initialMetrics.offsetLeft ?? 0) || 0),
    scale: Number(initialMetrics.scale ?? 1) || 1,
    pageTop: Math.max(0, Number(initialMetrics.pageTop ?? 0) || 0),
    pageLeft: Math.max(0, Number(initialMetrics.pageLeft ?? 0) || 0),
  };
  const visualViewport = {
    get width() {
      return metrics.width;
    },
    get height() {
      return metrics.height;
    },
    get offsetTop() {
      return metrics.offsetTop;
    },
    get offsetLeft() {
      return metrics.offsetLeft;
    },
    get scale() {
      return metrics.scale;
    },
    get pageTop() {
      return metrics.pageTop;
    },
    get pageLeft() {
      return metrics.pageLeft;
    },
    addEventListener(...args) {
      target.addEventListener(...args);
    },
    removeEventListener(...args) {
      target.removeEventListener(...args);
    },
    dispatchEvent(event) {
      return target.dispatchEvent(event);
    },
  };

  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    enumerable: true,
    value: visualViewport,
  });

  return {
    visualViewport,
    metrics,
    set(nextMetrics = {}) {
      if ('width' in nextMetrics) metrics.width = Math.max(0, Number(nextMetrics.width) || 0);
      if ('height' in nextMetrics) metrics.height = Math.max(0, Number(nextMetrics.height) || 0);
      if ('offsetTop' in nextMetrics) metrics.offsetTop = Math.max(0, Number(nextMetrics.offsetTop) || 0);
      if ('offsetLeft' in nextMetrics) metrics.offsetLeft = Math.max(0, Number(nextMetrics.offsetLeft) || 0);
      if ('scale' in nextMetrics) metrics.scale = Number(nextMetrics.scale) || 1;
      if ('pageTop' in nextMetrics) metrics.pageTop = Math.max(0, Number(nextMetrics.pageTop) || 0);
      if ('pageLeft' in nextMetrics) metrics.pageLeft = Math.max(0, Number(nextMetrics.pageLeft) || 0);
      return { ...metrics };
    },
    dispatch(type) {
      return visualViewport.dispatchEvent(new window.Event(type));
    },
    setAndDispatch(type, nextMetrics = {}) {
      this.set(nextMetrics);
      return this.dispatch(type);
    },
  };
}

function installCommonStubs(window) {
  window.indexedDB = indexedDB;
  window.IDBKeyRange = IDBKeyRange;
  window.caches = {
    async open() {
      return {
        async addAll() {},
        async put() {},
        async match() { return null; },
      };
    },
    async delete() {
      return true;
    },
  };
  window.fetch = globalThis.fetch;
  window.Response = globalThis.Response;
  window.Request = globalThis.Request;
  window.Headers = globalThis.Headers;
  window.Blob = globalThis.Blob;
  window.FormData = globalThis.FormData;
  window.URL.createObjectURL = () => 'blob:mock-object-url';
  window.URL.revokeObjectURL = () => {};
  window.matchMedia = () => ({
    matches: false,
    media: '',
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  if (typeof window.HTMLElement.prototype.scrollIntoView !== 'function') {
    window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  }
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.AudioContext = FakeAudioContext;
  window.webkitAudioContext = FakeAudioContext;
  window.MediaRecorder = FakeMediaRecorder;
  window.navigator.userActivation = {
    isActive: true,
    hasBeenActive: true,
  };
  window.navigator.mediaDevices = {
    async getUserMedia() {
      return new FakeMediaStream();
    },
  };
  window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(window.performance.now()), 16);
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  setDocumentHidden(window.document, false);
}

function createAppDom() {
  const html = fs.readFileSync(path.join(repoRoot, 'public', 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost:3000/',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  installCommonStubs(dom.window);
  return dom;
}

function loadBrowserScript(dom, relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  vm.runInContext(source, dom.getInternalVMContext(), {
    filename: absolutePath,
  });
}

function loadBrowserScripts(dom, relativePaths) {
  relativePaths.forEach((relativePath) => loadBrowserScript(dom, relativePath));
}

function loadAppShellScripts(dom) {
  loadBrowserScripts(dom, appShellScriptPaths);
}

function loadAppCoreHelperScripts(dom) {
  loadBrowserScripts(dom, appCoreHelperScriptPaths);
}

function loadAppDomMobileShellScripts(dom) {
  loadBrowserScripts(dom, appDomMobileShellScriptPaths);
}

function loadAppModalManagerScripts(dom) {
  loadBrowserScripts(dom, appModalManagerScriptPaths);
}

function loadAppSettingsScripts(dom) {
  loadBrowserScripts(dom, appSettingsScriptPaths);
}

function loadAppFolderScripts(dom) {
  loadBrowserScripts(dom, appFolderScriptPaths);
}

function loadAppChatListScripts(dom) {
  loadBrowserScripts(dom, appChatListScriptPaths);
}

function loadAppOpenChatScripts(dom) {
  loadBrowserScripts(dom, appOpenChatScriptPaths);
}

function loadAppMessageScripts(dom) {
  loadBrowserScripts(dom, appMessageScriptPaths);
}

function loadAppComposerScripts(dom) {
  loadBrowserScripts(dom, appComposerScriptPaths);
}

function loadAppRuntimeScripts(dom) {
  loadBrowserScripts(dom, appRuntimeScriptPaths);
}

function loadAppScript(dom) {
  loadAppRuntimeScripts(dom);
  loadBrowserScript(dom, 'public/js/app.js');
}

function installAppBridge(dom, overrides = {}) {
  const { window } = dom;
  const document = window.document;
  const bridge = {
    getDom() {
      return {
        app: document.getElementById('app'),
        messagesEl: document.getElementById('messages'),
        sendBtn: document.getElementById('sendBtn'),
        msgInput: document.getElementById('msgInput'),
      };
    },
    scrollToBottom() {},
    registerManagedModal() {},
    openManagedModal(id) {
      const node = document.getElementById(id);
      node?.classList.remove('hidden');
    },
    closeManagedModal(id) {
      const node = document.getElementById(id);
      node?.classList.add('hidden');
    },
    getCurrentModalAnimation() {
      return 'soft';
    },
    getCurrentModalAnimationSpeed() {
      return 8;
    },
    getAttachmentPreviewUrl(source) {
      if (!source) return '';
      if (typeof source === 'string') return `/uploads/${encodeURIComponent(source)}/preview`;
      return source.client_file_url || (source.file_stored ? `/uploads/${encodeURIComponent(source.file_stored)}/preview` : '');
    },
    getAttachmentDownloadUrl(source) {
      if (!source) return '';
      if (typeof source === 'string') return `/uploads/${encodeURIComponent(source)}`;
      return source.client_file_url || (source.file_stored ? `/uploads/${encodeURIComponent(source.file_stored)}` : '');
    },
    getAttachmentPosterUrl(source) {
      if (!source) return '';
      if (typeof source === 'string') return `/uploads/${encodeURIComponent(source)}/poster`;
      if (source.client_poster_url) return source.client_poster_url;
      const hasPoster = Boolean(
        source.file_poster_available
        || source.filePosterAvailable
        || source.poster_available
        || source.posterAvailable
      );
      return hasPoster && source.file_stored
        ? `/uploads/${encodeURIComponent(source.file_stored)}/poster`
        : '';
    },
    ensureAttachmentPoster(source, { videoEl = null, onReady = null } = {}) {
      const posterUrl = bridge.getAttachmentPosterUrl(source);
      if (posterUrl && videoEl?.setAttribute) videoEl.setAttribute('poster', posterUrl);
      if (posterUrl && typeof onReady === 'function') onReady(posterUrl);
      return Promise.resolve(posterUrl);
    },
    createAttachmentPosterBlob() {
      return Promise.resolve(null);
    },
    isIosWebkit() {
      return false;
    },
    getCurrentUser() {
      return { id: 1, display_name: 'Alice', is_admin: 1 };
    },
    ...overrides,
  };
  window.BananzaAppBridge = bridge;
  return bridge;
}

module.exports = {
  appChatListScriptPaths,
  appComposerScriptPaths,
  appCoreHelperScriptPaths,
  appDomMobileShellScriptPaths,
  appFolderScriptPaths,
  appMessageScriptPaths,
  appOpenChatScriptPaths,
  appModalManagerScriptPaths,
  appSettingsScriptPaths,
  appRuntimeScriptPaths,
  appShellScriptPaths,
  createAppDom,
  installAppBridge,
  installVisualViewportMock,
  loadAppScript,
  loadAppCoreHelperScripts,
  loadAppChatListScripts,
  loadAppComposerScripts,
  loadAppDomMobileShellScripts,
  loadAppFolderScripts,
  loadAppMessageScripts,
  loadAppModalManagerScripts,
  loadAppOpenChatScripts,
  loadAppSettingsScripts,
  loadAppRuntimeScripts,
  loadAppShellScripts,
  loadBrowserScript,
  loadBrowserScripts,
  setDocumentHidden,
};
