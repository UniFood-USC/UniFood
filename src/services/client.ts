import { isServiceResponse, response, type ServiceResponse } from '../domain/response';
import { localFirebase } from './firebase';

// Un solo intento por llamada: una desconexión no demuestra que la mutación falló.
export async function callService<T = unknown>(action: 'register' | 'identity', input: unknown): Promise<ServiceResponse<T>> {
  const { auth, baseUrl, ready } = localFirebase();
  await ready;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (action !== 'register') {
    if (!auth.currentUser) return response('SESION_REQUERIDA', 'Se requiere una sesión válida.');
    headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
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
    return result as ServiceResponse<T>;
  } finally { clearTimeout(timeout); }
}
