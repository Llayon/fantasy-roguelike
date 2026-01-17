# GitHub Actions Guide

Руководство по использованию GitHub Actions в проекте fantasy-roguelike.

## 📋 Настроенные Workflows

### 1. CI (Continuous Integration)

**Файл**: `.github/workflows/ci.yml`

**Триггеры**:
- Push в ветки `main` и `develop`
- Pull Request в ветки `main` и `develop`

**Что делает**:
- ✅ Устанавливает зависимости
- ✅ Проверяет типы TypeScript (компиляция)
- ✅ Запускает тесты с coverage
- ✅ Загружает coverage в Codecov
- ✅ Проверяет размер сборки
- ✅ Тестирует на Node.js 18.x и 20.x
- ✅ Использует PostgreSQL 14 для тестов

**Статус**: ✓ Активен

**Команды**:
```bash
# Посмотреть последние запуски
gh run list --workflow=CI --limit 5

# Посмотреть детали конкретного запуска
gh run view <run-id>

# Посмотреть логи
gh run view <run-id> --log

# Повторно запустить failed run
gh run rerun <run-id>
```

### 2. Release (Автоматические релизы)

**Файл**: `.github/workflows/release.yml`

**Триггеры**:
- Push тега в формате `v*.*.*` (например, `v1.0.0`, `v1.2.3`)

**Что делает**:
- ✅ Собирает проект
- ✅ Запускает тесты
- ✅ Генерирует changelog
- ✅ Создает GitHub Release автоматически

**Как создать релиз**:
```bash
# 1. Создайте тег
git tag -a v1.0.1 -m "Release v1.0.1 - Bug fixes"

# 2. Отправьте тег на GitHub
git push origin v1.0.1

# 3. Workflow автоматически создаст релиз!
```

**Команды**:
```bash
# Посмотреть все релизы
gh release list

# Посмотреть конкретный релиз
gh release view v1.0.0

# Создать релиз вручную (если нужно)
gh release create v1.0.1 --title "v1.0.1 - Bug Fixes" --notes "Fixed critical bugs"
```

### 3. Dependabot (Автообновление зависимостей)

**Файл**: `.github/dependabot.yml`

**Что делает**:
- ✅ Проверяет обновления npm пакетов каждый понедельник
- ✅ Проверяет обновления GitHub Actions
- ✅ Группирует обновления по категориям (NestJS, TypeScript, Testing)
- ✅ Автоматически создает Pull Requests
- ✅ Игнорирует major версии для стабильных пакетов

**Настройки**:
- Максимум 10 открытых PR одновременно
- Автоматически назначает на @Llayon
- Добавляет labels: `dependencies`, `automated`

**Команды**:
```bash
# Посмотреть PR от Dependabot
gh pr list --author app/dependabot

# Слить PR от Dependabot
gh pr merge <pr-number> --squash
```

## 🎯 Полезные команды GitHub CLI

### Workflows

```bash
# Список всех workflows
gh workflow list

# Включить/выключить workflow
gh workflow enable <workflow-name>
gh workflow disable <workflow-name>

# Запустить workflow вручную (если настроен workflow_dispatch)
gh workflow run <workflow-name>
```

### Runs

```bash
# Последние запуски
gh run list --limit 10

# Запуски конкретного workflow
gh run list --workflow=CI

# Только failed запуски
gh run list --status=failure

# Посмотреть детали
gh run view <run-id>

# Посмотреть логи
gh run view <run-id> --log

# Посмотреть только failed логи
gh run view <run-id> --log-failed

# Повторить запуск
gh run rerun <run-id>

# Отменить запуск
gh run cancel <run-id>

# Удалить запуск
gh run delete <run-id>

# Следить за запуском в реальном времени
gh run watch
```

### Releases

```bash
# Список релизов
gh release list

# Посмотреть релиз
gh release view v1.0.0

# Создать релиз
gh release create v1.0.1 \
  --title "v1.0.1 - Bug Fixes" \
  --notes "Fixed critical bugs" \
  --draft  # Опционально: создать как draft

# Удалить релиз
gh release delete v1.0.0

# Загрузить файлы в релиз
gh release upload v1.0.0 dist.zip
```

### Pull Requests

```bash
# Список PR
gh pr list

# PR от Dependabot
gh pr list --author app/dependabot

# Создать PR
gh pr create --title "Fix bug" --body "Description"

# Посмотреть PR
gh pr view <pr-number>

# Слить PR
gh pr merge <pr-number> --squash

# Закрыть PR
gh pr close <pr-number>
```

