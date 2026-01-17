# Quick Start Guide

Быстрый старт для разработчиков.

## Установка (5 минут)

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/YOUR_USERNAME/fantasy-roguelike.git
cd fantasy-roguelike

# 2. Установите зависимости
npm install

# 3. Запустите PostgreSQL (Docker)
docker run --name fantasy-roguelike-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=fantasy_roguelike \
  -p 5432:5432 \
  -d postgres:14

# 4. Создайте .env файл
cat > .env << EOF
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=fantasy_roguelike
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
EOF

# 5. Запустите миграции
npm run migration:run

# 6. Заполните базу ботами (опционально)
npm run seed:bots

# 7. Запустите сервер
npm run start:dev
```

Сервер запущен на http://localhost:3000 🎉

## Проверка работы

```bash
# Запустите тесты
npm test

# Проверьте API
curl http://localhost:3000/api/health
```

## Первый запрос

```bash
# Создайте новый run
curl -X POST http://localhost:3000/api/run/start \
  -H "Content-Type: application/json" \
  -d '{
    "factionId": "human",
    "leaderId": "knight_commander"
  }'
```

## Полезные команды

```bash
# Разработка
npm run start:dev          # Dev server с hot reload
npm run build              # Сборка
npm run start:prod         # Production server

# Тесты
npm test                   # Все тесты
npm run test:watch         # Watch mode
npm run test:cov           # С coverage

# База данных
npm run migration:run      # Применить миграции
npm run migration:revert   # Откатить миграцию
npm run seed:bots          # Заполнить ботами

# Качество кода
npm run lint               # ESLint
npm run format             # Prettier
```

## Структура API

```
POST   /api/run/start              # Начать новый run
GET    /api/run/:runId             # Получить run
POST   /api/battle/start           # Начать бой
POST   /api/battle/:id/simulate    # Симулировать бой
GET    /api/draft/:runId/options   # Опции драфта
POST   /api/draft/:runId/pick      # Выбрать карту
```

Полная документация: [docs/API.md](docs/API.md)

## Следующие шаги

1. Прочитайте [README.md](README.md) для понимания архитектуры
2. Изучите [docs/API.md](docs/API.md) для работы с API
3. Посмотрите примеры в `src/__tests__/`
4. Прочитайте [CONTRIBUTING.md](CONTRIBUTING.md) перед PR

## Проблемы?

- [Troubleshooting](README.md#troubleshooting)
- [GitHub Issues](https://github.com/YOUR_USERNAME/fantasy-roguelike/issues)
- [Discussions](https://github.com/YOUR_USERNAME/fantasy-roguelike/discussions)
