import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router, usePathname } from 'expo-router';
import { Text } from 'react-native';
import RootLayout from '../../src/app/_layout';
import HomeRoute from '../../src/app/index';
import LoginRoute from '../../src/app/login';
import RegisterRoute from '../../src/app/register';
import StudentRoute from '../../src/app/student';
import RestaurantRoute from '../../src/app/restaurant';
import AdminRoute from '../../src/app/admin';
import OrderRoute from '../../src/app/order/[id]';
import { login } from '../../src/services/login';
import { response } from '../../src/domain/response';

jest.mock('../../src/services/login', () => ({ login: jest.fn() }));
jest.mock('../../src/services/firebase', () => ({ localFirebase: () => ({ auth: {}, ready: Promise.resolve() }) }));
jest.mock('../../src/services/registration', () => ({ registerStudent: jest.fn() }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: () => jest.fn(), signOut: jest.fn(async () => {}) }));

function TestLayout() {
  const pathname = usePathname();
  return <><RootLayout /><Text testID="pathname">{pathname}</Text></>;
}
const routes = { _layout: TestLayout, index: HomeRoute, login: LoginRoute, register: RegisterRoute,
  student: StudentRoute, restaurant: RestaurantRoute, admin: AdminRoute, 'order/[id]': OrderRoute };

test.each(['student', 'restaurant', 'admin'] as const)('acceso %s, salida y reentrada exigen sesión', async role => {
  jest.mocked(login).mockResolvedValue(response('OK', 'Sesión iniciada.', { id: `demo-${role}`, role, state: 'active' }));
  await renderRouter(routes, { initialUrl: '/login' });
  await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'demo@example.test');
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'Demo1234');
  await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
  await waitFor(() => expect(screen.getByTestId('pathname').props.children).toBe(`/${role}`));
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await waitFor(() => expect(screen.getByTestId('pathname').props.children).toBe('/login'));
  expect(screen.queryByText('Lo que construiremos')).toBeNull();
  if (router.canGoBack()) await act(() => router.back());
  await waitFor(() => expect(screen.getByTestId('pathname').props.children).toBe('/login'));
  await act(() => router.push(`/${role}`));
  await waitFor(() => expect(screen.getByTestId('pathname').props.children).toBe('/login'));
  expect(screen.queryByText('Lo que construiremos')).toBeNull();
});

test.each([
  ['student', '/admin'], ['student', '/restaurant'], ['restaurant', '/student'],
  ['restaurant', '/admin'], ['admin', '/student'], ['admin', '/restaurant'],
] as const)('%s no puede abrir %s', async (role, target) => {
  jest.mocked(login).mockResolvedValue(response('OK', 'Sesión iniciada.', { id: `demo-${role}`, role, state: 'active' }));
  await renderRouter(routes, { initialUrl: '/login' });
  await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'demo@example.test');
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'Demo1234');
  await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
  await waitFor(() => expect(screen.getByTestId('pathname').props.children).toBe(`/${role}`));
  await act(() => router.push(target));
  await waitFor(() => expect(screen.getByTestId('pathname').props.children).toBe(`/${role}`));
});
