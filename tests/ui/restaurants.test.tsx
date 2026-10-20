import { fireEvent, render, screen } from '@testing-library/react-native';
import RestaurantsScreen from '../../src/features/student/restaurants/RestaurantsScreen';
import StudentScreen from '../../src/features/student/StudentScreen';
import { response } from '../../src/domain/response';
import type { RestaurantePublico } from '../../src/types/Estado_Restaurante';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));

const lista: RestaurantePublico[] = [
  { id: 'rest-burger', nombre: 'Burger Campus', logo: 'https://placehold.co/160x160/png?text=BC', disponible: true },
  { id: 'rest-pizza', nombre: 'Pizza Zona', disponible: true },
  { id: 'rest-fruta', nombre: 'Fruta Fresca', disponible: true },
  { id: 'rest-sazon', nombre: 'Sazón USC', disponible: false, proximaApertura: 'Mañana 06:30' },
  { id: 'rest-cafe', nombre: 'Café Universitario', disponible: false, proximaApertura: 'Hoy 14:00' },
  { id: 'rest-wok', nombre: 'Wok Express', disponible: false },
];

test('muestra al menos 5 restaurantes con nombre, Abierto/Cerrado y próxima apertura', async () => {
  const service = jest.fn().mockResolvedValue(response('OK', 'Restaurantes consultados.', { restaurants: lista }));
  await render(<RestaurantsScreen service={service} />);
  expect(await screen.findByLabelText('Burger Campus. Abierto')).toBeTruthy();
  for (const r of lista) expect(screen.getByText(r.nombre)).toBeTruthy();
  expect(screen.getByLabelText('Sazón USC. Cerrado. Abre Mañana 06:30')).toBeTruthy();
  expect(screen.getByText('Abre: Hoy 14:00')).toBeTruthy();
  expect(screen.getByLabelText('Wok Express. Cerrado')).toBeTruthy();
  expect(screen.getAllByText('Cerrado')).toHaveLength(3);
  expect(screen.getByText('6 restaurantes en el campus · 3 abiertos ahora')).toBeTruthy();
  expect(service).toHaveBeenCalledWith('restaurants/list', {});
});

test('sin resultados informa al estudiante', async () => {
  const service = jest.fn().mockResolvedValue(response('OK', 'No hay restaurantes para mostrar.', { restaurants: [] }));
  await render(<RestaurantsScreen service={service} />);
  expect(await screen.findByText('No hay restaurantes para mostrar.')).toBeTruthy();
});

test('un error de conexión se informa y se reintenta solo al pulsar', async () => {
  const service = jest.fn().mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(response('OK', 'Restaurantes consultados.', { restaurants: lista }));
  await render(<RestaurantsScreen service={service} />);
  expect(await screen.findByText(/No pudimos consultar los restaurantes/)).toBeTruthy();
  expect(service).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Pizza Zona')).toBeTruthy();
  expect(service).toHaveBeenCalledTimes(2);
});

test('un rechazo del servicio muestra su mensaje', async () => {
  const service = jest.fn().mockResolvedValue(response('NO_AUTORIZADO', 'Solo los estudiantes consultan el listado de restaurantes.'));
  await render(<RestaurantsScreen service={service} />);
  expect(await screen.findByText('Solo los estudiantes consultan el listado de restaurantes.')).toBeTruthy();
});

test('desde el inicio del estudiante se llega al listado', async () => {
  await render(<StudentScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Ver restaurantes' }));
  expect(mockPush).toHaveBeenCalledWith('/restaurants');
});

// RF-05 · Búsqueda de restaurantes por nombre.
const abrirListado = async () => {
  const service = jest.fn().mockResolvedValue(response('OK', 'Restaurantes consultados.', { restaurants: lista }));
  await render(<RestaurantsScreen service={service} />);
  await screen.findByText('Burger Campus');
  return screen.getByLabelText('Buscar restaurantes');
};

test('RF-05: al escribir el nombre de un restaurante existente aparece entre los resultados', async () => {
  const campo = await abrirListado();
  await fireEvent.changeText(campo, 'Burger Campus');
  expect(screen.getByText('Burger Campus')).toBeTruthy();
  expect(screen.queryByText('Pizza Zona')).toBeNull();
  expect(screen.getByText('1 resultado para "Burger Campus"')).toBeTruthy();
});

test('RF-05: admite coincidencias parciales sin distinguir mayúsculas ni tildes', async () => {
  const campo = await abrirListado();
  await fireEvent.changeText(campo, 'PIZZ');
  expect(screen.getByText('Pizza Zona')).toBeTruthy();
  expect(screen.queryByText('Burger Campus')).toBeNull();
  await fireEvent.changeText(campo, 'sazon');
  expect(screen.getByText('Sazón USC')).toBeTruthy();
  await fireEvent.changeText(campo, 'CAFÉ');
  expect(screen.getByText('Café Universitario')).toBeTruthy();
  expect(screen.queryByText('Sazón USC')).toBeNull();
});

test('RF-05: los restaurantes cerrados también se buscan y muestran su próxima apertura', async () => {
  const campo = await abrirListado();
  await fireEvent.changeText(campo, 'cafe');
  expect(screen.getByLabelText('Café Universitario. Cerrado. Abre Hoy 14:00')).toBeTruthy();
  expect(screen.getByText('Abre: Hoy 14:00')).toBeTruthy();
});

test('RF-05: sin coincidencias muestra un mensaje de búsqueda sin resultados', async () => {
  const campo = await abrirListado();
  await fireEvent.changeText(campo, 'sushi');
  expect(screen.getByText('No encontramos restaurantes con "sushi".')).toBeTruthy();
  for (const r of lista) expect(screen.queryByText(r.nombre)).toBeNull();
});

test('RF-05: con el campo vacío se muestran todos los restaurantes, cerrados incluidos', async () => {
  const campo = await abrirListado();
  await fireEvent.changeText(campo, 'sushi');
  await fireEvent.changeText(campo, '');
  for (const r of lista) expect(screen.getByText(r.nombre)).toBeTruthy();
  expect(screen.getByText('6 restaurantes en el campus · 3 abiertos ahora')).toBeTruthy();
  // El botón de borrar también devuelve el listado completo.
  await fireEvent.changeText(campo, 'pizz');
  await fireEvent.press(screen.getByRole('button', { name: 'Borrar búsqueda' }));
  for (const r of lista) expect(screen.getByText(r.nombre)).toBeTruthy();
});
