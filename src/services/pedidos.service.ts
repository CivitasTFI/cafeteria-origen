import * as db from '../db';
import type { PoolClient } from 'pg';
import { calcularPrecio } from '../catalogo';
import type { Pedido, PedidoConItems, PedidoItem, Producto } from '../tipos';

/** Un renglón del pedido, tal como llega en el cuerpo de la petición. */
export interface ItemPedido {
  productoId: number;
  cantidad: number;
}

/** Pedido nuevo, tal como llega en el cuerpo de la petición. */
export interface NuevoPedido {
  mesa: string;
  cliente: string;
  items: ItemPedido[];
}

/** Id tal como llega en la URL (texto) o ya convertido. */
type Id = number | string;

function validarIdPedido(id: Id): number {
  const numero = typeof id === 'string' && /^[0-9]+$/.test(id) ? Number(id) : id;
  if (typeof numero !== 'number' || !Number.isSafeInteger(numero) || numero < 1 || numero > 2_147_483_647) {
    throw Object.assign(new Error('ID de pedido inválido'), { status: 400 });
  }
  return numero;
}

/**
 * Servicio de pedidos.
 *
 * -----------------------------------------------------------------------------
 * FALLA — Validación de entrada débil o insuficiente (OWASP A04:2021)
 * -----------------------------------------------------------------------------
 *
 * La corrección es validar TIPO (entero), RANGO (1..N), LONGITUD y FORMATO
 * de cada campo en el servidor, usando listas blancas.
 * -----------------------------------------------------------------------------
 */

/**
 * Crea un pedido a partir de una lista de items { productoId, cantidad }.
 * Total = suma de calcularPrecio(producto) x cantidad
 */
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

  const filas: { productoId: number; cantidad: number; precioUnitario: number }[] = [];

  const conexion = await db.pool.connect();
  let pedidoId: number;

  try {
    await conexion.query('BEGIN');
    for (const item of items) {
      let productoId: unknown = item.productoId;

      if (typeof productoId === 'string' && /^[0-9]+$/.test(productoId)) {
        productoId = Number(productoId);
      }
      if (
        typeof productoId !== 'number' ||
        !Number.isInteger(productoId) ||
        productoId < 1 ||
        productoId > 2_147_483_647
      ) {
        throw Object.assign(new Error('ID de producto inválido'), { status: 400 });
      }
      const producto = await buscarProducto(conexion, productoId);

      if (producto === undefined || !producto.activo) {
        throw Object.assign(new Error('Producto no encontrado'), { status: 400 });
      }
      const precioUnitario = calcularPrecio(producto);
      filas.push({
        productoId: producto.id,
        cantidad: item.cantidad,
        precioUnitario,
      });
    }
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
  return obtenerConItems(pedidoId);
}
/** Busca un producto por id (helper interno). */
async function buscarProducto(conexion: PoolClient, productoId: number): Promise<Producto> {
  const { rows } = await conexion.query<Producto>('SELECT * FROM productos WHERE id = $1', [productoId]);
  return rows[0];
}

/** Lista pedidos (con filtro opcional por mesa). */
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

/** Devuelve un pedido con sus items. */
export async function obtenerConItems(id: Id): Promise<PedidoConItems | null> {
  const pedidoId = validarIdPedido(id);
  const { rows: pedidos } = await db.query<Pedido>(
    'SELECT * FROM pedidos WHERE id = $1',
    [pedidoId]
  );
  const pedido = pedidos[0];
  if (!pedido) return null;

  const { rows: items } = await db.query<PedidoItem>(
    `SELECT pi.*, pr.nombre AS producto_nombre
       FROM pedido_items pi
       JOIN productos pr ON pr.id = pi.producto_id
      WHERE pi.pedido_id = $1`,
    [pedidoId]
  );

  return { ...pedido, items };
}

/** Cambia el estado de un pedido. */
export async function cambiarEstado(id: Id, estado: string): Promise<Pedido | null> {
  const pedidoId = validarIdPedido(id);
  const estadosPermitidos = ['abierto', 'preparando', 'listo', 'entregado'];
  if (typeof estado !== 'string' || !estadosPermitidos.includes(estado)) {
    throw Object.assign(new Error('Estado inválido'), { status: 400 });
  }
  const { rows } = await db.query<Pedido>(
    'UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING *',
    [estado, pedidoId]
  );
  return rows[0] || null;
}
