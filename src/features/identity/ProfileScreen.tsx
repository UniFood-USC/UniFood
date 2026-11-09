import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Feedback } from '../../components/Feedback';
import { colors } from '../../constants/theme';
import { useSession } from './SessionProvider';
import { useProfile } from './useProfile';

const roleLabels = { student: 'Estudiante', restaurant: 'Restaurante', admin: 'Administrador' };

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useSession();
  const { profile, error } = useProfile();
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    {error ? <Feedback state="error" message={error} />
      : !profile ? <Feedback state="loading" message="Cargando tu perfil…" />
      : <View style={styles.card}>
        <View style={styles.avatar}><Feather name="user" size={32} color={colors.primary} accessible={false} /></View>
        <Text accessibilityRole="header" style={styles.name}>{profile.name}</Text>
        <Text style={styles.detail}>{profile.email}</Text>
        <Text style={styles.role}>{roleLabels[profile.role]}</Text>
      </View>}
    {profile && profile.role !== 'admin' && <Pressable accessibilityRole="button" accessibilityLabel="Notificaciones" onPress={() => router.push('/notifications')} style={styles.row}>
      <Feather name="bell" size={20} color={colors.ink} accessible={false} />
      <Text style={styles.rowText}>Notificaciones</Text>
      <Feather name="chevron-right" size={20} color={colors.muted} accessible={false} />
    </Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={() => { void logout(); }} style={styles.logout}>
      <Feather name="log-out" size={20} color={colors.primary} accessible={false} />
      <Text style={styles.logoutText}>Cerrar sesión</Text>
    </Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 18, width: '100%', maxWidth: 560, alignSelf: 'center' },
  card: { alignItems: 'center', gap: 6, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, marginBottom: 6 },
  name: { fontSize: 22, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  detail: { fontSize: 15, color: colors.muted },
  role: { fontSize: 14, fontWeight: '600', color: colors.primary },
  row: { flexDirection: 'row', gap: 12, minHeight: 52, alignItems: 'center', paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  rowText: { flex: 1, fontSize: 16, color: colors.ink },
  logout: { flexDirection: 'row', gap: 10, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  logoutText: { fontSize: 16, fontWeight: '700', color: colors.primary },
});
