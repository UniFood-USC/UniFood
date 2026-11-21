import { render, screen } from '@testing-library/react-native';
import { describe, expect, it } from '@jest/globals';
import { EstimateNotice } from '../../../src/components/EstimateNotice';
import type { Order } from '../../../src/types/domain';

const min = 60_000;
const make = (o: Partial<Order> = {}): Order => ({
  id: 'UC1', studentId: 's1', restaurantId: 'rest-1', mode: 'pickup', status: 'preparing',
  paymentMethod: 'nequi', total: 30000, paid: true, version: 0,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...o,
});

describe('EstimateNotice', () => {
  it('muestra el tiempo restante como estimación', async () => {
    const order = make({ estimatedReadyAt: new Date(Date.now() + 10 * min).toISOString() });
    await render(<EstimateNotice order={order} />);
    expect(screen.getByText(/Es una estimación/)).toBeTruthy();
  });

  it('avisa la demora cuando se agotó la estimación', async () => {
    const order = make({ estimatedReadyAt: new Date(Date.now() - 5 * min).toISOString() });
    await render(<EstimateNotice order={order} />);
    expect(screen.getByText('El pedido está tardando más de lo estimado.')).toBeTruthy();
  });

  it('no avisa demora cuando el pedido ya está listo', async () => {
    const order = make({ status: 'ready', estimatedReadyAt: new Date(Date.now() - 5 * min).toISOString() });
    await render(<EstimateNotice order={order} />);
    expect(screen.queryByText(/tardando más/)).toBeNull();
  });
});