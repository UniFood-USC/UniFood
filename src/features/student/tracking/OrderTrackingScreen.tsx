import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../../constants/theme';
import { routes } from '../../../constants/routes';
import { Order } from '../../../types/domain';
import { OrderStatusStepper } from './OrderStatusStepper';
import { mockOrders } from './orderRepository';
import { STATUS_FLOW, isTerminal, statusLabel } from './statusFlow';
import { useOrderTracking } from './useOrderTracking';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

function useIsLate(order: Order | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    !!order?.estimatedReadyAt &&
    !isTerminal(order.status) &&
    now > new Date(order.estimatedReadyAt).getTime()
  );
}

export default function OrderTrackingScreen({ orderId = 'UC1023' }: { orderId?: string }) {
  const router = useRouter();
  const { order, error, loading } = useOrderTracking(mockOrders.repo, orderId);
  const late = useIsLate(order);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(routes.student));

  if (loading) {
    return <ActivityIndicator style={styles.center} color={colors.primary} accessibilityLabel="Cargando pedido" />;
  }
  if (error) return <Message text="No pudimos cargar tu pedido. Intenta de nuevo más tarde." onBack={goBack} />;
  if (!order) return <Message text="No encontramos este pedido." onBack={goBack} />;

  const cancelled = order.status === 'cancelled';
  const scheduledWaiting = order.status === 'received' && !!order.scheduledFor;
  const waitingForReady = order.status === 'received' || order.status === 'preparing';
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
        </View>
      ) : (
        <>
          <OrderStatusStepper mode={order.mode} status={order.status} history={history} />
          {late ? (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text style={styles.body}>Tu pedido está tardando más de lo estimado. Gracias por tu paciencia.</Text>
            </View>
          ) : waitingForReady ? (
            <View style={styles.notice}>
              <Text style={styles.body}>Te avisaremos cuando esté listo.</Text>
            </View>
          ) : null}
        </>
      )}

      {__DEV__ && <DevControls mode={order.mode} />}
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

// Solo desarrollo: simula al restaurante cambiando el estado
function DevControls({ mode }: { mode: Order['mode'] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.detail}>Controles de prueba (solo desarrollo)</Text>
      {STATUS_FLOW[mode].slice(1).map((s) => (
        <Pressable key={s} accessibilityRole="button" style={styles.button} onPress={() => mockOrders.setStatus(s)}>
          <Text style={styles.buttonText}>Simular: {statusLabel(s, mode)}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        style={styles.button}
        onPress={() => mockOrders.patch({ status: 'cancelled', cancelledBy: 'restaurant', cancelReason: 'Producto agotado' })}
      >
        <Text style={styles.buttonText}>Simular: cancelado</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => mockOrders.toggleMode()}>
        <Text style={styles.buttonText}>Cambiar modalidad ({mode === 'pickup' ? 'a entrega' : 'a recogida'})</Text>
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
  orderId: { fontSize: 20, fontWeight: '700', color: colors.ink },
  heading: { fontSize: 21, fontWeight: '600', color: colors.ink },
  notice: { padding: 18, borderRadius: 16, backgroundColor: colors.accent },
  card: { padding: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, gap: 8 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  detail: { fontSize: 14, color: colors.muted },
  button: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.surface, fontWeight: '600', fontSize: 16 },
});
