import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RestaurantRegistrationScreen from '../../src/features/restaurant/RestaurantRegistrationScreen';
import RestaurantsAdminScreen from '../../src/features/admin/RestaurantsAdminScreen';
import { response } from '../../src/domain/response';
import type { RestauranteGestion } from '../../src/domain/restaurantManagement';

// RF-22 · Registro del restaurante y revisión administrativa.
const pendiente: RestauranteGestion = {
  id: 'rest-nuevo', nombre: 'Sabores Nuevos', descripcion: 'Comida casera', ubicacion: 'Bloque A', telefono: '3001234567', correo: 'nuevo@example.test',
  estado: 'pendiente', version: 1, horario: { lunes: { abre: '08:00', cierra: '17:00' } }, cierresEspeciales: [], condicion: 'pendiente', disponible: false, acciones: ['aprobar', 'rechazar', 'eliminar'],
};

async function llenarRegistro() {
  await fireEvent.changeText(screen.getByLabelText('Nombre del restaurante'), 'Café del Sol');
  await fireEvent.changeText(screen.getByLabelText('Descripción'), 'Café y pan.');
  await fireEvent.changeText(screen.getByLabelText('Ubicación dentro del campus'), 'Bloque B');
  await fireEvent.changeText(screen.getByLabelText('Teléfono'), '3001234567');
  await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'dueno@ejemplo.com');
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'Clave1234');
  await fireEvent.changeText(screen.getByLabelText('Confirmar contraseña'), 'Clave1234');
}

test('registro: sin datos muestra errores junto a cada campo y no llama al servicio', async () => {
  const service = jest.fn();
  await render(<RestaurantRegistrationScreen service={service} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Registrar restaurante' }));
  expect(await screen.findByText('El nombre es obligatorio.')).toBeTruthy();
  expect(screen.getByText('La descripción es obligatoria.')).toBeTruthy();
  expect(screen.getByText('Escribe un correo válido.')).toBeTruthy();
  expect(service).not.toHaveBeenCalled();
});

test('registro: con datos válidos se guarda y se muestra la condición pendiente', async () => {
  const service = jest.fn(async () => response('OK', 'Restaurante registrado.', { restaurantId: 'rest-x', estado: 'pendiente' }));
  await render(<RestaurantRegistrationScreen service={service} />);
  await llenarRegistro();
  await fireEvent.press(screen.getByRole('button', { name: 'Registrar restaurante' }));
  expect(await screen.findByText(/pendiente de aprobación/)).toBeTruthy();
  expect(service).toHaveBeenCalledWith('restaurants/register', expect.objectContaining({ nombre: 'Café del Sol', correo: 'dueno@ejemplo.com' }));
});

test('administración: rechazar sin motivo no se envía; con motivo se registra', async () => {
  const service = jest.fn(async (accion: string) => accion === 'restaurants/admin-list' ? response('OK', 'ok', { restaurantes: [pendiente] }) : response('OK', 'Restaurante rechazado.', { restaurante: pendiente }));
  await render(<RestaurantsAdminScreen service={service} />);
  await fireEvent.press(await screen.findByRole('button', { name: /Sabores Nuevos, Pendiente de aprobación/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Rechazar restaurante' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar rechazo' }));
  expect(await screen.findByText('Escribe el motivo del rechazo.')).toBeTruthy();
  expect(service).not.toHaveBeenCalledWith('restaurants/review', expect.anything());
  await fireEvent.changeText(screen.getByLabelText('Motivo del rechazo'), 'Falta la ubicación');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar rechazo' }));
  await waitFor(() => expect(service).toHaveBeenCalledWith('restaurants/review', { id: 'rest-nuevo', version: 1, decision: 'rechazar', motivo: 'Falta la ubicación' }));
});

test('administración: suspender pide confirmación y avisa de la cancelación y el reembolso', async () => {
  const aprobado = { ...pendiente, estado: 'aprobado', condicion: 'abierto', acciones: ['suspender', 'eliminar'] } as RestauranteGestion;
  const service = jest.fn(async () => response('OK', 'ok', { restaurantes: [aprobado] }));
  await render(<RestaurantsAdminScreen service={service} />);
  await fireEvent.press(await screen.findByRole('button', { name: /Sabores Nuevos, Aprobado/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Suspender restaurante' }));
  expect(screen.getByText(/se cancelarán sus pedidos activos y se reembolsarán los pagados/)).toBeTruthy();
});
