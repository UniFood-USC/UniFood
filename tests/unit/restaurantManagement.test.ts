import { expect, test } from '@jest/globals';
import {
  accionesPermitidas, aRestauranteGestion, esRelacionUnoAUno, reaperturaAISO, validarCierresEspeciales, validarCierreTemporal, validarHorario,
  validarInformacion, validarRechazo, validarRegistroRestaurante,
} from '../../src/domain/restaurantManagement';

// RF-22 · Definir establecimiento y validaciones.
const valido = {
  nombre: 'Café Sol', descripcion: 'Café y pan', ubicacion: 'Bloque B, piso 1', telefono: '+57 300 123 4567', correo: 'Dueno@Ejemplo.com',
  password: 'Clave1234', confirmPassword: 'Clave1234', horario: { lunes: { abre: '08:00', cierra: '18:00' } },
};
const errores = (entrada: unknown) => { const r = validarRegistroRestaurante(entrada); return r.ok ? {} : r.errores; };

test('el registro exige nombre, descripción, ubicación, horario, teléfono, correo y contraseña', () => {
  expect(validarRegistroRestaurante(valido).ok).toBe(true);
  expect(Object.keys(errores({}))).toEqual(expect.arrayContaining(['nombre', 'descripcion', 'ubicacion', 'horario', 'telefono', 'correo', 'password']));
  for (const campo of ['nombre', 'descripcion', 'ubicacion', 'horario', 'telefono', 'correo', 'password']) {
    expect(Object.keys(errores({ ...valido, [campo]: undefined }))).toContain(campo);
  }
});

test('acepta correos de cualquier dominio y los normaliza', () => {
  const r = validarRegistroRestaurante(valido);
  expect(r.ok && r.datos.correo).toBe('dueno@ejemplo.com');
});

test('nombre hasta 100 caracteres y descripción hasta 1.000 (un emoji cuenta como uno)', () => {
  expect(validarRegistroRestaurante({ ...valido, nombre: 'a'.repeat(100) }).ok).toBe(true);
  expect(errores({ ...valido, nombre: 'a'.repeat(101) }).nombre).toMatch(/100/);
  expect(validarRegistroRestaurante({ ...valido, descripcion: '🍔'.repeat(1000) }).ok).toBe(true);
  expect(errores({ ...valido, descripcion: 'a'.repeat(1001) }).descripcion).toMatch(/1\.000/);
  expect(validarInformacion({ nombre: 'a'.repeat(101), descripcion: 'x', ubicacion: 'x', telefono: '3001234567' }).ok).toBe(false);
});

test('el registro no permite asignar rol, estado ni propietario', () => {
  for (const extra of [{ role: 'admin' }, { estado: 'aprobado' }, { ownerId: 'x' }, { restaurantId: 'rest-burger' }]) {
    expect(errores({ ...valido, ...extra }).general).toMatch(/no permite/);
  }
});

test('contraseña débil o distinta se asocia a su campo', () => {
  expect(errores({ ...valido, password: 'corta', confirmPassword: 'corta' }).password).toBeTruthy();
  expect(errores({ ...valido, confirmPassword: 'Otra1234' }).confirmPassword).toMatch(/no coinciden/);
});

test('horarios: por día, medianoche, sin días y con horas inválidas', () => {
  expect(validarHorario({ viernes: { abre: '20:00', cierra: '02:00' }, lunes: null }).ok).toBe(true);
  expect(validarHorario({}).ok).toBe(false);
  expect(validarHorario({ lunes: { abre: '08:00', cierra: '08:00' } }).ok).toBe(false);
  expect(validarHorario({ lunes: { abre: '8:00', cierra: '18:00' } }).ok).toBe(false);
  expect(validarHorario({ lunez: { abre: '08:00', cierra: '18:00' } }).ok).toBe(false);
});

test('cierres especiales: fecha real, sin repetidos y ordenados', () => {
  const ok = validarCierresEspeciales([{ fecha: '2026-12-25', motivo: ' Navidad ' }, { fecha: '2026-12-24' }]);
  expect(ok.ok && ok.cierres).toEqual([{ fecha: '2026-12-24' }, { fecha: '2026-12-25', motivo: 'Navidad' }]);
  expect(validarCierresEspeciales([{ fecha: '2026-02-30' }]).ok).toBe(false);
  expect(validarCierresEspeciales([{ fecha: '2026-12-25' }, { fecha: '2026-12-25' }]).ok).toBe(false);
});

test('todo cierre temporal requiere una fecha de reapertura futura', () => {
  const ahora = new Date('2026-10-19T15:00:00Z');
  expect(validarCierreTemporal({}, ahora).ok).toBe(false);
  expect(validarCierreTemporal({ hasta: 'no es fecha' }, ahora).ok).toBe(false);
  expect(validarCierreTemporal({ hasta: '2026-10-19T14:00:00Z' }, ahora).ok).toBe(false);
  expect(validarCierreTemporal({ hasta: '2026-10-19T20:00:00Z' }, ahora).ok).toBe(true);
  expect(reaperturaAISO('2026-10-19 15:00')).toBe('2026-10-19T20:00:00.000Z');
  expect(reaperturaAISO('2026-02-30 15:00')).toBeNull();
});

test('rechazar exige motivo', () => {
  expect(validarRechazo('  ').ok).toBe(false);
  expect(validarRechazo(undefined).ok).toBe(false);
  expect(validarRechazo(' Falta la ubicación ')).toEqual({ ok: true, motivo: 'Falta la ubicación' });
});

test('transiciones: pendiente se revisa; aprobado se suspende; suspendido se reactiva; eliminado es final', () => {
  expect(accionesPermitidas('pendiente')).toEqual(['aprobar', 'rechazar', 'eliminar']);
  expect(accionesPermitidas('aprobado')).toEqual(['suspender', 'eliminar']);
  expect(accionesPermitidas('suspendido')).toEqual(['reactivar', 'eliminar']);
  expect(accionesPermitidas('rechazado')).toEqual(['eliminar']);
  expect(accionesPermitidas('eliminado')).toEqual([]);
});

test('relación uno a uno entre cuenta y establecimiento', () => {
  expect(esRelacionUnoAUno([{ id: 'r1', ownerId: 'u1' }], [{ id: 'u1', restaurantId: 'r1' }])).toBe(true);
  expect(esRelacionUnoAUno([{ id: 'r1', ownerId: 'u1' }, { id: 'r2', ownerId: 'u1' }], [{ id: 'u1', restaurantId: 'r1' }])).toBe(false);
  expect(esRelacionUnoAUno([{ id: 'r1', ownerId: 'u1' }], [{ id: 'u1', restaurantId: 'r1' }, { id: 'u2', restaurantId: 'r1' }])).toBe(false);
});

test('la vista de gestión no expone el dueño y calcula la condición vigente', () => {
  const ahora = new Date('2026-10-19T15:00:00Z');
  const vista = aRestauranteGestion('r', { nombre: 'A', estado: 'aprobado', activo: true, ownerId: 'u', horario: { lunes: { abre: '10:00', cierra: '18:00' } } }, ahora)!;
  expect(vista.condicion).toBe('abierto');
  expect(Object.keys(vista)).not.toContain('ownerId');
  expect(aRestauranteGestion('r', { nombre: 'A', estado: 'rechazado', motivoRechazo: 'Falta X' }, ahora)).toMatchObject({ condicion: 'rechazado', motivoRechazo: 'Falta X' });
});
