const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  installAppBridge,
  loadBrowserScript,
  loadBrowserScripts,
} = require('../support/domHarness');

const VIDEO_NOTE_SCRIPTS = [
  'public/js/video-notes/video-note-shapes.js',
  'public/js/video-notes/VideoShapeRegistry.js',
  'public/js/video-notes/AudioNoteRecorderAdapter.js',
  'public/js/video-notes/VideoNoteRecorder.js',
  'public/js/video-notes/VideoNoteRenderer.js',
  'public/js/video-notes/MediaNoteComposerController.js',
  'public/js/video-notes/VideoNoteFeature.js',
];

test('video note scripts bootstrap namespaces and bridge hooks in index order', () => {
  const dom = createAppDom();
  installAppBridge(dom);
  let voiceRefreshCalls = 0;
  dom.window.BananzaVoiceHooks = {
    refreshComposerState() {
      voiceRefreshCalls += 1;
    },
    canUseGesture() {
      return true;
    },
    isRecording() {
      return false;
    },
  };

  loadBrowserScripts(dom, VIDEO_NOTE_SCRIPTS);
  dom.window.dispatchEvent(new dom.window.Event('bananza:ready'));

  assert.ok(dom.window.BananzaVideoNotes);
  assert.equal(typeof dom.window.BananzaVideoNotes.VideoShapeRegistry, 'function');
  assert.equal(typeof dom.window.BananzaMediaNoteHooks.ownsComposer, 'function');
  assert.equal(dom.window.BananzaMediaNoteHooks.ownsComposer(), true);
  assert.equal(typeof dom.window.BananzaVideoNoteHooks.renderAttachment, 'function');
  assert.ok(voiceRefreshCalls >= 1);
});

test('video note renderer produces attachment markup with expected controls', () => {
  const dom = createAppDom();
  loadBrowserScript(dom, 'public/js/video-notes/video-note-shapes.js');
  loadBrowserScript(dom, 'public/js/video-notes/VideoShapeRegistry.js');
  loadBrowserScript(dom, 'public/js/video-notes/VideoNoteRenderer.js');

  const ns = dom.window.BananzaVideoNotes;
  const registry = new ns.VideoShapeRegistry(ns.shapePresets);
  const renderer = new ns.VideoNoteRenderer({
    bridge: installAppBridge(dom),
    shapeRegistry: registry,
  });

  const html = renderer.renderAttachment({
    id: 71,
    is_video_note: true,
    file_stored: 'video.webm',
    file_mime: 'video/webm',
    video_note_shape_id: 'banana-fat',
  });

  assert.ok(html.includes('video-note-stage'));
  assert.ok(html.includes('video-note-shape-toggle-btn'));
  assert.ok(html.includes('/uploads/video.webm/preview'));
});

test('video note viewer opens without autoplay', (t) => {
  const dom = createAppDom();
  const bridge = installAppBridge(dom);
  loadBrowserScript(dom, 'public/js/video-notes/VideoNoteViewer.js');

  let playCalls = 0;
  const originalPlay = dom.window.HTMLMediaElement.prototype.play;
  dom.window.HTMLMediaElement.prototype.play = function play() {
    playCalls += 1;
    return Promise.resolve();
  };
  t.after(() => {
    dom.window.HTMLMediaElement.prototype.play = originalPlay;
  });

  const ns = dom.window.BananzaVideoNotes;
  const viewer = new ns.VideoNoteViewer({
    bridge,
    shapeRegistry: {
      snapshotFromMessage() {
        return null;
      },
      getMaskUrl() {
        return '';
      },
    },
  });

  viewer.open({
    id: 72,
    file_stored: 'video.webm',
    transcription_text: 'Привет',
  });

  assert.ok(viewer.root);
  assert.equal(viewer.root.classList.contains('hidden'), false);
  assert.match(viewer.videoEl.src, /\/uploads\/video\.webm\/preview$/);
  assert.equal(viewer.captionEl.textContent, 'Привет');
  assert.equal(playCalls, 0);
});
