import { Image } from 'react-native';

export function Brand({ width = 240 }: { width?: number }) {
  return <Image accessible accessibilityRole="image" accessibilityLabel="UniFood. Pide. Paga. Recoge."
    source={require('../../assets/unifood-logo.png')} resizeMode="contain"
    style={{ width, height: width * 400 / 560, maxWidth: '100%', alignSelf: 'center' }} />;
}
