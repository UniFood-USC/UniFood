import { Redirect } from 'expo-router';
import { useSession } from '../features/identity/SessionProvider';
import { roleDestination } from '../domain/navigation';

export default function HomeRoute() {
  const { identity } = useSession();
  return <Redirect href={identity ? roleDestination(identity.role)! : '/login'} />;
}
