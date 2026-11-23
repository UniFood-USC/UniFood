import { fireEvent, render, screen } from '@testing-library/react-native';
import CheckoutScreen from '../../src/features/cart/CheckoutScreen';
import { response } from '../../src/domain/response';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

const order = (changes = {}) => ({ id: 'UC3001', total: 29000, paid: true, paymentMethod: 'nequi', status: 'received', ...changes });
const keyOf = (service: jest.Mock, call: number) => (service.mock.calls[call][1] as { attemptKey: string }).attemptKey;

test('con Nequi confirma el pedido, muestra su número y lleva al seguimiento', async () => {
  const service = jest.fn().mockResolvedValue(response('OK', 'Pedido confirmado.', { order: order() }));
  await render(<CheckoutScreen service={service} />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Nequi' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar pedido' }));
  expect(service).toHaveBeenCalledWith('checkout/place', { attemptKey: expect.any(String), method: 'nequi' });
  expect(await screen.findByText('¡Pedido confirmado!')).toBeTruthy();
  expect(screen.getByText('#UC3001')).toBeTruthy();
  expect(screen.getByText('Pago simulado aprobado: $29.000')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Ver estado del pedido' }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/order/[id]', params: { id: 'UC3001' } });
});

test('en efectivo avisa que se paga al recoger', async () => {
  const service = jest.fn().mockResolvedValue(response('OK', 'Pedido confirmado.', { order: order({ paid: false, paymentMethod: 'cash', total: 6000 }) }));
  await render(<CheckoutScreen service={service} />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Efectivo' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar pedido' }));
  expect(service).toHaveBeenCalledWith('checkout/place', { attemptKey: expect.any(String), method: 'cash' });
  expect(await screen.findByText('Pagas $6.000 en efectivo al recoger.')).toBeTruthy();
});

test('un rechazo se explica y reintentar usa otra clave; sin conexión se reintenta con la misma', async () => {
  const service = jest.fn()
    .mockResolvedValueOnce(response('PAGO_FALLIDO', 'El pago simulado no se completó. Tu carrito se conserva: reintenta o cambia de método.', null, true))
    .mockRejectedValueOnce(new Error('sin red'))
    .mockResolvedValue(response('OK', 'Pedido confirmado.', { order: order() }));
  await render(<CheckoutScreen service={service} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar pedido' }));
  expect(await screen.findByText(/El pago simulado no se completó/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar pedido' }));
  expect(await screen.findByText(/No pudimos confirmar si se creó el pedido/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar pedido' }));
  expect(await screen.findByText('¡Pedido confirmado!')).toBeTruthy();
  expect(keyOf(service, 1)).not.toBe(keyOf(service, 0));
  expect(keyOf(service, 2)).toBe(keyOf(service, 1));
});
