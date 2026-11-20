# Bloque de Matías — Frontend, CSRF y cabeceras

## 1. Responsable y objetivo

**Responsable:** Matías. **Ramas asignadas:** `fix/xss-corrections` y `fix/frontend-csrf-cabeceras`, desde `develop`.

Corregir renderizado, protección CSRF y cabeceras sin cambiar el framework ni el comportamiento legítimo. Distribución y estrategia aprobadas; **implementación y pruebas aún no comenzaron**. La [planificación compartida](../planificacion-tp4.md) es la referencia del equipo.  
Se implementa DOMPurify para corregir vulnerabilidades XSS

## 2. Vulnerabilidades asignadas

| ID oficial | Vulnerabilidad | Referencia inicial |
|---|---|---|
| 5 | XSS reflejado en búsqueda y errores | `src/public/js/app.js:125–137,233,288`; `admin.js:61–79`; rutas productoras |
| 6 | XSS almacenado en reseñas | `src/public/js/app.js:250–271` y comentarios persistidos |
| 7 | XSS de DOM en panel | `src/public/js/admin.js:420–428` y demás renderizado dinámico |
| 8 | Ausencia de CSRF | Escrituras de rutas y clientes HTTP de ambos scripts |
| 23 | Ausencia de Helmet/CSP y cabeceras | `src/app.ts` |

## 3. Archivos previstos y propiedad

Propiedad principal: [app.js público](../../src/public/js/app.js), [admin.js](../../src/public/js/admin.js), [app.ts](../../src/app.ts), HTML de [sitio](../../src/public/index.html) y [panel](../../src/public/admin.html) según necesidad, y el middleware CSRF que se implemente.

La validación acotada de [rutas](../../src/routes/comentarios.routes.ts) y [servicio de comentarios](../../src/services/comentarios.service.ts) se coordina con Federico como dependencia de 6 y del test obligatorio de longitud. No agrega una falla principal ni habilita nuevas funcionalidades.

Nicolás mantiene auth/sesiones/usuarios; Homero, administración/errores; Federico, productos/pedidos/reportes. `src/config.ts`, `src/tipos.ts` y validadores compartidos necesitan editor acordado antes de cada cambio. Para los mensajes de backend de la falla 5, coordinar la modificación con cada propietario.

## 4. Estado inseguro actual

Ambos scripts construyen HTML con datos del servidor, base, URL o carrito. `raw()` sólo convierte a texto, no escapa. Hay una función `escaparHtml()` que lee `innerHTML`, pero no protege los puntos actuales. Búsqueda y feedback reflejan datos; reseñas persisten contenido; `vista` alcanza el DOM del panel.

Los clientes no obtienen ni envían tokens. La API no verifica CSRF y el sitio permite pedidos/reseñas anónimos. El login real está en el panel, no en `app.js`. Express sirve estáticos antes de rutas sin Helmet.

Las inserciones de etiquetas `script` mediante `innerHTML` no garantizan por sí solas ejecución; el defecto confirmado es la interpretación de contenido no confiable como HTML. La verificación futura debe evaluar puntos reales sin convertir ejemplos documentales en resultados obtenidos.

## 5. Solución acordada

### Renderizado y validación relacionada

Para corregir los innerHTML sin perder funciones del código demandando una refactorización extensa, se usará DOMPurify para insertar contenido HTML de forma segura fuera de atributos y bloques de código, mientras que en caso de solo usar texto se reemplazará innerHTML por textContent.
Además de evitar la inyección por XSS también se usarán respuestas genenéricas para reemplazar a las respuestas que puedan reflejar el código del atacante y ser usado más adelante en una parte futura de código vulnerable. En caso de que esto pise la tarea de algún otro desarrollador simplemente se avisará en commits, PR o documentación para garantizar su corrección y próximo testeo de seguridad.

### CSRF anónimo y autenticado

