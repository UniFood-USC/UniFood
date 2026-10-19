import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../../constants/theme';
import { routes } from '../../../constants/routes';
import { Order } from '../../../types/domain';
import { MOCK_STUDENT_ID, mockOrders, restaurantName } from '../../../services/orders/orderRepository';
import { isTerminal, statusLabel } from '../../../services/orders/statusFlow';
import { useOrders } from '../../../services/orders/useOrders';

type Tab = 'active' | 'history';

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  if (sameDay(d, now)) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return `Ayer · ${time}`;
  return `${d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · ${time}`;
}

export default function OrdersScreen() {
  const router = useRouter();
  const goBack = () => router.back();
  const [tab, setTab] = useState<Tab>('active');
  const { orders, error, loading } = useOrders(mockOrders.repo, { studentId: MOCK_STUDENT_ID });

  const visible = [...orders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((o) => (tab === 'active' ? !isTerminal(o.status) : isTerminal(o.status)));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={goBack} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>Mis pedidos</Text>
        <View style={styles.back} />
      </View>

      <View accessibilityRole="tablist" style={styles.tabs}>
        {(['active', 'history'] as const).map((t) => {
          const selected = tab === t;
          return (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(t)}
              style={[styles.tab, selected && styles.tabSelected]}
            >
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
                {t === 'active' ? 'Activos' : 'Historial'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando pedidos" />
      ) : error ? (
        <Empty text="No pudimos cargar tus pedidos. Intenta de nuevo más tarde." />
      ) : visible.length === 0 ? (
        <Empty text={tab === 'active' ? 'No tienes pedidos activos.' : 'Aún no tienes pedidos en tu historial.'} />
      ) : (
        visible.map((o) => (
          <OrderCard key={o.id} order={o} onOpen={() => router.push(routes.orderTracking(o.id))} />
        ))
      )}
    </ScrollView>
  );
}

function OrderCard({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const name = restaurantName(order.restaurantId);
  const scheduled = order.status === 'received' && !!order.scheduledFor;
  const when = scheduled ? `Programado · ${formatWhen(order.scheduledFor!)}` : formatWhen(order.createdAt);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar} importantForAccessibility="no-hide-descendants">
          <Text style={styles.avatarText}>{name.charAt(0)}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.orderId}>#{order.id}</Text>
          <Text style={styles.restaurant}>{name}</Text>
          <View style={styles.chip}>
            <View style={[styles.dot, order.status === 'cancelled' && styles.dotCancelled]} />
            <Text style={styles.chipText}>{statusLabel(order.status, order.mode)}</Text>
          </View>
          <Text style={styles.when}>{when}</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver detalles del pedido ${order.id}`}
        onPress={onOpen}
        style={styles.detailBtn}
      >
        <Text style={styles.detailBtnText}>Ver detalles</Text>
      </Pressable>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center' },
headerTitle: { flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '700', color: colors.ink },
back: { width: 44, height: 44, justifyContent: 'center' },
backText: { fontSize: 32, color: colors.ink, lineHeight: 36 },
  content: { padding: 24, gap: 16, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabSelected: { borderBottomColor: colors.primary },
  tabText: { fontSize: 16, color: colors.muted },
  tabTextSelected: { color: colors.ink, fontWeight: '700' },
  card: { padding: 16, gap: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface },
  cardTop: { flexDirection: 'row', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.ink },
  cardBody: { flex: 1, gap: 4 },
  orderId: { fontSize: 17, fontWeight: '700', color: colors.ink },
  restaurant: { fontSize: 15, color: colors.muted },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  dotCancelled: { backgroundColor: colors.muted },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  when: { fontSize: 14, color: colors.muted, marginTop: 2 },
  detailBtn: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12 },
  detailBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  empty: { padding: 24, borderRadius: 16, backgroundColor: colors.accent },
  emptyText: { fontSize: 16, lineHeight: 24, color: colors.ink, textAlign: 'center' },
});