import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { test, expect } from '@jest/globals';
import { OrderRatingEditor } from '../../src/features/student/orders/OrderRatingEditor';
import { createInMemoryRatingRepository } from '../../src/services/ratings/ratingRepository';
import type { Order } from '../../src/types/domain';

const order: Order = {
  id: 'order-1',
  studentId: 'student-1',
  restaurantId: 'restaurant-1',
  mode: 'pickup',
  status: 'collected',
  paymentMethod: 'nequi',
  total: 24000,
  paid: true,
  version: 1,
  createdAt: '2026-10-12T10:00:00.000Z',
  updatedAt: '2026-10-12T11:00:00.000Z',
};

test('permite elegir estrellas, comentario opcional y editar la valoración existente', async () => {
  const repository = createInMemoryRatingRepository();
  await render(
    <OrderRatingEditor
      order={order}
      studentId="student-1"
      authorName="María Pérez"
      repository={repository}
    />,
  );

  await fireEvent.press(screen.getByRole('button', { name: 'Valorar pedido' }));
  expect(screen.getByLabelText('Comentario opcional').props.maxLength).toBe(500);
  await fireEvent.press(screen.getByLabelText('3 estrellas'));
  await fireEvent.changeText(screen.getByLabelText('Comentario opcional'), 'Muy rico');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar valoración' }));

  await waitFor(() => expect(screen.getByText('★★★☆☆')).toBeTruthy());
  expect(screen.getByText('Muy rico')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Editar valoración' }));
  expect(screen.getByLabelText('Comentario opcional').props.value).toBe('Muy rico');
  await fireEvent.press(screen.getByLabelText('5 estrellas'));
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar valoración' }));

  await waitFor(() => expect(screen.getByText('★★★★★')).toBeTruthy());
  expect(screen.getByText('Muy rico')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Valorar pedido' })).toBeNull();
});

test('acepta guardar una valoración sin comentario', async () => {
  const repository = createInMemoryRatingRepository();
  await render(
    <OrderRatingEditor
      order={order}
      studentId="student-1"
      authorName="Estudiante de prueba"
      repository={repository}
    />,
  );

  await fireEvent.press(screen.getByRole('button', { name: 'Valorar pedido' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar valoración' }));

  await waitFor(() => expect(screen.getByText('★★★★★')).toBeTruthy());
  expect(screen.getByText('Sin comentario')).toBeTruthy();
});
