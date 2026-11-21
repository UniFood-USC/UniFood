import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { seedDemo } from '../../scripts/seed';
import { prepareOrderLines, uploadPhoto } from '../../functions/src/productManagement';

// RF-16 · Criterios de aceptación de la gestión de productos.
const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
const post = async (path: string, body: object, token?: string) => (await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json();
async function login(email: string, password = 'Demo1234') {
  const reply = await (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json();
  assert.ok(reply.idToken);
  return reply.idToken as string;
}

// Imágenes de prueba con la firma real de PNG y de JPG (el servicio comprueba los bytes, no el tipo declarado).
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('contenido-de-prueba')]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('contenido-de-prueba')]);
const subir = async (token: string, formato = 'image/png', contenido: Buffer = PNG) => post('products/photo', { formato, datos: contenido.toString('base64') }, token);
const urlDe = async (token: string, formato = 'image/png', contenido: Buffer = PNG) => (await subir(token, formato, contenido)).datos.url as string;

let student: string; let burger: string; let pizza: string;
let fotosB: string[]; let fotoP: string;
const nuevo = (extra: object = {}) => ({ nombre: 'Hamburguesa BBQ', descripcion: 'Carne de res con salsa BBQ.', precioCOP: 19000, disponible: true, fotos: [fotosB[0]], ...extra });
const menu = async (restaurantId: string) => (await post('menu/list', { restaurantId }, student)).datos.productos as { id: string; nombre: string; precioCOP: number; disponible: boolean }[];
const detalle = async (restaurantId: string, productId: string) => post('menu/product', { restaurantId, productId }, student);
// `datos` de prepareOrderLines puede traer `noComprables` o `lineas` según el caso.
const datosDe = (resultado: { datos?: unknown }) => (resultado.datos ?? {}) as { noComprables?: unknown; lineas?: unknown };

before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood');
  await seedDemo();
  // Un segundo restaurante aprobado con su propia cuenta, para probar el aislamiento entre establecimientos.
  try { await getAuth().createUser({ uid: 'demo-restaurant-pizza', email: 'pizza@example.test', password: 'Demo1234', displayName: 'Pizza Zona' }); } catch { /* ya existe */ }
  await getFirestore().doc('users/demo-restaurant-pizza').set({ id: 'demo-restaurant-pizza', name: 'Pizza Zona', email: 'pizza@example.test', role: 'restaurant', restaurantId: 'rest-pizza', state: 'active', version: 1, sessionVersion: 1, createdAt: '2026-10-04T00:00:00Z' });
  student = await login('student@usc.edu.co'); burger = await login('restaurant@example.test'); pizza = await login('pizza@example.test');
  fotosB = [];
  for (let i = 0; i < 6; i++) fotosB.push(await urlDe(burger, i % 2 ? 'image/jpeg' : 'image/png', i % 2 ? JPG : PNG));
  fotoP = await urlDe(pizza);
});
after(async () => { await seedDemo(); });

test('RF-16: solo un restaurante con sesión gestiona productos y sube fotos', async () => {
  for (const ruta of ['products/list', 'products/save', 'products/remove', 'products/photo']) assert.equal((await post(ruta, nuevo())).codigo, 'SESION_REQUERIDA');
  for (const email of ['student@usc.edu.co', 'admin1@usc.edu.co']) {
    const token = await login(email);
    assert.equal((await post('products/list', {}, token)).codigo, 'NO_AUTORIZADO');
    assert.equal((await post('products/save', nuevo(), token)).codigo, 'NO_AUTORIZADO');
    assert.equal((await subir(token)).codigo, 'NO_AUTORIZADO');
  }
});

test('RF-16 · criterio 1: un producto válido creado se incorpora al menú', async () => {
  const antes = (await menu('rest-burger')).length;
  const creado = await post('products/save', nuevo(), burger);
  assert.equal(creado.codigo, 'OK');
  const id = creado.datos.producto.id as string;
  const despues = await menu('rest-burger');
  assert.equal(despues.length, antes + 1);
  assert.equal(despues.find(p => p.id === id)?.precioCOP, 19000);
  const visto = (await detalle('rest-burger', id)).datos.producto;
  assert.deepEqual(visto.fotos, [fotosB[0]]);
  // La foto subida se sirve públicamente con su tipo y sus bytes.
  const foto = await fetch(fotosB[0]!);
  assert.equal(foto.status, 200);
  assert.equal(foto.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await foto.arrayBuffer()), PNG);
});

