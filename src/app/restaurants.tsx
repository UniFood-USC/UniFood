import { Stack } from 'expo-router';
import RestaurantsScreen from '../features/student/restaurants/RestaurantsScreen';
import { callService } from '../services/client';

// RF-04 · Listado de restaurantes. La protección por rol está en _layout (guard de estudiante).
export default function RestaurantsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <RestaurantsScreen service={callService} />
    </>
  );
}
