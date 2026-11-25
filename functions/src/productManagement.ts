import type { DocumentReference, DocumentSnapshot, Firestore, Transaction } from 'firebase-admin/firestore';
import { adminServices } from './firebase';
import { checkedIdentity } from './identity';
import {
  aProductoPropio, errorContenidoFoto, esIdSeguro, FOTO_MAX_BYTES, FORMATOS_FOTO, listarProductosPropios, MENSAJE_AGOTADO,
  PRODUCTO_AJENO, referenciaFoto, revisarLineas, validarGuardado, validarRetiro, validarSubidaFoto, type ProductoPropio,
} from '../../src/domain/productManagement';
import { puedePrepararInformacion } from '../../src/domain/restaurantManagement';
import { response } from '../../src/domain/response';
import type { RestauranteDoc } from '../../src/types/Estado_Restaurante';
import type { ProductoDoc } from '../../src/types/Menu';

// RF-16 · Gestión de productos del menú por el restaurante.
// - El restaurante sale SIEMPRE de la sesión comprobada (perfil.restaurantId), nunca de lo que envía la app.
// - Solo se toca restaurantes/{restaurantId}/productos: un producto de otro establecimiento no se alcanza.
// - Eliminar = retirar del menú (activo:false). El documento se conserva para no romper referencias históricas.
// - Las fotos se suben por aquí (products/photo): se comprueban sobre los bytes reales y quedan ligadas al
//   restaurante que las subió; otro restaurante no puede adjuntarlas ni sustituirlas.
type Dependencies = { db?: Firestore; now?: () => Date; baseUrl?: string };

async function ownRestaurant(authorization: string | undefined, db: Firestore, requested: string | null) {
  const actor = await checkedIdentity(authorization, {});
  if (actor.role !== 'restaurant' || !actor.restaurantId) return { error: response('NO_AUTORIZADO', 'Solo un restaurante gestiona sus productos.') };
  // Pedir explícitamente otro restaurante es un intento de modificar el menú ajeno.
  if (requested !== null && requested !== actor.restaurantId) return { error: response('NO_AUTORIZADO', PRODUCTO_AJENO) };
  const restaurante = (await db.doc(`restaurantes/${actor.restaurantId}`).get()).data() as Partial<RestauranteDoc> | undefined;
  // RF-22 · Pendiente o rechazado también preparan su menú (no aparece ante estudiantes hasta ser aprobado); suspendido y eliminado no.
  if (!restaurante || !puedePrepararInformacion(restaurante.estado)) return { error: response('NO_AUTORIZADO', 'Tu restaurante no puede gestionar productos en este momento.') };
  return { restaurantId: actor.restaurantId, actorId: actor.id };
}

export async function listOwnProducts(authorization: string | undefined, { db = adminServices().db }: Dependencies = {}) {
  const own = await ownRestaurant(authorization, db, null);
  if ('error' in own) return own.error;
  const snapshot = await db.collection(`restaurantes/${own.restaurantId}/productos`).get();
  const productos = listarProductosPropios(snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })));
  return response('OK', productos.length ? 'Productos consultados.' : 'Todavía no tienes productos en tu menú.', { productos });
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------
// Firestore limita cada documento a 1 MiB: una foto de hasta 5 MB se guarda en partes.
//   restaurantes/{rid}/fotosProducto/{photoId}              { formato, bytes, partes, subidaPor, creadaEn }
//   restaurantes/{rid}/fotosProducto/{photoId}/partes/{n}   { indice, contenido }
const PARTE_BYTES = 700_000;
const fotoUrl = (baseUrl: string, restaurantId: string, photoId: string) => `${baseUrl}/photos/${restaurantId}/${photoId}`;

export async function uploadPhoto(authorization: string | undefined, input: unknown, { db = adminServices().db, now = () => new Date(), baseUrl = '' }: Dependencies = {}) {
  const own = await ownRestaurant(authorization, db, null);
  if ('error' in own) return own.error;
  let subida;
  try { subida = validarSubidaFoto(input); }
  catch (error) { return response('VALIDACION', (error as Error).message); }
  const contenido = Buffer.from(subida.datos, 'base64');
  const problema = errorContenidoFoto(subida.formato, contenido);
  if (problema) return response('VALIDACION', problema);

  const ref = db.collection(`restaurantes/${own.restaurantId}/fotosProducto`).doc();
  const partes = Math.ceil(contenido.length / PARTE_BYTES);
  const batch = db.batch();
  batch.create(ref, { formato: subida.formato, bytes: contenido.length, partes, subidaPor: own.actorId, creadaEn: now().toISOString() });
  for (let indice = 0; indice < partes; indice++) {
    batch.create(ref.collection('partes').doc(String(indice).padStart(3, '0')), { indice, contenido: contenido.subarray(indice * PARTE_BYTES, (indice + 1) * PARTE_BYTES) });
  }
  await batch.commit();
  return response('OK', 'Foto subida.', { url: fotoUrl(baseUrl, own.restaurantId, ref.id), formato: subida.formato, bytes: contenido.length });
}

