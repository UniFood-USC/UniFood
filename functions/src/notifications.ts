import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { adminServices } from './firebase';
import { checkedIdentity } from './identity';
import { response } from '../../src/domain/response';
import { newestFirst, noticeFor, validateDevice, validateNoticeEvent, type Notice } from '../../src/domain/notifications';

// RF-12, RF-17 · Avisos privados en notifications/{evento}_{destinatario}. Solo el servicio
// los escribe y las reglas niegan el acceso directo; cada cuenta consulta los suyos aquí.
// materializeNotices no es una acción pública: la llaman los cambios de pedido confirmados.
type Dependencies = { db?: Firestore };

export async function materializeNotices(input: unknown, { db = adminServices().db }: Dependencies = {}) {
  let event;
  try { event = validateNoticeEvent(input); }
  catch (error) { return response('VALIDACION', (error as Error).message); }
  const notices = event.recipients.map(recipient => noticeFor(event, recipient));
  await db.runTransaction(async tx => {
    const refs = notices.map(notice => db.doc(`notifications/${notice.id}`));
    const existing = await tx.getAll(...refs);
    existing.forEach((snapshot, index) => { if (!snapshot.exists) tx.create(refs[index], notices[index]); });
  });
  return response('OK', 'Avisos registrados.');
}

const MAX_NOTICES = 50;

async function noticeRecipient(authorization: string | undefined) {
  const actor = await checkedIdentity(authorization, {});
  return ['student', 'restaurant'].includes(actor.role) ? actor : null;
}

export async function listNotices(authorization: string | undefined, { db = adminServices().db }: Dependencies = {}) {
  const actor = await noticeRecipient(authorization);
  if (!actor) return response('NO_AUTORIZADO', 'Los avisos son para estudiantes y restaurantes.');
  const snapshot = await db.collection('notifications').where('recipientId', '==', actor.id).get();
  const notices: Notice[] = snapshot.docs.map(doc => {
    const { recipientId: _recipient, ...notice } = doc.data() as Notice & { recipientId: string };
    return notice;
  }).sort(newestFirst).slice(0, MAX_NOTICES);
  return response('OK', notices.length ? 'Avisos consultados.' : 'Todavía no tienes avisos.', { notices });
}

// Un documento por dispositivo (devices/{sha256 del token}): el dispositivo pertenece a la
// última cuenta que inició sesión en él. Se guarda la versión de sesión para que el envío
// descarte dispositivos de sesiones revocadas. Salir lo desvincula sin tocar la bandeja.
const deviceRef = (db: Firestore, token: string) => db.doc(`devices/${createHash('sha256').update(token).digest('hex')}`);

export async function registerDevice(authorization: string | undefined, input: unknown, { db = adminServices().db }: Dependencies = {}) {
  const actor = await noticeRecipient(authorization);
  if (!actor) return response('NO_AUTORIZADO', 'Los avisos son para estudiantes y restaurantes.');
  let device;
  try { device = validateDevice(input); }
  catch (error) { return response('VALIDACION', (error as Error).message); }
  const profile = (await db.doc(`users/${actor.id}`).get()).data();
  await deviceRef(db, device.token).set({ ...device, userId: actor.id, sessionVersion: Number(profile?.sessionVersion ?? 1), updatedAt: new Date().toISOString() });
  return response('OK', 'Dispositivo registrado.');
}

export async function unregisterDevice(authorization: string | undefined, input: unknown, { db = adminServices().db }: Dependencies = {}) {
  const actor = await noticeRecipient(authorization);
  if (!actor) return response('NO_AUTORIZADO', 'Los avisos son para estudiantes y restaurantes.');
  let token;
  try { token = validateDevice(input, ['token']).token; }
  catch (error) { return response('VALIDACION', (error as Error).message); }
  const ref = deviceRef(db, token);
  await db.runTransaction(async tx => {
    if ((await tx.get(ref)).data()?.userId === actor.id) tx.delete(ref);
  });
  return response('OK', 'Dispositivo desvinculado.');
}
