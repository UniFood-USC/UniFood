# Identidad visual oficial de UniFood

La imagen siguiente fue elegida por el equipo como referencia oficial del diseño y logo de UniFood. Toda pantalla nueva o modificada debe conservar esta identidad, tanto para Estudiante como para Restaurante y Administrador. Cualquier cambio de identidad requiere acuerdo explícito del equipo.

![Diseño y logo oficial de UniFood](assets/brand/unifood-referencia-visual.png)

## Logo y marca

- Logo aprobado: hamburguesa ilustrada con contorno oscuro, ingredientes de colores y pequeños trazos de acento naranja, acompañada por la palabra **UniFood**.
- Mantener **Uni** en oscuro y **Food** en naranja, las proporciones y la composición de la referencia. No sustituir la hamburguesa por un emoji ni crear otra versión de la marca.
- Lema principal: **«Pide. Paga. Recoge.»**. Frase decorativa secundaria: **«Buena comida, mejores días»**.
- Usar la composición amplia en bienvenida, acceso y carga; una versión compacta en encabezados cuando el espacio lo permita. Conservar legibilidad y espacio libre alrededor.
- Recursos independientes entregados el 05/10/2026: `assets/unifood-logo.svg` y `assets/unifood-logo.png`; fondos `assets/fondo-crear-cuenta.{svg,png}` y `assets/fondo-iniciar-sesion.{svg,png}`. Son los recursos autorizados para las pantallas de acceso, registro y futura carga inicial; no redibujar la marca. Esta entrega aplica primero Crear cuenta y no cambia los iconos instalables de la app.
- Crear cuenta usa los PNG originales: logo 2240×1600 (146 KB) y fondo 1560×3376 (88 KB). Tienen resolución suficiente para el tamaño móvil de presentación, transparencia en el logo y carga directa en Android/iOS/web sin añadir un renderizador SVG. Los SVG se conservan como originales vectoriales para futuras necesidades de escala.

## Estilo compartido

- Fondo claro cálido, cercano al marfil; superficies blancas y formas orgánicas suaves en tonos durazno para bienvenida, acceso y carga.
- Naranja vivo como color principal en botones, selección, progreso y acentos. Texto principal casi negro; texto secundario gris. Verde para resultados positivos cuando corresponda, acompañado de texto o icono.
- Tipografía sans serif, títulos de peso marcado y texto de lectura sencillo. La tipografía manuscrita de la frase decorativa no se usa para formularios ni información operativa.
- Botones principales anchos y redondeados, con etiqueta clara; campos con borde gris suave e iconos de apoyo; tarjetas redondeadas, divisores discretos y sombras suaves.
- Fotografías de comida destacadas en tarjetas y detalles; precios y totales con jerarquía visible. Iconos sencillos y consistentes, con naranja para la opción activa.
- Mantener separación y márgenes regulares, una acción principal clara por pantalla y navegación adaptada al rol. El marco negro del teléfono pertenece a la presentación y no forma parte de la interfaz.

La lámina define la dirección visual, pero no especifica fuentes, códigos de color, medidas ni recursos originales. Al implementar, se definirán valores compartidos contrastándolos con esta referencia; no se presentarán valores estimados como datos exactos del diseño.

## Pantallas y adaptación por rol

Las 15 vistas ilustran bienvenida, inicio de sesión, registro, recuperación, inicio, restaurantes, menú, producto, carrito, pago, confirmación, seguimiento, pedidos, perfil y carga. Son la referencia de composición del recorrido del estudiante.

Restaurante y Administrador conservarán los mismos colores, tipografía, campos, botones, tarjetas e iconografía, con acciones y navegación propias de sus permisos. Domicilio al salón (RF-25) y pedidos programados (RF-26) extenderán el mismo estilo en selección de destino, fecha, horario, confirmación y seguimiento.

## Relación con los requisitos

La imagen define apariencia, no incorpora funciones ni cambia las reglas del producto. Los requisitos acordados prevalecen sobre textos, ejemplos y controles ilustrativos. En particular:

- «Cerca de ti» no implica geolocalización; la oferta corresponde al campus y el acceso estudiantil depende del correo institucional.
- «Costo de servicio» no autoriza un cargo adicional: mostrar únicamente los conceptos aprobados, incluida la tarifa de domicilio cuando aplique.
- Corazones, direcciones libres, métodos de pago guardados u otros controles ilustrativos no agregan funciones al alcance.
- Los pagos y reembolsos siguen siendo simulados; las opciones de entrega y los estados deben corresponder a recogida o domicilio.
- Nombres, fotografías, importes, tiempos y datos personales de la lámina son ejemplos, no datos iniciales obligatorios.

## Revisión visual de cada entrega

- [ ] Conserva el logo aprobado y la identidad de color, formas y jerarquía.
- [ ] Usa elementos compartidos; no introduce un estilo independiente por persona o rol.
- [ ] Respeta los requisitos y permisos del rol, incluyendo RF-25 y RF-26 cuando aplique.
- [ ] Incluye estados de carga, vacío, error, deshabilitado y éxito coherentes con el diseño.
- [ ] Mantiene contraste, texto legible, controles táctiles cómodos y etiquetas accesibles; no comunica estados solo con color.
- [ ] Se adapta a distintos tamaños, áreas seguras y teclado en Android e iOS, sin copiar dimensiones fijas del teléfono de la imagen.
- [ ] La entrega incluye evidencia visual comparada con la referencia y explica cualquier adaptación necesaria.

Omar coordina los elementos visuales compartidos; cada integrante aplica esta referencia en sus módulos y acuerda los cambios comunes antes de editarlos.
