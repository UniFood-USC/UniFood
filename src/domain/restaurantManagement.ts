import type { CierreEspecial, CierreTemporal, DiaSemana, EstadoRestaurante, Horario, RestauranteDoc } from '../types/Estado_Restaurante';
import { DIAS, estadoDeAtencion, fechaDeDia, tramoEnMinutos } from './restaurants';
import { normalizeEmail, validatePassword } from './registration';

// RF-22 · Gestión de restaurantes (lógica pura, sin Firebase ni React).
// La usan el servicio (functions/src/restaurantManagement.ts), las pantallas de registro, del restaurante
// y del administrador, y las pruebas. Los restaurantes viven en la colección `restaurantes/{restaurantId}`.

export const NOMBRE_MAX = 100;
export const DESCRIPCION_MAX = 1000;
export const UBICACION_MAX = 120;
export const MOTIVO_MAX = 500;
export const MOTIVO_CIERRE_MAX = 100;
export const CIERRES_ESPECIALES_MAX = 60;

export const SOLO_ADMIN = 'Solo la administración gestiona los restaurantes.';
export const SOLO_PROPIETARIO = 'Solo el propietario del restaurante puede hacer este cambio.';
export const MOTIVO_OBLIGATORIO = 'Escribe el motivo del rechazo.';

export const ETIQUETA_ESTADO: Record<EstadoRestaurante, string> = {
  pendiente: 'Pendiente de aprobación', aprobado: 'Aprobado', rechazado: 'Rechazado', suspendido: 'Suspendido', eliminado: 'Eliminado',
};

// ---------------------------------------------------------------------------
// Validación de campos
// ---------------------------------------------------------------------------
export type CampoRestaurante = 'nombre' | 'descripcion' | 'ubicacion' | 'horario' | 'telefono' | 'correo' | 'logo' | 'password' | 'confirmPassword' | 'general';
export type ErroresRestaurante = Partial<Record<CampoRestaurante, string>>;
export type InfoRestaurante = { nombre: string; descripcion: string; ubicacion: string; telefono: string; logo?: string };
export type RegistroRestaurante = InfoRestaurante & { horario: Horario; correo: string; password: string };

// Se cuentan caracteres reales (un emoji cuenta como uno), no unidades UTF-16.
const longitud = (texto: string) => Array.from(texto).length;
const registro = (valor: unknown): valor is Record<string, unknown> => !!valor && typeof valor === 'object' && !Array.isArray(valor);

function validarTexto(data: Record<string, unknown>, campo: 'nombre' | 'descripcion' | 'ubicacion', etiqueta: string, obligatorio: string, max: number, errores: ErroresRestaurante) {
  const texto = typeof data[campo] === 'string' ? (data[campo] as string).trim() : '';
  if (!texto) errores[campo] = `${etiqueta} es ${obligatorio}.`;
  else if (longitud(texto) > max) errores[campo] = `${etiqueta} admite hasta ${max.toLocaleString('es-CO')} caracteres.`;
  return texto;
}

export function normalizarTelefono(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.replace(/[\s().-]/g, '');
  return /^\+?\d{7,15}$/.test(limpio) ? limpio : null;
}

const urlHttps = (valor: unknown): valor is string => {
  if (typeof valor !== 'string' || valor.length > 600) return false;
  try { return new URL(valor).protocol === 'https:'; } catch { return false; }
};

// Horario por día: cada día es null (cerrado) o {abre, cierra} HH:MM con apertura distinta del cierre
// (cierra < abre es una franja que cruza la medianoche). Debe atender al menos un día.
export function validarHorario(entrada: unknown): { ok: true; horario: Horario } | { ok: false; error: string } {
  if (!registro(entrada)) return { ok: false, error: 'Define el horario de atención.' };
  const horario: Horario = {};
  for (const [dia, tramo] of Object.entries(entrada)) {
    if (!DIAS.includes(dia as DiaSemana)) return { ok: false, error: 'El horario solo admite los días de la semana.' };
    if (tramo === null || tramo === undefined) continue;
    if (!registro(tramo) || Object.keys(tramo).some(clave => !['abre', 'cierra'].includes(clave))) return { ok: false, error: `Revisa el horario del ${dia}.` };
    const valido = tramoEnMinutos(tramo as { abre: string; cierra: string });
    if (!valido) return { ok: false, error: `El horario del ${dia} necesita hora de apertura y de cierre distintas, con formato HH:MM.` };
    horario[dia as DiaSemana] = { abre: (tramo as { abre: string }).abre, cierra: (tramo as { cierra: string }).cierra };
  }
  if (!Object.values(horario).some(Boolean)) return { ok: false, error: 'Indica al menos un día de atención.' };
  return { ok: true, horario };
}

