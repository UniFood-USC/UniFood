import { Image } from 'react-native';

// Vertical (560 × 400) para accesos; horizontal (578 × 163) para encabezados con poco alto.
export function Brand({ width = 240, horizontal = false }: { width?: number; horizontal?: boolean }) {
  return <Image accessible accessibilityRole="image" accessibilityLabel="UniFood. Pide. Paga. Recoge."
    source={horizontal ? require('../../assets/unifood-logo-horizontal.png') : require('../../assets/unifood-logo.png')} resizeMode="contain"
    style={{ width, height: width * (horizontal ? 163 / 578 : 400 / 560), maxWidth: '100%', alignSelf: 'center' }} />;
}
