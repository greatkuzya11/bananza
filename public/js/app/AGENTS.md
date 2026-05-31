# AGENTS.md for public/js/app

## Purpose
- This folder contains internal modules for the main client app runtime.
- Scripts in this folder load before `public/js/app.js`.

## Runtime Contract
- Modules register through `window.BananzaApp.register(name, installer)`.
- `public/js/app.js` owns the external API and publishes it through `window.BananzaAppBridge`.
- Feature modules must use the shared app context and must not create a second independent app state.
- Do not use ES modules, imports, exports, or bundler-only patterns here.

## Verify
- Keep files plain browser JavaScript loaded by script order.
- New visible UI text still belongs in `public/js/i18n.js`, not in this folder.
