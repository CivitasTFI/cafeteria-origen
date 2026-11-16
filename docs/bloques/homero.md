# Bloque de Homero — Administración e infraestructura

## 1. Responsable y objetivo

**Responsable:** Homero, también coordinador general. **Rama asignada:** `fix/administracion-infraestructura`, desde `develop`, todavía no creada en esta etapa.

Asegurar administración, archivos, procesos, diagnóstico, errores y PostgreSQL, conservando las funciones legítimas. La distribución y estrategia están aprobadas por el coordinador; **implementación y pruebas aún no comenzaron**. Esta guía debe leerse con la [planificación compartida](../planificacion-tp4.md).

## 2. Vulnerabilidades asignadas

| ID oficial | Vulnerabilidad | Referencia inicial |
|---|---|---|
| 10 | Subida insegura de archivos | `src/routes/admin.routes.ts:180–200` |
| 18 | Ausencia de autorización administrativa | `src/routes/admin.routes.ts:31` |
| 19 | Escalada mediante modificación de roles | `src/routes/admin.routes.ts:49–62` |
| 20 | Inyección de comandos | `src/routes/admin.routes.ts:149–160` |
| 21 | Diagnóstico con información sensible | `src/routes/debug.routes.ts:17–38` |
| 22 | Stack traces en respuestas | `src/middleware/errores.ts:24–31` |
| 24 | PostgreSQL con trust y aplicación superusuario | `docker-compose.yml`, `src/config.ts` y scripts SQL |

No se agregan ID principales ni tareas independientes a las 24 de la consigna.

## 3. Archivos previstos y propiedad

Propiedad principal:

- [Rutas administrativas](../../src/routes/admin.routes.ts), [diagnóstico](../../src/routes/debug.routes.ts), [errores](../../src/middleware/errores.ts) y [autorización](../../src/middleware/auth.ts).
- [Docker Compose](../../docker-compose.yml), [Dockerfile](../../Dockerfile) y [scripts de inicialización PostgreSQL](../../docker/initdb).
- [Ejemplo de entorno](../../.env.example), en coordinación con configuración común y sin secretos reales.

`src/config.ts` y `src/tipos.ts` requieren editor acordado por cambio. `usuarios.service.ts`, `sesion.ts`, `auth.routes.ts` e `inicializar.ts` pertenecen a Nicolás; `app.ts`, parsers y frontend a Matías. Comunicar primero cualquier necesidad de edición fuera del bloque. No crear nuevos scripts de aplicación/migración sin delimitar y autorizar su alcance.

## 4. Estado inseguro actual

- El router administrativo exige sesión pero no rol. `requiereRol()` existe y no se aplica allí.
- PUT de usuarios admite cambios de rol y contraseña; las respuestas pueden incluir `password`. El rol de una sesión es una copia que no se actualiza desde la base.
- La subida usa nombre del cliente y escribe sin verificar contenido, extensión ni límite decodificado. `/uploads` sirve esos archivos desde el mismo origen. Existe límite JSON global de 1 MiB; el parser local de 8 MiB no lo amplía para cuerpos ya procesados.
- Probar conexión concatena el destino en `exec()`, con shell.
- Diagnóstico público devuelve entorno/credenciales; errores devuelven mensaje técnico y stack.
- Compose configura trust y superusuario; el rol `origen_app` está previsto en SQL pero no es el usuario de conexión. Los valores efectivos de un volumen existente no fueron verificados.

## 5. Solución acordada

### Autorización y usuarios

Mantener `requiereSesion()` y aplicar `requiereRol('admin')` a gestión de usuarios/productos, subida y conexión. Conservar POST `/api/admin/cambiar-contrasena` para cualquier usuario autenticado que cambie su propia contraseña, con CSRF; no dejarla detrás de una restricción general de administrador.

La excepción personal debe registrarse antes de la barrera del resto del router o protegerse de modo equivalente. El resto del router debe rechazar también al cliente que consulta GET `/api/admin/productos`, aunque esa ruta no esté implementada: la prueba existente espera rechazo por permisos, no requiere agregar un listado nuevo.

En PUT `/api/admin/usuarios/:id`, permitir sólo `username`, `nombre`, `rol` y `password` según corresponda, validar ID y valores, rechazar campos no admitidos y roles fuera de `admin`, `barista`, `mozo`, `cliente`. Un cliente no puede cambiarse el rol. Invocar el servicio de Nicolás sin duplicar hashing y devolver sólo datos públicos. Tras cambio efectivo de contraseña o rol, Nicolás revoca las sesiones del usuario afectado; el frontend debe recuperar su contexto si pierde la sesión.

