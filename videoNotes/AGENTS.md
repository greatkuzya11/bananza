# AGENTS.md for videoNotes

## Purpose
- Этот файл описывает server-side video notes subsystem.
- Сначала читай root `AGENTS.md`, затем этот файл.

## What lives here
- `index.js` — endpoint `/api/chats/:chatId/video-note`, upload flow и публикация сообщения.
- `schema.js` — расширения schema для video note данных.
- `meta.js` — normalization shape snapshot metadata.
- `storage.js` — операции с auxiliary files: duplicate/delete transcription assets и cleanup.
- Video notes хранятся через обычные `messages`/`files`, а доп. metadata живет в `voice_messages` с `note_kind='video_note'`.
- Клиентская часть живет отдельно в `public/js/video-notes/`.

## Where to look for bugs
- Проблема в upload endpoint, mime validation, duration limits или reply flow: смотри `index.js`.
- Shape snapshot не сохраняется или ломается при рендере: смотри `meta.js` и клиентские video-notes файлы.
- Auxiliary audio/transcription asset течет или не удаляется: смотри `storage.js` и delete path из `server.js`.
- Если video note создан, но UI не рисуется, проверь не только этот каталог, но и `public/js/video-notes/`.

## How to add features
- Любое новое поле video note metadata добавляй сквозно:
  - schema;
  - normalization;
  - message hydration/rendering.
- Новые storage side-effects не прячь в route handler, если их можно держать в `storage.js`.
- Если меняется shape contract, синхронизируй server snapshot logic и client registry/renderer.

## Gotchas
- Video notes опираются на ту же таблицу `voice_messages`, что и voice notes; не ломай соседние voice assumptions.
- Сообщение хранит видео как основной `file_id`, а auxiliary audio идет через `transcription_file_id`.
- Папка `public/js/video-notes/` — обязательный сосед для реального UI поведения; серверные правки часто требуют клиентских.

## Verify
- После правок проверь:
  - `npm test`
  - endpoint `/api/chats/:chatId/video-note`
  - создание, отображение и удаление video note
  - если трогался storage cleanup, проверь сценарии удаления message assets.
