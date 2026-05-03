const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const { repoRoot } = require('../support/paths');

const indexHtml = fs.readFileSync(path.join(repoRoot, 'public', 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(repoRoot, 'public', 'css', 'style.css'), 'utf8');

test('public/index.html keeps expected stylesheet and script order', () => {
  const dom = new JSDOM(indexHtml);
  const document = dom.window.document;

  const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map((node) => node.getAttribute('href'));
  const scripts = [...document.querySelectorAll('script[src]')].map((node) => node.getAttribute('src'));

  assert.deepEqual(styles, [
    '/css/style.css?v=20260501-mobile-font-size',
    '/css/voice.css',
    '/css/video-notes.css',
  ]);

  assert.deepEqual(scripts, [
    '/js/sounds.js',
    '/js/messageCache.js',
    '/js/ai-image-risk.js',
    '/js/app.js?v=20260501-mobile-font-size',
    '/js/video-notes/video-note-shapes.js',
    '/js/video-notes/VideoShapeRegistry.js',
    '/js/video-notes/AudioNoteRecorderAdapter.js',
    '/js/video-notes/VideoNoteRecorder.js',
    '/js/video-notes/VideoNoteRenderer.js',
    '/js/video-notes/MediaNoteComposerController.js',
    '/js/video-notes/VideoNoteFeature.js',
    '/js/voice.js',
  ]);
});

test('public/index.html exposes core shell nodes used by runtime modules', () => {
  const dom = new JSDOM(indexHtml);
  const document = dom.window.document;
  const requiredIds = [
    'app',
    'sidebar',
    'chatFoldersBtn',
    'chatFolderContent',
    'chatFolderListSurface',
    'activeChatFolderBar',
    'activeChatFolderStrip',
    'chatArea',
    'messages',
    'sendBtn',
    'msgInput',
    'settingsModal',
    'pollComposerModal',
    'chatInfoModal',
    'chatFolderPicker',
    'chatFolderManageModal',
    'folderTab',
    'createFolderBtn',
  ];

  requiredIds.forEach((id) => {
    assert.ok(document.getElementById(id), `Expected #${id} to exist in index.html`);
  });

  assert.equal(document.getElementById('chatBotInfoSection'), null);
  assert.equal(document.getElementById('activeChatFolderVisibilityToggle'), null);
});

test('public/index.html keeps universal file pickers and mobile media shortcuts', () => {
  const dom = new JSDOM(indexHtml);
  const document = dom.window.document;

  assert.equal(document.getElementById('fileInput').getAttribute('accept'), null);
  assert.equal(document.getElementById('fileInputDocs').getAttribute('accept'), null);
  assert.equal(document.getElementById('fileInputGallery').getAttribute('accept'), 'image/*,video/*');
  assert.equal(document.getElementById('fileInputCamera').getAttribute('accept'), 'image/*');
});

test('style.css keeps a dedicated unread badge contrast override for active chats', () => {
  const activeBadgeRuleMatch = styleCss.match(/\.unread-badge--active-chat\s*\{([^}]*)\}/s);
  assert.ok(activeBadgeRuleMatch, 'Expected .unread-badge--active-chat rule in style.css');
  const ruleBody = activeBadgeRuleMatch[1];
  assert.match(ruleBody, /background\s*:/);
  assert.match(ruleBody, /color\s*:\s*#fff\s*;/);
});
