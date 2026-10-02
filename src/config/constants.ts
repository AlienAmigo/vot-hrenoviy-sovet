/** Адрес API (v2). Только HTTPS. */
export const API_BASE_URL = 'https://fucking-great-advice.ru/api/v2';

/** Таймаут одного запроса, мс. */
export const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Потолок выборки за один запрос. Сервер не отдаёт больше ~40 советов даже при limit=1000,
 * поэтому большие значения урезаются локально.
 */
export const MAX_BATCH_SIZE = 40;

/** Длительность анимации свайпа, мс. */
export const SWIPE_ANIMATION_DURATION = 300;

/** Порог сдвига (px), после которого свайп считается совершённым. */
export const SWIPE_THRESHOLD = 100;

/** Дистанция вылета карточки за экран при свайпе, px. */
export const SWIPE_DISTANCE = 500;

/** Длительность возврата карточки в исходное положение, мс. */
export const SWIPE_ROLLBACK_DURATION = 200;
