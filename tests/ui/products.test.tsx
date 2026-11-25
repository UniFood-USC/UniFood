import { fireEvent, render, screen } from '@testing-library/react-native';
import ProductsScreen from '../../src/features/restaurant/ProductsScreen';
import { response } from '../../src/domain/response';
import type { ProductoPropio } from '../../src/domain/productManagement';

// RF-16 · Pantalla de gestión de productos del restaurante.
const url = (n: number) => `http://127.0.0.1:5001/demo-unifood/us-central1/api/photos/rest-burger/f${n}`;
const doble: ProductoPropio = { id: 'doble', nombre: 'Doble', descripcion: 'Dos carnes', precioCOP: 20000, disponible: true, fotos: [url(1)], version: 1 };
const papas: ProductoPropio = { id: 'papas', nombre: 'Papas', descripcion: 'Porción', precioCOP: 6000, disponible: false, fotos: [url(2)], version: 3 };
const imagen = (extra = {}) => ({ formato: 'image/png', bytes: 2000, datos: 'iVBORw0KGgo=', uri: 'data:image/png;base64,iVBORw0KGgo=', ...extra });

function servicio(productos: ProductoPropio[] = [doble, papas], resto: (accion: string, entrada: unknown) => unknown = () => undefined) {
  return jest.fn(async (accion: string, entrada: unknown) => {
    const propio = resto(accion, entrada);
    if (propio) return propio as ReturnType<typeof response>;
    if (accion === 'products/list') return response('OK', 'Productos consultados.', { productos });
    return response('OK', 'Hecho.', { producto: doble });
  });
}
const abrirFormulario = async () => { await fireEvent.press(await screen.findByRole('button', { name: 'Nuevo producto' })); };
const llenar = async (precio = '15000') => {
  await fireEvent.changeText(screen.getByLabelText('Nombre del producto'), 'Combo BBQ');
  await fireEvent.changeText(screen.getByLabelText('Descripción del producto'), 'Hamburguesa con papas.');
  await fireEvent.changeText(screen.getByLabelText('Precio del producto'), precio);
};

test('lista los productos propios con precio y estado, incluidos los agotados', async () => {
  await render(<ProductsScreen service={servicio()} pickImage={jest.fn()} />);
  expect(await screen.findByText('Doble')).toBeTruthy();
  expect(screen.getByText('$20.000')).toBeTruthy();
  expect(screen.getByLabelText('Estado: disponible')).toBeTruthy();
  expect(screen.getByLabelText('Estado: agotado')).toBeTruthy();
});

test('sin productos informa que el menú está vacío', async () => {
  await render(<ProductsScreen service={servicio([])} pickImage={jest.fn()} />);
  expect(await screen.findByText(/Todavía no tienes productos/)).toBeTruthy();
});

test('crear: con datos y una foto válida se guarda y el producto aparece en la lista', async () => {
  const service = servicio();
  const pickImage = jest.fn().mockResolvedValue(imagen());
  service.mockImplementation(async (accion: string) => accion === 'products/photo' ? response('OK', 'Foto subida.', { url: url(9) })
    : accion === 'products/list' ? response('OK', 'ok', { productos: [doble] }) : response('OK', 'Producto creado.', { producto: doble }));
  await render(<ProductsScreen service={service} pickImage={pickImage} />);
  await abrirFormulario();
  await llenar();
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar foto' }));
  expect(await screen.findByLabelText('Quitar foto 1')).toBeTruthy();
  expect(service).toHaveBeenCalledWith('products/photo', { formato: 'image/png', datos: 'iVBORw0KGgo=' });
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar producto' }));
  expect(await screen.findByText('Producto creado.')).toBeTruthy();
  expect(service).toHaveBeenCalledWith('products/save', { nombre: 'Combo BBQ', descripcion: 'Hamburguesa con papas.', precioCOP: 15000, disponible: true, fotos: [url(9)] });
});

test('sin fotos no se guarda: el error aparece en el campo y no se llama al servicio', async () => {
  const service = servicio();
  await render(<ProductsScreen service={service} pickImage={jest.fn()} />);
  await abrirFormulario();
  await llenar();
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar producto' }));
  expect(await screen.findByText('Agrega al menos 1 foto.')).toBeTruthy();
  expect(service).not.toHaveBeenCalledWith('products/save', expect.anything());
});

