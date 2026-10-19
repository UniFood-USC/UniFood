// src/constants/routes.ts
// Única fuente de verdad de las rutas de la app.
// Uso: router.push(routes.orderTracking(order.id))
export const routes = {
  home: '/',
  student: '/student',
  restaurant: '/restaurant',
  admin: '/admin',
  orders: '/orders',

  // Estudiante
  orderTracking: (orderId: string) =>
    ({ pathname: '/order/[id]', params: { id: orderId } }) as const,
} as const;