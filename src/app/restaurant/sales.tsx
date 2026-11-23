import SalesHistoryScreen from '../../features/restaurant/SalesHistoryScreen';
import { useSession } from '../../features/identity/SessionProvider';

// Ventas del restaurante de la cuenta (historial de Nahia, RF-19 y RF-20).
export default function Route() {
  const { identity } = useSession();
  return <SalesHistoryScreen restaurantId={identity?.restaurantId} />;
}
