import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { seedDemo } from '../../scripts/seed';
import { emailKey } from '../../functions/src/identity';
import { brevoSender, completeRecovery, generateRecoveryChallenge, requestRecovery } from '../../functions/src/recovery';
import { createClock } from '../../src/domain/clock';

const base = 'http://127.0.0.1:5001/demo-unifood/us-central1/api';
const post = async (path: string, body: object, token?: string) => (await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json();
async function login(email: string, password: string) {
  return (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json();
}
async function account(email: string, state = 'active') {
  const user = await getAuth().createUser({ email, password: 'Anterior123', disabled: state !== 'active' });
  const db = getFirestore();
  await db.doc(`users/${user.uid}`).set({ id: user.uid, name: 'Recuperación prueba', email, role: 'student', state, sessionVersion: 1, version: 1 });
  await db.doc(`emailReservations/${emailKey(email)}`).set({ userId: user.uid });
  return user.uid;
}
const change = (id: string, code: string, password = 'Nueva1234') => ({ id, code, password, confirmPassword: password });
const used = async (id: string) => (await getFirestore().doc(`recoveryChallenges/${id}`).get()).data()?.usedAt;
before(async () => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); await seedDemo(); });

test('dos usos simultáneos producen un único cambio y el enlace no se reutiliza', async () => {
  const id = await account('rec-doble@usc.edu.co');
  const { secret } = await generateRecoveryChallenge(id);
  const old = (await login('rec-doble@usc.edu.co', 'Anterior123')).idToken;
  await new Promise(resolve => setTimeout(resolve, 1100));
  const results = await Promise.all([completeRecovery(change(id, secret, 'Primera123')), completeRecovery(change(id, secret, 'Segunda123'))]);
  // El segundo uso queda en proceso o ya inválido, según cuándo lea el desafío.
  assert.equal(results.filter(r => r.codigo === 'OK').length, 1);
  assert.ok(results.every(r => ['OK', 'EN_PROCESO', 'RECUPERACION_INVALIDA'].includes(r.codigo)));
  const logins = await Promise.all(['Primera123', 'Segunda123', 'Anterior123'].map(p => login('rec-doble@usc.edu.co', p)));
  assert.equal(logins.filter(r => r.idToken).length, 1);
  assert.ok(logins[2].error);
  assert.equal((await post('identity', {}, old)).codigo, 'SESION_REQUERIDA');
  assert.equal((await completeRecovery(change(id, secret, 'Tercera123'))).codigo, 'RECUPERACION_INVALIDA');
  assert.ok((await login('rec-doble@usc.edu.co', 'Tercera123')).error);
});

test('enlaces vencidos, sustituidos o ajenos no cambian contraseña ni levantan suspensión', async () => {
  let now = Date.parse('2026-10-09T12:00:00Z');
  const clock = createClock(() => now);
  const id = await account('rec-suspendida@usc.edu.co', 'suspended');
  const first = await generateRecoveryChallenge(id, clock);
  const second = await generateRecoveryChallenge(id, clock);
  assert.equal((await completeRecovery(change(id, first.secret), clock)).codigo, 'RECUPERACION_INVALIDA');
  assert.equal((await completeRecovery(change('demo-student', second.secret), clock)).codigo, 'RECUPERACION_INVALIDA');
  assert.equal((await completeRecovery(change(id, 'inventado'), clock)).codigo, 'RECUPERACION_INVALIDA');
  now += 30 * 60 * 1000;
  assert.equal((await completeRecovery(change(id, second.secret), clock)).codigo, 'RECUPERACION_INVALIDA');
  assert.equal(await used(id), null);
  const fresh = await generateRecoveryChallenge(id, clock);
  assert.equal((await completeRecovery({ ...change(id, fresh.secret), confirmPassword: 'Otra1234' }, clock)).codigo, 'VALIDACION');
  assert.equal((await completeRecovery(change(id, fresh.secret, 'corta1'), clock)).codigo, 'VALIDACION');
  assert.equal((await completeRecovery(change(id, fresh.secret), clock)).codigo, 'OK');
  assert.equal((await getAuth().getUser(id)).disabled, true);
  assert.equal((await getFirestore().doc(`users/${id}`).get()).data()?.state, 'suspended');
  await getAuth().updateUser(id, { disabled: false });
  assert.ok((await login('rec-suspendida@usc.edu.co', 'Nueva1234')).idToken, 'la contraseña sí cambió');
  await getAuth().updateUser(id, { disabled: true });
});

test('un fallo al actualizar Auth conserva la contraseña y el mismo enlace completa después', async () => {
  const id = await account('rec-fallo@usc.edu.co');
  const { secret } = await generateRecoveryChallenge(id);
  const failing = async () => { throw new Error('Auth no disponible'); };
  const failed = await completeRecovery(change(id, secret), createClock(), failing);
  assert.equal(failed.codigo, 'SERVICIO_NO_DISPONIBLE');
  assert.equal(failed.recuperable, true);
  assert.ok((await login('rec-fallo@usc.edu.co', 'Anterior123')).idToken);
  assert.equal(await used(id), null);
  assert.equal((await completeRecovery(change(id, secret))).codigo, 'OK');
  assert.ok((await login('rec-fallo@usc.edu.co', 'Nueva1234')).idToken);
  assert.equal((await completeRecovery(change(id, secret, 'Otra12345'))).codigo, 'RECUPERACION_INVALIDA');
});

