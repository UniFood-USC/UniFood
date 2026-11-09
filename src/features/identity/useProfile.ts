import { useEffect, useState } from 'react';
import { callService } from '../../services/client';
import type { UserRole } from '../../types/domain';
import { useSession } from './SessionProvider';

export type Profile = { id: string; name: string; email: string; role: UserRole };

// Perfil propio desde el servicio, que comprueba sesión y estado vigente.
export function useProfile() {
  const { identity } = useSession();
  const [state, setState] = useState<{ profile: Profile | null; error: string }>({ profile: null, error: '' });
  useEffect(() => {
    if (!identity) return;
    let active = true;
    callService<Profile>('profile', { id: identity.id })
      .then(result => { if (active) setState(result.codigo === 'OK' && result.datos ? { profile: result.datos, error: '' } : { profile: null, error: result.mensaje }); })
      .catch(() => { if (active) setState({ profile: null, error: 'No pudimos cargar tu perfil. Revisa la conexión.' }); });
    return () => { active = false; };
  }, [identity]);
  return state;
}
