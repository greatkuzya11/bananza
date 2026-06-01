# AGENTS.md for public/js/app/boot

## Purpose
- This folder contains the startup/composition layer for the main client app runtime.
- Files here load after feature factories and before `public/js/app/runtime.js`.

## Runtime Contract
- Keep `runtime.js` as a tiny entrypoint that delegates to boot.
- Boot modules may compose services, context, bridge, lifecycle, and global startup only.
- Do not add feature rendering, modal bodies, provider-specific AI admin logic, message handling bodies, or chat list rendering here.
- `legacy-runtime.js` is compatibility debt from the old monolith. Do not grow it; migrate code out of it into owner feature modules.

## Verify
- Keep files plain browser JavaScript. No ES modules, imports, exports, or bundler-only patterns.
- Preserve explicit script order in `public/index.html` and `test/support/domHarness.js`.
