import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../constants/theme';
import { DIAS, ETIQUETA_DIA } from '../../domain/restaurants';
import type { DiaSemana, Horario } from '../../types/Estado_Restaurante';

// RF-22 · Editor de horario por día. Una hora de cierre menor que la de apertura es una franja que cruza la medianoche.
const ORDEN: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
export default function ScheduleEditor({ value, onChange, disabled = false, error }: { value: Horario; onChange: (horario: Horario) => void; disabled?: boolean; error?: string }) {
  const cambiar = (dia: DiaSemana, tramo: { abre: string; cierra: string } | null) => onChange({ ...value, [dia]: tramo });
  return <View accessibilityLabel="Horario de atención" style={styles.box}>
    {ORDEN.filter(dia => DIAS.includes(dia)).map(dia => {
      const tramo = value[dia];
      const nombre = ETIQUETA_DIA[dia];
      return <View key={dia} style={styles.row}>
        <Pressable accessibilityRole="switch" accessibilityLabel={`${nombre}: ${tramo ? 'atiende' : 'cerrado'}`} accessibilityState={{ checked: !!tramo, disabled }}
          disabled={disabled} onPress={() => cambiar(dia, tramo ? null : { abre: '08:00', cierra: '17:00' })} style={styles.toggle}>
          <Text style={styles.day}>{tramo ? '● ' : '○ '}{nombre}</Text>
        </Pressable>
        {tramo ? <View style={styles.times}>
          <TextInput accessibilityLabel={`${nombre}, hora de apertura`} style={styles.time} value={tramo.abre} editable={!disabled} placeholder="08:00" maxLength={5}
            onChangeText={abre => cambiar(dia, { ...tramo, abre })} keyboardType="numbers-and-punctuation" />
          <Text style={styles.to}>a</Text>
          <TextInput accessibilityLabel={`${nombre}, hora de cierre`} style={styles.time} value={tramo.cierra} editable={!disabled} placeholder="17:00" maxLength={5}
            onChangeText={cierra => cambiar(dia, { ...tramo, cierra })} keyboardType="numbers-and-punctuation" />
        </View> : <Text style={styles.closed}>Cerrado</Text>}
      </View>;
    })}
    <Text style={styles.hint}>Formato HH:MM de 24 horas. Si cierra después de la medianoche, escribe la hora de la madrugada (por ejemplo, 20:00 a 02:00).</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  box: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, minHeight: 48 },
  toggle: { minWidth: 130, minHeight: 48, justifyContent: 'center' },
  day: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  times: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, minHeight: 48, minWidth: 72, padding: 10, color: colors.ink, fontSize: 16, textAlign: 'center' },
  to: { color: colors.muted, fontSize: 15 },
  closed: { color: colors.muted, fontSize: 15 },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  error: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
