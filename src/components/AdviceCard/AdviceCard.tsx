import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useAdvice } from '@hooks/useAdvice';
import { SWIPE_ANIMATION_DURATION } from '@config/constants';

interface AdviceCardProps {
  backgroundImageUrl?: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onAdviceTap?: () => void;
}

const AdviceCard: React.FC<AdviceCardProps> = ({
  backgroundImageUrl,
  onSwipeLeft,
  onSwipeRight,
  onAdviceTap,
}) => {
  const { advice, isLoading, error, fetchNewAdvice } = useAdvice();
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(
    null,
  );

  // Обработка свайпа
  const handleSwipe = (direction: 'left' | 'right') => {
    setSwipeDirection(direction);
    setIsSwiping(true);

    // После анимации свайпа вызываем обработчик и получаем новый совет
    setTimeout(() => {
      if (direction === 'left' && onSwipeLeft) {
        onSwipeLeft();
      } else if (direction === 'right' && onSwipeRight) {
        onSwipeRight();
      }

      // Получаем новый совет после свайпа
      fetchNewAdvice();

      setIsSwiping(false);
      setSwipeDirection(null);
    }, SWIPE_ANIMATION_DURATION); // Длительность анимации свайпа из констант
  };

  // Отображение состояния загрузки
  if (isLoading) {
    return (
      <View style={styles.container}>
        {/* Фоновое изображение */}
        {backgroundImageUrl ? (
          <Image
            source={{ uri: backgroundImageUrl }}
            style={styles.backgroundImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.defaultBackground} />
        )}

        {/* Контент карточки */}
        <View
          style={[
            styles.cardContent,
            isSwiping && swipeDirection === 'left'
              ? styles.swipeLeft
              : isSwiping && swipeDirection === 'right'
                ? styles.swipeRight
                : {},
          ]}
        >
          <Text style={styles.adviceText}>Загрузка совета...</Text>
        </View>
      </View>
    );
  }

  // Отображение ошибки
  if (error) {
    return (
      <View style={styles.container}>
        {/* Фоновое изображение */}
        {backgroundImageUrl ? (
          <Image
            source={{ uri: backgroundImageUrl }}
            style={styles.backgroundImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.defaultBackground} />
        )}

        {/* Контент карточки */}
        <View
          style={[
            styles.cardContent,
            isSwiping && swipeDirection === 'left'
              ? styles.swipeLeft
              : isSwiping && swipeDirection === 'right'
                ? styles.swipeRight
                : {},
          ]}
        >
          <Text style={styles.adviceText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Фоновое изображение */}
      {backgroundImageUrl ? (
        <Image
          source={{ uri: backgroundImageUrl }}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.defaultBackground} />
      )}

      {/* Контент карточки */}
      <View
        style={[
          styles.cardContent,
          isSwiping && swipeDirection === 'left'
            ? styles.swipeLeft
            : isSwiping && swipeDirection === 'right'
              ? styles.swipeRight
              : {},
        ]}
      >
        <TouchableOpacity
          style={styles.touchableArea}
          onPress={onAdviceTap}
          activeOpacity={0.8}
        >
          <Text style={styles.adviceText}>{advice}</Text>
        </TouchableOpacity>

        {/* Индикаторы свайпа (удалены, так как свайп происходит при движении пальца) */}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  defaultBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f0f0f0',
    width: '100%',
    height: '100%',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    margin: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1,
  },
  swipeLeft: {
    transform: [{ translateX: -100 }],
  },
  swipeRight: {
    transform: [{ translateX: 100 }],
  },
  touchableArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adviceText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    lineHeight: 32,
  },
});

export default AdviceCard;
