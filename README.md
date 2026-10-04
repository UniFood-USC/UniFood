# UniFood
App Movil para pedir comida en el campus USC  |  React Native + Expo + Firebase

Proyecto de Desarrollo de Aplicaciones Móviles de la Universidad Santiago de Cali.

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
npm run lint
npm run typecheck
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
npm run lint
npm run typecheck
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

**Hay conflictos en `package.json` o `package-lock.json`.** Coordinen con Omar la combinación de dependencias. No borren el archivo de bloqueo ni elijan una versión completa para salir del conflicto. Una vez resueltos ambos archivos, ejecuten `npm ci`, `npm run lint` y `npm run typecheck`; si falla la instalación, corrijan la inconsistencia antes de completar la fusión.

Referencia adicional: [guardado temporal con Git stash](https://git-scm.com/docs/git-stash).

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

## Estado inicial

Pantalla de bienvenida, navegación a los tres módulos y estructura base con TypeScript. Las pantallas de módulos indican las funciones pendientes. Los accesos de la portada son exclusivamente una vista de desarrollo: no representan autenticación ni permisos de usuario.

Todavía no se han implementado los 26 requerimientos funcionales, el servidor, la base de datos, los pagos ni las notificaciones. No se guardan credenciales ni datos reales.

## Verificaciones

```sh
npm run typecheck
npm run lint
npx expo install --check
```

## Referencias

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Router](https://docs.expo.dev/router/installation/)
