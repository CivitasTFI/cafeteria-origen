# Planificación — Cafetería Origen TP4

## 1. Introducción

El TP4 de Ciberseguridad de Programación IV — Redes y Seguridad consiste en identificar, explicar y corregir vulnerabilidades de Cafetería Origen sin romper su comportamiento legítimo. Se trabaja sobre el código deliberadamente vulnerable proporcionado por el profesor, en el fork `CivitasTFI/cafeteria-origen`. Este repositorio es independiente de los proyectos desarrollados durante los TP anteriores.

**La distribución y la estrategia de implementación fueron aprobadas por el coordinador, Homero.** Esta versión documenta esos acuerdos y las especificaciones individuales. La implementación aún no comenzó y las pruebas no se ejecutaron; las operaciones de código, infraestructura y Git se autorizarán en sus respectivas etapas.

Fuentes utilizadas:

- Consigna oficial: PDF `tp4 - ciberseguridad.pdf`, incluido en el repositorio.
- [README](../README.md), [guía práctica](../GUIA-PRACTICA.md) y [catálogo de vulnerabilidades](../VULNERABILIDADES.md).
- Código real de [la aplicación](../src/app.ts), rutas, servicios, middleware, frontend e infraestructura.
- [Pruebas funcionales y de seguridad](../tests), [helpers](../tests/helpers.ts), [scripts de npm](../package.json) y [checker estático](../scripts/check-security.ts).
- Auditoría técnica previa por inspección, disponible como antecedente en la conversación de trabajo.

**Hechos confirmados por lectura:** backend en TypeScript con Express y PostgreSQL; frontend en HTML y JavaScript; Docker Compose define aplicación y base. La aplicación mantiene sesiones en memoria y sirve la API y los archivos estáticos desde Express. La auditoría localizó las implementaciones inseguras de las 24 fallas; la configuración efectiva de una base existente y los resultados de ejecución no fueron comprobados.

## 2. Alcance

El alcance definitivo comprende **exactamente las 24 vulnerabilidades de la consigna oficial**. Los ID de esta matriz corresponden a esa consigna, no a la numeración `VUL-*` del catálogo complementario. Cada falla tiene un único responsable aprobado; los estados describen inspección, no correcciones verificadas.

| ID | Vulnerabilidad | Responsable | Estado | Dependencias |
|---|---|---|---|---|
| 1 | Inyección SQL en el login | Nicolás | Auditada, pendiente de corrección | 11, 12 y 17; servicio de usuarios y contrato de login |
| 2 | Inyección SQL en filtros del catálogo | Federico | Auditada, pendiente de corrección | Validación de filtros; coordinación con 5 para respuestas seguras |
| 3 | Inyección SQL en filtro de pedidos por mesa | Federico | Auditada, pendiente de corrección | 9; acceso anónimo conservado |
| 4 | Inyección SQL en reporte por origen | Federico | Auditada, pendiente de corrección | Orígenes permitidos; acceso anónimo conservado |
| 5 | XSS reflejado en buscador y mensajes de error | Matías | Auditada, pendiente de corrección | 7, 17, 22 y 23; productores de mensajes en backend |
| 6 | XSS almacenado en reseñas | Matías | Auditada, pendiente de corrección | 23; coordinación sobre validación complementaria de reseñas |
| 7 | XSS de DOM en panel administrativo | Matías | Auditada, pendiente de corrección | 5 y 23; conservación de tablas y eventos |
| 8 | CSRF en formularios y operaciones que modifican estado | Matías | Auditada, pendiente de corrección | 13–16; contexto anónimo, login/logout y clientes de la API |
| 9 | Validación insuficiente de cantidades y pedidos | Federico | Auditada, pendiente de corrección | 3, 8 y 22; límites e integridad de escritura |
| 10 | Subida de archivos sin validación suficiente | Homero | Auditada, pendiente de corrección | 8, 18 y 23; parsers, almacenamiento y permisos |
| 11 | Contraseñas almacenadas en texto plano | Nicolás | Auditada, pendiente de corrección | 1 y 19; todas las escrituras de contraseñas y datos existentes |
| 12 | Ausencia de protección contra fuerza bruta | Nicolás | Auditada, pendiente de corrección | 1, 11 y 17; aislamiento de pruebas de login |
| 13 | Cookie de sesión sin configuración segura | Nicolás | Auditada, pendiente de corrección | 8 y 16; diferencias entre HTTP local y HTTPS de producción |
| 14 | Identificadores de sesión predecibles | Nicolás | Auditada, pendiente de corrección | 8, 15 y 16; creación y revocación de sesiones |
| 15 | Sesiones sin expiración | Nicolás | Auditada, pendiente de corrección | 14 y 16; tipos, vigencia y lectura de sesiones |
| 16 | Logout sin invalidación de sesión en el servidor | Nicolás | Auditada, pendiente de corrección | 8 y 13–15; destrucción de sesión y cookie |
| 17 | Enumeración de usuarios mediante respuestas del login | Nicolás | Auditada, pendiente de corrección | 1, 5, 11 y 12; errores públicos uniformes |
| 18 | Ausencia de autorización administrativa | Homero | Auditada, pendiente de corrección | Sesiones de Nicolás; 19 y política de permisos |
| 19 | Escalada de privilegios mediante modificación de roles | Homero | Auditada, pendiente de corrección | 11 y 18; servicio de usuarios y roles en sesiones abiertas |
| 20 | Inyección de comandos en probar conexión | Homero | Auditada, pendiente de corrección | 8 y 18; destinos permitidos y ejecución del proceso |
| 21 | Exposición de secretos mediante diagnóstico | Homero | Auditada, pendiente de corrección | 18; contrato de diagnóstico y checklist |
| 22 | Exposición de stack traces al cliente | Homero | Auditada, pendiente de corrección | 5 y 9; errores de validación y consumidores del frontend |
| 23 | Ausencia de cabeceras de seguridad y CSP | Matías | Auditada, pendiente de corrección | 5–7, 10 y 13; archivos estáticos y navegación local |
| 24 | PostgreSQL configurado con trust y superusuario para la aplicación | Homero | Auditada, pendiente de corrección | Configuración, rol de aplicación, credenciales e inicialización persistente |

