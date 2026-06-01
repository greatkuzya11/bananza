(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const runtimeRoot = root.runtime = root.runtime || {};

  runtimeRoot.createAppRuntime = function createAppRuntime() {
    const boot = root.boot || {};
    if (typeof boot.init !== 'function') {
      throw new Error('BananzaApp boot init module is required before runtime.js');
    }
    return boot.init();
  };
})();