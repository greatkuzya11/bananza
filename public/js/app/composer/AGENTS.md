# AGENTS.md for public/js/app/composer

## Purpose
- This folder contains composer input, send, upload, reply/edit, emoji, mentions, typing, drag/drop, and poll-composer runtime for the main app.
- Scripts load before `public/js/app.js` and expose factories through `window.BananzaApp.composer`.

## Runtime Contract
- Modules publish under `window.BananzaApp.composer`.
- Do not create an independent chat, user, message, or outbox state. Read current chat/user through injected getters.
- Message rendering and optimistic outbox behavior must go through `services.messages`, especially `services.messages.outbox` and message update/render callbacks.
- Preserve message payload shape, pending-file DOM structure, reply/edit bar DOM behavior, and mobile composer behavior.
- Search panels, reactions picker/floating message actions, media viewer/gallery, and AI admin/provider forms do not belong here.
- Composer-side AI override/context-convert hooks may be injected as callbacks, but provider/admin state stays outside this folder.
- Use plain browser JavaScript. No ES modules, imports, exports, or bundler-only code.

## Verify
- Keep new files ASCII.
- Update `public/index.html` script order before `/js/app.js`.
- Update DOM harness script lists when adding or removing composer modules.
