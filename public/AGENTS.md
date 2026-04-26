# AGENTS.md for public

## Purpose
- Этот файл описывает статическую клиентскую оболочку приложения.
- Сначала читай root `AGENTS.md`, затем этот файл.

## What lives here
- `index.html` — основной chat UI shell.
- `login.html` — отдельная страница логина/регистрации.
- `sw.js` — service worker для push и cache-first image asset caching.
- Подкаталоги:
  - `css/` — стили.
  - `js/` — клиентская логика.
- В `index.html` script load order важен. Сейчас подключение идет так:
  - `/js/sounds.js`
  - `/js/messageCache.js`
  - `/js/ai-image-risk.js`
  - `/js/app.js`
  - video-notes scripts
  - `/js/voice.js`

## Where to look for bugs
- UI shell, DOM ids/classes или modal markup: смотри `index.html`.
- Login/register страница ломается отдельно от main app: смотри `login.html`.
- Push, notification click handling, image asset cache: смотри `sw.js`.
- Если ломается feature-скрипт, сначала убедись, что его DOM опора и script order корректны в `index.html`.

## How to add features
- Новые глобальные frontend assets подключай явно и осознанно; здесь нет bundler, который сам решит load order.
- Если скрипт зависит от `window.BananzaAppBridge`, он должен загружаться после `app.js`.
- Новые CSS/JS подпапки с собственными invariants должны получить локальный `AGENTS.md`.

## Gotchas
- Порядок `<script>` и `<link>` здесь является частью runtime contract.
- `sw.js` кэширует только безопасные image assets; не расширяй это поведение на audio/video/documents без явного обоснования.
- Изменение DOM id/class в `index.html` почти всегда задевает `public/js/app.js` или feature hooks.

## Verify
- После правок проверь:
  - `public/index.html` грузится без missing asset paths
  - script order сохранен
  - `sw.js` не кэширует лишнее
  - мобильная и десктопная оболочка не потеряли базовую навигацию.
