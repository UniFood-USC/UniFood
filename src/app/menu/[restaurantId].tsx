import { Stack, useLocalSearchParams } from 'expo-router';
import MenuScreen from '../../features/student/menu/MenuScreen';
import { menuService } from '../../features/student/menu/menuService';

// RF-06 · Menú del restaurante. La protección por rol está en _layout (guard de estudiante).
export default function MenuRoute() {
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <MenuScreen key={String(restaurantId)} restaurantId={String(restaurantId)} service={menuService} />
  </>;
}
