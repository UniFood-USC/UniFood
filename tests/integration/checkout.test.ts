import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { seedDemo } from '../../scripts/seed';
import { adminServices } from '../../functions/src/firebase';

const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
const post = async (path: string, body: unknown, token?: string) => (await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json();
async function login(email: string, password = 'Demo1234') {
  const reply = await (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json();
  assert.ok(reply.idToken);
  return reply.idToken as string;
}
// Restaurante propio de la prueba, siempre abierto (sin horario), para no depender de la hora.
const shop = 'rest-prueba-compra';
async function prepareShop() {
  const { db } = adminServices();
  await db.doc(`restaurantes/${shop}`).set({ nombre: 'Prueba Compra', estado: 'aprobado', activo: true });
  await db.doc(`restaurantes/${shop}/productos/doble`).set({ nombre: 'Doble', precioCOP: 20000, disponible: true, promocion: { porcentaje: 15 } });
  await db.doc(`restaurantes/${shop}/productos/papas`).set({ nombre: 'Papas', precioCOP: 6000, disponible: true });
  await db.doc(`restaurantes/${shop}/productos/agotado`).set({ nombre: 'Agotado', precioCOP: 5000, disponible: false });
  await db.doc('users/demo-restaurant').update({ restaurantId: shop });
}
async function fillCart(token: string, lines = [{ productId: 'doble', quantity: 1 }, { productId: 'papas', quantity: 2 }]) {
  const { version } = (await post('cart/get', {}, token)).datos;
  assert.equal((await post('cart/save', { restaurantId: shop, lines, version }, token)).codigo, 'OK');
}
const key = (name: string) => `${name}_${Date.now()}`;

before(async () => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); await seedDemo(); await prepareShop(); });
after(async () => { await adminServices().db.recursiveDelete(adminServices().db.doc(`restaurantes/${shop}`)); await seedDemo(); });

test('RF-09/RF-10: con Nequi se cobra el total del menú vigente, se crea un pedido numerado, se vacía el carrito y se avisa al restaurante', async () => {
  const { db } = adminServices();
  const student = await login('student@usc.edu.co');
  await fillCart(student);
  const placed = await post('checkout/place', { attemptKey: key('nequi'), method: 'nequi' }, student);
  assert.equal(placed.codigo, 'OK');
  const order = placed.datos.order;
  assert.match(order.id, /^UC\d{4,}$/);
  assert.equal(order.total, 29000, '20.000 - 15 % + 2 × 6.000');
  assert.equal(order.status, 'received');
  assert.equal(order.paid, true);
  assert.equal(order.paymentMethod, 'nequi');
  assert.equal(order.restaurantId, shop);
  assert.deepEqual((await post('cart/get', {}, student)).datos.cart, { restaurantId: null, lines: [] });
  const listed = (await post('orders/list', { studentId: 'demo-student' }, student)).datos.orders.map((o: { id: string }) => o.id);
  assert.ok(listed.includes(order.id), 'el estudiante lo ve en sus pedidos');
  const notice = await db.doc(`notifications/new_order-${order.id}_demo-restaurant`).get();
  assert.equal(notice.data()?.title, 'Nuevo pedido');
  assert.equal((await db.collection('paymentMovements').where('orderId', '==', order.id).get()).size, 1, 'el pago queda vinculado al pedido');
});

test('RF-10: repetir la confirmación con la misma clave devuelve el mismo pedido sin duplicarlo', async () => {
  const { db } = adminServices();
  const student = await login('student@usc.edu.co');
  await fillCart(student);
  const attemptKey = key('repetida');
  const results = await Promise.all([1, 2].map(() => post('checkout/place', { attemptKey, method: 'card' }, student)));
  assert.deepEqual(results.map(r => r.codigo), ['OK', 'OK']);
  assert.equal(results[0].datos.order.id, results[1].datos.order.id);
  assert.equal((await db.collection('orders').where('studentId', '==', 'demo-student').where('attemptKey', '==', attemptKey).get()).size, 1);
});

test('RF-09: en efectivo el pedido queda con pago pendiente y sin movimiento simulado', async () => {
  const { db } = adminServices();
  const student = await login('student@usc.edu.co');
  await fillCart(student, [{ productId: 'papas', quantity: 1 }]);
  const placed = await post('checkout/place', { attemptKey: key('efectivo'), method: 'cash' }, student);
  assert.equal(placed.codigo, 'OK');
  assert.equal(placed.datos.order.paid, false);
  assert.equal(placed.datos.order.total, 6000);
  assert.equal((await db.collection('paymentMovements').where('orderId', '==', placed.datos.order.id).get()).size, 0);
});

test('RF-07/RF-09: carrito vacío, producto agotado o restaurante cerrado no crean pedido ni cobran', async () => {
  const { db } = adminServices();
  const student = await login('student@usc.edu.co');
  const before = (await db.collection('orders').get()).size;
  const { version } = (await post('cart/get', {}, student)).datos;
  await post('cart/save', { restaurantId: null, lines: [], version }, student);
  assert.equal((await post('checkout/place', { attemptKey: key('vacio'), method: 'nequi' }, student)).codigo, 'VALIDACION');

  await fillCart(student, [{ productId: 'agotado', quantity: 1 }]);
  assert.equal((await post('checkout/place', { attemptKey: key('agotado'), method: 'nequi' }, student)).codigo, 'REQUIERE_REVISION');
  assert.equal((await post('cart/get', {}, student)).datos.cart.lines.length, 1, 'el carrito se conserva para revisarlo');

  await fillCart(student);
  await db.doc(`restaurantes/${shop}`).update({ horario: { lunes: { abre: '00:00', cierra: '00:01' } } });
  try { assert.equal((await post('checkout/place', { attemptKey: key('cerrado'), method: 'nequi' }, student)).codigo, 'RESTAURANTE_CERRADO'); }
  finally { await prepareShop(); }
  assert.equal((await db.collection('orders').get()).size, before);
});

test('RF-09: solo un estudiante con sesión confirma, con un método válido y sin datos financieros', async () => {
  assert.equal((await post('checkout/place', { attemptKey: key('sin'), method: 'nequi' })).codigo, 'SESION_REQUERIDA');
  assert.equal((await post('checkout/place', { attemptKey: key('rest'), method: 'nequi' }, await login('restaurant@example.test'))).codigo, 'NO_AUTORIZADO');
  const student = await login('student@usc.edu.co');
  await fillCart(student);
  assert.equal((await post('checkout/place', { attemptKey: key('metodo'), method: 'bitcoin' }, student)).codigo, 'VALIDACION');
  assert.equal((await post('checkout/place', { attemptKey: key('tarjeta'), method: 'card', cardNumber: '4111111111111111' }, student)).codigo, 'VALIDACION');
});
