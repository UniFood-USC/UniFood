import { expect, test } from '@jest/globals';
import { aRestaurantePublico, estadoDeAtencion, puedeRecibirPedidoInmediato } from '../../src/domain/restaurants';
import type { Horario } from '../../src/types/Estado_Restaurante';

// RF-22 · Abierto y próxima apertura: horario normal, franja que cruza medianoche, cierres especiales y cierre temporal.
// 2026-10-19 es lunes; Colombia es UTC-5 (15:00Z = 10:00).
const en = (iso: string) => new Date(iso);
const lunesAViernes: Horario = Object.fromEntries(['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].map(d => [d, { abre: '10:00', cierra: '18:00' }]));
const noche: Horario = { viernes: { abre: '20:00', cierra: '02:00' } };

test('horario normal: abre inclusive, cierra exclusive y próxima apertura', () => {
  expect(estadoDeAtencion({ horario: lunesAViernes }, en('2026-10-19T15:00:00Z'))).toMatchObject({ disponible: true });
  expect(estadoDeAtencion({ horario: lunesAViernes }, en('2026-10-19T14:59:00Z'))).toMatchObject({ disponible: false, proximaApertura: 'Hoy 10:00' });
  expect(estadoDeAtencion({ horario: lunesAViernes }, en('2026-10-19T23:00:00Z'))).toMatchObject({ disponible: false, proximaApertura: 'Mañana 10:00' });
  expect(estadoDeAtencion({ horario: lunesAViernes }, en('2026-10-24T17:00:00Z'))).toMatchObject({ disponible: false, proximaApertura: 'Lunes 10:00' }); // sábado
});

test('franja que cruza la medianoche: pertenece al día en que abre', () => {
  expect(estadoDeAtencion({ horario: noche }, en('2026-10-24T00:59:00Z')).disponible).toBe(false);  // vie 19:59
  expect(estadoDeAtencion({ horario: noche }, en('2026-10-24T01:00:00Z')).disponible).toBe(true);   // vie 20:00
  expect(estadoDeAtencion({ horario: noche }, en('2026-10-24T06:59:00Z')).disponible).toBe(true);   // sáb 01:59
  expect(estadoDeAtencion({ horario: noche }, en('2026-10-24T07:00:00Z'))).toMatchObject({ disponible: false, proximaApertura: 'Viernes 20:00' }); // sáb 02:00
});

test('cierre especial: el día completo no atiende y una franja nocturna se corta a la medianoche', () => {
  const cierre = (fecha: string) => ({ horario: noche, cierresEspeciales: [{ fecha }] });
  expect(estadoDeAtencion(cierre('2026-10-23'), en('2026-10-24T02:00:00Z')).disponible).toBe(false); // vie 21:00, día cerrado
  expect(estadoDeAtencion(cierre('2026-10-24'), en('2026-10-24T04:30:00Z')).disponible).toBe(true);  // vie 23:30, aún abierto
  expect(estadoDeAtencion(cierre('2026-10-24'), en('2026-10-24T05:00:00Z')).disponible).toBe(false); // sáb 00:00, día cerrado
  expect(estadoDeAtencion({ horario: lunesAViernes, cierresEspeciales: [{ fecha: '2026-10-19' }] }, en('2026-10-19T15:00:00Z'))).toMatchObject({ disponible: false, proximaApertura: 'Mañana 10:00' });
});

test('cierre temporal: cerrado hasta la reapertura y luego vuelve solo al horario habitual', () => {
  const hasta = '2026-10-19T20:00:00Z'; // lunes 15:00
  const config = { horario: lunesAViernes, cierreTemporal: { hasta } };
  expect(estadoDeAtencion(config, en('2026-10-19T15:00:00Z'))).toMatchObject({ disponible: false, cierreTemporal: true, proximaApertura: 'Hoy 15:00' });
  expect(estadoDeAtencion(config, en('2026-10-19T19:59:00Z')).disponible).toBe(false);
  expect(estadoDeAtencion(config, en(hasta))).toMatchObject({ disponible: true, cierreTemporal: false });
});

test('si el cierre temporal termina fuera de horario, sigue cerrado hasta la próxima apertura', () => {
  const config = { horario: lunesAViernes, cierreTemporal: { hasta: '2026-10-20T00:00:00Z' } }; // lunes 19:00
  expect(estadoDeAtencion(config, en('2026-10-20T00:00:00Z'))).toMatchObject({ disponible: false, cierreTemporal: false, proximaApertura: 'Mañana 10:00' });
  expect(estadoDeAtencion(config, en('2026-10-19T15:00:00Z'))).toMatchObject({ cierreTemporal: true, proximaApertura: 'Mañana 10:00' });
});

test('un restaurante suspendido no opera aunque el cierre temporal ya haya terminado', () => {
  const data = { nombre: 'A', activo: true, horario: lunesAViernes, cierreTemporal: { hasta: '2026-10-19T14:00:00Z' } } as const;
  const ahora = en('2026-10-19T15:00:00Z');
  expect(puedeRecibirPedidoInmediato({ ...data, estado: 'aprobado' }, ahora)).toBe(true);
  for (const estado of ['suspendido', 'pendiente', 'rechazado', 'eliminado'] as const) {
    expect(puedeRecibirPedidoInmediato({ ...data, estado }, ahora)).toBe(false);
    expect(aRestaurantePublico({ id: 'x', data: { ...data, estado } }, ahora)).toBeNull();
  }
});

test('la vista pública marca el cierre temporal y nunca copia datos privados', () => {
  const publico = aRestaurantePublico({ id: 'r', data: { nombre: 'A', estado: 'aprobado', activo: true, horario: lunesAViernes, cierreTemporal: { hasta: '2026-10-19T20:00:00Z' }, correo: 'x@y.co', telefono: '3000000000', ownerId: 'u' } }, en('2026-10-19T15:00:00Z'));
  expect(publico).toEqual({ id: 'r', nombre: 'A', disponible: false, proximaApertura: 'Hoy 15:00', cierreTemporal: true });
});
