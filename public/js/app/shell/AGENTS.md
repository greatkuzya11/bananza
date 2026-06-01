# AGENTS.md for public/js/app/shell

## Purpose
- This folder contains app shell runtime helpers: global event binding, mobile keyboard/composer guards, viewport glue, and other non-feature UI wiring.
- Scripts load before boot runtime assembly and publish factories through `window.BananzaApp.shell`.

## Runtime Contract
- Do not own chats, messages, folders, composer content, reactions, media viewer state, or AI provider state.
- Read app state through injected DOM refs, services, controllers, getters, and callbacks.
- Preserve existing DOM ids/classes/data attributes, keyboard/focus behavior, and public bridge/testing APIs.
- Keep feature-specific rendering and API payload logic in the owning feature folders.
- Use plain browser JavaScript. No ES modules, imports, exports, or bundler-only code.

## Verify
- Keep new files ASCII.
- Update `public/index.html`, DOM harness, and script-order tests when adding shell scripts.
