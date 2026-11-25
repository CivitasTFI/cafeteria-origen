import express from 'express';
import * as usuarios from '../services/usuarios.service';
import { revocarCsrfSesion } from '../middleware/csrf';
import { crearSesion, destruirSesion, leerCookies, obtenerSesion, limpiarCookieSesion } from '../middleware/sesion';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

//Limitador
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
/**
 * Inicio de sesión.
 *
 * FALLAS:
 *  - Inyección SQL en la verificación de credenciales (ver usuarios.service).
 *  - Contraseñas almacenadas en texto plano.
 *  - Mensajes de error que distinguen "usuario inexistente" de "contraseña
 *    incorrecta" → enumeración de usuarios.
 *  - Sin rate limiting ni bloqueo: fuerza bruta ilimitada.
 *  - El identificador de sesión no se regenera (fijación de sesión).
 */
router.post('/login', limitarLogin, async (req, res, next) => {
  try {
    const contentType = req.get('content-type')
      ?.split(';')[0]
      .trim()
      .toLowerCase();

    if (contentType !== 'application/json') {
      return res.status(415).json({
        error: 'El inicio de sesión requiere Content-Type application/json.',
      });
    }

    const { username, password } = req.body || {};

    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: 'Falta usuario o contraseña.',
      });
    }


    //* La verificación de credenciales utiliza autenticación segura.*
    const usuario = await usuarios.autenticar(username, password);

    if (!usuario) {
      return res.status(401).json({
        error: 'Usuario o contraseña incorrectos.'
      });
    }

    const sidAnterior = leerCookies(req).sid;
    if (sidAnterior) revocarCsrfSesion(sidAnterior);

    crearSesion(req, res, {
      id: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      nombre: usuario.nombre,
    });

    res.json({
      mensaje: `¡Bienvenido, ${usuario.nombre}!`,
      usuario: {
        id: usuario.id,
        username: usuario.username,
        rol: usuario.rol,
        nombre: usuario.nombre,
      },
    });
  } catch (err) {
    next(err);
  }
});


router.post('/logout', (req, res) => {
  const sid = leerCookies(req).sid;
  if (sid) revocarCsrfSesion(sid);
  destruirSesion(req);
  limpiarCookieSesion(res);
  res.json({ mensaje: 'Sesión cerrada.' });
});

/** Devuelve el usuario de la sesión actual. */
router.get('/yo', (req, res) => {
  const sesion = obtenerSesion(req);
  if (!sesion) {
    return res.status(401).json({ error: 'Necesitás iniciar sesión.' });
  }
  res.json({ usuario: sesion.usuario });
});

export default router;
