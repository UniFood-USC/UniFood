import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { getFirestore } from 'firebase-admin/firestore';
import { seedDemo } from '../../scripts/seed';
import { seedMenus } from '../../scripts/seed-menu';
import { MENU_VACIO } from '../../src/domain/menu';

const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
const post = async (path: string, body: object, token?: string) => (await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json();
async function login(email: string, password = 'Demo1234') {
  const reply = await (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json();
  assert.ok(reply.idToken);
  return reply.idToken as string;
}
const PUBLICOS_MENU = ['id', 'nombre', 'precioCOP', 'disponible', 'promocion', 'foto'];
const PUBLICOS_DETALLE = [...PUBLICOS_MENU, 'descripcion', 'fotos'];
let student: string;

before(async () => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); await seedDemo(); await seedMenus(); student = await login('student@usc.edu.co'); });
after(async () => { await seedDemo(); await seedMenus(); });

test('RF-06: solo un estudiante con sesión consulta menús y productos', async () => {
  for (const ruta of ['menu/list', 'menu/product']) assert.equal((await post(ruta, { restaurantId: 'rest-burger', productId: 'doble' })).codigo, 'SESION_REQUERIDA');
  for (const email of ['restaurant@example.test', 'admin1@usc.edu.co']) {
    const token = await login(email);
    assert.equal((await post('menu/list', { restaurantId: 'rest-burger' }, token)).codigo, 'NO_AUTORIZADO');
    assert.equal((await post('menu/product', { restaurantId: 'rest-burger', productId: 'doble' }, token)).codigo, 'NO_AUTORIZADO');
  }
});

test('RF-06: el menú muestra nombre y precio en COP, solo con campos públicos y sin productos ocultos', async () => {
  const result = await post('menu/list', { restaurantId: 'rest-burger' }, student);
  assert.equal(result.codigo, 'OK');
  assert.equal(result.datos.restaurante.id, 'rest-burger');
  const productos = result.datos.productos;
  assert.deepEqual(productos.map((p: { id: string }) => p.id).sort(), ['combo', 'doble', 'gaseosa', 'papas', 'sencilla']);
  assert.ok(!productos.some((p: { id: string }) => p.id === 'oculto'), 'un producto con activo=false no se muestra');
  for (const producto of productos) {
    assert.ok(Object.keys(producto).every(key => PUBLICOS_MENU.includes(key)), `campos no públicos en ${producto.id}`);
    assert.ok(Number.isInteger(producto.precioCOP) && producto.precioCOP > 0);
  }
  const doble = productos.find((p: { id: string }) => p.id === 'doble');
  assert.deepEqual(doble.promocion, { porcentaje: 15, precioFinalCOP: 17000 });
  assert.equal(productos.find((p: { id: string }) => p.id === 'combo').promocion, undefined, 'promoción vencida no se ofrece');
  assert.equal(productos.find((p: { id: string }) => p.id === 'sencilla').disponible, false);
  // Disponibles primero.
  assert.equal(productos.at(-1).id, 'sencilla');
});

test('RF-06: cada consulta devuelve únicamente productos del restaurante seleccionado', async () => {
  const burger = (await post('menu/list', { restaurantId: 'rest-burger' }, student)).datos.productos.map((p: { id: string }) => p.id);
  const pizza = (await post('menu/list', { restaurantId: 'rest-pizza' }, student)).datos.productos.map((p: { id: string }) => p.id);
  assert.deepEqual(pizza.sort(), ['margarita', 'pepperoni', 'porcion']);
  assert.ok(!pizza.some((id: string) => burger.includes(id)));
  // Un producto de otro restaurante no se alcanza con el identificador de este.
  const cruzado = await post('menu/product', { restaurantId: 'rest-pizza', productId: 'doble' }, student);
  assert.equal(cruzado.codigo, 'VALIDACION');
  assert.equal(cruzado.datos, null);
});

