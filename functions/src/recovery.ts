import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { adminServices } from './firebase';
import { emailKey } from './identity';
import { createClock } from '../../src/domain/clock';
import { normalizeEmail, validatePassword } from '../../src/domain/registration';
import { response } from '../../src/domain/response';

type Challenge = { secretHash: string; expiresAt: string; usedAt: string | null; lockedUntil?: string | null };
export type RecoverySender = (to: string, link: string) => Promise<void>;

const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');
const validId = (id: unknown): id is string => typeof id === 'string' && !!id && !id.includes('/');
function matches(record: Challenge | undefined, secret: string, now: number) {
  if (!record || record.usedAt || Date.parse(record.expiresAt) <= now) return false;
  const expected = Buffer.from(record.secretHash, 'hex');
  const actual = Buffer.from(hash(secret), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Sin proveedor de correo autorizado solo existe el remitente del emulador,
// que escribe el enlace en su registro local. Fuera del emulador no hay remitente.
const emulatorSender: RecoverySender = async (to, link) => { console.info(`Enlace de recuperación (solo emulador) para ${to}: ${link}`); };
const configuredSender = process.env.FUNCTIONS_EMULATOR === 'true' ? emulatorSender : undefined;
const linkBase = process.env.RECOVERY_LINK_BASE ?? 'unifood://reset';

export async function generateRecoveryChallenge(userId: string, clock = createClock()) {
  if (!validId(userId)) throw new Error('Cuenta no disponible.');
  const { db } = adminServices();
  const secret = randomBytes(32).toString('base64url');
  const ref = db.doc(`recoveryChallenges/${userId}`);
  return db.runTransaction(async tx => {
    const user = (await tx.get(db.doc(`users/${userId}`))).data();
    const previous = (await tx.get(ref)).data();
    if (!user || user.state === 'deleted') throw new Error('Cuenta no disponible.');
    const generation = Number(previous?.generation ?? 0) + 1;
    const expiresAt = new Date(clock.now().getTime() + 30 * 60 * 1000).toISOString();
    tx.set(ref, { userId, secretHash: hash(secret), generation, expiresAt, usedAt: null });
    return { secret, generation, expiresAt };
  });
}

// Consulta sin efectos; el consumo real ocurre en completeRecovery.
export async function isRecoveryChallengeValid(userId: string, secret: string, clock = createClock()) {
  if (!validId(userId) || !secret) return false;
  const { db } = adminServices();
  const record = (await db.doc(`recoveryChallenges/${userId}`).get()).data() as Challenge | undefined;
  const user = (await db.doc(`users/${userId}`).get()).data();
  return !!user && user.state !== 'deleted' && matches(record, secret, clock.now().getTime());
}

// Misma respuesta exista o no la cuenta. Solo un fallo general, igual
// para cualquier correo, produce el mensaje de reintento.
export async function requestRecovery(input: unknown, send = configuredSender, clock = createClock()) {
  const failure = response('SERVICIO_NO_DISPONIBLE', 'No pudimos procesar la solicitud. Inténtalo de nuevo.', null, true);
  const raw = (input as { email?: unknown } | null)?.email;
  const email = typeof raw === 'string' ? normalizeEmail(raw) : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response('VALIDACION', 'Escribe un correo válido.');
  if (!send) return failure;
  const { db } = adminServices();
  try {
    const userId = (await db.doc(`emailReservations/${emailKey(email)}`).get()).data()?.userId;
    const user = validId(userId) ? (await db.doc(`users/${userId}`).get()).data() : undefined;
    if (user && user.state !== 'deleted' && user.email === email) {
      const { secret } = await generateRecoveryChallenge(userId, clock);
      // Un fallo particular del destinatario no se publica ni registra el enlace.
      try { await send(user.email, `${linkBase}?id=${userId}&code=${secret}`); }
      catch { console.error('No se pudo enviar la recuperación', { userId }); }
    }
  } catch { return failure; }
  return response('OK', 'Si existe una cuenta con ese correo, recibirás un enlace.');
}

const setPassword = async (id: string, password: string) => { await adminServices().auth.updateUser(id, { password }); };

// Auth y Firestore no comparten transacción. Un bloqueo de un minuto impide dos
// cambios simultáneos; si el proceso se interrumpe, el mismo enlace vigente puede
// reintentarse al vencer el bloqueo. Solo la marca de uso lo invalida.
export async function completeRecovery(input: unknown, clock = createClock(), updatePassword = setPassword) {
  const data = (input ?? {}) as Record<string, unknown>;
  let password;
  try { password = validatePassword(data); }
  catch (error) { return response('VALIDACION', (error as Error).message); }
  const invalid = response('RECUPERACION_INVALIDA', 'El enlace venció, ya se usó o fue reemplazado. Tu contraseña no cambió; solicita un enlace nuevo.');
  const { id, code } = data;
  if (!validId(id) || typeof code !== 'string' || !code) return invalid;
  const { auth, db } = adminServices();
  const ref = db.doc(`recoveryChallenges/${id}`);
  const now = clock.now().getTime();
  // Solo modifica el desafío si sigue siendo el mismo enlace.
  const updateSame = (fields: object) => db.runTransaction(async tx => {
    if ((await tx.get(ref)).data()?.secretHash === hash(code)) tx.update(ref, fields);
  });
  let state;
  try {
    state = await db.runTransaction(async tx => {
      const record = (await tx.get(ref)).data() as Challenge | undefined;
      const user = (await tx.get(db.doc(`users/${id}`))).data();
      if (!user || user.state === 'deleted' || !matches(record, code, now)) return 'invalid';
      if (Date.parse(record!.lockedUntil ?? '') > now) return 'busy';
      tx.update(ref, { lockedUntil: new Date(now + 60 * 1000).toISOString() });
      return 'locked';
    });
  } catch { return response('SERVICIO_NO_DISPONIBLE', 'No se realizó el cambio. Inténtalo de nuevo.', null, true); }
  if (state === 'invalid') return invalid;
  if (state === 'busy') return response('EN_PROCESO', 'Este enlace ya se está procesando. Espera un minuto antes de reintentar.', null, true);
  try {
    // Solo cambia la contraseña: estado y suspensión permanecen intactos.
    await updatePassword(id, password);
    await auth.revokeRefreshTokens(id);
    await updateSame({ usedAt: new Date(now).toISOString(), lockedUntil: null });
  } catch {
    // Auth pudo aplicar el cambio aunque se perdiera su respuesta: no afirmar ninguno de los dos.
    await updateSame({ lockedUntil: null }).catch(() => undefined);
    return response('SERVICIO_NO_DISPONIBLE', 'No pudimos completar el cambio de contraseña. Reintenta con el mismo enlace.', null, true);
  }
  return response('OK', 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
}
