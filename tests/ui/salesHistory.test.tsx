import { render, screen, waitFor } from '@testing-library/react-native';
import { getRestaurantSalesHistory } from '../../src/domain/sales';
import SalesHistoryScreen from '../../src/features/restaurant/SalesHistoryScreen';
import type { OrderRepository } from '../../src/services/orders/orderRepository';
import type { Order } from '../../src/types/domain';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

const order = (overrides: Partial<Order> = {}): Order => ({
  id: 'sale-1',
  studentId: 'student-1',
  restaurantId: 'restaurant-1',
  mode: 'pickup',
  status: 'collected',
  paymentMethod: 'nequi',
  total: 24000,
  paid: true,
  version: 1,
  createdAt: '2026-10-12T10:00:00.000Z',
  updatedAt: '2026-10-12T11:00:00.000Z',
  ...overrides,
});

function repositoryWith(orders: Order[]) {
  let requestedRestaurantId = '';
  const repository: OrderRepository = {
    subscribe: () => () => {},
    subscribeOrders: (filter, onChange) => {
      requestedRestaurantId = filter.restaurantId ?? '';
      onChange(orders);
      return () => {};
    },
    change: async () => ({ ok: false, error: 'not_found', message: 'No encontramos este pedido.' }),
  };
  return { repository, get requestedRestaurantId() { return requestedRestaurantId; } };
}

test('presenta ventas, cancelaciones y reembolsos solo para el restaurante consultado', async () => {
  const scoped = repositoryWith([
    order(),
    order({
      id: 'zero-sale',
      mode: 'delivery',
      status: 'delivered',
      total: 0,
      paid: false,
    }),
    order({
      id: 'cancelled-1',
      status: 'cancelled',
      refund: { amount: 24000, at: '2026-10-12T12:00:00.000Z' },
    }),
    order({ id: 'other-restaurant', restaurantId: 'restaurant-2' }),
  ]);

  await render(<SalesHistoryScreen repository={scoped.repository} restaurantId="restaurant-1" />);

  await waitFor(() => expect(screen.getByText('Pedido #sale-1')).toBeTruthy());
  expect(scoped.requestedRestaurantId).toBe('restaurant-1');
  expect(screen.getByText('Ventas completadas (2)')).toBeTruthy();
  expect(screen.getByText('Pedidos cancelados (1)')).toBeTruthy();
  expect(screen.getByText('Reembolsos (1)')).toBeTruthy();
  expect(screen.getByText('Pedido #zero-sale')).toBeTruthy();
  expect(screen.getAllByText('Pedido #cancelled-1')).toHaveLength(2);
  expect(screen.queryByText('Pedido #other-restaurant')).toBeNull();
});

test('informa cuando no hay actividad para mostrar', async () => {
  const scoped = repositoryWith([
    order({ restaurantId: 'other-restaurant' }),
    order({ id: 'in-progress', status: 'preparing' }),
  ]);

  await render(<SalesHistoryScreen repository={scoped.repository} restaurantId="restaurant-1" />);

  await waitFor(() => expect(screen.getByText('Aún no hay ventas completadas.')).toBeTruthy());
  expect(screen.getByText('No hay pedidos cancelados.')).toBeTruthy();
  expect(screen.getByText('No hay reembolsos.')).toBeTruthy();
});

test('incluye pedidos entregados en salón dentro de las ventas válidas', () => {
  const history = getRestaurantSalesHistory([
    order({ mode: 'delivery', status: 'delivered' }),
  ], 'restaurant-1');

  expect(history.sales).toHaveLength(1);
});
