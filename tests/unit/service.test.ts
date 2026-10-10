import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { callService } from '../../src/services/client';
import { response } from '../../src/domain/response';
import { registerStudent } from '../../src/services/registration';
import { signInWithCustomToken, signOut } from 'firebase/auth';

const mockGetIdToken = jest.fn<() => Promise<string>>();
jest.mock('../../src/services/firebase', () => ({ localFirebase: () => ({
  auth: { currentUser: { getIdToken: mockGetIdToken } },
  baseUrl: 'http://127.0.0.1:5001/demo-unifood/us-central1/api', ready: Promise.resolve(),
}) }));
jest.mock('firebase/auth', () => ({ signInWithCustomToken: jest.fn(), signOut: jest.fn() }));
const originalFetch = global.fetch;
const mockFetch = jest.fn<typeof fetch>();
beforeEach(() => { global.fetch = mockFetch as typeof fetch; mockFetch.mockReset(); mockGetIdToken.mockResolvedValue('verified-token'); });
afterEach(() => { global.fetch = originalFetch; });

test.each(['SESION_REQUERIDA', 'ACCESO_BLOQUEADO'] as const)('%s limpia Auth para retirar vistas privadas', async code => {
  mockFetch.mockResolvedValue({ ok: false, json: async () => response(code, 'Acceso rechazado.') } as Response);
  expect((await callService('identity', {})).codigo).toBe(code);
  expect(signOut).toHaveBeenCalledTimes(1);
});

test('token ya invalidado por el SDK limpia la sesión sin enviar la operación', async () => {
  mockGetIdToken.mockRejectedValue({ code: 'auth/user-token-expired' });
  expect((await callService('identity', {})).codigo).toBe('SESION_REQUERIDA');
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(mockFetch).not.toHaveBeenCalled();
});

test('el acceso común envía token de sesión y preserva errores autorizados HTTP', async () => {
  const denied = response('NO_AUTORIZADO', 'No tienes permiso.');
  mockFetch.mockResolvedValue({ ok: false, status: 403, json: async () => denied } as Response);
  await expect(callService('identity', {})).resolves.toEqual(denied);
  expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/identity'), expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Bearer verified-token' }),
  }));
});

test('registro público no adjunta la sesión de otra cuenta y solo devuelve identidad pública', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => response('OK', 'Cuenta creada.', { token: 'custom-token', profile: { id: 'new-student' } }) } as Response);
  const input = { name: 'Demo', email: 'demo@usc.edu.co', password: 'Demo1234', confirmPassword: 'Demo1234' };
  await expect(registerStudent(input)).resolves.toEqual(response('OK', 'Cuenta creada.', { id: 'new-student' }));
  expect(mockGetIdToken).not.toHaveBeenCalled();
  expect(signInWithCustomToken).toHaveBeenCalledWith(expect.anything(), 'custom-token');
});

test('respuesta ajena al contrato se rechaza sin presentarla como resultado válido', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ codigo: 'OK' }) } as Response);
  await expect(callService('identity', {})).rejects.toThrow('Respuesta del servicio inválida');
});

test('un fallo de transporte no reintenta una mutación automáticamente', async () => {
  mockFetch.mockRejectedValue(new Error('Sin conexión'));
  await expect(callService('identity', {})).rejects.toThrow('Sin conexión');
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
