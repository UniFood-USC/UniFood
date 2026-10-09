import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

export function Feedback({ state, message, onRetry }: { state: 'loading' | 'empty' | 'error' | 'pending'; message: string; onRetry?: () => void }) {
  return <View accessibilityLiveRegion="polite" style={styles.box}>
    {(state === 'loading' || state === 'pending') && <ActivityIndicator accessibilityLabel="Operación en curso" color={colors.primary} />}
    <Text accessibilityRole={state === 'error' ? 'alert' : 'text'} style={styles.message}>{message}</Text>
    {onRetry && <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.label}>Reintentar</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  box: { padding: 16, borderRadius: 16, backgroundColor: colors.accent, gap: 10 },
  message: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  retry: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  label: { color: colors.primary, fontWeight: '700' },
});