### Archivos

- Admitir sólo extensiones PNG, JPG/JPEG y WebP, coherentes con la firma y estructura del contenido. No confiar en MIME ni nombre declarados; rechazar SVG y otros formatos.
- Validar base64 y tamaño antes de escribir; máximo **512 KiB = 524288 bytes decodificados**. El base64 de ese tamaño cabe bajo el límite JSON global de 1 MiB con el cuerpo normal; comprobarlo en ejecución con Matías.
- Generar nombre criptográficamente aleatorio y extensión de la imagen validada. Resolver el destino y comprobar que permanece dentro de uploads; evitar sobrescrituras. Ninguna ruta relativa del cliente determina el archivo escrito.
- Conservar una URL servible y `bytes`; responder errores 4xx controlados. El parser global sigue siendo responsabilidad de Matías: no ampliar límites globales innecesariamente.

### Probar conexión

Conservar POST `/api/admin/probar-conexion`. Usar `execFile` o `spawn` con argumentos separados y shell deshabilitado; ejecutar únicamente el programa fijo de conexión. Allowlist exacta inicial: `127.0.0.1` y `::1`, sin DNS ni destinos externos arbitrarios.

Aplicar timeout inicial de 5 segundos y límite de salida de 64 KiB, finalizar el proceso si excede el límite y devolver una respuesta controlada. Comprobar programa disponible y soporte IPv6 en el contenedor durante la implementación; documentar cualquier ajuste por evidencia. Mantener los campos `comando`, `salida`, `error`; el texto de `comando` es informativo y no se entrega a shell.

### Diagnóstico y errores

Conservar GET `/api/_diagnostico` con sesión y rol admin explícitos en su router, permitiendo al checker verificar la protección. Responder sólo campos útiles no sensibles, como mensaje/versión del servicio; nunca `process.env`, credenciales ni un volcado de configuración. El healthcheck público permanece separado.

En errores conservar `{ error }`: 4xx deliberados con mensaje seguro, 500 genérico y detalle técnico registrado del lado servidor sin volcar credenciales o tokens. No incluir `stack` ni reflejar entrada/URL en los errores públicos. Coordinar mensajes de otras rutas con sus propietarios y los consumidores de Matías.

### PostgreSQL y persistencia

Eliminar trust y configurar autenticación por contraseña; la aplicación utiliza `origen_app`, sin superusuario y con permisos CRUD/secuencias necesarios. Mantener el puerto PostgreSQL sin publicar y conservar esquema/datos. Compose toma secretos de variables de ejecución privadas; `.env.example` contiene sólo valores no sensibles o marcadores, nunca claves reales. Retirar respaldos inseguros de `config.ts` y secretos fijos sin consumidor, coordinando los cambios comunes.

**Cambiar SQL de init o variables de Compose no migra un volumen ya inicializado.** Preparar dos recorridos: bootstrap de instalación nueva y aplicación controlada sobre volumen existente. Ambos deben transferir la contraseña privada al proceso de configuración de forma segura, sin SQL concatenado con secretos ni claves escritas en archivos versionados. El procedimiento debe verificar rol, permisos y autenticación, ser repetible sin pérdida de datos y no ejecutarse por el solo hecho de modificar documentación.

Antes de aplicar sobre datos existentes: inspección sin exponer valores, respaldo autorizado, procedimiento y recuperación revisables, autorización específica y verificación posterior. No borrar volumen ni base. Cambiar el usuario del contenedor es un endurecimiento complementario pendiente de autorización, no una exigencia nueva de este bloque.

## 6. Contratos funcionales que deben conservarse

Administración legítima de productos y usuarios; desactivación lógica del producto; cambio personal de contraseña con respuesta 200; subida con `{ mensaje, url, bytes }`; conexión con `{ comando, salida, error }`; errores con `error`. Las respuestas de usuarios conservan datos públicos, excluyendo contraseña y hash.

Pedidos y reportes mantienen acceso anónimo según el acuerdo global. No agregar relaciones usuario-pedido ni una política general nueva. La protección CSRF no sustituye al rol administrativo.

## 7. Dependencias y acuerdos con otros integrantes

