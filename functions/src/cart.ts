import type { DocumentData } from 'firebase-admin/firestore';
import { adminServices } from './firebase';
import { checkedIdentity } from './identity';
import { response } from '../../src/domain/response';
import { createClock } from '../../src/domain/clock';
import { validateCartSave, type StoredCart } from '../../src/domain/cart';

// RF-07 · Carrito por cuenta (carts/{userId}). La cuenta sale siempre de la sesión
// comprobada, así que nadie consulta ni modifica el carrito de otra persona.
// Cerrar sesión no lo borra; se vacía al confirmar la compra.
async function studentCart(authorization: string | undefined) {
  const actor = await checkedIdentity(authorization, {});
  return actor.role === 'student' ? adminServices().db.doc(`carts/${actor.id}`) : null;
}

const current = (data: DocumentData | undefined) => ({
  cart: (data ? { restaurantId: data.restaurantId, lines: data.lines } : { restaurantId: null, lines: [] }) as StoredCart,
  version: (data?.version ?? 0) as number,
});

export async function readCart(authorization: string | undefined) {
  const ref = await studentCart(authorization);
  if (!ref) return response('NO_AUTORIZADO', 'Solo los estudiantes tienen carrito.');
  return response('OK', 'Carrito consultado.', current((await ref.get()).data()));
}

// Con varios dispositivos prevalece el último cambio confirmado: un cambio hecho
// sobre una versión anterior no se aplica y recibe el carrito vigente para revisarlo.
export async function saveCart(authorization: string | undefined, input: unknown) {
  const ref = await studentCart(authorization);
  if (!ref) return response('NO_AUTORIZADO', 'Solo los estudiantes tienen carrito.');
  let change;
  try { change = validateCartSave(input); }
  catch (error) { return response('VALIDACION', (error as Error).message); }
  const { db } = adminServices();
  return db.runTransaction(async tx => {
    const stored = current((await tx.get(ref)).data());
    if (stored.version !== change.version) return response('CONFLICTO_VERSION', 'Tu carrito cambió en otro dispositivo.', stored);
    const version = stored.version + 1;
    tx.set(ref, { ...change.cart, userId: ref.id, version, updatedAt: createClock().now().toISOString() });
    return response('OK', 'Carrito guardado.', { cart: change.cart, version });
  });
}
