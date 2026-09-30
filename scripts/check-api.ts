/**
 * Живая проверка API-слоя (эндпоинты v2): чистые проверки разбора конверта, локальная
 * валидация параметров, реальные запросы к fucking-great-advice.ru и «сырые» факты сервера.
 *
 * Запуск: npm run check:api
 * Выход с ненулевым кодом, если хоть одна проверка упала.
 */

import {
  AdviceApiError,
  API_BASE_URL,
  MAX_BATCH_SIZE,
  fetchAdviceById,
  fetchAdvices,
  fetchLatestAdvice,
  fetchTags,
  htmlToText,
  isAdvice,
  parseAdvice,
  parseAdviceList,
} from '../src/api/advice.ts';

/** Хост сайта: нужен для «сырых» проверок мимо модуля. */
const HOST = 'https://fucking-great-advice.ru';

let failures = 0;

const assert = (condition: boolean, label: string): void => {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}`);
  }
};

/** Проверяет, что вызов падает AdviceApiError, и возвращает текст ошибки для доп. проверок. */
const expectApiError = async (
  call: () => Promise<unknown>,
  label: string,
): Promise<string | undefined> => {
  try {
    await call();
    failures += 1;
    console.error(`  FAIL ${label} — ожидалась ошибка, но запрос прошёл`);
    return undefined;
  } catch (error) {
    if (!(error instanceof AdviceApiError)) {
      failures += 1;
      console.error(`  FAIL ${label} — получен не AdviceApiError: ${String(error)}`);
      return undefined;
    }
    console.log(`  ok   ${label} (${error.message})`);
    return error.message;
  }
};

const section = (title: string): void => {
  console.log(`\n${title}`);
};

/** Ответ «сырого» запроса мимо модуля. */
interface RawResponse {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
  readonly headers: Headers;
}

const rawOnce = async (path: string): Promise<RawResponse> => {
  const response = await fetch(`${HOST}${path}`, { headers: { Accept: 'application/json' } });
  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    body: await response.text(),
    headers: response.headers,
  };
};

/**
 * «Сырой» GET: фиксируем поведение сервера, а не нашего кода.
 * Живые ручки сегодня заметно флапают 500/HTML (наблюдалось 2026-09-30) — до 3 попыток с паузой.
 */
const rawGet = async (path: string): Promise<RawResponse> => {
  let last = await rawOnce(path);
  for (let attempt = 0; attempt < 2 && last.status === 500; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    last = await rawOnce(path);
  }
  return last;
};

/**
 * Живой вызов модуля с повторами: сервер флапает 500/HTML, а проверяем мы контракт API,
 * а не доступность сервера. Настоящую поломку повтор не скрывает — она воспроизводится.
 */
const live = async <T>(call: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof AdviceApiError)) {
        throw error;
      }
      const flaky =
        error.status === 500 ||
        error.message.includes('не JSON') ||
        error.message.includes('Не удалось разобрать JSON');
      if (!flaky) {
        throw error;
      }
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw lastError;
};

const main = async (): Promise<void> => {
  section('Чистые проверки разбора конверта v2');

  const singleEnvelope = {
    status: 'success',
    errors: [],
    data: {
      id: 26385,
      text: 'Переверни блять календарь!',
      html: 'Переверни<br>блять<br>календарь!',
      tags: ['life'],
      conclusions: [],
    },
  };
  const parsedSingle = parseAdvice(singleEnvelope);
  assert(parsedSingle.id === 26385, 'data-объект (latest) разбирается в Advice');
  assert(parsedSingle.text.length > 0, 'обязательные поля на месте');
  assert(parsedSingle.html === 'Переверни<br>блять<br>календарь!', 'html сохраняется');
  assert(parsedSingle.tags?.length === 1, 'tags сохраняются');

  const listEnvelope = {
    status: 'success',
    errors: [],
    data: [
      { id: 1, text: 'Первый', tags: ['life'] },
      { id: 2, text: 'Второй' },
    ],
  };
  assert(
    parseAdviceList(listEnvelope).length === 2,
    'data-массив (random-advices) разбирается в список',
  );
  assert(
    parseAdviceList({ status: 'success', errors: [], data: [] }).length === 0,
    'пустой список допустим',
  );

  const withJunk = parseAdvice({
    status: 'success',
    errors: [],
    data: {
      id: 5,
      text: 'Мусор в опциональных полях',
      html: 42,
      tags: 'life',
      conclusions: ['не объект', { id: 1, text: 'нормальное продолжение' }],
    },
  });
  assert(withJunk.html === undefined, 'нестроковый html отбрасывается');
  assert(withJunk.tags === undefined, 'нестроковый tags отбрасывается');
  assert(withJunk.conclusions?.length === 1, 'в conclusions остаётся только валидный элемент');
  const errorText = await expectApiError(
    async () => parseAdvice({ status: 'error', errors: ['No advices'] }),
    'конверт со status:"error" даёт AdviceApiError',
  );
  assert(errorText?.includes('No advices') === true, 'в тексте ошибки видно причину от сервера');

  await expectApiError(
    async () => parseAdvice({ status: 'success', errors: [], data: null }),
    'null вместо data отклоняется',
  );
  await expectApiError(
    async () => parseAdviceList({ status: 'success', errors: [], data: { id: 1, text: 'объект' } }),
    'объект вместо массива у random-advices отклоняется',
  );
  await expectApiError(
    async () => parseAdvice('просто строка'),
    'строка вместо конверта отклоняется',
  );
  await expectApiError(
    async () => parseAdviceList([{ id: 1, text: 'голый массив' }]),
    'массив без конверта отклоняется',
  );

  const invalidAdvices: [unknown, string][] = [
    [{ id: 1, text: '' }, 'пустой text отклоняется'],
    [{ text: 'нет id' }, 'отсутствие id отклоняется'],
    [{ id: '1', text: 'id-строка' }, 'строковый id отклоняется'],
    [{ id: 1 }, 'отсутствие text отклоняется'],
    ['просто строка', 'строка вместо совета отклоняется'],
    [null, 'null вместо совета отклоняется'],
  ];

  for (const [candidate, label] of invalidAdvices) {
    let threw = false;
    try {
      parseAdviceList({ status: 'success', errors: [], data: [candidate] });
    } catch (error) {
      threw = error instanceof AdviceApiError;
    }
    assert(threw, label);
  }

  assert(isAdvice({ id: 1, text: 'ок' }), 'isAdvice принимает валидный объект');
  assert(!isAdvice({}), 'isAdvice отклоняет пустой объект');

  assert(
    htmlToText('Разреши<br>блять<br>себе<br>отдохнуть!') === 'Разреши\nблять\nсебе\nотдохнуть!',
    'htmlToText: <br> -> перевод строки',
  );
  assert(
    htmlToText('Умей<br/>блять заткнуться!') === 'Умей\nблять заткнуться!',
    'htmlToText: <br/> тоже',
  );
  assert(
    htmlToText('<span class="heighten">делай<br>в&nbsp;одиночку!</span>') === 'делай\nв одиночку!',
    'htmlToText: теги снимаются, &nbsp; -> пробел',
  );
  assert(
    htmlToText('Хуй с ним, делай в одиночку!') === 'Хуй с ним, делай в одиночку!',
    'htmlToText: чистый текст не меняется',
  );

  section('Локальная валидация параметров (без сети)');

  await expectApiError(async () => fetchAdvices({ limit: 0 }), 'limit=0 отклоняется до запроса');
  await expectApiError(async () => fetchAdvices({ limit: 2.5 }), 'дробный limit отклоняется');
  await expectApiError(
    async () => fetchAdvices({ startID: -1 }),
    'отрицательный startID отклоняется',
  );
  await expectApiError(async () => fetchAdviceById(0), 'fetchAdviceById(0) отклоняется до запроса');
  await expectApiError(async () => fetchAdviceById(1.5), 'дробный id отклоняется');
  section('Живые запросы к API');

  console.log(`  базовый адрес: ${API_BASE_URL}`);
  assert(API_BASE_URL === 'https://fucking-great-advice.ru/api/v2', 'только HTTPS, версия v2');

  const batch = await live(() => fetchAdvices());
  assert(batch.length > 0, `random-advices -> ${batch.length} советов`);
  assert(batch.length <= MAX_BATCH_SIZE, `батч не больше ${MAX_BATCH_SIZE}`);
  const batchIds = batch.map((advice) => advice.id);
  assert(new Set(batchIds).size === batchIds.length, 'внутри батча нет повторов id');
  assert(
    batch.every((advice) => typeof advice.html === 'string' && advice.html.length > 0),
    'у каждого совета непустой html',
  );
  assert(
    batch.every((advice) => Array.isArray(advice.tags)),
    'у каждого совета есть tags',
  );
  const firstAdvice = batch[0];
  if (firstAdvice !== undefined) {
    assert(firstAdvice.text.length > 0, 'text непустой');
    console.log(`        #${firstAdvice.id} text: ${firstAdvice.text}`);
    if (typeof firstAdvice.html === 'string') {
      console.log(`        html -> text: ${htmlToText(firstAdvice.html)}`);
    }
  }

  const limited = await live(() => fetchAdvices({ limit: 3 }));
  assert(limited.length > 0 && limited.length <= 3, `limit=3 -> ${limited.length} советов`);

  const clamped = await live(() => fetchAdvices({ limit: 1000 }));
  assert(
    clamped.length <= MAX_BATCH_SIZE,
    `limit=1000 урезан -> ${clamped.length} (<= ${MAX_BATCH_SIZE})`,
  );

  const startId = 25852;
  const fromStart = await live(() => fetchAdvices({ limit: 5, startID: startId }));
  assert(fromStart[0]?.id === startId, `startID=${startId} -> этот совет идёт первым`);
  assert(fromStart.length > 1, 'к startID добавляются случайные советы');

  const byId = await live(() => fetchAdviceById(26385));
  assert(byId.id === 26385, 'fetchAdviceById -> нужный совет');
  console.log(`        text: ${byId.text}`);
  const notFound = await expectApiError(
    () => live(() => fetchAdviceById(999999)),
    'несуществующий id -> ошибка',
  );
  assert(notFound === 'Совет #999999 не найден', 'ошибка про отсутствующий совет, а не сетевая');

  const tagged = await live(() => fetchAdvices({ tag: 'life', limit: 8 }));
  assert(tagged.length > 0, `by-tag life -> ${tagged.length} советов`);
  assert(
    tagged.every((advice) => (advice.tags ?? []).includes('life')),
    'все советы действительно с тегом life',
  );
  await expectApiError(
    () => live(() => fetchAdvices({ tag: 'nosuchtag' })),
    'неизвестный тег -> ошибка "No advices"',
  );

  const blankTag = await live(() => fetchAdvices({ tag: '   ', limit: 2 }));
  assert(blankTag.length > 0, 'пустой tag игнорируется (обычный батч)');

  const latest = await live(() => fetchLatestAdvice());
  assert(latest.id > 0, `latest -> id=${latest.id}`);
  assert(latest.text.length > 0, 'latest -> text непустой');
  assert(typeof latest.html === 'string', 'latest -> html есть');
  console.log(`        text: ${latest.text}`);

  const tags = await live(() => fetchTags());
  assert(tags.length >= 15, `tags -> ${tags.length} тегов`);
  assert(
    tags.every((tag) => tag.alias.length > 0 && tag.name.length > 0),
    'у каждого тега непустые alias и name',
  );
  assert(
    tags.some((tag) => typeof tag.isDefault === 'boolean'),
    'isDefault (в ответе 0/1) приведён к boolean',
  );
  const lifeTag = tags.find((tag) => tag.alias === 'life');
  assert(
    lifeTag !== undefined && lifeTag.name === 'за жизнь',
    'tags -> у life есть человекочитаемое имя',
  );
  section('Сырые факты сервера (мимо модуля: документация сайта устарела)');

  const deadPaths = [
    '/api/latest/5',
    '/api/random/censored',
    `/api/random_by_tag/${encodeURIComponent('дизайн')}`,
  ];
  for (const deadPath of deadPaths) {
    const raw = await rawGet(deadPath);
    assert(
      raw.status === 404 && raw.contentType.includes('text/html'),
      `${deadPath} -> 404 + HTML (мёртвая ручка из старой документации)`,
    );
  }

  const noTag = await rawGet('/api/v2/random-advices-by-tag');
  assert(noTag.status === 400, 'by-tag без параметра tag -> HTTP 400');

  const zeroLimit = await rawGet('/api/v2/random-advices?limit=0');
  assert(
    zeroLimit.status === 200 && zeroLimit.body.includes('No advices'),
    'limit=0 -> HTTP 200 с status:"error" (ошибку не видно по коду ответа)',
  );

  const legacy = await rawGet('/api/random');
  let legacyAdvice = false;
  try {
    legacyAdvice = isAdvice(JSON.parse(legacy.body));
  } catch {
    legacyAdvice = false;
  }
  if (legacy.status !== 200 || !legacyAdvice) {
    // Сервер изредка флапает (500/HTML) — тогда видно, что именно пришло.
    console.log(`        ответ сервера: HTTP ${legacy.status}, тело: ${legacy.body.slice(0, 80)}`);
  }
  assert(legacy.status === 200, 'v1 /api/random отвечает 200 (легаси ещё жив)');
  assert(legacyAdvice, 'v1 /api/random отдаёт JSON-объект совета');

  const v2Response = await rawGet('/api/v2/random-advices?limit=1');
  assert(
    (v2Response.headers.get('cache-control') ?? '').includes('no-store'),
    'Cache-Control: no-store — кэшировать на уровне HTTP нечего',
  );

  section('Итог');

  if (failures > 0) {
    throw new Error(`Провалено проверок: ${failures}`);
  }
  console.log('  Все проверки пройдены.');
};

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  console.error('Проверка API провалена.');
  throw error;
});
