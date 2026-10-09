import { router } from 'expo-router';
import RegistrationScreen from '../features/identity/RegistrationScreen';
import { registerStudent } from '../services/registration';

export default function RegisterRoute() {
  return <RegistrationScreen register={registerStudent} onCreated={() => router.replace('/student')}
    onBack={() => router.canGoBack() ? router.back() : router.replace('/')} />;
}
