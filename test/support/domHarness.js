const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
const { repoRoot } = require('./paths');

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
  createAppDom,
  installAppBridge,
  loadBrowserScript,
  loadBrowserScripts,
  setDocumentHidden,
};
