import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

type Props = { title: string; description: string; features: readonly string[] };
export function ModuleScreen({ title, description, features }: Props) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>UNIFOOD · PROYECTO INICIAL</Text>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.notice}><Text style={styles.body}>Este módulo está en preparación. Las funciones siguientes todavía no están implementadas.</Text></View>
      <Text accessibilityRole="header" style={styles.heading}>Lo que construiremos</Text>
      {features.map((feature) => <View key={feature} style={styles.item}><Text style={styles.body}>{feature}</Text><Text style={styles.pending}>Pendiente</Text></View>)}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 48 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  title: { fontSize: 32, fontWeight: '700', color: colors.ink },
  description: { fontSize: 17, lineHeight: 26, color: colors.muted },
  notice: { padding: 18, borderRadius: 16, backgroundColor: colors.accent },
  heading: { fontSize: 21, fontWeight: '600', color: colors.ink, marginTop: 10 },
  item: { padding: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, gap: 8 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  pending: { fontSize: 13, color: colors.muted },
});
