# Bloque de Nicolás — Autenticación, contraseñas y sesiones

## 1. Responsable y objetivo

**Responsable:** Nicolás. **Rama asignada:** `fix/autenticacion-sesiones`, desde `develop`, todavía no creada en esta etapa.

Asegurar login, contraseñas y ciclo de sesión sin reemplazar la arquitectura existente. Distribución y estrategia aprobadas; **implementación y pruebas aún no comenzaron**. La [planificación compartida](../planificacion-tp4.md) define contratos comunes y línea base.

## 2. Vulnerabilidades asignadas

| ID oficial | Vulnerabilidad | Referencia inicial |
|---|---|---|
| 1 | SQL en login | `src/services/usuarios.service.ts:40–44` |
| 11 | Contraseñas en texto plano | Servicio de usuarios e `inicializar.ts` |
| 12 | Ausencia de límite de intentos | `src/routes/auth.routes.ts:18` |
| 13 | Cookie insegura | `src/middleware/sesion.ts:62` |
| 14 | ID de sesión predecible | `src/middleware/sesion.ts:49–52` |
| 15 | Sesiones sin vencimiento | `src/middleware/sesion.ts:55–72` |
| 16 | Logout sin revocación del servidor | `src/routes/auth.routes.ts:69–72` |
| 17 | Enumeración de usuarios | `src/routes/auth.routes.ts:29–39` |

## 3. Archivos previstos y propiedad

Propiedad principal: [servicio de usuarios](../../src/services/usuarios.service.ts), [rutas de autenticación](../../src/routes/auth.routes.ts), [sesiones](../../src/middleware/sesion.ts) e [inicialización de datos](../../src/inicializar.ts).

[Tipos](../../src/tipos.ts) y [configuración](../../src/config.ts) requieren un editor acordado por cambio. Homero mantiene rutas administrativas, middleware de roles y PostgreSQL; Matías mantiene `app.ts`, middleware CSRF y frontend. Comunicar dependencias antes de editar archivos ajenos.

## 4. Estado inseguro actual

El login concatena usuario y contraseña en SQL, compara texto plano y diferencia errores de cuenta inexistente/clave incorrecta. No hay rate limiting. El seed, `actualizar()` y `cambiarPassword()` guardan texto plano; listar o devolver usuarios completos puede exponer `password`.

Las sesiones viven en `sesiones`, un Map del proceso, con contador como ID y `expiraEn: null`; su lectura no comprueba vencimiento. El login actual sí crea otro ID, pero no revoca el anterior. Logout sólo borra la cookie aunque `destruirSesion()` ya existe. Las sesiones guardan una copia del rol, por lo que cambios en base no se reflejan automáticamente.

El seed usa `ON CONFLICT DO NOTHING`: cambiar la contraseña que se inserta no transforma cuentas ya existentes. El estado real de esas cuentas aún requiere inspección local sin mostrar valores.

## 5. Solución acordada

### Login y contraseñas

Buscar usuario mediante parámetro de `pg` y comparar contraseña únicamente con `bcryptjs`, sin igualdad de contraseñas en SQL. Centralizar hashing y comparación en el servicio de usuarios; costo inicial **10** para nuevas escrituras. Los hashes válidos existentes con otro costo se siguen verificando, sin rehash automático que altere datos por sorpresa.

Todas las escrituras incluidas —seed, cambio personal y actualización administrativa— pasan por ese criterio. Homero envía contraseñas en claro como entrada legítima del servicio, nunca hashes ya generados en la ruta; esa entrada no se devuelve ni registra. Conservar cuentas locales de práctica exigidas por la consigna con hashes en la base; no documentar aquí sus claves ni agregar credenciales de producción.

Para resultados públicos de `listar()`, `actualizar()` y `cambiarPassword()`, excluir contraseña y hash; el acceso interno que necesita `autenticar()` no se serializa directamente. Mantener los datos públicos requeridos por cada respuesta y acordar los tipos con Homero.

