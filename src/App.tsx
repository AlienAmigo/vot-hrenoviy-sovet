import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import AdviceCard from '@components/AdviceCard/AdviceCard';

export default function App() {
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
    backgroundColor: '#fff',
  },
});
