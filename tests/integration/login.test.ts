import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { seedDemo } from '../../scripts/seed';
import { login } from '../../src/services/login';

const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-unifood' }, 'login-test');
const auth = getAuth(app);
const dependencies = {
  firebase: () => ({ auth, ready: Promise.resolve() }),
  checkIdentity: async () => {
    const token = await auth.currentUser!.getIdToken();
    const reply = await fetch('http://127.0.0.1:5001/demo-unifood/us-central1/api/identity', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}',
    });
    return reply.json();
  },
};
before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood');
  assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  await setPersistence(auth, inMemoryPersistence);
  await seedDemo();
});
after(async () => { await deleteApp(app); });

test('acceso de los tres roles con credenciales reales y correo normalizado', async () => {
  for (const [email, role] of [[' STUDENT@USC.EDU.CO ', 'student'], ['admin2@example.test', 'admin'], ['restaurant@example.test', 'restaurant']]) {
    const result = await login({ email, password: 'Demo1234' }, dependencies);
    assert.equal(result.codigo, 'OK');
    assert.equal(result.datos?.role, role);
    assert.equal(result.datos?.state, 'active');
    assert.ok(auth.currentUser);
  }
});

test('contraseña incorrecta y correo inexistente tienen el mismo resultado sin sesión residual', async () => {
  for (const email of ['student@usc.edu.co', 'ausente@usc.edu.co']) {
    const result = await login({ email, password: 'Incorrecta1' }, dependencies);
    assert.equal(result.codigo, 'CREDENCIALES_INVALIDAS');
    assert.equal(result.datos, null);
    assert.equal(auth.currentUser, null);
  }
});

test('consulta estado vigente en cada acceso y rechaza suspensión o eliminación del perfil', async () => {
  const ref = getFirestore().doc('users/demo-student');
  try {
    for (const state of ['suspended', 'deleted']) {
      await ref.update({ state });
      assert.equal((await login({ email: 'student@usc.edu.co', password: 'Demo1234' }, dependencies)).codigo, 'ACCESO_BLOQUEADO');
      assert.equal(auth.currentUser, null);
    }
  } finally { await ref.update({ state: 'active' }); }
  assert.equal((await login({ email: 'student@usc.edu.co', password: 'Demo1234' }, dependencies)).codigo, 'OK');
});

test('identidad deshabilitada en Auth rechazada aunque el perfil esté activo', async () => {
  await adminAuth().updateUser('demo-student', { disabled: true });
  try {
    assert.equal((await login({ email: 'student@usc.edu.co', password: 'Demo1234' }, dependencies)).codigo, 'ACCESO_BLOQUEADO');
    assert.equal(auth.currentUser, null);
  } finally { await adminAuth().updateUser('demo-student', { disabled: false }); }
});

test('un fallo de comprobación no concede acceso ni conserva sesión', async () => {
  const result = await login({ email: 'student@usc.edu.co', password: 'Demo1234' }, {
    ...dependencies, checkIdentity: async () => { throw new Error('Sin conexión'); },
  });
  assert.equal(result.codigo, 'SERVICIO_NO_DISPONIBLE');
  assert.equal(auth.currentUser, null);
});

test('perfil ausente y rol inválido nunca conceden acceso', async () => {
  const ref = getFirestore().doc('users/demo-student');
  const profile = (await ref.get()).data()!;
  try {
    await ref.delete();
    assert.equal((await login({ email: 'student@usc.edu.co', password: 'Demo1234' }, dependencies)).codigo, 'ACCESO_BLOQUEADO');
    await ref.set({ ...profile, role: 'inventado' });
    assert.equal((await login({ email: 'student@usc.edu.co', password: 'Demo1234' }, dependencies)).codigo, 'NO_AUTORIZADO');
    assert.equal(auth.currentUser, null);
  } finally { await ref.set(profile); }
});

test('campos vacíos o malformados y permisos enviados por cliente se rechazan', async () => {
  for (const input of [null, {}, { email: 'mal', password: 'Demo1234' }, { email: 'student@usc.edu.co', password: '' }]) {
    assert.equal((await login(input, dependencies)).codigo, 'VALIDACION');
  }
  assert.equal((await login({ email: 'student@usc.edu.co', password: 'Demo1234', role: 'admin' }, dependencies)).codigo, 'NO_AUTORIZADO');
  assert.equal(auth.currentUser, null);
});
