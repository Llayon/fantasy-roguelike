# GitHub Repository Setup Instructions

## Шаг 1: Создайте репозиторий на GitHub

1. Перейдите на https://github.com/new
2. Заполните форму:
   - **Repository name**: `fantasy-roguelike`
   - **Description**: `Clean roguelike battle simulator with Core 2.0 mechanics - extracted from fantasy-autobattler`
   - **Visibility**: Public (или Private, если хотите)
   - **НЕ** ставьте галочки на:
     - ❌ Add a README file
     - ❌ Add .gitignore
     - ❌ Choose a license
   
   (У нас уже есть эти файлы в проекте)

3. Нажмите **"Create repository"**

## Шаг 2: Инициализируйте Git и загрузите код

После создания репозитория GitHub покажет вам инструкции. Выполните следующие команды в терминале из папки `fantasy-roguelike`:

```bash
# Перейдите в папку fantasy-roguelike
cd fantasy-roguelike

# Инициализируйте git (если еще не инициализирован)
git init

# Добавьте все файлы
git add .

# Создайте первый коммит
git commit -m "Initial commit: Clean roguelike simulator with Core 2.0 mechanics"

# Добавьте remote (замените YOUR_USERNAME на ваш GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/fantasy-roguelike.git

# Переименуйте ветку в main (если нужно)
git branch -M main

# Загрузите код на GitHub
git push -u origin main
```

## Шаг 3: Настройте GitHub Repository

### Добавьте описание и темы

1. Перейдите на страницу вашего репозитория
2. Нажмите на шестеренку рядом с "About"
3. Добавьте:
   - **Description**: `Clean roguelike battle simulator with Core 2.0 mechanics`
   - **Website**: (если есть)
   - **Topics**: `typescript`, `nestjs`, `roguelike`, `game-engine`, `battle-simulator`, `autobattler`, `property-based-testing`

### Настройте GitHub Actions (опционально)

Создайте файл `.github/workflows/ci.yml` для автоматического тестирования:

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: fantasy_roguelike_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Run tests
      run: npm test
      env:
        DATABASE_HOST: localhost
        DATABASE_PORT: 5432
        DATABASE_USER: postgres
        DATABASE_PASSWORD: postgres
        DATABASE_NAME: fantasy_roguelike_test
    
    - name: Build
      run: npm run build
```

## Шаг 4: Создайте Release (опционально)

1. Перейдите в раздел **Releases** → **Create a new release**
2. Заполните:
   - **Tag version**: `v1.0.0`
   - **Release title**: `v1.0.0 - Initial Release`
   - **Description**: 
     ```markdown
     ## 🎉 Initial Release
     
     Clean roguelike battle simulator extracted from fantasy-autobattler.
     
     ### Features
     - ✅ Unified Core Library (Core 1.0 + Core 2.0)
     - ✅ 14 Advanced Mechanics (Facing, Riposte, Charge, etc.)
     - ✅ Compact Simulator (<500 lines)
     - ✅ Property-Based Testing (12 properties)
     - ✅ Async PvP with Snapshots
     - ✅ RESTful API for Roguelike Flow
     
     ### Documentation
     - [API Documentation](docs/API.md)
     - [Architecture Overview](README.md#architecture)
     - [Getting Started](README.md#getting-started)
     ```
3. Нажмите **"Publish release"**

## Шаг 5: Добавьте Badges в README (опционально)

Добавьте в начало README.md:

```markdown
# Fantasy Roguelike Battle Simulator

[![CI](https://github.com/YOUR_USERNAME/fantasy-roguelike/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/fantasy-roguelike/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
```

## Готово! 🎉

Ваш репозиторий готов к использованию. Теперь вы можете:

- Клонировать его на других машинах
- Приглашать коллабораторов
- Создавать Issues и Pull Requests
- Настроить CI/CD
- Делиться ссылкой с другими разработчиками

## Полезные команды Git

```bash
# Проверить статус
git status

# Добавить изменения
git add .

# Создать коммит
git commit -m "Your message"

# Загрузить на GitHub
git push

# Скачать изменения
git pull

# Создать новую ветку
git checkout -b feature/new-feature

# Переключиться на main
git checkout main

# Слить ветку
git merge feature/new-feature
```

## Связь с основным репозиторием

Если вы хотите сохранить связь с основным репозиторием `fantasy-autobattler`:

```bash
# Добавьте upstream remote
git remote add upstream https://github.com/YOUR_USERNAME/fantasy-autobattler.git

# Получите изменения из upstream
git fetch upstream

# Слейте изменения из определенной папки (если нужно)
git checkout upstream/main -- backend/src/core
```
