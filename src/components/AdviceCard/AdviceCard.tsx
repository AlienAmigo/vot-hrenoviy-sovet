import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { useAdvice } from '@hooks/useAdvice';

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
  const { advice, loading, error, fetchNewAdvice } = useAdvice();
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(
    null,
  );

  useEffect(() => {
    if (advice) {
      // Reset swipe state when new advice is loaded
      setIsSwiping(false);
      setSwipeDirection(null);
    }
  }, [advice]);

  const handleSwipe = (direction: 'left' | 'right') => {
    setIsSwiping(true);
    setSwipeDirection(direction);

    if (direction === 'left' && onSwipeLeft) {
      onSwipeLeft();
    } else if (direction === 'right' && onSwipeRight) {
      onSwipeRight();
    }

    // Reset swipe state after animation
    setTimeout(() => {
      setIsSwiping(false);
      setSwipeDirection(null);
    }, 300); // Match the animation duration
  };

  const handleAdviceTap = () => {
    if (onAdviceTap) {
      onAdviceTap();
    }
    fetchNewAdvice();
  };

  const handleSwipeLeft = () => handleSwipe('left');
  const handleSwipeRight = () => handleSwipe('right');

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

      <View
        style={[
          styles.card,
          backgroundImageUrl ? styles.cardWithBackground : null,
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

        {/* Swipe indicators */}
        {isSwiping && swipeDirection && (
          <View
            style={[
              styles.swipeIndicator,
              swipeDirection === 'left' ? styles.leftSwipe : styles.rightSwipe,
            ]}
          >
            <Text style={styles.swipeText}>
              {swipeDirection === 'left' ? '←' : '→'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// HTML to text conversion function
const htmlToText = (html: string): string => {
  if (!html) return '';

  // Replace <br> tags with newlines
  let text = html.replace(/<br\s*\/?>/gi, '\n');

  // Remove other HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Replace &nbsp; with regular spaces
  text = text.replace(/&nbsp;/g, ' ');

  // Replace &amp; with &
  text = text.replace(/&amp;/g, '&');

  // Replace &lt; with <
  text = text.replace(/&lt;/g, '<');

  // Replace &gt; with >
  text = text.replace(/&gt;/g, '>');

  // Trim whitespace
  return text.trim();
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
  scrollView: {
    flex: 1,
    width: '100%',
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
  swipeIndicator: {
    position: 'absolute',
    top: 20,
    padding: 10,
    borderRadius: 20,
    opacity: 0.8,
  },
  leftSwipe: {
    left: 20,
    backgroundColor: '#f57c00',
  },
  rightSwipe: {
    right: 20,
    backgroundColor: '#4caf50',
  },
  swipeText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default AdviceCard;
