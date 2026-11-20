import path from 'path';

const dbUser = process.env.DB_USER || 'origen_app';
if (dbUser !== 'origen_app') {
  throw new Error('DB_USER debe ser origen_app.');
}

const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) {
  throw new Error('Falta configurar DB_PASSWORD.');
}

export default {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || 'db',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'origen',
    user: dbUser,
    password: dbPassword,
  },

  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads'),
};
