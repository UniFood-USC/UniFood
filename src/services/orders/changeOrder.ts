import { Order, UserRole } from '../../types/domain';
import { STATUS_FLOW } from './statusFlow';

export interface Actor { role: UserRole; id: string; restaurantId?: string }

export const MIN_ESTIMATE = 1;
export const MAX_ESTIMATE = 180;
const ESTIMATE_MESSAGE = `Indica el tiempo estimado de preparación en minutos enteros, de ${MIN_ESTIMATE} a ${MAX_ESTIMATE}.`;

export const isValidEstimate = (minutes: unknown): minutes is number =>
  typeof minutes === 'number' && Number.isInteger(minutes) && minutes >= MIN_ESTIMATE && minutes <= MAX_ESTIMATE;

// La referencia del tiempo restante se reinicia cada vez que se registra una estimación.
const estimateFields = (minutes: number, now: Date): Partial<Order> & { estimateMinutes: number; estimatedReadyAt: string } => ({
  estimateMinutes: minutes,
  estimatedReadyAt: new Date(now.getTime() + minutes * 60_000).toISOString(),
});

export type Change =
  | { type: 'advance'; estimateMinutes?: number } // estimateMinutes es obligatorio al pasar a en preparación
  | { type: 'cancel'; reason?: string }
  | { type: 'registerPayment' }
  | { type: 'updateEstimate'; minutes: number };

export type ChangeError =
  | 'not_found' | 'stale_version' | 'not_allowed' | 'invalid_transition'
  | 'terminal' | 'reason_required' | 'payment_required' | 'invalid_estimate';

export type ChangeResult =
  | { ok: true; order: Order }
  | { ok: false; error: ChangeError; message: string; current?: Order };

const fail = (error: ChangeError, message: string, current?: Order): ChangeResult =>
  ({ ok: false, error, message, current });

const isOwner = (order: Order, actor: Actor) =>
  (actor.role === 'student' && order.studentId === actor.id) ||
  (actor.role === 'restaurant' && !!actor.restaurantId && order.restaurantId === actor.restaurantId);

export function applyChange(
  order: Order, change: Change, actor: Actor, expectedVersion: number, now: Date = new Date()
): ChangeResult {
  const iso = now.toISOString();
  const done = (next: Partial<Order>): ChangeResult => ({
    ok: true,
    order: { ...order, ...next, version: order.version + 1, updatedAt: iso, updatedBy: { role: actor.role, id: actor.id } },
  });

  // Gana la primera operación confirmada; la otra recibe el estado vigente.
  if (order.version !== expectedVersion) {
    return fail('stale_version', 'El pedido cambió mientras lo revisabas. Te mostramos su estado actual.', order);
  }
  if (order.status === 'cancelled') {
    return fail('terminal', 'El pedido está cancelado y no admite más cambios.', order);
  }
  if (order.status === 'collected' || order.status === 'delivered') {
    return fail('terminal', change.type === 'cancel'
      ? 'Un pedido recogido o entregado no se puede cancelar.'
      : 'El pedido ya fue completado.', order);
  }

  if (change.type === 'cancel') {
    const reason = change.reason?.trim() || undefined;
    if (actor.role === 'student' || actor.role === 'restaurant') {
      if (!isOwner(order, actor)) return fail('not_allowed', 'No puedes cancelar este pedido.', order);
      if (order.status !== 'received') {
        return fail('not_allowed', 'Solo se puede cancelar mientras el pedido está recibido.', order);
      }
      if (actor.role === 'restaurant' && !reason) {
        return fail('reason_required', 'El motivo de cancelación es obligatorio.', order);
      }
    } else if (actor.role === 'admin') {
      if (!reason) return fail('reason_required', 'El motivo de cancelación es obligatorio.', order);
    } else {
      return fail('not_allowed', 'No puedes cancelar este pedido.', order);
    }
    // Reembolso simulado: total pagado, una sola vez.
    const refund = order.refund ?? (order.paid ? { amount: order.total, at: iso } : undefined);
    return done({
      status: 'cancelled', cancelledBy: actor.role, cancelReason: reason, refund,
      statusHistory: { ...order.statusHistory, cancelled: iso },
    });
  }

  // Avanzar estado, registrar pago y estimar: solo el restaurante dueño.
  if (actor.role !== 'restaurant' || !isOwner(order, actor)) {
    return fail('not_allowed', 'Solo el restaurante del pedido puede hacer este cambio.', order);
  }

  if (change.type === 'registerPayment') {
    if (order.paid) return fail('invalid_transition', 'El pago ya está registrado.', order);
    return done({ paid: true });
  }

  if (change.type === 'updateEstimate') {
    if (order.status !== 'preparing') {
      return fail('invalid_transition', 'Solo se puede actualizar la estimación mientras el pedido está en preparación.', order);
    }
    if (!isValidEstimate(change.minutes)) return fail('invalid_estimate', ESTIMATE_MESSAGE, order);
    return done(estimateFields(change.minutes, now));
  }

  const flow = STATUS_FLOW[order.mode];
  const next = flow[flow.indexOf(order.status) + 1];
  if (!next) return fail('invalid_transition', 'Ese pedido no tiene un siguiente estado.', order);
  if (next === 'preparing' && !isValidEstimate(change.estimateMinutes)) {
    return fail('invalid_estimate', ESTIMATE_MESSAGE, order);
  }
  if (next === 'collected' && !(order.paid || order.total === 0)) {
    return fail('payment_required', 'Registra el pago antes de confirmar la entrega.', order);
  }
  return done({
    status: next,
    statusHistory: { ...order.statusHistory, [next]: iso },
    ...(next === 'preparing' ? estimateFields(change.estimateMinutes as number, now) : {}),
  });
}

// Qué puede hacer este actor con este pedido (usa las mismas reglas de arriba).
export function allowedActions(order: Order, actor: Actor) {
  const adv = applyChange(order, { type: 'advance', estimateMinutes: MIN_ESTIMATE }, actor, order.version);
  const can = applyChange(order, { type: 'cancel', reason: 'probe' }, actor, order.version);
  const upd = applyChange(order, { type: 'updateEstimate', minutes: MIN_ESTIMATE }, actor, order.version);
  const needsPayment = !adv.ok && adv.error === 'payment_required';
  return {
    canAdvance: adv.ok,
    nextStatus: adv.ok ? adv.order.status : null,
    needsEstimate: adv.ok && adv.order.status === 'preparing',
    canUpdateEstimate: upd.ok,
    canCancel: can.ok,
    cancelNeedsReason: actor.role !== 'student',
    needsPayment,
    blockedMessage: !adv.ok && needsPayment ? adv.message : undefined,
  };
}