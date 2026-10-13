import { useEffect, useState } from 'react';
import { Order } from '../../types/domain';
import { OrderFilter, OrderRepository } from './orderRepository';

export function useOrders(repo: OrderRepository, filter: OrderFilter) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(filter);

  useEffect(() => {
    setLoading(true);
    return repo.subscribeOrders(
      JSON.parse(key),
      (o) => { setOrders(o); setError(null); setLoading(false); },
      (e) => { setError(e); setLoading(false); }
    );
  }, [repo, key]);

  return { orders, error, loading };
}