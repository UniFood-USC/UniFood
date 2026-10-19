import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../../components/Brand';
import { Feedback } from '../../components/Feedback';
import { colors } from '../../constants/theme';
import { validateRegistration, type RegistrationInput } from '../../domain/registration';
import type { ServiceResponse } from '../../domain/response';

type Props = { register: (input: RegistrationInput) => Promise<ServiceResponse>; onCreated?: () => void; onBack?: () => void; onLogin?: () => void };
const initial = { name: '', email: '', password: '', confirmPassword: '' };
export default function RegistrationScreen({ register, onCreated, onBack, onLogin }: Props) {
  const { width, height } = useWindowDimensions();
  const [fields, setFields] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [created, setCreated] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [visible, setVisible] = useState({ password: false, confirmPassword: false });
  const sending = useRef(false);
  async function submit() {
    if (sending.current || created || uncertain) return;
    try { validateRegistration(fields, 'student'); }
    catch (error) { setMessage((error as Error).message); return; }
    sending.current = true;
    setPending(true);
    setMessage('');
    try {
      const result = await register(fields);
      setMessage(result.mensaje);
      if (result.codigo === 'OK') { setCreated(true); setFields(initial); }
      setUncertain(result.codigo === 'EN_PROCESO');
    } catch {
      setMessage('No pudimos confirmar el registro. Conservamos tus datos; comprueba la conexión y reintenta. Si la cuenta ya se creó, se indicará sin duplicarla.');
    } finally { sending.current = false; setPending(false); }
  }
  const inputs = [
    { key: 'name' as const, label: 'Nombre completo', icon: 'user' as const },
    { key: 'email' as const, label: 'Correo electrónico', icon: 'mail' as const },
    { key: 'password' as const, label: 'Contraseña', icon: 'lock' as const },
    { key: 'confirmPassword' as const, label: 'Confirmar contraseña', icon: 'lock' as const },
  ];
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.scroll}>
    <View style={[styles.canvas, { minHeight: height }]}>
      <View pointerEvents="none" style={styles.background}>
        <Image accessible={false} source={require('../../../assets/fondo-crear-cuenta.png')}
          resizeMode="contain" style={{ width: '100%', height: '100%' }} />
      </View>
      <SafeAreaView style={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onBack}
        disabled={pending} accessibilityState={{ disabled: pending }} style={styles.back}>
        <Feather name="chevron-left" size={28} color={colors.ink} accessible={false} />
      </Pressable>
      <View style={styles.brand}><Brand width={Math.min(width * 0.66, 280)} /></View>
      <Text accessibilityRole="header" style={styles.title}>{created ? '¡Tu cuenta está lista!' : 'Crear cuenta'}</Text>
      {!created && <View style={styles.fields}>
        {inputs.map(({ key, label, icon }) => {
          const secret = key === 'password' || key === 'confirmPassword' ? key : null;
          return <View key={key} style={styles.field}>
          <Feather name={icon} size={22} color="#424951" accessible={false} />
          <TextInput accessibilityLabel={label} placeholder={label} placeholderTextColor={colors.muted} value={fields[key]}
            accessibilityHint={key === 'email' ? 'Usa tu correo institucional @usc.edu.co.' : secret ? 'Al menos 8 caracteres, una letra y un número.' : undefined}
            onChangeText={value => setFields(current => ({ ...current, [key]: value }))} editable={!pending && !uncertain}
            autoCapitalize={key === 'name' ? 'words' : 'none'} autoCorrect={false}
            keyboardType={key === 'email' ? 'email-address' : 'default'}
            secureTextEntry={secret !== null && !visible[secret]}
            autoComplete={key === 'email' ? 'email' : key === 'name' ? 'name' : 'new-password'} style={styles.input} />
          {secret && <Pressable accessibilityRole="button"
            accessibilityLabel={`${visible[secret] ? 'Ocultar' : 'Mostrar'} ${secret === 'password' ? 'contraseña' : 'confirmación de contraseña'}`}
            accessibilityState={{ selected: visible[secret] }}
            onPress={() => setVisible(current => ({ ...current, [secret]: !current[secret] }))} style={styles.passwordToggle}>
            <Feather name={visible[secret] ? 'eye-off' : 'eye'} size={21} color="#424951" accessible={false} />
          </Pressable>}
        </View>; })}
      </View>}
      {!!message && <Feedback state={created ? 'empty' : uncertain ? 'pending' : 'error'} message={message} />}
      {pending && <Feedback state="loading" message="Estamos creando tu cuenta…" />}
      {!created && <Pressable accessibilityRole="button" accessibilityLabel={pending ? 'Creando cuenta' : 'Registrarme'} accessibilityState={{ disabled: pending || uncertain, busy: pending }} disabled={pending || uncertain} onPress={() => { void submit(); }} style={({ pressed }) => [styles.button, (pending || uncertain || pressed) && styles.dimmed]}>
        <Text style={styles.buttonText}>{pending ? 'Creando cuenta…' : 'Registrarme'}</Text>
      </Pressable>}
      {created && onCreated && <Pressable accessibilityRole="button" onPress={onCreated} style={styles.button}><Text style={styles.buttonText}>Continuar</Text></Pressable>}
      {!created && <View style={styles.signIn}>
        <Text style={styles.accountText}>¿Ya tienes una cuenta?</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Iniciar sesión" onPress={onLogin}
          disabled={pending} accessibilityState={{ disabled: pending }} style={styles.signInLink}>
          <Text style={styles.link}>Iniciar sesión</Text>
        </Pressable>
      </View>}
      <View pointerEvents="none" style={{ height: Math.min(width, 480) * 0.38 }} />
      </SafeAreaView>
    </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF7F2' },
  scroll: { flexGrow: 1 },
  canvas: { width: '100%', maxWidth: 480, alignSelf: 'center', overflow: 'hidden' },
  background: { position: 'absolute', bottom: 0, width: '100%', aspectRatio: 390 / 844 },
  content: { paddingHorizontal: 26, paddingTop: 12 },
  back: { width: 44, height: 44, justifyContent: 'center', marginLeft: -14 },
  brand: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 28, fontWeight: '700', color: '#121820', marginBottom: 16 },
  fields: { gap: 12, marginBottom: 22 },
  field: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, gap: 14, minHeight: 52, borderWidth: 1, borderColor: '#CDD0D5', backgroundColor: '#FFFFFFB3', borderRadius: 13 },
  input: { flex: 1, minWidth: 0, minHeight: 50, paddingVertical: 12, paddingHorizontal: 0, fontSize: 16, color: colors.ink },
  passwordToggle: { width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  signIn: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 5, marginTop: 8 },
  accountText: { color: '#505052', fontSize: 15 },
  signInLink: { minHeight: 44, justifyContent: 'center' },
  link: { color: '#D94C0B', fontSize: 15, fontWeight: '600' },
  button: { minHeight: 56, padding: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F56A25', borderRadius: 24 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 20 },
  dimmed: { opacity: 0.65 },
});
