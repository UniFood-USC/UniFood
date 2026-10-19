import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { localFirebase } from '../../services/firebase';
import { login, type LoginIdentity } from '../../services/login';
import { registerStudent } from '../../services/registration';
import { callService } from '../../services/client';
import { response, type ServiceResponse } from '../../domain/response';
import type { RegistrationInput } from '../../domain/registration';

type Session = {
  identity: LoginIdentity | null;
  message: string;
  signIn: (input: { email: string; password: string }) => Promise<ServiceResponse<LoginIdentity>>;
  register: (input: RegistrationInput) => Promise<ServiceResponse>;
  logout: () => Promise<void>;
};
const Context = createContext<Session | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [identity, setIdentity] = useState<LoginIdentity | null>(null);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    const invalidatePending = () => { generation.current++; };
    const { auth } = localFirebase();
    const unsubscribe = onAuthStateChanged(auth, user => {
      // Un usuario de Auth por sí solo no habilita vistas: falta comprobar el perfil.
      if (!user) setIdentity(null);
    });
    return () => { invalidatePending(); unsubscribe(); };
  }, []);

  async function logout() {
    generation.current++;
    setIdentity(null);
    setMessage('');
    try { await signOut(localFirebase().auth); }
    catch { setMessage('La vista se cerró. No pudimos completar la salida; vuelve a intentarlo antes de acceder.'); }
  }

  async function signIn(input: { email: string; password: string }) {
    const current = ++generation.current;
    setIdentity(null);
    setMessage('');
    const result = await login(input);
    if (current !== generation.current) {
      await signOut(localFirebase().auth);
      return response<LoginIdentity>('SESION_REQUERIDA', 'Inicia sesión de nuevo.');
    }
    if (result.codigo === 'OK' && result.datos) setIdentity(result.datos);
    return result;
  }

  async function register(input: RegistrationInput): Promise<ServiceResponse> {
    const current = ++generation.current;
    setIdentity(null);
    setMessage('');
    await signOut(localFirebase().auth);
    const result = await registerStudent(input);
    if (result.codigo !== 'OK') return result;
    try {
      const checked = await callService<LoginIdentity>('identity', {});
      if (current !== generation.current || checked.codigo !== 'OK' || !checked.datos) throw new Error('Sesión no confirmada');
      setIdentity(checked.datos);
      return result;
    } catch {
      await signOut(localFirebase().auth);
      return response('EN_PROCESO', 'Tu cuenta se creó. Inicia sesión para continuar; no vuelvas a registrarla.');
    }
  }

  return <Context.Provider value={{ identity, message, signIn, register, logout }}>{children}</Context.Provider>;
}

export function useSession() {
  const session = useContext(Context);
  if (!session) throw new Error('Falta SessionProvider.');
  return session;
}
