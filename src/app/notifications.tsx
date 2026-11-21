import NotificationsScreen from '../features/notifications/NotificationsScreen';
import { callService } from '../services/client';

export default function Route() {
  return <NotificationsScreen service={callService} />;
}
