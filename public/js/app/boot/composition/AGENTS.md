# AGENTS.md for public/js/app/boot/composition

## Purpose
- This folder contains runtime composition steps for the plain browser client.
- Files here wire existing controllers/services together and publish through `window.BananzaApp.boot.composition`.

## Rules
- Use plain browser JavaScript only: no ES modules, imports, exports, bundler assumptions, or build step.
- Do not add feature rendering, server API payload changes, provider-specific business logic, or new persisted state here.
- Keep `feature-composition.js` as the small orchestrator; add domain wiring here only when it belongs to startup composition.
- Preserve script order in `public/index.html` and the DOM harness whenever adding or renaming a composition file.
- Composition files may use `with (scope)` because this runtime still bridges extracted closure state; do not add `'use strict'` to files that use `with`.
