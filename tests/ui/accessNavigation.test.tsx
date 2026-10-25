import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router, usePathname } from 'expo-router';
import { Text } from 'react-native';
import RootLayout from '../../src/app/_layout';
import HomeRoute from '../../src/app/index';
import LoginRoute from '../../src/app/login';
import RegisterRoute from '../../src/app/register';
import OrderRoute from '../../src/app/order/[id]';
import OrdersRoute from '../../src/app/orders';
import StudentLayout from '../../src/app/student/_layout';
import StudentHome from '../../src/app/student/index';
import StudentSearch from '../../src/app/student/search';
import StudentCart from '../../src/app/student/cart';
import StudentOrders from '../../src/app/student/orders';
import StudentProfile from '../../src/app/student/profile';
import RestaurantLayout from '../../src/app/restaurant/_layout';
import RestaurantOrders from '../../src/app/restaurant/index';
import RestaurantMenu from '../../src/app/restaurant/menu';
import RestaurantSales from '../../src/app/restaurant/sales';
import RestaurantProfile from '../../src/app/restaurant/profile';
import AdminLayout from '../../src/app/admin/_layout';
import AdminUsers from '../../src/app/admin/index';
import AdminRestaurants from '../../src/app/admin/restaurants';
import AdminOrders from '../../src/app/admin/orders';
import AdminPromotions from '../../src/app/admin/promotions';
import AdminProfile from '../../src/app/admin/profile';
import { login } from '../../src/services/login';
import { response } from '../../src/domain/response';

jest.mock('../../src/services/login', () => ({ login: jest.fn() }));
jest.mock('../../src/services/firebase', () => ({ localFirebase: () => ({ auth: {}, ready: Promise.resolve() }) }));
jest.mock('../../src/services/registration', () => ({ registerStudent: jest.fn() }));
jest.mock('../../src/services/client', () => ({ callService: jest.fn(async (action: string) => {
  const { response: reply } = jest.requireActual('../../src/domain/response');
  return action === 'profile'
    ? reply('OK', 'Perfil consultado.', { id: 'demo', name: 'Omar Demo', email: 'demo@example.test', role: 'student' })
    : reply('OK', 'Consulta realizada.', { restaurants: [], users: [] });
}) }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: () => jest.fn(), signOut: jest.fn(async () => {}) }));

function TestLayout() {
  const pathname = usePathname();
  return <><RootLayout /><Text testID="pathname">{pathname}</Text></>;
}
const routes = { _layout: TestLayout, index: HomeRoute, login: LoginRoute, register: RegisterRoute,
  'order/[id]': OrderRoute, orders: OrdersRoute,
  'student/_layout': StudentLayout, 'student/index': StudentHome, 'student/search': StudentSearch,
  'student/cart': StudentCart, 'student/orders': StudentOrders, 'student/profile': StudentProfile,
  'restaurant/_layout': RestaurantLayout, 'restaurant/index': RestaurantOrders, 'restaurant/menu': RestaurantMenu,
  'restaurant/sales': RestaurantSales, 'restaurant/profile': RestaurantProfile,
  'admin/_layout': AdminLayout, 'admin/index': AdminUsers, 'admin/restaurants': AdminRestaurants,
  'admin/orders': AdminOrders, 'admin/promotions': AdminPromotions, 'admin/profile': AdminProfile };
const pathname = () => screen.getByTestId('pathname').props.children;

async function signIn(role: 'student' | 'restaurant' | 'admin') {
  jest.mocked(login).mockResolvedValue(response('OK', 'Sesión iniciada.', { id: `demo-${role}`, role, state: 'active' }));
  await renderRouter(routes, { initialUrl: '/login' });
  await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'demo@example.test');
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'Demo1234');
  await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
  await waitFor(() => expect(pathname()).toBe(`/${role}`));
}

test.each(['student', 'restaurant', 'admin'] as const)('acceso %s, salida desde Perfil y reentrada exigen sesión', async role => {
  await signIn(role);
  await act(() => router.push(`/${role}/profile`));
  await fireEvent.press(await screen.findByRole('button', { name: 'Cerrar sesión' }));
  await waitFor(() => expect(pathname()).toBe('/login'));
  if (router.canGoBack()) await act(() => router.back());
  await waitFor(() => expect(pathname()).toBe('/login'));
  await act(() => router.push(`/${role}`));
  await waitFor(() => expect(pathname()).toBe('/login'));
  expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
});

test.each([
  ['student', ['Inicio', 'Buscar', 'Carrito', 'Pedidos', 'Perfil'], ['Menú', 'Usuarios']],
  ['restaurant', ['Pedidos', 'Menú', 'Ventas', 'Perfil'], ['Carrito', 'Usuarios']],
  ['admin', ['Usuarios', 'Restaurantes', 'Pedidos', 'Promociones', 'Perfil'], ['Carrito', 'Menú']],
] as const)('%s ve solo sus pestañas', async (role, own, others) => {
  await signIn(role);
  for (const tab of own) expect(screen.getAllByText(tab).length).toBeGreaterThan(0);
  for (const tab of others) expect(screen.queryByText(tab)).toBeNull();
});

test.each([
  ['student', '/admin'], ['student', '/restaurant/menu'], ['student', '/admin/promotions'],
  ['restaurant', '/student'], ['restaurant', '/student/cart'], ['restaurant', '/admin/orders'],
  ['admin', '/student/orders'], ['admin', '/restaurant/sales'], ['admin', '/orders'],
] as const)('%s no puede abrir %s', async (role, target) => {
  await signIn(role);
  await act(() => router.push(target));
  await waitFor(() => expect(pathname()).toBe(`/${role}`));
});

test.each(['/student/cart', '/restaurant/menu', '/admin/promotions', '/orders'])('sin sesión, %s redirige al inicio de sesión', async target => {
  await renderRouter(routes, { initialUrl: target });
  await waitFor(() => expect(pathname()).toBe('/login'));
});

test('pestaña sin función muestra «Próximamente»', async () => {
  await signIn('student');
  await act(() => router.push('/student/search'));
  expect(await screen.findByText('Próximamente')).toBeTruthy();
});
