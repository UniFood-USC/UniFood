import { filterSearch, normalizeSearch } from '../../src/features/student/restaurants/SearchScreen';
import type { RestaurantePublico } from '../../src/types/Estado_Restaurante';
import type { MenuProduct } from '../../src/domain/cart';

const restaurant: RestaurantePublico = {
  id: 'rest-burger',
  nombre: 'Burger Campus',
  disponible: true,
};
const pizza: RestaurantePublico = {
  id: 'rest-pizza',
  nombre: 'Pizza Zona',
  disponible: true,
};
const doble: MenuProduct = { id: 'doble', nombre: 'Doble', precioCOP: 20000, disponible: true };
const pizzaCarnes: MenuProduct = { id: 'pizza-carnes', nombre: 'Pizza carnes', precioCOP: 18000, disponible: true };

test('normaliza mayúsculas y acentos al buscar', () => {
  expect(normalizeSearch('  PIZZA   ')).toBe('pizza');
  expect(normalizeSearch('Café')).toBe('cafe');
});

test('busca coincidencias por nombre de restaurante', () => {
  const found = filterSearch([restaurant, pizza], [
    { product: doble, restaurant },
    { product: pizzaCarnes, restaurant: pizza },
  ], 'burger');
  expect(found.restaurants).toEqual([restaurant]);
  expect(found.dishes.map(result => result.product.nombre)).toEqual(['Doble']);
});

test('busca coincidencias por nombre de plato', () => {
  const found = filterSearch([restaurant, pizza], [
    { product: doble, restaurant },
    { product: pizzaCarnes, restaurant: pizza },
  ], 'pizza carne');
  expect(found.restaurants).toEqual([]);
  expect(found.dishes.map(result => result.product.nombre)).toEqual(['Pizza carnes']);
});

test('una búsqueda vacía no devuelve resultados', () => {
  expect(filterSearch([restaurant], [{ product: doble, restaurant }], '   '))
    .toEqual({ restaurants: [], dishes: [] });
});
