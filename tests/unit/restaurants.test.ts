import { test, expect } from '@jest/globals';
import { ahoraEnColombia, aRestaurantePublico, atiendeAhora, listarRestaurantesPublicos, proximaApertura } from '../../src/domain/restaurants';
import type { Horario } from '../../src/types/Estado_Restaurante';

// 2026-10-19 es lunes. Colombia es UTC-5: 15:00Z = 10:00 en Bogotá.
const lunes10 = new Date('2026-10-19T15:00:00Z');
const lunesSab = (abre: string, cierra: string): Horario => Object.fromEntries(
  ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'].map(d => [d, { abre, cierra }]));

test('la hora y el día se leen en Colombia, no en UTC', () => {
  expect(ahoraEnColombia(lunes10)).toEqual({ dia: 1, minutos: 600 });
  // 03:00Z del martes sigue siendo lunes 22:00 en Colombia.
  expect(ahoraEnColombia(new Date('2026-10-20T03:00:00Z'))).toEqual({ dia: 1, minutos: 1320 });
});

test('atiende ahora: abre inclusive, cierra exclusive y días sin tramo', () => {
  const horario = lunesSab('10:00', '18:00');
  expect(atiendeAhora(horario, lunes10)).toBe(true);
  expect(atiendeAhora(horario, new Date('2026-10-19T14:59:00Z'))).toBe(false);
  expect(atiendeAhora(horario, new Date('2026-10-19T23:00:00Z'))).toBe(false); // 18:00 exacto
  expect(atiendeAhora(horario, new Date('2026-10-18T15:00:00Z'))).toBe(false); // domingo, no atiende
  expect(atiendeAhora({ lunes: null }, lunes10)).toBe(false);
  expect(atiendeAhora({ lunes: { abre: '18:00', cierra: '10:00' } }, lunes10)).toBe(false); // tramo inválido
  expect(atiendeAhora({ lunes: { abre: '9:00', cierra: '18:00' } }, lunes10)).toBe(false); // formato inválido
});

test('próxima apertura: hoy, mañana o el día que vuelve a abrir', () => {
  const horario = lunesSab('11:00', '21:00');
  expect(proximaApertura(horario, lunes10)).toBe('Hoy 11:00');
  expect(proximaApertura(horario, new Date('2026-10-20T03:00:00Z'))).toBe('Mañana 11:00'); // lunes 22:00
  expect(proximaApertura(horario, new Date('2026-10-25T01:00:00Z'))).toBe('Lunes 11:00'); // sábado 20:00 -> domingo cerrado
  expect(proximaApertura({}, lunes10)).toBeUndefined();
});

test('solo se listan restaurantes aprobados y nunca salen campos privados', () => {
  const data = { nombre: ' Burger Campus ', logo: 'https://x.test/b.png', estado: 'aprobado', activo: true, horario: lunesSab('07:00', '20:00'), ownerEmail: 'dueno@example.test', ownerId: 'u1' } as const;
  const publico = aRestaurantePublico({ id: 'rest-burger', data }, lunes10);
  expect(publico).toEqual({ id: 'rest-burger', nombre: 'Burger Campus', logo: 'https://x.test/b.png', disponible: true });
  expect(Object.keys(publico!)).not.toContain('ownerEmail');
  for (const estado of ['pendiente', 'suspendido', 'eliminado'] as const) {
    expect(aRestaurantePublico({ id: 'x', data: { ...data, estado } }, lunes10)).toBeNull();
  }
  expect(aRestaurantePublico({ id: 'x', data: { ...data, nombre: '  ' } }, lunes10)).toBeNull();
});

test('disponibilidad: fuera de horario, desactivado y sin horario', () => {
  const base = { nombre: 'Sazón USC', estado: 'aprobado', activo: true } as const;
  const cerrado = aRestaurantePublico({ id: 'a', data: { ...base, horario: lunesSab('12:00', '15:00') } }, lunes10);
  expect(cerrado).toEqual({ id: 'a', nombre: 'Sazón USC', disponible: false, proximaApertura: 'Hoy 12:00' });
  const apagado = aRestaurantePublico({ id: 'b', data: { ...base, activo: false, horario: lunesSab('07:00', '20:00') } }, lunes10);
  expect(apagado).toEqual({ id: 'b', nombre: 'Sazón USC', disponible: false }); // sin próxima apertura
  expect(aRestaurantePublico({ id: 'c', data: base }, lunes10)).toEqual({ id: 'c', nombre: 'Sazón USC', disponible: true });
});

test('el logo solo se acepta como https', () => {
  const data = { nombre: 'Café', estado: 'aprobado', activo: true } as const;
  expect(aRestaurantePublico({ id: 'a', data: { ...data, logo: 'http://x.test/l.png' } }, lunes10)).not.toHaveProperty('logo');
  expect(aRestaurantePublico({ id: 'a', data: { ...data, logo: 'javascript:alert(1)' } }, lunes10)).not.toHaveProperty('logo');
});

test('el listado ordena disponibles primero y luego por nombre, con más de 5 restaurantes', () => {
  const doc = (id: string, nombre: string, activo = true, estado = 'aprobado') => ({ id, data: { nombre, estado, activo } as const });
  const lista = listarRestaurantesPublicos([
    doc('1', 'Zeta'), doc('2', 'Árbol', false), doc('3', 'Beta'), doc('4', 'Alfa'), doc('5', 'Omega', false), doc('6', 'Delta'),
    doc('7', 'Pendiente', true, 'pendiente'),
  ], lunes10);
  expect(lista.map(r => r.nombre)).toEqual(['Alfa', 'Beta', 'Delta', 'Zeta', 'Árbol', 'Omega']);
  expect(lista.length).toBeGreaterThanOrEqual(5);
});

test('sin restaurantes aprobados el listado queda vacío', () => {
  expect(listarRestaurantesPublicos([], lunes10)).toEqual([]);
  expect(listarRestaurantesPublicos([{ id: 'p', data: { nombre: 'Nuevo', estado: 'pendiente', activo: true } }], lunes10)).toEqual([]);
});
