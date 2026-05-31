# AGENTS.md for public/js/app/chat-list

## Purpose
- This folder contains the sidebar chat list, hidden chat search, presence display sync, and recovery shell for the main app runtime.
- Scripts load before `public/js/app.js` and expose factories through `window.BananzaApp.chatList`.

## Runtime Contract
- Modules publish under `window.BananzaApp.chatList`.
- Do not create a second independent message state or `openChat` state.
- Opening a chat must go through callbacks such as `actions.openChat(chatId)` or `actions.openHiddenChatFromSearch(chatId)`.
- Folder data and folder pin comparison come from `ctx.services.folders` or the injected `folders` service.
- Do not move message rendering, message pagination internals, composer, reactions, media viewer, AI admin, or existing settings/folders APIs here.

## Boundaries
- Preserve existing chat item DOM structure, classes, and data attributes.
- The store does not read DOM, call API, open chats, or mutate folders.
- The renderer does not fetch.
- The data controller may call chat-list APIs, update the store, and ask the renderer/actions to refresh.
- Message DOM refreshes from presence/user updates must go through callbacks.
- Use plain browser JavaScript. No ES modules, imports, exports, or bundler-only code.

