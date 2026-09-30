/**
 * HTTP-слой для API fucking-great-advice.ru — только эндпоинты v2.
 *
 * Живая проверка 2026-09-30: «публичные» ручки /api/random и /api/latest (те, что
 * перечислены на странице документации самого сайта) — легаси. Они ещё отвечают, но отдают
 * меньше данных: мёртвое поле sound, без html и без тегов. Реальный сайт ходит в
 * недокументированный /api/v2/*, который и используется здесь. Отсюда правила модуля:
 *
 *  - ответ v2 — конверт {status, errors, data}; у random-advices `data` это МАССИВ советов
 *    (35-40 штук одним запросом), у latest — ОБЪЕКТ;
 *  - ошибки приходят с HTTP 200: {"status":"error","errors":["No advices"]}, поэтому
 *    проверяется поле status, а не код ответа;
 *  - работают только limit, startID и роут random-advices-by-tag?tag=<alias>; незнакомые
 *    параметры (censored, tags, count) сервер молча игнорирует;
 *  - startID — не хронология: указанный совет просто встаёт первым, остальные случайны;
 *  - цензурной версии нет ни в v1, ни в v2 — маскировка матов возможна только на клиенте;
 *  - мёртвые роуты отдают HTML (404, изредка 500), поэтому проверка content-type перед
 *    response.json() обязательна;
 *  - Cache-Control: no-store, no-cache, must-revalidate — кэшировать на уровне HTTP нечего;
 *  - только HTTPS: Android 9+ блокирует cleartext-трафик по умолчанию.
 */

import { API_BASE_URL, REQUEST_TIMEOUT_MS, MAX_BATCH_SIZE } from '@config';

/* types */
import type { AdviceConclusion, AdviceTag, AdviceQuery, Advice, RawTagFields } from '@types';

/** Ошибка любого уровня: сеть, таймаут, HTTP-статус, не-JSON, ошибка в конверте, кривая структура. */
export class AdviceApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AdviceApiError';
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

const isAbortError = (error: unknown): boolean => {
  return error instanceof Error && error.name === 'AbortError';
};

/**
 * Валидирует обязательные поля совета. Опциональные (html/tags/conclusions) проверяет
 * normalizeAdvice, иначе тип обещал бы больше, чем проверено.
 */
export const isAdvice = (value: unknown): value is Advice => {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'number' && typeof value.text === 'string' && value.text.length > 0;
};

/** Валидирует продолжение совета. */
export const isAdviceConclusion = (value: unknown): value is AdviceConclusion => {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.text === 'string' &&
    value.text.length > 0
  );
};

const isRawTag = (value: unknown): value is RawTagFields => {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.name === 'string' &&
    typeof value.alias === 'string'
  );
};

/** Копирует только известные поля: сервер может прислать и лишнее, и мусор вместо типа. */
const normalizeAdvice = (candidate: Advice): Advice => {
  const advice: {
    id: number;
    text: string;
    html?: string;
    tags?: readonly string[];
    conclusions?: readonly AdviceConclusion[];
  } = { id: candidate.id, text: candidate.text };

  if (typeof candidate.html === 'string') {
    advice.html = candidate.html;
  }
  if (Array.isArray(candidate.tags)) {
    advice.tags = candidate.tags.filter(isString);
  }
  if (Array.isArray(candidate.conclusions)) {
    advice.conclusions = candidate.conclusions.filter(isAdviceConclusion);
  }
  return advice;
};

/** Копирует известные поля тега, приводя isDefault (в ответе 0/1) к boolean. */
const toAdviceTag = (raw: RawTagFields): AdviceTag => {
  const tag: {
    id: number;
    name: string;
    alias: string;
    title?: string;
    isDefault?: boolean;
    images?: readonly string[];
    advicesCount?: number;
  } = { id: raw.id, name: raw.name, alias: raw.alias };

  if (typeof raw.title === 'string') {
    tag.title = raw.title;
  }
  if (raw.isDefault === true || raw.isDefault === 1) {
    tag.isDefault = true;
  } else if (raw.isDefault === false || raw.isDefault === 0) {
    tag.isDefault = false;
  }
  if (Array.isArray(raw.images)) {
    tag.images = raw.images.filter(isString);
  }
  if (typeof raw.advicesCount === 'number') {
    tag.advicesCount = raw.advicesCount;
  }
  return tag;
};

/**
 * Разметка сайта -> плоский текст: <br> это перевод строки, теги и HTML-сущности снимаются.
 * Нужно для React Native (он не рендерит HTML), для шаринга и для будущего виджета.
 */
export const htmlToText = (html: string): string => {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .trim();
};
/** Универсальный GET с одинаковыми guard'ами. `path` — путь относительно API_BASE_URL. */
const requestJson = async (path: string, externalSignal?: AbortSignal): Promise<unknown> => {
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
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/${path}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (error) {
      // Оборачиваем только сетевые/отменённые ошибки fetch.
      if (isAbortError(error)) {
        throw new AdviceApiError(
          externalSignal?.aborted ? 'Запрос отменён' : `Таймаут запроса (${REQUEST_TIMEOUT_MS} мс)`,
        );
      }
      throw new AdviceApiError(error instanceof Error ? error.message : 'Сетевая ошибка');
    }

    // Дальше — валидация. Мёртвые роуты отвечают HTML, поэтому content-type проверяем до json().
    if (!response.ok) {
      throw new AdviceApiError(`API вернул HTTP ${response.status}`, response.status);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new AdviceApiError(
        `API вернул не JSON (content-type: ${contentType || 'отсутствует'})`,
        response.status,
      );
    }

    try {
      return await response.json();
    } catch {
      throw new AdviceApiError('Не удалось разобрать JSON-ответ', response.status);
    }
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', relayAbort);
  }
};

