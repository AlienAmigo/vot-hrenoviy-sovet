import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  PanResponder,
  type PanResponderGestureState,
} from 'react-native';
import styles from './AdviceCard.style';
import type { Advice } from '@types';
import { htmlToText } from '@api/advice';
import {
  SWIPE_ANIMATION_DURATION,
  SWIPE_DISTANCE,
  SWIPE_ROLLBACK_DURATION,
  SWIPE_START_THRESHOLD,
  SWIPE_THRESHOLD,
} from '@config';

interface AdviceCardProps {
  advice: Advice | null;
  loading: boolean;
  error: string | null;
  backgroundImageUrl?: string;
  backgroundColor?: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onAdviceTap: () => void;
}

/**
 * Жест горизонтальный, только если сдвиг по X заметнее сдвига по Y.
 * Вертикальные жесты карточке не принадлежат: по ним ничего не происходит.
 */
const isHorizontalGesture = (gesture: PanResponderGestureState): boolean =>
  Math.abs(gesture.dx) > Math.abs(gesture.dy);

const AdviceCard: React.FC<AdviceCardProps> = ({
  advice,
  loading,
  error,
  backgroundImageUrl,
  backgroundColor,
  onSwipeLeft,
  onSwipeRight,
  onAdviceTap,
}) => {
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
          void onSwipeLeft?.();
        } else {
          void onSwipeRight?.();
        }
      });
    },
    [translateX, onSwipeLeft, onSwipeRight],
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

  const rotation = translateX.interpolate({
    inputRange: [-SWIPE_DISTANCE, 0, SWIPE_DISTANCE],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  const scale = translateX.interpolate({
    inputRange: [-SWIPE_DISTANCE, 0, SWIPE_DISTANCE],
    outputRange: [0.9, 1, 0.9],
  });

  const handleAdviceTap = useCallback(() => {
    void onAdviceTap();
  }, [onAdviceTap]);

  return (
    <View
      style={[styles.container, backgroundColor ? { backgroundColor } : null]}
    >
      {backgroundImageUrl && backgroundImageUrl.startsWith('https://') ? (
        <View style={styles.backgroundContainer}>
          <Image
            source={{ uri: backgroundImageUrl }}
            style={[styles.backgroundImage, styles.imageStyle]}
          />
        </View>
      ) : null}

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          { transform: [{ translateX }, { rotate: rotation }, { scale }] },
        ]}
      >
        <View style={styles.adviceContainer}>
          {loading ? (
            <Text style={styles.text}>Loading advice...</Text>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : advice ? (
            <TouchableOpacity activeOpacity={0.8} onPress={handleAdviceTap}>
              <Text style={styles.text}>
                {advice.html ? htmlToText(advice.html) : advice.text}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.text}>No advice available</Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

export default AdviceCard;
