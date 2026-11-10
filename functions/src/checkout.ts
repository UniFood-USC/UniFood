import { adminServices } from './firebase';
import { checkedIdentity } from './identity';
import { attemptId, refundInTransaction, registerAttempt, simulatePayment, type PurchaseAttempt } from './payments';
import { materializeNotices } from './notifications';
import { response } from '../../src/domain/response';
import { createClock } from '../../src/domain/clock';
import { cartTotals, toProduct, type CartLine, type StoredCart } from '../../src/domain/cart';
import { aProductoMenu } from '../../src/domain/menu';
import { aRestaurantePublico } from '../../src/domain/restaurants';
import type { ProductoDoc } from '../../src/types/Menu';
import type { RestauranteDoc } from '../../src/types/Estado_Restaurante';
import type { Order, PaymentMethod } from '../../src/types/domain';

// RF-07, RF-09, RF-10 · Confirmar la compra del carrito. El total se calcula aquí con el menú
// vigente (nunca con lo que envía la app); Nequi y tarjeta se cobran con el pago simulado antes
// de crear el pedido; el efectivo queda pendiente. La clave del intento hace que repetir la
// confirmación devuelva el mismo pedido. Versión de demostración: recogida, sin programación.
const FIRST_NUMBER = 3001;

export async function placeOrder(authorization: string | undefined, input: unknown) {
  const actor = await checkedIdentity(authorization, {});
  if (actor.role !== 'student') return response('NO_AUTORIZADO', 'Solo los estudiantes confirman compras.');
  const data = (input ?? {}) as Record<string, unknown>;
  if (Object.keys(data).some(key => !['attemptKey', 'method'].includes(key)) || typeof data.attemptKey !== 'string') return response('VALIDACION', 'Revisa los datos de la compra.');
  const { db } = adminServices();
  const clock = createClock();
  const attemptRef = db.doc(`purchaseAttempts/${attemptId(actor.id, data.attemptKey)}`);
  const previous = (await attemptRef.get()).data() as PurchaseAttempt | undefined;
  if (previous?.orderId) return response('OK', 'Pedido confirmado.', { order: (await db.doc(`orders/${previous.orderId}`).get()).data() });

  const cartRef = db.doc(`carts/${actor.id}`);
  const cartData = (await cartRef.get()).data();
  const cart: StoredCart = { restaurantId: cartData?.restaurantId ?? null, lines: cartData?.lines ?? [] };
  if (!cart.restaurantId || !cart.lines.length) return response('VALIDACION', 'Tu carrito está vacío.');
  const restaurantId = cart.restaurantId;
  const now = clock.now();
  const restaurant = await db.doc(`restaurantes/${restaurantId}`).get();
  const open = restaurant.exists ? aRestaurantePublico({ id: restaurantId, data: restaurant.data() as Partial<RestauranteDoc> }, now) : null;
  if (!open?.disponible) return response('RESTAURANTE_CERRADO', 'El restaurante no está atendiendo ahora. Intenta en su horario.');
  const lines: CartLine[] = [];
  for (const { productId, quantity } of cart.lines) {
    const snapshot = await db.doc(`restaurantes/${restaurantId}/productos/${productId}`).get();
    const product = snapshot.exists ? aProductoMenu({ id: productId, data: snapshot.data() as Partial<ProductoDoc> }, now) : null;
    if (!product?.disponible) return response('REQUIERE_REVISION', 'Un producto del carrito ya no está disponible. Revisa tu carrito.');
    const { name, priceCOP, discountPercent } = toProduct(restaurantId, product);
    lines.push({ productId, name, priceCOP, quantity, discountPercent });
  }
  const { totalCOP } = cartTotals(lines);
  const quotedVersion = Number(cartData?.version ?? 0);
  const method = totalCOP > 0 ? data.method : null;
  const attempt = await registerAttempt(actor.id, { attemptKey: data.attemptKey, quoteId: `cart_${restaurantId}`, quoteVersion: Math.max(quotedVersion, 1), totalCOP, method });
  if (attempt.codigo !== 'OK') return attempt;
  if (attempt.datos!.attempt.plan === 'simulate') {
    const payment = await simulatePayment(actor.id, data.attemptKey, 'success');
    if (payment.codigo !== 'OK') return payment;
  }

  const result = await db.runTransaction(async tx => {
    const counterRef = db.doc('counters/orders');
    const [attemptSnapshot, cartSnapshot, counterSnapshot] = await Promise.all([tx.get(attemptRef), tx.get(cartRef), tx.get(counterRef)]);
    const stored = attemptSnapshot.data() as PurchaseAttempt;
    if (stored.orderId) return response('OK', 'Pedido confirmado.', { order: (await tx.get(db.doc(`orders/${stored.orderId}`))).data() as Order, created: false });
    // El carrito cambió durante el pago: no se confirma y el pago simulado se reembolsa.
    if (Number(cartSnapshot.data()?.version ?? 0) !== quotedVersion) {
      if (stored.paymentId) await refundInTransaction(tx, db, stored.paymentId, { reason: 'El carrito cambió durante el pago.' });
      return response('REQUIERE_REVISION', 'Tu carrito cambió mientras confirmabas. Revísalo y vuelve a confirmar.');
    }
    const number = Number(counterSnapshot.data()?.next ?? FIRST_NUMBER);
    const at = clock.now().toISOString();
    const order: Order & { attemptKey: string; lines: CartLine[] } = {
      id: `UC${number}`, studentId: actor.id, restaurantId, mode: 'pickup', status: 'received',
      paymentMethod: (method ?? 'cash') as PaymentMethod, total: totalCOP, paid: stored.plan === 'simulate', version: 1,
      statusHistory: { received: at }, createdAt: at, updatedAt: at, attemptKey: data.attemptKey as string, lines,
    };
    tx.create(db.doc(`orders/${order.id}`), order);
    tx.set(counterRef, { next: number + 1 });
    tx.update(attemptRef, { orderId: order.id });
    if (stored.paymentId) tx.update(db.doc(`paymentMovements/${stored.paymentId}`), { orderId: order.id });
    tx.set(cartRef, { userId: actor.id, restaurantId: null, lines: [], version: quotedVersion + 1, updatedAt: at });
    return response('OK', 'Pedido confirmado.', { order, created: true });
  });
  if (result.codigo !== 'OK' || !result.datos) return result;
  const { order, created } = result.datos;
  if (created) {
    const staff = await db.collection('users').where('role', '==', 'restaurant').where('restaurantId', '==', restaurantId).get();
    const recipients = staff.docs.filter(doc => doc.data().state === 'active').map(doc => doc.id);
    if (recipients.length) await materializeNotices({ id: `new_order-${order.id}`, kind: 'new_order', orderId: order.id, orderNumber: order.id, recipients, occurredAt: order.createdAt });
  }
  return response('OK', 'Pedido confirmado.', { order });
}
