import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/theme';
import { addToStoredCart, fromMenuProduct, type MenuProduct, type StoredCart } from '../../domain/cart';
import type { ServiceResponse } from '../../domain/response';

type Service = (action: 'cart/get' | 'cart/save', input: unknown) => Promise<ServiceResponse>;
type Stored = { cart: StoredCart; version: number };

// RF-07 · Agregar un producto del menú al carrito guardado. Siempre parte del carrito vigente
// en el servicio y lo guarda con su versión: si otro dispositivo cambió el carrito, no lo pisa.
export default function AddToCartButton({ restaurantId, product, service }: { restaurantId: string; product: MenuProduct; service: Service }) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState('');
  const sending = useRef(false);

  async function add(replaceRestaurant: boolean) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setMessage(''); setAsking(false);
    try {
      const current = await service('cart/get', {});
      if (current.codigo !== 'OK') { setMessage(current.mensaje); return; }
      const { cart, version } = current.datos as Stored;
      let result;
      try { result = addToStoredCart(cart, fromMenuProduct(restaurantId, product), 1, replaceRestaurant); }
      catch { setMessage('Ya tienes 20 unidades de este producto en el carrito.'); return; }
      if (result.requiresConfirmation) { setAsking(true); return; }
      const saved = await service('cart/save', { ...result.cart, version });
      setMessage(saved.codigo === 'OK' ? `${product.nombre} se agregó al carrito.`
        : saved.codigo === 'CONFLICTO_VERSION' ? 'Tu carrito cambió en otro dispositivo. Vuelve a intentarlo.' : saved.mensaje);
    } catch { setMessage('No se agregó el producto. Revisa la conexión y reintenta.'); }
    finally { sending.current = false; setBusy(false); }
  }

  if (!product.disponible) return <Pressable accessibilityRole="button" accessibilityLabel={`${product.nombre} está agotado`} accessibilityState={{ disabled: true }} disabled style={[styles.button, styles.dimmed]}>
    <Text style={styles.label}>Agotado</Text>
  </Pressable>;
  return <View style={styles.box}>
    {asking ? <View accessibilityLiveRegion="polite" style={styles.confirm}>
      <Text style={styles.text}>Tu carrito tiene productos de otro restaurante. ¿Vaciarlo y empezar con este?</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void add(true); }} style={styles.button}><Text style={styles.label}>Vaciar y agregar</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => setAsking(false)} style={[styles.button, styles.secondary]}><Text style={styles.secondaryLabel}>Conservar mi carrito</Text></Pressable>
    </View> : <Pressable accessibilityRole="button" accessibilityLabel={`Agregar ${product.nombre} al carrito`} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => { void add(false); }} style={[styles.button, busy && styles.dimmed]}>
      <Text style={styles.label}>{busy ? 'Agregando…' : 'Agregar al carrito'}</Text>
    </Pressable>}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  confirm: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.accent },
  button: { minHeight: 54, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.surface, fontSize: 17, fontWeight: '700' },
  secondaryLabel: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  text: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  dimmed: { opacity: 0.5 },
});
