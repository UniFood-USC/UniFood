import { createHash } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { adminServices } from './firebase';
import { response } from '../../src/domain/response';
import { createClock } from '../../src/domain/clock';
import {
  parseOutcome, paymentPlan, purchaseFingerprint, refundAmount, validatePurchase,
  type PaymentMovement, type PaymentPlan, type PurchaseContent,
} from '../../src/domain/payments';

// Pagos simulados (RF-09, RF-10, RF-18). Solo el servicio confiable escribe estas colecciones;
// las reglas de Firestore ya niegan cualquier lectura o escritura desde la app.
// userId llega siempre de la identidad comprobada (checkedIdentity), nunca del cuerpo.
//   purchaseAttempts/{attemptId}   attemptId = sha256(cuenta + clave)
//   paymentMovements/pay_{attemptId}   un único pago por intento
//   paymentMovements/ref_{paymentId}   un único reembolso por pago

export type AttemptState = 'created' | 'paid' | 'payment_failed';
export type PurchaseAttempt = PurchaseContent & {
  id: string; userId: string; attemptKey: string; fingerprint: string; plan: PaymentPlan; state: AttemptState;
  orderId: string | null; paymentId: string | null; refundId: string | null; createdAt: string;
};
type Dependencies = { db?: Firestore; clock?: ReturnType<typeof createClock> };

export const attemptId = (userId: string, attemptKey: string) => createHash('sha256').update(`${userId}\n${attemptKey}`).digest('hex');
const fingerprintHash = (content: PurchaseContent) => createHash('sha256').update(purchaseFingerprint(content)).digest('hex');

// La cuenta y la clave identifican una compra lógica. Repetir con el mismo contenido
// devuelve el mismo intento; reutilizar la clave con otro contenido se rechaza.
export async function registerAttempt(userId: string, input: unknown, { db = adminServices().db, clock = createClock() }: Dependencies = {}) {
  let request;
  try { request = validatePurchase(input); }
  catch (error) { return response('VALIDACION', (error as Error).message); }
  const id = attemptId(userId, request.attemptKey);
  const fingerprint = fingerprintHash(request.content);
  const ref = db.doc(`purchaseAttempts/${id}`);
  return db.runTransaction(async tx => {
    const existing = (await tx.get(ref)).data() as PurchaseAttempt | undefined;
    if (existing) {
      if (existing.fingerprint !== fingerprint) return response('CLAVE_EN_USO', 'Esta clave ya pertenece a otra compra. Revisa el resumen y confirma de nuevo.');
      return response('OK', 'Intento de compra existente.', { attempt: existing, reused: true });
    }
    const attempt: PurchaseAttempt = {
      id, userId, attemptKey: request.attemptKey, fingerprint, ...request.content, plan: paymentPlan(request.content),
      state: 'created', orderId: null, paymentId: null, refundId: null, createdAt: clock.now().toISOString(),
    };
    tx.create(ref, attempt);
    return response('OK', 'Intento de compra registrado.', { attempt, reused: false });
  });
}

