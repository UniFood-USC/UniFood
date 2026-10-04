export type UserRole = 'student' | 'restaurant' | 'admin';
export type PaymentMethod = 'nequi' | 'card' | 'cash';
export type FulfillmentMode = 'pickup' | 'delivery';

export type OrderStatus =
  | 'received'
  | 'preparing'
  | 'ready'       // listo para pickup o delivery
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
  scheduledFor?: string | null;      // ISO; pedido programado
  estimatedReadyAt?: string | null;  // ISO; para el aviso de demora
  statusHistory?: Partial<Record<OrderStatus, string>>; // ISO de cuándo se alcanzó cada estado
  cancelledBy?: CancelledBy;
  cancelReason?: string;             // obligatorio si cancela restaurante o admin
  createdAt: string;
  updatedAt: string;
}