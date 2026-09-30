# AGENTS.md

Контекст для ИИ-агентов, работающих в этом репозитории. Читай перед любыми правками.

## Обзор

Android-приложение с советами с сайта fucking-great-advice.ru. React Native + TypeScript,
Expo SDK 57. Сейчас это **каркас с API-слоем**: экран пока шаблонный, виджет не реализован.

Главный критерий проекта — **минимальный размер приложения**. Любое лишнее решение по зависимостям
и фичам должно обсуждаться, а не добавляться «по умолчанию».

Дополнительно: `README.md` (подробности и обоснования), `package.json` (скрипты).

## Стек

| Компонент                             | Роль                                  |
| ------------------------------------- | ------------------------------------- |
| Expo SDK 57 (`expo ~57.0.25`)         | prebuild/CNG, config plugins          |
| React Native `0.86.3`, React `19.2.3` |                                       |
| TypeScript `~6.0.3`                   | `strict` + `noUncheckedIndexedAccess` |
| Шаблон `blank-typescript`             | **без `expo-router`**                 |
| `fetch` из коробки                    | без HTTP-библиотек                    |
| `expo-build-properties ~57.0.22`      | R8 + shrinkResources                  |

Зависимости приложения: `expo`, `expo-build-properties`, `expo-status-bar`, `react`, `react-native`.
Dev: `typescript`, `@types/react`, `eslint` (с `eslint-config-expo`), `prettier`
(с `eslint-config-prettier`). Больше ничего.

## Жёсткие правила

1. **Только HTTPS** в запросах. Android 9+ блокирует cleartext по умолчанию — `http://` даст
   `Network request failed`.
2. **Не добавлять зависимости без явного согласования пользователя.** Особенно критично не тянуть:
   `expo-router`, `react-navigation`, `react-native-gesture-handler`, `react-native-reanimated`,
   `axios`, хранилища (`MMKV`, `@react-native-async-storage/async-storage`), `expo-updates`.
   Причина — размер приложения. Если кажется, что библиотека нужна — сначала объясни зачем
   и предложи альтернативу без зависимости.
3. **Ответ API — конверт `{status, errors, data}` с HTTP 200 даже у ошибок** (см. ниже).
   Не доверяй ТЗ, доверяй живому ответу: у `random-advices` `data` — массив, у `latest` — объект.
4. **Обязательна проверка `content-type`** перед `response.json()` — на мёртвых роутах сервер
   отдаёт HTML, и `json()` бросит невнятное исключение.
5. **Не менять `android.package` (`ru.vot.advice`) и `scheme` (`votadvice`)** после первого
   релиза — от пакета зависит FQCN виджета.
6. **`enableShrinkResourcesInReleaseBuilds` требует `enableMinifyInReleaseBuilds: true`** —
   иначе `expo prebuild` падает с ошибкой. Менять парой.
7. **Node ≥ 22.13.** Node 18 (есть в nvm) не подходит: RN 0.86 требует
   `^20.19.4 || ^22.13.0 || ^24.3.0 || >=25`.
8. **Не коммитить** `android/`, `ios/`, `.expo/`, `node_modules/`, `.idea/` — всё в `.gitignore`.
9. В `scripts/*.ts` — **только синтаксис, стираемый типами**: без `enum`, `namespace`,
   конструкторных parameter properties. Файл запускается нативным `node` через type stripping.

## Команды

```bash
# Обязательно: npm отсутствует в /usr/bin, только в nvm
export PATH="$HOME/.nvm/versions/node/v22.19.0/bin:$PATH"

npm install
npm run typecheck     # tsc --noEmit — прогнать ПЕРЕД финалом
npm run lint          # eslint .
npm run format        # prettier --write .
npm run check:api     # 65 проверок: парсер + живые запросы к API
npm start              # expo start
npm run android        # expo run:android (нужен prebuild)
npx expo prebuild --platform android
npx expo-doctor
```

Валидация после любой правки: `npm run typecheck` && `npm run lint` && `npm run check:api`.
Все должны быть EXIT=0. Форматирование: `npm run format` (Prettier, конфиг в `.prettierrc`).

## Структура

