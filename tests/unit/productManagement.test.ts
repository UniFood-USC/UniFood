import { test, expect } from '@jest/globals';
import {
  DESCRIPCION_MAX, FOTO_MAX_BYTES, NOMBRE_MAX, SIN_INVENTARIO,
  aProductoPropio, errorArchivoFoto, errorContenidoFoto, listarProductosPropios, referenciaFoto, revisarLineas,
  validarGuardado, validarProducto, validarRetiro, validarSubidaFoto,
} from '../../src/domain/productManagement';
import { fotosPublicas } from '../../src/domain/menu';

const foto = (n = 1) => `http://127.0.0.1:5001/demo-unifood/us-central1/api/photos/rest-burger/foto${n}`;
const valido = { nombre: 'Doble', descripcion: 'Dos carnes', precioCOP: 20000, disponible: true, fotos: [foto()] };
const errores = (input: unknown) => { const r = validarProducto(input); return r.ok ? {} : r.errores; };

test('un producto válido se acepta y se limpian los espacios', () => {
  expect(validarProducto({ ...valido, nombre: '  Doble  ', descripcion: ' Dos carnes ' })).toEqual({ ok: true, valor: valido });
});

test('exige nombre, descripción, precio, disponibilidad y fotos, cada error en su campo', () => {
  expect(Object.keys(errores({}))).toEqual(expect.arrayContaining(['nombre', 'descripcion', 'precioCOP', 'disponible', 'fotos']));
  expect(errores({ ...valido, nombre: '   ' }).nombre).toBeDefined();
  expect(errores({ ...valido, descripcion: '' }).descripcion).toBeDefined();
});

test('precio: solo enteros mayores que cero', () => {
  for (const precio of [0, -1, 12.5, NaN, Infinity, '5000', null, undefined]) expect(errores({ ...valido, precioCOP: precio }).precioCOP).toBeDefined();
  expect(errores({ ...valido, precioCOP: 1 }).precioCOP).toBeUndefined();
});

test('límites: nombre 100 y descripción 1.000 caracteres', () => {
  expect(errores({ ...valido, nombre: 'a'.repeat(NOMBRE_MAX) }).nombre).toBeUndefined();
  expect(errores({ ...valido, nombre: 'a'.repeat(NOMBRE_MAX + 1) }).nombre).toBeDefined();
  expect(errores({ ...valido, descripcion: 'a'.repeat(DESCRIPCION_MAX) }).descripcion).toBeUndefined();
  expect(errores({ ...valido, descripcion: 'a'.repeat(DESCRIPCION_MAX + 1) }).descripcion).toBeDefined();
  expect(errores({ ...valido, nombre: '🍔'.repeat(NOMBRE_MAX) }).nombre).toBeUndefined();   // un emoji cuenta como uno
});

test('disponibilidad binaria: solo booleanos y nada de inventario numérico', () => {
  for (const d of ['true', 1, 0, null, undefined]) expect(errores({ ...valido, disponible: d }).disponible).toBeDefined();
  expect(errores({ ...valido, disponible: false }).disponible).toBeUndefined();
  for (const campo of ['stock', 'cantidad', 'inventario', 'unidades']) expect(errores({ ...valido, [campo]: 10 }).general).toBe(SIN_INVENTARIO);
});

test('fotos: de 1 a 5, sin repetir y con dirección válida', () => {
  expect(errores({ ...valido, fotos: [] }).fotos).toBeDefined();                                    // cero bloquea guardar
  expect(errores({ ...valido, fotos: [1, 2, 3, 4, 5].map(foto) }).fotos).toBeUndefined();           // cinco se admiten
  expect(errores({ ...valido, fotos: [1, 2, 3, 4, 5, 6].map(foto) }).fotos).toBeDefined();          // seis se rechazan
  expect(errores({ ...valido, fotos: [foto(1), foto(1)] }).fotos).toBeDefined();
  for (const fotos of ['a.jpg', ['javascript:alert(1)'], [5], ['no es url']]) expect(errores({ ...valido, fotos }).fotos).toBeDefined();
});

test('archivo de foto: solo JPG o PNG de hasta 5 MB', () => {
  expect(errorArchivoFoto('image/jpeg', 1000)).toBeNull();
  expect(errorArchivoFoto('image/png', FOTO_MAX_BYTES)).toBeNull();
  for (const formato of ['image/gif', 'image/webp', 'application/pdf', '', undefined]) expect(errorArchivoFoto(formato, 1000)).toBeDefined();
  expect(errorArchivoFoto('image/png', FOTO_MAX_BYTES + 1)).toBe('Cada foto debe pesar 5 MB o menos.');
  expect(errorArchivoFoto('image/png', 0)).not.toBeNull();
});

test('el servicio comprueba los bytes reales, no solo el tipo declarado', () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  expect(errorContenidoFoto('image/png', png)).toBeNull();
  expect(errorContenidoFoto('image/jpeg', jpg)).toBeNull();
  expect(errorContenidoFoto('image/png', jpg)).toBeDefined();   // un JPG que se declara PNG
  expect(errorContenidoFoto('image/jpeg', Uint8Array.from([1, 2, 3, 4]))).toBeDefined();   // texto con extensión de imagen
});

test('subida de foto: formato, base64 y tamaño del cuerpo', () => {
  expect(validarSubidaFoto({ formato: 'image/png', datos: 'iVBORw0KGgo=' })).toEqual({ formato: 'image/png', datos: 'iVBORw0KGgo=' });
  for (const input of [null, {}, { formato: 'image/gif', datos: 'AAAA' }, { formato: 'image/png' }, { formato: 'image/png', datos: '' }, { formato: 'image/png', datos: 'no es base64!!' }, { formato: 'image/png', datos: 'AAAA', extra: 1 }]) {
    expect(() => validarSubidaFoto(input)).toThrow();
  }
  expect(() => validarSubidaFoto({ formato: 'image/png', datos: 'A'.repeat(Math.ceil((FOTO_MAX_BYTES * 4) / 3) + 100) })).toThrow('5 MB');
});

