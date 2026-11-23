import { fireEvent, render, screen } from '@testing-library/react-native';
import SalesHistoryScreen from '../../src/features/restaurant/SalesHistoryScreen';
import type { OrderRepository } from '../../src/services/orders/orderRepository';

const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => false) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
const repository = { subscribe: () => () => undefined, subscribeOrders: (_filter: unknown, onChange: (orders: []) => void) => { onChange([]); return () => undefined; }, change: jest.fn() } as unknown as OrderRepository;

test('en la pestaña, sin pantalla anterior, Volver lleva a los pedidos del restaurante', async () => {
  await render(<SalesHistoryScreen repository={repository} restaurantId="rest-burger" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockRouter.replace).toHaveBeenCalledWith('/restaurant');
});
