import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { adminServices } from './firebase';
import { createClock } from '../../src/domain/clock';

const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');
// Interno: el secreto se devuelve solo al futuro adaptador de correo confiable.
// No hay endpoint público ni consumo/cambio de contraseña en T030.
export async function generateRecoveryChallenge(userId: string, clock = createClock()) {
  if (!userId || userId.includes('/')) throw new Error('Cuenta no disponible.');
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

// Consulta interna, no autoriza un consumo: T031 deberá verificar y consumir
// dentro de la misma transacción para impedir doble uso.
export async function isRecoveryChallengeValid(userId: string, secret: string, clock = createClock()) {
  if (!userId || userId.includes('/') || !secret) return false;
  const { db } = adminServices();
  const record = (await db.doc(`recoveryChallenges/${userId}`).get()).data();
  const user = (await db.doc(`users/${userId}`).get()).data();
  if (!user || user.state === 'deleted' || !record || record.usedAt || Date.parse(record.expiresAt) <= clock.now().getTime()) return false;
  const expected = Buffer.from(record.secretHash, 'hex');
  const actual = Buffer.from(hash(secret), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
