import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { emailKey } from '../functions/src/identity';
import { readAdminControl } from '../functions/src/adminControl';
async function main() {
  if (process.env.GCLOUD_PROJECT !== 'demo-unifood' || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Solo emulador');
  initializeApp({ projectId: 'demo-unifood' });
  const id = 'preview-t025-admin', email = 'preview-t025@example.test', db = getFirestore();
  if (process.argv.includes('--cleanup')) {
    await getAuth().deleteUser(id);
    await db.runTransaction(async tx => {
      const control = await readAdminControl(tx, db);
      tx.delete(db.doc(`users/${id}`)); tx.delete(db.doc(`emailReservations/${emailKey(email)}`));
      tx.set(control.ref, { activeCount: control.activeCount - 1, version: control.version + 1 });
    });
  } else {
    await getAuth().createUser({ uid: id, email, password: 'Demo1234', displayName: 'Administrador visual de prueba' });
    await db.runTransaction(async tx => {
      const control = await readAdminControl(tx, db);
      tx.create(db.doc(`users/${id}`), { id, email, name: 'Administrador visual de prueba', role: 'admin', state: 'active', version: 1 });
      tx.create(db.doc(`emailReservations/${emailKey(email)}`), { userId: id });
      tx.set(control.ref, { activeCount: control.activeCount + 1, version: control.version + 1 });
    });
  }
}
main().catch(() => { console.error('No se pudo preparar la cuenta temporal'); process.exitCode = 1; });
