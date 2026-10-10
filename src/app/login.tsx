import { Redirect, router } from 'expo-router';
import LoginScreen from '../features/identity/LoginScreen';
import { useSession } from '../features/identity/SessionProvider';
import { roleDestination } from '../domain/navigation';

export default function LoginRoute() {
  const { identity, signIn, message } = useSession();
  if (identity) return <Redirect href={roleDestination(identity.role)!} />;
  return <LoginScreen signIn={signIn} sessionMessage={message} onRegister={() => router.push('/register')} onRecover={() => router.push('/recover')} />;
}
