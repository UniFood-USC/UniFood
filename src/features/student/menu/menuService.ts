import { callService } from '../../../services/client';

// RF-06 · Servicio del menú, solo para las rutas de la app (cargan Firebase).
// Las acciones 'menu/list' y 'menu/product' las atiende functions/src/index.ts.
export const menuService = callService as unknown as (action: 'menu/list' | 'menu/product', input: unknown) => ReturnType<typeof callService>;
