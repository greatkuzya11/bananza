# AGENTS.md for ai

## Purpose
- Этот файл описывает AI-подсистему: provider integration, settings, action-planner и server-side orchestration.
- Сначала читай root `AGENTS.md`, затем этот файл.

## What lives here
- `index.js` — главный AI feature module. Подключается из `server.js` через `createAiBotFeature`.
- `settings.js` — глобальные AI settings, defaults, очистка значений и хранение секретов через crypto helpers.
- `schema.js` — schema/migration логика для AI-таблиц.
- Provider-модули:
  - `openai.js`
  - `grok.js`
  - `deepseek.js`
  - `yandex.js`
- Action-planner:
  - `actionPlannerGate.js` — определяет, стоит ли вообще пытаться выполнить chat action.
  - `actionPlanTextParser.js` — вытаскивает action plan из JSON, loose text и прямых пользовательских команд.
- `reactionKeys.js` — нормализация и словарь реакций.

## Where to look for bugs
- Настройки не сохраняются или “сбрасываются”: смотри `settings.js`.
- Новая модель/провайдер не появляется в UI или API: смотри defaults/listing logic в `index.js` и provider module.
- Бот отвечает текстом, но не делает poll/react/pin action: смотри `actionPlannerGate.js`, `actionPlanTextParser.js` и integration в `index.js`.
- Проблема только с одним провайдером: начинай с его отдельного файла, а не со всего `index.js`.
- Если AI payload влияет на сообщения, проверь также root-level `messageActions.js` и `polls.js`.

## How to add features
- Новый провайдер добавляй как отдельный модуль с четкой границей ответственности, затем подключай его в `index.js` и `settings.js`.
- Новую модель существующего провайдера обычно достаточно:
  - добавить в defaults/fallback catalog;
  - провести sanitize/validation в `settings.js`;
  - подключить в UI/API, если модель должна быть user-selectable.
- Если добавляешь новый bot action, почти всегда нужно менять и gate, и parser, и server-side executor.
- Не смешивай provider transport logic с parsing chat actions: это разные слои.

## Gotchas
- `index.js` большой и сочетает orchestration, routing, bot state и provider dispatch. Делай точечные правки и проверяй соседние code paths.
- Часть AI image risk logic переиспользует `public/js/ai-image-risk.js`; это shared boundary между server и client.
- Не ломай backward compatibility настроек: `settings.js` уже содержит derive/normalize behavior для interactive flags и defaults.
- Action-planner уже защищен тестами; если меняешь эвристику или loose parsing, почти наверняка нужны тесты.

## Verify
- Минимальный набор проверок после правок в AI:
  - `npm test`
  - особенно `test/actionPlannerGate.test.js`
  - `test/actionPlanTextParser.test.js`
  - `test/aiSettings.test.js`
- Если менялся execution path chat actions, проверь и `test/messageActions.test.js`.