export function validarCierresEspeciales(entrada: unknown): { ok: true; cierres: CierreEspecial[] } | { ok: false; error: string } {
  if (!Array.isArray(entrada)) return { ok: false, error: 'Revisa los cierres especiales.' };
  if (entrada.length > CIERRES_ESPECIALES_MAX) return { ok: false, error: `Puedes registrar hasta ${CIERRES_ESPECIALES_MAX} cierres especiales.` };
  const vistos = new Set<string>();
  const cierres: CierreEspecial[] = [];
  for (const item of entrada) {
    if (!registro(item) || Object.keys(item).some(clave => !['fecha', 'motivo'].includes(clave))) return { ok: false, error: 'Revisa los cierres especiales.' };
    const { fecha, motivo } = item;
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)) || fechaDeDia(Date.parse(`${fecha}T00:00:00Z`) / 86_400_000) !== fecha) {
      return { ok: false, error: 'Cada cierre especial necesita una fecha válida con formato AAAA-MM-DD.' };
    }
    if (vistos.has(fecha)) return { ok: false, error: `La fecha ${fecha} está repetida.` };
    vistos.add(fecha);
    const texto = typeof motivo === 'string' ? motivo.trim() : '';
    if (motivo !== undefined && typeof motivo !== 'string') return { ok: false, error: 'Revisa los cierres especiales.' };
    if (longitud(texto) > MOTIVO_CIERRE_MAX) return { ok: false, error: `El motivo admite hasta ${MOTIVO_CIERRE_MAX} caracteres.` };
    cierres.push({ fecha, ...(texto ? { motivo: texto } : {}) });
  }
  return { ok: true, cierres: cierres.sort((a, b) => a.fecha.localeCompare(b.fecha)) };
}

// Todo cierre temporal exige cuándo vuelve a abrir (instante futuro).
export function validarCierreTemporal(entrada: unknown, ahora: Date): { ok: true; cierre: CierreTemporal } | { ok: false; error: string } {
  if (!registro(entrada) || Object.keys(entrada).some(clave => !['hasta', 'motivo'].includes(clave))) return { ok: false, error: 'Indica cuándo volverá a abrir el restaurante.' };
  const { hasta, motivo } = entrada;
  if (typeof hasta !== 'string' || !hasta.trim() || Number.isNaN(Date.parse(hasta))) return { ok: false, error: 'Indica cuándo volverá a abrir el restaurante.' };
  const instante = Date.parse(hasta);
  if (instante <= ahora.getTime()) return { ok: false, error: 'La fecha de reapertura debe ser posterior al momento actual.' };
  if (motivo !== undefined && typeof motivo !== 'string') return { ok: false, error: 'Revisa el motivo del cierre.' };
  const texto = typeof motivo === 'string' ? motivo.trim() : '';
  if (longitud(texto) > MOTIVO_CIERRE_MAX) return { ok: false, error: `El motivo admite hasta ${MOTIVO_CIERRE_MAX} caracteres.` };
  return { ok: true, cierre: { hasta: new Date(instante).toISOString(), desde: ahora.toISOString(), ...(texto ? { motivo: texto } : {}) } };
}

export function validarRechazo(entrada: unknown): { ok: true; motivo: string } | { ok: false; error: string } {
  const motivo = typeof entrada === 'string' ? entrada.trim() : '';
  if (!motivo) return { ok: false, error: MOTIVO_OBLIGATORIO };
  if (longitud(motivo) > MOTIVO_MAX) return { ok: false, error: `El motivo admite hasta ${MOTIVO_MAX} caracteres.` };
  return { ok: true, motivo };
}

const CAMPOS_INFO = ['nombre', 'descripcion', 'ubicacion', 'telefono', 'logo'];
function validarInfo(data: Record<string, unknown>, errores: ErroresRestaurante) {
  const nombre = validarTexto(data, 'nombre', 'El nombre', 'obligatorio', NOMBRE_MAX, errores);
  const descripcion = validarTexto(data, 'descripcion', 'La descripción', 'obligatoria', DESCRIPCION_MAX, errores);
  const ubicacion = validarTexto(data, 'ubicacion', 'La ubicación dentro del campus', 'obligatoria', UBICACION_MAX, errores);
  const telefono = normalizarTelefono(data.telefono);
  if (!telefono) errores.telefono = 'Escribe un teléfono válido, de 7 a 15 dígitos.';
  let logo: string | undefined;
  if (data.logo !== undefined && data.logo !== null && data.logo !== '') {
    if (urlHttps(data.logo)) logo = data.logo; else errores.logo = 'El logo debe ser un enlace https válido.';
  }
  return { nombre, descripcion, ubicacion, telefono: telefono ?? '', ...(logo ? { logo } : {}) };
}

