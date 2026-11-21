// Reglas del intento de compra y del pago simulado (RF-09, RF-10, RF-18).
// Ningún dato financiero entra aquí: Nequi y tarjeta solo producen un resultado controlado.
import type { PaymentMethod } from '../types/domain';

export const paymentMethods: readonly PaymentMethod[] = ['nequi', 'card', 'cash'];
export type SimulationOutcome = 'success' | 'failure';
// sin_pago: total cero. efectivo: queda pendiente hasta que el restaurante lo registre.
// simular: Nequi o tarjeta deben completarse antes de crear el pedido.
export type PaymentPlan = 'none' | 'cash_pending' | 'simulate';

// Contenido que identifica una compra lógica. La cotización revisada aporta id y versión.
export type PurchaseContent = { quoteId: string; quoteVersion: number; totalCOP: number; method: PaymentMethod | null };
export type PurchaseRequest = { attemptKey: string; content: PurchaseContent };

export type MovementKind = 'payment' | 'refund';
export type MovementState = 'completed' | 'failed';
export type PaymentMovement = {
  id: string; attemptId: string; orderId: string | null; kind: MovementKind; state: MovementState;
  amountCOP: number; method: PaymentMethod; originalId: string | null; simulated: true; createdAt: string;
};

const allowedKeys = ['attemptKey', 'quoteId', 'quoteVersion', 'totalCOP', 'method'];
const attemptKeyPattern = /^[A-Za-z0-9_-]{8,64}$/;

// Lanza Error con un mensaje para el estudiante; el servicio lo traduce a VALIDACION.
export function validatePurchase(input: unknown): PurchaseRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Revisa los datos de la compra.');
  const data = input as Record<string, unknown>;
  // Rechazar campos extra impide recibir números de tarjeta, teléfonos u otros datos financieros.
  if (Object.keys(data).some(key => !allowedKeys.includes(key))) throw new Error('La compra solo admite los campos de la cotización y el método de pago.');
  if (typeof data.attemptKey !== 'string' || !attemptKeyPattern.test(data.attemptKey)) throw new Error('La clave del intento debe tener de 8 a 64 letras, números, guiones o guiones bajos.');
  if (typeof data.quoteId !== 'string' || !data.quoteId || data.quoteId.length > 128 || data.quoteId.includes('/')) throw new Error('La cotización no es válida.');
  if (!Number.isInteger(data.quoteVersion) || Number(data.quoteVersion) < 1) throw new Error('La versión de la cotización no es válida.');
  if (!Number.isInteger(data.totalCOP) || Number(data.totalCOP) < 0) throw new Error('El total debe ser un entero en pesos, cero o mayor.');
  const totalCOP = Number(data.totalCOP);
  const method = data.method ?? null;
  if (totalCOP === 0 && method !== null) throw new Error('Un total de $0 no requiere método de pago.');
  if (totalCOP > 0 && !paymentMethods.includes(method as PaymentMethod)) throw new Error('Elige Nequi, tarjeta o efectivo.');
  return { attemptKey: data.attemptKey, content: { quoteId: data.quoteId, quoteVersion: Number(data.quoteVersion), totalCOP, method: method as PaymentMethod | null } };
}

// Representación estable del contenido: la misma clave con otro contenido es otra compra y se rechaza.
export const purchaseFingerprint = ({ quoteId, quoteVersion, totalCOP, method }: PurchaseContent) =>
  JSON.stringify([quoteId, quoteVersion, totalCOP, method]);

export function paymentPlan({ totalCOP, method }: PurchaseContent): PaymentPlan {
  if (totalCOP === 0) return 'none';
  return method === 'cash' ? 'cash_pending' : 'simulate';
}

export function parseOutcome(value: unknown): SimulationOutcome {
  if (value === undefined || value === 'success') return 'success';
  if (value === 'failure') return 'failure';
  throw new Error('El resultado simulado debe ser éxito o fallo.');
}

// El importe del reembolso es siempre el total del pago original; no admite reembolsos parciales.
export function refundAmount(payment: Pick<PaymentMovement, 'kind' | 'state' | 'amountCOP'>) {
  if (payment.kind !== 'payment' || payment.state !== 'completed') throw new Error('Solo se reembolsa un pago simulado completado.');
  return payment.amountCOP;
}
