import type { Firestore } from 'firebase-admin/firestore';
import { adminServices } from './firebase';
import { checkedIdentity, emailKey } from './identity';
import * as ordersModule from './orders';
import { toOrder } from './orders';
import { attemptId, refundInTransaction } from './payments';
import { applyChange } from '../../src/services/orders/changeOrder';
import { response } from '../../src/domain/response';
import { esIdSeguro } from '../../src/domain/productManagement';
import {
  ACCIONES_ADMIN, aRestauranteGestion, estadoTras, idRestauranteDeCuenta, MENSAJE_TRANSICION, ordenarGestion, puedePrepararInformacion,
  SOLO_ADMIN, SOLO_PROPIETARIO, validarCierresEspeciales, validarCierreTemporal, validarHorario, validarInformacion, validarRechazo, validarRegistroRestaurante,
  type AccionAdmin, type ErroresRestaurante, type RestauranteGestion,
} from '../../src/domain/restaurantManagement';
import type { RestauranteDoc } from '../../src/types/Estado_Restaurante';

// RF-22 · Gestión de restaurantes.
// - Un restaurante se registra solo (autoalta) y queda PENDIENTE: puede completar su información y preparar su menú,
//   pero no aparece ante estudiantes ni recibe pedidos hasta que la administración lo apruebe.
// - La administración consulta, edita, aprueba, rechaza (con motivo), suspende, reactiva y elimina (lógicamente).
// - El propietario (una cuenta ↔ un establecimiento) edita su información, horario, cierres y cierre temporal.
// - Suspender o eliminar bloquea pedidos nuevos, cancela los activos y reembolsa los pagados (RF-18); eliminar conserva
//   el historial (la eliminación es lógica: estado «eliminado»).
// El restaurante y el rol salen SIEMPRE de la sesión comprobada, nunca de lo que envía la app.
type Dependencies = { db?: Firestore; now?: () => Date };

const primerError = (errores: ErroresRestaurante) => Object.values(errores)[0] ?? 'Revisa los datos del restaurante.';
const ESTADOS_ACTIVOS = ['received', 'preparing', 'ready', 'on_the_way'];

// ---------------------------------------------------------------------------
// Registro (autoalta pendiente)
// ---------------------------------------------------------------------------
// Auth y Firestore no comparten transacción: la identidad queda deshabilitada hasta guardar perfil y establecimiento,
// y si algo falla se compensa. El establecimiento se identifica con la cuenta (rest-{uid}): una cuenta, un establecimiento.
export async function registerRestaurant(input: unknown, { now = () => new Date() }: Dependencies = {}) {
  const parsed = validarRegistroRestaurante(input);
  if (!parsed.ok) return response('VALIDACION', primerError(parsed.errores), { errores: parsed.errores });
  const { datos } = parsed;
  const { auth, db } = adminServices();
  let uid: string | undefined;
  try {
    const identity = await auth.createUser({ email: datos.correo, password: datos.password, displayName: datos.nombre, disabled: true, emailVerified: false });
    uid = identity.uid;
    const restaurantId = idRestauranteDeCuenta(uid);
    const stamp = now().toISOString();
    await db.runTransaction(async tx => {
      const reservation = db.doc(`emailReservations/${emailKey(datos.correo)}`);
      if ((await tx.get(reservation)).exists) throw Object.assign(new Error('Correo ocupado'), { code: 'auth/email-already-exists' });
      tx.create(reservation, { userId: uid });
      tx.create(db.doc(`users/${uid}`), {
        id: uid, name: datos.nombre, email: datos.correo, role: 'restaurant', state: 'active', sessionVersion: 1, createdAt: stamp,
        restaurantId, version: 1, provisioning: true,
      });
      tx.create(db.doc(`restaurantes/${restaurantId}`), {
        nombre: datos.nombre, descripcion: datos.descripcion, ubicacion: datos.ubicacion, telefono: datos.telefono, correo: datos.correo,
        logo: datos.logo ?? null, horario: datos.horario, cierresEspeciales: [], cierreTemporal: null,
        estado: 'pendiente', activo: true, motivoRechazo: null, ownerId: uid, version: 1, creadoEn: stamp, actualizadoEn: stamp,
      });
    });
    await auth.updateUser(uid, { disabled: false });
    await db.doc(`users/${uid}`).update({ provisioning: false });
    return response('OK', 'Restaurante registrado. Queda pendiente de aprobación: mientras tanto puedes iniciar sesión, completar tu información y preparar tu menú.', { restaurantId, estado: 'pendiente' });
  } catch (error) {
    if (uid) {
      try {
        await auth.updateUser(uid, { disabled: true });
        // El commit pudo completarse aunque se perdiera su respuesta: se consulta quién tiene realmente la reserva.
        await db.runTransaction(async tx => {
          const reservation = db.doc(`emailReservations/${emailKey(datos.correo)}`);
          const owner = (await tx.get(reservation)).data()?.userId;
          if (owner === uid) tx.delete(reservation);
          tx.delete(db.doc(`users/${uid}`));
          tx.delete(db.doc(`restaurantes/${idRestauranteDeCuenta(uid!)}`));
        });
        await auth.deleteUser(uid);
      } catch {
        return response('EN_PROCESO', 'No pudimos confirmar el registro. La cuenta requiere revisión antes de reintentar.', null, false);
      }
    }
    if ((error as { code?: string }).code === 'auth/email-already-exists') return response('CORREO_EN_USO', 'Este correo ya está registrado.');
    return response('SERVICIO_NO_DISPONIBLE', 'No pudimos registrar el restaurante. Inténtalo de nuevo.', null, true);
  }
}

