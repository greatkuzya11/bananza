(function () {
  'use strict';

  const ns = window.BananzaVideoNotes = window.BananzaVideoNotes || {};

  class AudioNoteRecorderAdapter {
    canUseGesture() {
      return Boolean(window.BananzaVoiceHooks?.canUseGesture?.());
    }

    isRecording() {
      return Boolean(window.BananzaVoiceHooks?.isRecording?.());
    }

    async start() {
      await window.BananzaVoiceHooks?.startExternalRecording?.();
    }

    async stopAndSend() {
      await window.BananzaVoiceHooks?.stopExternalRecording?.();
    }
  }

  ns.AudioNoteRecorderAdapter = AudioNoteRecorderAdapter;
})();
