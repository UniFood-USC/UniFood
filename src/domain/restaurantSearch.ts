import type { RestaurantePublico } from '../types/Estado_Restaurante';

// RF-05 · Búsqueda de restaurantes por nombre. Lógica pura (sin Firebase ni React).
// Se aplica sobre el listado del RF-04, que ya trae solo aprobados y activos, cerrados incluidos.

/** Quita tildes, pasa a minúsculas y colapsa espacios: "  CAFÉ  uni " -> "cafe uni". */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * - Coincidencia parcial (subcadena) por nombre; mayúsculas y tildes son equivalentes.
 * - Texto vacío (o solo espacios): devuelve todo el listado recibido.
 * - Sin coincidencias: devuelve []. Conserva el orden del listado original.
 */
export function buscarRestaurantes<T extends Pick<RestaurantePublico, 'nombre'>>(restaurantes: readonly T[], consulta: string): T[] {
  const buscado = normalizarTexto(consulta);
  if (!buscado) return [...restaurantes];
  return restaurantes.filter(r => normalizarTexto(r.nombre).includes(buscado));
}