// ---------------------------------------------------------------------------
// Utilidades comunes
// ---------------------------------------------------------------------------
type Respuesta = ReturnType<typeof response>;
type Cambios = Record<string, unknown>;

// Lee el restaurante, comprueba reglas y versión y guarda los cambios en una sola transacción.
// La versión evita pisar un cambio hecho desde otro dispositivo o por la administración.
async function modificar(
  db: Firestore, restaurantId: string, version: number, ahora: Date,
  { permitido, cambios, mensaje }: { permitido: (data: Partial<RestauranteDoc>) => Respuesta | null; cambios: (data: Partial<RestauranteDoc>) => Cambios; mensaje: string },
) {
  const ref = db.doc(`restaurantes/${restaurantId}`);
  return db.runTransaction(async tx => {
    const data = (await tx.get(ref)).data() as Partial<RestauranteDoc> | undefined;
    if (!data) return response('VALIDACION', 'El restaurante no está disponible.');
    const rechazo = permitido(data);
    if (rechazo) return rechazo;
    const actual = typeof data.version === 'number' ? data.version : 1;
    if (actual !== version) {
      return response('CONFLICTO_VERSION', 'El restaurante cambió mientras lo revisabas. Revisa los datos actuales.', { restaurante: aRestauranteGestion(restaurantId, data, ahora) });
    }
    const nuevos = { ...cambios(data), version: actual + 1, actualizadoEn: ahora.toISOString() };
    tx.update(ref, nuevos);
    return response('OK', mensaje, { restaurante: aRestauranteGestion(restaurantId, { ...data, ...nuevos } as Partial<RestauranteDoc>, ahora) });
  });
}

const versionValida = (valor: unknown): valor is number => Number.isInteger(valor) && Number(valor) >= 1;
const claves = (entrada: unknown) => (entrada && typeof entrada === 'object' && !Array.isArray(entrada) ? Object.keys(entrada) : []);
const sinClaves = (entrada: Record<string, unknown>, ...quitar: string[]) => Object.fromEntries(Object.entries(entrada).filter(([clave]) => !quitar.includes(clave)));

// ---------------------------------------------------------------------------
// Administración
// ---------------------------------------------------------------------------
async function adminActual(authorization: string | undefined) {
  const actor = await checkedIdentity(authorization, {});
  return actor.role === 'admin' ? actor : null;
}

export async function listRestaurantsAdmin(authorization: string | undefined, { db = adminServices().db, now = () => new Date() }: Dependencies = {}) {
  if (!await adminActual(authorization)) return response('NO_AUTORIZADO', SOLO_ADMIN);
  const ahora = now();
  const snapshot = await db.collection('restaurantes').get();
  const restaurantes = ordenarGestion(snapshot.docs.map(doc => aRestauranteGestion(doc.id, doc.data() as Partial<RestauranteDoc>, ahora)).filter((r): r is RestauranteGestion => r !== null));
  return response('OK', restaurantes.length ? 'Restaurantes consultados.' : 'Todavía no hay restaurantes registrados.', { restaurantes });
}

