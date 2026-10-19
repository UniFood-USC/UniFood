import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { emailKey } from '../functions/src/identity';
import { readAdminControl } from '../functions/src/adminControl';

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
    const db = getFirestore();
    await db.runTransaction(async tx => {
      const ref = db.doc(`users/${user.id}`);
      const old = (await tx.get(ref)).data();
      const control = user.role === 'admin' ? await readAdminControl(tx, db) : null;
      tx.set(ref, { ...user, state: 'active', version: 1, sessionVersion: 1, createdAt: '2026-10-04T00:00:00Z' });
      tx.set(db.doc(`emailReservations/${emailKey(user.email)}`), { userId: user.id });
      if (control) tx.set(control.ref, { activeCount: control.activeCount + (old?.role === 'admin' && old.state === 'active' ? 0 : 1), version: control.version + 1 });
    });
  }
  await seedRestaurants();
}

// RF-04 · Restaurantes ficticios del campus (colección `restaurantes`).
// Aprobados y activos: 6 (el listado muestra más de 5, con abiertos y cerrados según la hora).
// NO deben aparecer: uno inactivo, uno pendiente, uno suspendido y uno eliminado.
// ownerId y ownerEmail simulan campos privados que el servicio nunca debe exponer.
const tramo = (abre: string, cierra: string) => ({ abre, cierra });
const semana = (dias: string[], abre: string, cierra: string) => Object.fromEntries(dias.map(dia => [dia, tramo(abre, cierra)]));
const LUN_SAB = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const LUN_VIE = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const logo = (texto: string) => `https://placehold.co/160x160/C8440A/FFFFFF/png?text=${texto}`;

export async function seedRestaurants() {
  const db = getFirestore();
  const restaurantes = [
    { id: 'rest-burger', nombre: 'Burger Campus', logo: logo('BC'), estado: 'aprobado', activo: true, horario: semana(LUN_SAB, '07:00', '20:00') },
    { id: 'rest-pizza', nombre: 'Pizza Zona', logo: logo('PZ'), estado: 'aprobado', activo: true, horario: semana(LUN_SAB, '11:00', '21:00') },
    { id: 'rest-sazon', nombre: 'Sazón USC', logo: logo('SU'), estado: 'aprobado', activo: true, horario: semana(LUN_VIE, '06:30', '15:00') },
    { id: 'rest-cafe', nombre: 'Café Universitario', estado: 'aprobado', activo: true, horario: semana(LUN_SAB, '06:00', '19:00') },
    // Sin horario definido: disponible mientras esté activo (siempre hay uno abierto en la demo).
    { id: 'rest-fruta', nombre: 'Fruta Fresca', estado: 'aprobado', activo: true },
    { id: 'rest-arepas', nombre: 'Arepas del Valle', logo: logo('AV'), estado: 'aprobado', activo: true, horario: semana(LUN_VIE, '07:00', '16:00') },
    // No se listan para el estudiante.
    { id: 'rest-wok', nombre: 'Wok Express', logo: logo('WE'), estado: 'aprobado', activo: false, horario: semana(LUN_SAB, '10:00', '18:00') },
    { id: 'rest-nuevo', nombre: 'Sabores Nuevos', estado: 'pendiente', activo: true },
    { id: 'rest-baja', nombre: 'Taquería Suspendida', estado: 'suspendido', activo: true },
    { id: 'rest-eliminado', nombre: 'Fonda Cerrada', estado: 'eliminado', activo: false },
  ];
  for (const { id, ...datos } of restaurantes) {
    // ownerEmail y ownerId simulan los campos privados que el listado nunca debe exponer.
    await db.doc(`restaurantes/${id}`).set({ ...datos, ownerId: 'demo-restaurant', ownerEmail: 'restaurant@example.test' });
  }
}

if (process.argv[1]?.endsWith('/seed.ts')) seedDemo().then(() => console.log('Cuatro identidades y diez restaurantes ficticios preparados en demo-unifood.')).catch(error => { console.error(error.message); process.exitCode = 1; });
