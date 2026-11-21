import type { Order } from '../types/domain';

export interface SalesEntry {
  order: Order;
  date: string;
}

export interface RefundEntry extends SalesEntry {
  order: Order & { refund: NonNullable<Order['refund']> };
}

export interface RestaurantSalesHistory {
  sales: SalesEntry[];
  cancelled: SalesEntry[];
  refunds: RefundEntry[];
}

const completedStatuses = new Set<Order['status']>(['collected', 'delivered']);

function newestFirst(a: SalesEntry, b: SalesEntry) {
  return b.date.localeCompare(a.date);
}

export function getRestaurantSalesHistory(
  orders: readonly Order[],
  restaurantId: string,
): RestaurantSalesHistory {
  if (!restaurantId.trim()) throw new Error('Se requiere el identificador del restaurante.');

  const restaurantOrders = orders.filter(order => order.restaurantId === restaurantId);
  const sales = restaurantOrders
    .filter(order => (order.paid || order.total === 0) && completedStatuses.has(order.status))
    .map(order => ({
      order,
      date: order.statusHistory?.[order.status] ?? order.updatedAt,
    }))
    .sort(newestFirst);
  const cancelled = restaurantOrders
    .filter(order => order.status === 'cancelled')
    .map(order => ({
      order,
      date: order.statusHistory?.cancelled ?? order.updatedAt,
    }))
    .sort(newestFirst);
  const refundableOrders = restaurantOrders
    .filter((order): order is RefundEntry['order'] => order.refund !== undefined);
  const refunds = refundableOrders
    .map(order => ({ order, date: order.refund.at }))
    .sort(newestFirst);

  return { sales, cancelled, refunds };
}
