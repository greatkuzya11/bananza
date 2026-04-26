# AGENTS.md for public/js/video-notes

## Purpose
- Этот файл описывает client-side video notes subsystem.
- Сначала читай root `AGENTS.md`, затем `public/AGENTS.md`, потом `public/js/AGENTS.md`, затем этот файл.

## What lives here
- `video-note-shapes.js` — shape presets.
- `VideoShapeRegistry.js` — registry и lookup по shape metadata.
- `AudioNoteRecorderAdapter.js` — связка с audio recording layer.
- `VideoNoteRecorder.js` — запись video note и media capture flow.
- `VideoNoteRenderer.js` — render/decorate message attachments и delegated events.
- `MediaNoteComposerController.js` — composer orchestration и coordination с остальным UI.
- `VideoNoteFeature.js` — bootstrap, создание feature graph и регистрация hooks.

## Where to look for bugs
- Новая/сломанная shape: смотри `video-note-shapes.js` и `VideoShapeRegistry.js`.
- Проблема записи media note: смотри `VideoNoteRecorder.js` и `AudioNoteRecorderAdapter.js`.
- Рендер сообщения, attachment UI или click behavior: смотри `VideoNoteRenderer.js`.
- Composer state не совпадает с voice/chat UI: смотри `MediaNoteComposerController.js` и hook integration в `VideoNoteFeature.js`.

## How to add features
- Новую shape добавляй через preset + registry contract, а не через разовые if/else в renderer.
- Новое UI-поведение media note лучше проводить через controller/renderer/hooks, а не напрямую из `app.js`.
- Если меняешь bootstrap или ownership composer, проверь взаимодействие с `window.BananzaMediaNoteHooks` и `window.BananzaVoiceHooks`.

## Gotchas
- Подсистема загружается после `app.js` и зависит от `window.BananzaAppBridge`.
- Video notes конкурируют с voice/composer ownership; регрессии часто проявляются как “кнопка записи больше не работает”.
- Shape metadata должно совпадать с server-side snapshot logic из `videoNotes/meta.js`.

## Verify
- После правок проверь:
  - bootstrap после `bananza:ready`
  - запись и отправку video note
  - render существующих video notes
  - переключение composer ownership между voice и media notes
  - поведение shapes на desktop и mobile.
