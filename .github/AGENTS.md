# AGENTS.md for .github

## Purpose
- Этот файл описывает только CI/CD delta для каталога `.github/`.
- Сначала читай root `AGENTS.md`, затем этот файл.

## What lives here
- В каталоге хранится GitHub automation для репозитория.
- Сейчас полезная часть дерева — `.github/workflows/`, где лежит deploy workflow.

## Where to look for bugs
- Если проблема в автодеплое после merge/push, смотри `.github/workflows/`.
- Если workflow выполнился, но сервер не обновился, проверь не только YAML, но и предположения о серверном пути и systemd service.

## How to add features
- Не добавляй сюда “документацию ради документации”; клади только то, что действительно управляет GitHub-side automation.
- Если появляется новый workflow, добавь или обнови локальный `AGENTS.md` в `.github/workflows/`, а не раздувай этот файл.

## Gotchas
- Репозиторий не использует сложный CI pipeline. Здесь важнее простота и предсказуемость, чем многоступенчатая автоматизация.
- Workflow assumptions должны совпадать с текущей серверной реальностью: branch, path, install strategy, system service name.

## Verify
- После правок в `.github/` открой соответствующий workflow и проверь:
  - trigger branch;
  - команды deploy;
  - путь `/var/www/bananza`;
  - restart `bananza` через `systemctl`.
