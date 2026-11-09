import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { getFirestore } from 'firebase-admin/firestore';
import { seedDemo } from '../../scripts/seed';
import type { Order } from '../../src/types/domain';

const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
const post = async (path: string, body: object, token?: string) => {
  const reply = await fetch(`${base}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return reply.json();
};

async function token(email: string) {
  const reply = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Demo1234', returnSecureToken: true }),
  });
  const result = await reply.json();
  assert.ok(result.idToken);
  return result.idToken as string;
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'pedido-estudiante',
    studentId: 'demo-student',
    restaurantId: 'rest-burger',
    mode: 'pickup',
    status: 'received',
    paymentMethod: 'nequi',
    total: 24000,
    paid: true,
    version: 1,
    statusHistory: { received: '2026-10-12T10:00:00.000Z' },
    createdAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-12T10:00:00.000Z',
    ...overrides,
  };
}

before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood');
  await seedDemo();
  const db = getFirestore();
  await Promise.all(['pedido-estudiante', 'pedido-otro-estudiante', 'pedido-otro-restaurante'].map(id => db.doc(`orders/${id}`).delete()));
  await db.doc('orders/pedido-estudiante').set(order());
  await db.doc('orders/pedido-otro-estudiante').set(order({ id: 'pedido-otro-estudiante', studentId: 'otro-estudiante' }));
  await db.doc('orders/pedido-otro-restaurante').set(order({
    id: 'pedido-otro-restaurante',
    studentId: 'otro-estudiante',
    restaurantId: 'rest-pizza',
  }));
});

test('el estudiante solo lista y consulta pedidos propios aunque solicite otro propietario', async () => {
  const student = await token('student@usc.edu.co');
  const result = await post('orders/list', {}, student);
  assert.equal(result.codigo, 'OK');
  const studentOrders: Order[] = result.datos.orders;
  assert.ok(studentOrders.some(item => item.id === 'pedido-estudiante'));
  assert.ok(studentOrders.every(item => item.studentId === 'demo-student'));
  assert.equal((await post('orders/list', { studentId: 'otro-estudiante' }, student)).codigo, 'NO_AUTORIZADO');
  const forbidden = await post('orders/get', { id: 'pedido-otro-estudiante' }, student);
  const missing = await post('orders/get', { id: 'pedido-no-existe' }, student);
  assert.equal(forbidden.codigo, 'NO_AUTORIZADO');
  assert.equal(forbidden.codigo, missing.codigo);
  assert.equal(forbidden.mensaje, missing.mensaje);
  assert.equal((await post('orders/get', { id: 'pedido-estudiante' })).codigo, 'SESION_REQUERIDA');
});

test('el restaurante consulta solo el restaurante asociado a su perfil', async () => {
  const restaurant = await token('restaurant@example.test');
  const result = await post('orders/list', {}, restaurant);
  assert.equal(result.codigo, 'OK');
  const restaurantOrders: Order[] = result.datos.orders;
  assert.ok(restaurantOrders.some(item => item.id === 'pedido-estudiante'));
  assert.ok(restaurantOrders.some(item => item.id === 'pedido-otro-estudiante'));
  assert.ok(restaurantOrders.every(item => item.restaurantId === 'rest-burger'));
  assert.equal((await post('orders/list', { restaurantId: 'rest-pizza' }, restaurant)).codigo, 'NO_AUTORIZADO');
  assert.equal((await post('orders/get', { id: 'pedido-otro-restaurante' }, restaurant)).codigo, 'NO_AUTORIZADO');
});

test('el servidor deriva el actor al cambiar pedidos y bloquea cambios ajenos', async () => {
  const student = await token('student@usc.edu.co');
  const restaurant = await token('restaurant@example.test');
  const denied = await post('orders/change', {
    id: 'pedido-estudiante',
    change: { type: 'advance', estimateMinutes: 20 },
    expectedVersion: 1,
  }, student);
  assert.equal(denied.codigo, 'OK');
  assert.equal(denied.datos.result.ok, false);
  assert.equal(denied.datos.result.error, 'not_allowed');

  const changed = await post('orders/change', {
    id: 'pedido-estudiante',
    change: { type: 'advance', estimateMinutes: 20 },
    expectedVersion: 1,
  }, restaurant);
  assert.equal(changed.datos.result.ok, true);
  assert.equal(changed.datos.result.order.status, 'preparing');
  assert.equal((await getFirestore().doc('orders/pedido-estudiante').get()).data()?.updatedBy.id, 'demo-restaurant');

  const otherOrder = await post('orders/change', {
    id: 'pedido-otro-restaurante',
    change: { type: 'cancel', reason: 'Prueba' },
    expectedVersion: 1,
  }, restaurant);
  assert.equal(otherOrder.datos.result.ok, false);
  assert.equal(otherOrder.datos.result.error, 'not_found');
});

test('solo un administrador puede consultar todos los pedidos', async () => {
  const admin = await token('admin1@usc.edu.co');
  const result = await post('orders/list', {}, admin);
  assert.equal(result.codigo, 'OK');
  const ids = result.datos.orders.map((item: Order) => item.id);
  for (const id of ['pedido-estudiante', 'pedido-otro-estudiante', 'pedido-otro-restaurante']) {
    assert.ok(ids.includes(id));
  }
});
