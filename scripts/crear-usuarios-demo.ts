import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { emailKey } from '../functions/src/identity';

process.env.GCLOUD_PROJECT ??= 'demo-unifood';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
if (process.env.GCLOUD_PROJECT !== 'demo-unifood') throw new Error('Solo se crean usuarios en los emuladores demo-unifood.');
if (!getApps().length) initializeApp({ projectId: 'demo-unifood' });

const usuarios = [
  { id: 'demo-restaurant-pizza', email: 'pizza@example.test', name: 'Restaurante Pizza Zona', role: 'restaurant', restaurantId: 'rest-pizza' },
];

async function main() {
  const db = getFirestore();
  for (const user of usuarios) {
    try { await getAuth().createUser({ uid: user.id, email: user.email, password: 'Demo1234', displayName: user.name }); }
    catch (error) { if ((error as { code: string }).code !== 'auth/uid-already-exists') throw error; }
    await db.doc(`users/${user.id}`).set({ ...user, state: 'active', version: 1, sessionVersion: 1, createdAt: '2026-10-04T00:00:00Z' });
    await db.doc(`emailReservations/${emailKey(user.email)}`).set({ userId: user.id });
    console.log(`Listo: ${user.email} (${user.role}, ${user.restaurantId})`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