// La administración mantiene al día la información del restaurante (nombre, descripción, ubicación, teléfono, logo).
// El horario y los cierres los modifica solo el propietario.
export async function updateRestaurantAdmin(authorization: string | undefined, input: unknown, { db = adminServices().db, now = () => new Date() }: Dependencies = {}) {
  const actor = await adminActual(authorization);
  if (!actor) return response('NO_AUTORIZADO', SOLO_ADMIN);
  const datos = (input ?? {}) as Record<string, unknown>;
  if (!esIdSeguro(datos.id) || !versionValida(datos.version)) return response('VALIDACION', 'Indica el restaurante y la versión que estás revisando.');
  const info = validarInformacion(sinClaves(datos, 'id', 'version'));
  if (!info.ok) return response('VALIDACION', primerError(info.errores), { errores: info.errores });
  return modificar(db, datos.id, datos.version, now(), {
    permitido: data => data.estado === 'eliminado' ? response('TRANSICION_INVALIDA', MENSAJE_TRANSICION.eliminado) : null,
    cambios: () => ({ ...info.info, logo: info.info.logo ?? null, actualizadoPor: actor.id }),
    mensaje: 'Cambios guardados.',
  });
}

// Aprobar o rechazar un restaurante pendiente. Rechazar exige un motivo, que el propietario verá para corregir.
export async function reviewRestaurant(authorization: string | undefined, input: unknown, { db = adminServices().db, now = () => new Date() }: Dependencies = {}) {
  const actor = await adminActual(authorization);
  if (!actor) return response('NO_AUTORIZADO', SOLO_ADMIN);
  const datos = (input ?? {}) as Record<string, unknown>;
  if (claves(input).some(clave => !['id', 'version', 'decision', 'motivo'].includes(clave)) || !esIdSeguro(datos.id) || !versionValida(datos.version) || !['aprobar', 'rechazar'].includes(String(datos.decision))) {
    return response('VALIDACION', 'Indica el restaurante, la versión y si se aprueba o se rechaza.');
  }
  const decision = datos.decision as 'aprobar' | 'rechazar';
  let motivo: string | null = null;
  if (decision === 'rechazar') {
    const rechazo = validarRechazo(datos.motivo);
    if (!rechazo.ok) return response('VALIDACION', rechazo.error);
    motivo = rechazo.motivo;
  }
  const ahora = now();
  return modificar(db, datos.id, datos.version, ahora, {
    permitido: data => data.estado === 'pendiente' ? null : response('TRANSICION_INVALIDA', `Solo se revisa un restaurante pendiente. ${MENSAJE_TRANSICION[(data.estado ?? 'pendiente') as keyof typeof MENSAJE_TRANSICION]}`),
    cambios: () => ({ estado: estadoTras(decision), motivoRechazo: motivo, revisadoPor: actor.id, revisadoEn: ahora.toISOString() }),
    mensaje: decision === 'aprobar' ? 'Restaurante aprobado. Ya puede publicarse y recibir pedidos en su horario.' : 'Restaurante rechazado. Su propietario verá el motivo y podrá corregirlo.',
  });
}

// Cancela los pedidos activos de un restaurante y reembolsa los pagados, con las mismas reglas del cambio de pedido
// de la administración (RF-18): el motivo es obligatorio y el reembolso es por el total pagado, una sola vez.
// Cada pedido va en su transacción: si se interrumpe, repetir la acción completa los que faltan.
export async function cancelActiveOrders(restaurantId: string, reason: string, actorId: string, { db = adminServices().db, now = () => new Date() }: Dependencies = {}) {
  const snapshot = await db.collection('orders').where('restaurantId', '==', restaurantId).get();
  let cancelados = 0, reembolsados = 0, fallidos = 0;
  for (const doc of snapshot.docs) {
    if (!ESTADOS_ACTIVOS.includes(String(doc.data().status))) continue;
    const resultado = await db.runTransaction(async tx => {
      const actual = await tx.get(doc.ref);
      const data = actual.data();
      if (!data || !ESTADOS_ACTIVOS.includes(String(data.status))) return 'omitido' as const;
      const pedido = toOrder(actual.id, data);
      const cambio = applyChange(pedido, { type: 'cancel', reason }, { id: actorId, role: 'admin' }, pedido.version, now());
      if (!cambio.ok) return 'fallido' as const;
      // Todas las lecturas van antes de la primera escritura.
      const intento = typeof data.attemptKey === 'string' ? (await tx.get(db.doc(`purchaseAttempts/${attemptId(pedido.studentId, data.attemptKey)}`))).data() : undefined;
      if (pedido.paid && typeof intento?.paymentId === 'string') {
        const reembolso = await refundInTransaction(tx, db, intento.paymentId, { orderId: pedido.id, reason });
        if (reembolso.codigo !== 'OK') return 'fallido' as const;
      }
      const { id: _id, ...guardado } = cambio.order;
      // merge conserva los datos de la compra (líneas, clave del intento, nombre del restaurante) que Order no describe.
      tx.set(doc.ref, guardado, { merge: true });
      return cambio.order;
    });
    if (resultado === 'omitido') continue;
    if (resultado === 'fallido') { fallidos++; continue; }
    cancelados++;
    if (resultado.refund) reembolsados++;
        const avisar = (ordersModule as unknown as { noticeStudent?: (order: typeof resultado, change: { type: 'cancel' }) => Promise<void> }).noticeStudent;
    if (avisar) await avisar(resultado, { type: 'cancel' });
  }
  return { cancelados, reembolsados, fallidos };
}