Las dependencias pueden representar coordinación y archivos compartidos; no implican que todas las correcciones deban ejecutarse en secuencia.

### Observaciones complementarias y límites

Las 28 entradas de `VULNERABILIDADES.md` no equivalen a cuatro tareas nuevas independientes: el catálogo también separa los dos XSS reflejados. No se incorporan ID adicionales a la matriz principal.

| Observación por inspección | Tratamiento dentro del alcance definitivo |
|---|---|
| `catalogo.service.ts` también interpola el ID de producto | Directamente relacionado con las consultas del catálogo; Federico debe contemplarlo al especificar la falla 2, sin crear una vulnerabilidad principal adicional |
| El alta de pedidos inserta cabecera e ítems sin transacción | Dependencia de 9: transacción por pedido sobre una única conexión, sin sustituir `pg` ni la capa de datos |
| Las reseñas no tienen validación completa de longitud o calificación | Dependencia acotada de 6 y de la aceptación obligatoria: Matías coordina con Federico validación conforme al formulario existente; no se crea otra vulnerabilidad principal |
| Hay credenciales predeterminadas y secretos fijos en configuración | Conservar cuentas locales de práctica con hashes como parte de 11; sacar secretos de ejecución del código/Compose como parte de 24 y CFG-02, sin publicar valores |
| Pedidos y reportes se consultan sin sesión; hay modificaciones públicas fuera de administración | Mantener el acceso actual en esta entrega, añadiendo la protección CSRF correspondiente. Registrar exposición de datos y autorización residual; no agregar relaciones usuario-pedido ni política general de permisos |
| Las respuestas administrativas pueden incluir `password` | Dependencia de 11/19: Nicolás define resultados públicos sin contraseñas ni hashes y Homero los utiliza |
| El Dockerfile no declara `USER` | Endurecimiento complementario recomendado por el checker; no constituye una implementación ya aprobada |

Las dependencias anteriores se tratan dentro de las fallas oficiales relacionadas, sin convertirse en tareas independientes. Cualquier ampliación adicional requiere autorización. No se agregan funcionalidades ajenas al TP4.

## 3. Integrantes y responsabilidades

**Distribución definitiva aprobada por el coordinador.** Homero coordina el trabajo y el seguimiento de dependencias, además de su bloque técnico. La cantidad de fallas no representa por sí sola el esfuerzo: autenticación y frontend tienen cambios transversales; negocio concentra integridad y regresión de cálculos.

### 3.1. Homero — Administración e infraestructura

Guía de desarrollo: [especificación de Homero](bloques/homero.md).

- **Objetivo:** restringir operaciones administrativas y asegurar archivos, procesos, diagnóstico, errores y conexión a PostgreSQL.
- **Vulnerabilidades:** 10, 18, 19, 20, 21, 22 y 24.
- **Archivos principales:** `src/routes/admin.routes.ts`, `src/routes/debug.routes.ts`, `src/middleware/errores.ts`, `src/middleware/auth.ts`, `docker-compose.yml`, `Dockerfile`, `src/config.ts`, `.env.example` y `docker/initdb/*`, según el alcance que se apruebe en cada especificación.
- **Dependencias:** con Nicolás, servicio de usuarios, hashing, roles y sesiones; con Matías, CSRF, formularios, errores y parsers; con Federico, validadores reutilizables y errores de entrada. Coordinar credenciales y permisos de inicialización con Nicolás.
- **Riesgos:** bloquear funciones personales al restringir todo el router; dejar roles antiguos en sesiones; escribir fuera de uploads; desajustar permisos de archivos o credenciales de un volumen existente; alterar una función para satisfacer únicamente el checker.
- **Aceptación particular:** usuarios sin permiso rechazados y administrador legítimo operativo; roles modificables sólo según política aprobada; archivos válidos utilizables y archivos inválidos rechazados sin escritura fuera del destino; conexión permitida sin shell; diagnóstico sin secretos; errores sin stack; aplicación conectada con el rol y autenticación de base acordados. Revisar pruebas relacionadas de `seguridad.test.ts` y controles VAL-04/05/06, AUTH-14/15, CMD, CFG y SQLI-03/04/05 según corresponda.
- **Exclusiones:** no implementar hashing dentro del router por separado del servicio de Nicolás; no redefinir sesiones ni reescribir frontend sin acuerdo; no aplicar migraciones o cambios de volumen por esta planificación. El usuario no root es una observación pendiente, no una tarea automáticamente autorizada.

