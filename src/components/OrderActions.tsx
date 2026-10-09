import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../constants/theme';
import { Order } from '../types/domain';
import { Actor, Change, allowedActions } from '../services/orders/changeOrder';
import { mockOrders } from '../services/orders/orderRepository';
import { statusLabel } from '../services/orders/statusFlow';

function advanceLabel(order: Order, next: Order['status']) {
  if (next === 'preparing') return 'Iniciar preparación';
  if (next === 'collected') return 'Confirmar entrega';
  return `Marcar: ${statusLabel(next, order.mode)}`;
}

export function OrderActions({ order, actor }: { order: Order; actor: Actor }) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const a = allowedActions(order, actor);
  if (!a.canAdvance && !a.canCancel && !a.needsPayment) return null;

  async function run(change: Change) {
    setBusy(true);
    const res = await mockOrders.repo.change(order.id, change, actor, order.version);
    setBusy(false);
    if (!res.ok) { setMessage(res.message); return; }
    setMessage(null); setCancelling(false); setReason(''); setCode('');
  }

  function advance() {
    if (a.nextStatus === 'collected' && code.trim().toUpperCase() !== order.id.toUpperCase()) {
      setMessage('El número no coincide con el que muestra el estudiante.');
      return;
    }
    run({ type: 'advance' });
  }

  return (
    <View style={styles.box}>
      {a.needsPayment && (
        <>
          <Text style={styles.warn}>{a.blockedMessage}</Text>
          <Btn label="Registrar pago" disabled={busy} onPress={() => run({ type: 'registerPayment' })} />
        </>
      )}

      {a.canAdvance && a.nextStatus && !cancelling && (
        <>
          {a.nextStatus === 'collected' && (
            <TextInput
              value={code} onChangeText={setCode} autoCapitalize="characters"
              placeholder="Número de pedido que muestra el estudiante"
              accessibilityLabel="Número de pedido que muestra el estudiante"
              placeholderTextColor={colors.muted} style={styles.input}
            />
          )}
          <Btn label={advanceLabel(order, a.nextStatus)} disabled={busy} onPress={advance} />
        </>
      )}

      {a.canCancel && !cancelling && (
        <Btn label="Cancelar pedido" secondary disabled={busy} onPress={() => { setCancelling(true); setMessage(null); }} />
      )}

      {cancelling && (
        <>
          <TextInput
            value={reason} onChangeText={setReason} multiline
            placeholder={a.cancelNeedsReason ? 'Motivo (obligatorio)' : 'Motivo (opcional)'}
            accessibilityLabel={a.cancelNeedsReason ? 'Motivo de cancelación, obligatorio' : 'Motivo de cancelación, opcional'}
            placeholderTextColor={colors.muted} style={[styles.input, { minHeight: 72 }]}
          />
          <Btn label="Confirmar cancelación" disabled={busy} onPress={() => run({ type: 'cancel', reason })} />
          <Btn label="Volver" secondary onPress={() => { setCancelling(false); setMessage(null); }} />
        </>
      )}

      {message ? <Text accessibilityLiveRegion="polite" style={styles.error}>{message}</Text> : null}
    </View>
  );
}

function Btn({ label, onPress, secondary, disabled }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={[styles.btn, secondary && styles.btnSecondary, disabled && { opacity: 0.6 }]}>
      <Text style={[styles.btnText, secondary && styles.btnTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  btn: { minHeight: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  btnText: { color: colors.surface, fontWeight: '600', fontSize: 16 },
  btnTextSecondary: { color: colors.primary },
  input: { borderWidth: 1, borderColor: colors.muted, borderRadius: 12, padding: 12, fontSize: 16, color: colors.ink, backgroundColor: colors.surface },
  warn: { fontSize: 15, color: colors.ink },
  error: { fontSize: 15, color: colors.ink, backgroundColor: colors.accent, borderRadius: 12, padding: 12 },
});