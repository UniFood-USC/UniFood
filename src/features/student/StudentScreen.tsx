import { ModuleScreen } from '../../components/ModuleScreen';
export default function StudentScreen() {
  return <ModuleScreen title="Tu campus, a un pedido." description="Un espacio para encontrar qué comer y seguir tu pedido." features={['RF-01 a RF-03 · Registro, acceso y recuperación de contraseña', 'RF-04 a RF-06 · Restaurantes, búsqueda y menús', 'RF-07 a RF-10 · Carrito, total, método de pago y confirmación', 'RF-11 a RF-15 · Seguimiento, notificaciones, historial y calificaciones']} />;
}
