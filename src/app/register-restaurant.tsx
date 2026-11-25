import { router } from 'expo-router';
import RestaurantRegistrationScreen from '../features/restaurant/RestaurantRegistrationScreen';
import { callService } from '../services/client';

export default function RegisterRestaurantRoute() {
  return <RestaurantRegistrationScreen service={callService} onDone={() => router.replace('/login')}
    onBack={() => router.canGoBack() ? router.back() : router.replace('/login')} />;
}
