import type { ProductoDetalle, ProductoDoc, ProductoMenu } from '../types/Menu';

// RF-06 · Lógica pura de la consulta del menú (sin Firebase ni React).
// La usan el servicio (functions/src/menu.ts), la app y las pruebas.

export type ProductoGuardado = { id: string; data: Partial<ProductoDoc> };

const MAX_FOTOS = 8;
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;

export const MENU_VACIO = 'El menú de este restaurante está vacío.';
export const PRODUCTO_NO_DISPONIBLE = 'Este producto no está disponible en el menú.';
export const RESTAURANTE_NO_DISPONIBLE = 'Este restaurante no está disponible.';

// Los identificadores llegan de la app y se usan como ruta de Firestore: solo caracteres seguros.
function checkedId(value: unknown, message: string): string {
  if (typeof value !== 'string' || !idPattern.test(value)) throw new Error(message);
  return value;
}

function onlyKeys(input: unknown, keys: string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.includes(key))) {
    throw new Error('Revisa los datos de la consulta.');
  }
  return input as Record<string, unknown>;
}

// Lanzan Error con un mensaje para el estudiante; el servicio lo traduce a VALIDACION.
export function validarConsultaMenu(input: unknown): { restaurantId: string } {
  const data = onlyKeys(input, ['restaurantId']);
  return { restaurantId: checkedId(data.restaurantId, 'Selecciona un restaurante válido.') };
}

export function validarConsultaProducto(input: unknown): { restaurantId: string; productId: string } {
  const data = onlyKeys(input, ['restaurantId', 'productId']);
  return { restaurantId: checkedId(data.restaurantId, 'Selecciona un restaurante válido.'), productId: checkedId(data.productId, 'Selecciona un producto válido.') };
}

// Un solo redondeo al peso más cercano, con medio peso hacia arriba (misma regla del carrito).
export const precioConDescuento = (precioCOP: number, porcentaje: number) => Math.floor((precioCOP * (100 - porcentaje) + 50) / 100);

// Pesos colombianos con punto de miles: 20000 -> $20.000
export const formatCOP = (monto: number) => `$${monto.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const instante = (valor: unknown) => (typeof valor === 'string' ? Date.parse(valor) : Number.NaN);

// Porcentaje de la promoción si está vigente ahora; 0 si no hay, está vencida, no ha empezado o es inválida.
// Una fecha ilegible anula la promoción: es preferible no ofrecer un descuento que ofrecer uno equivocado.
export function porcentajeVigente(promocion: unknown, ahora: Date): number {
  if (!promocion || typeof promocion !== 'object') return 0;
  const { porcentaje, desde, hasta } = promocion as Record<string, unknown>;
  if (typeof porcentaje !== 'number' || !Number.isInteger(porcentaje) || porcentaje < 5 || porcentaje > 90) return 0;
  if (desde !== undefined && !(ahora.getTime() >= instante(desde))) return 0;
  if (hasta !== undefined && !(ahora.getTime() <= instante(hasta))) return 0;
  return porcentaje;
}

// Solo fotos https (mismo criterio que el logo del restaurante), sin repetidas y con un máximo.
export function fotosPublicas(fotos: unknown): string[] {
  if (!Array.isArray(fotos)) return [];
  const validas = fotos.filter((foto): foto is string => typeof foto === 'string' && foto.startsWith('https://'));
  return [...new Set(validas)].slice(0, MAX_FOTOS);
}

/**
 * Convierte un documento de Firestore en lo único que ve el estudiante.
 * - Se omiten los ocultos (activo === false), sin nombre o con precio que no sea un entero positivo.
 * - Es "disponible" solo si el documento lo afirma (disponible === true); en cualquier otro caso, agotado.
 * - Nunca copia campos privados: se arma el objeto campo por campo.
 */
export function aProductoMenu({ id, data }: ProductoGuardado, ahora: Date): ProductoMenu | null {
  if (data.activo === false || typeof data.nombre !== 'string' || !data.nombre.trim()) return null;
  const precioCOP = data.precioCOP;
  if (typeof precioCOP !== 'number' || !Number.isInteger(precioCOP) || precioCOP < 1) return null;
  const porcentaje = porcentajeVigente(data.promocion, ahora);
  const [foto] = fotosPublicas(data.fotos);
  return {
    id,
    nombre: data.nombre.trim(),
    precioCOP,
    disponible: data.disponible === true,
    ...(porcentaje ? { promocion: { porcentaje, precioFinalCOP: precioConDescuento(precioCOP, porcentaje) } } : {}),
    ...(foto ? { foto } : {}),
  };
}

export function aProductoDetalle(guardado: ProductoGuardado, ahora: Date): ProductoDetalle | null {
  const base = aProductoMenu(guardado, ahora);
  if (!base) return null;
  const { descripcion } = guardado.data;
  return { ...base, descripcion: typeof descripcion === 'string' ? descripcion.trim() : '', fotos: fotosPublicas(guardado.data.fotos) };
}

// Disponibles primero; dentro de cada grupo, orden alfabético.
export function listarMenu(docs: readonly ProductoGuardado[], ahora: Date): ProductoMenu[] {
  return docs
    .map(doc => aProductoMenu(doc, ahora))
    .filter((producto): producto is ProductoMenu => producto !== null)
    .sort((a, b) => Number(b.disponible) - Number(a.disponible) || a.nombre.localeCompare(b.nombre, 'es'));
}
