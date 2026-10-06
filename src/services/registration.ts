import { signInWithCustomToken } from 'firebase/auth';
import type { RegistrationInput } from '../domain/registration';
import type { ServiceResponse } from '../domain/response';
import { response } from '../domain/response';
import { localFirebase } from './firebase';
import { callService } from './client';

export async function registerStudent(input: RegistrationInput): Promise<ServiceResponse> {
  const result = await callService<{ token: string; profile: { id: string } }>('register', input);
  if (result.codigo === 'OK' && result.datos) {
    const { auth } = localFirebase();
    try { await signInWithCustomToken(auth, result.datos.token); }
    catch { return response('EN_PROCESO', 'Tu cuenta se creó, pero no pudimos abrir la sesión. No vuelvas a registrarla.'); }
    return response('OK', result.mensaje, { id: result.datos.profile.id });
  }
  return result;
}
