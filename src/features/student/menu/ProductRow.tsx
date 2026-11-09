import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../constants/theme';
import type { ProductoMenu } from '../../../types/Menu';
import { Price, priceLabel } from './Price';
import { ProductImage } from './ProductImage';

export function ProductRow({ producto, onPress }: { producto: ProductoMenu; onPress: () => void }) {
  const label = `${producto.nombre}. ${priceLabel(producto)}. ${producto.disponible ? 'Disponible' : 'Agotado'}`;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Ver detalle del producto" onPress={onPress}
    style={({ pressed }) => [styles.card, !producto.disponible && styles.soldOut, pressed && styles.pressed]}>
    <ProductImage uri={producto.foto} name={producto.nombre} style={styles.photo} />
    <View style={styles.body}>
      <Text numberOfLines={2} style={styles.name}>{producto.nombre}</Text>
      <Price producto={producto} />
      {!producto.disponible && <Text style={styles.chip}>Agotado</Text>}
    </View>
    <Text accessible={false} style={styles.chevron}>›</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, minHeight: 88, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface },
  soldOut: { opacity: 0.75 },
  pressed: { backgroundColor: colors.accent },
  photo: { width: 72, height: 72, borderRadius: 14, backgroundColor: colors.accent },
  body: { flex: 1, gap: 6 },
  name: { fontSize: 17, fontWeight: '700', color: colors.ink },
  chip: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '700', color: colors.ink, backgroundColor: '#EDEAE6', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' },
  chevron: { fontSize: 28, color: colors.muted },
});
