import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { seedDemo } from '../../scripts/seed';
import { deactivateAdministrator } from '../../functions/src/users';
import { generateRecoveryChallenge, isRecoveryChallengeValid } from '../../functions/src/recovery';
import { createClock } from '../../src/domain/clock';

const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
const post = async (path: string, body: object, token?: string) => (await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json();
async function login(email: string, password = 'Demo1234') {
  return (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json();
}
const account = (email: string, role = 'student') => ({ name: 'Cuenta prueba', email, role, password: 'Demo1234', confirmPassword: 'Demo1234' });
before(async () => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); await seedDemo(); });

test('listado y edición privados; correo sincronizado, rol fijo y versión protegida', async () => {
  const admin = (await login('admin1@usc.edu.co')).idToken;
  const created = await post('users/create', account('edicion@usc.edu.co'), admin);
  const id = created.datos.profile.id;
  const input = { id, version: 1, name: 'Nombre nuevo', email: ' EDITADO@USC.EDU.CO ' };
  assert.equal((await post('users/list', {})).codigo, 'SESION_REQUERIDA');
  for (const email of ['student@usc.edu.co', 'restaurant@example.test']) {
    const token = (await login(email)).idToken;
    assert.equal((await post('users/list', {}, token)).codigo, 'NO_AUTORIZADO');
    assert.equal((await post('users/update', input, token)).codigo, 'NO_AUTORIZADO');
  }
  for (const change of [{ role: 'admin' }, { state: 'active' }, { email: 'externo@example.test' }, { name: '' }]) {
    assert.equal((await post('users/update', { ...input, ...change }, admin)).codigo, 'VALIDACION');
  }
  assert.equal((await post('users/update', { ...input, email: 'student@usc.edu.co' }, admin)).codigo, 'CORREO_EN_USO');
  assert.equal((await post('users/update', input, admin)).codigo, 'OK');
  const auth = await getAuth().getUser(id);
  assert.equal(auth.email, 'editado@usc.edu.co');
  assert.equal(auth.displayName, 'Nombre nuevo');
  assert.ok((await login('editado@usc.edu.co')).idToken);
  assert.ok((await login('edicion@usc.edu.co')).error);
  assert.equal((await post('users/update', { ...input, name: 'Obsoleto' }, admin)).codigo, 'CONFLICTO_VERSION');
  const list = await post('users/list', {}, admin);
  const row = list.datos.users.find((u: { id: string }) => u.id === id);
  assert.equal(row.role, 'student');
  assert.equal(row.name, 'Nombre nuevo');
  assert.equal(row.version, 2);
  assert.equal(row.password, undefined);
  assert.equal(row.sessionVersion, undefined);
  assert.equal((await post('users/create', account('edicion@usc.edu.co'), admin)).codigo, 'OK');
});

test('dos cuentas no pueden editarse al mismo correo', async () => {
  const token = (await login('admin1@usc.edu.co')).idToken;
  const a = await post('users/create', account('race-a@usc.edu.co'), token);
  const b = await post('users/create', account('race-b@usc.edu.co'), token);
  const results = await Promise.all([a,b].map(user => post('users/update', { id: user.datos.profile.id, version: 1, name: 'Carrera', email: 'race-final@usc.edu.co' }, token)));
  assert.deepEqual(results.map(r => r.codigo).sort(), ['CORREO_EN_USO', 'OK']);
});

test('dos desactivaciones concurrentes preservan dos administradores y el contador', async () => {
  const db = getFirestore();
  const admin = (await login('admin1@usc.edu.co')).idToken;
  // Aislar la invariante de administradores creados por otras pruebas.
  const existing = await db.collection('users').where('role', '==', 'admin').get();
  for (const doc of existing.docs) if (!['demo-admin-1','demo-admin-2'].includes(doc.id)) await doc.ref.update({ state: 'suspended' });
  const third = await post('users/create', account('tercero@example.test', 'admin'), admin);
  assert.equal(third.codigo, 'OK');
  const results = await Promise.all(['demo-admin-2', third.datos.profile.id].map(id => deactivateAdministrator(`Bearer ${admin}`, id)));
  assert.deepEqual(results.map(r => r.codigo).sort(), ['MINIMO_ADMINISTRADORES', 'OK']);
  const admins = await db.collection('users').where('role', '==', 'admin').where('state', '==', 'active').get();
  assert.equal(admins.size, 2);
  assert.equal((await db.doc('administrativeControl/admins').get()).data()?.activeCount, 2);
  assert.equal((await deactivateAdministrator(`Bearer ${(await login('student@usc.edu.co')).idToken}`, 'demo-admin-1')).codigo, 'NO_AUTORIZADO');
  await seedDemo();
});