```
app.json            # scheme, android.package, versionCode, plugins (expo-build-properties)
index.ts            # registerRootComponent
src/App.tsx         # шаблонный, UI ещё не написан
src/api/advice.ts   # весь HTTP-слой — единственная точка доступа к API
src/types/          # типы API (Advice, AdviceTag, …), alias @types
src/config/         # константы (API_BASE_URL, …), alias @config
scripts/check-api.ts # проверки: парсер + живые запросы
scripts/register-aliases.mjs # резолвер tsconfig-путей для Node (--import в check:api)
assets/             # иконки, splash
android/            # сгенерировано prebuild, в git не входит
```

`src/api/advice.ts` экспортирует: `AdviceApiError`, `isAdvice`, `isAdviceConclusion`,
`parseAdvice`, `parseAdviceList`, `htmlToText`, `fetchAdvices`, `fetchAdviceById`,
`fetchLatestAdvice`, `fetchTags`. Типы (`Advice`, `AdviceConclusion`, `AdviceTag`,
`AdviceQuery`) — `src/types` (alias `@types`), константы (`API_BASE_URL`,
`REQUEST_TIMEOUT_MS`, `MAX_BATCH_SIZE`) — `src/config` (alias `@config`).

Ходить в сеть напрямую из компонентов нельзя — только через этот модуль.

### Алиасы путей (tsconfig `paths`)

| Алиас                          | Путь                               |
| ------------------------------ | ---------------------------------- |
| `@/*`                          | `src/*` (например, `@/api/advice`) |
| `@api`, `@api/*`               | `src/api`                          |
| `@config`, `@config/*`         | `src/config`                       |
| `@components`, `@components/*` | `src/components`                   |
| `@types`, `@types/*`           | `src/types`                        |

Заведено в `tsconfig.json` (пути без `baseUrl`, по-относительному — TypeScript 6.0 объявил
`baseUrl` устаревшим). Metro в SDK 57 читает `paths` из tsconfig сам (`experiments.tsconfigPaths`
включён по умолчанию) — отдельная конфигурация не нужна; ESLint-резолвер `eslint-config-expo`
тоже их понимает. Каталог `src/components` пока пуст — алиас заведён заранее.

**Все импорты внутри проекта — через алиасы** (кроме npm-пакетов и `node:`-билтинов):
относительные `'./'`/`'../'` не используются. Node сам tsconfig-paths не знает, поэтому
`check:api` запускается с `--import scripts/register-aliases.mjs` — этот хук читает
`compilerOptions.paths` из tsconfig и резолвит алиасы в Node. Metro и `tsc` читают tsconfig
сами, им ничего не нужно. Новые алиасы заводить с оглядкой на этот загрузчик (он покрывает
то, что в tsconfig `paths`).

## API — факты, проверенные вживую

Полная документация — `src/api/api_v2.md`. Проверено 2026-09-30. Сайт ходит в
**недокументированный `/api/v2/*`**, страница документации описывает только легаси v1:

| Запрос                                                                  | Результат                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `GET /api/v2/random-advices?limit=&startID=`                            | 200, конверт, `data` — **массив** советов (≤40)                           |
| `GET /api/v2/random-advices-by-tag?tag=<alias>`                         | 200, массив советов тега; без `tag` → 400                                 |
| `GET /api/v2/latest`                                                    | 200, `data` — **объект** совета                                           |
| `GET /api/v2/tags`                                                      | 200, массив из 24 тегов (самый медленный роут)                            |
| `GET /api/random`, `/api/latest`                                        | 200, легаси-объект `{"id","text","sound":""}` — жив, но без `html`/`tags` |
| `GET /api/latest/5`, `/api/random/censored`, `/api/random_by_tag/<tag>` | 404, тело — HTML Yii2                                                     |
| ошибки в конверте (`limit=0`, неизвестный тег)                          | **HTTP 200** + `{"status":"error","errors":["No advices"]}`               |

Следствия для кода:

- `Advice = { id, text, html?, tags?, conclusions? }` — `html` с разметкой сайта
  (`<br>`, `<span>`), `tags` — массив alias'ов; `htmlToText` превращает html в плоский текст.
- **`status` в конверте, а не HTTP-статус** — ошибки приходят с 200. Мёртвые роуты отдают
  HTML → проверка `content-type` перед `json()` обязательна.
- Работают только `limit`, `startID`, `tag`; незнакомые параметры (`censored`, `tags`, `count`)
  сервер молча игнорирует. `startID` — **не хронология**: совет просто встаёт первым.
- **Теги доступны**: `/api/v2/tags` + `random-advices-by-tag`; плюс 6 рабочих alias'ов вне
  списка (`driving`, `kids`, `newyear`, `tricks`, `dentist`, `pool`). Фича на их основе —
  отдельное решение, не делать самостоятельно.
