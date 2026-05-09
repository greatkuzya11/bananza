(function () {
  'use strict';

  let audioContext = null;
  let ringTimer = 0;

  function beep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      audioContext = audioContext || new AudioCtx();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.045;
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 0.18);
    } catch {}
  }

  function startRingtone(enabled) {
    if (!enabled || ringTimer) return;
    beep();
    ringTimer = window.setInterval(beep, 1400);
  }

  function stopRingtone() {
    if (ringTimer) window.clearInterval(ringTimer);
    ringTimer = 0;
  }

  function notifyIncoming(title, body) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const notification = new Notification(title, { body, tag: 'bananza-call', renotify: true });
      window.setTimeout(() => notification.close?.(), 12000);
    } catch {}
  }

  window.BananzaCallNotifications = {
    notifyIncoming,
    startRingtone,
    stopRingtone,
  };
})();
