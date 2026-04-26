# Bananza Test Module

Локальные команды:

- `npm test` — быстрый deterministic suite на `node:test`
- `npm run test:coverage` — тот же suite с текстовым и HTML-отчетом `coverage/`
- `npm run test:e2e` — Playwright E2E
- `npm run test:all` — быстрый suite и затем E2E

Подготовка Playwright:

- `npx playwright install chromium`

Точечный запуск:

- `node --test test/unit/voice-settings.test.js`
- `node --test test/integration/realtime.test.js`
- `node --test test/dom/message-cache.dom.test.js`
- `npx playwright test test/e2e/app.smoke.spec.js --project=desktop-chromium`
- `npx playwright test test/e2e/app.smoke.spec.js --project=mobile-chromium --headed`

Отладка:

- Все sandbox-инстансы поднимаются в `test/.runtime/`
- Чтобы не удалять песочницу после завершения, установите `BANANZA_KEEP_TEST_RUNTIME=1`
- HTML-отчет Playwright открывается из `playwright-report/index.html`
- HTML-coverage открывается из `coverage/index.html`

Что входит в модуль:

- `test/unit/` — pure и near-pure server/shared tests
- `test/integration/` — black-box HTTP и WebSocket тесты против изолированного sandbox-сервера
- `test/dom/` — `jsdom`-тесты для `index.html` и browser-side модулей
- `test/e2e/` — пользовательские сценарии на Playwright
- `test/support/` — sandbox launcher, preload-моки, API/DOM helper'ы
