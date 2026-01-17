# Checklist для публикации на GitHub

Используйте этот чеклист перед публикацией репозитория.

## Перед публикацией

### 1. Проверка кода

- [ ] Все тесты проходят: `npm test`
- [ ] Линтер не выдает ошибок: `npm run lint`
- [ ] TypeScript компилируется: `npm run build`
- [ ] Нет секретов в коде (пароли, API ключи)
- [ ] `.env` файл в `.gitignore`
- [ ] `node_modules/` в `.gitignore`

### 2. Документация

- [ ] README.md заполнен и актуален
- [ ] API.md содержит все endpoints
- [ ] CONTRIBUTING.md описывает процесс
- [ ] LICENSE файл присутствует
- [ ] CHANGELOG.md создан

### 3. GitHub настройки

- [ ] Repository name: `fantasy-roguelike`
- [ ] Description добавлено
- [ ] Topics добавлены (typescript, nestjs, roguelike, etc.)
- [ ] GitHub Actions настроены (.github/workflows/ci.yml)
- [ ] Issue templates созданы
- [ ] PR template создан

### 4. Безопасность

- [ ] SECURITY.md создан
- [ ] Нет хардкоженных паролей
- [ ] Нет API ключей в коде
- [ ] Database credentials в .env (не в коде)

## Команды для публикации

```bash
# 1. Убедитесь, что вы в папке fantasy-roguelike
cd fantasy-roguelike

# 2. Проверьте статус git
git status

# 3. Инициализируйте git (если еще не сделано)
git init

# 4. Добавьте все файлы
git add .

# 5. Проверьте, что добавлено
git status

# 6. Создайте первый коммит
git commit -m "Initial commit: Clean roguelike simulator with Core 2.0 mechanics

- Unified Core Library (Core 1.0 + Core 2.0)
- 14 Advanced Mechanics (Facing, Riposte, Charge, etc.)
- Compact Simulator (<500 lines)
- Property-Based Testing (12 properties)
- Async PvP with Snapshots
- RESTful API for Roguelike Flow
- Complete documentation and tests"

# 7. Добавьте remote (замените YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/fantasy-roguelike.git

# 8. Переименуйте ветку в main
git branch -M main

# 9. Отправьте на GitHub
git push -u origin main
```

## После публикации

### 1. Настройте GitHub Repository

- [ ] Добавьте описание в About
- [ ] Добавьте topics/tags
- [ ] Включите Issues
- [ ] Включите Discussions (опционально)
- [ ] Настройте Branch protection rules для main

### 2. Создайте первый Release

```bash
# Создайте тег
git tag -a v1.0.0 -m "Release v1.0.0 - Initial Release"
git push origin v1.0.0
```

Затем на GitHub:
1. Перейдите в Releases → Create a new release
2. Выберите тег v1.0.0
3. Заполните Release notes (см. GITHUB_SETUP.md)
4. Опубликуйте

### 3. Добавьте badges в README

```markdown
[![CI](https://github.com/YOUR_USERNAME/fantasy-roguelike/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/fantasy-roguelike/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
```

### 4. Настройте GitHub Actions

- [ ] Проверьте, что CI workflow запускается
- [ ] Убедитесь, что тесты проходят в CI
- [ ] Настройте Codecov (опционально)

### 5. Социальные сети (опционально)

- [ ] Анонсируйте на Twitter/X
- [ ] Опубликуйте на Reddit (r/gamedev, r/roguelikedev)
- [ ] Добавьте на Hacker News
- [ ] Поделитесь в Discord серверах

## Проверка после публикации

```bash
# Клонируйте репозиторий в новую папку для проверки
cd ..
git clone https://github.com/YOUR_USERNAME/fantasy-roguelike.git test-clone
cd test-clone

# Установите зависимости
npm install

# Запустите тесты
npm test

# Соберите проект
npm run build

# Если все работает - успех! 🎉
```

## Поддержка

После публикации:

- [ ] Отвечайте на Issues в течение 48 часов
- [ ] Ревьюйте Pull Requests
- [ ] Обновляйте документацию при изменениях
- [ ] Публикуйте Release notes для новых версий
- [ ] Поддерживайте CHANGELOG.md актуальным

## Полезные ссылки

- [GitHub Docs - Creating a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
- [GitHub Docs - About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Готово к публикации?** Следуйте инструкциям в [GITHUB_SETUP.md](GITHUB_SETUP.md)
