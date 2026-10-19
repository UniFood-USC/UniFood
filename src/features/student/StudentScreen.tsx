import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Brand } from '../../components/Brand';
import { colors } from '../../constants/theme';
import { routes } from '../../constants/routes';

export default function StudentScreen() {
  const router = useRouter();
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Brand width={154} />
    <Text accessibilityRole="header" style={styles.title}>Tu campus, a un pedido.</Text>
    <Text style={styles.description}>Encuentra qué comer en el campus y sigue tu pedido.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Ver restaurantes" onPress={() => router.push(routes.restaurantList)} style={styles.button}>
      <Text style={styles.label}>Ver restaurantes</Text>
    </Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  description: { fontSize: 17, lineHeight: 26, color: colors.muted, textAlign: 'center' },
  button: { minHeight: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 420 },
  label: { color: colors.surface, fontSize: 17, fontWeight: '700' },
});