import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Brand } from '../../components/Brand';
import { Feedback } from '../../components/Feedback';
import { colors } from '../../constants/theme';
import type { LoginIdentity } from '../../services/login';
import type { ServiceResponse } from '../../domain/response';

type Props = {
  signIn: (input: { email: string; password: string }) => Promise<ServiceResponse<LoginIdentity>>;
  onRegister: () => void;
  sessionMessage?: string;
};
export default function LoginScreen({ signIn, onRegister, sessionMessage }: Props) {
  const { width, height } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const sending = useRef(false);
  async function submit() {
    if (sending.current) return;
    if (!email.trim() || !password) { setMessage('Escribe tu correo y contraseña.'); return; }
    sending.current = true;
    setPending(true);
    setMessage('');
    try {
      const result = await signIn({ email, password });
      if (result.codigo !== 'OK') setMessage(result.mensaje);
    } catch { setMessage('No pudimos iniciar sesión. Comprueba la conexión e inténtalo de nuevo.'); }
    finally { setPassword(''); setVisible(false); sending.current = false; setPending(false); }
  }
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.scroll}>
      <View style={[styles.canvas, { minHeight: height }]}>
        <View pointerEvents="none" style={styles.background}>
          <Image accessible={false} source={require('../../../assets/fondo-iniciar-sesion.png')} resizeMode="contain" style={styles.image} />
        </View>
        <SafeAreaView style={styles.content}>
          <View style={styles.brand}><Brand width={Math.min(width * 0.66, 280)} /></View>
          <Text accessibilityRole="header" style={styles.title}>Iniciar sesión</Text>
          <View style={styles.field}>
            <Feather name="mail" size={22} color={colors.muted} accessible={false} />
            <TextInput accessibilityLabel="Correo electrónico" placeholder="Correo electrónico" placeholderTextColor={colors.muted}
              value={email} onChangeText={setEmail} editable={!pending} autoCapitalize="none" autoCorrect={false}
              keyboardType="email-address" autoComplete="email" style={styles.input} />
          </View>
          <View style={styles.field}>
            <Feather name="lock" size={22} color={colors.muted} accessible={false} />
            <TextInput accessibilityLabel="Contraseña" placeholder="Contraseña" placeholderTextColor={colors.muted}
              value={password} onChangeText={setPassword} editable={!pending} autoCapitalize="none" autoCorrect={false}
              secureTextEntry={!visible} autoComplete="current-password" returnKeyType="go" onSubmitEditing={() => { void submit(); }} style={styles.input} />
            <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onPress={() => setVisible(!visible)} style={styles.eye}><Feather name={visible ? 'eye-off' : 'eye'} size={22} color={colors.muted} accessible={false} /></Pressable>
          </View>
          {!!(message || sessionMessage) && <Feedback state="error" message={message || sessionMessage!} />}
          {pending && <Feedback state="loading" message="Comprobando tu cuenta…" />}
          <Pressable accessibilityRole="button" accessibilityLabel={pending ? 'Iniciando sesión' : 'Iniciar sesión'}
            disabled={pending} accessibilityState={{ disabled: pending, busy: pending }} onPress={() => { void submit(); }}
            style={[styles.button, pending && styles.dimmed]}><Text style={styles.buttonText}>{pending ? 'Iniciando sesión…' : 'Iniciar sesión'}</Text></Pressable>
          <View style={styles.signUp}><Text style={styles.text}>¿No tienes una cuenta?</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Crear cuenta" disabled={pending} onPress={onRegister} style={styles.linkButton}>
              <Text style={styles.link}>Crear cuenta</Text>
            </Pressable>
          </View>
          <View style={{ height: Math.min(width, 480) * 0.4 }} />
        </SafeAreaView>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF7F2' }, scroll: { flexGrow: 1 },
  canvas: { width: '100%', maxWidth: 480, alignSelf: 'center', overflow: 'hidden' },
  background: { position: 'absolute', bottom: 0, width: '100%', aspectRatio: 390 / 844 }, image: { width: '100%', height: '100%' },
  content: { paddingHorizontal: 26, paddingTop: 40, gap: 16 }, brand: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  field: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, gap: 14, minHeight: 54, borderWidth: 1, borderColor: '#CDD0D5', backgroundColor: '#FFFFFFB3', borderRadius: 13 },
  input: { flex: 1, minWidth: 0, minHeight: 52, paddingVertical: 12, fontSize: 16, color: colors.ink },
  eye: { width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 56, padding: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F56A25', borderRadius: 24, marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 20 }, dimmed: { opacity: 0.65 },
  signUp: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 6 },
  text: { color: colors.muted, fontSize: 15 }, linkButton: { minHeight: 44, justifyContent: 'center' }, link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
