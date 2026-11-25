import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feedback } from '../../components/Feedback';
import { colors } from '../../constants/theme';
import {
  DESCRIPCION_MAX, ETIQUETA_CONDICION, ETIQUETA_ESTADO, NOMBRE_MAX, reaperturaAISO, reaperturaATexto, validarCierresEspeciales, validarCierreTemporal,
  validarHorario, validarInformacion, type ErroresRestaurante, type RestauranteGestion,
} from '../../domain/restaurantManagement';
import type { ServiceResponse } from '../../domain/response';
import type { CierreEspecial, Horario } from '../../types/Estado_Restaurante';
import ScheduleEditor from './ScheduleEditor';

// RF-22 · Panel del propietario: estado del registro (pendiente, rechazado con su motivo, suspendido), información,
// horario por día con cierres especiales y cierre temporal. Siempre muestra lo que quedó guardado en el servicio.
type Action = 'restaurants/mine' | 'restaurants/mine-save' | 'restaurants/resubmit' | 'restaurants/schedule' | 'restaurants/closure';
export type RestaurantInfoService = (action: Action, input: unknown) => Promise<ServiceResponse>;
type Aviso = { tipo: 'ok' | 'error'; texto: string } | null;

export default function RestaurantInfoScreen({ service, reloj = () => new Date() }: { service: RestaurantInfoService; reloj?: () => Date }) {
  const [restaurante, setRestaurante] = useState<RestauranteGestion | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [aviso, setAviso] = useState<Aviso>(null);
  const [errores, setErrores] = useState<ErroresRestaurante>({});
  const [ocupado, setOcupado] = useState(false);
  const [info, setInfo] = useState({ nombre: '', descripcion: '', ubicacion: '', telefono: '', logo: '' });
  const [horario, setHorario] = useState<Horario>({});
  const [cierres, setCierres] = useState<CierreEspecial[]>([]);
  const [nuevoCierre, setNuevoCierre] = useState({ fecha: '', motivo: '' });
  const [reapertura, setReapertura] = useState({ hasta: '', motivo: '' });
  const [errorHorario, setErrorHorario] = useState('');
  const [errorCierre, setErrorCierre] = useState('');
  const mounted = useRef(true);
  const enviando = useRef(false);

  const aplicar = useCallback((r: RestauranteGestion) => {
    setRestaurante(r);
    setInfo({ nombre: r.nombre, descripcion: r.descripcion, ubicacion: r.ubicacion, telefono: r.telefono, logo: r.logo ?? '' });
    setHorario(r.horario); setCierres(r.cierresEspeciales);
    setReapertura({ hasta: r.cierreTemporal ? reaperturaATexto(r.cierreTemporal.hasta) : '', motivo: r.cierreTemporal?.motivo ?? '' });
  }, []);
  const cargar = useCallback(() => service('restaurants/mine', {}).then(result => {
    if (!mounted.current) return;
    if (result.codigo === 'OK') { aplicar((result.datos as { restaurante: RestauranteGestion }).restaurante); setErrorCarga(''); } else setErrorCarga(result.mensaje);
  }).catch(() => { if (mounted.current) setErrorCarga('No pudimos consultar tu restaurante. Revisa la conexión y reintenta.'); }), [service, aplicar]);
  useEffect(() => { mounted.current = true; void cargar(); return () => { mounted.current = false; }; }, [cargar]);

  // Una desconexión no demuestra que el cambio falló: se dice así y se vuelve a consultar lo guardado.
  async function guardar(action: Action, cuerpo: Record<string, unknown>, exito: string, alFallar?: (r: ServiceResponse) => void) {
    if (!restaurante || enviando.current) return;
    enviando.current = true; setOcupado(true); setAviso(null);
    try {
      const result = await service(action, { version: restaurante.version, ...cuerpo });
      if (!mounted.current) return;
      if (result.codigo === 'OK') { aplicar((result.datos as { restaurante: RestauranteGestion }).restaurante); setErrores({}); setAviso({ tipo: 'ok', texto: result.mensaje || exito }); }
      else {
        const detalle = (result.datos as { errores?: ErroresRestaurante } | null)?.errores;
        if (detalle) setErrores(detalle);
        if (result.codigo === 'CONFLICTO_VERSION') { void cargar(); }
        alFallar?.(result); setAviso({ tipo: 'error', texto: result.mensaje });
      }
    } catch { if (mounted.current) { setAviso({ tipo: 'error', texto: 'No pudimos confirmar el cambio por la conexión. Revisa lo guardado antes de repetirlo.' }); void cargar(); } }
    finally { enviando.current = false; if (mounted.current) setOcupado(false); }
  }

  if (errorCarga) return <ScrollView contentContainerStyle={styles.content}><Feedback state="error" message={errorCarga} onRetry={() => { setErrorCarga(''); void cargar(); }} /></ScrollView>;
  if (!restaurante) return <ScrollView contentContainerStyle={styles.content}><Feedback state="loading" message="Consultando tu restaurante…" /></ScrollView>;

  const editable = ['pendiente', 'rechazado', 'aprobado'].includes(restaurante.estado) && !ocupado;
  const rechazado = restaurante.estado === 'rechazado';
  const guardarInfo = () => {
    const validado = validarInformacion({ ...info, logo: info.logo.trim() });
    if (!validado.ok) { setErrores(validado.errores); setAviso({ tipo: 'error', texto: 'Revisa los campos marcados.' }); return; }
    void guardar(rechazado ? 'restaurants/resubmit' : 'restaurants/mine-save', { ...validado.info }, rechazado ? 'Registro reenviado.' : 'Información guardada.');
  };
  const guardarHorario = () => {
    const h = validarHorario(horario); if (!h.ok) { setErrorHorario(h.error); return; }
    const c = validarCierresEspeciales(cierres); if (!c.ok) { setErrorHorario(c.error); return; }
    setErrorHorario(''); void guardar('restaurants/schedule', { horario: h.horario, cierresEspeciales: c.cierres }, 'Horario guardado.');
  };
  const agregarCierre = () => {
    const c = validarCierresEspeciales([...cierres, { fecha: nuevoCierre.fecha.trim(), ...(nuevoCierre.motivo.trim() ? { motivo: nuevoCierre.motivo.trim() } : {}) }]);
    if (!c.ok) { setErrorHorario(c.error); return; }
    setErrorHorario(''); setCierres(c.cierres); setNuevoCierre({ fecha: '', motivo: '' });
  };
  const cerrarTemporalmente = () => {
    const iso = reaperturaAISO(reapertura.hasta);
    if (!iso) { setErrorCierre('Indica cuándo volverá a abrir, con formato AAAA-MM-DD HH:MM (hora de Colombia).'); return; }
    const v = validarCierreTemporal({ hasta: iso, ...(reapertura.motivo.trim() ? { motivo: reapertura.motivo.trim() } : {}) }, reloj());
    if (!v.ok) { setErrorCierre(v.error); return; }
    setErrorCierre(''); void guardar('restaurants/closure', { cierreTemporal: { hasta: iso, ...(reapertura.motivo.trim() ? { motivo: reapertura.motivo.trim() } : {}) } }, 'Cierre temporal guardado.');
  };

  const campo = (clave: keyof typeof info, etiqueta: string, extra: { multiline?: boolean; max?: number; teclado?: 'phone-pad' | 'url' } = {}) => <View style={styles.field}>
    <Text style={styles.label}>{etiqueta}</Text>
    <TextInput accessibilityLabel={etiqueta} value={info[clave]} editable={editable} multiline={extra.multiline} keyboardType={extra.teclado}
      autoCapitalize={extra.teclado === 'url' ? 'none' : 'sentences'} onChangeText={valor => setInfo(actual => ({ ...actual, [clave]: valor }))}
      style={[styles.input, extra.multiline && styles.multiline, !!errores[clave] && styles.invalid]} />
    {extra.max && <Text style={styles.hint}>{Array.from(info[clave]).length} / {extra.max.toLocaleString('es-CO')}</Text>}
    {!!errores[clave] && <Text accessibilityRole="alert" style={styles.error}>{errores[clave]}</Text>}
  </View>;
  const boton = (etiqueta: string, onPress: () => void, secundario = false) => <Pressable accessibilityRole="button" accessibilityLabel={etiqueta} accessibilityState={{ disabled: !editable }}
    disabled={!editable} onPress={onPress} style={[styles.button, secundario && styles.secondary, !editable && styles.dim]}><Text style={secundario ? styles.secondaryText : styles.buttonText}>{etiqueta}</Text></Pressable>;

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>{restaurante.nombre}</Text>
      <View accessibilityLiveRegion="polite" style={styles.status}>
        <Text style={styles.statusTitle}>Estado: {ETIQUETA_ESTADO[restaurante.estado]}</Text>
        <Text style={styles.body}>{restaurante.estado === 'aprobado' ? `${ETIQUETA_CONDICION[restaurante.condicion]}${restaurante.proximaApertura ? ` · Abre: ${restaurante.proximaApertura}` : ''}` : ''}</Text>
        {restaurante.estado === 'pendiente' && <Text style={styles.body}>Tu restaurante espera la aprobación de la administración. Mientras tanto puedes completar tu información y preparar tu menú; no apareces ante los estudiantes ni recibes pedidos.</Text>}
        {rechazado && <Text style={styles.body}>Motivo del rechazo: {restaurante.motivoRechazo ?? 'Sin motivo registrado.'} Corrige tu información y reenvíala.</Text>}
        {restaurante.estado === 'suspendido' && <Text style={styles.body}>Tu restaurante está suspendido: no recibe pedidos ni puede cambiar su información. Contacta a la administración.</Text>}
        {restaurante.estado === 'eliminado' && <Text style={styles.body}>Tu restaurante fue eliminado de la plataforma.</Text>}
      </View>
      {!!aviso && <View accessibilityLiveRegion="polite" style={[styles.notice, aviso.tipo === 'error' && styles.noticeError]}><Text accessibilityRole={aviso.tipo === 'error' ? 'alert' : 'text'} style={styles.body}>{aviso.texto}</Text></View>}

      <Text accessibilityRole="header" style={styles.section}>Información</Text>
      {campo('nombre', 'Nombre del restaurante', { max: NOMBRE_MAX })}
      {campo('descripcion', 'Descripción', { multiline: true, max: DESCRIPCION_MAX })}
      {campo('ubicacion', 'Ubicación dentro del campus')}
      {campo('telefono', 'Teléfono', { teclado: 'phone-pad' })}
      {campo('logo', 'Logo (enlace https, opcional)', { teclado: 'url' })}
      <Text style={styles.hint}>Correo de la cuenta: {restaurante.correo || 'no registrado'}</Text>
      {boton(rechazado ? 'Corregir y reenviar registro' : 'Guardar información', guardarInfo)}

      <Text accessibilityRole="header" style={styles.section}>Horario de atención</Text>
      <ScheduleEditor value={horario} onChange={setHorario} disabled={!editable} error={errorHorario} />
      <Text style={styles.label}>Cierres especiales (día completo)</Text>
      {!cierres.length && <Text style={styles.hint}>No tienes cierres especiales.</Text>}
      {cierres.map(c => <View key={c.fecha} style={styles.rowBetween}>
        <Text style={styles.body}>{c.fecha}{c.motivo ? ` · ${c.motivo}` : ''}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Quitar cierre del ${c.fecha}`} disabled={!editable} onPress={() => setCierres(cierres.filter(x => x.fecha !== c.fecha))} style={styles.small}><Text style={styles.link}>Quitar</Text></Pressable>
      </View>)}
      <TextInput accessibilityLabel="Fecha del cierre especial (AAAA-MM-DD)" placeholder="AAAA-MM-DD" value={nuevoCierre.fecha} editable={editable} onChangeText={fecha => setNuevoCierre(a => ({ ...a, fecha }))} style={styles.input} />
      <TextInput accessibilityLabel="Motivo del cierre especial (opcional)" placeholder="Motivo (opcional)" value={nuevoCierre.motivo} editable={editable} onChangeText={motivo => setNuevoCierre(a => ({ ...a, motivo }))} style={styles.input} />
      {boton('Agregar cierre especial', agregarCierre, true)}
      {boton('Guardar horario', guardarHorario)}

      <Text accessibilityRole="header" style={styles.section}>Cierre temporal</Text>
      {restaurante.cierreTemporal
        ? <Text accessibilityLiveRegion="polite" style={styles.body}>Cerrado temporalmente. Vuelve a abrir: {reaperturaATexto(restaurante.cierreTemporal.hasta)} (hora de Colombia). No recibes pedidos nuevos; los ya confirmados siguen su curso.</Text>
        : <Text style={styles.hint}>No hay un cierre temporal activo.</Text>}
      <TextInput accessibilityLabel="Cuándo vuelve a abrir (AAAA-MM-DD HH:MM)" placeholder="AAAA-MM-DD HH:MM" value={reapertura.hasta} editable={editable} onChangeText={hasta => setReapertura(a => ({ ...a, hasta }))} style={[styles.input, !!errorCierre && styles.invalid]} />
      <TextInput accessibilityLabel="Motivo del cierre temporal (opcional)" placeholder="Motivo (opcional)" value={reapertura.motivo} editable={editable} onChangeText={motivo => setReapertura(a => ({ ...a, motivo }))} style={styles.input} />
      {!!errorCierre && <Text accessibilityRole="alert" style={styles.error}>{errorCierre}</Text>}
      {boton('Cerrar temporalmente', cerrarTemporalmente)}
      {!!restaurante.cierreTemporal && boton('Cancelar cierre temporal', () => { setErrorCierre(''); void guardar('restaurants/closure', { cierreTemporal: null }, 'Cierre temporal cancelado.'); }, true)}
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 24, paddingBottom: 56, gap: 14 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '700' },
  section: { color: colors.ink, fontSize: 21, fontWeight: '700', marginTop: 10 },
  status: { padding: 16, borderRadius: 16, backgroundColor: colors.accent, gap: 6 },
  statusTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  notice: { padding: 14, borderRadius: 14, backgroundColor: colors.accent },
  noticeError: { borderWidth: 1, borderColor: colors.primary },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24, flexShrink: 1 },
  field: { gap: 6 },
  label: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, minHeight: 52, padding: 12, color: colors.ink, fontSize: 16, backgroundColor: colors.surface },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  invalid: { borderColor: colors.primary, borderWidth: 2 },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  error: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  small: { minHeight: 48, minWidth: 64, justifyContent: 'center', alignItems: 'center' },
  link: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  button: { minHeight: 52, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 24 },
  secondary: { backgroundColor: colors.accent },
  buttonText: { color: colors.surface, fontSize: 17, fontWeight: '700' },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  dim: { opacity: 0.6 },
});
