import React from 'react';
import { View } from 'react-native';
import styles from './AdviceScreen.style';
import { useAdvice } from '@hooks/useAdvice';
import AdviceCard from '@components/AdviceCard/AdviceCard';

const AdviceScreen: React.FC = () => {
  const {
    advice,
    loading,
    error,
    fetchNewAdvice,
    backgroundImageUrl,
    backgroundColor,
  } = useAdvice();

  return (
    <View style={styles.container}>
      <AdviceCard
        advice={advice}
        loading={loading}
        error={error}
        backgroundImageUrl={backgroundImageUrl}
        backgroundColor={backgroundColor}
        onSwipeLeft={fetchNewAdvice}
        onSwipeRight={fetchNewAdvice}
        onAdviceTap={fetchNewAdvice}
      />
    </View>
  );
};

export default AdviceScreen;
