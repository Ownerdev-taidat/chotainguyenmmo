// ===== FILE: src/middleware/error.middleware.ts =====

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorMiddleware(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    logger.warn('HTTP', `${err.statusCode} ${req.method} ${req.path}: ${err.message}`);
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  logger.error('HTTP', `Unhandled error: ${err.message}`, { stack: err.stack });
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}

export function notFoundMiddleware(req: Request, res: Response) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
}
