import type { ProductoDoc } from '../src/types/Menu';

// RF-06 · Menús ficticios de los restaurantes de demostración (restaurantes/{id}/productos/{productoId}).
// Solo datos, sin Firebase: así las pruebas unitarias pueden comprobar que cubren cada criterio.
// Cubre: promoción vigente, promoción vencida, agotado, varias fotos, sin fotos, sin descripción,
// producto oculto y un menú vacío (Fruta Fresca).
const foto = (texto: string, color = 'C8440A') => `https://placehold.co/600x400/${color}/FFFFFF/png?text=${encodeURIComponent(texto)}`;
export type Entrada = ProductoDoc & { id: string };
export const privado = { costoCOP: 1000, notaInterna: 'No debe salir al estudiante' };

export const menusDemo: Record<string, Entrada[]> = {
  // Los tres primeros coinciden con los productos de ejemplo del carrito (RF-07).
  'rest-burger': [
    { id: 'doble', nombre: 'Doble', descripcion: 'Dos carnes de res, queso cheddar, lechuga y tomate en pan artesanal.', precioCOP: 20000, fotos: [foto('Doble'), foto('Doble 2', 'F56A25'), foto('Doble 3', '8A2E06')], disponible: true, promocion: { porcentaje: 15 } },
    { id: 'papas', nombre: 'Papas', descripcion: 'Porción de papas a la francesa.', precioCOP: 6000, fotos: [foto('Papas')], disponible: true },
    { id: 'gaseosa', nombre: 'Gaseosa', precioCOP: 4000, fotos: [foto('Gaseosa')], disponible: true },
    { id: 'sencilla', nombre: 'Sencilla', descripcion: 'Una carne de res con queso.', precioCOP: 14000, fotos: [foto('Sencilla')], disponible: false },
    { id: 'combo', nombre: 'Combo Campus', descripcion: 'Sencilla, papas y gaseosa.', precioCOP: 22000, disponible: true, promocion: { porcentaje: 10, hasta: '2020-01-01T00:00:00Z' } },
    { id: 'oculto', nombre: 'Producto oculto', precioCOP: 9000, disponible: true, activo: false },
  ],
  'rest-pizza': [
    { id: 'margarita', nombre: 'Pizza Margarita', descripcion: 'Salsa de tomate, mozzarella y albahaca.', precioCOP: 18000, fotos: [foto('Margarita')], disponible: true },
    { id: 'pepperoni', nombre: 'Pizza Pepperoni', descripcion: 'Mozzarella y pepperoni.', precioCOP: 21000, fotos: [foto('Pepperoni'), foto('Pepperoni 2', 'F56A25')], disponible: true, promocion: { porcentaje: 20 } },
    { id: 'porcion', nombre: 'Porción', precioCOP: 5500, disponible: false },
  ],
  'rest-sazon': [
    { id: 'almuerzo', nombre: 'Almuerzo del día', descripcion: 'Sopa, seco con proteína, jugo y postre.', precioCOP: 13500, fotos: [foto('Almuerzo')], disponible: true },
    { id: 'bandeja', nombre: 'Bandeja paisa', descripcion: 'Fríjoles, arroz, chicharrón, carne molida, huevo y arepa.', precioCOP: 24000, fotos: [foto('Bandeja')], disponible: true },
  ],
  'rest-cafe': [
    { id: 'tinto', nombre: 'Tinto', precioCOP: 2000, disponible: true },
    { id: 'capuchino', nombre: 'Capuchino', descripcion: 'Espresso con leche espumada.', precioCOP: 5500, fotos: [foto('Capuchino', '6F4E37')], disponible: true },
    { id: 'croissant', nombre: 'Croissant', descripcion: 'Mantequilla, horneado hoy.', precioCOP: 4500, fotos: [foto('Croissant', '6F4E37')], disponible: false },
  ],
  'rest-fruta': [],   // Menú vacío: la app debe informarlo expresamente.
  'rest-arepas': [
    { id: 'arepa-queso', nombre: 'Arepa de queso', descripcion: 'Arepa asada rellena de queso.', precioCOP: 7000, fotos: [foto('Arepa')], disponible: true },
    { id: 'arepa-huevo', nombre: 'Arepa de huevo', descripcion: 'Arepa frita con huevo.', precioCOP: 6500, fotos: [foto('Arepa huevo')], disponible: true },
  ],
};
