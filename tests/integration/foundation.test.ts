import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { registerStudent, checkedIdentity, emailKey } from '../../functions/src/identity';
import { seedDemo } from '../../scripts/seed';

const projectId = 'demo-unifood';
let rules: RulesTestEnvironment;
before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST);
  assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  if (!getApps().length) initializeApp({ projectId });
  rules = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile('firestore.rules', 'utf8') } });
  await seedDemo();
});
after(async () => { await rules?.cleanup(); });

test('emuladores: datos ficticios por rol y lectura/escritura aisladas', async () => {
  const db = getFirestore();
  const users = await db.collection('users').get();
  assert.equal(users.docs.filter(d => d.data().role === 'admin' && d.data().state === 'active').length, 2);
  assert.ok(users.docs.some(d => d.data().role === 'student'));
  assert.ok(users.docs.some(d => d.data().role === 'restaurant'));
  await db.doc('probe/local').set({ environment: projectId });
  assert.equal((await db.doc('probe/local').get()).data()?.environment, projectId);
  await db.doc('probe/local').delete();
});

test('reglas: perfiles por servicio; lecturas y escrituras privadas directas denegadas', async () => {
  const student = rules.authenticatedContext('demo-student').firestore();
  const guest = rules.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(student, 'users/demo-student')));
  await assertFails(getDoc(doc(student, 'users/demo-admin-1')));
  await assertFails(getDoc(doc(guest, 'users/demo-student')));
  await assertFails(setDoc(doc(student, 'users/demo-student'), { role: 'admin' }, { merge: true }));
  await assertFails(setDoc(doc(student, 'orders/order-1'), { state: 'collected' }));
  await assertFails(setDoc(doc(student, 'payments/payment-1'), { amount: 1000 }));
  await assertFails(getDoc(doc(student, 'emailReservations/demo')));
});

test('registro concurrente: una sola identidad/perfil y correo normalizado', async () => {
  const input = { name: 'Demo Concurrente', email: ' CONCURRENTE@USC.EDU.CO ', password: 'Demo1234', confirmPassword: 'Demo1234' };
  const results = await Promise.all([registerStudent(input), registerStudent(input)]);
  assert.deepEqual(results.map(r => r.codigo).sort(), ['CORREO_EN_USO', 'OK']);
  const user = await getAuth().getUserByEmail('concurrente@usc.edu.co');
  assert.equal(user.emailVerified, false);
  assert.equal(user.disabled, false);
  const profile = (await getFirestore().doc(`users/${user.uid}`).get()).data();
  assert.equal(profile?.role, 'student');
  assert.equal(profile?.email, 'concurrente@usc.edu.co');
  assert.equal((await getFirestore().collection('users').where('email', '==', 'concurrente@usc.edu.co').get()).size, 1);
});

test('validación en servidor no crea cuentas y no permite autoasignar rol', async () => {
  const input = { name: 'Demo', email: 'invalido@gmail.com', password: 'Demo1234', confirmPassword: 'Demo1234' };
  assert.equal((await registerStudent(input)).codigo, 'VALIDACION');
  assert.equal((await registerStudent({ ...input, email: 'elevado@usc.edu.co', role: 'admin' })).codigo, 'NO_AUTORIZADO');
  await assert.rejects(getAuth().getUserByEmail('elevado@usc.edu.co'));
});

test('duplicado entre roles se rechaza sin borrar la cuenta original', async () => {
  assert.equal((await registerStudent({ name: 'Demo', email: ' ADMIN1@USC.EDU.CO ', password: 'Demo1234', confirmPassword: 'Demo1234' })).codigo, 'CORREO_EN_USO');
  assert.equal((await getFirestore().doc('users/demo-admin-1').get()).data()?.role, 'admin');
});

test('fallo al guardar perfil compensa Auth y permite reintentar sin huérfanos', async () => {
  const input = { name: 'Demo Fallo', email: 'fallo@usc.edu.co', password: 'Demo1234', confirmPassword: 'Demo1234' };
  const result = await registerStudent(input, { persist: async () => { throw new Error('fallo controlado de persistencia'); } });
  assert.equal(result.codigo, 'SERVICIO_NO_DISPONIBLE');
  await assert.rejects(getAuth().getUserByEmail(input.email));
  assert.equal((await getFirestore().collection('users').where('email', '==', input.email).get()).size, 0);
  assert.equal((await registerStudent(input)).codigo, 'OK');
});

test('confirmación perdida después de guardar no deja perfil ni reserva huérfanos', async () => {
  const input = { name: 'Respuesta perdida', email: 'respuesta-perdida@usc.edu.co', password: 'Demo1234', confirmPassword: 'Demo1234' };
  const db = getFirestore();
  const result = await registerStudent(input, { persist: async profile => {
    const batch = db.batch();
    batch.create(db.doc(`users/${profile.id}`), profile);
    batch.create(db.doc(`emailReservations/${emailKey(profile.email)}`), { userId: profile.id });
    await batch.commit();
    throw new Error('Respuesta perdida después del commit');
  } });
  assert.equal(result.codigo, 'SERVICIO_NO_DISPONIBLE');
  await assert.rejects(getAuth().getUserByEmail(input.email));
  assert.equal((await db.collection('users').where('email', '==', input.email).get()).size, 0);
  assert.equal((await db.doc(`emailReservations/${emailKey(input.email)}`).get()).exists, false);
  assert.equal((await registerStudent(input)).codigo, 'OK');
});

test('servicio confiable identifica token y rechaza rol inventado, token inválido y suspensión', async () => {
  const signIn = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@usc.edu.co', password: 'Demo1234', returnSecureToken: true }),
  });
  const { idToken } = await signIn.json();
  assert.equal((await checkedIdentity(`Bearer ${idToken}`, {})).role, 'student');
  await assert.rejects(checkedIdentity(`Bearer ${idToken}`, { role: 'admin' }));
  await assert.rejects(checkedIdentity('Bearer inventado', {}));
  await assert.rejects(checkedIdentity(undefined, {}));
  await getFirestore().doc('users/demo-student').update({ state: 'suspended' });
  await assert.rejects(checkedIdentity(`Bearer ${idToken}`, {}));
  await getFirestore().doc('users/demo-student').update({ state: 'active' });
});

test('API HTTP: registro conecta con Auth y la identidad proviene del token', async () => {
  const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
  const post = async (path: string, body: object, token?: string) => {
    const reply = await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return reply.json();
  };
  const registered = await post('register', { name: 'HTTP Demo', email: 'http@usc.edu.co', password: 'Demo1234', confirmPassword: 'Demo1234' });
  assert.equal(registered.codigo, 'OK');
  const signIn = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: registered.datos.token, returnSecureToken: true }),
  });
  const { idToken } = await signIn.json();
  assert.ok(idToken);
  const identity = await post('identity', {}, idToken);
  assert.equal(identity.codigo, 'OK');
  assert.equal(identity.datos.role, 'student');
  assert.equal((await post('identity', { role: 'admin' }, idToken)).codigo, 'NO_AUTORIZADO');
  assert.equal((await post('identity', {})).codigo, 'SESION_REQUERIDA');
});
