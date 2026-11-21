import { callService } from '../client';
import type { Order } from '../../types/domain';
import type { Actor, Change, ChangeResult } from './changeOrder';
import type { OrderRepository } from './orderRepository';

const REFRESH_INTERVAL = 5_000;

function unwrap<T>(result: Awaited<ReturnType<typeof callService<T>>>, fallback: string): T {
  if (result.codigo !== 'OK' || !result.datos) throw new Error(result.mensaje || fallback);
  return result.datos;
}

function mapChangeFailure(result: Awaited<ReturnType<typeof callService<{ result: ChangeResult }>>>): ChangeResult {
  const error = result.codigo === 'VALIDACION' ? 'invalid_transition'
    : result.codigo === 'SESION_REQUERIDA' || result.codigo === 'ACCESO_BLOQUEADO' || result.codigo === 'NO_AUTORIZADO'
      ? 'not_allowed'
      : 'not_found';
  return { ok: false, error, message: result.mensaje };
}

export const serverOrderRepository: OrderRepository = {
  subscribe(orderId, onChange, onError) {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const data = unwrap(await callService<{ order: Order | null }>('orders/get', { id: orderId }), 'No pudimos consultar el pedido.');
        if (active) onChange(data.order);
      } catch (error) {
        if (active) onError(error instanceof Error ? error : new Error('No pudimos consultar el pedido.'));
      } finally {
        if (active) timer = setTimeout(() => { void refresh(); }, REFRESH_INTERVAL);
      }
    };
    void refresh();
    return () => { active = false; if (timer) clearTimeout(timer); };
  },

  subscribeOrders(filter, onChange, onError) {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const data = unwrap(await callService<{ orders: Order[] }>('orders/list', filter), 'No pudimos consultar los pedidos.');
        if (active) onChange(data.orders);
      } catch (error) {
        if (active) onError(error instanceof Error ? error : new Error('No pudimos consultar los pedidos.'));
      } finally {
        if (active) timer = setTimeout(() => { void refresh(); }, REFRESH_INTERVAL);
      }
    };
    void refresh();
    return () => { active = false; if (timer) clearTimeout(timer); };
  },

  async change(orderId: string, change: Change, _actor: Actor, expectedVersion: number): Promise<ChangeResult> {
    const result = await callService<{ result: ChangeResult }>('orders/change', { id: orderId, change, expectedVersion });
    if (result.codigo !== 'OK' || !result.datos) return mapChangeFailure(result);
    return result.datos.result;
  },
};
