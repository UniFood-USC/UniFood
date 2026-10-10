import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { seedDemo } from '../../scripts/seed';

const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
const post = async (path: string, body: object, token?: string) => {
  const reply = await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return reply.json();
};
async function token(email: string) {
  const reply = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Demo1234', returnSecureToken: true }),
  });
  const result = await reply.json();
  assert.ok(result.idToken);
  return result.idToken as string;
}
const account = (email: string, role = 'admin') => ({ name: 'Cuenta de prueba', email, role, password: 'Demo1234', confirmPassword: 'Demo1234' });
before(async () => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); await seedDemo(); });

test('un token emitido antes de revocar ya no permite la siguiente operación', async () => {
  const old = await token('admin1@usc.edu.co');
  assert.equal((await post('identity', {}, old)).codigo, 'OK');
  // Firebase compara auth_time con precisión de segundos.
  await new Promise(resolve => setTimeout(resolve, 1100));
  await getAuth().revokeRefreshTokens('demo-admin-1');
  assert.equal((await post('identity', {}, old)).codigo, 'SESION_REQUERIDA');
  assert.equal((await post('users/create', account('revocado@example.test'), old)).codigo, 'SESION_REQUERIDA');
  await assert.rejects(getAuth().getUserByEmail('revocado@example.test'));
  assert.equal((await post('identity', {}, await token('admin1@usc.edu.co'))).codigo, 'OK');
});

test('perfil propio permitido, consulta de otro rol o propietario rechazada', async () => {
  for (const [email, id] of [['student@usc.edu.co', 'demo-student'], ['restaurant@example.test', 'demo-restaurant'], ['admin2@example.test', 'demo-admin-2']]) {
    const session = await token(email);
    const own = await post('profile', { id }, session);
    assert.equal(own.codigo, 'OK');
    assert.equal(own.datos.id, id);
    assert.equal((await post('profile', { id: 'demo-admin-1' }, session)).codigo, 'NO_AUTORIZADO');
    assert.equal((await post('profile', { id, role: 'admin' }, session)).codigo, 'NO_AUTORIZADO');
  }
  assert.equal((await post('profile', { id: 'demo-student' })).codigo, 'SESION_REQUERIDA');
});

test('solo administrador activo crea cuentas, sin entregar token de la cuenta nueva', async () => {
  const input = account('nuevo-admin@example.test');
  assert.equal((await post('users/create', input)).codigo, 'SESION_REQUERIDA');
  for (const email of ['student@usc.edu.co', 'restaurant@example.test']) {
    assert.equal((await post('users/create', input, await token(email))).codigo, 'NO_AUTORIZADO');
  }
  await assert.rejects(getAuth().getUserByEmail(input.email));
  const admin = await token('admin2@example.test');
  const created = await post('users/create', input, admin);
  assert.equal(created.codigo, 'OK');
  assert.equal(created.datos.profile.role, 'admin');
  assert.equal(created.datos.token, undefined);
  assert.equal((await post('identity', {}, admin)).datos.id, 'demo-admin-2');
  assert.equal((await getFirestore().doc(`users/${created.datos.profile.id}`).get()).data()?.role, 'admin');
});

test('estudiante exige USC, rol inválido y campos de privilegio se rechazan', async () => {
  const admin = await token('admin2@example.test');
  for (const input of [account('externo@example.test', 'student'), account('rol@example.test', 'restaurant'), { ...account('estado@example.test'), state: 'active' }]) {
    assert.equal((await post('users/create', input, admin)).codigo, 'VALIDACION');
    await assert.rejects(getAuth().getUserByEmail(input.email));
  }
  const created = await post('users/create', account(' NUEVO@USC.EDU.CO ', 'student'), admin);
  assert.equal(created.codigo, 'OK');
  assert.equal(created.datos.profile.email, 'nuevo@usc.edu.co');
  assert.equal(created.datos.profile.role, 'student');
});

test('duplicados concurrentes y entre roles no crean perfiles huérfanos', async () => {
  const admin = await token('admin2@example.test');
  const results = await Promise.all([post('users/create', account('unico@usc.edu.co'), admin), post('users/create', account('unico@usc.edu.co', 'student'), admin)]);
  assert.deepEqual(results.map(r => r.codigo).sort(), ['CORREO_EN_USO', 'OK']);
  assert.equal((await getFirestore().collection('users').where('email', '==', 'unico@usc.edu.co').get()).size, 1);
  assert.equal((await post('users/create', account('student@usc.edu.co'), admin)).codigo, 'CORREO_EN_USO');
});

test('administrador suspendido no crea cuentas', async () => {
  const admin = await token('admin2@example.test');
  const ref = getFirestore().doc('users/demo-admin-2');
  await ref.update({ state: 'suspended' });
  try { assert.equal((await post('users/create', account('bloqueado@example.test'), admin)).codigo, 'ACCESO_BLOQUEADO'); }
  finally { await ref.update({ state: 'active' }); }
  await assert.rejects(getAuth().getUserByEmail('bloqueado@example.test'));
});

test('consultas directas no exponen perfiles ajenos, listados ni pedidos privados', async () => {
  const { initializeTestEnvironment, assertFails } = await import('@firebase/rules-unit-testing');
  const { doc, getDoc, collection, getDocs } = await import('firebase/firestore');
  const env = await initializeTestEnvironment({ projectId: 'demo-unifood' });
  try {
    for (const id of ['demo-student', 'demo-restaurant', 'demo-admin-2']) {
      const db = env.authenticatedContext(id).firestore();
      await assertFails(getDoc(doc(db, `users/${id}`)));
      await assertFails(getDoc(doc(db, 'users/demo-admin-1')));
      await assertFails(getDocs(collection(db, 'users')));
      await assertFails(getDoc(doc(db, 'orders/otro-pedido')));
    }
  } finally { await env.cleanup(); }
});
