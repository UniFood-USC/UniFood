import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { createClock } from '../domain/clock';
import { estimateState } from '../services/orders/estimate';
import { Order } from '../types/domain';

// Lee Date.now en cada llamada (no al cargar el módulo), para respetar relojes simulados.
const clock = createClock(() => Date.now());
const REFRESH_MS = 30_000;

export function EstimateNotice({ order }: { order: Order }) {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const t = setInterval(() => setNow(clock.now()), REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  let text: string | null = null;
  if (order.status === 'received') {
    text = 'Te avisaremos cuando esté listo.';
  } else {
    const s = estimateState(order, now);
    if (s.kind === 'missing') text = 'El restaurante aún no indicó el tiempo estimado de preparación.';
    if (s.kind === 'remaining') {
      text = `Tiempo estimado de preparación: ${s.minutes} min restantes. Es una estimación y puede cambiar.`;
    }
    if (s.kind === 'late') text = 'El pedido está tardando más de lo estimado.';
  }
  if (!text) return null;

  return (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { padding: 18, borderRadius: 16, backgroundColor: colors.accent },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
});