import { initializeApp } from 'firebase-admin/app';
import { onRequest, type Request } from 'firebase-functions/v2/https';
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
import { readCart, saveCart } from './cart';
import { listNotices, registerDevice, unregisterDevice } from './notifications';
import { listOwnProducts, readPhoto, removeProduct, saveProduct, uploadPhoto } from './productManagement';
import {
  changeRestaurantState, listRestaurantsAdmin, readOwnRestaurant, registerRestaurant, resubmitRestaurant, reviewRestaurant, saveClosure,
  saveOwnInfo, saveSchedule, updateRestaurantAdmin,
} from './restaurantManagement';


initializeApp();

// Dirección pública de este servicio (para armar la URL de las fotos de producto).
// En el emulador la ruta lleva /{proyecto}/{región}/api; en producción el servicio cuelga de la raíz de su host.
const publicBaseUrl = (request: Request) => {
  const host = request.get('x-forwarded-host') ?? request.get('host') ?? '';
  return process.env.FUNCTIONS_EMULATOR === 'true'
    ? `http://${host}/${process.env.GCLOUD_PROJECT}/us-central1/api`
    : `https://${host}`;
};
export const api = onRequest({ cors: true, maxInstances: 2 }, async (request, reply) => {
  // RF-16 · Las fotos de producto se leen con GET público: la etiqueta <img> no puede enviar sesión.
  if (request.method === 'GET' && request.path.startsWith('/photos/')) {
    try {
      const foto = await readPhoto(request.path);
      if (!foto) { reply.status(404).json(response('VALIDACION', 'Foto no disponible.')); return; }
      reply.set('Content-Type', foto.formato).set('Cache-Control', 'public, max-age=3600').set('X-Content-Type-Options', 'nosniff').send(foto.contenido);
    } catch { reply.status(503).json(response('SERVICIO_NO_DISPONIBLE', 'Servicio no disponible.')); }
    return;
  }
  if (request.method !== 'POST') { reply.status(405).json(response('VALIDACION', 'Método no permitido.')); return; }
    if (request.path === '/restaurants/register') { reply.json(await registerRestaurant(request.body)); return; }
  if (request.path === '/register') { reply.json(await registerStudent(request.body)); return; }
  if (request.path === '/recovery/request') { reply.json(await requestRecovery(request.body)); return; }
  if (request.path === '/recovery/complete') { reply.json(await completeRecovery(request.body)); return; }
  if ([
    '/identity', '/profile',
    '/users/create', '/users/list', '/users/update', '/users/state', '/users/delete',
    '/restaurants/list',     '/restaurants/admin-list', '/restaurants/admin-update', '/restaurants/review', '/restaurants/state',
    '/restaurants/mine', '/restaurants/mine-save', '/restaurants/resubmit', '/restaurants/schedule', '/restaurants/closure','/menu/list', '/menu/product',
    '/products/list', '/products/save', '/products/remove', '/products/photo',
    '/orders/list', '/orders/get', '/orders/change',
    '/cart/get', '/cart/save',
    '/notifications/list', '/devices/register', '/devices/unregister',
  ].includes(request.path)) {
    try {
      const result = request.path === '/restaurants/list' ? await listRestaurants(request.headers.authorization)
              : request.path === '/restaurants/admin-list' ? await listRestaurantsAdmin(request.headers.authorization)
        : request.path === '/restaurants/admin-update' ? await updateRestaurantAdmin(request.headers.authorization, request.body)
        : request.path === '/restaurants/review' ? await reviewRestaurant(request.headers.authorization, request.body)
        : request.path === '/restaurants/state' ? await changeRestaurantState(request.headers.authorization, request.body)
        : request.path === '/restaurants/mine' ? await readOwnRestaurant(request.headers.authorization)
        : request.path === '/restaurants/mine-save' ? await saveOwnInfo(request.headers.authorization, request.body)
        : request.path === '/restaurants/resubmit' ? await resubmitRestaurant(request.headers.authorization, request.body)
        : request.path === '/restaurants/schedule' ? await saveSchedule(request.headers.authorization, request.body)
        : request.path === '/restaurants/closure' ? await saveClosure(request.headers.authorization, request.body)
        : request.path === '/menu/list' ? await readMenu(request.headers.authorization, request.body)
        : request.path === '/menu/product' ? await readProduct(request.headers.authorization, request.body)
        : request.path === '/products/list' ? await listOwnProducts(request.headers.authorization)
        : request.path === '/products/save' ? await saveProduct(request.headers.authorization, request.body, { baseUrl: publicBaseUrl(request) })
        : request.path === '/products/photo' ? await uploadPhoto(request.headers.authorization, request.body, { baseUrl: publicBaseUrl(request) })
        : request.path === '/products/remove' ? await removeProduct(request.headers.authorization, request.body)
        : request.path === '/orders/list' ? await listOrders(request.headers.authorization, request.body)
        : request.path === '/orders/get' ? await getOrder(request.headers.authorization, request.body)
        : request.path === '/orders/change' ? await changeOrder(request.headers.authorization, request.body)
        : request.path === '/cart/get' ? await readCart(request.headers.authorization)
        : request.path === '/cart/save' ? await saveCart(request.headers.authorization, request.body)
        : request.path === '/checkout/place' ? await placeOrder(request.headers.authorization, request.body)
        : request.path === '/notifications/list' ? await listNotices(request.headers.authorization)
        : request.path === '/devices/register' ? await registerDevice(request.headers.authorization, request.body)
        : request.path === '/devices/unregister' ? await unregisterDevice(request.headers.authorization, request.body)
        : request.path === '/users/list' ? await listUsers(request.headers.authorization)
        : request.path === '/users/state' ? await changeUserState(request.headers.authorization, request.body)
        : request.path === '/users/delete' ? await deleteAccount(request.headers.authorization, request.body)
        : request.path === '/users/update' ? await updateUserContact(request.headers.authorization, request.body)
        : request.path === '/users/create' ? await createAdministrativeAccount(request.headers.authorization, request.body)
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