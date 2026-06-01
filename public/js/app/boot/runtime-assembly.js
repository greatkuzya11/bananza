(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function bindWindowFunction(name) {
    const value = window[name];
    return typeof value === 'function' ? value.bind(window) : value;
  }

  function createRuntimeScope(ctx) {
    if (ctx && typeof ctx === 'object') window.__bananzaBootContext = ctx;

    const scope = Object.create(null);
    Object.assign(scope, {
      ctx: ctx || null,
      window,
      document,
      console: window.console || console,
      Math,
      Date,
      JSON,
      Number,
      String,
      Boolean,
      Array,
      Object,
      Promise,
      RegExp,
      Error,
      TypeError,
      eval,
      parseInt,
      parseFloat,
      isNaN,
      encodeURIComponent,
      decodeURIComponent,
    });

    [
      'alert',
      'confirm',
      'prompt',
      'fetch',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'queueMicrotask',
      'getComputedStyle',
      'addEventListener',
      'removeEventListener',
    ].forEach((name) => {
      const bound = bindWindowFunction(name);
      if (bound) scope[name] = bound;
    });

    return new Proxy(scope, {
      has() { return true; },
      get(target, key) {
        if (key === Symbol.unscopables) return undefined;
        if (Object.prototype.hasOwnProperty.call(target, key)) return target[key];
        if (typeof key === 'string' && key in window) return window[key];
        return undefined;
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    });
  }

  function installRuntimeExports(scope, runtimeExports, options = {}) {
    if (!runtimeExports || typeof runtimeExports !== 'object') return runtimeExports;
    const skipExisting = Boolean(options.skipExisting);
    const descriptors = Object.getOwnPropertyDescriptors(runtimeExports);
    Object.keys(descriptors).forEach((name) => {
      if (skipExisting && Object.prototype.hasOwnProperty.call(scope, name)) return;
      Object.defineProperty(scope, name, {
        ...descriptors[name],
        configurable: true,
      });
    });
    return runtimeExports;
  }

  function requireRuntimeStep(name, fn) {
    if (typeof fn !== 'function') {
      throw new Error('Bananza runtime startup is missing ' + name);
    }
    return fn;
  }

  bootRoot.runRuntimeAssembly = function runRuntimeAssembly(ctx) {
    const scope = createRuntimeScope(ctx);

    installRuntimeExports(scope, requireRuntimeStep('boot.createRuntimeCore', bootRoot.createRuntimeCore)(scope));
    installRuntimeExports(scope, requireRuntimeStep('boot.composeFeatureRuntime', bootRoot.composeFeatureRuntime)(scope));
    installRuntimeExports(scope, requireRuntimeStep('shell.mobileRuntimeAdapters.createMobileRuntimeAdapters', root.shell?.mobileRuntimeAdapters?.createMobileRuntimeAdapters)(scope));
    installRuntimeExports(scope, requireRuntimeStep('boot.createRuntimePublicBridge', bootRoot.createRuntimePublicBridge)(scope));
    installRuntimeExports(scope, requireRuntimeStep('boot.wsDispatch.createRuntimeWsDispatch', bootRoot.wsDispatch?.createRuntimeWsDispatch)(scope), { skipExisting: true });

    return requireRuntimeStep('boot.runRuntimeStartup', bootRoot.runRuntimeStartup)(scope);
  };
})();
