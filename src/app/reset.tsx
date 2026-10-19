import { router, useLocalSearchParams } from 'expo-router';
import { ResetPasswordScreen } from '../features/identity/RecoveryScreens';
import { useSession } from '../features/identity/SessionProvider';
import { callService } from '../services/client';

// Entrada del enlace recibido por correo; no exige sesión previa.
export default function ResetRoute() {
  const { id, code } = useLocalSearchParams<{ id?: string; code?: string }>();
  const { logout } = useSession();
  return <ResetPasswordScreen id={id} code={code} complete={input => callService('recovery/complete', input)}
    onCompleted={() => { void logout(); }} onLogin={() => router.replace('/login')} onRequestNew={() => router.replace('/recover')} />;
}