### 3.2. Federico — Consultas e integridad del negocio

Guía de desarrollo: [especificación de Federico](bloques/federico.md).

- **Objetivo:** asegurar las consultas de catálogo, pedidos y reportes y validar el alta de pedidos conservando las reglas de negocio.
- **Vulnerabilidades:** 2, 3, 4 y 9. Contemplar también los problemas directamente relacionados con consultas del catálogo e integridad de pedidos indicados en alcance.
- **Archivos principales:** `src/services/catalogo.service.ts`, `src/services/pedidos.service.ts`, `src/services/reportes.service.ts` y las rutas de productos, pedidos y reportes. Un módulo común de validación o cambios en `src/db.ts` son posibilidades que deben delimitarse antes de implementarse.
- **Dependencias:** con Matías, formatos de entrada/salida, errores, pedido y transporte CSRF; con Homero, errores públicos, permisos y validadores compartidos. Matías coordina la validación de reseñas como dependencia de 6; Federico acuerda los validadores antes de editar su ruta o servicio.
- **Riesgos:** cambiar la búsqueda legítima al parametrizar, rechazar filtros válidos, producir pedidos parciales o modificar cálculos/reportes; imponer autorización sobre endpoints que los tests consultan sin sesión.
- **Aceptación particular:** consultas afectadas parametrizadas; filtros combinados, búsqueda y detalle de producto conservados; pedidos inválidos rechazados de manera controlada; cantidades y estructura válidas con totales correctos; integridad de escritura resuelta según la especificación aprobada. Preservar `productos.test.ts`, `pedidos.test.ts` y `reportes.test.ts`; revisar controles SQLI-01/02 y VAL-01/02/03 y pruebas relacionadas de seguridad.
- **Exclusiones:** login y contraseñas; decisiones unilaterales de autorización; nuevas funcionalidades del negocio; incorporación automática de la validación de reseñas como una quinta vulnerabilidad principal.

### 3.3. Nicolás — Autenticación, contraseñas y sesiones

Guía de desarrollo: [especificación de Nicolás](bloques/nicolas.md).

- **Objetivo:** mantener un único criterio de autenticación, hashing, creación, vencimiento y revocación de sesiones.
- **Vulnerabilidades:** 1, 11, 12, 13, 14, 15, 16 y 17.
- **Archivos principales:** `src/services/usuarios.service.ts`, `src/routes/auth.routes.ts`, `src/middleware/sesion.ts`, `src/inicializar.ts` y tipos/configuración relacionados. Las ediciones de `src/tipos.ts` y `src/config.ts` deben coordinarse previamente.
- **Dependencias:** con Homero, actualizaciones administrativas, datos públicos de usuario, permisos y PostgreSQL; con Matías, cookies, contexto CSRF, login/logout y orden de middleware.
- **Riesgos:** dejar cuentas existentes en texto plano; doble hashing o comparación incompatible; perder cookies en HTTP local; conservar sesiones antiguas tras login/logout; renovar un token incompatible con el cliente; interferir con los tests mediante el limitador.
- **Aceptación particular:** credenciales válidas siguen funcionando, inválidas no autentican ni enumeran; todas las escrituras de contraseñas incluidas en el alcance usan el criterio acordado; cookies apropiadas por entorno; identificadores impredecibles; expiración efectiva; logout revoca el acceso del servidor. Preservar `auth.test.ts` y revisar `seguridad-login.test.ts`, `seguridad-fuerza-bruta.test.ts`, pruebas de sesiones y controles AUTH-01 a AUTH-12 y SQLI-01/02. La expiración requiere verificación adicional: no tiene un test dinámico dedicado existente.
- **Exclusiones:** permisos administrativos específicos de Homero, protección DOM/CSP de Matías y operaciones directas sobre una base persistente sin autorización. Diseñar la transición de contraseñas no autoriza ejecutarla ni resetear datos.

### 3.4. Matías — Frontend, CSRF y cabeceras

Guía de desarrollo: [especificación de Matías](bloques/matias.md).

- **Objetivo:** representar datos de forma segura y proteger las solicitudes que modifican estado, preservando la interfaz legítima.
- **Vulnerabilidades:** 5, 6, 7, 8 y 23.
- **Archivos principales:** `src/public/js/app.js`, `src/public/js/admin.js`, `src/app.ts`, HTML necesario y el middleware CSRF que se acuerde. La creación de ese middleware pertenece a una futura implementación aprobada.
- **Dependencias:** con Nicolás, sesiones, cookies, login/logout y contexto anónimo; con Homero, operaciones administrativas, subidas, parsers y mensajes de error; con Federico, contratos de productos/pedidos/reportes y validación acotada de reseñas como dependencia de 6.
- **Riesgos:** romper delegación de eventos, atributos `data-*`, tablas o formularios; impedir pedidos anónimos; perder tokens tras cambios de sesión; bloquear navegación HTTP por una CSP inadecuada; asumir que CSP corrige por sí sola XSS.
- **Aceptación particular:** texto no confiable sin inserción insegura en el DOM; catálogo, carrito, reseñas y panel conservan su comportamiento; operaciones protegidas rechazan solicitudes inválidas y aceptan solicitudes legítimas; CSP y cabeceras compatibles con recursos locales. Revisar pruebas XSS/CSRF/cabeceras de `seguridad.test.ts` y controles XSS-01/02/03, CSRF y CFG-01, además de navegación manual autorizada.
- **Exclusiones:** cambiar por su cuenta contraseñas, roles, acceso a datos o reglas del negocio; editar errores de otros bloques sin acuerdo; implementar validación de reseñas fuera del alcance aprobado. Coordina la falla 5, pero los cambios de mensajes en archivos de otros integrantes deben acordarse con su editor responsable.

