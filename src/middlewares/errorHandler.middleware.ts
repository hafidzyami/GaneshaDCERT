import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors/AppError';
import { env } from '../config/env';
import { HTTP_STATUS } from '../constants';
import { TransformHelper } from '../utils/helpers';
import logger from '../config/logger';

/**
 * Global Error Handler Middleware
 */
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Default error values
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message = 'Internal server error';
  let errors: any[] | undefined;

  // Handle operational errors
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;

    if (error instanceof ValidationError && error.errors) {
      errors = TransformHelper.transformValidationErrors(error.errors);
    }
  } else {
    // Log unexpected errors
    logger.error('Unexpected Error', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
      requestId: req.requestId,
    });

    // Don't expose internal error details in production
    if (env.NODE_ENV === 'production') {
      message = 'Something went wrong';
    } else {
      message = error.message;
    }
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(req.requestId && { requestId: req.requestId }),
    ...(env.NODE_ENV === 'development' && {
      stack: error.stack,
      name: error.name,
    }),
  });
};

/**
 * Handle 404 Not Found
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    ...(req.requestId && { requestId: req.requestId }),
  });
};

/**
 * Async Handler Wrapper
 * Catches async errors and passes them to error handler
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
