import type { DocumentData } from 'firebase-admin/firestore';
import { adminServices } from './firebase';
import { checkedIdentity } from './identity';
import { response } from '../../src/domain/response';
import type { MenuProduct } from '../../src/domain/cart';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function publicProduct(id: string, data: DocumentData): MenuProduct | null {
  const nombre = data.nombre;
  const precioCOP = data.precioCOP;
  if (typeof nombre !== 'string' || !nombre.trim() || !Number.isInteger(precioCOP) || precioCOP < 1) return null;
  if (typeof data.disponible !== 'boolean') return null;
  const result: MenuProduct = { id, nombre: nombre.trim(), precioCOP, disponible: data.disponible };
  if (isRecord(data.promocion)) {
    const porcentaje = data.promocion.porcentaje;
    const precioFinalCOP = data.promocion.precioFinalCOP;
    if (typeof porcentaje !== 'number' || typeof precioFinalCOP !== 'number') return result;
    if (Number.isInteger(porcentaje) && porcentaje >= 5 && porcentaje <= 90 &&
      Number.isInteger(precioFinalCOP) && precioFinalCOP >= 1) {
      result.promocion = { porcentaje: porcentaje as number, precioFinalCOP: precioFinalCOP as number };
    }
  }
  return result;
}

export async function listMenu(authorization: string | undefined, input: unknown) {
  const actor = await checkedIdentity(authorization, {});
  if (actor.role !== 'student') return response('NO_AUTORIZADO', 'Solo los estudiantes consultan menús.');
  if (!isRecord(input) || Object.keys(input).some(key => key !== 'restaurantId') ||
    typeof input.restaurantId !== 'string' || !input.restaurantId) {
    return response('VALIDACION', 'Indica el restaurante del menú.');
  }
  const { db } = adminServices();
  const restaurant = await db.doc(`restaurantes/${input.restaurantId}`).get();
  if (!restaurant.exists || restaurant.data()?.estado !== 'aprobado' || restaurant.data()?.activo !== true) {
    return response('RESTAURANTE_CERRADO', 'El restaurante no está disponible.');
  }
  const snapshot = await db.collection(`menus/${input.restaurantId}/products`).get();
  const products = snapshot.docs
    .map(doc => publicProduct(doc.id, doc.data()))
    .filter((product): product is MenuProduct => product !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return response('OK', products.length ? 'Menú consultado.' : 'Este restaurante aún no tiene productos.', { products });
}
