import { render } from '@testing-library/react-native';
import SalesTab from '../../src/app/restaurant/sales';
import SalesHistoryScreen from '../../src/features/restaurant/SalesHistoryScreen';

jest.mock('../../src/features/identity/SessionProvider', () => ({ useSession: () => ({ identity: { id: 'demo-restaurant', role: 'restaurant', state: 'active', restaurantId: 'rest-burger' } }) }));
jest.mock('../../src/features/restaurant/SalesHistoryScreen', () => jest.fn(() => null));

test('la pestaña Ventas muestra el historial del restaurante de la cuenta', async () => {
  await render(<SalesTab />);
  expect(jest.mocked(SalesHistoryScreen).mock.calls.at(-1)![0]).toEqual({ restaurantId: 'rest-burger' });
});
