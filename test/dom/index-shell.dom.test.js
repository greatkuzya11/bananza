const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const { repoRoot } = require('../support/paths');

const indexHtml = fs.readFileSync(path.join(repoRoot, 'public', 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(repoRoot, 'public', 'css', 'style.css'), 'utf8');
const documentEditorBundleJs = fs.readFileSync(path.join(repoRoot, 'public', 'js', 'document-editor.bundle.js'), 'utf8');
const shellEventsJs = fs.readFileSync(path.join(repoRoot, 'public', 'js', 'app', 'shell', 'events.js'), 'utf8');
const shellUiRuntimeJs = fs.readFileSync(path.join(repoRoot, 'public', 'js', 'app', 'shell', 'ui-runtime.js'), 'utf8');
const shellRuntimeJs = fs.readFileSync(path.join(repoRoot, 'public', 'js', 'app', 'shell', 'shell-runtime.js'), 'utf8');
const callFeatureJs = fs.readFileSync(path.join(repoRoot, 'public', 'js', 'calls', 'CallFeature.js'), 'utf8');

test('public/index.html keeps expected stylesheet and script order', () => {
  const dom = new JSDOM(indexHtml);
  const document = dom.window.document;

  const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map((node) => node.getAttribute('href'));
  const scripts = [...document.querySelectorAll('script[src]')].map((node) => node.getAttribute('src'));

  assert.deepEqual(styles, [
    '/css/style.css?v=20260614-doc-mobile-topbar1',
    '/css/calls.css?v=20260509-call-modal-surface',
    '/css/voice.css',
    '/css/video-notes.css',
  ]);

  assert.deepEqual(scripts, [
    '/js/sounds.js',
    '/js/messageCache.js',
    '/js/ai-image-risk.js',
    '/js/i18n.js?v=20260614-doc-settings1',
    '/js/document-editor.bundle.js?v=20260614-doc-cursors-fresh3',
    '/js/qip-infium-original.js?v=20260523-qip-infium-original',
    '/js/qip-hd.js?v=20260523-qip-hd',
    '/js/app/namespace.js?v=20260530-app-shell',
    '/js/app/context.js?v=20260530-app-shell',
    '/js/app/bridge.js?v=20260530-app-shell',
    '/js/app/performance.js?v=20260602-performance-baseline',
    '/js/app/feature-loader.js?v=20260602-feature-loader',
    '/js/app/feature-registry.js?v=20260609-chat-settings-events',
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
    '/js/app/shell/events.js?v=20260614-doc-settings1',
    '/js/app/shell/ui-runtime.js?v=20260614-doc-settings1',
    '/js/app/shell/shell-runtime.js?v=20260614-doc-settings1',
    '/js/app/shell/mobile-runtime-adapters.js?v=20260601-runtime-final',
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
    '/js/app/documents.js?v=20260614-doc-token-stable1',
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
    '/js/app/boot/state.js?v=20260531-runtime-split',
    '/js/app/boot/runtime-context.js?v=20260531-runtime-split',
    '/js/app/boot/api.js?v=20260531-runtime-split',
    '/js/app/boot/auth.js?v=20260531-runtime-split',
    '/js/app/boot/websocket.js?v=20260531-runtime-split',
    '/js/app/boot/ws-dispatch.js?v=20260601-runtime-big-cut',
    '/js/app/boot/runtime-core.js?v=20260601-runtime-final',
    '/js/app/boot/composition/export-utils.js?v=20260601-feature-composition-final',
    '/js/app/boot/composition/feature-primitives.js?v=20260601-feature-composition-final',
    '/js/app/boot/composition/dom-shell.js?v=20260601-feature-composition-final',
    '/js/app/boot/composition/runtime-proxy-scope.js?v=20260601-feature-composition-final',
    '/js/app/boot/composition/ai-admin-composition.js?v=20260601-feature-composition-final',
    '/js/app/boot/composition/ui-shell-adapters.js?v=20260601-feature-composition-final',
    '/js/app/boot/composition/admin-settings-composition.js?v=20260601-feature-composition-final',
    '/js/app/boot/composition/folders-composition.js?v=20260601-feature-composition-final',
    '/js/app/boot/composition/chat-list-composition.js?v=20260601-feature-composition-final',
    '/js/app/boot/composition/open-chat-composition.js?v=20260601-feature-composition-final',
    '/js/app/boot/composition/messages-composition.js?v=20260601-feature-composition-final',
    '/js/app/boot/composition/composer-composition.js?v=20260601-feature-composition-final',
    '/js/app/boot/composition/shell-runtime-composition.js?v=20260601-feature-composition-final',
    '/js/app/boot/composition/interactions-composition.js?v=20260601-feature-composition-final',
    '/js/app/boot/feature-composition.js?v=20260601-runtime-final',
    '/js/app/boot/events.js?v=20260531-runtime-split',
    '/js/app/boot/public-bridge.js?v=20260601-runtime-final',
    '/js/app/boot/chat-list-service.js?v=20260531-runtime-split',
    '/js/app/boot/open-chat-service.js?v=20260601-open-chat-service',
    '/js/app/boot/messages-service.js?v=20260601-messages-service',
    '/js/app/boot/runtime-assembly.js?v=20260601-runtime-assembly',
    '/js/app/boot/init.js?v=20260601-runtime-final',
    '/js/app/runtime.js?v=20260531-runtime-split',
    '/js/app.js?v=20260531-ai-final',
    '/js/ai-initiative.js?v=20260527-ai-initiative',
    '/js/calls/CallStore.js?v=20260509-call-modal-surface',
    '/js/calls/CallMedia.js?v=20260509-call-modal-surface',
    '/js/calls/CallNotifications.js?v=20260509-call-modal-surface',
    '/js/calls/CallFeature.js?v=20260614-doc-settings1',
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
    'documentWorkspace',
    'documentTitleInput',
    'documentToolbar',
    'documentEditor',
    'documentConnectionStatus',
    'copyDocumentInviteLinkBtn',
    'sendBtn',
    'msgInput',
    'composerRichPreview',
    'settingsModal',
    'settingsMicrophoneMode',
    'settingsScreenRotationAllowed',
    'settingsScreenRotationStatus',
    'pollComposerModal',
    'chatInfoModal',
    'chatCompactViewSection',
    'chatPreferencesSection',
    'chatPinSettingsSection',
    'chatInviteLinkSection',
    'chatContextTransformSection',
    'chatShotSection',
    'chatRemindersSection',
    'chatDangerSection',
    'chatEditSection',
    'chatNameFieldLabel',
    'chatBackgroundSection',
    'chatFolderPicker',
    'chatFolderManageModal',
    'folderTab',
    'documentTab',
    'documentName',
    'userListDocument',
    'createDocumentBtn',
    'createFolderBtn',
  ];

  requiredIds.forEach((id) => {
    assert.ok(document.getElementById(id), `Expected #${id} to exist in index.html`);
  });

  assert.equal(document.getElementById('chatBotInfoSection'), null);
  assert.equal(document.getElementById('activeChatFolderVisibilityToggle'), null);
  assert.equal(document.getElementById('refreshChatsBtn'), null);
  assert.equal(document.querySelector('#documentTab .new-document-members-note')?.getAttribute('data-i18n'), 'Members can be added later');
  assert.equal(document.querySelector('#documentTab .new-document-create-panel #createDocumentBtn')?.id, 'createDocumentBtn');
});

test('document chat settings mode hides chat-only controls and uses document endpoints', () => {
  assert.match(shellUiRuntimeJs, /function\s+isDocumentChat\s*\(/);
  assert.match(shellUiRuntimeJs, /Document management/);
  assert.match(shellUiRuntimeJs, /Clear document/);
  assert.match(shellUiRuntimeJs, /api\/documents\/\$\{chatId\}\/content/);
  assert.match(shellUiRuntimeJs, /'#chatPreferencesSection'[\s\S]*'#chatBackgroundSection'/);
  assert.match(shellUiRuntimeJs, /forEach\(\(selector\) => \$\(selector\)\?\.classList\.toggle\('hidden', isDocument\)\)/);
  assert.match(shellRuntimeJs, /chatCompactViewSection/);
  assert.match(shellRuntimeJs, /chatBackgroundSection/);
  assert.match(shellRuntimeJs, /api\/documents\/\$\{currentChatId\}\/title/);
  assert.match(shellRuntimeJs, /Document name/);
  assert.match(shellEventsJs, /Number\(chat\.is_document\s*\|\|\s*0\)\s*!==\s*1/);
  assert.match(callFeatureJs, /Number\(chat\.is_document\s*\|\|\s*0\)\s*===\s*1\)\s*return\s+false/);
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
  assert.equal(document.getElementById('fileInput').hasAttribute('multiple'), true);
  assert.equal(document.getElementById('fileInputDocs').getAttribute('accept'), null);
  assert.equal(document.getElementById('fileInputDocs').hasAttribute('multiple'), true);
  assert.equal(document.getElementById('fileInputGallery').getAttribute('accept'), 'image/*,video/*');
  assert.equal(document.getElementById('fileInputGallery').hasAttribute('multiple'), true);
  assert.equal(document.getElementById('fileInputCamera').getAttribute('accept'), 'image/*');
  assert.equal(document.getElementById('fileInputCamera').getAttribute('capture'), 'environment');
  assert.equal(document.getElementById('fileInputCamera').hasAttribute('multiple'), false);
  assert.equal(document.getElementById('chatAvatarInput').getAttribute('accept'), 'image/*');
  assert.equal(document.getElementById('chatBackgroundInput').getAttribute('accept'), 'image/*');
});

test('chat background layer sits behind the chat view without replacing messages', () => {
  const dom = new JSDOM(indexHtml);
  const document = dom.window.document;
  const chatView = document.getElementById('chatView');
  const layer = document.getElementById('chatBackgroundLayer');
  const header = chatView.querySelector('.chat-header');
  const documentWorkspace = document.getElementById('documentWorkspace');
  const messages = document.getElementById('messages');

  assert.ok(layer);
  assert.equal(layer.parentElement, chatView);
  assert.equal(layer.getAttribute('aria-hidden'), 'true');
  assert.equal(layer.nextElementSibling, header);
  assert.equal(documentWorkspace.previousElementSibling.id, 'pinnedBar');
  assert.equal(messages.parentElement, chatView);
  assert.equal(messages.previousElementSibling.id, 'documentWorkspace');
  assert.match(styleCss, /\.chat-background-layer\b/);
  assert.match(styleCss, /\.chat-view\.has-chat-background \.messages\b/);
});

test('profile settings modal exposes accessible profile controls', () => {
  const dom = new JSDOM(indexHtml);
  const document = dom.window.document;
  const menuDrawer = document.getElementById('menuDrawer');

  assert.ok(menuDrawer.querySelector('.profile-settings-modal'));
  assert.ok(menuDrawer.querySelector('.profile-hero'));
  assert.ok(document.getElementById('profileForm'));
  assert.ok(document.getElementById('profileDisplayPreview'));
  assert.equal(document.getElementById('profileAvatarInput').getAttribute('accept'), 'image/*');
  assert.equal(document.getElementById('profileAvatarCameraInput').getAttribute('accept'), 'image/*');
  assert.equal(document.getElementById('profileAvatarCameraInput').getAttribute('capture'), 'user');
  assert.equal(document.getElementById('profileAvatarPickIcon').getAttribute('aria-label'), 'Take profile photo');
  assert.equal(document.getElementById('profileAvatarPickIcon').getAttribute('title'), 'Take profile photo');
  assert.equal(document.getElementById('profileAvatarPickBtn').getAttribute('type'), 'button');
  assert.equal(document.getElementById('removeProfileAvatar').getAttribute('type'), 'button');
  assert.equal(document.getElementById('saveProfileBtn').getAttribute('type'), 'submit');
  assert.equal(document.getElementById('profileStatus').getAttribute('role'), 'status');
  assert.equal(document.getElementById('profileStatus').getAttribute('aria-live'), 'polite');
  assert.equal(document.getElementById('colorPicker').getAttribute('role'), 'radiogroup');
  assert.equal(document.getElementById('colorPicker').getAttribute('aria-labelledby'), 'profileColorLegend');
  assert.ok(document.getElementById('profileCameraModal'));
  assert.equal(document.getElementById('profileCameraStatus').getAttribute('role'), 'status');
  assert.equal(document.getElementById('profileCameraStatus').getAttribute('aria-live'), 'polite');
  assert.equal(document.getElementById('profileCameraCaptureBtn').textContent.trim(), 'Take photo');
});

test('style.css keeps a dedicated unread badge contrast override for active chats', () => {
  const activeBadgeRuleMatch = styleCss.match(/\.unread-badge--active-chat\s*\{([^}]*)\}/s);
  assert.ok(activeBadgeRuleMatch, 'Expected .unread-badge--active-chat rule in style.css');
  const ruleBody = activeBadgeRuleMatch[1];
  assert.match(ruleBody, /background\s*:/);
  assert.match(ruleBody, /color\s*:\s*#fff\s*;/);
});

test('style.css keeps New Chat modal scrollable tabs aligned', () => {
  assert.match(styleCss, /#newChatModal\s+\.modal-content\s*\{[^}]*height\s*:\s*min\(620px,\s*80vh\)/s);
  assert.match(styleCss, /#newChatModal\s+\.modal-body\s*\{[^}]*display\s*:\s*flex[^}]*overflow\s*:\s*hidden/s);
  assert.match(styleCss, /#newChatModal\s+\.tab-pane\.active\s*\{[^}]*display\s*:\s*flex[^}]*flex\s*:\s*1/s);
  assert.match(styleCss, /#newChatModal\s+#newFolderChatList\s*\{[^}]*overflow-y\s*:\s*auto/s);
  assert.match(styleCss, /#newChatModal\s+#userListGroup,\s*#newChatModal\s+#userListDocument,\s*#newChatModal\s+#newFolderChatList\s*\{[^}]*overflow-y\s*:\s*auto/s);
  assert.match(styleCss, /#newChatModal\s+\.new-document-create-panel\s*\{[^}]*flex\s*:\s*0 0 auto/s);
  assert.match(styleCss, /#newChatModal\s+\.folder-chat-selection-list\s*\{[^}]*max-height\s*:\s*none\s*;/s);
});

test('style.css keeps document editor full width and theme-colored', () => {
  assert.match(styleCss, /\.document-workspace\s*\{[^}]*background-color\s*:\s*var\(--bg-dark\)[^}]*background-image\s*:\s*var\(--bg-app-gradient\)/s);
  assert.match(styleCss, /\.document-workspace\s*\{[^}]*gap\s*:\s*4px[^}]*padding\s*:\s*6px clamp\(8px,\s*\.9vw,\s*16px\) 12px/s);
  assert.match(styleCss, /\.document-topbar\s*\{[^}]*min-height\s*:\s*32px/s);
  assert.match(styleCss, /\.document-title-input\s*\{[^}]*padding\s*:\s*2px 2px 5px/s);
  assert.match(styleCss, /\.document-invite-status:empty\s*\{[^}]*display\s*:\s*none/s);
  assert.match(styleCss, /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.document-workspace\s*\{[^}]*gap\s*:\s*4px[^}]*padding\s*:\s*5px 8px 9px/s);
  assert.match(styleCss, /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.document-topbar\s*\{[^}]*flex-direction\s*:\s*row[^}]*gap\s*:\s*8px[^}]*min-height\s*:\s*32px/s);
  assert.match(styleCss, /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.document-topbar-actions\s*\{[^}]*width\s*:\s*auto/s);
  assert.match(styleCss, /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.document-action-btn\s*\{[^}]*flex\s*:\s*0 1 auto[^}]*max-width\s*:\s*44vw[^}]*text-overflow\s*:\s*ellipsis/s);
  assert.match(styleCss, /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.document-toolbar\s*\{[^}]*min-height\s*:\s*42px[^}]*padding\s*:\s*5px/s);
  assert.match(styleCss, /\.document-toolbar\s*\{[^}]*background-color\s*:\s*var\(--bg-sidebar\)[^}]*background-image\s*:\s*var\(--bg-panel-gradient\)/s);
  assert.match(styleCss, /\.document-editor-shell\s*\{[^}]*background\s*:\s*var\(--rich-other-msg-bg,\s*var\(--bg-other-msg\)\)/s);
  assert.match(styleCss, /\.document-editor\s+\.ProseMirror\s*\{[^}]*width\s*:\s*100%[^}]*max-width\s*:\s*none[^}]*margin\s*:\s*0/s);
  assert.doesNotMatch(styleCss, /\.document-editor\s+\.ProseMirror\s*\{[^}]*max-width\s*:\s*920px/s);
});

