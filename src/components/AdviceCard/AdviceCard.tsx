import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Animated,
  PanResponder,
  type PanResponderGestureState,
} from 'react-native';
import { useAdvice } from '@hooks/useAdvice';
import {
  SWIPE_ANIMATION_DURATION,
  SWIPE_DISTANCE,
  SWIPE_ROLLBACK_DURATION,
  SWIPE_START_THRESHOLD,
  SWIPE_THRESHOLD,
} from '@config';
import { htmlToText } from '@api/advice';

interface AdviceCardProps {
  backgroundImageUrl?: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onAdviceTap?: () => void;
}

/**
 * Жест горизонтальный, только если сдвиг по X заметнее сдвига по Y.
 * Вертикальные жесты карточке не принадлежат: по ним ничего не происходит.
 */
const isHorizontalGesture = (gesture: PanResponderGestureState): boolean =>
  Math.abs(gesture.dx) > Math.abs(gesture.dy);

const AdviceCard: React.FC<AdviceCardProps> = ({
  backgroundImageUrl,
  onSwipeLeft,
  onSwipeRight,
  onAdviceTap,
}) => {
  const { advice, loading, error, fetchNewAdvice } = useAdvice();

  // Сдвиг карточки по X. Вращение и масштаб выводятся интерполяцией.
  const translateX = useMemo(() => new Animated.Value(0), []);

  // Возврат карточки в исходное положение (свайп не дотянули).
  const resetPosition = useCallback(() => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: SWIPE_ROLLBACK_DURATION,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  // Досвипывание за экран, затем сброс позиции и подгрузка нового совета.
  const completeSwipe = useCallback(
    (direction: 'left' | 'right') => {
      const target = direction === 'right' ? SWIPE_DISTANCE : -SWIPE_DISTANCE;

      Animated.timing(translateX, {
        toValue: target,
        duration: SWIPE_ANIMATION_DURATION,
        useNativeDriver: true,
      }).start(() => {
        translateX.setValue(0);
        if (direction === 'left') {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
        void fetchNewAdvice();
      });
    },
    [translateX, onSwipeLeft, onSwipeRight, fetchNewAdvice],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Тап и вертикальные жесты карточке не принадлежат: тап уходит
        // в TouchableOpacity, вертикальное движение — выше по дереву.
        onStartShouldSetPanResponder: () => false,
        // Движение перехватываем только на заметном горизонтальном сдвиге.
        onMoveShouldSetPanResponder: (_event, gesture) =>
          isHorizontalGesture(gesture) &&
          Math.abs(gesture.dx) > SWIPE_START_THRESHOLD,
        onPanResponderMove: (_event, gesture) => {
          // Вертикальную составляющую игнорируем: карточка едет только по X.
          if (isHorizontalGesture(gesture)) {
            translateX.setValue(gesture.dx);
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          if (
            isHorizontalGesture(gesture) &&
            Math.abs(gesture.dx) > SWIPE_THRESHOLD
          ) {
            completeSwipe(gesture.dx > 0 ? 'right' : 'left');
          } else {
            resetPosition();
          }
        },
        onPanResponderTerminate: resetPosition,
      }),
    [completeSwipe, resetPosition, translateX],
  );

  const handleAdviceTap = useCallback(() => {
    onAdviceTap?.();
    void fetchNewAdvice();
  }, [onAdviceTap, fetchNewAdvice]);

  const rotation = translateX.interpolate({
    inputRange: [-SWIPE_DISTANCE, 0, SWIPE_DISTANCE],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  const scale = translateX.interpolate({
    inputRange: [-SWIPE_DISTANCE, 0, SWIPE_DISTANCE],
    outputRange: [0.9, 1, 0.9],
  });

  return (
    <View style={styles.container}>
      {backgroundImageUrl ? (
        <ImageBackground
          source={{ uri: backgroundImageUrl }}
          style={styles.backgroundImage}
          imageStyle={styles.imageStyle}
        >
          <View style={styles.overlay} />
        </ImageBackground>
      ) : null}

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          backgroundImageUrl ? styles.cardWithBackground : null,
          { transform: [{ translateX }, { rotate: rotation }, { scale }] },
        ]}
      >
        {loading ? (
          <Text style={styles.text}>Loading advice...</Text>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : advice ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAdviceTap}
            style={styles.adviceContainer}
          >
            <Text style={styles.text}>
              {advice.html ? htmlToText(advice.html) : advice.text}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.text}>No advice available</Text>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    resizeMode: 'cover',
  },
  imageStyle: {
    opacity: 0.3, // Subtle background effect
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Light overlay for better text readability
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    position: 'relative',
  },
  cardWithBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // Semi-transparent background when image is present
  },
  adviceContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 24,
    color: '#333',
    fontWeight: '400',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#d32f2f',
    fontWeight: '500',
  },
});

export default AdviceCard;
