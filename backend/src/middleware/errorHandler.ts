import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { env } from '../config/env';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Unhandled error', {
    message: err.message,
    code: err.code,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: (err.issues || (err as any).errors || []).map((e: any) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[]) || [];
        res.status(409).json({
          success: false,
          error: {
            message: `Duplicate value for: ${target.join(', ')}`,
            code: 'DUPLICATE_ENTRY',
          },
        });
        return;
      }
      case 'P2025':
        res.status(404).json({
          success: false,
          error: {
            message: 'Record not found',
            code: 'NOT_FOUND',
          },
        });
        return;
      case 'P2003':
        res.status(400).json({
          success: false,
          error: {
            message: 'Referenced record not found',
            code: 'FOREIGN_KEY_VIOLATION',
          },
        });
        return;
      default:
        res.status(500).json({
          success: false,
          error: {
            message: 'Database error',
            code: 'DATABASE_ERROR',
          },
        });
        return;
    }
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Invalid database query',
        code: 'VALIDATION_ERROR',
      },
    });
    return;
  }

  // JWT errors
  if (err instanceof jwt.TokenExpiredError) {
    res.status(401).json({
      success: false,
      error: {
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
      },
    });
    return;
  }

  if (err instanceof jwt.JsonWebTokenError) {
    res.status(401).json({
      success: false,
      error: {
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
      },
    });
    return;
  }

  // Generic error
  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500 && env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: err.code || 'INTERNAL_ERROR',
    },
  });
}
