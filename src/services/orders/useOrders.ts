import { useEffect, useState } from 'react';
import { Order } from '../../types/domain';
import { OrderFilter, OrderRepository } from './orderRepository';

export function useOrders(repo: OrderRepository, filter: OrderFilter) {
  const key = JSON.stringify(filter);
  const [state, setState] = useState({ repo, key, orders: [] as Order[], error: null as Error | null, loading: true });

  // Reiniciar antes de mostrar datos de otra consulta, sin un efecto adicional.
  if (state.repo !== repo || state.key !== key) {
    setState({ repo, key, orders: [], error: null, loading: true });
  }

  useEffect(() => repo.subscribeOrders(
    JSON.parse(key),
    (orders) => setState({ repo, key, orders, error: null, loading: false }),
    (error) => setState(current => ({ ...current, error, loading: false }))
  ), [repo, key]);

  return { orders: state.orders, error: state.error, loading: state.loading };
}
