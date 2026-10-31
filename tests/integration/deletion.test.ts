import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { getFirestore } from 'firebase-admin/firestore';
import { seedDemo } from '../../scripts/seed';
import { emailKey } from '../../functions/src/identity';

const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
const post = async (path: string, body: object, token?: string) => (await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json();
async function login(email: string, password = 'Demo1234') {
  return (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json();
}
const account = (email: string, role = 'student') => ({ name: 'Cuenta eliminada', email, role, password: 'Demo1234', confirmPassword: 'Demo1234' });
before(async () => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); await seedDemo(); });

test('RF-21: eliminar conserva la historia, bloquea al instante y libera el correo sin heredar la cuenta', async () => {
  const db = getFirestore();
  const admin = (await login('admin1@usc.edu.co')).idToken;
  const email = `eliminado.${Date.now()}@usc.edu.co`;
  const id = (await post('users/create', account(email), admin)).datos.profile.id;
  const session = (await login(email)).idToken;
  assert.equal((await post('identity', {}, session)).codigo, 'OK');

  const deleted = await post('users/delete', { id }, admin);
  assert.equal(deleted.codigo, 'OK');
  assert.notEqual((await post('identity', {}, session)).codigo, 'OK', 'la sesión abierta pierde el acceso');
  assert.ok((await login(email)).error, 'no puede volver a iniciar sesión');
  const profile = (await db.doc(`users/${id}`).get()).data()!;
  assert.equal(profile.state, 'deleted');
  assert.equal(profile.name, 'Cuenta eliminada', 'el perfil se conserva para el historial');
  assert.ok(profile.deletedAt);
  assert.equal((await db.doc(`emailReservations/${emailKey(email)}`).get()).exists, false);
  assert.equal((await post('users/list', {}, admin)).datos.users.find((u: { id: string }) => u.id === id).state, 'deleted');
  assert.equal((await post('users/delete', { id }, admin)).codigo, 'OK', 'repetir completa la eliminación sin fallar');

  const again = await post('register', { name: 'Cuenta nueva', email, password: 'Nueva1234', confirmPassword: 'Nueva1234' });
  assert.equal(again.codigo, 'OK', 'el correo se puede registrar de nuevo');
  assert.notEqual(again.datos.profile.id, id, 'la cuenta nueva no hereda la identidad anterior');
  assert.equal((await db.doc(`users/${id}`).get()).data()?.state, 'deleted');
  assert.equal((await post('identity', {}, (await login(email, 'Nueva1234')).idToken)).datos.id, again.datos.profile.id);
});

test('RF-21: solo un administrador activo elimina, sin eliminarse a sí mismo ni a restaurantes', async () => {
  const admin = (await login('admin1@usc.edu.co')).idToken;
  const student = (await login('student@usc.edu.co')).idToken;
  assert.equal((await post('users/delete', { id: 'demo-student' })).codigo, 'SESION_REQUERIDA');
  assert.equal((await post('users/delete', { id: 'demo-admin-2' }, student)).codigo, 'NO_AUTORIZADO');
  assert.equal((await post('users/delete', { id: 'demo-admin-1' }, admin)).codigo, 'VALIDACION');
  assert.equal((await post('users/delete', { id: 'demo-restaurant' }, admin)).codigo, 'VALIDACION');
  assert.equal((await post('users/delete', { id: 'no-existe' }, admin)).codigo, 'VALIDACION');
  assert.equal((await post('users/delete', { id: 'demo-student', extra: true }, admin)).codigo, 'VALIDACION');
});

test('RF-21: eliminar administradores a la vez nunca deja menos de dos activos', async () => {
  const db = getFirestore();
  const admin = (await login('admin1@usc.edu.co')).idToken;
  await post('users/create', account(`admin.eliminado.${Date.now()}@example.test`, 'admin'), admin);
  const others = (await db.collection('users').where('role', '==', 'admin').where('state', '==', 'active').get()).docs
    .filter(doc => doc.id !== 'demo-admin-1' && !doc.data().provisioning).map(doc => doc.id);
  assert.ok(others.length >= 2);
  const results = await Promise.all(others.map(id => post('users/delete', { id }, admin)));
  assert.equal(results.filter(r => r.codigo === 'OK').length, others.length - 1);
  assert.equal(results.filter(r => r.codigo === 'MINIMO_ADMINISTRADORES').length, 1);
  assert.equal((await db.collection('users').where('role', '==', 'admin').where('state', '==', 'active').get()).size, 2);
  assert.equal((await db.doc('administrativeControl/admins').get()).data()?.activeCount, 2);
  await seedDemo();
});
