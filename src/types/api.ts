/** Продолжение совета: тот же id, но свой html (на сайте это следующая «страница»). */
export interface AdviceConclusion {
  readonly id: number;
  readonly text: string;
  readonly html?: string;
}

/** Совет. `text` — плоский текст, `html` — разметка сайта (<br>, <span class="heighten">). */
export interface Advice {
  readonly id: number;
  readonly text: string;
  readonly html?: string;
  readonly tags?: readonly string[];
  readonly conclusions?: readonly AdviceConclusion[];
}

/** Тег из /api/v2/tags. `alias` — то, что передаётся в query `tag`. */
export interface AdviceTag {
  readonly id: number;
  readonly name: string;
  readonly alias: string;
  readonly title?: string;
  /** В ответе сервера приходит числом 0/1, здесь приведён к boolean. */
  readonly isDefault?: boolean;
  readonly images?: readonly string[];
  readonly advicesCount?: number;
}

/** Параметры выборки советов. */
export interface AdviceQuery {
  /** Верхняя граница размера батча; сервер вправе вернуть меньше. */
  readonly limit?: number;
  /** Совет, который должен идти первым в батче. */
  readonly startID?: number;
  /** Alias тега; пустая строка игнорируется. */
  readonly tag?: string;
}

/** Обязательные поля тега; остальные читаются как unknown. */
export interface RawTagFields extends Record<string, unknown> {
  readonly id: number;
  readonly name: string;
  readonly alias: string;
}
