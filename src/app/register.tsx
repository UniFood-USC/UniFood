import { router } from 'expo-router';
import RegistrationScreen from '../features/identity/RegistrationScreen';
import { useSession } from '../features/identity/SessionProvider';

export default function RegisterRoute() {
  const { register } = useSession();
  return <RegistrationScreen register={register} onCreated={() => router.replace('/student')} onLogin={() => router.replace('/login')}
    onBack={() => router.canGoBack() ? router.back() : router.replace('/')} />;
}
