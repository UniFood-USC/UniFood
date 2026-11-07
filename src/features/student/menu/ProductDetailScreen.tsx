import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feedback } from '../../../components/Feedback';
import { colors } from '../../../constants/theme';
import { menuRoutes } from './menuRoutes';
import type { ServiceResponse } from '../../../domain/response';
import type { DetalleProducto } from '../../../types/Menu';
import { Price, priceLabel } from './Price';
import { ProductImage } from './ProductImage';

type Service = (action: 'menu/product', input: unknown) => Promise<ServiceResponse>;

// RF-06 · Detalle de un producto: fotos, descripción, precio, promoción y disponible/agotado.
export default function ProductDetailScreen({ restaurantId, productId, service }: { restaurantId: string; productId: string; service: Service }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [detail, setDetail] = useState<DetalleProducto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState(0);
  const latest = useRef(0);

  const load = useCallback(() => {
    const mine = ++latest.current;
    return service('menu/product', { restaurantId, productId }).then(result => {
      if (mine !== latest.current) return;
      const data = result.datos as DetalleProducto | null;
      if (result.codigo === 'OK' && data?.producto.id === productId && data.restaurante.id === restaurantId) { setDetail(data); setError(''); }
      else { setDetail(null); setError(result.codigo === 'OK' ? 'No pudimos consultar el producto. Reintenta.' : result.mensaje); }
    }).catch(() => {
      if (mine === latest.current) { setDetail(null); setError('No pudimos consultar el producto. Revisa la conexión y reintenta.'); }
    }).finally(() => { if (mine === latest.current) setLoading(false); });
  }, [service, restaurantId, productId]);

  useEffect(() => { setDetail(null); setLoading(true); setPhoto(0); void load(); return () => { latest.current += 1; }; }, [load]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(menuRoutes.restaurantMenu(restaurantId)));
  const pageWidth = Math.min(width, 760) - 48;
  const producto = detail?.producto;

  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={goBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>{producto?.nombre ?? 'Producto'}</Text>
        <View style={styles.back} />
      </View>
      {loading ? <Feedback state="loading" message="Consultando el producto…" />
        : error || !producto ? <Feedback state="error" message={error || 'No pudimos consultar el producto.'} onRetry={() => { setLoading(true); setError(''); void load(); }} />
        : <>
          {producto.fotos.length
            ? <View>
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={event => setPhoto(Math.round(event.nativeEvent.contentOffset.x / pageWidth))}>
                {producto.fotos.map((uri, index) => <ProductImage key={uri} uri={uri} name={producto.nombre} label={`Foto ${index + 1} de ${producto.fotos.length} de ${producto.nombre}`} style={[styles.photo, { width: pageWidth }]} />)}
              </ScrollView>
              <Text accessibilityLiveRegion="polite" style={styles.counter}>Foto {Math.min(photo, producto.fotos.length - 1) + 1} de {producto.fotos.length}</Text>
            </View>
            : <View style={[styles.photo, styles.noPhoto, { width: pageWidth }]}><Text style={styles.muted}>Este producto aún no tiene fotos.</Text></View>}
          <Text style={styles.restaurant}>{detail!.restaurante.nombre}</Text>
          <View accessible accessibilityLabel={priceLabel(producto)}><Price producto={producto} large /></View>
          <View style={[styles.chip, !producto.disponible && styles.chipOut]}>
            <Text style={styles.chipText}>{producto.disponible ? 'Disponible' : 'Agotado'}</Text>
          </View>
          <Text accessibilityRole="header" style={styles.section}>Descripción</Text>
          <Text style={producto.descripcion ? styles.description : styles.muted}>{producto.descripcion || 'Este producto no tiene descripción.'}</Text>
        </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 12, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center' },
  backText: { fontSize: 32, color: colors.ink, lineHeight: 36 },
  title: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '700', color: colors.ink },
  photo: { height: 220, borderRadius: 18, backgroundColor: colors.accent },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  counter: { textAlign: 'center', fontSize: 13, color: colors.muted, marginTop: 6 },
  restaurant: { fontSize: 14, color: colors.muted },
  chip: { alignSelf: 'flex-start', backgroundColor: '#E6F4EA', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  chipOut: { backgroundColor: '#EDEAE6' },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  section: { fontSize: 18, fontWeight: '700', color: colors.ink, marginTop: 8 },
  description: { fontSize: 16, lineHeight: 24, color: colors.ink },
  muted: { fontSize: 15, lineHeight: 22, color: colors.muted },
});
