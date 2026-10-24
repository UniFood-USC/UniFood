import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { seedDemo } from '../../scripts/seed';

const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
const post = async (path: string, body: object, token?: string) => (await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json();
async function login(email: string, password = 'Demo1234') {
  return (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json();
}
const account = (email: string, role = 'student') => ({ name: 'Cuenta suspensión', email, role, password: 'Demo1234', confirmPassword: 'Demo1234' });
before(async () => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); await seedDemo(); });

test('suspender bloquea al instante una sesión abierta y reactivar devuelve el acceso', async () => {
  const admin = (await login('admin1@usc.edu.co')).idToken;
  const created = await post('users/create', account('suspendido@usc.edu.co'), admin);
  const id = created.datos.profile.id;
  const session = (await login('suspendido@usc.edu.co')).idToken;
  assert.equal((await post('identity', {}, session)).codigo, 'OK');
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal((await post('users/state', { id, state: 'suspended' }, admin)).codigo, 'OK');
  assert.notEqual((await post('identity', {}, session)).codigo, 'OK');
  assert.equal((await login('suspendido@usc.edu.co')).error?.message, 'USER_DISABLED');
  assert.equal((await getFirestore().doc(`users/${id}`).get()).data()?.state, 'suspended');
  const listed = (await post('users/list', {}, admin)).datos.users.find((u: { id: string }) => u.id === id);
  assert.equal(listed.state, 'suspended');
  assert.equal((await post('users/state', { id, state: 'suspended' }, admin)).codigo, 'OK', 'repetir no falla');
  assert.equal((await post('users/state', { id, state: 'active' }, admin)).codigo, 'OK');
  const back = (await login('suspendido@usc.edu.co')).idToken;
  assert.equal((await post('identity', {}, back)).codigo, 'OK');
  assert.equal((await getAuth().getUser(id)).disabled, false);
});

test('solo un administrador activo cambia estados, sin suspenderse a sí mismo ni a restaurantes', async () => {
  const admin = (await login('admin1@usc.edu.co')).idToken;
  const student = (await login('student@usc.edu.co')).idToken;
  assert.equal((await post('users/state', { id: 'demo-student', state: 'suspended' })).codigo, 'SESION_REQUERIDA');
  assert.equal((await post('users/state', { id: 'demo-admin-2', state: 'suspended' }, student)).codigo, 'NO_AUTORIZADO');
  assert.equal((await post('users/state', { id: 'demo-admin-1', state: 'suspended' }, admin)).codigo, 'VALIDACION');
  assert.equal((await post('users/state', { id: 'demo-restaurant', state: 'suspended' }, admin)).codigo, 'VALIDACION');
  for (const input of [{ id: 'demo-student', state: 'deleted' }, { id: 'demo-student' }, { id: '../x', state: 'suspended' }, { id: 'no-existe', state: 'suspended' }]) {
    assert.equal((await post('users/state', input, admin)).codigo, 'VALIDACION');
  }
  assert.equal((await getFirestore().doc('users/demo-student').get()).data()?.state, 'active');
});

test('reactivar un administrador suma al control de administradores activos', async () => {
  const db = getFirestore();
  const admin = (await login('admin1@usc.edu.co')).idToken;
  const third = await post('users/create', account('admin-reactivado@example.test', 'admin'), admin);
  const before = Number((await db.doc('administrativeControl/admins').get()).data()?.activeCount);
  assert.equal((await post('users/state', { id: third.datos.profile.id, state: 'suspended' }, admin)).codigo, 'OK');
  assert.equal((await db.doc('administrativeControl/admins').get()).data()?.activeCount, before - 1);
  assert.equal((await post('users/state', { id: third.datos.profile.id, state: 'active' }, admin)).codigo, 'OK');
  assert.equal((await db.doc('administrativeControl/admins').get()).data()?.activeCount, before);
});
