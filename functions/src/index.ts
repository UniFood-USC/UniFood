import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { checkedIdentity, registerStudent, createAdministrativeAccount, ownProfile } from './identity';
import { response, type ResultCode } from '../../src/domain/response';
import { changeUserState, deleteAccount, listUsers, updateUserContact } from './users';
import { completeRecovery, requestRecovery } from './recovery';
import { listRestaurants } from './restaurants';
import { readMenu, readProduct } from './menu';
import { readCart, saveCart } from './cart';
import { placeOrder } from './checkout';
import { listNotices, registerDevice, unregisterDevice } from './notifications';
import { changeOrder, getOrder, listOrders } from './orders';

initializeApp();
export const api = onRequest({ cors: true, maxInstances: 2 }, async (request, reply) => {
  if (request.method !== 'POST') { reply.status(405).json(response('VALIDACION', 'Método no permitido.')); return; }
  if (request.path === '/register') { reply.json(await registerStudent(request.body)); return; }
  if (request.path === '/recovery/request') { reply.json(await requestRecovery(request.body)); return; }
  if (request.path === '/recovery/complete') { reply.json(await completeRecovery(request.body)); return; }
  if (['/identity', '/profile', '/users/create', '/users/list', '/users/update', '/users/state', '/users/delete', '/restaurants/list', '/cart/get', '/cart/save', '/notifications/list', '/devices/register', '/devices/unregister', '/orders/list', '/orders/get', '/orders/change', '/menu/list', '/menu/product', '/checkout/place'].includes(request.path)) {
    try {
      const result = request.path === '/restaurants/list' ? await listRestaurants(request.headers.authorization)
        : request.path === '/menu/list' ? await readMenu(request.headers.authorization, request.body)
        : request.path === '/menu/product' ? await readProduct(request.headers.authorization, request.body)
        : request.path === '/orders/list' ? await listOrders(request.headers.authorization, request.body)
        : request.path === '/orders/get' ? await getOrder(request.headers.authorization, request.body)
        : request.path === '/orders/change' ? await changeOrder(request.headers.authorization, request.body)
        : request.path === '/cart/get' ? await readCart(request.headers.authorization)
        : request.path === '/checkout/place' ? await placeOrder(request.headers.authorization, request.body)
        : request.path === '/notifications/list' ? await listNotices(request.headers.authorization)
        : request.path === '/devices/register' ? await registerDevice(request.headers.authorization, request.body)
        : request.path === '/devices/unregister' ? await unregisterDevice(request.headers.authorization, request.body)
        : request.path === '/cart/save' ? await saveCart(request.headers.authorization, request.body)
        : request.path === '/users/list' ? await listUsers(request.headers.authorization)
        : request.path === '/users/state' ? await changeUserState(request.headers.authorization, request.body)
        : request.path === '/users/delete' ? await deleteAccount(request.headers.authorization, request.body)
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
