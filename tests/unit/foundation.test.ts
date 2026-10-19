import { createClock, colombiaTime } from '../../src/domain/clock';
import { test, expect } from '@jest/globals';
import { response } from '../../src/domain/response';
import { roleDestination } from '../../src/domain/navigation';

test('el reloj se controla sin esperar y Colombia conserva el mismo instante', () => {
  let now = Date.parse('2026-10-04T15:00:00Z');
  const clock = createClock(() => now);
  expect(clock.now().toISOString()).toBe('2026-10-04T15:00:00.000Z');
  expect(colombiaTime(clock.now())).toBe('10:00');
  now += 30 * 60 * 1000;
  expect(colombiaTime(clock.now())).toBe('10:30');
});

test('respuestas diferencian éxito, validación, conflicto y pendiente', () => {
  expect(response('OK', 'Consulta lista.', [])).toMatchObject({ resultado: 'exito', datos: [], recuperable: false });
  expect(response('VALIDACION', 'Revisa los campos.')).toMatchObject({ resultado: 'error', datos: null });
  expect(response('CORREO_EN_USO', 'Correo ocupado.')).toMatchObject({ resultado: 'conflicto' });
  expect(response('EN_PROCESO', 'Estamos verificando.', null, true)).toMatchObject({ resultado: 'pendiente', recuperable: true });
});

test('cada rol tiene una entrada y un rol desconocido no obtiene acceso', () => {
  expect(roleDestination('student')).toBe('/student');
  expect(roleDestination('restaurant')).toBe('/restaurant');
  expect(roleDestination('admin')).toBe('/admin');
  expect(roleDestination('inventado')).toBeNull();
});

test('el contrato transversal conserva conflictos de versión y confirmaciones inciertas', () => {
  expect(response('CONFLICTO_VERSION', 'Consulta la versión actual.', { version: 2 })).toMatchObject({ resultado: 'conflicto', datos: { version: 2 } });
  expect(response('CONFIRMACION_INCIERTA', 'Estamos verificando tu pedido', null, true)).toMatchObject({ resultado: 'pendiente', recuperable: true });
});
