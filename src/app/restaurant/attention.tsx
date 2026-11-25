import RestaurantInfoScreen from '../../features/restaurant/RestaurantInfoScreen';
import { callService } from '../../services/client';

// RF-22 · Información, horario y cierre temporal del restaurante.
export default function Route() {
  return <RestaurantInfoScreen service={callService} />;
}
