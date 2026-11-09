import { fireEvent, render, screen } from '@testing-library/react-native';
import MenuScreen from '../../src/features/student/menu/MenuScreen';
import ProductDetailScreen from '../../src/features/student/menu/ProductDetailScreen';
import RestaurantsScreen from '../../src/features/student/restaurants/RestaurantsScreen';
import { response } from '../../src/domain/response';
import type { DetalleProducto, MenuRestaurante } from '../../src/types/Menu';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));

const restaurante = { id: 'rest-burger', nombre: 'Burger Campus', disponible: true };
const menu: MenuRestaurante = {
  restaurante,
  productos: [
    { id: 'doble', nombre: 'Doble', precioCOP: 20000, disponible: true, promocion: { porcentaje: 15, precioFinalCOP: 17000 } },
    { id: 'papas', nombre: 'Papas', precioCOP: 6000, disponible: true },
    { id: 'sencilla', nombre: 'Sencilla', precioCOP: 14000, disponible: false },
  ],
};
const detalle = (cambio: Partial<DetalleProducto['producto']> = {}): DetalleProducto => ({
  restaurante,
  producto: { id: 'doble', nombre: 'Doble', precioCOP: 20000, disponible: true, promocion: { porcentaje: 15, precioFinalCOP: 17000 }, descripcion: 'Dos carnes de res.', fotos: ['https://x.test/1.png', 'https://x.test/2.png', 'https://x.test/3.png'], ...cambio },
});

test('el menú muestra cada producto con nombre y precio en pesos, la promoción y los agotados', async () => {
  const service = jest.fn().mockResolvedValue(response('OK', 'Menú consultado.', menu));
  await render(<MenuScreen restaurantId="rest-burger" service={service} />);
  expect(await screen.findByText('Burger Campus')).toBeTruthy();
  expect(service).toHaveBeenCalledWith('menu/list', { restaurantId: 'rest-burger' });
  expect(screen.getByText('Doble')).toBeTruthy();
  expect(screen.getByText('$17.000')).toBeTruthy();
  expect(screen.getByText('$20.000')).toBeTruthy();
  expect(screen.getByText('Promoción -15 %')).toBeTruthy();
  expect(screen.getByText('$6.000')).toBeTruthy();
  expect(screen.getByText('Agotado')).toBeTruthy();
  expect(screen.getByText('Precios en pesos colombianos (COP).')).toBeTruthy();
  expect(screen.getByLabelText('Sencilla. 14.000 pesos colombianos. Agotado')).toBeTruthy();
});

test('abrir un producto lleva a su detalle dentro del mismo restaurante', async () => {
  const service = jest.fn().mockResolvedValue(response('OK', 'Menú consultado.', menu));
  await render(<MenuScreen restaurantId="rest-burger" service={service} />);
  await fireEvent.press(await screen.findByLabelText(/^Papas\./));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/product/[productId]', params: { productId: 'papas', restaurantId: 'rest-burger' } });
});

test('un menú vacío se informa expresamente', async () => {
  const service = jest.fn().mockResolvedValue(response('OK', 'El menú de este restaurante está vacío.', { restaurante, productos: [] }));
  await render(<MenuScreen restaurantId="rest-burger" service={service} />);
  expect(await screen.findByText('El menú de este restaurante está vacío.')).toBeTruthy();
});

test('errores de conexión o rechazos del servicio se informan y se reintenta solo al pulsar', async () => {
  const service = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response('OK', 'Menú consultado.', menu));
  await render(<MenuScreen restaurantId="rest-burger" service={service} />);
  expect(await screen.findByText(/No pudimos consultar el menú/)).toBeTruthy();
  expect(service).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Papas')).toBeTruthy();
  expect(service).toHaveBeenCalledTimes(2);
});

test('un rechazo del servicio muestra su mensaje', async () => {
  const service = jest.fn().mockResolvedValue(response('VALIDACION', 'Este restaurante no está disponible.'));
  await render(<MenuScreen restaurantId="rest-baja" service={service} />);
  expect(await screen.findByText('Este restaurante no está disponible.')).toBeTruthy();
});

test('una respuesta de otro restaurante no se muestra', async () => {
  const service = jest.fn().mockResolvedValue(response('OK', 'Menú consultado.', { ...menu, restaurante: { id: 'rest-pizza', nombre: 'Pizza Zona', disponible: true } }));
  await render(<MenuScreen restaurantId="rest-burger" service={service} />);
  expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeTruthy();
  expect(screen.queryByText('Doble')).toBeNull();
});

test('el detalle muestra descripción, fotos, disponibilidad, precio y promoción', async () => {
  const service = jest.fn().mockResolvedValue(response('OK', 'Producto consultado.', detalle()));
  await render(<ProductDetailScreen restaurantId="rest-burger" productId="doble" service={service} />);
  expect(await screen.findByText('Dos carnes de res.')).toBeTruthy();
  expect(service).toHaveBeenCalledWith('menu/product', { restaurantId: 'rest-burger', productId: 'doble' });
  expect(screen.getByText('Disponible')).toBeTruthy();
  expect(screen.getByText('$17.000')).toBeTruthy();
  expect(screen.getByText('Promoción -15 %')).toBeTruthy();
  expect(screen.getByText('Foto 1 de 3')).toBeTruthy();
  expect(screen.getByLabelText('Foto 3 de 3 de Doble')).toBeTruthy();
});

test('el detalle de un producto agotado, sin fotos ni descripción, lo dice', async () => {
  const service = jest.fn().mockResolvedValue(response('OK', 'Producto consultado.', detalle({ disponible: false, promocion: undefined, fotos: [], descripcion: '' })));
  await render(<ProductDetailScreen restaurantId="rest-burger" productId="doble" service={service} />);
  expect(await screen.findByText('Agotado')).toBeTruthy();
  expect(screen.getByText('Este producto aún no tiene fotos.')).toBeTruthy();
  expect(screen.getByText('Este producto no tiene descripción.')).toBeTruthy();
  expect(screen.getByText('$20.000')).toBeTruthy();
});

test('un producto que ya no está en el menú se informa', async () => {
  const service = jest.fn().mockResolvedValue(response('VALIDACION', 'Este producto no está disponible en el menú.'));
  await render(<ProductDetailScreen restaurantId="rest-burger" productId="viejo" service={service} />);
  expect(await screen.findByText('Este producto no está disponible en el menú.')).toBeTruthy();
});

test('seleccionar un restaurante del listado abre su menú', async () => {
  const lista = [{ id: 'rest-burger', nombre: 'Burger Campus', disponible: true }];
  const service = jest.fn().mockResolvedValue(response('OK', 'Restaurantes consultados.', { restaurants: lista }));
  await render(<RestaurantsScreen service={service} />);
  await fireEvent.press(await screen.findByLabelText('Burger Campus. Abierto'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/menu/[restaurantId]', params: { restaurantId: 'rest-burger' } });
});
