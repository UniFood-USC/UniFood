import { Order, OrderStatus } from '../../../types/domain';

export interface OrderRepository {
  subscribe(
    orderId: string,
    onChange: (order: Order | null) => void,
    onError: (error: Error) => void
  ): () => void;
}

// Mock para desarrollar sin backend. Reemplazar por Firestore (onSnapshot) después.
export function createMockRepository() {
  const now = Date.now();
  let order: Order = {
    id: 'UC1023',
    studentId: 'mock-student',
    restaurantId: 'mock-restaurant',
    mode: 'pickup',
    status: 'received',
    paymentMethod: 'nequi',
    scheduledFor: null,
    estimatedReadyAt: new Date(now + 2 * 60_000).toISOString(),
    statusHistory: { received: new Date(now).toISOString() },
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
  const listeners = new Set<(o: Order | null) => void>();
  const emit = () => listeners.forEach((l) => l(order));

  const repo: OrderRepository = {
    subscribe(id, onChange) {
      listeners.add(onChange);
      onChange(id === order.id ? order : null);
      return () => { listeners.delete(onChange); };
    },
  };

  return {
    repo,
    // Solo para pruebas manuales
    patch(changes: Partial<Order>) {
      order = { ...order, ...changes, updatedAt: new Date().toISOString() };
      emit();
    },
    setStatus(status: OrderStatus) {
      this.patch({ status, statusHistory: { ...order.statusHistory, [status]: new Date().toISOString() } });
    },
    toggleMode() {
      this.patch({
        mode: order.mode === 'pickup' ? 'delivery' : 'pickup',
        status: 'received',
        statusHistory: { received: order.createdAt },
      });
    },
  };
}

export const mockOrders = createMockRepository();