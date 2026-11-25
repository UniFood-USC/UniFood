import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../../components/Brand';
import { Feedback } from '../../components/Feedback';
import { colors } from '../../constants/theme';
import { DESCRIPCION_MAX, NOMBRE_MAX, validarRegistroRestaurante, type ErroresRestaurante } from '../../domain/restaurantManagement';
import type { ServiceResponse } from '../../domain/response';
import type { Horario } from '../../types/Estado_Restaurante';
import ScheduleEditor from './ScheduleEditor';

// RF-22 · Formulario de registro del restaurante (autoalta). Cualquier dominio de correo; queda pendiente de aprobación.
type Service = (action: 'restaurants/register', input: unknown) => Promise<ServiceResponse>;
const HORARIO_INICIAL: Horario = { lunes: { abre: '08:00', cierra: '17:00' }, martes: { abre: '08:00', cierra: '17:00' }, miercoles: { abre: '08:00', cierra: '17:00' }, jueves: { abre: '08:00', cierra: '17:00' }, viernes: { abre: '08:00', cierra: '17:00' } };
const vacio = { nombre: '', descripcion: '', ubicacion: '', telefono: '', correo: '', password: '', confirmPassword: '' };

export default function RestaurantRegistrationScreen({ service, onDone, onBack }: { service: Service; onDone?: () => void; onBack?: () => void }) {
  const [campos, setCampos] = useState(vacio);
  const [horario, setHorario] = useState<Horario>(HORARIO_INICIAL);
  const [errores, setErrores] = useState<ErroresRestaurante>({});
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [creado, setCreado] = useState(false);
  const [incierto, setIncierto] = useState(false);
  const [visible, setVisible] = useState(false);
  const enviando = useRef(false);

  async function enviar() {
    if (enviando.current || creado || incierto) return;
    const entrada = { ...campos, horario };
    const validado = validarRegistroRestaurante(entrada);
    if (!validado.ok) { setErrores(validado.errores); setMensaje('Revisa los campos marcados.'); return; }
    enviando.current = true; setOcupado(true); setErrores({}); setMensaje('');
    try {
      const result = await service('restaurants/register', entrada);
      setMensaje(result.mensaje);
      const detalle = (result.datos as { errores?: ErroresRestaurante } | null)?.errores;
      if (detalle) setErrores(detalle);
      if (result.codigo === 'CORREO_EN_USO') setErrores({ correo: result.mensaje });
      if (result.codigo === 'OK') { setCreado(true); setCampos(vacio); }
      setIncierto(result.codigo === 'EN_PROCESO');
    } catch { setMensaje('No pudimos confirmar el registro. Conservamos tus datos; comprueba la conexión y reintenta. Si ya se registró, se indicará sin duplicarlo.'); }
    finally { enviando.current = false; setOcupado(false); }
  }

  const campo = (clave: keyof typeof vacio, etiqueta: string, opciones: { multiline?: boolean; secreto?: boolean; teclado?: 'email-address' | 'phone-pad'; ayuda?: string; max?: number } = {}) => <View style={styles.field}>
    <Text style={styles.label}>{etiqueta}</Text>
    <TextInput accessibilityLabel={etiqueta} accessibilityHint={opciones.ayuda} value={campos[clave]} editable={!ocupado && !incierto}
      onChangeText={valor => setCampos(actual => ({ ...actual, [clave]: valor }))} multiline={opciones.multiline}
      secureTextEntry={!!opciones.secreto && !visible} autoCapitalize={opciones.teclado === 'email-address' || opciones.secreto ? 'none' : 'sentences'} autoCorrect={false}
      keyboardType={opciones.teclado} style={[styles.input, opciones.multiline && styles.multiline, !!errores[clave] && styles.invalid]} />
    {opciones.max && <Text style={styles.hint}>{Array.from(campos[clave]).length} / {opciones.max.toLocaleString('es-CO')}</Text>}
    {!!opciones.ayuda && !errores[clave] && <Text style={styles.hint}>{opciones.ayuda}</Text>}
    {!!errores[clave] && <Text accessibilityRole="alert" style={styles.error}>{errores[clave]}</Text>}
  </View>;

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onBack} disabled={ocupado} style={styles.back}><Text style={styles.link}>‹ Volver</Text></Pressable>
        <Brand width={154} />
        <Text accessibilityRole="header" style={styles.title}>{creado ? '¡Restaurante registrado!' : 'Registrar restaurante'}</Text>
        {creado ? <>
          <Feedback state="empty" message={mensaje} />
          <View style={styles.pending}><Text style={styles.body}>Estado: pendiente de aprobación. Hasta que la administración lo apruebe no aparecerás ante los estudiantes ni recibirás pedidos, pero puedes completar tu información y preparar tu menú.</Text></View>
          <Pressable accessibilityRole="button" onPress={onDone} style={styles.button}><Text style={styles.buttonText}>Iniciar sesión</Text></Pressable>
        </> : <>
          <Text style={styles.subtitle}>Tu restaurante quedará pendiente de aprobación administrativa. Puedes usar un correo de cualquier dominio.</Text>
          {campo('nombre', 'Nombre del restaurante', { max: NOMBRE_MAX })}
          {campo('descripcion', 'Descripción', { multiline: true, max: DESCRIPCION_MAX })}
          {campo('ubicacion', 'Ubicación dentro del campus', { ayuda: 'Por ejemplo: Bloque B, primer piso.' })}
          <View style={styles.field}><Text style={styles.label}>Horario de atención</Text>
            <ScheduleEditor value={horario} onChange={setHorario} disabled={ocupado || incierto} error={errores.horario} /></View>
          {campo('telefono', 'Teléfono', { teclado: 'phone-pad' })}
          {campo('correo', 'Correo electrónico', { teclado: 'email-address' })}
          {campo('password', 'Contraseña', { secreto: true, ayuda: 'Mínimo 8 caracteres, una letra y un número.' })}
          {campo('confirmPassword', 'Confirmar contraseña', { secreto: true })}
          <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar contraseñas' : 'Mostrar contraseñas'} onPress={() => setVisible(!visible)} style={styles.toggle}><Text style={styles.link}>{visible ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</Text></Pressable>
          {!!mensaje && <Feedback state={incierto ? 'pending' : 'error'} message={mensaje} />}
          {ocupado && <Feedback state="loading" message="Estamos registrando tu restaurante…" />}
          <Pressable accessibilityRole="button" accessibilityLabel={ocupado ? 'Registrando' : 'Registrar restaurante'} accessibilityState={{ disabled: ocupado || incierto, busy: ocupado }}
            disabled={ocupado || incierto} onPress={() => { void enviar(); }} style={[styles.button, (ocupado || incierto) && styles.dim]}>
            <Text style={styles.buttonText}>{ocupado ? 'Registrando…' : 'Registrar restaurante'}</Text></Pressable>
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 24, paddingBottom: 48, gap: 16 },
  back: { minHeight: 44, justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  field: { gap: 6 },
  label: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, minHeight: 52, padding: 12, color: colors.ink, fontSize: 16, backgroundColor: colors.surface },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  invalid: { borderColor: colors.primary, borderWidth: 2 },
  hint: { color: colors.muted, fontSize: 14 },
  error: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  pending: { padding: 16, borderRadius: 16, backgroundColor: colors.accent },
  link: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  toggle: { minHeight: 48, justifyContent: 'center' },
  button: { minHeight: 56, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 24 },
  buttonText: { color: colors.surface, fontSize: 18, fontWeight: '700' },
  dim: { opacity: 0.6 },
});
