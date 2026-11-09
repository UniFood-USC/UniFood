import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Rating, RatingError } from '../../../domain/ratings';
import { colors } from '../../../constants/theme';
import { mockRatings } from '../../../services/ratings/ratingRepository';
import type { RatingRepository } from '../../../services/ratings/ratingRepository';
import type { Order } from '../../../types/domain';

type Props = {
  order: Order;
  studentId: string;
  authorName: string;
  repository?: RatingRepository;
};

function errorMessage(error: unknown) {
  if (error instanceof RatingError && error.code === 'invalid_input') {
    return 'Revisa la calificación y asegúrate de que el comentario no supere 500 caracteres.';
  }
  if (error instanceof RatingError && error.code === 'ineligible_order') {
    return 'Solo puedes valorar tus pedidos recogidos o entregados.';
  }
  return 'No pudimos guardar tu valoración. Inténtalo de nuevo.';
}

export function OrderRatingEditor({
  order,
  studentId,
  authorName,
  repository = mockRatings,
}: Props) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => repository.subscribeOwn(
    order.id,
    studentId,
    value => {
      setRating(value);
      setLoading(false);
      setError('');
    },
    () => {
      setLoading(false);
      setError('No pudimos cargar tu valoración. Intenta de nuevo más tarde.');
    },
  ), [order.id, repository, studentId]);

  const startEditing = () => {
    setStars(rating?.stars ?? 5);
    setComment(rating?.comment ?? '');
    setError('');
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await repository.save(order, { id: studentId, role: 'student' }, authorName, {
        stars,
        comment,
      });
      setEditing(false);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Text style={styles.muted}>Cargando valoración…</Text>;

  return (
    <View style={styles.container}>
      {rating && !editing ? (
        <View style={styles.saved}>
          <Text style={styles.savedRating} accessibilityLabel={`Tu calificación: ${rating.stars} de 5 estrellas`}>
            {'★'.repeat(rating.stars)}{'☆'.repeat(5 - rating.stars)}
          </Text>
          {rating.comment ? (
            <Text style={styles.savedComment}>{rating.comment}</Text>
          ) : (
            <Text style={styles.muted}>Sin comentario</Text>
          )}
          {rating.comment && rating.commentVisibility === 'hidden' && (
            <Text style={styles.moderationNotice}>
              Tu comentario está oculto y seguirá así hasta que administración lo apruebe.
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={startEditing}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Editar valoración</Text>
          </Pressable>
        </View>
      ) : editing ? (
        <View style={styles.form}>
          <Text accessibilityRole="header" style={styles.heading}>
            {rating ? 'Editar valoración' : '¿Cómo fue tu experiencia?'}
          </Text>
          <View accessibilityRole="radiogroup" style={styles.stars}>
            {[1, 2, 3, 4, 5].map(value => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
                accessibilityState={{ selected: stars === value }}
                onPress={() => setStars(value)}
                style={styles.starButton}
              >
                <Text style={[styles.star, value <= stars && styles.starSelected]}>
                  {value <= stars ? '★' : '☆'}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="Comentario opcional"
            value={comment}
            onChangeText={setComment}
            placeholder="Deja un comentario (opcional)"
            maxLength={500}
            multiline
            textAlignVertical="top"
            style={styles.input}
          />
          <Text style={styles.counter}>{Array.from(comment).length}/500</Text>
          {rating?.comment && rating.commentVisibility === 'hidden' && (
            <Text style={styles.moderationNotice}>
              Tu comentario seguirá oculto hasta que administración lo apruebe.
            </Text>
          )}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={() => { setEditing(false); setError(''); }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={() => { void save(); }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>{saving ? 'Guardando…' : 'Guardar valoración'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            onPress={startEditing}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Valorar pedido</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 10 },
  saved: { gap: 8 },
  savedRating: { color: colors.primary, fontSize: 22, letterSpacing: 2 },
  savedComment: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  moderationNotice: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  form: { gap: 8 },
  heading: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  stars: { flexDirection: 'row', alignSelf: 'flex-start' },
  starButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  star: { color: colors.muted, fontSize: 30 },
  starSelected: { color: colors.primary },
  input: { minHeight: 88, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.ink, backgroundColor: colors.surface },
  counter: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: -4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  primaryButton: { minHeight: 44, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, alignSelf: 'flex-start' },
  primaryButtonText: { color: colors.surface, fontSize: 15, fontWeight: '600' },
  secondaryButton: { minHeight: 44, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start' },
  secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 14 },
  error: { color: colors.primary, fontSize: 14, lineHeight: 20 },
});
