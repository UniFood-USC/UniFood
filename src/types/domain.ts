export type UserRole = 'student' | 'restaurant' | 'admin';
export type PaymentMethod = 'nequi' | 'card' | 'cash';
export type FulfillmentMode = 'pickup' | 'delivery';

export type OrderStatus =
  | 'received'
  | 'preparing'
  | 'ready'       // listo para recoger (pickup) o listo para entregar (delivery)
  | 'collected'   // solo recogida
  | 'on_the_way'  // solo entrega al salón
  | 'delivered'   // solo entrega al salón
  | 'cancelled';

export type CancelledBy = 'student' | 'restaurant' | 'admin';

export interface Order {
  id: string;
  studentId: string;
  restaurantId: string;
  mode: FulfillmentMode;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  total: number;                             // total del pedido (COP)
  paid: boolean;                             // pago registrado
  version: number;                           // sube con cada cambio
  updatedBy?: { role: UserRole; id: string };
  refund?: { amount: number; at: string };   // reembolso simulado, una sola vez
  scheduledFor?: string | null;              // ISO; pedido programado
  estimateMinutes?: number | null;           // minutos de la última estimación registrada
  estimatedReadyAt?: string | null;          // ISO; momento en que se agota la estimación
  statusHistory?: Partial<Record<OrderStatus, string>>; // ISO de cuándo se alcanzó cada estado
  cancelledBy?: CancelledBy;
  cancelReason?: string;                     // obligatorio si cancela restaurante o admin
  createdAt: string;
  updatedAt: string;
}