import { Order, OrderStatus } from '../../types/domain';
import { Actor, Change, ChangeResult, applyChange } from './changeOrder';

export interface OrderFilter { studentId?: string; restaurantId?: string } // vacío = todos (admin)

export interface OrderRepository {
  subscribe(orderId: string, onChange: (o: Order | null) => void, onError: (e: Error) => void): () => void;
  subscribeOrders(filter: OrderFilter, onChange: (o: Order[]) => void, onError: (e: Error) => void): () => void;
  change(orderId: string, change: Change, actor: Actor, expectedVersion: number): Promise<ChangeResult>;
}

// ---- Datos de ejemplo (sin base de datos todavía) ----
export const MOCK_STUDENT_ID = 'mock-student';

export const MOCK_ACTORS = {
  student: { role: 'student', id: MOCK_STUDENT_ID },
  restaurant: { role: 'restaurant', id: 'mock-restaurant-user', restaurantId: 'rest-burger' },
  admin: { role: 'admin', id: 'mock-admin' },
} satisfies Record<string, Actor>;

const restaurantNames: Record<string, string> = {
  'rest-burger': 'Burger Campus', 'rest-pizza': 'Pizza Zona',
  'rest-sazon': 'Sazón USC', 'rest-cafe': 'Café Universitario',
};
export const restaurantName = (id: string) => restaurantNames[id] ?? 'Restaurante';

const MIN = 60_000;
const ago = (m: number) => new Date(Date.now() - m * MIN).toISOString();
const inFuture = (m: number) => new Date(Date.now() + m * MIN).toISOString();

function seed(): Order[] {
  const base = { studentId: MOCK_STUDENT_ID, paymentMethod: 'nequi' as const, total: 32000, paid: true, version: 0 };
  return [
    { ...base, id: 'UC1023', restaurantId: 'rest-burger', mode: 'pickup', status: 'ready',
      estimateMinutes: 15, estimatedReadyAt: inFuture(5),
      statusHistory: { received: ago(20), preparing: ago(15), ready: ago(2) }, createdAt: ago(20), updatedAt: ago(2) },
    // Recién recibido: la estimación se registra al iniciar la preparación
    { ...base, id: 'UC1024', restaurantId: 'rest-burger', mode: 'delivery', status: 'received',
      estimatedReadyAt: null,
      statusHistory: { received: ago(1) }, createdAt: ago(1), updatedAt: ago(1) },
    { ...base, id: 'UC1025', restaurantId: 'rest-burger', mode: 'pickup', status: 'received',
      scheduledFor: inFuture(180), estimatedReadyAt: null,
      statusHistory: { received: ago(30) }, createdAt: ago(30), updatedAt: ago(30) },
    // En preparación con la estimación agotada (aviso de demora)
    { ...base, id: 'UC1026', restaurantId: 'rest-burger', mode: 'delivery', status: 'preparing',
      estimateMinutes: 25, estimatedReadyAt: ago(5),
      statusHistory: { received: ago(40), preparing: ago(30) }, createdAt: ago(40), updatedAt: ago(30) },
    // En preparación con tiempo restante
    { ...base, id: 'UC1028', restaurantId: 'rest-burger', mode: 'pickup', status: 'preparing',
      estimateMinutes: 20, estimatedReadyAt: inFuture(12),
      statusHistory: { received: ago(10), preparing: ago(8) }, createdAt: ago(10), updatedAt: ago(8) },
    // Efectivo sin pago registrado: el restaurante debe registrarlo antes de entregar
    { ...base, id: 'UC1027', restaurantId: 'rest-burger', mode: 'pickup', status: 'ready',
      paymentMethod: 'cash', paid: false, total: 18000,
      statusHistory: { received: ago(25), preparing: ago(20), ready: ago(3) }, createdAt: ago(25), updatedAt: ago(3) },
    { ...base, id: 'UC1019', restaurantId: 'rest-pizza', mode: 'pickup', status: 'collected',
      statusHistory: { received: ago(1500), preparing: ago(1495), ready: ago(1485), collected: ago(1480) },
      createdAt: ago(1500), updatedAt: ago(1480) },
    { ...base, id: 'UC1017', restaurantId: 'rest-cafe', mode: 'delivery', status: 'cancelled',
      cancelledBy: 'restaurant', cancelReason: 'Producto agotado',
      refund: { amount: 32000, at: ago(2890) },
      statusHistory: { received: ago(2900), cancelled: ago(2890) }, createdAt: ago(2900), updatedAt: ago(2890) },
    { ...base, id: 'UC1015', restaurantId: 'rest-burger', mode: 'pickup', status: 'collected',
      statusHistory: { received: ago(240), preparing: ago(230), ready: ago(220), collected: ago(210) },
      createdAt: ago(240), updatedAt: ago(210) },
    { ...base, id: 'UC1016', restaurantId: 'rest-burger', mode: 'delivery', status: 'cancelled',
      refund: { amount: 32000, at: ago(180) },
      statusHistory: { received: ago(200), cancelled: ago(180) }, createdAt: ago(200), updatedAt: ago(180) },
    { ...base, id: 'UC1014', restaurantId: 'rest-burger', mode: 'delivery', status: 'delivered',
      total: 0, paid: false,
      statusHistory: { received: ago(120), preparing: ago(110), ready: ago(100), on_the_way: ago(90), delivered: ago(80) },
      createdAt: ago(120), updatedAt: ago(80) },
  ];
}

// Reemplazar por Firestore (onSnapshot + transacciones) cuando exista la base de datos.
export function createMockRepository() {
  const orders = new Map<string, Order>(seed().map((o) => [o.id, o]));
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  const listen = (push: () => void) => { listeners.add(push); push(); return () => { listeners.delete(push); }; };

  const repo: OrderRepository = {
    subscribe: (id, onChange) => listen(() => onChange(orders.get(id) ?? null)),
    subscribeOrders: (filter, onChange) => listen(() => onChange(
      [...orders.values()].filter((o) =>
        (!filter.studentId || o.studentId === filter.studentId) &&
        (!filter.restaurantId || o.restaurantId === filter.restaurantId))
    )),
    async change(id, change, actor, expectedVersion) {
      const current = orders.get(id);
      if (!current) return { ok: false, error: 'not_found', message: 'No encontramos este pedido.' };
      const result = applyChange(current, change, actor, expectedVersion);
      if (result.ok) { orders.set(id, result.order); notify(); }
      return result;
    },
  };

  // Solo desarrollo: saltan las reglas (los botones "Simular" del seguimiento)
  const patch = (id: string, changes: Partial<Order>) => {
    const c = orders.get(id);
    if (!c) return;
    orders.set(id, { ...c, ...changes, version: c.version + 1, updatedAt: new Date().toISOString() });
    notify();
  };
  const setStatus = (id: string, status: OrderStatus) => {
    const c = orders.get(id);
    if (c) patch(id, { status, statusHistory: { ...c.statusHistory, [status]: new Date().toISOString() } });
  };

  return { repo, patch, setStatus };
}

export const mockOrders = createMockRepository();