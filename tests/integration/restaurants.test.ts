import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { getFirestore } from 'firebase-admin/firestore';
import { seedDemo, seedRestaurants } from '../../scripts/seed';
import { ahoraEnColombia } from '../../src/domain/restaurants';

const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
const post = async (path: string, body: object, token?: string) => (await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json();
async function login(email: string, password = 'Demo1234') {
  const reply = await (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json();
  assert.ok(reply.idToken);
  return reply.idToken as string;
}
const PUBLICOS = ['id', 'nombre', 'logo', 'disponible', 'proximaApertura'];
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
type Fila = { id: string; nombre: string; disponible: boolean; proximaApertura?: string };

before(async () => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); await seedDemo(); });
after(async () => { await seedRestaurants(); await getFirestore().doc('restaurantes/rest-prueba-cerrado').delete(); });

test('RF-04: solo un estudiante con sesión consulta el listado', async () => {
  assert.equal((await post('restaurants/list', {})).codigo, 'SESION_REQUERIDA');
  for (const email of ['restaurant@example.test', 'admin1@usc.edu.co']) {
    assert.equal((await post('restaurants/list', {}, await login(email))).codigo, 'NO_AUTORIZADO');
  }
});

test('RF-04: aprobados y activos incluidos; pendientes, suspendidos, eliminados e inactivos excluidos; sin datos privados', async () => {
  const result = await post('restaurants/list', {}, await login('student@usc.edu.co'));
  assert.equal(result.codigo, 'OK');
  const lista: Fila[] = result.datos.restaurants;
  const ids = lista.map(r => r.id).sort();
  assert.deepEqual(ids, ['rest-arepas', 'rest-burger', 'rest-cafe', 'rest-fruta', 'rest-pizza', 'rest-sazon']);
  assert.ok(lista.length >= 5);
  for (const fila of lista) {
    assert.ok(Object.keys(fila).every(key => PUBLICOS.includes(key)), `campos no públicos en ${fila.id}`);
    if (!fila.disponible) assert.ok(fila.proximaApertura, `${fila.id} cerrado sin próxima apertura`);
  }
  // Sin horario definido: siempre atiende.
  assert.equal(lista.find(r => r.id === 'rest-fruta')?.disponible, true);
});

test('RF-04: un aprobado fuera de horario se lista como cerrado con su próxima apertura', async () => {
  // Abre solo mañana (hora de Colombia), así que ahora está cerrado a cualquier hora.
  const manana = DIAS[(ahoraEnColombia(new Date()).dia + 1) % 7];
  await getFirestore().doc('restaurantes/rest-prueba-cerrado').set({ nombre: 'Prueba Cerrado', estado: 'aprobado', activo: true, horario: { [manana]: { abre: '08:00', cierra: '09:00' } } });
  const lista: Fila[] = (await post('restaurants/list', {}, await login('student@usc.edu.co'))).datos.restaurants;
  const fila = lista.find(r => r.id === 'rest-prueba-cerrado');
  assert.ok(fila);
  assert.equal(fila.disponible, false);
  assert.equal(fila.proximaApertura, 'Mañana 08:00');
});

test('RF-04: sin establecimientos aprobados y activos se informa que no hay restaurantes', async () => {
  const db = getFirestore();
  const docs = await db.collection('restaurantes').get();
  await Promise.all(docs.docs.map(doc => doc.ref.delete()));
  const result = await post('restaurants/list', {}, await login('student@usc.edu.co'));
  assert.equal(result.codigo, 'OK');
  assert.deepEqual(result.datos.restaurants, []);
  assert.equal(result.mensaje, 'No hay restaurantes para mostrar.');
});
