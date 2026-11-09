import type { Order, UserRole } from '../types/domain';

export const MAX_RATING_COMMENT_LENGTH = 500;
export const DELETED_RATING_AUTHOR = 'Usuario eliminado';

export type RatingCommentVisibility = 'approved' | 'hidden';

export interface Rating {
  id: string;
  orderId: string;
  authorId: string | null;
  restaurantId: string;
  authorName: string;
  stars: number;
  comment?: string;
  commentVisibility: RatingCommentVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface PublicRating {
  authorName: string;
  stars: number;
  comment?: string;
}

export interface RatingInput {
  stars: number;
  comment?: string;
}

export class RatingError extends Error {
  constructor(readonly code: 'invalid_input' | 'ineligible_order' | 'not_allowed' | 'not_found') {
    super(code);
    this.name = 'RatingError';
  }
}

export function validateRatingInput(input: unknown): RatingInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RatingError('invalid_input');
  }

  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(key => key !== 'stars' && key !== 'comment')) {
    throw new RatingError('invalid_input');
  }
  if (typeof data.stars !== 'number' || !Number.isInteger(data.stars) || data.stars < 1 || data.stars > 5) {
    throw new RatingError('invalid_input');
  }

  let comment: string | undefined;
  if (data.comment !== undefined) {
    if (typeof data.comment !== 'string') throw new RatingError('invalid_input');
    comment = data.comment.trim() || undefined;
    if (comment && Array.from(comment).length > MAX_RATING_COMMENT_LENGTH) {
      throw new RatingError('invalid_input');
    }
  }

  return { stars: data.stars, ...(comment ? { comment } : {}) };
}

export function canRateOrder(order: Order, studentId: string): boolean {
  return order.studentId === studentId && (order.status === 'collected' || order.status === 'delivered');
}

export function saveRating(
  order: Order,
  actor: { id: string; role: UserRole },
  authorName: string,
  input: unknown,
  existing?: Rating,
  now: Date = new Date(),
): Rating {
  if (actor.role !== 'student' || !canRateOrder(order, actor.id)) {
    throw new RatingError('ineligible_order');
  }
  if (existing && (existing.orderId !== order.id || existing.authorId !== actor.id)) {
    throw new RatingError('not_allowed');
  }
  const name = authorName.trim();
  if (!name) throw new RatingError('invalid_input');
  const value = validateRatingInput(input);
  const timestamp = now.toISOString();

  return {
    id: order.id,
    orderId: order.id,
    authorId: actor.id,
    restaurantId: order.restaurantId,
    authorName: name,
    ...value,
    commentVisibility: existing?.commentVisibility ?? 'approved',
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

export function setRatingCommentVisibility(
  rating: Rating,
  visibility: RatingCommentVisibility,
  actor: { role: UserRole },
  now: Date = new Date(),
): Rating {
  if (actor.role !== 'admin') throw new RatingError('not_allowed');
  if (!rating.comment) throw new RatingError('not_found');
  return { ...rating, commentVisibility: visibility, updatedAt: now.toISOString() };
}

export function anonymizeRating(rating: Rating): Rating {
  return { ...rating, authorId: null, authorName: DELETED_RATING_AUTHOR };
}

export function toPublicRating(rating: Rating): PublicRating {
  const authorName = rating.authorName === DELETED_RATING_AUTHOR
    ? DELETED_RATING_AUTHOR
    : rating.authorName.trim().split(/\s+/u)[0] || DELETED_RATING_AUTHOR;
  return {
    authorName,
    stars: rating.stars,
    ...(rating.comment && rating.commentVisibility === 'approved' ? { comment: rating.comment } : {}),
  };
}

export function toPublicRatings(ratings: Rating[]): PublicRating[] {
  return ratings.map(toPublicRating);
}
