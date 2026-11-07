import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { adminServices } from '../../functions/src/firebase';
import { seedDemo } from '../../scripts/seed';

// Matriz de acceso directo a los datos privados de carrito, pagos, pedidos y avisos: desde la app nadie
// los lee, lista ni escribe, ni siquiera su dueño; todo pasa por el servicio, que toma la cuenta
// de la sesión (sus pruebas cubren que cada cuenta solo recibe lo propio).
const privateDocs = {
  carts: 'carts/demo-student',
  notifications: 'notifications/aislamiento_demo-student',
  devices: 'devices/aislamiento',
  purchaseAttempts: 'purchaseAttempts/aislamiento',
  paymentMovements: 'paymentMovements/pay_aislamiento',
  orders: 'orders/aislamiento',
};
const owned = { userId: 'demo-student', recipientId: 'demo-student' };
let rules: RulesTestEnvironment;
const denied = (attempt: Promise<unknown>, label: string) => assertFails(attempt).catch(() => assert.fail(`${label} debería rechazarse`));

before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood');
  await seedDemo();
  const { db } = adminServices();
  await Promise.all(Object.values(privateDocs).map(path => db.doc(path).set(owned, { merge: true })));
  rules = await initializeTestEnvironment({ projectId: 'demo-unifood', firestore: { rules: await readFile('firestore.rules', 'utf8') } });
});
after(async () => { await rules?.cleanup(); });

test('aislamiento: dueño, otra cuenta e invitado no leen, listan ni escriben carrito, pagos, avisos ni dispositivos', async () => {
  const contexts = {
    dueño: rules.authenticatedContext('demo-student').firestore(),
    otraCuenta: rules.authenticatedContext('demo-restaurant').firestore(),
    invitado: rules.unauthenticatedContext().firestore(),
  };
  for (const [who, db] of Object.entries(contexts)) {
    for (const [name, path] of Object.entries(privateDocs)) {
      const ref = doc(db, path);
      await denied(getDoc(ref), `${who} lee ${name}`);
      await denied(getDocs(query(collection(db, name), where('userId', '==', 'demo-student'))), `${who} lista ${name}`);
      await denied(setDoc(ref, { userId: 'demo-restaurant' }, { merge: true }), `${who} modifica ${name}`);
      await denied(setDoc(doc(db, `${name}/nuevo-${who}`), owned), `${who} crea en ${name}`);
      await denied(deleteDoc(ref), `${who} borra ${name}`);
    }
  }
  const { db } = adminServices();
  for (const path of Object.values(privateDocs)) assert.equal((await db.doc(path).get()).data()?.userId, 'demo-student', `${path} intacto`);
});
