# AGENTS.md for public/js/app/interactions

## Purpose
- This folder contains the message/chat interaction runtime: search panel, reactions, floating message actions, media viewer/gallery, context menus, and forwarding/save-to-notes helpers.
- Scripts load before `public/js/app.js` and publish factories through `window.BananzaApp.interactions`.

## Runtime Contract
- Modules publish under `window.BananzaApp.interactions`.
- Do not create a second app, chat, or message state. Read current chat/user/message data through injected getters, services, and callbacks.
- Use `services.messages`, `services.openChat`, `services.composer`, `services.chatList`, `services.folders`, and injected callbacks instead of reimplementing message, composer, or open-chat internals.
- Preserve existing DOM ids/classes, API endpoints, payload shapes, WebSocket event behavior, and bridge/testing APIs.
- AI admin/provider settings and context convert/chatshot admin forms do not belong here.
- Use plain browser JavaScript. No ES modules, imports, exports, or bundler-only code.

## Verify
- Keep new files ASCII.
- Update `public/index.html` and DOM harness script order when adding/removing interaction modules.
