import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import AdviceScreen from '@components/AdviceScreen/AdviceScreen';

if (__DEV__) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./devtools/ReactotronConfig');
}

export default function App() {
  const [loaded] = useFonts({
    Oswald: require('./assets/fonts/Oswald-Medium.ttf'),
  });

  if (!loaded) return null;
  return (
    <View style={styles.container}>
      <AdviceScreen />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#22242a',
  },
});
