import { signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth';
import { normalizeEmail } from '../domain/registration';
import { response, type ServiceResponse } from '../domain/response';
import type { UserRole } from '../types/domain';
import { localFirebase } from './firebase';
import { callService } from './client';

export type LoginIdentity = { id: string; role: UserRole; state: 'active' };
type Dependencies = {
  firebase: () => { auth: Auth; ready: Promise<void> };
  checkIdentity: () => Promise<ServiceResponse<LoginIdentity>>;
};

// Auth valida credenciales; el servicio decide el acceso con el perfil vigente.
export async function login(input: unknown, dependencies: Dependencies = {
  firebase: localFirebase,
  checkIdentity: () => callService<LoginIdentity>('identity', {}),
}): Promise<ServiceResponse<LoginIdentity>> {
  let auth: Auth | undefined;
  try {
    const context = dependencies.firebase();
    auth = context.auth;
    await context.ready;
    await signOut(auth);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return response('VALIDACION', 'Escribe tu correo y contraseña.');
    }
    const data = input as Record<string, unknown>;
    if (['role', 'rol', 'state', 'uid'].some(key => key in data)) {
      return response('NO_AUTORIZADO', 'El rol y el estado se comprueban en el servicio.');
    }
    if (typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(data.email))
      || typeof data.password !== 'string' || !data.password) {
      return response('VALIDACION', 'Escribe un correo válido y tu contraseña.');
    }
    // No recortar contraseñas ni aplicar reglas de alta al acceder a una cuenta.
    const credential = await signInWithEmailAndPassword(auth, normalizeEmail(data.email), data.password);
    const result = await dependencies.checkIdentity();
    if (result.codigo !== 'OK') {
      await signOut(auth);
      return { ...result, datos: null };
    }
    const identity = result.datos;
    if (!identity || identity.id !== credential.user.uid || identity.state !== 'active'
      || !['student', 'restaurant', 'admin'].includes(identity.role)) {
      throw new Error('Identidad no válida');
    }
    return response('OK', 'Sesión iniciada.', { id: identity.id, role: identity.role, state: 'active' });
  } catch (error) {
    if (auth) await signOut(auth);
    const code = (error as { code?: string })?.code;
    if (code === 'auth/user-disabled') return response('ACCESO_BLOQUEADO', 'La cuenta no tiene acceso.');
    if (['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code ?? '')) {
      return response('CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.');
    }
    return response<LoginIdentity>('SERVICIO_NO_DISPONIBLE', 'No pudimos iniciar sesión. Inténtalo de nuevo.', null, true);
  }
}