// Suspender, reactivar o eliminar. Suspender y eliminar bloquean los pedidos nuevos de inmediato (el estado se guarda
// primero), cancelan los activos y reembolsan los pagados. Eliminar es lógico: conserva pedidos y movimientos anteriores,
// y retira el acceso de la cuenta propietaria. Repetir la acción completa lo que se haya interrumpido.
export async function changeRestaurantState(authorization: string | undefined, input: unknown, { db = adminServices().db, now = () => new Date() }: Dependencies = {}) {
  const actor = await adminActual(authorization);
  if (!actor) return response('NO_AUTORIZADO', SOLO_ADMIN);
  const datos = (input ?? {}) as Record<string, unknown>;
  if (claves(input).some(clave => !['id', 'version', 'accion', 'motivo'].includes(clave)) || !esIdSeguro(datos.id) || !versionValida(datos.version)
    || !['suspender', 'reactivar', 'eliminar'].includes(String(datos.accion)) || (datos.motivo !== undefined && typeof datos.motivo !== 'string')) {
    return response('VALIDACION', 'Indica el restaurante, la versión y si se suspende, se reactiva o se elimina.');
  }
  const accion = datos.accion as AccionAdmin;
  const motivo = typeof datos.motivo === 'string' ? datos.motivo.trim().slice(0, 500) : '';
  const ahora = now();
  const destino = estadoTras(accion);
  const { auth } = adminServices();
  const ref = db.doc(`restaurantes/${datos.id}`);

  const guardado = await db.runTransaction(async tx => {
    const data = (await tx.get(ref)).data() as Partial<RestauranteDoc> | undefined;
    if (!data) return response('VALIDACION', 'El restaurante no está disponible.');
    const ownerId = typeof data.ownerId === 'string' ? data.ownerId : null;
    const dueno = ownerId && accion === 'eliminar' ? (await tx.get(db.doc(`users/${ownerId}`))).data() : undefined;
    const reserva = dueno?.email ? db.doc(`emailReservations/${emailKey(dueno.email)}`) : null;
    const duenoReserva = reserva ? (await tx.get(reserva)).data()?.userId : undefined;
    // Repetir una acción ya aplicada no falla: solo completa lo pendiente (pedidos y acceso).
    if (data.estado === destino) return response('OK', 'Estado ya aplicado.', { restaurante: aRestauranteGestion(ref.id, data, ahora), repetido: true, ownerId });
    if (!ACCIONES_ADMIN.includes(accion) || !aRestauranteGestion(ref.id, data, ahora)?.acciones.includes(accion)) {
      return response('TRANSICION_INVALIDA', `No se puede ${accion} este restaurante. ${MENSAJE_TRANSICION[(data.estado ?? 'pendiente') as keyof typeof MENSAJE_TRANSICION]}`);
    }
    const actual = typeof data.version === 'number' ? data.version : 1;
    if (actual !== datos.version) return response('CONFLICTO_VERSION', 'El restaurante cambió mientras lo revisabas. Revisa los datos actuales.', { restaurante: aRestauranteGestion(ref.id, data, ahora) });
    const sello = accion === 'suspender' ? { suspendidoEn: ahora.toISOString(), motivoSuspension: motivo || null }
      : accion === 'eliminar' ? { eliminadoEn: ahora.toISOString(), activo: false } : { motivoSuspension: null };
    const nuevos = { estado: destino, version: actual + 1, actualizadoEn: ahora.toISOString(), actualizadoPor: actor.id, ...sello };
    tx.update(ref, nuevos);
    if (accion === 'eliminar' && ownerId && dueno && dueno.state !== 'deleted') {
      if (reserva && duenoReserva === ownerId) tx.delete(reserva);
      tx.update(db.doc(`users/${ownerId}`), { state: 'deleted', deletedAt: ahora.toISOString(), version: Number(dueno.version ?? 1) + 1 });
    }
    return response('OK', 'Estado guardado.', { restaurante: aRestauranteGestion(ref.id, { ...data, ...nuevos } as Partial<RestauranteDoc>, ahora), repetido: false, ownerId });
  });
  if (guardado.codigo !== 'OK' || !guardado.datos) return guardado;
  const { restaurante, ownerId } = guardado.datos as { restaurante: RestauranteGestion; ownerId: string | null };

  let resumen = '';
  if (accion !== 'reactivar') {
    const razon = accion === 'suspender' ? `Restaurante suspendido por la administración.${motivo ? ` ${motivo}` : ''}` : 'Restaurante eliminado de la plataforma.';
    const { cancelados, reembolsados, fallidos } = await cancelActiveOrders(String(datos.id), razon, actor.id, { db, now });
    if (fallidos) return response('EN_PROCESO', `El estado se guardó, pero ${fallidos} pedido(s) activo(s) no se pudieron cancelar. Repite la acción para completarlo.`, { restaurante, cancelados, reembolsados }, true);
    resumen = cancelados ? ` Se cancelaron ${cancelados} pedido(s) activo(s) y se reembolsaron ${reembolsados} pagado(s).` : ' No había pedidos activos.';
  }
  // Eliminar retira el acceso de la cuenta propietaria; repetir la acción completa este paso si se interrumpió.
  if (accion === 'eliminar' && ownerId) {
    try { await auth.deleteUser(ownerId); }
    catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') return response('EN_PROCESO', 'El restaurante se eliminó, pero falta cerrar el acceso de su cuenta. Repite la acción para completarlo.', { restaurante }, true);
    }
  }
  const textos = { suspender: 'Restaurante suspendido. No recibe pedidos nuevos.', reactivar: 'Restaurante reactivado. Vuelve a operar conforme a su horario.', eliminar: 'Restaurante eliminado. Se conservan sus pedidos y movimientos anteriores.' };
  return response('OK', `${textos[accion as 'suspender' | 'reactivar' | 'eliminar']}${resumen}`, { restaurante });
}

