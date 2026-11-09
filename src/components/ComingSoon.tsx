import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '../constants/theme';

// Ocupa una pestaña hasta que su responsable conecte la función.
export function ComingSoon({ description }: { description: string }) {
  return <View style={styles.screen}>
    <Feather name="clock" size={40} color={colors.primary} accessible={false} />
    <Text accessibilityRole="header" style={styles.title}>Próximamente</Text>
    <Text style={styles.text}>{description}</Text>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  text: { fontSize: 16, lineHeight: 24, color: colors.muted, textAlign: 'center', maxWidth: 360 },
});
