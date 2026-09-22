import { ModuleScreen } from '../../components/ModuleScreen';
export default function AdminScreen() {
  return <ModuleScreen title="UniFood, en orden." description="La administración de la comunidad y los restaurantes." features={['RF-21 · Gestionar usuarios', 'RF-22 · Gestionar restaurantes', 'RF-23 · Consultar pedidos y reportes generales', 'RF-24 · Crear y gestionar promociones y descuentos']} />;
}
