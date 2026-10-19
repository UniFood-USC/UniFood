import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';
import { routes } from '../constants/routes';
import { Order } from '../types/domain';
import { Actor } from '../services/orders/changeOrder';
import { OrderFilter, mockOrders, restaurantName } from '../services/orders/orderRepository';
import { isTerminal, statusLabel } from '../services/orders/statusFlow';
import { useOrders } from '../services/orders/useOrders';
import { OrderActions } from './OrderActions';

const money = (n: number) => `$${n.toLocaleString('es-CO')}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

type Props = { title: string; filter: OrderFilter; actor: Actor; fallback: '/restaurant' | '/admin'; showRestaurant?: boolean };

export function StaffOrdersView({ title, filter, actor, fallback, showRestaurant }: Props) {
  const router = useRouter();
  const { orders, loading } = useOrders(mockOrders.repo, filter);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(fallback));

  const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = sorted.filter((o) => !isTerminal(o.status));
  const finished = sorted.filter((o) => isTerminal(o.status));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={goBack} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>{title}</Text>
        <View style={styles.back} />
      </View>

      {loading ? <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando pedidos" /> : (
        <>
          <Text accessibilityRole="header" style={styles.section}>En curso ({active.length})</Text>
          {active.length === 0 && <Text style={styles.muted}>No hay pedidos en curso.</Text>}
          {active.map((o) => <Card key={o.id} order={o} actor={actor} showRestaurant={showRestaurant} />)}

          <Text accessibilityRole="header" style={styles.section}>Finalizados ({finished.length})</Text>
          {finished.length === 0 && <Text style={styles.muted}>Aún no hay pedidos finalizados.</Text>}
          {finished.map((o) => <Card key={o.id} order={o} actor={actor} showRestaurant={showRestaurant} />)}
        </>
      )}
    </ScrollView>
  );
}

function Card({ order, actor, showRestaurant }: { order: Order; actor: Actor; showRestaurant?: boolean }) {
  const router = useRouter();
  return (
    <View style={styles.card}>
      <Text style={styles.orderId}>#{order.id} · {order.mode === 'pickup' ? 'Recogida' : 'Entrega al salón'}</Text>
      {showRestaurant && <Text style={styles.muted}>{restaurantName(order.restaurantId)}</Text>}
      <View style={styles.chip}><Text style={styles.chipText}>{statusLabel(order.status, order.mode)}</Text></View>
      <Text style={styles.muted}>
        {time(order.createdAt)} · {money(order.total)} · {order.paid ? 'Pagado' : 'Pago pendiente'}
      </Text>
      {order.status === 'cancelled' && (
        <Text style={styles.body}>
          {order.cancelReason ? `Motivo: ${order.cancelReason}` : 'Sin motivo indicado'}
          {order.refund ? ` · Reembolso simulado: ${money(order.refund.amount)}` : ''}
        </Text>
      )}
      <OrderActions order={order} actor={actor} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Ver seguimiento del pedido ${order.id}`}
        onPress={() => router.push(routes.orderTracking(order.id))} style={styles.link}>
        <Text style={styles.linkText}>Ver seguimiento</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 14, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '700', color: colors.ink },
  back: { width: 44, height: 44, justifyContent: 'center' },
  backText: { fontSize: 32, color: colors.ink, lineHeight: 36 },
  section: { fontSize: 20, fontWeight: '600', color: colors.ink, marginTop: 8 },
  card: { padding: 16, gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface },
  orderId: { fontSize: 17, fontWeight: '700', color: colors.ink },
  chip: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  body: { fontSize: 15, lineHeight: 22, color: colors.ink },
  muted: { fontSize: 14, color: colors.muted },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});