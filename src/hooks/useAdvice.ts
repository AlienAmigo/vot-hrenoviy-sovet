import { useState, useEffect } from 'react';
import { fetchAdvices } from '@api/advice';

interface UseAdviceResult {
  advice: any | null;
  loading: boolean;
  error: string | null;
  fetchNewAdvice: () => Promise<void>;
}

export const useAdvice = (): UseAdviceResult => {
  const [advice, setAdvice] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNewAdvice = async () => {
    try {
      setLoading(true);
      setError(null);
      const advices = await fetchAdvices({ limit: 1 });
      if (advices.length > 0) {
        setAdvice(advices[0]);
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
  };

  // Загружаем первый совет при инициализации
  useEffect(() => {
    fetchNewAdvice();
  }, []);

  return { advice, loading, error, fetchNewAdvice };
};
