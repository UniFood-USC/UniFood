import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../constants/theme';
import { routes } from '../../constants/routes';

export default function RestaurantScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>UNIFOOD · RESTAURANTE</Text>
      <Text accessibilityRole="header" style={styles.title}>Todo listo para servir.</Text>
      <Text style={styles.description}>El espacio de trabajo de cada restaurante del campus.</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(routes.restaurantSales)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Consultar historial de ventas</Text>
      </Pressable>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Otros módulos en preparación</Text>
        <Text style={styles.noticeText}>RF-16 · Gestión de productos</Text>
        <Text style={styles.noticeText}>RF-17 · Avisos de nuevos pedidos</Text>
        <Text style={styles.noticeText}>RF-18 · Actualización de pedidos</Text>
        <Text style={styles.noticeText}>RF-20 · Reportes por fecha</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 48 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  title: { fontSize: 32, fontWeight: '700', color: colors.ink },
  description: { fontSize: 17, lineHeight: 26, color: colors.muted },
  button: { minHeight: 52, paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  notice: { padding: 18, borderRadius: 16, backgroundColor: colors.accent, gap: 8 },
  noticeTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  noticeText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
});