test('RF-16 · criterio 2: los cambios válidos se reflejan en el menú', async () => {
  const id = (await post('products/save', nuevo({ nombre: 'Para editar' }), burger)).datos.producto.id as string;
  const editado = await post('products/save', nuevo({ id, version: 1, nombre: 'Editado', precioCOP: 21000, descripcion: 'Nueva descripción', fotos: [fotosB[0], fotosB[1]] }), burger);
  assert.equal(editado.codigo, 'OK');
  assert.equal(editado.datos.producto.version, 2);
  const visto = (await detalle('rest-burger', id)).datos.producto;
  assert.equal(visto.nombre, 'Editado'); assert.equal(visto.precioCOP, 21000); assert.equal(visto.descripcion, 'Nueva descripción'); assert.equal(visto.fotos.length, 2);
  // Editar sobre una versión vieja no pisa el cambio más reciente.
  const viejo = await post('products/save', nuevo({ id, version: 1, nombre: 'Pisando' }), burger);
  assert.equal(viejo.codigo, 'CONFLICTO_VERSION');
  assert.equal((await detalle('rest-burger', id)).datos.producto.nombre, 'Editado');
  // La edición conserva campos privados: update() no reemplaza el documento.
  await getFirestore().doc(`restaurantes/rest-burger/productos/${id}`).update({ costoCOP: 500 });
  await post('products/save', nuevo({ id, version: 2, fotos: [fotosB[0], fotosB[1]] }), burger);
  assert.equal((await getFirestore().doc(`restaurantes/rest-burger/productos/${id}`).get()).data()?.costoCOP, 500);
});

test('RF-16 · criterio 3: un producto eliminado deja de ofrecerse, pero su registro se conserva', async () => {
  const id = (await post('products/save', nuevo({ nombre: 'Para borrar' }), burger)).datos.producto.id as string;
  assert.ok((await menu('rest-burger')).some(p => p.id === id));
  assert.equal((await post('products/remove', { id, version: 1 }, burger)).codigo, 'OK');
  assert.ok(!(await menu('rest-burger')).some(p => p.id === id));
  assert.equal((await detalle('rest-burger', id)).codigo, 'VALIDACION');
  const guardado = (await getFirestore().doc(`restaurantes/rest-burger/productos/${id}`).get());
  assert.equal(guardado.exists, true, 'el documento se conserva para el historial');
  assert.equal(guardado.data()?.nombre, 'Para borrar');
  assert.ok(!(await post('products/list', {}, burger)).datos.productos.some((p: { id: string }) => p.id === id));
  // Un producto retirado ya no se puede editar ni reactivar editándolo.
  assert.equal((await post('products/save', nuevo({ id, version: 2 }), burger)).codigo, 'NO_AUTORIZADO');
});

test('RF-16 · criterio 4: un restaurante no puede modificar productos ni fotos de otro establecimiento', async () => {
  const ajeno = 'margarita'; // pertenece a rest-pizza
  const antes = (await getFirestore().doc(`restaurantes/rest-pizza/productos/${ajeno}`).get()).data();
  for (const cuerpo of [nuevo({ id: ajeno, version: 1, nombre: 'Hackeado' }), nuevo({ restaurantId: 'rest-pizza', nombre: 'Colado' }), nuevo({ id: ajeno, version: 1, restaurantId: 'rest-pizza' })]) {
    assert.equal((await post('products/save', cuerpo, burger)).codigo, 'NO_AUTORIZADO', JSON.stringify(cuerpo).slice(0, 60));
  }
  assert.equal((await post('products/remove', { id: ajeno, version: 1 }, burger)).codigo, 'NO_AUTORIZADO');
  assert.equal((await post('products/remove', { id: ajeno, version: 1, restaurantId: 'rest-pizza' }, burger)).codigo, 'NO_AUTORIZADO');
  assert.deepEqual((await getFirestore().doc(`restaurantes/rest-pizza/productos/${ajeno}`).get()).data(), antes, 'el producto ajeno no cambió');
  assert.ok(!(await menu('rest-pizza')).some(p => p.nombre === 'Colado' || p.nombre === 'Hackeado'));
  // Una foto subida por Pizza Zona no se puede adjuntar a un producto de Burger Campus (ni al revés).
  const robada = await post('products/save', nuevo({ nombre: 'Con foto ajena', fotos: [fotoP] }), burger);
  assert.equal(robada.codigo, 'VALIDACION'); assert.ok(robada.datos.errores.fotos);
  // Y el dueño legítimo sí puede: conserva las fotos que ya tenía su producto.
  const propio = await post('products/save', nuevo({ id: ajeno, version: (antes as { version?: number }).version ?? 1, nombre: 'Pizza Margarita', fotos: (antes as { fotos?: string[] }).fotos?.length ? (antes as { fotos: string[] }).fotos : [fotoP] }), pizza);
  assert.equal(propio.codigo, 'OK');
});