test('RF-06: el detalle incluye descripción, fotos, disponibilidad, precio y promoción', async () => {
  const doble = await post('menu/product', { restaurantId: 'rest-burger', productId: 'doble' }, student);
  assert.equal(doble.codigo, 'OK');
  const producto = doble.datos.producto;
  assert.ok(Object.keys(producto).every(key => PUBLICOS_DETALLE.includes(key)));
  assert.match(producto.descripcion, /carnes/);
  assert.equal(producto.fotos.length, 3);
  assert.ok(producto.fotos.every((foto: string) => foto.startsWith('https://')));
  assert.equal(producto.disponible, true);
  assert.equal(producto.precioCOP, 20000);
  assert.deepEqual(producto.promocion, { porcentaje: 15, precioFinalCOP: 17000 });
  const agotado = (await post('menu/product', { restaurantId: 'rest-burger', productId: 'sencilla' }, student)).datos.producto;
  assert.equal(agotado.disponible, false);
  // Sin descripción ni fotos: campos vacíos, no ausentes.
  const tinto = (await post('menu/product', { restaurantId: 'rest-cafe', productId: 'tinto' }, student)).datos.producto;
  assert.equal(tinto.descripcion, '');
  assert.deepEqual(tinto.fotos, []);
});

test('RF-06: un menú sin productos informa que está vacío', async () => {
  const result = await post('menu/list', { restaurantId: 'rest-fruta' }, student);
  assert.equal(result.codigo, 'OK');
  assert.deepEqual(result.datos.productos, []);
  assert.equal(result.mensaje, MENU_VACIO);
  // Si todos los productos están ocultos, también se considera vacío.
  await getFirestore().doc('restaurantes/rest-fruta/productos/p').set({ nombre: 'Oculto', precioCOP: 1000, disponible: true, activo: false });
  assert.equal((await post('menu/list', { restaurantId: 'rest-fruta' }, student)).mensaje, MENU_VACIO);
});

test('RF-06: restaurantes pendientes, suspendidos, eliminados, inactivos o inexistentes no tienen menú consultable', async () => {
  const db = getFirestore();
  for (const id of ['rest-nuevo', 'rest-baja', 'rest-eliminado', 'rest-wok']) await db.doc(`restaurantes/${id}/productos/x`).set({ nombre: 'X', precioCOP: 1000, disponible: true });
  for (const id of ['rest-nuevo', 'rest-baja', 'rest-eliminado', 'rest-wok', 'no-existe']) {
    const result = await post('menu/list', { restaurantId: id }, student);
    assert.equal(result.codigo, 'VALIDACION', id);
    assert.equal(result.datos, null);
    assert.equal((await post('menu/product', { restaurantId: id, productId: 'x' }, student)).codigo, 'VALIDACION', id);
  }
});

test('RF-06: un restaurante cerrado por horario sí muestra su menú', async () => {
  const result = await post('menu/list', { restaurantId: 'rest-sazon' }, student);
  assert.equal(result.codigo, 'OK');
  assert.equal(result.datos.productos.length, 2);
});

test('RF-06: datos mal formados se rechazan sin tocar Firestore', async () => {
  for (const cuerpo of [{}, { restaurantId: '' }, { restaurantId: 5 }, { restaurantId: 'rest-burger/productos/doble' }, { restaurantId: '../users/demo-student' }, { restaurantId: 'rest-burger', extra: true }]) {
    assert.equal((await post('menu/list', cuerpo, student)).codigo, 'VALIDACION', JSON.stringify(cuerpo));
  }
  for (const cuerpo of [{ restaurantId: 'rest-burger' }, { restaurantId: 'rest-burger', productId: 'a/b' }, { restaurantId: 'rest-burger', productId: 7 }]) {
    assert.equal((await post('menu/product', cuerpo, student)).codigo, 'VALIDACION', JSON.stringify(cuerpo));
  }
  assert.equal((await post('menu/product', { restaurantId: 'rest-burger', productId: 'oculto' }, student)).codigo, 'VALIDACION', 'un producto oculto no se consulta');
});
