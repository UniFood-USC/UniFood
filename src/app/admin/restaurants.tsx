import RestaurantsAdminScreen from '../../features/admin/RestaurantsAdminScreen';
import { callService } from '../../services/client';

// RF-22 · Gestión de restaurantes (administración).
export default function Route() {
  return <RestaurantsAdminScreen service={callService} />;
}
