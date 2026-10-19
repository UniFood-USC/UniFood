import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { checkedIdentity, registerStudent, createAdministrativeAccount, ownProfile } from './identity';
import { response, type ResultCode } from '../../src/domain/response';
import { listUsers, updateUserContact } from './users';
import { completeRecovery, requestRecovery } from './recovery';

initializeApp();
export const api = onRequest({ cors: true, maxInstances: 2 }, async (request, reply) => {
  if (request.method !== 'POST') { reply.status(405).json(response('VALIDACION', 'Método no permitido.')); return; }
  if (request.path === '/register') { reply.json(await registerStudent(request.body)); return; }
  if (request.path === '/recovery/request') { reply.json(await requestRecovery(request.body)); return; }
  if (request.path === '/recovery/complete') { reply.json(await completeRecovery(request.body)); return; }
  if (['/identity', '/profile', '/users/create', '/users/list', '/users/update'].includes(request.path)) {
    try {
      const result = request.path === '/users/list' ? await listUsers(request.headers.authorization)
        : request.path === '/users/update' ? await updateUserContact(request.headers.authorization, request.body)
        : request.path === '/users/create'
        ? await createAdministrativeAccount(request.headers.authorization, request.body)
        : request.path === '/profile' ? await ownProfile(request.headers.authorization, request.body)
          : response('OK', 'Identidad comprobada.', await checkedIdentity(request.headers.authorization, request.body));
      reply.json(result);
    }
    catch (error) {
      const failure = error as { code?: ResultCode; message: string };
      const code = ['SESION_REQUERIDA', 'ACCESO_BLOQUEADO', 'NO_AUTORIZADO'].includes(failure.code ?? '') ? failure.code! : 'SERVICIO_NO_DISPONIBLE';
      reply.status(code === 'SESION_REQUERIDA' ? 401 : code === 'SERVICIO_NO_DISPONIBLE' ? 503 : 403).json(response(code, code === 'SERVICIO_NO_DISPONIBLE' ? 'Servicio no disponible.' : failure.message));
    }
    return;
  }
  reply.status(404).json(response('VALIDACION', 'Acción no disponible.'));
});
