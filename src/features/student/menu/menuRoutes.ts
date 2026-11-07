// RF-06 · Rutas del menú (sin dependencias: lo importan las tarjetas y las pruebas de UI).
export const menuRoutes = {
  restaurantMenu: (restaurantId: string) => ({ pathname: '/menu/[restaurantId]', params: { restaurantId } }) as const,
  productDetail: (restaurantId: string, productId: string) => ({ pathname: '/product/[productId]', params: { productId, restaurantId } }) as const,
  restaurantList: '/restaurants',
} as const;
