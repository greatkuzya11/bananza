(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};
  const compositionRoot = bootRoot.composition = bootRoot.composition || {};

  function createEvalExports(names, accessors = {}) {
    const runtimeExports = {};
    Array.from(new Set(names || [])).forEach((name) => {
      if (!name || typeof name !== 'string') return;
      Object.defineProperty(runtimeExports, name, {
        configurable: true,
        enumerable: true,
        get() {
          return accessors.get(name);
        },
        set(value) {
          return accessors.set(name, value);
        },
      });
    });
    return runtimeExports;
  }

  function installRuntimeExports(scope, runtimeExports, options = {}) {
    if (!scope || !runtimeExports || typeof runtimeExports !== 'object') return runtimeExports;
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

  function mergeRuntimeExports(target, runtimeExports, options = {}) {
    if (!target || !runtimeExports || typeof runtimeExports !== 'object') return target;
    const skipExisting = Boolean(options.skipExisting);
    const descriptors = Object.getOwnPropertyDescriptors(runtimeExports);
    Object.keys(descriptors).forEach((name) => {
      if (skipExisting && Object.prototype.hasOwnProperty.call(target, name)) return;
      Object.defineProperty(target, name, {
        ...descriptors[name],
        configurable: true,
      });
    });
    return target;
  }

  function requireCompositionStep(name, fn) {
    if (typeof fn !== 'function') {
      throw new Error('Bananza runtime composition is missing ' + name);
    }
    return fn;
  }

  window.BananzaApp.boot.composition.createEvalExports = createEvalExports;
  compositionRoot.installRuntimeExports = installRuntimeExports;
  compositionRoot.mergeRuntimeExports = mergeRuntimeExports;
  compositionRoot.requireCompositionStep = requireCompositionStep;
})();
