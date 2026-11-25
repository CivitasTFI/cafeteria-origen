/**
 * Gestión de sesiones.
 *
 * -----------------------------------------------------------------------------
 * FALLA — Gestión de sesiones insegura (Autenticación insegura)
 * -----------------------------------------------------------------------------
 * 1. El identificador de sesión es un contador incremental (`sesion_1`,
 *    `sesion_2`, ...): es PREDECIBLE y adivinable. Un atacante puede recorrer
 *    los valores y usurpar la sesión de otro usuario (fijación de sesión).
 * 2. La cookie se emite SIN `httpOnly` (JavaScript puede leerla), SIN `secure`
 *    (viaja en texto plano por HTTP) y SIN `sameSite` (el navegador la manda
 *    también en peticiones desde otros sitios → facilita CSRF).
 * 3. Las sesiones NO expiran nunca.
 * 4. Al iniciar sesión no se regenera el identificador.
 * 5. El cierre de sesión sólo borra la cookie del cliente: la sesión sigue
 *    viva en el servidor.
 *
 * Corrección: usar crypto.randomUUID() (o crypto.randomBytes -> hex) para el
 * id, con expiración por inactividad y absoluta, cookie con
 * { httpOnly: true, secure: true, sameSite: 'lax' }, regeneración del id tras
 * el login y borrado de la sesión en el servidor al hacer logout.
 * -----------------------------------------------------------------------------
 */

import type { Request, Response } from 'express';
import  { randomBytes } from 'node:crypto';
import type { Sesion, UsuarioSesion } from '../tipos';
import config from '../config';

export const sesiones = new Map<string, Sesion>();

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

/** Lee las cookies de la petición (parser mínimo, sin dependencias). */
export function leerCookies(req: Request): Record<string, string> {
  const cookies: Record<string, string> = {};
  const header = req.headers.cookie;
  if (!header) return cookies;
  for (const parte of header.split(';')) {
    const separador = parte.indexOf('=');
    if (separador < 0) continue;
    const nombre = parte.slice(0, separador).trim();
    const valor = parte.slice(separador + 1).trim();
    if (nombre) cookies[nombre] = decodeURIComponent(valor);
  }
  return cookies;
}

/** Crea una sesión nueva para el usuario y setea la cookie. */
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

/** Devuelve la sesión de la petición, si existe. */
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

/** Cierra la sesión en el servidor (debería llamarse en el logout). */
export function destruirSesion(req: Request): void {
  //const cookies = leerCookies(req);
  const id = leerCookies(req).sid;
  if (id) sesiones.delete(id);
}

/**
 * Revoca todas las sesiones activas de un usuario.
 * Devuelve los IDs eliminados para revocar sus tokens CSRF.
 */
export function revocarSesionesUsuario(idUsuario: number | string): string[] {
  const idsRevocados: string[] = [];

  for (const [idSesion, sesion] of sesiones.entries()) {
    if (String(sesion.usuario.id) === String(idUsuario)) {
      sesiones.delete(idSesion);
      idsRevocados.push(idSesion);
    }
  }

  return idsRevocados;
}
