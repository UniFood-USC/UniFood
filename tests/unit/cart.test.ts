import { addProduct, cartTotals, emptyCart, formatCOP, lineAmounts, resolveCart, setQuantity, storedCart, validateCartSave, validateStoredCart, type Product } from '../../src/domain/cart';

const burger: Product = { id: 'doble', restaurantId: 'rest-burger', name: 'Doble', priceCOP: 20000, discountPercent: 0 };
const fries: Product = { id: 'papas', restaurantId: 'rest-burger', name: 'Papas', priceCOP: 6000, discountPercent: 0 };
const pizza: Product = { id: 'pizza', restaurantId: 'rest-pizza', name: 'Pizza', priceCOP: 18000, discountPercent: 0 };
const line = (priceCOP: number, quantity: number, discountPercent = 0) => ({ productId: 'p', name: 'P', priceCOP, quantity, discountPercent });

test('cantidades enteras de 1 a 20 se guardan y cero elimina', () => {
  let cart = addProduct(emptyCart, burger).cart;
  cart = addProduct(cart, fries, 2).cart;
  expect(cart.lines.map(l => [l.productId, l.quantity])).toEqual([['doble', 1], ['papas', 2]]);
  cart = setQuantity(cart, 'doble', 20);
  expect(cart.lines[0].quantity).toBe(20);
  cart = setQuantity(cart, 'doble', 0);
  expect(cart.lines.map(l => l.productId)).toEqual(['papas']);
  expect(setQuantity(cart, 'papas', 0)).toEqual(emptyCart);
});

test.each([-1, 21, 1.5, Number.NaN])('la cantidad %p se rechaza sin cambiar el carrito', quantity => {
  const cart = addProduct(emptyCart, burger).cart;
  expect(() => setQuantity(cart, 'doble', quantity)).toThrow('La cantidad debe ser un número entero de 1 a 20, o 0 para eliminar el producto.');
  expect(cart.lines[0].quantity).toBe(1);
});

test('agregar el mismo producto suma cantidades sin pasar de 20', () => {
  const cart = addProduct(addProduct(emptyCart, burger, 15).cart, burger, 5).cart;
  expect(cart.lines).toHaveLength(1);
  expect(cart.lines[0].quantity).toBe(20);
  expect(() => addProduct(cart, burger)).toThrow('La cantidad debe ser un número entero de 1 a 20');
});

test('un producto de otro restaurante pide confirmación; rechazar conserva y aceptar empieza de nuevo', () => {
  const original = addProduct(emptyCart, burger).cart;
  const asked = addProduct(original, pizza);
  expect(asked.requiresConfirmation).toBe(true);
  expect(asked.cart).toBe(original);
  const replaced = addProduct(original, pizza, 1, true);
  expect(replaced.requiresConfirmation).toBe(false);
  expect(replaced.cart).toEqual({ restaurantId: 'rest-pizza', lines: [expect.objectContaining({ productId: 'pizza', quantity: 1 })] });
});

test('el descuento se redondea una sola vez por línea, con medio peso hacia arriba', () => {
  expect(lineAmounts(line(101, 2, 50))).toEqual({ grossCOP: 202, discountCOP: 101, netCOP: 101 });
  expect(lineAmounts(line(101, 1, 50))).toEqual({ grossCOP: 101, discountCOP: 50, netCOP: 51 });
  expect(lineAmounts(line(12500, 2, 15)).netCOP).toBe(21250);
});

test('el total suma la tarifa de domicilio sin descuento y un total cero no pide pago', () => {
  const totals = cartTotals([line(25000, 1, 15)], 2000);
  expect(totals).toEqual({ grossCOP: 25000, discountCOP: 3750, productsCOP: 21250, deliveryFeeCOP: 2000, totalCOP: 23250, requiresPayment: true });
  expect(cartTotals([line(20000, 1), line(6000, 1)]).totalCOP).toBe(26000);
  expect(cartTotals([]).requiresPayment).toBe(false);
});