// Lectura pública de una foto (la etiqueta <img> no puede enviar sesión). Solo sirve lo que subió
// uploadPhoto; el id es aleatorio y no se puede adivinar ni listar.
export async function readPhoto(path: string, { db = adminServices().db }: Dependencies = {}) {
  const ref = referenciaFoto(`http://x${path}`);
  if (!ref) return null;
  const meta = db.doc(`restaurantes/${ref.restaurantId}/fotosProducto/${ref.photoId}`);
  const datos = (await meta.get()).data() as { formato?: string; partes?: number } | undefined;
  if (!datos || !(FORMATOS_FOTO as readonly string[]).includes(datos.formato ?? '')) return null;
  const partes = await meta.collection('partes').orderBy('indice').get();
  if (partes.size !== datos.partes) return null;
  return { formato: datos.formato as string, contenido: Buffer.concat(partes.docs.map(parte => Buffer.from(parte.data().contenido as Uint8Array))) };
}

// Una foto es adjuntable si ya estaba en el producto (se conserva tal cual) o si la subió ESTE restaurante.
// Las nuevas se guardan con la dirección canónica del servicio, no con la que envíe la app.
async function resolverFotos(
  restaurantId: string, urls: string[], existentes: string[], baseUrl: string,
  leer: (ref: DocumentReference) => Promise<DocumentSnapshot>, db: Firestore,
): Promise<{ fotos: string[] } | { error: string }> {
  const fotos: string[] = [];
  for (const url of urls) {
    if (existentes.includes(url)) { fotos.push(url); continue; }
    const referencia = referenciaFoto(url);
    if (!referencia || referencia.restaurantId !== restaurantId) return { error: 'Solo puedes usar fotos subidas por tu restaurante.' };
    const meta = (await leer(db.doc(`restaurantes/${restaurantId}/fotosProducto/${referencia.photoId}`))).data() as { formato?: string; bytes?: number } | undefined;
    if (!meta || !(FORMATOS_FOTO as readonly string[]).includes(meta.formato ?? '') || typeof meta.bytes !== 'number' || meta.bytes > FOTO_MAX_BYTES) {
      return { error: 'Una de las fotos no existe o no es válida. Quítala y vuelve a adjuntarla.' };
    }
    fotos.push(fotoUrl(baseUrl, restaurantId, referencia.photoId));
  }
  return { fotos };
}

// ---------------------------------------------------------------------------
// Crear, editar, retirar
// ---------------------------------------------------------------------------
// Crea (sin id) o edita (con id + versión vista). La versión evita pisar un cambio hecho desde otro dispositivo.
export async function saveProduct(authorization: string | undefined, input: unknown, { db = adminServices().db, now = () => new Date(), baseUrl = '' }: Dependencies = {}) {
  const parsed = validarGuardado(input);
  // Primero la sesión: así un cuerpo inválido no revela nada a quien no tiene permiso.
  const own = await ownRestaurant(authorization, db, parsed.ok ? parsed.restaurantId : null);
  if ('error' in own) return own.error;
  if (!parsed.ok) return response('VALIDACION', 'Revisa los campos del producto.', { errores: parsed.errores });

  const { producto } = parsed;
  const ahora = now().toISOString();
  const productos = db.collection(`restaurantes/${own.restaurantId}/productos`);
  const rechazoFoto = (error: string) => response('VALIDACION', 'Revisa los campos del producto.', { errores: { fotos: error } });

  if (parsed.id === null) {
    const fotos = await resolverFotos(own.restaurantId, producto.fotos, [], baseUrl, ref => ref.get(), db);
    if ('error' in fotos) return rechazoFoto(fotos.error);
    const publicos = { nombre: producto.nombre, descripcion: producto.descripcion, precioCOP: producto.precioCOP, disponible: producto.disponible, fotos: fotos.fotos };
    const ref = productos.doc();
    await ref.create({ ...publicos, activo: true, version: 1, creadoEn: ahora, actualizadoEn: ahora, actualizadoPor: own.actorId });
    return response('OK', 'Producto creado.', { producto: aProductoPropio({ id: ref.id, data: { ...publicos, activo: true, version: 1 } }) as ProductoPropio });
  }

  const ref = productos.doc(parsed.id);
  return db.runTransaction(async tx => {
    const actual = (await tx.get(ref)).data() as (Partial<ProductoDoc> & { version?: number }) | undefined;
    // Un id que no está en MI menú (de otro restaurante, inexistente o retirado) se trata igual: no se toca nada.
    if (!actual || actual.activo === false) return response('NO_AUTORIZADO', PRODUCTO_AJENO);
    const version = typeof actual.version === 'number' ? actual.version : 1;
    if (version !== parsed.version) {
      return response('CONFLICTO_VERSION', 'Este producto cambió en otro dispositivo. Revisa los datos actuales.', { producto: aProductoPropio({ id: ref.id, data: actual as Record<string, unknown> }) });
    }
    const fotos = await resolverFotos(own.restaurantId, producto.fotos, Array.isArray(actual.fotos) ? actual.fotos : [], baseUrl, snapshotRef => tx.get(snapshotRef), db);
    if ('error' in fotos) return rechazoFoto(fotos.error);
    const publicos = { nombre: producto.nombre, descripcion: producto.descripcion, precioCOP: producto.precioCOP, disponible: producto.disponible, fotos: fotos.fotos };
    // update() conserva los campos privados (costo, notas internas) y la promoción vigente.
    tx.update(ref, { ...publicos, version: version + 1, actualizadoEn: ahora, actualizadoPor: own.actorId });
    return response('OK', 'Producto actualizado.', { producto: aProductoPropio({ id: ref.id, data: { ...actual, ...publicos, version: version + 1 } as Record<string, unknown> }) });
  });
}

