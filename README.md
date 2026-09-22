# UniFood
App Movil para pedir comida en el campus USC  |  React Native + Expo + Firebase

Proyecto de Desarrollo de Aplicaciones Móviles de la Universidad Santiago de Cali.

## Equipo

- Nahia Yesenia Montoya Sánchez
- Johan Sebastián Orejuela Mina
- Omar Sinisterra

## Ejecutar

Requiere Node.js 22.13 o superior (rama 22 LTS) y npm.

```sh
npm ci
npm start
```

Escanea el código QR con Expo Go compatible con el SDK del proyecto. El teléfono y el computador deben estar en la misma red. También puedes usar `npm run android` o `npm run ios` con un emulador/simulador instalado, o `npm run web` para abrir la versión web.

## Estructura

- `src/app/`: pantallas y navegación con Expo Router.
- `src/features/student/`: módulo Estudiante (RF-01 a RF-15).
- `src/features/restaurant/`: módulo Restaurante (RF-16 a RF-20).
- `src/features/admin/`: módulo Administrador (RF-21 a RF-24).
- `src/components/`: componentes compartidos.
- `src/constants/`: colores y configuración visual.
- `src/types/`: tipos compartidos del dominio.
- `docs/`: alcance y decisiones del proyecto.

## Estado inicial

Pantalla de bienvenida, navegación a los tres módulos y estructura base con TypeScript. Las pantallas de módulos indican las funciones pendientes. Los accesos de la portada son exclusivamente una vista de desarrollo: no representan autenticación ni permisos de usuario.

Todavía no se han implementado los 24 requerimientos funcionales, el servidor, la base de datos, los pagos ni las notificaciones. No se guardan credenciales ni datos reales.

## Verificaciones

```sh
npm run typecheck
npm run lint
npx expo install --check
```

## Referencias

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Router](https://docs.expo.dev/router/installation/)
