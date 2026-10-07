import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  statusCode: number;
  errorCode: string;

  constructor(message: string, errorCode: string, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError('Route not found', 'ROUTE_NOT_FOUND', 404));
};

export const errorHandler = (error: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errorCode: error.errorCode,
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again later.',
    errorCode: 'INTERNAL_SERVER_ERROR',
  });
};
