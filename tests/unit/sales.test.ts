import { getRestaurantSalesHistory } from '../../src/domain/sales';
import type { Order } from '../../src/types/domain';

const order = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-1',
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

test('limita historial a su restaurante y cuenta ventas pagadas recogidas o entregadas, incluso de importe cero', () => {
  const history = getRestaurantSalesHistory([
    order(),
    order({
      id: 'delivered',
      mode: 'delivery',
      status: 'delivered',
      total: 0,
      paid: false,
      statusHistory: { delivered: '2026-10-12T13:00:00.000Z' },
    }),
    order({ id: 'unpaid', status: 'collected', paid: false }),
    order({ id: 'active', status: 'preparing' }),
    order({ id: 'other', restaurantId: 'restaurant-2' }),
  ], 'restaurant-1');

  expect(history.sales.map(entry => entry.order.id)).toEqual(['delivered', 'order-1']);
  expect(history.cancelled).toEqual([]);
  expect(history.refunds).toEqual([]);
});

test('separa cancelaciones y reembolsos y ordena cada lista por su fecha correspondiente', () => {
  const history = getRestaurantSalesHistory([
    order({
      id: 'cancelled',
      status: 'cancelled',
      statusHistory: { cancelled: '2026-10-12T12:00:00.000Z' },
      refund: { amount: 12000, at: '2026-10-12T12:30:00.000Z' },
    }),
    order({
      id: 'cancelled-later',
      status: 'cancelled',
      updatedAt: '2026-10-13T12:00:00.000Z',
    }),
  ], 'restaurant-1');

  expect(history.cancelled.map(entry => entry.order.id)).toEqual(['cancelled-later', 'cancelled']);
  expect(history.cancelled[1].date).toBe('2026-10-12T12:00:00.000Z');
  expect(history.refunds).toEqual([{
    order: expect.objectContaining({ id: 'cancelled' }),
    date: '2026-10-12T12:30:00.000Z',
  }]);
});

test('requiere un identificador de restaurante para consultar el historial', () => {
  expect(() => getRestaurantSalesHistory([], ' ')).toThrow('Se requiere el identificador del restaurante.');
});
