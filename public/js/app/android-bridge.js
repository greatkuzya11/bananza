(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};

  function getWindow() {
    return typeof window !== 'undefined' ? window : null;
  }

  function hasAndroidNativeBridge(win = getWindow()) {
    return Boolean(win?.BananzaAndroid && typeof win.BananzaAndroid.postMessage === 'function');
  }

  function postAndroidMessage(message, win = getWindow()) {
    if (!hasAndroidNativeBridge(win)) return false;
    try {
      win.BananzaAndroid.postMessage(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  function notifyAndroidScreenRotationPreference(allowed, reason = 'sync', win = getWindow()) {
    return postAndroidMessage({
      type: 'screen_rotation_preference',
      payload: {
        allowed: Boolean(allowed),
        reason,
      },
    }, win);
  }

  function notifyAndroidMobileFontSize(size, mobileLayout = false, win = getWindow()) {
    return postAndroidMessage({
      type: 'mobile_font_size',
      payload: {
        size,
        mobileLayout: Boolean(mobileLayout),
      },
    }, win);
  }

  root.androidBridge = {
    hasAndroidNativeBridge,
    notifyAndroidScreenRotationPreference,
    notifyAndroidMobileFontSize,
  };
})();
