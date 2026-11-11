import React, { useCallback, useMemo } from 'react';
import {
  View,
  Animated,
  PanResponder,
  type PanResponderGestureState,
} from 'react-native';
import { useAdvice } from '@hooks/useAdvice';
import AdviceCard from '@components/AdviceCard/AdviceCard';
import {
  SWIPE_ANIMATION_DURATION,
  SWIPE_DISTANCE,
  SWIPE_ROLLBACK_DURATION,
  SWIPE_START_THRESHOLD,
  SWIPE_THRESHOLD,
} from '@config';

import styles from './AdviceScreen.style';

/**
 * Жест горизонтальный, только если сдвиг по X заметнее сдвига по Y.
 * Вертикальные жесты карточке не принадлежат: по ним ничего не происходит.
 */
const isHorizontalGesture = (gesture: PanResponderGestureState): boolean =>
  Math.abs(gesture.dx) > Math.abs(gesture.dy);

const AdviceScreen: React.FC = () => {
  const {
    advice,
    loading,
    error,
    fetchNewAdvice,
    backgroundImageUrl,
    backgroundColor,
  } = useAdvice();

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
        void fetchNewAdvice();
      });
    },
    [translateX, fetchNewAdvice],
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
    void fetchNewAdvice();
  }, [fetchNewAdvice]);

  return (
    <View style={styles.container}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          { transform: [{ translateX }, { rotate: rotation }, { scale }] },
        ]}
      >
        <AdviceCard
          advice={advice}
          loading={loading}
          error={error}
          backgroundImageUrl={backgroundImageUrl}
          backgroundColor={backgroundColor}
          onAdviceTap={handleAdviceTap}
        />
      </Animated.View>
    </View>
  );
};

export default AdviceScreen;
