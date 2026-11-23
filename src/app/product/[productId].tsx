import { Stack, useLocalSearchParams } from 'expo-router';
import ProductDetailScreen from '../../features/student/menu/ProductDetailScreen';
import { menuService } from '../../features/student/menu/menuService';
import AddToCartButton from '../../features/cart/AddToCartButton';
import { callService } from '../../services/client';

// RF-06 · Detalle del producto. La protección por rol está en _layout (guard de estudiante).
export default function ProductRoute() {
  const { restaurantId, productId } = useLocalSearchParams<{ restaurantId: string; productId: string }>();
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <ProductDetailScreen key={`${String(restaurantId)}/${String(productId)}`} restaurantId={String(restaurantId)} productId={String(productId)} service={menuService}
      addToCart={producto => <AddToCartButton restaurantId={String(restaurantId)} product={producto} service={callService} />} />
  </>;
}
