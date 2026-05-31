(function () {
  'use strict';

  const runtime = window.BananzaApp?.runtime?.createAppRuntime;
  if (typeof runtime !== 'function') {
    throw new Error('BananzaApp runtime is required before app.js');
  }
  runtime();
})();
