import * as db from '../db';
import type { Usuario } from '../tipos';
import * as bcrypt from 'bcryptjs';
/**
 * Servicio de usuarios.
 *
 * -----------------------------------------------------------------------------
 * FALLA — Inyección SQL (OWASP A03:2021)
 * -----------------------------------------------------------------------------
 * La consulta del login concatena el usuario y la contraseña directamente
 * dentro del texto SQL. El motor de PostgreSQL interpreta las comillas y los
 * operadores que venga en la entrada, de modo que la condición se puede
 * reescribir por completo y devolver una fila válida sin conocer la clave.
 *
 * Además:
 *  - La contraseña se compara en texto plano (almacenamiento inseguro).
 *  - El mensaje de error distingue "usuario inexistente" de "contraseña
 *    incorrecta" (enumeración de usuarios).
 *  - No hay límite de intentos (fuerza bruta).
 *
 * Corrección: consultas parametrizadas (`WHERE username = $1 AND password = $2`
 * con bcrypt.compare), mensaje genérico de error, y rate limiting + bloqueo
 * temporal en el endpoint de login.
 * -----------------------------------------------------------------------------
 */

const COSTO_HASH = 10;
export type UsuarioPublico = Omit<Usuario, 'password'>;
/** Genera un hash bcrypt para una contraseña en texto plano. */
export async function hashearPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COSTO_HASH);
}

/** Busca un usuario por nombre de usuario exacto (query parametrizada). */
export async function buscarPorUsername(username: string): Promise<Usuario | null> {
  const { rows } = await db.query<Usuario>(
    'SELECT * FROM usuarios WHERE username = $1',
    [username]
  );
  return rows[0] || null;
}

/**
 * Autentica a un usuario comparando usuario y contraseña.
 * Devuelve el usuario o null.
 */
export async function autenticar(username: string, password: string): Promise<Usuario | null> {
  const usuario = await buscarPorUsername(username);

  if (!usuario) {
    return null;
  }

  const passwordValida = await bcrypt.compare(password, usuario.password);

  if (!passwordValida) {
    return null;
  }

  return usuario;
}

/** Lista todos los usuarios (para el panel de administración). */
export async function listar(): Promise<UsuarioPublico[]> {
  const { rows } = await db.query<UsuarioPublico>(
    'SELECT id, username, rol, nombre, creado_en FROM usuarios ORDER BY id'
  );
  return rows;
}

/**
 * Actualiza los datos de un usuario.
 *
 * SEGURIDAD:
 * - Restringe los campos modificables mediante una lista permitida.
 * - Hashea la contraseña antes de almacenarla.
 * - Devuelve únicamente datos públicos, sin exponer el hash.
 *
 * IMPORTANTE:
 * La autorización para modificar roles debe controlarse en la ruta
 * correspondiente mediante el middleware de permisos.
 */
export async function actualizar(id: number | string, cambios: Partial<Usuario>): Promise<UsuarioPublico | null> {
  const campos: string[] = [];
  const valores: unknown[] = [];

  const camposPermitidos = ['username', 'nombre', 'rol', 'password'];

  for (const [campo, valor] of Object.entries(cambios)) {
    if (!camposPermitidos.includes(campo)) {
      continue;
    }

    let valorFinal = valor;

    if (campo === 'password' && typeof valor === 'string') {
      valorFinal = await hashearPassword(valor);
    }

    campos.push(`${campo} = $${valores.length + 1}`);
    valores.push(valorFinal);
  }

  if (campos.length === 0) return null;

  valores.push(id);

  const { rows } = await db.query<UsuarioPublico>(
    `UPDATE usuarios SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING id, username, rol, nombre, creado_en`,
    valores
  );

  return rows[0] || null;
}

export async function cambiarPassword(id: number, nuevaPassword: string): Promise<UsuarioPublico | null> {
  const passwordHash = await hashearPassword(nuevaPassword);

  const { rows } = await db.query<UsuarioPublico>(
    `UPDATE usuarios
      SET password = $1
      WHERE id = $2
      RETURNING id, username, rol, nombre, creado_en`,
    [passwordHash, id]
  );

  return rows[0] || null;
}
