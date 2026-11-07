import { newestFirst, noticeFor, noticeId, validateNoticeEvent } from '../../src/domain/notifications';

const event = { id: 'evt-1', kind: 'order_ready', orderId: 'ped-1', orderNumber: 'UC1023', recipients: ['demo-student'], occurredAt: '2026-11-07T15:00:00.000Z' };

test('un evento válido pasa la validación sin cambios', () => {
  expect(validateNoticeEvent(event)).toEqual(event);
  expect(validateNoticeEvent({ ...event, kind: 'new_order', recipients: ['demo-restaurant', 'otro'] }).recipients).toEqual(['demo-restaurant', 'otro']);
});

test.each([
  ['tipo desconocido', { ...event, kind: 'promocion' }],
  ['sin destinatarios', { ...event, recipients: [] }],
  ['destinatario repetido', { ...event, recipients: ['a', 'a'] }],
  ['identificador con barra', { ...event, id: 'evt/1' }],
  ['destinatario con barra', { ...event, recipients: ['a/b'] }],
  ['sin número de pedido', { ...event, orderNumber: '' }],
  ['fecha ilegible', { ...event, occurredAt: 'ayer' }],
  ['campo ajeno', { ...event, extra: true }],
  ['sin datos', null],
])('se rechaza un evento con %s', (_, input) => {
  expect(() => validateNoticeEvent(input)).toThrow();
});

test('cada destinatario recibe un aviso con identificador estable y texto según el tipo', () => {
  expect(noticeId('evt-1', 'demo-student')).toBe('evt-1_demo-student');
  expect(noticeFor(validateNoticeEvent(event), 'demo-student')).toEqual({
    id: 'evt-1_demo-student', eventId: 'evt-1', recipientId: 'demo-student', kind: 'order_ready', orderId: 'ped-1', orderNumber: 'UC1023',
    title: 'Pedido listo', message: 'Tu pedido #UC1023 está listo para recoger.', createdAt: '2026-11-07T15:00:00.000Z',
  });
  expect(noticeFor(validateNoticeEvent({ ...event, kind: 'new_order' }), 'r').title).toBe('Nuevo pedido');
  expect(noticeFor(validateNoticeEvent({ ...event, kind: 'order_cancelled' }), 'r').message).toBe('El pedido #UC1023 fue cancelado.');
  expect(noticeFor(validateNoticeEvent({ ...event, kind: 'refund' }), 'r').message).toBe('Se registró el reembolso simulado del pedido #UC1023.');
});

test('los avisos se ordenan del más reciente al más antiguo', () => {
  const list = [{ createdAt: '2026-11-07T10:00:00Z' }, { createdAt: '2026-11-07T12:00:00Z' }, { createdAt: '2026-11-06T23:00:00Z' }];
  expect([...list].sort(newestFirst).map(n => n.createdAt)).toEqual(['2026-11-07T12:00:00Z', '2026-11-07T10:00:00Z', '2026-11-06T23:00:00Z']);
});