Aplicar íntegramente el [contrato CSRF y sesiones](../planificacion-tp4.md#92-contrato-csrf-y-sesiones), acordado antes de cambios en Nicolás/Matías. Se selecciona **GET** `/api/csrf-token` **→** `{ token }`, ruta ya prevista por los helpers y aún inexistente en la aplicación.

- Mantener tokens criptográficos en memoria del servidor. Para sesión válida, asociarlos a su `sid`; para visitantes, contexto aleatorio en cookie `csrf` HttpOnly/SameSite=Lax/Secure por entorno. No convertir ese contexto en autenticación ni exigir login para pedido/reseña.
- Token estable por contexto, máximo ocho horas y limitado por la sesión; comparación con el valor registrado, rechazo de contexto incorrecto/vencido y limpieza de entradas caducadas. Entrega con `Cache-Control: no-store` y sin CORS cruzado.
- Middleware después de parsers y antes de las escrituras. Proteger POST/PUT/PATCH/DELETE de pedidos, comentarios, administración y logout; GET/HEAD/OPTIONS no requieren token ni cambian negocio.
- `fetch` usa `X-CSRF-Token`; admitir `_csrf` en body por helpers y en query sólo para DELETE por `deleteConToken()`. Rechazar transportes contradictorios y evitar registros de tokens/URLs sensibles. Tras validarlo, separar `_csrf` antes de validar campos de negocio o llamar servicios, para no rechazar metadatos legítimos ni persistirlos. En una escritura autenticada no aceptar un token anónimo.
- Verificar Origin exacto cuando esté presente y rechazar Fetch Metadata cross-site. No habilitar acceso cruzado a la API. Origen se define por URL local configurada y puerto; no aceptar cualquier Host/Origin aportado como lista de confianza.

**Login:** excepción específica al token sincronizador. Nicolás exige JSON `application/json`, rechaza formatos de formulario con 415 y origen/Fetch Metadata cross-site con 403. Matías coordina el control compartido y no exige token a clientes JSON legítimos sin cabeceras de navegador, como las peticiones directas de Supertest. Sin CORS/preflight autorizado para otros orígenes, el JSON no permite un formulario cross-site simple. Esta estrategia requiere verificación posterior; no se declara segura ni compatible sólo por diseño.

**Rotación y frontend:** obtener contexto antes de permitir la primera escritura, sin perder el carrito por un fallo de token. Después de login/logout, vencimiento o revocación por contraseña/rol, obtener el token correspondiente al nuevo contexto. Si perdió sesión, mostrar login o estado anónimo según corresponda. No reintentar automáticamente operaciones que puedan duplicar pedidos o reseñas. El `sid` debe seguir siendo la primera cookie de la respuesta de login; emitir cookie anónima al obtener token evita interferir con `cookieCruda()`.

### Cabeceras y CSP

Configurar Helmet antes de servir estáticos y rutas. Política base: `script-src 'self'`, `connect-src 'self'`, `object-src 'none'`, estilos/fuentes locales, `base-uri 'self'`, protección de enmarcado y formularios al mismo origen. Permitir `data:` para imágenes porque ambos HTML incluyen favicon de ese tipo; esto no autoriza subida de SVG activo.

Mantener `nosniff`, política de referrer y protección de clickjacking. En desarrollo HTTP no forzar redirecciones o upgrade a HTTPS que rompan localhost. No usar CSP para omitir correcciones DOM ni habilitar ejecución inline de contenido del usuario.

## 6. Contratos funcionales que deben conservarse

- Catálogo `{ productos, filtros, total }`, filtros combinados, precios y búsqueda con debounce; datos de búsqueda se muestran como texto.
- Carrito en `localStorage` bajo la clave actual; botones y selectores conservan su comportamiento. Pedido transmite producto/cantidad y usa el total del servidor; sólo se vacía tras éxito.
- Publicación y lectura de reseñas sin login, con puntuación y límites legítimos actuales.
- Login, `/api/auth/yo`, logout y panel; tablas, pestañas, cambio de estado/rol, administración, subida y herramientas conservan sus listeners.
- Mantener `data-id`, `data-i`, `data-acc`, `data-pedido`, `data-borrar` y `data-usuario`, y las clases usadas por delegación. Datos no confiables no se convierten en atributos/HTML concatenados.
- Respuestas públicas de error con `error`, renderizadas como texto; tratar 401/403 sin presentar una acción fallida como exitosa. No reconstruir permisos de backend mediante ocultamiento de pestañas.

## 7. Dependencias y acuerdos con otros integrantes

- **Nicolás:** conserva funciones existentes de sesión y revoca IDs vencidos/anteriores/afectados. Matías usa la sesión válida para contexto CSRF; no introduce un bypass por modo de test. Coordinar excepción del login, primera cookie y renovación frontend antes de implementar.
- **Homero:** coordinar protección administrativa, cambio personal, errores y parsers. El archivo decodificado de 512 KiB debe funcionar bajo JSON global de 1 MiB; no aumentar el límite para sostener el parser local de 8 MiB. No registrar tokens de DELETE.
- **Federico:** mantener IDs y formatos del carrito/pedido, errores y reportes; coordinar validación de reseñas como dependencia acotada de 6. Cambios de mensajes en rutas de productos se realizan con su propietario.
- Homero registra la línea base antes de implementar. Los campos sensibles retirados de usuarios no deben seguir esperándose en el panel.

## 8. Orden recomendado de tareas

1. Consultar línea base y contrato compartido con Nicolás/Homero; autorizar la tarea concreta.
2. Reemplazar renderizado de los dos scripts, preservando estructura y listeners.
3. Coordinar errores seguros y validación mínima de reseñas; comprobar funcionamiento legítimo.
4. Implementar endpoint/contextos CSRF y transporte de helpers/frontend con excepción JSON de login coordinada.
5. Integrar rotación, logout y revocación; comprobar token válido/inválido en cada escritura.
6. Incorporar Helmet/CSP y verificar recursos locales y navegación HTTP.
7. Ejecutar verificaciones autorizadas y revisar PR hacia `develop`. No imponer secuencia rígida a tareas independientes de otros bloques.

## 9. Pruebas y criterios de aceptación

**Estado actual: No ejecutado.** Referencias: [seguridad general](../../tests/seguridad.test.ts), [helpers](../../tests/helpers.ts), [auth](../../tests/auth.test.ts), [pedidos](../../tests/pedidos.test.ts), [reportes y páginas](../../tests/reportes.test.ts), [productos](../../tests/productos.test.ts) y [checker](../../scripts/check-security.ts).

| ID | Pruebas relacionadas | Controles |
|---|---|---|
| 5 | Servidor no refleja HTML en errores/login; cliente no asigna innerHTML | XSS-01/02 |
| 6 | Cliente no asigna innerHTML; longitud de reseña limitada | XSS-01 y XSS-04 recomendado; VAL-02 como dependencia |
| 7 | Inspección de inserciones del cliente; revisión manual local del panel | XSS-01 |
| 8 | Token disponible y POST de pedido sin token rechazado; helpers funcionales | CSRF-01/02/04; CSRF-03 recomendado |
| 23 | Sitio envía CSP, nosniff, protección de enmarcado y referrer policy | XSS-03, CFG-01 |

Comprobar también, con autorización: pedido/reseña anónimos con token válido; rechazo de token de otro contexto; cada escritura administrativa con rol y token correctos; login JSON directo legítimo y rechazo local de formularios/origen cruzado; rotación sin perder el flujo; compatibilidad con cookies Secure y orden de `Set-Cookie`.

Las pruebas existentes no ejecutan todo el DOM en un navegador. El test CSRF acepta cualquier respuesta menor que 500 para la petición con token, por lo que debe comprobarse además creación real de pedido con 201. Varias pruebas inválidas no envían token y pueden quedar verdes antes de alcanzar la validación: no utilizar eso como evidencia suficiente de corrección interna.

Ejecutar y registrar las baterías indicadas en la [planificación](../planificacion-tp4.md#6-criterios-de-aceptación), sin modificar helpers, tests o checker. Informar discrepancias reales que requieran docente, sin agregar excepciones artificiales.

## 10. Límites del alcance

No framework, sanitizador añadido sólo para eludir patrones, política general nueva de permisos, Redis ni cambios unilaterales de contratos. No modificar auth/sesiones o administración sin coordinación. No ampliar las reseñas a un bloque independiente ni agregar moderación u otras funciones. No crear herramientas ofensivas ni usar servicios externos.

## 11. Checklist de avance

- [ ] Línea base consultada y contrato CSRF/sesiones coordinado.
- [ ] Renderizado seguro de catálogo, carrito, reseñas, errores y panel.
- [ ] Estructura, selectores, atributos y eventos preservados.
- [ ] Dependencia acotada de validación de reseñas integrada con coordinación.
- [ ] Token y contexto anónimo/autenticado implementados conforme a helpers.
- [ ] Escrituras y transportes protegidos; origen/Fetch Metadata comprobados.
- [ ] Excepción JSON del login verificada con Nicolás, sin declarar compatibilidad por anticipado.
- [ ] Renovación de token y sesión integrada sin duplicar escrituras.
- [ ] Helmet/CSP compatibles con recursos locales y HTTP de desarrollo.
- [ ] Baterías autorizadas y recorrido legítimo registrados.
- [ ] PR hacia `develop` revisado con evidencia y reflexión por falla.
