import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feedback } from '../../components/Feedback';
import { colors } from '../../constants/theme';
import { formatCOP } from '../../domain/menu';
import {
  DESCRIPCION_MAX, errorArchivoFoto, FOTOS_MAX, NOMBRE_MAX, validarProducto, type ErroresProducto, type ProductoPropio,
} from '../../domain/productManagement';
import { ProductImage } from '../student/menu/ProductImage';
import { pickImage as pickImageDefault, type ImagenElegida } from './pickImage';
import type { ProductService } from './productService';

// RF-16 · Gestión de productos del restaurante: lista de su menú, crear, editar, marcar agotado/disponible y retirar.
// Las reglas viven en el dominio y en el servicio; esta pantalla solo las muestra y asocia cada error a su campo.
type Aviso = { tipo: 'ok' | 'error'; texto: string } | null;
type Modo = { tipo: 'lista' } | { tipo: 'formulario'; producto: ProductoPropio | null; errores?: ErroresProducto };

export default function ProductsScreen({ service, pickImage = pickImageDefault }: { service: ProductService; pickImage?: () => Promise<ImagenElegida | null> }) {
  const [productos, setProductos] = useState<ProductoPropio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [aviso, setAviso] = useState<Aviso>(null);
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' });
  const [retirando, setRetirando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const mounted = useRef(true);

  const cargar = useCallback(() => service('products/list', {}).then(result => {
    if (!mounted.current) return;
    if (result.codigo === 'OK') { setProductos((result.datos as { productos: ProductoPropio[] }).productos); setErrorCarga(''); }
    else setErrorCarga(result.mensaje);
  }).catch(() => {
    if (mounted.current) setErrorCarga('No pudimos consultar tus productos. Revisa la conexión y reintenta.');
  }).finally(() => { if (mounted.current) setCargando(false); }), [service]);

  useEffect(() => { mounted.current = true; void cargar(); return () => { mounted.current = false; }; }, [cargar]);

  const reintentar = () => { setCargando(true); setErrorCarga(''); void cargar(); };

  // Una desconexión no demuestra que el cambio falló: se dice así y se vuelve a consultar el menú real.
  const sinConfirmar = () => {
    setAviso({ tipo: 'error', texto: 'No pudimos confirmar el cambio por la conexión. Revisa tu menú antes de repetirlo.' });
    void cargar();
  };

  const cambiarEstado = async (producto: ProductoPropio) => {
    setOcupado(producto.id); setAviso(null);
    try {
      const result = await service('products/save', {
        id: producto.id, version: producto.version, nombre: producto.nombre, descripcion: producto.descripcion,
        precioCOP: producto.precioCOP, disponible: !producto.disponible, fotos: producto.fotos,
      });
      if (!mounted.current) return;
      if (result.codigo === 'OK') {
        setAviso({ tipo: 'ok', texto: producto.disponible ? `«${producto.nombre}» quedó agotado.` : `«${producto.nombre}» quedó disponible.` });
        await cargar();
      } else if (result.codigo === 'VALIDACION') {
        // Producto con datos incompletos (p. ej. sin descripción o foto): se abre para completarlo.
        const errores = (result.datos as { errores?: ErroresProducto } | null)?.errores;
        setAviso({ tipo: 'error', texto: 'Completa los datos del producto para cambiar su estado.' });
        setModo({ tipo: 'formulario', producto, errores });
      } else {
        setAviso({ tipo: 'error', texto: result.mensaje });
        if (result.codigo === 'CONFLICTO_VERSION') await cargar();
      }
    } catch { if (mounted.current) sinConfirmar(); }
    finally { if (mounted.current) setOcupado(null); }
  };

  const retirar = async (producto: ProductoPropio) => {
    setOcupado(producto.id); setAviso(null); setRetirando(null);
    try {
      const result = await service('products/remove', { id: producto.id, version: producto.version });
      if (!mounted.current) return;
      if (result.codigo === 'OK') { setAviso({ tipo: 'ok', texto: `«${producto.nombre}» se retiró de tu menú.` }); await cargar(); }
      else { setAviso({ tipo: 'error', texto: result.mensaje }); if (result.codigo === 'CONFLICTO_VERSION') await cargar(); }
    } catch { if (mounted.current) sinConfirmar(); }
    finally { if (mounted.current) setOcupado(null); }
  };

  if (modo.tipo === 'formulario') {
    return <ProductForm
      key={modo.producto?.id ?? 'nuevo'} service={service} pickImage={pickImage} producto={modo.producto} erroresIniciales={modo.errores}
      onCancel={() => setModo({ tipo: 'lista' })}
      onSaved={(texto) => { setModo({ tipo: 'lista' }); setAviso({ tipo: 'ok', texto }); void cargar(); }}
      onConflict={(texto) => { setModo({ tipo: 'lista' }); setAviso({ tipo: 'error', texto }); void cargar(); }}
      onUnconfirmed={() => { setModo({ tipo: 'lista' }); sinConfirmar(); }}
    />;
  }

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>Mis productos</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Nuevo producto" onPress={() => { setAviso(null); setModo({ tipo: 'formulario', producto: null }); }} style={styles.primary}>
        <Text style={styles.primaryText}>+ Nuevo producto</Text>
      </Pressable>
    </View>
    {aviso && <Text accessibilityRole={aviso.tipo === 'error' ? 'alert' : 'text'} accessibilityLiveRegion="polite" style={[styles.aviso, aviso.tipo === 'error' && styles.avisoError]}>{aviso.texto}</Text>}
    {cargando ? <Feedback state="loading" message="Cargando tus productos…" />
      : errorCarga ? <Feedback state="error" message={errorCarga} onRetry={reintentar} />
      : productos.length === 0 ? <Feedback state="empty" message="Todavía no tienes productos en tu menú. Crea el primero con «Nuevo producto»." />
      : productos.map(producto => <View key={producto.id} style={styles.card}>
        <View style={styles.row}>
          <ProductImage uri={producto.fotos[0]} name={producto.nombre} style={styles.thumb} />
          <View style={styles.info}>
            <Text style={styles.name}>{producto.nombre}</Text>
            <Text style={styles.price}>{formatCOP(producto.precioCOP)}</Text>
            <Text accessibilityLabel={producto.disponible ? 'Estado: disponible' : 'Estado: agotado'} style={[styles.chip, !producto.disponible && styles.chipOut]}>{producto.disponible ? 'Disponible' : 'Agotado'}</Text>
          </View>
        </View>
        {retirando === producto.id
          ? <View style={styles.actions}>
            <Text style={styles.confirmText}>¿Retirar «{producto.nombre}» del menú? Los pedidos ya confirmados conservan sus datos.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Confirmar retiro de ${producto.nombre}`} onPress={() => void retirar(producto)} style={styles.danger}><Text style={styles.dangerText}>Sí, retirar</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancelar retiro" onPress={() => setRetirando(null)} style={styles.secondary}><Text style={styles.secondaryText}>Cancelar</Text></Pressable>
          </View>
          : <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${producto.nombre}`} disabled={ocupado === producto.id} onPress={() => { setAviso(null); setModo({ tipo: 'formulario', producto }); }} style={styles.secondary}><Text style={styles.secondaryText}>Editar</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={producto.disponible ? `Marcar ${producto.nombre} como agotado` : `Marcar ${producto.nombre} como disponible`} disabled={ocupado === producto.id} onPress={() => void cambiarEstado(producto)} style={styles.secondary}>
              <Text style={styles.secondaryText}>{producto.disponible ? 'Marcar agotado' : 'Marcar disponible'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Retirar ${producto.nombre} del menú`} disabled={ocupado === producto.id} onPress={() => setRetirando(producto.id)} style={styles.secondary}><Text style={styles.dangerLink}>Retirar</Text></Pressable>
          </View>}
      </View>)}
  </ScrollView>;
}

function ProductForm({ service, pickImage, producto, erroresIniciales, onCancel, onSaved, onConflict, onUnconfirmed }: {
  service: ProductService; pickImage: () => Promise<ImagenElegida | null>; producto: ProductoPropio | null; erroresIniciales?: ErroresProducto;
  onCancel: () => void; onSaved: (texto: string) => void; onConflict: (texto: string) => void; onUnconfirmed: () => void;
}) {
  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '');
  const [precio, setPrecio] = useState(producto ? String(producto.precioCOP) : '');
  const [disponible, setDisponible] = useState(producto?.disponible ?? true);
  const [fotos, setFotos] = useState<string[]>(producto?.fotos ?? []);
  const [errores, setErrores] = useState<ErroresProducto>(erroresIniciales ?? {});
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const agregarFoto = async () => {
    setErrores(previo => ({ ...previo, fotos: undefined }));
    if (fotos.length >= FOTOS_MAX) { setErrores(previo => ({ ...previo, fotos: `Un producto admite hasta ${FOTOS_MAX} fotos.` })); return; }
    let imagen: ImagenElegida | null;
    try { imagen = await pickImage(); }
    catch (error) { setErrores(previo => ({ ...previo, fotos: (error as Error).message })); return; }
    if (!imagen) return;
    // Un formato o tamaño inválido se rechaza aquí: no se sube nada ni se guarda el producto.
    const problema = errorArchivoFoto(imagen.formato, imagen.bytes);
    if (problema) { setErrores(previo => ({ ...previo, fotos: problema })); return; }
    setSubiendo(true);
    try {
      const result = await service('products/photo', { formato: imagen.formato, datos: imagen.datos });
      if (!mounted.current) return;
      if (result.codigo === 'OK') setFotos(previo => [...previo, (result.datos as { url: string }).url]);
      else setErrores(previo => ({ ...previo, fotos: result.mensaje }));
    } catch { if (mounted.current) setErrores(previo => ({ ...previo, fotos: 'No pudimos subir la foto. Revisa la conexión e inténtalo de nuevo.' })); }
    finally { if (mounted.current) setSubiendo(false); }
  };

  const quitarFoto = (url: string) => { setFotos(previo => previo.filter(foto => foto !== url)); setErrores(previo => ({ ...previo, fotos: undefined })); };

  const guardar = async () => {
    const texto = precio.trim();
    const entrada = { nombre, descripcion, precioCOP: /^\d+$/.test(texto) ? Number(texto) : Number.NaN, disponible, fotos };
    const revision = validarProducto(entrada);
    if (!revision.ok) { setErrores(revision.errores); return; }   // cero fotos o un dato inválido bloquea guardar
    setErrores({}); setGuardando(true);
    try {
      const result = await service('products/save', { ...(producto ? { id: producto.id, version: producto.version } : {}), ...revision.valor });
      if (!mounted.current) return;
      if (result.codigo === 'OK') onSaved(producto ? 'Cambios guardados.' : 'Producto creado.');
      else if (result.codigo === 'CONFLICTO_VERSION') onConflict(result.mensaje);
      else setErrores((result.datos as { errores?: ErroresProducto } | null)?.errores ?? { general: result.mensaje });
    } catch { if (mounted.current) onUnconfirmed(); }
    finally { if (mounted.current) setGuardando(false); }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text accessibilityRole="header" style={styles.title}>{producto ? 'Editar producto' : 'Nuevo producto'}</Text>
    {errores.general && <Text accessibilityRole="alert" style={styles.error}>{errores.general}</Text>}

    <Text style={styles.label}>Nombre</Text>
    <TextInput accessibilityLabel="Nombre del producto" value={nombre} onChangeText={setNombre} style={[styles.input, errores.nombre && styles.inputError]} />
    <Text style={styles.counter}>{Array.from(nombre).length}/{NOMBRE_MAX}</Text>
    {errores.nombre && <Text accessibilityRole="alert" style={styles.error}>{errores.nombre}</Text>}

    <Text style={styles.label}>Descripción</Text>
    <TextInput accessibilityLabel="Descripción del producto" value={descripcion} onChangeText={setDescripcion} multiline style={[styles.input, styles.multiline, errores.descripcion && styles.inputError]} />
    <Text style={styles.counter}>{Array.from(descripcion).length}/{DESCRIPCION_MAX}</Text>
    {errores.descripcion && <Text accessibilityRole="alert" style={styles.error}>{errores.descripcion}</Text>}

    <Text style={styles.label}>Precio en pesos colombianos (COP)</Text>
    <TextInput accessibilityLabel="Precio del producto" value={precio} onChangeText={setPrecio} keyboardType="number-pad" placeholder="Ej. 15000" style={[styles.input, errores.precioCOP && styles.inputError]} />
    {errores.precioCOP && <Text accessibilityRole="alert" style={styles.error}>{errores.precioCOP}</Text>}

    <Text style={styles.label}>Disponibilidad</Text>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: disponible }} accessibilityLabel="Disponible" onPress={() => setDisponible(true)} style={[styles.choice, disponible && styles.choiceOn]}><Text style={[styles.choiceText, disponible && styles.choiceTextOn]}>Disponible</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: !disponible }} accessibilityLabel="Agotado" onPress={() => setDisponible(false)} style={[styles.choice, !disponible && styles.choiceOn]}><Text style={[styles.choiceText, !disponible && styles.choiceTextOn]}>Agotado</Text></Pressable>
    </View>
    {errores.disponible && <Text accessibilityRole="alert" style={styles.error}>{errores.disponible}</Text>}

    <Text style={styles.label}>Fotos ({fotos.length} de {FOTOS_MAX}) · JPG o PNG de hasta 5 MB</Text>
    <View style={styles.photos}>
      {fotos.map((url, indice) => <View key={url} style={styles.photo}>
        <ProductImage uri={url} name={nombre || 'P'} style={styles.thumb} label={`Foto ${indice + 1}`} />
        <Pressable accessibilityRole="button" accessibilityLabel={`Quitar foto ${indice + 1}`} onPress={() => quitarFoto(url)} style={styles.secondary}><Text style={styles.dangerLink}>Quitar</Text></Pressable>
      </View>)}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Agregar foto" disabled={subiendo || fotos.length >= FOTOS_MAX} onPress={() => void agregarFoto()} style={[styles.secondary, (subiendo || fotos.length >= FOTOS_MAX) && styles.disabled]}>
      <Text style={styles.secondaryText}>{subiendo ? 'Subiendo foto…' : 'Agregar foto'}</Text>
    </Pressable>
    {errores.fotos && <Text accessibilityRole="alert" style={styles.error}>{errores.fotos}</Text>}

    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Guardar producto" disabled={guardando || subiendo} onPress={() => void guardar()} style={[styles.primary, (guardando || subiendo) && styles.disabled]}>
        <Text style={styles.primaryText}>{guardando ? 'Guardando…' : 'Guardar'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancelar" disabled={guardando} onPress={onCancel} style={styles.secondary}><Text style={styles.secondaryText}>Cancelar</Text></Pressable>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 12, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  aviso: { padding: 12, borderRadius: 12, backgroundColor: colors.accent, color: colors.ink, fontSize: 15, lineHeight: 22 },
  avisoError: { borderWidth: 1, borderColor: colors.primary },
  card: { padding: 14, gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 17, fontWeight: '700', color: colors.ink },
  price: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.accent, color: colors.ink, fontSize: 13, fontWeight: '600' },
  chipOut: { backgroundColor: colors.ink, color: colors.surface },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  primary: { minHeight: 48, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: colors.primary },
  primaryText: { color: colors.surface, fontWeight: '700', fontSize: 15 },
  secondary: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  secondaryText: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  danger: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: colors.primary },
  dangerText: { color: colors.surface, fontWeight: '700', fontSize: 14 },
  dangerLink: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  confirmText: { flexBasis: '100%', color: colors.ink, fontSize: 14, lineHeight: 20 },
  label: { marginTop: 8, color: colors.ink, fontSize: 15, fontWeight: '600' },
  input: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, color: colors.ink, fontSize: 16 },
  inputError: { borderColor: colors.primary, borderWidth: 2 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', color: colors.muted, fontSize: 12 },
  error: { color: colors.primary, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  choice: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  choiceOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  choiceText: { color: colors.ink, fontWeight: '600' },
  choiceTextOn: { color: colors.surface },
  photos: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  photo: { gap: 6, alignItems: 'center' },
  disabled: { opacity: 0.5 },
});
