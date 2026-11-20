import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feedback } from '../../../components/Feedback';
import AddToCartButton from '../../cart/AddToCartButton';
import { colors } from '../../../constants/theme';
import { formatCOP, type MenuProduct } from '../../../domain/cart';
import type { ServiceResponse } from '../../../domain/response';

type Service = (action: 'menu/list' | 'cart/get' | 'cart/save', input: unknown) => Promise<ServiceResponse>;

export default function RestaurantMenuScreen({ restaurantId, service, restaurantName = 'Menú' }: {
  restaurantId: string;
  service: Service;
  restaurantName?: string;
}) {
  const router = useRouter();
  const [products, setProducts] = useState<MenuProduct[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError('');
    setProducts(null);
    service('menu/list', { restaurantId })
      .then(result => {
        if (!active) return;
        if (result.codigo === 'OK') setProducts((result.datos as { products: MenuProduct[] }).products ?? []);
        else setError(result.mensaje);
      })
      .catch(() => { if (active) setError('No pudimos consultar el menú. Revisa la conexión e inténtalo de nuevo.'); });
    return () => { active = false; };
  }, [attempt, restaurantId, service]);

  return <SafeAreaView edges={['top']} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>{restaurantName}</Text>
        <View style={styles.back} />
      </View>
      {error ? <Feedback state="error" message={error} onRetry={() => setAttempt(attempt + 1)} />
        : products === null ? <Feedback state="loading" message="Consultando el menú…" />
        : !products.length ? <Feedback state="empty" message="Este restaurante aún no tiene productos disponibles." />
        : products.map(product => <View key={product.id} style={styles.card}>
          <View style={styles.info}>
            <Text style={styles.name}>{product.nombre}</Text>
            <Text style={styles.price}>{formatCOP(product.precioCOP)}</Text>
            {product.promocion && <Text style={styles.discount}>Promoción -{product.promocion.porcentaje}%</Text>}
            {!product.disponible && <Text style={styles.soldOut}>Agotado</Text>}
          </View>
          <AddToCartButton restaurantId={restaurantId} product={product} service={service} />
        </View>)}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, gap: 14, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  back: { width: 44, height: 44, justifyContent: 'center' },
  backText: { fontSize: 32, color: colors.ink, lineHeight: 36 },
  title: { flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '700', color: colors.ink },
  card: { gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  info: { gap: 4 },
  name: { fontSize: 18, fontWeight: '700', color: colors.ink },
  price: { fontSize: 17, fontWeight: '700', color: colors.primary },
  discount: { fontSize: 14, color: '#1E7B3A', fontWeight: '600' },
  soldOut: { fontSize: 14, color: colors.muted, fontWeight: '600' },
});
