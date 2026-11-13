# План рефакторинга AdviceCard (Вариант 1: Контейнер + презентация)

> **Статус (2026-11-13): реализован НЕ полностью.** `AdviceScreen` создан и рендерится из
> `App.tsx`, но жестовая логика (`PanResponder`, `Animated`, `completeSwipe`) осталась в
> `AdviceCard` — критерий приёмки «`AdviceCard` не содержит `PanResponder`» не выполнен.
> Доводить код до плана или править план под факт — открытое решение, см.
> `docs/plan-phase2-completion.md`, задача 3.

## Проблема

Сейчас вся логика сосредоточена в `src/components/AdviceCard/AdviceCard.tsx`:

- **Бизнес-логика** — вызов `useAdvice()` внутри компонента (загрузка совета, тегов, фонов, ошибки).
- **Жестовая логика** — `PanResponder`, `Animated.Value`, анимация поворота/масштаба, обработка swipe.
- **Презентация** — `StyleSheet`, рендеринг `<Text>`, `<Image>`, `<TouchableOpacity>`.

Это затрудняет:

- добавление меню (overlay поверх карточки конфликтует с жестами),
- переиспользование компонента,
- независимое тестирование логики и UI.

## Цель

Разделить ответственность:

| Компонент                  | Ответственность                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `AdviceScreen` (обёртка)   | Бизнес-логика (`useAdvice`), жесты (`PanResponder`/`Animated`), управление состоянием, координация дочерних компонентов |
| `AdviceCard` (презентация) | Только отрисовка по пропсам: `advice`, `loading`, `error`, `backgroundImageUrl`, `backgroundColor`, `onAdviceTap`       |

Никаких новых зависимостей. Размер приложения не растёт.

## Файлы, которые создаются / меняются

### Создаются

1. **`src/components/AdviceScreen/AdviceScreen.tsx`** — контейнер с логикой:
   - вызывает `useAdvice()`,
   - управляет `PanResponder` + `Animated` (swipe left/right, тап, rollback),
   - определяет `backgroundImageUrl` / `backgroundColor`,
   - передаёт пропсы в `AdviceCard`,
   - позже сюда можно добавить меню как отдельный слой (например, `<AdviceMenu />`).

2. **`src/components/AdviceScreen/index.ts`** — barrel-экспорт.

### Меняются

3. **`src/components/AdviceCard/AdviceCard.tsx`** — удалить `useAdvice`, `PanResponder`, анимацию; оставить только `StyleSheet` и JSX. Пропсы:

   ```ts
   interface AdviceCardProps {
     advice: Advice | null;
     loading: boolean;
     error: string | null;
     backgroundImageUrl?: string;
     backgroundColor?: string;
     onAdviceTap: () => void;
   }
   ```

4. **`src/App.tsx`** — рендерить `<AdviceScreen />` вместо `<AdviceCard />`.

## Пошаговый план

### Шаг 1. Создать `AdviceScreen`

- Новый каталог `src/components/AdviceScreen/`.
- `AdviceScreen.tsx`:
  - импорт `useAdvice` из `@hooks/useAdvice`,
  - импорт `AdviceCard` из `@components/AdviceCard/AdviceCard`,
  - логика swipe (перенести из старого `AdviceCard`): `PanResponder`, `Animated.Value`, `translationX`, `rotation`, `scale`, `completeSwipe`, `resetPosition`,
  - вызов `useAdvice()`,
  - рендер `AdviceCard` с пропсами + обработка `onAdviceTap` (вызов `fetchNewAdvice`).
- `index.ts` с `export * from './AdviceScreen'`.

### Шаг 2. Очистить `AdviceCard.tsx`

- Удалить импорты `useAdvice`, `PanResponder`, `Animated`, типы жестов.
- Удалить константы `SWIPE_*`, если они были только в этом файле (проверить, не используются elsewhere).
- Оставить только `StyleSheet.create` и компонент, принимающий пропсы и рисующий карточку.

### Шаг 3. Обновить `App.tsx`

- Заменить `<AdviceCard />` на `<AdviceScreen />`.

### Шаг 4. Валидация

- `npm run typecheck` — EXIT 0,
- `npm run lint` — EXIT 0,
- `npm run format:check` — EXIT 0.

## Критерии приёмки

- [ ] `AdviceCard` не вызывает `useAdvice` и не содержит `PanResponder`.
- [ ] `AdviceScreen` отвечает за всю логику swipe/тап/загрузку.
- [ ] `App.tsx` рендерит `AdviceScreen`.
- [ ] Все три команды валидации проходят с EXIT 0.
- [ ] Приложение запускается и совет отображается с шрифтом Oswald.

## Что НЕ делается в этом этапе

- ❌ Добавление самого меню (кнопки, выпадающего списка) — только закладка под будущее меню в `AdviceScreen`.
- ❌ Локальный кэш / дедуп по `id` — отдельная задача.
- ❌ Pull-to-refresh — отдельная задача.
- ❌ Новые зависимости.

## Связанные документы

- `AGENTS.md` — конвенции проекта, запрет на лишние зависимости.
- `README.md` — дорожная карта (Фаза 2: главный экран, свайп, тап, pull-to-refresh, шаринг).