test('document collab cursor label stays out of table layout flow', () => {
  assert.match(styleCss, /\.document-editor\s+\.ProseMirror\s+\.document-collab-cursor-name,[\s\S]*\.ProseMirror-yjs-cursor\s*>\s*div\s*\{[^}]*position\s*:\s*absolute[^}]*width\s*:\s*max-content/s);
  assert.match(styleCss, /\.document-editor\s+\.ProseMirror\s+\.ProseMirror-yjs-cursor\s*>\s*div\s*\{[^}]*width\s*:\s*max-content\s*!important/s);
  assert.match(documentEditorBundleJs, /className\s*=\s*"document-collab-cursor"/);
  assert.match(documentEditorBundleJs, /cursorBuilder:\s*createCollabCursor/);
});

test('document editor bundle exposes v2 rich editing and keeps image insertion disabled', () => {
  assert.match(documentEditorBundleJs, /mergeCells/);
  assert.match(documentEditorBundleJs, /toggleHeaderRow/);
  assert.match(documentEditorBundleJs, /createAwarenessStateFilter/);
  assert.match(documentEditorBundleJs, /participantDisplayKey/);
  assert.match(documentEditorBundleJs, /sameParticipant/);
  assert.match(documentEditorBundleJs, /documentUserId/);
  assert.match(documentEditorBundleJs, /awarenessStateFilter/);
  assert.match(documentEditorBundleJs, /primaryLastUpdated/);
  assert.match(documentEditorBundleJs, /primaryHasId/);
  assert.match(documentEditorBundleJs, /lastUpdated > primaryLastUpdated/);
  assert.match(documentEditorBundleJs, /createTableActionsMenu/);
  assert.match(documentEditorBundleJs, /document-table-actions-panel/);
  assert.match(documentEditorBundleJs, /document-toolbar-table-menu/);
  assert.match(documentEditorBundleJs, /document-toolbar-dropdown-panel/);
  assert.match(documentEditorBundleJs, /document-toolbar-dropdown-option/);
  assert.match(documentEditorBundleJs, /toggleListCommand/);
  assert.match(documentEditorBundleJs, /listItemTypeForList/);
  assert.match(documentEditorBundleJs, /convertListNode/);
  assert.match(documentEditorBundleJs, /task_list/);
  assert.match(documentEditorBundleJs, /task_item/);
  assert.match(documentEditorBundleJs, /liftListItem/);
  assert.match(documentEditorBundleJs, /sinkListItem/);
  assert.match(documentEditorBundleJs, /listActive/);
  assert.doesNotMatch(documentEditorBundleJs, /insertChecklistCommand/);
  assert.match(documentEditorBundleJs, /setupToolbarScrollBehavior/);
  assert.match(documentEditorBundleJs, /document-toolbar-scrollbar/);
  assert.match(documentEditorBundleJs, /getBoundingClientRect/);
  assert.match(documentEditorBundleJs, /thumb\.style\.left/);
  assert.match(documentEditorBundleJs, /thumb\.style\.top/);
  assert.match(documentEditorBundleJs, /toolbarEl\.addEventListener\("pointerdown"/);
  assert.match(documentEditorBundleJs, /window\.addEventListener\("pointermove"/);
  assert.match(documentEditorBundleJs, /event\.pointerType !== "mouse"/);
  assert.match(documentEditorBundleJs, /DRAG_SCROLL_MULTIPLIER/);
  assert.match(documentEditorBundleJs, /INERTIA_FRICTION/);
  assert.match(documentEditorBundleJs, /requestAnimationFrame/);
  assert.match(documentEditorBundleJs, /cancelAnimationFrame/);
  assert.doesNotMatch(documentEditorBundleJs, /thumb\.addEventListener\("pointerdown"/);
  assert.match(documentEditorBundleJs, /\\u\{1F517\}/);
  assert.match(documentEditorBundleJs, /\\u\{1F9F9\}/);
  assert.match(documentEditorBundleJs, /\\u25A6/);
  assert.doesNotMatch(documentEditorBundleJs, /"Link"/);
  assert.doesNotMatch(documentEditorBundleJs, /"Unlink"/);
  assert.doesNotMatch(documentEditorBundleJs, /"Row"/);
  assert.doesNotMatch(documentEditorBundleJs, /"Col"/);
  assert.doesNotMatch(documentEditorBundleJs, /"All"/);
  assert.match(styleCss, /\.document-toolbar-btn\.active\s*\{/);
  assert.match(styleCss, /\.document-toolbar-dropdown-panel\s*\{[^}]*position\s*:\s*fixed[^}]*padding\s*:\s*3px/s);
  assert.match(styleCss, /\.document-toolbar-dropdown-option\s*\{[^}]*min-height\s*:\s*22px[^}]*font-size\s*:\s*12px[^}]*padding\s*:\s*0 7px/s);
  assert.match(styleCss, /\.document-table-actions-panel\s*\{[^}]*position\s*:\s*fixed[^}]*grid-template-columns\s*:\s*repeat\(4,\s*34px\)/s);
  assert.match(styleCss, /\.document-table-actions\.open\s+\.document-table-actions-panel\s*\{[^}]*display\s*:\s*grid/s);
  assert.match(styleCss, /\.document-toolbar\s*\{[^}]*scrollbar-width\s*:\s*none/s);
  assert.match(styleCss, /\.document-toolbar::-webkit-scrollbar\s*\{[^}]*display\s*:\s*none/s);
  assert.match(styleCss, /\.document-toolbar-scrollbar\s*\{[^}]*position\s*:\s*fixed[^}]*opacity\s*:\s*0[^}]*pointer-events\s*:\s*none/s);
  assert.match(styleCss, /\.document-toolbar\.is-overflowing:hover\s+\.document-toolbar-scrollbar,[\s\S]*\.document-toolbar:focus-within\s+\.document-toolbar-scrollbar\s*\{[^}]*opacity\s*:\s*\.55/s);
  assert.match(styleCss, /\.document-toolbar\.is-scroll-active\s+\.document-toolbar-scrollbar\s*\{[^}]*opacity\s*:\s*\.95/s);
  assert.match(styleCss, /@media\s*\(hover:\s*none\),\s*\(pointer:\s*coarse\)\s*\{[\s\S]*\.document-toolbar\s*\{[^}]*touch-action\s*:\s*pan-x[^}]*scrollbar-width\s*:\s*thin/s);
  assert.match(styleCss, /@media\s*\(hover:\s*none\),\s*\(pointer:\s*coarse\)\s*\{[\s\S]*\.document-toolbar-scrollbar\s*\{[^}]*display\s*:\s*none/s);
  assert.doesNotMatch(documentEditorBundleJs, /uploadAndInsertImage/);
  assert.doesNotMatch(documentEditorBundleJs, /document-image-node/);
  assert.doesNotMatch(documentEditorBundleJs, /Insert image/);
  assert.doesNotMatch(styleCss, /\.document-image-mini-toolbar\s*\{/);
  assert.doesNotMatch(styleCss, /\.document-image-resize-handle\s*\{/);
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