// Eliminar un producto propio: deja de ofrecerse, pero el documento queda para el historial.
export async function removeProduct(authorization: string | undefined, input: unknown, { db = adminServices().db, now = () => new Date() }: Dependencies = {}) {
  let datos;
  try { datos = validarRetiro(input); }
  catch (error) {
    const own = await ownRestaurant(authorization, db, null);
    return 'error' in own ? own.error : response('VALIDACION', (error as Error).message);
  }
  const own = await ownRestaurant(authorization, db, datos.restaurantId);
  if ('error' in own) return own.error;
  const ref = db.doc(`restaurantes/${own.restaurantId}/productos/${datos.id}`);
  return db.runTransaction(async tx => {
    const actual = (await tx.get(ref)).data() as (Partial<ProductoDoc> & { version?: number }) | undefined;
    if (!actual) return response('NO_AUTORIZADO', PRODUCTO_AJENO);
    if (actual.activo === false) return response('OK', 'El producto ya estaba retirado del menú.', { id: ref.id });
    const version = typeof actual.version === 'number' ? actual.version : 1;
    if (version !== datos.version) return response('CONFLICTO_VERSION', 'Este producto cambió en otro dispositivo. Revísalo antes de retirarlo.', { producto: aProductoPropio({ id: ref.id, data: actual as Record<string, unknown> }) });
    const ahora = now().toISOString();
    tx.update(ref, { activo: false, disponible: false, version: version + 1, retiradoEn: ahora, actualizadoEn: ahora, actualizadoPor: own.actorId });
    return response('OK', 'Producto retirado del menú.', { id: ref.id });
  });
}

// Criterios 7 y 10 · Para el flujo de pedidos (RF-07/RF-09): comprueba que cada producto del
// carrito siga en el menú del restaurante y esté disponible, y devuelve la copia inmutable de las
// líneas (nombre, precio, descuento) que debe guardarse en el pedido confirmado.
// Pasa `tx` para llamarla dentro de la misma transacción que crea el pedido: así un producto que se
// agota justo antes de confirmar no se vende.
export async function prepareOrderLines(
  restaurantId: string,
  lineas: readonly { productId: string; quantity: number }[],
  { db = adminServices().db, now = () => new Date(), tx }: Dependencies & { tx?: Transaction } = {},
) {
  if (!esIdSeguro(restaurantId) || !lineas.length || lineas.some(({ productId }) => !esIdSeguro(productId))) {
    return response('VALIDACION', 'Revisa los productos del pedido.');
  }
  const refs = lineas.map(({ productId }) => db.doc(`restaurantes/${restaurantId}/productos/${productId}`));
  const snapshots = await (tx ? tx.getAll(...refs) : db.getAll(...refs));
  const docs = snapshots.filter(snapshot => snapshot.exists).map(snapshot => ({ id: snapshot.id, data: snapshot.data() as Partial<ProductoDoc> }));
  const revision = revisarLineas(lineas, docs, now());
  if (!revision.ok) return response('VALIDACION', MENSAJE_AGOTADO, { noComprables: revision.noComprables });
  return response('OK', 'Productos comprobados.', { lineas: revision.lineas });
}
