import { RoleTabs } from '../../components/RoleTabs';

export default function RestaurantLayout() {
  return <RoleTabs tabs={[
    { name: 'index', title: 'Pedidos', icon: 'clipboard' },
    { name: 'menu', title: 'Menú', icon: 'book-open' },
    { name: 'sales', title: 'Ventas', icon: 'bar-chart-2' },
    { name: 'profile', title: 'Perfil', icon: 'user' },
  ]} />;
}
