import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { Feedback } from '../../../components/Feedback';
import { colors } from '../../../constants/theme';
import { formatCOP, type MenuProduct } from '../../../domain/cart';
import type { ServiceResponse } from '../../../domain/response';
import type { RestaurantePublico } from '../../../types/Estado_Restaurante';
import { RestaurantCard } from './RestaurantCard';

type Service = (action: 'restaurants/list' | 'menu/list', input: unknown) => Promise<ServiceResponse>;
type DishResult = { product: MenuProduct; restaurant: RestaurantePublico };

export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function filterSearch(restaurants: RestaurantePublico[], dishes: DishResult[], query: string) {
  const normalized = normalizeSearch(query);
  if (!normalized) return { restaurants: [], dishes: [] };
  return {
    restaurants: restaurants.filter(restaurant =>
      normalizeSearch(restaurant.nombre).includes(normalized)),
    dishes: dishes.filter(({ product, restaurant }) =>
      normalizeSearch(product.nombre).includes(normalized) ||
      normalizeSearch(restaurant.nombre).includes(normalized)),
  };
}

export default function SearchScreen({ service }: { service: Service }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [restaurants, setRestaurants] = useState<RestaurantePublico[]>([]);
  const [dishes, setDishes] = useState<DishResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await service('restaurants/list', {});
      if (result.codigo !== 'OK') { setError(result.mensaje); return; }
      const found = (result.datos as { restaurants: RestaurantePublico[] }).restaurants ?? [];
      setRestaurants(found);
      const menus = await Promise.all(found.map(async restaurant => {
        const menu = await service('menu/list', { restaurantId: restaurant.id });
        if (menu.codigo !== 'OK') return [];
        const products = (menu.datos as { products: MenuProduct[] }).products ?? [];
        return products
          .filter(product => product.disponible)
          .map(product => ({ product, restaurant }));
      }));
      setDishes(menus.flat());
    } catch {
      setError('No pudimos cargar la búsqueda. Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => { void load(); }, [attempt, load]);

  const openRestaurant = (restaurant: RestaurantePublico) =>
    router.push({ pathname: '/student/restaurant/[id]', params: { id: restaurant.id } });
  const found = filterSearch(restaurants, dishes, query);
  const hasResults = found.restaurants.length > 0 || found.dishes.length > 0;

  return <SafeAreaView edges={['top']} style={styles.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Buscar</Text>
      <View style={styles.search}>
        <Feather name="search" size={20} color={colors.muted} accessible={false} />
        <TextInput accessibilityLabel="Buscar restaurantes o platos"
          placeholder="Restaurante o plato…" placeholderTextColor={colors.muted}
          value={query} onChangeText={setQuery} autoCorrect={false}
          returnKeyType="search" style={styles.input} />
        {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Borrar búsqueda"
          onPress={() => setQuery('')} style={styles.clear}>
          <Feather name="x" size={20} color={colors.muted} accessible={false} />
        </Pressable>}
      </View>
      {loading ? <Feedback state="loading" message="Consultando restaurantes y menús…" />
        : error ? <Feedback state="error" message={error} onRetry={() => setAttempt(attempt + 1)} />
        : !normalizeSearch(query) ? <Feedback state="empty" message="Busca un restaurante o escribe el nombre de un plato." />
        : !hasResults ? <Feedback state="empty" message={`No encontramos resultados para "${query.trim()}".`} />
        : <>
          {!!found.restaurants.length && <Text accessibilityRole="header" style={styles.section}>Restaurantes</Text>}
          {found.restaurants.map(restaurant =>
            <RestaurantCard key={restaurant.id} restaurant={restaurant} onPress={() => openRestaurant(restaurant)} />)}
          {!!found.dishes.length && <Text accessibilityRole="header" style={styles.section}>Platos</Text>}
          {found.dishes.map(({ product, restaurant }) =>
            <Pressable key={`${restaurant.id}-${product.id}`} accessibilityRole="button"
              accessibilityLabel={`${product.nombre}, ${formatCOP(product.precioCOP)}, ${restaurant.nombre}`}
              onPress={() => openRestaurant(restaurant)} style={styles.dish}>
              <View style={styles.dishInfo}>
                <Text style={styles.dishName}>{product.nombre}</Text>
                <Text style={styles.restaurantName}>{restaurant.nombre}</Text>
              </View>
              <View style={styles.dishPrice}>
                <Text style={styles.price}>{formatCOP(product.precioCOP)}</Text>
                <Feather name="chevron-right" size={20} color={colors.primary} accessible={false} />
              </View>
            </Pressable>)}
        </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, gap: 14, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 50, fontSize: 16, color: colors.ink, paddingVertical: 10 },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 8, fontSize: 20, fontWeight: '700', color: colors.ink },
  dish: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 76, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  dishInfo: { flex: 1, gap: 4 },
  dishName: { fontSize: 17, fontWeight: '700', color: colors.ink },
  restaurantName: { fontSize: 14, color: colors.muted },
  dishPrice: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { fontSize: 16, fontWeight: '700', color: colors.primary },
});
