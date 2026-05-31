# AGENTS.md for public/js/app/settings

## Purpose
- This folder contains only settings UI/runtime controllers for the main app.
- Modules publish factories through `window.BananzaApp.settings`.

## Runtime Contract
- Do not create a second independent app state.
- Read and write app-owned state through passed getters/setters.
- Keep persisted feature state inside the owning controller when the contract says so.
- Use plain browser JavaScript. No ES modules, imports, exports, or bundler-only code.

## Boundaries
- Do not move AI/admin/chat/message/folder logic into this folder.
- Settings modals may receive callbacks for AI/voice/calls buttons, but their feature logic stays outside.
- New visible UI text still belongs in `public/js/i18n.js`, not here.
