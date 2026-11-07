import type { Firestore } from 'firebase-admin/firestore';
import { adminServices } from './firebase';
import { checkedIdentity } from './identity';
import { aProductoDetalle, listarMenu, MENU_VACIO, PRODUCTO_NO_DISPONIBLE, RESTAURANTE_NO_DISPONIBLE, validarConsultaMenu, validarConsultaProducto } from '../../src/domain/menu';
import { aRestaurantePublico } from '../../src/domain/restaurants';
import { response } from '../../src/domain/response';
import type { RestauranteDoc } from '../../src/types/Estado_Restaurante';
import type { ProductoDoc } from '../../src/types/Menu';

// RF-06 · Consulta del menú de un restaurante para el estudiante.
// Las reglas de Firestore bloquean el acceso directo del cliente, así que la lectura pasa por aquí.
// Los productos viven en restaurantes/{restaurantId}/productos: la consulta solo toca esa
// subcolección, por lo que nunca devuelve productos de otro establecimiento.
type Dependencies = { db?: Firestore; now?: () => Date };

async function studentOnly(authorization: string | undefined) {
  const actor = await checkedIdentity(authorization, {});
  return actor.role === 'student';
}

// Solo restaurantes aprobados y activos (los mismos que lista RF-04). Uno cerrado por horario
// sí se puede consultar: el estudiante compara su menú aunque todavía no pueda pedir.
async function publicRestaurant(db: Firestore, restaurantId: string, ahora: Date) {
  const snapshot = await db.doc(`restaurantes/${restaurantId}`).get();
  return snapshot.exists ? aRestaurantePublico({ id: snapshot.id, data: snapshot.data() as Partial<RestauranteDoc> }, ahora) : null;
}

export async function readMenu(authorization: string | undefined, input: unknown, { db = adminServices().db, now = () => new Date() }: Dependencies = {}) {
  if (!await studentOnly(authorization)) return response('NO_AUTORIZADO', 'Solo los estudiantes consultan el menú.');
  let query;
  try { query = validarConsultaMenu(input); }
  catch (error) { return response('VALIDACION', (error as Error).message); }
  const ahora = now();
  const restaurante = await publicRestaurant(db, query.restaurantId, ahora);
  if (!restaurante) return response('VALIDACION', RESTAURANTE_NO_DISPONIBLE);
  const snapshot = await db.collection(`restaurantes/${query.restaurantId}/productos`).get();
  const productos = listarMenu(snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() as Partial<ProductoDoc> })), ahora);
  return response('OK', productos.length ? 'Menú consultado.' : MENU_VACIO, { restaurante, productos });
}

export async function readProduct(authorization: string | undefined, input: unknown, { db = adminServices().db, now = () => new Date() }: Dependencies = {}) {
  if (!await studentOnly(authorization)) return response('NO_AUTORIZADO', 'Solo los estudiantes consultan el menú.');
  let query;
  try { query = validarConsultaProducto(input); }
  catch (error) { return response('VALIDACION', (error as Error).message); }
  const ahora = now();
  const restaurante = await publicRestaurant(db, query.restaurantId, ahora);
  if (!restaurante) return response('VALIDACION', RESTAURANTE_NO_DISPONIBLE);
  const snapshot = await db.doc(`restaurantes/${query.restaurantId}/productos/${query.productId}`).get();
  const producto = snapshot.exists ? aProductoDetalle({ id: snapshot.id, data: snapshot.data() as Partial<ProductoDoc> }, ahora) : null;
  if (!producto) return response('VALIDACION', PRODUCTO_NO_DISPONIBLE);
  return response('OK', 'Producto consultado.', { restaurante, producto });
}
