import UsersScreen from './UsersScreen';
import { callService } from '../../services/client';
export default function AdminScreen() {
  return <UsersScreen service={callService} />;
}
