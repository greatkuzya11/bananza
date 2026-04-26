# AGENTS.md for .github/workflows

## Purpose
- Этот файл фиксирует инварианты workflow-поддерева.
- Сначала читай root `AGENTS.md`, потом `.github/AGENTS.md`, затем этот файл.

## What lives here
- Сейчас здесь deploy workflow, который срабатывает на `push` в `main`.
- Текущая серверная последовательность:
  - `cd /var/www/bananza`
  - `git pull origin main`
  - `npm install --omit=dev`
  - `systemctl restart bananza`

## Where to look for bugs
- Workflow не запускается: проверь `on.push.branches`.
- Workflow запускается, но деплой не обновляет код: проверь `cd /var/www/bananza` и `git pull origin main`.
- На сервере после деплоя missing dependency: проверь `npm install --omit=dev`.
- Код обновился, но приложение не перезапустилось: проверь `systemctl restart bananza`.

## How to add features
- Любые новые workflow держи простыми и явно привязанными к существующей self-hosted схеме деплоя.
- Если добавляешь шаги проверки, они не должны ломать текущий минималистичный deploy flow без явной причины.
- Если меняется способ деплоя, обнови этот файл сразу вместе с workflow.

## Gotchas
- Здесь нет сложного matrix CI, build artifacts или Docker pipeline. Не проектируй решения как для большого enterprise CI.
- Любая смена branch, server path или service name меняет production assumptions.

## Verify
- Проверь YAML на:
  - trigger по `main`;
  - корректный SSH action;
  - команды `git pull`, `npm install --omit=dev`, `systemctl restart bananza`;
  - отсутствие шагов, требующих инфраструктуры, которой в проекте нет.
