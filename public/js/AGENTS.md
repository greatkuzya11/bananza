# AGENTS.md for public/js

## Purpose
- Этот файл описывает основную клиентскую логику и ее runtime contracts.
- Сначала читай root `AGENTS.md`, затем `public/AGENTS.md`, затем этот файл.

## What lives here
- `app.js` — главный orchestration-файл клиента: auth state, chat list, messages, WS, settings, composer, rendering, modal flows, hooks.
- `messageCache.js` — IndexedDB/cache/outbox helpers и локальный asset cache coordination.
- `sounds.js` — client-side sounds behavior.
- `ai-image-risk.js` — shared helper для AI image risk logic; используется и за пределами браузерного UI.
- `voice.js` — voice feature UI, hooks и admin modal.
- Подпапка `video-notes/` — отдельный feature-layer для media notes.
- `app.js` публикует `window.BananzaAppBridge` и dispatch'ит `bananza:ready`.

## Where to look for bugs
- Chat state, scroll, pagination, WS recovery, rendering обычных сообщений: смотри `app.js`.
- Проблемы офлайн-кэша, cached pages, outbox replay, IndexedDB fallbacks: смотри `messageCache.js`.
- Звук не играет или settings не применяются: смотри `sounds.js` и связанный server settings path.
- Feature script не находит bridge/hooks: проверь `app.js`, script order в `public/index.html` и feature hooks.

## How to add features
- Любая новая видимая строка в JS должна проходить через `window.BananzaI18n`/`BananzaAppBridge.t` или иметь точный literal в `public/js/i18n.js` для `ru` и `en`. Это касается toast/status, aria/title/placeholder, модалок, контекстных меню, alert/confirm/prompt и feature-скриптов.
- Новую основную клиентскую функциональность сначала пытайся встроить в существующие state flows `app.js`, а не делать параллельный mini-app.
- Если фича должна интегрироваться модульно, используй существующий pattern:
  - `window.BananzaAppBridge`
  - `window.BananzaVoiceHooks`
  - `window.BananzaVideoNoteHooks`
  - `window.BananzaMediaNoteHooks`
  - событие `bananza:ready`
- Если меняешь форму message payload, синхронизируй client rendering с серверным hydration/broadcast.

## Gotchas
- `app.js` большой и stateful; локальное изменение может задеть unread, restore scroll, hidden chats, mentions, pins и WS recovery.
- В проекте нет module bundler, imports и tree-shaking; все держится на globals и порядке подключения.
- `ai-image-risk.js` является shared boundary, поэтому browser-only assumptions здесь опасны.

## Verify
- После правок проверь:
  - загрузку списка чатов
  - открытие чата и pagination
  - realtime события через WS
  - composer/send flow
  - cache/outbox сценарии, если трогался `messageCache.js`.
