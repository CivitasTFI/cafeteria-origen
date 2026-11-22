import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

import config from '../config';
import { leerCookies, obtenerSesion } from './sesion';

const TTL_MS = 8 * 60 * 60 * 1000;
const COOKIE_CTX = 'csrf_ctx';

const tokens = new Map<string, { token: string; expiraEn: number }>();

function generarToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generarContextoId(): string {
  return crypto.randomBytes(16).toString('hex');
}

function opcionesCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.nodeEnv === 'production',
    path: '/',
  };
}

/** Clave interna: sid:<id> | anon:<csrf_ctx> */
function resolverClave(req: Request): string | null {
  const cookies = leerCookies(req);
  const sesion = obtenerSesion(req);
  if (sesion && cookies.sid) return `sid:${cookies.sid}`;
  if (cookies[COOKIE_CTX]) return `anon:${cookies[COOKIE_CTX]}`;
  return null;
}

/** Crea cookie de contexto anónimo si hace falta; devuelve la clave del store. */
function asegurarClave(req: Request, res: Response): string {
  const existente = resolverClave(req);
  if (existente) return existente;

  const ctxId = generarContextoId();
  res.cookie(COOKIE_CTX, ctxId, opcionesCookie());
  return `anon:${ctxId}`;
}

function guardarToken(clave: string, token: string): void {
  tokens.set(clave, { token, expiraEn: Date.now() + TTL_MS });
}

function leerTokenAlmacenado(clave: string): string | undefined {
  const entry = tokens.get(clave);
  if (!entry) return undefined;
  if (entry.expiraEn <= Date.now()) {
    tokens.delete(clave);
    return undefined;
  }
  return entry.token;
}

function obtenerOCrearToken(clave: string): string {
  const previo = leerTokenAlmacenado(clave);
  if (previo) return previo;
  const token = generarToken();
  guardarToken(clave, token);
  return token;
}

function leerTokenEnviado(req: Request): string | undefined {
  const headerRaw = req.headers['x-csrf-token'];
  const desdeHeader = (Array.isArray(headerRaw) ? headerRaw[0] : headerRaw) as string | undefined;

  const desdeBody =
    req.body && typeof req.body === 'object' && typeof req.body._csrf === 'string'
      ? req.body._csrf
      : undefined;

  const desdeQuery =
    req.method === 'DELETE' && typeof req.query._csrf === 'string' ? req.query._csrf : undefined;

  const candidatos = [desdeHeader, desdeBody, desdeQuery].filter(
    (v): v is string => typeof v === 'string' && v.length > 0
  );

  if (candidatos.length === 0) return undefined;

  const primero = candidatos[0];
  const todosIguales = candidatos.every((c) => c === primero);
  if (!todosIguales) return undefined;

  return primero;
}

function tokensCoinciden(enviado: string, esperado: string): boolean {
  const a = Buffer.from(enviado, 'utf8');
  const b = Buffer.from(esperado, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Revoca el token CSRF de una sesión (p. ej. logout o nuevo login). */
export function revocarCsrfSesion(sid: string): void {
  if (sid) tokens.delete(`sid:${sid}`);
}

function origenesPermitidos(): string[] {
  const puerto = config.port;
  const lista = [
    `http://localhost:${puerto}`,
    `http://127.0.0.1:${puerto}`,
  ];
  const extra = process.env.APP_ORIGIN;
  if (extra && !lista.includes(extra)) lista.push(extra);
  return lista;
}

/** Rechaza Fetch Metadata cross-site y Origin ajeno cuando el navegador los envía. */
function rechazarOrigenCruzado(req: Request, res: Response): boolean {
  const fetchSiteRaw = req.headers['sec-fetch-site'];
  const fetchSite = (Array.isArray(fetchSiteRaw) ? fetchSiteRaw[0] : fetchSiteRaw) as string | undefined;
  if (fetchSite === 'cross-site') {
    res.status(403).json({ error: 'Solicitud cross-site rechazada.' });
    return true;
  }

  const originRaw = req.headers.origin;
  const origin = (Array.isArray(originRaw) ? originRaw[0] : originRaw) as string | undefined;
  if (origin && !origenesPermitidos().includes(origin)) {
    res.status(403).json({ error: 'Origin no permitido.' });
    return true;
  }

  return false;
}

/** GET /api/csrf-token — expone el token del contexto actual. */
export function entregarCsrfToken(req: Request, res: Response): void {
  const clave = asegurarClave(req, res);
  const token = obtenerOCrearToken(clave);
  res.set('Cache-Control', 'no-store');
  res.json({ token });
}

/** Valida token en escrituras bajo /api (montado desde app.ts). */
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