# Alcance inicial de UniFood

Base académica para la aplicación móvil, organizada según los 24 requerimientos funcionales acordados. El documento Word de requerimientos permanece en la carpeta superior `appmoviles`.

## Decisiones confirmadas

- React Native con Expo y TypeScript.
- Roles: estudiante, restaurante y administrador.
- El restaurante marca el pedido como recogido cuando lo entrega.
- Las calificaciones usan una escala de 1 a 5 estrellas.
- Solo el administrador gestiona promociones y descuentos.
- Métodos de pago previstos: Nequi, tarjeta débito/crédito y efectivo.
- Español e importes en pesos colombianos.

## Siguientes etapas

1. Definir el servidor y la base de datos; implementar registro, acceso y permisos.
2. Implementar restaurantes, menús y carrito.
3. Implementar pedidos, estados y el flujo de pago.
4. Añadir notificaciones, calificaciones, reportes y promociones.

La selección de un módulo en esta base no concede permisos reales. La autorización se implementará y verificará en el servidor cuando exista autenticación.
