import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Brand } from '../../components/Brand';
import { Feedback } from '../../components/Feedback';
import { colors } from '../../constants/theme';
import { routes } from '../../constants/routes';
import { callService } from '../../services/client';
import { useProfile } from '../identity/useProfile';
import { RestaurantCard } from './restaurants/RestaurantCard';
import type { RestaurantePublico } from '../../types/Estado_Restaurante';

// Inicio del estudiante: compone el saludo y el listado de restaurantes (RF-04, de Johan).
// Categorías, distancias, tiempos y anuncios del diseño son ilustrativos y no se incluyen.
export default function StudentScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const [restaurants, setRestaurants] = useState<RestaurantePublico[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    callService<{ restaurants: RestaurantePublico[] }>('restaurants/list', {})
      .then(result => {
        if (!active) return;
        if (result.codigo === 'OK') setRestaurants(result.datos?.restaurants ?? []);
        else setError(result.mensaje);
      })
      .catch(() => { if (active) setError('No pudimos consultar los restaurantes. Revisa la conexión y reintenta.'); });
    return () => { active = false; };
  }, [attempt]);

  const retry = () => { setError(''); setRestaurants(null); setAttempt(attempt + 1); };
  const firstName = profile?.name.split(' ')[0];

  return <SafeAreaView edges={['top']} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <Brand width={120} />
        <Pressable accessibilityRole="button" accessibilityLabel="Perfil" onPress={() => router.push('/student/profile')} style={styles.avatar}>
          <Feather name="user" size={22} color={colors.ink} accessible={false} />
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={styles.greeting}>{firstName ? `¡Hola, ${firstName}! 👋` : '¡Hola! 👋'}</Text>
      <Text style={styles.question}>¿Qué quieres comer hoy?</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Buscar restaurantes o platos" onPress={() => router.push('/student/search')} style={styles.search}>
        <Feather name="search" size={20} color={colors.muted} accessible={false} />
        <Text style={styles.searchText}>Buscar restaurantes o platos…</Text>
      </Pressable>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Restaurantes</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Ver todos los restaurantes" onPress={() => router.push(routes.restaurantList)} style={styles.link}>
          <Text style={styles.linkText}>Ver todos ›</Text>
        </Pressable>
      </View>
      {error ? <Feedback state="error" message={error} onRetry={retry} />
        : !restaurants ? <Feedback state="loading" message="Consultando restaurantes…" />
        : !restaurants.length ? <Feedback state="empty" message="No hay restaurantes para mostrar." />
        : restaurants.slice(0, 3).map(restaurant => <RestaurantCard key={restaurant.id} restaurant={restaurant} />)}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14, width: '100%', maxWidth: 760, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  greeting: { fontSize: 26, fontWeight: '700', color: colors.ink },
  question: { fontSize: 16, color: colors.muted, marginTop: -8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchText: { fontSize: 15, color: colors.muted },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
