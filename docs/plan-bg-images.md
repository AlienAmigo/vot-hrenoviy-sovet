# План интеграции фоновых изображений (как на fucking-great-advice.ru)

## Механика на сайте (изучено)

**Источники:**

1. Default (главная): `/data/bg.json` — массив из 84 путей `/data/frontpage/1.jpg` … `/data/frontpage/84.jpg`.
2. Теговые: `/api/v2/tags` возвращает теги, у некоторых есть поле `images` (массив URL вида `https://…/uploads/tags/<alias>-<id>-<n>.jpg`) и `bgColor`/`textColor`/`uiColor`.

**Логика назначения картинки совету (в `computedSequence`):**

- Берутся первые 3 тега совета.
- Если у совета ровно один тег, нет target и нет своей картинки → берётся `tag.images[0]`.
- Если картинки всё ещё нет и `bgImages` не пуст → случайное изображение из `bgImages`.
- `getBgImages()`: если у текущего тега есть `images` → они; иначе если есть `bgColor` → `[]` (только цвет); иначе → `defaultImages`.
- Для `conclusions` (заключений) создаётся отдельная карточка с тем же `image`.

**Рендеринг:**

- Если `image` есть → `background-image: url(image)` (cover, center).
- Иначе → `background-color: tag.bgColor` (класс `advice__bg_color`).
- Предзагрузка следующего изображения через `new Image().src = next.image`.

**Для шаринга (OG):** `//fucking-great-advice.ru/data/advice/<id>.jpg` — используется только для соцсетей.

---

## План интеграции в приложение (без новых зависимостей)

### 1. Типы — `src/types/api.ts`

- Добавить в `AdviceTag`: `bgColor?: string`, `textColor?: string`, `uiColor?: string` (остальные поля уже есть).

### 2. Конфиг — `src/config/constants.ts`

- Добавить `SITE_BASE_URL = 'https://fucking-great-advice.ru'` и `DEFAULT_BG_IMAGES_PATH = '/data/bg.json'`.

### 3. API-слой — `src/api/advice.ts`

- В `toAdviceTag` копировать `bgColor`/`textColor`/`uiColor` (если строка).
- Добавить и экспортировать `fetchDefaultBgImages(signal?)` → `Promise<readonly string[]>`: GET `${SITE_BASE_URL}/data/bg.json`, проверка `content-type` (не конверт v2, а прямой JSON-массив), парсинг массива строк, валидация каждого элемента.

### 4. Разрешение картинки — новый `src/utils/resolveAdviceImage.ts`

- Функция `resolveAdviceImage(advice, tags, defaultImages)` возвращает `{ imageUrl?: string; backgroundColor?: string }`:
  - Найти тег по alias (если `advice.tags?.length === 1`).
  - Если тег имеет `images` и они не пусты → `imageUrl = images[0]`.
  - Иначе если `defaultImages` не пуст → `imageUrl = defaultImages[advice.id % defaultImages.length]` (детерминированно по id — стабильно при свайпе назад; альтернатива — random как на сайте, tradeoff).
  - Если тег имеет `bgColor` → `backgroundColor = bgColor`.
  - Приоритет: `imageUrl` если есть, иначе `backgroundColor`.

### 5. Хук `src/hooks/useAdvice.ts`

- При монтировании загрузить `tags` и `defaultImages` (через API), хранить в state.
- Вычислять `backgroundImageUrl` и `backgroundColor` для текущего совета.
- После получения совета вызывать `Image.prefetch(imageUrl)` (встроенный RN, без зависимостей) для предзагрузки.
- Возвращать `backgroundImageUrl` и `backgroundColor` в результате.

### 6. Компонент `src/components/AdviceCard/AdviceCard.tsx`

- Добавить проп `backgroundColor?: string`.
- Если `backgroundImageUrl` есть → `ImageBackground` (как сейчас).
- Иначе если `backgroundColor` есть → применить к контейнеру/карточке.
- Оверлей и стили адаптировать под оба случая.

### 7. Проверки — `scripts/check-api.ts`

- Добавить тесты для `fetchDefaultBgImages` (content-type, массив строк, длина > 0).
- Добавить проверки, что `toAdviceTag` корректно читает `bgColor`/`textColor`/`uiColor`.

### 8. Валидация

- `npm run typecheck` && `npm run lint` && `npm run check:api` (все EXIT=0).

**Tradeoffs / ограничения:**

- Загрузка `tags` + `bg.json` при старте увеличивает время инициализации (~1 запрос к самому медленному роуту + один статический JSON). Можно лениво грузить `defaultImages` только если у тега нет своих `images`.
- Детерминированный выбор картинки по `id` вместо random обеспечивает стабильность при возврате к тому же совету, но отличается от поведения сайта.
- Полная аналогия с сайтом (батч из 35–40 советов, локальная история, дедуп по id, свайп по sequence) потребует переписать `useAdvice` под батч — это отдельная задача (Фаза 2), сейчас фокус только на фоне.
