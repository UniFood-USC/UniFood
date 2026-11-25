import { callService } from '../../services/client';
import type { ServiceResponse } from '../../domain/response';

// RF-16 · Servicio de gestión de productos, solo para las rutas de la app (cargan Firebase).
// Las acciones las atiende functions/src/index.ts.
export type ProductService = (action: 'products/list' | 'products/save' | 'products/remove' | 'products/photo', input: unknown) => Promise<ServiceResponse>;
export const productService: ProductService = callService;
