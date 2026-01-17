# Security Policy

## Supported Versions

Мы поддерживаем следующие версии проекта:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

Если вы обнаружили уязвимость в безопасности, пожалуйста:

1. **НЕ создавайте публичный Issue**
2. Отправьте email на [security@example.com] с описанием:
   - Тип уязвимости
   - Шаги для воспроизведения
   - Потенциальное влияние
   - Предлагаемое решение (если есть)

3. Мы ответим в течение 48 часов
4. Мы исправим уязвимость и выпустим патч
5. После исправления мы опубликуем Security Advisory

## Security Best Practices

При использовании этого проекта:

### Для разработчиков

- Всегда используйте последнюю версию
- Регулярно обновляйте зависимости: `npm audit fix`
- Не коммитьте `.env` файлы с секретами
- Используйте сильные пароли для базы данных
- Включите SSL/TLS для production

### Для production deployment

```env
# .env для production
NODE_ENV=production
DATABASE_SSL=true
DATABASE_PASSWORD=<strong-password>
LOG_LEVEL=warn
```

### Известные ограничения

- Текущая версия не имеет аутентификации (будет добавлено в v1.1)
- Rate limiting не реализован (будет добавлено в v1.1)
- CORS настроен для development (настройте для production)

## Security Updates

Мы публикуем security updates через:

- GitHub Security Advisories
- Release notes
- CHANGELOG.md

Подпишитесь на уведомления репозитория, чтобы получать обновления.

## Acknowledgments

Мы благодарим всех, кто ответственно сообщает об уязвимостях.

Исследователи безопасности, которые помогли проекту:
- (Пока никого, но вы можете быть первым!)
