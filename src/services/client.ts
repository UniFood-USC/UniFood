import { isServiceResponse, response, type ServiceResponse } from '../domain/response';
import { localFirebase } from './firebase';
import { signOut } from 'firebase/auth';

// Un solo intento por llamada: una desconexión no demuestra que la mutación falló.
export async function callService<T = unknown>(action: 'register' | 'recovery/request' | 'recovery/complete' | 'identity' | 'profile' | 'users/create' | 'users/list' | 'users/update', input: unknown): Promise<ServiceResponse<T>> {
  const { auth, baseUrl, ready } = localFirebase();
  await ready;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!['register', 'recovery/request', 'recovery/complete'].includes(action)) {
    if (!auth.currentUser) return response('SESION_REQUERIDA', 'Se requiere una sesión válida.');
    try { headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`; }
    catch (error) {
      const code = (error as { code?: string }).code;
      if (['auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-disabled', 'auth/user-not-found'].includes(code ?? '')) {
        await signOut(auth);
        return response(code === 'auth/user-disabled' ? 'ACCESO_BLOQUEADO' : 'SESION_REQUERIDA', 'Inicia sesión de nuevo.');
      }
      throw error;
    }
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const reply = await fetch(`${baseUrl}/${action}`, {
      method: 'POST', headers, body: JSON.stringify(input), signal: controller.signal,
    });
    const result: unknown = await reply.json();
    if (!isServiceResponse(result) || (!reply.ok && result.codigo === 'OK')) {
      throw new Error('Respuesta del servicio inválida');
    }
    if (result.codigo === 'SESION_REQUERIDA' || result.codigo === 'ACCESO_BLOQUEADO') await signOut(auth);
    return result as ServiceResponse<T>;
  } finally { clearTimeout(timeout); }
}