test('actualización aislada de contraseña revoca sesiones y conserva suspensión', async () => {
  const auth = getAuth(), db = getFirestore();
  const user = await auth.createUser({ email: 'recovery-proof@usc.edu.co', password: 'Anterior123' });
  await db.doc(`users/${user.uid}`).set({ id: user.uid, role: 'student', state: 'active' });
  const old = (await login('recovery-proof@usc.edu.co', 'Anterior123')).idToken;
  await new Promise(resolve => setTimeout(resolve, 1100));
  await auth.updateUser(user.uid, { password: 'Nueva1234' });
  await auth.revokeRefreshTokens(user.uid);
  assert.equal((await post('identity', {}, old)).codigo, 'SESION_REQUERIDA');
  assert.ok((await login('recovery-proof@usc.edu.co', 'Anterior123')).error);
  assert.ok((await login('recovery-proof@usc.edu.co', 'Nueva1234')).idToken);
  await db.doc(`users/${user.uid}`).update({ state: 'suspended' });
  await auth.updateUser(user.uid, { disabled: true, password: 'Otra12345' });
  await auth.revokeRefreshTokens(user.uid);
  assert.equal((await auth.getUser(user.uid)).disabled, true);
  assert.equal((await db.doc(`users/${user.uid}`).get()).data()?.state, 'suspended');
  assert.ok((await login('recovery-proof@usc.edu.co', 'Otra12345')).error);
});

test('huella privada, 30 minutos exactos y sustitución incluso concurrente', async () => {
  let now = Date.parse('2026-10-09T12:00:00Z');
  const clock = createClock(() => now);
  const first = await generateRecoveryChallenge('demo-student', clock);
  const stored = (await getFirestore().doc('recoveryChallenges/demo-student').get()).data()!;
  assert.equal(JSON.stringify(stored).includes(first.secret), false);
  assert.match(stored.secretHash, /^[a-f0-9]{64}$/);
  assert.equal(await isRecoveryChallengeValid('demo-student', first.secret, clock), true);
  now += 30 * 60 * 1000 - 1;
  assert.equal(await isRecoveryChallengeValid('demo-student', first.secret, clock), true);
  now += 1;
  assert.equal(await isRecoveryChallengeValid('demo-student', first.secret, clock), false);
  const next = await generateRecoveryChallenge('demo-student', clock);
  assert.equal(next.generation, first.generation + 1);
  assert.equal(await isRecoveryChallengeValid('demo-student', first.secret, clock), false);
  const both = await Promise.all([generateRecoveryChallenge('demo-student', clock), generateRecoveryChallenge('demo-student', clock)]);
  assert.equal((await Promise.all(both.map(r => isRecoveryChallengeValid('demo-student', r.secret, clock)))).filter(Boolean).length, 1);
  assert.equal(await isRecoveryChallengeValid('demo-admin-1', next.secret, clock), false);
  await assert.rejects(generateRecoveryChallenge('missing-user', clock));
});

test('un alta incompleta no cuenta como administrador disponible', async () => {
  const db = getFirestore();
  const existing = await db.collection('users').where('role', '==', 'admin').get();
  for (const doc of existing.docs) if (!['demo-admin-1','demo-admin-2'].includes(doc.id)) await doc.ref.update({ state: 'suspended' });
  await seedDemo();
  await db.doc('users/admin-incompleto').set({ role: 'admin', state: 'active', provisioning: true });
  const token = (await login('admin1@usc.edu.co')).idToken;
  try { assert.equal((await deactivateAdministrator(`Bearer ${token}`, 'demo-admin-2')).codigo, 'MINIMO_ADMINISTRADORES'); }
  finally { await db.doc('users/admin-incompleto').delete(); }
});

test('reconcilia una edición confirmada en Auth sin duplicarla y rechaza otra mientras está pendiente', async () => {
  const db = getFirestore();
  const token = (await login('admin1@usc.edu.co')).idToken;
  const created = await post('users/create', account('interrumpida@usc.edu.co'), token);
  const id = created.datos.profile.id;
  const contact = { name: 'Edición interrumpida', email: 'interrumpida-nueva@usc.edu.co' };
  await db.doc(`users/${id}`).update({ pendingContact: contact });
  const input = { id, version: 1, ...contact };
  assert.equal((await post('users/update', { ...input, name: 'Otra edición' }, token)).codigo, 'EN_PROCESO');
  assert.equal((await post('users/update', input, token)).codigo, 'EN_PROCESO');
  await getAuth().updateUser(id, { email: contact.email, displayName: contact.name });
  assert.equal((await post('users/update', input, token)).codigo, 'OK');
  assert.equal((await db.doc(`users/${id}`).get()).data()?.version, 2);
});

test('desafíos y control administrativo no se leen ni escriben desde el cliente', async () => {
  const { initializeTestEnvironment, assertFails } = await import('@firebase/rules-unit-testing');
  const { getDoc, setDoc, doc } = await import('firebase/firestore');
  const env = await initializeTestEnvironment({ projectId: 'demo-unifood' });
  try {
    for (const id of ['demo-student', 'demo-admin-1']) {
      const db = env.authenticatedContext(id).firestore();
      for (const path of ['recoveryChallenges/demo-student', 'administrativeControl/admins']) {
        await assertFails(getDoc(doc(db, path)));
        await assertFails(setDoc(doc(db, path), { bypass: true }));
      }
    }
  } finally { await env.cleanup(); }
});
