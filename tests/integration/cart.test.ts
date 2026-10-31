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

before(async () => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); await seedDemo(); });

test('RF-07: solo un estudiante con sesión consulta o guarda su carrito', async () => {
  assert.equal((await post('cart/get', {})).codigo, 'SESION_REQUERIDA');
  assert.equal((await post('cart/save', cart)).codigo, 'SESION_REQUERIDA');
  for (const email of ['restaurant@example.test', 'admin1@usc.edu.co']) {
    const token = await login(email);
    assert.equal((await post('cart/get', {}, token)).codigo, 'NO_AUTORIZADO');
    assert.equal((await post('cart/save', cart, token)).codigo, 'NO_AUTORIZADO');
  }
});

test('RF-07: el carrito se conserva entre sesiones y otra cuenta no lo ve', async () => {
  const saved = await post('cart/save', cart, await login('student@usc.edu.co'));
  assert.equal(saved.codigo, 'OK');
  assert.deepEqual(saved.datos.cart, cart);
  const again = await post('cart/get', {}, await login('student@usc.edu.co'));
  assert.deepEqual(again.datos.cart, cart);

  const email = `carrito.${Date.now()}@usc.edu.co`;
  assert.equal((await post('register', { name: 'Otra Cuenta', email, password: 'Clave1234', confirmPassword: 'Clave1234' })).codigo, 'OK');
  const other = await login(email, 'Clave1234');
  assert.deepEqual((await post('cart/get', {}, other)).datos.cart, { restaurantId: null, lines: [] });
  assert.equal((await post('cart/save', { ...cart, userId: 'demo-student' }, other)).codigo, 'VALIDACION', 'no se elige la cuenta desde la app');
  assert.deepEqual((await post('cart/get', {}, await login('student@usc.edu.co'))).datos.cart, cart);
});

test('RF-07: cantidades inválidas o datos de precio se rechazan sin tocar el carrito guardado', async () => {
  const token = await login('student@usc.edu.co');
  await post('cart/save', cart, token);
  for (const quantity of [0, -1, 21, 1.5]) {
    assert.equal((await post('cart/save', { restaurantId: 'rest-burger', lines: [{ productId: 'doble', quantity }] }, token)).codigo, 'VALIDACION');
  }
  assert.equal((await post('cart/save', { restaurantId: 'rest-burger', lines: [{ productId: 'doble', quantity: 1, priceCOP: 1 }] }, token)).codigo, 'VALIDACION');
  assert.deepEqual((await post('cart/get', {}, token)).datos.cart, cart);
});

test('RF-07: vaciar el carrito lo deja sin restaurante', async () => {
  const token = await login('student@usc.edu.co');
  assert.equal((await post('cart/save', { restaurantId: null, lines: [] }, token)).codigo, 'OK');
  assert.deepEqual((await post('cart/get', {}, token)).datos.cart, { restaurantId: null, lines: [] });
});
