import { act, renderHook } from '@testing-library/react-native';
import { useNoticeAlerts } from '../../src/features/notifications/useNoticeAlerts';
import { response } from '../../src/domain/response';

const notice = (id: string, title: string) => ({ id, eventId: id, kind: 'order_ready', orderId: 'p', orderNumber: 'UC1', title, message: `${title} detalle`, createdAt: '2026-11-07T12:00:00Z' });
const listing = (...notices: ReturnType<typeof notice>[]) => response('OK', 'Avisos consultados.', { notices });
const tick = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

test('los avisos que ya existían al entrar no suenan; cada aviso nuevo se muestra una sola vez', async () => {
  const service = jest.fn().mockResolvedValue(listing(notice('a', 'Viejo')));
  const notify = jest.fn(async () => undefined);
  await renderHook(() => useNoticeAlerts(service, notify, 1000));
  await tick(0);
  expect(service).toHaveBeenCalledWith('notifications/list', {});
  expect(notify).not.toHaveBeenCalled();

  service.mockResolvedValue(listing(notice('b', 'Pedido listo'), notice('a', 'Viejo')));
  await tick(1000);
  expect(notify).toHaveBeenCalledTimes(1);
  expect(notify).toHaveBeenCalledWith('Pedido listo', 'Pedido listo detalle');
  await tick(1000);
  expect(notify).toHaveBeenCalledTimes(1);
});

test('sin conexión no muestra nada ni se detiene, y al salir deja de consultar', async () => {
  const service = jest.fn().mockRejectedValueOnce(new Error('sin red')).mockResolvedValue(listing());
  const notify = jest.fn(async () => undefined);
  const { unmount } = await renderHook(() => useNoticeAlerts(service, notify, 1000));
  await tick(0);
  await tick(1000);
  expect(notify).not.toHaveBeenCalled();
  service.mockResolvedValue(listing(notice('c', 'Nuevo pedido')));
  await tick(1000);
  expect(notify).toHaveBeenCalledWith('Nuevo pedido', 'Nuevo pedido detalle');
  const calls = service.mock.calls.length;
  await unmount();
  await tick(5000);
  expect(service).toHaveBeenCalledTimes(calls);
});
