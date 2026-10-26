import { test, expect } from '@jest/globals';
import { createInMemoryRatingRepository } from '../../src/services/ratings/ratingRepository';
import type { Order } from '../../src/types/domain';

const student = { id: 'student-1', role: 'student' as const };
const admin = { id: 'admin-1', role: 'admin' as const };
const order: Order = {
  id: 'order-1',
  studentId: student.id,
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

test('guarda y edita en el mismo id de pedido, emitiendo el cambio a sus suscriptores', async () => {
  const repository = createInMemoryRatingRepository();
  const changes: (number | null)[] = [];
  const unsubscribe = repository.subscribeOwn(order.id, student.id, value => {
    changes.push(value?.stars ?? null);
  }, error => { throw error; });

  const first = await repository.save(order, student, 'María Pérez', { stars: 4 });
  const edited = await repository.save(order, student, 'María Pérez', { stars: 5, comment: 'Excelente' });

  expect(first.id).toBe(order.id);
  expect(edited.id).toBe(first.id);
  expect(edited.createdAt).toBe(first.createdAt);
  expect(edited.stars).toBe(5);
  expect(changes).toEqual([null, 4, 5]);

  unsubscribe();
  await repository.save(order, student, 'María Pérez', { stars: 3 });
  expect(changes).toEqual([null, 4, 5]);
});

test('la suscripción pública solo recibe proyecciones aprobadas y aisladas por restaurante', async () => {
  const repository = createInMemoryRatingRepository();
  const publicChanges: unknown[][] = [];
  repository.subscribePublic('restaurant-1', values => {
    publicChanges.push(values);
  }, error => { throw error; });

  const saved = await repository.save(order, student, 'María Fernanda Pérez', { stars: 4, comment: 'Sabroso' });
  await repository.setCommentVisibility(saved.id, 'hidden', admin);
  await repository.save({ ...order, id: 'order-2', restaurantId: 'restaurant-2' }, student, 'María Pérez', { stars: 5 });

  expect(publicChanges[0]).toEqual([]);
  expect(publicChanges[1]).toEqual([{ authorName: 'María', stars: 4, comment: 'Sabroso' }]);
  expect(publicChanges[2]).toEqual([{ authorName: 'María', stars: 4 }]);
  expect(publicChanges[3]).toEqual([{ authorName: 'María', stars: 4 }]);
  expect(JSON.stringify(publicChanges.at(-1))).not.toMatch(/student-1|order-1|order-2|restaurant-1|Sabroso/);
});

test('mantiene oculto el comentario editado y anonimiza valoraciones del autor', async () => {
  const repository = createInMemoryRatingRepository();
  const publicRatings: unknown[][] = [];
  repository.subscribePublic('restaurant-1', values => {
    publicRatings.push(values);
  }, error => { throw error; });

  const saved = await repository.save(order, student, 'María Pérez', { stars: 4, comment: 'Inicial' });
  await repository.setCommentVisibility(saved.id, 'hidden', admin);
  const edited = await repository.save(order, student, 'María Pérez', { stars: 5, comment: 'Editado' });

  expect(edited.commentVisibility).toBe('hidden');
  expect(publicRatings.at(-1)).toEqual([{ authorName: 'María', stars: 5 }]);
  await expect(repository.anonymizeAuthor(student.id)).resolves.toBe(1);
  expect(publicRatings.at(-1)).toEqual([{ authorName: 'Usuario eliminado', stars: 5 }]);
});

test('rechaza pedidos inelegibles y no permite que otro estudiante lea la valoración privada', async () => {
  const repository = createInMemoryRatingRepository();
  const privateRatings: unknown[] = [];
  repository.subscribeOwn(order.id, 'other-student', value => {
    privateRatings.push(value);
  }, error => { throw error; });

  await expect(repository.save({ ...order, status: 'ready' }, student, 'María', { stars: 5 })).rejects.toThrow();
  await repository.save(order, student, 'María', { stars: 5 });

  expect(privateRatings).toEqual([null, null]);
});