// ---------------------------------------------------------------------------
// Propietario
// ---------------------------------------------------------------------------
async function propietario(authorization: string | undefined, db: Firestore) {
  const actor = await checkedIdentity(authorization, {});
  if (actor.role !== 'restaurant' || !actor.restaurantId) return { error: response('NO_AUTORIZADO', SOLO_PROPIETARIO) };
  const data = (await db.doc(`restaurantes/${actor.restaurantId}`).get()).data() as Partial<RestauranteDoc> | undefined;
  // La cuenta solo gestiona el establecimiento del que es propietaria.
  if (!data || (data.ownerId && data.ownerId !== actor.id)) return { error: response('NO_AUTORIZADO', SOLO_PROPIETARIO) };
  return { restaurantId: actor.restaurantId, actorId: actor.id, data };
}
const sinPreparar = (data: Partial<RestauranteDoc>) => puedePrepararInformacion(data.estado) ? null
  : response('NO_AUTORIZADO', `No puedes modificar el restaurante en este momento. ${MENSAJE_TRANSICION[(data.estado ?? 'pendiente') as keyof typeof MENSAJE_TRANSICION]}`);

export async function readOwnRestaurant(authorization: string | undefined, { db = adminServices().db, now = () => new Date() }: Dependencies = {}) {
  const own = await propietario(authorization, db);
  if ('error' in own) return own.error;
  const restaurante = aRestauranteGestion(own.restaurantId, own.data, now());
  return restaurante ? response('OK', 'Restaurante consultado.', { restaurante }) : response('VALIDACION', 'El restaurante no está disponible.');
}

