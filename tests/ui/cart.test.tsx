import { act, fireEvent, render, screen } from '@testing-library/react-native';
import CartScreen from '../../src/features/cart/CartScreen';
import { response } from '../../src/domain/response';
import type { Product } from '../../src/domain/cart';

const mockFocus: { run?: () => void } = {};
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { useFocusEffect: (effect: () => void) => { mockFocus.run = effect; useEffect(effect, [effect]); } };
});

const products: Product[] = [
  { id: 'doble', restaurantId: 'r', name: 'Doble', priceCOP: 20000, discountPercent: 15 },
  { id: 'papas', restaurantId: 'r', name: 'Papas', priceCOP: 6000, discountPercent: 0 },
];
const saved = { restaurantId: 'r', lines: [{ productId: 'doble', quantity: 1 }, { productId: 'papas', quantity: 1 }] };
const accepted = (input: unknown) => {
  const { version, ...cart } = input as { version: number };
  return Promise.resolve(response('OK', 'Carrito guardado.', { cart, version: version + 1 }));
};
function serviceWith(cart: object = saved, save: (input: unknown) => Promise<unknown> = accepted) {
  return jest.fn((action: 'cart/get' | 'cart/save', input: unknown) => action === 'cart/get' ? Promise.resolve(response('OK', 'Carrito consultado.', { cart, version: 4 })) : save(input)) as jest.Mock;
}

test('muestra el carrito guardado con subtotal, descuentos y total sin costo de servicio', async () => {
  await render(<CartScreen service={serviceWith()} products={products} />);
  expect(await screen.findByText('Doble')).toBeTruthy();
  expect(screen.getByText('$26.000')).toBeTruthy();
  expect(screen.getByText('-$3.000')).toBeTruthy();
  expect(screen.getByText('$23.000')).toBeTruthy();
  expect(screen.queryByText(/Costo de servicio/)).toBeNull();
});

test('cada cambio se guarda con la versión vigente y llegar a cero elimina el producto', async () => {
  const service = serviceWith();
  await render(<CartScreen service={service} products={products} />);
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
  await render(<CartScreen service={serviceWith(saved, save)} products={products} />);
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
  await render(<CartScreen service={serviceWith(saved, save)} products={products} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Aumentar cantidad de Papas' }));
  expect(screen.getByLabelText('Cantidad de Papas: 2')).toBeTruthy();
  expect(await screen.findByText('No se guardó el último cambio del carrito. Revisa la conexión y reintenta.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  expect(save).toHaveBeenLastCalledWith({ restaurantId: 'r', lines: [{ productId: 'doble', quantity: 1 }, { productId: 'papas', quantity: 2 }], version: 4 });
  expect(screen.queryByText(/No se guardó/)).toBeNull();
});

test('al volver a la pestaña se consulta de nuevo el carrito', async () => {
  const service = serviceWith();
  await render(<CartScreen service={service} products={products} />);
  expect(await screen.findByText('Papas')).toBeTruthy();
  service.mockResolvedValueOnce(response('OK', 'Carrito consultado.', { cart: { restaurantId: 'r', lines: [{ productId: 'papas', quantity: 5 }] }, version: 9 }));
  await act(async () => mockFocus.run!());
  expect(screen.getByLabelText('Cantidad de Papas: 5')).toBeTruthy();
  expect(screen.queryByText('Doble')).toBeNull();
});

test('si no se puede consultar el carrito se avisa y se reintenta la consulta', async () => {
  const service = jest.fn()
    .mockRejectedValueOnce(new Error('sin red'))
    .mockResolvedValue(response('OK', 'Carrito consultado.', { cart: saved, version: 4 }));
  await render(<CartScreen service={service} products={products} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Doble')).toBeTruthy();
  expect(service).toHaveBeenCalledTimes(2);
});

test('no permite pasar de 20 ni continuar sin pago disponible', async () => {
  await render(<CartScreen service={serviceWith({ restaurantId: 'r', lines: [{ productId: 'papas', quantity: 20 }] })} products={products} />);
  expect((await screen.findByRole('button', { name: 'Aumentar cantidad de Papas' })).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Continuar' }).props.accessibilityState.disabled).toBe(true);
});
