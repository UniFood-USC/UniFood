import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feedback } from '../../components/Feedback';
import { colors } from '../../constants/theme';
import { ETIQUETA_CONDICION, ETIQUETA_ESTADO, MOTIVO_OBLIGATORIO, validarInformacion, validarRechazo, reaperturaATexto, type AccionAdmin, type ErroresRestaurante, type RestauranteGestion } from '../../domain/restaurantManagement';
import { ETIQUETA_DIA, DIAS } from '../../domain/restaurants';
import type { ServiceResponse } from '../../domain/response';

// RF-22 · Gestión de restaurantes para la administración: consulta, edición de información, revisión de pendientes
// (aprobar o rechazar con motivo), suspensión, reactivación y eliminación. Las reglas viven en el servicio.
type Action = 'restaurants/admin-list' | 'restaurants/admin-update' | 'restaurants/review' | 'restaurants/state';
export type RestaurantsAdminService = (action: Action, input: unknown) => Promise<ServiceResponse>;
type Confirmacion = { accion: 'suspender' | 'reactivar' | 'eliminar' } | { accion: 'rechazar' } | null;
const ETIQUETA_ACCION: Record<AccionAdmin, string> = { aprobar: 'Aprobar', rechazar: 'Rechazar', suspender: 'Suspender', reactivar: 'Reactivar', eliminar: 'Eliminar' };
const AVISO: Record<string, string> = {
  suspender: 'El restaurante dejará de recibir pedidos, se cancelarán sus pedidos activos y se reembolsarán los pagados.',
  eliminar: 'Se cancelarán sus pedidos activos y se reembolsarán los pagados. Se conservan sus pedidos y movimientos anteriores. No se puede deshacer.',
  reactivar: 'Volverá a operar conforme a su horario.',
};

