import { FulfillmentMode, OrderStatus } from '../../../types/domain';

export const STATUS_FLOW: Record<FulfillmentMode, OrderStatus[]> = {
  pickup:   ['received', 'preparing', 'ready', 'collected'],
  delivery: ['received', 'preparing', 'ready', 'on_the_way', 'delivered'],
};

export function statusLabel(status: OrderStatus, mode: FulfillmentMode): string {
  switch (status) {
    case 'received':   return 'Recibido';
    case 'preparing':  return 'En preparación';
    case 'ready':      return mode === 'pickup' ? 'Listo para recoger' : 'Listo para entregar';
    case 'collected':  return 'Recogido';
    case 'on_the_way': return 'En camino';
    case 'delivered':  return 'Entregado';
    case 'cancelled':  return 'Cancelado';
  }
}

export const isTerminal = (s: OrderStatus) =>
  s === 'cancelled' || s === 'collected' || s === 'delivered';