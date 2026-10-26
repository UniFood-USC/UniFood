import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../constants/theme';
import { getRestaurantSalesHistory, type SalesEntry } from '../../domain/sales';
import { MOCK_ACTORS, mockOrders, restaurantName } from '../../services/orders/orderRepository';
import { statusLabel } from '../../services/orders/statusFlow';
import { useOrders } from '../../services/orders/useOrders';
import type { OrderRepository } from '../../services/orders/orderRepository';

type Props = {
  repository?: OrderRepository;
  restaurantId?: string;
};

function money(amount: number) {
  return `$${amount.toLocaleString('es-CO')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SalesHistoryScreen({
  repository = mockOrders.repo,
  restaurantId = MOCK_ACTORS.restaurant.restaurantId,
}: Props) {
  const router = useRouter();
  const { orders, error, loading } = useOrders(repository, { restaurantId });
  const history = getRestaurantSalesHistory(orders, restaurantId);
  const total = history.sales.reduce((sum, entry) => sum + entry.order.total, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Historial de ventas</Text>
        <View style={styles.back} />
      </View>
      <Text style={styles.restaurantName}>{restaurantName(restaurantId)}</Text>
      <Text style={styles.demoNote}>Datos de demostración; la cuenta aún no está vinculada a un restaurante persistido.</Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando historial de ventas" />
      ) : error ? (
        <View style={styles.empty}>
          <Text accessibilityRole="alert" style={styles.emptyText}>
            No pudimos cargar el historial de ventas. Intenta de nuevo más tarde.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>Ventas completadas</Text>
            <Text style={styles.summaryAmount}>{money(total)}</Text>
            <Text style={styles.muted}>{history.sales.length} pedidos</Text>
          </View>
          <Text style={styles.note}>
            Incluye pedidos pagados recogidos o entregados, también los de importe cero. Los importes reflejan descuentos e incluyen la tarifa de entrega.
          </Text>
          <HistorySection
            title="Ventas completadas"
            emptyText="Aún no hay ventas completadas."
            entries={history.sales}
            amount={entry => entry.order.total}
            status={entry => statusLabel(entry.order.status, entry.order.mode)}
          />
          <HistorySection
            title="Pedidos cancelados"
            emptyText="No hay pedidos cancelados."
            entries={history.cancelled}
            amount={entry => entry.order.total}
            status={() => 'Cancelado'}
          />
          <HistorySection
            title="Reembolsos"
            emptyText="No hay reembolsos."
            entries={history.refunds}
            amount={entry => entry.order.refund.amount}
            status={() => 'Reembolsado'}
          />
        </>
      )}
    </ScrollView>
  );
}

function HistorySection<T extends SalesEntry>({
  title,
  emptyText,
  entries,
  amount,
  status,
}: {
  title: string;
  emptyText: string;
  entries: T[];
  amount: (entry: T) => number;
  status: (entry: T) => string;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title} ({entries.length})</Text>
      {entries.length === 0 ? (
        <Text style={styles.muted}>{emptyText}</Text>
      ) : entries.map(entry => (
        <View key={`${title}-${entry.order.id}`} style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.orderId}>Pedido #{entry.order.id}</Text>
            <Text style={styles.amount}>{money(amount(entry))}</Text>
          </View>
          <Text style={styles.muted}>{formatDate(entry.date)}</Text>
          <Text style={styles.status}>{status(entry)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 16, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center' },
  backText: { fontSize: 32, color: colors.ink, lineHeight: 36 },
  title: { flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '700', color: colors.ink },
  restaurantName: { fontSize: 17, color: colors.muted, textAlign: 'center' },
  demoNote: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  summary: { padding: 18, borderRadius: 16, backgroundColor: colors.accent, gap: 4 },
  summaryLabel: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  summaryAmount: { color: colors.ink, fontSize: 28, fontWeight: '700' },
  note: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  section: { gap: 10 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '600', marginTop: 8 },
  card: { padding: 16, gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  orderId: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  amount: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  status: { color: colors.ink, fontSize: 14 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  empty: { padding: 24, borderRadius: 16, backgroundColor: colors.accent },
  emptyText: { color: colors.ink, fontSize: 16, lineHeight: 24, textAlign: 'center' },
});
