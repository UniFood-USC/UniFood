import { useEffect, useState } from 'react';
import { Order } from '../../../types/domain';
import { OrderRepository } from '../../../services/orders/orderRepository';

// El seguimiento solo necesita suscribirse a un pedido.
type Subscriber = Pick<OrderRepository, 'subscribe'>;

export function useOrderTracking(repo: Subscriber, orderId: string) {
  const [state, setState] = useState<{
    repo: Subscriber;
    orderId: string;
    order: Order | null;
    error: Error | null;
    loading: boolean;
  }>({ repo, orderId, order: null, error: null, loading: true });

  // Reiniciar antes de mostrar datos de otra consulta, sin un efecto adicional.
  if (state.repo !== repo || state.orderId !== orderId) {
    setState({ repo, orderId, order: null, error: null, loading: true });
  }

  useEffect(() => {
    let active = true;
    const unsubscribe = repo.subscribe(
      orderId,
      (order) => {
        if (active) setState({ repo, orderId, order, error: null, loading: false });
      },
      (error) => {
        if (active) setState({ repo, orderId, order: null, error, loading: false });
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [repo, orderId]);

  return { order: state.order, error: state.error, loading: state.loading };
}