test('cada error de validación se asocia a su campo (precio, nombre y descripción)', async () => {
  const service = servicio();
  await render(<ProductsScreen service={service} pickImage={jest.fn()} />);
  await abrirFormulario();
  await fireEvent.changeText(screen.getByLabelText('Precio del producto'), '1500.5');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar producto' }));
  expect(await screen.findByText('El nombre es obligatorio.')).toBeTruthy();
  expect(screen.getByText('La descripción es obligatoria.')).toBeTruthy();
  expect(screen.getByText('El precio debe ser un número entero de pesos mayor que cero.')).toBeTruthy();
  expect(screen.getByText('0/100')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Nombre del producto'), 'a'.repeat(101));
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar producto' }));
  expect(await screen.findByText('El nombre admite hasta 100 caracteres.')).toBeTruthy();
});

test('un formato inválido muestra el error y no sube ni guarda nada', async () => {
  const service = servicio();
  await render(<ProductsScreen service={service} pickImage={jest.fn().mockResolvedValue(imagen({ formato: 'image/gif' }))} />);
  await abrirFormulario();
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar foto' }));
  expect(await screen.findByText('Las fotos deben ser JPG o PNG.')).toBeTruthy();
  expect(service).not.toHaveBeenCalledWith('products/photo', expect.anything());
});

test('una foto de más de 5 MB se rechaza', async () => {
  const service = servicio();
  await render(<ProductsScreen service={service} pickImage={jest.fn().mockResolvedValue(imagen({ bytes: 5 * 1024 * 1024 + 1 }))} />);
  await abrirFormulario();
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar foto' }));
  expect(await screen.findByText('Cada foto debe pesar 5 MB o menos.')).toBeTruthy();
});

test('de 1 a 5 fotos: la quinta se admite, la sexta no se puede agregar y quitar una actualiza la selección', async () => {
  let n = 0;
  const service = servicio([doble], accion => accion === 'products/photo' ? response('OK', 'Foto subida.', { url: url(++n + 20) }) : undefined);
  const pickImage = jest.fn().mockResolvedValue(imagen());
  await render(<ProductsScreen service={service} pickImage={pickImage} />);
  await abrirFormulario();
  for (let i = 1; i <= 5; i++) await fireEvent.press(screen.getByRole('button', { name: 'Agregar foto' })).then(() => screen.findByLabelText(`Quitar foto ${i}`));
  expect(screen.getByText(/Fotos \(5 de 5\)/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar foto' }));   // la sexta no se admite: ni siquiera se abre el selector
  expect(pickImage).toHaveBeenCalledTimes(5);
  await fireEvent.press(screen.getByLabelText('Quitar foto 5'));
  expect(screen.getByText(/Fotos \(4 de 5\)/)).toBeTruthy();
});

test('si el selector no está disponible (celular sin módulo) se informa sin romper la pantalla', async () => {
  const pickImage = jest.fn().mockRejectedValue(new Error('Adjuntar fotos desde el celular estará disponible pronto. Por ahora usa la versión web.'));
  await render(<ProductsScreen service={servicio()} pickImage={pickImage} />);
  await abrirFormulario();
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar foto' }));
  expect(await screen.findByText(/Por ahora usa la versión web/)).toBeTruthy();
});

test('editar: abre el producto con sus datos y envía id y versión', async () => {
  const service = servicio();
  await render(<ProductsScreen service={service} pickImage={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Editar Papas' }));
  expect(screen.getByDisplayValue('Papas')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Precio del producto'), '7000');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar producto' }));
  expect(await screen.findByText('Cambios guardados.')).toBeTruthy();
  expect(service).toHaveBeenCalledWith('products/save', { id: 'papas', version: 3, nombre: 'Papas', descripcion: 'Porción', precioCOP: 7000, disponible: false, fotos: [url(2)] });
});

test('los errores del servidor se muestran en su campo y no se pierde lo escrito', async () => {
  const service = servicio([doble], accion => accion === 'products/save' ? response('VALIDACION', 'Revisa los campos del producto.', { errores: { fotos: 'Solo puedes usar fotos subidas por tu restaurante.' } }) : undefined);
  await render(<ProductsScreen service={service} pickImage={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Editar Doble' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar producto' }));
  expect(await screen.findByText('Solo puedes usar fotos subidas por tu restaurante.')).toBeTruthy();
  expect(screen.getByDisplayValue('Doble')).toBeTruthy();
});

test('marcar agotado y disponible cambia solo la disponibilidad', async () => {
  const service = servicio();
  await render(<ProductsScreen service={service} pickImage={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Marcar Doble como agotado' }));
  expect(await screen.findByText('«Doble» quedó agotado.')).toBeTruthy();
  expect(service).toHaveBeenCalledWith('products/save', { id: 'doble', version: 1, nombre: 'Doble', descripcion: 'Dos carnes', precioCOP: 20000, disponible: false, fotos: [url(1)] });
  await fireEvent.press(screen.getByRole('button', { name: 'Marcar Papas como disponible' }));
  expect(await screen.findByText('«Papas» quedó disponible.')).toBeTruthy();
});

test('retirar pide confirmación y no llama al servicio hasta confirmar', async () => {
  const service = servicio();
  await render(<ProductsScreen service={service} pickImage={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Retirar Doble del menú' }));
  expect(service).not.toHaveBeenCalledWith('products/remove', expect.anything());
  await fireEvent.press(screen.getByRole('button', { name: 'Cancelar retiro' }));
  expect(screen.getByRole('button', { name: 'Editar Doble' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Retirar Doble del menú' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar retiro de Doble' }));
  expect(await screen.findByText('«Doble» se retiró de tu menú.')).toBeTruthy();
  expect(service).toHaveBeenCalledWith('products/remove', { id: 'doble', version: 1 });
});

test('una desconexión al guardar no afirma que se guardó y vuelve a consultar el menú', async () => {
  const service = servicio([doble], accion => { if (accion === 'products/save') throw new Error('offline'); return undefined; });
  await render(<ProductsScreen service={service} pickImage={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Editar Doble' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar producto' }));
  expect(await screen.findByText(/No pudimos confirmar el cambio por la conexión/)).toBeTruthy();
  expect(screen.queryByText('Cambios guardados.')).toBeNull();
  expect(service.mock.calls.filter(([accion]) => accion === 'products/list').length).toBeGreaterThanOrEqual(2);
});

test('un conflicto de versión avisa y recarga el producto vigente', async () => {
  const service = servicio([doble], accion => accion === 'products/save' ? response('CONFLICTO_VERSION', 'Este producto cambió en otro dispositivo. Revisa los datos actuales.', { producto: doble }) : undefined);
  await render(<ProductsScreen service={service} pickImage={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Editar Doble' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar producto' }));
  expect(await screen.findByText(/cambió en otro dispositivo/)).toBeTruthy();
});

test('un error al cargar permite reintentar', async () => {
  const service = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response('OK', 'ok', { productos: [doble] }));
  await render(<ProductsScreen service={service} pickImage={jest.fn()} />);
  expect(await screen.findByText(/No pudimos consultar tus productos/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Doble')).toBeTruthy();
});