test('RF-16 · criterios 5 y 8: validación de campos obligatorios y límites, con el error en cada campo', async () => {
  const vacio = await post('products/save', {}, burger);
  assert.equal(vacio.codigo, 'VALIDACION');
  for (const campo of ['nombre', 'descripcion', 'precioCOP', 'disponible', 'fotos']) assert.ok(vacio.datos.errores[campo], campo);
  const casos: [object, string][] = [
    [{ precioCOP: 0 }, 'precioCOP'], [{ precioCOP: -5 }, 'precioCOP'], [{ precioCOP: 1500.5 }, 'precioCOP'],
    [{ nombre: 'a'.repeat(101) }, 'nombre'], [{ descripcion: 'a'.repeat(1001) }, 'descripcion'],
    [{ fotos: [] }, 'fotos'], [{ disponible: 'si' }, 'disponible'],
  ];
  for (const [cambio, campo] of casos) {
    const r = await post('products/save', nuevo(cambio), burger);
    assert.equal(r.codigo, 'VALIDACION', campo);
    assert.ok(r.datos.errores[campo], campo);
  }
  assert.equal((await post('products/save', nuevo({ nombre: 'a'.repeat(100), descripcion: 'a'.repeat(1000) }), burger)).codigo, 'OK');
  assert.ok(!(await menu('rest-burger')).some(p => p.nombre === 'a'.repeat(101)));   // nada de lo rechazado llegó al menú
});

test('RF-16 · criterio 6: solo disponible o agotado, sin inventario', async () => {
  for (const campo of ['stock', 'cantidad', 'inventario']) {
    const r = await post('products/save', nuevo({ [campo]: 10 }), burger);
    assert.equal(r.codigo, 'VALIDACION'); assert.ok(r.datos.errores.general);
  }
  const agotado = await post('products/save', nuevo({ nombre: 'Agotado ya', disponible: false }), burger);
  assert.equal(agotado.codigo, 'OK');
  const visto = (await menu('rest-burger')).find(p => p.id === agotado.datos.producto.id);
  assert.equal(visto?.disponible, false);
});

