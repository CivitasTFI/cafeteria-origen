import express from 'express';

import { requiereSesion, requiereRol } from '../middleware/auth';

const router = express.Router();

router.get('/', requiereSesion, requiereRol('admin'), (_req, res) => {
  res.json({
    mensaje: 'Diagnóstico del servidor',
    version: '1.0.0',
  });
});

export default router;
