import ProductsScreen from '../../features/restaurant/ProductsScreen';
import { productService } from '../../features/restaurant/productService';

// RF-16 · Gestión de productos del restaurante.
export default function Route() {
  return <ProductsScreen service={productService} />;
}
