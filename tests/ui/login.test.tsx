import { fireEvent, render, screen } from '@testing-library/react-native';
import LoginScreen from '../../src/features/identity/LoginScreen';
import { response, type ServiceResponse } from '../../src/domain/response';
import type { LoginIdentity } from '../../src/services/login';

test('valida campos y muestra/oculta contraseña sin cambiarla', async () => {
  const signIn = jest.fn();
  await render(<LoginScreen signIn={signIn} onRegister={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
  expect(signIn).not.toHaveBeenCalled();
  expect(screen.getByText('Escribe tu correo y contraseña.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'Demo1234');
  await fireEvent.press(screen.getByRole('button', { name: 'Mostrar contraseña' }));
  expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Ocultar contraseña' }));
  expect(screen.getByLabelText('Contraseña').props.value).toBe('Demo1234');
});

test('bloquea doble envío y muestra rechazo conservando correo, sin conservar contraseña', async () => {
  let finish!: (result: ServiceResponse<LoginIdentity>) => void;
  const signIn = jest.fn(() => new Promise<ServiceResponse<LoginIdentity>>(resolve => { finish = resolve; }));
  await render(<LoginScreen signIn={signIn} onRegister={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'student@usc.edu.co');
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'Incorrecta1');
  await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Iniciando sesión' }));
  expect(signIn).toHaveBeenCalledTimes(1);
  await screen.findByRole('button', { name: 'Iniciando sesión' });
  finish(response('CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.'));
  expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeTruthy();
  expect(screen.getByLabelText('Correo electrónico').props.value).toBe('student@usc.edu.co');
  expect(screen.getByLabelText('Contraseña').props.value).toBe('');
});

test('crear cuenta abre el registro sin enviar credenciales', async () => {
  const onRegister = jest.fn();
  const signIn = jest.fn();
  await render(<LoginScreen signIn={signIn} onRegister={onRegister} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));
  expect(onRegister).toHaveBeenCalledTimes(1);
  expect(signIn).not.toHaveBeenCalled();
});
