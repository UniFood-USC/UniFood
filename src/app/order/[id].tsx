import { Stack, useLocalSearchParams } from 'expo-router';
import OrderTrackingScreen from '../../features/student/tracking/OrderTrackingScreen';

export default function OrderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <OrderTrackingScreen orderId={id} />
    </>
  );
}