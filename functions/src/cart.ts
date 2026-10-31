import { FieldValue } from 'firebase-admin/firestore';
import { adminServices } from './firebase';
import { checkedIdentity } from './identity';
import { response } from '../../src/domain/response';
import { createClock } from '../../src/domain/clock';
import { validateStoredCart, type StoredCart } from '../../src/domain/cart';

// RF-07 · Carrito por cuenta (carts/{userId}). La cuenta sale siempre de la sesión
// comprobada, así que nadie consulta ni modifica el carrito de otra persona.
// Cerrar sesión no lo borra; se vacía al confirmar la compra.
async function studentCart(authorization: string | undefined) {
  const actor = await checkedIdentity(authorization, {});
  return actor.role === 'student' ? adminServices().db.doc(`carts/${actor.id}`) : null;
}

export async function readCart(authorization: string | undefined) {
  const ref = await studentCart(authorization);
  if (!ref) return response('NO_AUTORIZADO', 'Solo los estudiantes tienen carrito.');
  const data = (await ref.get()).data();
  const cart: StoredCart = data ? { restaurantId: data.restaurantId, lines: data.lines } : { restaurantId: null, lines: [] };
  return response('OK', 'Carrito consultado.', { cart });
}

export async function saveCart(authorization: string | undefined, input: unknown) {
  const ref = await studentCart(authorization);
  if (!ref) return response('NO_AUTORIZADO', 'Solo los estudiantes tienen carrito.');
  let cart;
  try { cart = validateStoredCart(input); }
  catch (error) { return response('VALIDACION', (error as Error).message); }
  await ref.set({ ...cart, userId: ref.id, version: FieldValue.increment(1), updatedAt: createClock().now().toISOString() }, { merge: true });
  return response('OK', 'Carrito guardado.', { cart });
}
