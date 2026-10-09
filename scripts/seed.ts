import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { emailKey } from '../functions/src/identity';

export async function seedDemo() {
  if (process.env.GCLOUD_PROJECT !== 'demo-unifood' || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Los datos ficticios solo se crean en los emuladores demo-unifood.');
  }
  if (!getApps().length) initializeApp({ projectId: 'demo-unifood' });
  const users = [
    { id: 'demo-admin-1', email: 'admin1@usc.edu.co', name: 'Administrador Demo Uno', role: 'admin' },
    { id: 'demo-admin-2', email: 'admin2@example.test', name: 'Administrador Demo Dos', role: 'admin' },
    { id: 'demo-student', email: 'student@usc.edu.co', name: 'Estudiante Demo', role: 'student' },
    { id: 'demo-restaurant', email: 'restaurant@example.test', name: 'Restaurante Demo', role: 'restaurant' },
  ];
  for (const user of users) {
    try { await getAuth().createUser({ uid: user.id, email: user.email, password: 'Demo1234', displayName: user.name }); }
    catch (error) { if ((error as { code: string }).code !== 'auth/uid-already-exists') throw error; }
    await getFirestore().doc(`users/${user.id}`).set({ ...user, state: 'active', sessionVersion: 1, createdAt: '2026-10-04T00:00:00Z' });
    await getFirestore().doc(`emailReservations/${emailKey(user.email)}`).set({ userId: user.id });
  }
}

if (process.argv[1]?.endsWith('/seed.ts')) seedDemo().then(() => console.log('Cuatro identidades ficticias preparadas en demo-unifood.')).catch(error => { console.error(error.message); process.exitCode = 1; });
