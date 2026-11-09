import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { menusDemo, privado } from './menuDemoData';

export { menusDemo };

// RF-06 · Escribe los menús de demostración en el emulador (restaurantes/{id}/productos/{productoId}).
// Lo llama seedDemo(), así que `npm run seed` ya deja productos en todos los restaurantes de ejemplo.
export async function seedMenus() {
  // Este script BORRA productos: solo corre contra los emuladores de demostración.
  if (process.env.GCLOUD_PROJECT !== 'demo-unifood' || !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Los menús ficticios solo se crean en los emuladores demo-unifood.');
  }
  if (!getApps().length) initializeApp({ projectId: 'demo-unifood' });
  const db = getFirestore();
  for (const [restaurantId, productos] of Object.entries(menusDemo)) {
    // Se reemplaza el menú completo para que el seed sea repetible.
    await db.recursiveDelete(db.collection(`restaurantes/${restaurantId}/productos`));
    for (const { id, ...datos } of productos) await db.doc(`restaurantes/${restaurantId}/productos/${id}`).set({ ...datos, ...privado });
  }
}

// La ruta usa \ en Windows y / en Linux/macOS.
if (/[\\/]seed-menu\.ts$/.test(process.argv[1] ?? '')) {
  process.env.GCLOUD_PROJECT ??= 'demo-unifood';
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  seedMenus().then(() => console.log('Menús ficticios preparados en demo-unifood.')).catch(error => { console.error(error.message); process.exitCode = 1; });
}
