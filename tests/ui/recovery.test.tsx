import { fireEvent, render, screen } from '@testing-library/react-native';
import { RecoveryRequestScreen, ResetPasswordScreen } from '../../src/features/identity/RecoveryScreens';
import { response, type ServiceResponse } from '../../src/domain/response';

const generic = 'Si existe una cuenta con ese correo, recibirás un enlace.';
const failure = 'No pudimos procesar la solicitud. Inténtalo de nuevo.';

test('solicitud muestra el mensaje genérico y envía una sola vez', async () => {
  let finish!: (result: ServiceResponse) => void;
  const request = jest.fn(() => new Promise<ServiceResponse>(resolve => { finish = resolve; }));
  await render(<RecoveryRequestScreen request={request} onBack={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Enviar enlace' }));
  expect(request).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'nadie@usc.edu.co');
  await fireEvent.press(screen.getByRole('button', { name: 'Enviar enlace' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Enviando…' }));
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith({ email: 'nadie@usc.edu.co' });
  finish(response('OK', generic));
  expect(await screen.findByText(generic)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Volver a iniciar sesión' })).toBeTruthy();
});

test('fallo general o desconexión muestran el mensaje acordado con reintento manual', async () => {
  const request = jest.fn()
    .mockResolvedValueOnce(response('SERVICIO_NO_DISPONIBLE', failure, null, true))
    .mockRejectedValueOnce(new Error('sin red'))
    .mockResolvedValueOnce(response('OK', generic));
  await render(<RecoveryRequestScreen request={request} onBack={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'student@usc.edu.co');
  await fireEvent.press(screen.getByRole('button', { name: 'Enviar enlace' }));
  expect(await screen.findByText(failure)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Enviar enlace' }));
  expect(await screen.findByText(failure)).toBeTruthy();
  expect(screen.getByLabelText('Correo electrónico').props.value).toBe('student@usc.edu.co');
  await fireEvent.press(screen.getByRole('button', { name: 'Enviar enlace' }));
  expect(await screen.findByText(generic)).toBeTruthy();
  expect(request).toHaveBeenCalledTimes(3);
});

test('enlace abre el formulario, rechaza contraseña inválida y completa el cambio', async () => {
  const complete = jest.fn().mockResolvedValue(response('OK', 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.'));
  const onCompleted = jest.fn();
  const onLogin = jest.fn();
  await render(<ResetPasswordScreen id="demo-student" code="secreto" complete={complete} onLogin={onLogin} onRequestNew={jest.fn()} onCompleted={onCompleted} />);
  await fireEvent.changeText(screen.getByLabelText('Nueva contraseña'), 'corta1');
  await fireEvent.changeText(screen.getByLabelText('Confirmar contraseña'), 'corta1');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar contraseña' }));
  expect(screen.getByText('La contraseña debe tener al menos 8 caracteres, una letra y un número.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Nueva contraseña'), 'Nueva1234');
  await fireEvent.changeText(screen.getByLabelText('Confirmar contraseña'), 'Otra1234');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar contraseña' }));
  expect(screen.getByText('Las contraseñas no coinciden.')).toBeTruthy();
  expect(complete).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Confirmar contraseña'), 'Nueva1234');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar contraseña' }));
  expect(complete).toHaveBeenCalledWith({ id: 'demo-student', code: 'secreto', password: 'Nueva1234', confirmPassword: 'Nueva1234' });
  expect(await screen.findByText('Contraseña actualizada')).toBeTruthy();
  expect(onCompleted).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
  expect(onLogin).toHaveBeenCalledTimes(1);
});

test('enlace vencido o incompleto ofrece solicitar uno nuevo sin formulario', async () => {
  const complete = jest.fn().mockResolvedValue(response('RECUPERACION_INVALIDA', 'El enlace venció, ya se usó o fue reemplazado. Tu contraseña no cambió; solicita un enlace nuevo.'));
  const onRequestNew = jest.fn();
  await render(<ResetPasswordScreen id="demo-student" code="viejo" complete={complete} onLogin={jest.fn()} onRequestNew={onRequestNew} />);
  await fireEvent.changeText(screen.getByLabelText('Nueva contraseña'), 'Nueva1234');
  await fireEvent.changeText(screen.getByLabelText('Confirmar contraseña'), 'Nueva1234');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar contraseña' }));
  expect(await screen.findByText(/Tu contraseña no cambió/)).toBeTruthy();
  expect(screen.queryByLabelText('Nueva contraseña')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Solicitar enlace nuevo' }));
  expect(onRequestNew).toHaveBeenCalledTimes(1);
  await render(<ResetPasswordScreen complete={complete} onLogin={jest.fn()} onRequestNew={jest.fn()} />);
  expect(screen.getByText('El enlace no es válido. Solicita uno nuevo.')).toBeTruthy();
});