Credenciales inválidas devuelven 401 y el mismo mensaje, por ejemplo `Usuario o contraseña incorrectos.`, sin reflejar username ni distinguir existencia. Entrada faltante conserva un 400 seguro; validar tipos antes de invocar bcrypt. No imponer una nueva política de contraseñas que invalide las cuentas de práctica. Evitar diferencias innecesarias de procesamiento que vuelvan a revelar existencia de cuenta.

### Transición de contraseñas existentes

Preparar una transición idempotente del texto plano almacenado, sin fallback permanente de autenticación en claro:

1. Antes de implementarla/aplicarla, inspeccionar el entorno local y coordinar con Homero respaldo, acceso y ejecución autorizada. No mostrar contraseñas o hashes.
2. El seed inserta cuentas ausentes con hashes mediante el criterio centralizado y conserva las existentes.
3. Reconocer hashes bcrypt válidos existentes y dejarlos intactos; transformar únicamente valores existentes que requieren la transición. Si hay datos ambiguos o corruptos, informar antes de asumir un formato.
4. Actualizar condicionalmente cada fila esperada, evitando sobrescribir cambios concurrentes. Una segunda ejecución no debe cambiar hashes ya migrados ni resetear usuarios.
5. Comprobar con consultas que no expongan valores y con login legítimo que la transición se completó; después el login sólo utiliza bcrypt. No interpretar un fallo de compare como permiso para probar igualdad en claro.

La implementación puede integrar el recorrido idempotente en la preparación de datos, pero **no arrancar código que transforme una base existente sin la inspección y autorización de ejecución previas**. No borrar ni recrear base/volumen para eludir esta transición.

### Fuerza bruta

Usar `express-rate-limit` para login: ventana de 15 minutos, **9 intentos fallidos por IP**, sin penalizar accesos exitosos; bloqueo 429 con error público seguro. El valor inicial de diez propuesto por el coordinador se ajusta mínimamente porque el test existente realiza diez solicitudes y exige observar bloqueo dentro de ellas. Con un límite de diez, el bloqueo habitual comenzaría en la undécima.

Mantener el limitador en memoria del proceso y la separación de archivos de pruebas. No agregar un bloqueo de cuenta permanente ni un bypass para tests. El segundo test de fuerza bruta permite que una clave correcta continúe bloqueada durante la ventana; no exige aceptar el acceso inmediatamente.

### Sesiones, cookies y revocación

- Mantener Map en memoria; generar IDs mediante aleatoriedad criptográfica de Node, sin Redis u otra infraestructura.
- Establecer vigencia absoluta de **ocho horas** desde creación, calcular `expiraEn` y rechazar/eliminar la sesión vencida en `obtenerSesion()`. No renovar indefinidamente ese máximo.
- `sid`: HttpOnly, SameSite=Lax, path `/`, vigencia coherente y Secure en producción HTTPS; desarrollo HTTP sigue funcionando.
- En un login correcto revocar el ID anterior presentado por ese navegador y crear el nuevo. No invalidar la sesión de otro navegador sólo por un login normal.
- En logout llamar efectivamente `destruirSesion()` y borrar cookie con opciones coherentes. Un ID revocado debe responder 401 en `/api/auth/yo`.
- Ante cambio efectivo de contraseña o rol revocar **todas las sesiones del usuario afectado**, incluida la actual si corresponde, sin afectar otros usuarios. Proveer a Homero un mecanismo coordinado por ID de usuario, sin duplicar lógica en sus rutas.
- Si falla la escritura de contraseña/rol, no informar éxito ni revocar por un cambio que no ocurrió. No reescribir la autenticación como consulta de usuario completa en cada petición.

Mantener contratos de `crearSesion()`, `obtenerSesion()`, `destruirSesion()` y `leerCookies()` compatibles con sus consumidores. El frontend recupera contexto anónimo o pide login después de una revocación; la respuesta exitosa del cambio conserva su formato.

