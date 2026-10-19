import { validateRegistration, normalizeEmail } from '../../src/domain/registration';
import { test, expect } from '@jest/globals';

const valid = { name: ' Estudiante Demo ', email: ' DEMO@USC.EDU.CO ', password: 'Demo1234', confirmPassword: 'Demo1234' };

test('normaliza correo y nombre sin cambiar la contraseña', () => {
  expect(normalizeEmail(valid.email)).toBe('demo@usc.edu.co');
  expect(validateRegistration(valid, 'student')).toEqual({ name: 'Estudiante Demo', email: 'demo@usc.edu.co', password: 'Demo1234' });
});

test.each(['demo@gmail.com', 'demo@sub.usc.edu.co', 'demo@usc.edu.co.evil', 'demo@@usc.edu.co', 'a b@usc.edu.co'])('rechaza correo estudiantil %s', email => {
  expect(() => validateRegistration({ ...valid, email }, 'student')).toThrow();
});

test.each(['short1', 'abcdefgh', '12345678', ''])('rechaza contraseña inválida %s', password => {
  expect(() => validateRegistration({ ...valid, password, confirmPassword: password }, 'student')).toThrow();
});

test('rechaza nombre vacío y confirmación distinta', () => {
  expect(() => validateRegistration({ ...valid, name: '  ' }, 'student')).toThrow();
  expect(() => validateRegistration({ ...valid, confirmPassword: 'Otra1234' }, 'student')).toThrow();
});

test.each(['restaurant', 'admin'] as const)('valida otros dominios para %s sin otorgar ese rol', role => {
  expect(validateRegistration({ ...valid, email: 'demo@example.test' }, role).email).toBe('demo@example.test');
});

test('rechaza entradas no estructuradas', () => {
  for (const value of [null, [], 'demo', { ...valid, password: 12345678 }]) {
    expect(() => validateRegistration(value, 'student')).toThrow();
  }
});
