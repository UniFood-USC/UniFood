import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../constants/theme';
import { formatCOP } from '../../../domain/menu';
import type { ProductoMenu } from '../../../types/Menu';

// Precio en pesos colombianos; con promoción vigente muestra el precio normal tachado,
// el precio final y el porcentaje en texto (la promoción no se comunica solo con color).
export function Price({ producto, large = false }: { producto: Pick<ProductoMenu, 'precioCOP' | 'promocion'>; large?: boolean }) {
  const { precioCOP, promocion } = producto;
  if (!promocion) return <Text style={[styles.price, large && styles.large]}>{formatCOP(precioCOP)}</Text>;
  return <View style={styles.promo}>
    <Text style={[styles.price, large && styles.large]}>{formatCOP(promocion.precioFinalCOP)}</Text>
    <Text style={styles.old}>{formatCOP(precioCOP)}</Text>
    <Text style={styles.badge}>Promoción -{promocion.porcentaje} %</Text>
  </View>;
}

// Texto para lectores de pantalla: "20.000 pesos colombianos" o con la promoción aplicada.
export function priceLabel({ precioCOP, promocion }: Pick<ProductoMenu, 'precioCOP' | 'promocion'>) {
  const cop = (value: number) => `${formatCOP(value).slice(1)} pesos colombianos`;
  return promocion ? `${cop(promocion.precioFinalCOP)} con promoción de ${promocion.porcentaje} por ciento, precio normal ${cop(precioCOP)}` : cop(precioCOP);
}

const styles = StyleSheet.create({
  promo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  price: { fontSize: 16, fontWeight: '700', color: colors.ink },
  large: { fontSize: 26 },
  old: { fontSize: 14, color: colors.muted, textDecorationLine: 'line-through' },
  badge: { fontSize: 12, fontWeight: '700', color: colors.primary, backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
});
