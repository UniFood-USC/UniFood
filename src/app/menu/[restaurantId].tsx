import { Stack, useLocalSearchParams } from 'expo-router';
import MenuScreen from '../../features/student/menu/MenuScreen';
import { menuService } from '../../features/student/menu/menuRoutes';

// RF-06 · Menú del restaurante. La protección por rol está en _layout (guard de estudiante).
export default function MenuRoute() {
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <MenuScreen restaurantId={String(restaurantId)} service={menuService} />
  </>;
}
