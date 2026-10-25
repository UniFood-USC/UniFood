import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../../constants/theme';
import { routes } from '../../../constants/routes';
import { Order } from '../../../types/domain';
import { EstimateNotice } from '../../../components/EstimateNotice';
import { OrderActions } from '../../../components/OrderActions';
import { OrderStatusStepper } from './OrderStatusStepper';
import { MOCK_ACTORS, mockOrders, restaurantName } from '../../../services/orders/orderRepository';
import { STATUS_FLOW, statusLabel } from '../../../services/orders/statusFlow';
import { useOrderTracking } from './useOrderTracking';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export default function OrderTrackingScreen({ orderId = 'UC1023' }: { orderId?: string }) {
  const router = useRouter();
  const { order, error, loading } = useOrderTracking(mockOrders.repo, orderId);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(routes.orders));

  if (loading) {
    return <ActivityIndicator style={styles.center} color={colors.primary} accessibilityLabel="Cargando pedido" />;
  }
  if (error) return <Message text="No pudimos cargar tu pedido. Intenta de nuevo más tarde." onBack={goBack} />;
  if (!order) return <Message text="No encontramos este pedido." onBack={goBack} />;

  const cancelled = order.status === 'cancelled';
  const scheduledWaiting = order.status === 'received' && !!order.scheduledFor;
  const history = { received: order.createdAt, ...order.statusHistory };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={goBack} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerTitle}>
          <Text accessibilityRole="header" style={styles.title}>Estado del pedido</Text>
          <Text style={styles.orderId}>#{order.id}</Text>
          <Text style={styles.subtitle}>
            {restaurantName(order.restaurantId)} · {order.mode === 'pickup' ? 'Recogida' : 'Entrega al salón'}
          </Text>
        </View>
        <View style={styles.back} />
      </View>

      {scheduledWaiting && (
        <View style={styles.notice}>
          <Text style={styles.body}>
            Pedido programado para {fmt(order.scheduledFor!)}. Seguirá como recibido hasta que el restaurante inicie la preparación.
          </Text>
        </View>
      )}

      {cancelled ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>{statusLabel('cancelled', order.mode)}</Text>
          {order.cancelReason ? <Text style={styles.body}>Motivo: {order.cancelReason}</Text> : null}
          {order.refund ? (
            <Text style={styles.body}>Reembolso simulado: ${order.refund.amount.toLocaleString('es-CO')}</Text>
          ) : null}
        </View>
      ) : (
        <>
          <OrderStatusStepper mode={order.mode} status={order.status} history={history} />
          <EstimateNotice order={order} />
        </>
      )}

      <OrderActions order={order} actor={MOCK_ACTORS.student} />

      {__DEV__ && <DevControls order={order} />}
    </ScrollView>
  );
}

function Message({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <View style={[styles.screen, styles.center, { padding: 24, gap: 16 }]}>
      <Text style={[styles.body, { textAlign: 'center' }]}>{text}</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={onBack}>
        <Text style={styles.buttonText}>Volver</Text>
      </Pressable>
    </View>
  );
}

// Solo desarrollo: simula al restaurante cambiando el estado de este pedido
function DevControls({ order }: { order: Order }) {
  return (
    <View style={styles.card}>
      <Text style={styles.detail}>Controles de prueba (solo desarrollo)</Text>
      {STATUS_FLOW[order.mode].slice(1).map((s) => (
        <Pressable key={s} accessibilityRole="button" style={styles.button} onPress={() => mockOrders.setStatus(order.id, s)}>
          <Text style={styles.buttonText}>Simular: {statusLabel(s, order.mode)}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        style={styles.button}
        onPress={() => mockOrders.patch(order.id, { status: 'cancelled', cancelledBy: 'restaurant', cancelReason: 'Producto agotado' })}
      >
        <Text style={styles.buttonText}>Simular: cancelado</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center' },
  content: { padding: 24, gap: 20, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1, alignItems: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center' },
  backText: { fontSize: 32, color: colors.ink, lineHeight: 36 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  orderId: { fontSize: 20, fontWeight: '700', color: colors.ink },
  heading: { fontSize: 21, fontWeight: '600', color: colors.ink },
  notice: { padding: 18, borderRadius: 16, backgroundColor: colors.accent },
  card: { padding: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, gap: 8 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  detail: { fontSize: 14, color: colors.muted },
  button: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.surface, fontWeight: '600', fontSize: 16 },
});