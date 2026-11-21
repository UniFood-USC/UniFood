import { aProductoMenu, type ProductoGuardado } from './menu';

// RF-16 · Gestión de productos del menú (lógica pura, sin Firebase ni React).
// La usan el servicio (functions/src/productManagement.ts), la pantalla del restaurante y las pruebas.
// Los productos viven en restaurantes/{restaurantId}/productos/{productId} (misma ruta que RF-06).

export const NOMBRE_MAX = 100;
export const DESCRIPCION_MAX = 1000;
export const FOTOS_MIN = 1;
export const FOTOS_MAX = 5;
export const FOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB por foto
export const FORMATOS_FOTO = ['image/jpeg', 'image/png'] as const;
export type FormatoFoto = (typeof FORMATOS_FOTO)[number];

export const SIN_INVENTARIO = 'UniFood solo maneja disponible o agotado, sin cantidades de inventario.';
export const PRODUCTO_AJENO = 'Solo puedes modificar productos de tu restaurante.';
export const FOTO_FORMATO = 'Las fotos deben ser JPG o PNG.';
export const FOTO_PESO = 'Cada foto debe pesar 5 MB o menos.';

// ---------------------------------------------------------------------------
// Producto
// ---------------------------------------------------------------------------
export type ProductoEntrada = { nombre: string; descripcion: string; precioCOP: number; disponible: boolean; fotos: string[] };
// Lo que llega de la app al crear (sin id) o editar (con id y la versión que se estaba viendo).
export type GuardarProductoEntrada = { id?: string; version?: number; restaurantId?: string } & Record<string, unknown>;

export type ErroresProducto = Partial<Record<'nombre' | 'descripcion' | 'precioCOP' | 'disponible' | 'fotos' | 'general', string>>;
export type ResultadoValidacion = { ok: true; valor: ProductoEntrada } | { ok: false; errores: ErroresProducto };

const CAMPOS_PRODUCTO = ['nombre', 'descripcion', 'precioCOP', 'disponible', 'fotos'];
const CAMPOS_ENTRADA = [...CAMPOS_PRODUCTO, 'id', 'version', 'restaurantId'];
// Cualquier intento de llevar cantidades se rechaza con un mensaje claro (criterio: sin inventario numérico).
const CAMPOS_INVENTARIO = ['stock', 'cantidad', 'cantidades', 'inventario', 'existencias', 'unidades'];

const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
export const esIdSeguro = (valor: unknown): valor is string => typeof valor === 'string' && idPattern.test(valor);

// Se cuentan caracteres reales (un emoji cuenta como uno), no unidades UTF-16.
const longitud = (texto: string) => Array.from(texto).length;

// Ruta pública de una foto subida por un restaurante: /photos/{restaurantId}/{photoId}
const fotoPattern = /\/photos\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9_-]{1,128})$/;
export function referenciaFoto(url: unknown): { restaurantId: string; photoId: string } | null {
  if (typeof url !== 'string' || url.length > 600) return null;
  let ruta: string;
  try { ruta = new URL(url).pathname; } catch { return null; }
  const partes = fotoPattern.exec(ruta);
  return partes ? { restaurantId: partes[1]!, photoId: partes[2]! } : null;
}

function urlValida(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 600) return false;
  try { const { protocol } = new URL(url); return protocol === 'https:' || protocol === 'http:'; } catch { return false; }
}

