import { render } from '@testing-library/react-native';
import RestaurantOrders from '../../src/app/restaurant/index';
import AdminOrders from '../../src/app/admin/orders';
import { StaffOrdersView } from '../../src/components/StaffOrdersView';

let mockIdentity: object = {};
jest.mock('../../src/features/identity/SessionProvider', () => ({ useSession: () => ({ identity: mockIdentity }) }));
jest.mock('../../src/components/StaffOrdersView', () => ({ StaffOrdersView: jest.fn(() => null) }));
const lastProps = () => jest.mocked(StaffOrdersView).mock.calls.at(-1)![0];

test('la pestaña Pedidos del restaurante muestra solo los de su restaurante y actúa como restaurante', async () => {
  mockIdentity = { id: 'demo-restaurant', role: 'restaurant', state: 'active', restaurantId: 'rest-burger' };
  await render(<RestaurantOrders />);
  expect(lastProps()).toEqual({ title: 'Pedidos', filter: { restaurantId: 'rest-burger' }, actor: { id: 'demo-restaurant', role: 'restaurant', restaurantId: 'rest-burger' }, fallback: '/restaurant' });
});

test('la pestaña Pedidos del administrador muestra todos con su restaurante', async () => {
  mockIdentity = { id: 'demo-admin-1', role: 'admin', state: 'active' };
  await render(<AdminOrders />);
  expect(lastProps()).toEqual({ title: 'Todos los pedidos', filter: {}, actor: { id: 'demo-admin-1', role: 'admin' }, fallback: '/admin', showRestaurant: true });
});
