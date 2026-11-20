import express from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

import config from '../config';
import * as catalogo from '../services/catalogo.service';
import * as usuarios from '../services/usuarios.service';
import { requiereSesion, requiereRol } from '../middleware/auth';
import type { Rol, Usuario } from '../tipos';

const router = express.Router();
const CAMPOS_EDITABLES_USUARIO = new Set(['username', 'nombre', 'rol', 'password']);
const ROLES_ADMINISTRABLES: ReadonlySet<string> = new Set<Rol>(['admin', 'barista', 'mozo', 'cliente']);

function esRolAdministrable(valor: unknown): valor is Rol {
  return typeof valor === 'string' && ROLES_ADMINISTRABLES.has(valor);
}

function esTextoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && !valor.includes('\0');
}

router.use(requiereSesion);

/**
 * POST /api/admin/cambiar-contrasena — cambio personal para toda sesión válida.
 *
 * FALLAS: sin token anti-CSRF, sin límite de intentos, y la contraseña nueva
 * se guarda en texto plano.
 */
router.post('/cambiar-contrasena', async (req, res, next) => {
  try {
    const { nueva } = req.body || {};
    if (!nueva) {
      return res.status(400).json({ error: 'Falta la contraseña nueva.' });
    }
    // FALLA: no se valida la longitud ni la complejidad de la contraseña.
    // (`req.usuario!`: requiereSesion ya garantizó que hay un usuario.)
    const usuario = await usuarios.cambiarPassword(req.usuario!.id, nueva);
    res.json({ mensaje: 'Contraseña actualizada.', usuario });
  } catch (err) {
    next(err);
  }
});

router.use(requiereRol('admin'));

/** GET /api/admin/usuarios */
router.get('/usuarios', async (req, res, next) => {
  try {
    res.json({ usuarios: await usuarios.listar() });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/admin/usuarios/:id */
router.put('/usuarios/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    // El ID de usuarios es SERIAL en PostgreSQL.
    if (!/^\d+$/.test(req.params.id) || !Number.isInteger(id) || id < 1 || id > 2_147_483_647) {
      return res.status(400).json({ error: 'ID de usuario inválido.' });
    }

    const cuerpo: unknown = req.body;
    if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
      return res.status(400).json({ error: 'Se espera un objeto con los cambios del usuario.' });
    }

    const campos = Object.keys(cuerpo);
    if (campos.length === 0) {
      return res.status(400).json({ error: 'Faltan campos para actualizar.' });
    }
    if (campos.some((campo) => !CAMPOS_EDITABLES_USUARIO.has(campo))) {
      return res.status(400).json({ error: 'La solicitud contiene campos no permitidos.' });
    }

    const { username, nombre, rol, password } = cuerpo as Record<string, unknown>;
    if (username !== undefined && (!esTextoValido(username) || username.trim().length === 0)) {
      return res.status(400).json({ error: 'Nombre de usuario inválido.' });
    }
    if (nombre !== undefined && nombre !== null && !esTextoValido(nombre)) {
      return res.status(400).json({ error: 'Nombre inválido.' });
    }
    if (rol !== undefined && !esRolAdministrable(rol)) {
      return res.status(400).json({ error: 'Rol inválido.' });
    }
    if (password !== undefined && (!esTextoValido(password) || password.length === 0)) {
      return res.status(400).json({ error: 'Contraseña inválida.' });
    }

    const cambios: Partial<Usuario> = {};
    if (username !== undefined) cambios.username = username;
    if (nombre !== undefined) cambios.nombre = nombre;
    if (rol !== undefined) cambios.rol = rol;
    if (password !== undefined) cambios.password = password;

    const usuario = await usuarios.actualizar(id, cambios);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json({
      id: usuario.id,
      username: usuario.username,
      nombre: usuario.nombre,
      rol: usuario.rol,
      creado_en: usuario.creado_en,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/productos — alta de producto. */
router.post('/productos', async (req, res, next) => {
  try {
    const producto = await catalogo.crear(req.body || {});
    res.status(201).json(producto);
  } catch (err) {
    // El nombre del producto es único en la base.
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'Ya existe un producto con ese nombre.' });
    }
    next(err);
  }
});

/** PUT /api/admin/productos/:id */
router.put('/productos/:id', async (req, res, next) => {
  try {
    const producto = await catalogo.actualizar(req.params.id, req.body || {});
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json(producto);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/productos/:id
 *
 * FALLA — CSRF: la petición que borra un producto no lleva ningún token y se
 * acepta con un simple GET/POST desde cualquier origen.
 */
router.delete('/productos/:id', async (req, res, next) => {
  try {
    const producto = await catalogo.eliminar(req.params.id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json(producto);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/probar-conexion
 *
 * -----------------------------------------------------------------------------
 * FALLA — Inyección de comandos del sistema operativo (OWASP A03:2021)
 * -----------------------------------------------------------------------------
 * La dirección del proveedor se mete dentro de una cadena de shell.
 * Como `exec` launches /bin/sh -c, los operadores del shell (|, ;, &&, $())
 * se interpretan y permiten ejecutar comandos arbitrarios en el contenedor.
 *
 * Corrección: validar el host contra una LISTA BLANCA y ejecutar el proceso
 * con `spawn('ping', ['-c', '3', host], { shell: false })`, sin pasar por el
 * shell.
 * -----------------------------------------------------------------------------
 */
router.post('/probar-conexion', (req, res) => {
  const { host } = req.body || {};

  // FALLA: entrada de usuario concatenada en un comando de shell.
  const comando = `ping -c 3 ${host}`;

  exec(comando, (error, stdout, stderr) => {
    res.json({
      comando,
      salida: stdout,
      error: stderr || (error ? error.message : null),
    });
  });
});

/**
 * POST /api/admin/subir-archivo
 *
 * -----------------------------------------------------------------------------
 * FALLA — Carga de archivos sin restricciones (OWASP A04:2021)
 * -----------------------------------------------------------------------------
 * No se valida la extensión, el tipo MIME ni el tamaño del archivo, y se
 * guarda con el nombre que manda el cliente (además sin sanitizar "../", lo
 * que permite escribir fuera de la carpeta de subidas). Los archivos subidos
 * se sirven con express.static desde el mismo origen.
 *
 * Corrección: validar extensión contra lista blanca (.png/.jpg/.svg saneado),
 * verificar el tipo MIME real, limitar el tamaño, generar un nombre aleatorio
 * y guardar fuera del árbol web.
 * -----------------------------------------------------------------------------
 */
router.post('/subir-archivo', express.json({ limit: '8mb' }), (req, res, next) => {
  try {
    const { nombre, contenidoBase64 } = req.body || {};

    if (!nombre || !contenidoBase64) {
      return res.status(400).json({ error: 'Falta el archivo.' });
    }

    // FALLA: sin validación de extensión, MIME ni tamaño.
    const buffer = Buffer.from(contenidoBase64, 'base64');
    fs.mkdirSync(config.uploadsDir, { recursive: true });

    // FALLA: nombre tomado del cliente sin sanear (path traversal).
    const destino = path.join(config.uploadsDir, nombre);
    fs.writeFileSync(destino, buffer);

    res.json({
      mensaje: 'Archivo subido.',
      url: `/uploads/${nombre}`,
      bytes: buffer.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
