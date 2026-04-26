# AGENTS.md for `.github/workflows`

## Purpose
- This file documents the invariants for workflow files in this subtree.
- Read the root `AGENTS.md` first, then `.github/AGENTS.md`, then this file.

## What lives here
- The repository currently uses a single production deploy workflow triggered by pushes to `main`.
- The deploy flow is production-bundle based:
  - checkout on the GitHub runner;
  - build a production tarball without local-only test files and test tooling config;
  - upload that bundle to the server;
  - deploy into `/var/www/bananza` via `rsync --delete`;
  - preserve runtime state in `uploads`, `voice/models`, `bananza.db*`, `.secret`, `.vapid.json`;
  - run `npm install --omit=dev`;
  - restart `bananza` with `systemctl`.

## Where to look for bugs
- Workflow does not start: check `on.push.branches`.
- Bundle uploads but code does not update: check tarball build, SCP upload, and `rsync` target path.
- Production server is missing dependencies: check `npm install --omit=dev`.
- Runtime state disappears after deploy: check `rsync` exclude list for persistent paths.
- App code updates but service does not restart: check `systemctl restart bananza`.

## How to add features
- Keep workflows simple and aligned with the current self-hosted deployment model.
- Do not reintroduce `git pull`-based deploy steps unless there is a strong reason.
- If deploy assumptions change, update this file together with the workflow.

## Gotchas
- This repo does not use a large CI matrix, Docker pipeline, or build artifacts for the app itself.
- Production deploy must not ship local-only test files such as `test/`, `coverage/`, `playwright-report/`, `test-results/`, `playwright.config.js`, `.c8rc.json`, or `scripts/run-node-tests.js`.
- Preserve server runtime data during deploy; do not overwrite or delete uploads, SQLite data, secrets, or `voice/models`.

## Verify
- After editing workflow files, verify:
  - trigger is still `main`;
  - production bundle excludes test-only files;
  - upload step sends the bundle to the server;
  - `rsync --delete` keeps persistent runtime paths intact;
  - deploy still runs `npm install --omit=dev`;
  - deploy still restarts `bananza` through `systemctl`.
