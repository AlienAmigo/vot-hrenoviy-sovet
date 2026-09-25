/**
 * HTTP-слой для публичного API fucking-great-advice.ru.
 *
 * НАБЛЮДЕНИЯ (живая проверка 2026-09-25), которые расходятся с ТЗ:
 *  - GET /api/random  -> 200, JSON-ОБЪЕКТ, а не массив: {"id":25852,"text":"...","sound":""}
 *  - GET /api/latest  -> 200, JSON-ОБЪЕКТ
 *  - GET /api/latest/5            -> 404, тело — HTML-страница Yii2
 *  - GET /api/random/censored/    -> 301 -> /api/random/censored -> 404 (HTML)
 *  - GET /api/random_by_tag/<tag> -> 404 (HTML)
 *  - заголовок ответа: Cache-Control: no-store, no-cache, must-revalidate — кэшировать нечего
 *
 * Отсюда следует три требования, реализованные ниже:
 *  1. тип ответа — объект, но парсим и массив (на случай, если API починят);
 *  2. обязательно проверяем `content-type`, иначе response.json() бросит исключение на HTML;
 *  3. только HTTPS — Android 9+ блокирует cleartext-трафик по умолчанию.
 */

/** Адрес API. Только HTTPS. */
export const API_BASE_URL = 'https://fucking-great-advice.ru/api';

/** Таймаут одного запроса, мс. */
export const REQUEST_TIMEOUT_MS = 8000;

/** Сущность совета. Поле `sound` есть в реальном ответе, но в документации ТЗ его нет. */
export interface Advice {
  readonly id: number;
  readonly text: string;
  readonly sound?: string;
}

/** Эндпоинты, которые реально работают. */
export type AdviceEndpoint = 'random' | 'latest';

/** Ошибка любого уровня: сеть, таймаут, HTTP-статус, не-JSON, неверная структура. */
export class AdviceApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AdviceApiError';
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/** Валидирует форму одного совета. */
export function isAdvice(value: unknown): value is Advice {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'number' && typeof value.text === 'string' && value.text.length > 0;
}

/**
 * Разбирает полезную нагрузку API: принимает и объект, и массив (берёт первый элемент).
 * Бросает AdviceApiError, если структура не соответствует ожидаемой.
 */
export function parseAdvice(payload: unknown): Advice {
  const candidate: unknown = Array.isArray(payload) ? payload[0] : payload;

  if (!isAdvice(candidate)) {
    throw new AdviceApiError('Неожиданная структура ответа API');
  }

  const { id, text, sound } = candidate;
  return typeof sound === 'string' ? { id, text, sound } : { id, text };
}

/**
 * Универсальный запрос с одинаковыми guard'ами.
 * `path` — путь относительно API_BASE_URL, например 'random' или 'latest/5'.
 */
export async function fetchAdviceByPath(
  path: string,
  externalSignal?: AbortSignal,
): Promise<Advice> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const relayAbort = (): void => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', relayAbort);
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}/${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AdviceApiError(`API вернул HTTP ${response.status}`, response.status);
    }

    // На мёртвых роутах сервер отдаёт HTML-страницу ошибки с кодом 404, а не JSON.
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new AdviceApiError(
        `API вернул не JSON (content-type: ${contentType || 'отсутствует'})`,
        response.status,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AdviceApiError('Не удалось разобрать JSON-ответ', response.status);
    }

    return parseAdvice(payload);
  } catch (error) {
    if (error instanceof AdviceApiError) {
      throw error;
    }
    if (isAbortError(error)) {
      throw new AdviceApiError(
        externalSignal?.aborted
          ? 'Запрос отменён'
          : `Таймаут запроса (${REQUEST_TIMEOUT_MS} мс)`,
      );
    }
    throw new AdviceApiError(error instanceof Error ? error.message : 'Сетевая ошибка');
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', relayAbort);
  }
}

/** Запрос к произвольному эндпоинту API. */
export function fetchAdvice(
  endpoint: AdviceEndpoint,
  signal?: AbortSignal,
): Promise<Advice> {
  return fetchAdviceByPath(endpoint, signal);
}

/** Случайный совет. */
export function fetchRandomAdvice(signal?: AbortSignal): Promise<Advice> {
  return fetchAdvice('random', signal);
}

/** Сегодняшний (последний добавленный) совет. */
export function fetchLatestAdvice(signal?: AbortSignal): Promise<Advice> {
  return fetchAdvice('latest', signal);
}