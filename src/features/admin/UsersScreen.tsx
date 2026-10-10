import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Brand } from '../../components/Brand';
import { Feedback } from '../../components/Feedback';
import { colors } from '../../constants/theme';
import { validateContact, validateRegistration } from '../../domain/registration';
import { roleLabels, stateLabels, type ManagedUser } from '../../domain/users';
import type { ServiceResponse } from '../../domain/response';

type Service = (action: 'users/list' | 'users/create' | 'users/update', input: unknown) => Promise<ServiceResponse>;
export default function UsersScreen({ service }: { service: Service }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [form, setForm] = useState<ManagedUser | 'new' | null>(null);
  const [name, setName] = useState(''), [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [password, setPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const sending = useRef(false);
  const mounted = useRef(true);
  const load = useCallback(() => service('users/list', {}).then(result => {
    if (!mounted.current) return;
    if (result.codigo === 'OK') setUsers((result.datos as { users: ManagedUser[] }).users);
    else setListError(result.mensaje);
  }).catch(() => {
    if (mounted.current) setListError('No pudimos consultar los usuarios. Revisa la conexión y reintenta.');
  }).finally(() => { if (mounted.current) setLoading(false); }), [service]);
  function refresh() { setLoading(true); setListError(''); void load(); }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, [load]);
  function open(user: ManagedUser | 'new') {
    setForm(user); setMessage(''); setPassword(''); setConfirmPassword(''); setVisible(false);
    setName(user === 'new' ? '' : user.pendingContact?.name ?? user.name); setEmail(user === 'new' ? '' : user.pendingContact?.email ?? user.email); setRole('student');
  }
  async function save() {
    if (!form || sending.current) return;
    try {
      if (form === 'new') validateRegistration({ name, email, password, confirmPassword }, role);
      else validateContact({ name, email }, form.role);
    } catch (error) { setMessage((error as Error).message); return; }
    sending.current = true; setBusy(true); setMessage('');
    try {
      const result = await service(form === 'new' ? 'users/create' : 'users/update', form === 'new'
        ? { name, email, password, confirmPassword, role }
        : { id: form.id, version: form.version, name, email });
      if (!mounted.current) return;
      setMessage(result.mensaje);
      if (result.codigo === 'OK') {
        setForm(null); setPassword(''); setConfirmPassword('');
        await refresh();
      }
    } catch { if (mounted.current) setMessage('Sin conexión: los cambios no se han guardado o confirmado. Conservamos lo escrito; reintenta manualmente.'); }
    finally { sending.current = false; if (mounted.current) setBusy(false); }
  }
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.screen}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Brand width={154} />
        <Text accessibilityRole="header" style={styles.title}>{form ? form === 'new' ? 'Crear usuario' : 'Editar usuario' : 'Usuarios'}</Text>
        <Text style={styles.subtitle}>{form ? 'Gestiona los datos de la comunidad UniFood.' : 'Consulta y administra las cuentas de la comunidad.'}</Text>
        {!!message && <View accessibilityLiveRegion="polite" style={styles.notice}><Text style={styles.body}>{message}</Text></View>}
        {form ? <View style={styles.card}>
          <Text style={styles.label}>Nombre completo</Text>
          <TextInput accessibilityLabel="Nombre completo" style={styles.input} value={name} onChangeText={setName} editable={!busy} autoComplete="name" />
          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput accessibilityLabel="Correo electrónico" style={styles.input} value={email} onChangeText={setEmail} editable={!busy} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
          {form === 'new' ? <>
            <Text style={styles.label}>Tipo de cuenta</Text>
            <View style={styles.roles}>{(['student', 'admin'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={roleLabels[value]} accessibilityState={{ checked: role === value, disabled: busy }} disabled={busy} onPress={() => setRole(value)} style={[styles.role, role === value && styles.selected]}><Text style={styles.body}>{role === value ? '● ' : '○ '}{roleLabels[value]}</Text></Pressable>)}</View>
            <Text style={styles.subtitle}>Los estudiantes deben usar su correo @usc.edu.co.</Text>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.password}><TextInput accessibilityLabel="Contraseña" style={styles.passwordInput} value={password} onChangeText={setPassword} editable={!busy} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} /><Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar contraseñas' : 'Mostrar contraseñas'} onPress={() => setVisible(!visible)} style={styles.eye}><Feather name={visible ? 'eye-off' : 'eye'} size={22} color={colors.ink} /></Pressable></View>
            <Text style={styles.label}>Confirmar contraseña</Text>
            <TextInput accessibilityLabel="Confirmar contraseña" style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} editable={!busy} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.subtitle}>Mínimo 8 caracteres, una letra y un número.</Text>
          </> : <Text style={styles.body}>Rol: {roleLabels[form.role]} · No editable</Text>}
          <ActionButton busy={busy} label={busy ? 'Guardando' : form === 'new' ? 'Crear cuenta' : 'Guardar cambios'} onPress={() => { void save(); }} />
          <ActionButton busy={busy} label="Volver al listado" secondary onPress={() => { setForm(null); setMessage(''); setPassword(''); setConfirmPassword(''); refresh(); }} />
        </View> : <>
          <ActionButton busy={busy} label="Crear usuario" onPress={() => open('new')} />
          {loading ? <Feedback state="loading" message="Consultando usuarios…" /> : listError ? <Feedback state="error" message={listError} onRetry={() => { void refresh(); }} /> : <>
            <ActionButton busy={busy} label="Actualizar listado" secondary onPress={refresh} />
            {!users.length && <Feedback state="empty" message="No hay usuarios para mostrar." />}
            {users.map(user => <View key={user.id} style={styles.card}>
              <Text style={styles.name}>{user.name}</Text><Text style={styles.body}>{user.email}</Text>
              <Text style={styles.subtitle}>{roleLabels[user.role]} · {stateLabels[user.state]}</Text>
              {!!user.pendingContact && <Text style={styles.body}>Edición pendiente de verificación</Text>}
              {user.state !== 'deleted' && <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${user.name}`} onPress={() => open(user)} style={styles.edit}><Feather name="edit-2" size={18} color={colors.primary} /><Text style={styles.secondaryLabel}>Editar</Text></Pressable>}
            </View>)}
          </>}
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
function ActionButton({ label, onPress, busy, secondary = false }: { label: string; onPress: () => void; busy: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onPress} style={[styles.button, secondary && styles.secondary, busy && styles.disabled]}><Text style={secondary ? styles.secondaryLabel : styles.buttonLabel}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 24, paddingBottom: 48, gap: 16 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  name: { color: colors.ink, fontSize: 19, fontWeight: '700' },
  label: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  card: { padding: 18, gap: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  notice: { padding: 16, backgroundColor: colors.accent, borderRadius: 16 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, minHeight: 52, padding: 12, color: colors.ink, fontSize: 16 },
  password: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  passwordInput: { flex: 1, minWidth: 0, padding: 12, minHeight: 52, color: colors.ink, fontSize: 16 },
  eye: { minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 24, minHeight: 52, padding: 14, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.accent },
  buttonLabel: { color: colors.surface, fontSize: 17, fontWeight: '700' },
  secondaryLabel: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  role: { minHeight: 48, padding: 12, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  selected: { backgroundColor: colors.accent, borderColor: colors.primary },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
});
