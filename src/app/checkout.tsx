import CheckoutScreen from '../features/cart/CheckoutScreen';
import { callService } from '../services/client';

export default function Route() {
  return <CheckoutScreen service={callService} />;
}
