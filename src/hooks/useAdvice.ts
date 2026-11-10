import { useState, useEffect, useCallback, useMemo } from 'react';
import { Image } from 'react-native';
import { fetchAdvices, fetchTags, fetchDefaultBgImages } from '@api/advice';
import { resolveAdviceImage } from '@utils/resolveAdviceImage';
import type { Advice, AdviceTag } from '@types';

interface UseAdviceResult {
  advice: Advice | null;
  loading: boolean;
  error: string | null;
  fetchNewAdvice: () => Promise<void>;
  backgroundImageUrl: string | undefined;
  backgroundColor: string | undefined;
}

export const useAdvice = (): UseAdviceResult => {
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<readonly AdviceTag[]>([]);
  const [defaultImages, setDefaultImages] = useState<readonly string[]>([]);

  // Вычисляем фон для текущего совета.
  const { backgroundImageUrl, backgroundColor } = useMemo(() => {
    if (!advice) {
      return { backgroundImageUrl: undefined, backgroundColor: undefined };
    }
    const result = resolveAdviceImage(advice, tags, defaultImages);
    console.log('result', result);
    return {
      backgroundImageUrl: result.imageUrl,
      backgroundColor: result.backgroundColor,
    };
  }, [advice, tags, defaultImages]);

  const fetchNewAdvice = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const advices = await fetchAdvices({ limit: 1 });
      const first = advices[0];
      if (first !== undefined) {
        setAdvice(first);
        // Предзагрузка изображения только что полученного совета.
        const { imageUrl } = resolveAdviceImage(first, tags, defaultImages);
        if (imageUrl && imageUrl.startsWith('https://')) {
          void Image.prefetch(imageUrl).catch(() => {
            // Prefetch не критичен для работы приложения.
          });
        }
      } else {
        setError('Не удалось получить совет');
        setAdvice(null);
      }
    } catch (err) {
      console.error('Ошибка при получении совета:', err);
      setError('Ошибка загрузки совета');
      setAdvice(null);
    } finally {
      setLoading(false);
    }
  }, [tags, defaultImages]);

  // Загружаем теги, default-фоновые изображения и первый совет при инициализации.
  // Все обновления состояния происходят после await — лайнт-правило
  // react-hooks/set-state-in-effect не срабатывает.
  useEffect(() => {
    let mounted = true;

    const init = async (): Promise<void> => {
      // Теги и default-фон загружаем параллельно; сбой одного из них не должен
      // блокировать другой и показ совета.
      let fetchedTags: readonly AdviceTag[] = [];
      let fetchedImages: readonly string[] = [];

      const [tagsResult, imagesResult] = await Promise.allSettled([
        fetchTags(),
        fetchDefaultBgImages(),
      ]);

      if (tagsResult.status === 'fulfilled') {
        fetchedTags = tagsResult.value;
      } else {
        console.error('Ошибка при загрузке тегов:', tagsResult.reason);
      }
      if (imagesResult.status === 'fulfilled') {
        fetchedImages = imagesResult.value;
      } else {
        console.error(
          'Ошибка при загрузке фоновых изображений:',
          imagesResult.reason,
        );
      }

      if (!mounted) return;
      setTags(fetchedTags);
      setDefaultImages(fetchedImages);

      try {
        const advices = await fetchAdvices({ limit: 1 });
        if (!mounted) return;
        const first = advices[0];
        if (first !== undefined) {
          setAdvice(first);
          const { imageUrl } = resolveAdviceImage(
            first,
            fetchedTags,
            fetchedImages,
          );
          if (imageUrl && imageUrl.startsWith('https://')) {
            void Image.prefetch(imageUrl).catch(() => {
              // Prefetch не критичен для работы приложения.
            });
          }
        } else {
          setError('Не удалось получить совет');
          setAdvice(null);
        }
      } catch (err) {
        console.error('Ошибка при получении совета:', err);
        setError('Ошибка загрузки совета');
        setAdvice(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    advice,
    loading,
    error,
    fetchNewAdvice,
    backgroundImageUrl,
    backgroundColor,
  };
};
