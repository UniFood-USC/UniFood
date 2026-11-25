import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { getFirestore } from 'firebase-admin/firestore';
import { seedDemo } from '../../scripts/seed';

// RF-22 · Gestión de restaurantes (servicio real contra los emuladores).
const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
const post = async (path: string, body: object, token?: string) => (await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json();
async function login(email: string, password = 'Demo1234') {
  const reply = await (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json();
  assert.ok(reply.idToken, `login ${email}`);
  return reply.idToken as string;
}
const registro = (correo: string, extra: object = {}) => ({
  nombre: 'Café del Sol', descripcion: 'Café, pan y jugos.', ubicacion: 'Bloque B, primer piso', telefono: '3001234567', correo,
  password: 'Clave1234', confirmPassword: 'Clave1234', horario: { lunes: { abre: '00:00', cierra: '23:59' }, martes: { abre: '00:00', cierra: '23:59' }, miercoles: { abre: '00:00', cierra: '23:59' }, jueves: { abre: '00:00', cierra: '23:59' }, viernes: { abre: '00:00', cierra: '23:59' }, sabado: { abre: '00:00', cierra: '23:59' }, domingo: { abre: '00:00', cierra: '23:59' } }, ...extra,
});
const unico = () => `r${Date.now()}${Math.floor(Math.random() * 1000)}`;
type Vista = { id: string; estado: string; version: number; condicion: string; motivoRechazo?: string };
const lista = async (admin: string) => (await post('restaurants/admin-list', {}, admin)).datos.restaurantes as Vista[];

before(async () => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); await seedDemo(); });

test('RF-22: el registro queda pendiente, no aparece ante estudiantes y la cuenta puede preparar su información', async () => {
  const correo = `${unico()}@cualquier-dominio.com`;
  const creado = await post('restaurants/register', registro(correo));
  assert.equal(creado.codigo, 'OK');
  const id = creado.datos.restaurantId as string;
  const doc = (await getFirestore().doc(`restaurantes/${id}`).get()).data()!;
  assert.equal(doc.estado, 'pendiente');
  const owner = await login(correo, 'Clave1234');
  const own = await post('restaurants/mine', {}, owner);
  assert.equal(own.datos.restaurante.estado, 'pendiente');
  const student = await login('student@usc.edu.co');
  assert.ok(!(await post('restaurants/list', {}, student)).datos.restaurants.some((r: { id: string }) => r.id === id));
  assert.notEqual((await post('menu/list', { restaurantId: id }, student)).codigo, 'OK');
  // Prepara el menú aunque esté pendiente (RF-16).
  assert.notEqual((await post('products/list', {}, owner)).codigo, 'NO_AUTORIZADO');
  assert.equal((await post('restaurants/register', registro(correo))).codigo, 'CORREO_EN_USO');
});

test('RF-22: el registro valida campos obligatorios y límites, y no acepta roles', async () => {
  assert.equal((await post('restaurants/register', {})).codigo, 'VALIDACION');
  assert.equal((await post('restaurants/register', registro(`${unico()}@x.com`, { nombre: 'a'.repeat(101) }))).codigo, 'VALIDACION');
  assert.equal((await post('restaurants/register', registro(`${unico()}@x.com`, { descripcion: 'a'.repeat(1001) }))).codigo, 'VALIDACION');
  assert.equal((await post('restaurants/register', registro(`${unico()}@x.com`, { role: 'admin' }))).codigo, 'VALIDACION');
});

test('RF-22: solo la administración consulta, edita, revisa y cambia el estado', async () => {
  const student = await login('student@usc.edu.co');
  const owner = await login('restaurant@example.test');
  for (const [ruta, cuerpo] of [['restaurants/admin-list', {}], ['restaurants/admin-update', { id: 'rest-burger', version: 1 }], ['restaurants/review', { id: 'rest-nuevo', version: 1, decision: 'aprobar' }], ['restaurants/state', { id: 'rest-burger', version: 1, accion: 'suspender' }]] as const) {
    assert.equal((await post(ruta, cuerpo)).codigo, 'SESION_REQUERIDA');
    for (const token of [student, owner]) assert.equal((await post(ruta, cuerpo, token)).codigo, 'NO_AUTORIZADO', ruta);
  }
  assert.equal((await post('restaurants/mine', {}, student)).codigo, 'NO_AUTORIZADO');
});