## 4. Organización de Git

| Rama | Propósito |
|---|---|
| `main` | Versión estable y entregable |
| `develop` | Integración revisada del equipo |
| `docs/planificacion-tp4` | Planificación y documentación inicial; rama actual verificada |
| `fix/*` | Implementación acotada por bloque, partiendo de `develop` |

Ramas asignadas para la implementación, **todavía no creadas durante esta etapa**:

| Integrante | Rama prevista |
|---|---|
| Homero | `fix/administracion-infraestructura` |
| Federico | `fix/consultas-validacion-negocio` |
| Nicolás | `fix/autenticacion-sesiones` |
| Matías | `fix/frontend-csrf-cabeceras` |

Flujo previsto, sujeto a revisión y autorización de las operaciones correspondientes:

1. Partir de `develop` para crear la rama específica.
2. Implementar exclusivamente el bloque y la etapa autorizados.
3. Ejecutar las verificaciones correspondientes cuando estén autorizadas.
4. Revisar diferencias, alcance, contratos y evidencia.
5. Crear un pull request hacia `develop`.
6. Integrar únicamente después de revisión y resolución coordinada de dependencias.
7. Pasar de `develop` a `main` cuando la solución completa esté validada.

No implementar directamente en `main` o `develop` sin instrucciones explícitas. Este flujo no implica que Codex pueda crear ramas, hacer staging, commits, pushes o merges. No se realizó ninguna de esas operaciones al crear esta planificación.

## 5. Dependencias y coordinación

Los propietarios principales quedan establecidos para reducir conflictos; la etapa actual sigue siendo documental. La propiedad admite ampliaciones justificadas y coordinadas, no ediciones simultáneas sin acuerdo.

| Interfaz compartida | Participantes | Acuerdo necesario |
|---|---|---|
| Servicio de usuarios y rutas administrativas | Nicolás y Homero | Nicolás concentra `usuarios.service.ts`, `auth.routes.ts`, `sesion.ts` y `inicializar.ts`; Homero consume hashing centralizado y respuestas públicas desde `admin.routes.ts`, y coordina revocación por contraseña/rol |
| Sesiones, cookies y CSRF | Nicolás y Matías | Nicolás mantiene el ciclo de sesión; Matías, middleware CSRF y clientes. Aplicar el contrato de la sección 9.2 antes de modificar ambos bloques |
| Operaciones administrativas, errores y formularios | Homero y Matías | Homero concentra `admin.routes.ts`, `debug.routes.ts`, `errores.ts` y `middleware/auth.ts`; Matías, ambos scripts públicos, HTML y `app.ts`. Mantener `error`, estados HTTP seguros y parsers compatibles |
| Consultas, entradas y comportamiento de interfaz | Federico y Matías | Federico concentra servicios y rutas de productos, pedidos y reportes; Matías preserva sus consumidores. Coordinar la dependencia de reseñas sin ampliar la matriz |
| PostgreSQL, credenciales e inicialización | Homero y Nicolás | Homero concentra Compose y scripts SQL; Nicolás, seed de aplicación. Distinguir creación de esquema, carga de datos y transición de contraseñas sobre un volumen existente |
| Configuración y tipos comunes | Homero, Nicolás, Matías y Federico según el cambio | Acordar previamente cambios en `src/config.ts` y `src/tipos.ts`; asignar un único editor por cambio y comunicar el contrato resultante |
| Validadores y errores seguros | Federico, Homero y Matías; Nicolás para login | Acordar utilidades y mensajes sin duplicar reglas ni convertir validación de entrada en escape de salida |

Reglas de coordinación:

1. Antes de iniciar una tarea, indicar archivos, dependencia y contrato afectado en su especificación o PR.
2. Un archivo compartido tiene un editor acordado durante cada cambio; los demás coordinan primero la modificación necesaria.
3. Evitar reformatos generales y cambios de nombres que dificulten revisar diferencias.
4. Homero registra primero la línea base compartida. Después Federico puede avanzar con consultas independientes del login; Nicolás/Matías respetan el contrato CSRF y Homero/Nicolás coordinan usuarios antes de cambios administrativos.
5. Registrar cualquier ampliación o cambio de contrato y obtener aprobación antes de implementarlo.
6. Tras integrar cambios de otro bloque, revisar el comportamiento combinado y ejecutar las pruebas autorizadas pertinentes: una integración automática de Git no garantiza compatibilidad funcional.