/** Достаёт `data` из конверта v2; status:"error" превращает в AdviceApiError (HTTP там 200!). */
const unwrapEnvelope = (payload: unknown): unknown => {
  if (!isRecord(payload)) {
    throw new AdviceApiError('Неожиданная структура ответа API');
  }
  if (payload.status !== 'success') {
    const errors = Array.isArray(payload.errors) ? payload.errors.filter(isString) : [];
    throw new AdviceApiError(
      `API вернул ошибку${errors.length > 0 ? `: ${errors.join('; ')}` : ''}`,
    );
  }
  if (payload.data === undefined) {
    throw new AdviceApiError('В ответе API нет поля data');
  }
  return payload.data;
};
/** Разбирает конверт с одиночным советом (ручка latest). */
export const parseAdvice = (payload: unknown): Advice => {
  const candidate = unwrapEnvelope(payload);
  if (!isAdvice(candidate)) {
    throw new AdviceApiError('Неожиданная структура ответа API');
  }
  return normalizeAdvice(candidate);
};

/** Разбирает конверт со списком советов (ручка random-advices). Пустой список допустим. */
export const parseAdviceList = (payload: unknown): readonly Advice[] => {
  const data = unwrapEnvelope(payload);
  if (!Array.isArray(data)) {
    throw new AdviceApiError('Неожиданная структура ответа API');
  }

  const items: readonly unknown[] = data;
  const advices: Advice[] = [];
  for (const item of items) {
    if (!isAdvice(item)) {
      throw new AdviceApiError('Неожиданная структура ответа API');
    }
    advices.push(normalizeAdvice(item));
  }
  return advices;
};

/** Проверяет id до запроса: на мусор сервер отвечает случайным советом, а не ошибкой. */
const normalizeAdviceId = (id: number): number => {
  if (!Number.isInteger(id) || id < 1) {
    throw new AdviceApiError(`Некорректный id совета: ${String(id)}`);
  }
  return id;
};

/** Приводит limit к допустимому: целое ≥ 1 и не больше MAX_BATCH_SIZE. */
const normalizeLimit = (limit: number): number => {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new AdviceApiError(`Некорректный limit: ${String(limit)}`);
  }
  return Math.min(limit, MAX_BATCH_SIZE);
};

/**
 * Советы из v2: без параметров — случайный батч; с `tag` — случайные советы тега;
 * с `startID` — тот же батч, но первым идёт совет с этим id.
 * Точное число советов сервер не гарантирует: их всегда не больше запрошенного `limit`.
 */
export const fetchAdvices = async (
  query: AdviceQuery = {},
  signal?: AbortSignal,
): Promise<readonly Advice[]> => {
  const parts: string[] = [];
  if (query.limit !== undefined) {
    parts.push(`limit=${normalizeLimit(query.limit)}`);
  }
  if (query.startID !== undefined) {
    parts.push(`startID=${normalizeAdviceId(query.startID)}`);
  }

  const tag = typeof query.tag === 'string' ? query.tag.trim() : '';
  let path =
    tag.length > 0 ? `random-advices-by-tag?tag=${encodeURIComponent(tag)}` : 'random-advices';
  if (parts.length > 0) {
    path += `${tag.length > 0 ? '&' : '?'}${parts.join('&')}`;
  }

  return parseAdviceList(await requestJson(path, signal));
};

/**
 * Конкретный совет по id. Отдельной ручки нет: startID у random-advices ставит нужный
 * совет первым. Если первым пришёл другой совет — значит такого id в базе нет.
 */
export const fetchAdviceById = async (id: number, signal?: AbortSignal): Promise<Advice> => {
  const adviceId = normalizeAdviceId(id);
  const advices = await fetchAdvices({ limit: 1, startID: adviceId }, signal);
  const first = advices[0];
  if (first === undefined || first.id !== adviceId) {
    throw new AdviceApiError(`Совет #${adviceId} не найден`);
  }
  return first;
};

/** Последний (сегодняшний) совет. */
export const fetchLatestAdvice = async (signal?: AbortSignal): Promise<Advice> => {
  return parseAdvice(await requestJson('latest', signal));
};

/** Справочник тегов. `alias` — значение для query `tag`. */
export const fetchTags = async (signal?: AbortSignal): Promise<readonly AdviceTag[]> => {
  const data = unwrapEnvelope(await requestJson('tags', signal));
  if (!Array.isArray(data)) {
    throw new AdviceApiError('API вернул не массив тегов');
  }

  const items: readonly unknown[] = data;
  const tags: AdviceTag[] = [];
  for (const item of items) {
    if (isRawTag(item)) {
      tags.push(toAdviceTag(item));
    }
  }
  return tags;
};
