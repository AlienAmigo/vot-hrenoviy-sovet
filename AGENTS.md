# AGENTS.md

Контекст для ИИ-агентов, работающих в этом репозитории. Читай перед любыми правками.

## Обзор

Android-приложение с советами с сайта fucking-great-advice.ru. React Native + TypeScript,
Expo SDK 57. Сейчас это **каркас с API-слоем**: экран пока шаблонный, виджет не реализован.

Главный критерий проекта — **минимальный размер приложения**. Любое лишнее решение по зависимостям
и фичам должно обсуждаться, а не добавляться «по умолчанию».

Дополнительно: `README.md` (подробности и обоснования), `package.json` (скрипты).

## Стек

| Компонент | Роль |
|---|---|
| Expo SDK 57 (`expo ~57.0.25`) | prebuild/CNG, config plugins |
| React Native `0.86.3`, React `19.2.3` | |
| TypeScript `~6.0.3` | `strict` + `noUncheckedIndexedAccess` |
| Шаблон `blank-typescript` | **без `expo-router`** |
| `fetch` из коробки | без HTTP-библиотек |
| `expo-build-properties ~57.0.22` | R8 + shrinkResources |

Зависимости приложения: `expo`, `expo-build-properties`, `expo-status-bar`, `react`, `react-native`.
Dev: `typescript`, `@types/react`. Больше ничего.

## Жёсткие правила

1. **Только HTTPS** в запросах. Android 9+ блокирует cleartext по умолчанию — `http://` даст
   `Network request failed`.
2. **Не добавлять зависимости без явного согласования пользователя.** Особенно критично не тянуть:
   `expo-router`, `react-navigation`, `react-native-gesture-handler`, `react-native-reanimated`,
   `axios`, хранилища (`MMKV`, `@react-native-async-storage/async-storage`), `expo-updates`.
   Причина — размер приложения. Если кажется, что библиотека нужна — сначала объясни зачем
   и предложи альтернативу без зависимости.
3. **Ответ API — объект, а не массив** (см. ниже). Не доверяй ТЗ, доверяй живому ответу.
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
npm run check:api     # 21 проверка: парсер + живые запросы к API
npm start              # expo start
npm run android        # expo run:android (нужен prebuild)
npx expo prebuild --platform android
npx expo-doctor
```

Валидация после любой правки: `npm run typecheck` && `npm run check:api`. Оба должны быть EXIT=0.

## Структура

```
app.json            # scheme, android.package, versionCode, plugins (expo-build-properties)
App.tsx             # шаблонный, UI ещё не написан
index.ts            # registerRootComponent
src/api/advice.ts   # весь HTTP-слой — единственная точка доступа к API
scripts/check-api.ts # проверки: парсер + живые запросы
assets/             # иконки, splash
android/            # сгенерировано prebuild, в git не входит
```

`src/api/advice.ts` экспортирует: `Advice`, `AdviceEndpoint`, `AdviceApiError`, `isAdvice`,
`parseAdvice`, `fetchAdvice`, `fetchAdviceByPath`, `fetchRandomAdvice`, `fetchLatestAdvice`,
`API_BASE_URL`, `REQUEST_TIMEOUT_MS`.

Ходить в сеть напрямую из компонентов нельзя — только через этот модуль.

## API — факты, проверенные вживую

Документация в ТЗ расходится с реальностью. Проверено 2026-09-25:

| Запрос | Результат |
|---|---|
| `GET /api/random` | 200, JSON-**объект** `{"id":25852,"text":"...","sound":""}` |
| `GET /api/latest` | 200, JSON-**объект** |
| `GET /api/latest/5` | 404, тело — HTML-страница Yii2 |
| `GET /api/random/censored/` | 301 → `/api/random/censored` → 404 |
| `GET /api/random_by_tag/<tag>` | 404 (HTML), и для Cyrillic, и для латиницы |

Следствия для кода:

- `type Advice = { id: number; text: string; sound?: string }`. Массив тоже парсим (на случай
  починки API), но форма по умолчанию — объект.
- `sound` присутствует в реальном ответе, в ТЗ его нет. Строку, сейчас всегда `""`.
- Работают **только `random` и `latest`**. Истории на сервере нет → «свайп назад» возможен
  только через локальный кэш, а дедуп по `id` обязателен (рандом отдаёт повторы).
- Теги и цензурная версия **недоступны** — не пытаться реализовать на их API.
- `Cache-Control: no-store, no-cache, must-revalidate` — кэшировать на уровне HTTP нечего,
  каждый запрос идёт в origin. Не делать поллинг таймером.
- Латентность ~0.15 с, auth не нужна (200 без cookies).

## Конвенции кода

- **Ошибки**: кидать только `AdviceApiError` (с HTTP-статусом, где он есть), не голый `Error`.
  `fetchAdviceByPath` оборачивает сетевые/таймаут-ошибки, валидация выполняется уже вне `catch`.
- **Не доверять форме данных**: любую нагрузку прогонять через `isAdvice`/`parseAdvice`.
- **Никаких `any`** — только `unknown` + сужение.
- Комментарии и сообщения об ошибках — на русском.
- Имена файлов: `kebab-case` для скриптов/модулей, `PascalCase` для компонентов.
- Импорты в `scripts/*.ts` — с расширением `.ts` (Node ESM требует явного пути).
  `allowImportingTsExtensions` включён в `tsconfig.json`.

## Состояние проекта

Сделано:

- [x] Фаза 0 — каркас: `create-expo-app --template blank-typescript`, `.gitignore`, `app.json`
      (scheme/package/versionCode), `expo-build-properties` с R8 + shrinkResources, README
- [x] Фаза 1 — `src/api/advice.ts` + `scripts/check-api.ts` (21 проверка)
- [x] Валидация: `tsc --noEmit` чисто, `check:api` 21/21, `expo-doctor` 21/21, `prebuild` OK

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
