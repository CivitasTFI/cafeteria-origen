# Bloque de Federico — Consultas e integridad del negocio

## 1. Responsable y objetivo

**Responsable:** Federico. **Rama asignada:** `fix/consultas-validacion-negocio`, desde `develop`, todavía no creada en esta etapa.

Corregir consultas y validación de pedidos con `pg`, conservando catálogo, precios, totales y reportes. Distribución y estrategia aprobadas; **implementación y pruebas aún no comenzaron**. Consultar la [planificación compartida](../planificacion-tp4.md).

## 2. Vulnerabilidades asignadas

| ID oficial | Vulnerabilidad | Referencia inicial |
|---|---|---|
| 2 | SQL en filtros del catálogo | `src/services/catalogo.service.ts:35–49` |
| 3 | SQL en filtro por mesa | `src/services/pedidos.service.ts:92–99` |
| 4 | SQL en reporte por origen | `src/services/reportes.service.ts:77–91`; interpolación en HAVING |
| 9 | Validación insuficiente de pedidos | `src/services/pedidos.service.ts:43–82` |

La consulta por ID de producto y la integridad de escritura son dependencias de 2/9, no vulnerabilidades principales nuevas.

## 3. Archivos previstos y propiedad

- [Servicio de catálogo](../../src/services/catalogo.service.ts), [pedidos](../../src/services/pedidos.service.ts) y [reportes](../../src/services/reportes.service.ts).
- [Rutas de productos](../../src/routes/productos.routes.ts), [pedidos](../../src/routes/pedidos.routes.ts) y [reportes](../../src/routes/reportes.routes.ts).
- [Acceso a datos](../../src/db.ts) sólo si hace falta una adaptación mínima para la transacción; conservar `pg` y acordar el cambio. `src/tipos.ts`, `src/config.ts` y posibles validadores comunes requieren editor coordinado.

No editar scripts del frontend, autenticación, administración ni comentarios sin comunicar primero la dependencia y acordar la interfaz. Matías coordina la validación acotada de reseñas como dependencia de 6; no se asigna a Federico una quinta falla principal.

## 4. Estado inseguro actual

`listar()` del catálogo concatena tipo, variedad y búsqueda; `obtener()` también interpola el ID. Pedidos concatena mesa y reportes concatena origen en HAVING. Otras consultas ya utilizan parámetros y muestran la infraestructura disponible.

El alta de pedidos confía en tipos TypeScript sin validación de ejecución, no comprueba producto antes de calcular y no limita cantidades/ítems. Inserta cabecera e ítems con consultas separadas sin transacción, por lo que un error puede dejar datos parciales. El esquema INTEGER no permite afirmar que cualquier texto se almacena como cantidad: puede fallar después de escribir la cabecera.

## 5. Solución acordada

### Consultas y filtros

Usar placeholders `$1`, `$2`, etc. y valores separados en todas las consultas afectadas, incluidos filtros combinados y el ID de producto. Las partes estructurales del SQL sólo se construyen con fragmentos internos controlados; nunca concatenar entrada externa ni usar blacklist de caracteres.

Preservar la búsqueda parcial ILIKE por nombre/descripción y el orden actual por tipo, variedad e ID; no quitar filtros para evitar la inyección. Tipo/origen opcionales aceptan vacío como ausencia de filtro. Permitir sólo `espresso`, `filtrado`, `pasteleria` y los orígenes Brasil, Colombia, Etiopía cuando corresponda. Rechazar arrays/objetos en parámetros escalares con error controlado. Límite inicial para `q`: 100 caracteres; conservar caracteres legítimos, acentos y comillas como datos.

Validar IDs como enteros positivos seguros. **Compatibilidad confirmada con frontend:** `app.js` obtiene IDs mediante `data-id`, conserva texto numérico en el carrito y lo envía como `productoId`. Aceptar número entero o cadena decimal estricta para ese campo y convertir después de validar; no usar conversión permisiva que acepte restos o notación inesperada. Las cantidades sí deben ser números enteros, no textos arbitrarios.

Producto válido inexistente conserva 404 en su endpoint; formato de ID inválido devuelve 4xx seguro, sin reflejar la entrada. Coordinar mensajes con Matías para la falla 5 y con Homero para el manejador global.

### Validación e integridad del pedido

- `items`: array de **1 a 50** elementos, con forma válida por elemento.
- `cantidad`: entero de **1 a 100**, sin coerción de valores no numéricos.
- `productoId`: válido conforme al contrato anterior; producto existente y activo antes de escribir.
- `mesa`: texto de 1 a 10 caracteres; `cliente`: texto de 2 a 40, conforme al formulario existente. No convertir mesa en una relación nueva ni exigir que sea un número.
- Rechazar estructuras inválidas y límites excedidos con error 4xx, sin escrituras. No confiar en precio/total aportado por el cliente.
- Conservar ítems válidos repetidos como líneas independientes; no agregar deduplicación ni inventar stock.

Utilizar una transacción por pedido sobre **un único cliente obtenido del pool** para leer los productos necesarios e insertar cabecera/ítems. Todas las operaciones transaccionales deben usar ese cliente; intercalar consultas globales del pool no constituye la misma transacción. Hacer rollback ante error y liberar la conexión siempre. Mantener el retorno del pedido con ítems tras una creación correcta.

Para actualización de estado, conservar los valores presentes en la interfaz: `abierto`, `preparando`, `listo`, `entregado`. Validar el valor sin agregar reglas nuevas de transiciones o permisos. El filtro por mesa sigue siendo opcional, con longitud coherente con la creación.

