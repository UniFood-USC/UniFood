import { FulfillmentMode, OrderStatus } from '../../src/types/domain';
import { STATUS_FLOW, isTerminal, statusLabel } from '../../src/services/orders/statusFlow';

// Record<OrderStatus, true> obliga a TypeScript a quejarse si se agrega
// un estado a domain.ts y no se agrega aquí (correr `npx tsc --noEmit`).
const ALL_STATUSES: Record<OrderStatus, true> = {
  received: true, preparing: true, ready: true, collected: true,
  on_the_way: true, delivered: true, cancelled: true,
};
const statuses = Object.keys(ALL_STATUSES) as OrderStatus[];
const modes: FulfillmentMode[] = ['pickup', 'delivery'];

describe('STATUS_FLOW', () => {
  it.each(modes)('%s empieza en received, sin repetidos y sin cancelled', (mode) => {
    const flow = STATUS_FLOW[mode];
    expect(flow[0]).toBe('received');
    expect(new Set(flow).size).toBe(flow.length);
    expect(flow).not.toContain('cancelled');
  });

  it('recogida no incluye pasos de entrega', () => {
    expect(STATUS_FLOW.pickup).not.toContain('on_the_way');
    expect(STATUS_FLOW.pickup).not.toContain('delivered');
    expect(STATUS_FLOW.pickup.at(-1)).toBe('collected');
  });

  it('entrega no incluye collected y termina en delivered', () => {
    expect(STATUS_FLOW.delivery).not.toContain('collected');
    expect(STATUS_FLOW.delivery.at(-1)).toBe('delivered');
  });

  it('todo estado (salvo cancelled) pertenece a algún flujo', () => {
    const inFlows = new Set([...STATUS_FLOW.pickup, ...STATUS_FLOW.delivery]);
    statuses.filter((s) => s !== 'cancelled').forEach((s) => expect(inFlows.has(s)).toBe(true));
  });
});

describe('statusLabel', () => {
  it.each(modes)('todos los estados tienen etiqueta en %s', (mode) => {
    statuses.forEach((s) => expect(statusLabel(s, mode).trim()).not.toBe(''));
  });

  it('ready cambia según la modalidad', () => {
    expect(statusLabel('ready', 'pickup')).toBe('Listo para recoger');
    expect(statusLabel('ready', 'delivery')).toBe('Listo para entregar');
  });
});

describe('isTerminal', () => {
  it.each(['cancelled', 'collected', 'delivered'] as OrderStatus[])('%s es terminal', (s) => {
    expect(isTerminal(s)).toBe(true);
  });
  it.each(['received', 'preparing', 'ready', 'on_the_way'] as OrderStatus[])('%s no es terminal', (s) => {
    expect(isTerminal(s)).toBe(false);
  });
});