## 🔧 Настройка Branch Protection

Рекомендуется настроить защиту для ветки `main`:

```bash
# Через веб-интерфейс:
# Settings → Branches → Add rule

# Или через gh CLI (требует расширение):
gh api repos/Llayon/fantasy-roguelike/branches/main/protection \
  --method PUT \
  --field required_status_checks[strict]=true \
  --field required_status_checks[contexts][]=build \
  --field required_status_checks[contexts][]=test \
  --field enforce_admins=false \
  --field required_pull_request_reviews[required_approving_review_count]=1
```

**Рекомендуемые настройки**:
- ✅ Require status checks to pass (CI должен пройти)
- ✅ Require branches to be up to date
- ✅ Require pull request reviews (1 approval)
- ❌ Include administrators (чтобы вы могли пушить напрямую если нужно)

## 📊 Badges для README

Уже добавлены в README.md:

```markdown
[![CI](https://github.com/Llayon/fantasy-roguelike/actions/workflows/ci.yml/badge.svg)](https://github.com/Llayon/fantasy-roguelike/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
```

Дополнительные badges:

```markdown
# Release version
[![Release](https://img.shields.io/github/v/release/Llayon/fantasy-roguelike)](https://github.com/Llayon/fantasy-roguelike/releases)

# Code coverage (если настроен Codecov)
[![codecov](https://codecov.io/gh/Llayon/fantasy-roguelike/branch/main/graph/badge.svg)](https://codecov.io/gh/Llayon/fantasy-roguelike)

# Issues
[![Issues](https://img.shields.io/github/issues/Llayon/fantasy-roguelike)](https://github.com/Llayon/fantasy-roguelike/issues)

# Pull Requests
[![PRs](https://img.shields.io/github/issues-pr/Llayon/fantasy-roguelike)](https://github.com/Llayon/fantasy-roguelike/pulls)

# Last commit
[![Last Commit](https://img.shields.io/github/last-commit/Llayon/fantasy-roguelike)](https://github.com/Llayon/fantasy-roguelike/commits/main)
```

## 🚀 Workflow для разработки

### Обычный процесс

1. **Создайте ветку**:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Внесите изменения и закоммитьте**:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. **Отправьте на GitHub**:
   ```bash
   git push origin feature/my-feature
   ```

4. **Создайте Pull Request**:
   ```bash
   gh pr create --title "Add new feature" --body "Description"
   ```

5. **CI автоматически запустится** и проверит ваш код

6. **После прохождения CI, слейте PR**:
   ```bash
   gh pr merge <pr-number> --squash
   ```

### Создание релиза

1. **Обновите версию** (если нужно):
   ```bash
   npm version patch  # 1.0.0 → 1.0.1
   npm version minor  # 1.0.0 → 1.1.0
   npm version major  # 1.0.0 → 2.0.0
   ```

2. **Создайте тег**:
   ```bash
   git tag -a v1.0.1 -m "Release v1.0.1"
   ```

3. **Отправьте тег**:
   ```bash
   git push origin v1.0.1
   ```

4. **Release workflow автоматически создаст релиз!**

## 🐛 Troubleshooting

### CI падает с ошибкой зависимостей

```bash
# Локально проверьте
npm ci --legacy-peer-deps
npm test
```

### Workflow не запускается

```bash
# Проверьте статус
gh workflow list

# Включите workflow
gh workflow enable <workflow-name>
```

### Dependabot не создает PR

1. Проверьте настройки в `.github/dependabot.yml`
2. Убедитесь, что Dependabot включен в Settings → Security → Dependabot

### Release не создается

1. Проверьте формат тега (должен быть `v*.*.*`)
2. Посмотрите логи workflow:
   ```bash
   gh run list --workflow=Release
   gh run view <run-id> --log
   ```

## 📚 Дополнительные ресурсы

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub CLI Documentation](https://cli.github.com/manual/)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [Semantic Versioning](https://semver.org/)

## 🎉 Готово!

Ваш репозиторий полностью настроен с:
- ✅ Автоматическим CI/CD
- ✅ Автоматическими релизами
- ✅ Автообновлением зависимостей
- ✅ Badges в README
- ✅ Полной документацией

Теперь вы можете сосредоточиться на разработке, а GitHub Actions позаботится об остальном! 🚀
