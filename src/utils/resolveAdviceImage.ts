/**
 * Разрешает фоновое изображение/цвет для совета.
 *
 * Приоритет:
 * 1. Теговая картинка — случайная из `images` одного из первых N тегов совета.
 * 2. Default-картинка — детерминированный выбор по `advice.id % defaultImages.length`.
 * 3. Цвет фона тега — `bgColor` первого тега с непустым `bgColor`.
 */

import type { Advice, AdviceTag } from '@types';

export interface ResolvedBackground {
  /** URL фонового изображения (если найден). */
  readonly imageUrl?: string;
  /** HEX-цвет фона (если картинка не найдена, но есть bgColor). */
  readonly backgroundColor?: string;
}

/**
 * Выбирает случайный элемент из массива.
 */
const randomFrom = <T>(arr: readonly T[]): T | undefined => {
  if (arr.length === 0) {
    return undefined;
  }
  return arr[Math.floor(Math.random() * arr.length)];
};

/** Проверяет, что строка — абсолютный HTTPS-URL (безопасная схема для RN Image). */
const isHttpsUrl = (value: string): boolean => value.startsWith('https://');

/**
 * Находит тег в списке по alias.
 */
const findTagByAlias = (
  alias: string,
  tags: readonly AdviceTag[],
): AdviceTag | undefined => {
  for (const tag of tags) {
    if (tag.alias === alias) {
      return tag;
    }
  }
  return undefined;
};

export const resolveAdviceImage = (
  advice: Advice,
  tags: readonly AdviceTag[],
  defaultImages: readonly string[],
): ResolvedBackground => {
  // Берём первые 3 тега совета (или меньше, если тегов меньше).
  const tagAliases = advice.tags?.slice(0, 3);
  if (tagAliases && tagAliases.length > 0) {
    // Перемешиваем копию для случайного выбора.
    const shuffled = [...tagAliases].sort(() => Math.random() - 0.5);

    for (const alias of shuffled) {
      const tag = findTagByAlias(alias, tags);
      if (tag && tag.images && tag.images.length > 0) {
        const imageUrl = randomFrom(tag.images);
        if (imageUrl && isHttpsUrl(imageUrl)) {
          return { imageUrl };
        }
      }
    }

    // Если картинок не нашли, проверяем bgColor у всех первых N тегов.
    for (const alias of shuffled) {
      const tag = findTagByAlias(alias, tags);
      if (tag && tag.bgColor) {
        return { backgroundColor: tag.bgColor };
      }
    }
  }

  // Fallback — default-картинка по детерминированному индексу.
  if (defaultImages.length > 0) {
    const index = advice.id % defaultImages.length;
    const imageUrl = defaultImages[index];
    if (imageUrl && isHttpsUrl(imageUrl)) {
      return { imageUrl };
    }
  }

  return {};
};
