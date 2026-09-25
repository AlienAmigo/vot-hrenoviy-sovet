# vot-hrenoviy-sovet

Android-приложение с советами с сайта [fucking-great-advice.ru](https://fucking-great-advice.ru).
React Native + TypeScript + Expo SDK 57.

## Стек

| Что | Зачем |
|---|---|
| Expo SDK 57 (`expo ~57.0.25`, RN `0.86.3`, React `19.2.3`) | prebuild/CNG, config plugins, EAS |
| Шаблон `blank-typescript` | **без `expo-router`** — он тянет ~6.2 МБ и 2459 файлов плюс `reanimated`/`gesture-handler`/`screens`, а экран пока один |
| `fetch` из коробки | без `axios` — в бандле разница нулевая |
| Без навигации | 1 экран, `expo-router`/React Navigation не подключены |

Используемые зависимости: `expo`, `expo-build-properties`, `expo-status-bar`, `react`, `react-native`.
Dev: `typescript`, `@types/react`.

## Команды

```bash
# Node 22 через nvm (npm нет в /usr/bin — обязательно поднять PATH)
export PATH="$HOME/.nvm/versions/node/v22.19.0/bin:$PATH"

npm install          # установка зависимостей
npm run typecheck    # tsc --noEmit
npm run check:api    # живая проверка API + юнит-проверки парсера
npm start            # expo start
npm run android      # expo run:android (нужен prebuild)
npx expo prebuild --platform android   # сгенерировать ./android заново
```

## Требования к окружению

- **Node 22** (нужен `^20.19.4 || ^22.13.0 || ^24.3.0 || >=25`; v18 из nvm **не подходит**)
- **JDK 17** — установлен (`openjdk 17.0.20.1`)
- **Android SDK** — `~/Android/Sdk`, платформы `android-35`/`android-36`, build-tools `36.0.0`
- `ANDROID_HOME` **не задан** → путь прописан в `android/local.properties` (`sdk.dir=...`).
  Файл находится внутри gitignore-каталога `/android`, поэтому при первом prebuild его нужно создать заново.

## Данные API (живая проверка 2026-09-25)

Реальность расходится с ТЗ — это учтено в `src/api/advice.ts`:

| Эндпоинт | Результат |
|---|---|
| `GET /api/random` | ✅ 200, JSON-**объект** `{"id":25852,"text":"...","sound":""}` |
| `GET /api/latest` | ✅ 200, JSON-**объект** |
| `GET /api/latest/5` | ❌ 404, тело — HTML-страница Yii2 |
| `GET /api/random/censored/` | ❌ 301 → 404 |
| `GET /api/random_by_tag/<tag>` | ❌ 404 |

Следствия:

1. **Тип ответа — объект, а не массив.** Массив тоже парсим (на случай починки API).
2. **Обязательна проверка `content-type`**, иначе `response.json()` бросит исключение на HTML-404.
3. **Истории на сервере нет** (`/api/latest/N` мёртв) → «свайп назад» возможен только через локальный кэш.
4. **Теги и цензурная версия недоступны** — вынесены за рамки первой версии.
5. **`Cache-Control: no-store`** — кэшировать на уровне HTTP нечего, каждый запрос идёт в origin.
6. **Только HTTPS** — Android 9+ блокирует cleartext-трафик по умолчанию.

## Компактность сборки

Включено через `expo-build-properties` в `app.json`:

- `android.enableMinifyInReleaseBuilds: true` → R8/ProGuard
- `android.enableShrinkResourcesInReleaseBuilds: true` → удаление неиспользуемых ресурсов
  (плагин требует включённого `enableMinifyInReleaseBuilds`, иначе prebuild падает)
- `enablePngCrunchInReleaseBuilds` — `true` и так по умолчанию

Дополнительно: Hermes включён (`hermesEnabled=true`).

Замер размера делается на **Фазе 5** (`./gradlew bundleRelease` + `du`). Рычаги, если размер
не устроит: `expo.autolinking.exclude`, `reactNativeArchitectures=arm64-v8a`, отключение `expo-updates`.

**Решение: `expo-updates` не подключаем** — в шаблонах SDK 57 его нет, EAS Build и публикация
без него работают штатно. OTA можно добавить позже одним коммитом.

## Что сделано / что дальше

Фаза 0 (каркас) — готово:

- [x] `create-expo-app --template blank-typescript`
- [x] `.gitignore` (+ `.idea/`), `android/`, `ios/`, `.expo/` игнорируются
- [x] `app.json`: `scheme: votadvice`, `android.package: ru.vot.advice`, `versionCode: 1`
- [x] `expo-build-properties` с R8 + shrinkResources
- [x] `src/api/advice.ts` — HTTP-слой с валидацией и обработкой ошибок
- [x] `npm run typecheck` — без ошибок
- [x] `npm run check:api` — 21 проверка, включая живые запросы
- [x] `npx expo prebuild --platform android` — конфиг валиден

Дальше:

- [ ] **Фаза 2** — главный экран: свайп истории, тап = новый совет, pull-to-refresh, шаринг
- [ ] **Фаза 3** — виджет (решение по варианту пока не принято)
- [ ] **Фаза 5** — сборка release, замер размера
- [ ] **Фаза 6** — метаданные, иконки, публикация (контент/рейтинг — отложено)

### Доступность репозитория

`android.package` (`ru.vot.advice`) и `scheme` (`votadvice`) можно менять **до первого релиза** —
от пакета зависит FQCN виджета, менять его после публикации больно.
Название в лаунчере (`name` в `app.json`) пока шаблонное — это продуктовое решение.
