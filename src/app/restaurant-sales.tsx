import { Stack } from 'expo-router';
import SalesHistoryScreen from '../features/restaurant/SalesHistoryScreen';

export default function RestaurantSalesRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SalesHistoryScreen />
    </>
  );
}
