import { Stack } from 'expo-router';
import OrdersScreen from '../features/student/orders/OrdersScreen';

export default function OrdersRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <OrdersScreen />
    </>
  );
}