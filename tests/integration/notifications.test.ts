import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { seedDemo } from '../../scripts/seed';
import { adminServices } from '../../functions/src/firebase';
import { materializeNotices } from '../../functions/src/notifications';

const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
const post = async (path: string, body: object, token?: string) => (await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json();
async function login(email: string, password = 'Demo1234') {
  const reply = await (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json();
  assert.ok(reply.idToken);
  return reply.idToken as string;
}
const event = (id: string, kind: string, recipients: string[], occurredAt: string) => ({ id, kind, orderId: `ped-${id}`, orderNumber: `UC-${id}`, recipients, occurredAt });

before(async () => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); await seedDemo(); });

test('RF-12/RF-17: repetir un evento mantiene un solo aviso por destinatario', async () => {
  const id = `evt-${Date.now()}`;
  const input = event(id, 'new_order', ['demo-restaurant', 'demo-student'], '2026-11-07T15:00:00.000Z');
  const results = await Promise.all([1, 2, 3].map(() => materializeNotices(input)));
  assert.deepEqual(results.map(r => r.codigo), ['OK', 'OK', 'OK']);
  const stored = await adminServices().db.collection('notifications').where('eventId', '==', id).get();
  assert.deepEqual(stored.docs.map(doc => doc.id).sort(), [`${id}_demo-restaurant`, `${id}_demo-student`]);
  assert.equal((await materializeNotices({ ...input, kind: 'desconocido' })).codigo, 'VALIDACION');
});

test('RF-12/RF-17: cada cuenta consulta solo sus avisos, del más reciente al más antiguo', async () => {
  const stamp = Date.now();
  await materializeNotices(event(`old-${stamp}`, 'order_ready', ['demo-student'], '2026-11-07T08:00:00.000Z'));
  await materializeNotices(event(`new-${stamp}`, 'refund', ['demo-student'], '2026-11-07T09:00:00.000Z'));
  await materializeNotices(event(`own-${stamp}`, 'new_order', ['demo-restaurant'], '2026-11-07T09:30:00.000Z'));

  const student = await post('notifications/list', {}, await login('student@usc.edu.co'));
  assert.equal(student.codigo, 'OK');
  const ids = student.datos.notices.map((n: { eventId: string }) => n.eventId);
  assert.ok(ids.indexOf(`new-${stamp}`) < ids.indexOf(`old-${stamp}`), 'más reciente primero');
  assert.ok(!ids.includes(`own-${stamp}`), 'no ve avisos de otra cuenta');
  assert.ok(student.datos.notices.every((n: object) => !('recipientId' in n)), 'no expone el destinatario');

  const restaurant = await post('notifications/list', {}, await login('restaurant@example.test'));
  assert.ok(restaurant.datos.notices.some((n: { eventId: string }) => n.eventId === `own-${stamp}`));
  assert.ok(!restaurant.datos.notices.some((n: { eventId: string }) => n.eventId === `new-${stamp}`));
});

test('RF-12/RF-17: sin sesión o como administrador no se consultan avisos', async () => {
  assert.equal((await post('notifications/list', {})).codigo, 'SESION_REQUERIDA');
  assert.equal((await post('notifications/list', {}, await login('admin1@usc.edu.co'))).codigo, 'NO_AUTORIZADO');
});
