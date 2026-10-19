import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { test, expect, jest } from '@jest/globals';
import type { ServiceResponse } from '../../src/domain/response';
import RegistrationScreen from '../../src/features/identity/RegistrationScreen';
import { Feedback } from '../../src/components/Feedback';

const fillValid = async () => {
  await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'Estudiante Demo');
  await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'demo@usc.edu.co');
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'Demo1234');
  await fireEvent.changeText(screen.getByLabelText('Confirmar contraseña'), 'Demo1234');
};

test('cada ojo muestra solo su contraseña y conserva el valor al volver a ocultarla', async () => {
  await render(<RegistrationScreen register={jest.fn<() => Promise<ServiceResponse>>()} />);
  await fillValid();
  expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
  expect(screen.getByLabelText('Confirmar contraseña').props.secureTextEntry).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Mostrar contraseña' }));
  expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(false);
  expect(screen.getByLabelText('Confirmar contraseña').props.secureTextEntry).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Mostrar confirmación de contraseña' }));
  expect(screen.getByLabelText('Confirmar contraseña').props.secureTextEntry).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Ocultar contraseña' }));
  expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
  expect(screen.getByLabelText('Contraseña').props.value).toBe('Demo1234');
});

test('ofrece iniciar sesión sin enviar el formulario', async () => {
  const register = jest.fn<() => Promise<ServiceResponse>>();
  const onLogin = jest.fn();
  await render(<RegistrationScreen register={register} onLogin={onLogin} />);
  expect(screen.getByText('¿Ya tienes una cuenta?')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
  expect(onLogin).toHaveBeenCalledTimes(1);
  expect(register).not.toHaveBeenCalled();
});

test('la flecha permite volver sin registrar una cuenta', async () => {
  const onBack = jest.fn();
  await render(<RegistrationScreen register={jest.fn<() => Promise<ServiceResponse>>()} onBack={onBack} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('campos inválidos no llegan al servicio', async () => {
  const register = jest.fn<() => Promise<ServiceResponse>>();
  await render(<RegistrationScreen register={register} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Registrarme' }));
  expect(register).not.toHaveBeenCalled();
  expect(screen.getByText('Escribe tu nombre completo.')).toBeTruthy();
});

test('bloquea doble envío y muestra creación real', async () => {
  let finish!: (value: ServiceResponse) => void;
  const register = jest.fn(() => new Promise<ServiceResponse>(resolve => { finish = resolve; }));
  await render(<RegistrationScreen register={register} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Registrarme' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Creando cuenta' }));
  expect(register).toHaveBeenCalledTimes(1);
  finish({ codigo: 'OK', resultado: 'exito', mensaje: 'Cuenta creada.', datos: { id: 'demo' }, recuperable: false });
  await waitFor(() => expect(screen.getByText('Cuenta creada.')).toBeTruthy());
});

test('duplicado conserva campos y permite corregir sin fingir éxito', async () => {
  const register = jest.fn(async () => ({ codigo: 'CORREO_EN_USO', resultado: 'conflicto', mensaje: 'Este correo ya está registrado.', datos: null, recuperable: false } as const));
  await render(<RegistrationScreen register={register} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Registrarme' }));
  await waitFor(() => expect(screen.getByText('Este correo ya está registrado.')).toBeTruthy());
  expect(screen.getByLabelText('Correo electrónico').props.value).toBe('demo@usc.edu.co');
});

test('fallo de red conserva formulario, no reenvía automáticamente y permite reintento', async () => {
  const register = jest.fn<() => Promise<ServiceResponse>>().mockRejectedValue(new Error('network'));
  await render(<RegistrationScreen register={register} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Registrarme' }));
  await waitFor(() => expect(screen.getByText(/No pudimos confirmar el registro/)).toBeTruthy());
  expect(register).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Nombre completo').props.value).toBe('Estudiante Demo');
  await fireEvent.press(screen.getByRole('button', { name: 'Registrarme' }));
  await waitFor(() => expect(register).toHaveBeenCalledTimes(2));
});

test.each(['loading', 'empty', 'error', 'pending'] as const)('estado %s accesible', async state => {
  const retry = jest.fn();
  await render(<Feedback state={state} message="Mensaje de prueba" onRetry={state === 'error' ? retry : undefined} />);
  expect(screen.getByText('Mensaje de prueba')).toBeTruthy();
  if (state === 'error') {
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(retry).toHaveBeenCalledTimes(1);
  }
});

test('operación incierta bloquea otro registro y conserva los campos', async () => {
  const register = jest.fn(async () => ({ codigo: 'EN_PROCESO', resultado: 'pendiente', mensaje: 'Registro en revisión.', datos: null, recuperable: false } as const));
  await render(<RegistrationScreen register={register} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Registrarme' }));
  await waitFor(() => expect(screen.getByText('Registro en revisión.')).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Registrarme' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Registrarme' }));
  expect(register).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Correo electrónico').props.value).toBe('demo@usc.edu.co');
});

test('éxito elimina credenciales del formulario y permite continuar solo por acción explícita', async () => {
  const onCreated = jest.fn();
  await render(<RegistrationScreen register={async () => ({ codigo: 'OK', resultado: 'exito', mensaje: 'Cuenta creada.', datos: null, recuperable: false })} onCreated={onCreated} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Registrarme' }));
  await waitFor(() => expect(screen.getByText('¡Tu cuenta está lista!')).toBeTruthy());
  expect(screen.queryByLabelText('Contraseña')).toBeNull();
  expect(onCreated).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  expect(onCreated).toHaveBeenCalledTimes(1);
});
