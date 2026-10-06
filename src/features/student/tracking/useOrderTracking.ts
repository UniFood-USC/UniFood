import { useEffect, useState } from 'react';
import { Order } from '../../../types/domain';
import { OrderRepository } from './orderRepository';

export function useOrderTracking(repo: OrderRepository, orderId: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    return repo.subscribe(
      orderId,
      (o) => { setOrder(o); setError(null); setLoading(false); },
      (e) => { setError(e); setLoading(false); }
    );
  }, [repo, orderId]);

  return { order, error, loading };
}