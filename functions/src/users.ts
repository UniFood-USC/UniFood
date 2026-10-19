import { FieldValue } from 'firebase-admin/firestore';
import { adminServices } from './firebase';
import { checkedIdentity, emailKey } from './identity';
import { readAdminControl } from './adminControl';
import { validateContact } from '../../src/domain/registration';
import { response } from '../../src/domain/response';
import type { ManagedUser } from '../../src/domain/users';

const publicUser = (id: string, data: FirebaseFirestore.DocumentData): ManagedUser => ({
  id, name: data.name, email: data.email, role: data.role, state: data.state, version: data.version ?? 1,
  ...(data.pendingContact ? { pendingContact: { name: data.pendingContact.name, email: data.pendingContact.email } } : {}),
});
export async function listUsers(authorization: string | undefined) {
  const actor = await checkedIdentity(authorization, {});
  if (actor.role !== 'admin') return response('NO_AUTORIZADO', 'Solo un administrador puede consultar usuarios.');
  const users = await adminServices().db.collection('users').get();
  return response('OK', 'Usuarios consultados.', { users: users.docs.filter(doc => !doc.data().provisioning).map(doc => publicUser(doc.id, doc.data())).sort((a,b) => a.name.localeCompare(b.name)) });
}

export async function updateUserContact(authorization: string | undefined, input: unknown) {
  const actor = await checkedIdentity(authorization, {});
  if (actor.role !== 'admin') return response('NO_AUTORIZADO', 'Solo un administrador puede editar usuarios.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) return response('VALIDACION', 'Revisa los datos.');
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(key => !['id','version','name','email'].includes(key)) || typeof data.id !== 'string' || !data.id || data.id.includes('/') || !Number.isInteger(data.version) || Number(data.version) < 1) return response('VALIDACION', 'Revisa los campos permitidos y la versión.');
  const { auth, db } = adminServices();
  const ref = db.doc(`users/${data.id}`);
  // Reservar ambos correos hasta completar Auth + perfil. Si se interrumpe,
  // repetir exactamente la edición termina la operación sin liberar el correo equivocado.
  const prepared = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const current = snapshot.data();
    const actorProfile = (await tx.get(db.doc(`users/${actor.id}`))).data();
    if (actorProfile?.role !== 'admin' || actorProfile.state !== 'active') return response('NO_AUTORIZADO', 'La cuenta no puede editar usuarios.');
    if (!current || current.state === 'deleted' || current.provisioning) return response('VALIDACION', 'La cuenta no está disponible.');
    let contact;
    try { contact = validateContact(data, current.role); }
    catch (error) { return response('VALIDACION', (error as Error).message); }
    if ((current.version ?? 1) !== data.version) return response('CONFLICTO_VERSION', 'La cuenta cambió. Vuelve al listado y abre la edición actualizada.');
    const pending = current.pendingContact;
    if (pending && (pending.email !== contact.email || pending.name !== contact.name)) return response('EN_PROCESO', 'Hay una edición pendiente. Reintenta primero con los datos anteriores.');
    const reservation = db.doc(`emailReservations/${emailKey(contact.email)}`);
    const owner = (await tx.get(reservation)).data()?.userId;
    if (owner && owner !== data.id) return response('CORREO_EN_USO', 'Este correo ya está registrado.');
    tx.set(reservation, { userId: data.id });
    tx.update(ref, { pendingContact: contact });
    return response('OK', 'Edición preparada.', { ...contact, previousEmail: current.email as string, shouldUpdate: !pending });
  });
  if (prepared.codigo !== 'OK' || !prepared.datos) return prepared;
  const contact = prepared.datos;
  try {
    if (contact.shouldUpdate) await auth.updateUser(data.id, { displayName: contact.name, email: contact.email });
    else {
      // Un reintento solo reconcilia: no lanzar una segunda escritura Auth que
      // pueda terminar tarde y sobrescribir una edición posterior.
      const identity = await auth.getUser(data.id);
      if (identity.email !== contact.email || identity.displayName !== contact.name) return response('EN_PROCESO', 'La edición sigue pendiente de verificación. Reintenta más tarde; si persiste, requiere revisión.', null, true);
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/email-already-exists') {
      await db.runTransaction(async tx => {
        const current = (await tx.get(ref)).data();
        const reservation = db.doc(`emailReservations/${emailKey(contact.email)}`);
        const owner = (await tx.get(reservation)).data()?.userId;
        if (current?.pendingContact?.email === contact.email && current.pendingContact.name === contact.name) {
          if (contact.email !== current.email && owner === data.id) tx.delete(reservation);
          tx.update(ref, { pendingContact: FieldValue.delete() });
        }
      });
      return response('CORREO_EN_USO', 'Este correo ya está registrado.');
    }
    return response('EN_PROCESO', 'No pudimos confirmar la edición. Conserva los datos y reintenta para verificarla.', null, true);
  }
  try {
    return await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data()!;
      const oldReservation = db.doc(`emailReservations/${emailKey(contact.previousEmail)}`);
      const owner = (await tx.get(oldReservation)).data()?.userId;
      if (!current.pendingContact && current.name === contact.name && current.email === contact.email) return response('OK', 'Datos guardados.', publicUser(data.id as string, current));
      if (current.pendingContact?.email !== contact.email || current.pendingContact.name !== contact.name) return response('CONFLICTO_VERSION', 'La cuenta cambió. Consulta el listado.');
      const updated = { name: contact.name, email: contact.email, version: Number(current.version ?? 1) + 1, updatedAt: new Date().toISOString() };
      if (contact.previousEmail !== contact.email && owner === data.id) tx.delete(oldReservation);
      tx.update(ref, { ...updated, pendingContact: FieldValue.delete() });
      return response('OK', 'Datos guardados.', publicUser(data.id as string, { ...current, ...updated }));
    });
  } catch {
    return response('EN_PROCESO', 'No pudimos confirmar la edición. Conserva los datos y reintenta para verificarla.', null, true);
  }
}

// Pieza interna. No se publica una acción de suspensión general hasta
// integrar cancelaciones y reembolsos.
export async function deactivateAdministrator(authorization: string | undefined, id: string) {
  const actor = await checkedIdentity(authorization, {});
  if (actor.role !== 'admin') return response('NO_AUTORIZADO', 'Solo un administrador puede gestionar cuentas.');
  if (!id || id.includes('/')) return response('VALIDACION', 'Cuenta inválida.');
  const { db } = adminServices();
  return db.runTransaction(async tx => {
    const ref = db.doc(`users/${id}`);
    const target = (await tx.get(ref)).data();
    const currentActor = (await tx.get(db.doc(`users/${actor.id}`))).data();
    const control = await readAdminControl(tx, db);
    if (currentActor?.role !== 'admin' || currentActor.state !== 'active') return response('NO_AUTORIZADO', 'La cuenta no puede gestionar usuarios.');
    if (target?.role !== 'admin' || target.provisioning) return response('VALIDACION', 'Esta operación solo admite administradores disponibles.');
    if (target.state !== 'active') return response('OK', 'La cuenta ya está inactiva.');
    if (control.activeCount <= 2) return response('MINIMO_ADMINISTRADORES', 'Deben permanecer al menos dos administradores activos.');
    tx.update(ref, { state: 'suspended', version: Number(target.version ?? 1) + 1 });
    tx.set(control.ref, { activeCount: control.activeCount - 1, version: control.version + 1 });
    return response('OK', 'Administrador desactivado.');
  });
}
