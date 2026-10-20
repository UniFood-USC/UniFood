import { test, expect } from '@jest/globals';
import { buscarRestaurantes, normalizarTexto } from '../../src/domain/restaurantSearch';
import type { RestaurantePublico } from '../../src/types/Estado_Restaurante';

// Listado como lo entrega el RF-04: aprobados y activos, abiertos primero y cerrados incluidos.
const lista: RestaurantePublico[] = [
  { id: 'rest-burger', nombre: 'Burger Campus', disponible: true },
  { id: 'rest-pizza', nombre: 'Pizza Zona', disponible: true },
  { id: 'rest-fruta', nombre: 'Fruta Fresca', disponible: true },
  { id: 'rest-sazon', nombre: 'Sazón USC', disponible: false, proximaApertura: 'Mañana 06:30' },
  { id: 'rest-cafe', nombre: 'Café Universitario', disponible: false, proximaApertura: 'Hoy 14:00' },
  { id: 'rest-wok', nombre: 'Wok Express', disponible: false },
];
const ids = (rs: RestaurantePublico[]) => rs.map(r => r.id);

test('normalizar: tildes, mayúsculas y espacios equivalen', () => {
  expect(normalizarTexto('  CAFÉ   Universitario ')).toBe('cafe universitario');
  expect(normalizarTexto('Sazón')).toBe('sazon');
  expect(normalizarTexto('ÁÉÍÓÚ')).toBe('aeiou');
});

test('un restaurante existente aparece entre los resultados (nombre completo)', () => {
  expect(ids(buscarRestaurantes(lista, 'Burger Campus'))).toEqual(['rest-burger']);
});

test('admite coincidencias parciales (inicio, medio y final del nombre)', () => {
  expect(ids(buscarRestaurantes(lista, 'pizz'))).toEqual(['rest-pizza']);
  expect(ids(buscarRestaurantes(lista, 'resc'))).toEqual(['rest-fruta']);
  expect(ids(buscarRestaurantes(lista, 'press'))).toEqual(['rest-wok']);
  expect(ids(buscarRestaurantes(lista, 'campus'))).toEqual(['rest-burger']);
});

test('no distingue mayúsculas', () => {
  expect(buscarRestaurantes(lista, 'BURGER')).toEqual(buscarRestaurantes(lista, 'burger'));
  expect(ids(buscarRestaurantes(lista, 'wOk'))).toEqual(['rest-wok']);
});

test('no distingue tildes, en ambos sentidos', () => {
  expect(ids(buscarRestaurantes(lista, 'sazon'))).toEqual(['rest-sazon']);
  expect(ids(buscarRestaurantes(lista, 'sazón'))).toEqual(['rest-sazon']);
  expect(ids(buscarRestaurantes(lista, 'cafe'))).toEqual(['rest-cafe']);
  expect(ids(buscarRestaurantes(lista, 'CAFÉ'))).toEqual(['rest-cafe']);
});

test('los restaurantes cerrados también se encuentran', () => {
  const [cafe] = buscarRestaurantes(lista, 'cafe');
  expect(cafe).toMatchObject({ disponible: false, proximaApertura: 'Hoy 14:00' });
});

test('texto vacío o solo espacios devuelve todo el listado, cerrados incluidos', () => {
  expect(buscarRestaurantes(lista, '')).toEqual(lista);
  expect(buscarRestaurantes(lista, '    ')).toEqual(lista);
  expect(buscarRestaurantes(lista, '')).not.toBe(lista); // copia: no muta el original
});

test('una consulta sin coincidencias devuelve vacío', () => {
  expect(buscarRestaurantes(lista, 'sushi')).toEqual([]);
  expect(buscarRestaurantes([], 'pizza')).toEqual([]);
});

test('conserva el orden del listado y no modifica el original', () => {
  const copia = structuredClone(lista);
  expect(ids(buscarRestaurantes(lista, 'a'))).toEqual(['rest-burger', 'rest-pizza', 'rest-fruta', 'rest-sazon', 'rest-cafe']);
  expect(lista).toEqual(copia);
});

test('un restaurante no aprobado o inactivo no puede aparecer porque el listado base no lo trae', () => {
  // Esa regla es del RF-04 (aRestaurantePublico); la búsqueda solo filtra lo que recibe.
  expect(buscarRestaurantes(lista.filter(r => r.id !== 'rest-pizza'), 'pizza')).toEqual([]);
});
