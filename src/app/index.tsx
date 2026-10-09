import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { Brand } from '../components/Brand';
import { roleDestination } from '../domain/navigation';

const modules = [
  { role: 'student', number: '01', name: 'Estudiante', detail: 'Restaurantes, menú y pedidos en tu campus.' },
  { role: 'restaurant', number: '02', name: 'Restaurante', detail: 'Tu menú, tus pedidos y tus ventas.' },
  { role: 'admin', number: '03', name: 'Administrador', detail: 'Usuarios, restaurantes y promociones.' },
];
export default function HomeScreen() {
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.hero}>
      <Brand />
      <Text style={styles.eyebrow}>UNIVERSIDAD SANTIAGO DE CALI</Text>
      <Text accessibilityRole="header" style={styles.title}>Tu próxima pausa empieza aquí.</Text>
      <Text style={styles.subtitle}>UniFood conecta a la comunidad universitaria con los restaurantes del campus.</Text>
      <Link href="/register" asChild><Pressable accessibilityRole="button" style={styles.register}><Text style={styles.registerText}>Crear cuenta de estudiante</Text></Pressable></Link>
    </View>
    <Text accessibilityRole="header" style={styles.heading}>Explora los módulos</Text>
    <Text style={styles.note}>Vista de desarrollo. Estos accesos permiten recorrer la estructura del proyecto; todavía no hay inicio de sesión.</Text>
    {modules.map((module) => <Link key={module.role} href={roleDestination(module.role)!} asChild><Pressable accessibilityRole="button" accessibilityLabel={`Explorar módulo ${module.name}`} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Text style={styles.number}>{module.number}</Text><View style={styles.cardBody}><Text style={styles.cardTitle}>{module.name}</Text><Text style={styles.detail}>{module.detail}</Text></View><Text style={styles.arrow}>→</Text>
    </Pressable></Link>)}
    <Text style={styles.footer}>Desarrollo de Aplicaciones Móviles · UniFood</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 16, maxWidth: 760, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  hero: { gap: 20, paddingVertical: 24 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 40, fontWeight: '800', lineHeight: 46 },
  subtitle: { color: colors.muted, fontSize: 18, lineHeight: 28 },
  register: { minHeight: 54, borderRadius: 16, padding: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  registerText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  heading: { color: colors.ink, fontSize: 24, fontWeight: '700', marginTop: 8 },
  note: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 18 },
  pressed: { backgroundColor: colors.accent },
  number: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  cardBody: { flex: 1, gap: 6 },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  detail: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  arrow: { color: colors.primary, fontSize: 24 },
  footer: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 20 },
});
