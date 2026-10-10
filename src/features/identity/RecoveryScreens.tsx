import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Brand } from '../../components/Brand';
import { Feedback } from '../../components/Feedback';
import { colors } from '../../constants/theme';
import { validatePassword } from '../../domain/registration';
import type { ServiceResponse } from '../../domain/response';

type Send = (input: object) => Promise<ServiceResponse>;
const failure = 'No pudimos procesar la solicitud. Inténtalo de nuevo.';

// Un solo envío a la vez; el reintento siempre es manual.
function useSubmit(send: Send) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ServiceResponse | null>(null);
  const [message, setMessage] = useState('');
  const sending = useRef(false);
  async function submit(input: object) {
    if (sending.current) return;
    sending.current = true;
    setPending(true);
    setMessage('');
    try {
      const reply = await send(input);
      setResult(reply);
      setMessage(reply.mensaje);
    } catch { setResult(null); setMessage(failure); }
    finally { sending.current = false; setPending(false); }
  }
  return { pending, result, message, setMessage, submit };
}

export function RecoveryRequestScreen({ request, onBack }: { request: Send; onBack: () => void }) {
  const [email, setEmail] = useState('');
  const { pending, result, message, setMessage, submit } = useSubmit(request);
  const sent = result?.codigo === 'OK';
  return <Layout title="Recuperar contraseña" onBack={onBack} pending={pending}>
    {!sent && <>
      <Text style={styles.text}>Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.</Text>
      <Field icon="mail" label="Correo electrónico" value={email} onChange={setEmail} editable={!pending} email />
    </>}
    {!!message && <Feedback state={sent ? 'empty' : 'error'} message={message} />}
    {pending && <Feedback state="loading" message="Enviando solicitud…" />}
    {sent
      ? <Button label="Volver a iniciar sesión" onPress={onBack} />
      : <Button label={pending ? 'Enviando…' : 'Enviar enlace'} pending={pending}
        onPress={() => { if (email.trim()) void submit({ email }); else setMessage('Escribe un correo válido.'); }} />}
  </Layout>;
}

type ResetProps = { id?: string; code?: string; complete: Send; onLogin: () => void; onRequestNew: () => void; onCompleted?: () => void };
export function ResetPasswordScreen({ id, code, complete, onLogin, onRequestNew, onCompleted }: ResetProps) {
  const [fields, setFields] = useState({ password: '', confirmPassword: '' });
  const [visible, setVisible] = useState(false);
  const { pending, result, message, setMessage, submit } = useSubmit(async input => {
    const reply = await complete(input);
    if (reply.codigo === 'OK') onCompleted?.();
    return reply;
  });
  const done = result?.codigo === 'OK';
  const invalid = !id || !code || result?.codigo === 'RECUPERACION_INVALIDA';
  async function save() {
    try { validatePassword(fields); }
    catch (error) { setMessage((error as Error).message); return; }
    await submit({ id, code, ...fields });
    setFields({ password: '', confirmPassword: '' });
  }
  return <Layout title={done ? 'Contraseña actualizada' : 'Nueva contraseña'} onBack={onLogin} pending={pending}>
    {!done && !invalid && <>
      <Field icon="lock" label="Nueva contraseña" value={fields.password} editable={!pending} secret={!visible}
        hint="Al menos 8 caracteres, una letra y un número." onChange={password => setFields(f => ({ ...f, password }))} />
      <Field icon="lock" label="Confirmar contraseña" value={fields.confirmPassword} editable={!pending} secret={!visible}
        onChange={confirmPassword => setFields(f => ({ ...f, confirmPassword }))} />
      <Pressable accessibilityRole="button" onPress={() => setVisible(!visible)} style={styles.linkButton}>
        <Text style={styles.link}>{visible ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</Text>
      </Pressable>
    </>}
    {(!!message || invalid) && <Feedback state={done ? 'empty' : result?.codigo === 'EN_PROCESO' ? 'pending' : 'error'}
      message={message || 'El enlace no es válido. Solicita uno nuevo.'} />}
    {pending && <Feedback state="loading" message="Guardando contraseña…" />}
    {done ? <Button label="Iniciar sesión" onPress={onLogin} />
      : invalid ? <Button label="Solicitar enlace nuevo" onPress={onRequestNew} />
        : <Button label={pending ? 'Guardando…' : 'Guardar contraseña'} pending={pending} onPress={() => { void save(); }} />}
  </Layout>;
}

function Layout({ title, onBack, pending, children }: { title: string; onBack: () => void; pending: boolean; children: ReactNode }) {
  const { width } = useWindowDimensions();
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <SafeAreaView style={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onBack} disabled={pending} style={styles.back}>
          <Feather name="chevron-left" size={28} color={colors.ink} accessible={false} />
        </Pressable>
        <View style={styles.brand}><Brand width={Math.min(width * 0.6, 240)} /></View>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {children}
      </SafeAreaView>
    </ScrollView>
  </KeyboardAvoidingView>;
}

type FieldProps = { icon: 'mail' | 'lock'; label: string; value: string; onChange: (value: string) => void; editable: boolean; email?: boolean; secret?: boolean; hint?: string };
function Field({ icon, label, value, onChange, editable, email, secret, hint }: FieldProps) {
  return <View style={styles.field}>
    <Feather name={icon} size={22} color={colors.muted} accessible={false} />
    <TextInput accessibilityLabel={label} accessibilityHint={hint} placeholder={label} placeholderTextColor={colors.muted}
      value={value} onChangeText={onChange} editable={editable} autoCapitalize="none" autoCorrect={false}
      keyboardType={email ? 'email-address' : 'default'} autoComplete={email ? 'email' : 'new-password'}
      secureTextEntry={secret} style={styles.input} />
  </View>;
}

function Button({ label, onPress, pending = false }: { label: string; onPress: () => void; pending?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={pending}
    accessibilityState={{ disabled: pending, busy: pending }} onPress={onPress} style={[styles.button, pending && styles.dimmed]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF7F2' }, scroll: { flexGrow: 1 },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 26, paddingTop: 12, gap: 16 },
  back: { width: 44, height: 44, justifyContent: 'center', marginLeft: -14 }, brand: { alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink }, text: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  field: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 14, minHeight: 54, borderWidth: 1, borderColor: '#CDD0D5', backgroundColor: '#FFFFFFB3', borderRadius: 13 },
  input: { flex: 1, minWidth: 0, minHeight: 52, paddingVertical: 12, fontSize: 16, color: colors.ink },
  linkButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  button: { minHeight: 56, padding: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F56A25', borderRadius: 24, marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 20 }, dimmed: { opacity: 0.65 },
});
