# AGENTS.md for test

## Purpose
- Этот файл описывает текущую тестовую стратегию проекта.
- Сначала читай root `AGENTS.md`, затем этот файл.

## What lives here
- Тесты запускаются через `node:test` и команду `npm test`.
- Текущие основные зоны покрытия:
  - `actionPlanTextParser.test.js`
  - `actionPlannerGate.test.js`
  - `aiSettings.test.js`
  - `messageActions.test.js`
- Это в первую очередь unit/integration-style tests для AI parsing/settings и message actions/polls.

## Where to look for bugs
- Если менялась эвристика AI-команд, parser или gate, начинай с AI-тестов.
- Если менялись poll/reaction/pin сценарии, начинай с `messageActions.test.js`.
- Если feature сломан, а тестов нет, сначала оцени, можно ли выделить pure helper и покрыть именно его.

## How to add features
- Для новой логики сначала ищи узкую тестируемую границу:
  - pure helper;
  - parser;
  - service method с in-memory DB harness.
- Для server-side message/poll logic предпочитай pattern из `messageActions.test.js` с `better-sqlite3` in-memory schema.
- Не добавляй тяжелые end-to-end сценарии без явной необходимости; проект сейчас опирается на быстрые targeted tests.

## Gotchas
- Текущие тесты не покрывают все feature-папки одинаково глубоко; отсутствие теста не означает, что behavior неважен.
- Если меняешь loose parser/gate, не полагайся только на ручную проверку: эти эвристики легко регрессируют.
- Отдельный скрипт `scripts/test_read_sync.js` не является частью `npm test`.

## Verify
- Базовая проверка:
  - `npm test`
- После правок в AI/action logic проверь соответствующие тесты особенно внимательно.
- Если добавил новый тестовый harness, убедись, что он не требует внешнего сервера или production БД по умолчанию.
