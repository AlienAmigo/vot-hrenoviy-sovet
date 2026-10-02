import { useState, useEffect } from 'react';
import { fetchAdvices, htmlToText } from '@api/advice';

interface Advice {
  id: number;
  text: string;
  html?: string;
  tags?: string[];
  conclusions?: any[];
}

export const useAdvice = () => {
  const [advice, setAdvice] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNewAdvice = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const advices = await fetchAdvices({ limit: 1 });
      if (advices.length > 0) {
        const adviceData = advices[0];
        // Применяем htmlToText для конвертации HTML в текст
        const text = adviceData?.html
          ? htmlToText(adviceData.html)
          : adviceData?.text || '';
        setAdvice(text);
      } else {
        setError('Не удалось получить совет');
        setAdvice('Не удалось получить совет');
      }
    } catch (err) {
      console.error('Ошибка при получении совета:', err);
      setError('Ошибка загрузки совета');
      setAdvice('Ошибка загрузки совета');
    } finally {
      setIsLoading(false);
    }
  };

  // Загружаем первый совет при инициализации
  useEffect(() => {
    fetchNewAdvice();
  }, []);

  return { advice, isLoading, error, fetchNewAdvice };
};
