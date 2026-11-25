# ☕ Cafetería Origen — TP4 de Ciberseguridad

Sitio web y API de una cafetería de especialidad para el práctico de **Redes y Seguridad (Programación IV)**. El ejercicio parte del sistema de Valentina y consiste en corregir fallas de seguridad conservando catálogo, pedidos, reseñas, reportes y administración.

---

## 1. Levantar el proyecto

Para iniciar, necesitás **Docker Desktop** en ejecución (o Docker Engine con Compose v2) y un puerto HTTP local disponible. Ejecutá los comandos desde la raíz del repositorio.

1. Si todavía no existe `.env`, copiá `.env.example` a `.env`.
2. Completá `POSTGRES_PASSWORD` para administrar PostgreSQL, `DB_PASSWORD` para el rol de aplicación `origen_app` y `ADMIN_PASSWORD` para entrar al panel como `admin`. Usá valores privados, aleatorios y distintos. El administrador inicial necesita al menos 12 caracteres y como máximo 72 bytes UTF-8.
3. Si el puerto 8080 está ocupado, configurá `APP_PORT` en `.env`. Compose calcula `APP_ORIGIN` como `http://localhost:<APP_PORT>`. Si abrís la aplicación con otro host, esquema o puerto, poné el origen exacto del navegador, sin barra final (por ejemplo `http://127.0.0.1:8090`).
4. Iniciá los servicios y comprobá su estado.

```bash
docker compose up -d --build
docker compose ps
```

| Qué | Dónde con el puerto predeterminado |
|---|---|
| Sitio web | http://localhost:8080 |
| Panel de administración | http://localhost:8080/admin.html |
| API | http://localhost:8080/api |
| Healthcheck | http://localhost:8080/api/salud |

Compose publica HTTP en `127.0.0.1` y mantiene PostgreSQL sin puerto publicado. En un **volumen nuevo**, PostgreSQL crea el esquema y el rol `origen_app` con autenticación SCRAM-SHA-256 y permisos limitados. La aplicación usa ese rol y carga el catálogo y los usuarios iniciales. Abrí el catálogo y probá el login para comprobar que la carga terminó.

En un **volumen existente**, los scripts de inicio de PostgreSQL no se vuelven a ejecutar. Cambiar `.env` tampoco cambia las claves de PostgreSQL ni de usuarios ya guardados. Conservá las credenciales de esa instalación y usá un entorno separado para probar una inicialización nueva. Los nombres de contenedor `origen_app` y `origen_db` y la red `red_origen` deben estar disponibles para el arranque estándar.

La aplicación corre como usuario `node` y guarda imágenes en el volumen `archivos_origen`. Si necesitás seguir utilizando un directorio de imágenes de una instalación anterior, configurá `UPLOADS_STORAGE=./uploads` y verificá que el usuario del contenedor tenga lectura del directorio y escritura para nuevas subidas. Se conservan los archivos del directorio anterior.

```bash
docker compose logs app
docker compose stop
```

En desarrollo, `src`, `tests` y `scripts` se montan desde el checkout. Usá `docker compose restart app` tras editar código y `docker compose up -d --build` si cambian la imagen o sus dependencias. `docker compose down` retira los contenedores y la red y conserva los volúmenes.

### Verificar

Usá la base nueva y descartable de la práctica. Los tests escriben datos.

```bash
docker compose exec app npm test
docker compose exec app npm run typecheck
docker compose exec app npm run check:security
```

La consigna incluye la batería `test:seguridad` y el script combinado `test:todo`. Registrá qué verificaciones de la rúbrica ejecutaste y cuáles quedan pendientes. El checker analiza código y devuelve `1` si falla un control crítico. `AUTH-02` reconoce el uso de `hashPassword()` en `inicializar.ts`. En una base nueva, el seed almacena los hashes bcrypt generados por el servicio de usuarios.

---

## 2. Usuarios de práctica

En una instalación normal se crea únicamente `admin` con `ADMIN_PASSWORD`. Para activar la demo local, configurá `DEMO_MODE=true` y completá `DEMO_PASSWORD` con otra clave privada que respete los mismos límites. La demo agrega `valentina` como administradora con `ADMIN_PASSWORD` y los perfiles `barista`, `mozo` y `cliente` con `DEMO_PASSWORD`. Desactivar el modo demo evita nuevos usuarios de demo y conserva las cuentas que ya existen en el volumen.

