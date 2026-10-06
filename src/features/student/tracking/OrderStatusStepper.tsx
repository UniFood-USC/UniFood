import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../constants/theme';
import { FulfillmentMode, Order, OrderStatus } from '../../../types/domain';
import { STATUS_FLOW, statusLabel } from '../../../services/orders/statusFlow';

type Props = { mode: FulfillmentMode; status: OrderStatus; history?: Order['statusHistory'] };

const time = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '';

export function OrderStatusStepper({ mode, status, history }: Props) {
  const steps = STATUS_FLOW[mode];
  const current = steps.indexOf(status);

  return (
    <View accessibilityRole="list">
      {steps.map((s, i) => {
        const reached = i <= current;
        const active = i === current;
        const last = i === steps.length - 1;
        const detail = reached ? time(history?.[s as keyof NonNullable<Order['statusHistory']>]) : 'Pendiente';
        const state = active ? 'estado actual' : reached ? 'completado' : 'pendiente';
        return (
          <View
            key={s}
            accessible
            accessibilityLabel={`${statusLabel(s, mode)}, ${state}${reached && detail ? `, ${detail}` : ''}`}
            style={styles.row}
          >
            <View style={styles.rail} importantForAccessibility="no-hide-descendants">
              <View style={[styles.dot, reached && styles.dotReached]}>
                {reached && <Text style={styles.check}>✓</Text>}
              </View>
              {!last && <View style={[styles.line, i < current && styles.lineReached]} />}
            </View>
            <View style={styles.text}>
              <Text style={[styles.label, reached ? styles.labelReached : null, active && styles.labelActive]}>
                {statusLabel(s, mode)}
              </Text>
              <Text style={styles.detail}>{detail}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16, minHeight: 72 },
  rail: { alignItems: 'center', width: 28 },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  dotReached: { borderColor: colors.primary, backgroundColor: colors.primary },
  check: { color: colors.surface, fontSize: 16, fontWeight: '700' },
  line: { flex: 1, width: 2, marginVertical: 2, backgroundColor: colors.border },
  lineReached: { backgroundColor: colors.primary },
  text: { flex: 1, paddingTop: 2, paddingBottom: 16 },
  label: { fontSize: 16, lineHeight: 24, color: colors.muted },
  labelReached: { color: colors.ink },
  labelActive: { fontWeight: '700' },
  detail: { fontSize: 14, lineHeight: 20, color: colors.muted },
});