- **Nicolás:** acordar antes de editar usuarios las entradas/resultados públicos de `actualizar()` y `cambiarPassword()`, hashing único y revocación por usuario. Coordinar transición de hashes y credenciales de base; son procedimientos diferentes.
- **Matías:** respetar el [contrato CSRF y sesiones](../planificacion-tp4.md#92-contrato-csrf-y-sesiones); acordar parsers, cabeceras, errores, subida y manejo de sesión revocada. Matías edita `app.ts` y ambos scripts.
- **Federico:** coordinar validadores comunes, IDs y errores sin alterar sus contratos de negocio.
- **Coordinación:** Homero registra la línea base compartida antes de cualquier implementación; su captura y la preparación Docker requieren la autorización correspondiente.

## 8. Orden recomendado de tareas

1. Registrar línea base y verificar el entorno cuando se autorice; relevar persistencia sin alterar datos.
2. Acordar contratos con Nicolás/Matías y separar cambio personal de las funciones admin.
3. Implementar permisos y edición de usuarios usando el servicio centralizado.
4. Corregir subida y ejecución del programa local, preservando caminos permitidos.
5. Proteger diagnóstico y normalizar errores con sus productores/consumidores.
6. Preparar configuración de PostgreSQL y procedimiento persistente; aplicar sólo con autorización específica.
7. Verificar y revisar PR hacia `develop`. Las partes independientes pueden avanzar en paralelo con otros bloques.

## 9. Pruebas y criterios de aceptación

**Estado actual: No ejecutado.** Referencias por lectura de [seguridad.test.ts](../../tests/seguridad.test.ts) y [checker](../../scripts/check-security.ts):

| ID | Prueba existente | Controles relacionados | Comprobación legítima adicional |
|---|---|---|---|
| 10 | Rechazo de archivos ejecutables y escritura fuera de uploads | VAL-04/05 | PNG/JPEG/WebP válidos; borde de 512 KiB, base64 inválido y nombre de servidor |
| 18 | Usuario sin admin no accede al panel/API administrativa | AUTH-14 | Admin permitido y cambio personal disponible a usuario autenticado |
| 19 | Usuario no se asigna admin | AUTH-15, recomendado | Petición con CSRF válido igualmente rechazada; admin edita según contrato y revoca sesión afectada |
| 20 | Dos pruebas de rechazo de comandos inyectados | CMD-01/02/03 | Destino loopback válido y errores/timeout/salida acotados |
| 21 | Diagnóstico no expone secretos | CFG-03/04 | Admin obtiene únicamente campos permitidos; anónimo/cliente rechazados |
| 22 | API no devuelve stack | VAL-06; XSS-02 en errores | Alcanzar un error real con solicitud válida, sin quedar bloqueado antes por CSRF |
| 24 | Aplicación no se conecta como superusuario | SQLI-03/04/05; CFG-02 | Contraseña exigida, CRUD permitido y permisos administrativos de base ausentes |

Preservar [auth.test.ts](../../tests/auth.test.ts) y pruebas funcionales de catálogo/reportes. Tras autorización, ejecutar las baterías oficiales descritas en [Cómo comenzar a trabajar](../planificacion-tp4.md#12-cómo-comenzar-a-trabajar). No considerar suficiente un test verde causado por un rechazo previo que no alcanza la falla; validar acciones autorizadas y efectos persistentes.

## 10. Límites del alcance

No modificar tests, helpers o checker. No duplicar hashing, reemplazar autenticación, incorporar ORM o habilitar destinos externos. No subir el PDF ni secretos. No cambiar permisos generales de pedidos/reportes ni hacer endurecimientos independientes sin autorización.

No iniciar Docker, aplicar migraciones, transformar datos o borrar persistencia durante esta etapa documental. Las cuentas locales requeridas por la consigna se conservan; no se documentan aquí sus contraseñas. Informar un conflicto de rúbrica si no puede resolverse correctamente con las verificaciones intactas.

## 11. Checklist de avance

- [ ] Línea base registrada y entorno/persistencia relevados con autorización.
- [ ] Interfaz de usuarios y contrato CSRF coordinados.
- [ ] Autorización admin y cambio personal diferenciados.
- [ ] Roles/campos validados y revocación integrada sin hashing duplicado.
- [ ] Imágenes y límites validados; ruta contenida y URL utilizable.
- [ ] Conexión local sin shell y con recursos acotados verificada.
- [ ] Diagnóstico protegido y errores sin datos sensibles.
- [ ] Configuración y procedimiento PostgreSQL revisados; ejecución persistente autorizada por separado.
- [ ] Pruebas autorizadas y caminos legítimos registrados sin alterar la rúbrica.
- [ ] PR hacia `develop` revisado, con causa, evidencia local, corrección y reflexión por falla.