- Цензурной версии нет ни в v1, ни в v2 — маскировка матов только клиентская.
- Истории на сервере нет → «свайп назад» возможен только через локальный кэш, а дедуп по `id`
  обязателен (рандом отдаёт повторы).
- `Cache-Control: no-store, no-cache, must-revalidate` — кэшировать на уровне HTTP нечего,
  каждый запрос идёт в origin. Не делать поллинг таймером.
- Изредка ручки флапают 500 (HTML `yii\base\ErrorException: preg_match(): JIT memory failed`) —
  транзиентная ошибка сервера. Латентность ~40–130 мс, auth не нужна (200 без cookies).

## Конвенции кода

- **Ошибки**: кидать только `AdviceApiError` (с HTTP-статусом, где он есть), не голый `Error`.
  `requestJson` оборачивает сетевые/таймаут-ошибки, валидация конверта выполняется уже вне `catch`.
- **Не доверять форме данных**: любую нагрузку прогонять через `isAdvice`/`parseAdvice`.
- **Никаких `any`** — только `unknown` + сужение.
- Комментарии и сообщения об ошибках — на русском.
- Имена файлов: `kebab-case` для скриптов/модулей, `PascalCase` для компонентов.

## Состояние проекта

Сделано:

- [x] Фаза 0 — каркас: `create-expo-app --template blank-typescript`, `.gitignore`, `app.json`
      (scheme/package/versionCode), `expo-build-properties` с R8 + shrinkResources, README
- [x] Фаза 1 — `src/api/advice.ts` + `scripts/check-api.ts` (65 проверок)
- [x] Миграция на API v2: `src/api/api_v2.md` (фактическая документация), проверки устойчивы
      к флапающему 500 (до 3 попыток с паузой)
- [x] Валидация: `tsc --noEmit` чисто, `check:api` 65/65, `expo-doctor` 21/21, `prebuild` OK

Дальше:

- [ ] Фаза 2 — главный экран: свайп истории, тап = новый совет, pull-to-refresh, шаринг
- [ ] Фаза 3 — виджет (**вариант реализации ещё не выбран**)
- [ ] Фаза 5 — сборка release, замер размера
- [ ] Фаза 6 — метаданные, иконки, публикация

## Открытые решения (не принимать самостоятельно)

1. **Виджет**: нативный Kotlin через local config plugin **против** `react-native-android-widget`
   (у последнего виджет — это bitmap, а не текст, плюс бутается JS-рантайм на каждое обновление).
   Виджет в текущем состоянии не трогаем — ждём решения.
2. **Контент/рейтинг Play**: отложено. Учесть, что эндпоинт цензуры мёртв, так что маскировка
   матов была бы только клиентской.
3. **Название в лаунчере** (`name` в `app.json`) — шаблонное `vot-hrenoviy-sovet`, продуктовое
   решение.
4. **`expo-updates` не подключаем** — в шаблонах SDK 57 его нет, EAS Build без него работает.
   OTA можно добавить позже одним коммитом.
5. **`expo.autolinking.exclude` не применён** — кандидаты (`expo-font`, `expo-asset`,
   `expo-file-system`) это рантайм-зависимости `expo`, исключение рискует сломать загрузку
   картинок. Проверять на Фазе 5, после замера размера.

## Окружение (локальные особенности)

- **npm нет в `/usr/bin`** — только в `~/.nvm/versions/node/v22.19.0/bin`. Без `export PATH`
  любая команда с `npm`/`npx` упадёт.
- **`ANDROID_HOME` не задан** → путь прописан в `android/local.properties` (`sdk.dir=...`).
  Файл в gitignore-каталоге `/android`, поэтому **после каждого `expo prebuild` его нужно
  создавать заново**, иначе Gradle не найдёт SDK.
- Android SDK: `~/Android/Sdk`, платформы `android-35`/`android-36`, build-tools `36.0.0`.
  Этого достаточно: каталог версий Expo читает `react-native/gradle/libs.versions.toml`,
  где `compileSdk=36`, `targetSdk=36`, `buildTools=36.0.0`, `minSdk=24` — доустановка SDK 37
  не нужна.
- JDK 17 (`openjdk 17.0.20.1`).
- `expo install` сам дописывает плагины в `app.json`, а `prebuild` переписывает скрипты
  `android`/`ios` на `expo run:android` / `expo run:ios` — это нормально для prebuild-проекта.
