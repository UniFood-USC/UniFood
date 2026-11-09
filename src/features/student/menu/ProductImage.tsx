import { useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../../constants/theme';

// Foto del producto; si no hay foto o falla la carga, muestra la inicial del nombre.
export function ProductImage({ uri, name, style, label }: { uri?: string; name: string; style: StyleProp<ViewStyle>; label?: string }) {
  const [failed, setFailed] = useState(false);
  return uri && !failed
    ? <Image source={{ uri }} onError={() => setFailed(true)} accessibilityLabel={label} accessibilityIgnoresInvertColors style={style as object} />
    : <View importantForAccessibility="no-hide-descendants" style={[style, styles.placeholder]}>
      <Text style={styles.initial}>{name.charAt(0).toUpperCase()}</Text>
    </View>;
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  initial: { fontSize: 28, fontWeight: '700', color: colors.primary },
});
