# AGENTS.md for public/js/app/messages

## Purpose
- This folder contains message rendering and message runtime services for the main app.
- Scripts load before `public/js/app.js` and expose factories through `window.BananzaApp.messages`.

## Runtime Contract
- Modules publish under `window.BananzaApp.messages`.
- Do not move composer UI/send/edit flow, search, reactions picker, media viewer, or AI admin here.
- Preserve message payload shape. Do not change server hydration or WebSocket payload shape.
- Preserve message DOM structure, classes, data attributes, and row side effects such as `row.__messageData`.
- Do not create a second independent current-chat state; read it through injected getters/callbacks.
- Use plain browser JavaScript. No ES modules, imports, exports, or bundler-only code.

## Boundaries
- Message attachments, polls, call cards, outbox rows, rendering, and delete/update UI may live here.
- Composer modal state and full send/edit/upload composer flow stay app-owned until their own iteration.
- Reactions, media viewer, search, and AI admin remain outside this folder.
