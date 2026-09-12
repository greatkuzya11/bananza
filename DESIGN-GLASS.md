# Banan Glass

## Design and compatibility

Glass is an opt-in visual mode (`glass`), independent of the color palette. Existing `classic` and `rich` preferences remain valid. Four light palettes (Pearl, Mint, Lavender, Banan Cream) and all seven existing dark palettes share the same catalog in `public/js/appearance.js`.

References: [Apple Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) for rounded navigation surfaces, [Fluent materials](https://fluent2.microsoft.design/material) for layered matte fills, and [NN/g glassmorphism guidance](https://www.nngroup.com/articles/glassmorphism/) for restrained transparency and readable content. This implementation uses CSS materials and local [Lucide icons](https://lucide.dev/guide/).

CSS keeps the existing layout and DOM hooks. Glass uses a single set of surface, outline, radius and contrast tokens; message rows do not have their own backdrop filters. Mobile composer geometry uses the existing tool-stack size variables. Mobile call controls wrap into four columns to retain 44px targets.

Modal and sign-in tabs use a filled selected surface with a complete accent outline in glass mode. The classic bottom-only indicator remains in the older modes. Modal tabs retain their original single horizontal row on narrow screens; browser checks cover all four chat-creation tabs, both sign-in tabs, and switching back to classic.

Glass surfaces use visible scene transmission: light dialogs have a 62% white tint, dark dialogs a 72% theme tint, and navigation a 40–46% tint. Form inputs keep a denser 82% fill while settings rows use 30–38%. The modal uses only its existing pseudo-element scrim at 18%, with no second dark overlay. A single application backdrop continues beneath the sidebar and conversation; custom conversation images are preserved. Browser checks cover computed transmission, blur and the absence of duplicate dimming on both viewports.

Lucide icons are local assets from release 0.468.0. The original license, including the Feather-derived icon terms, is in `public/vendor/lucide/LICENSE`. UI icon decoration preserves the legacy symbols for older modes and excludes message content, document content and user emoji.

Glass control icons use neutral dark or light ink, including dynamically mounted video-note settings, backup, AI providers, folder controls, message actions and the service banana. Leading icon replacement retains translated labels and reacts to later DOM updates. User emoji and reactions retain their original rendering. Settings icons share a 20px box and the existing row gap; no layout geometry changes are needed for the icon replacement.

Each settings navigation item has a distinct icon. DeepSeek uses the original BananZa outline whale in `public/icons/whale.svg`, aligned to the same 24px grid and 2px stroke as Lucide. Yandex uses a bird, Qwen a brain, OpenAI a robot, video notes a clapperboard, and password settings a lock. The browser check also detects duplicate settings icons.

The chat header retains the rotating gear on the actions toggle; chat settings uses an ellipsis, video call a camera and voice call a handset. A browser round trip through glass, classic and rich verifies that monochrome replacements appear only in glass and that the older designs retain their original symbols.

Incoming and outgoing message bubbles use a 62% tinted fill plus a light sheen, allowing the conversation background to remain visible. Custom wallpapers use a 78% tint and adjusted dark-theme foregrounds for readability. Compact voice messages share these materials; emoji-only messages and video frames retain their transparent presentation. No blur is added per message. Accessibility and unsupported-backdrop fallbacks restore solid fills. Browser coverage measures actual bubble alpha on both viewports and text/timestamp contrast over black and white wallpaper pixels, including the brightest sheen, across all 11 palettes.

## Preference and dialog contracts

- PATCH `/api/user/theme`: `{theme}` from the shared catalog.
- PATCH `/api/user/visual-mode`: `{mode}` from the shared catalog.
- Existing SQLite user columns own persisted preferences. Startup normalization accepts all catalog modes.
- `bananzaAppearance` localStorage holds only `{theme, mode}` for signed-out/standalone pages. It is device-local and excluded from server backup; the backup manifest documents this. No new runtime folders or secrets.
- Appearance saves are serialized, revision checked, and merge only the field the request owns. Failure restores the last confirmed value for that field.
- `BananzaDialogs.alert(message)`, `.confirm(message)` and `.prompt(message, initial)` return promises. Confirm cancellation resolves false; prompt cancellation resolves null. No synchronous browser global is overridden.
- Dialogs reuse the app modal manager when available; standalone pages own one browser-history entry per active dialog. Dialog text is inserted as text, and focus is trapped/restored.
- Document link commands remain synchronous ProseMirror commands; after an async prompt, they only apply if the document is unchanged, using the captured selection.

## Surface inventory and verification

The Playwright appearance suite captures every mounted modal in both Pearl and BananZa glass, on desktop and a 360px mobile viewport. It checks all 33 palette/mode combinations, persistence, sending and cancellation. Existing browser scenarios can be run in glass using `BANANZA_E2E_VISUAL_MODE=glass`; without it they retain the default appearance.

The static modal inventory below is complemented by the dynamically mounted surfaces in the following table. Screenshots are test artifacts under `test-results/`, not application assets.

| Surface group | Coverage |
| --- | --- |
| Sidebar, folders, unread/pinned chats, search, header, composer | Shared surfaces, SVG controls; chat, navigation and keyboard scenarios |
| Messages, replies, forwards, reactions, polls, code, attachments | Readable message fills and component tokens; message action and attachment scenarios |
| Menu drawer/profile, settings, themes, language, sound, notifications | Shared modal/form/button tokens; screenshot inventory |
| AI and administrator screens, backup, weather, maps | Shared modal and feature panels; screenshot inventory and backup integration tests |
| Voice and video notes | Feature-owned surfaces and controls; recorder geometry retained; mocked media scenario |
| Calls, prejoin, incoming, transcript, participants, artifacts | Feature-owned panels and local icon masks; 44px mobile control layout test |
| Documents and guest documents | Editor/toolbar/dropdown tokens; guest preference tests; async link prompt |
| Context menus, emoji/reactions, mentions, toasts, media viewer | Elevated surfaces; user emoji and media are preserved; interaction scenarios |
| Login/register and external call page | Early preference application and standalone dialog support |

### Static modals

- `newChatModal`
- `chatFolderManageModal`
- `adminModal`
- `adminBotAuditModal`
- `backupExportModal`
- `settingsModal`
- `apiTokensModal`
- `languageSettingsModal`
- `themeSettingsModal`
- `pollStyleSettingsModal`
- `animationSettingsModal`
- `mobileFontSettingsModal`
- `weatherSettingsModal`
- `mapSettingsModal`
- `notificationSettingsModal`
- `soundSettingsModal`
- `aiBotSettingsModal`
- `aiInitiativeModal`
- `aiInitiativeNewsSourcesModal`
- `openAiTextBotsModal`
- `openAiUniversalBotsModal`
- `openAiImageBotsModal`
- `contextConvertBotsModal`
- `chatShotBotsModal`
- `deepseekAiSettingsModal`
- `deepseekAiTextBotsModal`
- `qwenAiSettingsModal`
- `qwenAiTextBotsModal`
- `yandexAiSettingsModal`
- `grokAiSettingsModal`
- `grokAiTextBotsModal`
- `grokAiImageBotsModal`
- `grokAiUniversalBotsModal`
- `changePasswordModal`
- `forwardMessageModal`
- `grokImageRiskConfirmModal`
- `pollComposerModal`
- `pollVotersModal`
- `chatInfoModal`
- `menuDrawer`
- `profileCameraModal`
- `locationPickerModal`
- `locationViewerModal`

### Dynamically mounted UI

- Voice, video-note and call administration.
- Call prejoin, incoming-call card, call surface, participants, artifacts and transcript.
- Telegram bot management and history.
- Generic alert, confirmation and prompt (`appDialog`).
- Media viewer, document dropdowns, mention picker, floating message actions and context menus.

## Checks

- `npm test`: DOM, API, migration, backup/restore and existing application checks.
- `npm run test:e2e`: default mode browser regressions.
- `BANANZA_E2E_VISUAL_MODE=glass npm run test:e2e`: the same browser flows with glass preferences (set the environment variable using the native syntax of your shell).
- `npx playwright test test/e2e/appearance.pw.js`: palette matrix, screenshots, standalone dialogs and contrast checks.

Verification on 2026-09-12: the full Node suite passed 625 tests; subsequent focused settings, guest-page, dialog and icon tests passed. The glass browser run passed the chat, media, settings, navigation, palette-matrix and mobile-keyboard scenarios. The guest-document scenario was corrected to wait for connection and restored editing focus; guest-document and accessibility scenarios then passed twice on each viewport (8/8). Classic chat, settings, feature loading and message actions were also checked. The 49 mounted modal templates were reviewed in light and dark glass on both viewports. The browser contrast check covers primary message text, timestamps, secondary modal text and accent-button labels across all 11 palettes; reduced transparency, high contrast, keyboard focus and large dialog text have browser checks.

Reduced motion removes glass transitions; reduced transparency and unavailable backdrop filters use solid fills. High contrast uses stronger outlines; forced colors uses system colors. Hardware camera/microphone behavior and actual GPU performance still need device testing beyond the mocked browser media suite.
