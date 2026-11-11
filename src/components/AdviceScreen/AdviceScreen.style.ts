import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'transparent',
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
});

export default styles;
