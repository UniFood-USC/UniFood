import type { CierreEspecial, CierreTemporal, DiaSemana, Horario, RestauranteDoc, RestaurantePublico, Tramo } from '../types/Estado_Restaurante';

// RF-04 / RF-22 · Lógica pura del listado y de la atención de restaurantes (sin Firebase ni React).
// La usan el servicio (functions/src/restaurants.ts, checkout, gestión) y las pruebas.

export const DIAS: readonly DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
export const ETIQUETA_DIA: Record<DiaSemana, string> = {
  domingo: 'Domingo', lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado',
};
// Colombia es UTC-5 todo el año (no usa horario de verano).
const DESFASE_COLOMBIA_MS = 5 * 60 * 60 * 1000;
const DIA_MIN = 1440;

export type RestauranteGuardado = { id: string; data: Partial<RestauranteDoc> };
export type ConfigAtencion = Pick<Partial<RestauranteDoc>, 'horario' | 'cierresEspeciales' | 'cierreTemporal'>;

export function aMinutos(hora: unknown): number | null {
  if (typeof hora !== 'string') return null;
  const partes = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
  return partes ? Number(partes[1]) * 60 + Number(partes[2]) : null;
}

// Un tramo sirve con formato HH:MM y apertura distinta del cierre. Si cierra < abre cruza la medianoche.
export function tramoEnMinutos(tramo: Tramo | null | undefined): { abre: number; cierra: number; cruza: boolean } | null {
  if (!tramo) return null;
  const abre = aMinutos(tramo.abre), cierra = aMinutos(tramo.cierra);
  return abre === null || cierra === null || cierra === abre ? null : { abre, cierra, cruza: cierra < abre };
}

