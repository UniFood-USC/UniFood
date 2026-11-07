// Avisos privados (RF-12, RF-17). Un evento confirmado (nuevo pedido, listo, cancelación,
// reembolso) produce un aviso por destinatario con identificador estable, así que procesar
// el mismo evento otra vez no duplica avisos.

const texts = {
  new_order: { title: 'Nuevo pedido', message: (n: string) => `Recibiste el pedido #${n}.` },
  order_ready: { title: 'Pedido listo', message: (n: string) => `Tu pedido #${n} está listo para recoger.` },
  order_cancelled: { title: 'Pedido cancelado', message: (n: string) => `El pedido #${n} fue cancelado.` },
  refund: { title: 'Reembolso simulado', message: (n: string) => `Se registró el reembolso simulado del pedido #${n}.` },
} as const;

export type NoticeKind = keyof typeof texts;
export type NoticeEvent = { id: string; kind: NoticeKind; orderId: string; orderNumber: string; recipients: string[]; occurredAt: string };
export type Notice = { id: string; eventId: string; kind: NoticeKind; orderId: string; orderNumber: string; title: string; message: string; createdAt: string };

const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const isId = (value: unknown): value is string => typeof value === 'string' && idPattern.test(value);

export function validateNoticeEvent(input: unknown): NoticeEvent {
  const keys = ['id', 'kind', 'orderId', 'orderNumber', 'recipients', 'occurredAt'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.includes(key))) throw new Error('Revisa los datos del evento.');
  const { id, kind, orderId, orderNumber, recipients, occurredAt } = input as Record<string, unknown>;
  if (!isId(id) || !isId(orderId) || typeof kind !== 'string' || !Object.hasOwn(texts, kind)) throw new Error('El evento no es válido.');
  if (typeof orderNumber !== 'string' || !orderNumber.trim()) throw new Error('El evento debe indicar el número de pedido.');
  if (!Array.isArray(recipients) || !recipients.length || !recipients.every(isId) || new Set(recipients).size !== recipients.length) throw new Error('El evento debe tener destinatarios distintos.');
  if (typeof occurredAt !== 'string' || Number.isNaN(Date.parse(occurredAt))) throw new Error('El evento debe tener una fecha válida.');
  return { id, kind: kind as NoticeKind, orderId, orderNumber, recipients, occurredAt };
}

export const noticeId = (eventId: string, recipientId: string) => `${eventId}_${recipientId}`;

export function noticeFor(event: NoticeEvent, recipientId: string): Notice & { recipientId: string } {
  const text = texts[event.kind];
  return {
    id: noticeId(event.id, recipientId), eventId: event.id, recipientId, kind: event.kind, orderId: event.orderId, orderNumber: event.orderNumber,
    title: text.title, message: text.message(event.orderNumber), createdAt: event.occurredAt,
  };
}

export const newestFirst = (a: { createdAt: string }, b: { createdAt: string }) => Date.parse(b.createdAt) - Date.parse(a.createdAt);
