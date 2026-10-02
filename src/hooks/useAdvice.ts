import { useState, useEffect, useCallback } from 'react';
import { fetchAdvices } from '@api/advice';
import type { Advice } from '@types';

interface UseAdviceResult {
  advice: Advice | null;
  loading: boolean;
  error: string | null;
  fetchNewAdvice: () => Promise<void>;
}

export const useAdvice = (): UseAdviceResult => {
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNewAdvice = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const advices = await fetchAdvices({ limit: 1 });
      const first = advices[0];
      if (first !== undefined) {
        setAdvice(first);
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
  }, []);

  // Загружаем первый совет при инициализации
  useEffect(() => {
    const loadInitialAdvice = async () => {
      await fetchNewAdvice();
    };

    loadInitialAdvice();
  }, [fetchNewAdvice]);

  return { advice, loading, error, fetchNewAdvice };
};