// Información editable de un restaurante existente (la guarda el propietario o la administración).
export function validarInformacion(entrada: unknown): { ok: true; info: InfoRestaurante } | { ok: false; errores: ErroresRestaurante } {
  if (!registro(entrada)) return { ok: false, errores: { general: 'Revisa los datos del restaurante.' } };
  const errores: ErroresRestaurante = {};
  if (Object.keys(entrada).some(clave => !CAMPOS_INFO.includes(clave))) errores.general = 'Revisa los datos del restaurante.';
  const info = validarInfo(entrada, errores);
  return Object.keys(errores).length ? { ok: false, errores } : { ok: true, info };
}

// Registro (autoalta): exige nombre, descripción, ubicación, horario, teléfono, correo y contraseña.
// El correo puede ser de cualquier dominio (solo los estudiantes usan @usc.edu.co).
export function validarRegistroRestaurante(entrada: unknown): { ok: true; datos: RegistroRestaurante & { confirmPassword: string } } | { ok: false; errores: ErroresRestaurante } {
  if (!registro(entrada)) return { ok: false, errores: { general: 'Revisa los datos del registro.' } };
  const errores: ErroresRestaurante = {};
  if (['role', 'rol', 'state', 'estado', 'uid', 'restaurantId', 'ownerId'].some(clave => clave in entrada)) return { ok: false, errores: { general: 'El registro no permite asignar roles, estados ni propietarios.' } };
  if (Object.keys(entrada).some(clave => ![...CAMPOS_INFO, 'horario', 'correo', 'password', 'confirmPassword'].includes(clave))) errores.general = 'Revisa los datos del registro.';
  const info = validarInfo(entrada, errores);
  const horario = validarHorario(entrada.horario);
  if (!horario.ok) errores.horario = horario.error;
  const correo = typeof entrada.correo === 'string' ? normalizeEmail(entrada.correo) : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.correo = 'Escribe un correo válido.';
  let password = '';
  try { password = validatePassword(entrada); }
  catch (error) { errores[/no coinciden/.test((error as Error).message) ? 'confirmPassword' : 'password'] = (error as Error).message; }
  if (Object.keys(errores).length || !horario.ok) return { ok: false, errores };
  return { ok: true, datos: { ...info, horario: horario.horario, correo, password, confirmPassword: password } };
}

// ---------------------------------------------------------------------------
// Estados y transiciones
// ---------------------------------------------------------------------------
export type AccionAdmin = 'aprobar' | 'rechazar' | 'suspender' | 'reactivar' | 'eliminar';
export const ACCIONES_ADMIN: readonly AccionAdmin[] = ['aprobar', 'rechazar', 'suspender', 'reactivar', 'eliminar'];
const TRANSICIONES: Record<AccionAdmin, { desde: readonly EstadoRestaurante[]; hacia: EstadoRestaurante }> = {
  aprobar: { desde: ['pendiente'], hacia: 'aprobado' },
  rechazar: { desde: ['pendiente'], hacia: 'rechazado' },
  suspender: { desde: ['aprobado'], hacia: 'suspendido' },
  reactivar: { desde: ['suspendido'], hacia: 'aprobado' },
  eliminar: { desde: ['pendiente', 'rechazado', 'aprobado', 'suspendido'], hacia: 'eliminado' },
};
export const accionesPermitidas = (estado: EstadoRestaurante): AccionAdmin[] => ACCIONES_ADMIN.filter(accion => TRANSICIONES[accion].desde.includes(estado));
export const estadoTras = (accion: AccionAdmin) => TRANSICIONES[accion].hacia;
export const MENSAJE_TRANSICION: Record<EstadoRestaurante, string> = {
  pendiente: 'El restaurante está pendiente de revisión.', aprobado: 'El restaurante ya está aprobado.',
  rechazado: 'El restaurante fue rechazado y espera que su propietario lo corrija y lo reenvíe.',
  suspendido: 'El restaurante está suspendido.', eliminado: 'El restaurante fue eliminado.',
};

// Estados en los que el propietario puede editar su información y preparar el menú.
// Pendiente y rechazado preparan, pero no aparecen ante estudiantes ni reciben pedidos.
export const puedePrepararInformacion = (estado: unknown) => estado === 'pendiente' || estado === 'rechazado' || estado === 'aprobado';

// Una cuenta por establecimiento y un establecimiento por cuenta.
export function esRelacionUnoAUno(restaurantes: readonly { id: string; ownerId?: string | null }[], cuentas: readonly { id: string; restaurantId?: string | null }[]): boolean {
  const duenos = restaurantes.map(({ ownerId }) => ownerId).filter((valor): valor is string => !!valor);
  const ids = cuentas.map(({ restaurantId }) => restaurantId).filter((valor): valor is string => !!valor);
  if (new Set(duenos).size !== duenos.length || new Set(ids).size !== ids.length) return false;
  return restaurantes.every(({ id, ownerId }) => !ownerId || cuentas.some(cuenta => cuenta.id === ownerId && cuenta.restaurantId === id))
    && cuentas.every(({ id, restaurantId }) => !restaurantId || restaurantes.some(r => r.id === restaurantId && r.ownerId === id));
}
// Identificador del establecimiento de una cuenta nueva: derivado de la cuenta, así dos establecimientos no pueden compartir dueño.
export const idRestauranteDeCuenta = (uid: string) => `rest-${uid}`;

