import { router } from 'expo-router';
import { RecoveryRequestScreen } from '../features/identity/RecoveryScreens';
import { callService } from '../services/client';

export default function RecoverRoute() {
  return <RecoveryRequestScreen request={input => callService('recovery/request', input)} onBack={() => router.replace('/login')} />;
}
