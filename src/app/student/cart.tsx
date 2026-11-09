import CartScreen from '../../features/cart/CartScreen';
import { callService } from '../../services/client';

export default function Route() {
  return <CartScreen service={callService} />;
}