export function ahoraEnColombia(ahora: Date) {
  const local = new Date(ahora.getTime() - DESFASE_COLOMBIA_MS);
  return { dia: local.getUTCDay(), minutos: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

// Línea de tiempo en "minutos locales" desde 1970-01-01 00:00 hora de Colombia.
const minutoLocal = (instante: Date) => Math.floor((instante.getTime() - DESFASE_COLOMBIA_MS) / 60_000);
const diaSemanaDe = (dia: number) => (((dia + 4) % 7) + 7) % 7; // 1970-01-01 fue jueves
export const fechaDeDia = (dia: number) => new Date(dia * 86_400_000).toISOString().slice(0, 10);
const hhmm = (minutos: number) => `${String(Math.floor((minutos % DIA_MIN) / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

type Intervalo = { inicio: number; fin: number };

// Franjas reales (en minutos locales) alrededor de "hoy": cada día aporta su tramo; las franjas que
// cruzan la medianoche terminan al día siguiente; un cierre especial quita el día completo
// (la franja que abre ese día desaparece y la que venía del día anterior se corta a las 00:00).
function franjas(horario: Horario, cierres: readonly CierreEspecial[], hoy: number, diasAtras: number, diasAdelante: number): Intervalo[] {
  const cerrados = new Set(cierres.map(cierre => cierre.fecha));
  const resultado: Intervalo[] = [];
  for (let dia = hoy - diasAtras; dia <= hoy + diasAdelante; dia++) {
    const tramo = tramoEnMinutos(horario[DIAS[diaSemanaDe(dia)]]);
    if (!tramo || cerrados.has(fechaDeDia(dia))) continue;
    const inicio = dia * DIA_MIN + tramo.abre;
    let fin = dia * DIA_MIN + tramo.cierra + (tramo.cruza ? DIA_MIN : 0);
    if (tramo.cruza && cerrados.has(fechaDeDia(dia + 1))) fin = (dia + 1) * DIA_MIN;
    resultado.push({ inicio, fin });
  }
  return resultado;
}

function etiquetaApertura(minuto: number, hoy: number): string {
  const dia = Math.floor(minuto / DIA_MIN);
  const hora = hhmm(minuto);
  const adelante = dia - hoy;
  if (adelante === 0) return `Hoy ${hora}`;
  if (adelante === 1) return `Mañana ${hora}`;
  if (adelante <= 7) return `${ETIQUETA_DIA[DIAS[diaSemanaDe(dia)]]} ${hora}`;
  const [, mes, diaMes] = fechaDeDia(dia).split('-');
  return `${diaMes}/${mes} ${hora}`;
}

export type EstadoAtencion = { disponible: boolean; cierreTemporal: boolean; proximaApertura?: string; proximaAperturaISO?: string };

/**
 * Estado de atención en un instante, con horario por día, franjas que cruzan medianoche,
 * cierres especiales y cierre temporal.
 * - Sin horario definido se considera que atiende (salvo cierre especial o temporal).
 * - Mientras dure el cierre temporal está cerrado; al llegar su fin vuelve solo al horario habitual
 *   (si en ese momento está fuera de horario, sigue cerrado hasta su próxima apertura).
 * - proximaApertura: "Hoy 14:00", "Mañana 08:00", "Lunes 08:00" o "DD/MM HH:MM" si queda a más de una semana.
 */
export function estadoDeAtencion(config: ConfigAtencion, ahora: Date): EstadoAtencion {
  const ahoraMin = minutoLocal(ahora);
  const hoy = Math.floor(ahoraMin / DIA_MIN);
  const cierres = config.cierresEspeciales ?? [];
  const hastaMs = config.cierreTemporal ? Date.parse(config.cierreTemporal.hasta) : NaN;
  const temporal = Number.isFinite(hastaMs) && ahora.getTime() < hastaMs;
  const reabreMin = temporal ? Math.ceil((hastaMs - DESFASE_COLOMBIA_MS) / 60_000) : ahoraMin;
  const desde = Math.max(ahoraMin, reabreMin);

  let abierto: boolean;
  let proximo: number | undefined;
  if (!config.horario) {
    // Sin horario: atiende siempre, salvo un día de cierre especial.
    const cerrados = new Set(cierres.map(cierre => cierre.fecha));
    const cerradoEn = (minuto: number) => cerrados.has(fechaDeDia(Math.floor(minuto / DIA_MIN)));
    abierto = !temporal && !cerradoEn(ahoraMin);
    for (let dia = Math.floor(desde / DIA_MIN); proximo === undefined && dia <= Math.floor(desde / DIA_MIN) + 400; dia++) {
      const minuto = dia === Math.floor(desde / DIA_MIN) ? desde : dia * DIA_MIN;
      if (!cerradoEn(minuto)) proximo = minuto;
    }
  } else {
    const intervalos = franjas(config.horario, cierres, hoy, 1, Math.floor(desde / DIA_MIN) - hoy + 8);
    abierto = !temporal && intervalos.some(({ inicio, fin }) => ahoraMin >= inicio && ahoraMin < fin);
    const candidatos = intervalos.filter(({ fin }) => fin > desde).map(({ inicio }) => Math.max(inicio, desde)).sort((a, b) => a - b);
    proximo = candidatos[0];
  }
  if (abierto) return { disponible: true, cierreTemporal: false };
  const resto = proximo === undefined ? {} : { proximaApertura: etiquetaApertura(proximo, hoy), proximaAperturaISO: new Date(proximo * 60_000 + DESFASE_COLOMBIA_MS).toISOString() };
  return { disponible: false, cierreTemporal: temporal, ...resto };
}

export function atiendeAhora(horario: Horario, ahora: Date): boolean {
  return estadoDeAtencion({ horario }, ahora).disponible;
}

// Próxima vez que abre (aunque ahora esté abierto): "Hoy 14:00", "Mañana 08:00" o "Lunes 08:00";
// undefined si no abre en los próximos 7 días.
export function proximaApertura(horario: Horario, ahora: Date): string | undefined {
  const ahoraMin = minutoLocal(ahora);
  const hoy = Math.floor(ahoraMin / DIA_MIN);
  const siguiente = franjas(horario, [], hoy, 0, 8).map(({ inicio }) => inicio).filter(inicio => inicio > ahoraMin).sort((a, b) => a - b)[0];
  return siguiente === undefined || Math.floor(siguiente / DIA_MIN) - hoy > 7 ? undefined : etiquetaApertura(siguiente, hoy);
}

/**
 * Convierte un documento de Firestore en lo único que ve el estudiante.
 * - Solo restaurantes aprobados Y activos (pendiente, rechazado, suspendido, eliminado e inactivos no se listan).
 * - Los cerrados (por horario, cierre especial o cierre temporal) SÍ se listan: disponible = false y, si se conoce, su próxima apertura.
 * - Nunca copia campos privados (dueño, correo, teléfono, etc.): se arma el objeto campo por campo.
 */
export function aRestaurantePublico({ id, data }: RestauranteGuardado, ahora: Date): RestaurantePublico | null {
  if (data.estado !== 'aprobado' || data.activo !== true || typeof data.nombre !== 'string' || !data.nombre.trim()) return null;
  const atencion = estadoDeAtencion(data, ahora);
  return {
    id,
    nombre: data.nombre.trim(),
    ...(typeof data.logo === 'string' && data.logo.startsWith('https://') ? { logo: data.logo } : {}),
    disponible: atencion.disponible,
    ...(!atencion.disponible && atencion.proximaApertura ? { proximaApertura: atencion.proximaApertura } : {}),
    ...(atencion.cierreTemporal ? { cierreTemporal: true } : {}),
  };
}

// Regla para el flujo de pedidos: un restaurante cerrado, pendiente, suspendido o eliminado no recibe pedidos inmediatos.
// Quien cree pedidos (carrito/confirmación) debe usar esta misma función en el servidor
// y responder con el código RESTAURANTE_CERRADO cuando devuelva false.
export function puedeRecibirPedidoInmediato(data: Partial<RestauranteDoc>, ahora: Date): boolean {
  return aRestaurantePublico({ id: '', data }, ahora)?.disponible === true;
}

// Los abiertos ahora primero; dentro de cada grupo, orden alfabético.
export function listarRestaurantesPublicos(docs: readonly RestauranteGuardado[], ahora: Date): RestaurantePublico[] {
  return docs
    .map(doc => aRestaurantePublico(doc, ahora))
    .filter((r): r is RestaurantePublico => r !== null)
    .sort((a, b) => Number(b.disponible) - Number(a.disponible) || a.nombre.localeCompare(b.nombre, 'es'));
}

export type { CierreTemporal };
