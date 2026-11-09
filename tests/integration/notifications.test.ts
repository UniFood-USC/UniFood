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

test('RF-12/RF-17: un dispositivo queda vinculado a una sola cuenta y salir lo desvincula sin borrar la bandeja', async () => {
  const db = adminServices().db;
  const token = `ExponentPushToken[${Date.now()}]`;
  const devicesOf = async () => (await db.collection('devices').where('token', '==', token).get()).docs.map(doc => doc.data());
  const student = await login('student@usc.edu.co');
  assert.equal((await post('devices/register', { token, platform: 'android' }, student)).codigo, 'OK');
  assert.equal((await post('devices/register', { token, platform: 'android' }, student)).codigo, 'OK', 'repetir no duplica');
  let stored = await devicesOf();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].userId, 'demo-student');
  assert.equal(stored[0].sessionVersion, 1);

  const restaurant = await login('restaurant@example.test');
  assert.equal((await post('devices/unregister', { token }, restaurant)).codigo, 'OK');
  assert.equal((await devicesOf()).length, 1, 'otra cuenta no desvincula un dispositivo ajeno');
  assert.equal((await post('devices/register', { token, platform: 'android' }, restaurant)).codigo, 'OK');
  stored = await devicesOf();
  assert.equal(stored.length, 1, 'el mismo dispositivo pasa a la cuenta que inició sesión');
  assert.equal(stored[0].userId, 'demo-restaurant');

  const eventId = `salida-${Date.now()}`;
  await materializeNotices(event(eventId, 'new_order', ['demo-restaurant'], '2026-11-07T16:00:00.000Z'));
  assert.equal((await post('devices/unregister', { token }, restaurant)).codigo, 'OK');
  assert.equal((await devicesOf()).length, 0);
  const inbox = await post('notifications/list', {}, await login('restaurant@example.test'));
  assert.ok(inbox.datos.notices.some((n: { eventId: string }) => n.eventId === eventId), 'la bandeja se conserva');
});

test('RF-12/RF-17: registrar dispositivos exige sesión de estudiante o restaurante y datos válidos', async () => {
  const device = { token: 'ExponentPushToken[valido]', platform: 'ios' };
  assert.equal((await post('devices/register', device)).codigo, 'SESION_REQUERIDA');
  assert.equal((await post('devices/register', device, await login('admin1@usc.edu.co'))).codigo, 'NO_AUTORIZADO');
  const student = await login('student@usc.edu.co');
  assert.equal((await post('devices/register', { ...device, platform: 'web' }, student)).codigo, 'VALIDACION');
  assert.equal((await post('devices/register', { ...device, userId: 'demo-restaurant' }, student)).codigo, 'VALIDACION');
  assert.equal((await post('devices/unregister', {}, student)).codigo, 'VALIDACION');
});
