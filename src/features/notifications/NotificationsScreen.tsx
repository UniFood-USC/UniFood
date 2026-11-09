import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feedback } from '../../components/Feedback';
import { colors } from '../../constants/theme';
import { routes } from '../../constants/routes';
import type { Notice } from '../../domain/notifications';
import type { ServiceResponse } from '../../domain/response';

type Service = (action: 'notifications/list', input: unknown) => Promise<ServiceResponse>;
const when = (iso: string) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// RF-12, RF-17 · Bandeja de avisos propios, del más reciente al más antiguo (el servicio ya los ordena).
// Se consulta al entrar y al volver, así aparecen también los avisos recibidos sin conexión.
export default function NotificationsScreen({ service }: { service: Service }) {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const load = useCallback(() => service('notifications/list', {}).then(result => {
    if (!mounted.current) return;
    if (result.codigo === 'OK') { setNotices((result.datos as { notices: Notice[] }).notices); setError(''); }
    else setError(result.mensaje);
  }).catch(() => { if (mounted.current) setError('No pudimos consultar tus avisos. Revisa la conexión y reintenta.'); }), [service]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    {error ? <Feedback state="error" message={error} onRetry={() => { setError(''); setNotices(null); void load(); }} />
      : !notices ? <Feedback state="loading" message="Consultando tus avisos…" />
      : !notices.length ? <Feedback state="empty" message="Todavía no tienes avisos." />
      : notices.map(notice => <Pressable key={notice.id} accessibilityRole="button" accessibilityLabel={`Ver el pedido de ${notice.title}`}
        onPress={() => router.push(routes.orderTracking(notice.orderId))} style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>{notice.title}</Text>
        <Text style={styles.message}>{notice.message}</Text>
        <Text style={styles.time}>{when(notice.createdAt)} · Ver pedido ›</Text>
      </Pressable>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, gap: 12 },
  card: { gap: 4, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  title: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  message: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  time: { color: colors.muted, fontSize: 13 },
});
