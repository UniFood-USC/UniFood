import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feedback } from '../../../components/Feedback';
import { colors } from '../../../constants/theme';
import { menuRoutes } from './menuRoutes';
import { MENU_VACIO } from '../../../domain/menu';
import type { ServiceResponse } from '../../../domain/response';
import type { MenuRestaurante } from '../../../types/Menu';
import { ProductRow } from './ProductRow';

type Service = (action: 'menu/list', input: unknown) => Promise<ServiceResponse>;

// RF-06 · Menú de un restaurante: nombre y precio en COP de cada producto, con estados
// de carga, error, vacío y agotado. Solo muestra lo que el servicio devolvió para ESTE restaurante.
export default function MenuScreen({ restaurantId, service }: { restaurantId: string; service: Service }) {
  const router = useRouter();
  const [menu, setMenu] = useState<MenuRestaurante | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(0);

  // Cada consulta lleva un número: una respuesta tardía de otro restaurante se descarta.
  const load = useCallback(() => {
    const mine = ++latest.current;
    return service('menu/list', { restaurantId }).then(result => {
      if (mine !== latest.current) return;
      if (result.codigo === 'OK' && (result.datos as MenuRestaurante).restaurante.id === restaurantId) { setMenu(result.datos as MenuRestaurante); setError(''); }
      else { setMenu(null); setError(result.codigo === 'OK' ? 'No pudimos consultar el menú. Reintenta.' : result.mensaje); }
    }).catch(() => {
      if (mine === latest.current) { setMenu(null); setError('No pudimos consultar el menú. Revisa la conexión y reintenta.'); }
    }).finally(() => { if (mine === latest.current) { setLoading(false); setRefreshing(false); } });
  }, [service, restaurantId]);

  // La ruta monta esta pantalla con key=restaurantId: otro restaurante = estado nuevo (cargando).
  useEffect(() => { void load(); return () => { latest.current += 1; }; }, [load]);

  const retry = () => { setLoading(true); setError(''); void load(); };
  const refresh = () => { setRefreshing(true); void load(); };
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(menuRoutes.restaurantList));
  const header = <View>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={goBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
      <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>{menu?.restaurante.nombre ?? 'Menú'}</Text>
      <View style={styles.back} />
    </View>
    {menu && <View style={styles.status}>
      <Text style={styles.statusText}>{menu.restaurante.disponible ? 'Abierto ahora' : `Cerrado${menu.restaurante.proximaApertura ? ` · Abre ${menu.restaurante.proximaApertura}` : ''}`}</Text>
    </View>}
    <Text style={styles.subtitle}>Precios en pesos colombianos (COP).</Text>
  </View>;

  return <SafeAreaView style={styles.screen}>
    {loading || error || !menu
      ? <View style={styles.content}>{header}{loading ? <Feedback state="loading" message="Consultando el menú…" /> : <Feedback state="error" message={error || 'No pudimos consultar el menú.'} onRetry={retry} />}</View>
      : <FlatList
        data={menu.productos}
        keyExtractor={producto => producto.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListHeaderComponent={header}
        ListEmptyComponent={<Feedback state="empty" message={MENU_VACIO} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
        renderItem={({ item }) => <ProductRow producto={item} onPress={() => router.push(menuRoutes.productDetail(restaurantId, item.id))} />}
      />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 48, gap: 0 },
  gap: { height: 12 },
  header: { flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center' },
  backText: { fontSize: 32, color: colors.ink, lineHeight: 36 },
  title: { flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '700', color: colors.ink },
  status: { alignSelf: 'center', marginTop: 4, backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  statusText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: 'center', marginVertical: 12 },
});
