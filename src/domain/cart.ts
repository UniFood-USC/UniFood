// Reglas del carrito y del total (RF-07, RF-08). Importes en pesos colombianos enteros.
// Precio y porcentaje llegan del menú y de las promociones; aquí solo se aplican.

export type Product = { id: string; restaurantId: string; name: string; priceCOP: number; discountPercent: number };
export type CartLine = { productId: string; name: string; priceCOP: number; quantity: number; discountPercent: number };
export type Cart = { restaurantId: string | null; lines: CartLine[] };

export const emptyCart: Cart = { restaurantId: null, lines: [] };
const quantityError = 'La cantidad debe ser un número entero de 1 a 20, o 0 para eliminar el producto.';

function checkQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 20) throw new Error(quantityError);
}

// Cero elimina la línea; un carrito sin líneas deja de pertenecer a un restaurante.
export function setQuantity(cart: Cart, productId: string, quantity: number): Cart {
  checkQuantity(quantity);
  const lines = quantity === 0
    ? cart.lines.filter(line => line.productId !== productId)
    : cart.lines.map(line => line.productId === productId ? { ...line, quantity } : line);
  return lines.length ? { ...cart, lines } : emptyCart;
}

// Un carrito es de un solo restaurante: cambiarlo exige la confirmación del estudiante.
export function addProduct(cart: Cart, product: Product, quantity = 1, replaceRestaurant = false) {
  if (cart.restaurantId && cart.restaurantId !== product.restaurantId && !replaceRestaurant) return { cart, requiresConfirmation: true };
  const base = cart.restaurantId === product.restaurantId ? cart : { restaurantId: product.restaurantId, lines: [] };
  const current = base.lines.find(line => line.productId === product.id)?.quantity ?? 0;
  if (quantity < 1) throw new Error(quantityError);
  checkQuantity(current + quantity);
  const line = { productId: product.id, name: product.name, priceCOP: product.priceCOP, quantity: current + quantity, discountPercent: product.discountPercent };
  const lines = current ? base.lines.map(item => item.productId === product.id ? line : item) : [...base.lines, line];
  return { cart: { restaurantId: product.restaurantId, lines }, requiresConfirmation: false };
}

// El servicio guarda solo producto y cantidad: nombre, precio y descuento se toman
// siempre del menú vigente, nunca de lo que envía la app.
export type StoredCart = { restaurantId: string | null; lines: { productId: string; quantity: number }[] };

export const storedCart = (cart: Cart): StoredCart =>
  ({ restaurantId: cart.restaurantId, lines: cart.lines.map(({ productId, quantity }) => ({ productId, quantity })) });

// Los productos que ya no están en el menú no se muestran.
export function resolveCart(stored: StoredCart, products: Product[]): Cart {
  const lines = stored.lines.flatMap(({ productId, quantity }) => {
    const product = products.find(item => item.id === productId && item.restaurantId === stored.restaurantId);
    return product ? [{ productId, name: product.name, priceCOP: product.priceCOP, quantity, discountPercent: product.discountPercent }] : [];
  });
  return lines.length ? { restaurantId: stored.restaurantId, lines } : emptyCart;
}

const onlyKeys = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));

export function validateStoredCart(input: unknown): StoredCart {
  if (!onlyKeys(input, ['restaurantId', 'lines']) || !Array.isArray(input.lines)) throw new Error('Revisa los datos del carrito.');
  const { restaurantId, lines } = input;
  if (lines.length ? typeof restaurantId !== 'string' || !restaurantId : restaurantId !== null) throw new Error('El carrito debe pertenecer a un solo restaurante.');
  const valid: StoredCart['lines'] = [];
  for (const line of lines) {
    if (!onlyKeys(line, ['productId', 'quantity']) || typeof line.productId !== 'string' || !line.productId || valid.some(item => item.productId === line.productId)) {
      throw new Error('Cada producto debe aparecer una sola vez, solo con su cantidad.');
    }
    if (line.quantity === 0) throw new Error(quantityError);
    checkQuantity(line.quantity as number);
    valid.push({ productId: line.productId, quantity: line.quantity as number });
  }
  return { restaurantId: restaurantId as string | null, lines: valid };
}

// Un solo redondeo por línea, al peso más cercano y con medio peso hacia arriba.
export function lineAmounts({ priceCOP, quantity, discountPercent }: CartLine) {
  if (!Number.isInteger(priceCOP) || priceCOP < 1) throw new Error('El precio debe ser un entero positivo.');
  if (discountPercent !== 0 && !(Number.isInteger(discountPercent) && discountPercent >= 5 && discountPercent <= 90)) {
    throw new Error('El descuento debe ser un entero de 5 a 90.');
  }
  checkQuantity(quantity);
  const grossCOP = priceCOP * quantity;
  const netCOP = Math.floor((grossCOP * (100 - discountPercent) + 50) / 100);
  return { grossCOP, discountCOP: grossCOP - netCOP, netCOP };
}

// La tarifa de domicilio se suma sin descuento; un total cero no requiere pago.
export function cartTotals(lines: CartLine[], deliveryFeeCOP = 0) {
  const amounts = lines.map(lineAmounts);
  const grossCOP = amounts.reduce((sum, a) => sum + a.grossCOP, 0);
  const productsCOP = amounts.reduce((sum, a) => sum + a.netCOP, 0);
  const totalCOP = productsCOP + deliveryFeeCOP;
  return { grossCOP, discountCOP: grossCOP - productsCOP, productsCOP, deliveryFeeCOP, totalCOP, requiresPayment: totalCOP > 0 };
}

export const formatCOP = (amount: number) => `$${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
