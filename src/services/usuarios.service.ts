import { randomBytes } from 'node:crypto';
import * as db from '../db';
import type { Usuario, UsuarioSesion } from '../tipos';
import * as bcrypt from 'bcryptjs';
import { revocarSesionesUsuario } from '../middleware/sesion';
import { revocarCsrfSesion } from '../middleware/csrf';
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
const MAX_BYTES_CONTRASENA_BCRYPT = 72;
// Permite ejecutar bcrypt también cuando no hay una cuenta, con el costo del servicio.
const HASH_DE_REFERENCIA = bcrypt.hashSync(randomBytes(32).toString('hex'), COSTO_HASH);
const operacionesPorUsuario = new Map<number, Promise<void>>();
export type UsuarioPublico = Omit<Usuario, 'password'>;

// Las escrituras y la emisión de sesiones de un usuario comparten este turno en el proceso.
async function serializarPorUsuario<T>(id: number | string, operar: () => Promise<T>): Promise<T> {
  const clave = Number(id);
  const anterior = operacionesPorUsuario.get(clave);
  let liberar!: () => void;
  const turno = new Promise<void>((resolver) => { liberar = resolver; });
  operacionesPorUsuario.set(clave, turno);

  try {
    await anterior;
    return await operar();
  } finally {
    liberar();
    if (operacionesPorUsuario.get(clave) === turno) operacionesPorUsuario.delete(clave);
  }
}

export function esFormatoPasswordValido(password: unknown): password is string {
  return typeof password === 'string' && password.trim().length > 0 && !password.includes('\0');
}

export function excedeLimitePassword(password: string): boolean {
  return Buffer.byteLength(password, 'utf8') > MAX_BYTES_CONTRASENA_BCRYPT;
}

/** Genera un hash bcrypt para una contraseña en texto plano. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COSTO_HASH);
}

/** Revoca las sesiones y los tokens CSRF asociados a un usuario. */
function revocarAccesosUsuario(idUsuario: number | string): void {
  const sesionesRevocadas = revocarSesionesUsuario(idUsuario);

  for (const sid of sesionesRevocadas) {
    revocarCsrfSesion(sid);
  }
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
 * Verifica la contraseña y emite la sesión dentro del turno del usuario.
 * emitirSesion debe registrar la sesión de forma síncrona.
 */
export async function autenticar(
  username: string,
  password: string,
  emitirSesion: (usuario: UsuarioSesion) => void
): Promise<UsuarioSesion | null> {
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
    return usuarioSesion;
  });
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
      valorFinal = await hashPassword(valor);
    }

    campos.push(`${campo} = $${valores.length + 1}`);
    valores.push(valorFinal);
  }

  if (campos.length === 0) return null;

  valores.push(id);

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
  });
}

export async function cambiarPassword(id: number, nuevaPassword: string): Promise<UsuarioPublico | null> {
  const passwordHash = await hashPassword(nuevaPassword);

  return serializarPorUsuario(id, async () => {
    const { rows: [actualizado] } = await db.query<UsuarioPublico>(
      `UPDATE usuarios
        SET password = $1
        WHERE id = $2
        RETURNING id, username, rol, nombre, creado_en`,
      [passwordHash, id]
    );
    if (actualizado) revocarAccesosUsuario(actualizado.id);
    return actualizado ?? null;
  });
}
