# AGENTS.md for public/js/app/ai-admin

## Purpose
- This folder contains AI admin and runtime UI controllers for the main app.
- Scripts load before `public/js/app.js` and publish through `window.BananzaApp.aiAdmin`.

## Runtime Contract
- Modules publish under `window.BananzaApp.aiAdmin`.
- Do not change server API contracts, endpoint methods, or route payload shapes.
- Do not change bot payload schemas for OpenAI, Yandex, DeepSeek, Qwen, Grok, context convert, or ChatShot.
- Do not add or rename visible UI strings or i18n keys without updating `public/js/i18n.js`.
- Composer, messages, and open-chat behavior must be reached through injected services and callbacks.
- Do not create duplicate app-wide chat, message, composer, or user state.
- Use plain browser JavaScript. No ES modules, imports, exports, or bundler-only code.

## Boundaries
- Provider state belongs to the provider controller that owns it.
- Shared helpers stay provider-neutral and receive API, DOM, and modal services through options.
- Generic admin backup/restore stays outside this folder unless it is directly tangled with AI admin behavior.
