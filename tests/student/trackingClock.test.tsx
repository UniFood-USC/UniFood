import { act, render, screen } from '@testing-library/react-native';
import OrderTrackingScreen from '../../src/features/student/tracking/OrderTrackingScreen';
import { mockOrders } from '../../src/features/student/tracking/orderRepository';

jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => false, replace: jest.fn() }) }));

test('el aviso de demora se actualiza con el reloj y el temporizador se limpia al salir', async () => {
  jest.useFakeTimers();
  const intervals = jest.spyOn(global, 'setInterval');
  const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
  jest.setSystemTime(new Date('2026-10-08T15:00:00Z'));
  mockOrders.patch({ status: 'preparing', estimatedReadyAt: '2026-10-08T15:00:20Z' });
  try {
    const { unmount } = await render(<OrderTrackingScreen />);
    expect(screen.queryByText(/está tardando/)).toBeNull();
    await act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByText(/está tardando/)).toBeTruthy();
    await act(() => mockOrders.setStatus('collected'));
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
