import { act, renderHook } from '@testing-library/react-native';
import { SessionProvider, useSession } from '../../src/features/identity/SessionProvider';
import { login, type LoginIdentity } from '../../src/services/login';
import { response, type ServiceResponse } from '../../src/domain/response';
import { signOut } from 'firebase/auth';
import { registerStudent } from '../../src/services/registration';
import { callService } from '../../src/services/client';

jest.mock('../../src/services/login', () => ({ login: jest.fn() }));
jest.mock('../../src/services/firebase', () => ({ localFirebase: () => ({ auth: {}, ready: Promise.resolve() }) }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: () => jest.fn(), signOut: jest.fn(async () => {}) }));
jest.mock('../../src/services/registration', () => ({ registerStudent: jest.fn() }));
jest.mock('../../src/services/client', () => ({ callService: jest.fn() }));

test.each(['student', 'restaurant', 'admin'] as const)('solo publica la identidad %s comprobada y la retira al salir', async role => {
  jest.mocked(login).mockResolvedValue(response('OK', 'Sesión iniciada.', { id: 'demo', role, state: 'active' }));
  const { result } = await renderHook(() => useSession(), { wrapper: SessionProvider });
  await act(async () => { await result.current.signIn({ email: 'demo@example.test', password: 'Demo1234' }); });
  expect(result.current.identity?.role).toBe(role);
  await act(async () => { await result.current.logout(); });
  expect(result.current.identity).toBeNull();
  expect(signOut).toHaveBeenCalled();
});

test('salir durante un acceso pendiente impide que una respuesta tardía restaure la sesión', async () => {
  let finish!: (value: ServiceResponse<LoginIdentity>) => void;
  jest.mocked(login).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result } = await renderHook(() => useSession(), { wrapper: SessionProvider });
  let pending!: Promise<ServiceResponse<LoginIdentity>>;
  await act(() => { pending = result.current.signIn({ email: 'demo@example.test', password: 'Demo1234' }); });
  await act(async () => { await result.current.logout(); });
  await act(async () => {
    finish(response('OK', 'Sesión iniciada.', { id: 'demo', role: 'student', state: 'active' }));
    await pending;
  });
  expect(result.current.identity).toBeNull();
});

test('salir retira la identidad de la vista antes de que Auth complete la salida', async () => {
  jest.mocked(login).mockResolvedValue(response('OK', 'Sesión iniciada.', { id: 'demo', role: 'student', state: 'active' }));
  const { result } = await renderHook(() => useSession(), { wrapper: SessionProvider });
  await act(async () => { await result.current.signIn({ email: 'demo@example.test', password: 'Demo1234' }); });
  let finish!: () => void;
  jest.mocked(signOut).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(() => { pending = result.current.logout(); });
  expect(result.current.identity).toBeNull();
  await act(async () => { finish(); await pending; });
});

test('registro conserva Continuar y habilita estudiante solo tras comprobar el perfil', async () => {
  jest.mocked(registerStudent).mockResolvedValue(response('OK', 'Cuenta creada.', { id: 'new-student' }));
  jest.mocked(callService).mockResolvedValue(response('OK', 'Identidad comprobada.', { id: 'new-student', role: 'student', state: 'active' }));
  const { result } = await renderHook(() => useSession(), { wrapper: SessionProvider });
  await act(async () => {
    await result.current.register({ name: 'Demo', email: 'nuevo@usc.edu.co', password: 'Demo1234', confirmPassword: 'Demo1234' });
  });
  expect(result.current.identity).toEqual({ id: 'new-student', role: 'student', state: 'active' });
});