Contratos a preservar salvo decisión aprobada: catálogo con `{ productos, filtros, total }`; pedido creado con `201`, total calculado en servidor e ítems; reportes con sus envoltorios actuales; login y `/auth/yo` con `usuario`; errores públicos con `error`. El precio se calcula como `gramos × precio_por_gramo + precio_base`; el total del pedido suma precio por cantidad. Borrar un producto actualmente lo desactiva.

## 6. Criterios de aceptación

| Verificación obligatoria | Condición final exigida |
|---|---|
| `npm test` | Todas las pruebas funcionales aprueban y se conserva el comportamiento legítimo |
| `npm run test:seguridad` | Todas las pruebas de seguridad aprueban, revisando que alcancen el comportamiento evaluado |
| `npm run check:security` | Todos los controles críticos aprueban; registrar por separado los recomendados pendientes |

Verificaciones complementarias previstas:

- `npm run test:todo`: baterías combinadas.
- `npm run typecheck`: chequeo TypeScript; el script existe en `package.json`.
- Recorrido manual legítimo: catálogo y filtros, carrito, alta de pedido, reseña, login, acciones administrativas permitidas, reportes y logout.
- Revisión de cambios con `git status --short`, `git diff` y revisión humana de PR.

**Las pruebas y el checker todavía no fueron ejecutados en esta etapa.** La consigna espera funcionales en verde al inicio y al final, y seguridad/checklist en rojo inicialmente y verde al final; esas expectativas no reemplazan la línea base real pendiente.

No modificar ni debilitar pruebas, helpers o checker sin autorización. Los resultados automáticos deben acompañarse de revisión del código y de caminos legítimos: un rechazo previo por CSRF o permisos puede impedir que una prueba llegue a la validación, autorización o manejador de errores que pretende evaluar. No agregar referencias artificiales para satisfacer expresiones regulares del checker.

## 7. Línea base y seguimiento de pruebas

Completar esta tabla sólo después de ejecuciones autorizadas. Registrar fechas reales y observaciones del entorno; si las ejecuciones inicial y final ocurren en fechas diferentes, indicar ambas en la misma celda. Hasta entonces no se informa ninguna batería como aprobada o fallida.

| Comando | Resultado inicial | Resultado final | Fecha de ejecución | Observaciones |
|---|---|---|---|---|
| `npm test` | No ejecutado | No ejecutado | — | Pendiente de entorno y autorización |
| `npm run test:seguridad` | No ejecutado | No ejecutado | — | Pendiente de entorno y autorización |
| `npm run check:security` | No ejecutado | No ejecutado | — | Lectura de su configuración realizada; script sin ejecutar |
| `npm run test:todo` | No ejecutado | No ejecutado | — | Verificación complementaria pendiente |
| `npm run typecheck` | No ejecutado | No ejecutado | — | Verificación complementaria pendiente |

**Las pruebas pueden modificar registros de PostgreSQL y, sobre la versión vulnerable, escribir archivos mediante la subida.** Deben ejecutarse exclusivamente en un entorno local apropiado, con preservación de la información necesaria y autorización para las acciones correspondientes.

Los tests utilizan `node:test` y Supertest, importan Express y requieren PostgreSQL con el esquema ya creado; no necesitan que el servidor de la aplicación atienda en el puerto publicado. `prepararBase()` carga datos pero no crea tablas. Los archivos de tests se ejecutan con concurrencia uno y procesos separados, aunque comparten la base.

La limpieza de seguridad se limita a registros identificados por marcas y usuarios de prueba; no equivale a restaurar todos los datos o archivos. Las pruebas funcionales dejan registros, y la prueba de catálogo espera veinte productos activos. No borrar el volumen para resolver fallos sin autorización.

Mantener separados los archivos de pruebas de login y fuerza bruta para evitar interferencias del estado del limitador. El checker analiza texto y no sustituye la verificación funcional o la revisión de seguridad.

## 8. Etapas del proyecto

| Etapa | Estado | Resultado o condición para avanzar |
|---|---|---|
| 1. Auditoría inicial | Completada por inspección | Arquitectura, fallas y dependencias identificadas; sin validación de ejecución |
| 2. Planificación y distribución | Distribución y estrategia aprobadas; documentación preparada para revisión | Revisar y publicar documentación mediante operaciones Git autorizadas por separado |
| 3. Preparación del entorno y línea base de pruebas | Pendiente | Autorizar preparación local y registrar resultados reales sin eliminar información por defecto |
| 4. Especificaciones por bloque | Redactadas; implementación pendiente | Consultar las cuatro guías y coordinar interfaces antes de editar código |
| 5. Implementación | Pendiente | Ejecutar sólo tareas y etapas aprobadas |
| 6. Integración grupal | Pendiente | Revisar PR hacia `develop` y verificar compatibilidad entre bloques |
| 7. Verificación integral | Pendiente | Cumplir baterías obligatorias y controles funcionales acordados |
| 8. Documentación de evidencias y entrega | Pendiente | Documentar correcciones y resultados reales y confirmar entregables oficiales |

