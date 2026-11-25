import express from 'express';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { randomUUID } from 'node:crypto';

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

const MAX_BYTES_CONTRASENA_BCRYPT = 72;

/** POST /api/admin/cambiar-contrasena — cambio personal para toda sesión válida. */
router.post('/cambiar-contrasena', async (req, res, next) => {
  try {
    const { nueva }: { nueva?: unknown } = req.body || {};
    if (!nueva) {
      return res.status(400).json({ error: 'Falta la contraseña nueva.' });
    }
    if (!esTextoValido(nueva) || nueva.trim().length === 0) {
      return res.status(400).json({ error: 'Contraseña nueva inválida.' });
    }
    if (Buffer.byteLength(nueva, 'utf8') > MAX_BYTES_CONTRASENA_BCRYPT) {
      return res.status(400).json({ error: 'La contraseña nueva no puede superar 72 bytes en UTF-8.' });
    }

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

const HOSTS_PRUEBA_CONEXION = new Set(['127.0.0.1', '::1']);
const TIEMPO_MAXIMO_CONEXION_MS = 5_000;
const SALIDA_MAXIMA_CONEXION = 64 * 1024;

/** POST /api/admin/probar-conexion */
router.post('/probar-conexion', (req, res) => {
  const { host } = req.body || {};
  if (typeof host !== 'string' || !HOSTS_PRUEBA_CONEXION.has(host)) {
    return res.status(400).json({ error: 'El destino debe ser 127.0.0.1 o ::1.' });
  }

  const argumentos = ['-c', '3', '-w', '4', host];
  const comando = ['ping', ...argumentos].join(' ');
  const proceso = spawn('/bin/ping', argumentos, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  const partesSalida: Buffer[] = [];
  let bytesSalida = 0;
  let errorPublico: string | null = null;

  function detener(mensaje: string): void {
    if (errorPublico !== null) return;
    errorPublico = mensaje;
    proceso.kill('SIGKILL');
  }

  const temporizador = setTimeout(() => {
    detener('La prueba de conexión excedió el límite de 5 segundos.');
  }, TIEMPO_MAXIMO_CONEXION_MS);

  function contarSalida(fragmento: Buffer, conservar: boolean): void {
    if (errorPublico !== null) return;
    bytesSalida += fragmento.length;
    if (bytesSalida > SALIDA_MAXIMA_CONEXION) {
      detener('La salida de la prueba de conexión superó 64 KiB.');
      return;
    }
    if (conservar) partesSalida.push(fragmento);
  }

  proceso.stdout.on('data', (fragmento: Buffer) => contarSalida(fragmento, true));
  proceso.stderr.on('data', (fragmento: Buffer) => contarSalida(fragmento, false));
  proceso.once('error', () => {
    errorPublico ??= 'No se pudo iniciar la prueba de conexión.';
  });

  proceso.once('close', (codigo) => {
    clearTimeout(temporizador);
    if (codigo !== 0) errorPublico ??= 'La prueba no pudo confirmar una respuesta del destino.';
    res.json({ comando, salida: Buffer.concat(partesSalida).toString('utf8'), error: errorPublico });
  });
});

const MAX_SIZE_IMAGEN = 512 * 1024;
const MAX_BASE64_IMAGEN = Math.ceil(MAX_SIZE_IMAGEN / 3) * 4;

const firmaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const profundidadesPng = new Map([
  [0, [1, 2, 4, 8, 16]], // Escala de grises.
  [2, [8, 16]],          // RGB.
  [3, [1, 2, 4, 8]],    // Color indexado.
  [4, [8, 16]],          // Escala de grises con alfa.
  [6, [8, 16]],          // RGB con alfa.
]);

const tablaCrcPng = Uint32Array.from({ length: 256 }, (_, indice) => {
  let crc = indice;
  for (let bit = 0; bit < 8; bit++) {
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return crc;
});

function crcPng(buffer: Buffer, inicio: number, fin: number): number {
  let crc = 0xffffffff;
  for (let indice = inicio; indice < fin; indice++) {
    crc = (crc >>> 8) ^ tablaCrcPng[(crc ^ buffer[indice]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function esPng(buffer: Buffer): boolean {
  if (!buffer.subarray(0, firmaPng.length).equals(firmaPng)) return false;

  let color = -1;
  let profundidad = 0;
  let paleta = false;
  let hayIdat = false;
  let totalIdat = 0;
  let idatCerrado = false;
  for (let pos = firmaPng.length; pos + 12 <= buffer.length;) {
    const longitud = buffer.readUInt32BE(pos);
    const datos = pos + 8;
    const fin = datos + longitud;
    if (fin + 4 > buffer.length) return false;

    const tipo = buffer.toString('latin1', pos + 4, datos);
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(tipo) || crcPng(buffer, pos + 4, fin) !== buffer.readUInt32BE(fin)) {
      return false;
    }

    if (pos === firmaPng.length) {
      if (tipo !== 'IHDR' || longitud !== 13 || buffer.readInt32BE(datos) <= 0 || buffer.readInt32BE(datos + 4) <= 0) {
        return false;
      }
      profundidad = buffer[datos + 8];
      color = buffer[datos + 9];
      if (!profundidadesPng.get(color)?.includes(profundidad) || buffer[datos + 10] !== 0 ||
          buffer[datos + 11] !== 0 || buffer[datos + 12] > 1) return false;
    } else if (tipo === 'PLTE') {
      if (hayIdat || paleta || color === 0 || color === 4 || longitud === 0 ||
          longitud % 3 !== 0 || longitud > (color === 3 ? (1 << profundidad) * 3 : 768)) return false;
      paleta = true;
    } else if (tipo === 'IDAT') {
      if (idatCerrado || (color === 3 && !paleta)) return false;
      hayIdat = true;
      totalIdat += longitud;
    } else if (tipo === 'IEND') {
      return longitud === 0 && totalIdat > 0 && fin + 4 === buffer.length;
    } else {
      if (/^[A-Z]/.test(tipo)) return false; // Bloque crítico desconocido o IHDR repetido.
      idatCerrado = hayIdat;
    }

    pos = fin + 4;
  }
  return false;
}

function finEscaneoJpeg(buffer: Buffer, pos: number): number {
  let hayDatos = false;
  while (pos < buffer.length) {
    const prefijo = buffer.indexOf(0xff, pos);
    if (prefijo === -1) return -1;

    let codigo = prefijo + 1;
    while (buffer[codigo] === 0xff) codigo++;
    const marca = buffer[codigo];
    hayDatos = hayDatos || prefijo > pos || marca === 0x00;
    // FF 00 representa un byte de datos. RST0 a RST7 pertenecen al escaneo.
    if (marca !== 0x00 && !(marca >= 0xd0 && marca <= 0xd7)) return hayDatos ? prefijo : -1;
    pos = codigo + 1;
  }
  return -1;
}

function esJpeg(buffer: Buffer): boolean {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) return false;

  let componentes = 0;
  let hayEscaneo = false;
  let pos = 2;
  while (pos < buffer.length) {
    if (buffer[pos++] !== 0xff) return false;
    while (buffer[pos] === 0xff) pos++;
    const marca = buffer[pos++];
    if (marca === 0xd9) return hayEscaneo && pos === buffer.length;
    if (marca < 0xc0 || marca === 0xc8 || (marca >= 0xd0 && marca <= 0xd8) || pos + 2 > buffer.length) {
      return false;
    }

    const longitud = buffer.readUInt16BE(pos);
    const fin = pos + longitud;
    if (longitud < 2 || fin > buffer.length) return false;

    // Marcadores SOF. C4 y CC son tablas y se procesan como otros segmentos.
    if (marca <= 0xcf && marca !== 0xc4 && marca !== 0xcc) {
      if (componentes !== 0 || longitud < 8 || buffer.readUInt16BE(pos + 3) === 0 ||
          buffer.readUInt16BE(pos + 5) === 0) return false;
      componentes = buffer[pos + 7];
      if (componentes === 0 || longitud !== 8 + 3 * componentes) return false;
    } else if (marca === 0xda) {
      if (componentes === 0 || longitud < 8) return false;
      const componentesEscaneo = buffer[pos + 2];
      if (componentesEscaneo === 0 || componentesEscaneo > componentes || longitud !== 6 + 2 * componentesEscaneo) {
        return false;
      }
      pos = finEscaneoJpeg(buffer, fin);
      if (pos < 0) return false;
      hayEscaneo = true;
      continue;
    }

    pos = fin;
  }
  return false;
}

function esBloqueImagenWebp(buffer: Buffer, tipo: string, datos: number, longitud: number): boolean {
  if (tipo === 'VP8L') {
    return longitud > 5 && buffer[datos] === 0x2f && (buffer[datos + 4] & 0xe0) === 0;
  }

  if (longitud <= 10 || (buffer[datos] & 1) !== 0 || buffer.readUIntBE(datos + 3, 3) !== 0x9d012a) {
    return false;
  }
  const longitudParticion = buffer.readUIntLE(datos, 3) >>> 5;
  return longitudParticion > 0 && longitudParticion <= longitud - 10 &&
    (buffer.readUInt16LE(datos + 6) & 0x3fff) !== 0 && (buffer.readUInt16LE(datos + 8) & 0x3fff) !== 0;
}

function tieneImagenWebp(buffer: Buffer, pos: number, limite: number, animado: boolean): boolean {
  let hayImagen = false;
  let hayAlfa = false;
  let hayAnimacion = false;
  while (pos + 8 <= limite) {
    const tipo = buffer.toString('latin1', pos, pos + 4);
    const longitud = buffer.readUInt32LE(pos + 4);
    const datos = pos + 8;
    const fin = datos + longitud;
    const siguiente = fin + (longitud & 1);
    if (siguiente > limite || (siguiente > fin && buffer[fin] !== 0)) return false;

    switch (tipo) {
      case 'VP8 ':
      case 'VP8L':
        if (animado || hayImagen || (hayAlfa && tipo === 'VP8L') || !esBloqueImagenWebp(buffer, tipo, datos, longitud)) {
          return false;
        }
        hayImagen = true;
        break;
      case 'ALPH':
        if (animado || hayImagen || hayAlfa || longitud < 2) return false;
        hayAlfa = true;
        break;
      case 'ANIM':
        if (!animado || hayAnimacion || longitud !== 6) return false;
        hayAnimacion = true;
        break;
      case 'ANMF':
        if (!hayAnimacion || longitud < 16 || (buffer[datos + 15] & 0xfc) !== 0 ||
            !tieneImagenWebp(buffer, datos + 16, fin, false)) return false;
        hayImagen = true;
        break;
      case 'VP8X':
        return false; // La cabecera extendida sólo puede aparecer al principio.
    }

    pos = siguiente;
  }
  return hayImagen && pos === limite;
}

function esWebp(buffer: Buffer): boolean {
  if (buffer.length < 20 || buffer.toString('latin1', 0, 4) !== 'RIFF' ||
      buffer.readUInt32LE(4) !== buffer.length - 8 || buffer.toString('latin1', 8, 12) !== 'WEBP') return false;

  const tipo = buffer.toString('latin1', 12, 16);
  const longitud = buffer.readUInt32LE(16);
  if (tipo === 'VP8X') {
    if (longitud !== 10 || buffer.length < 30 || (buffer[20] & 0xc1) !== 0 || buffer.readUIntLE(21, 3) !== 0) {
      return false;
    }
    return tieneImagenWebp(buffer, 30, buffer.length, (buffer[20] & 0x02) !== 0);
  }

  return (tipo === 'VP8 ' || tipo === 'VP8L') && 20 + longitud + (longitud & 1) === buffer.length &&
    tieneImagenWebp(buffer, 12, buffer.length, false);
}

const formatosDeImagen = new Map([
  ['.png', { extension: '.png', validar: esPng }],
  ['.jpg', { extension: '.jpg', validar: esJpeg }],
  ['.jpeg', { extension: '.jpg', validar: esJpeg }],
  ['.webp', { extension: '.webp', validar: esWebp }],
]);

/** POST /api/admin/subir-archivo */
router.post('/subir-archivo', (req, res, next) => {
  try {
    const { nombre, contenidoBase64 } = req.body || {};

    if (!esTextoValido(nombre) || nombre.includes('/') || nombre.includes('\\') ||
        typeof contenidoBase64 !== 'string' || contenidoBase64.length === 0) {
      return res.status(400).json({ error: 'Archivo o nombre inválido.' });
    }
    const formato = formatosDeImagen.get(path.extname(nombre).toLowerCase());
    if (!formato) {
      return res.status(415).json({ error: 'Sólo se admiten imágenes PNG, JPEG y WebP.' });
    }
    if (contenidoBase64.length > MAX_BASE64_IMAGEN) {
      return res.status(413).json({ error: 'La imagen supera el máximo de 512 KiB.' });
    }
    if (contenidoBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(contenidoBase64)) {
      return res.status(400).json({ error: 'El contenido base64 es inválido.' });
    }
    if (Buffer.byteLength(contenidoBase64, 'base64') > MAX_SIZE_IMAGEN) {
      return res.status(413).json({ error: 'La imagen supera el máximo de 512 KiB.' });
    }
    const buffer = Buffer.from(contenidoBase64, 'base64');
    if (buffer.length === 0 || buffer.toString('base64') !== contenidoBase64) {
      return res.status(400).json({ error: 'El contenido base64 es inválido.' });
    }
    if (!formato.validar(buffer)) {
      return res.status(415).json({ error: 'La imagen es inválida o no corresponde a la extensión.' });
    }

    const nombreGuardado = `${randomUUID()}${formato.extension}`;
    const directorio = path.resolve(config.uploadsDir);
    const destino = path.resolve(directorio, nombreGuardado);
    if (path.dirname(destino) !== directorio) throw new Error('Destino de subida inválido.');

    fs.mkdirSync(directorio, { recursive: true });
    fs.writeFileSync(destino, buffer, { flag: 'wx', mode: 0o644 });

    res.json({
      mensaje: 'Archivo subido.',
      url: `/uploads/${nombreGuardado}`,
      bytes: buffer.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