## 6. Contratos funcionales que deben conservarse

| Operación | Contrato |
|---|---|
| POST `/api/auth/login` | JSON con credenciales; éxito 200, `{ mensaje, usuario }` y cookie `sid`; datos públicos sin password/hash |
| GET `/api/auth/yo` | `{ usuario }` para sesión válida; 401 si falta, venció o fue revocada |
| POST `/api/auth/logout` | 200 y mensaje después de revocar sesión y cookie; token CSRF conforme al contrato compartido |
| Cambio personal de contraseña | Sigue disponible con sesión válida, coordinado con Homero; respuesta segura y revocación posterior |
| Usuarios de prueba | Los helpers pueden crear hashes bcrypt de costo 12; el login debe verificarlos sin exigir que todos tengan costo 10 |

El login emite `sid` como primera cookie de esa respuesta: `cookieCruda()` toma el primer `Set-Cookie`. No hacer que una cookie CSRF nueva ocupe esa posición.

## 7. Dependencias y acuerdos con otros integrantes

**Matías:** aplicar el [contrato CSRF y sesiones](../planificacion-tp4.md#92-contrato-csrf-y-sesiones) antes de modificar login/sesiones. Se elige GET `/api/csrf-token`, candidato confirmado en los helpers pero aún no implementado, con `{ token }`. Matías asocia token a sesión válida o contexto anónimo; el token autenticado anterior deja de servir al revocar/cambiar `sid`. El frontend obtiene otro después del cambio.

Login es excepción al token sincronizador: acepta sólo `application/json`; rechaza formatos simples incompatibles con 415 y origen/Fetch Metadata cross-site con 403. Permite clientes sin cabeceras de navegador que envíen JSON, sin habilitar CORS ni detectar tests. Nicolás implementa esa restricción del login y coordina con Matías los controles compartidos, usando el origen local configurado exacto. **La seguridad y compatibilidad de la excepción quedan pendientes de verificación local.**

**Homero:** acordar entradas/resultados de `actualizar()` y `cambiarPassword()`, revocación por usuario y campos públicos antes de editar administración. Homero decide permisos de la ruta; Nicolás concentra hashing y sesión. La transición de hashes y la configuración del rol PostgreSQL son operaciones distintas, cada una con sus autorizaciones persistentes.

Contrato previsto: `actualizar(id, cambios)` recibe cambios parciales permitidos y hashea `password` sólo si se proporciona; `cambiarPassword(id, nuevaPassword)` recibe la nueva contraseña en claro para hashearla. Las escrituras exitosas devuelven usuario público sin contraseña/hash; usuario inexistente devuelve `null`. El servicio aplica la revocación por cambio efectivo de contraseña/rol después de confirmar la escritura; Homero no manipula el Map de sesiones ni duplica esa revocación en sus rutas.

## 8. Orden recomendado de tareas

1. Consultar línea base de Homero, inspeccionar entorno y cerrar la interfaz con Homero/Matías conforme al contrato documentado.
2. Centralizar hashing/comparación y resultados públicos; preparar transición idempotente y seed sin resetear cuentas.
3. Parametrizar login, aplicar mensajes uniformes y restricción JSON/origen sin romper clientes originales.
4. Corregir ID, cookies, vencimiento y revocación del ID anterior; integrar logout real.
5. Coordinar revocación por contraseña/rol y renovación CSRF/frontend.
6. Incorporar limitador y verificar sus umbrales con las baterías aisladas, cuando se autorice.
7. Validar caminos legítimos y resultados, revisar PR hacia `develop`; no imponer un orden de integración a consultas independientes.

## 9. Pruebas y criterios de aceptación

**Estado actual: No ejecutado.** Pruebas existentes: [auth](../../tests/auth.test.ts), [seguridad-login](../../tests/seguridad-login.test.ts), [seguridad-fuerza-bruta](../../tests/seguridad-fuerza-bruta.test.ts), [seguridad general](../../tests/seguridad.test.ts) y [checker](../../scripts/check-security.ts).

| ID | Pruebas relacionadas | Controles |
|---|---|---|
| 1 | Dos rechazos de SQL en login y autenticación legítima | SQLI-01/02, AUTH-03 |
| 11 | Todas las contraseñas almacenadas son bcrypt; autenticación funcional | AUTH-01/02/03 |
| 12 | Bloqueo dentro de diez solicitudes y comportamiento posterior | AUTH-04 |
| 13 | Cookie HttpOnly/SameSite y Secure por entorno | AUTH-05/06, CSRF-02 |
| 14 | Identificadores diferentes, no contadores y con longitud suficiente | AUTH-07/08 |
| 15 | No hay test dinámico dedicado existente | AUTH-09/10; comprobar vencimiento efectivo con verificación autorizada |
| 16 | ID anterior deja de autenticar tras logout; logout funcional 200 | AUTH-11 |
| 17 | Igual mensaje para cuenta inexistente/clave incorrecta; error sin HTML reflejado | AUTH-12; XSS-02 compartido |

Criterios adicionales: ejecutar transición dos veces sin doble hashing ni pérdida de cuentas; login válido sobre cuentas migradas; revocación sólo de sesiones afectadas; máximo absoluto de ocho horas; rotación CSRF después de login/logout/cambio de contraseña. No declarar cumplidos estos puntos mediante la sola presencia de patrones del checker.

Ejecutar las baterías oficiales y registrar evidencia según la [planificación](../planificacion-tp4.md#6-criterios-de-aceptación). Probar HTTP local y verificar Secure en HTTPS de producción cuando haya entorno autorizado. No modificar tests/helpers/checker ni cambiar la configuración para reconocerlos artificialmente.

## 10. Límites del alcance

Sin Redis, rediseño de autenticación, credenciales de producción o nueva política general de permisos. No cambiar cuentas de práctica exigidas ni aceptar texto plano permanentemente. No duplicar hashing en administración, modificar frontend o aplicar cambios persistentes sin coordinación/autorización.

Las advertencias sobre contraseñas de práctica triviales se registran como riesgo del entorno académico; no ampliar el bloque para resolverlas contra la decisión de conservar esas cuentas. No exponer valores en documentos o logs.

## 11. Checklist de avance

- [x] Línea base y estado persistente inspeccionados con autorización.
- [ ] Contratos con Matías/Homero respetados y ediciones compartidas coordinadas.
- [x] Hashing/comparación centralizados y respuestas sin credenciales derivadas.
- [x] Seed y transición idempotentes preparados y aplicados sólo con autorización.
- [x] Login parametrizado y errores uniformes.
- [x] Excepción JSON de login y controles de origen verificados localmente.
- [x] Cookies, ID aleatorio y vencimiento absoluto implementados y comprobados.
- [x] Logout y revocación por contraseña/rol integrados.
- [x] Limitador verificado dentro de diez solicitudes sin penalizar éxitos.
- [x] Baterías originales y casos legítimos autorizados registrados.
- [ ] PR hacia `develop` revisado con evidencia y reflexión por falla.

### Observación sobre el checker global — AUTH-02

El control `AUTH-02` informa que no encuentra el hasheo de contraseñas en `src/inicializar.ts`.

La implementación utiliza una función centralizada:

- `src/inicializar.ts` invoca `hashearPassword(usuario.password)` antes de insertar cada usuario.
- `src/services/usuarios.service.ts` implementa esa función mediante `bcrypt.hash(password, COSTO_HASH)`.

Por lo tanto, el hasheo está implementado, aunque el análisis estático del checker no reconoce la delegación entre archivos.

No se duplicó la implementación de bcrypt en el seed únicamente para satisfacer ese control.

**Estado:** implementación realizada; falso negativo probable del checker, pendiente de revisión con el equipo responsable del verificador.