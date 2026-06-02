(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const runtimeRoot = root.runtime = root.runtime || {};

  runtimeRoot.createAppRuntime = function createAppRuntime() {
    root.performance?.mark?.('bananza:runtime-create-start');
    const boot = root.boot || {};
    if (typeof boot.init !== 'function') {
      throw new Error('BananzaApp boot init module is required before runtime.js');
    }
    const bridge = boot.init();
    root.performance?.mark?.('bananza:runtime-create-end');
    root.performance?.measure?.('bananza:runtime-create', 'bananza:runtime-create-start', 'bananza:runtime-create-end');
    return bridge;
  };
})();