export default function RestaurantsAdminScreen({ service }: { service: RestaurantsAdminService }) {
  const [lista, setLista] = useState<RestauranteGestion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState('');
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState<Confirmacion>(null);
  const [motivo, setMotivo] = useState('');
  const [editando, setEditando] = useState(false);
  const [info, setInfo] = useState({ nombre: '', descripcion: '', ubicacion: '', telefono: '', logo: '' });
  const [errores, setErrores] = useState<ErroresRestaurante>({});
  const mounted = useRef(true);
  const enviando = useRef(false);

  const cargar = useCallback(() => service('restaurants/admin-list', {}).then(result => {
    if (!mounted.current) return;
    if (result.codigo === 'OK') { setLista((result.datos as { restaurantes: RestauranteGestion[] }).restaurantes); setErrorLista(''); } else setErrorLista(result.mensaje);
  }).catch(() => { if (mounted.current) setErrorLista('No pudimos consultar los restaurantes. Revisa la conexión y reintenta.'); })
    .finally(() => { if (mounted.current) setCargando(false); }), [service]);
  useEffect(() => { mounted.current = true; void cargar(); return () => { mounted.current = false; }; }, [cargar]);
  const refrescar = () => { setCargando(true); setErrorLista(''); void cargar(); };

  const actual = lista.find(r => r.id === seleccion) ?? null;
  function abrir(r: RestauranteGestion) {
    setSeleccion(r.id); setMensaje(''); setConfirmando(null); setMotivo(''); setEditando(false); setErrores({});
    setInfo({ nombre: r.nombre, descripcion: r.descripcion, ubicacion: r.ubicacion, telefono: r.telefono, logo: r.logo ?? '' });
  }

  async function enviar(action: Action, cuerpo: Record<string, unknown>, alOk?: () => void) {
    if (!actual || enviando.current) return;
    enviando.current = true; setOcupado(true); setMensaje('');
    try {
      const result = await service(action, { id: actual.id, version: actual.version, ...cuerpo });
      if (!mounted.current) return;
      setMensaje(result.mensaje);
      const detalle = (result.datos as { errores?: ErroresRestaurante } | null)?.errores;
      if (detalle) setErrores(detalle);
      if (result.codigo === 'OK') { alOk?.(); await cargar(); } else if (result.codigo === 'CONFLICTO_VERSION' || result.codigo === 'EN_PROCESO') await cargar();
    } catch { if (mounted.current) { setMensaje('Sin conexión: no se confirmó el cambio. Revisa el detalle y reintenta.'); void cargar(); } }
    finally { enviando.current = false; setConfirmando(null); if (mounted.current) setOcupado(false); }
  }

  const guardarCambios = () => {
    const v = validarInformacion({ ...info, logo: info.logo.trim() });
    if (!v.ok) { setErrores(v.errores); setMensaje('Revisa los campos marcados.'); return; }
    setErrores({}); void enviar('restaurants/admin-update', { ...v.info }, () => setEditando(false));
  };
  const rechazar = () => {
    const v = validarRechazo(motivo);
    if (!v.ok) { setMensaje(MOTIVO_OBLIGATORIO); return; }
    void enviar('restaurants/review', { decision: 'rechazar', motivo: v.motivo }, () => setMotivo(''));
  };
  const boton = (etiqueta: string, onPress: () => void, secundario = false) => <Pressable accessibilityRole="button" accessibilityLabel={etiqueta} accessibilityState={{ disabled: ocupado }}
    disabled={ocupado} onPress={onPress} style={[styles.button, secundario && styles.secondary, ocupado && styles.dim]}><Text style={secundario ? styles.secondaryText : styles.buttonText}>{etiqueta}</Text></Pressable>;

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>{actual ? actual.nombre : 'Restaurantes'}</Text>
        {!!mensaje && <View accessibilityLiveRegion="polite" style={styles.notice}><Text style={styles.body}>{mensaje}</Text></View>}
        {!actual ? <>
          {cargando ? <Feedback state="loading" message="Consultando restaurantes…" /> : errorLista ? <Feedback state="error" message={errorLista} onRetry={refrescar} /> : <>
            {boton('Actualizar listado', refrescar, true)}
            {!lista.length && <Feedback state="empty" message="Todavía no hay restaurantes registrados." />}
            {lista.map(r => <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`${r.nombre}, ${ETIQUETA_ESTADO[r.estado]}. Ver detalle`} onPress={() => abrir(r)} style={styles.card}>
              <Text style={styles.name}>{r.nombre}</Text>
              <Text style={styles.subtitle}>{ETIQUETA_ESTADO[r.estado]}{r.estado === 'aprobado' ? ` · ${ETIQUETA_CONDICION[r.condicion]}` : ''}</Text>
              {!!r.ubicacion && <Text style={styles.body}>{r.ubicacion}</Text>}
            </Pressable>)}
          </>}
        </> : <>
          <View style={styles.card}>
            <Text style={styles.name}>Estado: {ETIQUETA_ESTADO[actual.estado]}</Text>
            {actual.estado === 'aprobado' && <Text style={styles.body}>{ETIQUETA_CONDICION[actual.condicion]}{actual.proximaApertura ? ` · Abre: ${actual.proximaApertura}` : ''}</Text>}
            {actual.estado === 'rechazado' && <Text style={styles.body}>Motivo del rechazo: {actual.motivoRechazo}</Text>}
            {!!actual.cierreTemporal && <Text style={styles.body}>Cierre temporal hasta {reaperturaATexto(actual.cierreTemporal.hasta)}</Text>}
          </View>
          {editando ? <View style={styles.card}>
            {(['nombre', 'descripcion', 'ubicacion', 'telefono', 'logo'] as const).map(clave => <View key={clave} style={styles.field}>
              <Text style={styles.label}>{{ nombre: 'Nombre del restaurante', descripcion: 'Descripción', ubicacion: 'Ubicación dentro del campus', telefono: 'Teléfono', logo: 'Logo (enlace https)' }[clave]}</Text>
              <TextInput accessibilityLabel={{ nombre: 'Nombre del restaurante', descripcion: 'Descripción', ubicacion: 'Ubicación dentro del campus', telefono: 'Teléfono', logo: 'Logo (enlace https)' }[clave]}
                value={info[clave]} editable={!ocupado} multiline={clave === 'descripcion'} onChangeText={valor => setInfo(a => ({ ...a, [clave]: valor }))} style={[styles.input, clave === 'descripcion' && styles.multiline, !!errores[clave] && styles.invalid]} />
              {!!errores[clave] && <Text accessibilityRole="alert" style={styles.error}>{errores[clave]}</Text>}
            </View>)}
            {boton('Guardar cambios', guardarCambios)}
            {boton('Cancelar edición', () => { setEditando(false); setErrores({}); }, true)}
          </View> : <View style={styles.card}>
            <Text style={styles.body}>Descripción: {actual.descripcion || 'Sin descripción'}</Text>
            <Text style={styles.body}>Ubicación: {actual.ubicacion || 'Sin ubicación'}</Text>
            <Text style={styles.body}>Teléfono: {actual.telefono || 'Sin teléfono'}</Text>
            <Text style={styles.body}>Correo: {actual.correo || 'Sin correo'}</Text>
            <Text style={styles.label}>Horario</Text>
            {DIAS.map(d => actual.horario[d]).some(Boolean)
              ? (['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const).map(d => <Text key={d} style={styles.body}>{ETIQUETA_DIA[d]}: {actual.horario[d] ? `${actual.horario[d]!.abre} a ${actual.horario[d]!.cierra}` : 'Cerrado'}</Text>)
              : <Text style={styles.body}>Sin horario definido.</Text>}
            {!!actual.cierresEspeciales.length && <Text style={styles.body}>Cierres especiales: {actual.cierresEspeciales.map(c => c.fecha).join(', ')}</Text>}
            {actual.estado !== 'eliminado' && boton('Editar información', () => setEditando(true), true)}
          </View>}
          {!editando && actual.acciones.length > 0 && <View style={styles.card}>
            {confirmando ? <View accessibilityLiveRegion="polite" style={styles.confirm}>
              {confirmando.accion === 'rechazar' ? <>
                <Text style={styles.body}>Escribe el motivo del rechazo. El propietario lo verá para corregir su registro.</Text>
                <TextInput accessibilityLabel="Motivo del rechazo" value={motivo} onChangeText={setMotivo} multiline editable={!ocupado} style={[styles.input, styles.multiline]} />
                {boton('Confirmar rechazo', rechazar)}
              </> : <>
                <Text style={styles.body}>¿{ETIQUETA_ACCION[confirmando.accion]} {actual.nombre}? {AVISO[confirmando.accion]}</Text>
                {confirmando.accion === 'suspender' && <TextInput accessibilityLabel="Motivo de la suspensión (opcional)" placeholder="Motivo (opcional)" value={motivo} onChangeText={setMotivo} editable={!ocupado} style={styles.input} />}
                {boton(`Confirmar: ${ETIQUETA_ACCION[confirmando.accion].toLowerCase()}`, () => void enviar('restaurants/state', { accion: confirmando.accion, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) }))}
              </>}
              {boton('Cancelar', () => { setConfirmando(null); setMotivo(''); }, true)}
            </View> : actual.acciones.map(accion => accion === 'aprobar'
              ? <View key={accion}>{boton('Aprobar restaurante', () => void enviar('restaurants/review', { decision: 'aprobar' }))}</View>
              : <View key={accion}>{boton(`${ETIQUETA_ACCION[accion]} restaurante`, () => { setMotivo(''); setConfirmando({ accion } as Confirmacion); }, accion !== 'rechazar')}</View>)}
          </View>}
          {boton('Volver al listado', () => { setSeleccion(null); setEditando(false); setConfirmando(null); setMensaje(''); refrescar(); }, true)}
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 24, paddingBottom: 56, gap: 14 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  name: { color: colors.ink, fontSize: 19, fontWeight: '700' },
  label: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  field: { gap: 6 },
  card: { padding: 18, gap: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  notice: { padding: 16, backgroundColor: colors.accent, borderRadius: 16 },
  confirm: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.accent },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, minHeight: 52, padding: 12, color: colors.ink, fontSize: 16, backgroundColor: colors.surface },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  invalid: { borderColor: colors.primary, borderWidth: 2 },
  error: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  button: { minHeight: 52, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 24 },
  secondary: { backgroundColor: colors.accent },
  buttonText: { color: colors.surface, fontSize: 17, fontWeight: '700' },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  dim: { opacity: 0.6 },
});
