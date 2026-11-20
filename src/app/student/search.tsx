import SearchScreen from '../../features/student/restaurants/SearchScreen';
import { callService } from '../../services/client';

export default function Route() {
  return <SearchScreen service={callService} />;
}
