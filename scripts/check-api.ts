/**
 * Живая проверка API-слоя: чистые юнит-проверки разбора полезной нагрузки
 * и реальные запросы к fucking-great-advice.ru (включая негативные сценарии).
 *
 * Запуск: npm run check:api
 * Выход с ненулевым кодом, если хоть одна проверка упала.
 */

import {
  AdviceApiError,
  API_BASE_URL,
  fetchAdviceByPath,
  fetchLatestAdvice,
  fetchRandomAdvice,
  isAdvice,
  parseAdvice,
} from '../src/api/advice.ts';

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}`);
  }
}

/** Проверяет, что вызов завершается AdviceApiError с ожидаемым HTTP-статусом. */
async function expectApiError(
  call: () => Promise<unknown>,
  label: string,
  expectedStatus: number,
): Promise<void> {
  try {
    await call();
    failures += 1;
    console.error(`  FAIL ${label} — ожидалась ошибка, но запрос прошёл`);
  } catch (error) {
    if (!(error instanceof AdviceApiError)) {
      failures += 1;
      console.error(`  FAIL ${label} — получен не AdviceApiError: ${String(error)}`);
      return;
    }
    const ok = error.status === expectedStatus;
    if (ok) {
      console.log(`  ok   ${label} (HTTP ${error.status})`);
    } else {
      failures += 1;
      console.error(`  FAIL ${label} — ожидали HTTP ${expectedStatus}, получили ${String(error.status)}`);
    }
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

async function main(): Promise<void> {
  section('Чистые проверки разбора полезной нагрузки');

  const objectPayload = { id: 25852, text: 'Обосрался сам — не вини других!', sound: '' };
  const parsedObject = parseAdvice(objectPayload);
  assert(parsedObject.id === 25852, 'объект разбирается в Advice');
  assert(parsedObject.sound === '', 'поле sound сохраняется, если оно есть');

  const arrayPayload = [{ id: 42, text: 'Совет из массива' }];
  assert(parseAdvice(arrayPayload).id === 42, 'массив разбирается (берётся первый элемент)');

  const withoutSound = parseAdvice({ id: 7, text: 'Без sound' });
  assert(withoutSound.sound === undefined, 'отсутствие sound допустимо');

  const invalidCases: Array<[unknown, string]> = [
    [{ id: 1, text: '' }, 'пустой text отклоняется'],
    [{ text: 'нет id' }, 'отсутствие id отклоняется'],
    [{ id: '1', text: 'id-строка' }, 'строковый id отклоняется'],
    [{ id: 1 }, 'отсутствие text отклоняется'],
    ['просто строка', 'строка вместо объекта отклоняется'],
    [null, 'null отклоняется'],
    [[], 'пустой массив отклоняется'],
  ];

  for (const entry of invalidCases) {
    const [payload, label] = entry;
    let threw = false;
    try {
      parseAdvice(payload);
    } catch (error) {
      threw = error instanceof AdviceApiError;
    }
    assert(threw, label);
  }

  assert(isAdvice(objectPayload) === true, 'isAdvice принимает валидный объект');
  assert(isAdvice({}) === false, 'isAdvice отклоняет пустой объект');

  section('Живые запросы к API');

  console.log(`  базовый адрес: ${API_BASE_URL}`);
  assert(API_BASE_URL.startsWith('https://'), 'используется только HTTPS');

  const randomAdvice = await fetchRandomAdvice();
  assert(randomAdvice.id > 0, `random -> id=${randomAdvice.id} (число > 0)`);
  assert(randomAdvice.text.length > 0, `random -> text непустой (${randomAdvice.text.length} симв.)`);
  console.log(`        text: ${randomAdvice.text}`);

  const latestAdvice = await fetchLatestAdvice();
  assert(latestAdvice.id > 0, `latest -> id=${latestAdvice.id} (число > 0)`);
  assert(latestAdvice.text.length > 0, `latest -> text непустой`);
  console.log(`        text: ${latestAdvice.text}`);

  section('Мёртвые эндпоинты из ТЗ должны падать (404, а не тихая ошибка парсинга)');

  await expectApiError(() => fetchAdviceByPath('latest/5'), '/api/latest/5', 404);
  await expectApiError(() => fetchAdviceByPath('random/censored'), '/api/random/censored', 404);
  await expectApiError(
    () => fetchAdviceByPath(`random_by_tag/${encodeURIComponent('дизайн')}`),
    '/api/random_by_tag/дизайн',
    404,
  );

  section('Итог');

  if (failures > 0) {
    throw new Error(`Провалено проверок: ${failures}`);
  }
  console.log('  Все проверки пройдены.');
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  console.error('Проверка API провалена.');
  throw error;
});