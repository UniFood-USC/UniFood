import type { DiaSemana, Horario, RestauranteDoc, RestaurantePublico, Tramo } from '../types/Estado_Restaurante';

// RF-04 · Lógica pura del listado de restaurantes (sin Firebase ni React).
// La usan el servicio (functions/src/restaurants.ts) y las pruebas.

const DIAS: readonly DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const ETIQUETA_DIA: Record<DiaSemana, string> = {
  domingo: 'Domingo', lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado',
};
// Colombia es UTC-5 todo el año (no usa horario de verano).
const DESFASE_COLOMBIA_MS = 5 * 60 * 60 * 1000;

export type RestauranteGuardado = { id: string; data: Partial<RestauranteDoc> };

function aMinutos(hora: unknown): number | null {
  if (typeof hora !== 'string') return null;
  const partes = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
  return partes ? Number(partes[1]) * 60 + Number(partes[2]) : null;
}

// Un tramo solo sirve si abre y cierra el mismo día (cierra > abre) con formato HH:MM.
function tramoEnMinutos(tramo: Tramo | null | undefined): { abre: number; cierra: number } | null {
  if (!tramo) return null;
  const abre = aMinutos(tramo.abre), cierra = aMinutos(tramo.cierra);
  return abre === null || cierra === null || cierra <= abre ? null : { abre, cierra };
}

export function ahoraEnColombia(ahora: Date) {
  const local = new Date(ahora.getTime() - DESFASE_COLOMBIA_MS);
  return { dia: local.getUTCDay(), minutos: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

export function atiendeAhora(horario: Horario, ahora: Date): boolean {
  const { dia, minutos } = ahoraEnColombia(ahora);
  const tramo = tramoEnMinutos(horario[DIAS[dia]]);
  return !!tramo && minutos >= tramo.abre && minutos < tramo.cierra;
}

// "Hoy 14:00", "Mañana 08:00" o "Lunes 08:00"; undefined si no abre en los próximos 7 días.
export function proximaApertura(horario: Horario, ahora: Date): string | undefined {
  const { dia, minutos } = ahoraEnColombia(ahora);
  for (let adelante = 0; adelante <= 7; adelante++) {
    const nombre = DIAS[(dia + adelante) % 7];
    const tramo = tramoEnMinutos(horario[nombre]);
    if (!tramo || (adelante === 0 && tramo.abre <= minutos)) continue;
    const hora = (horario[nombre] as Tramo).abre;
    return `${adelante === 0 ? 'Hoy' : adelante === 1 ? 'Mañana' : ETIQUETA_DIA[nombre]} ${hora}`;
  }
  return undefined;
}

/**
 * Convierte un documento de Firestore en lo único que ve el estudiante.
 * - Solo restaurantes aprobados (pendiente, suspendido y eliminado no se listan).
 * - disponible = activo y dentro de su horario. Sin horario definido, depende solo de `activo`.
 * - Nunca copia campos privados (dueño, correo, etc.): se arma el objeto campo por campo.
 */
export function aRestaurantePublico({ id, data }: RestauranteGuardado, ahora: Date): RestaurantePublico | null {
  if (data.estado !== 'aprobado' || typeof data.nombre !== 'string' || !data.nombre.trim()) return null;
  const horario = data.horario;
  const activo = data.activo === true;
  const disponible = activo && (horario ? atiendeAhora(horario, ahora) : true);
  const proxima = !disponible && activo && horario ? proximaApertura(horario, ahora) : undefined;
  return {
    id,
    nombre: data.nombre.trim(),
    ...(typeof data.logo === 'string' && data.logo.startsWith('https://') ? { logo: data.logo } : {}),
    disponible,
    ...(proxima ? { proximaApertura: proxima } : {}),
  };
}

// Los que atienden ahora primero; dentro de cada grupo, orden alfabético.
export function listarRestaurantesPublicos(docs: readonly RestauranteGuardado[], ahora: Date): RestaurantePublico[] {
  return docs
    .map(doc => aRestaurantePublico(doc, ahora))
    .filter((r): r is RestaurantePublico => r !== null)
    .sort((a, b) => Number(b.disponible) - Number(a.disponible) || a.nombre.localeCompare(b.nombre, 'es'));
}