// Nequi o tarjeta producen un resultado controlado (éxito por defecto, o fallo pedido
// explícitamente para la demo). No se crea ningún pedido aquí; ante fallo el carrito se conserva.
// Un intento fallido queda cerrado: reintentar o cambiar de método usa una clave nueva.
export async function simulatePayment(userId: string, attemptKey: string, outcomeInput?: unknown, { db = adminServices().db, clock = createClock() }: Dependencies = {}) {
  let outcome;
  try { outcome = parseOutcome(outcomeInput); }
  catch (error) { return response('VALIDACION', (error as Error).message); }
  if (typeof attemptKey !== 'string' || !attemptKey) return response('VALIDACION', 'Falta la clave del intento.');
  const id = attemptId(userId, attemptKey);
  const attemptRef = db.doc(`purchaseAttempts/${id}`);
  const paymentRef = db.doc(`paymentMovements/pay_${id}`);
  const result = await db.runTransaction(async tx => {
    const [attemptSnapshot, paymentSnapshot] = await Promise.all([tx.get(attemptRef), tx.get(paymentRef)]);
    const attempt = attemptSnapshot.data() as PurchaseAttempt | undefined;
    if (!attempt) return response('VALIDACION', 'El intento de compra no existe.');
    if (attempt.plan !== 'simulate') return response('VALIDACION', attempt.plan === 'none' ? 'Un total de $0 no requiere pago.' : 'El efectivo se paga al recibir el pedido.');
    const previous = paymentSnapshot.data() as PaymentMovement | undefined;
    if (previous) return response('OK', 'Pago simulado existente.', previous);
    const payment: PaymentMovement = {
      id: paymentRef.id, attemptId: id, orderId: null, kind: 'payment', state: outcome === 'success' ? 'completed' : 'failed',
      amountCOP: attempt.totalCOP, method: attempt.method!, originalId: null, simulated: true, createdAt: clock.now().toISOString(),
    };
    tx.create(paymentRef, payment);
    tx.update(attemptRef, { state: payment.state === 'completed' ? 'paid' : 'payment_failed', paymentId: payment.id });
    return response('OK', 'Pago simulado registrado.', payment);
  });
  if (result.datos?.state === 'failed') {
    return response('PAGO_FALLIDO', 'El pago simulado no se completó. Tu carrito se conserva: reintenta o cambia de método.', result.datos, true);
  }
  return result;
}

// Un solo reembolso por pago, por el total, aunque todavía no exista pedido.
// Para participar en la misma transacción que una cancelación o una compensación de compra:
// llamar ANTES de cualquier escritura de esa transacción, porque Firestore exige leer primero.
export async function refundInTransaction(tx: Transaction, db: Firestore, paymentId: string, { orderId = null, reason, clock = createClock() }: { orderId?: string | null; reason: string; clock?: ReturnType<typeof createClock> }) {
  if (typeof paymentId !== 'string' || !/^pay_[a-f0-9]{64}$/.test(paymentId)) return response('VALIDACION', 'El pago no es válido.');
  if (typeof reason !== 'string' || !reason.trim()) return response('VALIDACION', 'El reembolso requiere un motivo.');
  const paymentRef = db.doc(`paymentMovements/${paymentId}`);
  const refundRef = db.doc(`paymentMovements/ref_${paymentId}`);
  const [paymentSnapshot, refundSnapshot] = await Promise.all([tx.get(paymentRef), tx.get(refundRef)]);
  const payment = paymentSnapshot.data() as PaymentMovement | undefined;
  if (!payment) return response('VALIDACION', 'El pago no existe.');
  const previous = refundSnapshot.data() as PaymentMovement | undefined;
  if (previous) return response('OK', 'El pago ya estaba reembolsado.', { refund: previous, reused: true });
  let amountCOP;
  try { amountCOP = refundAmount(payment); }
  catch (error) { return response('VALIDACION', (error as Error).message); }
  const refund: PaymentMovement & { reason: string } = {
    id: refundRef.id, attemptId: payment.attemptId, orderId: orderId ?? payment.orderId, kind: 'refund', state: 'completed',
    amountCOP, method: payment.method, originalId: payment.id, simulated: true, createdAt: clock.now().toISOString(), reason: reason.trim(),
  };
  tx.create(refundRef, refund);
  tx.update(db.doc(`purchaseAttempts/${payment.attemptId}`), { refundId: refund.id });
  return response('OK', 'Reembolso simulado registrado.', { refund, reused: false });
}

export async function refundPayment(paymentId: string, options: { orderId?: string | null; reason: string }, { db = adminServices().db, clock = createClock() }: Dependencies = {}) {
  return db.runTransaction(tx => refundInTransaction(tx, db, paymentId, { ...options, clock }));
}
