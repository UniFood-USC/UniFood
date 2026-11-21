import { act, render, screen } from '@testing-library/react-native';
import OrderTrackingScreen from '../../src/features/student/tracking/OrderTrackingScreen';
import { mockOrders } from '../../src/services/orders/orderRepository';

jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => false, replace: jest.fn() }) }));
jest.mock('../../src/features/identity/SessionProvider', () => ({
  useSession: () => ({ identity: { id: 'mock-student', role: 'student', state: 'active' } }),
}));

test('el aviso de demora se actualiza con el reloj y el temporizador se limpia al salir', async () => {
  jest.useFakeTimers();
  const intervals = jest.spyOn(global, 'setInterval');
  const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
  jest.setSystemTime(new Date('2026-10-08T15:00:00Z'));
  mockOrders.patch('UC1023', { status: 'preparing', estimatedReadyAt: '2026-10-08T15:00:20Z' });
  try {
    const { unmount } = await render(<OrderTrackingScreen orderId="UC1023" repository={mockOrders.repo} />);
    expect(screen.queryByText(/está tardando/)).toBeNull();
    await act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByText(/está tardando/)).toBeTruthy();
    await act(() => mockOrders.setStatus('UC1023', 'collected'));
    expect(screen.queryByText(/está tardando/)).toBeNull();
    await unmount();
    const clockInterval = intervals.mock.calls.findIndex(([, delay]) => delay === 30_000);
    expect(clockInterval).toBeGreaterThanOrEqual(0);
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervals.mock.results[clockInterval].value);
  } finally {
    intervals.mockRestore();
    clearIntervalSpy.mockRestore();
    jest.useRealTimers();
  }
});
