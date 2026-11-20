import type { NextFunction, Request, Response } from 'express';

import type { ErrorHttp } from '../tipos';

const mensajeRutaNoEncontrada = 'Ruta no encontrada.';
const mensajesCliente: Partial<Record<number, string>> = {
  400: 'Solicitud inválida.',
  401: 'Necesitás iniciar sesión.',
  403: 'No tenés permisos para esta operación.',
  404: mensajeRutaNoEncontrada,
  413: 'El cuerpo de la solicitud es demasiado grande.',
  415: 'Formato de solicitud no admitido.',
};

export function rutaNoEncontrada(_req: Request, res: Response): void {
  res.status(404).json({ error: mensajeRutaNoEncontrada });
}

export function manejadorErrores(err: ErrorHttp, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    // Express cierra la respuesta iniciada sin recibir los detalles del error original.
    next(new Error('Error interno después de iniciar la respuesta.'));
    return;
  }

  const estado = err?.status;
  if (typeof estado === 'number' && Number.isInteger(estado) && estado >= 400 && estado < 500) {
    res.status(estado).json({ error: mensajesCliente[estado] ?? 'Solicitud rechazada.' });
    return;
  }

  console.error('[error] Error interno', {
    metodo: req.method,
    ruta: req.route?.path,
    tipo: err instanceof TypeError ? 'TypeError' : 'Error',
  });
  res.status(500).json({ error: 'Error interno.' });
}
