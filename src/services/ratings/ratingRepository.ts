import {
  Rating,
  RatingCommentVisibility,
  RatingError,
  PublicRating,
  anonymizeRating,
  saveRating,
  setRatingCommentVisibility,
  toPublicRating,
} from '../../domain/ratings';
import type { Order, UserRole } from '../../types/domain';

export interface RatingActor {
  id: string;
  role: UserRole;
}

export interface RatingRepository {
  save(order: Order, actor: RatingActor, authorName: string, input: unknown): Promise<Rating>;
  subscribeOwn(
    orderId: string,
    studentId: string,
    onChange: (rating: Rating | null) => void,
    onError: (error: Error) => void,
  ): () => void;
  subscribePublic(
    restaurantId: string,
    onChange: (ratings: PublicRating[]) => void,
    onError: (error: Error) => void,
  ): () => void;
  setCommentVisibility(
    ratingId: string,
    visibility: RatingCommentVisibility,
    actor: RatingActor,
  ): Promise<Rating>;
  anonymizeAuthor(authorId: string): Promise<number>;
}

type Listener = { push: () => void; onError: (error: Error) => void };

export function createInMemoryRatingRepository(): RatingRepository {
  const ratings = new Map<string, Rating>();
  const listeners = new Set<Listener>();

  const notify = () => {
    for (const listener of listeners) {
      try {
        listener.push();
      } catch (error) {
        listener.onError(error instanceof Error ? error : new Error('No se pudo actualizar la valoración.'));
      }
    }
  };

  const subscribe = (push: () => void, onError: (error: Error) => void) => {
    const listener = { push, onError };
    listeners.add(listener);
    try {
      push();
    } catch (error) {
      listeners.delete(listener);
      onError(error instanceof Error ? error : new Error('No se pudo cargar la valoración.'));
    }
    return () => { listeners.delete(listener); };
  };

  return {
    async save(order, actor, authorName, input) {
      const existing = ratings.get(order.id);
      const updated = saveRating(order, actor, authorName, input, existing);
      ratings.set(updated.id, updated);
      notify();
      return updated;
    },

    subscribeOwn(orderId, studentId, onChange, onError) {
      return subscribe(
        () => {
          const rating = ratings.get(orderId);
          onChange(rating?.authorId === studentId ? { ...rating } : null);
        },
        onError,
      );
    },

    subscribePublic(restaurantId, onChange, onError) {
      return subscribe(
        () => {
          const visible = [...ratings.values()]
            .filter(rating => rating.restaurantId === restaurantId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map(toPublicRating);
          onChange(visible);
        },
        onError,
      );
    },

    async setCommentVisibility(ratingId, visibility, actor) {
      const current = ratings.get(ratingId);
      if (!current) throw new RatingError('not_found');
      const updated = setRatingCommentVisibility(current, visibility, actor);
      ratings.set(ratingId, updated);
      notify();
      return updated;
    },

    async anonymizeAuthor(authorId) {
      let count = 0;
      for (const [id, rating] of ratings) {
        if (rating.authorId === authorId) {
          ratings.set(id, anonymizeRating(rating));
          count++;
        }
      }
      if (count > 0) notify();
      return count;
    },
  };
}

export const mockRatings = createInMemoryRatingRepository();