## 6. Contratos funcionales que deben conservarse

| Flujo | Contrato |
|---|---|
| Catálogo | `{ productos, filtros: { tipo, variedad, q }, total }`; sólo activos en listado, mismos filtros/orden y `precio` calculado |
| Catálogo inicial | Veinte productos: nueve espressos, nueve filtrados y dos de pastelería |
| Detalle de producto | Objeto directo; 404 para ID válido inexistente. No agregar filtro de activo al detalle como cambio funcional no solicitado |
| Precio | `gramos × precio_por_gramo + precio_base`, sin aceptar precio del carrito como autoridad |
| Alta de pedido | 201 con `id`, `mesa`, `cliente`, `estado: abierto`, `total`, `items`; total suma precio por cantidad |
| Pedidos | Listado `{ pedidos }` descendente por ID; detalle con ítems y `producto_nombre`; estado actualizado como objeto directo |
| Reportes | Conservar `{ facturado, pedidos }`, `{ cantidadVendida }`, `{ producto }`, `{ promedio }` y `{ ventas }` y sus valores agregados |

No cambiar reportes para contabilizar sólo ciertos estados: actualmente agregan todos los pedidos. Respetar el tratamiento existente de NUMERIC como texto/número en la interfaz. Pedidos y reportes mantienen acceso anónimo, con CSRF en escrituras según el contrato global.

## 7. Dependencias y acuerdos con otros integrantes

- **Matías:** preservar los consumidores y mensajes seguros; aceptar el [contrato CSRF](../planificacion-tp4.md#92-contrato-csrf-y-sesiones) sin alterar el body del negocio. Coordinar validadores de reseñas si se solicita apoyo, sin editar simultáneamente sus archivos.
- **Homero:** acordar errores 4xx/500 y cualquier validador compartido. No aplicar una nueva política de permisos por cuenta propia.
- **Nicolás:** SQL del login queda en su bloque; no necesita bloquear las consultas independientes del catálogo/reportes.
- Homero registra la línea base antes de que comience el desarrollo. El acceso al pool debe seguir funcionando con el rol de mínimos privilegios de Homero.

## 8. Orden recomendado de tareas

1. Consultar la línea base registrada por Homero y autorizar la tarea concreta.
2. Parametrizar catálogo, incluido ID; validar filtros y conservar respuesta.
3. Parametrizar mesa y reporte por origen; verificar consultas combinadas.
4. Implementar validación del pedido e IDs respetando el cliente actual.
5. Incorporar transacción con rollback y liberación del cliente; preservar cálculo y retorno.
6. Verificar regresiones de reportes y estados; revisar PR hacia `develop`. Las primeras consultas pueden desarrollarse en paralelo con otros bloques.

## 9. Pruebas y criterios de aceptación

**Estado actual: No ejecutado.** Archivos existentes: [productos](../../tests/productos.test.ts), [pedidos](../../tests/pedidos.test.ts), [reportes](../../tests/reportes.test.ts), [seguridad](../../tests/seguridad.test.ts) y [checker](../../scripts/check-security.ts).

| ID | Pruebas relacionadas | Controles |
|---|---|---|
| 2 | Catálogo completo, filtros, precios, detalle/404; búsqueda y origen sin ampliación por SQL | SQLI-01/02; VAL-01/03 |
| 3 | Listado/detalle de pedidos y filtro por mesa sin ampliación | SQLI-01/02 |
| 4 | Reporte por origen legítimo y sin filtración de otras tablas | SQLI-01/02 |
| 9 | Totales, detalle y cambio de estado; rechazo de cantidades negativas/no numéricas | VAL-01/02/03 |

Verificar además, con autorización: cantidades 1/100 frente a 0/101; 1/50 frente a 0/51 ítems; ID numérico en texto enviado por el navegador; producto inexistente/inactivo; error intermedio sin cabecera o ítems parciales. Usar token válido para que CSRF no enmascare la validación. No basta una respuesta vacía en un test SQL: comprobar también los resultados legítimos.

Ejecutar las baterías oficiales y registrar resultados según la [planificación](../planificacion-tp4.md#6-criterios-de-aceptación). No agregar excepciones para tests ni modificar sus aserciones. Cualquier incompatibilidad nueva de límites requiere evidencia antes de ajustar el contrato.

## 10. Límites del alcance

No ORM ni sustitución de la capa de datos; no cambios de precios, catálogo, permisos generales, relaciones usuario-pedido o funcionalidades de stock. No modificar pruebas/helpers/checker. La validación de reseñas es dependencia de Matías, no una tarea independiente de este bloque. No limpiar datos históricos ni volúmenes para conseguir resultados favorables.

## 11. Checklist de avance

- [ ] Línea base consultada y contratos de entrada/salida coordinados.
- [ ] Consultas del catálogo, incluido ID, parametrizadas.
- [ ] Consultas de mesa y origen parametrizadas.
- [ ] Filtros e IDs validados sin romper IDs del frontend.
- [ ] Cantidades, ítems, textos y producto activo validados.
- [ ] Transacción con rollback y liberación comprobada.
- [ ] Precios, totales, reportes y acceso anónimo preservados.
- [ ] Pruebas autorizadas y casos legítimos registrados con CSRF válido.
- [ ] PR hacia `develop` revisado con evidencia y reflexión por falla.
