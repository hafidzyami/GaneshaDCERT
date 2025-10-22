import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils';
import { env, logger } from '../config';
import { HTTP_STATUS } from '../constants';
import { TransformHelper } from '../utils/helpers';

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

  // Debug: Log error type and properties
  logger.debug('Error Handler Debug:', {
    errorName: error.name,
    errorMessage: error.message,
    isAppError: error instanceof AppError,
    isValidationError: error instanceof ValidationError,
    hasErrorsProperty: 'errors' in error,
    errorProperties: Object.keys(error)
  });

  // Handle operational errors
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;

    // Handle ValidationError specifically
    if (error instanceof ValidationError) {
      // Check if errors exist in the error object
      const validationError = error as ValidationError;
      
      logger.debug('ValidationError detected:', {
        hasErrors: !!validationError.errors,
        errorsIsArray: Array.isArray(validationError.errors),
        errorsLength: validationError.errors?.length
      });

      if (validationError.errors && Array.isArray(validationError.errors) && validationError.errors.length > 0) {
        errors = TransformHelper.transformValidationErrors(validationError.errors);
        
        // Log validation errors for debugging
        logger.warn('Validation Error:', {
          message: error.message,
          errors: errors,
          url: req.originalUrl,
          method: req.method,
          body: req.body,
        });
      } else {
        // If no errors array, log this case
        logger.warn('ValidationError without errors array:', {
          message: error.message,
          url: req.originalUrl,
          method: req.method,
        });
      }
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

  // Build response object
  const responseObj: any = {
    success: false,
    message,
  };

  // Add errors array if exists
  if (errors && errors.length > 0) {
    responseObj.errors = errors;
  }

  // Add requestId if exists
  if (req.requestId) {
    responseObj.requestId = req.requestId;
  }

  // Add stack trace in development
  if (env.NODE_ENV === 'development') {
    responseObj.stack = error.stack;
    responseObj.name = error.name;
  }

  // Send error response
  res.status(statusCode).json(responseObj);
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
