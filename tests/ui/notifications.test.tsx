import { act, fireEvent, render, screen } from '@testing-library/react-native';
import NotificationsScreen from '../../src/features/notifications/NotificationsScreen';
import { response } from '../../src/domain/response';

const mockFocus: { run?: () => void } = {};
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { useFocusEffect: (effect: () => void) => { mockFocus.run = effect; useEffect(effect, [effect]); } };
});

const notice = (id: string, title: string, createdAt: string) => ({ id, eventId: id, kind: 'order_ready', orderId: 'p', orderNumber: 'UC1', title, message: `${title} detalle`, createdAt });

test('muestra los avisos propios en el orden recibido, del más reciente al más antiguo', async () => {
  const service = jest.fn().mockResolvedValue(response('OK', 'Avisos consultados.', { notices: [notice('b', 'Pedido listo', '2026-11-07T12:00:00Z'), notice('a', 'Reembolso simulado', '2026-11-07T10:00:00Z')] }));
  await render(<NotificationsScreen service={service} />);
  expect(await screen.findByText('Pedido listo')).toBeTruthy();
  const titles = screen.getAllByRole('header').map(node => node.props.children).filter((text: string) => text !== 'Avisos');
  expect(titles).toEqual(['Pedido listo', 'Reembolso simulado']);
  expect(screen.getByText('Pedido listo detalle')).toBeTruthy();
  expect(service).toHaveBeenCalledWith('notifications/list', {});
});

test('sin avisos lo indica y al volver a la pantalla consulta de nuevo', async () => {
  const service = jest.fn().mockResolvedValue(response('OK', 'Avisos consultados.', { notices: [] }));
  await render(<NotificationsScreen service={service} />);
  expect(await screen.findByText('Todavía no tienes avisos.')).toBeTruthy();
  service.mockResolvedValueOnce(response('OK', 'Avisos consultados.', { notices: [notice('c', 'Nuevo pedido', '2026-11-07T13:00:00Z')] }));
  await act(async () => mockFocus.run!());
  expect(screen.getByText('Nuevo pedido')).toBeTruthy();
});

test('si no se pueden consultar se avisa y se reintenta al pulsar', async () => {
  const service = jest.fn()
    .mockRejectedValueOnce(new Error('sin red'))
    .mockResolvedValue(response('OK', 'Avisos consultados.', { notices: [notice('d', 'Pedido cancelado', '2026-11-07T14:00:00Z')] }));
  await render(<NotificationsScreen service={service} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Pedido cancelado')).toBeTruthy();
});