test.each([[0, 10], [100, 4], [1000, 95], [1000, 3]])('precio %p o descuento %p fuera de rango se rechazan', (price, percent) => {
  expect(() => lineAmounts(line(price, 1, percent))).toThrow();
});

test('los importes se muestran en pesos colombianos enteros', () => {
  expect(formatCOP(23250)).toBe('$23.250');
  expect(formatCOP(0)).toBe('$0');
});

test('el carrito guardado solo conserva restaurante, producto y cantidad', () => {
  const cart = addProduct(addProduct(emptyCart, burger).cart, fries, 3).cart;
  expect(storedCart(cart)).toEqual({ restaurantId: 'rest-burger', lines: [{ productId: 'doble', quantity: 1 }, { productId: 'papas', quantity: 3 }] });
  expect(storedCart(emptyCart)).toEqual({ restaurantId: null, lines: [] });
});

test('al recuperarlo se completan nombre y precio desde los productos y se omiten los que ya no existen', () => {
  const stored = { restaurantId: 'rest-burger', lines: [{ productId: 'papas', quantity: 2 }, { productId: 'retirado', quantity: 1 }] };
  expect(resolveCart(stored, [burger, fries])).toEqual({ restaurantId: 'rest-burger', lines: [{ productId: 'papas', name: 'Papas', priceCOP: 6000, quantity: 2, discountPercent: 0 }] });
  expect(resolveCart({ restaurantId: 'rest-burger', lines: [{ productId: 'retirado', quantity: 1 }] }, [burger])).toEqual(emptyCart);
});

test('un carrito válido para guardar pasa la validación sin cambios', () => {
  const valid = { restaurantId: 'rest-burger', lines: [{ productId: 'doble', quantity: 20 }, { productId: 'papas', quantity: 1 }] };
  expect(validateStoredCart(valid)).toEqual(valid);
  expect(validateStoredCart({ restaurantId: null, lines: [] })).toEqual({ restaurantId: null, lines: [] });
});

test.each([
  ['cantidad 21', { restaurantId: 'r', lines: [{ productId: 'p', quantity: 21 }] }],
  ['cantidad fraccionaria', { restaurantId: 'r', lines: [{ productId: 'p', quantity: 1.5 }] }],
  ['cantidad negativa', { restaurantId: 'r', lines: [{ productId: 'p', quantity: -1 }] }],
  ['cantidad cero guardada', { restaurantId: 'r', lines: [{ productId: 'p', quantity: 0 }] }],
  ['producto repetido', { restaurantId: 'r', lines: [{ productId: 'p', quantity: 1 }, { productId: 'p', quantity: 2 }] }],
  ['precio enviado por la app', { restaurantId: 'r', lines: [{ productId: 'p', quantity: 1, priceCOP: 1 }] }],
  ['campo ajeno', { restaurantId: 'r', lines: [], userId: 'otro' }],
  ['líneas sin restaurante', { restaurantId: null, lines: [{ productId: 'p', quantity: 1 }] }],
  ['restaurante sin líneas', { restaurantId: 'r', lines: [] }],
  ['producto vacío', { restaurantId: 'r', lines: [{ productId: '', quantity: 1 }] }],
  ['sin datos', null],
])('se rechaza un carrito con %s', (_, input) => {
  expect(() => validateStoredCart(input)).toThrow();
});

test('guardar exige la versión del carrito que tiene el dispositivo', () => {
  const cart = { restaurantId: 'r', lines: [{ productId: 'p', quantity: 2 }] };
  expect(validateCartSave({ ...cart, version: 3 })).toEqual({ cart, version: 3 });
  expect(validateCartSave({ restaurantId: null, lines: [], version: 0 })).toEqual({ cart: { restaurantId: null, lines: [] }, version: 0 });
});

test.each([undefined, -1, 1.5, '2', null])('se rechaza guardar con la versión %p', version => {
  expect(() => validateCartSave({ restaurantId: 'r', lines: [{ productId: 'p', quantity: 1 }], version })).toThrow('Actualiza el carrito antes de guardar.');
});