Las contraseñas se guardan como hashes bcrypt. Mantené `.env` fuera de Git.

---

## 3. Estructura

```
cafeteria-origen/
├── docker-compose.yml          # app + base de datos, red propia (10.89.0.0/24)
├── Dockerfile
├── tsconfig.json               # configuración de TypeScript
├── docker/initdb/              # esquema SQL + usuario de mínimos privilegios
├── src/
│   ├── server.ts               # arranque
│   ├── app.ts                  # Express, middlewares, rutas
│   ├── config.ts               # configuración por variables de entorno
│   ├── db.ts                   # pool de PostgreSQL
│   ├── catalogo.ts             # catálogo y cálculo de precios
│   ├── inicializar.ts          # carga inicial de datos
│   ├── tipos.ts                # tipos compartidos (filas de la base, sesión)
│   ├── middleware/             # sesión, auth, errores
│   ├── services/               # lógica de negocio
│   ├── routes/                 # endpoints REST
│   └── public/                 # el sitio web (HTML + CSS + JS)
├── tests/                      # tests funcionales (npm test)
│   ├── productos.test.ts
│   ├── pedidos.test.ts
│   ├── auth.test.ts
│   ├── reportes.test.ts
│   ├── seguridad.test.ts            # batería de seguridad (npm run test:seguridad)
│   ├── seguridad-login.test.ts      # (aislada: usa el rate limiter)
│   └── seguridad-fuerza-bruta.test.ts
└── scripts/check-security.ts   # checklist de seguridad (npm run check:security)
```

---

## 4. API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/productos?tipo=&variedad=&q=` | Catálogo con filtros |
| GET | `/api/productos/variedades` | Orígenes disponibles |
| GET | `/api/productos/:id` | Un producto |
| POST | `/api/pedidos` | Crear pedido (devuelve el total) |
| GET | `/api/pedidos?mesa=` | Pedidos de todas las mesas |
| GET | `/api/pedidos/:id` | Pedido con sus items |
| PATCH | `/api/pedidos/:id/estado` | Cambiar estado |
| GET | `/api/reportes/facturacion` | Total facturado |
| GET | `/api/reportes/cantidad-vendida` | Unidades por tipo |
| GET | `/api/reportes/mas-vendido` | Producto más vendido |
| GET | `/api/reportes/ticket-promedio` | Ticket promedio |
| GET | `/api/reportes/ventas-por-variedad?variedad=` | Ventas por origen |
| GET | `/api/comentarios` · POST `/api/comentarios` | Reseñas |
| POST | `/api/auth/login` · `/api/auth/logout` · GET `/api/auth/yo` | Sesión |
| — | `/api/admin/*` | Panel (usuarios, productos, conexión, subida de archivos) |
| GET | `/api/_diagnostico` | Diagnóstico del servidor |

### Reglas de negocio

`total de un pedido = Σ (calcularPrecio(producto) × cantidad)`
`calcularPrecio = gramos × precioPorGramo + precioBase`

Precio por gramo: Brasil 140 · Colombia 180 · Etiopía 240.
Precio base: espresso 2500 · filtrado 3200 · muffin 2500 · torta 4200.

El catálogo son **20 productos**: 9 espressos + 9 filtrados + 2 de pastelería.

---

## 5. Las fallas que hay que encontrar

Están alineadas con las planillas de seguridad del apunte y con OWASP Top 10.
La tabla es un resumen; el **inventario detallado con archivo y línea** está en
[`VULNERABILIDADES.md`](VULNERABILIDADES.md).

