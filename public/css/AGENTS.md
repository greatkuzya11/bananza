# AGENTS.md for public/css

## Purpose
- Этот файл описывает ответственность CSS-поддерева.
- Сначала читай root `AGENTS.md`, затем `public/AGENTS.md`, затем этот файл.

## What lives here
- `style.css` — основная тема, layout, chat UI и общие компоненты.
- `voice.css` — voice-specific UI поверх базового стиля.
- `video-notes.css` — video note layout, shapes и media-note presentation.
- В `index.html` стили подключаются в порядке:
  - `/css/style.css`
  - `/css/voice.css`
  - `/css/video-notes.css`

## Where to look for bugs
- Общая верстка, sidebar, messages, composer, modal regressions: начинай с `style.css`.
- Voice UI не совпадает с логикой `public/js/voice.js`: смотри `voice.css`.
- Video note bubble, shape clipping или media layout: смотри `video-notes.css`.
- Если поведение ломается только на мобильных, ищи соответствующие media-query и viewport assumptions.

## How to add features
- Базовые стили добавляй в `style.css`, а не в feature-specific файл.
- Voice/video-note overrides держи в профильных CSS, чтобы не смешивать разные слои.
- Учитывай, что более поздние stylesheet могут переопределять ранние.
- Сначала меняй существующие design tokens/selectors, а не плодишь похожие дублеры.

## Gotchas
- Проект mobile-first в том смысле, что телефонный UI обязателен; не считай desktop layout единственным источником истины.
- Перестройка размеров composer/messages часто цепляет scroll, sticky bars и media attachments.
- Изменение общих message bubble styles может случайно сломать voice/video-note presentation.

## Verify
- После CSS-правок проверь:
  - desktop chat layout
  - mobile sidebar/chat transition
  - composer и reply bar
  - voice message rows
  - video notes и media attachments.
