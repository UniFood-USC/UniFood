import { Stack, useLocalSearchParams } from 'expo-router';
import ProductDetailScreen from '../../features/student/menu/ProductDetailScreen';
import { menuService } from '../../features/student/menu/menuRoutes';

// RF-06 · Detalle del producto. La protección por rol está en _layout (guard de estudiante).
export default function ProductRoute() {
  const { restaurantId, productId } = useLocalSearchParams<{ restaurantId: string; productId: string }>();
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <ProductDetailScreen restaurantId={String(restaurantId)} productId={String(productId)} service={menuService} />
  </>;
}
