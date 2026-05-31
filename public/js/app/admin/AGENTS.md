# AGENTS.md for public/js/app/admin

## Purpose
- This folder contains generic admin UI/runtime controllers for the main app.
- Scripts load before `public/js/app/runtime.js` and `public/js/app.js`.

## Runtime Contract
- Modules publish under `window.BananzaApp.admin`.
- Do not change server API contracts, endpoint methods, route payload shapes, or backup archive semantics.
- Do not add or rename visible UI strings or i18n keys without updating `public/js/i18n.js`.
- App state must be reached through injected callbacks and services.
- Use plain browser JavaScript. No ES modules, imports, exports, or bundler-only code.

## Boundaries
- Generic admin backup/restore and human-user tooling live here.
- AI provider admin state belongs in `public/js/app/ai-admin`.
- Do not create duplicate app-wide chat, websocket, user, or auth state.