test('referencia de foto: solo rutas /photos/{restaurante}/{foto}', () => {
  expect(referenciaFoto(foto(7))).toEqual({ restaurantId: 'rest-burger', photoId: 'foto7' });
  expect(referenciaFoto('https://api.test/photos/rest-pizza/abc')).toEqual({ restaurantId: 'rest-pizza', photoId: 'abc' });
  for (const url of ['https://x.test/a.jpg', 'https://x.test/photos/a/b/c', 'https://x.test/photos/../x', 5, 'no es url']) expect(referenciaFoto(url)).toBeNull();
});

test('campos desconocidos y entradas que no son objeto se rechazan', () => {
  expect(errores({ ...valido, activo: false }).general).toBeDefined();
  for (const input of [null, undefined, 'x', 5, [], [valido]]) expect(validarProducto(input).ok).toBe(false);
});

test('guardar: sin id crea (sin versión); con id edita y exige versión', () => {
  expect(validarGuardado(valido)).toMatchObject({ ok: true, id: null, version: null });
  expect(validarGuardado({ ...valido, id: 'doble', version: 3 })).toMatchObject({ ok: true, id: 'doble', version: 3 });
  expect(validarGuardado({ ...valido, id: 'doble' }).ok).toBe(false);
  expect(validarGuardado({ ...valido, version: 1 }).ok).toBe(false);
  for (const id of ['', 'a/b', '../users', 7]) expect(validarGuardado({ ...valido, id, version: 1 }).ok).toBe(false);
});

test('retirar: exige id seguro y versión', () => {
  expect(validarRetiro({ id: 'doble', version: 2 })).toEqual({ id: 'doble', version: 2, restaurantId: null });
  for (const input of [{}, { id: 'a/b', version: 1 }, { id: 'doble' }, { id: 'doble', version: 0 }, { id: 'doble', version: 1, extra: 1 }, null]) expect(() => validarRetiro(input)).toThrow();
});

test('el restaurante ve sus agotados pero no los retirados ni campos privados', () => {
  const docs = [
    { id: 'b', data: { nombre: 'Beta', precioCOP: 5000, disponible: false, costoCOP: 1, fotos: ['https://x.test/b.jpg'] } },
    { id: 'a', data: { nombre: 'Alfa', precioCOP: 4000, disponible: true, version: 4 } },
    { id: 'c', data: { nombre: 'Retirado', precioCOP: 4000, disponible: false, activo: false } },
  ];
  const lista = listarProductosPropios(docs);
  expect(lista.map(p => p.id)).toEqual(['a', 'b']);
  expect(lista[1]).toEqual({ id: 'b', nombre: 'Beta', descripcion: '', precioCOP: 5000, disponible: false, fotos: ['https://x.test/b.jpg'], version: 1 });
  expect(aProductoPropio(docs[2]!)).toBeNull();
});

test('RF-06 muestra las fotos que sirve el emulador local, pero sigue rechazando http de otros sitios', () => {
  expect(fotosPublicas([foto(1), 'http://x.test/a.png', 'http://127.0.0.1/sinpuerto.png', 'https://x.test/a.png'])).toEqual([foto(1), 'https://x.test/a.png']);
});

// Criterios 7 y 10
const ahora = new Date('2026-11-16T15:00:00Z');
const docs = () => [
  { id: 'doble', data: { nombre: 'Doble', precioCOP: 20000, disponible: true, promocion: { porcentaje: 15 } } },
  { id: 'papas', data: { nombre: 'Papas', precioCOP: 6000, disponible: true } },
  { id: 'sencilla', data: { nombre: 'Sencilla', precioCOP: 14000, disponible: false } },
  { id: 'oculto', data: { nombre: 'Oculto', precioCOP: 9000, disponible: true, activo: false } },
];

test('criterio 7: un producto agotado o retirado impide la compra y se identifica', () => {
  const r = revisarLineas([{ productId: 'doble', quantity: 1 }, { productId: 'sencilla', quantity: 2 }, { productId: 'oculto', quantity: 1 }, { productId: 'fantasma', quantity: 1 }], docs(), ahora);
  expect(r).toEqual({ ok: false, noComprables: [
    { productId: 'sencilla', motivo: 'agotado' }, { productId: 'oculto', motivo: 'retirado' }, { productId: 'fantasma', motivo: 'retirado' },
  ] });
});

test('criterio 10: la línea confirmada es una copia con nombre, precio y descuento originales', () => {
  const lista = docs();
  const r = revisarLineas([{ productId: 'doble', quantity: 2 }, { productId: 'papas', quantity: 1 }], lista, ahora);
  expect(r).toEqual({ ok: true, lineas: [
    { productId: 'doble', nombre: 'Doble', precioCOP: 20000, descuentoPorcentaje: 15, precioFinalCOP: 17000, cantidad: 2 },
    { productId: 'papas', nombre: 'Papas', precioCOP: 6000, descuentoPorcentaje: 0, precioFinalCOP: 6000, cantidad: 1 },
  ] });
  if (!r.ok) throw new Error('inesperado');
  const copia = JSON.stringify(r.lineas);
  lista[0]!.data.nombre = 'Doble XL'; lista[0]!.data.precioCOP = 99999;   // editar el producto después no altera la copia
  expect(JSON.stringify(r.lineas)).toBe(copia);
});
