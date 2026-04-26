# AGENTS.md for voice

## Purpose
- Этот файл описывает voice note и transcription-подсистему.
- Сначала читай root `AGENTS.md`, затем этот файл.

## What lives here
- `index.js` — voice feature module, регистрирует voice routes и orchestration.
- `settings.js` — admin/public voice settings и options.
- `schema.js` — schema для `voice_messages` и связанных данных.
- `providers.js` — transcription transport для `vosk`, `openai`, `grok`, плюс fallback logic.
- `queue.js` — async job queue для transcription.
- `messageMeta.js` — hydration voice metadata в message payload.
- `crypto.js` — шифрование/дешифрование секретов.
- Runtime helpers:
  - `vosk_helper.py`
  - `start_vosk_helper.ps1`
- Клиентская связка живет не здесь, а в `public/js/voice.js`.

## Where to look for bugs
- Загрузка voice note ломается: смотри `voice/index.js` и multer/file validation.
- Сообщение отправляется, но transcription не стартует или зависает: смотри `queue.js`, `index.js`, `providers.js`.
- Проблема только с локальным Vosk: смотри `providers.js`, `vosk_helper.py`, `start_vosk_helper.ps1` и настройки helper URL/model path.
- Metadata не отображается в сообщении: смотри `messageMeta.js` и клиентский `public/js/voice.js`.
- Admin UI не совпадает с серверными настройками: проверь `voice/settings.js` и `public/js/voice.js`.

## How to add features
- Нового transcription provider добавляй в `providers.js`, затем проводи через `settings.js` и voice admin UI.
- Новые поля voice state требуют:
  - schema update;
  - hydration update;
  - client rendering update.
- Если меняешь upload/transcription flow, проверь auto-transcribe path и ручной `/api/messages/:id/transcribe`.
- Все client-facing изменения voice UX должны быть согласованы с `public/js/voice.js`.

## Gotchas
- `voice/models/` и `voice/test-assets/` — runtime/data папки; здесь не нужно хранить agent docs и нельзя делать assumptions как о source code.
- Vosk — внешняя runtime зависимость через локальный helper, а не встроенный Node module.
- Транскрибация может идти через fallback на OpenAI; ошибка пользователя не всегда означает, что primary provider был единственным источником проблемы.
- Voice flow тесно связан с message hydration и broadcast в основном сервере.

## Verify
- После правок проверь:
  - `npm test`
  - voice routes в `voice/index.js`
  - при необходимости ручной smoke-test с клиентом и отправкой WAV voice note
  - если менялись provider settings, проверь admin flow и availability `/api/features`.
