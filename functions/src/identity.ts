import { createHash } from 'node:crypto';
import { adminServices } from './firebase';
import { validateRegistration } from '../../src/domain/registration';
import { response, type ResultCode } from '../../src/domain/response';
import { createClock } from '../../src/domain/clock';
import { readAdminControl } from './adminControl';

type Profile = { id: string; name: string; email: string; role: 'student' | 'restaurant' | 'admin'; state: 'active' | 'suspended' | 'deleted'; sessionVersion: number; createdAt: string; provisioning?: boolean };
export const emailKey = (email: string) => createHash('sha256').update(email).digest('hex');

async function persistProfile(profile: Profile) {
  const { db } = adminServices();
  await db.runTransaction(async tx => {
    const reservation = db.doc(`emailReservations/${emailKey(profile.email)}`);
    if ((await tx.get(reservation)).exists) throw Object.assign(new Error('Correo ocupado'), { code: 'auth/email-already-exists' });
    tx.create(reservation, { userId: profile.id });
    tx.create(db.doc(`users/${profile.id}`), { ...profile, version: 1, provisioning: true });
  });
}

// Auth y Firestore no comparten una transacción: mantener la identidad deshabilitada
// hasta guardar el perfil evita acceso parcial y permite compensar un fallo.
export async function registerStudent(input: unknown, dependencies: { persist?: typeof persistProfile } = {}) {
  if (input && typeof input === 'object' && ('role' in input || 'rol' in input || 'state' in input || 'uid' in input)) {
    return response('NO_AUTORIZADO', 'El registro no permite asignar roles ni permisos.');
  }
  return createAccount(input, 'student', true, dependencies);
}

async function createAccount(input: unknown, role: 'student' | 'admin', openSession: boolean, dependencies: { persist?: typeof persistProfile } = {}) {
  let data;
  try { data = validateRegistration(input, role); }
  catch (error) { return response('VALIDACION', (error as Error).message); }
  const { auth, db } = adminServices();
  let uid: string | undefined;
  let activatingAdmin = false;
  try {
    const identity = await auth.createUser({ email: data.email, password: data.password, displayName: data.name, disabled: true, emailVerified: false });
    uid = identity.uid;
    const profile: Profile = { id: uid, name: data.name, email: data.email, role, state: 'active', sessionVersion: 1, createdAt: createClock().now().toISOString() };
    await (dependencies.persist ?? persistProfile)(profile);
    await auth.updateUser(uid, { disabled: false });
    activatingAdmin = role === 'admin';
    await db.runTransaction(async tx => {
      const control = role === 'admin' ? await readAdminControl(tx, db) : null;
      tx.update(db.doc(`users/${uid}`), { provisioning: false });
      if (control) tx.set(control.ref, { activeCount: control.activeCount + 1, version: control.version + 1 });
    });
    if (!openSession) return response('OK', 'Cuenta creada.', { profile });
    const token = await auth.createCustomToken(uid);
    return response('OK', 'Cuenta creada.', { profile, token });
  } catch (error) {
    // Una activación administrativa puede haber confirmado aunque se pierda
    // su respuesta. No retirarla: otra desactivación ya pudo contar con ella.
    if (activatingAdmin) return response('EN_PROCESO', 'No pudimos confirmar el alta. Consulta el listado antes de reintentar; si no aparece, requiere revisión.');
    if (uid) {
      try {
        await auth.updateUser(uid, { disabled: true });
        // El commit puede completarse aunque su respuesta se pierda. Consultar
        // la propiedad real de la reserva, no una bandera local de confirmación.
        await db.runTransaction(async tx => {
          const ref = db.doc(`emailReservations/${emailKey(data.email)}`);
          const owner = (await tx.get(ref)).data()?.userId;
          const profile = (await tx.get(db.doc(`users/${uid}`))).data();
          const control = profile?.role === 'admin' ? await readAdminControl(tx, db) : null;
          if (owner === uid) tx.delete(ref);
          tx.delete(db.doc(`users/${uid}`));
          if (control) tx.set(control.ref, { activeCount: control.activeCount - (profile?.state === 'active' && !profile.provisioning ? 1 : 0), version: control.version + 1 });
        });
        await auth.deleteUser(uid);
      } catch {
        // No afirmar que no se creó: una compensación incompleta requiere revisión.
        return response('EN_PROCESO', 'No pudimos confirmar el registro. La cuenta requiere revisión antes de reintentar.', null, false);
      }
    }
    if ((error as { code?: string }).code === 'auth/email-already-exists') return response('CORREO_EN_USO', 'Este correo ya está registrado.');
    return response('SERVICIO_NO_DISPONIBLE', 'No pudimos crear la cuenta. Inténtalo de nuevo.', null, true);
  }
}

export async function checkedIdentity(authorization: string | undefined, input: unknown) {
  const reject = (code: ResultCode, message: string): never => { throw Object.assign(new Error(message), { code }); };
  if (input && typeof input === 'object' && ('role' in input || 'rol' in input)) reject('NO_AUTORIZADO', 'El rol se comprueba en el servicio.');
  if (!authorization?.startsWith('Bearer ')) reject('SESION_REQUERIDA', 'Se requiere una sesión válida.');
  let token;
  const { auth, db } = adminServices();
  try { token = await auth.verifyIdToken(authorization!.slice(7), true); }
  catch (error) {
    if ((error as { code?: string }).code === 'auth/user-disabled') return reject('ACCESO_BLOQUEADO', 'La cuenta no tiene acceso.');
    return reject('SESION_REQUERIDA', 'Se requiere una sesión válida.');
  }
  const profile = (await db.doc(`users/${token.uid}`).get()).data() as Profile | undefined;
  if (!profile || profile.state !== 'active' || profile.provisioning) reject('ACCESO_BLOQUEADO', 'La cuenta no tiene acceso.');
  if (!['student', 'restaurant', 'admin'].includes(profile!.role)) reject('NO_AUTORIZADO', 'La cuenta no tiene un rol autorizado.');
  return { id: token.uid, role: profile!.role, state: profile!.state };
}

export async function createAdministrativeAccount(authorization: string | undefined, input: unknown) {
  const actor = await checkedIdentity(authorization, {});
  if (actor.role !== 'admin') return response('NO_AUTORIZADO', 'Solo un administrador puede crear cuentas.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) return response('VALIDACION', 'Revisa los datos de la cuenta.');
  const data = input as Record<string, unknown>;
  if (!['student', 'admin'].includes(String(data.role)) || Object.keys(data).some(key => !['name', 'email', 'password', 'confirmPassword', 'role'].includes(key))) {
    return response('VALIDACION', 'Selecciona estudiante o administrador y solo los campos permitidos.');
  }
  return createAccount(data, data.role as 'student' | 'admin', false);
}

export async function ownProfile(authorization: string | undefined, input: unknown) {
  const actor = await checkedIdentity(authorization, input);
  if (!input || typeof input !== 'object' || (input as { id?: unknown }).id !== actor.id) {
    return response('NO_AUTORIZADO', 'Solo puedes consultar tu propio perfil.');
  }
  const profile = (await adminServices().db.doc(`users/${actor.id}`).get()).data() as Profile | undefined;
  if (!profile || profile.state !== 'active') return response('ACCESO_BLOQUEADO', 'La cuenta no tiene acceso.');
  return response('OK', 'Perfil consultado.', { id: actor.id, name: profile.name, email: profile.email, role: profile.role, state: profile.state });
}
