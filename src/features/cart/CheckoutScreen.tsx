import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '../../constants/theme';
import { routes } from '../../constants/routes';
import { formatCOP } from '../../domain/cart';
import type { ServiceResponse } from '../../domain/response';
import type { Order, PaymentMethod } from '../../types/domain';

type Service = (action: 'checkout/place', input: unknown) => Promise<ServiceResponse>;
const methods: { value: PaymentMethod; label: string; detail?: string; icon: 'smartphone' | 'credit-card' | 'dollar-sign' }[] = [
  { value: 'nequi', label: 'Nequi', icon: 'smartphone' },
  { value: 'card', label: 'Tarjeta de débito o crédito', icon: 'credit-card' },
  { value: 'cash', label: 'Efectivo', detail: 'Pagas en el restaurante', icon: 'dollar-sign' },
];
const newKey = () => `compra_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

// RF-09, RF-10 · Método de pago y confirmación. Los pagos son simulados: nunca se piden datos
// financieros. La misma clave se reutiliza al reintentar tras perder la conexión, así el servicio
// devuelve el mismo pedido; tras un rechazo, el siguiente intento es una compra nueva.
export default function CheckoutScreen({ service }: { service: Service }) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>('nequi');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const attemptKey = useRef(newKey());

  async function confirm() {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await service('checkout/place', { attemptKey: attemptKey.current, method });
      if (result.codigo === 'OK') setOrder((result.datos as { order: Order }).order);
      else { setMessage(result.mensaje); attemptKey.current = newKey(); }
    } catch {
      setMessage('No pudimos confirmar si se creó el pedido. Revisa la conexión y vuelve a pulsar Confirmar: no se cobrará dos veces.');
    } finally { setBusy(false); }
  }

  if (order) return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.done}><Feather name="check-circle" size={56} color={colors.primary} accessible={false} /></View>
    <Text accessibilityRole="header" style={styles.title}>¡Pedido confirmado!</Text>
    <Text style={styles.muted}>Número de pedido</Text>
    <Text style={styles.number}>#{order.id}</Text>
    <Text style={styles.body}>{order.paid ? `Pago simulado aprobado: ${formatCOP(order.total)}` : order.total ? `Pagas ${formatCOP(order.total)} en efectivo al recoger.` : 'Pedido sin costo.'}</Text>
    <Pressable accessibilityRole="button" onPress={() => router.replace(routes.orderTracking(order.id))} style={styles.button}>
      <Text style={styles.buttonText}>Ver estado del pedido</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/student')} style={styles.link}>
      <Text style={styles.linkText}>Volver al inicio</Text>
    </Pressable>
  </ScrollView>;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.muted}>Pago simulado: no se hacen cobros reales ni se piden datos de tarjeta.</Text>
    {methods.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label}
      accessibilityState={{ checked: method === option.value }} onPress={() => setMethod(option.value)}
      style={[styles.option, method === option.value && styles.selected]}>
      <Feather name={option.icon} size={22} color={colors.primary} accessible={false} />
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{option.label}</Text>
        {option.detail && <Text style={styles.muted}>{option.detail}</Text>}
      </View>
      {method === option.value && <Feather name="check-circle" size={20} color={colors.primary} accessible={false} />}
    </Pressable>)}
    {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Confirmar pedido" accessibilityState={{ disabled: busy }} disabled={busy}
      onPress={() => { void confirm(); }} style={[styles.button, busy && styles.dimmed]}>
      <Text style={styles.buttonText}>{busy ? 'Confirmando…' : 'Confirmar pedido'}</Text>
    </Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14, width: '100%', maxWidth: 760, alignSelf: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  selected: { borderColor: colors.primary, borderWidth: 2 },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 16, fontWeight: '700', color: colors.ink },
  muted: { fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 22, color: colors.ink, padding: 12, borderRadius: 12, backgroundColor: colors.accent },
  button: { minHeight: 54, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  buttonText: { color: colors.surface, fontSize: 18, fontWeight: '700' },
  dimmed: { opacity: 0.5 },
  done: { alignItems: 'center', marginTop: 24 },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  number: { fontSize: 28, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink, textAlign: 'center' },
  link: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
});
