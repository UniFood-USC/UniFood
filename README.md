# UniFood
App Movil para pedir comida en el campus USC  |  React Native + Expo + Firebase

Proyecto de Desarrollo de Aplicaciones Móviles de la Universidad Santiago de Cali.

## Diseño y logo oficiales

El equipo adopta esta referencia como identidad visual de UniFood para los tres roles. Toda pantalla debe seguir su logo, colores, formas y estilo, según la [guía visual del equipo](DESIGN.md). La imagen guía la apariencia; los requisitos acordados determinan el comportamiento.

![Diseño y logo oficiales de UniFood](assets/brand/unifood-referencia-visual.png)

## Equipo

- Nahia Yesenia Montoya Sánchez
- Johan Sebastián Orejuela Mina
- Omar Sinisterra

### Reparto de trabajo

El trabajo se organiza en **26 requerimientos funcionales (RF)** dentro del [tablero del equipo](https://github.com/orgs/UniFood-USC/projects/1). Cada tarjeta reúne las tareas y los criterios necesarios para completar un requerimiento.

- **Omar Sinisterra — [Osinisterra](https://github.com/Osinisterra):** RF-01–RF-03, RF-07–RF-10, RF-12, RF-17, RF-21 y RF-26. Registro, acceso, recuperación, carrito, total, pagos simulados, identificador del pedido, notificaciones, usuarios y pedidos programados. También coordina la base común, seguridad e integración.
- **Nahia Yesenia Montoya Sánchez — [Nahia-24](https://github.com/Nahia-24):** RF-11, RF-13–RF-15, RF-18–RF-20 y RF-23. Seguimiento, historial, valoraciones, preparación, estados, ventas y reportes.
- **Johan Sebastián Orejuela Mina — [HAKAIEx](https://github.com/HAKAIEx):** RF-04–RF-06, RF-16, RF-22, RF-24 y RF-25. Listado y búsqueda de restaurantes, consulta y gestión del menú, administración de restaurantes, promociones y entrega al salón.

Cada RF tiene un responsable principal: En entregas y programación, Johan lidera la entrega al salón y aporta destinos, cobertura, horarios y cupos; Omar integra compra, pagos y avisos; Nahia gestiona los estados y la cancelación de pedidos. Las aportaciones de cada persona se indican dentro de la tarjeta correspondiente.

### Cómo colaborar

- Usar «My items» para consultar los requerimientos asignados y marcar sus tareas internas a medida que se verifican.
- Mover la tarjeta a «In progress» al comenzar y a «Done» cuando se cumplan todos sus criterios y la entrega esté integrada.
- Trabajar en ramas propias y realizar entregas pequeñas; recibir las dependencias de otros compañeros antes de cerrar una integración.
- Cada integrante mantiene sus módulos. Omar coordina los archivos comunes de navegación, configuración, dependencias y componentes compartidos; los cambios necesarios se acuerdan antes de editar para evitar cruces.

### Git: trabajo diario del equipo

Cada persona trabaja en una rama por entrega o RF. `main` recibe los cambios mediante un Pull Request (PR) revisado por otro integrante. Las ramas separan el trabajo, pero no evitan conflictos si dos personas editan el mismo archivo: acuerden primero los cambios en archivos compartidos.

Los nombres siguientes son ejemplos; cambien el RF y la descripción para cada entrega. En los comandos, sustituyan `MI_RAMA` por su rama y `RUTA_ARCHIVO` por un archivo concreto. No ejecuten los tres ejemplos de creación de rama: cada integrante usa el suyo.

| Integrante | Ejemplo de rama | Crear después de actualizar `main` |
| --- | --- | --- |
| Omar | `omar/rf-07-carrito` | `git switch -c omar/rf-07-carrito` |
| Nahia | `nahia/rf-11-seguimiento` | `git switch -c nahia/rf-11-seguimiento` |
| Johan | `johan/rf-25-entrega-salon` | `git switch -c johan/rf-25-entrega-salon` |

**1. Empezar una entrega.** Primero revisen `git status`: si hay cambios pendientes, guárdenlos con un commit en su rama o usen el apartado de guardado temporal antes de cambiar de rama.

```sh
git status
git switch main
git pull --ff-only origin main
```

Ahora ejecuten el comando de creación de su fila. Para retomar una rama que ya existe, usen `git switch MI_RAMA`, sin `-c`.

**2. Guardar un avance.** Revisen lo que van a incluir y agreguen únicamente los archivos de esa entrega. Repitan `git add` para cada archivo necesario.

```sh
git status
git diff
git add -- RUTA_ARCHIVO
git diff --cached
git commit -m "RF-XX: describir el avance realizado"
```

**3. Recibir los cambios del equipo y publicar.** Desde su rama, con los cambios guardados y `git status` limpio:

```sh
git fetch origin
git merge origin/main
docker compose run --rm workspace npm run lint
docker compose run --rm workspace npm run typecheck
git push -u origin MI_RAMA
```

Si aparece un conflicto, resuélvanlo antes de seguir. Publiquen cuando las verificaciones pasen y comprueben también el funcionamiento de las pantallas modificadas. Después del primer envío, basta `git push`.

**4. Integrar.** En GitHub, abran un PR desde su rama hacia `main`, enlacen la tarjeta RF y expliquen qué hicieron y cómo lo probaron. Otro integrante revisa; los conflictos se resuelven en la rama de trabajo. Cuando esté aprobado y comprobado, intégrenlo desde GitHub. Marquen el RF como Done solo cuando todos sus criterios estén cumplidos; un PR parcial no cierra todo el RF.

**5. Empezar la siguiente entrega.** Con el trabajo anterior integrado y sin cambios locales pendientes:

```sh
git switch main
git pull --ff-only origin main
```

Creen una rama nueva para la siguiente entrega. No hagan `push` directo a `main` ni usen `push --force` para resolver un rechazo.

### Git: problemas comunes

**Hay cambios sin guardar y Git impide cambiar de rama o actualizar.** Guarden temporalmente el trabajo; `-u` incluye archivos nuevos, pero no archivos ignorados:

```sh
git stash push -u -m "Avance temporal antes de actualizar"
git status
```

Realicen la actualización necesaria. Regresen a la rama donde estaban trabajando y recuperen el guardado correcto:

```sh
git switch MI_RAMA
git stash list
git stash apply 'stash@{0}'
git status
```

`stash@{0}` es el guardado más reciente: verifiquen su mensaje antes de aplicarlo. El guardado se conserva; después de comprobar y hacer commit del trabajo recuperado, pueden eliminar esa entrada con `git stash drop 'stash@{0}'`. Si `apply` produce conflictos, resuelvan los archivos y hagan un commit normal; no ejecuten `git merge --continue`, porque no hay una fusión en curso.

**Aparece `CONFLICT` al ejecutar `git merge`.** Identifiquen los archivos afectados:

```sh
git status
git diff --name-only --diff-filter=U
```

Abran cada archivo, combinen los cambios necesarios y eliminen las marcas `<<<<<<<`, `=======` y `>>>>>>>`. Acuerden con el compañero el resultado si ambas versiones modifican el mismo comportamiento. Si uno eliminó un archivo y otro lo modificó, decidan si conservarlo (`git add`) o confirmar su eliminación (`git rm -- RUTA_ARCHIVO`). No acepten todos los cambios de un lado sin revisarlos.

```sh
git add -- RUTA_ARCHIVO
git diff --check
git diff --cached
docker compose run --rm workspace npm run lint
docker compose run --rm workspace npm run typecheck
git merge --continue
git push
```

Repitan `git add` por cada archivo resuelto. Continúen solo cuando `git status` ya no muestre archivos sin resolver. `git merge --continue` puede abrir el editor del mensaje: guárdenlo y ciérrenlo. Para cancelar una fusión todavía en curso y volver al estado anterior:

```sh
git merge --abort
```

Empiecen siempre las fusiones con el trabajo guardado, para que cancelar no ponga en riesgo cambios previos. Referencia: [resolución de fusiones en Git](https://git-scm.com/docs/git-merge).

**El `push` es rechazado con `non-fast-forward`.** Hay cambios remotos en esa misma rama. Con el trabajo local guardado:

```sh
git fetch origin
git merge origin/MI_RAMA
```

Resuelvan los conflictos si aparecen, ejecuten las verificaciones y vuelvan a usar `git push`. Este caso integra la rama remota de trabajo; actualizar solo desde `origin/main` no lo resuelve.

**`git pull --ff-only` falla en `main` porque las ramas divergieron.** Con el trabajo guardado, creen una rama para conservar los commits locales y revisarlos mediante un PR:

```sh
git switch -c rescate/mi-nombre-avance
git fetch origin
git merge origin/main
```

Resuelvan conflictos, verifiquen y publiquen esa rama con `git push -u origin rescate/mi-nombre-avance`. Coordinen la recuperación del `main` local antes de volver a usarlo; no borren sus commits con `reset --hard`.

**Empecé a editar en `main` por error, pero aún no hice commit.** Creen una rama nueva inmediatamente; los cambios pendientes se mantienen:

```sh
git switch -c mi-nombre/rf-xx-descripcion
git status
```

Después guarden y publiquen siguiendo el flujo normal. Si ya hicieron commits locales en `main`, usen el caso de rescate anterior.

**Agregué un archivo al próximo commit por error.** Sáquenlo de la preparación sin borrar sus cambios:

```sh
git restore --staged -- RUTA_ARCHIVO
```

**Un commit ya compartido introdujo un error.** Desde una rama nueva basada en `main` actualizado, revisen el historial y reviertan el commit concreto:

```sh
git log --oneline -10
git revert HASH_DEL_COMMIT
```

Sustituyan `HASH_DEL_COMMIT` por el identificador comprobado. Verifiquen el resultado y envíen la corrección por PR. Si la reversión tiene conflictos, resuélvanlos, agreguen los archivos y ejecuten `git revert --continue`; para cancelarla, `git revert --abort`. Si el commit es una fusión, acuerden con Omar qué revertir antes de ejecutarlo.

**Hay conflictos en `package.json` o `package-lock.json`.** Coordinen con Omar la combinación de dependencias. No borren el archivo de bloqueo ni elijan una versión completa para salir del conflicto. Una vez resueltos ambos archivos, ejecuten la instalación y las verificaciones de Docker descritas abajo; si falla la instalación, corrijan la inconsistencia antes de completar la fusión.

Referencia adicional: [guardado temporal con Git stash](https://git-scm.com/docs/git-stash).

## Ejecutar

Requiere Docker Desktop abierto. Node, npm, Java, Expo, Firebase y todas las dependencias se ejecutan **dentro de Docker**. Los volúmenes `dependencies` y `functions-dependencies` aíslan ambos `node_modules` del equipo anfitrión. No instalar Node, Java, Expo CLI, Xcode ni Android Studio en el Mac.

### 1. Preparar la terminal y las dependencias

En este Mac, el enlace habitual de Docker apunta al volumen antiguo del instalador. Estos comandos usan el Docker ya instalado, sin reinstalar nada:

```sh
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
cd /Users/omarsinisterra/Documents/usc/Clases/AppMoviles/UniFood
```

Solo la primera vez, o si cambian los archivos de dependencias:

```sh
docker compose build
docker compose run --rm workspace sh -c 'npm ci && npm ci --prefix functions'
```

No hace falta repetir la instalación cada vez que abras el proyecto. Si los servicios están corriendo, detenlos con `docker compose down` antes de reinstalar dependencias.

### 2. Ver la app en el navegador del Mac

```sh
unset UNIFOOD_HOST
docker compose up -d workspace app
docker compose logs -f workspace
```

Espera a ver `All emulators ready`, pulsa **Ctrl+C** para salir de los logs (los servicios siguen activos) y carga los usuarios ficticios:

```sh
docker compose exec workspace npm run seed
```

Abre [UniFood](http://localhost:8081), [registro estudiantil](http://localhost:8081/register) o [panel de Firebase local](http://localhost:4000). El primer acceso puede tardar mientras Expo compila. Para ver el progreso: `docker compose logs -f app`.

### 3. Ver la app en Expo Go desde el teléfono

Sí: la base actual usa bibliotecas compatibles con Expo Go. Necesitas **Expo Go compatible con SDK 57 en el teléfono**, y el Mac y el teléfono en la **misma red Wi-Fi**. Los servidores y dependencias permanecen en Docker; Expo Go es la app que muestra el resultado en el teléfono. No se ha certificado aún una prueba física Android/iOS de esta entrega.

Busca la **dirección IP del Mac** en Ajustes del Sistema → Wi-Fi → Detalles → TCP/IP. Usa esa dirección, no la del router ni una dirección interna del contenedor. Sustituye la IP del ejemplo:

```sh
docker compose down
export UNIFOOD_HOST=192.168.1.50
docker compose up -d workspace
docker compose logs -f workspace
```

Cuando aparezca `All emulators ready`, sal de los logs con **Ctrl+C**:

```sh
docker compose exec workspace npm run seed
```

**En iPhone**, Expo exige que el CLI y Expo Go tengan iniciada sesión con la misma cuenta de Expo. Inicia sesión desde Docker antes de arrancar la app y usa esa misma cuenta en Expo Go:

```sh
docker compose run --rm -e CI=0 app npx expo login
```

El volumen `expo-state` conserva la sesión del CLI dentro de Docker. No escribas contraseñas en el README ni en comandos guardados. Después, inicia Expo y muestra su QR:

```sh
docker compose up -d app
docker compose logs -f app
```

Escanea el QR con Expo Go en Android o con la cámara en iPhone. Debe anunciar `exp://192.168.1.50:8081` usando **tu IP real**. Si Expo Go ofrece entrada manual de URL, también puedes usar esa dirección. Desde el navegador del teléfono o del Mac puedes abrir `http://TU_IP_DEL_MAC:8081`.

`UNIFOOD_HOST` configura juntos el enlace QR, la dirección del servicio en la app y los puertos publicados por Docker. No pongas `localhost`, `127.0.0.1` ni `0.0.0.0` para el teléfono. Cambiar la IP requiere volver a ejecutar `docker compose up -d workspace app` y recargar Expo Go. La variable dura solo en esa terminal; si abres otra para gestionar los servicios, repite el `export` con la misma IP.

Esta opción permite acceder a los emuladores desde la red elegida: úsala en una red privada de confianza, con datos ficticios. El panel de administración de Firebase sigue restringido al Mac en `localhost:4000`.

### Problemas frecuentes al abrir Expo Go

- **No conecta:** comprueba la misma Wi-Fi y la IP del Mac. Prueba `http://TU_IP_DEL_MAC:8081` en el navegador del teléfono. Redes de invitados/universidad pueden impedir comunicación entre dispositivos; usa una red privada que la permita. Revisa el permiso de red local de Expo Go en iOS y que el firewall permita los puertos de la demo.
- **Abre la pantalla, pero falla el registro:** el teléfono también debe alcanzar Auth (9099) y Functions (5001), no solo Expo (8081). Verifica `UNIFOOD_HOST`, que los emuladores estén listos y reinicia/recarga la app tras cambiar la IP.
- **El QR muestra una IP del contenedor:** recrea la app con `docker compose up -d --force-recreate app` desde la terminal donde exportaste `UNIFOOD_HOST`.
- **SDK incompatible:** usa Expo Go compatible con SDK 57. Consulta [las versiones de Expo Go](https://expo.dev/go); la disponibilidad depende de la plataforma. No cambies el SDK del proyecto solo para quitar el mensaje.
- **Error de cuenta en iPhone:** inicia sesión con la misma cuenta en Expo Go y en el CLI de Docker; después reinicia el contenedor `app`.
- **Puerto ocupado:** detén la ejecución previa con `docker compose down`. No arranques dos servicios Expo sobre el mismo puerto.
- **Tunnel:** no basta usar `--tunnel`: un túnel de Expo no publica automáticamente los emuladores Firebase. Este procedimiento utiliza LAN.

Referencias: [abrir un proyecto en el teléfono](https://docs.expo.dev/get-started/start-developing/) y [opciones de Expo CLI y URL anunciada](https://docs.expo.dev/more/expo-cli/).

### Detener o volver al modo local

```sh
docker compose down
unset UNIFOOD_HOST
```

Para abrir otra vez solo en el Mac, sigue el paso 2. Auth/Firestore son efímeros: sus datos desaparecen al detener los emuladores y se recrean con el seed. Las dependencias y la sesión Expo permanecen en volúmenes Docker. La suite de integración levanta sus propios emuladores aislados, sin modificar la demo abierta.

Identidades ficticias del seed: `demo-admin-1`, `demo-admin-2`, `demo-student` y `demo-restaurant`. Usan la contraseña de prueba `Demo1234`, exclusivamente en el proyecto emulado `demo-unifood`; no se envían correos. No hay configuración de un proyecto Firebase real.

## Estructura

- `src/app/`: pantallas y navegación con Expo Router.
- `src/features/student/`: módulo Estudiante (RF-01 a RF-15), selección de bloque y salón para domicilio (RF-25), y selección de fecha y hora para pedidos programados (RF-26).
- `src/features/restaurant/`: módulo Restaurante (RF-16 a RF-20), configuración de cobertura y tarifa y gestión de entregas al salón (RF-25), y configuración de horarios y cupos y gestión de pedidos programados (RF-26).
- `src/features/admin/`: módulo Administrador (RF-21 a RF-24) y administración del catálogo de bloques y salones (RF-25).
- `src/components/`: componentes compartidos.
- `src/constants/`: colores y configuración visual.
- `src/types/`: tipos compartidos del dominio.

RF-25 y RF-26 son funciones que involucran varios roles; sus pantallas se ubican en el módulo del usuario correspondiente. Johan lidera RF-25 y Omar RF-26. Los cambios que requieran aportaciones de otro integrante se coordinan antes de editar los archivos compartidos.

## Estado de la entrega hasta T019

Base común con reloj controlable, contrato de respuestas, cliente de servicio, emuladores, cuatro identidades ficticias y reglas iniciales de acceso. Registro estudiantil conectado a Auth/Firestore: normaliza correo, valida dominio USC y contraseña, rechaza duplicados entre roles y altas concurrentes, y compensa fallos para no dejar perfiles huérfanos. El alta abre la sesión de la cuenta recién creada, sin exigir verificación de correo.

La interfaz conserva el logo original, paleta cálida, controles accesibles y mensajes en español. La portada ofrece entradas de desarrollo para los tres roles; sus módulos continúan como contenedores sin datos privados. **T020 no está implementada:** no existe formulario ni operación de inicio de sesión por credenciales. Tampoco están implementados compra, pagos, avisos o administración completa. El registro aporta RF-01; la infraestructura prepara los demás RF sin declararlos terminados.

## Verificaciones

```sh
docker compose run --rm workspace npm test
docker compose run --rm workspace npm run test:integration
docker compose run --rm workspace npm run lint
docker compose run --rm workspace npm run typecheck
docker compose run --rm workspace npx expo install --check
```

## Referencias

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Router](https://docs.expo.dev/router/installation/)
