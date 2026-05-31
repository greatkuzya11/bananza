# AGENTS.md for public/js/app/folders

## Purpose
- This folder contains only the chat folders runtime for the main app.
- Scripts load before `public/js/app.js` and expose factories through `window.BananzaApp.folders`.

## Runtime Contract
- Do not create a second chat list state.
- Folder store owns only folder data, loaded/failed flags, and the active folder id.
- Chat list rendering stays app-owned and is invoked only through callbacks/actions.
- Folder UI receives chats through getters or method arguments; it must not own chats.
- Do not move messages, openChat, composer, search, reactions, media viewer, AI admin, or the general chat list into this folder.
- Use plain browser JavaScript. No ES modules, imports, exports, or bundler-only code.

## Boundaries
- Preserve existing HTML ids, classes, and data attributes.
- New visible UI text still belongs in `public/js/i18n.js`, not here.
- Folder modules may call app callbacks such as `renderChatList`, `transitionToChatFolder`, `openFolderManageModal`, and API/action callbacks, but they must not directly open chats.
