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
    '/css/style.css?v=20260523-keyboard-pan-lock',
    '/css/calls.css?v=20260509-call-modal-surface',
    '/css/voice.css',
    '/css/video-notes.css',
  ]);

  assert.deepEqual(scripts, [
    '/js/sounds.js',
    '/js/messageCache.js',
    '/js/ai-image-risk.js',
    '/js/i18n.js?v=20260509-call-modal-surface',
    '/js/qip-infium-original.js?v=20260523-qip-infium-original',
    '/js/qip-hd.js?v=20260523-qip-hd',
    '/js/app.js?v=20260523-keyboard-pan-lock',
    '/js/calls/CallStore.js?v=20260509-call-modal-surface',
    '/js/calls/CallMedia.js?v=20260509-call-modal-surface',
    '/js/calls/CallNotifications.js?v=20260509-call-modal-surface',
    '/js/calls/CallFeature.js?v=20260509-call-modal-surface',
    '/js/video-notes/video-note-shapes.js',
    '/js/video-notes/VideoShapeRegistry.js',
    '/js/video-notes/AudioNoteRecorderAdapter.js',
    '/js/video-notes/VideoNoteRecorder.js',
    '/js/video-notes/VideoNoteRenderer.js',
    '/js/video-notes/MediaNoteComposerController.js',
    '/js/video-notes/VideoNoteAdminSettings.js',
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
    'composerRichPreview',
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
  assert.equal(document.getElementById('refreshChatsBtn'), null);
});

test('settings modal menu entries keep emoji prefixes', () => {
  const dom = new JSDOM(indexHtml);
  const document = dom.window.document;
  const menuButtons = [...document.querySelectorAll('#settingsModal .modal-body > button.settings-item[id^="settings"]')];
  const emojiPrefixPattern = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
  const missingEmoji = menuButtons
    .map((button) => ({ id: button.id, text: button.textContent.trim() }))
    .filter((item) => !emojiPrefixPattern.test(item.text));

  assert.deepEqual(missingEmoji, []);
});

test('public/index.html keeps universal file pickers and mobile media shortcuts', () => {
  const dom = new JSDOM(indexHtml);
  const document = dom.window.document;

  assert.equal(document.getElementById('fileInput').getAttribute('accept'), null);
  assert.equal(document.getElementById('fileInputDocs').getAttribute('accept'), null);
  assert.equal(document.getElementById('fileInputGallery').getAttribute('accept'), 'image/*,video/*');
  assert.equal(document.getElementById('fileInputCamera').getAttribute('accept'), 'image/*');
});

test('profile settings modal exposes accessible profile controls', () => {
  const dom = new JSDOM(indexHtml);
  const document = dom.window.document;
  const menuDrawer = document.getElementById('menuDrawer');

  assert.ok(menuDrawer.querySelector('.profile-settings-modal'));
  assert.ok(menuDrawer.querySelector('.profile-hero'));
  assert.ok(document.getElementById('profileForm'));
  assert.ok(document.getElementById('profileDisplayPreview'));
  assert.equal(document.getElementById('profileAvatarInput').getAttribute('accept'), '.jpg,.jpeg,.png,.webp');
  assert.equal(document.getElementById('profileAvatarPickBtn').getAttribute('type'), 'button');
  assert.equal(document.getElementById('removeProfileAvatar').getAttribute('type'), 'button');
  assert.equal(document.getElementById('saveProfileBtn').getAttribute('type'), 'submit');
  assert.equal(document.getElementById('profileStatus').getAttribute('role'), 'status');
  assert.equal(document.getElementById('profileStatus').getAttribute('aria-live'), 'polite');
  assert.equal(document.getElementById('colorPicker').getAttribute('role'), 'radiogroup');
  assert.equal(document.getElementById('colorPicker').getAttribute('aria-labelledby'), 'profileColorLegend');
});

test('style.css keeps a dedicated unread badge contrast override for active chats', () => {
  const activeBadgeRuleMatch = styleCss.match(/\.unread-badge--active-chat\s*\{([^}]*)\}/s);
  assert.ok(activeBadgeRuleMatch, 'Expected .unread-badge--active-chat rule in style.css');
  const ruleBody = activeBadgeRuleMatch[1];
  assert.match(ruleBody, /background\s*:/);
  assert.match(ruleBody, /color\s*:\s*#fff\s*;/);
});

test('style.css keeps New Chat modal folder tab height aligned with the other tabs', () => {
  assert.match(styleCss, /#newChatModal\s+\.modal-content\s*\{[^}]*height\s*:\s*min\(620px,\s*80vh\)/s);
  assert.match(styleCss, /#newChatModal\s+\.modal-body\s*\{[^}]*display\s*:\s*flex[^}]*overflow\s*:\s*hidden/s);
  assert.match(styleCss, /#newChatModal\s+\.tab-pane\.active\s*\{[^}]*display\s*:\s*flex[^}]*flex\s*:\s*1/s);
  assert.match(styleCss, /#newChatModal\s+#newFolderChatList\s*\{[^}]*overflow-y\s*:\s*auto/s);
  assert.match(styleCss, /#newChatModal\s+\.folder-chat-selection-list\s*\{[^}]*max-height\s*:\s*none\s*;/s);
});

test('style.css opts mobile composer controls out of native browser panning', () => {
  assert.match(styleCss, /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*\.input-area #msgInput,\s*\.input-area \.mention-open-btn\s*\{[^}]*touch-action\s*:\s*none\s*;/s);
  assert.match(styleCss, /html\.is-mobile-chat-keyboard-layout \.emoji-picker,[\s\S]*\.mention-picker-list\s*\{[^}]*touch-action\s*:\s*none\s*;/s);
});
