import type { Firestore, Transaction } from 'firebase-admin/firestore';

// Todos los cambios de miembros activos comparten este documento. El recuento
// inicial también funciona con perfiles anteriores a la introducción del control.
export async function readAdminControl(tx: Transaction, db: Firestore) {
  const ref = db.doc('administrativeControl/admins');
  const control = await tx.get(ref);
  const active = await tx.get(db.collection('users').where('role', '==', 'admin').where('state', '==', 'active'));
  return { ref, activeCount: active.docs.filter(doc => !doc.data().provisioning).length, version: Number(control.data()?.version ?? 0) };
}
