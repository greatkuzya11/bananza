# AGENTS.md for BananZa

## Purpose
- Этот файл задает базовый контракт для AI-агентов в репозитории `bananza`.
- Сначала читай этот файл, затем ближайший локальный `AGENTS.md` в нужной подпапке.
- Локальные файлы описывают только delta своего поддерева и не повторяют весь root-контекст.

## What lives here
- Стек: Node.js, Express, `ws`, `better-sqlite3`, фронтенд без сборщика, статика из `public/`.
- Основной entrypoint сервера: `server.js`. Это композиционный файл, где собираются auth, uploads, chats, messages, polls, AI, voice, push, weather, forwarding и video notes.
- База и schema/migrations: `db.js`. БД локальная SQLite `bananza.db`, режим WAL включен.
- Realtime слой: `websocket.js`. Здесь подключение по JWT, presence и fan-out событий по чатам.
- Root feature-модули без отдельной папки:
  - `polls.js` — poll metadata, votes, close logic.
  - `messageActions.js` — создание poll message, реакции, pin/unpin и связанный orchestration.
  - `push.js` — web push, VAPID и routing уведомлений.
  - `weather.js` — Open-Meteo search/current weather.
  - `forwarding.js` и `messageCopy.js` — копирование/пересылка сообщений и вложений.
  - `linkPreview.js` — извлечение URL и fetch preview metadata.
  - `soundSettings.js` — пользовательские sound settings.
- Фронтенд без build step:
  - UI shell в `public/index.html`.
  - Статика подключается `<script src=...>` в явном порядке.
  - Основная логика клиента живет в `public/js/app.js`.

## Where to look for bugs
- Проблема в API или permission flow: начинай с `server.js`, затем спускайся в конкретный feature-модуль.
- Проблема в данных, миграции или несоответствии payload: смотри `db.js` и SQL в вызывающем модуле.
- Проблема в realtime, typing, online, read events: смотри `websocket.js` и обработчики WS в `public/js/app.js`.
- Проблема во вложениях или preview: смотри `server.js`, `forwarding.js`, `messageCopy.js`, `linkPreview.js`.
- Проблема только на клиенте: смотри `public/index.html`, `public/js/app.js`, потом ближайшие feature-скрипты.

## How to add features
- Любой новый видимый UI-текст добавляй сразу на двух языках (`ru` и `en`) через `public/js/i18n.js`: кнопки, заголовки, подсказки, placeholders, aria/title, toast/status, alert/confirm/prompt, контекстные меню и push-тексты. Не добавляй hardcoded visible strings без i18n-ключа.
- Для серверной фичи сначала реши, это:
  - расширение существующего модуля;
  - новый top-level feature-модуль;
  - новая подпапка со своей локальной подсистемой.
- Если появляется новая крупная папка с собственными invariants, добавь рядом локальный `AGENTS.md`.
- Новые маршруты обычно регистрируются в `server.js`, даже если реальная логика вынесена в service/feature module.
- Если фича хранит новое состояние, сначала обнови schema в `db.js` или подпапочном `schema.js`, затем обнови hydration/broadcast/client rendering.
- Во фронтенде не вводи bundler-only решения: проект ожидает plain static JS, globals и script load order.

## Gotchas
- Не создавай `AGENTS.md` в runtime/vendor директориях: `.git/`, `node_modules/`, `uploads/`, `voice/models/`, `voice/test-assets/` и аналогичных.
- В проекте много stateful связей между сервером и клиентом; изменения message payload часто требуют синхронных правок в server hydration, WS dispatch и UI rendering.
- `server.js` большой и является реальной точкой композиции. Не предполагай, что маршрут уже “где-то отдельно”, пока не проверишь этот файл.
- `public/js/app.js` очень большой и держит существенную часть клиентского состояния. Локальная правка в UI может задевать scroll restore, cache, WS recovery и composer state.
- AI, voice и video notes уже имеют собственные подпапки и локальные правила. Для работы в них читай дочерние `AGENTS.md`.

## Verify
- Базовые команды:
  - `npm start`
  - `npm run dev`
  - `npm test`
- Перед завершением задачи проверь:
  - не затронуты ли SQL/schema assumptions;
  - не сломан ли script/style load order в `public/index.html`;
  - если менялся payload сообщения, сервер и клиент используют одну и ту же форму данных;
  - если добавлена новая подсистема, у нее есть понятная точка входа и при необходимости локальный `AGENTS.md`.
