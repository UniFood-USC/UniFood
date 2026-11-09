import { Order } from '../../types/domain';

export type EstimateState =
  | { kind: 'not_preparing' }
  | { kind: 'missing' }
  | { kind: 'remaining'; minutes: number }
  | { kind: 'late' };

export function estimateState(order: Order, now: Date): EstimateState {
  if (order.status !== 'preparing') return { kind: 'not_preparing' };
  if (!order.estimatedReadyAt) return { kind: 'missing' };
  const ready = new Date(order.estimatedReadyAt).getTime();
  if (Number.isNaN(ready)) return { kind: 'missing' };
  const left = ready - now.getTime();
  return left > 0 ? { kind: 'remaining', minutes: Math.ceil(left / 60_000) } : { kind: 'late' };
}