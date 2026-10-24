import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Feedback } from '../../components/Feedback';
import { colors } from '../../constants/theme';
import { addProduct, cartTotals, emptyCart, formatCOP, lineAmounts, setQuantity, type Cart, type Product } from '../../domain/cart';

// Productos de ejemplo hasta que existan el menú y las promociones (RF-06, RF-24).
const examples: Product[] = [
  { id: 'doble', restaurantId: 'rest-burger', name: 'Doble', priceCOP: 20000, discountPercent: 15 },
  { id: 'papas', restaurantId: 'rest-burger', name: 'Papas', priceCOP: 6000, discountPercent: 0 },
  { id: 'gaseosa', restaurantId: 'rest-burger', name: 'Gaseosa', priceCOP: 4000, discountPercent: 0 },
];
const exampleCart = examples.reduce((cart, product) => addProduct(cart, product).cart, emptyCart);

export default function CartScreen({ initialCart = exampleCart }: { initialCart?: Cart }) {
  const [cart, setCart] = useState(initialCart);
  const totals = cartTotals(cart.lines);
  return <SafeAreaView edges={['top']} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Tu carrito</Text>
      <View style={styles.notice}><Text style={styles.noticeText}>Carrito de ejemplo: los productos reales llegarán con el menú de cada restaurante.</Text></View>
      {!cart.lines.length ? <Feedback state="empty" message="Tu carrito está vacío." /> : cart.lines.map(line => {
        const { discountCOP } = lineAmounts(line);
        const change = (quantity: number) => setCart(setQuantity(cart, line.productId, quantity));
        return <View key={line.productId} style={styles.card}>
          <View style={styles.thumb}><Text style={styles.initial}>{line.name.charAt(0)}</Text></View>
          <View style={styles.info}>
            <Text style={styles.name}>{line.name}</Text>
            <Text style={styles.price}>{formatCOP(line.priceCOP)}</Text>
            {discountCOP > 0 && <Text style={styles.discount}>-{line.discountPercent} % en esta línea</Text>}
            <View style={styles.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Disminuir cantidad de ${line.name}`} onPress={() => change(line.quantity - 1)} style={styles.step}>
                <Feather name="minus" size={16} color={colors.ink} accessible={false} />
              </Pressable>
              <Text accessibilityLabel={`Cantidad de ${line.name}: ${line.quantity}`} style={styles.quantity}>{line.quantity}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Aumentar cantidad de ${line.name}`} disabled={line.quantity >= 20}
                accessibilityState={{ disabled: line.quantity >= 20 }} onPress={() => change(line.quantity + 1)} style={[styles.step, line.quantity >= 20 && styles.dimmed]}>
                <Feather name="plus" size={16} color={colors.ink} accessible={false} />
              </Pressable>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Eliminar ${line.name}`} onPress={() => change(0)} style={styles.trash}>
            <Feather name="trash-2" size={20} color={colors.muted} accessible={false} />
          </Pressable>
        </View>;
      })}
      <View style={styles.summary}>
        <Row label="Subtotal" value={formatCOP(totals.grossCOP)} />
        {totals.discountCOP > 0 && <Row label="Descuentos" value={`-${formatCOP(totals.discountCOP)}`} />}
        <View style={styles.divider} />
        <Row label="Total" value={formatCOP(totals.totalCOP)} strong />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Continuar" disabled accessibilityState={{ disabled: true }} style={[styles.button, styles.dimmed]}>
        <Text style={styles.buttonText}>Continuar</Text>
      </Pressable>
      <Text style={styles.hint}>{cart.lines.length ? 'El pago estará disponible próximamente.' : 'Agrega productos para continuar.'}</Text>
    </ScrollView>
  </SafeAreaView>;
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <View style={styles.row}>
    <Text style={strong ? styles.totalLabel : styles.rowLabel}>{label}</Text>
    <Text style={strong ? styles.totalValue : styles.rowValue}>{value}</Text>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14, width: '100%', maxWidth: 760, alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  notice: { padding: 12, borderRadius: 12, backgroundColor: colors.accent },
  noticeText: { fontSize: 14, lineHeight: 20, color: colors.ink },
  card: { flexDirection: 'row', gap: 14, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  thumb: { width: 72, height: 72, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  initial: { fontSize: 28, fontWeight: '700', color: colors.primary },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 17, fontWeight: '700', color: colors.ink },
  price: { fontSize: 16, fontWeight: '600', color: colors.ink },
  discount: { fontSize: 13, fontWeight: '600', color: colors.primary },
  stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 4, padding: 2, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  step: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  quantity: { minWidth: 24, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.ink },
  trash: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  summary: { gap: 10, padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 15, color: colors.muted }, rowValue: { fontSize: 15, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.border },
  totalLabel: { fontSize: 18, fontWeight: '700', color: colors.ink }, totalValue: { fontSize: 20, fontWeight: '700', color: colors.ink },
  button: { minHeight: 54, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F56A25' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  dimmed: { opacity: 0.5 },
  hint: { textAlign: 'center', fontSize: 14, color: colors.muted },
});
