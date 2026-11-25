import * as db from '../db';
import type { Comentario } from '../tipos';

/** Datos de una reseña nueva, tal como llegan en el cuerpo de la petición. */
export interface NuevoComentario {
  autor: unknown;
  texto: unknown;
  calificacion: unknown;
}

const MAX_AUTOR = 40;
const MAX_TEXTO = 280;

function esTextoValido(valor: unknown, maximo: number): valor is string {
  return typeof valor === 'string' &&
    valor.length <= maximo &&
    valor.trim().length > 0 &&
    !valor.includes('\0');
}

/** Lista todos los comentarios, del más nuevo al más viejo. */
export async function listar(): Promise<Comentario[]> {
  const { rows } = await db.query<Comentario>(
    'SELECT * FROM comentarios ORDER BY id DESC'
  );
  return rows;
}

/** Crea un comentario. */
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
  );
  return rows[0];
}

/** Elimina un comentario. */
export async function eliminar(id: number | string): Promise<Comentario | null> {
  const { rows } = await db.query<Comentario>(
    'DELETE FROM comentarios WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0] || null;
}
