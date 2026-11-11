import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageStyle: {
    opacity: 0.3, // Subtle background effect
  },
  card: {
    backgroundColor: 'transparent',
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  adviceContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'Oswald',
    fontWeight: '500',
    fontSize: 32,
    textAlign: 'center',
    lineHeight: 36,
    textTransform: 'uppercase',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: {
      width: 0,
      height: 0,
    },
    textShadowRadius: 7,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#d32f2f',
    fontWeight: '500',
  },
});

export default styles;
