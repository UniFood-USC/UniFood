import { act, renderHook } from '@testing-library/react-native';
import { useOrderTracking } from '../../src/features/student/tracking/useOrderTracking';
import type { OrderRepository } from '../../src/features/student/tracking/orderRepository';
import type { Order } from '../../src/types/domain';

function controlledRepository() {
  const subscriptions: { change: (order: Order | null) => void; error: (error: Error) => void; stop: jest.Mock }[] = [];
  const repo: OrderRepository = { subscribe: (_id, change, error) => {
    const stop = jest.fn();
    subscriptions.push({ change, error, stop });
    return stop;
  } };
  return { repo, subscriptions };
}

test('cambiar pedido limpia el error anterior e ignora respuestas de la suscripción cerrada', async () => {
  const { repo, subscriptions } = controlledRepository();
  const { result, rerender, unmount } = await renderHook(
    ({ id }: { id: string }) => useOrderTracking(repo, id), { initialProps: { id: 'a' } },
  );
  await act(() => subscriptions[0].error(new Error('Sin conexión')));
  expect(result.current.error).not.toBeNull();
  await rerender({ id: 'b' });
  expect(subscriptions[0].stop).toHaveBeenCalledTimes(1);
  expect(result.current).toEqual({ order: null, error: null, loading: true });
  await act(() => subscriptions[0].error(new Error('Respuesta tardía')));
  expect(result.current).toEqual({ order: null, error: null, loading: true });
  await act(() => subscriptions[1].change(null));
  expect(result.current).toEqual({ order: null, error: null, loading: false });
  await unmount();
  expect(subscriptions[1].stop).toHaveBeenCalledTimes(1);
});

test('cambiar repositorio para el mismo pedido vuelve a carga y permite recuperarse de un error', async () => {
  const first = controlledRepository();
  const second = controlledRepository();
  const { result, rerender } = await renderHook(
    ({ repo }: { repo: OrderRepository }) => useOrderTracking(repo, 'a'), { initialProps: { repo: first.repo } },
  );
  await act(() => first.subscriptions[0].change(null));
  await rerender({ repo: second.repo });
  expect(result.current.loading).toBe(true);
  await act(() => second.subscriptions[0].error(new Error('Sin conexión')));
  expect(result.current.loading).toBe(false);
  await act(() => second.subscriptions[0].change(null));
  expect(result.current).toEqual({ order: null, error: null, loading: false });
});