No se establecen fechas sin acuerdo del equipo. La lectura de código no completa ninguna etapa de implementación ni de verificación dinámica.

## 9. Decisiones técnicas y validaciones pendientes

### 9.1. Estrategia acordada

| Área | Decisión de implementación |
|---|---|
| SQL y negocio | `pg` con parámetros `$1`, `$2`, etc.; incluir consulta por ID del catálogo. Conservar búsqueda, filtros, orden y respuestas. Cantidades enteras 1–100; 1–50 ítems; validar producto existente y activo. Transacción por pedido sobre un único cliente del pool. Sin ORM |
| Contraseñas | `bcryptjs` centralizado en servicio de usuarios, costo inicial 10. Conservar cuentas locales de práctica con hashes. Transición idempotente del texto plano existente, sin doble hashing ni reseteos; login sólo con comparación bcrypt. Ninguna respuesta expone contraseña o hash |
| Fuerza bruta | `express-rate-limit`, ventana de 15 minutos, sin penalizar accesos exitosos. Ajuste mínimo a **9 intentos fallidos por IP**: `seguridad-fuerza-bruta.test.ts` exige observar bloqueo dentro de diez solicitudes; permitir diez y bloquear la undécima no cumple ese contrato. Validar el comportamiento real posteriormente |
| Sesiones | Memoria del proceso, ID criptográfico, vencimiento absoluto de ocho horas verificado al consultar; HttpOnly y SameSite=Lax, Secure en producción HTTPS. Revocar el ID anterior en nuevo login y todas las sesiones del usuario tras cambio efectivo de contraseña o rol; logout destruye sesión y cookie |
| CSRF | Token sincronizador en memoria por contexto anónimo o sesión válida; contrato de la sección 9.2. No exigir login para pedidos/reseñas. Login JSON con controles compensatorios de origen/Fetch Metadata |
| XSS y cabeceras | Nodos y `textContent`, preservando eventos/atributos. Helmet antes de estáticos y rutas; CSP con `script-src 'self'`, `connect-src 'self'`, `object-src 'none'`, recursos locales y favicon `data:`. No forzar HTTPS en desarrollo HTTP |
| Autorización | Backend exige `admin` para gestión; cambio de la propia contraseña conserva acceso con sesión válida y CSRF. Roles permitidos: admin, barista, mozo y cliente; no autoescalada. Pedidos/reportes mantienen acceso anónimo y no se diseña una política general nueva |
| Archivos | Sólo PNG/JPEG/WebP, extensión y contenido real coherentes, máximo 512 KiB decodificados. Nombre generado y destino contenido en uploads. Rechazar SVG/contenido activo y mantener URL utilizable; preservar JSON global de 1 MiB |
| Conexión | `execFile` o `spawn` sin shell, argumentos separados, destinos exactos de loopback `127.0.0.1` y `::1` del contenedor app; tiempo máximo inicial 5 s y salida acotada a 64 KiB. Para diagnosticar la red hacia PostgreSQL puede acordarse además el literal `db` en la allowlist, sin hosts arbitrarios. Verificar disponibilidad del comando y soporte IPv6 en el contenedor |
| Diagnóstico y errores | Conservar `/api/_diagnostico` protegido por sesión y admin, con lista mínima de campos no sensibles; así se conserva función útil y el checker puede verificar protección en su archivo. Errores públicos con `error`, sin stack ni detalles técnicos; detalle sólo en logs seguros |
| PostgreSQL | Quitar trust, autenticación por contraseña y rol `origen_app` sin superusuario. Variables de entorno y ejemplo sin secretos; retirar valores sensibles fijos sin uso. Preservar esquema/datos. Bootstrap y transición idempotentes; aplicar sobre volumen existente sólo con autorización específica |

Los valores se contrastaron con las pruebas y formularios por lectura; no se comprobó rendimiento ni compatibilidad en ejecución. Las bibliotecas mencionadas ya están declaradas. `src/config.ts`, `src/tipos.ts` y cualquier validador compartido requieren un editor acordado por cambio.

### 9.2. Contrato CSRF y sesiones

Este contrato es previo a la implementación de Nicolás y Matías. Se elige **GET `/api/csrf-token` con respuesta `{ token }`**: es una ruta buscada por `tests/helpers.ts` y `tests/seguridad.test.ts`; todavía no existe en la aplicación. No se crean variantes de endpoints innecesarias.

