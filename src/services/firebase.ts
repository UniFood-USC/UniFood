import { initializeApp, getApps } from 'firebase/app';
import { connectAuthEmulator, getAuth, inMemoryPersistence, setPersistence } from 'firebase/auth';

export function localFirebase() {
  // Esta entrega solo habilita la demo local. No hay fallback a servicios reales: una
  // compilación de demostración (APK) lleva fija la dirección del equipo con los emuladores.
  const host = process.env.EXPO_PUBLIC_EMULATOR_HOST || (__DEV__ ? '127.0.0.1' : '');
  if (!host) throw new Error('La demo local no está habilitada en esta compilación.');
  const existing = getApps().find(app => app.name === 'unifood-local');
  const app = existing ?? initializeApp({ apiKey: 'demo-key', projectId: 'demo-unifood', authDomain: 'demo-unifood.firebaseapp.com' }, 'unifood-local');
  const auth = getAuth(app);
  if (!existing) connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  return { auth, baseUrl: `http://${host}:5001/demo-unifood/us-central1/api`, ready: setPersistence(auth, inMemoryPersistence) };
}