// ---------------------------------------------------------------------------
// Vistas
// ---------------------------------------------------------------------------
export type CondicionOperativa = 'pendiente' | 'rechazado' | 'suspendido' | 'eliminado' | 'cierre_temporal' | 'fuera_de_horario' | 'abierto';
export const ETIQUETA_CONDICION: Record<CondicionOperativa, string> = {
  pendiente: 'Pendiente de aprobación', rechazado: 'Rechazado', suspendido: 'Suspendido', eliminado: 'Eliminado',
  cierre_temporal: 'Cerrado temporalmente', fuera_de_horario: 'Fuera de horario', abierto: 'Abierto ahora',
};

export type RestauranteGestion = {
  id: string; nombre: string; descripcion: string; ubicacion: string; telefono: string; correo: string; logo?: string;
  estado: EstadoRestaurante; motivoRechazo?: string; version: number;
  horario: Horario; cierresEspeciales: CierreEspecial[]; cierreTemporal?: CierreTemporal;
  condicion: CondicionOperativa; disponible: boolean; proximaApertura?: string;
  acciones: AccionAdmin[];
};

// Lo que ven la administración y el propietario: el servicio arma el objeto campo por campo
// (nunca el documento completo) y calcula la condición vigente con el reloj recibido.
export function aRestauranteGestion(id: string, data: Partial<RestauranteDoc>, ahora: Date): RestauranteGestion | null {
  const estado = data.estado;
  if (typeof data.nombre !== 'string' || !estado || !(estado in ETIQUETA_ESTADO)) return null;
  const atencion = estadoDeAtencion(data, ahora);
  const operativo = estado === 'aprobado';
  const condicion: CondicionOperativa = !operativo ? estado as CondicionOperativa
    : atencion.disponible ? 'abierto' : atencion.cierreTemporal ? 'cierre_temporal' : 'fuera_de_horario';
  const cierreVigente = data.cierreTemporal && Date.parse(data.cierreTemporal.hasta) > ahora.getTime() ? data.cierreTemporal : undefined;
  return {
    id, nombre: data.nombre, descripcion: data.descripcion ?? '', ubicacion: data.ubicacion ?? '', telefono: data.telefono ?? '', correo: data.correo ?? '',
    ...(typeof data.logo === 'string' && data.logo ? { logo: data.logo } : {}),
    estado, ...(data.motivoRechazo ? { motivoRechazo: data.motivoRechazo } : {}), version: typeof data.version === 'number' ? data.version : 1,
    horario: data.horario ?? {}, cierresEspeciales: data.cierresEspeciales ?? [], ...(cierreVigente ? { cierreTemporal: cierreVigente } : {}),
    condicion, disponible: operativo && data.activo !== false && atencion.disponible,
    ...(operativo && !atencion.disponible && atencion.proximaApertura ? { proximaApertura: atencion.proximaApertura } : {}),
    acciones: accionesPermitidas(estado),
  };
}

// Orden del listado administrativo: pendientes primero (requieren revisión), luego por nombre.
const PRIORIDAD: Record<EstadoRestaurante, number> = { pendiente: 0, rechazado: 1, aprobado: 2, suspendido: 3, eliminado: 4 };
export const ordenarGestion = (lista: readonly RestauranteGestion[]) =>
  [...lista].sort((a, b) => PRIORIDAD[a.estado] - PRIORIDAD[b.estado] || a.nombre.localeCompare(b.nombre, 'es'));


// "2026-12-24 14:30" (hora de Colombia) → ISO UTC; null si el texto no es una fecha y hora válidas.
export function reaperturaAISO(texto: string): string | null {
  const partes = /^(\d{4}-\d{2}-\d{2})[ T]([01]\d|2[0-3]):([0-5]\d)$/.exec(texto.trim());
  if (!partes) return null;
  const instante = Date.parse(`${partes[1]}T${partes[2]}:${partes[3]}:00-05:00`);
  return Number.isNaN(instante) || fechaDeDia(Date.parse(`${partes[1]}T00:00:00Z`) / 86_400_000) !== partes[1] ? null : new Date(instante).toISOString();
}
// ISO → "AAAA-MM-DD HH:MM" en hora de Colombia, para mostrar y editar.
export const reaperturaATexto = (iso: string) => new Date(Date.parse(iso) - 5 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');
