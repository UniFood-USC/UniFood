import { test, expect } from '@jest/globals';
import {
  anonymizeRating,
  canRateOrder,
  Rating,
  RatingError,
  saveRating,
  setRatingCommentVisibility,
  toPublicRating,
  toPublicRatings,
  validateRatingInput,
} from '../../src/domain/ratings';
import type { Order } from '../../src/types/domain';

const student = { id: 'student-1', role: 'student' as const };
const admin = { id: 'admin-1', role: 'admin' as const };
const fixedDate = new Date('2026-10-12T12:00:00.000Z');
const order = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-private-123',
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
  ...overrides,
});
const rating = (overrides: Partial<Rating> = {}): Rating => ({
  id: order().id,
  orderId: order().id,
  authorId: student.id,
  restaurantId: order().restaurantId,
  authorName: 'María Fernanda Pérez',
  stars: 4,
  comment: 'Buena comida.',
  commentVisibility: 'approved',
  createdAt: '2026-10-12T11:30:00.000Z',
  updatedAt: '2026-10-12T11:30:00.000Z',
  ...overrides,
});

test('valida estrellas enteras de 1 a 5 y comentario opcional de hasta 500 caracteres', () => {
  expect(validateRatingInput({ stars: 5 })).toEqual({ stars: 5 });
  expect(validateRatingInput({ stars: 3, comment: '  Muy rico.  ' })).toEqual({ stars: 3, comment: 'Muy rico.' });
  expect(Array.from(validateRatingInput({ stars: 1, comment: '😀'.repeat(500) }).comment ?? '')).toHaveLength(500);
  expect(() => validateRatingInput({ stars: 1, comment: '😀'.repeat(501) })).toThrow(RatingError);
  expect(validateRatingInput({ stars: 4, comment: '   ' })).toEqual({ stars: 4 });
});

test.each([0, 6, 1.5, '5', null])('rechaza una calificación inválida: %p', stars => {
  expect(() => validateRatingInput({ stars })).toThrow(RatingError);
});

test('rechaza comentario mayor a 500 caracteres o entrada con campos extra', () => {
  expect(() => validateRatingInput({ stars: 4, comment: 'x'.repeat(501) })).toThrow(RatingError);
  expect(() => validateRatingInput({ stars: 4, email: 'privado@example.test' })).toThrow(RatingError);
});

test('solo permite valorar pedidos propios recogidos o entregados', () => {
  expect(canRateOrder(order(), student.id)).toBe(true);
  expect(canRateOrder(order({ mode: 'delivery', status: 'delivered' }), student.id)).toBe(true);
  expect(canRateOrder(order({ studentId: 'otro-estudiante' }), student.id)).toBe(false);
  expect(canRateOrder(order({ status: 'ready' }), student.id)).toBe(false);
  expect(canRateOrder(order({ status: 'cancelled' }), student.id)).toBe(false);
  expect(() => saveRating(order(), { ...admin }, 'Admin', { stars: 5 }, undefined, fixedDate)).toThrow(RatingError);
  expect(() => saveRating(order({ studentId: 'otro-estudiante' }), student, 'María', { stars: 5 }, undefined, fixedDate)).toThrow(RatingError);
});

test('editar conserva una valoración por pedido y mantiene oculto un comentario ocultado', () => {
  const hidden = rating({ commentVisibility: 'hidden' });
  const edited = saveRating(
    order(),
    student,
    'María Fernanda Pérez',
    { stars: 5, comment: 'Actualizado' },
    hidden,
    fixedDate,
  );
  expect(edited.id).toBe(order().id);
  expect(edited.stars).toBe(5);
  expect(edited.comment).toBe('Actualizado');
  expect(edited.commentVisibility).toBe('hidden');
  expect(edited.createdAt).toBe(hidden.createdAt);
  expect(edited.updatedAt).toBe(fixedDate.toISOString());
});

test('rechaza editar una valoración asociada a otro pedido o autor', () => {
  expect(() => saveRating(order(), student, 'María', { stars: 5 }, rating({ authorId: 'otro' }), fixedDate)).toThrow(RatingError);
  expect(() => saveRating(order(), student, 'María', { stars: 5 }, rating({ orderId: 'otro-pedido' }), fixedDate)).toThrow(RatingError);
});

test('solo administración puede ocultar o aprobar comentarios y las estrellas se conservan', () => {
  const hidden = setRatingCommentVisibility(rating(), 'hidden', admin, fixedDate);
  expect(hidden.commentVisibility).toBe('hidden');
  expect(hidden.stars).toBe(4);
  expect(() => setRatingCommentVisibility(rating(), 'hidden', student, fixedDate)).toThrow(RatingError);
  expect(setRatingCommentVisibility(hidden, 'approved', admin, fixedDate).commentVisibility).toBe('approved');
});

test('proyección pública solo expone nombre de pila y estrellas, ocultando el texto moderado', () => {
  expect(toPublicRating(rating())).toEqual({
    authorName: 'María',
    stars: 4,
    comment: 'Buena comida.',
  });
  expect(toPublicRating(rating({ commentVisibility: 'hidden' }))).toEqual({ authorName: 'María', stars: 4 });
  expect(JSON.stringify(toPublicRating(rating()))).not.toMatch(/email|order-private-123|student-1/i);
  expect(toPublicRatings([rating({ commentVisibility: 'hidden' })])).toEqual([{ authorName: 'María', stars: 4 }]);
});

test('anonimiza el autor sin cambiar estrellas ni ocultamiento de moderación', () => {
  const anonymized = anonymizeRating(rating({ commentVisibility: 'hidden' }));
  expect(anonymized.authorId).toBeNull();
  expect(anonymized.commentVisibility).toBe('hidden');
  expect(toPublicRating(anonymized)).toEqual({ authorName: 'Usuario eliminado', stars: 4 });
});
