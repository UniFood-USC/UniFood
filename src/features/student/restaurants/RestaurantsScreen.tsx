import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feedback } from '../../../components/Feedback';
import { colors } from '../../../constants/theme';
import { routes } from '../../../constants/routes';
import type { ServiceResponse } from '../../../domain/response';
import type { RestaurantePublico } from '../../../types/Estado_Restaurante';
import { RestaurantCard } from './RestaurantCard';

type Service = (action: 'restaurants/list', input: unknown) => Promise<ServiceResponse>;

// RF-04 · Listado de restaurantes del campus (estudiante).
// Muestra ID (interno), nombre, logo y disponibilidad; si no hay resultados, lo informa.
export default function RestaurantsScreen({ service }: { service: Service }) {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<RestaurantePublico[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  const load = useCallback(() => service('restaurants/list', {}).then(result => {
    if (!mounted.current) return;
    if (result.codigo === 'OK') { setRestaurants((result.datos as { restaurants: RestaurantePublico[] }).restaurants); setError(''); }
    else setError(result.mensaje);
  }).catch(() => {
    if (mounted.current) setError('No pudimos consultar los restaurantes. Revisa la conexión y reintenta.');
  }).finally(() => { if (mounted.current) { setLoading(false); setRefreshing(false); } }), [service]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, [load]);

  const retry = () => { setLoading(true); setError(''); void load(); };
  const refresh = () => { setRefreshing(true); void load(); };
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(routes.student));
  const open = restaurants.filter(r => r.disponible).length;

  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={goBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <Text accessibilityRole="header" style={styles.title}>Restaurantes</Text>
        <View style={styles.back} />
      </View>
      <Text style={styles.subtitle}>Encuentra dónde comer en el campus.</Text>
      {loading ? <Feedback state="loading" message="Consultando restaurantes…" />
        : error ? <Feedback state="error" message={error} onRetry={retry} />
        : !restaurants.length ? <Feedback state="empty" message="No hay restaurantes disponibles por ahora." />
        : <>
          <Text accessibilityLiveRegion="polite" style={styles.count}>
            {restaurants.length === 1 ? '1 restaurante' : `${restaurants.length} restaurantes`} en el campus · {open} {open === 1 ? 'disponible' : 'disponibles'} ahora
          </Text>
          {restaurants.map(restaurant => <RestaurantCard key={restaurant.id} restaurant={restaurant} />)}
        </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 14, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center' },
  backText: { fontSize: 32, color: colors.ink, lineHeight: 36 },
  title: { flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 16, lineHeight: 24, color: colors.muted, textAlign: 'center' },
  count: { fontSize: 14, color: colors.muted },
});
