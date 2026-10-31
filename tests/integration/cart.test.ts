import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { seedDemo } from '../../scripts/seed';

const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
const post = async (path: string, body: unknown, token?: string) => (await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json();
async function login(email: string, password = 'Demo1234') {
  const reply = await (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json();
  assert.ok(reply.idToken);
  return reply.idToken as string;
}
const cart = { restaurantId: 'rest-burger', lines: [{ productId: 'doble', quantity: 2 }, { productId: 'papas', quantity: 1 }] };
const versionOf = async (token: string) => (await post('cart/get', {}, token)).datos.version as number;
const save = async (body: object, token: string) => post('cart/save', { ...body, version: await versionOf(token) }, token);

before(async () => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); await seedDemo(); });

test('RF-07: solo un estudiante con sesión consulta o guarda su carrito', async () => {
  assert.equal((await post('cart/get', {})).codigo, 'SESION_REQUERIDA');
  assert.equal((await post('cart/save', { ...cart, version: 1 })).codigo, 'SESION_REQUERIDA');
  for (const email of ['restaurant@example.test', 'admin1@usc.edu.co']) {
    const token = await login(email);
    assert.equal((await post('cart/get', {}, token)).codigo, 'NO_AUTORIZADO');
    assert.equal((await post('cart/save', { ...cart, version: 1 }, token)).codigo, 'NO_AUTORIZADO');
  }
});

test('RF-07: el carrito se conserva entre sesiones y otra cuenta no lo ve', async () => {
  const saved = await save(cart, await login('student@usc.edu.co'));
  assert.equal(saved.codigo, 'OK');
  assert.deepEqual(saved.datos.cart, cart);
  const again = await post('cart/get', {}, await login('student@usc.edu.co'));
  assert.deepEqual(again.datos, { cart, version: saved.datos.version });

  const email = `carrito.${Date.now()}@usc.edu.co`;
  assert.equal((await post('register', { name: 'Otra Cuenta', email, password: 'Clave1234', confirmPassword: 'Clave1234' })).codigo, 'OK');
  const other = await login(email, 'Clave1234');
  assert.deepEqual((await post('cart/get', {}, other)).datos, { cart: { restaurantId: null, lines: [] }, version: 0 });
  assert.equal((await save({ ...cart, userId: 'demo-student' }, other)).codigo, 'VALIDACION', 'no se elige la cuenta desde la app');
  assert.deepEqual((await post('cart/get', {}, await login('student@usc.edu.co'))).datos.cart, cart);
});

test('RF-07: cantidades inválidas, precios o versión ausente se rechazan sin tocar el carrito guardado', async () => {
  const token = await login('student@usc.edu.co');
  await save(cart, token);
  for (const quantity of [0, -1, 21, 1.5]) {
    assert.equal((await save({ restaurantId: 'rest-burger', lines: [{ productId: 'doble', quantity }] }, token)).codigo, 'VALIDACION');
  }
  assert.equal((await save({ restaurantId: 'rest-burger', lines: [{ productId: 'doble', quantity: 1, priceCOP: 1 }] }, token)).codigo, 'VALIDACION');
  assert.equal((await post('cart/save', cart, token)).codigo, 'VALIDACION');
  assert.deepEqual((await post('cart/get', {}, token)).datos.cart, cart);
});

test('RF-07: con dos dispositivos prevalece el último cambio confirmado y el otro recibe el carrito vigente', async () => {
  const phone = await login('student@usc.edu.co');
  const tablet = await login('student@usc.edu.co');
  await save(cart, phone);
  const seen = await versionOf(phone);
  assert.equal(await versionOf(tablet), seen);

  const fromPhone = { restaurantId: 'rest-burger', lines: [{ productId: 'doble', quantity: 5 }] };
  const first = await post('cart/save', { ...fromPhone, version: seen }, phone);
  assert.equal(first.codigo, 'OK');
  assert.equal(first.datos.version, seen + 1);

  const late = await post('cart/save', { restaurantId: 'rest-burger', lines: [{ productId: 'papas', quantity: 9 }], version: seen }, tablet);
  assert.equal(late.codigo, 'CONFLICTO_VERSION');
  assert.deepEqual(late.datos, { cart: fromPhone, version: seen + 1 });
  assert.deepEqual((await post('cart/get', {}, tablet)).datos, { cart: fromPhone, version: seen + 1 }, 'ambos dispositivos consultan el mismo carrito');

  const reviewed = await post('cart/save', { restaurantId: 'rest-burger', lines: [{ productId: 'doble', quantity: 5 }, { productId: 'papas', quantity: 1 }], version: seen + 1 }, tablet);
  assert.equal(reviewed.codigo, 'OK');
});

test('RF-07: dos guardados simultáneos con la misma versión confirman uno solo', async () => {
  const token = await login('student@usc.edu.co');
  await save(cart, token);
  const version = await versionOf(token);
  const results = await Promise.all([1, 2, 3].map(quantity => post('cart/save', { restaurantId: 'rest-burger', lines: [{ productId: 'doble', quantity }], version }, token)));
  assert.equal(results.filter(r => r.codigo === 'OK').length, 1);
  assert.equal(results.filter(r => r.codigo === 'CONFLICTO_VERSION').length, 2);
  const winner = results.find(r => r.codigo === 'OK').datos;
  assert.deepEqual((await post('cart/get', {}, token)).datos, winner);
});

test('RF-07: vaciar el carrito lo deja sin restaurante', async () => {
  const token = await login('student@usc.edu.co');
  assert.equal((await save({ restaurantId: null, lines: [] }, token)).codigo, 'OK');
  assert.deepEqual((await post('cart/get', {}, token)).datos.cart, { restaurantId: null, lines: [] });
});
