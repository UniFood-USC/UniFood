import { Stack, useLocalSearchParams } from 'expo-router';
import RestaurantMenuScreen from '../../../features/student/restaurants/RestaurantMenuScreen';
import { callService } from '../../../services/client';

export default function RestaurantMenuRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <RestaurantMenuScreen restaurantId={id} service={callService} />
  </>;
}