// Valida los campos del producto y devuelve TODOS los errores asociados a su campo
// (la pantalla los muestra junto a cada campo).
export function validarProducto(input: unknown): ResultadoValidacion {
  const errores: ErroresProducto = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errores: { general: 'Revisa los datos del producto.' } };
  const data = input as Record<string, unknown>;
  const claves = Object.keys(data);

  if (claves.some(clave => CAMPOS_INVENTARIO.includes(clave))) errores.general = SIN_INVENTARIO;
  else if (claves.some(clave => !CAMPOS_ENTRADA.includes(clave))) errores.general = 'Revisa los datos del producto.';

  const nombre = typeof data.nombre === 'string' ? data.nombre.trim() : '';
  if (!nombre) errores.nombre = 'El nombre es obligatorio.';
  else if (longitud(nombre) > NOMBRE_MAX) errores.nombre = `El nombre admite hasta ${NOMBRE_MAX} caracteres.`;

  const descripcion = typeof data.descripcion === 'string' ? data.descripcion.trim() : '';
  if (!descripcion) errores.descripcion = 'La descripción es obligatoria.';
  else if (longitud(descripcion) > DESCRIPCION_MAX) errores.descripcion = `La descripción admite hasta ${DESCRIPCION_MAX} caracteres.`;

  const precio = data.precioCOP;
  if (typeof precio !== 'number' || !Number.isSafeInteger(precio) || precio <= 0) errores.precioCOP = 'El precio debe ser un número entero de pesos mayor que cero.';

  // Disponibilidad binaria y obligatoria: nada de "true" como texto ni de omitirla.
  if (typeof data.disponible !== 'boolean') errores.disponible = 'Indica si el producto está disponible o agotado.';

  const fotos = data.fotos;
  if (!Array.isArray(fotos) || fotos.length < FOTOS_MIN) errores.fotos = `Agrega al menos ${FOTOS_MIN} foto.`;
  else if (fotos.length > FOTOS_MAX) errores.fotos = `Un producto admite hasta ${FOTOS_MAX} fotos.`;
  else if (!fotos.every(urlValida)) errores.fotos = 'Una de las fotos no es válida. Quítala y vuelve a adjuntarla.';
  else if (new Set(fotos).size !== fotos.length) errores.fotos = 'No repitas la misma foto.';

  if (Object.keys(errores).length) return { ok: false, errores };
  return { ok: true, valor: { nombre, descripcion, precioCOP: precio as number, disponible: data.disponible as boolean, fotos: [...(fotos as string[])] } };
}

// Entrada completa de «guardar»: sin id = crear; con id = editar (exige la versión vista).
export type GuardarValidado =
  | { ok: true; id: string | null; version: number | null; restaurantId: string | null; producto: ProductoEntrada }
  | { ok: false; errores: ErroresProducto };

export function validarGuardado(input: unknown): GuardarValidado {
  const producto = validarProducto(input);
  if (!producto.ok) return producto;
  const { id, version, restaurantId } = input as GuardarProductoEntrada;
  if (id !== undefined && !esIdSeguro(id)) return { ok: false, errores: { general: 'Selecciona un producto válido.' } };
  if (id !== undefined && (typeof version !== 'number' || !Number.isInteger(version) || version < 1)) {
    return { ok: false, errores: { general: 'Falta la versión del producto que estás editando.' } };
  }
  if (id === undefined && version !== undefined) return { ok: false, errores: { general: 'Un producto nuevo no lleva versión.' } };
  if (restaurantId !== undefined && !esIdSeguro(restaurantId)) return { ok: false, errores: { general: 'Revisa los datos del producto.' } };
  return { ok: true, id: id ?? null, version: version ?? null, restaurantId: restaurantId ?? null, producto: producto.valor };
}

export function validarRetiro(input: unknown): { id: string; version: number; restaurantId: string | null } {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(clave => !['id', 'version', 'restaurantId'].includes(clave))) {
    throw new Error('Revisa los datos del producto.');
  }
  const { id, version, restaurantId } = input as Record<string, unknown>;
  if (!esIdSeguro(id)) throw new Error('Selecciona un producto válido.');
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new Error('Falta la versión del producto.');
  if (restaurantId !== undefined && !esIdSeguro(restaurantId)) throw new Error('Revisa los datos del producto.');
  return { id, version, restaurantId: (restaurantId as string | undefined) ?? null };
}

// ---------------------------------------------------------------------------
// Fotos: JPG o PNG de hasta 5 MB. La pantalla lo comprueba antes de subir y el servicio
// vuelve a comprobarlo sobre los bytes reales (no se fía del tipo que declare la app).
// ---------------------------------------------------------------------------
const FIRMA_JPG = [0xff, 0xd8, 0xff];
const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const empiezaCon = (bytes: ArrayLike<number>, firma: number[]) => firma.every((valor, i) => bytes[i] === valor);

// Comprobación previa con lo que conoce la pantalla (tipo y tamaño); devuelve el mensaje de error o null.
export function errorArchivoFoto(formato: unknown, bytes: unknown): string | null {
  if (typeof formato !== 'string' || !(FORMATOS_FOTO as readonly string[]).includes(formato)) return FOTO_FORMATO;
  if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes < 1) return 'No se pudo leer la foto.';
  if (bytes > FOTO_MAX_BYTES) return FOTO_PESO;
  return null;
}

// Comprobación definitiva del servicio sobre el contenido: el formato declarado debe ser el real.
export function errorContenidoFoto(formato: unknown, contenido: Uint8Array): string | null {
  const previo = errorArchivoFoto(formato, contenido.length);
  if (previo) return previo;
  const esJpg = empiezaCon(contenido, FIRMA_JPG);
  const esPng = empiezaCon(contenido, FIRMA_PNG);
  if (formato === 'image/jpeg' ? !esJpg : !esPng) return FOTO_FORMATO;
  return null;
}