| # | Falla | Dónde | Control del checklist |
|---|---|---|---|
| 1 | **Inyección SQL** en el login | `services/usuarios.service.ts` | SQLI-01/02 |
| 2 | **Inyección SQL** en los filtros del catálogo | `services/catalogo.service.ts` | SQLI-01/02 |
| 3 | **Inyección SQL** en el filtro por mesa | `services/pedidos.service.ts` | SQLI-01/02 |
| 4 | **Inyección SQL** en el reporte por origen | `services/reportes.service.ts` | SQLI-01/02 |
| 5 | **XSS reflejado** en el buscador y en los mensajes de error | `public/js/app.js`, `routes/` | XSS-01/02 |
| 6 | **XSS almacenado** en las reseñas | `public/js/app.js` | XSS-01/02 |
| 7 | **XSS de DOM** en el panel | `public/js/admin.js` | XSS-01 |
| 8 | **CSRF** en todos los formularios que cambian estado | `routes/` | CSRF-01/02 |
| 9 | **Validación débil**: cantidades negativas, sin límites | `services/pedidos.service.ts` | VAL-01/02/03 |
| 10 | **Subida de archivos sin restricciones** (ni extensión, ni MIME, ni tamaño) | `routes/admin.routes.ts` | VAL-04/05 |
| 11 | **Contraseñas en texto plano** | `services/usuarios.service.ts`, `inicializar.ts` | AUTH-01/02/03 |
| 12 | **Sin protección contra fuerza bruta** | `routes/auth.routes.ts` | AUTH-04 |
| 13 | **Cookie de sesión sin HttpOnly/Secure/SameSite** | `middleware/sesion.ts` | AUTH-05/06 |
| 14 | **ID de sesión predecible** (contador) | `middleware/sesion.ts` | AUTH-07/08 |
| 15 | **Sesiones que nunca expiran** | `middleware/sesion.ts` | AUTH-09/10 |
| 16 | **Logout que no invalida la sesión en el servidor** | `routes/auth.routes.ts` | AUTH-11 |
| 17 | **Enumeración de usuarios** en el login | `routes/auth.routes.ts` | AUTH-12 |
| 18 | **Autorización ausente**: cualquier usuario entra al panel | `routes/admin.routes.ts` | AUTH-14 |
| 19 | **Escalada de privilegios**: cualquiera se cambia el rol a admin | `routes/admin.routes.ts` | AUTH-15 |
| 20 | **Inyección de comandos** en "probar conexión" | `routes/admin.routes.ts` | CMD-01/02/03 |
| 21 | **Exposición de secretos** por `/api/_diagnostico` | `routes/debug.routes.ts` | CFG-03/04 |
| 22 | **Stack traces al cliente** | `middleware/errores.ts` | VAL-06 |
| 23 | **Sin cabeceras de seguridad** (helmet, CSP) | `app.ts` | XSS-03 / CFG-01 |
| 24 | **Base de datos sin contraseña y con el superusuario** | `docker-compose.yml` | SQLI-03/05 |

Los detalle de cada falla, cómo observarlas **sin automatizar** y cómo
corregirlas están en:

- **[`VULNERABILIDADES.md`](VULNERABILIDADES.md)** — **catálogo completo** con la
  ubicación exacta (archivo y línea) de las 28 fallas, por qué ocurre cada una,
  cómo se observa a mano y qué control del checklist cubre.
- **[`GUIA-PRACTICA.md`](GUIA-PRACTICA.md)** — para los alumnos.


La tabla describe la versión inicial del práctico. El mapeo de los casos de seguridad está en
[`VULNERABILIDADES.md`](VULNERABILIDADES.md) (columna *Test que la detecta*).

---

## 6. Reglas de la práctica

El apunte es explícito: **se observa y se defiende, no se automatiza**.

- Todo se hace **contra la instalación local** (`localhost`). Nunca contra sistemas ajenos.
- **No se escriben scripts que automatiquen ataques** (ni de fuerza bruta, ni de CSRF).
  La observación es manual, desde la interfaz.
- Cada práctica va acompañada de una **reflexión**: ¿qué habría que cambiar en un
  proyecto real para que esto no pasara?

---

## 7. Entregables del alumno

Copiar el link del repositorio en [`Documento de Google Sheet`](https://docs.google.com/spreadsheets/d/1pDqMmQXn5BgECrv8xF_jXD2uE_Iyz9xq38HmnOxnvBU/edit?gid=0#gid=0)

## TP4 — Organización del equipo

La distribución aprobada, los contratos compartidos y la guía para comenzar están en la [planificación del TP4](docs/planificacion-tp4.md).

Especificaciones por bloque: [Homero — administración e infraestructura](docs/bloques/homero.md), [Federico — consultas y validación](docs/bloques/federico.md), [Nicolás — autenticación y sesiones](docs/bloques/nicolas.md) y [Matías — frontend, CSRF y cabeceras](docs/bloques/matias.md).
