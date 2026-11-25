# Informe de Auditoría y Corrección de Vulnerabilidades — Cafetería Origen

**Programación IV — Trabajo Práctico N.º 4: Ciberseguridad**

## Índice

- [1. Introducción](#1-introducción)
- [2. Metodología de análisis](#2-metodología-de-análisis)
- [3. Resumen ejecutivo](#3-resumen-ejecutivo)
- [4. Análisis detallado de las 24 vulnerabilidades](#4-análisis-detallado-de-las-24-vulnerabilidades)
  - [1. Inyección SQL en el login](#1-inyección-sql-en-el-login)
  - [2. Inyección SQL en los filtros del catálogo](#2-inyección-sql-en-los-filtros-del-catálogo)
  - [3. Inyección SQL en el filtro de pedidos por mesa](#3-inyección-sql-en-el-filtro-de-pedidos-por-mesa)
  - [4. Inyección SQL en el reporte por origen](#4-inyección-sql-en-el-reporte-por-origen)
  - [5. XSS reflejado en el buscador y mensajes de error](#5-xss-reflejado-en-el-buscador-y-mensajes-de-error)
  - [6. XSS almacenado en las reseñas](#6-xss-almacenado-en-las-reseñas)
  - [7. XSS basado en DOM en el panel de administración](#7-xss-basado-en-dom-en-el-panel-de-administración)
  - [8. CSRF en formularios y operaciones que modifican estado](#8-csrf-en-formularios-y-operaciones-que-modifican-estado)
  - [9. Validación débil de cantidades y límites](#9-validación-débil-de-cantidades-y-límites)
  - [10. Subida de archivos sin restricciones](#10-subida-de-archivos-sin-restricciones)
  - [11. Contraseñas almacenadas en texto plano](#11-contraseñas-almacenadas-en-texto-plano)
  - [12. Ausencia de protección contra fuerza bruta](#12-ausencia-de-protección-contra-fuerza-bruta)
  - [13. Cookies de sesión sin atributos seguros](#13-cookies-de-sesión-sin-atributos-seguros)
  - [14. Identificadores de sesión predecibles](#14-identificadores-de-sesión-predecibles)
  - [15. Sesiones sin expiración](#15-sesiones-sin-expiración)
  - [16. Logout sin invalidación de sesión en el servidor](#16-logout-sin-invalidación-de-sesión-en-el-servidor)
  - [17. Enumeración de usuarios durante el login](#17-enumeración-de-usuarios-durante-el-login)
  - [18. Autorización ausente en el panel de administración](#18-autorización-ausente-en-el-panel-de-administración)
  - [19. Escalada de privilegios mediante modificación del rol](#19-escalada-de-privilegios-mediante-modificación-del-rol)
  - [20. Inyección de comandos en la función de prueba de conexión](#20-inyección-de-comandos-en-la-función-de-prueba-de-conexión)
  - [21. Exposición de información sensible en el diagnóstico](#21-exposición-de-información-sensible-en-el-diagnóstico)
  - [22. Exposición de stack traces al cliente](#22-exposición-de-stack-traces-al-cliente)
  - [23. Ausencia de cabeceras HTTP de seguridad](#23-ausencia-de-cabeceras-http-de-seguridad)
  - [24. Configuración insegura de PostgreSQL](#24-configuración-insegura-de-postgresql)
- [5. Resultados de las verificaciones](#5-resultados-de-las-verificaciones)
- [6. Consideraciones y limitaciones](#6-consideraciones-y-limitaciones)
- [7. Conclusión](#7-conclusión)

## 1. Introducción

Cafetería Origen dispone de un catálogo, un sistema de pedidos por mesa, un espacio de reseñas y un panel de gestión con reportes. La API se implementa con Express y TypeScript, la interfaz usa JavaScript y la persistencia se realiza en PostgreSQL. Los formularios públicos, las consultas, la sesión y las operaciones administrativas constituyen límites de confianza entre el navegador, el servidor y la base.

La auditoría comprende las 24 vulnerabilidades numeradas en la consigna. El análisis identifica cómo se manifiesta cada falla en una implementación vulnerable y qué propiedad establece la solución. El alcance incluye la separación de datos y sintaxis SQL, la presentación segura de texto en el navegador, la validación de entradas, la protección de escrituras, los permisos de sesión y el mínimo privilegio de infraestructura. La verificación funcional cubre, en paralelo, el funcionamiento de catálogo, pedidos, autenticación y reportes. [Consigna oficial, pp. 2–4](tp4%20-%20ciberseguridad.pdf) · [Inventario de vulnerabilidades](VULNERABILIDADES.md)

## 2. Metodología de análisis

1. **Entradas y límites de confianza.** Se sigue cada valor desde la solicitud, el navegador o PostgreSQL hasta su uso en una consulta, una escritura, una respuesta o un nodo del documento.
2. **Causa raíz.** Se identifica qué validación, separación de datos o comprobación de permisos falta en la implementación vulnerable. Los fragmentos de la implementación vulnerable ilustran esa causa.
3. **Mecanismo de protección.** Se examinan las precondiciones de los middlewares, las consultas parametrizadas y las decisiones sobre sesiones, CSRF, contenido y permisos de PostgreSQL. Cada fragmento de la solución corresponde al archivo y las líneas indicados.
4. **Verificación de comportamiento.** Se distinguen los recorridos legítimos, los rechazos previstos y los efectos en PostgreSQL. Se usan datos ficticios en un entorno controlado y se especifica si la evidencia proviene de código, una aserción automatizada o una comprobación documentada.
5. **Alcance de las comprobaciones.** Las pruebas funcionales comprueban los contratos del negocio. La batería de seguridad verifica escenarios específicos. El checker comprueba patrones del fuente y se interpreta junto con la ejecución y los límites de las aserciones. [Guía de práctica](GUIA-PRACTICA.md) · [Arranque y verificación](README.md#1-levantar-el-proyecto) · [Scripts de prueba](package.json#L7-L14)

Las referencias en formato `ruta:inicio-fin` indican la ubicación del fragmento dentro de su implementación. Las comprobaciones de sesión y escritura distinguen los efectos del filtro CSRF, los permisos de la cuenta, la validación de valores y la persistencia.

## 3. Resumen ejecutivo

Las correcciones protegen el procesamiento de entradas HTTP, las consultas y escrituras en PostgreSQL, la presentación en el navegador, el ciclo de sesión y los permisos de infraestructura. La creación de pedidos y reseñas conserva su acceso público mediante un contexto CSRF. Las operaciones del router administrativo exigen identidad y rol según su finalidad. El cambio de estado de los pedidos presenta una limitación específica del contrato de autorización. [Consideraciones y limitaciones](#6-consideraciones-y-limitaciones)

| N.º | Vulnerabilidad | Componente afectado | Corrección aplicada | Evidencia |
|---:|---|---|---|---|
| [1](#1-inyección-sql-en-el-login) | Inyección SQL en el login | Autenticación y servicio de usuarios | Consulta por nombre parametrizada y verificación bcrypt | Login funcional, rechazo uniforme y `SQLI-01/02` |
| [2](#2-inyección-sql-en-los-filtros-del-catálogo) | Inyección SQL en los filtros del catálogo | Listado de productos y búsqueda | Listas permitidas y patrones `ILIKE` como valores | Filtros simples y combinados, `SQLI-01/02` |
| [3](#3-inyección-sql-en-el-filtro-de-pedidos-por-mesa) | Inyección SQL en el filtro de pedidos por mesa | Listado de pedidos | Filtro acotado y consulta `WHERE mesa = $1` | Consulta con un pedido de mesa conocida, `SQLI-01/02` |
| [4](#4-inyección-sql-en-el-reporte-por-origen) | Inyección SQL en el reporte por origen | Agregación de ventas | Origen validado y enlazado en `HAVING` | Ventas por origen y rechazo de valor fuera de lista |
| [5](#5-xss-reflejado-en-el-buscador-y-mensajes-de-error) | XSS reflejado en el buscador y mensajes de error | Buscador, mensajes de API y DOM público | Nodos de texto y errores públicos constantes | Inspección DOM, casos oficiales y `XSS-01/02` |
| [6](#6-xss-almacenado-en-las-reseñas) | XSS almacenado en las reseñas | Persistencia y lista de reseñas | Validación del servidor y renderizado como texto | Reseña literal en Chrome, límite con CSRF válido |
| [7](#7-xss-basado-en-dom-en-el-panel-de-administración) | XSS basado en DOM en el panel de administración | Panel y datos dinámicos | Construcción de nodos y tablas con `textContent` | Valores literales en Chrome y `XSS-01` |
| [8](#8-csrf-en-formularios-y-operaciones-que-modifican-estado) | CSRF en formularios y operaciones que modifican estado | Escrituras bajo `/api` | Token por sesión o contexto anónimo, controles de origen | Pedido `403/201` y renovación de token en Chrome |
| [9](#9-validación-débil-de-cantidades-y-límites) | Validación débil de cantidades y límites | Alta y consulta de pedidos | Límites de entrada, cálculo del servidor y transacción | Rechazos `400` y reversión ante fallo de un ítem |
| [10](#10-subida-de-archivos-sin-restricciones) | Subida de archivos sin restricciones | Carga y publicación de imágenes | Formato real, tamaño acotado, nombre de servidor y escritura exclusiva | PNG válido, rechazo `415` y `VAL-04/05` |
| [11](#11-contraseñas-almacenadas-en-texto-plano) | Contraseñas almacenadas en texto plano | Seed, usuarios y login | bcrypt centralizado y respuestas públicas sin credenciales | Hashes comprobados en PostgreSQL y `AUTH-01/02/03` |
| [12](#12-ausencia-de-protección-contra-fuerza-bruta) | Ausencia de protección contra fuerza bruta | Login | Limitador por IP con ventana y respuesta `429` | Casos de seguridad y `AUTH-04` |
| [13](#13-cookies-de-sesión-sin-atributos-seguros) | Cookies de sesión sin atributos seguros | Cookie `sid` | `HttpOnly`, `SameSite=Lax` y `Secure` en producción | Cabecera comprobada en desarrollo y modo producción |
| [14](#14-identificadores-de-sesión-predecibles) | Identificadores de sesión predecibles | Creación y rotación de `sid` | 32 bytes de aleatoriedad y revocación del ID anterior | Caso de IDs y `AUTH-07/08` |
| [15](#15-sesiones-sin-expiración) | Sesiones sin expiración | Vigencia en el servidor y navegador | Vencimiento absoluto de ocho horas | Sesión vencida rechazada y `AUTH-09/10` |
| [16](#16-logout-sin-invalidación-de-sesión-en-el-servidor) | Logout sin invalidación de sesión en el servidor | Cierre de sesión | Revocación de sesión y CSRF y limpieza de cookie | Sesión cerrada deja de obtener acceso |
| [17](#17-enumeración-de-usuarios-durante-el-login) | Enumeración de usuarios durante el login | Errores y comparación de credenciales | Respuesta uniforme y bcrypt en ambos recorridos | Rechazos coincidentes y `AUTH-12` |
| [18](#18-autorización-ausente-en-el-panel-de-administración) | Autorización ausente en el panel de administración | API del panel | Sesión y rol `admin` aplicados por middleware | `401/403/200` de la API administrativa |
| [19](#19-escalada-de-privilegios-mediante-modificación-del-rol) | Escalada de privilegios mediante modificación del rol | Edición de usuarios y sesiones | Permisos, lista de roles y revocación sincronizada | Rechazo con CSRF válido y cambio autorizado |
| [20](#20-inyección-de-comandos-en-la-función-de-prueba-de-conexión) | Inyección de comandos en la función de prueba de conexión | Herramienta administrativa de conectividad | `spawn` sin shell, destinos locales y límites | Ping local legítimo y `CMD-01/02/03` |
| [21](#21-exposición-de-información-sensible-en-el-diagnóstico) | Exposición de información sensible en el diagnóstico | `/api/_diagnostico` | Sesión, rol `admin` y respuesta de dos campos | `401/403/200` y `CFG-03/04` |
| [22](#22-exposición-de-stack-traces-al-cliente) | Exposición de stack traces al cliente | Manejador de errores Express | Mensajes públicos fijos y metadatos internos acotados | `500` controlado y `VAL-06` |
| [23](#23-ausencia-de-cabeceras-http-de-seguridad) | Ausencia de cabeceras HTTP de seguridad | Middleware global HTTP | Helmet, CSP y HSTS según entorno | Cabeceras verificadas en HTTP y modo producción |
| [24](#24-configuración-insegura-de-postgresql) | Configuración insegura de PostgreSQL | Compose, bootstrap SQL y pool | SCRAM, puerto privado y rol `origen_app` limitado | TCP requiere clave y conexión con permisos reducidos |

## 4. Análisis detallado de las 24 vulnerabilidades

### 1. Inyección SQL en el login

#### A. Qué es y por qué importa

El nombre de usuario y la contraseña llegan desde el formulario de inicio de sesión. Si pasan a formar parte del texto SQL, el motor puede interpretarlos como sintaxis y alterar la selección de la cuenta. El login usa esa fila para crear una sesión y obtiene de ella el rol, de modo que un error en la consulta compromete la frontera de autenticación. En Cafetería Origen el impacto alcanzaría, según la cuenta obtenida, a productos, usuarios y otras operaciones del panel.

#### B. Dónde está

- **Implementación vulnerable** · `src/services/usuarios.service.ts:40-45`, función `autenticar`. La ruta de login consumía el usuario devuelto en `src/routes/auth.routes.ts:18-49`.
- **Implementación corregida** · `src/services/usuarios.service.ts:77-113`, búsqueda y comparación. La creación de sesión usa el usuario revalidado en `src/routes/auth.routes.ts:60-75`. [Servicio actual](src/services/usuarios.service.ts#L77-L113) · [Ruta actual](src/routes/auth.routes.ts#L60-L75)

#### C. Cómo se observa: pasos y evidencia

1. Seguir los campos de una solicitud de inicio de sesión desde el cuerpo JSON hasta la llamada al driver. La implementación vulnerable incorpora ambos valores a la cadena SQL. Esa composición permite que el contenido recibido altere el predicado que identifica la cuenta.
2. En una base descartable, iniciar sesión con una cuenta ficticia y repetir con una contraseña incorrecta. La aplicación corregida emite una sesión sólo después de verificar la credencial y responde `401` en el rechazo ordinario.
3. Contrastar el texto de la consulta con sus argumentos. La búsqueda usa `$1` para el nombre. La contraseña se procesa con bcrypt fuera de PostgreSQL.

La inspección del servicio demuestra la separación de gramáticas. Las pruebas funcionales acreditan tanto el login válido como el rechazo de credenciales. La batería de seguridad define, además, comprobaciones específicas para entradas que pretenden modificar el SQL.

#### D. Por qué ocurre

La implementación original armaba una condición de igualdad para los dos campos dentro de una plantilla SQL. `db.query` recibía únicamente el texto resultante. El escapado de cadenas JavaScript y el hecho de usar JSON en HTTP no proporcionan separación entre instrucciones y datos en PostgreSQL.

Fragmento de la implementación vulnerable en `src/services/usuarios.service.ts:43-45`.

```ts
  const { rows } = await db.query<Usuario>(sql);
  return rows[0] || null;
}
```

#### E. Cómo se corrige

Se reutiliza la búsqueda parametrizada por nombre y la contraseña se compara con bcrypt en el servicio. La estructura del SQL sólo busca un usuario mediante `$1`. El valor de la contraseña no interviene en esa consulta. Antes de emitir una sesión, el servicio vuelve a leer la cuenta dentro de la sección sincronizada por usuario. La sesión se construye con datos públicos.

Fragmento de [`src/services/usuarios.service.ts:77-83`](src/services/usuarios.service.ts#L77-L83).

```ts
export async function buscarPorUsername(username: string): Promise<Usuario | null> {
  const { rows } = await db.query<Usuario>(
    'SELECT * FROM usuarios WHERE username = $1',
    [username]
  );
  return rows[0] || null;
}
```

Fragmento de [`src/services/usuarios.service.ts:94-110`](src/services/usuarios.service.ts#L94-L110).

```ts
  const usuario = await buscarPorUsername(username);
  const hash = usuario ? usuario.password : HASH_DE_REFERENCIA;
  const passwordValida = await bcrypt.compare(password, hash);

  if (!usuario || !passwordValida) {
    return null;
  }

  return serializarPorUsuario(usuario.id, async () => {
    const vigente = await buscarPorUsername(username);
    if (!vigente || vigente.id !== usuario.id || vigente.password !== usuario.password) {
      return null;
    }

    const { id, rol, nombre } = vigente;
    const usuarioSesion = { id, username: vigente.username, rol, nombre };
    emitirSesion(usuarioSesion);
```

#### F. Cómo se verifica que quedó resuelto

«el login NO acepta el bypass con payload SQL» y «el login NO acepta el payload que comenta la contraseña» comprueban que los casos de prueba no autentiquen al agente. El primero verifica también que la consulta de sesión no otorgue acceso. `npm test` cubre la emisión de sesión con credenciales válidas y el `401` por credenciales inválidas. `npm run check:security` comprueba `SQLI-01` y `SQLI-02`. El criterio de aceptación combina consulta parametrizada, comparación bcrypt y ausencia de una sesión cuando la autenticación falla. [Pruebas de seguridad](tests/seguridad-login.test.ts#L58-L75) · [Regresión funcional](tests/auth.test.ts#L24-L56) · [Comandos de verificación](#comandos-de-verificación)

### 2. Inyección SQL en los filtros del catálogo

#### A. Qué es y por qué importa

El catálogo admite tipo, origen y texto de búsqueda. Los filtros deben limitar los productos activos que se muestran y no modificar la estructura de la consulta. Si el texto se interpreta como una condición SQL, se puede alterar la selección y producir resultados ajenos a los filtros del cliente. Además de afectar la integridad del catálogo, una consulta construida de forma insegura amplía la superficie de acceso a datos del servidor.

#### B. Dónde está

- **Implementación vulnerable** · `src/services/catalogo.service.ts:35-49`, función `listar`. La ruta entregaba `req.query` desde `src/routes/productos.routes.ts:18-34`.
- **Implementación corregida** · `src/services/catalogo.service.ts:35-71`. La ruta pública conserva la forma de respuesta con productos, filtros y total en `src/routes/productos.routes.ts:18-35`. [Servicio actual](src/services/catalogo.service.ts#L35-L71) · [Ruta actual](src/routes/productos.routes.ts#L18-L35)

#### C. Cómo se observa: pasos y evidencia

1. Preparar el catálogo con productos activos de distintos tipos y orígenes. Consultar un tipo, un origen y una búsqueda de texto, por separado y combinados.
2. Inspeccionar el servicio vulnerable. Los valores de los filtros aparecen dentro de la cadena que recibe PostgreSQL. El armado de la condición depende directamente de lo que suministre el cliente.
3. Comprobar en la aplicación corregida que el patrón se enlaza como argumento y que el resultado sigue mostrando sólo los productos correspondientes. Con espresso, Colombia y el texto `pocillo`, el conjunto observado contiene un producto.

Una comparación sobre doce combinaciones legítimas con los mismos datos respalda que el enlace de valores conserva resultados y orden. Los casos específicos de seguridad contrastan que una entrada no amplíe la selección.

#### D. Por qué ocurre

Los filtros se insertaban en plantillas que incluían comillas y operadores SQL. El valor de la búsqueda se ubicaba dentro del texto de los dos `ILIKE` y el tipo y el origen seguían el mismo esquema de interpolación. El armado condicional del filtro era válido como requisito del negocio. La falla consistía en construir las condiciones con valores no aislados del texto de la consulta.

#### E. Cómo se corrige

El servicio aplica listas permitidas al tipo y al origen. Para `q` exige un texto de hasta 100 caracteres. El arreglo de parámetros determina el índice de cada marcador. Los caracteres que forman el patrón `ILIKE` se agregan al valor antes de enlazarlo. El SQL incluye únicamente los fragmentos fijos y los números de posición que genera el servidor.

Fragmento de [`src/services/catalogo.service.ts:49-70`](src/services/catalogo.service.ts#L49-L70).

```ts
  const parametros: string[] = [];
  let sql = 'SELECT * FROM productos WHERE activo = true';

  if (tipo){
    parametros.push(tipo);
    sql+= ` AND tipo = $${parametros.length}`;
  }
  if (variedad){
    parametros.push(variedad);
    sql+= ` AND variedad = $${parametros.length}`;
  }
  if (q){
    parametros.push(`%${q}%`);
    const posicion = parametros.length;
    sql += ` AND (nombre ILIKE $${posicion} OR descripcion ILIKE $${posicion})`;
  }

  sql += ' ORDER BY tipo, variedad NULLS FIRST, id';

  const { rows } = await db.query<Producto>(sql, parametros);

  return rows.map((p) => ({ ...p, precio: calcularPrecio(p) }));
```

La consulta conserva la coincidencia parcial y ordena los productos por tipo, variedad e ID. El detalle de producto se valida por rango de entero y usa su propio parámetro. Las listas permitidas complementan la separación de valores y SQL.

#### F. Cómo se verifica que quedó resuelto

«la búsqueda del catálogo NO se puede ampliar con SQL» y «el filtro por origen NO se puede ampliar con SQL» comprueban que cada parámetro conserve su función de búsqueda o filtro. `npm test` verifica el catálogo completo, los filtros simples y los precios. La comprobación combinada agrega tipo, variedad y texto en una misma solicitud. `npm run check:security` cubre `SQLI-01/02`. Un filtro legítimo entrega los resultados previstos. Un origen fuera de la lista devuelve un error de entrada. [Casos de seguridad](tests/seguridad.test.ts#L167-L195) · [Catálogo funcional](tests/productos.test.ts#L11-L66) · [Comandos de verificación](#comandos-de-verificación)

### 3. Inyección SQL en el filtro de pedidos por mesa

#### A. Qué es y por qué importa

El listado de pedidos usa la mesa para reducir el conjunto visible. La entrada representa un dato de negocio y debe comparar por igualdad con el campo `mesa`. Cuando se mezcla con el texto SQL puede alterar la condición del listado. En una cafetería, una vista que mezcla pedidos de otras mesas puede afectar el servicio y exponer nombres y consumos. La política de quién accede al listado o al cambio de estado es un asunto de autorización distinto.

#### B. Dónde está

- **Implementación vulnerable** · `src/services/pedidos.service.ts:92-100`, función `listar`.
- **Implementación corregida** · `src/services/pedidos.service.ts:123-135`. La ruta que recibe el filtro está en `src/routes/pedidos.routes.ts:36-42`. [Servicio actual](src/services/pedidos.service.ts#L123-L135) · [Ruta actual](src/routes/pedidos.routes.ts#L36-L42)

#### C. Cómo se observa: pasos y evidencia

1. Usar pedidos de prueba con identificadores y mesas conocidas. En el recorrido corregido, el alta pública se realiza con un contexto CSRF válido.
2. Inspeccionar el predicado de `listar` en la implementación vulnerable. El identificador de mesa se incorpora al texto SQL, por lo que la comparación deja de estar protegida como un dato literal.
3. Consultar la mesa asignada a un pedido de prueba y comparar los IDs devueltos con los que corresponden a esa mesa. La comprobación dinámica devuelve exactamente el pedido asociado a la mesa nueva.

La evidencia del mecanismo está en la comparación entre el SQL y su arreglo de parámetros. La consulta con datos conocidos confirma la selección legítima. La evaluación de quién puede consultar pedidos forma parte del modelo de autorización.

#### D. Por qué ocurre

El recorrido con filtro incorpora al SQL una condición construida con el texto recibido. El valor quedaba dentro del predicado que interpreta PostgreSQL. El driver no recibía argumentos separados, por lo que la intención de una comparación literal dependía de lo que se hubiera construido en esa misma cadena.

#### E. Cómo se corrige

Cuando hay mesa, se comprueba que sea texto y que su longitud después de recortar espacios esté entre 1 y 10 caracteres. Se ejecuta una consulta fija con un parámetro. La opción sin filtro conserva su consulta de listado completo y el orden descendente por ID.

Fragmento de [`src/services/pedidos.service.ts:123-135`](src/services/pedidos.service.ts#L123-L135).

```ts
export async function listar(mesa?: string): Promise<Pedido[]> {
  if (mesa){
    if (typeof mesa!== 'string' || mesa.trim().length < 1 || mesa.trim().length > 10) {
      throw Object.assign(new Error('Mesa inválida'), { status: 400 });
    }
    const { rows } = await db.query<Pedido>('SELECT * FROM pedidos WHERE mesa = $1 ORDER BY id DESC', [mesa.trim()]);
    return rows;
  }
  else {
    const { rows } = await db.query<Pedido>('SELECT * FROM pedidos ORDER BY id DESC');
    return rows;
  }
}
```

El cambio corrige la interpretación de la mesa como SQL. El contrato del listado público permanece definido en la ruta y en las pruebas funcionales.

#### F. Cómo se verifica que quedó resuelto

«el filtro por mesa NO se puede ampliar con SQL» evalúa que la entrada no altere la selección de pedidos. El listado sin filtro se verifica con `npm test` y la selección por mesa se comprueba con un pedido identificado en datos de prueba. `npm run check:security` incluye `SQLI-01/02`. Una mesa válida reduce los resultados a sus pedidos y el acceso público conserva el alcance del contrato del TP. [Caso de seguridad](tests/seguridad.test.ts#L196-L208) · [Listado funcional](tests/pedidos.test.ts#L45-L50) · [Comandos de verificación](#comandos-de-verificación)

### 4. Inyección SQL en el reporte por origen

#### A. Qué es y por qué importa

El reporte calcula unidades e importe a partir de los ítems y agrupa por variedad y producto. El origen indicado sirve para filtrar ese resultado. Una entrada interpretada como SQL puede modificar el criterio de agregación o incorporar datos ajenos a los reportes. El impacto alcanza la confidencialidad de otras tablas y la confiabilidad de los totales con los que se toman decisiones comerciales.

#### B. Dónde está

- **Implementación vulnerable** · `src/services/reportes.service.ts:77-92`, función `ventasPorVariedad`.
- **Implementación corregida** · `src/services/reportes.service.ts:61-82`. Se expone mediante `/api/reportes/ventas-por-variedad` en `src/routes/reportes.routes.ts:48-55`. [Servicio actual](src/services/reportes.service.ts#L61-L82) · [Ruta actual](src/routes/reportes.routes.ts#L48-L55)

#### C. Cómo se observa: pasos y evidencia

1. Registrar un pedido legítimo de un producto de origen conocido en la base de pruebas. El reporte dispone así de una fila cuya clasificación y cantidad se pueden cotejar.
2. Inspeccionar el servicio vulnerable. La entrada del filtro forma parte de la expresión `HAVING`, aunque la agrupación y las sumas están definidas por la aplicación.
3. Consultar el reporte corregido para el origen conocido y comprobar que cada fila corresponda a ese origen. La comprobación con Colombia devuelve ventas de Colombia y el origen que no pertenece a la lista recibe `400`.

La separación de parámetros sostiene que el valor del filtro no altera la estructura del reporte. El test de seguridad comprueba la ausencia de datos ajenos a ventas en el escenario que contempla.

#### D. Por qué ocurre

La agrupación y las sumas estaban definidas por la aplicación. El filtro posterior a la agrupación se armaba interpolando la entrada del cliente. PostgreSQL resolvía la expresión completa como parte del programa SQL. La ruta pasaba el valor del filtro al servicio y la última oportunidad de separarlo se perdió en el armado de la consulta.

#### E. Cómo se corrige

El servicio conserva la agrupación, valida el origen contra Brasil, Colombia y Etiopía y añade un `HAVING` fijo con `$1` cuando hay filtro. La llamada a la base enlaza un único valor. Cuando se omite el origen, el contrato actual devuelve los grupos de todos los orígenes. La separación entre dato y sintaxis complementa la lista de orígenes permitidos.

Fragmento de [`src/services/reportes.service.ts:61-82`](src/services/reportes.service.ts#L61-L82).

```ts
export async function ventasPorVariedad(variedad: string): Promise<VentaPorVariedad[]> {
  const origenesPermitidos = ['Brasil', 'Colombia', 'Etiopía'];

  let sql = `
      SELECT pr.variedad, pr.nombre, SUM(pi.cantidad) AS unidades,
            SUM(pi.cantidad * pi.precio_unitario) AS total
        FROM pedido_items pi
        JOIN productos pr ON pr.id = pi.producto_id
      GROUP BY pr.variedad, pr.nombre`;

  const parametros: string[] = [];

  if (variedad !== undefined && variedad !== '') {
    if (typeof variedad !== 'string' || !origenesPermitidos.includes(variedad)) {
      throw Object.assign(new Error('Origen inválido'), { status: 400 });
    }
    sql += ' HAVING pr.variedad = $1';
    parametros.push(variedad);
  }
  const { rows } = await db.query<VentaPorVariedad>(sql, parametros);
  return rows;
}
```

#### F. Cómo se verifica que quedó resuelto

«el reporte por origen NO filtra otras tablas con UNION» comprueba que la respuesta no contenga datos de tablas ajenas al reporte. Con `npm test` se verifica el reporte legítimo y la comprobación de contrato confirma el rechazo del origen que no es válido. `npm run check:security` cubre `SQLI-01/02`. La implementación acepta el origen como valor del filtro y conserva la forma agregada de unidades e importe. [Caso de seguridad](tests/seguridad.test.ts#L210-L231) · [Reporte funcional](tests/reportes.test.ts#L66-L71) · [Comandos de verificación](#comandos-de-verificación)

### 5. XSS reflejado en el buscador y mensajes de error

#### A. Qué es y por qué importa

La propiedad de seguridad relevante es mantener los datos del usuario como texto al presentarlos. El buscador devuelve los filtros y muestra el texto consultado en un resumen. Los errores de la API también llegan al HTML público. Si el navegador interpreta ese contenido como marcado, una interacción con el buscador o una respuesta de error puede cambiar el documento y ejecutar comportamiento bajo el origen de Cafetería Origen. Eso permitiría alterar la vista que usa el cliente y, si hay una sesión activa, realizar acciones con su contexto.

#### B. Dónde está

- **Implementación vulnerable** · `src/public/js/app.js:125-138`, resumen y error del catálogo. La API reflejaba el identificador en el error en `src/routes/productos.routes.ts:52-59`, el nombre en `src/routes/auth.routes.ts:29-40` y la URL en `src/middleware/errores.ts:17-19`.
- **Implementación corregida** · `src/public/js/app.js:45-49` y `src/public/js/app.js:173-187`, creación de nodos y renderizado. Los errores se normalizan en `src/routes/productos.routes.ts:53-65`, `src/routes/auth.routes.ts:66-69` y `src/middleware/errores.ts:5-29`. [Renderizado](src/public/js/app.js#L173-L187) · [Errores](src/middleware/errores.ts#L5-L29)

#### C. Cómo se observa: pasos y evidencia

1. Buscar un producto en el entorno local y observar el resumen de resultados. Usar una cadena de prueba con puntuación ordinaria para distinguir el texto ingresado del marcado que aporta el sitio.
2. Seguir `filtros.q` y el mensaje de error hasta el elemento HTML. La implementación vulnerable concatena esos valores en una cadena para `innerHTML`, con lo que el navegador puede interpretarlos como parte del documento.
3. En la implementación corregida, inspeccionar el nodo del resumen y consultar el detalle de un producto inexistente. El resumen representa la entrada como texto y el error de API contiene un mensaje fijo.

La búsqueda funcional y la inspección del DOM son comprobaciones distintas de las aserciones sobre el cuerpo HTTP. El análisis de los nodos, del mensaje fijo y del renderizado con `textContent` permite vincular ambas superficies.

#### D. Por qué ocurre

En el navegador se construían cadenas con marcado fijo y texto recibido, y se entregaban a `innerHTML`. En el servidor algunos errores incluían identificadores, nombres o URLs aportados por el cliente. Una respuesta JSON puede contener datos textuales legítimos. La exposición se vuelve peligrosa cuando un consumidor trata ese valor como HTML o el mensaje público incorpora entrada que otras vistas podrían renderizar.

#### E. Cómo se corrige

El buscador genera la etiqueta visual con `document.createElement`. El helper asigna su contenido usando `textContent`. El resumen y el error montan los nodos con `replaceChildren`. La API conserva el objeto de filtros y emite errores públicos de contenido controlado. Los mensajes se incorporan a nodos de texto, tanto en el resumen como en la presentación de errores.

Fragmento de [`src/public/js/app.js:45-50`](src/public/js/app.js#L45-L50).

```js
  function elemento(etiqueta, clase, texto) {
    var nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    nodo.textContent = texto ?? '';
    return nodo;
  }
```

Fragmento de [`src/public/js/app.js:173-187`](src/public/js/app.js#L173-L187).

```js
  function renderResultado(filtros, total) {
    var el = $('#resultado-busqueda');

    if (filtros && filtros.q) {
      el.replaceChildren('Resultados para ', elemento('strong', '', filtros.q), ' — ' + total + ' producto(s)');
    } else {
      el.textContent = total + ' producto(s) en el menú';
    }
  }

  function renderErrorProductos(mensaje) {
    $('#productos-grid').replaceChildren(
      elemento('p', 'empty', 'No se pudo cargar el menú: ' + (mensaje || 'error desconocido'))
    );
  }
```

#### F. Cómo se verifica que quedó resuelto

«el cliente NO inserta datos con innerHTML» verifica las asignaciones en los scripts JavaScript. Su resultado es satisfactorio y la inspección confirma que el texto externo se incorpora mediante nodos. «el servidor NO devuelve HTML sin escapar en los errores» y «el login NO devuelve HTML sin escapar en el mensaje de error» inspeccionan el cuerpo HTTP. La verificación esperada combina mensajes públicos controlados con texto literal en la vista. `npm test` comprueba el detalle inexistente y `npm run check:security` cubre `XSS-01/02`. [Pruebas de seguridad](tests/seguridad.test.ts#L252-L294) · [Detalle funcional](tests/productos.test.ts#L78-L81) · [Comandos de verificación](#comandos-de-verificación)

### 6. XSS almacenado en las reseñas

#### A. Qué es y por qué importa

Una reseña se almacena y vuelve a mostrarse a otras personas. Si el autor o el texto guardado se interpreta como HTML, una sola publicación puede afectar repetidamente la página que ven los clientes. La corrección requiere tratar el contenido recuperado de PostgreSQL como no confiable, incluso si el formulario actual impone límites. La aceptación de una reseña legítima debe preservar su texto.

#### B. Dónde está

- **Implementación vulnerable** · `src/services/comentarios.service.ts:40-48`, persistencia, y `src/public/js/app.js:250-272`, función `cargarReseñas`.
- **Implementación corregida** · `src/services/comentarios.service.ts:11-18` y `src/services/comentarios.service.ts:30-47`, validación y escritura. `src/public/js/app.js:322-351` monta los comentarios recuperados. [Servicio](src/services/comentarios.service.ts#L11-L47) · [Renderizado](src/public/js/app.js#L322-L351)

#### C. Cómo se observa: pasos y evidencia

1. Publicar una reseña de prueba con autor, calificación y un texto ordinario que incluya signos como `<` y `&`. Volver a consultar la lista para evaluar el contenido que regresa desde PostgreSQL.
2. En el recorrido vulnerable, seguir el autor y el texto guardados hasta la plantilla de reseñas. Ambos quedan dentro de la cadena asignada a `innerHTML`. La persistencia vuelve a presentar el contenido a cada visitante.
3. En el recorrido corregido, comprobar que la tarjeta mantiene su estructura y representa los caracteres como texto. La observación en Chrome acredita esa representación. Una solicitud con CSRF válido y 281 caracteres recibe `400`, lo que permite aislar la validación del servidor.

La prueba de longitud y la representación literal comprueban propiedades complementarias. El límite controla el contrato de datos y la construcción de nodos protege la presentación de lo recuperado.

#### D. Por qué ocurre

El `INSERT` vulnerable enlaza los valores como parámetros, una medida que protege la sintaxis SQL. El texto almacenado conserva su contenido y sigue siendo un dato externo al recuperarse. La causa de XSS es la interpretación de ese contenido como parte del marcado de la tarjeta. El contrato de publicación también carece de reglas de tipo, longitud y calificación.

#### E. Cómo se corrige

El backend exige autor de hasta 40 caracteres y texto de hasta 280, ambos con contenido significativo y sin nulos. La calificación debe ser un entero de 1 a 5. Del lado público se crean elementos con valores de texto. Las estrellas se generan sólo a partir de una calificación válida y el frontend acota también el texto que recibe. Esto protege la presentación de reseñas ya almacenadas.

Fragmento de [`src/services/comentarios.service.ts:30-45`](src/services/comentarios.service.ts#L30-L45).

```ts
export async function crear({ autor, texto, calificacion }: NuevoComentario): Promise<Comentario> {
  if (!esTextoValido(autor, MAX_AUTOR)) {
    throw Object.assign(new Error('Autor de reseña inválido.'), { status: 400 });
  }
  if (!esTextoValido(texto, MAX_TEXTO)) {
    throw Object.assign(new Error('Texto de reseña inválido.'), { status: 400 });
  }
  if (typeof calificacion !== 'number' || !Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
    throw Object.assign(new Error('La calificación debe ser un entero entre 1 y 5.'), { status: 400 });
  }

  const { rows } = await db.query<Comentario>(
    `INSERT INTO comentarios (autor, texto, calificacion)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [autor, texto, calificacion]
```

Fragmento de [`src/public/js/app.js:331-349`](src/public/js/app.js#L331-L349).

```js
      var lista = document.createDocumentFragment();
      comentarios.forEach(function (c) {
        var autor = typeof c.autor === 'string' ? c.autor.slice(0, MAX_AUTOR_RESENA) : '';
        var texto = typeof c.texto === 'string' ? c.texto.slice(0, MAX_TEXTO_RESENA) : '';
        var calificacion = c.calificacion;
        var estrellas = Number.isInteger(calificacion) && calificacion >= 1 && calificacion <= 5
          ? '★'.repeat(calificacion)
          : '';

        var cabecera = elemento('div', 'review-head');
        cabecera.append(
          elemento('span', 'review-author', autor),
          elemento('span', 'review-stars', estrellas)
        );
        var tarjeta = elemento('article', 'review');
        tarjeta.append(cabecera, elemento('p', 'review-text', texto));
        lista.append(tarjeta);
      });
      cont.replaceChildren(lista);
```

#### F. Cómo se verifica que quedó resuelto

«el cliente NO inserta datos con innerHTML» y «no se aceptan reseñas sin límite de longitud» tienen resultado satisfactorio. El segundo admite un `4xx` y su solicitud carece de token CSRF. La comprobación de longitud con token válido obtiene `400` en la validación de entrada. La comprobación en Chrome verifica que una reseña aceptada conserva el texto literal después de recuperar la lista. `npm run check:security` cubre `XSS-01` y `XSS-04`. [Prueba de renderizado](tests/seguridad.test.ts#L273-L294) · [Prueba de longitud](tests/seguridad.test.ts#L405-L423) · [Comandos de verificación](#comandos-de-verificación)

### 7. XSS basado en DOM en el panel de administración

#### A. Qué es y por qué importa

El panel modifica el documento del navegador con valores de navegación y datos de usuarios, pedidos, productos y reportes. Una inserción que convierta esos valores en HTML puede afectar la interfaz de quien tiene permisos de administración. En ese contexto, un comportamiento ejecutado en el origen puede acceder a los flujos disponibles al administrador aunque la cookie tenga la bandera `HttpOnly`.

#### B. Dónde está

- **Implementación vulnerable** · `src/public/js/admin.js:423-428`, inicialización y texto de bienvenida. La misma técnica de plantillas y `innerHTML` se usaba en `src/public/js/admin.js:156-176`, `src/public/js/admin.js:200-212` y `src/public/js/admin.js:336-355`.
- **Implementación corregida** · `src/public/js/admin.js:38-53`, helpers de texto y tablas, y `src/public/js/admin.js:553-558`, bienvenida. Los flujos de pedidos y usuarios consumen esos helpers. [Helpers](src/public/js/admin.js#L38-L53) · [Inicio del panel](src/public/js/admin.js#L553-L558)

#### C. Cómo se observa: pasos y evidencia

1. Usar un administrador ficticio y datos de productos, usuarios y pedidos con signos de puntuación. Abrir el panel local e inspeccionar la bienvenida, las celdas y los controles de cada tabla.
2. En el código vulnerable, seguir el valor de `vista` desde la URL hasta el encabezado y los datos de negocio hasta las plantillas. La asignación a `innerHTML` hace que el navegador interprete el valor como marcado en esos puntos.
3. En la aplicación corregida, verificar que los caracteres permanezcan en el texto de cada nodo y que filas, títulos y controles conserven su estructura. La comprobación en Chrome registra nombres literales y operaciones del panel disponibles.

El test sobre el fuente cubre el mecanismo de inserción. El uso legítimo del panel verifica que la construcción de elementos preserve la interfaz.

#### D. Por qué ocurre

El procesamiento se producía en el cliente. La asignación al encabezado usaba un valor tomado de la URL y las tablas ensamblaban datos dinámicos en cadenas de HTML. Los escapes eran insuficientes como diseño general porque la interfaz mezclaba el texto de negocio con la estructura del documento en varios lugares.

#### E. Cómo se corrige

El panel utiliza elementos de la API del DOM para representar los datos. `nodoTexto` establece texto y `prepararTabla` arma encabezados y celdas mediante métodos del documento. El encabezado que usa `vista` se actualiza con `textContent`. La construcción de nodos conserva los controles y su delegación de eventos. Los puntos de inserción presentan texto y carecen de dependencia de DOMPurify.

Fragmento de [`src/public/js/admin.js:38-53`](src/public/js/admin.js#L38-L53).

```js
  function nodoTexto(etiqueta, valor, clase) {
    var nodo = document.createElement(etiqueta);
    nodo.textContent = valor == null ? '' : String(valor);
    if (clase) nodo.className = clase;
    return nodo;
  }

  function prepararTabla(tabla, titulos, columnasNumericas) {
    tabla.replaceChildren();
    var encabezado = tabla.createTHead().insertRow();
    titulos.forEach(function (titulo, indice) {
      var clase = columnasNumericas && columnasNumericas.includes(indice) ? 'num' : '';
      encabezado.append(nodoTexto('th', titulo, clase));
    });
    return tabla.createTBody();
  }
```

Fragmento de [`src/public/js/admin.js:553-558`](src/public/js/admin.js#L553-L558).

```js
  function init() {
    var params = new URLSearchParams(window.location.search);
    var objetivo = params.get('vista');
    if (objetivo) {
      $('#panel-bienvenida').textContent = 'Panel ' + objetivo;
    }
```

#### F. Cómo se verifica que quedó resuelto

«el cliente NO inserta datos con innerHTML» comprueba cómo se actualiza el DOM en los scripts. Su resultado y el control `XSS-01` son satisfactorios. `npm test` valida que se sirve el HTML del panel. Para comprobar el tratamiento de los datos dinámicos se inspecciona el texto de celdas y encabezados en el navegador. La evidencia de Chrome confirma esa representación, la navegación y la carga sin DOMPurify. [Prueba del cliente](tests/seguridad.test.ts#L273-L294) · [HTML funcional](tests/reportes.test.ts#L80-L83) · [Comandos de verificación](#comandos-de-verificación)

### 8. CSRF en formularios y operaciones que modifican estado

#### A. Qué es y por qué importa

El navegador adjunta cookies según las reglas de la sesión y del origen. Un servidor que autoriza una escritura sólo por recibir una cookie puede confundir una petición iniciada en otro sitio con una acción del usuario. Cafetería Origen expone altas de pedidos y reseñas al público. Además tiene operaciones administrativas y logout para sesiones. La protección debía conservar los recorridos públicos y verificar el contexto de las escrituras.

#### B. Dónde está

- **Implementación vulnerable** · `src/app.ts:40-48`, montaje de rutas sin middleware global de CSRF. Ejemplos en `src/routes/pedidos.routes.ts:18-26` y `src/public/js/app.js:40-50`.
- **Implementación corregida** · `src/app.ts:57-72`, `src/routes/csrf.routes.ts:5-9` y `src/middleware/csrf.ts:20-66`, `src/middleware/csrf.ts:95-145`, `src/middleware/csrf.ts:148-181`. Consumo por el sitio público en `src/public/js/app.js:20-32` y `src/public/js/app.js:66-106`, y por el panel en `src/public/js/admin.js:99-119`. [Montaje](src/app.ts#L57-L72) · [Middleware](src/middleware/csrf.ts#L139-L181)

#### C. Cómo se observa: pasos y evidencia

1. Preparar un producto ficticio y localizar el alta de pedidos. La implementación vulnerable ejecuta la escritura sin comprobar un token que acredite el contexto del formulario.
2. En el entorno corregido, comprobar que un pedido de prueba con un cuerpo válido recibe `403` si falta el token. Enviar un pedido legítimo desde su contexto válido y verificar que recibe `201`. Los dos estados constan en la prueba de comportamiento.
3. Mantener la página pública abierta y cambiar el estado de autenticación en otra pestaña mediante el login normal. El formulario de reseñas permite observar la renovación cuando su contexto queda desactualizado. La comprobación en Chrome confirma que el reenvío explícito registra la reseña una sola vez.

El código del middleware y estos recorridos permiten distinguir el rechazo de un contexto incorrecto, la renovación del token y la aceptación del formulario legítimo.

#### D. Por qué ocurre

Los routers originales recibían escrituras directamente. La presencia de una cookie de sesión acreditaba identidad cuando la ruta la exigía, pero no confirmaba la intención del usuario. También faltaba un contexto verificable para los formularios anónimos. El diseño actual necesita proteger ambas clases de contexto y preservar las distintas políticas de autorización de cada ruta.

#### E. Cómo se corrige

El middleware genera tokens aleatorios y los asocia a una sesión válida o a un contexto anónimo con cookie propia. Aplica expiración y comparación de longitud y tiempo seguro. Controla `Origin` y `Sec-Fetch-Site` cuando están presentes. Valida las escrituras antes de ingresar a los routers. El login, que acepta JSON, se exceptúa del token después de revisar el origen. El logout y los cambios de sesión revocan los tokens correspondientes.

Fragmento de [`src/middleware/csrf.ts:148-181`](src/middleware/csrf.ts#L148-L181).

```ts
export function validarCsrf(req: Request, res: Response, next: NextFunction): void {
  if (METODOS_SEGUROS.has(req.method)) {
    next();
    return;
  }

  if (rechazarOrigenCruzado(req, res)) return;

  // Excepción de login (JSON directo; sin token sincronizador).
  if (req.method === 'POST' && (req.path === '/auth/login' || req.path.endsWith('/auth/login'))) {
    next();
    return;
  }

  const clave = resolverClave(req);
  if (!clave) {
    res.status(403).json({ error: 'Token CSRF inválido o faltante' });
    return;
  }

  const esperado = leerTokenAlmacenado(clave);
  const enviado = leerTokenEnviado(req);

  if (!enviado || !esperado || !tokensCoinciden(enviado, esperado)) {
    res.status(403).json({ error: 'Token CSRF inválido o faltante' });
    return;
  }

  if (req.body && typeof req.body === 'object' && '_csrf' in req.body) {
    delete req.body._csrf;
  }

  next();
}
```

El cliente público renueva el contexto cuando recibe un rechazo por token inválido y mantiene los datos del formulario disponibles. La escritura queda sujeta a un reenvío explícito del usuario, de modo que la renovación de contexto no duplique la solicitud. [Renovación en la página pública](src/public/js/app.js#L90-L106)

#### F. Cómo se verifica que quedó resuelto

«existe un token anti-CSRF y las peticiones sin token se rechazan» comprueba la emisión de token y un rechazo. La aserción con token admite cualquier estado inferior a `500`. La comprobación de contrato exige `201` al crear el pedido con token válido y obtiene `403` cuando falta. `npm run check:security` cubre `CSRF-01` a `CSRF-04`. La renovación en navegador acredita que un cambio de sesión permite recuperar el formulario de forma controlada. [Caso de seguridad](tests/seguridad.test.ts#L306-L340) · [Comandos de verificación](#comandos-de-verificación)

### 9. Validación débil de cantidades y límites

#### A. Qué es y por qué importa

El alta de un pedido recibe productos, cantidades y datos de la mesa. El servidor debe validar esos valores y calcular el importe con sus propios precios. Cantidades negativas, no numéricas o fuera de rango pueden producir totales incorrectos y contaminar la facturación. Si la cabecera y los ítems se guardan sin una transacción, un error intermedio puede dejar un pedido incompleto aunque el cliente reciba un rechazo.

#### B. Dónde está

- **Implementación vulnerable** · `src/services/pedidos.service.ts:43-82`, función `crear`. Las cantidades se copiaban en las filas y luego se multiplicaban por el precio.
- **Implementación corregida** · `src/services/pedidos.service.ts:46-114`. El detalle y el cambio de estado controlan el rango del ID en `src/services/pedidos.service.ts:22-28`, `src/services/pedidos.service.ts:138-155` y `src/services/pedidos.service.ts:159-169`. [Alta](src/services/pedidos.service.ts#L46-L114) · [Validación de ID](src/services/pedidos.service.ts#L22-L28)

#### C. Cómo se observa: pasos y evidencia

1. Usar un producto activo de prueba y crear un pedido legítimo con su cantidad y precio conocidos. Cotejar el total con los valores calculados por el servicio.
2. Revisar la implementación vulnerable. La cantidad recibida se incorpora sin validar a la multiplicación y la cabecera se almacena mediante una consulta independiente de los ítems. Los importes inválidos y la persistencia parcial se deducen de ese flujo.
3. Verificar los límites con un token CSRF válido. Las cantidades negativa, no numérica, cero y superior al máximo devuelven `400` en la comprobación de entrada.
4. Provocar un fallo controlado en la segunda inserción de ítems en el proceso de prueba, usando una conexión real e instrumentando la segunda escritura. La comprobación obtiene `500` genérico y la consulta a PostgreSQL confirma que la cabecera del pedido se revierte.

La combinación de comprobaciones distingue el cálculo legítimo, el rechazo de valores y la atomicidad de la escritura.

#### D. Por qué ocurre

El original tomaba la cantidad del cliente sin exigir un entero positivo dentro de un rango. La multiplicación podía aceptar coerciones de JavaScript en lugar de preservar el contrato aritmético del pedido. Luego se ejecutaban consultas separadas para cabecera e ítems, con lo que un fallo posterior a la primera escritura podía dejarla persistida.

Fragmento de la implementación vulnerable en `src/services/pedidos.service.ts:61-64`.

```ts
  const total = filas.reduce(
    (acc, f) => acc + f.precioUnitario * f.cantidad,
    0
  );
```

#### E. Cómo se corrige

El alta exige de 1 a 50 ítems y cantidades enteras de 1 a 100. Las longitudes permitidas son de 1 a 10 caracteres para la mesa y de 2 a 40 para el cliente. Cada ID de producto se valida y sólo se cotizan productos activos. El servidor calcula el total, abre una transacción y ejecuta las escrituras por la misma conexión. Un error revierte los cambios y libera la conexión. Las operaciones de detalle y cambio de estado normalizan el ID y verifican que esté dentro del rango admitido. Un identificador válido que no corresponde a un pedido recibe `404`.

Fragmento de [`src/services/pedidos.service.ts:46-55`](src/services/pedidos.service.ts#L46-L55).

```ts
export async function crear({ mesa, cliente, items }: NuevoPedido): Promise<PedidoConItems | null> {
  if (!Array.isArray(items) || items.length > 50 || items.length < 1 || items.some((item) => item == null || !Number.isInteger(item.cantidad) || item.cantidad <= 0 || item.cantidad > 100 )) {
      throw Object.assign(new Error('Items inválidos'), { status: 400 });
  }
  if (typeof mesa !== 'string' || mesa.trim().length < 1 || mesa.trim().length > 10) {
    throw Object.assign(new Error('Mesa inválida'), { status: 400 });
  }
  if (typeof cliente !== 'string' || cliente.trim().length < 2 || cliente.trim().length > 40) {
    throw Object.assign(new Error('Cliente inválido'), { status: 400 });
  }
```

Fragmento de [`src/services/pedidos.service.ts:90-113`](src/services/pedidos.service.ts#L90-L113).

```ts
      const total = filas.reduce((acc, f) => acc + f.precioUnitario * f.cantidad,0);

      const { rows } = await conexion.query<Pedido>(
        `INSERT INTO pedidos (mesa, cliente, estado, total)
        VALUES ($1, $2, 'abierto', $3)
        RETURNING *`,
        [mesa.trim(), cliente.trim(), total]
      );
      pedidoId = rows[0].id;
      for (const fila of filas) {
        await conexion.query(
          `INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario)
          VALUES ($1, $2, $3, $4)`,
          [pedidoId, fila.productoId, fila.cantidad, fila.precioUnitario]
        );
      }

      await conexion.query('COMMIT');
  } catch (error) {
      await conexion.query('ROLLBACK');
      throw error;
  } finally {
    conexion.release();
  }
```

#### F. Cómo se verifica que quedó resuelto

«no se aceptan cantidades negativas» y «no se aceptan cantidades no numéricas» aceptan un rechazo `4xx`. Como las solicitudes carecen de token, el middleware CSRF también puede satisfacer esa condición. Las comprobaciones con CSRF válido confirman `400` en la capa de entrada. El fallo controlado confirma la reversión de la cabecera. `npm test` cubre los cálculos y el listado y `npm run check:security` verifica `VAL-01/02/03`. [Casos de seguridad](tests/seguridad.test.ts#L357-L403) · [Cálculos funcionales](tests/pedidos.test.ts#L10-L43) · [Comandos de verificación](#comandos-de-verificación)

### 10. Subida de archivos sin restricciones

#### A. Qué es y por qué importa

El panel puede cargar imágenes que quedan disponibles bajo `/uploads` en el mismo origen. Admitir cualquier archivo puede publicar contenido activo o introducir material que el servidor no debería servir. Dejar que el cliente elija el nombre físico también puede afectar otros archivos. Un límite efectivo protege almacenamiento y procesamiento de la aplicación.

#### B. Dónde está

- **Implementación vulnerable** · `src/routes/admin.routes.ts:180-201`, `POST /api/admin/subir-archivo`. El montaje de archivos estaba en `src/app.ts:29-33`.
- **Implementación corregida** · `src/routes/admin.routes.ts:214-215`, validadores `src/routes/admin.routes.ts:242-420`, lista de formatos `src/routes/admin.routes.ts:421-426` y ruta `src/routes/admin.routes.ts:429-474`. `src/app.ts:48-55` establece el límite del JSON y publica archivos. [Ruta y formatos](src/routes/admin.routes.ts#L421-L474) · [Publicación de archivos](src/app.ts#L48-L55)

#### C. Cómo se observa: pasos y evidencia

1. Preparar un administrador ficticio, un directorio de imágenes descartable y una imagen PNG pequeña. El camino permitido requiere sesión, rol administrativo y CSRF válido.
2. Identificar en el código vulnerable qué valores se decodifican y cómo se construye el destino. El tipo real del archivo carece de controles y el nombre físico depende de la entrada del cliente.
3. Subir el PNG mediante el formulario corregido y abrir el recurso devuelto. La comprobación en Chrome confirma que los bytes servidos corresponden al archivo de prueba. Un archivo de texto ordinario recibe `415`. El volumen contiene el PNG con UID `1000`, y el archivo de texto no se guarda.

La inspección cubre las condiciones de tamaño, formato, nombre y escritura exclusiva. El recorrido legítimo comprueba además que las restricciones de formato son compatibles con la operación del panel.

#### D. Por qué ocurre

El original comprobaba la presencia de nombre y contenido. La decodificación Base64 transformaba la representación del archivo, pero no validaba su tipo ni su estructura. El nombre recibido se unía a la carpeta de subida y la escritura usaba el modo por defecto. La combinación delegaba al cliente decisiones sobre ubicación, extensión y contenido que correspondían al servidor.

#### E. Cómo se corrige

La ruta discrimina entre PNG, JPEG y WebP por extensión y exige que el contenido satisfaga el validador binario correspondiente. Controla formato Base64 canónico y limita a 512 KiB el resultado decodificado. A partir de un UUID y una extensión permitida obtiene un nombre nuevo. Verifica que el destino directo permanezca en la carpeta configurada y usa `wx` para impedir la sobrescritura. El contenedor se ejecuta como `node` y escribe en el volumen de imágenes.

Fragmento de [`src/routes/admin.routes.ts:437-456`](src/routes/admin.routes.ts#L437-L456).

```ts
    const formato = formatosDeImagen.get(path.extname(nombre).toLowerCase());
    if (!formato) {
      return res.status(415).json({ error: 'Sólo se admiten imágenes PNG, JPEG y WebP.' });
    }
    if (contenidoBase64.length > MAX_BASE64_IMAGEN) {
      return res.status(413).json({ error: 'La imagen supera el máximo de 512 KiB.' });
    }
    if (contenidoBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(contenidoBase64)) {
      return res.status(400).json({ error: 'El contenido base64 es inválido.' });
    }
    if (Buffer.byteLength(contenidoBase64, 'base64') > MAX_SIZE_IMAGEN) {
      return res.status(413).json({ error: 'La imagen supera el máximo de 512 KiB.' });
    }
    const buffer = Buffer.from(contenidoBase64, 'base64');
    if (buffer.length === 0 || buffer.toString('base64') !== contenidoBase64) {
      return res.status(400).json({ error: 'El contenido base64 es inválido.' });
    }
    if (!formato.validar(buffer)) {
      return res.status(415).json({ error: 'La imagen es inválida o no corresponde a la extensión.' });
    }
```

Fragmento de [`src/routes/admin.routes.ts:458-470`](src/routes/admin.routes.ts#L458-L470).

```ts
    const nombreGuardado = `${randomUUID()}${formato.extension}`;
    const directorio = path.resolve(config.uploadsDir);
    const destino = path.resolve(directorio, nombreGuardado);
    if (path.dirname(destino) !== directorio) throw new Error('Destino de subida inválido.');

    fs.mkdirSync(directorio, { recursive: true });
    fs.writeFileSync(destino, buffer, { flag: 'wx', mode: 0o644 });

    res.json({
      mensaje: 'Archivo subido.',
      url: `/uploads/${nombreGuardado}`,
      bytes: buffer.length,
    });
```

La validación binaria comprueba estructuras propias de cada formato, incluidos segmentos, tamaños y firmas según el formato. El límite de JSON global y el permiso administrativo actúan antes de la escritura. El MIME declarado por el cliente no es la fuente de confianza de la validación.

#### F. Cómo se verifica que quedó resuelto

«no se aceptan archivos ejecutables ni se escribe fuera de uploads» evalúa el rechazo de un formato inadmisible y la ausencia de escrituras fuera del directorio previsto. La evidencia de comportamiento para el camino permitido incluye la subida y descarga del PNG. El rechazo `415` y la inspección del volumen confirman que el archivo inválido de prueba no se persiste. `npm run check:security` comprueba `VAL-04`, `VAL-05` y `CFG-05`. [Caso de seguridad](tests/seguridad.test.ts#L425-L475) · [Usuario del contenedor](Dockerfile#L27-L30) · [Comandos de verificación](#comandos-de-verificación)

### 11. Contraseñas almacenadas en texto plano

#### A. Qué es y por qué importa

La base necesita verificar contraseñas al iniciar sesión, pero guardar el valor original convierte una copia de la tabla en una exposición directa de credenciales. Además de comprometer las cuentas de Cafetería Origen, una contraseña reutilizada puede afectar otros servicios. La solución debe cubrir la carga inicial y las modificaciones de usuarios, y mantener el login y la revocación de sesiones.

#### B. Dónde está

- **Implementación vulnerable** · `src/inicializar.ts:54-64`, seed de cuentas, y `src/services/usuarios.service.ts:40-45`, consulta que comparaba la contraseña en SQL.
- **Implementación corregida** · `src/inicializar.ts:14-61` y `src/services/usuarios.service.ts:30-35`, `src/services/usuarios.service.ts:62-65`, `src/services/usuarios.service.ts:89-112`, `src/services/usuarios.service.ts:135-193`. Las validaciones de las dos rutas se aplican en `src/routes/admin.routes.ts:28-47` y `src/routes/admin.routes.ts:89-112`. [Seed](src/inicializar.ts#L50-L61) · [Helper](src/services/usuarios.service.ts#L62-L65) · [Cambio personal](src/routes/admin.routes.ts#L28-L47)

#### C. Cómo se observa: pasos y evidencia

1. Seguir el valor que se enlaza a `usuarios.password` en el código vulnerable. La entrada del seed se entrega directamente al `INSERT`, lo que permite comprobar el problema sin consultar valores de credenciales.
2. En un volumen nuevo de prueba, inspeccionar el formato y el costo de los verificadores y ejecutar `bcrypt.compare` dentro del proceso. Un arranque normal crea un administrador con bcrypt de costo 10. El modo de demostración optativo acredita cinco hashes, sin sustituir el administrador que ya existe.
3. Cambiar la contraseña de una cuenta ficticia mediante el flujo personal y una gestión autorizada. El login con la nueva clave y la pérdida de acceso de las sesiones que usaban la clave alterada acreditan la integración con sesiones.

Los conteos, costos y comparaciones aportan evidencia sin divulgar contraseñas ni hashes almacenados.

#### D. Por qué ocurre

El seed original ya usaba una consulta parametrizada. Sin embargo el valor asociado a la columna era directamente `usuario.password`. El login también esperaba que el valor almacenado coincidiera con la contraseña recibida. La parametrización aborda la sintaxis SQL. El uso de un verificador unidireccional aborda la exposición de la credencial en reposo.

Fragmento de la implementación vulnerable en `src/inicializar.ts:58-63`.

```ts
    await db.query(
      `INSERT INTO usuarios (username, password, rol, nombre)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO NOTHING`,
      [usuario.username, usuario.password, usuario.rol, usuario.nombre]
    );
```

#### E. Cómo se corrige

El helper único usa bcrypt con costo 10. El seed y las dos escrituras legítimas llaman al helper antes de persistir. El login llama a `bcrypt.compare`. El panel recibe datos públicos sin el campo de contraseña. El administrador inicial toma una clave privada del entorno y las cuentas adicionales requieren habilitar explícitamente la demo. En las dos escrituras por HTTP se rechazan entradas inválidas y valores que superarían 72 bytes UTF-8. El script de transición usa el mismo helper y es un camino separado del arranque.

Fragmento de [`src/services/usuarios.service.ts:62-65`](src/services/usuarios.service.ts#L62-L65).

```ts
/** Genera un hash bcrypt para una contraseña en texto plano. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COSTO_HASH);
}
```

Fragmento de [`src/inicializar.ts:52-61`](src/inicializar.ts#L52-L61).

```ts
  for (const usuario of usuariosIniciales()) {
    const passwordHash = await hashPassword(usuario.password);

    await db.query(
      `INSERT INTO usuarios (username, password, rol, nombre)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username) DO NOTHING`,
      [usuario.username, passwordHash, usuario.rol, usuario.nombre]
    );
  }
```

El helper `hashPassword` cumple el patrón del checker y ejecuta la llamada real a bcrypt con el costo configurado para cuentas de aplicación. El seed conserva cuentas existentes mediante `ON CONFLICT DO NOTHING`.

#### F. Cómo se verifica que quedó resuelto

«las contraseñas NO se guardan en texto plano» comprueba el prefijo de las filas y tiene resultado satisfactorio. La comparación bcrypt y la comprobación del costo acreditan el uso del verificador en la carga inicial y ambas actualizaciones. `npm test` cubre login válido e inválido. `npm run check:security` verifica `AUTH-01/02/03`. La condición esperada es un hash válido en PostgreSQL, una autenticación correcta con la clave configurada y revocación coherente cuando se modifica. [Prueba de almacenamiento](tests/seguridad.test.ts#L488-L503) · [Pruebas de login](tests/auth.test.ts#L24-L56) · [Hashing y control AUTH-02](#hashing-y-control-auth-02)

### 12. Ausencia de protección contra fuerza bruta

#### A. Qué es y por qué importa

Cada intento de login permite verificar una combinación de credenciales. Si el servidor admite intentos repetidos sin límite, aumenta la posibilidad de comprometer una cuenta con contraseña débil. El costo de bcrypt también consume recursos por solicitud. Un límite temporal ayuda a proteger las cuentas y a contener el uso del servicio de autenticación.

#### B. Dónde está

- **Implementación vulnerable** · `src/routes/auth.routes.ts:18-27`. La ruta ejecutaba la autenticación directamente.
- **Implementación corregida** · `src/routes/auth.routes.ts:10-21`, configuración del limitador, y `src/routes/auth.routes.ts:33-36`, montaje en el login. [Limitador y ruta](src/routes/auth.routes.ts#L10-L33)

#### C. Cómo se observa: pasos y evidencia

1. Identificar el handler de login y los middlewares que se ejecutan antes de verificar las credenciales. En la implementación vulnerable la autenticación no tiene un presupuesto de intentos ni una ventana de control.
2. Revisar el límite configurado en el router corregido. El middleware bloquea con `429` cuando se supera la capacidad aplicable al cliente durante la ventana. El manejo de la cuenta sigue a cargo del servicio de autenticación.
3. Comprobar con una cuenta ficticia que el inicio de sesión normal funciona y que una credencial incorrecta recibe el rechazo habitual. La configuración del límite y los escenarios oficiales documentan el comportamiento ante el exceso de intentos.

La respuesta `429` identifica un bloqueo temporal. Las respuestas de credenciales inválidas constituyen una comprobación diferente de la política de autenticación.

#### D. Por qué ocurre

El backend no mantenía un presupuesto de intentos ni una política de respuesta al superar un umbral. Cada petición de login alcanzaba la capa de autenticación. La configuración del limitador debe estar montada en la ruta para tener efecto, ya que declararla sin aplicarla no cambia el tratamiento de las solicitudes.

Fragmento de la implementación vulnerable en `src/routes/auth.routes.ts:18-20`.

```ts
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
```

#### E. Cómo se corrige

El router aplica `express-rate-limit` antes de validar credenciales. La configuración fija una ventana de 15 minutos, un límite de nueve y respuesta pública `429` para solicitudes bloqueadas. Usa cabeceras estándar y excluye los éxitos del conteo. En Compose opera con el almacén en memoria y la clave por IP predeterminados de esa integración.

Fragmento de [`src/routes/auth.routes.ts:10-21`](src/routes/auth.routes.ts#L10-L21).

```ts
const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 9,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos de inicio de sesión. Intentá nuevamente más tarde.',
    });
  },
});
```

[Montaje del limitador en el login](src/routes/auth.routes.ts#L33)

#### F. Cómo se verifica que quedó resuelto

«el login bloquea o limita los intentos repetidos» verifica que el límite produzca una señal de bloqueo. «el login correcto sigue funcionando después de un bloqueo» admite estados de bloqueo y ofrece cobertura parcial de la recuperación. `npm test` verifica la autenticación legítima y el rechazo ordinario. `npm run check:security` verifica `AUTH-04`. La recuperación se evalúa controlando la vigencia de la ventana en un estado de prueba y comprobando que un login válido vuelva a ser aceptado cuando corresponda. [Pruebas de seguridad](tests/seguridad-fuerza-bruta.test.ts#L33-L72) · [Comandos de verificación](#comandos-de-verificación)

### 13. Cookies de sesión sin atributos seguros

#### A. Qué es y por qué importa

La cookie `sid` representa una sesión autenticada. Sus atributos restringen cómo la accede JavaScript, cuándo se envía en una navegación iniciada en otro sitio y por qué transporte puede circular. Una cookie emitida sin esos atributos deja más expuesta la sesión de una persona que opera el panel. El backend debe complementar esos atributos con validación y revocación de la sesión.

#### B. Dónde está

- **Implementación vulnerable** · `src/middleware/sesion.ts:48-65`, función `crearSesion`.
- **Implementación corregida** · `src/middleware/sesion.ts:32-49`, opciones y limpieza, y `src/middleware/sesion.ts:67-86`, creación. El entorno se toma de `src/config.ts:13-15`. [Opciones](src/middleware/sesion.ts#L32-L49) · [Creación](src/middleware/sesion.ts#L67-L86)

#### C. Cómo se observa: pasos y evidencia

1. Iniciar sesión con una cuenta descartable e inspeccionar los atributos de `Set-Cookie` sin registrar su valor. El código vulnerable fija la ruta, dejando que los demás atributos dependan de los valores predeterminados.
2. En desarrollo local, comprobar que la aplicación emite `HttpOnly` y `SameSite=Lax`. El navegador y la prueba de sesión permiten observar esas restricciones.
3. En un proceso de prueba con `NODE_ENV=production`, inspeccionar la misma cabecera y comprobar también `Secure`. La evidencia acredita su emisión por el servidor. La protección en un despliegue requiere HTTPS.

La inspección del código permite verificar que la creación y la limpieza de la cookie comparten las opciones base.

#### D. Por qué ocurre

La llamada original a `res.cookie` no establecía ninguna de las tres banderas. Express emitía la cookie con el alcance de ruta especificado, sin las restricciones explícitas de acceso y transporte que requiere una sesión.

Fragmento de la implementación vulnerable en `src/middleware/sesion.ts:62-64`.

```ts
  res.cookie('sid', id, { path: '/' });

  return id;
```

#### E. Cómo se corrige

Se comparten las opciones base para emitir y limpiar `sid`. `HttpOnly` reduce su exposición a JavaScript y `SameSite=Lax` limita su envío en solicitudes iniciadas desde otros sitios. `Secure` se activa al usar el modo de producción. `maxAge` coincide con la duración definida por el servidor. Las escrituras conservan la verificación CSRF incluso con `SameSite`.

Fragmento de [`src/middleware/sesion.ts:32-49`](src/middleware/sesion.ts#L32-L49).

```ts
const DURACION_SESION = 8 * 60 * 60 * 1000;

const opcionesCookieBase = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const opcionesCookie = {
  ...opcionesCookieBase,
  maxAge: DURACION_SESION,
};

/** Elimina la cookie utilizando los mismos atributos de creación. */
export function limpiarCookieSesion(res: Response): void {
  res.clearCookie('sid', opcionesCookieBase);
}
```

#### F. Cómo se verifica que quedó resuelto

«la cookie de sesión lleva HttpOnly, Secure y SameSite» comprueba `HttpOnly` y `SameSite`. En desarrollo busca la opción `secure` en el código. En producción exige el atributo en la respuesta. Las comprobaciones acreditan las banderas esperadas para ambos entornos. `npm run check:security` cubre `AUTH-05/06` y `CSRF-02`. La comprobación de cabeceras en modo de producción acredita la configuración del servidor, y el despliegue por HTTPS determina su aplicación en el navegador. [Prueba de cookies](tests/seguridad.test.ts#L505-L530) · [Comandos de verificación](#comandos-de-verificación)

### 14. Identificadores de sesión predecibles

#### A. Qué es y por qué importa

El identificador de sesión debe ser impredecible para que la posesión de una sesión válida se limite a quien la recibió. Un contador revela el patrón de generación, aun si se agrega un prefijo. El impacto potencial es que una sesión activa pueda atribuirse a otra persona y se adopten sus permisos, incluidos los de administración.

#### B. Dónde está

- **Implementación vulnerable** · `src/middleware/sesion.ts:29-30` y `src/middleware/sesion.ts:48-65`, contador y creación de sesión.
- **Implementación corregida** · `src/middleware/sesion.ts:67-86`. La ruta de login revoca además el contexto CSRF anterior antes de crear la nueva sesión en `src/routes/auth.routes.ts:60-64`. [Creación actual](src/middleware/sesion.ts#L67-L86) · [Login](src/routes/auth.routes.ts#L60-L64)

#### C. Cómo se observa: pasos y evidencia

1. Localizar el estado que usa la implementación vulnerable al crear un ID de sesión. El contador del proceso y su incremento permiten identificar la falta de aleatoriedad por inspección.
2. Iniciar sesiones legítimas de prueba y comparar dentro del proceso si los identificadores obtenidos son distintos. Registrar el formato y las longitudes, conservando los valores dentro del entorno.
3. Inspeccionar el generador de la aplicación corregida. La evidencia de código identifica 32 bytes de una fuente criptográfica y una representación hexadecimal de 64 caracteres.

Los casos de sesión acreditan diferencias entre identificadores y descartan formas triviales de contador. La fuente del generador sostiene la propiedad de imprevisibilidad.

#### D. Por qué ocurre

La función original dependía de un entero que aumentaba en cada creación. Los identificadores expresaban ese estado compartido. La apariencia de cadena de texto no aportaba entropía. El almacenamiento en un `Map` tampoco daba imprevisibilidad a las claves.

#### E. Cómo se corrige

`randomBytes(32)` obtiene 32 bytes de una fuente criptográfica y la codificación hexadecimal genera 64 caracteres. Al iniciar otra sesión con una cookie anterior para ese navegador se elimina la entrada anterior. La sesión nueva recibe vigencia propia y la aplicación entrega la cookie con los atributos de la sección anterior.

Fragmento de [`src/middleware/sesion.ts:67-86`](src/middleware/sesion.ts#L67-L86).

```ts
export function crearSesion(req: Request, res: Response, usuario: UsuarioSesion): string {
  // Revoca cualquier sesión anterior presentada por este navegador.
  const idAnterior = leerCookies(req).sid;
  if (idAnterior) sesiones.delete(idAnterior);

  // Identificador criptográficamente aleatorio.
  const id = randomBytes(32).toString('hex');

  const ahora = Date.now();

  sesiones.set(id, {
    usuario,
    creadaEn: ahora,
    expiraEn: ahora + DURACION_SESION,
  });

  res.cookie('sid', id, opcionesCookie);

  return id;
}
```

#### F. Cómo se verifica que quedó resuelto

«el identificador de sesión es aleatorio y no predecible» verifica diferencia entre las muestras, descarta formas sencillas de contador y exige una longitud mínima. El caso y los controles `AUTH-07/08` son satisfactorios. La lectura de `randomBytes` confirma la fuente criptográfica. Las muestras ejercitan el contrato observable de las sesiones, mientras que la inspección explica de dónde proviene la entropía. [Prueba de identificadores](tests/seguridad.test.ts#L532-L555) · [Comandos de verificación](#comandos-de-verificación)

### 15. Sesiones sin expiración

#### A. Qué es y por qué importa

Una sesión válida durante un tiempo indefinido amplía el impacto de una cookie olvidada o comprometida y deja abiertas sesiones en equipos compartidos. El navegador puede dejar de enviar una cookie por restricciones locales. El servidor debe decidir la vigencia cada vez que comprueba la sesión.

#### B. Dónde está

- **Implementación vulnerable** · `src/middleware/sesion.ts:55-58` y `src/middleware/sesion.ts:68-73`, persistencia sin vencimiento y lectura por ID.
- **Implementación corregida** · `src/middleware/sesion.ts:32-44`, duración y cookie, `src/middleware/sesion.ts:75-83`, registro de expiración, y `src/middleware/sesion.ts:89-102`, consulta. [Duración](src/middleware/sesion.ts#L32-L44) · [Consulta](src/middleware/sesion.ts#L89-L102)

#### C. Cómo se observa: pasos y evidencia

1. Localizar `expiraEn` y seguir la recuperación de una sesión por su ID en la implementación vulnerable. La entrada se guarda sin fecha límite y la recuperación omite la comparación temporal.
2. Abrir una sesión legítima de una cuenta ficticia y comprobar que el servidor acepta una consulta mientras esa sesión se encuentra vigente.
3. En el proceso de prueba, configurar el instante de expiración de la propia sesión para que esté vencida y consultar `/api/auth/yo`. La comprobación devuelve `401` y verifica que la sesión deja de estar en el mapa.

El reloj controlado permite comprobar la decisión de vencimiento. La constante de ocho horas fija el intervalo real de la sesión.

#### D. Por qué ocurre

La estructura admitía representar una fecha, pero el código siempre guardaba un vencimiento nulo. La lectura consideraba suficiente que el ID existiera. Aunque el cliente dejara de usar la cookie, ese comportamiento mantenía válida la entrada mientras persistiera en el proceso.

Fragmento de la implementación vulnerable en `src/middleware/sesion.ts:55-59`.

```ts
  sesiones.set(id, {
    usuario,
    creadaEn: Date.now(),
    expiraEn: null,
  });
```

#### E. Cómo se corrige

El servidor registra un vencimiento absoluto de ocho horas al crear la sesión. La cookie tiene el mismo plazo máximo. Al consultar la entrada, el servidor compara el instante actual con `expiraEn`. Si ya venció, elimina la entrada y trata la solicitud como no autenticada. El vencimiento absoluto conserva una cota aunque la sesión se use de forma continua.

Fragmento de [`src/middleware/sesion.ts:75-83`](src/middleware/sesion.ts#L75-L83).

```ts
  const ahora = Date.now();

  sesiones.set(id, {
    usuario,
    creadaEn: ahora,
    expiraEn: ahora + DURACION_SESION,
  });

  res.cookie('sid', id, opcionesCookie);
```

Fragmento de [`src/middleware/sesion.ts:89-102`](src/middleware/sesion.ts#L89-L102).

```ts
export function obtenerSesion(req: Request): Sesion | null {
  const id = leerCookies(req).sid;
  if (!id) return null;

  const sesion = sesiones.get(id);
  if (!sesion) return null;

  if (sesion.expiraEn !== null && Date.now() >= sesion.expiraEn) {
    sesiones.delete(id);
    return null;
  }

  return sesion;
}
```

#### F. Cómo se verifica que quedó resuelto

La batería de seguridad carece de un caso dinámico dedicado a la expiración. La verificación con una sesión vencida confirma `401` y eliminación de la entrada. `npm test` comprueba la consulta satisfactoria de una sesión vigente y `npm run check:security` cubre `AUTH-09/10`. Así se ejercitan las dos decisiones del servidor para una sesión presente, según su vigencia. [Reglas de expiración](scripts/check-security.ts#L420-L438) · [Consulta funcional](tests/auth.test.ts#L33-L43) · [Comandos de verificación](#comandos-de-verificación)

### 16. Logout sin invalidación de sesión en el servidor

#### A. Qué es y por qué importa

Borrar una cookie del navegador cambia lo que ese navegador envía. La revocación requiere que el servidor deje de reconocer la sesión. En el panel, un logout que sólo limpia la cookie puede dar apariencia de cierre mientras el acceso asociado sigue válido en el proceso. El token que autorizaba escrituras para esa sesión debe perder vigencia también.

#### B. Dónde está

- **Implementación vulnerable** · `src/routes/auth.routes.ts:69-72`, logout, y `src/middleware/sesion.ts:76-80`, función de borrado disponible pero desconectada del logout.
- **Implementación corregida** · `src/routes/auth.routes.ts:82-88`, `src/middleware/sesion.ts:47-49` y `src/middleware/sesion.ts:105-109`, y `src/middleware/csrf.ts:104-107`. [Logout](src/routes/auth.routes.ts#L82-L88) · [Invalidación en servidor](src/middleware/sesion.ts#L105-L109)

#### C. Cómo se observa: pasos y evidencia

1. Usar una cuenta ficticia y comprobar el acceso a `/api/auth/yo` con su sesión legítima. Examinar qué cambios aplica el logout a la cookie y a la entrada del mapa.
2. En la implementación vulnerable, la ruta solicita al navegador que elimine la cookie. El mapa conserva la entrada que reconoce el servidor.
3. Desde el panel corregido, cerrar la sesión de prueba. Verificar que el estado de servidor queda invalidado y que la consulta deja de devolver el usuario. La prueba automatizada comprueba esa invalidación con la sesión legítima que ella misma crea. El recorrido en Chrome confirma el cierre desde la interfaz.

La eliminación de la cookie y la revocación del estado del servidor tienen comprobaciones diferenciadas.

#### D. Por qué ocurre

El handler no llamaba a la función que elimina la entrada. La cookie y el mapa son estados diferentes. Limpiar el primero no cambiaba la respuesta de `obtenerSesion` para ese ID mientras existiera en el mapa.

Fragmento de la implementación vulnerable en `src/routes/auth.routes.ts:69-72`.

```ts
router.post('/logout', (req, res) => {
  res.clearCookie('sid', { path: '/' });
  res.json({ mensaje: 'Sesión cerrada.' });
});
```

#### E. Cómo se corrige

La ruta revoca el CSRF asociado, elimina la sesión en memoria y limpia la cookie con los atributos que corresponden. El panel confirma la operación con el resultado de la API y tiene un camino de recuperación si la sesión ya venció o fue revocada. El panel consulta la vigencia de la sesión cuando un rechazo impide confirmar el cierre. Si el backend confirma que la sesión se perdió, limpia el estado del panel y vuelve al formulario de ingreso.

Fragmento de [`src/routes/auth.routes.ts:82-88`](src/routes/auth.routes.ts#L82-L88).

```ts
router.post('/logout', (req, res) => {
  const sid = leerCookies(req).sid;
  if (sid) revocarCsrfSesion(sid);
  destruirSesion(req);
  limpiarCookieSesion(res);
  res.json({ mensaje: 'Sesión cerrada.' });
});
```

Fragmento de [`src/middleware/sesion.ts:105-109`](src/middleware/sesion.ts#L105-L109).

```ts
export function destruirSesion(req: Request): void {
  //const cookies = leerCookies(req);
  const id = leerCookies(req).sid;
  if (id) sesiones.delete(id);
}
```

#### F. Cómo se verifica que quedó resuelto

«el logout invalida la sesión en el servidor» acredita acceso con la sesión de prueba y rechazo de esa misma sesión tras el cierre. El caso tiene resultado satisfactorio. `npm test` cubre el `200` del logout y `npm run check:security` verifica `AUTH-11`. La evidencia en el navegador confirma que el panel refleja la respuesta de la API. La condición esperada incluye la limpieza de la cookie y la revocación de sesión y CSRF asociados. [Revocación](tests/seguridad.test.ts#L557-L580) · [Logout funcional](tests/auth.test.ts#L61-L69) · [Comandos de verificación](#comandos-de-verificación)

### 17. Enumeración de usuarios durante el login

#### A. Qué es y por qué importa

Si un login fallido distingue entre cuenta inexistente y contraseña incorrecta, la aplicación confirma qué nombres están registrados. Eso facilita dirigir intentos a cuentas reales, incluidas las del personal. La exposición puede producirse en el cuerpo HTTP o por diferencias evidentes de procesamiento.

#### B. Dónde está

- **Implementación vulnerable** · `src/routes/auth.routes.ts:27-40`, dos mensajes de error y una búsqueda adicional.
- **Implementación corregida** · `src/routes/auth.routes.ts:60-69`, respuesta uniforme, y `src/services/usuarios.service.ts:30-33` y `src/services/usuarios.service.ts:89-106`, comparación de costo comparable. [Respuesta pública](src/routes/auth.routes.ts#L60-L69) · [Comparación](src/services/usuarios.service.ts#L89-L106)

#### C. Cómo se observa: pasos y evidencia

1. Inspeccionar las respuestas de error del login vulnerable. La ruta consulta si existe el nombre y expone el resultado mediante dos mensajes distintos para el mismo estado HTTP.
2. En la aplicación corregida, realizar dos intentos ordinarios de login con credenciales ficticias inválidas. La primera corresponde a una cuenta de prueba conocida y la segunda a un nombre inexistente. Cotejar el estado y el cuerpo.
3. Verificar que ambos recorridos responden `401` con el mismo mensaje. La inspección del servicio muestra una comparación bcrypt en los dos casos.

La respuesta uniforme se verifica funcionalmente. El camino común hasta bcrypt aporta evidencia sobre el trabajo de comparación, sin demostrar igualdad temporal absoluta.

#### D. Por qué ocurre

Una causa es exponer la existencia de la cuenta mediante dos mensajes públicos. Otra diferencia surge cuando el flujo bcrypt retorna al no encontrar el usuario y sólo ejecuta la comparación para cuentas registradas. Ambos comportamientos permiten distinguir casos que deben recibir un tratamiento público uniforme.

#### E. Cómo se corrige

La ruta devuelve el mismo `401` y mensaje si la autenticación no produce un usuario. El servicio elige entre el hash guardado y un hash de referencia creado una vez por proceso con el costo configurado. Ejecuta una comparación en ambos casos y sólo continúa si hay usuario y la contraseña coincide.

Fragmento de [`src/services/usuarios.service.ts:94-100`](src/services/usuarios.service.ts#L94-L100).

```ts
  const usuario = await buscarPorUsername(username);
  const hash = usuario ? usuario.password : HASH_DE_REFERENCIA;
  const passwordValida = await bcrypt.compare(password, hash);

  if (!usuario || !passwordValida) {
    return null;
  }
```

Fragmento de [`src/routes/auth.routes.ts:66-70`](src/routes/auth.routes.ts#L66-L70).

```ts
    if (!usuario) {
      return res.status(401).json({
        error: 'Usuario o contraseña incorrectos.'
      });
    }
```

#### F. Cómo se verifica que quedó resuelto

«los mensajes de login son genéricos (sin enumeración de usuarios)» compara las respuestas públicas y tiene resultado satisfactorio. `npm test` comprueba además los rechazos por contraseña incorrecta y nombre inexistente. `npm run check:security` verifica `AUTH-12`. Una respuesta uniforme cierra la diferencia de mensajes. Ejecutar una comparación bcrypt en ambos recorridos evita una diferencia de costo evidente por ausencia total de comparación. [Caso de seguridad](tests/seguridad-login.test.ts#L40-L56) · [Rechazos funcionales](tests/auth.test.ts#L45-L54) · [Comandos de verificación](#comandos-de-verificación)

### 18. Autorización ausente en el panel de administración

#### A. Qué es y por qué importa

Las sesiones de usuarios comunes sirven para acreditar identidad. Las operaciones para administrar productos, usuarios o archivos requieren además permisos. Si el servidor sólo exige login, una cuenta de cliente puede alcanzar funciones que modifican la operación de la cafetería. Ocultar controles en el navegador no establece una barrera de autorización.

#### B. Dónde está

- **Implementación vulnerable** · `src/routes/admin.routes.ts:31-40` y `src/routes/admin.routes.ts:49-66`, router protegido sólo por sesión. `src/middleware/auth.ts:27-37` ya definía una comprobación de roles.
- **Implementación corregida** · `src/routes/admin.routes.ts:25-58`, orden entre sesión, excepción de cambio personal y rol administrativo. `src/middleware/auth.ts:16-37` fija los rechazos. [Router administrativo](src/routes/admin.routes.ts#L25-L58) · [Permisos](src/middleware/auth.ts#L16-L37)

#### C. Cómo se observa: pasos y evidencia

1. Preparar una cuenta común y otra administrativa de prueba. Utilizar el servicio de login habitual para obtener una sesión válida de cada rol.
2. En el router vulnerable, identificar qué middlewares preceden a las operaciones administrativas. La comprobación de sesión deja pasar las identidades autenticadas sin distinguir sus permisos de gestión.
3. Consultar el listado de usuarios mediante la API corregida como visitante, usuario común y administrador. La comprobación devuelve `401`, `403` y `200`, respectivamente.

El acceso a esos recursos se comprueba en la API. El HTML de ingreso conserva su disponibilidad pública.

#### D. Por qué ocurre

La ruta confundía dos decisiones. `requiereSesion` respondía quién hizo la petición. El router no aplicaba `requiereRol` para decidir si esa identidad podía administrar. El rol disponible en la sesión quedaba sin uso como condición de acceso.

Fragmento de la implementación vulnerable en `src/routes/admin.routes.ts:31-36`.

```ts
router.use(requiereSesion);

/** GET /api/admin/usuarios */
router.get('/usuarios', async (req, res, next) => {
  try {
    res.json({ usuarios: await usuarios.listar() });
```

#### E. Cómo se corrige

El router exige sesión y aplica `requiereRol('admin')` a las funciones de gestión. La ruta personal de contraseña queda bajo la comprobación de sesión y usa el ID de esa identidad. Las escrituras pasan por la protección CSRF global. Los middlewares rechazan una sesión ausente con `401` y un rol insuficiente con `403`.

Fragmento de [`src/routes/admin.routes.ts:25-49`](src/routes/admin.routes.ts#L25-L49).

```ts
router.use(requiereSesion);

/** POST /api/admin/cambiar-contrasena — cambio personal para toda sesión válida. */
router.post('/cambiar-contrasena', async (req, res, next) => {
  try {
    const { nueva }: { nueva?: unknown } = req.body || {};
    if (!nueva) {
      return res.status(400).json({ error: 'Falta la contraseña nueva.' });
    }
    if (!usuarios.esFormatoPasswordValido(nueva)) {
      return res.status(400).json({ error: 'Contraseña nueva inválida.' });
    }
    if (usuarios.excedeLimitePassword(nueva)) {
      return res.status(400).json({ error: 'La contraseña nueva no puede superar 72 bytes en UTF-8.' });
    }

    // (`req.usuario!`: requiereSesion ya garantizó que hay un usuario.)
    const usuario = await usuarios.cambiarPassword(req.usuario!.id, nueva);
    res.json({ mensaje: 'Contraseña actualizada.', usuario });
  } catch (err) {
    next(err);
  }
});

router.use(requiereRol('admin'));
```

Fragmento de [`src/middleware/auth.ts:27-37`](src/middleware/auth.ts#L27-L37).

```ts
export function requiereRol(...roles: Rol[]): RequestHandler {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Necesitás iniciar sesión.' });
    }
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tenés permisos para esta operación.' });
    }
    next();
  };
}
```

#### F. Cómo se verifica que quedó resuelto

«un usuario sin rol admin NO puede entrar al panel» exige un rechazo del router y admite `401` o `403`. El caso tiene resultado satisfactorio. La evidencia complementaria comprueba ambos motivos de rechazo y la respuesta `200` del rol admitido sobre el listado real. `npm run check:security` verifica `AUTH-14`. `npm test` comprueba independientemente que se sirve la página de ingreso. [Prueba de autorización](tests/seguridad.test.ts#L582-L599) · [Respuesta del HTML](tests/reportes.test.ts#L80-L83) · [Comandos de verificación](#comandos-de-verificación)

### 19. Escalada de privilegios mediante modificación del rol

#### A. Qué es y por qué importa

Modificar un rol cambia las acciones que puede realizar una cuenta. Además de exigir permiso para editarlo, el servidor debe impedir que una sesión conserve privilegios anteriores después del cambio. En Cafetería Origen una elevación indebida abriría las funciones del panel. Una reducción mal sincronizada permitiría seguir administrando con una sesión anterior.

#### B. Dónde está

- **Implementación vulnerable** · `src/routes/admin.routes.ts:31-36` y `src/routes/admin.routes.ts:49-66`, recepción del rol y actualización accesible a una sesión común.
- **Implementación corregida** · `src/routes/admin.routes.ts:14-19`, `src/routes/admin.routes.ts:49-51` y `src/routes/admin.routes.ts:61-112`. La actualización y revocación están en `src/services/usuarios.service.ts:38-51`, `src/services/usuarios.service.ts:67-74` y `src/services/usuarios.service.ts:135-177`. La emisión de sesión vuelve a leer la fila en `src/services/usuarios.service.ts:102-112`. [Ruta de edición](src/routes/admin.routes.ts#L61-L112) · [Actualización sincronizada](src/services/usuarios.service.ts#L160-L177)

#### C. Cómo se observa: pasos y evidencia

1. Identificar en el código vulnerable qué sesiones alcanzan la edición de usuarios y cómo se admite el campo `rol`. Una cuenta común satisface la comprobación de sesión, aunque la modificación tiene un efecto sobre privilegios.
2. En la aplicación corregida, intentar una edición ordinaria con la cuenta común ficticia y un CSRF válido. La comprobación de autorización devuelve `403` sin alterar los datos.
3. Realizar una modificación de rol legítima como administrador de prueba. Verificar que la sesión de la cuenta editada recibe `401` y que un login válido refleja el rol vigente. La prueba de comportamiento confirma ambos efectos.

El uso de CSRF válido permite atribuir el rechazo de la edición a los permisos. La revocación del contexto evita que una sesión conserve privilegios desactualizados.

#### D. Por qué ocurre

La ruta original aceptaba el campo `rol` sin una condición de autorización suficiente. La sesión guardaba una copia del rol. Si la base cambiaba y la sesión seguía vigente, la comprobación de permisos podía usar información desactualizada. Un login concurrente añade el riesgo de emitir una sesión durante la transición.

#### E. Cómo se corrige

El router exige `admin` y la actualización admite sólo campos identificados como editables. Para el rol se exige pertenencia a la lista `admin`, `barista`, `mozo`, `cliente`. El servicio limita columnas, enlaza sus valores y evita responder el hash. El servicio serializa la escritura y la emisión de sesión por usuario. El login vuelve a leer el estado vigente y el cambio efectivo de rol o contraseña revoca sesiones y CSRF.

Fragmento de [`src/routes/admin.routes.ts:89-102`](src/routes/admin.routes.ts#L89-L102).

```ts
    if (rol !== undefined && !esRolAdministrable(rol)) {
      return res.status(400).json({ error: 'Rol inválido.' });
    }
    if (password !== undefined && (!usuarios.esFormatoPasswordValido(password) || usuarios.excedeLimitePassword(password))) {
      return res.status(400).json({ error: 'Contraseña inválida.' });
    }

    const cambios: Partial<Usuario> = {};
    if (username !== undefined) cambios.username = username;
    if (nombre !== undefined) cambios.nombre = nombre;
    if (rol !== undefined) cambios.rol = rol;
    if (password !== undefined) cambios.password = password;

    const usuario = await usuarios.actualizar(id, cambios);
```

Fragmento de [`src/services/usuarios.service.ts:160-176`](src/services/usuarios.service.ts#L160-L176).

```ts
  return serializarPorUsuario(id, async () => {
    const incluyeRol = typeof cambios.rol === 'string';
    const rolAnterior = incluyeRol
      ? (await db.query<Pick<Usuario, 'rol'>>('SELECT rol FROM usuarios WHERE id = $1', [id])).rows[0]?.rol
      : undefined;

    const { rows: [actualizado] } = await db.query<UsuarioPublico>(
      `UPDATE usuarios SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING id, username, rol, nombre, creado_en`,
      valores
    );
    if (!actualizado) return null;

    const cambioRol = incluyeRol && actualizado.rol !== rolAnterior;
    if (typeof cambios.password === 'string' || cambioRol) {
      revocarAccesosUsuario(actualizado.id);
    }
    return actualizado;
```

#### F. Cómo se verifica que quedó resuelto

«un usuario NO puede cambiar su propio rol a admin» evalúa la conservación del rol y su solicitud carece de CSRF. Un rechazo del middleware puede satisfacer la aserción antes de comprobar permisos. La prueba de contrato utiliza una edición inocua con CSRF válido y confirma el rechazo del usuario común. El cambio legítimo comprueba la revocación y el nuevo login. `npm run check:security` verifica `AUTH-14` y `AUTH-15`. La revalidación en la sección por usuario sustenta el comportamiento concurrente. [Caso de seguridad](tests/seguridad.test.ts#L601-L620) · [Revalidación de sesión](src/services/usuarios.service.ts#L102-L112) · [Comandos de verificación](#comandos-de-verificación)

### 20. Inyección de comandos en la función de prueba de conexión

#### A. Qué es y por qué importa

La herramienta de diagnóstico llama a un programa del sistema. El destino debe ser un argumento de ese programa. Si una entrada pasa a formar parte de una cadena interpretada por un shell, el proceso puede ejecutar operaciones distintas de las previstas con los permisos del contenedor. Eso alcanza archivos, configuración y recursos de la aplicación.

#### B. Dónde está

- **Implementación vulnerable** · `src/routes/admin.routes.ts:149-161`, ruta `POST /api/admin/probar-conexion` con construcción de comando y llamada a `exec`.
- **Implementación corregida** · `src/routes/admin.routes.ts:163-212`, lista, lanzamiento y límites. Se aplica el permiso administrativo de la línea 49. El usuario del contenedor se define en `Dockerfile:27-30`. [Ruta y límites](src/routes/admin.routes.ts#L163-L212) · [Usuario de ejecución](Dockerfile#L27-L30)

#### C. Cómo se observa: pasos y evidencia

1. Inspeccionar en la implementación vulnerable qué parámetro recibe el destino y cómo se transmite al proceso. El dato se inserta en una cadena de comando y puede recibir un significado no previsto al pasar por un intérprete.
2. En el entorno corregido, utilizar un administrador ficticio y el formulario legítimo con CSRF válido. Elegir el destino de loopback permitido para comprobar el recorrido de la herramienta de conectividad.
3. Confirmar que la respuesta permite distinguir el resultado del diagnóstico local y que el proceso se ejecuta como usuario sin privilegios de administración del contenedor. La evidencia del destino IPv4 local registra `200` sin error y ejecución con UID `1000`.

La inspección de la lista de destinos y de los argumentos separados acredita la restricción del lanzamiento del proceso.

#### D. Por qué ocurre

El original usaba una API orientada a ejecutar una cadena de comando. El nombre aportado por el cliente quedaba dentro de esa cadena y no había una lista de destinos. El intérprete podía decidir que una parte del dato tenía un significado distinto al de un argumento del programa de diagnóstico.

#### E. Cómo se corrige

La ruta limita los destinos a loopback IPv4 e IPv6. Construye un arreglo de argumentos y ejecuta una ruta de binario fija con `spawn` y `shell: false`. El proceso tiene timeout de cinco segundos y un máximo agregado de 64 KiB de salida. Los errores que se devuelven al cliente se expresan con mensajes definidos por el servidor. La ejecución sin root agrega una capa de reducción de impacto.

Fragmento de [`src/routes/admin.routes.ts:163-176`](src/routes/admin.routes.ts#L163-L176).

```ts
const HOSTS_PRUEBA_CONEXION = new Set(['127.0.0.1', '::1']);
const TIEMPO_MAXIMO_CONEXION_MS = 5_000;
const SALIDA_MAXIMA_CONEXION = 64 * 1024;

/** POST /api/admin/probar-conexion */
router.post('/probar-conexion', (req, res) => {
  const { host } = req.body || {};
  if (typeof host !== 'string' || !HOSTS_PRUEBA_CONEXION.has(host)) {
    return res.status(400).json({ error: 'El destino debe ser 127.0.0.1 o ::1.' });
  }

  const argumentos = ['-c', '3', '-w', '4', host];
  const comando = ['ping', ...argumentos].join(' ');
  const proceso = spawn('/bin/ping', argumentos, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
```

La validación de destinos restringe el comportamiento de red previsto. La separación de argumentos y la ausencia de shell evitan interpretar el destino como una orden adicional.

#### F. Cómo se verifica que quedó resuelto

«el endpoint de conexión NO ejecuta el comando inyectado» y «el endpoint de conexión NO ejecuta un segundo comando encadenado» buscan señales de ejecución no prevista en la respuesta. El comportamiento legítimo se verifica con la prueba de loopback y el código confirma el rechazo `400` de los destinos fuera de la lista. `npm run check:security` comprueba `CMD-01`, `CMD-02` y `CMD-03`. La autorización, la validación del destino y el lanzamiento acotado cumplen funciones distintas. [Pruebas de seguridad](tests/seguridad.test.ts#L631-L668) · [Comandos de verificación](#comandos-de-verificación)

### 21. Exposición de información sensible en el diagnóstico

#### A. Qué es y por qué importa

Un diagnóstico interno puede facilitar el mantenimiento, pero sus datos deben limitarse a lo que necesita el operador. La configuración de PostgreSQL y el entorno del proceso contienen información que podría permitir acceso a otros componentes. Una respuesta de diagnóstico pública también reduce la incertidumbre sobre la instalación y sus servicios.

#### B. Dónde está

- **Implementación vulnerable** · `src/routes/debug.routes.ts:17-39`. El router se exponía en `src/app.ts:46`.
- **Implementación corregida** · `src/routes/debug.routes.ts:7-12`, con montaje en `src/app.ts:72`. Los middlewares comprueban sesión y rol desde `src/middleware/auth.ts:16-37`. [Diagnóstico](src/routes/debug.routes.ts#L7-L12) · [Montaje](src/app.ts#L72)

#### C. Cómo se observa: pasos y evidencia

1. Revisar los campos del diagnóstico vulnerable y los middlewares aplicados a la ruta. El código incorpora datos del entorno, de PostgreSQL y del proceso en una respuesta accesible sin identidad.
2. Consultar el diagnóstico corregido como visitante, cuenta común y administrador de prueba. Las comprobaciones verifican `401`, `403` y `200`, respectivamente.
3. Inspeccionar las claves de la respuesta autorizada. El contrato observado contiene `mensaje` y `version`, sin objetos de configuración ni datos de conexión.

La autorización se comprueba a partir de la identidad utilizada en cada consulta. El contenido permitido se verifica independientemente con la respuesta administrativa.

#### D. Por qué ocurre

El router original construía una respuesta con objetos internos completos o campos de configuración de acceso a PostgreSQL. Al carecer de una política de acceso y de una lista de campos públicos, cualquier dato agregado a ese objeto se volvía visible a quien consultara la ruta.

#### E. Cómo se corrige

El router aplica `requiereSesion` y `requiereRol('admin')` al diagnóstico. El handler construye explícitamente dos campos. La comprobación de salud pública conserva su endpoint independiente con datos de estado para la operación de Compose.

Fragmento de [`src/routes/debug.routes.ts:7-12`](src/routes/debug.routes.ts#L7-L12).

```ts
router.get('/', requiereSesion, requiereRol('admin'), (_req, res) => {
  res.json({
    mensaje: 'Diagnóstico del servidor',
    version: '1.0.0',
  });
});
```

#### F. Cómo se verifica que quedó resuelto

«el endpoint de diagnóstico NO expone secretos» revisa campos sensibles si obtiene `200` y admite un rechazo cuando la ruta se encuentra restringida. El caso tiene resultado satisfactorio. Las tres identidades de prueba verifican la autorización y la comprobación de las claves confirma la lista de campos públicos. `npm run check:security` verifica `CFG-03/04`. [Prueba de diagnóstico](tests/seguridad.test.ts#L675-L698) · [Comandos de verificación](#comandos-de-verificación)

### 22. Exposición de stack traces al cliente

#### A. Qué es y por qué importa

Una traza describe dónde falló el programa e incluye nombres de funciones y ubicaciones de archivos. Es información útil para diagnosticar en el servidor. En una respuesta pública puede revelar la arquitectura interna, dependencias o contexto de errores originados en datos. La API debe comunicar la clase de fallo con un mensaje estable y preservar detalles internos bajo control del operador.

#### B. Dónde está

- **Implementación vulnerable** · `src/middleware/errores.ts:17-31`, handlers de ruta inexistente y de errores.
- **Implementación corregida** · `src/middleware/errores.ts:5-38`, integrado al final de la aplicación en `src/app.ts:74-76`. [Manejador actual](src/middleware/errores.ts#L5-L38) · [Registro en Express](src/app.ts#L74-L76)

#### C. Cómo se observa: pasos y evidencia

1. Inspeccionar cómo la implementación vulnerable construye el cuerpo de error. La serialización pública del mensaje de excepción y de `stack` hace visible información interna.
2. En un proceso de prueba con datos ficticios, presentar un pedido válido y simular un fallo interno controlado en la segunda inserción. La solicitud incluye CSRF válido y alcanza el manejador de errores del servicio.
3. Comprobar que la implementación responde `500` con el único campo `error` y el mensaje fijo `Error interno.`. La comprobación registra ese resultado y verifica que la cabecera del pedido se revierte.

El código HTTP, la forma del cuerpo y la reversión son propiedades que se verifican de manera independiente.

#### D. Por qué ocurre

El middleware serializaba propiedades del objeto `Error` directamente a JSON. Las excepciones internas y los errores deliberados del cliente llegaban al mismo formato. También se reflejaba la URL original en el mensaje general de ruta inexistente.

Fragmento de la implementación vulnerable en `src/middleware/errores.ts:28-31`.

```ts
  res.status(err.status || 500).json({
    error: err.message,
    stack: err.stack,
  });
```

#### E. Cómo se corrige

El manejador emite respuestas públicas con mensajes controlados. Para un `4xx` válido se conserva el estado y se elige un mensaje de la tabla o un texto genérico de rechazo. Los demás errores devuelven `500` y un mensaje fijo. El log conserva metadatos acotados como método, plantilla de ruta y tipo de error. Si ya se enviaron cabeceras, se deriva un error sin los detalles de la excepción original.

Fragmento de [`src/middleware/errores.ts:19-38`](src/middleware/errores.ts#L19-L38).

```ts
export function manejadorErrores(err: ErrorHttp, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    // Express cierra la respuesta iniciada sin recibir los detalles del error original.
    next(new Error('Error interno después de iniciar la respuesta.'));
    return;
  }

  const estado = err?.status;
  if (typeof estado === 'number' && Number.isInteger(estado) && estado >= 400 && estado < 500) {
    res.status(estado).json({ error: mensajesCliente[estado] ?? 'Solicitud rechazada.' });
    return;
  }

  console.error('[error] Error interno', {
    metodo: req.method,
    ruta: req.route?.path,
    tipo: err instanceof TypeError ? 'TypeError' : 'Error',
  });
  res.status(500).json({ error: 'Error interno.' });
}
```

#### F. Cómo se verifica que quedó resuelto

«la API NO devuelve stack traces al cliente» comprueba que el cuerpo carezca de trazas. Su solicitud no incluye CSRF y puede recibir un rechazo en ese middleware. El fallo controlado con token válido alcanza el manejador y confirma `500` con un solo campo público. `npm run check:security` verifica `VAL-06`. El resultado esperado de un fallo interno es una respuesta genérica, con metadatos acotados del lado del servidor. [Prueba de errores](tests/seguridad.test.ts#L700-L714) · [Comandos de verificación](#comandos-de-verificación)

### 23. Ausencia de cabeceras HTTP de seguridad

#### A. Qué es y por qué importa

Las cabeceras permiten al servidor indicar qué recursos puede ejecutar el navegador, cómo debe interpretar el contenido y si una página admite enmarcado. La cafetería sirve HTML, JavaScript e imágenes bajo el mismo origen. Una política de navegador aporta una barrera adicional para el sitio público y el panel, incluida la exposición a enmarcado indebido y a interpretaciones de tipo inseguras.

#### B. Dónde está

- **Implementación vulnerable** · `src/app.ts:13-33`, creación y montaje de Express sin Helmet ni una política de contenido.
- **Implementación corregida** · `src/app.ts:29-47`, middleware global antes del servicio de estáticos y las rutas. [Política actual](src/app.ts#L29-L47)

#### C. Cómo se observa: pasos y evidencia

1. Revisar los middlewares de la implementación vulnerable antes del montaje de los recursos estáticos. La aplicación sirve el HTML sin establecer restricciones explícitas de contenido y enmarcado.
2. Consultar la página principal en el entorno corregido e inspeccionar CSP, `X-Content-Type-Options` y la protección de enmarcado. Las respuestas de prueba contienen las cabeceras previstas.
3. En un proceso con `NODE_ENV=production`, comprobar la emisión de HSTS. Esta observación acredita el comportamiento del servidor. La aplicación efectiva de HSTS en el navegador depende de un despliegue por HTTPS.

#### D. Por qué ocurre

El uso de Express para servir los recursos no definía por sí mismo la política de contenido del proyecto. Sin middleware de cabeceras ni configuración explícita, el navegador no recibía las restricciones adicionales que requerían las páginas del sitio.

#### E. Cómo se corrige

Helmet se aplica como middleware global. CSP usa el origen propio para scripts y conexiones, deshabilita objetos y restringe quién puede enmarcar la aplicación. Las imágenes pueden ser propias o `data:`, según el contrato de la interfaz. La política conserva estilos en línea y habilita HSTS en producción. Los scripts propios se sirven bajo la misma política de origen.

Fragmento de [`src/app.ts:29-47`](src/app.ts#L29-L47).

```ts
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    hsts: config.nodeEnv === 'production',
  }),
);
```

#### F. Cómo se verifica que quedó resuelto

«el sitio envía cabeceras de seguridad» exige CSP, `nosniff` y protección de enmarcado por `X-Frame-Options` o `frame-ancestors`. El caso y los controles `XSS-03` y `CFG-01` tienen resultado satisfactorio. `npm test` comprueba que se sirven las dos páginas y `npm run check:security` comprueba la presencia de la política. La verificación de producción acredita la emisión de HSTS. [Prueba de cabeceras](tests/seguridad.test.ts#L715-L732) · [Comandos de verificación](#comandos-de-verificación)

### 24. Configuración insegura de PostgreSQL

#### A. Qué es y por qué importa

PostgreSQL debe autenticar a los clientes y limitar el alcance del usuario de la aplicación. Una regla `trust` admite conexiones coincidentes sin comprobar una contraseña. Si la aplicación además usa un superusuario, una falla que alcanza la capa de datos hereda permisos para operaciones mucho más amplias que registrar pedidos o consultar el catálogo. La red privada y el principio de mínimo privilegio son medidas complementarias.

#### B. Dónde está

- **Implementación vulnerable** · `docker-compose.yml:22-29` y `docker-compose.yml:50-61`, y `src/config.ts:20-29`. El bootstrap ya contemplaba un usuario de aplicación en `docker/initdb/02-usuario-aplicacion.sql:15-24`, pero el servicio se configuraba con `postgres`.
- **Implementación corregida** · `docker-compose.yml:21-38` y `docker-compose.yml:49-70`, `src/config.ts:3-23`, `src/db.ts:4-12` y `docker/initdb/02-usuario-aplicacion.sql:3-43`. [Compose](docker-compose.yml#L21-L38) · [Configuración](src/config.ts#L3-L23) · [Permisos SQL](docker/initdb/02-usuario-aplicacion.sql#L22-L43)

#### C. Cómo se observa: pasos y evidencia

1. Identificar el modo de autenticación y el usuario del pool en la configuración vulnerable. Una regla `trust` permite conexiones coincidentes sin verificar contraseña. El pool usa un superusuario, aunque el esquema contempla un rol de aplicación.
2. En un volumen de prueba nuevo, comprobar que una conexión TCP legítima como `origen_app` se autentica y que la conexión sin contraseña se rechaza. La evidencia acredita el uso de SCRAM-SHA-256.
3. Consultar los atributos del rol y sus permisos mediante lecturas de metadatos. Verificar que las operaciones sobre tablas y secuencias requeridas por la aplicación funcionen con el rol limitado.

Los resultados acreditan la identidad efectiva del pool y el uso de permisos reducidos. Las pruebas de negocio comprueban las lecturas y escrituras necesarias sobre PostgreSQL.

#### D. Por qué ocurre

El problema combina autenticación y autorización de base. La regla de acceso histórica no exigía contraseña para conexiones coincidentes. El valor de `DB_USER` seleccionaba la cuenta de administración de PostgreSQL, aun con un rol restringido disponible. Publicar o no el puerto al host era una decisión independiente de esas dos condiciones.

Fragmento de la implementación vulnerable en `docker-compose.yml:29`.

```yaml
      POSTGRES_HOST_AUTH_METHOD: trust
```

#### E. Cómo se corrige

La configuración usa SCRAM para conexiones locales y TCP en una instalación nueva y requiere dos claves privadas mediante el entorno. `postgres` se usa para inicializar la base. El pool usa `origen_app`, que carece de superusuario y de permisos de creación de bases o roles. El script concede los permisos de tablas y secuencias necesarios para el negocio y la limpieza de datos de prueba. El healthcheck comprueba una conexión autenticada con ese usuario. PostgreSQL permanece sin puertos publicados.

Fragmento de [`docker-compose.yml:21-27`](docker-compose.yml#L21-L27).

```yaml
    environment:
      POSTGRES_DB: origen
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:?Configurar POSTGRES_PASSWORD en .env}"
      DB_PASSWORD: "${DB_PASSWORD:?Configurar DB_PASSWORD en .env}"
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256 --auth-local=scram-sha-256"
      POSTGRES_HOST_AUTH_METHOD: scram-sha-256
```

Fragmento de [`docker-compose.yml:55-59`](docker-compose.yml#L55-L59).

```yaml
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: origen
      DB_USER: origen_app
      DB_PASSWORD: "${DB_PASSWORD:?Configurar DB_PASSWORD en .env}"
```

Fragmento de [`docker/initdb/02-usuario-aplicacion.sql:22-35`](docker/initdb/02-usuario-aplicacion.sql#L22-L35).

```sql
ALTER ROLE origen_app
    LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
    PASSWORD :'db_password';
\unset db_password

REVOKE CONNECT, TEMPORARY ON DATABASE origen FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE origen TO origen_app;
GRANT USAGE ON SCHEMA public TO origen_app;

GRANT SELECT, INSERT ON TABLE
    public.usuarios, public.productos, public.pedidos, public.pedido_items, public.comentarios
    TO origen_app;
GRANT UPDATE ON TABLE public.usuarios, public.productos, public.pedidos TO origen_app;
```

La configuración de Node exige `DB_PASSWORD` y rechaza otros valores de `DB_USER`. El bootstrap modifica únicamente una instalación cuyo directorio de datos es nuevo. [Configuración del pool](src/db.ts#L4-L12) · [Arranque documentado](README.md#1-levantar-el-proyecto)

#### F. Cómo se verifica que quedó resuelto

«la aplicación NO se conecta con un superusuario de la base» verifica el rol efectivo del pool y tiene resultado satisfactorio. Las comprobaciones TCP acreditan el rechazo sin contraseña y SCRAM. `npm test` ejercita las operaciones de la aplicación. `npm run check:security` comprueba `SQLI-03/04/05` y `CFG-02`. `SQLI-04` inspecciona la publicación del puerto 5432 y la configuración confirma que PostgreSQL carece de puertos publicados. [Prueba de rol](tests/seguridad.test.ts#L232-L244) · [Comandos de verificación](#comandos-de-verificación)

## 5. Resultados de las verificaciones

Las comprobaciones funcionales, de tipos y del checker se realizan sobre la aplicación y PostgreSQL en un entorno Docker local. Las aserciones de la batería de seguridad, las observaciones del navegador y la inspección del código aportan evidencias complementarias.

| Verificación | Objetivo | Resultado |
|---|---|---|
| Tests funcionales | Preservar catálogo, pedidos, reportes, autenticación y páginas | **28/28** |
| Tests de seguridad | Verificar las correcciones mediante casos específicos | **29/29 informados**. La evidencia de ejecución disponible acredita **15/15** casos |
| Checklist crítico | Comprobar las reglas estáticas obligatorias | **37/37** |
| Checklist recomendado | Comprobar los controles estáticos complementarios | **5/5** |
| TypeScript | Verificar los tipos de la aplicación, las pruebas y los scripts | **Aprobado**, sin errores de tipos |

El registro disponible de la batería de seguridad es parcial. La cifra completa corresponde al resultado informado y carece de un registro íntegro de ejecución para su comprobación independiente. Las cifras del checker corresponden a sus controles estáticos. [Scripts de prueba](package.json#L7-L14) · [Evaluación del checker](scripts/check-security.ts#L638-L699)

### Comandos de verificación

Las comprobaciones emplean un proyecto Compose de prueba con PostgreSQL disponible y datos descartables. Los comandos se dirigen al servicio `app` de ese proyecto. `npm test` y las comprobaciones dinámicas pueden escribir datos.

```powershell
docker compose exec -T app npm test
docker compose exec -T app npm run typecheck
docker compose exec -T app npm run check:security
```

Los apartados de verificación identifican las aserciones de la batería `test:seguridad` por su título y archivo. Para comprobar un comportamiento ordinario de forma individual, puede seleccionarse el caso por su nombre. Este ejemplo ejecuta el caso de revocación de una sesión de prueba.

```powershell
docker compose exec -T app node --import tsx --test --test-concurrency=1 `
  --test-name-pattern="el logout invalida la sesión en el servidor$" tests/seguridad.test.ts
```

### Comprobaciones de comportamiento

- **Datos y persistencia.** Los filtros combinados, la selección por mesa y el reporte por origen devuelven los registros previstos. Las entradas fuera de límites se rechazan con CSRF válido. El fallo controlado en el segundo ítem de un pedido devuelve un `500` genérico y la cabecera se revierte.
- **Sesiones y permisos.** Las consultas administrativas y el diagnóstico distinguen visitante, usuario común y administrador mediante `401`, `403` y `200`. El cambio legítimo de rol y el vencimiento de una sesión de prueba invalidan el acceso. La respuesta administrativa de diagnóstico contiene exclusivamente mensaje y versión.
- **Navegador y archivos.** El recorrido en Chrome confirma catálogo, pedidos, reseñas, panel, reportes, alta de productos, texto literal, renovación de CSRF, cambio de contraseña y logout. Un PNG válido se guarda y se puede consultar. Un archivo de texto ordinario devuelve `415`. El usuario del contenedor tiene UID `1000` y realiza la prueba de conectividad sólo sobre loopback.
- **Configuración y entorno.** PostgreSQL usa SCRAM, rechaza una conexión sin contraseña y aplica permisos reducidos al rol de aplicación. Un proceso en modo de producción emite `Secure` y HSTS, junto con los atributos de cookie aplicables a la sesión.

### Hashing y control AUTH-02

`AUTH-02` es una regla de presencia sobre `src/inicializar.ts`. Aplica `/bcrypt\.hash|hashSync|hashPassword/i` al código con comentarios enmascarados. El seed llama a `hashPassword()`, y el servicio de usuarios centraliza `bcrypt.hash(password, COSTO_HASH)` con costo 10. El nombre satisface el criterio estático. La comprobación de PostgreSQL y el login válido acreditan que el helper genera verificadores persistidos y utilizables.

La carga inicial normal, las cuentas de demostración optativas y las escrituras de contraseña satisfacen el contrato de almacenamiento. La comparación bcrypt permite confirmar la relación entre entrada y verificador sin exponer sus valores. [Regla](scripts/check-security.ts#L346-L354) · [Helper](src/services/usuarios.service.ts#L62-L65) · [Seed](src/inicializar.ts#L50-L61)

## 6. Consideraciones y limitaciones

### Autorización del cambio de estado de pedidos

`PATCH /api/pedidos/:id/estado` pertenece al router público de pedidos. La barrera global de CSRF exige un contexto válido para escribir. El servidor puede emitir ese contexto a visitantes anónimos y el handler no comprueba sesión, rol ni titularidad. El servicio limita el ID y los estados aceptados. Esas comprobaciones protegen el formato de la actualización. La decisión sobre quién puede ejecutarla corresponde a la autorización. [Montaje de rutas](src/app.ts#L57-L72) · [Ruta pública](src/routes/pedidos.routes.ts#L60-L73) · [Validación del cambio](src/services/pedidos.service.ts#L159-L170)

El test funcional «el estado de un pedido se puede actualizar» exige `200` con un agente sin login. El helper obtiene un token CSRF para ese contexto. La interfaz utiliza la operación desde el panel, pero el backend admite la escritura anónima con un token válido. Por ello subsiste un riesgo de integridad para los pedidos. Exigir identidad y un rol modificaría el comportamiento aceptado por la prueba funcional. [Prueba de contrato](tests/pedidos.test.ts#L68-L83) · [Helper de PATCH](tests/helpers.ts#L85-L91) · [Uso en el panel](src/public/js/admin.js#L308-L317)

Para un sistema de producción corresponde aplicar `requiereSesion` y limitar el `PATCH` a un rol que gestione pedidos. Con la política administrativa del panel, puede aplicarse `requiereRol('admin')`. Si el negocio admite otros roles del personal, varios locales o titularidad de pedidos, los permisos deben considerar esos alcances. La creación pública puede permanecer como ruta independiente. El contrato de la prueba requiere una expectativa consistente con cualquier política nueva. Otras rutas públicas de escritura, como la baja de reseñas, requieren su propia definición de autorización. [Middlewares de permisos](src/middleware/auth.ts#L16-L37) · [Ruta de reseñas](src/routes/comentarios.routes.ts#L39-L49)

### Alcance operativo

- **Estado por proceso.** Las sesiones y los contextos CSRF se guardan en memoria. El vencimiento es absoluto y la consulta elimina la sesión vencida. El limitador también utiliza el almacenamiento en memoria del proceso. Un despliegue con varias instancias necesita estado compartido para mantener coherentes la verificación, la revocación y el conteo. [Sesiones](src/middleware/sesion.ts#L30-L44) · [CSRF](src/middleware/csrf.ts#L7-L10) · [Limitador](src/routes/auth.routes.ts#L10-L21)
- **Volúmenes inicializados.** Los scripts de bootstrap de PostgreSQL se aplican a un directorio de datos nuevo. Cambiar variables de entorno no modifica las credenciales de un clúster existente. El seed conserva las cuentas existentes y la transición de contraseñas antiguas tiene un procedimiento separado. [Arranque y volúmenes](README.md#1-levantar-el-proyecto) · [Script de transición](scripts/migrar-passwords.ts)
- **Modo de producción.** La configuración de la práctica usa desarrollo y publica la aplicación en loopback. La comprobación en modo de producción acredita la emisión de `Secure` y HSTS. La operación completa por HTTPS queda fuera de esa comprobación. El modo de demostración requiere una habilitación explícita y deshabilitarlo conserva las cuentas de demo que ya existen en el volumen. [Compose](docker-compose.yml#L52-L70) · [Cuentas de práctica](README.md#2-usuarios-de-práctica)
- **Alcance de la evidencia.** Algunas aserciones de la batería admiten cualquier `4xx` y una solicitud sin CSRF puede recibir rechazo antes de la validación o la autorización. Las comprobaciones complementarias usan un contexto válido y exigen el estado o efecto preciso.

## 7. Conclusión

Las propiedades de seguridad de Cafetería Origen se apoyan en controles que actúan sobre límites distintos. El backend valida la forma de los datos, ejecuta consultas parametrizadas y controla la consistencia de las escrituras. El navegador presenta los datos como texto. La identidad habilita la comprobación de permisos, el contexto CSRF protege la intención de las escrituras y la revocación limita la vigencia de sesiones y tokens. PostgreSQL se autentica mediante SCRAM y el rol de la aplicación opera con permisos acotados.

El conjunto de pruebas funcionales acredita la conservación de los contratos del negocio. Los casos de seguridad, el checker y las comprobaciones de comportamiento dan evidencia de propiedades específicas. La cobertura parcial de la ejecución documentada, la configuración de producción y la autorización pendiente del cambio de estado de pedidos delimitan el alcance de esa evidencia. Una evaluación técnica de la solución exige considerar las garantías implementadas y las condiciones bajo las que se verifican.