export function validarSubidaFoto(input: unknown): { formato: FormatoFoto; datos: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(clave => !['formato', 'datos'].includes(clave))) {
    throw new Error('Revisa la foto que quieres subir.');
  }
  const { formato, datos } = input as Record<string, unknown>;
  if (typeof formato !== 'string' || !(FORMATOS_FOTO as readonly string[]).includes(formato)) throw new Error(FOTO_FORMATO);
  // El base64 pesa 4/3 del archivo: se corta antes de decodificar para no gastar memoria en un abuso.
  if (typeof datos !== 'string' || !datos) throw new Error('No se pudo leer la foto.');
  if (datos.length > Math.ceil((FOTO_MAX_BYTES * 4) / 3) + 8) throw new Error(FOTO_PESO);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(datos)) throw new Error('No se pudo leer la foto.');
  return { formato: formato as FormatoFoto, datos };
}

// ---------------------------------------------------------------------------
// Lo que ve el restaurante al gestionar su propio menú (incluye agotados; nunca retirados).
// ---------------------------------------------------------------------------
export type ProductoPropio = {
  id: string; nombre: string; descripcion: string; precioCOP: number;
  disponible: boolean; fotos: string[]; version: number;
};
type DocProducto = { id: string; data: Record<string, unknown> };

export function aProductoPropio({ id, data }: DocProducto): ProductoPropio | null {
  if (data.activo === false || typeof data.nombre !== 'string' || typeof data.precioCOP !== 'number') return null;
  return {
    id,
    nombre: data.nombre,
    descripcion: typeof data.descripcion === 'string' ? data.descripcion : '',
    precioCOP: data.precioCOP,
    disponible: data.disponible === true,
    fotos: Array.isArray(data.fotos) ? data.fotos.filter((foto): foto is string => typeof foto === 'string') : [],
    version: typeof data.version === 'number' ? data.version : 1,
  };
}

export const listarProductosPropios = (docs: readonly DocProducto[]): ProductoPropio[] =>
  docs.map(aProductoPropio).filter((p): p is ProductoPropio => p !== null).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

// ---------------------------------------------------------------------------
// Criterios 7 y 10 · Lo que la compra y el pedido necesitan de un producto.
// El flujo de pedidos (RF-07/RF-09) llama a revisarLineas; así la regla vive en un solo lugar.
// ---------------------------------------------------------------------------
export type LineaSolicitada = { productId: string; quantity: number };
export type ProductoNoComprable = { productId: string; motivo: 'agotado' | 'retirado' };

// Copia INMUTABLE de lo que se compró. Se guarda dentro del pedido confirmado: aunque el producto
// se edite, se agote o se retire después, el pedido conserva nombre, precio y descuento originales.
export type LineaConfirmada = {
  productId: string; nombre: string; precioCOP: number; descuentoPorcentaje: number;
  precioFinalCOP: number; cantidad: number;
};
export type RevisionLineas = { ok: true; lineas: LineaConfirmada[] } | { ok: false; noComprables: ProductoNoComprable[] };

export const MENSAJE_AGOTADO = 'Hay productos agotados o retirados del menú. Revisa tu carrito.';

// Un producto es comprable solo si está en el menú del restaurante del pedido y disponible.
export function revisarLineas(lineas: readonly LineaSolicitada[], docs: readonly ProductoGuardado[], ahora: Date): RevisionLineas {
  const noComprables: ProductoNoComprable[] = [];
  const confirmadas: LineaConfirmada[] = [];
  for (const { productId, quantity } of lineas) {
    const doc = docs.find(item => item.id === productId);
    const visible = doc ? aProductoMenu(doc, ahora) : null;
    if (!visible) { noComprables.push({ productId, motivo: 'retirado' }); continue; }
    if (!visible.disponible) { noComprables.push({ productId, motivo: 'agotado' }); continue; }
    confirmadas.push({
      productId, nombre: visible.nombre, precioCOP: visible.precioCOP,
      descuentoPorcentaje: visible.promocion?.porcentaje ?? 0,
      precioFinalCOP: visible.promocion?.precioFinalCOP ?? visible.precioCOP,
      cantidad: quantity,
    });
  }
  return noComprables.length ? { ok: false, noComprables } : { ok: true, lineas: confirmadas };
}
