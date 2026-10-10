import { fireEvent, render, screen } from '@testing-library/react-native';
import UsersScreen from '../../src/features/admin/UsersScreen';
import { response } from '../../src/domain/response';

const user = { id: 'student', name: 'Estudiante Demo', email: 'student@usc.edu.co', role: 'student', state: 'active', version: 1 };
test('T027/T028: lista, edita nombre/correo y conserva rol sin selector en edición', async () => {
  const service = jest.fn().mockResolvedValueOnce(response('OK', 'Listado', { users: [user] })).mockResolvedValueOnce(response('OK', 'Datos guardados.', { ...user, name: 'Nombre nuevo', version: 2 })).mockResolvedValue(response('OK', 'Listado', { users: [{ ...user, name: 'Nombre nuevo', version: 2 }] }));
  await render(<UsersScreen service={service} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Editar Estudiante Demo' }));
  expect(screen.queryByRole('radio')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'Nombre nuevo');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(await screen.findByText('Datos guardados.')).toBeTruthy();
  expect(service).toHaveBeenCalledWith('users/update', { id: 'student', version: 1, name: 'Nombre nuevo', email: 'student@usc.edu.co' });
});

test('T027: crea administrador, muestra resultado y limpia contraseña', async () => {
  const service = jest.fn().mockResolvedValue(response('OK', 'Listado', { users: [] }));
  await render(<UsersScreen service={service} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Crear usuario' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Administrador' }));
  await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'Admin nuevo');
  await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'admin@example.test');
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'Demo1234');
  await fireEvent.changeText(screen.getByLabelText('Confirmar contraseña'), 'Demo1234');
  service.mockResolvedValueOnce(response('OK', 'Cuenta creada.', { profile: { ...user, role: 'admin' } }));
  await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));
  expect(await screen.findByText('Cuenta creada.')).toBeTruthy();
  expect(service).toHaveBeenCalledWith('users/create', expect.objectContaining({ role: 'admin', email: 'admin@example.test' }));
  expect(screen.queryByLabelText('Contraseña')).toBeNull();
});

test('T028: desconexión conserva edición y permite reintento manual', async () => {
  const service = jest.fn().mockResolvedValueOnce(response('OK', 'Listado', { users: [user] })).mockRejectedValue(new Error('network'));
  await render(<UsersScreen service={service} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Editar Estudiante Demo' }));
  await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'Borrador');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(await screen.findByText(/Sin conexión/)).toBeTruthy();
  expect(screen.getByLabelText('Nombre completo').props.value).toBe('Borrador');
  expect(service).toHaveBeenCalledTimes(2);
});

test('T027: muestra error de listado y reintenta solo al pulsar', async () => {
  const service = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response('OK', 'Listado', { users: [] }));
  await render(<UsersScreen service={service} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('No hay usuarios para mostrar.')).toBeTruthy();
  expect(service).toHaveBeenCalledTimes(2);
});

test('T028: bloquea doble envío y conserva el formulario ante conflicto', async () => {
  let finish!: (result: ReturnType<typeof response>) => void;
  const service = jest.fn().mockResolvedValueOnce(response('OK', 'Listado', { users: [user] })).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await render(<UsersScreen service={service} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Editar Estudiante Demo' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Guardando' }));
  expect(service).toHaveBeenCalledTimes(2);
  finish(response('CONFLICTO_VERSION', 'La cuenta cambió. Consulta el listado.'));
  expect(await screen.findByText('La cuenta cambió. Consulta el listado.')).toBeTruthy();
  expect(screen.getByLabelText('Correo electrónico').props.value).toBe(user.email);
});
