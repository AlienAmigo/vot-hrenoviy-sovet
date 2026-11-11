import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    flex: 1,
    alignItems: 'center',
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
  imageStyle: {},
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
    textShadowRadius: 8,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#d32f2f',
    fontWeight: '500',
  },
});

export default styles;
