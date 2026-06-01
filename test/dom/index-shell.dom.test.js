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
    '/css/style.css?v=20260527-native-screen-orientation',
    '/css/calls.css?v=20260509-call-modal-surface',
    '/css/voice.css',
    '/css/video-notes.css',
  ]);

  assert.deepEqual(scripts, [
    '/js/sounds.js',
    '/js/messageCache.js',
    '/js/ai-image-risk.js',
    '/js/i18n.js?v=20260527-native-screen-orientation',
    '/js/qip-infium-original.js?v=20260523-qip-infium-original',
    '/js/qip-hd.js?v=20260523-qip-hd',
    '/js/app/namespace.js?v=20260530-app-shell',
    '/js/app/context.js?v=20260530-app-shell',
    '/js/app/bridge.js?v=20260530-app-shell',
    '/js/app/config.js?v=20260531-core-helpers',
    '/js/app/i18n-helpers.js?v=20260531-core-helpers',
    '/js/app/formatters.js?v=20260531-core-helpers',
    '/js/app/attachments.js?v=20260531-core-helpers',
    '/js/app/custom-emoji.js?v=20260531-core-helpers',
    '/js/app/dom.js?v=20260531-dom-mobile-shell',
    '/js/app/android-bridge.js?v=20260531-dom-mobile-shell',
    '/js/app/mobile-viewport.js?v=20260531-dom-mobile-shell',
    '/js/app/chat-header-actions.js?v=20260531-dom-mobile-shell',
    '/js/app/shell/mobile-composer-guard.js?v=20260601-shell-events',
    '/js/app/shell/events.js?v=20260601-shell-events',
    '/js/app/modal-manager.js?v=20260531-modal-manager',
    '/js/app/settings/ui-settings.js?v=20260531-settings',
    '/js/app/settings/weather-settings.js?v=20260531-settings',
    '/js/app/settings/notification-settings.js?v=20260531-settings',
    '/js/app/settings/sound-settings.js?v=20260531-settings',
    '/js/app/settings/settings-modal.js?v=20260531-settings',
    '/js/app/folders/store.js?v=20260531-folders',
    '/js/app/folders/ui.js?v=20260531-folders',
    '/js/app/folders/actions.js?v=20260531-folders',
    '/js/app/folders/manage-modal.js?v=20260531-folders',
    '/js/app/folders/new-folder-tab.js?v=20260531-folders',
    '/js/app/folders/mobile-gestures.js?v=20260601-shell-events',
    '/js/app/chat-list/store.js?v=20260531-chat-list',
    '/js/app/chat-list/render.js?v=20260531-chat-list',
    '/js/app/chat-list/data.js?v=20260531-chat-list',
    '/js/app/chat-list/presence.js?v=20260531-chat-list',
    '/js/app/chat-list/recovery.js?v=20260531-chat-list',
    '/js/app/open-chat/pages.js?v=20260531-open-chat',
    '/js/app/open-chat/read-receipts.js?v=20260531-open-chat',
    '/js/app/open-chat/scroll.js?v=20260531-open-chat',
    '/js/app/open-chat/media-playback.js?v=20260531-open-chat',
    '/js/app/open-chat/controller.js?v=20260531-open-chat',
    '/js/app/messages/state.js?v=20260531-messages',
    '/js/app/messages/attachments.js?v=20260531-messages',
    '/js/app/messages/polls.js?v=20260531-messages',
    '/js/app/messages/call-cards.js?v=20260531-messages',
    '/js/app/messages/outbox.js?v=20260531-messages',
    '/js/app/messages/updates.js?v=20260531-messages',
    '/js/app/messages/render.js?v=20260531-messages',
    '/js/app/composer/state.js?v=20260531-composer',
    '/js/app/composer/text.js?v=20260531-composer',
    '/js/app/composer/reply-edit.js?v=20260531-composer',
    '/js/app/composer/files.js?v=20260531-composer',
    '/js/app/composer/send.js?v=20260531-composer',
    '/js/app/composer/emoji-picker.js?v=20260531-composer',
    '/js/app/composer/mentions.js?v=20260531-composer',
    '/js/app/composer/typing-dragdrop.js?v=20260531-composer',
    '/js/app/composer/poll-composer.js?v=20260531-composer',
    '/js/app/interactions/search.js?v=20260531-interactions',
    '/js/app/interactions/reactions.js?v=20260531-interactions',
    '/js/app/interactions/floating-actions.js?v=20260531-interactions',
    '/js/app/interactions/media-viewer.js?v=20260531-interactions',
    '/js/app/interactions/context-menus.js?v=20260531-interactions',
    '/js/app/interactions/forwarding.js?v=20260531-interactions',
    '/js/app/admin/bot-audit.js?v=20260531-ai-final',
    '/js/app/admin/backup.js?v=20260531-ai-final',
    '/js/app/admin/users.js?v=20260531-ai-final',
    '/js/app/ai-admin/shared.js?v=20260531-ai-final',
    '/js/app/ai-admin/openai.js?v=20260531-ai-final',
    '/js/app/ai-admin/openai-runtime.js?v=20260601-ai-admin-big-cut',
    '/js/app/ai-admin/yandex.js?v=20260531-ai-final',
    '/js/app/ai-admin/deepseek.js?v=20260531-ai-final',
    '/js/app/ai-admin/qwen.js?v=20260531-ai-final',
    '/js/app/ai-admin/local-providers-runtime.js?v=20260601-ai-admin-big-cut',
    '/js/app/ai-admin/grok.js?v=20260531-ai-final',
    '/js/app/ai-admin/grok-runtime.js?v=20260601-ai-admin-big-cut',
    '/js/app/ai-admin/context-convert.js?v=20260531-ai-final',
    '/js/app/ai-admin/chatshot.js?v=20260531-ai-final',
    '/js/app/ai-admin/context-chatshot-runtime.js?v=20260601-ai-admin-big-cut',
    '/js/app/ai-admin/grok-image-risk.js?v=20260531-ai-final',
    '/js/app/ai-admin/grok-image-risk-runtime.js?v=20260601-ai-admin-big-cut',
    '/js/app/ai-admin/modals.js?v=20260531-ai-final',
    '/js/app/ai-admin/events.js?v=20260601-shell-events',
    '/js/app/ai-admin/controller.js?v=20260601-ai-admin-big-cut',
    '/js/app/boot/state.js?v=20260531-runtime-split',
    '/js/app/boot/runtime-context.js?v=20260531-runtime-split',
    '/js/app/boot/api.js?v=20260531-runtime-split',
    '/js/app/boot/auth.js?v=20260531-runtime-split',
    '/js/app/boot/websocket.js?v=20260531-runtime-split',
    '/js/app/boot/events.js?v=20260531-runtime-split',
    '/js/app/boot/public-bridge.js?v=20260531-runtime-split',
    '/js/app/boot/chat-list-service.js?v=20260531-runtime-split',
    '/js/app/boot/open-chat-service.js?v=20260601-open-chat-service',
    '/js/app/boot/messages-service.js?v=20260601-messages-service',
    '/js/app/boot/legacy-runtime.js?v=20260531-runtime-split',
    '/js/app/boot/init.js?v=20260531-runtime-split',
    '/js/app/runtime.js?v=20260531-runtime-split',
    '/js/app.js?v=20260531-ai-final',
    '/js/ai-initiative.js?v=20260527-ai-initiative',
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
    'settingsMicrophoneMode',
    'settingsScreenRotationAllowed',
    'settingsScreenRotationStatus',
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

test('settings modal places microphone mode immediately after Send by Enter', () => {
  const dom = new JSDOM(indexHtml);
  const document = dom.window.document;
  const sendToggle = document.getElementById('settingsSendEnter')?.closest('.settings-item');
  const sendHint = sendToggle?.nextElementSibling;
  const microphoneRow = sendHint?.nextElementSibling;
  const microphoneHint = microphoneRow?.nextElementSibling;
  const toggle = document.getElementById('settingsMicrophoneMode');

  assert.ok(sendToggle, 'Expected Send by Enter setting row');
  assert.equal(sendHint?.classList.contains('settings-hint'), true);
  assert.equal(microphoneRow?.classList.contains('settings-toggle-item'), true);
  assert.equal(microphoneRow?.querySelector('input[type="checkbox"]'), toggle);
  assert.equal(toggle.checked, true);
  assert.equal(microphoneHint?.classList.contains('settings-hint'), true);
});

test('settings modal exposes personal screen rotation toggle after startup view', () => {
  const dom = new JSDOM(indexHtml);
  const document = dom.window.document;
  const startupToggle = document.getElementById('settingsOpenLastChat')?.closest('.settings-item');
  const startupHint = startupToggle?.nextElementSibling;
  const rotationRow = startupHint?.nextElementSibling;
  const rotationHint = rotationRow?.nextElementSibling;
  const rotationStatus = rotationHint?.nextElementSibling;
  const toggle = document.getElementById('settingsScreenRotationAllowed');

  assert.ok(startupToggle, 'Expected Open last chat setting row');
  assert.equal(startupHint?.classList.contains('settings-hint'), true);
  assert.equal(rotationRow?.classList.contains('settings-toggle-item'), true);
  assert.equal(rotationRow?.querySelector('input[type="checkbox"]'), toggle);
  assert.equal(toggle.checked, true);
  assert.equal(rotationHint?.classList.contains('settings-hint'), true);
  assert.match(rotationRow?.textContent || '', /Allow screen rotation/);
  assert.match(rotationHint?.textContent || '', /updated Android app/);
  assert.equal(rotationStatus?.id, 'settingsScreenRotationStatus');
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

test('style.css clamps New Chat folder selection rows to compact previews', () => {
  assert.match(styleCss, /\.folder-chat-selection-list\s+\.user-list-copy\s*\{[^}]*min-width\s*:\s*0[^}]*overflow\s*:\s*hidden/s);
  assert.match(styleCss, /\.folder-chat-selection-list\s+\.name\s*\{[^}]*overflow\s*:\s*hidden[^}]*text-overflow\s*:\s*ellipsis[^}]*white-space\s*:\s*nowrap/s);
  assert.match(styleCss, /\.folder-chat-selection-list\s+\.user-list-meta\s*\{[^}]*display\s*:\s*-webkit-box[^}]*-webkit-line-clamp\s*:\s*2[^}]*-webkit-box-orient\s*:\s*vertical[^}]*overflow\s*:\s*hidden/s);
  assert.match(styleCss, /\.folder-chat-selection-list\s+\.user-list-meta\s*\{[^}]*overflow-wrap\s*:\s*anywhere/s);
});

test('style.css opts mobile composer controls out of native browser panning', () => {
  assert.match(styleCss, /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*\.input-area #msgInput,\s*\.input-area \.mention-open-btn\s*\{[^}]*touch-action\s*:\s*none\s*;/s);
  assert.match(styleCss, /html\.is-mobile-chat-keyboard-layout \.emoji-picker,[\s\S]*\.mention-picker-list\s*\{[^}]*touch-action\s*:\s*none\s*;/s);
});

test('style.css does not include the old forced portrait web fallback', () => {
  assert.doesNotMatch(styleCss, /is-screen-rotation-web-locked/);
  assert.doesNotMatch(styleCss, /--screen-rotation-lock-width/);
  assert.doesNotMatch(styleCss, /rotate\(90deg\) translateY\(-100%\)/);
});
