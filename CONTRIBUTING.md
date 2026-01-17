# Contributing to Fantasy Roguelike

Спасибо за интерес к проекту! Мы рады любому вкладу.

## Как внести вклад

### 1. Сообщить о баге

Если вы нашли баг:

1. Проверьте, что баг еще не был [зарегистрирован](https://github.com/YOUR_USERNAME/fantasy-roguelike/issues)
2. Создайте новый Issue с:
   - Четким описанием проблемы
   - Шагами для воспроизведения
   - Ожидаемым и фактическим поведением
   - Версией Node.js и ОС
   - Логами (если есть)

### 2. Предложить улучшение

Для новых фич:

1. Создайте Issue с описанием предложения
2. Дождитесь обсуждения перед началом работы
3. Убедитесь, что фича соответствует целям проекта

### 3. Отправить Pull Request

#### Подготовка

```bash
# Форкните репозиторий на GitHub

# Клонируйте ваш форк
git clone https://github.com/YOUR_USERNAME/fantasy-roguelike.git
cd fantasy-roguelike

# Добавьте upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/fantasy-roguelike.git

# Создайте ветку для вашей фичи
git checkout -b feature/my-awesome-feature
```

#### Разработка

1. **Следуйте стандартам кода**:
   - TypeScript с явными типами (no `any`)
   - JSDoc для всех публичных функций
   - Используйте NestJS Logger (не console.log)
   - Immutable state updates

2. **Напишите тесты**:
   - Unit tests для новых функций
   - Property tests для универсальных свойств
   - Integration tests для API endpoints

3. **Запустите проверки**:
   ```bash
   npm run lint        # ESLint
   npm test            # Все тесты
   npm run build       # TypeScript compilation
   ```

4. **Коммитьте с понятными сообщениями**:
   ```bash
   git commit -m "feat(simulator): add charge momentum calculation"
   ```

#### Формат коммитов

Используйте [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: Новая фича
- `fix`: Исправление бага
- `docs`: Изменения в документации
- `style`: Форматирование (не влияет на код)
- `refactor`: Рефакторинг
- `test`: Добавление тестов
- `chore`: Обслуживание (зависимости, конфиг)

**Примеры**:

```
feat(api): add draft reroll endpoint

- Implement POST /api/draft/:runId/reroll
- Deduct reroll cost from run gold
- Return new draft options

Closes #42
```

```
fix(simulator): prevent dead units from acting

Dead units were still in turn queue after death.
Now properly filtered in buildTurnQueue().

Fixes #38
```

#### Отправка PR

```bash
# Обновите вашу ветку с upstream
git fetch upstream
git rebase upstream/main

# Отправьте в ваш форк
git push origin feature/my-awesome-feature
```

Затем создайте Pull Request на GitHub:

1. Перейдите на страницу вашего форка
2. Нажмите "Compare & pull request"
3. Заполните описание:
   - Что изменено
   - Почему это нужно
   - Как протестировано
   - Ссылки на связанные Issues

## Стандарты кода

### TypeScript

```typescript
// ✅ Хорошо
function calculateDamage(attacker: BattleUnit, target: BattleUnit): number {
  const rawDamage = (attacker.stats.atk - target.stats.armor) * attacker.stats.atkCount;
  return Math.max(1, rawDamage);
}

// ❌ Плохо
function calculateDamage(attacker: any, target: any) {
  return Math.max(1, (attacker.stats.atk - target.stats.armor) * attacker.stats.atkCount);
}
```

### JSDoc

```typescript
/**
 * Calculates physical damage with armor reduction.
 * Formula: max(1, (ATK - armor) * atkCount)
 * 
 * @param attacker - Unit dealing damage
 * @param target - Unit receiving damage
 * @returns Damage value (minimum 1)
 * 
 * @example
 * const damage = calculatePhysicalDamage(
 *   { stats: { atk: 15, atkCount: 2 } },
 *   { stats: { armor: 10 } }
 * );
 * // Returns: 10
 */
```

### Логирование

```typescript
// ✅ Хорошо
this.logger.debug('Riposte triggered', {
  battleId: state.battleId,
  round: state.round,
  defenderId: defender.instanceId,
  damage: 15
});

// ❌ Плохо
console.log('Riposte triggered');
```

### Тесты

```typescript
// ✅ Хорошо - Property test
it('Property 2: Dead units never act', () => {
  fc.assert(
    fc.property(battleStateArb, (state) => {
      const result = simulateBattle(playerTeam, enemyTeam, 12345);
      const deadUnitIds = new Set(
        result.events
          .filter(e => e.type === 'unit_died')
          .map(e => e.targetId)
      );
      
      const actionsAfterDeath = result.events.filter(e => 
        e.actorId && deadUnitIds.has(e.actorId)
      );
      
      return actionsAfterDeath.length === 0;
    }),
    { numRuns: 100 }
  );
});

// ✅ Хорошо - Unit test
it('should calculate charge bonus correctly', () => {
  const momentum = 3;
  const bonus = ChargeProcessor.getChargeBonus(momentum);
  expect(bonus).toBe(0.3); // 30% bonus
});
```

## Структура проекта

```
src/
├── core/           # Переиспользуемая библиотека (game-agnostic)
├── simulator/      # Симулятор боя (<500 строк)
├── roguelike/      # Логика roguelike режима
├── game/           # Игровой контент (юниты, способности)
├── api/            # REST API (NestJS)
├── entities/       # TypeORM entities
└── __tests__/      # Тесты
```

## Процесс Review

1. **Автоматические проверки**: CI должен пройти (тесты, линтер, сборка)
2. **Code review**: Минимум 1 одобрение от мейнтейнера
3. **Тестирование**: Все новые фичи должны иметь тесты
4. **Документация**: Обновите README/docs если нужно

## Вопросы?

- Создайте [Discussion](https://github.com/YOUR_USERNAME/fantasy-roguelike/discussions)
- Напишите в Issue с тегом `question`
- Свяжитесь с мейнтейнерами

## Лицензия

Отправляя PR, вы соглашаетесь, что ваш код будет лицензирован под MIT License.

Спасибо за вклад! 🎉
