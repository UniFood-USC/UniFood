import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { seedDemo } from '../../scripts/seed';
import { adminServices } from '../../functions/src/firebase';

const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
const post = async (path: string, body: unknown, token?: string) => (await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json();
async function login(email: string, password = 'Demo1234') {
  const reply = await (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json();
  assert.ok(reply.idToken);
  return reply.idToken as string;
}
const noticeOf = async (id: string) => (await adminServices().db.doc(`notifications/${id}`).get()).data();

before(async () => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); await seedDemo(); });

test('RF-12: cuando el restaurante marca un pedido como listo, el estudiante recibe un aviso una sola vez y el pedido conserva lo comprado', async () => {
  const lines = [{ productId: 'doble', name: 'Doble', priceCOP: 20000, quantity: 1, discountPercent: 15 }];
  await adminServices().db.doc('orders/UC2002').update({ lines, attemptKey: 'compra_demo' });
  const restaurant = await login('restaurant@example.test');
  const changed = await post('orders/change', { id: 'UC2002', change: { type: 'advance' }, expectedVersion: 1 }, restaurant);
  assert.equal(changed.datos.result.ok, true);
  const stored = (await adminServices().db.doc('orders/UC2002').get()).data();
  assert.deepEqual(stored?.lines, lines, 'el cambio de estado conserva lo comprado');
  assert.equal(stored?.attemptKey, 'compra_demo');
  assert.equal(changed.datos.result.order.status, 'ready');
  const notice = await noticeOf('ready-UC2002_demo-student');
  assert.equal(notice?.title, 'Pedido listo');
  assert.equal(notice?.orderId, 'UC2002');
  const inbox = await post('notifications/list', {}, await login('student@usc.edu.co'));
  assert.equal(inbox.datos.notices.filter((n: { eventId: string }) => n.eventId === 'ready-UC2002').length, 1);
});

test('RF-12: cancelar un pedido pagado avisa la cancelación y el reembolso simulado al estudiante', async () => {
  const restaurant = await login('restaurant@example.test');
  const changed = await post('orders/change', { id: 'UC2001', change: { type: 'cancel', reason: 'Producto agotado' }, expectedVersion: 1 }, restaurant);
  assert.equal(changed.datos.result.ok, true);
  assert.equal((await noticeOf('cancelled-UC2001_demo-student'))?.title, 'Pedido cancelado');
  assert.equal((await noticeOf('refund-UC2001_demo-student'))?.title, 'Reembolso simulado');
});

test('RF-12: un cambio rechazado o que no llega a listo no genera avisos', async () => {
  const restaurant = await login('restaurant@example.test');
  const stale = await post('orders/change', { id: 'UC2004', change: { type: 'advance' }, expectedVersion: 1 }, restaurant);
  assert.equal(stale.datos.result.ok, false);
  assert.equal(await noticeOf('ready-UC2004_demo-student'), undefined);
});
