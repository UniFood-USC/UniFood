import { test, expect } from '@jest/globals';
import { ahoraEnColombia, aRestaurantePublico, atiendeAhora, listarRestaurantesPublicos, proximaApertura, puedeRecibirPedidoInmediato } from '../../src/domain/restaurants';
import type { EstadoRestaurante, Horario } from '../../src/types/Estado_Restaurante';

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

test('solo se listan aprobados y activos, y nunca salen campos privados', () => {
  const data = { nombre: ' Burger Campus ', logo: 'https://x.test/b.png', estado: 'aprobado', activo: true, horario: lunesSab('07:00', '20:00'), ownerEmail: 'dueno@example.test', ownerId: 'u1' } as const;
  const publico = aRestaurantePublico({ id: 'rest-burger', data }, lunes10);
  expect(publico).toEqual({ id: 'rest-burger', nombre: 'Burger Campus', logo: 'https://x.test/b.png', disponible: true });
  expect(Object.keys(publico!)).not.toContain('ownerEmail');
  for (const estado of ['pendiente', 'suspendido', 'eliminado'] as const) {
    expect(aRestaurantePublico({ id: 'x', data: { ...data, estado } }, lunes10)).toBeNull();
  }
  // Aprobado pero inactivo: tampoco se muestra.
  expect(aRestaurantePublico({ id: 'x', data: { ...data, activo: false } }, lunes10)).toBeNull();
  expect(aRestaurantePublico({ id: 'x', data: { ...data, nombre: '  ' } }, lunes10)).toBeNull();
});

test('un restaurante cerrado por horario se lista como no disponible con su próxima apertura', () => {
  const base = { nombre: 'Sazón USC', estado: 'aprobado', activo: true } as const;
  expect(aRestaurantePublico({ id: 'a', data: { ...base, horario: lunesSab('12:00', '15:00') } }, lunes10))
    .toEqual({ id: 'a', nombre: 'Sazón USC', disponible: false, proximaApertura: 'Hoy 12:00' });
  // Sin ninguna apertura en la semana: cerrado y sin próxima apertura.
  expect(aRestaurantePublico({ id: 'b', data: { ...base, horario: {} } }, lunes10))
    .toEqual({ id: 'b', nombre: 'Sazón USC', disponible: false });
  // Sin horario definido se considera que atiende.
  expect(aRestaurantePublico({ id: 'c', data: base }, lunes10)).toEqual({ id: 'c', nombre: 'Sazón USC', disponible: true });
});

test('el logo solo se acepta como https', () => {
  const data = { nombre: 'Café', estado: 'aprobado', activo: true } as const;
  expect(aRestaurantePublico({ id: 'a', data: { ...data, logo: 'http://x.test/l.png' } }, lunes10)).not.toHaveProperty('logo');
  expect(aRestaurantePublico({ id: 'a', data: { ...data, logo: 'javascript:alert(1)' } }, lunes10)).not.toHaveProperty('logo');
});

test('el listado incluye cerrados, pone los abiertos primero y excluye inactivos y no aprobados', () => {
  const doc = (id: string, nombre: string, opts: { cerrado?: boolean; activo?: boolean; estado?: EstadoRestaurante } = {}) => ({
    id,
    data: { nombre, estado: opts.estado ?? 'aprobado', activo: opts.activo ?? true, ...(opts.cerrado ? { horario: lunesSab('12:00', '15:00') } : {}) },
  });
  const lista = listarRestaurantesPublicos([
    doc('1', 'Zeta'), doc('2', 'Árbol', { cerrado: true }), doc('3', 'Beta'), doc('4', 'Alfa'), doc('5', 'Omega', { cerrado: true }), doc('6', 'Delta'),
    doc('7', 'Pendiente', { estado: 'pendiente' }), doc('8', 'Suspendido', { estado: 'suspendido' }), doc('9', 'Eliminado', { estado: 'eliminado' }),
    doc('10', 'Inactivo', { activo: false }),
  ], lunes10);
  expect(lista.map(r => r.nombre)).toEqual(['Alfa', 'Beta', 'Delta', 'Zeta', 'Árbol', 'Omega']);
  expect(lista.filter(r => !r.disponible).every(r => r.proximaApertura === 'Hoy 12:00')).toBe(true);
  expect(lista.length).toBeGreaterThanOrEqual(5);
});

test('un restaurante cerrado, inactivo o no aprobado no recibe pedidos inmediatos', () => {
  const abierto = { nombre: 'Pizza Zona', estado: 'aprobado', activo: true, horario: lunesSab('10:00', '18:00') } as const;
  expect(puedeRecibirPedidoInmediato(abierto, lunes10)).toBe(true);
  expect(puedeRecibirPedidoInmediato(abierto, new Date('2026-10-19T23:00:00Z'))).toBe(false); // cierra 18:00
  expect(puedeRecibirPedidoInmediato({ ...abierto, activo: false }, lunes10)).toBe(false);
  expect(puedeRecibirPedidoInmediato({ ...abierto, estado: 'suspendido' }, lunes10)).toBe(false);
});

test('sin establecimientos aprobados y activos el listado queda vacío', () => {
  expect(listarRestaurantesPublicos([], lunes10)).toEqual([]);
  expect(listarRestaurantesPublicos([{ id: 'p', data: { nombre: 'Nuevo', estado: 'pendiente', activo: true } }], lunes10)).toEqual([]);
  expect(listarRestaurantesPublicos([{ id: 'i', data: { nombre: 'Inactivo', estado: 'aprobado', activo: false } }], lunes10)).toEqual([]);
});
