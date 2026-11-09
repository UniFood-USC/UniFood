import { test, expect } from '@jest/globals';
import { aProductoDetalle, formatCOP, listarMenu } from '../../src/domain/menu';
import { menusDemo, privado } from '../../scripts/menuDemoData';

// RF-06 · Los datos de ejemplo del seed deben poder demostrar cada criterio de aceptación.
// Si alguien los cambia y deja la app sin productos, estas pruebas lo detectan.
const ahora = new Date('2026-10-19T15:00:00Z');
const VISIBLES = ['rest-burger', 'rest-pizza', 'rest-sazon', 'rest-cafe', 'rest-fruta', 'rest-arepas']; // los 6 de RF-04
const guardados = (restaurantId: string) => menusDemo[restaurantId].map(({ id, ...data }) => ({ id, data: { ...data, ...privado } }));
const menu = (restaurantId: string) => listarMenu(guardados(restaurantId), ahora);

test('hay menú de ejemplo para los 6 restaurantes que ve el estudiante, y solo para ellos', () => {
  expect(Object.keys(menusDemo).sort()).toEqual([...VISIBLES].sort());
});

test('criterio 1: los restaurantes con menú muestran productos con nombre y precio en pesos', () => {
  const conProductos = VISIBLES.filter(id => menu(id).length > 0);
  expect(conProductos.length).toBeGreaterThanOrEqual(5);
  expect(menu('rest-burger').length).toBeGreaterThanOrEqual(3);
  for (const id of conProductos) {
    for (const producto of menu(id)) {
      expect(producto.nombre.length).toBeGreaterThan(0);
      expect(Number.isInteger(producto.precioCOP) && producto.precioCOP > 0).toBe(true);
      expect(formatCOP(producto.precioCOP)).toMatch(/^\$\d{1,3}(\.\d{3})*$/);
    }
  }
  expect(formatCOP(20000)).toBe('$20.000');
});

test('criterio 2: cada menú contiene únicamente los productos de su restaurante', () => {
  const porRestaurante = VISIBLES.map(id => ({ id, productos: menu(id).map(p => p.id) }));
  for (const { id, productos } of porRestaurante) {
    const propios = menusDemo[id].map(p => p.id);
    expect(productos.every(producto => propios.includes(producto))).toBe(true);
  }
  expect(menu('rest-pizza').map(p => p.id).sort()).toEqual(['margarita', 'pepperoni', 'porcion']);
  expect(menu('rest-burger').map(p => p.id)).not.toContain('margarita');
});

test('criterio 3: el detalle cubre descripción, varias fotos, disponible, agotado y promoción', () => {
  const detalle = (restaurantId: string, productId: string) => {
    const doc = guardados(restaurantId).find(p => p.id === productId)!;
    return aProductoDetalle(doc, ahora);
  };
  const doble = detalle('rest-burger', 'doble')!;
  expect(doble.descripcion.length).toBeGreaterThan(0);
  expect(doble.fotos).toHaveLength(3);
  expect(doble.disponible).toBe(true);
  expect(doble.promocion).toEqual({ porcentaje: 15, precioFinalCOP: 17000 });
  expect(detalle('rest-burger', 'sencilla')!.disponible).toBe(false);           // agotado
  expect(detalle('rest-burger', 'combo')!.promocion).toBeUndefined();            // promoción vencida
  expect(detalle('rest-cafe', 'tinto')).toMatchObject({ descripcion: '', fotos: [] }); // sin fotos ni descripción
  expect(detalle('rest-burger', 'oculto')).toBeNull();                           // oculto: no se consulta
  expect(menu('rest-burger').map(p => p.id)).not.toContain('oculto');
});

test('criterio 4: Fruta Fresca no tiene productos y su menú sale vacío', () => {
  expect(menusDemo['rest-fruta']).toEqual([]);
  expect(menu('rest-fruta')).toEqual([]);
});

test('los campos privados del producto nunca salen en el menú ni en el detalle', () => {
  for (const id of VISIBLES) {
    for (const producto of menu(id)) expect(Object.keys(producto)).not.toContain('costoCOP');
  }
  const doc = guardados('rest-burger').find(p => p.id === 'doble')!;
  expect(Object.keys(aProductoDetalle(doc, ahora)!)).not.toContain('notaInterna');
});
