import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import AdviceCard from '@components/AdviceCard/AdviceCard';

import { useFonts } from 'expo-font';

if (__DEV__) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./devtools/ReactotronConfig');
}

export default function App() {
  const [loaded] = useFonts({
    'Oswald': require('./assets/fonts/Oswald-Medium.ttf'),
  });

  if (!loaded) return null;
  return (
    <View style={styles.container}>
      <AdviceCard />
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
