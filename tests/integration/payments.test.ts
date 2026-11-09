import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { adminServices } from '../../functions/src/firebase';
import { attemptId, refundPayment, registerAttempt, simulatePayment } from '../../functions/src/payments';

const purchase = (attemptKey: string, changes: Record<string, unknown> = {}) => ({ attemptKey, quoteId: 'cot-demo', quoteVersion: 1, totalCOP: 23250, method: 'nequi', ...changes });
const movementsOf = async (id: string) => (await adminServices().db.collection('paymentMovements').where('attemptId', '==', id).get()).docs.map(doc => doc.data());
before(() => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); });

test('la misma cuenta y clave identifican una sola compra y otra compra con esa clave se rechaza', async () => {
  const key = `intento_${Date.now()}`;
  const results = await Promise.all([1, 2, 3].map(() => registerAttempt('demo-student', purchase(key))));
  assert.deepEqual(results.map(r => r.codigo), ['OK', 'OK', 'OK']);
  assert.equal(new Set(results.map(r => r.datos!.attempt.id)).size, 1);
  assert.equal(results.filter(r => !r.datos!.reused).length, 1, 'solo una llamada crea el intento');
  assert.equal((await registerAttempt('demo-student', purchase(key, { totalCOP: 25000 }))).codigo, 'CLAVE_EN_USO');
  assert.equal((await registerAttempt('demo-student', purchase(key, { method: 'card' }))).codigo, 'CLAVE_EN_USO');
  const other = await registerAttempt('otro-estudiante', purchase(key));
  assert.equal(other.datos!.reused, false, 'la clave es por cuenta');
  assert.notEqual(other.datos!.attempt.id, results[0].datos!.attempt.id);
  assert.equal((await registerAttempt('demo-student', { ...purchase(`${key}_b`), cardNumber: '4111111111111111' })).codigo, 'VALIDACION');
});

test('Nequi exitoso registra un único pago simulado por el total, aunque se repita', async () => {
  const key = `nequi_${Date.now()}`;
  await registerAttempt('demo-student', purchase(key));
  const payments = await Promise.all([1, 2, 3].map(() => simulatePayment('demo-student', key)));
  assert.deepEqual(payments.map(p => p.codigo), ['OK', 'OK', 'OK']);
  const id = attemptId('demo-student', key);
  const stored = await movementsOf(id);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].kind, 'payment');
  assert.equal(stored[0].state, 'completed');
  assert.equal(stored[0].amountCOP, 23250);
  assert.equal(stored[0].simulated, true);
  assert.equal(stored[0].orderId, null);
  const attempt = (await adminServices().db.doc(`purchaseAttempts/${id}`).get()).data()!;
  assert.equal(attempt.state, 'paid');
  assert.equal(attempt.paymentId, stored[0].id);
});

test('una tarjeta fallida no crea pedido, deja el intento cerrado y repetirla devuelve el mismo fallo', async () => {
  const key = `tarjeta_${Date.now()}`;
  const ordersBefore = (await adminServices().db.collection('orders').count().get()).data().count;
  await registerAttempt('demo-student', purchase(key, { method: 'card' }));
  const failed = await simulatePayment('demo-student', key, 'failure');
  assert.equal(failed.codigo, 'PAGO_FALLIDO');
  assert.equal(failed.recuperable, true);
  assert.equal((await simulatePayment('demo-student', key, 'success')).codigo, 'PAGO_FALLIDO', 'el resultado no cambia con la misma clave');
  const id = attemptId('demo-student', key);
  assert.equal((await movementsOf(id)).length, 1);
  assert.equal((await adminServices().db.doc(`purchaseAttempts/${id}`).get()).data()!.state, 'payment_failed');
  assert.equal((await adminServices().db.collection('orders').count().get()).data().count, ordersBefore);
  // Reintentar o cambiar de método es una compra nueva con otra clave.
  await registerAttempt('demo-student', purchase(`${key}_reintento`, { method: 'nequi' }));
  assert.equal((await simulatePayment('demo-student', `${key}_reintento`)).codigo, 'OK');
});

test('efectivo, total cero, intento ajeno o inexistente no simulan pago', async () => {
  const stamp = Date.now();
  await registerAttempt('demo-student', purchase(`efectivo_${stamp}`, { method: 'cash' }));
  await registerAttempt('demo-student', purchase(`cero_${stamp}`, { totalCOP: 0, method: undefined }));
  assert.equal((await simulatePayment('demo-student', `efectivo_${stamp}`)).codigo, 'VALIDACION');
  assert.equal((await simulatePayment('demo-student', `cero_${stamp}`)).codigo, 'VALIDACION');
  assert.equal((await simulatePayment('otro-estudiante', `efectivo_${stamp}`)).codigo, 'VALIDACION', 'otra cuenta no ve el intento');
  assert.equal((await simulatePayment('demo-student', `inexistente_${stamp}`)).codigo, 'VALIDACION');
  assert.equal((await simulatePayment('demo-student', `efectivo_${stamp}`, 'aprobado')).codigo, 'VALIDACION');
  assert.equal((await movementsOf(attemptId('demo-student', `efectivo_${stamp}`))).length, 0);
  assert.equal((await movementsOf(attemptId('demo-student', `cero_${stamp}`))).length, 0);
});

test('reembolsos repetidos o simultáneos producen un solo movimiento por el total, sin pedido', async () => {
  const key = `reembolso_${Date.now()}`;
  await registerAttempt('demo-student', purchase(key));
  const payment = await simulatePayment('demo-student', key);
  const paymentId = payment.datos!.id;
  const refunds = await Promise.all([1, 2, 3, 4, 5].map(() => refundPayment(paymentId, { reason: 'Compra invalidada durante el pago' })));
  assert.deepEqual(refunds.map(r => r.codigo), ['OK', 'OK', 'OK', 'OK', 'OK']);
  assert.equal(refunds.filter(r => !r.datos!.reused).length, 1);
  const stored = (await movementsOf(attemptId('demo-student', key))).filter(m => m.kind === 'refund');
  assert.equal(stored.length, 1);
  assert.equal(stored[0].amountCOP, 23250);
  assert.equal(stored[0].originalId, paymentId);
  assert.equal(stored[0].orderId, null);
  assert.equal((await refundPayment(paymentId, { reason: 'Otra vez', orderId: 'ped-x' })).datos!.reused, true);
  assert.equal((await adminServices().db.doc(`purchaseAttempts/${attemptId('demo-student', key)}`).get()).data()!.refundId, stored[0].id);
});

test('no se reembolsa un pago fallido, inexistente o sin motivo', async () => {
  const key = `sinreembolso_${Date.now()}`;
  await registerAttempt('demo-student', purchase(key, { method: 'card' }));
  const failed = await simulatePayment('demo-student', key, 'failure');
  assert.equal((await refundPayment(failed.datos!.id, { reason: 'Prueba' })).codigo, 'VALIDACION');
  assert.equal((await refundPayment(`pay_${'0'.repeat(64)}`, { reason: 'Prueba' })).codigo, 'VALIDACION');
  assert.equal((await refundPayment('../users/demo-student', { reason: 'Prueba' })).codigo, 'VALIDACION');
  assert.equal((await refundPayment(failed.datos!.id, { reason: '  ' })).codigo, 'VALIDACION');
  assert.equal((await movementsOf(attemptId('demo-student', key))).filter(m => m.kind === 'refund').length, 0);
});