1. **Contexto:** Matías mantiene tokens criptográficos en memoria del servidor. Para un usuario autenticado los vincula al `sid` que `obtenerSesion()` considera válido. Para un visitante crea un contexto aleatorio independiente mediante cookie `csrf`, HttpOnly, SameSite=Lax y Secure por entorno; no es una sesión autenticada. La cookie contiene el identificador del contexto, no reemplaza la verificación del token del servidor.
2. **Vigencia:** token estable durante su contexto, con máximo de ocho horas y sin superar la vigencia de su sesión autenticada. Contextos vencidos se rechazan y limpian. Un token de otro contexto no es válido. La respuesta de obtención lleva `Cache-Control: no-store` y se entrega sólo al mismo origen.
3. **Transporte:** preferir `X-CSRF-Token` en `fetch`; aceptar `_csrf` en el cuerpo para los helpers. Admitir `_csrf` en query exclusivamente para DELETE por compatibilidad con `deleteConToken()`, evitando registrar esa URL/token. Si se reciben valores diferentes por varios transportes, rechazar. Tras validarlo, separar `_csrf` de los campos de negocio antes de aplicar sus listas de campos permitidos; no enviarlo a servicios ni persistirlo. GET/HEAD/OPTIONS no cambian datos del negocio ni requieren token.
4. **Operaciones protegidas:** POST/PUT/PATCH/DELETE de pedidos, comentarios, administración y logout validan token antes de ejecutar sus acciones. En peticiones autenticadas no aceptar como sustituto un token anónimo. Validar también el origen cuando esté presente y rechazar `Sec-Fetch-Site: cross-site`; no habilitar CORS de origen cruzado.
5. **Excepción de login:** POST `/api/auth/login` acepta sólo `application/json` y no exige el token sincronizador. Los tests de login/seguridad envían JSON directamente sin token. Rechazar formularios simples y tipos incompatibles con `415`; rechazar Origin ajeno y Fetch Metadata cross-site con `403`. Clientes sin esas cabeceras, como Supertest, pueden enviar JSON; no se autoriza por su User-Agent ni por detectar tests. La allowlist de origen comprende la URL local configurada, con esquema, host y puerto exactos; no reflejar cualquier Origin ni confiar en él como permiso. No permitir preflight/CORS para otros orígenes.
6. **Rotación:** Nicolás mantiene `leerCookies()`, `crearSesion()`, `obtenerSesion()` y `destruirSesion()` con contratos compatibles. Al cambiar `sid` o revocar sesiones, el token autenticado anterior pierde validez. Matías obtiene token de nuevo tras login, logout, vencimiento o cambio de contraseña que cierre la sesión. El frontend recupera contexto antes de permitir otra escritura; no reintenta automáticamente operaciones que puedan duplicarse.
7. **Cookies y orden:** el login devuelve `sid` como primera cookie de su respuesta: `cookieCruda()` inspecciona la primera `Set-Cookie`. La cookie anónima se emite al obtener el token y no debe adelantar otra cookie al `sid` del login. En producción Secure es obligatorio; la compatibilidad de agentes HTTP locales se valida en desarrollo, sin falsificar atributos para tests.
8. **Integración:** Matías coloca protección tras los parsers y antes de las escrituras; Nicolás implementa la excepción de login en coordinación con esos controles. Homero conserva autorización específica y no usa CSRF como sustituto del rol. No agregar bypass por entorno de pruebas.

La excepción de login y la integración completa **no se declaran seguras ni compatibles por anticipado**: requieren verificación local posterior de solicitudes legítimas, rechazos de origen cruzado y pruebas originales intactas.

### 9.3. Riesgos que aún requieren validación

| Verificación pendiente | Responsable y evidencia necesaria |
|---|---|
| Línea base real y resultados finales | Homero registra comandos, fechas y resultados en sección 7 antes de implementar; cada integrante confirma sus regresiones |
| CSRF, cookies y login JSON en navegador/Supertest | Nicolás y Matías verifican obtención de token, rotación, logout y cambios de credenciales; Homero verifica administración. Consultar al docente sólo si persiste un conflicto real sin modificar pruebas |
| Pruebas que pueden quedar verdes por un rechazo previo | Todo el equipo verifica también peticiones válidas con permisos y token, para alcanzar validación, rol, comandos, archivos y errores evaluados |
| Datos existentes y transición de hashes | Nicolás y Homero inspeccionan estado sin exponer secretos, definen respaldo y autorizan ejecución persistente por separado; comprobar idempotencia y no doble hashing |
| PostgreSQL sobre volumen existente | Homero verifica reglas de autenticación, rol y permisos reales. Cambiar scripts de init no actualiza una base ya inicializada; preparar aplicación segura y repetible sin borrar volumen |
| Tamaños, imágenes, ping y CSP | Homero/Matías comprueban archivos válidos de hasta 512 KiB, límite JSON, comando local, tiempo/salida y recursos del navegador; ajustar sólo con evidencia |
| Advertencias fuera de las 24 fallas | Homero registra credenciales locales exigidas, acceso público/IDOR y usuario root como riesgos residuales; no convertirlos automáticamente en trabajo independiente |
| Evaluación y entrega complementaria | Homero consulta al docente si solicita informe o video adicional o surge discrepancia de rúbrica. La entrega oficial vigente es el enlace del repositorio en la planilla del profesor |

## 10. Seguimiento del trabajo

Actualizar esta tabla durante el desarrollo sin cambiar los ID de la matriz principal. Los responsables y ramas están aprobados; todos los bloques siguen pendientes de implementación.

