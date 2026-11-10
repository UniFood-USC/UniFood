import { fireEvent, render, screen } from '@testing-library/react-native';
import AddToCartButton from '../../src/features/cart/AddToCartButton';
import ProductDetailScreen from '../../src/features/student/menu/ProductDetailScreen';
import { response } from '../../src/domain/response';
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));

const doble = { id: 'doble', nombre: 'Doble', precioCOP: 20000, disponible: true };
const accepted = (input: unknown) => {
  const { version, ...cart } = input as { version: number };
  return Promise.resolve(response('OK', 'Carrito guardado.', { cart, version: version + 1 }));
};
function serviceWith(cart: object, version = 3, save: (input: unknown) => Promise<unknown> = accepted) {
  return jest.fn((action: 'cart/get' | 'cart/save', input: unknown) => action === 'cart/get' ? Promise.resolve(response('OK', 'Carrito consultado.', { cart, version })) : save(input)) as jest.Mock;
}

test('agrega al carrito del mismo restaurante con la versión vigente', async () => {
  const service = serviceWith({ restaurantId: 'rest-burger', lines: [{ productId: 'papas', quantity: 1 }] });
  await render(<AddToCartButton restaurantId="rest-burger" product={doble} service={service} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar Doble al carrito' }));
  expect(service).toHaveBeenLastCalledWith('cart/save', { restaurantId: 'rest-burger', lines: [{ productId: 'papas', quantity: 1 }, { productId: 'doble', quantity: 1 }], version: 3 });
  expect(await screen.findByText('Doble se agregó al carrito.')).toBeTruthy();
});

test('con el carrito vacío empieza un carrito de ese restaurante', async () => {
  const service = serviceWith({ restaurantId: null, lines: [] }, 0);
  await render(<AddToCartButton restaurantId="rest-burger" product={doble} service={service} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar Doble al carrito' }));
  expect(service).toHaveBeenLastCalledWith('cart/save', { restaurantId: 'rest-burger', lines: [{ productId: 'doble', quantity: 1 }], version: 0 });
});

test('de otro restaurante pide aceptación: conservar no cambia nada y aceptar empieza el carrito nuevo', async () => {
  const service = serviceWith({ restaurantId: 'rest-pizza', lines: [{ productId: 'pizza', quantity: 2 }] });
  await render(<AddToCartButton restaurantId="rest-burger" product={doble} service={service} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar Doble al carrito' }));
  expect(await screen.findByText('Tu carrito tiene productos de otro restaurante. ¿Vaciarlo y empezar con este?')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Conservar mi carrito' }));
  expect(service).not.toHaveBeenCalledWith('cart/save', expect.anything());
  expect(screen.queryByText(/otro restaurante/)).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Agregar Doble al carrito' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Vaciar y agregar' }));
  expect(service).toHaveBeenLastCalledWith('cart/save', { restaurantId: 'rest-burger', lines: [{ productId: 'doble', quantity: 1 }], version: 3 });
  expect(await screen.findByText('Doble se agregó al carrito.')).toBeTruthy();
});

test('un producto agotado no se puede agregar', async () => {
  const service = serviceWith({ restaurantId: null, lines: [] });
  await render(<AddToCartButton restaurantId="rest-burger" product={{ ...doble, disponible: false }} service={service} />);
  const button = screen.getByRole('button', { name: 'Doble está agotado' });
  expect(button.props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(button);
  expect(service).not.toHaveBeenCalled();
});

test('sin pasar de 20 unidades y avisando si otro dispositivo cambió el carrito o falla la conexión', async () => {
  const full = serviceWith({ restaurantId: 'rest-burger', lines: [{ productId: 'doble', quantity: 20 }] });
  const { unmount } = await render(<AddToCartButton restaurantId="rest-burger" product={doble} service={full} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar Doble al carrito' }));
  expect(await screen.findByText('Ya tienes 20 unidades de este producto en el carrito.')).toBeTruthy();
  expect(full).not.toHaveBeenCalledWith('cart/save', expect.anything());
  await unmount();

  const changed = serviceWith({ restaurantId: null, lines: [] }, 0, () => Promise.resolve(response('CONFLICTO_VERSION', 'El carrito cambió.', { cart: { restaurantId: null, lines: [] }, version: 1 })));
  const second = await render(<AddToCartButton restaurantId="rest-burger" product={doble} service={changed} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar Doble al carrito' }));
  expect(await screen.findByText('Tu carrito cambió en otro dispositivo. Vuelve a intentarlo.')).toBeTruthy();
  await second.unmount();

  const offline = serviceWith({ restaurantId: null, lines: [] }, 0, () => Promise.reject(new Error('sin red')));
  await render(<AddToCartButton restaurantId="rest-burger" product={doble} service={offline} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar Doble al carrito' }));
  expect(await screen.findByText('No se agregó el producto. Revisa la conexión y reintenta.')).toBeTruthy();
});

test('el detalle del producto muestra el botón para agregarlo con su restaurante', async () => {
  const detail = { restaurante: { id: 'rest-burger', nombre: 'Burger Campus', disponible: true }, producto: { ...doble, descripcion: 'Dos carnes.', fotos: [] } };
  const menuService = jest.fn().mockResolvedValue(response('OK', 'Producto consultado.', detail));
  const addToCart = jest.fn(() => null);
  await render(<ProductDetailScreen restaurantId="rest-burger" productId="doble" service={menuService} addToCart={addToCart} />);
  expect(await screen.findByText('Dos carnes.')).toBeTruthy();
  expect(addToCart).toHaveBeenLastCalledWith(detail.producto);
});
