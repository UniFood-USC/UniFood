import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../constants/theme';
import type { RestaurantePublico } from '../../../types/Estado_Restaurante';

export function RestaurantCard({ restaurant }: { restaurant: RestaurantePublico }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const { nombre, logo, disponible, proximaApertura } = restaurant;
  const label = `${nombre}. ${disponible ? 'Disponible' : 'No disponible'}${proximaApertura ? `. Abre ${proximaApertura}` : ''}`;
  return (
    <View accessible accessibilityLabel={label} style={styles.card}>
      {logo && !logoFailed
        ? <Image source={{ uri: logo }} onError={() => setLogoFailed(true)} accessibilityIgnoresInvertColors style={styles.logo} />
        : <View importantForAccessibility="no-hide-descendants" style={[styles.logo, styles.placeholder]}>
          <Text style={styles.initial}>{nombre.charAt(0).toUpperCase()}</Text>
        </View>}
      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.name}>{nombre}</Text>
        <View style={[styles.chip, !disponible && styles.chipClosed]}>
          <View style={[styles.dot, disponible ? styles.dotOpen : styles.dotClosed]} />
          <Text style={styles.chipText}>{disponible ? 'Disponible' : 'No disponible'}</Text>
        </View>
        {!!proximaApertura && <Text style={styles.opens}>Abre: {proximaApertura}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface },
  logo: { width: 64, height: 64, borderRadius: 14, backgroundColor: colors.accent },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 26, fontWeight: '700', color: colors.primary },
  body: { flex: 1, gap: 6 },
  name: { fontSize: 18, fontWeight: '700', color: colors.ink },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#E6F4EA', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chipClosed: { backgroundColor: colors.accent },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOpen: { backgroundColor: '#1E7B3A' },
  dotClosed: { backgroundColor: colors.muted },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  opens: { fontSize: 14, color: colors.muted },
});
