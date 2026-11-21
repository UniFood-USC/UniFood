import { parseOutcome, paymentPlan, purchaseFingerprint, refundAmount, validatePurchase } from '../../src/domain/payments';

const purchase = (changes: Record<string, unknown> = {}) => ({ attemptKey: 'compra_demo_01', quoteId: 'cot-1', quoteVersion: 3, totalCOP: 23250, method: 'nequi', ...changes });

test('una compra válida conserva clave, cotización, total y método', () => {
  expect(validatePurchase(purchase())).toEqual({ attemptKey: 'compra_demo_01', content: { quoteId: 'cot-1', quoteVersion: 3, totalCOP: 23250, method: 'nequi' } });
});

test.each([
  ['clave corta', { attemptKey: 'abc' }],
  ['clave con barra', { attemptKey: 'compra/demo/01' }],
  ['sin cotización', { quoteId: '' }],
  ['versión cero', { quoteVersion: 0 }],
  ['total decimal', { totalCOP: 100.5 }],
  ['total negativo', { totalCOP: -1 }],
  ['método desconocido', { method: 'bitcoin' }],
  ['total positivo sin método', { method: undefined }],
  ['total cero con método', { totalCOP: 0, method: 'card' }],
])('%s se rechaza', (_case, changes) => {
  expect(() => validatePurchase(purchase(changes))).toThrow();
});

test('no admite datos financieros ni campos ajenos a la cotización', () => {
  for (const extra of [{ cardNumber: '4111111111111111' }, { nequiPhone: '3000000000' }, { userId: 'otra-cuenta' }]) {
    expect(() => validatePurchase(purchase(extra))).toThrow('La compra solo admite los campos de la cotización y el método de pago.');
  }
  expect(() => validatePurchase(null)).toThrow();
  expect(() => validatePurchase([purchase()])).toThrow();
});

test('el total cero no pide método, el efectivo queda pendiente y Nequi o tarjeta se simulan', () => {
  const zero = validatePurchase(purchase({ totalCOP: 0, method: undefined })).content;
  expect(zero.method).toBeNull();
  expect(paymentPlan(zero)).toBe('none');
  expect(paymentPlan(validatePurchase(purchase({ method: 'cash' })).content)).toBe('cash_pending');
  expect(paymentPlan(validatePurchase(purchase({ method: 'nequi' })).content)).toBe('simulate');
  expect(paymentPlan(validatePurchase(purchase({ method: 'card' })).content)).toBe('simulate');
});

test('la huella cambia con cualquier dato de la compra y no con la clave', () => {
  const base = validatePurchase(purchase()).content;
  expect(purchaseFingerprint(validatePurchase(purchase({ attemptKey: 'otra_clave_99' })).content)).toBe(purchaseFingerprint(base));
  for (const changes of [{ quoteId: 'cot-2' }, { quoteVersion: 4 }, { totalCOP: 23251 }, { method: 'card' }]) {
    expect(purchaseFingerprint(validatePurchase(purchase(changes)).content)).not.toBe(purchaseFingerprint(base));
  }
});

test('el resultado simulado es éxito por defecto y solo acepta éxito o fallo', () => {
  expect(parseOutcome(undefined)).toBe('success');
  expect(parseOutcome('failure')).toBe('failure');
  expect(() => parseOutcome('aprobado')).toThrow('El resultado simulado debe ser éxito o fallo.');
});

test('el reembolso es por el total de un pago completado', () => {
  expect(refundAmount({ kind: 'payment', state: 'completed', amountCOP: 23250 })).toBe(23250);
  expect(() => refundAmount({ kind: 'payment', state: 'failed', amountCOP: 23250 })).toThrow('Solo se reembolsa un pago simulado completado.');
  expect(() => refundAmount({ kind: 'refund', state: 'completed', amountCOP: 23250 })).toThrow();
});
