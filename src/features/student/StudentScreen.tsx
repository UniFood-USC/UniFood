import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ModuleScreen } from '../../components/ModuleScreen';
import { colors } from '../../constants/theme';
import { routes } from '../../constants/routes';

export default function StudentScreen() {
  const router = useRouter();
  return <View style={styles.screen}>
    <ModuleScreen title="Tu campus, a un pedido." description="Un espacio para encontrar qué comer y seguir tu pedido." features={['RF-01 a RF-03 · Registro, acceso y recuperación de contraseña', 'RF-04 a RF-06 · Restaurantes, búsqueda y menús', 'RF-07 a RF-10 · Carrito, total, método de pago y confirmación', 'RF-11 a RF-15 · Seguimiento, notificaciones, historial y calificaciones']} />
    <View style={styles.footer}>
      <Pressable accessibilityRole="button" accessibilityLabel="Ver restaurantes" onPress={() => router.push(routes.restaurantList)} style={styles.button}>
        <Text style={styles.label}>Ver restaurantes</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  button: { minHeight: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 760, alignSelf: 'center' },
  label: { color: colors.surface, fontSize: 17, fontWeight: '700' },
});