test('RF-22: aprobar publica el restaurante; rechazar exige motivo, el propietario corrige y reenvía sin otra cuenta', async () => {
  const admin = await login('admin1@usc.edu.co');
  const correo = `${unico()}@x.com`;
  const id = (await post('restaurants/register', registro(correo))).datos.restaurantId as string;
  let vista = (await lista(admin)).find(r => r.id === id)!;
  assert.equal((await post('restaurants/review', { id, version: vista.version, decision: 'rechazar' }, admin)).codigo, 'VALIDACION', 'rechazo sin motivo');
  const rechazo = await post('restaurants/review', { id, version: vista.version, decision: 'rechazar', motivo: 'Falta la ubicación exacta.' }, admin);
  assert.equal(rechazo.codigo, 'OK');
  const owner = await login(correo, 'Clave1234');
  const own = (await post('restaurants/mine', {}, owner)).datos.restaurante as Vista;
  assert.equal(own.estado, 'rechazado');
  assert.equal(own.motivoRechazo, 'Falta la ubicación exacta.');
  assert.equal((await post('restaurants/review', { id, version: own.version, decision: 'aprobar' }, admin)).codigo, 'TRANSICION_INVALIDA', 'un rechazado no se aprueba sin reenviar');
  const reenvio = await post('restaurants/resubmit', { version: own.version, nombre: 'Café del Sol', descripcion: 'Café, pan y jugos.', ubicacion: 'Bloque C, segundo piso', telefono: '3001234567' }, owner);
  assert.equal(reenvio.codigo, 'OK');
  assert.equal(reenvio.datos.restaurante.estado, 'pendiente');
  assert.equal(reenvio.datos.restaurante.motivoRechazo, undefined);
  vista = (await lista(admin)).find(r => r.id === id)!;
  const aprobado = await post('restaurants/review', { id, version: vista.version, decision: 'aprobar' }, admin);
  assert.equal(aprobado.codigo, 'OK');
  const student = await login('student@usc.edu.co');
  assert.ok((await post('restaurants/list', {}, student)).datos.restaurants.some((r: { id: string }) => r.id === id), 'aprobado aparece ante estudiantes');
  assert.equal((await post('restaurants/review', { id, version: aprobado.datos.restaurante.version, decision: 'aprobar' }, admin)).codigo, 'TRANSICION_INVALIDA');
});

test('RF-22: los cambios válidos de la administración se reflejan y una versión vieja no pisa cambios', async () => {
  const admin = await login('admin1@usc.edu.co');
  const antes = (await lista(admin)).find(r => r.id === 'rest-cafe')!;
  const info = { nombre: 'Café Universitario Plus', descripcion: 'Nueva descripción', ubicacion: 'Biblioteca', telefono: '3115550000' };
  const guardado = await post('restaurants/admin-update', { id: 'rest-cafe', version: antes.version, ...info }, admin);
  assert.equal(guardado.codigo, 'OK');
  assert.equal((await lista(admin)).find(r => r.id === 'rest-cafe')!.version, antes.version + 1);
  const student = await login('student@usc.edu.co');
  assert.ok((await post('restaurants/list', {}, student)).datos.restaurants.some((r: { nombre: string }) => r.nombre === 'Café Universitario Plus'));
  assert.equal((await post('restaurants/admin-update', { id: 'rest-cafe', version: antes.version, ...info }, admin)).codigo, 'CONFLICTO_VERSION');
  assert.equal((await post('restaurants/admin-update', { id: 'rest-cafe', version: antes.version + 1, ...info, nombre: 'a'.repeat(101) }, admin)).codigo, 'VALIDACION');
});

test('RF-22: solo el propietario guarda horario y todo cierre temporal exige reapertura; la propietaria de otro restaurante no puede', async () => {
  const owner = await login('restaurant@example.test');
  const admin = await login('admin1@usc.edu.co');
  const own = (await post('restaurants/mine', {}, owner)).datos.restaurante as Vista;
  const horario = { lunes: { abre: '20:00', cierra: '02:00' } };
  assert.equal((await post('restaurants/schedule', { version: own.version, horario: {} }, owner)).codigo, 'VALIDACION');
  const guardado = await post('restaurants/schedule', { version: own.version, horario, cierresEspeciales: [{ fecha: '2026-12-25', motivo: 'Navidad' }] }, owner);
  assert.equal(guardado.codigo, 'OK');
  assert.deepEqual(guardado.datos.restaurante.horario.lunes, horario.lunes);
  assert.equal((await post('restaurants/schedule', { version: guardado.datos.restaurante.version, horario }, admin)).codigo, 'NO_AUTORIZADO', 'la administración no cambia horarios');
  const v = guardado.datos.restaurante.version as number;
  assert.equal((await post('restaurants/closure', { version: v, cierreTemporal: {} }, owner)).codigo, 'VALIDACION');
  assert.equal((await post('restaurants/closure', { version: v, cierreTemporal: { hasta: '2020-01-01T00:00:00Z' } }, owner)).codigo, 'VALIDACION');
  const hasta = new Date(Date.now() + 3_600_000).toISOString();
  const cierre = await post('restaurants/closure', { version: v, cierreTemporal: { hasta } }, owner);
  assert.equal(cierre.codigo, 'OK');
  assert.equal(cierre.datos.restaurante.condicion, 'cierre_temporal');
  const persistido = (await post('restaurants/mine', {}, owner)).datos.restaurante;
  assert.equal(persistido.cierreTemporal.hasta, hasta);
  const cancelado = await post('restaurants/closure', { version: persistido.version, cierreTemporal: null }, owner);
  assert.equal(cancelado.datos.restaurante.cierreTemporal, undefined);
});

