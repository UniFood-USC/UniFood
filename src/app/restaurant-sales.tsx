import { Stack } from 'expo-router';
import SalesHistoryScreen from '../features/restaurant/SalesHistoryScreen';
import { useSession } from '../features/identity/SessionProvider';

export default function RestaurantSalesRoute() {
  const { identity } = useSession();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SalesHistoryScreen restaurantId={identity?.restaurantId} />
    </>
  );
}
