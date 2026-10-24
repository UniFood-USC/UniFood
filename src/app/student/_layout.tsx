import { RoleTabs } from '../../components/RoleTabs';

export default function StudentLayout() {
  return <RoleTabs tabs={[
    { name: 'index', title: 'Inicio', icon: 'home', header: false },
    { name: 'search', title: 'Buscar', icon: 'search' },
    { name: 'cart', title: 'Carrito', icon: 'shopping-cart' },
    { name: 'orders', title: 'Pedidos', icon: 'clipboard', header: false },
    { name: 'profile', title: 'Perfil', icon: 'user' },
  ]} />;
}
