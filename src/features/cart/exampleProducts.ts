import type { Product } from '../../domain/cart';

// Productos de ejemplo hasta que existan el menú y las promociones (RF-06, RF-24).
export const exampleProducts: Product[] = [
  { id: 'doble', restaurantId: 'rest-burger', name: 'Doble', priceCOP: 20000, discountPercent: 15 },
  { id: 'papas', restaurantId: 'rest-burger', name: 'Papas', priceCOP: 6000, discountPercent: 0 },
  { id: 'gaseosa', restaurantId: 'rest-burger', name: 'Gaseosa', priceCOP: 4000, discountPercent: 0 },
];
