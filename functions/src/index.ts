import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { checkedIdentity, registerStudent } from './identity';
import { response, type ResultCode } from '../../src/domain/response';

initializeApp();
export const api = onRequest({ cors: true, maxInstances: 2 }, async (request, reply) => {
  if (request.method !== 'POST') { reply.status(405).json(response('VALIDACION', 'Método no permitido.')); return; }
  if (request.path === '/register') { reply.json(await registerStudent(request.body)); return; }
  if (request.path === '/identity') {
    try { reply.json(response('OK', 'Identidad comprobada.', await checkedIdentity(request.headers.authorization, request.body))); }
    catch (error) {
      const failure = error as { code?: ResultCode; message: string };
      const code = ['SESION_REQUERIDA', 'ACCESO_BLOQUEADO', 'NO_AUTORIZADO'].includes(failure.code ?? '') ? failure.code! : 'SERVICIO_NO_DISPONIBLE';
      reply.status(code === 'SESION_REQUERIDA' ? 401 : 403).json(response(code, code === 'SERVICIO_NO_DISPONIBLE' ? 'Servicio no disponible.' : failure.message));
    }
    return;
  }
  reply.status(404).json(response('VALIDACION', 'Acción no disponible.'));
});
