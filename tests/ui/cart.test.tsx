import { act, fireEvent, render, screen } from '@testing-library/react-native';
import CartScreen from '../../src/features/cart/CartScreen';
import { response } from '../../src/domain/response';

const mockFocus: { run?: () => void } = {};
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { useRouter: () => ({ push: mockPush }), useFocusEffect: (effect: () => void) => { mockFocus.run = effect; useEffect(effect, [effect]); } };
});

// Menú tal como lo entrega el servicio de menú (RF-06): precio base y promoción vigente.
const menu = { restaurante: { id: 'r', nombre: 'Burger Campus', disponible: true }, productos: [
  { id: 'doble', nombre: 'Doble', precioCOP: 20000, disponible: true, promocion: { porcentaje: 15, precioFinalCOP: 17000 } },
  { id: 'papas', nombre: 'Papas', precioCOP: 6000, disponible: true },
] };
const menuReply = () => Promise.resolve(response('OK', 'Menú consultado.', menu));
const saved = { restaurantId: 'r', lines: [{ productId: 'doble', quantity: 1 }, { productId: 'papas', quantity: 1 }] };
const accepted = (input: unknown) => {
  const { version, ...cart } = input as { version: number };
  return Promise.resolve(response('OK', 'Carrito guardado.', { cart, version: version + 1 }));
};
function serviceWith(cart: object = saved, save: (input: unknown) => Promise<unknown> = accepted) {
  return jest.fn((action: 'cart/get' | 'cart/save' | 'menu/list', input: unknown) => action === 'menu/list' ? menuReply()
    : action === 'cart/get' ? Promise.resolve(response('OK', 'Carrito consultado.', { cart, version: 4 })) : save(input)) as jest.Mock;
}

test('muestra el carrito guardado con subtotal, descuentos y total sin costo de servicio', async () => {
  await render(<CartScreen service={serviceWith()} />);
  expect(await screen.findByText('Doble')).toBeTruthy();
  expect(screen.getByText('$26.000')).toBeTruthy();
  expect(screen.getByText('-$3.000')).toBeTruthy();
  expect(screen.getByText('$23.000')).toBeTruthy();
  expect(screen.queryByText(/Costo de servicio/)).toBeNull();
});

