import * as db from './db';
import config from './config';
import { CATALOGO } from './catalogo';
import type { Rol } from './tipos';
import { esFormatoPasswordValido, excedeLimitePassword, hashPassword } from './services/usuarios.service';

interface UsuarioInicial {
  username: string;
  password: string;
  rol: Rol;
  nombre: string;
}

function passwordInicial(variable: 'ADMIN_PASSWORD' | 'DEMO_PASSWORD'): string {
  const password = process.env[variable];
  if (!esFormatoPasswordValido(password) || [...password.trim()].length < 12 || excedeLimitePassword(password)) {
    throw new Error(`Configurá ${variable} con al menos 12 caracteres y como máximo 72 bytes UTF-8.`);
  }
  return password;
}

/** Prepara las cuentas del arranque sin cambiar credenciales ya almacenadas. */
function usuariosIniciales(): UsuarioInicial[] {
  const passwordAdmin = passwordInicial('ADMIN_PASSWORD');
  const admin: UsuarioInicial = {
    username: 'admin',
    password: passwordAdmin,
    rol: 'admin',
    nombre: 'Administración',
  };
  if (process.env.DEMO_MODE !== 'true') return [admin];

  if (config.nodeEnv !== 'development') {
    throw new Error('DEMO_MODE sólo está disponible en desarrollo.');
  }
  const passwordDemo = passwordInicial('DEMO_PASSWORD');
  if (passwordDemo === passwordAdmin) {
    throw new Error('DEMO_PASSWORD debe ser diferente de ADMIN_PASSWORD.');
  }

  return [
    admin,
    { username: 'valentina', password: passwordAdmin, rol: 'admin', nombre: 'Valentina' },
    { username: 'barista', password: passwordDemo, rol: 'barista', nombre: 'Barista' },
    { username: 'mozo', password: passwordDemo, rol: 'mozo', nombre: 'Mozo de sala' },
    { username: 'cliente', password: passwordDemo, rol: 'cliente', nombre: 'Cliente' },
  ];
}

export async function inicializarBase(): Promise<void> {
  // --- Usuarios -------------------------------------------------------------
  for (const usuario of usuariosIniciales()) {
    const passwordHash = await hashPassword(usuario.password);

    await db.query(
      `INSERT INTO usuarios (username, password, rol, nombre)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username) DO NOTHING`,
      [usuario.username, passwordHash, usuario.rol, usuario.nombre]
    );
  }

  // --- Catálogo -------------------------------------------------------------
  for (const producto of CATALOGO) {
    await db.query(
      `INSERT INTO productos
         (nombre, tipo, variedad, tamano, gramos, precio_base, precio_por_gramo, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (nombre) DO NOTHING`,
      [
        producto.nombre,
        producto.tipo,
        producto.variedad,
        producto.tamano,
        producto.gramos,
        producto.precio_base,
        producto.precio_por_gramo,
        producto.descripcion,
      ]
    );
  }
}
