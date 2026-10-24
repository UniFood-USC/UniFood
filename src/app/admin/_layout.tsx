import { RoleTabs } from '../../components/RoleTabs';

export default function AdminLayout() {
  return <RoleTabs tabs={[
    { name: 'index', title: 'Usuarios', icon: 'users', header: false },
    { name: 'restaurants', title: 'Restaurantes', icon: 'shopping-bag' },
    { name: 'orders', title: 'Pedidos', icon: 'clipboard' },
    { name: 'promotions', title: 'Promociones', icon: 'tag' },
    { name: 'profile', title: 'Perfil', icon: 'user' },
  ]} />;
}
