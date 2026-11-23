import { useCallback, useEffect, useState } from 'react';
import { Order } from '../../../types/domain';
import { OrderRepository } from '../../../services/orders/orderRepository';

// El seguimiento solo necesita suscribirse a un pedido.
type Subscriber = Pick<OrderRepository, 'subscribe'>;

type State = {
  repo: Subscriber;
  orderId: string;
  order: Order | null;
  error: Error | null;
  loading: boolean;
};

export function useOrderTracking(repo: Subscriber, orderId: string) {
  const [state, setState] = useState<State>({ repo, orderId, order: null, error: null, loading: true });

  // Reiniciar antes de mostrar datos de otra consulta, sin un efecto adicional.
  if (state.repo !== repo || state.orderId !== orderId) {
    setState({ repo, orderId, order: null, error: null, loading: true });
  }

  useEffect(() => {
    let active = true;
    const unsubscribe = repo.subscribe(
      orderId,
      (order) => {
        if (!active) return;
        setState((prev) => {
          // Una consulta anterior a un cambio no debe devolver la pantalla a un estado viejo.
          const outdated = !!prev.order && !!order && prev.order.id === order.id && order.version < prev.order.version;
          return outdated ? prev : { repo, orderId, order, error: null, loading: false };
        });
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

  // Muestra de inmediato el resultado de una acción; la siguiente consulta lo confirma.
  const apply = useCallback((next: Order) => {
    setState((prev) =>
      prev.order && next.version < prev.order.version
        ? prev
        : { ...prev, order: next, error: null, loading: false });
  }, []);

  return { order: state.order, error: state.error, loading: state.loading, apply };
}