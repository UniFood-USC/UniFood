import { adminServices } from './firebase';
import { checkedIdentity } from './identity';
import { listarRestaurantesPublicos } from '../../src/domain/restaurants';
import { response } from '../../src/domain/response';
import type { RestauranteDoc } from '../../src/types/Estado_Restaurante';

// RF-04 · Listado de restaurantes del campus para el estudiante.
// Las reglas de Firestore bloquean el acceso directo del cliente, así que la lectura
// pasa por aquí y solo sale la vista pública (id, nombre, logo, disponible, próxima apertura).
export async function listRestaurants(authorization: string | undefined) {
  const actor = await checkedIdentity(authorization, {});
  if (actor.role !== 'student') return response('NO_AUTORIZADO', 'Solo los estudiantes consultan el listado de restaurantes.');
  const snapshot = await adminServices().db.collection('restaurantes').where('estado', '==', 'aprobado').get();
  const restaurants = listarRestaurantesPublicos(
    snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() as Partial<RestauranteDoc> })),
    new Date(),
  );
  return response('OK', restaurants.length ? 'Restaurantes consultados.' : 'No hay restaurantes disponibles por ahora.', { restaurants });
}