test('cada cambio se guarda con la versión vigente y llegar a cero elimina el producto', async () => {
  const service = serviceWith();
  await render(<CartScreen service={service} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Aumentar cantidad de Papas' }));
  expect(screen.getByLabelText('Cantidad de Papas: 2')).toBeTruthy();
  expect(screen.getByText('$29.000')).toBeTruthy();
  expect(service).toHaveBeenLastCalledWith('cart/save', { restaurantId: 'r', lines: [{ productId: 'doble', quantity: 1 }, { productId: 'papas', quantity: 2 }], version: 4 });
  await fireEvent.press(screen.getByRole('button', { name: 'Disminuir cantidad de Papas' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Disminuir cantidad de Papas' }));
  expect(screen.queryByText('Papas')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar Doble' }));
  expect(screen.getByText('Tu carrito está vacío.')).toBeTruthy();
  expect(service).toHaveBeenLastCalledWith('cart/save', { restaurantId: null, lines: [], version: 7 });
});

test('si otro dispositivo guardó antes, se muestra su carrito, se avisa y no se envían los cambios pendientes', async () => {
  let answer: (value: unknown) => void = () => undefined;
  const save = jest.fn((_input: unknown) => new Promise(resolve => { answer = resolve; }));
  await render(<CartScreen service={serviceWith(saved, save)} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Aumentar cantidad de Papas' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Aumentar cantidad de Papas' }));
  await act(async () => answer(response('CONFLICTO_VERSION', 'El carrito cambió.', { cart: { restaurantId: 'r', lines: [{ productId: 'doble', quantity: 3 }] }, version: 6 })));
  expect(screen.getByLabelText('Cantidad de Doble: 3')).toBeTruthy();
  expect(screen.queryByText('Papas')).toBeNull();
  expect(screen.getByText('Tu carrito cambió en otro dispositivo. Revisa los cambios antes de continuar.')).toBeTruthy();
  expect(save).toHaveBeenCalledTimes(1);
  save.mockImplementation(accepted);
  await fireEvent.press(screen.getByRole('button', { name: 'Aumentar cantidad de Doble' }));
  expect(save).toHaveBeenLastCalledWith({ restaurantId: 'r', lines: [{ productId: 'doble', quantity: 4 }], version: 6 });
  expect(screen.queryByText(/otro dispositivo/)).toBeNull();
});

test('si un cambio no se guarda se conserva en pantalla, se avisa y se puede reintentar', async () => {
  const save = jest.fn()
    .mockResolvedValueOnce(response('SERVICIO_NO_DISPONIBLE', 'Servicio no disponible.'))
    .mockImplementation(accepted);
  await render(<CartScreen service={serviceWith(saved, save)} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Aumentar cantidad de Papas' }));
  expect(screen.getByLabelText('Cantidad de Papas: 2')).toBeTruthy();
  expect(await screen.findByText('No se guardó el último cambio del carrito. Revisa la conexión y reintenta.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  expect(save).toHaveBeenLastCalledWith({ restaurantId: 'r', lines: [{ productId: 'doble', quantity: 1 }, { productId: 'papas', quantity: 2 }], version: 4 });
  expect(screen.queryByText(/No se guardó/)).toBeNull();
});

test('al volver a la pestaña se consulta de nuevo el carrito', async () => {
  const service = serviceWith();
  await render(<CartScreen service={service} />);
  expect(await screen.findByText('Papas')).toBeTruthy();
  service.mockImplementationOnce(() => Promise.resolve(response('OK', 'Carrito consultado.', { cart: { restaurantId: 'r', lines: [{ productId: 'papas', quantity: 5 }] }, version: 9 })));
  await act(async () => mockFocus.run!());
  expect(screen.getByLabelText('Cantidad de Papas: 5')).toBeTruthy();
  expect(screen.queryByText('Doble')).toBeNull();
});

test('si no se puede consultar el carrito se avisa y se reintenta la consulta', async () => {
  const service = jest.fn()
    .mockRejectedValueOnce(new Error('sin red'))
    .mockImplementation((action: string) => action === 'menu/list' ? menuReply() : Promise.resolve(response('OK', 'Carrito consultado.', { cart: saved, version: 4 })));
  await render(<CartScreen service={service} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Doble')).toBeTruthy();
  expect(service).toHaveBeenCalledWith('menu/list', { restaurantId: 'r' });
});

test('no permite pasar de 20 y Continuar lleva al método de pago', async () => {
  await render(<CartScreen service={serviceWith({ restaurantId: 'r', lines: [{ productId: 'papas', quantity: 20 }] })} />);
  expect((await screen.findByRole('button', { name: 'Aumentar cantidad de Papas' })).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  expect(mockPush).toHaveBeenCalledWith('/checkout');
});

test('con el carrito vacío no se puede continuar', async () => {
  await render(<CartScreen service={serviceWith({ restaurantId: null, lines: [] })} />);
  expect((await screen.findByRole('button', { name: 'Continuar' })).props.accessibilityState.disabled).toBe(true);
});

test('los precios y promociones salen del menú del restaurante del carrito', async () => {
  const service = serviceWith();
  await render(<CartScreen service={service} />);
  expect(await screen.findByText('-15 % en esta línea')).toBeTruthy();
  expect(service).toHaveBeenCalledWith('menu/list', { restaurantId: 'r' });
});

test('si el menú no se puede consultar no muestra un carrito vacío ni guarda nada', async () => {
  const service = jest.fn((action: string) => action === 'menu/list' ? Promise.resolve(response('VALIDACION', 'Este restaurante no está disponible.'))
    : Promise.resolve(response('OK', 'Carrito consultado.', { cart: saved, version: 4 })));
  await render(<CartScreen service={service} />);
  expect(await screen.findByText('Este restaurante no está disponible.')).toBeTruthy();
  expect(screen.queryByText('Tu carrito está vacío.')).toBeNull();
  expect(service).not.toHaveBeenCalledWith('cart/save', expect.anything());
});