test('RF-16 · criterio 9: fotos JPG o PNG de hasta 5 MB, entre 1 y 5 por producto', async () => {
  // Entre 1 y 5 fotos por producto.
  assert.equal((await post('products/save', nuevo({ fotos: fotosB.slice(0, 5) }), burger)).codigo, 'OK');
  const seis = await post('products/save', nuevo({ fotos: fotosB }), burger);
  assert.equal(seis.codigo, 'VALIDACION'); assert.ok(seis.datos.errores.fotos);
  // Solo JPG o PNG, comprobado sobre los bytes reales.
  assert.equal((await subir(burger, 'image/gif', PNG)).codigo, 'VALIDACION');
  assert.equal((await subir(burger, 'image/png', JPG)).codigo, 'VALIDACION', 'un JPG que se declara PNG');
  assert.equal((await subir(burger, 'image/png', Buffer.from('esto es texto, no una imagen'))).codigo, 'VALIDACION');
  assert.equal((await subir(burger, 'image/jpeg', JPG)).codigo, 'OK');
  // Hasta 5 MB: exactamente 5 MB entra, un byte más no.
  const relleno = (bytes: number) => Buffer.concat([PNG, Buffer.alloc(bytes - PNG.length)]);
  const subirGrande = (bytes: number) => uploadPhoto(`Bearer ${burger}`, { formato: 'image/png', datos: relleno(bytes).toString('base64') });
  assert.equal((await subirGrande(5 * 1024 * 1024)).codigo, 'OK');
  assert.equal((await subirGrande(5 * 1024 * 1024 + 1)).codigo, 'VALIDACION');
  // Una dirección que no fue subida por el restaurante no se acepta.
  const inventada = await post('products/save', nuevo({ nombre: 'Foto inventada', fotos: ['https://evil.test/a.jpg'] }), burger);
  assert.equal(inventada.codigo, 'VALIDACION'); assert.ok(inventada.datos.errores.fotos);
  const noExiste = await post('products/save', nuevo({ nombre: 'Foto que no existe', fotos: [`${base}/photos/rest-burger/noexiste`] }), burger);
  assert.equal(noExiste.codigo, 'VALIDACION');
  assert.equal((await fetch(`${base}/photos/rest-burger/noexiste`)).status, 404);
});

// Criterios 7 y 10 · lo que el flujo de pedidos llama al comprar y al confirmar.
test('RF-16 · criterio 7: un producto agotado o retirado no se puede comprar', async () => {
  const creado = await post('products/save', nuevo({ nombre: 'Se agota' }), burger);
  const id = creado.datos.producto.id as string;
  assert.equal((await prepareOrderLines('rest-burger', [{ productId: id, quantity: 1 }])).codigo, 'OK');
  // Se marca agotado: la compra se rechaza e identifica el producto.
  await post('products/save', nuevo({ id, version: 1, nombre: 'Se agota', disponible: false }), burger);
  const agotado = await prepareOrderLines('rest-burger', [{ productId: 'doble', quantity: 1 }, { productId: id, quantity: 1 }]);
  assert.equal(agotado.codigo, 'VALIDACION');
  assert.deepEqual(datosDe(agotado).noComprables, [{ productId: id, motivo: 'agotado' }]);
  // Se vuelve a poner disponible y se retira: tampoco se compra.
  await post('products/save', nuevo({ id, version: 2, nombre: 'Se agota', disponible: true }), burger);
  assert.equal((await post('products/remove', { id, version: 3 }, burger)).codigo, 'OK');
  const retirado = await prepareOrderLines('rest-burger', [{ productId: id, quantity: 1 }]);
  assert.deepEqual(datosDe(retirado).noComprables, [{ productId: id, motivo: 'retirado' }]);
  // Un producto de otro restaurante no es comprable con el id de este.
  assert.equal((await prepareOrderLines('rest-burger', [{ productId: 'margarita', quantity: 1 }])).codigo, 'VALIDACION');
});

test('RF-16 · criterio 10: el pedido confirmado conserva nombre, precio y descuento originales', async () => {
  const id = (await post('products/save', nuevo({ nombre: 'Original', precioCOP: 10000 }), burger)).datos.producto.id as string;
  const copia = datosDe(await prepareOrderLines('rest-burger', [{ productId: id, quantity: 2 }])).lineas;
  assert.deepEqual(copia, [{ productId: id, nombre: 'Original', precioCOP: 10000, descuentoPorcentaje: 0, precioFinalCOP: 10000, cantidad: 2 }]);
  // El flujo de pedidos guarda `copia` dentro del pedido. Editar o eliminar el producto no la toca.
  await getFirestore().doc('orders/RF16-PRUEBA').set({ restaurantId: 'rest-burger', lineas: copia });
  await post('products/save', nuevo({ id, version: 1, nombre: 'Cambiado', precioCOP: 99000 }), burger);
  await post('products/remove', { id, version: 2 }, burger);
  const guardado = (await getFirestore().doc('orders/RF16-PRUEBA').get()).data();
  assert.deepEqual(guardado?.lineas, copia);
  await getFirestore().doc('orders/RF16-PRUEBA').delete();
});