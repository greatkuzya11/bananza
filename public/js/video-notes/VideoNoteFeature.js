(function () {
  'use strict';

  const ns = window.BananzaVideoNotes = window.BananzaVideoNotes || {};

  let feature = null;

  function createFeature() {
    if (feature) return feature;
    const bridge = window.BananzaAppBridge || null;
    const shapeRegistry = new ns.VideoShapeRegistry(ns.shapePresets || []);
    const renderer = new ns.VideoNoteRenderer({ bridge, shapeRegistry });
    const audioAdapter = new ns.AudioNoteRecorderAdapter();
    const controller = new ns.MediaNoteComposerController({ bridge, audioAdapter });
    const videoRecorder = new ns.VideoNoteRecorder({
      bridge,
      shapeRegistry,
      getSelectedShapeId: () => 'banana-fat',
      onStateChange: () => controller.refreshComposerState(),
    });
    controller.videoRecorder = videoRecorder;
    feature = { bridge, shapeRegistry, renderer, audioAdapter, controller, videoRecorder };
    return feature;
  }

  const mediaHooks = window.BananzaMediaNoteHooks = window.BananzaMediaNoteHooks || {};
  Object.assign(mediaHooks, {
    ownsComposer: () => true,
    refreshComposerState: (state) => {
      const current = createFeature();
      current.controller.refreshComposerState(state || null);
    },
  });

  const videoHooks = window.BananzaVideoNoteHooks = window.BananzaVideoNoteHooks || {};
  Object.assign(videoHooks, {
    renderAttachment: (message) => createFeature().renderer.renderAttachment(message),
    decorateMessageRow: (row, message) => createFeature().renderer.decorateMessageRow(row, message),
    handleWSMessage: (msg) => createFeature().renderer.handleWSMessage(msg),
    refreshComposerState: (state) => createFeature().controller.refreshComposerState(state || null),
  });

  function bootstrap() {
    const current = createFeature();
    const liveBridge = window.BananzaAppBridge || current.bridge || null;
    current.bridge = liveBridge;
    current.renderer.bridge = liveBridge;
    current.controller.bridge = liveBridge;
    current.videoRecorder.bridge = liveBridge;
    const messagesEl = current.bridge?.getDom?.()?.messagesEl;
    current.renderer.bindDelegatedEvents(messagesEl);
    current.controller.init();
    window.BananzaVoiceHooks?.refreshComposerState?.();
  }

  window.addEventListener('bananza:ready', bootstrap);
  if (document.readyState !== 'loading') {
    bootstrap();
  } else {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  }
})();
