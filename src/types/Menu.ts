import type { RestaurantePublico } from './Estado_Restaurante';

// RF-06 · Menú de cada restaurante.
// Documento tal como está en Firestore: restaurantes/{restaurantId}/productos/{productId}.
// Vivir dentro del restaurante garantiza que una consulta nunca mezcle productos de otro.
export interface PromocionDoc {
  porcentaje: number;   // entero de 5 a 90 (misma regla que el carrito)
  desde?: string;       // ISO; sin valor = ya vigente
  hasta?: string;       // ISO; sin valor = sin vencimiento
}

export interface ProductoDoc {
  nombre: string;
  descripcion?: string;
  precioCOP: number;            // pesos colombianos enteros
  fotos?: string[];             // solo https
  disponible?: boolean;         // true = disponible; cualquier otro valor = agotado
  activo?: boolean;             // false = oculto del menú
  promocion?: PromocionDoc | null;
  // ...otros campos privados (costo, notas internas) que NO se exponen
}

export interface PromocionAplicada {
  porcentaje: number;
  precioFinalCOP: number;
}

// Lo que ve el estudiante en la lista del menú.
export interface ProductoMenu {
  id: string;
  nombre: string;
  precioCOP: number;
  disponible: boolean;
  promocion?: PromocionAplicada;
  foto?: string;
}

// Lo que ve el estudiante al abrir un producto.
export interface ProductoDetalle extends ProductoMenu {
  descripcion: string;
  fotos: string[];
}

export interface MenuRestaurante { restaurante: RestaurantePublico; productos: ProductoMenu[] }
export interface DetalleProducto { restaurante: RestaurantePublico; producto: ProductoDetalle }
