import Reactotron from 'reactotron-react-native';

const reactotron = Reactotron.configure({
  name: 'vot-hrenoviy-sovet',
  onDisconnect: () => {
    console.warn('Reactotron Disconnected');
  },
  onConnect: () => {
    console.warn('Reactotron Connected');
  },
})
  .useReactNative({
    asyncStorage: false,
    networking: {
      ignoreUrls: /symbolicate|localhost/,
    },
    editor: false,
    errors: { veto: () => false },
    overlay: false,
  })
  .connect();

export default reactotron;
