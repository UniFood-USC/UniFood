import { adminServices } from './firebase';
import { checkedIdentity } from './identity';
import { applyChange, type Actor, type Change, type ChangeResult } from '../../src/services/orders/changeOrder';
import { response } from '../../src/domain/response';
import type { Order } from '../../src/types/domain';

type OrderFilter = { studentId?: string; restaurantId?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function orderFilter(input: unknown): OrderFilter | null {
  if (!isRecord(input) || Object.keys(input).some(key => !['studentId', 'restaurantId'].includes(key))) return null;
  const { studentId, restaurantId } = input;
  if (studentId !== undefined && (typeof studentId !== 'string' || !studentId || studentId.includes('/'))) return null;
  if (restaurantId !== undefined && (typeof restaurantId !== 'string' || !restaurantId || restaurantId.includes('/'))) return null;
  return {
    ...(typeof studentId === 'string' ? { studentId } : {}),
    ...(typeof restaurantId === 'string' ? { restaurantId } : {}),
  };
}

function toOrder(id: string, data: FirebaseFirestore.DocumentData): Order {
  return {
    id,
    studentId: data.studentId,
    restaurantId: data.restaurantId,
    mode: data.mode,
    status: data.status,
    paymentMethod: data.paymentMethod,
    total: data.total,
    paid: data.paid,
    version: data.version,
    ...(data.updatedBy ? { updatedBy: data.updatedBy } : {}),
    ...(data.refund ? { refund: data.refund } : {}),
    ...(data.scheduledFor !== undefined ? { scheduledFor: data.scheduledFor } : {}),
    ...(data.estimateMinutes !== undefined ? { estimateMinutes: data.estimateMinutes } : {}),
    ...(data.estimatedReadyAt !== undefined ? { estimatedReadyAt: data.estimatedReadyAt } : {}),
    ...(data.statusHistory ? { statusHistory: data.statusHistory } : {}),
    ...(data.cancelledBy ? { cancelledBy: data.cancelledBy } : {}),
    ...(data.cancelReason ? { cancelReason: data.cancelReason } : {}),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function canAccess(order: Order, actor: Actor) {
  return actor.role === 'admin'
    || (actor.role === 'student' && order.studentId === actor.id)
    || (actor.role === 'restaurant' && !!actor.restaurantId && order.restaurantId === actor.restaurantId);
}

function verifiedActor(identity: Awaited<ReturnType<typeof checkedIdentity>>): Actor {
  return { id: identity.id, role: identity.role, ...(identity.restaurantId ? { restaurantId: identity.restaurantId } : {}) };
}

export async function listOrders(authorization: string | undefined, input: unknown) {
  const identity = await checkedIdentity(authorization, {});
  const actor = verifiedActor(identity);
  const filter = orderFilter(input);
  if (!filter) return response('VALIDACION', 'Revisa los filtros de consulta.');
  if (actor.role === 'restaurant' && !actor.restaurantId) {
    return response('NO_AUTORIZADO', 'La cuenta no está vinculada a un restaurante.');
  }
  if (actor.role === 'student' && filter.studentId && filter.studentId !== actor.id) {
    return response('NO_AUTORIZADO', 'Solo puedes consultar tus propios pedidos.');
  }
  if (actor.role === 'restaurant' && filter.restaurantId && filter.restaurantId !== actor.restaurantId) {
    return response('NO_AUTORIZADO', 'Solo puedes consultar los pedidos de tu restaurante.');
  }
  if (!['student', 'restaurant', 'admin'].includes(actor.role)) {
    return response('NO_AUTORIZADO', 'No tienes permiso para consultar pedidos.');
  }

  const snapshot = actor.role === 'student'
    ? await adminServices().db.collection('orders').where('studentId', '==', actor.id).get()
    : actor.role === 'restaurant'
      ? await adminServices().db.collection('orders').where('restaurantId', '==', actor.restaurantId).get()
      : await adminServices().db.collection('orders').get();
  const orders = snapshot.docs
    .map(doc => toOrder(doc.id, doc.data()))
    .filter(order => (!filter.studentId || order.studentId === filter.studentId)
      && (!filter.restaurantId || order.restaurantId === filter.restaurantId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return response('OK', 'Pedidos consultados.', { orders });
}

export async function getOrder(authorization: string | undefined, input: unknown) {
  const identity = await checkedIdentity(authorization, {});
  const actor = verifiedActor(identity);
  if (!isRecord(input) || Object.keys(input).some(key => key !== 'id')
    || typeof input.id !== 'string' || !input.id || input.id.includes('/')) {
    return response('VALIDACION', 'Indica un pedido válido.');
  }
  const snapshot = await adminServices().db.doc(`orders/${input.id}`).get();
  if (!snapshot.exists) return response('NO_AUTORIZADO', 'No encontramos este pedido o no tienes permiso para consultarlo.');
  const order = toOrder(snapshot.id, snapshot.data()!);
  if (!canAccess(order, actor)) return response('NO_AUTORIZADO', 'No encontramos este pedido o no tienes permiso para consultarlo.');
  return response('OK', 'Pedido consultado.', { order });
}

function validChange(input: unknown): input is Change {
  if (!isRecord(input) || typeof input.type !== 'string') return false;
  if (input.type === 'advance') {
    return Object.keys(input).every(key => ['type', 'estimateMinutes'].includes(key))
      && (input.estimateMinutes === undefined || (typeof input.estimateMinutes === 'number' && Number.isInteger(input.estimateMinutes)));
  }
  if (input.type === 'cancel') {
    return Object.keys(input).every(key => ['type', 'reason'].includes(key))
      && (input.reason === undefined || (typeof input.reason === 'string' && input.reason.length <= 500));
  }
  if (input.type === 'registerPayment') return Object.keys(input).length === 1;
  if (input.type === 'updateEstimate') {
    return Object.keys(input).every(key => ['type', 'minutes'].includes(key))
      && typeof input.minutes === 'number' && Number.isInteger(input.minutes);
  }
  return false;
}

export async function changeOrder(authorization: string | undefined, input: unknown) {
  const identity = await checkedIdentity(authorization, {});
  const actor = verifiedActor(identity);
  if (!isRecord(input) || Object.keys(input).some(key => !['id', 'change', 'expectedVersion'].includes(key))
    || typeof input.id !== 'string' || !input.id || input.id.includes('/')
    || !Number.isInteger(input.expectedVersion) || Number(input.expectedVersion) < 0
    || !validChange(input.change)) {
    return response('VALIDACION', 'Revisa los datos del cambio de pedido.');
  }

  const db = adminServices().db;
  const ref = db.doc(`orders/${input.id}`);
  const result = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {
      return { ok: false, error: 'not_found', message: 'No encontramos este pedido.' } as ChangeResult;
    }
    const current = toOrder(snapshot.id, snapshot.data()!);
    if (!canAccess(current, actor)) {
      return { ok: false, error: 'not_found', message: 'No encontramos este pedido.' } as ChangeResult;
    }
    const changeResult = applyChange(current, input.change as Change, actor, Number(input.expectedVersion));
    if (changeResult.ok) {
      const { id: _id, ...updated } = changeResult.order;
      tx.set(ref, updated);
    }
    return changeResult;
  });
  return response('OK', result.ok ? 'Pedido actualizado.' : result.message, { result });
}