test('RF-22: suspender bloquea pedidos, cancela los activos y reembolsa los pagados; reabrir no levanta la suspensión; eliminar conserva el historial', async () => {
  const db = getFirestore();
  const admin = await login('admin1@usc.edu.co');
  const student = await login('student@usc.edu.co');
  const correo = `${unico()}@x.com`;
  const id = (await post('restaurants/register', registro(correo))).datos.restaurantId as string;
  let vista = (await lista(admin)).find(r => r.id === id)!;
  await post('restaurants/review', { id, version: vista.version, decision: 'aprobar' }, admin);
  const stamp = new Date().toISOString();
  const pedido = { studentId: 'demo-student', restaurantId: id, restaurantName: 'Café del Sol', mode: 'pickup', paymentMethod: 'nequi', total: 12000, version: 1, createdAt: stamp, updatedAt: stamp, lines: [{ productId: 'p', name: 'Café', priceCOP: 6000, quantity: 2, discountPercent: 0 }] };
  await db.doc('orders/UCRF22A').set({ ...pedido, status: 'received', paid: true, statusHistory: { received: stamp } });
  await db.doc('orders/UCRF22B').set({ ...pedido, status: 'preparing', paid: false, paymentMethod: 'cash', statusHistory: { received: stamp } });
  await db.doc('orders/UCRF22C').set({ ...pedido, status: 'collected', paid: true, statusHistory: { received: stamp } });
  vista = (await lista(admin)).find(r => r.id === id)!;
  const suspendido = await post('restaurants/state', { id, version: vista.version, accion: 'suspender', motivo: 'Revisión' }, admin);
  assert.equal(suspendido.codigo, 'OK');
  const a = (await db.doc('orders/UCRF22A').get()).data()!, b = (await db.doc('orders/UCRF22B').get()).data()!, c = (await db.doc('orders/UCRF22C').get()).data()!;
  assert.equal(a.status, 'cancelled'); assert.equal(a.refund.amount, 12000, 'el pagado se reembolsa');
  assert.equal(b.status, 'cancelled'); assert.equal(b.refund, undefined, 'el no pagado no tiene reembolso');
  assert.equal(c.status, 'collected', 'un pedido ya entregado no se toca');
  assert.equal(a.restaurantName, 'Café del Sol'); assert.equal(a.lines[0].name, 'Café', 'se conservan los datos de compra originales');
  assert.ok(!(await post('restaurants/list', {}, student)).datos.restaurants.some((r: { id: string }) => r.id === id));
  // Un cierre temporal que ya terminó no reactiva a un suspendido.
  await db.doc(`restaurantes/${id}`).update({ cierreTemporal: { hasta: '2020-01-01T00:00:00.000Z' } });
  assert.ok(!(await post('restaurants/list', {}, student)).datos.restaurants.some((r: { id: string }) => r.id === id));
  assert.equal((await post('restaurants/state', { id, version: vista.version + 1, accion: 'suspender' }, admin)).codigo, 'OK', 'repetir no falla');
  vista = (await lista(admin)).find(r => r.id === id)!;
  assert.equal((await post('restaurants/state', { id, version: vista.version, accion: 'reactivar' }, admin)).codigo, 'OK');
  vista = (await lista(admin)).find(r => r.id === id)!;
  const eliminado = await post('restaurants/state', { id, version: vista.version, accion: 'eliminar' }, admin);
  assert.equal(eliminado.codigo, 'OK');
  assert.equal((await db.doc(`restaurantes/${id}`).get()).data()!.estado, 'eliminado');
  assert.equal((await db.doc('orders/UCRF22C').get()).exists, true, 'los pedidos anteriores se conservan');
  assert.ok((await (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: correo, password: 'Clave1234', returnSecureToken: true }) })).json()).error, 'la cuenta propietaria pierde el acceso');
  assert.equal((await post('restaurants/state', { id, version: 1, accion: 'suspender' }, admin)).codigo, 'TRANSICION_INVALIDA');
});
