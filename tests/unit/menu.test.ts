import { test, expect } from '@jest/globals';
import { aProductoDetalle, aProductoMenu, fotosPublicas, listarMenu, porcentajeVigente, validarConsultaMenu, validarConsultaProducto } from '../../src/domain/menu';
import type { ProductoDoc } from '../../src/types/Menu';

const ahora = new Date('2026-10-19T15:00:00Z');
const base: ProductoDoc = { nombre: ' Doble ', descripcion: ' Dos carnes ', precioCOP: 20000, fotos: ['https://x.test/a.png', 'https://x.test/b.png'], disponible: true };

test('un producto válido muestra nombre y precio en pesos enteros, sin campos privados', () => {
  const producto = aProductoMenu({ id: 'doble', data: { ...base, costoCOP: 1, notaInterna: 'x' } as ProductoDoc }, ahora);
  expect(producto).toEqual({ id: 'doble', nombre: 'Doble', precioCOP: 20000, disponible: true, foto: 'https://x.test/a.png' });
  expect(Object.keys(producto!)).not.toContain('costoCOP');
});

test('el detalle incluye descripción, todas las fotos, disponibilidad, precio y promoción', () => {
  const detalle = aProductoDetalle({ id: 'doble', data: { ...base, promocion: { porcentaje: 15 } } }, ahora);
  expect(detalle).toEqual({
    id: 'doble', nombre: 'Doble', precioCOP: 20000, disponible: true, foto: 'https://x.test/a.png',
    promocion: { porcentaje: 15, precioFinalCOP: 17000 }, descripcion: 'Dos carnes', fotos: ['https://x.test/a.png', 'https://x.test/b.png'],
  });
});

test('agotado: solo es disponible si el documento lo afirma', () => {
  expect(aProductoMenu({ id: 'a', data: { ...base, disponible: false } }, ahora)?.disponible).toBe(false);
  expect(aProductoMenu({ id: 'a', data: { ...base, disponible: undefined } }, ahora)?.disponible).toBe(false);
  expect(aProductoMenu({ id: 'a', data: { ...base, disponible: 'true' as unknown as boolean } }, ahora)?.disponible).toBe(false);
});

test('se omiten productos ocultos, sin nombre o con precio inválido', () => {
  for (const cambio of [{ activo: false }, { nombre: '  ' }, { nombre: undefined }, { precioCOP: 0 }, { precioCOP: -5 }, { precioCOP: 1500.5 }, { precioCOP: '2000' as unknown as number }, { precioCOP: undefined }]) {
    expect(aProductoMenu({ id: 'x', data: { ...base, ...cambio } }, ahora)).toBeNull();
  }
  expect(aProductoDetalle({ id: 'x', data: { ...base, precioCOP: 0 } }, ahora)).toBeNull();
});

test('la promoción solo aplica si es válida y está vigente', () => {
  const dentro = { porcentaje: 10, desde: '2026-10-01T00:00:00Z', hasta: '2026-10-31T00:00:00Z' };
  expect(porcentajeVigente(dentro, ahora)).toBe(10);
  expect(porcentajeVigente({ porcentaje: 10, hasta: '2026-10-01T00:00:00Z' }, ahora)).toBe(0);   // vencida
  expect(porcentajeVigente({ porcentaje: 10, desde: '2026-11-01T00:00:00Z' }, ahora)).toBe(0);   // aún no empieza
  expect(porcentajeVigente({ porcentaje: 10, hasta: 'no-es-fecha' }, ahora)).toBe(0);            // fecha ilegible
  for (const porcentaje of [4, 91, 12.5, '10', null, undefined]) expect(porcentajeVigente({ porcentaje }, ahora)).toBe(0);
  expect(porcentajeVigente(null, ahora)).toBe(0);
  expect(porcentajeVigente('10', ahora)).toBe(0);
  // El precio final usa el mismo redondeo que el carrito (medio peso hacia arriba).
  expect(aProductoMenu({ id: 'r', data: { ...base, precioCOP: 1999, promocion: { porcentaje: 5 } } }, ahora)?.promocion?.precioFinalCOP).toBe(1899);
});

test('solo se aceptan fotos https, sin repetir y con un máximo', () => {
  expect(fotosPublicas(['http://x.test/a.png', 'javascript:alert(1)', 5, 'https://x.test/a.png', 'https://x.test/a.png'])).toEqual(['https://x.test/a.png']);
  expect(fotosPublicas(undefined)).toEqual([]);
  expect(fotosPublicas(Array.from({ length: 20 }, (_, i) => `https://x.test/${i}.png`))).toHaveLength(8);
  expect(aProductoMenu({ id: 'a', data: { ...base, fotos: ['http://x.test/a.png'] } }, ahora)).not.toHaveProperty('foto');
  expect(aProductoDetalle({ id: 'a', data: { nombre: 'Tinto', precioCOP: 2000 } }, ahora)).toMatchObject({ descripcion: '', fotos: [] });
});

test('el menú pone los disponibles primero, ordena por nombre y excluye lo no válido', () => {
  const doc = (id: string, nombre: string, extra: Partial<ProductoDoc> = {}) => ({ id, data: { nombre, precioCOP: 1000, disponible: true, ...extra } });
  const menu = listarMenu([doc('1', 'Zumo'), doc('2', 'Árbol', { disponible: false }), doc('3', 'Café'), doc('4', 'Oculto', { activo: false }), doc('5', 'Sin precio', { precioCOP: 0 }), doc('6', 'Agua')], ahora);
  expect(menu.map(p => p.nombre)).toEqual(['Agua', 'Café', 'Zumo', 'Árbol']);
  expect(listarMenu([], ahora)).toEqual([]);
});

test('las consultas aceptan solo identificadores seguros y campos esperados', () => {
  expect(validarConsultaMenu({ restaurantId: 'rest-burger' })).toEqual({ restaurantId: 'rest-burger' });
  expect(validarConsultaProducto({ restaurantId: 'rest-burger', productId: 'doble' })).toEqual({ restaurantId: 'rest-burger', productId: 'doble' });
  for (const malo of [null, [], 'x', {}, { restaurantId: '' }, { restaurantId: 5 }, { restaurantId: 'a/b' }, { restaurantId: '../users/x' }, { restaurantId: 'a'.repeat(129) }, { restaurantId: 'ok', extra: 1 }]) {
    expect(() => validarConsultaMenu(malo)).toThrow();
  }
  expect(() => validarConsultaProducto({ restaurantId: 'ok' })).toThrow('Selecciona un producto válido.');
  expect(() => validarConsultaProducto({ restaurantId: 'ok', productId: 'a/b' })).toThrow();
});
