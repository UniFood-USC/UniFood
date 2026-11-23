import { StaffOrdersView } from '../../components/StaffOrdersView';
import { useSession } from '../../features/identity/SessionProvider';

// Pedidos del restaurante (vista de pedidos de Nahia, RF-17 y RF-18).
export default function Route() {
  const { identity } = useSession();
  const restaurantId = identity?.restaurantId;
  return <StaffOrdersView title="Pedidos" filter={{ restaurantId }}
    actor={{ id: identity?.id ?? '', role: 'restaurant', ...(restaurantId ? { restaurantId } : {}) }} fallback="/restaurant" />;
}