// Información del propietario: se puede completar mientras esté pendiente, rechazado o aprobado.
export async function saveOwnInfo(authorization: string | undefined, input: unknown, { db = adminServices().db, now = () => new Date() }: Dependencies = {}) {
  const own = await propietario(authorization, db);
  if ('error' in own) return own.error;
  const datos = (input ?? {}) as Record<string, unknown>;
  if (!versionValida(datos.version)) return response('VALIDACION', 'Indica la versión que estás editando.');
  const info = validarInformacion(sinClaves(datos, 'version'));
  if (!info.ok) return response('VALIDACION', primerError(info.errores), { errores: info.errores });
  return modificar(db, own.restaurantId, datos.version, now(), {
    permitido: sinPreparar, cambios: () => ({ ...info.info, logo: info.info.logo ?? null, actualizadoPor: own.actorId }), mensaje: 'Información guardada.',
  });
}

// Un restaurante rechazado corrige su información y vuelve a pendiente, sin crear otra cuenta ni otro establecimiento.
export async function resubmitRestaurant(authorization: string | undefined, input: unknown, { db = adminServices().db, now = () => new Date() }: Dependencies = {}) {
  const own = await propietario(authorization, db);
  if ('error' in own) return own.error;
  const datos = (input ?? {}) as Record<string, unknown>;
  if (!versionValida(datos.version)) return response('VALIDACION', 'Indica la versión que estás editando.');
  const info = validarInformacion(sinClaves(datos, 'version'));
  if (!info.ok) return response('VALIDACION', primerError(info.errores), { errores: info.errores });
  const ahora = now();
  return modificar(db, own.restaurantId, datos.version, ahora, {
    permitido: data => data.estado === 'rechazado' ? null : response('TRANSICION_INVALIDA', 'Solo se reenvía un registro rechazado.'),
    cambios: () => ({ ...info.info, logo: info.info.logo ?? null, estado: 'pendiente', motivoRechazo: null, reenviadoEn: ahora.toISOString(), actualizadoPor: own.actorId }),
    mensaje: 'Registro reenviado. Queda pendiente de aprobación.',
  });
}

// Horario por día y cierres especiales: solo los guarda el propietario.
export async function saveSchedule(authorization: string | undefined, input: unknown, { db = adminServices().db, now = () => new Date() }: Dependencies = {}) {
  const own = await propietario(authorization, db);
  if ('error' in own) return own.error;
  const datos = (input ?? {}) as Record<string, unknown>;
  if (claves(input).some(clave => !['version', 'horario', 'cierresEspeciales'].includes(clave)) || !versionValida(datos.version)) return response('VALIDACION', 'Revisa los datos del horario.');
  const horario = validarHorario(datos.horario);
  if (!horario.ok) return response('VALIDACION', horario.error);
  const cierres = validarCierresEspeciales(datos.cierresEspeciales ?? []);
  if (!cierres.ok) return response('VALIDACION', cierres.error);
  return modificar(db, own.restaurantId, datos.version, now(), {
    permitido: sinPreparar, cambios: () => ({ horario: horario.horario, cierresEspeciales: cierres.cierres, actualizadoPor: own.actorId }), mensaje: 'Horario guardado.',
  });
}

// Cierre temporal: exige cuándo vuelve a abrir. `cierreTemporal: null` lo cancela. No toca los pedidos ya confirmados;
// al llegar el instante de reapertura la operación vuelve sola al horario habitual (se calcula con el reloj, no con una tarea).
export async function saveClosure(authorization: string | undefined, input: unknown, { db = adminServices().db, now = () => new Date() }: Dependencies = {}) {
  const own = await propietario(authorization, db);
  if ('error' in own) return own.error;
  const datos = (input ?? {}) as Record<string, unknown>;
  if (claves(input).some(clave => !['version', 'cierreTemporal'].includes(clave)) || !versionValida(datos.version) || !('cierreTemporal' in datos)) return response('VALIDACION', 'Indica cuándo volverá a abrir el restaurante.');
  const ahora = now();
  let cierre: Record<string, unknown> | null = null;
  if (datos.cierreTemporal !== null) {
    const validado = validarCierreTemporal(datos.cierreTemporal, ahora);
    if (!validado.ok) return response('VALIDACION', validado.error);
    cierre = { ...validado.cierre };
  }
  return modificar(db, own.restaurantId, datos.version, ahora, {
    permitido: sinPreparar, cambios: () => ({ cierreTemporal: cierre, actualizadoPor: own.actorId }),
    mensaje: cierre ? 'Cierre temporal guardado. No recibirás pedidos nuevos hasta la reapertura.' : 'Cierre temporal cancelado.',
  });
}

