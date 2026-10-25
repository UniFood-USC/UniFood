import { fireEvent, render, screen } from '@testing-library/react-native';
import StudentScreen from '../../src/features/student/StudentScreen';
import ProfileScreen from '../../src/features/identity/ProfileScreen';
import { callService } from '../../src/services/client';
import { response } from '../../src/domain/response';

const mockPush = jest.fn();
const mockLogout = jest.fn();
// La identidad de la sesión es estable entre renders, como en SessionProvider.
const mockSession = { identity: { id: 'demo-student', role: 'student', state: 'active' }, logout: mockLogout };
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../src/services/client', () => ({ callService: jest.fn() }));
jest.mock('../../src/features/identity/SessionProvider', () => ({ useSession: () => mockSession }));

const profile = { id: 'demo-student', name: 'Omar Sinisterra', email: 'omar@usc.edu.co', role: 'student' };
const restaurants = ['Burger Campus', 'Pizza Zona', 'Fruta Fresca', 'Sazón USC'].map((nombre, i) => ({ id: `r${i}`, nombre, disponible: true }));
function serve(list = restaurants) {
  jest.mocked(callService).mockImplementation(async action => action === 'profile'
    ? response('OK', 'Perfil consultado.', profile) : response('OK', 'Restaurantes consultados.', { restaurants: list }));
}

test('el inicio saluda por el nombre y muestra hasta tres restaurantes', async () => {
  serve();
  await render(<StudentScreen />);
  expect(await screen.findByText('¡Hola, Omar! 👋')).toBeTruthy();
  for (const name of ['Burger Campus', 'Pizza Zona', 'Fruta Fresca']) expect(screen.getByText(name)).toBeTruthy();
  expect(screen.queryByText('Sazón USC')).toBeNull();
  expect(callService).toHaveBeenCalledWith('profile', { id: 'demo-student' });
});

test('desde el inicio se llega al listado completo, a buscar y al perfil', async () => {
  serve();
  await render(<StudentScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Ver todos los restaurantes' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Buscar restaurantes o platos' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Perfil' }));
  expect(mockPush.mock.calls.map(([href]) => href)).toEqual(['/restaurants', '/student/search', '/student/profile']);
});

test('el inicio informa si no hay restaurantes', async () => {
  serve([]);
  await render(<StudentScreen />);
  expect(await screen.findByText('No hay restaurantes para mostrar.')).toBeTruthy();
});

test('el perfil muestra los datos propios y cierra sesión', async () => {
  serve();
  await render(<ProfileScreen />);
  expect(await screen.findByText('Omar Sinisterra')).toBeTruthy();
  expect(screen.getByText('omar@usc.edu.co')).toBeTruthy();
  expect(screen.getByText('Estudiante')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
  expect(mockLogout).toHaveBeenCalledTimes(1);
});
