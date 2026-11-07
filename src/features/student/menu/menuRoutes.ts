import { callService } from '../../../services/client';

// RF-06 · Rutas y servicio del menú (propios del módulo para no tocar archivos compartidos).
export const menuRoutes = {
  restaurantMenu: (restaurantId: string) => ({ pathname: '/menu/[restaurantId]', params: { restaurantId } }) as const,
  productDetail: (restaurantId: string, productId: string) => ({ pathname: '/product/[productId]', params: { productId, restaurantId } }) as const,
  restaurantList: '/restaurants',
} as const;

// Las acciones 'menu/list' y 'menu/product' las atiende functions/src/index.ts.
export const menuService = callService as unknown as (action: 'menu/list' | 'menu/product', input: unknown) => ReturnType<typeof callService>;