test('una interrupción tras consumir bloquea un minuto y luego permite completar una sola vez', async () => {
  let now = Date.parse('2026-10-09T12:00:00Z');
  const clock = createClock(() => now);
  const id = await account('rec-interrumpida@usc.edu.co');
  const { secret } = await generateRecoveryChallenge(id, clock);
  // Simula un proceso que consumió el desafío y terminó antes de actualizar Auth.
  await getFirestore().doc(`recoveryChallenges/${id}`).update({ lockedUntil: new Date(now + 60 * 1000).toISOString() });
  assert.equal((await completeRecovery(change(id, secret), clock)).codigo, 'EN_PROCESO');
  assert.ok((await login('rec-interrumpida@usc.edu.co', 'Anterior123')).idToken);
  now += 60 * 1000;
  assert.equal((await completeRecovery(change(id, secret), clock)).codigo, 'OK');
  assert.equal((await completeRecovery(change(id, secret), clock)).codigo, 'RECUPERACION_INVALIDA');
  // Respuesta de Auth perdida tras aplicar el cambio: el mismo enlace lo completa.
  const next = await generateRecoveryChallenge(id, clock);
  const partial = await completeRecovery(change(id, next.secret, 'Parcial123'), clock, async (uid, password) => {
    await getAuth().updateUser(uid, { password });
    throw new Error('respuesta perdida');
  });
  assert.equal(partial.codigo, 'SERVICIO_NO_DISPONIBLE');
  assert.equal(await used(id), null);
  assert.equal((await completeRecovery(change(id, next.secret, 'Parcial123'), clock)).codigo, 'OK');
});

test('respuesta pública idéntica con cuenta existente, inexistente o eliminada', async () => {
  const sent: { to: string; link: string }[] = [];
  const send = async (to: string, link: string) => { sent.push({ to, link }); };
  const existing = await requestRecovery({ email: ' STUDENT@usc.edu.co ' }, send);
  const missing = await requestRecovery({ email: 'nadie@usc.edu.co' }, send);
  assert.deepEqual(existing, missing);
  assert.equal(existing.mensaje, 'Si existe una cuenta con ese correo, recibirás un enlace.');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'student@usc.edu.co');
  const link = new URL(sent[0].link);
  assert.equal(link.searchParams.get('id'), 'demo-student');
  const stored = (await getFirestore().doc('recoveryChallenges/demo-student').get()).data()!;
  assert.equal(JSON.stringify(stored).includes(link.searchParams.get('code')!), false);
  const failingSend = async () => { throw new Error('buzón rechazado'); };
  assert.deepEqual(await requestRecovery({ email: 'student@usc.edu.co' }, failingSend), missing);
  const deleted = await account('rec-eliminada@usc.edu.co', 'deleted');
  assert.deepEqual(await requestRecovery({ email: 'rec-eliminada@usc.edu.co' }, send), missing);
  assert.equal((await getFirestore().doc(`recoveryChallenges/${deleted}`).get()).exists, false);
  assert.equal((await requestRecovery({ email: 'no-es-correo' }, send)).codigo, 'VALIDACION');
  const unconfigured = await requestRecovery({ email: 'student@usc.edu.co' }, undefined);
  assert.deepEqual(unconfigured, await requestRecovery({ email: 'nadie@usc.edu.co' }, undefined));
  assert.equal(unconfigured.mensaje, 'No pudimos procesar la solicitud. Inténtalo de nuevo.');
});

test('los servicios públicos no exigen sesión ni exponen el secreto', async () => {
  const existing = await post('recovery/request', { email: 'student@usc.edu.co' });
  assert.deepEqual(existing, await post('recovery/request', { email: 'nadie@usc.edu.co' }));
  assert.equal(existing.codigo, 'OK');
  assert.equal(JSON.stringify(existing).includes('code'), false);
  assert.equal((await post('recovery/complete', change('demo-student', 'inventado'))).codigo, 'RECUPERACION_INVALIDA');
});

test('Brevo recibe destinatario, remitente y enlace; una respuesta de error se trata como fallo de envío', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fake = (status: number) => (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response('{}', { status }); }) as typeof fetch;
  await brevoSender('clave-prueba', 'remitente@example.test', fake(201))('destino@example.test', 'http://localhost:8081/reset?id=a&code=b');
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal((calls[0].init.headers as Record<string, string>)['api-key'], 'clave-prueba');
  const body = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(body.to, [{ email: 'destino@example.test' }]);
  assert.equal(body.sender.email, 'remitente@example.test');
  assert.match(body.htmlContent, /href="http:\/\/localhost:8081\/reset\?id=a&code=b"/);
  await assert.rejects(brevoSender('clave-mala', 'remitente@example.test', fake(401))('destino@example.test', 'enlace'));
  assert.equal(process.env.BREVO_API_KEY || '', '', 'las pruebas nunca usan una clave real');
});
