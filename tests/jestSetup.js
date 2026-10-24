// jest-expo 58 simula 'react-native/asset-registry', pero con React Native 0.88 expo-asset lee el
// registro interno de react-native. Se usa la misma simulación hasta que jest-expo lo corrija.
// La ruta se calcula dentro de jest.mock porque babel-jest eleva la llamada al inicio del archivo.
jest.mock(
  require('node:path').join(require('node:path').dirname(require.resolve('react-native/package.json')), 'src/private/assets/AssetRegistry'),
  () => ({ AssetRegistry: jest.requireMock('react-native/asset-registry') }),
);