| Bloque | Responsable | Estado | Rama prevista | Criterios para considerarlo terminado |
|---|---|---|---|---|
| Administración e infraestructura | Homero | Pendiente | `fix/administracion-infraestructura` | 10/18/19/20/21/22/24 corregidas según alcance aprobado, funciones permitidas conservadas, configuración persistente verificada y PR revisado con evidencia |
| Consultas e integridad del negocio | Federico | Pendiente | `fix/consultas-validacion-negocio` | 2/3/4/9 corregidas, contratos y cálculos preservados, integridad de pedidos comprobada y PR revisado con evidencia |
| Autenticación, contraseñas y sesiones | Nicolás | Pendiente | `fix/autenticacion-sesiones` | 1/11/12/13/14/15/16/17 corregidas, transición de datos resuelta según aprobación, ciclo de sesión comprobado y PR revisado con evidencia |
| Frontend, CSRF y cabeceras | Matías | Pendiente | `fix/frontend-csrf-cabeceras` | 5/6/7/8/23 corregidas, interfaz legítima operativa, coordinación de sesión/CSRF validada y PR revisado con evidencia |

El cierre de un bloque requiere resultados de verificaciones autorizadas y revisión de sus dependencias; no basta con marcar tests como exitosos. El cierre global requiere integración y cumplimiento de la sección 6 sobre la solución conjunta.

**Siguiente hito:** revisar los cambios documentales y publicar la planificación mediante operaciones Git autorizadas por separado. Registrar la línea base antes de implementar.

## 11. Reglas de trabajo compartidas

- Trabajar por tarea y bloque acordados; comunicar archivos afectados, dependencias y cambios de contrato antes de editar archivos de otro integrante.
- Mantener cambios pequeños y revisables. No reformatear ni refactorizar áreas ajenas; no agregar frameworks, ORM o infraestructura adicional.
- Conservar tests, helpers y checker intactos. Registrar resultados reales y verificar también las funcionalidades permitidas, sin soluciones que sólo satisfagan patrones estáticos.
- Ejecutar seguridad únicamente sobre la instalación local dedicada. No crear automatizaciones ofensivas ni apuntar a servicios externos. No compartir secretos, tokens ni salidas sensibles.
- No eliminar datos o volúmenes ni aplicar transiciones persistentes sin autorización específica. Preparar un procedimiento revisable antes de solicitar su ejecución.
- Revisar los cambios y presentar PR hacia `develop`; operaciones Git y publicación quedan bajo control humano. No iniciar automáticamente otra tarea o etapa mediante Codex.

## 12. Cómo comenzar a trabajar

Estos comandos son instrucciones para los integrantes, **no se ejecutaron al redactar este documento**. Utilizarlos una vez publicada la documentación y autorizada la preparación local. Si se usa Codex para ejecutarlos, autorizar esas operaciones por separado.

1. Clonar el repositorio compartido en una ubicación propia y abrir la rama documental publicada:

   ```powershell
   git clone https://github.com/CivitasTFI/cafeteria-origen.git
   Set-Location cafeteria-origen
   git switch docs/planificacion-tp4
   ```

2. Leer [README](../README.md), esta planificación y la especificación individual: [Homero](bloques/homero.md), [Federico](bloques/federico.md), [Nicolás](bloques/nicolas.md) o [Matías](bloques/matias.md).
3. Preparar una instalación local dedicada con Docker Desktop o Docker Engine/Compose v2, siguiendo README. La versión inicial no carga `.env` desde Node; no asumir que copiar el ejemplo sustituye las credenciales actuales. Las [variables mínimas y la adaptación de la plantilla](bloques/homero.md#postgresql-y-persistencia) están especificadas para el endurecimiento: cada integrante configurará su `.env` local sin publicar valores privados. No usar datos que deban conservarse para las pruebas.

   ```powershell
   docker compose up -d --build
   docker compose exec app npm test
   docker compose exec app npm run test:seguridad
   docker compose exec app npm run check:security
   ```

4. Homero registra la línea base compartida en sección 7 antes de implementar. Consultar esos resultados y registrar los de la instalación propia; errores de seguridad iniciales son esperables según la consigna, pero no deben inventarse. Si funcionales falla, revisar la causa antes de atribuirlo a un cambio nuevo. Las pruebas pueden escribir en PostgreSQL y archivos; no resolver fallos borrando el volumen.
5. Una vez revisada la línea base, partir de `develop` actualizado y crear únicamente la rama asignada; por ejemplo, para Homero:

   ```powershell
   git switch develop
   git pull --ff-only origin develop
   git switch -c fix/administracion-infraestructura
   ```

   Los demás usan su nombre exacto de rama de la sección 4. No empezar código en la rama documental, `develop` o `main`.

6. Desarrollar la tarea autorizada, respetando propietarios y contrato CSRF. Consultas independientes pueden avanzar en paralelo; coordinar las interfaces antes de integrar.
7. Ejecutar verificaciones pertinentes y, para integración completa, además de las tres obligatorias:

   ```powershell
   docker compose exec app npm run test:todo
   docker compose exec app npm run typecheck
   git status --short
   git diff
   ```

8. Revisar evidencia y preparar un PR hacia `develop`; integrar después de revisión. El paso a `main` requiere validación integral. Commits, publicación de ramas y merges no se realizan por esta tarea documental.

Por vulnerabilidad registrar brevemente **causa, observación local autorizada, corrección, verificación y reflexión sobre prevención en un proyecto real**. No incluir secretos ni automatizaciones de ataques. La entrega oficial es el enlace al repositorio en la planilla enlazada por el profesor en README; informe o video complementarios no son obligatorios hasta confirmación docente.
