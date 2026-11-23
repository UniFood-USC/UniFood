import { StaffOrdersView } from '../../components/StaffOrdersView';
import { useSession } from '../../features/identity/SessionProvider';

// Todos los pedidos para el administrador (vista de pedidos de Nahia, RF-18 y RF-23).
export default function Route() {
  const { identity } = useSession();
  return <StaffOrdersView title="Todos los pedidos" filter={{}} actor={{ id: identity?.id ?? '', role: 'admin' }} fallback="/admin" showRestaurant />;
}
