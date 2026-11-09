import { Order } from '../../../src/types/domain';
import { Actor, applyChange } from '../../../src/services/orders/changeOrder';
import { estimateState } from '../../../src/services/orders/estimate';

const restaurant: Actor = { role: 'restaurant', id: 'r1', restaurantId: 'rest-1' };
const student: Actor = { role: 'student', id: 's1' };
const t0 = new Date('2026-10-24T15:00:00.000Z');
const at = (min: number) => new Date(t0.getTime() + min * 60_000);
type OrderWithEstimate = Order & {
  estimateMinutes?: number;
  estimatedReadyAt?: string | null;
};
const withEstimate = (o: Order): OrderWithEstimate => o as OrderWithEstimate;

const make = (o: Partial<OrderWithEstimate> = {}): Order => ({
  id: 'UC1', studentId: 's1', restaurantId: 'rest-1', mode: 'pickup', status: 'received',
  paymentMethod: 'nequi', total: 30000, paid: true, version: 0,
  createdAt: t0.toISOString(), updatedAt: t0.toISOString(), ...o,
} as Order);

const preparing = (minutes = 20): Order => {
  const r = applyChange(make(), { type: 'advance', estimateMinutes: minutes }, restaurant, 0, t0);
  if (!r.ok) throw new Error('debía iniciar la preparación');
  return r.order;
};

describe('iniciar preparación exige estimación', () => {
  it('sin minutos se rechaza', () => {
    const r = applyChange(make(), { type: 'advance' }, restaurant, 0, t0);
    expect(r.ok === false && r.error).toBe('invalid_estimate');
  });

  it.each([0, -5, 181, 2.5, NaN])('rechaza %p minutos', (m) => {
    const r = applyChange(make(), { type: 'advance', estimateMinutes: m }, restaurant, 0, t0);
    expect(r.ok === false && r.error).toBe('invalid_estimate');
  });

  it.each([1, 20, 180])('acepta %p minutos y cuenta desde el registro', (m) => {
    const r = applyChange(make(), { type: 'advance', estimateMinutes: m }, restaurant, 0, t0);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const order = r.order as OrderWithEstimate;
      expect(order.status).toBe('preparing');
      expect(order.estimateMinutes).toBe(m);
      expect(order.estimatedReadyAt).toBe(at(m).toISOString());
    }
  });
});

describe('actualizar la estimación', () => {
  it('reinicia la referencia desde el momento de la actualización', () => {
    const o = preparing(20);
    const r = applyChange(o, { type: 'updateEstimate', minutes: 30 }, restaurant, o.version, at(10));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.order.status).toBe('preparing');
      expect(r.order.estimatedReadyAt).toBe(at(40).toISOString());
    }
  });

  it('solo se permite mientras está en preparación', () => {
    const received = applyChange(make(), { type: 'updateEstimate', minutes: 10 }, restaurant, 0, t0);
    expect(received.ok === false && received.error).toBe('invalid_transition');
    const ready = make({ status: 'ready' });
    expect(applyChange(ready, { type: 'updateEstimate', minutes: 10 }, restaurant, 0, t0).ok).toBe(false);
  });

  it('valida el rango y el actor', () => {
    const o = preparing();
    const bad = applyChange(o, { type: 'updateEstimate', minutes: 181 }, restaurant, o.version, t0);
    expect(bad.ok === false && bad.error).toBe('invalid_estimate');
    expect(applyChange(o, { type: 'updateEstimate', minutes: 10 }, student, o.version, t0).ok).toBe(false);
    const other: Actor = { ...restaurant, restaurantId: 'rest-2' };
    expect(applyChange(o, { type: 'updateEstimate', minutes: 10 }, other, o.version, t0).ok).toBe(false);
  });
});

describe('estimateState (lo que ve el estudiante)', () => {
  it('muestra los minutos restantes', () => {
    expect(estimateState(preparing(20), at(5))).toEqual({ kind: 'remaining', minutes: 15 });
  });

  it('al agotarse la estimación avisa la demora sin cambiar el estado', () => {
    const o = preparing(20);
    expect(estimateState(o, at(20))).toEqual({ kind: 'late' });
    expect(estimateState(o, at(45))).toEqual({ kind: 'late' });
    expect(o.status).toBe('preparing');
  });

  it('solo aplica en preparación y avisa si falta la estimación', () => {
    expect(estimateState(make(), at(5))).toEqual({ kind: 'not_preparing' });
    expect(estimateState(make({ status: 'preparing', estimatedReadyAt: null }), at(5))).toEqual({ kind: 'missing' });
  });
});