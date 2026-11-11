import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import styles from './AdviceCard.style';
import type { Advice } from '@types';
import { htmlToText } from '@api/advice';

interface AdviceCardProps {
  advice: Advice | null;
  loading: boolean;
  error: string | null;
  backgroundImageUrl?: string;
  backgroundColor?: string;
  onAdviceTap: () => void;
}

const AdviceCard: React.FC<AdviceCardProps> = ({
  advice,
  loading,
  error,
  backgroundImageUrl,
  backgroundColor,
  onAdviceTap,
}) => {
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

      <View style={styles.adviceContainer}>
        {loading ? (
          <Text style={styles.text}>Loading advice...</Text>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : advice ? (
          <TouchableOpacity activeOpacity={0.8} onPress={onAdviceTap}>
            <Text style={styles.text}>
              {advice.html ? htmlToText(advice.html) : advice.text}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.text}>No advice available</Text>
        )}
      </View>
    </View>
  );
};

export default AdviceCard;
