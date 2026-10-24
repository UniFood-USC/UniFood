import { fireEvent, render, screen } from '@testing-library/react-native';
import CartScreen from '../../src/features/cart/CartScreen';
import { addProduct, emptyCart } from '../../src/domain/cart';

const cart = addProduct(addProduct(emptyCart, { id: 'doble', restaurantId: 'r', name: 'Doble', priceCOP: 20000, discountPercent: 15 }).cart,
  { id: 'papas', restaurantId: 'r', name: 'Papas', priceCOP: 6000, discountPercent: 0 }).cart;

test('muestra líneas, subtotal, descuentos y total sin costo de servicio', async () => {
  await render(<CartScreen initialCart={cart} />);
  expect(screen.getByText('Tu carrito')).toBeTruthy();
  expect(screen.getByText('$26.000')).toBeTruthy();
  expect(screen.getByText('-$3.000')).toBeTruthy();
  expect(screen.getByText('$23.000')).toBeTruthy();
  expect(screen.queryByText(/Costo de servicio/)).toBeNull();
});

test('cambiar cantidades recalcula y llegar a cero elimina el producto', async () => {
  await render(<CartScreen initialCart={cart} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Aumentar cantidad de Papas' }));
  expect(screen.getByLabelText('Cantidad de Papas: 2')).toBeTruthy();
  expect(screen.getByText('$29.000')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Disminuir cantidad de Papas' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Disminuir cantidad de Papas' }));
  expect(screen.queryByText('Papas')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar Doble' }));
  expect(screen.getByText('Tu carrito está vacío.')).toBeTruthy();
  expect(screen.getByText('Agrega productos para continuar.')).toBeTruthy();
});

test('no permite pasar de 20 ni continuar sin pago disponible', async () => {
  await render(<CartScreen initialCart={{ ...cart, lines: [{ ...cart.lines[1], quantity: 20 }] }} />);
  expect(screen.getByRole('button', { name: 'Aumentar cantidad de Papas' }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Continuar' }).props.accessibilityState.disabled).toBe(true);
});
