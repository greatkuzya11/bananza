# AGENTS.md for scripts

## Purpose
- Этот файл описывает ad-hoc scripts каталога `scripts/`.
- Сначала читай root `AGENTS.md`, затем этот файл.

## What lives here
- Здесь лежат диагностические и ручные smoke/integration scripts, не являющиеся runtime частью приложения.
- Сейчас основной файл: `test_read_sync.js`.
- `test_read_sync.js` ожидает локально поднятый сервер на `http://localhost:3000`, создает тестовых пользователей, чат, WS-подключения и проверяет read sync события.

## Where to look for bugs
- Если script ведет себя странно, сначала проверь его runtime assumptions: локальный сервер, порт `3000`, доступный WebSocket endpoint и чистый auth flow.
- Если script ломается на API-ответах, проблема может быть не в скрипте, а в изменившемся серверном контракте.

## How to add features
- Новые скрипты держи узкими и одноразово полезными: диагностика, smoke-check, data inspection.
- Не превращай `scripts/` в production dependency или скрытый deploy step.
- Для integration scripts явно прописывай предположения о сервере, порте, seed/данных и cleanup behavior.

## Gotchas
- Скрипты этой папки не запускаются автоматически через `npm test`.
- Скрипт может создавать реальные записи в локальной БД, если ты запускаешь его против рабочего dev-сервера.
- Не прячь бизнес-логику в scripts; если код нужен приложению, его место в source modules.

## Verify
- После правок в script:
  - проверь, что он явно документирует свои runtime assumptions;
  - не требует production secrets без необходимости;
  - не меняет основную runtime схему проекта.
