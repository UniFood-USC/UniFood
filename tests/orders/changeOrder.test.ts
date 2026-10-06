import { Order } from '../../src/types/domain';
import { Actor, applyChange } from '../../src/services/orders/changeOrder';

const restaurant: Actor = { role: 'restaurant', id: 'r1', restaurantId: 'rest-1' };
const student: Actor = { role: 'student', id: 's1' };
const admin: Actor = { role: 'admin', id: 'a1' };

const make = (o: Partial<Order> = {}): Order => ({
  id: 'UC1', studentId: 's1', restaurantId: 'rest-1', mode: 'pickup', status: 'received',
  paymentMethod: 'nequi', total: 30000, paid: true, version: 0,
  createdAt: '2026-10-05T10:00:00.000Z', updatedAt: '2026-10-05T10:00:00.000Z', ...o,
});

describe('recogida: secuencia y pago', () => {
  it('avanza sin saltos, sube la versión y no pasa de recogido', () => {
    let o = make();
    for (const [status, version] of [['preparing', 1], ['ready', 2], ['collected', 3]] as const) {
      const r = applyChange(o, { type: 'advance' }, restaurant, o.version);
      expect(r.ok).toBe(true);
      if (r.ok) { expect(r.order.status).toBe(status); expect(r.order.version).toBe(version); o = r.order; }
    }
    expect(applyChange(o, { type: 'advance' }, restaurant, o.version).ok).toBe(false);
  });

  it('exige pago registrado o importe cero para entregar', () => {
    const r = applyChange(make({ status: 'ready', paid: false }), { type: 'advance' }, restaurant, 0);
    expect(r.ok === false && r.error).toBe('payment_required');
    expect(applyChange(make({ status: 'ready', paid: false, total: 0 }), { type: 'advance' }, restaurant, 0).ok).toBe(true);
  });

  it('solo avanza el restaurante dueño del pedido', () => {
    expect(applyChange(make(), { type: 'advance' }, student, 0).ok).toBe(false);
    expect(applyChange(make(), { type: 'advance' }, admin, 0).ok).toBe(false);
    expect(applyChange(make(), { type: 'advance' }, { ...restaurant, restaurantId: 'rest-2' }, 0).ok).toBe(false);
  });
});

describe('cancelación', () => {
  it('estudiante cancela desde recibido con motivo opcional', () => {
    expect(applyChange(make(), { type: 'cancel' }, student, 0).ok).toBe(true);
  });
  it('estudiante y restaurante no cancelan después de recibido', () => {
    expect(applyChange(make({ status: 'preparing' }), { type: 'cancel', reason: 'x' }, student, 0).ok).toBe(false);
    expect(applyChange(make({ status: 'preparing' }), { type: 'cancel', reason: 'x' }, restaurant, 0).ok).toBe(false);
  });
  it('restaurante y admin deben dar motivo', () => {
    const r = applyChange(make(), { type: 'cancel', reason: '  ' }, restaurant, 0);
    expect(r.ok === false && r.error).toBe('reason_required');
    expect(applyChange(make({ status: 'preparing' }), { type: 'cancel' }, admin, 0).ok).toBe(false);
  });
  it('admin cancela un pedido en preparación con motivo', () => {
    expect(applyChange(make({ status: 'preparing' }), { type: 'cancel', reason: 'Suspensión' }, admin, 0).ok).toBe(true);
  });
  it('no se cancela un pedido recogido o entregado', () => {
    expect(applyChange(make({ status: 'collected' }), { type: 'cancel', reason: 'x' }, admin, 0).ok).toBe(false);
    expect(applyChange(make({ mode: 'delivery', status: 'delivered' }), { type: 'cancel', reason: 'x' }, admin, 0).ok).toBe(false);
  });
  it('reembolsa el total pagado una sola vez y el cancelado queda cerrado', () => {
    const first = applyChange(make(), { type: 'cancel' }, student, 0);
    if (!first.ok) throw new Error('debía cancelar');
    expect(first.order.refund?.amount).toBe(30000);
    const again = applyChange(first.order, { type: 'cancel', reason: 'x' }, admin, first.order.version);
    expect(again.ok).toBe(false);
    expect(first.order.refund).toEqual(first.order.refund);
  });
  it('no hay reembolso si no estaba pagado', () => {
    const r = applyChange(make({ paid: false }), { type: 'cancel' }, student, 0);
    expect(r.ok && r.order.refund).toBeUndefined();
  });
});

describe('carrera cancelación vs preparación (misma versión)', () => {
  it('si cancela primero el estudiante, la preparación se rechaza con el estado vigente', () => {
    const base = make();
    const cancel = applyChange(base, { type: 'cancel' }, student, 0);
    if (!cancel.ok) throw new Error('debía cancelar');
    const prep = applyChange(cancel.order, { type: 'advance' }, restaurant, 0);
    expect(prep.ok === false && prep.error).toBe('stale_version');
    expect(prep.ok === false && prep.current?.status).toBe('cancelled');
  });
  it('si inicia primero la preparación, la cancelación del estudiante se rechaza', () => {
    const base = make();
    const prep = applyChange(base, { type: 'advance' }, restaurant, 0);
    if (!prep.ok) throw new Error('debía avanzar');
    const cancel = applyChange(prep.order, { type: 'cancel' }, student, 0);
    expect(cancel.ok === false && cancel.error).toBe('stale_version');
    expect(cancel.ok === false && cancel.current?.status).toBe('preparing');
  });
});